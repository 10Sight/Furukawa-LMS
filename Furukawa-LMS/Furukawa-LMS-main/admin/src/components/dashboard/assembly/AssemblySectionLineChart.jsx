import React, { useMemo, useState } from 'react';
import { IconBuildingFactory2 } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, PRESENT_SHIFT_COLORS,
    formatCount, formatPercent, getShiftCounts, getVisibleShiftKeys, getBarSeries,
    PRESENT_VIEW_SHIFT, isShiftBreakup,
} from "./assemblyChartUtils.jsx";
import {
    AttendanceTable, TableToggle, ChartLoader, ChartDateFilter, ChartShiftFilter,
    ChartStatusNotice, ShiftNote, PresentViewToggle,
} from "./assemblyChartShared.jsx";
import AssemblyAttendanceBarChart from "./AssemblyAttendanceBarChart.jsx";

const Badge = ({ color, children }) => (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {children}
    </span>
);

// sectionId is null for the Unassigned bucket. Each card keeps its own date and shift;
// cards on the same date share one cached request.
const AssemblySectionLineChart = ({ sectionId, sectionName: fallbackName, defaultDate }) => {
    const { t } = useTranslate();
    const [date, setDate] = useState(defaultDate);
    const [shift, setShift] = useState("ALL");
    const [presentView, setPresentView] = useState(PRESENT_VIEW_SHIFT);
    const [showTable, setShowTable] = useState(false);

    // Shift is applied in the browser from byShift, so changing it needs no request.
    const { data, error, isFetching } = useGetAssemblyDashboardStatsQuery({ date });
    const stats = data?.data;
    const section = useMemo(
        () => (stats?.sections || []).find(item => (item.sectionId ?? null) === (sectionId ?? null)) || null,
        [stats, sectionId]
    );
    const sectionCounts = section ? getShiftCounts(section, shift) : null;

    const rows = useMemo(() => (section?.lines || []).map(line => ({
        key: line.lineId ?? 'unassigned',
        name: line.isUnassigned ? t('assembly.unassignedLine') : line.lineName,
        ...getShiftCounts(line, shift),
    })), [section, shift, t]);
    const shiftKeys = useMemo(() => getVisibleShiftKeys(rows), [rows]);
    const series = useMemo(() => getBarSeries(t, shift, rows, presentView), [t, shift, rows, presentView]);
    // Per-shift detail in tooltip / table / KPI only when the shift breakup is shown
    const detailShiftKeys = isShiftBreakup(shift, presentView) ? shiftKeys : [];

    const sectionName = sectionId == null
        ? t('assembly.unassignedSection')
        : section?.sectionName || fallbackName;
    const presentColor = shift === "ALL" ? PRESENT_COLOR : PRESENT_SHIFT_COLORS[shift];

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
                <div className="flex flex-wrap items-center gap-2">
                    <ChartDateFilter value={date} onChange={setDate} />
                    <ChartShiftFilter value={shift} onChange={setShift} />
                    <PresentViewToggle shift={shift} value={presentView} onChange={setPresentView} />
                </div>
                {!isFetching && (
                    <div className="flex flex-wrap gap-1.5">
                        <Badge color={TOTAL_COLOR}>{t('assembly.totalUsers')}: {formatCount(sectionCounts?.totalUsers)}</Badge>
                        <Badge color={presentColor}>{t('assembly.presentUsers')}: {formatCount(sectionCounts?.presentUsers)}</Badge>
                        <Badge>{formatPercent(sectionCounts?.attendancePercentage)}</Badge>
                        <Badge>{rows.length} {t('assembly.lines')}</Badge>
                    </div>
                )}
            </div>

            {isFetching ? (
                <ChartLoader minHeight={320} />
            ) : (
                <>
                    <ChartStatusNotice stats={stats} error={error} />
                    <ShiftNote shift={shift} />
                    {rows.length === 0 ? (
                        <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 py-10 text-sm text-slate-400">
                            {t('assembly.noLines')}
                        </div>
                    ) : showTable ? (
                        <AttendanceTable rows={rows} nameLabel={t('assembly.line')} shift={shift} shiftKeys={detailShiftKeys} />
                    ) : (
                        <AssemblyAttendanceBarChart
                            rows={rows}
                            series={series}
                            shift={shift}
                            shiftKeys={detailShiftKeys}
                            nameLabel={t('assembly.line')}
                            groupWidth={120}
                            height={330}
                            labelCharsPerLine={14}
                            labelMaxLines={2}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default AssemblySectionLineChart;
