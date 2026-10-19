// Run with: node --test test/sheetChartRange.test.js
//
// What a newly inserted chart plots (portal/src/utils/spreadsheets/chartMatrixEngine.js):
// charts are only created when the user asks for one, and start on whatever is selected
// in the grid at that moment.
import test from "node:test";
import assert from "node:assert/strict";
import { blockChartRange, newChartRange, shiftChartBands } from "../../admin/src/utils/spreadsheets/chartMatrixEngine.js";

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
const sheet = { displayGrid };
const pick = (selection, extra = {}) => newChartRange({ ...sheet, selection, ...extra });

test("a selected block is charted as selected: first column the categories, the rest the series", () => {
    assert.deepEqual(pick({ start: "B3", end: "E7" }), { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true });
    // Dragged from the other corner, and only part of the table.
    assert.deepEqual(pick({ start: "D6", end: "B3" }), { xAxisCol: "B", valueCols: ["C", "D"], rowStart: 3, rowEnd: 6, hasHeaderRow: true });
    // No header row inside the selection: the first row is data.
    assert.deepEqual(pick({ start: "B4", end: "D7" }), { xAxisCol: "B", valueCols: ["C", "D"], rowStart: 4, rowEnd: 7, hasHeaderRow: false });
});

test("a selected column charts just that column", () => {
    assert.deepEqual(pick({ start: "C3", end: "C7" }), { xAxisCol: "C", valueCols: ["C"], rowStart: 3, rowEnd: 7, hasHeaderRow: true });
    assert.deepEqual(pick({ start: "D4", end: "D7" }), { xAxisCol: "D", valueCols: ["D"], rowStart: 4, rowEnd: 7, hasHeaderRow: false });
});

test("a selected row charts that row as one series", () => {
    // A text label first: it names the series, and the numbers after it are the points.
    assert.deepEqual(pick({ start: "B5", end: "E5" }), { rangeString: "B5:E5", plotBy: "rows", hasHeaderRow: true, valueCols: ["5"] });
    // All numbers: every cell is a point.
    assert.deepEqual(pick({ start: "C5", end: "E5" }), { rangeString: "C5:E5", plotBy: "rows", hasHeaderRow: false, valueCols: ["5"] });
});

test("whole rows, columns or the whole sheet stop where the data does", () => {
    assert.deepEqual(pick({ start: "D1", end: "D30" }), { xAxisCol: "D", valueCols: ["D"], rowStart: 3, rowEnd: 7, hasHeaderRow: true }, "column D");
    assert.deepEqual(pick({ start: "B1", end: "E30" }), { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true }, "columns B:E");
    assert.deepEqual(pick({ start: "A6", end: "O6" }), { rangeString: "B6:E6", plotBy: "rows", hasHeaderRow: true, valueCols: ["6"] }, "row 6");
    // The whole sheet takes in both tables and the gap between them.
    assert.deepEqual(pick({ start: "A1", end: "O30" }), { xAxisCol: "B", valueCols: ["C", "D", "E", "F", "G", "H", "I"], rowStart: 3, rowEnd: 7, hasHeaderRow: false });
});

test("one cell selected charts nothing, not the data around it", () => {
    assert.equal(pick({ start: "D5", end: "D5" }), null, "inside a table");
    assert.equal(pick({ start: "B3", end: "B3" }), null, "a table's corner");
    assert.equal(pick({ start: "C8", end: "C8" }), null, "just under a table");
});

test("a block one column wide plots that column", () => {
    const grid = gridAt(2, 1, [["Output"], [10], [20], [30]]);
    assert.deepEqual(blockChartRange(grid, { minRow: 2, maxRow: 4, minCol: 2, maxCol: 2 }), { xAxisCol: "C", valueCols: ["C"], rowStart: 3, rowEnd: 5, hasHeaderRow: false });
});

test("nothing to chart gives null", () => {
    assert.equal(pick({ start: "K10", end: "M20" }), null, "an empty block");
    assert.equal(pick({ start: "B10", end: "B20" }), null, "an empty part of a column");
    assert.equal(pick({ start: "B3", end: "B30" }, { displayGrid: { B3: "alone" } }), null, "a column with one filled cell");
    assert.equal(pick({ start: "M20", end: "M20" }), null, "an empty cell on its own");
    assert.equal(newChartRange({ ...sheet, displayGrid: {}, selection: { start: "A1", end: "A1" } }), null, "an empty sheet");
    assert.equal(newChartRange({ ...sheet, displayGrid: { C3: "alone" }, selection: { start: "C3", end: "C3" } }), null, "a single filled cell");
    assert.equal(newChartRange({ ...sheet, selection: null }), null, "no selection at all");
    assert.equal(newChartRange({ ...sheet, selection: { start: "??", end: "A1" } }), null, "a malformed one");
});

