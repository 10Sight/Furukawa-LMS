// Run with: node --test test/sheetExcelPaste.test.js
//
// Pasting a range copied in Microsoft Excel (admin/src/utils/spreadsheets/clipboardInterop.js):
// what Excel's HTML says about merged cells, borders, fonts, number formats and the
// shapes over the range, and where those land in the grid.
//
// The sample in fixtures/excel-clipboard is written to the form of Excel's HTML
// clipboard format: classes in a commented-out <style> block, merged cells as
// colspan/rowspan, text running on into empty cells as `mso-ignore:colspan`, and
// shapes as VML inside conditional comments in the cell each starts in. Samples
// captured from a real Excel (see the capture switch in ExcelClone.jsx's paste
// handler) go in the same folder.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    parseClipboardHtmlStyles, parseDelimitedText, gridSize, mergesAfterPaste, shapesForPaste, placeClipboardShape,
    growBoundsToMerges, mergesWithin, serializeCellsToHtml,
} from "../../admin/src/utils/spreadsheets/clipboardInterop.js";

const { JSDOM } = await import("jsdom").catch(() => ({}));
const domTest = JSDOM ? test : test.skip;
const fixture = (name) => fs.readFileSync(new URL(`./fixtures/excel-clipboard/${name}`, import.meta.url), "utf8");
const read = (html) => parseClipboardHtmlStyles(new JSDOM(html).window.document);

domTest("Excel's table matches its text, so the paste uses it", () => {
    const html = read(fixture("merged-shapes.html"));
    const text = gridSize(parseDelimitedText(fixture("merged-shapes.txt")));
    assert.deepEqual([html.height, html.width], [text.height, text.width]);
});

domTest("merged cells come through; text running on into empty cells doesn't merge them", () => {
    const html = read(fixture("merged-shapes.html"));
    assert.deepEqual(html.merges, [
        { row: 0, col: 0, rowSpan: 1, colSpan: 3 }, // the title over three columns
        { row: 2, col: 3, rowSpan: 2, colSpan: 1 }, // "Tall", two rows
    ]);
    // The cells the long note ran on into keep no look of their own.
    assert.deepEqual(html.styles[2].slice(0, 3), [null, null, null]);
});

domTest("borders, fonts, alignment, wrap and number formats are read from Excel's classes", () => {
    const { styles } = read(fixture("merged-shapes.html"));
    assert.deepEqual(styles[0][0], {
        bg: "#ddebf7", bold: true, align: "center", valign: "middle", fontSize: 14, fontFamily: "Segoe UI",
        border: { top: "thin", right: "thin", bottom: "thin", left: "thin" },
    });
    assert.deepEqual(styles[1][0], { border: { right: "thin", bottom: "thick", left: "thin" }, numFmt: "#,##0.00" });
    assert.deepEqual(styles[1][1], { valign: "top", wrap: true, numFmt: "0.00%" });
    assert.deepEqual(styles[1][2], { border: { top: "double", right: "double", bottom: "double", left: "double" }, numFmt: "m/d/yyyy" });
    // The defaults Excel writes for every cell (`td { ... }`) aren't formatting.
    assert.equal(styles[1][3], null);
});

domTest("Excel's shapes keep their kind, colours, outline, turn and text", () => {
    const html = read(fixture("merged-shapes.html"));
    const [rect, oval, triangle, arrow] = html.shapes;
    assert.equal(html.shapes.length, 4);
    assert.deepEqual(rect, {
        row: 2, col: 0, x: 12, y: 8, width: 144, height: 60, shape: "rect", fill: "#4472c4", stroke: "#1f3763", strokeWidth: 1,
        text: "Plan A", textStyle: { color: "#ffffff", bold: true, fontSize: 11, align: "center" },
    });
    assert.deepEqual([oval.shape, oval.fill, oval.stroke, oval.strokeWidth], ["ellipse", "none", "#ff0000", 3]);
    assert.deepEqual([triangle.shape, triangle.fill, triangle.stroke, triangle.rotation], ["triangle", "#70ad47", "none", 90]);
    assert.deepEqual([arrow.shape, arrow.fill, arrow.width], ["lineArrow", "#ffc000", 128]);
    // The picture can't be pasted (Excel points at a file on its own computer); it's counted.
    assert.equal(html.skippedPictures, 1);
    assert.deepEqual(html.columnWidths, [64, 128, 64, 64]);
    assert.deepEqual(html.rowHeights, [40, 20, 20, 20]);
});

domTest("a diagonal line becomes a turned line as long as the diagonal", () => {
    const line = (flip) => read(`<table><tr><td><!--[if gte vml 1]><v:line style='position:absolute;${flip}' from="0,0" to="30pt,30pt" strokecolor="#000000"/><![endif]--></td></tr></table>`).shapes[0];
    const down = line("");
    assert.equal(down.shape, "lineStraight");
    assert.equal(down.width, Math.round(Math.hypot(40, 40)));
    assert.equal(down.rotation, 45);
    const flipped = read(`<table><tr><td><!--[if gte vml 1]><v:shape type="#_x0000_t32" style='position:absolute;margin-left:0;margin-top:0;width:30pt;height:30pt;flip:y' strokecolor="#000000"/><![endif]--></td></tr></table>`).shapes[0];
    assert.equal(flipped.rotation, -45);
});

