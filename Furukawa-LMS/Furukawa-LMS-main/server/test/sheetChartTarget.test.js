// Run with: node --test test/sheetChartTarget.test.js
//
// Actual vs Target column chart (admin/src/constants/spreadsheets/chartTypes.js):
// how each column is judged against its target, and how blank cells reach it.
import test from "node:test";
import assert from "node:assert/strict";
import {
    targetStatus, targetConfigOf, TARGET_DEFAULTS, keepsBlankCells, chartRequirement,
} from "../../admin/src/constants/spreadsheets/chartTypes.js";
import { extractDisjointChartData } from "../../admin/src/utils/spreadsheets/chartMatrixEngine.js";

test("higher is better: meeting or beating the target is a pass", () => {
    assert.equal(targetStatus(10, 8, "higherIsBetter"), "above");
    assert.equal(targetStatus(8, 10, "higherIsBetter"), "below");
    assert.equal(targetStatus(10, 10, "higherIsBetter"), "above");
});

test("lower is better: equal to the target is a pass", () => {
    assert.equal(targetStatus(6, 8, "lowerIsBetter"), "above");
    assert.equal(targetStatus(10, 8, "lowerIsBetter"), "below");
    assert.equal(targetStatus(10, 10, "lowerIsBetter"), "above");
});

test("an unknown rule falls back to higher is better", () => {
    assert.equal(targetStatus(10, 10, undefined), "above");
    assert.equal(targetStatus(8, 10, "nonsense"), "below");
});

test("a missing actual or target can't be judged", () => {
    for (const rule of ["higherIsBetter", "lowerIsBetter"]) {
        assert.equal(targetStatus(5, null, rule), "none");
        assert.equal(targetStatus(null, 5, rule), "none");
        assert.equal(targetStatus(undefined, 5, rule), "none");
        assert.equal(targetStatus(NaN, 5, rule), "none");
        assert.equal(targetStatus("5", 5, rule), "none");
    }
});

test("zero and negative values are judged like any other number", () => {
    assert.equal(targetStatus(0, 0, "higherIsBetter"), "above");
    assert.equal(targetStatus(-5, -3, "higherIsBetter"), "below");
    assert.equal(targetStatus(-5, -3, "lowerIsBetter"), "above");
    assert.equal(targetStatus(0, 5, "lowerIsBetter"), "above");
});

test("targetConfigOf fills in defaults and keeps overrides", () => {
    assert.deepEqual(targetConfigOf({}), TARGET_DEFAULTS);
    assert.deepEqual(targetConfigOf(undefined), TARGET_DEFAULTS);
    const tc = targetConfigOf({ targetConfig: { rule: "lowerIsBetter", aboveColor: "#000000" } });
    assert.equal(tc.rule, "lowerIsBetter");
    assert.equal(tc.aboveColor, "#000000");
    assert.equal(tc.belowColor, TARGET_DEFAULTS.belowColor);
});

test("the chart needs two series", () => {
    assert.match(chartRequirement("actualVsTarget", ["Actual"], []), /two value series/);
    assert.equal(chartRequirement("actualVsTarget", ["Actual", "Target"], []), null);
    assert.equal(chartRequirement("actualVsTarget", ["Actual", "Target", "Extra"], []), null);
});

test("only Actual vs Target keeps blank cells", () => {
    assert.equal(keepsBlankCells("actualVsTarget"), true);
    assert.equal(keepsBlankCells("columnGrouped"), false);
});

test("range-list charts: blank cells become null only with keepBlanks", () => {
    const displayGrid = {
        A1: "Month", B1: "Actual", C1: "Target",
        A2: "Jan", B2: "12", C2: "10",
        A3: "Feb", B3: "7", // no target
        A4: "Mar", B4: "0", C4: "0",
    };
    const config = { ranges: [{ start: "A1", end: "C4" }], hasHeaderRow: true };

    const kept = extractDisjointChartData({ displayGrid, config, keepBlanks: true });
    assert.deepEqual(kept.seriesKeys, ["Actual", "Target"]);
    assert.deepEqual(kept.data.map((r) => r.Target), [10, null, 0]);

    const zeroed = extractDisjointChartData({ displayGrid, config });
    assert.deepEqual(zeroed.data.map((r) => r.Target), [10, 0, 0]);
});
