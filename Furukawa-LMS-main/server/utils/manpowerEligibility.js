// Shared manpower/headcount eligibility rules and date-aware statusHistory reconstruction.
// Extracted from dashboard.controller.js so every population that needs to match the MPS
// dashboard's Total Headcount / Daily Manpower Trend (Students page counts, reports, etc.)
// uses the exact same rules instead of a second, independently-maintained copy.

// Dynamic designation shutter rule used by every dashboard/report employee population.
// A shutter may be stored by designation name (for example Supervisor) or by its
// designation id (for example 1090), so both values are compared safely.
export const getDashboardDesignationShutterExclusionSql = (alias = "u") => `
    AND NOT EXISTS (
        SELECT 1
        FROM designation_shutters ds
        WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${alias}.designation))), '') IS NOT NULL
          AND (
                UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ds.designation))))
                    = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(510), ${alias}.designation))))
                OR UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ds.id))))
                    = UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(100), ${alias}.designation))))
              )
    )
`;

// Administrative/staff designations excluded from every dashboard manpower population.
export const getDesignationExclusionSql = (alias = "u") => `
    AND ISNULL(${alias}.designation, '') NOT IN (
        '1076',
        '1077',
        '1081',
        'DRIVER',
        'Supervisor',
        'Staff'
    )
`;

// PERFORMANCE FIX:
// SQL Server only fetches the eligible employee rows. statusHistory is parsed once
// in Node.js, which avoids correlated OPENJSON calls for every graph date and avoids
// SQL Server aggregate/subquery errors.
export const parseManpowerDateKey = (value) => {
    if (value === null || value === undefined) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return (
            value.getFullYear() * 10000
            + (value.getMonth() + 1) * 100
            + value.getDate()
        );
    }

    const raw = String(value).trim();
    const upper = raw.toUpperCase();
    if (!raw || upper === 'NULL' || upper === 'UNDEFINED' || upper === 'INVALID DATE') {
        return null;
    }

    let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return year * 10000 + month * 100 + day;
        }
    }

    // Match the SQL helper priority: DD/MM/YYYY and DD-MM-YYYY before US formats.
    match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        if (year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return year * 10000 + month * 100 + day;
        }
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return (
            parsed.getFullYear() * 10000
            + (parsed.getMonth() + 1) * 100
            + parsed.getDate()
        );
    }

    return null;
};

export const getValidStatusHistoryPeriods = (userRow = {}) => {
    let history = userRow.statusHistory;

    if (typeof history === 'string') {
        const trimmed = history.trim();
        if (!trimmed) return [];
        try {
            history = JSON.parse(trimmed);
        } catch (_) {
            return [];
        }
    }

    if (!Array.isArray(history)) return [];

    return history
        .map((item) => ({
            status: String(item?.status || '').trim().toUpperCase(),
            joiningDateKey: parseManpowerDateKey(item?.joiningDate),
            leavingDateKey: parseManpowerDateKey(item?.leavingDate),
        }))
        .filter((item) => item.joiningDateKey !== null);
};

export const prepareManpowerUser = (userRow = {}) => ({
    id: userRow.id,
    currentStatus: String(userRow.status || '').trim().toUpperCase(),
    historyPeriods: getValidStatusHistoryPeriods(userRow),
    legacyJoiningDateKey: parseManpowerDateKey(userRow.joiningDate),
    legacyLeavingDateKey: parseManpowerDateKey(userRow.leavingDate),
});

export const isUserActiveForManpowerDate = (preparedUser, asOfDateValue) => {
    const asOfDateKey = parseManpowerDateKey(asOfDateValue);
    if (asOfDateKey === null) return false;

    const currentStatus = preparedUser?.currentStatus || '';
    const historyPeriods = preparedUser?.historyPeriods || [];

    if (historyPeriods.length > 0) {
        return historyPeriods.some((period) => {
            if (period.joiningDateKey > asOfDateKey) return false;

            // Closed LEFT period reconstructs only dates actually worked.
            if (period.status === 'LEFT') {
                return (
                    period.leavingDateKey !== null
                    && asOfDateKey < period.leavingDateKey
                );
            }

            if (period.status !== 'PRESENT') return false;

            // Closed PRESENT period is historical and uses the same exclusive leaving date.
            if (period.leavingDateKey !== null) {
                return asOfDateKey < period.leavingDateKey;
            }

            // Open/current period is valid only when the current users.status is PRESENT.
            return currentStatus === 'PRESENT';
        });
    }

    // Legacy fallback for users without any valid statusHistory joiningDate.
    const joinedByDate = (
        preparedUser.legacyJoiningDateKey === null
        || preparedUser.legacyJoiningDateKey <= asOfDateKey
    );

    if (currentStatus === 'PRESENT') {
        return joinedByDate;
    }

    if (currentStatus === 'LEFT') {
        return (
            joinedByDate
            && preparedUser.legacyLeavingDateKey !== null
            && asOfDateKey < preparedUser.legacyLeavingDateKey
        );
    }

    return false;
};
