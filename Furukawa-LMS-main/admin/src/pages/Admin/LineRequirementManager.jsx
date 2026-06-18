import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Card,
    CardContent,
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
    Filter,
    History as HistoryIcon,
    Calendar as CalendarIcon,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Target,
    TrendingDown,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
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
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const permissions = authUser?.customRole?.permissions || [];
    const canView = isAdmin || permissions.includes('line_requirement:read');
    const canEdit = isAdmin || permissions.includes('line_requirement:update');
    const canAccessAll = isAdmin;

    // --- State: Filters ---
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);

    const [filters, setFilters] = useState({
        departmentId: 'all',
        sectionId: 'all',
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString(),
    });

    // --- State: Data ---
    const [lines, setLines] = useState([]);
    const [targetFN01, setTargetFN01] = useState(0);
    const [targetFN02, setTargetFN02] = useState(0);
    const [reqValues, setReqValues] = useState({});
    const [loading, setLoading] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const [historyLine, setHistoryLine] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Helper to safely extract IDs from various structures (IDs, objects, JSON strings)
    const extractIds = (items) => {
        if (!items) return [];
        let parsed = items;
        if (typeof items === 'string') {
            try {
                parsed = JSON.parse(items);
            } catch (e) {
                return [String(items)];
            }
        }
        if (!Array.isArray(parsed)) return [String(parsed)];
        return parsed.map(item => {
            if (!item) return null;
            if (typeof item === 'object') {
                return String(item.id ?? item._id ?? item.departmentId ?? item.sectionId ?? '');
            }
            return String(item);
        }).filter(Boolean);
    };

    // --- Role-based department/section filtering ---
    const assignableDepartments = useMemo(() => {
        const assignedIds = extractIds(authUser?.departments);
        if (authUser?.departmentId) {
            const depIdStr = String(authUser.departmentId);
            if (!assignedIds.includes(depIdStr)) {
                assignedIds.push(depIdStr);
            }
        }
        if (!authUser || canAccessAll || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d.id)));
    }, [departments, authUser, canAccessAll]);

    const assignableSections = useMemo(() => {
        const assignedIds = extractIds(authUser?.sections);
        if (authUser?.sectionId) {
            const secIdStr = String(authUser.sectionId);
            if (!assignedIds.includes(secIdStr)) {
                assignedIds.push(secIdStr);
            }
        }
        if (!authUser || canAccessAll || assignedIds.length === 0) return sections;
        return sections.filter(s => assignedIds.includes(String(s.id)));
    }, [sections, authUser, canAccessAll]);

    const isRestricted = useMemo(() => {
        if (canAccessAll) return false;
        const deptIds = extractIds(authUser?.departments);
        if (authUser?.departmentId) deptIds.push(String(authUser.departmentId));
        const sectIds = extractIds(authUser?.sections);
        if (authUser?.sectionId) sectIds.push(String(authUser.sectionId));
        return deptIds.length > 0 || sectIds.length > 0;
    }, [authUser, canAccessAll]);

    // Auto-select the only assignable dept/section for restricted users
    useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length > 0 && filters.departmentId === 'all') {
            setFilters(prev => ({ ...prev, departmentId: String(assignableDepartments[0].id) }));
        }
    }, [isRestricted, assignableDepartments, filters.departmentId]);

    useEffect(() => {
        if (!isRestricted) return;
        if (filters.departmentId !== 'all' && assignableSections.length > 0 && filters.sectionId === 'all') {
            setFilters(prev => ({ ...prev, sectionId: String(assignableSections[0].id) }));
        }
    }, [isRestricted, assignableSections, filters.departmentId, filters.sectionId]);

    // --- Initial Load: Departments ---
    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await axiosInstance.get('/api/departments');
                if (res.data?.success) {
                    setDepartments(res.data.data.departments || []);
                }
            } catch (error) {
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
                year: filters.year,
                month: filters.month,
            };
            if (filters.departmentId !== 'all') params.departmentId = filters.departmentId;
            if (filters.sectionId !== 'all') params.sectionId = filters.sectionId;

            const res = await axiosInstance.get('/api/line-requirements', { params });
            if (res.data?.success) {
                const responseData = res.data.data || {};
                const fetchedLines = responseData.lines || [];
                setLines(fetchedLines);
                setTargetFN01(responseData.targetFN01 || 0);
                setTargetFN02(responseData.targetFN02 || 0);

                const initial = {};
                fetchedLines.forEach(item => {
                    initial[item.lineId] = {
                        fn01: item.fn01 ?? 0,
                        fn02: item.fn02 ?? 0,
                    };
                });
                setReqValues(initial);
            }
        } catch (error) {
            toast.error("Failed to load requirements");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filters]);

    // --- Dynamic remaining calculation ---
    const enteredFN01 = useMemo(() =>
        Object.values(reqValues).reduce((sum, v) => sum + (parseInt(v.fn01) || 0), 0),
        [reqValues]
    );
    const enteredFN02 = useMemo(() =>
        Object.values(reqValues).reduce((sum, v) => sum + (parseInt(v.fn02) || 0), 0),
        [reqValues]
    );
    // --- Update Requirement ---
    const handleUpdate = async (lineId, fn01Val, fn02Val) => {
        const fn01 = parseInt(fn01Val) || 0;
        const fn02 = parseInt(fn02Val) || 0;

        if (enteredFN01 > targetFN01 || enteredFN02 > targetFN02) {
            toast.error("Cannot save: Total section requirements exceed target limit.");
            const savedLine = lines.find(l => l.lineId === lineId);
            setReqValues(prev => ({
                ...prev,
                [lineId]: { fn01: savedLine?.fn01 ?? 0, fn02: savedLine?.fn02 ?? 0 },
            }));
            return;
        }

        setUpdatingId(lineId);
        try {
            const payload = {
                lineId,
                fn01,
                fn02,
                requirementYear: parseInt(filters.year),
                requirementMonth: parseInt(filters.month),
            };

            const res = await axiosInstance.post('/api/line-requirements/update', payload);
            if (res.data?.success) {
                toast.success("Requirement updated");
                setLines(prev => prev.map(item =>
                    item.lineId === lineId
                        ? { ...item, fn01, fn02, quantity: fn01 + fn02 }
                        : item
                ));
                try {
                    const { LineApi } = await import('@/Redux/AllApi/LineApi');
                    dispatch(LineApi.util.invalidateTags(['Line']));
                } catch (e) {
                    console.error("Failed to invalidate Line cache", e);
                }
            }
        } catch (error) {
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

    const selectedMonthName = MONTHS.find(m => m.id === parseInt(filters.month))?.name || '';

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border border-slate-200 m-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-slate-700">Access Denied</h3>
                <p className="text-sm text-slate-500 max-w-xs text-center mt-2 leading-relaxed">
                    You do not have permission to view this page.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            {/* --- Header --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Line Requirement Management</h1>
                    <p className="text-slate-500">View and update manpower requirements for specific lines.</p>
                </div>

                {/* Month/Year + Target + Remaining — stacked right-aligned */}
                <div className="flex flex-col items-end gap-2">
                    {/* Row 1: month / year label */}
                    <div className="flex items-center gap-1">
                        <Badge className="bg-blue-100 text-blue-700 border-none px-4 py-2 text-base font-bold gap-1.5">
                            <CalendarIcon className="w-4 h-4" />
                            {selectedMonthName} {filters.year}
                        </Badge>
                    </div>

                    {/* Row 2: Target */}
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target</span>
                        <Badge className="bg-amber-100 text-amber-700 border-none px-4 py-2 text-base font-bold">
                            FN01: {targetFN01}
                        </Badge>
                        <Badge className="bg-amber-100 text-amber-700 border-none px-4 py-2 text-base font-bold">
                            FN02: {targetFN02}
                        </Badge>
                    </div>

                    {/* Row 3: Remaining */}
                    <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actual</span>
                        <Badge className={`border-none px-4 py-2 text-base font-bold ${enteredFN01 > targetFN01 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            FN01: {enteredFN01}
                        </Badge>
                        <Badge className={`border-none px-4 py-2 text-base font-bold ${enteredFN02 > targetFN02 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            FN02: {enteredFN02}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* --- Filters Card --- */}
            <Card className="border-none shadow-sm overflow-visible z-10">
                <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                    {/* Department Filter */}
                    <div className="flex-1 min-w-[200px] space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</label>
                        <Select
                            value={filters.departmentId}
                            onValueChange={(val) => setFilters(prev => ({ ...prev, departmentId: val, sectionId: 'all' }))}
                            disabled={isRestricted && assignableDepartments.length === 1}
                        >
                            <SelectTrigger className="bg-white border-slate-200">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                {!isRestricted && <SelectItem value="all">All Departments</SelectItem>}
                                {assignableDepartments.map(dept => (
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
                            disabled={(filters.departmentId === 'all') || (isRestricted && assignableSections.length === 1)}
                        >
                            <SelectTrigger className="bg-white border-slate-200">
                                <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                                {!isRestricted && <SelectItem value="all">All Sections</SelectItem>}
                                {assignableSections.map(sec => (
                                    <SelectItem key={sec.id} value={sec.id.toString()}>{sec.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Month Filter */}
                    <div className="w-[130px] space-y-1.5">
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

                    {/* Year Filter */}
                    <div className="w-[100px] space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</label>
                        <Input
                            type="number"
                            value={filters.year}
                            onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                            className="bg-white border-slate-200"
                        />
                    </div>

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
                                <th className="px-6 py-3" rowSpan={2}>Department</th>
                                <th className="px-6 py-3" rowSpan={2}>Section</th>
                                <th className="px-6 py-3" rowSpan={2}>Line Name</th>
                                <th className="px-6 py-3 text-center border-l border-slate-100" colSpan={2}>Requirement</th>
                                <th className="px-6 py-3 text-right" rowSpan={2}>Actions</th>
                            </tr>
                            <tr>
                                <th className="px-6 py-2 text-center border-l border-slate-100 border-t border-slate-100">FN01</th>
                                <th className="px-6 py-2 text-center border-t border-slate-100">FN02</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                                        <span className="text-slate-400 font-medium tracking-wide">Fetching requirements...</span>
                                    </td>
                                </tr>
                            ) : lines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                                        <span className="text-slate-400 font-medium tracking-wide">No lines found for the selected filters.</span>
                                    </td>
                                </tr>
                            ) : lines.map((item) => (
                                <tr key={item.lineId} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-semibold text-slate-700">{item.departmentName}</td>
                                    <td className="px-6 py-4 text-slate-500 text-[12px] font-medium">{item.sectionName}</td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{item.lineName}</td>

                                    {/* FN01 input */}
                                    <td className="px-4 py-4 border-l border-slate-100">
                                        <div className="flex items-center justify-center gap-1.5 max-w-[110px] mx-auto">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={reqValues[item.lineId]?.fn01 ?? 0}
                                                disabled={!canEdit || updatingId === item.lineId}
                                                onChange={(e) => setReqValues(prev => ({
                                                    ...prev,
                                                    [item.lineId]: { ...prev[item.lineId], fn01: e.target.value }
                                                }))}
                                                onBlur={(e) => handleUpdate(
                                                    item.lineId,
                                                    e.target.value,
                                                    reqValues[item.lineId]?.fn02 ?? 0
                                                )}
                                                className="h-8 w-20 text-center bg-white border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all font-bold"
                                            />
                                            {updatingId === item.lineId ? (
                                                <Loader2 className="w-3 h-3 animate-spin text-blue-600 shrink-0" />
                                            ) : (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            )}
                                        </div>
                                    </td>

                                    {/* FN02 input */}
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-center max-w-[90px] mx-auto">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={reqValues[item.lineId]?.fn02 ?? 0}
                                                disabled={!canEdit || updatingId === item.lineId}
                                                onChange={(e) => setReqValues(prev => ({
                                                    ...prev,
                                                    [item.lineId]: { ...prev[item.lineId], fn02: e.target.value }
                                                }))}
                                                onBlur={(e) => handleUpdate(
                                                    item.lineId,
                                                    reqValues[item.lineId]?.fn01 ?? 0,
                                                    e.target.value
                                                )}
                                                className="h-8 w-20 text-center bg-white border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all font-bold"
                                            />
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
                                        {/* Timeline dot */}
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <div className="w-2 h-2 rounded-full bg-blue-600" />
                                            </div>
                                            <div className="w-[1px] h-full bg-slate-100" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 pb-6">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex flex-col gap-1">
                                                    {/* FN01 row */}
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-blue-50 text-blue-600 border-none text-[9px] uppercase tracking-tighter h-4 px-1.5">FN01</Badge>
                                                        <span className="font-bold text-slate-900">{log.newFn01 ?? log.newQuantity ?? 0}</span>
                                                        {(log.oldFn01 !== null && log.oldFn01 !== undefined) && (
                                                            <span className="text-xs text-slate-400 line-through decoration-slate-300">from {log.oldFn01}</span>
                                                        )}
                                                    </div>
                                                    {/* FN02 row */}
                                                    <div className="flex items-center gap-2">
                                                        <Badge className="bg-indigo-50 text-indigo-600 border-none text-[9px] uppercase tracking-tighter h-4 px-1.5">FN02</Badge>
                                                        <span className="font-bold text-slate-900">{log.newFn02 ?? 0}</span>
                                                        {(log.oldFn02 !== null && log.oldFn02 !== undefined) && (
                                                            <span className="text-xs text-slate-400 line-through decoration-slate-300">from {log.oldFn02}</span>
                                                        )}
                                                    </div>
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
                                                    {MONTHS[log.requirementMonth - 1]?.name} {log.requirementYear}
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
