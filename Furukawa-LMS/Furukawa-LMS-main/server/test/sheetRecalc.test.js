// Run with: node --test test/sheetRecalc.test.js
//
// Recalculating after an edit (admin/src/utils/spreadsheets/formulaEngine.js): an
// evaluation started from the previous one re-evaluates only the formulas an edit can
// have changed, and must show exactly what evaluating the whole sheet again shows.
// Checked against random sheets put through random edits, undos and redos.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSheet, getCellId, parseCellRef } from "../../admin/src/utils/spreadsheets/formulaEngine.js";
import { applyWorkbookUpdate, applyHistoryRecord } from "../../admin/src/utils/spreadsheets/workbookUpdate.js";

const ROWS = 20, COLS = 6;
const S = "S";
const NOW = 45000.5;

const random = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const cellIdIn = (rand) => getCellId(Math.floor(rand() * ROWS), Math.floor(rand() * COLS));
const LITERALS = ["1", "2", "3.5", "-4", "10", "abc", "TRUE", "", "7%", "0"];
// A formula for the cell at `row`: it reads only rows above its own, so the
// sheet has no circular references except the rare ones put in on purpose.
const formulaAt = (rand, row) => {
    if (row === 0) return pick(rand, ["=1+1", "=TODAY()", '="x"']);
    const above = () => getCellId(Math.floor(rand() * row), Math.floor(rand() * COLS));
    const a = above(), b = above(), c = above();
    const top = Math.floor(rand() * row) + 1;
    const span = `${getCellId(0, 0)}:${getCellId(top - 1, 2)}`; // A1:C<top>
    // Now and then an array result, or a reference that can close a loop: both
    // have the sheet evaluated in full for as long as they're on it.
    if (rand() < 0.02) return "=SEQUENCE(2)";
    if (rand() < 0.02) return `=${cellIdIn(rand)}+1`;
    if (rand() < 0.03) return `=SUM(${pick(rand, ["B:B", "E:E"])})`;
    return pick(rand, [
        () => `=${a}+${b}`,
        () => `=${a}*2`,
        () => `=SUM(${span})`,
        () => `=COUNTA(${top}:${top})`,
        () => `=SUMIF(A1:A${top},">2",B1:B${top})`,
        () => `=IF(${a}>2,${b},${c})`,
        () => `=${a}&"-"&${b}`,
        () => `=SUBTOTAL(9,${span})`,
        () => `=AVERAGE(${a},${b},${c})`,
        () => `=TODAY()+${a}`,
        () => `=VLOOKUP(${a},${span},2,FALSE)`,
        () => `=MAX(${a},${span})`,
    ])();
};
const valueAt = (rand, id) => (rand() < 0.5 ? formulaAt(rand, parseCellRef(id).row) : pick(rand, LITERALS));

const view = (evaluation) => {
    const out = {};
    for (let r = 0; r < ROWS + 2; r++) for (let c = 0; c < COLS + 2; c++) {
        const id = getCellId(r, c);
        out[id] = [evaluation.display[id], evaluation.raw[id]];
    }
    return out;
};
// The same sheet with nothing on record about where its cell map came from,
// so it's evaluated from scratch.
const fullView = (cells, now) => view(evaluateSheet({ ...cells }, { now }));

