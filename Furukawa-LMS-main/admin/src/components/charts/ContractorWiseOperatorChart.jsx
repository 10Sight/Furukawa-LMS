import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetContractorWiseOperatorStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllContractorsQuery } from '@/Redux/AllApi/ContractorApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconBuilding, IconCalendar, IconRefresh } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import useTranslate from "@/hooks/useTranslate";
import { useIsTablet, useIsMobile } from "@/hooks/useIsTablet";

// Formats a Date using local calendar fields, avoiding the UTC day-shift toISOString() causes in IST.
const formatDate = (date) => {
    if (!date || isNaN(date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const _now         = new Date();
const CURRENT_YEAR = _now.getFullYear();
const MONTH_END    = formatDate(new Date(_now.getFullYear(), _now.getMonth() + 1, 0));

const CONTRACTOR_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#ef4444',
    '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#f43f5e',
];

// Default under-the-hood date range per timeframe, used when the visible inputs are left blank.
const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { rawStart: formatDate(first), rawEnd: formatDate(last) };
    }
    if (timeframe === 'monthly') {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        return {
            rawStart: `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`,
            rawEnd:   `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        };
    }
    return { rawStart: String(now.getFullYear() - 4), rawEnd: String(now.getFullYear()) };
};

// Falls back to the timeframe's default range when the visible inputs are left blank.
const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) {
        const defaults = getDefaultDates(timeframe);
        rawStart = rawStart || defaults.rawStart;
        rawEnd   = rawEnd   || defaults.rawEnd;
    }
    if (timeframe === 'monthly') {
        const [ey, em] = rawEnd.split('-').map(Number);
        const lastDay  = new Date(ey, em, 0).getDate();
        return { startDate: `${rawStart}-01`, endDate: `${rawEnd}-${String(lastDay).padStart(2, '0')}` };
    }
    if (timeframe === 'yearly') {
        return { startDate: `${rawStart}-01-01`, endDate: `${rawEnd}-12-31` };
    }
    return { startDate: rawStart, endDate: rawEnd };
};

const localeMap = { en: 'en-US', hi: 'hi-IN', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU' };

const formatPeriodLabel = (period, groupBy, language = 'en') => {
    if (!period) return '';
    if (groupBy === 'yearly') return period;
    const locale = localeMap[language] || 'en-US';
    if (groupBy === 'daily') {
        return new Date(`${period}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    }
    const [year, month] = period.split('-');
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

const getPeriodKey = (dateStr, groupBy) => {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d)) return null;
    if (groupBy === 'yearly')  return String(d.getFullYear());
    if (groupBy === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return dateStr.substring(0, 10);
};

const buildPeriodList = (groupBy, start, end) => {
    if (!start || !end) return [];
    const periods = [];
    if (groupBy === 'daily') {
        const cur  = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            periods.push(formatDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm]  = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
            periods.push(`${sy}-${String(sm).padStart(2, '0')}`);
            sm++;
            if (sm > 12) { sm = 1; sy++; }
        }
    } else {
        const sy = Number(start.split('-')[0]);
        const ey = Number(end.split('-')[0]);
        for (let y = sy; y <= ey; y++) periods.push(String(y));
    }
    return periods;
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,            placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM'    },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1, placeholder: 'YYYY'      },
};

