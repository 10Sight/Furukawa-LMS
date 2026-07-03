import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FormSelect } from "@/components/form/FormSelect";
import {
    useGetAllUsersQuery,
    useUpdateUserMutation,
    useDeleteUserMutation
} from "@/Redux/AllApi/UserApi";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    useGetAllDepartmentsQuery,
} from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesBySubSectionQuery } from "@/Redux/AllApi/MachineApi";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Users, Search, RefreshCw, Trash2, Edit2, UserPlus, ChevronLeft, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";

export default function RoleUserManager() {
    const { roleId } = useParams();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [role, setRole] = useState(null);
    const [page, setPage] = useState(1);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [addTab, setAddTab] = useState("existing");
    const [searchExisting, setSearchExisting] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState([]);
    const [isAllSelectedAcrossPages, setIsAllSelectedAcrossPages] = useState(false);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);

    // Fetch Role Details
    useEffect(() => {
        const fetchRole = async () => {
            try {
                const res = await axiosInstance.get(`/api/roles-permissions`);
                const roleData = res.data.data.roles.find(r => String(r.id) === String(roleId));
                setRole(roleData);
            } catch (e) {
                toast.error("Failed to fetch role details");
            }
        };
        fetchRole();
    }, [roleId]);

    // Fetch Users for this role
    const {
        data,
        isLoading,
        isFetching,
        refetch
    } = useGetAllUsersQuery({
        page,
        limit: 20,
        customRoleId: roleId,
        search: searchTerm,
        excludeRoles: "ADMIN,SUPERADMIN",
        roleManagerFilters: "true",
        includeLeft: "true"
    });

    const { data: allDeptsRes } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
    const allDepts = allDeptsRes?.data?.departments || [];

    const getDeptNames = (user) => {
        const rawDepts = typeof user.departments === 'string'
            ? JSON.parse(user.departments || "[]")
            : (user.departments || []);
        // departments: [] is authoritative — only fall back when field was never set
        const departmentsFieldSet = user.departments !== undefined && user.departments !== null;
        if (Array.isArray(rawDepts) && rawDepts.length > 0 && allDepts.length > 0) {
            const names = rawDepts.map(id => {
                const d = allDepts.find(dept => String(dept.id || dept._id) === String(id));
                return d ? d.name : null;
            }).filter(Boolean);
            if (names.length > 0) return names;
        }
        if (!departmentsFieldSet) {
            if (Array.isArray(user.assignments) && user.assignments.length > 0) {
                const names = [...new Set(user.assignments.map(a => a.deptName).filter(n => n && n.toLowerCase() !== "none"))];
                if (names.length > 0) return names;
            }
            if (user.deptName && user.deptName.toLowerCase() !== "none") return [user.deptName];
        }
        return [];
    };

    const getSectionNames = (user) => {
        if (Array.isArray(user.assignments) && user.assignments.length > 0) {
            const names = [...new Set(user.assignments.map(a => a.sectionName).filter(n => n && n.toLowerCase() !== "none"))];
            if (names.length > 0) return names;
        }
        return (user.sectionName && user.sectionName.toLowerCase() !== "none") ? [user.sectionName] : [];
    };

    const [deleteUser] = useDeleteUserMutation();

    const handleDelete = async (user) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${user.fullName}? This action cannot be undone and will remove the user's account from the entire system.`)) return;
        try {
            await deleteUser(user.id).unwrap();
            toast.success("User deleted permanently");
            refetch();
            setSelectedIds(prev => prev.filter(id => id !== user.id));
        } catch (e) {
            toast.error(e?.data?.message || "Failed to delete user");
        }
    };

    const handleBulkDelete = async () => {
        setIsSubmitting(true);
        try {
            await Promise.all(
                selectedIds.map(id => deleteUser(id).unwrap())
            );
            toast.success(`${selectedIds.length} users deleted permanently`);
            setSelectedIds([]);
            setIsAllSelectedAcrossPages(false);
            setIsBulkDeleteOpen(false);
            refetch();
        } catch (error) {
            console.error("Bulk delete error:", error);
            toast.error("Failed to delete some users");
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalUsersCount = data?.data?.totalUsers || 0;
    const currentUsers = data?.data?.users || [];
    const isAllSelectedOnPage = currentUsers.length > 0 && currentUsers.every(u => selectedIds.includes(u.id));
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < totalUsersCount && !isAllSelectedOnPage;

    const handleSelectAllOnPage = (checked) => {
        if (checked) {
            const pageIds = currentUsers.map(u => u.id);
            const newSelected = [...new Set([...selectedIds, ...pageIds])];
            setSelectedIds(newSelected);
        } else {
            const pageIds = currentUsers.map(u => u.id);
            setSelectedIds(selectedIds.filter(id => !pageIds.includes(id)));
            setIsAllSelectedAcrossPages(false);
        }
    };

    const handleSelectUser = (id, checked) => {
        if (checked) {
            setSelectedIds([...selectedIds, id]);
        } else {
            setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
            setIsAllSelectedAcrossPages(false);
        }
    };

    if (!role && !isLoading) return (
        <div className="p-10 text-center">
            <h2 className="text-xl font-bold">Role Not Found</h2>
            <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">Manage {role?.name || "Role"} Users</h1>
                        {role && (
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                        )}
                    </div>
                    <p className="text-sm text-gray-500">{role?.description || "Manage users assigned to this custom role"}</p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 mr-2">
                            <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full border">
                                {selectedIds.length} selected
                            </span>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setIsBulkDeleteOpen(true)}
                                className="shadow-sm"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Selected
                            </Button>
                        </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setIsAddUserOpen(true)}
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add User
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="border-b bg-gray-50/50 py-4">
                    <div className="flex items-center justify-between">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search users..."
                                className="pl-9 bg-white"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="text-sm text-gray-500 font-medium">
                            {data?.data?.totalUsers || 0} Users Found
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead className="w-12 text-center">
                                    <Checkbox
                                        checked={isAllSelectedAcrossPages || isAllSelectedOnPage || (isIndeterminate ? "indeterminate" : false)}
                                        onCheckedChange={handleSelectAllOnPage}
                                        aria-label="Select all on page"
                                        className={isIndeterminate ? "bg-blue-500 border-blue-500" : ""}
                                    />
                                </TableHead>
                                <TableHead className="w-[300px]">User Info</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Hierarchy</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><div className="h-4 w-4 bg-gray-100 animate-pulse rounded" /></TableCell>
                                        <TableCell><div className="h-10 w-40 bg-gray-100 animate-pulse rounded" /></TableCell>
                                        <TableCell><div className="h-10 w-40 bg-gray-100 animate-pulse rounded" /></TableCell>
                                        <TableCell><div className="h-10 w-20 bg-gray-100 animate-pulse rounded" /></TableCell>
                                        <TableCell><div className="h-10 w-30 bg-gray-100 animate-pulse rounded" /></TableCell>
                                        <TableCell><div className="h-10 w-20 bg-gray-100 animate-pulse rounded ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : data?.data?.users?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium">No users assigned to this role</p>
                                        <p className="text-sm text-gray-400 mt-1">Users can be assigned to this role through the user management page</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data?.data?.users?.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-gray-50/50">
                                        <TableCell className="text-center cursor-pointer" onClick={(e) => { e.stopPropagation(); handleSelectUser(user.id, !selectedIds.includes(user.id)); }}>
                                            <Checkbox
                                                checked={selectedIds.includes(user.id)}
                                                onCheckedChange={(checked) => handleSelectUser(user.id, checked)}
                                                aria-label={`Select ${user.fullName}`}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="w-9 h-9 border">
                                                    <AvatarImage src={user.avatar?.url} />
                                                    <AvatarFallback>{user.fullName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900">{user.fullName}</span>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>@{user.userName}</span>
                                                        {user.empId && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                                <span className="font-medium">Emp: {user.empId}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600">{user.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.status === "PRESENT" ? "success" : "secondary"} className="font-medium">
                                                {user.status || "Unknown"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {(() => {
                                                const deptNames = getDeptNames(user);
                                                const sectionNames = getSectionNames(user);
                                                if (deptNames.length === 0 && sectionNames.length === 0) return <span className="text-gray-400 italic">Unassigned</span>;
                                                return (
                                                    <div className="flex flex-col gap-1">
                                                        {deptNames.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {deptNames.map((name, idx) => (
                                                                    <span key={idx} className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded">
                                                                        {name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {sectionNames.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {sectionNames.map((name, idx) => (
                                                                    <span key={idx} className="text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded">
                                                                        {name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <span className="text-xs text-gray-500">
                                                            {[user.lineName, user.subSectionName, user.stationName]
                                                                .filter(val => val && val.toLowerCase() !== "none").join(" ➔ ") || ""}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-right px-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => navigate(`/admin/employees/${user.slug || user.id}`)}
                                                    title="View Profile"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                    onClick={() => {
                                                        setUserToEdit(user);
                                                        setIsEditUserOpen(true);
                                                    }}
                                                    title="Edit User"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(user)}
                                                    title="Delete User Permanently"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                {/* Pagination */}
                {data?.data?.totalPages > 1 && (
                    <div className="px-6 py-4 border-t bg-gray-50/30 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, data?.data?.totalUsers)} of {data?.data?.totalUsers} users
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 px-3"
                            >
                                Previous
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, data?.data?.totalPages) }, (_, i) => {
                                    let pageNum;
                                    const totalPages = data?.data?.totalPages;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = page - 2 + i;

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={page === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPage(pageNum)}
                                            className="w-8 h-8 p-0"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(data?.data?.totalPages, p + 1))}
                                disabled={page === data?.data?.totalPages}
                                className="h-8 px-3"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <AddUserDialog
                isOpen={isAddUserOpen}
                setIsOpen={setIsAddUserOpen}
                role={role}
                onSuccess={() => {
                    refetch();
                    setIsAddUserOpen(false);
                }}
            />

            <EditUserDialog
                isOpen={isEditUserOpen}
                setIsOpen={setIsEditUserOpen}
                user={userToEdit}
                currentRoleId={roleId}
                onSuccess={() => {
                    refetch();
                    setIsEditUserOpen(false);
                    setUserToEdit(null);
                }}
            />

            {/* Bulk Delete Dialog */}
            <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="p-2 bg-red-100 text-red-600 rounded-full">
                                <Trash2 className="w-5 h-5" />
                            </span>
                            Bulk Delete Users
                        </DialogTitle>
                        <DialogDescription className="pt-4 text-red-600 font-medium">
                            CAUTION: This will PERMANENTLY DELETE the <strong>{selectedIds.length}</strong> selected users from the system.
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setIsBulkDeleteOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                            ) : (
                                "Yes, Delete Permanently"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AddUserDialog({ isOpen, setIsOpen, role, onSuccess }) {
    const { user: currentUser } = useSelector((state) => state.auth);
    const isRegularAdmin = currentUser?.role === 'ADMIN' && !currentUser?.isAdmin;
    // Wait, in this system isAdmin is the flag for regular admin layout access often, 
    // but SUPERADMIN has role='SUPERADMIN'.
    // Let's check the logic: 
    // if role is SUPERADMIN, they should see both. 
    // if role is ADMIN, they should only see "new".

    const showExistingTab = currentUser?.role === 'SUPERADMIN';
    const [activeTab, setActiveTab] = useState(showExistingTab ? "existing" : "new");

    // Force tab if restricted
    useEffect(() => {
        if (!showExistingTab && activeTab !== "new") {
            setActiveTab("new");
        }
    }, [activeTab, showExistingTab]);

    const [search, setSearch] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [setAsPrimary, setSetAsPrimary] = useState(false);
    const [newUser, setNewUser] = useState({
        fullName: "",
        userName: "",
        email: "",
        phoneNumber: "",
        password: "",
        empId: "",
        unit: "UNIT_1",
        shift: "",
        idCard: "",
        joiningDate: "",
        status: "PRESENT",
        departments: [],
        sections: [],
        lines: [],
        subSections: [],
        stations: [],
        gender: "MALE",
        dob: "",
        education: "",
        district: "",
        state: "",
        pin: "",
        busRoute: "",
    });

    // Hierarchy Queries
    const { data: deptRes } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
    const { data: sectionRes } = useGetSectionsByDepartmentQuery(
        newUser.departments.join(","),
        { skip: !newUser.departments.length }
    );
    const { data: lineRes } = useGetLinesBySectionQuery(
        newUser.sections.join(","),
        { skip: !newUser.sections.length }
    );
    const { data: subSectionRes } = useGetSubSectionsByLineQuery(
        newUser.lines.join(","),
        { skip: !newUser.lines.length }
    );
    const { data: machineRes } = useGetMachinesBySubSectionQuery(
        newUser.subSections.join(","),
        { skip: !newUser.subSections.length }
    );

    // Fetch potential users (not already in this role)
    const { data: usersRes, isLoading } = useGetAllUsersQuery({
        page: 1,
        limit: 10,
        search: search,
        // We'll filter on frontend for now or just rely on search
    }, { skip: !isOpen || activeTab !== "existing" });

    const handleAssign = async (userId) => {
        setIsProcessing(true);
        try {
            await axiosInstance.post(`/api/roles-permissions/custom-roles/${role.id}/assign`, {
                userId,
                setAsPrimary
            });
            toast.success("User assigned successfully");
            onSuccess();
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to assign user");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreate = async () => {
        if (!newUser.fullName || !newUser.email || !newUser.userName || !newUser.phoneNumber) {
            return toast.error("Please fill all required fields (Full Name, Email, Username, Phone Number)");
        }
        setIsProcessing(true);
        try {
            // Use same endpoint as general registration but with customRoleId
            await axiosInstance.post(`/api/v1/auth/register`, {
                ...newUser,
                password: newUser.password || newUser.empId || "123456",
                role: "CUSTOM",
                customRoleId: role.id,
                setAsPrimary,
                unit: newUser.unit,
                shift: newUser.shift,
                idCard: newUser.idCard,
                joiningDate: newUser.joiningDate,
                status: newUser.status,
                departments: newUser.departments,
                stations: newUser.stations,
                sections: newUser.sections,
                lines: newUser.lines,
                subSections: newUser.subSections,
                sectionId: newUser.sections[0] || null,
                subSectionId: newUser.subSections[0] || null,
                lineId: newUser.lines[0] || null,
                gender: newUser.gender,
                dob: newUser.dob,
                education: newUser.education,
                district: newUser.district,
                state: newUser.state,
                pin: newUser.pin,
                busRoute: newUser.busRoute
            });
            toast.success("User created and assigned successfully");
            onSuccess();
            setNewUser({
                fullName: "",
                userName: "",
                email: "",
                phoneNumber: "",
                password: "",
                empId: "",
                unit: "UNIT_1",
                shift: "",
                idCard: "",
                joiningDate: "",
                status: "PRESENT",
                departments: [],
                sections: [],
                lines: [],
                subSections: [],
                stations: [],
                gender: "MALE",
                dob: "",
                education: "",
                district: "",
                state: "",
                pin: "",
                busRoute: "",
            });
        } catch (e) {
            toast.error(e.response?.data?.message || "Failed to create user");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-none max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle>Add User to {role?.name}</DialogTitle>
                    <DialogDescription>
                        Assign an existing user or create a new one with this role.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex items-center justify-between py-4">
                        <TabsList className={`grid ${showExistingTab ? "w-40 grid-cols-2" : "w-20 grid-cols-1"} h-8`}>
                            {showExistingTab && <TabsTrigger value="existing" className="text-xs">Existing</TabsTrigger>}
                            <TabsTrigger value="new" className="text-xs">New</TabsTrigger>
                        </TabsList>

                        <div className="flex items-center space-x-2 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <Checkbox
                                id="set-primary"
                                checked={setAsPrimary}
                                onCheckedChange={setSetAsPrimary}
                            />
                            <Label htmlFor="set-primary" className="text-xs font-semibold text-blue-700 cursor-pointer select-none">
                                Set as Primary Role
                            </Label>
                        </div>
                    </div>

                    <TabsContent value="existing" className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search users..."
                                className="pl-9"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                            {isLoading ? (
                                <div className="text-center py-4">Loading...</div>
                            ) : usersRes?.data?.users?.filter(u => u.customRoleId !== role.id).length === 0 ? (
                                <div className="text-center py-4 text-gray-500">No users found</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {usersRes?.data?.users?.filter(u => u.customRoleId !== role.id).map(user => (
                                        <div key={user.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-white bg-gray-50/50 transition-colors shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="w-10 h-10 border bg-white">
                                                    <AvatarFallback className="text-blue-600 bg-blue-50 font-semibold">{user.fullName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-gray-900 line-clamp-1 break-all">{user.fullName}</span>
                                                    <span className="text-[10px] text-gray-500 line-clamp-1 break-all tracking-tight -mt-0.5">@{user.userName}</span>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                                                onClick={() => handleAssign(user.id)}
                                                disabled={isProcessing}
                                            >
                                                Assign
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="new">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">

                            {/* Column 1: Core Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2"></span>
                                    Core Identity
                                </h3>
                                <div className="space-y-3 p-4 border rounded-xl bg-white shadow-sm">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="fullName" className="text-xs font-semibold text-gray-600">Full Name *</Label>
                                        <Input id="fullName" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="userName" className="text-xs font-semibold text-gray-600">Username *</Label>
                                            <Input id="userName" value={newUser.userName} onChange={e => setNewUser({ ...newUser, userName: e.target.value })} className="h-9 focus-visible:ring-1" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="gender" className="text-xs font-semibold text-gray-600">Gender</Label>
                                            <Select value={newUser.gender} onValueChange={(v) => setNewUser({ ...newUser, gender: v })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Gender" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MALE">Male</SelectItem>
                                                    <SelectItem value="FEMALE">Female</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="email" className="text-xs font-semibold text-gray-600">Email Address *</Label>
                                        <Input id="email" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="phoneNumber" className="text-xs font-semibold text-gray-600">Phone Number *</Label>
                                        <Input id="phoneNumber" value={newUser.phoneNumber} onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="dob" className="text-xs font-semibold text-gray-600">Date of Birth</Label>
                                        <Input id="dob" type="date" value={newUser.dob} onChange={(e) => setNewUser({ ...newUser, dob: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="password" className="text-xs font-semibold text-gray-600">Password</Label>
                                        <Input id="password" type="password" placeholder="Defaults to Emp ID" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Employment Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-100 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-2"></span>
                                    Employment Data
                                </h3>
                                <div className="space-y-3 p-4 border rounded-xl bg-white shadow-sm">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="empId" className="text-xs font-semibold text-gray-600">Employee ID</Label>
                                            <Input id="empId" value={newUser.empId} onChange={e => setNewUser({ ...newUser, empId: e.target.value, password: newUser.password || e.target.value })} className="h-9 focus-visible:ring-1" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="idCard" className="text-xs font-semibold text-gray-600">ID Card No.</Label>
                                            <Input id="idCard" value={newUser.idCard} onChange={e => setNewUser({ ...newUser, idCard: e.target.value })} className="h-9 focus-visible:ring-1" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-semibold text-gray-600">Status</Label>
                                            <Select value={newUser.status} onValueChange={val => setNewUser({ ...newUser, status: val })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Select Status" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="PRESENT">Present</SelectItem>
                                                    <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                                                    <SelectItem value="LEFT">Left</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-semibold text-gray-600">Unit</Label>
                                            <Select value={newUser.unit} onValueChange={val => setNewUser({ ...newUser, unit: val })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Select Unit" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="UNIT_1">Unit 1</SelectItem>
                                                    <SelectItem value="UNIT_2">Unit 2</SelectItem>
                                                    <SelectItem value="UNIT_3">Unit 3</SelectItem>
                                                    <SelectItem value="UNIT_4">Unit 4</SelectItem>
                                                    <SelectItem value="UNIT_5">Unit 5</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="shift" className="text-xs font-semibold text-gray-600">Shift</Label>
                                        <Input id="shift" placeholder="e.g. Day, Night" value={newUser.shift} onChange={e => setNewUser({ ...newUser, shift: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="joiningDate" className="text-xs font-semibold text-gray-600">Joining Date</Label>
                                        <Input id="joiningDate" type="date" value={newUser.joiningDate} onChange={e => setNewUser({ ...newUser, joiningDate: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="education" className="text-xs font-semibold text-gray-600">Highest Education</Label>
                                        <Input id="education" value={newUser.education} onChange={(e) => setNewUser({ ...newUser, education: e.target.value })} className="h-9 focus-visible:ring-1" />
                                    </div>
                                </div>
                            </div>

                            {/* Hierarchy Assignment - Full Width */}
                            <div className="md:col-span-2 space-y-4 pt-2">
                                <h3 className="text-sm font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md">Hierarchy Assignment</h3>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                                    <div className="grid gap-1.5 min-w-0">
                                        <Label className="text-xs font-semibold text-gray-600">Department</Label>
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
                                            options={(deptRes?.data?.departments || []).map(dept => ({ value: String(dept.id), label: dept.name }))}
                                        />
                                    </div>
                                    <div className="grid gap-1.5 min-w-0">
                                        <Label className="text-xs font-semibold text-gray-600">Section</Label>
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
                                            options={(sectionRes?.data || []).map(sec => ({ value: String(sec.id), label: sec.name }))}
                                            disabled={!newUser.departments.length}
                                        />
                                    </div>
                                    <div className="grid gap-1.5 min-w-0">
                                        <Label className="text-xs font-semibold text-gray-600">Line</Label>
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
                                            options={(lineRes?.data || []).map(line => ({ value: String(line.id), label: line.name }))}
                                            disabled={!newUser.sections.length}
                                        />
                                    </div>
                                    <div className="grid gap-1.5 min-w-0">
                                        <Label className="text-xs font-semibold text-gray-600">Sub-Section</Label>
                                        <FormSelect
                                            multiple={true}
                                            placeholder="Select Sub-sections"
                                            value={newUser.subSections}
                                            onValueChange={(values) => setNewUser({
                                                ...newUser,
                                                subSections: values,
                                                stations: []
                                            })}
                                            options={(subSectionRes?.data || []).map(sub => ({ value: String(sub.id), label: sub.name }))}
                                            disabled={!newUser.lines.length}
                                        />
                                    </div>
                                    <div className="grid gap-1.5 min-w-0">
                                        <Label className="text-xs font-semibold text-gray-600">Station (Machine)</Label>
                                        <FormSelect
                                            multiple={true}
                                            placeholder="Select Stations"
                                            value={newUser.stations}
                                            onValueChange={(values) => setNewUser({
                                                ...newUser,
                                                stations: values
                                            })}
                                            options={(machineRes?.data || []).map(mac => ({ value: String(mac.id), label: mac.name }))}
                                            disabled={!newUser.subSections.length}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    {activeTab === "new" && (
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                            onClick={handleCreate}
                            disabled={isProcessing}
                        >
                            {isProcessing ? "Creating..." : "Create & Assign"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditUserDialog({ isOpen, setIsOpen, user, currentRoleId, onSuccess }) {
    const [updateUser] = useUpdateUserMutation();
    const [isProcessing, setIsProcessing] = useState(false);
    const [editUser, setEditUser] = useState({
        fullName: "",
        userName: "",
        empId: "",
        email: "",
        phoneNumber: "",
        role: "",
        customRoleId: "",
        status: "",
        departments: [],
        sections: [],
        lines: [],
        subSections: [],
        stations: []
    });

    const [customRoles, setCustomRoles] = useState([]);

    useEffect(() => {
        const fetchCustomRoles = async () => {
            try {
                const res = await axiosInstance.get("/api/roles-permissions");
                setCustomRoles(res.data.data.roles || []);
            } catch (e) {
                console.error("Failed to fetch custom roles", e);
            }
        };
        if (isOpen) fetchCustomRoles();
    }, [isOpen]);

    useEffect(() => {
        if (user && isOpen) {
            const rawDepts = typeof user.departments === 'string' ? JSON.parse(user.departments || "[]") : (user.departments || []);
            const deptsFieldSet = user.departments !== undefined && user.departments !== null;
            const resolvedDepts = Array.isArray(rawDepts) && rawDepts.length > 0
                ? rawDepts.map(String)
                : (!deptsFieldSet && (user.departmentId || user.DepartmentId)) ? [String(user.departmentId || user.DepartmentId)]
                : (!deptsFieldSet && user.department?._id) ? [String(user.department._id)]
                : [];

            const rawStations = typeof user.stations === 'string' ? JSON.parse(user.stations || "[]") : (user.stations || []);
            const stationsFieldSet = user.stations !== undefined && user.stations !== null;
            const resolvedStations = Array.isArray(rawStations) && rawStations.length > 0
                ? rawStations.map(String)
                : (!stationsFieldSet && (user.stationId || user.StationId)) ? [String(user.stationId || user.StationId)]
                : [];

            const rawSections = typeof user.sections === 'string' ? JSON.parse(user.sections || "[]") : (user.sections || []);
            const sectionsFieldSet = user.sections !== undefined && user.sections !== null;
            const resolvedSections = Array.isArray(rawSections) && rawSections.length > 0
                ? rawSections.map(String)
                : (!sectionsFieldSet && user.sectionId) ? [String(user.sectionId)]
                : [];

            const rawLines = typeof user.lines === 'string' ? JSON.parse(user.lines || "[]") : (user.lines || []);
            const linesFieldSet = user.lines !== undefined && user.lines !== null;
            const resolvedLines = Array.isArray(rawLines) && rawLines.length > 0
                ? rawLines.map(String)
                : (!linesFieldSet && user.lineId) ? [String(user.lineId)]
                : [];

            const rawSubSections = typeof user.subSections === 'string' ? JSON.parse(user.subSections || "[]") : (user.subSections || []);
            const subSectionsFieldSet = user.subSections !== undefined && user.subSections !== null;
            const resolvedSubSections = Array.isArray(rawSubSections) && rawSubSections.length > 0
                ? rawSubSections.map(String)
                : (!subSectionsFieldSet && user.subSectionId) ? [String(user.subSectionId)]
                : [];

            setEditUser({
                fullName: user.fullName || "",
                userName: user.userName || "",
                empId: user.empId || "",
                email: user.email || "",
                phoneNumber: user.phoneNumber || "",
                role: user.role || "STUDENT",
                customRoleId: user.customRoleId ? String(user.customRoleId) : "none",
                status: user.systemStatus || user.status || "PRESENT",
                departments: resolvedDepts,
                sections: resolvedSections,
                lines: resolvedLines,
                subSections: resolvedSubSections,
                stations: resolvedStations
            });
        }
    }, [user, isOpen]);

    // Hierarchy Queries
    const { data: deptRes } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
    const { data: sectionRes } = useGetSectionsByDepartmentQuery(
        editUser.departments.join(","),
        { skip: !editUser.departments.length }
    );
    const { data: lineRes } = useGetLinesBySectionQuery(
        editUser.sections.join(","),
        { skip: !editUser.sections.length }
    );
    const { data: subSectionRes } = useGetSubSectionsByLineQuery(
        editUser.lines.join(","),
        { skip: !editUser.lines.length }
    );
    const { data: machineRes } = useGetMachinesBySubSectionQuery(
        editUser.subSections.join(","),
        { skip: !editUser.subSections.length }
    );

    const handleSave = async () => {
        if (!editUser.fullName || !editUser.email) {
            return toast.error("Full Name and Email are required");
        }
        setIsProcessing(true);
        try {
            const payload = {
                ...editUser,
                customRoleId: editUser.customRoleId === "none" ? null : editUser.customRoleId,
                departments: editUser.departments,
                stations: editUser.stations,
                sections: editUser.sections,
                lines: editUser.lines,
                subSections: editUser.subSections,
                sectionId: editUser.sections[0] || null,
                subSectionId: editUser.subSections[0] || null,
                lineId: editUser.lines[0] || null
            };
            await updateUser({ id: user.id || user._id, ...payload }).unwrap();
            toast.success("User updated successfully");
            onSuccess();
        } catch (e) {
            toast.error(e?.data?.message || "Failed to update user");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-none max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b">
                    <DialogTitle>Edit User: {user?.fullName}</DialogTitle>
                    <DialogDescription>
                        Update user profile and assignments.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md">Basic Information</h3>
                        <div className="space-y-3">
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Full Name</Label>
                                <Input value={editUser.fullName} onChange={e => setEditUser({ ...editUser, fullName: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Username</Label>
                                <Input value={editUser.userName} onChange={e => setEditUser({ ...editUser, userName: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Employee ID</Label>
                                <Input value={editUser.empId} onChange={e => setEditUser({ ...editUser, empId: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Email</Label>
                                <Input value={editUser.email} onChange={e => setEditUser({ ...editUser, email: e.target.value })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Phone Number</Label>
                                <Input value={editUser.phoneNumber} onChange={e => setEditUser({ ...editUser, phoneNumber: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* Roles & Status */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-md">Roles & Status</h3>
                        <div className="space-y-3">
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">System Role</Label>
                                <Select value={editUser.role} onValueChange={val => setEditUser({ ...editUser, role: val })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {/* Show current role, Operator (STUDENT), and Custom Role User (CUSTOM) */}
                                        <SelectItem value="CUSTOM">Custom Role User</SelectItem>
                                        <SelectItem value="STUDENT">Operator (Student)</SelectItem>
                                        {user && user.role !== "CUSTOM" && user.role !== "STUDENT" && (
                                            <SelectItem value={user.role}>{user.role}</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Custom Role</Label>
                                <Select value={editUser.customRoleId} onValueChange={val => setEditUser({ ...editUser, customRoleId: val })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None (Remove from Role)</SelectItem>
                                        {customRoles.filter(r => !r.isSystemRole).map(r => (
                                            <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Status</Label>
                                <Select value={editUser.status} onValueChange={val => setEditUser({ ...editUser, status: val })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PRESENT">Present</SelectItem>
                                        <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                                        <SelectItem value="LEFT">Left</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Hierarchy - Full Width */}
                    <div className="md:col-span-2 space-y-4 pt-2">
                        <h3 className="text-sm font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md">Hierarchy Assignment</h3>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                            <div className="grid gap-1.5 min-w-0">
                                <Label className="text-xs font-semibold">Department</Label>
                                <FormSelect
                                    multiple={true}
                                    placeholder="Select Departments"
                                    value={editUser.departments}
                                    onValueChange={(values) => setEditUser({
                                        ...editUser,
                                        departments: values,
                                        sections: [],
                                        lines: [],
                                        subSections: [],
                                        stations: []
                                    })}
                                    options={(deptRes?.data?.departments || []).map(d => ({ value: String(d.id), label: d.name }))}
                                />
                            </div>
                            <div className="grid gap-1.5 min-w-0">
                                <Label className="text-xs font-semibold">Section</Label>
                                <FormSelect
                                    multiple={true}
                                    placeholder="Select Sections"
                                    value={editUser.sections}
                                    onValueChange={(values) => setEditUser({
                                        ...editUser,
                                        sections: values,
                                        lines: [],
                                        subSections: [],
                                        stations: []
                                    })}
                                    options={(sectionRes?.data || []).map(s => ({ value: String(s.id), label: s.name }))}
                                    disabled={!editUser.departments.length}
                                />
                            </div>
                            <div className="grid gap-1.5 min-w-0">
                                <Label className="text-xs font-semibold">Line</Label>
                                <FormSelect
                                    multiple={true}
                                    placeholder="Select Lines"
                                    value={editUser.lines}
                                    onValueChange={(values) => setEditUser({
                                        ...editUser,
                                        lines: values,
                                        subSections: [],
                                        stations: []
                                    })}
                                    options={(lineRes?.data || []).map(l => ({ value: String(l.id), label: l.name }))}
                                    disabled={!editUser.sections.length}
                                />
                            </div>
                            <div className="grid gap-1.5 min-w-0">
                                <Label className="text-xs font-semibold">Sub-Section</Label>
                                <FormSelect
                                    multiple={true}
                                    placeholder="Select Sub-sections"
                                    value={editUser.subSections}
                                    onValueChange={(values) => setEditUser({
                                        ...editUser,
                                        subSections: values,
                                        stations: []
                                    })}
                                    options={(subSectionRes?.data || []).map(ss => ({ value: String(ss.id), label: ss.name }))}
                                    disabled={!editUser.lines.length}
                                />
                            </div>
                            <div className="grid gap-1.5 min-w-0">
                                <Label className="text-xs font-semibold">Station</Label>
                                <FormSelect
                                    multiple={true}
                                    placeholder="Select Stations"
                                    value={editUser.stations}
                                    onValueChange={(values) => setEditUser({
                                        ...editUser,
                                        stations: values
                                    })}
                                    options={(machineRes?.data || []).map(m => ({ value: String(m.id), label: m.name }))}
                                    disabled={!editUser.subSections.length}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]">
                        {isProcessing ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

