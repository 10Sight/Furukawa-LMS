import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    Pencil,
    Loader2
} from "lucide-react";
import axiosInstance from "@/Helper/axiosInstance";
import toast from "react-hot-toast";
import { usePrivileges } from "@/hooks/usePrivileges";

const UserManagement = () => {
    const { hasPrivilege, getAllPrivileges, loading: privLoading } = usePrivileges();
    const allPrivileges = getAllPrivileges();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        totalUsers: 0,
        totalPages: 1
    });

    // Edit Modal State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editIsAdmin, setEditIsAdmin] = useState(false);
    const [editPrivileges, setEditPrivileges] = useState([]);
    const [saving, setSaving] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(1, search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchUsers = async (page = 1, searchQuery = "") => {
        try {
            setLoading(true);
            const res = await axiosInstance.get(`/api/users`, {
                params: {
                    page: page,
                    limit: pagination.limit,
                    search: searchQuery
                }
            });

            if (res?.data?.success) {
                const { users, totalUsers, totalPages, currentPage } = res.data.data;
                setUsers(users);
                setPagination(prev => ({
                    ...prev,
                    page: currentPage,
                    totalUsers,
                    totalPages
                }));
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchUsers(newPage, search);
        }
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setEditIsAdmin(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');

        let existingPrivs = [];
        if (user.privileges) {
            const rawPrivs = typeof user.privileges === 'string' ? user.privileges.split(',').map(p => p.trim()) : (Array.isArray(user.privileges) ? user.privileges : []);

            existingPrivs = rawPrivs.map(p => {
                if (!isNaN(p)) return parseInt(p);
                const found = allPrivileges.find(pm => pm.name === p);
                return found ? found.id : null;
            }).filter(p => p !== null);
        }
        setEditPrivileges(existingPrivs);
        setIsEditOpen(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        setSaving(true);
        try {
            const payload = {
                isAdmin: editIsAdmin,
                privileges: editPrivileges.join(',')
            };

            const res = await axiosInstance.patch(`/api/users/${editingUser._id || editingUser.id}`, payload);

            if (res.data?.success) {
                toast.success("User updated successfully");
                setIsEditOpen(false);
                fetchUsers(pagination.page, search);
            }
        } catch (error) {
            console.error("Update failed", error);
            toast.error("Failed to update user");
        } finally {
            setSaving(false);
        }
    };

    const togglePrivilege = (privId) => {
        setEditPrivileges(prev => {
            if (prev.includes(privId)) return prev.filter(p => p !== privId);
            return [...prev, privId];
        });
    };

    const getInitials = (name) => {
        return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const getRandomColor = (name) => {
        const colors = ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500"];
        return colors[(name?.length || 0) % colors.length];
    };

    const parsePrivileges = (privs) => {
        if (!privs) return [];
        let rawList = [];
        if (Array.isArray(privs)) rawList = privs;
        else if (typeof privs === 'string') rawList = privs.split(',').map(p => p.trim());

        // Use allPrivileges to find names
        return rawList.map(p => {
            const id = parseInt(p);
            const found = allPrivileges.find(pm => pm.id === id || pm.name === p);
            return found ? found.name : p;
        });
    };

    return (
        <div className="space-y-6 min-h-screen pb-10">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-900">User Management</h1>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                    placeholder="Search by name or Operator ID..."
                    className="pl-12 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl focus-visible:ring-blue-600 focus-visible:border-blue-600 shadow-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* User Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-500">
                        <thead className="text-xs uppercase bg-slate-50 font-medium text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Operator</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Privileges</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                            <p className="text-sm text-slate-500">Loading users...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                                <Search className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <p className="text-slate-900 font-medium">No users found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user._id || user.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <Avatar className={`h-10 w-10 border-2 border-slate-100 ${getRandomColor(user.fullName || "U")}`}>
                                                    <AvatarImage src={user.avatar?.url} alt={user.fullName} />
                                                    <AvatarFallback className="text-white font-bold bg-transparent">
                                                        {getInitials(user.fullName || user.userName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-slate-900 text-base">{user.fullName || user.userName}</p>
                                                    <p className="text-xs text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <Badge variant={user.isAdmin ? "default" : "outline"} className={user.isAdmin ? "bg-blue-600 hover:bg-blue-700" : "text-slate-500"}>
                                                    {user.isAdmin ? "Admin" : "User"}
                                                </Badge>
                                                <p className="text-xs text-slate-400">{user.role}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {parsePrivileges(user.privileges).length > 0 ? (
                                                    parsePrivileges(user.privileges).slice(0, 2).map((priv, idx) => (
                                                        <Badge key={idx} variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200">
                                                            {priv}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-400 text-xs italic">None</span>
                                                )}
                                                {parsePrivileges(user.privileges).length > 2 && (
                                                    <Badge variant="secondary" className="bg-slate-50 text-slate-500 border border-slate-200">
                                                        +{parsePrivileges(user.privileges).length - 2}
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {hasPrivilege("User Management") && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleEditClick(user)}
                                                >
                                                    <Pencil className="h-4 w-4 mr-1" /> Edit
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && users.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Showing <span className="font-medium text-slate-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-medium text-slate-900">{Math.min(pagination.page * pagination.limit, pagination.totalUsers)}</span> of <span className="font-medium text-slate-900">{pagination.totalUsers}</span> users
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page === 1}
                                onClick={() => handlePageChange(pagination.page - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page === pagination.totalPages}
                                onClick={() => handlePageChange(pagination.page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white text-slate-900">
                    <DialogHeader>
                        <DialogTitle>Edit User Privileges</DialogTitle>
                        <DialogDescription>
                            Manage access and permissions for <span className="font-medium text-blue-600">{editingUser?.fullName}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Admin Authority */}
                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50">
                            <div className="flex flex-col space-y-1">
                                <Label htmlFor="admin-mode" className="font-semibold text-slate-900">Admin Authority</Label>
                                <span className="text-xs text-slate-500">Grant full administrative access to this user.</span>
                            </div>
                            <Switch
                                id="admin-mode"
                                checked={editIsAdmin}
                                onCheckedChange={setEditIsAdmin}
                            />
                        </div>

                        {/* Privileges List */}
                        <div className="space-y-4">
                            <Label className="font-semibold text-slate-900">Module Privileges</Label>
                            {privLoading ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {allPrivileges.length > 0 ? allPrivileges.map((priv) => (
                                        <div key={priv.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`priv-${priv.id}`}
                                                checked={editPrivileges.includes(priv.id)}
                                                onCheckedChange={() => togglePrivilege(priv.id)}
                                                disabled={!editIsAdmin}
                                            />
                                            <Label
                                                htmlFor={`priv-${priv.id}`}
                                                className="text-sm font-normal text-slate-700 cursor-pointer"
                                            >
                                                {priv.name}
                                            </Label>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-slate-400">No privileges found.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveUser} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default UserManagement;
