import { executeQuery } from "../db/mssqlHelper.js";
import { getDesignationShutterExclusionCondition, isEmploymentStatusActive } from "../utils/userEligibility.js";

// Read-only diagnostic. Lists every user counted by the Students page
// "Present Operators" card but not by Dashboard Total Manpower for today
// (or the other way round), with the reason. No filters applied; nothing is written.
// Point the server's DB env config at the target database before running it.
//
// Usage:
//   node scripts/diagnoseManpowerMismatch.js

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

const explainDashboard = (row, asOf) => {
    const current = String(row.status || "").trim().toUpperCase();
    if (row.empId === null || String(row.empId).trim() === "") return { active: false, reason: "blank empId" };

    const periods = periodsOf(row);
    if (periods.length) {
        const active = periods.some((p) => {
            if (p.joining > asOf) return false;
            if (p.leaving !== null) return asOf < p.leaving;
            return isEmploymentStatusActive(p.status || current);
        });
        if (active) return { active: true, reason: "statusHistory period active" };
        if (periods.every((p) => p.joining > asOf)) return { active: false, reason: "statusHistory joiningDate is in the future" };
        if (periods.every((p) => p.leaving !== null)) return { active: false, reason: "every statusHistory period is closed" };
        return { active: false, reason: "open statusHistory period is LEFT / ON_LEAVE" };
    }

    const joining = dateKey(row.joiningDate);
    const leaving = dateKey(row.leavingDate);
    const joined = joining === null || joining <= asOf;
    if (isEmploymentStatusActive(current)) {
        return joined
            ? { active: true, reason: "users.status active" }
            : { active: false, reason: "users.joiningDate is in the future" };
    }
    if (current === "LEFT" && joined && leaving !== null && asOf < leaving) {
        return { active: true, reason: "LEFT with future leavingDate" };
    }
    return { active: false, reason: `users.status = ${current}` };
};

async function run() {
    try {
        const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const today = ist.getFullYear() * 10000 + (ist.getMonth() + 1) * 100 + ist.getDate();

        const [rows] = await executeQuery(`
            SELECT u.id, u.empId, u.fullName, u.status, u.joiningDate, u.leavingDate, u.statusHistory
            FROM users u
            WHERE ISNULL(u.isDeleted, 0) = 0
              AND ISNULL(u.isTemporary, 0) = 0
              AND ISNULL(u.isTrainer, 0) = 0
              AND (u.isEmployee = 1 OR u.role = 'CUSTOM')
              AND ${getDesignationShutterExclusionCondition("u")}
        `);

        let studentsPresent = 0;
        let dashboardTotal = 0;
        const mismatches = [];

        for (const row of rows) {
            // Students presentCount: raw column comparison, no trimming.
            const inStudents = row.status === null || (row.status !== "LEFT" && row.status !== "ON_LEAVE");
            const dashboard = explainDashboard(row, today);
            if (inStudents) studentsPresent += 1;
            if (dashboard.active) dashboardTotal += 1;
            if (inStudents !== dashboard.active) {
                mismatches.push({
                    id: row.id,
                    empId: row.empId,
                    name: row.fullName,
                    status: row.status,
                    joiningDate: row.joiningDate,
                    leavingDate: row.leavingDate,
                    countedBy: inStudents ? "Students only" : "Dashboard only",
                    reason: dashboard.reason,
                });
            }
        }

        console.log(`As of ${today}: Students Present Operators = ${studentsPresent}, Dashboard Total Manpower = ${dashboardTotal}`);
        console.log(`${mismatches.length} user(s) counted by only one of them:`);
        console.table(mismatches);
        process.exit(0);
    } catch (error) {
        console.error("Diagnosis failed:", error);
        process.exit(1);
    }
}

run();
