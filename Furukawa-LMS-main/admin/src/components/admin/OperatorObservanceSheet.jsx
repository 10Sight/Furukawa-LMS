import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axiosInstance from '@/Helper/axiosInstance';
import { Loader2, Eye, Pencil, Lock } from "lucide-react";
import { exportToExcel } from "@/utils/exportHelper";

// Check Contents defined in the image
const CHECK_CONTENTS = [
    {
        id: "workingManner",
        title: "Working Manner",
        desc: "◆ Do work As per work standards \n◆ Confirm around the process whether he/she is capable to manage 5S on process or not."
    },
    {
        id: "cycleTime",
        title: "Cycle Time",
        desc: "◆ As per Running part no.\n(As per conveyor run at that time)"
    },
    {
        id: "checkSheets",
        title: "Check Sheets (If applicable)",
        desc: "◆ Confirm that he/she is aware about contents of check sheets."
    },
    {
        id: "processProductAwareness",
        title: "Process & Product Awareness",
        desc: "◆ Confirm the type of defect can occur on process and impact of bypass."
    },
    {
        id: "pastCustomerClaim",
        title: "Past Customer Claim Information",
        desc: "◆ Operator must be aware regarding the past customer claim"
    },
    { id: "checkedByLine", title: "Checked By (Line Incharge)", desc: "" },
    { id: "verificationByShift", title: "Verification By (Shift Incharge)", desc: "" }
];

const CHECK_ROW_IDS = CHECK_CONTENTS.map((row) => row.id);
const OBS_COLUMNS = ["obs1", "obs2", "obs3", "obs4"];
const ORDINALS = ["1st", "2nd", "3rd", "4th"];

const isCellFilled = (cell) => {
    if (!cell) return false;
    return String(cell.status || "").trim() !== "" || String(cell.val || "").trim() !== "";
};

const isCellComplete = (cell) => {
    if (!cell) return false;
    return String(cell.status || "").trim() !== "" && String(cell.val || "").trim() !== "";
};

const isSubColumnStarted = (data, colId) => {
    const date = data?.columnDates?.[colId];
    if (date && String(date).trim() !== "") return true;
    return CHECK_ROW_IDS.some((rowId) => isCellFilled(data?.[rowId]?.[colId]));
};

const isSubColumnComplete = (data, colId) => {
    const date = data?.columnDates?.[colId];
    if (!date || String(date).trim() === "") return false;
    return CHECK_ROW_IDS.every((rowId) => isCellComplete(data?.[rowId]?.[colId]));
};

// Mirrors server-side validation in operatorObservance.controller.js
const validateObservanceSheet = (observanceData) => {
    const data = observanceData || {};

    const anyDateFilled = Object.values(data.columnDates || {}).some((d) => d && String(d).trim() !== "");
    const anyRowFilled = CHECK_ROW_IDS.some((rowId) =>
        OBS_COLUMNS.some((col) => isCellFilled(data?.[rowId]?.[col]) || isCellFilled(data?.[rowId]?.[`${col}Re`]))
    );
    if (!anyDateFilled && !anyRowFilled) {
        return "Please fill at least one observance before saving.";
    }

    for (let i = 0; i < OBS_COLUMNS.length; i++) {
        const col = OBS_COLUMNS[i];
        const colRe = `${col}Re`;
        const ordinal = ORDINALS[i];

        const primaryStarted = isSubColumnStarted(data, col) || isSubColumnStarted(data, colRe);
        if (primaryStarted && !isSubColumnComplete(data, col)) {
            return `${ordinal} Observance: Please select the 1st Time date and fill OK/NG status with result description for all check content rows before saving.`;
        }

        const reStarted = isSubColumnStarted(data, colRe);
        if (reStarted && !isSubColumnComplete(data, colRe)) {
            return `${ordinal} Observance: You have started the Reinspect column — please select the reinspection date and fill OK/NG status with result description for all check content rows before saving.`;
        }
    }

    return null;
};

