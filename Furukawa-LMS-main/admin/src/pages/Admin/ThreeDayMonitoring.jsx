import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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
import { useGetAllStudentsQuery, useGetInstructorByIdQuery } from '@/Redux/AllApi/InstructorApi';
import { IconCalendarCheck, IconUser, IconHierarchy2, IconChevronLeft, IconChevronRight, IconInfoCircle, IconSearch, IconUsersGroup } from "@tabler/icons-react";
import ThreeDayMonitoringSheet from '@/components/admin/ThreeDayMonitoringSheet';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ThreeDayMonitoring = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    // A user is a subject (employee) if they are explicitly marked as such OR don't have global admin rights
    const { isEmployee, hasManagePermission } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        const managePerm = permissions.includes('three_day:manage') || permissions.includes('sixteen_day:manage');
        const editLayoutPerm = permissions.includes('three_day:edit_layout') || permissions.includes('sixteen_day:edit_layout');
        
        // Classified as a subject (Employee/Trainee) if:
        // 1. Explicitly flagged as employee
        // 2. Is a student
        // 3. Is a custom role with 'operator' layout
        // 4. Is a custom role with no specific management permissions AND not an admin/trainer layout
        const isSubject = authUser?.isEmployee || 
                         authUser?.role === 'STUDENT' || 
                         (authUser?.role === 'CUSTOM' && authUser.customRole?.targetLayout === 'operator') ||
                         (authUser?.role === 'CUSTOM' && !editLayoutPerm && !managePerm && !isAdmin && 
                          authUser.customRole?.targetLayout !== 'admin' && authUser.customRole?.targetLayout !== 'trainer');
                         
        return { 
            isEmployee: isSubject,
            hasManagePermission: managePerm || isAdmin
        };
    }, [authUser, isAdmin]);

    // Freeze hierarchy if the user is a staff member restricted to their own area
    const isSelectionLocked = useMemo(() => {
        if (isAdmin) return false;
        // If they have manage permission but aren't a global admin, we lock to their profile assignment
        return authUser?.role === 'CUSTOM' && hasManagePermission;
    }, [authUser, isAdmin, hasManagePermission]);

    const { studentId: paramStudentId } = useParams();
    
    // Selections
    const [dept, setDept] = useState("");
    const [section, setSection] = useState("");
    const [line, setLine] = useState("");
    const [studentId, setStudentId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    // Deep Linking: Fetch student data directly if param is present
    const { data: paramStudentData } = useGetInstructorByIdQuery(paramStudentId, { skip: !paramStudentId });

    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    const { data: linesData } = useGetLinesBySectionQuery(section, { skip: !section || section === "0" });

    // Fetch students based on Section/Line
    const { data: studentsData, isFetching: isFetchingStudents } = useGetAllStudentsQuery({
        departmentId: dept,
        sectionId: section === "0" ? "" : section,
        lineId: line,
        limit: 100
    }, { 
        // Skip only if no Dept is selected AND user isn't an employee
        skip: !dept && !isEmployee,
        refetchOnMountOrArgChange: true 
    });

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const lines = linesData?.data || [];
    const students = studentsData?.data?.users || [];

    // Filter students based on search term
    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        const lowSearch = searchTerm.toLowerCase();
        return students.filter(s => 
            s.fullName?.toLowerCase().includes(lowSearch) || 
            s.empId?.toLowerCase().includes(lowSearch)
        );
    }, [students, searchTerm]);

    // Filter departments based on user assignment for instructors
    const assignableDepartments = useMemo(() => {
        if (!authUser) return [];
        const allDepts = departments || [];
        const assignedIds = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) assignedIds.push(authUser.departmentId);
        
        if (isAdmin && assignedIds.length === 0) return allDepts;
        
        return allDepts.filter(d =>
            assignedIds.includes(d.id) || assignedIds.includes(d._id)
        );
    }, [departments, authUser, isAdmin]);

    // Role-based Initialization & Auto-select
    useEffect(() => {
        if (!authUser) return;

        // 1. Handle URL Param Auto-Selection & Hierarchy Resolution
        if (paramStudentId && !studentId) {
            setStudentId(paramStudentId);
            
            // If we have the student's data from the direct fetch, set their hierarchy too
            if (paramStudentData?.data) {
                const s = paramStudentData.data;
                if (s.departmentId) setDept(String(s.departmentId));
                if (s.sectionId) setSection(String(s.sectionId));
                if (s.lineId) setLine(String(s.lineId));
            }
            return;
        }

        // Also update hierarchy if it was missing but now loaded from the hook
        if (paramStudentId && studentId === paramStudentId && !dept && paramStudentData?.data) {
            const s = paramStudentData.data;
            if (s.departmentId) setDept(String(s.departmentId));
            if (s.sectionId) setSection(String(s.sectionId));
            if (s.lineId) setLine(String(s.lineId));
        }

        // 2. Handle Employee (Subject) Auto-Selection
        if (isEmployee) {
            setStudentId(authUser.id || authUser._id || "");
            if (authUser.departmentId) setDept(authUser.departmentId);
            if (authUser.sectionId) setSection(authUser.sectionId);
            if (authUser.lineId) setLine(authUser.lineId);
            return;
        }

        // 3. Handle Staff Area Freezing / Initialization
        if (isSelectionLocked) {
            if (authUser.departmentId) {
                setDept(authUser.departmentId);
            } else if (assignableDepartments.length === 1 && !dept) {
                setDept(assignableDepartments[0].id || assignableDepartments[0]._id);
            }
            if (authUser.sectionId) setSection(authUser.sectionId);
            if (authUser.lineId) setLine(authUser.lineId);
        } else if (assignableDepartments.length === 1 && !dept) {
            setDept(assignableDepartments[0].id || assignableDepartments[0]._id);
        }
    }, [isEmployee, isSelectionLocked, authUser, assignableDepartments, paramStudentId, studentId, paramStudentData]);

    const selectedStudent = useMemo(() => {
        const student = students.find(s => String(s._id || s.id) === String(studentId));
        // If they are an employee and we couldn't find them in the list (or list hasn't loaded), 
        // fallback to the authUser profile itself.
        if (!student && isEmployee && String(authUser?._id || authUser?.id) === String(studentId)) {
            return {
                ...authUser,
                deptName: authUser.department?.name || authUser.deptName
            };
        }
        return student;
    }, [students, studentId, isEmployee, authUser]);

    const activeSectionName = useMemo(() => {
        if (!section || section === "0") return selectedStudent?.sectionName || "";
        const s = sections.find(s => String(s.id) === String(section));
        return s?.name || selectedStudent?.sectionName || "";
    }, [sections, section, selectedStudent]);

    const searchedOperators = useMemo(() => {
        if (!searchTerm) return filteredStudents;
        return filteredStudents.filter(s => 
            s.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.empId?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [filteredStudents, searchTerm]);

    // Calculate if user can edit configuration
    const canEditConfig = useMemo(() => {
        // Superadmins and Admins have full access
        if (authUser?.role === 'SUPERADMIN' || authUser?.isAdmin) return true;
        
        // Custom roles: check for functional permission or write access on the page
        if (authUser?.role === 'CUSTOM' && authUser?.customRole) {
            const permissions = authUser.customRole.permissions || [];
            if (permissions.includes('three_day:edit_layout')) return true;
            
            const pagePermission = authUser.customRole.allowedPages?.find(p => p.key === '3-day-monitoring');
            return pagePermission && pagePermission.write === true;
        }
        return false;
    }, [authUser]);

    // Horizontal Scroll Ref for Operator Tray
    const trayRef = useRef(null);
    const scrollTray = (direction) => {
        if (trayRef.current) {
            const scrollAmount = direction === 'left' ? -200 : 200;
            trayRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <div className="space-y-6 w-full max-w-none mx-auto pb-20 p-4 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-600 rounded-xl shadow-lg shadow-amber-200">
                        <IconCalendarCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">3-Day Monitoring</h1>
                        <p className="text-sm text-slate-500 font-medium">Initial performance monitoring and alignment</p>
                    </div>
                </div>
            </div>

            {/* Selection/Info Panel */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2">
                        <IconHierarchy2 className="w-4 h-4 text-amber-600" />
                        {isEmployee ? "Your Assignment Information" : "Selection Hierarchy"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {isEmployee ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</span>
                                <span className="text-sm font-semibold text-slate-700">{selectedStudent?.deptName || authUser?.department?.name || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section</span>
                                <span className="text-sm font-semibold text-slate-700">{activeSectionName || "N/A"}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Line</span>
                                <span className="text-sm font-semibold text-slate-700">{selectedStudent?.lineName || "N/A"}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Department</Label>
                                <Select 
                                    value={String(dept)} 
                                    onValueChange={(val) => { setDept(val); setSection(""); setLine(""); setStudentId(""); }}
                                    disabled={isSelectionLocked && !!authUser?.departmentId}
                                >
                                    <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50"><SelectValue placeholder="Select Dept" /></SelectTrigger>
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
                                    <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50"><SelectValue placeholder="Select Section" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">All Sections</SelectItem>
                                        {sections.map((s) => (
                                            <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.category})</SelectItem>
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
                                    <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50"><SelectValue placeholder="Select Line" /></SelectTrigger>
                                    <SelectContent>
                                        {lines.map((l) => (
                                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-500 uppercase">Operator</Label>
                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            className="w-full h-10 justify-between bg-white border-slate-200 px-3 font-normal disabled:opacity-80 disabled:bg-slate-50"
                                            disabled={!dept}
                                        >
                                            <span className="flex items-center gap-2 truncate text-slate-700">
                                                <IconUser size={14} className="text-slate-400" />
                                                {selectedStudent ? (
                                                    <span className="font-semibold">{selectedStudent.fullName} ({selectedStudent.empId})</span>
                                                ) : "Select Operator"}
                                            </span>
                                            <IconChevronRight size={14} className="text-slate-400 rotate-90" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[400px] p-0 z-[9999]" align="start">
                                        <div className="p-3 border-b bg-slate-50/50">
                                            <div className="relative">
                                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <Input 
                                                    placeholder="Search name or ID..." 
                                                    className="pl-9 h-9 text-xs bg-white border-slate-200 focus-visible:ring-amber-500"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto p-0">
                                            <Table>
                                                <TableHeader className="bg-slate-50/30 sticky top-0 z-10">
                                                    <TableRow className="hover:bg-transparent border-slate-200 h-8">
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pl-3">Operator</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ID</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right pr-3">Action</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {searchedOperators.length > 0 ? searchedOperators.map((s) => (
                                                        <TableRow 
                                                            key={s._id || s.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setStudentId(s._id || s.id);
                                                                setIsPopoverOpen(false);
                                                            }}
                                                            className={cn(
                                                                "cursor-pointer transition-colors h-11",
                                                                studentId === (s._id || s.id) ? "bg-amber-50/80" : "hover:bg-slate-50/50"
                                                            )}
                                                        >
                                                            <TableCell className="pl-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-6 w-6 border border-white shadow-sm">
                                                                        <AvatarFallback className="text-[8px] font-bold bg-slate-100 text-slate-500">
                                                                            {s.fullName?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{s.fullName}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="text-[9px] font-mono py-0 px-1 border-slate-200">#{s.empId}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right pr-3">
                                                                {studentId === (s._id || s.id) ? (
                                                                    <Badge className="bg-amber-600 text-white border-none text-[8px] h-4">Active</Badge>
                                                                ) : (
                                                                    <span className="text-[10px] text-amber-600 font-bold">Select</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    )) : (
                                                        <TableRow>
                                                            <TableCell colSpan={3} className="h-20 text-center text-xs text-slate-400 font-medium">
                                                                No operators found
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Selection Status Messages */}
            {!isEmployee && dept && !studentId && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <IconInfoCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="text-sm font-bold text-amber-800">Assign Selection</h4>
                        <p className="text-xs text-amber-700/80 leading-relaxed max-w-2xl">
                            Please select an operator from the dropdown hierarchy above to view or track their 3-day monitoring check-sheet.
                        </p>
                    </div>
                </div>
            )}

            {/* Monitoring Sheet Area */}
            {dept ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ThreeDayMonitoringSheet 
                        studentId={studentId}
                        departmentId={dept}
                        departmentName={selectedStudent?.deptName || selectedStudent?.department?.name}
                        sectionName={activeSectionName}
                        readOnly={isEmployee && (String(authUser?._id || authUser?.id) !== String(studentId))}
                        canEditConfig={canEditConfig}
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconHierarchy2 className="w-16 h-16 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Select Department</h3>
                    <p className="text-sm text-slate-500 max-w-xs text-center mt-2 leading-relaxed">
                        Choose a department to view and manage its 3-day monitoring check-sheet configuration.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ThreeDayMonitoring;
