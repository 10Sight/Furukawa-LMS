import React, { useState, useMemo } from 'react';
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
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { 
    IconStars, 
    IconHierarchy2
} from "@tabler/icons-react";
import MultiSkillingPlan from '@/components/departments/MultiSkillingPlan';

const MultiSkilling = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    
    const { canManage, canEditLayout } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('multi_skilling:manage') || isAdmin,
            canEditLayout: permissions.includes('multi_skilling:edit_layout') || isAdmin
        };
    }, [authUser, isAdmin]);
    
    // Selections
    const [dept, setDept] = useState("");
    const [section, setSection] = useState("");
    
    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    
    // Fetch students/operators for the selected section
    const { data: studentsData, isFetching: isFetchingStudents } = useGetAllStudentsQuery({
        departmentId: dept,
        sectionId: section,
        limit: 1000
    }, { 
        skip: !dept || !section,
        refetchOnMountOrArgChange: true 
    });

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const students = studentsData?.data?.users || [];

    return (
        <div className="space-y-6 w-full max-w-none mx-auto pb-20 p-4 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500 rounded-xl shadow-lg shadow-amber-100">
                        <IconStars className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">Multi Skilling</h1>
                        <p className="text-sm text-slate-500 font-medium">Training plan for multi skilling sheet</p>
                    </div>
                </div>
            </div>

            {/* Selection Panel */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <CardTitle className="text-base flex items-center gap-2 font-semibold">
                        <IconHierarchy2 className="w-4 h-4 text-amber-500" />
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
                            >
                                <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
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
                                disabled={!dept}
                            >
                                <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map((s) => (
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
                   <MultiSkillingPlan 
                        students={students} 
                        departmentId={dept} 
                        sectionId={section} 
                   />
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="p-6 bg-white rounded-3xl shadow-sm mb-6 border border-slate-100">
                        <IconStars className="w-16 h-16 text-amber-200" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">Select Hierarchy</h3>
                    <p className="text-sm text-slate-500 max-w-xs text-center mt-3 leading-relaxed">
                        Choose a department and section to view and manage the multi-skilling training plan.
                    </p>
                </div>
            )}
        </div>
    );
};

export default MultiSkilling;
