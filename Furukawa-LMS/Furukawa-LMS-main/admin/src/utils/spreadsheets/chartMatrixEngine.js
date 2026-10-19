import { getCellId, colToIndex, indexToCol, parseCellRef, shiftSpan } from "./formulaEngine.js";

// Chart data for non-adjacent (Ctrl-selected) ranges such as "A1:A10, C1:C10".
// The selected ranges are reduced to the set of rows and the set of columns
// they touch (in sheet order, like Excel); the chart reads the cells where
// those rows and columns cross, so anything skipped between ranges is left out.

// Strips $ , % and whitespace before parsing so formatted numbers still chart;
// returns null (never NaN) for genuinely non-numeric text so callers can flag it.
export const parseNumericCell = (raw) => {
    if (raw === undefined || raw === null || raw === "") return null;
    const cleaned = String(raw).replace(/[$,%\s]/g, "");
    if (cleaned === "" || cleaned === "-") return null;
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
};

// "A1:A10, C1:C10" -> [{ start: "A1", end: "A10" }, { start: "C1", end: "C10" }].
// Returns null when any part isn't a valid cell or range.
export function parseRangeString(text) {
    const parts = String(text || "").split(/[,;]/).map((p) => p.trim().toUpperCase().replace(/\$/g, "")).filter(Boolean);
    if (parts.length === 0) return null;
    const ranges = [];
    for (const part of parts) {
        const [start, end = start, extra] = part.split(":").map((s) => s.trim());
        if (extra !== undefined || !parseCellRef(start) || !parseCellRef(end)) return null;
        ranges.push({ start, end });
    }
    return ranges;
}

export const formatRangeString = (ranges) => (ranges || [])
    .map((r) => (r.start === r.end ? r.start : `${r.start}:${r.end}`))
    .join(", ");

// Sorted, de-duplicated 0-based row and column indexes covered by the ranges.
export function rangeAxes(ranges) {
    const rows = new Set(), cols = new Set();
    for (const range of ranges || []) {
        const s = parseCellRef(range.start), e = parseCellRef(range.end);
        if (!s || !e) continue;
        for (let r = Math.min(s.row, e.row); r <= Math.max(s.row, e.row); r++) rows.add(r);
        for (let c = Math.min(s.col, e.col); c <= Math.max(s.col, e.col); c++) cols.add(c);
    }
    const asc = (a, b) => a - b;
    return { rows: [...rows].sort(asc), cols: [...cols].sort(asc) };
}

// Excel's default: the longer side becomes the category axis, so a selection
// wider than it is tall plots each row as a series.
export const naturalPlotBy = (ranges) => {
    const { rows, cols } = rangeAxes(ranges);
    return cols.length > rows.length ? "rows" : "columns";
};

export const chartRanges = (config) => {
    if (Array.isArray(config?.ranges) && config.ranges.length) return config.ranges;
    return config?.rangeString ? parseRangeString(config.rangeString) : null;
};

// Each series is its own set of chart marks; a chart asked to draw hundreds
// (e.g. a tall table switched to plot by rows) overwhelms the chart library,
// so only the first MAX_CHART_SERIES are plotted.
export const MAX_CHART_SERIES = 24;

// Splits the axes into label line, category line and series lines for the
// given orientation. Series ids are column letters (plot by columns) or
// 1-based row numbers as strings (plot by rows) — the keys charts store
// per-series colors and combo settings under.
function layoutFor(ranges, plotBy, hasHeader) {
    const { rows, cols } = rangeAxes(ranges);
    const byRows = plotBy === "rows";
    // "series lines" run along the series direction, "point lines" across it.
    const seriesLines = byRows ? rows : cols;
    const pointLines = byRows ? cols : rows;
    // A single line has no separate category line: it is the one series.
    const categoryLine = seriesLines.length > 1 ? seriesLines[0] : null;
    const allSeries = seriesLines.length > 1 ? seriesLines.slice(1) : seriesLines;
    const series = allSeries.slice(0, MAX_CHART_SERIES);
    const headerLine = hasHeader && pointLines.length > 1 ? pointLines[0] : null;
    const points = headerLine !== null ? pointLines.slice(1) : pointLines;
    const cellId = (seriesLine, pointLine) => (byRows ? getCellId(seriesLine, pointLine) : getCellId(pointLine, seriesLine));
    const seriesId = (line) => (byRows ? String(line + 1) : indexToCol(line));
    return { byRows, categoryLine, series, seriesTotal: allSeries.length, headerLine, points, cellId, seriesId };
}

// How many series the ranges describe before the MAX_CHART_SERIES cut.
export const seriesCountForRanges = (ranges, plotBy, hasHeader = true) => layoutFor(ranges, plotBy, hasHeader).seriesTotal;

export function seriesIdsForRanges(ranges, plotBy, hasHeader = true) {
    const layout = layoutFor(ranges, plotBy, hasHeader);
    return layout.series.map(layout.seriesId);
}

