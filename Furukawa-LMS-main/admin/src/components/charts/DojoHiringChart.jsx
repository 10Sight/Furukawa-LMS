import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAdminHomeDojoStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconUsers, IconCalendar, IconChartPie, IconChartBar } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';

// Initialize 3D module
if (typeof highcharts3d === 'function') {
    highcharts3d(Highcharts);
}

const COLORS = ['#0077c2', '#0a114d', '#f29100', '#94a3b8', '#8b5cf6'];
const GENDER_COLORS = {
    'male': '#3b82f6',
    'female': '#ec4899',
    'other': '#94a3b8'
};

const getGenderColor = (name, index) => {
    if (!name) return COLORS[index % COLORS.length];
    const key = name.toLowerCase().trim();
    return GENDER_COLORS[key] || COLORS[index % COLORS.length];
};

const DojoHiringChart = ({ dateRange }) => {
    const { data: statsData, isLoading, error } = useGetAdminHomeDojoStatsQuery(dateRange);
    const [viewType, setViewType] = useState('pie'); // 'pie' or 'bar'

    const chartData = statsData?.data?.genderDistribution || [];
    const totalDojo = statsData?.data?.totalDojoUsers || 0;

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
                    Failed to load Dojo statistics.
                </CardContent>
            </Card>
        );
    }

    const hasData = totalDojo > 0;

    // Highcharts Configuration
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
        title: {
            text: ''
        },
        accessibility: {
            point: {
                valueSuffix: '%'
            }
        },
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
                        mouseOver: function () {
                            this.slice();
                        },
                        mouseOut: function () {
                            this.slice();
                        }
                    }
                }
            }
        },
        series: [{
            type: 'pie',
            name: 'Hiring Share',
            data: chartData.map((item, index) => ({
                name: item.name,
                y: item.value,
                color: getGenderColor(item.name, index),
                sliced: false,
                selected: false
            }))
        }],
        responsive: {
            rules: [{
                condition: {
                    maxWidth: 550
                },
                chartOptions: {
                    plotOptions: {
                        pie: {
                            dataLabels: {
                                distance: -25,
                                format: '{point.percentage:.0f}%',
                                style: {
                                    color: '#000000ff',
                                    textOutline: '1px contrast',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                },
                                filter: {
                                    property: 'percentage',
                                    operator: '>',
                                    value: 5
                                }
                            }
                        }
                    }
                }
            }]
        },
        credits: {
            enabled: false
        }
    });

    const getBarOptions = () => ({
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 450
        },
        title: {
            text: ''
        },
        xAxis: {
            categories: chartData.map(item => item.name),
            crosshair: true
        },
        yAxis: {
            min: 0,
            title: {
                text: 'Candidates'
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
            pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
                '<td style="padding:0"><b>{point.y}</b></td></tr>',
            footerFormat: '</table>',
            shared: true,
            useHTML: true
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0,
                colors: COLORS,
                colorByPoint: true
            }
        },
        series: [{
            name: 'Candidates',
            data: chartData.map((item, index) => ({
                name: item.name,
                y: item.value,
                color: getGenderColor(item.name, index)
            }))
        }],
        credits: {
            enabled: false
        }
    });

    return (
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <IconUsers className="h-5 w-5 text-blue-600" />
                        Dojo Hiring Distribution
                    </CardTitle>
                    <CardDescription>
                        Gender distribution of temporary candidates
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
                        <HighchartsReact
                            key={viewType}
                            highcharts={Highcharts}
                            options={viewType === 'pie' ? getPieOptions() : getBarOptions()}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed">
                            <IconCalendar className="h-10 w-10 mb-2 opacity-20" />
                            <p>No hiring data found for this period.</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                    {chartData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: getGenderColor(item.name, index) }}
                                ></div>
                                <span className="text-sm font-medium text-gray-600">{item.name}</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{item.value}</span>
                        </div>
                    ))}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 col-span-2">
                        <span className="text-sm font-bold text-blue-700">Total Hired</span>
                        <span className="text-sm font-black text-blue-900">{totalDojo}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DojoHiringChart;
