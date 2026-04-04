import React, { useState, useEffect } from "react";
import {
  useUpdateUserMutation,
  useDeleteUserMutation,
} from "@/Redux/AllApi/UserApi";
import { useUserRegisterMutation } from "@/Redux/AllApi/AuthApi";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
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
} from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SearchInput from "@/components/common/SearchInput";

const RoleBasedUserManagement = ({ roleName, roleField, useQueryHook }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    [roleField]: true
  });

  // API Hooks
  const { data: usersData, isLoading, isFetching, refetch } = useQueryHook({
    page: currentPage,
    limit: 10,
    search: searchTerm,
  });

  const [registerUser] = useUserRegisterMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const { data: deptRes } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
  const { data: sectionRes } = useGetSectionsByDepartmentQuery(
    { departmentId: formData.departmentId, page: 1, limit: 100 },
    { skip: !formData.departmentId }
  );

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
      await registerUser({ ...formData, role: "STUDENT" }).unwrap();
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
      await updateUser({ id: selectedUser._id, ...formData }).unwrap();
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
      departmentId: user.department?._id || "",
      sectionId: user.sectionId || "",
      gender: user.gender || "MALE",
      password: "",
      userName: user.userName || "",
      unit: user.unit || "UNIT_1",
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
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
          <IconPlus className="w-4 h-4 mr-2" />
          Add {roleName}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-sm">
              <SearchInput
                placeholder={`Search ${roleName.toLowerCase()}s...`}
                value={searchTerm}
                onChange={(val) => setSearchTerm(val)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <IconRefresh className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Emp ID</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <IconLoader className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  </TableCell>
                </TableRow>
              ) : usersData?.data?.users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                    No {roleName.toLowerCase()}s found.
                  </TableCell>
                </TableRow>
              ) : (
                usersData?.data?.users?.map((user) => (
                  <TableRow key={user._id}>
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
                    <TableCell>{user.designation || "N/A"}</TableCell>
                    <TableCell>{user.department?.name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === "PRESENT" ? "success" : "secondary"}>
                        {user.status || "PRESENT"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                        <IconPencil className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user)}>
                        <IconTrash className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                  {sectionRes?.data?.sections?.map(sec => (
                    <SelectItem key={sec.id} value={String(sec.id)}>{sec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  {sectionRes?.data?.sections?.map(sec => (
                    <SelectItem key={sec.id} value={String(sec.id)}>{sec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
};

export default RoleBasedUserManagement;
