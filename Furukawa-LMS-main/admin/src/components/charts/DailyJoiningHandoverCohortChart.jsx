import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetJoiningHandoverCohortTrendQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconUserCheck, IconCalendar, IconRefresh, IconChevronDown } from "@tabler/icons-react";
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

// Falls back to the timeframe's default range when the visible inputs are left blank.
const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) {
        const defaults = getDefaultDates(timeframe);
        rawStart = rawStart || defaults.rawStart;
        rawEnd   = rawEnd   || defaults.rawEnd;
    }
    if (timeframe === 'monthly') {
        const [ey, em] = rawEnd.split('-').map(Number);
        const lastDay = new Date(ey, em, 0).getDate();
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
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

const EMPTY_ROW = { joinedCount: 0, handoverCount: 0, leftCount: 0 };

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
        const sy = Number(start.split('-')[0]);
        const ey = Number(end.split('-')[0]);
        for (let y = sy; y <= ey; y++) {
            const key = String(y);
            full.push(dataMap[key] ?? { ...EMPTY_ROW, period: key });
        }
    }
    return full;
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,            placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM' },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1, placeholder: 'YYYY' },
};

const aboveBarLabels = {
    enabled: true,
    formatter() { return this.y > 0 ? this.y : ''; },
    rotation: 0,
    allowOverlap: true,
    style: { fontSize: '15px', fontWeight: '900', color: '#1e293b', textOutline: '2px white' },
    verticalAlign: 'top',
    align: 'center',
    y: -22,
};

const basePlotOptions = {
    column: {
        borderRadius: 4,
        borderWidth: 0,
        groupPadding: 0.16,
        pointPadding: 0.06,
        maxPointWidth: 46,
    },
};

const JOINED_COLOR   = '#2563eb';
const HANDOVER_COLOR = '#16a34a';
const LEFT_COLOR     = '#ef4444';

