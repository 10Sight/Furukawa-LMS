import { executeQuery } from "../db/mssqlHelper.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";
import SkillUpgradationPlan from "../models/skillUpgradationPlan.model.js";
import { syncToSkillUpgradationPlan, normalizeEvaluationDate } from "../utils/skillMatrix.util.js";

// One-time backfill for evaluations that were saved (and passed a level) before
// syncToSkillUpgradationPlan resolved a student's department/section through the
// same COALESCE(own column, derived via line/sub-section) chain User.findById uses.
// Sheets saved while that bug was live either synced nothing, or silently wrote into
// a phantom department+NULL-section+year plan that never shows up in the UI (the
// "Create Plan" screen always requires picking a real section, so a NULL-section row
// could only have been produced by that bug).
//
// This re-runs the (now-fixed) sync for every active, passed evaluation sheet, then
// deletes any leftover NULL-section plan rows.
//
// Usage:
//   node scripts/backfillSkillUpgradationPlanSync.js          (dry run, logs only)
//   node scripts/backfillSkillUpgradationPlanSync.js --apply  (writes changes)

const parseJSON = (data, fallback = {}) => {
    if (typeof data === "string") {
        try { return JSON.parse(data); } catch (e) { return fallback; }
    }
    return data || fallback;
};

async function backfill() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    const activeConfig = await CourseLevelConfig.getActiveConfig();

    const [sheets] = await executeQuery(
        `SELECT id, studentId, headerData, period, earnedLevel
         FROM skill_matrix_evaluations
         WHERE isActive = 1 AND earnedLevel IS NOT NULL AND earnedLevel <> 'L0'`
    );
    console.log(`Found ${sheets.length} active, passed evaluation sheet(s).`);

    let synced = 0;
    let skipped = 0;

    for (const sheet of sheets) {
        const headerData = parseJSON(sheet.headerData, {});
        const dateOfEvaluation = normalizeEvaluationDate(headerData.dateOfEvaluation);

        console.log(`[sheet ${sheet.id}] studentId=${sheet.studentId} level=${sheet.earnedLevel} period=${sheet.period} evalDate=${dateOfEvaluation || "(unparsable — will default to today)"}`);

        if (!apply) {
            synced++;
            continue;
        }

        try {
            await syncToSkillUpgradationPlan({
                studentId: sheet.studentId,
                earnedLevelName: sheet.earnedLevel,
                dateOfEvaluation,
                period: sheet.period,
                activeConfig
            });
            synced++;
        } catch (err) {
            console.error(`  -> FAILED for studentId=${sheet.studentId}:`, err.message);
            skipped++;
        }
    }

    console.log(`Sheets ${apply ? "synced" : "would sync"}: ${synced}, failed: ${skipped}.`);

    const [orphanRows] = await executeQuery(
        "SELECT id, departmentId, year, tableData FROM skill_upgradation_plans WHERE sectionId IS NULL"
    );
    console.log(`Found ${orphanRows.length} orphaned NULL-section plan row(s).`);

    for (const row of orphanRows) {
        const rowCount = Object.keys(parseJSON(row.tableData, {})).length;
        console.log(`[plan ${row.id}] departmentId=${row.departmentId} year=${row.year} studentRows=${rowCount}`);
        if (apply) {
            await SkillUpgradationPlan.delete(row.id);
            console.log(`  -> deleted`);
        }
    }

    console.log("Done.");
    process.exit(0);
}

backfill().catch(err => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
