import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetLinesBySectionQuery } from '@/Redux/AllApi/LineApi';
import { useGetInstructorByIdQuery } from '@/Redux/AllApi/InstructorApi';
import { 
    IconCalendarStats, 
    IconHierarchy2, 
    IconSearch, 
    IconUsersGroup, 
    IconArrowLeft, 
    IconPlus, 
    IconDatabase, 
    IconLayoutDashboard 
} from "@tabler/icons-react";
import ThreeDayMonitoringSheet from '@/components/admin/ThreeDayMonitoringSheet';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import axiosInstance from '@/Helper/axiosInstance';

const EMPTY_ARRAY = [];
const ThreeDayMonitoring = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    // Permissions logic
    const { isEmployee, hasManagePermission, canEditLayout } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        const managePerm = permissions.includes('three_day:manage') ||
            permissions.includes('three_day:edit') ||
            permissions.includes('three_day:edit_submitted') ||
            isAdmin;
        const editLayoutPerm = permissions.includes('three_day:edit_layout') || isAdmin;

        const isSubject = authUser?.role === 'STUDENT' ||
            (authUser?.role === 'CUSTOM' && authUser.customRole?.targetLayout === 'operator') ||
            (authUser?.role !== 'CUSTOM' && authUser?.role !== 'ADMIN' && authUser?.role !== 'SUPERADMIN' && authUser?.role !== 'INSTRUCTOR' && authUser?.isEmployee);

        return {
            isEmployee: isSubject,
            hasManagePermission: managePerm,
            canEditLayout: editLayoutPerm
        };
    }, [authUser, isAdmin]);

    // Mode selection: 'stack' or 'layout'
    const [activeTab, setActiveTab] = useState('stack');

    const { studentId: paramStudentId } = useParams();

    // Selections
    const [dept, setDept] = useState("");
    const [section, setSection] = useState("");
    const [line, setLine] = useState("");
    const [studentId, setStudentId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [forceNewAttempt, setForceNewAttempt] = useState(false);

    // Monitoring Status List
    const [monitoringList, setMonitoringList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [monitoringPage, setMonitoringPage] = useState(1);
    const [monitoringTotalPages, setMonitoringTotalPages] = useState(1);
    const monitoringPageSize = 30;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Freeze hierarchy if the user is a staff member restricted to their own area
    const isSelectionLocked = useMemo(() => {
        if (isAdmin) return false;
        return authUser?.role === 'CUSTOM' && hasManagePermission;
    }, [authUser, isAdmin, hasManagePermission]);

    // Deep Linking
    const { data: paramStudentData } = useGetInstructorByIdQuery(paramStudentId, { skip: !paramStudentId });

    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    const { data: linesData } = useGetLinesBySectionQuery(section, { skip: !section || section === "0" });

    const departments = deptsData?.data?.departments || EMPTY_ARRAY;
    const sections = sectionsData?.data || EMPTY_ARRAY;
    const lines = linesData?.data || EMPTY_ARRAY;

    // Filter departments based on user assignment
    const assignableDepartments = useMemo(() => {
        if (!authUser) return EMPTY_ARRAY;
        const allDepts = departments;
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);

        if (isAdmin && assignedIds.length === 0) return allDepts;

        return allDepts.filter(d =>
            assignedIds.includes(String(d.id || d._id))
        );
    }, [departments, authUser, isAdmin]);

    // Fetch Monitoring Status List
    const fetchMonitoringList = async () => {
        if (!dept || activeTab !== 'stack' || studentId) return;
        try {
            setLoadingList(true);
            const res = await axiosInstance.get(`/api/three-day-monitoring`, {
                params: {
                    departmentId: dept,
                    sectionId: section,
                    lineId: line,
                    page: monitoringPage,
                    limit: monitoringPageSize,
                    search: debouncedSearchTerm || undefined
                }
            });
            if (res.data.success) {
                setMonitoringList(res.data.data.list || []);
                setMonitoringTotalPages(res.data.data.totalPages || 1);
            }
        } catch (error) {
            console.error("Error fetching monitoring list:", error);
        } finally {
            setLoadingList(false);
        }
    };

    useEffect(() => {
        if (dept && !studentId && activeTab === 'stack') {
            fetchMonitoringList();
        }
    }, [dept, section, line, studentId, activeTab, monitoringPage, debouncedSearchTerm]);

    useEffect(() => {
        setMonitoringPage(1);
    }, [dept, section, line, debouncedSearchTerm]);

    // Role-based Initialization & Auto-select
    useEffect(() => {
        if (!authUser) return;

        if (paramStudentId && !studentId) {
            setStudentId(paramStudentId);
            if (paramStudentData?.data) {
                const s = paramStudentData.data;
                if (s.departmentId) setDept(String(s.departmentId));
                if (s.sectionId) setSection(String(s.sectionId));
                if (s.lineId) setLine(String(s.lineId));
            }
            return;
        }

        if (isEmployee) {
            setStudentId(authUser.id || authUser._id || "");
            if (authUser.departmentId) setDept(authUser.departmentId);
            if (authUser.sectionId) setSection(authUser.sectionId);
            if (authUser.lineId) setLine(authUser.lineId);
            return;
        }

        if (isSelectionLocked) {
            if (authUser.departmentId) setDept(authUser.departmentId);
            if (authUser.sectionId) setSection(authUser.sectionId);
            if (authUser.lineId) setLine(authUser.lineId);
        } else if (assignableDepartments.length === 1 && !dept) {
            setDept(assignableDepartments[0].id || assignableDepartments[0]._id);
        }
    }, [isEmployee, isSelectionLocked, authUser, assignableDepartments, paramStudentId, studentId, paramStudentData]);

    const selectedStudent = useMemo(() => {
        const student = monitoringList.find(s => String(s._id || s.id) === String(studentId));
        if (!student && isEmployee && String(authUser?._id || authUser?.id) === String(studentId)) {
            return {
                ...authUser,
                fullName: authUser.fullName || authUser.name,
                empId: authUser.empId,
                deptName: authUser.department?.name || authUser.deptName
            };
        }
        return student;
    }, [monitoringList, studentId, isEmployee, authUser]);

    const getStatusBadge = (status, verifiedBy, approvedBy) => {
        if (!status || status === 'Draft') return { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200' };
        if (verifiedBy?.includes('Rejected') || approvedBy?.includes('Rejected')) {
            return { label: 'Rejected', color: 'bg-red-100 text-red-600 border-red-200' };
        }
        if (approvedBy?.includes('Approved')) return { label: 'Approved', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' };
        if (status === 'Submitted') return { label: 'Submitted', color: 'bg-blue-100 text-blue-600 border-blue-200' };
        return { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
    };

    return (
        <div className="space-y-6 w-max min-w-full max-w-none mx-auto pb-20 p-4 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500 rounded-xl shadow-lg shadow-amber-100">
                        <IconCalendarStats className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">3-Day Monitoring</h1>
                        <p className="text-sm text-slate-500 font-medium">Monitoring workflow and layout management</p>
                    </div>
                </div>

                <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200 shadow-inner">
                    <button
                        onClick={() => { setActiveTab('stack'); setStudentId(""); }}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all rounded-lg",
                            activeTab === 'stack' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                    >
                        <IconDatabase size={18} />
                        Monitoring Stack
                    </button>
                    {(isAdmin || hasManagePermission) && (
                        <button
                            onClick={() => { setActiveTab('layout'); setStudentId(""); }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all rounded-lg",
                                activeTab === 'layout' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <IconLayoutDashboard size={18} />
                            Layout Management
                        </button>
                    )}
                </div>
            </div>

            {/* Selection Panel */}
            <Card className="border-slate-200 shadow-sm overflow-hidden w-max min-w-full">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconHierarchy2 className="w-4 h-4 text-amber-500" />
                        {isEmployee ? "Your Assignment Information" : "Selection Hierarchy"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {!isEmployee ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                                <Select
                                    value={String(dept)}
                                    onValueChange={(val) => { setDept(val); setSection(""); setLine(""); setStudentId(""); }}
                                    disabled={isSelectionLocked && !!authUser?.departmentId}
                                >
                                    <SelectTrigger className="h-10 bg-white border-slate-200"><SelectValue placeholder="Select Dept" /></SelectTrigger>
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
                                    onValueChange={(val) => { setSection(val); setLine(""); setStudentId(""); }}
                                    disabled={(!dept && !isSelectionLocked)}
                                >
                                    <SelectTrigger className="h-10 bg-white border-slate-200"><SelectValue placeholder="Select Section" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">All Sections</SelectItem>
                                        {sections.map((s) => (
                                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Line</Label>
                                <Select
                                    value={String(line)}
                                    onValueChange={(val) => { setLine(val); setStudentId(""); }}
                                    disabled={(!section || section === "0") && !isSelectionLocked}
                                >
                                    <SelectTrigger className="h-10 bg-white border-slate-200"><SelectValue placeholder="Select Line" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">All Lines</SelectItem>
                                        {lines.map((l) => (
                                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {activeTab === 'stack' && (
                                <div className="space-y-1.5 flex items-end">
                                    <div className="relative w-full">
                                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <Input 
                                            className="pl-10 h-10 border-slate-200" 
                                            placeholder="Search Operator..." 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                                <span className="text-sm font-semibold text-slate-700">{authUser?.department?.name || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section</span>
                                <span className="text-sm font-semibold text-slate-700">{authUser?.section?.name || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line</span>
                                <span className="text-sm font-semibold text-slate-700">{authUser?.line?.name || "N/A"}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Content Area */}
            {dept ? (
                <div className="space-y-6">
                    {activeTab === 'layout' ? (
                        <ThreeDayMonitoringSheet
                            departmentId={dept}
                            departmentName={assignableDepartments.find(d => String(d.id || d._id) === String(dept))?.name}
                            sectionName={sections.find(s => String(s.id) === String(section))?.name}
                            canEditConfig={canEditLayout}
                        />
                    ) : studentId ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                            {!isEmployee && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mb-2 gap-2 text-slate-600 hover:text-amber-600"
                                    onClick={() => setStudentId("")}
                                >
                                    <IconArrowLeft size={16} />
                                    Back to Stack
                                </Button>
                            )}

                            <ThreeDayMonitoringSheet
                                studentId={studentId}
                                departmentId={dept}
                                departmentName={assignableDepartments.find(d => String(d.id || d._id) === String(dept))?.name}
                                sectionName={sections.find(s => String(s.id) === String(section))?.name}
                                readOnly={isEmployee && (String(authUser?._id || authUser?.id) !== String(studentId))}
                                initialForceNewAttempt={forceNewAttempt}
                            />
                        </div>
                    ) : (
                        <Card className="border-slate-200 shadow-sm overflow-hidden w-max min-w-full">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="border-slate-200 h-12">
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pl-6 w-[300px]">Operator Details</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Monitoring Status</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions By</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Last Update</TableHead>
                                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingList ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-40 text-center text-slate-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                    <span className="text-xs font-medium">Loading operators...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : monitoringList.length > 0 ? (
                                        monitoringList.map((item) => {
                                            const badge = getStatusBadge(item.status, item.verifiedBy, item.approvedBy);
                                            const lastActionBy = item.approvedBy || item.verifiedBy || item.checkedBy || "-";
                                            
                                            return (
                                                <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors border-slate-100 h-16">
                                                    <TableCell className="pl-6">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                                                                <AvatarFallback className="bg-amber-50 text-amber-600 font-bold text-xs">
                                                                    {(item.fullName || item.name)?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-800">{item.fullName || item.name}</span>
                                                                <span className="text-[11px] text-slate-500 font-medium">#{item.empId}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", badge.color)}>
                                                                    {badge.label.toUpperCase()}
                                                                </Badge>
                                                                {item.attemptNumber > 1 && (
                                                                    <span className="text-[10px] font-bold text-amber-600/60 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                                        ATTEMPT #{item.attemptNumber}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {item.rejectedCount > 0 && (
                                                                <div className="flex items-center gap-1">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                                                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">
                                                                        {item.rejectedCount} Historical Rejection{item.rejectedCount > 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium text-slate-600">
                                                        <div className="flex flex-col">
                                                            <span>{lastActionBy}</span>
                                                            {item.attemptNumber > 1 && <span className="text-[9px] text-slate-400 italic">Latest Attempt</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium text-slate-500">
                                                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-2">
                                                            <Button 
                                                                size="sm" 
                                                                variant={item.status ? "outline" : "default"}
                                                                className={cn("h-8 text-xs font-bold", !item.status && "bg-amber-500 hover:bg-amber-600")}
                                                                onClick={() => {
                                                                    setStudentId(String(item.id));
                                                                    setForceNewAttempt(false);
                                                                }}
                                                            >
                                                                {item.status ? "View Latest" : "Start Monitoring"}
                                                            </Button>
                                                            {badge.label.includes("Rejected") && (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="default"
                                                                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                    onClick={() => {
                                                                        setStudentId(String(item.id));
                                                                        setForceNewAttempt(true);
                                                                    }}
                                                                >
                                                                    <IconPlus size={14} className="mr-1" />
                                                                    Start New Attempt
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-40 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <IconUsersGroup className="w-12 h-12 text-slate-200" />
                                                    <span className="text-sm text-slate-400 font-medium">No operators found for selection</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            {!loadingList && monitoringList.length > 0 && (
                                <div className="flex justify-between items-center px-3 py-2 border-t bg-slate-50 text-xs">
                                    <span className="text-slate-500 font-medium">
                                        Page {monitoringPage} of {monitoringTotalPages}
                                    </span>
                                    <div className="flex gap-2 items-center">
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            className="h-7 px-3 border-slate-200"
                                            disabled={monitoringPage <= 1}
                                            onClick={() => setMonitoringPage(p => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            className="h-7 px-3 border-slate-200"
                                            disabled={monitoringPage >= monitoringTotalPages}
                                            onClick={() => setMonitoringPage(p => Math.min(monitoringTotalPages, p + 1))}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconHierarchy2 className="w-16 h-16 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Select Department</h3>
                    <p className="text-sm text-slate-500 max-w-xs text-center mt-2 leading-relaxed">
                        Choose a department to view and manage its monitoring {activeTab === 'layout' ? 'configuration' : 'stack'}.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ThreeDayMonitoring;
