// Small, dependency-free quarter/date helpers, scoped to callers that need string "q1".."q4"
// keys (matching skill_upgradation_plans.tableData's own q{n}Date/q{n}Skill field naming and
// admin/src/components/departments/SkillUpgradationPlan.jsx's convention). Deliberately kept
// separate from server/utils/skillMatrix.util.js's own private (numeric-keyed) quarter
// constants — this file exists so new code doesn't hand-roll month->quarter math yet again,
// not to force a refactor of that already-working, already-tested internal logic.

export const monthToQuarterKey = (month) => (month ? `q${Math.floor((month - 1) / 3) + 1}` : null);

// "YYYY-MM-DD" from a Date object, using local Y/M/D components (not toISOString(), which
// shifts to UTC and can silently roll the date back/forward a day near midnight).
export const formatDateYMD = (dateObj) => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

// Calendar-correct day addition on a "YYYY-MM-DD" string — handles month/year rollover
// (e.g. 2026-12-31 + 1 day -> 2027-01-01). Mirrors the `new Date(y, m-1, d+n)` pattern already
// proven in skillMatrix.util.js's calculateFutureDate.
export const addDaysToDateString = (dateStr, days) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1, d + days);
    return formatDateYMD(date);
};

// Parses a "YYYY-MM-DD" string into the quarter key and year it falls in.
export const getQuarterKeyAndYearFromDate = (dateStr) => {
    const [y, m] = (dateStr || "").split("-").map(Number);
    if (!y || !m) return { quarterKey: null, year: null };
    return { quarterKey: monthToQuarterKey(m), year: y };
};