const OperatorObservanceSheet = ({ studentId, studentName = "", employeeCode = "", readOnly = false }) => {
    const authUser = useSelector((state) => state.auth?.user);
    const todayStr = new Date().toISOString().split('T')[0];
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const hasObservancePermission = (permission) => {
        if (!authUser) return false;
        const role = authUser.role;
        if (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'INSTRUCTOR') return true;
        const defaultPerms = [];
        const customPerms = authUser.customRole?.permissions || [];
        return [...defaultPerms, ...customPerms].includes(permission);
    };

    const canEdit = !readOnly && hasObservancePermission('operator_observance:update');
    const [isEditMode, setIsEditMode] = useState(canEdit);

    // Admins/Superadmins and users with explicit manage permission can edit already-saved cells.
    const canBypassLock = (() => {
        if (!authUser) return false;
        if (authUser.role === 'ADMIN' || authUser.role === 'SUPERADMIN') return true;
        const customPerms = authUser.customRole?.permissions || [];
        return customPerms.includes('operator_observance:manage');
    })();

    // Header Data
    const [headerData, setHeaderData] = useState({
        lineName: "",
        processName: "",
        level1Date: "",
        operatorNameCode: "",
        preparedBy: "",
        checkedBy: "",
        verifiedBy: ""
    });

    // Table Data Structure:
    // { rowId: { obs1: {date, val}, obs1Re: {date, val}, obs2: {...}, obs2Re: {...}, obs3: {...}, obs3Re: {...}, obs4: {...}, obs4Re: {...}, remarks: "" } }
    const [tableData, setTableData] = useState({});

    // Snapshot of last-saved data, used to lock already-filled headers/cells for non-privileged users.
    const [originalHeaderData, setOriginalHeaderData] = useState({});
    const [originalTableData, setOriginalTableData] = useState({});

    // Determines if a given header field, column date, or check-content cell was already saved
    // and should therefore be locked from further edits (unless the user can bypass the lock).
    const isCellLocked = (type, key, subKey) => {
        if (canBypassLock) return false;
        if (type === 'header') {
            return Boolean(String(originalHeaderData[key] || "").trim());
        }
        if (type === 'date') {
            return Boolean(String(originalTableData.columnDates?.[key] || "").trim());
        }
        if (type === 'cell') {
            return isCellFilled(originalTableData[key]?.[subKey]);
        }
        if (type === 'remarks') {
            return Boolean(String(originalTableData[key]?.remarks || "").trim());
        }
        return false;
    };

    // Operator search/autocomplete (edit mode only)
    const [operatorSuggestions, setOperatorSuggestions] = useState([]);
    const [showOperatorSuggestions, setShowOperatorSuggestions] = useState(false);
    const [isSearchingOperator, setIsSearchingOperator] = useState(false);

    useEffect(() => {
        fetchData();
    }, [studentId]);

    useEffect(() => {
        const autoOperatorNameCode = [studentName, employeeCode].filter(Boolean).join(" - ");
        if (autoOperatorNameCode) {
            setHeaderData(prev => ({
                ...prev,
                operatorNameCode: autoOperatorNameCode,
            }));
        }
    }, [studentName, employeeCode]);

    useEffect(() => {
        if (authUser && !headerData.preparedBy) {
            setHeaderData(prev => ({
                ...prev,
                preparedBy: authUser.fullName || authUser.name || ""
            }));
        }
    }, [authUser, headerData.preparedBy]);

    const handleSignatureClick = (field, type) => {
        const name = authUser?.fullName || authUser?.name;
        if (!name) {
            toast.error("Please login to sign this sheet");
            return;
        }
        const prefix = type === 'approve' ? "Approved By: " : "Rejected By: ";
        setHeaderData(prev => ({
            ...prev,
            [field]: `${prefix}${name}`
        }));
    };

    const handleClearSignatureClick = (field) => {
        setHeaderData(prev => ({
            ...prev,
            [field]: ""
        }));
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const defaultOperatorNameCode = [studentName, employeeCode].filter(Boolean).join(" - ");

            // Fallback source for assigned machine/line.
            let assignmentLineName = "";
            let assignmentProcessName = "";
            try {
                const monitoringResponse = await axiosInstance.get(`/api/progress/three-day-monitoring/${studentId}`);
                const monitoringData = monitoringResponse?.data?.data || {};
                assignmentLineName = monitoringData.lineName || "";
                assignmentProcessName = monitoringData.processName || "";
            } catch (e) {
                // Keep sheet usable if fallback lookup fails.
            }

            const response = await axiosInstance.get(`/api/operator-observance/${studentId}`);

            if (response.data.success) {
                const data = response.data.data;
                if (!data.isNew) {
                    const loadedHeaderData = {
                        lineName: data.lineName || assignmentLineName || "",
                        processName: data.processName || assignmentProcessName || "",
                        level1Date: data.level1Date ? new Date(data.level1Date).toISOString().split('T')[0] : "",
                        operatorNameCode: defaultOperatorNameCode || "",
                        preparedBy: data.preparedBy || "",
                        checkedBy: data.checkedBy || "",
                        verifiedBy: data.verifiedBy || ""
                    };
                    const loadedTableData = data.observanceData || {};
                    setHeaderData(loadedHeaderData);
                    setTableData(loadedTableData);
                    setOriginalHeaderData(loadedHeaderData);
                    setOriginalTableData(loadedTableData);
                } else {
                    setHeaderData(prev => ({
                        ...prev,
                        lineName: assignmentLineName || prev.lineName,
                        processName: assignmentProcessName || prev.processName,
                        level1Date: data.level1Date ? new Date(data.level1Date).toISOString().split('T')[0] : prev.level1Date,
                        operatorNameCode: defaultOperatorNameCode || prev.operatorNameCode,
                        preparedBy: prev.preparedBy || authUser?.fullName || authUser?.name || "",
                        checkedBy: "",
                        verifiedBy: ""
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching observance data:", error);
            // toast.error("Failed to load observance sheet");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (targetStatus) => {
        const validationError = validateObservanceSheet(tableData);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...headerData,
                observanceData: tableData,
                status: targetStatus
            };

            await axiosInstance.post(`/api/operator-observance/${studentId}`, payload);

            setHeaderData(prev => ({
                ...prev,
                status: targetStatus
            }));
            setOriginalHeaderData(headerData);
            setOriginalTableData(tableData);

            if (targetStatus === "Submitted") {
                toast.success("Observance Sheet Submitted & Emailed Successfully");
            } else {
                toast.success("Observance Sheet Saved as Draft Successfully");
            }
        } catch (error) {
            console.error("Error saving observance data:", error);
            toast.error(error.response?.data?.message || "Failed to save data");
        } finally {
            setSaving(false);
        }
    };

    const handleHeaderChange = (field, value) => {
        if (field === 'level1Date' && value) {
            if (value < todayStr) {
                toast.error("Date of Level-1 Complete cannot be in the past");
                return;
            }
            if (value > todayStr) {
                toast.error("Date of Level-1 Complete cannot be in the future");
                return;
            }
        }
        setHeaderData(prev => ({ ...prev, [field]: value }));
    };

    const handleOperatorChange = async (value) => {
        handleHeaderChange('operatorNameCode', value);

        if (!value.trim() || value.length < 2) {
            setOperatorSuggestions([]);
            setShowOperatorSuggestions(false);
            return;
        }

        try {
            setIsSearchingOperator(true);
            const response = await axiosInstance.get('/api/users/students', {
                params: {
                    search: value,
                    page: 1,
                    limit: 10,
                    includeTemporary: "true",
                    ojtApprovedToday: "true"
                }
            });
            const list = response.data?.data?.users || [];
            setOperatorSuggestions(list);
            setShowOperatorSuggestions(list.length > 0);
        } catch (err) {
            console.error("Failed to search operators:", err);
        } finally {
            setIsSearchingOperator(false);
        }
    };

    const handleSelectOperator = (student) => {
        const nameCode = [student.fullName, student.empId].filter(Boolean).join(" - ");
        handleHeaderChange('operatorNameCode', nameCode);
        setOperatorSuggestions([]);
        setShowOperatorSuggestions(false);
    };

    const handleTableChange = (rowId, colId, subField, value) => {
        if (rowId === 'columnDates' && value) {
            if (value < todayStr) {
                toast.error("Inspection date cannot be in the past");
                return;
            }
            if (value > todayStr) {
                toast.error("Inspection date cannot be in the future");
                return;
            }
        }
        setTableData(prev => {
            const row = prev[rowId] || {};
            const col = row[colId] || {};

            return {
                ...prev,
                [rowId]: {
                    ...row,
                    [colId]: subField ? { ...col, [subField]: value } : value
                }
            };
        });
    };

    const renderCell = (rowId, colId) => {
        const cellData = tableData[rowId]?.[colId] || {};
        const locked = isCellLocked('cell', rowId, colId);
        const disabled = !isEditMode || locked;

        const getSelectClass = (status) => {
            const base = "h-7 w-20 text-[10px] px-1 py-0.5 rounded border font-semibold focus:outline-none focus:ring-1 transition-colors text-center ";
            const cursorClass = !disabled ? "cursor-pointer " : "cursor-default opacity-70 ";
            if (status === "OK") return base + cursorClass + "bg-green-50 border-green-200 text-green-700 focus:ring-green-500";
            if (status === "NG") return base + cursorClass + "bg-red-50 border-red-200 text-red-700 focus:ring-red-500";
            return base + cursorClass + "bg-white border-gray-200 text-gray-400 focus:ring-blue-500";
        };

        return (
            <div className="flex flex-col gap-1 p-1 h-full">
                <div className="flex flex-col gap-1">
                    {/* OK/NG Dropdown */}
                    <div className="flex items-center justify-center py-1 border-b border-dashed border-gray-100">
                        <select
                            value={cellData.status || ""}
                            onChange={(e) => !disabled && handleTableChange(rowId, colId, 'status', e.target.value)}
                            disabled={disabled}
                            title={locked ? "Already saved — locked" : undefined}
                            className={getSelectClass(cellData.status)}
                        >
                            <option value="" className="text-gray-400 font-normal bg-white">Select...</option>
                            <option value="OK" className="text-green-700 font-semibold bg-white">OK</option>
                            <option value="NG" className="text-red-700 font-semibold bg-white">NG</option>
                        </select>
                    </div>
                </div>
                <Textarea
                    className="flex-1 min-h-[50px] text-xs resize-none p-1 border-gray-200 disabled:opacity-70 disabled:cursor-default disabled:resize-none"
                    placeholder={!disabled ? "Result..." : ""}
                    value={cellData.val || ""}
                    onChange={(e) => handleTableChange(rowId, colId, 'val', e.target.value)}
                    disabled={disabled}
                    title={locked ? "Already saved — locked" : undefined}
                />
            </div>
        );
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <Card className="w-full overflow-auto">
            <CardContent className="p-4 min-w-[1000px]">
                {/* View / Edit Mode Toggle Bar */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200 shadow-sm">
                        <button
                            onClick={() => setIsEditMode(false)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                                !isEditMode
                                    ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            View
                        </button>
                        <button
                            onClick={() => canEdit && setIsEditMode(true)}
                            disabled={!canEdit}
                            title={!canEdit ? "You don't have permission to edit this sheet" : undefined}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                                isEditMode
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : canEdit
                                    ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    : 'text-gray-300 cursor-not-allowed'
                            }`}
                        >
                            {canEdit ? <Pencil className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            Edit
                        </button>
                    </div>
                    {!isEditMode && (
                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                            <Lock className="h-3 w-3 flex-shrink-0" />
                            <span>{canEdit ? "Viewing only — switch to Edit to make changes." : "You have read-only access to this sheet."}</span>
                        </div>
                    )}
                </div>

                {/* Header Section */}
                <div className="border-2 border-black mb-4">
                    <div className="grid grid-cols-[3fr_1fr] border-b-2 border-black">
                        <div className="flex items-center justify-center text-3xl font-serif py-4 border-r-2 border-black gap-3">
                            <span>Operator Observance Sheet</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${headerData.status === 'Submitted' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-yellow-100 text-yellow-800 border border-yellow-200'}`}>
                                {headerData.status || "Draft"}
                            </span>
                        </div>
                        <div className="text-xs">
                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] border-b border-black">
                                <div className="border-r border-black p-1"></div>
                                <div className="border-r border-black p-1 font-bold text-center">Prepared By</div>
                                <div className="border-r border-black p-1 font-bold text-center">Checked By</div>
                                <div className="p-1 font-bold text-center">Approved By</div>
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] h-8 border-b border-black items-center">
                                <div className="border-r border-black p-1 flex items-center justify-center font-bold h-full">Sign.</div>
                                <div className="border-r border-black p-1 flex items-center justify-center font-bold text-blue-700 italic h-full">
                                    {headerData.preparedBy ? "Prepared" : ""}
                                </div>
                                <div className="border-r border-black p-1 flex items-center justify-center h-full">
                                    {isEditMode && !headerData.checkedBy ? (
                                        <div className="flex gap-1 justify-center items-center h-full w-full">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSignatureClick('checkedBy', 'approve')}
                                                className="h-6 text-[9px] bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 px-1.5 py-0 border-green-200"
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSignatureClick('checkedBy', 'reject')}
                                                className="h-6 text-[9px] bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 px-1.5 py-0 border-red-200"
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 h-full w-full font-bold">
                                            {headerData.checkedBy && (
                                                <span className={headerData.checkedBy.startsWith("Approved") ? "text-green-600 text-[10px]" : "text-red-600 text-[10px]"}>
                                                    {headerData.checkedBy.startsWith("Approved") ? "APPROVED" : "REJECTED"}
                                                </span>
                                            )}
                                            {isEditMode && headerData.checkedBy && (
                                                <button
                                                    onClick={() => handleClearSignatureClick('checkedBy')}
                                                    className="text-gray-400 hover:text-red-600 ml-1 text-sm font-normal"
                                                    title="Clear Signature"
                                                >
                                                    &times;
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="p-1 flex items-center justify-center h-full">
                                    {isEditMode && !headerData.verifiedBy ? (
                                        <div className="flex gap-1 justify-center items-center h-full w-full">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSignatureClick('verifiedBy', 'approve')}
                                                className="h-6 text-[9px] bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 px-1.5 py-0 border-green-200"
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSignatureClick('verifiedBy', 'reject')}
                                                className="h-6 text-[9px] bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 px-1.5 py-0 border-red-200"
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-1 h-full w-full font-bold">
                                            {headerData.verifiedBy && (
                                                <span className={headerData.verifiedBy.startsWith("Approved") ? "text-green-600 text-[10px]" : "text-red-600 text-[10px]"}>
                                                    {headerData.verifiedBy.startsWith("Approved") ? "APPROVED" : "REJECTED"}
                                                </span>
                                            )}
                                            {isEditMode && headerData.verifiedBy && (
                                                <button
                                                    onClick={() => handleClearSignatureClick('verifiedBy')}
                                                    className="text-gray-400 hover:text-red-600 ml-1 text-sm font-normal"
                                                    title="Clear Signature"
                                                >
                                                    &times;
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] h-8 items-center">
                                <div className="border-r border-black p-1 flex items-center justify-center font-bold h-full">Name</div>
                                <div className="border-r border-black p-1 flex items-center justify-center font-semibold text-center h-full">
                                    {headerData.preparedBy || ""}
                                </div>
                                <div className="border-r border-black p-1 flex items-center justify-center font-semibold text-center h-full">
                                    {headerData.checkedBy ? headerData.checkedBy.replace("Approved By: ", "").replace("Rejected By: ", "") : ""}
                                </div>
                                <div className="p-1 flex items-center justify-center font-semibold text-center h-full">
                                    {headerData.verifiedBy ? headerData.verifiedBy.replace("Approved By: ", "").replace("Rejected By: ", "") : ""}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 text-sm divide-x-2 divide-black">
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Line Name-</span>
                            <Input
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0 disabled:opacity-70 disabled:cursor-default"
                                value={headerData.lineName}
                                onChange={e => handleHeaderChange('lineName', e.target.value)}
                                disabled={!isEditMode || isCellLocked('header', 'lineName')}
                            />
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Process Name-</span>
                            <Input
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0 disabled:opacity-70 disabled:cursor-default"
                                value={headerData.processName}
                                onChange={e => handleHeaderChange('processName', e.target.value)}
                                disabled={!isEditMode || isCellLocked('header', 'processName')}
                            />
                        </div>
                        <div className="p-2 flex flex-col gap-1">
                            <span className="font-semibold">Date of Level-1 Complete-</span>
                            <Input
                                type="date"
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0 disabled:opacity-70 disabled:cursor-default"
                                value={headerData.level1Date}
                                onChange={e => handleHeaderChange('level1Date', e.target.value)}
                                disabled={!isEditMode || isCellLocked('header', 'level1Date')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>
                        <div className="p-2 flex flex-col gap-1 relative">
                            <span className="font-semibold">Operator Name & Code-</span>
                            <Input
                                className="h-8 border-b border-black rounded-none border-t-0 border-x-0 focus-visible:ring-0 px-0 disabled:opacity-70 disabled:cursor-default"
                                value={headerData.operatorNameCode}
                                onChange={e => handleOperatorChange(e.target.value)}
                                onFocus={() => { if (isEditMode && operatorSuggestions.length > 0) setShowOperatorSuggestions(true); }}
                                onBlur={() => setTimeout(() => setShowOperatorSuggestions(false), 200)}
                                placeholder={isEditMode ? "Type to search..." : ""}
                                disabled={!isEditMode || isCellLocked('header', 'operatorNameCode')}
                            />
                            {isEditMode && isSearchingOperator && (
                                <div className="absolute right-1 top-9 text-[10px] text-gray-400">
                                    Searching...
                                </div>
                            )}
                            {isEditMode && showOperatorSuggestions && operatorSuggestions.length > 0 && (
                                <ul className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto z-50 text-left font-normal">
                                    {operatorSuggestions.map(student => (
                                        <li
                                            key={student.id || student._id}
                                            onMouseDown={() => handleSelectOperator(student)}
                                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm flex flex-col"
                                        >
                                            <span className="font-bold text-gray-800">{student.fullName}</span>
                                            <span className="text-xs text-gray-500 font-mono">E.Code: {student.empId || '—'}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="border-2 border-black text-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-[200px_repeat(8,1fr)_150px] divide-x border-black divide-black bg-gray-50 font-bold text-center">
                        {/* Level labels row */}
                        <div className="border-b border-black p-2 h-8"></div>
                        <div className="col-span-4 border-b border-black p-2 h-8 flex items-center justify-center">L1</div>
                        <div className="col-span-4 border-b border-black p-2 h-8 flex items-center justify-center">L2</div>
                        <div className="row-span-3 flex items-center justify-center p-2">Remarks (If Any)</div>

                        {/* Observance labels row */}
                        <div className="flex items-center justify-center p-2 border-b border-black h-12">Period for Inspection--&gt;</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">1st Observance</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">2nd Observance</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">3rd Observance</div>
                        <div className="col-span-2 border-b border-black p-2 h-12 flex items-center justify-center">4th Observance</div>

                        {/* Sub headers */}
                        <div className="border-b border-black p-2 flex items-center justify-center">Check Contents</div>

                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>1st Time</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs1 || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs1', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs1')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>
                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>Reinspect (If Fail)</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs1Re || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs1Re', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs1Re')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>

                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>1st Time</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs2 || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs2', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs2')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>
                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>Reinspect (If Fail)</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs2Re || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs2Re', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs2Re')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>

                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>1st Time</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs3 || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs3', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs3')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>
                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>Reinspect (If Fail)</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs3Re || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs3Re', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs3Re')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>

                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>1st Time</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs4 || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs4', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs4')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>
                        <div className="p-1 text-xs border-b border-black flex flex-col items-center justify-center gap-1 pb-2">
                            <span>Reinspect (If Fail)</span>
                            <Input
                                type="date"
                                className="h-6 text-[10px] p-1 font-normal w-full disabled:opacity-70 disabled:cursor-default"
                                value={tableData.columnDates?.obs4Re || ""}
                                onChange={(e) => handleTableChange('columnDates', 'obs4Re', null, e.target.value)}
                                disabled={!isEditMode || isCellLocked('date', 'obs4Re')}
                                min={todayStr}
                                max={todayStr}
                            />
                        </div>

                    </div>

                    {/* Table Body */}
                    {CHECK_CONTENTS.map((row) => (
                        <div key={row.id} className="grid grid-cols-[200px_repeat(8,1fr)_150px] divide-x divide-y border-black divide-black">
                            <div className="p-2 text-sm border-black border-t">
                                <div className="font-bold">{row.title}</div>
                                <div className="text-xs text-gray-600 whitespace-pre-wrap">{row.desc}</div>
                            </div>

                            {/* 1st Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs1')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs1Re')}</div>

                            {/* 2nd Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs2')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs2Re')}</div>

                            {/* 3rd Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs3')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs3Re')}</div>

                            {/* 4th Obs */}
                            <div className="border-black border-t">{renderCell(row.id, 'obs4')}</div>
                            <div className="border-black border-t">{renderCell(row.id, 'obs4Re')}</div>

                            {/* Remarks */}
                            <div className="p-1 border-black border-t">
                                <Textarea
                                    className="w-full h-full min-h-[80px] text-xs resize-none border-none p-1 focus-visible:ring-0 disabled:opacity-70 disabled:cursor-default disabled:resize-none"
                                    value={tableData[row.id]?.remarks || ""}
                                    onChange={(e) => handleTableChange(row.id, 'remarks', null, e.target.value)}
                                    disabled={!isEditMode || isCellLocked('remarks', row.id)}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Notes */}
                <div className="mt-4 border-2 border-black text-xs">
                    <div className="grid grid-cols-[3fr_1fr] border-b border-black">
                        <div className="p-2 border-r border-black">
                            Note: ◆ This sheet follow for the level-1 & Level-2 operator only and do inspection on mothly basis.
                        </div>
                        <div className="flex items-center justify-center font-bold bg-gray-100">
                            Revision History
                        </div>
                    </div>

                    <div className="grid grid-cols-[3fr_1fr] h-20">
                        <div className="p-2 border-r border-black flex flex-col justify-between">
                            <div>◆ If there is no abnormality found in 1st time then 2nd is not mandatory. If some lacking found in 1st time then after 1 hour training on lack points reconfirm is to be execute.</div>
                            <div>◆ During periodical inspection, inspector inspect the operator during production of 10 cycle Minimum.</div>
                        </div>
                        <div className="grid grid-cols-[1fr_2fr_2fr] divide-x divide-black h-full">
                            <div className="grid grid-rows-[auto_1fr] divide-y divide-black">
                                <div className="text-center bg-gray-50 font-bold p-1">Rev No.</div>
                                <div className="text-center p-2">00</div>
                            </div>
                            <div className="grid grid-rows-[auto_1fr] divide-y divide-black">
                                <div className="text-center bg-gray-50 font-bold p-1">Revision Date</div>
                                <div className="text-center p-2">01.04.2025</div>
                            </div>
                            <div className="grid grid-rows-[auto_1fr] divide-y divide-black">
                                <div className="text-center bg-gray-50 font-bold p-1">Revision Details</div>
                                <div className="text-center p-2">New Creation</div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-black p-1 flex justify-between text-[10px] text-gray-500">
                        <span>Doc. No:- FRM-WH-QA-277</span>
                        <span>Rev. No:00</span>
                        <span>Rev. Date : 01.04.2025</span>
                        <span>Page1:1</span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-4">
                    <Button
                        onClick={() => exportToExcel("Operator Observance Check Sheet", { id: studentId })}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                    >
                        Export to Excel
                    </Button>
                    {isEditMode && (
                        <>
                            <Button onClick={() => handleSave("Draft")} disabled={saving} className="bg-slate-600 hover:bg-slate-700 text-white">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Draft
                            </Button>
                            <Button onClick={() => handleSave("Submitted")} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Submit & Send Email
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default OperatorObservanceSheet;
