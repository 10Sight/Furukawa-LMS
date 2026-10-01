import React, { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    IconAlertTriangle, IconClick, IconPlus, IconX, IconPalette,
    IconLayoutAlignTop, IconLayoutAlignBottom, IconLayoutAlignLeft, IconLayoutAlignRight, IconEyeOff,
    IconChevronDown, IconChevronUp, IconMaximize, IconMinimize, IconChartBar,
    IconChartInfographic, IconTableShortcut, IconInfoCircle, IconSwitchHorizontal
} from "@tabler/icons-react";
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ComposedChart
} from "recharts";
import { getCellId, colToIndex, indexToCol, parseCellRef } from "./formulaEngine";
import {
    parseNumericCell, parseRangeString, formatRangeString, chartRanges, naturalPlotBy,
    seriesIdsForRanges, seriesCountForRanges, MAX_CHART_SERIES, extractDisjointChartData, legacyConfigRanges,
} from "./chartMatrixEngine";
import { cn } from "@/lib/utils";
import FullScreenFrame from "./FullScreenFrame";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    RibbonGroup, RibbonBtn, RibbonDropdown, RibbonSplit, MenuItem, MenuSeparator, MenuHeader, MenuClose,
} from "./ribbonParts";
import {
    CHART_VARIANTS, CHART_FAMILIES, RIBBON_CHART_MENUS, variantType, comboSettingsForPreset, familyOfVariant,
    EXTRA_CHART_TYPES, SPARKLINE_TYPES, chartRequirement,
} from "./chartTypes";
import {
    ChartThumb, RibbonFamilyIcon, RecommendedChartsIcon, MapsIcon, PivotChartIcon, SparkLineIcon, SparkColumnIcon, SparkWinLossIcon,
} from "./chartCatalog";
import { renderExtraChart, Sparklines } from "./chartExtras";

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

// Series are keyed by column letter, or by row number when a chart plots by rows.
const seriesIdLabel = (id) => (/^\d+$/.test(String(id)) ? `Row ${id}` : `Col ${id}`);

