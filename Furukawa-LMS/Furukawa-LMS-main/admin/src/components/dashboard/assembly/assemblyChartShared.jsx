import React from 'react';
import useTranslate from "@/hooks/useTranslate.js";
import { TOTAL_COLOR, PRESENT_COLOR, ABSENT_COLOR, formatCount, formatPercent } from "./assemblyChartUtils.jsx";

export const SeriesLegend = () => {
    const { t } = useTranslate();
    return (
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: TOTAL_COLOR }} />
                {t('assembly.totalUsers')}
            </span>
            <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: PRESENT_COLOR }} />
                {t('assembly.presentUsers')}
            </span>
        </div>
    );
};

export const AttendanceTooltip = ({ active, payload, nameLabel }) => {
    const { t } = useTranslate();
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    return (
        <div className="min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{nameLabel}</div>
            <div className="mb-2 text-sm font-bold text-slate-900">{row.name}</div>
            <TooltipRow color={TOTAL_COLOR} label={t('assembly.totalUsers')} value={formatCount(row.totalUsers)} />
            <TooltipRow color={PRESENT_COLOR} label={t('assembly.presentUsers')} value={formatCount(row.presentUsers)} />
            <TooltipRow color={ABSENT_COLOR} label={t('assembly.absentUsers')} value={formatCount(row.absentUsers)} />
            <div className="mt-1.5 flex justify-between gap-4 border-t border-slate-100 pt-1.5">
                <span className="text-slate-500">{t('assembly.attendanceRate')}</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatPercent(row.attendancePercentage)}</span>
            </div>
        </div>
    );
};

const TooltipRow = ({ color, label, value }) => (
    <div className="flex items-center justify-between gap-4 py-0.5">
        <span className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
        </span>
        <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
);

export const AttendanceTable = ({ rows, nameLabel }) => {
    const { t } = useTranslate();
    return (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                        <th className="px-3 py-2 font-semibold">{nameLabel}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('assembly.totalUsers')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('assembly.presentUsers')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('assembly.absentUsers')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('assembly.attendanceRate')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                    {rows.map(row => (
                        <tr key={row.key}>
                            <td className="px-3 py-1.5 font-medium text-slate-900">{row.name}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(row.totalUsers)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(row.presentUsers)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(row.absentUsers)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{formatPercent(row.attendancePercentage)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export const TableToggle = ({ open, onToggle }) => {
    const { t } = useTranslate();
    return (
        <button
            type="button"
            onClick={onToggle}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
            {open ? t('assembly.hideTable') : t('assembly.showTable')}
        </button>
    );
};
