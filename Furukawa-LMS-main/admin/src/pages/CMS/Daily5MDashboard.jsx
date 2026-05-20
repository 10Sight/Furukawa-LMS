import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Loader2, Eye, Trash2, Plus, History, Search, Calendar as CalendarIcon, Filter, ChevronLeft, ChevronRight } from "lucide-react";
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
import { IconChartBar, IconChartPie, IconCheck } from "@tabler/icons-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell,
    LabelList,
} from 'recharts';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import highcharts3d from 'highcharts/highcharts-3d';

// Initialize 3D module
if (typeof highcharts3d === 'function' && !Highcharts.Chart.prototype.addSeriesAsChild) {
    highcharts3d(Highcharts);
}

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#8b5cf6', '#ec4899', '#3b82f6'];

// Custom scrollbar styles for premium look
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    height: 6px;
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
`;

const Daily5MDashboard = () => {
    const navigate = useNavigate();
    const { data: departmentsData } = useGetAllDepartmentsQuery();
    // State
    const [selectedDepartment, setSelectedDepartment] = useState("all");
    const [selectedSection, setSelectedSection] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [chartStartDate, setChartStartDate] = useState("");
    const [chartEndDate, setChartEndDate] = useState("");
    const [chartViewType, setChartViewType] = useState('daily');
    const [searchTerm, setSearchTerm] = useState("");
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [globalHistory, setGlobalHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [chartData, setChartData] = useState([]);
    const [loadingChart, setLoadingChart] = useState(false);
    const [rowStats, setRowStats] = useState(null);
    const [loadingRowStats, setLoadingRowStats] = useState(false);
    const [selectedChartDepts, setSelectedChartDepts] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const chartScrollRef = useRef(null);

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

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDepartment, selectedSection, startDate, endDate, searchTerm]);

    // Auto-select department if ONLY one is available for restricted users
    useEffect(() => {
        if (isRestricted && assignableDepartments.length === 1 && (!selectedDepartment || selectedDepartment === 'all')) {
            setSelectedDepartment(assignableDepartments[0]._id || assignableDepartments[0].id);
        }
    }, [isRestricted, assignableDepartments, selectedDepartment]);

    // Fetch records when filters change
    useEffect(() => {
        if (selectedDepartment) {
            fetchRecords();
            fetchChartData();
        } else {
            setRecords([]);
            setChartData([]);
        }
    }, [selectedDepartment, selectedSection, startDate, endDate, currentPage, pageSize]);

    // Fetch Row Stats (Pie Charts) - Independent triggers
    useEffect(() => {
        if (selectedDepartment) {
            fetchRowStats();
        } else {
            setRowStats(null);
        }
    }, [selectedDepartment, selectedSection, chartStartDate, chartEndDate, selectedChartDepts, chartViewType]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedDepartment) fetchRecords();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Auto-scroll chart to the end (current date)
    useEffect(() => {
        if (chartScrollRef.current && chartData.length > 0) {
            chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
        }
    }, [chartData]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const deptId = selectedDepartment === 'all' ? 'all' : selectedDepartment;

            let query = `/api/daily-5m/records/${deptId}?limit=${pageSize}&offset=${(currentPage - 1) * pageSize}&t=${Date.now()}`;
            if (selectedSection && selectedSection !== 'all') query += `&sectionId=${selectedSection}`;
            if (startDate) query += `&startDate=${startDate}`;
            if (endDate) query += `&endDate=${endDate}`;
            if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`;

            const response = await axiosInstance.get(query);
            if (response.data.success) {
                setRecords(response.data.data);
                if (response.data.pagination) {
                    setTotalPages(response.data.pagination.pages);
                    setTotalRecords(response.data.pagination.total);
                }
            }
        } catch (error) {
            console.error("Error fetching records:", error);
            toast.error("Failed to fetch records");
        } finally {
            setLoading(false);
        }
    };

    const fetchChartData = async () => {
        try {
            setLoadingChart(true);

            let deptId = selectedDepartment === 'all' ? 'all' : selectedDepartment;
            if (selectedChartDepts.length > 0) {
                deptId = selectedChartDepts.join(',');
            }

            let query = `/api/daily-5m/stats/daily/${deptId}?t=${Date.now()}`;
            if (selectedSection && selectedSection !== 'all') query += `&sectionId=${selectedSection}`;
            if (startDate) query += `&startDate=${startDate}`;
            if (endDate) query += `&endDate=${endDate}`;

            const response = await axiosInstance.get(query);
            if (response.data.success) {
                const fetchedData = response.data.data;
                
                // Determine the range to display
                // If user selected dates, use them. Otherwise show last 15 days.
                let rangeEnd = endDate ? new Date(endDate) : new Date();
                let rangeStart = startDate ? new Date(startDate) : new Date();
                
                if (!startDate) {
                    rangeStart.setDate(rangeStart.getDate() - 29); // Default to last 30 days
                }

                // Fill gaps for missing dates
                const filledData = [];
                let curr = new Date(rangeStart);
                // Ensure we compare dates without time
                const endLimit = new Date(rangeEnd);
                endLimit.setHours(23, 59, 59, 999);

                while (curr <= endLimit) {
                    const dateStr = format(curr, "yyyy-MM-dd");
                    const existing = fetchedData.find(d => {
                        const dDate = new Date(d.date);
                        return format(dDate, "yyyy-MM-dd") === dateStr;
                    });
                    
                    filledData.push({
                        date: dateStr,
                        displayDate: format(curr, "dd MMM"),
                        total: existing ? existing.total : 0,
                        approved: existing ? existing.approved : 0,
                        rejected: existing ? existing.rejected : 0,
                        pending: existing ? existing.pending : 0
                    });
                    curr.setDate(curr.getDate() + 1);
                }

                setChartData(filledData);
            }
        } catch (error) {
            console.error("Error fetching chart data:", error);
        } finally {
            setLoadingChart(false);
        }
    };

    const fetchRowStats = async () => {
        try {
            setLoadingRowStats(true);

            // If specific chart departments are selected, use them. Otherwise use the main selectedDepartment.
            let deptId = selectedDepartment === 'all' ? 'all' : selectedDepartment;
            if (selectedChartDepts.length > 0) {
                deptId = selectedChartDepts.join(',');
            }

            let query = `/api/daily-5m/stats/rows/${deptId}?t=${Date.now()}`;
            if (selectedSection && selectedSection !== 'all') query += `&sectionId=${selectedSection}`;
            
            // Only apply date filters if view type is 'daily'
            if (chartViewType === 'daily') {
                // If user has selected local chart dates, use them. Otherwise default to today for the pie charts.
                const effectiveStartDate = chartStartDate || format(new Date(), "yyyy-MM-dd");
                const effectiveEndDate = chartEndDate || format(new Date(), "yyyy-MM-dd");
                
                query += `&startDate=${effectiveStartDate}`;
                query += `&endDate=${effectiveEndDate}`;
            }

            const response = await axiosInstance.get(query);
            if (response.data.success) {
                setRowStats(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching row stats:", error);
        } finally {
            setLoadingRowStats(false);
        }
    };

    const getOverallPieOptions = () => {
        const data = [
            { name: 'Approved', y: rowStats?.overallStats?.approved || 0, color: '#10b981' },
            { name: 'Pending', y: rowStats?.overallStats?.pending || 0, color: '#f59e0b' },
            { name: 'Rejected', y: rowStats?.overallStats?.rejected || 0, color: '#ef4444' }
        ].filter(d => d.y > 0);

        return {
            chart: {
                type: 'pie',
                options3d: { enabled: true, alpha: 0, beta: 0 },
                backgroundColor: 'transparent',
                height: 300
            },
            title: { text: '' },
            tooltip: { 
                pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>',
                style: { fontSize: '13px', fontWeight: '500' }
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    depth: 35,
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.y}',
                        style: {
                            fontSize: '13px',
                            fontWeight: 'bold',
                            textOutline: 'none',
                            color: '#1e293b'
                        },
                        connectorColor: 'silver',
                        distance: 20
                    }
                }
            },
            series: [{ name: 'Status', data: data }],
            credits: { enabled: false }
        };
    };

    const getDeptPieOptions = () => {
        const data = rowStats?.departmentStats?.map((dept, index) => ({
            name: dept.departmentName,
            y: dept.total,
            color: CHART_COLORS[index % CHART_COLORS.length],
            approved: dept.approved,
            pending: dept.pending,
            rejected: dept.rejected
        })).filter(d => d.y > 0);

        return {
            chart: {
                type: 'pie',
                options3d: { enabled: true, alpha: 0, beta: 0 },
                backgroundColor: 'transparent',
                height: 300
            },
            title: { text: '' },
            tooltip: {
                headerFormat: '<span style="font-size: 14px; font-weight: bold">{point.key}</span><br/>',
                pointFormat: 'Total: <b>{point.y}</b><br/>' +
                    'Approved: <span style="color: #10b981">{point.approved}</span><br/>' +
                    'Pending: <span style="color: #f59e0b">{point.pending}</span><br/>' +
                    'Rejected: <span style="color: #ef4444">{point.rejected}</span>',
                style: { fontSize: '12px' }
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    depth: 35,
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.y}',
                        style: {
                            fontSize: '13px',
                            fontWeight: 'bold',
                            textOutline: 'none',
                            color: '#1e293b'
                        },
                        connectorColor: 'silver',
                        distance: 20
                    }
                }
            },
            series: [{ name: 'Filling Volume', data: data }],
            credits: { enabled: false }
        };
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
            await Promise.all([
                fetchRecords(),
                fetchChartData(),
                fetchRowStats()
            ]);
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
            <style>{scrollbarStyles}</style>
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

            {/* Filters Card */}
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-6">
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Filter className="w-4 h-4 text-blue-600" />
                            Filter Records
                        </CardTitle>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase">Department</Label>
                            <Select value={selectedDepartment} onValueChange={(val) => { setSelectedDepartment(val); setSelectedSection("all"); }} disabled={isRestricted && assignableDepartments.length === 1}>
                                <SelectTrigger className={isRestricted && assignableDepartments.length === 1 ? "bg-slate-50 cursor-not-allowed" : ""}>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(isAdmin || selectedDepartment === 'all') && <SelectItem value="all">All Departments</SelectItem>}
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
            </Card>

            {/* 5M Submission Trend Chart */}
            {selectedDepartment && (
                <div className="grid grid-cols-1 gap-6">
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <IconChartBar className="w-5 h-5 text-blue-600" />
                                        5M Activity Trend
                                    </CardTitle>
                                    <p className="text-xs text-slate-500 mt-1">Daily count of 5M parameters filled</p>
                                </div>
                                {loadingChart && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div 
                                ref={chartScrollRef}
                                className="h-[350px] w-full overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar scroll-smooth"
                            >
                                {loadingChart ? (
                                    <div className="h-full flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-200" />
                                    </div>
                                ) : chartData.length > 0 ? (
                                    <div style={{ minWidth: Math.max(chartData.length * 70, 800), height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 30, right: 30, left: -10, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="displayDate"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={{
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                        fontSize: '12px',
                                                        fontWeight: '600'
                                                    }}
                                                />
                                                <Legend
                                                    verticalAlign="top"
                                                    align="right"
                                                    height={36}
                                                    iconType="circle"
                                                    iconSize={10}
                                                    wrapperStyle={{ fontSize: '13px', paddingBottom: '25px', fontWeight: '600' }}
                                                />
                                                <Bar
                                                    dataKey="total"
                                                    name="Total Parameters Filled"
                                                    fill="#3b82f6"
                                                    radius={[6, 6, 0, 0]}
                                                    barSize={40}
                                                >
                                                    <LabelList 
                                                        dataKey="total" 
                                                        position="top" 
                                                        fill="#1e293b" 
                                                        fontSize={13} 
                                                        fontWeight={800}
                                                        offset={12} 
                                                    />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <Search className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">No 5M data available for selected filters</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 5M Analytical Charts */}
            {selectedDepartment && rowStats && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4 bg-white/50 p-2 rounded-xl border border-slate-200/60 shadow-sm px-4">
                        <div className="flex items-center gap-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dept:</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 border-dashed border-slate-300 text-xs bg-white">
                                        <Filter className="w-3.5 h-3.5 mr-2" />
                                        {selectedChartDepts.length === 0 ? "All Depts" : `${selectedChartDepts.length} Selected`}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] p-0" align="start">
                                    <div className="p-2 border-b">
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            className="w-full justify-start text-[10px] h-7"
                                            onClick={() => setSelectedChartDepts([])}
                                        >
                                            Clear All
                                        </Button>
                                    </div>
                                    <div className="max-h-[300px] overflow-auto p-1">
                                        {assignableDepartments.map((dept) => {
                                            const id = dept._id || dept.id;
                                            const isSelected = selectedChartDepts.includes(id);
                                            return (
                                                <div
                                                    key={id}
                                                    className={cn(
                                                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 text-sm",
                                                        isSelected && "bg-blue-50 text-blue-700 font-medium"
                                                    )}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedChartDepts(selectedChartDepts.filter(d => d !== id));
                                                        } else {
                                                            setSelectedChartDepts([...selectedChartDepts, id]);
                                                        }
                                                    }}
                                                >
                                                    <div className={cn(
                                                        "w-4 h-4 border rounded flex items-center justify-center",
                                                        isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                                                    )}>
                                                        {isSelected && <IconCheck size={12} className="text-white" />}
                                                    </div>
                                                    {dept.name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="w-px h-6 bg-slate-200 hidden sm:block" />

                        <div className="flex items-center gap-2">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mode:</Label>
                            <Select value={chartViewType} onValueChange={setChartViewType}>
                                <SelectTrigger className="h-8 w-[120px] border-dashed text-xs bg-white">
                                    <SelectValue placeholder="Select View" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="overall">Overall</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {chartViewType === 'daily' && (
                            <>
                                <div className="w-px h-6 bg-slate-200 hidden sm:block" />
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date:</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={cn(
                                                    "h-8 justify-start text-left font-normal border-dashed text-xs bg-white",
                                                    (!chartStartDate && !chartEndDate) && "text-slate-400"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                {chartStartDate ? (
                                                    chartEndDate ? (
                                                        <>
                                                            {format(new Date(chartStartDate), "dd/MM/yy")} - {format(new Date(chartEndDate), "dd/MM/yy")}
                                                        </>
                                                    ) : (
                                                        format(new Date(chartStartDate), "dd/MM/yy")
                                                    )
                                                ) : (
                                                    <span>Today</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <div className="p-2 border-b flex justify-between items-center bg-slate-50/50">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">Custom Chart Range</span>
                                                <Button 
                                                    variant="ghost" 
                                                    size="xs" 
                                                    className="h-6 text-[10px]"
                                                    onClick={() => { setChartStartDate(""); setChartEndDate(""); }}
                                                >
                                                    Reset to Today
                                                </Button>
                                            </div>
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={chartStartDate ? new Date(chartStartDate) : undefined}
                                                selected={{
                                                    from: chartStartDate ? new Date(chartStartDate) : undefined,
                                                    to: chartEndDate ? new Date(chartEndDate) : undefined,
                                                }}
                                                onSelect={(range) => {
                                                    setChartStartDate(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                                                    setChartEndDate(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                                                }}
                                                numberOfMonths={2}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Department Distribution Pie Chart */}
                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <IconChartPie className="w-5 h-5 text-orange-600" />
                                            Dept. Parameter Filling
                                        </CardTitle>
                                        <CardDescription>
                                            {chartViewType === 'daily' ? 'Filled rows for selected date(s)' : 'Total filled rows across all time'}
                                        </CardDescription>
                                    </div>
                                    {loadingRowStats && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 flex-1 flex flex-col">
                                {loadingRowStats ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-orange-200" />
                                    </div>
                                ) : rowStats.departmentStats.length > 0 ? (
                                    <>
                                        <div className="h-[300px] w-full">
                                            <HighchartsReact
                                                key={`dept-pie-${JSON.stringify(rowStats.departmentStats)}`}
                                                highcharts={Highcharts}
                                                options={getDeptPieOptions()}
                                            />
                                        </div>
                                        <div className="mt-6 flex flex-wrap gap-2 justify-center">
                                            {rowStats.departmentStats.slice(0, 6).map((dept, idx) => (
                                                <div key={idx} className="flex flex-col items-center p-2 px-4 rounded-lg bg-slate-50 border border-slate-100 min-w-[100px]">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[80px]" title={dept.departmentName}>
                                                        {dept.departmentName}
                                                    </span>
                                                    <span className="text-sm font-black text-slate-700">{dept.total}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <Search className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">No department data available</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Overall Row Status Pie Chart */}
                        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <IconChartPie className="w-5 h-5 text-purple-600" />
                                            Overall Parameter Status
                                        </CardTitle>
                                        <CardDescription>
                                            {chartViewType === 'daily' ? 'Status distribution for selected date(s)' : 'Status distribution across all time'}
                                        </CardDescription>
                                    </div>
                                    {loadingRowStats && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-6 flex-1 flex flex-col">
                                {loadingRowStats ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-purple-200" />
                                    </div>
                                ) : rowStats.overallStats.total > 0 ? (
                                    <>
                                        <div className="h-[300px] w-full">
                                            <HighchartsReact
                                                key={`overall-pie-${JSON.stringify(rowStats.overallStats)}`}
                                                highcharts={Highcharts}
                                                options={getOverallPieOptions()}
                                            />
                                        </div>
                                        <div className="mt-6 grid grid-cols-3 gap-2">
                                            <div className="flex flex-col items-center p-2 rounded-lg bg-green-50/50 border border-green-100">
                                                <span className="text-[10px] font-bold text-green-600 uppercase">Approved</span>
                                                <span className="text-lg font-black text-green-700">{rowStats.overallStats.approved}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                                                <span className="text-[10px] font-bold text-amber-600 uppercase">Pending</span>
                                                <span className="text-lg font-black text-amber-700">{rowStats.overallStats.pending}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-2 rounded-lg bg-red-50/50 border border-red-100">
                                                <span className="text-[10px] font-bold text-red-600 uppercase">Rejected</span>
                                                <span className="text-lg font-black text-red-700">{rowStats.overallStats.rejected}</span>
                                            </div>
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 col-span-3 mt-1 px-4">
                                                <span className="text-xs font-bold text-purple-700 uppercase">Total Rows Scanned</span>
                                                <span className="text-sm font-black text-purple-900">{rowStats.overallStats.total}</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                        <Search className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-sm">No parameter data available</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Records Table Card */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-600" />
                        Records List
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
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
                {records.length > 0 && (
                    <div className="bg-slate-50/50 border-t border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-700">{((currentPage - 1) * pageSize) + 1}</span> to <span className="font-semibold text-slate-700">{Math.min(currentPage * pageSize, totalRecords)}</span> of <span className="font-semibold text-slate-700">{totalRecords}</span> records
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 uppercase">Rows per page:</span>
                                <Select value={String(pageSize)} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder={pageSize} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 20, 50, 100].map(size => (
                                            <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex items-center gap-1 mx-1">
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;

                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-8 w-8 p-0 text-xs", currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700 shadow-sm" : "")}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
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
