import brandLogoUrl from "@/assets/logos/fme-transparent.png";
import React from 'react';
import { IconCalendar, IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import {
    TOTAL_COLOR, PRESENT_COLOR, ABSENT_COLOR, AXIS_TICK, PRESENT_SHIFT_COLORS, SHIFT_OPTIONS,
    formatCount, formatPercent, getIstDateString, wrapLabel, getPresentShiftLabel,
} from "./assemblyChartUtils.jsx";

// FME logo, pulsing, centred in its chart while that chart's data loads
export const ChartLoader = ({ minHeight = 300 }) => (
    <div className="flex items-center justify-center" style={{ minHeight }} role="status" aria-live="polite" aria-label="Loading">
        <img src={brandLogoUrl} alt="" className="h-20 w-20 object-contain animate-pulse" />
    </div>
);

const QuickDateButton = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${active
            ? "bg-slate-900 text-white"
            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
        {children}
    </button>
);

// Date filter owned by a single chart
export const ChartDateFilter = ({ value, onChange }) => {
    const { t } = useTranslate();
    const todayStr = getIstDateString(0);
    const yesterdayStr = getIstDateString(-1);
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                <IconCalendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="sr-only">{t('assembly.date')}</span>
                <input
                    type="date"
                    value={value}
                    max={todayStr}
                    onChange={(e) => e.target.value && onChange(e.target.value)}
                    className="w-[7.5rem] cursor-pointer bg-transparent text-xs text-slate-700 outline-none"
                />
            </label>
            <QuickDateButton active={value === yesterdayStr} onClick={() => onChange(yesterdayStr)}>{t('assembly.yesterday')}</QuickDateButton>
            <QuickDateButton active={value === todayStr} onClick={() => onChange(todayStr)}>{t('assembly.today')}</QuickDateButton>
        </div>
    );
};

// Shift filter owned by a single chart
export const ChartShiftFilter = ({ value, onChange }) => {
    const { t } = useTranslate();
    return (
        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label={t('assembly.shift')}>
            {SHIFT_OPTIONS.map(option => (
                <button
                    key={option}
                    type="button"
                    onClick={() => onChange(option)}
                    aria-pressed={value === option}
                    title={option === "ALL" ? t('assembly.allShifts') : `${t('assembly.shift')} ${option}`}
                    className={`min-w-[32px] rounded px-2 py-1 text-xs font-bold transition-colors ${value === option
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"}`}
                >
                    {option}
                </button>
            ))}
        </div>
    );
};

// Holiday / missing-upload / error message for the date a chart is showing
export const ChartStatusNotice = ({ stats, error }) => {
    const { t } = useTranslate();
    let message = null;
    if (error) message = error?.data?.message || t('assembly.loadError');
    else if (stats?.holiday) message = `${stats.date} (${stats.holiday.name}) ${t('assembly.holidayNotice')}`;
    else if (stats && stats.attendanceRecords === 0) message = t('assembly.noAttendance');
    if (!message) return null;
    return (
        <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${error
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
        </div>
    );
};

// Explains how a single-shift headcount is formed
export const ShiftNote = ({ shift }) => {
    const { t } = useTranslate();
    if (shift === "ALL") return null;
    return (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <IconInfoCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{t('assembly.shiftNote')}</span>
        </div>
    );
};

// Horizontal, word-wrapped category label; the full name shows on hover.
export const WrappedNameTick = ({ x, y, payload, charsPerLine = 14, maxLines = 2 }) => {
    const name = String(payload?.value || '');
    return (
        <text x={x} y={y + 14} textAnchor="middle" fill={AXIS_TICK.fill} fontSize={AXIS_TICK.fontSize} fontWeight={AXIS_TICK.fontWeight}>
            <title>{name}</title>
            {wrapLabel(name, charsPerLine, maxLines).map((row, index) => (
                <tspan key={index} x={x} dy={index === 0 ? 0 : 14}>{row}</tspan>
            ))}
        </text>
    );
};

// series: [{ dataKey, label, color }], the same list the chart draws its bars from
export const SeriesLegend = ({ series }) => (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
        {series.map(item => (
            <span key={item.dataKey} className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
            </span>
        ))}
    </div>
);

const TooltipRow = ({ color, label, value, indent = false }) => (
    <div className={`flex items-center justify-between gap-4 py-0.5 ${indent ? "pl-4" : ""}`}>
        <span className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
        </span>
        <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </div>
);

// shiftKeys: on ALL, the shifts whose present count is listed under Present
export const AttendanceTooltip = ({ active, payload, nameLabel, shift, shiftKeys = [] }) => {
    const { t } = useTranslate();
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const presentColor = shift === "ALL" ? PRESENT_COLOR : (PRESENT_SHIFT_COLORS[shift] || PRESENT_COLOR);
    return (
        <div className="min-w-[210px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {nameLabel}{shift !== "ALL" ? ` · ${t('assembly.shift')} ${shift}` : ""}
            </div>
            <div className="mb-2 text-sm font-bold text-slate-900">{row.name}</div>
            <TooltipRow color={TOTAL_COLOR} label={t('assembly.totalUsers')} value={formatCount(row.totalUsers)} />
            <TooltipRow color={presentColor} label={t('assembly.presentUsers')} value={formatCount(row.presentUsers)} />
            {shift === "ALL" && shiftKeys.map(key => (
                <TooltipRow
                    key={key}
                    indent
                    color={PRESENT_SHIFT_COLORS[key]}
                    label={getPresentShiftLabel(t, key)}
                    value={formatCount(row[`present_${key}`])}
                />
            ))}
            <TooltipRow color={ABSENT_COLOR} label={t('assembly.absentUsers')} value={formatCount(row.absentUsers)} />
            <div className="mt-1.5 flex justify-between gap-4 border-t border-slate-100 pt-1.5">
                <span className="text-slate-500">{t('assembly.attendanceRate')}</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatPercent(row.attendancePercentage)}</span>
            </div>
        </div>
    );
};

export const AttendanceTable = ({ rows, nameLabel, shift, shiftKeys = [] }) => {
    const { t } = useTranslate();
    const perShiftKeys = shift === "ALL" ? shiftKeys : [];
    return (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                        <th className="px-3 py-2 font-semibold">{nameLabel}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('assembly.totalUsers')}</th>
                        <th className="px-3 py-2 text-right font-semibold">{t('assembly.presentUsers')}</th>
                        {perShiftKeys.map(key => (
                            <th key={key} className="whitespace-nowrap px-3 py-2 text-right font-semibold">{getPresentShiftLabel(t, key)}</th>
                        ))}
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
                            {perShiftKeys.map(key => (
                                <td key={key} className="px-3 py-1.5 text-right tabular-nums">{formatCount(row[`present_${key}`])}</td>
                            ))}
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
