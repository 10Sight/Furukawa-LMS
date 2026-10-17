// Measures how the spreadsheet code paths behind ExcelClone scale with the
// number of cells, so decisions about the 10M-cell plan rest on numbers.
//
//   node admin/scripts/benchmarks/spreadsheetScale.mjs                 # 100k, 250k, 500k, 1M
//   node admin/scripts/benchmarks/spreadsheetScale.mjs 1000000 2000000 # chosen sizes
//   add --xlsx to also time an ExcelJS import (slow: it writes the file first)
//
// Each size runs in its own child process (--expose-gc, 4 GB heap, roughly a
// Chrome tab's ceiling) so one size's garbage doesn't skew the next. What is
// timed is the real module code, not ExcelClone itself: React render cost and
// the component's own per-render scans come on top of these numbers.

import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const admin = path.resolve(here, "../..");
const src = (p) => pathToFileURL(path.join(admin, "src", p)).href;

const COLS = 20; // A..T
const FORMULA_COLS = 2; // the last two columns hold formulas
const STYLED_SHARE = 0.3; // share of cells carrying formatting, as an import from Excel would

const args = process.argv.slice(2);
const childSize = args.find((a) => a.startsWith("--child="))?.slice(8);

// ---------------------------------------------------------------------------
// Driver: run each size in a fresh process and print a table.

