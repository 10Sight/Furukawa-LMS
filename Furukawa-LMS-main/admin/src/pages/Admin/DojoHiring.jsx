import React, { useState, useEffect } from 'react';
import { 
    useDojoRegisterMutation,
    useGetTemporaryUsersQuery,
    useLazyGetTemporaryUsersQuery,
    useLazyGetNextTemporaryIdQuery,
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
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from "date-fns";
import { safeDateFormat } from "@/utils/dateUtils";
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
    IconHistory
} from "@tabler/icons-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import StatCard from "@/components/common/StatCard";
import FilterBar from "@/components/common/FilterBar";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";

// Section tab component imports
import TestPaper from "./TestPaper";
import EvaluationTestList from "./EvaluationTest/EvaluationTestList";
import HandoverSheetPage from "./HandoverSheetPage";
import SixteenDayMonitoring from "./SixteenDayMonitoring";
import Course from "./Course";

const DojoHiring = () => {
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

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [activeTab, setActiveTab] = useState("all");
    const [genderFilter, setGenderFilter] = useState("ALL");
    
    const [formData, setFormData] = useState({
        fullName: "", empId: "", tempId: "", fatherHusbandName: "", gender: "MALE",
        designation: "", dob: "", joiningDate: new Date().toISOString().split('T')[0],
        departmentId: "", sectionId: "", lineId: "", subSectionId: "", stationId: "",
        education: "", email: "", phoneNumber: "", district: "", state: "",
        pin: "", busRoute: "", unit: "UNIT_1", status: "PRESENT",
        leavingDate: "", reasonOfLeaving: "", contractor: "", expectedHandover: ""
    });

    const location = useLocation();
    const [triggerGetTemporaryUsers] = useLazyGetTemporaryUsersQuery();
    const { data: tempUsersData, isLoading: isLoadingUsers, refetch } = useGetTemporaryUsersQuery({ 
        page: currentPage, 
        search: searchTerm,
        gender: genderFilter !== "ALL" ? genderFilter : "",
        today: activeTab === "today" ? "true" : "false"
    });
    const [triggerNextId] = useLazyGetNextTemporaryIdQuery();
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
    }, [currentPage, searchTerm, genderFilter, activeTab]);

    useEffect(() => {
        const generateId = async () => {
            // Only generate ID if we are creating a new user, not editing
            if (!selectedUser && formData.fullName && formData.empId) {
                const namePart = formData.fullName.trim().substring(0, 3).toUpperCase();
                const empPart = formData.empId.trim().toUpperCase();
                const prefix = `TEMP${namePart}${empPart}`;
                
                try {
                    const res = await triggerNextId(prefix).unwrap();
                    setFormData(prev => ({ ...prev, tempId: res.data.nextId }));
                } catch (e) {
                    console.error("Failed to generate next ID", e);
                }
            } else if (!selectedUser) {
                setFormData(prev => ({ ...prev, tempId: "" }));
            }
        };

        const timer = setTimeout(generateId, 500);
        return () => clearTimeout(timer);
    }, [formData.fullName, formData.empId, triggerNextId, selectedUser]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'departmentId') setFormData(prev => ({ ...prev, sectionId: "", lineId: "", subSectionId: "", stationId: "" }));
        if (name === 'sectionId') setFormData(prev => ({ ...prev, lineId: "", subSectionId: "", stationId: "" }));
        if (name === 'lineId') setFormData(prev => ({ ...prev, subSectionId: "", stationId: "" }));
        if (name === 'subSectionId') setFormData(prev => ({ ...prev, stationId: "" }));
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
                    empId: formData.tempId,
                    contractorId: formData.contractorId ? Number(formData.contractorId) : null,
                };
                await updateUser(payload).unwrap();
                toast.success("Employee details updated successfully");
            } else {
                // Create mode
                const payload = {
                    ...formData,
                    empId: formData.tempId,
                    isEmployee: true,
                    isTemporary: true,
                    role: "STUDENT",
                    status: "PRESENT",
                    password: formData.tempId,
                    userName: formData.empId,
                    contractorId: formData.contractorId ? Number(formData.contractorId) : null,
                };
                await dojoRegister(payload).unwrap();
                toast.success("Temporary employee registered successfully");
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
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to remove candidate");
        }
    };

    const allUsers = tempUsersData?.data?.users || [];
    const isAllSelected = allUsers.length > 0 && selectedRows.size === allUsers.length;

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(allUsers.map(u => u.id)));
        }
    };

    const handleBulkDelete = async () => {
        try {
            await Promise.all([...selectedRows].map(id => deleteUser(id).unwrap()));
            toast.success(`Removed ${selectedRows.size} candidates`);
            setSelectedRows(new Set());
            setIsBulkDeleteOpen(false);
            refetch();
        } catch (error) {
            toast.error(error?.data?.message || "Failed to remove some candidates");
            setIsBulkDeleteOpen(false);
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

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        e.target.value = null;

        if (!file.name.match(/\.(xlsx|xls)$/)) {
            toast.error("Please select an Excel file (.xlsx or .xls)");
            return;
        }

        const toastId = toast.loading("Importing candidates...");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const result = await importDojoCandidates(formData).unwrap();

            const successCount = result.data.success?.length || 0;
            const failedCount = result.data.failed?.length || 0;

            if (failedCount > 0) {
                toast.warning(`Imported ${successCount} candidates. ${failedCount} failed.`);
            } else {
                toast.success(`Successfully imported ${successCount} candidates!`);
                setIsImportModalOpen(false);
            }

            toast.dismiss(toastId);
            refetch();
        } catch (error) {
            console.error("Import error:", error);
            toast.dismiss(toastId);
            toast.error(error?.data?.message || "Failed to import candidates");
        }
    };

    const handleExportExcel = async () => {
        const toastId = toast.loading("Preparing Excel file...");
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
                    today: activeTab === "today" ? "true" : "false"
                }).unwrap();

                const batch = result?.data?.users || [];
                totalUsers = result?.data?.totalUsers ?? 0;
                allCandidates = [...allCandidates, ...batch];

                if (batch.length === 0) break;
                page++;
            }

            if (allCandidates.length === 0) {
                toast.dismiss(toastId);
                toast.error("No data to export");
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Dojo Candidates');

            worksheet.columns = [
                { header: "Candidate Name", key: "fullName", width: 25 },
                { header: "Employee Code", key: "userName", width: 20 },
                { header: "Temporary ID", key: "empId", width: 20 },
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
            ];

            allCandidates.forEach((candidate) => {
                worksheet.addRow({
                    fullName: candidate.fullName || "",
                    userName: candidate.userName || "",
                    empId: candidate.empId || "",
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
                });
            });

            // Style header row
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Dojo_Candidates_Export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

            toast.dismiss(toastId);
            toast.success(`Exported ${allCandidates.length} candidates successfully!`);
        } catch (error) {
            console.error("Export error:", error);
            toast.dismiss(toastId);
            toast.error("Failed to export data");
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
            empId: user.userName || "", // userName was used as empId in registration
            tempId: user.empId || "",
            fatherHusbandName: user.fatherHusbandName || "",
            gender: user.gender || "MALE",
            designation: user.designation || "",
            dob: user.dob ? String(user.dob).substring(0, 10) : "",
            joiningDate: user.joiningDate ? String(user.joiningDate).substring(0, 10) : new Date().toISOString().split('T')[0],
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
            status: user.status || "PRESENT",
            leavingDate: user.leavingDate ? String(user.leavingDate).substring(0, 10) : "",
            reasonOfLeaving: user.reasonOfLeaving || "",
            contractor: user.contractor || "",
            contractorId: user.contractorId ? String(user.contractorId) : "",
            expectedHandover: user.expectedHandover ? String(user.expectedHandover).substring(0, 10) : ""
        });
        setIsAddModalOpen(true);
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setSelectedUser(null);
        setFormData({
            fullName: "", empId: "", tempId: "", fatherHusbandName: "", gender: "MALE",
            designation: "", dob: "", joiningDate: new Date().toISOString().split('T')[0],
            departmentId: "", sectionId: "", lineId: "", subSectionId: "", stationId: "",
            education: "", email: "", phoneNumber: "", district: "", state: "",
            pin: "", busRoute: "", unit: "UNIT_1", status: "PRESENT",
            leavingDate: "", reasonOfLeaving: "", contractor: "", contractorId: "", expectedHandover: ""
        });
    };

    const stats = [
        { label: "Total Candidates", value: tempUsersData?.data?.totalUsers || 0, icon: IconUsers, color: "blue" },
        { label: "Today's Hiring", value: tempUsersData?.data?.todayJoined || 0, icon: IconCalendar, color: "emerald" },
        { label: "Male Candidates", value: tempUsersData?.data?.maleCount || 0, icon: IconUser, color: "indigo" },
        { label: "Female Candidates", value: tempUsersData?.data?.femaleCount || 0, icon: IconUser, color: "pink" },
    ];

    const genderOptions = [
        { value: "ALL", label: "All Genders" },
        { value: "MALE", label: "Male Only" },
        { value: "FEMALE", label: "Female Only" },
    ];

    if (!canRead) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <div className="p-4 bg-red-50 rounded-full">
                    <IconPoint className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                <p className="text-slate-500 max-w-md">You do not have permission to view the DOJO Hiring module. Please contact your administrator if you believe this is an error.</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500 bg-slate-50/50 min-h-screen">
            <Tabs value={dojoTab} onValueChange={handleDojoTabChange} className="w-full">
                <TabsList className="no-print mb-6 flex flex-wrap gap-2 w-fit bg-slate-100 p-1.5 rounded-xl shadow-sm border border-slate-200">
                    <TabsTrigger value="dojoHiring" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">DOJO Hiring</TabsTrigger>
                    <TabsTrigger value="testPaper" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Test Paper</TabsTrigger>
                    <TabsTrigger value="dojoEvaluationTest" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">DOJO Evaluation Test</TabsTrigger>
                    <TabsTrigger value="handoverSheet" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Handover Sheet</TabsTrigger>
                    <TabsTrigger value="sixteenDays" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">16 Days</TabsTrigger>
                    <TabsTrigger value="course" className="text-xs font-bold px-5 py-2.5 rounded-lg transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">Course</TabsTrigger>
                </TabsList>

                <TabsContent value="dojoHiring" className="space-y-6">
                    {/* Header Area */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <IconUserPlus className="w-8 h-8 text-blue-600" />
                        DOJO Hiring Management
                    </h1>
                    <p className="text-slate-500 font-medium">Register and manage temporary candidates in the pipeline</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline"
                        onClick={handleExportExcel}
                        className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-6 py-5 h-auto flex gap-2 items-center font-bold"
                    >
                        <IconDownload className="w-5 h-5" />
                        Export Excel
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
                            Import Logs
                        </Button>
                    )}
                    {canCreate && (
                        <Button 
                            variant="outline"
                            onClick={() => setIsImportModalOpen(true)}
                            className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl px-6 py-5 h-auto flex gap-2 items-center font-bold"
                        >
                            <IconUpload className="w-5 h-5" />
                            Import Candidates
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
                            Add Candidate
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <StatCard 
                        key={idx}
                        title={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                    />
                ))}
            </div>

            {/* Main Content Area */}
            <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
                <CardHeader className="p-6 border-b border-slate-100">
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
                            <TabsList className="bg-slate-100 p-1 rounded-xl h-11">
                                <TabsTrigger value="all" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    All Candidates
                                </TabsTrigger>
                                <TabsTrigger value="today" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                    Today's Entry
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            <FilterSelect 
                                value={genderFilter}
                                onValueChange={setGenderFilter}
                                options={genderOptions}
                                placeholder="Select Gender"
                            />
                            <SearchInput
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Search candidates..."
                            />
                        </div>
                    </div>
                    {selectedRows.size > 0 && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 mt-3">
                            <span className="text-sm font-bold text-blue-800">
                                {selectedRows.size} candidate{selectedRows.size > 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedRows(new Set())}
                                    className="text-slate-600 border-slate-200 h-7 text-xs"
                                >
                                    <IconX className="w-3.5 h-3.5 mr-1" />
                                    Deselect All
                                </Button>
                                {canDelete && (
                                    <Button
                                        size="sm"
                                        onClick={() => setIsBulkDeleteOpen(true)}
                                        className="bg-rose-600 hover:bg-rose-700 text-white h-7 text-xs gap-1"
                                    >
                                        <IconTrash className="w-3.5 h-3.5" />
                                        Delete Selected
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
                                        <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">Candidate Details</TableHead>
                                        <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">Temporary ID</TableHead>
                                        <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">Professional Info</TableHead>
                                        <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider text-center">Status</TableHead>
                                        <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">Contact</TableHead>
                                        <TableHead className="font-bold text-slate-500 text-xs uppercase tracking-wider">Joining / Leaving</TableHead>
                                        <TableHead className="pr-6 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">Actions</TableHead>
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
                                                            <div className="text-slate-400 text-xs font-medium uppercase tracking-tight">Code: {user.userName || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="font-mono text-blue-700 bg-blue-50 border-blue-100/50 px-2 py-1 rounded text-xs font-black">
                                                        {user.empId}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="text-slate-700 font-bold text-sm">{user.designation || "Operator"}</div>
                                                        <div className="flex items-center gap-1 text-slate-400 text-[10px] font-black uppercase">
                                                            <IconBuilding className="w-3 h-3" />
                                                            {user.deptName || "Not Assigned"}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge 
                                                        className={`font-black text-[10px] uppercase px-2 py-0.5 rounded-full border ${
                                                            user.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                                            user.status === "LEAVE" ? "bg-amber-50 text-amber-700 border-amber-100" :
                                                            "bg-slate-100 text-slate-600 border-slate-200"
                                                        }`}
                                                    >
                                                        {user.status || "PRESENT"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex items-center gap-2 text-slate-600 font-bold">
                                                            <IconPhone className="w-3.5 h-3.5 text-slate-300" />
                                                            {user.phoneNumber || "-"}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                                                            <IconMapPin className="w-3.5 h-3.5 text-slate-300" />
                                                            {user.district || user.state || "N/A"}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        {user.status === "LEFT" ? (
                                                            user.leavingDate ? (
                                                                <>
                                                                    <div className="text-rose-600 font-bold text-sm">
                                                                        {new Date(user.leavingDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </div>
                                                                    <div className="text-[10px] text-rose-400 font-black uppercase">Left</div>
                                                                </>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs italic">Date not set</span>
                                                            )
                                                        ) : (
                                                            user.joiningDate ? (
                                                                <>
                                                                    <div className="text-slate-700 font-bold text-sm">
                                                                        {new Date(user.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-black uppercase">Joined</div>
                                                                </>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs">N/A</span>
                                                            )
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {canUpdate && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-lg text-amber-600 hover:bg-amber-50"
                                                                onClick={() => openEditModal(user)}
                                                                title="Edit Candidate"
                                                            >
                                                                <IconPencil className="w-4 h-4" />
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
                                                                title="Remove Candidate"
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
                                            <TableCell colSpan={8} className="text-center py-32">
                                                <div className="flex flex-col items-center gap-3 opacity-30">
                                                    <IconUsers className="w-16 h-16" />
                                                    <div className="space-y-1">
                                                        <p className="text-xl font-black text-slate-900 tracking-tight">No Candidates Found</p>
                                                        <p className="text-sm font-medium">Try adjusting your filters or search term</p>
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

            {/* Pagination Placeholder (similar to Students.jsx) */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <p className="text-slate-400 text-sm font-medium">
                    Showing <span className="text-slate-900 font-bold">{(currentPage - 1) * 10 + 1}</span> to <span className="text-slate-900 font-bold">{Math.min(currentPage * 10, tempUsersData?.data?.totalUsers || 0)}</span> of <span className="text-slate-900 font-bold">{tempUsersData?.data?.totalUsers || 0}</span> entries
                </p>
                <div className="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="rounded-lg border-slate-200"
                    >
                        Previous
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage >= (tempUsersData?.data?.totalPages || 1)}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="rounded-lg border-slate-200"
                    >
                        Next
                    </Button>
                </div>
            </div>
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
                <SixteenDayMonitoring readOnly={true} />
            </TabsContent>

            <TabsContent value="course" className="space-y-6">
                <Course />
            </TabsContent>
        </Tabs>

        {/* Registration/Edit Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl">
                            {selectedUser ? <IconPencil className="h-6 w-6 text-amber-600" /> : <IconUserPlus className="h-6 w-6 text-blue-600" />}
                            {selectedUser ? "Update Candidate Details" : "Onboard Temporary Candidate"}
                        </DialogTitle>
                        <DialogDescription>
                            Enter candidate details to generate system ID and hiring profile. Fields marked with * are required.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
                        {/* Identification Section */}
                        <div className="md:col-span-2">
                            <h3 className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">Identification</h3>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="fullName">Full Candidate Name *</Label>
                            <Input 
                                id="fullName"
                                name="fullName" 
                                value={formData.fullName} 
                                onChange={handleInputChange} 
                                placeholder="Full Name" 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="empId">Employee Base Code *</Label>
                            <Input 
                                id="empId"
                                name="empId" 
                                value={formData.empId} 
                                onChange={handleInputChange} 
                                placeholder="E-code Prefix" 
                            />
                        </div>
                        <div className="md:col-span-2 grid gap-2">
                            <Label htmlFor="tempId" className="text-blue-700 font-bold">System Generated ID</Label>
                            <Input 
                                id="tempId"
                                name="tempId" 
                                value={formData.tempId} 
                                readOnly 
                                className="bg-blue-50/50 border-blue-200 font-mono text-blue-700 font-bold h-12 text-lg text-center" 
                                placeholder="Awaiting Details..."
                            />
                        </div>

                        {/* Profile Section */}
                        <div className="md:col-span-2 mt-2">
                            <h3 className="text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">Personal Profile</h3>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="fatherHusbandName">Father / Husband Name</Label>
                            <Input id="fatherHusbandName" name="fatherHusbandName" value={formData.fatherHusbandName} onChange={handleInputChange} placeholder="Name" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={formData.gender} onValueChange={(val) => handleSelectChange('gender', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MALE">Male</SelectItem>
                                    <SelectItem value="FEMALE">Female</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">Onboarding Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                                <SelectTrigger className="font-bold text-slate-700">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PRESENT" className="text-emerald-600 font-bold">Present</SelectItem>
                                    <SelectItem value="LEAVE" className="text-amber-600 font-bold">Leave</SelectItem>
                                    <SelectItem value="LEFT" className="text-rose-600 font-bold">Left</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {formData.status === "LEFT" && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="leavingDate">Date of Leaving</Label>
                                    <Input 
                                        id="leavingDate" 
                                        type="date" 
                                        name="leavingDate" 
                                        value={formData.leavingDate} 
                                        onChange={handleInputChange} 
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="reasonOfLeaving">Reason of Leaving</Label>
                                    <Input 
                                        id="reasonOfLeaving" 
                                        name="reasonOfLeaving" 
                                        value={formData.reasonOfLeaving} 
                                        onChange={handleInputChange} 
                                        placeholder="Enter reason..."
                                    />
                                </div>
                            </>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Input id="designation" name="designation" value={formData.designation} onChange={handleInputChange} placeholder="Trainee / Operator" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="dob">Date of Birth</Label>
                            <Input id="dob" type="date" name="dob" value={formData.dob} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="education">Education</Label>
                            <Input id="education" name="education" value={formData.education} onChange={handleInputChange} placeholder="Qualification" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="joiningDate">Date of Joining</Label>
                            <Input id="joiningDate" type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="expectedHandover">Expected Handover Date</Label>
                            <Input id="expectedHandover" type="date" name="expectedHandover" value={formData.expectedHandover} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="contractorId">Contractor</Label>
                            <Select
                                value={formData.contractorId || "none"}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, contractorId: val === "none" ? "" : val }))}
                            >
                                <SelectTrigger id="contractorId">
                                    <SelectValue placeholder="Select contractor (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {contractorsList.map((c) => (
                                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Contact Section */}
                        <div className="md:col-span-2 mt-2">
                            <h3 className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">Contact & Address</h3>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="phoneNumber">Mobile Number</Label>
                            <Input id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="10 digit number" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email (Optional)</Label>
                            <Input id="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="email@example.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="district">District</Label>
                            <Input id="district" name="district" value={formData.district} onChange={handleInputChange} placeholder="District" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" name="state" value={formData.state} onChange={handleInputChange} placeholder="State" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="busRoute">Bus Route</Label>
                            <Input id="busRoute" name="busRoute" value={formData.busRoute} onChange={handleInputChange} placeholder="Route Name" />
                        </div>

                        {/* Deployment Section */}
                        <div className="md:col-span-2 mt-2">
                            <h3 className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-md w-fit mb-2 uppercase tracking-wider">Deployment (Optional)</h3>
                        </div>
                        <div className="grid gap-2">
                            <Label>Department</Label>
                            <Select value={formData.departmentId} onValueChange={(val) => handleSelectChange('departmentId', val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => <SelectItem key={d.id || d._id} value={String(d.id || d._id)}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Section</Label>
                            <Select value={formData.sectionId} onValueChange={(val) => handleSelectChange('sectionId', val)} disabled={!formData.departmentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map(s => <SelectItem key={s.id || s._id} value={String(s.id || s._id)}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Line</Label>
                            <Select value={formData.lineId} onValueChange={(val) => handleSelectChange('lineId', val)} disabled={!formData.sectionId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Line" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lines.map(l => <SelectItem key={l.id || l._id} value={String(l.id || l._id)}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Candidate Status</Label>
                            <Select value={formData.status} onValueChange={(val) => handleSelectChange('status', val)}>
                                <SelectTrigger className="border-slate-200">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PRESENT">Present</SelectItem>
                                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                                    <SelectItem value="LEFT">Left</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="sticky bottom-0 bg-white pt-4 pb-2 border-t mt-4">
                        <Button 
                            variant="outline" 
                            onClick={closeModal}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSubmit} 
                            disabled={isCreating || isUpdating}
                            className={`${selectedUser ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white gap-2`}
                        >
                            {(isCreating || isUpdating) ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconCheck className="h-4 w-4" />}
                            {isCreating ? "Registering..." : isUpdating ? "Updating..." : selectedUser ? "Update Details" : "Register Operator"}
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
                        <DialogTitle className="text-center text-xl font-bold">Remove Candidate?</DialogTitle>
                        <DialogDescription className="text-center">
                            Are you sure you want to remove <span className="font-bold text-slate-900">{userToDelete?.fullName}</span> from the hiring pipeline? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-center mt-4">
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1 gap-2"
                        >
                            {isDeleting ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconTrash className="w-4 h-4" />}
                            {isDeleting ? "Removing..." : "Remove"}
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
                            Remove {selectedRows.size} Candidate{selectedRows.size > 1 ? 's' : ''}?
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Are you sure you want to remove <span className="font-bold text-slate-900">{selectedRows.size}</span> selected candidate{selectedRows.size > 1 ? 's' : ''} from the hiring pipeline? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-center mt-4">
                        <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isDeleting}
                            className="flex-1 gap-2"
                        >
                            {isDeleting ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconTrash className="w-4 h-4" />}
                            {isDeleting ? "Removing..." : "Remove All"}
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
                            Import Candidates
                        </DialogTitle>
                        <DialogDescription>
                            Upload an Excel file to register temporary candidates in bulk.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                <h4 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                                    <IconInfoCircle className="h-4 w-4" />
                                    Format Instructions
                                </h4>
                                <p className="text-xs text-blue-800 font-medium">
                                    Your Excel file must contain these column headers:
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-blue-700 font-mono bg-white/50 p-2 rounded-lg">
                                    <span>- Employee Code *</span>
                                    <span>- Name *</span>
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
                                    * Required fields. Manual Employee Code will be used as login ID.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <h4 className="font-bold text-slate-800 text-sm">Step 1: Download Template</h4>
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadTemplate}
                                    className="w-full justify-start gap-2 bg-slate-50 border-slate-200 rounded-xl py-6 h-auto"
                                >
                                    <IconDownload className="h-5 w-5 text-slate-600" />
                                    <div className="text-left">
                                        <div className="font-bold text-sm">Download Excel Template</div>
                                        <div className="text-[10px] text-slate-500 font-medium">Includes sample data and correct headers</div>
                                    </div>
                                </Button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <h4 className="font-bold text-slate-800 text-sm">Step 2: Upload Filled File</h4>
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
                                        <div className="font-bold text-sm">Select Excel File</div>
                                        <div className="text-[10px] text-blue-100 font-medium">Supports .xlsx and .xls formats</div>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default DojoHiring;
