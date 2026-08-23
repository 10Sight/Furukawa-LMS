// Pivot table engine: groups/aggregates a rectangular source range into a
// compiled grid of plain cells (value + style), the same shape the rest of
// ExcelClone already renders. Kept separate from ExcelClone.jsx so the
// grouping/aggregation math stays independently readable and testable, and
// so ExcelGraph needs zero pivot-specific code — it just charts the
// resulting cells like any other sheet.
//
// Layout produced (a flat/tabular form, not Excel's compact outline form —
// every row repeats all of its row-field values instead of blanking out
// repeats, and multi-field column groups collapse into one combined header
// label per column rather than stacked header rows):
//
//   [row field names...] [col group 1 label] [col group 2 label] ... [Grand Total]
//   [row values...]      [aggregated value]  [aggregated value]  ... [row total]
//   ...
//   Grand Total           [col total]         [col total]         ... [grand total]
//
// If `cols` is empty, each value field gets exactly one data column (no
// per-column-group repetition, no redundant Grand Total column). If `rows`
// is empty, there is exactly one data row (no separate Grand Total row).

import { getCellId, parseCellRef } from "./formulaEngine";

export const PIVOT_AGGREGATIONS = ["sum", "count", "avg", "min", "max"];

export const AGG_LABELS = { sum: "Sum", count: "Count", avg: "Average", min: "Min", max: "Max" };

const aggregate = (values, agg) => {
    const nums = values.filter((v) => typeof v === "number" && !isNaN(v));
    switch (agg) {
        case "avg": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        case "min": return nums.length ? Math.min(...nums) : 0;
        case "max": return nums.length ? Math.max(...nums) : 0;
        case "count": return values.filter((v) => v !== undefined && v !== null && v !== "").length;
        case "sum":
        default: return nums.reduce((a, b) => a + b, 0);
    }
};

const roundDisplay = (n) => (Number.isInteger(n) ? n : Math.round(n * 100) / 100);

const parseRange = (rangeStr) => {
    if (!rangeStr) return null;
    const [startRef, endRef] = rangeStr.includes(":") ? rangeStr.split(":") : [rangeStr, rangeStr];
    const s = parseCellRef(startRef), e = parseCellRef(endRef);
    if (!s || !e) return null;
    return {
        minRow: Math.min(s.row, e.row), maxRow: Math.max(s.row, e.row),
        minCol: Math.min(s.col, e.col), maxCol: Math.max(s.col, e.col),
    };
};

// Reads a source range's header row + data rows out of a workbook, evaluating
// formulas via the caller-supplied `buildRawValueGrid`. Returns null if the
// source sheet/range no longer exists (e.g. the sheet was deleted or shrunk).
const readSourceRecords = (workbook, sourceSheet, sourceRange, buildRawValueGrid) => {
    const sheet = workbook[sourceSheet];
    if (!sheet) return null;
    const bounds = parseRange(sourceRange);
    if (!bounds) return null;
    const { minRow, maxRow, minCol, maxCol } = bounds;
    if (maxRow <= minRow) return null; // need at least a header row + one data row

    const rawGrid = buildRawValueGrid(sheet.cells || {});
    const fieldNames = [];
    for (let c = minCol; c <= maxCol; c++) {
        const header = rawGrid[getCellId(minRow, c)];
        fieldNames.push(header !== undefined && header !== "" ? String(header) : getCellId(minRow, c).replace(/\d+$/, ""));
    }

    const records = [];
    for (let r = minRow + 1; r <= maxRow; r++) {
        const rec = {};
        let hasAny = false;
        for (let c = minCol; c <= maxCol; c++) {
            const raw = rawGrid[getCellId(r, c)];
            if (raw !== undefined && raw !== "") hasAny = true;
            rec[fieldNames[c - minCol]] = raw;
        }
        if (hasAny) records.push(rec);
    }
    return { fieldNames, records };
};

// Field list for the PivotPanel UI, with a numeric/text guess so the panel
// can default a newly-added value field to sum (numeric) or count (text).
export const getPivotSourceFields = (workbook, sourceSheet, sourceRange, buildRawValueGrid) => {
    const parsed = readSourceRecords(workbook, sourceSheet, sourceRange, buildRawValueGrid);
    if (!parsed) return [];
    return parsed.fieldNames.map((name) => {
        const numericCount = parsed.records.filter((rec) => {
            const v = rec[name];
            return v !== undefined && v !== "" && !isNaN(parseFloat(v));
        }).length;
        return { name, isNumeric: parsed.records.length > 0 && numericCount === parsed.records.length };
    });
};

