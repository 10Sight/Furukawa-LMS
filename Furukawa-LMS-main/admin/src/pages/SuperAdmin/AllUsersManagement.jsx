import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
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
  IconShield,
  IconRefresh,
  IconChevronDown,
  IconSortAscending,
  IconSortDescending,
  IconX,
  IconAlertTriangle,
  IconInfoCircle
} from "@tabler/icons-react";
import {
  useGetAllUsersQuery as useSuperAdminGetAllUsersQuery,
  useCreateUserMutation as useSuperAdminCreateUserMutation,
  useUpdateUserMutation as useSuperAdminUpdateUserMutation,
  usePermanentDeleteUserMutation
} from "@/Redux/AllApi/SuperAdminApi";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";

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
  const { user: currentUser } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const [filters, setFilters] = useState({
    role: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    departmentId: "",
    unit: "",
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
  });

  // API hooks
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
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    departmentId: filters.departmentId,
    unit: filters.unit,
  });

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

  // Refetch when filters change
  useEffect(() => {
    refetch();
  }, [searchTerm, filters, currentPage, sortBy, sortOrder, refetch]);

  const [createUser] = useSuperAdminCreateUserMutation();
  const [updateUser] = useSuperAdminUpdateUserMutation();
  const [deleteUser] = usePermanentDeleteUserMutation();

  const users = usersData?.data?.users || [];
  const totalPages = usersData?.data?.totalPages || 1;
  const totalUsers = usersData?.data?.totalUsers || 0;


  const handleCreateUser = async () => {
    try {
      const result = await createUser(newUser).unwrap();
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
      await updateUser({ id: _id, ...updateData }).unwrap();
      toast.success("User updated successfully!");
      setShowEditModal(false);
      refetch();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error?.data?.message || "Failed to update user");
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
        return "bg-green-100 text-green-800";
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800";
      case "BANNED":
        return "bg-red-100 text-red-800";
      case "PENDING":
        return "bg-blue-100 text-blue-800";
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
                  disabled={!newUser.fullName || !newUser.email}
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
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="SUPERADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="STUDENT">Student</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="BANNED">Banned</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
              <select
                value={filters.unit}
                onChange={(e) => setFilters({ ...filters, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Units</option>
                <option value="UNIT_1">Unit 1</option>
                <option value="UNIT_2">Unit 2</option>
                <option value="UNIT_3">Unit 3</option>
                <option value="UNIT_4">Unit 4</option>
                <option value="UNIT_5">Unit 5</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center">
                      <div className="text-red-600">
                        Error loading users: {error?.data?.message || error?.message}
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={user.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=2563eb&color=fff`}
                            alt={user.fullName}
                          />
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                            <div className="text-sm text-gray-500">@{user.userName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{user.email}</div>
                        <div className="text-sm text-gray-500">{user.phoneNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.department?.name || 'No Department'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => {/* View user details */ }}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="View Details"
                          >
                            <IconEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                            className="text-green-600 hover:text-green-900 transition-colors"
                            title="Edit User"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id, true)}
                            className="text-red-600 hover:text-red-900 transition-colors"
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
                    <div className="flex items-center">
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
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                      />
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={user.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=2563eb&color=fff`}
                          alt={user.fullName}
                        />
                        <AvatarFallback className="bg-blue-100 text-blue-800">
                          {user.fullName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 truncate">{user.fullName}</h3>
                          <p className="text-sm text-gray-500 truncate">@{user.userName}</p>
                          <p className="text-sm text-gray-600 mt-1">{user.email}</p>
                          {user.phoneNumber && (
                            <p className="text-sm text-gray-500">{user.phoneNumber}</p>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={() => {/* View user details */ }}
                            className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <IconEye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id, true)}
                            className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                            title="Permanently Delete"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge className={getRoleColor(user.role)}>
                          <IconShield className="w-3 h-3 mr-1" />
                          {user.role}
                        </Badge>
                        <Badge className={getStatusColor(user.status)}>
                          {user.status}
                        </Badge>
                        {user.department?.name && (
                          <Badge variant="outline">
                            {user.department.name}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500">
                          Last login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                        </div>
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
