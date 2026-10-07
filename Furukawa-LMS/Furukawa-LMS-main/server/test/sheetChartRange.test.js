// Run with: node --test test/sheetChartRange.test.js
//
// What a newly inserted chart plots (portal/src/utils/spreadsheets/chartMatrixEngine.js):
// charts are only created when the user asks for one, and start on whatever is selected
// in the grid at that moment.
import test from "node:test";
import assert from "node:assert/strict";
import { dataRegionAround, blockChartRange, newChartRange } from "../../portal/src/utils/spreadsheets/chartMatrixEngine.js";

// A grid from rows of values, placed with its top-left corner at `origin` ("B3").
const colOf = (index) => String.fromCharCode(65 + index);
const gridAt = (originCol, originRow, rows) => {
    const grid = {};
    rows.forEach((row, r) => row.forEach((value, c) => {
        if (value !== "") grid[`${colOf(originCol + c)}${originRow + r + 1}`] = String(value);
    }));
    return grid;
};
// A table at B3:E7 — a header row, then four rows of a label and three numbers — and a
// second, separate one at H3:I5.
const sales = gridAt(1, 2, [
    ["Line", "Target", "Actual", "Scrap"],
    ["L1", 100, 96, 4],
    ["L2", 120, 121, 2],
    ["L3", 90, 70, 9],
    ["L4", 110, 108, 3],
]);
const other = gridAt(7, 2, [["Shift", "Output"], ["A", 40], ["B", 55]]);
const displayGrid = { ...sales, ...other };
const sheet = { displayGrid, rowCount: 30, columnCount: 15 };
const pick = (selection, extra = {}) => newChartRange({ ...sheet, selection, activeCell: selection?.start, ...extra });

test("the region around a cell is the block of data it sits in, and no further", () => {
    const table = { minRow: 2, maxRow: 6, minCol: 1, maxCol: 4 };
    for (const [row, col] of [[2, 1], [4, 3], [6, 4]]) {
        assert.deepEqual(dataRegionAround(displayGrid, row, col, 30, 15), table, `from ${row},${col}`);
    }
    // The other table is two empty columns away, so it stays out.
    assert.deepEqual(dataRegionAround(displayGrid, 3, 7, 30, 15), { minRow: 2, maxRow: 4, minCol: 7, maxCol: 8 });
    // An empty cell touching the table still finds it (and is itself part of the
    // region); one out on its own finds nothing.
    assert.deepEqual(dataRegionAround(displayGrid, 7, 2, 30, 15), { ...table, maxRow: 7 });
    assert.deepEqual(dataRegionAround(displayGrid, 20, 12, 30, 15), { minRow: 20, maxRow: 20, minCol: 12, maxCol: 12 });
    // The edges of the sheet are as far as it grows.
    assert.deepEqual(dataRegionAround(gridAt(0, 0, [[1, 2], [3, 4]]), 0, 0, 2, 2), { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 });
});

test("a selected block is charted as selected: first column the categories, the rest the series", () => {
    assert.deepEqual(pick({ start: "B3", end: "E7" }), { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true });
    // Dragged from the other corner, and only part of the table.
    assert.deepEqual(pick({ start: "D6", end: "B3" }), { xAxisCol: "B", valueCols: ["C", "D"], rowStart: 3, rowEnd: 6, hasHeaderRow: true });
    // No header row inside the selection: the first row is data.
    assert.deepEqual(pick({ start: "B4", end: "D7" }), { xAxisCol: "B", valueCols: ["C", "D"], rowStart: 4, rowEnd: 7, hasHeaderRow: false });
});

test("one cell, row or column selected charts the whole block of data around the active cell", () => {
    const table = { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true };
    assert.deepEqual(pick({ start: "D5", end: "D5" }), table);
    assert.deepEqual(pick({ start: "C3", end: "C7" }), table, "one column");
    assert.deepEqual(pick({ start: "B5", end: "E5" }), table, "one row");
    // From an empty cell just under or beside the table: the table, without that cell's empty row or column.
    assert.deepEqual(pick({ start: "C8", end: "C8" }), table);
    assert.deepEqual(pick({ start: "A5", end: "A5" }), table);
    // The active cell decides which table, wherever the selection started.
    assert.deepEqual(pick({ start: "A1", end: "A1" }, { activeCell: "I4" }), { xAxisCol: "H", valueCols: ["I"], rowStart: 3, rowEnd: 5, hasHeaderRow: true });
});

test("nothing to chart leaves the defaults in place", () => {
    assert.equal(pick({ start: "M20", end: "M20" }), null, "an empty cell on its own");
    assert.equal(newChartRange({ ...sheet, displayGrid: {}, selection: { start: "A1", end: "A1" }, activeCell: "A1" }), null, "an empty sheet");
    assert.equal(newChartRange({ ...sheet, displayGrid: { C3: "alone" }, selection: { start: "C3", end: "C3" }, activeCell: "C3" }), null, "a single filled cell");
    assert.equal(newChartRange({ ...sheet, selection: null, activeCell: null }), null, "no selection at all");
    assert.equal(newChartRange({ ...sheet, selection: { start: "??", end: "A1" }, activeCell: "bad" }), null, "a malformed one");
});

test("a single column of data plots that column", () => {
    const grid = gridAt(2, 1, [["Output"], [10], [20], [30]]);
    assert.deepEqual(
        newChartRange({ displayGrid: grid, rowCount: 30, columnCount: 15, selection: { start: "C3", end: "C3" }, activeCell: "C3" }),
        { xAxisCol: "C", valueCols: ["C"], rowStart: 2, rowEnd: 5, hasHeaderRow: true }
    );
    assert.deepEqual(blockChartRange(grid, { minRow: 2, maxRow: 4, minCol: 2, maxCol: 2 }), { xAxisCol: "C", valueCols: ["C"], rowStart: 3, rowEnd: 5, hasHeaderRow: false });
});

test("several Ctrl-selected ranges are charted as a range list", () => {
    const ranges = [{ start: "B3", end: "B7" }, { start: "D3", end: "E7" }];
    const range = newChartRange({ ...sheet, selection: ranges[1], ranges, activeCell: "D3" });
    assert.equal(range.rangeString, "B3:B7, D3:E7");
    assert.equal(range.plotBy, "columns");
    assert.equal(range.hasHeaderRow, true);
    assert.deepEqual(range.valueCols, ["D", "E"]);
    // The grid always reports the active range in `ranges`; one range is just a selection.
    assert.deepEqual(
        newChartRange({ ...sheet, selection: { start: "B3", end: "E7" }, ranges: [{ start: "B3", end: "E7" }], activeCell: "B3" }),
        { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true }
    );
});
