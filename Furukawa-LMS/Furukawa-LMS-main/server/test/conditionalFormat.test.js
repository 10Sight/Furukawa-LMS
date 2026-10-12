// Conditional formatting rule engine: what each rule type marks, rule
// priority, Stop If True, legacy rules and clearing rules from a selection.

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSheet } from "../../admin/src/utils/spreadsheets/formulaEngine.js";
import {
    computeConditionalFormats, normalizeRules, clearRulesFromBounds, stampRules, parseRangesText, formatRangesText, boundsOfRange,
} from "../../admin/src/utils/spreadsheets/conditionalFormat.js";

const sheetOf = (values) => Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value }]));
const run = (values, rules, extra = {}) => {
    const cells = sheetOf(values);
    const { display, raw } = evaluateSheet(cells);
    return computeConditionalFormats(rules, { display, raw, cells, ...extra });
};
const range = (start, end) => [{ start, end }];
const column = { A1: "10", A2: "20", A3: "30", A4: "40", A5: "text" };
const marked = (out) => Object.keys(out).filter((id) => out[id].style?.bg).sort();

test("cell value rules compare numbers and skip text", () => {
    const fmt = { bg: "#ff0000" };
    assert.deepEqual(marked(run(column, [{ id: "1", type: "cellIs", operator: "gt", value: "20", ranges: range("A1", "A5"), format: fmt }])), ["A3", "A4"]);
    assert.deepEqual(marked(run(column, [{ id: "1", type: "cellIs", operator: "between", value: "20", value2: "30", ranges: range("A1", "A5"), format: fmt }])), ["A2", "A3"]);
    assert.deepEqual(marked(run(column, [{ id: "1", type: "cellIs", operator: "eq", value: "TEXT", ranges: range("A1", "A5"), format: fmt }])), ["A5"]);
    assert.deepEqual(marked(run({ ...column, C1: "25" }, [{ id: "1", type: "cellIs", operator: "lt", value: "=$C$1", ranges: range("A1", "A5"), format: fmt }])), ["A1", "A2"]);
});

test("formula results are compared by value", () => {
    const out = run({ A1: "=5*5", A2: "3" }, [{ id: "1", type: "cellIs", operator: "gte", value: "25", ranges: range("A1", "A2"), format: { bg: "#0f0" } }]);
    assert.deepEqual(marked(out), ["A1"]);
});

test("text, duplicate, blank, top and average rules", () => {
    const fmt = { bg: "#ff0000" };
    const rule = (extra) => [{ id: "1", ranges: range("A1", "A6"), format: fmt, ...extra }];
    const values = { A1: "10", A2: "20", A3: "20", A4: "apple pie", A5: "40" };
    assert.deepEqual(marked(run(values, rule({ type: "text", operator: "contains", text: "PIE" }))), ["A4"]);
    assert.deepEqual(marked(run(values, rule({ type: "duplicate" }))), ["A2", "A3"]);
    assert.deepEqual(marked(run(values, rule({ type: "unique" }))), ["A1", "A4", "A5"]);
    assert.deepEqual(marked(run(values, rule({ type: "blanks" }))), ["A6"]);
    assert.deepEqual(marked(run(values, rule({ type: "top", rank: 1 }))), ["A5"]);
    assert.deepEqual(marked(run(values, rule({ type: "top", rank: 2, bottom: true }))), ["A1", "A2", "A3"]);
    assert.deepEqual(marked(run(values, rule({ type: "top", rank: 50, percent: true }))), ["A2", "A3", "A5"]);
    assert.deepEqual(marked(run(values, rule({ type: "average", mode: "above" }))), ["A5"]);
    assert.deepEqual(marked(run(values, rule({ type: "average", mode: "below" }))), ["A1", "A2", "A3"]);
});

test("date rules read typed dates against today", () => {
    const today = 45000; // 2023-03-15
    const out = run({ A1: "2023-03-15", A2: "2023-03-14", A3: "2023-04-02", A4: "hello" },
        [{ id: "1", type: "date", period: "today", ranges: range("A1", "A4"), format: { bg: "#ff0" } }], { today });
    assert.deepEqual(marked(out), ["A1"]);
    const month = run({ A1: "2023-03-15", A2: "2023-03-01", A3: "2023-04-02" },
        [{ id: "1", type: "date", period: "thisMonth", ranges: range("A1", "A3"), format: { bg: "#ff0" } }], { today });
    assert.deepEqual(marked(month), ["A1", "A2"]);
});

