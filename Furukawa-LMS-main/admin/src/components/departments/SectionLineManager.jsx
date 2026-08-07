import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
    useGetLinesBySectionQuery,
    useCreateLineMutation,
    useUpdateLineMutation,
    useDeleteLineMutation,
} from "@/Redux/AllApi/LineApi";
import { IconPlus, IconEdit, IconLoader, IconCheck, IconX, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import UserAutocomplete from '../common/UserAutocomplete';
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";

const TEN_CYCLE_FORM_TYPES = [
    { id: 'form1', label: 'Logical (Form 1)' },
    { id: 'form2', label: 'Complete (Form 2)' },
    { id: 'form3', label: 'Numerical (Form 3)' }
];

const SectionLineManager = ({ sectionId, departmentId, sectionUserCount = 0 }) => {
    const navigate = useNavigate();
    const { data: linesData, isLoading, error } = useGetLinesBySectionQuery(sectionId);
    const { user } = useSelector((state) => state.auth || {});

    const totalInLines = React.useMemo(() => {
        if (!linesData?.data) return 0;
        return linesData.data.reduce((sum, line) => sum + (line.lineCount || 0), 0);
    }, [linesData]);
    const unassignedCount = sectionUserCount - totalInLines;
    const [createLine, { isLoading: isCreating }] = useCreateLineMutation();
    const [updateLine, { isLoading: isUpdating }] = useUpdateLineMutation();
    const [deleteLine, { isLoading: isDeleting }] = useDeleteLineMutation();
    const [logAction] = useLogActionMutation();

    const [newLineName, setNewLineName] = useState("");
    const [newLineUniCode, setNewLineUniCode] = useState("");
    const [newLineLeaders, setNewLineLeaders] = useState([]);
    const [newLineMentor, setNewLineMentor] = useState("");
    const [isMentorNA, setIsMentorNA] = useState(false);
    const [newLineDescription, setNewLineDescription] = useState("");
    const [newLineRequirement, setNewLineRequirement] = useState("");
    const [newLineTenCycleFormTypes, setNewLineTenCycleFormTypes] = useState(["form1"]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingLine, setEditingLine] = useState(null);

    // Edit Form States
    const [editName, setEditName] = useState("");
    const [editUniCode, setEditUniCode] = useState("");
    const [editLineLeaders, setEditLineLeaders] = useState([]);
    const [editLineMentor, setEditLineMentor] = useState("");
    const [editIsMentorNA, setEditIsMentorNA] = useState(false);
    const [editRequirement, setEditRequirement] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editTenCycleFormTypes, setEditTenCycleFormTypes] = useState([]);

    const toggleFormType = (type, mode = 'create') => {
        const currentTypes = mode === 'create' ? newLineTenCycleFormTypes : editTenCycleFormTypes;
        const setTypes = mode === 'create' ? setNewLineTenCycleFormTypes : setEditTenCycleFormTypes;

        if (currentTypes.includes(type)) {
            setTypes(currentTypes.filter(t => t !== type));
        } else {
            setTypes([...currentTypes, type]);
        }
    };

    const handleCreateLine = async () => {
        if (!newLineName.trim()) {
            toast.error("Line name is required");
            return;
        }

        try {
            await createLine({
                name: newLineName,
                uniCode: newLineUniCode,
                lineLeader: newLineLeaders.join(", "),
                mentor: isMentorNA ? "N/A" : newLineMentor,
                requirement: parseInt(newLineRequirement) || 0,
                departmentId,
                sectionId,
                description: newLineDescription,
                tenCycleFormType: newLineTenCycleFormTypes.join(",")
            }).unwrap();
            logAction({
                action: "CREATE_LINE",
                details: {
                    departmentId,
                    sectionId,
                    name: newLineName,
                    uniCode: newLineUniCode,
                    lineLeaders: newLineLeaders,
                    mentor: isMentorNA ? "N/A" : newLineMentor,
                    requirement: parseInt(newLineRequirement) || 0,
                },
            });
            toast.success("Line created successfully");
            setNewLineName("");
            setNewLineUniCode("");
            setNewLineLeaders([]);
            setNewLineMentor("");
            setIsMentorNA(false);
            setNewLineDescription("");
            setNewLineRequirement("");
            setNewLineTenCycleFormTypes(["form1"]);
            setIsCreateDialogOpen(false);
        } catch (error) {
            toast.error(error.data?.message || "Failed to create line");
        }
    };

    const handleDeleteLine = async (lineId, lineName) => {
        if (!window.confirm("Are you sure you want to delete this line?")) {
            return;
        }

        try {
            await deleteLine(lineId).unwrap();
            logAction({
                action: "DELETE_LINE",
                details: { id: lineId, name: lineName },
            });
            toast.success("Line deleted successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to delete line");
        }
    };

    const startEditing = (line) => {
        setEditingLine(line);
        setEditName(line.name || "");
        setEditUniCode(line.uniCode || "");
        setEditLineLeaders(line.lineLeader ? line.lineLeader.split(", ").filter(Boolean) : []);
        setEditLineMentor(line.mentor === "N/A" ? "" : (line.mentor || ""));
        setEditIsMentorNA(line.mentor === "N/A");
        setEditRequirement(line.requirement?.toString() || "0");
        setEditDescription(line.description || "");
        setEditTenCycleFormTypes(line.tenCycleFormType ? line.tenCycleFormType.split(",") : ["form1"]);
        setIsEditDialogOpen(true);
    };

    const saveEdit = async () => {
        if (!editName.trim()) {
            toast.error("Line name cannot be empty");
            return;
        }

        try {
            await updateLine({
                id: editingLine.id || editingLine._id,
                name: editName,
                uniCode: editUniCode,
                lineLeader: editLineLeaders.join(", "),
                mentor: editIsMentorNA ? "N/A" : editLineMentor,
                requirement: parseInt(editRequirement) || 0,
                description: editDescription,
                tenCycleFormType: editTenCycleFormTypes.join(",")
            }).unwrap();
            logAction({
                action: "UPDATE_LINE",
                details: {
                    id: editingLine.id || editingLine._id,
                    name: editName,
                    uniCode: editUniCode,
                    lineLeaders: editLineLeaders,
                    mentor: editIsMentorNA ? "N/A" : editLineMentor,
                    requirement: parseInt(editRequirement) || 0,
                },
            });
            toast.success("Line updated successfully");
            setIsEditDialogOpen(false);
            setEditingLine(null);
        } catch (error) {
            toast.error(error.data?.message || "Failed to update line");
        }
    };

    const addLeaderToCreate = (user) => {
        const nameAndId = `${user.fullName} (${user.empId})`;
        if (!newLineLeaders.includes(nameAndId)) {
            setNewLineLeaders([...newLineLeaders, nameAndId]);
        }
    };

    const removeLeaderFromCreate = (leader) => {
        setNewLineLeaders(newLineLeaders.filter(l => l !== leader));
    };

    const addLeaderToEdit = (user) => {
        const nameAndId = `${user.fullName} (${user.empId})`;
        if (!editLineLeaders.includes(nameAndId)) {
            setEditLineLeaders([...editLineLeaders, nameAndId]);
        }
    };

    const removeLeaderFromEdit = (leader) => {
        setEditLineLeaders(editLineLeaders.filter(l => l !== leader));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lines in this section</h4>
                <Button size="sm" className="h-8 gap-1" onClick={() => setIsCreateDialogOpen(true)}>
                    <IconPlus className="h-3.5 w-3.5" />
                    New Line
                </Button>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                        <DialogHeader>
                            <DialogTitle>Add New Line</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="lineName">Line Name</Label>
                                <Input
                                    id="lineName"
                                    placeholder="e.g., Assembly Line 1"
                                    value={newLineName}
                                    onChange={(e) => setNewLineName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lineUniCode">UniCode (Unique)</Label>
                                <Input
                                    id="lineUniCode"
                                    placeholder="e.g., L1-XYZ"
                                    value={newLineUniCode}
                                    onChange={(e) => setNewLineUniCode(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lineLeader">Line Leaders</Label>
                                <UserAutocomplete
                                    departmentId={departmentId}
                                    onChange={addLeaderToCreate}
                                    placeholder="Add leader..."
                                    clearOnSelect={true}
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {newLineLeaders.map((leader, i) => (
                                        <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1 pr-1 cursor-default">
                                            <span className="text-[10px]">{leader}</span>
                                            <button 
                                                onClick={() => removeLeaderFromCreate(leader)}
                                                className="hover:bg-slate-300 rounded-full p-0.5"
                                            >
                                                <IconX className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="lineMentor">Mentor</Label>
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id="mentorNA" 
                                            checked={isMentorNA} 
                                            onCheckedChange={setIsMentorNA}
                                        />
                                        <label htmlFor="mentorNA" className="text-xs text-muted-foreground cursor-pointer">N/A</label>
                                    </div>
                                </div>
                                <UserAutocomplete
                                    departmentId={departmentId}
                                    value={isMentorNA ? "N/A" : newLineMentor}
                                    onChange={(user) => setNewLineMentor(`${user.fullName} (${user.empId})`)}
                                    placeholder="Search by name or emp code..."
                                    disabled={isMentorNA}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lineRequirement">Requirement</Label>
                                <Input
                                    id="lineRequirement"
                                    type="number"
                                    placeholder="e.g., 5"
                                    value={newLineRequirement}
                                    onChange={(e) => setNewLineRequirement(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lineDescription">Description (Optional)</Label>
                                <Input
                                    id="lineDescription"
                                    placeholder="Brief description of the line"
                                    value={newLineDescription}
                                    onChange={(e) => setNewLineDescription(e.target.value)}
                                />
                            </div>
                            <div className="space-y-4 pt-2 border-t">
                                <Label className="text-slate-500 font-bold uppercase text-[10px]">10-Cycle Sheet Form Types (Select Multiple)</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {TEN_CYCLE_FORM_TYPES.map(type => (
                                        <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <Checkbox 
                                                id={`new-line-10c-${type.id}`} 
                                                checked={newLineTenCycleFormTypes.includes(type.id)}
                                                onCheckedChange={() => toggleFormType(type.id, 'create')}
                                            />
                                            <Label htmlFor={`new-line-10c-${type.id}`} className="cursor-pointer flex-1 text-sm font-medium">
                                                {type.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                {newLineTenCycleFormTypes.length === 0 && (
                                    <p className="text-[11px] text-red-500 italic">Please select at least one 10-cycle form type.</p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                            <Button size="sm" onClick={handleCreateLine} disabled={isCreating}>
                                {isCreating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Create Line"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Line Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                        <DialogHeader>
                            <DialogTitle>Edit Line</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="editLineName">Line Name</Label>
                                <Input
                                    id="editLineName"
                                    placeholder="e.g., Assembly Line 1"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editLineUniCode">UniCode (Unique)</Label>
                                <Input
                                    id="editLineUniCode"
                                    placeholder="e.g., L1-XYZ"
                                    value={editUniCode}
                                    onChange={(e) => setEditUniCode(e.target.value)}
                                    disabled={!user?.isAdmin}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editLineLeader">Line Leaders</Label>
                                <UserAutocomplete
                                    departmentId={departmentId}
                                    onChange={addLeaderToEdit}
                                    placeholder="Add leader..."
                                    clearOnSelect={true}
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {editLineLeaders.map((leader, i) => (
                                        <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1 pr-1 cursor-default">
                                            <span className="text-[10px]">{leader}</span>
                                            <button 
                                                onClick={() => removeLeaderFromEdit(leader)}
                                                className="hover:bg-slate-300 rounded-full p-0.5"
                                            >
                                                <IconX className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="editLineMentor">Mentor</Label>
                                    <div className="flex items-center gap-2">
                                        <Checkbox 
                                            id="editMentorNA" 
                                            checked={editIsMentorNA} 
                                            onCheckedChange={setEditIsMentorNA}
                                        />
                                        <label htmlFor="editMentorNA" className="text-xs text-muted-foreground cursor-pointer">N/A</label>
                                    </div>
                                </div>
                                <UserAutocomplete
                                    departmentId={departmentId}
                                    value={editIsMentorNA ? "N/A" : editLineMentor}
                                    onChange={(user) => setEditLineMentor(`${user.fullName} (${user.empId})`)}
                                    placeholder="Search by name or emp code..."
                                    disabled={editIsMentorNA}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editLineRequirement">Requirement</Label>
                                <Input
                                    id="editLineRequirement"
                                    type="number"
                                    placeholder="e.g., 5"
                                    value={editRequirement}
                                    onChange={(e) => setEditRequirement(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editLineDescription">Description (Optional)</Label>
                                <Input
                                    id="editLineDescription"
                                    placeholder="Brief description of the line"
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                />
                            </div>
                            <div className="space-y-4 pt-2 border-t">
                                <Label className="text-slate-500 font-bold uppercase text-[10px]">10-Cycle Sheet Form Types (Select Multiple)</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {TEN_CYCLE_FORM_TYPES.map(type => (
                                        <div key={type.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <Checkbox 
                                                id={`edit-line-10c-${type.id}`} 
                                                checked={editTenCycleFormTypes.includes(type.id)}
                                                onCheckedChange={() => toggleFormType(type.id, 'edit')}
                                            />
                                            <Label htmlFor={`edit-line-10c-${type.id}`} className="cursor-pointer flex-1 text-sm font-medium">
                                                {type.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                                {editTenCycleFormTypes.length === 0 && (
                                    <p className="text-[11px] text-red-500 italic">Please select at least one 10-cycle form type.</p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                            <Button size="sm" onClick={saveEdit} disabled={isUpdating}>
                                {isUpdating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-4"><IconLoader className="h-5 w-5 animate-spin" /></div>
            ) : error ? (
                <div className="text-red-500 p-2 text-sm text-center">Error loading lines</div>
            ) : linesData?.data?.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                    No lines in this section.
                </div>
            ) : (
                <div className="border rounded-md">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="h-9 py-2 text-xs">Name</TableHead>
                                <TableHead className="h-9 py-2 text-xs">Leader</TableHead>
                                <TableHead className="h-9 py-2 text-xs">Mentor</TableHead>
                                <TableHead className="h-9 py-2 text-xs">Req.</TableHead>
                                <TableHead className="h-9 py-2 text-xs">Operators</TableHead>
                                <TableHead className="h-9 py-2 text-xs text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {linesData?.data?.map((line) => (
                                <TableRow key={line.id || line._id}>
                                    <TableCell className="py-2">
                                            <div 
                                                className="cursor-pointer hover:text-blue-600 transition-colors"
                                                onClick={() => {
                                                    const baseLayout = window.location.pathname.split('/')[1] || 'admin';
                                                    navigate(`/${baseLayout}/departments/${departmentId}/lines/${line.id || line._id}`);
                                                }}
                                            >
                                                <p className="font-medium text-sm">{line.name}</p>
                                                {line.uniCode && (
                                                    <p className="text-[10px] text-muted-foreground">{line.uniCode}</p>
                                                )}
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {line.tenCycleFormType ? line.tenCycleFormType.split(",").map(type => (
                                                        <Badge key={type} variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200 uppercase font-bold py-0 h-4">
                                                            10C: {TEN_CYCLE_FORM_TYPES.find(t => t.id === type)?.label.split(" ")[0] || type}
                                                        </Badge>
                                                    )) : (
                                                        <span className="text-xs text-slate-400">None</span>
                                                    )}
                                                </div>
                                            </div>
                                    </TableCell>
                                    <TableCell className="py-2 text-sm">{line.lineLeader || "-"}</TableCell>
                                    <TableCell className="py-2 text-sm">{line.mentor || "-"}</TableCell>
                                    <TableCell className="py-2">
                                            <span className="text-sm">{line.requirement || 0}</span>
                                    </TableCell>
                                    <TableCell className="py-2">
                                            <span className="text-sm font-medium">{line.lineCount || 0}</span>
                                    </TableCell>
                                    <TableCell className="py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" onClick={() => startEditing(line)}>
                                                    <IconEdit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => handleDeleteLine(line.id || line._id, line.name)}>
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

            {linesData?.data && linesData.data.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 mt-2 rounded-md bg-slate-50 border text-xs text-slate-600">
                    <span>Lines total: <span className="font-semibold">{totalInLines}</span> operators</span>
                    {unassignedCount > 0 && (
                        <span className="text-amber-600 font-medium">
                            ⚠ {unassignedCount} assigned to section but not to any line
                        </span>
                    )}
                    {unassignedCount === 0 && sectionUserCount > 0 && (
                        <span className="text-green-600 font-medium">All section users assigned to a line</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default SectionLineManager;
