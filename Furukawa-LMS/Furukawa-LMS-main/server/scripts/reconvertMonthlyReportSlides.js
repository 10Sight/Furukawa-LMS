import fs from "fs";
import path from "path";
import MonthlyReportRecord from "../models/monthlyReportRecord.model.js";
import pptxConversionService from "../services/pptxConversion.service.js";

// Re-renders the slide images of every existing monthly-report presentation
// from its stored original file. Run after upgrading server fonts/LibreOffice
// or the converter so already-uploaded decks pick up the fixes.
//
// Run it from the server directory (paths resolve against process.cwd(), same
// as the running app):
//   node scripts/reconvertMonthlyReportSlides.js          (dry run, lists records)
//   node scripts/reconvertMonthlyReportSlides.js --apply  (reconverts them)

async function reconvertAll() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — slides will be regenerated." : "Running in DRY RUN mode — pass --apply to reconvert.");

    const records = await MonthlyReportRecord.findAllReconvertible();
    let queued = 0;
    let missing = 0;

    for (const record of records) {
        const absolutePptxPath = path.join(process.cwd(), record.fileUrl || "");
        if (!record.fileUrl?.startsWith("/uploads/") || !fs.existsSync(absolutePptxPath)) {
            console.warn(`  [skip] #${record.id} "${record.title}" — original file not found (${record.fileUrl})`);
            missing++;
            continue;
        }

        if (!apply) {
            console.log(`  [would reconvert] #${record.id} "${record.title}"`);
            queued++;
            continue;
        }

        if (await MonthlyReportRecord.markPendingForReconvert(record.id)) {
            pptxConversionService.enqueue(record.id, absolutePptxPath);
            console.log(`  [queued] #${record.id} "${record.title}"`);
            queued++;
        }
    }

    if (apply && queued > 0) {
        console.log(`Waiting for ${queued} conversion(s) to finish…`);
        await pptxConversionService.onIdle();
    }

    const failed = [];
    if (apply) {
        for (const record of records) {
            const latest = await MonthlyReportRecord.findById(record.id);
            if (latest?.conversionStatus === "FAILED") failed.push(latest);
        }
    }
    failed.forEach((r) => console.warn(`  [failed] #${r.id} "${r.title}": ${r.conversionError}`));

    console.log(`Done. ${apply ? "Reconverted" : "Would reconvert"}: ${queued}, missing originals: ${missing}${apply ? `, failed: ${failed.length}` : ""}.`);
    process.exit(failed.length > 0 ? 1 : 0);
}

reconvertAll().catch((err) => {
    console.error("Reconvert failed:", err);
    process.exit(1);
});
