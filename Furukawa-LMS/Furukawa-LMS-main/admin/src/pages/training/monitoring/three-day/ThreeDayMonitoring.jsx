
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/common/ui/card.jsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/forms/primitives/select.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/tables/primitives/table.jsx";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
import { useGetLinesBySectionQuery } from "@/services/api/LineApi.js";
import { useGetInstructorByIdQuery } from "@/services/api/InstructorApi.js";
import { 
    IconCalendarStats, 
    IconHierarchy2, 
    IconSearch, 
    IconUsersGroup, 
    IconArrowLeft, 
    IconPlus, 
    IconDatabase,
    IconLayoutDashboard,
    IconChevronLeft,
    IconChevronRight
} from "@tabler/icons-react";
import ThreeDayMonitoringSheet from "@/components/common/training/ThreeDayMonitoringSheet.jsx";
import { Avatar, AvatarFallback } from "@/components/common/ui/avatar.jsx";
import { Badge } from "@/components/common/ui/badge.jsx";
import { cn } from "@/utils/classNames.js";
import axiosInstance from "@/services/requests/axiosInstance.js";

const EMPTY_ARRAY = [];

// Monitoring stack paging / search.
const PAGE_SIZE_OPTIONS = [10, 25, 30, 50, 100];
const DEFAULT_PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 500;

