import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAdminHomeHandoverStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconChartLine, IconCalendar, IconChartBar, IconChartPie } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';

// Initialize 3D module
if (typeof highcharts3d === 'function') {
    highcharts3d(Highcharts);
}

const COLORS = ['#3b82f6', '#94a3b8', '#10b981', '#f59e0b', '#ef4444'];

const HandoverComparisonChart = ({ dateRange }) => {
    const { data: statsData, isLoading, error } = useGetAdminHomeHandoverStatsQuery(dateRange);
    const [viewType, setViewType] = useState('bar'); // 'pie', 'line', or 'bar'

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
                size: '75%',
                dataLabels: {
                    enabled: true,
                    format: '{point.name}: {point.percentage:.1f}%',
                    distance: 30
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
            name: 'Distribution',
            data: pieData.map(item => ({ name: item.name, y: item.value }))
        }],
        credits: { enabled: false }
    });

    const getBarOptions = () => {
        const minPlotWidth = Math.max(rawData.length * 100, 500);
        
        return {
            chart: { 
                type: 'column', 
                backgroundColor: 'transparent', 
                height: 500,
                scrollablePlotArea: {
                    minWidth: minPlotWidth,
                    scrollPositionX: 1
                }
            },
            title: { text: '' },
            xAxis: { categories: rawData.map(d => d.date) },
            yAxis: { title: { text: 'Units' } },
            series: [
                { name: 'Target Plan', data: rawData.map(d => d.plan), color: '#94a3b8' },
                { name: 'Actual Handover', data: rawData.map(d => d.actual), color: '#3b82f6' }
            ],
            plotOptions: { 
                column: { 
                    borderRadius: 4,
                    pointPadding: 0.05,
                    groupPadding: 0.1,
                    dataLabels: {
                        enabled: true,
                        style: { fontSize: '10px' }
                    }
                } 
            },
            credits: { enabled: false }
        };
    };

    const getAreaOptions = () => ({
        chart: { type: 'area', backgroundColor: 'transparent', height: 500 },
        title: { text: '' },
        xAxis: { categories: rawData.map(d => d.date) },
        yAxis: { title: { text: 'Units' } },
        series: [
            { name: 'Target Plan', data: rawData.map(d => d.plan), color: '#94a3b8', fillOpacity: 0.1 },
            { name: 'Actual Handover', data: rawData.map(d => d.actual), color: '#3b82f6', fillOpacity: 0.3 }
        ],
        plotOptions: { area: { marker: { enabled: false } } },
        credits: { enabled: false }
    });

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
                <div className="h-[500px] w-full mt-4">
                    {hasData ? (
                        <HighchartsReact
                            key={viewType}
                            highcharts={Highcharts}
                            options={
                                viewType === 'pie' ? getPieOptions() :
                                    viewType === 'bar' ? getBarOptions() :
                                        getAreaOptions()
                            }
                        />
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

