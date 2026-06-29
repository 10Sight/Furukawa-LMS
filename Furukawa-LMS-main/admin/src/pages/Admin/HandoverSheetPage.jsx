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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGetAllDepartmentsQuery, useGetHandoverSheetsMonitoringQuery, useDeleteHandoverSheetMutation } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import {
    IconClipboardList,
    IconHierarchy2,
    IconAlertTriangle,
    IconChartBar,
    IconEye,
    IconUsers,
    IconPencil,
    IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useGetMachinesByDepartmentQuery } from '@/Redux/AllApi/MachineApi';
import HandoverSheet from '@/components/departments/HandoverSheet';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2023 }, (_, i) => String(currentYear - i));

const HandoverSheetPage = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const hasHandoverBypass = authUser?.customRole?.permissions?.includes('dojo:handover_sheet');
    const canAccessAll = isAdmin || hasHandoverBypass;
    const hasReadPermission = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:read') || hasHandoverBypass;
    const canDelete = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:delete');

    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('sheet');

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

    // ── Sheet tab state ──────────────────────────────────────────────────────
    const [dept, setDept] = useState(searchParams.get('dept') || "");
    const [section, setSection] = useState(searchParams.get('section') || "");
    const [date, setDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const params = {};
        if (dept) params.dept = dept;
        if (section) params.section = section;
        if (date) params.date = date;
        setSearchParams(params, { replace: true });
    }, [dept, section, date, setSearchParams]);

    // ── Monitoring tab state ─────────────────────────────────────────────────
    const [monitorDept, setMonitorDept] = useState('all');
    const [monitorSection, setMonitorSection] = useState('all');
    const [monitorMonth, setMonitorMonth] = useState('all');
    const [monitorYear, setMonitorYear] = useState('all');

    // ── Shared API data ──────────────────────────────────────────────────────
    const { data: deptsData } = useGetAllDepartmentsQuery({ limit: 500 });
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    const { data: monitorSectionsData } = useGetSectionsByDepartmentQuery(
        monitorDept,
        { skip: !monitorDept || monitorDept === 'all' }
    );

    const { data: studentsData } = useGetAllStudentsQuery({
        departmentId: dept,
        sectionId: section === "0" ? "" : section,
        includeTemporary: "only",
        dojoHandoverPassedOnly: "true",
    }, {
        skip: !dept,
        refetchOnMountOrArgChange: true
    });

    const { data: machinesData } = useGetMachinesByDepartmentQuery(dept, { skip: !dept });

    const [deleteHandoverSheet] = useDeleteHandoverSheetMutation();

    const { data: monitoringData, isFetching: monitorFetching } = useGetHandoverSheetsMonitoringQuery({
        departmentId: monitorDept,
        sectionId: monitorSection,
        month: monitorMonth,
        year: monitorYear,
    }, { skip: activeTab !== 'monitoring' });

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const monitorSections = monitorSectionsData?.data || [];
    const students = studentsData?.data?.users || [];
    const machines = machinesData?.data || [];
    const monitoringRows = monitoringData?.data || [];

    // ── Permission-filtered lists for the sheet tab ──────────────────────────
    const assignableDepartments = useMemo(() => {
        const allDepts = departments || [];
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || canAccessAll || assignedIds.length === 0) return allDepts;
        return allDepts.filter(d => assignedIds.includes(String(d.id || d._id)));
    }, [departments, authUser, canAccessAll]);

    const assignableSections = useMemo(() => {
        const allSections = sections || [];
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || canAccessAll || assignedIds.length === 0) return allSections;
        return allSections.filter(s => assignedIds.includes(String(s.id || s._id)));
    }, [sections, authUser, canAccessAll]);

    const isRestricted = !canAccessAll && authUser && (
        (authUser.departments?.length > 0) || authUser.departmentId ||
        (authUser.sections?.length > 0) || authUser.sectionId
    );

    useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length === 1 && !dept) {
            setDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        }
        if (dept && assignableSections.length === 1 && !section) {
            setSection(String(assignableSections[0].id || assignableSections[0]._id));
        }
    }, [isRestricted, assignableDepartments, assignableSections, dept, section]);

    const selectedDeptName = useMemo(() => {
        const d = departments.find(d => String(d.id || d._id) === String(dept));
        return d?.name || "";
    }, [departments, dept]);

    const selectedSectionName = useMemo(() => {
        if (!section || section === "0") return "";
        const s = sections.find(s => String(s.id) === String(section));
        return s?.name || "";
    }, [sections, section]);

    // ── "View/Edit" action: jump to sheet tab with pre-filled selection ─────
    const handleViewSheet = (row) => {
        setDept(String(row.departmentId));
        setSection(row.sectionId ? String(row.sectionId) : "");
        setDate(row.date ? row.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setActiveTab('sheet');
    };

    const handleDeleteSheet = async (row) => {
        const label = `${row.departmentName || 'this department'} on ${formatDate(row.date)}`;
        if (!window.confirm(`Are you sure you want to delete the handover sheet for ${label}? This action cannot be undone.`)) return;
        try {
            await deleteHandoverSheet(row.id).unwrap();
            toast.success("Handover sheet deleted successfully");
        } catch {
            toast.error("Failed to delete handover sheet");
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-100 p-1 rounded-xl h-auto">
                    <TabsTrigger value="sheet" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <IconClipboardList className="w-4 h-4" />
                        Handover Sheet
                    </TabsTrigger>
                    <TabsTrigger value="monitoring" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <IconChartBar className="w-4 h-4" />
                        Monitoring
                    </TabsTrigger>
                </TabsList>

                {/* ── Tab 1: Handover Sheet ────────────────────────────────── */}
                <TabsContent value="sheet" className="space-y-6 mt-4">
                    <Card className="border-slate-200 shadow-sm overflow-hidden no-print">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <IconHierarchy2 className="w-4 h-4 text-blue-600" />
                                Selection Hierarchy
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                                    <Select
                                        value={String(dept)}
                                        onValueChange={(val) => { setDept(val); setSection(""); }}
                                        disabled={isRestricted && assignableDepartments.length <= 1}
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
                                        value={String(section)}
                                        onValueChange={(val) => setSection(val)}
                                        disabled={!dept || (isRestricted && assignableSections.length <= 1)}
                                    >
                                        <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50">
                                            <SelectValue placeholder="Select Section" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {assignableSections.map((s) => (
                                                <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.category})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {dept && section && section !== "0" ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <HandoverSheet
                                departmentId={dept}
                                sectionId={section === "0" ? null : section}
                                students={students}
                                departmentName={selectedDeptName}
                                sectionName={selectedSectionName}
                                instructorName={authUser?.fullName}
                                departments={departments}
                                machines={machines}
                                dojoHandoverPassedOnly={true}
                                date={date}
                                setDate={setDate}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                                <IconHierarchy2 className="w-16 h-16 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">Select Department and Section</h3>
                            <p className="text-sm text-slate-500 max-w-xs text-center mt-2 leading-relaxed">
                                Choose a department and section to view and manage its handover sheet records.
                            </p>
                        </div>
                    )}
                </TabsContent>

                {/* ── Tab 2: Monitoring ────────────────────────────────────── */}
                <TabsContent value="monitoring" className="space-y-6 mt-4">
                    {/* Filter Bar */}
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <IconChartBar className="w-4 h-4 text-blue-600" />
                                Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Department */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                                    <Select
                                        value={monitorDept}
                                        onValueChange={(val) => { setMonitorDept(val); setMonitorSection('all'); }}
                                    >
                                        <SelectTrigger className="h-10 bg-white border-slate-200">
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departments.map((d) => (
                                                <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Section */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-500 uppercase">Section</Label>
                                    <Select
                                        value={monitorSection}
                                        onValueChange={setMonitorSection}
                                        disabled={monitorDept === 'all'}
                                    >
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

                                {/* Month */}
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

                                {/* Year */}
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

                    {/* Results Table */}
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-base flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                    <IconClipboardList className="w-4 h-4 text-blue-600" />
                                    Handover Sheets
                                </span>
                                <span className="text-xs font-normal text-slate-500">
                                    {monitorFetching ? 'Loading...' : `${monitoringRows.length} record${monitoringRows.length !== 1 ? 's' : ''}`}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {monitorFetching ? (
                                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                                    Loading handover sheets...
                                </div>
                            ) : monitoringRows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                                        <IconClipboardList className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">No handover sheets found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-slate-50/70">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                                    <span className="flex items-center justify-center gap-1">
                                                        <IconUsers className="w-3.5 h-3.5" />
                                                        Trainees
                                                    </span>
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Created / Updated By</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {monitoringRows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    onClick={() => handleViewSheet(row)}
                                                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                                                >
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
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                                                            {row.entriesCount ?? 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-slate-700 text-xs leading-relaxed">
                                                            {row.createdBy && <div><span className="text-slate-400">By </span>{row.createdBy}</div>}
                                                            {row.updatedBy && row.updatedBy !== row.createdBy && (
                                                                <div><span className="text-slate-400">Upd </span>{row.updatedBy}</div>
                                                            )}
                                                        </div>
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
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleViewSheet(row)}
                                                                className="h-7 px-3 text-xs gap-1.5 border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                                                            >
                                                                <IconPencil className="w-3.5 h-3.5" />
                                                                Edit
                                                            </Button>
                                                            {canDelete && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleDeleteSheet(row)}
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
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default HandoverSheetPage;
