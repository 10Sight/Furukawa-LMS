import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    IconAlertTriangle,
    IconPlus,
    IconTrash,
    IconDeviceFloppy,
    IconCheck,
    IconX,
    IconHierarchy2,
    IconCalendar,
    IconRefresh
} from "@tabler/icons-react";

// RTK Query imports
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import {
    useGetAbnormalConditionSheetQuery,
    useUpdateAbnormalConditionSheetMutation,
    useApproveAbnormalConditionEntryMutation,
    useDeleteAbnormalConditionSheetMutation
} from "@/Redux/AllApi/AbnormalConditionApi";
import { EditableCell } from "@/components/admin/LayoutEditorCells";

export default function AbnormalCondition() {
    const authUser = useSelector((state) => state.auth.user);
    const todayStr = new Date().toISOString().split("T")[0];

    // Permission evaluation
    const isMasterAdmin =
        authUser?.role === "SUPERADMIN" ||
        authUser?.role === "ADMIN" ||
        authUser?.isAdmin === 1 ||
        authUser?.isAdmin === true;

    // Granular Permissions
    const userPermissions = authUser?.customRole?.permissions || [];
    const canView = isMasterAdmin || userPermissions.includes("abnormal_condition:read");
    const canEdit = isMasterAdmin || userPermissions.includes("abnormal_condition:update");
    const canDelete = isMasterAdmin || userPermissions.includes("abnormal_condition:delete");
    const canApprove = isMasterAdmin || userPermissions.includes("abnormal_condition:approve");

    // States for Filter Hierarchy (Streamlined)
    const [selectedDept, setSelectedDept] = useState("");
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        return `${y}-${m}`; // YYYY-MM
    });

    // Dynamic dropdown data
    const { data: deptsData } = useGetAllDepartmentsQuery({ limit: 500 });
    const departments = useMemo(() => deptsData?.data?.departments || [], [deptsData]);

    // Filter departments based on user assignment
    const assignableDepartments = useMemo(() => {
        if (!authUser) return [];
        const allDepts = departments || [];
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);

        if (isMasterAdmin && assignedIds.length === 0) return allDepts;

        return allDepts.filter((d) =>
            assignedIds.includes(String(d.id || d._id))
        );
    }, [departments, authUser, isMasterAdmin]);

    // Auto-select first department if assignable
    useEffect(() => {
        if (assignableDepartments.length > 0 && !selectedDept) {
            setSelectedDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        }
    }, [assignableDepartments, selectedDept]);

    // Query for Active Sheet (Auto-loads and auto-creates on the backend!)
    const queryParams = useMemo(() => {
        return {
            departmentId: selectedDept,
            date: `${selectedMonth}-01` // pass normalized date parameter
        };
    }, [selectedDept, selectedMonth]);

    const {
        data: sheetResponse,
        isLoading: isSheetLoading,
        refetch: refetchSheet
    } = useGetAbnormalConditionSheetQuery(queryParams, {
        skip: !selectedDept || !selectedMonth || !canView
    });

    const activeSheet = sheetResponse?.data || null;

    // Mutator Hooks
    const [updateSheet, { isLoading: isSaving }] = useUpdateAbnormalConditionSheetMutation();
    const [deleteSheet, { isLoading: isDeleting }] = useDeleteAbnormalConditionSheetMutation();
    const [triggerApproveRow] = useApproveAbnormalConditionEntryMutation();

    // Local state for active sheet edits
    const [localEntries, setLocalEntries] = useState([]);
    const [localMetadata, setLocalMetadata] = useState({});

    useEffect(() => {
        if (activeSheet) {
            setLocalEntries(activeSheet.entries || []);
            setLocalMetadata(activeSheet.metadata || {});
        } else {
            setLocalEntries([]);
            setLocalMetadata({});
        }
    }, [activeSheet]);

    const handleApproveRow = async (sNo, action) => {
        if (!activeSheet) return;
        try {
            // Automatically save any pending changes first to prevent data loss (only if user has edit permissions)
            if (canEdit) {
                await updateSheet({
                    id: activeSheet.id,
                    entries: localEntries,
                    metadata: localMetadata,
                    isSubmitted: activeSheet.isSubmitted
                }).unwrap();
            }

            const res = await triggerApproveRow({
                id: activeSheet.id,
                sNo,
                action
            }).unwrap();
            toast.success(res.message || `Row approved successfully`);
            refetchSheet();
        } catch (err) {
            toast.error(err?.data?.message || "Failed to sign row");
        }
    };

    // Update row cell values locally
    const handleCellChange = (index, field, value) => {
        if (field === "date" && value) {
            if (value !== todayStr) {
                toast.error("You can only select today's date.");
                return;
            }
        }
        setLocalEntries((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Auto-fill OK Qty and NG Qty calculation
    const handleQtyChange = (index, field, value) => {
        const val = parseInt(value) || 0;
        setLocalEntries((prev) => {
            const updated = [...prev];
            const row = { ...updated[index], [field]: value };

            const prod = parseInt(row.producedQty) || 0;
            const ok = parseInt(row.okQty) || 0;
            const ng = parseInt(row.ngQty) || 0;

            if (field === "producedQty") {
                row.okQty = String(val - ng >= 0 ? val - ng : val);
                row.ngQty = String(val - ok >= 0 ? val - ok : 0);
            } else if (field === "okQty") {
                if (val > prod && prod > 0) {
                    row.okQty = String(prod);
                    row.ngQty = "0";
                } else if (prod > 0) {
                    row.ngQty = String(prod - val);
                }
            } else if (field === "ngQty") {
                if (val > prod && prod > 0) {
                    row.ngQty = String(prod);
                    row.okQty = "0";
                } else if (prod > 0) {
                    row.okQty = String(prod - val);
                }
            }

            updated[index] = row;
            return updated;
        });
    };

    // Save Sheet mutations
    const handleSaveSheet = async (isSubmitting = false) => {
        if (!activeSheet) return;
        try {
            await updateSheet({
                id: activeSheet.id,
                entries: localEntries,
                metadata: localMetadata,
                isSubmitted: isSubmitting ? true : activeSheet.isSubmitted
            }).unwrap();

            toast.success(isSubmitting ? "Sheet submitted successfully!" : "Changes saved successfully!");
            refetchSheet();
        } catch (err) {
            toast.error(err?.data?.message || "Failed to save sheet changes");
        }
    };

    // Add Row dynamically
    const handleAddRow = () => {
        setLocalEntries((prev) => {
            const nextSno = prev.length + 1;
            const todayStr = new Date().toISOString().split("T")[0];
            return [
                ...prev,
                {
                    sNo: nextSno,
                    date: prev.length === 0 ? todayStr : "",
                    lineText: "",
                    processText: "",
                    producedQty: "",
                    okQty: "",
                    ngQty: "",
                    abnormalCondition: "",
                    cause: "",
                    action: "",
                    respUserText: "",
                    target: "",
                    setupConfirmation: "",
                    approvalStatus: "PENDING",
                    approvedBy: ""
                }
            ];
        });
    };

    // Delete Row dynamically
    const handleRemoveRow = (index) => {
        setLocalEntries((prev) => {
            const filtered = prev.filter((_, i) => i !== index);
            return filtered.map((e, idx) => ({ ...e, sNo: idx + 1 }));
        });
    };

    // Delete Entire Sheet
    const handleDeleteSheet = async () => {
        if (!activeSheet) return;
        if (!window.confirm("Are you sure you want to permanently delete this entire sheet?")) return;
        try {
            await deleteSheet(activeSheet.id).unwrap();
            toast.success("Sheet deleted successfully");
            refetchSheet();
        } catch (err) {
            toast.error(err?.data?.message || "Failed to delete sheet");
        }
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white border border-gray-100 rounded-3xl">
                <IconAlertTriangle className="w-16 h-16 text-red-500 mb-4 opacity-75" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                    You do not have page read permissions. Please check with your supervisor or administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 min-w-[1200px] w-full pb-20 p-2 md:p-4 min-h-screen">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500 rounded-xl shadow-lg shadow-red-200">
                        <IconAlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Abnormal Condition Sheet</h1>
                        <p className="text-sm text-slate-500 font-medium">Record and analyze process abnormalities and countermeasure sheets</p>
                    </div>
                </div>
            </div>

            {/* Selection Filter Bar */}
            <Card className="border-slate-200 shadow-sm overflow-hidden no-print">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconHierarchy2 className="w-4 h-4 text-red-500" />
                        Hierarchy Selection Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                        {/* Dept */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                            <Select value={String(selectedDept)} onValueChange={(val) => setSelectedDept(val)}>
                                <SelectTrigger className="h-10 bg-white border-slate-200">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((d) => (
                                        <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Month Picker */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Month Filter</Label>
                            <div className="relative">
                                <Input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="h-10 border-slate-200 pl-10"
                                />
                                <IconCalendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Abnormal Conditions Sheet Area */}
            {isSheetLoading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500"></div>
                </div>
            ) : activeSheet ? (
                <div className="space-y-6">
                    {/* Main Spreadsheet Container */}
                    <Card className="border-slate-200 shadow-xl rounded-2xl min-w-[1200px] w-max">
                        <CardHeader className="text-center bg-slate-50 border-b pb-4 shrink-0 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-left">
                                <span className="text-xs font-mono font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                    Monthly Form View
                                </span>
                                <CardTitle className="text-lg font-bold text-slate-800 mt-2">
                                    Abnormal Conditions recording and countermeasure sheet ({activeSheet.departmentName} - {new Date(activeSheet.date).toLocaleString('default', { month: 'long', year: 'numeric' })})
                                </CardTitle>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 no-print">
                                {canDelete && (
                                    <Button variant="ghost" onClick={handleDeleteSheet} disabled={isDeleting} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9">
                                        <IconTrash className="w-4 h-4 mr-1.5" /> Delete Sheet
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => refetchSheet()} className="h-9">
                                    <IconRefresh className="w-4 h-4" />
                                </Button>
                                {canEdit && (
                                    <Button onClick={() => handleSaveSheet(false)} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                                        <IconDeviceFloppy className="w-4 h-4 mr-1.5" /> Save Sheet
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Interactive Excel Grid */}
                            <table className="w-full border-collapse border border-slate-300 text-slate-800 min-w-[1200px] table-auto">
                                <thead>
                                    <tr className="bg-slate-100 text-xs text-center border-b border-slate-300">
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[50px]">S.No</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[130px]">Date</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[130px]">Line</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[150px]">Process</th>
                                        <th colSpan={3} className="p-2 border border-slate-300 font-bold">Immediate containment action (if required)</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[180px]">Abnormal Condition</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[180px]">Cause</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[180px]">Action</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[170px]">Resp</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[110px]">Target</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[180px]">Setup Confirmation before restart process</th>
                                        <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[160px]">Approved By (Head, QA)</th>
                                        {canEdit && <th rowSpan={3} className="p-2 border border-slate-300 font-bold min-w-[60px] no-print">Actions</th>}
                                    </tr>
                                    <tr className="bg-slate-100 text-[10px] text-center border-b border-slate-300">
                                        <th colSpan={3} className="p-1.5 border border-slate-300 font-semibold bg-slate-50/80 max-w-[200px] leading-snug">
                                            Checking status of the previously produced production same lot (if required)
                                        </th>
                                    </tr>
                                    <tr className="bg-slate-100 text-[10px] text-center border-b border-slate-300">
                                        <th className="p-1 border border-slate-300 font-bold min-w-[80px]">Produced Qty.</th>
                                        <th className="p-1 border border-slate-300 font-bold min-w-[80px]">OK Qty.</th>
                                        <th className="p-1 border border-slate-300 font-bold min-w-[80px]">NG. Qty.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {localEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={15} className="p-8 text-center text-gray-400 text-sm">
                                                No rows added. Click "Add Sheet Row" below.
                                            </td>
                                        </tr>
                                    ) : (
                                        localEntries.map((e, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors border-b border-slate-200">
                                                {/* S.No */}
                                                <td className="p-2 border border-slate-200 text-center font-bold text-xs bg-slate-50/50">
                                                    {e.sNo}
                                                </td>

                                                {/* Date */}
                                                <td className="p-1 border border-slate-200 text-center text-xs">
                                                    <input
                                                        type="date"
                                                        disabled={!canEdit}
                                                        value={e.date ? e.date.split("T")[0] : ""}
                                                        onChange={(event) => handleCellChange(idx, "date", event.target.value)}
                                                        className="bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 text-center"
                                                        style={{ width: "120px" }}
                                                        min={todayStr}
                                                        max={todayStr}
                                                    />
                                                </td>

                                                {/* Line */}
                                                <td className="p-1 border border-slate-200 text-xs">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.lineText || ""}
                                                        onCommit={(v) => handleCellChange(idx, "lineText", v)}
                                                    />
                                                </td>

                                                {/* Process */}
                                                <td className="p-1 border border-slate-200 text-xs">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.processText || ""}
                                                        onCommit={(v) => handleCellChange(idx, "processText", v)}
                                                    />
                                                </td>

                                                {/* Produced Qty */}
                                                <td className="p-1 border border-slate-200 text-center text-xs">
                                                    <input
                                                        type="number"
                                                        disabled={!canEdit}
                                                        value={e.producedQty || ""}
                                                        onChange={(event) => handleQtyChange(idx, "producedQty", event.target.value)}
                                                        className="bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 text-center font-semibold"
                                                        style={{ width: `${Math.max(String(e.producedQty || "").length || 1, 6) + 2}ch`, minWidth: "60px" }}
                                                    />
                                                </td>

                                                {/* OK Qty */}
                                                <td className="p-1 border border-slate-200 text-center text-xs">
                                                    <input
                                                        type="number"
                                                        disabled={!canEdit}
                                                        value={e.okQty || ""}
                                                        onChange={(event) => handleQtyChange(idx, "okQty", event.target.value)}
                                                        className="bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 text-center font-semibold text-green-600"
                                                        style={{ width: `${Math.max(String(e.okQty || "").length || 1, 6) + 2}ch`, minWidth: "60px" }}
                                                    />
                                                </td>

                                                {/* NG Qty */}
                                                <td className="p-1 border border-slate-200 text-center text-xs">
                                                    <input
                                                        type="number"
                                                        disabled={!canEdit}
                                                        value={e.ngQty || ""}
                                                        onChange={(event) => handleQtyChange(idx, "ngQty", event.target.value)}
                                                        className="bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 text-center font-semibold text-red-500"
                                                        style={{ width: `${Math.max(String(e.ngQty || "").length || 1, 6) + 2}ch`, minWidth: "60px" }}
                                                    />
                                                </td>

                                                {/* Abnormal Condition */}
                                                <td className="p-1 border border-slate-200">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.abnormalCondition || ""}
                                                        onCommit={(v) => handleCellChange(idx, "abnormalCondition", v)}
                                                        className="font-medium"
                                                    />
                                                </td>

                                                {/* Cause */}
                                                <td className="p-1 border border-slate-200">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.cause || ""}
                                                        onCommit={(v) => handleCellChange(idx, "cause", v)}
                                                    />
                                                </td>

                                                {/* Action */}
                                                <td className="p-1 border border-slate-200">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.action || ""}
                                                        onCommit={(v) => handleCellChange(idx, "action", v)}
                                                    />
                                                </td>

                                                {/* Resp */}
                                                <td className="p-1 border border-slate-200">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.respUserText || ""}
                                                        onCommit={(v) => handleCellChange(idx, "respUserText", v)}
                                                    />
                                                </td>

                                                {/* Target */}
                                                <td className="p-1 border border-slate-200 text-xs">
                                                    <EditableCell
                                                        disabled={!canEdit}
                                                        placeholder="Target Date/Days"
                                                        value={e.target || ""}
                                                        onCommit={(v) => handleCellChange(idx, "target", v)}
                                                        className="text-center"
                                                    />
                                                </td>

                                                {/* Setup Confirmation */}
                                                <td className="p-1 border border-slate-200">
                                                    <EditableCell
                                                        multiline
                                                        disabled={!canEdit}
                                                        value={e.setupConfirmation || ""}
                                                        onCommit={(v) => handleCellChange(idx, "setupConfirmation", v)}
                                                    />
                                                </td>

                                                {/* Approved By (Head, QA) */}
                                                <td className="p-2 border border-slate-200 text-center text-xs">
                                                    {e.approvalStatus === "APPROVED" ? (
                                                        <div className="flex flex-col items-center justify-center gap-1.5 p-1 bg-green-50 rounded-lg border border-green-200 text-green-700">
                                                            <div className="flex items-center gap-1 font-bold text-[10px] uppercase">
                                                                <IconCheck className="w-3.5 h-3.5" /> Approved
                                                            </div>
                                                            <span className="text-[10px] font-semibold">{e.approvedBy}</span>
                                                            {canApprove && (
                                                                <button
                                                                    onClick={() => handleApproveRow(e.sNo, "RESET")}
                                                                    className="text-[9px] text-red-500 font-semibold underline hover:text-red-700 mt-1"
                                                                >
                                                                    Revoke Approval
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : e.approvalStatus === "REJECTED" ? (
                                                        <div className="flex flex-col items-center justify-center gap-1.5 p-1 bg-red-50 rounded-lg border border-red-200 text-red-700">
                                                            <div className="flex items-center gap-1 font-bold text-[10px] uppercase">
                                                                <IconX className="w-3.5 h-3.5" /> Rejected
                                                            </div>
                                                            <span className="text-[10px] font-semibold">{e.approvedBy}</span>
                                                            {canApprove && (
                                                                <button
                                                                    onClick={() => handleApproveRow(e.sNo, "RESET")}
                                                                    className="text-[9px] text-blue-600 font-semibold underline hover:text-blue-800 mt-1"
                                                                >
                                                                    Reset Row
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center gap-2">
                                                            {canApprove ? (
                                                                e.date ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Button
                                                                            size="xs"
                                                                            onClick={() => handleApproveRow(e.sNo, "APPROVED")}
                                                                            className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-2 h-7 rounded"
                                                                        >
                                                                            Approve
                                                                        </Button>
                                                                        <Button
                                                                            size="xs"
                                                                            onClick={() => handleApproveRow(e.sNo, "REJECTED")}
                                                                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2 h-7 rounded"
                                                                        >
                                                                            Reject
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-500 font-semibold italic">Fill Date first</span>
                                                                )
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-medium italic">Pending QA Sign-off</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Delete Row button */}
                                                {canEdit && (
                                                    <td className="p-2 border border-slate-200 text-center no-print">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveRow(idx)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 rounded-lg"
                                                        >
                                                            <IconTrash className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Spreadsheet Footer Metadata */}
                            <div className="p-4 border-t bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-semibold text-slate-500">
                                <div>
                                    Remarks: <span className="text-slate-700 font-bold">{localMetadata.remarks || "NG product will be handled as the defective product handling system"}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-6">
                                    <span>FORM NO: <span className="text-slate-700 font-bold">{localMetadata.docNo || "FRM/QA/155-A"}</span></span>
                                    <span>REV NO: <span className="text-slate-700 font-bold">{localMetadata.revNo || "01"}</span></span>
                                    <span>Rev. Date: <span className="text-slate-700 font-bold">{localMetadata.revDate || "10.04.15"}</span></span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Add Row and Save Action Buttons */}
                    {canEdit && (
                        <div className="flex items-center justify-between no-print">
                            <Button
                                onClick={handleAddRow}
                                variant="outline"
                                className="border-slate-300 hover:bg-slate-50 text-slate-700 gap-1 h-9 rounded-lg"
                            >
                                <IconPlus className="w-4 h-4" /> Add Sheet Row
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={() => handleSaveSheet(false)}
                                    disabled={isSaving}
                                    variant="outline"
                                    className="border-slate-300 hover:bg-slate-50 text-slate-700 gap-1.5 h-9 rounded-lg"
                                >
                                    <IconDeviceFloppy className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Sheet"}
                                </Button>
                                <Button
                                    onClick={() => handleSaveSheet(true)}
                                    disabled={isSaving}
                                    className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-9 rounded-lg shadow-md shadow-green-100"
                                >
                                    <IconCheck className="w-4 h-4" /> Submit & Send Email
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconAlertTriangle className="w-16 h-16 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">No Department Selected</h3>
                    <p className="text-sm text-slate-500 max-w-sm text-center mt-2 leading-relaxed">
                        Please select an assignable department and month to view the monthly Abnormal Condition Sheet.
                    </p>
                </div>
            )}
        </div>
    );
}
