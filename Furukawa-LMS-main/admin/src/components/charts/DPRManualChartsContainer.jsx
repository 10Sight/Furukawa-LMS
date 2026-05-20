import React, { useState, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { toast } from 'react-hot-toast';
import { 
    Activity as IconActivity, 
    AlertTriangle as IconAlert, 
    CheckCircle as IconCheck, 
    Calendar as IconCalendar, 
    Save as IconSave 
} from "lucide-react";
import { 
    useGetDPRManualStatsQuery, 
    useSaveDPRManualStatsMutation 
} from "@/Redux/AllApi/DailyProductionReportApi";

const DPRManualChartsContainer = ({ dashboardDate, theme }) => {
    // Default local date state initialized from the parent dashboard
    const [selectedDate, setSelectedDate] = useState(dashboardDate || new Date().toISOString().split('T')[0]);

    // Keep selectedDate in sync if the parent dashboard date changes
    useEffect(() => {
        if (dashboardDate) {
            setSelectedDate(dashboardDate);
        }
    }, [dashboardDate]);

    // Fetch the 7-day trend and selected date record from the database
    const { data: statsResp, isLoading, isFetching } = useGetDPRManualStatsQuery(
        { date: selectedDate },
        { skip: !selectedDate }
    );

    const [saveManualStats, { isLoading: isSaving }] = useSaveDPRManualStatsMutation();

    // Local form state for bound data inputs
    const [formValues, setFormValues] = useState({
        date: selectedDate,
        srcEffPlan: 0,
        srcEffActual: 0,
        srcEffTarget: 95.0,
        srcDefAuto: 0,
        srcDefManual: 0,
        srcDefJoint: 0,
        srcDefProduction: 0,
        srcDefTarget: 5.9,
        qaDefAuto: 0,
        qaDefManual: 0,
        qaDefJoint: 0,
        qaDefProduction: 0,
        qaDefTarget: 5.9,
        qaEffPlan: 0,
        qaEffActual: 0,
        qaEffTarget: 95.0
    });

    // Populate local form state when database response loads or selectedDate changes
    useEffect(() => {
        if (statsResp?.data?.selectedRecord) {
            const rec = statsResp.data.selectedRecord;
            setFormValues({
                date: selectedDate,
                srcEffPlan: rec.srcEffPlan ?? 0,
                srcEffActual: rec.srcEffActual ?? 0,
                srcEffTarget: rec.srcEffTarget ?? 95.0,
                srcDefAuto: rec.srcDefAuto ?? 0,
                srcDefManual: rec.srcDefManual ?? 0,
                srcDefJoint: rec.srcDefJoint ?? 0,
                srcDefProduction: rec.srcDefProduction ?? 0,
                srcDefTarget: rec.srcDefTarget ?? 5.9,
                qaDefAuto: rec.qaDefAuto ?? 0,
                qaDefManual: rec.qaDefManual ?? 0,
                qaDefJoint: rec.qaDefJoint ?? 0,
                qaDefProduction: rec.qaDefProduction ?? 0,
                qaDefTarget: rec.qaDefTarget ?? 5.9,
                qaEffPlan: rec.qaEffPlan ?? 0,
                qaEffActual: rec.qaEffActual ?? 0,
                qaEffTarget: rec.qaEffTarget ?? 95.0
            });
        }
    }, [statsResp, selectedDate]);

    // Handle input change
    const handleInputChange = (field, value) => {
        setFormValues(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save statistics to database
    const handleSave = async (e) => {
        if (e) e.preventDefault();
        try {
            const payload = {
                ...formValues,
                date: selectedDate
            };
            const res = await saveManualStats(payload).unwrap();
            if (res?.success) {
                toast.success("Manual statistics saved successfully!");
            } else {
                toast.error("Failed to save manual statistics.");
            }
        } catch (error) {
            console.error("Save manual stats error:", error);
            toast.error(error?.data?.message || "Error saving manual statistics.");
        }
    };

    // Calculated fields helper variables
    const srcCalculatedEff = formValues.srcEffPlan > 0 
        ? Math.round((formValues.srcEffActual / formValues.srcEffPlan) * 1000) / 10 
        : 0;

    const srcCalculatedTotalDefects = Number(formValues.srcDefAuto) + Number(formValues.srcDefManual) + Number(formValues.srcDefJoint);
    const srcCalculatedPPM = formValues.srcDefProduction > 0 
        ? Math.round((srcCalculatedTotalDefects / formValues.srcDefProduction) * 10000000) / 10 
        : 0;

    const qaCalculatedTotalDefects = Number(formValues.qaDefAuto) + Number(formValues.qaDefManual) + Number(formValues.qaDefJoint);
    const qaCalculatedPPM = formValues.qaDefProduction > 0 
        ? Math.round((qaCalculatedTotalDefects / formValues.qaDefProduction) * 10000000) / 10 
        : 0;

    const qaCalculatedEff = formValues.qaEffPlan > 0 
        ? Math.round((formValues.qaEffActual / formValues.qaEffPlan) * 1000) / 10 
        : 0;

    // Get trend list (always 7 days)
    const trend = statsResp?.data?.trend || [];
    const trendDates = trend.map(t => {
        const d = new Date(t.date);
        return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    });

    // Helper for formatting highcharts
    const chartTheme = {
        bgColor: 'transparent',
        textColor: theme?.text?.includes('dark') ? '#f1f5f9' : '#1e293b',
        gridLineColor: theme?.text?.includes('dark') ? '#334155' : '#e2e8f0',
    };

    // ----------------------------------------------------
    // Chart 1 Options: SRC Efficiency Performance
    // ----------------------------------------------------
    const srcEffChartOptions = {
        chart: { type: 'column', backgroundColor: chartTheme.bgColor, height: 230 },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
            categories: trendDates,
            labels: { style: { color: chartTheme.textColor, fontWeight: 'bold' } },
            gridLineWidth: 0
        },
        yAxis: [
            {
                title: { text: 'Quantity', style: { color: chartTheme.textColor } },
                labels: { style: { color: chartTheme.textColor } },
                gridLineColor: chartTheme.gridLineColor,
                min: 0
            },
            {
                title: { text: 'Efficiency (%)', style: { color: chartTheme.textColor } },
                labels: { style: { color: chartTheme.textColor } },
                opposite: true,
                min: 0,
                max: 100,
                gridLineWidth: 0
            }
        ],
        tooltip: { shared: true },
        plotOptions: {
            series: {
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: false
                        }
                    }
                }
            }
        },
        series: [
            {
                name: 'Planned Qty',
                type: 'column',
                data: trend.map(t => t.srcEffPlan),
                color: '#94a3b8',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Actual Qty',
                type: 'column',
                data: trend.map(t => t.srcEffActual),
                color: '#3b82f6',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Actual Efficiency',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => t.srcEffPlan > 0 ? Math.round((t.srcEffActual / t.srcEffPlan) * 1000) / 10 : 0),
                color: '#10b981',
                tooltip: { valueSuffix: '%' }
            },
            {
                name: 'Target %',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => t.srcEffTarget),
                color: '#ef4444',
                dashStyle: 'ShortDash',
                tooltip: { valueSuffix: '%' }
            }
        ]
    };

    // ----------------------------------------------------
    // Chart 2 Options: SRC Defect Summary
    // ----------------------------------------------------
    const srcDefChartOptions = {
        chart: { backgroundColor: chartTheme.bgColor, height: 230 },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
            categories: trendDates,
            labels: { style: { color: chartTheme.textColor, fontWeight: 'bold' } },
            gridLineWidth: 0
        },
        yAxis: [
            {
                title: { text: 'Defect Qty', style: { color: chartTheme.textColor } },
                labels: { style: { color: chartTheme.textColor } },
                gridLineColor: chartTheme.gridLineColor,
                min: 0
            },
            {
                title: { text: 'PPM', style: { color: '#f59e0b', fontWeight: 'bold' } },
                labels: { style: { color: chartTheme.textColor } },
                opposite: true,
                min: 0,
                gridLineWidth: 0
            }
        ],
        tooltip: { shared: true },
        plotOptions: {
            series: {
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: false
                        }
                    }
                }
            }
        },
        series: [
            {
                name: 'Defect - Auto',
                type: 'column',
                data: trend.map(t => t.srcDefAuto),
                color: '#f59e0b',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Defect - Manual',
                type: 'column',
                data: trend.map(t => t.srcDefManual),
                color: '#3b82f6',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Defect - Joint',
                type: 'column',
                data: trend.map(t => t.srcDefJoint),
                color: '#10b981',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Defect PPM',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => {
                    const totalDef = Number(t.srcDefAuto || 0) + Number(t.srcDefManual || 0) + Number(t.srcDefJoint || 0);
                    return t.srcDefProduction > 0 ? Math.round((totalDef / t.srcDefProduction) * 1000000) : 0;
                }),
                color: '#8b5cf6',
                tooltip: { valueSuffix: ' PPM' }
            },
            {
                name: 'Target PPM',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => t.srcDefTarget),
                color: '#ef4444',
                dashStyle: 'ShortDash',
                tooltip: { valueSuffix: ' PPM' }
            }
        ]
    };

    // ----------------------------------------------------
    // Chart 3 Options: Quality Defect Summary
    // ----------------------------------------------------
    const qaDefChartOptions = {
        chart: { backgroundColor: chartTheme.bgColor, height: 230 },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
            categories: trendDates,
            labels: { style: { color: chartTheme.textColor, fontWeight: 'bold' } },
            gridLineWidth: 0
        },
        yAxis: [
            {
                title: { text: 'Defect Qty', style: { color: chartTheme.textColor } },
                labels: { style: { color: chartTheme.textColor } },
                gridLineColor: chartTheme.gridLineColor,
                min: 0
            },
            {
                title: { text: 'PPM', style: { color: '#f59e0b', fontWeight: 'bold' } },
                labels: { style: { color: chartTheme.textColor } },
                opposite: true,
                min: 0,
                gridLineWidth: 0
            }
        ],
        tooltip: { shared: true },
        plotOptions: {
            series: {
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: false
                        }
                    }
                }
            }
        },
        series: [
            {
                name: 'Defect - Auto',
                type: 'column',
                data: trend.map(t => t.qaDefAuto),
                color: '#f59e0b',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Defect - Manual',
                type: 'column',
                data: trend.map(t => t.qaDefManual),
                color: '#3b82f6',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Defect - Joint',
                type: 'column',
                data: trend.map(t => t.qaDefJoint),
                color: '#10b981',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Defect PPM',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => {
                    const totalDef = Number(t.qaDefAuto || 0) + Number(t.qaDefManual || 0) + Number(t.qaDefJoint || 0);
                    return t.qaDefProduction > 0 ? Math.round((totalDef / t.qaDefProduction) * 1000000) : 0;
                }),
                color: '#8b5cf6',
                tooltip: { valueSuffix: ' PPM' }
            },
            {
                name: 'Target PPM',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => t.qaDefTarget),
                color: '#ef4444',
                dashStyle: 'ShortDash',
                tooltip: { valueSuffix: ' PPM' }
            }
        ]
    };

    // ----------------------------------------------------
    // Chart 4 Options: Quality Efficiency Performance
    // ----------------------------------------------------
    const qaEffChartOptions = {
        chart: { type: 'column', backgroundColor: chartTheme.bgColor, height: 230 },
        title: { text: null },
        credits: { enabled: false },
        xAxis: {
            categories: trendDates,
            labels: { style: { color: chartTheme.textColor, fontWeight: 'bold' } },
            gridLineWidth: 0
        },
        yAxis: [
            {
                title: { text: 'Quantity', style: { color: chartTheme.textColor } },
                labels: { style: { color: chartTheme.textColor } },
                gridLineColor: chartTheme.gridLineColor,
                min: 0
            },
            {
                title: { text: 'Efficiency (%)', style: { color: chartTheme.textColor } },
                labels: { style: { color: chartTheme.textColor } },
                opposite: true,
                min: 0,
                max: 100,
                gridLineWidth: 0
            }
        ],
        tooltip: { shared: true },
        plotOptions: {
            series: {
                marker: {
                    enabled: false,
                    states: {
                        hover: {
                            enabled: false
                        }
                    }
                }
            }
        },
        series: [
            {
                name: 'Planned Qty',
                type: 'column',
                data: trend.map(t => t.qaEffPlan),
                color: '#94a3b8',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Actual Qty',
                type: 'column',
                data: trend.map(t => t.qaEffActual),
                color: '#ec4899',
                dataLabels: { enabled: true, format: '{y}' }
            },
            {
                name: 'Actual Efficiency',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => t.qaEffPlan > 0 ? Math.round((t.qaEffActual / t.qaEffPlan) * 1000) / 10 : 0),
                color: '#8b5cf6',
                tooltip: { valueSuffix: '%' }
            },
            {
                name: 'Target %',
                type: 'spline',
                yAxis: 1,
                data: trend.map(t => t.qaEffTarget),
                color: '#ef4444',
                dashStyle: 'ShortDash',
                tooltip: { valueSuffix: '%' }
            }
        ]
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading manual stats...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-8">
            {/* Top Date Selection Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <IconActivity className="w-5 h-5 text-blue-500" />
                        Manual Performance & Quality KPI Charts
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Enter and view daily metrics, efficiency achievements, and PPM defect trends for SRC & Quality.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl">
                    <IconCalendar className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Selected Date:</span>
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                    />
                </div>
            </div>

            {/* Grid for the 4 charts */}
            <div className="grid grid-cols-1 gap-6">
                
                {/* 1. SRC Efficiency Performance */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                            SRC Efficiency Performance Chart
                        </h3>
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full">SRC Dept</span>
                    </div>
                    
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                        {/* Form portion */}
                        <div className="space-y-3 flex flex-col justify-between border-r border-slate-100 dark:border-slate-800/80 pr-0 lg:pr-4">
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Plan Qty</label>
                                    <input 
                                        type="number" 
                                        value={formValues.srcEffPlan}
                                        onChange={(e) => handleInputChange('srcEffPlan', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Actual Qty</label>
                                    <input 
                                        type="number" 
                                        value={formValues.srcEffActual}
                                        onChange={(e) => handleInputChange('srcEffActual', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Target (%)</label>
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            value={formValues.srcEffTarget}
                                            onChange={(e) => handleInputChange('srcEffTarget', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Calculated (%)</label>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm font-bold text-blue-600 dark:text-blue-400 text-center">
                                            {srcCalculatedEff}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                            >
                                <IconSave className="w-3.5 h-3.5" />
                                {isSaving ? "Saving..." : "Save SRC Efficiency"}
                            </button>
                        </div>
                        
                        {/* Chart portion */}
                        <div className="flex items-center justify-center">
                            <div className="w-full">
                                <HighchartsReact highcharts={Highcharts} options={srcEffChartOptions} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. SRC Defect Summary */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                            SRC Defect Summary Chart
                        </h3>
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">SRC Quality</span>
                    </div>
                    
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                        {/* Form portion */}
                        <div className="space-y-2 flex flex-col justify-between border-r border-slate-100 dark:border-slate-800/80 pr-0 lg:pr-4">
                            <div className="space-y-1.5">
                                <div className="grid grid-cols-3 gap-1">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect-Auto</label>
                                        <input 
                                            type="number" 
                                            value={formValues.srcDefAuto}
                                            onChange={(e) => handleInputChange('srcDefAuto', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect-Man</label>
                                        <input 
                                            type="number" 
                                            value={formValues.srcDefManual}
                                            onChange={(e) => handleInputChange('srcDefManual', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect-Joint</label>
                                        <input 
                                            type="number" 
                                            value={formValues.srcDefJoint}
                                            onChange={(e) => handleInputChange('srcDefJoint', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Total Defect</label>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold text-center text-slate-700 dark:text-slate-200">
                                            {srcCalculatedTotalDefects}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Total Prod</label>
                                        <input 
                                            type="number" 
                                            value={formValues.srcDefProduction}
                                            onChange={(e) => handleInputChange('srcDefProduction', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Target PPM</label>
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            value={formValues.srcDefTarget}
                                            onChange={(e) => handleInputChange('srcDefTarget', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect PPM</label>
                                        <div className="w-full bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center">
                                            {srcCalculatedPPM}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-2 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                            >
                                <IconSave className="w-3.5 h-3.5" />
                                {isSaving ? "Saving..." : "Save SRC Defects"}
                            </button>
                        </div>
                        
                        {/* Chart portion */}
                        <div className="flex items-center justify-center">
                            <div className="w-full">
                                <HighchartsReact highcharts={Highcharts} options={srcDefChartOptions} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Quality Defect Summary */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            Quality (Quality Defect Summary) Chart
                        </h3>
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded-full">Quality QA</span>
                    </div>
                    
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                        {/* Form portion */}
                        <div className="space-y-2 flex flex-col justify-between border-r border-slate-100 dark:border-slate-800/80 pr-0 lg:pr-4">
                            <div className="space-y-1.5">
                                <div className="grid grid-cols-3 gap-1">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect-Auto</label>
                                        <input 
                                            type="number" 
                                            value={formValues.qaDefAuto}
                                            onChange={(e) => handleInputChange('qaDefAuto', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect-Man</label>
                                        <input 
                                            type="number" 
                                            value={formValues.qaDefManual}
                                            onChange={(e) => handleInputChange('qaDefManual', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect-Joint</label>
                                        <input 
                                            type="number" 
                                            value={formValues.qaDefJoint}
                                            onChange={(e) => handleInputChange('qaDefJoint', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Total Defect</label>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold text-center text-slate-700 dark:text-slate-200">
                                            {qaCalculatedTotalDefects}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Total Prod</label>
                                        <input 
                                            type="number" 
                                            value={formValues.qaDefProduction}
                                            onChange={(e) => handleInputChange('qaDefProduction', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Target PPM</label>
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            value={formValues.qaDefTarget}
                                            onChange={(e) => handleInputChange('qaDefTarget', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Defect PPM</label>
                                        <div className="w-full bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 text-center">
                                            {qaCalculatedPPM}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg p-2 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                            >
                                <IconSave className="w-3.5 h-3.5" />
                                {isSaving ? "Saving..." : "Save QA Defects"}
                            </button>
                        </div>
                        
                        {/* Chart portion */}
                        <div className="flex items-center justify-center">
                            <div className="w-full">
                                <HighchartsReact highcharts={Highcharts} options={qaDefChartOptions} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Quality Efficiency Performance */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    <div className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                            Quality Efficiency Performance Chart
                        </h3>
                        <span className="text-[10px] bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 font-bold px-2 py-0.5 rounded-full">Quality Dept</span>
                    </div>
                    
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                        {/* Form portion */}
                        <div className="space-y-3 flex flex-col justify-between border-r border-slate-100 dark:border-slate-800/80 pr-0 lg:pr-4">
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Plan Qty</label>
                                    <input 
                                        type="number" 
                                        value={formValues.qaEffPlan}
                                        onChange={(e) => handleInputChange('qaEffPlan', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Actual Qty</label>
                                    <input 
                                        type="number" 
                                        value={formValues.qaEffActual}
                                        onChange={(e) => handleInputChange('qaEffActual', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Target (%)</label>
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            value={formValues.qaEffTarget}
                                            onChange={(e) => handleInputChange('qaEffTarget', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Calculated (%)</label>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm font-bold text-pink-600 dark:text-pink-400 text-center">
                                            {qaCalculatedEff}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg p-2 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                            >
                                <IconSave className="w-3.5 h-3.5" />
                                {isSaving ? "Saving..." : "Save QA Efficiency"}
                            </button>
                        </div>
                        
                        {/* Chart portion */}
                        <div className="flex items-center justify-center">
                            <div className="w-full">
                                <HighchartsReact highcharts={Highcharts} options={qaEffChartOptions} />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DPRManualChartsContainer;
