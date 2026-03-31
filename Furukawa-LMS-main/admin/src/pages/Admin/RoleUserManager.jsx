import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
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
import { Shield, Users, Search, RefreshCw, Trash2, Edit2, UserPlus, ChevronLeft } from "lucide-react";
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
    const [isBulkUnassignOpen, setIsBulkUnassignOpen] = useState(false);

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
        search: searchTerm
    });

    const [deleteUser] = useDeleteUserMutation();

    const handleDelete = async (user) => {
        if (!confirm(`Are you sure you want to remove ${user.fullName} from this role? This will unassign the role but not delete the user account.`)) return;
        try {
            await axiosInstance.patch(`/api/users/${user.id}`, { customRoleId: null });
            toast.success("User unassigned successfully");
            refetch();
            setSelectedIds(prev => prev.filter(id => id !== user.id));
        } catch (e) {
            toast.error("Failed to unassign user");
        }
    };

    const handleBulkUnassign = async () => {
        setIsSubmitting(true);
        try {
            // Using Promise.all to patch multiple users 
            // In a real prod-env, a dedicated bulk-update endpoint is better
            await Promise.all(
                selectedIds.map(id => axiosInstance.patch(`/api/users/${id}`, { customRoleId: null }))
            );
            toast.success(`${selectedIds.length} users removed from role`);
            setSelectedIds([]);
            setIsAllSelectedAcrossPages(false);
            setIsBulkUnassignOpen(false);
            refetch();
        } catch (error) {
            console.error("Bulk unassign error:", error);
            toast.error("Failed to unassign some users");
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
                                onClick={() => setIsBulkUnassignOpen(true)}
                                className="shadow-sm"
                            >
                                <Users className="w-4 h-4 mr-2" />
                                Remove Selected
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
                                            {user.department?.name ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-medium text-gray-900">{user.department.name}</span>
                                                    <span className="text-xs text-gray-500">
                                                        {[
                                                            user.section?.name,
                                                            user.line?.name,
                                                            user.subSection?.name,
                                                            user.station?.name
                                                        ].filter(Boolean).join(" ➔ ") || "No further assignment"}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">Unassigned</span>
                                            )}
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
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(user)}
                                                    title="Remove from Role"
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

            {/* Bulk Unassign Dialog */}
            <Dialog open={isBulkUnassignOpen} onOpenChange={setIsBulkUnassignOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="p-2 bg-red-100 text-red-600 rounded-full">
                                <Trash2 className="w-5 h-5" />
                            </span>
                            Bulk Remove Roles
                        </DialogTitle>
                        <DialogDescription className="pt-4">
                            Are you sure you want to remove the <strong>{role?.name}</strong> role from <strong>{selectedIds.length}</strong> users? 
                            This action will update their profiles but will not delete their accounts.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setIsBulkUnassignOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleBulkUnassign}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                            ) : (
                                "Yes, Remove Role"
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
        departmentId: "",
        sectionId: "",
        lineId: "",
        subSectionId: "",
        stationId: "",
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
        { departmentId: newUser.departmentId, page: 1, limit: 100 },
        { skip: !newUser.departmentId }
    );
    const { data: lineRes } = useGetLinesBySectionQuery(
        { sectionId: newUser.sectionId, page: 1, limit: 100 },
        { skip: !newUser.sectionId }
    );
    const { data: subSectionRes } = useGetSubSectionsByLineQuery(
        { lineId: newUser.lineId, page: 1, limit: 100 },
        { skip: !newUser.lineId }
    );
    const { data: machineRes } = useGetMachinesBySubSectionQuery(
        { subSectionId: newUser.subSectionId, page: 1, limit: 100 },
        { skip: !newUser.subSectionId }
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
                departmentId: newUser.departmentId,
                sectionId: newUser.sectionId,
                lineId: newUser.lineId,
                subSectionId: newUser.subSectionId,
                stationId: newUser.stationId,
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
                departmentId: "",
                sectionId: "",
                lineId: "",
                subSectionId: "",
                stationId: "",
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
        <Dialog open={isOpen} onOpenChange={setIsOpen} className="max-w-[1000px]">
            <DialogContent className="max-w-[1000px] w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-gray-50/50">
                <DialogHeader className="p-6 pb-4 border-b bg-white shrink-0">
                    <DialogTitle>Add User to {role?.name}</DialogTitle>
                    <DialogDescription>
                        Assign an existing user or create a new one with this role.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mt-4 mb-2">
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

                    <TabsContent value="existing" className="space-y-4 py-4">
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

                    <TabsContent value="new" className="flex-1 overflow-y-auto p-6 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Column 1: Core Details */}
                            <div className="flex flex-col space-y-4">
                                <h3 className="text-sm font-semibold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2"></span>
                                    Core Identity
                                </h3>
                                <div className="flex-1 space-y-3 p-4 border rounded-xl bg-white shadow-sm">
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
                            <div className="flex flex-col space-y-4">
                                <h3 className="text-sm font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-100 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-2"></span>
                                    Employment Data
                                </h3>
                                <div className="flex-1 space-y-3 p-4 border rounded-xl bg-white shadow-sm">
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

                            {/* Column 3: Hierarchy Alignment */}
                            <div className="flex flex-col space-y-4">
                                <h3 className="text-sm font-semibold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100 flex items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-2"></span>
                                    Hierarchy Assignment
                                </h3>
                                <div className="flex-1 space-y-3 p-4 border rounded-xl bg-white shadow-sm">
                                     <div className="grid gap-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">Department</Label>
                                        <Select
                                            value={newUser.departmentId ? String(newUser.departmentId) : "unassigned"}
                                            onValueChange={(val) => setNewUser({ ...newUser, departmentId: val === "unassigned" ? "" : val, sectionId: "", lineId: "", subSectionId: "", stationId: "" })}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">None</SelectItem>
                                                {deptRes?.data?.departments?.map((dept) => (
                                                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">Section</Label>
                                        <Select
                                            value={newUser.sectionId ? String(newUser.sectionId) : "unassigned"}
                                            onValueChange={(val) => setNewUser({ ...newUser, sectionId: val === "unassigned" ? "" : val, lineId: "", subSectionId: "", stationId: "" })}
                                            disabled={!newUser.departmentId}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Select Section" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">None</SelectItem>
                                                {sectionRes?.data?.sections?.map((sec) => (
                                                    <SelectItem key={sec.id} value={String(sec.id)}>{sec.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">Line</Label>
                                        <Select
                                            value={newUser.lineId ? String(newUser.lineId) : "unassigned"}
                                            onValueChange={(val) => setNewUser({ ...newUser, lineId: val === "unassigned" ? "" : val, subSectionId: "", stationId: "" })}
                                            disabled={!newUser.sectionId}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Select Line" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">None</SelectItem>
                                                {lineRes?.data?.lines?.map((line) => (
                                                    <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">Sub-Section</Label>
                                        <Select
                                            value={newUser.subSectionId ? String(newUser.subSectionId) : "unassigned"}
                                            onValueChange={(val) => setNewUser({ ...newUser, subSectionId: val === "unassigned" ? "" : val, stationId: "" })}
                                            disabled={!newUser.lineId}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Select Sub-section" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">None</SelectItem>
                                                {subSectionRes?.data?.subSections?.map((sub) => (
                                                    <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-xs font-semibold text-gray-600">Station (Machine)</Label>
                                        <Select
                                            value={newUser.stationId ? String(newUser.stationId) : "unassigned"}
                                            onValueChange={(val) => setNewUser({ ...newUser, stationId: val === "unassigned" ? "" : val })}
                                            disabled={!newUser.subSectionId}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Select Station" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">None</SelectItem>
                                                {machineRes?.data?.machines?.map((mac) => (
                                                    <SelectItem key={mac.id} value={String(mac.id)}>{mac.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

