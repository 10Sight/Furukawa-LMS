// Calendar-month arithmetic for the Operator Observance Sheet's auto-scheduled inspection
// dates (Level-1/Level-2 completion date + 1/2 months). Same algorithm as
// skillMatrix.util.js's addThreeMonths, generalized to an arbitrary offset, and mirrored by
// server/utils/dateMath.js so this client-side pre-fill always agrees with what gets saved.

// Adds `months` calendar months to a "YYYY-MM-DD" string, clamped to the target month's last
// day on overflow (e.g. 2026-01-31 + 1 month -> 2026-02-28, not 2026-03-03).
export function addCalendarMonths(dateStr, months) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1 + months, d);
    if (date.getDate() !== d) date.setDate(0);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
