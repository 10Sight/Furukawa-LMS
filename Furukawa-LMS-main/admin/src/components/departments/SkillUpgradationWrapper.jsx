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
import { useGetLinesBySectionQuery } from '@/Redux/AllApi/LineApi';
import { useGetAllStudentsQuery as useGetAllStudentsQueryInstructor } from '@/Redux/AllApi/InstructorApi';
import {
    IconStars,
    IconHierarchy2,
    IconPlus,
    IconArrowLeft,
    IconCalendarTime,
    IconCalendar,
    IconEdit,
    IconTrash
} from "@tabler/icons-react";
import SkillUpgradationPlan from '@/components/departments/SkillUpgradationPlan';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import axiosInstance from '@/Helper/axiosInstance';

const SkillUpgradationWrapper = () => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    const { canCreate, canRead, canUpdate, canDelete } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        const hasManage = permissions.includes('skill_upgradation:manage') || isAdmin;
        return {
            canCreate: hasManage || permissions.includes('skill_upgradation:create'),
            canRead:   hasManage || permissions.includes('skill_upgradation:read'),
            canUpdate: hasManage || permissions.includes('skill_upgradation:update'),
            canDelete: hasManage || permissions.includes('skill_upgradation:delete'),
        };
    }, [authUser, isAdmin]);

    // Selections
    const [dept, setDept] = useState("");
    const [section, setSection] = useState("");
    const [line, setLine] = useState("");

    // Plans list and selection states
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [plansList, setPlansList] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);

    // Create Plan dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createDept, setCreateDept] = useState("");
    const [createSection, setCreateSection] = useState("");
    const [createLine, setCreateLine] = useState("");
    const [createYear, setCreateYear] = useState(new Date().getFullYear().toString());

    // Delete confirmation dialog
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Years list helper (last 2 years, current, and next 4 years)
    const yearsList = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 7 }, (_, i) => String(currentYear - 2 + i));
    }, []);

    // API Data
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    const { data: createSectionsData } = useGetSectionsByDepartmentQuery(createDept, { skip: !createDept });
    const { data: linesData } = useGetLinesBySectionQuery(section, { skip: !section });
    const { data: createLinesData } = useGetLinesBySectionQuery(createSection, { skip: !createSection });

    // Fetch students/operators for the selected section and line
    const { data: studentsData, isFetching: isFetchingStudents } = useGetAllStudentsQueryInstructor({
        departmentId: dept,
        sectionId: section,
        lineId: (line && line !== "all") ? line : undefined,
        limit: 1000,
        includeTemporary: "false",
        sixteenDayApprovedOnly: "true"
    }, {
        skip: !dept || !section,
        refetchOnMountOrArgChange: true
    });

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const createSections = createSectionsData?.data || [];
    const lines = linesData?.data || [];
    const createLines = createLinesData?.data || [];
    const selectedLineName = lines.find(l => String(l.id || l._id) === String(line))?.name || "";
    const DOCUMENT_NO = "FRM-WH-QA-236";
    const students = useMemo(() => {
        const rawUsers = studentsData?.data?.users || [];
        return rawUsers.filter(user =>
            (user.isTemporary === 0 || user.isTemporary === "0" || !user.isTemporary) &&
            (user.isDeleted === 0 || user.isDeleted === "0" || !user.isDeleted) &&
            (user.status || "").toUpperCase() !== "LEFT"
        );
    }, [studentsData]);

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
        setIsReadOnly(false);
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
            const existingPlansResponse = await axiosInstance.get('/api/skill-upgradation-plan/list', {
                params: { departmentId: createDept, sectionId: createSection }
            });
            const existingPlans = existingPlansResponse.data?.data || [];
            const duplicate = existingPlans.find(p => String(p.year) === String(createYear));
            if (duplicate) {
                // Plans are stored one-per department/section/year and shared across all lines,
                // so if it already exists (created for another line), just open it for this line instead of blocking.
                setDept(createDept);
                setSection(createSection);
                setLine(createLine);
                setIsCreateOpen(false);
                setIsReadOnly(false);
                setSelectedPlan(duplicate);
                toast.success(`A plan for Year ${createYear} already exists for this section — opening it for this line.`);
                return;
            }
            const response = await axiosInstance.post(`/api/skill-upgradation-plan/department/${createDept}`, {
                sectionId: createSection,
                year: createYear,
                selectedLines: [],
                tableData: {}
            });
            if (response.data.success) {
                setDept(createDept);
                setSection(createSection);
                setLine(createLine);
                setIsCreateOpen(false);
                toast.success(`Skill Upgradation Plan created successfully for Year ${createYear}`);
                fetchPlansList();
                if (response.data.data) {
                    setIsReadOnly(false);
                    setSelectedPlan(response.data.data);
                } else {
                    setIsReadOnly(false);
                    setSelectedPlan({ year: createYear });
                }
            }
        } catch (error) {
            console.error("Error creating plan:", error);
            toast.error(error?.response?.data?.message || "Failed to create plan.");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget?.id) return;
        try {
            setIsDeleting(true);
            await axiosInstance.delete(`/api/skill-upgradation-plan/${deleteTarget.id}`);
            toast.success("Skill upgradation plan deleted successfully");
            setDeleteTarget(null);
            fetchPlansList();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to delete plan.");
        } finally {
            setIsDeleting(false);
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
                        {canCreate && (
                            <Button
                                onClick={() => {
                                    setCreateDept("");
                                    setCreateSection("");
                                    setCreateLine("");
                                    setCreateYear(new Date().getFullYear().toString());
                                    setIsCreateOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <IconPlus className="w-4 h-4" />
                                Create Plan
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</Label>
                            <Select
                                value={dept}
                                onValueChange={(val) => { setDept(val); setSection(""); setLine(""); }}
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
                                onValueChange={(val) => { setSection(val); setLine(""); }}
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

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Line</Label>
                            <Select
                                value={line}
                                onValueChange={setLine}
                                disabled={!section}
                            >
                                <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Line" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Lines</SelectItem>
                                    {lines.map((l) => (
                                        <SelectItem key={l.id || l._id} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Training Plan Sheet */}
            {dept && section ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 w-full max-w-full overflow-hidden">
                    {selectedPlan ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between no-print">
                                <Button
                                    onClick={() => { setSelectedPlan(null); setIsReadOnly(false); }}
                                    variant="outline"
                                    className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm text-xs h-9"
                                >
                                    <IconArrowLeft className="w-4 h-4 mr-1.5" />
                                    Back to Plans
                                </Button>
                                {isReadOnly && canUpdate && (
                                    <Button
                                        onClick={() => setIsReadOnly(false)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5"
                                    >
                                        <IconEdit className="w-4 h-4" />
                                        Switch to Edit
                                    </Button>
                                )}
                            </div>
                            <SkillUpgradationPlan
                                 students={students}
                                 isLoadingStudents={isFetchingStudents}
                                 departmentId={dept}
                                 sectionId={section}
                                 lineId={(line && line !== "all") ? line : ""}
                                 lineName={(line && line !== "all") ? selectedLineName : ""}
                                 year={selectedPlan.year}
                                 isReadOnly={isReadOnly}
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
                                                    <th className="p-3">Line</th>
                                                    <th className="p-3">Year</th>
                                                    <th className="p-3">Document No</th>
                                                    <th className="p-3">Created By</th>
                                                    <th className="p-3">Last Updated By</th>
                                                    {(canUpdate || canDelete) && (
                                                        <th className="p-3 pr-4 text-center">Actions</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                                {plansList.map((plan) => (
                                                    <tr
                                                        key={plan.id || `${plan.departmentId}-${plan.sectionId}-${plan.year}`}
                                                        onClick={() => { setIsReadOnly(true); setSelectedPlan(plan); }}
                                                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                                                    >
                                                        <td className="p-3 pl-4 font-semibold text-slate-900">{plan.departmentName || "N/A"}</td>
                                                        <td className="p-3 text-slate-600 font-medium">{plan.sectionName || "N/A"}</td>
                                                        <td className="p-3 text-slate-600 font-medium">{selectedLineName || "N/A"}</td>
                                                        <td className="p-3 text-slate-700 font-bold">{plan.year}</td>
                                                        <td className="p-3 text-slate-600 font-mono text-xs">{DOCUMENT_NO}</td>
                                                        <td className="p-3 text-slate-600">{plan.createdBy || "System"}</td>
                                                        <td className="p-3 text-slate-600">{plan.updatedBy || plan.createdBy || "System"}</td>
                                                        {(canUpdate || canDelete) && (
                                                            <td className="p-3 pr-4" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    {canUpdate && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => { setIsReadOnly(false); setSelectedPlan(plan); }}
                                                                            className="h-8 px-2.5 text-slate-600 hover:text-green-700 hover:bg-green-50"
                                                                            title="Edit"
                                                                        >
                                                                            <IconEdit className="w-4 h-4" />
                                                                        </Button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => setDeleteTarget(plan)}
                                                                            className="h-8 px-2.5 text-slate-600 hover:text-red-700 hover:bg-red-50"
                                                                            title="Delete"
                                                                        >
                                                                            <IconTrash className="w-4 h-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
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
                                onValueChange={(val) => { setCreateDept(val); setCreateSection(""); setCreateLine(""); }}
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
                                onValueChange={(val) => { setCreateSection(val); setCreateLine(""); }}
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
                            <Label className="text-xs font-bold text-slate-600 uppercase">Line (Optional)</Label>
                            <Select
                                value={createLine}
                                onValueChange={setCreateLine}
                                disabled={!createSection}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-blue-500 text-sm disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Line" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Lines</SelectItem>
                                    {createLines.map((l) => (
                                        <SelectItem key={l.id || l._id} value={String(l.id || l._id)}>{l.name}</SelectItem>
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

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="max-w-[400px] bg-white rounded-xl shadow-lg border border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <IconTrash className="w-5 h-5 text-red-500" />
                            Delete Plan
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600 py-2">
                        Are you sure you want to permanently delete the{" "}
                        <span className="font-bold text-slate-800">{deleteTarget?.year}</span> skill upgradation plan
                        for <span className="font-bold text-slate-800">{deleteTarget?.sectionName || "this section"}</span>?
                        This action cannot be undone.
                    </p>
                    <DialogFooter className="flex gap-3 pt-3 border-t">
                        <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="h-10 text-sm" disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-5 rounded-lg text-sm"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SkillUpgradationWrapper;
