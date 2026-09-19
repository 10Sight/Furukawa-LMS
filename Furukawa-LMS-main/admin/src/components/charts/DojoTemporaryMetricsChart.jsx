import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDojoTemporaryMetricsTrendQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconUsers, IconCalendar, IconRefresh, IconChevronDown, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
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

const formatMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const CURRENT_MONTH = formatMonthKey(new Date());
const MIN_MONTH     = '2020-01';

// 'YYYY-MM' shifted by `delta` months, clamped to [MIN_MONTH, CURRENT_MONTH] — no future months.
const shiftMonth = (monthKey, delta) => {
    const [y, m] = monthKey.split('-').map(Number);
    const next = formatMonthKey(new Date(y, m - 1 + delta, 1));
    if (next > CURRENT_MONTH) return CURRENT_MONTH;
    if (next < MIN_MONTH) return MIN_MONTH;
    return next;
};

const monthBounds = (monthKey) => {
    const [y, m] = monthKey.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { startDate: `${monthKey}-01`, endDate: `${monthKey}-${String(lastDay).padStart(2, '0')}` };
};

const localeMap = { en: 'en-US', hi: 'hi-IN', ja: 'ja-JP', zh: 'zh-CN', ru: 'ru-RU' };

// dd.MM.yy — the date format printed under each group (e.g. 15.09.26).
const formatDayLabel = (period) => {
    if (!period) return '';
    const [y, m, d] = period.split('-');
    return `${d}.${m}.${y.slice(2)}`;
};

