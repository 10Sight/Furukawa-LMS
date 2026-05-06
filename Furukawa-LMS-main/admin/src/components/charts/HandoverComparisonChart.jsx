import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useGetAdminHomeHandoverStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconChartLine, IconCalendar, IconChartBar, IconChartPie } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLORS = ['#3b82f6', '#94a3b8', '#10b981', '#f59e0b', '#ef4444'];

const HandoverComparisonChart = ({ dateRange }) => {
    const { data: statsData, isLoading, error } = useGetAdminHomeHandoverStatsQuery(dateRange);
    const [viewType, setViewType] = useState('pie'); // 'pie', 'line', or 'bar'
    
    const rawData = statsData?.data || [];
    
    // Calculate totals for summary and Pie chart
    const totalPlan = rawData.reduce((acc, curr) => acc + curr.plan, 0);
    const totalActual = rawData.reduce((acc, curr) => acc + curr.actual, 0);
    const pendingPlan = Math.max(0, totalPlan - totalActual);
    const achievementRate = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 100) : 0;

    const pieData = [
        { name: 'Actual Handover', value: totalActual },
        { name: 'Pending Target', value: pendingPlan }
    ];

    if (isLoading) {
        return (
            <Card className="col-span-1">
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
            <Card className="col-span-1 border-red-200">
                <CardContent className="p-6 text-center text-red-500">
                    Failed to load handover statistics.
                </CardContent>
            </Card>
        );
    }

    const hasData = rawData.length > 0;

    return (
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconChartPie className="h-5 w-5 text-blue-600" />
                        Handover Distribution
                    </CardTitle>
                    <CardDescription>
                        Target vs Actual achievement
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-8 w-8 ${viewType === 'pie' ? 'bg-blue-50 border-blue-200' : ''}`}
                        onClick={() => setViewType('pie')}
                        title="Pie View"
                    >
                        <IconChartPie className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-8 w-8 ${viewType === 'bar' ? 'bg-blue-50 border-blue-200' : ''}`}
                        onClick={() => setViewType('bar')}
                        title="Bar View"
                    >
                        <IconChartBar className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className={`h-8 w-8 ${viewType === 'line' ? 'bg-blue-50 border-blue-200' : ''}`}
                        onClick={() => setViewType('line')}
                        title="Timeline View"
                    >
                        <IconChartLine className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[450px] w-full mt-4">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            {viewType === 'pie' ? (
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={150}
                                        paddingAngle={2}
                                        dataKey="value"
                                        labelLine={true}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            ) : viewType === 'bar' ? (
                                <BarChart data={rawData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="top" height={36} align="right" />
                                    <Bar dataKey="plan" name="Target Plan" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="actual" name="Actual Handover" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            ) : (
                                <AreaChart data={rawData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="date" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="top" height={36} align="right" />
                                    <Area 
                                        type="monotone" 
                                        dataKey="plan" 
                                        name="Target Plan" 
                                        stroke="#94a3b8" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorPlan)" 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="actual" 
                                        name="Actual Handover" 
                                        stroke="#3b82f6" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorActual)" 
                                    />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed">
                            <IconCalendar className="h-10 w-10 mb-2 opacity-20" />
                            <p className="text-sm">No handover data found for this period.</p>
                        </div>
                    )}
                </div>

                {/* Footer Stats Summary */}
                <div className="mt-8 grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Target</p>
                        <p className="text-xl font-black text-slate-900">{totalPlan}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Total Actual</p>
                        <p className="text-xl font-black text-blue-900">{totalActual}</p>
                    </div>
                    <div className={`p-3 rounded-xl border ${achievementRate >= 100 ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                        <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${achievementRate >= 100 ? 'text-green-600' : 'text-amber-600'}`}>Achievement</p>
                        <p className={`text-xl font-black ${achievementRate >= 100 ? 'text-green-900' : 'text-amber-900'}`}>{achievementRate}%</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default HandoverComparisonChart;
