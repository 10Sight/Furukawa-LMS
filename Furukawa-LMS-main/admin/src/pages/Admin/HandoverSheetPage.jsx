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
import { IconClipboardList, IconHierarchy2, IconInfoCircle, IconUsersGroup } from "@tabler/icons-react";
import { useGetMachinesByDepartmentQuery } from '@/Redux/AllApi/MachineApi';
import HandoverSheet from '@/components/departments/HandoverSheet';

const HandoverSheetPage = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    const [searchParams] = useSearchParams();

    // Selections
    const [dept, setDept] = useState(searchParams.get('dept') || "");
    const [section, setSection] = useState(searchParams.get('section') || "");

    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery({ limit: 500 });
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });

    // Fetch students based on Dept / Section for initial population if needed
    const { data: studentsData } = useGetAllStudentsQuery({
        departmentId: dept,
        sectionId: section === "0" ? "" : section,
        includeTemporary: "only",
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
        if (!authUser) return [];
        const allDepts = departments || [];
        const assignedIds = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) assignedIds.push(authUser.departmentId);
        
        if (isAdmin && assignedIds.length === 0) return allDepts;
        
        return allDepts.filter(d =>
            assignedIds.includes(d.id) || assignedIds.includes(d._id)
        );
    }, [departments, authUser, isAdmin]);

    // Auto-select if only one department
    useEffect(() => {
        if (assignableDepartments.length === 1 && !dept) {
            setDept(assignableDepartments[0].id || assignableDepartments[0]._id);
        }
    }, [assignableDepartments, dept]);

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
                            <Label className="text-xs font-semibold text-slate-500 uppercase">Section (Optional)</Label>
                            <Select 
                                value={String(section)} 
                                onValueChange={(val) => setSection(val)} 
                                disabled={!dept}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 disabled:opacity-80 disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Section (All)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">All Sections</SelectItem>
                                    {sections.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Handover Sheet Area */}
            {dept ? (
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
                    />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-5 bg-white rounded-full shadow-sm mb-5">
                        <IconHierarchy2 className="w-16 h-16 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Select Department</h3>
                    <p className="text-sm text-slate-500 max-w-xs text-center mt-2 leading-relaxed">
                        Choose a department to view and manage its handover sheet records.
                    </p>
                </div>
            )}
        </div>
    );
};

export default HandoverSheetPage;
