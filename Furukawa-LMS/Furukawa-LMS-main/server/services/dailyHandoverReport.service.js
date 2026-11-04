import { executeQuery } from "../db/mssqlHelper.js";
import { groupReportDepartments } from "./dailyHrMeetingReport.js";

// Daily HR Meeting — Daily Handover Report tab: Handover Actual (by department) and
// Hiring Actual (by Dojo shift), one column per calendar day.
//
// Both tables are read live; their sources do not change after the fact:
// - Handover Actual counts approved handover-sheet entries (interviewStatus = 'APPROVE', as in
//   adminHome getDojoHandoverComparison) under the department the person was handed over to:
//   the entry's departmentId, else the sheet's. The person's current department is not used, so
//   a later transfer never moves an old handover to another row.
// - Hiring Actual counts Dojo recruits (expectedHandover set or still temporary, as in
//   adminHome getDojoHiringTrend) on their joining date, else the date they were added.
//   users.joiningDate is NVARCHAR, so it is parsed explicitly instead of compared as text.

export const HIRING_SHIFTS = ["A", "B", "C", "G"];
export const UNASSIGNED_SHIFT = "UNASSIGNED";

const HANDOVER_DEPT_SQL = "COALESCE(TRY_CAST(JSON_VALUE(entry.value, '$.departmentId') AS INT), hs.departmentId)";

const HIRE_DATE_SQL = `COALESCE(
    TRY_CONVERT(date, LEFT(LTRIM(u.joiningDate), 10), 23),
    TRY_CONVERT(date, u.joiningDate),
    CAST(u.createdAt AS DATE)
)`;

const toIsoDate = (value) => {
    if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
    }
    return String(value || "").slice(0, 10);
};

/** One row per (date, person, department) approved in [startDate, endDate]. */
export const getHandoverRows = async (startDate, endDate) => {
    const [rows] = await executeQuery(`
        SELECT DISTINCT
            CONVERT(VARCHAR(10), hs.date, 23) AS handoverDate,
            u.id AS userId,
            ${HANDOVER_DEPT_SQL} AS departmentId
        FROM handover_sheets hs
        CROSS APPLY OPENJSON(hs.entries) AS entry
        INNER JOIN users u ON u.id = TRY_CAST(JSON_VALUE(entry.value, '$.studentId') AS INT)
        WHERE hs.date >= ? AND hs.date <= ?
          AND JSON_VALUE(entry.value, '$.interviewStatus') = 'APPROVE'
          AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
    `, [startDate, endDate]);
    return (rows || []).map((r) => ({
        date: toIsoDate(r.handoverDate),
        userId: Number(r.userId),
        departmentId: r.departmentId === null || r.departmentId === undefined ? null : Number(r.departmentId),
    }));
};

/** Dojo recruits per (hire date, raw shift) in [startDate, endDate]. */
export const getHiringRows = async (startDate, endDate) => {
    const [rows] = await executeQuery(`
        SELECT hireDate, shiftRaw, COUNT(*) AS hires
        FROM (
            SELECT
                CONVERT(VARCHAR(10), ${HIRE_DATE_SQL}, 23) AS hireDate,
                UPPER(LTRIM(RTRIM(ISNULL(u.dojoShift, '')))) AS shiftRaw
            FROM users u
            WHERE (u.expectedHandover IS NOT NULL OR u.isTemporary = 1)
              AND (u.isDeleted = 0 OR u.isDeleted IS NULL)
        ) h
        WHERE h.hireDate >= ? AND h.hireDate <= ?
        GROUP BY hireDate, shiftRaw
    `, [startDate, endDate]);
    return (rows || []).map((r) => ({
        date: toIsoDate(r.hireDate),
        shiftRaw: r.shiftRaw,
        hires: Number(r.hires) || 0,
    }));
};

/** "A", "a-shift", "Shift B", "general" -> A/B/C/G; anything else -> UNASSIGNED. */
export const normalizeShift = (raw) => {
    const s = String(raw || "").trim().toUpperCase().replace(/[\s_-]+/g, " ");
    if (!s) return UNASSIGNED_SHIFT;
    if (s === "GENERAL" || s === "GEN") return "G";
    const m = s.match(/^(?:SHIFT )?([ABCG])(?: SHIFT)?$/);
    return m ? m[1] : UNASSIGNED_SHIFT;
};

const zeroValues = (dates) => Object.fromEntries(dates.map((d) => [d, 0]));

const sumValues = (rows, dates) => Object.fromEntries(
    dates.map((d) => [d, rows.reduce((s, r) => s + (r.values[d] || 0), 0)])
);

