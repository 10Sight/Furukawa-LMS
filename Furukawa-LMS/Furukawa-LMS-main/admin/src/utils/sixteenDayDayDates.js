// Day-column header date rules for the 16-Day Monitoring sheet.
//
// A day's values can only be saved once that day's header date (attendance_date_N)
// is set. Only values the user typed count; computed cells (category totals, averages,
// achievement %, evaluation, summary) are ignored. Values already saved before this
// rule existed don't block a save: a day is flagged only when one of its values changed
// in this save, or when its saved date was cleared.
//
// Keep in sync with server/utils/sixteenDayDayDates.util.js (the server re-checks).

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

/**
 * Days (sorted) that have typed values but no header date and would be saved that way.
 * `previousGridData` is the saved record's grid ({} for a new attempt).
 */
export function findDaysMissingDate(gridData, previousGridData = {}) {
    const next = gridData || {};
    const prev = previousGridData || {};
    const filledDays = new Set();
    const changedDays = new Set();

    for (const key of Object.keys(next)) {
        const day = dayOfInputKey(key);
        if (!day || norm(next[key]) === "") continue;
        filledDays.add(day);
        if (norm(next[key]) !== norm(prev[key])) changedDays.add(day);
    }

    const missing = [];
    for (const day of filledDays) {
        const dateKey = `attendance_date_${day}`;
        if (norm(next[dateKey]) !== "") continue;
        const dateCleared = norm(prev[dateKey]) !== "";
        if (changedDays.has(day) || dateCleared) missing.push(day);
    }
    return missing.sort((a, b) => a - b);
}

export function missingDateMessage(days) {
    return `Please select the date on the column header for ${days.map((d) => `Day-${d}`).join(", ")} before saving.`;
}
