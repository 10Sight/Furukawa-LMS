import React, { useMemo, useState } from 'react';
import { IconUsers, IconUserCheck, IconUserX, IconPercentage } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, ABSENT_COLOR, RATE_COLOR, PRESENT_SHIFT_COLORS,
    formatCount, formatPercent, getShiftCounts, getVisibleShiftKeys, getBarSeries,
    PRESENT_VIEW_SHIFT, isShiftBreakup,
} from "./assemblyChartUtils.jsx";
import {
    AttendanceTable, TableToggle, ChartLoader, ChartDateFilter, ChartShiftFilter,
    ChartStatusNotice, ShiftNote, PresentViewToggle,
} from "./assemblyChartShared.jsx";
import AssemblyAttendanceBarChart from "./AssemblyAttendanceBarChart.jsx";

const KpiCard = ({ icon, label, value, footer }) => (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {icon}
            {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
        {footer}
    </div>
);

// "A 715 · B 606 · G 2" under the Present card when the chart shows all shifts
const PresentByShift = ({ department, shiftKeys }) => (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-500">
        {shiftKeys.map(key => (
            <span key={key} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: PRESENT_SHIFT_COLORS[key] }} />
                {key} {formatCount(department.byShift?.[key]?.presentUsers)}
            </span>
        ))}
    </div>
);

const AssemblyDepartmentChart = ({ defaultDate }) => {
    const { t } = useTranslate();
    const [date, setDate] = useState(defaultDate);
    const [shift, setShift] = useState("ALL");
    const [presentView, setPresentView] = useState(PRESENT_VIEW_SHIFT);
    const [showTable, setShowTable] = useState(false);

    // Shift is applied in the browser from byShift, so changing it needs no request.
    const { data, error, isFetching } = useGetAssemblyDashboardStatsQuery({ date });
    const stats = data?.data;
    const department = stats?.department;
    const kpi = department ? getShiftCounts(department, shift) : null;

    const rows = useMemo(() => (stats?.sections || [])
        .map(section => ({
            key: section.sectionId ?? 'unassigned',
            name: section.isUnassigned ? t('assembly.unassignedSection') : section.sectionName,
            ...getShiftCounts(section, shift),
        }))
        .sort((a, b) => b.totalUsers - a.totalUsers), [stats, shift, t]);
    const shiftKeys = useMemo(() => getVisibleShiftKeys(rows), [rows]);
    const series = useMemo(() => getBarSeries(t, shift, rows, presentView), [t, shift, rows, presentView]);
    // Per-shift detail in tooltip / table / KPI only when the shift breakup is shown
    const detailShiftKeys = isShiftBreakup(shift, presentView) ? shiftKeys : [];
    const presentColor = shift === "ALL" ? PRESENT_COLOR : PRESENT_SHIFT_COLORS[shift];

    return (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-base font-bold text-gray-900">{t('assembly.sectionSummary')}</h2>
                    <p className="text-xs text-gray-500">{t('assembly.sectionSummaryHint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ChartDateFilter value={date} onChange={setDate} />
                    <ChartShiftFilter value={shift} onChange={setShift} />
                    <PresentViewToggle shift={shift} value={presentView} onChange={setPresentView} />
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
                    <ShiftNote shift={shift} />

                    {kpi && (
                        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <KpiCard icon={<IconUsers className="h-4 w-4 shrink-0" style={{ color: TOTAL_COLOR }} />} label={t('assembly.totalUsers')} value={formatCount(kpi.totalUsers)} />
                            <KpiCard
                                icon={<IconUserCheck className="h-4 w-4 shrink-0" style={{ color: presentColor }} />}
                                label={t('assembly.presentUsers')}
                                value={formatCount(kpi.presentUsers)}
                                footer={detailShiftKeys.length > 0 && <PresentByShift department={department} shiftKeys={detailShiftKeys} />}
                            />
                            <KpiCard icon={<IconUserX className="h-4 w-4 shrink-0" style={{ color: ABSENT_COLOR }} />} label={t('assembly.absentUsers')} value={formatCount(kpi.absentUsers)} />
                            <KpiCard icon={<IconPercentage className="h-4 w-4 shrink-0" style={{ color: RATE_COLOR }} />} label={t('assembly.attendanceRate')} value={formatPercent(kpi.attendancePercentage)} />
                        </div>
                    )}

                    {rows.length > 0 && (showTable ? (
                        <AttendanceTable rows={rows} nameLabel={t('assembly.section')} shift={shift} shiftKeys={detailShiftKeys} />
                    ) : (
                        <AssemblyAttendanceBarChart
                            rows={rows}
                            series={series}
                            shift={shift}
                            shiftKeys={detailShiftKeys}
                            nameLabel={t('assembly.section')}
                            groupWidth={150}
                            height={380}
                            labelCharsPerLine={16}
                            labelMaxLines={3}
                        />
                    ))}
                </>
            )}
        </div>
    );
};

export default AssemblyDepartmentChart;
