import { getCellId, colToIndex, indexToCol, parseCellRef } from "./formulaEngine.js";

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

// The block of filled cells around (row, col), grown outward until empty rows and
// columns border it — Excel's "current region", which is what it charts when a single
// cell is selected. The same walk as ExcelClone's currentRegion.
export const dataRegionAround = (displayGrid, row, col, rowCount, columnCount) => {
    let top = row, bottom = row, left = col, right = col;
    const anyContent = (r1, r2, c1, c2) => {
        for (let r = Math.max(0, r1); r <= Math.min(rowCount - 1, r2); r++) {
            for (let c = Math.max(0, c1); c <= Math.min(columnCount - 1, c2); c++) if (hasContent(displayGrid, r, c)) return true;
        }
        return false;
    };
    for (let changed = true; changed;) {
        changed = false;
        if (top > 0 && anyContent(top - 1, top - 1, left - 1, right + 1)) { top--; changed = true; }
        if (bottom < rowCount - 1 && anyContent(bottom + 1, bottom + 1, left - 1, right + 1)) { bottom++; changed = true; }
        if (left > 0 && anyContent(top - 1, bottom + 1, left - 1, left - 1)) { left--; changed = true; }
        if (right < columnCount - 1 && anyContent(top - 1, bottom + 1, right + 1, right + 1)) { right++; changed = true; }
    }
    return { minRow: top, maxRow: bottom, minCol: left, maxCol: right };
};

// `bounds` without the wholly empty rows and columns at its edges (the region around
// an empty cell includes that cell's own row and column). Null when all of it is empty.
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

// What a new chart plots, going by what is selected in the grid:
//   several Ctrl-selected ranges   those ranges, as a range list
//   a block of cells               that block
//   one cell, row or column        the block of data it sits in
// Null when that leaves nothing to chart (an empty area), so the defaults apply.
export const newChartRange = ({ selection, ranges, activeCell, displayGrid, rowCount, columnCount }) => {
    if (Array.isArray(ranges) && ranges.length > 1) {
        const list = parseRangeString(formatRangeString(ranges));
        if (list) {
            const plotBy = naturalPlotBy(list);
            return { rangeString: formatRangeString(list), plotBy, hasHeaderRow: true, valueCols: seriesIdsForRanges(list, plotBy, true) };
        }
    }
    const start = selection && parseCellRef(selection.start);
    const end = selection && parseCellRef(selection.end);
    let bounds = start && end ? {
        minRow: Math.min(start.row, end.row), maxRow: Math.max(start.row, end.row),
        minCol: Math.min(start.col, end.col), maxCol: Math.max(start.col, end.col),
    } : null;
    if (!bounds || bounds.minRow === bounds.maxRow || bounds.minCol === bounds.maxCol) {
        const at = (activeCell && parseCellRef(activeCell)) || start;
        if (!at) return null;
        bounds = trimEmptyEdges(displayGrid, dataRegionAround(displayGrid, at.row, at.col, rowCount, columnCount));
        if (!bounds || bounds.minRow === bounds.maxRow) return null;
    }
    return blockChartRange(displayGrid, bounds);
};
