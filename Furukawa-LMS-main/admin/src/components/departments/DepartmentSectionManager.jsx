import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    useGetSectionsByDepartmentQuery,
    useCreateSectionMutation,
    useUpdateSectionMutation,
    useDeleteSectionMutation,
} from "@/Redux/AllApi/SectionApi";
import { IconPlus, IconEdit, IconLoader, IconCheck, IconX, IconTrash, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import SectionLineManager from "./SectionLineManager";

const DepartmentSectionManager = ({ departmentId }) => {
    const { data: sectionsData, isLoading, error } = useGetSectionsByDepartmentQuery(departmentId);
    const [createSection, { isLoading: isCreating }] = useCreateSectionMutation();
    const [updateSection, { isLoading: isUpdating }] = useUpdateSectionMutation();
    const [deleteSection, { isLoading: isDeleting }] = useDeleteSectionMutation();

    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionUniCode, setNewSectionUniCode] = useState("");
    const [newSectionDescription, setNewSectionDescription] = useState("");
    const [newSectionCategory, setNewSectionCategory] = useState("Direct");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSection, setEditingSection] = useState(null);
    
    // Edit Form States
    const [editName, setEditName] = useState("");
    const [editUniCode, setEditUniCode] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editCategory, setEditCategory] = useState("Direct");

    const [expandedSectionId, setExpandedSectionId] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState("All");

    const toggleExpand = (sectionId) => {
        setExpandedSectionId(expandedSectionId === sectionId ? null : sectionId);
    };

    const handleCreateSection = async () => {
        if (!newSectionName.trim()) {
            toast.error("Section name is required");
            return;
        }

        try {
            await createSection({
                name: newSectionName,
                uniCode: newSectionUniCode,
                departmentId,
                description: newSectionDescription,
                category: newSectionCategory
            }).unwrap();
            toast.success("Section created successfully");
            setNewSectionName("");
            setNewSectionUniCode("");
            setNewSectionDescription("");
            setNewSectionCategory("Direct");
            setIsCreateDialogOpen(false);
        } catch (error) {
            toast.error(error.data?.message || "Failed to create section");
        }
    };

    const handleDeleteSection = async (sectionId) => {
        if (!window.confirm("Are you sure you want to delete this section? This action will also delete all lines under it.")) {
            return;
        }

        try {
            await deleteSection(sectionId).unwrap();
            toast.success("Section deleted successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to delete section");
        }
    };

    const startEditing = (section) => {
        setEditingSection(section);
        setEditName(section.name || "");
        setEditUniCode(section.uniCode || "");
        setEditDescription(section.description || "");
        setEditCategory(section.category || "Direct");
        setIsEditDialogOpen(true);
    };

    const saveEdit = async () => {
        if (!editName.trim()) {
            toast.error("Section name cannot be empty");
            return;
        }

        try {
            await updateSection({
                id: editingSection.id || editingSection._id,
                name: editName,
                uniCode: editUniCode,
                description: editDescription,
                category: editCategory
            }).unwrap();
            toast.success("Section updated successfully");
            setIsEditDialogOpen(false);
            setEditingSection(null);
        } catch (error) {
            toast.error(error.data?.message || "Failed to update section");
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Department Sections & Lines</CardTitle>
                    <CardDescription>Manage sections and their production lines</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-[200px]">
                        <Label className="whitespace-nowrap hidden sm:block">Filter by:</Label>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Categories</SelectItem>
                                <SelectItem value="Direct">Direct</SelectItem>
                                <SelectItem value="Indirect">Indirect</SelectItem>
                                <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                        <IconPlus className="h-4 w-4" />
                        Add Section
                    </Button>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                            <DialogHeader>
                                <DialogTitle>Add New Section</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Section Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Quality Control"
                                        value={newSectionName}
                                        onChange={(e) => setNewSectionName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="uniCode">UniCode (Unique)</Label>
                                    <Input
                                        id="uniCode"
                                        placeholder="e.g., SEC-001"
                                        value={newSectionUniCode}
                                        onChange={(e) => setNewSectionUniCode(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Input
                                        id="description"
                                        placeholder="Brief description of the section"
                                        value={newSectionDescription}
                                        onChange={(e) => setNewSectionDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={newSectionCategory} onValueChange={setNewSectionCategory}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Direct">Direct</SelectItem>
                                            <SelectItem value="Indirect">Indirect</SelectItem>
                                            <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateSection} disabled={isCreating}>
                                    {isCreating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Create Section"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Section Dialog */}
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                            <DialogHeader>
                                <DialogTitle>Edit Section</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="editName">Section Name</Label>
                                    <Input
                                        id="editName"
                                        placeholder="e.g., Quality Control"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editUniCode">UniCode (Unique)</Label>
                                    <Input
                                        id="editUniCode"
                                        placeholder="e.g., SEC-001"
                                        value={editUniCode}
                                        onChange={(e) => setEditUniCode(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editDescription">Description (Optional)</Label>
                                    <Input
                                        id="editDescription"
                                        placeholder="Brief description of the section"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={editCategory} onValueChange={setEditCategory}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Direct">Direct</SelectItem>
                                            <SelectItem value="Indirect">Indirect</SelectItem>
                                            <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => {
                                    setIsEditDialogOpen(false);
                                    setEditingSection(null);
                                }}>Cancel</Button>
                                <Button onClick={saveEdit} disabled={isUpdating}>
                                    {isUpdating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Save Changes"}
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
                    <div className="text-red-500 p-4">Error loading sections: {error.message}</div>
                ) : sectionsData?.data?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No sections found for this department. Create one to manage lines.
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead>Section Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-center">Section Count (Users)</TableHead>
                                    <TableHead className="text-right px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sectionsData?.data
                                    ?.filter(section => categoryFilter === "All" || section.category === categoryFilter)
                                    .map((section, index) => {
                                        const sectionId = section.id || section._id;
                                        const isExpanded = expandedSectionId === sectionId;

                                        return (
                                            <React.Fragment key={sectionId}>
                                                <TableRow 
                                                    className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}
                                                    onClick={() => toggleExpand(sectionId)}
                                                >
                                                    <TableCell className="text-center font-medium text-slate-500">
                                                        {isExpanded ? <IconChevronDown className="h-4 w-4 mx-auto text-blue-600" /> : <IconChevronRight className="h-4 w-4 mx-auto text-slate-400" />}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-slate-900">{section.name}</span>
                                                                {section.uniCode && <Badge variant="secondary" className="px-1 py-0 text-[9px] font-mono">{section.uniCode}</Badge>}
                                                            </div>
                                                            <span className="text-[11px] text-slate-500 line-clamp-1">{section.description || "No description"}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                                            {section.category || "Not Applicable"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-lg font-bold text-slate-800">{section.sectionCount || 0}</span>
                                                            <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Assigned Users</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right px-6" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => startEditing(section)}>
                                                                        <IconEdit className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteSection(sectionId)}>
                                                                        {isDeleting ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                                                    </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-slate-50/30 border-b">
                                                        <TableCell colSpan={5} className="p-0">
                                                            <div className="px-12 py-6 border-l-2 border-l-blue-500 bg-white">
                                                                <SectionLineManager sectionId={sectionId} departmentId={departmentId} />
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default DepartmentSectionManager;
