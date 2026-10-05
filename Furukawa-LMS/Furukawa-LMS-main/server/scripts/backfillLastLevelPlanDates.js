import { executeQuery } from "../db/mssqlHelper.js";
import CourseLevelConfig from "../models/courseLevelConfig.model.js";

// Backfills skill_upgradation_plans rows that reached the last (max-order) configured skill
// level in some quarter but were saved before admin/src/components/departments/
// SkillUpgradationPlan.jsx's handleRowFieldChange started carrying that level (and a computed
// plan date) forward into the next quarter. Mirrors that same frontend logic exactly:
//   - day-count resolved from the plan's section (skillUpgradationDayCounts[level] ->
//     skillUpgradationDayCount -> +3 months fallback)
//   - target quarter = the calculated date's own quarter, pushed to the start of the next
//     quarter if that calculation landed in the same-or-earlier quarter as the completion
//   - the target quarter's Skill is set to the same (last) level name, Status set to "Planned"
//
// Conservative on purpose: only fills a target quarter whose Date, Skill, AND Status are all
// already empty. Anything else is logged and skipped for manual review rather than overwritten.
//
// Usage:
//   node scripts/backfillLastLevelPlanDates.js          (dry run, logs only)
//   node scripts/backfillLastLevelPlanDates.js --apply  (writes changes)

const QUARTER_KEYS = ["q1", "q2", "q3"]; // q4 has no "next quarter" within the plan's year
const QUARTER_INDEX = { q1: 1, q2: 2, q3: 3, q4: 4 };
const QUARTER_START_MONTH_DAY = { q1: "01-01", q2: "04-01", q3: "07-01", q4: "10-01" };

const addThreeMonths = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1 + 3, d);
    if (date.getDate() !== d) date.setDate(0);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const calculateFutureDate = (dateStr, dayCount) => {
    const count = parseInt(dayCount, 10);
    if (!Number.isFinite(count) || count <= 0) return addThreeMonths(dateStr);
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1, d + count);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const monthToQuarterKey = (month) => (month ? `q${Math.floor((month - 1) / 3) + 1}` : null);

async function backfill() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    const activeConfig = await CourseLevelConfig.getActiveConfig();
    const levels = activeConfig?.levels || [];
    if (!levels.length) {
        console.log("No active level config found — nothing to do.");
        return;
    }
    const maxOrder = levels.reduce((max, l) => (typeof l.order === "number" && l.order > max ? l.order : max), -Infinity);
    const maxLevelNames = new Set(
        levels.filter(l => l.order === maxOrder).map(l => l.name?.toUpperCase())
    );
    console.log(`Active config has ${levels.length} level(s); treating as "last level": ${[...maxLevelNames].join(", ")}`);

    const [plans] = await executeQuery(`SELECT id, sectionId, year, tableData FROM skill_upgradation_plans`);
    console.log(`Found ${plans.length} plan(s).`);

    // Cache section day-count config per sectionId so we don't re-query it per row.
    const sectionConfigCache = new Map();
    const getSectionDayCounts = async (sectionId) => {
        if (!sectionId) return { skillUpgradationDayCount: null, perLevelDayCounts: {} };
        if (sectionConfigCache.has(sectionId)) return sectionConfigCache.get(sectionId);
        const [rows] = await executeQuery(
            "SELECT skillUpgradationDayCount, skillUpgradationDayCounts FROM [sections] WHERE id = ?",
            [sectionId]
        );
        const sectionRow = rows[0] || {};
        let perLevelDayCounts = {};
        if (sectionRow.skillUpgradationDayCounts) {
            try { perLevelDayCounts = JSON.parse(sectionRow.skillUpgradationDayCounts); } catch (e) { perLevelDayCounts = {}; }
        }
        const result = { skillUpgradationDayCount: sectionRow.skillUpgradationDayCount ?? null, perLevelDayCounts };
        sectionConfigCache.set(sectionId, result);
        return result;
    };

    let rowsFilled = 0;
    let rowsSkipped = 0;
    let plansChanged = 0;

    for (const plan of plans) {
        const planYear = parseInt(plan.year, 10);
        if (!Number.isFinite(planYear)) continue;

        const { skillUpgradationDayCount, perLevelDayCounts } = await getSectionDayCounts(plan.sectionId);
        const tableData = typeof plan.tableData === "string" ? JSON.parse(plan.tableData) : plan.tableData || {};
        let planChanged = false;

        for (const [userId, row] of Object.entries(tableData)) {
            if (userId === "__removedUserIds" || !row || typeof row !== "object") continue;

            for (const q of QUARTER_KEYS) {
                const skillField = `${q}Skill`;
                const actualField = `${q}DateActual`;
                const level = row[skillField];
                const actualVal = row[actualField];

                if (!level || !maxLevelNames.has(String(level).toUpperCase()) || !actualVal) continue;

                const dayCount = perLevelDayCounts[level] ?? skillUpgradationDayCount ?? null;
                let futureDate = calculateFutureDate(actualVal, dayCount);
                if (!futureDate) continue;

                const [, fMonthStr] = futureDate.split("-");
                let targetQuarterKey = monthToQuarterKey(parseInt(fMonthStr, 10));
                if (!targetQuarterKey) continue;

                if (targetQuarterKey && QUARTER_INDEX[targetQuarterKey] <= QUARTER_INDEX[q] && QUARTER_INDEX[q] < 4) {
                    targetQuarterKey = `q${QUARTER_INDEX[q] + 1}`;
                    futureDate = `${planYear}-${QUARTER_START_MONTH_DAY[targetQuarterKey]}`;
                }

                const targetDateField = `${targetQuarterKey}Date`;
                const targetSkillField = `${targetQuarterKey}Skill`;
                const targetStatusField = `${targetQuarterKey}Status`;

                if (row[targetDateField] || row[targetSkillField] || row[targetStatusField]) {
                    console.log(`[plan ${plan.id}] user ${userId}: ${q} is at last level (${level}, actual ${actualVal}) — target ${targetQuarterKey} already has data (Date="${row[targetDateField] || ""}", Skill="${row[targetSkillField] || ""}", Status="${row[targetStatusField] || ""}") — SKIPPED, needs manual review`);
                    rowsSkipped++;
                    continue;
                }

                row[targetDateField] = futureDate;
                row[targetSkillField] = level;
                row[targetStatusField] = "Planned";
                planChanged = true;
                rowsFilled++;
                console.log(`[plan ${plan.id}] user ${userId}: ${q} last level (${level}, actual ${actualVal}) -> filled ${targetSkillField}="${level}", ${targetDateField}="${futureDate}", ${targetStatusField}="Planned"`);
            }
        }

        if (planChanged) {
            plansChanged++;
            if (apply) {
                await executeQuery(
                    `UPDATE skill_upgradation_plans SET tableData = ?, updatedAt = GETDATE() WHERE id = ?`,
                    [JSON.stringify(tableData), plan.id]
                );
                console.log(`[plan ${plan.id}] Saved.`);
            }
        }
    }

    console.log(`\nDone. ${rowsFilled} field-set(s) filled across ${plansChanged} plan(s), ${rowsSkipped} skipped for manual review.`);
    if (!apply) {
        console.log("This was a dry run — re-run with --apply to write these changes.");
    }
}

backfill()
    .catch((err) => {
        console.error("Error running backfill:", err);
        process.exitCode = 1;
    })
    .finally(() => process.exit());
