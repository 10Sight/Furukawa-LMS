// Run with: node --test test/sheetHistory.test.js
//
// The grid's undo/redo records (portal/src/utils/spreadsheets/workbookUpdate.js): that
// undoing an edit puts back what that edit changed and nothing else — in particular not
// what someone else's save brought into the workbook in the meantime (workbookSync.js).
import test from "node:test";
import assert from "node:assert/strict";
import { applyWorkbookUpdate, applyHistoryRecord, reorderSheets, canOrderSheets, isIndexLikeName } from "../../portal/src/utils/spreadsheets/workbookUpdate.js";
import { diffWorkbook } from "../../portal/src/components/tables/spreadsheet/workbookDiff.js";
import { rebaseRemotePatch } from "../../portal/src/utils/spreadsheets/workbookSync.js";

const sheet = (cells, extra = {}) => ({ cells, rowCount: 30, columnCount: 15, merges: [], media: [], commentAnchors: {}, ...extra });
const json = (value) => JSON.parse(JSON.stringify(value));

test("undo and redo of cell and setting edits restore the workbook exactly", () => {
    const start = { S: sheet({ A1: { value: "1" }, B2: { value: "2" } }, { pivotConfig: { rows: ["a"] } }), T: sheet({}) };
    const { next, undo } = applyWorkbookUpdate(start, (draft) => {
        draft.S.cells.A1 = { value: "edited" };
        delete draft.S.cells.B2;
        draft.S.cells.C3 = { value: "new" };
        draft.S.rowCount = 99;
        draft.S.merges.push({ start: "A1", end: "B1" });
        draft.S.hiddenRows = [4];
        delete draft.S.pivotConfig;
        draft.S.commentAnchors.A1 = "t1";
    });
    assert.equal(next.T, start.T);

    const undone = applyHistoryRecord(next, undo);
    assert.deepEqual(undone.next, start);
    assert.equal(undone.next.T, start.T);
    assert.equal(undone.next.S.cells.A1, start.S.cells.A1);
    assert.equal("hiddenRows" in undone.next.S, false);

    const redone = applyHistoryRecord(undone.next, undone.inverse);
    assert.deepEqual(redone.next, next);
    assert.equal("pivotConfig" in redone.next.S, false);
    assert.deepEqual(applyHistoryRecord(redone.next, redone.inverse).next, start);
});

test("an update that changes nothing leaves no record", () => {
    const start = { S: sheet({ A1: { value: "1" } }) };
    const { next, undo } = applyWorkbookUpdate(start, () => {});
    assert.equal(next, start);
    assert.equal(undo, null);
});

test("undoing a cell edit keeps settings and anchors that arrived from someone else since", () => {
    const saved = { S: sheet({ A1: { value: "1" } }, { commentAnchors: { A1: "t1" } }) };
    const mine = applyWorkbookUpdate(saved, (draft) => { draft.S.cells.B2 = { value: "mine" }; });
    // Someone else saves a comment on C3, a wider column and a merge.
    const theirs = json({ v: 1, sheets: { S: {
        anchors: { set: { C3: "theirs" } }, props: { columnWidths: { A: 200 }, merges: [{ start: "D1", end: "E1" }] }
    } } });
    const { live, saved: nextSaved } = rebaseRemotePatch(mine.next, saved, theirs);

    const undone = applyHistoryRecord(live, mine.undo);
    assert.equal("B2" in undone.next.S.cells, false);
    assert.deepEqual(undone.next.S.commentAnchors, { A1: "t1", C3: "theirs" });
    assert.deepEqual(undone.next.S.columnWidths, { A: 200 });
    assert.deepEqual(undone.next.S.merges, [{ start: "D1", end: "E1" }]);
    // Nothing of theirs is left to "save back" as a removal.
    assert.deepEqual(diffWorkbook(nextSaved, undone.next), { v: 1, sheets: {} });
});

