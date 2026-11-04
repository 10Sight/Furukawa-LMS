// Run with: node --test --experimental-test-module-mocks test/dailyHandoverReportRange.test.js
//
// GET /daily-manpower-report/handover?months=N: the date span covers the selected month and the
// N-1 months before it (crossing a year), stops at today (IST), and rejects out-of-range N.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const queried = [];

mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[]], runOnRequest: async () => [[]] } });
mock.module("../logger/winston.logger.js", { defaultExport: { info() {}, warn() {}, error() {}, debug() {} } });
mock.module("../models/dailyManpowerConfig.model.js", {
    defaultExport: { getDepartmentsWithConfig: async () => [] },
    namedExports: { DEFAULT_GROUP: "MAIN" },
});
mock.module("../models/dailyManpowerManualEntry.model.js", { defaultExport: {} });
mock.module("../models/dailyHrMeetingDaily.model.js", { defaultExport: {} });
mock.module("../services/dailyHrMeetingSnapshot.service.js", { namedExports: { computeAndStoreDates: async () => ({ dates: 0 }) } });
mock.module("../services/dailyHrMeetingScheduler.js", { namedExports: { todayIST: () => "2026-11-04" } });
mock.module("../services/dailyHandoverReport.service.js", {
    namedExports: {
        getHandoverRows: async (start, end) => { queried.push([start, end]); return []; },
        getHiringRows: async () => [],
        buildHandoverReport: ({ dates }) => ({ dates }),
    },
});

const { getHandoverReportData } = await import("../controllers/dailyManpowerReport.controller.js");

const call = (query) => new Promise((resolve, reject) => {
    const res = {
        status() { return this; },
        json(body) { resolve(body.data); },
    };
    getHandoverReportData({ query }, res, reject);
});

test("months=2 spans the previous month and the selected month up to today", async () => {
    queried.length = 0;
    const { dates } = await call({ year: "2026", month: "11", months: "2" });
    assert.equal(dates[0], "2026-10-01");
    assert.equal(dates[dates.length - 1], "2026-11-04");
    assert.equal(dates.length, 31 + 4);
    assert.deepEqual(queried, [["2026-10-01", "2026-11-04"]]);
});

test("months=2 in January reaches back into December of the year before", async () => {
    const { dates } = await call({ year: "2026", month: "1", months: "2" });
    assert.equal(dates[0], "2025-12-01");
    assert.equal(dates[dates.length - 1], "2026-01-31");
    assert.equal(dates.length, 62);
});

test("months defaults to 1 and is limited to 1-3", async () => {
    const { dates } = await call({ year: "2026", month: "10" });
    assert.equal(dates.length, 31);
    for (const months of ["0", "4", "x"]) {
        await assert.rejects(call({ year: "2026", month: "10", months }), (err) => err.statuscode === 400);
    }
});
