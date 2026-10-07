// Run with: node --test test/sheetEngine.test.js
//
// The grid's formula engine (portal/src/utils/spreadsheets/formulaEngine.js): that
// values read many times within one evaluation — by lookups, running totals, ranges
// that overlap — come out the same as when each is read once, circular references
// included.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSheet } from "../../portal/src/utils/spreadsheets/formulaEngine.js";

const sheet = (entries) => Object.fromEntries(Object.entries(entries).map(([id, value]) => [id, { value }]));
const shown = (cells, ...ids) => { const { display } = evaluateSheet(cells, { seed: 0 }); return ids.map((id) => display[id]); };

test("cells read by many formulas give every one of them the same value", () => {
    const cells = sheet({
        A1: "10", A2: "20", A3: "30", A4: "", B1: "x", B2: "y", B3: "z",
        C1: "=SUM(A1:A3)", C2: "=SUM(A$1:A2)", C3: "=A1+A1+A1", C4: "=SUM(A1:A4)+SUM(A1:A4)",
        D1: "=VLOOKUP(20,A1:B3,2,FALSE)", D2: "=VLOOKUP(30,A1:B3,2,FALSE)", D3: "=COUNTIF(A1:A4,\">15\")",
        E1: "=C1*2", E2: "=E1+C1", E3: "=SUM(C1:C4)",
    });
    assert.deepEqual(shown(cells, "C1", "C2", "C3", "C4"), ["60", "30", "30", "120"]);
    assert.deepEqual(shown(cells, "D1", "D2", "D3"), ["y", "z", "2"]);
    assert.deepEqual(shown(cells, "E1", "E2", "E3"), ["120", "180", "240"]);
});

test("an empty cell and a missing cell both read as nothing, however often", () => {
    const cells = sheet({ A1: "5", A2: "", B1: "=A2+A2+A3+A3", B2: "=SUM(A1:A9)", B3: "=COUNTA(A1:A9)", B4: "=A1+A2" });
    assert.deepEqual(shown(cells, "B1", "B2", "B3", "B4"), ["0", "5", "1", "5"]);
});

test("a circular reference is an error wherever it is read from, and doesn't poison other cells", () => {
    const cells = sheet({
        A1: "=B1+1", B1: "=A1+1",          // each other
        C1: "=C1+1",                        // itself
        D1: "=A1", D2: "=SUM(A1:B1)",       // readers of the loop
        E1: "7", E2: "=E1*2", E3: "=E2+E1", // nothing to do with it
    });
    const [a1, b1, c1, d1, d2, e2, e3] = shown(cells, "A1", "B1", "C1", "D1", "D2", "E2", "E3");
    for (const value of [a1, b1, c1, d1, d2]) assert.match(String(value), /^#/, `expected an error, got ${value}`);
    assert.deepEqual([e2, e3], ["14", "21"]);
    // The same sheet, asked in a different order, says the same.
    assert.deepEqual(shown(cells, "E3", "D2", "D1", "C1", "B1", "A1"), [e3, d2, d1, c1, b1, a1]);
});

test("a long running total and a lookup column agree with plain arithmetic", () => {
    const N = 400;
    const entries = {};
    for (let r = 1; r <= N; r++) {
        entries[`A${r}`] = String(r);
        entries[`B${r}`] = r === 1 ? "=A1" : `=B${r - 1}+A${r}`;
        entries[`C${r}`] = `=SUM(A$1:A${r})`;
        entries[`D${r}`] = `=VLOOKUP(A${r},A$1:C$${N},3,FALSE)`;
    }
    const { display } = evaluateSheet(sheet(entries), { seed: 0 });
    for (const r of [1, 2, 57, 200, N]) {
        const total = String((r * (r + 1)) / 2);
        assert.equal(display[`B${r}`], total);
        assert.equal(display[`C${r}`], total);
        assert.equal(display[`D${r}`], total);
    }
});
