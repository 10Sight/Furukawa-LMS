import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useGetAdminHomeTestPaperStatsQuery } from '@/Redux/AllApi/AdminHomeApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { Skeleton } from "@/components/ui/skeleton";
import { 
    IconClipboardCheck, 
    IconCalendar, 
    IconChartPie, 
    IconChartBar, 
    IconFilter, 
    IconUsers,
    IconLayoutGrid,
    IconCertificate
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";

// Initialize 3D module
if (typeof highcharts3d === 'function') {
    highcharts3d(Highcharts);
}

const COLORS = ['#0077c2', '#f29100', '#0a114d', '#94a3b8', '#8b5cf6'];
const STATUS_COLORS = { 'Passed': '#10b981', 'Failed': '#ef4444' };

const TestPaperPassChart = ({ dateRange }) => {
    // Local Filters for API
    const [departmentId, setDepartmentId] = useState('all');
    const [isDojo, setIsDojo] = useState('all');
    
    // View type toggle (Pie vs Bar)
    const [viewType, setViewType] = useState('pie');

    // Local Filter for the second chart
    const [testTypeFilter, setTestTypeFilter] = useState('all'); // 'Theoretical', 'Practical', 'all'

    // API Calls
    const { data: statsData, isLoading, error } = useGetAdminHomeTestPaperStatsQuery({
        ...dateRange,
        departmentId: departmentId === 'all' ? '' : departmentId,
        isDojo: isDojo === 'all' ? '' : isDojo
    });
    
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const departments = deptsData?.data?.departments || [];

    // Process Data
    const totalDistribution = statsData?.data?.totalDistribution || [];
    const passFailRaw = statsData?.data?.passFailData || [];

    // Filter passFailData based on testTypeFilter for Chart 2
    const filteredPassFail = useMemo(() => {
        let filtered = passFailRaw;
        if (testTypeFilter !== 'all') {
            filtered = passFailRaw.filter(item => item.type === testTypeFilter);
        }

        // Aggregate by status
        const summary = { 'Passed': 0, 'Failed': 0 };
        filtered.forEach(item => {
            if (summary[item.status] !== undefined) {
                summary[item.status] += item.value;
            }
        });

        return Object.entries(summary).map(([name, value]) => ({ 
            name, 
            y: value,
            color: STATUS_COLORS[name] 
        }));
    }, [passFailRaw, testTypeFilter]);

    const totalAttempts = totalDistribution.reduce((acc, curr) => acc + curr.value, 0);
    const totalResultsForFilter = filteredPassFail.reduce((acc, curr) => acc + curr.y, 0);

    if (isLoading) {
        return (
            <Card className="lg:col-span-2">
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-[350px] w-full" />
                    <Skeleton className="h-[350px] w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="lg:col-span-2 border-red-200">
                <CardContent className="p-6 text-center text-red-500">
                    Failed to load Test Paper statistics.
                </CardContent>
            </Card>
        );
    }

    const getPieOptions = (title, data, name = 'Value') => ({
        chart: {
            type: 'pie',
            options3d: { enabled: true, alpha: 0, beta: 0 },
            backgroundColor: 'transparent',
            height: 450
        },
        title: { 
            text: title,
            style: { fontSize: '14px', fontWeight: '600', color: '#4b5563' }
        },
        tooltip: { pointFormat: '{series.name}: <b>{point.y} ({point.percentage:.1f}%)</b>' },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                size: '80%', // Enforce uniform size
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.percentage:.1f}%',
                    distance: 15
                },
                colors: COLORS
            }
        },
        series: [{ name, data }],
        credits: { enabled: false }
    });

    const getBarOptions = (title, data, name = 'Value') => ({
        chart: { type: 'column', backgroundColor: 'transparent', height: 450 },
        title: { 
            text: title,
            style: { fontSize: '14px', fontWeight: '600', color: '#4b5563' }
        },
        xAxis: { categories: data.map(d => d.name) },
        yAxis: { title: { text: name } },
        plotOptions: {
            column: {
                colorByPoint: true,
                colors: data.map(d => d.color || COLORS[0])
            }
        },
        series: [{
            name,
            data: data.map(d => d.y !== undefined ? d.y : d.value),
            colorByPoint: true,
            colors: data.every(d => d.color) ? data.map(d => d.color) : COLORS
        }],
        credits: { enabled: false }
    });

    return (
        <Card className="lg:col-span-2 shadow-sm border-gray-200">
            <CardHeader className="border-b bg-gray-50/50 pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
                            <IconCertificate className="h-6 w-6 text-blue-600" />
                            Comprehensive Test Analytics
                        </CardTitle>
                        <CardDescription>
                            Distribution of tests taken and result performance
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* View Type Toggle */}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 bg-white shadow-sm"
                            onClick={() => setViewType(viewType === 'pie' ? 'bar' : 'pie')}
                            title={viewType === 'pie' ? 'Switch to Bar Chart' : 'Switch to Pie Chart'}
                        >
                            {viewType === 'pie' ? <IconChartBar className="h-4 w-4" /> : <IconChartPie className="h-4 w-4" />}
                        </Button>

                        {/* Department Filter */}
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                            <IconFilter className="h-4 w-4 text-gray-400" />
                            <Select value={departmentId} onValueChange={setDepartmentId}>
                                <SelectTrigger className="h-7 w-[140px] border-none shadow-none focus:ring-0 p-0">
                                    <SelectValue placeholder="Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map(dept => (
                                        <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Dojo Filter */}
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                            <IconUsers className="h-4 w-4 text-gray-400" />
                            <Select value={isDojo} onValueChange={setIsDojo}>
                                <SelectTrigger className="h-7 w-[120px] border-none shadow-none focus:ring-0 p-0">
                                    <SelectValue placeholder="Worker Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="false">Operator</SelectItem>
                                    <SelectItem value="true">Dojo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Chart 1: Total Attempts */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <IconLayoutGrid className="h-4 w-4" />
                                Test Type Distribution
                            </h3>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                                Total: {totalAttempts}
                            </Badge>
                        </div>
                        <div className="bg-gray-50/50 rounded-xl p-2 border border-gray-100">
                            {totalAttempts > 0 ? (
                                <HighchartsReact
                                    key={`total-${viewType}`}
                                    highcharts={Highcharts}
                                    options={viewType === 'pie' 
                                        ? getPieOptions('Attempts by Category', totalDistribution.map(d => ({ name: d.name, y: d.value })), 'Attempts')
                                        : getBarOptions('Attempts by Category', totalDistribution.map(d => ({ name: d.name, value: d.value })), 'Attempts')
                                    }
                                />
                            ) : (
                                <div className="h-[350px] flex flex-col items-center justify-center text-gray-400 italic">
                                    No data available for these filters
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart 2: Pass/Fail */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <IconClipboardCheck className="h-4 w-4" />
                                Result Performance
                            </h3>
                            
                            <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
                                <SelectTrigger className="h-7 w-[130px] text-xs bg-white">
                                    <SelectValue placeholder="All Tests" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tests</SelectItem>
                                    <SelectItem value="Theoretical">Theoretical</SelectItem>
                                    <SelectItem value="Practical">Practical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="bg-gray-50/50 rounded-xl p-2 border border-gray-100">
                            {totalResultsForFilter > 0 ? (
                                <HighchartsReact
                                    key={`result-${viewType}`}
                                    highcharts={Highcharts}
                                    options={viewType === 'pie'
                                        ? getPieOptions(`${testTypeFilter === 'all' ? 'Overall' : testTypeFilter} Success Rate`, filteredPassFail, 'Results')
                                        : getBarOptions(`${testTypeFilter === 'all' ? 'Overall' : testTypeFilter} Success Rate`, filteredPassFail, 'Results')
                                    }
                                />
                            ) : (
                                <div className="h-[350px] flex flex-col items-center justify-center text-gray-400 italic">
                                    No results found for {testTypeFilter}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Metrics */}
                <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {totalDistribution.map((item, idx) => (
                        <div key={item.name} className="p-4 rounded-xl border bg-white shadow-sm flex flex-col items-center">
                            <span className="text-xs font-medium text-gray-500 uppercase">{item.name} Taken</span>
                            <span className="text-2xl font-bold text-gray-900 mt-1">{item.value}</span>
                        </div>
                    ))}
                    <div className="p-4 rounded-xl border border-green-100 bg-green-50 shadow-sm flex flex-col items-center">
                        <span className="text-xs font-medium text-green-600 uppercase tracking-wider">Total Passed</span>
                        <span className="text-2xl font-black text-green-700 mt-1">
                            {passFailRaw.filter(r => r.status === 'Passed').reduce((a, b) => a + b.value, 0)}
                        </span>
                    </div>
                    <div className="p-4 rounded-xl border border-red-100 bg-red-50 shadow-sm flex flex-col items-center">
                        <span className="text-xs font-medium text-red-600 uppercase tracking-wider">Total Failed</span>
                        <span className="text-2xl font-black text-red-700 mt-1">
                            {passFailRaw.filter(r => r.status === 'Failed').reduce((a, b) => a + b.value, 0)}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TestPaperPassChart;
