import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ReportClubbing from "../Dashboard/ReportClubbing";
import {
    ChevronLeft,
    ChevronRight,
    Save,
    Download,
    Loader2,
    RefreshCw,
    Mail
} from "lucide-react";
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "sonner";
import axiosInstance from '@/Helper/axiosInstance';
import { useGetAllClubsQuery } from '@/Redux/AllApi/ReportClubApi';

const SYNCED_READONLY_ROWS = ["Hiring Actual", "Handover Plan", "Handover Actual", "Rejoining", "Present in Training Cell", "Rejoining in Training Cell"];

// Reactively derives every formula-driven cell from the raw/manual ones already in `data`,
// so the UI, "Save", and "Sync Data" all show the exact same numbers without re-fetching.
// "Present in Training Cell" is NOT recalculated here: it's a date-aware Dojo membership count
// (statusHistory + handover-approval cutoff) computed server-side in headcountData.service.js,
// not something derivable client-side from Hiring/Handover/Attrition alone — a running balance
// built from those rows drifts from reality because "Attrition & Absenteeism" bundles permanent
// departures with same-day absenteeism, which isn't a membership change.
const recalculateReportData = (data, headerDates) => {
    const newData = { ...data };

    // Gap = Actual Separations (Cumulative) - Expected Separations (Cumulative), for every date.
    headerDates.forEach(dateObj => {
        const dateKey = dateObj.fullDate;
        const actual = parseFloat(newData[`Actual Separations (Cumulative)_${dateKey}`]) || 0;
        const expected = parseFloat(newData[`Expected Separations (Cumulative)_${dateKey}`]) || 0;
        newData[`Gap_${dateKey}`] = (actual - expected).toFixed(0);
    });

    // Present in Training Cell must read 0 for any date after today, even if a stale value from
    // an earlier save/sync is still sitting in `data` — the server already enforces this on
    // sync, but this guards the read path too so a future date never displays leftover data.
    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    headerDates.forEach(dateObj => {
        if (dateObj.fullDate > todayYMD) {
            newData[`Present in Training Cell_${dateObj.fullDate}`] = '0';
        }
    });

    return newData;
};

// Builds the plain-language justification shown when a user clicks a "Present in Training Cell"
// cell, purely from data already on screen (no extra fetch). Two complementary calculations:
//   1. Bridge (day-over-day): Yesterday + today's Dojo Hires / Rejoining & Returns / Handover /
//      Attrition / On Leave = Today. These 5 rows are a set difference of the active Dojo
//      membership computed server-side, not independent estimates — every trainee who entered or
//      exited the active set that day lands in exactly one of them, so this always balances
//      exactly against today's count. Skipped for the first two columns (no meaningful
//      "yesterday" to diff against).
//   2. Direct (snapshot): Dojo Total Pool - Dojo Not Active = today's count, derived straight from
//      the raw Dojo/trainee population on this date rather than from yesterday's number — shown
//      for every date, including the ones where the bridge calculation doesn't apply.
const buildPresentInTrainingCellNote = (tableData, headerDates, colIndex) => {
    const dateObj = headerDates[colIndex];
    const dateKey = dateObj.fullDate;

    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (dateKey > todayYMD) {
        return `${dateObj.displayDate} is a future date — Present in Training Cell isn't tracked yet, so it shows 0 until this date arrives.`;
    }

    const currentCount = parseFloat(tableData[`Present in Training Cell_${dateKey}`]) || 0;
    const totalPool = parseFloat(tableData['Dojo Total Pool']) || 0;
    const notActive = parseFloat(tableData[`Dojo Not Active_${dateKey}`]) || 0;

    const directCalcLines = [
        `Direct calculation (from today's raw Dojo/trainee records, not yesterday's count):`,
        `${totalPool} total Dojo/trainee record(s) ever tracked`,
        `− ${notActive} not currently active (already promoted, separated, not yet joined, or on leave)`,
        `= ${totalPool - notActive} Present in Training Cell`,
    ];

    if (colIndex === 0) {
        return [
            `Today (${dateObj.displayDate}): ${currentCount} trainee(s) in the Training Cell.`,
            ``,
            ...directCalcLines,
            ``,
            `This is the previous month's last date, shown only as a reference column — it isn't part of the current month being reported, so no day-over-day bridge applies to it.`,
        ].join('\n');
    }

    const dojoHires = parseFloat(tableData[`Hiring Actual Dojo_${dateKey}`]) || 0;
    const dojoRejoiningReturns = parseFloat(tableData[`Dojo Rejoining & Returns_${dateKey}`]) || 0;
    const dojoHandover = parseFloat(tableData[`Dojo Handover_${dateKey}`]) || 0;
    const dojoAttrition = parseFloat(tableData[`Dojo Attrition_${dateKey}`]) || 0;
    const dojoOnLeave = parseFloat(tableData[`Dojo On Leave_${dateKey}`]) || 0;

    if (colIndex === 1) {
        return [
            `Today (${dateObj.displayDate}): ${currentCount} trainee(s) in the Training Cell.`,
            ``,
            `Dojo Hires (today): ${dojoHires}`,
            `Dojo Rejoining & Returns (today): ${dojoRejoiningReturns}`,
            `Dojo Handover (today): ${dojoHandover}`,
            `Dojo Attrition (today): ${dojoAttrition}`,
            `Dojo On Leave (today): ${dojoOnLeave}`,
            ``,
            `This is the first day of the month — its count is this report's starting baseline, not a bridge calculation against the previous month's reference date.`,
            ``,
            ...directCalcLines,
        ].join('\n');
    }

    const prevDateObj = headerDates[colIndex - 1];
    const prevCount = parseFloat(tableData[`Present in Training Cell_${prevDateObj.fullDate}`]) || 0;
    const expected = prevCount + dojoHires + dojoRejoiningReturns - dojoHandover - dojoAttrition - dojoOnLeave;

    const lines = [
        `Yesterday (${prevDateObj.displayDate}): ${prevCount} trainee(s)`,
        `Today (${dateObj.displayDate}): ${currentCount} trainee(s)`,
        ``,
        `Dojo Hires (today): ${dojoHires}`,
        `Dojo Rejoining & Returns (today): ${dojoRejoiningReturns}`,
        `Dojo Handover (today): ${dojoHandover}`,
        `Dojo Attrition (today): ${dojoAttrition}`,
        `Dojo On Leave (today): ${dojoOnLeave}`,
        ``,
        `${prevCount} + ${dojoHires} + ${dojoRejoiningReturns} − ${dojoHandover} − ${dojoAttrition} − ${dojoOnLeave} = ${expected}`,
        ``,
        ...directCalcLines,
    ];

    return lines.join('\n');
};

