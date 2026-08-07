import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import RevisionRecordList from '@/components/admin/revision/RevisionRecordList';
import RevisionHistoryBySheet from '@/components/admin/revision/RevisionHistoryBySheet';
import RevisionHistoryModal from '@/components/admin/revision/RevisionHistoryModal';
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";

// Directory page: one row per sheet (the global default only — department/section
// overrides are managed on that sheet's detail page, reached by clicking a row).
// The "Sheets" tab requires revision:read; users holding only the legacy
// dept_revision_logs:read permission see just the department/section-filterable
// "Audit Log History" tab, matching the standalone page this replaced.
const RevisionTable = () => {
    const authUser = useSelector((state) => state.auth.user);
    const canViewSheets = !!authUser?.isAdmin || !!authUser?.customRole?.permissions?.includes('revision:read');

    const [records, setRecords] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentId, setDepartmentId] = useState('all');
    const [sectionId, setSectionId] = useState('all');
    const [logsRecord, setLogsRecord] = useState(null);

    const { data: deptData } = useGetAllDepartmentsQuery({ limit: 1000 });
    const departments = deptData?.data?.departments || [];

    const { data: sectionData } = useGetSectionsByDepartmentQuery(
        departmentId,
        { skip: departmentId === 'all' }
    );
    const sections = useMemo(() => (departmentId === 'all' ? [] : (sectionData?.data || [])), [departmentId, sectionData]);

    const fetchRecords = useCallback(async () => {
        if (!canViewSheets) return;
        setLoadingRecords(true);
        try {
            const res = await axiosInstance.get('/api/revision-records', { params: { isGlobal: true } });
            if (res.data?.success) setRecords(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision records", error);
            toast.error("Failed to load revision records");
        } finally {
            setLoadingRecords(false);
        }
    }, [canViewSheets]);

    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await axiosInstance.get('/api/revision-records/history', {
                params: {
                    departmentId: departmentId !== 'all' ? departmentId : undefined,
                    sectionId: sectionId !== 'all' ? sectionId : undefined,
                },
            });
            if (res.data?.success) setHistory(res.data.data || []);
        } catch (error) {
            console.error("Failed to load revision history", error);
            toast.error("Failed to load revision history");
        } finally {
            setLoadingHistory(false);
        }
    }, [departmentId, sectionId]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useEffect(() => {
        setSectionId('all');
    }, [departmentId]);

    const trimmedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = (item) =>
        !trimmedQuery ||
        (item.sheetName || "").toLowerCase().includes(trimmedQuery) ||
        (item.docNo || "").toLowerCase().includes(trimmedQuery);

    const filteredRecords = records.filter(matchesSearch);
    const filteredHistory = history.filter(matchesSearch);

    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Revision Table</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by sheet name or document no."
                            className="pl-8"
                        />
                    </div>

                    <Tabs defaultValue={canViewSheets ? "active" : "history"}>
                        <TabsList>
                            {canViewSheets && <TabsTrigger value="active">Sheets</TabsTrigger>}
                            <TabsTrigger value="history">Audit Log History</TabsTrigger>
                        </TabsList>
                        {canViewSheets && (
                            <TabsContent value="active" className="mt-4">
                                <RevisionRecordList
                                    records={filteredRecords}
                                    loading={loadingRecords}
                                    canEdit={false}
                                    onViewLogs={setLogsRecord}
                                    emptyMessage={trimmedQuery ? "No sheets match your search." : undefined}
                                />
                            </TabsContent>
                        )}
                        <TabsContent value="history" className="mt-4 space-y-3">
                            <div className="flex flex-wrap gap-3">
                                <Select value={departmentId} onValueChange={setDepartmentId}>
                                    <SelectTrigger className="w-[220px]">
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={sectionId} onValueChange={setSectionId} disabled={departmentId === 'all'}>
                                    <SelectTrigger className="w-[220px]">
                                        <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sections</SelectItem>
                                        {sections.map((section) => (
                                            <SelectItem key={section.id} value={String(section.id)}>{section.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <RevisionHistoryBySheet
                                logs={filteredHistory}
                                loading={loadingHistory}
                                emptyMessage={trimmedQuery ? "No history entries match your search." : undefined}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <RevisionHistoryModal
                record={logsRecord}
                open={!!logsRecord}
                onOpenChange={(open) => !open && setLogsRecord(null)}
            />
        </div>
    );
};

export default RevisionTable;
