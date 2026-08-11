import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
    useGetAllDepartmentsQuery,
    useGetHandoverSheetsMonitoringQuery,
    useDeleteHandoverSheetMutation,
    useBulkDeleteHandoverSheetsMutation,
} from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import {
    IconClipboardList,
    IconHierarchy2,
    IconAlertTriangle,
    IconChartBar,
    IconUsers,
    IconPencil,
    IconTrash,
    IconPlus,
    IconArrowLeft,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useGetMachinesByDepartmentQuery } from '@/Redux/AllApi/MachineApi';
import { useLogActionMutation } from '@/Redux/AllApi/AuditApi';
import HandoverSheet from '@/components/departments/HandoverSheet';
import { displayDate } from '@/utils/dateUtils';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2023 }, (_, i) => String(currentYear - i));

const SHIFTS = [
    { value: 'A', label: 'Shift A' },
    { value: 'B', label: 'Shift B' },
    { value: 'C', label: 'Shift C' },
    { value: 'G', label: 'General' },
];

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return displayDate(dateStr);
};

const HandoverSheetsTable = ({ rows, loading, selectedIds, onToggleSelect, onToggleSelectAll, onRowClick, onEdit, onDelete, canManage, canDelete }) => {
    const allSelected = rows.length > 0 && rows.every(r => selectedIds.includes(r.id));

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                Loading handover sheets...
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 bg-slate-50 rounded-full mb-4">
                    <IconClipboardList className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">No handover sheets found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters, or create a new sheet</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b bg-slate-50/70">
                        {canDelete && (
                            <th className="px-4 py-3 text-left w-10">
                                <Checkbox checked={allSelected} onCheckedChange={(checked) => onToggleSelectAll(!!checked)} />
                            </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Shift</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <span className="flex items-center justify-center gap-1">
                                <IconUsers className="w-3.5 h-3.5" />
                                Trainees
                            </span>
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                        <tr
                            key={row.id}
                            onClick={() => onRowClick(row)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                        >
                            {canDelete && (
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={(checked) => onToggleSelect(row.id, !!checked)} />
                                </td>
                            )}
                            <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">#{row.id}</td>
                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                                {formatDate(row.date)}
                            </td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                {row.departmentName || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                {row.sectionName || '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                                {row.shift ? (
                                    <Badge variant="outline" className="text-xs font-semibold border-blue-300 text-blue-700 bg-blue-50">
                                        {row.shift}
                                    </Badge>
                                ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                                    {row.entriesCount ?? 0}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                                {row.isSubmitted ? (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-xs font-medium">
                                        Submitted
                                    </Badge>
                                ) : (
                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-xs font-medium">
                                        Draft
                                    </Badge>
                                )}
                            </td>
                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                    {canManage && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onEdit(row)}
                                            className="h-7 px-3 text-xs gap-1.5 border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                                        >
                                            <IconPencil className="w-3.5 h-3.5" />
                                            Edit
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onDelete(row)}
                                            className="h-7 px-3 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                        >
                                            <IconTrash className="w-3.5 h-3.5" />
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const HandoverSheetPage = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const hasHandoverBypass = authUser?.customRole?.permissions?.includes('dojo:handover_sheet');
    const canAccessAll = isAdmin || hasHandoverBypass;
    const hasReadPermission = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:read') || hasHandoverBypass;
    const canManage = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:manage');
    const canDelete = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:delete');

    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('subTab') || 'sheets');

    if (!hasReadPermission) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white border border-slate-100 rounded-3xl max-w-xl mx-auto my-12 shadow-sm">
                <IconAlertTriangle className="w-16 h-16 text-red-500 mb-4 opacity-75 animate-bounce" />
                <h3 className="text-xl font-bold text-slate-800">Access Denied</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm">
                    You do not have permission to view the Handover Sheet. Please check with your supervisor or administrator.
                </p>
            </div>
        );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();

    // ── Active sheet (view/edit) state ───────────────────────────────────────
    const [sheetMode, setSheetMode] = useState(
        searchParams.get('mode') === 'view' || searchParams.get('mode') === 'edit' ? searchParams.get('mode') : null
    );
    const [activeSheet, setActiveSheet] = useState(() => {
        const id = searchParams.get('sheetId');
        const deptParam = searchParams.get('dept');
        if (!id && !deptParam) return null;
        return {
            id: id || null,
            departmentId: deptParam || "",
            sectionId: searchParams.get('section') || "",
            shift: searchParams.get('shift') || "",
            date: searchParams.get('date') || todayStr,
        };
    });

    useEffect(() => {
        const subTabParam = searchParams.get('subTab');
        if (subTabParam && subTabParam !== activeTab) {
            setActiveTab(subTabParam);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams.get('subTab')]);

    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        params.set('subTab', activeTab);
        if (sheetMode && activeSheet) {
            params.set('mode', sheetMode);
            if (activeSheet.id) params.set('sheetId', activeSheet.id); else params.delete('sheetId');
            if (activeSheet.departmentId) params.set('dept', activeSheet.departmentId); else params.delete('dept');
            if (activeSheet.sectionId) params.set('section', activeSheet.sectionId); else params.delete('section');
            if (activeSheet.shift) params.set('shift', activeSheet.shift); else params.delete('shift');
            if (activeSheet.date) params.set('date', activeSheet.date); else params.delete('date');
        } else {
            params.delete('mode');
            params.delete('sheetId');
            params.delete('dept');
            params.delete('section');
            params.delete('shift');
            params.delete('date');
        }
        setSearchParams(params, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, sheetMode, activeSheet]);

    // ── Create dialog state ──────────────────────────────────────────────────
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createDept, setCreateDept] = useState("");
    const [createSection, setCreateSection] = useState("");
    const [createShift, setCreateShift] = useState("");
    const [createDate, setCreateDate] = useState(todayStr);

    // ── "Sheets" dashboard tab filters — default to the current month/year ──
    const [dashDept, setDashDept] = useState('all');
    const [dashSection, setDashSection] = useState('all');
    const [dashShift, setDashShift] = useState('all');
    const [dashMonth, setDashMonth] = useState(String(now.getMonth() + 1));
    const [dashYear, setDashYear] = useState(String(now.getFullYear()));
    const [dashSelectedIds, setDashSelectedIds] = useState([]);

    // ── Monitoring tab filters — show full history by default ───────────────
    const [monitorDept, setMonitorDept] = useState('all');
    const [monitorSection, setMonitorSection] = useState('all');
    const [monitorShift, setMonitorShift] = useState('all');
    const [monitorMonth, setMonitorMonth] = useState('all');
    const [monitorYear, setMonitorYear] = useState('all');
    const [monitorSelectedIds, setMonitorSelectedIds] = useState([]);

    // ── Shared API data ──────────────────────────────────────────────────────
    const { data: deptsData } = useGetAllDepartmentsQuery({ limit: 500 });
    const { data: createSectionsData } = useGetSectionsByDepartmentQuery(createDept, { skip: !createDept });
    const { data: dashSectionsData } = useGetSectionsByDepartmentQuery(dashDept, { skip: !dashDept || dashDept === 'all' });
    const { data: monitorSectionsData } = useGetSectionsByDepartmentQuery(monitorDept, { skip: !monitorDept || monitorDept === 'all' });
    const { data: activeSheetSectionsData } = useGetSectionsByDepartmentQuery(activeSheet?.departmentId, { skip: !activeSheet?.departmentId });

    const { data: studentsData } = useGetAllStudentsQuery({
        departmentId: activeSheet?.departmentId,
        sectionId: activeSheet?.sectionId === "0" ? "" : activeSheet?.sectionId,
        includeTemporary: "only",
        dojoHandoverPassedOnly: "true",
    }, {
        skip: !sheetMode || !activeSheet?.departmentId,
        refetchOnMountOrArgChange: true
    });

    const { data: machinesData } = useGetMachinesByDepartmentQuery(activeSheet?.departmentId, { skip: !sheetMode || !activeSheet?.departmentId });

    const [deleteHandoverSheet] = useDeleteHandoverSheetMutation();
    const [bulkDeleteHandoverSheets] = useBulkDeleteHandoverSheetsMutation();
    const [logAction] = useLogActionMutation();

    useEffect(() => {
        if (sheetMode) return;
        logAction({
            action: activeTab === 'monitoring' ? 'VIEW_HANDOVER_SHEETS_MONITORING' : 'VIEW_HANDOVER_SHEETS_DASHBOARD',
            details: { subTab: activeTab },
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, sheetMode]);

    const { data: dashData, isFetching: dashFetching } = useGetHandoverSheetsMonitoringQuery({
        departmentId: dashDept,
        sectionId: dashSection,
        shift: dashShift,
        month: dashMonth,
        year: dashYear,
    }, { skip: activeTab !== 'sheets' || !!sheetMode });

    const { data: monitoringData, isFetching: monitorFetching } = useGetHandoverSheetsMonitoringQuery({
        departmentId: monitorDept,
        sectionId: monitorSection,
        shift: monitorShift,
        month: monitorMonth,
        year: monitorYear,
    }, { skip: activeTab !== 'monitoring' });

    const departments = useMemo(() => {
        const rawDepts = deptsData?.data?.departments || [];
        const seen = new Set();
        return rawDepts.filter(d => {
            const id = String(d.id || d._id);
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [deptsData]);
    const createSections = createSectionsData?.data || [];
    const dashSections = dashSectionsData?.data || [];
    const monitorSections = monitorSectionsData?.data || [];
    const activeSheetSections = activeSheetSectionsData?.data || [];
    const students = studentsData?.data?.users || [];
    const machines = machinesData?.data || [];
    const dashRows = dashData?.data || [];
    const monitoringRows = monitoringData?.data || [];

    // ── Permission-filtered department/section lists for creation ───────────
    const assignableDepartments = useMemo(() => {
        const allDepts = departments || [];
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || canAccessAll || assignedIds.length === 0) return allDepts;
        return allDepts.filter(d => assignedIds.includes(String(d.id || d._id)));
    }, [departments, authUser, canAccessAll]);

    const assignableCreateSections = useMemo(() => {
        const allSections = createSections || [];
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || canAccessAll || assignedIds.length === 0) return allSections;
        return allSections.filter(s => assignedIds.includes(String(s.id || s._id)));
    }, [createSections, authUser, canAccessAll]);

    const isRestricted = !canAccessAll && authUser && (
        (authUser.departments?.length > 0) || authUser.departmentId ||
        (authUser.sections?.length > 0) || authUser.sectionId
    );
    const isDeptSelectDisabled = isRestricted && assignableDepartments.length === 1;

    // Keep the Dashboard and Monitoring department filters within the restricted user's
    // assigned departments — mirrors the assignableDepartments gating used for creation above.
    useEffect(() => {
        if (isRestricted && assignableDepartments.length > 0 && !assignableDepartments.some(d => String(d.id || d._id) === dashDept)) {
            setDashDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        }
    }, [isRestricted, assignableDepartments, dashDept]);

    useEffect(() => {
        if (isRestricted && assignableDepartments.length > 0 && !assignableDepartments.some(d => String(d.id || d._id) === monitorDept)) {
            setMonitorDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        }
    }, [isRestricted, assignableDepartments, monitorDept]);

    // Auto-select the single available option when the create dialog opens for a restricted user
    useEffect(() => {
        if (!isCreateOpen || !isRestricted) return;
        if (assignableDepartments.length === 1 && !createDept) {
            setCreateDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        }
    }, [isCreateOpen, isRestricted, assignableDepartments, createDept]);

    useEffect(() => {
        if (!isCreateOpen || !isRestricted) return;
        if (createDept && assignableCreateSections.length === 1 && !createSection) {
            setCreateSection(String(assignableCreateSections[0].id || assignableCreateSections[0]._id));
        }
    }, [isCreateOpen, isRestricted, createDept, assignableCreateSections, createSection]);

    const openCreateDialog = () => {
        setCreateDept("");
        setCreateSection("");
        setCreateShift("");
        setCreateDate(todayStr);
        setIsCreateOpen(true);
    };

    const handleCreateSubmit = () => {
        if (!createDept || !createSection || !createShift || !createDate) {
            toast.error("Please fill in Department, Section, Shift and Date");
            return;
        }
        setActiveSheet({
            id: null,
            departmentId: createDept,
            sectionId: createSection,
            shift: createShift,
            date: createDate,
        });
        setSheetMode('edit');
        setIsCreateOpen(false);
    };

    const openSheet = (row, mode) => {
        setActiveSheet({
            id: row.id,
            departmentId: String(row.departmentId),
            sectionId: row.sectionId ? String(row.sectionId) : "",
            shift: row.shift || "",
            date: row.date ? row.date.split('T')[0] : todayStr,
        });
        setSheetMode(mode);
    };

    const handleRowView = (row) => openSheet(row, 'view');
    const handleRowEdit = (row) => openSheet(row, 'edit');

    const handleBackToList = () => {
        setSheetMode(null);
        setActiveSheet(null);
    };

    const selectedDeptName = useMemo(() => {
        const d = departments.find(d => String(d.id || d._id) === String(activeSheet?.departmentId));
        return d?.name || "";
    }, [departments, activeSheet]);

    const selectedSectionName = useMemo(() => {
        if (!activeSheet?.sectionId || activeSheet.sectionId === "0") return "";
        const s = activeSheetSections.find(s => String(s.id) === String(activeSheet.sectionId));
        return s?.name || "";
    }, [activeSheet, activeSheetSections]);

    const handleDeleteSheet = async (row) => {
        const label = `${row.departmentName || 'this department'} on ${formatDate(row.date)}`;
        if (!window.confirm(`Are you sure you want to delete the handover sheet for ${label}? This action cannot be undone.`)) return;
        try {
            await deleteHandoverSheet(row.id).unwrap();
            toast.success("Handover sheet deleted successfully");
            logAction({
                action: 'DELETE_HANDOVER_SHEET',
                details: { handoverSheetId: row.id, departmentName: row.departmentName, date: row.date },
            }).catch(() => {});
            setDashSelectedIds(prev => prev.filter(id => id !== row.id));
            setMonitorSelectedIds(prev => prev.filter(id => id !== row.id));
        } catch {
            toast.error("Failed to delete handover sheet");
        }
    };

    const handleBulkDelete = async (ids, clearSelection) => {
        if (ids.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${ids.length} handover sheet${ids.length !== 1 ? 's' : ''}? This action cannot be undone.`)) return;
        try {
            await bulkDeleteHandoverSheets(ids).unwrap();
            toast.success(`${ids.length} handover sheet${ids.length !== 1 ? 's' : ''} deleted successfully`);
            logAction({
                action: 'BULK_DELETE_HANDOVER_SHEETS',
                details: { handoverSheetIds: ids, deletedCount: ids.length },
            }).catch(() => {});
            clearSelection();
        } catch {
            toast.error("Failed to delete selected handover sheets");
        }
    };

    const toggleSelect = (setter) => (id, checked) => {
        setter(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
    };

    const toggleSelectAll = (setter, rows) => (checked) => {
        setter(checked ? rows.map(r => r.id) : []);
    };

    return (
        <div className="space-y-6 w-full max-w-7xl mx-auto pb-20 p-4 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                        <IconClipboardList className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Handover Sheet</h1>
                        <p className="text-sm text-slate-500 font-medium">List of Employees Handed Over to Shop Floor After Induction Training</p>
                    </div>
                </div>
                {sheetMode && (
                    <Button variant="outline" onClick={handleBackToList} className="gap-2">
                        <IconArrowLeft className="w-4 h-4" />
                        Back to Sheets List
                    </Button>
                )}
            </div>

            {sheetMode && activeSheet ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <HandoverSheet
                        departmentId={activeSheet.departmentId}
                        sectionId={activeSheet.sectionId === "0" || !activeSheet.sectionId ? null : activeSheet.sectionId}
                        setSectionId={(sId) => setActiveSheet(prev => prev ? { ...prev, sectionId: sId || "" } : null)}
                        sheetId={activeSheet.id}
                        shift={activeSheet.shift}
                        viewOnly={sheetMode === 'view'}
                        students={students}
                        departmentName={selectedDeptName}
                        sectionName={selectedSectionName}
                        instructorName={authUser?.fullName}
                        departments={departments}
                        machines={machines}
                        dojoHandoverPassedOnly={true}
                        date={activeSheet.date}
                        setDate={(d) => setActiveSheet(prev => ({ ...prev, date: d }))}
                    />
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-slate-100 p-1 rounded-xl h-auto">
                        <TabsTrigger value="sheets" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <IconClipboardList className="w-4 h-4" />
                            Handover Sheets
                        </TabsTrigger>
                        <TabsTrigger value="monitoring" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <IconChartBar className="w-4 h-4" />
                            Monitoring
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab 1: Sheets Dashboard ─────────────────────────────── */}
                    <TabsContent value="sheets" className="space-y-6 mt-4">
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-base flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <IconHierarchy2 className="w-4 h-4 text-blue-600" />
                                        Filters
                                    </span>
                                    {canManage && (
                                        <Button size="sm" onClick={openCreateDialog} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                                            <IconPlus className="w-4 h-4" />
                                            Create Handover Sheet
                                        </Button>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                                        <Select
                                            value={dashDept}
                                            onValueChange={(val) => { setDashDept(val); setDashSection('all'); }}
                                            disabled={isDeptSelectDisabled}
                                        >
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="All Departments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!isRestricted && (
                                                    <SelectItem value="all">All Departments</SelectItem>
                                                )}
                                                {assignableDepartments.map((d) => (
                                                    <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Section</Label>
                                        <Select value={dashSection} onValueChange={setDashSection} disabled={dashDept === 'all'}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50">
                                                <SelectValue placeholder="All Sections" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Sections</SelectItem>
                                                {dashSections.map((s) => (
                                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Shift</Label>
                                        <Select value={dashShift} onValueChange={setDashShift}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="All Shifts" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Shifts</SelectItem>
                                                {SHIFTS.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Month</Label>
                                        <Select value={dashMonth} onValueChange={setDashMonth}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Months</SelectItem>
                                                {MONTHS.map((m, i) => (
                                                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Year</Label>
                                        <Select value={dashYear} onValueChange={setDashYear}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Years</SelectItem>
                                                {YEARS.map((y) => (
                                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-base flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <IconClipboardList className="w-4 h-4 text-blue-600" />
                                        Handover Sheets
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {canDelete && dashSelectedIds.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleBulkDelete(dashSelectedIds, () => setDashSelectedIds([]))}
                                                className="h-7 px-3 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                            >
                                                <IconTrash className="w-3.5 h-3.5" />
                                                Delete Selected ({dashSelectedIds.length})
                                            </Button>
                                        )}
                                        <span className="text-xs font-normal text-slate-500">
                                            {dashFetching ? 'Loading...' : `${dashRows.length} record${dashRows.length !== 1 ? 's' : ''}`}
                                        </span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <HandoverSheetsTable
                                    rows={dashRows}
                                    loading={dashFetching}
                                    selectedIds={dashSelectedIds}
                                    onToggleSelect={toggleSelect(setDashSelectedIds)}
                                    onToggleSelectAll={toggleSelectAll(setDashSelectedIds, dashRows)}
                                    onRowClick={handleRowView}
                                    onEdit={handleRowEdit}
                                    onDelete={handleDeleteSheet}
                                    canManage={canManage}
                                    canDelete={canDelete}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Tab 2: Monitoring ────────────────────────────────────── */}
                    <TabsContent value="monitoring" className="space-y-6 mt-4">
                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <IconChartBar className="w-4 h-4 text-blue-600" />
                                    Filters
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                                        <Select
                                            value={monitorDept}
                                            onValueChange={(val) => { setMonitorDept(val); setMonitorSection('all'); }}
                                            disabled={isDeptSelectDisabled}
                                        >
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="All Departments" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {!isRestricted && (
                                                    <SelectItem value="all">All Departments</SelectItem>
                                                )}
                                                {assignableDepartments.map((d) => (
                                                    <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Section</Label>
                                        <Select value={monitorSection} onValueChange={setMonitorSection} disabled={monitorDept === 'all'}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50">
                                                <SelectValue placeholder="All Sections" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Sections</SelectItem>
                                                {monitorSections.map((s) => (
                                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Shift</Label>
                                        <Select value={monitorShift} onValueChange={setMonitorShift}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="All Shifts" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Shifts</SelectItem>
                                                {SHIFTS.map((s) => (
                                                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Month</Label>
                                        <Select value={monitorMonth} onValueChange={setMonitorMonth}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="All Months" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Months</SelectItem>
                                                {MONTHS.map((m, i) => (
                                                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-500 uppercase">Year</Label>
                                        <Select value={monitorYear} onValueChange={setMonitorYear}>
                                            <SelectTrigger className="h-10 bg-white border-slate-200">
                                                <SelectValue placeholder="All Years" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Years</SelectItem>
                                                {YEARS.map((y) => (
                                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-base flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <IconClipboardList className="w-4 h-4 text-blue-600" />
                                        Handover Sheets
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {canDelete && monitorSelectedIds.length > 0 && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleBulkDelete(monitorSelectedIds, () => setMonitorSelectedIds([]))}
                                                className="h-7 px-3 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                            >
                                                <IconTrash className="w-3.5 h-3.5" />
                                                Delete Selected ({monitorSelectedIds.length})
                                            </Button>
                                        )}
                                        <span className="text-xs font-normal text-slate-500">
                                            {monitorFetching ? 'Loading...' : `${monitoringRows.length} record${monitoringRows.length !== 1 ? 's' : ''}`}
                                        </span>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <HandoverSheetsTable
                                    rows={monitoringRows}
                                    loading={monitorFetching}
                                    selectedIds={monitorSelectedIds}
                                    onToggleSelect={toggleSelect(setMonitorSelectedIds)}
                                    onToggleSelectAll={toggleSelectAll(setMonitorSelectedIds, monitoringRows)}
                                    onRowClick={handleRowView}
                                    onEdit={handleRowEdit}
                                    onDelete={handleDeleteSheet}
                                    canManage={canManage}
                                    canDelete={canDelete}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {/* Create Handover Sheet Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create Handover Sheet</DialogTitle>
                        <DialogDescription>
                            Choose the department, section, shift and date for the new handover sheet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                            <Select
                                value={createDept}
                                onValueChange={(val) => { setCreateDept(val); setCreateSection(""); }}
                                disabled={isDeptSelectDisabled}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((d) => (
                                        <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Section</Label>
                            <Select
                                value={createSection}
                                onValueChange={setCreateSection}
                                disabled={!createDept || (isRestricted && assignableCreateSections.length <= 1)}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableCreateSections.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.category})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Shift</Label>
                            <Select value={createShift} onValueChange={setCreateShift}>
                                <SelectTrigger className="h-10 bg-white border-slate-200">
                                    <SelectValue placeholder="Select Shift" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SHIFTS.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Date</Label>
                            <input
                                type="date"
                                value={createDate}
                                min={todayStr}
                                max={todayStr}
                                onChange={(e) => setCreateDate(e.target.value)}
                                className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateSubmit} className="bg-blue-600 hover:bg-blue-700">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default HandoverSheetPage;
