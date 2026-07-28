import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";

const emptyForm = {
    docNo: "",
    revNo: "",
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

    useEffect(() => {
        if (record) {
            setForm({
                docNo: record.docNo || "",
                revNo: record.revNo || "",
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

                    <div className="space-y-2">
                        <Label htmlFor="revDate">Revision Date</Label>
                        <Input id="revDate" type="date" value={form.revDate} onChange={handleChange("revDate")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="affectedSrNoPage">Affected Sr. No. / Page</Label>
                        <Input id="affectedSrNoPage" value={form.affectedSrNoPage} onChange={handleChange("affectedSrNoPage")} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="changeDetails">Change Details</Label>
                        <Textarea id="changeDetails" rows={4} value={form.changeDetails} onChange={handleChange("changeDetails")} />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || (isOverrideMode && !departmentId)}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RevisionEditModal;
