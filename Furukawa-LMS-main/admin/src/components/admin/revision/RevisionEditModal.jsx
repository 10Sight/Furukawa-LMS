import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';

const emptyForm = {
    docNo: "",
    revNo: "",
    revDate: "",
    affectedSrNoPage: "",
    affectedSrNoPageHi: "",
    changeDetails: "",
    changeDetailsHi: "",
};

const RevisionEditModal = ({ record, open, onOpenChange, onSave, saving }) => {
    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (record) {
            setForm({
                docNo: record.docNo || "",
                revNo: record.revNo || "",
                revDate: record.revDate || "",
                affectedSrNoPage: record.affectedSrNoPage || "",
                affectedSrNoPageHi: record.affectedSrNoPageHi || "",
                changeDetails: record.changeDetails || "",
                changeDetailsHi: record.changeDetailsHi || "",
            });
        }
    }, [record]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Revision Record</DialogTitle>
                    <DialogDescription>{record?.sheetName}</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <Input id="revDate" type="text" placeholder="DD.MM.YYYY" value={form.revDate} onChange={handleChange("revDate")} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="affectedSrNoPage">Affected Sr. No. / Page (English)</Label>
                            <Input id="affectedSrNoPage" value={form.affectedSrNoPage} onChange={handleChange("affectedSrNoPage")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="affectedSrNoPageHi">Affected Sr. No. / Page (हिन्दी)</Label>
                            <Input id="affectedSrNoPageHi" value={form.affectedSrNoPageHi} onChange={handleChange("affectedSrNoPageHi")} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="changeDetails">Change Details (English)</Label>
                            <Textarea id="changeDetails" rows={4} value={form.changeDetails} onChange={handleChange("changeDetails")} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="changeDetailsHi">Change Details (हिन्दी)</Label>
                            <Textarea id="changeDetailsHi" rows={4} value={form.changeDetailsHi} onChange={handleChange("changeDetailsHi")} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving}>
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
