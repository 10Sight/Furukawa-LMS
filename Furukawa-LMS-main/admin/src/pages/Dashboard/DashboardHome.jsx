import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
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
    UserX,
    Filter,
    Calendar as CalendarIcon,
    RotateCw
} from 'lucide-react';
import { useGetDashboardStatsQuery } from "@/Redux/AllApi/DashboardApi";
import axiosInstance from '../../Helper/axiosInstance';

const DashboardHome = () => {



    // Data Fetching
    // Data Fetching
    const [sections, setSections] = useState([]);
    const [lines, setLines] = useState([]);

    const [filterState, setFilterState] = useState({
        section: "ALL", // Section ID
        line: "ALL", // Line ID
        dateRange: undefined
    });

    // Fetch Sections
    useEffect(() => {
        const fetchSections = async () => {
            try {
                const res = await axiosInstance.get('/api/sections');
                if (res.data?.data) {
                    setSections(res.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch sections", error);
            }
        };
        fetchSections();
    }, []);

    // Fetch Lines when section changes
    useEffect(() => {
        if (filterState.section && filterState.section !== 'ALL') {
            const fetchLines = async () => {
                try {
                    const res = await axiosInstance.get(`/api/lines?sectionId=${filterState.section}`);
                    if (res.data?.data) {
                        setLines(res.data.data);
                    }
                } catch (error) {
                    console.error("Failed to fetch lines", error);
                    setLines([]);
                }
            };
            fetchLines();
        } else {
            setLines([]);
            setFilterState(prev => ({ ...prev, line: "ALL" }));
        }
    }, [filterState.section]);


    // Dashboard Stats Query
    const { data: dashboardStats } = useGetDashboardStatsQuery({
        section: filterState.section,
        line: filterState.line,
        machine: undefined
    });

    const stats = dashboardStats?.data || {
        manpowerData: [],
        attritionData: [],
        absenteeismData: [],
        skillGapData: []
    };


    const handleFilterChange = (key, value) => {
        setFilterState(prev => {
            const newState = { ...prev, [key]: value };

            // Cascade Resets
            if (key === 'section') {
                newState.line = "ALL";
            }

            return newState;
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 space-y-6">

            {/* Header & Filters */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filters Group */}
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                        <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Filters:
                        </span>

                        {/* Dept Filter */}
                        <Select value={filterState.section} onValueChange={(val) => handleFilterChange("section", val)}>
                            <SelectTrigger className="w-[140px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Sections</SelectItem>
                                {sections.map(dept => (
                                    <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        {/* Line Filter */}
                        <Select
                            value={filterState.line}
                            onValueChange={(val) => handleFilterChange("line", val)}
                            disabled={filterState.section === "ALL"}
                        >
                            <SelectTrigger className="w-[140px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 shadow-none">
                                <SelectValue placeholder="All Lines" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Lines</SelectItem>
                                {lines.map(line => (
                                    <SelectItem key={line.id} value={line.id.toString()}>{line.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>


                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        {/* Date Range Picker */}
                        <div className="flex items-center gap-2">
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
                                                    {filterState.dateRange.from.toLocaleDateString()} -{" "}
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
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" onClick={() => {
                            setFilterState({ section: "ALL", subSection: "ALL", dateRange: undefined });
                        }}>
                            <RotateCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Column (Charts) */}
                <div className="xl:col-span-9 space-y-6">

                    {/* Manpower Trend */}
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                <Users className="w-5 h-5 text-blue-600" />
                                Manpower Trend
                            </CardTitle>
                            <p className="text-xs text-slate-500">Required vs Current Headcount (YTD)</p>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={stats.manpowerData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ fontSize: '12px', fontWeight: '500' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Line type="monotone" dataKey="required" name="Required" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="current" name="Current" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Attrition Trend */}
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
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
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

                        {/* Absenteeism */}
                        <Card className="border-slate-200 shadow-sm">
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                                        <UserX className="w-5 h-5 text-amber-500" />
                                        Absenteeism
                                    </CardTitle>
                                    <p className="text-xs text-slate-500">Actual vs Limit (Daily)</p>
                                </div>
                                <div className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold border border-red-200">
                                    Alert: Friday
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.absenteeismData} barGap={8} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                                            <Bar dataKey="actual" name="Current (Actual)" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="limit" name="Required (Limit)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Right Column (Skill Gap Analysis) */}
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

                                    {/* Custom Progress Bar */}
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex relative">
                                        <div
                                            className={`h-full ${gap.color} opacity-80`}
                                            style={{ width: `${Math.min((gap.avail / gap.req) * 100, 100)}%` }}
                                        ></div>
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
