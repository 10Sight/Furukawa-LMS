// Run with: node --test test/sheetFormulaShift.test.js
//
// The grid's formula engine (portal/src/utils/spreadsheets/formulaEngine.js): that
// inserting or deleting rows and columns leaves every formula pointing at the
// cells it pointed at before.
import test from "node:test";
import assert from "node:assert/strict";
import { shiftFormulaBands, shiftSpan } from "../../portal/src/utils/spreadsheets/formulaEngine.js";

const insertRows = (formula, at, count = 1) => shiftFormulaBands(formula, "row", at, count);
const deleteRows = (formula, at, count = 1) => shiftFormulaBands(formula, "row", at, -count);
const insertCols = (formula, at, count = 1) => shiftFormulaBands(formula, "col", at, count);
const deleteCols = (formula, at, count = 1) => shiftFormulaBands(formula, "col", at, -count);

test("a reference at or below inserted rows moves down, one above stays", () => {
    assert.equal(insertRows("=A4+B2", 2), "=A5+B2");
    assert.equal(insertRows("=A3", 2, 3), "=A6");
    assert.equal(insertCols("=C1+A1", 1, 2), "=E1+A1");
});

test("$-anchored references move too", () => {
    assert.equal(insertRows("=$A$5+A$5+$A5", 2), "=$A$6+A$6+$A6");
    assert.equal(insertCols("=$B$1", 0), "=$C$1");
});

test("a range grows when rows go in inside it, and not when they go in after it", () => {
    assert.equal(insertRows("=SUM(A1:A5)", 2), "=SUM(A1:A6)");
    assert.equal(insertRows("=SUM(A1:A5)", 5), "=SUM(A1:A5)");
    assert.equal(insertRows("=SUM(A1:A5)", 0, 2), "=SUM(A3:A7)");
    assert.equal(insertCols("=SUM(B2:D2)", 2), "=SUM(B2:E2)");
});

test("a delete trims a range, and a reference left with no cells becomes #REF!", () => {
    assert.equal(deleteRows("=SUM(A1:A5)", 3, 2), "=SUM(A1:A3)");
    assert.equal(deleteRows("=SUM(A1:A5)", 0, 2), "=SUM(A1:A3)");
    assert.equal(deleteRows("=SUM(A2:A3)+A9", 1, 2), "=SUM(#REF!)+A7");
    assert.equal(deleteRows("=A3*2", 2), "=#REF!*2");
    assert.equal(deleteCols("=C1+D1", 2), "=#REF!+C1");
});

test("whole-column and whole-row ranges follow their own axis only", () => {
    assert.equal(insertCols("=SUM(B:C)", 1), "=SUM(C:D)");
    assert.equal(insertRows("=SUM(B:C)", 1), "=SUM(B:C)");
    assert.equal(insertRows("=SUM(2:5)", 3), "=SUM(2:6)");
    assert.equal(deleteCols("=SUM($B:$C)", 1, 2), "=SUM(#REF!)");
});

test("a range written back to front keeps each end's $ signs", () => {
    assert.equal(insertRows("=SUM(B$10:A1)", 4), "=SUM(B$11:A1)");
});

test("text, function names and untouched formulas are left exactly as written", () => {
    assert.equal(insertRows('="see A5"&A5', 0), '="see A5"&A6');
    assert.equal(insertRows("=LOG10(A1)+ATAN2(B1,C1)", 0), "=LOG10(A2)+ATAN2(B2,C2)");
    assert.equal(insertRows("=sum(a1:a2)", 5), "=sum(a1:a2)");
    assert.equal(insertRows("A5 is not a formula", 0), "A5 is not a formula");
    assert.equal(insertRows(undefined, 0), undefined);
});

test("shiftSpan", () => {
    assert.deepEqual(shiftSpan(2, 4, 3, 2), [2, 6]);
    assert.deepEqual(shiftSpan(2, 4, 2, 2), [4, 6]);
    assert.deepEqual(shiftSpan(2, 4, 0, -3), [0, 1]);
    assert.equal(shiftSpan(2, 4, 2, -3), null);
});
