// src/pages/Admin/Students.jsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import axiosInstance from "@/Helper/axiosInstance";
import {
  useGetAllStudentsQuery,
  useLazyGetAllStudentsQuery,
} from "@/Redux/AllApi/InstructorApi";
import { format } from "date-fns";
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver';
import { useUserRegisterMutation } from "@/Redux/AllApi/AuthApi";
import {
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useBulkDeleteUsersMutation,
  useImportEmployeesMutation,
  useLazyExportStudentsQuery,
  useLazyGetImportTemplateQuery,
  useGetImportLogsQuery,
  useGetImportLogDetailsQuery,
} from "@/Redux/AllApi/UserApi";
import {
  useGetAllDepartmentsQuery,
  useAddStudentToDepartmentMutation,
} from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetAllContractorsQuery } from "@/Redux/AllApi/ContractorApi";
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
  IconAlertTriangle,
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
  IconHistory,
  IconUserX,
  IconUserMinus,
  IconCalendar,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

import { FormSelect } from "@/components/form/FormSelect";

// Import reusable components
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import StatCard from "@/components/common/StatCard";
import FilterBar from "@/components/common/FilterBar";
import { useNavigate, useLocation } from "react-router-dom";
import { getMediaUrl } from "@/utils/mediaUtils";
import { safeDateFormat, dateToInputFormat } from "@/utils/dateUtils";
import StudentLevelManager from "@/components/admin/StudentLevelManager";


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

const safeDateToISO = (dateValue) => {
  return dateToInputFormat(dateValue);
};

