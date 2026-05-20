import React, { useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
    useGetMachinesBySubSectionQuery,
    useCreateMachineMutation,
    useUpdateMachineMutation,
    useDeleteMachineMutation,
} from "@/Redux/AllApi/MachineApi";
import { IconPlus, IconEdit, IconLoader, IconCheck, IconX, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";

const MachineManager = ({ subSectionId, lineId }) => {
    const { data: machinesData, isLoading, error } = useGetMachinesBySubSectionQuery(subSectionId, {
        skip: !subSectionId || isNaN(subSectionId)
    });
    const [createMachine, { isLoading: isCreating }] = useCreateMachineMutation();
    const [updateMachine, { isLoading: isUpdating }] = useUpdateMachineMutation();
    const [deleteMachine, { isLoading: isDeleting }] = useDeleteMachineMutation();
    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeLevels = activeConfigData?.data?.levels || [];

    const [newMachineName, setNewMachineName] = useState("");
    const [newMachineDescription, setNewMachineDescription] = useState("");
    const [newMachineCriticality, setNewMachineCriticality] = useState("Non-Critical");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingMachine, setEditingMachine] = useState(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editCriticality, setEditCriticality] = useState("Non-Critical");

    const handleCreateMachine = async () => {
        if (!newMachineName.trim()) {
            toast.error("Station name is required");
            return;
        }

        try {
            await createMachine({
                name: newMachineName,
                lineId,
                subSectionId,
                description: newMachineDescription,
                criticality: newMachineCriticality
            }).unwrap();
            toast.success("Station created successfully");
            setNewMachineName("");
            setNewMachineDescription("");
            setIsCreateDialogOpen(false);
        } catch (error) {
            toast.error(error.data?.message || "Failed to create station");
        }
    };

    const handleDeleteMachine = async (e, machineId) => {
        e.stopPropagation();
        if (!machineId) {
            toast.error("Invalid machine ID");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this machine? This action cannot be undone.")) {
            return;
        }

        try {
            await deleteMachine(machineId).unwrap();
            toast.success("Machine deleted successfully");
        } catch (error) {
            toast.error(error.data?.message || "Failed to delete machine");
        }
    };

    const startEditing = (e, machine) => {
        e.stopPropagation();
        setEditingMachine(machine);
        setEditName(machine.name || "");
        setEditDescription(machine.description || "");
        setEditCriticality(machine.criticality || "Non-Critical");
        setIsEditDialogOpen(true);
    };

    const saveEdit = async (e) => {
        if (e) e.stopPropagation();
        if (!editName.trim()) {
            toast.error("Machine name cannot be empty");
            return;
        }

        try {
            await updateMachine({
                id: editingMachine.id || editingMachine._id,
                name: editName,
                description: editDescription,
                criticality: editCriticality
            }).unwrap();
            toast.success("Machine updated successfully");
            setIsEditDialogOpen(false);
            setEditingMachine(null);
        } catch (error) {
            toast.error(error.data?.message || "Failed to update machine");
        }
    };

    const navigate = useNavigate();
    const { departmentId } = useParams();
    const { pathname } = useLocation();

    // Determine the base path (e.g., /admin, /instructor, /trainer)
    const baseLayout = pathname.split('/')[1] || 'admin';

    const handleRowClick = (stationId) => {
        if (!stationId || !departmentId || !lineId || !subSectionId) {
            console.error("Missing navigation parameters:", { departmentId, lineId, subSectionId, stationId });
            toast.error("Invalid station data. Navigation failed.");
            return;
        }
        // Use dynamic base layout instead of hardcoding /admin/
        navigate(`/${baseLayout}/departments/${departmentId}/lines/${lineId}/sub-sections/${subSectionId}/machines/${stationId}`);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Section Stations</CardTitle>
                    <CardDescription>Manage stations for this sub-section</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="gap-2" onClick={() => setIsCreateDialogOpen(true)}>
                        <IconPlus className="h-4 w-4" />
                        Add Station
                    </Button>

                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                        <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                            <DialogHeader>
                                <DialogTitle>Add New Station</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Station Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Station A"
                                        value={newMachineName}
                                        onChange={(e) => setNewMachineName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Input
                                        id="description"
                                        placeholder="Brief description"
                                        value={newMachineDescription}
                                        onChange={(e) => setNewMachineDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="criticality">Criticality</Label>
                                    <Select 
                                        value={newMachineCriticality} 
                                        onValueChange={setNewMachineCriticality}
                                    >
                                        <SelectTrigger id="criticality">
                                            <SelectValue placeholder="Select criticality" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Critical">Critical</SelectItem>
                                            <SelectItem value="Non-Critical">Non-Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreateMachine} disabled={isCreating}>
                                    {isCreating ? <IconLoader className="h-4 w-4 animate-spin" /> : "Create Station"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Station Dialog */}
                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogContent className="sm:max-w-[425px] bg-white/95 backdrop-blur-sm border-white/20 shadow-xl">
                            <DialogHeader>
                                <DialogTitle>Edit Station</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="editName">Station Name</Label>
                                    <Input
                                        id="editName"
                                        placeholder="e.g., Station A"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editDescription">Description (Optional)</Label>
                                    <Input
                                        id="editDescription"
                                        placeholder="Brief description"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="editCriticality">Criticality</Label>
                                    <Select 
                                        value={editCriticality} 
                                        onValueChange={setEditCriticality}
                                    >
                                        <SelectTrigger id="editCriticality">
                                            <SelectValue placeholder="Select criticality" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Critical">Critical</SelectItem>
                                            <SelectItem value="Non-Critical">Non-Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8"><IconLoader className="animate-spin" /></div>
                ) : error ? (
                    <div className="text-red-500 p-4">Error loading stations: {error.message}</div>
                ) : machinesData?.data?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No stations found for this sub-section. Create one to get started.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Station Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Criticality</TableHead>
                                <TableHead>Operators</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {machinesData?.data?.map((machine) => (
                                <TableRow
                                    key={machine.id || machine._id}
                                    className="hover:bg-gray-100 cursor-pointer"
                                    onClick={() => handleRowClick(machine.id || machine._id)}
                                >
                                    <TableCell className="font-medium">
                                        <div>
                                            <p className="font-medium">{machine.name}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>{machine.description || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant={machine.criticality === "Critical" ? "destructive" : "secondary"} className="text-[10px] uppercase font-bold">
                                            {machine.criticality || "Non-Critical"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">{machine.machineCount || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={(e) => startEditing(e, machine)}>
                                                <IconEdit className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={(e) => handleDeleteMachine(e, machine.id || machine._id)}>
                                                {isDeleting ? <IconLoader className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                                            </Button>
                                        </div>
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

export default MachineManager;
