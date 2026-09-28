import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../logger/winston.logger.js";
import MonthlyReportRecord from "../models/monthlyReportRecord.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Same approach as the PPT FME prototype's convert_presentation.ps1: PowerShell
// drives the actual PowerPoint desktop app via COM automation to export each
// slide as a PNG. This requires Microsoft PowerPoint to be installed and
// licensed on whichever machine runs this Node server — it is a Windows-only,
// COM-based approach (unlike a headless converter), so it only works here
// because that's confirmed to be the case for this deployment.
const CONVERT_SCRIPT_PATH = path.join(__dirname, "..", "scripts", "convertPresentation.ps1");
const CONVERT_TIMEOUT_MS = 5 * 60 * 1000; // large decks with embedded video/animations can take a while

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const CONVERT_TMP_ROOT = path.join(UPLOADS_ROOT, "tmp", "monthly-report-convert");
const SLIDES_ROOT = path.join(UPLOADS_ROOT, "monthly-report", "slides");

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

// Natural sort so slide_2.png sorts before slide_10.png.
const sortSlideFiles = (files) => files.sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)(?=\.png$)/)?.[1] || "0", 10);
    const numB = parseInt(b.match(/(\d+)(?=\.png$)/)?.[1] || "0", 10);
    return numA - numB;
});

function runConversionScript(inputPath, outputDir) {
    return new Promise((resolve, reject) => {
        const child = spawn("powershell.exe", [
            "-ExecutionPolicy", "Bypass",
            "-File", CONVERT_SCRIPT_PATH,
            "-InputPath", inputPath,
            "-OutputDir", outputDir
        ]);

        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`PowerPoint conversion timed out after ${CONVERT_TIMEOUT_MS}ms`));
        }, CONVERT_TIMEOUT_MS);

        child.stdout.on("data", (d) => { stdout += d.toString(); });
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => {
            clearTimeout(timer);
            reject(new Error(`Failed to start powershell.exe: ${err.message}`));
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code === 0 && stdout.includes("CONVERSION_SUCCESS")) resolve();
            else reject(new Error(`PowerPoint conversion failed: ${stderr || stdout || `exit code ${code}`}`));
        });
    });
}

async function convertPptxToSlides(recordId, absolutePptxPath) {
    const tmpDir = path.join(CONVERT_TMP_ROOT, `${recordId}-${Date.now()}`);
    ensureDir(tmpDir);

    try {
        await runConversionScript(absolutePptxPath, tmpDir);

        const slideFiles = sortSlideFiles(fs.readdirSync(tmpDir).filter((f) => /^slide_\d+\.png$/i.test(f)));
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
// PowerPoint COM automation is not reliable with multiple concurrent instances
// on the same machine (unlike a headless converter), so conversions here run
// strictly one at a time — a second upload simply waits its turn in the queue
// rather than risking two PowerPoint COM sessions colliding.
const MAX_CONCURRENT_CONVERSIONS = 1;
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
