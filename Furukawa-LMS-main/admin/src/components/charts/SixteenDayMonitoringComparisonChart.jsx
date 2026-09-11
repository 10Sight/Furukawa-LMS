import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetSixteenDayMonitoringStatusQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconClipboardCheck, IconCalendar, IconRefresh, IconChevronDown } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import useTranslate from "@/hooks/useTranslate";
import { useIsTablet, useIsMobile } from "@/hooks/useIsTablet";
import { useDebounce } from "@/hooks/useDebounce";

// Formats a Date using local calendar fields, avoiding the UTC day-shift toISOString() causes in IST.
const formatDate = (date) => {
    if (!date || isNaN(date)) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const _now = new Date();
const CURRENT_YEAR = _now.getFullYear();
const MONTH_END = formatDate(new Date(_now.getFullYear(), _now.getMonth() + 1, 0));

// Daily view uses one category slot per day, so an unbounded range can blow up the column
// count. Cap it client-side.
const MAX_DAILY_RANGE_DAYS = 90;

const addDays = (isoDate, days) => {
    if (!isoDate) return '';
    const d = new Date(`${isoDate}T00:00:00`);
    d.setDate(d.getDate() + days);
    return formatDate(d);
};

// Default under-the-hood date range per timeframe, used when the visible inputs are left blank.
const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            rawStart: formatDate(firstOfMonth),
            rawEnd: formatDate(now),
        };
    }
    if (timeframe === 'monthly') {
        const past = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        return {
            rawStart: `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`,
            rawEnd: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        };
    }
    return {
        rawStart: String(now.getFullYear() - 4),
        rawEnd: String(now.getFullYear()),
    };
};

// Falls back to the timeframe's default range when the visible inputs are left blank.
const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) {
        const defaults = getDefaultDates(timeframe);
        rawStart = rawStart || defaults.rawStart;
        rawEnd = rawEnd || defaults.rawEnd;
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

const INPUT_CONFIG = {
    daily: { type: 'date', min: '2020-01-01', max: MONTH_END, placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month', min: '2020-01', max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM' },
    yearly: { type: 'number', min: 2020, max: CURRENT_YEAR, step: 1, placeholder: 'YYYY' },
};

// Minimum pixel width per bar — the slot width for each category (period) scales with the
// number of department/section series so bars don't get squeezed thinner as more are added.
const BAR_WIDTH = 26;

// One color per department/section series, cycled if there are more series than colors.
const PALETTE = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#ef4444',
    '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#f43f5e',
];

