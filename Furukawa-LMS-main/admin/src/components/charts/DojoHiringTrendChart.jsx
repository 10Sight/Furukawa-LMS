import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetDojoHiringTrendQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IconUsers, IconCalendar, IconChartBar, IconChartLine } from "@tabler/icons-react";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

// "2025-01" → "Jan 2025"
const formatPeriodLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const DojoHiringTrendChart = ({ dateRange }) => {
    const [viewMode, setViewMode] = useState('total'); // 'total' | 'gender'
    const { data, isLoading, error } = useGetDojoHiringTrendQuery(dateRange || {});

    const trend = data?.data?.trend || [];
    const categories = trend.map(r => formatPeriodLabel(r.period));
    const totalSeries = trend.map(r => Number(r.total) || 0);
    const maleSeries = trend.map(r => Number(r.maleCount) || 0);
    const femaleSeries = trend.map(r => Number(r.femaleCount) || 0);
    const otherSeries = trend.map(r => Number(r.otherCount) || 0);

    const grandTotal = totalSeries.reduce((a, b) => a + b, 0);

    const commonChartBase = {
        chart: {
            backgroundColor: 'transparent',
            height: 300,
            style: { fontFamily: 'inherit' },
        },
        title: { text: '' },
        credits: { enabled: false },
        legend: { enabled: viewMode === 'gender' },
        xAxis: {
            categories,
            crosshair: true,
            labels: {
                style: { fontSize: '11px', color: '#64748b' },
            },
        },
        yAxis: {
            min: 0,
            allowDecimals: false,
            title: { text: 'Candidates', style: { color: '#94a3b8' } },
            gridLineColor: '#f1f5f9',
        },
        tooltip: {
            shared: true,
            useHTML: true,
            headerFormat: '<div class="text-xs font-bold text-slate-700 mb-1">{point.key}</div>',
            pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y}</b><br/>',
        },
        plotOptions: {
            column: {
                borderRadius: 4,
                borderWidth: 0,
                groupPadding: 0.1,
            },
        },
    };

    const getTotalOptions = () => ({
        ...commonChartBase,
        series: [{
            type: 'column',
            name: 'New Hires',
            data: totalSeries,
            color: '#3b82f6',
        }],
    });

    const getGenderOptions = () => ({
        ...commonChartBase,
        plotOptions: {
            column: {
                ...commonChartBase.plotOptions.column,
                stacking: 'normal',
            },
        },
        series: [
            {
                type: 'column',
                name: 'Male',
                data: maleSeries,
                color: '#3b82f6',
            },
            {
                type: 'column',
                name: 'Female',
                data: femaleSeries,
                color: '#ec4899',
            },
            ...(otherSeries.some(v => v > 0) ? [{
                type: 'column',
                name: 'Other',
                data: otherSeries,
                color: '#94a3b8',
            }] : []),
        ],
    });

    if (isLoading) {
        return (
            <Card className="col-span-2">
                <CardHeader>
                    <Skeleton className="h-6 w-56 mb-2" />
                    <Skeleton className="h-4 w-40" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="col-span-2 border-red-200">
                <CardContent className="p-6 text-center text-red-500">
                    Failed to load Dojo hiring trend.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconUsers className="h-5 w-5 text-blue-600" />
                        Dojo Hiring Trend
                    </CardTitle>
                    <CardDescription>
                        Monthly new hires — historical counts include handed-over candidates
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === 'total' ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setViewMode('total')}
                    >
                        <IconChartBar className="h-3.5 w-3.5 mr-1" />
                        Total
                    </Button>
                    <Button
                        variant={viewMode === 'gender' ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => setViewMode('gender')}
                    >
                        <IconChartLine className="h-3.5 w-3.5 mr-1" />
                        By Gender
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {grandTotal === 0 ? (
                    <div className="h-[300px] flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed">
                        <IconCalendar className="h-10 w-10 mb-2 opacity-20" />
                        <p>No hiring data found for this period.</p>
                    </div>
                ) : (
                    <>
                        <HighchartsReact
                            key={viewMode}
                            highcharts={Highcharts}
                            options={viewMode === 'total' ? getTotalOptions() : getGenderOptions()}
                        />

                        {/* Summary row */}
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50">
                                <span className="text-xs font-bold text-blue-700">Total Hired</span>
                                <span className="text-sm font-black text-blue-900">{grandTotal}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-600">Male</span>
                                <span className="text-sm font-black text-slate-800">{maleSeries.reduce((a, b) => a + b, 0)}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-pink-50">
                                <span className="text-xs font-bold text-pink-600">Female</span>
                                <span className="text-sm font-black text-pink-900">{femaleSeries.reduce((a, b) => a + b, 0)}</span>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                                <span className="text-xs font-bold text-slate-500">Months Tracked</span>
                                <span className="text-sm font-black text-slate-800">{trend.length}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default DojoHiringTrendChart;
