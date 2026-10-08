// Run with: node --test test/sheetTableFilter.test.js
//
// The grid's AutoFilter (portal/src/utils/spreadsheets/tableFilter.js): which
// rows a column's filter lets through.
import test from "node:test";
import assert from "node:assert/strict";
import {
    compileFilter, compileTableFilters, isFilterActive, shownValuesOf, valueFilterFor, parseNumberText,
} from "../../portal/src/utils/spreadsheets/tableFilter.js";

const condition = (type, value) => compileFilter({ condition: { type, value } });

test("a hidden-values filter hides those values and lets new ones through", () => {
    const keep = compileFilter({ hidden: ["Closed", ""] });
    assert.equal(keep("Open"), true);
    assert.equal(keep("Closed"), false);
    assert.equal(keep(""), false);
    assert.equal(keep("Review"), true); // not there when the filter was set
});

test("an older filter, a list of the values to keep, still works", () => {
    const keep = compileFilter(["Open", "Pending"]);
    assert.equal(keep("Open"), true);
    assert.equal(keep("Closed"), false);
    assert.equal(isFilterActive([]), true); // keeps nothing
});

test("a filter that hides nothing is not active", () => {
    assert.equal(isFilterActive({ hidden: [] }), false);
    assert.equal(isFilterActive(undefined), false);
    assert.equal(isFilterActive({ condition: { type: "none" } }), false);
    assert.equal(isFilterActive({ condition: { type: "textContains", value: "" } }), false);
    assert.equal(isFilterActive({ condition: { type: "greaterThan", value: "abc" } }), false);
});

test("text conditions ignore case", () => {
    assert.equal(condition("textContains", "urg")("Very URGENT"), true);
    assert.equal(condition("textNotContains", "urg")("Very URGENT"), false);
    assert.equal(condition("textStartsWith", "ver")("Very URGENT"), true);
    assert.equal(condition("textEndsWith", "ver")("Very URGENT"), false);
    assert.equal(condition("textEquals", "open")("Open"), true);
});

test("empty and not-empty", () => {
    assert.equal(condition("empty")("  "), true);
    assert.equal(condition("empty")("x"), false);
    assert.equal(condition("notEmpty")("x"), true);
});

test("number conditions compare the underlying value, not the formatted text", () => {
    const over = condition("greaterThan", "1,000");
    assert.equal(over("1,234.50", 1234.5), true);
    assert.equal(over("₹1,234.50", 1234.5), true);
    assert.equal(over("999", 999), false);
    assert.equal(over("1,234.50", "1,234.50"), true); // a number kept as text
    assert.equal(over("n/a", "n/a"), false);
    assert.equal(over("", 0), false); // an empty cell is not 0
    assert.equal(condition("lessThanOrEqual", "5")("5", 5), true);
    assert.equal(condition("numberEquals", "5")("5.0", 5), true);
});

test("parseNumberText", () => {
    assert.equal(parseNumberText(" -1,200.5 "), -1200.5);
    assert.equal(Number.isNaN(parseNumberText("12abc")), true);
    assert.equal(Number.isNaN(parseNumberText("")), true);
});

test("a table's filters compile to its active columns only", () => {
    const table = { filtersEnabled: true, filters: { 2: { hidden: ["x"] }, 4: { hidden: [] }, 5: ["a"] } };
    assert.deepEqual(compileTableFilters(table).map((f) => f.col), [2, 5]);
    assert.equal(compileTableFilters({ ...table, filtersEnabled: false }), null);
    assert.equal(compileTableFilters({ filtersEnabled: true, filters: {} }), null);
});

test("the filter list's ticks round-trip through the stored filter", () => {
    const all = ["", "Closed", "Open", "Pending"];
    assert.deepEqual(shownValuesOf({ hidden: ["Closed"] }, all), ["", "Open", "Pending"]);
    assert.deepEqual(shownValuesOf(["Open", "Gone"], all), ["Open"]);
    assert.deepEqual(shownValuesOf({ condition: { type: "empty" } }, all), all);
    assert.deepEqual(valueFilterFor(all, new Set(["Open", "Pending"])), { hidden: ["", "Closed"] });
    assert.equal(valueFilterFor(all, new Set(all)), null);
});