const SixteenDayMonitoringComparisonChart = ({ departments: departmentsProp } = {}) => {
    const { t, language } = useTranslate();
    const isTablet = useIsTablet();
    const isMobile = useIsMobile();
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart, setRawStart] = useState('');
    const [rawEnd, setRawEnd] = useState('');
    const [selectedDepts, setSelectedDepts] = useState([]);
    const [showDetails, setShowDetails] = useState(false);

    // Debounce manual date-input edits so each keystroke doesn't fire its own request + chart
    // remount — the <Input> stays bound to the raw state so typing itself never feels laggy.
    const debouncedRawStart = useDebounce(rawStart, 400);
    const debouncedRawEnd = useDebounce(rawEnd, 400);

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
        () => toApiDates(timeframe, debouncedRawStart, debouncedRawEnd),
        [timeframe, debouncedRawStart, debouncedRawEnd]
    );

    const { data, isLoading, error } = useGetSixteenDayMonitoringStatusQuery({
        groupBy: timeframe,
        startDate,
        endDate,
        departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '',
    });

    // Already period-sorted and zero-filled for every period in [start, end] by the backend.
    const trend = data?.data?.trend || [];
    const seriesKeys = data?.data?.seriesKeys || [];
    const groupBy = data?.data?.groupBy || timeframe;

    // Current period key (in the same format as `period` values) so today's slot can be
    // located and highlighted/scrolled-to regardless of the active timeframe.
    const currentPeriodKey = useMemo(() => {
        const now = new Date();
        if (groupBy === 'daily') return formatDate(now);
        if (groupBy === 'monthly') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return String(now.getFullYear());
    }, [groupBy]);

    // Flatten the (period × department) matrix into one column per combination, covering every
    // date in range (month start through today) and every department — including 0-filled days,
    // which render as an explicit "0" rather than being dropped. Each bar carries its own
    // department label directly on the X-axis instead of relying on a legend to disambiguate
    // stacked/grouped series; the date itself is shown once, centered under each group of
    // department columns, via a plotBand label rather than repeated per bar.
    const { flatCategories, flatData, dateGroups } = useMemo(() => {
        const cats = [];
        const data = [];
        const groups = [];
        let idx = 0;
        trend.forEach(r => {
            const dateLabel = formatPeriodLabel(r.period, groupBy, language);
            const isToday = r.period === currentPeriodKey;
            const start = idx;
            const keysPresent = seriesKeys.filter(sk => (Number(r[sk.key]) || 0) > 0);
            if (keysPresent.length === 0) {
                cats.push('');
                data.push({ y: null, custom: { deptName: '', dateLabel, period: r.period } });
                groups.push({ period: r.period, dateLabel, isToday, start: idx, end: idx });
                idx += 1;
            } else {
                keysPresent.forEach(sk => {
                    const y = Number(r[sk.key]) || 0;
                    cats.push(`<span style="color:#1e293b;font-weight:800;font-size:14px">${sk.name}</span>`);
                    data.push({ y, custom: { deptName: sk.name, dateLabel, period: r.period } });
                    idx += 1;
                });
                groups.push({ period: r.period, dateLabel, isToday, start, end: idx - 1 });
            }
        });
        return { flatCategories: cats, flatData: data, dateGroups: groups };
    }, [trend, seriesKeys, groupBy, language, currentPeriodKey]);

    // Dashed vertical rules between (not around) date groups, so adjacent dates read as
    // visually distinct clusters of department columns.
    const groupPlotLines = useMemo(() => dateGroups.slice(1).map(g => ({
        value: g.start - 0.5,
        color: '#cbd5e1',
        width: 1,
        dashStyle: 'Dash',
        zIndex: 3,
    })), [dateGroups]);

    // Single centered date label per group, rendered via a transparent plotBand rather than
    // repeating the date under every department column.
    const groupPlotBands = useMemo(() => dateGroups.map(g => ({
        from: g.start - 0.5,
        to: g.end + 0.5,
        color: 'transparent',
        label: {
            useHTML: true,
            text: g.isToday
                ? `<span style="color:#2563eb;font-weight:900;font-size:14px;text-decoration:underline">${g.dateLabel}</span>`
                : `<span style="color:#64748b;font-weight:800;font-size:14px">${g.dateLabel}</span>`,
            align: 'center',
            verticalAlign: 'bottom',
            y: 58,
        },
    })), [dateGroups]);

    const series = useMemo(() => [{
        type: 'column',
        name: t('charts.filledDays'),
        data: flatData,
        color: PALETTE[0],
    }], [flatData, t]);

    const seriesTotals = useMemo(() => {
        const totals = {};
        seriesKeys.forEach(sk => {
            totals[sk.key] = trend.reduce((sum, r) => sum + (Number(r[sk.key]) || 0), 0);
        });
        return totals;
    }, [seriesKeys, trend]);

    const totalFilledDays = useMemo(
        () => Object.values(seriesTotals).reduce((a, b) => a + b, 0),
        [seriesTotals]
    );
    const hasAnyData = totalFilledDays > 0;

    // First flattened column belonging to today's period, used to auto-scroll/center the view.
    const todaySlotIdx = flatData.findIndex(d => d.custom.period === currentPeriodKey);

    // With one column per (period, department) combination, a static slot width is enough —
    // there's no longer a risk of bars getting squeezed as more series are added.
    const SLOT_WIDTH = 80;
    const needsScroll = flatCategories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? flatCategories.length * SLOT_WIDTH : undefined;

    // Center the scrollable viewport on today's slot when possible; otherwise default to
    // the right edge (most recent data), matching prior behavior.
    const scrollPositionX = useMemo(() => {
        if (!needsScroll || todaySlotIdx === -1) return 1;
        const viewportWidth = 800;
        const targetPx = todaySlotIdx * SLOT_WIDTH;
        const maxScrollPx = (flatCategories.length * SLOT_WIDTH) - viewportWidth;
        if (maxScrollPx <= 0) return 1;
        const centeredPx = targetPx - (viewportWidth / 2);
        return Math.max(0, Math.min(1, centeredPx / maxScrollPx));
    }, [needsScroll, todaySlotIdx, flatCategories.length, SLOT_WIDTH]);

    const chartOptions = useMemo(() => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 420,
            marginBottom: needsScroll ? 120 : 95,
            marginTop: 60,
            style: { fontFamily: 'inherit' },
            // Filtering/timeframe changes remount the whole chart anyway (see the `key` prop
            // below), so animating each redraw only adds latency without a visual payoff.
            animation: false,
            ...(needsScroll && {
                scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX, opacity: 1 },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories: flatCategories,
            crosshair: true,
            lineWidth: 1,
            lineColor: '#e9ecef',
            labels: {
                useHTML: true,
                rotation: 0,
                align: 'center',
                y: 22,
                style: { textAlign: 'center' },
            },
            gridLineWidth: 0,
            plotLines: groupPlotLines,
            plotBands: groupPlotBands,
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: t('charts.filledDays'), style: { color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' } },
            labels: { style: { fontSize: '13px', fontWeight: 'bold' } },
            gridLineColor: '#f1f5f9',
        },
        legend: {
            enabled: false,
        },
        tooltip: {
            shared: false,
            useHTML: true,
            formatter() {
                const { deptName, dateLabel } = this.point?.custom || {};
                if (this.y === null || this.y === undefined) {
                    return `${dateLabel || ''}: ${t('charts.noData')}`;
                }
                return `<b style="font-size:14px;color:#0f172a">${deptName || ''}</b><br/>${dateLabel || ''}<br/><span style="color:${this.point.color}">●</span> ${t('charts.filledDays')}: <b>${this.y}</b>`;
            },
        },
        plotOptions: {
            column: {
                animation: false,
                borderRadius: 4,
                borderWidth: 0,
                pointPadding: 0.05,
                groupPadding: 0.15,
                maxPointWidth: BAR_WIDTH,
                dataLabels: {
                    enabled: true,
                    formatter() { return (this.y === null || this.y === undefined || this.y === 0) ? '' : String(this.y); },
                    style: { fontSize: '12px', fontWeight: '900', color: '#1e293b', textOutline: '1px white' },
                    verticalAlign: 'top',
                    align: 'center',
                    y: -16,
                    allowOverlap: true,
                },
            },
        },
        responsive: {
            rules: [
                { condition: { minWidth: 768, maxWidth: 1024 }, chartOptions: { chart: { height: 480 } } },
                { condition: { maxWidth: 767 }, chartOptions: { chart: { height: 340 } } },
            ],
        },
        series,
    }), [flatCategories, groupPlotLines, groupPlotBands, series, needsScroll, scrollMinWidth, scrollPositionX, t]);

    const cfg = INPUT_CONFIG[timeframe];

    // Bound the daily-view range on both ends so a manual pick can't explode the category count.
    const fromMax = rawEnd || String(cfg.max);
    const fromMin = timeframe === 'daily' && rawEnd
        ? (addDays(rawEnd, -(MAX_DAILY_RANGE_DAYS - 1)) > String(cfg.min) ? addDays(rawEnd, -(MAX_DAILY_RANGE_DAYS - 1)) : String(cfg.min))
        : String(cfg.min);
    const toMin = rawStart || String(cfg.min);
    const toMax = timeframe === 'daily' && rawStart
        ? (addDays(rawStart, MAX_DAILY_RANGE_DAYS - 1) < String(cfg.max) ? addDays(rawStart, MAX_DAILY_RANGE_DAYS - 1) : String(cfg.max))
        : String(cfg.max);

    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (deptMap.get(String(selectedDepts[0])) ?? '1 Dept')
            : `${selectedDepts.length} ${t('nav.departments')}`;

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

    const emptyStateHeight = isTablet ? 500 : isMobile ? 400 : 420;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconClipboardCheck className="h-5 w-5 text-blue-600" />
                        {t('charts.sixteenDayMonitoringComparison')}
                    </CardTitle>
                    <CardDescription>
                        {t('charts.sixteenDayMonitoringComparisonDesc')}
                    </CardDescription>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.timeframe')}
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'daily', label: t('charts.daily30d') },
                                { key: 'monthly', label: t('charts.monthly12m') },
                                { key: 'yearly', label: t('charts.yearly5y') },
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
                            min={fromMin}
                            max={fromMax}
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
                            min={toMin}
                            max={toMax}
                            step={cfg.step}
                            placeholder={cfg.placeholder}
                            className="h-8 text-xs w-36"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {t('charts.targetDepartment')}
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
                    <div style={{ height: emptyStateHeight }} className="flex flex-col items-center justify-center gap-4">
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
                    <div style={{ height: emptyStateHeight }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadSixteenDay')}</p>
                    </div>
                ) : !hasAnyData ? (
                    <div style={{ height: emptyStateHeight }} className="flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{t('charts.noSixteenDayData')}</p>
                        <p className="text-xs opacity-60">{t('charts.adjustFilters')}</p>
                    </div>
                ) : (
                    <>
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

                        {/* Summary strip */}
                        <div className="mt-5">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 mb-3">
                                <span className="text-xs font-bold text-blue-700">{t('charts.totalFilledDays')}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-blue-900">{totalFilledDays}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[11px] text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                        onClick={() => setShowDetails(prev => !prev)}
                                    >
                                        {showDetails ? t('charts.hideDetails') : t('charts.showDetails')}
                                        <IconChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                                    </Button>
                                </div>
                            </div>
                            {showDetails && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {seriesKeys.map(sk => (
                                        <div key={sk.key} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50">
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 truncate" title={sk.name}>
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[0] }} />
                                                {sk.name}
                                            </span>
                                            <span className="text-sm font-black text-slate-800 shrink-0">{seriesTotals[sk.key] || 0}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default SixteenDayMonitoringComparisonChart;
