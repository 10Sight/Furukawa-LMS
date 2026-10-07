// Run with: node --test test/sheetClipboard.test.js
//
// Cells on the system clipboard (portal/src/utils/spreadsheets/clipboardInterop.js):
// reading what Excel and other programs copy, writing what the grid copies, and telling
// the grid's own copy from someone else's.
import test from "node:test";
import assert from "node:assert/strict";
import {
    parseDelimitedText, gridSize, serializeCellsToText, serializeCellsToHtml, readClipMarker,
    buildClipboardPayload, isOwnClip, normalizeNewlines, newClipId
} from "../../portal/src/utils/spreadsheets/clipboardInterop.js";

test("rows and columns as Excel copies them", () => {
    // Excel on Windows: tabs between cells, \r\n after every row including the last.
    assert.deepEqual(parseDelimitedText("Line\tTarget\tActual\r\nL1\t100\t96\r\nL2\t120\t121\r\n"), [
        ["Line", "Target", "Actual"], ["L1", "100", "96"], ["L2", "120", "121"],
    ]);
    assert.deepEqual(parseDelimitedText("a\tb\nc\td"), [["a", "b"], ["c", "d"]], "no trailing line break");
    assert.deepEqual(parseDelimitedText("a\rb\r"), [["a"], ["b"]], "old Mac line breaks");
    assert.deepEqual(parseDelimitedText("just text"), [["just text"]]);
    assert.deepEqual(parseDelimitedText(""), []);
    assert.deepEqual(parseDelimitedText(null), []);
});

test("empty cells keep their place", () => {
    assert.deepEqual(parseDelimitedText("a\t\tc\r\n\t\t\r\n\tb\t\r\n"), [["a", "", "c"], ["", "", ""], ["", "b", ""]]);
    // A single empty cell, and a blank row between two filled ones.
    assert.deepEqual(parseDelimitedText("\r\n"), [[""]]);
    assert.deepEqual(parseDelimitedText("a\n\nb\n"), [["a"], [""], ["b"]]);
    assert.deepEqual(parseDelimitedText("a\t"), [["a", ""]]);
    assert.deepEqual(parseDelimitedText("  padded \t x"), [["  padded ", " x"]], "spaces are part of the value");
});

test("a quoted cell keeps its line breaks, tabs and quotes", () => {
    assert.deepEqual(parseDelimitedText('"line one\nline two"\tnext\r\n'), [["line one\nline two", "next"]]);
    assert.deepEqual(parseDelimitedText('a\t"has\ttab"\r\n"He said ""hi"""\tb\r\n'), [["a", "has\ttab"], ['He said "hi"', "b"]]);
    assert.deepEqual(parseDelimitedText('"multi\r\nline"'), [["multi\nline"]]);
    assert.deepEqual(parseDelimitedText('""\tx'), [["", "x"]]);
});

test("quotes that don't wrap a whole cell are ordinary characters", () => {
    assert.deepEqual(parseDelimitedText('5" pipe\t10" pipe'), [['5" pipe', '10" pipe']]);
    assert.deepEqual(parseDelimitedText('"a" and "b"\tc'), [['"a" and "b"', "c"]]);
    assert.deepEqual(parseDelimitedText('"never closed\tx\ny'), [['"never closed', "x"], ["y"]]);
    assert.deepEqual(parseDelimitedText('say "hi"'), [['say "hi"']]);
});

test("size is the number of rows by the longest row", () => {
    assert.deepEqual(gridSize([]), { height: 0, width: 0 });
    assert.deepEqual(gridSize([["a"], ["b", "c", "d"], []]), { height: 3, width: 3 });
});

