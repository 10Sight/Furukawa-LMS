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

const _now        = new Date();
const CURRENT_YEAR = _now.getFullYear();
const TODAY        = _now.toISOString().split('T')[0];
const MONTH_END    = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().split('T')[0];

// Convert raw filter inputs to ISO date strings for the API.
// Returns empty strings when either end is missing — backend falls back to its default window.
const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) return { startDate: '', endDate: '' };

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
            const key = cur.toISOString().split('T')[0];
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

const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            rawStart: firstOfMonth.toISOString().split('T')[0],
            rawEnd:   lastOfMonth.toISOString().split('T')[0],
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

const DojoHiringTrendChart = () => {
    const { t, language } = useTranslate();
    const [viewMode,     setViewMode]     = useState('total');
    const [timeframe,    setTimeframe]    = useState('daily');
    const [rawStart,     setRawStart]     = useState(() => getDefaultDates('daily').rawStart);
    const [rawEnd,       setRawEnd]       = useState(() => getDefaultDates('daily').rawEnd);
    const [selectedDepts, setSelectedDepts] = useState([]);

    const { data: deptsData } = useGetAllDepartmentsQuery();
    const departments = deptsData?.data?.departments || [];

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

    const rawTrend = data?.data?.trend   || [];
    const groupBy  = data?.data?.groupBy || timeframe;
    const apiStart = data?.data?.start   || '';
    const apiEnd   = data?.data?.end     || '';

    // Pad with zero-rows so every period in the window always has a bar
    const trend = useMemo(
        () => buildFullSeries(groupBy, apiStart, apiEnd, rawTrend),
        [groupBy, apiStart, apiEnd, rawTrend]
    );

    const categories   = trend.map(r => formatPeriodLabel(r.period, groupBy, language));
    const totalSeries  = trend.map(r => Number(r.total)       || 0);
    const maleSeries   = trend.map(r => Number(r.maleCount)   || 0);
    const femaleSeries = trend.map(r => Number(r.femaleCount) || 0);
    const otherSeries  = trend.map(r => Number(r.otherCount)  || 0);
    const grandTotal   = totalSeries.reduce((a, b) => a + b, 0);
    const totalMale    = maleSeries.reduce((a, b) => a + b, 0);
    const totalFemale  = femaleSeries.reduce((a, b) => a + b, 0);

    const handleTimeframeChange = (tf) => {
        const { rawStart: s, rawEnd: e } = getDefaultDates(tf);
        setTimeframe(tf);
        setRawStart(s);
        setRawEnd(e);
    };

    const handleReset = () => {
        const { rawStart: s, rawEnd: e } = getDefaultDates('daily');
        setTimeframe('daily');
        setRawStart(s);
        setRawEnd(e);
        setSelectedDepts([]);
        setViewMode('total');
    };

    const toggleDept = (id, checked) =>
        setSelectedDepts(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (departments.find(d => String(d.id ?? d._id) === selectedDepts[0])?.name ?? '1 Dept')
            : `${selectedDepts.length} ${t('nav.departments')}`;

    // ── Highcharts shared base ────────────────────────────────────────────────
    // Each category slot is ~72px wide. When total width exceeds the card (~800px),
    // scrollablePlotArea makes the inner plot scrollable and scrollPositionX:1 starts
    // the viewport at the rightmost (most recent) data automatically.
    const SLOT_WIDTH    = 72;
    const needsScroll   = categories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? categories.length * SLOT_WIDTH : undefined;

    const basePlotOptions = {
        column: {
            borderRadius: 4,
            borderWidth: 0,
            groupPadding: 0.2,
            maxPointWidth: 36,
        },
    };

    const baseChart = {
        chart: {
            backgroundColor: 'transparent',
            height: 360,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            // scrollablePlotArea expands the inner canvas; scrollPositionX:1 = start at right
            ...(needsScroll && {
                scrollablePlotArea: {
                    minWidth: scrollMinWidth,
                    scrollPositionX: 1,
                },
            }),
        },
        title:   { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            labels: {
                style: { fontSize: '11px', color: '#64748b' },
                rotation: 0,
                align: 'center',
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Candidates', style: { color: '#94a3b8', fontSize: '11px' } },
            gridLineColor: '#f1f5f9',
        },
        legend: { enabled: viewMode === 'gender' },
    };

    // Data labels above each bar (total view)
    const aboveBarLabels = {
        enabled: true,
        formatter() { return this.y > 0 ? this.y : ''; },
        rotation: 0,
        allowOverlap: true,
        style: {
            fontSize: '11px',
            fontWeight: 'bold',
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
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#ffffff',
            textOutline: 'none',
        },
        verticalAlign: 'middle',
        align: 'center',
        inside: true,
    };

    const getTotalOptions = () => ({
        ...baseChart,
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
    });

    const getGenderOptions = () => ({
        ...baseChart,
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
        series: [
            { type: 'column', name: t('charts.male'),   data: maleSeries,   color: '#3b82f6' },
            { type: 'column', name: t('charts.female'), data: femaleSeries, color: '#ec4899' },
            ...(otherSeries.some(v => v > 0)
                ? [{ type: 'column', name: t('charts.other'), data: otherSeries, color: '#94a3b8' }]
                : []),
        ],
    });

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
                    <div className="h-[360px] flex flex-col items-center justify-center gap-4">
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
                    <div className="h-[360px] flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadHiringTrend')}</p>
                    </div>
                ) : grandTotal === 0 ? (
                    <div className="h-[360px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noHiringData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${viewMode}-${timeframe}-${startDate}-${endDate}-${selectedDepts.join(',')}`}
                            highcharts={Highcharts}
                            options={viewMode === 'total' ? getTotalOptions() : getGenderOptions()}
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

export default DojoHiringTrendChart;
