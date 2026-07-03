// src/pages/Admin/Instructor.jsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { format } from "date-fns";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  useGetAllInstructorsQuery,
  useUpdateInstructorMutation,
  useDeleteInstructorMutation,
  useBulkDeleteInstructorsMutation,
  useImportInstructorsMutation,
  useLazyGetInstructorImportTemplateQuery,
  useLazyGetAllInstructorsQuery
} from "@/Redux/AllApi/InstructorApi";
import { useUserRegisterMutation } from "@/Redux/AllApi/AuthApi";
import {
  useGetAllDepartmentsQuery,
  useAssignInstructorMutation,
} from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesBySubSectionQuery } from "@/Redux/AllApi/MachineApi";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconUsers,
  IconSchool,
  IconUserPlus,
  IconFilter,
  IconX,
  IconLoader,
  IconRefresh,
  IconInfoCircle,
  IconExternalLink,
  IconUser,
  IconUpload,
  IconDownload,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

// Import reusable components
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import StatCard from "@/components/common/StatCard";
import FilterBar from "@/components/common/FilterBar";
import { useNavigate } from "react-router-dom";
import axiosInstance from "@/Helper/axiosInstance";

const normalizeStatus = (status) => {
  const s = status || "PRESENT";
  switch (s) {
    case "ACTIVE":
      return "PRESENT";
    case "PENDING":
      return "ON_LEAVE";
    case "SUSPENDED":
    case "BANNED":
      return "LEFT";
    default:
      return s;
  }
};

