// Run with: node --test test/sheetCommentAnchors.test.js
//
// Where comments sit on a sheet (portal/src/utils/spreadsheets/commentEngine.js): that an
// anchor follows its cell through row and column inserts and deletes, sorts, cut and
// paste, and merges.
import test from "node:test";
import assert from "node:assert/strict";
import {
    newThreadId, shiftCommentAnchors, reorderCommentAnchorRows, moveCommentAnchorBlock, mergeCommentAnchors, threadToNoteText
} from "../../portal/src/utils/spreadsheets/commentEngine.js";

// Rows and columns are 0-based throughout, as in the grid: B4 is row 3, col 1.
const anchors = Object.freeze({ A1: "a", B4: "b", C4: "c", D10: "d" });

test("a new thread id is one the server accepts, and different every time", () => {
    const ids = new Set(Array.from({ length: 50 }, newThreadId));
    assert.equal(ids.size, 50);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
});

test("inserting rows or columns moves the anchors past that point", () => {
    assert.deepEqual(shiftCommentAnchors(anchors, "row", 3, 2), { A1: "a", B6: "b", C6: "c", D12: "d" });
    assert.deepEqual(shiftCommentAnchors(anchors, "col", 1, 1), { A1: "a", C4: "b", D4: "c", E10: "d" });
    // Nothing at or past the insert: the very same map comes back.
    assert.equal(shiftCommentAnchors(anchors, "row", 10, 3), anchors);
    assert.equal(shiftCommentAnchors(anchors, "col", 4, 1), anchors);
    assert.deepEqual(anchors, { A1: "a", B4: "b", C4: "c", D10: "d" });
});

test("deleting rows or columns drops the anchors inside and pulls the rest back", () => {
    assert.deepEqual(shiftCommentAnchors(anchors, "row", 3, -1), { A1: "a", D9: "d" });
    assert.deepEqual(shiftCommentAnchors(anchors, "row", 1, -2), { A1: "a", B2: "b", C2: "c", D8: "d" });
    assert.deepEqual(shiftCommentAnchors(anchors, "col", 1, -1), { A1: "a", B4: "c", C10: "d" });
    assert.deepEqual(shiftCommentAnchors(anchors, "col", 0, -4), {});
});

test("a sheet without anchors stays without them", () => {
    for (const none of [undefined, null, {}]) {
        assert.deepEqual(shiftCommentAnchors(none, "row", 0, 5), {});
        assert.deepEqual(mergeCommentAnchors(none, { minRow: 0, maxRow: 3, minCol: 0, maxCol: 3 }), {});
        assert.deepEqual(moveCommentAnchorBlock(none, { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }, 1, 1), {});
    }
});

test("a sort carries each row's anchors with it, within the sorted columns only", () => {
    // Rows 4..6 (index 3..5) of columns A..B sorted so that row 4 ends up last.
    const start = { A4: "first", B5: "second", C4: "outside", A9: "below" };
    const rowMap = new Map([[3, 5], [4, 3], [5, 4]]);
    assert.deepEqual(reorderCommentAnchorRows(start, { minCol: 0, maxCol: 1 }, rowMap), { A6: "first", B4: "second", C4: "outside", A9: "below" });
    assert.equal(reorderCommentAnchorRows(start, { minCol: 0, maxCol: 1 }, new Map()), start);
    // Two rows swapping places keep one anchor each.
    assert.deepEqual(reorderCommentAnchorRows({ A1: "x", A2: "y" }, { minCol: 0, maxCol: 0 }, new Map([[0, 1], [1, 0]])), { A2: "x", A1: "y" });
});

test("cut and paste moves the block's anchors and replaces the ones it lands on", () => {
    const start = { B4: "b", C4: "c", B8: "under target", E1: "elsewhere" };
    // B4:C4 moved down four rows onto B8:C8.
    assert.deepEqual(moveCommentAnchorBlock(start, { minRow: 3, maxRow: 3, minCol: 1, maxCol: 2 }, 4, 0), { B8: "b", C8: "c", E1: "elsewhere" });
    // Overlapping move, one column to the right: B4 -> C4, C4 -> D4.
    assert.deepEqual(moveCommentAnchorBlock(start, { minRow: 3, maxRow: 3, minCol: 1, maxCol: 2 }, 0, 1), { C4: "b", D4: "c", B8: "under target", E1: "elsewhere" });
    assert.equal(moveCommentAnchorBlock(start, { minRow: 3, maxRow: 3, minCol: 1, maxCol: 2 }, 0, 0), start);
    assert.equal(moveCommentAnchorBlock(start, { minRow: 20, maxRow: 21, minCol: 5, maxCol: 6 }, 3, 3), start);
});

test("merging cells leaves one comment, on the top-left cell", () => {
    const range = { minRow: 3, maxRow: 4, minCol: 1, maxCol: 2 }; // B4:C5
    // The top-left cell's own comment is kept; the others in the range go.
    assert.deepEqual(mergeCommentAnchors({ B4: "own", C4: "x", B5: "y", A1: "a" }, range), { B4: "own", A1: "a" });
    // None on the top-left cell: the first across-then-down moves there.
    assert.deepEqual(mergeCommentAnchors({ C5: "last", B5: "second", C4: "first", A1: "a" }, range), { B4: "first", A1: "a" });
    const untouched = { A1: "a", B4: "own" };
    assert.equal(mergeCommentAnchors(untouched, range), untouched);
});

test("a thread becomes a readable note", () => {
    const thread = { status: "open", messages: [{ authorName: "Asha", text: "Check this" }, { authorName: "", text: "Done" }] };
    assert.equal(threadToNoteText(thread), "Asha: Check this\n\nUser: Done");
    assert.equal(threadToNoteText({ ...thread, status: "resolved", resolvedByName: "Ravi" }), "Asha: Check this\n\nUser: Done\n\n(Resolved by Ravi)");
    assert.equal(threadToNoteText(null), "");
});
