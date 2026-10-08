import { executeQuery } from "../db/mssqlHelper.js";
import { getDesignationShutterExclusionCondition, isEmploymentStatusActive } from "../utils/userEligibility.js";

// Read-only diagnostic. For one date, lists every user that the Dashboard "Daily Manpower
// Trend" and the All Users page Present/Absent cards count differently, with the reason (both
// now share manpowerLifecycle.js, so this should be empty), and flags users whose attendance
// row says they worked that day while statusHistory says they were not employed (history that
// has since been overwritten). No filters applied; nothing is written.
// Point the server's DB env config at the target database before running it.
//
// Usage:
//   node scripts/diagnoseAttendanceDateMismatch.js [YYYY-MM-DD] [--all]
// Defaults to yesterday (IST). --all prints every row instead of the first 60 per table.

const PRESENT_STATUSES = ["P", "PRESENT"];
const ROW_LIMIT = 60;

// Same parsing/period rules as parseManpowerDateKey / getValidStatusHistoryPeriods /
// isUserActiveForManpowerDate in dashboard.controller.js.
const dateKey = (value) => {
    if (value === null || value === undefined) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.getFullYear() * 10000 + (value.getMonth() + 1) * 100 + value.getDate();
    }
    const raw = String(value).trim();
    const upper = raw.toUpperCase();
    if (!raw || upper === "NULL" || upper === "UNDEFINED" || upper === "INVALID DATE") return null;
    let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
    m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.getFullYear() * 10000 + (parsed.getMonth() + 1) * 100 + parsed.getDate();
    }
    return null;
};

const periodsOf = (row) => {
    let history = row.statusHistory;
    if (typeof history === "string") {
        try { history = JSON.parse(history.trim() || "[]"); } catch (_) { return []; }
    }
    if (!Array.isArray(history)) return [];
    const byJoining = new Map();
    history.forEach((item, index) => {
        const joining = dateKey(item?.joiningDate);
        if (joining === null) return;
        const leaving = dateKey(item?.leavingDate);
        const status = String(item?.status || "").trim().toUpperCase();
        const changedAt = item?.changedAt ? new Date(item.changedAt).getTime() : Number.NaN;
        const period = byJoining.get(joining) || { joining, leaving: null, status: "", at: -Infinity, index: -1 };
        if (leaving !== null && (period.leaving === null || leaving > period.leaving)) period.leaving = leaving;
        const at = Number.isNaN(changedAt) ? -Infinity : changedAt;
        if (at > period.at || (at === period.at && index > period.index)) {
            period.status = status;
            period.at = at;
            period.index = index;
        }
        byJoining.set(joining, period);
    });
    return Array.from(byJoining.values());
};

const explainDashboardActive = (row, asOf) => {
    const current = String(row.status || "").trim().toUpperCase();
    const periods = periodsOf(row);
    if (periods.length) {
        const active = periods.some((p) => {
            if (p.joining > asOf) return false;
            if (p.leaving !== null) return asOf < p.leaving;
            return isEmploymentStatusActive(p.status || current);
        });
        if (active) return { active: true, reason: "statusHistory period active" };
        if (periods.every((p) => p.joining > asOf)) return { active: false, reason: "statusHistory joiningDate is after this date" };
        const started = periods.filter((p) => p.joining <= asOf);
        if (started.every((p) => p.leaving !== null)) return { active: false, reason: "statusHistory period already closed (leavingDate on/before this date)" };
        return { active: false, reason: "open statusHistory period is now LEFT / ON_LEAVE (no date recorded)" };
    }

    const joining = dateKey(row.joiningDate);
    const leaving = dateKey(row.leavingDate);
    const joined = joining === null || joining <= asOf;
    if (isEmploymentStatusActive(current)) {
        return joined
            ? { active: true, reason: "users.status active (no statusHistory)" }
            : { active: false, reason: "users.joiningDate is after this date (no statusHistory)" };
    }
    if (current === "LEFT" && joined && leaving !== null && asOf < leaving) {
        return { active: true, reason: "LEFT with later leavingDate (no statusHistory)" };
    }
    return { active: false, reason: `users.status = ${current || "blank"} (no statusHistory)` };
};

