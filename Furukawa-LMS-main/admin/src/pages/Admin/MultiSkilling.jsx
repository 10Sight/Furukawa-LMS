import React, { useState, useMemo, useEffect } from 'react';
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
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import {
    IconStars,
    IconHierarchy2,
    IconPlus,
    IconArrowLeft,
    IconEye,
    IconCalendarTime,
    IconCalendar,
    IconLoader
} from "@tabler/icons-react";
import MultiSkillingPlan from '@/components/departments/MultiSkillingPlan';

// New Imports for Tabbed Navigation & Operator Finder
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import axiosInstance from '@/Helper/axiosInstance';
import OnJobTraining from './OnJobTraining';
import TestPaper from './TestPaper';
import Daily5MRecording from '../CMS/Daily5MRecording';
import Cycle10 from './Cycle10';
import ThreeDayMonitoring from './ThreeDayMonitoring';
import SkillMatrixCertificate from '@/components/admin/SkillMatrixCertificate';
import SkillMatrix from './SkillMatrix';
import { useGetLinesBySectionQuery } from '@/Redux/AllApi/LineApi';
import { useGetSubSectionsByLineQuery } from '@/Redux/AllApi/SubSectionApi';
import { useGetAllUsersQuery } from '@/Redux/AllApi/UserApi';
import { useDeleteEvaluationSheetMutation } from '@/Redux/AllApi/SkillMatrixApi';
import { Edit2, Trash2 } from "lucide-react";

const VALID_MULTI_SKILLING_TABS = [
    "planCalendar",
    "ojt",
    "testPaper",
    "daily5m",
    "cycle10",
    "threeDay",
    "evaluation",
    "skillMatrix",
];

