// Run with: node --test test/sheetCellLineage.test.js
//
// Save patches built from recorded edits (admin/src/utils/spreadsheets/cellMapLineage.js):
// diffWorkbook compares only the cells that edits, undo/redo and other people's saves
// touched since the saved workbook, and must find exactly what a full comparison of
// every cell finds.
import test from "node:test";
import assert from "node:assert/strict";
import { diffWorkbook, MAX_PATCH_CELLS } from "../../admin/src/components/tables/spreadsheet/workbookDiff.js";
import { applyWorkbookUpdate, applyHistoryRecord } from "../../admin/src/utils/spreadsheets/workbookUpdate.js";
import { rebaseRemotePatch } from "../../admin/src/utils/spreadsheets/workbookSync.js";
import { cellMapChanges } from "../../admin/src/utils/spreadsheets/cellMapLineage.js";

const S = "S";
const workbookOf = (count) => {
    const cells = {};
    for (let i = 1; i <= count; i++) cells[`A${i}`] = { value: String(i) };
    return { [S]: { cells, rowCount: count, columnCount: 1 } };
};
const update = (workbook, fn) => applyWorkbookUpdate(workbook, (draft) => fn(draft[S].cells));
// The same comparison with nothing on record: fresh copies of both cell maps
// (holding the same cell objects) force diffWorkbook to look at every cell.
const fullDiff = (base, next) => diffWorkbook(
    { [S]: { ...base[S], cells: { ...base[S].cells } } },
    { [S]: { ...next[S], cells: { ...next[S].cells } } },
);
const assertSameAsFull = (base, next) => {
    const fast = diffWorkbook(base, next);
    const full = fullDiff(base, next);
    if (full === null) return assert.equal(fast, null);
    const sorted = (patch) => {
        const entry = patch.sheets[S];
        return entry ? { ...entry, ...(entry.del ? { del: [...entry.del].sort() } : {}) } : undefined;
    };
    assert.deepEqual(sorted(fast), sorted(full));
    return fast;
};

test("a run of edits is diffed from the cells they touched", () => {
    const saved = workbookOf(1000);
    let live = saved;
    live = update(live, (cells) => { cells.A1 = { value: "x" }; }).next;
    live = update(live, (cells) => { delete cells.A2; cells.B9 = { value: "new" }; }).next;
    live = update(live, (cells) => { cells.A1 = saved[S].cells.A1; }).next; // put back as it was
    assert.deepEqual(cellMapChanges(saved[S].cells, live[S].cells, Infinity), new Set(["A1", "A2", "B9"]));
    const patch = assertSameAsFull(saved, live);
    assert.deepEqual(patch.sheets[S], { set: { B9: { value: "new" } }, del: ["A2"] });
});

test("undo and redo keep the record", () => {
    const saved = workbookOf(100);
    const { next: edited, undo } = update(saved, (cells) => { cells.A5 = { value: "five" }; delete cells.A6; });
    const { next: undone, inverse } = applyHistoryRecord(edited, undo);
    assert.ok(cellMapChanges(saved[S].cells, undone[S].cells, Infinity));
    assert.deepEqual(assertSameAsFull(saved, undone).sheets, {});
    const { next: redone } = applyHistoryRecord(undone, inverse);
    assertSameAsFull(saved, redone);
    assertSameAsFull(edited, redone);
});

test("someone else's save taken in on both sides is not sent back", () => {
    const saved = workbookOf(100);
    const live = update(saved, (cells) => { cells.A1 = { value: "mine" }; }).next;
    const theirs = { v: 1, sheets: { [S]: { set: { A2: { value: "theirs" }, A1: { value: "theirs too" } }, del: ["A3"] } } };
    const { live: nextLive, saved: nextSaved } = rebaseRemotePatch(live, saved, theirs);
    // Neither map descends from the other; they meet at the original.
    assert.ok(cellMapChanges(nextSaved[S].cells, nextLive[S].cells, Infinity));
    const patch = assertSameAsFull(nextSaved, nextLive);
    assert.deepEqual(patch.sheets[S], { set: { A1: { value: "mine" } } });
});

test("maps too far apart, or with nothing on record, are compared in full", () => {
    const saved = workbookOf(50);
    let live = saved;
    for (let i = 0; i < 300; i++) live = update(live, (cells) => { cells.A1 = { value: String(i) }; }).next;
    assert.equal(cellMapChanges(saved[S].cells, live[S].cells, Infinity), null);
    assertSameAsFull(saved, live);
    const loaded = workbookOf(50);
    assert.equal(cellMapChanges(loaded[S].cells, saved[S].cells, Infinity), null);
    assertSameAsFull(loaded, saved);
});

test("more changed cells than a patch can hold still means a full save", () => {
    const saved = workbookOf(10);
    let live = saved;
    for (let batch = 0; batch < 3; batch++) {
        live = update(live, (cells) => {
            for (let i = 0; i < 2000; i++) cells[`B${batch * 2000 + i + 1}`] = { value: "v" };
        }).next;
    }
    assert.ok(6000 > MAX_PATCH_CELLS);
    assert.equal(diffWorkbook(saved, live), null);
});
