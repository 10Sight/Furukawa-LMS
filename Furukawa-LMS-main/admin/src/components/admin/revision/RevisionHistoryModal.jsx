import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import RevisionHistoryTable from './RevisionHistoryTable';

// Scoped audit log for a single revision record (a sheet's global default, or
// one of its department/section overrides) — opened via the "Logs" button on
// a RevisionRecordList row.
const RevisionHistoryModal = ({ record, open, onOpenChange }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !record) return;
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get('/api/revision-records/history', {
                    params: {
                        sheetKey: record.sheetKey,
                        departmentId: record.departmentId || undefined,
                        sectionId: record.sectionId || undefined,
                    },
                });
                if (res.data?.success) setLogs(res.data.data || []);
            } catch (error) {
                console.error("Failed to load revision history", error);
                toast.error("Failed to load revision history");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [open, record]);

    const scopeLabel = record?.departmentName
        ? `${record.departmentName}${record.sectionName ? ` / ${record.sectionName}` : ""}`
        : "Global (all departments)";

    return (
        <Dialog open={open} onOpenChange={onOpenChange} className="sm:max-w-3xl">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{record?.sheetName || "Revision History"}</DialogTitle>
                    <DialogDescription>{scopeLabel}</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-10 text-center text-muted-foreground">Loading history...</div>
                ) : logs.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">No revision history yet.</div>
                ) : (
                    <RevisionHistoryTable logs={logs} showSheetName={false} />
                )}
            </DialogContent>
        </Dialog>
    );
};

export default RevisionHistoryModal;
