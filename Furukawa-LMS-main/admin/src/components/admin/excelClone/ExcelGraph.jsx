import React, { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    IconSettings, IconAlertTriangle, IconClick, IconPlus, IconX, IconPalette,
    IconLayoutAlignTop, IconLayoutAlignBottom, IconLayoutAlignLeft, IconLayoutAlignRight, IconEyeOff,
    IconChevronDown, IconChevronUp
} from "@tabler/icons-react";
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ComposedChart
} from "recharts";
import { getCellId, colToIndex, indexToCol, parseCellRef } from "./formulaEngine";
import { cn } from "@/lib/utils";

// Validated categorical palette (see dataviz skill's references/palette.md) —
// fixed order, never cycled/re-sorted, so adjacent series stay CVD-safe.
const CATEGORICAL_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const CHART_SURFACE = "#fcfcfb";
const INK_SECONDARY = "#52514e";
const INK_MUTED = "#898781";
const GRIDLINE_COLOR = "#e1e0d9";
const AXIS_LINE_COLOR = "#c3c2b7";

const CHART_TYPE_GROUPS = [
    { label: "Column", types: [{ key: "columnGrouped", label: "Clustered Column" }, { key: "columnStacked", label: "Stacked Column" }] },
    { label: "Bar", types: [{ key: "barGrouped", label: "Clustered Bar" }, { key: "barStacked", label: "Stacked Bar" }] },
    { label: "Line", types: [{ key: "line", label: "Line" }, { key: "lineStacked", label: "Stacked Line" }] },
    { label: "Area", types: [{ key: "area", label: "Area" }] },
    { label: "Combo", types: [{ key: "combo", label: "Combo Chart" }] },
    { label: "Pie", types: [{ key: "pie", label: "Pie" }, { key: "doughnut", label: "Doughnut" }] },
];

let chartIdSeq = 0;
const nextChartId = () => `chart-${Date.now().toString(36)}-${(chartIdSeq++).toString(36)}`;

// `id` defaults to a fixed value rather than nextChartId() so the very first,
// not-yet-saved chart keeps a stable identity across re-renders (which happen
// on every keystroke in the grid, before the user has ever pressed "+").
const buildDefaultChart = (columnCount, rowCount, id = "chart-1", name = "Chart 1") => ({
    id,
    name,
    type: "columnGrouped",
    xAxisCol: "A",
    valueCols: columnCount > 1 ? ["B"] : ["A"],
    rowStart: 1,
    rowEnd: Math.max(1, Math.min(rowCount || 10, 15)),
    hasHeaderRow: true,
    showGridlines: true,
    showDataLabels: false,
    seriesColors: {},
    title: "",
    legendPosition: "bottom",
    labelPosition: "auto",
    pointColors: {},
    comboSettings: {},
});

// A sheet may still have the old singular `chartConfig` (pre-multi-chart), or
// a `charts` array saved before the Design fields (title/labelPosition/
// pointColors/legendPosition) existed — read-only migration: fill in defaults
// for whatever's missing. Never written back until the user's next edit.
// `Array.isArray` (not a truthy/length check) so a saved, deliberately-emptied
// `charts: []` is respected instead of being treated as "never configured" and
// regenerating a default chart every render.
const withDesignDefaults = (chart) => ({
    title: "",
    labelPosition: "auto",
    pointColors: {},
    comboSettings: {},
    ...chart,
    legendPosition: chart.legendPosition || (chart.showLegend === false ? "none" : "bottom"),
});

const getChartsForSheet = (activeSheet, columnCount, rowCount) => {
    if (Array.isArray(activeSheet?.charts)) return activeSheet.charts.map(withDesignDefaults);
    if (activeSheet?.chartConfig) {
        return [withDesignDefaults({
            ...buildDefaultChart(columnCount, rowCount),
            ...activeSheet.chartConfig,
            id: "chart-1",
            name: activeSheet.chartConfig.name || "Chart 1",
        })];
    }
    return [buildDefaultChart(columnCount, rowCount)];
};

// Strips $ , % and whitespace before parsing so formatted numbers still chart;
// returns null (never NaN) for genuinely non-numeric text so callers can flag it.
const parseNumericCell = (raw) => {
    if (raw === undefined || raw === null || raw === "") return null;
    const cleaned = String(raw).replace(/[$,%\s]/g, "");
    if (cleaned === "" || cleaned === "-") return null;
    const num = parseFloat(cleaned);
    return Number.isNaN(num) ? null : num;
};

// Reads the configured row/column range out of the live displayGrid. A text
// cell inside the range is treated as 0 rather than thrown away, with
// `hadInvalid` surfaced so the toolbar can show a non-blocking warning.
function buildChartData({ activeSheet, displayGrid, config }) {
    const rowCountMax = activeSheet?.rowCount || 0;
    const valueCols = config.valueCols?.length ? config.valueCols : [];
    const xCol = config.xAxisCol || "A";
    if (valueCols.length === 0) return { data: [], seriesKeys: [], hadInvalid: false };

    const rowStart = Math.max(1, Number(config.rowStart) || 1);
    const rowEnd = Math.max(rowStart, Math.min(rowCountMax, Number(config.rowEnd) || rowCountMax));

    const seriesLabels = {};
    let dataRowStart = rowStart;
    if (config.hasHeaderRow) {
        const headerRowIdx = rowStart - 1;
        valueCols.forEach((col) => {
            const id = getCellId(headerRowIdx, colToIndex(col));
            seriesLabels[col] = String(displayGrid[id] || "").trim() || `Col ${col}`;
        });
        dataRowStart = rowStart + 1;
    } else {
        valueCols.forEach((col) => { seriesLabels[col] = `Col ${col}`; });
    }

    let hadInvalid = false;
    const data = [];
    for (let r = dataRowStart; r <= rowEnd; r++) {
        const rowIdx = r - 1;
        const xId = getCellId(rowIdx, colToIndex(xCol));
        const rawX = displayGrid[xId];
        const entry = { name: rawX !== undefined && rawX !== "" ? String(rawX) : `Row ${r}` };
        let rowHasValue = false;
        valueCols.forEach((col) => {
            const id = getCellId(rowIdx, colToIndex(col));
            const rawVal = displayGrid[id];
            const num = parseNumericCell(rawVal);
            if (rawVal !== undefined && rawVal !== "" && num === null) hadInvalid = true;
            if (num !== null) rowHasValue = true;
            entry[seriesLabels[col]] = num === null ? 0 : num;
        });
        if ((rawX !== undefined && rawX !== "") || rowHasValue) data.push(entry);
    }

    return { data, seriesKeys: valueCols.map((c) => seriesLabels[c]), hadInvalid };
}

