import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList
} from 'recharts';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
    Users,
    TrendingDown,
    Filter,
    Calendar as CalendarIcon,
    RotateCw,
    Loader2,
} from 'lucide-react';
import { useGetDashboardStatsQuery } from "@/Redux/AllApi/DashboardApi";
import axiosInstance from '../../Helper/axiosInstance';

// ─── Manpower Tooltip ─────────────────────────────────────────────────────────
const ManpowerTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
                <p className="font-bold text-slate-700 mb-2">{label}</p>

                {payload.map((entry, i) =>
                    entry.value !== null && (
                        <div key={i} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                                <span
                                    className="inline-block w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-slate-500">{entry.name}</span>
                            </div>

                            <span className="font-bold text-slate-900">
                                {entry.value}
                            </span>
                        </div>
                    )
                )}
            </div>
        );
    }

    return null;
};

// ─── Bar Chart Tooltip ────────────────────────────────────────────────────────
const BarCustomTooltip = ({ active, payload, label, suffix = "" }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[150px]">
                <p className="font-bold text-slate-700 mb-2">{label}</p>

                {payload.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="inline-block w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-slate-500">{entry.name}</span>
                        </div>

                        <span className="font-bold text-slate-900">
                            {entry.value}{suffix}
                        </span>
                    </div>
                ))}
            </div>
        );
    }

    return null;
};

// ─── Pie Tooltip ──────────────────────────────────────────────────────────────
const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload;

        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[140px]">
                <p className="font-bold text-slate-800 mb-1">
                    {item.name}
                </p>

                <p className="text-slate-600">
                    Count: <strong>{item.value}</strong>
                </p>

                {item.percentValue && (
                    <p className="text-slate-600">
                        Share: <strong>{item.percentValue}%</strong>
                    </p>
                )}
            </div>
        );
    }

    return null;
};

