// Run with: node --test --experimental-test-module-mocks test/tenCycleSheetModel.test.js
//
// Finding the 10 cycle sheets an operator is on (models/tenCycleSheet.model.js), with the
// database replaced by a stand-in.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const db = { queries: [], respond: () => [[]] };

mock.module("../db/mssqlHelper.js", {
    namedExports: {
        executeQuery: async (sql, params = []) => {
            db.queries.push({ sql, params });
            return db.respond(sql, params);
        }
    }
});
mock.module("../db/migrationHelper.js", {
    defaultExport: { tableExists: async () => true, ensureColumnExists: async () => {}, ensureIndexExists: async () => {} }
});

const { default: TenCycleSheet } = await import("../models/tenCycleSheet.model.js");
await new Promise((resolve) => setImmediate(resolve)); // let any import-time init() settle

test.beforeEach(() => {
    db.queries = [];
    db.respond = () => [[]];
});

test("an operator's sheets match on each row's Emp. Code exactly, with the matching row numbers", async () => {
    db.respond = (sql) => sql.includes("entries LIKE") ? [[
        { id: 1, departmentId: 2, entries: JSON.stringify([{ empCode: "E100" }, { empCode: "E200" }, { empCode: " e100" }]) },
        { id: 2, departmentId: 2, entries: JSON.stringify([{ empCode: "E1000", remarks: "trained with E100" }]) },
        { id: 3, departmentId: 3, entries: JSON.stringify([{ empCode: "E300" }, { empCode: "E100" }]) },
    ]] : [[]];

    const sheets = await TenCycleSheet.findByOperatorCode(" E100 ");
    const query = db.queries.at(-1);
    assert.ok(query.sql.includes("WHERE entries LIKE ? ESCAPE '!'"));
    assert.deepEqual(query.params, ["%E100%"]);

    // Sheet 2 only has E100 inside a longer code / free text, so it is dropped.
    assert.deepEqual(sheets.map(s => [s.id, s.rowNumbers]), [[1, [1, 3]], [3, [2]]]);
});

test("LIKE wildcards in the code are escaped, and an empty code runs no query", async () => {
    await TenCycleSheet.findByOperatorCode("A_1%[!");
    assert.equal(db.queries.at(-1).params[0], "%A!_1!%![!!%");

    db.queries = [];
    assert.deepEqual(await TenCycleSheet.findByOperatorCode(""), []);
    assert.deepEqual(await TenCycleSheet.findByOperatorCode(null), []);
    assert.equal(db.queries.length, 0);
});