const ContractorWiseOperatorChart = () => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart,  setRawStart]  = useState('');
    const [rawEnd,    setRawEnd]    = useState('');

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data: usersData, isLoading, error } = useGetContractorWiseOperatorStatsQuery({ startDate, endDate });
    const { data: contractorsData } = useGetAllContractorsQuery();
    const allUsers = usersData?.data?.users || [];

    const contractorIdToName = useMemo(() => {
        const map = {};
        (contractorsData?.data || []).forEach(c => { map[String(c.id)] = c.name; });
        return map;
    }, [contractorsData]);

    const { periods, contractorNames, flatPoints, categories, groupSeparators } = useMemo(() => {
        if (!allUsers.length || !startDate || !endDate)
            return { periods: [], contractorNames: [], flatPoints: [], categories: [], groupSeparators: [] };

        const start = new Date(`${startDate}T00:00:00`);
        const end   = new Date(`${endDate}T23:59:59`);

        const filtered = allUsers.filter(u => {
            if (!u.joiningDate) return false;
            const jd = new Date(`${String(u.joiningDate).substring(0, 10)}T00:00:00`);
            return jd >= start && jd <= end;
        });

        const periods = buildPeriodList(timeframe, startDate, endDate);

        const resolveName = (u) =>
            u.contractor?.trim() ||
            (u.contractorId ? contractorIdToName[String(u.contractorId)] : null) ||
            'No Contractor';

        const contractorMap = new Map();
        filtered.forEach(u => {
            const name = resolveName(u);
            if (!contractorMap.has(name)) contractorMap.set(name, contractorMap.size);
        });
        const contractorNames = [...contractorMap.keys()];

        const matrix = {};
        filtered.forEach(u => {
            const key  = getPeriodKey(String(u.joiningDate).substring(0, 10), timeframe);
            if (!key) return;
            const name = resolveName(u);
            if (!matrix[key]) matrix[key] = {};
            matrix[key][name] = (matrix[key][name] || 0) + 1;
        });

        // Flat points — one per contractor per period that has data,
        // plus a null placeholder for periods with no data so every date
        // still appears on the x-axis.
        const flatPoints = [];

        periods.forEach(period => {
            const periodLabel = formatPeriodLabel(period, timeframe, language);
            const present = contractorNames.filter(n => (matrix[period]?.[n] || 0) > 0);

            if (!present.length) {
                flatPoints.push({
                    y:          null,
                    color:      'transparent',
                    contractor: '',
                    periodLabel,
                    isDateSlot: true,
                    isEmpty:    true,
                });
                return;
            }

            const totalSlots = present.length;
            const isEven    = totalSlots % 2 === 0;
            const midIdx    = Math.floor(totalSlots / 2);

            present.forEach((name, gi) => {
                const ci = contractorMap.get(name);
                flatPoints.push({
                    y:          matrix[period][name],
                    color:      CONTRACTOR_COLORS[ci % CONTRACTOR_COLORS.length],
                    contractor: name,
                    periodLabel,
                    isDateSlot: gi === midIdx,
                    shiftDate:  isEven && gi === midIdx,
                    isEmpty:    false,
                });
            });
        });

        // x-axis HTML label per bar:
        //   • empty period  → just the date, greyed out
        //   • data period   → contractor name (each word on its own line, in contractor colour)
        //                     + date line visible only on the middle bar of the group;
        //                       hidden placeholder on other bars keeps all label heights equal
        const categories = flatPoints.map(p => {
            if (p.isEmpty) {
                return `<span style="color:#94a3b8;font-size:11px;font-weight:600">${p.periodLabel}</span>`;
            }

            const nameHtml = p.contractor
                .split(' ')
                .map(w => `<span style="color:${p.color};font-weight:700;font-size:11px;line-height:1.6">${w}</span>`)
                .join('<br/>');

            const dateLine = p.isDateSlot
                ? `<br/><span style="color:#64748b;font-size:13px;font-weight:800;display:inline-block;margin-top:8px${p.shiftDate ? ';margin-right:96px' : ''}">${p.periodLabel}</span>`
                : `<br/><span style="visibility:hidden;font-size:13px;display:inline-block;margin-top:8px">${p.periodLabel}</span>`;

            return nameHtml + dateLine;
        });

        // Dashed vertical separator between date groups (after last bar of each group)
        const groupSeparators = [];
        let i = 0;
        while (i < flatPoints.length) {
            const label = flatPoints[i].periodLabel;
            let j = i;
            while (j < flatPoints.length && flatPoints[j].periodLabel === label) j++;
            if (j < flatPoints.length) {
                groupSeparators.push({
                    value:     j - 0.5,
                    width:     1,
                    dashStyle: 'Dash',
                    color:     '#cbd5e1',
                    zIndex:    3,
                });
            }
            i = j;
        }

        return { periods, contractorNames, flatPoints, categories, groupSeparators };
    }, [allUsers, contractorIdToName, timeframe, startDate, endDate, language]);

    // Summary
    const totalOperators = flatPoints.reduce((sum, p) => sum + (p.y || 0), 0);
    const contractorTotals = {};
    flatPoints.forEach(p => {
        if (p.isEmpty || !p.contractor) return;
        contractorTotals[p.contractor] = (contractorTotals[p.contractor] || 0) + (p.y || 0);
    });
    const topContractor = Object.entries(contractorTotals).reduce(
        (best, [name, sum]) => sum > (best?.sum || 0) ? { name, sum } : best,
        null
    );

    const handleTimeframeChange = (tf) => {
        setTimeframe(tf);
        setRawStart('');
        setRawEnd('');
    };

    const handleReset = () => {
        setTimeframe('daily');
        setRawStart('');
        setRawEnd('');
    };

    const SLOT_WIDTH     = 96;
    const needsScroll    = flatPoints.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? flatPoints.length * SLOT_WIDTH : undefined;

    const chartOptions = useMemo(() => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 560,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            marginBottom: 170,
            marginTop: 60,
            ...(needsScroll && { scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX: 1 } }),
        },
        title:   { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            labels: {
                useHTML:  true,
                rotation: 0,
                align:    'center',
                style:    { textAlign: 'center', lineHeight: '1.6' },
            },
            gridLineWidth: 0,
            plotLines:     groupSeparators,
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title:  { text: 'Operators', style: { color: '#94a3b8', fontSize: '14px' } },
            labels: { style: { fontSize: '13px' } },
            gridLineColor: '#f1f5f9',
        },
        legend:  { enabled: false },
        tooltip: {
            useHTML: true,
            style:   { fontSize: '14px' },
            formatter() {
                return (
                    `<span style="color:${this.point.color}">●</span> ` +
                    `<b>${this.point.contractor}</b><br/>` +
                    `Date: <b>${this.point.periodLabel}</b><br/>` +
                    `Operators: <b>${this.y}</b>`
                );
            },
        },
        plotOptions: {
            column: {
                colorByPoint:  true,
                borderRadius:  5,
                borderWidth:   0,
                pointPadding:  0.06,
                groupPadding:  0,
                maxPointWidth: 80,
                dataLabels: {
                    enabled:      true,
                    formatter()   { return this.y > 0 ? String(this.y) : ''; },
                    style:        { fontSize: '13px', fontWeight: 'bold', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align:         'center',
                    y:             -20,
                    allowOverlap:  true,
                },
            },
        },
        // Taller chart on tablet widths so labels/legend fit in one frame without overlap;
        // shorter on phones to keep a compact plot area.
        responsive: {
            rules: [
                {
                    condition: { minWidth: 768, maxWidth: 1024 },
                    chartOptions: { chart: { height: 500 } },
                },
                {
                    condition: { maxWidth: 767 },
                    chartOptions: { chart: { height: 480 } },
                },
            ],
        },
        series: [{
            type:  'column',
            name:  'Operators',
            data:  flatPoints,
            showInLegend: false,
        }],
    }), [categories, flatPoints, groupSeparators, needsScroll, scrollMinWidth]);

    const cfg        = INPUT_CONFIG[timeframe];
    const hasAnyData = flatPoints.length > 0;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconBuilding className="h-5 w-5 text-blue-600" />
                            {t('charts.contractorWiseDojo')}
                        </CardTitle>
                        <CardDescription>
                            {t('charts.contractorWiseDojoDesc')}
                        </CardDescription>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.timeframe')}
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'daily',   label: t('charts.daily30d')   },
                                { key: 'monthly', label: t('charts.monthly12m') },
                                { key: 'yearly',  label: t('charts.yearly5y')   },
                            ].map(({ key, label }) => (
                                <Button
                                    key={key}
                                    variant={timeframe === key ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => handleTimeframeChange(key)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t('charts.from')}</Label>
                        <Input
                            type={cfg.type}
                            value={rawStart}
                            onChange={e => setRawStart(e.target.value)}
                            min={String(cfg.min)}
                            max={rawEnd || String(cfg.max)}
                            step={cfg.step}
                            placeholder={cfg.placeholder}
                            className="h-8 text-xs w-36"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t('charts.to')}</Label>
                        <Input
                            type={cfg.type}
                            value={rawEnd}
                            onChange={e => setRawEnd(e.target.value)}
                            min={rawStart || String(cfg.min)}
                            max={String(cfg.max)}
                            step={cfg.step}
                            placeholder={cfg.placeholder}
                            className="h-8 text-xs w-36"
                        />
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800 self-end"
                        onClick={handleReset}
                    >
                        <IconRefresh className="h-3.5 w-3.5 mr-1" />
                        {t('charts.reset')}
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 480 : 560 }} className="flex flex-col items-center justify-center gap-4">
                        <img
                            src="/fme_transparent.png"
                            alt="FME"
                            className="w-20 h-20 object-contain animate-pulse"
                        />
                        <p className="text-xs font-bold tracking-widest uppercase text-slate-400 animate-pulse">
                            {t('charts.loading')}
                        </p>
                    </div>
                ) : error ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 480 : 560 }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadContractor')}</p>
                    </div>
                ) : !hasAnyData ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 480 : 560 }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noOperatorJoiningData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustTimeframeOrRange')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${timeframe}-${startDate}-${endDate}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">{t('charts.totalJoined')}</span>
                                <span className="text-sm font-black text-blue-900">{totalOperators}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-600">{t('charts.contractors')}</span>
                                <span className="text-sm font-black text-slate-800">{contractorNames.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50">
                                <span className="text-xs font-bold text-emerald-700 truncate pr-1">{t('charts.topContractor')}</span>
                                <span className="text-xs font-black text-emerald-900 truncate max-w-[80px]" title={topContractor?.name}>
                                    {topContractor?.name ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">
                                    {timeframe === 'daily' ? t('charts.daysTracked') : timeframe === 'monthly' ? t('charts.monthsTracked') : t('charts.yearsTracked')}
                                </span>
                                <span className="text-sm font-black text-slate-800">{periods.length}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default ContractorWiseOperatorChart;
