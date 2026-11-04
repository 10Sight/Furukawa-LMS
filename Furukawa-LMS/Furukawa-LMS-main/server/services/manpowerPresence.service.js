import { executeQuery } from "../db/mssqlHelper.js";
import {
    getEligibleUserSql,
    getDesignationShutterExclusionSql,
    getOperatorPopulationSql,
} from "../utils/userEligibility.js";
import {
    getRequirementApprovalSql,
    getRequirementSectionJoinSql,
    buildAttendanceUserIndex,
    isCountedPresentAttendance,
    normalizeAttendanceKey,
} from "../utils/manpowerPresence.js";

// Department-wise present / OT / requirement figures for the Daily HR Meeting report, built on
// the same rules as the Dashboard (MPS Portal) Daily Manpower Trend (utils/manpowerPresence.js).
//
// Deliberate differences from the trend chart:
// - no holiday exclusion (OT can be worked on a holiday),
// - shift is always ALL,
// - with departmentResolution "attendance", a present punch is assigned to the department written
//   on that day's attendance row (attendance_logs.department, mapped through
//   daily_manpower_attendance_dept_map), falling back to the user's current department.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const assertDate = (value, name) => {
    if (!DATE_PATTERN.test(String(value || ""))) {
        throw new Error(`${name} must be YYYY-MM-DD, got "${value}"`);
    }
};

/**
 * Approved requirement per department for one month.
 * @returns {{ byDepartment: Map<number, {fn01:number, fn02:number}>, unmapped: {fn01:number, fn02:number} }}
 */
export const getRequirementsByDepartment = async ({ year, monthNumber }) => {
    const [rows] = await executeQuery(
        `
            SELECT
                d.id AS departmentId,
                CAST(SUM(ISNULL(r.prodPlanFN01, 0)) AS BIGINT) AS required_fn01,
                CAST(SUM(ISNULL(r.prodPlanFN02, 0)) AS BIGINT) AS required_fn02
            FROM requirements r
            ${getRequirementSectionJoinSql("r", "s")}
            LEFT JOIN departments d ON d.id = s.departmentId
            WHERE r.[year] = ?
              AND r.monthNumber = ?
              ${getRequirementApprovalSql("r")}
            GROUP BY d.id
        `,
        [Number(year), Number(monthNumber)]
    );

    const byDepartment = new Map();
    const unmapped = { fn01: 0, fn02: 0 };

    for (const row of rows || []) {
        const fn01 = Number(row.required_fn01) || 0;
        const fn02 = Number(row.required_fn02) || 0;
        const departmentId = Number(row.departmentId);
        if (Number.isInteger(departmentId) && departmentId > 0) {
            byDepartment.set(departmentId, { fn01, fn02 });
        } else {
            unmapped.fn01 += fn01;
            unmapped.fn02 += fn02;
        }
    }

    return { byDepartment, unmapped };
};

/**
 * Pure aggregation step, separated from the queries so it can be unit tested.
 *
 * @param {object} input
 * @param {Array}  input.populationRows  eligible users (id, empId, departmentId, status, joiningDate, leavingDate, statusHistory)
 * @param {Array}  input.attendanceRows  attendance rows (fullDate, userId, payCode, status, otHrs, department)
 * @param {Map<string, number>} input.attendanceDeptMap  normalized attendance department text -> departmentId
 * @param {"attendance"|"current"} input.departmentResolution
 */
