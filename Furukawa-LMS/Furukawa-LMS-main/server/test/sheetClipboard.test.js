// Run with: node --test test/sheetClipboard.test.js
//
// Cells on the system clipboard (portal/src/utils/spreadsheets/clipboardInterop.js):
// reading what Excel and other programs copy, writing what the grid copies, and telling
// the grid's own copy from someone else's.
import test from "node:test";
import assert from "node:assert/strict";
// jsdom comes in with another of the server's packages rather than as one of its own;
// where it is missing, the tests that read HTML are skipped.
const { JSDOM } = await import("jsdom").catch(() => ({}));
const domTest = JSDOM ? test : test.skip;
import {
    parseDelimitedText, gridSize, serializeCellsToText, serializeCellsToHtml, readClipMarker,
    buildClipboardPayload, isOwnClip, normalizeNewlines, newClipId, usedBoundsWithin, clearCellBlock, DENSE_WALK_CELLS,
    parseClipboardHtmlStyles
} from "../../admin/src/utils/spreadsheets/clipboardInterop.js";
import { applyWorkbookUpdate, plainOf } from "../../admin/src/utils/spreadsheets/workbookUpdate.js";

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

test("the HTML table carries each cell's formatting, where it has any", () => {
    const styles = [["background:#fde047;color:#1e3a8a;", ""], ['font-family:"Courier New";', "font-weight:bold;"]];
    const html = serializeCellsToHtml([["a", "b"], ["c", "d"]], "abc123", (r, c) => styles[r][c]);
    assert.equal(html, '<table data-sheet-clip="abc123"><tbody>'
        + '<tr><td style="background:#fde047;color:#1e3a8a;">a</td><td>b</td></tr>'
        + '<tr><td style="font-family:&quot;Courier New&quot;;">c</td><td style="font-weight:bold;">d</td></tr>'
        + "</tbody></table>");
    assert.equal(readClipMarker(html), "abc123");

    assert.match(buildClipboardPayload([["a"]], () => "color:#f00;").html, /<td style="color:#f00;">a<\/td>/);
    // Too many cells for a table: the formatting isn't even asked for.
    const big = Array.from({ length: 201 }, () => Array(100).fill("x"));
    assert.equal(buildClipboardPayload(big, () => { throw new Error("not needed"); }).html, null);
});

// Rows and columns are 0-based, as in the grid: C5 is row 4, col 2.
const block = (minRow, maxRow, minCol, maxCol) => ({ minRow, maxRow, minCol, maxCol });

test("the used part of a selection is found from the cells that exist", () => {
    const wholeColumns = block(0, 99999, 0, 2); // A:C
    assert.deepEqual(usedBoundsWithin(wholeColumns, ["B2", "C5", "A3", "D1", "E90000", "junk"]), block(1, 4, 0, 2));
    assert.deepEqual(usedBoundsWithin(wholeColumns, ["B2"], new Map([["C7", "C5"]]).keys()), block(1, 6, 1, 2), "several lists of ids");
    assert.equal(usedBoundsWithin(wholeColumns, ["D1", "Z9"], []), null);
    assert.equal(usedBoundsWithin(wholeColumns), null);
});

test("emptying a block removes its cells and no others, however large it is", () => {
    const workbook = { S: { cells: { A1: { value: "1" }, B2: { value: "2" }, B500: { value: "3" }, D2: { value: "4" } }, rowCount: 100000 } };
    for (const [bounds, left] of [
        [block(0, 9, 0, 1), ["B500", "D2"]],
        [block(1, 99999, 1, 1), ["A1", "D2"]], // column B from row 2 down
        [block(5, 8, 5, 8), ["A1", "B2", "B500", "D2"]],
    ]) {
        const large = (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1) > DENSE_WALK_CELLS;
        const { next, undo } = applyWorkbookUpdate(workbook, (draft) => {
            clearCellBlock(draft.S.cells, plainOf(draft.S.cells), bounds);
        });
        assert.deepEqual(Object.keys(next.S.cells).sort(), left, `${large ? "large" : "small"} block`); // a chunked map lists its cells block by block
        assert.equal(undo === null, left.length === 4, "nothing removed is no change at all");
    }
    assert.deepEqual(Object.keys(workbook.S.cells), ["A1", "B2", "B500", "D2"], "the workbook it started from is untouched");

    // Cells written earlier in the same update are seen too.
    const { next } = applyWorkbookUpdate(workbook, (draft) => {
        draft.S.cells.C70000 = { value: "new" };
        clearCellBlock(draft.S.cells, plainOf(draft.S.cells), block(0, 99999, 2, 2));
    });
    assert.equal(next.S.cells.C70000, undefined);
});

// --- Formatting read from another program's HTML table ---
//
// The samples below are written to the shape of what each program puts on the
// clipboard (Excel: classes in a commented-out <style> block, defaults on `td`;
// Google Sheets: everything in each cell's style attribute), cut down to a few cells.

const stylesOf = (html) => parseClipboardHtmlStyles(new JSDOM(html).window.document);

const EXCEL_HTML = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=ProgId content=Excel.Sheet>
<meta name=Generator content="Microsoft Excel 15">
<style>
<!--table
	{mso-displayed-decimal-separator:"\\.";
	mso-displayed-thousand-separator:"\\,";}
@page
	{margin:.75in .7in .75in .7in;}
tr
	{mso-height-source:auto;}
br
	{mso-data-placement:same-cell;}
