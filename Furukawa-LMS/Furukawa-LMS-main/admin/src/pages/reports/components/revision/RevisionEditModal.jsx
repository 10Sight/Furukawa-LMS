import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/common/ui/dialog.jsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/forms/primitives/select.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Textarea } from "@/components/forms/primitives/textarea.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/common/ui/alert-dialog.jsx";
import { Loader2 } from 'lucide-react';
import PropagationNotice from "./PropagationNotice.jsx";
import usePropagationPreview from "@/hooks/usePropagationPreview.js";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";

const emptyForm = {
    docNo: "",
    revNo: "",
    issueDate: "",
    revDate: "",
    affectedSrNoPage: "",
    changeDetails: "",
};

// `record` (editing an existing row by id — its own department/section scope is
// fixed and shown read-only) and `overrideTarget` ({ sheetKey, sheetName } — adding
// a brand-new department/section override for that sheet, scope pickers enabled)
// are mutually exclusive; whichever is set determines the mode.
const RevisionEditModal = ({ record, overrideTarget, open, onOpenChange, onSave, saving }) => {
    const [form, setForm] = useState(emptyForm);
    const [departmentId, setDepartmentId] = useState("");
    const [sectionId, setSectionId] = useState("");

    const isOverrideMode = !record && !!overrideTarget;

    const { data: deptData } = useGetAllDepartmentsQuery({ limit: 100 }, { skip: !isOverrideMode });
    const departments = deptData?.data?.departments || [];

    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        departmentId,
        { skip: !isOverrideMode || !departmentId }
    );
    const sections = sectionData?.data || [];

    // Scope this save will apply to: the record's own fixed scope, or the
    // department/section being picked for a new override.
    const previewDeptId = isOverrideMode ? departmentId : record?.departmentId;
    const previewSectionId = isOverrideMode ? sectionId : record?.sectionId;
    const { count: affectedCount, loading: loadingPreview } = usePropagationPreview(
        record?.sheetKey || overrideTarget?.sheetKey,
        previewDeptId,
        previewSectionId,
        open && (!isOverrideMode || !!departmentId)
    );
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (record) {
            setForm({
                docNo: record.docNo || "",
                revNo: record.revNo || "",
                issueDate: record.issueDate || "",
                revDate: record.revDate || "",
                affectedSrNoPage: record.affectedSrNoPage || "",
                changeDetails: record.changeDetails || "",
            });
            setDepartmentId(record.departmentId ? String(record.departmentId) : "");
            setSectionId(record.sectionId ? String(record.sectionId) : "");
        } else if (overrideTarget) {
            setForm(emptyForm);
            setDepartmentId("");
            setSectionId("");
        }
    }, [record, overrideTarget]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Editing reaches already-saved sheets — make the admin confirm that first.
        if (affectedCount > 0) {
            setConfirmOpen(true);
            return;
        }
        doSave();
    };

    const doSave = () => {
        setConfirmOpen(false);
        if (isOverrideMode) {
            onSave({ ...form, departmentId, sectionId: sectionId || null });
        } else {
            onSave(form);
        }
    };

    const scopeLabel = record
        ? (record.departmentName
            ? `${record.departmentName}${record.sectionName ? ` / ${record.sectionName}` : ""}`
            : "Global (all departments)")
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isOverrideMode ? "Add Department Override" : "Edit Revision Record"}</DialogTitle>
                    <DialogDescription>{record?.sheetName || overrideTarget?.sheetName}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isOverrideMode ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="departmentId">Department</Label>
                                <Select value={departmentId} onValueChange={(val) => { setDepartmentId(val); setSectionId(""); }}>
                                    <SelectTrigger id="departmentId">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id || dept._id} value={String(dept.id || dept._id)}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sectionId">Section (optional)</Label>
                                <Select value={sectionId} onValueChange={setSectionId} disabled={!departmentId}>
                                    <SelectTrigger id="sectionId">
                                        <SelectValue placeholder="Whole department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((sec) => (
                                            <SelectItem key={sec.id || sec._id} value={String(sec.id || sec._id)}>
                                                {sec.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wide">Scope</Label>
                            <div className="text-sm font-medium">{scopeLabel}</div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="docNo">Document No.</Label>
                            <Input id="docNo" value={form.docNo} onChange={handleChange("docNo")} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="revNo">Revision No.</Label>
                            <Input id="revNo" value={form.revNo} onChange={handleChange("revNo")} required />
                        </div>
                    </div>

                    {/* Plain text, not type="date": stored values are free-form paper-header
                        dates like "30.01.2024" / "16.10.20", which a date input can't display. */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="issueDate">Issue Date</Label>
                            <Input id="issueDate" value={form.issueDate} onChange={handleChange("issueDate")} placeholder="DD.MM.YYYY" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="revDate">Revision Date</Label>
                            <Input id="revDate" value={form.revDate} onChange={handleChange("revDate")} placeholder="DD.MM.YYYY" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="affectedSrNoPage">Affected Sr. No. / Page</Label>
                        <Input id="affectedSrNoPage" value={form.affectedSrNoPage} onChange={handleChange("affectedSrNoPage")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="changeDetails">Change Details</Label>
                        <Textarea id="changeDetails" rows={4} value={form.changeDetails} onChange={handleChange("changeDetails")} />
                    </div>

                    <PropagationNotice count={affectedCount} loading={loadingPreview} />

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || loadingPreview || (isOverrideMode && !departmentId)}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Update {affectedCount} saved sheet{affectedCount === 1 ? "" : "s"}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The new Doc. No., Rev. No., Issue Date and Rev. Date will replace the values on{" "}
                            {affectedCount} already-saved {record?.sheetName || overrideTarget?.sheetName} sheet{affectedCount === 1 ? "" : "s"},
                            including submitted and approved ones. This can&apos;t be undone automatically.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={doSave}>Save &amp; Update Sheets</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
};

export default RevisionEditModal;
