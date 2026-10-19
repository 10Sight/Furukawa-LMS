import React from 'react';

// Company-wide standard: total-population bars amber, present-population bars blue
export const TOTAL_COLOR = '#f59e0b';
export const PRESENT_COLOR = '#2563eb';
export const ABSENT_COLOR = '#e11d48';
export const RATE_COLOR = '#059669';

export const SHIFT_OPTIONS = ["ALL", "A", "B", "C", "G"];
export const SHIFT_BAR_KEYS = ["A", "B", "C", "G", "OTHER"];

// One fixed colour per shift (validated with Total amber for colour-blind separation).
// A shift keeps its colour on every chart and date; A is the standard present blue.
export const PRESENT_SHIFT_COLORS = {
    A: '#2563eb',
    B: '#0d9488',
    C: '#7c3aed',
    G: '#db2777',
    OTHER: '#4d7c0f',
};

const toCountRow = (counts = {}) => ({
    totalUsers: counts.totalUsers || 0,
    presentUsers: counts.presentUsers || 0,
    absentUsers: counts.absentUsers || 0,
    attendancePercentage: counts.attendancePercentage || 0,
});

// Counts of a department / section / line node for the chart's shift filter, plus
// present_<shift> fields for the per-shift bars on ALL.
export const getShiftCounts = (node, shift) => {
    const base = toCountRow(shift === "ALL" ? node : node?.byShift?.[shift]);
    const perShift = Object.fromEntries(
        SHIFT_BAR_KEYS.map(key => [`present_${key}`, node?.byShift?.[key]?.presentUsers || 0])
    );
    return { ...base, ...perShift };
};

// Shifts that have anybody present somewhere in the chart; empty shifts get no bar.
export const getVisibleShiftKeys = (rows) =>
    SHIFT_BAR_KEYS.filter(key => rows.some(row => row[`present_${key}`] > 0));

export const getPresentShiftLabel = (t, key) => (key === "OTHER"
    ? t('assembly.presentOther')
    : t('assembly.presentShift').replace('{shift}', key));

// Present view toggle, offered only when a chart shows ALL shifts
export const PRESENT_VIEW_TOTAL = "total";
export const PRESENT_VIEW_SHIFT = "shift";

// True when the chart should split Present into one bar per shift
export const isShiftBreakup = (shift, presentView) => shift === "ALL" && presentView === PRESENT_VIEW_SHIFT;

// Bar series for a chart: Total, then one Present bar per visible shift on ALL with the
// shift breakup view, a single blue Present bar on ALL with the total view, or a single
// Present bar in that shift's colour for a picked shift.
export const getBarSeries = (t, shift, rows, presentView = PRESENT_VIEW_SHIFT) => {
    const totalSeries = { dataKey: 'totalUsers', label: t('assembly.totalUsers'), color: TOTAL_COLOR };
    if (shift === "ALL" && presentView === PRESENT_VIEW_TOTAL) {
        return [totalSeries, { dataKey: 'presentUsers', label: t('assembly.presentUsers'), color: PRESENT_COLOR }];
    }
    if (shift !== "ALL") {
        return [totalSeries, {
            dataKey: 'presentUsers',
            label: getPresentShiftLabel(t, shift),
            color: PRESENT_SHIFT_COLORS[shift] || PRESENT_COLOR,
        }];
    }
    return [totalSeries, ...getVisibleShiftKeys(rows).map(key => ({
        dataKey: `present_${key}`,
        label: getPresentShiftLabel(t, key),
        color: PRESENT_SHIFT_COLORS[key],
        hideZeroLabel: true,
    }))];
};

// Sections with more lines than this get a full-width card
export const WIDE_SECTION_LINE_COUNT = 6;

export const AXIS_TICK = { fill: '#475569', fontSize: 12, fontWeight: 600 };
export const GRID_STROKE = '#e8edf5';

export const formatCount = (value) => Number(value || 0).toLocaleString('en-IN');
export const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

// Dashboard days follow India time, same as the server.
export const getIstDateString = (offsetDays = 0) => {
    const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [y, m, d] = todayIst.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
};

// Splits a name into at most maxLines horizontal rows, breaking on spaces when it can.
export const wrapLabel = (name, charsPerLine, maxLines) => {
    const words = String(name || '').split(/\s+/).filter(Boolean);
    const rows = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= charsPerLine || !current) {
            current = next;
        } else {
            rows.push(current);
            current = word;
        }
    }
    if (current) rows.push(current);
    if (rows.length > maxLines) {
        const kept = rows.slice(0, maxLines);
        kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, charsPerLine - 1)}…`;
        return kept;
    }
    return rows.map(row => (row.length > charsPerLine + 4 ? `${row.slice(0, charsPerLine + 3)}…` : row));
};

// Value label above a bar. Text stays in ink colour; the bar carries the series identity.
// Per-shift bars skip "0" so a row of empty shifts doesn't fill the chart with zeros.
export const renderBarValueLabel = (hideZero = false) => ({ x, y, width, value }) => {
    if (value == null || (hideZero && !value)) return null;
    return (
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#1e293b" fontSize={11} fontWeight={700}>
            {formatCount(value)}
        </text>
    );
};