export const aggregatePresenceByDepartment = ({
    populationRows = [],
    attendanceRows = [],
    attendanceDeptMap = new Map(),
    departmentResolution = "attendance",
}) => {
    const userIndex = buildAttendanceUserIndex(populationRows, (row) => ({
        currentDepartmentId: Number(row?.departmentId) || null,
    }));

    // dateKey -> departmentId -> { presentUsers:Set, otHrs, fallbackUsers:Set }
    const byDate = new Map();
    // dateKey -> Map(attendance department text -> count) of unmapped spellings
    const unmappedByDate = new Map();
    // dateKey -> users counted present with no department at all
    const noDepartmentByDate = new Map();

    const bucketFor = (dateKey, departmentId) => {
        if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
        const perDept = byDate.get(dateKey);
        if (!perDept.has(departmentId)) {
            perDept.set(departmentId, { presentUsers: new Set(), otHrs: 0, fallbackUsers: new Set() });
        }
        return perDept.get(departmentId);
    };

    for (const row of attendanceRows || []) {
        const fullDate = String(row?.fullDate || "").slice(0, 10);
        const userId = Number(row?.userId);
        if (!fullDate || !Number.isInteger(userId) || userId <= 0) continue;

        const userInfo = userIndex.get(userId);
        if (!isCountedPresentAttendance(row, userInfo, fullDate)) continue;

        let departmentId = null;
        let usedFallback = false;

        if (departmentResolution === "attendance") {
            const attendanceDeptKey = normalizeAttendanceKey(row?.department);
            departmentId = attendanceDeptKey ? attendanceDeptMap.get(attendanceDeptKey) || null : null;
            if (!departmentId) {
                usedFallback = true;
                departmentId = userInfo.currentDepartmentId;
                if (attendanceDeptKey) {
                    if (!unmappedByDate.has(fullDate)) unmappedByDate.set(fullDate, new Map());
                    const counts = unmappedByDate.get(fullDate);
                    counts.set(attendanceDeptKey, (counts.get(attendanceDeptKey) || 0) + 1);
                }
            }
        } else {
            departmentId = userInfo.currentDepartmentId;
        }

        if (!departmentId) {
            if (!noDepartmentByDate.has(fullDate)) noDepartmentByDate.set(fullDate, new Set());
            noDepartmentByDate.get(fullDate).add(userId);
            continue;
        }

        const bucket = bucketFor(fullDate, departmentId);
        if (bucket.presentUsers.has(userId)) continue; // one row per user per day is expected; never double count
        bucket.presentUsers.add(userId);
        bucket.otHrs += Number(row?.otHrs) || 0;
        if (usedFallback) bucket.fallbackUsers.add(userId);
    }

    const result = new Map();
    for (const [dateKey, perDept] of byDate) {
        const out = new Map();
        for (const [departmentId, bucket] of perDept) {
            out.set(departmentId, {
                present: bucket.presentUsers.size,
                otHrs: Math.round(bucket.otHrs * 100) / 100,
                fallbackCount: bucket.fallbackUsers.size,
            });
        }
        result.set(dateKey, out);
    }

    return {
        byDate: result,
        unmappedAttendanceDepartmentsByDate: new Map(
            Array.from(unmappedByDate, ([dateKey, counts]) => [
                dateKey,
                Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
            ])
        ),
        noDepartmentPresentByDate: new Map(Array.from(noDepartmentByDate, ([d, users]) => [d, users.size])),
    };
};

/** Normalized attendance department text -> departmentId, from daily_manpower_attendance_dept_map. */
export const loadAttendanceDeptMap = async () => {
    const [rows] = await executeQuery(
        "SELECT attendanceDepartment, departmentId FROM daily_manpower_attendance_dept_map"
    );
    return new Map(
        (rows || [])
            .map((r) => [normalizeAttendanceKey(r.attendanceDepartment), Number(r.departmentId)])
            .filter(([key, id]) => key && id > 0)
    );
};

/**
 * Present headcount and OT hours per date per department, for startDate..endDate inclusive.
 * @param {{ startDate: string, endDate: string, departmentResolution?: "attendance"|"current", attendanceDeptMap?: Map }} options
 */
