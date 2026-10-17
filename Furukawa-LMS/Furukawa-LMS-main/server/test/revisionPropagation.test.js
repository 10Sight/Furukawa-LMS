import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Run with: node --experimental-test-module-mocks --test test/revisionPropagation.test.js
const queries = [];
let affectedRows = 0;
let countResult = 0;

mock.module("../db/mssqlHelper.js", {
    namedExports: {
        executeQuery: async (sql, params) => {
            queries.push({ sql, params });
            if (/^\s*SELECT COUNT/.test(sql)) return [[{ total: countResult }], {}];
            return [[], { affectedRows }];
        },
    },
});
mock.module("../logger/winston.logger.js", {
    defaultExport: { info: () => {}, error: () => {}, warn: () => {} },
});

const { default: RevisionPropagationService } = await import("../services/revisionPropagation.service.js");

const placeholders = (sql) => (sql.match(/\?/g) || []).length;
const record = (overrides) => ({
    id: 7,
    sheetKey: "multi-skilling-plan",
    departmentId: null,
    sectionId: null,
    docNo: "FRM-1",
    revNo: "04",
    issueDate: "01.06.09",
    revDate: "17.10.2026",
    ...overrides,
});

beforeEach(() => {
    queries.length = 0;
    affectedRows = 0;
    countResult = 0;
});

test("global record updates every row not claimed by a department or section override", async () => {
    affectedRows = 12;
    const count = await RevisionPropagationService.propagate(record());

    assert.equal(count, 12);
    assert.equal(queries.length, 1);
    const { sql, params } = queries[0];
    assert.match(sql, /UPDATE t SET t\.docNo = \?, t\.revNo = \?, t\.issueDate = \?, t\.revDate = \? FROM multi_skilling_plans t/);
    assert.match(sql, /NOT EXISTS \(\s*SELECT 1 FROM \[revision_records\] o\s*WHERE o\.sheetKey = \? AND o\.departmentId = t\.departmentId\s*AND \(o\.sectionId IS NULL OR o\.sectionId = t\.sectionId\)/);
    assert.deepEqual(params, ["FRM-1", "04", "01.06.09", "17.10.2026", "multi-skilling-plan"]);
    assert.equal(placeholders(sql), params.length);
});

test("department override updates its department, minus rows claimed by a section override", async () => {
    await RevisionPropagationService.propagate(record({ departmentId: 3 }));

    const { sql, params } = queries[0];
    assert.match(sql, /WHERE t\.departmentId = \? AND NOT EXISTS \(\s*SELECT 1 FROM \[revision_records\] o\s*WHERE o\.sheetKey = \? AND o\.departmentId = \? AND o\.sectionId = t\.sectionId/);
    assert.deepEqual(params.slice(4), [3, "multi-skilling-plan", 3]);
    assert.equal(placeholders(sql), params.length);
});

test("department+section override updates exactly that department and section", async () => {
    await RevisionPropagationService.propagate(record({ departmentId: 3, sectionId: 9 }));

    const { sql, params } = queries[0];
    assert.match(sql, /WHERE t\.departmentId = \? AND t\.sectionId = \?$/);
    assert.doesNotMatch(sql, /NOT EXISTS/);
    assert.deepEqual(params.slice(4), [3, 9]);
});

test("cleared fields are written as NULL, mirroring the record", async () => {
    await RevisionPropagationService.propagate(record({ issueDate: "", revDate: undefined }));
    assert.deepEqual(queries[0].params.slice(0, 4), ["FRM-1", "04", null, null]);
});

test("student-scoped sheets resolve department/section through the student", async () => {
    await RevisionPropagationService.propagate(record({ sheetKey: "sixteen-day-monitoring", departmentId: 3 }));

    const { sql } = queries[0];
    assert.match(sql, /FROM sixteen_day_monitorings t JOIN users u ON u\.id = t\.studentId/);
    assert.match(sql, /WHERE u\.departmentId = \? AND NOT EXISTS[\s\S]*o\.sectionId = u\.sectionId/);
});

test("daily-5m casts its NVARCHAR department/section, 10-cycle treats section 0 as none", async () => {
    await RevisionPropagationService.propagate(record({ sheetKey: "daily-5m", departmentId: 3, sectionId: 9 }));
    assert.match(queries[0].sql, /TRY_CAST\(t\.departmentId AS INT\) = \? AND TRY_CAST\(t\.sectionId AS INT\) = \?/);

    await RevisionPropagationService.propagate(record({ sheetKey: "ten-cycle-sheet", departmentId: 3, sectionId: 9 }));
    assert.match(queries[1].sql, /NULLIF\(t\.sectionId, 0\) = \?/);
});

test("daily production report finds its section through the line", async () => {
    await RevisionPropagationService.propagate(record({ sheetKey: "daily-production-report" }));
    assert.match(queries[0].sql, /FROM daily_production_reports t LEFT JOIN \[lines\] l ON l\.id = t\.line_id/);
    assert.match(queries[0].sql, /o\.departmentId = t\.department_id\s*AND \(o\.sectionId IS NULL OR o\.sectionId = l\.sectionId\)/);
});

test("JSON-metadata sheets rewrite each key in place and skip malformed metadata", async () => {
    await RevisionPropagationService.propagate(record({ sheetKey: "handover-sheet", departmentId: 3 }));

    const { sql, params } = queries[0];
    assert.match(sql, /SET t\.metadata = JSON_MODIFY\(JSON_MODIFY\(JSON_MODIFY\(JSON_MODIFY\(ISNULL\(NULLIF\(t\.metadata, ''\), '\{\}'\), '\$\.docNo', \?\), '\$\.revNo', \?\), '\$\.issueDate', \?\), '\$\.revDate', \?\)/);
    assert.match(sql, /AND ISJSON\(ISNULL\(NULLIF\(t\.metadata, ''\), '\{\}'\)\) = 1$/);
    assert.equal(placeholders(sql), params.length);
});

test("abnormal condition has no section, so a department override claims the whole department", async () => {
    await RevisionPropagationService.propagate(record({ sheetKey: "abnormal-condition", departmentId: 3 }));
    // `o.sectionId = NULL` is never true, so no section override can exclude a row.
    assert.match(queries[0].sql, /o\.sectionId = NULL/);
});

test("sheets that keep no copy are a no-op", async () => {
    assert.equal(await RevisionPropagationService.propagate(record({ sheetKey: "skill-matrix" })), 0);
    assert.equal(await RevisionPropagationService.countAffected("skill-matrix", 3, null), 0);
    assert.equal(queries.length, 0);
    assert.equal(RevisionPropagationService.isPropagated("skill-matrix"), false);
    assert.equal(RevisionPropagationService.isPropagated("handover-sheet"), true);
});

test("countAffected uses the same scope filter as propagate", async () => {
    countResult = 37;
    assert.equal(await RevisionPropagationService.countAffected("multi-skilling-plan", 3, null), 37);
    await RevisionPropagationService.propagate(record({ departmentId: 3 }));

    const where = (sql) => sql.slice(sql.indexOf("WHERE"));
    assert.match(queries[0].sql, /^SELECT COUNT\(\*\) AS total FROM multi_skilling_plans t/);
    assert.equal(where(queries[0].sql), where(queries[1].sql));
    assert.deepEqual(queries[0].params, queries[1].params.slice(4));
});
