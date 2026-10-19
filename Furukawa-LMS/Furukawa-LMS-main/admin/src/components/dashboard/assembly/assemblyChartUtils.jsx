import React from 'react';

// Company-wide standard: total-population bars amber, present-population bars blue
export const TOTAL_COLOR = '#f59e0b';
export const PRESENT_COLOR = '#2563eb';
export const ABSENT_COLOR = '#e11d48';
export const RATE_COLOR = '#059669';

export const SHIFT_OPTIONS = ["ALL", "A", "B", "C", "G"];

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
export const renderBarValueLabel = () => ({ x, y, width, value }) => {
    if (value == null) return null;
    return (
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#1e293b" fontSize={12} fontWeight={700}>
            {formatCount(value)}
        </text>
    );
};
