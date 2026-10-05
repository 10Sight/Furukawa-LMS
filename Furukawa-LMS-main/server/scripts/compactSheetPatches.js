import { executeQuery } from "../db/mssqlHelper.js";
import DailyMorningMeeting from "../models/dailyMorningMeeting.model.js";

// Folds every meeting's saved sheet patches into its stored workbook, leaving the
// daily_morning_meeting_patches table empty. The server does this by itself as patches
// build up (see compactPatches in the model); this is for doing all of it at once.
//
// Run it before rolling the server back to a release that predates patch saves: such a
// release reads only the stored workbook, so edits still held as patches would
// disappear from view. Turn SHEET_PATCH_SAVE off and restart first, so no new patches
// arrive while it runs.
//
// Nothing a user sees changes: each workbook's content, version and last-updated time
// stay the same.
//
// Usage:
//   node scripts/compactSheetPatches.js          (dry run, logs only)
//   node scripts/compactSheetPatches.js --apply  (writes changes)

async function run() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "APPLY mode — changes will be written." : "DRY RUN — no changes will be written. Pass --apply to write.");

    const ids = await DailyMorningMeeting.findIdsWithPatches();
    console.log(`${ids.length} meeting(s) have patch rows.`);

    let failed = 0;
    for (const id of ids) {
        try {
            const [[stats]] = await executeQuery(
                "SELECT COUNT(*) AS patches, ISNULL(SUM(rawBytes), 0) AS bytes FROM daily_morning_meeting_patches WHERE meetingId = ?", [id]
            );
            const summary = `${stats.patches} patch row(s), ${(stats.bytes / 1024).toFixed(1)} KB`;
            if (!apply) { console.log(`  meeting ${id}: would compact ${summary}`); continue; }

            const compacted = await DailyMorningMeeting.compactPatches(id);
            if (!compacted) {
                // Only rows a later full save already superseded; they hold nothing current.
                await executeQuery(
                    `DELETE p FROM daily_morning_meeting_patches p
                     JOIN daily_morning_meetings m ON m.id = p.meetingId
                     WHERE p.meetingId = ? AND p.version < m.version
                       AND NOT EXISTS (SELECT 1 FROM daily_morning_meeting_patches c WHERE c.meetingId = m.id AND c.version = m.version)`,
                    [id]
                );
            }
            const [[left]] = await executeQuery("SELECT COUNT(*) AS n FROM daily_morning_meeting_patches WHERE meetingId = ?", [id]);
            if (left.n > 0) {
                failed++;
                console.error(`  meeting ${id}: ${left.n} patch row(s) remain — it was saved during the run; run again`);
            } else {
                console.log(`  meeting ${id}: ${compacted ? "compacted" : "cleared superseded"} ${summary}`);
            }
        } catch (error) {
            failed++;
            console.error(`  meeting ${id}: FAILED — ${error.message}`);
        }
    }
    return failed;
}

run()
    .then((failed) => process.exit(failed ? 1 : 0))
    .catch((error) => { console.error("Failed:", error.message); process.exit(1); });
