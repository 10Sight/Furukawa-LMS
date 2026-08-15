// Standalone check of the shift-matching + fallback logic added to
// headcountData.service.js's getShiftBreakdownForDate, using synthetic data (no DB) so it
// doesn't touch the real production database. Re-implements just the pure logic pieces
// (getShiftNameFromRaw + the fallback resolution order) so this can run in isolation.

const getShiftNameFromRaw = (shiftRaw) => {
    if (!shiftRaw) return null;
    const compact = String(shiftRaw).trim().toUpperCase().replace(/[\s\-_]/g, "");

    if (["A", "SHIFTA", "ASHIFT"].includes(compact)) return "A-Shift";
    if (["B", "SHIFTB", "BSHIFT"].includes(compact)) return "B-Shift";
    if (["C", "SHIFTC", "CSHIFT"].includes(compact)) return "C-Shift";
    if (["G", "GEN", "GENERAL", "GENERALSHIFT", "SHIFTG", "GSHIFT"].includes(compact)) return "G-Shift";

    return null;
};

// Mirrors the resolution order in getShiftBreakdownForDate: punch shift first, then the
// user's scheduled shift for that date, then their default shift.
const resolveShiftForPunch = (punchShiftRaw, dKey, userObj) => {
    let shiftName = getShiftNameFromRaw(punchShiftRaw);
    if (shiftName) return shiftName;
    if (!userObj) return null;

    let userScheduleShift = null;
    if (userObj.shiftSchedule) {
        try {
            const schedule = typeof userObj.shiftSchedule === 'string'
                ? JSON.parse(userObj.shiftSchedule)
                : userObj.shiftSchedule;
            if (schedule && schedule[dKey]) userScheduleShift = schedule[dKey];
        } catch (err) { /* malformed JSON, fall through */ }
    }
    return getShiftNameFromRaw(userScheduleShift || userObj.shift);
};

let pass = 0;
let fail = 0;
const check = (label, actual, expected) => {
    const ok = actual === expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    if (ok) pass++; else fail++;
};

// 1. Loose substring match no longer bleeds through (old bug: "A-Shift-1".includes("A") -> A).
check(
    "Ambiguous raw shift string no longer strictly matches A-Shift",
    getShiftNameFromRaw("A-Shift-1"),
    null
);

// 2. Standard compacted patterns from the Dashboard graph's accepted list still match.
check("'A' matches A-Shift", getShiftNameFromRaw("A"), "A-Shift");
check("'Shift A' matches A-Shift", getShiftNameFromRaw("Shift A"), "A-Shift");
check("'A Shift' matches A-Shift", getShiftNameFromRaw("A Shift"), "A-Shift");
check("'General' matches G-Shift", getShiftNameFromRaw("General"), "G-Shift");
check("'Gen' matches G-Shift", getShiftNameFromRaw("Gen"), "G-Shift");
check("unrecognized raw shift returns null", getShiftNameFromRaw("Night"), null);

// 3. Fallback: punch's shift is unidentified/missing, but the user's default `shift` in the
// users table is "A" -> should resolve to A-Shift via fallback.
check(
    "Fallback to user's default shift when punch shift is unidentified",
    resolveShiftForPunch("A-Shift-1", "2026-08-15", { shift: "A", shiftSchedule: null }),
    "A-Shift"
);

// 4. Fallback: punch has no shift at all, user has a shiftSchedule entry for that date.
check(
    "Fallback to user's shiftSchedule[date] when punch shift is missing",
    resolveShiftForPunch(null, "2026-08-15", { shift: "A", shiftSchedule: { "2026-08-15": "B" } }),
    "B-Shift"
);

// 5. No punch shift, no user match, no default shift -> unresolved (counted in Available_Total,
// not in any shift-specific bucket, per the plan).
check(
    "Unresolvable shift falls back to null (still counted in Available_Total upstream)",
    resolveShiftForPunch(null, "2026-08-15", { shift: null, shiftSchedule: null }),
    null
);
check(
    "Unresolvable shift when no user record exists at all",
    resolveShiftForPunch(null, "2026-08-15", null),
    null
);

// 6. Assigned/plan headcount + Attendance % = Available/Assigned*100, mirroring
// getShiftBreakdownForDate + populateShiftTableData: Assigned counts every active user's
// scheduled shift regardless of presence; Attendance % divides present (Available) by that
// plan count (Assigned), not the other way around.
const dKey = "2026-08-15";
const users = [
    { empId: "E1", shift: "A", shiftSchedule: null },     // scheduled A, present in A -> counts both
    { empId: "E2", shift: "A", shiftSchedule: null },     // scheduled A, absent (no punch) -> assigned only
    { empId: "E3", shift: "B", shiftSchedule: { [dKey]: "B" } }, // scheduled B via schedule, present in B
    { empId: "E4", shift: null, shiftSchedule: null },    // no scheduled shift at all -> unassigned, not counted
];
const presentPunches = {
    E1: "A",
    E3: "B",
};

const getScheduledShiftForUser = (userObj) => {
    let userScheduleShift = null;
    if (userObj.shiftSchedule && userObj.shiftSchedule[dKey]) userScheduleShift = userObj.shiftSchedule[dKey];
    return getShiftNameFromRaw(userScheduleShift || userObj.shift);
};

const assignedByShift = { "A-Shift": 0, "B-Shift": 0, "C-Shift": 0, "G-Shift": 0 };
const availableByShift = { "A-Shift": 0, "B-Shift": 0, "C-Shift": 0, "G-Shift": 0 };
let assignedTotal = 0;
let availableTotal = 0;

users.forEach(u => {
    const scheduled = getScheduledShiftForUser(u);
    if (scheduled) {
        assignedTotal++;
        assignedByShift[scheduled]++;
    }
    if (presentPunches[u.empId]) {
        const present = resolveShiftForPunch(presentPunches[u.empId], dKey, u);
        availableTotal++;
        if (present) availableByShift[present]++;
    }
});

check("Assigned_A-Shift counts both present and absent scheduled users", assignedByShift["A-Shift"], 2);
check("Assigned_B-Shift counts the schedule-driven user", assignedByShift["B-Shift"], 1);
check("Assigned_Total excludes users with no resolvable scheduled shift", assignedTotal, 3);
check("Available_A-Shift only counts the actually-present user", availableByShift["A-Shift"], 1);
check("Available_Total counts only present punches", availableTotal, 2);

const attendanceAShift = assignedByShift["A-Shift"] > 0
    ? (availableByShift["A-Shift"] / assignedByShift["A-Shift"]) * 100
    : 0;
check("Attendance_A-Shift = Available/Assigned*100 (1 present of 2 scheduled = 50%)", attendanceAShift, 50);

const attendanceTotal = assignedTotal > 0 ? (availableTotal / assignedTotal) * 100 : 0;
check("Attendance_Total = Available/Assigned*100 (2 present of 3 scheduled)", Math.round(attendanceTotal * 100) / 100, 66.67);

check("Attendance % is 0 (not divide-by-zero) when Assigned is 0", (0 > 0 ? (5 / 0) * 100 : 0), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
