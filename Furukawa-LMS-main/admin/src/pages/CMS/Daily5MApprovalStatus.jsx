import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle,
    CardDescription 
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    IconCheck, 
    IconX, 
    IconRefresh, 
    IconCalendar,
    IconBuildingFactory2,
    IconUser,
    IconCircleCheckFilled,
    IconCircleXFilled,
    IconClockHour4,
    IconClipboardList
} from "@tabler/icons-react";
import { format } from 'date-fns';
import { Loader2 } from "lucide-react";

const Daily5MApprovalStatus = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingAction, setProcessingAction] = useState(null);

    const approveId = searchParams.get('approve');
    const declineId = searchParams.get('decline');

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/api/daily-5m/approvals/status');
            if (response.data.success) {
                setRecords(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching approval status:", error);
            toast.error("Failed to load approval status");
        } finally {
            setLoading(false);
        }
    }, []);

    const handleAction = async (id, action) => {
        setProcessingAction(id);
        try {
            const response = await axiosInstance.post(`/api/daily-5m/record/${id}/${action}`);
            if (response.data.success) {
                toast.success(`Record ${action}d successfully`);
                fetchStatus();
                // Clear URL params if it was an automatic action
                if (approveId === id || declineId === id) {
                    setSearchParams({});
                }
            }
        } catch (error) {
            toast.error(`Failed to ${action} record`);
        } finally {
            setProcessingAction(null);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Handle automatic action from URL
    useEffect(() => {
        if (approveId) {
            handleAction(approveId, 'approve');
        } else if (declineId) {
            handleAction(declineId, 'decline');
        }
    }, [approveId, declineId]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED':
                return <Badge className="bg-green-500 hover:bg-green-600"><IconCircleCheckFilled size={14} className="mr-1" /> Approved</Badge>;
            case 'DECLINED':
                return <Badge variant="destructive"><IconCircleXFilled size={14} className="mr-1" /> Declined</Badge>;
            default:
                return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-200"><IconClockHour4 size={14} className="mr-1" /> Pending</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">5M Recording Approval Status</h1>
                    <p className="text-slate-500">Monitor and manage approvals for daily 5M record sheets</p>
                </div>
                <Button variant="outline" onClick={fetchStatus} disabled={loading} className="gap-2">
                    <IconRefresh size={18} className={loading ? "animate-spin" : ""} />
                    Refresh
                </Button>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-white border-b border-slate-100">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <IconClipboardList className="text-blue-500" />
                        Status Overview
                    </CardTitle>
                    <CardDescription>Real-time tracking of submission statuses</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="h-10 w-10 animate-spin mb-4" />
                            <p>Loading records...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <IconClipboardList size={48} className="mb-4 opacity-20" />
                            <p>No 5M records found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold">Submission Info</TableHead>
                                    <TableHead className="font-bold">Department / Line</TableHead>
                                    <TableHead className="font-bold">Details</TableHead>
                                    <TableHead className="font-bold text-center">Status</TableHead>
                                    <TableHead className="font-bold">Action Taken By</TableHead>
                                    <TableHead className="font-bold text-right">Quick Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((record) => (
                                    <TableRow key={record.id} className="hover:bg-slate-50/50">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium flex items-center gap-2">
                                                    <IconCalendar size={14} className="text-slate-400" />
                                                    {format(new Date(record.date), 'dd MMM yyyy')}
                                                </span>
                                                <span className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                                    <IconUser size={12} />
                                                    Submitted by: {record.submittedByName}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium flex items-center gap-2">
                                                    <IconBuildingFactory2 size={14} className="text-slate-400" />
                                                    {record.departmentName}
                                                </span>
                                                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 rounded mt-1 w-fit">
                                                    {record.line || 'N/A'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs space-y-1">
                                                <p><span className="text-slate-400">Shift:</span> {record.shift}</p>
                                                <p><span className="text-slate-400">Created:</span> {format(new Date(record.createdAt), 'HH:mm')}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {getStatusBadge(record.status)}
                                        </TableCell>
                                        <TableCell>
                                            {record.approvedByName ? (
                                                <div className="flex items-center gap-2">
                                                    <IconUser size={14} className="text-slate-400" />
                                                    <span className="text-sm">{record.approvedByName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">No action taken yet</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {record.status === 'PENDING' ? (
                                                <div className="flex justify-end gap-2 text-right items-center">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleAction(record.id, 'approve')}
                                                        disabled={!!processingAction}
                                                    >
                                                        {processingAction === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconCheck size={18} />}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleAction(record.id, 'decline')}
                                                        disabled={!!processingAction}
                                                    >
                                                        {processingAction === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconX size={18} />}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/cms/daily-5m-recording?id=${record.id}`)}>
                                                    View Form
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default Daily5MApprovalStatus;
