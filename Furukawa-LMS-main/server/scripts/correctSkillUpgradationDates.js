import { executeQuery } from "../db/mssqlHelper.js";

// One-time correction for the 6 mismatched dates found by checkMismatchedSkillUpgradationDates.js
// (all pre-date the quarter-bound restrictions added to the UI/auto-sync). Each entry below
// moves a specific field's value into the field it actually belongs to, or clamps it to the
// start of the quarter it was auto-synced into.
//
// Usage:
//   node scripts/correctSkillUpgradationDates.js          (dry run, logs only)
//   node scripts/correctSkillUpgradationDates.js --apply  (writes changes)

const CORRECTIONS = [
    {
        planId: 4,
        userId: "19625",
        description: "Move Q3 completion (actual date + earned skill) out of the Q1 cells it was mistakenly saved under, and move its auto-synced next-quarter plan date into Q4 (it was landing in Q2 instead).",
        apply: (row) => {
            const next = { ...row };
            next.q3DateActual = row.q1DateActual;
            next.q3Skill = row.q1Skill;
            next.q1Date = "";
            next.q1DateActual = "";
            next.q1Skill = "";
            next.q4Date = row.q2Date;
            next.q2Date = "";
            return next;
        },
    },
    {
        planId: 5,
        userId: "16824",
        description: "Clamp Q4 plan date (was a July date, same quarter as the Q3 completion it was calculated from) to the start of Q4.",
        apply: (row) => ({ ...row, q4Date: "2026-10-01" }),
    },
    {
        planId: 5,
        userId: "17294",
        description: "Clamp Q4 plan date (was an August date, same quarter as the Q3 completion it was calculated from) to the start of Q4.",
        apply: (row) => ({ ...row, q4Date: "2026-10-01" }),
    },
    {
        planId: 5,
        userId: "19711",
        description: "Clamp Q4 plan date (was an August date, same quarter as the Q3 completion it was calculated from) to the start of Q4.",
        apply: (row) => ({ ...row, q4Date: "2026-10-01" }),
    },
];

async function correct() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    const planIds = [...new Set(CORRECTIONS.map(c => c.planId))];
    const [plans] = await executeQuery(
        `SELECT id, tableData FROM skill_upgradation_plans WHERE id IN (${planIds.map(() => "?").join(",")})`,
        planIds
    );
    const planById = new Map(plans.map(p => [p.id, p]));

    let corrected = 0;
    let skipped = 0;

    // Group corrections by plan so each plan is only read/written once even if it
    // has multiple affected users.
    const byPlan = new Map();
    for (const c of CORRECTIONS) {
        if (!byPlan.has(c.planId)) byPlan.set(c.planId, []);
        byPlan.get(c.planId).push(c);
    }

    for (const [planId, corrections] of byPlan.entries()) {
        const planRow = planById.get(planId);
        if (!planRow) {
            console.log(`[plan ${planId}] Not found in database — skipping ${corrections.length} correction(s).`);
            skipped += corrections.length;
            continue;
        }

        const tableData = typeof planRow.tableData === "string" ? JSON.parse(planRow.tableData) : planRow.tableData || {};
        let planChanged = false;

        for (const c of corrections) {
            const row = tableData[c.userId];
            if (!row) {
                console.log(`[plan ${planId}] User ${c.userId} not found in tableData — skipping.`);
                skipped++;
                continue;
            }

            const before = { ...row };
            const after = c.apply(row);
            tableData[c.userId] = after;
            planChanged = true;
            corrected++;

            console.log(`[plan ${planId}] User ${c.userId}: ${c.description}`);
            for (const key of Object.keys(after)) {
                if (before[key] !== after[key]) {
                    console.log(`    ${key}: ${JSON.stringify(before[key] ?? "")} -> ${JSON.stringify(after[key] ?? "")}`);
                }
            }
        }

        if (apply && planChanged) {
            await executeQuery(
                `UPDATE skill_upgradation_plans SET tableData = ?, updatedAt = GETDATE() WHERE id = ?`,
                [JSON.stringify(tableData), planId]
            );
            console.log(`[plan ${planId}] Saved.`);
        }
    }

    console.log(`\nDone. Corrected ${corrected} record(s), skipped ${skipped}.`);
    if (!apply) {
        console.log("This was a dry run — re-run with --apply to write these changes.");
    }
}

correct()
    .catch((err) => {
        console.error("Error running correction:", err);
        process.exitCode = 1;
    })
    .finally(() => process.exit());
