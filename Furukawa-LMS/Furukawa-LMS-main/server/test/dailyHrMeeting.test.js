// Run with: node --test --experimental-test-module-mocks test/dailyHrMeeting.test.js
//
// Daily HR Meeting (Daily Manpower Report): the shared present rule, department-as-of-date
// resolution, the stored-row builder and the report matrix (Other roll-up, SUM totals, Training,
// FN01/FN02 switch). The database is replaced by stand-ins; nothing here touches MSSQL.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[]], runOnRequest: async () => [[]] } });
mock.module("../db/withTransaction.js", { defaultExport: async (fn) => fn({ query: async () => [[]] }), namedExports: { withTransaction: async (fn) => fn({ query: async () => [[]] }) } });
mock.module("../logger/winston.logger.js", { defaultExport: { info() {}, warn() {}, error() {}, debug() {} } });

const presence = await import("../utils/manpowerPresence.js");
const { aggregatePresenceByDepartment } = await import("../services/manpowerPresence.service.js");
const { buildMonthlyReport, listMonthDates } = await import("../services/dailyHrMeetingReport.js");
const { buildSnapshotRows } = await import("../services/dailyHrMeetingSnapshot.service.js");
const { prepareManpowerUser, isUserActiveForManpowerDate } = await import("../utils/manpowerLifecycle.js");

// ---------------------------------------------------------------------------------------------
// Refactor safety: the dashboard's inline present rule and approval SQL, exactly as they were
// before extraction (dashboard.controller.js at HEAD), must agree with the shared helpers.
// ---------------------------------------------------------------------------------------------

const legacyIsPresent = (row, attendanceUserById, userId, fullDate) => {
    const attendanceStatus = String(row?.status || '').trim().toUpperCase();
    if (!['P', 'PRESENT'].includes(attendanceStatus)) return false;
    const userInfo = attendanceUserById.get(userId);
    if (!userInfo) return false;
    const payCodeKey = String(row?.payCode || '').trim().toUpperCase();
    if (!payCodeKey || payCodeKey !== userInfo.empIdKey) return false;
    if (!isUserActiveForManpowerDate(userInfo.prepared, fullDate)) return false;
    return true;
};

const legacyIndex = (rows) => new Map(rows.map((userRow) => {
    const userId = Number(userRow?.id);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return [userId, { empIdKey: String(userRow?.empId || '').trim().toUpperCase(), prepared: prepareManpowerUser(userRow) }];
}).filter(Boolean));

const LEGACY_APPROVAL_SQL = `
        AND (
            (
                ISNULL(r.is_active, 0) = 1
                AND LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, 'approved')))) IN (
                    'approved',
                    'system_approved',
                    'system approved',
                    'system-approved',
                    'systemapproved'
                )
            )
            OR LOWER(LTRIM(RTRIM(ISNULL(r.approvalStatus, '')))) IN (
                'system_approved',
                'system approved',
                'system-approved',
                'systemapproved'
            )
        )
    `;

const user = (id, empId, extra = {}) => ({
    id, empId, departmentId: 1, status: "PRESENT", joiningDate: "2025-01-01", leavingDate: null, statusHistory: null, ...extra,
});

test("shared approval SQL is identical to the dashboard's previous inline SQL", () => {
    assert.equal(presence.getRequirementApprovalSql("r"), LEGACY_APPROVAL_SQL);
});

test("shared present rule matches the dashboard's previous inline rule on every combination", () => {
    const users = [
        user(1, "E001"),
        user(2, " e002 "),
        user(3, "E003", { status: "LEFT", leavingDate: "2026-11-02" }),
        user(4, "E004", { joiningDate: "2026-11-03" }),
        user(5, ""),
        { id: 0, empId: "BAD" },
    ];
    const legacy = legacyIndex(users);
    const shared = presence.buildAttendanceUserIndex(users);

    const statuses = ["P", "PRESENT", "Present", " p ", "A", "ABSENT", "HALF DAY", "", null];
    const payCodes = ["E001", "e002", "E003", "E004", "", null, "X999"];
    const dates = ["2026-11-01", "2026-11-02", "2026-11-03"];
    let checked = 0;
    for (const userId of [1, 2, 3, 4, 5, 6, 99]) {
        for (const status of statuses) for (const payCode of payCodes) for (const date of dates) {
            const row = { status, payCode };
            assert.equal(
                presence.isCountedPresentAttendance(row, shared.get(userId), date),
                legacyIsPresent(row, legacy, userId, date),
                `user ${userId} status ${status} payCode ${payCode} on ${date}`
            );
            checked++;
        }
    }
    assert.ok(checked > 1000);
});

