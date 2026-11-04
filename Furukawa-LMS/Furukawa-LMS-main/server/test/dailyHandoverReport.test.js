// Run with: node --test --experimental-test-module-mocks test/dailyHandoverReport.test.js
//
// Daily HR Meeting — Daily Handover Report tab: Handover Actual by department (shared section
// config: aliases, Other, groups, hidden) and Hiring Actual by Dojo shift. Pure builder; the
// database is replaced by stand-ins.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[]], runOnRequest: async () => [[]] } });
mock.module("../logger/winston.logger.js", { defaultExport: { info() {}, warn() {}, error() {}, debug() {} } });

const { buildHandoverReport, normalizeShift } = await import("../services/dailyHandoverReport.service.js");

const dates = ["2026-10-08", "2026-10-09", "2026-10-10"];

const dep = (departmentId, departmentName, extra = {}) => ({
    departmentId, departmentName, displayName: null, isOther: false, groupName: "MAIN",
    groupSortOrder: 0, sortOrder: null, isHidden: false, ...extra,
});

const departments = [
    dep(1, "Assembly Dept", { displayName: "Assembly", sortOrder: 1 }),
    dep(2, "Quality", { sortOrder: 2 }),
    dep(3, "Stores", { isOther: true }),
    dep(4, "Maintenance", { isOther: true }),
    dep(5, "SRC Plant", { displayName: "SRC", groupName: "SRC", groupSortOrder: 1 }),
    dep(6, "Canteen", { isHidden: true }),
];

const handover = (date, userId, departmentId) => ({ date, userId, departmentId });

test("handover rows follow the section config; totals are sums; one count per person per day", () => {
    const report = buildHandoverReport({
        year: 2026, monthNumber: 10, dates, departments,
        handoverRows: [
            handover("2026-10-09", 100, 1),
            handover("2026-10-09", 101, 1),
            handover("2026-10-09", 102, 3),
            handover("2026-10-09", 103, 4),
            handover("2026-10-09", 104, 5),
            handover("2026-10-09", 104, 5),  // same person on two sheets: once
            handover("2026-10-08", 105, 2),
            handover("2026-10-10", 106, 6),  // hidden department: diagnostics only
            handover("2026-10-10", 107, null), // no department: diagnostics only
            handover("2026-09-30", 108, 1),  // outside the dates
        ],
        hiringRows: [],
    });

    const [main, src] = report.handover.groups;
    assert.equal(main.name, "MAIN");
    assert.deepEqual(main.rows.map((r) => r.label), ["Assembly", "Quality", "Other"]);
    assert.deepEqual(main.rows.find((r) => r.kind === "other").mergedLabels, ["Stores", "Maintenance"]);
    assert.deepEqual(main.rows[0].values, { "2026-10-08": 0, "2026-10-09": 2, "2026-10-10": 0 });
    assert.equal(main.rows[2].values["2026-10-09"], 2);
    assert.deepEqual(main.total.values, { "2026-10-08": 1, "2026-10-09": 4, "2026-10-10": 0 });

    assert.equal(src.name, "SRC");
    assert.deepEqual(src.rows.map((r) => r.label), ["SRC"]);
    assert.deepEqual(src.total.values, { "2026-10-08": 0, "2026-10-09": 1, "2026-10-10": 0 });

    assert.deepEqual(report.handover.grandTotal.values, { "2026-10-08": 1, "2026-10-09": 5, "2026-10-10": 0 });
    assert.deepEqual(report.diagnostics, { hiddenDepartmentHandovers: 1, unassignedHandovers: 1, unassignedShiftTotal: 0 });
    assert.deepEqual(report.dates.map((d) => d.day), [8, 9, 10]);
});

test("hiring is bucketed into A/B/C/G; unknown shifts get their own row so the total stays a sum", () => {
    const report = buildHandoverReport({
        year: 2026, monthNumber: 10, dates, departments,
        handoverRows: [],
        hiringRows: [
            { date: "2026-10-08", shiftRaw: "A", hires: 33 },
            { date: "2026-10-08", shiftRaw: "B-SHIFT", hires: 2 },
            { date: "2026-10-09", shiftRaw: "GENERAL", hires: 1 },
            { date: "2026-10-09", shiftRaw: "", hires: 3 },
            { date: "2026-10-11", shiftRaw: "A", hires: 9 }, // outside the dates
        ],
    });
    assert.deepEqual(report.hiring.rows.map((r) => r.label), ["A-Shift", "B-Shift", "C-Shift", "G-Shift", "No shift"]);
    assert.deepEqual(report.hiring.rows[0].values, { "2026-10-08": 33, "2026-10-09": 0, "2026-10-10": 0 });
    assert.deepEqual(report.hiring.grandTotal.values, { "2026-10-08": 35, "2026-10-09": 4, "2026-10-10": 0 });
    assert.equal(report.diagnostics.unassignedShiftTotal, 3);

    const noUnknown = buildHandoverReport({
        year: 2026, monthNumber: 10, dates, departments, handoverRows: [],
        hiringRows: [{ date: "2026-10-08", shiftRaw: "C", hires: 1 }],
    });
    assert.deepEqual(noUnknown.hiring.rows.map((r) => r.label), ["A-Shift", "B-Shift", "C-Shift", "G-Shift"]);
});

test("shift spellings", () => {
    for (const [raw, want] of [
        ["A", "A"], [" a ", "A"], ["A-Shift", "A"], ["SHIFT B", "B"], ["c shift", "C"], ["c_shift", "C"],
        ["G", "G"], ["Gen", "G"], ["general", "G"], [null, "UNASSIGNED"], ["", "UNASSIGNED"], ["NIGHT", "UNASSIGNED"], ["AB", "UNASSIGNED"],
    ]) {
        assert.equal(normalizeShift(raw), want, String(raw));
    }
});

test("a month that has not started yields empty tables", () => {
    const report = buildHandoverReport({ year: 2026, monthNumber: 12, dates: [], departments, handoverRows: [], hiringRows: [] });
    assert.deepEqual(report.dates, []);
    assert.deepEqual(report.handover.grandTotal.values, {});
    assert.equal(report.hiring.rows.length, 4);
});
