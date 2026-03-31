import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ChevronLeft,
    ChevronRight,
    Save,
    Download,
    Loader2,
    RefreshCw
} from "lucide-react";
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "react-hot-toast";
import axiosInstance from '@/Helper/axiosInstance';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';

const Report = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tableData, setTableData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch Departments from API
    const { data: deptData } = useGetAllDepartmentsQuery();
    const departments = deptData?.data?.departments || [];

    const handleMonthChange = (offset) => {
        setCurrentDate(prev => {
            const nextDate = new Date(prev);
            nextDate.setMonth(nextDate.getMonth() + offset);
            return nextDate;
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).split('/').join('.');
    };

    const getDayName = (date) => {
        return date.toLocaleDateString('en-GB', { weekday: 'short' });
    };

    const headerDates = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const dates = [];

        // 1. Previous month last date (if needed for context, usually shown as first col)
        const prevMonthLastDate = new Date(year, month, 0);
        dates.push(prevMonthLastDate);

        // 2. All days of current month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            dates.push(new Date(year, month, day));
        }

        return dates.map(date => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const localKey = `${y}-${m}-${d}`;

            return {
                fullDate: localKey,
                displayDate: formatDate(date),
                dayName: getDayName(date),
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            };
        });
    }, [currentDate]);

    // Fetch report data when date changes
    useEffect(() => {
        const fetchReport = async () => {
            setIsLoading(true);
            try {
                const month = currentDate.getMonth() + 1;
                const year = currentDate.getFullYear();
                const response = await axiosInstance.get(`/api/reports/headcount/data`, {
                    params: { month, year } // departmentId removed for global report
                });
                if (response.data?.success) {
                    setTableData(response.data.data.tableData || {});
                }
            } catch (error) {
                console.error("Fetch error:", error);
                setTableData({});
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [currentDate]);

    const handleInputChange = (rowLabel, dateKey, value) => {
        setTableData(prev => {
            const newData = {
                ...prev,
                [`${rowLabel}_${dateKey}`]: value
            };

            // Calculate Gap if Actual or Expected Separations change
            if (rowLabel === "Actual Separations (Cumulative)" || rowLabel === "Expected Separations (Cumulative)") {
                const actual = parseFloat(newData[`Actual Separations (Cumulative)_${dateKey}`]) || 0;
                const expected = parseFloat(newData[`Expected Separations (Cumulative)_${dateKey}`]) || 0;
                newData[`Gap_${dateKey}`] = (actual - expected).toFixed(0);
            }

            return newData;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        const toastId = toast.loading("Saving Headcount Report...");
        try {
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            await axiosInstance.post('/api/reports/headcount', {
                month,
                year,
                tableData
            });
            toast.success("Headcount Report saved successfully!", { id: toastId });
        } catch (error) {
            toast.error("Failed to save report.", { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSync = async () => {
        setIsLoading(true);
        const toastId = toast.loading("Syncing real data...");
        try {
            const month = currentDate.getMonth() + 1;
            const year = currentDate.getFullYear();
            const response = await axiosInstance.get(`/api/reports/headcount/sync`, {
                params: { month, year }
            });

            if (response.data?.success) {
                const syncedData = response.data.data.tableData;

                setTableData(prev => {
                    const merged = { ...prev, ...syncedData };

                    // Recalculate all gaps after sync
                    headerDates.forEach(dateObj => {
                        const dateKey = dateObj.fullDate;
                        const actual = parseFloat(merged[`Actual Separations (Cumulative)_${dateKey}`]) || 0;
                        const expected = parseFloat(merged[`Expected Separations (Cumulative)_${dateKey}`]) || 0;
                        merged[`Gap_${dateKey}`] = (actual - expected).toFixed(0);
                    });

                    return merged;
                });
                toast.success("Data synced from Attendance & User logs!", { id: toastId });
            }
        } catch (error) {
            toast.error("Failed to sync data.", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        exportToExcel("Associates Headcount Report", {
            date: currentDate.toISOString().split('T')[0]
        });
    };

    const reportingEnabledDepts = departments.filter(d => d.isReportingEnabled);

    const rows = useMemo(() => {
        const baseRows = [
            { label: "Particulars", type: "header", bold: true },
            { type: "spacer" },
            { label: "Headcount required as per production plan", bold: true },
            { label: "Headcount required as per sale plan", bold: true },
            ...reportingEnabledDepts.map(dept => ({
                label: `${dept.name} Headcount required`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Hiring Plan", align: "right" },
            { type: "spacer" },
            { label: "Hiring Actual", align: "right", bg: "bg-orange-100" },
            { type: "spacer" },
            { label: "Handover Plan", align: "right" },
            { label: "Handover Actual", align: "right", bg: "bg-orange-100" },
            { type: "spacer" },
            { label: "Headcount available", bold: true },
        ];

        // Add dynamic department rows
        reportingEnabledDepts.forEach(dept => {
            baseRows.push({ label: `${dept.name} Headcount available`, bg: "bg-blue-50" });
        });

        baseRows.push(
            { type: "spacer" },
            { label: "Present in Training Cell", bold: true, align: "center", borderY: true },
            { label: "Attrition & Absenteeism of Training Cell (Nos)", align: "right" },
            { label: "Handed-over after training (Cumulative)", align: "right" },
            ...reportingEnabledDepts.map(dept => ({
                label: `${dept.name} Handed-over after training (Cumulative)`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Separated (Cumulative)", align: "right" },
            // Add dynamic departmental separated rows
            ...reportingEnabledDepts.map(dept => ({
                label: `${dept.name} Separated (Cumulative)`,
                bg: "bg-blue-50"
            })),
            { label: "Actual Separations (Cumulative)", bg: "bg-amber-300", align: "right" },
            { label: "Expected Separations (Cumulative)", bg: "bg-amber-100", align: "right" },
            { label: "Gap", bg: "bg-amber-300", align: "right" },
            { type: "spacer" },
            { label: "Absent", align: "right" },
            // Add dynamic departmental absent rows
            ...reportingEnabledDepts.map(dept => ({
                label: `${dept.name} absent`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Net Available Headcount (Total)", bold: true },
            { type: "spacer" },
            { label: "Net Available Headcount Above 3 Months", bold: true },
            // Add dynamic departmental 3-month headcount rows
            ...reportingEnabledDepts.map(dept => ({
                label: `${dept.name} Net Available Headcount Above 3 Months`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Absenteeism %", bold: true },
            // Add dynamic departmental absenteeism % rows
            ...reportingEnabledDepts.map(dept => ({
                label: `${dept.name} Absenteeism %`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Total Headcount (Present + Absent)", align: "right" },
            { label: "Left in nos (Daily)", align: "right" },
            { label: "Attrition % Daily", align: "right" },
            { label: "Attrition % Cumulative", bold: true },
            { label: "Weekly Attrition %", align: "right" },
            { type: "spacer" },
            { label: "Shift-wise Breakdown of Available Manpower", bold: true },
            { label: "A-Shift", align: "right" },
            { label: "G-Shift", align: "right" },
            { label: "B-Shift", align: "right" },
            { label: "C-Shift", align: "right" },
            { type: "spacer" },
            { label: "Shift-wise Breakdown of Assigned Manpower", bold: true },
            { label: "A-Shift", align: "right" },
            { label: "G-Shift", align: "right" },
            { label: "B-Shift", align: "right" },
            { label: "C-Shift", align: "right" },
            { type: "spacer" },
            { label: "Shift-wise Attendance", bold: true },
            { label: "A-Shift", align: "right" },
            { label: "G-Shift", align: "right" },
            { label: "B-Shift", align: "right" },
            { label: "C-Shift", align: "right" },
            { type: "spacer" }
        );

        return baseRows;
    }, [reportingEnabledDepts]);

    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                <h1 className="text-xl font-bold text-red-600 uppercase">
                    ASSOCIATES HEADCOUNT: WIRING HARNESS MANUFACTURING
                </h1>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => handleMonthChange(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-semibold text-lg bg-gray-50 px-4 py-1 rounded border min-w-[150px] text-center">
                        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => handleMonthChange(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-px bg-gray-300 mx-2" />
                    <Button
                        variant="outline"
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        onClick={handleSync}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Sync Data
                    </Button>
                    <Button
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleExport}
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-300 shadow-sm bg-white rounded-lg">
                <table className="w-full text-xs border-collapse">
                    <thead>
                        {/* Row 1: Day Names */}
                        <tr>
                            <th className="border border-gray-300 p-2 bg-yellow-100 min-w-[300px] text-left font-bold sticky left-0 z-20 h-8">
                            </th>
                            {headerDates.map((dateObj, index) => (
                                <th
                                    key={`day-${index}`}
                                    className={`
                    border border-gray-300 p-1 min-w-[60px] text-center font-medium
                    ${index === 0 ? 'bg-yellow-100' : 'bg-gray-100'}
                    ${dateObj.isWeekend ? 'bg-gray-200 text-red-600' : ''}
                  `}
                                >
                                    {dateObj.dayName}
                                </th>
                            ))}
                        </tr>
                        {/* Row 2: Dates */}
                        <tr>
                            <th className="border border-gray-300 px-3 py-2 bg-yellow-100 min-w-[300px] text-left font-bold sticky left-0 z-20">
                                Particulars
                            </th>
                            {headerDates.map((dateObj, index) => (
                                <th
                                    key={`date-${index}`}
                                    className={`
                    border border-gray-300 p-1 text-center font-bold
                    ${index === 0 ? 'bg-yellow-300' : 'bg-gray-50'}
                  `}
                                >
                                    {dateObj.displayDate}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => {
                            if (row.type === 'spacer') {
                                return (
                                    <tr key={`spacer-${rowIndex}`} className="h-4 bg-gray-50">
                                        <td className="border border-gray-300 sticky left-0 z-10 bg-gray-50"></td>
                                        {headerDates.map((_, colIndex) => (
                                            <td key={`spacer-${rowIndex}-${colIndex}`} className="border border-gray-300"></td>
                                        ))}
                                    </tr>
                                );
                            }

                            const rowClass = row.bg || 'bg-white';

                            return (
                                <tr key={`row-${rowIndex}`} className={`hover:bg-blue-50 transition-colors ${rowClass}`}>
                                    <td
                                        className={`
                       border border-gray-300 px-3 py-1.5 
                       sticky left-0 z-10 
                       ${rowClass}
                       ${row.bold ? 'font-bold' : ''} 
                       ${row.align === 'center' ? 'text-center' : row.align === 'right' ? 'text-right' : 'text-left'}
                       ${row.borderY ? 'border-y-2 border-y-green-700' : ''}
                       whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]
                     `}
                                    >
                                        {row.type === 'header' ? null : row.label}
                                    </td>

                                    {headerDates.map((dateObj, colIndex) => {
                                        const cellKey = dateObj.fullDate;
                                        const value = tableData[`${row.label}_${cellKey}`] || '';
                                        const isPrevMonthCol = colIndex === 0;

                                        return (
                                            <td
                                                key={`${rowIndex}-${colIndex}`}
                                                className={`
                           border border-gray-300 p-0 text-center relative
                           ${isPrevMonthCol ? (row.bg ? row.bg : 'bg-yellow-50') : ''}
                         `}
                                            >
                                                {row.type !== 'header' && (
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => handleInputChange(row.label, cellKey, e.target.value)}
                                                        className={`
                                 w-full h-full px-1 py-1.5 bg-transparent text-center focus:outline-none focus:bg-blue-100 transition-colors
                                 ${row.bold ? 'font-bold' : ''}
                               `}
                                                        style={{ minHeight: '28px' }}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isLoading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-50 rounded-lg">
                    <div className="bg-white p-4 rounded-full shadow-lg border">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default Report;
