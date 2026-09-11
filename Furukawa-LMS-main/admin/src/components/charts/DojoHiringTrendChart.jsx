import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDojoHiringTrendQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconUsers, IconCalendar, IconRefresh, IconChevronDown } from "@tabler/icons-react";
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

const _now        = new Date();
const CURRENT_YEAR = _now.getFullYear();
const TODAY        = formatDate(_now);
const MONTH_END    = formatDate(new Date(_now.getFullYear(), _now.getMonth() + 1, 0));

// Default under-the-hood date range per timeframe, used when the visible inputs are left blank.
const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            rawStart: formatDate(firstOfMonth),
            rawEnd:   formatDate(lastOfMonth),
        };
    }
    if (timeframe === 'monthly') {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        return {
            rawStart: `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`,
            rawEnd:   `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        };
    }
    return {
        rawStart: String(now.getFullYear() - 4),
        rawEnd:   String(now.getFullYear()),
    };
};

// Convert raw filter inputs to ISO date strings for the API.
// Falls back to the timeframe's default range when the visible inputs are left blank.
const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) {
        const defaults = getDefaultDates(timeframe);
        rawStart = rawStart || defaults.rawStart;
        rawEnd   = rawEnd   || defaults.rawEnd;
    }

    if (timeframe === 'monthly') {
        // rawStart/rawEnd are "YYYY-MM" from <input type="month">
        const [ey, em] = rawEnd.split('-').map(Number);
        const lastDay = new Date(ey, em, 0).getDate();
        return {
            startDate: `${rawStart}-01`,
            endDate: `${rawEnd}-${String(lastDay).padStart(2, '0')}`,
        };
    }
    if (timeframe === 'yearly') {
        // rawStart/rawEnd are plain year numbers, e.g. "2022" / "2025"
        return {
            startDate: `${rawStart}-01-01`,
            endDate: `${rawEnd}-12-31`,
        };
    }
    // daily: already full "YYYY-MM-DD" strings
    return { startDate: rawStart, endDate: rawEnd };
};

const localeMap = { en: 'en-US', hi: 'hi-IN', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU' };

// Human-readable x-axis label per groupBy
const formatPeriodLabel = (period, groupBy, language = 'en') => {
    if (!period) return '';
    if (groupBy === 'yearly') return period;
    const locale = localeMap[language] || 'en-US';
    if (groupBy === 'daily') {
        return new Date(`${period}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
    }
    const [year, month] = period.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

// Build the complete list of periods in [start, end] so every slot shows
// even when the backend returned no rows for that period (zero hires).
const EMPTY_ROW = { total: 0, maleCount: 0, femaleCount: 0, otherCount: 0 };

const buildFullSeries = (groupBy, start, end, trend) => {
    if (!start || !end) return trend;

    const dataMap = {};
    trend.forEach(r => { dataMap[r.period] = r; });

    const full = [];

    if (groupBy === 'daily') {
        const cur = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            const key = formatDate(cur);
            full.push(dataMap[key] ?? { ...EMPTY_ROW, period: key });
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm] = start.split('-').map(Number);
        const [ey, em] = end.split('-').map(Number);
        while (sy < ey || (sy === ey && sm <= em)) {
            const key = `${sy}-${String(sm).padStart(2, '0')}`;
            full.push(dataMap[key] ?? { ...EMPTY_ROW, period: key });
            sm++;
            if (sm > 12) { sm = 1; sy++; }
        }
    } else {
        // yearly
        const sy = Number(start.split('-')[0]);
        const ey = Number(end.split('-')[0]);
        for (let y = sy; y <= ey; y++) {
            const key = String(y);
            full.push(dataMap[key] ?? { ...EMPTY_ROW, period: key });
        }
    }

    return full;
};

