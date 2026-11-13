// Run with: node --test --experimental-test-module-mocks test/itAccessControl.test.js
//
// IT Access Control Register: value validation, register rows (leavers, removal pending, plant
// location), the transactional save (version conflicts, change history), route guards, and the
// rule that the page and its permission are never granted by the MIS Portal key alone.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Scripted transaction: each conn.query is answered by the first handler whose pattern matches.
let txQueries = [];
let txHandlers = [];
const fakeConn = {
    query: async (sql, params = []) => {
        txQueries.push({ sql, params });
        const handler = txHandlers.find((h) => h.match.test(sql));
        return handler ? handler.reply(params) : [[], { affectedRows: 1 }];
    },
};

mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[]], runOnRequest: async () => [[]] } });
mock.module("../db/migrationHelper.js", {
    defaultExport: { tableExists: async () => true, ensureColumnExists: async () => false, ensureIndexExists: async () => false },
});
mock.module("../db/withTransaction.js", { defaultExport: async (fn) => fn(fakeConn) });
mock.module("../logger/winston.logger.js", { defaultExport: { info() {}, warn() {}, error() {}, debug() {} } });
mock.module("../middlewares/auth.middleware.js", { defaultExport: (req, res, next) => next() });

const fields = await import("../utils/itAccessControlFields.js");
const { default: ITAccessControl } = await import("../models/itAccessControl.model.js");
const { withPortalPagePermissions } = await import("../controllers/rolesPermissions.controller.js");
const { default: router } = await import("../routes/itAccessControl.routes.js");

// ---------- field values ----------

test("select values are matched case-insensitively and returned in canonical spelling", () => {
    assert.equal(fields.normalizeFieldValue("vpn", "yes"), "Yes");
    assert.equal(fields.normalizeFieldValue("desktopLaptop", " laptop "), "Laptop");
    assert.equal(fields.normalizeFieldValue("location", "GURGAON"), "Gurgaon");
});

test("blank clears a value (not recorded) instead of meaning No", () => {
    for (const blank of [null, undefined, "", "   "]) assert.equal(fields.normalizeFieldValue("usb", blank), null);
});

test("values outside the options, bad dates and unknown fields are rejected", () => {
    assert.throws(() => fields.normalizeFieldValue("vpn", "Maybe"), /VPN/);
    assert.throws(() => fields.normalizeFieldValue("emailDeletionDate", "2026-02-30"), /valid date/);
    assert.throws(() => fields.normalizeFieldValue("emailDeletionDate", "13/11/2026"), /valid date/);
    assert.throws(() => fields.normalizeFieldValue("isAdmin", "Yes"), /Unknown field/);
    assert.equal(fields.normalizeFieldValue("adDeletionDate", "2026-11-13"), "2026-11-13");
});

test("every field is a select with options, a date or a text, in a known group", () => {
    const groupKeys = new Set([...fields.GROUPS.map((g) => g.key), "identity"]);
    for (const f of fields.FIELDS) {
        assert.ok(groupKeys.has(f.group), f.key);
        assert.ok(f.type === "date" || f.type === "text" || (f.type === "select" && f.options.length > 0), f.key);
        assert.match(f.key, /^[a-zA-Z]+$/, "field keys are interpolated into SQL as column names");
    }
    assert.equal(fields.FIELDS.length, 26);
    assert.equal(fields.FIELDS.filter((f) => f.importable !== false).length, 25, "everything but the manual department imports");
});

test("text values are trimmed, spaces collapsed, blank clears and the length is limited", () => {
    assert.equal(fields.normalizeFieldValue("departmentManual", "  Tool   Room "), "Tool Room");
    assert.equal(fields.normalizeFieldValue("departmentManual", "   "), null);
    assert.throws(() => fields.normalizeFieldValue("departmentManual", "x".repeat(101)), /at most 100/);
    assert.equal(fields.columnType(fields.getField("departmentManual")), "NVARCHAR(100) NULL");
});

