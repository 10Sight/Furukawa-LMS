// Canonical shift codes for attendance_logs.shift, which holds a mix of spellings ("A-Shift",
// "A", "A2", "GEN") alongside statuses written into the shift column ("Absent", "Left").
// Used by the Manpower Efficiency charts so shift filters and shift-wise breakdowns group
// every spelling of a shift together.

export const SHIFT_KEY_ORDER = ["A", "B", "C", "G", "OTHER"];

// Values that are attendance statuses, not shifts
const NON_SHIFT_VALUES = new Set(["ABSENT", "LEFT", "HOLIDAY", "WO", "WEEKOFF", "LEAVE"]);

// "A" / "A-Shift" / "A Shift" / "A2" → "A" (same for B, C, G); "GEN" / "General" → "G";
// a status or blank → null; any other code ("D", "E") → "OTHER".
export const normalizeShiftKey = (raw) => {
    const value = String(raw ?? "").trim().toUpperCase();
    if (!value || NON_SHIFT_VALUES.has(value)) return null;
    if (value === "GEN" || value === "GENERAL") return "G";
    const m = value.match(/^([ABCG])(?:[\s-]*SHIFT|\d+)?$/);
    return m ? m[1] : "OTHER";
};

export const sortShiftKeys = (keys) =>
    [...keys].sort((a, b) => SHIFT_KEY_ORDER.indexOf(a) - SHIFT_KEY_ORDER.indexOf(b));
