import React from "react";
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, ScatterChart, Scatter, ZAxis,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Treemap, SunburstChart,
    Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ReferenceLine,
} from "recharts";

// Renderers for the Excel chart types beyond the basic column/bar/line/area/pie
// family: hierarchy (treemap, sunburst), statistical (histogram, pareto, box &
// whisker), scatter/bubble, waterfall, funnel, stock, radar and sparklines.
// Each takes the same prepared { data, seriesKeys } rows the basic charts use
// (one row per category, one numeric key per value series).

const GRID = "#e1e0d9";
const INK = "#52514e";
const SURFACE = "#fcfcfb";
const UP = "#2a78d6", DOWN = "#eb6834";

const firstNumbers = (data, key) => data.map((row) => row[key]).filter((v) => typeof v === "number" && Number.isFinite(v));
const quantile = (sorted, p) => {
    const pos = (sorted.length - 1) * p;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};
const fmt = (v) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v);

// One tooltip for the extra charts: a heading plus whatever label/value rows the payload row carries in `tip`.
function RowsTooltip({ active, payload }) {
    const row = active && payload?.[0]?.payload;
    if (!row) return null;
    const rows = row.tip || [[payload[0].name, payload[0].value]];
    return (
        <div className="rounded-lg border border-slate-200 bg-white shadow-md px-2.5 py-2 text-xs min-w-[130px]">
            {row.name !== undefined && <div className="text-[10px] font-semibold text-slate-500 mb-1">{row.name}</div>}
            {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-900">{fmt(value)}</span>
                </div>
            ))}
        </div>
    );
}

function TreemapCell({ x, y, width, height, index, name, value, depth, colors }) {
    if (depth !== 1) return <g />;
    const fill = colors[index % colors.length];
    return (
        <g>
            <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
            {width > 44 && height > 26 && (
                <>
                    <text x={x + 6} y={y + 15} fill="#fff" fontSize={11} fontWeight={600}>{name}</text>
                    <text x={x + 6} y={y + 29} fill="#fff" fontSize={10} opacity={0.9}>{fmt(value)}</text>
                </>
            )}
        </g>
    );
}

// Box & whisker: the bar spans [min, max]; the shape draws whiskers, the Q1-Q3
// box, the median line and an "x" at the mean, scaled within that span.
function BoxShape({ x, y, width, height, payload, fill }) {
    const { min, q1, median, q3, max, mean } = payload;
    const span = max - min;
    const yOf = (v) => (span > 0 ? y + ((max - v) / span) * height : y);
    const cx = x + width / 2, bw = Math.min(width, 44), bx = cx - bw / 2;
    return (
        <g stroke="#475569" strokeWidth={1}>
            <line x1={cx} x2={cx} y1={yOf(max)} y2={yOf(q3)} />
            <line x1={cx} x2={cx} y1={yOf(q1)} y2={yOf(min)} />
            <line x1={cx - bw / 4} x2={cx + bw / 4} y1={yOf(max)} y2={yOf(max)} />
            <line x1={cx - bw / 4} x2={cx + bw / 4} y1={yOf(min)} y2={yOf(min)} />
            <rect x={bx} y={yOf(q3)} width={bw} height={Math.max(1, yOf(q1) - yOf(q3))} fill={fill} stroke="none" />
            <line x1={bx} x2={bx + bw} y1={yOf(median)} y2={yOf(median)} stroke="#fff" strokeWidth={1.5} />
            <path d={`M${cx - 3} ${yOf(mean) - 3}l6 6m0 -6l-6 6`} stroke="#fff" strokeWidth={1.4} />
        </g>
    );
}

// High-Low-Close: a vertical high-low line with a close tick to the right.
function StockShape({ x, y, width, height, payload }) {
    const { low, high, close } = payload;
    const span = high - low;
    const cx = x + width / 2;
    const yClose = span > 0 ? y + ((high - close) / span) * height : y;
    return (
        <g stroke="#334155" strokeWidth={1.6}>
            <line x1={cx} x2={cx} y1={y} y2={y + height} />
            <line x1={cx} x2={cx + Math.min(8, width / 2)} y1={yClose} y2={yClose} />
        </g>
    );
}