// ---------- department ----------

const DEPTS = new Map([[10, "Production"], [11, "Quality"], [12, "IT"]]);

test("department comes from users.departments (every id), then departmentId, then the legacy text", () => {
    assert.deepEqual(fields.resolveUserDepartments({ departments: "[10, 11]" }, DEPTS), ["Production", "Quality"]);
    assert.deepEqual(fields.resolveUserDepartments({ departments: "[\"12\", 12]" }, DEPTS), ["IT"], "string ids, duplicates");
    assert.deepEqual(fields.resolveUserDepartments({ departments: "[99]", departmentId: 10 }, DEPTS), ["Production"], "deleted id falls back");
    assert.deepEqual(fields.resolveUserDepartments({ departments: "not json", departmentName: "Stores" }, DEPTS), ["Stores"]);
    assert.deepEqual(fields.resolveUserDepartments({ departments: "[]", departmentText: " Old  Dept " }, DEPTS), ["Old Dept"]);
    assert.deepEqual(fields.resolveUserDepartments({ departments: null }, DEPTS), []);
});

test("a manual department is shown only when the users table has none", () => {
    const base = { userId: 9, empId: "ST9", status: "PRESENT", departmentManual: "Tool Room" };
    const manual = fields.buildRegisterRow({ ...base, departments: "[]" }, DEPTS);
    assert.equal(manual.department, "Tool Room");
    assert.equal(manual.departmentSource, "manual");

    const real = fields.buildRegisterRow({ ...base, departments: "[10, 11]" }, DEPTS);
    assert.equal(real.department, "Production, Quality");
    assert.deepEqual(real.departmentList, ["Production", "Quality"]);
    assert.equal(real.departmentSource, "users", "HR's department wins over the manual text");
    assert.equal(real.values.departmentManual, "Tool Room", "the manual text is kept, just not shown");

    const none = fields.buildRegisterRow({ ...base, departmentManual: null }, DEPTS);
    assert.equal(none.department, "");
    assert.equal(none.departmentSource, null);
});

// ---------- register rows ----------

const userRow = (over = {}) => ({
    userId: 5, empId: " ST0012 ", fullName: "A Person", designation: "Engineer", departmentName: "IT",
    status: "PRESENT", joiningDate: "Sep 19 2024 12:00AM", leavingDate: null, unit: "bawal", version: null, ...over,
});

test("rows normalize users dates, trim the empId and map the plant to a location option", () => {
    const row = fields.buildRegisterRow(userRow());
    assert.equal(row.empId, "ST0012");
    assert.equal(row.joiningDate, "2024-09-19");
    assert.equal(row.defaultLocation, "Bawal");
    assert.equal(row.version, 0);
    assert.equal(row.values.vpn, null);
    assert.equal(row.pendingRemoval, false);
    assert.equal(fields.buildRegisterRow(userRow({ unit: "Pune" })).defaultLocation, null);
});

test("a leaver is pending removal until both Email and AD deletion are recorded", () => {
    const left = { status: "LEFT", joiningDate: "2024-01-01", leavingDate: "2026-10-31" };
    assert.equal(fields.buildRegisterRow(userRow(left)).pendingRemoval, true);
    assert.equal(fields.buildRegisterRow(userRow({ ...left, emailDeletionDate: "2026-11-01" })).pendingRemoval, true);
    assert.equal(fields.buildRegisterRow(userRow({ ...left, emailDeletionDate: "2026-11-01", adDeletionDate: "2026-11-02" })).pendingRemoval, false);
});

test("removal dates from before a re-joining do not count for the current period", () => {
    const rejoinedAndLeft = { status: "LEFT", joiningDate: "2026-03-01", emailDeletionDate: "2025-06-01", adDeletionDate: "2025-06-01" };
    assert.equal(fields.buildRegisterRow(userRow(rejoinedAndLeft)).pendingRemoval, true);
});

