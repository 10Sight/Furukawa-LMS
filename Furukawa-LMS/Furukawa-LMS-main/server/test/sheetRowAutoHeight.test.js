// Run with: node --test test/sheetRowAutoHeight.test.js
//
// Rows sized to what they hold (admin/src/utils/spreadsheets/rowAutoHeight.js): a row
// with no height of its own grows for Wrap Text cells and large fonts.
import test from "node:test";
import assert from "node:assert/strict";
import { cellTextHeight, contentRowHeights } from "../../admin/src/utils/spreadsheets/rowAutoHeight.js";

// Every character 6px wide at the default 12px font, scaling with the font size.
const measure = (text, cell) => String(text).length * 6 * ((cell?.fontSize || 12) / 12);
const fit = (cells, extra = {}) => contentRowHeights({
    cells, display: {}, columnWidths: {}, rowHeights: {}, mergeMap: {},
    defaultHeight: 28, defaultColumnWidth: 96, measure, ...extra,
});
// 39 characters: in a 96px column (84px for text, 14 characters) it wraps to
// "alpha beta", "gamma delta", "epsilon zeta", "eta".
const long = "alpha beta gamma delta epsilon zeta eta";
const linesHigh = (n, fontSize = 12) => Math.ceil(n * fontSize * 1.35 + 10);

test("a Wrap Text cell's row is tall enough for all of its lines", () => {
    assert.equal(cellTextHeight(measure, long, { wrap: true }, 96), linesHigh(4));
    assert.deepEqual(fit({ B2: { value: long, wrap: true } }), { 1: linesHigh(4) });
    // Typed line breaks count as lines of their own.
    assert.deepEqual(fit({ A1: { value: "one\ntwo\nthree", wrap: true } }), { 0: linesHigh(3) });
});

test("without Wrap Text, or when the text fits, the row keeps the default height", () => {
    assert.deepEqual(fit({ B2: { value: long } }), {});
    assert.deepEqual(fit({ B2: { value: "short", wrap: true } }), {});
    assert.deepEqual(fit({ B2: { value: "", wrap: true } }), {});
});

test("a wider column needs fewer lines, a narrower one more", () => {
    const cells = { B2: { value: long, wrap: true } };
    assert.deepEqual(fit(cells, { columnWidths: { 1: 300 } }), {});
    assert.deepEqual(fit(cells, { columnWidths: { 1: 140 } }), { 1: linesHigh(3) });
    assert.ok(fit(cells, { columnWidths: { 1: 60 } })[1] > linesHigh(4));
});

test("the tallest cell in a row sets its height", () => {
    const cells = { A1: { value: "one\ntwo", wrap: true }, C1: { value: "one\ntwo\nthree\nfour", wrap: true } };
    assert.deepEqual(fit(cells), { 0: linesHigh(4) });
});

test("a large font makes its row taller, wrapped or not", () => {
    assert.deepEqual(fit({ A1: { value: "Title", fontSize: 24 } }), { 0: linesHigh(1, 24) });
    assert.deepEqual(fit({ A1: { value: "Title", fontSize: 13 } }), {}, "a little over the default still fits");
});

test("the shown value is measured, so a formula's result counts, not its text", () => {
    const cells = { A1: { value: "=REPT(\"x\", 3)", wrap: true } };
    assert.deepEqual(fit(cells, { display: { A1: "x" } }), {});
    assert.deepEqual(fit(cells, { display: { A1: "one\ntwo\nthree" } }), { 0: linesHigh(3) });
});

test("rows with a height of their own, and merged cells, are left alone", () => {
    const cells = { A1: { value: long, wrap: true }, A2: { value: long, wrap: true } };
    assert.deepEqual(fit(cells, { rowHeights: { 0: 40 } }), { 1: linesHigh(4) });
    assert.deepEqual(fit(cells, { mergeMap: { A2: { start: "A2", end: "B2" } } }), { 0: linesHigh(4) });
});

test("an unchanged cell is measured once", () => {
    let calls = 0;
    const counting = (text, cell) => { calls++; return measure(text, cell); };
    const cache = new WeakMap();
    const cell = { value: long, wrap: true };
    fit({ A1: cell }, { measure: counting, cache });
    const first = calls;
    assert.ok(first > 0);
    fit({ A1: cell, B1: { value: "x" } }, { measure: counting, cache });
    assert.equal(calls, first);
    fit({ A1: cell }, { measure: counting, cache, columnWidths: { 0: 120 } });
    assert.ok(calls > first, "a new column width measures again");
});

test("text given a larger font in part is sized by that font", () => {
    const rich = (size) => ({ value: "Title here", rich: { t: "Title here", runs: [{ start: 0, end: 5, fontSize: size }] } });
    assert.deepEqual(fit({ A1: rich(24) }), { 0: linesHigh(1, 24) }, "unwrapped, still taller");
    // 10 characters at 24px (12px each) are 120px: too wide for a 96px column, so 2 lines.
    assert.deepEqual(fit({ A1: { ...rich(24), wrap: true } }), { 0: linesHigh(2, 24) });
    assert.deepEqual(fit({ A1: rich(10) }), {}, "a smaller part changes nothing");
});
