import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList, Tooltip } from 'recharts';
import { IconUsers, IconUserCheck, IconUserX, IconPercentage } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, ABSENT_COLOR, RATE_COLOR, AXIS_TICK, GRID_STROKE,
    formatCount, formatPercent, renderBarValueLabel,
} from "./assemblyChartUtils.jsx";
import { SeriesLegend, AttendanceTooltip, AttendanceTable, TableToggle } from "./assemblyChartShared.jsx";

const SECTION_NAME_MAX_CHARS = 30;
const ROW_HEIGHT = 52;

const KpiCard = ({ icon, label, value }) => (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {icon}
            {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </div>
);

// Long section names are cut on the axis; the tooltip and table show them in full.
const SectionTick = ({ x, y, payload }) => {
    const name = String(payload?.value || '');
    const short = name.length > SECTION_NAME_MAX_CHARS ? `${name.slice(0, SECTION_NAME_MAX_CHARS - 1)}…` : name;
    return (
        <text x={x - 8} y={y} dy={4} textAnchor="end" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize} fontWeight={AXIS_TICK.fontWeight}>
            <title>{name}</title>
            {short}
        </text>
    );
};

const AssemblyDepartmentChart = ({ department, sections = [] }) => {
    const { t } = useTranslate();
    const [showTable, setShowTable] = useState(false);

    const rows = useMemo(() => sections
        .map(section => ({
            key: section.sectionId ?? 'unassigned',
            name: section.isUnassigned ? t('assembly.unassignedSection') : section.sectionName,
            totalUsers: section.totalUsers,
            presentUsers: section.presentUsers,
            absentUsers: section.absentUsers,
            attendancePercentage: section.attendancePercentage,
        }))
        .sort((a, b) => b.totalUsers - a.totalUsers), [sections, t]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard icon={<IconUsers className="h-4 w-4 shrink-0" style={{ color: TOTAL_COLOR }} />} label={t('assembly.totalUsers')} value={formatCount(department?.totalUsers)} />
                <KpiCard icon={<IconUserCheck className="h-4 w-4 shrink-0" style={{ color: PRESENT_COLOR }} />} label={t('assembly.presentUsers')} value={formatCount(department?.presentUsers)} />
                <KpiCard icon={<IconUserX className="h-4 w-4 shrink-0" style={{ color: ABSENT_COLOR }} />} label={t('assembly.absentUsers')} value={formatCount(department?.absentUsers)} />
                <KpiCard icon={<IconPercentage className="h-4 w-4 shrink-0" style={{ color: RATE_COLOR }} />} label={t('assembly.attendanceRate')} value={formatPercent(department?.attendancePercentage)} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{t('assembly.sectionSummary')}</h2>
                        <p className="text-xs text-gray-500">{t('assembly.sectionSummaryHint')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <SeriesLegend />
                        <TableToggle open={showTable} onToggle={() => setShowTable(v => !v)} />
                    </div>
                </div>

                {showTable ? (
                    <AttendanceTable rows={rows} nameLabel={t('assembly.section')} />
                ) : (
                    <div className="mt-3 w-full overflow-x-auto">
                        <div style={{ minWidth: 560, height: Math.max(rows.length * ROW_HEIGHT + 32, 160) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 4 }} barGap={2} barCategoryGap="22%">
                                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                                    <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" width={230} tick={<SectionTick />} tickLine={false} axisLine={false} interval={0} />
                                    <Tooltip cursor={{ fill: '#f1f5f9' }} content={<AttendanceTooltip nameLabel={t('assembly.section')} />} />
                                    <Bar dataKey="totalUsers" name={t('assembly.totalUsers')} fill={TOTAL_COLOR} radius={[0, 4, 4, 0]} maxBarSize={18} minPointSize={2}>
                                        <LabelList dataKey="totalUsers" content={renderBarValueLabel(true)} />
                                    </Bar>
                                    <Bar dataKey="presentUsers" name={t('assembly.presentUsers')} fill={PRESENT_COLOR} radius={[0, 4, 4, 0]} maxBarSize={18} minPointSize={2}>
                                        <LabelList dataKey="presentUsers" content={renderBarValueLabel(true)} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssemblyDepartmentChart;
