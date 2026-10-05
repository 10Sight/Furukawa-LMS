import React from "react";

// Excel-gallery-style chart thumbnails and the Insert ribbon's chart icons.
// The variant catalog itself lives in chartTypes.js.
// --- Thumbnails (gallery tiles) ---

const B = "#2a78d6", O = "#eb6834", GR = "#a3a3a3", AX = "#94a3b8";
const Svg = ({ children, className = "w-8 h-8" }) => (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">{children}</svg>
);
const Axes = () => <path d="M4 3v25h25" stroke={AX} strokeWidth="1" />;
const Bars = ({ bars }) => bars.map(([x, y, w, h, c], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />);
const Dots = ({ pts, c, r = 1.8 }) => pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} />);

export function ChartThumb({ type, className }) {
    switch (type) {
        case "columnGrouped": return <Svg className={className}><Axes /><Bars bars={[[7, 14, 3, 14, B], [10, 18, 3, 10, O], [16, 8, 3, 20, B], [19, 13, 3, 15, O], [24, 16, 3, 12, B], [27, 11, 2.5, 17, O]]} /></Svg>;
        case "columnStacked": return <Svg className={className}><Axes /><Bars bars={[[7, 16, 5, 12, B], [7, 10, 5, 6, O], [15, 12, 5, 16, B], [15, 5, 5, 7, O], [23, 18, 5, 10, B], [23, 12, 5, 6, O]]} /></Svg>;
        case "columnPercent": return <Svg className={className}><Axes /><Bars bars={[[7, 14, 5, 14, B], [7, 4, 5, 10, O], [15, 10, 5, 18, B], [15, 4, 5, 6, O], [23, 18, 5, 10, B], [23, 4, 5, 14, O]]} /></Svg>;
        case "barGrouped": return <Svg className={className}><Axes /><Bars bars={[[4, 5, 16, 3, B], [4, 8, 11, 3, O], [4, 13, 22, 3, B], [4, 16, 15, 3, O], [4, 21, 12, 3, B], [4, 24, 18, 3, O]]} /></Svg>;
        case "barStacked": return <Svg className={className}><Axes /><Bars bars={[[4, 6, 11, 5, B], [15, 6, 7, 5, O], [4, 14, 15, 5, B], [19, 14, 8, 5, O], [4, 22, 8, 5, B], [12, 22, 6, 5, O]]} /></Svg>;
        case "barPercent": return <Svg className={className}><Axes /><Bars bars={[[4, 6, 14, 5, B], [18, 6, 10, 5, O], [4, 14, 18, 5, B], [22, 14, 6, 5, O], [4, 22, 9, 5, B], [13, 22, 15, 5, O]]} /></Svg>;
        case "line": return <Svg className={className}><Axes /><polyline points="5,22 11,15 17,18 23,9 29,12" stroke={B} strokeWidth="1.6" /><polyline points="5,26 11,22 17,24 23,19 29,21" stroke={O} strokeWidth="1.6" /></Svg>;
        case "lineStacked": return <Svg className={className}><Axes /><polyline points="5,24 11,20 17,22 23,17 29,19" stroke={B} strokeWidth="1.6" /><polyline points="5,15 11,9 17,13 23,6 29,8" stroke={O} strokeWidth="1.6" /></Svg>;
        case "linePercent": return <Svg className={className}><Axes /><polyline points="5,18 11,14 17,20 23,12 29,15" stroke={B} strokeWidth="1.6" /><polyline points="5,5 29,5" stroke={O} strokeWidth="1.6" /></Svg>;
        case "lineMarkers": return <Svg className={className}><Axes /><polyline points="5,22 11,15 17,18 23,9 29,12" stroke={B} strokeWidth="1.4" /><Dots pts={[[5, 22], [11, 15], [17, 18], [23, 9], [29, 12]]} c={B} /><polyline points="5,26 11,23 17,24 23,19 29,21" stroke={O} strokeWidth="1.4" /><Dots pts={[[5, 26], [11, 23], [17, 24], [23, 19], [29, 21]]} c={O} /></Svg>;
        case "area": return <Svg className={className}><Axes /><path d="M5 28V14l8-5 8 7 8-9v21z" fill={B} opacity=".85" /><path d="M5 28v-8l8 2 8-5 8 4v7z" fill={O} opacity=".9" /></Svg>;
        case "areaStacked": return <Svg className={className}><Axes /><path d="M5 28v-9l8-3 8 4 8-6v14z" fill={B} /><path d="M5 19l8-3 8 4 8-6V6l-8 5-8-4-8 5z" fill={O} /></Svg>;
        case "areaPercent": return <Svg className={className}><Axes /><path d="M5 28V16l8-4 8 6 8-5v15z" fill={B} /><path d="M5 16l8-4 8 6 8-5V4H5z" fill={O} /></Svg>;
        case "pie": return <Svg className={className}><circle cx="16" cy="16" r="12" fill={B} /><path d="M16 16V4a12 12 0 0 1 11.4 15.7z" fill={O} /><path d="M16 16l11.4 3.7A12 12 0 0 1 16 28z" fill={GR} /></Svg>;
        case "doughnut": return <Svg className={className}><circle cx="16" cy="16" r="9" stroke={B} strokeWidth="6" /><path d="M16 7a9 9 0 0 1 8.6 11.8" stroke={O} strokeWidth="6" /><path d="M24.6 18.8A9 9 0 0 1 16 25" stroke={GR} strokeWidth="6" /></Svg>;
        case "treemap": return <Svg className={className}><rect x="3" y="4" width="15" height="24" fill={B} /><rect x="19" y="4" width="10" height="13" fill={O} /><rect x="19" y="18" width="5" height="10" fill={GR} /><rect x="25" y="18" width="4" height="10" fill="#1baf7a" /></Svg>;
        case "sunburst": return <Svg className={className}><circle cx="16" cy="16" r="11" stroke={O} strokeWidth="5" strokeDasharray="20 4 30 4 11 0" /><circle cx="16" cy="16" r="5.5" stroke={B} strokeWidth="5" strokeDasharray="14 3 17.5 0" /></Svg>;
        case "histogram": return <Svg className={className}><Axes /><Bars bars={[[5, 20, 5, 8, B], [10, 12, 5, 16, B], [15, 6, 5, 22, B], [20, 14, 5, 14, B], [25, 22, 4, 6, B]]} /><path d="M5 20v8M10 12v16M15 6v22M20 14v14M25 22v6" stroke="#fff" strokeWidth=".6" /></Svg>;
        case "pareto": return <Svg className={className}><Axes /><Bars bars={[[5, 8, 5, 20, B], [11, 15, 5, 13, B], [17, 20, 5, 8, B], [23, 24, 5, 4, B]]} /><polyline points="7.5,17 13.5,9 19.5,6 25.5,5" stroke={O} strokeWidth="1.6" /></Svg>;
        case "boxWhisker": return <Svg className={className}><Axes /><path d="M10 5v5M10 20v5M7 5h6M7 25h6M22 9v5M22 22v4M19 9h6M19 26h6" stroke="#475569" strokeWidth="1" /><rect x="7" y="10" width="6" height="10" fill={B} /><path d="M7 15h6" stroke="#fff" /><rect x="19" y="14" width="6" height="8" fill={O} /><path d="M19 18h6" stroke="#fff" /></Svg>;
        case "scatter": return <Svg className={className}><Axes /><Dots pts={[[8, 22], [11, 18], [14, 20], [16, 13], [20, 15], [22, 9], [26, 11], [28, 6]]} c={B} r={1.9} /></Svg>;
        case "scatterSmooth": return <Svg className={className}><Axes /><path d="M6 24C11 22 12 12 17 13s7-7 11-8" stroke={B} strokeWidth="1.4" /><Dots pts={[[6, 24], [12, 17], [17, 13], [23, 9], [28, 5]]} c={B} /></Svg>;
        case "scatterStraight": return <Svg className={className}><Axes /><polyline points="6,24 12,15 17,17 23,8 28,6" stroke={B} strokeWidth="1.4" /><Dots pts={[[6, 24], [12, 15], [17, 17], [23, 8], [28, 6]]} c={B} /></Svg>;
        case "bubble": return <Svg className={className}><Axes /><circle cx="10" cy="20" r="4" fill={B} opacity=".8" /><circle cx="19" cy="12" r="6" fill={O} opacity=".8" /><circle cx="26" cy="21" r="3" fill={B} opacity=".8" /></Svg>;
        case "waterfall": return <Svg className={className}><Axes /><Bars bars={[[6, 16, 4, 12, B], [11, 10, 4, 6, B], [16, 10, 4, 7, O], [21, 7, 4, 10, B], [26, 7, 3, 21, GR]]} /></Svg>;
        case "funnel": return <Svg className={className}><Bars bars={[[4, 4, 24, 5, B], [7, 10, 18, 5, B], [10, 16, 12, 5, B], [13, 22, 6, 5, B]]} /></Svg>;
        case "stock": return <Svg className={className}><Axes /><path d="M9 8v14M8 17h3M16 5v12M15 10h3M23 10v15M22 20h3" stroke="#334155" strokeWidth="1.3" /></Svg>;
        case "radar": return <Svg className={className}><path d="M16 3l11 8-4 14H9L5 11z" stroke={AX} /><path d="M16 9l6 4-2 7h-8l-2-7z" stroke={AX} strokeWidth=".6" /><path d="M16 6l8 7-5 9h-7l-4-9z" stroke={B} strokeWidth="1.4" /></Svg>;
        case "radarFilled": return <Svg className={className}><path d="M16 3l11 8-4 14H9L5 11z" stroke={AX} /><path d="M16 6l8 7-5 9h-7l-4-9z" fill={B} opacity=".75" /></Svg>;
        case "comboColumnLine":
        case "combo": return <Svg className={className}><Axes /><Bars bars={[[7, 16, 4, 12, B], [14, 11, 4, 17, B], [21, 18, 4, 10, B]]} /><polyline points="6,12 13,7 20,12 27,6" stroke={O} strokeWidth="1.6" /></Svg>;
        case "comboColumnLineSecondary": return <Svg className={className}><path d="M4 3v25h24V3" stroke={AX} strokeWidth="1" /><Bars bars={[[7, 16, 4, 12, B], [13, 11, 4, 17, B], [19, 18, 4, 10, B]]} /><polyline points="6,8 12,13 18,6 25,10" stroke={O} strokeWidth="1.6" /></Svg>;
        case "comboAreaColumn": return <Svg className={className}><Axes /><path d="M5 28V16l8-6 8 5 8-7v20z" fill={B} opacity=".75" /><Bars bars={[[8, 19, 3.5, 9, O], [15, 14, 3.5, 14, O], [22, 20, 3.5, 8, O]]} /></Svg>;
        case "sparkLine": return <Svg className={className}><rect x="2.5" y="8.5" width="27" height="15" stroke={AX} /><polyline points="5,19 10,14 14,17 19,11 23,15 27,12" stroke={B} strokeWidth="1.5" /></Svg>;
        case "sparkColumn": return <Svg className={className}><rect x="2.5" y="8.5" width="27" height="15" stroke={AX} /><Bars bars={[[5, 16, 3, 6, B], [10, 12, 3, 10, B], [15, 14, 3, 8, B], [20, 11, 3, 11, B], [25, 17, 3, 5, B]]} /></Svg>;
        case "sparkWinLoss": return <Svg className={className}><rect x="2.5" y="8.5" width="27" height="15" stroke={AX} /><Bars bars={[[5, 11, 3, 5, B], [10, 16, 3, 5, O], [15, 11, 3, 5, B], [20, 11, 3, 5, B], [25, 16, 3, 5, O]]} /></Svg>;
        default: return <Svg className={className}><Axes /></Svg>;
    }
}