const MultiSkilling = () => {

    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN' || authUser?.role === 'INSTRUCTOR' || authUser?.isTrainer;
    const canAccessAll = isAdmin;

    const [searchParams, setSearchParams] = useSearchParams();

    // Active Tab State (defaults to 'planCalendar', restored from ?tab= in URL)
    const [activeTab, setActiveTab] = useState(() => {
        const tabFromUrl = searchParams.get('tab');
        return VALID_MULTI_SKILLING_TABS.includes(tabFromUrl) ? tabFromUrl : "planCalendar";
    });

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);
            return next;
        }, { replace: true });
    };

    // Keep activeTab in sync with the URL (e.g. browser back/forward, deep links)
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        if (VALID_MULTI_SKILLING_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams]);

    // Plan Calander Hierarchy Selections
    const [dept, setDept] = useState("");
    const [section, setSection] = useState("");
    const [year, setYear] = useState(new Date().getFullYear().toString());

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

    // Plan Calander API Data Hooks
    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(dept, { skip: !dept });
    const { data: createSectionsData } = useGetSectionsByDepartmentQuery(createDept, { skip: !createDept });

    // Fetch students/operators for Plan Calander
    const { data: studentsData } = useGetAllStudentsQuery({
        departmentId: dept,
        sectionId: section,
        filterMultiSkillingLevels: "true",
        limit: 1000
    }, {
        skip: !dept || !section,
        refetchOnMountOrArgChange: true
    });

    const createSections = createSectionsData?.data || [];

    const fetchPlansList = async () => {
        if (!dept || !section) {
            setPlansList([]);
            return;
        }
        try {
            setLoadingPlans(true);
            const response = await axiosInstance.get('/api/multi-skilling-plan/list', {
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

    React.useEffect(() => {
        fetchPlansList();
        setSelectedPlan(null);
    }, [dept, section]);

    React.useEffect(() => {
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
            const response = await axiosInstance.post(`/api/multi-skilling-plan/department/${createDept}`, {
                sectionId: createSection,
                year: createYear,
                selectedLines: [],
                tableData: {}
            });
            if (response.data.success) {
                setDept(createDept);
                setSection(createSection);
                setYear(createYear);
                setIsCreateOpen(false);
                toast.success(`Multi-Skilling Plan created successfully for Year ${createYear}`);
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
    const sections = sectionsData?.data || [];
    const students = studentsData?.data?.users || [];

    // ── Permission-filtered department/section lists ────────────────────────
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

    useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length === 1 && !dept) {
            setDept(String(assignableDepartments[0].id || assignableDepartments[0]._id));
        }
    }, [isRestricted, assignableDepartments, dept]);

    useEffect(() => {
        if (!isRestricted) return;
        if (dept && assignableSections.length === 1 && !section) {
            setSection(String(assignableSections[0].id || assignableSections[0]._id));
        }
    }, [isRestricted, dept, assignableSections, section]);

    // Skill Evaluation Operator Finder State
    const [evalDepartment, setEvalDepartment] = useState("");
    const [evalSection, setEvalSection] = useState("");
    const [evalLine, setEvalLine] = useState("");
    const [evalSubSection, setEvalSubSection] = useState("");
    const [evalSearchText, setEvalSearchText] = useState("");
    const [debouncedEvalSearchText, setDebouncedEvalSearchText] = useState("");
    const [selectedOperatorForEval, setSelectedOperatorForEval] = useState(null);
    const [evaluationSheets, setEvaluationSheets] = useState([]);
    const [selectedSheetId, setSelectedSheetId] = useState(null);
    const [isEvalReadOnly, setIsEvalReadOnly] = useState(false);
    const [isSheetsLoading, setIsSheetsLoading] = useState(false);
    const [deleteConfirmSheetId, setDeleteConfirmSheetId] = useState(null);
    const [evalOperatorsPage, setEvalOperatorsPage] = useState(1);
    const evalOperatorsPerPage = 30;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedEvalSearchText(evalSearchText), 500);
        return () => clearTimeout(timer);
    }, [evalSearchText]);

    const [deleteEvaluationSheet] = useDeleteEvaluationSheetMutation();

    const hasEvalPermission = (perm) => {
        if (!authUser) return false;
        if (authUser.role === 'SUPERADMIN' || authUser.role === 'ADMIN') return true;
        const customPerms = authUser.customRole?.permissions || [];
        const roleDefaults = {
            INSTRUCTOR: ['evaluation:manage', 'evaluation:create', 'evaluation:read', 'evaluation:update', 'evaluation:delete'],
        };
        const defaultPerms = roleDefaults[authUser.role] || [];
        return [...defaultPerms, ...customPerms].includes(perm) || [...defaultPerms, ...customPerms].includes('evaluation:manage');
    };

    const canEditEval = hasEvalPermission('evaluation:update');
    const canDeleteEval = hasEvalPermission('evaluation:delete');

    const fetchEvaluationSheets = async (studentId) => {
        if (!studentId) return;
        try {
            setIsSheetsLoading(true);
            const response = await axiosInstance.get(`/api/skill-matrix/evaluation/${studentId}/sheets`);
            if (response.data.success) {
                setEvaluationSheets(response.data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch evaluation sheets list:", error);
        } finally {
            setIsSheetsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedOperatorForEval) {
            fetchEvaluationSheets(selectedOperatorForEval);
            setSelectedSheetId(null);
        } else {
            setEvaluationSheets([]);
            setSelectedSheetId(null);
        }
    }, [selectedOperatorForEval]);

    const handleCreateNewSheetFromList = async () => {
        if (!selectedOperatorForEval) return;
        try {
            const response = await axiosInstance.post(`/api/skill-matrix/evaluation/${selectedOperatorForEval}/sheet/create`, {
                departmentId: evalDepartment
            });
            if (response.data.success && response.data.data) {
                const newSheet = response.data.data;
                toast.success(`Sheet ${newSheet.sheetIndex} (${newSheet.period}) created successfully!`);
                setIsEvalReadOnly(false);
                setSelectedSheetId(newSheet.id);
                fetchEvaluationSheets(selectedOperatorForEval);
            }
        } catch (error) {
            console.error("Failed to create new sheet:", error);
            toast.error("Failed to create new evaluation sheet");
        }
    };

    // Queries for Skill Evaluation Operator Finder
    const { data: evalSectionsData } = useGetSectionsByDepartmentQuery(evalDepartment, { skip: !evalDepartment });
    const { data: evalLinesData } = useGetLinesBySectionQuery(evalSection, { skip: !evalSection });
    const { data: evalSubSectionsData } = useGetSubSectionsByLineQuery(evalLine, { skip: !evalLine });

    const assignableEvalSections = useMemo(() => {
        const allSections = evalSectionsData?.data || [];
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || canAccessAll || assignedIds.length === 0) return allSections;
        return allSections.filter(s => assignedIds.includes(String(s.id || s._id)));
    }, [evalSectionsData, authUser, canAccessAll]);

    const { data: evalUsersData, isFetching: isEvalUsersFetching, refetch: refetchEvalUsers } = useGetAllUsersQuery({
        departmentId: evalDepartment || undefined,
        sectionId: evalSection || undefined,
        lineId: evalLine || undefined,
        subSectionId: evalSubSection || undefined,
        role: "STUDENT,CUSTOM",
        includeTemporary: "false",
        includeEvaluationInfo: "true",
        search: debouncedEvalSearchText || undefined,
        excludeCounts: "true",
        page: evalOperatorsPage,
        limit: evalOperatorsPerPage,
        sortBy: "fullName",
        order: "asc"
    }, { skip: !evalDepartment });

    const filteredEvalUsers = useMemo(() => {
        return evalUsersData?.data?.users || [];
    }, [evalUsersData]);

    const evalOperatorsTotalPages = evalUsersData?.data?.totalPages || 1;

    const paginatedEvalUsers = filteredEvalUsers;

    useEffect(() => {
        setEvalOperatorsPage(1);
    }, [evalDepartment, evalSection, evalLine, evalSubSection, debouncedEvalSearchText]);

    useEffect(() => {
        if (evalOperatorsPage > evalOperatorsTotalPages) setEvalOperatorsPage(evalOperatorsTotalPages);
    }, [evalOperatorsTotalPages, evalOperatorsPage]);

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

            {/* Tabbed Navigation Menu */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="no-print mb-6 flex flex-wrap gap-2 w-fit bg-slate-100 p-1.5 rounded-xl shadow-sm border border-slate-200">
                    <TabsTrigger value="planCalendar" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">Plan Calander</TabsTrigger>
                    <TabsTrigger value="ojt" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">OJT</TabsTrigger>
                    <TabsTrigger value="testPaper" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">Test Papers</TabsTrigger>
                    <TabsTrigger value="daily5m" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">5M</TabsTrigger>
                    <TabsTrigger value="cycle10" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">10 Cycle</TabsTrigger>
                    <TabsTrigger value="threeDay" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">3 Days</TabsTrigger>
                    <TabsTrigger value="evaluation" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">Skill Evaluation</TabsTrigger>
                    <TabsTrigger value="skillMatrix" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white">Skill Matrix</TabsTrigger>
                </TabsList>

                {/* Plan Calander Tab */}
                <TabsContent value="planCalendar" className="space-y-6">
                    {/* Selection Panel */}
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-base flex items-center justify-between font-semibold">
                                <span className="flex items-center gap-2">
                                    <IconHierarchy2 className="w-4 h-4 text-amber-500" />
                                    Hierarchy Selection
                                </span>
                                <Button 
                                    onClick={() => {
                                        setCreateDept("");
                                        setCreateSection("");
                                        setCreateYear(new Date().getFullYear().toString());
                                        setIsCreateOpen(true);
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
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
                                    >
                                        <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm">
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
                                        disabled={!dept}
                                    >
                                        <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm disabled:bg-slate-50">
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

                    {/* Training Plan Sheet / List Table */}
                    {dept && section ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4 w-full max-w-full overflow-hidden">
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
                                    <MultiSkillingPlan
                                        students={students}
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
                                                <IconCalendarTime className="w-4 h-4 text-amber-500" />
                                                Saved Training Plans
                                            </span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-6">
                                        {loadingPlans ? (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mb-4" />
                                                <p className="text-sm text-slate-500">Loading saved plans...</p>
                                            </div>
                                        ) : plansList.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <div className="p-4 bg-amber-50 rounded-full mb-4">
                                                    <IconCalendar className="w-10 h-10 text-amber-300" />
                                                </div>
                                                <h4 className="text-md font-bold text-slate-700">No Saved Plans</h4>
                                                <p className="text-xs text-slate-500 max-w-xs mt-2">
                                                    There are no multi-skilling plans created for this department and section yet. Click the "Create Plan" button above to get started.
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
                                <IconStars className="w-16 h-16 text-amber-200" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">Select Hierarchy</h3>
                            <p className="text-sm text-slate-500 max-w-xs text-center mt-3 leading-relaxed">
                                Choose a department and section to view and manage the multi-skilling training plan.
                            </p>
                        </div>
                    )}
                </TabsContent>

                {/* Ojt Tab */}
                <TabsContent value="ojt" className="space-y-6">
                    <OnJobTraining />
                </TabsContent>

                {/* Test Papers Tab */}
                <TabsContent value="testPaper" className="space-y-6">
                    <TestPaper isMultiSkilling={true} />
                </TabsContent>

                {/* 5M Tab */}
                <TabsContent value="daily5m" className="space-y-6">
                    <Daily5MRecording />
                </TabsContent>

                {/* 10 Cycle Tab */}
                <TabsContent value="cycle10" className="space-y-6">
                    <Cycle10 />
                </TabsContent>

                {/* 3 Days Tab */}
                <TabsContent value="threeDay" className="space-y-6">
                    <ThreeDayMonitoring />
                </TabsContent>

                {/* Skill Evaluation Tab */}
                <TabsContent value="evaluation" className="space-y-6">
                    {/* Control Bar for selecting operator */}
                    <div className="no-print p-6 bg-white border rounded-xl shadow-sm space-y-4 mb-6 text-black">
                        <div className="flex justify-between items-center border-b pb-2">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Operator Evaluation Finder</h2>
                                <p className="text-xs text-slate-500 font-medium">Filter and select an operator to view/edit their skill certificate</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleTabChange("planCalendar")} className="border-slate-200">
                                Back to Plan Calander
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Department</Label>
                                <Select value={evalDepartment} onValueChange={(val) => {
                                    setEvalDepartment(val);
                                    setEvalSection("");
                                    setEvalLine("");
                                    setEvalSubSection("");
                                    setSelectedOperatorForEval(null);
                                }}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                    <SelectContent>
                                        {assignableDepartments.map((d) => (
                                            <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Section</Label>
                                <Select value={evalSection} onValueChange={(val) => {
                                    setEvalSection(val);
                                    setEvalLine("");
                                    setEvalSubSection("");
                                    setSelectedOperatorForEval(null);
                                }} disabled={!evalDepartment}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Sections" /></SelectTrigger>
                                    <SelectContent>
                                        {assignableEvalSections.map((s, idx) => (
                                            <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Line</Label>
                                <Select value={evalLine} onValueChange={(val) => {
                                    setEvalLine(val);
                                    setEvalSubSection("");
                                    setSelectedOperatorForEval(null);
                                }} disabled={!evalSection}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Lines" /></SelectTrigger>
                                    <SelectContent>
                                        {evalLinesData?.data?.map((l, idx) => (
                                            <SelectItem key={`${l.id || l._id}-${idx}`} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Sub-Section</Label>
                                <Select value={evalSubSection} onValueChange={(val) => {
                                    setEvalSubSection(val);
                                    setSelectedOperatorForEval(null);
                                }} disabled={!evalLine}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Sub-Sections" /></SelectTrigger>
                                    <SelectContent>
                                        {evalSubSectionsData?.data?.map((ss, idx) => (
                                            <SelectItem key={`${ss.id || ss._id}-${idx}`} value={String(ss.id || ss._id)}>{ss.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Search User</Label>
                                <Input
                                    placeholder="Type name or card no..."
                                    value={evalSearchText}
                                    onChange={(e) => {
                                        setEvalSearchText(e.target.value);
                                        setSelectedOperatorForEval(null);
                                    }}
                                    className="h-9"
                                    disabled={!evalDepartment}
                                />
                            </div>
                        </div>

                    </div>

                    {selectedOperatorForEval ? (
                        selectedSheetId ? (
                            <div className="bg-white border rounded-xl p-4 shadow-sm">
                                <SkillMatrixCertificate
                                    studentId={selectedOperatorForEval}
                                    studentName={
                                        filteredEvalUsers.find(e => String(e._id || e.id) === String(selectedOperatorForEval))?.fullName ||
                                        filteredEvalUsers.find(e => String(e._id || e.id) === String(selectedOperatorForEval))?.name || ""
                                    }
                                    employeeCode={
                                        filteredEvalUsers.find(e => String(e._id || e.id) === String(selectedOperatorForEval))?.cardNo ||
                                        filteredEvalUsers.find(e => String(e._id || e.id) === String(selectedOperatorForEval))?.empId || ""
                                    }
                                    departmentId={evalDepartment}
                                    subSectionId={evalSubSection}
                                    initialSheetId={selectedSheetId}
                                    readOnly={isEvalReadOnly}
                                    onBackToList={() => {
                                        setSelectedSheetId(null);
                                        setIsEvalReadOnly(false);
                                        fetchEvaluationSheets(selectedOperatorForEval);
                                    }}
                                    onSaved={() => {
                                        try { refetchEvalUsers(); } catch (e) { /* query not started yet, nothing to refresh */ }
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-800">
                                            Evaluation Sheets for {
                                                filteredEvalUsers.find(e => String(e._id || e.id) === String(selectedOperatorForEval))?.fullName ||
                                                filteredEvalUsers.find(e => String(e._id || e.id) === String(selectedOperatorForEval))?.name
                                            }
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Select a sheet row to view details, or create a new evaluation sheet.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setSelectedOperatorForEval(null)}
                                            className="text-xs font-semibold border-slate-200"
                                        >
                                            Back to Operators
                                        </Button>
                                        <Button
                                            onClick={handleCreateNewSheetFromList}
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs"
                                        >
                                            + Create New Sheet
                                        </Button>
                                    </div>
                                </div>

                                {isSheetsLoading ? (
                                    <div className="flex justify-center py-8">
                                        <IconLoader className="animate-spin h-6 w-6 text-amber-500" />
                                    </div>
                                ) : evaluationSheets.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 italic">
                                        No evaluation sheets created yet. Click "+ Create New Sheet" to begin.
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600">
                                                <tr>
                                                    <th className="p-3 border-b text-left">Sheet #</th>
                                                    <th className="p-3 border-b text-left">Period</th>
                                                    <th className="p-3 border-b text-left">Level Earned</th>
                                                    <th className="p-3 border-b text-left">Efficiency</th>
                                                    <th className="p-3 border-b text-left">Status</th>
                                                    <th className="p-3 border-b text-left">Created Date</th>
                                                    <th className="p-3 border-b text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {evaluationSheets.map((sheet, idx) => (
                                                    <tr
                                                        key={sheet.id || idx}
                                                        className="hover:bg-slate-50/80 border-b text-xs transition-colors duration-150 cursor-pointer"
                                                        onClick={() => { setIsEvalReadOnly(true); setSelectedSheetId(sheet.id); }}
                                                    >
                                                        <td className="p-3 font-bold">Sheet {sheet.sheetIndex}</td>
                                                        <td className="p-3">{sheet.period}</td>
                                                        <td className="p-3 font-bold text-amber-600">{sheet.earnedLevel || 'L0'}</td>
                                                        <td className="p-3 font-semibold">{sheet.efficiency ? `${sheet.efficiency}%` : '0%'}</td>
                                                        <td className="p-3">
                                                            {sheet.isActive ? (
                                                                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Active</span>
                                                            ) : (
                                                                <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Previous</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3">{new Date(sheet.createdAt).toLocaleDateString('en-GB')}</td>
                                                        <td className="p-3" onClick={e => e.stopPropagation()}>
                                                            <div className="flex gap-1 justify-center flex-wrap">
                                                                {canEditEval && (
                                                                    <Button
                                                                        size="xs"
                                                                        variant="outline"
                                                                        className="h-7 text-xs font-semibold px-2 gap-1 border-amber-400 text-amber-600 hover:bg-amber-50"
                                                                        title="Edit"
                                                                        onClick={() => { setIsEvalReadOnly(false); setSelectedSheetId(sheet.id); }}
                                                                    >
                                                                        <Edit2 className="h-3 w-3" /> Edit
                                                                    </Button>
                                                                )}
                                                                {canDeleteEval && (
                                                                    <Button
                                                                        size="xs"
                                                                        variant="outline"
                                                                        className="h-7 text-xs font-semibold px-2 gap-1 border-red-400 text-red-600 hover:bg-red-50"
                                                                        title="Delete"
                                                                        onClick={() => setDeleteConfirmSheetId(sheet.id)}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" /> Delete
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
                            </div>
                        )
                    ) : !evalDepartment ? (
                        <div className="text-center py-10 text-slate-500 border-2 border-dashed rounded-xl bg-slate-50">
                            No operator selected. Please select a Department and filter/search for an operator from the criteria above.
                        </div>
                    ) : (
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600">
                                    <tr>
                                        <th className="p-3 border-b text-left">Operator Name</th>
                                        <th className="p-3 border-b text-left">Emp ID</th>
                                        <th className="p-3 border-b text-left">Last Evaluation Date</th>
                                        <th className="p-3 border-b text-left">Current Level</th>
                                        <th className="p-3 border-b text-left">Primary Station (Sub-Section)</th>
                                        <th className="p-3 border-b text-left">Current Sheet (Year)</th>
                                        <th className="p-3 border-b text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isEvalUsersFetching ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10">
                                                <IconLoader className="animate-spin h-6 w-6 mx-auto text-slate-400" />
                                            </td>
                                        </tr>
                                    ) : paginatedEvalUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-slate-400 italic">
                                                No operators found matching the criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedEvalUsers.map(u => {
                                            const stationLabel = [u.primaryStationName, u.subSectionName].filter(Boolean).join(' (') + (u.subSectionName ? ')' : '');
                                            const evalYear = u.lastEvalDate
                                                ? new Date(u.lastEvalDate).getFullYear()
                                                : (u.lastEvalPeriod ? u.lastEvalPeriod.split('-')[0] : null);
                                            return (
                                                <tr
                                                    key={u._id || u.id}
                                                    className="hover:bg-slate-50/80 border-b text-xs transition-colors duration-150 cursor-pointer"
                                                    onClick={() => setSelectedOperatorForEval(u._id || u.id)}
                                                >
                                                    <td className="p-3 font-bold">{u.fullName || u.name}</td>
                                                    <td className="p-3">{u.empId || u.cardNo || "-"}</td>
                                                    <td className="p-3">
                                                        {u.lastEvalDate ? new Date(u.lastEvalDate).toLocaleDateString('en-GB') : "No Evaluation"}
                                                    </td>
                                                    <td className="p-3 font-semibold text-amber-600">{u.primaryLevel || u.currentLevel || "-"}</td>
                                                    <td className="p-3">{stationLabel || "-"}</td>
                                                    <td className="p-3">
                                                        {u.lastEvalSheetIndex ? `Sheet ${u.lastEvalSheetIndex}${evalYear ? ` (${evalYear})` : ""}` : "-"}
                                                    </td>
                                                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                        <Button
                                                            size="xs"
                                                            className="h-7 text-xs font-semibold px-3 bg-amber-500 hover:bg-amber-600 text-white"
                                                            onClick={() => setSelectedOperatorForEval(u._id || u.id)}
                                                        >
                                                            Evaluate
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                            {filteredEvalUsers.length > 0 && (
                                <div className="flex justify-between items-center px-3 py-2 border-t bg-slate-50 text-xs">
                                    <span className="text-slate-500">
                                        Showing {(evalOperatorsPage - 1) * evalOperatorsPerPage + 1}
                                        {"-"}{Math.min(evalOperatorsPage * evalOperatorsPerPage, filteredEvalUsers.length)} of {filteredEvalUsers.length} operators
                                    </span>
                                    <div className="flex gap-2 items-center">
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            className="h-7 px-3 border-slate-200"
                                            disabled={evalOperatorsPage <= 1}
                                            onClick={() => setEvalOperatorsPage(p => Math.max(1, p - 1))}
                                        >
                                            Previous
                                        </Button>
                                        <span className="font-semibold text-slate-600">
                                            Page {evalOperatorsPage} of {evalOperatorsTotalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            className="h-7 px-3 border-slate-200"
                                            disabled={evalOperatorsPage >= evalOperatorsTotalPages}
                                            onClick={() => setEvalOperatorsPage(p => Math.min(evalOperatorsTotalPages, p + 1))}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                {/* Skill Matrix Tab */}
                <TabsContent value="skillMatrix" className="space-y-6">
                    <SkillMatrix 
                        isEmbedded={true} 
                        onOperatorClick={(operatorId, deptId, sectId, lineId, subSectId) => {
                            setEvalDepartment(deptId);
                            setEvalSection(sectId);
                            setEvalLine(lineId);
                            setEvalSubSection(subSectId);
                            setSelectedOperatorForEval(operatorId);
                            handleTabChange("evaluation");
                        }}
                    />
                </TabsContent>
            </Tabs>
            {/* Create Plan Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-[450px] bg-white rounded-xl shadow-lg border border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <IconStars className="w-5 h-5 text-amber-500" />
                            Create Multi-Skilling Plan
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 text-black">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 uppercase">Department</Label>
                            <Select
                                value={createDept}
                                onValueChange={(val) => { setCreateDept(val); setCreateSection(""); }}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm">
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
                            <Label className="text-xs font-bold text-slate-600 uppercase">Section</Label>
                            <Select
                                value={createSection}
                                onValueChange={setCreateSection}
                                disabled={!createDept}
                            >
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm disabled:bg-slate-50">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableCreateSections.map((s) => (
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
                                <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm focus:ring-amber-500 text-sm">
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
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-10 px-5 rounded-lg text-sm"
                        >
                            Create
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Evaluation Sheet Confirm Dialog */}
            <Dialog open={!!deleteConfirmSheetId} onOpenChange={(open) => { if (!open) setDeleteConfirmSheetId(null); }}>
                <DialogContent className="bg-white rounded-xl shadow-lg border border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Delete Evaluation Sheet</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-slate-600">
                        Are you sure you want to permanently delete this evaluation sheet? If it was the active sheet, the previous sheet (if any) will become active and the operator's level and efficiency will be updated accordingly.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmSheetId(null)} className="border-slate-200">Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                try {
                                    await deleteEvaluationSheet(deleteConfirmSheetId).unwrap();
                                    toast.success("Evaluation sheet deleted successfully");
                                    setDeleteConfirmSheetId(null);
                                    if (selectedOperatorForEval) fetchEvaluationSheets(selectedOperatorForEval);
                                } catch (err) {
                                    toast.error(err?.data?.message || "Failed to delete evaluation sheet");
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MultiSkilling;