// Reads the configured row/column range out of the live displayGrid. A text
// cell inside the range is treated as 0 rather than thrown away, with
// `hadInvalid` surfaced so the toolbar can show a non-blocking warning.
function buildChartData({ activeSheet, displayGrid, config }) {
    // Charts built from a range list (Ctrl-selected, or switched to plot by
    // rows) read exactly those ranges; the fields below are the older
    // single-block form, still used by every chart saved without one.
    if (chartRanges(config)) return extractDisjointChartData({ displayGrid, config });
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
// 100% stacked line: the same running sum, as a fraction of each category's total.
const applyPercentLineCumulative = (data, seriesKeys) => data.map((row) => {
    const total = seriesKeys.reduce((s, key) => s + Math.abs(row[key] || 0), 0);
    const next = { name: row.name };
    let cumulative = 0;
    seriesKeys.forEach((key) => {
        cumulative += Math.abs(row[key] || 0);
        next[key] = total ? cumulative / total : 0;
    });
    return next;
});
const prepareChartData = (activeSheet, displayGrid, cfg) => {
    if (!activeSheet || !cfg) return { data: [], seriesKeys: [], hadInvalid: false };
    const result = buildChartData({ activeSheet, displayGrid, config: cfg });
    if (cfg.type === "lineStacked") return { ...result, data: applyStackedLineCumulative(result.data, result.seriesKeys) };
    if (cfg.type === "linePercent") return { ...result, data: applyPercentLineCumulative(result.data, result.seriesKeys) };
    return result;
};

// Newer variants reuse their base family's data-label positions.
const LABEL_FAMILY = { columnPercent: "columnStacked", barPercent: "barStacked", linePercent: "lineStacked", lineMarkers: "line", areaStacked: "area", areaPercent: "area" };
const labelFamily = (type) => LABEL_FAMILY[type] || type;
// Only these draw one mark per (series, category), so only they can recolor single points.
const POINT_COLOR_TYPES = new Set(["columnGrouped", "columnStacked", "columnPercent", "barGrouped", "barStacked", "barPercent", "pie", "doughnut"]);

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
const getLabelPositionOptions = (chartType) => LABEL_POSITION_OPTIONS_BY_TYPE[labelFamily(chartType)] || LABEL_POSITION_OPTIONS_BY_TYPE.columnGrouped;

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
    const family = labelFamily(config.type);
    const key = config.labelPosition && config.labelPosition !== "auto" ? config.labelPosition : AUTO_LABEL_POSITION[family];
    return RECHARTS_LABEL_POSITION[family]?.[key] || "top";
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

// Per-series chart types a combo chart can mix (the renderer's three marks).
const COMBO_SERIES_TYPES = [["column", "Clustered Column"], ["line", "Line"], ["area", "Area"]];

// Chart types whose categories run left to right along the X axis; only these
// grow wider (and scroll) as categories are added.
const HORIZONTAL_CATEGORY_TYPES = new Set([
    "columnGrouped", "columnStacked", "columnPercent", "line", "lineStacked", "linePercent", "lineMarkers",
    "area", "areaStacked", "areaPercent", "combo", "histogram", "pareto", "waterfall", "stock",
]);
// Narrowest width, in px, at which every category stays readable. Side-by-side
// columns need room for each series' bar; everything else one slot per category.
const chartMinWidth = (cfg, { data, seriesKeys }) => {
    if (!HORIZONTAL_CATEGORY_TYPES.has(cfg.type)) return undefined;
    const barsPerCategory = cfg.type === "columnGrouped" ? seriesKeys.length
        : cfg.type === "combo" ? seriesKeys.filter((_, i) => getComboSeriesSettings(cfg, cfg.valueCols[i], i).type === "column").length
            : 1;
    return data.length * Math.max(44, barsPerCategory * 14 + 12) + 80;
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

// Excel's Insert Chart / Change Chart Type dialog: a Recommended Charts tab with
// live thumbnails of the user's own data, and an All Charts tab listing every
// family and its variants, both with a large preview of the selection.
// Combo variants add Excel's per-series table (chart type + secondary axis):
// `comboSeries` lists the chart's series with their current settings, and the
// edited settings are handed to `renderPreview` and `onOk`.
function InsertChartDialog({ state, onClose, recommended, currentType, comboSeries, renderPreview, onOk }) {
    const [tab, setTab] = useState("recommended");
    const [family, setFamily] = useState("column");
    const [selected, setSelected] = useState("columnGrouped");
    const [comboSettings, setComboSettings] = useState({});

    // Picking a combo preset fills the series table from it; Custom
    // Combination keeps whatever the table currently holds.
    const select = (key) => {
        setSelected(key);
        const preset = CHART_VARIANTS[key]?.preset;
        if (preset) setComboSettings(comboSettingsForPreset(preset, comboSeries.map((s) => s.id)));
    };

    useEffect(() => {
        if (!state) return;
        setTab(state.tab);
        const fam = CHART_FAMILIES.find((f) => f.key === state.family) || CHART_FAMILIES[0];
        setFamily(fam.key);
        setComboSettings(Object.fromEntries(comboSeries.map((s) => [s.id, { type: s.type, yAxisId: s.yAxisId }])));
        select(state.tab === "recommended" ? recommended[0] : (state.select || (fam.keys.includes(currentType) ? currentType : fam.keys[0])));
        // Only re-seed when the dialog (re)opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    const chooseTab = (next) => {
        setTab(next);
        if (next === "recommended") select(recommended[0]);
        else {
            const fam = CHART_FAMILIES.find((f) => f.key === family) || CHART_FAMILIES[0];
            select(fam.keys.includes(selected) ? selected : fam.keys[0]);
        }
    };
    const chooseFamily = (key) => {
        setFamily(key);
        select(CHART_FAMILIES.find((f) => f.key === key).keys[0]);
    };
    const activeFamily = CHART_FAMILIES.find((f) => f.key === family) || CHART_FAMILIES[0];
    const variant = CHART_VARIANTS[selected];
    const isCombo = variantType(selected) === "combo";
    const selectedComboSettings = isCombo ? comboSettings : undefined;
    // Editing a series turns any preset into a Custom Combination, like Excel.
    const setSeriesSetting = (id, patch) => {
        setComboSettings((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
        setSelected("combo");
    };

    return (
        <Dialog open={!!state} onOpenChange={(open) => { if (!open) onClose(); }} className="max-w-4xl">
            <DialogContent role="dialog" className="p-0">
                <DialogHeader className="px-5 pt-4 mb-0">
                    <DialogTitle className="text-base">{state?.tab === "all" && currentType ? "Change Chart Type" : "Insert Chart"}</DialogTitle>
                </DialogHeader>
                <div className="flex gap-1 px-5 border-b border-slate-200">
                    {[["recommended", "Recommended Charts"], ["all", "All Charts"]].map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => chooseTab(key)}
                            className={cn(
                                "relative px-3 py-2 text-[13px] cursor-pointer",
                                tab === key ? "text-[#107C41] font-semibold" : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            {label}
                            {tab === key && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-full bg-[#107C41]" />}
                        </button>
                    ))}
                </div>
                <div className="flex h-[500px]">
                    <div className="w-52 shrink-0 border-r border-slate-200 overflow-y-auto p-2 space-y-1 bg-slate-50/60">
                        {tab === "recommended" ? recommended.map((key) => (
                            <button
                                key={key}
                                type="button"
                                title={CHART_VARIANTS[key].label}
                                onClick={() => select(key)}
                                onDoubleClick={() => onOk(key)}
                                className={cn(
                                    "w-full h-24 p-1.5 bg-white border rounded-sm cursor-pointer",
                                    selected === key ? "border-amber-500 ring-1 ring-amber-400" : "border-slate-200 hover:border-amber-300"
                                )}
                            >
                                <div className="w-full h-full pointer-events-none">{renderPreview(key, true)}</div>
                            </button>
                        )) : CHART_FAMILIES.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => chooseFamily(f.key)}
                                className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1 rounded-sm text-left text-xs cursor-pointer",
                                    family === f.key ? "bg-amber-100 text-slate-900 font-medium" : "text-slate-700 hover:bg-slate-100"
                                )}
                            >
                                <ChartThumb type={f.keys[0]} className="w-5 h-5 shrink-0" />
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
                        {tab === "all" && (
                            <div className="flex flex-wrap gap-1.5">
                                {activeFamily.keys.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        title={CHART_VARIANTS[key].label}
                                        onClick={() => select(key)}
                                        onDoubleClick={() => onOk(key, CHART_VARIANTS[key].preset ? undefined : comboSettings)}
                                        className={cn(
                                            "p-1 border rounded-sm cursor-pointer",
                                            selected === key ? "border-amber-500 bg-amber-50" : "border-transparent hover:border-amber-300"
                                        )}
                                    >
                                        <ChartThumb type={key} className="w-11 h-11" />
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="text-sm font-semibold text-slate-800">{variant?.label}</div>
                        <div className="flex-1 min-h-0 border border-slate-200 rounded-sm bg-white p-3">
                            {selected && renderPreview(selected, false, selectedComboSettings)}
                        </div>
                        {isCombo ? (
                            <div className="space-y-1">
                                <div className="text-xs text-slate-700">Choose the chart type and axis for your data series:</div>
                                <div className="h-36 overflow-y-auto border border-slate-300 bg-white">
                                    <table className="w-full text-xs border-collapse">
                                        <thead className="sticky top-0 bg-white">
                                            <tr className="text-left text-slate-700">
                                                <th className="font-normal px-2 py-1 border-b border-r border-slate-200">Series Name</th>
                                                <th className="font-normal px-2 py-1 border-b border-r border-slate-200 w-48">Chart Type</th>
                                                <th className="font-normal px-2 py-1 border-b border-slate-200 w-28 text-center">Secondary Axis</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comboSeries.map((s) => {
                                                const setting = comboSettings[s.id] || { type: s.type, yAxisId: s.yAxisId };
                                                return (
                                                    <tr key={s.id}>
                                                        <td className="px-2 py-1.5">
                                                            <span className="flex items-center gap-2 min-w-0">
                                                                <span className="w-2 h-4 shrink-0" style={{ backgroundColor: s.color }} />
                                                                <span className="truncate" title={s.name}>{s.name}</span>
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <select
                                                                aria-label={`Chart type for ${s.name}`}
                                                                className="w-full h-7 text-xs border border-slate-300 rounded-sm px-1.5 cursor-pointer bg-white"
                                                                value={setting.type}
                                                                onChange={(e) => setSeriesSetting(s.id, { type: e.target.value })}
                                                            >
                                                                {COMBO_SERIES_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <Checkbox
                                                                aria-label={`Secondary axis for ${s.name}`}
                                                                checked={setting.yAxisId === "right"}
                                                                onCheckedChange={(v) => setSeriesSetting(s.id, { yAxisId: v ? "right" : "left" })}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {comboSeries.length === 0 && (
                                                <tr><td colSpan={3} className="px-2 py-3 text-center text-slate-400">This chart has no data series yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 leading-snug">{variant?.desc}</p>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
                    <Button size="sm" className="h-8 px-5 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => onOk(selected, selectedComboSettings)} disabled={!selected}>OK</Button>
                    <Button size="sm" variant="outline" className="h-8 px-4 cursor-pointer" onClick={onClose}>Cancel</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ExcelGraph({ excelData, onChartsChange }) {
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [draft, setDraft] = useState(null);
    const [designPopoverOpen, setDesignPopoverOpen] = useState(false);
    const [designDraft, setDesignDraft] = useState(null);
    const [expandedPointSeries, setExpandedPointSeries] = useState(null); // series col letter, or null
    const [activeChartId, setActiveChartId] = useState(null);
    const [renamingChartId, setRenamingChartId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const exitFullScreen = useCallback(() => setIsFullScreen(false), []);
    const [ribbonTab, setRibbonTab] = useState("insert"); // "insert" | "design"
    // Insert Chart dialog: the tab it opened on and the family shown under All Charts.
    const [insertDialog, setInsertDialog] = useState(null); // { tab: "recommended" | "all", family }

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

    const addChart = (patch = {}) => {
        const newChart = { ...buildDefaultChart(columnCount, rowCount, nextChartId(), `Chart ${charts.length + 1}`), ...patch };
        setActiveChartId(newChart.id);
        onChartsChange?.([...charts, newChart]);
    };

    // Patch for switching to a catalog variant; combo presets also seed each
    // series' column/line/area type and axis.
    // `comboSettings` (from the dialog's series table) wins over the preset.
    const variantPatch = (key, cfg, comboSettings) => {
        const v = CHART_VARIANTS[key];
        const patch = { type: variantType(key) };
        if (v?.preset) patch.comboSettings = comboSettingsForPreset(v.preset, cfg?.valueCols || []);
        if (comboSettings && patch.type === "combo") patch.comboSettings = comboSettings;
        return patch;
    };
    // Picking a chart type changes the active chart (or inserts one when there is none).
    const applyVariant = (key, comboSettings) => {
        if (config) applyConfig(variantPatch(key, config, comboSettings));
        else addChart(variantPatch(key, buildDefaultChart(columnCount, rowCount), comboSettings));
    };
    // Opens the dialog on Combo > Custom Combination, with its series table.
    const openCustomCombo = () => setInsertDialog({ tab: "all", family: "combo", select: "combo" });
    const openInsertDialog = (tab, family) => setInsertDialog({ tab, family: family || familyOfVariant(config?.type || "columnGrouped") });

    // PivotChart: chart the active PivotTable sheet's whole used range.
    const insertPivotChart = () => {
        if (!activeSheet?.pivotConfig) {
            toast.info("Open a PivotTable sheet first: create one from the spreadsheet's Insert > PivotTable, then choose PivotChart here.");
            return;
        }
        let maxRow = -1, maxCol = -1, minRow = Infinity;
        for (const id of Object.keys(activeSheet.cells || {})) {
            const ref = parseCellRef(id);
            const v = displayGrid[id];
            if (!ref || v === undefined || v === "") continue;
            minRow = Math.min(minRow, ref.row); maxRow = Math.max(maxRow, ref.row); maxCol = Math.max(maxCol, ref.col);
        }
        if (maxRow < 0 || maxCol < 1) { toast.error("This PivotTable has no data to chart yet."); return; }
        const valueCols = [];
        for (let c = 1; c <= maxCol; c++) valueCols.push(indexToCol(c));
        addChart({ type: "columnGrouped", xAxisCol: "A", valueCols, rowStart: minRow + 1, rowEnd: maxRow + 1, hasHeaderRow: true, name: "PivotChart" });
    };

    const prepared = useMemo(() => prepareChartData(activeSheet, displayGrid, config), [activeSheet, displayGrid, config]);
    const { data, seriesKeys, hadInvalid } = prepared;

    // The chart's series with their current combo type/axis, for the Change
    // Chart Type dialog's series table.
    const comboSeries = useMemo(() => (config ? seriesKeys.map((name, i) => {
        const id = config.valueCols[i];
        return { id, name, color: config.seriesColors?.[id] || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length], ...getComboSeriesSettings(config, id, i) };
    }) : []), [config, seriesKeys]);

    // Excel's Recommended Charts: a short list suited to the data's shape.
    const recommendedVariants = useMemo(() => {
        const n = seriesKeys.length, rows = data.length;
        const numericX = rows > 1 && data.every((row) => Number.isFinite(parseFloat(String(row.name).replace(/[$,%\s]/g, ""))));
        const allPositive = data.every((row) => seriesKeys.every((k) => (row[k] || 0) >= 0));
        const list = ["columnGrouped"];
        if (n <= 1) {
            if (allPositive && rows > 0 && rows <= 10) list.push("pie");
            list.push("barGrouped");
            if (rows >= 4) list.push("line");
            if (allPositive) list.push("treemap");
            list.push("funnel");
        } else {
            list.push("columnStacked", "lineMarkers", "barGrouped");
            if (n === 2) list.push("comboColumnLineSecondary");
            list.push("areaStacked", "radar");
        }
        if (numericX) list.push("scatter");
        return [...new Set(list)].slice(0, 8);
    }, [data, seriesKeys]);

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
    const supportsPointColors = config && POINT_COLOR_TYPES.has(config.type);

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
        // A Ctrl-selection of several ranges is charted as a range list, so
        // the rows/columns skipped between the ranges stay out of the chart.
        const multi = excelData?.ranges;
        if (Array.isArray(multi) && multi.length > 1) {
            setDraft((d) => ({ ...d, rangeString: formatRangeString(multi), plotBy: naturalPlotBy(multi), hasHeaderRow: true }));
            toast.success("Ranges filled from your selection — review and Apply.");
            return;
        }
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

        setDraft((d) => ({ ...d, xAxisCol, valueCols, rowStart: minRow + 1, rowEnd: maxRow + 1, hasHeaderRow, rangeString: "", ranges: undefined, plotBy: undefined }));
        toast.success("Range filled from your selection — review and Apply.");
    };

    const draftUsesRanges = !!draft && (!!String(draft.rangeString || "").trim() || !!draft.ranges?.length);

    const warnIfTooManySeries = (ranges, plotBy, hasHeader) => {
        const total = seriesCountForRanges(ranges, plotBy, hasHeader);
        if (total > MAX_CHART_SERIES) toast.warning(`This range has ${total} series; only the first ${MAX_CHART_SERIES} are plotted.`);
    };

    // Select Data > Apply. A range list is validated here, and `valueCols` is
    // re-pointed at its series so colors and combo settings stay keyed to them.
    const applyDraft = () => {
        if (!draftUsesRanges) {
            applyConfig({ ...draft, rangeString: "", ranges: undefined, plotBy: undefined });
            setPopoverOpen(false);
            return;
        }
        const ranges = String(draft.rangeString || "").trim() ? parseRangeString(draft.rangeString) : draft.ranges;
        if (!ranges) {
            toast.error("Enter ranges like A1:A10, C1:C10.");
            return;
        }
        const plotBy = draft.plotBy || naturalPlotBy(ranges);
        warnIfTooManySeries(ranges, plotBy, draft.hasHeaderRow !== false);
        applyConfig({
            ...draft,
            rangeString: formatRangeString(ranges),
            ranges: undefined,
            plotBy,
            valueCols: seriesIdsForRanges(ranges, plotBy, draft.hasHeaderRow !== false),
        });
        setPopoverOpen(false);
    };

    // Excel's Switch Row/Column: series become categories and vice versa.
    const switchRowColumn = () => {
        if (!config) return;
        let ranges = chartRanges(config);
        let current = config.plotBy || (ranges ? naturalPlotBy(ranges) : "columns");
        if (!ranges) {
            const xIdx = colToIndex(config.xAxisCol || "A");
            if ((config.valueCols || []).some((c) => colToIndex(c) < xIdx)) {
                toast.error("Switch Row/Column needs the X-axis column to be left of the value columns.");
                return;
            }
            ranges = legacyConfigRanges({ ...config, rowEnd: Math.min(Number(config.rowEnd) || rowCount, rowCount || Infinity) });
            current = "columns";
        }
        const plotBy = current === "rows" ? "columns" : "rows";
        warnIfTooManySeries(ranges, plotBy, config.hasHeaderRow !== false);
        applyConfig({
            rangeString: formatRangeString(ranges),
            ranges: undefined,
            plotBy,
            valueCols: seriesIdsForRanges(ranges, plotBy, config.hasHeaderRow !== false),
        });
    };

    const setDraftXAxis = (col) => {
        setDraft((d) => ({ ...d, xAxisCol: col, valueCols: d.valueCols.filter((c) => c !== col) }));
    };

    const commonAxisProps = { tick: { fill: INK_MUTED, fontSize: 11 }, axisLine: { stroke: AXIS_LINE_COLOR }, tickLine: false };

    // Draws `cfg` from its prepared rows. `mini` strips axes/legend/labels for the
    // Insert Chart dialog's live thumbnails.
    const renderChartFor = (cfg, { data, seriesKeys }, mini = false) => {
        if (!cfg) return null;
        const colorFor = (index) => cfg.seriesColors?.[cfg.valueCols[index]] || CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
        const ax = mini ? { ...commonAxisProps, hide: true } : commonAxisProps;
        const legendPosition = mini ? "none" : (cfg.legendPosition || "bottom");
        const showLabels = !mini && cfg.showDataLabels;
        const showGrid = !mini && cfg.showGridlines;
        const labelPos = resolveLabelPosition(cfg);
        const margin = mini ? { top: 4, right: 4, left: 4, bottom: 4 } : { top: 8, right: 12, left: -12, bottom: 0 };
        const legend = legendPosition !== "none" && seriesKeys.length > 1
            ? <Legend wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }} {...legendPropsFor(legendPosition)} />
            : null;
        const percentTick = (v) => `${Math.round(v * 100)}%`;

        if (EXTRA_CHART_TYPES.has(cfg.type)) {
            return renderExtraChart({ cfg, data, seriesKeys, colorFor, axisProps: ax, legend, mini });
        }

        switch (cfg.type) {
            case "columnGrouped":
            case "columnStacked":
            case "columnPercent": {
                const stacked = cfg.type !== "columnGrouped";
                const percent = cfg.type === "columnPercent";
                return (
                    <BarChart data={data} margin={margin} stackOffset={percent ? "expand" : undefined}>
                        {showGrid && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...ax} />
                        <YAxis {...ax} width={40} tickFormatter={percent ? percentTick : undefined} />
                        {!mini && <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />}
                        {legend}
                        {seriesKeys.map((key, i) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId={stacked ? "stack" : undefined}
                                fill={colorFor(i)}
                                maxBarSize={24}
                                isAnimationActive={!mini}
                                radius={stacked ? (i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
                            >
                                {data.map((row, di) => <Cell key={di} fill={pointColorFor(cfg, cfg.valueCols[i], row.name, i)} />)}
                                {showLabels && (
                                    <LabelList dataKey={key} position={labelPos} fill={labelPos.startsWith("inside") || labelPos === "center" ? "#ffffff" : INK_SECONDARY} fontSize={10} />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                );
            }
            case "barGrouped":
            case "barStacked":
            case "barPercent": {
                const stacked = cfg.type !== "barGrouped";
                const percent = cfg.type === "barPercent";
                return (
                    <BarChart data={data} layout="vertical" margin={mini ? margin : { top: 8, right: 20, left: 0, bottom: 0 }} stackOffset={percent ? "expand" : undefined}>
                        {showGrid && <CartesianGrid stroke={GRIDLINE_COLOR} horizontal={false} />}
                        <XAxis type="number" {...ax} tickFormatter={percent ? percentTick : undefined} />
                        <YAxis dataKey="name" type="category" {...ax} width={70} />
                        {!mini && <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />}
                        {legend}
                        {seriesKeys.map((key, i) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId={stacked ? "stack" : undefined}
                                fill={colorFor(i)}
                                maxBarSize={24}
                                isAnimationActive={!mini}
                                radius={stacked ? (i === seriesKeys.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]) : [0, 4, 4, 0]}
                            >
                                {data.map((row, di) => <Cell key={di} fill={pointColorFor(cfg, cfg.valueCols[i], row.name, i)} />)}
                                {showLabels && (
                                    <LabelList dataKey={key} position={labelPos} fill={labelPos.startsWith("inside") || labelPos === "center" ? "#ffffff" : INK_SECONDARY} fontSize={10} />
                                )}
                            </Bar>
                        ))}
                    </BarChart>
                );
            }
            case "line":
            case "lineStacked":
            case "linePercent":
            case "lineMarkers": {
                // Like Excel, only "Line with Markers" draws a dot on every point.
                const markers = cfg.type === "lineMarkers";
                const percent = cfg.type === "linePercent";
                return (
                    <LineChart data={data} margin={margin}>
                        {showGrid && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...ax} />
                        <YAxis {...ax} width={40} domain={percent ? [0, 1] : undefined} tickFormatter={percent ? percentTick : undefined} />
                        {!mini && <Tooltip content={<ChartTooltip />} />}
                        {legend}
                        {seriesKeys.map((key, i) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colorFor(i)}
                                strokeWidth={2}
                                isAnimationActive={!mini}
                                dot={markers && !mini ? { r: 4, strokeWidth: 2, stroke: CHART_SURFACE, fill: colorFor(i) } : false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_SURFACE }}
                            >
                                {showLabels && <LabelList dataKey={key} position={labelPos} fill={INK_SECONDARY} fontSize={10} />}
                            </Line>
                        ))}
                    </LineChart>
                );
            }
            case "area":
            case "areaStacked":
            case "areaPercent": {
                const stacked = cfg.type !== "area";
                const percent = cfg.type === "areaPercent";
                return (
                    <AreaChart data={data} margin={margin} stackOffset={percent ? "expand" : undefined}>
                        {showGrid && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...ax} />
                        <YAxis {...ax} width={40} tickFormatter={percent ? percentTick : undefined} />
                        {!mini && <Tooltip content={<ChartTooltip />} />}
                        {legend}
                        {seriesKeys.map((key, i) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stackId={stacked ? "stack" : undefined}
                                stroke={colorFor(i)}
                                strokeWidth={2}
                                fill={colorFor(i)}
                                fillOpacity={stacked ? 0.75 : 0.12}
                                isAnimationActive={!mini}
                            >
                                {showLabels && <LabelList dataKey={key} position={labelPos} fill={INK_SECONDARY} fontSize={10} />}
                            </Area>
                        ))}
                    </AreaChart>
                );
            }
            case "combo": {
                const seriesMeta = seriesKeys.map((key, i) => {
                    const col = cfg.valueCols[i];
                    return { key, ...getComboSeriesSettings(cfg, col, i), color: colorFor(i) };
                });
                const hasRightAxis = seriesMeta.some((s) => s.yAxisId === "right");
                const renderSeries = (s) => {
                    const labelList = showLabels && (
                        <LabelList key="ll" dataKey={s.key} position={labelPos} fill={INK_SECONDARY} fontSize={10} />
                    );
                    if (s.type === "column") {
                        return (
                            <Bar key={s.key} dataKey={s.key} yAxisId={s.yAxisId} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={!mini}>
                                {labelList}
                            </Bar>
                        );
                    }
                    if (s.type === "area") {
                        return (
                            <Area key={s.key} type="monotone" dataKey={s.key} yAxisId={s.yAxisId} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.12} isAnimationActive={!mini}>
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
                            isAnimationActive={!mini}
                            dot={mini ? false : { r: 4, strokeWidth: 2, stroke: CHART_SURFACE, fill: s.color }}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: CHART_SURFACE }}
                        >
                            {labelList}
                        </Line>
                    );
                };
                return (
                    <ComposedChart data={data} margin={margin}>
                        {showGrid && <CartesianGrid stroke={GRIDLINE_COLOR} vertical={false} />}
                        <XAxis dataKey="name" {...ax} />
                        <YAxis yAxisId="left" {...ax} width={40} />
                        {hasRightAxis && <YAxis yAxisId="right" orientation="right" {...ax} width={40} />}
                        {!mini && <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(79,70,229,0.06)" }} />}
                        {legend}
                        {seriesMeta.filter((s) => s.type === "area").map(renderSeries)}
                        {seriesMeta.filter((s) => s.type === "column").map(renderSeries)}
                        {seriesMeta.filter((s) => s.type === "line").map(renderSeries)}
                    </ComposedChart>
                );
            }
            case "pie":
            case "doughnut": {
                const key = seriesKeys[0];
                const piePos = resolvePieLabelPosition(cfg);
                return (
                    <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        {!mini && <Tooltip content={<ChartTooltip />} />}
                        {legendPosition !== "none" && (
                            <Legend
                                wrapperStyle={{ fontSize: 11, color: INK_SECONDARY }}
                                {...legendPropsFor(legendPosition)}
                                payload={data.map((d, i) => ({ value: d.name, type: "circle", color: pieCellColorFor(cfg, key, d.name, i) }))}
                            />
                        )}
                        <Pie
                            data={data}
                            dataKey={key}
                            nameKey="name"
                            innerRadius={cfg.type === "doughnut" ? "55%" : 0}
                            outerRadius={mini ? "95%" : "80%"}
                            stroke={CHART_SURFACE}
                            strokeWidth={2}
                            isAnimationActive={!mini}
                            label={showLabels ? (labelProps) => renderPieLabel(labelProps, piePos) : false}
                            labelLine={showLabels && piePos === "outsideEnd"}
                        >
                            {data.map((row, i) => <Cell key={i} fill={pieCellColorFor(cfg, key, row.name, i)} />)}
                        </Pie>
                    </PieChart>
                );
            }
            default:
                return null;
        }
    };

    // Chart body for any type: sparklines aren't a single recharts chart, and
    // some types need a particular data shape first.
    const renderChartBody = (cfg, prepared, mini = false) => {
        const requirement = chartRequirement(cfg.type, prepared.seriesKeys, prepared.data);
        if (requirement) {
            return <div className="flex items-center justify-center h-full text-center px-4 text-xs text-slate-400">{requirement}</div>;
        }
        if (SPARKLINE_TYPES.has(cfg.type)) {
            const colorFor = (index) => cfg.seriesColors?.[cfg.valueCols[index]] || CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
            return <Sparklines type={cfg.type} data={prepared.data} seriesKeys={prepared.seriesKeys} colorFor={colorFor} mini={mini} />;
        }
        // minWidth/minHeight keep recharts from measuring a 0px box (a collapsing
        // or not-yet-laid-out parent), which yields NaN geometry in the SVG.
        return (
            <ResponsiveContainer width="100%" height="100%" minWidth={mini ? 1 : 120} minHeight={mini ? 1 : 260}>
                {renderChartFor(cfg, prepared, mini)}
            </ResponsiveContainer>
        );
    };

    // A chart with many categories gets a fixed width per category instead of
    // being squeezed into the panel, and the panel scrolls sideways.
    const scrollableChart = (cfg, prepared) => (
        <div className="w-full h-full overflow-x-auto overflow-y-hidden">
            <div className="h-full" style={{ minWidth: chartMinWidth(cfg, prepared) }}>{renderChartBody(cfg, prepared)}</div>
        </div>
    );

    return (
        <FullScreenFrame isFullScreen={isFullScreen} onExit={exitFullScreen} title="Charts" icon={IconChartBar}>
        <div className={cn(
            "w-full border border-slate-200 rounded-lg overflow-hidden bg-white",
            isFullScreen && "flex-1 min-h-0 flex flex-col [&>*]:shrink-0 shadow-sm"
        )}>
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
                <button className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 shrink-0 cursor-pointer" onClick={() => addChart()} title="Add chart">
                    <IconPlus className="w-4 h-4" />
                </button>
                </div>
                {hadInvalid && config && (
                    <span title="Some cells in the selected range aren't numbers and were treated as 0." className="flex items-center gap-1 text-amber-600 text-[11px] px-1.5 shrink-0">
                        <IconAlertTriangle className="w-3.5 h-3.5" /> Data warning
                    </span>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 cursor-pointer hover:bg-slate-200/50 text-slate-500"
                    onClick={() => setIsToolbarExpanded((v) => !v)}
                    title={isToolbarExpanded ? "Collapse ribbon" : "Expand ribbon"}
                >
                    {isToolbarExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 cursor-pointer hover:bg-slate-200/50 text-slate-500"
                    onClick={() => setIsFullScreen((v) => !v)}
                    title={isFullScreen ? "Exit full screen (Esc)" : "Full screen"}
                >
                    {isFullScreen ? <IconMinimize className="w-4 h-4" /> : <IconMaximize className="w-4 h-4" />}
                </Button>
            </div>

            {/* Ribbon tabs — Insert mirrors Excel's Insert > Charts / Sparklines; Chart Design holds the chart's own settings */}
            <div className="flex items-end gap-1 px-2 border-b border-slate-200 bg-white select-none">
                {[["insert", "Insert"], ["design", "Chart Design"]].map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => { setRibbonTab(key); setIsToolbarExpanded(true); }}
                        className={cn(
                            "relative px-3 pt-1.5 pb-2 text-[13px] cursor-pointer rounded-t-sm hover:bg-slate-100",
                            ribbonTab === key && isToolbarExpanded ? "text-[#107C41] font-semibold" : "text-slate-600"
                        )}
                    >
                        {label}
                        {ribbonTab === key && isToolbarExpanded && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-full bg-[#107C41]" />}
                    </button>
                ))}
            </div>

            <div className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isToolbarExpanded ? "max-h-[160px] opacity-100" : "max-h-0 opacity-0"
            )}>
            {ribbonTab === "insert" ? (
            <div className="flex items-stretch border-b border-slate-200 bg-[#f8f8f8] overflow-x-auto themed-scrollbar">
                <RibbonGroup label="Charts" onLauncher={() => openInsertDialog("all")} launcherTitle="See All Charts">
                    <RibbonBtn className="h-full flex-col justify-start px-1.5 pt-1 gap-0.5" title="Recommended Charts" onClick={() => openInsertDialog("recommended")}>
                        <RecommendedChartsIcon />
                        <span className="text-xs leading-tight text-center">Recommended<br />Charts</span>
                    </RibbonBtn>
                    <div className="grid grid-cols-3 grid-rows-3 gap-x-1 content-between py-0.5">
                        {RIBBON_CHART_MENUS.map((menu) => (
                            <RibbonDropdown key={menu.key} title={menu.title} trigger={<RibbonFamilyIcon family={menu.key} />} contentClassName="w-auto p-1">
                                <MenuClose>{(close) => (
                                    <div className="w-[228px]">
                                        {menu.sections.map((section) => (
                                            <div key={section.title}>
                                                <MenuHeader>{section.title}</MenuHeader>
                                                <div className="flex flex-wrap gap-1 px-1 pb-1.5">
                                                    {section.keys.map((key) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            title={CHART_VARIANTS[key].label}
                                                            onClick={() => { close(); applyVariant(key); }}
                                                            className={cn(
                                                                "p-1 border rounded-sm cursor-pointer hover:border-amber-400 hover:bg-amber-50",
                                                                config?.type === variantType(key) && !CHART_VARIANTS[key].preset ? "border-amber-500 bg-amber-50" : "border-transparent"
                                                            )}
                                                        >
                                                            <ChartThumb type={key} className="w-10 h-10" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        <MenuSeparator />
                                        <MenuItem
                                            icon={IconChartInfographic}
                                            label={menu.more}
                                            onClick={() => (menu.key === "combo" ? openCustomCombo() : openInsertDialog("all", menu.family))}
                                        />
                                    </div>
                                )}</MenuClose>
                            </RibbonDropdown>
                        ))}
                    </div>
                    <RibbonDropdown
                        large
                        title="Maps"
                        trigger={<><MapsIcon /><span className="text-xs leading-tight text-center">Maps<br /><IconChevronDown className="w-3 h-3 inline text-slate-500" /></span></>}
                        contentClassName="w-64"
                    >
                        <MenuHeader>Filled Map</MenuHeader>
                        <MenuItem icon={IconInfoCircle} label="Filled Map" disabled />
                        <p className="px-2 pb-1.5 text-[11px] text-slate-500 leading-snug">
                            Map charts need Excel&apos;s online geography service, so they aren&apos;t available in this workbook.
                        </p>
                    </RibbonDropdown>
                    <RibbonSplit
                        large
                        title="PivotChart"
                        onClick={insertPivotChart}
                        face={<><PivotChartIcon /><span className="text-xs">PivotChart</span></>}
                        contentClassName="w-60"
                    >
                        <MenuItem icon={IconChartBar} label="PivotChart" onClick={insertPivotChart} />
                        <MenuItem
                            icon={IconTableShortcut}
                            label="PivotChart & PivotTable"
                            onClick={() => toast.info("Create the PivotTable from the spreadsheet's Insert > PivotTable first, then choose PivotChart here.")}
                        />
                    </RibbonSplit>
                </RibbonGroup>

                <RibbonGroup label="Sparklines">
                    {[
                        { key: "sparkLine", label: "Line", icon: <SparkLineIcon /> },
                        { key: "sparkColumn", label: "Column", icon: <SparkColumnIcon /> },
                        { key: "sparkWinLoss", label: "Win/\nLoss", icon: <SparkWinLossIcon /> },
                    ].map(({ key, label, icon }) => (
                        <RibbonBtn
                            key={key}
                            className="h-full flex-col justify-start px-1.5 pt-1 gap-0.5"
                            active={config?.type === key}
                            title={`${CHART_VARIANTS[key].label}: ${CHART_VARIANTS[key].desc}`}
                            onClick={() => applyVariant(key)}
                        >
                            {icon}
                            <span className="text-xs leading-tight text-center whitespace-pre-line">{label}</span>
                        </RibbonBtn>
                    ))}
                </RibbonGroup>
            </div>
            ) : (
            <div className="flex items-stretch border-b border-slate-200 bg-[#f8f8f8] overflow-x-auto themed-scrollbar">
                {!config ? (
                    <div className="h-[94px] flex items-center px-4 text-xs text-slate-400">Insert a chart first to change its design.</div>
                ) : (
                <>
                <RibbonGroup label="Chart Layouts">
                    <RibbonDropdown
                        large
                        title="Add Chart Element"
                        trigger={<><IconChartInfographic className="w-8 h-8 text-slate-700" strokeWidth={1.3} /><span className="text-xs leading-tight text-center">Add Chart<br />Element <IconChevronDown className="w-3 h-3 inline text-slate-500" /></span></>}
                        contentClassName="w-56 max-h-[70vh] overflow-y-auto"
                    >
                        <MenuHeader>Chart Title</MenuHeader>
                        <MenuItem label="None" checked={!config.title} onClick={() => applyConfig({ title: "" })} />
                        <MenuItem label="Above Chart..." checked={!!config.title} onClick={() => openDesignPopover(true)} />
                        <MenuHeader>Data Labels</MenuHeader>
                        <MenuItem label="None" checked={!config.showDataLabels} onClick={() => applyConfig({ showDataLabels: false })} />
                        <MenuItem label="Auto" checked={config.showDataLabels && (!config.labelPosition || config.labelPosition === "auto")} onClick={() => applyConfig({ showDataLabels: true, labelPosition: "auto" })} />
                        {getLabelPositionOptions(config.type).map((opt) => (
                            <MenuItem
                                key={opt.value}
                                label={opt.label}
                                checked={config.showDataLabels && config.labelPosition === opt.value}
                                onClick={() => applyConfig({ showDataLabels: true, labelPosition: opt.value })}
                            />
                        ))}
                        <MenuHeader>Gridlines</MenuHeader>
                        <MenuItem label="Primary Major Horizontal" checked={!!config.showGridlines} onClick={() => applyConfig({ showGridlines: !config.showGridlines })} />
                        <MenuHeader>Legend</MenuHeader>
                        {[["none", "None"], ["right", "Right"], ["top", "Top"], ["left", "Left"], ["bottom", "Bottom"]].map(([value, label]) => (
                            <MenuItem key={value} label={label} checked={(config.legendPosition || "bottom") === value} onClick={() => applyConfig({ legendPosition: value })} />
                        ))}
                    </RibbonDropdown>
                </RibbonGroup>

                <RibbonGroup label="Data">
                    <Popover open={popoverOpen} onOpenChange={openPopover}>
                        <PopoverTrigger asChild>
                            <RibbonBtn className="h-full flex-col justify-start px-2 pt-1 gap-0.5" title="Select Data: choose the range this chart plots">
                                <IconTableShortcut className="w-8 h-8 text-emerald-700" strokeWidth={1.3} />
                                <span className="text-xs leading-tight text-center">Select<br />Data</span>
                            </RibbonBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 bg-white border border-slate-200 shadow-md rounded-lg space-y-3" align="start">
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

                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ranges</Label>
                                        <input
                                            className="w-full h-8 text-xs border border-slate-200 rounded px-2"
                                            placeholder="e.g. A1:A10, C1:C10"
                                            value={draft.rangeString ?? formatRangeString(draft.ranges)}
                                            onChange={(e) => setDraft((d) => ({ ...d, rangeString: e.target.value, ranges: undefined }))}
                                        />
                                        <p className="text-[10px] text-slate-400 leading-snug">
                                            Optional. Comma-separated ranges for non-adjacent data; leave empty to pick columns and rows below.
                                        </p>
                                    </div>

                                    {draftUsesRanges && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Series In</Label>
                                            <select
                                                className="w-full h-8 text-xs border border-slate-200 rounded px-2 cursor-pointer"
                                                value={draft.plotBy || naturalPlotBy(parseRangeString(draft.rangeString) || draft.ranges || [])}
                                                onChange={(e) => setDraft((d) => ({ ...d, plotBy: e.target.value }))}
                                            >
                                                <option value="columns">Columns</option>
                                                <option value="rows">Rows</option>
                                            </select>
                                        </div>
                                    )}

                                    {!draftUsesRanges && (<>
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
                                    </>)}

                                    <div className="flex items-center gap-2">
                                        <Checkbox id="chartHasHeader" checked={draft.hasHeaderRow} onCheckedChange={(v) => setDraft((d) => ({ ...d, hasHeaderRow: !!v }))} />
                                        <label htmlFor="chartHasHeader" className="text-xs text-slate-700 cursor-pointer select-none">{draftUsesRanges && draft.plotBy === "rows" ? "First column has series names" : "First row has headers"}</label>
                                    </div>

                                    {!draftUsesRanges && (
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
                                    )}

                                    <div className="flex justify-end gap-1.5 pt-1">
                                        <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer" onClick={() => setPopoverOpen(false)}>Cancel</Button>
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                                            onClick={applyDraft}
                                            disabled={!draftUsesRanges && draft.valueCols.length === 0}
                                        >
                                            Apply
                                        </Button>
                                    </div>
                                </>
                            )}
                        </PopoverContent>
                    </Popover>
                    <RibbonBtn className="h-full flex-col justify-start px-2 pt-1 gap-0.5" title="Switch Row/Column: swap the series and the categories" onClick={switchRowColumn}>
                        <IconSwitchHorizontal className="w-8 h-8 text-emerald-700" strokeWidth={1.3} />
                        <span className="text-xs leading-tight text-center">Switch Row/<br />Column</span>
                    </RibbonBtn>
                </RibbonGroup>

                <RibbonGroup label="Type">
                    <RibbonBtn className="h-full flex-col justify-start px-2 pt-1 gap-0.5" title="Change Chart Type" onClick={() => openInsertDialog("all")}>
                        <IconChartBar className="w-8 h-8 text-blue-700" strokeWidth={1.3} />
                        <span className="text-xs leading-tight text-center">Change<br />Chart Type</span>
                    </RibbonBtn>
                </RibbonGroup>

                <RibbonGroup label="Format">
                    <Popover open={designPopoverOpen} onOpenChange={openDesignPopover}>
                        <PopoverTrigger asChild>
                            <RibbonBtn className="h-full flex-col justify-start px-2 pt-1 gap-0.5" title="Format Chart: title, legend, labels and colors">
                                <IconPalette className="w-8 h-8 text-amber-600" strokeWidth={1.3} />
                                <span className="text-xs leading-tight text-center">Format<br />Chart</span>
                            </RibbonBtn>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3 bg-white border border-slate-200 shadow-md rounded-lg space-y-3 max-h-[70vh] overflow-y-auto" align="start">
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
                                                            <span className="text-[11px] text-slate-600 w-12 shrink-0 truncate">{seriesIdLabel(c)}</span>
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
                </RibbonGroup>
                </>
                )}
            </div>
            )}
            </div>

            {!config ? (
                <div className="flex items-center justify-center h-40 text-sm text-slate-400 text-center px-6">
                    No charts yet. Pick a chart type from the Insert ribbon above, or click "+".
                </div>
            ) : (
            <>
            {/* In full screen the chart grows to fill the space under the toolbars */}
            <div className={cn("p-3", isFullScreen && "flex-1 min-h-0 !shrink flex flex-col")}>
                {config.title && (
                    <div className="text-center text-sm font-semibold text-slate-900 mb-1.5">{config.title}</div>
                )}
                {!activeSheet ? (
                    <div className="flex items-center justify-center h-64 text-sm text-slate-400">Loading sheet…</div>
                ) : data.length === 0 || seriesKeys.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-sm text-slate-400 text-center px-6">
                        No data in the selected range. Use Chart Design › Select Data to choose columns and rows to chart.
                    </div>
                ) : isFullScreen ? (
                    <div className="relative flex-1 min-h-[260px]">
                        <div className="absolute inset-0">{scrollableChart(config, prepared)}</div>
                    </div>
                ) : (
                    <div className="h-[320px]">{scrollableChart(config, prepared)}</div>
                )}
            </div>
            </>
            )}

            <InsertChartDialog
                state={insertDialog}
                onClose={() => setInsertDialog(null)}
                recommended={recommendedVariants}
                currentType={config?.type}
                comboSeries={comboSeries}
                renderPreview={(key, mini, comboSettings) => {
                    const base = config || buildDefaultChart(columnCount, rowCount);
                    const cfg = { ...base, ...variantPatch(key, base, comboSettings), title: "" };
                    return renderChartBody(cfg, prepareChartData(activeSheet, displayGrid, cfg), mini);
                }}
                onOk={(key, comboSettings) => { applyVariant(key, comboSettings); setInsertDialog(null); }}
            />
        </div>
        </FullScreenFrame>
    );
}

// Memoized so a parent re-render that doesn't change the sheet snapshot (a
// dialog opening, a query refetch) doesn't redo the chart work.
export default React.memo(ExcelGraph);
