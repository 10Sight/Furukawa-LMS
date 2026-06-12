import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAdminHomeTestPaperStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    IconCertificate,
    IconCalendar,
    IconRefresh,
    IconClipboardCheck,
    IconChartBar,
} from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const _now        = new Date();
const CURRENT_YEAR = _now.getFullYear();
const MONTH_END    = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().split('T')[0];

const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) return { startDate: '', endDate: '' };
    if (timeframe === 'monthly') {
        const [ey, em] = rawEnd.split('-').map(Number);
        const lastDay  = new Date(ey, em, 0).getDate();
        return {
            startDate: `${rawStart}-01`,
            endDate:   `${rawEnd}-${String(lastDay).padStart(2, '0')}`,
        };
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
    return new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const EMPTY_TYPE   = { theoretical: 0, practical: 0 };
const EMPTY_RESULT = { passedTheoretical: 0, failedTheoretical: 0, passedPractical: 0, failedPractical: 0 };

const buildFullSeries = (groupBy, start, end, typeData, resultData) => {
    if (!start || !end) return { periods: [], typeRows: typeData, resultRows: resultData };

    const typeMap   = {};
    const resultMap = {};
    typeData.forEach(r   => { typeMap[r.period]   = r; });
    resultData.forEach(r => { resultMap[r.period] = r; });

    const periods = [];

    if (groupBy === 'daily') {
        const cur  = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            const key = cur.toISOString().split('T')[0];
            periods.push(key);
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm]   = start.split('-').map(Number);
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

    return {
        periods,
        typeRows:   periods.map(p => typeMap[p]   ?? { ...EMPTY_TYPE,   period: p }),
        resultRows: periods.map(p => resultMap[p] ?? { ...EMPTY_RESULT, period: p }),
    };
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,              placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`,   placeholder: 'YYYY-MM'    },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1,  placeholder: 'YYYY'       },
};

const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            rawStart: first.toISOString().split('T')[0],
            rawEnd:   last.toISOString().split('T')[0],
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

const TestPaperPassChart = () => {
    const [timeframe,      setTimeframe]      = useState('daily');
    const [rawStart,       setRawStart]       = useState(() => getDefaultDates('daily').rawStart);
    const [rawEnd,         setRawEnd]         = useState(() => getDefaultDates('daily').rawEnd);
    const [departmentId,   setDepartmentId]   = useState('all');
    const [isDojo,         setIsDojo]         = useState('all');
    const [testTypeFilter, setTestTypeFilter] = useState('all');

    const { data: deptsData } = useGetAllDepartmentsQuery();
    const departments = deptsData?.data?.departments || [];

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data: statsData, isLoading, error } = useGetAdminHomeTestPaperStatsQuery({
        startDate,
        endDate,
        groupBy:      timeframe,
        departmentId: departmentId === 'all' ? '' : departmentId,
        isDojo:       isDojo       === 'all' ? '' : isDojo,
    });

    const rawTrendByType   = statsData?.data?.trendByType   || [];
    const rawTrendByResult = statsData?.data?.trendByResult || [];
    const passFailRaw      = statsData?.data?.passFailData  || [];
    const groupBy          = statsData?.data?.groupBy       || timeframe;
    const apiStart         = statsData?.data?.start         || '';
    const apiEnd           = statsData?.data?.end           || '';

    const { periods, typeRows, resultRows } = useMemo(
        () => buildFullSeries(groupBy, apiStart, apiEnd, rawTrendByType, rawTrendByResult),
        [groupBy, apiStart, apiEnd, rawTrendByType, rawTrendByResult]
    );

    const categories       = periods.map(p => formatPeriodLabel(p, groupBy));
    const theoreticalSeries = typeRows.map(r => Number(r.theoretical) || 0);
    const practicalSeries   = typeRows.map(r => Number(r.practical)   || 0);

    const passedSeries = resultRows.map(r => {
        if (testTypeFilter === 'Theoretical') return Number(r.passedTheoretical) || 0;
        if (testTypeFilter === 'Practical')   return Number(r.passedPractical)   || 0;
        return (Number(r.passedTheoretical) || 0) + (Number(r.passedPractical) || 0);
    });
    const failedSeries = resultRows.map(r => {
        if (testTypeFilter === 'Theoretical') return Number(r.failedTheoretical) || 0;
        if (testTypeFilter === 'Practical')   return Number(r.failedPractical)   || 0;
        return (Number(r.failedTheoretical) || 0) + (Number(r.failedPractical) || 0);
    });

    const grandTotalType   = theoreticalSeries.reduce((a, b) => a + b, 0) + practicalSeries.reduce((a, b) => a + b, 0);
    const totalPassedChart = passedSeries.reduce((a, b) => a + b, 0);
    const totalFailedChart = failedSeries.reduce((a, b) => a + b, 0);
    const grandTotalResult = totalPassedChart + totalFailedChart;

    // Overall aggregated totals for the footer (unaffected by testTypeFilter)
    const totalPassedAll = passFailRaw.filter(r => r.status === 'Passed').reduce((a, b) => a + b.value, 0);
    const totalFailedAll = passFailRaw.filter(r => r.status === 'Failed').reduce((a, b) => a + b.value, 0);

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
        setDepartmentId('all');
        setIsDojo('all');
        setTestTypeFilter('all');
    };

    // Scrollable plot area — each slot ~72px; start viewport at rightmost (most recent)
    const SLOT_WIDTH    = 72;
    const needsScroll   = categories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? categories.length * SLOT_WIDTH : undefined;

    const baseChart = {
        chart: {
            backgroundColor: 'transparent',
            height: 320,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            ...(needsScroll && {
                scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX: 1 },
            }),
        },
        title:   { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories,
            crosshair: true,
            labels: { style: { fontSize: '11px', color: '#64748b' }, rotation: 0, align: 'center' },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Tests', style: { color: '#94a3b8', fontSize: '11px' } },
            gridLineColor: '#f1f5f9',
        },
    };

    const aboveBarLabels = {
        enabled: true,
        formatter() { return this.y > 0 ? this.y : ''; },
        allowOverlap: true,
        style: { fontSize: '10px', fontWeight: 'bold', color: '#1e293b', textOutline: '2px white' },
        verticalAlign: 'top',
        align: 'center',
        y: -18,
    };

    const insideSegmentLabels = {
        enabled: true,
        formatter() { return this.y > 0 ? this.y : ''; },
        allowOverlap: true,
        style: { fontSize: '10px', fontWeight: 'bold', color: '#ffffff', textOutline: 'none' },
        verticalAlign: 'middle',
        align: 'center',
        inside: true,
    };

    const getTypeChartOptions = () => ({
        ...baseChart,
        legend: { enabled: true },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0,
                groupPadding: 0.2,
                maxPointWidth: 36,
                dataLabels: aboveBarLabels,
            },
        },
        tooltip: {
            shared: true,
            useHTML: true,
            pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}</b><br/>',
        },
        series: [
            { type: 'column', name: 'Theoretical', data: theoreticalSeries, color: '#3b82f6' },
            { type: 'column', name: 'Practical',   data: practicalSeries,   color: '#f97316' },
        ],
    });

    const getResultChartOptions = () => ({
        ...baseChart,
        legend: { enabled: true },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0,
                groupPadding: 0.2,
                maxPointWidth: 36,
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
            { type: 'column', name: 'Passed', data: passedSeries, color: '#10b981' },
            { type: 'column', name: 'Failed', data: failedSeries, color: '#ef4444' },
        ],
    });

    const cfg = INPUT_CONFIG[timeframe];

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconCertificate className="h-5 w-5 text-blue-600" />
                            Comprehensive Test Analytics
                        </CardTitle>
                        <CardDescription>
                            Date-wise distribution of tests taken and pass/fail performance
                        </CardDescription>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">
                    {/* Timeframe */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Timeframe
                        </Label>
                        <div className="flex gap-1">
                            {[
                                { key: 'daily',   label: 'Daily'   },
                                { key: 'monthly', label: 'Monthly' },
                                { key: 'yearly',  label: 'Yearly'  },
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

                    {/* From */}
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

                    {/* To */}
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

                    {/* Department */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Department</Label>
                        <Select value={departmentId} onValueChange={setDepartmentId}>
                            <SelectTrigger className="h-8 w-44 text-xs">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(dept => (
                                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Worker Type */}
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Worker Type</Label>
                        <Select value={isDojo} onValueChange={setIsDojo}>
                            <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue placeholder="All Types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="false">Operator</SelectItem>
                                <SelectItem value="true">Dojo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reset */}
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

            <CardContent className="space-y-10">
                {isLoading ? (
                    <div className="h-[360px] flex flex-col items-center justify-center gap-4">
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
                    <div className="h-[360px] flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">Failed to load test paper statistics.</p>
                    </div>
                ) : (
                    <>
                        {/* Chart 1 — Test Type Distribution */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                    <IconChartBar className="h-4 w-4 text-blue-500" />
                                    Test Type Distribution
                                </h3>
                                <span className="text-xs text-slate-500 bg-slate-100 rounded px-2 py-0.5">
                                    Total: {grandTotalType}
                                </span>
                            </div>

                            {grandTotalType > 0 ? (
                                <>
                                    <HighchartsReact
                                        key={`type-${timeframe}-${startDate}-${endDate}-${departmentId}-${isDojo}`}
                                        highcharts={Highcharts}
                                        options={getTypeChartOptions()}
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                            <span className="text-xs font-bold text-blue-700">Theoretical</span>
                                            <span className="text-sm font-black text-blue-900">
                                                {theoreticalSeries.reduce((a, b) => a + b, 0)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50">
                                            <span className="text-xs font-bold text-orange-700">Practical</span>
                                            <span className="text-sm font-black text-orange-900">
                                                {practicalSeries.reduce((a, b) => a + b, 0)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-[280px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                                    <IconCalendar className="h-10 w-10 opacity-20" />
                                    <p className="text-sm font-medium">No test data found for this period.</p>
                                    <p className="text-xs opacity-60">Try adjusting the timeframe or filters above.</p>
                                </div>
                            )}
                        </div>

                        {/* Chart 2 — Pass / Fail */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                                    <IconClipboardCheck className="h-4 w-4 text-green-500" />
                                    Result Performance
                                </h3>
                                <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                                    <SelectTrigger className="h-7 w-[130px] text-xs bg-white">
                                        <SelectValue placeholder="All Tests" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Tests</SelectItem>
                                        <SelectItem value="Theoretical">Theoretical</SelectItem>
                                        <SelectItem value="Practical">Practical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {grandTotalResult > 0 ? (
                                <>
                                    <HighchartsReact
                                        key={`result-${timeframe}-${startDate}-${endDate}-${departmentId}-${isDojo}-${testTypeFilter}`}
                                        highcharts={Highcharts}
                                        options={getResultChartOptions()}
                                    />
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                                            <span className="text-xs font-bold text-green-700">Passed</span>
                                            <span className="text-sm font-black text-green-900">{totalPassedChart}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                            <span className="text-xs font-bold text-red-700">Failed</span>
                                            <span className="text-sm font-black text-red-900">{totalFailedChart}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                            <span className="text-xs font-bold text-slate-600">Pass Rate</span>
                                            <span className="text-sm font-black text-slate-800">
                                                {grandTotalResult > 0
                                                    ? `${Math.round((totalPassedChart / grandTotalResult) * 100)}%`
                                                    : '—'}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="h-[280px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                                    <IconCalendar className="h-10 w-10 opacity-20" />
                                    <p className="text-sm font-medium">No result data for this selection.</p>
                                    <p className="text-xs opacity-60">Try changing the test type filter or date range.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default TestPaperPassChart;
