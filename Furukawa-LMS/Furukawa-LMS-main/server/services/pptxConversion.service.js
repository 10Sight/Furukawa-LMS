import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
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
// 200 DPI keeps text/chart labels sharp when a slide is shown fullscreen on large displays.
const SLIDE_RENDER_DPI = process.env.SLIDE_RENDER_DPI || "200";
// Keep embedded images at full resolution in the intermediate PDF.
const PDF_EXPORT_FILTER = 'pdf:impress_pdf_Export:{"ReduceImageResolution":{"type":"boolean","value":"false"}}';

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

// Reads width/height straight from the PNG IHDR chunk (bytes 16-23) so the
// viewer can lay out each slide at its true aspect ratio (4:3, A4, custom…).
const readPngSize = (filePath) => {
    try {
        const fd = fs.openSync(filePath, "r");
        const header = Buffer.alloc(24);
        fs.readSync(fd, header, 0, 24, 0);
        fs.closeSync(fd);
        if (header.toString("ascii", 12, 16) !== "IHDR") return {};
        return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
    } catch {
        return {};
    }
};

const findPdf = (dir) => fs.readdirSync(dir).find((f) => f.toLowerCase().endsWith(".pdf"));

// pptx -> pdf. Tries the high-fidelity command first (isolated profile +
// lossless images); some LibreOffice builds/versions reject one of those
// options, so on failure it retries once with the plain command that has
// always worked, and reports both errors if that fails too.
async function convertToPdf(tmpDir, absolutePptxPath) {
    // Each conversion gets its own LibreOffice profile: concurrent soffice
    // processes sharing the default profile lock each other and can fail or hang.
    const profileUrl = pathToFileURL(path.join(tmpDir, "lo-profile")).href;
    let primaryError;

    try {
        await runCommand(SOFFICE_BIN, [
            `-env:UserInstallation=${profileUrl}`,
            "--headless", "--norestore",
            "--convert-to", PDF_EXPORT_FILTER,
            "--outdir", tmpDir,
            absolutePptxPath
        ]);
        const pdfFile = findPdf(tmpDir);
        if (pdfFile) return pdfFile;
        primaryError = new Error("LibreOffice did not produce a PDF from this file");
    } catch (error) {
        primaryError = error;
    }

    logger.warn(`[monthlyReportConversion] High-fidelity PDF export failed, retrying with basic export: ${primaryError.message}`);

    try {
        await runCommand(SOFFICE_BIN, [
            "--headless", "--norestore",
            "--convert-to", "pdf",
            "--outdir", tmpDir,
            absolutePptxPath
        ]);
    } catch (fallbackError) {
        throw new Error(`PDF export failed. High-fidelity: ${primaryError.message} | Basic: ${fallbackError.message}`);
    }

    const pdfFile = findPdf(tmpDir);
    if (!pdfFile) {
        throw new Error(`LibreOffice did not produce a PDF from this file (high-fidelity attempt: ${primaryError.message})`);
    }
    return pdfFile;
}

async function convertPptxToSlides(recordId, absolutePptxPath) {
    const tmpDir = path.join(CONVERT_TMP_ROOT, `${recordId}-${Date.now()}`);
    ensureDir(tmpDir);

    try {
        const pdfFile = await convertToPdf(tmpDir, absolutePptxPath);

        await runCommand(PDFTOPPM_BIN, [
            "-png", "-r", SLIDE_RENDER_DPI,
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
            const targetPath = path.join(finalDir, targetName);
            fs.renameSync(path.join(tmpDir, fileName), targetPath);
            return { slideIndex, url: `/uploads/monthly-report/slides/${recordId}/${targetName}`, ...readPngSize(targetPath) };
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
let idleWaiters = [];

function processQueue() {
    if (activeCount === 0 && queue.length === 0) {
        idleWaiters.forEach((resolve) => resolve());
        idleWaiters = [];
        return;
    }
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
    },

    // Resolves once every queued/running conversion has finished (used by the
    // bulk reconvert script, which must not exit while jobs are in flight).
    onIdle() {
        if (activeCount === 0 && queue.length === 0) return Promise.resolve();
        return new Promise((resolve) => idleWaiters.push(resolve));
    }
};

export default pptxConversionService;
