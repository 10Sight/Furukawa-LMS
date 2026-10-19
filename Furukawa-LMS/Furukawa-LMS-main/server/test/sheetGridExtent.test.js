// Run with: node --test test/sheetGridExtent.test.js
//
// How far the grid goes (admin/src/utils/spreadsheets/gridExtent.js): drawn some way
// past what is in view, growing as the user scrolls and shrinking back once they
// scroll away; saved only as far as the sheet holds anything.
import test from "node:test";
import assert from "node:assert/strict";
import { viewExtent, contentExtent, fitSheetsToContent, GRID_MAX_ROWS } from "../../admin/src/utils/spreadsheets/gridExtent.js";
import { applyWorkbookUpdate, applyHistoryRecord, changedCellIdsOf } from "../../admin/src/utils/spreadsheets/workbookUpdate.js";

const rows = (current, reach, extra = {}) => viewExtent({ current, saved: 30, reach, chunk: 50, max: GRID_MAX_ROWS, idle: true, ...extra });

test("the grid is drawn a chunk or more past what has to show", () => {
    assert.equal(rows(0, 25), 100, "a first look: past the screen, in whole chunks");
    assert.equal(rows(100, 40), 100, "well inside: unchanged");
    assert.equal(rows(100, 60), 150, "scrolled near the end: one chunk more");
    assert.equal(rows(150, 140), 200);
});

test("it shrinks back only once the user stops", () => {
    assert.equal(rows(400, 40, { idle: false }), 400, "still scrolling up: kept");
    assert.equal(rows(400, 40), 100, "stopped near the top: back to what the screen needs");
});

test("never below the saved size, never past the maximum", () => {
    assert.equal(rows(0, 10, { saved: 500 }), 500);
    assert.equal(rows(400, 10, { saved: 500 }), 500);
    assert.equal(rows(0, GRID_MAX_ROWS - 3), GRID_MAX_ROWS);
    assert.equal(rows(0, 10, { saved: GRID_MAX_ROWS + 5 }), GRID_MAX_ROWS + 5, "an imported sheet past the maximum keeps all of its rows");
});

test("a sheet needs room for its cells, merges, media, comments and sized or hidden bands", () => {
    assert.deepEqual(contentExtent({ cells: {} }), { rows: 0, cols: 0 });
    assert.deepEqual(contentExtent({ cells: { B3: { value: "x" }, D2: { bold: true } } }), { rows: 3, cols: 4 }, "formatting alone counts");
    assert.deepEqual(contentExtent({ cells: {}, merges: [{ start: "A1", end: "C9" }] }), { rows: 9, cols: 3 });
    assert.deepEqual(contentExtent({ cells: {}, media: [{ row: 40, col: 2 }] }), { rows: 41, cols: 3 });
    assert.deepEqual(contentExtent({ cells: {}, commentAnchors: { F12: "t1" } }), { rows: 12, cols: 6 });
    assert.deepEqual(contentExtent({ cells: {}, rowHeights: { 59: 40 }, columnWidths: { 7: 120 } }), { rows: 60, cols: 8 });
    assert.deepEqual(contentExtent({ cells: {}, hiddenRows: [70], hiddenCols: [11] }), { rows: 71, cols: 12 });
    // Only the cells named, when told which changed; one removed doesn't count.
    assert.deepEqual(contentExtent({ cells: { A1: { value: 1 }, Z99: { value: 2 } }, cellIds: new Set(["A1", "C5"]) }), { rows: 1, cols: 1 });
});

test("an update says which cells it wrote", () => {
    const workbook = { S: { cells: { A1: { value: "a" } }, rowCount: 30, columnCount: 15 }, T: { cells: {}, rowCount: 30, columnCount: 15 } };
    let seen = null;
    applyWorkbookUpdate(workbook, (draft) => {
        draft.S.cells.B200 = { value: "far" };
        delete draft.S.cells.A1;
        seen = { S: [...changedCellIdsOf(draft.S.cells)].sort(), T: changedCellIdsOf(draft.T.cells).size };
    });
    assert.deepEqual(seen, { S: ["A1", "B200"], T: 0 });
    applyWorkbookUpdate(workbook, (draft) => {
        draft.S.cells = { C3: { value: 1 } };
        seen = changedCellIdsOf(draft.S.cells);
    });
    assert.equal(seen, null, "a map put in place of the sheet's own: not known");
});

test("writing beyond the saved size saves the larger size, in the same undo step", () => {
    const workbook = { S: { cells: { A1: { value: "a" } }, rowCount: 30, columnCount: 15, merges: [] } };
    const update = (fn) => applyWorkbookUpdate(workbook, (draft) => { fn(draft); fitSheetsToContent(draft); });

    const typed = update((draft) => { draft.S.cells.C200 = { value: "far" }; });
    assert.equal(typed.next.S.rowCount, 200);
    assert.equal(typed.next.S.columnCount, 15, "already wide enough");
    assert.equal(applyHistoryRecord(typed.next, typed.undo).next.S.rowCount, 30, "undo takes the size back too");

    const merged = update((draft) => { draft.S.merges.push({ start: "P1", end: "Q2" }); });
    assert.equal(merged.next.S.columnCount, 17, "a merge added in the same update counts");

    const inside = update((draft) => { draft.S.cells.B2 = { value: "near" }; });
    assert.equal(inside.next.S.rowCount, 30, "nothing beyond: unchanged");
    const nothing = update(() => {});
    assert.equal(nothing.undo, null, "no change, no undo step");
});
