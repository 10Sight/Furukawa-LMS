import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Tooltip } from 'recharts';
import { IconBuildingFactory2 } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, AXIS_TICK, GRID_STROKE,
    formatCount, formatPercent, renderBarValueLabel,
} from "./assemblyChartUtils.jsx";
import {
    SeriesLegend, AttendanceTooltip, AttendanceTable, TableToggle,
    ChartLoader, ChartDateFilter, ChartStatusNotice, WrappedNameTick,
} from "./assemblyChartShared.jsx";

// Wide enough for a 14-character label line at the axis font size
const MIN_WIDTH_PER_LINE = 120;

const Badge = ({ color, children }) => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {children}
    </span>
);

// sectionId is null for the Unassigned bucket. Each card keeps its own date; cards
// on the same date share one cached request.
const AssemblySectionLineChart = ({ sectionId, sectionName: fallbackName, shift, defaultDate }) => {
    const { t } = useTranslate();
    const [date, setDate] = useState(defaultDate);
    const [showTable, setShowTable] = useState(false);

    const { data, error, isFetching } = useGetAssemblyDashboardStatsQuery({ date, shift });
    const stats = data?.data;
    const section = useMemo(
        () => (stats?.sections || []).find(item => (item.sectionId ?? null) === (sectionId ?? null)) || null,
        [stats, sectionId]
    );

    const rows = useMemo(() => (section?.lines || []).map(line => ({
        key: line.lineId ?? 'unassigned',
        name: line.isUnassigned ? t('assembly.unassignedLine') : line.lineName,
        totalUsers: line.totalUsers,
        presentUsers: line.presentUsers,
        absentUsers: line.absentUsers,
        attendancePercentage: line.attendancePercentage,
    })), [section, t]);

    const sectionName = sectionId == null
        ? t('assembly.unassignedSection')
        : section?.sectionName || fallbackName;

    return (
        <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-gray-900">
                        <IconBuildingFactory2 className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="truncate" title={sectionName}>{sectionName}</span>
                    </h3>
                    {!isFetching && rows.length > 0 && (
                        <TableToggle open={showTable} onToggle={() => setShowTable(v => !v)} />
                    )}
                </div>
                <ChartDateFilter value={date} onChange={setDate} />
                {!isFetching && (
                    <div className="flex flex-wrap gap-1.5">
                        <Badge color={TOTAL_COLOR}>{t('assembly.totalUsers')}: {formatCount(section?.totalUsers)}</Badge>
                        <Badge color={PRESENT_COLOR}>{t('assembly.presentUsers')}: {formatCount(section?.presentUsers)}</Badge>
                        <Badge>{formatPercent(section?.attendancePercentage)}</Badge>
                        <Badge>{rows.length} {t('assembly.lines')}</Badge>
                    </div>
                )}
            </div>

            {isFetching ? (
                <ChartLoader minHeight={320} />
            ) : (
                <>
                    <ChartStatusNotice stats={stats} error={error} />
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
                                                tick={<WrappedNameTick charsPerLine={14} maxLines={2} />}
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
                </>
            )}
        </div>
    );
};

export default AssemblySectionLineChart;
