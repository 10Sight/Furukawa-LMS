import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAdminHomeUserStatusStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconUsers, IconChartPie, IconChartBar, IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';
import 'highcharts/modules/no-data-to-display';
import useTranslate from "@/hooks/useTranslate";

// Initialize 3D module
if (typeof highcharts3d === 'function') {
    highcharts3d(Highcharts);
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#8b5cf6']; // Green (Present), Amber (Leave), Red (Left)

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

// Default under-the-hood date range per timeframe, used when the visible inputs are left blank.
const getDefaultDates = (timeframe) => {
    const now = new Date();
    if (timeframe === 'daily') {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            rawStart: formatDate(firstOfMonth),
            rawEnd: formatDate(lastOfMonth),
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

const INPUT_CONFIG = {
    daily: { type: 'date', min: '2020-01-01', max: MONTH_END, placeholder: 'YYYY-MM-DD' },
    monthly: { type: 'month', min: '2020-01', max: `${CURRENT_YEAR}-12`, placeholder: 'YYYY-MM' },
    yearly: { type: 'number', min: 2020, max: CURRENT_YEAR, step: 1, placeholder: 'YYYY' },
};

const UserStatusDistributionChart = () => {
    const { t } = useTranslate();
    const [viewType, setViewType] = useState('bar'); // 'pie' or 'bar'
    const [timeframe, setTimeframe] = useState('daily');
    const [rawStart, setRawStart] = useState('');
    const [rawEnd, setRawEnd] = useState('');
    const [selectedDepts, setSelectedDepts] = useState([]);

    const { data: deptsData } = useGetAllDepartmentsQuery();
    const departments = deptsData?.data?.departments || [];

    const { startDate, endDate } = useMemo(
        () => toApiDates(timeframe, rawStart, rawEnd),
        [timeframe, rawStart, rawEnd]
    );

    const { data: statsData, isLoading, error } = useGetAdminHomeUserStatusStatsQuery({
        startDate,
        endDate,
        departmentId: selectedDepts.length > 0 ? selectedDepts.join(',') : '',
    });

    const allData = statsData?.data || { dojo: [] };
    const chartData = allData.dojo || [];
    const totalUsers = chartData.reduce((acc, curr) => acc + curr.value, 0);

    const translateStatus = (status) => {
        if (!status) return '';
        const key = `charts.${status.toLowerCase()}`;
        const trans = t(key);
        return trans === key ? status : trans;
    };

    const cfg = INPUT_CONFIG[timeframe];
    const deptLabel = selectedDepts.length === 0
        ? t('charts.allDepartments')
        : selectedDepts.length === 1
            ? (departments.find(d => String(d.id ?? d._id) === selectedDepts[0])?.name ?? '1 Dept')
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

    if (isLoading) {
        return (
            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="col-span-1 md:col-span-2 border-red-200">
                <CardContent className="p-6 text-center text-red-500">
                    {t("charts.failedToLoadUserStatus")}
                </CardContent>
            </Card>
        );
    }

    const noDataConfig = {
        noData: {
            style: { fontSize: '14px', fontWeight: '600', color: '#94a3b8' },
            position: { align: 'center', verticalAlign: 'middle' },
        },
        lang: { noData: t("charts.noStatusData") },
    };

    const getPieOptions = () => ({
        chart: {
            type: 'pie',
            options3d: { enabled: true, alpha: 0, beta: 0 },
            backgroundColor: 'transparent',
            height: 450
        },
        title: { text: '' },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                dataLabels: { enabled: true, format: '{point.name}: {point.y}' },
                colors: COLORS,
                point: {
                    events: {
                        mouseOver: function () { this.slice(); },
                        mouseOut: function () { this.slice(); }
                    }
                }
            }
        },
        series: [{
            name: t("charts.statusShare"),
            data: chartData.map(item => ({ name: translateStatus(item.name), y: item.value }))
        }],
        credits: { enabled: false },
        ...noDataConfig,
    });

    const getBarOptions = () => ({
        chart: { type: 'column', backgroundColor: 'transparent', height: 450 },
        title: { text: '' },
        xAxis: { categories: chartData.map(item => translateStatus(item.name)) },
        yAxis: { title: { text: t("nav.trainees") } },
        plotOptions: {
            column: {
                dataLabels: {
                    enabled: true,
                    style: { fontSize: '13px', fontWeight: 'bold', color: '#1e293b', textOutline: '2px white' },
                    verticalAlign: 'top',
                    align: 'center',
                    y: -20,
                    allowOverlap: true,
                }
            }
        },
        series: [{
            name: t("charts.total"),
            data: chartData.map(item => item.value),
            colorByPoint: true,
            colors: COLORS
        }],
        credits: { enabled: false },
        ...noDataConfig,
    });

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="pb-4">
                <div className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconUsers className="h-5 w-5 text-indigo-600" />
                            {t("charts.attendanceStatus")}
                        </CardTitle>
                        <CardDescription>
                            {t("charts.attendanceStatusDesc")}
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewType(viewType === 'pie' ? 'bar' : 'pie')}
                        title={viewType === 'pie' ? t("charts.switchToBar") : t("charts.switchToPie")}
                    >
                        {viewType === 'pie' ? <IconChartBar className="h-4 w-4" /> : <IconChartPie className="h-4 w-4" />}
                    </Button>
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
                <div className="h-[450px] w-full relative mt-4">
                    <HighchartsReact
                        key={`${viewType}-${timeframe}-${startDate}-${endDate}-${selectedDepts.join(',')}`}
                        highcharts={Highcharts}
                        options={viewType === 'pie' ? getPieOptions() : getBarOptions()}
                    />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                    {chartData.map((item) => (
                        <div key={item.name} className="flex flex-col items-center p-2 rounded-lg bg-gray-50/50 border border-gray-100">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{translateStatus(item.name)}</span>
                            <span className="text-lg font-black text-gray-800">{item.value}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 col-span-3 mt-2 px-4">
                        <span className="text-xs font-bold text-indigo-700">{t("charts.totalDojoUsers")}</span>
                        <span className="text-sm font-black text-indigo-900">{totalUsers}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default UserStatusDistributionChart;
