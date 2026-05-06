import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useGetAdminHomeTestPaperStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconClipboardCheck, IconCalendar, IconChartPie, IconChartBar } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const COLORS = ['#0077c2', '#f29100', '#0a114d', '#94a3b8', '#8b5cf6'];

const TestPaperPassChart = ({ dateRange }) => {
    const { data: statsData, isLoading, error } = useGetAdminHomeTestPaperStatsQuery(dateRange);
    const [viewType, setViewType] = useState('pie'); // 'pie' or 'bar'
    
    const chartData = statsData?.data || [];
    const totalPasses = chartData.reduce((acc, curr) => acc + curr.value, 0);

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
                    Failed to load Test Paper statistics.
                </CardContent>
            </Card>
        );
    }

    const hasData = totalPasses > 0;

    return (
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconClipboardCheck className="h-5 w-5 text-green-600" />
                        Test Paper Pass Distribution
                    </CardTitle>
                    <CardDescription>
                        Theoretical vs Practical passes
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setViewType(viewType === 'pie' ? 'bar' : 'pie')}
                        title={viewType === 'pie' ? 'Switch to Bar Chart' : 'Switch to Pie Chart'}
                    >
                        {viewType === 'pie' ? <IconChartBar className="h-4 w-4" /> : <IconChartPie className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[450px] w-full relative">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            {viewType === 'pie' ? (
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={0}
                                        outerRadius={150}
                                        paddingAngle={2}
                                        dataKey="value"
                                        labelLine={true}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            ) : (
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip 
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36}/>
                                    <Bar dataKey="value" name="Passed Tests" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed">
                            <IconCalendar className="h-10 w-10 mb-2 opacity-20" />
                            <p>No pass data found.</p>
                        </div>
                    )}
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4">
                    {chartData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                <span className="text-sm font-medium text-gray-600">{item.name}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{item.value}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 col-span-2">
                        <span className="text-sm font-bold text-green-700">Total Passed Tests</span>
                        <span className="text-sm font-black text-green-900">{totalPasses}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TestPaperPassChart;
