import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Tooltip } from 'recharts';
import { IconBuildingFactory2 } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, AXIS_TICK, GRID_STROKE,
    formatCount, formatPercent, renderBarValueLabel,
} from "./assemblyChartUtils.jsx";
import { SeriesLegend, AttendanceTooltip, AttendanceTable, TableToggle } from "./assemblyChartShared.jsx";

// Wide enough for a 14-character label line at the axis font size
const MIN_WIDTH_PER_LINE = 120;
const LABEL_LINE_CHARS = 14;
const LABEL_MAX_LINES = 2;

// Splits a line name into at most two horizontal rows, breaking on spaces when it can.
const wrapLabel = (name) => {
    const words = String(name || '').split(/\s+/).filter(Boolean);
    const rows = [];
    let current = '';
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= LABEL_LINE_CHARS || !current) {
            current = next;
        } else {
            rows.push(current);
            current = word;
        }
    }
    if (current) rows.push(current);
    if (rows.length > LABEL_MAX_LINES) {
        const kept = rows.slice(0, LABEL_MAX_LINES);
        kept[LABEL_MAX_LINES - 1] = `${kept[LABEL_MAX_LINES - 1].slice(0, LABEL_LINE_CHARS - 1)}…`;
        return kept;
    }
    return rows.map(row => (row.length > LABEL_LINE_CHARS + 4 ? `${row.slice(0, LABEL_LINE_CHARS + 3)}…` : row));
};

const LineNameTick = ({ x, y, payload }) => {
    const name = String(payload?.value || '');
    return (
        <text x={x} y={y + 14} textAnchor="middle" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize} fontWeight={AXIS_TICK.fontWeight}>
            <title>{name}</title>
            {wrapLabel(name).map((row, index) => (
                <tspan key={index} x={x} dy={index === 0 ? 0 : 14}>{row}</tspan>
            ))}
        </text>
    );
};

const Badge = ({ color, children }) => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {children}
    </span>
);

const AssemblySectionLineChart = ({ section }) => {
    const { t } = useTranslate();
    const [showTable, setShowTable] = useState(false);

    const rows = useMemo(() => (section?.lines || []).map(line => ({
        key: line.lineId ?? 'unassigned',
        name: line.isUnassigned ? t('assembly.unassignedLine') : line.lineName,
        totalUsers: line.totalUsers,
        presentUsers: line.presentUsers,
        absentUsers: line.absentUsers,
        attendancePercentage: line.attendancePercentage,
    })), [section, t]);

    const sectionName = section?.isUnassigned ? t('assembly.unassignedSection') : section?.sectionName;

    return (
        <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                        <IconBuildingFactory2 className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate" title={sectionName}>{sectionName}</span>
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge color={TOTAL_COLOR}>{t('assembly.totalUsers')}: {formatCount(section?.totalUsers)}</Badge>
                        <Badge color={PRESENT_COLOR}>{t('assembly.presentUsers')}: {formatCount(section?.presentUsers)}</Badge>
                        <Badge>{formatPercent(section?.attendancePercentage)}</Badge>
                        <Badge>{rows.length} {t('assembly.lines')}</Badge>
                    </div>
                </div>
                {rows.length > 0 && (
                    <TableToggle open={showTable} onToggle={() => setShowTable(v => !v)} />
                )}
            </div>

            {rows.length === 0 ? (
                <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 py-10 text-sm text-slate-400">
                    {t('assembly.noLines')}
                </div>
            ) : showTable ? (
                <AttendanceTable rows={rows} nameLabel={t('assembly.line')} />
            ) : (
                <>
                    <div className="mt-3 w-full overflow-x-auto pb-1">
                        <div style={{ width: '100%', minWidth: Math.max(320, rows.length * MIN_WIDTH_PER_LINE), height: 320 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rows} margin={{ top: 24, right: 8, left: -12, bottom: 4 }} barGap={2} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        interval={0}
                                        tick={<LineNameTick />}
                                        height={44}
                                        tickLine={false}
                                        axisLine={{ stroke: '#cbd5e1' }}
                                    />
                                    <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip cursor={{ fill: '#f1f5f9' }} content={<AttendanceTooltip nameLabel={t('assembly.line')} />} />
                                    <Bar dataKey="totalUsers" name={t('assembly.totalUsers')} fill={TOTAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} minPointSize={2}>
                                        <LabelList dataKey="totalUsers" content={renderBarValueLabel()} />
                                    </Bar>
                                    <Bar dataKey="presentUsers" name={t('assembly.presentUsers')} fill={PRESENT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} minPointSize={2}>
                                        <LabelList dataKey="presentUsers" content={renderBarValueLabel()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-2 flex justify-center">
                        <SeriesLegend />
                    </div>
                </>
            )}
        </div>
    );
};

export default AssemblySectionLineChart;
