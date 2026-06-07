import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAdminHomeUserStatusStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconUsers, IconCalendar, IconChartPie, IconChartBar } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';

// Initialize 3D module
if (typeof highcharts3d === 'function') {
    highcharts3d(Highcharts);
}

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

    const getPieOptions = () => ({
        chart: {
            type: 'pie',
            options3d: {
                enabled: true,
                alpha: 0,
                beta: 0
            },
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
                dataLabels: {
                    enabled: true,
                    format: '{point.name}: {point.y}'
                },
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
            name: 'Status Share',
            data: chartData.map(item => ({ name: item.name, y: item.value }))
        }],
        credits: { enabled: false }
    });

    const getBarOptions = () => ({
        chart: { type: 'column', backgroundColor: 'transparent', height: 450 },
        title: { text: '' },
        xAxis: { categories: chartData.map(item => item.name) },
        yAxis: { title: { text: 'Users' } },
        series: [{
            name: 'Users',
            data: chartData.map(item => item.value),
            colorByPoint: true,
            colors: COLORS
        }],
        credits: { enabled: false }
    });

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
                        <HighchartsReact
                            key={viewType}
                            highcharts={Highcharts}
                            options={viewType === 'pie' ? getPieOptions() : getBarOptions()}
                        />
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