const explainDashboardPopulation = (row) => {
    if (row.empId === null || String(row.empId).trim() === "") return "blank empId";
    if (Number(row.isTemporary) === 1) return "isTemporary = 1 (not handed over yet)";
    if (Number(row.isTrainer) === 1) return "isTrainer = 1";
    if (Number(row.isEmployee) !== 1 && row.role !== "CUSTOM") return "not an employee / CUSTOM role";
    if (Number(row.notShuttered) !== 1) return "designation is shuttered";
    return null;
};

// All Users page stat cards (getAllUsers counts query in user.controller.js), no filters.
const explainUsersPagePopulation = (row) => {
    if (row.empId === null || String(row.empId).trim() === "") return "blank empId";
    if (Number(row.isTemporary) === 1) return "isTemporary = 1";
    if (Number(row.isTrainer) === 1) return "isTrainer = 1";
    if (Number(row.isEmployee) !== 1 && row.role !== "CUSTOM") return "not an employee / CUSTOM role";
    if (Number(row.notShuttered) !== 1) return "designation is shuttered";
    return null;
};

const printTable = (title, rows, showAll) => {
    console.log(`\n${title}: ${rows.length}`);
    if (!rows.length) return;
    console.table(showAll ? rows : rows.slice(0, ROW_LIMIT));
    if (!showAll && rows.length > ROW_LIMIT) console.log(`... ${rows.length - ROW_LIMIT} more (run with --all)`);
};

const countBy = (rows, key) => {
    const counts = {};
    rows.forEach((r) => { counts[r[key]] = (counts[r[key]] || 0) + 1; });
    return Object.entries(counts).map(([reason, users]) => ({ reason, users })).sort((a, b) => b.users - a.users);
};

