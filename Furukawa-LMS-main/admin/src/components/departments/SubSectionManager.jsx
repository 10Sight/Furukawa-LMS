import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
    useGetSubSectionsByLineQuery,
    useCreateSubSectionMutation,
    useUpdateSubSectionMutation,
    useDeleteSubSectionMutation,
} from "@/Redux/AllApi/SubSectionApi";
import { IconPlus, IconEdit, IconLoader, IconCheck, IconX, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const SubSectionManager = ({ lineId }) => {
    const navigate = useNavigate();
    const { departmentId } = useParams();
    const { data: subSectionsData, isLoading, error } = useGetSubSectionsByLineQuery(lineId);
    const [createSubSection, { isLoading: isCreating }] = useCreateSubSectionMutation();
    const [updateSubSection, { isLoading: isUpdating }] = useUpdateSubSectionMutation();
    const [deleteSubSection, { isLoading: isDeleting }] = useDeleteSubSectionMutation();

    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSubSection, setEditingSubSection] = useState(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");

    const handleCreate = async () => {
        if (!newName.trim()) {
            toast.error("Sub-Section name is required");
            return;
        }

        try {
            await createSubSection({
                name: newName,
                lineId,
                description: newDescription
            }).unwrap();
            toast.success("Sub-Section created successfully");
            setNewName("");
            setNewDescription("");
            setIsCreateDialogOpen(false);
        } catch (error) {
            toast.error(error.data?.message || "Failed to create sub-section");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this sub-section?")) {
            return;
        }

        try {
            await deleteSubSection(id).unwrap();
            toast.success("Sub-Section deleted successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to delete sub-section");
        }
    };

    const startEditing = (subSection) => {
        setEditingSubSection(subSection);
        setEditName(subSection.name || "");
        setEditDescription(subSection.description || "");
        setIsEditDialogOpen(true);
    };

    const saveEdit = async () => {
        if (!editName.trim()) {
            toast.error("Name cannot be empty");
            return;
        }

        try {
            await updateSubSection({
                id: editingSubSection.id || editingSubSection._id,
                name: editName,
                description: editDescription
            }).unwrap();
            toast.success("Sub-Section updated successfully");
            setIsEditDialogOpen(false);
            setEditingSubSection(null);
        } catch (error) {
            toast.error(error.data?.message || "Failed to update sub-section");
        }
    };

    const handleSubSectionClick = (subId) => {
        if (!subId || subId === "undefined") {
            toast.error("Invalid sub-section ID");
            return;
        }
        navigate(`/admin/departments/${departmentId}/lines/${lineId}/sub-sections/${subId}`);
    };

    return (
        <Card className="shadow-sm border">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Line Sub-Sections</CardTitle>
                    <CardDescription>Manage specific areas or segments within this production line</CardDescription>
                </div>
                <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                    <IconPlus className="h-4 w-4" />
                    Add Sub-Section
                </Button>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                        <DialogHeader>
                            <DialogTitle>Add New Sub-Section</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="subName">Name</Label>
                                <Input
                                    id="subName"
                                    placeholder="e.g., Station 1"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="subDescription">Description (Optional)</Label>
                                <Input
                                    id="subDescription"
                                    placeholder="Brief description"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={isCreating}>
                                {isCreating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Create Sub-Section"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Sub-Section Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                        <DialogHeader>
                            <DialogTitle>Edit Sub-Section</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="editSubName">Name</Label>
                                <Input
                                    id="editSubName"
                                    placeholder="e.g., Station 1"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editSubDescription">Description (Optional)</Label>
                                <Input
                                    id="editSubDescription"
                                    placeholder="Brief description"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveEdit} disabled={isUpdating}>
                                {isUpdating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8"><IconLoader className="animate-spin" /></div>
                ) : error ? (
                    <div className="text-red-500 p-4 text-center">Error loading sub-sections</div>
                ) : subSectionsData?.data?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No sub-sections found for this line.
                    </div>
                ) : (
                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-semibold">Name</TableHead>
                                    <TableHead className="font-semibold">Description</TableHead>
                                    <TableHead className="font-semibold">Operators</TableHead>
                                    <TableHead className="text-right font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subSectionsData?.data?.map((subSection) => (
                                    <TableRow key={subSection.id || subSection._id}>
                                        <TableCell>
                                                <div 
                                                    className="cursor-pointer hover:text-blue-600 transition-colors"
                                                    onClick={() => handleSubSectionClick(subSection.id || subSection._id)}
                                                >
                                                    <p className="font-medium text-sm">{subSection.name}</p>
                                                </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {subSection.description || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {subSection.subSectionCount || 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => startEditing(subSection)}>
                                                        <IconEdit className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleDelete(subSection.id || subSection._id)}>
                                                        {isDeleting ? <IconLoader className="h-3.5 w-3.5 animate-spin" /> : <IconTrash className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default SubSectionManager;
