// Run with: node --test --experimental-test-module-mocks test/daily5mAccess.test.js
//
// Who may read and who may write Daily 5M sheets (controllers/daily5MRecord.controller.js), with the
// database replaced by a stand-in. Everyone with daily5m:read can view every department's sheets on
// the dashboard, but writes stay limited to the user's own departments (plus routed approvers).
import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Department 1 routes its 5M approvals to department 3; department 2 has no routing.
const departments = {
    1: { id: 1, name: "Assembly", daily5mApproverDeptId: 3 },
    2: { id: 2, name: "Crimping" },
    3: { id: 3, name: "Quality" },
};

// What the stand-in database holds, set by each test.
const db = { record: null, sessionRow: null, saved: [], statusUpdates: [] };

mock.module("../models/daily5MRecord.model.js", {
    defaultExport: {
        findById: async () => db.record,
        upsert: async (input) => { db.saved.push(input); return { id: 99, sessionId: input.sessionId || 99, ...input }; },
        updateStatus: async (id, status) => { db.statusUpdates.push({ id, status }); return true; },
        findAll: async () => ({ records: [], totalCount: 0 }),
        getStats: async () => [],
        getRowStats: async () => ({}),
    }
});
mock.module("../models/department.model.js", { defaultExport: { findById: async (id) => departments[id] || null } });
mock.module("../models/section.model.js", { defaultExport: { findById: async () => null } });
mock.module("../db/mssqlHelper.js", {
    namedExports: { executeQuery: async () => [db.sessionRow ? [db.sessionRow] : []] }
});
mock.module("../utils/auditLogger.js", { defaultExport: async () => {} });
mock.module("../services/notification.service.js", { defaultExport: { sendFormReport: async () => {} } });
mock.module("../middlewares/roleAuth.middleware.js", {
    namedExports: {
        hasAnyPermission: (user, permissions) =>
            user?.role === "SUPERADMIN" || permissions.some((p) => user?.customRole?.permissions?.includes(p)),
    }
});

const controller = await import("../controllers/daily5MRecord.controller.js");

const customUser = (id, departmentId, permissions = ["daily5m:read", "daily5m:update"]) => ({
    id, role: "CUSTOM", departmentId, departments: [], sectionId: null, sections: [],
    customRole: { permissions },
});
const assembler = customUser(10, 1);             // assigned to department 1
const otherAssembler = customUser(11, 1);
const crimper = customUser(20, 2);               // daily5m:read, but only assigned to department 2
const noReadCrimper = customUser(21, 2, []);     // no daily5m:read
const qualityApprover = customUser(30, 3);       // department 1's routed approver
const admin = { id: 1, role: "ADMIN", isAdmin: true };

const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Runs a controller handler; resolves with { status, body } or { error } (what next() received).
const call = (handler, { user, params = {}, query = {}, body = {} }) => new Promise((resolve) => {
    const res = {
        status(code) { this.code = code; return this; },
        json(payload) { resolve({ status: this.code, body: payload }); },
    };
    handler({ user, params, query, body, headers: {}, ip: "127.0.0.1" }, res, (error) => resolve({ error }));
});

const saveSession = (user, { departmentId = "1", sectionId = null, sessionId = 7 } = {}) => call(controller.create5MRecord, {
    user,
    body: { departmentId, sectionId, date: todayStr, formType: "standard", recordData: { rec_0_Line: "L1" }, sessionId },
});

test.beforeEach(() => {
    db.saved = [];
    db.statusUpdates = [];
    db.record = { id: 7, sessionId: 7, departmentId: "1", sectionId: null, submittedBy: "10", recordData: {} };
    db.sessionRow = { recordData: "{}", submittedBy: "10", date: todayStr, status: "PENDING", departmentId: "1", sectionId: null };
});

test("a user can save a session of their own department", async () => {
    const result = await saveSession(assembler);
    assert.equal(result.status, 201);
    assert.equal(db.saved.length, 1);
});

test("daily5m:read lets a user view, not save, another department's session", async () => {
    const result = await saveSession(crimper);
    assert.equal(result.error?.statuscode, 403);
    assert.equal(db.saved.length, 0);
});

