import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import logger from "../logger/winston.logger.js";
import MonthlyReportRecord from "../models/monthlyReportRecord.model.js";

// LibreOffice's own pptx->png export only renders the first slide, so the
// reliable path (used by most production deck viewers) is two steps:
//   1. soffice --headless --convert-to pdf   (pptx -> single pdf)
//   2. pdftoppm -png                          (pdf -> one png per page)
// Both binaries are external OS packages, not npm installs: install LibreOffice
// (provides `soffice`) and poppler-utils (provides `pdftoppm`) on every machine
// that runs this server, dev and prod alike. Paths are overridable via env vars
// (SOFFICE_PATH / PDFTOPPM_PATH) for hosts where they aren't already on PATH
// (common on a fresh Windows install — point them at soffice.exe/pdftoppm.exe).
const SOFFICE_BIN = process.env.SOFFICE_PATH || "soffice";
const PDFTOPPM_BIN = process.env.PDFTOPPM_PATH || "pdftoppm";
const CONVERT_TIMEOUT_MS = 5 * 60 * 1000; // large decks with embedded video can take a while

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const CONVERT_TMP_ROOT = path.join(UPLOADS_ROOT, "tmp", "monthly-report-convert");
const SLIDES_ROOT = path.join(UPLOADS_ROOT, "monthly-report", "slides");

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const runCommand = (bin, args, { cwd } = {}) => new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`${bin} timed out after ${CONVERT_TIMEOUT_MS}ms`));
    }, CONVERT_TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", (err) => {
        clearTimeout(timer);
        reject(new Error(`Failed to start ${bin}: ${err.message}`));
    });
    child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${bin} exited with code ${code}: ${stderr || stdout}`));
    });
});

// Natural sort so slide-2.png sorts before slide-10.png.
const sortSlideFiles = (files) => files.sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)(?=\.png$)/)?.[1] || "0", 10);
    const numB = parseInt(b.match(/(\d+)(?=\.png$)/)?.[1] || "0", 10);
    return numA - numB;
});

async function convertPptxToSlides(recordId, absolutePptxPath) {
    const tmpDir = path.join(CONVERT_TMP_ROOT, `${recordId}-${Date.now()}`);
    ensureDir(tmpDir);

    try {
        await runCommand(SOFFICE_BIN, [
            "--headless", "--norestore",
            "--convert-to", "pdf",
            "--outdir", tmpDir,
            absolutePptxPath
        ]);

        const pdfFile = fs.readdirSync(tmpDir).find((f) => f.toLowerCase().endsWith(".pdf"));
        if (!pdfFile) throw new Error("LibreOffice did not produce a PDF from this file");

        await runCommand(PDFTOPPM_BIN, [
            "-png", "-r", "150",
            path.join(tmpDir, pdfFile),
            path.join(tmpDir, "slide")
        ]);

        const slideFiles = sortSlideFiles(fs.readdirSync(tmpDir).filter((f) => f.toLowerCase().endsWith(".png")));
        if (slideFiles.length === 0) throw new Error("No slide images were produced");

        const finalDir = path.join(SLIDES_ROOT, String(recordId));
        // Wipe any previous attempt's output before writing fresh slides.
        if (fs.existsSync(finalDir)) fs.rmSync(finalDir, { recursive: true, force: true });
        ensureDir(finalDir);

        const slides = slideFiles.map((fileName, index) => {
            const slideIndex = index + 1;
            const targetName = `slide_${slideIndex}.png`;
            fs.renameSync(path.join(tmpDir, fileName), path.join(finalDir, targetName));
            return { slideIndex, url: `/uploads/monthly-report/slides/${recordId}/${targetName}` };
        });

        return slides;
    } finally {
        fs.rm(tmpDir, { recursive: true, force: true }, () => {}); // best-effort cleanup, never blocks the caller
    }
}

// --- Bounded-concurrency in-process queue -----------------------------------
// This app runs as a single `pm2 fork` instance today, so an in-process queue
// is correctly sized. If upload volume grows enough to need multi-instance
// workers, this is the piece to swap for BullMQ + Redis — the queue/worker
// boundary is already isolated here for that.
const MAX_CONCURRENT_CONVERSIONS = 2;
const queue = [];
let activeCount = 0;

function processQueue() {
    if (activeCount >= MAX_CONCURRENT_CONVERSIONS || queue.length === 0) return;
    const job = queue.shift();
    activeCount++;

    runJob(job).finally(() => {
        activeCount--;
        processQueue();
    });
}

async function runJob({ recordId, absolutePptxPath }) {
    try {
        await MonthlyReportRecord.markProcessing(recordId);
        logger.info(`[monthlyReportConversion] Starting conversion for record ${recordId}`);

        const slides = await convertPptxToSlides(recordId, absolutePptxPath);
        await MonthlyReportRecord.markDone(recordId, { slides, slideCount: slides.length });

        logger.info(`[monthlyReportConversion] Completed record ${recordId} — ${slides.length} slides`);
    } catch (error) {
        logger.error(`[monthlyReportConversion] Failed record ${recordId}:`, error);
        await MonthlyReportRecord.markFailed(recordId, error.message).catch((dbErr) => {
            logger.error(`[monthlyReportConversion] Also failed to persist failure state for record ${recordId}:`, dbErr);
        });
    }
}

const pptxConversionService = {
    enqueue(recordId, absolutePptxPath) {
        queue.push({ recordId, absolutePptxPath });
        processQueue();
    }
};

export default pptxConversionService;