// Builds the plain-language breakdown shown when a user clicks a "Hiring Actual" cell: how many
// of that day's new hires were Dojo/trainee joins (which feed the Training Cell) versus direct
// Operator hires (which don't), so a mismatch against "Present in Training Cell" is self-evident
// instead of surprising.
const buildHiringActualNote = (tableData, dateObj) => {
    const dateKey = dateObj.fullDate;
    const total = parseFloat(tableData[`Hiring Actual_${dateKey}`]) || 0;
    const dojo = parseFloat(tableData[`Hiring Actual Dojo_${dateKey}`]) || 0;
    const operator = parseFloat(tableData[`Hiring Actual Operator_${dateKey}`]) || 0;

    return [
        `Hiring Actual (${dateObj.displayDate}): ${total} new hire(s)`,
        ``,
        `Dojo (Trainee) hires: ${dojo}`,
        `Operator (Regular) hires: ${operator}`,
        ``,
        `Only Dojo hires count towards "Present in Training Cell" — Operator hires join directly into production and never pass through the Training Cell.`,
    ].join('\n');
};

const Report = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [tableData, setTableData] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Fetch Clubs from API
    const { data: clubsData } = useGetAllClubsQuery();
    const clubs = clubsData?.data || [];
    const activeClubs = clubs.filter(c => c.showInReport);

    const handleMonthChange = (offset) => {
        setCurrentDate(prev => {
            const nextDate = new Date(prev);
            nextDate.setMonth(nextDate.getMonth() + offset);
            return nextDate;
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit'
        }).split('/').join('.');
    };

    const getDayName = (date) => {
        return date.toLocaleDateString('en-GB', { weekday: 'short' });
    };

    const headerDates = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const dates = [];

        // Previous month last date
        const prevMonthLastDate = new Date(year, month, 0);
        dates.push(prevMonthLastDate);

        // All days of current month
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
                    params: { month, year }
                });

                if (response.data?.success) {
                    const loadedData = response.data.data.tableData || {};
                    setTableData(recalculateReportData(loadedData, headerDates));
                }
            } catch (error) {
                console.error("Fetch error:", error);
                setTableData({});
            } finally {
                setIsLoading(false);
            }
        };

        fetchReport();
    }, [currentDate, headerDates]);

    const handleInputChange = (rowLabel, dateKey, value) => {
        setTableData(prev => {
            const newData = {
                ...prev,
                [`${rowLabel}_${dateKey}`]: value
            };

            return recalculateReportData(newData, headerDates);
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
            console.error("Save error:", error);
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
                    return recalculateReportData(merged, headerDates);
                });

                toast.success("Data synced from Attendance, User logs & Requirements!", { id: toastId });
            }
        } catch (error) {
            console.error("Sync error:", error);
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

    const handleResendEmail = async () => {
        setIsSendingEmail(true);
        const toastId = toast.loading("Sending Headcount Report email...");

        try {
            const response = await axiosInstance.post('/api/reports/headcount/send-manual');
            if (response.data?.data?.sent) {
                toast.success("Headcount Report emailed successfully!", { id: toastId });
            } else {
                toast.error(response.data?.message || "No email was sent.", { id: toastId });
            }
        } catch (error) {
            console.error("Resend email error:", error);
            toast.error("Failed to send Headcount Report email.", { id: toastId });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const rows = useMemo(() => {
        const baseRows = [
            { label: "Particulars", type: "header", bold: true },
            { type: "spacer" },
            { label: "Headcount required as per production plan", bold: true },
            { label: "Headcount required as per sale plan", bold: true },
            ...activeClubs.map(club => ({
                label: `${club.name} Headcount required`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Hiring Plan", align: "right" },
            { label: "Rejoining", align: "right" },
            { type: "spacer" },
            { label: "Hiring Actual", align: "right", bg: "bg-orange-100" },
            { type: "spacer" },
            { label: "Handover Plan", align: "right" },
            { label: "Handover Actual", align: "right", bg: "bg-orange-100" },
            { type: "spacer" },
            { label: "Headcount available", bold: true },
        ];

        // Add dynamic club rows
        activeClubs.forEach(club => {
            baseRows.push({
                label: `${club.name} Headcount available`,
                bg: "bg-blue-50"
            });
        });

        baseRows.push(
            { type: "spacer" },
            { label: "Present in Training Cell", bold: true, align: "center", borderY: true },
            { label: "Rejoining in Training Cell", align: "right" },
            { label: "Attrition & Absenteeism of Training Cell (Nos)", align: "right" },
            { label: "Handed-over after training (Cumulative)", align: "right" },
            ...activeClubs.map(club => ({
                label: `${club.name} Handed-over after training (Cumulative)`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Separated (Cumulative)", align: "right" },
            ...activeClubs.map(club => ({
                label: `${club.name} Separated (Cumulative)`,
                bg: "bg-blue-50"
            })),
            { label: "Actual Separations (Cumulative)", bg: "bg-amber-300", align: "right" },
            { label: "Expected Separations (Cumulative)", bg: "bg-amber-100", align: "right" },
            { label: "Gap", bg: "bg-amber-300", align: "right" },
            { type: "spacer" },
            { label: "Absent", align: "right" },
            ...activeClubs.map(club => ({
                label: `${club.name} absent`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Net Available Headcount Total", bold: true },
            { type: "spacer" },
            { label: "Net Available Headcount Above 3 Months", bold: true },
            ...activeClubs.map(club => ({
                label: `${club.name} Net Available Headcount Above 3 Months`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Absenteeism %", bold: true },
            ...activeClubs.map(club => ({
                label: `${club.name} Absenteeism %`,
                bg: "bg-blue-50"
            })),
            { type: "spacer" },
            { label: "Total Headcount (Present + Absent)", align: "right" },
            { label: "Left in nos (Daily)", align: "right" },
            { label: "Attrition % Daily", align: "right" },
            { label: "Attrition % Cumulative", bold: true },
            { label: "Weekly Attrition %", align: "right" },
            { type: "spacer" },
            { type: "spacer" },
            { label: "Shift-wise Breakdown of Available Manpower", bold: true, dataKey: "Available_Total" },
            { label: "A-Shift", align: "right", dataKey: "Available_A-Shift" },
            { label: "G-Shift", align: "right", dataKey: "Available_G-Shift" },
            { label: "B-Shift", align: "right", dataKey: "Available_B-Shift" },
            { label: "C-Shift", align: "right", dataKey: "Available_C-Shift" },
            { type: "spacer" },
            { label: "Shift-wise Breakdown of Assigned Manpower", bold: true, dataKey: "Assigned_Total" },
            { label: "A-Shift", align: "right", dataKey: "Assigned_A-Shift" },
            { label: "G-Shift", align: "right", dataKey: "Assigned_G-Shift" },
            { label: "B-Shift", align: "right", dataKey: "Assigned_B-Shift" },
            { label: "C-Shift", align: "right", dataKey: "Assigned_C-Shift" },
            { type: "spacer" },
            { label: "Shift-wise Attendance %", bold: true, dataKey: "Attendance_Total" },
            { label: "A-Shift", align: "right", dataKey: "Attendance_A-Shift" },
            { label: "G-Shift", align: "right", dataKey: "Attendance_G-Shift" },
            { label: "B-Shift", align: "right", dataKey: "Attendance_B-Shift" },
            { label: "C-Shift", align: "right", dataKey: "Attendance_C-Shift" },
            { type: "spacer" }
        );

        return baseRows;
    }, [activeClubs]);

    return (
        <Tabs defaultValue="report" className="w-full space-y-6">
            <TabsList className="bg-slate-100 p-1 rounded-xl h-11 w-fit">
                <TabsTrigger
                    value="report"
                    className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                    Monthly Report
                </TabsTrigger>
                <TabsTrigger
                    value="report-clubbing"
                    className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                    Report Clubbing
                </TabsTrigger>
            </TabsList>

            <TabsContent value="report">
                <div className="p-4 space-y-4 relative">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                        <h1 className="text-xl font-bold text-red-600 uppercase">
                            ASSOCIATES HEADCOUNT: WIRING HARNESS MANUFACTURING
                        </h1>

                        <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" onClick={() => handleMonthChange(-1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            <span className="font-semibold text-lg bg-gray-50 px-4 py-1 rounded border min-w-[150px] text-center">
                                {currentDate.toLocaleDateString('en-US', {
                                    month: 'long',
                                    year: 'numeric'
                                })}
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

                            <Button
                                variant="outline"
                                onClick={handleResendEmail}
                                disabled={isSendingEmail}
                            >
                                <Mail className="h-4 w-4 mr-2" />
                                {isSendingEmail ? "Sending..." : "Resend Email"}
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
                                                    <td
                                                        key={`spacer-${rowIndex}-${colIndex}`}
                                                        className="border border-gray-300"
                                                    ></td>
                                                ))}
                                            </tr>
                                        );
                                    }

                                    const rowClass = row.bg || 'bg-white';

                                    return (
                                        <tr
                                            key={`row-${rowIndex}`}
                                            className={`hover:bg-blue-50 transition-colors ${rowClass}`}
                                        >
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
                                                const key = `${row.dataKey || row.label}_${cellKey}`;
                                                const isSyncedReadOnly = SYNCED_READONLY_ROWS.includes(row.label);
                                                const rawValue = tableData[key];
                                                const value = (rawValue === undefined || rawValue === null || rawValue === '')
                                                    ? '0'
                                                    : rawValue;
                                                const isPrevMonthCol = colIndex === 0;
                                                const isPresentInTrainingCell = row.label === "Present in Training Cell";
                                                const isHiringActual = row.label === "Hiring Actual";
                                                const note = isPresentInTrainingCell
                                                    ? buildPresentInTrainingCellNote(tableData, headerDates, colIndex)
                                                    : isHiringActual
                                                        ? buildHiringActualNote(tableData, dateObj)
                                                        : null;
                                                const hasClickableNote = isPresentInTrainingCell || isHiringActual;

                                                const cellInput = (
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        readOnly={isSyncedReadOnly}
                                                        onChange={(e) =>
                                                            handleInputChange(row.dataKey || row.label, cellKey, e.target.value)
                                                        }
                                                        className={`
                                                            w-full h-full px-1 py-1.5 bg-transparent text-center focus:outline-none transition-colors
                                                            ${hasClickableNote ? 'cursor-pointer hover:bg-indigo-100' : (isSyncedReadOnly ? 'cursor-not-allowed' : 'focus:bg-blue-100')}
                                                            ${row.bold ? 'font-bold' : ''}
                                                        `}
                                                        style={{ minHeight: '28px' }}
                                                        title={isPresentInTrainingCell ? 'Click for calculation details' : isHiringActual ? 'Click for hiring details' : (isSyncedReadOnly ? 'Auto-calculated on sync' : undefined)}
                                                    />
                                                );

                                                return (
                                                    <td
                                                        key={`${rowIndex}-${colIndex}`}
                                                        className={`
                                                            border border-gray-300 p-0 text-center relative
                                                            ${isPrevMonthCol ? (row.bg ? row.bg : 'bg-yellow-50') : ''}
                                                        `}
                                                    >
                                                        {row.type !== 'header' && (
                                                            hasClickableNote ? (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        {cellInput}
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-96" align="center">
                                                                        <div className="text-sm font-bold text-slate-800 mb-2 pb-2 border-b">
                                                                            {isPresentInTrainingCell ? 'Present in Training Cell' : 'Hiring Details'} — {dateObj.displayDate}
                                                                        </div>
                                                                        <div className="text-xs leading-relaxed whitespace-pre-line text-slate-600">
                                                                            {note || 'No details available for this date yet — try Sync Data.'}
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            ) : cellInput
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
            </TabsContent>

            <TabsContent value="report-clubbing">
                <ReportClubbing />
            </TabsContent>
        </Tabs>
    );
};

export default Report;