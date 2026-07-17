import React, { useState, useEffect, useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useGetDepartmentQuizStatsQuery } from '@/Redux/AllApi/AnalyticsApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { IconChartBar, IconRefresh, IconCalendar, IconX } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import 'highcharts/modules/no-data-to-display';
import useTranslate from "@/hooks/useTranslate";
import { useIsTablet } from "@/hooks/useIsTablet";

const PASS_COLOR = '#16a34a';
const FAIL_COLOR = '#dc2626';

/* ── Filter Select helper ── */
const FilterSelect = ({ label, placeholder, value, onChange, items, disabled, allLabel }) => {
    const { t } = useTranslate();
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</Label>
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-xs">{allLabel || t('charts.all')}</SelectItem>
                    {(items || []).map(item => {
                        const itemId = String(item.id || item._id || '');
                        return (
                            <SelectItem key={itemId} value={itemId} className="text-xs">
                                {item.name}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════ */

const formatDateLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Default under-the-hood date range (current month), used when both inputs are left blank.
const getDefaultDateRange = () => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: formatDateLocal(firstOfMonth), endDate: formatDateLocal(lastOfMonth) };
};

const DepartmentQuizChart = ({ dateRange }) => {
    const { t } = useTranslate();
    const isTablet = useIsTablet();
    const [filters, setFilters] = useState({ departmentId: '', sectionId: '' });
    const [startDate, setStartDate] = useState(dateRange?.startDate || '');
    const [endDate, setEndDate]     = useState(dateRange?.endDate || '');

    /* ── Sync local date range with the parent-provided dashboard filter ── */
    useEffect(() => {
        setStartDate(dateRange?.startDate || '');
        setEndDate(dateRange?.endDate || '');
    }, [dateRange?.startDate, dateRange?.endDate]);

    const set = (key) => (val) => {
        const cleared = val === 'all' ? '' : val;
        if (key === 'departmentId') {
            setFilters({ departmentId: cleared, sectionId: '' });
        } else {
            setFilters(prev => ({ ...prev, [key]: cleared }));
        }
    };

    const hasDateRangeFilter = startDate || endDate;
    const clearDateRange = () => {
        setStartDate('');
        setEndDate('');
    };

    const monthOptions = useMemo(() => {
        const options = [{ value: 'ALL', label: t('charts.allTime') }];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            options.push({
                value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
            });
        }
        return options;
    }, [t]);

    const handleMonthChange = (value) => {
        if (value === 'ALL') {
            clearDateRange();
            return;
        }
        const [year, month] = value.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay  = new Date(year, month, 0);
        setStartDate(formatDateLocal(firstDay));
        setEndDate(formatDateLocal(lastDay));
    };

    const getMonthValue = () => {
        if (!startDate && !endDate) return 'ALL';
        if (!startDate || !endDate) return 'CUSTOM';

        const [sy, sm, sd] = startDate.split('-').map(Number);
        const [ey, em, ed] = endDate.split('-').map(Number);

        if (sy === ey && sm === em && sd === 1) {
            const lastDayOfMonth = new Date(sy, sm, 0).getDate();
            if (ed === lastDayOfMonth) {
                return `${sy}-${String(sm).padStart(2, '0')}`;
            }
        }
        return 'CUSTOM';
    };

    const monthValue = getMonthValue();

    const handleReset = () => {
        setFilters({ departmentId: '', sectionId: '' });
        setStartDate(dateRange?.startDate || '');
        setEndDate(dateRange?.endDate || '');
    };

    /* ── Falls back to the current month when both visible inputs are left blank ── */
    const { startDate: apiStartDate, endDate: apiEndDate } = useMemo(
        () => (!startDate && !endDate) ? getDefaultDateRange() : { startDate, endDate },
        [startDate, endDate]
    );

    /* ── API: chart data ── */
    const { data: statsData, isLoading, error } = useGetDepartmentQuizStatsQuery({
        startDate: apiStartDate,
        endDate:   apiEndDate,
        departmentId: filters.departmentId,
        sectionId:    filters.sectionId,
    });

    /* ── API: filter options ── */
    const { data: deptData }    = useGetAllDepartmentsQuery({ limit: 200 });
    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        filters.departmentId || skipToken
    );

    const departments = deptData?.data?.departments || [];
    const formattedSections = useMemo(() => {
        const rawSections = sectionData?.data || sectionData || [];
        return rawSections.map(s => ({
            ...s,
            name: s.category ? `${s.name} (${s.category})` : s.name,
        }));
    }, [sectionData]);

    const chartData = statsData?.data || [];

    /* ── Summary totals ── */
    const totalPassed   = chartData.reduce((a, d) => a + (Number(d.passedCount) || 0), 0);
    const totalFailed   = chartData.reduce((a, d) => a + (Number(d.failedCount) || 0), 0);
    const totalAttempts = totalPassed + totalFailed;
    const passRate      = totalAttempts > 0 ? Math.round((totalPassed / totalAttempts) * 100) : 0;

    /* ── Scroll ── */
    const SLOT_WIDTH     = 96;
    const needsScroll    = chartData.length * 2 * SLOT_WIDTH > 800;
    const scrollMinWidth = needsScroll ? chartData.length * 2 * SLOT_WIDTH : undefined;

    /* ── Highcharts config ── */
    const chartOptions = useMemo(() => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 480,
            marginBottom: 100,
            marginTop: 60,
            style: { fontFamily: 'inherit' },
            animation: { duration: 400 },
            ...(needsScroll && {
                scrollablePlotArea: { minWidth: scrollMinWidth, scrollPositionX: 0 },
            }),
        },
        title:   { text: '' },
        credits: { enabled: false },
        noData: {
            style: {
                fontSize:   '14px',
                fontWeight: '600',
                color:      '#94a3b8',
            },
            position: { align: 'center', verticalAlign: 'middle' },
        },
        lang: { noData: t('charts.noTestAttemptData') },
        xAxis: {
            categories:    chartData.map(d => d.departmentName),
            crosshair:     true,
            lineWidth:     1,
            lineColor:     '#e9ecef',
            gridLineWidth: 0,
            labels: {
                style:    { fontSize: '12px', fontWeight: '600', color: '#334155' },
                rotation: 0,
                align:    'center',
                autoRotation: false,
            },
        },
        yAxis: {
            min:           0,
            allowDecimals: false,
            title:         { text: t('charts.attempts'), style: { color: '#94a3b8', fontSize: '13px' } },
            labels:        { style: { fontSize: '13px' } },
            gridLineColor: '#f1f5f9',
        },
        legend: {
            enabled:      true,
            itemStyle:    { fontSize: '13px', fontWeight: '600', color: '#374151' },
            symbolRadius: 3,
            symbolHeight: 12,
            symbolWidth:  12,
        },
        tooltip: {
            useHTML: true,
            style:   { fontSize: '13px' },
            formatter() {
                const series  = this.point.series.chart.series;
                const passed  = series[0]?.data[this.point.index]?.y ?? 0;
                const failed  = series[1]?.data[this.point.index]?.y ?? 0;
                const total   = passed + failed;
                return (
                    `<b style="font-size:14px;color:#0f172a">${this.x}</b>` +
                    `<div style="margin-top:6px">` +
                    `<span style="color:${PASS_COLOR}">●</span> ${t('charts.passed')}: <b>${passed}</b><br/>` +
                    `<span style="color:${FAIL_COLOR}">●</span> ${t('charts.failed')}: <b>${failed}</b><br/>` +
                    `<span style="color:#6b7280">${t('charts.total')}: <b style="color:#0f172a">${total}</b></span>` +
                    `</div>`
                );
            },
        },
        plotOptions: {
            column: {
                borderRadius:  5,
                borderWidth:   0,
                pointPadding:  0.1,
                groupPadding:  0.2,
                maxPointWidth: 60,
                dataLabels: {
                    enabled:      true,
                    formatter()   { return this.y > 0 ? String(this.y) : ''; },
                    style:        { fontSize: '13px', fontWeight: 'bold', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align:         'center',
                    y:             -20,
                    allowOverlap:  true,
                },
            },
        },
        // Taller chart on tablet widths so labels/legend fit in one frame without overlap.
        responsive: {
            rules: [{
                condition: { minWidth: 768, maxWidth: 1024 },
                chartOptions: { chart: { height: 500 } },
            }],
        },
        series: [
            {
                name:  t('charts.passed'),
                color: PASS_COLOR,
                data:  chartData.map(d => Number(d.passedCount) || 0),
            },
            {
                name:  t('charts.failed'),
                color: FAIL_COLOR,
                data:  chartData.map(d => Number(d.failedCount) || 0),
            },
        ],
    }), [chartData, needsScroll, scrollMinWidth, t]);

    return (
        <Card className="col-span-1 md:col-span-2 shadow-md border border-gray-200">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconChartBar className="h-5 w-5 text-blue-600" />
                            {t('charts.deptTestPerf')}
                        </CardTitle>
                        <CardDescription>
                            {t('charts.deptTestPerfDesc')}
                        </CardDescription>
                    </div>
                </div>

                {/* Filter bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">
                    <FilterSelect
                        label={t('nav.department')}
                        placeholder={t('nav.department')}
                        value={filters.departmentId || 'all'}
                        onChange={set('departmentId')}
                        items={departments}
                        allLabel={t('charts.allDepartments')}
                    />

                    <FilterSelect
                        label={t('charts.section')}
                        placeholder={t('charts.section')}
                        value={filters.sectionId || 'all'}
                        onChange={set('sectionId')}
                        items={formattedSections}
                        disabled={!filters.departmentId}
                        allLabel={t('charts.allSections')}
                    />

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t('charts.timeframe')}</Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 px-3 text-xs w-44 justify-start font-medium text-slate-700">
                                    <IconCalendar className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                                    {monthValue === 'ALL'
                                        ? t('charts.allTime')
                                        : monthValue === 'CUSTOM'
                                            ? t('charts.custom')
                                            : (monthOptions.find(o => o.value === monthValue)?.label || t('charts.allTime'))
                                    }
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-[300px] overflow-y-auto">
                                {monthOptions.map((option) => (
                                    <DropdownMenuItem
                                        key={option.value}
                                        onClick={() => handleMonthChange(option.value)}
                                        className="text-xs font-medium cursor-pointer"
                                    >
                                        {option.label}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{t('charts.from')} / {t('charts.to')}</Label>
                        <div className="flex items-center gap-1.5 h-8 rounded-md border border-input bg-transparent px-2">
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                max={endDate || undefined}
                                className="h-6 w-[112px] border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                            />
                            <span className="text-slate-400 text-[10px] font-bold">-</span>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate || undefined}
                                className="h-6 w-[112px] border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                            />
                            {hasDateRangeFilter && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={clearDateRange}
                                    className="h-5 w-5 shrink-0 p-0 text-slate-400 hover:text-slate-700"
                                    title={t('charts.clearSelection')}
                                >
                                    <IconX className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="self-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800"
                            onClick={handleReset}
                        >
                            <IconRefresh className="h-3.5 w-3.5 mr-1" />
                            {t('charts.reset')}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div style={{ height: isTablet ? 500 : 480 }} className="flex flex-col items-center justify-center gap-4">
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
                    <div style={{ height: isTablet ? 500 : 480 }} className="flex flex-col items-center justify-center text-red-500 gap-2">
                        <p className="text-sm font-semibold">{t('charts.failedToLoadDeptTest')}</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={`${filters.departmentId}-${filters.sectionId}-${apiStartDate}-${apiEndDate}`}
                            highcharts={Highcharts}
                            options={chartOptions}
                        />

                        {/* Summary strip */}
                        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50">
                                <span className="text-xs font-bold text-green-700">{t('charts.totalPassed')}</span>
                                <span className="text-sm font-black text-green-900">{totalPassed}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50">
                                <span className="text-xs font-bold text-red-700">{t('charts.totalFailed')}</span>
                                <span className="text-sm font-black text-red-900">{totalFailed}</span>
                            </div>
                            <div className={`flex items-center justify-between p-2.5 rounded-lg ${passRate >= 70 ? 'bg-green-50' : 'bg-amber-50'}`}>
                                <span className={`text-xs font-bold ${passRate >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{t('charts.passRate')}</span>
                                <span className={`text-sm font-black ${passRate >= 70 ? 'text-green-900' : 'text-amber-900'}`}>{passRate}%</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">{t('charts.totalAttempts')}</span>
                                <span className="text-sm font-black text-slate-800">{totalAttempts}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default DepartmentQuizChart;
