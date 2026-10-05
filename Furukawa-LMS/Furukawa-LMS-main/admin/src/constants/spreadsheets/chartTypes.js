// Chart-type catalog shared by the Insert ribbon, the Insert Chart dialog and
// the renderers: every variant Excel offers here, grouped the way Excel groups them.
//
// A variant key usually *is* the stored chart `type`; the combo presets are the
// exception — they all store type "combo" plus a `preset` that seeds per-series
// comboSettings (see comboSettingsForPreset).

export const CHART_VARIANTS = {
    columnGrouped: { label: "Clustered Column", desc: "Compare values across a few categories." },
    columnStacked: { label: "Stacked Column", desc: "Show how parts contribute to a whole, and compare totals across categories." },
    columnPercent: { label: "100% Stacked Column", desc: "Compare the percentage each value contributes to a total across categories." },
    barGrouped: { label: "Clustered Bar", desc: "Compare values across categories — best when category labels are long." },
    barStacked: { label: "Stacked Bar", desc: "Compare parts of a whole across categories, horizontally." },
    barPercent: { label: "100% Stacked Bar", desc: "Compare the percentage each value contributes to a total, horizontally." },
    line: { label: "Line", desc: "Show trends over time (years, months, days) or ordered categories." },
    lineStacked: { label: "Stacked Line", desc: "Show how the contribution of each value changes over time." },
    linePercent: { label: "100% Stacked Line", desc: "Show the trend of the percentage each value contributes over time." },
    lineMarkers: { label: "Line with Markers", desc: "Show trends over time with each data point marked." },
    area: { label: "Area", desc: "Show trends over time and emphasise the magnitude of change." },
    areaStacked: { label: "Stacked Area", desc: "Show how each value's contribution to the total changes over time." },
    areaPercent: { label: "100% Stacked Area", desc: "Show how the percentage each value contributes changes over time." },
    pie: { label: "Pie", desc: "Show proportions of a whole. Uses the first series only." },
    doughnut: { label: "Doughnut", desc: "Show proportions of a whole, with a hole in the middle." },
    treemap: { label: "Treemap", desc: "Compare proportions as nested rectangles. Uses the first series." },
    sunburst: { label: "Sunburst", desc: "Show a hierarchy as rings — inner ring per series, outer ring per category." },
    histogram: { label: "Histogram", desc: "Show the distribution of the first series' values across bins." },
    pareto: { label: "Pareto", desc: "Sorted columns plus a cumulative-percentage line, to find the vital few." },
    boxWhisker: { label: "Box and Whisker", desc: "Show each series' spread: quartiles, median, mean and range." },
    scatter: { label: "Scatter", desc: "Compare pairs of values. The X-axis column must hold numbers." },
    scatterSmooth: { label: "Scatter with Smooth Lines and Markers", desc: "Scatter points joined by a smooth curve." },
    scatterStraight: { label: "Scatter with Straight Lines and Markers", desc: "Scatter points joined by straight lines." },
    bubble: { label: "Bubble", desc: "Scatter where the second series sets each bubble's size." },
    waterfall: { label: "Waterfall", desc: "Show a running total as the first series' values are added or subtracted." },
    funnel: { label: "Funnel", desc: "Show values across the stages of a process." },
    stock: { label: "High-Low-Close", desc: "Stock prices — needs three series in order: High, Low, Close." },
    radar: { label: "Radar", desc: "Compare several series across the categories, from a centre point." },
    radarFilled: { label: "Filled Radar", desc: "Radar with each series' area filled." },
    comboColumnLine: { label: "Clustered Column - Line", type: "combo", preset: "columnLine", desc: "First series as columns, the rest as lines." },
    comboColumnLineSecondary: { label: "Clustered Column - Line on Secondary Axis", type: "combo", preset: "columnLineSecondary", desc: "Columns, with the other series as lines on a secondary axis." },
    comboAreaColumn: { label: "Stacked Area - Clustered Column", type: "combo", preset: "areaColumn", desc: "First series as an area, the rest as columns." },
    combo: { label: "Custom Combination", type: "combo", desc: "Choose a chart type and axis for each series." },
    sparkLine: { label: "Line Sparklines", desc: "A tiny line chart for each row of data." },
    sparkColumn: { label: "Column Sparklines", desc: "A tiny column chart for each row of data." },
    sparkWinLoss: { label: "Win/Loss Sparklines", desc: "Shows only whether each value is positive or negative." },
};
export const variantType = (key) => CHART_VARIANTS[key]?.type || key;

export const comboSettingsForPreset = (preset, valueCols) => Object.fromEntries(valueCols.map((col, i) => {
    if (preset === "columnLine") return [col, { type: i === 0 ? "column" : "line", yAxisId: "left" }];
    if (preset === "columnLineSecondary") return [col, { type: i === 0 ? "column" : "line", yAxisId: i === 0 ? "left" : "right" }];
    if (preset === "areaColumn") return [col, { type: i === 0 ? "area" : "column", yAxisId: "left" }];
    return [col, { type: i % 2 === 0 ? "column" : "line", yAxisId: "left" }];
}));

