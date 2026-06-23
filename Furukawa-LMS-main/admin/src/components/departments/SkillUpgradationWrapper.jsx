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
    IconHierarchy2,
    IconPlus,
    IconArrowLeft,
    IconCalendarTime,
    IconCalendar
} from "@tabler/icons-react";
import SkillUpgradationPlan from '@/components/departments/SkillUpgradationPlan';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import axiosInstance from '@/Helper/axiosInstance';

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
    
    // Plans list and selection states
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [plansList, setPlansList] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);

    // Create Plan dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createDept, setCreateDept] = useState("");
    const [createSection, setCreateSection] = useState("");
    const [createYear, setCreateYear] = useState(new Date().getFullYear().toString());

    // Years list helper (last 2 years, current, and next 4 years)
    const yearsList = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 7 }, (_, i) => String(currentYear - 2 + i));
    }, []);

    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    const { data: createSectionsData } = useGetSectionsByDepartmentQuery(createDept, { skip: !createDept });
    
    // Fetch students/operators for the selected section
    const { data: studentsData, isFetching: isFetchingStudents } = useGetAllStudentsQueryInstructor({
        departmentId: dept,
        sectionId: section,
        limit: 1000,
        includeTemporary: "true"
    }, { 
        skip: !dept || !section,
        refetchOnMountOrArgChange: true 
    });

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const createSections = createSectionsData?.data || [];
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

    const fetchPlansList = async () => {
        if (!dept || !section) {
            setPlansList([]);
            return;
        }
        try {
            setLoadingPlans(true);
            const response = await axiosInstance.get('/api/skill-upgradation-plan/list', {
                params: { departmentId: dept, sectionId: section }
            });
            if (response.data?.success) {
                setPlansList(response.data.data || []);
            } else {
                setPlansList([]);
            }
        } catch (error) {
            console.error("Error fetching plans list:", error);
            toast.error("Failed to load plans list");
            setPlansList([]);
        } finally {
            setLoadingPlans(false);
        }
    };

    useEffect(() => {
        fetchPlansList();
        setSelectedPlan(null);
    }, [dept, section]);

    useEffect(() => {
        if (selectedPlan === null) {
            fetchPlansList();
        }
    }, [selectedPlan]);

    const handleCreatePlanSubmit = async () => {
        if (!createDept || !createSection || !createYear) {
            toast.error("Please select Department, Section, and Year.");
            return;
        }
        try {
            const response = await axiosInstance.post(`/api/skill-upgradation-plan/department/${createDept}`, {
                sectionId: createSection,
                year: createYear,
                selectedLines: [],
                tableData: {}
            });
            if (response.data.success) {
                setDept(createDept);
                setSection(createSection);
                setIsCreateOpen(false);
                toast.success(`Skill Upgradation Plan created successfully for Year ${createYear}`);
                fetchPlansList();
                if (response.data.data) {
                    setSelectedPlan(response.data.data);
                } else {
                    setSelectedPlan({ year: createYear });
                }
            }
        } catch (error) {
            console.error("Error creating plan:", error);
            toast.error(error?.response?.data?.message || "Failed to create plan.");
        }
    };

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
                    <CardTitle className="text-base flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-2">
                            <IconHierarchy2 className="w-4 h-4 text-blue-600" />
                            Hierarchy Selection
                        </span>
                        <Button 
                            onClick={() => {
                                setCreateDept("");
                                setCreateSection("");
                                setCreateYear(new Date().getFullYear().toString());
                                setIsCreateOpen(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <IconPlus className="w-4 h-4" />
                            Create Plan
                        </Button>
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
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                    {selectedPlan ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between no-print">
                                <Button
                                    onClick={() => setSelectedPlan(null)}
                                    variant="outline"
                                    className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm text-xs h-9"
                                >
                                    <IconArrowLeft className="w-4 h-4 mr-1.5" />
                                    Back to Plans
                                </Button>
                            </div>
                            <SkillUpgradationPlan
                                 students={students}
                                 isLoadingStudents={isFetchingStudents}
                                 departmentId={dept}
                                 sectionId={section}
                                 year={selectedPlan.year}
                            />
                        </div>
                    ) : (
                        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-base flex items-center justify-between font-semibold text-slate-800">
                                    <span className="flex items-center gap-2">
                                        <IconCalendarTime className="w-4 h-4 text-blue-600" />
                                        Saved Training Plans
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                {loadingPlans ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                                        <p className="text-sm text-slate-500">Loading saved plans...</p>
                                    </div>
                                ) : plansList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="p-4 bg-blue-50 rounded-full mb-4">
                                            <IconCalendar className="w-10 h-10 text-blue-300" />
                                        </div>
                                        <h4 className="text-md font-bold text-slate-700">No Saved Plans</h4>
                                        <p className="text-xs text-slate-500 max-w-xs mt-2">
                                            There are no skill upgradation plans created for this department and section yet. Click the "Create Plan" button above to get started.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
                                        <table className="w-full border-collapse text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs font-bold">
                                                <tr>
                                                    <th className="p-3 pl-4">Department</th>
                                                    <th className="p-3">Section</th>
                                                    <th className="p-3">Year</th>
                                                    <th className="p-3">Created By</th>
                                                    <th className="p-3 pr-4">Last Updated By</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {plansList.map((plan) => (
                                                    <tr 
                                                        key={plan.id || `${plan.departmentId}-${plan.sectionId}-${plan.year}`} 
                                                        onClick={() => setSelectedPlan(plan)}
                                                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                                    >
                                                        <td className="p-3 pl-4 font-semibold text-slate-900">{plan.departmentName || "N/A"}</td>
                                                        <td className="p-3 text-slate-600 font-medium">{plan.sectionName || "N/A"}</td>
                                                        <td className="p-3 text-slate-700 font-bold">{plan.year}</td>
                                                        <td className="p-3 text-slate-600">{plan.createdBy || "System"}</td>
                                                        <td className="p-3 pr-4 text-slate-600">{plan.updatedBy || plan.createdBy || "System"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
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

            {/* Create Plan Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-[450px] bg-white rounded-xl shadow-lg border border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <IconStars className="w-5 h-5 text-blue-600" />
                            Create Skill Upgradation Plan
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 text-black">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 uppercase">Department</Label>
                            <Select
                                value={createDept}
                                onValueChange={(val) => { setCreateDept(val); setCreateSection(""); }}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
                                        <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 uppercase">Section</Label>
                            <Select
                                value={createSection}
                                onValueChange={setCreateSection}
                                disabled={!createDept}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {createSections.map((s) => (
                                        <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.category ? `(${s.category})` : ""}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 uppercase">Year</Label>
                            <Select
                                value={createYear}
                                onValueChange={setCreateYear}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm">
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {yearsList.map((y) => (
                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="h-10 text-sm">Cancel</Button>
                        <Button 
                            onClick={handleCreatePlanSubmit}
                            disabled={!createDept || !createSection}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-5 rounded-lg text-sm"
                        >
                            Create
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SkillUpgradationWrapper;