async function run() {
    try {
        const args = process.argv.slice(2);
        const showAll = args.includes("--all");
        let dateStr = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
        if (!dateStr) {
            const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            ist.setDate(ist.getDate() - 1);
            dateStr = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
        }
        const asOf = dateKey(dateStr);

        const [users] = await executeQuery(`
            SELECT u.id, u.empId, u.fullName, u.status, u.joiningDate, u.leavingDate, u.updatedAt,
                   u.statusHistory, u.isTemporary, u.isTrainer, u.isEmployee, u.role,
                   CASE WHEN ${getDesignationShutterExclusionCondition("u")} THEN 1 ELSE 0 END AS notShuttered
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
        `);

        const [logs] = await executeQuery(`
            SELECT al.userId, al.payCode, al.status, al.shift,
                   CASE WHEN al.[date] = CONVERT(DATE, ?, 23) THEN 1 ELSE 0 END AS isExactDate
            FROM attendance_logs al
            WHERE al.[date] >= CONVERT(DATE, ?, 23)
              AND al.[date] < DATEADD(DAY, 1, CONVERT(DATE, ?, 23))
        `, [dateStr, dateStr, dateStr]);

        const logsByUser = new Map();
        let logsWithTimePart = 0;
        for (const log of logs) {
            if (Number(log.isExactDate) !== 1) logsWithTimePart += 1;
            const list = logsByUser.get(Number(log.userId)) || [];
            list.push(log);
            logsByUser.set(Number(log.userId), list);
        }

        const totals = { dashHeadcount: 0, dashPresent: 0, pagePresent: 0, pageAbsent: 0 };
        const presentMismatches = [];
        const headcountMismatches = [];
        const workedButInactive = [];
        const workedButTemporary = [];
        const payCodeMismatches = [];

        for (const row of users) {
            const userLogs = logsByUser.get(Number(row.id)) || [];
            const empIdKey = String(row.empId || "").trim().toUpperCase();
            const presentLogs = userLogs.filter((l) => PRESENT_STATUSES.includes(String(l.status || "").trim().toUpperCase()));
            const matchedPresentLog = presentLogs.find((l) => empIdKey && String(l.payCode || "").trim().toUpperCase() === empIdKey);

            // Dashboard Daily Manpower Trend
            const dashPopulationReason = explainDashboardPopulation(row);
            const dashActive = explainDashboardActive(row, asOf);
            const dashCounted = !dashPopulationReason && dashActive.active;
            const dashPresent = dashCounted && Boolean(matchedPresentLog);
            if (dashCounted) totals.dashHeadcount += 1;
            if (dashPresent) totals.dashPresent += 1;

            // All Users page cards: same lifecycle rule; attendance matched on the exact date.
            const pagePopulationReason = explainUsersPagePopulation(row);
            const pageLogPresent = presentLogs.some((l) => Number(l.isExactDate) === 1
                && empIdKey && String(l.payCode || "").trim().toUpperCase() === empIdKey);
            const pagePresent = !pagePopulationReason && dashActive.active && pageLogPresent;
            const pageAbsent = !pagePopulationReason && dashActive.active && !pageLogPresent;
            if (pagePresent) totals.pagePresent += 1;
            if (pageAbsent) totals.pageAbsent += 1;

            const base = { id: row.id, empId: row.empId, name: row.fullName, status: row.status };

            const pageCounted = pagePresent || pageAbsent;
            if (dashCounted !== pageCounted) {
                const reason = pageCounted
                    ? (dashPopulationReason || dashActive.reason)
                    : (pagePopulationReason || dashActive.reason);
                headcountMismatches.push({ ...base, joiningDate: row.joiningDate, countedBy: pageCounted ? "Users page only" : "Dashboard only", reason });
            }

            if (dashPresent !== pagePresent) {
                let reason;
                if (pagePresent) {
                    reason = dashPopulationReason
                        || (!dashActive.active ? dashActive.reason : null)
                        || "attendance payCode does not match users.empId";
                } else {
                    reason = pagePopulationReason || "Present row carries a time-of-day (skipped by the Users page date filter)";
                }
                presentMismatches.push({ ...base, countedBy: pagePresent ? "Users page only" : "Dashboard only", reason });
            }

            // Evidence that history was overwritten: a Present punch with the right payCode on a
            // date statusHistory now says the employee was not employed.
            if (matchedPresentLog && !dashPopulationReason && !dashActive.active) {
                workedButInactive.push({ ...base, joiningDate: row.joiningDate, leavingDate: row.leavingDate, reason: dashActive.reason });
            }
            // Will be added to every past date back to joining once isTemporary flips to 0.
            if (matchedPresentLog && Number(row.isTemporary) === 1) {
                workedButTemporary.push(base);
            }
            if (presentLogs.length && !matchedPresentLog) {
                payCodeMismatches.push({ ...base, payCode: presentLogs[0].payCode });
            }
        }

        console.log(`\n=== Attendance comparison for ${dateStr} (no filters) ===`);
        console.table([
            { page: "Dashboard trend", headcount: totals.dashHeadcount, present: totals.dashPresent, absent: Math.max(totals.dashHeadcount - totals.dashPresent, 0) },
            { page: "All Users cards", headcount: totals.pagePresent + totals.pageAbsent, present: totals.pagePresent, absent: totals.pageAbsent },
        ]);
        console.log(`attendance_logs rows on this date: ${logs.length} (${logsWithTimePart} carry a time-of-day and are skipped by the Users page date filter)`);
        console.log("Holidays are not applied here: the Dashboard shows Present = 0 on a declared holiday.");

        console.log("\nHeadcount (Present + Absent) counted by only one page, by reason:");
        console.table(countBy(headcountMismatches.map((r) => ({ ...r, reason: `${r.countedBy}: ${r.reason}` })), "reason"));
        printTable("Headcount counted by only one page", headcountMismatches, showAll);

        console.log("\nPresent counted by only one page, by reason:");
        console.table(countBy(presentMismatches, "reason"));
        printTable("Present counted by only one page", presentMismatches, showAll);

        console.log("\nPresent punch on this date, but statusHistory says not employed (overwritten history), by reason:");
        console.table(countBy(workedButInactive, "reason"));
        printTable("Present punch but not in Dashboard headcount", workedButInactive, showAll);

        printTable("Present punch, still isTemporary = 1 (joins every past date after handover)", workedButTemporary, showAll);
        printTable("Present rows whose payCode does not match users.empId", payCodeMismatches, showAll);

        process.exit(0);
    } catch (error) {
        console.error("Diagnosis failed:", error);
        process.exit(1);
    }
}

run();
