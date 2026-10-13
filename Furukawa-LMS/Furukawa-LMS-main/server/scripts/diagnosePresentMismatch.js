import { executeQuery } from "../db/mssqlHelper.js";
import { getEligibleUserSql } from "../utils/userEligibility.js";
import {
    prepareManpowerUser,
    isUserActiveForManpowerDate,
    parseManpowerDateKey,
} from "../utils/manpowerLifecycle.js";

// Read-only diagnostic. Lists every employee who appears as Present in the Attendance page
// Excel for a date but is not counted as Present by the Dashboard Daily Manpower Trend /
// All Users Present card, with the reason. No filters applied; nothing is written.
// Point the server's DB env config at the target database before running it.
//
// Usage:
//   node scripts/diagnosePresentMismatch.js 2026-10-12

const clean = (value) => String(value ?? "").trim().toUpperCase();

// Same checks, in the same order of concern, as the Present rule in
// dashboard.controller.js (operator population + payCode = empId + lifecycle active).
const explainExclusion = (user, payCodes, targetDate) => {
    const reasons = [];

    if (user.isTrainer) reasons.push("isTrainer = 1");
    if (!user.isEmployee && clean(user.role) !== "CUSTOM") {
        reasons.push(`not an operator (isEmployee = 0, role = ${user.role})`);
    }

    const empIdKey = clean(user.empId);
    if (!payCodes.some((payCode) => payCode && payCode === empIdKey)) {
        reasons.push(`payCode ${payCodes.map((p) => `"${p}"`).join("/")} != empId "${empIdKey}"`);
    }

    const prepared = prepareManpowerUser(user);
    if (!isUserActiveForManpowerDate(prepared, targetDate)) {
        const targetKey = parseManpowerDateKey(targetDate);
        const leavingKeys = prepared.historyPeriods.length
            ? prepared.historyPeriods.map((p) => p.leavingDateKey)
            : [prepared.legacyLeavingDateKey];
        reasons.push(
            leavingKeys.includes(targetKey)
                ? "leavingDate is this date (leavingDate is exclusive)"
                : `not on the rolls for this date (status = ${user.status})`
        );
    }

    return reasons;
};

async function run() {
    try {
        const targetDate = process.argv[2];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || "")) {
            console.error("Usage: node scripts/diagnosePresentMismatch.js YYYY-MM-DD");
            process.exit(1);
        }

        // Same population as the Attendance page Excel (downloadAttendance, dashboardOnly).
        const [rows] = await executeQuery(`
            SELECT u.id, u.empId, u.fullName, u.status, u.joiningDate, u.leavingDate,
                   u.statusHistory, u.isTrainer, u.isEmployee, u.role, al.payCode
            FROM attendance_logs al
            INNER JOIN users u ON al.userId = u.id
            WHERE CONVERT(DATE, al.[date]) = CONVERT(DATE, ?, 23)
              AND UPPER(LTRIM(RTRIM(CAST(al.status AS NVARCHAR(100))))) IN ('P', 'PRESENT')
              ${getEligibleUserSql("u")}
        `, [targetDate]);

        const byUser = new Map();
        for (const row of rows || []) {
            const entry = byUser.get(row.id) || { user: row, payCodes: [] };
            const payCode = clean(row.payCode);
            if (!entry.payCodes.includes(payCode)) entry.payCodes.push(payCode);
            byUser.set(row.id, entry);
        }

        const excluded = [];
        for (const { user, payCodes } of byUser.values()) {
            const reasons = explainExclusion(user, payCodes, targetDate);
            if (!reasons.length) continue;
            excluded.push({
                id: user.id,
                empId: user.empId,
                name: user.fullName,
                payCode: payCodes.join("/"),
                status: user.status,
                joiningDate: user.joiningDate,
                leavingDate: user.leavingDate,
                reason: reasons.join("; "),
            });
        }

        console.log(`${targetDate}: Excel Present = ${byUser.size}, Dashboard Present = ${byUser.size - excluded.length}`);
        console.log(`${excluded.length} employee(s) in the Excel but not counted on the Dashboard:`);
        console.table(excluded);
        process.exit(0);
    } catch (error) {
        console.error("Diagnosis failed:", error);
        process.exit(1);
    }
}

run();
