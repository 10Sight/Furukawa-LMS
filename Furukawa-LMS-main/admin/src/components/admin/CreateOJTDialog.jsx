import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { IconLoader, IconPlus } from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { 
    useGetMachinesBySubSectionQuery,
    useGetMachinesByLineQuery,
    useGetMachinesBySectionQuery,
    useGetMachinesByDepartmentQuery
} from "@/Redux/AllApi/MachineApi";
import { useCreateOnJobTrainingMutation } from "@/Redux/AllApi/OnJobTrainingApi";
import { toast } from "sonner";

const CreateOJTDialog = ({ open, onOpenChange, onSuccess, initialDepartmentId = "", initialSectionId = "", initialLineId = "", initialSubSectionId = "" }) => {
    const [name, setName] = useState("");
    const [departmentId, setDepartmentId] = useState("");
    const [sectionId, setSectionId] = useState("");
    const [lineId, setLineId] = useState("");
    const [subSectionId, setSubSectionId] = useState("");
    const [machineId, setMachineId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Fetch Hierarchy Data
    const { data: deptData, isLoading: deptLoading } = useGetAllDepartmentsQuery({ page: 1, limit: 100 });
    const { data: sectionData, isLoading: sectionLoading } = useGetSectionsByDepartmentQuery(departmentId, { skip: !departmentId });
    const { data: lineData, isLoading: lineLoading } = useGetLinesBySectionQuery(sectionId, { skip: !sectionId });
    const { data: subSectionData, isLoading: subSectionLoading } = useGetSubSectionsByLineQuery(lineId, { skip: !lineId });

    // 2. Fetch Machines Cascadingly
    const { data: machinesBySS, isLoading: machinesBySSLoading } = useGetMachinesBySubSectionQuery(subSectionId, { skip: !subSectionId });
    const { data: machinesByLine, isLoading: machinesByLineLoading } = useGetMachinesByLineQuery(lineId, { skip: !lineId || !!subSectionId });
    const { data: machinesBySection, isLoading: machinesBySectionLoading } = useGetMachinesBySectionQuery(sectionId, { skip: !sectionId || !!lineId });
    const { data: machinesByDept, isLoading: machinesByDeptLoading } = useGetMachinesByDepartmentQuery(departmentId, { skip: !departmentId || !!sectionId });



    const [createOJT] = useCreateOnJobTrainingMutation();

    // Data lists mapping
    const departments = deptData?.data?.departments || [];
    const sections = sectionData?.data || [];
    const lines = lineData?.data || [];
    const subSections = subSectionData?.data || [];
    
    let machines = [];
    let machinesLoading = false;
    if (subSectionId) {
        machines = machinesBySS?.data || [];
        machinesLoading = machinesBySSLoading;
    } else if (lineId) {
        machines = machinesByLine?.data || [];
        machinesLoading = machinesByLineLoading;
    } else if (sectionId) {
        machines = machinesBySection?.data || [];
        machinesLoading = machinesBySectionLoading;
    } else if (departmentId) {
        machines = machinesByDept?.data || [];
        machinesLoading = machinesByDeptLoading;
    }

    // Reset/Initialize fields on open/close
    useEffect(() => {
        if (open) {
            if (initialDepartmentId) setDepartmentId(initialDepartmentId);
            if (initialSectionId) setSectionId(initialSectionId);
            if (initialLineId) setLineId(initialLineId);
            if (initialSubSectionId) setSubSectionId(initialSubSectionId);
        } else {
            setDepartmentId("");
            setSectionId("");
            setLineId("");
            setSubSectionId("");
            setMachineId("");
            setName("");
        }
    }, [open, initialDepartmentId, initialSectionId, initialLineId, initialSubSectionId]);

    // Handle form submit
    const handleSubmit = async () => {
        if (!departmentId) {
            toast.error("Please select a Department");
            return;
        }
        if (!sectionId) {
            toast.error("Please select a Section");
            return;
        }
        if (!name) {
            toast.error("Please specify a Training Name");
            return;
        }

        try {
            setIsSubmitting(true);
            await createOJT({
                departmentId,
                sectionId,
                lineId: lineId || null,
                subSectionId: subSectionId || null,
                machineId: machineId || null,
                name,
            }).unwrap();

            toast.success("OJT Session Created Successfully");
            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            toast.error(error?.data?.message || "Failed to create OJT session");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] rounded-xl shadow-lg border border-slate-100 p-6">
                <DialogHeader className="pb-2 border-b border-slate-50">
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">
                        Start New OJT Session
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-xs">
                        Configure the training session details and select the target operator context.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
                    {/* Training Name */}
                    <div className="grid gap-1">
                        <Label className="text-xs font-bold text-slate-600">Training Name / Topic</Label>
                        <Input
                            placeholder="e.g. Level-1 Practical Evaluation"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="h-10 text-sm border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg shadow-sm"
                        />
                    </div>

                    {/* Department */}
                    <div className="grid gap-1">
                        <Label className="text-xs font-bold text-slate-600">Department <span className="text-red-500">*</span></Label>
                        <Select value={departmentId} onValueChange={(val) => { 
                            setDepartmentId(val); 
                            setSectionId(""); 
                            setLineId(""); 
                            setSubSectionId(""); 
                            setMachineId(""); 
                        }}>
                            <SelectTrigger className="h-10 text-sm border-slate-200 focus:border-blue-500 rounded-lg shadow-sm">
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {deptLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : (
                                    departments.map(d => (
                                        <SelectItem key={d._id || d.id} value={String(d._id || d.id)}>{d.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Section */}
                    <div className="grid gap-1">
                        <Label className="text-xs font-bold text-slate-600">Section <span className="text-red-500">*</span></Label>
                        <Select value={sectionId} onValueChange={(val) => { 
                            setSectionId(val); 
                            setLineId(""); 
                            setSubSectionId(""); 
                            setMachineId(""); 
                        }} disabled={!departmentId}>
                            <SelectTrigger className="h-10 text-sm border-slate-200 focus:border-blue-500 rounded-lg shadow-sm">
                                <SelectValue placeholder={!departmentId ? "Select Department first" : "Select Section"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {sectionLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : sections.length === 0 ? (
                                    <SelectItem value="none" disabled>No Sections Found</SelectItem>
                                ) : (
                                    sections.map(s => (
                                        <SelectItem key={s._id || s.id} value={String(s._id || s.id)}>{s.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Line */}
                    <div className="grid gap-1">
                        <Label className="text-xs font-bold text-slate-600 font-medium text-slate-500">Line (Optional)</Label>
                        <Select value={lineId} onValueChange={(val) => { 
                            setLineId(val); 
                            setSubSectionId(""); 
                            setMachineId(""); 
                        }} disabled={!sectionId}>
                            <SelectTrigger className="h-10 text-sm border-slate-200 focus:border-blue-500 rounded-lg shadow-sm">
                                <SelectValue placeholder={!sectionId ? "Select Section first" : "Select Line"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {lineLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : lines.length === 0 ? (
                                    <SelectItem value="none" disabled>No Lines Found</SelectItem>
                                ) : (
                                    lines.map(l => (
                                        <SelectItem key={l._id || l.id} value={String(l._id || l.id)}>{l.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Sub-Section */}
                    <div className="grid gap-1">
                        <Label className="text-xs font-bold text-slate-600 font-medium text-slate-500">Sub-Section (Optional)</Label>
                        <Select value={subSectionId} onValueChange={(val) => { 
                            setSubSectionId(val); 
                            setMachineId(""); 
                        }} disabled={!lineId}>
                            <SelectTrigger className="h-10 text-sm border-slate-200 focus:border-blue-500 rounded-lg shadow-sm">
                                <SelectValue placeholder={!lineId ? "Select Line first" : "Select Sub-Section"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {subSectionLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : subSections.length === 0 ? (
                                    <SelectItem value="none" disabled>No Sub-Sections Found</SelectItem>
                                ) : (
                                    subSections.map(ss => (
                                        <SelectItem key={ss._id || ss.id} value={String(ss._id || ss.id)}>{ss.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Machine */}
                    <div className="grid gap-1">
                        <Label className="text-xs font-bold text-slate-600 font-medium text-slate-500">Machine / Station (Optional)</Label>
                        <Select value={machineId} onValueChange={setMachineId} disabled={!departmentId}>
                            <SelectTrigger className="h-10 text-sm border-slate-200 focus:border-blue-500 rounded-lg shadow-sm">
                                <SelectValue placeholder={!departmentId ? "Select Department first" : "Select Machine"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {machinesLoading ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                ) : machines.length === 0 ? (
                                    <SelectItem value="none" disabled>No Machines Found</SelectItem>
                                ) : (
                                    machines.map(m => (
                                        <SelectItem key={m._id || m.id} value={String(m._id || m.id)}>{m.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                </div>

                <DialogFooter className="pt-4 border-t border-slate-50 gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 rounded-lg">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !departmentId || !sectionId || !name}
                        className="h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium shadow-sm transition-all"
                    >
                        {isSubmitting ? (
                            <IconLoader className="animate-spin h-4 w-4 mr-2" />
                        ) : (
                            <IconPlus className="h-4 w-4 mr-2" />
                        )}
                        Start OJT Session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateOJTDialog;
