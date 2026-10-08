// Run with: node --test test/sheetShapeText.test.js
//
// Text inside a shape (portal/src/utils/spreadsheets/shapeText.js): the colour it
// takes on a fill, and where its lines break in the exported picture.
import test from "node:test";
import assert from "node:assert/strict";
import { readableTextColor, wrapTextLines } from "../../portal/src/utils/spreadsheets/shapeText.js";

const byLength = (s) => s.length; // every character one unit wide

test("text is white on a dark fill and dark on a light one", () => {
    assert.equal(readableTextColor("#4472C4"), "#ffffff");
    assert.equal(readableTextColor("#1e293b"), "#ffffff");
    assert.equal(readableTextColor("#fef08a"), "#1e293b");
    assert.equal(readableTextColor("#fff"), "#1e293b");
    assert.equal(readableTextColor(undefined), "#1e293b");
});

test("lines wrap at spaces", () => {
    assert.deepEqual(wrapTextLines(byLength, "review daily kpi targets", 12), ["review daily", "kpi targets"]);
    assert.deepEqual(wrapTextLines(byLength, "one two", 20), ["one two"]);
});

test("typed line breaks are kept, blank lines included", () => {
    assert.deepEqual(wrapTextLines(byLength, "a\n\nb", 10), ["a", "", "b"]);
    assert.deepEqual(wrapTextLines(byLength, "", 10), [""]);
});

test("a word too long for a line is split", () => {
    assert.deepEqual(wrapTextLines(byLength, "abcdefghij", 4), ["abcd", "efgh", "ij"]);
    assert.deepEqual(wrapTextLines(byLength, "hi abcdefgh", 4), ["hi", "abcd", "efgh"]);
});

test("a box narrower than one character still ends", () => {
    assert.deepEqual(wrapTextLines(byLength, "abc", 0), ["a", "b", "c"]);
});
