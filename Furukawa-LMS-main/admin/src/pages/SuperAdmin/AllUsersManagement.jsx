import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  IconUsers,
  IconPlus,
  IconSearch,
  IconFilter,
  IconDownload,
  IconEdit,
  IconTrash,
  IconEye,
  IconMail,
  IconUserCheck,
  IconUserX,
  IconUserMinus,
  IconShield,
  IconRefresh,
  IconChevronDown,
  IconSortAscending,
  IconSortDescending,
  IconX,
  IconAlertTriangle,
  IconInfoCircle,
  IconPlayerPlay,
  IconGauge
} from "@tabler/icons-react";
import {
  useGetAllUsersQuery as useSuperAdminGetAllUsersQuery,
  useCreateUserMutation as useSuperAdminCreateUserMutation,
  useUpdateUserMutation as useSuperAdminUpdateUserMutation,
  usePermanentDeleteUserMutation
} from "@/Redux/AllApi/SuperAdminApi";
import { useGetUniqueDesignationsQuery, useBulkUpdateShiftScheduleMutation } from "@/Redux/AllApi/UserApi";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesBySubSectionQuery } from "@/Redux/AllApi/MachineApi";
import { IconCalendar } from "@tabler/icons-react";
import { format } from "date-fns";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { FormSelect } from "@/components/form/FormSelect";
import ShiftScheduler from "@/components/admin/ShiftScheduler";

// shadcn/ui components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

const AllUsersManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftUser, setShiftUser] = useState(null);
  const [shiftScheduleDraft, setShiftScheduleDraft] = useState({});
  const [showBulkShiftModal, setShowBulkShiftModal] = useState(false);
  const [bulkShiftScheduleDraft, setBulkShiftScheduleDraft] = useState({});
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const [filters, setFilters] = useState({
    role: "",
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
    date: format(new Date(), "yyyy-MM-dd"), // Default to today
    designation: "",
  });

  const [customRoles, setCustomRoles] = useState([]);

  const [newUser, setNewUser] = useState({
    fullName: "",
    userName: "",
    email: "",
    phoneNumber: "",
    role: "STUDENT",
    password: "",
    status: "ACTIVE",
    unit: "UNIT_1",
    customRoleId: "",
    departments: (currentUser?.role !== "SUPERADMIN" && (currentUser?.departmentId || currentUser?.department?._id)) ? [String(currentUser?.departmentId || currentUser?.department?._id)] : [],
    sections: [],
    lines: [],
    subSections: [],
    stations: [],
  });

  // API hooks
  const { data: designationsData } = useGetUniqueDesignationsQuery();
  const uniqueDesignations = designationsData?.data || [];

  const {
    data: usersData,
    isLoading,
    isError,
    error,
    refetch
  } = useSuperAdminGetAllUsersQuery({
    page: currentPage,
    limit: 20,
    sortBy,
    order: sortOrder,
    search: searchTerm,
    role: filters.role,
    status: filters.status,
    includeLeft: "true",
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    departmentId: filters.departmentId,
    sectionId: filters.sectionId,
    lineId: filters.lineId,
    subSectionId: filters.subSectionId,
    stationId: filters.stationId,
    unit: filters.unit,
    shift: filters.shift,
    date: filters.date,
    designation: filters.designation,
  });

  // Hierarchy Data Hooks
  const { data: deptData } = useGetAllDepartmentsQuery();
  const { data: sectionData } = useGetSectionsByDepartmentQuery(filters.departmentId, { skip: !filters.departmentId });
  const { data: lineData } = useGetLinesBySectionQuery(filters.sectionId, { skip: !filters.sectionId });
  const { data: subSectionData } = useGetSubSectionsByLineQuery(filters.lineId, { skip: !filters.lineId });
  const { data: machineData } = useGetMachinesBySubSectionQuery(filters.subSectionId, { skip: !filters.subSectionId });

  // Helper to get ID from a department object (handles both id and _id formats)
  const getDeptId = (d) => d?.id || d?._id;

  // Filter departments based on current user's access
  const departments = useMemo(() => {
    const allDepartments = deptData?.data?.departments || [];
    if (!allDepartments.length) return [];

    // SuperAdmin or Global Admin sees all departments
    if (currentUser?.role === 'SUPERADMIN' || currentUser?.isAdmin === true) {
      return allDepartments;
    }

    // Helper to get ID from a department object (handles both id and _id formats)
    const getDeptId = (d) => d?.id || d?._id;

    // 1. Check if they have multiple assigned departments (Primary restriction logic)
    if (Array.isArray(currentUser?.departments) && currentUser.departments.length > 0) {
      const allowedDeptIds = currentUser.departments.map(d => String(d));
      const filtered = allDepartments.filter(dept => {
        const dId = String(getDeptId(dept));
        return allowedDeptIds.includes(dId);
      });
      if (filtered.length > 0) return filtered;
    }

    // 2. Try to find the specific department the user is assigned to
    if ((currentUser?.deptName && currentUser.deptName.trim() !== "") || currentUser?.departmentId || currentUser?.department?._id) {
      const userDept = allDepartments.find(dept => {
        const dId = String(getDeptId(dept));
        return (
          (currentUser?.departmentId && dId === String(currentUser.departmentId)) ||
          (currentUser?.department?._id && dId === String(currentUser.department._id)) ||
          (currentUser?.deptName && dept.name?.trim().toLowerCase() === currentUser.deptName.trim().toLowerCase())
        );
      });
      if (userDept) return [userDept];
    }

    // 2. If no single primary match, check if they have multiple assigned departments
    if (Array.isArray(currentUser?.departments) && currentUser.departments.length > 0) {
      const allowedDeptIds = currentUser.departments.map(d => String(d));
      const filtered = allDepartments.filter(dept => {
        const dId = String(getDeptId(dept));
        return allowedDeptIds.includes(dId);
      });
      if (filtered.length > 0) return filtered;
    }

    // 3. Fallback: show only departments that have users in the current view
    // (This acts as a fallback for users who manage multiple departments indirectly)
    const usersList = usersData?.data?.users || [];
    const deptIdsWithUsers = new Set();

    usersList.forEach(user => {
      if (user.deptName || user.departmentId || user.department?._id) {
        const matchingDept = allDepartments.find(dept => {
          const dId = String(getDeptId(dept));
          return (
            (user.departmentId && dId === String(user.departmentId)) ||
            (user.department?._id && dId === String(user.department._id)) ||
            (user.deptName && dept.name?.trim().toLowerCase() === user.deptName.trim().toLowerCase())
          );
        });
        if (matchingDept) {
          deptIdsWithUsers.add(String(getDeptId(matchingDept)));
        }
      }
    });

    if (deptIdsWithUsers.size > 0) {
      return allDepartments.filter(dept => deptIdsWithUsers.has(String(getDeptId(dept))));
    }

    // Final safety fallback
    return allDepartments;
  }, [deptData?.data?.departments, usersData?.data?.users, currentUser?.deptName, currentUser?.departments, currentUser?.departmentId, currentUser?.department, currentUser?.role]);

  const sections = sectionData?.data || [];
  const lines = lineData?.data || [];
  const subSections = subSectionData?.data || [];
  const stations = machineData?.data || [];

  // Edit User Hierarchy Hooks
  const { data: editSectionData } = useGetSectionsByDepartmentQuery(
    (selectedUser?.departments || []).join(","),
    { skip: !selectedUser?.departments?.length || !showEditModal }
  );
  const { data: editLineData } = useGetLinesBySectionQuery(
    (selectedUser?.sections || []).join(","),
    { skip: !selectedUser?.sections?.length || !showEditModal }
  );
  const { data: editSubSectionData } = useGetSubSectionsByLineQuery(
    (selectedUser?.lines || []).join(","),
    { skip: !selectedUser?.lines?.length || !showEditModal }
  );
  const { data: editMachineData } = useGetMachinesBySubSectionQuery(
    (selectedUser?.subSections || []).join(","),
    { skip: !selectedUser?.subSections?.length || !showEditModal }
  );

  const editSections = editSectionData?.data || [];
  const editLines = editLineData?.data || [];
  const editSubSections = editSubSectionData?.data || [];
  const editStations = editMachineData?.data || [];

  // Create User Hierarchy Hooks
  const { data: createSectionData } = useGetSectionsByDepartmentQuery(
    (newUser?.departments || []).join(","),
    { skip: !newUser?.departments?.length || !showCreateModal }
  );
  const { data: createLineData } = useGetLinesBySectionQuery(
    (newUser?.sections || []).join(","),
    { skip: !newUser?.sections?.length || !showCreateModal }
  );
  const { data: createSubSectionData } = useGetSubSectionsByLineQuery(
    (newUser?.lines || []).join(","),
    { skip: !newUser?.lines?.length || !showCreateModal }
  );
  const { data: createMachineData } = useGetMachinesBySubSectionQuery(
    (newUser?.subSections || []).join(","),
    { skip: !newUser?.subSections?.length || !showCreateModal }
  );

  const createSections = createSectionData?.data || [];
  const createLines = createLineData?.data || [];
  const createSubSections = createSubSectionData?.data || [];
  const createStations = createMachineData?.data || [];

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

  // Initialize filters based on user role and departments
  useEffect(() => {
    const allDepartments = deptData?.data?.departments || [];
    if (currentUser?.role !== 'SUPERADMIN' && currentUser?.isAdmin !== true && !filters.departmentId && allDepartments.length > 0) {
      // Find the best match for the user's assigned department
      const match = allDepartments.find(dept => {
        const dId = String(getDeptId(dept));
        return (
          (currentUser?.departmentId && dId === String(currentUser.departmentId)) ||
          (currentUser?.department?._id && dId === String(currentUser.department._id)) ||
          (currentUser?.deptName && dept.name?.trim().toLowerCase() === currentUser.deptName.trim().toLowerCase())
        );
      });

      if (match) {
        setFilters(prev => ({ ...prev, departmentId: String(getDeptId(match)) }));
      } else if (allDepartments.length > 0 && Array.isArray(currentUser?.departments) && currentUser.departments.length > 0) {
        // Fallback to first assigned department if primary match fails but departments array exists
        const firstAssignedId = String(currentUser.departments[0]);
        const exists = allDepartments.find(d => String(getDeptId(d)) === firstAssignedId);
        if (exists) {
           setFilters(prev => ({ ...prev, departmentId: firstAssignedId }));
        }
      }
    }
  }, [deptData, currentUser, filters.departmentId]);

  // Refetch when filters change
  useEffect(() => {
    refetch();
  }, [searchTerm, filters, currentPage, sortBy, sortOrder, refetch]);

  const [createUser] = useSuperAdminCreateUserMutation();
  const [updateUser] = useSuperAdminUpdateUserMutation();
  const [deleteUser] = usePermanentDeleteUserMutation();
  const [bulkUpdateShiftSchedule] = useBulkUpdateShiftScheduleMutation();

  const users = usersData?.data?.users || [];
  const totalPages = usersData?.data?.totalPages || 1;
  const totalUsers = usersData?.data?.totalUsers || 0;


  const handleOpenEditModal = (user) => {
    const rawDepts = typeof user.departments === 'string' ? JSON.parse(user.departments || "[]") : (user.departments || []);
    const resolvedDepts = Array.isArray(rawDepts) && rawDepts.length
      ? rawDepts.map(String)
      : ((user.departmentId || user.DepartmentId) ? [String(user.departmentId || user.DepartmentId)] : (user.department?._id ? [String(user.department._id)] : []));

    const rawStations = typeof user.stations === 'string' ? JSON.parse(user.stations || "[]") : (user.stations || []);
    const resolvedStations = Array.isArray(rawStations) && rawStations.length
      ? rawStations.map(String)
      : ((user.stationId || user.StationId) ? [String(user.stationId || user.StationId)] : []);

    const resolvedSections = [
      ...new Set([
        ...(user.sectionId ? [String(user.sectionId)] : []),
        ...(user.assignments || []).map(a => String(a.sectionId))
      ])
    ].filter(Boolean);

    const resolvedLines = [
      ...new Set([
        ...(user.lineId ? [String(user.lineId)] : []),
        ...(user.assignments || []).map(a => String(a.lineId))
      ])
    ].filter(Boolean);

    const resolvedSubSections = [
      ...new Set([
        ...(user.subSectionId ? [String(user.subSectionId)] : []),
        ...(user.assignments || []).map(a => String(a.subSectionId))
      ])
    ].filter(Boolean);

    const resolvedShiftSchedule = typeof user.shiftSchedule === 'string'
      ? (() => { try { return JSON.parse(user.shiftSchedule); } catch (e) { return {}; } })()
      : (user.shiftSchedule || {});

    setSelectedUser({
      ...user,
      departments: resolvedDepts,
      sections: resolvedSections,
      lines: resolvedLines,
      subSections: resolvedSubSections,
      stations: resolvedStations,
      shiftSchedule: resolvedShiftSchedule,
    });
    setShowEditModal(true);
  };

  const handleCreateUser = async () => {
    try {
      const payload = {
        ...newUser,
        sectionId: newUser.sections[0] || null,
        subSectionId: newUser.subSections[0] || null,
        lineId: newUser.lines[0] || null,
      };
      const result = await createUser(payload).unwrap();
      toast.success("User created successfully!");
      setShowCreateModal(false);
      setNewUser({
        fullName: "",
        userName: "",
        email: "",
        phoneNumber: "",
        role: "STUDENT",
        password: "",
        status: "ACTIVE",
        unit: "UNIT_1",
        customRoleId: "",
        departments: (currentUser?.role !== "SUPERADMIN" && (currentUser?.departmentId || currentUser?.department?._id)) ? [String(currentUser?.departmentId || currentUser?.department?._id)] : [],
        sections: [],
        lines: [],
        subSections: [],
        stations: [],
      });
      refetch();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error?.data?.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    try {
      const { _id, ...updateData } = selectedUser;
      const payload = {
        ...updateData,
        sectionId: updateData.sections[0] || null,
        subSectionId: updateData.subSections[0] || null,
        lineId: updateData.lines[0] || null,
      };
      await updateUser({ id: _id, ...payload }).unwrap();
      toast.success("User updated successfully!");
      setShowEditModal(false);
      refetch();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error?.data?.message || "Failed to update user");
    }
  };

  const handleOpenShiftModal = (user) => {
    const resolved = typeof user.shiftSchedule === 'string'
      ? (() => { try { return JSON.parse(user.shiftSchedule); } catch (e) { return {}; } })()
      : (user.shiftSchedule || {});
    setShiftUser(user);
    setShiftScheduleDraft(resolved);
    setShowShiftModal(true);
  };

  const handleSaveBulkShift = async () => {
    if (Object.keys(bulkShiftScheduleDraft).length === 0) {
      toast.error("No shift changes to apply. Use the calendar to assign shifts first.");
      return;
    }
    if (isBulkSubmitting) return;
    setIsBulkSubmitting(true);
    try {
      const payload = { ids: selectedUsers, shiftSchedulePatch: bulkShiftScheduleDraft };
      const result = await bulkUpdateShiftSchedule(payload).unwrap();
      toast.success(result?.message || "Shift schedule updated successfully!");
      setShowBulkShiftModal(false);
      setBulkShiftScheduleDraft({});
      refetch();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to update shift schedules");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleSaveShift = async () => {
    if (!shiftUser) return;
    try {
      await updateUser({ id: shiftUser._id, shiftSchedule: shiftScheduleDraft }).unwrap();
      toast.success("Shift schedule saved!");
      setShowShiftModal(false);
      refetch();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to save shift schedule");
    }
  };

  const handleDeleteUser = async (userId, permanent = false) => {
    if (window.confirm(`Are you sure you want to ${permanent ? 'permanently delete' : 'delete'} this user?`)) {
      try {
        await deleteUser(userId).unwrap();
        toast.success("User deleted successfully!");
        refetch();
      } catch (error) {
        console.error("Error deleting user:", error);
        toast.error(error?.data?.message || "Failed to delete user");
      }
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      toast.error("Please select users to perform bulk action");
      return;
    }

    if (window.confirm(`Are you sure you want to ${action} ${selectedUsers.length} selected users?`)) {
      try {
        // Note: Bulk operations would need to be implemented in the API
        // For now, simulate the action
        switch (action) {
          case 'activate':
            // In a real implementation, call bulkUserOperation mutation
            break;
          case 'suspend':
            // In a real implementation, call bulkUserOperation mutation  
            break;
          case 'delete':
            // In a real implementation, call bulkUserOperation mutation
            break;
          default:
            break;
        }
        toast.success(`Bulk ${action} operation completed!`);
        setSelectedUsers([]);
        refetch();
      } catch (error) {
        console.error("Error performing bulk action:", error);
        toast.error(error?.data?.message || "Failed to perform bulk action");
      }
    }
  };

  const getUserDeptNames = (user) => {
    const allDepartments = deptData?.data?.departments || [];
    const rawDepts = typeof user.departments === 'string'
      ? JSON.parse(user.departments || "[]")
      : (user.departments || []);
    if (Array.isArray(rawDepts) && rawDepts.length > 0 && allDepartments.length > 0) {
      const names = rawDepts.map(id => {
        const d = allDepartments.find(dept => String(getDeptId(dept)) === String(id));
        return d ? d.name : null;
      }).filter(Boolean);
      if (names.length > 0) return names;
    }
    if (Array.isArray(user.assignments) && user.assignments.length > 0) {
      const names = [...new Set(user.assignments.map(a => a.deptName).filter(n => n && n.toLowerCase() !== "none"))];
      if (names.length > 0) return names;
    }
    return (user.deptName && user.deptName.toLowerCase() !== "none") ? [user.deptName] : [];
  };

  const getUserSectionNames = (user) => {
    if (Array.isArray(user.assignments) && user.assignments.length > 0) {
      const names = [...new Set(user.assignments.map(a => a.sectionName).filter(n => n && n.toLowerCase() !== "none"))];
      if (names.length > 0) return names;
    }
    return (user.sectionName && user.sectionName.toLowerCase() !== "none") ? [user.sectionName] : [];
  };

  const getRoleColor = (role) => {
    switch (role) {
      case "SUPERADMIN":
        return "bg-purple-100 text-purple-800";
      case "ADMIN":
        return "bg-red-100 text-red-800";
      case "INSTRUCTOR":
        return "bg-blue-100 text-blue-800";
      case "STUDENT":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
      case "Present":
        return "bg-green-100 text-green-800";
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800";
      case "BANNED":
      case "Absent":
        return "bg-red-100 text-red-800";
      case "PENDING":
        return "bg-blue-100 text-blue-800";
      case "LEFT":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Modal content moved to Dialog component inline

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
            All Users Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Manage all users across the platform with advanced controls
          </p>
        </div>
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-3">
          <div className="grid grid-cols-2 xs:flex gap-2">
            <Button
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              variant={showDebugInfo ? "default" : "outline"}
              size="sm"
              className={`${showDebugInfo ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : ""} flex-1 xs:flex-none`}
            >
              <IconInfoCircle className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Debug</span>
              <span className="xs:hidden">Debug</span>
            </Button>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? "default" : "outline"}
              size="sm"
              className="flex-1 xs:flex-none"
            >
              <IconFilter className="w-4 h-4 mr-2" />
              <span className="hidden xs:inline">Filters</span>
              <span className="xs:hidden">Filter</span>
            </Button>
          </div>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                <IconPlus className="w-4 h-4 mr-2" />
                <span className="hidden xs:inline">Create User</span>
                <span className="xs:hidden">Create</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Create New User</DialogTitle>
                <DialogDescription className="text-sm">
                  Add a new user to the system with their basic information and role assignment.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">
                      Full Name *
                    </Label>
                    <Input
                      id="fullName"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userName" className="text-sm font-medium">
                      Username *
                    </Label>
                    <Input
                      id="userName"
                      value={newUser.userName}
                      onChange={(e) => setNewUser({ ...newUser, userName: e.target.value })}
                      placeholder="Enter username"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="Enter email address"
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber" className="text-sm font-medium">
                      Phone Number *
                    </Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={newUser.phoneNumber}
                      onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                      placeholder="Enter phone number"
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-sm font-medium">
                        Role *
                      </Label>
                      <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit" className="text-sm font-medium">
                        Unit *
                      </Label>
                      <Select value={newUser.unit} onValueChange={(value) => setNewUser({ ...newUser, unit: value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNIT_1">Unit 1</SelectItem>
                          <SelectItem value="UNIT_2">Unit 2</SelectItem>
                          <SelectItem value="UNIT_3">Unit 3</SelectItem>
                          <SelectItem value="UNIT_4">Unit 4</SelectItem>
                          <SelectItem value="UNIT_5">Unit 5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password *
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Enter password"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customRole" className="text-sm font-medium">Custom Role (Optional)</Label>
                    <Select
                      value={newUser.customRoleId || "none"}
                      onValueChange={(value) => setNewUser({ ...newUser, customRoleId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select custom role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {customRoles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator className="my-2" />
                  
                  <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <IconShield className="w-4 h-4 text-blue-600" />
                      Organizational Assignment
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">Department</Label>
                        <FormSelect
                          multiple={true}
                          placeholder="Select Departments"
                          value={newUser.departments}
                          onValueChange={(values) => setNewUser({
                            ...newUser,
                            departments: values,
                            sections: [],
                            lines: [],
                            subSections: [],
                            stations: []
                          })}
                          options={departments.map(d => ({ value: String(getDeptId(d)), label: d.name }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">Section</Label>
                        <FormSelect
                          multiple={true}
                          placeholder="Select Sections"
                          value={newUser.sections}
                          onValueChange={(values) => setNewUser({
                            ...newUser,
                            sections: values,
                            lines: [],
                            subSections: [],
                            stations: []
                          })}
                          options={createSections.map(s => ({ value: String(s.id), label: s.name }))}
                          disabled={!newUser.departments.length}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">Line</Label>
                        <FormSelect
                          multiple={true}
                          placeholder="Select Lines"
                          value={newUser.lines}
                          onValueChange={(values) => setNewUser({
                            ...newUser,
                            lines: values,
                            subSections: [],
                            stations: []
                          })}
                          options={createLines.map(l => ({ value: String(l.id), label: l.name }))}
                          disabled={!newUser.sections.length}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-500">Sub-Section</Label>
                        <FormSelect
                          multiple={true}
                          placeholder="Select Sub-sections"
                          value={newUser.subSections}
                          onValueChange={(values) => setNewUser({
                            ...newUser,
                            subSections: values,
                            stations: []
                          })}
                          options={createSubSections.map(ss => ({ value: String(ss.id), label: ss.name }))}
                          disabled={!newUser.lines.length}
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-xs font-medium text-gray-500">Station (Machine)</Label>
                        <FormSelect
                          multiple={true}
                          placeholder="Select Stations"
                          value={newUser.stations}
                          onValueChange={(values) => setNewUser({
                            ...newUser,
                            stations: values
                          })}
                          options={createStations.map(st => ({ value: String(st.id), label: st.name }))}
                          disabled={!newUser.subSections.length}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={!newUser.fullName}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Edit User</DialogTitle>
                <DialogDescription className="text-sm">
                  Update user information and role assignment.
                </DialogDescription>
              </DialogHeader>
              {selectedUser && (
                <div className="grid gap-4 py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-fullName" className="text-sm font-medium">
                        Full Name *
                      </Label>
                      <Input
                        id="edit-fullName"
                        value={selectedUser.fullName}
                        onChange={(e) => setSelectedUser({ ...selectedUser, fullName: e.target.value })}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-email" className="text-sm font-medium">
                        Email *
                      </Label>
                      <Input
                        id="edit-email"
                        type="email"
                        value={selectedUser.email}
                        onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-role" className="text-sm font-medium">
                        System Role *
                      </Label>
                      <Select
                        value={selectedUser.role}
                        onValueChange={(value) => setSelectedUser({ ...selectedUser, role: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STUDENT">Student</SelectItem>
                          <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-customRole" className="text-sm font-medium">
                        Custom Role (Optional)
                      </Label>
                      <Select
                        value={selectedUser.customRoleId || "none"}
                        onValueChange={(value) =>
                          setSelectedUser({
                            ...selectedUser,
                            customRoleId: value === "none" ? "" : value
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select custom role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {customRoles.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-status" className="text-sm font-medium">
                        Status
                      </Label>
                      <Select
                        value={selectedUser.status}
                        onValueChange={(value) => setSelectedUser({ ...selectedUser, status: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="SUSPENDED">Suspended</SelectItem>
                          <SelectItem value="BANNED">Banned</SelectItem>
                          <SelectItem value="PENDING">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator className="my-2" />
                    
                    <div className="space-y-4 pt-2">
                       <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                         <IconShield className="w-4 h-4 text-blue-600" />
                         Organizational Assignment
                       </h4>
                       
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500">Department</Label>
                            <FormSelect
                              multiple={true}
                              placeholder="Select Departments"
                              value={selectedUser.departments}
                              onValueChange={(values) => setSelectedUser({
                                ...selectedUser,
                                departments: values,
                                sections: [],
                                lines: [],
                                subSections: [],
                                stations: []
                              })}
                              options={departments.map(d => ({ value: String(getDeptId(d)), label: d.name }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500">Section</Label>
                            <FormSelect
                              multiple={true}
                              placeholder="Select Sections"
                              value={selectedUser.sections}
                              onValueChange={(values) => setSelectedUser({
                                ...selectedUser,
                                sections: values,
                                lines: [],
                                subSections: [],
                                stations: []
                              })}
                              options={editSections.map(s => ({ value: String(s.id), label: s.name }))}
                              disabled={!selectedUser.departments.length}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500">Line</Label>
                            <FormSelect
                              multiple={true}
                              placeholder="Select Lines"
                              value={selectedUser.lines}
                              onValueChange={(values) => setSelectedUser({
                                ...selectedUser,
                                lines: values,
                                subSections: [],
                                stations: []
                              })}
                              options={editLines.map(l => ({ value: String(l.id), label: l.name }))}
                              disabled={!selectedUser.sections.length}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-gray-500">Sub-Section</Label>
                            <FormSelect
                              multiple={true}
                              placeholder="Select Sub-sections"
                              value={selectedUser.subSections}
                              onValueChange={(values) => setSelectedUser({
                                ...selectedUser,
                                subSections: values,
                                stations: []
                              })}
                              options={editSubSections.map(ss => ({ value: String(ss.id), label: ss.name }))}
                              disabled={!selectedUser.lines.length}
                            />
                          </div>

                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs font-medium text-gray-500">Station (Machine)</Label>
                            <FormSelect
                              multiple={true}
                              placeholder="Select Stations"
                              value={selectedUser.stations}
                              onValueChange={(values) => setSelectedUser({
                                ...selectedUser,
                                stations: values
                              })}
                              options={editStations.map(st => ({ value: String(st.id), label: st.name }))}
                              disabled={!selectedUser.subSections.length}
                            />
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateUser}
                  disabled={!selectedUser?.fullName || !selectedUser?.email}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Shift Schedule Dialog */}
          <Dialog open={showShiftModal} onOpenChange={setShowShiftModal}>
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <IconCalendar className="w-5 h-5 text-blue-600" />
                  Shift Schedule
                  {shiftUser && (
                    <span className="text-sm font-normal text-gray-500 ml-1">— {shiftUser.fullName}</span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Assign date-wise shifts for this user. Changes are saved only when you click "Save".
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <ShiftScheduler
                  schedule={shiftScheduleDraft}
                  onChange={setShiftScheduleDraft}
                />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowShiftModal(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveShift}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  Save Shift Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Shift Schedule Dialog */}
          <Dialog open={showBulkShiftModal} onOpenChange={(open) => { setShowBulkShiftModal(open); if (!open) setBulkShiftScheduleDraft({}); }}>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <IconCalendar className="w-5 h-5 text-indigo-600" />
                  Bulk Shift Schedule
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    — {selectedUsers.length} selected user{selectedUsers.length !== 1 ? "s" : ""}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Assign shifts for the selected users. These shifts will be <strong>merged</strong> into each user's existing schedule — dates not assigned here are untouched.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <ShiftScheduler
                  schedule={bulkShiftScheduleDraft}
                  onChange={setBulkShiftScheduleDraft}
                />
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => { setShowBulkShiftModal(false); setBulkShiftScheduleDraft({}); }} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveBulkShift}
                  disabled={isBulkSubmitting || Object.keys(bulkShiftScheduleDraft).length === 0}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800"
                >
                  {isBulkSubmitting ? "Saving..." : "Save Shift Schedule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Present Users</p>
              <h3 className="text-2xl font-black text-emerald-900 leading-none">
                {isLoading ? "..." : (usersData?.data?.presentCount || 0)}
              </h3>
              <div className="flex items-center mt-2 text-[10px] text-emerald-600/70 font-bold bg-emerald-100/50 w-fit px-2 py-0.5 rounded-full border border-emerald-200/50">
                <IconCalendar className="w-3 h-3 mr-1" />
                {filters.date || format(new Date(), "yyyy-MM-dd")}
              </div>
            </div>
            <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-200/50 text-white">
              <IconUserCheck className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-50/50 border-rose-100 shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between text-rose-900">
            <div>
              <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Absent Users</p>
              <h3 className="text-2xl font-black leading-none">
                {isLoading ? "..." : (usersData?.data?.absentCount || 0)}
              </h3>
              <div className="flex items-center mt-2 text-[10px] text-rose-600/70 font-bold bg-rose-100/50 w-fit px-2 py-0.5 rounded-full border border-rose-200/50">
                <IconCalendar className="w-3 h-3 mr-1" />
                {filters.date || format(new Date(), "yyyy-MM-dd")}
              </div>
            </div>
            <div className="bg-rose-600 p-2.5 rounded-xl shadow-lg shadow-rose-200/50 text-white">
              <IconUserX className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50/50 border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between text-slate-900">
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Left Users</p>
              <h3 className="text-2xl font-black leading-none">
                {isLoading ? "..." : (usersData?.data?.leftCount || 0)}
              </h3>
              <p className="text-[10px] text-slate-600/70 font-bold mt-2">Resigned/Terminated</p>
            </div>
            <div className="bg-slate-600 p-2.5 rounded-xl shadow-lg shadow-slate-200/50 text-white">
              <IconUserMinus className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-violet-50/50 border-violet-100 shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between text-violet-900">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">Overall Efficiency</p>
              <h3 className="text-2xl font-black leading-none">
                {isLoading ? "..." : `${usersData?.data?.overallEfficiency || 0}%`}
              </h3>
              <div className="flex flex-wrap gap-1 mt-2">
                <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/50">
                  Present Avg: {isLoading ? "..." : `${usersData?.data?.presentEfficiency || 0}%`}
                </span>
                <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/50">
                  Base Avg: {isLoading ? "..." : `${usersData?.data?.systemEfficiency || 0}%`}
                </span>
              </div>
            </div>
            <div className="bg-violet-600 p-2.5 rounded-xl shadow-lg shadow-violet-200/50 text-white shrink-0">
              <IconGauge className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-100 shadow-sm hover:shadow-md transition-all duration-300">
          <CardContent className="p-4 flex items-center justify-between text-blue-900">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Result</p>
              <h3 className="text-2xl font-black leading-none">
                {isLoading ? "..." : (usersData?.data?.totalUsers || 0)}
              </h3>
              <p className="text-[10px] text-blue-600/70 font-bold mt-2">Filtered Users List</p>
            </div>
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200/50 text-white">
              <IconUsers className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Information Panel */}
      {showDebugInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <IconInfoCircle className="w-5 h-5 text-yellow-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-yellow-800 font-medium mb-3">Debug Information</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong className="text-yellow-800">Current User:</strong>
                    <div className="text-yellow-700 mt-1">
                      {currentUser ? (
                        <div>
                          <div>Name: {currentUser.fullName}</div>
                          <div>Email: {currentUser.email}</div>
                          <div>Role: {currentUser.role}</div>
                          <div>Status: {currentUser.status}</div>
                        </div>
                      ) : (
                        <div className="text-red-600">No user data found in Redux state</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <strong className="text-yellow-800">Authentication:</strong>
                    <div className="text-yellow-700 mt-1">
                      <div>Token exists: {localStorage.getItem('token') ? 'Yes' : 'No'}</div>
                      <div>IsLoggedIn: {localStorage.getItem('isLoggedIn')}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <strong className="text-yellow-800">API Request Status:</strong>
                  <div className="text-yellow-700 mt-1">
                    <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
                    <div>Error: {isError ? 'Yes' : 'No'}</div>
                    {error && (
                      <div className="mt-2">
                        <strong>Error Details:</strong>
                        <div className="bg-red-50 border border-red-200 rounded p-2 mt-1">
                          <div>Status: {error.status}</div>
                          <div>Message: {error.message || error.data?.message}</div>
                          {error.data && (
                            <div>Data: {JSON.stringify(error.data, null, 2)}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <strong className="text-yellow-800">API Endpoint:</strong>
                  <div className="text-yellow-700 mt-1">
                    <div>URL: /api/users</div>
                    <div>Parameters: {JSON.stringify({
                      page: currentPage,
                      limit: 20,
                      sortBy,
                      order: sortOrder,
                      search: searchTerm,
                      role: filters.role,
                      status: filters.status,
                      dateFrom: filters.dateFrom,
                      dateTo: filters.dateTo,
                      departmentId: filters.departmentId
                    }, null, 2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date From</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date To</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Department</label>
              <Select
                value={filters.departmentId || (currentUser?.role === 'SUPERADMIN' || currentUser?.isAdmin === true ? "all" : (departments.length === 1 ? String(getDeptId(departments[0])) : "all-assigned"))}
                onValueChange={(val) => setFilters({ 
                  ...filters, 
                  departmentId: (val === "all" || val === "all-assigned") ? "" : val,
                  sectionId: "", lineId: "", subSectionId: "", stationId: ""
                })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.role === 'SUPERADMIN' || currentUser?.isAdmin === true ? (
                    <SelectItem value="all">All Departments</SelectItem>
                  ) : (
                     departments.length > 1 && <SelectItem value="all-assigned">All My Departments</SelectItem>
                  )}
                  {departments.map(d => <SelectItem key={getDeptId(d)} value={String(getDeptId(d))}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Section</label>
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
                  {sections.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Line</label>
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
                  {lines.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sub-Section</label>
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
                  {subSections.map(ss => <SelectItem key={ss.id} value={String(ss.id)}>{ss.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Station</label>
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
                  {stations.map(st => <SelectItem key={st.id} value={String(st.id)}>{st.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
              <Select
                value={filters.role || "all"}
                onValueChange={(e) => setFilters({ ...filters, role: e === "all" ? "" : e })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="SUPERADMIN">Super Admin</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                  <SelectItem value="STUDENT">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(e) => setFilters({ ...filters, status: e === "all" ? "" : e })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Present">Present (Attendance)</SelectItem>
                  <SelectItem value="Absent">Absent (Attendance)</SelectItem>
                  <SelectItem value="ACTIVE">System: Active</SelectItem>
                  <SelectItem value="SUSPENDED">System: Suspended</SelectItem>
                  <SelectItem value="BANNED">System: Banned</SelectItem>
                  <SelectItem value="PENDING">System: Pending</SelectItem>
                  <SelectItem value="LEFT">Left (Resigned/Terminated)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift Date</label>
              <div className="relative">
                <IconCalendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 justify-between text-left font-normal border-slate-200 hover:bg-slate-50 bg-white"
                  >
                    <span className="truncate">
                      {filters.designation && filters.designation.split(",").filter(Boolean).length > 0
                        ? `${filters.designation.split(",").filter(Boolean).length} Selected`
                        : "Select Designation"}
                    </span>
                    <IconChevronDown className="h-4 w-4 opacity-50 shrink-0" stroke={2.5} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 bg-white border border-slate-200 shadow-md rounded-md z-50" align="start">
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {uniqueDesignations.length === 0 ? (
                      <div className="text-xs text-slate-500 p-2 text-center">No designations found</div>
                    ) : (
                      uniqueDesignations.map((designation) => {
                        const selectedList = filters.designation ? filters.designation.split(",").filter(Boolean) : [];
                        const isChecked = selectedList.includes(designation);
                        return (
                          <div key={designation} className="flex items-center space-x-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                            <Checkbox
                              id={`designation-${designation}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const selectedList = filters.designation ? filters.designation.split(",").filter(Boolean) : [];
                                let newList = [...selectedList];
                                if (checked) {
                                  newList.push(designation);
                                } else {
                                  newList = newList.filter((item) => item !== designation);
                                }
                                setFilters((prev) => ({
                                  ...prev,
                                  designation: newList.join(","),
                                }));
                              }}
                            />
                            <label
                              htmlFor={`designation-${designation}`}
                              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 truncate select-none text-slate-700"
                            >
                              {designation}
                            </label>
                          </div>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-9"
                onClick={() => setFilters({
                  role: "", status: "", dateFrom: "", dateTo: "",
                  departmentId: "", sectionId: "", lineId: "", subSectionId: "", stationId: "",
                  unit: "", shift: "", date: format(new Date(), "yyyy-MM-dd"),
                  designation: ""
                })}
              >
                <IconX className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <IconSearch className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-3">
            {selectedUsers.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedUsers.length} selected
                </span>
                <button
                  onClick={() => handleBulkAction('activate')}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
                >
                  <IconUserCheck className="w-4 h-4" />
                  <span>Activate</span>
                </button>
                <button
                  onClick={() => handleBulkAction('suspend')}
                  className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
                >
                  <IconUserX className="w-4 h-4" />
                  <span>Suspend</span>
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                  <IconTrash className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => { setBulkShiftScheduleDraft({}); setShowBulkShiftModal(true); }}
                  className="flex items-center space-x-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
                >
                  <IconCalendar className="w-4 h-4" />
                  <span>Schedule Shift</span>
                </button>
              </div>
            )}

            <button
              onClick={() => refetch()}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <IconRefresh className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            <button className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors">
              <IconDownload className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Desktop Table */}
        <div className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(users.map(user => user._id));
                        } else {
                          setSelectedUsers([]);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emp ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled Shift
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Section
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Line
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sub-Section
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Station
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="14" className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan="14" className="px-6 py-8 text-center">
                      <div className="text-red-600">
                        Error loading users: {error?.data?.message || error?.message}
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="px-6 py-8 text-center">
                      <div className="text-gray-500">No users found</div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user._id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user._id));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {user.empId || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {user.logDate ? format(new Date(user.logDate), "dd MMM yyyy") : (filters.date ? format(new Date(filters.date), "dd MMM yyyy") : "-")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img
                            className="h-8 w-8 rounded-full object-cover"
                            src={user.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=2563eb&color=fff`}
                            alt={user.fullName}
                          />
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{user.fullName}</div>
                            <div className="text-xs text-gray-500">@{user.userName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {(() => {
                          const activeShift = user.logShift || user.shift;
                          if (!activeShift) return <span className="text-gray-400">-</span>;
                          const styleMap = { A: "bg-blue-50 text-blue-700 border-blue-200", B: "bg-emerald-50 text-emerald-700 border-emerald-200", C: "bg-purple-50 text-purple-700 border-purple-200", G: "bg-amber-50 text-amber-700 border-amber-200" };
                          return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styleMap[activeShift] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{activeShift}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {(() => {
                          const schedule = typeof user.shiftSchedule === 'string'
                            ? (() => { try { return JSON.parse(user.shiftSchedule); } catch (e) { return {}; } })()
                            : (user.shiftSchedule || {});
                          const rawDate = user.logDate || filters.date;
                          const activeDate = rawDate
                            ? (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : String(rawDate).substring(0, 10))
                            : format(new Date(), "yyyy-MM-dd");
                          const scheduledShift = schedule[activeDate];
                          if (!scheduledShift) return <span className="text-gray-400">-</span>;
                          const styleMap = { A: "bg-blue-50 text-blue-700 border-blue-200", B: "bg-emerald-50 text-emerald-700 border-emerald-200", C: "bg-purple-50 text-purple-700 border-purple-200", G: "bg-amber-50 text-amber-700 border-amber-200" };
                          return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styleMap[scheduledShift] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{scheduledShift}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(user.logStatus || ((filters.date || (filters.dateFrom && filters.dateTo)) ? "Absent" : user.status))}`}>
                          {user.logStatus || ((filters.date || (filters.dateFrom && filters.dateTo)) ? "Absent" : user.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold shrink-0 ${Math.min(user.currentEffeciency || 0, 100) >= 85 ? "text-emerald-600" : Math.min(user.currentEffeciency || 0, 100) >= 70 ? "text-blue-600" : "text-amber-600"}`}>
                            {Math.min(user.currentEffeciency || 0, 100)}%
                          </span>
                          <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden hidden sm:block shrink-0">
                            <div 
                              className={`h-1.5 rounded-full ${Math.min(user.currentEffeciency || 0, 100) >= 85 ? "bg-emerald-500" : Math.min(user.currentEffeciency || 0, 100) >= 70 ? "bg-blue-500" : "bg-amber-500"}`}
                              style={{ width: `${Math.min(user.currentEffeciency || 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                       <td className="px-6 py-4 text-sm text-gray-900 max-w-[120px]">
                        {(() => {
                          const names = getUserDeptNames(user);
                          if (names.length === 0) return <span className="text-gray-400">-</span>;
                          if (names.length === 1) return <span className="truncate">{names[0]}</span>;
                          return (
                            <div className="flex flex-col gap-0.5">
                              {names.map((name, idx) => (
                                <span key={idx} className="text-xs font-medium bg-blue-50 text-blue-700 px-1 py-0.5 rounded truncate">{name}</span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-[120px]">
                        {(() => {
                          const names = getUserSectionNames(user);
                          if (names.length === 0) return <span className="text-gray-400">-</span>;
                          if (names.length === 1) return <span className="truncate">{names[0]}</span>;
                          return (
                            <div className="flex flex-col gap-0.5">
                              {names.map((name, idx) => (
                                <span key={idx} className="text-xs font-medium bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded truncate">{name}</span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-[100px]">
                        {(user.lineName && user.lineName.toLowerCase() !== "none") ? user.lineName : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-[100px]">
                        {(user.subSectionName && user.subSectionName.toLowerCase() !== "none") ? user.subSectionName : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-[100px]">
                        {(user.stationName && user.stationName.toLowerCase() !== "none") ? user.stationName : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`${getRoleColor(user.role)} whitespace-nowrap`}>
                          {user.role === "STUDENT" ? "Operator" : (user.customRoleName || user.role)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                            title="Edit User"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenShiftModal(user)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                            title="Shift Schedule"
                          >
                            <IconCalendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate('/cms/daily-5m-recording', { state: { playUser: user } })}
                            className="p-1.5 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-50 rounded transition-colors"
                            title="Start Action"
                          >
                            <span className="text-[10px] font-black leading-none">5M</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id, true)}
                            className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                            title="Permanently Delete"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4 p-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-red-600">
              Error loading users: {error?.data?.message || error?.message}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <IconUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">No users found</h3>
              <p className="text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            users.map((user) => (
              <Card key={user._id} className="transition-all duration-200 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage
                        src={user.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=2563eb&color=fff`}
                        alt={user.fullName}
                      />
                      <AvatarFallback className="bg-blue-100 text-blue-800">
                        {user.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{user.fullName}</h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span className="font-medium text-blue-600">ID: {user.empId || "-"}</span>
                            <span>•</span>
                            <span>@{user.userName}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenShiftModal(user)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Shift Schedule"
                          >
                            <IconCalendar className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate('/cms/daily-5m-recording', { state: { playUser: user } })}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Start Action"
                          >
                            <span className="text-[10px] font-black leading-none">5M</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id, true)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-4 text-xs">
                        <div>
                          <p className="text-gray-400 mb-0.5">Shift</p>
                          {(() => {
                            const activeShift = user.logShift || user.shift;
                            if (!activeShift) return <p className="font-medium text-gray-400">-</p>;
                            const styleMap = { A: "bg-blue-50 text-blue-700 border-blue-200", B: "bg-emerald-50 text-emerald-700 border-emerald-200", C: "bg-purple-50 text-purple-700 border-purple-200", G: "bg-amber-50 text-amber-700 border-amber-200" };
                            return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styleMap[activeShift] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{activeShift}</span>;
                          })()}
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Scheduled Shift</p>
                          {(() => {
                            const schedule = typeof user.shiftSchedule === 'string'
                              ? (() => { try { return JSON.parse(user.shiftSchedule); } catch (e) { return {}; } })()
                              : (user.shiftSchedule || {});
                            const rawDate = user.logDate || filters.date;
                            const activeDate = rawDate
                              ? (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : String(rawDate).substring(0, 10))
                              : format(new Date(), "yyyy-MM-dd");
                            const scheduledShift = schedule[activeDate];
                            if (!scheduledShift) return <p className="font-medium text-gray-400">-</p>;
                            const styleMap = { A: "bg-blue-50 text-blue-700 border-blue-200", B: "bg-emerald-50 text-emerald-700 border-emerald-200", C: "bg-purple-50 text-purple-700 border-purple-200", G: "bg-amber-50 text-amber-700 border-amber-200" };
                            return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${styleMap[scheduledShift] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{scheduledShift}</span>;
                          })()}
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Department</p>
                          {(() => {
                            const names = getUserDeptNames(user);
                            if (names.length <= 1) return <p className="font-medium text-gray-700 truncate">{names[0] || "-"}</p>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {names.map((name, idx) => (
                                  <span key={idx} className="text-xs font-medium bg-blue-50 text-blue-700 px-1 py-0.5 rounded truncate">{name}</span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Section</p>
                          {(() => {
                            const names = getUserSectionNames(user);
                            if (names.length <= 1) return <p className="font-medium text-gray-700 truncate">{names[0] || "-"}</p>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {names.map((name, idx) => (
                                  <span key={idx} className="text-xs font-medium bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded truncate">{name}</span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Efficiency</p>
                          <p className={`font-semibold ${Math.min(user.currentEffeciency || 0, 100) >= 85 ? "text-emerald-600" : Math.min(user.currentEffeciency || 0, 100) >= 70 ? "text-blue-600" : "text-amber-600"}`}>
                            {Math.min(user.currentEffeciency || 0, 100)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Role</p>
                          <Badge variant="outline" className={`${getRoleColor(user.role)} text-[10px] h-5 py-0`}>
                            {user.role === "STUDENT" ? "Operator" : (user.customRoleName || user.role)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                        <Badge className={`${getStatusColor(user.logStatus || ((filters.date || (filters.dateFrom && filters.dateTo)) ? "Absent" : user.status))} text-[10px] h-5 py-0`}>
                          {user.logStatus || ((filters.date || (filters.dateFrom && filters.dateTo)) ? "Absent" : user.status)}
                        </Badge>
                        <span className="text-[10px] text-gray-400 ml-auto">
                          Station: {user.stationName || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, totalUsers)} of {totalUsers} users
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="px-2 sm:px-3"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                className="px-2 sm:px-3"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AllUsersManagement;