/**
 * Builds both matrices. Pure: no DB access.
 * Totals are plain sums (the Excel export writes them as SUM formulas):
 * group Total = SUM(rows of the group); Grand Total = SUM(group Totals).
 * Handovers to a hidden, deleted or missing department are not in any row; they are reported in
 * diagnostics so the Grand Total can be reconciled with the SDP chart.
 */
export const buildHandoverReport = ({ year, monthNumber, dates, departments, handoverRows, hiringRows }) => {
    const dateSet = new Set(dates);

    // One count per person per day, even if they appear on two sheets that day.
    const perDept = new Map(); // departmentId -> date -> count
    const seen = new Set();
    for (const r of [...handoverRows].sort((a, b) => (a.departmentId ?? Infinity) - (b.departmentId ?? Infinity))) {
        if (!dateSet.has(r.date)) continue;
        const key = `${r.date}|${r.userId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const deptKey = r.departmentId ?? "none";
        if (!perDept.has(deptKey)) perDept.set(deptKey, new Map());
        const byDate = perDept.get(deptKey);
        byDate.set(r.date, (byDate.get(r.date) || 0) + 1);
    }

    const deptValues = (departmentId) => {
        const byDate = perDept.get(departmentId);
        return Object.fromEntries(dates.map((d) => [d, byDate?.get(d) || 0]));
    };

    const shownIds = new Set();
    const groups = groupReportDepartments(departments).map((g) => {
        const rows = g.own.map((dep) => {
            shownIds.add(dep.departmentId);
            return {
                key: `dept-${dep.departmentId}`,
                kind: "department",
                label: dep.displayName || dep.departmentName,
                values: deptValues(dep.departmentId),
            };
        });
        if (g.merged.length) {
            g.merged.forEach((dep) => shownIds.add(dep.departmentId));
            const mergedRows = g.merged.map((dep) => ({ values: deptValues(dep.departmentId) }));
            rows.push({
                key: `other-${g.name}`,
                kind: "other",
                label: "Other",
                mergedLabels: g.merged.map((dep) => dep.displayName || dep.departmentName),
                values: sumValues(mergedRows, dates),
            });
        }
        return {
            name: g.name,
            rows,
            total: { key: `total-${g.name}`, kind: "groupTotal", label: "Total", values: sumValues(rows, dates) },
        };
    });

    const handoverGrandTotal = {
        key: "handover-grand-total",
        kind: "grandTotal",
        label: "Grand Total",
        values: sumValues(groups.map((g) => g.total), dates),
    };

    const hiddenIds = new Set(departments.filter((d) => d.isHidden).map((d) => d.departmentId));
    let hiddenDepartmentHandovers = 0;
    let unassignedHandovers = 0;
    for (const [deptKey, byDate] of perDept) {
        if (shownIds.has(deptKey)) continue;
        const count = [...byDate.values()].reduce((s, n) => s + n, 0);
        if (hiddenIds.has(deptKey)) hiddenDepartmentHandovers += count;
        else unassignedHandovers += count;
    }

    // Hiring
    const shiftValues = new Map([...HIRING_SHIFTS, UNASSIGNED_SHIFT].map((s) => [s, zeroValues(dates)]));
    for (const r of hiringRows) {
        if (!dateSet.has(r.date)) continue;
        const values = shiftValues.get(normalizeShift(r.shiftRaw));
        values[r.date] += r.hires;
    }
    const unassignedShiftTotal = Object.values(shiftValues.get(UNASSIGNED_SHIFT)).reduce((s, n) => s + n, 0);
    const hiringRowsOut = HIRING_SHIFTS.map((s) => ({
        key: `shift-${s}`, kind: "shift", shiftKey: s, label: `${s}-Shift`, values: shiftValues.get(s),
    }));
    // Shown only when someone has no A/B/C/G shift, so the Grand Total stays a plain SUM of the rows.
    if (unassignedShiftTotal > 0) {
        hiringRowsOut.push({
            key: "shift-unassigned", kind: "shift", shiftKey: UNASSIGNED_SHIFT, label: "No shift", values: shiftValues.get(UNASSIGNED_SHIFT),
        });
    }

    return {
        year,
        monthNumber,
        dates: dates.map((date) => ({ date, day: Number(date.slice(8, 10)) })),
        handover: { groups, grandTotal: handoverGrandTotal },
        hiring: {
            rows: hiringRowsOut,
            grandTotal: { key: "hiring-grand-total", kind: "grandTotal", label: "Grand Total", values: sumValues(hiringRowsOut, dates) },
        },
        diagnostics: { hiddenDepartmentHandovers, unassignedHandovers, unassignedShiftTotal },
    };
};
