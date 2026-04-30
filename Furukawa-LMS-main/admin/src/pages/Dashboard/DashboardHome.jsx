import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    LineChart, Line, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
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
                            <span className="font-bold text-slate-900">{entry.value}</span>
                        </div>
                    )
                )}
            </div>
        );
    }
    return null;
};

// ─── Attrition Tooltip ────────────────────────────────────────────────────────
const AttritionTooltip = ({ active, payload, label }) => {
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
                        <span className="font-bold text-slate-900">{entry.value}%</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const DashboardHome = () => {

    const [sections,      setSections]      = useState([]);
    // filteredLines contains only lines belonging to the currently selected section
    const [filteredLines, setFilteredLines] = useState([]);
    const [linesLoading,  setLinesLoading]  = useState(false);

    const [filterState, setFilterState] = useState({
        section:   "ALL",
        line:      "ALL",
        dateRange: undefined,
    });

    // ── 1. Fetch all sections once on mount ───────────────────────────────────
    useEffect(() => {
        axiosInstance.get('/api/sections')
            .then(res => { if (res.data?.data) setSections(res.data.data); })
            .catch(err => console.error("Failed to fetch sections", err));
    }, []);

    // ── 2. Fetch lines ONLY for the selected section ──────────────────────────
    //    When section is ALL → clear lines list (line stays at ALL too)
    //    When section changes → reset line to ALL, then load new lines
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
    }, [filterState.section]); // re-runs whenever section changes

    // ── 3. Dashboard stats query ──────────────────────────────────────────────
    const {
        data: dashboardStats,
        isLoading,
        isFetching,
    } = useGetDashboardStatsQuery({
        section: filterState.section,
        line:    filterState.line,
    });

    const stats = dashboardStats?.data || {
        manpowerData:    [],
        attritionData:   [],
        skillGapData:    [],
        absenteeismData: [],
    };

    // Sanitise attrition values (backend now sends daily current-month data)
    const attritionChartData = (stats.attritionData || []).map(item => ({
        ...item,
        actual: typeof item.actual === 'number' ? item.actual : parseFloat(item.actual) || 0,
        target: typeof item.target === 'number' ? item.target : parseFloat(item.target) || 2.0,
    }));

    // Delta badge: today vs yesterday (last two data points in current month)
    const attritionDelta = (() => {
        if (attritionChartData.length < 2) return null;
        const last = attritionChartData[attritionChartData.length - 1]?.actual ?? 0;
        const prev = attritionChartData[attritionChartData.length - 2]?.actual ?? 0;
        return Math.round((last - prev) * 10) / 10;
    })();

    const isSectionSelected = filterState.section !== 'ALL';
    const isFiltered        = filterState.section !== 'ALL' || filterState.line !== 'ALL';
    const loadingChart      = isLoading || isFetching;

    // ── 4. Filter change handler ──────────────────────────────────────────────
    const handleFilterChange = (key, value) => {
        if (key === 'section') {
            // Changing section always resets the line dropdown
            setFilterState(prev => ({ ...prev, section: value, line: 'ALL' }));
        } else {
            setFilterState(prev => ({ ...prev, [key]: value }));
        }
    };

    // ── 5. Full reset ─────────────────────────────────────────────────────────
    const handleReset = () => {
        setFilteredLines([]);
        setFilterState({ section: 'ALL', line: 'ALL', dateRange: undefined });
    };

    // ── Chart loading overlay ─────────────────────────────────────────────────
    const ChartLoader = () => (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg z-10">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6">

            {/* ── Header & Filters ─────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
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

                        {/* ── Section dropdown ─────────────────────────────── */}
                        <Select
                            value={filterState.section}
                            onValueChange={(val) => handleFilterChange("section", val)}
                        >
                            <SelectTrigger className="w-[140px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Sections</SelectItem>
                                {sections.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300" />

                        {/* ── Line dropdown — locked until a section is chosen ─ */}
                        <div className="relative group">
                            <Select
                                value={filterState.line}
                                onValueChange={(val) => handleFilterChange("line", val)}
                                // Disabled when no section selected OR while loading lines
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
                                        <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Hover tooltip shown when line select is disabled */}
                            {!isSectionSelected && (
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block
                                    bg-slate-800 text-white text-[10px] rounded px-2 py-0.5 whitespace-nowrap z-20 pointer-events-none">
                                    Select a section first
                                </div>
                            )}
                        </div>

                        <div className="h-4 w-[1px] bg-slate-300" />

                        {/* ── Date range picker ─────────────────────────────── */}
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
                                            <span className="text-xs">{filterState.dateRange.from.toLocaleDateString()}</span>
                                        )
                                    ) : (
                                        <span className="text-xs">Pick a date range</span>
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

                        {/* ── Reset button ──────────────────────────────────── */}
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

            {/* ── Debug bar (remove in production) ─────────────────────────── */}
            {isFiltered && dashboardStats?.data?.filters && (
                <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-amber-700 flex gap-4">
                    <span>Section: <strong>{dashboardStats.data.filters.sectionName || '—'}</strong></span>
                    <span>Line: <strong>{dashboardStats.data.filters.lineName || '—'}</strong></span>
                    <span>Headcount: <strong>{dashboardStats.data.filters.snapshotTotal}</strong></span>
                </div>
            )}

            {/* ── Main Content Grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Column */}
                <div className="xl:col-span-9 space-y-6">

                    {/* ─── Manpower Trend ─────────────────────────────────── */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                <Users className="w-5 h-5 text-blue-600" />
                                Daily Manpower Trend (Current Month)
                                {loadingChart && <Loader2 className="w-4 h-4 animate-spin text-blue-400 ml-1" />}
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                Required vs Current Headcount · Actual Present (Daily)
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full relative">
                                {loadingChart && <ChartLoader />}
                                {!loadingChart && stats.manpowerData.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                        No data found for selected filters
                                    </div>
                                )}
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={stats.manpowerData}
                                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
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
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="current"
                                            name="Current Headcount"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={false}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="present"
                                            name="Actual Present"
                                            stroke="#f59e0b"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                            connectNulls={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ─── Attrition Trend — current month daily ──────────── */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                    <TrendingDown className="w-5 h-5 text-red-500" />
                                    Daily Attrition Trend (Current Month)
                                    {loadingChart && <Loader2 className="w-4 h-4 animate-spin text-red-300 ml-1" />}
                                </CardTitle>
                                <p className="text-xs text-slate-500">
                                    Daily Absence Rate vs Target (%) · Current Month Only
                                </p>
                            </div>
                            {/* Dynamic badge: today vs yesterday */}
                            {attritionDelta !== null && (
                                <div className={`px-2 py-1 rounded text-xs font-bold border ${
                                    attritionDelta <= 0
                                        ? 'bg-green-100 text-green-700 border-green-200'
                                        : 'bg-red-100 text-red-700 border-red-200'
                                }`}>
                                    {attritionDelta > 0 ? '+' : ''}{attritionDelta}% vs Yesterday
                                </div>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full relative">
                                {loadingChart && <ChartLoader />}
                                {!loadingChart && attritionChartData.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                                        No attrition data for selected filters
                                    </div>
                                )}
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        data={attritionChartData}
                                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.08} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        {/* X-axis uses "day" key e.g. "1 Apr", "2 Apr" sent by backend */}
                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            tickFormatter={(v) => `${v}%`}
                                            domain={[0, (dataMax) => Math.max(dataMax + 2, 10)]}
                                        />
                                        <Tooltip content={<AttritionTooltip />} />
                                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                                        <ReferenceLine
                                            y={2.0}
                                            label={{ value: 'Target 2%', position: 'insideTopRight', fontSize: 10, fill: '#3b82f6' }}
                                            stroke="#3b82f6"
                                            strokeDasharray="4 4"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="target"
                                            name="Target"
                                            stroke="#3b82f6"
                                            strokeWidth={1.5}
                                            strokeDasharray="4 4"
                                            fillOpacity={1}
                                            fill="url(#colorTarget)"
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="actual"
                                            name="Actual Attrition"
                                            stroke="#ef4444"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorActual)"
                                            dot={{ r: 3, strokeWidth: 2 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column — Skill Gap */}
                <div className="xl:col-span-3">
                    <Card className="h-full border-slate-200 shadow-sm bg-white">
                        <CardHeader className="pb-4 border-b border-slate-100 bg-white rounded-t-xl text-slate-900">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    Skill Gap
                                </CardTitle>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-slate-200">
                                    All Depts
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6 bg-white rounded-b-xl">
                            {loadingChart ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                                </div>
                            ) : (
                                stats.skillGapData.map((gap, index) => (
                                    <div key={index} className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${gap.color}`}>
                                                    {gap.level}
                                                </span>
                                                <span className="text-sm font-semibold text-slate-700">{gap.label}</span>
                                            </div>
                                            <div className="flex gap-3 text-xs">
                                                <span className="text-slate-500">Avail: <span className="font-bold text-slate-900">{gap.avail}</span></span>
                                                <span className="text-slate-500">Req: <span className="font-bold text-slate-900">{gap.req}</span></span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${gap.color} opacity-80 transition-all duration-500`}
                                                style={{ width: `${Math.min((gap.avail / Math.max(gap.req, 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;