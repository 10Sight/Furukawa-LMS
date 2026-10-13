// Run with: node --test test/sheetTableFilter.test.js
//
// The grid's AutoFilter (portal/src/utils/spreadsheets/tableFilter.js): which
// rows a column's filter lets through.
import test from "node:test";
import assert from "node:assert/strict";
import {
    compileFilter, compileTableFilters, isFilterActive, shownValuesOf, valueFilterFor, parseNumberText, valuesToShow, columnValueCounts,
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

// --- The filter list: what Apply keeps, and what the list offers ---

const kept = (options) => [...valuesToShow(options)].sort();
// A long column: 3,000 different values, every one of them ticked as the list opens.
const many = Array.from({ length: 3000 }, (_, i) => `Part-${String(i + 1).padStart(4, "0")}`);

test("searching for a value and applying shows that value's rows", () => {
    const ticked = new Set(many);
    const matches = many.filter((v) => v.includes("Part-2750"));
    assert.deepEqual(kept({ ticked, matches }), ["Part-2750"]);
    // Which is a filter that hides the other 2,999 — where counting ticks alone hid nothing.
    assert.equal(valueFilterFor(many, valuesToShow({ ticked, matches })).hidden.length, 2999);
    assert.equal(valueFilterFor(many, ticked), null);

    // Several found: all of them, less any unticked in the list.
    const found = many.filter((v) => v.startsWith("Part-001"));
    assert.equal(kept({ ticked, matches: found }).length, 10);
    const fewer = new Set(many); fewer.delete("Part-0012");
    assert.equal(kept({ ticked: fewer, matches: found }).includes("Part-0012"), false);
    assert.equal(kept({ ticked: fewer, matches: found }).length, 9);
    // Nothing found, or everything found unticked: nothing to show, so nothing to apply.
    assert.deepEqual(kept({ ticked, matches: [] }), []);
    assert.deepEqual(kept({ ticked: new Set(), matches: found }), []);
});

test("without a search the ticks are the filter, as before", () => {
    assert.deepEqual(kept({ ticked: new Set(["Open", "Pending"]), matches: null }), ["Open", "Pending"]);
    assert.deepEqual(kept({ ticked: new Set(), matches: null }), []);
    // The options a search uses change nothing without one.
    assert.deepEqual(kept({ ticked: new Set(["Open"]), matches: null, add: true, alreadyShown: ["Closed"] }), ["Open"]);
});

test("a search can add to what the filter already shows", () => {
    const all = ["Closed", "Open", "Pending", "Review"];
    const filter = { hidden: ["Closed", "Pending", "Review"] }; // showing Open only
    const alreadyShown = shownValuesOf(filter, all);
    const ticked = new Set([...alreadyShown, "Pending"]); // "Pending" ticked after searching for it
    assert.deepEqual(kept({ ticked, matches: ["Pending"], add: true, alreadyShown }), ["Open", "Pending"]);
    assert.deepEqual(kept({ ticked, matches: ["Pending"], alreadyShown }), ["Pending"], "not asked to add: that alone");
    assert.deepEqual(valueFilterFor(all, valuesToShow({ ticked, matches: ["Pending"], add: true, alreadyShown })), { hidden: ["Closed", "Review"] });
});

test("the filter list offers each value the column shows, with its count", () => {
    const table = { range: { start: "B2", end: "C7" } }; // header in row 2
    const display = { B2: "Status", B3: "Open", B4: "Closed", B5: "Open", B6: "", B7: "10", C3: "x", B8: "below the table", B1: "above it" };
    assert.deepEqual(columnValueCounts(table, 1, display), [
        { value: "", count: 1 }, { value: "10", count: 1 }, { value: "Closed", count: 1 }, { value: "Open", count: 2 },
    ]);
    assert.deepEqual(columnValueCounts(table, 2, display), [{ value: "", count: 4 }, { value: "x", count: 1 }]);
    assert.deepEqual(columnValueCounts({ range: { start: "C7", end: "B2" } }, 1, display).length, 4, "a range given end first");
    assert.deepEqual(columnValueCounts({ range: { start: "??", end: "B2" } }, 1, display), []);
    assert.deepEqual(columnValueCounts(undefined, 1, display), []);
    // Numbers in number order, not "10" before "9".
    const numbers = { A2: "9", A3: "10", A4: "100" };
    assert.deepEqual(columnValueCounts({ range: { start: "A1", end: "A4" } }, 0, numbers).map((v) => v.value), ["9", "10", "100"]);
});
