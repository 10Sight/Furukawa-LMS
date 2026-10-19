import React from 'react';

// Company-wide standard: total-population bars amber, present-population bars blue
export const TOTAL_COLOR = '#f59e0b';
export const PRESENT_COLOR = '#2563eb';
export const ABSENT_COLOR = '#e11d48';
export const RATE_COLOR = '#059669';

// Sections with more lines than this get a full-width card
export const WIDE_SECTION_LINE_COUNT = 6;

export const AXIS_TICK = { fill: '#475569', fontSize: 12, fontWeight: 600 };
export const GRID_STROKE = '#e8edf5';

export const formatCount = (value) => Number(value || 0).toLocaleString('en-IN');
export const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

// Value label above a vertical bar, or right of a horizontal one. Text stays in ink
// colour; the bar beside it carries the series identity.
export const renderBarValueLabel = (horizontal = false) => ({ x, y, width, height, value }) => {
    if (value == null) return null;
    if (horizontal) {
        return (
            <text x={x + width + 6} y={y + height / 2} dominantBaseline="central" fill="#1e293b" fontSize={12} fontWeight={700}>
                {formatCount(value)}
            </text>
        );
    }
    return (
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#1e293b" fontSize={12} fontWeight={700}>
            {formatCount(value)}
        </text>
    );
};