// ─── Pie Label ────────────────────────────────────────────────────────────────
const renderPieLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name
}) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 26;

    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="#475569"
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize="11"
            fontWeight="700"
        >
            {`${name} ${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// ─── Normal Pie Chart ─────────────────────────────────────────────────────────
const CustomPieChart = ({ title, data = [], colors = [], icon: Icon }) => {
    const safeData = data.filter(item => Number(item.value) > 0);
    const total = safeData.reduce((sum, item) => sum + Number(item.value || 0), 0);

    const chartData = safeData.map(item => ({
        ...item,
        value: Number(item.value || 0),
        percentValue: total > 0 ? ((Number(item.value || 0) / total) * 100).toFixed(0) : 0
    }));

    return (
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-800">
                    {Icon && <Icon className="w-5 h-5" />}
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="pb-5 pt-0 px-5">
                {chartData.length === 0 ? (
                    <div className="h-[330px] flex items-center justify-center text-slate-400 text-sm">
                        No data found
                    </div>
                ) : (
                    <>
                        <div className="h-[330px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={115}
                                        innerRadius={0}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={renderPieLabel}
                                        labelLine={{
                                            stroke: '#cbd5e1',
                                            strokeWidth: 1
                                        }}
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={colors[index % colors.length]}
                                            />
                                        ))}
                                    </Pie>

                                    <Tooltip content={<PieTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                            {chartData.map((item, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                    <span
                                        className="w-3 h-3 rounded-sm inline-block"
                                        style={{
                                            backgroundColor: colors[index % colors.length]
                                        }}
                                    />

                                    <span className="text-slate-600 truncate">
                                        {item.name}
                                    </span>

                                    <span className="font-semibold text-slate-800 ml-auto">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const DashboardHome = () => {
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [filteredLines, setFilteredLines] = useState([]);
    const [sectionsLoading, setSectionsLoading] = useState(false);
    const [linesLoading, setLinesLoading] = useState(false);

    const [filterState, setFilterState] = useState({
        department: "ALL",
        section: "ALL",
        line: "ALL",
        dateRange: undefined,
    });

    useEffect(() => {
        axiosInstance.get('/api/departments')
            .then(res => {
                if (res.data?.data?.departments) {
                    setDepartments(res.data.data.departments);
                } else if (res.data?.data) {
                    setDepartments(res.data.data);
                }
            })
            .catch(err => console.error("Failed to fetch departments", err));
    }, []);

    useEffect(() => {
        if (filterState.department === 'ALL') {
            setSections([]);
            return;
        }

        setSectionsLoading(true);

        axiosInstance
            .get(`/api/sections?departmentId=${filterState.department}`)
            .then(res => setSections(res.data?.data || []))
            .catch(err => {
                console.error("Failed to fetch sections for department", err);
                setSections([]);
            })
            .finally(() => setSectionsLoading(false));
    }, [filterState.department]);

    useEffect(() => {
        if (filterState.section === 'ALL') {
            setFilteredLines([]);
            return;
        }

        setLinesLoading(true);

        axiosInstance
            .get(`/api/lines?sectionId=${filterState.section}`)
            .then(res => setFilteredLines(res.data?.data || []))
            .catch(err => {
                console.error("Failed to fetch lines for section", err);
                setFilteredLines([]);
            })
            .finally(() => setLinesLoading(false));
    }, [filterState.section]);

    const {
        data: dashboardStats,
        isLoading,
        isFetching,
    } = useGetDashboardStatsQuery({
        department: filterState.department,
        section: filterState.section,
        line: filterState.line,
        startDate: filterState.dateRange?.from
            ? filterState.dateRange.from.toISOString().split('T')[0]
            : undefined,
        endDate: filterState.dateRange?.to
            ? filterState.dateRange.to.toISOString().split('T')[0]
            : undefined,
    });

    const stats = dashboardStats?.data || {
        manpowerData: [],
        absenteeismData: [],
        attritionData: [],
        pieCharts: {
            skillLevels: [],
            gender: []
        }
    };

    const pieCharts = stats.pieCharts || {
        skillLevels: [],
        gender: []
    };

    const CHART_COLORS = {
        skill: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
        gender: ['#ec4899', '#0ea5e9', '#64748b']
    };

    const isDepartmentSelected = filterState.department !== 'ALL';
    const isSectionSelected = filterState.section !== 'ALL';

    const isFiltered =
        filterState.department !== 'ALL' ||
        filterState.section !== 'ALL' ||
        filterState.line !== 'ALL';

    const loadingChart = isLoading || isFetching;

    const handleFilterChange = (key, value) => {
        if (key === 'department') {
            setFilterState(prev => ({
                ...prev,
                department: value,
                section: 'ALL',
                line: 'ALL'
            }));
        } else if (key === 'section') {
            setFilterState(prev => ({
                ...prev,
                section: value,
                line: 'ALL'
            }));
        } else {
            setFilterState(prev => ({
                ...prev,
                [key]: value
            }));
        }
    };

    const handleReset = () => {
        setSections([]);
        setFilteredLines([]);
        setFilterState({
            department: 'ALL',
            section: 'ALL',
            line: 'ALL',
            dateRange: undefined
        });
    };

    const ChartLoader = () => (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg z-10">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6">

            {/* Header & Filters */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900">
                        Dashboard
                    </h1>

                    {isFiltered && (
                        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                            Filtered
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                        <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Filters:
                        </span>

                        <Select
                            value={filterState.department}
                            onValueChange={(val) => handleFilterChange("department", val)}
                        >
                            <SelectTrigger className="w-[140px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="ALL">All Departments</SelectItem>

                                {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id.toString()}>
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300" />

                        <div className="relative group">
                            <Select
                                value={filterState.section}
                                onValueChange={(val) => handleFilterChange("section", val)}
                                disabled={!isDepartmentSelected || sectionsLoading}
                            >
                                <SelectTrigger
                                    className={`w-[140px] h-8 bg-transparent border-none focus:ring-0 shadow-none transition-opacity
                                        ${!isDepartmentSelected || sectionsLoading
                                            ? 'opacity-40 cursor-not-allowed'
                                            : 'text-slate-700'
                                        }`}
                                >
                                    {sectionsLoading ? (
                                        <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            ...
                                        </span>
                                    ) : (
                                        <SelectValue
                                            placeholder={
                                                isDepartmentSelected
                                                    ? sections.length === 0
                                                        ? 'No sections'
                                                        : 'All Sections'
                                                    : 'Select Dept'
                                            }
                                        />
                                    )}
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="ALL">All Sections</SelectItem>

                                    {sections.map(s => (
                                        <SelectItem key={s.id} value={s.id.toString()}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {!isDepartmentSelected && (
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block
                                    bg-slate-800 text-white text-[10px] rounded px-2 py-0.5 whitespace-nowrap z-20 pointer-events-none">
                                    Select a department first
                                </div>
                            )}
                        </div>

                        <div className="h-4 w-[1px] bg-slate-300" />

                        <div className="relative group">
                            <Select
                                value={filterState.line}
                                onValueChange={(val) => handleFilterChange("line", val)}
                                disabled={!isSectionSelected || linesLoading}
                            >
                                <SelectTrigger
                                    className={`w-[155px] h-8 bg-transparent border-none focus:ring-0 shadow-none transition-opacity
                                        ${!isSectionSelected || linesLoading
                                            ? 'opacity-40 cursor-not-allowed'
                                            : 'text-slate-700'
                                        }`}
                                >
                                    {linesLoading ? (
                                        <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Loading lines…
                                        </span>
                                    ) : (
                                        <SelectValue
                                            placeholder={
                                                isSectionSelected
                                                    ? filteredLines.length === 0
                                                        ? 'No lines found'
                                                        : 'All Lines'
                                                    : 'Select section first'
                                            }
                                        />
                                    )}
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="ALL">All Lines</SelectItem>

                                    {filteredLines.map(l => (
                                        <SelectItem key={l.id} value={l.id.toString()}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {!isSectionSelected && (
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block
                                    bg-slate-800 text-white text-[10px] rounded px-2 py-0.5 whitespace-nowrap z-20 pointer-events-none">
                                    Select a section first
                                </div>
                            )}
                        </div>

                        <div className="h-4 w-[1px] bg-slate-300" />

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className={`h-8 justify-start text-left font-normal px-2 ${!filterState.dateRange?.from && "text-muted-foreground"}`}
                                >
                                    <CalendarIcon className="mr-2 h-3 w-3" />

                                    {filterState.dateRange?.from ? (
                                        filterState.dateRange.to ? (
                                            <span className="text-xs">
                                                {filterState.dateRange.from.toLocaleDateString()} –{" "}
                                                {filterState.dateRange.to.toLocaleDateString()}
                                            </span>
                                        ) : (
                                            <span className="text-xs">
                                                {filterState.dateRange.from.toLocaleDateString()}
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-xs">
                                            Pick a date range
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>

                            <PopoverContent className="w-auto p-0" align="end">
                                <CalendarComponent
                                    initialFocus
                                    mode="range"
                                    defaultMonth={filterState.dateRange?.from}
                                    selected={filterState.dateRange}
                                    onSelect={(range) => handleFilterChange("dateRange", range)}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-700"
                            onClick={handleReset}
                            title="Reset all filters"
                        >
                            <RotateCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Debug bar */}
            {isFiltered && dashboardStats?.data?.filters && (
                <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-amber-700 flex gap-4">
                    <span>
                        Dept: <strong>{dashboardStats.data.filters.departmentName || '—'}</strong>
                    </span>

                    <span>
                        Section: <strong>{dashboardStats.data.filters.sectionName || '—'}</strong>
                    </span>

                    <span>
                        Line: <strong>{dashboardStats.data.filters.lineName || '—'}</strong>
                    </span>

                    <span>
                        Headcount: <strong>{dashboardStats.data.filters.snapshotTotal}</strong>
                    </span>
                </div>
            )}

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* 1. Daily Manpower Trend */}
                <div className="xl:col-span-12">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                <Users className="w-5 h-5 text-blue-600" />
                                Daily Manpower Trend (Current Month)

                                {loadingChart && (
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-1" />
                                )}
                            </CardTitle>

                            <p className="text-xs text-slate-500">
                                Required vs Current Headcount · Actual Present Daily
                            </p>
                        </CardHeader>

                        <CardContent>
                            <div className="h-[360px] w-full relative">
                                {loadingChart && <ChartLoader />}

                                {!loadingChart && stats.manpowerData.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                        No data found for selected filters
                                    </div>
                                )}

                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={stats.manpowerData}
                                        margin={{ top: 35, right: 40, left: 0, bottom: 5 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#e2e8f0"
                                        />

                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            dy={10}
                                        />

                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            allowDecimals={false}
                                        />

                                        <Tooltip content={<ManpowerTooltip />} />

                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                        <Line
                                            type="monotone"
                                            dataKey="required"
                                            name="Required"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={false}
                                        >
                                            <LabelList
                                                dataKey="required"
                                                position="top"
                                                offset={10}
                                                fill="#1d4ed8"
                                                fontSize={11}
                                                fontWeight={700}
                                            />
                                        </Line>

                                        <Line
                                            type="monotone"
                                            dataKey="current"
                                            name="Current Headcount"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={false}
                                        >
                                            <LabelList
                                                dataKey="current"
                                                position="bottom"
                                                offset={10}
                                                fill="#047857"
                                                fontSize={11}
                                                fontWeight={700}
                                            />
                                        </Line>

                                        <Line
                                            type="monotone"
                                            dataKey="present"
                                            name="Actual Present"
                                            stroke="#f59e0b"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={false}
                                        >
                                            <LabelList
                                                dataKey="present"
                                                position="top"
                                                offset={22}
                                                fill="#b45309"
                                                fontSize={11}
                                                fontWeight={700}
                                            />
                                        </Line>
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 2. Attrition Bar Graph */}
                <div className="xl:col-span-6">
                    <Card className="border-slate-200 shadow-sm h-full">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <TrendingDown className="w-4 h-4 text-rose-500" />
                                Daily Attrition Rate (%)
                            </CardTitle>
                        </CardHeader>

                        <CardContent>
                            <div className="h-[280px] w-full relative">
                                {loadingChart && <ChartLoader />}

                                {!loadingChart && stats.attritionData.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                        No attrition data found
                                    </div>
                                )}

                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={stats.attritionData}
                                        margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#f1f5f9"
                                        />

                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                        />

                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                            unit="%"
                                        />

                                        <Tooltip content={<BarCustomTooltip suffix="%" />} />

                                        <ReferenceLine
                                            y={2}
                                            label={{
                                                value: 'Target 2%',
                                                position: 'right',
                                                fontSize: 10,
                                                fill: '#f87171'
                                            }}
                                            stroke="#f87171"
                                            strokeDasharray="3 3"
                                        />

                                        <Bar
                                            dataKey="actual"
                                            name="Actual Rate"
                                            fill="#ef4444"
                                            radius={[6, 6, 0, 0]}
                                            barSize={24}
                                        >
                                            <LabelList
                                                dataKey="actual"
                                                position="top"
                                                fill="#991b1b"
                                                fontSize={10}
                                                fontWeight={700}
                                                formatter={(value) => `${value}%`}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 3. Absenteeism Bar Graph */}
                <div className="xl:col-span-6">
                    <Card className="border-slate-200 shadow-sm h-full">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <TrendingDown className="w-4 h-4 text-amber-500" />
                                7-Day Rolling Absenteeism
                            </CardTitle>
                        </CardHeader>

                        <CardContent>
                            <div className="h-[280px] w-full relative">
                                {loadingChart && <ChartLoader />}

                                {!loadingChart && stats.absenteeismData.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                        No absenteeism data found
                                    </div>
                                )}

                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={stats.absenteeismData}
                                        margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke="#f1f5f9"
                                        />

                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                        />

                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 10, fill: '#64748b' }}
                                            allowDecimals={false}
                                        />

                                        <Tooltip content={<BarCustomTooltip />} />

                                        <Legend iconType="circle" />

                                        <ReferenceLine
                                            y={10}
                                            stroke="#cbd5e1"
                                            strokeDasharray="3 3"
                                        />

                                        <Bar
                                            dataKey="actual"
                                            name="Absents"
                                            fill="#f59e0b"
                                            radius={[6, 6, 0, 0]}
                                            barSize={24}
                                        >
                                            <LabelList
                                                dataKey="actual"
                                                position="top"
                                                fill="#92400e"
                                                fontSize={10}
                                                fontWeight={700}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 4. Normal Pie Charts Below All Graphs */}
                <div className="xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CustomPieChart
                        title="Skill Distribution (L0-L4)"
                        data={pieCharts.skillLevels}
                        colors={CHART_COLORS.skill}
                        icon={Users}
                    />

                    <CustomPieChart
                        title="Gender Distribution"
                        data={pieCharts.gender}
                        colors={CHART_COLORS.gender}
                        icon={Users}
                    />
                </div>

            </div>
        </div>
    );
};

export default DashboardHome;