test("undoing my own comment anchor leaves the one someone else added", () => {
    const saved = { S: sheet({}, { commentAnchors: { A1: "t1" } }) };
    const mine = applyWorkbookUpdate(saved, (draft) => {
        draft.S.commentAnchors.B2 = "mine";
        delete draft.S.commentAnchors.A1;
    });
    const theirs = json({ v: 1, sheets: { S: { anchors: { set: { C3: "theirs" } } } } });
    const { live, saved: nextSaved } = rebaseRemotePatch(mine.next, saved, theirs);
    assert.deepEqual(live.S.commentAnchors, { B2: "mine", C3: "theirs" });

    const undone = applyHistoryRecord(live, mine.undo);
    assert.deepEqual(undone.next.S.commentAnchors, { A1: "t1", C3: "theirs" });
    assert.deepEqual(diffWorkbook(nextSaved, undone.next), { v: 1, sheets: {} });

    const redone = applyHistoryRecord(undone.next, undone.inverse);
    assert.deepEqual(redone.next.S.commentAnchors, { B2: "mine", C3: "theirs" });
    assert.deepEqual(diffWorkbook(nextSaved, redone.next).sheets.S, { anchors: { set: { B2: "mine" }, del: ["A1"] } });
});

test("a sheet rebuilt wholesale is still restored whole", () => {
    const start = { S: sheet({ A1: { value: "1" }, A2: { value: "2" } }, { commentAnchors: { A2: "t1" } }) };
    // The way a row insert works: a new cell map, with the anchors moved along.
    const { next, undo } = applyWorkbookUpdate(start, (draft) => {
        draft.S.cells = { A1: start.S.cells.A1, A3: start.S.cells.A2 };
        draft.S.commentAnchors = { A3: "t1" };
        draft.S.rowCount = 31;
    });
    assert.deepEqual(next.S.commentAnchors, { A3: "t1" });
    const undone = applyHistoryRecord(next, undo);
    assert.equal(undone.next.S, start.S);
    assert.deepEqual(applyHistoryRecord(undone.next, undone.inverse).next, next);
});

test("reordering sheets moves the tabs and nothing else, and undoes and redoes", () => {
    const start = { A: sheet({ A1: { value: "a" } }), B: sheet({ A1: { value: "b" } }), C: sheet({}) };
    const { next, undo } = applyWorkbookUpdate(start, (draft) => reorderSheets(draft, ["C", "A", "B"]));
    assert.deepEqual(Object.keys(next), ["C", "A", "B"]);
    for (const name of ["A", "B", "C"]) assert.equal(next[name], start[name]); // the sheets themselves are the same objects
    assert.deepEqual(undo.sheets, {}); // the record holds the old order and no sheet contents

    const undone = applyHistoryRecord(next, undo);
    assert.deepEqual(Object.keys(undone.next), ["A", "B", "C"]);
    assert.equal(undone.next.A, start.A);
    assert.deepEqual(Object.keys(applyHistoryRecord(undone.next, undone.inverse).next), ["C", "A", "B"]);

    // The same order again is no change at all.
    assert.equal(applyWorkbookUpdate(next, (draft) => reorderSheets(draft, ["C", "A", "B"])).undo, null);
    // A reorder is not something a patch can carry: the whole workbook is saved.
    assert.equal(diffWorkbook(start, next), null);
});

test("a renamed sheet can keep its place among the tabs", () => {
    const start = { A: sheet({ A1: { value: "a" } }), B: sheet({}), C: sheet({}) };
    const { next, undo } = applyWorkbookUpdate(start, (draft) => {
        const order = Object.keys(draft).map((name) => (name === "A" ? "First" : name));
        draft.First = draft.A;
        delete draft.A;
        reorderSheets(draft, order);
    });
    assert.deepEqual(Object.keys(next), ["First", "B", "C"]);
    assert.deepEqual(next.First.cells, { A1: { value: "a" } });
    assert.deepEqual(Object.keys(applyHistoryRecord(next, undo).next), ["A", "B", "C"]);
});

test("a sheet named with a number can't be placed, and is recognised as such", () => {
    assert.equal(isIndexLikeName("2024"), true);
    assert.equal(isIndexLikeName("0"), true);
    assert.equal(isIndexLikeName("007"), false);
    assert.equal(isIndexLikeName("Q1 2024"), false);
    assert.equal(isIndexLikeName("1.5"), false);
    assert.equal(canOrderSheets(["Plan", "Actuals"]), true);
    assert.equal(canOrderSheets(["2024", "Plan"]), true); // where such a sheet sits anyway
    assert.equal(canOrderSheets(["Plan", "2024"]), false);
});
