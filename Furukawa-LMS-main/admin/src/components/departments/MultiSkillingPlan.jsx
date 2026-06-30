import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetLinesByDepartmentQuery, useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { IconDeviceFloppy, IconPrinter, IconTrash, IconPlus } from "@tabler/icons-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const addThreeMonths = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(y, m - 1 + 3, d);
    if (date.getDate() !== d) date.setDate(0);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const ACTUAL_TO_PLAN = {
    q1DateActual: "q2Date",
    q2DateActual: "q3Date",
    q3DateActual: "q4Date",
};

const UserCellSelector = ({ value, onChange, students, rowId, handleRowFieldChange, disabled }) => {
    const [searchTerm, setSearchTerm] = useState(value || "");
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        setSearchTerm(value || "");
    }, [value]);

    const suggestions = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lower = searchTerm.toLowerCase();
        return students.filter(s => 
            (s.fullName || "").toLowerCase().includes(lower) || 
            (s.cardNo || "").toLowerCase().includes(lower)
        ).slice(0, 5);
    }, [students, searchTerm]);

    return (
        <div className="relative w-full">
            <Input
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                    if (e.target.value === "") {
                        onChange("", "");
                        handleRowFieldChange(rowId, "cardNo", "");
                    }
                }}
                onFocus={() => !disabled && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search user..."
                disabled={disabled}
                className="h-8 w-full min-w-[180px] text-xs shadow-none border-slate-200 bg-white"
            />
            {showSuggestions && suggestions.length > 0 && !disabled && (
                <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-40 overflow-y-auto z-50 py-1 normal-case font-normal text-left">
                    {suggestions.map((s) => (
                        <li
                            key={s._id || s.id}
                            onMouseDown={() => {
                                onChange(s._id || s.id, s.fullName || s.name, s.lineName, s.subSectionName);
                                handleRowFieldChange(rowId, "cardNo", s.cardNo || s.username || s.empId || "-");
                                setShowSuggestions(false);
                            }}
                            className="px-2 py-1 text-xs hover:bg-amber-50 cursor-pointer flex flex-col"
                        >
                            <span className="font-semibold text-slate-700">{s.fullName || s.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Card: {s.cardNo || s.username || s.empId || "—"}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const MultiSkillingPlan = ({ students = [], departmentId, sectionId, year }) => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN' || authUser?.role === 'INSTRUCTOR' || authUser?.isTrainer;

    const { canManage } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('multi_skilling:manage') || isAdmin,
        };
    }, [authUser, isAdmin]);

    const [searchText, setSearchText] = useState("");
    const [rows, setRows] = useState([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Fetch lines for model & line selection helper
    const { data: deptLines } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId || !!sectionId,
    });
    const { data: sectLines } = useGetLinesBySectionQuery(sectionId, {
        skip: !sectionId,
    });
    const lines = (sectionId ? sectLines?.data : deptLines?.data) || [];

    const { data: subSectionsData } = useGetSubSectionsQuery({
        departmentId,
        sectionId,
    }, {
        skip: !departmentId,
    });
    const subSections = subSectionsData?.data || [];

    const [tableData, setTableData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingPlan, setIsLoadingPlan] = useState(true);

    // Reset loading state when department/section/year changes
    useEffect(() => {
        setHasLoaded(false);
        setRows([]);
        setIsLoadingPlan(true);
    }, [departmentId, sectionId, year]);

    // Initialize rows when both students and plan details are ready
    useEffect(() => {
        if (isLoadingPlan || hasLoaded || (students.length === 0 && Object.keys(tableData || {}).length === 0)) return;

        const savedRows = [];
        const savedUserIds = Object.keys(tableData || {});

        savedUserIds.forEach((userId) => {
            const user = students.find(s => String(s._id || s.id) === String(userId));
            const data = tableData[userId] || {};
            savedRows.push({
                rowId: userId,
                userId: userId,
                userName: user?.fullName || user?.name || data.userName || "",
                cardNo: user?.cardNo || user?.username || user?.empId || data.cardNo || "",
                shift: data.shift || "",
                modelLine: data.modelLine || "",
                station: data.station || "",
                q1Skill: data.q1Skill || "",
                q1Date: data.q1Date || "",
                q1DateActual: data.q1DateActual || "",
                q1Status: data.q1Status || "",
                q2Skill: data.q2Skill || "",
                q2Date: data.q2Date || "",
                q2DateActual: data.q2DateActual || "",
                q2Status: data.q2Status || "",
                q3Skill: data.q3Skill || "",
                q3Date: data.q3Date || "",
                q3DateActual: data.q3DateActual || "",
                q3Status: data.q3Status || "",
                q4Skill: data.q4Skill || "",
                q4Date: data.q4Date || "",
                q4DateActual: data.q4DateActual || "",
                q4Status: data.q4Status || ""
            });
        });

        // Auto-add students (filtered by competency level) not already in the saved plan
        const savedSet = new Set(savedUserIds.map(String));
        students.forEach((s) => {
            const uid = String(s._id || s.id);
            if (!savedSet.has(uid)) {
                savedRows.push({
                    rowId: uid,
                    userId: uid,
                    userName: s.fullName || s.name || "",
                    cardNo: s.cardNo || s.username || s.empId || "",
                    shift: s.shift || "",
                    modelLine: s.lineName || "",
                    station: s.subSectionName || "",
                    q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "",
                    q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "",
                    q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "",
                    q4Skill: "", q4Date: "", q4DateActual: "", q4Status: ""
                });
            }
        });

        // Pad to 25 rows
        const totalRowsNeeded = 25;
        const currentCount = savedRows.length;
        if (currentCount < totalRowsNeeded) {
            for (let i = currentCount; i < totalRowsNeeded; i++) {
                savedRows.push({
                    rowId: `temp-${i}-${Date.now()}`,
                    userId: "",
                    userName: "",
                    cardNo: "",
                    shift: "",
                    modelLine: "",
                    station: "",
                    q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "",
                    q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "",
                    q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "",
                    q4Skill: "", q4Date: "", q4DateActual: "", q4Status: ""
                });
            }
        }

        setRows(savedRows);
        setHasLoaded(true);
    }, [tableData, students, isLoadingPlan, hasLoaded]);

    // Safeguard: Update row metadata (names, card numbers, line, etc.) if students list finishes loading after rows are initialized
    useEffect(() => {
        if (students.length > 0 && hasLoaded && rows.length > 0) {
            setRows(prev => prev.map(row => {
                if (!row.userId) return row;
                const user = students.find(s => String(s._id || s.id) === String(row.userId));
                if (user) {
                    return {
                        ...row,
                        userName: user.fullName || user.name || row.userName,
                        cardNo: user.cardNo || user.username || user.empId || row.cardNo,
                        shift: row.shift || user.shift || "",
                        modelLine: row.modelLine || user.lineName || "",
                        station: row.station || user.subSectionName || ""
                    };
                }
                return row;
            }));
        }
    }, [students, hasLoaded]);

    useEffect(() => {
        if (!departmentId) {
            setIsLoadingPlan(false);
            return;
        }
        let cancelled = false;

        const loadSavedPlan = async () => {
            try {
                setIsLoadingPlan(true);
                setTableData({});
                const response = await axiosInstance.get(`/api/multi-skilling-plan/department/${departmentId}`, {
                    params: { sectionId, year }
                });
                const data = response?.data?.data;
                if (!cancelled && data) {
                    if (data.tableData && typeof data.tableData === "object") {
                        setTableData(data.tableData);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error("Failed to load multi-skilling plan");
                }
            } finally {
                if (!cancelled) setIsLoadingPlan(false);
            }
        };

        loadSavedPlan();
        return () => {
            cancelled = true;
        };
    }, [departmentId, sectionId, year]);

    const handleAddRow = () => {
        setRows(prev => [
            ...prev,
            {
                rowId: `temp-add-${prev.length}-${Date.now()}`,
                userId: "",
                userName: "",
                cardNo: "",
                shift: "",
                modelLine: "",
                station: "",
                q1Skill: "", q1Date: "", q1DateActual: "", q1Status: "",
                q2Skill: "", q2Date: "", q2DateActual: "", q2Status: "",
                q3Skill: "", q3Date: "", q3DateActual: "", q3Status: "",
                q4Skill: "", q4Date: "", q4DateActual: "", q4Status: ""
            }
        ]);
    };

    const handleRemoveEmployee = (rowId) => {
        setRows(prev => prev.filter(row => row.rowId !== rowId));
        toast.success("Row removed from sheet");
    };

    const handleRowFieldChange = (rowId, field, value) => {
        setRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;
            const updated = { ...row, [field]: value };
            const targetField = ACTUAL_TO_PLAN[field];
            if (targetField && value && !row[targetField]) {
                updated[targetField] = addThreeMonths(value);
            }
            return updated;
        }));
    };

    const filteredRows = useMemo(() => {
        if (!searchText.trim()) return rows;
        const lower = searchText.toLowerCase();
        return rows.filter(row =>
            (row.userName || "").toLowerCase().includes(lower) ||
            (row.cardNo || "").toLowerCase().includes(lower)
        );
    }, [rows, searchText]);

    const handleSave = async () => {
        if (!departmentId) return;

        // Convert rows to tableData format
        const newTableData = {};
        rows.forEach(row => {
            if (row.userId) {
                newTableData[row.userId] = {
                    shift: row.shift,
                    modelLine: row.modelLine || "",
                    station: row.station || "",
                    q1Skill: row.q1Skill,
                    q1Date: row.q1Date,
                    q1DateActual: row.q1DateActual,
                    q1Status: row.q1Status,
                    q2Skill: row.q2Skill,
                    q2Date: row.q2Date,
                    q2DateActual: row.q2DateActual,
                    q2Status: row.q2Status,
                    q3Skill: row.q3Skill,
                    q3Date: row.q3Date,
                    q3DateActual: row.q3DateActual,
                    q3Status: row.q3Status,
                    q4Skill: row.q4Skill,
                    q4Date: row.q4Date,
                    q4DateActual: row.q4DateActual,
                    q4Status: row.q4Status
                };
            }
        });

        try {
            setIsSaving(true);
            await axiosInstance.post(`/api/multi-skilling-plan/department/${departmentId}`, {
                sectionId,
                year,
                selectedLines: [],
                tableData: newTableData,
            });
            setTableData(newTableData);
            toast.success("Multi-skilling plan saved successfully");
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save multi-skilling plan");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Card className="max-w-full overflow-hidden bg-white">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 print:hidden">
                    <div />
                    <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-transparent inline-block pb-1">
                        Training plan for multi skilling
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleAddRow} className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm">
                            <IconPlus className="h-4 w-4 mr-2" />
                            Add Row
                        </Button>
                        <Button variant="outline" onClick={handlePrint}>
                            <IconPrinter className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        {canManage && (
                            <Button onClick={handleSave} disabled={isSaving || isLoadingPlan} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-sm">
                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                {/* Sheet Metadata Header Block - Visible in screen & print */}
                <div className="flex justify-between items-center w-full mb-4 pb-2 border-b border-slate-200 print:border-black">
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-wide text-slate-800 print:text-black hidden print:block">
                            Training Plan for Multi Skilling
                        </h2>
                        <span className="print:hidden text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Interactive Multi-Skilling Sheet (Year: {year})
                        </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 border border-slate-950 bg-slate-50 px-3 py-1 rounded shadow-sm print:shadow-none print:bg-white print:rounded-none whitespace-nowrap">
                        Document No: FRM-WH-QA-236
                    </div>
                </div>
                <div className="no-print flex flex-col sm:flex-row items-end gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="w-full sm:w-72">
                        <Label className="text-xs font-bold text-slate-700 mb-1 block">Filter Table Rows</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Filter active associates..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="h-9 bg-white text-sm"
                            />
                            {searchText && (
                                <Button variant="ghost" size="sm" onClick={() => setSearchText("")} className="h-9 px-2 text-xs">
                                    Clear
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full overflow-x-auto rounded-lg border border-slate-300">
                    <table className="w-full border-collapse border border-slate-300 text-sm table-auto">
                        <thead className="bg-slate-100 text-slate-700">
                            {/* Group headers row */}
                            <tr className="border-b border-slate-300">
                                <th rowSpan="2" className="border-r border-slate-300 p-2 text-center font-bold align-middle whitespace-nowrap">Sr. No</th>
                                <th rowSpan="2" className="border-r border-slate-300 p-2 text-left font-bold align-middle whitespace-nowrap">Associates Name</th>
                                <th rowSpan="2" className="border-r border-slate-300 p-2 text-center font-bold align-middle whitespace-nowrap">Card No</th>
                                <th rowSpan="2" className="border-r border-slate-300 p-2 text-center font-bold align-middle whitespace-nowrap">Shift</th>
                                <th rowSpan="2" className="border-r border-slate-300 p-2 text-left font-bold align-middle whitespace-nowrap">Model & Line</th>
                                <th rowSpan="2" className="border-r border-slate-300 p-2 text-left font-bold align-middle whitespace-nowrap">Station</th>
                                <th colSpan="4" className="border-r border-slate-300 p-2 text-center font-bold bg-amber-50 text-amber-800 whitespace-nowrap">Jan-March</th>
                                <th colSpan="4" className="border-r border-slate-300 p-2 text-center font-bold bg-blue-50 text-blue-800 whitespace-nowrap">April-June</th>
                                <th colSpan="4" className="border-r border-slate-300 p-2 text-center font-bold bg-green-50 text-green-800 whitespace-nowrap">July-Sep</th>
                                <th colSpan="4" className="border-r border-slate-300 p-2 text-center font-bold bg-purple-50 text-purple-800 whitespace-nowrap">Oct-Dec</th>
                                <th rowSpan="2" className="p-2 text-center font-bold align-middle no-print whitespace-nowrap">Action</th>
                            </tr>
                            <tr className="bg-slate-50 border-b border-slate-300">
                                {/* Jan-March */}
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Skill Level</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Plan)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Actual)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Status</th>
                                {/* April-June */}
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Skill Level</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Plan)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Actual)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Status</th>
                                {/* July-Sep */}
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Skill Level</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Plan)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Actual)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Status</th>
                                {/* Oct-Dec */}
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Skill Level</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Plan)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Updation Date (Actual)</th>
                                <th className="border-r border-slate-300 p-1 text-center text-xs font-semibold whitespace-nowrap">Status</th>
                            </tr>
                        </thead>

                        <tbody className="bg-white">
                            {filteredRows.map((row, index) => {
                                const rowId = row.rowId;
                                const associatedUser = students.find(s => String(s._id || s.id) === String(row.userId));
                                const rowSubSections = row.modelLine 
                                    ? subSections.filter(ss => ss.lineName === row.modelLine) 
                                    : subSections;

                                return (
                                    <tr key={rowId} className="hover:bg-slate-50/50 border-b border-slate-200 transition-colors">
                                        <td className="border-r border-slate-200 p-2 text-center text-slate-500 font-medium whitespace-nowrap">{index + 1}</td>
                                        <td className="border-r border-slate-200 p-2 font-bold text-slate-800 uppercase whitespace-nowrap">
                                            <UserCellSelector
                                                value={row.userName}
                                                onChange={(userId, userName, lineName, subSectionName) => {
                                                    handleRowFieldChange(rowId, "userId", userId);
                                                    handleRowFieldChange(rowId, "userName", userName);
                                                    handleRowFieldChange(rowId, "modelLine", lineName || "");
                                                    handleRowFieldChange(rowId, "station", subSectionName || "");
                                                }}
                                                students={students}
                                                rowId={rowId}
                                                handleRowFieldChange={handleRowFieldChange}
                                                disabled={!canManage}
                                            />
                                        </td>
                                        <td className="border-r border-slate-200 p-2 text-center font-mono text-slate-700 whitespace-nowrap">
                                            <Input
                                                value={row.cardNo || ""}
                                                disabled={true}
                                                className="h-8 w-full min-w-[90px] text-xs shadow-none bg-slate-50 border-slate-200 text-center font-bold"
                                                placeholder="Card No"
                                                readOnly
                                            />
                                        </td>
                                        {/* Shift */}
                                        <td className="border-r border-slate-200 p-1 text-center whitespace-nowrap">
                                            <Select
                                                value={row.shift || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "shift", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none mx-auto">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="A">A</SelectItem>
                                                    <SelectItem value="B">B</SelectItem>
                                                    <SelectItem value="C">C</SelectItem>
                                                    <SelectItem value="G">G</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        {/* Model & Line */}
                                        <td className="border-r border-slate-200 p-1 whitespace-nowrap">
                                            <Select
                                                value={row.modelLine || ""}
                                                onValueChange={(val) => {
                                                    handleRowFieldChange(rowId, "modelLine", val);
                                                    handleRowFieldChange(rowId, "station", ""); // Reset station when line changes
                                                }}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[150px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="Select Model/Line" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {lines.map((l) => (
                                                        <SelectItem key={l.id || l._id} value={l.name}>
                                                            {l.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        {/* Station */}
                                        <td className="border-r border-slate-200 p-1 whitespace-nowrap">
                                            <Select
                                                value={row.station || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "station", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[150px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="Select Station" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {rowSubSections.map((ss) => (
                                                        <SelectItem key={ss.id || ss._id} value={ss.name}>
                                                            {ss.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* Jan-March */}
                                        {/* Skill Level */}
                                        <td className="border-r border-slate-200 p-1 bg-amber-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q1Skill || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q1Skill", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L1">L1</SelectItem>
                                                    <SelectItem value="L2">L2</SelectItem>
                                                    <SelectItem value="L3">L3</SelectItem>
                                                    <SelectItem value="L4">L4</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        {/* Date */}
                                        <td className="border-r border-slate-200 p-1 bg-amber-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q1Date || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q1Date", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Date Actual */}
                                        <td className="border-r border-slate-200 p-1 bg-amber-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q1DateActual || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q1DateActual", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Status */}
                                        <td className="border-r border-slate-200 p-1 bg-amber-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q1Status || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q1Status", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[110px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Planned">Planned</SelectItem>
                                                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                    <SelectItem value="N/A">N/A</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* April-June */}
                                        {/* Skill Level */}
                                        <td className="border-r border-slate-200 p-1 bg-blue-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q2Skill || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q2Skill", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L1">L1</SelectItem>
                                                    <SelectItem value="L2">L2</SelectItem>
                                                    <SelectItem value="L3">L3</SelectItem>
                                                    <SelectItem value="L4">L4</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        {/* Date */}
                                        <td className="border-r border-slate-200 p-1 bg-blue-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q2Date || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q2Date", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Date Actual */}
                                        <td className="border-r border-slate-200 p-1 bg-blue-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q2DateActual || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q2DateActual", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Status */}
                                        <td className="border-r border-slate-200 p-1 bg-blue-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q2Status || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q2Status", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[110px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Planned">Planned</SelectItem>
                                                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                    <SelectItem value="N/A">N/A</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* July-Sep */}
                                        {/* Skill Level */}
                                        <td className="border-r border-slate-200 p-1 bg-green-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q3Skill || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q3Skill", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L1">L1</SelectItem>
                                                    <SelectItem value="L2">L2</SelectItem>
                                                    <SelectItem value="L3">L3</SelectItem>
                                                    <SelectItem value="L4">L4</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        {/* Date */}
                                        <td className="border-r border-slate-200 p-1 bg-green-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q3Date || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q3Date", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Date Actual */}
                                        <td className="border-r border-slate-200 p-1 bg-green-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q3DateActual || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q3DateActual", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Status */}
                                        <td className="border-r border-slate-200 p-1 bg-green-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q3Status || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q3Status", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[110px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Planned">Planned</SelectItem>
                                                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                    <SelectItem value="N/A">N/A</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* Oct-Dec */}
                                        {/* Skill Level */}
                                        <td className="border-r border-slate-200 p-1 bg-purple-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q4Skill || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q4Skill", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="-" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="L1">L1</SelectItem>
                                                    <SelectItem value="L2">L2</SelectItem>
                                                    <SelectItem value="L3">L3</SelectItem>
                                                    <SelectItem value="L4">L4</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                        {/* Date */}
                                        <td className="border-r border-slate-200 p-1 bg-purple-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q4Date || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q4Date", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Date Actual */}
                                        <td className="border-r border-slate-200 p-1 bg-purple-50/20 text-center whitespace-nowrap">
                                            <input
                                                type="date"
                                                value={row.q4DateActual || ""}
                                                onChange={(e) => handleRowFieldChange(rowId, "q4DateActual", e.target.value)}
                                                disabled={!canManage}
                                                className="h-8 border border-slate-200 rounded-md px-1 text-xs w-full min-w-[130px] text-center bg-white focus-visible:outline-none"
                                            />
                                        </td>
                                        {/* Status */}
                                        <td className="border-r border-slate-200 p-1 bg-purple-50/20 whitespace-nowrap">
                                            <Select
                                                value={row.q4Status || ""}
                                                onValueChange={(val) => handleRowFieldChange(rowId, "q4Status", val)}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-8 w-full min-w-[110px] bg-white border-slate-200 text-xs shadow-none">
                                                    <SelectValue placeholder="Status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Planned">Planned</SelectItem>
                                                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                    <SelectItem value="N/A">N/A</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>

                                        {/* Action */}
                                        <td className="p-2 text-center no-print whitespace-nowrap">
                                            {canManage && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveEmployee(rowId)}
                                                    className="text-red-500 hover:text-red-700 p-1 h-auto"
                                                    title="Remove Row"
                                                >
                                                    <IconTrash className="w-4 h-4 text-red-500 hover:text-red-700" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan="23" className="border border-slate-300 p-8 text-center text-muted-foreground bg-slate-50">
                                        No rows match the search filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

export default MultiSkillingPlan;
