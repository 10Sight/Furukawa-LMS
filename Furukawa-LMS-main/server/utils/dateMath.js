// Calendar-month arithmetic for dates derived from Level-1/Level-2 completion dates
// (used to auto-schedule operator-observance inspection windows). The month-add algorithm
// mirrors skillMatrix.util.js's addThreeMonths/calculateFutureDate; this file generalizes it
// to an arbitrary month offset and normalizes DB Date objects / request-body strings alike.
// Mirrored by admin/src/utils/dateMath.js so client-side pre-fill and the server-side
// persisted value always agree.

// "YYYY-MM-DD" from a Date object using local Y/M/D components — never toISOString(), which
// shifts to UTC and can roll the date back/forward a day near midnight.
const formatDateYMD = (dateObj) => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const addCalendarMonths = (dateStr, months) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1 + months, d);
    if (date.getDate() !== d) date.setDate(0);
    return formatDateYMD(date);
};

// Accepts a Date object (as read back from the DB), a "YYYY-MM-DD" string, or any other
// Date-constructible value, and returns "YYYY-MM-DD" that is `months` calendar months later,
// clamped to the target month's last day on overflow. Returns null for empty/invalid input.
export const addMonthsToDateValue = (date, months) => {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return addCalendarMonths(formatDateYMD(parsed), months);
};