const DailyJoiningHandoverCohortChart = ({ departments: departmentsProp } = {}) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart, setRawStart] = useState('');
    const [rawEnd, setRawEnd] = useState('');
    const [selectedDepts, setSelectedDepts] = useState([]);

    // Home.jsx already fetches the department list once and passes it down; only fall back
    // to a local (RTK-Query-cached) fetch when this chart is used standalone.
    const { data: deptsData } = useGetAllDepartmentsQuery(undefined, { skip: !!departmentsProp });
    const departments = departmentsProp ?? (deptsData?.data?.departments || []);

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data, isLoading, error } = useGetJoiningHandoverCohortTrendQuery({
        groupBy: timeframe,
        startDate,
        endDate,
        departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '',
    });

    const rawTrend = useMemo(() => data?.data?.trend || [], [data]);
    const summary  = data?.data?.summary || null;
    const groupBy  = data?.data?.groupBy || timeframe;
    const apiStart = data?.data?.start   || '';
    const apiEnd   = data?.data?.end     || '';

    const currentPeriodKey = useMemo(() => {
        const now = new Date();
        if (groupBy === 'daily') return formatDate(now);
        if (groupBy === 'monthly') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return String(now.getFullYear());
    }, [groupBy]);

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
            ? `<span style="color:#2563eb;font-size:16px;font-weight:900;text-decoration:underline">${label}</span>`
            : `<span style="color:#64748b;font-size:16px;font-weight:800">${label}</span>`;
    }), [trend, groupBy, language, currentPeriodKey]);

    // Dashed/dotted vertical separators between every date/month/year group so adjacent
    // periods' bar clusters read as visually distinct groups instead of blending together.
    const groupSeparators = useMemo(() => {
        if (categories.length <= 1) return [];
        const lines = [];
        for (let i = 0; i < categories.length - 1; i++) {
            lines.push({
                value: i + 0.5,
                width: 1,
                dashStyle: 'DashDot',
                color: '#cbd5e1',
                zIndex: 3,
            });
        }
        return lines;
    }, [categories.length]);

    const { joinedSeries, handoverSeries, leftSeries } = useMemo(() => {
        const joined = [];
        const handover = [];
        const left = [];
        for (const r of trend) {
            joined.push(Number(r.joinedCount) || 0);
            handover.push(Number(r.handoverCount) || 0);
            left.push(Number(r.leftCount) || 0);
        }
        return { joinedSeries: joined, handoverSeries: handover, leftSeries: left };
    }, [trend]);

    const totalJoined   = summary?.totalJoined   ?? joinedSeries.reduce((a, b) => a + b, 0);
    const totalHandover = summary?.totalHandover ?? handoverSeries.reduce((a, b) => a + b, 0);
    const totalLeft     = summary?.totalLeft     ?? leftSeries.reduce((a, b) => a + b, 0);
    const handoverRate  = summary?.handoverRate  ?? (totalJoined > 0 ? Math.round((totalHandover / totalJoined) * 1000) / 10 : 0);
    const attritionRate = summary?.attritionRate ?? (totalJoined > 0 ? Math.round((totalLeft / totalJoined) * 1000) / 10 : 0);
    const pendingHandover = summary?.pendingHandover ?? Math.max(0, totalJoined - totalHandover - totalLeft);

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
    };

    const toggleDept = (id, checked) =>
        setSelectedDepts(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (departments.find(d => String(d.id ?? d._id) === selectedDepts[0])?.name ?? '1 Dept')
            : `${selectedDepts.length} ${t('nav.departments')}`;

    const SLOT_WIDTH    = 150;
    const needsScroll   = categories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? categories.length * SLOT_WIDTH : undefined;

    const scrollPositionX = useMemo(() => {
        if (!needsScroll || todaySlotIdx === -1) return 1;
        const viewportWidth = 800;
        const targetPx = todaySlotIdx * SLOT_WIDTH;
        const maxScrollPx = (categories.length * SLOT_WIDTH) - viewportWidth;
        if (maxScrollPx <= 0) return 1;
        const centeredPx = targetPx - (viewportWidth / 2);
        return Math.max(0, Math.min(1, centeredPx / maxScrollPx));
    }, [needsScroll, todaySlotIdx, categories.length]);

    const cohortSeries = useMemo(() => [
        { type: 'column', name: t('charts.employeesJoined'),   data: joinedSeries,   color: JOINED_COLOR },
        { type: 'column', name: t('charts.handoverCompleted'), data: handoverSeries, color: HANDOVER_COLOR },
        { type: 'column', name: t('charts.employeesLeft'),     data: leftSeries,     color: LEFT_COLOR },
    ], [joinedSeries, handoverSeries, leftSeries, t]);

    const chartOptions = useMemo(() => ({
        chart: {
            backgroundColor: 'transparent',
            height: 420,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            marginBottom: needsScroll ? 100 : 65,
            ...(needsScroll && {
                scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX, opacity: 1 },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            plotLines: groupSeparators,
            labels: {
                useHTML: true,
                style: { fontSize: '16px', fontWeight: 'bold', textAlign: 'center' },
                rotation: 0,
                align: 'center',
                y: 26,
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Candidates', style: { color: '#94a3b8', fontSize: '15px', fontWeight: 'bold' } },
            labels: { style: { fontSize: '14px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: {
            enabled: true,
            margin: 34,
            itemStyle: { fontSize: '14px', fontWeight: 'bold', color: '#475569' },
        },
        responsive: {
            rules: [
                { condition: { minWidth: 768, maxWidth: 1024 }, chartOptions: { chart: { height: 500 } } },
                { condition: { maxWidth: 767 }, chartOptions: { chart: { height: 380 } } },
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
            formatter() {
                const points = this.points || [];
                const joined = points.find(p => p.series.name === t('charts.employeesJoined'))?.y || 0;
                const handover = points.find(p => p.series.name === t('charts.handoverCompleted'))?.y || 0;
                const left = points.find(p => p.series.name === t('charts.employeesLeft'))?.y || 0;
                const hRate = joined > 0 ? Math.round((handover / joined) * 1000) / 10 : 0;
                const lRate = joined > 0 ? Math.round((left / joined) * 1000) / 10 : 0;
                let html = `<b>${this.x}</b><br/>`;
                points.forEach(p => {
                    html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <b>${p.y}</b><br/>`;
                });
                html += `<hr style="margin:4px 0;border-color:#e2e8f0"/>`;
                html += `${t('charts.handoverRate')}: <b>${hRate}%</b><br/>`;
                html += `${t('charts.attritionRate')}: <b>${lRate}%</b>`;
                return html;
            },
        },
        series: cohortSeries,
    }), [categories, groupSeparators, cohortSeries, needsScroll, scrollMinWidth, scrollPositionX, t]);

    const cfg = INPUT_CONFIG[timeframe];
    const hasAnyData = totalJoined > 0 || totalHandover > 0 || totalLeft > 0;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconUserCheck className="h-5 w-5 text-blue-600" />
                            {t('charts.joiningHandoverCohortTrend')}
                        </CardTitle>
                        <CardDescription>
                            {t('charts.joiningHandoverCohortTrendDesc')}
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
                {isLoading ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 380 : 420 }} className="flex flex-col items-center justify-center gap-4">
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
                    <div style={{ height: isTablet ? 500 : isMobile ? 380 : 420 }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadCohortTrend')}</p>
                    </div>
                ) : !hasAnyData ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 380 : 420 }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noCohortData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
                        {/* Highcharts draws a semi-transparent mask over the fixed (non-scrolling)
                            strip that holds the y-axis when scrollablePlotArea is active; without
                            an opaque fill, scrolled-out bars show through it and appear to overlap
                            the "Candidates" axis title while scrolling horizontally. */}
                        <style>{`
                            .highcharts-scrollable-mask {
                                fill: #ffffff !important;
                                fill-opacity: 1 !important;
                                opacity: 1 !important;
                            }
                        `}</style>
                        <HighchartsReact
                            key={`${timeframe}-${startDate}-${endDate}-${selectedDepts.join(',')}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* KPI Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">{t('charts.totalJoined')}</span>
                                <span className="text-sm font-black text-blue-900">{totalJoined}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                                <span className="text-xs font-bold text-green-700">{t('charts.handoverRate')}</span>
                                <span className="text-sm font-black text-green-900">{handoverRate}%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                <span className="text-xs font-bold text-red-700">{t('charts.attritionRate')}</span>
                                <span className="text-sm font-black text-red-900">{attritionRate}%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50">
                                <span className="text-xs font-bold text-amber-700">{t('charts.pendingHandover')}</span>
                                <span className="text-sm font-black text-amber-900">{pendingHandover}</span>
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

export default React.memo(DailyJoiningHandoverCohortChart);
