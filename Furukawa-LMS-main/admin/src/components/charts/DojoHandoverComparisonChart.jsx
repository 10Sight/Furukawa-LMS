import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDojoHandoverComparisonQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { IconArrowsTransferDown, IconCalendar, IconRefresh, IconChevronDown } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const _now = new Date();
const CURRENT_YEAR = _now.getFullYear();
const MONTH_END = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().split('T')[0];

const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) return { startDate: '', endDate: '' };
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

const formatPeriodLabel = (period, groupBy) => {
    if (!period) return '';
    if (groupBy === 'yearly') return period;
    if (groupBy === 'daily') {
        return new Date(`${period}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    }
    const [year, month] = period.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const EMPTY_ROW = { expected: 0, actual: 0 };

const DEPT_COLORS = [
    '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
    '#84cc16', '#f97316', '#6366f1', '#ef4444', '#14b8a6',
    '#a855f7', '#eab308', '#0ea5e9', '#f43f5e', '#22c55e',
];

const ACTUAL_COLOR = '#3b82f6';

const buildFullPeriods = (groupBy, start, end) => {
    if (!start || !end) return [];
    const full = [];
    if (groupBy === 'daily') {
        const cur = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            full.push(cur.toISOString().split('T')[0]);
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm] = start.split('-').map(Number);
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

const buildFullSeries = (groupBy, start, end, trend) => {
    if (!start || !end) return trend;
    const dataMap = {};
    trend.forEach(r => { dataMap[r.period] = r; });
    return buildFullPeriods(groupBy, start, end).map(key => dataMap[key] ?? { ...EMPTY_ROW, period: key });
};

const INPUT_CONFIG = {
    daily: { type: 'date', min: '2020-01-01', max: MONTH_END, placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month', min: '2020-01', max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM' },
    yearly: { type: 'number', min: 2020, max: CURRENT_YEAR, step: 1, placeholder: 'YYYY' },
};

const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            rawStart: firstOfMonth.toISOString().split('T')[0],
            rawEnd: lastOfMonth.toISOString().split('T')[0],
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

const DojoHandoverComparisonChart = () => {
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart, setRawStart] = useState(() => getDefaultDates('daily').rawStart);
    const [rawEnd, setRawEnd] = useState(() => getDefaultDates('daily').rawEnd);
    const [selectedDepts, setSelectedDepts] = useState([]);

    const { data: deptsData } = useGetAllDepartmentsQuery();
    const departments = deptsData?.data?.departments || [];

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data, isLoading, error } = useGetDojoHandoverComparisonQuery({
        groupBy: timeframe,
        startDate,
        endDate,
        departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '',
    });

    const rawTrend = data?.data?.trend || [];
    const deptBreakdown = data?.data?.deptBreakdown || [];
    const groupBy = data?.data?.groupBy || timeframe;
    const apiStart = data?.data?.start || '';
    const apiEnd = data?.data?.end || '';

    const trend = useMemo(
        () => buildFullSeries(groupBy, apiStart, apiEnd, rawTrend),
        [groupBy, apiStart, apiEnd, rawTrend]
    );
    const totalActual = trend.reduce((a, r) => a + (Number(r.actual) || 0), 0);
    const totalExpected = trend.reduce((a, r) => a + (Number(r.expected) || 0), 0);
    const achievementRate = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

    const fullPeriods = useMemo(
        () => buildFullPeriods(groupBy, apiStart, apiEnd),
        [groupBy, apiStart, apiEnd]
    );

    // Two-series approach (Expected vs Actual):
    // For each date, we display each department as a single category slot,
    // and within that category slot, Highcharts renders 2 bars (Expected and Actual) side-by-side.
    // The date label is shown once per group under the middle department.
    const { expectedPoints, actualPoints, categories, groupSeparators } = useMemo(() => {
        if (!deptBreakdown.length || !fullPeriods.length)
            return { expectedPoints: [], actualPoints: [], categories: [], groupSeparators: [] };

        // Build lookup maps
        const deptDataMap = {};
        const orderedDeptIds = [];
        deptBreakdown.forEach(r => {
            if (!deptDataMap[r.deptId]) {
                deptDataMap[r.deptId] = {};
                orderedDeptIds.push(r.deptId);
            }
            deptDataMap[r.deptId][r.period] = {
                expected: Number(r.expected) || 0,
                actual: Number(r.actual) || 0,
            };
        });

        const deptNameMap = {};
        orderedDeptIds.forEach((deptId) => {
            deptNameMap[deptId] = departments.find(d => String(d.id ?? d._id) === deptId)?.name ?? `Dept ${deptId}`;
        });

        const expectedPoints = [];
        const actualPoints = [];
        const categories = [];
        const groupSeparators = [];
        let currentIdx = 0;

        fullPeriods.forEach(period => {
            const periodLabel = formatPeriodLabel(period, groupBy);
            const deptsPresent = orderedDeptIds.filter(id => {
                const v = deptDataMap[id]?.[period];
                return v && (v.expected > 0 || v.actual > 0);
            });

            if (!deptsPresent.length) {
                // Empty slot to represent the date without any department data
                categories.push(`<span style="color:#94a3b8;font-size:11px;font-weight:600">${periodLabel}</span>`);
                expectedPoints.push({
                    y: null,
                    deptName: '',
                    periodLabel,
                    isExpected: true,
                    isEmpty: true,
                });
                actualPoints.push({
                    y: null,
                    deptName: '',
                    periodLabel,
                    isExpected: false,
                    isEmpty: true,
                });
                currentIdx++;
                return;
            }

            const N = deptsPresent.length;
            const midIdx = Math.floor((N - 1) / 2);

            deptsPresent.forEach((deptId, idx) => {
                const deptName = deptNameMap[deptId];
                const vals = deptDataMap[deptId][period];
                const isDateSlot = idx === midIdx;

                // Department label
                const topHtml = deptName
                    .split(' ')
                    .map(w => `<span style="color:#475569;font-weight:700;font-size:11px;line-height:1.6">${w}</span>`)
                    .join('<br/>');

                const dateLine = isDateSlot
                    ? `<br/><span style="color:#64748b;font-size:13px;font-weight:800;display:inline-block;margin-top:8px">${periodLabel}</span>`
                    : `<br/><span style="visibility:hidden;font-size:13px;display:inline-block;margin-top:8px">${periodLabel}</span>`;

                categories.push(topHtml + dateLine);

                expectedPoints.push({
                    y: vals.expected > 0 ? vals.expected : null,
                    deptName,
                    periodLabel,
                    isExpected: true,
                    isEmpty: false,
                });

                actualPoints.push({
                    y: vals.actual > 0 ? vals.actual : null,
                    deptName,
                    periodLabel,
                    isExpected: false,
                    isEmpty: false,
                });

                currentIdx++;
            });

            // Dash separator after each period group, except the last one
            if (period !== fullPeriods[fullPeriods.length - 1]) {
                groupSeparators.push({
                    value: currentIdx - 0.5,
                    width: 1,
                    dashStyle: 'Dash',
                    color: '#cbd5e1',
                    zIndex: 3,
                });
            }
        });

        return { expectedPoints, actualPoints, categories, groupSeparators };
    }, [deptBreakdown, fullPeriods, groupBy, departments]);

    const SLOT_WIDTH = 120; // 120px slot width to fit two bars nicely
    const needsScroll = categories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? categories.length * SLOT_WIDTH : undefined;

    const hasAnyData = totalExpected > 0 || totalActual > 0;

    const chartOptions = {
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 560,
            marginBottom: 170,
            marginTop: 60,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            ...(needsScroll && {
                scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX: 1, opacity: 1 },
            }),
        },
        title: { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            lineWidth: 1,
            lineColor: '#e9ecef',
            labels: {
                useHTML: true,
                rotation: 0,
                align: 'center',
                style: { textAlign: 'center', lineHeight: '1.6' },
            },
            gridLineWidth: 0,
            plotLines: groupSeparators,
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Candidates', style: { color: '#94a3b8', fontSize: '13px' } },
            labels: { style: { fontSize: '13px' } },
            gridLineColor: '#f1f5f9',
        },
        legend: {
            enabled: true,
            align: 'right',
            verticalAlign: 'top',
            layout: 'horizontal',
            floating: true,
            y: -15,
            itemStyle: {
                fontSize: '12px',
                fontWeight: '600',
                color: '#475569'
            }
        },
        tooltip: {
            useHTML: true,
            style: { fontSize: '13px' },
            formatter() {
                if (!this.point.deptName) return `<b>${this.point.periodLabel}</b>: No data`;
                return (
                    `<span style="color:${this.series.color}">●</span> ` +
                    `<b>${this.point.deptName}</b> — ${this.point.isExpected ? 'Expected' : 'Actual'}<br/>` +
                    `Date: <b>${this.point.periodLabel}</b><br/>` +
                    `Count: <b>${this.y}</b>`
                );
            },
        },
        plotOptions: {
            column: {
                colorByPoint: false,
                borderRadius: 5,
                borderWidth: 0,
                pointPadding: 0.1,
                groupPadding: 0.2,
                maxPointWidth: 40,
                dataLabels: {
                    enabled: true,
                    formatter() { return this.y > 0 ? String(this.y) : ''; },
                    style: { fontSize: '13px', fontWeight: 'bold', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align: 'center',
                    y: -20,
                    allowOverlap: true,
                },
            },
        },
        series: [
            {
                type: 'column',
                name: 'Expected Handover',
                data: expectedPoints,
                color: '#8b5cf6', // Violet/Purple for Expected
            },
            {
                type: 'column',
                name: 'Actual Handover',
                data: actualPoints,
                color: '#3b82f6', // Blue for Actual
            }
        ],
    };

    const cfg = INPUT_CONFIG[timeframe];
    const deptLabel = selectedDepts.length === 0
        ? 'All Departments'
        : selectedDepts.length === 1
            ? (departments.find(d => String(d.id ?? d._id) === selectedDepts[0])?.name ?? '1 Dept')
            : `${selectedDepts.length} Departments`;

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
    };

    const toggleDept = (id, checked) =>
        setSelectedDepts(prev => checked ? [...prev, id] : prev.filter(x => x !== id));

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconArrowsTransferDown className="h-5 w-5 text-blue-600" />
                            Dojo Handover Comparison
                        </CardTitle>
                        <CardDescription>
                            Expected vs Actual handover counts by date — grouped by target department
                        </CardDescription>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Timeframe
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'daily', label: 'Daily (30d)' },
                                { key: 'monthly', label: 'Monthly (12m)' },
                                { key: 'yearly', label: 'Yearly (5y)' },
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
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">From</Label>
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
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">To</Label>
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
                            Target Department
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
                                        Clear selection
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
                        Reset
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="h-[560px] flex flex-col items-center justify-center gap-4">
                        <img
                            src="/fme_transparent.png"
                            alt="FME"
                            className="w-20 h-20 object-contain animate-pulse"
                        />
                        <p className="text-xs font-bold tracking-widest uppercase text-slate-400 animate-pulse">
                            Loading
                        </p>
                    </div>
                ) : error ? (
                    <div className="h-[560px] flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">Failed to load handover comparison.</p>
                    </div>
                ) : !hasAnyData ? (
                    <div className="h-[560px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">No handover data found for this period.</p>
                        <p className="text-xs opacity-60">Try adjusting the timeframe or filters above.</p>
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
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-600">Total Expected</span>
                                <span className="text-sm font-black text-slate-800">{totalExpected}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">Total Actual</span>
                                <span className="text-sm font-black text-blue-900">{totalActual}</span>
                            </div>
                            <div className={`flex items-center justify-between p-2.5 rounded-lg ${achievementRate >= 100 ? 'bg-green-50' : 'bg-amber-50'}`}>
                                <span className={`text-xs font-bold ${achievementRate >= 100 ? 'text-green-600' : 'text-amber-600'}`}>Achievement</span>
                                <span className={`text-sm font-black ${achievementRate >= 100 ? 'text-green-900' : 'text-amber-900'}`}>{achievementRate}%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">
                                    {timeframe === 'daily' ? 'Days' : timeframe === 'monthly' ? 'Months' : 'Years'} Tracked
                                </span>
                                <span className="text-sm font-black text-slate-800">{fullPeriods.length}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default DojoHandoverComparisonChart;