// ---------------------------------------------------------------------------------------------
// Present / OT aggregation and department-as-of-date
// ---------------------------------------------------------------------------------------------

test("OT counts only on rows counted present; department comes from the attendance row", () => {
    const populationRows = [
        user(1, "E1", { departmentId: 10 }),   // currently in Assembly (10)
        user(2, "E2", { departmentId: 20 }),
        user(3, "E3", { departmentId: 20 }),
    ];
    const attendanceDeptMap = new Map([["ASSEMBLY", 10], ["C&C", 20]]);
    const attendanceRows = [
        // user 1 transferred: was in C&C on the 2nd, Assembly on the 3rd
        { fullDate: "2026-11-02", userId: 1, payCode: "E1", status: "P", otHrs: 2, department: "c&c " },
        { fullDate: "2026-11-03", userId: 1, payCode: "E1", status: "P", otHrs: 1, department: "Assembly" },
        // absent row with OT: neither present nor OT
        { fullDate: "2026-11-02", userId: 2, payCode: "E2", status: "A", otHrs: 8, department: "C&C" },
        // payCode mismatch: not counted, OT ignored
        { fullDate: "2026-11-02", userId: 3, payCode: "WRONG", status: "P", otHrs: 4, department: "C&C" },
        // unmapped spelling -> falls back to current department (20)
        { fullDate: "2026-11-03", userId: 3, payCode: "E3", status: "PRESENT", otHrs: 3.5, department: "CUTTING" },
    ];

    const result = aggregatePresenceByDepartment({ populationRows, attendanceRows, attendanceDeptMap, departmentResolution: "attendance" });

    assert.deepEqual(result.byDate.get("2026-11-02").get(20), { present: 1, otHrs: 2, fallbackCount: 0 });
    assert.equal(result.byDate.get("2026-11-02").get(10), undefined);
    assert.deepEqual(result.byDate.get("2026-11-03").get(10), { present: 1, otHrs: 1, fallbackCount: 0 });
    assert.deepEqual(result.byDate.get("2026-11-03").get(20), { present: 1, otHrs: 3.5, fallbackCount: 1 });
    assert.deepEqual(result.unmappedAttendanceDepartmentsByDate.get("2026-11-03"), [{ name: "CUTTING", count: 1 }]);

    // "current" mode (the MPS chart's behaviour) puts user 1 under Assembly on both days.
    const current = aggregatePresenceByDepartment({ populationRows, attendanceRows, attendanceDeptMap, departmentResolution: "current" });
    assert.equal(current.byDate.get("2026-11-02").get(10).present, 1);
    assert.equal(current.byDate.get("2026-11-02").get(20), undefined);
});

// ---------------------------------------------------------------------------------------------
// Stored rows
// ---------------------------------------------------------------------------------------------

test("stored rows: every department every date, FN01 until the 15th, FN02 from the 16th", () => {
    const presenceResult = {
        byDate: new Map([["2026-11-15", new Map([[10, { present: 1300, otHrs: 7, fallbackCount: 2 }]])]]),
        unmappedAttendanceDepartmentsByDate: new Map(),
        noDepartmentPresentByDate: new Map([["2026-11-15", 3]]),
    };
    const { rows, metaRows } = buildSnapshotRows({
        dates: ["2026-11-15", "2026-11-16"],
        departmentIds: [10, 20],
        requirements: { byDepartment: new Map([[10, { fn01: 1288, fn02: 1250 }]]), unmapped: { fn01: 5, fn02: 6 } },
        presence: presenceResult,
        unmappedPresent: new Map([["2026-11-15", 4]]),
        holidays: new Set(["2026-11-16"]),
    });

    assert.equal(rows.length, 4);
    const r15 = rows.find((r) => r.reportDate === "2026-11-15" && r.departmentId === 10);
    assert.deepEqual(r15, {
        reportDate: "2026-11-15", departmentId: 10, requiredFN01: 1288, requiredFN02: 1250, requiredForDay: 1288,
        presentCount: 1300, otHrs: 7, otMandays: 1, gap: 12, deptFallbackCount: 2,
    });
    const r16 = rows.find((r) => r.reportDate === "2026-11-16" && r.departmentId === 10);
    assert.equal(r16.requiredForDay, 1250);
    assert.equal(r16.gap, -1250);
    const zero = rows.find((r) => r.reportDate === "2026-11-16" && r.departmentId === 20);
    assert.equal(zero.presentCount, 0);
    assert.equal(metaRows[0].unmappedPresent, 4);
    assert.equal(metaRows[0].noDepartmentPresent, 3);
    assert.equal(metaRows[1].isHoliday, true);
});