test("several Ctrl-selected ranges are charted as a range list", () => {
    const ranges = [{ start: "B3", end: "B7" }, { start: "D3", end: "E7" }];
    const range = newChartRange({ ...sheet, selection: ranges[1], ranges });
    assert.equal(range.rangeString, "B3:B7, D3:E7");
    assert.equal(range.plotBy, "columns");
    assert.equal(range.hasHeaderRow, true);
    assert.deepEqual(range.valueCols, ["D", "E"]);
    // The grid always reports the active range in `ranges`; one range is just a selection.
    assert.deepEqual(
        newChartRange({ ...sheet, selection: { start: "B3", end: "E7" }, ranges: [{ start: "B3", end: "E7" }] }),
        { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true }
    );
});

// --- A chart keeps plotting the same cells as rows and columns are inserted or deleted ---
// (axis, at = 0-based index, count > 0 inserts, < 0 deletes)
const block = { xAxisCol: "B", valueCols: ["C", "D", "E"], rowStart: 3, rowEnd: 7, hasHeaderRow: true, seriesColors: { C: "red", E: "blue" } };
const rowsOf = (chart) => [chart.rowStart, chart.rowEnd];

test("rows inserted above, inside or below a chart's block", () => {
    assert.deepEqual(rowsOf(shiftChartBands(block, "row", 0, 2)), [5, 9], "above: it moves down");
    assert.deepEqual(rowsOf(shiftChartBands(block, "row", 4, 2)), [3, 9], "inside: it takes the new rows in");
    assert.deepEqual(rowsOf(shiftChartBands(block, "row", 7, 2)), [3, 7], "just below: unchanged");
    assert.deepEqual(shiftChartBands(block, "row", 4, 2).valueCols, ["C", "D", "E"], "its series stay");
});

test("rows deleted above, inside or across all of a chart's block", () => {
    assert.deepEqual(rowsOf(shiftChartBands(block, "row", 0, -1)), [2, 6], "above: it moves up");
    assert.deepEqual(rowsOf(shiftChartBands(block, "row", 4, -2)), [3, 5], "inside: it closes up");
    assert.deepEqual(shiftChartBands(block, "row", 2, -5).valueCols, [], "all of it: nothing left to plot");
});

test("columns inserted or deleted move the series and their settings with them", () => {
    const inserted = shiftChartBands(block, "col", 2, 1); // a new column C
    assert.equal(inserted.xAxisCol, "B");
    assert.deepEqual(inserted.valueCols, ["D", "E", "F"]);
    assert.deepEqual(inserted.seriesColors, { D: "red", F: "blue" });

    const deleted = shiftChartBands(block, "col", 3, -1); // column D goes
    assert.deepEqual(deleted.valueCols, ["C", "D"], "E slides into D's place");
    assert.deepEqual(deleted.seriesColors, { C: "red", D: "blue" });

    const lostCategories = shiftChartBands(block, "col", 1, -1); // column B, the categories
    assert.equal(lostCategories.xAxisCol, "B", "the first series left (C, now B) takes over");
    assert.deepEqual(lostCategories.valueCols, ["B", "C", "D"]);
});

test("a chart of Ctrl-selected ranges, or plotted by rows, moves the same way", () => {
    const list = { rangeString: "B3:B7, D3:E7", plotBy: "columns", hasHeaderRow: true, valueCols: ["D", "E"], comboSettings: { E: { type: "line" } } };
    const moved = shiftChartBands(list, "col", 2, 1);
    assert.equal(moved.rangeString, "B3:B7, E3:F7");
    assert.deepEqual(moved.valueCols, ["E", "F"]);
    assert.deepEqual(moved.comboSettings, { F: { type: "line" } });
    assert.equal(shiftChartBands(list, "col", 3, -2).rangeString, "B3:B7", "a range deleted outright is dropped");

    const byRows = { rangeString: "B5:E5", plotBy: "rows", hasHeaderRow: true, valueCols: ["5"], seriesColors: { 5: "green" } };
    const down = shiftChartBands(byRows, "row", 0, 3);
    assert.equal(down.rangeString, "B8:E8");
    assert.deepEqual(down.valueCols, ["8"]);
    assert.deepEqual(down.seriesColors, { 8: "green" });
    assert.deepEqual(shiftChartBands(byRows, "col", 0, 1).valueCols, ["5"], "a column insert leaves row series alone");

    const gone = shiftChartBands(byRows, "row", 4, -1);
    assert.equal(gone.rangeString, "");
    assert.deepEqual(gone.valueCols, []);
});
