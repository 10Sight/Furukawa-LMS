import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { IconUpload, IconLoader2, IconFileUpload } from "@tabler/icons-react";
import { useUploadMonthlyReportRecordMutation } from "@/Redux/AllApi/MonthlyMeetingReportApi";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(String);
const MAX_FILE_SIZE_BYTES = 300 * 1024 * 1024;

export default function UploadRecordDialog({ open, onOpenChange, folderId }) {
    const [title, setTitle] = useState("");
    const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);
    const [uploadRecord, { isLoading }] = useUploadMonthlyReportRecordMutation();

    const resetAndClose = () => {
        setTitle(""); setMonth(MONTHS[new Date().getMonth()]); setYear(String(CURRENT_YEAR)); setSelectedFile(null);
        onOpenChange(false);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith(".pptx") && !lowerName.endsWith(".ppt")) {
            toast.error("Please choose a valid PowerPoint file (.pptx or .ppt).");
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error("File is too large — the limit is 300 MB.");
            return;
        }
        setSelectedFile(file);
        if (!title.trim()) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter a presentation name.");
            return;
        }
        if (!selectedFile) {
            toast.error("Please choose a PowerPoint file (.pptx / .ppt).");
            return;
        }

        const formData = new FormData();
        formData.append("folderId", folderId);
        formData.append("title", title.trim());
        formData.append("month", month);
        formData.append("year", year);
        formData.append("file", selectedFile);

        try {
            await uploadRecord(formData).unwrap();
            toast.success("Presentation uploaded — converting slides in the background.");
            resetAndClose();
        } catch (err) {
            toast.error(err?.message || "Failed to upload presentation.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconFileUpload className="w-4 h-4 text-indigo-600" /> Add PowerPoint Record
                    </DialogTitle>
                    <DialogDescription>Slides are generated automatically after upload — this can take a minute for large decks.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Presentation Name *</Label>
                        <Input
                            placeholder="e.g. FME Quality Review (Jan - Aug)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Month *</Label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Year *</Label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>PowerPoint File (.pptx / .ppt) *</Label>
                        <input type="file" ref={fileInputRef} accept=".pptx,.ppt" className="hidden" onChange={handleFileChange} />
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/40 rounded-xl p-4 text-center cursor-pointer transition-colors"
                        >
                            <IconUpload className="w-6 h-6 mx-auto text-indigo-600 mb-1.5" />
                            {selectedFile ? (
                                <div>
                                    <div className="text-xs font-bold text-slate-800">{selectedFile.name}</div>
                                    <div className="text-[11px] text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB — file selected</div>
                                </div>
                            ) : (
                                <div>
                                    <div className="text-xs font-bold text-slate-800">Choose a .pptx file or click to browse</div>
                                    <div className="text-[11px] text-slate-400">Up to 300 MB</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" className="cursor-pointer" disabled={isLoading} onClick={resetAndClose}>Cancel</Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5">
                            {isLoading ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null} {isLoading ? "Uploading…" : "Upload"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