test("what the grid copies reads back as the same cells", () => {
    const grids = [
        [["Line", "Target"], ["L1", "100"]],
        [["multi\nline", 'quote " inside', "tab\tinside"], ["", "plain", ""]],
        [["=SUM(A1:A3)", "  spaced  "]],
        [['"quoted whole"', "a"]],
    ];
    for (const rows of grids) assert.deepEqual(parseDelimitedText(serializeCellsToText(rows)), rows, JSON.stringify(rows));
    // And as Windows hands it back, with \r\n line breaks.
    const text = serializeCellsToText(grids[1]).replace(/\n/g, "\r\n");
    assert.deepEqual(parseDelimitedText(text), grids[1]);
    assert.equal(serializeCellsToText([["a", "b"], ["c", "d"]]), "a\tb\nc\td");
    assert.equal(serializeCellsToText([[5, null, undefined]]), "5\t\t");
    // One empty cell is no text at all — unlike Excel, nothing is added after the last
    // row, so a single value pastes into a text field without a stray line break.
    assert.equal(serializeCellsToText([[""]]), "");
});

test("the HTML table is escaped and carries the copy's id", () => {
    const html = serializeCellsToHtml([["<b>bold</b> & co", 'say "hi"'], ["two\nlines", ""]], "abc123");
    assert.equal(html, '<table data-sheet-clip="abc123"><tbody><tr><td>&lt;b&gt;bold&lt;/b&gt; &amp; co</td><td>say &quot;hi&quot;</td></tr><tr><td>two<br>lines</td><td></td></tr></tbody></table>');
    assert.equal(readClipMarker(html), "abc123");
    // As a browser hands it back, wrapped in a fragment.
    assert.equal(readClipMarker(`<html><body><!--StartFragment-->${html}<!--EndFragment--></body></html>`), "abc123");
    assert.equal(readClipMarker("<table><tr><td>from Excel</td></tr></table>"), null);
    assert.equal(readClipMarker('<table data-sheet-clip="bad id!">'), null);
    assert.equal(readClipMarker(""), null);
    assert.equal(readClipMarker(null), null);
});

test("a copy's payload: text always, the table unless it is huge", () => {
    const small = buildClipboardPayload([["a", "b"]]);
    assert.equal(small.text, "a\tb");
    assert.equal(readClipMarker(small.html), small.id);
    assert.match(small.id, /^[A-Za-z0-9_-]{8,64}$/);
    assert.notEqual(newClipId(), newClipId());

    const wide = Array.from({ length: 201 }, () => Array.from({ length: 100 }, () => "x"));
    const large = buildClipboardPayload(wide);
    assert.equal(large.html, null);
    assert.equal(parseDelimitedText(large.text).length, 201);
});

test("the grid's own copy is recognised, and so is its being replaced", () => {
    const payload = buildClipboardPayload([["a", "b"], ["two\nlines", "d"]]);
    const own = { id: payload.id, text: payload.text, written: true };
    assert.equal(isOwnClip(own, { text: payload.text, html: payload.html }), true);
    // The browser gave back only the text, with Windows line breaks.
    assert.equal(isOwnClip(own, { text: payload.text.replace(/\n/g, "\r\n"), html: "" }), true);
    assert.equal(normalizeNewlines("a\r\nb\rc"), "a\nb\nc");
    // Only the marker survives (text altered by the source).
    assert.equal(isOwnClip(own, { text: "something else", html: payload.html }), true);
    // Something else was copied since.
    assert.equal(isOwnClip(own, { text: "from Excel\t1\r\n", html: "<table><tr><td>from Excel</td></tr></table>" }), false);
    assert.equal(isOwnClip(own, { text: "", html: "" }), false);
    assert.equal(isOwnClip(own), false);
    // Another copy made by a grid (another tab, an earlier copy) isn't this one.
    assert.equal(isOwnClip(own, { text: "other", html: serializeCellsToHtml([["other"]], "someone-else") }), false);

    // The copy never reached the system clipboard: nothing there can have replaced it.
    assert.equal(isOwnClip({ ...own, written: false }, { text: "stale text from earlier", html: "" }), true);
    assert.equal(isOwnClip(null, { text: payload.text, html: payload.html }), false);
});