test("the first rule wins a property and Stop If True hides later rules", () => {
    const rules = [
        { id: "1", type: "cellIs", operator: "gt", value: "25", ranges: range("A1", "A4"), format: { bg: "#111111" } },
        { id: "2", type: "cellIs", operator: "gt", value: "5", ranges: range("A1", "A4"), format: { bg: "#222222", bold: true } },
    ];
    const out = run(column, rules);
    assert.equal(out.A4.style.bg, "#111111");
    assert.equal(out.A4.style.bold, true);
    assert.equal(out.A1.style.bg, "#222222");
    const stopping = run(column, [{ ...rules[0], stopIfTrue: true }, rules[1]]);
    assert.equal(stopping.A4.style.bold, undefined);
    assert.equal(stopping.A1.style.bold, true);
});

test("data bars, colour scales and icon sets scale across the range", () => {
    const bars = run(column, [{ id: "1", type: "dataBar", color: "#638ec6", ranges: range("A1", "A5") }]);
    assert.equal(bars.A4.dataBar.pct, 1);
    assert.equal(bars.A1.dataBar.pct, 0.25);
    assert.equal(bars.A5, undefined);

    const scale = run(column, [{ id: "1", type: "colorScale", colors: ["#000000", "#ffffff"], ranges: range("A1", "A5") }]);
    assert.equal(scale.A1.style.bg, "#000000");
    assert.equal(scale.A4.style.bg, "#ffffff");

    const three = run({ A1: "0", A2: "50", A3: "100" }, [{ id: "1", type: "colorScale", colors: ["#ff0000", "#ffff00", "#00ff00"], ranges: range("A1", "A3") }]);
    assert.deepEqual([three.A1.style.bg, three.A2.style.bg, three.A3.style.bg], ["#ff0000", "#ffff00", "#00ff00"]);

    const icons = run({ A1: "1", A2: "50", A3: "100" }, [{ id: "1", type: "iconSet", set: "3Arrows", ranges: range("A1", "A3") }]);
    assert.deepEqual([icons.A1.icon.index, icons.A2.icon.index, icons.A3.icon.index], [2, 1, 0]);
});

test("rules saved before the rule model still apply, last rule winning", () => {
    const legacy = [
        { range: ["A1", "A4"], operator: ">", threshold: 5, color: "#aaaaaa" },
        { range: ["A1", "A4"], operator: ">", threshold: 25, color: "#bbbbbb" },
    ];
    const out = run(column, legacy);
    assert.equal(out.A4.style.bg, "#bbbbbb");
    assert.equal(out.A1.style.bg, "#aaaaaa");
    assert.equal(normalizeRules(legacy).length, 2);
    // Read off the displayed text, as before: "50%" counts as 50.
    const percent = computeConditionalFormats([{ range: ["A1", "A1"], operator: ">", threshold: 10, color: "#cccccc" }], { display: { A1: "50%" }, raw: { A1: 0.5 } });
    assert.equal(percent.A1.style.bg, "#cccccc");
});

test("clearing rules from a selection cuts a hole in the rule's range", () => {
    const rules = [{ id: "1", type: "blanks", ranges: range("A1", "C3"), format: { bg: "#f00" } }];
    const cut = clearRulesFromBounds(rules, [boundsOfRange({ start: "B2", end: "B2" })]);
    const cellsLeft = cut[0].ranges.reduce((n, r) => {
        const b = boundsOfRange(r);
        return n + (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1);
    }, 0);
    assert.equal(cellsLeft, 8);
    assert.deepEqual(clearRulesFromBounds(rules, [boundsOfRange({ start: "A1", end: "D9" })]), []);
});

test("range text round-trips", () => {
    assert.equal(formatRangesText(parseRangesText("=$a$1:$b$5, d2")), "A1:B5, D2");
    assert.equal(parseRangesText("nonsense"), null);
});

// --- Rules carried along by a fill or a paste ---

const boundsOf = (start, end = start) => boundsOfRange({ start, end });
const rangesOf = (rules) => rules.map((rule) => formatRangesText(rule.ranges));
const blanksOn = (start, end) => [{ id: "1", type: "blanks", ranges: range(start, end), format: { bg: "#f00" } }];
// With the formula engine behind it, as in the grid.
const runWithFormulas = (values, rules) => {
    const cells = sheetOf(values);
    const evaluation = evaluateSheet(cells);
    return computeConditionalFormats(rules, { display: evaluation.display, raw: evaluation.raw, cells, evaluateAt: evaluation.evaluateAt });
};

test("a fill stretches the rule over the filled cells", () => {
    assert.deepEqual(rangesOf(stampRules(blanksOn("A1", "A5"), boundsOf("A1", "A5"), boundsOf("A6", "A20"))), ["A1:A20"]);
    assert.deepEqual(rangesOf(stampRules(blanksOn("A1", "C1"), boundsOf("A1", "C1"), boundsOf("D1", "F1"))), ["A1:F1"], "to the right");
});

