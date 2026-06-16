import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { IconClipboardList, IconHierarchy2, IconInfoCircle, IconUsersGroup, IconAlertTriangle } from "@tabler/icons-react";
import { useGetMachinesByDepartmentQuery } from '@/Redux/AllApi/MachineApi';
import HandoverSheet from '@/components/departments/HandoverSheet';

const HandoverSheetPage = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const hasHandoverBypass = authUser?.customRole?.permissions?.includes('dojo:handover_sheet');
    const canAccessAll = isAdmin || hasHandoverBypass;
    const hasReadPermission = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:read') || hasHandoverBypass;

    const [searchParams, setSearchParams] = useSearchParams();

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

    // Selections
    const [dept, setDept] = useState(searchParams.get('dept') || "");
    const [section, setSection] = useState(searchParams.get('section') || "");

    // Synchronize selections with URL query params
    useEffect(() => {
        const params = {};
        if (dept) params.dept = dept;
        if (section) params.section = section;
        setSearchParams(params, { replace: true });
    }, [dept, section, setSearchParams]);

    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery({ limit: 500 });
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });

    // Fetch students based on Dept / Section for initial population if needed
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

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const students = studentsData?.data?.users || [];
    const machines = machinesData?.data || [];

    // Filter departments based on user assignment
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

    // Auto-select when only one option is available for restricted users
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

            {/* Selection Panel */}
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

            {/* Handover Sheet Area */}
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
        </div>
    );
};

export default HandoverSheetPage;
