import { executeQuery } from "../db/mssqlHelper.js";
import { parseManpowerDateKey } from "../utils/manpowerLifecycle.js";

// Corrects the rejoin date of an employee who has already been moved from LEFT back to an
// active status, when the rejoin was recorded with the wrong date (today's date, or the
// original joining date). Only the joiningDate of the latest statusHistory entry is changed;
// users.joiningDate (original hire date) and every earlier history entry are left untouched.
// Without --apply it only prints what it would do.
// Point the server's DB env config at the target database before running it.
//
// Usage:
//   node scripts/setRejoinDate.js <empId> <YYYY-MM-DD>            (dry run)
//   node scripts/setRejoinDate.js <empId> <YYYY-MM-DD> --apply

const fail = (message) => {
    console.error(`Not changed: ${message}`);
    process.exit(1);
};

async function run() {
    try {
        const [empId, rejoinDate, flag] = process.argv.slice(2);
        const apply = flag === "--apply";

        if (!empId || !/^\d{4}-\d{2}-\d{2}$/.test(rejoinDate || "")) {
            console.error("Usage: node scripts/setRejoinDate.js <empId> <YYYY-MM-DD> [--apply]");
            process.exit(1);
        }

        const [rows] = await executeQuery(`
            SELECT u.id, u.empId, u.fullName, u.status, u.joiningDate, u.leavingDate, u.statusHistory
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), u.empId)))) = UPPER(LTRIM(RTRIM(?)))
        `, [empId]);

        if (!rows?.length) fail(`no user with empId ${empId}`);
        if (rows.length > 1) fail(`${rows.length} users share empId ${empId}`);

        const user = rows[0];
        let history = [];
        try {
            history = JSON.parse(user.statusHistory || "[]");
        } catch (_) {
            fail("statusHistory is not valid JSON");
        }
        if (!Array.isArray(history)) fail("statusHistory is not a list");

        console.log(`${user.empId} ${user.fullName} (id ${user.id}) - status ${user.status}, joiningDate ${user.joiningDate}`);
        console.log("Current statusHistory:");
        console.table(history.map(({ status, joiningDate, leavingDate, changedAt }) => ({ status, joiningDate, leavingDate, changedAt })));

        if (String(user.status || "").trim().toUpperCase() === "LEFT") {
            fail("user is still LEFT - change the status to Present in the app first");
        }
        if (history.length < 2) fail("statusHistory has no rejoin entry to correct");

        const last = history[history.length - 1];
        if (last.leavingDate) fail("latest statusHistory entry already has a leavingDate");

        const rejoinKey = parseManpowerDateKey(rejoinDate);
        const earlier = history.slice(0, -1);
        const earlierLeavingKeys = earlier
            .map((item) => parseManpowerDateKey(item?.leavingDate))
            .filter((key) => key !== null);

        if (!earlierLeavingKeys.length) fail("no earlier leavingDate found in statusHistory");
        if (rejoinKey < Math.max(...earlierLeavingKeys)) {
            fail(`rejoin date ${rejoinDate} is before the last leaving date`);
        }
        if (earlier.some((item) => parseManpowerDateKey(item?.joiningDate) === rejoinKey)) {
            fail(`an earlier employment period already starts on ${rejoinDate}`);
        }
        if (rejoinKey > parseManpowerDateKey(new Date())) fail("rejoin date is in the future");

        if (parseManpowerDateKey(last.joiningDate) === rejoinKey) {
            console.log(`Rejoin date is already ${rejoinDate}. Nothing to do.`);
            process.exit(0);
        }

        console.log(`Rejoin date: ${last.joiningDate} -> ${rejoinDate}`);
        history[history.length - 1] = {
            ...last,
            joiningDate: rejoinDate,
            changedByName: "setRejoinDate script",
            changedAt: new Date().toISOString(),
        };

        if (!apply) {
            console.log("Dry run only. Re-run with --apply to save.");
            process.exit(0);
        }

        await executeQuery(
            "UPDATE users SET statusHistory = ?, updatedAt = GETDATE() WHERE id = ?",
            [JSON.stringify(history), user.id]
        );
        console.log("Saved.");
        process.exit(0);
    } catch (error) {
        console.error("Failed:", error);
        process.exit(1);
    }
}

run();