test("stored rows: a holiday shows Present 0 like the MPS trend chart, OT hours are kept", () => {
    const { rows, metaRows } = buildSnapshotRows({
        dates: ["2026-11-16"],
        departmentIds: [10],
        requirements: { byDepartment: new Map([[10, { fn01: 0, fn02: 50 }]]), unmapped: { fn01: 0, fn02: 0 } },
        presence: {
            byDate: new Map([["2026-11-16", new Map([[10, { present: 12, otHrs: 16, fallbackCount: 1 }], [99, { present: 2, otHrs: 0, fallbackCount: 0 }]])]]),
            unmappedAttendanceDepartmentsByDate: new Map(),
            noDepartmentPresentByDate: new Map([["2026-11-16", 3]]),
        },
        unmappedPresent: new Map([["2026-11-16", 4]]),
        holidays: new Set(["2026-11-16"]),
    });

    assert.deepEqual(rows[0], {
        reportDate: "2026-11-16", departmentId: 10, requiredFN01: 0, requiredFN02: 50, requiredForDay: 50,
        presentCount: 0, otHrs: 16, otMandays: 2, gap: -50, deptFallbackCount: 0,
    });
    assert.equal(metaRows[0].unmappedPresent, 0);
    assert.equal(metaRows[0].noDepartmentPresent, 0);
});

// ---------------------------------------------------------------------------------------------
// Report matrix — reproduces the reference sheet's 03/11 column
// ---------------------------------------------------------------------------------------------

const D = "2026-11-03";
const dep = (departmentId, departmentName, extra = {}) => ({
    departmentId, departmentName, displayName: null, isOther: false, groupName: "MAIN", groupSortOrder: 0, sortOrder: null, isHidden: false, ...extra,
});
const stored = (departmentId, required, present, otHrs) => ({
    reportDate: D, departmentId, requiredFN01: required, requiredFN02: required, requiredForDay: required,
    presentCount: present, otHrs, otMandays: Math.round(otHrs / 8), gap: present - required, deptFallbackCount: 0,
});

const referenceReport = () => buildMonthlyReport({
    year: 2026,
    monthNumber: 11,
    dates: [D, "2026-11-04"],
    departments: [
        dep(1, "ASSEMBLY", { sortOrder: 0 }),
        dep(2, "CRIMPING & CUTTING", { displayName: "C&C", sortOrder: 1 }),
        dep(3, "QUALITY", { sortOrder: 2 }),
        dep(4, "STORES", { isOther: true }),
        dep(5, "MAINTENANCE", { isOther: true }),
        dep(6, "ADMIN", { sortOrder: 4 }),
        dep(7, "SRC", { groupName: "SRC", groupSortOrder: 1 }),
        dep(8, "OLD DEPT", { isHidden: true }),
    ],
    storedRows: [
        stored(1, 1288, 1313, 0),
        stored(2, 392, 419, 0),
        stored(3, 375, 377, 0),
        stored(4, 100, 110, 4),   // Other = 4 + 5
        stored(5, 24, 23, 0),
        stored(6, 7, 7, 0),
        stored(7, 227, 216, 4),
        stored(8, 50, 50, 80),    // hidden: excluded everywhere
    ],
    meta: new Map([[D, { isHoliday: false, computedAt: "2026-11-03T20:00:00Z", computeSource: "UPLOAD", unmappedPresent: 0, noDepartmentPresent: 0, unmappedRequirementFN01: 0, unmappedRequirementFN02: 0, unmappedAttendanceDepartments: [] }]]),
    training: { requiredFN01: 90, requiredFN02: 90, entries: new Map() },
});