const Students = () => {
  const currentUser = useSelector((state) => state.auth.user);

  const hasPermission = (permission) => {
    if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
    return currentUser?.customRole?.permissions?.includes(permission);
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isAllSelectedAcrossPages, setIsAllSelectedAcrossPages] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastToastId, setLastToastId] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);
  const [courseLevels, setCourseLevels] = useState([]);
  const [formData, setFormData] = useState({
    empId: "",
    idCard: "",
    fullName: "",
    fatherHusbandName: "",
    gender: "MALE",
    departments: [],
    sections: [],
    lines: [],
    subSections: [],
    stations: [],
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
    currentLevel: null,
    status: "PRESENT",
    leavingDate: "",
    reasonOfLeaving: "",
    password: "",
    customRoleId: "",
    userName: "",
    unit: "UNIT_1",
    supervisor: "",
    incharge: "",
    contractorId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    dateFrom: "",
    dateTo: "",
    departmentId: "",
    sectionId: "",
    lineId: "",
    subSectionId: "",
    stationId: "",
    unit: "",
    shift: "",
    date: "",
  });
  const [activeTab, setActiveTab] = useState("all");


  const handleStudentClick = (student) => {
    if (!student) return;
    const handle = student.slug || student._id || student.id;
    if (handle) {
      navigate(`${handle}`);
    } else {
      console.error("Student missing ID/slug:", student);
      toast.error("Could not open student details: Missing ID");
    }
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

  // Fetch Course Levels
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await axiosInstance.get("/api/course-level-config/active");
        if (res.data?.data?.levels) {
          const sortedLevels = [...res.data.data.levels].sort((a, b) => a.order - b.order);
          setCourseLevels(sortedLevels);
          // Set default level if it's a new form
          if (!isEditDialogOpen && !formData.currentLevel) {
            setFormData(prev => ({ ...prev, currentLevel: null }));
          }
        }
      } catch (e) {
        console.error("Failed to fetch course levels", e);
      }
    };
    fetchLevels();
  }, [isEditDialogOpen]);


  // API Hooks
  const {
    data: studentsData,
    isLoading,
    error: studentsError,
    refetch,
  } = useGetAllStudentsQuery(
    {
      page: currentPage,
      limit: 10,
      search: debouncedSearchTerm || "",
      status: filters.status,
      unit: filters.unit,
      departmentId: filters.departmentId,
      sectionId: filters.sectionId,
      lineId: filters.lineId,
      subSectionId: filters.subSectionId,
      stationId: filters.stationId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      shift: filters.shift,
      date: filters.date,
      includeLeft: "true",
    },
    {
      // Prevent unnecessary refetches
      refetchOnMountOrArgChange: true,
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );
  const {
    data: departmentsData,
    isLoading: departmentsLoading,
    error: departmentsError,
  } = useGetAllDepartmentsQuery(
    {},
    {
      refetchOnFocus: false,
      refetchOnReconnect: false,
    }
  );
  const [registerOperator, { isLoading: isSubmittingRegister }] =
    useCreateUserMutation();
  const [updateStudent] = useUpdateUserMutation();
  const [deleteStudent] = useDeleteUserMutation();
  const [bulkDeleteUsers] = useBulkDeleteUsersMutation();
  const [assignStudent] = useAddStudentToDepartmentMutation();
  const [importEmployees] = useImportEmployeesMutation();
  const [triggerGetTemplate] = useLazyGetImportTemplateQuery();
  const [triggerGetAllStudents] = useLazyGetAllStudentsQuery();
  const { data: importLogsData, isLoading: isLoadingLogs } = useGetImportLogsQuery();
  const importLogs = importLogsData?.data || [];

  // Hierarchy Hooks for Dialog Form
  const { data: sectionsData } = useGetSectionsByDepartmentQuery(formData.departments.join(','), { skip: !formData.departments.length });
  const { data: linesData } = useGetLinesBySectionQuery(formData.sections.join(','), { skip: !formData.sections.length });
  const { data: subSectionsData } = useGetSubSectionsByLineQuery(formData.lines.join(','), { skip: !formData.lines.length });
  const { data: machinesData } = useGetMachinesBySubSectionQuery(formData.subSections.join(','), { skip: !formData.subSections.length });
  const { data: contractorsResponse } = useGetAllContractorsQuery();
  const contractorsList = contractorsResponse?.data || [];

  const sections = sectionsData?.data || [];
  const lines = linesData?.data || [];
  const subSections = subSectionsData?.data || [];
  const machines = machinesData?.data || [];

  // Hierarchy Hooks for Filtering
  const { data: filterSectionData } = useGetSectionsByDepartmentQuery(filters.departmentId, { skip: !filters.departmentId });
  const { data: filterLineData } = useGetLinesBySectionQuery(filters.sectionId, { skip: !filters.sectionId });
  const { data: filterSubSectionData } = useGetSubSectionsByLineQuery(filters.lineId, { skip: !filters.lineId });
  const { data: filterMachineData } = useGetMachinesBySubSectionQuery(filters.subSectionId, { skip: !filters.subSectionId });

  const filterSections = filterSectionData?.data || [];
  const filterLines = filterLineData?.data || [];
  const filterSubSections = filterSubSectionData?.data || [];
  const filterStations = filterMachineData?.data || [];
  const fileInputRef = useRef(null);

  const students = studentsData?.data?.users || [];
  const totalPages = studentsData?.data?.totalPages || 1;
  const departments = departmentsData?.data?.departments || [];

  const availableDepartments = useMemo(() => {
    if (currentUser?.role === 'CUSTOM') {
      let allowedDepts = [];
      if (currentUser.departmentId) allowedDepts.push(String(currentUser.departmentId));
      if (Array.isArray(currentUser.departments)) {
        currentUser.departments.forEach(d => allowedDepts.push(String(d)));
      } else if (typeof currentUser.departments === 'string') {
        try {
          const parsed = JSON.parse(currentUser.departments);
          if (Array.isArray(parsed)) parsed.forEach(d => allowedDepts.push(String(d)));
        } catch (e) {}
      }
      
      allowedDepts = [...new Set(allowedDepts)].filter(Boolean);
      
      if (allowedDepts.length > 0) {
        return departments.filter(d => allowedDepts.includes(String(d._id) || String(d.id)));
      }
    }
    return departments;
  }, [departments, currentUser]);

  // Filter options for reusable components
  const statusOptions = [
    { value: "ALL", label: "All Status" },
    { value: "PRESENT", label: "Present" },
    { value: "ON_LEAVE", label: "On Leave" },
    { value: "LEFT", label: "Left" },
  ];

  const departmentOptions = [
    { value: "ALL", label: "All Departments" },
    { value: "HAS_DEPARTMENT", label: "Has Department" },
    { value: "NO_DEPARTMENT", label: "No Department" },
  ];

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
    const list = [];
    if (filters.dateFrom) list.push({ label: "From", value: filters.dateFrom });
    if (filters.dateTo) list.push({ label: "To", value: filters.dateTo });
    if (filters.departmentId) {
      const d = availableDepartments.find(item => String(item._id || item.id) === filters.departmentId);
      list.push({ label: "Department", value: d ? d.name : filters.departmentId });
    }
    if (filters.sectionId) {
      const s = filterSections.find(item => String(item.id) === filters.sectionId);
      list.push({ label: "Section", value: s ? s.name : filters.sectionId });
    }
    if (filters.lineId) {
      const l = filterLines.find(item => String(item.id) === filters.lineId);
      list.push({ label: "Line", value: l ? l.name : filters.lineId });
    }
    if (filters.subSectionId) {
      const ss = filterSubSections.find(item => String(item.id) === filters.subSectionId);
      list.push({ label: "Sub-Section", value: ss ? ss.name : filters.subSectionId });
    }
    if (filters.stationId) {
      const st = filterStations.find(item => String(item.id) === filters.stationId);
      list.push({ label: "Station", value: st ? st.name : filters.stationId });
    }
    if (filters.shift) list.push({ label: "Shift", value: filters.shift });
    if (filters.unit) list.push({ label: "Unit", value: filters.unit });
    if (filters.status) {
      const displayVal = filters.status === "Present" ? "Present (Attendance)" : filters.status === "Absent" ? "Absent (Attendance)" : filters.status;
      list.push({ label: "Status", value: displayVal });
    }
    if (searchTerm) {
      list.push({ label: "Search", value: searchTerm });
    }
    return list;
  }, [filters, searchTerm, availableDepartments, filterSections, filterLines, filterSubSections, filterStations]);

  // Filtered students (handled directly by API query)
  const filteredStudents = useMemo(() => {
    return students;
  }, [students]);

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

    // Auto-set password and username when empId changes
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

    // Clear error for this field when user starts typing
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
      departments: [],
      sections: [],
      lines: [],
      subSections: [],
      stations: [],
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
      currentLevel: null,
      status: "PRESENT",
      leavingDate: "",
      reasonOfLeaving: "",
      password: "",
      customRoleId: "",
      userName: "",
      unit: "UNIT_1",
      supervisor: "",
      incharge: "",
      contractorId: "",
    });

    setFormErrors({});
    setSelectedIds([]);
    setIsAllSelectedAcrossPages(false);
  };

  const handleAddStudent = async () => {
    // Reset previous errors
    setFormErrors({});
    const errors = {};

    // Validate required fields
    if (!formData.fullName?.trim()) {
      errors.fullName = "Full name is required";
    }
    if (!formData.userName?.trim()) {
      errors.userName = "Username is required";
    }
    if (!formData.phoneNumber?.trim()) {
      errors.phoneNumber = "Phone number is required";
    }
    if (!formData.password?.trim()) {
      errors.password = "Password is required";
    }
    if (!formData.unit) {
      errors.unit = "Unit is required";
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email?.trim() && !emailRegex.test(formData.email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    // Validate username format (no spaces, minimum length)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (
      formData.userName?.trim() &&
      !usernameRegex.test(formData.userName.trim())
    ) {
      errors.userName =
        "Username must be 3-20 characters long and contain only letters, numbers, and underscores";
    }

    // Validate password length
    if (formData.password?.trim() && formData.password.trim().length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    // If there are validation errors, show them and return
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast("error", "Please fix the form errors before submitting");
      return;
    }

    // Prevent double submission
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Prepare data for register API
      const studentData = {
        fullName: formData.fullName.trim(),
        userName: formData.userName.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password.trim(),
        role: "STUDENT",
        isEmployee: true,
        unit: formData.unit,
        empId: formData.empId?.trim() || null,
        idCard: formData.idCard?.trim() || null,
        fatherHusbandName: formData.fatherHusbandName?.trim() || null,
        gender: formData.gender,
        departments: formData.departments,
        stations: formData.stations,
        sectionId: formData.sections[0] || null,
        subSectionId: formData.subSections[0] || null,
        lineId: formData.lines[0] || null,
        mentor: formData.mentor?.trim() || null,
        designation: formData.designation?.trim() || null,
        dob: formData.dob || null,
        joiningDate: formData.joiningDate || null,
        education: formData.education?.trim() || null,
        district: formData.district?.trim() || null,
        state: formData.state?.trim() || null,
        pin: formData.pin?.trim() || null,
        busRoute: formData.busRoute?.trim() || null,
        currentLevel: formData.currentLevel,
        status: formData.status,
        leavingDate: formData.leavingDate || null,
        reasonOfLeaving: formData.reasonOfLeaving?.trim() || null,
        supervisor: formData.supervisor?.trim() || null,
        incharge: formData.incharge?.trim() || null,
        customRoleId: formData.customRoleId || null,
        contractorId: formData.contractorId ? Number(formData.contractorId) : null,
      };


      const result = await registerOperator(studentData).unwrap();
      showToast("success", "Operator registered successfully!");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    } catch (error) {
      console.error("Register operator error:", error);
      // ... error handling remains same
      let errorMessage = "Failed to register operator. Please try again.";
      if (error?.data?.message) errorMessage = error.data.message;
      showToast("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStudent = async () => {
    if (
      !formData.fullName?.trim() ||
      !formData.userName?.trim() ||
      !formData.phoneNumber?.trim()
    ) {
      showToast("error", "Basic fields are required");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { password, ...updateData } = formData;
      const cleanedData = {
        fullName: updateData.fullName.trim(),
        userName: updateData.userName.trim().toLowerCase(),
        email: updateData.email.trim().toLowerCase(),
        phoneNumber: updateData.phoneNumber.trim(),
        role: "STUDENT",
        isEmployee: true,
        empId: updateData.empId?.trim() || null,
        idCard: updateData.idCard?.trim() || null,
        fatherHusbandName: updateData.fatherHusbandName?.trim() || null,
        gender: updateData.gender,
        departments: updateData.departments,
        stations: updateData.stations,
        sectionId: updateData.sections[0] || null,
        subSectionId: updateData.subSections[0] || null,
        lineId: updateData.lines[0] || null,
        mentor: updateData.mentor?.trim() || null,
        designation: updateData.designation?.trim() || null,
        dob: updateData.dob || null,
        joiningDate: updateData.joiningDate || null,
        education: updateData.education?.trim() || null,
        district: updateData.district?.trim() || null,
        state: updateData.state?.trim() || null,
        pin: updateData.pin?.trim() || null,
        busRoute: updateData.busRoute?.trim() || null,
        currentLevel: updateData.currentLevel,
        status: updateData.status,
        leavingDate: updateData.leavingDate || null,
        reasonOfLeaving: updateData.reasonOfLeaving?.trim() || null,
        supervisor: updateData.supervisor?.trim() || null,
        incharge: updateData.incharge?.trim() || null,
        customRoleId: updateData.customRoleId || null,
        unit: updateData.unit,
        contractorId: updateData.contractorId ? Number(updateData.contractorId) : null,
      };


      await updateStudent({
        id: selectedStudent._id,
        ...cleanedData,
      }).unwrap();

      showToast("success", "Operator updated successfully!");
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedStudent(null);
      refetch();
    } catch (error) {
      console.error("Update operator error:", error);
      const errorMessage =
        error?.data?.message || error?.message || "Failed to update operator";
      showToast("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = async () => {
    try {
      await deleteStudent(selectedStudent._id).unwrap();
      showToast("success", "Operator deleted successfully!");
      setIsDeleteDialogOpen(false);
      setSelectedStudent(null);
      refetch();
    } catch (error) {
      console.error("Delete student error:", error);
      const errorMessage =
        error?.data?.message || error?.message || "Failed to delete student";
      showToast("error", errorMessage);
    }
  };

  const handleBulkDelete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = isAllSelectedAcrossPages
        ? {
            isAllSelected: true,
            filters: {
              search: debouncedSearchTerm,
              status: filters.status,
              unit: filters.unit,
              departmentId: filters.departmentId,
              sectionId: filters.sectionId,
              lineId: filters.lineId,
              subSectionId: filters.subSectionId,
              stationId: filters.stationId,
              dateFrom: filters.dateFrom,
              dateTo: filters.dateTo,
              shift: filters.shift,
              date: filters.date,
            }
          }
        : { ids: selectedIds };

      await bulkDeleteUsers(payload).unwrap();
      showToast("success", `Operators processed for deletion successfully!`);
      setSelectedIds([]);
      setIsAllSelectedAcrossPages(false);
      setIsBulkDeleteDialogOpen(false);
      refetch();
    } catch (error) {
      console.error("Bulk delete error:", error);
      const errorMessage = error?.data?.message || error?.message || "Failed to delete operators";
      showToast("error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
      setIsAllSelectedAcrossPages(false);
    } else {
      setSelectedIds(students.map(s => s._id));
    }
  };

  const toggleSelectId = (id) => {
    setIsAllSelectedAcrossPages(false); // Any manual change drops the "all across pages" flag
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAssignToDepartment = async (departmentId) => {
    try {
      await assignStudent({
        departmentId,
        studentId: selectedStudent._id,
      }).unwrap();

      showToast("success", "Student assigned to department successfully!");
      setIsDepartmentDialogOpen(false);
      setSelectedStudent(null);

      // Refetch to get updated data
      refetch();
    } catch (error) {
      console.error("Assign student error:", error);
      let errorMessage = "Failed to assign student to department";

      if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.status === 400) {
        errorMessage = "Invalid department or student selection";
      }

      showToast("error", errorMessage);
    }
  };
  const handleImportClick = () => {
    setIsImportDialogOpen(true);
  };

  const handleDownloadTemplate = async () => {
    try {
      const toastId = toast.loading("Downloading template...");
      const result = await triggerGetTemplate().unwrap();

      // Use the base64 string directly as the href
      const link = document.createElement("a");
      link.href = result.fileData;
      link.setAttribute("download", "operator_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.dismiss(toastId);
      showToast("success", "Template downloaded successfully");
    } catch (error) {
      console.error("Download template error:", error);
      showToast("error", "Failed to download template");
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset file input value so same file can be selected again
    e.target.value = null;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      showToast("error", "Please select an Excel file (.xlsx or .xls)");
      return;
    }

    const toastId = toast.loading("Importing employees...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await importEmployees(formData).unwrap();

      const successCount = result.data.success?.length || 0;
      const failedCount = result.data.failed?.length || 0;

      if (failedCount > 0) {
        showToast("warning", `Imported ${successCount} employees. ${failedCount} failed.`);
        console.warn("Failed imports:", result.data.failed);
      } else {
        showToast("success", `Successfully imported ${successCount} employees!`);
        setIsImportDialogOpen(false);
      }

      toast.dismiss(toastId);
      refetch();
    } catch (error) {
      console.error("Import error:", error);
      toast.dismiss(toastId);
      showToast("error", error?.data?.message || "Failed to import employees");
    }
  };

  const handleExportExcel = async () => {
    const toastId = toast.loading("Preparing Excel file...");
    try {
      // Paginate through all records — backend may cap single-page results
      const PAGE_SIZE = 100;
      let allStudents = [];
      let page = 1;
      let totalUsers = Infinity;

      while (allStudents.length < totalUsers) {
        const result = await triggerGetAllStudents({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearchTerm || "",
          status: filters.status,
          unit: filters.unit,
          departmentId: filters.departmentId,
          sectionId: filters.sectionId,
          lineId: filters.lineId,
          subSectionId: filters.subSectionId,
          stationId: filters.stationId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          shift: filters.shift,
          date: filters.date,
          includeLeft: "true",
        }).unwrap();

        const batch = result?.data?.users || [];
        totalUsers = result?.data?.totalUsers ?? 0;
        allStudents = [...allStudents, ...batch];

        if (batch.length === 0) break;
        page++;
      }

      if (allStudents.length === 0) {
        toast.dismiss(toastId);
        showToast("error", "No data to export");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Operators');

      worksheet.columns = [
        { header: "Employee Code", key: "empId", width: 15 },
        { header: "Card No.", key: "idCard", width: 15 },
        { header: "Name", key: "fullName", width: 25 },
        { header: "Username", key: "userName", width: 20 },
        { header: "Father / Husband Name", key: "fatherHusbandName", width: 25 },
        { header: "Gender", key: "gender", width: 10 },
        { header: "Unit", key: "unit", width: 12 },
        { header: "Department", key: "department", width: 25 },
        { header: "Section", key: "section", width: 20 },
        { header: "Line", key: "line", width: 15 },
        { header: "Sub Section", key: "subSection", width: 20 },
        { header: "Station No.", key: "stationNo", width: 15 },
        { header: "Supervisor", key: "supervisor", width: 20 },
        { header: "Incharge", key: "incharge", width: 20 },
        { header: "Mentor", key: "mentor", width: 20 },
        { header: "Designation", key: "designation", width: 20 },
        { header: "DOB", key: "dob", width: 15 },
        { header: "D.O.J.", key: "joiningDate", width: 15 },
        { header: "Education", key: "education", width: 20 },
        { header: "Distt", key: "district", width: 15 },
        { header: "State", key: "state", width: 15 },
        { header: "PIN", key: "pin", width: 10 },
        { header: "Bus Route", key: "busRoute", width: 15 },
        { header: "E-Mail ID", key: "email", width: 30 },
        { header: "Mobile No", key: "phoneNumber", width: 15 },
        { header: "Level", key: "currentLevel", width: 10 },
        { header: "Date of Leaving", key: "leavingDate", width: 15 },
        { header: "Reason of Leaving", key: "reasonOfLeaving", width: 25 },
        { header: "Status", key: "status", width: 15 },
      ];

      allStudents.forEach((student) => {
        worksheet.addRow({
          empId: student.empId || "",
          idCard: student.idCard || "",
          fullName: student.fullName || "",
          userName: student.userName || "",
          fatherHusbandName: student.fatherHusbandName || "",
          gender: student.gender || "",
          unit: student.unit || "",
          department: student.department?.name || "",
          section: student.sectionName || "",
          line: student.lineName || "",
          subSection: student.subSectionName || "",
          stationNo: student.stationName || "",
          supervisor: student.supervisor || "",
          incharge: student.incharge || "",
          mentor: student.mentor || "",
          designation: student.designation || "",
          dob: safeDateFormat(student.dob, "yyyy-MM-dd"),
          joiningDate: safeDateFormat(student.joiningDate, "yyyy-MM-dd"),
          education: student.education || "",
          district: student.district || "",
          state: student.state || "",
          pin: student.pin || "",
          busRoute: student.busRoute || "",
          email: student.email || "",
          phoneNumber: student.phoneNumber || "",
          currentLevel: student.currentLevel || "",
          leavingDate: safeDateFormat(student.leavingDate, "yyyy-MM-dd"),
          reasonOfLeaving: student.reasonOfLeaving || "",
          status: student.status || "PRESENT",
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
      saveAs(blob, `Operators_Export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      toast.dismiss(toastId);
      showToast("success", `Exported ${allStudents.length} operators successfully!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.dismiss(toastId);
      showToast("error", "Failed to export data");
    }
  };

  const openEditDialog = (student) => {
    setSelectedStudent(student);

    const rawDepts = typeof student.departments === 'string' ? JSON.parse(student.departments || "[]") : (student.departments || []);
    const resolvedDepts = Array.isArray(rawDepts) && rawDepts.length
      ? rawDepts.map(String)
      : ((student.departmentId || student.DepartmentId) ? [String(student.departmentId || student.DepartmentId)] : (student.department?._id ? [String(student.department._id)] : []));

    const rawStations = typeof student.stations === 'string' ? JSON.parse(student.stations || "[]") : (student.stations || []);
    const resolvedStations = Array.isArray(rawStations) && rawStations.length
      ? rawStations.map(String)
      : ((student.stationId || student.StationId) ? [String(student.stationId || student.StationId)] : []);

    const resolvedSections = [
      ...new Set([
        ...(student.sectionId ? [String(student.sectionId)] : []),
        ...(student.assignments || []).map(a => String(a.sectionId))
      ])
    ].filter(Boolean);

    const resolvedLines = [
      ...new Set([
        ...(student.lineId ? [String(student.lineId)] : []),
        ...(student.assignments || []).map(a => String(a.lineId))
      ])
    ].filter(Boolean);

    const resolvedSubSections = [
      ...new Set([
        ...(student.subSectionId ? [String(student.subSectionId)] : []),
        ...(student.assignments || []).map(a => String(a.subSectionId))
      ])
    ].filter(Boolean);

    setFormData({
      fullName: student.fullName || "",
      userName: student.userName || "",
      email: student.email || "",
      phoneNumber: student.phoneNumber || "",
      password: "",
      status: student.status || "PRESENT",
      unit: student.unit || "UNIT_1",
      empId: student.empId || "",
      idCard: student.idCard || "",
      fatherHusbandName: student.fatherHusbandName || student.FatherHusbandName || "",
      gender: student.gender || student.Gender || "MALE",
      departments: resolvedDepts,
      sections: resolvedSections,
      lines: resolvedLines,
      subSections: resolvedSubSections,
      stations: resolvedStations,
      mentor: student.mentor || student.Mentor || "",
      designation: student.designation || student.Designation || "",
      supervisor: student.supervisor || student.Supervisor || "",
      incharge: student.incharge || student.Incharge || "",
      contractorId: student.contractorId ? String(student.contractorId) : "",
      isEmployee: student.isEmployee !== undefined ? student.isEmployee : (student.IsEmployee !== undefined ? student.IsEmployee : true),
      dob: safeDateToISO(student.dob || student.DOB),
      joiningDate: safeDateToISO(student.joiningDate || student.JoiningDate),
      education: student.education || student.Education || "",
      district: student.district || student.District || "",
      state: student.state || student.State || "",
      pin: student.pin || student.PIN || student.Pin || "",
      busRoute: student.busRoute || student.BusRoute || "",
      currentLevel: student.currentLevel || student.CurrentLevel || "L1",
      leavingDate: safeDateToISO(student.leavingDate || student.LeavingDate),
      reasonOfLeaving: student.reasonOfLeaving || student.ReasonOfLeaving || "",
      customRoleId: (student.customRoleId || student.CustomRoleId) ? String(student.customRoleId || student.CustomRoleId) : "",
    });

    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (student) => {
    setSelectedStudent(student);
    setIsDeleteDialogOpen(true);
  };

  const openDepartmentDialog = (student) => {
    setSelectedStudent(student);
    setIsDepartmentDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case "PRESENT":
        return (
          <Badge variant="success" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-green-500"></div> Present
          </Badge>
        );
      case "ON_LEAVE":
        return (
          <Badge variant="warning" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div> On Leave
          </Badge>
        );
      case "LEFT":
        return (
          <Badge
            variant="destructive"
            className="flex items-center gap-1 w-fit"
          >
            <div className="h-2 w-2 rounded-full bg-red-600"></div> Left
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
            <div className="h-2 w-2 rounded-full bg-gray-500"></div> {normalized || "Unknown"}
          </Badge>
        );
    }
  };

  const handleQuickStatusChange = async (studentId, newStatus, oldStatus) => {
    // Confirm destructive actions
    if (["LEFT"].includes(newStatus)) {
      if (
        !window.confirm(
          `Are you sure you want to ${newStatus.toLowerCase()} this student?`
        )
      ) {
        return;
      }
    }

    try {
      await updateStudent({
        id: studentId,
        status: newStatus,
      }).unwrap();

      showToast("success", `Status changed to ${newStatus.toLowerCase()}`);
      refetch();
    } catch (error) {
      console.error("Quick status change error:", error);
      const errorMessage = error?.data?.message || "Failed to update status";
      showToast("error", errorMessage);
    }
  };

  const getDepartmentInfo = (student) => {
    const rawDepts = typeof student.departments === 'string' ? JSON.parse(student.departments || "[]") : (student.departments || []);
    let deptNames = [];
    if (Array.isArray(rawDepts) && rawDepts.length > 0) {
      deptNames = rawDepts.map(id => {
        const d = departments.find(item => String(item._id || item.id) === String(id));
        return d ? d.name : null;
      }).filter(Boolean);
    }
    if (deptNames.length === 0 && student.department) {
      deptNames = [student.department.name];
    }

    const assignedSections = [...new Set((student.assignments || []).map(a => a.sectionName).filter(Boolean))];
    const assignedLines = [...new Set((student.assignments || []).map(a => a.lineName).filter(Boolean))];
    const assignedSubSections = [...new Set((student.assignments || []).map(a => a.subSectionName).filter(Boolean))];
    const assignedStations = [...new Set((student.assignments || []).map(a => a.stationName).filter(Boolean))];

    const sectionsList = assignedSections.length > 0 ? assignedSections : (student.sectionName ? [student.sectionName] : []);
    const linesList = assignedLines.length > 0 ? assignedLines : (student.lineName ? [student.lineName] : []);
    const subSectionsList = assignedSubSections.length > 0 ? assignedSubSections : (student.subSectionName ? [student.subSectionName] : []);
    const stationsList = assignedStations.length > 0 ? assignedStations : (student.stationName ? [student.stationName] : []);

    if (deptNames.length === 0 && sectionsList.length === 0 && linesList.length === 0) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 border-dashed">
          No Assignment
        </Badge>
      );
    }

    return (
      <div className="flex flex-col gap-1 py-1">
        {deptNames.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {deptNames.map((name, idx) => (
              <Badge key={idx} variant="outline" className="w-fit flex items-center gap-1 text-[10px] py-0 px-1.5 h-5 bg-blue-50 text-blue-700 border-blue-200">
                <IconSchool className="h-2.5 w-2.5" />
                {name}
              </Badge>
            ))}
          </div>
        )}
        {(sectionsList.length > 0 || linesList.length > 0) && (
          <div className="text-[10px] font-medium text-muted-foreground flex flex-wrap items-center gap-1 pl-0.5">
            <span className="text-foreground">{sectionsList.join(', ')}</span>
            {sectionsList.length > 0 && linesList.length > 0 && <span className="text-[8px] opacity-50">&gt;</span>}
            <span>{linesList.join(', ')}</span>
          </div>
        )}
        {(subSectionsList.length > 0 || stationsList.length > 0) && (
          <div className="text-[9px] opacity-80 italic text-muted-foreground flex flex-wrap items-center gap-1 pl-0.5">
            {subSectionsList.length > 0 ? subSectionsList.join(', ') : "..."} / {stationsList.length > 0 ? stationsList.join(', ') : "..."}
          </div>
        )}
      </div>
    );
  };

  const clearFilters = () => {
    setFilters({
      status: "",
      dateFrom: "",
      dateTo: "",
      departmentId: "",
      sectionId: "",
      lineId: "",
      subSectionId: "",
      stationId: "",
      unit: "",
      shift: "",
      date: "",
    });
    setSearchTerm("");
    setActiveTab("all");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header with Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Actions Skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="p-6">
              <Skeleton className="h-6 w-full mb-4" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (studentsError) {
    // Handle authentication error specifically
    if (studentsError.status === 401) {
      return (
        <div className="flex flex-col justify-center items-center h-64 space-y-4 p-4">
          <div className="text-red-600 text-lg font-medium">
            Authentication Required
          </div>
          <p className="text-gray-600 text-center">
            Please log in as an admin to view operators
          </p>
          <Button
            onClick={() => (window.location.href = "/login")}
            variant="outline"
          >
            Go to Login
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 p-4">
        <div className="text-red-600 text-lg font-medium">
          Error loading operators
        </div>
        <p className="text-gray-600 text-center">
          {studentsError?.message || "Failed to fetch operators"}
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <IconRefresh className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <Tabs defaultValue="operators" className="w-full space-y-6">
      <TabsList className="bg-slate-100 p-1 rounded-xl h-11 w-fit">
        <TabsTrigger value="operators" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
          Operators
        </TabsTrigger>
        <TabsTrigger value="operatorLevels" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
          Operator Levels
        </TabsTrigger>
      </TabsList>

      <TabsContent value="operators">
    <div className="space-y-6">
      {/* Header with Stats using reusable StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Operators"
          value={studentsData?.data?.totalUsers || 0}
          description="All registered operators"
          icon={IconUsers}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          gradientFrom="from-blue-50"
          gradientTo="to-blue-100"
          borderColor="border-blue-200"
          textColor="text-blue-800"
          valueColor="text-blue-900"
        />

        <StatCard
          title="Present Operators"
          value={studentsData?.data?.counts?.presentCount || 0}
          description="Currently present"
          icon={IconUser}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          gradientFrom="from-green-50"
          gradientTo="to-green-100"
          borderColor="border-green-200"
          textColor="text-green-800"
          valueColor="text-green-900"
        />

        <StatCard
          title="On Leave"
          value={studentsData?.data?.counts?.onLeaveCount || 0}
          description="Currently on leave"
          icon={IconUserMinus}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-600"
          gradientFrom="from-amber-50"
          gradientTo="to-amber-100"
          borderColor="border-amber-200"
          textColor="text-amber-800"
          valueColor="text-amber-900"
        />

        <StatCard
          title="Left Operators"
          value={studentsData?.data?.counts?.leftCount || 0}
          description="No longer active"
          icon={IconUserX}
          iconBgColor="bg-red-100"
          iconColor="text-red-600"
          gradientFrom="from-red-50"
          gradientTo="to-red-100"
          borderColor="border-red-200"
          textColor="text-red-800"
          valueColor="text-red-900"
        />

        <StatCard
          title="Assigned to Sections"
          value={students.filter((s) => s.department).length}
          description="Currently enrolled"
          icon={IconSchool}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          gradientFrom="from-purple-50"
          gradientTo="to-purple-100"
          borderColor="border-purple-200"
          textColor="text-purple-800"
          valueColor="text-purple-900"
        />
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="all" onClick={() => clearFilters()}>
              All
            </TabsTrigger>
            <TabsTrigger
              value="active"
              onClick={() => {
                clearFilters();
                setFilters(prev => ({ ...prev, status: "Present" }));
                setActiveTab("active");
              }}
            >
              Present
            </TabsTrigger>
            <TabsTrigger
              value="assigned"
              onClick={() => {
                clearFilters();
                setActiveTab("assigned");
              }}
            >
              Assigned
            </TabsTrigger>
            <TabsTrigger
              value="unassigned"
              onClick={() => {
                clearFilters();
                setActiveTab("unassigned");
              }}
            >
              Unassigned
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`${showFilters ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" : ""} h-9`}
            >
              <IconFilter className="h-4 w-4 mr-2" />
              Filters
            </Button>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <IconDownload className="h-4 w-4 mr-2" />
              Export Excel
            </Button>

            {hasPermission("user:import_logs") && (
              <Button
                variant="outline"
                onClick={() => {
                  navigate(`import-logs`);
                }}
                className="bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200"
              >
                <IconHistory className="h-4 w-4 mr-2" />
                Import Logs
              </Button>
            )}

            {hasPermission("user:import_excel") && (
              <Button
                variant="outline"
                onClick={handleImportClick}
                className="bg-green-600 hover:bg-green-700 text-white shadow-sm border-green-700"
              >
                <IconUpload className="h-4 w-4 mr-2" />
                Import Operators
              </Button>
            )}

            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Add Operator
            </Button>
          </div>
        </div>
      </Tabs>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date From</label>
              <div className="relative">
                <IconCalendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Date To</label>
              <div className="relative">
                <IconCalendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Department</label>
              <Select
                value={filters.departmentId || "all"}
                onValueChange={(val) => setFilters({ 
                  ...filters, 
                  departmentId: val === "all" ? "" : val,
                  sectionId: "", lineId: "", subSectionId: "", stationId: ""
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {availableDepartments.map(d => (
                    <SelectItem key={d._id || d.id} value={String(d._id || d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Section</label>
              <Select
                value={filters.sectionId || "all"}
                onValueChange={(val) => setFilters({ 
                  ...filters, 
                  sectionId: val === "all" ? "" : val,
                  lineId: "", subSectionId: "", stationId: ""
                })}
                disabled={!filters.departmentId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {filterSections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Line</label>
              <Select
                value={filters.lineId || "all"}
                onValueChange={(val) => setFilters({ 
                  ...filters, 
                  lineId: val === "all" ? "" : val,
                  subSectionId: "", stationId: ""
                })}
                disabled={!filters.sectionId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Lines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lines</SelectItem>
                  {filterLines.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sub-Section</label>
              <Select
                value={filters.subSectionId || "all"}
                onValueChange={(val) => setFilters({ 
                  ...filters, 
                  subSectionId: val === "all" ? "" : val,
                  stationId: ""
                })}
                disabled={!filters.lineId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Sub-Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sub-Sections</SelectItem>
                  {filterSubSections.map(ss => <SelectItem key={ss.id} value={String(ss.id)}>{ss.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Station</label>
              <Select
                value={filters.stationId || "all"}
                onValueChange={(val) => setFilters({ ...filters, stationId: val === "all" ? "" : val })}
                disabled={!filters.subSectionId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Stations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stations</SelectItem>
                  {filterStations.map(st => <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Shift</label>
              <Select
                value={filters.shift || "all"}
                onValueChange={(val) => setFilters({ ...filters, shift: val === "all" ? "" : val })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="A">A-Shift</SelectItem>
                  <SelectItem value="B">B-Shift</SelectItem>
                  <SelectItem value="G">G-Shift</SelectItem>
                  <SelectItem value="C">C-Shift</SelectItem>
                  <SelectItem value="D">D-Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Unit</label>
              <Select
                value={filters.unit || "all"}
                onValueChange={(val) => setFilters({ ...filters, unit: val === "all" ? "" : val })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Units" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  <SelectItem value="UNIT_1">Unit 1</SelectItem>
                  <SelectItem value="UNIT_2">Unit 2</SelectItem>
                  <SelectItem value="UNIT_3">Unit 3</SelectItem>
                  <SelectItem value="UNIT_4">Unit 4</SelectItem>
                  <SelectItem value="UNIT_5">Unit 5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(val) => setFilters({ ...filters, status: val === "all" ? "" : val })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Present">Present (Attendance)</SelectItem>
                  <SelectItem value="Absent">Absent (Attendance)</SelectItem>
                  <SelectItem value="PRESENT">System: Present</SelectItem>
                  <SelectItem value="ON_LEAVE">System: On Leave</SelectItem>
                  <SelectItem value="LEFT">System: Left</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end sm:col-span-2 md:col-span-4 lg:col-span-5 justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 w-fit"
                onClick={() => setFilters({
                  status: "", dateFrom: "", dateTo: "",
                  departmentId: "", sectionId: "", lineId: "", subSectionId: "", stationId: "",
                  unit: "", shift: "", date: ""
                })}
              >
                <IconX className="w-4 h-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <SearchInput
              placeholder="Search operators by name, email, or username..."
              value={searchTerm}
              onChange={setSearchTerm}
              className="w-full sm:w-96"
            />

            {activeFilters.length > 0 && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="gap-1 h-9"
              >
                <IconX className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>

          {/* Filter bar showing active filters */}
          <FilterBar
            filters={activeFilters}
            onClearFilters={clearFilters}
            className="mt-3"
          />

          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col gap-2 mt-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-blue-800 text-sm font-medium">
                  <IconUsers className="h-4 w-4" />
                  <span>
                    {isAllSelectedAcrossPages
                      ? `All ${studentsData?.data?.totalUsers || "matching"} operators selected`
                      : `${selectedIds.length} Operators Selected`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedIds([]);
                      setIsAllSelectedAcrossPages(false);
                    }}
                    className="bg-white hover:bg-gray-50 text-gray-700"
                  >
                    Clear Selection
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsBulkDeleteDialogOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <IconTrash className="h-4 w-4 mr-2" />
                    Bulk Delete Permanently
                  </Button>
                </div>
              </div>

              {/* Select All Across Pages Banner */}
              {!isAllSelectedAcrossPages &&
                selectedIds.length === students.length &&
                studentsData?.data?.totalUsers > students.length && (
                  <div className="p-2 bg-blue-100/50 border border-blue-200 rounded text-center text-sm text-blue-800 animate-in fade-in slide-in-from-top-1">
                    All {students.length} operators on this page are selected.{" "}
                    <button
                      onClick={() => setIsAllSelectedAcrossPages(true)}
                      className="font-bold underline hover:text-blue-900"
                    >
                      Select all {studentsData?.data?.totalUsers} operators matching these filters
                    </button>
                  </div>
                )}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={students.length > 0 && selectedIds.length === students.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[180px]">Operator</TableHead>
                <TableHead className="w-[100px]">Emp Code</TableHead>
                <TableHead className="w-[100px]">Primary Level</TableHead>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Joining / Leaving</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <TableRow
                    key={student._id}
                    className="group hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleStudentClick(student)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(student._id)}
                        onCheckedChange={() => toggleSelectId(student._id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10 border">
                          <AvatarImage
                            src={getMediaUrl(student.avatar?.url)}
                            alt={student.fullName}
                          />
                          <AvatarFallback className="bg-blue-100 text-blue-800">
                            {student.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">
                              {student.fullName}
                            </p>
                            <IconExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            @{student.userName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 w-fit text-[11px]">
                        {student.empId || "---"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="font-bold text-xs bg-indigo-50 text-indigo-700 border-indigo-200 w-fit">
                          {student.primaryLevel || "L1"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={student.primaryStationName}>
                          {student.primaryStationName || "No Station"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                      {safeDateFormat(student.logDate, "dd MMM yyyy") || "-"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-foreground">{student.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {student.phoneNumber}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={normalizeStatus(student.status) || ""}
                        onValueChange={(newStatus) =>
                          handleQuickStatusChange(
                            student._id,
                            newStatus,
                            student.status
                          )
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          {getStatusBadge(student.status)}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRESENT">Present</SelectItem>
                          <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                          <SelectItem value="LEFT">Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDepartmentInfo(student)}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Stop event propagation
                                  openDepartmentDialog(student);
                                }}
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <IconPencil className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Assign to department</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {student.status === "LEFT" ? (
                          student.leavingDate ? (
                            <>
                              <span className="text-sm text-red-600 font-medium">
                                {safeDateFormat(student.leavingDate, "dd/MM/yyyy")}
                              </span>
                              <span className="text-xs text-red-400">
                                Left
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">Left (Date not set)</span>
                          )
                        ) : student.joiningDate ? (
                          <>
                            <span className="text-sm">
                              {safeDateFormat(student.joiningDate, "dd/MM/yyyy")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Joined
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not set</span>
                        )}

                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Stop event propagation
                                  openEditDialog(student);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <IconPencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit operator</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation(); // Stop event propagation
                                  openDeleteDialog(student);
                                }}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete operator</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex flex-col items-center space-y-3">
                      <IconUsers className="h-12 w-12 text-muted-foreground/60" />
                      <p className="text-muted-foreground font-medium">
                        No trainee found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ||
                          statusFilter !== "ALL" ||
                          departmentFilter !== "ALL"
                          ? "Try adjusting your search or filters"
                          : "Add your first operator to get started"}
                      </p>
                      {(searchTerm ||
                        statusFilter !== "ALL" ||
                        departmentFilter !== "ALL") && (
                          <Button
                            variant="outline"
                            onClick={clearFilters}
                            className="mt-2"
                          >
                            Clear filters
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredStudents.length} of{" "}
            {studentsData?.data?.totalUsers || 0} employees
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Previous
            </Button>
            <div className="flex items-center justify-center px-4 text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Import Employees Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUpload className="h-5 w-5" />
              Import Employees
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file to add employees in bulk.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                <h4 className="font-medium text-blue-900 flex items-center gap-2">
                  <IconInfoCircle className="h-4 w-4" />
                  Format Instructions
                </h4>
                <p className="text-sm text-blue-800">
                  Your Excel file must contain the following columns:
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-blue-700 font-mono">
                  <span>- fullName *</span>
                  <span>- userName *</span>
                  <span>- email *</span>
                  <span>- phoneNumber *</span>
                  <span>- empId</span>
                  <span>- unit (UNIT_1)</span>
                  <span>- joiningDate</span>
                  <span>- currentLevel</span>
                  <span>- supervisor</span>
                  <span>- incharge</span>
                  <span>- idCard</span>
                  <span>- fatherHusbandName</span>
                  <span>- gender</span>
                  <span>- dob (YYYY-MM-DD)</span>
                  <span>- designation</span>
                  <span>- mentor</span>
                  <span>- education</span>
                  <span>- district</span>
                  <span>- state</span>
                  <span>- pin</span>
                  <span>- busRoute</span>
                </div>
                <p className="text-xs text-blue-600 italic">
                  * Required fields
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="font-medium text-sm">Step 1: Download Template</h4>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="w-full justify-start gap-2 bg-slate-50"
                >
                  <IconDownload className="h-4 w-4 text-slate-600" />
                  Download Excel Template with Dummy Data
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <h4 className="font-medium text-sm">Step 2: Upload Filled File</h4>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.xls"
                  className="hidden"
                />
                <Button
                  onClick={handleFileSelect}
                  className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                >
                  <IconUpload className="h-4 w-4" />
                  Select Excel File to Upload
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Supports .xlsx and .xls files
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} className="max-w-[1000px]">
        <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <IconUserPlus className="h-6 w-6 text-blue-600" />
              Add New Operator
            </DialogTitle>
            <DialogDescription>
              Enter the operator's details. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
            {/* Operator ID & Card No */}
            <div className="grid gap-2">
              <Label htmlFor="empId">Employee Code *</Label>
              <Input
                id="empId"
                name="empId"
                value={formData.empId}
                onChange={handleInputChange}
                placeholder="EMP123"
                className={formErrors.empId ? "border-red-500" : ""}
              />
              {formErrors.empId && <p className="text-xs text-red-600">{formErrors.empId}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="idCard">Card No</Label>
              <Input
                id="idCard"
                name="idCard"
                value={formData.idCard}
                onChange={handleInputChange}
                placeholder="CARD123"
              />
            </div>

            {/* Name & Father/Husband Name */}
            <div className="grid gap-2">
              <Label htmlFor="fullName">Name *</Label>
              <Input
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Full Name"
                className={formErrors.fullName ? "border-red-500" : ""}
              />
              {formErrors.fullName && <p className="text-xs text-red-600">{formErrors.fullName}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fatherHusbandName">Father / Husband Name</Label>
              <Input
                id="fatherHusbandName"
                name="fatherHusbandName"
                value={formData.fatherHusbandName}
                onChange={handleInputChange}
                placeholder="Name"
              />
            </div>

            {/* Gender & Designation */}
            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
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
              <Label htmlFor="designation">Designation</Label>
              <Input
                id="designation"
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                placeholder="Operator / Senior Operator"
              />
            </div>

            {/* DOB & DOJ */}
            <div className="grid gap-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="joiningDate">Date of Joining</Label>
              <Input
                id="joiningDate"
                name="joiningDate"
                type="date"
                value={formData.joiningDate}
                onChange={handleInputChange}
              />
            </div>

            {/* Hierarchy Dropdowns */}
            <div className="grid gap-2">
              <FormSelect
                id="departments"
                label="Departments"
                multiple={true}
                value={formData.departments}
                onValueChange={(values) => setFormData({
                  ...formData,
                  departments: values,
                  sections: [],
                  lines: [],
                  subSections: [],
                  stations: []
                })}
                options={availableDepartments.map(d => ({ value: String(d._id || d.id), label: d.name }))}
                placeholder="Select Departments"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="sections"
                label="Sections"
                multiple={true}
                disabled={formData.departments.length === 0}
                value={formData.sections}
                onValueChange={(values) => setFormData({
                  ...formData,
                  sections: values,
                  lines: [],
                  subSections: [],
                  stations: []
                })}
                options={sections.map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select Sections"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="lines"
                label="Lines"
                multiple={true}
                disabled={formData.sections.length === 0}
                value={formData.lines}
                onValueChange={(values) => setFormData({
                  ...formData,
                  lines: values,
                  subSections: [],
                  stations: []
                })}
                options={lines.map(l => ({ value: String(l.id), label: l.name }))}
                placeholder="Select Lines"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="subSections"
                label="Sub-sections"
                multiple={true}
                disabled={formData.lines.length === 0}
                value={formData.subSections}
                onValueChange={(values) => setFormData({
                  ...formData,
                  subSections: values,
                  stations: []
                })}
                options={subSections.map(ss => ({ value: String(ss.id), label: ss.name }))}
                placeholder="Select Sub-sections"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="stations"
                label="Stations"
                multiple={true}
                disabled={formData.subSections.length === 0}
                value={formData.stations}
                onValueChange={(values) => setFormData({
                  ...formData,
                  stations: values
                })}
                options={machines.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Select Stations"
              />
            </div>

            {/* Mentor & Education */}
            <div className="grid gap-2">
              <Label htmlFor="mentor">Mentor (Department Trainer)</Label>
              <Input
                id="mentor"
                name="mentor"
                value={formData.mentor}
                onChange={handleInputChange}
                placeholder="Mentor Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="education">Education</Label>
              <Input
                id="education"
                name="education"
                value={formData.education}
                onChange={handleInputChange}
                placeholder="Qualification"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Input
                id="supervisor"
                name="supervisor"
                value={formData.supervisor}
                onChange={handleInputChange}
                placeholder="Supervisor Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="incharge">Incharge</Label>
              <Input
                id="incharge"
                name="incharge"
                value={formData.incharge}
                onChange={handleInputChange}
                placeholder="Incharge Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contractorId">Contractor</Label>
              <Select
                value={formData.contractorId || "none"}
                onValueChange={(val) => setFormData({ ...formData, contractorId: val === "none" ? "" : val })}
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

            {/* Contact Details */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com"
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && <p className="text-xs text-red-600">{formErrors.email}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phoneNumber">Mobile No *</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="10 digit number"
                className={formErrors.phoneNumber ? "border-red-500" : ""}
              />
              {formErrors.phoneNumber && <p className="text-xs text-red-600">{formErrors.phoneNumber}</p>}
            </div>

            {/* Address Details */}
            <div className="grid gap-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                placeholder="District"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="State"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                name="pin"
                value={formData.pin}
                onChange={handleInputChange}
                placeholder="PIN Code"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="busRoute">Bus Route</Label>
              <Input
                id="busRoute"
                name="busRoute"
                value={formData.busRoute}
                onChange={handleInputChange}
                placeholder="Route Name"
              />
            </div>

            {/* Level & Status */}
            <div className="grid gap-2">
              <Label htmlFor="currentLevel">Level</Label>
              <Select
                value={formData.currentLevel}
                onValueChange={(value) => setFormData({ ...formData, currentLevel: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  {courseLevels.length > 0 ? (
                    courseLevels.map((level) => (
                      <SelectItem key={level.name} value={level.name}>
                        {level.name} {level.order === 0 ? "(Lowest)" : level.order === courseLevels.length - 1 ? "(Highest)" : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="L1">L1 (Lowest)</SelectItem>
                      <SelectItem value="L2">L2</SelectItem>
                      <SelectItem value="L3">L3</SelectItem>
                      <SelectItem value="L4">L4 (Highest)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="LEFT">Inactive (Left)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Leaving Details */}
            {formData.status === "LEFT" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="leavingDate">Date of Leaving</Label>
                  <Input
                    id="leavingDate"
                    name="leavingDate"
                    type="date"
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
                    placeholder="Reason"
                  />
                </div>
              </>
            )}

            {/* Password & Custom Role */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password (Auto-fills from Emp Code)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                readOnly
                className="bg-gray-50 cursor-not-allowed"
              />
              <p className="text-[10px] text-muted-foreground italic">Password is same as Employee Code for initial setup.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customRoleId">Custom Access Role</Label>
              <Select
                value={formData.customRoleId || "none"}
                onValueChange={(value) => setFormData({ ...formData, customRoleId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Standard Operator)</SelectItem>
                  {customRoles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-white pt-4 pb-2 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting && <IconLoader className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Registering..." : "Register Operator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} className="max-w-[1000px]">
        <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <IconPencil className="h-6 w-6 text-blue-600" />
              Edit Operator
            </DialogTitle>
            <DialogDescription>
              Update operator information. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
            {/* Operator ID & Card No */}
            <div className="grid gap-2">
              <Label htmlFor="edit-empId">Employee Code *</Label>
              <Input
                id="edit-empId"
                name="empId"
                value={formData.empId}
                onChange={handleInputChange}
                placeholder="EMP123"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-idCard">Card No</Label>
              <Input
                id="edit-idCard"
                name="idCard"
                value={formData.idCard}
                onChange={handleInputChange}
                placeholder="CARD123"
              />
            </div>

            {/* Name & Father/Husband Name */}
            <div className="grid gap-2">
              <Label htmlFor="edit-fullName">Name *</Label>
              <Input
                id="edit-fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Full Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-fatherHusbandName">Father / Husband Name</Label>
              <Input
                id="edit-fatherHusbandName"
                name="fatherHusbandName"
                value={formData.fatherHusbandName}
                onChange={handleInputChange}
                placeholder="Name"
              />
            </div>

            {/* Gender & Designation */}
            <div className="grid gap-2">
              <Label htmlFor="edit-gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
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
              <Label htmlFor="edit-designation">Designation</Label>
              <Input
                id="edit-designation"
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                placeholder="Operator / Senior Operator"
              />
            </div>

            {/* DOB & DOJ */}
            <div className="grid gap-2">
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <Input
                id="edit-dob"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-joiningDate">Date of Joining</Label>
              <Input
                id="edit-joiningDate"
                name="joiningDate"
                type="date"
                value={formData.joiningDate}
                onChange={handleInputChange}
              />
            </div>

            {/* Hierarchy Dropdowns */}
            <div className="grid gap-2">
              <FormSelect
                id="edit-departments"
                label="Departments"
                multiple={true}
                value={formData.departments}
                onValueChange={(values) => setFormData({
                  ...formData,
                  departments: values,
                  sections: [],
                  lines: [],
                  subSections: [],
                  stations: []
                })}
                options={availableDepartments.map(d => ({ value: String(d._id || d.id), label: d.name }))}
                placeholder="Select Departments"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="edit-sections"
                label="Sections"
                multiple={true}
                disabled={formData.departments.length === 0}
                value={formData.sections}
                onValueChange={(values) => setFormData({
                  ...formData,
                  sections: values,
                  lines: [],
                  subSections: [],
                  stations: []
                })}
                options={sections.map(s => ({ value: String(s.id), label: s.name }))}
                placeholder="Select Sections"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="edit-lines"
                label="Lines"
                multiple={true}
                disabled={formData.sections.length === 0}
                value={formData.lines}
                onValueChange={(values) => setFormData({
                  ...formData,
                  lines: values,
                  subSections: [],
                  stations: []
                })}
                options={lines.map(l => ({ value: String(l.id), label: l.name }))}
                placeholder="Select Lines"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="edit-subSections"
                label="Sub-sections"
                multiple={true}
                disabled={formData.lines.length === 0}
                value={formData.subSections}
                onValueChange={(values) => setFormData({
                  ...formData,
                  subSections: values,
                  stations: []
                })}
                options={subSections.map(ss => ({ value: String(ss.id), label: ss.name }))}
                placeholder="Select Sub-sections"
              />
            </div>

            <div className="grid gap-2">
              <FormSelect
                id="edit-stations"
                label="Stations"
                multiple={true}
                disabled={formData.subSections.length === 0}
                value={formData.stations}
                onValueChange={(values) => setFormData({
                  ...formData,
                  stations: values
                })}
                options={machines.map(m => ({ value: String(m.id), label: m.name }))}
                placeholder="Select Stations"
              />
            </div>

            {/* Mentor & Education */}
            <div className="grid gap-2">
              <Label htmlFor="edit-mentor">Mentor (Department Trainer)</Label>
              <Input
                id="edit-mentor"
                name="mentor"
                value={formData.mentor}
                onChange={handleInputChange}
                placeholder="Mentor Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-education">Education</Label>
              <Input
                id="edit-education"
                name="education"
                value={formData.education}
                onChange={handleInputChange}
                placeholder="Qualification"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-supervisor">Supervisor</Label>
              <Input
                id="edit-supervisor"
                name="supervisor"
                value={formData.supervisor}
                onChange={handleInputChange}
                placeholder="Supervisor Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-incharge">Incharge</Label>
              <Input
                id="edit-incharge"
                name="incharge"
                value={formData.incharge}
                onChange={handleInputChange}
                placeholder="Incharge Name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-contractorId">Contractor</Label>
              <Select
                value={formData.contractorId || "none"}
                onValueChange={(val) => setFormData({ ...formData, contractorId: val === "none" ? "" : val })}
              >
                <SelectTrigger id="edit-contractorId">
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

            {/* Contact Details */}
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-phoneNumber">Mobile No *</Label>
              <Input
                id="edit-phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="10 digit number"
              />
            </div>

            {/* Address Details */}
            <div className="grid gap-2">
              <Label htmlFor="edit-district">District</Label>
              <Input
                id="edit-district"
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                placeholder="District"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-state">State</Label>
              <Input
                id="edit-state"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                placeholder="State"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-pin">PIN</Label>
              <Input
                id="edit-pin"
                name="pin"
                value={formData.pin}
                onChange={handleInputChange}
                placeholder="PIN Code"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-busRoute">Bus Route</Label>
              <Input
                id="edit-busRoute"
                name="busRoute"
                value={formData.busRoute}
                onChange={handleInputChange}
                placeholder="Route Name"
              />
            </div>

            {/* Level & Status */}
            <div className="grid gap-2">
              <Label htmlFor="edit-currentLevel">Level</Label>
              <Select
                value={formData.currentLevel}
                onValueChange={(value) => setFormData({ ...formData, currentLevel: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  {courseLevels.length > 0 ? (
                    courseLevels.map((level) => (
                      <SelectItem key={level.name} value={level.name}>
                        {level.name} {level.order === 0 ? "(Lowest)" : level.order === courseLevels.length - 1 ? "(Highest)" : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="L1">L1 (Lowest)</SelectItem>
                      <SelectItem value="L2">L2</SelectItem>
                      <SelectItem value="L3">L3</SelectItem>
                      <SelectItem value="L4">L4 (Highest)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                  <SelectItem value="LEFT">Inactive (Left)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Leaving Details */}
            {formData.status === "LEFT" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-leavingDate">Date of Leaving</Label>
                  <Input
                    id="edit-leavingDate"
                    name="leavingDate"
                    type="date"
                    value={formData.leavingDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-reasonOfLeaving">Reason of Leaving</Label>
                  <Input
                    id="edit-reasonOfLeaving"
                    name="reasonOfLeaving"
                    value={formData.reasonOfLeaving}
                    onChange={handleInputChange}
                    placeholder="Reason"
                  />
                </div>
              </>
            )}

            {/* Custom Role */}
            <div className="grid gap-2">
              <Label htmlFor="edit-customRoleId">Custom Access Role</Label>
              <Select
                value={formData.customRoleId || "none"}
                onValueChange={(value) => setFormData({ ...formData, customRoleId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Standard Operator)</SelectItem>
                  {customRoles.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-white pt-4 pb-2 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
                setSelectedStudent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditStudent}
              disabled={isSubmitting}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {isSubmitting && <IconLoader className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Updating..." : "Update Operator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>

        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <IconTrash className="h-5 w-5" />
              Delete Employee
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              student account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <IconInfoCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">
                Are you sure you want to delete{" "}
                <strong>{selectedStudent?.fullName}</strong>?
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedStudent(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStudent}
              className="gap-2"
            >
              <IconTrash className="h-4 w-4" />
              Delete Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Assignment Dialog */}
      <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconSchool className="h-5 w-5" />
              Assign to Section
            </DialogTitle>
            <DialogDescription>
              Select a section for <strong>{selectedStudent?.fullName}</strong>
              {selectedStudent?.department && (
                <span className="text-amber-600 font-medium">
                  {" "}
                  (Currently assigned to:{" "}
                  {selectedStudent.department.name || "Unknown Department"})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {departmentsLoading ? (
                <div className="flex justify-center py-8">
                  <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : departmentsError ? (
                <div className="text-center py-8">
                  <p className="text-red-500">Error loading departments</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please try again later
                  </p>
                </div>
              ) : departments.length > 0 ? (
                departments.map((department) => {
                  const rawStudentDepts = typeof selectedStudent?.departments === 'string'
                    ? JSON.parse(selectedStudent.departments || "[]")
                    : (selectedStudent?.departments || []);
                  const isCurrentlyAssigned =
                    (selectedStudent?.department?._id?.toString() === department._id.toString()) ||
                    (Array.isArray(rawStudentDepts) && rawStudentDepts.map(String).includes(department._id.toString()));
                  const isAtCapacity =
                    department.capacity && department.students?.length >= department.capacity;

                  return (
                    <div
                      key={department._id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isCurrentlyAssigned
                        ? "bg-green-50 border-green-200 cursor-default"
                        : isAtCapacity
                          ? "bg-red-50 border-red-200 cursor-not-allowed opacity-60"
                          : "hover:bg-muted/50 cursor-pointer"
                        }`}
                      onClick={() => {
                        if (!isCurrentlyAssigned && !isAtCapacity) {
                          handleAssignToDepartment(department._id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${isCurrentlyAssigned
                            ? "bg-green-100"
                            : isAtCapacity
                              ? "bg-red-100"
                              : "bg-blue-100"
                            }`}
                        >
                          <IconSchool
                            className={`h-4 w-4 ${isCurrentlyAssigned
                              ? "text-green-600"
                              : isAtCapacity
                                ? "text-red-600"
                                : "text-blue-600"
                              }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{department.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {department.students?.length || 0} employees
                            {department.capacity && ` / ${department.capacity} capacity`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentlyAssigned && (
                          <Badge variant="success" className="ml-2">
                            Current
                          </Badge>
                        )}
                        {isAtCapacity && (
                          <Badge variant="destructive" className="ml-2">
                            Full
                          </Badge>
                        )}
                        {!isCurrentlyAssigned && !isAtCapacity && (
                          <Badge variant="outline" className="ml-2">
                            Available
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <IconSchool className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No departments available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a department first to assign employees
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDepartmentDialogOpen(false);
                setSelectedStudent(null);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen} className="max-w-[500px]">
        <DialogContent className="max-w-[500px] w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <IconAlertTriangle className="h-6 w-6" />
              Confirm Bulk Deletion
            </DialogTitle>
            <DialogDescription className="text-gray-700 pt-2">
              Are you sure you want to permanently delete **{isAllSelectedAcrossPages ? (studentsData?.data?.totalUsers || "all matching") : selectedIds.length}** selected operators?
              <br /><br />
              <span className="font-semibold text-red-600 italic text-xs">
                * This action will permanently remove these users from the database and cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? "Deleting..." : `Yes, Delete Permanently`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
      </TabsContent>

      <TabsContent value="operatorLevels">
        <StudentLevelManager />
      </TabsContent>
    </Tabs>
  );
};

export default Students;
