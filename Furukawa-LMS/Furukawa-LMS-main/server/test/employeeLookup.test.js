// Run with: node --test --experimental-test-module-mocks test/employeeLookup.test.js
//
// Quiz submission maps a typed candidate to a registered user and never creates one;
// user-creating endpoints reject an Employee Code that an active user already holds.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

// Each test sets the rows the stand-in database returns; every query is recorded.
const db = { rows: [], queries: [] };

mock.module("../db/mssqlHelper.js", {
    namedExports: {
        executeQuery: async (sql, params) => {
            db.queries.push({ sql, params });
            return [db.rows, []];
        },
    },
});

const { resolveQuizCandidate, assertEmpIdAvailable } = await import("../utils/employeeLookup.js");

const reset = (rows = []) => { db.rows = rows; db.queries = []; };

const rejectsWith = (status, pattern) => (err) => err.statuscode === status && pattern.test(err.message);

test("typo'd code TRO81053 resolves to the registered TR081053", async () => {
    reset([{ id: 7 }]);
    assert.equal(await resolveQuizCandidate({ candidateName: "Pawan", eCode: " tro81053 " }), 7);
    assert.deepEqual(db.queries[0].params, ["TR081053", "TR081053"]);
    assert.match(db.queries[0].sql, /ISNULL\(isDeleted, 0\) = 0/);
});

test("unknown code is rejected with 400 and nothing is inserted", async () => {
    reset([]);
    await assert.rejects(
        resolveQuizCandidate({ candidateName: "Ghost", eCode: "TR999999" }),
        rejectsWith(400, /Candidate 'Ghost' with Employee Code 'TR999999' is not registered/)
    );
    assert.ok(db.queries.every((q) => !/INSERT/i.test(q.sql)));
});

test("a code held by two active users is reported instead of guessing", async () => {
    reset([{ id: 1 }, { id: 2 }]);
    await assert.rejects(resolveQuizCandidate({ candidateName: "Pawan", eCode: "TR081053" }), rejectsWith(409, /More than one user/));
});

test("name-only lookup needs exactly one active student", async () => {
    reset([{ id: 4 }]);
    assert.equal(await resolveQuizCandidate({ candidateName: " Ravi ", eCode: "" }), 4);
    assert.deepEqual(db.queries[0].params, ["Ravi"]);

    reset([{ id: 4 }, { id: 5 }]);
    await assert.rejects(resolveQuizCandidate({ candidateName: "Ravi", eCode: "" }), rejectsWith(400, /enter the Employee Code/));

    reset([]);
    await assert.rejects(resolveQuizCandidate({ candidateName: "Ravi" }), rejectsWith(400, /not registered/));
});

test("assertEmpIdAvailable rejects a taken code and skips blank codes", async () => {
    reset([{ fullName: "Pawan" }]);
    await assert.rejects(assertEmpIdAvailable("tro81053"), rejectsWith(400, /TR081053 is already registered to Pawan/));

    reset([]);
    await assertEmpIdAvailable("TR123456");

    reset([{ fullName: "x" }]);
    await assertEmpIdAvailable("  ");
    assert.equal(db.queries.length, 0);
});