// Excel's "stacked line" plots cumulative sums per category rather than raw
// values — recharts has no native stacked-line mode, so we pre-sum here.
const applyStackedLineCumulative = (data, seriesKeys) => data.map((row) => {
    const next = { name: row.name };
    let cumulative = 0;
    seriesKeys.forEach((key) => {
        cumulative += row[key] || 0;
        next[key] = cumulative;
    });
    return next;
});

// Curated, chart-type-appropriate label position choices (Excel's "Format
// Data Labels" position picker, scoped to what actually makes sense per family).
const LABEL_POSITION_OPTIONS_BY_TYPE = {
    columnGrouped: [
        { value: "outsideEnd", label: "Outside End" },
        { value: "insideEnd", label: "Inside End" },
        { value: "center", label: "Center" },
        { value: "insideBase", label: "Inside Base" },
    ],
    columnStacked: [
        { value: "center", label: "Center" },
        { value: "insideEnd", label: "Inside End" },
        { value: "insideBase", label: "Inside Base" },
    ],
    barGrouped: [
        { value: "outsideEnd", label: "Outside End" },
        { value: "insideEnd", label: "Inside End" },
        { value: "center", label: "Center" },
        { value: "insideBase", label: "Inside Base" },
    ],
    barStacked: [
        { value: "center", label: "Center" },
        { value: "insideEnd", label: "Inside End" },
        { value: "insideBase", label: "Inside Base" },
    ],
    line: [
        { value: "above", label: "Above" },
        { value: "below", label: "Below" },
        { value: "center", label: "Center" },
    ],
    lineStacked: [
        { value: "above", label: "Above" },
        { value: "below", label: "Below" },
        { value: "center", label: "Center" },
    ],
    area: [
        { value: "above", label: "Above" },
        { value: "below", label: "Below" },
        { value: "center", label: "Center" },
    ],
    combo: [
        { value: "above", label: "Above" },
        { value: "below", label: "Below" },
        { value: "center", label: "Center" },
    ],
    pie: [
        { value: "outsideEnd", label: "Outside End" },
        { value: "insideEnd", label: "Inside End" },
        { value: "center", label: "Center" },
    ],
    doughnut: [
        { value: "outsideEnd", label: "Outside End" },
        { value: "insideEnd", label: "Inside End" },
        { value: "center", label: "Center" },
    ],
};
const getLabelPositionOptions = (chartType) => LABEL_POSITION_OPTIONS_BY_TYPE[chartType] || LABEL_POSITION_OPTIONS_BY_TYPE.columnGrouped;

// "auto" reproduces this file's original hardcoded label placement, so an
// existing saved chart renders unchanged until the user explicitly picks
// something else in the Design popover.
const AUTO_LABEL_POSITION = {
    columnGrouped: "outsideEnd", columnStacked: "center",
    barGrouped: "outsideEnd", barStacked: "center",
    line: "above", lineStacked: "above", area: "above", combo: "above",
    pie: "outsideEnd", doughnut: "outsideEnd",
};

// Maps the abstract position key to recharts' own `position` enum for
// LabelList on bar/line/area. Pie doesn't use this — see resolvePieLabelPosition.
const RECHARTS_LABEL_POSITION = {
    columnGrouped: { outsideEnd: "top", insideEnd: "insideTop", center: "center", insideBase: "insideBottom" },
    columnStacked: { center: "center", insideEnd: "insideTop", insideBase: "insideBottom" },
    barGrouped: { outsideEnd: "right", insideEnd: "insideRight", center: "center", insideBase: "insideLeft" },
    barStacked: { center: "center", insideEnd: "insideRight", insideBase: "insideLeft" },
    line: { above: "top", below: "bottom", center: "center" },
    lineStacked: { above: "top", below: "bottom", center: "center" },
    area: { above: "top", below: "bottom", center: "center" },
    combo: { above: "top", below: "bottom", center: "center" },
};

const resolveLabelPosition = (config) => {
    const key = config.labelPosition && config.labelPosition !== "auto" ? config.labelPosition : AUTO_LABEL_POSITION[config.type];
    return RECHARTS_LABEL_POSITION[config.type]?.[key] || "top";
};

// Pie labels are positioned via a render-prop (radius fraction + optional
// leader line), not recharts' `position` enum — resolved separately in the
// custom `label` function passed to <Pie>.
const resolvePieLabelPosition = (config) => (
    config.labelPosition && config.labelPosition !== "auto" ? config.labelPosition : AUTO_LABEL_POSITION[config.type]
);