// Same result shape as the single-range builder in ExcelGraph: one entry per
// category with a `name` plus one numeric field per series label. Text in a
// value cell counts as 0 and sets `hadInvalid`.
export function extractDisjointChartData({ displayGrid, config }) {
    const ranges = chartRanges(config);
    if (!ranges) return { data: [], seriesKeys: [], hadInvalid: false };
    const plotBy = config.plotBy || naturalPlotBy(ranges);
    const { byRows, categoryLine, series, headerLine, points, cellId, seriesId } = layoutFor(ranges, plotBy, config.hasHeaderRow !== false);

    const labels = series.map((line) => {
        const fallback = byRows ? `Row ${line + 1}` : `Col ${indexToCol(line)}`;
        if (headerLine === null) return fallback;
        return String(displayGrid[cellId(line, headerLine)] ?? "").trim() || fallback;
    });

    let hadInvalid = false;
    const data = [];
    for (const point of points) {
        const rawName = categoryLine === null ? undefined : displayGrid[cellId(categoryLine, point)];
        const hasName = rawName !== undefined && rawName !== "";
        const entry = { name: hasName ? String(rawName) : (byRows ? `Col ${indexToCol(point)}` : `Row ${point + 1}`) };
        let hasValue = false;
        series.forEach((line, i) => {
            const raw = displayGrid[cellId(line, point)];
            const num = parseNumericCell(raw);
            if (raw !== undefined && raw !== "" && num === null) hadInvalid = true;
            if (num !== null) hasValue = true;
            entry[labels[i]] = num === null ? 0 : num;
        });
        if (hasName || hasValue) data.push(entry);
    }
    return { data, seriesKeys: labels, seriesIds: series.map(seriesId), hadInvalid };
}

// The ranges an older single-block chart config (xAxisCol / valueCols /
// rowStart / rowEnd) covers, so it can be switched to plot by rows.
export function legacyConfigRanges(config) {
    const rowStart = Math.max(1, Number(config.rowStart) || 1);
    const rowEnd = Math.max(rowStart, Number(config.rowEnd) || rowStart);
    const cols = [config.xAxisCol || "A", ...(config.valueCols || [])];
    return [...new Set(cols)]
        .sort((a, b) => colToIndex(a) - colToIndex(b))
        .map((col) => ({ start: `${col}${rowStart}`, end: `${col}${rowEnd}` }));
}

// --- The range a new chart starts on ---------------------------------------------------
// Charts are only ever inserted by the user (ExcelGraph.jsx); these decide what a new
// one plots from what is selected in the grid at that moment.

const hasContent = (displayGrid, row, col) => {
    const value = displayGrid[getCellId(row, col)];
    return value !== undefined && value !== "";
};

// `bounds` without the wholly empty rows and columns at its edges. Null when all of
// it is empty.
const trimEmptyEdges = (displayGrid, bounds) => {
    let { minRow, maxRow, minCol, maxCol } = bounds;
    const rowEmpty = (r) => { for (let c = minCol; c <= maxCol; c++) if (hasContent(displayGrid, r, c)) return false; return true; };
    const colEmpty = (c) => { for (let r = minRow; r <= maxRow; r++) if (hasContent(displayGrid, r, c)) return false; return true; };
    while (minRow <= maxRow && rowEmpty(minRow)) minRow++;
    while (maxRow >= minRow && rowEmpty(maxRow)) maxRow--;
    if (minRow > maxRow) return null;
    while (minCol < maxCol && colEmpty(minCol)) minCol++;
    while (maxCol > minCol && colEmpty(maxCol)) maxCol--;
    return { minRow, maxRow, minCol, maxCol };
};

// A rectangular block of cells as chart settings: its first column is the category
// axis and the rest are the series (a block one column wide plots that column). The
// first row reads as a header when every series cell in it is text, not a number.
export const blockChartRange = (displayGrid, { minRow, maxRow, minCol, maxCol }) => {
    const xAxisCol = indexToCol(minCol);
    const valueCols = [];
    for (let c = minCol + 1; c <= maxCol; c++) valueCols.push(indexToCol(c));
    if (valueCols.length === 0) valueCols.push(xAxisCol);
    const hasHeaderRow = valueCols.every((col) => {
        const raw = displayGrid[getCellId(minRow, colToIndex(col))];
        return raw !== undefined && raw !== "" && parseNumericCell(raw) === null;
    });
    return { xAxisCol, valueCols, rowStart: minRow + 1, rowEnd: maxRow + 1, hasHeaderRow };
};

// One row of cells as chart settings: a single series running across the row. Its
// first cell names the series when it is text and more cells follow it.
const rowChartRange = (displayGrid, { minRow, minCol, maxCol }) => {
    const list = [{ start: getCellId(minRow, minCol), end: getCellId(minRow, maxCol) }];
    const first = displayGrid[getCellId(minRow, minCol)];
    const hasHeaderRow = maxCol > minCol && first !== undefined && first !== "" && parseNumericCell(first) === null;
    return { rangeString: formatRangeString(list), plotBy: "rows", hasHeaderRow, valueCols: seriesIdsForRanges(list, "rows", hasHeaderRow) };
};

