import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Filter,
    History as HistoryIcon,
    Save,
    Calendar as CalendarIcon,
    ChevronRight,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';

const MONTHS = [
    { id: 1, name: "January" }, { id: 2, name: "February" }, { id: 3, name: "March" },
    { id: 4, name: "April" }, { id: 5, name: "May" }, { id: 6, name: "June" },
    { id: 7, name: "July" }, { id: 8, name: "August" }, { id: 9, name: "September" },
    { id: 10, name: "October" }, { id: 11, name: "November" }, { id: 12, name: "December" }
];

const LineRequirementManager = () => {
    const dispatch = useDispatch();
    // --- State: Filters ---
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [lines, setLines] = useState([]);
    
    const [filters, setFilters] = useState({
        departmentId: 'all',
        sectionId: 'all',
        type: 'MONTHLY',
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString(),
        date: new Date().toISOString().split('T')[0]
    });

    // --- State: Data ---
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [historyLine, setHistoryLine] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // --- Initial Load: Departments ---
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await axiosInstance.get('/api/departments');
                if (res.data?.success) {
                    setDepartments(res.data.data.departments || []);
                }
            } catch (error) {
                console.error("Error fetching departments:", error);
                toast.error("Failed to load departments");
            }
        };
        fetchDepartments();
    }, []);

    // --- Cascading: Fetch Sections when Dept changes ---
    useEffect(() => {
        if (filters.departmentId !== 'all') {
            const fetchSections = async () => {
                try {
                    const res = await axiosInstance.get(`/api/sections/department/${filters.departmentId}`);
                    if (res.data?.success) {
                        setSections(res.data.data.sections || res.data.data || []);
                    }
                } catch (error) {
                    console.error("Error fetching sections:", error);
                }
            };
            fetchSections();
        } else {
            setSections([]);
            setFilters(prev => ({ ...prev, sectionId: 'all' }));
        }
    }, [filters.departmentId]);

    // --- Fetch Data ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {
                type: filters.type,
                year: filters.year,
            };
            
            if (filters.departmentId !== 'all') params.departmentId = filters.departmentId;
            if (filters.sectionId !== 'all') params.sectionId = filters.sectionId;
            
            if (filters.type === 'MONTHLY') {
                params.month = filters.month;
            } else {
                params.date = filters.date;
            }

            const res = await axiosInstance.get('/api/line-requirements', { params });
            if (res.data?.success) {
                setData(res.data.data || []);
            }
        } catch (error) {
            console.error("Error fetching line requirements:", error);
            toast.error("Failed to load requirements");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters]);

    // --- Update Requirement ---
    const handleUpdate = async (lineId, newQuantity) => {
        if (newQuantity === '' || isNaN(newQuantity)) return;
        
        setUpdatingId(lineId);
        try {
            const payload = {
                lineId,
                quantity: parseInt(newQuantity),
                type: filters.type,
                requirementYear: parseInt(filters.year)
            };

            if (filters.type === 'MONTHLY') {
                payload.requirementMonth = parseInt(filters.month);
            } else {
                payload.requirementDate = filters.date;
            }

            const res = await axiosInstance.post('/api/line-requirements/update', payload);
            if (res.data?.success) {
                toast.success("Requirement updated");
                // Local state update
                setData(prev => prev.map(item => item.lineId === lineId ? { ...item, quantity: newQuantity } : item));
                
                // Invalidate RTK Query cache for Line components to ensure consistency across the UI
                try {
                    const { LineApi } = await import('@/Redux/AllApi/LineApi');
                    dispatch(LineApi.util.invalidateTags(['Line']));
                } catch (e) {
                    console.error("Failed to invalidate Line cache", e);
                }
            }
        } catch (error) {
            console.error("Error updating requirement:", error);
            toast.error("Update failed");
        } finally {
            setUpdatingId(null);
        }
    };

    // --- History View ---
    const openHistory = async (line) => {
        setHistoryLine(line);
        setLoadingHistory(true);
        try {
            const res = await axiosInstance.get(`/api/line-requirements/history/${line.lineId}`);
            if (res.data?.success) {
                setHistoryData(res.data.data || []);
            }
        } catch (error) {
            toast.error("Failed to load history");
        } finally {
            setLoadingHistory(false);
        }
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            {/* --- Header --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Line Requirement Management</h1>
                    <p className="text-slate-500">View and update manpower requirements for specific lines.</p>
                </div>
                <div className="flex gap-2">
                    <Tabs value={filters.type} onValueChange={(val) => setFilters(prev => ({ ...prev, type: val }))} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="MONTHLY">Monthly</TabsTrigger>
                            <TabsTrigger value="DAILY">Daily</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* --- Filters Card --- */}
            <Card className="border-none shadow-sm overflow-visible z-10">
                <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                    {/* Department Filter */}
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</label>
                        <Select value={filters.departmentId} onValueChange={(val) => setFilters(prev => ({ ...prev, departmentId: val, sectionId: 'all' }))}>
                            <SelectTrigger className="bg-white border-slate-200">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(dept => (
                                    <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Section Filter */}
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Section</label>
                        <Select 
                            value={filters.sectionId} 
                            onValueChange={(val) => setFilters(prev => ({ ...prev, sectionId: val }))}
                            disabled={filters.departmentId === 'all'}
                        >
                            <SelectTrigger className="bg-white border-slate-200">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sections</SelectItem>
                                {sections.map(sec => (
                                    <SelectItem key={sec.id} value={sec.id.toString()}>{sec.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Time Filters */}
                    {filters.type === 'MONTHLY' ? (
                        <>
                            <div className="w-[120px] space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</label>
                                <Select value={filters.month} onValueChange={(val) => setFilters(prev => ({ ...prev, month: val }))}>
                                    <SelectTrigger className="bg-white border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MONTHS.map(m => (
                                            <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-[100px] space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</label>
                                <Input 
                                    type="number" 
                                    value={filters.year} 
                                    onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                                    className="bg-white border-slate-200"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="w-[200px] space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
                            <div className="relative">
                                <Input 
                                    type="date" 
                                    value={filters.date} 
                                    onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                                    className="bg-white border-slate-200 pl-10"
                                />
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    )}

                    <Button variant="outline" size="icon" className="shrink-0 text-slate-400 border-slate-200" onClick={fetchData}>
                        <Filter className="w-4 h-4" />
                    </Button>
                </CardContent>
            </Card>

            {/* --- Data Table --- */}
            <Card className="border-none shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-100 uppercase text-[10px] font-bold text-slate-500 tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Department / Section</th>
                                <th className="px-6 py-4">Line Name</th>
                                <th className="px-6 py-4">UniCode</th>
                                <th className="px-6 py-4 text-center">Requirement</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                                        <span className="text-slate-400 font-medium tracking-wide">Fetching requirements...</span>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        <span className="text-slate-400 font-medium tracking-wide">No lines found for the selected filters.</span>
                                    </td>
                                </tr>
                            ) : data.map((item) => (
                                <tr key={item.lineId} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-700">{item.departmentName}</span>
                                            <span className="text-[11px] text-slate-400 font-medium">{item.sectionName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{item.lineName}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-mono">
                                            {item.lineCode || 'N/A'}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2 max-w-[120px] mx-auto">
                                            <Input 
                                                type="number" 
                                                defaultValue={item.quantity || 0}
                                                onBlur={(e) => handleUpdate(item.lineId, e.target.value)}
                                                className="h-8 w-20 text-center bg-white border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all font-bold"
                                                key={`${item.lineId}-${item.quantity}`} // Force re-render on save
                                            />
                                            {updatingId === item.lineId ? (
                                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all rounded-lg"
                                            onClick={() => openHistory(item)}
                                        >
                                            <HistoryIcon className="w-4 h-4 mr-2" />
                                            History
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* --- History Modal --- */}
            <Dialog open={!!historyLine} onOpenChange={() => setHistoryLine(null)}>
                <DialogContent className="max-w-3xl border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/10 rounded-xl">
                                    <HistoryIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-bold">Requirement History</DialogTitle>
                                    <DialogDescription className="text-blue-100">
                                        Tracking changes for <span className="text-white font-bold">{historyLine?.lineName}</span>
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 max-h-[60vh] overflow-y-auto bg-white">
                        {loadingHistory ? (
                            <div className="py-20 text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
                                <p className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Loading history log...</p>
                            </div>
                        ) : historyData.length === 0 ? (
                            <div className="py-20 text-center">
                                <AlertCircle className="w-12 h-12 mx-auto text-slate-100 mb-4" />
                                <p className="text-slate-400 font-medium">No history found for this line yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyData.map((log) => (
                                    <div key={log.id} className="relative flex gap-4 pr-4">
                                        {/* Timeline Dot */}
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group">
                                                <div className="w-2 h-2 rounded-full bg-blue-600 group-hover:scale-125 transition-transform" />
                                            </div>
                                            <div className="w-[1px] h-full bg-slate-100" />
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="flex-1 pb-6">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900">{log.newQuantity}</span>
                                                    <Badge className="bg-blue-50 text-blue-600 border-none text-[9px] uppercase tracking-tighter h-4">
                                                        {log.type}
                                                    </Badge>
                                                    {log.oldQuantity !== null && (
                                                        <span className="text-xs text-slate-400 line-through decoration-slate-300">from {log.oldQuantity}</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                        {log.changedByName?.charAt(0) || '?'}
                                                    </div>
                                                    <span>Changed by <span className="text-slate-700 font-semibold">{log.changedByName || 'System'}</span></span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium italic">
                                                    Target: {log.type === 'DAILY' ? log.requirementDate : `${MONTHS[log.requirementMonth-1]?.name} ${log.requirementYear}`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
                        <Button onClick={() => setHistoryLine(null)} className="rounded-lg px-8 bg-white text-slate-600 border-slate-200 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition-all shadow-none">
                            Close History
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LineRequirementManager;
