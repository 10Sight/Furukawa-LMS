import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from 'lucide-react';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import RevisionRecordList from '@/components/admin/revision/RevisionRecordList';
import RevisionHistoryBySheet from '@/components/admin/revision/RevisionHistoryBySheet';

// Directory page: one row per sheet (the global default only — department/section
// overrides are managed on that sheet's detail page, reached by clicking a row).
const RevisionTable = () => {
    const [records, setRecords] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchRecords = useCallback(async () => {
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

                    <Tabs defaultValue="active">
                        <TabsList>
                            <TabsTrigger value="active">Sheets</TabsTrigger>
                            <TabsTrigger value="history">Audit Log History</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active" className="mt-4">
                            <RevisionRecordList
                                records={filteredRecords}
                                loading={loadingRecords}
                                canEdit={false}
                                emptyMessage={trimmedQuery ? "No sheets match your search." : undefined}
                            />
                        </TabsContent>
                        <TabsContent value="history" className="mt-4">
                            <RevisionHistoryBySheet
                                logs={filteredHistory}
                                loading={loadingHistory}
                                emptyMessage={trimmedQuery ? "No history entries match your search." : undefined}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

export default RevisionTable;
