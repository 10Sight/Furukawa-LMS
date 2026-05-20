import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    useGetLinesByDepartmentQuery,
    useCreateLineMutation,
    useUpdateLineMutation,
    useDeleteLineMutation,
} from "@/Redux/AllApi/LineApi";
import { IconPlus, IconEdit, IconLoader, IconCheck, IconX, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const DepartmentLineManager = ({ departmentId }) => {
    const navigate = useNavigate();
    const { data: linesData, isLoading, error } = useGetLinesByDepartmentQuery(departmentId);
    const [createLine, { isLoading: isCreating }] = useCreateLineMutation();
    const [updateLine, { isLoading: isUpdating }] = useUpdateLineMutation();
    const [deleteLine, { isLoading: isDeleting }] = useDeleteLineMutation();

    const [newLineName, setNewLineName] = useState("");
    const [newLineUniCode, setNewLineUniCode] = useState("");
    const [newLineLeader, setNewLineLeader] = useState("");
    const [newLineDescription, setNewLineDescription] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingLineId, setEditingLineId] = useState(null);
    const [editName, setEditName] = useState("");

    const handleCreateLine = async () => {
        if (!newLineName.trim()) {
            toast.error("Line name is required");
            return;
        }

        try {
            await createLine({
                name: newLineName,
                uniCode: newLineUniCode,
                lineLeader: newLineLeader,
                departmentId,
                description: newLineDescription
            }).unwrap();
            toast.success("Line created successfully");
            setNewLineName("");
            setNewLineUniCode("");
            setNewLineLeader("");
            setNewLineDescription("");
            setIsCreateDialogOpen(false);
        } catch (error) {
            toast.error(error.data?.message || "Failed to create line");
        }
    };

    const handleDeleteLine = async (e, lineId) => {
        e.stopPropagation(); // Prevent row click
        if (!window.confirm("Are you sure you want to delete this line? This action cannot be undone.")) {
            return;
        }

        try {
            await deleteLine(lineId).unwrap();
            toast.success("Line deleted successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to delete line");
        }
    };

    const startEditing = (e, line) => {
        e.stopPropagation(); // Prevent row click
        setEditingLineId(line.id || line._id);
        setEditName(line.name);
    };

    const cancelEditing = (e) => {
        e.stopPropagation(); // Prevent row click
        setEditingLineId(null);
        setEditName("");
    };

    const saveEdit = async (e) => {
        e.stopPropagation(); // Prevent row click
        if (!editName.trim()) {
            toast.error("Line name cannot be empty");
            return;
        }

        try {
            await updateLine({
                id: editingLineId,
                name: editName
            }).unwrap();
            toast.success("Line updated successfully");
            setEditingLineId(null);
            setEditName("");
        } catch (error) {
            toast.error(error.data?.message || "Failed to update line");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Department Lines</CardTitle>
                    <CardDescription>Manage production lines for this department</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                        <IconPlus className="h-4 w-4" />
                        Add Line
                    </Button>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        {/* Overlay with blur effect */}
                        <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                            <DialogHeader>
                                <DialogTitle>Add New Line</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Line Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Assembly Line A"
                                        value={newLineName}
                                        onChange={(e) => setNewLineName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="uniCode">UniCode (Unique)</Label>
                                    <Input
                                        id="uniCode"
                                        placeholder="e.g., LINE-001"
                                        value={newLineUniCode}
                                        onChange={(e) => setNewLineUniCode(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lineLeader">Line Leader</Label>
                                    <Input
                                        id="lineLeader"
                                        placeholder="e.g., Rakesh Kumar"
                                        value={newLineLeader}
                                        onChange={(e) => setNewLineLeader(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Input
                                        id="description"
                                        placeholder="Brief description of the line"
                                        value={newLineDescription}
                                        onChange={(e) => setNewLineDescription(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateLine} disabled={isCreating}>
                                    {isCreating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Create Line"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8"><IconLoader className="animate-spin" /></div>
                ) : error ? (
                    <div className="text-red-500 p-4">Error loading lines: {error.message}</div>
                ) : linesData?.data?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No lines found for this department. Create one to get started.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Line Name</TableHead>
                                <TableHead>Line Leader</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {linesData?.data?.map((line) => (
                                <TableRow
                                    key={line.id || line._id}
                                    className="cursor-pointer hover:bg-gray-100"
                                    onClick={() => {
                                        const baseLayout = window.location.pathname.split('/')[1] || 'admin';
                                        navigate(`/${baseLayout}/departments/${departmentId}/lines/${line.id || line._id}`);
                                    }}
                                >
                                    <TableCell className="font-medium">
                                        {editingLineId === (line.id || line._id) ? (
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="max-w-[200px]"
                                            />
                                        ) : (
                                            <div>
                                                <p className="font-medium">{line.name}</p>
                                                {line.uniCode && (
                                                    <p className="text-xs text-muted-foreground">{line.uniCode}</p>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>{line.lineLeader || "-"}</TableCell>
                                    <TableCell>{line.description || "-"}</TableCell>
                                    <TableCell className="text-right">
                                        {editingLineId === (line.id || line._id) ? (
                                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={(e) => saveEdit(e)} disabled={isUpdating}>
                                                    <IconCheck className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={cancelEditing}>
                                                    <IconX className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={(e) => startEditing(e, line)}>
                                                    <IconEdit className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={(e) => handleDeleteLine(e, line.id || line._id)}>
                                                    {isDeleting ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
};

export default DepartmentLineManager;
