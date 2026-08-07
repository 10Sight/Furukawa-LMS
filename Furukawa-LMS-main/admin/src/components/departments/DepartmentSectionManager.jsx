import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
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
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
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
import { Checkbox } from "@/components/ui/checkbox";
import SectionLineManager from "./SectionLineManager";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";

const FORM_TYPES = [
    { id: 'standard', label: 'Assembly' },
    { id: 'crimping', label: 'Cutting & Crimping' },
    { id: 'src', label: 'SRC' }
];

const TEN_CYCLE_FORM_TYPES = [
    { id: 'form1', label: 'Logical (Form 1)' },
    { id: 'form2', label: 'Complete (Form 2)' },
    { id: 'form3', label: 'Numerical (Form 3)' }
];

// Strips blank entries; returns null (no overrides) when nothing is set.
const buildDayCountsPayload = (map) => {
    const result = {};
    Object.entries(map || {}).forEach(([level, val]) => {
        if (val !== "" && val !== null && val !== undefined) result[level] = val;
    });
    return Object.keys(result).length > 0 ? result : null;
};

// Name of the level a section member on `levels[index]` upgrades into next.
// The last configured level has no real "next" level, so it repeats itself (already at max).
const getNextLevelName = (index, levels) => {
    if (index + 1 < levels.length) {
        return levels[index + 1].name;
    }
    return levels[index]?.name || "";
};