// What a new chart plots, going by what is selected in the grid:
//   several Ctrl-selected ranges   those ranges, as a range list
//   a block, row or column         the filled part of it (so a whole-column
//                                  selection stops where the data does)
// Null when that leaves nothing to chart: an empty area, or a single cell. Only data
// the user has selected is charted, never the data around a lone selected cell.
export const newChartRange = ({ selection, ranges, displayGrid }) => {
    if (Array.isArray(ranges) && ranges.length > 1) {
        const list = parseRangeString(formatRangeString(ranges));
        if (list) {
            const plotBy = naturalPlotBy(list);
            return { rangeString: formatRangeString(list), plotBy, hasHeaderRow: true, valueCols: seriesIdsForRanges(list, plotBy, true) };
        }
    }
    const start = selection && parseCellRef(selection.start);
    const end = selection && parseCellRef(selection.end);
    if (!start || !end) return null;
    const bounds = trimEmptyEdges(displayGrid, {
        minRow: Math.min(start.row, end.row), maxRow: Math.max(start.row, end.row),
        minCol: Math.min(start.col, end.col), maxCol: Math.max(start.col, end.col),
    });
    if (!bounds || (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol)) return null;
    if (bounds.minRow === bounds.maxRow) return rowChartRange(displayGrid, bounds);
    return blockChartRange(displayGrid, bounds);
};

// --- Inserting and deleting rows or columns --------------------------------------------
// A chart keeps plotting the same cells when rows or columns are inserted (count > 0)
// or deleted (count < 0) at index `at`, as a formula's references do: its range moves,
// an insert inside it widens it and a delete trims it. Settings kept per series (by
// column letter, or by row number for a chart plotted by rows) move with the series;
// those of a deleted series go with it.

const SERIES_SETTINGS = ["seriesColors", "comboSettings", "seriesLabels", "pointLabels", "pointColors"];

const shiftBand = (i, at, count) => (count < 0 && i >= at && i < at - count ? null : i >= at ? i + count : i);

// A series id after the shift: null when its row or column was deleted, and
// unchanged when it is on the other axis (or isn't a series id at all).
const shiftSeriesId = (id, axis, at, count) => {
    const s = String(id);
    if (/^\d+$/.test(s)) {
        if (axis !== "row") return s;
        const i = shiftBand(Number(s) - 1, at, count);
        return i === null ? null : String(i + 1);
    }
    if (axis !== "col" || !/^[A-Z]+$/.test(s)) return s;
    const i = shiftBand(colToIndex(s), at, count);
    return i === null ? null : indexToCol(i);
};

const shiftSeriesMap = (map, axis, at, count) => {
    if (!map || typeof map !== "object" || Array.isArray(map)) return map;
    const out = {};
    for (const [id, value] of Object.entries(map)) {
        const shifted = shiftSeriesId(id, axis, at, count);
        if (shifted !== null) out[shifted] = value;
    }
    return out;
};

// One range of a range list after the shift; null when all of it was deleted.
const shiftRangeRef = (range, axis, at, count) => {
    const s = parseCellRef(range.start), e = parseCellRef(range.end);
    if (!s || !e) return range;
    let minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
    let minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
    const span = axis === "row" ? shiftSpan(minRow, maxRow, at, count) : shiftSpan(minCol, maxCol, at, count);
    if (!span) return null;
    if (axis === "row") [minRow, maxRow] = span; else [minCol, maxCol] = span;
    return { start: getCellId(minRow, minCol), end: getCellId(maxRow, maxCol) };
};

// `chart` after inserting or deleting rows (axis "row") or columns ("col") of its
// sheet. A chart left with none of its cells plots nothing.
export const shiftChartBands = (chart, axis, at, count) => {
    if (!chart || !count) return chart;
    const next = { ...chart };
    const valueCols = (chart.valueCols || []).map((id) => shiftSeriesId(id, axis, at, count)).filter((id) => id !== null);
    const ranges = chartRanges(chart);
    if (ranges) {
        const shifted = ranges.map((r) => shiftRangeRef(r, axis, at, count)).filter(Boolean);
        next.rangeString = formatRangeString(shifted);
        if (Array.isArray(chart.ranges)) next.ranges = shifted;
        next.valueCols = shifted.length ? valueCols : [];
    } else if (axis === "row") {
        const rowStart = Math.max(1, Number(chart.rowStart) || 1);
        const rowEnd = Math.max(rowStart, Number(chart.rowEnd) || rowStart);
        const span = shiftSpan(rowStart - 1, rowEnd - 1, at, count);
        if (span) { next.rowStart = span[0] + 1; next.rowEnd = span[1] + 1; } else next.valueCols = [];
    } else {
        // The category column, when deleted, gives way to the first series left:
        // a chart one column wide plots that column against itself.
        next.xAxisCol = shiftSeriesId(chart.xAxisCol || "A", axis, at, count) ?? valueCols[0] ?? chart.xAxisCol;
        next.valueCols = valueCols;
    }
    for (const key of SERIES_SETTINGS) if (chart[key]) next[key] = shiftSeriesMap(chart[key], axis, at, count);
    return next;
};