// ---------- save ----------

const actor = { id: 1, name: "IT Admin" };
const staffUser = { match: /FROM users u/, reply: () => [[{ id: 5, empId: "ST0012" }]] };

test("prepareRows rejects malformed bodies before touching the database", () => {
    assert.throws(() => ITAccessControl.prepareRows(null), /rows array/);
    assert.throws(() => ITAccessControl.prepareRows([{ userId: 5, values: { vpn: "Yes" } }, { userId: 5, values: {} }]), /appears twice/);
    assert.throws(() => ITAccessControl.prepareRows([{ userId: 5, values: { "vpn = 'Yes'; --": "Yes" } }]), /unknown field/);
    assert.throws(() => ITAccessControl.prepareRows([{ userId: 5, values: { vpn: "Sure" } }]), /Row 1: VPN/);
});

test("first save inserts the record at version 1 and logs one history row per field", async () => {
    txQueries = [];
    txHandlers = [staffUser, { match: /WITH \(UPDLOCK, HOLDLOCK\)/, reply: () => [[]] }];
    const result = await ITAccessControl.saveRows([{ userId: 5, version: 0, values: { vpn: "yes", location: "Gurgaon" } }], actor);
    assert.deepEqual(result, { saved: 1, changes: 2 });

    const insert = txQueries.find((q) => /INSERT INTO it_access_control_records/.test(q.sql));
    assert.ok(insert);
    assert.match(insert.sql, /userId, vpn, location, version/);
    assert.deepEqual(insert.params, [5, "Yes", "Gurgaon", 1, "IT Admin"]);

    const history = txQueries.filter((q) => /INSERT INTO it_access_control_history/.test(q.sql));
    assert.deepEqual(history.map((q) => q.params.slice(2, 5)), [["vpn", null, "Yes"], ["location", null, "Gurgaon"]]);
    assert.ok(history.every((q) => q.params[7] === null), "edits made on the page have no source");
});

test("an import's source is stored on every history row it writes", async () => {
    txQueries = [];
    txHandlers = [staffUser, { match: /UPDLOCK/, reply: () => [[]] }];
    await ITAccessControl.saveRows([{ userId: 5, version: 0, values: { vpn: "Yes", usb: "No" } }], actor, { source: "import:Q3.xlsx" });
    const history = txQueries.filter((q) => /INSERT INTO it_access_control_history/.test(q.sql));
    assert.equal(history.length, 2);
    assert.ok(history.every((q) => q.params[7] === "import:Q3.xlsx"));
});

test("unchanged values are neither written nor logged", async () => {
    txQueries = [];
    txHandlers = [staffUser, { match: /UPDLOCK/, reply: () => [[{ vpn: "Yes", usb: "No", version: 3 }]] }];
    const result = await ITAccessControl.saveRows([{ userId: 5, version: 3, values: { vpn: "Yes", usb: "Yes" } }], actor);
    assert.deepEqual(result, { saved: 1, changes: 1 });
    const update = txQueries.find((q) => /UPDATE it_access_control_records/.test(q.sql));
    assert.match(update.sql, /SET usb = \?,/);
    assert.doesNotMatch(update.sql, /vpn = \?/);
    assert.match(update.sql, /version = version \+ 1/);
    const history = txQueries.filter((q) => /it_access_control_history/.test(q.sql));
    assert.deepEqual(history.map((q) => q.params.slice(2, 5)), [["usb", "No", "Yes"]]);
});

test("a row saved by someone else since the page loaded fails the whole save with 409", async () => {
    txQueries = [];
    txHandlers = [staffUser, { match: /UPDLOCK/, reply: () => [[{ vpn: "No", version: 4 }]] }];
    await assert.rejects(
        ITAccessControl.saveRows([{ userId: 5, version: 3, values: { vpn: "Yes" } }], actor),
        (error) => error.statuscode === 409 && /ST0012/.test(error.message)
    );
    assert.equal(txQueries.some((q) => /UPDATE|INSERT/.test(q.sql)), false);
});

