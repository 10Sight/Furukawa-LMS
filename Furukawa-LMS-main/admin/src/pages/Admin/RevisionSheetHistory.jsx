import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import RevisionHistoryList from '@/components/admin/revision/RevisionHistoryList';

const RevisionSheetHistory = () => {
    const { sheetKey } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [sheetName, setSheetName] = useState(location.state?.sheetName || "");
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/api/revision-records/history', { params: { sheetKey } });
            if (res.data?.success) {
                const data = res.data.data || [];
                setLogs(data);
                if (!sheetName && data.length > 0) setSheetName(data[0].sheetName);
            }
        } catch (error) {
            console.error("Failed to load revision history", error);
            toast.error("Failed to load revision history");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetKey]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return (
        <div className="p-4 md:p-6 space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/revision-table')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle>{sheetName || sheetKey} — Revision History</CardTitle>
                </CardHeader>
                <CardContent>
                    <RevisionHistoryList logs={logs} loading={loading} />
                </CardContent>
            </Card>
        </div>
    );
};

export default RevisionSheetHistory;