test("the stored department decides access, not the department the client sends", async () => {
    const result = await saveSession(crimper, { departmentId: "2" });
    assert.equal(result.error?.statuscode, 403);
    assert.equal(db.saved.length, 0);
});

test("a session cannot be moved into a department the user is not assigned to", async () => {
    const result = await saveSession(assembler, { departmentId: "2" });
    assert.equal(result.error?.statuscode, 403);
    assert.equal(db.saved.length, 0);
});

test("a routed approver may save an existing session but not start one in the source department", async () => {
    assert.equal((await saveSession(qualityApprover)).status, 201);

    db.sessionRow = null;
    const created = await saveSession(qualityApprover, { sessionId: null });
    assert.equal(created.error?.statuscode, 403);
});

test("new sessions are limited to the user's own departments", async () => {
    db.sessionRow = null;
    assert.equal((await saveSession(assembler, { sessionId: null })).status, 201);
    assert.equal((await saveSession(crimper, { sessionId: null })).error?.statuscode, 403);
});

test("admins can save any department's session", async () => {
    assert.equal((await saveSession(admin, { departmentId: "2" })).status, 201);
});

test("submit and send-email need write access to the record", async () => {
    assert.equal((await call(controller.submit5MRecord, { user: crimper, params: { id: 7 } })).error?.statuscode, 403);
    assert.equal((await call(controller.send5MEmail, { user: crimper, params: { id: 7 } })).error?.statuscode, 403);
    assert.deepEqual(db.statusUpdates, []);

    assert.equal((await call(controller.submit5MRecord, { user: assembler, params: { id: 7 } })).status, 200);
});

test("whole-record approve follows write access, self-approval and routing rules", async () => {
    // Outside the department: no write access
    assert.equal((await call(controller.approve5MRecord, { user: crimper, params: { id: 7 } })).error?.statuscode, 403);
    // The submitter can't approve their own sheet
    assert.match((await call(controller.approve5MRecord, { user: assembler, params: { id: 7 } })).error?.message, /own submission/);
    // Department 1 routes approvals to department 3, so a colleague in department 1 can't approve
    assert.equal((await call(controller.decline5MRecord, { user: otherAssembler, params: { id: 7 } })).error?.statuscode, 403);
    // The routed approver can
    assert.equal((await call(controller.approve5MRecord, { user: qualityApprover, params: { id: 7 } })).status, 200);
    assert.deepEqual(db.statusUpdates, [{ id: 7, status: "APPROVED" }]);
});

test("opening another department's sheet is view-only with daily5m:read and refused without it", async () => {
    const viewer = await call(controller.get5MRecordById, { user: crimper, params: { id: 7 } });
    assert.equal(viewer.status, 200);
    assert.equal(viewer.body.viewOnly, true);
    assert.equal(viewer.body.routedAccess.department.id, 1);

    const own = await call(controller.get5MRecordById, { user: assembler, params: { id: 7 } });
    assert.equal(own.body.viewOnly, false);

    const refused = await call(controller.get5MRecordById, { user: noReadCrimper, params: { id: 7 } });
    assert.equal(refused.error?.statuscode, 403);
});

test("the dashboard's all-departments scope needs daily5m:read", async () => {
    const list = await call(controller.get5MRecords, { user: crimper, params: { departmentId: "all" }, query: { scope: "all" } });
    assert.equal(list.status, 200);

    const stats = await call(controller.getDaily5MStats, { user: crimper, params: { departmentId: "1" }, query: { scope: "all" } });
    assert.equal(stats.status, 200);

    const refused = await call(controller.getDaily5MRowStats, { user: noReadCrimper, params: { departmentId: "all" }, query: { scope: "all" } });
    assert.equal(refused.error?.statuscode, 403);

    // Without scope=all the user's own assignment still applies
    const scoped = await call(controller.getDaily5MStats, { user: crimper, params: { departmentId: "1" }, query: {} });
    assert.equal(scoped.error?.statuscode, 403);
});
