import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import {
  useUpdateUserMutation,
  useDeleteUserMutation,
} from "@/Redux/AllApi/UserApi";
import { useUserRegisterMutation } from "@/Redux/AllApi/AuthApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery, useGetAllSectionsQuery } from "@/Redux/AllApi/SectionApi";
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
  CardTitle,
} from "@/components/ui/card";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconSearch,
  IconRefresh,
  IconLoader,
  IconUserMinus,
  IconUserPlus,
  IconX,
  IconTrophy,
  IconUsers,
  IconUserCheck,
  IconChartBar,
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SearchInput from "@/components/common/SearchInput";
import FilterSelect from "@/components/common/FilterSelect";
import FilterBar from "@/components/common/FilterBar";
import StatCard from "@/components/common/StatCard";
import AssignMentorDialog from "@/components/mentors/AssignMentorDialog";

const MENTOR_ROLE_FIELD = "isMentor";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "ON_LEAVE", label: "On Leave" },
  { value: "LEFT", label: "Left" },
];

// Builds the month filter options: current month back through the previous 11 months, plus "All-Time".
const buildMonthOptions = () => {
  const options = [{ value: "ALL", label: "All-Time" }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    options.push({ value, label: format(d, "MMMM yyyy") });
  }
  return options;
};

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const RoleBasedUserManagement = ({ roleName, roleField, useQueryHook }) => {
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);

  const isMasterAdmin =
    authUser?.role === "SUPERADMIN" ||
    authUser?.role === "ADMIN" ||
    authUser?.isAdmin === 1 ||
    authUser?.isAdmin === true;

  const userPermissions = authUser?.customRole?.permissions || [];

  // A CUSTOM-role user whose profile carries specific department/section assignments is
  // restricted to that scope: the dropdown filters must not offer "All Departments"/"All
  // Sections" (which would just re-request data the backend now silently scopes down anyway),
  // and should default to the user's own assignment instead of an unscoped "ALL".
  const isCustomRoleUser = authUser?.role === "CUSTOM";
  const assignedDeptIds = useMemo(() => {
    const ids = [];
    if (authUser?.departmentId) ids.push(String(authUser.departmentId));
    (Array.isArray(authUser?.departments) ? authUser.departments : []).forEach((d) => {
      const id = d && typeof d === "object" ? (d.id ?? d._id) : d;
      if (id) ids.push(String(id));
    });
    return [...new Set(ids)];
  }, [authUser]);
  const assignedSectionIds = useMemo(() => {
    const ids = [];
    if (authUser?.sectionId) ids.push(String(authUser.sectionId));
    (Array.isArray(authUser?.sections) ? authUser.sections : []).forEach((s) => {
      const id = s && typeof s === "object" ? (s.id ?? s._id) : s;
      if (id) ids.push(String(id));
    });
    return [...new Set(ids)];
  }, [authUser]);
  const hasAssignedDepts = isCustomRoleUser && assignedDeptIds.length > 0;
  const hasAssignedSections = isCustomRoleUser && assignedSectionIds.length > 0;

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState(() => (hasAssignedDepts ? assignedDeptIds[0] : "ALL"));
  const [sectionFilter, setSectionFilter] = useState(() => (hasAssignedSections ? assignedSectionIds[0] : "ALL"));
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMentorRole = roleField === MENTOR_ROLE_FIELD;
  const columnCount = isMentorRole ? 9 : 7;

  // Granular Mentor permissions (only enforced for the Mentor page; other
  // roles served by this component fall back to the previous always-shown behavior)
  const canCreate = !isMentorRole || isMasterAdmin || userPermissions.includes("mentor:create");
  const canUpdate = !isMentorRole || isMasterAdmin || userPermissions.includes("mentor:update");
  const canDelete = !isMentorRole || isMasterAdmin || userPermissions.includes("mentor:delete");

  const [formData, setFormData] = useState({
    fullName: "",
    empId: "",
    email: "",
    phoneNumber: "",
    designation: "",
    departmentId: "",
    sectionId: "",
    gender: "MALE",
    password: "",
    userName: "",
    unit: "UNIT_1",
    isEmployee: false,
    mentorLimit: "0",
    [roleField]: true
  });

  // API Hooks
  const { data: usersData, isLoading, isFetching, refetch } = useQueryHook({
    page: currentPage,
    limit: 10,
    search: searchTerm,
    departmentId: departmentFilter !== "ALL" ? departmentFilter : "",
    sectionId: sectionFilter !== "ALL" ? sectionFilter : "",
    status: statusFilter !== "ALL" ? statusFilter : "",
    ...(isMentorRole ? { month: selectedMonth } : {}),
  });

  const monthlyStats = isMentorRole ? usersData?.data?.stats : null;
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const selectedMonthLabel = monthOptions.find((o) => o.value === selectedMonth)?.label || "";

  const [registerUser] = useUserRegisterMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const { data: deptRes } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
  const { data: sectionRes } = useGetSectionsByDepartmentQuery(
    formData.departmentId,
    { skip: !formData.departmentId }
  );
  const { data: filterSectionRes } = useGetSectionsByDepartmentQuery(
    departmentFilter,
    { skip: departmentFilter === "ALL" }
  );
  // A section-restricted user with no department assignment has no departmentId to scope
  // the filter by (departmentFilter stays "ALL"), so fall back to the department-agnostic
  // endpoint -- the backend still confines the result to their assigned sections.
  const { data: allSectionsRes } = useGetAllSectionsQuery(undefined, {
    skip: departmentFilter !== "ALL" || !hasAssignedSections,
  });
  const sectionSourceData = departmentFilter === "ALL" ? allSectionsRes?.data : filterSectionRes?.data;

  // Reset to page 1 whenever a filter or the search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, sectionFilter, statusFilter, selectedMonth]);

  const departmentOptions = useMemo(() => {
    const options = hasAssignedDepts ? [] : [{ value: "ALL", label: "All Departments" }];
    (deptRes?.data?.departments || []).forEach((dept) => {
      if (!hasAssignedDepts || assignedDeptIds.includes(String(dept.id))) {
        options.push({ value: String(dept.id), label: dept.name });
      }
    });
    return options;
  }, [deptRes, hasAssignedDepts, assignedDeptIds]);

  const sectionOptions = useMemo(() => {
    const options = hasAssignedSections ? [] : [{ value: "ALL", label: "All Sections" }];
    (sectionSourceData || []).forEach((sec) => {
      if (!hasAssignedSections || assignedSectionIds.includes(String(sec.id))) {
        options.push({ value: String(sec.id), label: sec.name });
      }
    });
    return options;
  }, [sectionSourceData, hasAssignedSections, assignedSectionIds]);

  // Keeps the section filter pointing at a value that's actually present in the current
  // options (e.g. after the department filter changes and narrows/replaces the section list).
  useEffect(() => {
    const validValues = sectionOptions.map((o) => o.value);
    if (validValues.length > 0 && !validValues.includes(sectionFilter)) {
      setSectionFilter(validValues[0]);
    }
  }, [sectionOptions]);

  // A restricted user's dropdown never actually offers "ALL", so their forced default is
  // the locked-in assignment rather than "ALL" -- compare against that instead, otherwise
  // the Clear button/badges would treat their mandatory scope as a user-chosen filter.
  const defaultDepartmentFilter = hasAssignedDepts ? assignedDeptIds[0] : "ALL";
  const defaultSectionFilter = hasAssignedSections ? assignedSectionIds[0] : "ALL";

  const hasActiveFilters = departmentFilter !== defaultDepartmentFilter || sectionFilter !== defaultSectionFilter || statusFilter !== "ALL" || !!searchTerm;

  const activeFilters = useMemo(() => {
    const filters = [];
    if (departmentFilter !== defaultDepartmentFilter) {
      filters.push({ label: "Department", value: departmentOptions.find((o) => o.value === departmentFilter)?.label });
    }
    if (sectionFilter !== defaultSectionFilter) {
      filters.push({ label: "Section", value: sectionOptions.find((o) => o.value === sectionFilter)?.label });
    }
    if (statusFilter !== "ALL") {
      filters.push({ label: "Status", value: STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label });
    }
    if (searchTerm) {
      filters.push({ label: "Search", value: searchTerm });
    }
    return filters;
  }, [departmentFilter, sectionFilter, statusFilter, searchTerm, departmentOptions, sectionOptions, defaultDepartmentFilter, defaultSectionFilter]);

  const clearFilters = () => {
    setDepartmentFilter(defaultDepartmentFilter);
    setSectionFilter(defaultSectionFilter);
    setStatusFilter("ALL");
    setSearchTerm("");
  };

  const handleDepartmentFilterChange = (val) => {
    setDepartmentFilter(val);
    if (!hasAssignedSections) setSectionFilter("ALL");
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (id === "empId" && !formData.userName) {
      setFormData(prev => ({ ...prev, userName: value }));
    }
  };

  const handleAddUser = async () => {
    if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.userName) {
      toast.error("Please fill all required fields");
      return;
    }
    setIsSubmitting(true);
    try {
      await registerUser({ ...formData, mentorLimit: Number(formData.mentorLimit) || 0, role: "STUDENT" }).unwrap();
      toast.success(`${roleName} added successfully`);
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      toast.error(err.data?.message || `Failed to add ${roleName}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    setIsSubmitting(true);
    try {
      await updateUser({ id: selectedUser._id, ...formData, mentorLimit: Number(formData.mentorLimit) || 0 }).unwrap();
      toast.success(`${roleName} updated successfully`);
      setIsEditDialogOpen(false);
      resetForm();
      refetch();
    } catch (err) {
      toast.error(err.data?.message || `Failed to update ${roleName}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Are you sure you want to delete this ${roleName}?`)) {
      try {
        await deleteUser(user._id).unwrap();
        toast.success(`${roleName} deleted successfully`);
        refetch();
      } catch (err) {
        toast.error(`Failed to delete ${roleName}`);
      }
    }
  };

  // Un-flags the user as a Mentor while keeping them as an Operator, so they don't
  // disappear from user management entirely -- just move back to the Operators page.
  const handleRemoveFromMentor = async (user) => {
    if (!window.confirm(`Remove ${user.fullName} from Mentors? They will remain as an Operator.`)) return;
    try {
      await updateUser({ id: user._id, isMentor: false, isEmployee: true }).unwrap();
      toast.success(`${user.fullName} removed from Mentors`);
      refetch();
    } catch (err) {
      toast.error(err.data?.message || "Failed to remove from Mentors");
    }
  };

  const handleRowClick = (user) => {
    if (!isMentorRole) return;
    navigate(`${user._id}`);
  };


  const resetForm = () => {
    setFormData({
      fullName: "",
      empId: "",
      email: "",
      phoneNumber: "",
      designation: "",
      departmentId: "",
      sectionId: "",
      gender: "MALE",
      password: "",
      userName: "",
      unit: "UNIT_1",
      isEmployee: false,
      mentorLimit: "0",
      [roleField]: true
    });
    setSelectedUser(null);
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName || "",
      empId: user.empId || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      designation: user.designation || "",
      departmentId: user.department?._id ? String(user.department._id) : (user.departmentId ? String(user.departmentId) : ""),
      sectionId: user.sectionId ? String(user.sectionId) : "",
      gender: user.gender || "MALE",
      password: "",
      userName: user.userName || "",
      unit: user.unit || "UNIT_1",
      isEmployee: !!user.isEmployee,
      mentorLimit: String(user.mentorLimit ?? 0),
      [roleField]: true
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{roleName} Management</h1>
          <p className="text-gray-500">Manage all {roleName.toLowerCase()}s in the system</p>
        </div>
        <div className="flex items-center gap-2">
          {isMentorRole && (
            <FilterSelect
              value={selectedMonth}
              onValueChange={setSelectedMonth}
              options={monthOptions}
              placeholder="Month"
              className="w-44"
            />
          )}
          {isMentorRole && canUpdate && (
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(true)}>
              <IconUserPlus className="w-4 h-4 mr-2" />
              Assign Mentor
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
              <IconPlus className="w-4 h-4 mr-2" />
              Add {roleName}
            </Button>
          )}
        </div>
      </div>

      {isMentorRole && monthlyStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">Top Assigned Mentor</CardTitle>
              <div className="p-2 rounded-full bg-amber-200">
                <IconTrophy className="h-5 w-5 text-amber-700" />
              </div>
            </CardHeader>
            <CardContent>
              {monthlyStats.topMentor ? (
                <>
                  <div className="text-lg font-bold text-amber-900 truncate">{monthlyStats.topMentor.fullName}</div>
                  <p className="text-xs text-amber-700 mt-1">{monthlyStats.topMentor.department || "No Department"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-amber-600 hover:bg-amber-600 text-white">
                      {monthlyStats.topMentor.assignedCount} / {monthlyStats.topMentor.mentorLimit || "∞"} Mentees
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-700">No assignments {selectedMonth === "ALL" ? "yet" : `for ${selectedMonthLabel}`}</p>
              )}
            </CardContent>
          </Card>

          <StatCard
            title="Mentees Assigned"
            value={monthlyStats.totalMenteesAssigned}
            description={selectedMonth === "ALL" ? "All-time total" : selectedMonthLabel}
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
            title="Active Mentors"
            value={monthlyStats.totalMentors}
            description="Matching current filters"
            icon={IconUserCheck}
            iconBgColor="bg-green-100"
            iconColor="text-green-600"
            gradientFrom="from-green-50"
            gradientTo="to-green-100"
            borderColor="border-green-200"
            textColor="text-green-800"
            valueColor="text-green-900"
          />

          <StatCard
            title="Average Workload"
            value={`${monthlyStats.avgMenteesPerMentor} / mentor`}
            description={selectedMonth === "ALL" ? "All-time average" : selectedMonthLabel}
            icon={IconChartBar}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-600"
            gradientFrom="from-purple-50"
            gradientTo="to-purple-100"
            borderColor="border-purple-200"
            textColor="text-purple-800"
            valueColor="text-purple-900"
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1 max-w-sm">
              <SearchInput
                placeholder={`Search ${roleName.toLowerCase()}s...`}
                value={searchTerm}
                onChange={(val) => setSearchTerm(val)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                value={departmentFilter}
                onValueChange={handleDepartmentFilterChange}
                options={departmentOptions}
                placeholder="Department"
                className="w-48"
              />
              <FilterSelect
                value={sectionFilter}
                onValueChange={setSectionFilter}
                options={sectionOptions}
                placeholder="Section"
                className="w-48"
                disabled={departmentFilter === "ALL" && !hasAssignedSections}
              />
              <FilterSelect
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={STATUS_OPTIONS}
                placeholder="Status"
              />
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                  <IconX className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
                <IconRefresh className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <FilterBar filters={activeFilters} onClearFilters={clearFilters} className="mt-3" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Emp ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                {isMentorRole && <TableHead>Limit</TableHead>}
                {isMentorRole && (
                  <TableHead>
                    Assigned Mentees {selectedMonth !== "ALL" && `(${selectedMonthLabel})`}
                  </TableHead>
                )}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center py-10">
                    <IconLoader className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : usersData?.data?.users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center py-10 text-gray-500">
                    No {roleName.toLowerCase()}s found.
                  </TableCell>
                </TableRow>
              ) : (
                usersData?.data?.users?.map((user) => (
                  <TableRow
                    key={user._id}
                    onClick={() => handleRowClick(user)}
                    className={isMentorRole ? "cursor-pointer hover:bg-muted/30" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9">
                          <AvatarImage src={user.avatar?.url} />
                          <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{user.fullName}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.empId || "N/A"}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {user.logDate ? format(new Date(user.logDate), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell>{user.designation || "N/A"}</TableCell>
                    <TableCell>{user.department?.name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === "PRESENT" ? "success" : "secondary"}>
                        {user.status || "PRESENT"}
                      </Badge>
                    </TableCell>
                    {isMentorRole && (
                      <TableCell>{user.mentorLimit ?? 0}</TableCell>
                    )}
                    {isMentorRole && (
                      <TableCell>
                        {(user.assignedMentees?.length || 0) === 0 ? (
                          <Badge variant="secondary">0</Badge>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={
                                    user.mentorLimit > 0 && user.assignedCount >= user.mentorLimit
                                      ? "destructive"
                                      : "success"
                                  }
                                  className="cursor-default"
                                >
                                  {user.assignedCount} / {user.mentorLimit || "∞"}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  {user.assignedMentees.map(m => m.employeeName).filter(Boolean).join(", ")}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} title="Edit">
                          <IconPencil className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      {isMentorRole && canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveFromMentor(user)} title="Remove from Mentor">
                          <IconUserMinus className="w-4 h-4 text-amber-600" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user)} title="Delete">
                          <IconTrash className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {usersData?.data?.totalPages > 1 && (
        <div className="flex justify-between items-center px-2">
          <p className="text-sm text-muted-foreground">
            Page {usersData?.data?.currentPage || currentPage} of {usersData?.data?.totalPages} ({usersData?.data?.totalUsers} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === usersData?.data?.totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New {roleName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input id="fullName" value={formData.fullName} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empId">Employee Code *</Label>
              <Input id="empId" value={formData.empId} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address *</Label>
              <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Mobile No. *</Label>
              <Input id="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={formData.designation} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(val) => setFormData(prev => ({ ...prev, gender: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.departmentId} onValueChange={(val) => setFormData(prev => ({ ...prev, departmentId: val, sectionId: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent>
                  {deptRes?.data?.departments?.map(dept => (
                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={formData.sectionId} onValueChange={(val) => setFormData(prev => ({ ...prev, sectionId: val }))} disabled={!formData.departmentId}>
                <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                <SelectContent>
                  {sectionRes?.data?.map(sec => (
                    <SelectItem key={sec.id} value={String(sec.id)}>{sec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMentorRole && (
              <div className="space-y-2">
                <Label htmlFor="mentorLimit">Mentor Limit (Max Mentees)</Label>
                <Input
                  id="mentorLimit"
                  type="number"
                  min="0"
                  value={formData.mentorLimit}
                  onChange={handleInputChange}
                />
              </div>
            )}
            {isMentorRole && (
              <div className="space-y-2 flex items-center gap-2 pt-6">
                <Checkbox
                  id="isEmployee"
                  checked={formData.isEmployee}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEmployee: !!checked }))}
                />
                <Label htmlFor="isEmployee" className="font-normal cursor-pointer">
                  Also create as Operator (isEmployee)
                </Label>
              </div>
            )}
            <div className="space-y-2 col-span-2">
              <Label htmlFor="userName">Username *</Label>
              <Input id="userName" value={formData.userName} onChange={handleInputChange} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={formData.password} onChange={handleInputChange} placeholder="Password for login" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={isSubmitting}>
              {isSubmitting && <IconLoader className="w-4 h-4 mr-2 animate-spin" />}
              Create {roleName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {roleName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Same fields as Add Dialog without password */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={formData.fullName} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empId">Employee Code</Label>
              <Input id="empId" value={formData.empId} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" value={formData.email} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Mobile No.</Label>
              <Input id="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={formData.designation} onChange={handleInputChange} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(val) => setFormData(prev => ({ ...prev, gender: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.departmentId} onValueChange={(val) => setFormData(prev => ({ ...prev, departmentId: val, sectionId: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent>
                  {deptRes?.data?.departments?.map(dept => (
                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={formData.sectionId} onValueChange={(val) => setFormData(prev => ({ ...prev, sectionId: val }))} disabled={!formData.departmentId}>
                <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                <SelectContent>
                  {sectionRes?.data?.map(sec => (
                    <SelectItem key={sec.id} value={String(sec.id)}>{sec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMentorRole && (
              <div className="space-y-2">
                <Label htmlFor="mentorLimit">Mentor Limit (Max Mentees)</Label>
                <Input
                  id="mentorLimit"
                  type="number"
                  min="0"
                  value={formData.mentorLimit}
                  onChange={handleInputChange}
                />
              </div>
            )}
            {isMentorRole && (
              <div className="space-y-2 flex items-center gap-2 pt-6">
                <Checkbox
                  id="isEmployee"
                  checked={formData.isEmployee}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEmployee: !!checked }))}
                />
                <Label htmlFor="isEmployee" className="font-normal cursor-pointer">
                  Also set as Operator (isEmployee)
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={isSubmitting}>
              {isSubmitting && <IconLoader className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isMentorRole && (
        <AssignMentorDialog
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          onAssigned={refetch}
        />
      )}
    </div>
  );
};

export default RoleBasedUserManagement;
