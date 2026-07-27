import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import RevisionRecordList from '@/components/admin/revision/RevisionRecordList';
import RevisionHistoryList from '@/components/admin/revision/RevisionHistoryList';
import RevisionEditModal from '@/components/admin/revision/RevisionEditModal';

const RevisionTable = () => {
    const [records, setRecords] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchRecords = useCallback(async () => {
        setLoadingRecords(true);
        try {
            const res = await axiosInstance.get('/api/revision-records');
            if (res.data?.success) setRecords(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision records", error);
            toast.error("Failed to load revision records");
        } finally {
            setLoadingRecords(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await axiosInstance.get('/api/revision-records/history');
            if (res.data?.success) setHistory(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision history", error);
            toast.error("Failed to load revision history");
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
        fetchHistory();
    }, [fetchRecords, fetchHistory]);

    const handleEdit = (record) => {
        setEditingRecord(record);
        setModalOpen(true);
    };

    const handleSave = async (form) => {
        if (!editingRecord) return;
        setSaving(true);
        try {
            const res = await axiosInstance.put(`/api/revision-records/${editingRecord.id}`, form);
            if (res.data?.success) {
                toast.success("Revision record updated");
                setModalOpen(false);
                setEditingRecord(null);
                await Promise.all([fetchRecords(), fetchHistory()]);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to update revision record");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Revision Table</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="active">
                        <TabsList>
                            <TabsTrigger value="active">Active Revisions</TabsTrigger>
                            <TabsTrigger value="history">Audit Log History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active" className="mt-4">
                            <RevisionRecordList
                                records={records}
                                loading={loadingRecords}
                                canEdit
                                onEdit={handleEdit}
                            />
                        </TabsContent>
                        <TabsContent value="history" className="mt-4">
                            <RevisionHistoryList logs={history} loading={loadingHistory} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <RevisionEditModal
                record={editingRecord}
                open={modalOpen}
                onOpenChange={setModalOpen}
                onSave={handleSave}
                saving={saving}
            />
        </div>
    );
};

export default RevisionTable;
