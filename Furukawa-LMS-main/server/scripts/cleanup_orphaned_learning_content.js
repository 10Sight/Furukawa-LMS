import fs from "fs";
import path from "path";
import LearningComparison from "../models/learningComparison.model.js";

// One-time repair for files left behind in uploads/learning-content because
// updateComparison/deleteComparison used to only touch the database, never the
// filesystem. Any file on disk that is no longer referenced by any comparison
// record is an orphan. Orphans are copied to uploads/learning-content-backup/
// (with a manifest describing the best-guess source) before being removed from
// the live folder, so nothing is ever deleted without a copy existing first.
// Safe to re-run; only touches files that are currently unreferenced.

const fileFields = [
    "beforeVideo", "beforePdf", "beforeExcel", "beforeWord", "beforePpt", "beforeImage",
    "afterVideo", "afterPdf", "afterExcel", "afterWord", "afterPpt", "afterImage"
];

const CONTENT_DIR = path.join(process.cwd(), "uploads", "learning-content");
const BACKUP_DIR = path.join(process.cwd(), "uploads", "learning-content-backup");

// Filenames are `${Date.now()}-${random}${ext}` (see saveToLocal in fileStorage.util.js).
const extractTimestamp = (fileName) => {
    const match = fileName.match(/^(\d+)-/);
    return match ? Number(match[1]) : null;
};

// Best-effort guess at which comparison an orphan belonged to: the closest
// createdAt/updatedAt among currently-live comparisons, if within 1 hour.
const guessSource = (fileTimeMs, comparisons) => {
    const ONE_HOUR = 60 * 60 * 1000;
    let best = null;
    for (const c of comparisons) {
        for (const [label, ts] of [["createdAt", c.createdAt], ["updatedAt", c.updatedAt]]) {
            if (!ts) continue;
            const diff = Math.abs(new Date(ts).getTime() - fileTimeMs);
            if (diff <= ONE_HOUR && (!best || diff < best.diff)) {
                best = { diff, comparisonId: c.id, title: c.title, label };
            }
        }
    }
    if (!best) return "No live comparison within 1 hour - likely a draft/retry or belonged to a deleted comparison";
    return `~${Math.round(best.diff / 60000)}min from Comparison #${best.comparisonId} (${best.title}) ${best.label}`;
};

async function main() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "=== RUNNING IN APPLY MODE (files will be backed up and removed) ===" : "=== RUNNING IN DRY RUN MODE (no files will be touched) ===");

    if (!fs.existsSync(CONTENT_DIR)) {
        console.log(`No content directory found at ${CONTENT_DIR}, nothing to do.`);
        process.exit(0);
    }

    const comparisons = await LearningComparison.findAll();

    const referenced = new Set();
    for (const c of comparisons) {
        for (const field of fileFields) {
            const urls = Array.isArray(c[field]) ? c[field] : [];
            for (const url of urls) {
                referenced.add(path.basename(url));
            }
        }
    }

    const filesOnDisk = fs.readdirSync(CONTENT_DIR).filter(f => fs.statSync(path.join(CONTENT_DIR, f)).isFile());
    const orphans = filesOnDisk.filter(f => !referenced.has(f));

    console.log(`Files on disk: ${filesOnDisk.length}`);
    console.log(`Referenced by live comparisons: ${referenced.size}`);
    console.log(`Orphaned files: ${orphans.length}`);

    if (orphans.length === 0) {
        console.log("Nothing to clean up.");
        process.exit(0);
    }

    const manifestLines = [
        `Orphan cleanup run: ${new Date().toISOString()}`,
        `Mode: ${apply ? "APPLY" : "DRY RUN"}`,
        ""
    ];

    for (const fileName of orphans) {
        const ts = extractTimestamp(fileName);
        const uploadedAt = ts ? new Date(ts).toString() : "unknown";
        const guess = ts ? guessSource(ts, comparisons) : "unknown upload time";
        const line = `${fileName} | uploaded: ${uploadedAt} | ${guess}`;
        console.log(`- ${line}`);
        manifestLines.push(line);
    }

    if (!apply) {
        console.log("\nDry run completed. No files were touched. Pass '--apply' to back up and remove these orphans.");
        process.exit(0);
    }

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    let backedUp = 0;
    for (const fileName of orphans) {
        const src = path.join(CONTENT_DIR, fileName);
        const dest = path.join(BACKUP_DIR, fileName);
        fs.copyFileSync(src, dest);
        backedUp++;
    }
    console.log(`\nBacked up ${backedUp} file(s) to ${BACKUP_DIR}`);

    fs.writeFileSync(path.join(BACKUP_DIR, "manifest.txt"), manifestLines.join("\n") + "\n");
    console.log("Wrote manifest.txt");

    let removed = 0;
    for (const fileName of orphans) {
        // Only remove from the live folder once the backup copy is confirmed on disk.
        if (fs.existsSync(path.join(BACKUP_DIR, fileName))) {
            fs.unlinkSync(path.join(CONTENT_DIR, fileName));
            removed++;
        } else {
            console.warn(`Skipping removal of ${fileName}: backup copy not found`);
        }
    }
    console.log(`Removed ${removed} orphaned file(s) from ${CONTENT_DIR}`);
    console.log("\nCleanup applied successfully.");
    process.exit(0);
}

main().catch(err => {
    console.error("Error during orphaned learning content cleanup:", err);
    process.exit(1);
});
