import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import axiosInstance from '@/Helper/axiosInstance';
import { format } from "date-fns";
import { Loader2, Eye, Trash2, Plus, History } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const Daily5MDashboard = () => {
    const navigate = useNavigate();
    const { data: departmentsData } = useGetAllDepartmentsQuery();

    // State
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedFormType, setSelectedFormType] = useState("standard"); // 'standard' or 'crimping'
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [globalHistory, setGlobalHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch records when department changes
    useEffect(() => {
        if (selectedDepartment) {
            fetchRecords();
        } else {
            setRecords([]);
        }
    }, [selectedDepartment, selectedFormType]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/api/daily-5m/records/${selectedDepartment}?formType=${selectedFormType}`);
            if (response.data.success) {
                setRecords(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching records:", error);
            toast.error("Failed to fetch records");
        } finally {
            setLoading(false);
        }
    };

    const fetchGlobalHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await axiosInstance.get('/api/daily-5m/history/all');
            if (response.data.success) {
                setGlobalHistory(response.data.data);
                setIsHistoryOpen(true);
            }
        } catch (error) {
            console.error("Error fetching global history:", error);
            toast.error("Failed to load layout change history");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this record?")) return;
        try {
            await axiosInstance.delete(`/api/daily-5m/record/${id}`);
            toast.success("Record deleted");
            fetchRecords();
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete record");
        }
    };

    const handleView = (record) => {
        // Navigate to the recording page with the record state
        // We can pass state or use a URL param. URL param is better for sharing.
        // Assuming route is /cms/daily-5m-recording
        navigate("/cms/daily-5m-recording", {
            state: {
                recordId: record.id,
                recordData: record,
                // Pass date explicitly to pre-populate the Date Picker in the target component
                date: record.date ? new Date(record.date).toISOString().split('T')[0] : null
            }
        });
    };

    return (
        <div className="space-y-6 w-full max-w-[95vw] mx-auto pb-10">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">5M Daily Records Dashboard</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchGlobalHistory}>
                        <History className="w-4 h-4 mr-2" />
                        Layout Change History
                    </Button>
                    <Button onClick={() => navigate("/cms/daily-5m-recording")}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Record
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filter Records</CardTitle>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="w-[300px]">
                            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departmentsData?.data?.departments?.map((dept) => (
                                        <SelectItem key={dept._id || dept.id} value={dept._id || dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-lg border">
                            <button
                                onClick={() => setSelectedFormType('standard')}
                                className={cn(
                                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                    selectedFormType === 'standard' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Assembly Forms
                            </button>
                            <button
                                onClick={() => setSelectedFormType('crimping')}
                                className={cn(
                                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                    selectedFormType === 'crimping' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                Crimping Forms
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedDepartment ? (
                        <div className="text-center py-10 text-gray-500">Please select a department to view records.</div>
                    ) : loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8" /></div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">No records found for this department.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Shift</TableHead>
                                    <TableHead>Line</TableHead>
                                    <TableHead>Submitted By</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell>{format(new Date(record.date), "PPP")}</TableCell>
                                        <TableCell>{record.shift || "-"}</TableCell>
                                        <TableCell>{record.line || "-"}</TableCell>
                                        <TableCell>{record.submittedByName || "User"}</TableCell>
                                        <TableCell className="text-xs text-gray-400">
                                            {format(new Date(record.createdAt), "PP p")}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleView(record)}>
                                                <Eye className="w-4 h-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(record.id)}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Global History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-[800px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Recent Layout Changes Across All Departments</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {loadingHistory ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8 text-gray-400" /></div>
                        ) : globalHistory.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">No layout history found.</div>
                        ) : (
                            globalHistory.map((entry, idx) => {
                                // Find department name from fetched departments list
                                const deptName = departmentsData?.data?.departments?.find(
                                    d => String(d._id || d.id) === String(entry.departmentId)
                                )?.name || "Unknown Department";

                                return (
                                    <div key={idx} className="border p-4 rounded-lg bg-slate-50 space-y-2">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="font-bold text-lg">{deptName}</span>
                                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                                {format(new Date(entry.createdAt), "PP p")}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm pt-1">
                                            <span className="text-gray-700 font-medium">Changed By: {entry.updatedBy || "System"}</span>
                                        </div>
                                        <div className="text-sm bg-white p-3 border-l-4 border-blue-500 rounded shadow-sm">
                                            <span className="font-semibold text-xs text-blue-600 uppercase block mb-1">Remark:</span>
                                            {entry.remark}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default Daily5MDashboard;
