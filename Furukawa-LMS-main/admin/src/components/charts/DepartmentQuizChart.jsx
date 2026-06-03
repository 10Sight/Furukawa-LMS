import React, { useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import { useGetDepartmentQuizStatsQuery } from '@/Redux/AllApi/AnalyticsApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetLinesBySectionQuery, useGetLinesQuery } from '@/Redux/AllApi/LineApi';
import { useGetSubSectionsQuery } from '@/Redux/AllApi/SubSectionApi';
import { Skeleton } from "@/components/ui/skeleton";
import { IconChartBar, IconFilter } from "@tabler/icons-react";

/* ── Custom X-axis tick: horizontal, wraps at first space ── */
const CustomXAxisTick = ({ x, y, payload }) => {
    const name = (payload.value || '').trim();
    const parts = name.split(' ');
    const mid = Math.ceil(parts.length / 2);
    const line1 = parts.slice(0, mid).join(' ');
    const line2 = parts.slice(mid).join(' ');

    return (
        <g transform={`translate(${x},${y})`}>
            <text textAnchor="middle" fill="#334155" fontWeight={600} fontFamily="inherit">
                <tspan x={0} dy={16} fontSize={12}>{line1}</tspan>
                {line2 ? <tspan x={0} dy={14} fontSize={12}>{line2}</tspan> : null}
            </text>
        </g>
    );
};

/* ── Bold value label rendered above each bar ── */
const ValueLabel = ({ x, y, width, value }) => {
    if (!value) return null;
    return (
        <text
            x={x + width / 2}
            y={y - 8}
            fill="#0f172a"
            textAnchor="middle"
            fontSize={14}
            fontWeight="700"
            fontFamily="inherit"
        >
            {value}
        </text>
    );
};

/* ── Custom tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const passed = payload.find(p => p.dataKey === 'passedCount');
    const failed = payload.find(p => p.dataKey === 'failedCount');
    const total = (passed?.value || 0) + (failed?.value || 0);
    return (
        <div style={{
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 10px 30px -5px rgba(0,0,0,0.18)',
            padding: '14px 20px',
            minWidth: 190,
            border: 'none',
        }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 8 }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#16a34a' }} />
                <span style={{ fontSize: 13, color: '#374151' }}>Passed: <strong>{passed?.value ?? 0}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#dc2626' }} />
                <span style={{ fontSize: 13, color: '#374151' }}>Failed: <strong>{failed?.value ?? 0}</strong></span>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>
                    Total: <strong style={{ color: '#0f172a' }}>{total}</strong>
                </span>
            </div>
        </div>
    );
};

/* ── Filter Select helper ── */
const FilterSelect = ({ placeholder, value, onChange, items, disabled, allLabel }) => (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs min-w-[130px] max-w-[160px]">
            <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="all" className="text-xs">{allLabel || "All"}</SelectItem>
            {(items || []).map(item => {
                const itemId = String(item.id || item._id || '');
                return (
                    <SelectItem key={itemId} value={itemId} className="text-xs">
                        {item.name}
                    </SelectItem>
                );
            })}
        </SelectContent>
    </Select>
);

/* ══════════════════════════════════════════════════════════════ */

const DepartmentQuizChart = ({ dateRange }) => {
    const [filters, setFilters] = useState({
        departmentId: '',
        sectionId: '',
    });

    const set = (key) => (val) => {
        const cleared = val === 'all' ? '' : val;
        if (key === 'departmentId') {
            setFilters({ departmentId: cleared, sectionId: '' });
        } else {
            setFilters(prev => ({ ...prev, [key]: cleared }));
        }
    };

    /* ── API: chart data ── */
    const { data: statsData, isLoading, error } = useGetDepartmentQuizStatsQuery({
        ...dateRange,
        departmentId: filters.departmentId,
        sectionId:    filters.sectionId,
    });

    /* ── API: filter options ── */
    const { data: deptData }    = useGetAllDepartmentsQuery({ limit: 200 });
    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        filters.departmentId || skipToken
    );

    const departments = deptData?.data?.departments || [];
    const formattedSections = React.useMemo(() => {
        const rawSections = sectionData?.data || sectionData || [];
        return rawSections.map(s => ({
            ...s,
            name: s.category ? `${s.name} (${s.category})` : s.name
        }));
    }, [sectionData]);

    const chartData = statsData?.data || [];

    /* ── Loading state ── */
    if (isLoading) {
        return (
            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[480px] w-full" />
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
        <Card className="col-span-1 md:col-span-2 shadow-md border border-gray-200">
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <IconChartBar className="h-6 w-6 text-blue-600" />
                                Department Test Performance
                            </CardTitle>
                            <CardDescription className="text-sm mt-0.5">
                                Pass vs Fail attempts by department
                            </CardDescription>
                        </div>
                    </div>

                    {/* Filter row */}
                    <div className="flex items-center flex-wrap gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <IconFilter className="h-4 w-4 text-slate-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-500 mr-1">Filter:</span>

                        <FilterSelect
                            placeholder="Department"
                            value={filters.departmentId || 'all'}
                            onChange={set('departmentId')}
                            items={departments}
                            allLabel="All Department"
                        />

                        <FilterSelect
                            placeholder="Section"
                            value={filters.sectionId || 'all'}
                            onChange={set('sectionId')}
                            items={formattedSections}
                            disabled={!filters.departmentId}
                            allLabel="All Section"
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {chartData.length > 0 ? (
                    <div className="h-[500px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 44, right: 30, left: 10, bottom: 70 }}
                                barCategoryGap="28%"
                                barGap={5}
                            >
                                <defs>
                                    <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#16a34a" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#4ade80" stopOpacity={0.88} />
                                    </linearGradient>
                                    <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#dc2626" stopOpacity={1} />
                                        <stop offset="100%" stopColor="#f87171" stopOpacity={0.88} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />

                                <XAxis
                                    dataKey="departmentName"
                                    tick={<CustomXAxisTick />}
                                    interval={0}
                                    height={60}
                                    tickLine={false}
                                    axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                                />

                                <YAxis
                                    tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                />

                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />

                                <Legend
                                    wrapperStyle={{ paddingTop: 10, fontSize: 14, fontWeight: 600, color: '#374151' }}
                                    iconType="square"
                                    iconSize={14}
                                />

                                <Bar
                                    dataKey="passedCount"
                                    name="Passed"
                                    fill="url(#passGrad)"
                                    stackId="a"
                                    barSize={46}
                                >
                                    <LabelList content={<ValueLabel />} />
                                </Bar>

                                <Bar
                                    dataKey="failedCount"
                                    name="Failed"
                                    fill="url(#failGrad)"
                                    stackId="a"
                                    barSize={46}
                                >
                                    <LabelList content={<ValueLabel />} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 gap-3">
                        <IconChartBar className="h-14 w-14 text-gray-200" />
                        <p className="text-base font-medium">No test attempt data available.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default DepartmentQuizChart;
