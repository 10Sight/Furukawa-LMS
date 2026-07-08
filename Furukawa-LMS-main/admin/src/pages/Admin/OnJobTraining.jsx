import React, { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    IconClipboardList, 
    IconPlus, 
    IconSearch, 
    IconArrowLeft, 
    IconCalendar,
    IconUser,
    IconFileText,
    IconCheck,
    IconX,
    IconLoader,
    IconEdit,
    IconTrash,
    IconCopy
} from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetAllOnJobTrainingsQuery, useDeleteOnJobTrainingMutation, useGetServerLanIpQuery } from "@/Redux/AllApi/OnJobTrainingApi";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

// Sub-components
import CreateOJTDialog from "@/components/admin/CreateOJTDialog";
import OJTTrainingRecordSheet from "@/components/admin/OJTTrainingRecordSheet";


const OnJobTraining = () => {
    const { user: authUser } = useSelector((state) => state.auth);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    const hasPermission = (permission) => {
        if (!authUser) return false;
        if (authUser.role === "SUPERADMIN" || authUser.isAdmin) return true;
        if (authUser.role === "INSTRUCTOR" || authUser.isTrainer) return true;
        return authUser.customRole?.permissions?.includes(permission);
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const queryDepartmentId = searchParams.get("departmentId") || "";
    const querySectionId = searchParams.get("sectionId") || "";
    const queryLineId = searchParams.get("lineId") || "";
    const querySubSectionId = searchParams.get("subSectionId") || "";
    const queryOpenCreate = searchParams.get("openCreate") === "true";
    const queryOjtId = searchParams.get("ojtId") || "";

    // 1. Cascading Filter State
    const [selectedDepartment, setSelectedDepartment] = useState(queryDepartmentId);
    const [selectedSection, setSelectedSection] = useState(querySectionId);
    const [selectedLine, setSelectedLine] = useState(queryLineId);
    const [selectedSubSection, setSelectedSubSection] = useState(querySubSectionId);

    // 2. UI View State
    const [selectedOjt, setSelectedOjt] = useState(queryOjtId ? { id: queryOjtId } : null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    useEffect(() => {
        if (queryOpenCreate) {
            setCreateDialogOpen(true);
            const newParams = new URLSearchParams(searchParams);
            newParams.delete("openCreate");
            setSearchParams(newParams, { replace: true });
        }
    }, [queryOpenCreate, searchParams, setSearchParams]);

    // 3. Hierarchy Queries
    const { data: deptData, isLoading: deptLoading } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
    const { data: sectionData, isLoading: sectionLoading } = useGetSectionsByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: lineData, isLoading: lineLoading } = useGetLinesBySectionQuery(selectedSection, { skip: !selectedSection });
    const { data: subSectionData, isLoading: subSectionLoading } = useGetSubSectionsByLineQuery(selectedLine, { skip: !selectedLine });

    // 4. OJT List Query
    const { data: ojtData, isLoading: ojtLoading, refetch } = useGetAllOnJobTrainingsQuery({
        departmentId: selectedDepartment || undefined,
        sectionId: selectedSection || undefined,
        lineId: selectedLine || undefined,
        subSectionId: selectedSubSection || undefined
    });

    const [deleteOjt, { isLoading: isDeleting }] = useDeleteOnJobTrainingMutation();
    const { data: lanIpData } = useGetServerLanIpQuery();

    const handleCopyLink = async (ojt) => {
        if (!ojt.shareToken) {
            toast.error("Share link is not available for this record");
            return;
        }
        // Use the server's actual LAN IP (auto-detected, not window.location.origin) so the
        // link still works when opened from another PC — "localhost" would only resolve on this machine.
        const lanIp = lanIpData?.data?.lanIp;
        const port = window.location.port ? `:${window.location.port}` : "";
        const origin = lanIp ? `${window.location.protocol}//${lanIp}${port}` : window.location.origin;
        const link = `${origin}/ojt/share/${ojt.shareToken}`;
        try {
            await navigator.clipboard.writeText(link);
            toast.success("Link copied to clipboard");
        } catch {
            toast.error("Failed to copy link");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this OJT record?")) {
            try {
                await deleteOjt(id).unwrap();
                toast.success("OJT Record Deleted Successfully");
                refetch();
            } catch (error) {
                toast.error(error?.data?.message || "Failed to delete OJT record");
            }
        }
    };

    const departments = deptData?.data?.departments || [];
    const sections = sectionData?.data || [];
    const lines = lineData?.data || [];
    const subSections = subSectionData?.data || [];
    const ojtList = ojtData?.data || [];

    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, authUser, isAdmin]);

    const assignableSections = useMemo(() => {
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!authUser || isAdmin || assignedIds.length === 0) return sections;
        return sections.filter(s => assignedIds.includes(String(s._id || s.id)));
    }, [sections, authUser, isAdmin]);

    const isRestricted = !isAdmin && authUser && (
        (authUser.departments?.length > 0) || authUser.departmentId ||
        (authUser.sections?.length > 0) || authUser.sectionId
    );

    useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length === 1 && !selectedDepartment)
            setSelectedDepartment(String(assignableDepartments[0]._id || assignableDepartments[0].id));
        if (selectedDepartment && assignableSections.length === 1 && !selectedSection)
            setSelectedSection(String(assignableSections[0]._id || assignableSections[0].id));
    }, [isRestricted, assignableDepartments, assignableSections, selectedDepartment, selectedSection]);

    // Result Badge Helper
    const getResultBadge = (result) => {
        switch (result) {
            case "Approved":
            case "Pass":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                        <IconCheck className="h-3 w-3" /> Approved
                    </span>
                );
            case "Rejected":
            case "Fail":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
                        <IconX className="h-3 w-3" /> Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                        <IconLoader className="h-3 w-3 animate-spin" /> Pending
                    </span>
                );
        }
    };

    return (
        <div className="space-y-4 max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
            {/* Header section */}
            <div className="p-6 border rounded bg-white flex items-center justify-between">
                <h1 className="text-xl font-bold">On Job Training (OJT) Forms</h1>
                {hasPermission("on_job_training:create") && (
                    <Button onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2">
                        <IconPlus className="h-4 w-4" /> Start OJT Session
                    </Button>
                )}
            </div>

            {/* Sub-view rendering */}
            {selectedOjt ? (
                <div className="p-6 border rounded bg-white">
                    <OJTTrainingRecordSheet
                        ojtId={selectedOjt.id || selectedOjt._id}
                        studentName="On Job Training"
                        readOnly={isReadOnly}
                        onBack={() => {
                            setSelectedOjt(null);
                            const newParams = new URLSearchParams(searchParams);
                            newParams.delete("ojtId");
                            setSearchParams(newParams, { replace: true });
                        }}
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Filter Card */}
                    <div className="p-6 border rounded bg-white space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Saved OJT Training Sheets</h2>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                    setSelectedDepartment("");
                                    setSelectedSection("");
                                    setSelectedLine("");
                                    setSelectedSubSection("");
                                }} 
                                className="text-blue-600 hover:text-blue-700 h-auto p-0 font-medium text-xs"
                            >
                                Clear Filters
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Department */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Department</label>
                                <Select value={selectedDepartment} onValueChange={(val) => {
                                    setSelectedDepartment(val);
                                    setSelectedSection("");
                                    setSelectedLine("");
                                    setSelectedSubSection("");
                                }} disabled={isRestricted && assignableDepartments.length <= 1}>
                                    <SelectTrigger className="h-8 text-xs font-semibold">
                                        <SelectValue placeholder="All Departments" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[240px]">
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {deptLoading ? (
                                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                                        ) : (
                                            assignableDepartments.map(d => (
                                                <SelectItem key={d._id || d.id} value={String(d._id || d.id)}>{d.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Section */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Section</label>
                                <Select value={selectedSection} onValueChange={(val) => {
                                    setSelectedSection(val);
                                    setSelectedLine("");
                                    setSelectedSubSection("");
                                }} disabled={(!selectedDepartment || selectedDepartment === "all") || (isRestricted && assignableSections.length <= 1)}>
                                    <SelectTrigger className="h-8 text-xs font-semibold">
                                        <SelectValue placeholder="All Sections" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[240px]">
                                        <SelectItem value="all">All Sections</SelectItem>
                                        {sectionLoading ? (
                                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                                        ) : (
                                            assignableSections.map(s => (
                                                <SelectItem key={s._id || s.id} value={String(s._id || s.id)}>{s.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Line */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Line</label>
                                <Select value={selectedLine} onValueChange={(val) => {
                                    setSelectedLine(val);
                                    setSelectedSubSection("");
                                }} disabled={!selectedSection || selectedSection === "all"}>
                                    <SelectTrigger className="h-8 text-xs font-semibold">
                                        <SelectValue placeholder="All Lines" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[240px]">
                                        <SelectItem value="all">All Lines</SelectItem>
                                        {lineLoading ? (
                                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                                        ) : (
                                            lines.map(l => (
                                                <SelectItem key={l._id || l.id} value={String(l._id || l.id)}>{l.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sub-Section */}
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Sub-Section</label>
                                <Select value={selectedSubSection} onValueChange={setSelectedSubSection} disabled={!selectedLine || selectedLine === "all"}>
                                    <SelectTrigger className="h-8 text-xs font-semibold">
                                        <SelectValue placeholder="All Sub-Sections" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[240px]">
                                        <SelectItem value="all">All Sub-Sections</SelectItem>
                                        {subSectionLoading ? (
                                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                                        ) : (
                                            subSections.map(ss => (
                                                <SelectItem key={ss._id || ss.id} value={String(ss._id || ss.id)}>{ss.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Records Table Card */}
                    <div className="p-6 border rounded bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Active Evaluations</h3>
                                <p className="text-xs text-slate-500">Evaluations matching filters: {ojtList.length}</p>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={refetch}
                                className="h-8 text-xs font-semibold"
                            >
                                Refresh Table
                            </Button>
                        </div>

                        {ojtLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <IconLoader className="h-8 w-8 text-blue-600 animate-spin" />
                                <p className="text-sm font-semibold text-slate-500">Loading training records...</p>
                            </div>
                        ) : ojtList.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/75">
                                        <TableRow>
                                            <TableHead className="w-[100px] text-xs font-bold text-slate-500 uppercase tracking-wider pl-6">ID</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Section & Line</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sub-Section & Machine</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Training Topic</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Created On</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prepared By</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider">Result</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ojtList.map((ojt, i) => (
                                            <TableRow key={ojt.id || ojt._id || i} className="hover:bg-slate-100/70 transition-colors cursor-pointer" onClick={() => { setSelectedOjt(ojt); setIsReadOnly(true); }}>
                                                <TableCell className="font-semibold text-sm pl-6 text-slate-400">
                                                    #{String(ojt.id || ojt._id).slice(-4).toUpperCase()}
                                                </TableCell>
                                                <TableCell className="font-bold text-blue-900 text-sm">
                                                    {ojt.department?.name || "-"}
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm">
                                                    <div className="font-semibold text-slate-800">{ojt.section?.name || "-"}</div>
                                                    <div className="text-xs text-slate-500">{ojt.line?.name || "No Line"}</div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-sm">
                                                    <div className="font-semibold text-slate-800">{ojt.subSection?.name || "-"}</div>
                                                    <div className="text-xs text-slate-500">{ojt.machine?.name || "No Machine"}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-slate-800 text-sm">{ojt.trainingTopic || ojt.name || "-"}</div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <IconCalendar className="h-3.5 w-3.5 text-slate-400" />
                                                        {ojt.trainingDate ? new Date(ojt.trainingDate).toLocaleDateString() : "Date not set"}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-500 text-sm">
                                                    {new Date(ojt.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-slate-700 text-sm font-semibold uppercase">
                                                    {ojt.creatorName || ojt.trainingGivenBy || "--"}
                                                </TableCell>
                                                <TableCell>
                                                    {getResultBadge(ojt.result)}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyLink(ojt);
                                                            }}
                                                            className="border-slate-200 text-slate-700 hover:text-slate-800 hover:bg-slate-50 rounded-lg shadow-sm flex items-center gap-1.5 h-8 px-2.5"
                                                            title="Copy shareable link"
                                                        >
                                                            <IconCopy className="h-3.5 w-3.5" /> Copy Link
                                                        </Button>
                                                        {hasPermission("on_job_training:update") && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedOjt(ojt);
                                                                    setIsReadOnly(false);
                                                                }}
                                                                className="border-slate-200 text-blue-700 hover:text-blue-800 hover:bg-blue-50 rounded-lg shadow-sm flex items-center gap-1.5 h-8 px-2.5"
                                                            >
                                                                <IconEdit className="h-3.5 w-3.5" /> Edit
                                                            </Button>
                                                        )}
                                                        {hasPermission("on_job_training:delete") && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={isDeleting}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(ojt.id || ojt._id);
                                                                }}
                                                                className="border-slate-200 text-rose-600 hover:text-rose-750 hover:bg-rose-50 rounded-lg shadow-sm flex items-center gap-1.5 h-8 px-2.5"
                                                            >
                                                                <IconTrash className="h-3.5 w-3.5" /> Delete
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50">
                                <IconClipboardList className="h-16 w-16 text-slate-300 mb-4" />
                                <h4 className="text-slate-800 font-bold text-lg mb-1">No OJT Sessions Found</h4>
                                <p className="text-slate-500 text-sm max-w-[360px] text-center mb-6">
                                    There are no On Job Training sessions launched under these filters yet. Click the button to start one!
                                </p>
                                {hasPermission("on_job_training:create") && (
                                    <Button 
                                        onClick={() => setCreateDialogOpen(true)}
                                        className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-md flex items-center gap-2 h-10 px-5"
                                    >
                                        <IconPlus className="h-4.5 w-4.5" /> Start Training Session
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create OJT session dialog */}
            <CreateOJTDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSuccess={(newOjt) => {
                    refetch();
                    if (newOjt) {
                        setSelectedOjt(newOjt);
                        setIsReadOnly(false);
                    }
                }}
                initialDepartmentId={queryDepartmentId || (isRestricted ? selectedDepartment : "")}
                initialSectionId={querySectionId || (isRestricted ? selectedSection : "")}
                initialLineId={queryLineId}
                initialSubSectionId={querySubSectionId}
            />
        </div>
    );
};

export default OnJobTraining;
