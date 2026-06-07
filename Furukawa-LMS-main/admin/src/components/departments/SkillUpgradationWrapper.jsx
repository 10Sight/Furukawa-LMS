import React, { useState, useMemo, useEffect } from 'react';
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
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetAllStudentsQuery as useGetAllStudentsQueryInstructor } from '@/Redux/AllApi/InstructorApi';
import { 
    IconStars, 
    IconHierarchy2
} from "@tabler/icons-react";
import SkillUpgradationPlan from '@/components/departments/SkillUpgradationPlan';

const SkillUpgradationWrapper = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    
    const { canManage, canEditLayout } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('skill_upgradation:manage') || isAdmin,
            canEditLayout: permissions.includes('skill_upgradation:edit_layout') || isAdmin
        };
    }, [authUser, isAdmin]);
    
    // Selections
    const [dept, setDept] = useState("");
    const [section, setSection] = useState("");
    
    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    
    // Fetch students/operators for the selected section
    const { data: studentsData, isFetching: isFetchingStudents } = useGetAllStudentsQueryInstructor({
        departmentId: dept,
        sectionId: section,
        limit: 1000,
        sixteenDayApprovedOnly: "true"
    }, { 
        skip: !dept || !section,
        refetchOnMountOrArgChange: true 
    });

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const students = studentsData?.data?.users || [];

    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d.id || d._id)));
    }, [departments, authUser, isAdmin]);

    const assignableSections = useMemo(() => {
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || isAdmin || assignedIds.length === 0) return sections;
        return sections.filter(s => assignedIds.includes(String(s.id || s._id)));
    }, [sections, authUser, isAdmin]);

    const isRestricted = !isAdmin && authUser && (
        (authUser.departments?.length > 0) || authUser.departmentId ||
        (authUser.sections?.length > 0) || authUser.sectionId
    );

    useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length === 1 && !dept)
            setDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        if (dept && assignableSections.length === 1 && !section)
            setSection(String(assignableSections[0].id || assignableSections[0]._id));
    }, [isRestricted, assignableDepartments, assignableSections, dept, section]);

    return (
        <div className="space-y-6 w-full max-w-none mx-auto pb-20 p-4 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-100">
                        <IconStars className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Plan for Skill Upgradation</h1>
                        <p className="text-sm text-slate-500 font-medium">Training plan for skill upgradation sheet</p>
                    </div>
                </div>
            </div>

            {/* Selection Panel */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2 font-semibold">
                        <IconHierarchy2 className="w-4 h-4 text-blue-600" />
                        Hierarchy Selection
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</Label>
                            <Select
                                value={dept}
                                onValueChange={(val) => { setDept(val); setSection(""); }}
                                disabled={isRestricted && assignableDepartments.length <= 1}
                            >
                                <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((d) => (
                                        <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Section</Label>
                            <Select
                                value={section}
                                onValueChange={setSection}
                                disabled={!dept || (isRestricted && assignableSections.length <= 1)}
                            >
                                <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableSections.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.category ? `(${s.category})` : ""}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Training Plan Sheet */}
            {dept && section ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <SkillUpgradationPlan 
                        students={students} 
                        departmentId={dept} 
                        sectionId={section} 
                   />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-6 bg-white rounded-3xl shadow-sm mb-6 border border-slate-100">
                        <IconStars className="w-16 h-16 text-blue-200" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Select Hierarchy</h3>
                    <p className="text-sm text-slate-500 max-w-xs text-center mt-3 leading-relaxed">
                        Choose a department and section to view and manage the skill upgradation training plan.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SkillUpgradationWrapper;
