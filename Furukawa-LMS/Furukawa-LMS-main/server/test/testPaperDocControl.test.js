// Run with: node --test --experimental-test-module-mocks test/testPaperDocControl.test.js
//
// Test paper document control (utils/testPaperDocControl.util.js): who may set per-paper
// values, how request values are cleaned, and which values a paper / attempt prints.
// Uses the real permission rules (roleAuth.middleware + rolesPermissions.controller);
// only the database and the Revision Table lookup are replaced.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const noop = () => {};
const revision = { record: null, throws: false, calls: [] };

mock.module("../db/mssqlHelper.js", { namedExports: { executeQuery: async () => [[]] } });
mock.module("../logger/winston.logger.js", { defaultExport: { info: noop, warn: noop, error: noop } });
mock.module("../models/customRole.model.js", { defaultExport: class CustomRole {} });
mock.module("../models/revisionRecord.model.js", {
    defaultExport: {
        findLatestForScope: async (...args) => {
            revision.calls.push(args);
            if (revision.throws) throw new Error("db down");
            return revision.record;
        }
    }
});

const {
    canManageDocControl, normalizeDocField, pickDocControl,
    resolveTestPaperDocControl, toAttemptSnapshot, resolveAttemptDocControl, LEGACY_DOC_CONTROL
} = await import("../utils/testPaperDocControl.util.js");

test.beforeEach(() => {
    revision.record = null;
    revision.throws = false;
    revision.calls = [];
});

const holder = { role: "CUSTOM", customRole: { permissions: ["test_paper:doc_control"] } };
const nonHolder = { role: "CUSTOM", customRole: { permissions: ["test_paper:edit"] } };

test("permission: admins and holders can manage; trainers and other custom roles cannot", () => {
    assert.equal(canManageDocControl({ role: "SUPERADMIN" }), true);
    assert.equal(canManageDocControl({ role: "ADMIN" }), true);
    assert.equal(canManageDocControl(holder), true);
    assert.equal(canManageDocControl({ role: "INSTRUCTOR", isTrainer: true }), false);
    assert.equal(canManageDocControl(nonHolder), false);
    assert.equal(canManageDocControl(null), false);
});

test("normalizeDocField: not-sent stays undefined, blanks become null, values trimmed and capped", () => {
    assert.equal(normalizeDocField(undefined), undefined);
    assert.equal(normalizeDocField(null), null);
    assert.equal(normalizeDocField(""), null);
    assert.equal(normalizeDocField("   "), null);
    assert.equal(normalizeDocField("  TST-QA-05 "), "TST-QA-05");
    assert.equal(normalizeDocField(3), "3");
    assert.equal(normalizeDocField("x".repeat(300)).length, 255);
});

test("pickDocControl ignores everything from users without the permission", () => {
    assert.deepEqual(pickDocControl(nonHolder, { hasOwnDocControl: true, docNo: "HACK" }), {});
});

test("pickDocControl returns only the fields that were sent, normalized", () => {
    assert.deepEqual(pickDocControl(holder, { hasOwnDocControl: true, docNo: " A-1 ", revNo: "" }),
        { hasOwnDocControl: 1, docNo: "A-1", revNo: null });
    assert.deepEqual(pickDocControl(holder, { hasOwnDocControl: false }), { hasOwnDocControl: 0 });
    assert.deepEqual(pickDocControl(holder, { title: "x" }), {});
});

test("own mode prints the paper's values (blank stays blank) and skips the Revision Table", async () => {
    const quiz = { hasOwnDocControl: true, docNo: "TST-QA-05", revNo: "03", issueDate: null, revDate: "15.06.2024" };
    assert.deepEqual(await resolveTestPaperDocControl(quiz, { departmentId: 4 }),
        { docNo: "TST-QA-05", revNo: "03", issueDate: null, revDate: "15.06.2024" });
    assert.equal(revision.calls.length, 0);
});

test("department-wise mode uses the Revision Table for the candidate's scope", async () => {
    revision.record = { docNo: "DEPT-A", revNo: "05", issueDate: "01.01.2025", revDate: "02.02.2025" };
    const quiz = { hasOwnDocControl: false, docNo: "IGNORED" };
    assert.deepEqual(await resolveTestPaperDocControl(quiz, { departmentId: 4, sectionId: 9 }),
        { docNo: "DEPT-A", revNo: "05", issueDate: "01.01.2025", revDate: "02.02.2025" });
    assert.deepEqual(revision.calls[0], ["test-paper", 4, 9]);
});

test("department-wise mode falls back to the legacy values per empty field, and when the lookup fails", async () => {
    revision.record = { docNo: "DEPT-A", revNo: null, issueDate: "", revDate: "02.02.2025" };
    assert.deepEqual(await resolveTestPaperDocControl({ hasOwnDocControl: false }),
        { docNo: "DEPT-A", revNo: "02", issueDate: "08.04.2021", revDate: "02.02.2025" });

    revision.throws = true;
    assert.deepEqual(await resolveTestPaperDocControl({ hasOwnDocControl: false }), { ...LEGACY_DOC_CONTROL });
});

test("attempt snapshot stores blanks as '' so a taken snapshot is never mistaken for a missing one", async () => {
    const snap = toAttemptSnapshot({ docNo: "A-1", revNo: null, issueDate: null, revDate: null });
    assert.deepEqual(snap, { quizDocNo: "A-1", quizRevNo: "", quizIssueDate: "", quizRevDate: "" });

    // Paper later changed — the attempt keeps what it printed.
    const quizNow = { hasOwnDocControl: true, docNo: "A-2", revNo: "09" };
    assert.deepEqual(await resolveAttemptDocControl(snap, quizNow),
        { docNo: "A-1", revNo: null, issueDate: null, revDate: null });

    const allBlank = toAttemptSnapshot({ docNo: null, revNo: null, issueDate: null, revDate: null });
    assert.deepEqual(await resolveAttemptDocControl(allBlank, quizNow),
        { docNo: null, revNo: null, issueDate: null, revDate: null });
});

test("attempt without any snapshot resolves live from the student's department", async () => {
    revision.record = { docNo: "DEPT-B", revNo: "01", issueDate: "x", revDate: "y" };
    const attempt = { quizDocNo: null, quizRevNo: null, quizIssueDate: null, quizRevDate: null, studentDeptId: 7, studentSectionId: null };
    assert.deepEqual(await resolveAttemptDocControl(attempt, { hasOwnDocControl: false }),
        { docNo: "DEPT-B", revNo: "01", issueDate: "x", revDate: "y" });
    assert.deepEqual(revision.calls[0], ["test-paper", 7, null]);
});
