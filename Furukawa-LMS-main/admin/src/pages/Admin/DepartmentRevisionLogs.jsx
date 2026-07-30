import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import RevisionHistoryTable from '@/components/admin/revision/RevisionHistoryTable';

// Department-scoped view of the revision audit log — same data as the
// Revision Table's history tab, narrowed to one department/section so it can
// be assigned as a standalone page to roles that shouldn't see every sheet.
const DepartmentRevisionLogs = () => {
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [departmentId, setDepartmentId] = useState('all');
    const [sectionId, setSectionId] = useState('all');
    const [searchQuery, setSearchQuery] = useState("");

    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await axiosInstance.get('/api/departments', { params: { limit: 1000 } });
                if (res.data?.success) setDepartments(res.data.data?.departments || []);
            } catch (error) {
                console.error("Failed to load departments", error);
                toast.error("Failed to load departments");
            }
        };
        fetchDepartments();
    }, []);

    useEffect(() => {
        if (departmentId === 'all') {
            setSections([]);
            setSectionId('all');
            return;
        }
        setSectionId('all');
        const fetchSections = async () => {
            try {
                const res = await axiosInstance.get(`/api/sections/department/${departmentId}`);
                if (res.data?.success) setSections(res.data.data?.sections || res.data.data || []);
            } catch (error) {
                console.error("Failed to load sections", error);
                toast.error("Failed to load sections");
            }
        };
        fetchSections();
    }, [departmentId]);

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
        fetchHistory();
    }, [fetchHistory]);

    const trimmedQuery = searchQuery.trim().toLowerCase();
    const filteredHistory = history.filter((item) =>
        !trimmedQuery ||
        (item.sheetName || "").toLowerCase().includes(trimmedQuery) ||
        (item.docNo || "").toLowerCase().includes(trimmedQuery)
    );

    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Department Revision Logs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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

                        <div className="relative max-w-sm flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by sheet name or document no."
                                className="pl-8"
                            />
                        </div>
                    </div>

                    {loadingHistory ? (
                        <div className="py-10 text-center text-muted-foreground">Loading history...</div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground">
                            {trimmedQuery ? "No history entries match your search." : "No revision history yet."}
                        </div>
                    ) : (
                        <RevisionHistoryTable logs={filteredHistory} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DepartmentRevisionLogs;
