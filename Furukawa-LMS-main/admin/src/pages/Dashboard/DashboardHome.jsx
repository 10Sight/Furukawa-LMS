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
} from 'lucide-react';
import { useGetDashboardStatsQuery } from "@/Redux/AllApi/DashboardApi";
import axiosInstance from '../../Helper/axiosInstance';

// ─── Custom Tooltip for Manpower Trend ───────────────────────────────────────
const ManpowerTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
                <p className="font-bold text-slate-700 mb-2">{label}</p>
                {payload.map((entry, i) => (
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
                ))}
            </div>
        );
    }
    return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const DashboardHome = () => {

    const [sections, setSections] = useState([]);
    const [lines, setLines]       = useState([]);
    const [filterState, setFilterState] = useState({
        section: "ALL",
        line:    "ALL",
        dateRange: undefined,
    });

    // ── Fetch ALL sections from sections table ────────────────────────────────
    useEffect(() => {
        axiosInstance.get('/api/sections')
            .then(res => { if (res.data?.data) setSections(res.data.data); })
            .catch(err => console.error("Failed to fetch sections", err));
    }, []);

    // ── Fetch ALL lines from lines table (not filtered by section) ────────────
    useEffect(() => {
        axiosInstance.get('/api/lines')
            .then(res => { if (res.data?.data) setLines(res.data.data); })
            .catch(err => console.error("Failed to fetch lines", err));
    }, []);

    // ── Dashboard Stats ───────────────────────────────────────────────────────
    const { data: dashboardStats } = useGetDashboardStatsQuery({
        section: filterState.section,
        line:    filterState.line,
    });

    const stats = dashboardStats?.data || {
        manpowerData: [],
        attritionData: [],
        skillGapData: [],
    };

    // ── Filter handler ────────────────────────────────────────────────────────
    const handleFilterChange = (key, value) => {
        setFilterState(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6">

            {/* ── Header & Filters ─────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                        <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Filters:
                        </span>

                        {/* Section — all records from sections table */}
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

                        {/* Line — all records from lines table, always enabled */}
                        <Select
                            value={filterState.line}
                            onValueChange={(val) => handleFilterChange("line", val)}
                        >
                            <SelectTrigger className="w-[140px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none">
                                <SelectValue placeholder="All Lines" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Lines</SelectItem>
                                {lines.map(l => (
                                    <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300" />

                        {/* Date Range Picker */}
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

                        {/* Reset */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400"
                            onClick={() => setFilterState({ section: "ALL", line: "ALL", dateRange: undefined })}
                        >
                            <RotateCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Main Content Grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Column */}
                <div className="xl:col-span-9 space-y-6">

                    {/* ─── Manpower Trend ─────────────────────────────────── */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                <Users className="w-5 h-5 text-blue-600" />
                                Manpower Trend
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                                Required vs Current Headcount (YTD) · Actual Present (Yesterday)
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
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

                                        {/* Required headcount (blue) */}
                                        <Line
                                            type="monotone"
                                            dataKey="required"
                                            name="Required"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />

                                        {/* Running headcount (green) */}
                                        <Line
                                            type="monotone"
                                            dataKey="current"
                                            name="Current Headcount"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />

                                        {/* Yesterday's actual present from attendance_logs
                                            joined via user_hierarchy_snapshots (payCode = employeeid).
                                            Only the current month has a value; all others are null
                                            so connectNulls=false renders a single amber dot. */}
                                        <Line
                                            type="monotone"
                                            dataKey="actual"
                                            name="Actual Present (Yesterday)"
                                            stroke="#f59e0b"
                                            strokeWidth={3}
                                            connectNulls={false}
                                            dot={({ cx, cy, value }) =>
                                                value !== null && value !== undefined
                                                    ? <circle key={`act-${cx}`} cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                                                    : null
                                            }
                                            activeDot={{ r: 7, fill: '#f59e0b' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* ─── Attrition Trend ────────────────────────────────── */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                    <TrendingDown className="w-5 h-5 text-red-500" />
                                    Attrition Trend
                                </CardTitle>
                                <p className="text-xs text-slate-500">Actual vs Target (%)</p>
                            </div>
                            <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">
                                -0.7% vs Last Month
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.attritionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                                        <ReferenceLine y={2.0} label="" stroke="#3b82f6" strokeDasharray="3 3" />
                                        <Area type="monotone" dataKey="actual" name="Current (Actual)" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" />
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
                            {stats.skillGapData.map((gap, index) => (
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
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