test("a manual department is saved and logged for an employee with no department", async () => {
    txQueries = [];
    txHandlers = [
        { match: /FROM users u/, reply: () => [[{ id: 5, empId: "ST0012", departments: "[]", departmentId: null, departmentName: null, departmentText: null }]] },
        { match: /UPDLOCK/, reply: () => [[]] },
    ];
    const result = await ITAccessControl.saveRows([{ userId: 5, version: 0, values: { departmentManual: " Tool  Room " } }], actor);
    assert.deepEqual(result, { saved: 1, changes: 1 });
    const history = txQueries.filter((q) => /it_access_control_history/.test(q.sql));
    assert.deepEqual(history.map((q) => q.params.slice(2, 5)), [["departmentManual", null, "Tool Room"]]);
});

test("a manual department is refused when employee records already have one; clearing is allowed", async () => {
    txQueries = [];
    txHandlers = [
        { match: /FROM users u/, reply: () => [[{ id: 5, empId: "ST0012", departments: "[]", departmentId: 3, departmentName: "Quality" }]] },
        { match: /UPDLOCK/, reply: () => [[{ departmentManual: "Old", version: 1 }]] },
    ];
    await assert.rejects(
        ITAccessControl.saveRows([{ userId: 5, version: 1, values: { departmentManual: "Tool Room" } }], actor),
        (error) => error.statuscode === 400 && /already has a department/.test(error.message)
    );
    const cleared = await ITAccessControl.saveRows([{ userId: 5, version: 1, values: { departmentManual: "" } }], actor);
    assert.deepEqual(cleared, { saved: 1, changes: 1 });
});

test("only ST employees can be saved", async () => {
    txHandlers = [{ match: /FROM users u/, reply: () => [[]] }];
    await assert.rejects(
        ITAccessControl.saveRows([{ userId: 9, version: 0, values: { vpn: "Yes" } }], actor),
        (error) => error.statuscode === 400
    );
});

// ---------- routes ----------

const routes = router.stack.filter((l) => l.route).map((l) => ({
    key: `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`,
    guard: l.route.stack[0].handle,
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

test("routes: read opens GETs, update opens the save, other MIS permissions open nothing", () => {
    assert.deepEqual(routes.map((r) => r.key).sort(), ["GET /", "GET /history/:userId", "PUT /"]);
    for (const r of routes) {
        assert.equal(allowed(r.guard, custom("it_access_control:read")), r.key.startsWith("GET"), r.key);
        assert.equal(allowed(r.guard, custom("it_access_control:read", "it_access_control:update")), true, r.key);
        assert.equal(allowed(r.guard, custom("daily_meeting:read", "hr_meeting:update", "monthly_report:read")), false, r.key);
        assert.equal(allowed(r.guard, { id: 1, role: "ADMIN", isAdmin: 1 }), true, r.key);
    }
});

// ---------- explicit grant ----------

test("the MIS Portal key alone grants the other MIS pages' permissions but not IT Access Control", () => {
    const perms = withPortalPagePermissions(["daily-meeting"], []);
    assert.ok(perms.includes("hr_meeting:read"));
    assert.ok(perms.includes("daily_meeting:read"));
    assert.ok(perms.includes("monthly_report:read"));
    assert.equal(perms.includes("it_access_control:read"), false);
});

test("ticking IT Access Control grants its permission and keeps the portal-only expansion", () => {
    const perms = withPortalPagePermissions(["daily-meeting", "mis-it-access-control"], []);
    assert.ok(perms.includes("it_access_control:read"));
    assert.ok(perms.includes("hr_meeting:read"), "holding the explicit page must not drop the rest of the portal");
    const only = withPortalPagePermissions(["mis-hr-meeting"], []);
    assert.equal(only.includes("it_access_control:read"), false);
});