const run = (seed, steps) => {
    const rand = random(seed);
    const cells = {};
    for (let i = 0; i < 60; i++) { const id = cellIdIn(rand); cells[id] = { value: valueAt(rand, id) }; }
    let workbook = { [S]: { cells, rowCount: ROWS, columnCount: COLS } };
    const undo = [], redo = [];
    let now = NOW;
    let partial = 0;
    evaluateSheet(workbook[S].cells, { now });
    for (let step = 0; step < steps; step++) {
        const roll = rand();
        if (roll < 0.1 && undo.length) {
            const { next, inverse } = applyHistoryRecord(workbook, undo.pop());
            redo.push(inverse);
            workbook = next;
        } else if (roll < 0.15 && redo.length) {
            const { next, inverse } = applyHistoryRecord(workbook, redo.pop());
            undo.push(inverse);
            workbook = next;
        } else {
            if (roll < 0.2) now += 1; // the next day: TODAY() has moved on
            const { next, undo: record } = applyWorkbookUpdate(workbook, (draft) => {
                const count = 1 + Math.floor(rand() * 3);
                for (let i = 0; i < count; i++) {
                    const id = cellIdIn(rand);
                    if (rand() < 0.15) delete draft[S].cells[id];
                    else draft[S].cells[id] = { value: valueAt(rand, id) };
                }
            });
            if (record) { undo.push(record); redo.length = 0; }
            workbook = next;
        }
        const cellsNow = workbook[S].cells;
        const evaluation = evaluateSheet(cellsNow, { now });
        const formulas = Object.values(cellsNow).filter((cell) => String(cell.value).startsWith("=")).length;
        if (evaluation.evaluatedFormulas < formulas) partial++;
        assert.deepEqual(view(evaluation), fullView(cellsNow, now), `seed ${seed}, step ${step}`);
    }
    return partial;
};

test("re-evaluating after an edit shows what evaluating the whole sheet shows", () => {
    let partial = 0;
    for (let seed = 1; seed <= 25; seed++) partial += run(seed, 120);
    // The shortcut has to actually be taken for this to mean anything.
    assert.ok(partial > 500, `only ${partial} evaluations were partial`);
});

test("an edit to a large sheet re-evaluates only the formulas that depend on it", () => {
    const cells = {};
    for (let r = 1; r <= 2000; r++) {
        cells[`A${r}`] = { value: String(r) };
        cells[`B${r}`] = { value: `=A${r}*2` };
        cells[`C${r}`] = { value: `=B${r}+1` };
    }
    cells.D1 = { value: "=SUM(C1:C2000)" };
    let workbook = { [S]: { cells, rowCount: 2000, columnCount: 4 } };
    assert.equal(evaluateSheet(workbook[S].cells, { now: NOW }).evaluatedFormulas, 4001);
    workbook = applyWorkbookUpdate(workbook, (draft) => { draft[S].cells.A7 = { value: "100" }; }).next;
    const evaluation = evaluateSheet(workbook[S].cells, { now: NOW });
    assert.equal(evaluation.evaluatedFormulas, 3); // B7, C7, D1
    assert.equal(evaluation.raw.C7, 201);
    assert.equal(evaluation.raw.D1, 2000 * 2001 + 2000 + (100 - 7) * 2);
});

// Edits one cell after another and checks each result against a full evaluation.
const checkEdits = (cells, edits) => {
    let workbook = { [S]: { cells } };
    evaluateSheet(workbook[S].cells, { now: NOW });
    for (const [id, value] of edits) {
        workbook = applyWorkbookUpdate(workbook, (draft) => {
            if (value === null) delete draft[S].cells[id]; else draft[S].cells[id] = { value };
        }).next;
        const evaluation = evaluateSheet(workbook[S].cells, { now: NOW });
        assert.ok(evaluation.evaluatedFormulas < Object.keys(workbook[S].cells).length, `${id}: evaluated in full`);
        assert.deepEqual(view(evaluation), fullView(workbook[S].cells, NOW), `after ${id} = ${value}`);
    }
};

test("a whole-column or whole-row reference follows the data past its old end", () => {
    checkEdits(
        { A1: { value: "1" }, B1: { value: "2" }, A3: { value: "3" }, D1: { value: "=SUM(A:A)" }, E1: { value: "=COUNTA(3:3)" }, F1: { value: "x" } },
        [["A15", "10"], ["A15", null], ["A3", null], ["H3", "y"], ["H3", null]],
    );
});

test("a spill reference to a formula with a single value follows that formula", () => {
    checkEdits(
        { A1: { value: "1" }, B1: { value: "=A1*2" }, C1: { value: "=SUM(B1#)" }, D1: { value: "z" } },
        [["A1", "5"], ["B1", "=A1+100"], ["B1", "7"]],
    );
});
