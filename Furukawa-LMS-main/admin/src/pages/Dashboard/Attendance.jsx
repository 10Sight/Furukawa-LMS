import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCcw, Fingerprint, Upload, FileSpreadsheet, Loader2, Search } from 'lucide-react';
import axiosInstance from '../../Helper/axiosInstance';
import { toast } from 'sonner'; // Assuming sonner is used, or I'll use simple alert if not found. I'll check imports elsewhere if needed, but for now generic toast or alert.

// Fallback toast if sonner not available in project, but usually shadcn uses it.
// I'll assume standard alert if I can't find it, but `DashboardHome` didn't show toast usage.
// `Login.jsx` might have it. I'll just use a local helper or console for now, or check `main.jsx`.
// Actually, I'll stick to standard alert or simple console for errors to be safe, or check if `toast` is available in `components/ui`.

const Attendance = () => {
    const [activeTab, setActiveTab] = useState("employees");

    const [sections, setSections] = useState([]);
    const [lines, setLines] = useState([]);

    const [filters, setFilters] = useState({
        sectionId: "all",
        lineId: "all",
        date: new Date().toISOString().split('T')[0]
    });

    const [searchTerm, setSearchTerm] = useState("");

    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    const fileInputRef = useRef(null);

    // Fetch Filters
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const res = await axiosInstance.get('/api/attendance/filters');
                if (res.data.success) {
                    setSections(res.data.sections || []);
                    setLines(res.data.lines || []);
                }
            } catch (error) {
                console.error("Failed to fetch filters", error);
            }
        };
        fetchFilters();
    }, []);

    // Fetch Attendance Data
    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date: filters.date,
                sectionId: filters.sectionId,
                lineId: filters.lineId
            }).toString();

            const res = await axiosInstance.get(`/api/attendance?${queryParams}`);
            if (res.data.success) {
                setAttendanceData(res.data.data || []);
                setCurrentPage(1); // Reset to first page on new fetch
            } else {
                setAttendanceData([]);
            }
        } catch (error) {
            console.error("Failed to fetch attendance", error);
            setAttendanceData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttendance();
    }, [filters]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            const res = await axiosInstance.post('/api/attendance/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                alert(`Upload Successful: ${res.data.message || "File uploaded."}`);
                fetchAttendance();
                if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
                alert("Upload Failed: " + (res.data.message || "Unknown error"));
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload Failed: " + (error.response?.data?.message || "Unknown error"));
        } finally {
            setUploading(false);
        }
    };

    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "Present": return "bg-green-100 text-green-700 border-green-200";
            case "Late": return "bg-amber-100 text-amber-700 border-amber-200";
            case "Absent": return "bg-red-100 text-red-700 border-red-200";
            case "Half Day": return "bg-blue-100 text-blue-700 border-blue-200";
            case "Holiday": return "bg-purple-100 text-purple-700 border-purple-200";
            default: return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    // Filter lines based on selected section
    const filteredLines = filters.sectionId === 'all'
        ? lines
        : lines.filter(l => l.sectionId && l.sectionId.toString() === filters.sectionId.toString());

    // --- Search & Filter Logic ---
    const filteredData = attendanceData.filter(item => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            (item.name && item.name.toLowerCase().includes(searchLower)) ||
            (item.empId && item.empId.toString().toLowerCase().includes(searchLower)) ||
            (item.payCode && item.payCode.toString().toLowerCase().includes(searchLower)) ||
            (item.cardNo && item.cardNo.toString().toLowerCase().includes(searchLower))
        );
    });

    // --- Pagination Logic ---
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <div className="space-y-6 w-full max-w-full overflow-hidden">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900">Attendance</h1>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                        {filteredData.length} Records
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Group */}
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-200">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="h-8 w-[180px] pl-8 bg-transparent border-none text-slate-700 text-xs focus-visible:ring-0 shadow-none placeholder:text-slate-400"
                            />
                        </div>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <span className="text-xs text-slate-500 pl-2 uppercase font-bold tracking-wider">Filters:</span>

                        <Select value={filters.sectionId} onValueChange={(val) => handleFilterChange('sectionId', val)}>
                            <SelectTrigger className="w-[130px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 text-xs shadow-none">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {sections.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <Select value={filters.lineId} onValueChange={(val) => handleFilterChange('lineId', val)}>
                            <SelectTrigger className="w-[130px] h-8 bg-transparent border-none text-slate-700 focus:ring-0 text-xs shadow-none">
                                <SelectValue placeholder="All Lines" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Lines</SelectItem>
                                {filteredLines.map(l => (
                                    <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <div className="flex items-center gap-2 px-2">
                            <Input
                                type="date"
                                value={filters.date}
                                onChange={(e) => handleFilterChange('date', e.target.value)}
                                className="h-8 w-auto bg-transparent border-none text-slate-700 text-[10px] p-0 focus-visible:ring-0 shadow-none"
                            />
                        </div>

                        <div className="h-4 w-[1px] bg-slate-300"></div>

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={fetchAttendance}>
                            <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    {/* Upload Button */}
                    <div className="flex items-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 shadow-sm"
                            onClick={triggerFileUpload}
                            disabled={uploading}
                        >
                            {uploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 mr-2" />}
                            {uploading ? "Uploading..." : "Upload Excel"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content - Full Width Table */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-0">
                    {/* Table Toolbar / Pagination Header */}
                    <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-slate-100 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Rows per page:</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[70px] h-8 text-xs">
                                        <SelectValue placeholder="25" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <span className="text-xs text-slate-500">
                                Showing <span className="font-semibold text-slate-700">{filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-semibold text-slate-700">{filteredData.length}</span>
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <span className="sr-only">Previous</span>
                                ‹
                            </Button>
                            <div className="flex items-center gap-1 mx-2">
                                <span className="text-xs text-slate-600">
                                    Page <span className="font-semibold text-slate-900">{currentPage}</span> of <span className="font-semibold text-slate-900">{totalPages || 1}</span>
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                <span className="sr-only">Next</span>
                                ›
                            </Button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="relative w-full overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="text-xs text-slate-500 uppercase font-semibold">
                                    <th className="py-3 pl-6 pr-3 font-medium whitespace-nowrap w-[60px]">Sr.No</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[100px]">Emp ID</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[180px]">Name</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[140px]">Department</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[140px]">Designation</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">PayCode</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Card No</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Shift</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Start</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">In</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Out</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Hrs</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Status</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Late</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">Early</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap">OT Hrs</th>
                                    <th className="py-3 pl-3 pr-6 font-medium whitespace-nowrap text-right">OT Amt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedData.length > 0 ? (
                                    paginatedData.map((log, idx) => (
                                        <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="py-3 pl-6 pr-3 text-slate-500 text-xs w-[60px]">
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </td>
                                            <td className="py-3 pl-3 pr-3">
                                                <span className="font-mono text-xs text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {log.empId}
                                                </span>
                                            </td>
                                            <td className="py-3 pl-3 pr-3">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 text-sm">{log.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 pl-3 pr-3 w-[150px] text-slate-600 text-xs sticky left-[370px] bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)] border-r border-slate-200 truncate" title={log.department || log.section}>
                                                {log.department || log.section || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs truncate" title={log.designation}>
                                                {log.designation || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-center border-l border-slate-50">
                                                <span className="text-slate-500 text-xs font-mono bg-slate-50 px-1 rounded">{log.payCode || '-'}</span>
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-500 text-xs font-mono">{log.cardNo || '-'}</td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs text-center border-l border-slate-50">{log.shift || '-'}</td>
                                            <td className="py-3 pl-3 pr-3 text-slate-500 text-xs font-mono text-center">{log.startTime || '-'}</td>

                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center bg-slate-50/30">
                                                {log.inTime ? <span className="text-green-700 font-bold">{log.inTime}</span> : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center bg-slate-50/30">
                                                {log.outTime ? <span className="text-red-700 font-bold">{log.outTime}</span> : <span className="text-slate-300">-</span>}
                                            </td>

                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center font-semibold text-slate-700">
                                                {log.hrsWorked ? Number(log.hrsWorked).toFixed(2) : <span className="text-slate-300">-</span>}
                                            </td>

                                            <td className="py-3 pl-3 pr-3 text-center">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(log.status || 'ABSENT')}`}>
                                                    {log.status || 'ABSENT'}
                                                </span>
                                            </td>

                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center text-orange-600">
                                                {Number(log.lateArrival) > 0 ? Number(log.lateArrival).toFixed(2) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center text-orange-600">
                                                {Number(log.earlyDeparture) > 0 ? Number(log.earlyDeparture).toFixed(2) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center text-purple-700">
                                                {Number(log.otHrs) > 0 ? Number(log.otHrs).toFixed(2) : <span className="text-slate-300">-</span>}
                                            </td>
                                            <td className="py-3 pl-3 pr-6 text-xs font-mono text-right font-medium text-teal-700">
                                                {Number(log.otAmount) > 0 ? `₹${Number(log.otAmount).toFixed(0)}` : <span className="text-slate-300">-</span>}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="17" className="py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <FileSpreadsheet className="h-12 w-12 mb-3 text-slate-200" />
                                                <p className="text-sm font-medium text-slate-500">No attendance records found</p>
                                                <p className="text-xs">Try adjusting filters or changing the date</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer Pagination (Optional, repeated for easy access) */}
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                        <div className="text-xs text-slate-400">
                            Total {filteredData.length} records found
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                ‹
                            </Button>
                            <div className="px-2 text-xs font-medium text-slate-600">
                                {currentPage} / {totalPages || 1}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                ›
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Attendance;
