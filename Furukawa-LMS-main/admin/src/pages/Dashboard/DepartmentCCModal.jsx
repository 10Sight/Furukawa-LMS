import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Trash2,
    Plus,
    Loader2,
    Building2,
    Pencil,
    RefreshCw,
    X,
    UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";

export default function DepartmentCCModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [ccConfigs, setCcConfigs] = useState([]);

    // Form State
    const [selectedDeptId, setSelectedDeptId] = useState("");
    const [deptUnicode, setDeptUnicode] = useState("");
    const [deptHeadName, setDeptHeadName] = useState("");
    const [deptHeadEmail, setDeptHeadEmail] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState(null);

    // Search
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchDepartments();
            fetchCcConfigs();
            resetForm();
            setSearch("");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Fetch active departments from server
    const fetchDepartments = async () => {
        try {
            const res = await axiosInstance.get("/api/departments?limit=100");
            if (res.data?.success) {
                setDepartments(res.data.data.departments || []);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load departments");
        }
    };

    // Fetch CC configs from server
    const fetchCcConfigs = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get("/api/department-cc-configs");
            if (res.data?.success) {
                setCcConfigs(res.data.data || []);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load active CC configurations");
        } finally {
            setLoading(false);
        }
    };

    // Filter to display departments existing in the database (non-deleted)
    const activeDepts = useMemo(() => {
        return departments.filter(
            (d) => !d.isDeleted || d.isDeleted === 0 || d.isDeleted === false
        );
    }, [departments]);

    // Auto-populate when selected department changes
    useEffect(() => {
        if (!selectedDeptId) {
            setDeptUnicode("");
            setDeptHeadName("");
            setDeptHeadEmail("");
            return;
        }

        const dept = departments.find((d) => d.id.toString() === selectedDeptId);
        if (dept) {
            setDeptUnicode(dept.uniCode || "");
            setDeptHeadName(dept.instructor?.fullName || "");
            setDeptHeadEmail(dept.instructor?.email || "");
        } else {
            setDeptUnicode("");
            setDeptHeadName("");
            setDeptHeadEmail("");
        }
    }, [selectedDeptId, departments]);

    const canSubmit = Boolean(selectedDeptId && deptHeadEmail);

    const handleSubmit = async () => {
        if (!canSubmit) return toast.error("Please fill all required fields");

        setProcessing(true);
        try {
            const payload = {
                deptId: parseInt(selectedDeptId),
                departmentHeadName: deptHeadName || null,
                departmentHeadEmail: deptHeadEmail,
                isActive: isActive ? 1 : 0,
            };

            if (editingId) {
                await axiosInstance.put(`/api/department-cc-configs/${editingId}`, payload);
                toast.success("CC recipient updated successfully");
            } else {
                // Check if this department CC configuration already exists
                const alreadyExists = ccConfigs.some(
                    (c) => c.DeptID.toString() === selectedDeptId
                );
                if (alreadyExists) {
                    toast.error("A configuration already exists for this department.");
                    setProcessing(false);
                    return;
                }
                await axiosInstance.post("/api/department-cc-configs", payload);
                toast.success("CC recipient added successfully");
            }
            resetForm();
            fetchCcConfigs();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Operation failed");
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id) => {
        if (!id || !confirm("Delete this CC configuration?")) return;
        setProcessing(true);
        try {
            await axiosInstance.delete(`/api/department-cc-configs/${id}`);
            toast.success("Configuration deleted");
            if (editingId === id) resetForm();
            fetchCcConfigs();
        } catch {
            toast.error("Failed to delete CC configuration");
        } finally {
            setProcessing(false);
        }
    };

    const handleEdit = (config) => {
        setEditingId(config.ConfigID);
        setSelectedDeptId(config.DeptID?.toString() || "");
        setDeptUnicode(config.departmentUnicode || "");
        setDeptHeadName(config.DepartmentHeadName || "");
        setDeptHeadEmail(config.DepartmentHeadEmail || "");
        setIsActive(!!config.IsActive);
    };

    const resetForm = () => {
        setEditingId(null);
        setSelectedDeptId("");
        setDeptUnicode("");
        setDeptHeadName("");
        setDeptHeadEmail("");
        setIsActive(true);
    };

    const filteredConfigs = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return ccConfigs;
        return ccConfigs.filter((c) =>
            [c.departmentName, c.departmentUnicode, c.DepartmentHeadName, c.DepartmentHeadEmail]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [ccConfigs, search]);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(val) => {
                if (!val) resetForm();
                onClose(val);
            }}
        >
            <DialogContent className="w-[96vw] max-w-[1200px] p-0 bg-white text-slate-900 border border-slate-200 shadow-xl overflow-hidden rounded-2xl">
                {/* Header */}
                <DialogHeader className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                                <DialogTitle className="text-lg font-bold text-slate-900">
                                    CC Department Head Configuration
                                </DialogTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-200 text-slate-600 h-8"
                                    onClick={fetchCcConfigs}
                                    disabled={loading || processing}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                            <DialogDescription className="text-slate-500 text-sm mt-0.5">
                                Select active departments to automatically CC their Head on manpower requirement approvals.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Body */}
                <div className="px-6 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* ── LEFT: Form ── */}
                        <div className="lg:col-span-5">
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                {/* Form header bar */}
                                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {editingId ? (
                                            <Pencil className="w-4 h-4 text-orange-500" />
                                        ) : (
                                            <Plus className="w-4 h-4 text-blue-600" />
                                        )}
                                        <span className="text-sm font-semibold text-slate-800">
                                            {editingId ? "Edit CC Details" : "Add CC Department Head"}
                                        </span>
                                    </div>
                                    {editingId && (
                                        <button
                                            onClick={resetForm}
                                            className="text-slate-400 hover:text-slate-700 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Fields */}
                                <div className="p-5 space-y-4 bg-white">
                                    {/* Field 1: Department selection */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Department <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={selectedDeptId}
                                            onValueChange={setSelectedDeptId}
                                            disabled={!!editingId}
                                        >
                                            <SelectTrigger className="h-10 border-slate-200 bg-white focus:ring-blue-500">
                                                <SelectValue placeholder="Select active department…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {activeDepts.map((d) => (
                                                    <SelectItem key={d.id} value={d.id.toString()}>
                                                        {d.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {activeDepts.length === 0 && (
                                            <p className="text-[10px] text-amber-600">No active departments found.</p>
                                        )}
                                    </div>

                                    {/* Field 2: Department Unicode — auto-filled */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Department Unicode
                                            <span className="text-[10px] normal-case font-normal text-slate-400">
                                                (auto-populated)
                                            </span>
                                        </Label>
                                        <Input
                                            readOnly
                                            value={deptUnicode}
                                            placeholder="Unicode will appear here…"
                                            className="bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed h-10"
                                        />
                                    </div>

                                    {/* Field 3: Department Head Name — auto-filled */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Department Head Name
                                            <span className="text-[10px] normal-case font-normal text-slate-400">
                                                (auto-populated)
                                            </span>
                                        </Label>
                                        <Input
                                            value={deptHeadName}
                                            onChange={(e) => setDeptHeadName(e.target.value)}
                                            placeholder="Head Name will appear here…"
                                            className="border-slate-200 h-10 focus-visible:ring-blue-500"
                                        />
                                    </div>

                                    {/* Field 4: Department Head Email — auto-filled */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Department Head Email
                                            <span className="text-[10px] normal-case font-normal text-slate-400">
                                                (auto-populated)
                                            </span>
                                        </Label>
                                        <Input
                                            value={deptHeadEmail}
                                            onChange={(e) => setDeptHeadEmail(e.target.value)}
                                            placeholder="Head Email will appear here…"
                                            className="border-slate-200 h-10 focus-visible:ring-blue-500"
                                        />
                                        {selectedDeptId && !deptHeadEmail && (
                                            <p className="text-[11px] text-red-500">
                                                Warning: Selected department has no instructor (head email).
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={resetForm}
                                        disabled={processing}
                                        className="border-slate-200 text-slate-600"
                                    >
                                        {editingId ? "Cancel" : "Clear"}
                                    </Button>

                                    {editingId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(editingId)}
                                            disabled={processing}
                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}

                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleSubmit}
                                        disabled={processing || !canSubmit}
                                        className={`ml-auto ${
                                            editingId
                                                ? "bg-orange-500 hover:bg-orange-600 text-white"
                                                : "bg-blue-600 hover:bg-blue-700 text-white"
                                        }`}
                                    >
                                        {processing ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                        ) : editingId ? (
                                            <>
                                                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Update
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT: Configurations list ── */}
                        <div className="lg:col-span-7">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-slate-800">Active CC Recipients</h3>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {filteredConfigs.length}
                                    </span>
                                </div>
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search configs…"
                                    className="h-8 w-[200px] border-slate-200 text-sm"
                                />
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col h-[600px]">
                                <div className="overflow-y-auto flex-1">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 w-[40%]">Department</th>
                                                <th className="px-4 py-3 w-[42%]">Department Head</th>
                                                <th className="px-4 py-3 w-[18%] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={3} className="py-16 text-center text-slate-400">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                                            <span className="text-xs">Loading…</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredConfigs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="py-16 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                                            <Building2 className="w-8 h-8 opacity-30" />
                                                            <p className="text-sm font-medium text-slate-500">
                                                                {search ? "No matching configurations" : "No CC department heads set"}
                                                            </p>
                                                            <p className="text-xs max-w-[240px] text-slate-400">
                                                                {search
                                                                    ? "Try a different search term."
                                                                    : "Add CC configurations using the form."}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredConfigs.map((config) => (
                                                    <tr
                                                        key={config.ConfigID}
                                                        className={`group transition-colors ${
                                                            editingId === config.ConfigID
                                                                ? "bg-orange-50"
                                                                : "hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="font-medium text-slate-800 text-sm truncate">
                                                                {config.departmentName || "—"}
                                                            </div>
                                                            {config.departmentUnicode && (
                                                                <div className="text-[11px] text-slate-400 mt-0.5">
                                                                    Unicode: {config.departmentUnicode}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="text-slate-800 font-medium text-sm">
                                                                {config.DepartmentHeadName || (
                                                                    <span className="text-slate-400 italic text-xs">
                                                                        No name
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1 mt-0.5 text-slate-500 text-xs font-mono">
                                                                <span className="break-all">
                                                                    {config.DepartmentHeadEmail}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 align-top text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                                                    onClick={() => handleEdit(config)}
                                                                    disabled={processing}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                    onClick={() => handleDelete(config.ConfigID)}
                                                                    disabled={processing}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400">
                                    {filteredConfigs.length > 0
                                        ? `${filteredConfigs.length} configured`
                                        : " "}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