// Returns a recharts element (not a component) so it can sit directly inside ResponsiveContainer.
// eslint-disable-next-line react-refresh/only-export-components
export function renderExtraChart({ cfg, data, seriesKeys, colorFor, axisProps, legend, mini }) {
    const margin = mini ? { top: 4, right: 4, left: 4, bottom: 4 } : { top: 8, right: 16, left: -8, bottom: 0 };
    const grid = !mini && cfg.showGridlines;
    const labels = !mini && cfg.showDataLabels;
    const cycle = (i) => colorFor(i);
    const key0 = seriesKeys[0];
    const tooltip = mini ? null : <Tooltip content={<RowsTooltip />} />;

    switch (cfg.type) {
        case "treemap": {
            const items = data.filter((row) => row[key0] > 0).map((row) => ({ name: row.name, size: row[key0] }));
            const colors = items.map((_, i) => cycle(i));
            return (
                <Treemap data={items} dataKey="size" nameKey="name" isAnimationActive={false} content={<TreemapCell colors={colors} />}>
                    {tooltip}
                </Treemap>
            );
        }
        case "sunburst": {
            // Inner ring: one node per series; outer ring: that series' categories.
            const children = seriesKeys.map((key, si) => {
                // recharts keys sectors by name + index, so a category repeated under
                // several series needs a series-qualified name to stay unique.
                const leaves = data.filter((row) => row[key] > 0).map((row) => ({ name: seriesKeys.length > 1 ? `${row.name} (${key})` : row.name, value: row[key] }));
                return { name: key, fill: colorFor(si), value: leaves.reduce((s, l) => s + l.value, 0), children: leaves };
            }).filter((n) => n.value > 0);
            const root = { name: "Total", value: children.reduce((s, n) => s + n.value, 0), children };
            return (
                <SunburstChart data={root} dataKey="value" nameKey="name" stroke="#fff" innerRadius={mini ? 4 : 30}>
                    {tooltip}
                </SunburstChart>
            );
        }
        case "histogram": {
            const values = firstNumbers(data, key0).sort((a, b) => a - b);
            const n = values.length;
            const binCount = Math.max(1, Math.min(20, Math.ceil(Math.sqrt(n))));
            const lo = values[0] ?? 0, hi = values[n - 1] ?? 0;
            const width = hi > lo ? (hi - lo) / binCount : 1;
            const bins = Array.from({ length: hi > lo ? binCount : 1 }, (_, i) => {
                const a = lo + i * width, b = hi > lo ? a + width : lo;
                return { name: hi > lo ? `[${fmt(a)}, ${fmt(b)}${i === binCount - 1 ? "]" : ")"}` : String(fmt(lo)), count: 0 };
            });
            for (const v of values) {
                const i = hi > lo ? Math.min(binCount - 1, Math.floor((v - lo) / width)) : 0;
                bins[i].count += 1;
            }
            bins.forEach((b) => { b.tip = [["Count", b.count]]; });
            return (
                <BarChart data={bins} margin={margin} barCategoryGap={1}>
                    {grid && <CartesianGrid stroke={GRID} vertical={false} />}
                    <XAxis dataKey="name" {...axisProps} hide={mini} />
                    <YAxis {...axisProps} width={40} allowDecimals={false} hide={mini} />
                    {tooltip}
                    <Bar dataKey="count" fill={colorFor(0)} isAnimationActive={!mini}>
                        {labels && <LabelList dataKey="count" position="top" fill={INK} fontSize={10} />}
                    </Bar>
                </BarChart>
            );
        }
        case "pareto": {
            const sorted = data.map((row) => ({ name: row.name, value: row[key0] || 0 })).sort((a, b) => b.value - a.value);
            const total = sorted.reduce((s, r) => s + Math.max(0, r.value), 0) || 1;
            let run = 0;
            const rows = sorted.map((r) => {
                run += Math.max(0, r.value);
                const cumulative = (run / total) * 100;
                return { ...r, cumulative, tip: [[key0, r.value], ["Cumulative %", `${cumulative.toFixed(1)}%`]] };
            });
            return (
                <ComposedChart data={rows} margin={margin}>
                    {grid && <CartesianGrid stroke={GRID} vertical={false} />}
                    <XAxis dataKey="name" {...axisProps} hide={mini} />
                    <YAxis yAxisId="left" {...axisProps} width={40} hide={mini} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} width={40} hide={mini} />
                    {tooltip}
                    <Bar yAxisId="left" dataKey="value" fill={colorFor(0)} maxBarSize={40} isAnimationActive={!mini}>
                        {labels && <LabelList dataKey="value" position="top" fill={INK} fontSize={10} />}
                    </Bar>
                    <Line yAxisId="right" type="linear" dataKey="cumulative" stroke={colorFor(1)} strokeWidth={2} dot={mini ? false : { r: 3 }} isAnimationActive={!mini} />
                </ComposedChart>
            );
        }
        case "boxWhisker": {
            const boxes = seriesKeys.map((key, i) => {
                const vals = firstNumbers(data, key).sort((a, b) => a - b);
                if (!vals.length) return null;
                const stats = {
                    min: vals[0], q1: quantile(vals, 0.25), median: quantile(vals, 0.5), q3: quantile(vals, 0.75),
                    max: vals[vals.length - 1], mean: vals.reduce((s, v) => s + v, 0) / vals.length,
                };
                return {
                    name: key, fill: colorFor(i), range: [stats.min, stats.max], ...stats,
                    tip: [["Max", stats.max], ["Q3", stats.q3], ["Median", stats.median], ["Mean", stats.mean], ["Q1", stats.q1], ["Min", stats.min]],
                };
            }).filter(Boolean);
            return (
                <BarChart data={boxes} margin={margin}>
                    {grid && <CartesianGrid stroke={GRID} vertical={false} />}
                    <XAxis dataKey="name" {...axisProps} hide={mini} />
                    <YAxis {...axisProps} width={40} domain={["auto", "auto"]} hide={mini} />
                    {tooltip}
                    <Bar dataKey="range" shape={<BoxShape />} isAnimationActive={false}>
                        {boxes.map((b, i) => <Cell key={i} fill={b.fill} />)}
                    </Bar>
                </BarChart>
            );
        }
        case "scatter":
        case "scatterSmooth":
        case "scatterStraight":
        case "bubble": {
            // X comes from the category column when it's numeric; otherwise 1..n like Excel.
            const xs = data.map((row) => parseFloat(String(row.name).replace(/[$,%\s]/g, "")));
            const numericX = xs.every((v) => Number.isFinite(v));
            const xOf = (i) => (numericX ? xs[i] : i + 1);
            const bubble = cfg.type === "bubble";
            const series = bubble ? [key0] : seriesKeys;
            const sizeKey = bubble ? (seriesKeys[1] || key0) : null;
            const lineJoint = cfg.type === "scatterSmooth" ? "monotoneX" : "linear";
            return (
                <ScatterChart margin={margin}>
                    {grid && <CartesianGrid stroke={GRID} />}
                    <XAxis type="number" dataKey="x" name="X" domain={["auto", "auto"]} {...axisProps} hide={mini} />
                    <YAxis type="number" dataKey="y" name="Y" domain={["auto", "auto"]} {...axisProps} width={40} hide={mini} />
                    {bubble && <ZAxis type="number" dataKey="z" range={mini ? [20, 200] : [60, 1400]} />}
                    {tooltip}
                    {!bubble && legend}
                    {series.map((key, si) => (
                        <Scatter
                            key={key}
                            name={key}
                            data={data.map((row, i) => ({
                                name: row.name, x: xOf(i), y: row[key], z: bubble ? Math.abs(row[sizeKey] || 0) : undefined,
                                tip: bubble ? [["X", xOf(i)], [key, row[key]], [`Size (${sizeKey})`, row[sizeKey]]] : [["X", xOf(i)], [key, row[key]]],
                            }))}
                            fill={colorFor(si)}
                            fillOpacity={bubble ? 0.7 : 1}
                            line={cfg.type === "scatterSmooth" || cfg.type === "scatterStraight" ? { stroke: colorFor(si), strokeWidth: 2 } : false}
                            lineJointType={lineJoint}
                            isAnimationActive={!mini}
                        >
                            {labels && <LabelList dataKey="y" position="top" fill={INK} fontSize={10} />}
                        </Scatter>
                    ))}
                </ScatterChart>
            );
        }
        case "waterfall": {
            let running = 0;
            const rows = data.map((row) => {
                const v = row[key0] || 0;
                const start = running;
                running += v;
                return { name: row.name, value: v, range: [Math.min(start, running), Math.max(start, running)], fill: v >= 0 ? UP : DOWN, tip: [[v >= 0 ? "Increase" : "Decrease", v], ["Running total", running]] };
            });
            return (
                <BarChart data={rows} margin={margin}>
                    {grid && <CartesianGrid stroke={GRID} vertical={false} />}
                    <XAxis dataKey="name" {...axisProps} hide={mini} />
                    <YAxis {...axisProps} width={40} hide={mini} />
                    {tooltip}
                    <ReferenceLine y={0} stroke="#c3c2b7" />
                    <Bar dataKey="range" maxBarSize={40} isAnimationActive={!mini}>
                        {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
                        {labels && <LabelList dataKey="value" position="top" fill={INK} fontSize={10} />}
                    </Bar>
                </BarChart>
            );
        }
        case "funnel": {
            // Excel's funnel: centred horizontal bars, one per stage, in sheet order.
            const max = Math.max(1, ...data.map((row) => Math.abs(row[key0] || 0)));
            const rows = data.map((row) => {
                const v = Math.abs(row[key0] || 0);
                return { name: row.name, value: row[key0] || 0, range: [(max - v) / 2, (max + v) / 2], tip: [[key0, row[key0] || 0]] };
            });
            return (
                <BarChart data={rows} layout="vertical" margin={margin} barCategoryGap={mini ? 1 : 4}>
                    <XAxis type="number" domain={[0, max]} hide />
                    <YAxis type="category" dataKey="name" {...axisProps} width={mini ? 0 : 80} hide={mini} />
                    {tooltip}
                    <Bar dataKey="range" fill={colorFor(0)} isAnimationActive={!mini}>
                        {!mini && <LabelList dataKey="value" position="center" fill="#fff" fontSize={11} fontWeight={600} />}
                    </Bar>
                </BarChart>
            );
        }
        case "stock": {
            const [hKey, lKey, cKey] = seriesKeys;
            const rows = data.map((row) => {
                const high = Math.max(row[hKey] ?? 0, row[lKey] ?? 0), low = Math.min(row[hKey] ?? 0, row[lKey] ?? 0);
                return { name: row.name, high, low, close: row[cKey] ?? low, range: [low, high], tip: [["High", high], ["Low", low], ["Close", row[cKey]]] };
            });
            return (
                <BarChart data={rows} margin={margin}>
                    {grid && <CartesianGrid stroke={GRID} vertical={false} />}
                    <XAxis dataKey="name" {...axisProps} hide={mini} />
                    <YAxis {...axisProps} width={40} domain={["auto", "auto"]} hide={mini} />
                    {tooltip}
                    <Bar dataKey="range" shape={<StockShape />} isAnimationActive={false} />
                </BarChart>
            );
        }
        case "radar":
        case "radarFilled":
            return (
                <RadarChart data={data} margin={margin} outerRadius={mini ? "85%" : "75%"}>
                    <PolarGrid stroke={GRID} />
                    <PolarAngleAxis dataKey="name" tick={mini ? false : { fill: "#898781", fontSize: 11 }} />
                    {!mini && <PolarRadiusAxis tick={{ fill: "#898781", fontSize: 10 }} axisLine={false} />}
                    {!mini && <Tooltip />}
                    {legend}
                    {seriesKeys.map((key, i) => (
                        <Radar
                            key={key}
                            name={key}
                            dataKey={key}
                            stroke={colorFor(i)}
                            strokeWidth={2}
                            fill={colorFor(i)}
                            fillOpacity={cfg.type === "radarFilled" ? 0.35 : 0}
                            dot={cfg.type === "radar" && !mini ? { r: 3, fill: colorFor(i) } : false}
                            isAnimationActive={!mini}
                        />
                    ))}
                </RadarChart>
            );
        default:
            return null;
    }
}

