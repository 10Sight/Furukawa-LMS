import { executeQuery } from "../db/mssqlHelper.js";
import { encodeSheetPayload, decodeSheetPayload } from "../utils/sheetCodec.js";

// One-time migration of existing daily_morning_meetings workbooks from the plain-text
// `sheetData` column into the gzipped `sheetDataGz` column (see utils/sheetCodec.js).
// New saves already land there once SHEET_COMPRESSION_WRITE=true; this moves the rows
// that were saved before that.
//
// A row is rewritten only if its `version` is still the one that was read, so a save
// that lands mid-run is never overwritten — that row is skipped and picked up by the
// next run. Neither `version` nor `updatedAt` is touched: the workbook's content is
// unchanged, so open editors keep saving normally and browser caches stay valid.
//
// --reverse moves compressed workbooks back to plain text. Run it before rolling the
// server back to a release that predates the sheetDataGz column — such a release sees
// only the '{}' placeholder and would show those meetings as empty.
//
// Usage:
//   node scripts/compressSheetData.js                    (dry run, logs only)
//   node scripts/compressSheetData.js --apply            (writes changes)
//   node scripts/compressSheetData.js --apply --id=19    (one meeting only)
//   node scripts/compressSheetData.js --reverse --apply  (back to plain text)

const LONG = { longRunning: true };
const mb = (bytes) => `${((bytes || 0) / 1048576).toFixed(2)} MB`;

async function compressRow(id, apply) {
    const [[row]] = await executeQuery(
        "SELECT sheetData, version FROM daily_morning_meetings WHERE id = ? AND sheetDataGz IS NULL", [id], LONG
    );
    if (!row) return "skipped (already compressed or deleted)";
    if (row.sheetData == null) return "skipped (no workbook stored)";

    const { text, gz, rawBytes, storedBytes } = await encodeSheetPayload(row.sheetData, { compress: true });
    if (!gz) return "skipped (too small to be worth compressing)";
    // Prove the compressed copy reads back exactly before it replaces the original.
    if ((await decodeSheetPayload(text, gz)) !== row.sheetData) {
        throw new Error("round-trip check failed; row left untouched");
    }

    const summary = `${mb(row.sheetData.length * 2)} text -> ${mb(storedBytes)} gzip (${mb(rawBytes)} of JSON)`;
    if (!apply) return `would compress: ${summary}`;

    const [, result] = await executeQuery(
        "UPDATE daily_morning_meetings SET sheetData = ?, sheetDataGz = ? WHERE id = ? AND version = ? AND sheetDataGz IS NULL",
        [text, gz, id, row.version], LONG
    );
    return result.affectedRows ? `compressed: ${summary}` : "skipped (saved by someone during the run; run again)";
}

async function decompressRow(id, apply) {
    const [[row]] = await executeQuery(
        "SELECT sheetData, sheetDataGz, version FROM daily_morning_meetings WHERE id = ? AND sheetDataGz IS NOT NULL", [id], LONG
    );
    if (!row) return "skipped (not compressed, or deleted)";

    const json = await decodeSheetPayload(row.sheetData, row.sheetDataGz);
    const summary = `${mb(row.sheetDataGz.length)} gzip -> ${mb(json.length * 2)} text`;
    if (!apply) return `would decompress: ${summary}`;

    const [, result] = await executeQuery(
        "UPDATE daily_morning_meetings SET sheetData = ?, sheetDataGz = NULL WHERE id = ? AND version = ? AND sheetDataGz IS NOT NULL",
        [json, id, row.version], LONG
    );
    return result.affectedRows ? `decompressed: ${summary}` : "skipped (saved by someone during the run; run again)";
}

async function run() {
    const apply = process.argv.includes("--apply");
    const reverse = process.argv.includes("--reverse");
    const idArg = process.argv.find((a) => a.startsWith("--id="));
    const onlyId = idArg ? Number(idArg.slice(5)) : null;
    if (idArg && !Number.isInteger(onlyId)) throw new Error(`Invalid --id value: ${idArg}`);

    console.log(`${reverse ? "DECOMPRESS" : "COMPRESS"} — ${apply ? "APPLY mode, changes will be written." : "DRY RUN, no changes will be written. Pass --apply to write."}`);

    const [[column]] = await executeQuery("SELECT COL_LENGTH('daily_morning_meetings', 'sheetDataGz') AS len");
    if (column.len === null) {
        throw new Error("Column sheetDataGz does not exist yet. Start the server once on a release that adds it, then run this again.");
    }

    // Ids only, smallest first: workbooks are loaded one at a time so memory stays bounded.
    const [rows] = await executeQuery(
        `SELECT id FROM daily_morning_meetings
         WHERE sheetDataGz IS ${reverse ? "NOT NULL" : "NULL"}${onlyId !== null ? " AND id = ?" : ""}
         ORDER BY DATALENGTH(sheetData) + ISNULL(DATALENGTH(sheetDataGz), 0), id`,
        onlyId !== null ? [onlyId] : [], LONG
    );
    console.log(`${rows.length} candidate meeting(s).`);

    let failed = 0;
    for (const { id } of rows) {
        try {
            const outcome = await (reverse ? decompressRow(id, apply) : compressRow(id, apply));
            console.log(`  meeting ${id}: ${outcome}`);
        } catch (error) {
            failed++;
            console.error(`  meeting ${id}: FAILED — ${error.message}`);
        }
    }

    if (apply && !reverse) {
        console.log("\nDone. To hand the freed space back to the data file, run once in a quiet period:");
        console.log("  ALTER INDEX ALL ON daily_morning_meetings REORGANIZE WITH (LOB_COMPACTION = ON);");
    }
    return failed;
}

run()
    .then((failed) => process.exit(failed ? 1 : 0))
    .catch((error) => { console.error("Failed:", error.message); process.exit(1); });
