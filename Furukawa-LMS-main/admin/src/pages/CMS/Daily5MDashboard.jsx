import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
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
import { Loader2, Eye, Trash2, Plus, History, Search, Calendar as CalendarIcon, Filter } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
    const [selectedSection, setSelectedSection] = useState("all");
    const [selectedFormType, setSelectedFormType] = useState("standard");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [globalHistory, setGlobalHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Fetch sections if department is selected
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(selectedDepartment, { 
        skip: !selectedDepartment || selectedDepartment === 'all' 
    });
    const sections = sectionsData?.data || [];

    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    // Filter departments based on user assignment
    const assignableDepartments = React.useMemo(() => {
        const allDepts = departmentsData?.data?.departments || [];
        
        // Handle both multiple assigned departments AND the primary departmentId
        const assignedIds = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) assignedIds.push(authUser.departmentId);
        
        if (!authUser || assignedIds.length === 0) {
            return allDepts;
        }
        
        // User has specific department assignments
        return allDepts.filter(dept =>
            assignedIds.includes(dept.id) ||
            assignedIds.includes(dept._id) ||
            assignedIds.includes(String(dept.id)) ||
            assignedIds.includes(String(dept._id)) ||
            assignedIds.includes(Number(dept.id)) ||
            assignedIds.includes(Number(dept._id))
        );
    }, [departmentsData, authUser]);

    const isRestricted = authUser && (
        (authUser.departments && authUser.departments.length > 0) || 
        authUser.departmentId
    );

    // Auto-select department if ONLY one is available for restricted users
    useEffect(() => {
        if (isRestricted && assignableDepartments.length === 1 && !selectedDepartment) {
            setSelectedDepartment(assignableDepartments[0]._id || assignableDepartments[0].id);
        }
    }, [isRestricted, assignableDepartments, selectedDepartment]);

    // Fetch records when filters change
    useEffect(() => {
        if (selectedDepartment) {
            fetchRecords();
        } else {
            setRecords([]);
        }
    }, [selectedDepartment, selectedSection, selectedFormType, startDate, endDate]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedDepartment) fetchRecords();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const deptId = selectedDepartment === 'all' ? 'all' : selectedDepartment;
            
            let query = `/api/daily-5m/records/${deptId}?formType=${selectedFormType}`;
            if (selectedSection && selectedSection !== 'all') query += `&sectionId=${selectedSection}`;
            if (startDate) query += `&startDate=${startDate}`;
            if (endDate) query += `&endDate=${endDate}`;
            if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;

            const response = await axiosInstance.get(query);
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
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle>Filter Records</CardTitle>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Department</Label>
                            <Select value={selectedDepartment} onValueChange={(val) => { setSelectedDepartment(val); setSelectedSection("all"); }} disabled={isRestricted && assignableDepartments.length === 1}>
                                <SelectTrigger className={isRestricted && assignableDepartments.length === 1 ? "bg-slate-50 cursor-not-allowed" : ""}>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {isAdmin && <SelectItem value="all">All Departments</SelectItem>}
                                    {assignableDepartments.map((dept) => (
                                        <SelectItem key={dept._id || dept.id} value={dept._id || dept.id}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Section</Label>
                            <Select value={selectedSection} onValueChange={setSelectedSection} disabled={selectedDepartment === 'all' || !selectedDepartment}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Sections</SelectItem>
                                    {sections.map((sec) => (
                                        <SelectItem key={sec.id} value={sec.id}>
                                            {sec.name} {sec.category && `(${sec.category})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-10 px-3",
                                            (!startDate && !endDate) && "text-slate-400"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? (
                                            endDate ? (
                                                <>
                                                    {format(new Date(startDate), "dd/MM/yy")} - {format(new Date(endDate), "dd/MM/yy")}
                                                </>
                                            ) : (
                                                format(new Date(startDate), "dd/MM/yy")
                                            )
                                        ) : (
                                            <span>Pick a date range</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={startDate ? new Date(startDate) : undefined}
                                        selected={{
                                            from: startDate ? new Date(startDate) : undefined,
                                            to: endDate ? new Date(endDate) : undefined,
                                        }}
                                        onSelect={(range) => {
                                            setStartDate(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                                            setEndDate(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                                        }}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input 
                                    placeholder="Search Line, ID, or Name..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-10"
                                />
                            </div>
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
                                <TableRow className="bg-slate-50 hover:bg-slate-50 font-semibold">
                                    <TableHead className="w-[80px]">ID</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Section</TableHead>
                                    <TableHead>Line</TableHead>
                                    <TableHead>Submitted By</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.map((record) => (
                                    <TableRow key={record.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="font-mono text-xs text-blue-600 font-bold">#{record.id}</TableCell>
                                        <TableCell className="whitespace-nowrap">{format(new Date(record.date), "PPP")}</TableCell>
                                        <TableCell>
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">
                                                {record.departmentName || "Dept"}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-slate-600 font-medium">
                                                {record.sectionName || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-900">{record.line || "-"}</TableCell>
                                        <TableCell>{record.submittedByName || "User"}</TableCell>
                                        <TableCell className="text-[10px] text-gray-400">
                                            {format(new Date(record.createdAt), "PP p")}
                                        </TableCell>
                                        <TableCell className="text-right space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