test("only the filled cells take the rule, not the rest of its range", () => {
    // The rule is on A1:C10; one of its cells is dragged down column A.
    assert.deepEqual(rangesOf(stampRules(blanksOn("A1", "C10"), boundsOf("A5"), boundsOf("A6", "A20"))), ["A1:C10, A11:A20"]);
});

test("a rule next to the filled cells, but not on them, is left alone", () => {
    const rules = blanksOn("B1", "B5");
    assert.equal(stampRules(rules, boundsOf("A1", "A5"), boundsOf("A6", "A20")), rules);
});

test("a fill repeats the pattern of which cells had the rule", () => {
    assert.deepEqual(rangesOf(stampRules(blanksOn("A1", "A1"), boundsOf("A1", "A2"), boundsOf("A3", "A7"))), ["A1, A3, A5, A7"]);
});

test("the cells filled over lose the rules they had", () => {
    const rules = [
        { id: "1", type: "blanks", ranges: range("A1", "A2"), format: { bg: "#f00" } },
        { id: "2", type: "noBlanks", ranges: range("A3", "A6"), format: { bg: "#0f0" } },
    ];
    assert.deepEqual(rangesOf(stampRules(rules, boundsOf("A1", "A2"), boundsOf("A3", "A4"))), ["A1:A4", "A5:A6"]);
    assert.deepEqual(rangesOf(stampRules(rules, boundsOf("A1", "A2"), boundsOf("A3", "A6"))), ["A1:A6"], "a rule with no cells left goes");
});

test("a paste takes the rule to where the cells land", () => {
    assert.deepEqual(rangesOf(stampRules(blanksOn("A1", "A3"), boundsOf("A1", "A3"), boundsOf("D5", "D7"))), ["A1:A3, D5:D7"]);
    assert.deepEqual(rangesOf(stampRules(blanksOn("A1", "A3"), boundsOf("A1", "A3"), boundsOf("A2", "A4"))), ["A1:A4"], "onto part of itself");
    const rules = blanksOn("A1", "A3");
    assert.equal(stampRules(rules, boundsOf("A1", "A3"), boundsOf("A1", "A3")), rules, "onto itself");
    assert.equal(stampRules(rules, boundsOf("F1", "F3"), boundsOf("H1", "H3")), rules, "nothing to do with the rule");
});

test("a rule's formula still tests each cell against the same cells", () => {
    // "Greater than the cell to its left", on C2:C3.
    const rules = [{ id: "1", type: "formula", formula: "=C2>B2", ranges: range("C2", "C3"), format: { bg: "#f00" } }];
    const values = { A2: "5", B2: "1", C2: "9", A3: "5", B3: "7", C3: "2" };
    assert.deepEqual(marked(runWithFormulas(values, rules)), ["C2"]);

    // Pasted one column to the left: the rule now starts at B2, so its formula is re-read there.
    const pasted = stampRules(rules, boundsOf("C2", "C3"), boundsOf("B2", "B3"));
    assert.deepEqual(rangesOf(pasted), ["B2:C3"]);
    assert.equal(pasted[0].formula, "=B2>A2");
    assert.deepEqual(marked(runWithFormulas(values, pasted)), ["B3", "C2"]);

    // Clearing the rule's first cell must not change what the others test.
    const cleared = clearRulesFromBounds(rules, [boundsOf("C2")]);
    assert.equal(cleared[0].formula, "=C3>B3");
    assert.deepEqual(marked(runWithFormulas({ ...values, C3: "8" }, cleared)), ["C3"]);
});

test("pasted on another sheet, the rules are copied there as rules of its own", () => {
    const source = [
        { id: "s1", type: "formula", formula: "=A1>10", ranges: range("A1", "B4"), format: { bg: "#f00" } },
        { id: "s2", type: "blanks", ranges: range("H1", "H9"), format: { bg: "#00f" } },
    ];
    const target = [{ id: "t1", type: "noBlanks", ranges: range("C1", "C9"), format: { bg: "#0f0" } }];
    const out = stampRules(target, boundsOf("A1", "A2"), boundsOf("C3", "C4"), source);
    assert.deepEqual(rangesOf(out), ["C3:C4", "C1:C2, C5:C9"]);
    assert.equal(out[0].formula, "=C3>10");
    assert.notEqual(out[0].id, "s1");
    assert.equal(out[1].id, "t1");
    assert.equal(source[0].ranges[0].end, "B4", "the sheet copied from keeps its rule as it was");
    assert.equal(stampRules(target, boundsOf("M1"), boundsOf("N1"), source), target, "no rule on the copied cells, none where they land");
});
