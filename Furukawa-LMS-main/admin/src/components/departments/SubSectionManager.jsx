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
import { IconPlus, IconEdit, IconLoader, IconCheck, IconX, IconTrash, IconFileText, IconClipboardList } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const SubSectionManager = ({ lineId, sectionId }) => {
    const navigate = useNavigate();
    const { departmentId } = useParams();
    const { data: subSectionsData, isLoading, error } = useGetSubSectionsByLineQuery(lineId);
    const [createSubSection, { isLoading: isCreating }] = useCreateSubSectionMutation();
    const [updateSubSection, { isLoading: isUpdating }] = useUpdateSubSectionMutation();
    const [deleteSubSection, { isLoading: isDeleting }] = useDeleteSubSectionMutation();
    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeLevels = activeConfigData?.data?.levels || [];

    const [newName, setNewName] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newMinLevel, setNewMinLevel] = useState("none");
    const [newMinEff, setNewMinEff] = useState("");
    const [newMaxEff, setNewMaxEff] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSubSection, setEditingSubSection] = useState(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editMinLevel, setEditMinLevel] = useState("none");
    const [editMinEff, setEditMinEff] = useState("");
    const [editMaxEff, setEditMaxEff] = useState("");

    const handleMinLevelChangeCreate = (value) => {
        setNewMinLevel(value);
        if (value === "none") return;
        const selectedLevel = activeLevels.find(level => level.name === value);
        if (selectedLevel) {
            if (selectedLevel.minEfficiency !== undefined && selectedLevel.minEfficiency !== null && selectedLevel.minEfficiency !== "") {
                setNewMinEff(String(selectedLevel.minEfficiency));
            }
            if (selectedLevel.maxEfficiency !== undefined && selectedLevel.maxEfficiency !== null && selectedLevel.maxEfficiency !== "") {
                setNewMaxEff(String(selectedLevel.maxEfficiency));
            }
        }
    };

    const handleMinLevelChangeEdit = (value) => {
        setEditMinLevel(value);
        if (value === "none") return;
        const selectedLevel = activeLevels.find(level => level.name === value);
        if (selectedLevel) {
            if (selectedLevel.minEfficiency !== undefined && selectedLevel.minEfficiency !== null && selectedLevel.minEfficiency !== "") {
                setEditMinEff(String(selectedLevel.minEfficiency));
            }
            if (selectedLevel.maxEfficiency !== undefined && selectedLevel.maxEfficiency !== null && selectedLevel.maxEfficiency !== "") {
                setEditMaxEff(String(selectedLevel.maxEfficiency));
            }
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) {
            toast.error("Sub-Section name is required");
            return;
        }

        try {
            await createSubSection({
                name: newName,
                lineId,
                description: newDescription,
                minimumRequiredLevel: newMinLevel === "none" ? null : newMinLevel,
                minEfficiency: newMinEff !== "" ? parseFloat(newMinEff) : null,
                maxEfficiency: newMaxEff !== "" ? parseFloat(newMaxEff) : null,
            }).unwrap();
            toast.success("Sub-Section created successfully");
            setNewName("");
            setNewDescription("");
            setNewMinLevel("none");
            setNewMinEff("");
            setNewMaxEff("");
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
        setEditMinLevel(subSection.minimumRequiredLevel || "none");
        setEditMinEff(subSection.minEfficiency !== null && subSection.minEfficiency !== undefined ? String(subSection.minEfficiency) : "");
        setEditMaxEff(subSection.maxEfficiency !== null && subSection.maxEfficiency !== undefined ? String(subSection.maxEfficiency) : "");
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
                description: editDescription,
                minimumRequiredLevel: editMinLevel === "none" ? null : editMinLevel,
                minEfficiency: editMinEff !== "" ? parseFloat(editMinEff) : null,
                maxEfficiency: editMaxEff !== "" ? parseFloat(editMaxEff) : null,
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
        const baseLayout = window.location.pathname.split('/')[1] || 'admin';
        navigate(`/${baseLayout}/departments/${departmentId}/lines/${lineId}/sub-sections/${subId}`);
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
                            <div className="space-y-2">
                                <Label htmlFor="newMinLevel">Minimum Required Level</Label>
                                <Select value={newMinLevel} onValueChange={handleMinLevelChangeCreate}>
                                    <SelectTrigger id="newMinLevel">
                                        <SelectValue placeholder="Select level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {activeLevels.map((level) => (
                                            <SelectItem key={level.name} value={level.name}>
                                                {level.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="newMinEff">Min Efficiency (%)</Label>
                                    <Input
                                        id="newMinEff"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="e.g. 60"
                                        value={newMinEff}
                                        onChange={(e) => setNewMinEff(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="newMaxEff">Max Efficiency (%)</Label>
                                    <Input
                                        id="newMaxEff"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="e.g. 100"
                                        value={newMaxEff}
                                        onChange={(e) => setNewMaxEff(e.target.value)}
                                    />
                                </div>
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
                            <div className="space-y-2">
                                <Label htmlFor="editMinLevel">Minimum Required Level</Label>
                                <Select value={editMinLevel} onValueChange={handleMinLevelChangeEdit}>
                                    <SelectTrigger id="editMinLevel">
                                        <SelectValue placeholder="Select level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {activeLevels.map((level) => (
                                            <SelectItem key={level.name} value={level.name}>
                                                {level.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="editMinEff">Min Efficiency (%)</Label>
                                    <Input
                                        id="editMinEff"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="e.g. 60"
                                        value={editMinEff}
                                        onChange={(e) => setEditMinEff(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editMaxEff">Max Efficiency (%)</Label>
                                    <Input
                                        id="editMaxEff"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        placeholder="e.g. 100"
                                        value={editMaxEff}
                                        onChange={(e) => setEditMaxEff(e.target.value)}
                                    />
                                </div>
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
                                    <TableHead className="font-semibold">Min. Level</TableHead>
                                    <TableHead className="font-semibold">Efficiency Range</TableHead>
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
                                        <TableCell>
                                            {subSection.minimumRequiredLevel ? (
                                                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                                    {subSection.minimumRequiredLevel}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">None</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {subSection.minEfficiency !== null && subSection.minEfficiency !== undefined
                                                ? (
                                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                        {subSection.minEfficiency}% – {subSection.maxEfficiency ?? "—"}%
                                                    </span>
                                                )
                                                : <span className="text-muted-foreground text-xs">—</span>
                                            }
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {subSection.subSectionCount || 0}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border-0 shadow-none gap-1 px-2.5 flex items-center"
                                                    onClick={() => {
                                                        const baseLayout = window.location.pathname.split('/')[1] || 'admin';
                                                        navigate(`/${baseLayout}/add-test-paper?departmentId=${departmentId}&sectionId=${sectionId || ""}&lineId=${lineId}&subSectionId=${subSection.id || subSection._id}&level=${subSection.minimumRequiredLevel || ""}`);
                                                    }}
                                                >
                                                    <IconFileText className="h-3.5 w-3.5" />
                                                    Test Paper
                                                </Button>
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