// Sparklines: one tiny chart per category row across the value columns (like
// Excel's sparklines beside a table). With a single value column there is only
// one point per row, so a single sparkline runs down the rows instead.
export function Sparklines({ type, data, seriesKeys, colorFor, mini }) {
    const lines = seriesKeys.length > 1
        ? data.map((row) => ({ name: row.name, points: seriesKeys.map((k) => ({ name: k, v: row[k] ?? 0 })) }))
        : [{ name: seriesKeys[0], points: data.map((row) => ({ name: row.name, v: row[seriesKeys[0]] ?? 0 })) }];
    const shown = mini ? lines.slice(0, 4) : lines;
    const color = colorFor(0);
    const renderSpark = (points) => {
        if (type === "sparkLine") {
            const extremes = points.reduce((acc, p, i) => ({ hi: p.v > points[acc.hi].v ? i : acc.hi, lo: p.v < points[acc.lo].v ? i : acc.lo }), { hi: 0, lo: 0 });
            return (
                <LineChart data={points} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Line
                        type="linear" dataKey="v" stroke={color} strokeWidth={1.5} isAnimationActive={false}
                        dot={(props) => (props.index === extremes.hi || props.index === extremes.lo
                            ? <circle key={props.index} cx={props.cx} cy={props.cy} r={2} fill={props.index === extremes.hi ? UP : DOWN} />
                            : <g key={props.index} />)}
                    />
                </LineChart>
            );
        }
        const winLoss = type === "sparkWinLoss";
        const rows = winLoss ? points.map((p) => ({ ...p, v: p.v > 0 ? 1 : p.v < 0 ? -1 : 0 })) : points;
        return (
            <BarChart data={rows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }} barCategoryGap={1}>
                <YAxis hide domain={winLoss ? [-1, 1] : [(min) => Math.min(0, min), "dataMax"]} />
                {winLoss && <ReferenceLine y={0} stroke="#c3c2b7" />}
                <Bar dataKey="v" isAnimationActive={false}>
                    {rows.map((p, i) => <Cell key={i} fill={p.v < 0 ? DOWN : color} />)}
                </Bar>
            </BarChart>
        );
    };
    return (
        <div className={mini ? "space-y-1 w-full" : "w-full max-h-full overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-md"}>
            {shown.map((line, i) => (
                <div key={`${line.name}-${i}`} className={mini ? "h-5" : "flex items-center gap-3 px-3 py-1"}>
                    {!mini && <span className="w-40 shrink-0 truncate text-xs text-slate-600" title={line.name}>{line.name}</span>}
                    <div className={mini ? "h-5" : "flex-1 h-8 min-w-0"} style={{ backgroundColor: SURFACE }}>
                        <ResponsiveContainer width="100%" height="100%">{renderSpark(line.points)}</ResponsiveContainer>
                    </div>
                </div>
            ))}
        </div>
    );
}
