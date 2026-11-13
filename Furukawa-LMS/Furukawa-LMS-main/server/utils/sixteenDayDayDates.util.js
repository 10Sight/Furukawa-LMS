// Day-column header date rules for the 16-Day Monitoring sheet.
//
// 1. A day's values can only be saved once that day's header date (attendance_date_N)
//    is set. Only values the user typed count; computed cells (category totals,
//    averages, achievement %, evaluation, summary) are ignored.
// 2. Day dates may be in the future, but never before the day after the handover date,
//    and they run strictly forward from Day-1 to Day-16.
// 3. Values can't be entered for a day whose date is still in the future (IST).
//
// Records saved before these rules existed keep saving: only values and dates changed
// in this save are checked (plus every date when a saved handover date is moved).
//
// Keep in sync with admin/src/utils/sixteenDayDayDates.js.

// Typed inputs, anchored at the end of the key so row ids can't cause false matches:
//   Days 1-3:  <row>_d1 | <row>_d1_<i> | <row>_d1_<target|actual|score>_<i>
//   Days 4-16: <row>_day_4 | <row>_day_4_<target|actual|score>
//   Attendance: attendance_actual_<N>
const DAY_INPUT_PATTERNS = [
    /_d([1-3])(?:_(?:target|actual|score))?_\d$/,
    /_d([1-3])$/,
    /_day_(\d{1,2})(?:_(?:target|actual|score))?$/,
    /^attendance_actual_(\d{1,2})$/,
];

const norm = (v) => (v === undefined || v === null ? "" : String(v).trim());
const dateKey = (day) => `attendance_date_${day}`;

/** Day number (1-16) a typed grid input belongs to, or null for any other key. */
export function dayOfInputKey(key) {
    if (typeof key !== "string" || key.startsWith("cat") || key.startsWith("summary_")) return null;
    for (const pattern of DAY_INPUT_PATTERNS) {
        const m = key.match(pattern);
        if (m) {
            const day = Number(m[1]);
            return day >= 1 && day <= 16 ? day : null;
        }
    }
    return null;
}

// Days that have typed values, and the subset whose values changed since `prev`.
function typedDays(next, prev) {
    const filled = new Set();
    const changed = new Set();
    for (const key of Object.keys(next)) {
        const day = dayOfInputKey(key);
        if (!day || norm(next[key]) === "") continue;
        filled.add(day);
        if (norm(next[key]) !== norm(prev[key])) changed.add(day);
    }
    return { filled, changed };
}

/**
 * Days (sorted) that have typed values but no header date and would be saved that way:
 * one of the day's values changed in this save, or its saved date was cleared.
 * `previousGridData` is the saved record's grid ({} for a new attempt).
 */
export function findDaysMissingDate(gridData, previousGridData = {}) {
    const next = gridData || {};
    const prev = previousGridData || {};
    const { filled, changed } = typedDays(next, prev);

    const missing = [];
    for (const day of filled) {
        if (norm(next[dateKey(day)]) !== "") continue;
        const dateCleared = norm(prev[dateKey(day)]) !== "";
        if (changed.has(day) || dateCleared) missing.push(day);
    }
    return missing.sort((a, b) => a - b);
}

export function missingDateMessage(days) {
    return `Please select the date on the column header for ${days.map((d) => `Day-${d}`).join(", ")} before saving.`;
}

