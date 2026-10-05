import { executeQuery } from "../db/mssqlHelper.js";

// One-time backfill for legacy operators who joined before the 16-Day Monitoring
// Sheet feature existed, so they can never satisfy the "sixteenDayApprovedOnly"
// filter the Skill Upgradation Plan uses (getAllStudents in
// server/controllers/user.controller.js, EXISTS ... approvedBy LIKE '%Approved By%').
//
// For every user whose joiningDate is before CUTOFF_DATE and who doesn't already
// have an approved sheet, this creates (or promotes an existing draft/rejected
// attempt into) a synthetic already-approved sixteen_day_monitorings record so
// they become eligible again.
//
// Caveat: this writes a real row into sixteen_day_monitorings. If that student's
// own 16-Day Monitoring Sheet page is opened afterwards, it will show as
// "Approved" (signed "Approved By: System (Legacy Backfill)") with an otherwise
// blank grid — that's expected for this backfill, but worth knowing before
// running with --apply against production data.
//
// Set CUTOFF_DATE below, or pass --cutoff=YYYY-MM-DD.
//
// Usage:
//   node scripts/backfillLegacySixteenDaySheets.js --cutoff=2025-01-01           (dry run, logs only)
//   node scripts/backfillLegacySixteenDaySheets.js --cutoff=2025-01-01 --apply   (writes changes)

const CUTOFF_DATE = "2026-07-20"; // e.g. "2025-01-01" -- edit this, or pass --cutoff=YYYY-MM-DD on the command line

const SYSTEM_SIGNATURE = "Approved By: System (Legacy Backfill)";

async function backfill() {
    const apply = process.argv.includes("--apply");
    const cutoffArg = process.argv.find(a => a.startsWith("--cutoff="));
    const cutoffDate = cutoffArg ? cutoffArg.split("=")[1] : CUTOFF_DATE;

    if (!cutoffDate || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) {
        console.error("Set CUTOFF_DATE at the top of this script, or pass --cutoff=YYYY-MM-DD.");
        process.exit(1);
    }

    console.log(apply ? "Running in APPLY mode — changes will be written." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");
    console.log(`Cutoff date: users with joiningDate < ${cutoffDate} and no approved 16-Day sheet will be backfilled.`);

    const [users] = await executeQuery(
        `SELECT u.id, u.fullName, u.empId, u.joiningDate
         FROM users u
         WHERE u.joiningDate IS NOT NULL AND u.joiningDate <> '' AND u.joiningDate < ?
           AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
           AND NOT EXISTS (
             SELECT 1 FROM sixteen_day_monitorings sdm
             WHERE sdm.studentId = u.id AND sdm.approvedBy LIKE '%Approved By%'
           )`,
        [cutoffDate]
    );
    console.log(`Found ${users.length} legacy user(s) needing a backfilled approval.`);

    let processed = 0;
    for (const user of users) {
        console.log(`[user ${user.id}] ${user.fullName || "(no name)"} (${user.empId || "no empId"}) joiningDate=${user.joiningDate}`);
        if (!apply) {
            processed++;
            continue;
        }

        // Reuse the latest attempt if one already exists (e.g. a draft or rejected
        // sheet), otherwise create a fresh attempt 1 — never creates a duplicate
        // attempt on top of an existing one.
        const [existingRows] = await executeQuery(
            "SELECT TOP 1 id FROM sixteen_day_monitorings WHERE studentId = ? ORDER BY attemptNumber DESC, createdAt DESC",
            [user.id]
        );

        if (existingRows.length > 0) {
            await executeQuery(
                `UPDATE sixteen_day_monitorings
                 SET checkedBy = ?, verifiedBy = ?, approvedBy = ?, status = ?, updatedBy = ?, updatedAt = GETDATE()
                 WHERE id = ?`,
                [SYSTEM_SIGNATURE, SYSTEM_SIGNATURE, SYSTEM_SIGNATURE, "Submitted", "System (Legacy Backfill)", existingRows[0].id]
            );
        } else {
            await executeQuery(
                `INSERT INTO sixteen_day_monitorings
                 (studentId, attemptNumber, employeeName, employeeCode, checkedBy, verifiedBy, approvedBy, status, createdBy, updatedBy)
                 VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.id, user.fullName || "", user.empId || "", SYSTEM_SIGNATURE, SYSTEM_SIGNATURE, SYSTEM_SIGNATURE, "Submitted", "System (Legacy Backfill)", "System (Legacy Backfill)"]
            );
        }
        processed++;
    }

    console.log(`Done. ${apply ? "Backfilled" : "Would backfill"}: ${processed}.`);
    process.exit(0);
}

backfill().catch(err => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