const DepartmentSectionManager = ({ departmentId }) => {
    const { data: sectionsData, isLoading, error } = useGetSectionsByDepartmentQuery(departmentId);
    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeLevels = useMemo(() => activeConfigData?.data?.levels || [], [activeConfigData]);
    const { user } = useSelector((state) => state.auth || {});

    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

    const hasPermission = (permission) => {
        if (user?.role === "SUPERADMIN" || user?.role === "ADMIN") return true;
        return user?.customRole?.permissions?.includes(permission);
    };

    const canRead = hasPermission("section:read");
    const canCreate = hasPermission("section:create");
    const canUpdate = hasPermission("section:update");
    const canDelete = hasPermission("section:delete");

    const rawAssigned = useMemo(() => {
        let sections = [];
        if (Array.isArray(user?.sections)) {
            sections = [...user.sections];
        } else if (typeof user?.sections === 'string') {
            try {
                sections = JSON.parse(user.sections || "[]");
            } catch (e) {
                sections = [];
            }
        }
        if (user?.sectionId) {
            sections.push(user.sectionId);
        }
        return sections.map(id => String(id)).filter(Boolean);
    }, [user]);

    const visibleSections = useMemo(() => {
        const allSections = sectionsData?.data || [];
        if (isAdmin || rawAssigned.length === 0) {
            return allSections;
        }
        return allSections.filter(section => {
            const secId = String(section.id || section._id);
            return rawAssigned.includes(secId);
        });
    }, [sectionsData, rawAssigned, isAdmin]);

    const [createSection, { isLoading: isCreating }] = useCreateSectionMutation();
    const [updateSection, { isLoading: isUpdating }] = useUpdateSectionMutation();
    const [deleteSection, { isLoading: isDeleting }] = useDeleteSectionMutation();
    const [logAction] = useLogActionMutation();

    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionUniCode, setNewSectionUniCode] = useState("");
    const [newSectionDescription, setNewSectionDescription] = useState("");
    const [newSectionCategory, setNewSectionCategory] = useState("Direct");
    const [newSectionFormTypes, setNewSectionFormTypes] = useState(["standard"]);
    const [newSectionTenCycleFormTypes, setNewSectionTenCycleFormTypes] = useState(["form1"]);
    const [newSectionSkillUpgradationDayCount, setNewSectionSkillUpgradationDayCount] = useState("");
    const [newSectionMultiSkillingDayCount, setNewSectionMultiSkillingDayCount] = useState("");
    const [newSectionSkillUpgradationDayCounts, setNewSectionSkillUpgradationDayCounts] = useState({});
    const [newSectionMultiSkillingDayCounts, setNewSectionMultiSkillingDayCounts] = useState({});
    const [newSectionHideTenCycle, setNewSectionHideTenCycle] = useState(false);
    const [newSectionHideOperatorObservance, setNewSectionHideOperatorObservance] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSection, setEditingSection] = useState(null);
    
    // Edit Form States
    const [editName, setEditName] = useState("");
    const [editUniCode, setEditUniCode] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editCategory, setEditCategory] = useState("Direct");
    const [editFormTypes, setEditFormTypes] = useState([]);
    const [editTenCycleFormTypes, setEditTenCycleFormTypes] = useState([]);
    const [editSkillUpgradationDayCount, setEditSkillUpgradationDayCount] = useState("");
    const [editMultiSkillingDayCount, setEditMultiSkillingDayCount] = useState("");
    const [editSkillUpgradationDayCounts, setEditSkillUpgradationDayCounts] = useState({});
    const [editMultiSkillingDayCounts, setEditMultiSkillingDayCounts] = useState({});
    const [editHideTenCycle, setEditHideTenCycle] = useState(false);
    const [editHideOperatorObservance, setEditHideOperatorObservance] = useState(false);

    const [expandedSectionId, setExpandedSectionId] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState("All");

    const toggleExpand = (sectionId) => {
        setExpandedSectionId(expandedSectionId === sectionId ? null : sectionId);
    };

    const toggleFormType = (type, mode = 'create', formSet = 'daily5m') => {
        const currentTypes = mode === 'create' 
            ? (formSet === 'daily5m' ? newSectionFormTypes : newSectionTenCycleFormTypes)
            : (formSet === 'daily5m' ? editFormTypes : editTenCycleFormTypes);
        
        const setTypes = mode === 'create'
            ? (formSet === 'daily5m' ? setNewSectionFormTypes : setNewSectionTenCycleFormTypes)
            : (formSet === 'daily5m' ? setEditFormTypes : setEditTenCycleFormTypes);

        if (currentTypes.includes(type)) {
            setTypes(currentTypes.filter(t => t !== type));
        } else {
            setTypes([...currentTypes, type]);
        }
    };

    const handleCreateSection = async () => {
        if (!canCreate) {
            toast.error("You do not have permission to create sections");
            return;
        }
        if (!newSectionName.trim()) {
            toast.error("Section name is required");
            return;
        }
        const trimmedUniCode = newSectionUniCode.trim();
        if (!trimmedUniCode) {
            toast.error("UniCode is required");
            return;
        }
        const isDuplicateUniCode = visibleSections.some(
            (section) => (section.uniCode || "").trim().toLowerCase() === trimmedUniCode.toLowerCase()
        );
        if (isDuplicateUniCode) {
            toast.error(`Section with UniCode '${trimmedUniCode}' already exists`);
            return;
        }

        try {
            await createSection({
                name: newSectionName,
                uniCode: trimmedUniCode,
                departmentId,
                description: newSectionDescription,
                category: newSectionCategory,
                daily5mFormType: newSectionFormTypes.join(","),
                tenCycleFormType: newSectionTenCycleFormTypes.join(","),
                hideTenCycle: newSectionHideTenCycle,
                hideOperatorObservance: newSectionHideOperatorObservance,
                skillUpgradationDayCount: newSectionSkillUpgradationDayCount || null,
                multiSkillingDayCount: newSectionMultiSkillingDayCount || null,
                skillUpgradationDayCounts: buildDayCountsPayload(newSectionSkillUpgradationDayCounts),
                multiSkillingDayCounts: buildDayCountsPayload(newSectionMultiSkillingDayCounts)
            }).unwrap();
            logAction({
                action: "CREATE_SECTION",
                details: {
                    departmentId,
                    name: newSectionName,
                    uniCode: trimmedUniCode,
                    category: newSectionCategory,
                    daily5mFormType: newSectionFormTypes.join(","),
                    tenCycleFormType: newSectionTenCycleFormTypes.join(","),
                },
            });
            toast.success("Section created successfully");
            setNewSectionName("");
            setNewSectionUniCode("");
            setNewSectionDescription("");
            setNewSectionCategory("Direct");
            setNewSectionFormTypes(["standard"]);
            setNewSectionTenCycleFormTypes(["form1"]);
            setNewSectionSkillUpgradationDayCount("");
            setNewSectionMultiSkillingDayCount("");
            setNewSectionSkillUpgradationDayCounts({});
            setNewSectionMultiSkillingDayCounts({});
            setNewSectionHideTenCycle(false);
            setNewSectionHideOperatorObservance(false);
            setIsCreateDialogOpen(false);
        } catch (error) {
            toast.error(error.data?.message || "Failed to create section");
        }
    };

    const handleDeleteSection = async (sectionId, sectionName) => {
        if (!canDelete) {
            toast.error("You do not have permission to delete sections");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this section? This action will also delete all lines under it.")) {
            return;
        }

        try {
            await deleteSection(sectionId).unwrap();
            logAction({
                action: "DELETE_SECTION",
                details: { id: sectionId, name: sectionName },
            });
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
        setEditFormTypes(section.daily5mFormType ? section.daily5mFormType.split(",") : ["standard"]);
        setEditTenCycleFormTypes(section.tenCycleFormType ? section.tenCycleFormType.split(",") : ["form1"]);
        setEditSkillUpgradationDayCount(section.skillUpgradationDayCount ?? "");
        setEditMultiSkillingDayCount(section.multiSkillingDayCount ?? "");
        setEditSkillUpgradationDayCounts({ ...(section.skillUpgradationDayCounts || {}) });
        setEditMultiSkillingDayCounts({ ...(section.multiSkillingDayCounts || {}) });
        setEditHideTenCycle(section.hideTenCycle === true || section.hideTenCycle === 1);
        setEditHideOperatorObservance(section.hideOperatorObservance === true || section.hideOperatorObservance === 1);
        setIsEditDialogOpen(true);
    };

    const saveEdit = async () => {
        if (!canUpdate) {
            toast.error("You do not have permission to update sections");
            return;
        }
        if (!editName.trim()) {
            toast.error("Section name cannot be empty");
            return;
        }
        const trimmedEditUniCode = editUniCode.trim();
        if (!trimmedEditUniCode) {
            toast.error("UniCode is required");
            return;
        }
        const editingId = editingSection.id || editingSection._id;
        const isDuplicateUniCode = visibleSections.some(
            (section) =>
                String(section.id || section._id) !== String(editingId) &&
                (section.uniCode || "").trim().toLowerCase() === trimmedEditUniCode.toLowerCase()
        );
        if (isDuplicateUniCode) {
            toast.error(`Section with UniCode '${trimmedEditUniCode}' already exists`);
            return;
        }

        try {
            await updateSection({
                id: editingSection.id || editingSection._id,
                name: editName,
                uniCode: trimmedEditUniCode,
                description: editDescription,
                category: editCategory,
                daily5mFormType: editFormTypes.join(","),
                tenCycleFormType: editTenCycleFormTypes.join(","),
                hideTenCycle: editHideTenCycle,
                hideOperatorObservance: editHideOperatorObservance,
                skillUpgradationDayCount: editSkillUpgradationDayCount || null,
                multiSkillingDayCount: editMultiSkillingDayCount || null,
                skillUpgradationDayCounts: buildDayCountsPayload(editSkillUpgradationDayCounts),
                multiSkillingDayCounts: buildDayCountsPayload(editMultiSkillingDayCounts)
            }).unwrap();
            logAction({
                action: "UPDATE_SECTION",
                details: {
                    id: editingSection.id || editingSection._id,
                    name: editName,
                    uniCode: trimmedEditUniCode,
                    category: editCategory,
                    daily5mFormType: editFormTypes.join(","),
                    tenCycleFormType: editTenCycleFormTypes.join(","),
                },
            });
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

                    {canCreate && (
                        <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                            <IconPlus className="h-4 w-4" />
                            Add Section
                        </Button>
                    )}

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} className="max-w-[95vw] sm:max-w-[900px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Section</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                {/* Left column: core details */}
                                <div className="space-y-4">
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
                                        <Label htmlFor="uniCode">UniCode (Required, Unique)</Label>
                                        <Input
                                            id="uniCode"
                                            placeholder="e.g., SEC-001"
                                            value={newSectionUniCode}
                                            onChange={(e) => setNewSectionUniCode(e.target.value)}
                                            required
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
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description (Optional)</Label>
                                        <Input
                                            id="description"
                                            placeholder="Brief description of the section"
                                            value={newSectionDescription}
                                            onChange={(e) => setNewSectionDescription(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Right column: form types & day counts */}
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <Label className="text-slate-500 font-bold uppercase text-[10px]">Daily 5M Form Types (Select Multiple)</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {FORM_TYPES.map(type => (
                                                <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                    <Checkbox
                                                        id={`new-${type.id}`}
                                                        checked={newSectionFormTypes.includes(type.id)}
                                                        onCheckedChange={() => toggleFormType(type.id, 'create')}
                                                    />
                                                    <Label htmlFor={`new-${type.id}`} className="cursor-pointer flex-1 text-sm font-medium">
                                                        {type.label}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {newSectionFormTypes.length === 0 && (
                                            <p className="text-[11px] text-red-500 italic">Please select at least one form type.</p>
                                        )}
                                    </div>
                                    <div className="space-y-4 pt-2 border-t">
                                        <Label className="text-slate-500 font-bold uppercase text-[10px]">10-Cycle Sheet Form Types (Select Multiple)</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {TEN_CYCLE_FORM_TYPES.map(type => (
                                                <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                    <Checkbox
                                                        id={`new-10c-${type.id}`}
                                                        checked={newSectionTenCycleFormTypes.includes(type.id)}
                                                        onCheckedChange={() => toggleFormType(type.id, 'create', '10cycle')}
                                                    />
                                                    <Label htmlFor={`new-10c-${type.id}`} className="cursor-pointer flex-1 text-sm font-medium">
                                                        {type.label}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {newSectionTenCycleFormTypes.length === 0 && (
                                            <p className="text-[11px] text-red-500 italic">Please select at least one 10-cycle form type.</p>
                                        )}
                                    </div>
                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-slate-500 font-bold uppercase text-[10px]">Check Sheet Visibility</Label>
                                        <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <Checkbox
                                                id="new-hide-ten-cycle"
                                                checked={newSectionHideTenCycle}
                                                onCheckedChange={(checked) => setNewSectionHideTenCycle(!!checked)}
                                            />
                                            <Label htmlFor="new-hide-ten-cycle" className="cursor-pointer flex-1 text-sm font-medium">
                                                Hide 10-Cycle Sheet for this section
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <Checkbox
                                                id="new-hide-observance"
                                                checked={newSectionHideOperatorObservance}
                                                onCheckedChange={(checked) => setNewSectionHideOperatorObservance(!!checked)}
                                            />
                                            <Label htmlFor="new-hide-observance" className="cursor-pointer flex-1 text-sm font-medium">
                                                Hide Operator Observance Sheet for this section
                                            </Label>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="skillUpgradationDayCount">Skill Upgradation Day Count (Default)</Label>
                                            <Input
                                                id="skillUpgradationDayCount"
                                                type="number"
                                                min="1"
                                                placeholder="Default: 3 months"
                                                value={newSectionSkillUpgradationDayCount}
                                                onChange={(e) => setNewSectionSkillUpgradationDayCount(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-500 font-bold uppercase text-[10px]">Override by Current Skill Level</Label>
                                            <div className="mt-1 border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-[10px] h-8">Current Skill</TableHead>
                                                            <TableHead className="text-[10px] h-8"></TableHead>
                                                            <TableHead className="text-[10px] h-8">Next Skill Upgradation Plan</TableHead>
                                                            <TableHead className="text-[10px] h-8">No. of Days</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activeLevels.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-xs text-slate-400 text-center py-3">No active skill levels configured</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {activeLevels.map((level, index) => (
                                                            <TableRow key={level.name}>
                                                                <TableCell className="text-xs font-medium py-1">{level.name}</TableCell>
                                                                <TableCell className="text-xs text-slate-400 py-1">→</TableCell>
                                                                <TableCell className="text-xs py-1">{getNextLevelName(index, activeLevels)}</TableCell>
                                                                <TableCell className="py-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        placeholder="Default"
                                                                        value={newSectionSkillUpgradationDayCounts[level.name] ?? ""}
                                                                        onChange={(e) => setNewSectionSkillUpgradationDayCounts(prev => ({ ...prev, [level.name]: e.target.value }))}
                                                                        className="h-8 text-xs w-24"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="multiSkillingDayCount">Multi-Skilling Day Count (Default)</Label>
                                            <Input
                                                id="multiSkillingDayCount"
                                                type="number"
                                                min="1"
                                                placeholder="Default: 3 months"
                                                value={newSectionMultiSkillingDayCount}
                                                onChange={(e) => setNewSectionMultiSkillingDayCount(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-500 font-bold uppercase text-[10px]">Override by Current Skill Level</Label>
                                            <div className="mt-1 border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-[10px] h-8">Current Skill</TableHead>
                                                            <TableHead className="text-[10px] h-8"></TableHead>
                                                            <TableHead className="text-[10px] h-8">Next Skill Upgradation Plan</TableHead>
                                                            <TableHead className="text-[10px] h-8">No. of Days</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activeLevels.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-xs text-slate-400 text-center py-3">No active skill levels configured</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {activeLevels.map((level, index) => (
                                                            <TableRow key={level.name}>
                                                                <TableCell className="text-xs font-medium py-1">{level.name}</TableCell>
                                                                <TableCell className="text-xs text-slate-400 py-1">→</TableCell>
                                                                <TableCell className="text-xs py-1">{getNextLevelName(index, activeLevels)}</TableCell>
                                                                <TableCell className="py-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        placeholder="Default"
                                                                        value={newSectionMultiSkillingDayCounts[level.name] ?? ""}
                                                                        onChange={(e) => setNewSectionMultiSkillingDayCounts(prev => ({ ...prev, [level.name]: e.target.value }))}
                                                                        className="h-8 text-xs w-24"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
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
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} className="max-w-[95vw] sm:max-w-[900px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit Section</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                {/* Left column: core details */}
                                <div className="space-y-4">
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
                                        <Label htmlFor="editUniCode">UniCode (Required, Unique)</Label>
                                        <Input
                                            id="editUniCode"
                                            placeholder="e.g., SEC-001"
                                            value={editUniCode}
                                            onChange={(e) => setEditUniCode(e.target.value)}
                                            required
                                            disabled={!user?.isAdmin}
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
                                    <div className="space-y-2">
                                        <Label htmlFor="editDescription">Description (Optional)</Label>
                                        <Input
                                            id="editDescription"
                                            placeholder="Brief description of the section"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Right column: form types & day counts */}
                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <Label className="text-slate-500 font-bold uppercase text-[10px]">Daily 5M Form Types (Select Multiple)</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {FORM_TYPES.map(type => (
                                                <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                    <Checkbox
                                                        id={`edit-${type.id}`}
                                                        checked={editFormTypes.includes(type.id)}
                                                        onCheckedChange={() => toggleFormType(type.id, 'edit')}
                                                    />
                                                    <Label htmlFor={`edit-${type.id}`} className="cursor-pointer flex-1 text-sm font-medium">
                                                        {type.label}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {editFormTypes.length === 0 && (
                                            <p className="text-[11px] text-red-500 italic">Please select at least one form type.</p>
                                        )}
                                    </div>
                                    <div className="space-y-4 pt-2 border-t">
                                        <Label className="text-slate-500 font-bold uppercase text-[10px]">10-Cycle Sheet Form Types (Select Multiple)</Label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {TEN_CYCLE_FORM_TYPES.map(type => (
                                                <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                    <Checkbox
                                                        id={`edit-10c-${type.id}`}
                                                        checked={editTenCycleFormTypes.includes(type.id)}
                                                        onCheckedChange={() => toggleFormType(type.id, 'edit', '10cycle')}
                                                    />
                                                    <Label htmlFor={`edit-10c-${type.id}`} className="cursor-pointer flex-1 text-sm font-medium">
                                                        {type.label}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        {editTenCycleFormTypes.length === 0 && (
                                            <p className="text-[11px] text-red-500 italic">Please select at least one 10-cycle form type.</p>
                                        )}
                                    </div>
                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-slate-500 font-bold uppercase text-[10px]">Check Sheet Visibility</Label>
                                        <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <Checkbox
                                                id="edit-hide-ten-cycle"
                                                checked={editHideTenCycle}
                                                onCheckedChange={(checked) => setEditHideTenCycle(!!checked)}
                                            />
                                            <Label htmlFor="edit-hide-ten-cycle" className="cursor-pointer flex-1 text-sm font-medium">
                                                Hide 10-Cycle Sheet for this section
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <Checkbox
                                                id="edit-hide-observance"
                                                checked={editHideOperatorObservance}
                                                onCheckedChange={(checked) => setEditHideOperatorObservance(!!checked)}
                                            />
                                            <Label htmlFor="edit-hide-observance" className="cursor-pointer flex-1 text-sm font-medium">
                                                Hide Operator Observance Sheet for this section
                                            </Label>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="editSkillUpgradationDayCount">Skill Upgradation Day Count (Default)</Label>
                                            <Input
                                                id="editSkillUpgradationDayCount"
                                                type="number"
                                                min="1"
                                                placeholder="Default: 3 months"
                                                value={editSkillUpgradationDayCount}
                                                onChange={(e) => setEditSkillUpgradationDayCount(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-500 font-bold uppercase text-[10px]">Override by Current Skill Level</Label>
                                            <div className="mt-1 border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-[10px] h-8">Current Skill</TableHead>
                                                            <TableHead className="text-[10px] h-8"></TableHead>
                                                            <TableHead className="text-[10px] h-8">Next Skill Upgradation Plan</TableHead>
                                                            <TableHead className="text-[10px] h-8">No. of Days</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activeLevels.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-xs text-slate-400 text-center py-3">No active skill levels configured</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {activeLevels.map((level, index) => (
                                                            <TableRow key={level.name}>
                                                                <TableCell className="text-xs font-medium py-1">{level.name}</TableCell>
                                                                <TableCell className="text-xs text-slate-400 py-1">→</TableCell>
                                                                <TableCell className="text-xs py-1">{getNextLevelName(index, activeLevels)}</TableCell>
                                                                <TableCell className="py-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        placeholder="Default"
                                                                        value={editSkillUpgradationDayCounts[level.name] ?? ""}
                                                                        onChange={(e) => setEditSkillUpgradationDayCounts(prev => ({ ...prev, [level.name]: e.target.value }))}
                                                                        className="h-8 text-xs w-24"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="editMultiSkillingDayCount">Multi-Skilling Day Count (Default)</Label>
                                            <Input
                                                id="editMultiSkillingDayCount"
                                                type="number"
                                                min="1"
                                                placeholder="Default: 3 months"
                                                value={editMultiSkillingDayCount}
                                                onChange={(e) => setEditMultiSkillingDayCount(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-500 font-bold uppercase text-[10px]">Override by Current Skill Level</Label>
                                            <div className="mt-1 border rounded-md overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-[10px] h-8">Current Skill</TableHead>
                                                            <TableHead className="text-[10px] h-8"></TableHead>
                                                            <TableHead className="text-[10px] h-8">Next Skill Upgradation Plan</TableHead>
                                                            <TableHead className="text-[10px] h-8">No. of Days</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {activeLevels.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-xs text-slate-400 text-center py-3">No active skill levels configured</TableCell>
                                                            </TableRow>
                                                        )}
                                                        {activeLevels.map((level, index) => (
                                                            <TableRow key={level.name}>
                                                                <TableCell className="text-xs font-medium py-1">{level.name}</TableCell>
                                                                <TableCell className="text-xs text-slate-400 py-1">→</TableCell>
                                                                <TableCell className="text-xs py-1">{getNextLevelName(index, activeLevels)}</TableCell>
                                                                <TableCell className="py-1">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        placeholder="Default"
                                                                        value={editMultiSkillingDayCounts[level.name] ?? ""}
                                                                        onChange={(e) => setEditMultiSkillingDayCounts(prev => ({ ...prev, [level.name]: e.target.value }))}
                                                                        className="h-8 text-xs w-24"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
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
                {!canRead ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        Access Denied. You do not have permission to view sections.
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center p-8"><IconLoader className="animate-spin" /></div>
                ) : error ? (
                    <div className="text-red-500 p-4">Error loading sections: {error.message}</div>
                ) : visibleSections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No sections found for this department. Create one to manage lines.
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-12 text-center"> #</TableHead>
                                    <TableHead>Section Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Form Type</TableHead>
                                    <TableHead className="text-center">Section Count (Users)</TableHead>
                                    <TableHead className="text-right px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleSections
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
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {section.daily5mFormType ? section.daily5mFormType.split(",").map(type => (
                                                                <Badge key={type} variant="secondary" className={`text-[9px] uppercase font-bold py-0 h-4 border-none shadow-none ${
                                                                    type === 'crimping' ? 'bg-orange-100 text-orange-700' :
                                                                    type === 'src' ? 'bg-emerald-100 text-emerald-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {type === 'standard' ? 'Assembly' : 
                                                                     type === 'src' ? 'SRC' : 'Crimping'}
                                                                </Badge>
                                                            )) : (
                                                                <span className="text-xs text-slate-400">None</span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {section.tenCycleFormType ? section.tenCycleFormType.split(",").map(type => (
                                                                <Badge key={type} variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200 uppercase font-bold py-0 h-4">
                                                                    10C: {TEN_CYCLE_FORM_TYPES.find(t => t.id === type)?.label.split(" ")[0] || type}
                                                                </Badge>
                                                            )) : (
                                                                <span className="text-xs text-slate-400">None</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-lg font-bold text-slate-800">{section.sectionCount || 0}</span>
                                                            <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Assigned Users</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right px-6" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1">
                                                                    {canUpdate && (
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => startEditing(section)}>
                                                                            <IconEdit className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handleDeleteSection(sectionId, section.name)}>
                                                                            {isDeleting ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                                                        </Button>
                                                                    )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-slate-50/30 border-b">
                                                        <TableCell colSpan={5} className="p-0">
                                                            <div className="px-12 py-6 border-l-2 border-l-blue-500 bg-white">
                                                                <SectionLineManager sectionId={sectionId} departmentId={departmentId} sectionUserCount={section.sectionCount || 0} />
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
