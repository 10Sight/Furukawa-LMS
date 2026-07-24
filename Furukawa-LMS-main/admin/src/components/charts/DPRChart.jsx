import React, { useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BarChart as IconBar, PieChart as IconPie, TrendingUp as IconEfficiency, ShieldCheck as IconQuality, RefreshCw as IconRefresh, Filter as IconFilter } from "lucide-react";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useListDailyProductionReportsQuery } from "@/Redux/AllApi/DailyProductionReportApi";

// Initialize 3D module
if (typeof highcharts3d === 'function' && !Highcharts.Chart.prototype.add3DDecoration) {
    highcharts3d(Highcharts);
}

const COLORS = [
    '#0077c2', '#0a114d', '#f29100', '#94a3b8', '#8b5cf6',
    '#0ea5e9', '#1e293b', '#fbbf24', '#64748b', '#a855f7',
    '#3b82f6', '#1e1b4b', '#d97706', '#475569', '#7c3aed',
    '#0284c7', '#0f172a', '#b45309', '#334155', '#6d28d9'
];

// Width (px) reserved per category so un-rotated labels never overlap.
// When categories * SLOT_WIDTH exceeds the plot area, Highcharts' scrollablePlotArea
// kicks in and gives the chart its own horizontal scrollbar instead of rotating labels.
const SLOT_WIDTH = 130;
const MIN_PLOT_WIDTH = 820;

const SummaryTile = ({ label, value, className }) => (
    <div className={`flex items-center justify-between p-2.5 rounded-lg ${className}`}>
        <span className="text-xs font-bold">{label}</span>
        <span className="text-sm font-black">{value}</span>
    </div>
);