// Input field config that changes per timeframe
const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,                    placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`,         placeholder: 'YYYY-MM' },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1,        placeholder: 'YYYY' },
};

// Data labels above each bar (total view)
const aboveBarLabels = {
    enabled: true,
    formatter() { return this.y > 0 ? this.y : ''; },
    rotation: 0,
    allowOverlap: true,
    style: {
        fontSize: '14px',
        fontWeight: '900',
        color: '#1e293b',
        textOutline: '2px white',
    },
    verticalAlign: 'top',
    align: 'center',
    y: -20,
};

// Data labels inside stacked segments (gender view)
const insideSegmentLabels = {
    enabled: true,
    formatter() { return this.y > 0 ? this.y : ''; },
    rotation: 0,
    allowOverlap: true,
    style: {
        fontSize: '13px',
        fontWeight: '900',
        color: '#ffffff',
        textOutline: 'none',
    },
    verticalAlign: 'middle',
    align: 'center',
    inside: true,
};

const basePlotOptions = {
    column: {
        borderRadius: 4,
        borderWidth: 0,
        groupPadding: 0.2,
        maxPointWidth: 36,
    },
};

const DojoHiringTrendChart = ({ departments: departmentsProp } = {}) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [viewMode,     setViewMode]     = useState('total');
    const [timeframe,    setTimeframe]    = useState('daily');
    const [rawStart,     setRawStart]     = useState('');
    const [rawEnd,       setRawEnd]       = useState('');
    const [selectedDepts, setSelectedDepts] = useState([]);

    // Home.jsx already fetches the department list once and passes it down; only fall back
    // to a local (RTK-Query-cached) fetch when this chart is used standalone.
    const EMPTY_ARRAY = useMemo(() => [], []);
    const departments = departmentsProp ?? (deptsData?.data?.departments || EMPTY_ARRAY);

    // O(1) lookup for department names, keyed by id as string. Falls back gracefully for
    // custom-role/department-scoped users whose /api/departments list only contains their
    // own assigned department(s).
    const deptMap = useMemo(() => {
        const map = new Map();
        (departments || []).forEach(d => {
            if (d?.id != null) map.set(String(d.id), d.name);
            if (d?._id != null) map.set(String(d._id), d.name);
        });
        return map;
    }, [departments]);

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data, isLoading, error } = useGetDojoHiringTrendQuery({
        groupBy: timeframe,
        startDate,
        endDate,
        departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '',
    });

    const rawTrend = useMemo(() => data?.data?.trend || [], [data]);
    const groupBy  = data?.data?.groupBy || timeframe;
    const apiStart = data?.data?.start   || '';
    const apiEnd   = data?.data?.end     || '';

    // Current period key (same format as `period` values) so today's slot/label can be
    // located and highlighted regardless of the active timeframe.
    const currentPeriodKey = useMemo(() => {
        const now = new Date();
        if (groupBy === 'daily') return formatDate(now);
        if (groupBy === 'monthly') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return String(now.getFullYear());
    }, [groupBy]);

    // Pad with zero-rows so every period in the window always has a bar
    const trend = useMemo(
        () => buildFullSeries(groupBy, apiStart, apiEnd, rawTrend),
        [groupBy, apiStart, apiEnd, rawTrend]
    );

    const todaySlotIdx = useMemo(
        () => trend.findIndex(r => r.period === currentPeriodKey),
        [trend, currentPeriodKey]
    );

    const categories = useMemo(() => trend.map(r => {
        const label = formatPeriodLabel(r.period, groupBy, language);
        const isToday = r.period === currentPeriodKey;
        return isToday
            ? `<span style="color:#2563eb;font-size:14px;font-weight:900;text-decoration:underline">${label}</span>`
            : `<span style="color:#64748b;font-size:14px;font-weight:800">${label}</span>`;
    }), [trend, groupBy, language, currentPeriodKey]);

    const { totalSeries, maleSeries, femaleSeries, otherSeries, grandTotal, totalMale, totalFemale } = useMemo(() => {
        const total = [];
        const male = [];
        const female = [];
        const other = [];
        let gTotal = 0;
        let tMale = 0;
        let tFemale = 0;
        for (const r of trend) {
            const tot = Number(r.total) || 0;
            const m = Number(r.maleCount) || 0;
            const f = Number(r.femaleCount) || 0;
            const o = Number(r.otherCount) || 0;
            total.push(tot);
            male.push(m);
            female.push(f);
            other.push(o);
            gTotal += tot;
            tMale += m;
            tFemale += f;
        }
        return { totalSeries: total, maleSeries: male, femaleSeries: female, otherSeries: other, grandTotal: gTotal, totalMale: tMale, totalFemale: tFemale };
    }, [trend]);

    const handleTimeframeChange = (tf) => {
        setTimeframe(tf);
        setRawStart('');
        setRawEnd('');
    };

    const handleReset = () => {
        setTimeframe('daily');
        setRawStart('');
        setRawEnd('');
        setSelectedDepts([]);
        setViewMode('total');
    };

    const toggleDept = (id, checked) =>
        setSelectedDepts(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (deptMap.get(String(selectedDepts[0])) ?? '1 Dept')
            : `${selectedDepts.length} ${t('nav.departments')}`;

    // ── Highcharts shared base ────────────────────────────────────────────────
    // Each category slot is ~72px wide. When total width exceeds the card (~800px),
    // scrollablePlotArea makes the inner plot scrollable and scrollPositionX:1 starts
    // the viewport at the rightmost (most recent) data automatically.
    const SLOT_WIDTH    = 72;
    const needsScroll   = categories.length * SLOT_WIDTH > 800;
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

    const totalOptions = useMemo(() => ({
        chart: {
            backgroundColor: 'transparent',
            height: 360,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            marginBottom: needsScroll ? 75 : 40,
            ...(needsScroll && {
                scrollablePlotArea: {
                    minWidth: scrollMinWidth,
                    scrollPositionX,
                },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            labels: {
                useHTML: true,
                style: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center' },
                rotation: 0,
                align: 'center',
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Candidates', style: { color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' } },
            labels: { style: { fontSize: '13px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: { enabled: false },
        responsive: {
            rules: [
                {
                    condition: { minWidth: 768, maxWidth: 1024 },
                    chartOptions: { chart: { height: 500 } },
                },
                {
                    condition: { maxWidth: 767 },
                    chartOptions: { chart: { height: 320 } },
                },
            ],
        },
        plotOptions: {
            column: {
                ...basePlotOptions.column,
                dataLabels: aboveBarLabels,
            },
        },
        tooltip: {
            shared: true,
            useHTML: true,
            pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}</b>',
        },
        series: [{
            type: 'column',
            name: t('charts.newHires'),
            data: totalSeries,
            color: '#3b82f6',
        }],
    }), [categories, totalSeries, needsScroll, scrollMinWidth, scrollPositionX, t]);

    const genderSeries = useMemo(() => [
        { type: 'column', name: t('charts.male'),   data: maleSeries,   color: '#3b82f6' },
        { type: 'column', name: t('charts.female'), data: femaleSeries, color: '#ec4899' },
        ...(otherSeries.some(v => v > 0)
            ? [{ type: 'column', name: t('charts.other'), data: otherSeries, color: '#94a3b8' }]
            : []),
    ], [maleSeries, femaleSeries, otherSeries, t]);

    const genderOptions = useMemo(() => ({
        chart: {
            backgroundColor: 'transparent',
            height: 360,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            marginBottom: needsScroll ? 75 : 40,
            ...(needsScroll && {
                scrollablePlotArea: {
                    minWidth: scrollMinWidth,
                    scrollPositionX,
                },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            labels: {
                useHTML: true,
                style: { fontSize: '14px', fontWeight: 'bold', textAlign: 'center' },
                rotation: 0,
                align: 'center',
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Candidates', style: { color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' } },
            labels: { style: { fontSize: '13px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: { enabled: true },
        responsive: {
            rules: [
                {
                    condition: { minWidth: 768, maxWidth: 1024 },
                    chartOptions: { chart: { height: 500 } },
                },
                {
                    condition: { maxWidth: 767 },
                    chartOptions: { chart: { height: 320 } },
                },
            ],
        },
        plotOptions: {
            column: {
                ...basePlotOptions.column,
                stacking: 'normal',
                dataLabels: insideSegmentLabels,
            },
        },
        tooltip: {
            shared: true,
            useHTML: true,
            pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}</b><br/>',
        },
        series: genderSeries,
    }), [categories, genderSeries, needsScroll, scrollMinWidth, scrollPositionX]);

    // ── Render ────────────────────────────────────────────────────────────────
    const cfg = INPUT_CONFIG[timeframe];


    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                {/* Title row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconUsers className="h-5 w-5 text-blue-600" />
                            {t('charts.dojoHiringTrend')}
                        </CardTitle>
                        <CardDescription>
                            {t('charts.dojoHiringTrendDesc')}
                        </CardDescription>
                    </div>

                    {/* Total / By Gender toggle */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant={viewMode === 'total' ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => setViewMode('total')}
                        >
                            {t('charts.total')}
                        </Button>
                        <Button
                            variant={viewMode === 'gender' ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => setViewMode('gender')}
                        >
                            {t('charts.byGender')}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">

                    {/* Timeframe preset */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.timeframe')}
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'daily',   label: t('charts.daily30d') },
                                { key: 'monthly', label: t('charts.monthly12m') },
                                { key: 'yearly',  label: t('charts.yearly5y') },
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

                    {/* Custom From date */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.from')}
                        </Label>
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

                    {/* Custom To date */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.to')}
                        </Label>
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

                    {/* Department */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('nav.department')}
                        </Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-44 justify-between text-xs font-normal px-3">
                                    <span className="truncate">{deptLabel}</span>
                                    <IconChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                                <div className="max-h-52 overflow-y-auto space-y-0.5">
                                    {departments.map(d => {
                                        const id = String(d.id ?? d._id);
                                        return (
                                            <label key={id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                                                <Checkbox
                                                    checked={selectedDepts.includes(id)}
                                                    onCheckedChange={v => toggleDept(id, !!v)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <span className="text-xs truncate">{d.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedDepts.length > 0 && (
                                    <button
                                        className="mt-2 w-full text-xs text-slate-400 hover:text-slate-700 text-center py-1 border-t border-slate-100"
                                        onClick={() => setSelectedDepts([])}
                                    >
                                        {t('charts.clearSelection')}
                                    </button>
                                )}
                            </PopoverContent>
                        </Popover>
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
                {/* Loading state — logo centred in the chart area; header/filters stay visible */}
                {isLoading ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 320 : 360 }} className="flex flex-col items-center justify-center gap-4">
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
                    <div style={{ height: isTablet ? 500 : isMobile ? 320 : 360 }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadHiringTrend')}</p>
                    </div>
                ) : grandTotal === 0 ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 320 : 360 }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noHiringData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${viewMode}-${timeframe}-${startDate}-${endDate}-${selectedDepts.join(',')}`}
                            highcharts={Highcharts}
                            options={viewMode === 'total' ? totalOptions : genderOptions}
                        />

                        {/* Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">{t('charts.totalHired')}</span>
                                <span className="text-sm font-black text-blue-900">{grandTotal}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-600">{t('charts.male')}</span>
                                <span className="text-sm font-black text-slate-800">{totalMale}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pink-50">
                                <span className="text-xs font-bold text-pink-600">{t('charts.female')}</span>
                                <span className="text-sm font-black text-pink-900">{totalFemale}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">
                                    {timeframe === 'daily' ? t('charts.daysTracked') : timeframe === 'monthly' ? t('charts.monthsTracked') : t('charts.yearsTracked')}
                                </span>
                                <span className="text-sm font-black text-slate-800">{trend.length}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default React.memo(DojoHiringTrendChart);