const RADIAN = Math.PI / 180;
// recharts' Pie `label` render-prop: returning a plain string only supports
// its own default (outside) placement, so inside/center positions need a
// custom <text> computed from the slice's own radius/angle.
function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }, position) {
    const radius = position === "insideEnd" ? innerRadius + (outerRadius - innerRadius) * 0.88
        : position === "center" ? innerRadius + (outerRadius - innerRadius) * 0.5
        : outerRadius + 18; // outsideEnd
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const isOutside = position === "outsideEnd";
    return (
        <text x={x} y={y} fill={isOutside ? INK_SECONDARY : "#ffffff"} fontSize={10} textAnchor={isOutside ? (x > cx ? "start" : "end") : "middle"} dominantBaseline="central">
            {`${Math.round(percent * 100)}%`}
        </text>
    );
}

const legendPropsFor = (legendPosition) => {
    switch (legendPosition) {
        case "top": return { verticalAlign: "top", align: "center", layout: "horizontal" };
        case "left": return { verticalAlign: "middle", align: "left", layout: "vertical" };
        case "right": return { verticalAlign: "middle", align: "right", layout: "vertical" };
        case "bottom":
        default: return { verticalAlign: "bottom", align: "center", layout: "horizontal" };
    }
};

// Per-data-point color: a specific category's bar/slice within `seriesCol`,
// falling back to that series' solid color, then the palette. Only wired up
// for bar/column and pie/doughnut — recharts (like Excel) has no clean way to
// recolor part of a single continuous Line/Area path.
const pointColorFor = (config, seriesCol, categoryName, seriesIndex) => (
    config.pointColors?.[seriesCol]?.[categoryName]
    || config.seriesColors?.[seriesCol]
    || CATEGORICAL_COLORS[seriesIndex % CATEGORICAL_COLORS.length]
);

// Pie/doughnut have exactly one series but one color per slice, so — unlike
// bar's series-color-then-point-override — a "series color" would just flatten
// every slice to the same hue. Point overrides fall straight back to the
// palette cycled by slice (row) index instead.
const pieCellColorFor = (config, seriesCol, categoryName, rowIndex) => (
    config.pointColors?.[seriesCol]?.[categoryName] || CATEGORICAL_COLORS[rowIndex % CATEGORICAL_COLORS.length]
);