const formatFullDate = (period, language = 'en') => {
    if (!period) return '';
    const locale = localeMap[language] || 'en-US';
    return new Date(`${period}T00:00:00`).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

const EMPTY_ROW = {
    theoreticalCount: 0, practicalCount: 0, handoverCount: 0, leftCount: 0,
    theoreticalMale: 0, theoreticalFemale: 0, practicalMale: 0, practicalFemale: 0,
    handoverMale: 0, handoverFemale: 0, leftMale: 0, leftFemale: 0,
    maleCount: 0, femaleCount: 0, totalActive: 0,
};

// Every day from `start` to `end` inclusive, zero-filled where the API returned no row.
const buildFullDays = (start, end, trend) => {
    if (!start || !end) return trend;
    const dataMap = {};
    trend.forEach(r => { dataMap[r.period] = r; });
    const full = [];
    const cur = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    while (cur <= last) {
        const key = formatDate(cur);
        full.push(dataMap[key] ?? { ...EMPTY_ROW, period: key });
        cur.setDate(cur.getDate() + 1);
    }
    return full;
};

// Male is always blue and Female always pink, in every stage.
const MALE_COLOR   = '#2563eb';
const FEMALE_COLOR = '#ec4899';
const STAGE_LABEL_COLOR = '#334155';

const STAGES = [
    { key: 'theoretical', labelKey: 'charts.theoretical' },
    { key: 'practical',   labelKey: 'charts.practical' },
    { key: 'handover',    labelKey: 'charts.handover' },
    { key: 'left',        labelKey: 'charts.left' },
];
const STAGE_COUNT = STAGES.length;

// Horizontal room per date: 4 stages x (Male + Female) = 8 bars, kept wide enough that every bar
// stays clearly visible instead of being squeezed as the month grows.
const DATE_SLOT_WIDTH  = 440;
const MIN_SCROLL_WIDTH = 800;
// Approximate visible plot width used to centre "today" in the scrolled viewport.
const VIEWPORT_WIDTH   = 800;

// Pixel rows (below the plot's bottom edge) for the 3-level axis: Male/Female, stage, date.
const GENDER_ROW_Y = 20;
const STAGE_ROW_Y  = 44;
const DATE_ROW_Y   = 74;
const LABEL_AREA   = 90;
const CHART_MARGIN_BOTTOM = LABEL_AREA + 26;

// Draws the multi-level x-axis (Male/Female under every bar, stage under each pair, date under
// each 4-stage group) plus the separators, straight onto the chart's renderer. Highcharts' core
// axis is flat, and these elements live in the scrolling SVG, so they move with the bars.
const drawGroupLabels = (chart, { trend, stageNames, maleLabel, femaleLabel, todayKey }) => {
    (chart.dojoLabelEls || []).forEach(el => el.destroy());
    const els = (chart.dojoLabelEls = []);
    const r = chart.renderer;
    const axis = chart.xAxis[0];
    const bottom = chart.plotTop + chart.plotHeight;
    const quarterSlot = axis.transA * 0.25;

    const text = (str, x, y, css) =>
        els.push(r.text(str, x, y).attr({ align: 'center', zIndex: 4 }).css(css).add());
    const line = (x, y1, y2, color, dash) =>
        els.push(r.path(['M', x, y1, 'L', x, y2]).attr({ stroke: color, 'stroke-width': 1, dashstyle: dash, zIndex: 3 }).add());

    const [maleSeries, femaleSeries] = chart.series;
    const barCenter = (series, idx, fallbackOffset) => {
        const sa = series?.points?.[idx]?.shapeArgs;
        return sa ? chart.plotLeft + sa.x + sa.width / 2 : axis.toPixels(idx) + fallbackOffset;
    };

    trend.forEach((row, d) => {
        const first = d * STAGE_COUNT;
        const isToday = row.period === todayKey;

        if (d > 0) line(axis.toPixels(first - 0.5), chart.plotTop, bottom + LABEL_AREA, '#cbd5e1', 'DashDot');

        STAGES.forEach((stage, s) => {
            const idx = first + s;
            if (s > 0) line(axis.toPixels(idx - 0.5), bottom, bottom + STAGE_ROW_Y + 10, '#e2e8f0', 'Dot');
            text(maleLabel,   barCenter(maleSeries,   idx, -quarterSlot), bottom + GENDER_ROW_Y, { fontSize: '12px', fontWeight: '600', color: '#64748b' });
            text(femaleLabel, barCenter(femaleSeries, idx,  quarterSlot), bottom + GENDER_ROW_Y, { fontSize: '12px', fontWeight: '600', color: '#64748b' });
            text(stageNames[s], axis.toPixels(idx), bottom + STAGE_ROW_Y, { fontSize: '14px', fontWeight: '800', color: STAGE_LABEL_COLOR });
        });

        text(formatDayLabel(row.period), axis.toPixels(first + (STAGE_COUNT - 1) / 2), bottom + DATE_ROW_Y, {
            fontSize: '15px',
            fontWeight: '900',
            color: isToday ? '#2563eb' : '#475569',
            textDecoration: isToday ? 'underline' : 'none',
        });
    });
};

// Full class names (not `bg-${tone}-50`) so Tailwind's JIT can see and emit them.
const KPI_TONES = {
    blue:   { box: 'bg-blue-50',   label: 'text-blue-700',   sub: 'text-blue-600',   value: 'text-blue-900' },
    amber:  { box: 'bg-amber-50',  label: 'text-amber-700',  sub: 'text-amber-600',  value: 'text-amber-900' },
    green:  { box: 'bg-green-50',  label: 'text-green-700',  sub: 'text-green-600',  value: 'text-green-900' },
    red:    { box: 'bg-red-50',    label: 'text-red-700',    sub: 'text-red-600',    value: 'text-red-900' },
    indigo: { box: 'bg-indigo-50', label: 'text-indigo-700', sub: 'text-indigo-600', value: 'text-indigo-900' },
    pink:   { box: 'bg-pink-50',   label: 'text-pink-700',   sub: 'text-pink-600',   value: 'text-pink-900' },
};

const KpiTile = ({ label, value, sub, tone }) => {
    const c = KPI_TONES[tone];
    return (
        <div className={`flex items-center justify-between gap-2 p-2.5 rounded-lg ${c.box}`}>
            <div className="min-w-0">
                <span className={`block text-xs font-bold truncate ${c.label}`}>{label}</span>
                {sub && <span className={`block text-[10px] font-semibold opacity-80 ${c.sub}`}>{sub}</span>}
            </div>
            <span className={`text-sm font-black ${c.value}`}>{value}</span>
        </div>
    );
};

const DojoTemporaryMetricsChart = ({ departments: departmentsProp } = {}) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [month, setMonth] = useState(CURRENT_MONTH);
    const [selectedDepts, setSelectedDepts] = useState([]);

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

    const { startDate, endDate } = useMemo(() => monthBounds(month), [month]);
    const isCurrentMonth = month === CURRENT_MONTH;
    const deptParam = selectedDepts.length > 0 ? selectedDepts.join(',') : '';

    const { data, isLoading, error } = useGetDojoTemporaryMetricsTrendQuery({
        groupBy: 'daily',
        startDate,
        endDate,
        departmentId: deptParam,
    });

    const rawTrend = useMemo(() => data?.data?.trend || [], [data]);
    const summary  = data?.data?.summary || null;
    const apiStart = data?.data?.start   || '';
    const apiEnd   = data?.data?.end     || '';

    // The API clamps the range to today, so for the current month this ends today rather than
    // padding future days that can never hold real snapshot data.
    const trend = useMemo(() => buildFullDays(apiStart, apiEnd, rawTrend), [apiStart, apiEnd, rawTrend]);

    const todayKey = useMemo(() => formatDate(new Date()), []);
    const todaySlotIdx = useMemo(() => trend.findIndex(r => r.period === todayKey), [trend, todayKey]);

    // One category per (date, stage) — 4 per date — with a Male and a Female column in each.
    const categories = useMemo(
        () => trend.flatMap(() => STAGES.map(s => t(s.labelKey))),
        [trend, t]
    );

    const series = useMemo(() => {
        const build = (gender) => trend.flatMap(row =>
            STAGES.map(s => Number(row[`${s.key}${gender}`]) || 0)
        );
        return [
            { type: 'column', name: t('charts.male'),   data: build('Male'),   color: MALE_COLOR },
            { type: 'column', name: t('charts.female'), data: build('Female'), color: FEMALE_COLOR },
        ];
    }, [trend, t]);

    const scrollMinWidth = Math.max(MIN_SCROLL_WIDTH, trend.length * DATE_SLOT_WIDTH);
    const needsScroll = trend.length * DATE_SLOT_WIDTH > MIN_SCROLL_WIDTH;

    // Auto-scroll so today sits mid-viewport in the current month; other months open at day 1.
    const scrollPositionX = useMemo(() => {
        if (!needsScroll || !isCurrentMonth || todaySlotIdx === -1) return 0;
        const maxScrollPx = scrollMinWidth - VIEWPORT_WIDTH;
        if (maxScrollPx <= 0) return 0;
        const centeredPx = (todaySlotIdx + 0.5) * DATE_SLOT_WIDTH - VIEWPORT_WIDTH / 2;
        return Math.max(0, Math.min(1, centeredPx / maxScrollPx));
    }, [needsScroll, isCurrentMonth, todaySlotIdx, scrollMinWidth]);

    const totalTheoretical = summary?.totalTheoretical ?? 0;
    const totalHandover    = summary?.totalHandover ?? 0;
    const totalLeft        = summary?.totalLeft ?? 0;
    const currentPractical = summary?.currentPractical ?? 0;
    const currentMale      = summary?.currentMale ?? 0;
    const currentFemale    = summary?.currentFemale ?? 0;
    const attritionRate    = summary?.attritionRate ?? 0;

    const chartOptions = useMemo(() => {
        const stageNames = STAGES.map(s => t(s.labelKey));
        const labelCtx = { trend, stageNames, maleLabel: t('charts.male'), femaleLabel: t('charts.female'), todayKey };

        return {
            chart: {
                backgroundColor: 'transparent',
                height: 480,
                style: { fontFamily: 'inherit' },
                animation: { duration: 400 },
                marginBottom: CHART_MARGIN_BOTTOM,
                events: {
                    render() { drawGroupLabels(this, labelCtx); },
                },
                ...(needsScroll && {
                    scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX, opacity: 1 },
                }),
            },
            title: { text: '' },
            credits: { enabled: false },
            legend: { enabled: false },
            xAxis: {
                categories,
                crosshair: true,
                // The Male/Female, stage and date labels are drawn by drawGroupLabels.
                labels: { enabled: false },
                tickLength: 0,
                lineColor: '#cbd5e1',
            },
            yAxis: {
                min: 0,
                allowDecimals: false,
                title: { text: t('charts.candidates'), style: { color: '#94a3b8', fontSize: '15px', fontWeight: 'bold' } },
                labels: { style: { fontSize: '14px', fontWeight: 'bold' } },
                gridLineColor: '#f1f5f9',
            },
            responsive: {
                rules: [
                    { condition: { minWidth: 768, maxWidth: 1024 }, chartOptions: { chart: { height: 520 } } },
                    { condition: { maxWidth: 767 }, chartOptions: { chart: { height: 460 } } },
                ],
            },
            plotOptions: {
                column: {
                    borderRadius: 4,
                    borderWidth: 0,
                    groupPadding: 0.06,
                    pointPadding: 0.03,
                    maxPointWidth: 48,
                    dataLabels: {
                        enabled: true,
                        formatter() { return this.y > 0 ? this.y : ''; },
                        rotation: 0,
                        allowOverlap: true,
                        style: { fontSize: '13px', fontWeight: '900', color: '#1e293b', textOutline: '2px white' },
                        verticalAlign: 'top',
                        align: 'center',
                        y: -20,
                    },
                },
            },
            tooltip: {
                shared: true,
                useHTML: true,
                formatter() {
                    const idx = this.points?.[0]?.point?.index;
                    const row = trend[Math.floor(idx / STAGE_COUNT)];
                    if (!row) return false;
                    const line = (color, label, total, m, f) =>
                        `<span style="color:${color}">●</span> ${label}: <b>${total}</b> <span style="color:#64748b">(${t('charts.male')} ${m} · ${t('charts.female')} ${f})</span><br/>`;
                    return `<b>${formatFullDate(row.period, language)}</b><br/>`
                        + STAGES.map(s => line(STAGE_LABEL_COLOR, t(s.labelKey), row[`${s.key}Count`], row[`${s.key}Male`], row[`${s.key}Female`])).join('')
                        + `<span style="color:#64748b">${t('charts.activeRoster')}: ${t('charts.male')} <b>${row.maleCount}</b> · ${t('charts.female')} <b>${row.femaleCount}</b></span>`;
                },
            },
            series,
        };
    }, [categories, series, needsScroll, scrollMinWidth, scrollPositionX, trend, todayKey, t, language]);

    const toggleDept = (id, checked) =>
        setSelectedDepts(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    const handleReset = () => {
        setMonth(CURRENT_MONTH);
        setSelectedDepts([]);
    };

    const handleMonthInput = (value) => {
        // A cleared/partial <input type="month"> emits ''; keep the current month instead of querying garbage.
        if (!/^\d{4}-\d{2}$/.test(value)) return;
        setMonth(value > CURRENT_MONTH ? CURRENT_MONTH : value < MIN_MONTH ? MIN_MONTH : value);
    };

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (deptMap.get(String(selectedDepts[0])) ?? '1 Dept')
            : `${selectedDepts.length} ${t('nav.departments')}`;

    const hasAnyData = totalTheoretical > 0 || totalHandover > 0 || totalLeft > 0
        || currentPractical > 0 || currentMale > 0 || currentFemale > 0;

    const placeholderHeight = isTablet ? 520 : isMobile ? 460 : 480;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconUsers className="h-5 w-5 text-blue-600" />
                        {t('charts.dojoMonthlySnapshot')}
                    </CardTitle>
                    <CardDescription>{t('charts.dojoMonthlySnapshotDesc')}</CardDescription>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.selectedMonth')}
                        </Label>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setMonth(m => shiftMonth(m, -1))}
                                disabled={month <= MIN_MONTH}
                                aria-label={t('charts.prevMonth')}
                            >
                                <IconChevronLeft className="h-4 w-4" />
                            </Button>
                            <Input
                                type="month"
                                value={month}
                                min={MIN_MONTH}
                                max={CURRENT_MONTH}
                                onChange={e => handleMonthInput(e.target.value)}
                                className="h-8 text-xs w-36"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setMonth(m => shiftMonth(m, 1))}
                                disabled={isCurrentMonth}
                                aria-label={t('charts.nextMonth')}
                            >
                                <IconChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
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
                    <div style={{ height: placeholderHeight }} className="flex flex-col items-center justify-center gap-4">
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
                    <div style={{ height: placeholderHeight }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadTemporaryMetrics')}</p>
                    </div>
                ) : !hasAnyData ? (
                    <div style={{ height: placeholderHeight }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
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
                            key={`${month}-${deptParam}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* KPI Summary strip — flows (joiners/handover/left) sum the month; Practical/Male/Female are the month's latest stock. */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <KpiTile tone="blue"   label={t('charts.newJoiners')}       value={totalTheoretical} />
                            <KpiTile tone="amber"  label={t('charts.practicalActive')}  value={currentPractical} />
                            <KpiTile tone="green"  label={t('charts.handoverApproved')} value={totalHandover} />
                            <KpiTile tone="red"    label={t('charts.left')}             value={totalLeft} sub={`${attritionRate}% ${t('charts.attritionRate')}`} />
                            <KpiTile tone="indigo" label={t('charts.male')}             value={currentMale} />
                            <KpiTile tone="pink"   label={t('charts.female')}           value={currentFemale} />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default React.memo(DojoTemporaryMetricsChart);
