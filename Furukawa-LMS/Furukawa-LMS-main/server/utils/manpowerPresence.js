import { prepareManpowerUser, isUserActiveForManpowerDate } from "./manpowerLifecycle.js";

// Counting rules shared by the Dashboard (MPS Portal) Daily Manpower Trend and the Daily HR
// Meeting report, so both count the same people as present and the same requirement rows as
// approved. Change a rule here and both pages follow.

/**
 * Approved-requirement filter for a `requirements` row alias (leading AND).
 * Active + approved, or system-approved regardless of is_active.
 */
export const getRequirementApprovalSql = (alias = "r") => `
        AND (
            (
                ISNULL(${alias}.is_active, 0) = 1
                AND LOWER(LTRIM(RTRIM(ISNULL(${alias}.approvalStatus, 'approved')))) IN (
                    'approved',
                    'system_approved',
                    'system approved',
                    'system-approved',
                    'systemapproved'
                )
            )
            OR LOWER(LTRIM(RTRIM(ISNULL(${alias}.approvalStatus, '')))) IN (
                'system_approved',
                'system approved',
                'system-approved',
                'systemapproved'
            )
        )
    `;

/**
 * Join from `requirements` (alias r) to `sections` (alias s): requirements carry no departmentId,
 * only sectionCode / sectionName, so departments are reached through the section.
 */
export const getRequirementSectionJoinSql = (reqAlias = "r", sectionAlias = "s") => `
                LEFT JOIN sections ${sectionAlias}
                    ON (
                        UPPER(LTRIM(RTRIM(CAST(${reqAlias}.sectionCode AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(${sectionAlias}.uniCode AS NVARCHAR(510)))))
                        OR UPPER(LTRIM(RTRIM(CAST(${reqAlias}.sectionName AS NVARCHAR(510))))) = UPPER(LTRIM(RTRIM(CAST(${sectionAlias}.name AS NVARCHAR(510)))))
                    )
                    AND ISNULL(${sectionAlias}.isActive, 1) = 1`;

export const normalizeAttendanceKey = (value) => String(value || "").trim().toUpperCase();

/**
 * Indexes the eligible manpower population (rows with id, empId, status, joiningDate,
 * leavingDate, statusHistory) by user id, preparing each user's lifecycle once.
 * `extra(row)` may add fields (e.g. departmentId) to each entry.
 */
export const buildAttendanceUserIndex = (userRows = [], extra = null) => new Map(
    (userRows || [])
        .map((userRow) => {
            const userId = Number(userRow?.id);
            if (!Number.isInteger(userId) || userId <= 0) return null;

            return [
                userId,
                {
                    empIdKey: normalizeAttendanceKey(userRow?.empId),
                    prepared: prepareManpowerUser(userRow),
                    ...(extra ? extra(userRow) : {}),
                },
            ];
        })
        .filter(Boolean)
);

/**
 * The present rule: status P / PRESENT, the punch's payCode equals the user's empId, the user is in
 * the eligible population (userInfo found), and their employment lifecycle is active on fullDate.
 */
export const isCountedPresentAttendance = (row, userInfo, fullDate) => {
    const attendanceStatus = normalizeAttendanceKey(row?.status);
    if (!["P", "PRESENT"].includes(attendanceStatus)) return false;
    if (!userInfo) return false;

    const payCodeKey = normalizeAttendanceKey(row?.payCode);
    if (!payCodeKey || payCodeKey !== userInfo.empIdKey) return false;

    return isUserActiveForManpowerDate(userInfo.prepared, fullDate);
};

// Day 1-15 is measured against the FN01 (Indent 01) requirement, day 16 onward against FN02.
export const getRequiredForDay = (dayOfMonth, fn01, fn02) =>
    (Number(dayOfMonth) <= 15 ? Number(fn01) || 0 : Number(fn02) || 0);

export const otHoursToMandays = (otHrs) => Math.round((Number(otHrs) || 0) / 8);