const EfficiencyChartCard = ({ data, theme, isFetching }) => {
    const [chartType, setChartType] = useState('bar');
    const isDarkBorder = theme.border === 'border-gray-800';

    const summary = useMemo(() => {
        const totalPlan = data.reduce((sum, item) => sum + (Number(item.plan) || 0), 0);
        const totalActual = data.reduce((sum, item) => sum + (Number(item.actual) || 0), 0);
        const effPct = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0;
        return { totalPlan, totalActual, effPct };
    }, [data]);

    const pieData = useMemo(
        () => data.map(item => ({ name: item.name, y: item.actual || 0, plan: item.plan || 0 })),
        [data]
    );

    const categories = data.map(item => item.name);
    const needsScroll = categories.length * SLOT_WIDTH > MIN_PLOT_WIDTH;

    const barOptions = {
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 450,
            style: { fontFamily: 'inherit' },
            ...(needsScroll && {
                scrollablePlotArea: {
                    minWidth: categories.length * SLOT_WIDTH,
                    scrollPositionX: 0,
                },
            }),
        },
        title: { text: '' },
        xAxis: {
            categories,
            labels: {
                rotation: 0,
                align: 'center',
                autoRotation: false,
                style: { color: '#64748b', fontSize: '11px' }
            },
            lineWidth: 0,
            tickWidth: 0
        },
        yAxis: {
            min: 0,
            title: { text: '' },
            gridLineColor: isDarkBorder ? '#334155' : '#f1f5f9',
            labels: { style: { color: '#64748b' } }
        },
        tooltip: {
            shared: true,
            useHTML: true,
            backgroundColor: theme.card === 'bg-white' ? '#ffffff' : '#1e293b',
            borderColor: '#e2e8f0',
            borderRadius: 12,
            style: { color: theme.textMain === 'text-gray-900' ? '#0f172a' : '#f8fafc' }
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0,
                borderRadius: 4,
                maxPointWidth: 60,
                dataLabels: {
                    enabled: true,
                    style: { fontSize: '11px', fontWeight: 'bold' },
                    crop: false,
                    overflow: 'none'
                }
            }
        },
        series: [
            { name: 'Planned Quantity', data: data.map(item => item.plan), color: '#3b82f6' },
            { name: 'Actual Quantity', data: data.map(item => item.actual), color: '#10b981' }
        ],
        legend: {
            align: 'right',
            verticalAlign: 'top',
            itemStyle: { color: '#64748b', fontSize: '12px' }
        },
        credits: { enabled: false }
    };

    const pieOptions = {
        chart: {
            type: 'pie',
            options3d: { enabled: true, alpha: 0, beta: 0 },
            backgroundColor: 'transparent',
            height: 600
        },
        title: { text: '' },
        tooltip: {
            headerFormat: '<span style="font-size: 12px; font-weight: bold">{point.key}</span><br/>',
            pointFormat: 'Actual: <b>{point.y}</b> ({point.percentage:.1f}%)<br/>Planned: <b>{point.plan}</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                innerSize: 0,
                colors: COLORS,
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y}',
                    style: { color: '#64748b', fontSize: '11px' }
                },
                point: {
                    events: {
                        mouseOver: function () { this.slice(); },
                        mouseOut: function () { this.slice(); }
                    }
                },
                states: { hover: { brightness: 0.1 } }
            }
        },
        series: [{ name: 'Production Share', data: pieData }],
        credits: { enabled: false }
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconEfficiency className="h-5 w-5 text-blue-600" />
                            Efficiency Performance
                        </CardTitle>
                        <CardDescription>Planned vs. Actual production quantities for the selected filters</CardDescription>
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-center">
                        {isFetching && (
                            <div className="flex items-center gap-1.5">
                                <div className="animate-spin w-3 h-3 rounded-full border-b-2 border-blue-500" />
                                <span className="text-[10px] text-blue-500">Refreshing…</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-xl">
                            <Button
                                variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setChartType('bar')}
                                className={`h-8 rounded-lg ${chartType === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                            >
                                <IconBar className="w-3.5 h-3.5 mr-2" />
                                Bar Chart
                            </Button>
                            <Button
                                variant={chartType === 'pie' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setChartType('pie')}
                                className={`h-8 rounded-lg ${chartType === 'pie' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                            >
                                <IconPie className="w-3.5 h-3.5 mr-2" />
                                Pie Chart
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className={`flex flex-col ${chartType === 'pie' ? 'lg:flex-row' : ''} gap-6`}>
                    <div className="flex-1 min-w-0">
                        <HighchartsReact
                            key={chartType}
                            highcharts={Highcharts}
                            options={chartType === 'bar' ? barOptions : pieOptions}
                        />
                    </div>

                    {chartType === 'pie' && data.length > 0 && (
                        <div className="lg:w-96 flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="text-xs font-bold uppercase text-gray-400 mb-2 px-1">Production Details</div>
                            {data.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl border ${theme.border} bg-gray-50/50 flex justify-between items-center hover:bg-gray-50 transition-colors shadow-sm`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                        ></div>
                                        <span className={`text-[11px] font-bold truncate ${theme.textMain}`}>{item.name}</span>
                                    </div>
                                    <div className="flex gap-4 shrink-0 ml-2">
                                        <div className="text-right">
                                            <div className="text-sm font-black text-blue-600">{item.actual}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">Actual</div>
                                        </div>
                                        <div className="text-right border-l pl-4 border-gray-200">
                                            <div className="text-sm font-black text-gray-600">{item.plan}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">Plan</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <SummaryTile label="Planned Qty" value={summary.totalPlan} className="bg-slate-50 text-slate-700" />
                    <SummaryTile label="Actual Qty" value={summary.totalActual} className="bg-blue-50 text-blue-700" />
                    <SummaryTile label="Efficiency %" value={`${summary.effPct}%`} className="bg-emerald-50 text-emerald-700" />
                </div>
            </CardContent>
        </Card>
    );
};

const QualityChartCard = ({ data, theme, isFetching }) => {
    const [chartType, setChartType] = useState('bar');
    const isDarkBorder = theme.border === 'border-gray-800';

    const summary = useMemo(() => {
        const totalProduction = data.reduce((sum, item) => sum + (Number(item.productionQty) || 0), 0);
        const totalDefect = data.reduce((sum, item) => sum + (Number(item.defectQty) || 0), 0);
        const weightedPpm = totalProduction > 0 ? Math.round((totalDefect / totalProduction) * 1000000) : 0;
        return { totalProduction, totalDefect, weightedPpm };
    }, [data]);

    const pieData = useMemo(
        () => data.map(item => ({ name: item.name, y: item.defectQty || 0, productionQty: item.productionQty || 0, ppm: item.ppm || 0 })),
        [data]
    );

    const categories = data.map(item => item.name);
    const needsScroll = categories.length * SLOT_WIDTH > MIN_PLOT_WIDTH;

    const barOptions = {
        chart: {
            type: 'column',
            backgroundColor: 'transparent',
            height: 450,
            style: { fontFamily: 'inherit' },
            ...(needsScroll && {
                scrollablePlotArea: {
                    minWidth: categories.length * SLOT_WIDTH,
                    scrollPositionX: 0,
                },
            }),
        },
        title: { text: '' },
        xAxis: {
            categories,
            labels: {
                rotation: 0,
                align: 'center',
                autoRotation: false,
                style: { color: '#64748b', fontSize: '11px' }
            },
            lineWidth: 0,
            tickWidth: 0
        },
        yAxis: [
            {
                title: { text: 'Quantities', style: { color: '#64748b' } },
                labels: { style: { color: '#64748b' } },
                gridLineColor: isDarkBorder ? '#334155' : '#f1f5f9'
            },
            {
                title: { text: 'PPM', style: { color: '#f59e0b', fontWeight: 'bold' } },
                labels: { style: { color: '#f59e0b' } },
                opposite: true,
                gridLineWidth: 0
            }
        ],
        tooltip: {
            shared: true,
            useHTML: true,
            backgroundColor: theme.card === 'bg-white' ? '#ffffff' : '#1e293b',
            borderColor: '#e2e8f0',
            borderRadius: 12,
            style: { color: theme.textMain === 'text-gray-900' ? '#0f172a' : '#f8fafc' }
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0,
                borderRadius: 4,
                maxPointWidth: 60,
                dataLabels: { enabled: true, style: { fontSize: '10px', fontWeight: 'bold' } }
            },
            spline: {
                dataLabels: {
                    enabled: true,
                    format: '{y} PPM',
                    y: -15,
                    style: { fontSize: '11px', fontWeight: '800', color: '#f59e0b', textOutline: '2px white' }
                },
                marker: { radius: 5, lineWidth: 2, lineColor: '#f59e0b', fillColor: 'white' }
            }
        },
        series: [
            {
                name: 'Production Qty',
                data: data.map(item => item.productionQty),
                color: { linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 }, stops: [[0, '#818cf8'], [1, '#6366f1']] },
                yAxis: 0
            },
            {
                name: 'Defect Qty',
                data: data.map(item => item.defectQty),
                color: { linearGradient: { x1: 0, x2: 0, y1: 0, y2: 1 }, stops: [[0, '#fb7185'], [1, '#ef4444']] },
                yAxis: 0
            },
            {
                name: 'PPM',
                type: 'spline',
                data: data.map(item => item.ppm),
                color: '#f59e0b',
                lineWidth: 4,
                shadow: { color: 'rgba(245, 158, 11, 0.4)', width: 10, offsetX: 0, offsetY: 0 },
                yAxis: 1
            }
        ],
        legend: {
            align: 'right',
            verticalAlign: 'top',
            itemStyle: { color: '#64748b', fontSize: '12px' }
        },
        credits: { enabled: false }
    };

    const pieOptions = {
        chart: {
            type: 'pie',
            options3d: { enabled: true, alpha: 0, beta: 0 },
            backgroundColor: 'transparent',
            height: 600
        },
        title: { text: '' },
        tooltip: {
            headerFormat: '<span style="font-size: 12px; font-weight: bold">{point.key}</span><br/>',
            pointFormat: 'Defects: <b>{point.y}</b> ({point.percentage:.1f}%)<br/>Production: <b>{point.productionQty}</b><br/>PPM: <b style="color: #f59e0b">{point.ppm}</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                depth: 35,
                innerSize: 0,
                colors: COLORS,
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b>: {point.y}',
                    style: { color: '#64748b', fontSize: '11px' }
                },
                point: {
                    events: {
                        mouseOver: function () { this.slice(); },
                        mouseOut: function () { this.slice(); }
                    }
                },
                states: { hover: { brightness: 0.1 } }
            }
        },
        series: [{ name: 'Quality Share', data: pieData }],
        credits: { enabled: false }
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <IconQuality className="h-5 w-5 text-indigo-600" />
                            Quality (Defect Summary)
                        </CardTitle>
                        <CardDescription>Production vs. defect quantities and PPM rate for the selected filters</CardDescription>
                    </div>
                    <div className="flex items-center gap-3 self-start md:self-center">
                        {isFetching && (
                            <div className="flex items-center gap-1.5">
                                <div className="animate-spin w-3 h-3 rounded-full border-b-2 border-indigo-500" />
                                <span className="text-[10px] text-indigo-500">Refreshing…</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-xl">
                            <Button
                                variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setChartType('bar')}
                                className={`h-8 rounded-lg ${chartType === 'bar' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                            >
                                <IconBar className="w-3.5 h-3.5 mr-2" />
                                Bar Chart
                            </Button>
                            <Button
                                variant={chartType === 'pie' ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setChartType('pie')}
                                className={`h-8 rounded-lg ${chartType === 'pie' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                            >
                                <IconPie className="w-3.5 h-3.5 mr-2" />
                                Pie Chart
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                <div className={`flex flex-col ${chartType === 'pie' ? 'lg:flex-row' : ''} gap-6`}>
                    <div className="flex-1 min-w-0">
                        <HighchartsReact
                            key={chartType}
                            highcharts={Highcharts}
                            options={chartType === 'bar' ? barOptions : pieOptions}
                        />
                    </div>

                    {chartType === 'pie' && data.length > 0 && (
                        <div className="lg:w-[450px] flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="text-xs font-bold uppercase text-gray-400 mb-2 px-1">Defect Breakdown</div>
                            {data.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-xl border ${theme.border} bg-gray-50/50 flex justify-between items-center hover:bg-gray-50 transition-colors shadow-sm`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                        ></div>
                                        <span className={`text-[11px] font-bold truncate ${theme.textMain}`}>{item.name}</span>
                                    </div>
                                    <div className="flex gap-4 shrink-0 ml-2">
                                        <div className="text-right">
                                            <div className="text-sm font-black text-red-600">{item.defectQty}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">Defects</div>
                                        </div>
                                        <div className="text-right border-l pl-4 border-gray-200">
                                            <div className="text-sm font-black text-gray-600">{item.productionQty}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">Prod</div>
                                        </div>
                                        <div className="text-right border-l pl-4 border-gray-200">
                                            <div className="text-sm font-black text-amber-600">{item.ppm}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">PPM</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <SummaryTile label="Production Qty" value={summary.totalProduction} className="bg-indigo-50 text-indigo-700" />
                    <SummaryTile label="Defect Qty" value={summary.totalDefect} className="bg-red-50 text-red-700" />
                    <SummaryTile label="Weighted PPM" value={summary.weightedPpm} className="bg-amber-50 text-amber-700" />
                </div>
            </CardContent>
        </Card>
    );
};

// Builds the per-line Efficiency/Quality aggregates the two chart cards expect,
// from the raw report rows returned by the list API.
const buildChartData = (reports) => {
    const effByLine = {};
    const qualByLine = {};

    reports.forEach(report => {
        const sectionLabel = report.sectionName ? `${report.sectionName} - ` : "";
        const lineLabel = report.lineName || report.line || "Unknown Line";
        const shiftLabel = report.shift ? ` (${report.shift})` : "";
        const label = `${sectionLabel}${lineLabel}${shiftLabel}`;

        if (!effByLine[label]) effByLine[label] = { name: label, plan: 0, actual: 0 };
        const delivery = Array.isArray(report.delivery) ? report.delivery : [];
        delivery.forEach(row => {
            effByLine[label].plan += Number(row.plan) || 0;
            effByLine[label].actual += Number(row.total) || 0;
        });

        if (!qualByLine[label]) qualByLine[label] = { name: label, productionQty: 0, defectQty: 0, ppm: 0 };
        const internalDefect = report.quality?.internalDefect || {};
        qualByLine[label].productionQty += Number(internalDefect.productionQty) || 0;
        qualByLine[label].defectQty += Number(internalDefect.defectQty) || 0;
    });

    const efficiencyData = Object.values(effByLine);
    const qualityData = Object.values(qualByLine).map(item => ({
        ...item,
        ppm: item.productionQty > 0 ? Math.round((item.defectQty / item.productionQty) * 1000000) : 0
    }));

    return {
        efficiencyData: efficiencyData.length ? efficiencyData : [{ name: 'No Data', plan: 0, actual: 0 }],
        qualityData: qualityData.length ? qualityData : [{ name: 'No Data', productionQty: 0, defectQty: 0, ppm: 0 }]
    };
};

// Efficiency and Quality snapshots, stacked full-width (not tabbed) so both are visible
// at once. Carries its own Date Range / Department / Section / Line / Shift filter bar,
// independent of the reports-table filters — defaults to today's date.
const DPRChart = ({ theme = {} }) => {
    const today = format(new Date(), "yyyy-MM-dd");

    const [chartStartDate, setChartStartDate] = useState(today);
    const [chartEndDate, setChartEndDate] = useState(today);
    const [chartDepartment, setChartDepartment] = useState("all");
    const [chartSection, setChartSection] = useState("all");
    const [chartLine, setChartLine] = useState("all");
    const [chartShift, setChartShift] = useState("all");

    const { data: deptData } = useGetAllDepartmentsQuery({ limit: 100 });
    const departments = deptData?.data?.departments || [];

    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        chartDepartment,
        { skip: !chartDepartment || chartDepartment === 'all' }
    );
    const sections = sectionData?.data || [];

    const { data: lineData } = useGetLinesBySectionQuery(
        chartSection,
        { skip: !chartSection || chartSection === 'all' }
    );
    const lines = lineData?.data || [];

    const { data: chartListData, isFetching } = useListDailyProductionReportsQuery(
        {
            startDate: chartStartDate || undefined,
            endDate: chartEndDate || undefined,
            departmentId: chartDepartment === 'all' ? undefined : chartDepartment,
            sectionId: chartSection === 'all' ? undefined : chartSection,
            lineId: chartLine === 'all' ? undefined : chartLine,
            shift: chartShift === 'all' ? undefined : chartShift,
            limit: 1000,
            offset: 0
        },
        { skip: !chartStartDate || !chartEndDate }
    );

    const { efficiencyData, qualityData } = useMemo(
        () => buildChartData(chartListData?.data || []),
        [chartListData]
    );

    const handleReset = () => {
        setChartStartDate(today);
        setChartEndDate(today);
        setChartDepartment("all");
        setChartSection("all");
        setChartLine("all");
        setChartShift("all");
    };

    return (
        <div className="space-y-6">
            {/* Chart-specific filter bar — independent of the reports-table filters */}
            <div className={`rounded-xl border ${theme.border} ${theme.card} shadow-sm overflow-hidden`}>
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                            <IconFilter className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                            <div className={`text-sm font-bold ${theme.textMain}`}>Chart Filters</div>
                            <div className={`text-xs ${theme.textMuted}`}>Scopes only the charts below — defaults to today</div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800 self-end sm:self-auto"
                        onClick={handleReset}
                    >
                        <IconRefresh className="h-3.5 w-3.5 mr-1.5" />
                        Reset
                    </Button>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">From Date</Label>
                        <Input
                            type="date"
                            value={chartStartDate}
                            max={chartEndDate || undefined}
                            onChange={(e) => setChartStartDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">To Date</Label>
                        <Input
                            type="date"
                            value={chartEndDate}
                            min={chartStartDate || undefined}
                            onChange={(e) => setChartEndDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Department</Label>
                        <Select
                            value={chartDepartment}
                            onValueChange={(val) => {
                                setChartDepartment(val);
                                setChartSection("all");
                                setChartLine("all");
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map((dept) => (
                                    <SelectItem key={dept.id || dept._id} value={dept.id || dept._id}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Section</Label>
                        <Select
                            value={chartSection}
                            onValueChange={(val) => {
                                setChartSection(val);
                                setChartLine("all");
                            }}
                            disabled={!chartDepartment || chartDepartment === 'all'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {sections.map((sec) => (
                                    <SelectItem key={sec.id || sec._id} value={sec.id || sec._id}>
                                        {sec.name} ({sec.category})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Line</Label>
                        <Select
                            value={chartLine}
                            onValueChange={setChartLine}
                            disabled={!chartSection || chartSection === 'all'}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All Lines" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Lines</SelectItem>
                                {lines.map((l) => (
                                    <SelectItem key={l.id || l._id} value={l.id || l._id}>
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Shift</Label>
                        <Select value={chartShift} onValueChange={setChartShift}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Shifts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Shifts</SelectItem>
                                <SelectItem value="A">A-Shift</SelectItem>
                                <SelectItem value="B">B-Shift</SelectItem>
                                <SelectItem value="C">C-Shift</SelectItem>
                                <SelectItem value="G">G-Shift</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <EfficiencyChartCard data={efficiencyData} theme={theme} isFetching={isFetching} />
                <QualityChartCard data={qualityData} theme={theme} isFetching={isFetching} />
            </div>
        </div>
    );
};

export default DPRChart;