const Instructor = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isAllSelectedAcrossPages, setIsAllSelectedAcrossPages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastToastId, setLastToastId] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);
  const [formData, setFormData] = useState({
    empId: "",
    idCard: "",
    fullName: "",
    fatherHusbandName: "",
    gender: "MALE",
    departmentId: "",
    sectionId: "",
    lineId: "",
    subSectionId: "",
    stationId: "",
    mentor: "",
    designation: "",
    isEmployee: true,
    dob: "",
    joiningDate: "",
    education: "",
    district: "",
    state: "",
    pin: "",
    busRoute: "",
    email: "",
    phoneNumber: "",
    currentLevel: "L1",
    status: "PRESENT",
    leavingDate: "",
    reasonOfLeaving: "",
    password: "",
    customRoleId: "",
    userName: "",
    unit: "UNIT_1",
  });
  const [formErrors, setFormErrors] = useState({});
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("all");

  const navigate = useNavigate();

  const handleInstructorClick = (instructor) => {
    const handle = instructor.slug || instructor._id;
    navigate(`${handle}`);
  };

  // Debounce search term to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Custom Roles
  useEffect(() => {
    const fetchCustomRoles = async () => {
      try {
        const res = await axiosInstance.get("/api/roles-permissions");
        setCustomRoles(res.data.data.roles.filter(r => !r.isSystemRole));
      } catch (e) {
        console.error("Failed to fetch custom roles", e);
      }
    };
    fetchCustomRoles();
  }, []);

  // API Hooks
  const {
    data: instructorsData,
    isLoading,
    error: instructorsError,
    refetch,
  } = useGetAllInstructorsQuery(
    {
      page: currentPage,
      limit: 10,
      search: debouncedSearchTerm || "",
      status: statusFilter !== "ALL" ? statusFilter : "",
      unit: unitFilter !== "ALL" ? unitFilter : "",
      departmentId: departmentFilter !== "ALL" && departmentFilter !== "HAS_DEPARTMENT" && departmentFilter !== "NO_DEPARTMENT" ? departmentFilter : "",
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const {
    data: departmentsData,
    isLoading: departmentsLoading,
  } = useGetAllDepartmentsQuery(
    {},
    {
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );

  const [registerTrainer, { isLoading: isSubmittingRegister }] = useUserRegisterMutation();
  const [updateTrainer] = useUpdateInstructorMutation();
  const [deleteTrainer] = useDeleteInstructorMutation();
  const [bulkDeleteInstructors] = useBulkDeleteInstructorsMutation();
  const [assignTrainer] = useAssignInstructorMutation();
  const [importInstructors] = useImportInstructorsMutation();
  const [triggerGetTemplate] = useLazyGetInstructorImportTemplateQuery();
  const [triggerGetAllInstructors] = useLazyGetAllInstructorsQuery();

  // Hierarchy Hooks
  const { data: sectionsData } = useGetSectionsByDepartmentQuery(formData.departmentId, { skip: !formData.departmentId });
  const { data: linesData } = useGetLinesBySectionQuery(formData.sectionId, { skip: !formData.sectionId });
  const { data: subSectionsData } = useGetSubSectionsByLineQuery(formData.lineId, { skip: !formData.lineId });
  const { data: machinesData } = useGetMachinesBySubSectionQuery(formData.subSectionId, { skip: !formData.subSectionId });

  const sections = sectionsData?.data || [];
  const lines = linesData?.data || [];
  const subSections = subSectionsData?.data || [];
  const machines = machinesData?.data || [];
  const fileInputRef = useRef(null);

  const instructors = instructorsData?.data?.users || [];
  const totalPages = instructorsData?.data?.totalPages || 1;
  const departments = departmentsData?.data?.departments || [];

  // Filter options for reusable components
  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "PRESENT", label: "Present" },
    { value: "ON_LEAVE", label: "On Leave" },
    { value: "LEFT", label: "Left" },
  ];

  const departmentOptions = useMemo(() => {
    const options = [
      { value: "ALL", label: "All Departments" },
      { value: "HAS_DEPARTMENT", label: "Has Department" },
      { value: "NO_DEPARTMENT", label: "No Department" },
    ];
    departments.forEach(dept => {
      options.push({ value: dept._id, label: dept.name });
    });
    return options;
  }, [departments]);

  const unitOptions = [
    { value: "ALL", label: "All Units" },
    { value: "UNIT_1", label: "Unit 1" },
    { value: "UNIT_2", label: "Unit 2" },
    { value: "UNIT_3", label: "Unit 3" },
    { value: "UNIT_4", label: "Unit 4" },
    { value: "UNIT_5", label: "Unit 5" },
  ];

  // Active filters for FilterBar
  const activeFilters = useMemo(() => {
    const filters = [];

    if (statusFilter !== "ALL") {
      const statusLabel = statusOptions.find(
        (opt) => opt.value === statusFilter
      )?.label;
      filters.push({ label: "Status", value: statusLabel });
    }

    if (departmentFilter !== "ALL") {
      const departmentLabel = departmentOptions.find(
        (opt) => opt.value === departmentFilter
      )?.label;
      filters.push({ label: "Department", value: departmentLabel });
    }

    if (unitFilter !== "ALL") {
      const unitLabel = unitOptions.find((opt) => opt.value === unitFilter)?.label;
      filters.push({ label: "Unit", value: unitLabel });
    }

    if (searchTerm) {
      filters.push({ label: "Search", value: searchTerm });
    }

    return filters;
  }, [statusFilter, departmentFilter, searchTerm, statusOptions, departmentOptions]);

  // Toast helpers to prevent spam
  const showToast = useCallback(
    (type, message) => {
      if (lastToastId) {
        toast.dismiss(lastToastId);
      }
      let toastId;
      if (type === "success") {
        toastId = toast.success(message);
      } else if (type === "error") {
        toastId = toast.error(message);
      } else {
        toastId = toast(message);
      }
      setLastToastId(toastId);
    },
    [lastToastId]
  );

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    if (name === 'empId') {
      setFormData({
        ...formData,
        [name]: newValue,
        password: newValue,
        userName: newValue.toLowerCase().replace(/\s+/g, '_')
      });
    } else {
      setFormData({ ...formData, [name]: newValue });
    }

    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: "" });
    }
  };

  const resetForm = () => {
    setFormData({
      empId: "",
      idCard: "",
      fullName: "",
      fatherHusbandName: "",
      gender: "MALE",
      departmentId: "",
      sectionId: "",
      lineId: "",
      subSectionId: "",
      stationId: "",
      mentor: "",
      designation: "",
      isEmployee: true,
      dob: "",
      joiningDate: "",
      education: "",
      district: "",
      state: "",
      pin: "",
      busRoute: "",
      email: "",
      phoneNumber: "",
      currentLevel: "L1",
      status: "PRESENT",
      leavingDate: "",
      reasonOfLeaving: "",
      password: "",
      customRoleId: "",
      userName: "",
      unit: "UNIT_1",
    });

    setFormErrors({});
    setSelectedIds([]);
    setIsAllSelectedAcrossPages(false);
  };

  const handleAddInstructor = async () => {
    setFormErrors({});
    const errors = {};

    if (!formData.fullName?.trim()) errors.fullName = "Full name is required";
    if (!formData.userName?.trim()) errors.userName = "Username is required";
    if (!formData.email?.trim()) errors.email = "Email is required";
    if (!formData.phoneNumber?.trim()) errors.phoneNumber = "Phone number is required";
    if (!formData.password?.trim()) errors.password = "Password is required";
    if (!formData.unit) errors.unit = "Unit is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast("error", "Please fix errors");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const instructorData = {
        ...formData,
        role: selectedInstructor?.role === "CUSTOM" ? "CUSTOM" : "INSTRUCTOR",
        isTrainer: true,
        isEmployee: true,
        fullName: formData.fullName.trim(),
        userName: formData.userName.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password.trim(),
      };

      await registerTrainer(instructorData).unwrap();
      showToast("success", "Instructor registered successfully!");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      console.error("Register instructor error:", error);
      showToast("error", error?.data?.message || "Failed to register instructor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInstructor = async () => {
    if (!formData.fullName?.trim() || !formData.userName?.trim()) {
      showToast("error", "Basic fields are required");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { password, ...updateData } = formData;
      await updateTrainer({
        id: selectedInstructor._id,
        ...updateData,
        role: selectedInstructor?.role === "CUSTOM" ? "CUSTOM" : "INSTRUCTOR",
        isTrainer: true,
      }).unwrap();

      showToast("success", "Instructor updated successfully!");
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedInstructor(null);
      refetch();
    } catch (error) {
      showToast("error", error?.data?.message || "Failed to update instructor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInstructor = async () => {
    try {
      await deleteTrainer(selectedInstructor._id).unwrap();
      showToast("success", "Instructor deleted successfully!");
      setIsDeleteDialogOpen(false);
      setSelectedInstructor(null);
      refetch();
    } catch (error) {
      showToast("error", "Failed to delete instructor");
    }
  };

  const handleBulkDelete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = isAllSelectedAcrossPages
        ? { isAllSelected: true, filters: { search: debouncedSearchTerm, status: statusFilter !== "ALL" ? statusFilter : "", unit: unitFilter !== "ALL" ? unitFilter : "", departmentId: departmentFilter !== "ALL" ? departmentFilter : "", role: "INSTRUCTOR" } }
        : { ids: selectedIds };

      await bulkDeleteInstructors(payload).unwrap();
      showToast("success", `Instructors deleted successfully!`);
      setSelectedIds([]);
      setIsAllSelectedAcrossPages(false);
      setIsBulkDeleteDialogOpen(false);
      refetch();
    } catch (error) {
      showToast("error", "Failed to delete instructors");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === instructors.length) {
      setSelectedIds([]);
      setIsAllSelectedAcrossPages(false);
    } else {
      setSelectedIds(instructors.map(s => s._id));
    }
  };

  const toggleSelectId = (id) => {
    setIsAllSelectedAcrossPages(false);
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExportExcel = async () => {
    try {
      const toastId = toast.loading("Preparing Excel file...");
      const result = await triggerGetAllInstructors({
        page: 1,
        limit: 10000,
        search: debouncedSearchTerm || "",
        status: statusFilter !== "ALL" ? statusFilter : "",
        unit: unitFilter !== "ALL" ? unitFilter : "",
      }).unwrap();

      const allData = result?.data?.users || [];
      if (allData.length === 0) {
        toast.dismiss(toastId);
        showToast("error", "No data to export");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Instructors');
      worksheet.columns = [
        { header: 'Full Name', key: 'fullName', width: 25 },
        { header: 'Username', key: 'userName', width: 20 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone Number', key: 'phoneNumber', width: 15 },
        { header: 'Emp Code', key: 'empId', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Hierarchy', key: 'fromInfo', width: 40 },
        { header: 'Joined', key: 'joiningDate', width: 15 },
      ];

      allData.forEach(item => {
        worksheet.addRow({
          ...item,
          joiningDate: item.joiningDate ? format(new Date(item.joiningDate), "yyyy-MM-dd") : '-',
        });
      });

      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Instructors_Export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.dismiss(toastId);
      showToast("success", "Exported successfully!");
    } catch (error) {
      showToast("error", "Export failed");
    }
  };

  const openEditDialog = (instructor) => {
    setSelectedInstructor(instructor);
    setFormData({
      fullName: instructor.fullName || "",
      userName: instructor.userName || "",
      email: instructor.email || "",
      phoneNumber: instructor.phoneNumber || "",
      password: "",
      status: instructor.status || "PRESENT",
      unit: instructor.unit || "UNIT_1",
      empId: instructor.empId || "",
      idCard: instructor.idCard || "",
      fatherHusbandName: instructor.fatherHusbandName || "",
      gender: instructor.gender || "MALE",
      departmentId: instructor.departmentId ? String(instructor.departmentId) : (instructor.department?._id ? String(instructor.department._id) : ""),
      sectionId: instructor.sectionId ? String(instructor.sectionId) : "",
      lineId: instructor.lineId ? String(instructor.lineId) : "",
      subSectionId: instructor.subSectionId ? String(instructor.subSectionId) : "",
      stationId: instructor.stationId ? String(instructor.stationId) : "",
      mentor: instructor.mentor || "",
      designation: instructor.designation || "",
      isEmployee: true,
      dob: instructor.dob ? new Date(instructor.dob).toISOString().split('T')[0] : "",
      joiningDate: instructor.joiningDate ? new Date(instructor.joiningDate).toISOString().split('T')[0] : "",
      education: instructor.education || "",
      district: instructor.district || "",
      state: instructor.state || "",
      pin: instructor.pin || "",
      busRoute: instructor.busRoute || "",
      currentLevel: instructor.currentLevel || "L1",
      leavingDate: instructor.leavingDate ? new Date(instructor.leavingDate).toISOString().split('T')[0] : "",
      reasonOfLeaving: instructor.reasonOfLeaving || "",
      customRoleId: instructor.customRoleId ? String(instructor.customRoleId) : "",
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case "PRESENT": return <Badge variant="success" className="bg-green-100 text-green-700 border-green-200">Present</Badge>;
      case "ON_LEAVE": return <Badge variant="warning" className="bg-amber-100 text-amber-700 border-amber-200">On Leave</Badge>;
      case "LEFT": return <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Left</Badge>;
      default: return <Badge variant="secondary">{normalized}</Badge>;
    }
  };

  const clearFilters = () => {
    setStatusFilter("ALL");
    setDepartmentFilter("ALL");
    setUnitFilter("ALL");
    setSearchTerm("");
    setActiveTab("all");
    setCurrentPage(1);
  };

  if (isLoading) return <div className="p-8"><Skeleton className="h-20 w-full mb-4" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Instructors" value={instructorsData?.data?.totalUsers || 0} icon={IconUsers} iconColor="text-blue-600" iconBgColor="bg-blue-50" />
        <StatCard title="Present Today" value={instructorsData?.data?.counts?.presentCount || 0} icon={IconUser} iconColor="text-green-600" iconBgColor="bg-green-50" />
        <StatCard title="On Leave" value={instructorsData?.data?.counts?.onLeaveCount || 0} icon={IconInfoCircle} iconColor="text-amber-600" iconBgColor="bg-amber-50" />
      </div>

      {/* Tabs & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all" onClick={() => clearFilters()}>All</TabsTrigger>
            <TabsTrigger value="present" onClick={() => setStatusFilter("PRESENT")}>Present</TabsTrigger>
            <TabsTrigger value="leave" onClick={() => setStatusFilter("ON_LEAVE")}>On Leave</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel} className="bg-blue-50 border-blue-200 text-blue-700">
            <IconDownload className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <IconPlus className="h-4 w-4 mr-2" /> Add Instructor
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <SearchInput placeholder="Search name, code, email..." value={searchTerm} onChange={setSearchTerm} className="w-full md:w-80" />
            <div className="flex flex-wrap gap-2">
              <FilterSelect value={statusFilter} onValueChange={setStatusFilter} options={statusOptions} placeholder="Status" />
              <FilterSelect value={departmentFilter} onValueChange={setDepartmentFilter} options={departmentOptions} placeholder="Department" className="w-48" />
              {(statusFilter !== "ALL" || departmentFilter !== "ALL" || searchTerm) && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground"><IconX className="h-4 w-4 mr-1" />Reset</Button>
              )}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center justify-between">
              <span className="text-red-800 text-sm font-medium">{selectedIds.length} Instructors Selected</span>
              <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteDialogOpen(true)}>
                <IconTrash className="h-4 w-4 mr-2" /> Bulk Delete Permanently
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px] px-4"><Checkbox checked={instructors.length > 0 && selectedIds.length === instructors.length} onCheckedChange={toggleSelectAll} /></TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Emp Code</TableHead>
                <TableHead>Joining / Leaving</TableHead>
                <TableHead>Hierarchy Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right px-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.length > 0 ? (
                instructors.map((instructor) => (
                  <TableRow key={instructor._id} className="group hover:bg-muted/30 cursor-pointer" onClick={() => handleInstructorClick(instructor)}>
                    <TableCell className="px-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.includes(instructor._id)} onCheckedChange={() => toggleSelectId(instructor._id)} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={instructor.avatar?.url} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{instructor.fullName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm">{instructor.fullName}</p>
                          <p className="text-xs text-muted-foreground">@{instructor.userName}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono bg-blue-50/50">{instructor.empId || "N/A"}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                      {instructor.status === "LEFT" ? (
                        instructor.leavingDate ? (
                          <div className="flex flex-col">
                            <span className="text-red-600 font-medium">{format(new Date(instructor.leavingDate), "dd MMM yyyy")}</span>
                            <span className="text-[10px] text-red-400">Left</span>
                          </div>
                        ) : (
                          <span className="italic text-gray-400">Date not set</span>
                        )
                      ) : (
                        instructor.joiningDate ? format(new Date(instructor.joiningDate), "dd MMM yyyy") : "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 max-w-[200px]">
                        <p className="text-[11px] font-medium text-blue-800 truncate">{instructor.deptName || "No Dept"}</p>
                        <p className="text-[10px] text-muted-foreground truncate italic">{[instructor.sectionName, instructor.lineName, instructor.subSectionName, instructor.stationName].filter(Boolean).join(' > ') || "---"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(instructor.status)}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p>{instructor.email}</p>
                        <p className="text-muted-foreground">{instructor.phoneNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-4">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(instructor); }} className="h-8 w-8 p-0"><IconPencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedInstructor(instructor); setIsDeleteDialogOpen(true); }} className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"><IconTrash className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={8} className="h-64 text-center text-muted-foreground">No instructors found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-2">
          <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Wide Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) { setIsAddDialogOpen(false); setIsEditDialogOpen(false); resetForm(); }
      }} className="max-w-[1200px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {isAddDialogOpen ? <><IconUserPlus className="text-blue-600" /> Add Instructor</> : <><IconPencil className="text-blue-600" /> Edit Instructor</>}
            </DialogTitle>
            <DialogDescription>Maintain instructor profile and hierarchy assignments.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4 border-y my-2">
            <div className="space-y-4 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Identity Section */}
              <div className="space-y-2 col-span-full">
                <h4 className="text-sm font-semibold text-blue-700 bg-blue-50/50 p-2 rounded">1. Identity & Basic Info</h4>
              </div>
              <div className="space-y-2">
                <Label>Employee Code *</Label>
                <Input name="empId" value={formData.empId} onChange={handleInputChange} placeholder="EMP123" />
              </div>
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input name="email" value={formData.email} onChange={handleInputChange} type="email" placeholder="john@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Mobile No *</Label>
                <Input name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} placeholder="10-digit number" />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={formData.gender} onValueChange={v => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input name="designation" value={formData.designation} onChange={handleInputChange} placeholder="Senior Trainer" />
              </div>

              {/* Hierarchy Section */}
              <div className="space-y-2 col-span-full mt-4">
                <h4 className="text-sm font-semibold text-blue-700 bg-blue-50/50 p-2 rounded">2. Hierarchy & Assignment</h4>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={formData.departmentId} onValueChange={v => setFormData({ ...formData, departmentId: v, sectionId: "", lineId: "", subSectionId: "", stationId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Dept" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d._id} value={String(d._id)}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={formData.sectionId} disabled={!formData.departmentId} onValueChange={v => setFormData({ ...formData, sectionId: v, lineId: "", subSectionId: "", stationId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                  <SelectContent>{sections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Line</Label>
                <Select value={formData.lineId} disabled={!formData.sectionId} onValueChange={v => setFormData({ ...formData, lineId: v, subSectionId: "", stationId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Line" /></SelectTrigger>
                  <SelectContent>{lines.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub-section</Label>
                <Select value={formData.subSectionId} disabled={!formData.lineId} onValueChange={v => setFormData({ ...formData, subSectionId: v, stationId: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Sub" /></SelectTrigger>
                  <SelectContent>{subSections.map(ss => <SelectItem key={ss.id} value={String(ss.id)}>{ss.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-l pl-6">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-blue-700 bg-blue-50/50 p-2 rounded">3. Employment Info</h4>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{unitOptions.filter(o => o.value !== "ALL").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                    <SelectItem value="LEFT">Inactive (Left)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Joining Date</Label>
                <Input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label>Current Level</Label>
                <Select value={formData.currentLevel} onValueChange={v => setFormData({ ...formData, currentLevel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L1">L1</SelectItem>
                    <SelectItem value="L2">L2</SelectItem>
                    <SelectItem value="L3">L3</SelectItem>
                    <SelectItem value="L4">L4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAddDialogOpen && (
                <div className="p-3 bg-blue-50 rounded border border-blue-100 mt-6">
                  <p className="text-xs text-blue-800 font-medium">Auto-Password</p>
                  <p className="text-[10px] text-blue-600">The password will be set identical to the Employee Code.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setIsEditDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={isAddDialogOpen ? handleAddInstructor : handleEditInstructor} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? <><IconLoader className="h-4 w-4 mr-2 animate-spin" /> Processing...</> : (isAddDialogOpen ? "Register Instructor" : "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen || isBulkDeleteDialogOpen} onOpenChange={open => { if (!open) { setIsDeleteDialogOpen(false); setIsBulkDeleteDialogOpen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><IconTrash /> Delete {isBulkDeleteDialogOpen ? "Instructors" : "Instructor"}</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {isBulkDeleteDialogOpen ? "the selected instructors" : selectedInstructor?.fullName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => { setIsDeleteDialogOpen(false); setIsBulkDeleteDialogOpen(false); }}>Cancel</Button>
            <Button variant="destructive" onClick={isBulkDeleteDialogOpen ? handleBulkDelete : handleDeleteInstructor} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Instructor;
