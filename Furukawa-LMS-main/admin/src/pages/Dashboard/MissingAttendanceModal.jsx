import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, RefreshCcw, UserX } from 'lucide-react';
import axiosInstance from '../../Helper/axiosInstance';

const MissingAttendanceModal = ({ open, onOpenChange, initialDate, departments, sections, lines }) => {
    const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [departmentId, setDepartmentId] = useState("all");
    const [sectionId, setSectionId] = useState("all");
    const [lineId, setLineId] = useState("all");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    // Reset filters and sync date when modal opens
    useEffect(() => {
        if (open) {
            setDate(initialDate || new Date().toISOString().split('T')[0]);
            setDepartmentId("all");
            setSectionId("all");
            setLineId("all");
            setSearch("");
            setCurrentPage(1);
        }
    }, [open, initialDate]);

    // Fetch Missing Attendance Data
    const fetchMissingAttendance = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date,
                departmentId,
                sectionId,
                lineId,
                search,
                page: currentPage,
                limit
            }).toString();

            const res = await axiosInstance.get(`/api/attendance/missing?${queryParams}`);
            if (res.data.success) {
                setData(res.data.data || []);
                setTotalCount(res.data.pagination?.totalCount || 0);
                setTotalPages(res.data.pagination?.totalPages || 1);
            } else {
                setData([]);
                setTotalCount(0);
                setTotalPages(1);
            }
        } catch (error) {
            console.error("Failed to fetch missing attendance", error);
            setData([]);
            setTotalCount(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    };

    // Debounced query execution on filter/search/date/page change
    useEffect(() => {
        if (!open) return;

        const handler = setTimeout(() => {
            fetchMissingAttendance();
        }, 300);

        return () => clearTimeout(handler);
    }, [open, date, departmentId, sectionId, lineId, search, currentPage]);

    // --- Cascading Select Logic ---
    const filteredSections = departmentId === 'all'
        ? sections
        : sections.filter(s => s.departmentId && s.departmentId.toString() === departmentId.toString());

    const filteredLines = sectionId === 'all'
        ? lines.filter(l => {
            if (departmentId === 'all') return true;
            const sectionOfLine = sections.find(s => s.id === l.sectionId);
            return sectionOfLine && sectionOfLine.departmentId?.toString() === departmentId.toString();
        })
        : lines.filter(l => l.sectionId && l.sectionId.toString() === sectionId.toString());

    const handleDepartmentChange = (val) => {
        setDepartmentId(val);
        setSectionId("all");
        setLineId("all");
        setCurrentPage(1);
    };

    const handleSectionChange = (val) => {
        setSectionId(val);
        setLineId("all");
        setCurrentPage(1);
    };

    const handleLineChange = (val) => {
        setLineId(val);
        setCurrentPage(1);
    };

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-full p-6 bg-slate-50">
                <DialogHeader className="flex flex-row justify-between items-center border-b border-slate-200 pb-4 mb-4">
                    <div>
                        <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-red-50 text-red-500">
                                <UserX className="h-5 w-5" />
                            </span>
                            Missing Attendance
                        </DialogTitle>
                        <p className="text-xs text-slate-500 mt-1">
                            List of active employees whose attendance logs are not uploaded for the selected date.
                        </p>
                    </div>
                </DialogHeader>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                    {/* Date Picker */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Date</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => { setDate(e.target.value); setCurrentPage(1); }}
                            className="h-9 w-full sm:w-[150px] text-xs text-slate-700 bg-slate-50 border-slate-200 focus:bg-white"
                        />
                    </div>

                    <div className="hidden sm:block h-8 w-[1px] bg-slate-200"></div>

                    {/* Department Select */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Department</label>
                        <Select value={departmentId} onValueChange={handleDepartmentChange}>
                            <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs bg-slate-50 border-slate-200 text-slate-700">
                                <SelectValue placeholder="All Depts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Depts</SelectItem>
                                {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Section Select */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Section</label>
                        <Select value={sectionId} onValueChange={handleSectionChange}>
                            <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs bg-slate-50 border-slate-200 text-slate-700">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {filteredSections.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Line Select */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Line</label>
                        <Select value={lineId} onValueChange={handleLineChange}>
                            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs bg-slate-50 border-slate-200 text-slate-700">
                                <SelectValue placeholder="All Lines" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Lines</SelectItem>
                                {filteredLines.map(l => (
                                    <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="hidden sm:block h-8 w-[1px] bg-slate-200"></div>

                    {/* Search Input */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Search by name, paycode, card no..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 w-full pl-9 text-xs text-slate-700 bg-slate-50 border-slate-200 focus:bg-white placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 self-end">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-9 w-9 border-slate-200 text-slate-400 hover:text-blue-600"
                            onClick={fetchMissingAttendance}
                            disabled={loading}
                        >
                            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative min-h-[300px] flex flex-col justify-between">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
                                <tr>
                                    <th className="py-3 pl-6 pr-3 font-medium whitespace-nowrap w-[60px]">Sr.No</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[100px]">Emp ID / PayCode</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[120px]">Card No</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[180px]">Employee Name</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[130px]">Department</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[120px]">Section</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[120px]">Line</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[130px]">Designation</th>
                                    <th className="py-3 pl-3 pr-6 font-medium whitespace-nowrap w-[80px] text-center">Shift</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 relative">
                                {loading ? (
                                    <tr>
                                        <td colSpan="9" className="py-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <span className="text-xs">Fetching missing attendance data...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((emp, index) => (
                                        <tr key={emp.id || index} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 pl-6 pr-3 text-slate-400 text-xs w-[60px]">
                                                {(currentPage - 1) * limit + index + 1}
                                            </td>
                                            <td className="py-3 pl-3 pr-3">
                                                <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                                    {emp.empId || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-500 font-mono text-xs">
                                                {emp.cardNo || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 font-medium text-slate-800 text-xs">
                                                {emp.fullName}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs">
                                                {emp.department || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs">
                                                {emp.section || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs">
                                                {emp.line || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-500 text-xs">
                                                {emp.designation || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-6 text-slate-600 text-xs text-center w-[80px]">
                                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-semibold">
                                                    {emp.shift || '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <div className="p-3 bg-green-50 text-green-500 rounded-full mb-3">
                                                    <RefreshCcw className="h-6 w-6" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700">All employees have attendance uploaded for this date.</p>
                                                <p className="text-xs text-slate-400 mt-1">Try selecting another date or checking filters.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {data.length > 0 && (
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="text-xs text-slate-400">
                                Total <span className="font-semibold text-slate-600">{totalCount}</span> missing employee{totalCount !== 1 ? 's' : ''} found
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs px-2.5"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1 || loading}
                                >
                                    Previous
                                </Button>
                                <div className="px-3 text-xs font-semibold text-slate-600">
                                    Page {currentPage} of {totalPages || 1}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs px-2.5"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages || totalPages === 0 || loading}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-5 border-t border-slate-200 pt-4">
                    <Button
                        variant="outline"
                        className="text-xs h-9"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MissingAttendanceModal;
