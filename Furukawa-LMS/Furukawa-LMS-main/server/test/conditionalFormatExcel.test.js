// Conditional formatting: formula rules, explicit cut-off points, and the
// round trip through an .xlsx file (rules -> ExcelJS -> file -> ExcelJS -> rules).

import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { evaluateSheet } from "../../admin/src/utils/spreadsheets/formulaEngine.js";
import { computeConditionalFormats } from "../../admin/src/utils/spreadsheets/conditionalFormat.js";
import { rulesFromExcel, rulesToExcel, readStopIfTrue, writeStopIfTrue } from "../../admin/src/utils/spreadsheets/conditionalFormatExcel.js";

const sheetOf = (values) => Object.fromEntries(Object.entries(values).map(([id, value]) => [id, { value }]));
const run = (values, rules) => {
    const cells = sheetOf(values);
    const { display, raw, evaluateAt } = evaluateSheet(cells);
    return computeConditionalFormats(rules, { display, raw, cells, evaluateAt });
};
const range = (start, end) => [{ start, end }];
const marked = (out) => Object.keys(out).filter((id) => out[id].style?.bg).sort();
const fmt = { bg: "#ffc7ce", color: "#9c0006", bold: true };

test("a formula rule is read afresh at each cell, $ parts staying put", () => {
    const values = { A1: "1", B1: "50", A2: "2", B2: "150", A3: "3", B3: "250", D1: "100" };
    // Highlights the whole row where column B beats the fixed cell D1.
    const out = run(values, [{ id: "1", type: "formula", formula: "=$B1>$D$1", ranges: range("A1", "B3"), format: fmt }]);
    assert.deepEqual(marked(out), ["A2", "A3", "B2", "B3"]);
    // Banded rows, and a formula that looks at the cell itself.
    assert.deepEqual(marked(run(values, [{ id: "1", type: "formula", formula: "=MOD(ROW(),2)=0", ranges: range("A1", "A3"), format: fmt }])), ["A2"]);
    assert.deepEqual(marked(run(values, [{ id: "1", type: "formula", formula: "=AND(B1>100,B1<200)", ranges: range("B1", "B3"), format: fmt }])), ["B2"]);
});

test("a formula rule ignores errors, text and unreadable formulas", () => {
    const values = { A1: "5", A2: "abc", A3: "0" };
    assert.deepEqual(marked(run(values, [{ id: "1", type: "formula", formula: "=1/A1", ranges: range("A1", "A3"), format: fmt }])), ["A1"]);
    assert.deepEqual(marked(run(values, [{ id: "1", type: "formula", formula: "=A1+", ranges: range("A1", "A3"), format: fmt }])), []);
    assert.deepEqual(marked(run(values, [{ id: "1", type: "formula", formula: '="yes"', ranges: range("A1", "A3"), format: fmt }])), []);
});

test("a cell value rule can compare against a formula", () => {
    const values = { A1: "10", B1: "4", A2: "10", B2: "6", A3: "10", B3: "20" };
    // Each A cell against twice its neighbour in B.
    const out = run(values, [{ id: "1", type: "cellIs", operator: "gt", value: "=B1*2", ranges: range("A1", "A3"), format: fmt }]);
    assert.deepEqual(marked(out), ["A1"]);
});

test("explicit cut-off points drive colour scales, icon sets and data bars", () => {
    const values = { A1: "0", A2: "50", A3: "100", A4: "200" };
    const scale = run(values, [{ id: "1", type: "colorScale", colors: ["#000000", "#ffffff"], points: [{ type: "num", value: 0 }, { type: "num", value: 100 }], ranges: range("A1", "A4") }]);
    assert.equal(scale.A3.style.bg, "#ffffff");
    assert.equal(scale.A4.style.bg, "#ffffff"); // beyond the top point: clamped
    const icons = run(values, [{ id: "1", type: "iconSet", set: "3Arrows", points: [{ type: "percent", value: 0 }, { type: "num", value: 60 }, { type: "num", value: 150 }], ranges: range("A1", "A4") }]);
    assert.deepEqual(["A1", "A2", "A3", "A4"].map((id) => icons[id].icon.index), [2, 2, 1, 0]);
    const bars = run(values, [{ id: "1", type: "dataBar", color: "#638ec6", points: [{ type: "num", value: 0 }, { type: "num", value: 400 }], ranges: range("A1", "A4") }]);
    assert.equal(bars.A4.dataBar.pct, 0.5);
});

