import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import RevisionRecordList from '@/components/admin/revision/RevisionRecordList';
import RevisionHistoryList from '@/components/admin/revision/RevisionHistoryList';
import RevisionEditModal from '@/components/admin/revision/RevisionEditModal';

const RevisionTable = () => {
    const [selectedDepartment, setSelectedDepartment] = useState("all");
    const [selectedSection, setSelectedSection] = useState("all");

    const { data: deptData } = useGetAllDepartmentsQuery({ limit: 100 });
    const departments = deptData?.data?.departments || [];

    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        selectedDepartment,
        { skip: !selectedDepartment || selectedDepartment === 'all' }
    );
    const sections = sectionData?.data || [];

    const [records, setRecords] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [overrideTarget, setOverrideTarget] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const filterParams = {
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        sectionId: selectedSection !== 'all' ? selectedSection : undefined,
    };

    const fetchRecords = useCallback(async () => {
        setLoadingRecords(true);
        try {
            const res = await axiosInstance.get('/api/revision-records', { params: filterParams });
            if (res.data?.success) setRecords(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision records", error);
            toast.error("Failed to load revision records");
        } finally {
            setLoadingRecords(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDepartment, selectedSection]);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await axiosInstance.get('/api/revision-records/history', { params: filterParams });
            if (res.data?.success) setHistory(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision history", error);
            toast.error("Failed to load revision history");
        } finally {
            setLoadingHistory(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDepartment, selectedSection]);

    useEffect(() => {
        fetchRecords();
        fetchHistory();
    }, [fetchRecords, fetchHistory]);

    const handleEdit = (record) => {
        setEditingRecord(record);
        setOverrideTarget(null);
        setModalOpen(true);
    };

    const handleAddOverride = (record) => {
        setEditingRecord(null);
        setOverrideTarget({ sheetKey: record.sheetKey, sheetName: record.sheetName });
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
                <CardHeader>
                    <CardTitle>Revision Table</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Department</Label>
                            <Select
                                value={selectedDepartment}
                                onValueChange={(val) => {
                                    setSelectedDepartment(val);
                                    setSelectedSection("all");
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id || dept._id} value={String(dept.id || dept._id)}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Section</Label>
                            <Select
                                value={selectedSection}
                                onValueChange={setSelectedSection}
                                disabled={!selectedDepartment || selectedDepartment === 'all'}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {sections.map((sec) => (
                                        <SelectItem key={sec.id || sec._id} value={String(sec.id || sec._id)}>
                                            {sec.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

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
                                onAddOverride={handleAddOverride}
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
                overrideTarget={overrideTarget}
                open={modalOpen}
                onOpenChange={handleModalOpenChange}
                onSave={handleSave}
                saving={saving}
            />
        </div>
    );
};

export default RevisionTable;
