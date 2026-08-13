import { executeQuery } from "../db/mssqlHelper.js";

// Generic correction for skill_upgradation_plans rows where a q{n}Date / q{n}DateActual
// value doesn't actually fall within quarter n (see checkMismatchedSkillUpgradationDates.js).
// Works against whichever database server this is run against — it scans every plan
// instead of relying on hardcoded plan/user IDs, since those differ per environment.
//
// Two distinct historical bugs produced these mismatches (both now fixed at the source in
// admin/src/components/departments/SkillUpgradationPlan.jsx's handleRowFieldChange and
// server/utils/skillMatrix.util.js's syncToSkillUpgradationPlan), and each needs a different
// repair:
//
//   1. A q{n}DateActual (or a plan Date whose true month is LATER than its declared quarter)
//      is a real, correctly-computed date that just got filed under the wrong quarter key
//      (the old ACTUAL_TO_PLAN mapping moved it to "the next quarter" blindly, without
//      checking which quarter the computed date's month actually fell in). Fix: RELOCATE the
//      value (and, for DateActual, its paired Skill/Status) to the quarter it truly belongs
//      to — but only if that quarter's own fields are still empty, so real data already
//      recorded there is never overwritten.
//
//   2. A q{n}Date whose true month is the SAME quarter as (or earlier than) its own declared
//      quarter is a plan target that was calculated from too short a day-count, landing back
//      in-or-before the quarter it was supposed to be a *future* target for. Fix: CLAMP it to
//      the first day of its own declared quarter, since the slot itself is correct — only the
//      calculated day was wrong.
//
// A date whose year doesn't match the plan's year at all can't be placed anywhere in this
// plan, so it's simply cleared.
//
// Usage:
//   node scripts/correctSkillUpgradationDates.js          (dry run, logs only)
//   node scripts/correctSkillUpgradationDates.js --apply  (writes changes)

const QUARTER_KEYS = ["q1", "q2", "q3", "q4"];
const QUARTER_INDEX = { q1: 1, q2: 2, q3: 3, q4: 4 };
const QUARTER_START_MONTH_DAY = { q1: "01-01", q2: "04-01", q3: "07-01", q4: "10-01" };

const parseDate = (val) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val || "");
    if (!match) return null;
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
};

const monthToQuarterKey = (month) => (month ? `q${Math.floor((month - 1) / 3) + 1}` : null);

// Returns the field's true quarter key if its value's year matches the plan year, else null
// (unparsable or a different year entirely — can't be placed anywhere in this plan).
const trueQuarterOf = (val, planYear) => {
    const parsed = parseDate(val);
    if (!parsed || parsed.year !== planYear) return null;
    return monthToQuarterKey(parsed.month);
};

function correctRow(row, planYear, planId, userId, log) {
    const next = { ...row };
    let changed = false;

    // --- DateActual (real, historical completion dates): always relocate to the quarter
    // they truly fall in, moving the paired Skill/Status along so a quarter's data stays
    // internally consistent. Never clamp an actual date — that would falsify history.
    for (const q of QUARTER_KEYS) {
        const actualField = `${q}DateActual`;
        const actualVal = next[actualField];
        if (!actualVal) continue;

        const trueQ = trueQuarterOf(actualVal, planYear);
        if (trueQ === q) continue; // already correct

        if (!trueQ) {
            log(`plan ${planId} user ${userId}: ${actualField} "${actualVal}" is unparsable or a different year — cleared`);
            next[actualField] = "";
            changed = true;
            continue;
        }

        const targetActualField = `${trueQ}DateActual`;
        if (next[targetActualField]) {
            log(`plan ${planId} user ${userId}: ${actualField} "${actualVal}" belongs in ${trueQ} but ${targetActualField} is already "${next[targetActualField]}" — SKIPPED, needs manual review`);
            continue;
        }

        next[targetActualField] = actualVal;
        next[actualField] = "";
        changed = true;
        log(`plan ${planId} user ${userId}: moved ${actualField} ("${actualVal}") -> ${targetActualField}`);

        const sourceSkillField = `${q}Skill`;
        const targetSkillField = `${trueQ}Skill`;
        if (next[sourceSkillField] && !next[targetSkillField]) {
            log(`plan ${planId} user ${userId}: moved ${sourceSkillField} ("${next[sourceSkillField]}") -> ${targetSkillField}`);
            next[targetSkillField] = next[sourceSkillField];
            next[sourceSkillField] = "";
        }

        const sourceStatusField = `${q}Status`;
        const targetStatusField = `${trueQ}Status`;
        if (next[sourceStatusField] && !next[targetStatusField]) {
            next[targetStatusField] = next[sourceStatusField];
            next[sourceStatusField] = "";
        }
    }

    // --- Date (forward plan targets): relocate if the true month is a LATER quarter than
    // declared (a valid date filed under the wrong slot); clamp to the declared quarter's
    // start if the true month is the same quarter or earlier (a mis-calculated day, but the
    // slot itself is right).
    for (const q of QUARTER_KEYS) {
        const dateField = `${q}Date`;
        const dateVal = next[dateField];
        if (!dateVal) continue;

        const parsed = parseDate(dateVal);
        const trueQ = parsed && parsed.year === planYear ? monthToQuarterKey(parsed.month) : null;
        if (trueQ === q) continue; // already correct

        if (trueQ && QUARTER_INDEX[trueQ] > QUARTER_INDEX[q]) {
            const targetDateField = `${trueQ}Date`;
            if (next[targetDateField]) {
                log(`plan ${planId} user ${userId}: ${dateField} "${dateVal}" belongs in ${trueQ} but ${targetDateField} is already "${next[targetDateField]}" — SKIPPED, needs manual review`);
                continue;
            }
            next[targetDateField] = dateVal;
            next[dateField] = "";
            changed = true;
            log(`plan ${planId} user ${userId}: moved ${dateField} ("${dateVal}") -> ${targetDateField}`);
        } else {
            const clamped = `${planYear}-${QUARTER_START_MONTH_DAY[q]}`;
            next[dateField] = clamped;
            changed = true;
            log(`plan ${planId} user ${userId}: clamped ${dateField} "${dateVal}" -> "${clamped}" (start of ${q})`);
        }
    }

    return { row: next, changed };
}

async function correct() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    const [plans] = await executeQuery(`SELECT id, year, tableData FROM skill_upgradation_plans`);
    console.log(`Found ${plans.length} plan(s).`);

    let plansChanged = 0;
    let rowsCorrected = 0;

    for (const plan of plans) {
        const planYear = parseInt(plan.year, 10);
        if (!Number.isFinite(planYear)) {
            console.log(`[plan ${plan.id}] Skipping — no valid year on this plan.`);
            continue;
        }

        const tableData = typeof plan.tableData === "string" ? JSON.parse(plan.tableData) : plan.tableData || {};
        let planChanged = false;

        for (const [userId, row] of Object.entries(tableData)) {
            if (userId === "__removedUserIds" || !row || typeof row !== "object") continue;

            const { row: correctedRow, changed } = correctRow(row, planYear, plan.id, userId, console.log);
            if (changed) {
                tableData[userId] = correctedRow;
                planChanged = true;
                rowsCorrected++;
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

    console.log(`\nDone. ${rowsCorrected} row(s) corrected across ${plansChanged} plan(s).`);
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
