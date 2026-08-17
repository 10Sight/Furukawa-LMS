import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconCalendar, IconFolder } from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";

export default function MonthlyMeeting() {
    const { data: deptsData, isLoading, error } = useGetAllDepartmentsQuery({ limit: 500 });
    const departments = useMemo(() => deptsData?.data?.departments || [], [deptsData]);

    return (
        <div className="space-y-6 w-full pb-20 p-2 md:p-4 min-h-screen">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-200">
                        <IconCalendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Monthly Meeting</h1>
                        <p className="text-sm text-slate-500 font-medium">Browse meetings by department</p>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 bg-red-50/50 rounded-3xl border border-red-100 text-red-600">
                    <p className="font-semibold">Failed to load departments</p>
                    <p className="text-sm text-red-500 mt-1">Please try refreshing the page.</p>
                </div>
            ) : departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconFolder className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">No Departments Found</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center mt-2 leading-relaxed">
                        Please create departments first to view tabs.
                    </p>
                </div>
            ) : (
                <Tabs defaultValue={String(departments[0]?.id || departments[0]?._id)} className="w-full">
                    <TabsList className="flex flex-wrap gap-2 justify-start bg-slate-100 p-1.5 rounded-xl mb-6 h-auto">
                        {departments.map((d) => (
                            <TabsTrigger
                                key={d.id || d._id}
                                value={String(d.id || d._id)}
                                className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                            >
                                {d.name}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {departments.map((d) => (
                        <TabsContent key={d.id || d._id} value={String(d.id || d._id)}>
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-xl font-bold text-slate-900">{d.name}</CardTitle>
                                    <CardDescription>Department ID: {d.id || d._id}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-600 text-sm">
                                        Welcome to the {d.name} monthly meeting space.
                                    </p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </div>
    );
}