// --- Ribbon icons ---

const RIBBON_FAMILY_THUMB = {
    columnBar: "columnGrouped", lineArea: "lineMarkers", pie: "pie", hierarchy: "treemap",
    statistic: "histogram", scatter: "scatter", waterfall: "waterfall", combo: "combo",
};
export const RibbonFamilyIcon = ({ family }) => <ChartThumb type={RIBBON_FAMILY_THUMB[family]} className="w-[18px] h-[18px]" />;

export const RecommendedChartsIcon = () => (
    <svg viewBox="0 0 36 36" className="w-9 h-9" aria-hidden="true" fill="none">
        <rect x="4" y="14" width="5" height="18" fill="#a3a3a3" />
        <rect x="11" y="6" width="5" height="26" fill="#737373" />
        <rect x="18" y="18" width="5" height="14" fill="#a3a3a3" />
        <path d="M25 9.5a4.5 4.5 0 1 1 6.3 4.1c-1.2.6-1.8 1.4-1.8 2.7V18" stroke="#2a78d6" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="29.5" cy="22.5" r="1.5" fill="#2a78d6" />
    </svg>
);
export const MapsIcon = () => (
    <svg viewBox="0 0 36 36" className="w-9 h-9" aria-hidden="true" fill="none">
        <circle cx="18" cy="16" r="12" fill="#dbeafe" stroke="#475569" strokeWidth="1.4" />
        <path d="M9 11c3 0 4 2 7 1s2 4 0 5-1 4-3 5-4-3-5-5-2-4 1-6zM21 7c2 1 5 1 6 4s-2 3-3 5 1 5-1 6-3-2-3-5 1-4-1-6 0-4 2-4z" fill="#1baf7a" />
        <path d="M11 30h14M18 28v2" stroke="#475569" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);