// Everything the app can express, as it should come back from a file.
const SAMPLE_RULES = [
    { type: "formula", formula: "=$A1>50", ranges: [{ start: "A1", end: "A10" }, { start: "C1", end: "C5" }], format: fmt, stopIfTrue: true },
    { type: "cellIs", operator: "between", value: "10", value2: "30", ranges: range("A1", "A10"), format: fmt },
    { type: "cellIs", operator: "neq", value: "done", ranges: range("B1", "B10"), format: { color: "#ff0000", italic: true } },
    { type: "cellIs", operator: "gte", value: "=$D$1*2", ranges: range("A1", "A10"), format: fmt },
    { type: "text", operator: "contains", text: "ab", ranges: range("B1", "B10"), format: fmt },
    { type: "text", operator: "beginsWith", text: 'x"y', ranges: range("B1", "B10"), format: fmt },
    { type: "blanks", ranges: range("B1", "B10"), format: { borderColor: "#00aa00" } },
    { type: "errors", ranges: range("B1", "B10"), format: fmt },
    { type: "date", period: "lastWeek", ranges: range("E1", "E10"), format: fmt },
    { type: "top", rank: 3, bottom: true, ranges: range("A1", "A10"), format: fmt },
    { type: "top", rank: 20, percent: true, ranges: range("A1", "A10"), format: fmt },
    { type: "average", mode: "below", ranges: range("A1", "A10"), format: fmt },
    { type: "duplicate", ranges: range("A1", "A10"), format: fmt },
    { type: "colorScale", colors: ["#f8696b", "#ffeb84", "#63be7b"], points: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }], ranges: range("A1", "A10") },
    { type: "colorScale", colors: ["#ffffff", "#ff0000"], points: [{ type: "num", value: 0 }, { type: "num", value: 100 }], ranges: range("A1", "A10") },
    { type: "iconSet", set: "4Arrows", reverse: true, points: [{ type: "percent", value: 0 }, { type: "percent", value: 25 }, { type: "num", value: 60 }, { type: "percentile", value: 90 }], ranges: range("A1", "A10") },
    { type: "dataBar", color: "#638ec6", gradient: false, ranges: range("A1", "A10") },
];

const roundTrip = async (rules) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data & more");
    for (let r = 1; r <= 10; r++) worksheet.getCell(r, 1).value = r * 10;
    const { blocks, stopIfTrue } = rulesToExcel(rules);
    for (const block of blocks) worksheet.addConditionalFormatting(block);
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    await writeStopIfTrue(zip, { [worksheet.id]: stopIfTrue });
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    const stops = await readStopIfTrue(await JSZip.loadAsync(buffer));
    const sheet = loaded.getWorksheet("Data & more");
    return rulesFromExcel(sheet.conditionalFormattings, { stopIfTrue: stops[sheet.name] });
};
const withoutIds = (rules) => rules.map(({ id, ...rest }) => rest);

test("rules survive a round trip through an .xlsx file, in order", async () => {
    const { rules, skipped } = await roundTrip(SAMPLE_RULES);
    assert.equal(skipped, 0);
    assert.equal(rules.length, SAMPLE_RULES.length);
    const back = withoutIds(rules);
    const same = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16];
    for (const i of same) assert.deepEqual(back[i], SAMPLE_RULES[i], `rule ${i} (${SAMPLE_RULES[i].type})`);
    // Kinds ExcelJS can't write go out as the equivalent formula, and come back as one.
    assert.equal(back[5].type, "formula");
    assert.equal(back[5].formula, '=LEFT(B1,3)="x""y"');
    assert.equal(back[12].type, "formula");
    assert.match(back[12].formula, /COUNTIF\(\$A\$1:\$A\$10,A1\)>1/);
});

test("the formula stand-ins mark the same cells as the rules they replace", async () => {
    const values = { A1: "10", A2: "20", A3: "20", A4: "apple", A5: "40", A6: "apple" };
    const original = [{ id: "1", type: "duplicate", ranges: range("A1", "A7"), format: fmt }];
    const { rules } = await roundTrip(original);
    assert.deepEqual(marked(run(values, rules)), marked(run(values, original)));
});

test("rule kinds only Excel writes are read from the file", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("S");
    worksheet.getCell("A1").value = 1;
    worksheet.addConditionalFormatting({ ref: "A1:A9", rules: [{ type: "expression", priority: 1, formulae: ["A1>0"], style: { font: { bold: true } } }] });
    const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
    const path = "xl/worksheets/sheet1.xml";
    const extra = '<conditionalFormatting sqref="B:B"><cfRule type="duplicateValues" dxfId="0" priority="2" stopIfTrue="1"/>'
        + '<cfRule type="uniqueValues" dxfId="0" priority="3"/>'
        + '<cfRule type="endsWith" dxfId="0" priority="4" operator="endsWith" text="zz"><formula>RIGHT(B1,2)="zz"</formula></cfRule>'
        + '<cfRule type="notContainsText" dxfId="0" priority="5" operator="notContains" text="q"><formula>ISERROR(SEARCH("q",B1))</formula></cfRule></conditionalFormatting>';
    zip.file(path, (await zip.file(path).async("string")).replace("<pageMargins", `${extra}<pageMargins`));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    const stops = await readStopIfTrue(await JSZip.loadAsync(buffer));
    const { rules, skipped } = rulesFromExcel(loaded.getWorksheet("S").conditionalFormattings, { stopIfTrue: stops.S });
    assert.equal(skipped, 0);
    assert.deepEqual(rules.map((r) => r.type), ["formula", "duplicate", "unique", "text", "text"]);
    assert.equal(rules[1].stopIfTrue, true);
    assert.equal(rules[2].stopIfTrue, undefined);
    assert.deepEqual([rules[3].operator, rules[3].text, rules[4].operator, rules[4].text], ["endsWith", "zz", "notContains", "q"]);
    // A whole-column reference covers the column.
    assert.deepEqual(rules[1].ranges, [{ start: "B1", end: "B1048576" }]);
});
