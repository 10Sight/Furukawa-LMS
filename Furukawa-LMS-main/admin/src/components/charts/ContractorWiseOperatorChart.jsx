import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetTemporaryUsersQuery } from '@/Redux/AllApi/UserApi';
import { useGetAllContractorsQuery } from '@/Redux/AllApi/ContractorApi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconBuilding, IconCalendar, IconRefresh } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const _now         = new Date();
const CURRENT_YEAR = _now.getFullYear();
const MONTH_END    = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).toISOString().split('T')[0];

const CONTRACTOR_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#ef4444',
    '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#f43f5e',
];

const toApiDates = (timeframe, rawStart, rawEnd) => {
    if (!rawStart || !rawEnd) return { startDate: '', endDate: '' };
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

const getPeriodKey = (dateStr, groupBy) => {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d)) return null;
    if (groupBy === 'yearly')  return String(d.getFullYear());
    if (groupBy === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return dateStr.substring(0, 10);
};

const buildPeriodList = (groupBy, start, end) => {
    if (!start || !end) return [];
    const periods = [];
    if (groupBy === 'daily') {
        const cur  = new Date(`${start}T00:00:00`);
        const last = new Date(`${end}T00:00:00`);
        while (cur <= last) {
            periods.push(cur.toISOString().split('T')[0]);
            cur.setDate(cur.getDate() + 1);
        }
    } else if (groupBy === 'monthly') {
        let [sy, sm]  = start.split('-').map(Number);
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
    return periods;
};

const INPUT_CONFIG = {
    daily:   { type: 'date',   min: '2020-01-01', max: MONTH_END,            placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month',  min: '2020-01',    max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM'    },
    yearly:  { type: 'number', min: 2020,         max: CURRENT_YEAR, step: 1, placeholder: 'YYYY'      },
};

const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { rawStart: first.toISOString().split('T')[0], rawEnd: last.toISOString().split('T')[0] };
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

const ContractorWiseOperatorChart = () => {
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart,  setRawStart]  = useState(() => getDefaultDates('daily').rawStart);
    const [rawEnd,    setRawEnd]    = useState(() => getDefaultDates('daily').rawEnd);

    const { data: usersData, isLoading, error } = useGetTemporaryUsersQuery({ limit: 9999 });
    const { data: contractorsData } = useGetAllContractorsQuery();
    const allUsers = usersData?.data?.users || [];

    // id → name lookup so contractorId-only users still resolve correctly
    const contractorIdToName = useMemo(() => {
        const map = {};
        (contractorsData?.data || []).forEach(c => { map[String(c.id)] = c.name; });
        return map;
    }, [contractorsData]);

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { periods, contractorNames, flatPoints } = useMemo(() => {
        if (!allUsers.length || !startDate || !endDate)
            return { periods: [], contractorNames: [], flatPoints: [] };

        const start = new Date(`${startDate}T00:00:00`);
        const end   = new Date(`${endDate}T23:59:59`);

        const filtered = allUsers.filter(u => {
            if (!u.joiningDate) return false;
            const jd = new Date(`${String(u.joiningDate).substring(0, 10)}T00:00:00`);
            return jd >= start && jd <= end;
        });

        const periods = buildPeriodList(timeframe, startDate, endDate);

        const resolveName = (u) =>
            u.contractor?.trim() ||
            (u.contractorId ? contractorIdToName[String(u.contractorId)] : null) ||
            'No Contractor';

        // Collect unique contractor names in order of first appearance
        const contractorMap = new Map();
        filtered.forEach(u => {
            const name = resolveName(u);
            if (!contractorMap.has(name)) contractorMap.set(name, contractorMap.size);
        });
        const contractorNames = [...contractorMap.keys()];

        // period → contractorName → count
        const matrix = {};
        filtered.forEach(u => {
            const key  = getPeriodKey(String(u.joiningDate).substring(0, 10), timeframe);
            if (!key) return;
            const name = resolveName(u);
            if (!matrix[key]) matrix[key] = {};
            matrix[key][name] = (matrix[key][name] || 0) + 1;
        });

        // Flat list: one entry per (period × contractor) that has count > 0
        // Each point carries its own color so bars are visually distinct per contractor
        const flatPoints = [];
        periods.forEach(period => {
            const periodLabel = formatPeriodLabel(period, timeframe);
            contractorNames.forEach((name, ci) => {
                const count = matrix[period]?.[name] || 0;
                if (count > 0) {
                    flatPoints.push({
                        y:           count,
                        color:       CONTRACTOR_COLORS[ci % CONTRACTOR_COLORS.length],
                        contractor:  name,
                        periodLabel,
                    });
                }
            });
        });

        return { periods, contractorNames, flatPoints };
    }, [allUsers, contractorIdToName, timeframe, startDate, endDate]);

    const totalOperators = flatPoints.reduce((sum, p) => sum + p.y, 0);

    const contractorTotals = {};
    flatPoints.forEach(p => {
        contractorTotals[p.contractor] = (contractorTotals[p.contractor] || 0) + p.y;
    });
    const topContractor = Object.entries(contractorTotals).reduce(
        (best, [name, sum]) => sum > (best?.sum || 0) ? { name, sum } : best,
        null
    );

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
    };

    // Each bar gets its own x-axis slot; two-line HTML label: contractor name (colored) + date
    const flatCategories = flatPoints.map(p => {
        const nameHtml = p.contractor.split(' ').join('<br/>');
        return (
            `<span style="font-weight:700;font-size:13px;color:${p.color}">${nameHtml}</span>` +
            `<br/><span style="font-size:12px;color:#64748b">${p.periodLabel}</span>`
        );
    });

    const SLOT_WIDTH     = 96;
    const needsScroll    = flatPoints.length * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? flatPoints.length * SLOT_WIDTH : undefined;

    const chartOptions = {
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 460,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            marginBottom: 130,
            ...(needsScroll && { scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX: 1 } }),
        },
        title:   { text: '' },
        credits: { enabled: false },
        xAxis: {
            categories: flatCategories,
            crosshair:  true,
            labels: {
                useHTML:  true,
                rotation: 0,
                align:    'center',
                style:    { lineHeight: '1.4' },
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Operators', style: { color: '#94a3b8', fontSize: '14px' } },
            labels: { style: { fontSize: '13px' } },
            gridLineColor: '#f1f5f9',
        },
        legend: { enabled: false },
        tooltip: {
            useHTML: true,
            style:   { fontSize: '14px' },
            formatter() {
                return (
                    `<span style="color:${this.point.color}">●</span> ` +
                    `<b>${this.point.contractor}</b><br/>` +
                    `Date: <b>${this.point.periodLabel}</b><br/>` +
                    `Operators: <b>${this.y}</b>`
                );
            },
        },
        plotOptions: {
            column: {
                colorByPoint:   true,
                borderRadius:   5,
                borderWidth:    0,
                pointPadding:   0.06,
                groupPadding:   0,
                maxPointWidth:  80,
                dataLabels: {
                    enabled: true,
                    formatter() { return this.y > 0 ? this.y : ''; },
                    style: {
                        fontSize:    '14px',
                        fontWeight:  'bold',
                        color:       '#1e293b',
                        textOutline: '2px white',
                    },
                    verticalAlign: 'top',
                    align:         'center',
                    y:             -24,
                    allowOverlap:  true,
                },
            },
        },
        series: [{
            type: 'column',
            name: 'Operators',
            data: flatPoints,
            showInLegend: false,
        }],
    };

    const cfg        = INPUT_CONFIG[timeframe];
    const hasAnyData = flatPoints.length > 0;

    return (
        <Card className="col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconBuilding className="h-5 w-5 text-blue-600" />
                            Contractor Wise Operators
                        </CardTitle>
                        <CardDescription>
                            Operators joined per contractor — grouped by joining date
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
                                { key: 'daily',   label: 'Daily (30d)'   },
                                { key: 'monthly', label: 'Monthly (12m)' },
                                { key: 'yearly',  label: 'Yearly (5y)'   },
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
                    <div className="h-[460px] flex flex-col items-center justify-center gap-4">
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
                    <div className="h-[460px] flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">Failed to load contractor data.</p>
                    </div>
                ) : !hasAnyData ? (
                    <div className="h-[460px] flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border border-dashed gap-2">
                        <IconCalendar className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">No operator joining data for this period.</p>
                        <p className="text-xs opacity-60">Try adjusting the timeframe or date range above.</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${timeframe}-${startDate}-${endDate}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">Total Joined</span>
                                <span className="text-sm font-black text-blue-900">{totalOperators}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-600">Contractors</span>
                                <span className="text-sm font-black text-slate-800">{contractorNames.length}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50">
                                <span className="text-xs font-bold text-emerald-700 truncate pr-1">Top Contractor</span>
                                <span className="text-xs font-black text-emerald-900 truncate max-w-[80px]" title={topContractor?.name}>
                                    {topContractor?.name ?? '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">
                                    {timeframe === 'daily' ? 'Days' : timeframe === 'monthly' ? 'Months' : 'Years'} Tracked
                                </span>
                                <span className="text-sm font-black text-slate-800">{periods.length}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default ContractorWiseOperatorChart;