export const PivotChartIcon = () => (
    <svg viewBox="0 0 36 36" className="w-9 h-9" aria-hidden="true" fill="none">
        <rect x="3.5" y="3.5" width="29" height="29" fill="#fff" stroke="#64748b" />
        <path d="M3.5 10h29M11 3.5v29" stroke="#64748b" />
        <rect x="4" y="4" width="6.5" height="5.5" fill="#cbd5e1" />
        <rect x="15" y="20" width="4" height="9" fill="#2a78d6" />
        <rect x="21" y="15" width="4" height="14" fill="#2a78d6" />
        <rect x="27" y="23" width="3.5" height="6" fill="#2a78d6" />
    </svg>
);
const SparkFrame = ({ children }) => (
    <svg viewBox="0 0 36 36" className="w-9 h-9" aria-hidden="true" fill="none">
        <rect x="3.5" y="7.5" width="29" height="21" fill="#fff" stroke="#64748b" />
        <path d="M3.5 12h29" stroke="#cbd5e1" />
        {children}
    </svg>
);
export const SparkLineIcon = () => <SparkFrame><polyline points="7,24 12,18 17,21 22,14 27,17 30,15" stroke="#2a78d6" strokeWidth="1.8" /></SparkFrame>;
export const SparkColumnIcon = () => <SparkFrame><rect x="7" y="19" width="4" height="7" fill="#2a78d6" /><rect x="13" y="15" width="4" height="11" fill="#2a78d6" /><rect x="19" y="18" width="4" height="8" fill="#2a78d6" /><rect x="25" y="14" width="4" height="12" fill="#2a78d6" /></SparkFrame>;
export const SparkWinLossIcon = () => <SparkFrame><rect x="7" y="14" width="4" height="5" fill="#2a78d6" /><rect x="13" y="20" width="4" height="5" fill="#eb6834" /><rect x="19" y="14" width="4" height="5" fill="#2a78d6" /><rect x="25" y="20" width="4" height="5" fill="#eb6834" /></SparkFrame>;
