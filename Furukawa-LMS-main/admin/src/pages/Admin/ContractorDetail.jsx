import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useSelector } from "react-redux";
import { useGetContractorByIdQuery } from "@/Redux/AllApi/ContractorApi";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IconArrowLeft, IconLoader, IconUsers, IconBuilding, IconPhone, IconMail, IconMapPin, IconCalendar, IconAlertTriangle } from "@tabler/icons-react";

const ContractorDetail = () => {
    const { contractorId } = useParams();
    const navigate = useNavigate();
    const authUser = useSelector((state) => state.auth.user);

    // Permission evaluation
    const isMasterAdmin =
        authUser?.role === "SUPERADMIN" ||
        authUser?.role === "ADMIN" ||
        authUser?.isAdmin === 1 ||
        authUser?.isAdmin === true;

    // Granular Permissions
    const userPermissions = authUser?.customRole?.permissions || [];
    const canView = isMasterAdmin || userPermissions.includes("contractor:read");

    const { data: response, isLoading } = useGetContractorByIdQuery(contractorId, {
        skip: !canView
    });

    const contractor = response?.data?.contractor || null;
    const users = response?.data?.users || [];

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white border border-gray-100 rounded-3xl m-6">
                <IconAlertTriangle className="w-16 h-16 text-red-500 mb-4 opacity-75" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                    You do not have page read permissions for Contractor Details. Please check with your supervisor or administrator.
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
                <IconLoader size={28} className="animate-spin mr-2" /> Loading contractor...
            </div>
        );
    }

    if (!contractor) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <p className="text-gray-500">Contractor not found.</p>
                <Button variant="outline" onClick={() => navigate("/admin/contractors")}>
                    <IconArrowLeft size={16} className="mr-1" /> Back to Contractors
                </Button>
            </div>
        );
    }

    const getInitials = (name = "") =>
        name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

    const getAvatarUrl = (avatar) => {
        if (!avatar) return null;
        try {
            const parsed = typeof avatar === "string" ? JSON.parse(avatar) : avatar;
            return parsed?.url || null;
        } catch {
            return null;
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Back button */}
            <Button variant="ghost" onClick={() => navigate("/admin/contractors")} className="text-gray-600 hover:text-gray-900 -ml-2">
                <IconArrowLeft size={16} className="mr-1" /> Back to Contractors
            </Button>

            {/* Contractor info card */}
            <div className="rounded-xl border bg-white shadow-sm p-6">
                <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 text-blue-600">
                        <IconBuilding size={28} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-gray-900">{contractor.name}</h1>
                            <Badge
                                variant="outline"
                                className={
                                    contractor.status === "active"
                                        ? "border-green-300 text-green-700 bg-green-50"
                                        : "border-gray-300 text-gray-500 bg-gray-50"
                                }
                            >
                                {contractor.status === "active" ? "Active" : "Inactive"}
                            </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {contractor.location && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <IconMapPin size={15} className="text-gray-400 shrink-0" />
                                    <span>{contractor.location}</span>
                                </div>
                            )}
                            {contractor.phoneNumber && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <IconPhone size={15} className="text-gray-400 shrink-0" />
                                    <span>{contractor.phoneNumber}</span>
                                </div>
                            )}
                            {contractor.email && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <IconMail size={15} className="text-gray-400 shrink-0" />
                                    <span>{contractor.email}</span>
                                </div>
                            )}
                            {contractor.startDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <IconCalendar size={15} className="text-gray-400 shrink-0" />
                                    <span>Since {format(new Date(contractor.startDate), "dd MMM yyyy")}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Users section */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <IconUsers size={20} className="text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-800">
                        Users under this contractor
                        <span className="ml-2 text-sm font-normal text-gray-400">({users.length})</span>
                    </h2>
                </div>

                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                    {users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-2">
                            <IconUsers size={36} strokeWidth={1.2} />
                            <p className="text-sm">No users linked to this contractor yet.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead className="w-8">#</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Emp ID</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Joining Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user, idx) => (
                                    <TableRow
                                        key={user.id}
                                        className="cursor-pointer hover:bg-blue-50 transition-colors"
                                        onClick={() => navigate(`/admin/employees/${user.id}`)}
                                    >
                                        <TableCell className="text-gray-400 text-sm">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={getAvatarUrl(user.avatar)} />
                                                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-semibold">
                                                        {getInitials(user.fullName)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-gray-900 text-sm">{user.fullName}</p>
                                                    <p className="text-xs text-gray-400">@{user.userName}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-600 text-sm">{user.empId || "—"}</TableCell>
                                        <TableCell className="text-gray-600 text-sm">{user.email || "—"}</TableCell>
                                        <TableCell className="text-gray-600 text-sm">{user.phoneNumber || "—"}</TableCell>
                                        <TableCell className="text-gray-600 text-sm">
                                            {user.joiningDate ? format(new Date(user.joiningDate), "dd MMM yyyy") : "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    user.status === "LEFT"
                                                        ? "border-red-200 text-red-600 bg-red-50"
                                                        : "border-green-200 text-green-700 bg-green-50"
                                                }
                                            >
                                                {user.status || "Active"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContractorDetail;
