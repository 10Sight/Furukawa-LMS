import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useGetAdminHomeUserStatusStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconUsers, IconCalendar, IconChartPie, IconChartBar } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#8b5cf6']; // Green (Present), Amber (Leave), Red (Left)

const UserStatusDistributionChart = ({ dateRange }) => {
    const { data: statsData, isLoading, error } = useGetAdminHomeUserStatusStatsQuery(dateRange);
    const [userType, setUserType] = useState('operator');
    const [viewType, setViewType] = useState('pie'); // 'pie' or 'bar'
    
    const allData = statsData?.data || { operator: [], dojo: [] };
    const chartData = allData[userType] || [];
    const totalUsers = chartData.reduce((acc, curr) => acc + curr.value, 0);

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
                    Failed to load User Status statistics.
                </CardContent>
            </Card>
        );
    }

    const hasData = totalUsers > 0;

    return (
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconUsers className="h-5 w-5 text-indigo-600" />
                        User Status Distribution
                    </CardTitle>
                    <CardDescription>
                        Attendance and exit status
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={userType} onValueChange={setUserType}>
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                            <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="operator">Operators</SelectItem>
                            <SelectItem value="dojo">Dojo Users</SelectItem>
                        </SelectContent>
                    </Select>
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
                <div className="h-[450px] w-full relative mt-4">
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
                                        label={({ name, value }) => value > 0 ? `${name} (${value})` : null}
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
                                    <Bar dataKey="value" name="Users" radius={[4, 4, 0, 0]}>
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
                            <p className="text-sm">No status data found for {userType}s.</p>
                        </div>
                    )}
                </div>
                
                <div className="mt-6 grid grid-cols-3 gap-2">
                    {chartData.map((item, index) => (
                        <div key={item.name} className="flex flex-col items-center p-2 rounded-lg bg-gray-50/50 border border-gray-100">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{item.name}</span>
                            <span className="text-lg font-black text-gray-800">{item.value}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 col-span-3 mt-2 px-4">
                        <span className="text-xs font-bold text-indigo-700">Total {userType === 'dojo' ? 'Dojo Users' : 'Operators'}</span>
                        <span className="text-sm font-black text-indigo-900">{totalUsers}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default UserStatusDistributionChart;
