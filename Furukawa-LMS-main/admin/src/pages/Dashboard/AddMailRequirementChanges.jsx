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
    Mail,
    Pencil,
    RefreshCw,
    X,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";

/**
 * AddMailRequirementChanges.jsx
 * Light-themed modal — matches the project's white/slate design system.
 * Form has exactly two fields: Section (dropdown) + Section Unicode (auto-filled).
 */
export default function MailManagementModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [sections, setSections] = useState([]);
    const [heads, setHeads] = useState([]);

    // Form State — section + email + ccEmails array needed
    const [selectedSection, setSelectedSection] = useState("");
    const [sectionUnicode, setSectionUnicode] = useState("");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [ccEmails, setCcEmails] = useState([""]);
    const [processing, setProcessing] = useState(false);

    // CC email management helpers
    const handleAddCcField = () => {
        setCcEmails([...ccEmails, ""]);
    };

    const handleCcEmailChange = (index, value) => {
        const updated = [...ccEmails];
        updated[index] = value;
        setCcEmails(updated);
    };

    const handleRemoveCcField = (index) => {
        const updated = ccEmails.filter((_, i) => i !== index);
        setCcEmails(updated.length > 0 ? updated : [""]);
    };

    // Edit State
    const [editingId, setEditingId] = useState(null);

    // Search
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            fetchSections();
            fetchHeads();
            resetForm();
            setSearch("");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Auto-fill unicode when section changes
    useEffect(() => {
        const sec = sections.find((s) => s.id.toString() === selectedSection);
        setSectionUnicode(sec?.uniCode || "");
    }, [selectedSection, sections]);

    const fetchSections = async () => {
        try {
            const res = await axiosInstance.get("/api/sections");
            if (res.data?.success) setSections(res.data.data || []);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load sections");
        }
    };

    const fetchHeads = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get("/api/section-heads");
            if (res.data?.success) setHeads(res.data.data || []);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load recipients");
        } finally {
            setLoading(false);
        }
    };

    const canSubmit = Boolean(selectedSection && email);

    const handleSubmit = async () => {
        if (!canSubmit) return toast.error("Please fill all required fields");

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emails = email.split(",").map((e) => e.trim());
        if (emails.some((e) => !emailRegex.test(e)))
            return toast.error("Invalid email format");

        let ccEmailsStr = "";
        const ccList = ccEmails.map((e) => e.trim()).filter(Boolean);
        if (ccList.length > 0) {
            if (ccList.some((e) => !emailRegex.test(e)))
                return toast.error("Invalid CC email format");
            ccEmailsStr = ccList.join(", ");
        }

        const sec = sections.find((s) => s.id.toString() === selectedSection);

        setProcessing(true);
        try {
            const payload = {
                sectionId: selectedSection,
                sectionUnicode: sec?.uniCode || "",
                email: emails.join(", "),
                name,
                CCMail: ccEmailsStr,
            };
            if (editingId) {
                await axiosInstance.put(`/api/section-heads/${editingId}`, payload);
            } else {
                await axiosInstance.post("/api/section-heads", payload);
            }
            toast.success(editingId ? "Updated successfully" : "Recipient added");
            resetForm();
            fetchHeads();
        } catch (e) {
            toast.error(e?.response?.data?.message || "Operation failed");
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id) => {
        if (!id || !confirm("Delete this recipient?")) return;
        setProcessing(true);
        try {
            await axiosInstance.delete(`/api/section-heads/${id}`);
            toast.success("Deleted");
            if (editingId === id) resetForm();
            fetchHeads();
        } catch {
            toast.error("Failed to delete");
        } finally {
            setProcessing(false);
        }
    };

    const handleEdit = (head) => {
        setEditingId(head.id);
        setSelectedSection(head.sectionId?.toString?.() || "");
        setEmail(head.email || "");
        setName(head.name || "");
        const ccStr = head.CCMail || "";
        const ccArray = ccStr.split(",").map(e => e.trim()).filter(Boolean);
        setCcEmails(ccArray.length > 0 ? ccArray : [""]);
    };

    const resetForm = () => {
        setEditingId(null);
        setSelectedSection("");
        setSectionUnicode("");
        setEmail("");
        setName("");
        setCcEmails([""]);
    };

    const filteredHeads = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return heads;
        return heads.filter((h) =>
            [h.sectionName, h.email, h.name].filter(Boolean).join(" ").toLowerCase().includes(q)
        );
    }, [heads, search]);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(val) => {
                if (!val) resetForm();
                onClose(val);
            }}
            className="w-[96vw] max-w-[1420px] bg-white text-slate-900 border border-slate-200 shadow-xl rounded-2xl"
        >
            <DialogContent className="p-0">

                {/* Header */}
                <DialogHeader className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                                <DialogTitle className="text-lg font-bold text-slate-900">
                                    Email Notifications Manager
                                </DialogTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-200 text-slate-600 h-8"
                                    onClick={fetchHeads}
                                    disabled={loading || processing}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                                    Refresh
                                </Button>
                            </div>
                            <DialogDescription className="text-slate-500 text-sm mt-0.5">
                                Add section heads who will receive requirement update notifications.
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
                                        {editingId
                                            ? <Pencil className="w-4 h-4 text-orange-500" />
                                            : <Plus className="w-4 h-4 text-blue-600" />
                                        }
                                        <span className="text-sm font-semibold text-slate-800">
                                            {editingId ? "Edit Recipient" : "Add Recipient"}
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

                                    {/* Field 1: Section */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Section <span className="text-red-500">*</span>
                                        </Label>
                                        <Select
                                            value={selectedSection}
                                            onValueChange={setSelectedSection}
                                        >
                                            <SelectTrigger className="h-10 border-slate-200 bg-white focus:ring-blue-500">
                                                <SelectValue placeholder="Select a section…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sections.map((s) => (
                                                    <SelectItem key={s.id} value={s.id.toString()}>
                                                        {s.name}{s.category ? `(${s.category.toLowerCase()})` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Field 2: Section Unicode — auto-filled */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            Section Unicode
                                            <span className="text-[10px] normal-case font-normal text-slate-400">(auto-filled)</span>
                                        </Label>
                                        <Input
                                            readOnly
                                            value={sectionUnicode}
                                            placeholder="Select a section above…"
                                            className="bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed h-10"
                                        />
                                    </div>

                                    {/* Field 3: Name (optional) */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Recipient Name <span className="text-slate-400 font-normal normal-case">(optional)</span>
                                        </Label>
                                        <Input
                                            placeholder="e.g. John Doe"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="border-slate-200 h-10"
                                        />
                                    </div>

                                    {/* Field 4: Email */}
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                            Email Address <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            placeholder="user@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="border-slate-200 h-10"
                                        />
                                        <p className="text-[11px] text-slate-400">Separate multiple emails with commas.</p>
                                    </div>

                                    {/* Field 5: CC Emails with dynamic fields */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                CC Email Address(es) <span className="text-slate-400 font-normal normal-case">(optional)</span>
                                            </Label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleAddCcField}
                                                className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs font-semibold flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Add CC
                                            </Button>
                                        </div>
                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                            {ccEmails.map((cc, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <Input
                                                        placeholder={`cc${index + 1}@example.com`}
                                                        value={cc}
                                                        onChange={(e) => handleCcEmailChange(index, e.target.value)}
                                                        className="border-slate-200 h-9 flex-1"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveCcField(index)}
                                                        className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                                                        title="Remove CC"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-slate-400">Configure multiple CC email recipients for this section.</p>
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
                                        className={`ml-auto ${editingId
                                            ? "bg-orange-500 hover:bg-orange-600 text-white"
                                            : "bg-blue-600 hover:bg-blue-700 text-white"
                                        }`}
                                    >
                                        {processing
                                            ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                            : editingId
                                                ? <><Pencil className="w-3.5 h-3.5 mr-1.5" /> Update</>
                                                : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Add</>
                                        }
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT: Recipients list ── */}
                        <div className="lg:col-span-7">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-slate-800">Recipients:</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700">
                                            {filteredHeads.length}
                                        </span>
                                    </div>
                                    <div className="h-4 w-[1px] bg-slate-200" />
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-semibold text-slate-800">Total CCs:</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                                            {filteredHeads.reduce((acc, h) => acc + (h.CCMail ? h.CCMail.split(",").length : 0), 0)}
                                        </span>
                                    </div>
                                </div>
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search…"
                                    className="h-8 w-[200px] border-slate-200 text-sm"
                                />
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col h-[600px]">
                                <div className="overflow-y-auto flex-1">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 w-[35%]">Section</th>
                                                <th className="px-4 py-3 w-[47%]">Recipient</th>
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
                                            ) : filteredHeads.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="py-16 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                                            <Mail className="w-8 h-8 opacity-30" />
                                                            <p className="text-sm font-medium text-slate-500">
                                                                {search ? "No matching recipients" : "No recipients yet"}
                                                            </p>
                                                            <p className="text-xs max-w-[220px] text-slate-400">
                                                                {search ? "Try a different term." : "Add a recipient using the form."}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredHeads.map((head) => (
                                                    <tr
                                                        key={head.id}
                                                        className={`group transition-colors ${editingId === head.id
                                                            ? "bg-orange-50"
                                                            : "hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="font-medium text-slate-800 text-sm truncate">
                                                                {head.sectionName || "—"}
                                                                {head.sectionCategory && (
                                                                    <span className="text-xs font-normal text-slate-400 ml-1.5">
                                                                        ({head.sectionCategory.toLowerCase()})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {head.subSectionName && (
                                                                <div className="text-[11px] text-slate-400 mt-0.5">{head.subSectionName}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 align-top">
                                                            <div className="text-slate-800 font-medium text-sm">{head.name || <span className="text-slate-400 italic text-xs">No name</span>}</div>
                                                            <div className="flex flex-col gap-1 mt-0.5 text-slate-500 text-xs font-mono">
                                                                <div className="flex items-center gap-1">
                                                                    <Mail className="w-3 h-3 opacity-40 shrink-0" />
                                                                    <span className="break-all">{head.email}</span>
                                                                </div>
                                                                {head.CCMail && (
                                                                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                                                        <span className="font-semibold select-none text-[9px] bg-slate-100 px-1 py-0.2 rounded border border-slate-200 text-slate-500">CC</span>
                                                                        <span className="break-all">{head.CCMail}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 align-top text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                                                    onClick={() => handleEdit(head)}
                                                                    disabled={processing}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                    onClick={() => handleDelete(head.id)}
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
                                    {filteredHeads.length > 0 ? `${filteredHeads.length} configured` : " "}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