test("rows, aliases and Other roll-up follow the configuration", () => {
    const report = referenceReport();
    assert.deepEqual(report.groups.map((g) => g.name), ["MAIN", "SRC"]);
    assert.deepEqual(report.groups[0].rows.map((r) => r.label), ["ASSEMBLY", "C&C", "QUALITY", "ADMIN", "Other"]);
    const other = report.groups[0].rows.at(-1);
    // Other is a row: Mandays derived from its summed hours, ROUND(4 / 8) = ROUND(0.5) = 1.
    assert.deepEqual(other.cells[D], { required: 124, present: 133, otHrs: 4, otMandays: 1, gap: 9 });
    assert.deepEqual(other.mergedLabels, ["STORES", "MAINTENANCE"]);
});

test("total rows are SUMs of every column, Mandays included (never recomputed from total hours)", () => {
    const report = referenceReport();
    const main = report.groups[0].total.cells[D];
    assert.deepEqual(main, { required: 2186, present: 2249, otHrs: 4, otMandays: 1, gap: 63 });
    const src = report.groups[1].total.cells[D];
    assert.deepEqual(src, { required: 227, present: 216, otHrs: 4, otMandays: 1, gap: -11 });

    const grand = report.grandTotal.cells[D];
    // SUM of Main Total (1) + SRC Total (1) + Training (0) = 2, not ROUND(8 / 8) = 1.
    assert.deepEqual(grand, { required: 2503, present: 2465, otHrs: 8, otMandays: 2, gap: -38 });
    assert.equal(report.grandTotal.requiredFN01, 2503);
});

test("Training row is manual; dates without stored figures are not computed", () => {
    const report = referenceReport();
    assert.deepEqual(report.training.cells[D], { required: 90, present: 0, otHrs: 0, otMandays: 0, gap: -90 });
    assert.equal(report.groups[0].rows[0].cells["2026-11-04"], null);
    assert.equal(report.grandTotal.cells["2026-11-04"], null);
    assert.deepEqual(report.diagnostics.notComputedDates, ["2026-11-04"]);
});

test("Training switches from Indent 01 to Indent 16 on day 16 and rounds Mandays", () => {
    const dates = ["2026-11-15", "2026-11-16"];
    const report = buildMonthlyReport({
        year: 2026, monthNumber: 11, dates, departments: [], storedRows: [], meta: new Map(),
        training: { requiredFN01: 90, requiredFN02: 80, entries: new Map([["2026-11-16", { presentCount: 85, otHrs: 12 }]]) },
    });
    assert.equal(report.training.cells["2026-11-15"].required, 90);
    assert.deepEqual(report.training.cells["2026-11-16"], { required: 80, present: 85, otHrs: 12, otMandays: 2, gap: 5 });
});

test("a department with no saved config appears in MAIN after configured ones", () => {
    const report = buildMonthlyReport({
        year: 2026, monthNumber: 11, dates: [D],
        departments: [dep(9, "NEW DEPT"), dep(1, "ASSEMBLY", { sortOrder: 0 })],
        storedRows: [stored(1, 10, 10, 0)],
        meta: new Map([[D, { computedAt: null, unmappedAttendanceDepartments: [] }]]),
        training: { requiredFN01: 0, requiredFN02: 0, entries: new Map() },
    });
    assert.deepEqual(report.groups[0].rows.map((r) => r.label), ["ASSEMBLY", "NEW DEPT"]);
    assert.deepEqual(report.groups[0].rows[1].cells[D], { required: 0, present: 0, otHrs: 0, otMandays: 0, gap: 0 });
});

test("listMonthDates stops at the given day", () => {
    assert.equal(listMonthDates(2026, 2).length, 28);
    assert.deepEqual(listMonthDates(2026, 11, { upTo: "2026-11-03" }), ["2026-11-01", "2026-11-02", "2026-11-03"]);
});
