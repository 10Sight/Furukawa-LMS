// Run with: node --test --experimental-test-module-mocks test/daily5mRecordModel.test.js
//
// Daily 5M row-status counts (models/daily5MRecord.model.js) with the database replaced by a
// stand-in: what a save stores, how the records list filters by row status, and the one-time
// backfill of sheets saved before the count columns existed.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const db = { queries: [], respond: () => [[]] };
const noop = () => {};

mock.module("../db/mssqlHelper.js", {
    namedExports: {
        executeQuery: async (sql, params = []) => {
            db.queries.push({ sql, params });
            return db.respond(sql, params);
        }
    }
});
mock.module("../db/migrationHelper.js", {
    defaultExport: { tableExists: async () => true, ensureColumnExists: async () => {} }
});
mock.module("../logger/winston.logger.js", { defaultExport: { info: noop, warn: noop, error: noop } });
mock.module("../services/revisionRecord.service.js", { defaultExport: { getLatestForSheet: async () => null } });

const { default: Daily5MRecord } = await import("../models/daily5MRecord.model.js");
await new Promise((resolve) => setImmediate(resolve)); // let the import-time init() settle

test.beforeEach(() => {
    db.queries = [];
    db.respond = () => [[]];
});

const sheet = {
    rec_0_Line: "L1", rec_0_RowStatus: "APPROVED",
    rec_1_Line: "L1", rec_1_RowStatus: "REJECTED", rec_1_RejectReason: "Wrong lot",
    rec_2_Line: "L2",
};

test("a save stores the sheet's approved/rejected/pending row counts", async () => {
    db.respond = (sql) => sql.includes("INSERT INTO") ? [[{ id: 5 }]] : [[]];
    await Daily5MRecord.upsert({ departmentId: "1", date: "2026-10-22", recordData: sheet, submittedBy: "10", sessionId: null });

    const insert = db.queries.find(q => q.sql.includes("INSERT INTO"));
    assert.match(insert.sql, /approvedRowCount, rejectedRowCount, pendingRowCount/);
    assert.deepEqual(insert.params.slice(-3), [1, 1, 1]);
    assert.equal(insert.params[9], "DECLINED"); // aggregate status is unchanged by the refactor
});

test("the records list filters by row status on each session's latest row", async () => {
    await Daily5MRecord.findAll({ departmentId: "all", groupBySession: true, rowStatus: "rejected" });
    const list = db.queries.at(-1).sql;
    assert.match(list, /WHERE rn = 1 AND rejectedRowCount > 0/);

    await Daily5MRecord.findAll({ departmentId: "all", rowStatus: "pending" });
    assert.match(db.queries.at(-1).sql, /AND r\.pendingRowCount > 0/);
});

test("an unknown row-status value never reaches the SQL", async () => {
    await Daily5MRecord.findAll({ departmentId: "all", groupBySession: true, rowStatus: "x; DROP TABLE users" });
    assert.doesNotMatch(db.queries.at(-1).sql, /RowCount > 0|DROP/);
});

test("records list entries carry the per-row summary", async () => {
    db.respond = (sql) => sql.includes("LatestSessions")
        ? [[{ id: 7, sessionId: 7, departmentId: "1", recordData: JSON.stringify(sheet), totalCount: 1 }]]
        : [[]];
    const { records } = await Daily5MRecord.findAll({ departmentId: "all", groupBySession: true });
    assert.deepEqual(
        records[0].rowStatusSummary.rows.map(r => [r.rowNo, r.state]),
        [[1, "APPROVED"], [2, "REJECTED"], [3, "PENDING"]]
    );
});

test("the backfill fills NULL counts in batches and survives bad JSON", async () => {
    let batches = 0;
    db.respond = (sql) => {
        if (sql.startsWith("SELECT TOP")) {
            batches++;
            return batches === 1
                ? [[{ id: 1, recordData: JSON.stringify(sheet) }, { id: 2, recordData: "{not json" }]]
                : [[]];
        }
        return [[]];
    };
    await Daily5MRecord.backfillRowStatusCounts();

    const updates = db.queries.filter(q => q.sql.startsWith("UPDATE"));
    assert.deepEqual(updates.map(u => u.params), [[1, 1, 1, 1], [0, 0, 0, 2]]);
    assert.equal(batches, 2);
});
