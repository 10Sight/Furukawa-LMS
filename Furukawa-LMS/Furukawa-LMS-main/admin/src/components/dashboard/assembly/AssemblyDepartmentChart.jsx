import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Tooltip } from 'recharts';
import { IconUsers, IconUserCheck, IconUserX, IconPercentage } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, ABSENT_COLOR, RATE_COLOR, AXIS_TICK, GRID_STROKE,
    formatCount, formatPercent, renderBarValueLabel,
} from "./assemblyChartUtils.jsx";
import {
    SeriesLegend, AttendanceTooltip, AttendanceTable, TableToggle,
    ChartLoader, ChartDateFilter, ChartStatusNotice, WrappedNameTick,
} from "./assemblyChartShared.jsx";

// Section names run up to ~50 characters: three wrapped rows of 16 fit in this width
const MIN_WIDTH_PER_SECTION = 150;

const KpiCard = ({ icon, label, value }) => (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {icon}
            {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
);

const AssemblyDepartmentChart = ({ shift, defaultDate }) => {
    const { t } = useTranslate();
    const [date, setDate] = useState(defaultDate);
    const [showTable, setShowTable] = useState(false);

    const { data, error, isFetching } = useGetAssemblyDashboardStatsQuery({ date, shift });
    const stats = data?.data;
    const department = stats?.department;

    const rows = useMemo(() => (stats?.sections || [])
        .map(section => ({
            key: section.sectionId ?? 'unassigned',
            name: section.isUnassigned ? t('assembly.unassignedSection') : section.sectionName,
            totalUsers: section.totalUsers,
            presentUsers: section.presentUsers,
            absentUsers: section.absentUsers,
            attendancePercentage: section.attendancePercentage,
        }))
        .sort((a, b) => b.totalUsers - a.totalUsers), [stats, t]);

    return (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-base font-bold text-gray-900">{t('assembly.sectionSummary')}</h2>
                    <p className="text-xs text-gray-500">{t('assembly.sectionSummaryHint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ChartDateFilter value={date} onChange={setDate} />
                    {!isFetching && rows.length > 0 && (
                        <TableToggle open={showTable} onToggle={() => setShowTable(v => !v)} />
                    )}
                </div>
            </div>

            {isFetching ? (
                <ChartLoader minHeight={460} />
            ) : (
                <>
                    <ChartStatusNotice stats={stats} error={error} />

                    {department && (
                        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <KpiCard icon={<IconUsers className="h-4 w-4 shrink-0" style={{ color: TOTAL_COLOR }} />} label={t('assembly.totalUsers')} value={formatCount(department.totalUsers)} />
                            <KpiCard icon={<IconUserCheck className="h-4 w-4 shrink-0" style={{ color: PRESENT_COLOR }} />} label={t('assembly.presentUsers')} value={formatCount(department.presentUsers)} />
                            <KpiCard icon={<IconUserX className="h-4 w-4 shrink-0" style={{ color: ABSENT_COLOR }} />} label={t('assembly.absentUsers')} value={formatCount(department.absentUsers)} />
                            <KpiCard icon={<IconPercentage className="h-4 w-4 shrink-0" style={{ color: RATE_COLOR }} />} label={t('assembly.attendanceRate')} value={formatPercent(department.attendancePercentage)} />
                        </div>
                    )}

                    {rows.length > 0 && (showTable ? (
                        <AttendanceTable rows={rows} nameLabel={t('assembly.section')} />
                    ) : (
                        <>
                            <div className="mt-4 w-full overflow-x-auto pb-1">
                                <div style={{ width: '100%', minWidth: Math.max(320, rows.length * MIN_WIDTH_PER_SECTION), height: 360 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={rows} margin={{ top: 24, right: 8, left: -4, bottom: 4 }} barGap={2} barCategoryGap="20%">
                                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                interval={0}
                                                tick={<WrappedNameTick charsPerLine={16} maxLines={3} />}
                                                height={58}
                                                tickLine={false}
                                                axisLine={{ stroke: '#cbd5e1' }}
                                            />
                                            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                                            <Tooltip cursor={{ fill: '#f1f5f9' }} content={<AttendanceTooltip nameLabel={t('assembly.section')} />} />
                                            <Bar dataKey="totalUsers" name={t('assembly.totalUsers')} fill={TOTAL_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} minPointSize={2}>
                                                <LabelList dataKey="totalUsers" content={renderBarValueLabel()} />
                                            </Bar>
                                            <Bar dataKey="presentUsers" name={t('assembly.presentUsers')} fill={PRESENT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={44} minPointSize={2}>
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
                    ))}
                </>
            )}
        </div>
    );
};

export default AssemblyDepartmentChart;
