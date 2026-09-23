import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from "react-dom";
import * as XLSX from 'xlsx';
import {
    useDojoRegisterMutation,
    useGetTemporaryUsersQuery,
    useLazyGetTemporaryUsersQuery,
    useUpdateUserMutation,
    useDeleteUserMutation,
    useImportDojoCandidatesMutation,
    useLazyGetDojoImportTemplateQuery
} from "@/Redux/AllApi/UserApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesBySubSectionQuery } from "@/Redux/AllApi/MachineApi";
import { useGetAllContractorsQuery } from "@/Redux/AllApi/ContractorApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from "date-fns";
import { safeDateFormat, dateToInputFormat } from "@/utils/dateUtils";
import ExportColumnSelectorModal from "@/components/common/ExportColumnSelectorModal";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    IconPlus,
    IconUserPlus,
    IconLoader,
    IconSearch,
    IconBuilding,
    IconUser,
    IconBriefcase,
    IconCalendar,
    IconMail,
    IconPhone,
    IconMapPin,
    IconBus,
    IconUsers,
    IconSchool,
    IconArrowRight,
    IconCheck,
    IconPoint,
    IconCircleCheck,
    IconEye,
    IconPencil,
    IconTrash,
    IconAlertCircle,
    IconUpload,
    IconDownload,
    IconInfoCircle,
    IconX,
    IconHistory,
    IconUserMinus,
    IconClock,
    IconAlertTriangle
} from "@tabler/icons-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import StatCard from "@/components/common/StatCard";
import FilterBar from "@/components/common/FilterBar";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import useTranslate from "@/hooks/useTranslate";

// Section tab component imports
import TestPaper from "./TestPaper";
import EvaluationTestList from "./EvaluationTest/EvaluationTestList";
import HandoverSheetPage from "./HandoverSheetPage";
import SixteenDayMonitoring from "./SixteenDayMonitoring";
import Course from "./Course";
import DojoHiringConfig from "./DojoHiringConfig";
import ShiftScheduler from "@/components/admin/ShiftScheduler";

const LEAVING_REASONS = [
    "Employee not response",
    "Exam",
    "Family Function",
    "Marriage",
    "Family Problem",
    "Festival",
    "Health Problem",
    "Join other company",
    "Indiscipline case",
];

const LEAVING_REASONS_MAP = {
    "Employee not response": "noResponse",
    "Exam": "exam",
    "Family Function": "familyFunction",
    "Marriage": "marriage",
    "Family Problem": "familyProblem",
    "Festival": "festival",
    "Health Problem": "healthProblem",
    "Join other company": "joinOtherCompany",
    "Indiscipline case": "indisciplineCase",
};

const normalizeStatus = (status) => {
    const s = status || "PRESENT";
    if (s === "LEAVE") return "ON_LEAVE";
    return s;
};

const formatDuration = (totalSeconds) => {
    const seconds = Math.max(0, Math.round(totalSeconds || 0));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
};

