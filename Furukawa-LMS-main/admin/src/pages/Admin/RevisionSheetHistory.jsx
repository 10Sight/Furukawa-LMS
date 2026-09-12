import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from 'lucide-react';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import RevisionRecordList from '@/components/admin/revision/RevisionRecordList';
import RevisionHistoryList from '@/components/admin/revision/RevisionHistoryList';
import RevisionEditModal from '@/components/admin/revision/RevisionEditModal';
import RevisionHistoryModal from '@/components/admin/revision/RevisionHistoryModal';

// The 10-Cycle Check Sheet's revisions are tied to structural layout changes
// (questions, instruments, columns), so Edit/Add Override for this sheet deep-link
// into its dedicated Layout Editor tab (Cycle10.jsx) instead of the plain text modal.
const TEN_CYCLE_SHEET_KEY = 'ten-cycle-sheet';

// Per-sheet detail page: the global default plus every department/section
// override for this sheetKey, and the sheet's full audit log history.
const RevisionSheetHistory = () => {
    const { sheetKey } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [sheetName, setSheetName] = useState(location.state?.sheetName || "");

    const authUser = useSelector((state) => state.auth.user);
    const isAdmin = authUser?.isAdmin;
    const canCreate = isAdmin || authUser?.customRole?.permissions?.includes('revision:create');
    const canEdit = isAdmin || authUser?.customRole?.permissions?.includes('revision:update');

    const [records, setRecords] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [overrideTarget, setOverrideTarget] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [logsRecord, setLogsRecord] = useState(null);

    const fetchRecords = useCallback(async () => {
        setLoadingRecords(true);
        try {
            const res = await axiosInstance.get('/api/revision-records', { params: { sheetKey } });
            if (res.data?.success) {
                const data = res.data.data || [];
                setRecords(data);
                const globalRow = data.find((r) => !r.departmentId);
                if (!sheetName && (globalRow || data[0])) setSheetName((globalRow || data[0]).sheetName);
            }
        } catch (error) {
            console.error("Failed to load revision records", error);
            toast.error("Failed to load revision records");
        } finally {
            setLoadingRecords(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetKey]);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await axiosInstance.get('/api/revision-records/history', { params: { sheetKey } });
            if (res.data?.success) setLogs(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision history", error);
            toast.error("Failed to load revision history");
        } finally {
            setLoadingHistory(false);
        }
    }, [sheetKey]);

    useEffect(() => {
        fetchRecords();
        fetchHistory();
    }, [fetchRecords, fetchHistory]);

    const handleEdit = (record) => {
        if (sheetKey === TEN_CYCLE_SHEET_KEY) {
            const params = new URLSearchParams({ tab: 'editLayout' });
            if (record.departmentId) {
                params.set('departmentId', String(record.departmentId));
                if (record.sectionId) params.set('sectionId', String(record.sectionId));
            } else {
                params.set('global', '1');
            }
            navigate(`/admin/10-cycle?${params.toString()}`);
            return;
        }
        setEditingRecord(record);
        setOverrideTarget(null);
        setModalOpen(true);
    };

    const handleAddOverride = () => {
        if (sheetKey === TEN_CYCLE_SHEET_KEY) {
            navigate('/admin/10-cycle?tab=editLayout');
            return;
        }
        setEditingRecord(null);
        setOverrideTarget({ sheetKey, sheetName });
        setModalOpen(true);
    };

    const handleModalOpenChange = (open) => {
        setModalOpen(open);
        if (!open) {
            setEditingRecord(null);
            setOverrideTarget(null);
        }
    };

    const handleSave = async (form) => {
        setSaving(true);
        try {
            const res = editingRecord
                ? await axiosInstance.put(`/api/revision-records/${editingRecord.id}`, form)
                : await axiosInstance.put(`/api/revision-records/sheet/${overrideTarget.sheetKey}`, {
                    ...form,
                    sheetName: overrideTarget.sheetName,
                });

            if (res.data?.success) {
                toast.success("Revision record saved");
                handleModalOpenChange(false);
                await Promise.all([fetchRecords(), fetchHistory()]);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save revision record");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/revision-table')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle>{sheetName || sheetKey}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="active">
                        <TabsList>
                            <TabsTrigger value="active">Active Revisions & Overrides</TabsTrigger>
                            <TabsTrigger value="history">Audit Log History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active" className="mt-4 space-y-3">
                            {canCreate && (
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={handleAddOverride}>
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Department Override
                                    </Button>
                                </div>
                            )}
                            <RevisionRecordList
                                records={records}
                                loading={loadingRecords}
                                canEdit={canEdit}
                                onEdit={handleEdit}
                                onViewLogs={setLogsRecord}
                                linkToDetail={false}
                            />
                        </TabsContent>
                        <TabsContent value="history" className="mt-4">
                            <RevisionHistoryList logs={logs} loading={loadingHistory} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <RevisionEditModal
                record={editingRecord}
                overrideTarget={overrideTarget}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                onSave={handleSave}
                saving={saving}
            />

            <RevisionHistoryModal
                record={logsRecord}
                open={!!logsRecord}
                onOpenChange={(open) => !open && setLogsRecord(null)}
            />
        </div>
    );
};

export default RevisionSheetHistory;
