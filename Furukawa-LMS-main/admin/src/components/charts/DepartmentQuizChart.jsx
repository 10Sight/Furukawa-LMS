import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useGetDepartmentQuizStatsQuery } from '@/Redux/AllApi/AnalyticsApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconChartBar } from "@tabler/icons-react";

const DepartmentQuizChart = ({ dateRange }) => {
    // Optional: Date range filtering could be added here
    const { data: statsData, isLoading, error } = useGetDepartmentQuizStatsQuery(dateRange);

    const chartData = statsData?.data || [];

    // Sort by passed count desc if not already
    // chartData.sort((a, b) => b.passedCount - a.passedCount);

    if (isLoading) {
        return (
            <Card className="col-span-1 md:col-span-2">
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
            <Card className="col-span-1 md:col-span-2 border-red-200">
                <CardContent className="p-6 text-center text-red-500">
                    Failed to load department test statistics.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <IconChartBar className="h-5 w-5 text-blue-600" />
                    Department Test Performance
                </CardTitle>
                <CardDescription>
                    Pass vs Fail status of quizzes by department
                </CardDescription>
            </CardHeader>
            <CardContent>
                {chartData.length > 0 ? (
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{
                                    top: 20,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="departmentName"
                                    tick={{ fontSize: 12 }}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={70}
                                />
                                <YAxis />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="passedCount" name="Passed" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                                <Bar dataKey="failedCount" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-gray-500">
                        <p>No test attempt data available for departments.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default DepartmentQuizChart;
