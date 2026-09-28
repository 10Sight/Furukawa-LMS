import React, { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { IconFolderPlus, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useCreateMonthlyReportFolderMutation } from "@/Redux/AllApi/MonthlyMeetingReportApi";

const COLORS = [
    { key: "blue", label: "Blue", swatch: "bg-blue-500" },
    { key: "amber", label: "Amber", swatch: "bg-amber-500" },
    { key: "emerald", label: "Emerald", swatch: "bg-emerald-500" },
    { key: "indigo", label: "Indigo", swatch: "bg-indigo-500" },
];

export default function CreateFolderDialog({ open, onOpenChange, departmentId, sectionId }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState("blue");
    const [createFolder, { isLoading }] = useCreateMonthlyReportFolderMutation();

    const resetAndClose = () => {
        setName("");
        setColor("blue");
        onOpenChange(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Please enter a folder name.");
            return;
        }
        try {
            await createFolder({ departmentId, sectionId, name: name.trim(), color }).unwrap();
            toast.success("Folder created successfully!");
            resetAndClose();
        } catch (err) {
            toast.error(err?.message || "Failed to create folder.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconFolderPlus className="w-4 h-4 text-indigo-600" /> Create New Folder
                    </DialogTitle>
                    <DialogDescription>Organize monthly presentations into folders.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Folder Name *</Label>
                        <Input
                            autoFocus
                            placeholder="e.g. Quality Review Decks"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Color Theme</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {COLORS.map((c) => (
                                <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => setColor(c.key)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                                        color === c.key ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"
                                    )}
                                >
                                    <span className={cn("w-2.5 h-2.5 rounded-full", c.swatch)} />
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="cursor-pointer" disabled={isLoading} onClick={resetAndClose}>Cancel</Button>
                        <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer flex items-center gap-1.5">
                            {isLoading ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null} Create Folder
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