// ---- Date values ----
// Day dates are stored as "dd-MMM-yy" (e.g. "05-Oct-26"), as the date picker writes them;
// the handover date as "yyyy-MM-dd". Dates are compared as whole-day numbers (days since
// 1970-01-01) so time zones never shift them.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toDayNumber(year, month, day) {
    const d = new Date(Date.UTC(year, month, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
    return d.getTime() / DAY_MS;
}

/** "dd-MMM-yy" -> day number, or null when not a valid date in that format. */
export function parseDayDate(value) {
    const m = /^(\d{2})-([A-Z][a-z]{2})-(\d{2})$/.exec(norm(value));
    if (!m) return null;
    const month = MONTHS.indexOf(m[2]);
    if (month < 0) return null;
    return toDayNumber(2000 + Number(m[3]), month, Number(m[1]));
}

/** "yyyy-MM-dd" (anything after the date is ignored) -> day number, or null. */
export function parseIsoDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(norm(value));
    if (!m) return null;
    return toDayNumber(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Day number -> "dd-MMM-yy". */
export function formatDayNumber(n) {
    const d = new Date(n * DAY_MS);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
    return `${dd}-${MONTHS[d.getUTCMonth()]}-${yy}`;
}

/** Calendar day of a date-picker Date (read from its local fields) as a day number. */
export function dayNumberOfLocalDate(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

/** Local-midnight Date for a day number, for date-picker props. */
export function localDateOfDayNumber(n) {
    const d = new Date(n * DAY_MS);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Today's date in India (IST) as a day number. */
export function todayInIST(now = Date.now()) {
    return Math.floor((now + IST_OFFSET_MS) / DAY_MS);
}

/** Earliest allowed Day date: the day after the handover date, or null when there is none. */
export function earliestDayDate(handoverDate) {
    const handover = parseIsoDate(handoverDate);
    return handover === null ? null : handover + 1;
}

/**
 * Checks the Day-1..Day-16 dates being saved; returns an error message or null.
 * - Changed dates must be valid "dd-MMM-yy" and on or after the day after the handover date.
 * - When any date changed, dates must run strictly forward across the days that have one.
 * - When a saved handover date is moved, every set date is re-checked against it.
 * Future dates are allowed.
 */
export function validateDayDates(gridData, previousGridData = {}, { handoverDate, previousHandoverDate } = {}) {
    const next = gridData || {};
    const prev = previousGridData || {};

    const changed = [];
    for (let d = 1; d <= 16; d++) {
        if (norm(next[dateKey(d)]) !== norm(prev[dateKey(d)])) changed.push(d);
    }
    // A handover date filled in for the first time (auto-filled from the handover sheet)
    // doesn't re-check old dates; moving one that was saved does.
    const handoverMoved = norm(previousHandoverDate) !== "" && norm(handoverDate) !== norm(previousHandoverDate);
    if (changed.length === 0 && !handoverMoved) return null;

    for (const d of changed) {
        const value = norm(next[dateKey(d)]);
        if (value !== "" && parseDayDate(value) === null) {
            return `Invalid date for Day-${d}. Expected a date like 05-Oct-26.`;
        }
    }

    if (changed.length > 0) {
        let prevDay = null;
        for (let d = 1; d <= 16; d++) {
            const n = parseDayDate(next[dateKey(d)]);
            if (n === null) continue;
            if (prevDay !== null && n <= prevDay.n) {
                return `Day-${d} date must be after the Day-${prevDay.d} date.`;
            }
            prevDay = { d, n };
        }
    }

    const earliest = earliestDayDate(handoverDate);
    if (earliest !== null) {
        const toCheck = handoverMoved ? Array.from({ length: 16 }, (_, i) => i + 1) : changed;
        for (const d of toCheck) {
            const n = parseDayDate(next[dateKey(d)]);
            if (n !== null && n < earliest) {
                return `Day-${d} date must be on or after ${formatDayNumber(earliest)}, the day after the handover date.`;
            }
        }
    }
    return null;
}

/** True when `day`'s header date is after `today` (a day number, IST). */
export function isFutureDay(gridData, day, today = todayInIST()) {
    const n = parseDayDate((gridData || {})[dateKey(day)]);
    return n !== null && n > today;
}

/** Days (sorted) dated after `today` whose typed values are new or changed in this save. */
export function findFutureDaysWithValues(gridData, previousGridData = {}, today = todayInIST()) {
    const next = gridData || {};
    const { changed } = typedDays(next, previousGridData || {});
    return [...changed].filter((day) => isFutureDay(next, day, today)).sort((a, b) => a - b);
}

export function futureValuesMessage(days, gridData) {
    const list = days.map((d) => `Day-${d} (${norm((gridData || {})[dateKey(d)])})`).join(", ");
    return `Values can't be entered yet for ${list}: that date is in the future.`;
}
