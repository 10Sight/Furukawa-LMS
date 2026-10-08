import { isEmploymentStatusActive } from "./userEligibility.js";

// Date-wise employment lifecycle shared by the Dashboard Daily Manpower Trend and the All Users
// page Present/Absent cards, so both count the same employees as "on the rolls" for a date.
//
// statusHistory is authoritative whenever it contains a valid joiningDate.
// Objects with the same joiningDate belong to the same employment period.
// The period ends on the effective leavingDate (exclusive).
// If no leavingDate exists for that joiningDate, the latest statusHistory object
// for that joiningDate must not be LEFT / ON_LEAVE (blank falls back to users.status).
// users.joiningDate / users.leavingDate are used only when statusHistory has no valid joiningDate.

// Dates are compared as local YYYYMMDD integers so no timezone shift can move a calendar day.
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

    const periodsByJoiningDate = new Map();

    history.forEach((item, index) => {
        const joiningDateKey = parseManpowerDateKey(item?.joiningDate);
        if (joiningDateKey === null) return;

        const leavingDateKey = parseManpowerDateKey(item?.leavingDate);
        const status = String(item?.status || '').trim().toUpperCase();
        const changedAtMs = item?.changedAt
            ? new Date(item.changedAt).getTime()
            : Number.NaN;

        const existing = periodsByJoiningDate.get(joiningDateKey) || {
            joiningDateKey,
            leavingDateKey: null,
            latestStatus: '',
            latestChangedAtMs: Number.NEGATIVE_INFINITY,
            latestIndex: -1,
        };

        if (
            leavingDateKey !== null
            && (
                existing.leavingDateKey === null
                || leavingDateKey > existing.leavingDateKey
            )
        ) {
            existing.leavingDateKey = leavingDateKey;
        }

        const comparableChangedAt = Number.isNaN(changedAtMs)
            ? Number.NEGATIVE_INFINITY
            : changedAtMs;

        if (
            comparableChangedAt > existing.latestChangedAtMs
            || (
                comparableChangedAt === existing.latestChangedAtMs
                && index > existing.latestIndex
            )
        ) {
            existing.latestStatus = status;
            existing.latestChangedAtMs = comparableChangedAt;
            existing.latestIndex = index;
        }

        periodsByJoiningDate.set(joiningDateKey, existing);
    });

    return Array.from(periodsByJoiningDate.values());
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

            // leavingDate is exclusive:
            // joining 01, leaving 10 => active only 01..09.
            if (period.leavingDateKey !== null) {
                return asOfDateKey < period.leavingDateKey;
            }

            // Open employment period is controlled by the latest statusHistory
            // status for this joiningDate; a history row with no status falls
            // back to users.status. Active = anything except LEFT / ON_LEAVE.
            return isEmploymentStatusActive(period.latestStatus || currentStatus);
        });
    }

    // Preserve legacy fallback only for users with no usable statusHistory joiningDate.
    const joinedByDate = (
        preparedUser.legacyJoiningDateKey === null
        || preparedUser.legacyJoiningDateKey <= asOfDateKey
    );

    if (isEmploymentStatusActive(currentStatus)) {
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
