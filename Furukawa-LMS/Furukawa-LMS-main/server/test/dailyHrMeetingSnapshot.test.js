// Run with: node --test --experimental-test-module-mocks test/dailyHrMeetingSnapshot.test.js
//
// computeAndStoreDates (services/dailyHrMeetingSnapshot.service.js): stores figures only for days
// that have attendance, clears every requested day, splits work by month, and the upload hook never
// throws. The models and the aggregation service are stand-ins.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const calls = { replace: [], presence: [], requirements: [] };
let attendanceDates = new Set();
let failPresence = false;

mock.module("../logger/winston.logger.js", { defaultExport: { info() {}, warn() {}, error() {}, debug() {} } });
mock.module("../models/dailyHrMeetingDaily.model.js", {
    defaultExport: {
        init: async () => {},
        replaceDates: async (args) => { calls.replace.push(args); },
    },
});
mock.module("../models/dailyManpowerConfig.model.js", {
    defaultExport: {
        init: async () => {},
        getDepartmentsWithConfig: async () => [{ departmentId: 10 }, { departmentId: 20 }],
    },
});
mock.module("../services/manpowerPresence.service.js", {
    namedExports: {
        getRequirementsByDepartment: async (args) => {
            calls.requirements.push(args);
            return { byDepartment: new Map([[10, { fn01: 5, fn02: 6 }]]), unmapped: { fn01: 0, fn02: 0 } };
        },
        getDailyPresenceByDepartment: async (args) => {
            calls.presence.push(args);
            if (failPresence) throw new Error("db down");
            return {
                byDate: new Map([["2026-10-31", new Map([[10, { present: 4, otHrs: 9, fallbackCount: 0 }]])]]),
                unmappedAttendanceDepartmentsByDate: new Map(),
                noDepartmentPresentByDate: new Map(),
            };
        },
        getUnmappedPresentByDate: async () => new Map(),
        getHolidayDates: async () => new Set(),
        getDatesWithAttendance: async () => attendanceDates,
    },
});

const { computeAndStoreDates, queueRecompute } = await import("../services/dailyHrMeetingSnapshot.service.js");

const reset = () => { calls.replace = []; calls.presence = []; calls.requirements = []; failPresence = false; };

test("stores only days with attendance but clears every requested day, one month at a time", async () => {
    reset();
    attendanceDates = new Set(["2026-10-31", "2026-11-02"]);
    const result = await computeAndStoreDates(
        ["2026-11-02", "2026-10-31", "2026-11-01", "2026-11-02", "bad-date"],
        { source: "MANUAL", userId: 3 }
    );

    assert.equal(result.dates, 2);
    assert.deepEqual(calls.requirements, [{ year: 2026, monthNumber: 10 }, { year: 2026, monthNumber: 11 }]);
    assert.deepEqual(calls.presence.map((p) => [p.startDate, p.endDate, p.departmentResolution]), [
        ["2026-10-31", "2026-10-31", "current"],
        ["2026-11-01", "2026-11-02", "current"],
    ]);

    const [oct, nov] = calls.replace;
    assert.deepEqual(oct.dates, ["2026-10-31"]);
    assert.equal(oct.rows.length, 2); // both departments
    assert.deepEqual(oct.rows.find((r) => r.departmentId === 10), {
        reportDate: "2026-10-31", departmentId: 10, requiredFN01: 5, requiredFN02: 6, requiredForDay: 6,
        presentCount: 4, otHrs: 9, otMandays: 1, gap: -2, deptFallbackCount: 0,
    });
    assert.equal(oct.source, "MANUAL");
    assert.equal(oct.computedBy, 3);

    // 1 Nov has no attendance: cleared, nothing stored for it.
    assert.deepEqual(nov.dates, ["2026-11-01", "2026-11-02"]);
    assert.deepEqual([...new Set(nov.rows.map((r) => r.reportDate))], ["2026-11-02"]);
    assert.deepEqual(nov.metaRows.map((m) => m.reportDate), ["2026-11-02"]);
});

test("no valid dates: nothing is queried or written", async () => {
    reset();
    const result = await computeAndStoreDates(["", null, "2026-13"], { source: "NIGHTLY" });
    assert.equal(result.dates, 0);
    assert.equal(calls.replace.length, 0);
    assert.equal(calls.presence.length, 0);
});

test("the upload hook swallows failures and never throws to the caller", async () => {
    reset();
    failPresence = true;
    attendanceDates = new Set(["2026-11-03"]);
    assert.doesNotThrow(() => queueRecompute(["2026-11-03"], { source: "UPLOAD" }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(calls.presence.length, 1);
    assert.equal(calls.replace.length, 0);
});