const DojoHiring = () => {
    const { t, language } = useTranslate();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentUser = useSelector((state) => state.auth.user);

    // Support high-level tabs switching
    const tabParam = searchParams.get("tab");
    const [dojoTab, setDojoTab] = useState(tabParam || "dojoHiring");

    useEffect(() => {
        if (tabParam) {
            setDojoTab(tabParam);
        }
    }, [tabParam]);

    const handleDojoTabChange = (value) => {
        setDojoTab(value);
        setSearchParams({ tab: value });
    };

    const hasPermission = (permission) => {
        if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
        return currentUser?.customRole?.permissions?.includes(permission);
    };

    const canRead = hasPermission("dojo_hiring:read");
    const canCreate = hasPermission("dojo_hiring:create");
    const canUpdate = hasPermission("dojo_hiring:update");
    const canDelete = hasPermission("dojo_hiring:delete");

    const [logAction] = useLogActionMutation();

    useEffect(() => {
        if (!canRead) return;
        logAction({ action: "VIEW_DOJO_HIRING", details: { page: "Dojo Hiring" } })
            .unwrap()
            .catch((err) => console.error("Failed to log page view:", err));
    }, [canRead, logAction]);

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    // Reason of Leaving dropdown state (used inside Add/Edit form)
    const [leavingReasonOption, setLeavingReasonOption] = useState("");
    const [customLeavingReason, setCustomLeavingReason] = useState("");
    // Quick status change ("Left") confirmation dialog state
    const [isLeftConfirmOpen, setIsLeftConfirmOpen] = useState(false);
    const [leftConfirmTarget, setLeftConfirmTarget] = useState(null);
    const [leftConfirmDate, setLeftConfirmDate] = useState("");
    const [leftConfirmReason, setLeftConfirmReason] = useState("");
    const [leftConfirmCustomReason, setLeftConfirmCustomReason] = useState("");
    const [isLeftConfirmSubmitting, setIsLeftConfirmSubmitting] = useState(false);
    const [importProgress, setImportProgress] = useState({
        total: 0,
        success: 0,
        failed: 0,
        timeElapsed: 0,
        errors: [],
        done: false,
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState("all");
    const [genderFilter, setGenderFilter] = useState("ALL");
    const [deptFilter, setDeptFilter] = useState("ALL");
    const [reasonOfLeavingFilter, setReasonOfLeavingFilter] = useState("ALL");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [formData, setFormData] = useState({
        fullName: "", empId: "", idCard: "", fatherHusbandName: "", gender: "MALE",
        designation: "", dob: "", joiningDate: new Date().toISOString().split('T')[0],
        departmentId: "", sectionId: "", lineId: "", subSectionId: "", stationId: "",
        education: "", email: "", phoneNumber: "", district: "", state: "",
        pin: "", busRoute: "", unit: "UNIT_1", status: "PRESENT",
        leavingDate: "", reasonOfLeaving: "", contractor: "", expectedHandover: "",
        shiftSchedule: {}, dojoShift: ""
    });

    const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);
    const [shiftStudent, setShiftStudent] = useState(null);
    const [shiftScheduleDraft, setShiftScheduleDraft] = useState({});
    const todayKey = format(new Date(), "yyyy-MM-dd");

    const location = useLocation();
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchTerm, genderFilter, deptFilter, reasonOfLeavingFilter, startDate, endDate]);

    useEffect(() => {
        setReasonOfLeavingFilter("ALL");
    }, [activeTab]);

    // Tick the elapsed time while an import is running
    useEffect(() => {
        if (!isImporting || importProgress.done) return;
        const interval = setInterval(() => {
            setImportProgress((prev) => ({ ...prev, timeElapsed: prev.timeElapsed + 1 }));
        }, 1000);
        return () => clearInterval(interval);
    }, [isImporting, importProgress.done]);

    // Warn before the user navigates away mid-import
    useEffect(() => {
        if (!isImporting) return;
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isImporting]);

    const [triggerGetTemporaryUsers] = useLazyGetTemporaryUsersQuery();
    const { data: tempUsersData, isLoading: isLoadingUsers, refetch } = useGetTemporaryUsersQuery({
        page: currentPage,
        search: searchTerm,
        gender: genderFilter !== "ALL" ? genderFilter : "",
        activeTab,
        departmentId: deptFilter !== "ALL" ? deptFilter : "",
        reasonOfLeaving: activeTab === "left" && reasonOfLeavingFilter !== "ALL" ? reasonOfLeavingFilter : "",
        startDate,
        endDate,
    });
    const [dojoRegister, { isLoading: isCreating }] = useDojoRegisterMutation();
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
    const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
    const [importDojoCandidates] = useImportDojoCandidatesMutation();
    const [triggerGetTemplate] = useLazyGetDojoImportTemplateQuery();

    const { data: deptsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(formData.departmentId, { skip: !formData.departmentId });
    const { data: linesData } = useGetLinesBySectionQuery(formData.sectionId, { skip: !formData.sectionId });
    const { data: subSectionsData } = useGetSubSectionsByLineQuery(formData.lineId, { skip: !formData.lineId });
    const { data: machinesData } = useGetMachinesBySubSectionQuery(formData.subSectionId, { skip: !formData.subSectionId });
    const { data: contractorsResponse } = useGetAllContractorsQuery();
    const contractorsList = contractorsResponse?.data || [];

    const departments = deptsData?.data?.departments || [];
    const sections = sectionsData?.data || [];
    const lines = linesData?.data || [];
    const subSections = subSectionsData?.data || [];
    const machines = machinesData?.data || [];
    const fileInputRef = React.useRef(null);

    useEffect(() => {
        setSelectedRows(new Set());
    }, [currentPage, searchTerm, genderFilter, activeTab, deptFilter, reasonOfLeavingFilter, startDate, endDate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            if (name === 'status' && value !== 'LEFT') {
                updated.leavingDate = "";
                updated.reasonOfLeaving = "";
            }
            if (name === 'departmentId') {
                updated.sectionId = "";
                updated.lineId = "";
                updated.subSectionId = "";
                updated.stationId = "";
            }
            if (name === 'sectionId') {
                updated.lineId = "";
                updated.subSectionId = "";
                updated.stationId = "";
            }
            if (name === 'lineId') {
                updated.subSectionId = "";
                updated.stationId = "";
            }
            if (name === 'subSectionId') {
                updated.stationId = "";
            }
            return updated;
        });
    };

    const handleOpenShiftDialog = (student) => {
        const resolved = typeof student.shiftSchedule === 'string'
            ? (() => { try { return JSON.parse(student.shiftSchedule); } catch (e) { return {}; } })()
            : (student.shiftSchedule || {});
        setShiftStudent(student);
        setShiftScheduleDraft(resolved);
        setIsShiftDialogOpen(true);
    };

    const handleSaveStudentShift = async () => {
        if (!shiftStudent) return;
        if (shiftStudent.isTemporary === 1 || shiftStudent.isTemporary === true || String(shiftStudent.isTemporary) === '1') {
            toast.error("Shift scheduling is not allowed for temporary users");
            return;
        }
        try {
            const cleanedSchedule = Object.fromEntries(
                Object.entries(shiftScheduleDraft).filter(([, v]) => v !== "REMOVE")
            );
            await updateUser({ id: shiftStudent.id, shiftSchedule: cleanedSchedule }).unwrap();
            toast.success("Shift schedule saved!");
            setIsShiftDialogOpen(false);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to save shift schedule");
        }
    };

    const handleLeavingReasonSelect = (value) => {
        setLeavingReasonOption(value);
        if (value === "Other") {
            setFormData(prev => ({ ...prev, reasonOfLeaving: customLeavingReason }));
        } else {
            setFormData(prev => ({ ...prev, reasonOfLeaving: value }));
        }
    };

    const handleCustomLeavingReasonChange = (e) => {
        const { value } = e.target;
        setCustomLeavingReason(value);
        setFormData(prev => ({ ...prev, reasonOfLeaving: value }));
    };

    const handleSubmit = async () => {
        if (!formData.fullName || !formData.empId) {
            toast.error("Name and Employee Code are required");
            return;
        }

        try {
            if (selectedUser) {
                // Update mode
                const payload = {
                    id: selectedUser.id,
                    ...formData,
                    empId: formData.empId,
                    contractorId: formData.contractorId ? Number(formData.contractorId) : null,
                };
                const isTemp = selectedUser.isTemporary === 1 || selectedUser.isTemporary === true || String(selectedUser.isTemporary) === '1';
                if (isTemp) {
                    // Temp users don't use shiftSchedule (they use dojoShift instead), and
                    // the backend rejects shiftSchedule updates for temp users outright.
                    delete payload.shiftSchedule;
                }
                await updateUser(payload).unwrap();
                toast.success("Employee details updated successfully");
                logAction({
                    action: "UPDATE_DOJO_USER",
                    details: { fullName: selectedUser.fullName, empId: selectedUser.empId },
                }).unwrap().catch((err) => console.error("Failed to log action:", err));
            } else {
                // Create mode
                const payload = {
                    ...formData,
                    empId: formData.empId,
                    isEmployee: true,
                    isTemporary: true,
                    role: "STUDENT",
                    status: "PRESENT",
                    password: formData.empId,
                    userName: formData.empId,
                    contractorId: formData.contractorId ? Number(formData.contractorId) : null,
                };
                // New candidates are always temporary and use dojoShift instead of shiftSchedule.
                delete payload.shiftSchedule;
                await dojoRegister(payload).unwrap();
                toast.success("Temporary employee registered successfully");
                logAction({
                    action: "ADD_DOJO_USER",
                    details: { fullName: formData.fullName, empId: formData.empId },
                }).unwrap().catch((err) => console.error("Failed to log action:", err));
            }

            closeModal();
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || `Failed to ${selectedUser ? 'update' : 'register'} employee`);
        }
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        try {
            await deleteUser(userToDelete.id).unwrap();
            toast.success("Candidate removed from pipeline");
            logAction({
                action: "DELETE_DOJO_USER",
                details: { fullName: userToDelete.fullName, empId: userToDelete.empId },
            }).unwrap().catch((err) => console.error("Failed to log action:", err));
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to remove candidate");
        }
    };

    const allUsers = tempUsersData?.data?.users || [];
    const totalPages = tempUsersData?.data?.totalPages || 1;
    const isAllSelected = allUsers.length > 0 && selectedRows.size === allUsers.length;

    const [goToPageInput, setGoToPageInput] = useState("");

    const getPageNumbers = () => {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];
        let last;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        range.forEach((i) => {
            if (last) {
                if (i - last === 2) {
                    rangeWithDots.push(last + 1);
                } else if (i - last !== 1) {
                    rangeWithDots.push("...");
                }
            }
            rangeWithDots.push(i);
            last = i;
        });

        return rangeWithDots;
    };

    const handleGoToPage = (e) => {
        e.preventDefault();
        const pageNum = parseInt(goToPageInput, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            setCurrentPage(pageNum);
            setGoToPageInput("");
        } else {
            toast.error(`Enter a page number between 1 and ${totalPages}`);
        }
    };

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(allUsers.map(u => u.id)));
        }
    };

    const handleBulkDelete = async () => {
        const targets = allUsers.filter(u => selectedRows.has(u.id));
        try {
            await Promise.all([...selectedRows].map(id => deleteUser(id).unwrap()));
            toast.success(`Removed ${selectedRows.size} candidates`);
            targets.forEach(({ fullName, empId }) => {
                logAction({ action: "DELETE_DOJO_USER", details: { fullName, empId } })
                    .unwrap()
                    .catch((err) => console.error("Failed to log action:", err));
            });
            setSelectedRows(new Set());
            setIsBulkDeleteOpen(false);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to remove some candidates");
            setIsBulkDeleteOpen(false);
        }
    };

    const handleQuickStatusChange = async (user, newStatus) => {
        if (newStatus === "LEFT") {
            setLeftConfirmTarget({ id: user.id, fullName: user.fullName, empId: user.empId });
            setLeftConfirmDate(format(new Date(), "yyyy-MM-dd"));
            setLeftConfirmReason("");
            setLeftConfirmCustomReason("");
            setIsLeftConfirmOpen(true);
            return;
        }
        try {
            await updateUser({ id: user.id, status: newStatus }).unwrap();
            const label = newStatus === "ON_LEAVE" ? "On Leave" : newStatus.charAt(0) + newStatus.slice(1).toLowerCase();
            toast.success(`Status updated to ${label}`);
            logAction({
                action: "UPDATE_DOJO_USER",
                details: { fullName: user.fullName, empId: user.empId, status: newStatus },
            }).unwrap().catch((err) => console.error("Failed to log action:", err));
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to update status");
        }
    };

    const handleConfirmLeftStatus = async () => {
        if (!leftConfirmTarget) return;

        if (!leftConfirmDate) {
            toast.error("Please select a date of leaving");
            return;
        }
        if (!leftConfirmReason) {
            toast.error("Please select a reason of leaving");
            return;
        }
        if (leftConfirmReason === "Other" && !leftConfirmCustomReason.trim()) {
            toast.error("Please specify the reason of leaving");
            return;
        }

        setIsLeftConfirmSubmitting(true);
        try {
            await updateUser({
                id: leftConfirmTarget.id,
                status: "LEFT",
                leavingDate: leftConfirmDate || null,
                reasonOfLeaving: (leftConfirmReason === "Other" ? leftConfirmCustomReason : leftConfirmReason)?.trim() || null,
            }).unwrap();
            toast.success("Status updated to Left");
            logAction({
                action: "UPDATE_DOJO_USER",
                details: { fullName: leftConfirmTarget.fullName, empId: leftConfirmTarget.empId, status: "LEFT" },
            }).unwrap().catch((err) => console.error("Failed to log action:", err));
            refetch();
            setIsLeftConfirmOpen(false);
            setLeftConfirmTarget(null);
        } catch (error) {
            toast.error(error?.data?.message || "Failed to update status");
        } finally {
            setIsLeftConfirmSubmitting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const toastId = toast.loading("Downloading template...");
            const result = await triggerGetTemplate().unwrap();

            const link = document.createElement("a");
            link.href = result.fileData;
            link.setAttribute("download", "dojo_import_template.xlsx");
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.dismiss(toastId);
            toast.success("Template downloaded successfully");
        } catch (error) {
            console.error("Download template error:", error);
            toast.error("Failed to download template");
        }
    };

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const closeImportOverlay = () => {
        setIsImporting(false);
        setImportProgress({
            total: 0,
            success: 0,
            failed: 0,
            timeElapsed: 0,
            errors: [],
            done: false,
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        e.target.value = null;

        if (!file.name.match(/\.(xlsx|xls)$/)) {
            toast.error("Please select an Excel file (.xlsx or .xls)");
            return;
        }

        // Parse the workbook client-side just to count valid rows for the progress summary;
        // the actual import still happens in a single request on the server.
        let rows;
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });

            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(allRows.length, 15); i++) {
                const row = allRows[i];
                if (row && Array.isArray(row) && row.some((cell) => {
                    if (!cell) return false;
                    const c = cell.toString().trim().toLowerCase();
                    return c === "employeeid" || c === "employee code" || c === "employee id";
                })) {
                    headerRowIndex = i;
                    break;
                }
            }
            if (headerRowIndex === -1) headerRowIndex = 0;

            const headers = allRows[headerRowIndex].map((h) => h?.toString().trim() || "");
            const rawData = allRows.slice(headerRowIndex + 1);
            rows = rawData
                .map((r) => {
                    const obj = {};
                    headers.forEach((h, idx) => {
                        obj[h || `__EMPTY_${idx}`] = r[idx];
                    });
                    return obj;
                })
                .filter((r) => Object.values(r).some((v) => v !== null && v !== undefined && v.toString().trim() !== ""));

            if (rows.length === 0) {
                toast.error("No data found in the Excel file");
                return;
            }
        } catch (error) {
            console.error("Excel parse error:", error);
            toast.error("Failed to read the Excel file");
            return;
        }

        setIsImportModalOpen(false);
        setImportProgress({
            total: rows.length,
            success: 0,
            failed: 0,
            timeElapsed: 0,
            errors: [],
            done: false,
        });
        setIsImporting(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const result = await importDojoCandidates(formData).unwrap();

            const successList = result?.data?.success || [];
            const failedList = result?.data?.failed || [];

            setImportProgress((prev) => ({
                ...prev,
                success: successList.length,
                failed: failedList.length,
                errors: failedList.map((f) => `Row ${f.row ?? "-"}: ${f.error || "Failed to import"}`),
                done: true,
            }));
            refetch();
        } catch (error) {
            console.error("Import error:", error);
            const message = error?.data?.message || "Failed to import candidates";
            setImportProgress((prev) => ({ ...prev, done: true, errors: [...prev.errors, `Import stopped: ${message}`] }));
        }
    };

    const exportableColumns = useMemo(() => [
        { header: "Candidate Name", key: "fullName", width: 25 },
        { header: "Employee ID", key: "empId", width: 20 },
        { header: "Card No.", key: "idCard", width: 20 },
        { header: "Father / Husband Name", key: "fatherHusbandName", width: 25 },
        { header: "Gender", key: "gender", width: 10 },
        { header: "Designation", key: "designation", width: 20 },
        { header: "Onboarding Status", key: "status", width: 15 },
        { header: "Mobile No", key: "phoneNumber", width: 15 },
        { header: "Email", key: "email", width: 30 },
        { header: "Department", key: "deptName", width: 25 },
        { header: "Section", key: "sectionName", width: 20 },
        { header: "Line", key: "lineName", width: 15 },
        { header: "Sub Section", key: "subSectionName", width: 20 },
        { header: "Station No.", key: "stationName", width: 15 },
        { header: "DOB", key: "dob", width: 15 },
        { header: "Date of Joining", key: "joiningDate", width: 15 },
        { header: "Education", key: "education", width: 20 },
        { header: "District", key: "district", width: 15 },
        { header: "State", key: "state", width: 15 },
        { header: "PIN", key: "pin", width: 10 },
        { header: "Bus Route", key: "busRoute", width: 15 },
        { header: "Date of Leaving", key: "leavingDate", width: 15 },
        { header: "Reason of Leaving", key: "reasonOfLeaving", width: 25 },
        { header: "Contractor", key: "contractor", width: 20 },
        { header: "Expected Handover Date", key: "expectedHandover", width: 20 },
        { header: "Dojo Shift", key: "dojoShift", width: 15 },
    ], []);

    const handleExportExcel = async (selectedKeys, reportProgress = () => {}) => {
        try {
            const PAGE_SIZE = 100;
            let allCandidates = [];
            let page = 1;
            let totalUsers = Infinity;

            while (allCandidates.length < totalUsers) {
                const result = await triggerGetTemporaryUsers({
                    page,
                    limit: PAGE_SIZE,
                    search: searchTerm || "",
                    gender: genderFilter !== "ALL" ? genderFilter : "",
                    activeTab,
                    departmentId: deptFilter !== "ALL" ? deptFilter : "",
                    reasonOfLeaving: activeTab === "left" && reasonOfLeavingFilter !== "ALL" ? reasonOfLeavingFilter : "",
                    startDate,
                    endDate,
                }).unwrap();

                const batch = result?.data?.users || [];
                totalUsers = result?.data?.totalUsers ?? 0;
                allCandidates = [...allCandidates, ...batch];
                reportProgress({ phase: "fetching", current: allCandidates.length, total: totalUsers });

                if (batch.length === 0) break;
                page++;
            }

            if (allCandidates.length === 0) {
                throw new Error("No data to export");
            }

            reportProgress({ phase: "generating", current: 0, total: allCandidates.length });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Dojo Candidates');

            worksheet.columns = exportableColumns.filter((col) => selectedKeys.includes(col.key));

            for (let i = 0; i < allCandidates.length; i++) {
                const candidate = allCandidates[i];
                const fullRow = {
                    fullName: candidate.fullName || "",
                    empId: candidate.empId || "",
                    idCard: candidate.idCard || "",
                    fatherHusbandName: candidate.fatherHusbandName || "",
                    gender: candidate.gender || "",
                    designation: candidate.designation || "",
                    status: candidate.status || "PRESENT",
                    phoneNumber: candidate.phoneNumber || "",
                    email: candidate.email || "",
                    deptName: candidate.deptName || "",
                    sectionName: candidate.sectionName || "",
                    lineName: candidate.lineName || "",
                    subSectionName: candidate.subSectionName || "",
                    stationName: candidate.stationName || "",
                    dob: safeDateFormat(candidate.dob, "yyyy-MM-dd"),
                    joiningDate: safeDateFormat(candidate.joiningDate, "yyyy-MM-dd"),
                    education: candidate.education || "",
                    district: candidate.district || "",
                    state: candidate.state || "",
                    pin: candidate.pin || "",
                    busRoute: candidate.busRoute || "",
                    leavingDate: safeDateFormat(candidate.leavingDate, "yyyy-MM-dd"),
                    reasonOfLeaving: candidate.reasonOfLeaving || "",
                    contractor: candidate.contractor || "",
                    expectedHandover: safeDateFormat(candidate.expectedHandover, "yyyy-MM-dd"),
                    dojoShift: candidate.dojoShift || "",
                };

                const filteredRow = {};
                selectedKeys.forEach((k) => {
                    filteredRow[k] = fullRow[k];
                });

                worksheet.addRow(filteredRow);

                if (i % 200 === 0 || i === allCandidates.length - 1) {
                    reportProgress({ phase: "generating", current: i + 1, total: allCandidates.length });
                    await new Promise((resolve) => setTimeout(resolve, 0));
                }
            }

            // Style header row
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            reportProgress({ phase: "saving", current: 0, total: 0 });
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Dojo_Candidates_Export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

            toast.success(`Exported ${allCandidates.length} candidates successfully!`);
        } catch (error) {
            console.error("Export error:", error);
            toast.error(error?.message === "No data to export" ? "No data to export" : "Failed to export data");
            throw error;
        }
    };

    const openEditModal = (user) => {
        setSelectedUser(user);

        const getFormId = (id1, id2) => {
            const val = (id1 !== undefined && id1 !== null && id1 !== "" && id1 !== 0 && id1 !== "0") ? id1 : id2;
            return (val && val !== 0 && val !== "0") ? String(val) : "";
        };

        setFormData({
            fullName: user.fullName || "",
            empId: user.empId || "",
            idCard: user.idCard || "",
            fatherHusbandName: user.fatherHusbandName || "",
            gender: user.gender || "MALE",
            designation: user.designation || "",
            dob: user.dob ? dateToInputFormat(user.dob) : "",
            joiningDate: user.joiningDate ? dateToInputFormat(user.joiningDate) : new Date().toISOString().split('T')[0],
            departmentId: getFormId(user.departmentId, user.targetDeptId),
            sectionId: getFormId(user.sectionId, user.targetSectionId),
            lineId: getFormId(user.lineId, user.targetLineId),
            subSectionId: getFormId(user.subSectionId, user.targetSubSectionId),
            stationId: getFormId(user.stationId, user.targetStationId),
            education: user.education || "",
            email: user.email || "",
            phoneNumber: user.phoneNumber || "",
            district: user.district || "",
            state: user.state || "",
            pin: user.pin || "",
            busRoute: user.busRoute || "",
            unit: user.unit || "UNIT_1",
            status: normalizeStatus(user.status),
            leavingDate: user.leavingDate ? dateToInputFormat(user.leavingDate) : "",
            reasonOfLeaving: user.reasonOfLeaving || "",
            contractor: user.contractor || "",
            contractorId: user.contractorId ? String(user.contractorId) : "",
            expectedHandover: user.expectedHandover ? dateToInputFormat(user.expectedHandover) : "",
            shiftSchedule: typeof user.shiftSchedule === 'string'
                ? (() => { try { return JSON.parse(user.shiftSchedule); } catch (e) { return {}; } })()
                : (user.shiftSchedule || {}),
            dojoShift: user.dojoShift || ""
        });

        const existingReason = user.reasonOfLeaving || "";
        if (existingReason && !LEAVING_REASONS.includes(existingReason)) {
            setLeavingReasonOption("Other");
            setCustomLeavingReason(existingReason);
        } else {
            setLeavingReasonOption(existingReason);
            setCustomLeavingReason("");
        }

        setIsAddModalOpen(true);
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setSelectedUser(null);
        setFormData({
            fullName: "", empId: "", idCard: "", fatherHusbandName: "", gender: "MALE",
            designation: "", dob: "", joiningDate: new Date().toISOString().split('T')[0],
            departmentId: "", sectionId: "", lineId: "", subSectionId: "", stationId: "",
            education: "", email: "", phoneNumber: "", district: "", state: "",
            pin: "", busRoute: "", unit: "UNIT_1", status: "PRESENT",
            leavingDate: "", reasonOfLeaving: "", contractor: "", contractorId: "", expectedHandover: "",
            shiftSchedule: {}, dojoShift: ""
        });
        setLeavingReasonOption("");
        setCustomLeavingReason("");
    };

    const stats = [
        { label: t("dojoHiring.stats.todayHiring"), value: tempUsersData?.data?.todayJoined || 0, icon: IconCalendar, color: "emerald" },
        { label: t("dojoHiring.stats.totalCandidates"), value: tempUsersData?.data?.total || 0, icon: IconUsers, color: "blue" },
        { label: t("dojoHiring.stats.totalHandover"), value: tempUsersData?.data?.handoverCount || 0, icon: IconCircleCheck, color: "teal" },
        { label: t("dojoHiring.stats.onLeaveCandidates"), value: tempUsersData?.data?.leaveTotal || 0, icon: IconClock, color: "amber" },
        { label: t("dojoHiring.stats.leftCandidates"), value: tempUsersData?.data?.leftTotal || 0, icon: IconUserMinus, color: "rose" },
        { label: t("dojoHiring.stats.maleCandidates"), value: tempUsersData?.data?.maleCount || 0, icon: IconUser, color: "indigo" },
        { label: t("dojoHiring.stats.femaleCandidates"), value: tempUsersData?.data?.femaleCount || 0, icon: IconUser, color: "pink" },
    ];

    const getColorProps = (color) => {
        switch (color) {
            case "rose":
                return {
                    iconBgColor: "bg-rose-100",
                    iconColor: "text-rose-600",
                    gradientFrom: "from-rose-50",
                    gradientTo: "to-rose-100",
                    borderColor: "border-rose-200",
                    textColor: "text-rose-800",
                    valueColor: "text-rose-900"
                };
            case "emerald":
                return {
                    iconBgColor: "bg-emerald-100",
                    iconColor: "text-emerald-600",
                    gradientFrom: "from-emerald-50",
                    gradientTo: "to-emerald-100",
                    borderColor: "border-emerald-200",
                    textColor: "text-emerald-800",
                    valueColor: "text-emerald-900"
                };
            case "indigo":
                return {
                    iconBgColor: "bg-indigo-100",
                    iconColor: "text-indigo-600",
                    gradientFrom: "from-indigo-50",
                    gradientTo: "to-indigo-100",
                    borderColor: "border-indigo-200",
                    textColor: "text-indigo-800",
                    valueColor: "text-indigo-900"
                };
            case "pink":
                return {
                    iconBgColor: "bg-pink-100",
                    iconColor: "text-pink-600",
                    gradientFrom: "from-pink-50",
                    gradientTo: "to-pink-100",
                    borderColor: "border-pink-200",
                    textColor: "text-pink-800",
                    valueColor: "text-pink-900"
                };
            case "teal":
                return {
                    iconBgColor: "bg-teal-100",
                    iconColor: "text-teal-600",
                    gradientFrom: "from-teal-50",
                    gradientTo: "to-teal-100",
                    borderColor: "border-teal-200",
                    textColor: "text-teal-800",
                    valueColor: "text-teal-900"
                };
            case "amber":
                return {
                    iconBgColor: "bg-amber-100",
                    iconColor: "text-amber-600",
                    gradientFrom: "from-amber-50",
                    gradientTo: "to-amber-100",
                    borderColor: "border-amber-200",
                    textColor: "text-amber-800",
                    valueColor: "text-amber-900"
                };
            case "blue":
            default:
                return {
                    iconBgColor: "bg-blue-100",
                    iconColor: "text-blue-600",
                    gradientFrom: "from-blue-50",
                    gradientTo: "to-blue-100",
                    borderColor: "border-blue-200",
                    textColor: "text-blue-800",
                    valueColor: "text-blue-900"
                };
        }
    };

    const getStatusBadge = (status) => {
        const normalized = normalizeStatus(status);
        switch (normalized) {
            case "PRESENT":
                return (
                    <Badge className="flex items-center gap-1 w-fit bg-emerald-50 text-emerald-700 border border-emerald-100 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t("dojoHiring.status.present")}
                    </Badge>
                );
            case "ON_LEAVE":
                return (
                    <Badge className="flex items-center gap-1 w-fit bg-amber-50 text-amber-700 border border-amber-100 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {t("dojoHiring.status.onLeave")}
                    </Badge>
                );
            case "LEFT":
                return (
                    <Badge className="flex items-center gap-1 w-fit bg-rose-50 text-rose-700 border border-rose-100 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {t("dojoHiring.status.left")}
                    </Badge>
                );
            default:
                return (
                    <Badge className="flex items-center gap-1 w-fit bg-slate-100 text-slate-600 border border-slate-200 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-400" /> {normalized}
                    </Badge>
                );
        }
    };

    const genderOptions = [
        { value: "ALL", label: t("dojoHiring.filter.allGenders") },
        { value: "MALE", label: t("dojoHiring.filter.maleOnly") },
        { value: "FEMALE", label: t("dojoHiring.filter.femaleOnly") },
    ];

    const deptOptions = [
        { value: "ALL", label: t("dojoHiring.filter.allDepts") },
        ...departments.map((d) => ({ value: String(d.id || d._id), label: d.name })),
    ];

    const reasonOfLeavingOptions = [
        { value: "ALL", label: "All Reasons" },
        ...LEAVING_REASONS.map((r) => ({ value: r, label: r })),
        { value: "Other", label: "Other / Custom" },
    ];

    const hasDateRangeFilter = startDate || endDate;
    const clearDateRange = () => {
        setStartDate("");
        setEndDate("");
    };

    const formatDateLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const monthOptions = React.useMemo(() => {
        const options = [{ value: "ALL", label: t("dojoHiring.filter.allTime") }];
        const now = new Date();
        const localeMap = {
            ja: "ja-JP",
            hi: "hi-IN",
            zh: "zh-CN",
            ru: "ru-RU",
        };
        const activeLocale = localeMap[language] || "en-US";
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            options.push({
                value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                label: d.toLocaleString(activeLocale, { month: "long", year: "numeric" }),
            });
        }
        return options;
    }, [language, t]);

    const handleMonthChange = (value) => {
        if (value === "ALL") {
            clearDateRange();
            return;
        }
        const [year, month] = value.split("-").map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        setStartDate(formatDateLocal(firstDay));
        setEndDate(formatDateLocal(lastDay));
    };

    const getMonthValue = () => {
        if (!startDate && !endDate) return "ALL";
        if (!startDate || !endDate) return "CUSTOM";

        const [sy, sm, sd] = startDate.split("-").map(Number);
        const [ey, em] = endDate.split("-").map(Number);

        if (sy === ey && sm === em && sd === 1) {
            const lastDayOfMonth = new Date(sy, sm, 0).getDate();
            const [, , ed] = endDate.split("-").map(Number);
            if (ed === lastDayOfMonth) {
                return `${sy}-${String(sm).padStart(2, "0")}`;
            }
        }
        return "CUSTOM";
    };

    const monthValue = getMonthValue();

    if (!canRead) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="p-4 bg-red-50 rounded-full">
                    <IconPoint className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">{t("dojoHiring.accessDenied.title", "Access Denied")}</h2>
                <p className="text-slate-500 max-w-md">{t("dojoHiring.accessDenied.desc", "You do not have permission to view the DOJO Hiring module. Please contact your administrator if you believe this is an error.")}</p>
            </div>
        );
    }

    return (
        <>
            {isImporting && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
                        <div className="flex flex-col items-center gap-3 text-center">
                            {!importProgress.done ? (
                                <div className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                                    <IconCheck className="h-7 w-7 text-green-600" />
                                </div>
                            )}
                            <h3 className="text-lg font-bold text-slate-900">
                                {importProgress.done ? t("dojoHiring.importProgress.titleComplete") : t("dojoHiring.importProgress.titleImporting")}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {importProgress.done
                                    ? t("dojoHiring.importProgress.descComplete")
                                    : t("dojoHiring.importProgress.descImporting")}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div className="text-xs text-slate-600 font-medium">{t("dojoHiring.importProgress.totalRows")}</div>
                                <div className="text-xl font-bold text-slate-900">{importProgress.total}</div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
                                <IconClock className="h-4 w-4 text-slate-500" />
                                <div>
                                    <div className="text-xs text-slate-600 font-medium">{t("dojoHiring.importProgress.timeElapsed")}</div>
                                    <div className="text-sm font-bold text-slate-900">{formatDuration(importProgress.timeElapsed)}</div>
                                </div>
                            </div>
                            {importProgress.done && (
                                <>
                                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                                        <div className="text-xs text-green-700 font-medium">{t("dojoHiring.importProgress.succeeded")}</div>
                                        <div className="text-xl font-bold text-green-900">{importProgress.success}</div>
                                    </div>
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                                        <div className="text-xs text-red-700 font-medium">{t("dojoHiring.importProgress.failed")}</div>
                                        <div className="text-xl font-bold text-red-900">{importProgress.failed}</div>
                                    </div>
                                </>
                            )}
                        </div>

                        {importProgress.errors.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                    <IconAlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                    {t("dojoHiring.importProgress.skippedFailedRows")} ({importProgress.errors.length})
                                </h4>
                                <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-1">
                                    {importProgress.errors.map((err, idx) => (
                                        <div key={idx} className="text-xs text-red-700 font-mono break-words">
                                            {err}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {importProgress.done && (
                            <Button onClick={closeImportOverlay} className="w-full">
                                {t("dojoHiring.importProgress.btnDone")}
                            </Button>
                        )}
                    </div>
                </div>,
                document.body
            )}
            <div className="p-6 space-y-6 animate-in fade-in duration-500 bg-slate-50/50 min-h-screen">
                <Tabs value={dojoTab} onValueChange={handleDojoTabChange} className="w-full">
                    <TabsList className="no-print mb-6 flex flex-wrap gap-2 w-fit bg-slate-100 p-1.5 rounded-xl shadow-sm border border-slate-200">
                        <TabsTrigger value="dojoHiring" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">{t("dojoHiring.tabs.dojoHiring")}</TabsTrigger>
                        <TabsTrigger value="testPaper" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">{t("dojoHiring.tabs.testPaper")}</TabsTrigger>
                        <TabsTrigger value="dojoEvaluationTest" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">{t("dojoHiring.tabs.dojoEvaluationTest")}</TabsTrigger>
                        <TabsTrigger value="handoverSheet" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">{t("dojoHiring.tabs.handoverSheet")}</TabsTrigger>
                        <TabsTrigger value="sixteenDays" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">{t("dojoHiring.tabs.sixteenDays")}</TabsTrigger>
                        <TabsTrigger value="course" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">{t("dojoHiring.tabs.course")}</TabsTrigger>
                        {canUpdate && (
                            <TabsTrigger value="dojoHiringConfig" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Dojo Hiring Configuration</TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="dojoHiring" className="space-y-6">
                        {/* Header Area */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <IconUserPlus className="w-8 h-8 text-blue-600" />
                                    {t("dojoHiring.title")}
                                </h1>
                                <p className="text-slate-500 font-medium">{t("dojoHiring.subtitle")}</p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsExportModalOpen(true)}
                                    className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-6 py-5 h-auto flex gap-2 items-center font-bold"
                                >
                                    <IconDownload className="w-5 h-5" />
                                    {t("dojoHiring.button.exportExcel")}
                                </Button>
                                {hasPermission("user:import_logs") && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            const parentPath = location.pathname.split("/")[1];
                                            navigate(`/${parentPath}/employees/import-logs?type=DOJO_CANDIDATE`);
                                        }}
                                        className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-6 py-5 h-auto flex gap-2 items-center font-bold"
                                    >
                                        <IconHistory className="w-5 h-5" />
                                        {t("dojoHiring.button.importLogs")}
                                    </Button>
                                )}
                                {canCreate && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsImportModalOpen(true)}
                                        className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-6 py-5 h-auto flex gap-2 items-center font-bold"
                                    >
                                        <IconUpload className="w-5 h-5" />
                                        {t("dojoHiring.button.importCandidates")}
                                    </Button>
                                )}
                                {canCreate && (
                                    <Button
                                        onClick={() => {
                                            closeModal();
                                            setIsAddModalOpen(true);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-5 h-auto shadow-lg shadow-blue-100 flex gap-2 items-center font-bold"
                                    >
                                        <IconPlus className="w-5 h-5" />
                                        {t("dojoHiring.button.addCandidate")}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Stats Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                            {stats.map((stat, idx) => (
                                <StatCard
                                    key={idx}
                                    title={stat.label}
                                    value={stat.value}
                                    icon={stat.icon}
                                    {...getColorProps(stat.color)}
                                />
                            ))}
                        </div>

                        {/* Main Content Area */}
                        <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
                            <CardHeader className="p-6 border-b border-slate-100">
                                <div className="flex flex-col lg:flex-row justify-between gap-6">
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
                                        <TabsList className="bg-slate-100 p-1 rounded-xl h-11">
                                            {/* Today's Candidates */}
                                            <TabsTrigger value="today" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer">
                                                {t("dojoHiring.tabs.todayEntry")}
                                            </TabsTrigger>
                                            {/* Practical Candidates */}
                                            <TabsTrigger value="all" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer">
                                                {t("dojoHiring.tabs.practical")}
                                            </TabsTrigger>
                                            {/* Handover Candidates */}
                                            <TabsTrigger value="handover-candidate" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer">
                                                {t("dojoHiring.tabs.handoverCandidates")}
                                            </TabsTrigger>
                                            {/* Left Candidates */}
                                            <TabsTrigger value="left" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer">
                                                {t("dojoHiring.tabs.leftCandidates")}
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto lg:justify-end">
                                        <FilterSelect
                                            value={deptFilter}
                                            onValueChange={setDeptFilter}
                                            options={deptOptions}
                                            placeholder={t("dojoHiring.filter.selectDept")}
                                            className="w-[180px]"
                                        />
                                        <FilterSelect
                                            value={genderFilter}
                                            onValueChange={setGenderFilter}
                                            options={genderOptions}
                                            placeholder={t("dojoHiring.filter.selectGender")}
                                        />
                                        {activeTab === "left" && (
                                            <FilterSelect
                                                value={reasonOfLeavingFilter}
                                                onValueChange={setReasonOfLeavingFilter}
                                                options={reasonOfLeavingOptions}
                                                placeholder="Reason of Leaving"
                                            />
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="flex items-center gap-2 border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-4 h-10 font-medium">
                                                    <IconCalendar className="w-4 h-4 text-slate-500" />
                                                    <span>
                                                        {monthValue === "ALL"
                                                            ? t("dojoHiring.filter.timeframe")
                                                            : monthValue === "CUSTOM"
                                                                ? t("dojoHiring.filter.custom")
                                                                : monthOptions.find(o => o.value === monthValue)?.label || t("dojoHiring.filter.timeframe")
                                                        }
                                                    </span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="max-h-[300px] overflow-y-auto">
                                                {monthOptions.map((option) => (
                                                    <DropdownMenuItem
                                                        key={option.value}
                                                        onClick={() => handleMonthChange(option.value)}
                                                        className="font-medium cursor-pointer"
                                                    >
                                                        {option.label}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 h-10">
                                            <Input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="h-8 w-[140px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                                                max={endDate || undefined}
                                            />
                                            <span className="text-slate-400 text-xs font-bold">{t("dojoHiring.filter.to")}</span>
                                            <Input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="h-8 w-[140px] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                                                min={startDate || undefined}
                                            />
                                            {hasDateRangeFilter && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={clearDateRange}
                                                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                                                    title={t("dojoHiring.filter.clearDateRange")}
                                                >
                                                    <IconX className="w-3.5 h-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                        <SearchInput
                                            value={searchTerm}
                                            onChange={setSearchTerm}
                                            placeholder={t("dojoHiring.filter.searchPlaceholder")}
                                        />
                                    </div>
                                </div>
                                {selectedRows.size > 0 && (
                                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 mt-3">
                                        <span className="text-sm font-bold text-blue-800">
                                            {selectedRows.size} {selectedRows.size > 1 ? t("dojoHiring.bulk.candidatesSelected") : t("dojoHiring.bulk.candidateSelected")}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedRows(new Set())}
                                                className="text-slate-600 border-slate-200 h-7 text-xs"
                                            >
                                                <IconX className="w-3.5 h-3.5 mr-1" />
                                                {t("dojoHiring.bulk.deselectAll")}
                                            </Button>
                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => setIsBulkDeleteOpen(true)}
                                                    className="bg-rose-600 hover:bg-rose-700 text-white h-7 text-xs gap-1"
                                                >
                                                    <IconTrash className="w-3.5 h-3.5" />
                                                    {t("dojoHiring.bulk.deleteSelected")}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardHeader>

                            <CardContent className="p-0">
                                {isLoadingUsers ? (
                                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                                        <IconLoader className="w-10 h-10 text-blue-600 animate-spin" />
                                        <p className="text-slate-500 font-medium animate-pulse">Syncing pipeline data...</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow className="border-slate-100 h-12">
                                                    <TableHead className="pl-4 w-12">
                                                        <Checkbox
                                                            checked={isAllSelected}
                                                            onCheckedChange={toggleSelectAll}
                                                            aria-label="Select all"
                                                        />
                                                    </TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.candidateName")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.empIdCardNo")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.designation")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.department")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.section")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider text-center">{t("dojoHiring.table.status")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider text-center">{t("dojoHiring.table.scheduledShift")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.contactDetail")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.joiningDate")}</TableHead>
                                                    <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t("dojoHiring.table.leavingDate")}</TableHead>
                                                    <TableHead className="pr-6 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">{t("dojoHiring.table.actions")}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {tempUsersData?.data?.users?.length > 0 ? (
                                                    tempUsersData.data.users.map((user) => (
                                                        <TableRow key={user.id} className="group hover:bg-slate-50/80 transition-colors border-slate-50 h-20 cursor-pointer" onClick={() => navigate(`/admin/dojo-hiring/${user.id}`)}>
                                                            <TableCell className="pl-4 w-12" onClick={(e) => e.stopPropagation()}>
                                                                <Checkbox
                                                                    checked={selectedRows.has(user.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        setSelectedRows(prev => {
                                                                            const next = new Set(prev);
                                                                            checked ? next.add(user.id) : next.delete(user.id);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    aria-label={`Select ${user.fullName}`}
                                                                 />
                                                            </TableCell>
                                                            <TableCell className="pl-6">
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                                        <AvatarImage src="" />
                                                                        <AvatarFallback className="bg-blue-600 text-white font-black">
                                                                            {user.fullName.charAt(0)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 leading-tight">{user.fullName}</div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="space-y-1">
                                                                    <Badge variant="secondary" className="font-mono text-blue-700 bg-blue-50 border-blue-100/50 px-2 py-1 rounded text-xs font-black">
                                                                        {user.empId || "—"}
                                                                    </Badge>
                                                                    {user.idCard && (
                                                                        <div className="text-[10px] text-slate-500 font-mono font-medium pl-0.5">
                                                                            {t("dojoHiring.table.cardPrefix")}{user.idCard}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-slate-700 font-bold text-sm">{user.designation || "—"}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-1.5 text-slate-700 text-sm font-bold">
                                                                    <IconBuilding className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                    {user.deptName || "—"}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-slate-600 text-sm">{user.sectionName || "—"}</div>
                                                            </TableCell>
                                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                                <Select
                                                                    value={normalizeStatus(user.status)}
                                                                    onValueChange={(newStatus) => handleQuickStatusChange(user, newStatus)}
                                                                    disabled={!hasPermission("user:change_status") && !canUpdate}
                                                                >
                                                                    <SelectTrigger className="w-[130px] border-0 shadow-none p-0 h-auto focus:ring-0 [&>svg]:hidden">
                                                                        {getStatusBadge(user.status)}
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="PRESENT">{t("dojoHiring.status.present")}</SelectItem>
                                                                        <SelectItem value="ON_LEAVE">{t("dojoHiring.status.onLeave")}</SelectItem>
                                                                        <SelectItem value="LEFT">{t("dojoHiring.status.left")}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {(() => {
                                                                    const styleMap = { A: "bg-blue-50 text-blue-700 border-blue-200", B: "bg-emerald-50 text-emerald-700 border-emerald-200", C: "bg-purple-50 text-purple-700 border-purple-200", G: "bg-amber-50 text-amber-700 border-amber-200" };
                                                                    if (user.isTemporary === 1 || user.isTemporary === true || String(user.isTemporary) === '1') {
                                                                        if (!user.dojoShift) return <span className="text-slate-400 text-xs">—</span>;
                                                                        return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styleMap[user.dojoShift] || "bg-slate-50 text-slate-600 border-slate-200"}`}>{user.dojoShift}</span>;
                                                                    }
                                                                    const schedule = typeof user.shiftSchedule === 'string'
                                                                        ? (() => { try { return JSON.parse(user.shiftSchedule); } catch (e) { return {}; } })()
                                                                        : (user.shiftSchedule || {});
                                                                    const scheduledShift = schedule[todayKey];
                                                                    if (!scheduledShift) return <span className="text-slate-400 text-xs">—</span>;
                                                                    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styleMap[scheduledShift] || "bg-slate-50 text-slate-600 border-slate-200"}`}>{scheduledShift}</span>;
                                                                })()}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="space-y-1 text-xs">
                                                                    <div className="flex items-center gap-2 text-slate-600 font-bold">
                                                                        <IconPhone className="w-3.5 h-3.5 text-slate-300" />
                                                                        {user.phoneNumber || "—"}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-slate-400 font-medium">
                                                                        <IconMapPin className="w-3.5 h-3.5 text-slate-300" />
                                                                        {user.district || user.state || "—"}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {user.joiningDate ? (
                                                                    <div className="text-slate-700 font-bold text-sm">
                                                                        {new Date(user.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs">—</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {user.leavingDate ? (
                                                                    <div className="text-rose-600 font-bold text-sm">
                                                                        {new Date(user.leavingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs">—</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex justify-end gap-1">
                                                                    {canUpdate && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 rounded-lg text-amber-600 hover:bg-amber-50"
                                                                            onClick={() => openEditModal(user)}
                                                                            title={t("dojoHiring.table.editCandidate")}
                                                                        >
                                                                            <IconPencil className="w-4 h-4" />
                                                                        </Button>
                                                                    )}
                                                                    {canUpdate && (user.isTemporary !== 1 && user.isTemporary !== true && String(user.isTemporary) !== '1') && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 rounded-lg text-indigo-600 hover:bg-indigo-50"
                                                                            onClick={() => handleOpenShiftDialog(user)}
                                                                            title="Shift Schedule"
                                                                        >
                                                                            <IconCalendar className="w-4 h-4" />
                                                                        </Button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 rounded-lg text-rose-600 hover:bg-rose-50"
                                                                            onClick={() => {
                                                                                setUserToDelete(user);
                                                                                setIsDeleteModalOpen(true);
                                                                            }}
                                                                            title={t("dojoHiring.table.removeCandidate")}
                                                                        >
                                                                            <IconTrash className="w-4 h-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={12} className="text-center py-32">
                                                            <div className="flex flex-col items-center gap-3 opacity-30">
                                                                <IconUsers className="w-16 h-16" />
                                                                <div className="space-y-1">
                                                                    <p className="text-xl font-black text-slate-900 tracking-tight">{t("dojoHiring.table.noCandidatesFound")}</p>
                                                                    <p className="text-sm font-medium">{t("dojoHiring.table.adjustFilters")}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex flex-col items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                <p className="text-sm text-slate-500 font-medium">
                                    {t("dojoHiring.pagination.showing")} <span className="text-slate-900 font-bold">{allUsers.length}</span> {t("dojoHiring.pagination.of")}{" "}
                                    <span className="text-slate-900 font-bold">{tempUsersData?.data?.totalUsers || 0}</span> {t("dojoHiring.pagination.candidates")}
                                </p>
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        className="rounded-lg border-slate-200"
                                    >
                                        {t("dojoHiring.pagination.previous")}
                                    </Button>
                                    {getPageNumbers().map((page, idx) =>
                                        page === "..." ? (
                                            <span
                                                key={`dots-${idx}`}
                                                className="px-2 text-sm text-muted-foreground select-none"
                                            >
                                                ...
                                            </span>
                                        ) : (
                                            <Button
                                                key={page}
                                                variant={page === currentPage ? "default" : "outline"}
                                                size="sm"
                                                className="w-9 px-0"
                                                onClick={() => setCurrentPage(page)}
                                            >
                                                {page}
                                            </Button>
                                        )
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        className="rounded-lg border-slate-200"
                                    >
                                        {t("dojoHiring.pagination.next")}
                                    </Button>
                                </div>
                                <form onSubmit={handleGoToPage} className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{t("dojoHiring.pagination.goToPage")}</span>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={totalPages}
                                        value={goToPageInput}
                                        onChange={(e) => setGoToPageInput(e.target.value)}
                                        className="h-8 w-20"
                                        placeholder={String(currentPage)}
                                    />
                                    <Button type="submit" variant="outline" size="sm">
                                        {t("dojoHiring.pagination.go")}
                                    </Button>
                                </form>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="testPaper" className="space-y-6">
                        <TestPaper isDojo={true} />
                    </TabsContent>

                    <TabsContent value="dojoEvaluationTest" className="space-y-6">
                        <EvaluationTestList />
                    </TabsContent>

                    <TabsContent value="handoverSheet" className="space-y-6">
                        <HandoverSheetPage />
                    </TabsContent>

                    <TabsContent value="sixteenDays" className="space-y-6">
                        <SixteenDayMonitoring readOnly={true} allowEduCellApproval={true} approvalField="verifiedByEduCell" pendingGateField="approvedBy" />
                    </TabsContent>

                    <TabsContent value="course" className="space-y-6">
                        <Course />
                    </TabsContent>

                    {canUpdate && (
                        <TabsContent value="dojoHiringConfig" className="space-y-6">
                            <DojoHiringConfig />
                        </TabsContent>
                    )}
                </Tabs>

                {/* Registration/Edit Modal */}
                <Dialog open={isAddModalOpen} onOpenChange={(open) => !open && closeModal()}>
                    <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-2xl">
                                {selectedUser ? <IconPencil className="h-6 w-6 text-amber-600" /> : <IconUserPlus className="h-6 w-6 text-blue-600" />}
                                {selectedUser ? t("dojoHiring.modal.updateTitle") : t("dojoHiring.modal.createTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dojoHiring.modal.description")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
                            {/* Identification Section */}
                            <div className="md:col-span-2">
                                <h3 className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">{t("dojoHiring.modal.secIdentification")}</h3>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="fullName">{t("dojoHiring.modal.lblFullName")}</Label>
                                <Input
                                    id="fullName"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    placeholder={t("dojoHiring.modal.lblFullName").replace(" *", "")}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="empId">{t("dojoHiring.modal.lblEmpCode")}</Label>
                                <Input
                                    id="empId"
                                    name="empId"
                                    value={formData.empId}
                                    onChange={handleInputChange}
                                    placeholder="e.g. AS000233"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="idCard">{t("dojoHiring.modal.lblCardNo")}</Label>
                                <Input
                                    id="idCard"
                                    name="idCard"
                                    value={formData.idCard}
                                    onChange={handleInputChange}
                                    placeholder="e.g. 00C0233"
                                />
                            </div>

                            {/* Profile Section */}
                            <div className="md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">{t("dojoHiring.modal.secPersonalProfile")}</h3>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="fatherHusbandName">{t("dojoHiring.modal.lblFatherHusbandName")}</Label>
                                <Input id="fatherHusbandName" name="fatherHusbandName" value={formData.fatherHusbandName} onChange={handleInputChange} placeholder={t("dojoHiring.modal.lblFatherHusbandName")} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="gender">{t("dojoHiring.modal.lblGender")}</Label>
                                <Select value={formData.gender} onValueChange={(val) => handleSelectChange('gender', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("dojoHiring.modal.lblGender")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MALE">{t("dojoHiring.filter.maleOnly").replace(" Only", "")}</SelectItem>
                                        <SelectItem value="FEMALE">{t("dojoHiring.filter.femaleOnly").replace(" Only", "")}</SelectItem>
                                        <SelectItem value="OTHER">{t("charts.other")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="status">{t("dojoHiring.modal.lblOnboardingStatus")}</Label>
                                <Select value={formData.status} onValueChange={(val) => {
                                    handleSelectChange('status', val);
                                    if(val !== 'LEFT') {
                                        setFormData(prev => ({...prev, leavingDate: '', reasonOfLeaving: ''}));
                                    }
                                }}>
                                    <SelectTrigger className="font-bold text-slate-700">
                                        <SelectValue placeholder={t("dojoHiring.modal.lblOnboardingStatus")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PRESENT" className="text-emerald-600 font-bold">{t("dojoHiring.status.present")}</SelectItem>
                                        <SelectItem value="ON_LEAVE" className="text-amber-600 font-bold">{t("dojoHiring.status.onLeave")}</SelectItem>
                                        <SelectItem value="LEFT" className="text-rose-600 font-bold">{t("dojoHiring.status.left")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {formData.status === "LEFT" && (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="leavingDate">{t("dojoHiring.modal.lblLeavingDate")}</Label>
                                        <Input
                                            id="leavingDate"
                                            type="date"
                                            name="leavingDate"
                                            value={formData.leavingDate}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="reasonOfLeaving">{t("dojoHiring.modal.lblReasonOfLeaving")}</Label>
                                        <Select value={leavingReasonOption} onValueChange={handleLeavingReasonSelect}>
                                            <SelectTrigger id="reasonOfLeaving">
                                                <SelectValue placeholder={t("dojoHiring.modal.phSelectReason")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LEAVING_REASONS.map((reason) => (
                                                    <SelectItem key={reason} value={reason}>
                                                        {t("dojoHiring.leavingReason." + (LEAVING_REASONS_MAP[reason] || "other"))}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="Other">{t("dojoHiring.leavingReason.other")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {leavingReasonOption === "Other" && (
                                            <Textarea
                                                id="customReasonOfLeaving"
                                                value={customLeavingReason}
                                                onChange={handleCustomLeavingReasonChange}
                                                placeholder={t("dojoHiring.modal.phSpecifyReason")}
                                                rows={3}
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="designation">{t("dojoHiring.modal.lblDesignation")}</Label>
                                <Input id="designation" name="designation" value={formData.designation} onChange={handleInputChange} placeholder="Trainee / Operator" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="dob">{t("dojoHiring.modal.lblDob")}</Label>
                                <Input id="dob" type="date" name="dob" value={formData.dob} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="education">{t("dojoHiring.modal.lblEducation")}</Label>
                                <Input id="education" name="education" value={formData.education} onChange={handleInputChange} placeholder={t("dojoHiring.modal.lblEducation")} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="joiningDate">{t("dojoHiring.modal.lblJoiningDate")}</Label>
                                <Input id="joiningDate" type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="expectedHandover">{t("dojoHiring.modal.lblExpectedHandover")}</Label>
                                <Input id="expectedHandover" type="date" name="expectedHandover" value={formData.expectedHandover} onChange={handleInputChange} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="contractorId">{t("dojoHiring.modal.lblContractor")}</Label>
                                <Select
                                    value={formData.contractorId || "none"}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, contractorId: val === "none" ? "" : val }))}
                                >
                                    <SelectTrigger id="contractorId">
                                        <SelectValue placeholder={t("dojoHiring.modal.phSelectContractor")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t("dojoHiring.modal.optNone")}</SelectItem>
                                        {contractorsList.map((c) => (
                                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Contact Section */}
                            <div className="md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">{t("dojoHiring.modal.secContactAddress")}</h3>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phoneNumber">{t("dojoHiring.modal.lblMobileNo")}</Label>
                                <Input id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="10 digit number" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">{t("dojoHiring.modal.lblEmail")}</Label>
                                <Input id="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="district">{t("dojoHiring.modal.lblDistrict")}</Label>
                                <Input id="district" name="district" value={formData.district} onChange={handleInputChange} placeholder={t("dojoHiring.modal.lblDistrict")} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="state">{t("dojoHiring.modal.lblState")}</Label>
                                <Input id="state" name="state" value={formData.state} onChange={handleInputChange} placeholder={t("dojoHiring.modal.lblState")} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="busRoute">{t("dojoHiring.modal.lblBusRoute")}</Label>
                                <Input id="busRoute" name="busRoute" value={formData.busRoute} onChange={handleInputChange} placeholder={t("dojoHiring.modal.lblBusRoute")} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="pin">{t("dojoHiring.modal.lblPin")}</Label>
                                <Input id="pin" name="pin" value={formData.pin} onChange={handleInputChange} placeholder={t("dojoHiring.modal.lblPin")} />
                            </div>

                            {/* Deployment Section */}
                            <div className="md:col-span-2 mt-2">
                                <h3 className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">{t("dojoHiring.modal.secDeployment")}</h3>
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("dojoHiring.modal.lblDepartment")}</Label>
                                <Select value={formData.departmentId} onValueChange={(val) => handleSelectChange('departmentId', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("dojoHiring.modal.lblDepartment")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map(d => <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("dojoHiring.modal.lblSection")}</Label>
                                <Select value={formData.sectionId} onValueChange={(val) => handleSelectChange('sectionId', val)} disabled={!formData.departmentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("dojoHiring.modal.lblSection")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map(s => <SelectItem key={s.id || s._id} value={String(s.id || s._id)}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("dojoHiring.modal.lblLine")}</Label>
                                <Select value={formData.lineId} onValueChange={(val) => handleSelectChange('lineId', val)} disabled={!formData.sectionId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("dojoHiring.modal.lblLine")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lines.map(l => <SelectItem key={l.id || l._id} value={String(l.id || l._id)}>{l.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("dojoHiring.modal.lblCandidateStatus")}</Label>
                                <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                                    <SelectTrigger className="border-slate-200">
                                        <SelectValue placeholder={t("dojoHiring.modal.lblCandidateStatus")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PRESENT">{t("dojoHiring.status.present")}</SelectItem>
                                        <SelectItem value="ON_LEAVE">{t("dojoHiring.status.onLeave")}</SelectItem>
                                        <SelectItem value="LEFT">{t("dojoHiring.status.left")}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("dojoHiring.modal.lblShift")}</Label>
                                <Select
                                    value={formData.dojoShift || "none"}
                                    onValueChange={(val) => setFormData(prev => ({ ...prev, dojoShift: val === "none" ? "" : val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("dojoHiring.modal.lblShift")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t("dojoHiring.modal.optNone")}</SelectItem>
                                        <SelectItem value="A">A</SelectItem>
                                        <SelectItem value="B">B</SelectItem>
                                        <SelectItem value="C">C</SelectItem>
                                        <SelectItem value="G">G</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <DialogFooter className="sticky bottom-0 bg-white pt-4 pb-2 border-t mt-4">
                            <Button
                                variant="outline"
                                onClick={closeModal}
                            >
                                {t("dojoHiring.modal.btnCancel")}
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isCreating || isUpdating}
                                className={`${selectedUser ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white gap-2`}
                            >
                                {(isCreating || isUpdating) ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />}
                                {isCreating ? t("dojoHiring.modal.btnRegistering") : isUpdating ? t("dojoHiring.modal.btnUpdating") : selectedUser ? t("dojoHiring.modal.btnUpdateDetails") : t("dojoHiring.modal.btnRegisterOperator")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Delete Confirmation Modal */}
                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <IconAlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <DialogTitle className="text-center text-xl font-bold">{t("dojoHiring.deleteModal.title")}</DialogTitle>
                            <DialogDescription className="text-center">
                                {t("dojoHiring.deleteModal.msgPart1")}<span className="font-bold text-slate-900">{userToDelete?.fullName}</span>{t("dojoHiring.deleteModal.msgPart2")}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2 sm:justify-center mt-4">
                            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
                                {t("dojoHiring.modal.btnCancel")}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 gap-2"
                            >
                                {isDeleting ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconTrash className="w-4 h-4" />}
                                {isDeleting ? t("dojoHiring.deleteModal.btnRemoving") : t("dojoHiring.deleteModal.btnRemove")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Left Status Confirmation Dialog */}
                <Dialog
                    open={isLeftConfirmOpen}
                    onOpenChange={(open) => {
                        setIsLeftConfirmOpen(open);
                        if (!open) setLeftConfirmTarget(null);
                    }}
                >
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <IconAlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <DialogTitle className="text-center text-xl font-bold">{t("dojoHiring.leftConfirmModal.title")}</DialogTitle>
                            <DialogDescription className="text-center">
                                {t("dojoHiring.leftConfirmModal.description")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-2">
                            <div className="grid gap-2">
                                <Label htmlFor="leftConfirmDate">{t("dojoHiring.modal.lblLeavingDate")}</Label>
                                <Input
                                    id="leftConfirmDate"
                                    type="date"
                                    value={leftConfirmDate}
                                    onChange={(e) => setLeftConfirmDate(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="leftConfirmReason">{t("dojoHiring.modal.lblReasonOfLeaving")}</Label>
                                <Select value={leftConfirmReason} onValueChange={setLeftConfirmReason}>
                                    <SelectTrigger id="leftConfirmReason">
                                        <SelectValue placeholder={t("dojoHiring.modal.phSelectReason")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LEAVING_REASONS.map((reason) => (
                                            <SelectItem key={reason} value={reason}>
                                                {t("dojoHiring.leavingReason." + (LEAVING_REASONS_MAP[reason] || "other"))}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="Other">{t("dojoHiring.leavingReason.other")}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {leftConfirmReason === "Other" && (
                                    <Textarea
                                        value={leftConfirmCustomReason}
                                        onChange={(e) => setLeftConfirmCustomReason(e.target.value)}
                                        placeholder={t("dojoHiring.modal.phSpecifyReason")}
                                        rows={3}
                                    />
                                )}
                            </div>
                        </div>
                        <DialogFooter className="flex gap-2 sm:justify-center mt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsLeftConfirmOpen(false);
                                    setLeftConfirmTarget(null);
                                }}
                                className="flex-1"
                            >
                                {t("dojoHiring.modal.btnCancel")}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleConfirmLeftStatus}
                                disabled={
                                    isLeftConfirmSubmitting ||
                                    !leftConfirmDate ||
                                    !leftConfirmReason ||
                                    (leftConfirmReason === "Other" && !leftConfirmCustomReason.trim())
                                }
                                className="flex-1 gap-2"
                            >
                                {isLeftConfirmSubmitting && <IconLoader className="w-4 h-4 animate-spin" />}
                                {t("dojoHiring.leftConfirmModal.btnConfirm")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Bulk Delete Confirmation Dialog */}
                <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <IconAlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <DialogTitle className="text-center text-xl font-bold">
                                {t("dojoHiring.bulkDeleteModal.title")}
                            </DialogTitle>
                            <DialogDescription className="text-center">
                                {t("dojoHiring.bulkDeleteModal.msgPart1")}<span className="font-bold text-slate-900">{selectedRows.size}</span>{t("dojoHiring.bulkDeleteModal.msgPart2")}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-2 sm:justify-center mt-4">
                            <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} className="flex-1">
                                {t("dojoHiring.modal.btnCancel")}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBulkDelete}
                                disabled={isDeleting}
                                className="flex-1 gap-2"
                            >
                                {isDeleting ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconTrash className="w-4 h-4" />}
                                {isDeleting ? t("dojoHiring.deleteModal.btnRemoving") : t("dojoHiring.bulkDeleteModal.btnRemoveAll")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                {/* Import Candidates Dialog */}
                <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <IconUpload className="h-5 w-5 text-blue-600" />
                                {t("dojoHiring.importModal.title")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dojoHiring.importModal.description")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            <div className="space-y-4">
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                    <h4 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                                        <IconInfoCircle className="h-4 w-4" />
                                        {t("dojoHiring.importModal.instructionsTitle")}
                                    </h4>
                                    <p className="text-xs text-blue-800 font-medium">
                                        {t("dojoHiring.importModal.instructionsDesc")}
                                    </p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-blue-700 font-mono bg-white/50 p-2 rounded-lg">
                                        <span>- Employee Code *</span>
                                        <span>- Name *</span>
                                        <span>- Card No.</span>
                                        <span>- Mobile No</span>
                                        <span>- Gender</span>
                                        <span>- Contractor</span>
                                        <span>- Department</span>
                                        <span>- Section</span>
                                        <span>- Designation</span>
                                        <span>- DOB (YYYY-MM-DD)</span>
                                        <span>- D.O.J. (YYYY-MM-DD)</span>
                                        <span>- Expected Handover Date</span>
                                        <span>- Father / Husband Name</span>
                                        <span>- Education</span>
                                        <span>- Status</span>
                                    </div>
                                    <p className="text-[10px] text-blue-600 italic">
                                        {t("dojoHiring.importModal.instructionsNote")}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <h4 className="font-bold text-slate-800 text-sm">{t("dojoHiring.importModal.step1Title")}</h4>
                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadTemplate}
                                        className="w-full justify-start gap-2 bg-slate-50 border-slate-200 rounded-xl py-6 h-auto"
                                    >
                                        <IconDownload className="h-5 w-5 text-slate-600" />
                                        <div className="text-left">
                                            <div className="font-bold text-sm">{t("dojoHiring.importModal.btnDownloadTemplate")}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">{t("dojoHiring.importModal.downloadDesc")}</div>
                                        </div>
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <h4 className="font-bold text-slate-800 text-sm">{t("dojoHiring.importModal.step2Title")}</h4>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                    />
                                    <Button
                                        onClick={handleFileSelect}
                                        className="w-full justify-start gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 h-auto shadow-lg shadow-blue-100"
                                    >
                                        <div className="bg-white/20 p-2 rounded-lg">
                                            <IconUpload className="h-5 w-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-sm">{t("dojoHiring.importModal.btnSelectFile")}</div>
                                            <div className="text-[10px] text-blue-100 font-medium">{t("dojoHiring.importModal.selectFileDesc")}</div>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Shift Schedule Dialog */}
                <Dialog open={isShiftDialogOpen} onOpenChange={setIsShiftDialogOpen}>
                    <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <IconCalendar className="h-5 w-5 text-indigo-600" />
                                {t("dojoHiring.shiftDialog.title")}
                                {shiftStudent && (
                                    <span className="text-sm font-normal text-slate-500 ml-1">— {shiftStudent.fullName}</span>
                                )}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dojoHiring.shiftDialog.description")}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2">
                            <ShiftScheduler
                                schedule={shiftScheduleDraft}
                                onChange={setShiftScheduleDraft}
                            />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setIsShiftDialogOpen(false)}>
                                {t("dojoHiring.modal.btnCancel")}
                            </Button>
                            <Button
                                onClick={handleSaveStudentShift}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                {t("dojoHiring.shiftDialog.btnSave")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <ExportColumnSelectorModal
                    isOpen={isExportModalOpen}
                    onOpenChange={setIsExportModalOpen}
                    columns={exportableColumns}
                    onExport={handleExportExcel}
                    storageKey="export_columns_dojohiring"
                    title="Customize Export Columns"
                    description="Choose which columns you want to include in the Dojo candidates Excel export. Your selection is automatically saved."
                />

            </div>
        </>
    );
};

export default DojoHiring;