// Combo chart per-series overrides fall back to alternating column/line by
// index (mirrors Excel's own combo-chart default) and the primary axis when unset.
const getComboSeriesSettings = (config, col, index) => {
    const override = config.comboSettings?.[col];
    return {
        type: override?.type || (index % 2 === 0 ? "column" : "line"),
        yAxisId: override?.yAxisId || "left",
    };
};

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="rounded-lg border border-slate-200 bg-white shadow-md px-2.5 py-2 text-xs min-w-[130px]">
            {label !== undefined && <div className="text-[10px] font-semibold text-slate-500 mb-1">{label}</div>}
            <div className="space-y-1">
                {payload.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-slate-500">
                            <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
                            {entry.name}
                        </span>
                        <span className="font-semibold text-slate-900">{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const PreviewSvg = ({ children }) => (
    <svg viewBox="0 0 32 24" className="w-7 h-5" aria-hidden="true">{children}</svg>
);

// Small Excel-gallery-style sample thumbnails for each chart type button.
function ChartTypePreview({ type }) {
    switch (type) {
        case "columnGrouped":
            return (
                <PreviewSvg>
                    <rect x="3" y="10" width="4" height="12" rx="1" fill="#818cf8" />
                    <rect x="8" y="4" width="4" height="18" rx="1" fill="#4f46e5" />
                    <rect x="15" y="13" width="4" height="9" rx="1" fill="#818cf8" />
                    <rect x="20" y="7" width="4" height="15" rx="1" fill="#4f46e5" />
                    <rect x="27" y="10" width="4" height="12" rx="1" fill="#818cf8" />
                </PreviewSvg>
            );
        case "columnStacked":
            return (
                <PreviewSvg>
                    <rect x="4" y="12" width="6" height="10" rx="1" fill="#818cf8" />
                    <rect x="4" y="4" width="6" height="7" rx="1" fill="#4f46e5" />
                    <rect x="14" y="9" width="6" height="13" rx="1" fill="#818cf8" />
                    <rect x="14" y="2" width="6" height="6" rx="1" fill="#4f46e5" />
                    <rect x="24" y="15" width="6" height="7" rx="1" fill="#818cf8" />
                    <rect x="24" y="6" width="6" height="8" rx="1" fill="#4f46e5" />
                </PreviewSvg>
            );
        case "barGrouped":
            return (
                <PreviewSvg>
                    <rect x="2" y="2" width="18" height="4" rx="1" fill="#4f46e5" />
                    <rect x="2" y="8" width="26" height="4" rx="1" fill="#818cf8" />
                    <rect x="2" y="14" width="12" height="4" rx="1" fill="#4f46e5" />
                    <rect x="2" y="20" width="22" height="4" rx="1" fill="#818cf8" />
                </PreviewSvg>
            );
        case "barStacked":
            return (
                <PreviewSvg>
                    <rect x="2" y="3" width="16" height="5" fill="#4f46e5" rx="1" />
                    <rect x="18" y="3" width="10" height="5" fill="#818cf8" rx="1" />
                    <rect x="2" y="10" width="10" height="5" fill="#4f46e5" rx="1" />
                    <rect x="12" y="10" width="16" height="5" fill="#818cf8" rx="1" />
                    <rect x="2" y="17" width="20" height="5" fill="#4f46e5" rx="1" />
                    <rect x="22" y="17" width="6" height="5" fill="#818cf8" rx="1" />
                </PreviewSvg>
            );
        case "line":
            return (
                <PreviewSvg>
                    <polyline points="2,18 9,10 16,14 23,5 30,9" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="23" cy="5" r="2" fill="#4f46e5" />
                </PreviewSvg>
            );
        case "lineStacked":
            return (
                <PreviewSvg>
                    <polyline points="2,20 9,15 16,17 23,10 30,12" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="2,12 9,7 16,10 23,3 30,5" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </PreviewSvg>
            );
        case "area":
            return (
                <PreviewSvg>
                    <path d="M2,18 L9,10 L16,14 L23,5 L30,9 L30,22 L2,22 Z" fill="#a5b4fc" opacity="0.6" />
                    <polyline points="2,18 9,10 16,14 23,5 30,9" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </PreviewSvg>
            );
        case "combo":
            return (
                <PreviewSvg>
                    <rect x="3" y="14" width="5" height="8" rx="1" fill="#c7d2fe" />
                    <rect x="12" y="9" width="5" height="13" rx="1" fill="#c7d2fe" />
                    <rect x="21" y="12" width="5" height="10" rx="1" fill="#c7d2fe" />
                    <polyline points="2,10 14,4 26,8" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="14" cy="4" r="2" fill="#4f46e5" />
                </PreviewSvg>
            );
        case "pie":
            return (
                <PreviewSvg>
                    <circle cx="16" cy="12" r="10" fill="#c7d2fe" />
                    <path d="M16,12 L16,2 A10,10 0 0,1 25,17 Z" fill="#4f46e5" />
                    <path d="M16,12 L25,17 A10,10 0 0,1 9,20 Z" fill="#818cf8" />
                </PreviewSvg>
            );
        case "doughnut":
            return (
                <PreviewSvg>
                    <circle cx="16" cy="12" r="10" fill="#c7d2fe" />
                    <path d="M16,12 L16,2 A10,10 0 0,1 25,17 Z" fill="#4f46e5" />
                    <path d="M16,12 L25,17 A10,10 0 0,1 9,20 Z" fill="#818cf8" />
                    <circle cx="16" cy="12" r="4.5" fill="white" />
                </PreviewSvg>
            );
        default:
            return null;
    }
}

export default function ExcelGraph({ excelData, onChartsChange }) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [draft, setDraft] = useState(null);
    const [designPopoverOpen, setDesignPopoverOpen] = useState(false);
    const [designDraft, setDesignDraft] = useState(null);
    const [expandedPointSeries, setExpandedPointSeries] = useState(null); // series col letter, or null
    const [activeChartId, setActiveChartId] = useState(null);
    const [renamingChartId, setRenamingChartId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);

    const activeSheet = excelData?.sheets?.[excelData.activeSheetName] || null;
    const displayGrid = excelData?.displayGrid || {};
    const columnCount = excelData?.columnCount || activeSheet?.columnCount || 0;
    const rowCount = excelData?.rowCount || activeSheet?.rowCount || 0;

    const charts = useMemo(
        () => getChartsForSheet(activeSheet, columnCount, rowCount),
        [activeSheet?.charts, activeSheet?.chartConfig, columnCount, rowCount]
    );
    const config = charts.find((c) => c.id === activeChartId) || charts[0];

    const columnOptions = useMemo(() => Array.from({ length: columnCount }, (_, i) => indexToCol(i)), [columnCount]);

    const applyConfig = useCallback((patch) => {
        if (!config) return;
        const nextCharts = charts.map((c) => (c.id === config.id ? { ...c, ...patch } : c));
        onChartsChange?.(nextCharts);
    }, [charts, config, onChartsChange]);

    const addChart = () => {
        const newChart = buildDefaultChart(columnCount, rowCount, nextChartId(), `Chart ${charts.length + 1}`);
        setActiveChartId(newChart.id);
        onChartsChange?.([...charts, newChart]);
    };

    const deleteChart = (id) => {
        const nextCharts = charts.filter((c) => c.id !== id);
        if (activeChartId === id) setActiveChartId(nextCharts[0]?.id ?? null);
        onChartsChange?.(nextCharts);
    };

    const startRenameChart = (chart) => { setRenamingChartId(chart.id); setRenameValue(chart.name); };
    const commitRenameChart = () => {
        const id = renamingChartId;
        const name = renameValue.trim();
        setRenamingChartId(null);
        if (!id || !name) return;
        onChartsChange?.(charts.map((c) => (c.id === id ? { ...c, name } : c)));
    };

    const { data, seriesKeys, hadInvalid } = useMemo(() => {
        if (!activeSheet || !config) return { data: [], seriesKeys: [], hadInvalid: false };
        const result = buildChartData({ activeSheet, displayGrid, config });
        if (config.type === "lineStacked") {
            return { ...result, data: applyStackedLineCumulative(result.data, result.seriesKeys) };
        }
        return result;
    }, [activeSheet, displayGrid, config]);

    const colorFor = (index) => config.seriesColors?.[config.valueCols[index]] || CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];

    const openPopover = (open) => {
        setPopoverOpen(open);
        if (open) setDraft(config);
    };

    const openDesignPopover = (open) => {
        setDesignPopoverOpen(open);
        if (open) { setDesignDraft(config); setExpandedPointSeries(null); }
    };

    const setDesignPointColor = (seriesCol, categoryName, hex) => {
        setDesignDraft((d) => ({
            ...d,
            pointColors: { ...d.pointColors, [seriesCol]: { ...(d.pointColors?.[seriesCol] || {}), [categoryName]: hex } },
        }));
    };

    const resetDesignPointColors = (seriesCol) => {
        setDesignDraft((d) => {
            const next = { ...d.pointColors };
            delete next[seriesCol];
            return { ...d, pointColors: next };
        });
    };

    // bar/column and pie/doughnut only — recharts (like Excel) has no clean
    // way to recolor part of a single continuous Line/Area path. Combo mixes
    // series types per-column, so per-point overrides are skipped there too.
    const supportsPointColors = config && !["line", "lineStacked", "area", "combo"].includes(config.type);

    const toggleDraftValueCol = (col) => {
        setDraft((d) => {
            const has = d.valueCols.includes(col);
            return { ...d, valueCols: has ? d.valueCols.filter((c) => c !== col) : [...d.valueCols, col] };
        });
    };

    // Derives the chart range directly from whatever's drag-selected in the grid
    // right now, instead of the user having to count rows/columns by eye — the
    // fix for sheets with several tables scattered at arbitrary positions.
    const useSelectionForDraft = () => {
        const sel = excelData?.selection;
        const s = sel && parseCellRef(sel.start);
        const e = sel && parseCellRef(sel.end);
        if (!s || !e) {
            toast.error("Select a range in the sheet below first.");
            return;
        }
        const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
        const minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
        if (minCol === maxCol) {
            toast.error("Select at least two columns — one for categories, one or more for values.");
            return;
        }
        if (minRow === maxRow) {
            toast.error("Select at least two rows — a header row and at least one data row.");
            return;
        }

        const xAxisCol = indexToCol(minCol);
        const valueCols = [];
        for (let c = minCol + 1; c <= maxCol; c++) valueCols.push(indexToCol(c));

        // Header auto-detect: the first selected row reads as a header if every
        // value-column cell in it is non-numeric text rather than a number.
        const hasHeaderRow = valueCols.every((col) => {
            const raw = displayGrid[getCellId(minRow, colToIndex(col))];
            return raw !== undefined && raw !== "" && parseNumericCell(raw) === null;
        });

        setDraft((d) => ({ ...d, xAxisCol, valueCols, rowStart: minRow + 1, rowEnd: maxRow + 1, hasHeaderRow }));
        toast.success("Range filled from your selection — review and Apply.");
    };

    const setDraftXAxis = (col) => {
        setDraft((d) => ({ ...d, xAxisCol: col, valueCols: d.valueCols.filter((c) => c !== col) }));
    };

    const commonAxisProps = { tick: { fill: INK_MUTED, fontSize: 11 }, axisLine: { stroke: AXIS_LINE_COLOR }, tickLine: false };

    const renderChart = () => {
        if (!config) return null;
        const legendPosition = config.legendPosition || "bottom";
        const labelPos = resolveLabelPosition(config);
        switch (config.type) {
            case "columnGrouped":
            case "columnStacked": {
                const stacked = config.type === "columnStacked";
                return (
                    <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        {config.showGridlines && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...commonAxisProps} />
                        <YAxis {...commonAxisProps} width={40} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                        {legendPosition !== "none" && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }} {...legendPropsFor(legendPosition)} />}
                        {seriesKeys.map((key, i) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId={stacked ? "stack" : undefined}
                                fill={colorFor(i)}
                                maxBarSize={24}
                                radius={stacked ? (i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
                            >
                                {data.map((row, di) => <Cell key={di} fill={pointColorFor(config, config.valueCols[i], row.name, i)} />)}
                                {config.showDataLabels && (
                                    <LabelList dataKey={key} position={labelPos} fill={labelPos.startsWith("inside") || labelPos === "center" ? "#ffffff" : INK_SECONDARY} fontSize={10} />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                );
            }
            case "barGrouped":
            case "barStacked": {
                const stacked = config.type === "barStacked";
                return (
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                        {config.showGridlines && <CartesianGrid stroke={GRIDLINE_COLOR} horizontal={false} />}
                        <XAxis type="number" {...commonAxisProps} />
                        <YAxis dataKey="name" type="category" {...commonAxisProps} width={70} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                        {legendPosition !== "none" && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }} {...legendPropsFor(legendPosition)} />}
                        {seriesKeys.map((key, i) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId={stacked ? "stack" : undefined}
                                fill={colorFor(i)}
                                maxBarSize={24}
                                radius={stacked ? (i === seriesKeys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]) : [0, 4, 4, 0]}
                            >
                                {data.map((row, di) => <Cell key={di} fill={pointColorFor(config, config.valueCols[i], row.name, i)} />)}
                                {config.showDataLabels && (
                                    <LabelList dataKey={key} position={labelPos} fill={labelPos.startsWith("inside") || labelPos === "center" ? "#ffffff" : INK_SECONDARY} fontSize={10} />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                );
            }
            case "line":
            case "lineStacked":
                return (
                    <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        {config.showGridlines && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...commonAxisProps} />
                        <YAxis {...commonAxisProps} width={40} />
                        <Tooltip content={<ChartTooltip />} />
                        {legendPosition !== "none" && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }} {...legendPropsFor(legendPosition)} />}
                        {seriesKeys.map((key, i) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colorFor(i)}
                                strokeWidth={2}
                                dot={{ r: 4, strokeWidth: 2, stroke: CHART_SURFACE, fill: colorFor(i) }}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_SURFACE }}
                            >
                                {config.showDataLabels && <LabelList dataKey={key} position={labelPos} fill={INK_SECONDARY} fontSize={10} />}
                            </Line>
                        ))}
                    </LineChart>
                );
            case "area":
                return (
                    <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        {config.showGridlines && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...commonAxisProps} />
                        <YAxis {...commonAxisProps} width={40} />
                        <Tooltip content={<ChartTooltip />} />
                        {legendPosition !== "none" && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }} {...legendPropsFor(legendPosition)} />}
                        {seriesKeys.map((key, i) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colorFor(i)}
                                strokeWidth={2}
                                fill={colorFor(i)}
                                fillOpacity={0.12}
                            >
                                {config.showDataLabels && <LabelList dataKey={key} position={labelPos} fill={INK_SECONDARY} fontSize={10} />}
                            </Area>
                        ))}
                    </AreaChart>
                );
            case "combo": {
                const seriesMeta = seriesKeys.map((key, i) => {
                    const col = config.valueCols[i];
                    return { key, ...getComboSeriesSettings(config, col, i), color: colorFor(i) };
                });
                const hasRightAxis = seriesMeta.some((s) => s.yAxisId === "right");
                const renderSeries = (s) => {
                    const labelList = config.showDataLabels && (
                        <LabelList key="ll" dataKey={s.key} position={labelPos} fill={INK_SECONDARY} fontSize={10} />
                    );
                    if (s.type === "column") {
                        return (
                            <Bar key={s.key} dataKey={s.key} yAxisId={s.yAxisId} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]}>
                                {labelList}
                            </Bar>
                        );
                    }
                    if (s.type === "area") {
                        return (
                            <Area key={s.key} type="monotone" dataKey={s.key} yAxisId={s.yAxisId} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.12}>
                                {labelList}
                            </Area>
                        );
                    }
                    return (
                        <Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            yAxisId={s.yAxisId}
                            stroke={s.color}
                            strokeWidth={2}
                            dot={{ r: 4, strokeWidth: 2, stroke: CHART_SURFACE, fill: s.color }}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_SURFACE }}
                        >
                            {labelList}
                        </Line>
                    );
                };
                return (
                    <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        {config.showGridlines && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...commonAxisProps} />
                        <YAxis yAxisId="left" {...commonAxisProps} width={40} />
                        {hasRightAxis && <YAxis yAxisId="right" orientation="right" {...commonAxisProps} width={40} />}
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />
                        {legendPosition !== "none" && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }} {...legendPropsFor(legendPosition)} />}
                        {seriesMeta.filter((s) => s.type === "column").map(renderSeries)}
                        {seriesMeta.filter((s) => s.type === "area").map(renderSeries)}
                        {seriesMeta.filter((s) => s.type === "line").map(renderSeries)}
                    </ComposedChart>
                );
            }
            case "pie":
            case "doughnut": {
                const key = seriesKeys[0];
                const piePos = resolvePieLabelPosition(config);
                return (
                    <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <Tooltip content={<ChartTooltip />} />
                        {legendPosition !== "none" && (
                            <Legend
                                wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }}
                                {...legendPropsFor(legendPosition)}
                                payload={data.map((d, i) => ({ value: d.name, type: "circle", color: pieCellColorFor(config, key, d.name, i) }))}
                            />
                        )}
                        <Pie
                            data={data}
                            dataKey={key}
                            nameKey="name"
                            innerRadius={config.type === "doughnut" ? "55%" : 0}
                            outerRadius="80%"
                            stroke={CHART_SURFACE}
                            strokeWidth={2}
                            label={config.showDataLabels ? (labelProps) => renderPieLabel(labelProps, piePos) : false}
                            labelLine={config.showDataLabels && piePos === "outsideEnd"}
                        >
                            {data.map((row, i) => <Cell key={i} fill={pieCellColorFor(config, key, row.name, i)} />)}
                        </Pie>
                    </PieChart>
                );
            }
            default:
                return null;
        }
    };

    return (
        <div className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
            {/* Chart tabs — one per table on the sheet */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
                {charts.map((chart) => (
                    <div
                        key={chart.id}
                        className={cn(
                            "group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border shrink-0",
                            chart.id === config?.id
                                ? "bg-white border-slate-300 text-indigo-700 shadow-sm"
                                : "bg-transparent border-transparent text-slate-500 hover:bg-slate-100"
                        )}
                        onClick={() => setActiveChartId(chart.id)}
                        onDoubleClick={() => startRenameChart(chart)}
                    >
                        {renamingChartId === chart.id ? (
                            <input
                                autoFocus
                                className="w-20 text-xs px-1 py-0 border border-indigo-300 rounded outline-none"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") commitRenameChart();
                                    else if (e.key === "Escape") setRenamingChartId(null);
                                }}
                                onBlur={commitRenameChart}
                            />
                        ) : (
                            <span>{chart.name}</span>
                        )}
                        {renamingChartId !== chart.id && (
                            <button
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); deleteChart(chart.id); }}
                                title="Delete chart"
                            >
                                <IconX className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
                <button className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 shrink-0 cursor-pointer" onClick={addChart} title="Add chart">
                    <IconPlus className="w-4 h-4" />
                </button>
                </div>
                {config && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 cursor-pointer hover:bg-slate-200/50 text-slate-500"
                        onClick={() => setIsToolbarExpanded((v) => !v)}
                        title={isToolbarExpanded ? "Collapse chart toolbar" : "Expand chart toolbar"}
                    >
                        {isToolbarExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                    </Button>
                )}
            </div>

            {!config ? (
                <div className="flex items-center justify-center h-40 text-sm text-slate-400 text-center px-6">
                    No charts yet. Click the "+" above to add one for a table on this sheet.
                </div>
            ) : (
            <>
            <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isToolbarExpanded ? "max-h-[220px] opacity-100" : "max-h-0 opacity-0"
            )}>
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-200 bg-slate-50/60">
                <div className="flex items-center flex-wrap">
                    {CHART_TYPE_GROUPS.map((group) => (
                        <div key={group.label} className="flex flex-col items-center gap-1 px-2 py-1 border-r border-slate-200 last:border-r-0">
                            <div className="flex items-center gap-1">
                                {group.types.map((t) => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => applyConfig({ type: t.key })}
                                        title={t.label}
                                        className={cn(
                                            "flex items-center justify-center w-9 h-7 rounded border cursor-pointer transition-colors",
                                            config.type === t.key ? "bg-indigo-100 border-indigo-300" : "bg-white border-slate-200 hover:bg-slate-50"
                                        )}
                                    >
                                        <ChartTypePreview type={t.key} />
                                    </button>
                                ))}
                            </div>
                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">{group.label}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-1">
                    {hadInvalid && (
                        <span title="Some cells in the selected range aren't numbers and were treated as 0." className="flex items-center gap-1 text-amber-600 text-[11px] px-1.5 shrink-0">
                            <IconAlertTriangle className="w-3.5 h-3.5" /> Data warning
                        </span>
                    )}
                    <Button
                        variant="ghost" size="sm"
                        className={cn("h-7 text-[11px] px-1.5 cursor-pointer", config.legendPosition !== "none" && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                        onClick={() => applyConfig({ legendPosition: config.legendPosition === "none" ? "bottom" : "none" })}
                        title="Toggle legend — use Design for position"
                    >
                        Legend
                    </Button>
                    <Button
                        variant="ghost" size="sm"
                        className={cn("h-7 text-[11px] px-1.5 cursor-pointer", config.showGridlines && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                        onClick={() => applyConfig({ showGridlines: !config.showGridlines })}
                        title="Toggle gridlines"
                    >
                        Gridlines
                    </Button>
                    <Button
                        variant="ghost" size="sm"
                        className={cn("h-7 text-[11px] px-1.5 cursor-pointer", config.showDataLabels && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100")}
                        onClick={() => applyConfig({ showDataLabels: !config.showDataLabels })}
                        title="Toggle data labels"
                    >
                        Labels
                    </Button>
                    <Popover open={popoverOpen} onOpenChange={openPopover}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 cursor-pointer" title="Chart data settings">
                                <IconSettings className="w-3.5 h-3.5" /> Data
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 bg-white border border-slate-200 shadow-md rounded-lg space-y-3" align="end">
                            {draft && (
                                <>
                                    <div className="space-y-1">
                                        <Button
                                            size="sm" variant="outline"
                                            className="w-full h-8 text-xs cursor-pointer gap-1.5"
                                            onClick={useSelectionForDraft}
                                        >
                                            <IconClick className="w-3.5 h-3.5" /> Use Current Selection
                                        </Button>
                                        <p className="text-[10px] text-slate-400 leading-snug">
                                            Drag-select a table's cells in the sheet below (include its header row), then click this to fill in the range.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">X-Axis Column</Label>
                                        <select
                                            className="w-full h-8 text-xs border border-slate-200 rounded px-2 cursor-pointer"
                                            value={draft.xAxisCol}
                                            onChange={(e) => setDraftXAxis(e.target.value)}
                                        >
                                            {columnOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Y-Axis Series</Label>
                                        <div className="max-h-28 overflow-y-auto space-y-1 border border-slate-100 rounded p-1.5">
                                            {columnOptions.filter((c) => c !== draft.xAxisCol).map((c) => (
                                                <div key={c} className="flex items-center gap-2">
                                                    <Checkbox id={`chartcol-${c}`} checked={draft.valueCols.includes(c)} onCheckedChange={() => toggleDraftValueCol(c)} />
                                                    <label htmlFor={`chartcol-${c}`} className="text-xs text-slate-700 cursor-pointer select-none">Column {c}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Checkbox id="chartHasHeader" checked={draft.hasHeaderRow} onCheckedChange={(v) => setDraft((d) => ({ ...d, hasHeaderRow: !!v }))} />
                                        <label htmlFor="chartHasHeader" className="text-xs text-slate-700 cursor-pointer select-none">First row has headers</label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Row Start</Label>
                                            <input
                                                type="number" min={1}
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2"
                                                value={draft.rowStart}
                                                onChange={(e) => setDraft((d) => ({ ...d, rowStart: Number(e.target.value) || 1 }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Row End</Label>
                                            <input
                                                type="number" min={1}
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2"
                                                value={draft.rowEnd}
                                                onChange={(e) => setDraft((d) => ({ ...d, rowEnd: Number(e.target.value) || 1 }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-1.5 pt-1">
                                        <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => setPopoverOpen(false)}>Cancel</Button>
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                                            onClick={() => { applyConfig(draft); setPopoverOpen(false); }}
                                            disabled={draft.valueCols.length === 0}
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                </>
                            )}
                        </PopoverContent>
                    </Popover>

                    <Popover open={designPopoverOpen} onOpenChange={openDesignPopover}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 cursor-pointer" title="Chart design">
                                <IconPalette className="w-3.5 h-3.5" /> Design
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 bg-white border border-slate-200 shadow-md rounded-lg space-y-3 max-h-[70vh] overflow-y-auto" align="end">
                            {designDraft && (
                                <>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Chart Title</Label>
                                        <input
                                            className="w-full h-8 text-xs border border-slate-200 rounded px-2"
                                            placeholder="(none)"
                                            value={designDraft.title}
                                            onChange={(e) => setDesignDraft((d) => ({ ...d, title: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Legend Position</Label>
                                        <div className="flex items-center gap-1">
                                            {[
                                                { value: "top", icon: IconLayoutAlignTop, title: "Top" },
                                                { value: "bottom", icon: IconLayoutAlignBottom, title: "Bottom" },
                                                { value: "left", icon: IconLayoutAlignLeft, title: "Left" },
                                                { value: "right", icon: IconLayoutAlignRight, title: "Right" },
                                                { value: "none", icon: IconEyeOff, title: "None" },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    title={opt.title}
                                                    onClick={() => setDesignDraft((d) => ({ ...d, legendPosition: opt.value }))}
                                                    className={cn(
                                                        "flex-1 h-8 flex items-center justify-center rounded border cursor-pointer",
                                                        designDraft.legendPosition === opt.value ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <opt.icon className="w-3.5 h-3.5" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {designDraft.type === "combo" && (
                                        <div className="space-y-1.5 border-t border-slate-100 pt-2">
                                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Combo Series Configuration</Label>
                                            <div className="space-y-1.5">
                                                {designDraft.valueCols.map((c, i) => {
                                                    const settings = getComboSeriesSettings(designDraft, c, i);
                                                    return (
                                                        <div key={c} className="flex items-center gap-1.5">
                                                            <span className="text-[11px] text-slate-600 w-12 shrink-0 truncate">Col {c}</span>
                                                            <select
                                                                className="flex-1 h-7 text-[11px] border border-slate-200 rounded px-1.5 cursor-pointer"
                                                                value={settings.type}
                                                                onChange={(e) => setDesignDraft((d) => ({
                                                                    ...d,
                                                                    comboSettings: { ...d.comboSettings, [c]: { ...getComboSeriesSettings(d, c, i), type: e.target.value } },
                                                                }))}
                                                            >
                                                                <option value="column">Column</option>
                                                                <option value="line">Line</option>
                                                                <option value="area">Area</option>
                                                            </select>
                                                            <select
                                                                className="flex-1 h-7 text-[11px] border border-slate-200 rounded px-1.5 cursor-pointer"
                                                                value={settings.yAxisId}
                                                                onChange={(e) => setDesignDraft((d) => ({
                                                                    ...d,
                                                                    comboSettings: { ...d.comboSettings, [c]: { ...getComboSeriesSettings(d, c, i), yAxisId: e.target.value } },
                                                                }))}
                                                            >
                                                                <option value="left">Primary (Left)</option>
                                                                <option value="right">Secondary (Right)</option>
                                                            </select>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="designShowLabels"
                                                checked={designDraft.showDataLabels}
                                                onCheckedChange={(v) => setDesignDraft((d) => ({ ...d, showDataLabels: !!v }))}
                                            />
                                            <label htmlFor="designShowLabels" className="text-xs text-slate-700 cursor-pointer select-none">Show data labels</label>
                                        </div>
                                        {designDraft.showDataLabels && (
                                            <select
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2 cursor-pointer"
                                                value={designDraft.labelPosition}
                                                onChange={(e) => setDesignDraft((d) => ({ ...d, labelPosition: e.target.value }))}
                                            >
                                                <option value="auto">Auto</option>
                                                {getLabelPositionOptions(designDraft.type).map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                            {designDraft.type === "pie" || designDraft.type === "doughnut" ? "Slice Colors" : "Series Colors"}
                                        </Label>
                                        {designDraft.type === "pie" || designDraft.type === "doughnut" ? (
                                            // A pie/doughnut has one series but one color per slice — a solid
                                            // "series color" would just flatten every slice to the same hue,
                                            // so only per-slice overrides are offered here.
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {data.map((row, i) => (
                                                    <label key={row.name} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 cursor-pointer">
                                                        <span className="truncate">{row.name}</span>
                                                        <input
                                                            type="color"
                                                            className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer shrink-0"
                                                            value={pieCellColorFor(designDraft, designDraft.valueCols[0], row.name, i)}
                                                            onChange={(e) => setDesignPointColor(designDraft.valueCols[0], row.name, e.target.value)}
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {designDraft.valueCols.map((c, i) => {
                                                    const categories = supportsPointColors ? data.map((row) => row.name) : [];
                                                    const isExpanded = expandedPointSeries === c;
                                                    return (
                                                        <div key={c} className="border border-slate-100 rounded p-1.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                                                                    <input
                                                                        type="color"
                                                                        className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer"
                                                                        value={designDraft.seriesColors?.[c] || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                                                                        onChange={(e) => setDesignDraft((d) => ({ ...d, seriesColors: { ...d.seriesColors, [c]: e.target.value } }))}
                                                                    />
                                                                    Col {c}
                                                                </label>
                                                                {supportsPointColors && categories.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className="flex items-center gap-0.5 text-[10px] text-indigo-600 hover:underline cursor-pointer"
                                                                        onClick={() => setExpandedPointSeries(isExpanded ? null : c)}
                                                                    >
                                                                        Customize points {isExpanded ? <IconChevronUp className="w-3 h-3" /> : <IconChevronDown className="w-3 h-3" />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {isExpanded && (
                                                                <div className="mt-1.5 pt-1.5 border-t border-slate-100 space-y-1 max-h-28 overflow-y-auto">
                                                                    {categories.map((name) => (
                                                                        <label key={name} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 cursor-pointer">
                                                                            <span className="truncate">{name}</span>
                                                                            <input
                                                                                type="color"
                                                                                className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer shrink-0"
                                                                                value={pointColorFor(designDraft, c, name, i)}
                                                                                onChange={(e) => setDesignPointColor(c, name, e.target.value)}
                                                                            />
                                                                        </label>
                                                                    ))}
                                                                    <button
                                                                        type="button"
                                                                        className="text-[10px] text-slate-400 hover:text-red-500 hover:underline cursor-pointer"
                                                                        onClick={() => resetDesignPointColors(c)}
                                                                    >
                                                                        Reset to series color
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-1.5 pt-1">
                                        <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => setDesignPopoverOpen(false)}>Cancel</Button>
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                                            onClick={() => { applyConfig(designDraft); setDesignPopoverOpen(false); }}
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                </>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            </div>

            <div className="p-3">
                {config.title && (
                    <div className="text-center text-sm font-semibold text-slate-900 mb-1.5">{config.title}</div>
                )}
                {!activeSheet ? (
                    <div className="flex items-center justify-center h-64 text-sm text-slate-400">Loading sheet…</div>
                ) : data.length === 0 || seriesKeys.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-sm text-slate-400 text-center px-6">
                        No data in the selected range. Use the "Data" settings above to choose columns and rows to chart.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={320}>
                        {renderChart()}
                    </ResponsiveContainer>
                )}
            </div>
            </>
            )}
        </div>
    );
}
