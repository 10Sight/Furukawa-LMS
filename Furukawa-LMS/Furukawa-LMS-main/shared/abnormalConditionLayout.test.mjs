import test from "node:test";
import assert from "node:assert/strict";
import {
    DEFAULT_ABNORMAL_CONDITION_LAYOUT,
    ABNORMAL_CONDITION_HEADER_KEYS,
    resolveAbnormalConditionLayout,
    validateAbnormalConditionLayout,
} from "./abnormalConditionLayout.js";

test("resolve fills defaults and drops unknown header keys", () => {
    const layout = resolveAbnormalConditionLayout({ headers: { cause: "Root cause", bogus: "x" }, defaultRows: 999 });
    assert.equal(layout.headers.cause, "Root cause");
    assert.equal(layout.headers.date, "Date");
    assert.ok(!("bogus" in layout.headers));
    assert.equal(layout.defaultRows, DEFAULT_ABNORMAL_CONDITION_LAYOUT.defaultRows);
    assert.deepEqual(Object.keys(layout.headers), [...ABNORMAL_CONDITION_HEADER_KEYS]);
    assert.equal(resolveAbnormalConditionLayout(null).remarks, DEFAULT_ABNORMAL_CONDITION_LAYOUT.remarks);
});

test("validate accepts text edits and rejects new columns or bad rows", () => {
    const ok = resolveAbnormalConditionLayout(null);
    ok.headers.target = "Target Date";
    ok.defaultRows = 20;
    assert.deepEqual(validateAbnormalConditionLayout(ok), []);

    const extra = resolveAbnormalConditionLayout(null);
    extra.headers.newColumn = "New";
    assert.ok(validateAbnormalConditionLayout(extra).length > 0);

    const missing = resolveAbnormalConditionLayout(null);
    delete missing.headers.cause;
    assert.ok(validateAbnormalConditionLayout(missing).length > 0);

    const rows = resolveAbnormalConditionLayout(null);
    rows.defaultRows = 0;
    assert.ok(validateAbnormalConditionLayout(rows).length > 0);
});
