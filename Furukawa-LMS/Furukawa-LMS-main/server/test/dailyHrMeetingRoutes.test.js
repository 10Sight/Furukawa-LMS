// Run with: node --test --experimental-test-module-mocks test/dailyHrMeetingRoutes.test.js
//
// Who may use the Daily HR Meeting API (routes/dailyManpowerReport.routes.js): hr_meeting:read for
// every GET, hr_meeting:update for every POST. daily_meeting:* (Morning Meeting) grants nothing here.
// Also checks the real controller module loads with all of its imports resolved.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[]], runOnRequest: async () => [[]] } });
mock.module("../db/withTransaction.js", { defaultExport: async (fn) => fn({ query: async () => [[]] }) });
mock.module("../logger/winston.logger.js", { defaultExport: { info() {}, warn() {}, error() {}, debug() {} } });
mock.module("../middlewares/auth.middleware.js", { defaultExport: (req, res, next) => next() });
mock.module("../controllers/rolesPermissions.controller.js", { namedExports: { DEFAULT_ROLES: {} } });

const controller = await import("../controllers/dailyManpowerReport.controller.js");
const { default: router } = await import("../routes/dailyManpowerReport.routes.js");

test("the controller exports every handler the routes use", () => {
    for (const name of ["getMonthlyReportData", "getConfig", "saveDepartmentConfigs", "getAttendanceDeptMap",
        "saveAttendanceDeptMap", "getTrainingInputs", "saveTrainingInputs", "recalculateMonth"]) {
        assert.equal(typeof controller[name], "function", name);
    }
});

const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
        path: layer.route.path,
        method: Object.keys(layer.route.methods)[0].toUpperCase(),
        // [authorizeRoles(...), handler]
        guard: layer.route.stack[0].handle,
    }));

const custom = (...permissions) => ({ id: 7, role: "CUSTOM", customRole: { permissions } });

const allowed = (guard, user) => {
    try {
        let passed = false;
        guard({ user }, {}, () => { passed = true; });
        return passed;
    } catch (error) {
        if (error.statuscode === 403) return false;
        throw error;
    }
};

test("every route is guarded and the expected set exists", () => {
    assert.deepEqual(
        routes.map((r) => `${r.method} ${r.path}`).sort(),
        ["GET /attendance-map", "GET /config", "GET /data", "GET /training",
            "POST /attendance-map", "POST /config", "POST /recalculate", "POST /training"]
    );
});

test("hr_meeting:read opens every GET and no POST", () => {
    const reader = custom("hr_meeting:read");
    for (const r of routes) {
        assert.equal(allowed(r.guard, reader), r.method === "GET", `${r.method} ${r.path}`);
    }
});

test("hr_meeting:update opens every POST", () => {
    const editor = custom("hr_meeting:read", "hr_meeting:update");
    for (const r of routes) assert.equal(allowed(r.guard, editor), true, `${r.method} ${r.path}`);
});

test("Morning Meeting permissions alone give no access", () => {
    const morning = custom("daily_meeting:read", "daily_meeting:update");
    for (const r of routes) assert.equal(allowed(r.guard, morning), false, `${r.method} ${r.path}`);
});

test("admins have full access", () => {
    for (const r of routes) {
        assert.equal(allowed(r.guard, { id: 1, role: "ADMIN", isAdmin: 1 }), true);
        assert.equal(allowed(r.guard, { id: 2, role: "SUPERADMIN" }), true);
    }
});
