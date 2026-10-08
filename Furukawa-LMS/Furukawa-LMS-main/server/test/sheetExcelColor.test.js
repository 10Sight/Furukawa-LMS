// Run with: node --test test/sheetExcelColor.test.js
//
// Colours read from an .xlsx file (admin/src/utils/spreadsheets/excelColorResolver.js):
// every form ExcelJS hands one over in comes out as "#rrggbb".
import test from "node:test";
import assert from "node:assert/strict";
import { parseExcelColor, applyTint, EXCEL_INDEXED_COLORS } from "../../admin/src/utils/spreadsheets/excelColorResolver.js";

test("an rgb colour drops its alpha and comes out lower-case", () => {
    assert.equal(parseExcelColor({ argb: "FFFFC7CE" }), "#ffc7ce");
    assert.equal(parseExcelColor({ argb: "9C0006" }), "#9c0006");
});

test("a theme colour comes from the Office palette, shaded by its tint", () => {
    assert.equal(parseExcelColor({ theme: 0 }), "#ffffff");
    assert.equal(parseExcelColor({ theme: 4 }), "#4472c4");
    assert.equal(parseExcelColor({ theme: 4, tint: 0.4 }), `#${applyTint("4472C4", 0.4)}`);
    assert.equal(parseExcelColor({ theme: 1, tint: 0.5 }), "#808080"); // black, half way to white
    assert.equal(parseExcelColor({ theme: 0, tint: -0.5 }), "#808080"); // white, half way to black
});

test("an indexed colour comes from the legacy palette", () => {
    assert.equal(EXCEL_INDEXED_COLORS.length, 66);
    assert.equal(parseExcelColor({ indexed: 10 }), "#ff0000");
    assert.equal(parseExcelColor({ indexed: 13 }), "#ffff00");
    assert.equal(parseExcelColor({ indexed: 0 }), "#000000");
    assert.equal(parseExcelColor({ indexed: 64 }), "#000000"); // system text
    assert.equal(parseExcelColor({ indexed: 65 }), "#ffffff"); // system background
});

test("no colour, or one that can't be told, is null", () => {
    assert.equal(parseExcelColor(undefined), null);
    assert.equal(parseExcelColor({}), null);
    assert.equal(parseExcelColor({ indexed: 200 }), null);
    assert.equal(parseExcelColor({ argb: "nonsense" }), null);
});
