import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
    useGetAllContractorsQuery,
    useCreateContractorMutation,
    useUpdateContractorMutation,
    useDeleteContractorMutation,
} from "@/Redux/AllApi/ContractorApi";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSelector } from "react-redux";
import { IconPlus, IconPencil, IconTrash, IconLoader, IconBuilding, IconUsers, IconAlertTriangle } from "@tabler/icons-react";
import { toast } from "sonner";

const emptyForm = {
    name: "",
    location: "",
    phoneNumber: "",
    email: "",
    status: "active",
};

const Contractors = () => {
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
    const canCreate = isMasterAdmin || userPermissions.includes("contractor:create");
    const canUpdate = isMasterAdmin || userPermissions.includes("contractor:update");
    const canDelete = isMasterAdmin || userPermissions.includes("contractor:delete");

    const { data: response, isLoading, refetch } = useGetAllContractorsQuery(undefined, {
        skip: !canView
    });
    const [createContractor, { isLoading: isCreating }] = useCreateContractorMutation();
    const [updateContractor, { isLoading: isUpdating }] = useUpdateContractorMutation();
    const [deleteContractor, { isLoading: isDeleting }] = useDeleteContractorMutation();

    const contractors = response?.data || [];

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});

    const openAdd = () => {
        setEditTarget(null);
        setForm(emptyForm);
        setErrors({});
        setIsFormOpen(true);
    };

    const openEdit = (e, contractor) => {
        e.stopPropagation();
        setEditTarget(contractor);
        setForm({
            name: contractor.name || "",
            location: contractor.location || "",
            phoneNumber: contractor.phoneNumber || "",
            email: contractor.email || "",
            status: contractor.status || "active",
        });
        setErrors({});
        setIsFormOpen(true);
    };

    const openDelete = (e, contractor) => {
        e.stopPropagation();
        setDeleteTarget(contractor);
        setIsDeleteOpen(true);
    };

    const validate = () => {
        const errs = {};
        if (!form.name.trim()) errs.name = "Name is required";
        return errs;
    };

    const handleSave = async () => {
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        try {
            if (editTarget) {
                await updateContractor({ id: editTarget.id, ...form }).unwrap();
                toast.success("Contractor updated successfully");
            } else {
                await createContractor(form).unwrap();
                toast.success("Contractor created successfully");
            }
            setIsFormOpen(false);
        } catch (err) {
            toast.error(err?.data?.message || "Something went wrong");
        }
    };

    const handleDelete = async () => {
        try {
            await deleteContractor(deleteTarget.id).unwrap();
            toast.success("Contractor deleted");
            setIsDeleteOpen(false);
        } catch (err) {
            toast.error(err?.data?.message || "Failed to delete contractor");
        }
    };

    const handleRowClick = (id) => navigate(`/admin/contractors/${id}`);

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white border border-gray-100 rounded-3xl m-6">
                <IconAlertTriangle className="w-16 h-16 text-red-500 mb-4 opacity-75" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                    You do not have page read permissions for Contractor Management. Please check with your supervisor or administrator.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <IconBuilding size={28} className="text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Contractors</h1>
                        <p className="text-sm text-gray-500">{contractors.length} total contractor{contractors.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
                {canCreate && (
                    <Button onClick={openAdd} className="flex items-center gap-2">
                        <IconPlus size={16} />
                        Add Contractor
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <IconLoader size={24} className="animate-spin mr-2" /> Loading...
                    </div>
                ) : contractors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                        <IconBuilding size={40} strokeWidth={1.2} />
                        <p className="text-sm">No contractors yet. Click "Add Contractor" to create one.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="w-8">#</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-center">
                                    <span className="flex items-center justify-center gap-1"><IconUsers size={14} /> Users</span>
                                </TableHead>
                                {(canUpdate || canDelete) && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contractors.map((c, idx) => (
                                <TableRow
                                    key={c.id}
                                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                                    onClick={() => handleRowClick(c.id)}
                                >
                                    <TableCell className="text-gray-400 text-sm">{idx + 1}</TableCell>
                                    <TableCell className="font-medium text-gray-900">{c.name}</TableCell>
                                    <TableCell className="text-gray-600">{c.location || "—"}</TableCell>
                                    <TableCell className="text-gray-600">{c.phoneNumber || "—"}</TableCell>
                                    <TableCell className="text-gray-600">{c.email || "—"}</TableCell>
                                    <TableCell className="text-gray-600">
                                        {c.startDate ? format(new Date(c.startDate), "dd MMM yyyy") : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                c.status === "active"
                                                    ? "border-green-300 text-green-700 bg-green-50"
                                                    : "border-gray-300 text-gray-500 bg-gray-50"
                                            }
                                        >
                                            {c.status === "active" ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                            {c.userCount ?? 0}
                                        </span>
                                    </TableCell>
                                    {(canUpdate || canDelete) && (
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {canUpdate && (
                                                    <button
                                                        onClick={(e) => openEdit(e, c)}
                                                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <IconPencil size={16} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={(e) => openDelete(e, c)}
                                                        className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Add / Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editTarget ? "Edit Contractor" : "Add Contractor"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label htmlFor="name">
                                Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Contractor name"
                            />
                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={form.location}
                                onChange={(e) => setForm({ ...form, location: e.target.value })}
                                placeholder="City / Address (optional)"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="phoneNumber">Phone Number</Label>
                            <Input
                                id="phoneNumber"
                                value={form.phoneNumber}
                                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                placeholder="Contact number (optional)"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="Email address (optional)"
                            />
                        </div>

                        {editTarget && (
                            <div className="space-y-1">
                                <Label>Status</Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(val) => setForm({ ...form, status: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isCreating || isUpdating}>
                            {(isCreating || isUpdating) && <IconLoader size={14} className="animate-spin mr-1" />}
                            {editTarget ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Contractor</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-gray-600 py-2">
                        Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
                        All linked users will be unlinked from this contractor.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting && <IconLoader size={14} className="animate-spin mr-1" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Contractors;
