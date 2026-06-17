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
    IconRefresh,
    IconClipboardCheck,
    IconSchool,
} from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const _now         = new Date();
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

const EMPTY_RESULT = { passedTheoretical: 0, failedTheoretical: 0, passedPractical: 0, failedPractical: 0 };

const buildFullSeries = (groupBy, start, end, resultData) => {
    if (!start || !end) return { periods: [], resultRows: resultData };

    const resultMap = {};
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
        resultRows: periods.map(p => resultMap[p] ?? { ...EMPTY_RESULT, period: p }),
    };
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,             placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`,  placeholder: 'YYYY-MM'    },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1, placeholder: 'YYYY'       },
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

/* ── Reusable sub-chart ── */
const PassFailChart = ({ title, icon: Icon, iconColor, passedSeries, failedSeries, categories, chartKey, needsScroll, scrollMinWidth }) => {
    const totalPassed   = passedSeries.reduce((a, b) => a + b, 0);
    const totalFailed   = failedSeries.reduce((a, b) => a + b, 0);
    const totalAttempts = totalPassed + totalFailed;
    const passRate      = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;

    const options = {
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 320,
            marginTop: 50,
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
            crosshair:     true,
            lineWidth:     1,
            lineColor:     '#e9ecef',
            gridLineWidth: 0,
            labels: {
                style:    { fontSize: '11px', color: '#64748b' },
                rotation: 0,
                align:    'center',
            },
        },
        yAxis: {
            min:           0,
            allowDecimals: false,
            title:         { text: 'Attempts', style: { color: '#94a3b8', fontSize: '11px' } },
            gridLineColor: '#f1f5f9',
            labels:        { style: { fontSize: '11px' } },
        },
        legend: {
            enabled:      true,
            itemStyle:    { fontSize: '13px', fontWeight: '600', color: '#374151' },
            symbolRadius: 3,
            symbolHeight: 12,
            symbolWidth:  12,
        },
        tooltip: {
            shared:  true,
            useHTML: true,
            formatter() {
                const p = this.points;
                const passed = p.find(x => x.series.name === 'Passed')?.y ?? 0;
                const failed = p.find(x => x.series.name === 'Failed')?.y ?? 0;
                return (
                    `<b style="color:#0f172a">${this.x}</b><br/>` +
                    `<span style="color:#16a34a">●</span> Passed: <b>${passed}</b><br/>` +
                    `<span style="color:#dc2626">●</span> Failed: <b>${failed}</b><br/>` +
                    `<span style="color:#6b7280">Total: <b style="color:#0f172a">${passed + failed}</b></span>`
                );
            },
        },
        plotOptions: {
            column: {
                borderRadius:  4,
                borderWidth:   0,
                groupPadding:  0.2,
                maxPointWidth: 40,
                dataLabels: {
                    enabled:      true,
                    formatter()   { return this.y > 0 ? String(this.y) : ''; },
                    allowOverlap: true,
                    style:        { fontSize: '11px', fontWeight: 'bold', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align:         'center',
                    y:             -18,
                },
            },
        },
        series: [
            { type: 'column', name: 'Passed', data: passedSeries, color: '#16a34a' },
            { type: 'column', name: 'Failed', data: failedSeries, color: '#dc2626' },
        ],
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
            </div>

            <HighchartsReact key={chartKey} highcharts={Highcharts} options={options} />

            <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                    <span className="text-xs font-bold text-green-700">Passed</span>
                    <span className="text-sm font-black text-green-900">{totalPassed}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                    <span className="text-xs font-bold text-red-700">Failed</span>
                    <span className="text-sm font-black text-red-900">{totalFailed}</span>
                </div>
                <div className={`flex items-center justify-between p-2.5 rounded-lg ${passRate >= 70 ? 'bg-green-50' : 'bg-amber-50'}`}>
                    <span className={`text-xs font-bold ${passRate >= 70 ? 'text-green-600' : 'text-amber-600'}`}>Pass Rate</span>
                    <span className={`text-sm font-black ${passRate >= 70 ? 'text-green-900' : 'text-amber-900'}`}>{passRate > 0 ? `${passRate}%` : '—'}</span>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════ */

const TestPaperPassChart = () => {
    const [timeframe,    setTimeframe]    = useState('daily');
    const [rawStart,     setRawStart]     = useState(() => getDefaultDates('daily').rawStart);
    const [rawEnd,       setRawEnd]       = useState(() => getDefaultDates('daily').rawEnd);
    const [departmentId, setDepartmentId] = useState('all');
    const [isDojo,       setIsDojo]       = useState('all');

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

    const rawTrendByResult = statsData?.data?.trendByResult || [];
    const groupBy          = statsData?.data?.groupBy       || timeframe;
    const apiStart         = statsData?.data?.start         || '';
    const apiEnd           = statsData?.data?.end           || '';

    const { periods, resultRows } = useMemo(
        () => buildFullSeries(groupBy, apiStart, apiEnd, rawTrendByResult),
        [groupBy, apiStart, apiEnd, rawTrendByResult]
    );

    const categories = periods.map(p => formatPeriodLabel(p, groupBy));

    const theoreticalPassedSeries = resultRows.map(r => Number(r.passedTheoretical) || 0);
    const theoreticalFailedSeries = resultRows.map(r => Number(r.failedTheoretical) || 0);
    const practicalPassedSeries   = resultRows.map(r => Number(r.passedPractical)   || 0);
    const practicalFailedSeries   = resultRows.map(r => Number(r.failedPractical)   || 0);

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
    };

    const SLOT_WIDTH     = 72;
    const needsScroll    = categories.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? categories.length * SLOT_WIDTH : undefined;

    const cfg = INPUT_CONFIG[timeframe];
    const chartKeyBase = `${timeframe}-${startDate}-${endDate}-${departmentId}-${isDojo}`;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconCertificate className="h-5 w-5 text-blue-600" />
                            DOJO Candidates Test Analytics
                        </CardTitle>
                        <CardDescription>
                            Date-wise pass / fail performance for Theoretical and Practical tests
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
                        <PassFailChart
                            title="Theoretical Test Performance"
                            icon={IconSchool}
                            iconColor="text-blue-500"
                            passedSeries={theoreticalPassedSeries}
                            failedSeries={theoreticalFailedSeries}
                            categories={categories}
                            chartKey={`theoretical-${chartKeyBase}`}
                            needsScroll={needsScroll}
                            scrollMinWidth={scrollMinWidth}
                        />

                        <div className="border-t border-slate-100" />

                        <PassFailChart
                            title="Practical Test Performance"
                            icon={IconClipboardCheck}
                            iconColor="text-orange-500"
                            passedSeries={practicalPassedSeries}
                            failedSeries={practicalFailedSeries}
                            categories={categories}
                            chartKey={`practical-${chartKeyBase}`}
                            needsScroll={needsScroll}
                            scrollMinWidth={scrollMinWidth}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default TestPaperPassChart;
