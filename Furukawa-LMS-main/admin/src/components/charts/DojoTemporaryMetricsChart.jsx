import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDojoTemporaryMetricsTrendQuery, useGetDojoTemporaryStageSnapshotQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconUsers, IconCalendar, IconRefresh, IconChevronDown, IconChevronLeft, IconChevronRight, IconChartBar } from "@tabler/icons-react";
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
        // Last 29 days ending today — never reaches into the future. dojo_stage_history only
        // ever holds snapshots up to today, so a "this calendar month" range (which can run past
        // today mid-month) would ask for days that don't have — and can never get — real data.
        const past = new Date(now);
        past.setDate(past.getDate() - 29);
        return {
            rawStart: formatDate(past),
            rawEnd:   formatDate(now),
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

const EMPTY_ROW = { theoreticalCount: 0, practicalCount: 0, leftCount: 0, maleCount: 0, femaleCount: 0 };

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

// Validated (CVD-safe) — see scripts/validate_palette.js in the dataviz skill.
const THEORETICAL_COLOR = '#2563eb';
const PRACTICAL_COLOR   = '#f59e0b';
const LEFT_COLOR        = '#ef4444';
const MALE_COLOR        = '#6366f1';
const FEMALE_COLOR      = '#ec4899';

const SNAPSHOT_ZERO = {
    theoreticalCount: 0, practicalCount: 0, handoverCount: 0, leftCount: 0,
    theoreticalMale: 0, theoreticalFemale: 0, practicalMale: 0, practicalFemale: 0,
    handoverMale: 0, handoverFemale: 0, leftMale: 0, leftFemale: 0,
    maleCount: 0, femaleCount: 0,
};

const DojoTemporaryMetricsChart = ({ departments: departmentsProp } = {}) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [chartMode, setChartMode] = useState('trend'); // 'trend' | 'snapshot'
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart, setRawStart] = useState('');
    const [rawEnd, setRawEnd] = useState('');
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [viewMode, setViewMode] = useState('all');
    const [snapshotDate, setSnapshotDate] = useState('');

    // Home.jsx already fetches the department list once and passes it down; only fall back
    // to a local (RTK-Query-cached) fetch when this chart is used standalone.
    const { data: deptsData } = useGetAllDepartmentsQuery(undefined, { skip: !!departmentsProp });
    const departments = departmentsProp ?? (deptsData?.data?.departments || []);

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

    const { data, isLoading, error } = useGetDojoTemporaryMetricsTrendQuery({
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

    const { theoreticalSeries, practicalSeries, leftSeries, maleSeries, femaleSeries } = useMemo(() => {
        const theoretical = [];
        const practical = [];
        const left = [];
        const male = [];
        const female = [];
        for (const r of trend) {
            theoretical.push(Number(r.theoreticalCount) || 0);
            practical.push(Number(r.practicalCount) || 0);
            left.push(Number(r.leftCount) || 0);
            male.push(Number(r.maleCount) || 0);
            female.push(Number(r.femaleCount) || 0);
        }
        return { theoreticalSeries: theoretical, practicalSeries: practical, leftSeries: left, maleSeries: male, femaleSeries: female };
    }, [trend]);

    const totalTheoretical = summary?.totalTheoretical ?? theoreticalSeries.reduce((a, b) => a + b, 0);
    const totalLeft        = summary?.totalLeft ?? leftSeries.reduce((a, b) => a + b, 0);
    const currentPractical = summary?.currentPractical ?? (practicalSeries[practicalSeries.length - 1] || 0);
    const currentMale      = summary?.currentMale ?? (maleSeries[maleSeries.length - 1] || 0);
    const currentFemale    = summary?.currentFemale ?? (femaleSeries[femaleSeries.length - 1] || 0);
    const currentActive    = summary?.currentActive ?? (currentMale + currentFemale);
    const attritionRate    = summary?.attritionRate ?? (totalTheoretical > 0 ? Math.round((totalLeft / totalTheoretical) * 1000) / 10 : 0);

    // --- Snapshot mode: one date's Theoretical/Practical/Handover/Left x Male/Female breakdown ---
    const todayStr = useMemo(() => formatDate(new Date()), []);
    const effectiveSnapshotDate = snapshotDate || todayStr;

    const { data: snapshotData, isLoading: snapshotLoading, error: snapshotError } = useGetDojoTemporaryStageSnapshotQuery(
        { date: effectiveSnapshotDate, departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '' },
        { skip: chartMode !== 'snapshot' }
    );

    const snapshot = snapshotData?.data?.snapshot || SNAPSHOT_ZERO;

    const snapshotCategories = useMemo(() => [
        t('charts.theoretical'), t('charts.practical'), t('charts.handover'), t('charts.left'),
    ], [t]);

    const snapshotSeries = useMemo(() => [
        {
            type: 'column', name: t('charts.male'), color: MALE_COLOR,
            data: [snapshot.theoreticalMale, snapshot.practicalMale, snapshot.handoverMale, snapshot.leftMale],
        },
        {
            type: 'column', name: t('charts.female'), color: FEMALE_COLOR,
            data: [snapshot.theoreticalFemale, snapshot.practicalFemale, snapshot.handoverFemale, snapshot.leftFemale],
        },
    ], [snapshot, t]);

    const snapshotHasData = snapshot.theoreticalCount > 0 || snapshot.practicalCount > 0
        || snapshot.handoverCount > 0 || snapshot.leftCount > 0;

    const shiftSnapshotDate = (deltaDays) => {
        const d = new Date(`${effectiveSnapshotDate}T00:00:00`);
        d.setDate(d.getDate() + deltaDays);
        const next = formatDate(d);
        setSnapshotDate(next > todayStr ? todayStr : next);
    };

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
        setViewMode('all');
        setSnapshotDate('');
    };

    const toggleDept = (id, checked) =>
        setSelectedDepts(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (deptMap.get(String(selectedDepts[0])) ?? '1 Dept')
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

    const metricsSeries = useMemo(() => {
        const stage = [
            { type: 'column', name: t('charts.theoretical'), data: theoreticalSeries, color: THEORETICAL_COLOR },
            { type: 'column', name: t('charts.practical'),   data: practicalSeries,   color: PRACTICAL_COLOR },
            { type: 'column', name: t('charts.left'),        data: leftSeries,        color: LEFT_COLOR },
        ];
        const gender = [
            { type: 'column', name: t('charts.male'),   data: maleSeries,   color: MALE_COLOR },
            { type: 'column', name: t('charts.female'), data: femaleSeries, color: FEMALE_COLOR },
        ];
        if (viewMode === 'stage') return stage;
        if (viewMode === 'gender') return gender;
        return [...stage, ...gender];
    }, [viewMode, theoreticalSeries, practicalSeries, leftSeries, maleSeries, femaleSeries, t]);

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
                let html = `<b>${this.x}</b><br/>`;
                points.forEach(p => {
                    html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <b>${p.y}</b><br/>`;
                });
                return html;
            },
        },
        series: metricsSeries,
    }), [categories, groupSeparators, metricsSeries, needsScroll, scrollMinWidth, scrollPositionX]);

    const snapshotChartOptions = useMemo(() => ({
        chart: {
            backgroundColor: 'transparent',
            height: 420,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            marginBottom: 75,
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories: snapshotCategories,
            crosshair: true,
            labels: {
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
                let html = `<b>${this.x}</b><br/>`;
                points.forEach(p => {
                    html += `<span style="color:${p.series.color}">●</span> ${p.series.name}: <b>${p.y}</b><br/>`;
                });
                return html;
            },
        },
        series: snapshotSeries,
    }), [snapshotCategories, snapshotSeries]);

    const cfg = INPUT_CONFIG[timeframe];
    const hasAnyData = totalTheoretical > 0 || currentPractical > 0 || totalLeft > 0 || currentMale > 0 || currentFemale > 0;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconUsers className="h-5 w-5 text-blue-600" />
                            {chartMode === 'snapshot' ? t('charts.dojoStageGenderSnapshot') : t('charts.dojoTemporaryMetricsTrend')}
                        </CardTitle>
                        <CardDescription>
                            {chartMode === 'snapshot' ? t('charts.dojoStageGenderSnapshotDesc') : t('charts.dojoTemporaryMetricsTrendDesc')}
                        </CardDescription>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button
                            variant={chartMode === 'trend' ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => setChartMode('trend')}
                        >
                            <IconCalendar className="h-3.5 w-3.5 mr-1" />
                            {t('charts.trendMode')}
                        </Button>
                        <Button
                            variant={chartMode === 'snapshot' ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => setChartMode('snapshot')}
                        >
                            <IconChartBar className="h-3.5 w-3.5 mr-1" />
                            {t('charts.snapshotMode')}
                        </Button>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">

                    {chartMode === 'snapshot' ? (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                                {t('charts.selectedDate')}
                            </Label>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => shiftSnapshotDate(-1)}
                                    aria-label={t('charts.prevDay')}
                                >
                                    <IconChevronLeft className="h-4 w-4" />
                                </Button>
                                <Input
                                    type="date"
                                    value={effectiveSnapshotDate}
                                    max={todayStr}
                                    onChange={e => setSnapshotDate(e.target.value)}
                                    className="h-8 text-xs w-36"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => shiftSnapshotDate(1)}
                                    disabled={effectiveSnapshotDate >= todayStr}
                                    aria-label={t('charts.nextDay')}
                                >
                                    <IconChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ) : (
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
                    )}

                    {chartMode === 'trend' && (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.viewMode')}
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'all',    label: t('charts.allMetrics') },
                                { key: 'stage',  label: t('charts.byStage') },
                                { key: 'gender', label: t('charts.byGender') },
                            ].map(({ key, label }) => (
                                <Button
                                    key={key}
                                    variant={viewMode === key ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    onClick={() => setViewMode(key)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    )}

                    {chartMode === 'trend' && (
                    <>
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
                    </>
                    )}

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
                {chartMode === 'trend' ? (
                isLoading ? (
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
                        <p className="text-sm font-semibold">{t('charts.failedToLoadTemporaryMetrics')}</p>
                    </div>
                ) : !hasAnyData ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 380 : 420 }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noTemporaryMetricsData')}</p>
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
                            key={`${timeframe}-${startDate}-${endDate}-${selectedDepts.join(',')}-${viewMode}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* KPI Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">{t('charts.newJoiners')}</span>
                                <span className="text-sm font-black text-blue-900">{totalTheoretical}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50">
                                <span className="text-xs font-bold text-amber-700">{t('charts.currentlyActive')}</span>
                                <span className="text-sm font-black text-amber-900">{currentActive}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                <span className="text-xs font-bold text-red-700">{t('charts.attritionRate')}</span>
                                <span className="text-sm font-black text-red-900">{attritionRate}%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50">
                                <span className="text-xs font-bold text-indigo-700">{t('charts.male')}</span>
                                <span className="text-sm font-black text-indigo-900">{currentMale}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pink-50">
                                <span className="text-xs font-bold text-pink-700">{t('charts.female')}</span>
                                <span className="text-sm font-black text-pink-900">{currentFemale}</span>
                            </div>
                        </div>
                    </>
                )
                ) : (
                snapshotLoading ? (
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
                ) : snapshotError ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 380 : 420 }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadTemporaryMetrics')}</p>
                    </div>
                ) : !snapshotHasData ? (
                    <div style={{ height: isTablet ? 500 : isMobile ? 380 : 420 }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noTemporaryMetricsData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`snapshot-${effectiveSnapshotDate}-${selectedDepts.join(',')}`}
                            highcharts={Highcharts}
                            options={snapshotChartOptions}
                        />

                        {/* KPI Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">{t('charts.theoretical')}</span>
                                <span className="text-sm font-black text-blue-900">{snapshot.theoreticalCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50">
                                <span className="text-xs font-bold text-amber-700">{t('charts.practical')}</span>
                                <span className="text-sm font-black text-amber-900">{snapshot.practicalCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                                <span className="text-xs font-bold text-green-700">{t('charts.handover')}</span>
                                <span className="text-sm font-black text-green-900">{snapshot.handoverCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                <span className="text-xs font-bold text-red-700">{t('charts.left')}</span>
                                <span className="text-sm font-black text-red-900">{snapshot.leftCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50">
                                <span className="text-xs font-bold text-indigo-700">{t('charts.male')}</span>
                                <span className="text-sm font-black text-indigo-900">{snapshot.maleCount}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pink-50">
                                <span className="text-xs font-bold text-pink-700">{t('charts.female')}</span>
                                <span className="text-sm font-black text-pink-900">{snapshot.femaleCount}</span>
                            </div>
                        </div>
                    </>
                )
                )}
            </CardContent>
        </Card>
    );
};

export default React.memo(DojoTemporaryMetricsChart);
