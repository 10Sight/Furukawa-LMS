import React, { useState, useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetDepartmentQuizStatsQuery } from '@/Redux/AllApi/AnalyticsApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { IconChartBar, IconRefresh, IconCalendar } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import useTranslate from "@/hooks/useTranslate";
import { useIsTablet, useIsMobile } from "@/hooks/useIsTablet";

const PASS_COLOR = '#16a34a';
const FAIL_COLOR = '#dc2626';

/* ── Filter Select helper ── */
const FilterSelect = ({ label, placeholder, value, onChange, items, disabled, allLabel }) => {
    const { t } = useTranslate();
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</Label>
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-xs">{allLabel || t('charts.all')}</SelectItem>
                    {(items || []).map(item => {
                        const itemId = String(item.id || item._id || '');
                        return (
                            <SelectItem key={itemId} value={itemId} className="text-xs">
                                {item.name}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════ */

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

const buildFullPeriods = (groupBy, start, end) => {
    if (!start || !end) return [];
    const full = [];
    if (groupBy === 'daily') {
        const cur  = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            full.push(formatDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm]   = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
            full.push(`${sy}-${String(sm).padStart(2, '0')}`);
            sm++;
            if (sm > 12) { sm = 1; sy++; }
        }
    } else {
        const sy = Number(start.split('-')[0]);
        const ey = Number(end.split('-')[0]);
        for (let y = sy; y <= ey; y++) full.push(String(y));
    }
    return full;
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,            placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM'    },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1, placeholder: 'YYYY'      },
};

const DepartmentQuizChart = ({ departments: departmentsProp }) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart,  setRawStart]  = useState('');
    const [rawEnd,    setRawEnd]    = useState('');
    const [filters, setFilters] = useState({ departmentId: '', sectionId: '' });

    const set = (key) => (val) => {
        const cleared = val === 'all' ? '' : val;
        if (key === 'departmentId') {
            setFilters({ departmentId: cleared, sectionId: '' });
        } else {
            setFilters(prev => ({ ...prev, [key]: cleared }));
        }
    };

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    /* ── API: chart data ── */
    const { data: statsData, isLoading, error } = useGetDepartmentQuizStatsQuery({
        startDate,
        endDate,
        groupBy: timeframe,
        departmentId: filters.departmentId,
    });

    /* ── API: filter options ── */
    // Home.jsx already fetches the department list once and passes it down; only fall back
    // to a local (RTK-Query-cached) fetch when this chart is used standalone.
    const { data: deptData }    = useGetAllDepartmentsQuery({ limit: 200 }, { skip: !!departmentsProp });
    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        filters.departmentId || skipToken
    );

    const departments = departmentsProp ?? (deptData?.data?.departments || []);
    const formattedSections = useMemo(() => {
        const rawSections = sectionData?.data || sectionData || [];
        return rawSections.map(s => ({
            ...s,
            name: s.category ? `${s.name} (${s.category})` : s.name,
        }));
    }, [sectionData]);

    const chartData = statsData?.data?.stats || [];
    const groupBy   = statsData?.data?.groupBy || timeframe;
    const apiStart  = statsData?.data?.start   || '';
    const apiEnd    = statsData?.data?.end     || '';

    // Section-level rows already scope to the chosen department on the backend; narrow further
    // to a single selected section here, client-side.
    const filteredRows = useMemo(() => {
        if (!filters.sectionId) return chartData;
        return chartData.filter(r => String(r.sectionId ?? r.departmentId ?? '') === filters.sectionId);
    }, [chartData, filters.sectionId]);

    // Current period key (same format as `period` values) so today's slot/label can be
    // located and highlighted regardless of the active timeframe.
    const currentPeriodKey = useMemo(() => {
        const now = new Date();
        if (groupBy === 'daily') return formatDate(now);
        if (groupBy === 'monthly') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return String(now.getFullYear());
    }, [groupBy]);

    const fullPeriods = useMemo(
        () => buildFullPeriods(groupBy, apiStart, apiEnd),
        [groupBy, apiStart, apiEnd]
    );

    /* ── Summary totals ── */
    const totalPassed   = filteredRows.reduce((a, d) => a + (Number(d.passedCount) || 0), 0);
    const totalFailed   = filteredRows.reduce((a, d) => a + (Number(d.failedCount) || 0), 0);
    const totalAttempts = totalPassed + totalFailed;
    const passRate      = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;
    const hasAnyData     = totalPassed > 0 || totalFailed > 0;

    // Two-series approach (Passed vs Failed): for each period, every active department (or
    // section, in drill mode) is a category slot, and within that slot Highcharts renders 2
    // bars (Passed and Failed) side-by-side. The date label is shown once per group, under
    // the middle slot — mirroring DojoHandoverComparisonChart's layout.
    const { passedPoints, failedPoints, categories, groupSeparators, todaySlotIdx } = useMemo(() => {
        if (!filteredRows.length || !fullPeriods.length)
            return { passedPoints: [], failedPoints: [], categories: [], groupSeparators: [], todaySlotIdx: -1 };

        const dataMap = {};
        const orderedKeys = [];
        const nameMap = {};
        filteredRows.forEach(r => {
            const key = String(r.sectionId ?? r.departmentId ?? r.departmentName);
            if (!dataMap[key]) {
                dataMap[key] = {};
                orderedKeys.push(key);
                nameMap[key] = r.departmentName;
            }
            const bucket = dataMap[key][r.period] ?? { passed: 0, failed: 0 };
            bucket.passed += Number(r.passedCount) || 0;
            bucket.failed += Number(r.failedCount) || 0;
            dataMap[key][r.period] = bucket;
        });

        const passedPoints = [];
        const failedPoints = [];
        const categories = [];
        const groupSeparators = [];
        let todaySlotIdx = -1;

        fullPeriods.forEach(period => {
            const periodLabel = formatPeriodLabel(period, groupBy, language);
            const isToday = period === currentPeriodKey;
            const keysPresent = orderedKeys.filter(k => {
                const v = dataMap[k]?.[period];
                return v && (v.passed > 0 || v.failed > 0);
            });

            if (!keysPresent.length) {
                if (isToday && todaySlotIdx === -1) todaySlotIdx = categories.length;
                const emptyColor  = isToday ? '#2563eb' : '#94a3b8';
                const emptyWeight = isToday ? '900' : '800';
                categories.push(`<span style="color:${emptyColor};font-size:14px;font-weight:${emptyWeight}">${periodLabel}</span>`);
                passedPoints.push({ y: null, label: '', periodLabel, isPassed: true, isEmpty: true });
                failedPoints.push({ y: null, label: '', periodLabel, isPassed: false, isEmpty: true });
                return;
            }

            const N = keysPresent.length;
            const midIdx = Math.floor((N - 1) / 2);

            keysPresent.forEach((key, idx) => {
                const label = nameMap[key];
                const vals  = dataMap[key][period];
                const isDateSlot = idx === midIdx;

                if (isDateSlot && isToday && todaySlotIdx === -1) todaySlotIdx = categories.length;

                const topHtml = label
                    .split(' ')
                    .map(w => `<span style="color:#475569;font-weight:800;font-size:14px;line-height:1.6">${w}</span>`)
                    .join('<br/>');

                const dateLine = isDateSlot
                    ? (isToday
                        ? `<br/><span style="color:#2563eb;font-size:16px;font-weight:900;display:inline-block;margin-top:8px;text-decoration:underline">${periodLabel}</span>`
                        : `<br/><span style="color:#64748b;font-size:16px;font-weight:900;display:inline-block;margin-top:8px">${periodLabel}</span>`)
                    : `<br/><span style="visibility:hidden;font-size:16px;display:inline-block;margin-top:8px">${periodLabel}</span>`;

                categories.push(topHtml + dateLine);

                passedPoints.push({ y: vals.passed > 0 ? vals.passed : null, label, periodLabel, isPassed: true, isEmpty: false });
                failedPoints.push({ y: vals.failed > 0 ? vals.failed : null, label, periodLabel, isPassed: false, isEmpty: false });
            });
        });

        // Dashed vertical separator between date groups (after last bar of each group)
        let i = 0;
        while (i < passedPoints.length) {
            const label = passedPoints[i].periodLabel;
            let j = i;
            while (j < passedPoints.length && passedPoints[j].periodLabel === label) j++;
            if (j < passedPoints.length) {
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

        return { passedPoints, failedPoints, categories, groupSeparators, todaySlotIdx };
    }, [filteredRows, fullPeriods, groupBy, language, currentPeriodKey]);

    const SLOT_WIDTH     = 120; // 120px slot width to fit two bars nicely
    const needsScroll    = categories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? categories.length * SLOT_WIDTH : undefined;

    // Center the scrollable viewport on today's slot when possible; otherwise default to
    // the right edge (most recent data), matching prior behavior.
    const scrollPositionX = useMemo(() => {
        if (!needsScroll || todaySlotIdx === -1) return 1;
        const viewportWidth = 800;
        const targetPx = todaySlotIdx * SLOT_WIDTH;
        const maxScrollPx = (categories.length * SLOT_WIDTH) - viewportWidth;
        if (maxScrollPx <= 0) return 1;
        const centeredPx = targetPx - (viewportWidth / 2);
        return Math.max(0, Math.min(1, centeredPx / maxScrollPx));
    }, [needsScroll, todaySlotIdx, categories.length]);

    const handleTimeframeChange = (tf) => {
        setTimeframe(tf);
        setRawStart('');
        setRawEnd('');
    };

    const handleReset = () => {
        setTimeframe('daily');
        setRawStart('');
        setRawEnd('');
        setFilters({ departmentId: '', sectionId: '' });
    };

    /* ── Highcharts config ── */
    const chartOptions = useMemo(() => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 560,
            marginBottom: 170,
            marginTop: 60,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            ...(needsScroll && {
                scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX, opacity: 1 },
            }),
        },
        title:   { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            lineWidth: 1,
            lineColor: '#e9ecef',
            labels: {
                useHTML:  true,
                rotation: 0,
                align:    'center',
                style:    { textAlign: 'center', lineHeight: '1.6' },
            },
            gridLineWidth: 0,
            plotLines: groupSeparators,
        },
        yAxis: {
            min:           0,
            allowDecimals: false,
            title:         { text: t('charts.attempts'), style: { color: '#94a3b8', fontSize: '15px', fontWeight: 'bold' } },
            labels:        { style: { fontSize: '15px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: {
            enabled:      true,
            align:        'right',
            verticalAlign: 'top',
            layout:       'horizontal',
            floating:     true,
            y:            -15,
            itemStyle: {
                fontSize:   '14px',
                fontWeight: 'bold',
                color:      '#475569',
            },
        },
        tooltip: {
            useHTML: true,
            style:   { fontSize: '13px' },
            formatter() {
                if (!this.point.label) return `<b>${this.point.periodLabel}</b>: ${t('charts.noData')}`;
                const series  = this.point.series.chart.series;
                const passed  = series[0]?.data[this.point.index]?.y ?? 0;
                const failed  = series[1]?.data[this.point.index]?.y ?? 0;
                const total   = passed + failed;
                return (
                    `<b style="font-size:14px;color:#0f172a">${this.point.label}</b><br/>` +
                    `Date: <b>${this.point.periodLabel}</b><br/>` +
                    `<span style="color:${PASS_COLOR}">●</span> ${t('charts.passed')}: <b>${passed}</b><br/>` +
                    `<span style="color:${FAIL_COLOR}">●</span> ${t('charts.failed')}: <b>${failed}</b><br/>` +
                    `<span style="color:#6b7280">${t('charts.total')}: <b style="color:#0f172a">${total}</b></span>`
                );
            },
        },
        plotOptions: {
            column: {
                colorByPoint:  false,
                borderRadius:  5,
                borderWidth:   0,
                pointPadding:  0.1,
                groupPadding:  0.2,
                maxPointWidth: 40,
                dataLabels: {
                    enabled:      true,
                    formatter()   { return this.y > 0 ? String(this.y) : ''; },
                    style:        { fontSize: '15px', fontWeight: '900', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align:         'center',
                    y:             -20,
                    allowOverlap:  true,
                },
            },
        },
        // Taller chart on tablet widths so labels/legend fit in one frame without overlap;
        // on phones the floating top-right legend is undocked to a centered row so it
        // doesn't overlap the plot area on narrow widths.
        responsive: {
            rules: [
                {
                    condition: { minWidth: 768, maxWidth: 1024 },
                    chartOptions: { chart: { height: 500 } },
                },
                {
                    condition: { maxWidth: 767 },
                    chartOptions: {
                        chart: { height: 480 },
                        legend: { floating: false, align: 'center', verticalAlign: 'top', y: 0 },
                    },
                },
            ],
        },
        series: [
            {
                type:  'column',
                name:  t('charts.passed'),
                data:  passedPoints,
                color: PASS_COLOR,
            },
            {
                type:  'column',
                name:  t('charts.failed'),
                data:  failedPoints,
                color: FAIL_COLOR,
            },
        ],
    }), [categories, passedPoints, failedPoints, groupSeparators, needsScroll, scrollMinWidth, scrollPositionX, t]);

    const cfg = INPUT_CONFIG[timeframe];

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconChartBar className="h-5 w-5 text-blue-600" />
                            {t('charts.deptTestPerf')}
                        </CardTitle>
                        <CardDescription>
                            {t('charts.deptTestPerfDesc')}
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

                    <FilterSelect
                        label={t('nav.department')}
                        placeholder={t('nav.department')}
                        value={filters.departmentId || 'all'}
                        onChange={set('departmentId')}
                        items={departments}
                        allLabel={t('charts.allDepartments')}
                    />

                    <FilterSelect
                        label={t('charts.section')}
                        placeholder={t('charts.section')}
                        value={filters.sectionId || 'all'}
                        onChange={set('sectionId')}
                        items={formattedSections}
                        disabled={!filters.departmentId}
                        allLabel={t('charts.allSections')}
                    />

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
                        <p className="text-sm font-semibold">{t('charts.failedToLoadDeptTest')}</p>
                    </div>
                ) : !hasAnyData ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 480 : 560 }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noTestAttemptData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${timeframe}-${startDate}-${endDate}-${filters.departmentId}-${filters.sectionId}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                                <span className="text-xs font-bold text-green-700">{t('charts.totalPassed')}</span>
                                <span className="text-sm font-black text-green-900">{totalPassed}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                <span className="text-xs font-bold text-red-700">{t('charts.totalFailed')}</span>
                                <span className="text-sm font-black text-red-900">{totalFailed}</span>
                            </div>
                            <div className={`flex items-center justify-between p-2.5 rounded-lg ${passRate >= 70 ? 'bg-green-50' : 'bg-amber-50'}`}>
                                <span className={`text-xs font-bold ${passRate >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{t('charts.passRate')}</span>
                                <span className={`text-sm font-black ${passRate >= 70 ? 'text-green-900' : 'text-amber-900'}`}>{passRate}%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">{t('charts.totalAttempts')}</span>
                                <span className="text-sm font-black text-slate-800">{totalAttempts}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default DepartmentQuizChart;