const GRAND_TOTAL_KEY = "__grand_total__";

const styleCell = ({ value, bold, bg, border, align }) => {
    const cell = {};
    if (value !== undefined && value !== "" ) cell.value = value;
    if (bold) cell.bold = true;
    if (bg) cell.bg = bg;
    if (border) cell.border = border;
    if (align) cell.align = align;
    return cell;
};

// Computes the compiled { cells, rowCount, columnCount } for a pivot sheet.
// `buildRawValueGrid` is injected (rather than imported) because it lives in
// formulaEngine.js and this keeps the engine's only coupling to that module
// explicit and swappable in tests.
export const computePivotSheet = (workbook, pivotConfig, buildRawValueGrid) => {
    const empty = { cells: {}, rowCount: 1, columnCount: 1 };
    if (!pivotConfig) return empty;
    const { sourceSheet, sourceRange, rows = [], cols = [], values = [] } = pivotConfig;
    const parsed = readSourceRecords(workbook, sourceSheet, sourceRange, buildRawValueGrid);
    if (!parsed || values.length === 0) return empty;
    const { records } = parsed;

    const keyOf = (fields, rec) => fields.map((f) => String(rec[f] ?? "")).join("");

    const rowGroups = new Map(); // key -> field values
    const colGroups = new Map();
    // bucket key: `${rowKey}||${colKey}` -> { [valueField]: rawValue[] }
    const buckets = new Map();

    const addToBucket = (rowKey, colKey, rec) => {
        const bucketKey = `${rowKey}||${colKey}`;
        let bucket = buckets.get(bucketKey);
        if (!bucket) buckets.set(bucketKey, (bucket = {}));
        for (const vf of values) {
            const raw = rec[vf.field];
            const num = parseFloat(raw);
            (bucket[vf.field] || (bucket[vf.field] = [])).push(isNaN(num) ? raw : num);
        }
    };

    for (const rec of records) {
        const rowKey = rows.length > 0 ? keyOf(rows, rec) : GRAND_TOTAL_KEY;
        const colKey = cols.length > 0 ? keyOf(cols, rec) : GRAND_TOTAL_KEY;
        if (!rowGroups.has(rowKey)) rowGroups.set(rowKey, rows.map((f) => rec[f] ?? ""));
        if (!colGroups.has(colKey)) colGroups.set(colKey, cols.map((f) => rec[f] ?? ""));

        addToBucket(rowKey, colKey, rec);
        if (rows.length > 0) addToBucket(GRAND_TOTAL_KEY, colKey, rec); // column grand-total
        if (cols.length > 0) addToBucket(rowKey, GRAND_TOTAL_KEY, rec); // row grand-total
        // Corner grand-total: only add a *separate* pass when both the row and
        // column grand-total passes above ran too, otherwise one of them (or
        // the primary addToBucket call itself, when both rows and cols are
        // empty) already targeted this exact `${GRAND_TOTAL_KEY}||${GRAND_TOTAL_KEY}`
        // bucket, and adding again here would double-count every record.
        if (rows.length > 0 && cols.length > 0) addToBucket(GRAND_TOTAL_KEY, GRAND_TOTAL_KEY, rec);
    }

    const numCompare = (a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a).localeCompare(String(b), undefined, { numeric: true });
    };
    const sortedRowKeys = [...rowGroups.keys()].sort((a, b) => numCompare(rowGroups.get(a).join(" "), rowGroups.get(b).join(" ")));
    const sortedColKeys = [...colGroups.keys()].sort((a, b) => numCompare(colGroups.get(a).join(" "), colGroups.get(b).join(" ")));

    // Data column descriptors: one per (column group x value field), plus a
    // trailing Grand Total group — skipped entirely when there's no column
    // grouping, since it would just duplicate the single data column.
    const colDescriptors = [];
    if (cols.length > 0) {
        for (const colKey of sortedColKeys) {
            const label = colGroups.get(colKey).join(" | ");
            for (const vf of values) colDescriptors.push({ colKey, field: vf.field, agg: vf.agg, header: values.length > 1 ? `${label} - ${AGG_LABELS[vf.agg]} of ${vf.field}` : label, isGrandTotal: false });
        }
        for (const vf of values) colDescriptors.push({ colKey: GRAND_TOTAL_KEY, field: vf.field, agg: vf.agg, header: values.length > 1 ? `Grand Total - ${AGG_LABELS[vf.agg]} of ${vf.field}` : "Grand Total", isGrandTotal: true });
    } else {
        for (const vf of values) colDescriptors.push({ colKey: GRAND_TOTAL_KEY, field: vf.field, agg: vf.agg, header: `${AGG_LABELS[vf.agg]} of ${vf.field}`, isGrandTotal: false });
    }

    const rowLabelColCount = Math.max(1, rows.length);
    const totalCols = rowLabelColCount + colDescriptors.length;
    const dataRowKeys = rows.length > 0 ? sortedRowKeys : [GRAND_TOTAL_KEY];
    const includeGrandTotalRow = rows.length > 0;
    const totalRows = 1 /* header */ + dataRowKeys.length + (includeGrandTotalRow ? 1 : 0);

    const cells = {};
    const HEADER_BG = "#eef2ff";
    const TOTAL_BG = "#f8fafc";
    const THICK_TOP = { top: "thick" };

    // Header row
    for (let i = 0; i < rowLabelColCount; i++) {
        cells[getCellId(0, i)] = styleCell({ value: rows[i] || "", bold: true, bg: HEADER_BG });
    }
    colDescriptors.forEach((desc, i) => {
        cells[getCellId(0, rowLabelColCount + i)] = styleCell({ value: desc.header, bold: true, bg: HEADER_BG, align: "center" });
    });

    // Data rows
    dataRowKeys.forEach((rowKey, rIdx) => {
        const r = 1 + rIdx;
        const rowFieldValues = rows.length > 0 ? rowGroups.get(rowKey) : ["(All)"];
        for (let i = 0; i < rowLabelColCount; i++) {
            cells[getCellId(r, i)] = styleCell({ value: rowFieldValues[i] ?? "" });
        }
        colDescriptors.forEach((desc, cIdx) => {
            const bucket = buckets.get(`${rowKey}||${desc.colKey}`);
            const bucketValues = bucket?.[desc.field] || [];
            const agg = aggregate(bucketValues, desc.agg);
            cells[getCellId(r, rowLabelColCount + cIdx)] = styleCell({
                value: bucketValues.length > 0 ? roundDisplay(agg) : "",
                bold: desc.isGrandTotal,
                bg: desc.isGrandTotal ? TOTAL_BG : undefined,
                align: "right",
            });
        });
    });

    // Grand Total row
    if (includeGrandTotalRow) {
        const r = 1 + dataRowKeys.length;
        cells[getCellId(r, 0)] = styleCell({ value: "Grand Total", bold: true, border: THICK_TOP });
        for (let i = 1; i < rowLabelColCount; i++) cells[getCellId(r, i)] = styleCell({ border: THICK_TOP });
        colDescriptors.forEach((desc, cIdx) => {
            const bucket = buckets.get(`${GRAND_TOTAL_KEY}||${desc.colKey}`);
            const bucketValues = bucket?.[desc.field] || [];
            const agg = aggregate(bucketValues, desc.agg);
            cells[getCellId(r, rowLabelColCount + cIdx)] = styleCell({
                value: bucketValues.length > 0 ? roundDisplay(agg) : "",
                bold: true,
                border: THICK_TOP,
                align: "right",
            });
        });
    }

    return { cells, rowCount: Math.max(1, totalRows), columnCount: Math.max(1, totalCols) };
};

// Recomputes every pivot sheet in `workbook` (mutating it in place) whose
// sourceSheet still exists — called from updateSheets right after every
// commit, so editing a source sheet's data, or a pivot's own config, keeps
// every dependent pivot sheet in sync automatically. Pivot sheets never
// source from another pivot sheet, so a single pass (no dependency
// ordering/cycles to worry about) is enough.
export const recomputePivotSheets = (workbook, buildRawValueGrid) => {
    for (const [name, sheet] of Object.entries(workbook)) {
        if (!sheet?.pivotConfig) continue;
        const { cells, rowCount, columnCount } = computePivotSheet(workbook, sheet.pivotConfig, buildRawValueGrid);
        workbook[name] = { ...sheet, cells, rowCount, columnCount, merges: [], tables: [] };
    }
};

// Renames every pivotConfig.sourceSheet reference from `oldName` to `newName`
// — called when a sheet is renamed so pivot sheets don't silently detach
// from their source.
export const renamePivotSourceReferences = (workbook, oldName, newName) => {
    for (const sheet of Object.values(workbook)) {
        if (sheet?.pivotConfig?.sourceSheet === oldName) {
            sheet.pivotConfig = { ...sheet.pivotConfig, sourceSheet: newName };
        }
    }
};