test("a paste replaces the merges it covers and adds its own", () => {
    const existing = [{ start: "A1", end: "B2" }, { start: "E5", end: "F5" }, { start: "C3", end: "D9" }];
    const after = mergesAfterPaste(existing, [{ row: 0, col: 0, rowSpan: 1, colSpan: 3 }, { row: 1, col: 2, rowSpan: 5, colSpan: 1 }], { row: 2, col: 1, height: 3, width: 3 });
    // The block is B3:D5: C3:D9 overlaps it and goes.
    assert.deepEqual(after, [
        { start: "A1", end: "B2" }, // outside the pasted block: kept
        { start: "E5", end: "F5" },
        { start: "B3", end: "D3" },
        { start: "D4", end: "D5" }, // cut down to the block's edge
    ]);
    assert.deepEqual(mergesAfterPaste(existing, [], { row: 0, col: 0, height: 1, width: 1 }), existing.slice(1));
});

test("a shape sits over the same cells whatever the target's column widths", () => {
    // Over the middle of column B and half of column C in the source (64px columns).
    const shape = { row: 0, col: 1, x: 32, y: 0, width: 64, height: 20 };
    const source = { columnWidths: [64, 64, 64], rowHeights: [20] };
    const placed = placeClipboardShape(shape, source, () => 100, () => 28);
    assert.deepEqual(placed, { row: 0, col: 1, offsetX: 50, offsetY: 0, width: 100, height: 28 });

    const items = shapesForPaste({ shapes: [{ ...shape, shape: "rect", fill: "#ff0000", text: "Hi" }], ...source }, {
        row: 10, col: 2, widthOf: () => 100, heightOf: () => 28, minSize: 40,
    });
    assert.deepEqual(items, [{
        type: "shape", shape: "rect", row: 10, col: 3, offsetX: 50, offsetY: -6, width: 100, height: 40, fill: "#ff0000", text: "Hi",
    }]);
});

domTest("number formats are unescaped, and Excel's named formats read as their codes", () => {
    const fmtOf = (css) => read(`<table><tr><td style='${css}'>1</td></tr></table>`)?.styles[0][0]?.numFmt;
    assert.equal(fmtOf('mso-number-format:"\\0022$\\0022\\#\\,\\#\\#0\\.00"'), '"$"#,##0.00');
    assert.equal(fmtOf("mso-number-format:Standard"), "#,##0.00");
    assert.equal(fmtOf('mso-number-format:"\\@"'), "@");
    assert.equal(fmtOf("mso-number-format:General"), undefined);
});

// --- Copying merged cells inside the grid ---

test("a range touching a merged cell takes in all of it, however the merges chain", () => {
    const merges = [{ start: "B2", end: "C3" }, { start: "D3", end: "E3" }, { start: "H8", end: "H9" }];
    // Clicking B2 (the top-left cell of B2:C3) selects the whole merge.
    assert.deepEqual(growBoundsToMerges({ minRow: 1, maxRow: 1, minCol: 1, maxCol: 1 }, merges), { minRow: 1, maxRow: 2, minCol: 1, maxCol: 2 });
    // C3:D3 touches both B2:C3 and D3:E3.
    assert.deepEqual(growBoundsToMerges({ minRow: 2, maxRow: 2, minCol: 2, maxCol: 3 }, merges), { minRow: 1, maxRow: 2, minCol: 1, maxCol: 4 });
    const alone = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
    assert.equal(growBoundsToMerges(alone, merges), alone);
});

test("a copy carries the merges inside it, relative to its top-left cell", () => {
    const merges = [{ start: "B2", end: "C3" }, { start: "E1", end: "F1" }, { start: "A9", end: "B9" }];
    assert.deepEqual(mergesWithin(merges, { minRow: 0, maxRow: 4, minCol: 1, maxCol: 5 }), [
        { row: 1, col: 0, rowSpan: 2, colSpan: 2 },
        { row: 0, col: 3, rowSpan: 1, colSpan: 2 },
    ]);
});

domTest("the grid's own clipboard table carries its merges and colours, and reads back the same", () => {
    const rows = [["Title", "", ""], ["1", "2", "3"]];
    const merges = [{ row: 0, col: 0, rowSpan: 1, colSpan: 3 }];
    const html = serializeCellsToHtml(rows, "clip1", (r, c) => (r === 0 && c === 0 ? "background:#ffff00;font-weight:bold;" : ""), merges);
    assert.match(html, /<td colspan="3" style="background:#ffff00;font-weight:bold;">Title<\/td><\/tr>/);
    const back = read(html);
    assert.deepEqual([back.height, back.width], [2, 3]);
    assert.deepEqual(back.merges, merges);
    assert.deepEqual(back.styles[0], [{ bg: "#ffff00", bold: true }, { bg: "#ffff00", bold: true }, { bg: "#ffff00", bold: true }]);
});