// Insert > Charts dropdowns (the 3x3 grid), in Excel's order.
export const RIBBON_CHART_MENUS = [
    {
        key: "columnBar", title: "Insert Column or Bar Chart", family: "column", more: "More Column Charts...",
        sections: [{ title: "2-D Column", keys: ["columnGrouped", "columnStacked", "columnPercent"] }, { title: "2-D Bar", keys: ["barGrouped", "barStacked", "barPercent"] }],
    },
    {
        key: "hierarchy", title: "Insert Hierarchy Chart", family: "treemap", more: "More Hierarchy Charts...",
        sections: [{ title: "Treemap", keys: ["treemap"] }, { title: "Sunburst", keys: ["sunburst"] }],
    },
    {
        key: "waterfall", title: "Insert Waterfall, Funnel, Stock, or Radar Chart", family: "stock", more: "More Stock Charts...",
        sections: [{ title: "Waterfall", keys: ["waterfall"] }, { title: "Funnel", keys: ["funnel"] }, { title: "Stock", keys: ["stock"] }, { title: "Radar", keys: ["radar", "radarFilled"] }],
    },
    {
        key: "lineArea", title: "Insert Line or Area Chart", family: "line", more: "More Line Charts...",
        sections: [{ title: "2-D Line", keys: ["line", "lineStacked", "linePercent", "lineMarkers"] }, { title: "2-D Area", keys: ["area", "areaStacked", "areaPercent"] }],
    },
    {
        key: "statistic", title: "Insert Statistic Chart", family: "histogram", more: "More Statistical Charts...",
        sections: [{ title: "Histogram", keys: ["histogram", "pareto"] }, { title: "Box and Whisker", keys: ["boxWhisker"] }],
    },
    {
        key: "combo", title: "Insert Combo Chart", family: "combo", more: "Create Custom Combo Chart...",
        sections: [{ title: "Combo", keys: ["comboColumnLine", "comboColumnLineSecondary", "comboAreaColumn"] }],
    },
    {
        key: "pie", title: "Insert Pie or Doughnut Chart", family: "pie", more: "More Pie Charts...",
        sections: [{ title: "2-D Pie", keys: ["pie"] }, { title: "Doughnut", keys: ["doughnut"] }],
    },
    {
        key: "scatter", title: "Insert Scatter (X, Y) or Bubble Chart", family: "scatter", more: "More Scatter Charts...",
        sections: [{ title: "Scatter", keys: ["scatter", "scatterSmooth", "scatterStraight"] }, { title: "Bubble", keys: ["bubble"] }],
    },
];

// Insert Chart dialog > All Charts, left-hand list.
export const CHART_FAMILIES = [
    { key: "column", label: "Column", keys: ["columnGrouped", "columnStacked", "columnPercent"] },
    { key: "line", label: "Line", keys: ["line", "lineStacked", "linePercent", "lineMarkers"] },
    { key: "pie", label: "Pie", keys: ["pie", "doughnut"] },
    { key: "bar", label: "Bar", keys: ["barGrouped", "barStacked", "barPercent"] },
    { key: "area", label: "Area", keys: ["area", "areaStacked", "areaPercent"] },
    { key: "scatter", label: "X Y (Scatter)", keys: ["scatter", "scatterSmooth", "scatterStraight", "bubble"] },
    { key: "stock", label: "Stock", keys: ["stock"] },
    { key: "radar", label: "Radar", keys: ["radar", "radarFilled"] },
    { key: "treemap", label: "Treemap", keys: ["treemap"] },
    { key: "sunburst", label: "Sunburst", keys: ["sunburst"] },
    { key: "histogram", label: "Histogram", keys: ["histogram", "pareto"] },
    { key: "box", label: "Box & Whisker", keys: ["boxWhisker"] },
    { key: "waterfall", label: "Waterfall", keys: ["waterfall"] },
    { key: "funnel", label: "Funnel", keys: ["funnel"] },
    { key: "combo", label: "Combo", keys: ["comboColumnLine", "comboColumnLineSecondary", "comboAreaColumn", "combo"] },
];
export const familyOfVariant = (key) => CHART_FAMILIES.find((f) => f.keys.includes(key))?.key || "column";

// Types drawn by chartExtras (anything beyond column/bar/line/area/pie/combo).
export const EXTRA_CHART_TYPES = new Set([
    "treemap", "sunburst", "histogram", "pareto", "boxWhisker", "scatter", "scatterSmooth", "scatterStraight",
    "bubble", "waterfall", "funnel", "stock", "radar", "radarFilled",
]);
export const SPARKLINE_TYPES = new Set(["sparkLine", "sparkColumn", "sparkWinLoss"]);

// A reason the current data can't draw this chart type, or null when it can.
export const chartRequirement = (type, seriesKeys, data) => {
    if (type === "stock" && seriesKeys.length < 3) return "A High-Low-Close stock chart needs three value series, in order: High, Low, Close.";
    if (type === "bubble" && seriesKeys.length < 1) return "A bubble chart needs at least one value series.";
    if ((type === "treemap" || type === "sunburst") && !data.some((row) => seriesKeys.some((k) => row[k] > 0))) {
        return "Treemap and sunburst charts need positive values.";
    }
    return null;
};