export const getDailyPresenceByDepartment = async ({
    startDate,
    endDate,
    departmentResolution = "attendance",
    attendanceDeptMap = null,
}) => {
    assertDate(startDate, "startDate");
    assertDate(endDate, "endDate");

    const [populationRows] = await executeQuery(
        `
            SELECT u.id, u.empId, u.departmentId, u.status, u.joiningDate, u.leavingDate, u.statusHistory
            FROM users u
            WHERE 1=1
              ${getOperatorPopulationSql("u")}
        `,
        [],
        { longRunning: true }
    );

    const [attendanceRows] = await executeQuery(
        `
            SELECT
                CONVERT(VARCHAR(10), CONVERT(DATE, al.[date]), 23) AS fullDate,
                al.userId,
                al.payCode,
                al.status,
                al.otHrs,
                al.department
            FROM attendance_logs al
            INNER JOIN users u ON al.userId = u.id
            WHERE al.[date] >= CONVERT(DATE, ?, 23)
              AND al.[date] < DATEADD(DAY, 1, CONVERT(DATE, ?, 23))
              ${getEligibleUserSql("u")}
              ${getDesignationShutterExclusionSql("u")}
        `,
        [startDate, endDate],
        { longRunning: true }
    );

    const deptMap = departmentResolution === "attendance"
        ? (attendanceDeptMap || await loadAttendanceDeptMap())
        : new Map();

    return aggregatePresenceByDepartment({
        populationRows,
        attendanceRows,
        attendanceDeptMap: deptMap,
        departmentResolution,
    });
};

/** Dates in the range that have any attendance uploaded (mapped or unmapped rows). */
export const getDatesWithAttendance = async ({ startDate, endDate }) => {
    assertDate(startDate, "startDate");
    assertDate(endDate, "endDate");
    const [rows] = await executeQuery(
        `
            SELECT DISTINCT CONVERT(VARCHAR(10), CONVERT(DATE, [date]), 23) AS d
            FROM attendance_logs
            WHERE [date] >= CONVERT(DATE, ?, 23) AND [date] < DATEADD(DAY, 1, CONVERT(DATE, ?, 23))
        `,
        [startDate, endDate]
    );
    const dates = new Set((rows || []).map((r) => String(r.d).slice(0, 10)));
    try {
        const [unmapped] = await executeQuery(
            `
                SELECT DISTINCT CONVERT(VARCHAR(10), CONVERT(DATE, [date]), 23) AS d
                FROM attendance_unmapped_logs
                WHERE [date] >= CONVERT(DATE, ?, 23) AND [date] < DATEADD(DAY, 1, CONVERT(DATE, ?, 23))
            `,
            [startDate, endDate]
        );
        (unmapped || []).forEach((r) => dates.add(String(r.d).slice(0, 10)));
    } catch {
        // attendance_unmapped_logs may not exist on older databases.
    }
    return dates;
};

/** Present punches in attendance_unmapped_logs per date (no user, so no department). */
export const getUnmappedPresentByDate = async ({ startDate, endDate }) => {
    assertDate(startDate, "startDate");
    assertDate(endDate, "endDate");
    try {
        const [rows] = await executeQuery(
            `
                SELECT
                    CONVERT(VARCHAR(10), CONVERT(DATE, unm.[date]), 23) AS fullDate,
                    COUNT(DISTINCT unm.payCode) AS unmappedCount
                FROM attendance_unmapped_logs unm
                WHERE UPPER(LTRIM(RTRIM(unm.status))) IN ('P','PRESENT')
                  AND unm.[date] >= CONVERT(DATE, ?, 23)
                  AND unm.[date] < DATEADD(DAY, 1, CONVERT(DATE, ?, 23))
                GROUP BY CONVERT(DATE, unm.[date])
            `,
            [startDate, endDate]
        );
        return new Map((rows || []).map((r) => [String(r.fullDate).slice(0, 10), Number(r.unmappedCount) || 0]));
    } catch {
        return new Map();
    }
};

/** Active dashboard holiday dates (YYYY-MM-DD) in the range. */
export const getHolidayDates = async ({ startDate, endDate }) => {
    try {
        const [rows] = await executeQuery(
            `
                SELECT CONVERT(VARCHAR(10), holidayDate, 23) AS holidayDate
                FROM dashboard_holidays
                WHERE ISNULL(isActive, 1) = 1
                  AND holidayDate >= CONVERT(DATE, ?, 23)
                  AND holidayDate <= CONVERT(DATE, ?, 23)
            `,
            [startDate, endDate]
        );
        return new Set((rows || []).map((r) => String(r.holidayDate).slice(0, 10)));
    } catch {
        return new Set();
    }
};