if (!childSize) {
    const withXlsx = args.includes("--xlsx");
    const sizes = args.filter((a) => /^\d+$/.test(a)).map(Number);
    const runSizes = sizes.length ? sizes : [100_000, 250_000, 500_000, 1_000_000];
    const rows = [];
    for (const size of runSizes) {
        process.stderr.write(`running ${size.toLocaleString()} cells...\n`);
        const out = spawnSync(process.execPath, [
            "--expose-gc", "--max-old-space-size=4096", fileURLToPath(import.meta.url),
            `--child=${size}`, ...(withXlsx ? ["--xlsx"] : []),
        ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        const line = out.stdout.trim().split("\n").pop();
        try {
            rows.push(JSON.parse(line));
        } catch {
            rows.push({ cells: size, error: (out.stderr || "").trim().split("\n").slice(-3).join(" | ") || `exit ${out.status}` });
        }
    }
    const metrics = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const width = Math.max(...metrics.map((m) => m.length));
    console.log(["metric".padEnd(width), ...rows.map((r) => String(r.cells.toLocaleString()).padStart(14))].join("  "));
    for (const m of metrics) {
        if (m === "cells") continue;
        console.log([m.padEnd(width), ...rows.map((r) => String(r[m] ?? "").padStart(14))].join("  "));
    }
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Child: one size.

const { evaluateSheet, getCellId } = await import(src("utils/spreadsheets/formulaEngine.js"));
const { applyWorkbookUpdate } = await import(src("utils/spreadsheets/workbookUpdate.js"));
const { diffWorkbook } = await import(src("components/tables/spreadsheet/workbookDiff.js"));
const { parseDelimitedText } = await import(src("utils/spreadsheets/clipboardInterop.js"));
const serverUtils = pathToFileURL(path.resolve(admin, "../server/utils/sheetWorkbook.js")).href;
const { normalizeWorkbook, applyPatch, foldPatches } = await import(serverUtils);

const size = Number(childSize);
const rowCount = Math.ceil(size / COLS);
const SHEET = "Sheet 1";
const result = { cells: size };

const gc = () => { global.gc(); global.gc(); };
const heapMB = () => { gc(); return process.memoryUsage().heapUsed / 1048576; };
const ms = (fn) => { const t = performance.now(); const v = fn(); return [v, performance.now() - t]; };
const fmt = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
// Median of several runs, for the per-edit operations that repeat on every keystroke.
const median = (runs, fn) => {
    const times = [];
    for (let i = 0; i < runs; i++) times.push(ms(fn)[1]);
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
};

// Every styled cell gets its own style object, the way extractExcelCellStyle
// builds one per imported cell.
const styleFor = (r, c) => ({
    bold: c === 0,
    fontSize: 11,
    fontFamily: "Calibri",
    color: "#1E293B",
    bg: r % 2 ? "#F1F5F9" : "#FFFFFF",
    align: c === 0 ? "left" : "right",
    border: { top: "thin", bottom: "thin", left: "thin", right: "thin" },
    ...(c > 0 ? { numberFormat: "number", decimalPlaces: 2 } : {}),
});

const valueFor = (r, c) => {
    const row = r + 1;
    if (c === 0) return `Item ${row}`;
    if (c === COLS - 2) return `=B${row}*C${row}`;
    if (c === COLS - 1) return `=SUM(B${row}:${String.fromCharCode(65 + COLS - 3)}${row})`;
    return String(((r * 31 + c * 17) % 1000) + 0.25);
};

const buildCells = (styled) => {
    const cells = {};
    let n = 0;
    for (let r = 0; r < rowCount && n < size; r++) {
        for (let c = 0; c < COLS && n < size; c++, n++) {
            const value = valueFor(r, c);
            const withStyle = styled && ((r * COLS + c) * 2654435761 % 1000) / 1000 < STYLED_SHARE;
            cells[getCellId(r, c)] = withStyle ? { value, ...styleFor(r, c) } : { value };
        }
    }
    return cells;
};

// --- Memory: values only, then values + formatting ---------------------------
let base = heapMB();
let plain = buildCells(false);
result["heap MB, values only"] = fmt(heapMB() - base);
plain = null;

base = heapMB();
const cells = buildCells(true);
result["heap MB, values+styles"] = fmt(heapMB() - base);
result["bytes / cell"] = fmt(((heapMB() - base) * 1048576) / size);

const sheet = { cells, rowCount, columnCount: COLS, conditionalRules: [], merges: [], columnWidths: {}, rowHeights: {}, tables: [], media: [], commentAnchors: {} };
let workbook = { [SHEET]: sheet };

// --- Formula evaluation -----------------------------------------------------
// evaluateSheet runs every time `cells` changes (ExcelClone's useMemo), so the
// first-load number is also roughly the per-edit number unless the index is
// derived incrementally (which it is for tracked edits; see below).
const readViewport = (evaluation) => {
    for (let r = 0; r < 50; r++) for (let c = 0; c < COLS; c++) evaluation.display[getCellId(r, c)];
};
const heapBeforeEval = heapMB();
const [firstEval, firstEvalMs] = ms(() => evaluateSheet(cells));
result["evaluate, first load ms"] = fmt(firstEvalMs);
result["read 1000-cell viewport ms"] = fmt(ms(() => readViewport(firstEval))[1]);
result["evaluation heap MB (results + index)"] = fmt(heapMB() - heapBeforeEval);

// --- One keystroke: edit one cell -------------------------------------------
// The path ExcelClone's commit takes: applyWorkbookUpdate (copy-on-write cell
// map) -> evaluateSheet on the new map -> diffWorkbook for the save patch.
let editNo = 0;
const editOnce = (wb) => applyWorkbookUpdate(wb, (draft) => {
    const id = `B${(editNo++ % rowCount) + 1}`;
    draft[SHEET].cells[id] = { ...draft[SHEET].cells[id], value: String(editNo) };
}).next;

// The first edit after loading also turns the loaded cell map into a chunked one.
const [afterLoad, firstEditMs] = ms(() => editOnce(workbook));
result["edit: first after load ms"] = fmt(firstEditMs);
readViewport(evaluateSheet(afterLoad[SHEET].cells));
// Then edits the way typing makes them: each one made from, and evaluated
// after, the one before; the save patch is against the workbook as loaded.
const times = { copy: [], evaluate: [], diff: [] };
let live = afterLoad;
let patch = null;
for (let i = 0; i < 7; i++) {
    const [next, copyMs] = ms(() => editOnce(live));
    const [, evaluateMs] = ms(() => readViewport(evaluateSheet(next[SHEET].cells)));
    const [nextPatch, diffMs] = ms(() => diffWorkbook(workbook, next));
    times.copy.push(copyMs); times.evaluate.push(evaluateMs); times.diff.push(diffMs);
    live = next;
    patch = nextPatch;
}
const mid = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
result["edit: copy-on-write ms"] = fmt(mid(times.copy));
result["edit: re-evaluate ms"] = fmt(mid(times.evaluate));
result["edit: diff for save ms"] = fmt(mid(times.diff));
// A chunked map read through its Proxy: a full evaluation (F9 re-rolls the
// seed, so nothing is reused) and a full save.
result["F9 full evaluate, chunked ms"] = fmt(ms(() => readViewport(evaluateSheet(live[SHEET].cells, { seed: 1 })))[1]);
result["JSON.stringify, chunked ms"] = fmt(ms(() => JSON.stringify({ sheets: live, activeSheet: SHEET }))[1]);
result["edit: total ms"] = fmt(
    Number(result["edit: copy-on-write ms"]) + Number(result["edit: re-evaluate ms"]) + Number(result["edit: diff for save ms"]),
);

// --- Saving / loading the whole workbook as JSON -----------------------------
const stored = { sheets: workbook, activeSheet: SHEET };
const [json, stringifyMs] = ms(() => JSON.stringify(stored));
result["JSON size MB"] = fmt(json.length / 1048576);
result["JSON.stringify ms"] = fmt(stringifyMs);
result["JSON.parse ms"] = fmt(ms(() => JSON.parse(json))[1]);

// --- Server ------------------------------------------------------------------
result["server: normalize ms"] = fmt(ms(() => normalizeWorkbook(JSON.parse(json)))[1]);
const serverWb = normalizeWorkbook(JSON.parse(json));
result["server: apply 1 patch ms"] = fmt(ms(() => applyPatch(serverWb, patch))[1]);
result["server: fold (compaction) ms"] = fmt(ms(() => foldPatches(json, [JSON.stringify(patch)]))[1]);

// --- Paste: tab-separated text of the same number of cells ------------------
const tsvRows = [];
for (let r = 0; r < rowCount; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) row.push(c === 0 ? `Item ${r + 1}` : String(r + c));
    tsvRows.push(row.join("\t"));
}
const tsv = tsvRows.join("\n");
tsvRows.length = 0;
result["paste: parse TSV ms"] = fmt(ms(() => parseDelimitedText(tsv))[1]);

// --- Optional: ExcelJS import (what the app's import runs on the main thread) -
if (args.includes("--xlsx")) {
    const ExcelJS = (await import("exceljs")).default;
    const out = new ExcelJS.Workbook();
    const ws = out.addWorksheet(SHEET);
    for (let r = 0; r < rowCount; r++) {
        const values = [];
        for (let c = 0; c < COLS; c++) {
            const v = valueFor(r, c);
            values.push(v.startsWith("=") ? { formula: v.slice(1) } : c === 0 ? v : Number(v));
        }
        ws.addRow(values);
    }
    const buffer = await out.xlsx.writeBuffer();
    result["xlsx file MB"] = fmt(buffer.byteLength / 1048576);
    const before = heapMB();
    const t = performance.now();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    result["ExcelJS load ms"] = fmt(performance.now() - t);
    result["ExcelJS heap MB"] = fmt(heapMB() - before);
}

console.log(JSON.stringify(result));