// Builds a compact page-number list around the current page, e.g. [1, "...", 4, 5, 6, "...", 20].
const getPageNumbers = (current, total) => {
    const WINDOW = 1;
    const pages = [1];
    if (current - WINDOW > 2) pages.push("...");
    for (let p = Math.max(2, current - WINDOW); p <= Math.min(total - 1, current + WINDOW); p++) pages.push(p);
    if (current + WINDOW < total - 1) pages.push("...");
    if (total > 1) pages.push(total);
    return pages;
};
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
    const navigate = useNavigate();

    // Selections
    const [dept, setDept] = useState(() => '');
    const [section, setSection] = useState(() => '');
    const [line, setLine] = useState(() => '');
    const [studentId, setStudentId] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [forceNewAttempt, setForceNewAttempt] = useState(false);

    // Monitoring Status List
    const [monitoringList, setMonitoringList] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [monitoringTotalPages, setMonitoringTotalPages] = useState(1);
    const [monitoringTotalCount, setMonitoringTotalCount] = useState(0);
    const [monitoringPageSize, setMonitoringPageSize] = useState(DEFAULT_PAGE_SIZE);

    // Server-side search, debounced so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Page resets to 1 whenever the filters change. Tracked against the filter key (rather than
    // a reset effect) so a filter change triggers exactly one fetch, not a stale-page fetch first.
    const listFilterKey = `${dept}|${section}|${line}|${debouncedSearchTerm}|${monitoringPageSize}`;
    const [pageState, setPageState] = useState({ key: listFilterKey, page: 1 });
    const monitoringPage = pageState.key === listFilterKey ? pageState.page : 1;
    const setMonitoringPage = (next) => setPageState({ key: listFilterKey, page: next });

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

    // Sections the user is assigned to (primary sectionId plus the `sections` list);
    // admins and users with no section assignment see every section of the department.
    const assignedSectionIds = useMemo(() => {
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);
        return [...new Set(rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean))];
    }, [authUser]);

    const assignableSections = useMemo(() => {
        if (!authUser || isAdmin || assignedSectionIds.length === 0) return sections;
        return sections.filter(s => assignedSectionIds.includes(String(s.id || s._id)));
    }, [sections, authUser, isAdmin, assignedSectionIds]);

    // Fetch Monitoring Status List. Each call aborts the one still in flight, so switching
    // filters or typing in search never lets a slower, stale response overwrite a newer one.
    const listAbortRef = useRef(null);
    const fetchMonitoringList = async () => {
        if (!dept || activeTab !== 'stack' || studentId) return;
        listAbortRef.current?.abort();
        const controller = new AbortController();
        listAbortRef.current = controller;
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
                },
                signal: controller.signal,
            });
            if (res.data.success) {
                setMonitoringList(res.data.data.list || []);
                setMonitoringTotalPages(res.data.data.totalPages || 1);
                setMonitoringTotalCount(res.data.data.totalCount || 0);
            }
        } catch (error) {
            if (axios.isCancel(error)) return;
            console.error("Error fetching monitoring list:", error);
        } finally {
            if (listAbortRef.current === controller) {
                listAbortRef.current = null;
                setLoadingList(false);
            }
        }
    };

    useEffect(() => {
        if (dept && !studentId && activeTab === 'stack') {
            fetchMonitoringList();
        }
    }, [dept, section, line, studentId, activeTab, monitoringPage, monitoringPageSize, debouncedSearchTerm]);

    // Drop any in-flight list request when leaving the page.
    useEffect(() => () => listAbortRef.current?.abort(), []);

    // If the list shrank under the current page (e.g. operators dropped out since it was
    // loaded), step back to the last page that still has rows.
    useEffect(() => {
        const lastPage = Math.max(1, monitoringTotalPages);
        if (!loadingList && monitoringPage > lastPage) setMonitoringPage(lastPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadingList, monitoringPage, monitoringTotalPages]);

    const monitoringRangeStart = monitoringTotalCount === 0 ? 0 : (monitoringPage - 1) * monitoringPageSize + 1;
    const monitoringRangeEnd = Math.min(monitoringPage * monitoringPageSize, monitoringTotalCount);

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
            // Only pin the section (and line) when the user has exactly one; with several
            // assigned sections they start on "All Sections" and can pick among them.
            if (assignedSectionIds.length === 1) {
                setSection(assignedSectionIds[0]);
                if (authUser.lineId) setLine(authUser.lineId);
            } else if (assignedSectionIds.length > 1 && !section) {
                setSection("0");
            }
        } else if (assignableDepartments.length === 1 && !dept) {
            setDept(assignableDepartments[0].id || assignableDepartments[0]._id);
        }
    }, [isEmployee, isSelectionLocked, authUser, assignableDepartments, assignedSectionIds, paramStudentId, studentId, paramStudentData]);

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

    // Staff open a sheet from the stack into a full-screen view; employees only ever see their
    // own sheet (there's no stack to return to), so they keep the regular in-layout page.
    const isFullScreenSheet = Boolean(studentId) && !isEmployee && activeTab === 'stack';

    // Header context — selectedStudent comes from the stack list, which isn't fetched on a
    // deep link, so fall back to the operator looked up from the URL param.
    const sheetOperator = selectedStudent || paramStudentData?.data;

    // Returns to the stack with department/section/line filters intact. On a deep link
    // (/3-day-monitoring/:studentId) drop the id segment from the URL too, otherwise the
    // init effect would immediately reopen the sheet.
    const handleBackToStack = () => {
        if (paramStudentId) navigate('..', { relative: 'path' });
        setStudentId("");
        setForceNewAttempt(false);
    };

    // Escape closes the full-screen sheet — but not while a dialog/popover/dropdown is open
    // (Escape is closing that instead) or while the user is typing in a cell.
    useEffect(() => {
        if (!isFullScreenSheet) return;
        const onKeyDown = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            const target = e.target;
            if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
            if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')) return;
            handleBackToStack();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFullScreenSheet, paramStudentId]);

    // Stop the page underneath from scrolling while the full-screen sheet is open.
    useEffect(() => {
        if (!isFullScreenSheet) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isFullScreenSheet]);

    // Visible width of the full-screen scroll container, so the header's controls stay in
    // view while its bar stretches to the full (horizontally scrollable) sheet width.
    const [headerActionsEl, setHeaderActionsEl] = useState(null);
    const [fullScreenScrollEl, setFullScreenScrollEl] = useState(null);
    const [fullScreenViewportWidth, setFullScreenViewportWidth] = useState(0);
    useEffect(() => {
        if (!fullScreenScrollEl) return;
        const update = () => setFullScreenViewportWidth(fullScreenScrollEl.clientWidth);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(fullScreenScrollEl);
        return () => observer.disconnect();
    }, [fullScreenScrollEl]);

    // Height of the sticky full-screen header, exposed as --sheet-sticky-top so the sheet's
    // table header can freeze just beneath it (the header wraps, so its height varies).
    const [fullScreenHeaderEl, setFullScreenHeaderEl] = useState(null);
    useEffect(() => {
        if (!fullScreenHeaderEl || !fullScreenScrollEl) return;
        const update = () => fullScreenScrollEl.style.setProperty('--sheet-sticky-top', `${fullScreenHeaderEl.offsetHeight}px`);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(fullScreenHeaderEl);
        return () => observer.disconnect();
    }, [fullScreenHeaderEl, fullScreenScrollEl]);

    const getStatusBadge = (status, verifiedBy, approvedBy) => {
        if (!status || status === 'Draft') return { label: 'Draft', color: 'bg-slate-100 text-slate-600 border-slate-200' };
        if (verifiedBy?.includes('Rejected') || approvedBy?.includes('Rejected')) {
            return { label: 'Rejected', color: 'bg-red-100 text-red-600 border-red-200' };
        }
        if (approvedBy?.includes('Approved')) return { label: 'Approved', color: 'bg-emerald-100 text-emerald-600 border-emerald-200' };
        if (status === 'Submitted') return { label: 'Submitted', color: 'bg-blue-100 text-blue-600 border-blue-200' };
        return { label: status, color: 'bg-slate-100 text-slate-600 border-slate-200' };
    };

    // The opened operator's own department/section — the filters only narrow the stack, and a
    // user with several sections may be on "All Sections" or a different one. Falls back to
    // the filter selection only while the operator's details haven't loaded.
    const operatorDept = sheetOperator?.departmentName || sheetOperator?.deptName || sheetOperator?.department?.name
        || assignableDepartments.find(d => String(d.id || d._id) === String(dept))?.name;
    const operatorSection = sheetOperator?.sectionName || sheetOperator?.section?.name
        || sections.find(s => String(s.id) === String(section))?.name;

    // Portaled to <body> so the view escapes the layout's stacking contexts and covers the
    // sidebar and top navbar; Radix popovers/dialogs portal in after it and still sit on top.
    if (isFullScreenSheet) {
        const operatorName = sheetOperator?.fullName || sheetOperator?.name || "Operator";
        const operatorCode = sheetOperator?.empId;

        return createPortal(
            <div ref={setFullScreenScrollEl} className="fixed inset-0 z-50 bg-slate-100 overflow-auto w-screen h-screen animate-in fade-in duration-200">
                {/* Grows to the widest sheet so the header bar spans the whole horizontal scroll */}
                <div className="min-w-full w-max min-h-full flex flex-col">
                    <div ref={setFullScreenHeaderEl} className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm print:hidden">
                        <div
                            className="sticky left-0"
                            style={{ width: fullScreenViewportWidth || '100vw' }}
                        >
                            {/* Navigation + operator identity | shortcut hint */}
                            <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                                <div className="flex items-center gap-4 min-w-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-1.5 shrink-0 -ml-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50"
                                        onClick={handleBackToStack}
                                    >
                                        <IconArrowLeft size={16} />
                                        Back to Stack
                                    </Button>
                                    <div className="h-9 w-px bg-slate-200 shrink-0" />
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Avatar className="h-10 w-10 ring-2 ring-amber-100 shrink-0">
                                            <AvatarFallback className="bg-amber-50 text-amber-600 font-bold text-xs">
                                                {operatorName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className="text-sm font-bold text-slate-800 leading-none truncate">{operatorName}</span>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {operatorCode && (
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold px-1.5 py-0">
                                                        #{operatorCode}
                                                    </Badge>
                                                )}
                                                {(operatorDept || operatorSection) && (
                                                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-semibold px-1.5 py-0 max-w-[260px] truncate">
                                                        {[operatorDept, operatorSection].filter(Boolean).join(' / ')}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-medium whitespace-nowrap">
                                    Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500">Esc</kbd> to close
                                </div>
                            </div>

                            {/* Row 2: action toolbar — ThreeDayMonitoringSheet portals its attempt
                                history, 3-day status, save/submit/email and print controls here */}
                            <div ref={setHeaderActionsEl} className="border-t border-slate-200/80 bg-slate-50/80 empty:hidden" />
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 pb-20">
                        <ThreeDayMonitoringSheet
                            studentId={studentId}
                            departmentId={dept}
                            departmentName={operatorDept}
                            sectionName={operatorSection}
                            readOnly={false}
                            initialForceNewAttempt={forceNewAttempt}
                            headerActionsContainer={headerActionsEl}
                        />
                    </div>
                </div>
            </div>,
            document.body
        );
    }

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
                                    disabled={(!dept && !isSelectionLocked) || (!isAdmin && assignedSectionIds.length === 1 && !!section)}
                                >
                                    <SelectTrigger className="h-10 bg-white border-slate-200"><SelectValue placeholder="Select Section" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">All Sections</SelectItem>
                                        {assignableSections.map((s) => (
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
                                departmentName={operatorDept}
                                sectionName={operatorSection}
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
                                        // Skeleton rows at the real row height so the table doesn't jump when data lands
                                        Array.from({ length: 6 }, (_, i) => (
                                            <TableRow key={`skeleton-${i}`} className="border-slate-100 h-16">
                                                <TableCell className="pl-6">
                                                    <div className="flex items-center gap-3 animate-pulse">
                                                        <div className="h-9 w-9 rounded-full bg-slate-200" />
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="h-3 w-32 rounded bg-slate-200" />
                                                            <div className="h-2.5 w-16 rounded bg-slate-100" />
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell><div className="h-5 w-20 rounded-full bg-slate-200 animate-pulse" /></TableCell>
                                                <TableCell><div className="h-3 w-28 rounded bg-slate-200 animate-pulse" /></TableCell>
                                                <TableCell><div className="h-3 w-20 rounded bg-slate-200 animate-pulse" /></TableCell>
                                                <TableCell className="pr-6">
                                                    <div className="ml-auto h-8 w-24 rounded-md bg-slate-200 animate-pulse" />
                                                </TableCell>
                                            </TableRow>
                                        ))
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
                            {/* Pagination */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-slate-200 bg-slate-50/50">
                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                    <span>
                                        {monitoringTotalCount === 0
                                            ? "No operators"
                                            : `Showing ${monitoringRangeStart}-${monitoringRangeEnd} of ${monitoringTotalCount} operators`}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span>Rows per page</span>
                                        <Select value={String(monitoringPageSize)} onValueChange={(val) => setMonitoringPageSize(Number(val))}>
                                            <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200 text-xs shadow-none">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PAGE_SIZE_OPTIONS.map(size => (
                                                    <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {monitoringTotalPages > 1 && (
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMonitoringPage(monitoringPage - 1)}
                                            disabled={monitoringPage <= 1 || loadingList}
                                            className="h-8 px-2.5 text-xs"
                                            aria-label="Previous page"
                                        >
                                            <IconChevronLeft className="h-3.5 w-3.5" />
                                        </Button>
                                        {getPageNumbers(monitoringPage, monitoringTotalPages).map((p, idx) =>
                                            p === "..." ? (
                                                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                                            ) : (
                                                <Button
                                                    key={p}
                                                    variant={p === monitoringPage ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setMonitoringPage(p)}
                                                    disabled={loadingList}
                                                    className={cn("h-8 w-8 p-0 text-xs", p === monitoringPage && "bg-amber-500 hover:bg-amber-600")}
                                                >
                                                    {p}
                                                </Button>
                                            )
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMonitoringPage(monitoringPage + 1)}
                                            disabled={monitoringPage >= monitoringTotalPages || loadingList}
                                            className="h-8 px-2.5 text-xs"
                                            aria-label="Next page"
                                        >
                                            <IconChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
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