td
	{padding-top:1px;
	mso-ignore:padding;
	color:black;
	font-size:11.0pt;
	font-weight:400;
	font-style:normal;
	text-decoration:none;
	font-family:Calibri, sans-serif;
	text-align:general;
	vertical-align:bottom;
	border:none;
	white-space:nowrap;}
.xl65
	{color:#1E3A8A;
	font-weight:700;
	background:#FDE047;
	mso-pattern:black none;}
.xl66
	{color:red;
	font-style:italic;
	text-decoration:underline;
	text-underline-style:single;
	text-align:center;}
.xl67
	{background:yellow;
	mso-pattern:black none;}
-->
</style>
</head>
<body link="#0563C1" vlink="#954F72">
<table border=0 cellpadding=0 cellspacing=0 width=192 style='border-collapse:
 collapse;width:144pt'>
<!--StartFragment-->
 <col width=64 span=3 style='width:48pt'>
 <tr height=20 style='height:15.0pt'>
  <td height=20 class=xl65 width=64 style='height:15.0pt;width:48pt'>Line</td>
  <td class=xl65 width=64 style='width:48pt'>Target</td>
  <td width=64 style='width:48pt'>Actual</td>
 </tr>
 <tr height=20 style='height:15.0pt'>
  <td height=20 style='height:15.0pt'>L1</td>
  <td class=xl66 align=right>100</td>
  <td class=xl67 align=right>96</td>
 </tr>
<!--EndFragment-->
</table>
</body>
</html>`;

const SHEETS_HTML = `<meta charset='utf-8'><google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style>`
    + `<table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1" style="table-layout:fixed;font-size:10pt;font-family:Arial;width:0px;border-collapse:collapse;border:none" data-sheets-root="1"><colgroup><col width="100"/><col width="100"/></colgroup><tbody>`
    + `<tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;background-color:#ffff00;font-weight:bold;color:#ff0000;" data-sheets-value="{&quot;1&quot;:2,&quot;2&quot;:&quot;Line&quot;}">Line</td>`
    + `<td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;text-align:right;text-decoration:line-through;" data-sheets-value="{&quot;1&quot;:3,&quot;3&quot;:100}">100</td></tr>`
    + `<tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;"></td>`
    + `<td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;background-color:rgb(0, 255, 0);font-style:italic;">ok</td></tr>`
    + `</tbody></table>`;

domTest("Excel's table gives its cells' colours through their classes", () => {
    const read = stylesOf(EXCEL_HTML);
    assert.deepEqual([read.height, read.width], [2, 3]);
    assert.deepEqual(read.styles, [
        [{ bg: "#fde047", color: "#1e3a8a", bold: true }, { bg: "#fde047", color: "#1e3a8a", bold: true }, null],
        [null, { color: "#ff0000", italic: true, underline: true, align: "center" }, { bg: "#ffff00" }],
    ]);
});

domTest("Google Sheets' table gives them in each cell's own style", () => {
    assert.deepEqual(stylesOf(SHEETS_HTML), {
        height: 2, width: 2,
        styles: [
            [{ bg: "#ffff00", color: "#ff0000", bold: true }, { strike: true, align: "right" }],
            [null, { bg: "#00ff00", italic: true }],
        ],
    });
});

domTest("a cell the grid copied reads back with the colours it was written with", () => {
    const html = serializeCellsToHtml([["a", "b"]], "abc123", (r, c) => (c === 0 ? "font-weight:bold;color:#1e3a8a;background:#fde047;text-align:center;" : ""));
    assert.deepEqual(stylesOf(html).styles, [[{ bg: "#fde047", color: "#1e3a8a", bold: true, align: "center" }, null]]);
});

domTest("merged cells, plain tags and odd colours", () => {
    const read = stylesOf(`<table>
        <tr><td colspan="2" rowspan="2" style="background: #abc none">wide</td><td><b>bold</b></td></tr>
        <tr><td><em>slanted</em> and not</td></tr>
        <tr><td style="color: windowtext; background-color: transparent">x</td><td style="color: rgba(255, 0, 0, 0.5)">y</td><td style="background:rgba(0,0,0,0)">z</td></tr>
    </table>`);
    assert.deepEqual(read.styles, [
        [{ bg: "#aabbcc" }, { bg: "#aabbcc" }, { bold: true }],
        [{ bg: "#aabbcc" }, { bg: "#aabbcc" }, null],
        [null, { color: "#ff0000" }, null],
    ]);
});

domTest("nothing is read where there is no table, or no formatting in it", () => {
    assert.equal(stylesOf("<p>Just <b>some</b> text</p>"), null);
    assert.equal(stylesOf("<table><tr><td>a</td><td>b</td></tr></table>"), null);
    assert.equal(stylesOf('<span style="font-weight:bold">one cell out of Sheets</span>'), null);
    assert.equal(parseClipboardHtmlStyles(null), null);
    // A table inside a cell doesn't add rows to the one it is in.
    const nested = stylesOf('<table><tr><td style="color:red">a<table><tr><td>x</td></tr><tr><td>y</td></tr></table></td></tr></table>');
    assert.deepEqual([nested.height, nested.width], [1, 1]);
    // Scripts in clipboard HTML are never run, only read past.
    assert.deepEqual(stylesOf('<table><tr><td style="color:red" onclick="x()">a<script>throw new Error("ran")</script></td></tr></table>').styles, [[{ color: "#ff0000" }]]);
});
