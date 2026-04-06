import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetLinesBySectionQuery, useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';
import { useGetMachinesByLineQuery, useGetMachinesBySubSectionQuery } from '@/Redux/AllApi/MachineApi';
import { useGetActiveConfigQuery } from '@/Redux/AllApi/CourseLevelConfigApi';
import { useLazyGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { useLazyGetAllUsersQuery } from '@/Redux/AllApi/UserApi';
import { useGetSubSectionsQuery } from '@/Redux/AllApi/SubSectionApi';
import { Button } from "@/components/ui/button";
import { 
    IconSettings, 
    IconPrinter, 
    IconClipboardList, 
    IconPlus, 
    IconArrowLeft, 
    IconSearch, 
    IconTrash, 
    IconExternalLink, 
    IconCheck, 
    IconX,
    IconScissors,
    IconLayout2,
    IconCpu 
} from "@tabler/icons-react";
import AssignmentSelect from "@/components/common/AssignmentSelect";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const AssignmentManagementDialog = ({ open, onOpenChange, departmentId, departmentName }) => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [trigger, { data: searchResults, isFetching: isSearching }] = useLazyGetAllUsersQuery();
    const [selectedRole, setSelectedRole] = useState("PROCESS_OWNER");

    const roles = [
        { id: "PROCESS_OWNER", label: "Process Owner" },
        { id: "APPROVED_BY", label: "Approved By (QA Incharge)" },
        { id: "QA_SHIFT_INCHARGE", label: "QA Shift In-charge" }
    ];

    const fetchAssignments = async () => {
        if (!departmentId) return;
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/api/daily-5m/assignments/${departmentId}`);
            if (response.data.success) {
                setAssignments(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching assignments:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) fetchAssignments();
    }, [open, departmentId]);

    const handleSearch = (val) => {
        setSearchTerm(val);
        if (val.length >= 2) {
            trigger({ search: val, limit: 10, isStaff: "true" });
        }
    };

    const handleAdd = async (user) => {
        try {
            const response = await axiosInstance.post('/api/daily-5m/assignments/add', {
                departmentId,
                role: selectedRole,
                userId: user.id || user._id,
                userName: user.fullName
            });
            if (response.data.success) {
                toast.success("User assigned successfully");
                fetchAssignments();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to assign user");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to remove this assignment?")) return;
        try {
            const response = await axiosInstance.delete(`/api/daily-5m/assignments/${id}`);
            if (response.data.success) {
                toast.success("Assignment removed");
                fetchAssignments();
            }
        } catch (error) {
            toast.error("Failed to remove assignment");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[600px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage People - {departmentName}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-1 space-y-6">
                    <div className="space-y-4 border p-4 rounded-lg bg-slate-50">
                        <h3 className="font-bold text-sm uppercase text-slate-500">Add New Assignment</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Select Role</Label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Search Person (ID or Name)</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="Type to search..."
                                        value={searchTerm}
                                        onChange={(e) => handleSearch(e.target.value)}
                                    />
                                    {isSearching && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-slate-400" />}
                                </div>
                            </div>
                        </div>

                        {searchTerm.length >= 2 && searchResults?.data?.users?.length > 0 && (
                            <div className="border rounded-md bg-white shadow-sm max-h-[150px] overflow-auto z-[9999]">
                                {searchResults.data.users.map(u => (
                                    <div
                                        key={u.id || u._id}
                                        className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center border-b last:border-0"
                                        onClick={() => handleAdd(u)}
                                    >
                                        <div>
                                            <div className="font-bold text-sm">{u.fullName}</div>
                                            <div className="text-[16px] text-slate-500">ID: {u.empId}</div>
                                        </div>
                                        <Button size="xs" variant="ghost" className="text-blue-600">Add</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-sm uppercase text-slate-500">Current Assignments</h3>
                        {loading ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
                        ) : assignments.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-lg">No assignments found</div>
                        ) : (
                            <div className="space-y-2">
                                {roles.map(role => {
                                    const roleAssignments = assignments.filter(a => a.role === role.id);
                                    if (roleAssignments.length === 0) return null;
                                    return (
                                        <div key={role.id} className="space-y-1">
                                            <div className="text-[16px] font-bold text-slate-400 ml-1 uppercase">{role.label}</div>
                                            {roleAssignments.map(a => (
                                                <div key={a.id} className="flex justify-between items-center p-2 bg-white border rounded-md group hover:border-blue-300">
                                                    <span className="text-sm font-medium">{a.userName}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDelete(a.id)}
                                                    >
                                                        <IconTrash size={16} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import UserAutocomplete from '@/components/common/UserAutocomplete';




const LineSelect = ({ recIndex, departmentId, formData, onInputChange }) => {
    const { data: linesData, isLoading } = useGetLinesByDepartmentQuery(departmentId, { skip: !departmentId });
    const lines = linesData?.data || [];

    return (
        <select
            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
            value={formData[`rec_${recIndex}_From`] || ""}
            onChange={(e) => onInputChange(recIndex, 'From', e.target.value)}
            disabled={!departmentId}
        >
            <option value="">{isLoading ? "Loading..." : "Select Line"}</option>
            {lines.map((line, idx) => (
                <option key={line.id || line._id || idx} value={line.name}>
                    {line.name} {line.sectionName ? `(${line.sectionName})` : ''}
                </option>
            ))}
        </select>
    );
};

const SubSectionSelect = ({ recIndex, departmentId, formData, onInputChange }) => {
    const { data: subSectionsData, isLoading } = useGetSubSectionsQuery({ departmentId }, { skip: !departmentId });
    const subSections = subSectionsData?.data || [];

    return (
        <select
            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
            value={formData[`rec_${recIndex}_StationMC`] || ""}
            onChange={(e) => {
                const val = e.target.value;
                onInputChange(recIndex, 'StationMC', val);
                // Clear process when station/mc changes
                onInputChange(recIndex, 'Process', "");
            }}
            disabled={!departmentId}
        >
            <option value="">{isLoading ? "Loading..." : "Select Station M/C"}</option>
            {subSections.map((ss, idx) => {
                const displayName = ss.lineName ? `${ss.name} (${ss.lineName})` : ss.name;
                return (
                    <option key={ss.id || ss._id || idx} value={displayName}>
                        {displayName}
                    </option>
                );
            })}
        </select>
    );
};

const StationSelect = ({ recIndex, selectedSubSectionDisplayName, departmentId, formData, onInputChange }) => {
    const { data: subSectionsData } = useGetSubSectionsQuery({ departmentId }, { skip: !departmentId });
    const subSections = subSectionsData?.data || [];

    // Find the subSection object to get its ID
    const subSection = subSections.find(ss => {
        const displayName = ss.lineName ? `${ss.name} (${ss.lineName})` : ss.name;
        return displayName === selectedSubSectionDisplayName;
    });
    const subSectionId = subSection?.id || subSection?._id;

    const { data: machinesData, isLoading } = useGetMachinesBySubSectionQuery(subSectionId, { skip: !subSectionId });
    const machines = machinesData?.data || [];

    return (
        <select
            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
            value={formData[`rec_${recIndex}_Process`] || ""}
            onChange={(e) => onInputChange(recIndex, 'Process', e.target.value)}
            disabled={!subSectionId}
        >
            <option value="">{isLoading ? "Loading..." : "Select Process"}</option>
            {machines.map((m, idx) => (
                <option key={m.id || m._id || idx} value={m.name}>
                    {m.name}
                </option>
            ))}
        </select>
    );
};

const ProcessSelect = ({ recIndex, selectedLineName, allLines, formData, onInputChange }) => {
    const line = allLines.find(l => l.name === selectedLineName);
    const lineId = line?.id || line?._id;
    // console.log(`[ProcessSelect] Row ${recIndex}: Line=${selectedLineName}, ID=${lineId}`);
    const { data: machinesData, isLoading } = useGetMachinesByLineQuery(lineId, { skip: !lineId });
    const machines = machinesData?.data || [];

    // Auto-migrate old values (machine name only) to new format (subsection (machine))
    useEffect(() => {
        const currentValue = formData[`rec_${recIndex}_Process`];
        if (currentValue && machines.length > 0) {
            const machine = machines.find(m => m.name === currentValue);
            if (machine && machine.subSectionName) {
                const newDisplayName = `${machine.subSectionName} (${machine.name})`;
                // If it's a exact match for machine name but not the new format, upgrade it
                if (currentValue === machine.name && currentValue !== newDisplayName) {
                    onInputChange(recIndex, 'Process', newDisplayName);
                }
            }
        }
    }, [machines, formData[`rec_${recIndex}_Process`], recIndex, onInputChange]);

    return (
        <select
            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
            value={formData[`rec_${recIndex}_Process`] || ""}
            onChange={(e) => onInputChange(recIndex, 'Process', e.target.value)}
            disabled={!lineId}
        >
            <option value="">{isLoading ? "Loading..." : "Select Process"}</option>
            {machines.map((m, idx) => {
                const displayName = m.subSectionName ? `${m.subSectionName} (${m.name})` : m.name;
                const currentValue = formData[`rec_${recIndex}_Process`] || "";

                // For backward compatibility: if the saved value is just the machine name, 
                // we want it to match the option with that machine name.
                const isMatch = currentValue === displayName || currentValue === m.name;

                return (
                    <option
                        key={m.id || m._id || idx}
                        value={displayName}
                    // Manual selection if it matches old format
                    >
                        {displayName}
                    </option>
                );
            })}
            {/* Fallback for saved values that don't match current machine list but exist in formData */}
            {formData[`rec_${recIndex}_Process`] && !machines.some(m => (m.subSectionName ? `${m.subSectionName} (${m.name})` : m.name) === formData[`rec_${recIndex}_Process`] || m.name === formData[`rec_${recIndex}_Process`]) && (
                <option value={formData[`rec_${recIndex}_Process`]}>{formData[`rec_${recIndex}_Process`]}</option>
            )}
        </select>
    );
};

const ProblemSelect = ({ recIndex, value, onChange }) => {
    const options = [
        "Associate on planned leave",
        "Absent without information (During start of shift)",
        "New associates",
        "Job Rotation",
        "Multi-skill",
        "Associate work after Long vacation (1 month)",
        "Planned Gate pass",
        "Other"
    ];

    // Check if the current value is one of the predefined options (excluding "Other")
    const isPredefined = options.slice(0, -1).includes(value);
    const showOtherInput = value === "Other" || (value && !isPredefined);

    return (
        <div className="flex flex-col gap-1 min-w-[120px]">
            <select
                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px] font-semibold text-blue-800"
                value={isPredefined ? value : (value ? "Other" : "")}
                onChange={(e) => {
                    const val = e.target.value;
                    onChange(recIndex, 'Problem', val);
                }}
            >
                <option value="">Select Problem</option>
                {options.map((opt, idx) => (
                    <option key={idx} value={opt}>{opt}</option>
                ))}
            </select>
            {showOtherInput && (
                <AutoResizeTextarea
                    placeholder="Enter problem details..."
                    value={value === "Other" ? "" : value}
                    onChange={(e) => onChange(recIndex, 'Problem', e.target.value)}
                    className="text-blue-600 font-bold border-t border-dashed border-blue-200 pt-1"
                />
            )}
        </div>
    );
};

const AutoResizeTextarea = ({ value, onChange, placeholder, className, ...props }) => {
    return (
        <div className="grid w-full min-w-[30px] relative">
            <div
                className={cn("invisible whitespace-pre-wrap break-words min-h-[1.2rem] px-0.5 py-0.5 m-0 text-left pointer-events-none text-[16px]", className)}
                style={{ gridArea: '1 / 1 / 2 / 2' }}
            >
                {value || placeholder || ' '}
            </div>
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={cn("bg-transparent resize-none overflow-hidden focus:outline-none w-full h-full px-0.5 py-0.5 m-0 block text-black z-10 text-[16px]", className)}
                style={{ gridArea: '1 / 1 / 2 / 2' }}
                rows={1}
                {...props}
            />
        </div>
    );
};

const DaysInput = ({ value, onChange }) => {
    const [isFocused, setIsFocused] = useState(false);

    const calculateDays = (targetDate) => {
        if (!targetDate) return "";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(targetDate);
        if (isNaN(target.getTime())) return targetDate;

        target.setHours(0, 0, 0, 0);
        const diffTime = target.getTime() - today.getTime();
        // Math.round handles the floating point issues with daylight savings etc.
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

        return `${diffDays} days`;
    };

    return (
        <input
            type={isFocused ? "date" : "text"}
            className="w-full text-center bg-transparent outline-none h-7 text-[16px]"
            value={isFocused ? value : (calculateDays(value) || "")}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Select Date"
        />
    );
};

const CRIMPING_CONFIG = {
    headers: [
        // Row 1
        [{ text: "Daily 5M Recording Man -Crimping section", colSpan: 40, className: "bg-blue-50 text-lg font-bold" }],
        // Row 2
        [{ text: "*If any part NG during retroactive and containment inspection then 100% parts to be check since last OK (Set up / In-process)", colSpan: 40, className: "bg-yellow-50 text-red-600 font-semibold text-[16px]" }],
        // Row 3
        [
            { text: "(To be filled by Leader / Supervisor)", colSpan: 16, className: "bg-gray-100" },
            { text: "Retroactive Inspection (To be filled by Leader / Supervisor Before Change)", colSpan: 6, className: "bg-gray-100" },
            { text: "Set up Approval After Change (To be filled by Quality dept., Pick 5 samples for judgement)", colSpan: 9, className: "bg-gray-100" },
            { text: "Containment Action if required", colSpan: 7, className: "bg-gray-100" },
            { text: "Process Owner", rowSpan: 3, width: "w-20" },
            { text: "Approved By (QA Incharge)", rowSpan: 3, width: "w-20" }
        ],
        // Row 4
        [
            { text: "Sr. No.", rowSpan: 2, width: "w-8" },
            { text: "Date", rowSpan: 2, width: "w-20" },
            { text: "Station M/C No", rowSpan: 2, width: "w-24" },
            { text: "Shift", rowSpan: 2, width: "w-10" },
            { text: "Planned / Un-Planned", rowSpan: 2, width: "w-16" },
            { text: "Process Name", rowSpan: 2, width: "w-32" },
            { text: "Process Operator ID / Inspector ID", rowSpan: 2, width: "w-20" },
            { text: "Process Operator / Inspector Name", rowSpan: 2 },
            { text: "Owner Skill Level", rowSpan: 2 },
            { text: "Req. Min Skill Level", rowSpan: 2, width: "w-10" },
            { text: "Deputy Person Name (If req.)", rowSpan: 2, width: "w-20" },
            { text: "Employee Code", rowSpan: 2, width: "w-16" },
            { text: "Actual Skill Level", rowSpan: 2, width: "w-10" },
            { text: "Deputed From (Line/Process/Station)", rowSpan: 2, width: "w-16" },
            { text: "Deputed on Plan", rowSpan: 2, width: "w-20" },
            { text: "OJT Status (Attended/Not Attended) [Attached OJT sheet]", rowSpan: 2, width: "w-12" },

            { text: "Last Produced Part Status (Parameters)", rowSpan: 2, width: "w-20" },
            { text: "Standard", colSpan: 2 },
            { text: "Result", colSpan: 2 },
            { text: "Status", rowSpan: 2, isSplit: true, splitLabels: ["Status", "Prod Supr Sign"] },

            { text: "Inspector Name", rowSpan: 2, width: "w-20" },
            { text: "Part No.", rowSpan: 2, width: "w-16" },
            { text: "Lot No.", rowSpan: 2, width: "w-16" },
            { text: "Circuit No.", rowSpan: 2, width: "w-12" },
            { text: "Set up Verification (Parameters)", rowSpan: 2, width: "w-24" },
            { text: "Result (After Change)", colSpan: 2 },
            { text: "QA Shift In-charge name", rowSpan: 2, width: "w-20" },
            { text: "Status", rowSpan: 2, width: "w-10" },

            { text: "Support Person Name", rowSpan: 2, width: "w-20" },
            { text: "Visual Check (100%)", colSpan: 2 },
            { text: "Dimension Check (Every 2 hours)", colSpan: 3 },
            { text: "Remarks", rowSpan: 2, width: "w-24" }
        ],
        // Row 5
        [
            // Retro Sub
            { text: "F" }, { text: "R" }, { text: "F" }, { text: "R" },
            // Setup Sub
            { text: "F" }, { text: "R" },
            // Containment Sub
            { text: "Produce d Qty." }, { text: "NG Qty." },
            { text: "1st Check" }, { text: "2nd Check" }, { text: "3rd Check" }
        ]
    ],
    bodyRows: 5
};

const CrimpingRecord = ({ recIndex, formData, handleInputChange, lines, skillLevels, departmentId }) => {
    const params = ['C/H', 'I/H', 'Strength', 'Length', 'Visual'];

    return (
        <>
            {/* Row 1: Common fields and first parameter */}
            <tr className="hover:bg-slate-50">
                <td rowSpan="5" className="border border-black p-0.5 text-center">{recIndex + 1}</td>
                <td rowSpan="5" className="border border-black p-0.5"><input type="date" className="w-full text-center bg-transparent h-7 text-[16px]" placeholder="Date" value={formData[`rec_${recIndex}_Date`] || ""} onChange={(e) => handleInputChange(recIndex, 'Date', e.target.value)} /></td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <SubSectionSelect
                        recIndex={recIndex}
                        departmentId={departmentId}
                        formData={formData}
                        onInputChange={handleInputChange}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_Shift`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'Shift', e.target.value)}
                    >
                        <option value="">Select Shift</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="G">G</option>
                        <option value="C">C</option>
                    </select>
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_Type`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'Type', e.target.value)}
                    >
                        <option value="">Select Type</option>
                        <option value="Planned">Planned</option>
                        <option value="Un-Planned">Un-Planned</option>
                    </select>
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <StationSelect
                        recIndex={recIndex}
                        selectedSubSectionDisplayName={formData[`rec_${recIndex}_StationMC`]}
                        departmentId={departmentId}
                        formData={formData}
                        onInputChange={handleInputChange}
                    />
                </td>

                {/* Auth Person (Operator/Inspector Name, Career Skill Level) */}
                <td rowSpan="5" className="border border-black p-0.5 text-center font-mono text-[16px]">
                    {formData[`rec_${recIndex}_OperatorId`] || ""}
                </td>
                <td rowSpan="5" className="border border-black p-0.5 min-w-[100px]">
                    <UserAutocomplete
                        compact
                        departmentId={departmentId}
                        value={formData[`rec_${recIndex}_OperatorName`] || ""}
                        onChange={(user) => {
                            handleInputChange(recIndex, 'OperatorName', user.fullName);
                            handleInputChange(recIndex, 'CSL', user.currentLevel || "L1");
                            handleInputChange(recIndex, 'OperatorId', user.empId || "");
                            handleInputChange(recIndex, 'EmpCode', user.empId || "");
                        }}
                        placeholder="Operator..."
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5 text-center">
                    <AutoResizeTextarea
                        className="text-center"
                        placeholder="Owner Skill"
                        value={formData[`rec_${recIndex}_CSL`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'CSL', e.target.value)}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_ReqSkill`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'ReqSkill', e.target.value)}
                    >
                        <option value="">Req Skill</option>
                        {skillLevels.map((level, idx) => (
                            <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                        ))}
                    </select>
                </td>

                <td rowSpan="5" className="border border-black p-0.5 min-w-[100px]">
                    <UserAutocomplete
                        value={formData[`rec_${recIndex}_DeputedPerson`] || ""}
                        onChange={({ fullName, empId, departmentId, deptName, currentLevel }) => {
                            handleInputChange(recIndex, 'DeputedPerson', fullName);
                            handleInputChange(recIndex, 'EmpCode', empId);
                            handleInputChange(recIndex, 'DeputedDeptId', departmentId);
                            handleInputChange(recIndex, 'DeputedDeptName', deptName);
                            handleInputChange(recIndex, 'ActSkill', currentLevel || "L1");
                        }}
                        placeholder="Deputed Person"
                        compact={true}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5 text-center">
                    <AutoResizeTextarea
                        className="text-center"
                        placeholder="Emp Code"
                        value={formData[`rec_${recIndex}_EmpCode`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'EmpCode', e.target.value)}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_ActSkill`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'ActSkill', e.target.value)}
                    >
                        <option value="">Act Skill</option>
                        {skillLevels.map((level, idx) => (
                            <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                        ))}
                    </select>
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <LineSelect
                        recIndex={recIndex}
                        departmentId={formData[`rec_${recIndex}_DeputedDeptId`]}
                        formData={formData}
                        onInputChange={handleInputChange}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <DaysInput
                        value={formData[`rec_${recIndex}_DeputedOnPlan`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'DeputedOnPlan', e.target.value)}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_OJT`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'OJT', e.target.value)}
                    >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </td>

                {/* Retro Parameters (First of 5) */}
                <td className="border border-black p-0.5 text-center font-bold bg-gray-50"><AutoResizeTextarea className="text-center font-bold bg-transparent" value={formData[`rec_${recIndex}_Param_${params[0]}`] !== undefined ? formData[`rec_${recIndex}_Param_${params[0]}`] : params[0]} onChange={(e) => handleInputChange(recIndex, `Param_${params[0]}`, e.target.value)} /></td>
                <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${params[0]}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${params[0]}_F`, e.target.value)} /></td>
                <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${params[0]}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${params[0]}_R`, e.target.value)} /></td>
                <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${params[0]}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${params[0]}_F`, e.target.value)} /></td>
                <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${params[0]}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${params[0]}_R`, e.target.value)} /></td>
                <td rowSpan="2" className="border border-black p-0.5 text-center align-middle">
                    <div className="flex flex-col h-full items-center justify-center gap-1">
                        <select
                            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                            value={formData[`rec_${recIndex}_Retro_Status_Top`] !== undefined ? formData[`rec_${recIndex}_Retro_Status_Top`] : "OK"}
                            onChange={(e) => handleInputChange(recIndex, 'Retro_Status_Top', e.target.value)}
                        >
                            <option value="OK">OK</option>
                            <option value="Rework">Rework</option>
                            <option value="Scrap">Scrap</option>
                        </select>
                        <div className="w-full h-px bg-black/10" />
                        <AutoResizeTextarea
                            className="text-[8px] text-center"
                            placeholder="Sign"
                            value={formData[`rec_${recIndex}_Retro_Sign_Top`] || ""}
                            onChange={(e) => handleInputChange(recIndex, 'Retro_Sign_Top', e.target.value)}
                        />
                    </div>
                </td>

                {/* Setup Part Info */}
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_InspectorName`] || ""} onChange={(e) => handleInputChange(recIndex, 'InspectorName', e.target.value)} /></td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_PartNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'PartNo', e.target.value)} /></td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_LotNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'LotNo', e.target.value)} /></td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_CircuitNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'CircuitNo', e.target.value)} /></td>

                {/* Setup Verification sub-row */}
                <td className="border border-black p-0.5 text-center font-bold bg-gray-50">
                    <div className="flex flex-col items-center leading-tight">
                        <span>{params[0]}</span>
                        <span className="text-[16px] text-gray-500 font-normal">W/H</span>
                    </div>
                </td>
                <td className="border border-black p-0.5">
                    <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${params[0]}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${params[0]}_F`, e.target.value)} />
                </td>
                <td className="border border-black p-0.5">
                    <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${params[0]}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${params[0]}_R`, e.target.value)} />
                </td>

                <td rowSpan="5" className="border border-black p-0.5 text-[16px]">
                    <AssignmentSelect
                        departmentId={departmentId}
                        role="QA_SHIFT_INCHARGE"
                        value={formData[`rec_${recIndex}_QA_Incharge`] || ""}
                        onChange={(val) => handleInputChange(recIndex, 'QA_Incharge', val)}
                        placeholder="QA Shift IC"
                        className='text-[16px]'
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_Status`] || ""} onChange={(e) => handleInputChange(recIndex, 'Result_Status', e.target.value)} /></td>

                {/* Containment */}
                <td rowSpan="5" className="border border-black p-0.5">
                    <UserAutocomplete
                        value={formData[`rec_${recIndex}_Cont_SupportPerson`] || ""}
                        onChange={({ fullName }) => handleInputChange(recIndex, 'Cont_SupportPerson', fullName)}
                        placeholder="Support Person"
                        compact={true}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Cont_ProdQty`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_ProdQty', e.target.value)} /></td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Cont_NGQty`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_NGQty', e.target.value)} /></td>

                {/* Dimension Check 1st */}
                <td rowSpan="2" className="border border-black p-0.5 align-top">
                    <div className="flex flex-col text-[16px] p-0.5 h-full">
                        <div className="font-semibold mb-1">C/H:</div>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Std1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Std1', e.target.value)} /></label>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Obs1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Obs1', e.target.value)} /></label>
                    </div>
                </td>
                {/* Dimension Check 2nd */}
                <td rowSpan="2" className="border border-black p-0.5 align-top">
                    <div className="flex flex-col text-[16px] p-0.5 h-full">
                        <div className="font-semibold mb-1">C/H:</div>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Std2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Std2', e.target.value)} /></label>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Obs2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Obs2', e.target.value)} /></label>
                    </div>
                </td>
                {/* Dimension Check 3rd */}
                <td rowSpan="2" className="border border-black p-0.5 align-top">
                    <div className="flex flex-col text-[16px] p-0.5 h-full">
                        <div className="font-semibold mb-1">C/H:</div>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Std3`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Std3', e.target.value)} /></label>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Obs3`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Obs3', e.target.value)} /></label>
                    </div>
                </td>
                <td rowSpan="5" className="border border-black p-0.5"><AutoResizeTextarea placeholder="Remarks" value={formData[`rec_${recIndex}_Remarks`] || ""} onChange={(e) => handleInputChange(recIndex, 'Remarks', e.target.value)} /></td>

                <td rowSpan="5" className="border border-black p-0.5">
                    <AssignmentSelect
                        departmentId={departmentId}
                        role="PROCESS_OWNER"
                        value={formData[`rec_${recIndex}_Process_Owner`] || ""}
                        onChange={(val) => handleInputChange(recIndex, 'Process_Owner', val)}
                        placeholder="Select Owner"
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5">
                    <AssignmentSelect
                        departmentId={departmentId}
                        role="APPROVED_BY"
                        value={formData[`rec_${recIndex}_Approved_By`] || ""}
                        onChange={(val) => handleInputChange(recIndex, 'Approved_By', val)}
                        placeholder="Select QA"
                    />
                </td>
            </tr>

            {/* Remaining sub-rows for parameters */}
            {params.slice(1).map(p => (
                <tr key={p} className="hover:bg-slate-50">
                    <td className="border border-black p-0.5 text-center font-bold bg-gray-50"><AutoResizeTextarea className="text-center font-bold bg-transparent" value={formData[`rec_${recIndex}_Param_${p}`] !== undefined ? formData[`rec_${recIndex}_Param_${p}`] : p} onChange={(e) => handleInputChange(recIndex, `Param_${p}`, e.target.value)} /></td>
                    {p === 'Visual' ? (
                        <>
                            <td className="border border-black p-0.5 text-center text-[16px] bg-gray-50 font-bold">Total Qty</td>
                            <td className="border border-black p-0.5"><input type="text" className="w-full text-center bg-transparent h-7 text-[16px]" value={formData[`rec_${recIndex}_Retro_${p}_TQ`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_TQ`, e.target.value)} /></td>
                            <td className="border border-black p-0.5 text-center text-[16px] bg-gray-50 font-bold">NG Qty</td>
                            <td className="border border-black p-0.5"><input type="text" className="w-full text-center bg-transparent h-7 text-[16px]" value={formData[`rec_${recIndex}_Retro_${p}_NG`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_NG`, e.target.value)} /></td>
                        </>
                    ) : p === 'Length' ? (
                        <>
                            <td colSpan="2" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_F`, e.target.value)} /></td>
                            <td colSpan="2" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${p}_F`, e.target.value)} /></td>
                        </>
                    ) : (
                        <>
                            <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_F`, e.target.value)} /></td>
                            <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${p}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_R`, e.target.value)} /></td>
                            <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${p}_F`, e.target.value)} /></td>
                            <td className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${p}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${p}_R`, e.target.value)} /></td>
                        </>
                    )}

                    {p === 'I/H' ? null : (
                        <td className="border border-black p-0.5 text-center align-middle">
                            <select
                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                value={formData[`rec_${recIndex}_Retro_Status_${p}`] || "OK"}
                                onChange={(e) => handleInputChange(recIndex, `Retro_Status_${p}`, e.target.value)}
                            >
                                <option value="OK">OK</option>
                                <option value="Rework">Rework</option>
                                <option value="Scrap">Scrap</option>
                            </select>
                        </td>
                    )}

                    <td className="border border-black p-0.5 text-center font-bold bg-gray-50">
                        <div className="flex flex-col items-center leading-tight">
                            <span>{p}</span>
                            {p === 'I/H' && <span className="text-[16px] text-gray-500 font-normal">W/W</span>}
                        </div>
                    </td>
                    {p === 'Visual' ? (
                        <td colSpan="2" className="border border-black p-0.5">
                            <select
                                className="w-full text-center bg-transparent h-7 text-[16px]"
                                value={formData[`rec_${recIndex}_Setup_${p}_OK`] || ""}
                                onChange={(e) => handleInputChange(recIndex, `Setup_${p}_OK`, e.target.value)}
                            >
                                <option value="">-</option>
                                <option value="OK">OK</option>
                                <option value="N/A">N/A</option>
                            </select>
                        </td>
                    ) : (
                        <>
                            <td className="border border-black p-0.5">
                                <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${p}_F`, e.target.value)} />
                            </td>
                            <td className="border border-black p-0.5">
                                <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${p}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${p}_R`, e.target.value)} />
                            </td>
                        </>
                    )}

                    {/* Dimension Check mappings inside the sub-params rows */}
                    {p === 'Strength' && (
                        <>
                            <td rowSpan="2" className="border border-black p-0.5 align-top">
                                <div className="flex flex-col text-[16px] p-0.5 h-full">
                                    <div className="font-semibold mb-1">Length:</div>
                                    <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_Len_Std1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Len_Std1', e.target.value)} /></label>
                                    <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_Len_Obs1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Len_Obs1', e.target.value)} /></label>
                                </div>
                            </td>
                            <td rowSpan="2" className="border border-black p-0.5 align-top">
                                <div className="flex flex-col text-[16px] p-0.5 h-full">
                                    <div className="font-semibold mb-1">Length:</div>
                                    <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_Len_Std2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Len_Std2', e.target.value)} /></label>
                                    <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_Len_Obs2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Len_Obs2', e.target.value)} /></label>
                                </div>
                            </td>
                            <td rowSpan="2" className="border border-black p-0.5 align-top">
                                <div className="flex flex-col text-[16px] p-0.5 h-full">
                                    <div className="font-semibold mb-1">Length:</div>
                                    <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_Len_Std3`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Len_Std3', e.target.value)} /></label>
                                    <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_Len_Obs3`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Len_Obs3', e.target.value)} /></label>
                                </div>
                            </td>
                        </>
                    )}
                    {p === 'Visual' && (
                        <td colSpan="3" className="border border-black p-0.5 align-top">
                            <div className="flex items-center text-[16px] p-0.5 w-full">
                                <span className="whitespace-nowrap mr-1">Detail if NG:</span>
                                <input className="w-full min-w-0 bg-transparent outline-none text-black" value={formData[`rec_${recIndex}_Cont_NGDetail`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_NGDetail', e.target.value)} />
                            </div>
                        </td>
                    )}
                </tr>
            ))}
        </>
    );
};

const Daily5MRecording = () => {
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const urlRecordId = searchParams.get('recordId');
    const { data: departmentsData } = useGetAllDepartmentsQuery();
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: linesData } = useGetLinesBySectionQuery(selectedSection, { skip: !selectedSection });
    const sections = sectionsData?.data || [];
    const lines = linesData?.data || [];

    // Config State
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [tableConfig, setTableConfig] = useState(null);
    const [rowCount, setRowCount] = useState(5);
    const [configError, setConfigError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isViewingHistory, setIsViewingHistory] = useState(false);
    const [configHistory, setConfigHistory] = useState([]);
    const { data: activeConfigData } = useGetActiveConfigQuery();
    const skillLevels = activeConfigData?.data?.levels || [];
    const [submittedBy, setSubmittedBy] = useState(null);

    // New workflow state
    const [showFormList, setShowFormList] = useState(true);
    const [todayRecords, setTodayRecords] = useState([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addDialogType, setAddDialogType] = useState('standard');
    const [addDialogDate, setAddDialogDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [currentRecordId, setCurrentRecordId] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [recordStatus, setRecordStatus] = useState('PENDING');

    // Auth state for permissions
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin;
    const canApprove = isAdmin || authUser?.customRole?.permissions?.includes('daily5m:approve');

    const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
    const [isManagePeopleOpen, setIsManagePeopleOpen] = useState(false);
    const [emailForPDF, setEmailForPDF] = useState("");
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const tableRef = React.useRef(null);

    // Filter departments based on user assignment
    const assignableDepartments = React.useMemo(() => {
        const allDepts = departmentsData?.data?.departments || [];
        if (!authUser || isAdmin || !authUser.departments || authUser.departments.length === 0) {
            return allDepts;
        }
        // User has specific department assignments
        return allDepts.filter(dept =>
            authUser.departments.includes(dept.id) ||
            authUser.departments.includes(dept._id) ||
            authUser.departments.includes(String(dept.id)) ||
            authUser.departments.includes(String(dept._id))
        );
    }, [departmentsData, authUser, isAdmin]);

    const isRestricted = authUser && !isAdmin && authUser.departments && authUser.departments.length > 0;

    const selectedDeptName = assignableDepartments.find(d => (d._id || d.id) === selectedDepartment)?.name || "Department";
    const section = sections.find(s => (s._id || s.id) === selectedSection);
    const selectedSectionName = section ? `${section.name}${section.category ? ` (${section.category})` : ''}` : "Section";

    // Auto-select department if only one is available for restricted users
    useEffect(() => {
        if (isRestricted && assignableDepartments.length === 1 && !selectedDepartment) {
            setSelectedDepartment(assignableDepartments[0]._id || assignableDepartments[0].id);
        }
    }, [isRestricted, assignableDepartments, selectedDepartment]);

    useEffect(() => {
        if (selectedDepartment) {
            fetchConfig(selectedDepartment);
            // Only reset section if we're not loading from a URL/deep link
            if (!urlRecordId && !location.state?.recordId) {
                setSelectedSection("");
            }
        } else {
            setTableConfig(null);
            setConfigError(null);
        }
    }, [selectedDepartment, urlRecordId, location.state?.recordId]);

    useEffect(() => {
        // Priority 1: Check for recordId in URL search params
        if (urlRecordId) {
            fetchRecordById(urlRecordId).then(() => {
                setShowFormList(false);
            });
        }
        // Priority 2: If we have a recordId in location state (navigated from dashboard)
        else if (location.state?.recordId) {
            fetchRecordById(location.state.recordId);
            setShowFormList(false);
        } else if (selectedDepartment && selectedSection && selectedDate) {
            // Priority 3: Fetch all records for today to show in the list
            fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
            setShowFormList(true);
        }
    }, [selectedDepartment, selectedSection, selectedDate, location.state?.recordId, urlRecordId]);

    const fetchConfig = async (deptId) => {
        try {
            setLoadingConfig(true);
            setConfigError(null);
            const response = await axiosInstance.get(`/api/daily-5m/${deptId}`);

            if (response.data.success) {
                const config = response.data.data.config;
                setTableConfig(config);
                if (config.bodyRows) setRowCount(config.bodyRows);
                // Pre-fill editor string
                setJsonConfigStr(JSON.stringify(config, null, 2));
            } else {
                setConfigError("Failed to load configuration.");
            }
        } catch (error) {
            console.error("Error fetching 5M config:", error);
            setConfigError("Failed to load configuration. Please try again.");
        } finally {
            setLoadingConfig(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!layoutRemark.trim()) {
            toast.error("Please enter a remark detailing your layout changes.");
            return;
        }

        try {
            let parsedConfig;
            try {
                parsedConfig = JSON.parse(jsonConfigStr);
            } catch (e) {
                toast.error("Invalid JSON format");
                return;
            }

            await axiosInstance.post(`/api/daily-5m/config/save`,
                { departmentId: selectedDepartment, config: parsedConfig, remark: layoutRemark }
            );

            setTableConfig(parsedConfig);
            setIsEditing(false);
            setLayoutRemark("");
            toast.success("Configuration saved successfully");
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Failed to save configuration");
        }
    };

    const fetchConfigHistory = async () => {
        if (!selectedDepartment) return;
        try {
            const response = await axiosInstance.get(`/api/daily-5m/history/${selectedDepartment}`);
            if (response.data.success) {
                setConfigHistory(response.data.data);
                setIsViewingHistory(true);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
            toast.error("Failed to load layout history.");
        }
    };

    const handleResetConfig = async () => {
        if (!confirm("Are you sure you want to reset to the default layout? This will lose any custom changes.")) return;

        try {
            // ... reset logic ...
        } catch (e) {
            toast.error("Reset failed");
        }
    };

    const generatePDFBlob = async () => {
        if (!tableRef.current) return null;
        setIsGeneratingPDF(true); // Ensure state is set immediately
        try {
            const margin = 40;
            const logoHeight = 50;
            const logoWidth = 150;

            // 1. Get actual dimensions of the content
            const tableWidth = tableRef.current.scrollWidth;
            const tableHeight = tableRef.current.scrollHeight;

            // 2. Preload Logo for robustness
            const logoUrl = '/fme_transparent.png';
            const logoImg = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = logoUrl;
            });

            // 3. Capture the table as image
            const tableDataUrl = await toPng(tableRef.current, {
                width: tableWidth,
                height: tableHeight,
                style: {
                    transform: 'none',
                    margin: '0',
                },
                backgroundColor: '#ffffff',
                pixelRatio: 1.5, // Slightly lower for faster generation of large tables
            });

            // 4. Calculate PDF page size: table + margins + logo (if it exists)
            const pdfWidth = tableWidth + (margin * 2);
            const pdfHeight = tableHeight + (logoImg ? logoHeight + margin : 0) + (margin * 2);

            const pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [pdfWidth, pdfHeight]
            });

            // 5. Add Logo if loaded
            let currentY = margin;
            if (logoImg) {
                pdf.addImage(logoImg, 'PNG', (pdfWidth - logoWidth) / 2, currentY, logoWidth, logoHeight);
                currentY += logoHeight + margin;
            }

            // 6. Add Main Table Data
            pdf.addImage(tableDataUrl, 'PNG', margin, currentY, tableWidth, tableHeight);

            return pdf;
        } catch (error) {
            console.error("PDF Generation error:", error);
            toast.error("Failed to generate PDF. Layout issues detected.");
            return null;
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleDownloadPDF = async () => {
        const pdf = await generatePDFBlob();
        if (pdf) {
            pdf.save(`Daily_5M_${selectedDeptName.replace(/\s+/g, '_')}_${selectedDate}.pdf`);
            setIsPrintDialogOpen(false);
            toast.success("PDF downloaded successfully");
        }
    };

    const handleEmailPDF = async () => {
        if (!emailForPDF || !emailForPDF.includes('@')) {
            toast.error("Please enter a valid email address");
            return;
        }

        const loadingToast = toast.info("Preparing PDF and sending email...", { duration: 0 });
        try {
            const pdf = await generatePDFBlob();
            if (pdf) {
                const pdfBase64 = pdf.output('datauristring');
                setIsGeneratingPDF(true);
                await axiosInstance.post('/api/daily-5m/pdf/send', {
                    email: emailForPDF,
                    pdfBase64,
                    departmentName: selectedDeptName,
                    date: selectedDate
                });
                toast.success("Email sent successfully!");
                toast.dismiss(loadingToast);
                setIsPrintDialogOpen(false);
                setEmailForPDF("");
            }
        } catch (error) {
            console.error("Email error:", error);
            toast.error("Failed to send email");
            toast.dismiss(loadingToast);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Helper to render class names dynamically
    const getClassName = (header) => {
        let classes = "border border-black p-0.5 text-center ";
        if (header.className) classes += header.className;
        if (header.width) classes += ` ${header.width}`;
        return classes;
    };

    // Data Entry State
    const [formData, setFormData] = useState({});
    const [formType, setFormType] = useState('standard'); // 'standard' or 'crimping'

    // Load data if viewing/editing an existing record from dashboard
    useEffect(() => {
        if (location.state?.recordData) {
            const data = location.state.recordData;
            // Set department and date from the record to align UI
            if (data.departmentId) setSelectedDepartment(data.departmentId);
            if (data.date) {
                // Ensure format is YYYY-MM-DD
                const formattedDate = new Date(data.date).toISOString().split('T')[0];
                setSelectedDate(formattedDate);
            }

            if (data.recordData) {
                setFormData(data.recordData);
            }
            if (data.formType) {
                setFormType(data.formType);
            }
        }
    }, [location.state]);

    const fetchTodayRecords = async (deptId, sectionId, queryDate) => {
        try {
            // Use the same get5MRecords endpoint but with groupBySession=true
            const response = await axiosInstance.get(`/api/daily-5m/records/${deptId}?sectionId=${sectionId}&startDate=${queryDate}&endDate=${queryDate}&groupBySession=true`);
            if (response.data.success) {
                setTodayRecords(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching today's records:", error);
        }
    };

    const handleAddForm = async () => {
        try {
            // Create an initial stub record in the database so it appears in the list 
            // and has a persistent ID for sessions.
            const payload = {
                departmentId: selectedDepartment,
                sectionId: selectedSection,
                date: addDialogDate,
                shift: "",
                line: "",
                formType: addDialogType,
                recordData: {} // Empty initial data
            };

            const response = await axiosInstance.post('/api/daily-5m/record/create', payload);
            if (response.data.success) {
                const newRecord = response.data.data;
                setFormData({});
                setFormType(addDialogType);
                setSelectedDate(addDialogDate);
                setSubmittedBy(null);
                setCurrentRecordId(newRecord.id);
                setSessionId(newRecord.sessionId);

                // Keep URL in sync
                navigate(`${location.pathname}?recordId=${newRecord.id}`, { replace: true });

                // Load the new record configuration (handles row counts etc)
                if (tableConfig?.bodyRows) setRowCount(tableConfig.bodyRows);

                setShowFormList(false);
                setIsAddDialogOpen(false);
                toast.success(`${addDialogType.toUpperCase()} form session created`);
            }
        } catch (error) {
            console.error("Error creating new form session:", error);
            toast.error("Failed to create recording session");
        }
    };

    const fetchRecordById = async (id) => {
        try {
            const response = await axiosInstance.get(`/api/daily-5m/record/${id}`);
            if (response.data.success && response.data.data) {
                const record = response.data.data;
                const recordData = record.recordData || {};
                const deptId = record.departmentId;
                const sectId = record.sectionId;

                setSelectedDepartment(deptId);
                setSelectedSection(sectId);
                setSelectedDate(record.date ? record.date.split('T')[0] : new Date().toLocaleDateString('en-CA'));
                setFormData(recordData);
                setSubmittedBy(record.submittedByName || "User");
                setCurrentRecordId(record.id);
                setSessionId(record.sessionId);
                setRecordStatus(record.status || 'PENDING');
                if (record.formType) {
                    setFormType(record.formType);
                }
                setShowFormList(false);

                // Determine rowCount from existing data keys
                updateRowCountFromData(recordData);
            }
        } catch (error) {
            console.error("Error fetching record by ID:", error);
        }
    };

    const fetchRecordForDate = async (deptId, queryDate, targetUserId) => {
        try {
            let url = `/api/daily-5m/record/date?departmentId=${deptId}&date=${queryDate}`;
            if (targetUserId) url += `&userId=${targetUserId}`;

            const response = await axiosInstance.get(url);
            if (response.data.success && response.data.data) {
                // Record exists for this date
                const record = response.data.data;
                const recordData = record.recordData || {};
                setFormData(recordData);
                setSubmittedBy(record.submittedByName || "User");
                setCurrentRecordId(record.id);
                if (record.formType) {
                    setFormType(record.formType);
                }
                updateRowCountFromData(recordData);
            } else {
                // No record found, clear form for a new day
                setFormData({});
                setSubmittedBy(null);
                if (tableConfig?.bodyRows) setRowCount(tableConfig.bodyRows);
            }
        } catch (error) {
            console.error("Error fetching record for date:", error);
            toast.error("Failed to fetch data for the selected date.");
            setFormData({});
            setSubmittedBy(null);
        }
    };

    const updateRowCountFromData = (recordData) => {
        const keys = Object.keys(recordData);
        let maxIndex = tableConfig?.bodyRows ? tableConfig.bodyRows - 1 : 4;
        keys.forEach(key => {
            const match = key.match(/^rec_(\d+)_/);
            if (match) {
                const idx = parseInt(match[1]);
                if (idx > maxIndex) maxIndex = idx;
            }
        });
        setRowCount(maxIndex + 1);
    };

    const handleInputChange = (recIndex, field, value) => {
        setFormData(prev => {
            const newFormData = {
                ...prev,
                [`rec_${recIndex}_${field}`]: value
            };

            // Auto-populate Leader Name if Line is changed
            if (field === 'Line' || field === 'From') {
                const selectedLine = lines.find(l => l.name === value);
                if (selectedLine && selectedLine.lineLeader) {
                    // FP_Leader is used in the table UI
                    newFormData[`rec_${recIndex}_FP_Leader`] = selectedLine.lineLeader;
                    // Also update FP_1 for backward compatibility/other forms if needed
                    newFormData[`rec_${recIndex}_FP_1`] = selectedLine.lineLeader;
                }
            }

            // Auto-populate 'N/A' in Support Person Name if OJT is 'No'
            if (field === 'OJT' && value === 'No') {
                newFormData[`rec_${recIndex}_Cont1_Shift`] = 'N/A';
            }

            return newFormData;
        });
    };

    const handleSaveRecord = async () => {
        if (!selectedDepartment) {
            toast.error("Please select a department");
            return;
        }

        // Basic Validation: Check if at least one row has data? 
        // For now, just allow saving whatever is there.

        try {
            const payload = {
                departmentId: selectedDepartment,
                sectionId: selectedSection,
                date: selectedDate,
                // Extract Shift/Line from the first record if available:
                shift: formData['rec_0_Shift'] || "",
                line: formData['rec_0_Line'] || formData['rec_0_StationMC'] || "",
                formType: formType,
                recordData: formData,
                sessionId: sessionId // Group this save under the existing session
            };

            await axiosInstance.post('/api/daily-5m/record/create', payload);
            toast.success("Record saved successfully!");

            // Clear the URL when returning to the list
            navigate(location.pathname, { replace: true });

            // Go back to the list
            setShowFormList(true);
            fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.response?.data?.message || "Failed to save record");
        }
    };

    // Helper to process text (existing)
    const processText = (text) => {
        if (!text) return "";
        return text.replace("{DeptName}", selectedDeptName);
    };

    // Common Render: Header Section
    return (
        <div className="space-y-6 w-full mx-auto pb-10 px-0 sm:px-2">
            <div className="flex justify-between items-center print:hidden">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold tracking-tight">Daily 5M Recording</h1>
                    {submittedBy && (
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            Submitted By: <span className="text-blue-600 font-bold">{submittedBy}</span>
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled={!selectedDepartment || loadingConfig}
                        onClick={() => setIsEditing(true)}
                    >
                        <IconSettings className="w-5 h-5 mr-2" />
                        Edit Layout
                    </Button>

                    <Button
                        variant="outline"
                        disabled={!selectedDepartment}
                        onClick={() => setIsManagePeopleOpen(true)}
                    >
                        <IconPlus className="w-5 h-5 mr-2" />
                        Manage People
                    </Button>

                    <AssignmentManagementDialog
                        open={isManagePeopleOpen}
                        onOpenChange={setIsManagePeopleOpen}
                        departmentId={selectedDepartment}
                        departmentName={selectedDeptName}
                    />

                    <Dialog open={isEditing} onOpenChange={setIsEditing}>
                        <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle className="flex justify-between items-center pr-8">
                                    Edit Table Configuration (JSON)
                                    <Button variant="outline" size="sm" onClick={fetchConfigHistory}>
                                        View History
                                    </Button>
                                </DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-auto p-1 space-y-4">
                                <Textarea
                                    className="font-mono text-xs h-[400px]"
                                    value={jsonConfigStr}
                                    onChange={(e) => setJsonConfigStr(e.target.value)}
                                />
                                <div className="space-y-2">
                                    <Label htmlFor="remark">Remark (Required)</Label>
                                    <Input
                                        id="remark"
                                        placeholder="Briefly describe the changes made to the layout..."
                                        value={layoutRemark}
                                        onChange={(e) => setLayoutRemark(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <Button variant="ghost" onClick={() => {
                                    if (confirm("Discard changes?")) setIsEditing(false);
                                }}>Cancel</Button>
                                <Button onClick={handleSaveConfig} disabled={!layoutRemark.trim()}>
                                    Save Configuration
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* History Dialog */}
                    <Dialog open={isViewingHistory} onOpenChange={setIsViewingHistory}>
                        <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Layout Change History</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-auto p-4 space-y-4">
                                {configHistory.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8">No history found.</div>
                                ) : (
                                    configHistory.map((entry, idx) => (
                                        <div key={idx} className="border p-3 rounded-lg space-y-2 bg-slate-50">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold">{entry.updatedBy}</span>
                                                <span className="text-gray-500">{new Date(entry.createdAt).toLocaleString()}</span>
                                            </div>
                                            <div className="text-sm border-l-2 border-blue-400 pl-2">
                                                {entry.remark}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button onClick={handleSaveRecord} disabled={!selectedDepartment || loadingConfig}>
                        <IconClipboardList className="w-5 h-5 mr-2" />
                        Save Record
                    </Button>
                    <Button onClick={() => setIsPrintDialogOpen(true)} variant="outline" disabled={!tableConfig}>
                        <IconPrinter className="w-5 h-5 mr-2" />
                        Print / Email Sheet
                    </Button>

                    <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Print or Email Sheet</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter email address"
                                        value={emailForPDF}
                                        onChange={(e) => setEmailForPDF(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-2 pt-4">
                                    <Button
                                        onClick={handleEmailPDF}
                                        disabled={isGeneratingPDF || !emailForPDF}
                                        className="w-full"
                                    >
                                        {isGeneratingPDF ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                        Send as PDF
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <div className="h-[1px] flex-1 bg-gray-200"></div>
                                        <span className="text-xs text-gray-400">OR</span>
                                        <div className="h-[1px] flex-1 bg-gray-200"></div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadPDF}
                                        disabled={isGeneratingPDF}
                                        className="w-full"
                                    >
                                        {isGeneratingPDF ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                        Save as PDF
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => window.print()}
                                        className="w-full"
                                    >
                                        Standard Browser Print
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Content Area Switching */}
            {!selectedDepartment || !selectedSection ? (
                /* State 1: Department & Section Selection */
                <div className="p-8">
                    <Card className="max-w-md mx-auto">
                        <CardHeader>
                            <CardTitle>Daily 5M Recording Access</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>1. Select Department</Label>
                                <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={isRestricted && assignableDepartments.length === 1}>
                                    <SelectTrigger className={isRestricted && assignableDepartments.length === 1 ? "bg-slate-50 cursor-not-allowed" : ""}>
                                        <SelectValue placeholder="Select Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assignableDepartments.map((dept) => (
                                            <SelectItem key={dept._id || dept.id} value={dept._id || dept.id}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={`space-y-2 transition-opacity ${!selectedDepartment ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                <Label>2. Select Section</Label>
                                <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedDepartment}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sections.map((sec) => (
                                            <SelectItem key={sec._id || sec.id} value={sec._id || sec.id}>
                                                {sec.name} {sec.category ? `(${sec.category})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : loadingConfig ? (
                /* State 2: Loading */
                <div className="flex justify-center p-10"><Loader2 className="animate-spin w-10 h-10" /></div>
            ) : (configError || !tableConfig) ? (
                /* State 3: Error */
                <div className="flex flex-col items-center justify-center p-10 space-y-4">
                    <div className="text-red-500 font-semibold">{configError || "Configuration not found."}</div>
                    <Button onClick={() => fetchConfig(selectedDepartment)}>Retry</Button>
                </div>
            ) : showFormList ? (
                /* State 4: Form Selection List */
                <div className="space-y-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border">
                        <div className="flex items-center gap-4">
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-[200px]"
                            />
                            <h2 className="text-lg font-semibold text-slate-700">Records for {selectedDeptName} - {selectedSectionName}</h2>
                        </div>
                        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                            <IconPlus className="mr-2" /> Add New Form
                        </Button>
                    </div>

                    <div className="bg-white rounded-xl border-2 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-20 font-bold p-4">ID</TableHead>
                                    <TableHead className="font-bold p-4">Form Type</TableHead>
                                    <TableHead className="font-bold p-4">Line</TableHead>
                                    <TableHead className="font-bold p-4">Shift</TableHead>
                                    <TableHead className="font-bold p-4">Created Time</TableHead>
                                    <TableHead className="font-bold p-4 text-center">Status</TableHead>
                                    <TableHead className="text-right font-bold p-4">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {todayRecords.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-60">
                                                <IconClipboardList size={48} className="text-slate-300" />
                                                <div className="font-medium text-lg">No sessions found for this date</div>
                                                <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" size="sm">Create First Form</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    todayRecords.map((record) => (
                                        <TableRow
                                            key={record.id}
                                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                            onClick={() => navigate(`${location.pathname}?recordId=${record.id}`)}
                                        >
                                            <TableCell className="font-mono font-bold text-slate-500 p-4">
                                                #{record.id}
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <Badge
                                                    variant="secondary"
                                                    className={`uppercase text-[16px] px-3 py-1 font-bold ${
                                                        record.formType === 'crimping' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                        record.formType === 'src' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                        'bg-blue-100 text-blue-700 border-blue-200'
                                                    }`}
                                                >
                                                    {record.formType === 'standard' ? 'Assembly' : record.formType === 'src' ? 'SRC' : 'Cutting & Crimping'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-semibold p-4">
                                                {record.line || 'N/A'}
                                            </TableCell>
                                            <TableCell className="p-4">
                                                {record.shift ? (
                                                    <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                                                        {record.shift}
                                                    </span>
                                                ) : 'N/A'}
                                            </TableCell>
                                            <TableCell className="p-4 text-slate-500 font-medium">
                                                {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[16px] font-bold">
                                                        {record.submittedByName?.charAt(0)}
                                                    </div>
                                                    <span className="font-semibold">{record.submittedByName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-4 text-center">
                                                <Badge
                                                    className={`uppercase font-bold px-3 py-1 text-xs shadow-sm ${record.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' :
                                                        record.status === 'DECLINED' ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' :
                                                            'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    {record.status || 'PENDING'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right p-4">
                                                <Button size="sm" variant="ghost" className="text-blue-600 font-bold group-hover:bg-blue-50">
                                                    Open <IconExternalLink size={16} className="ml-2" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Create New Recording Session</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                    <Label>Form Type</Label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {/* Assembly Card */}
                                        <div
                                            className={`relative group p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                                                addDialogType === 'standard' 
                                                ? 'border-blue-500 bg-blue-50/50 ring-4 ring-blue-500/10' 
                                                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                            }`}
                                            onClick={() => setAddDialogType('standard')}
                                        >
                                            <div className="flex flex-col items-center text-center space-y-2">
                                                <div className={`p-2 rounded-lg transition-colors ${addDialogType === 'standard' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'}`}>
                                                    <IconLayout2 size={24} />
                                                </div>
                                                <div>
                                                    <div className={`font-bold transition-colors ${addDialogType === 'standard' ? 'text-blue-700' : 'text-slate-700'}`}>Assembly</div>
                                                    <p className="text-xs text-slate-500 mt-0.5">Regular 5M Sheet</p>
                                                </div>
                                            </div>
                                            {addDialogType === 'standard' && (
                                                <div className="absolute top-2 right-2">
                                                    <div className="bg-blue-500 text-white rounded-full p-0.5 shadow-sm">
                                                        <IconCheck size={12} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Crimping Card */}
                                        <div
                                            className={`relative group p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                                                addDialogType === 'crimping' 
                                                ? 'border-orange-500 bg-orange-50/50 ring-4 ring-orange-500/10' 
                                                : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'
                                            }`}
                                            onClick={() => setAddDialogType('crimping')}
                                        >
                                            <div className="flex flex-col items-center text-center space-y-2">
                                                <div className={`p-2 rounded-lg transition-colors ${addDialogType === 'crimping' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-500'}`}>
                                                    <IconScissors size={24} />
                                                </div>
                                                <div>
                                                    <div className={`font-bold transition-colors ${addDialogType === 'crimping' ? 'text-orange-700' : 'text-slate-700'}`}>Cutting & Crimping</div>
                                                    <p className="text-xs text-slate-500 mt-0.5">Crimping Machine Fix</p>
                                                </div>
                                            </div>
                                            {addDialogType === 'crimping' && (
                                                <div className="absolute top-2 right-2">
                                                    <div className="bg-orange-500 text-white rounded-full p-0.5 shadow-sm">
                                                        <IconCheck size={12} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* SRC Card */}
                                        <div
                                            className={`relative group p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${
                                                addDialogType === 'src' 
                                                ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10' 
                                                : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                                            }`}
                                            onClick={() => setAddDialogType('src')}
                                        >
                                            <div className="flex flex-col items-center text-center space-y-2">
                                                <div className={`p-2 rounded-lg transition-colors ${addDialogType === 'src' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-500'}`}>
                                                    <IconCpu size={24} />
                                                </div>
                                                <div>
                                                    <div className={`font-bold transition-colors ${addDialogType === 'src' ? 'text-emerald-700' : 'text-slate-700'}`}>SRC</div>
                                                    <p className="text-xs text-slate-500 mt-0.5">SRC Machine Fix</p>
                                                </div>
                                            </div>
                                            {addDialogType === 'src' && (
                                                <div className="absolute top-2 right-2">
                                                    <div className="bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                                        <IconCheck size={12} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="create-date">Session Date</Label>
                                    <Input
                                        id="create-date"
                                        type="date"
                                        value={addDialogDate}
                                        disabled // Restricted to current as requested "current date only"
                                        className="bg-slate-50"
                                    />
                                    <p className="text-[16px] text-slate-400">Recordings are restricted to the current date.</p>
                                </div>
                                <Button onClick={handleAddForm} className="w-full h-12 text-lg">
                                    Open Recording Table
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : (
                /* State 5: Table Display */
                <Card className="print:border-none print:shadow-none bg-slate-50">
                    <CardHeader className="print:hidden space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" onClick={() => {
                                    navigate(location.pathname);
                                    setShowFormList(true);
                                    fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
                                }}>
                                    <IconArrowLeft className="mr-2" /> Back to Session List
                                </Button>

                                {/* Approval Actions */}
                                {canApprove && recordStatus === 'PENDING' && currentRecordId && (
                                    <div className="flex items-center gap-2 border-l pl-4">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                            onClick={async () => {
                                                try {
                                                    await axiosInstance.post(`/api/daily-5m/record/${currentRecordId}/approve`);
                                                    setRecordStatus('APPROVED');
                                                    toast.success("Record Approved Successfully");
                                                } catch (e) {
                                                    toast.error("Failed to approve record");
                                                }
                                            }}
                                        >
                                            <IconCheck size={18} className="mr-1.5" /> Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
                                            onClick={async () => {
                                                try {
                                                    await axiosInstance.post(`/api/daily-5m/record/${currentRecordId}/decline`);
                                                    setRecordStatus('DECLINED');
                                                    toast.success("Record Declined");
                                                } catch (e) {
                                                    toast.error("Failed to decline record");
                                                }
                                            }}
                                        >
                                            <IconX size={18} className="mr-1.5" /> Decline
                                        </Button>
                                    </div>
                                )}

                                {/* Status Badge */}
                                {recordStatus !== 'PENDING' && (
                                    <Badge className={`ml-2 uppercase font-black px-4 py-1.5 text-sm shadow-sm ${recordStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                        {recordStatus}
                                    </Badge>
                                )}
                            </div>

                            <div className="text-right">
                                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Session</div>
                                <div className="text-2xl font-black text-slate-900 uppercase">
                                    {formType === 'standard' ? 'Assembly form' : formType === 'src' ? 'SRC machine fix' : 'cutting & crimping'}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 p-4 bg-white rounded-lg border shadow-sm">
                            <div className="flex flex-col gap-1 flex-1">
                                <Label className="text-[16px] uppercase text-slate-400 font-bold">Dept / Section</Label>
                                <div className="font-bold">{selectedDeptName} / {selectedSectionName}</div>
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <Label className="text-[16px] uppercase text-slate-400 font-bold">Date</Label>
                                <div className="font-bold">{selectedDate}</div>
                            </div>
                            {submittedBy && (
                                <div className="flex flex-col gap-1 flex-1">
                                    <Label className="text-[16px] uppercase text-slate-400 font-bold">Operator</Label>
                                    <div className="font-bold text-blue-600">{submittedBy}</div>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-4 overflow-x-auto">
                        {/* Table Container for PDF Capture */}
                        <div ref={tableRef} data-pdf-content="true" className="w-full bg-white p-4">
                            {/* Main Table Container */}
                            <div className="border-2 border-black inline-block min-w-full">
                                <table className="w-max min-w-full border-collapse text-[16px] sm:text-xs">
                                    <thead>
                                        {(() => {
                                            const activeConfig = formType === 'crimping' ? CRIMPING_CONFIG : tableConfig;
                                            return activeConfig.headers.map((row, rowIndex) => (
                                                <tr key={rowIndex}>
                                                    {row.map((header, colIndex) => {
                                                        let headerText = processText(header.text);
                                                        // Override title for SRC
                                                        if (formType === 'src' && rowIndex === 0 && colIndex === 0) {
                                                            headerText = "Daily 5M Recording Man - SRC section";
                                                        }
                                                        
                                                        return (
                                                            <th
                                                                key={colIndex}
                                                                colSpan={header.colSpan}
                                                                rowSpan={header.rowSpan}
                                                                className={getClassName(header)}
                                                            >
                                                                {header.isSplit ? (
                                                                    <div className="flex flex-col h-full min-h-[40px]">
                                                                        {header.splitLabels?.map((label, idx) => (
                                                                            <div key={idx} className={`flex-1 flex items-center justify-center ${idx < header.splitLabels.length - 1 ? 'border-b border-black' : ''}`}>
                                                                                {label}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    headerText
                                                                )}
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            ));
                                        })()}
                                    </thead>
                                    <tbody>
                                        {/* Loop for Body Rows (e.g. 5 records) */}
                                        {[...Array(rowCount)].map((_, recIndex) =>
                                            formType === 'crimping' ?
                                                <CrimpingRecord
                                                    key={recIndex}
                                                    recIndex={recIndex}
                                                    formData={formData}
                                                    handleInputChange={handleInputChange}
                                                    lines={lines}
                                                    skillLevels={skillLevels}
                                                    departmentId={selectedDepartment}
                                                />
                                                :
                                                <React.Fragment key={recIndex}>
                                                    {/* Row 1 of Record */}
                                                    <tr className="hover:bg-slate-50">
                                                        {/* We hardcode the inputs for now as per the layout structure - genericizing this part fully would require defining INPUT types in JSON too. 
                                                    For this iteration, we keep the inputs standard but allow the Headers to be dynamic. 
                                                    Ideally, the 'columns' config should drive this loop.
                                                */}
                                                        {/* This part is tricky. If the user changes columns, the inputs below won't match. 
                                                    To make it truly dynamic, we need to loop through a 'columns' definition in the config for the BODY as well.
                                                    However, the body rows have complex rowSpans too (merged cells across the record).
                                                    
                                                    Strategy: The Default Config implies a specific structure. 
                                                    If users want to Add Columns, they must also define how the body renders.
                                                    For now, we will render a GENERIC grid based on the columns defined in the LAST row of headers? 
                                                    No, that's ambiguous because of colSpans.
                                                    
                                                    We will use the 'columns' or 'bodyStructure' from the config if available, otherwise fallback to the hardcoded inputs.
                                                    Since we provided a DEFAULT_CONFIG, let's map it.
                                                */}

                                                        <td rowSpan="3" className="border border-black p-0.5 text-center">{recIndex + 1}</td>
                                                        {/* Generic inputs for standard fields */}
                                                        <td rowSpan="3" className="border border-black p-0.5"><input type="date" className="w-full text-center bg-transparent h-7 text-[16px]" placeholder="Date" value={formData[`rec_${recIndex}_Date`] || ""} onChange={(e) => handleInputChange(recIndex, 'Date', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_Line`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Line', e.target.value)}
                                                            >
                                                                <option value="">Select Line</option>
                                                                {lines.map((line, idx) => (
                                                                    <option key={line._id || line.id || idx} value={line.name}>
                                                                        {line.name} {line.sectionName ? `(${line.sectionName})` : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_Shift`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Shift', e.target.value)}
                                                            >
                                                                <option value="">Select Shift</option>
                                                                <option value="A">A</option>
                                                                <option value="B">B</option>
                                                                <option value="G">G</option>
                                                                <option value="C">C</option>
                                                            </select>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_Type`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Type', e.target.value)}
                                                            >
                                                                <option value="">Select Type</option>
                                                                <option value="Planned">Planned</option>
                                                                <option value="Un-Planned">Un-Planned</option>
                                                            </select>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <ProcessSelect
                                                                recIndex={recIndex}
                                                                selectedLineName={formData[`rec_${recIndex}_Line`]}
                                                                allLines={lines}
                                                                formData={formData}
                                                                onInputChange={handleInputChange}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <ProblemSelect
                                                                recIndex={recIndex}
                                                                value={formData[`rec_${recIndex}_Problem`] || ""}
                                                                onChange={handleInputChange}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5 text-center font-mono text-[16px]">
                                                            {formData[`rec_${recIndex}_OpCode`] || ""}
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <UserAutocomplete
                                                                departmentId={selectedDepartment}
                                                                value={formData[`rec_${recIndex}_OpName`] || ""}
                                                                onChange={({ fullName, empId, currentLevel }) => {
                                                                    handleInputChange(recIndex, 'OpName', fullName);
                                                                    handleInputChange(recIndex, 'OpCode', empId);
                                                                    handleInputChange(recIndex, 'CurSkill', currentLevel || "");
                                                                }}
                                                                placeholder="Op Name"
                                                                compact={true}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" placeholder="Cur Skill" value={formData[`rec_${recIndex}_CurSkill`] || ""} onChange={(e) => handleInputChange(recIndex, 'CurSkill', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_ReqSkill`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'ReqSkill', e.target.value)}
                                                            >
                                                                <option value="">Req Skill</option>
                                                                {skillLevels.map((level, idx) => (
                                                                    <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                                                                ))}
                                                            </select></td>
                                                        <td rowSpan="3" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" placeholder="Deputed" value={formData[`rec_${recIndex}_Deputed`] || ""} onChange={(e) => handleInputChange(recIndex, 'Deputed', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <UserAutocomplete
                                                                value={formData[`rec_${recIndex}_DeputedCode`] || ""}
                                                                onChange={({ fullName, empId, departmentId, deptName, lineName, currentLevel }) => {
                                                                    handleInputChange(recIndex, 'DeputedCode', empId);
                                                                    handleInputChange(recIndex, 'Deputed', fullName);
                                                                    handleInputChange(recIndex, 'DeputedDeptId', departmentId);
                                                                    handleInputChange(recIndex, 'DeputedDeptName', deptName);
                                                                    handleInputChange(recIndex, 'From', lineName || "");
                                                                    handleInputChange(recIndex, 'ActSkill', currentLevel || "L1");
                                                                }}
                                                                placeholder="Op Code"
                                                                compact={true}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_ActSkill`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'ActSkill', e.target.value)}
                                                            >
                                                                <option value="">Act Skill</option>
                                                                {skillLevels.map((level, idx) => (
                                                                    <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                                                                ))}
                                                            </select></td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <div className="flex flex-col gap-1 items-center justify-center h-full">
                                                                {formData[`rec_${recIndex}_DeputedDeptName`] && (
                                                                    <span className="text-[16px] text-gray-500 font-bold uppercase">{formData[`rec_${recIndex}_DeputedDeptName`]}</span>
                                                                )}
                                                                <LineSelect
                                                                    recIndex={recIndex}
                                                                    departmentId={formData[`rec_${recIndex}_DeputedDeptId`]}
                                                                    formData={formData}
                                                                    onInputChange={handleInputChange}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <DaysInput
                                                                value={formData[`rec_${recIndex}_Plan`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Plan', e.target.value)}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_OJT`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'OJT', e.target.value)}
                                                            >
                                                                <option value="">Select</option>
                                                                <option value="Yes">Yes</option>
                                                                <option value="No">No</option>
                                                            </select>
                                                        </td>

                                                        {/* Retro Row 1 */}
                                                        <td className="border border-black p-0.5 text-center font-semibold"><AutoResizeTextarea className="text-center font-semibold bg-transparent" value={formData[`rec_${recIndex}_Retro1_Visual`] !== undefined ? formData[`rec_${recIndex}_Retro1_Visual`] : "Visual"} onChange={(e) => handleInputChange(recIndex, 'Retro1_Visual', e.target.value)} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center"><AutoResizeTextarea className="text-center bg-transparent w-full" value={formData[`rec_${recIndex}_Retro1_VisualSOP`] !== undefined ? formData[`rec_${recIndex}_Retro1_VisualSOP`] : "Visual as per SOP"} onChange={(e) => handleInputChange(recIndex, 'Retro1_VisualSOP', e.target.value)} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center text-gray-400"><AutoResizeTextarea className="text-center text-gray-400 bg-transparent w-full" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro1_NA`] !== undefined ? formData[`rec_${recIndex}_Retro1_NA`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro1_NA', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5 text-center align-middle">
                                                            <div className="flex flex-col h-full items-center justify-center gap-1">
                                                                <select
                                                                    className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                    value={formData[`rec_${recIndex}_Retro_Status`] !== undefined ? formData[`rec_${recIndex}_Retro_Status`] : "OK"}
                                                                    onChange={(e) => handleInputChange(recIndex, 'Retro_Status', e.target.value)}
                                                                >
                                                                    <option value="OK">OK</option>
                                                                    <option value="Rework">Rework</option>
                                                                    <option value="Scrap">Scrap</option>
                                                                </select>
                                                                <div className="w-full h-px bg-black/10" />
                                                                {/* <AutoResizeTextarea
                                                                    className="text-[8px] text-center"
                                                                    placeholder="Sign"
                                                                    value={formData[`rec_${recIndex}_Retro_Sign`] || ""}
                                                                    onChange={(e) => handleInputChange(recIndex, 'Retro_Sign', e.target.value)}
                                                                /> */}
                                                            </div>
                                                        </td>

                                                        {/* FP Row 1 */}
                                                        <td rowSpan="3" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_FP_Leader`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP_Leader', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_FP_PartNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP_PartNo', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_FP_LotNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP_LotNo', e.target.value)} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5 h-full p-0">
                                                            <div className="flex flex-col h-full text-[8px] min-h-[60px]">
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_1`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_1`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_1', e.target.value)} /></div>
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_2`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_2`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_2', e.target.value)} /></div>
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_3`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_3`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_3', e.target.value)} /></div>
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_4`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_4`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_4', e.target.value)} /></div>
                                                                <div className="flex-1 flex items-center justify-center"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_5`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_5`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_5', e.target.value)} /></div>
                                                            </div>
                                                        </td>
                                                        <td className="border border-black p-0.5 text-center"><AutoResizeTextarea className="text-center bg-transparent w-full text-[16px]" value={formData[`rec_${recIndex}_FP1_VisualSOP`] !== undefined ? formData[`rec_${recIndex}_FP1_VisualSOP`] : "Visual(As per SOP)"} onChange={(e) => handleInputChange(recIndex, 'FP1_VisualSOP', e.target.value)} /></td>
                                                        {[1, 2, 3, 4, 5].map(num => (
                                                            <td key={`FP1_Chk${num}`} className="border border-black p-0.5 min-w-[60px]">
                                                                <select className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]" value={formData[`rec_${recIndex}_FP1_Chk${num}`] || ""} onChange={(e) => handleInputChange(recIndex, `FP1_Chk${num}`, e.target.value)}>
                                                                    <option value="">-</option>
                                                                    <option value="OK">OK</option>
                                                                    <option value="N/A">N/A</option>
                                                                </select>
                                                            </td>
                                                        ))}
                                                        <td rowSpan="3" className="border border-black p-0.5 text-[16px]">
                                                            <AssignmentSelect
                                                                departmentId={selectedDepartment}
                                                                role="QA_SHIFT_INCHARGE"
                                                                value={formData[`rec_${recIndex}_Result_1`] || ""}
                                                                onChange={(val) => handleInputChange(recIndex, 'Result_1', val)}
                                                                placeholder="QA Shift IC"
                                                                className='text-[16px]'
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <div className="flex flex-col text-[16px] items-center justify-center p-1 font-semibold min-h-[40px]">
                                                                NG Detail if<br />any: <input className="w-6 text-center border-none ml-1 bg-transparent" value={formData[`rec_${recIndex}_Result_2`] !== undefined ? formData[`rec_${recIndex}_Result_2`] : "0"} onChange={(e) => handleInputChange(recIndex, 'Result_2', e.target.value)} />
                                                            </div>
                                                        </td>

                                                        {/* Cont Row 1 */}
                                                        <td rowSpan="2" className="border border-black p-0.5">
                                                            <UserAutocomplete
                                                                value={formData[`rec_${recIndex}_Cont1_Shift`] || ""}
                                                                onChange={({ fullName }) => handleInputChange(recIndex, 'Cont1_Shift', fullName)}
                                                                placeholder="Support Person"
                                                                compact={true}
                                                            />
                                                        </td>
                                                        <td rowSpan="2" className="border border-black p-0.5"><AutoResizeTextarea className="text-center text-blue-600 font-semibold" value={formData[`rec_${recIndex}_Cont1_Day_1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont1_Day_1', e.target.value)} /></td>
                                                        <td rowSpan="2" className="border border-black p-0.5"><AutoResizeTextarea className="text-center text-blue-600 font-semibold" value={formData[`rec_${recIndex}_Cont1_Day_2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont1_Day_2', e.target.value)} /></td>

                                                        <td rowSpan="2" className="border border-black p-0.5 align-top">
                                                            <div className="flex flex-col text-[16px] p-0.5 text-blue-600">
                                                                <div className="font-semibold mb-1 text-center border-b border-gray-300 pb-0.5 border-dashed text-black">Dim.</div>
                                                                <AutoResizeTextarea className="text-center leading-tight whitespace-pre-wrap mt-0.5 bg-transparent" value={formData[`rec_${recIndex}_Cont_Dim_1`] !== undefined ? formData[`rec_${recIndex}_Cont_Dim_1`] : ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Dim_1', e.target.value)} />
                                                            </div>
                                                        </td>
                                                        <td rowSpan="2" className="border border-black p-0.5 align-top">
                                                            <div className="flex flex-col text-[16px] p-0.5 text-blue-600">
                                                                <div className="font-semibold mb-1 text-center border-b border-gray-300 pb-0.5 border-dashed text-black">Dim.</div>
                                                                <AutoResizeTextarea className="text-center leading-tight whitespace-pre-wrap mt-0.5 bg-transparent" value={formData[`rec_${recIndex}_Cont_Dim_2`] !== undefined ? formData[`rec_${recIndex}_Cont_Dim_2`] : ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Dim_2', e.target.value)} />
                                                            </div>
                                                        </td>
                                                        <td rowSpan="2" className="border border-black p-0.5 align-top">
                                                            <div className="flex flex-col text-[16px] p-0.5 text-blue-600">
                                                                <div className="font-semibold mb-1 text-center border-b border-gray-300 pb-0.5 border-dashed text-black">Dim.</div>
                                                                <AutoResizeTextarea className="text-center leading-tight whitespace-pre-wrap mt-0.5 bg-transparent" value={formData[`rec_${recIndex}_Cont_Dim_3`] !== undefined ? formData[`rec_${recIndex}_Cont_Dim_3`] : ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Dim_3', e.target.value)} />
                                                            </div>
                                                        </td>

                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <div className="flex flex-col h-full relative min-h-[40px] items-center justify-end pb-1">
                                                                <AutoResizeTextarea className="text-center text-blue-600 bg-transparent" value={formData[`rec_${recIndex}_Cont1_Remarks`] || "0"} onChange={(e) => handleInputChange(recIndex, 'Cont1_Remarks', e.target.value)} />
                                                            </div>
                                                        </td>

                                                        {/* Owners */}
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <AssignmentSelect
                                                                departmentId={selectedDepartment}
                                                                role="PROCESS_OWNER"
                                                                value={formData[`rec_${recIndex}_Owner_Sign`] || ""}
                                                                onChange={(val) => handleInputChange(recIndex, 'Owner_Sign', val)}
                                                                placeholder="Owner Sign"
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5">
                                                            <AssignmentSelect
                                                                departmentId={selectedDepartment}
                                                                role="APPROVED_BY"
                                                                value={formData[`rec_${recIndex}_Approved_By`] || ""}
                                                                onChange={(val) => handleInputChange(recIndex, 'Approved_By', val)}
                                                                placeholder="QA Approver"
                                                            />
                                                        </td>
                                                    </tr>

                                                    {/* Row 2 of Record */}
                                                    <tr className="hover:bg-slate-50">
                                                        {/* Retro Row 2 */}
                                                        <td className="border border-black p-0.5 text-center font-semibold"><AutoResizeTextarea className="text-center font-semibold bg-transparent" value={formData[`rec_${recIndex}_Retro2_Dim`] !== undefined ? formData[`rec_${recIndex}_Retro2_Dim`] : "Dimension"} onChange={(e) => handleInputChange(recIndex, 'Retro2_Dim', e.target.value)} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center text-[16px] leading-tight"><AutoResizeTextarea className="text-center text-[16px] bg-transparent w-full" value={formData[`rec_${recIndex}_Retro2_Desc`] !== undefined ? formData[`rec_${recIndex}_Retro2_Desc`] : "Dim as per Dim board\n(if change at F/A process)"} onChange={(e) => handleInputChange(recIndex, 'Retro2_Desc', e.target.value)} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center text-gray-400"><AutoResizeTextarea className="text-center text-gray-400 bg-transparent w-full text-blue-600" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro2_NA`] !== undefined ? formData[`rec_${recIndex}_Retro2_NA`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro2_NA', e.target.value)} /></td>

                                                        {/* FP Row 2 */}
                                                        <td rowSpan="2" className="border border-black p-0.5 text-center text-[8px] leading-tight"><AutoResizeTextarea className="text-center text-[16px] bg-transparent w-full" value={formData[`rec_${recIndex}_FP2_Desc`] !== undefined ? formData[`rec_${recIndex}_FP2_Desc`] : "Dim as per Dim board(If F/A)"} onChange={(e) => handleInputChange(recIndex, 'FP2_Desc', e.target.value)} /></td>
                                                        {[1, 2, 3, 4, 5].map(num => (
                                                            <td rowSpan="2" key={`FP2_Chk${num}`} className="border border-black p-0.5 min-w-[60px]">
                                                                <select className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]" value={formData[`rec_${recIndex}_FP2_Chk${num}`] || ""} onChange={(e) => handleInputChange(recIndex, `FP2_Chk${num}`, e.target.value)}>
                                                                    <option value="">-</option>
                                                                    <option value="OK">OK</option>
                                                                    <option value="N/A">N/A</option>
                                                                </select>
                                                            </td>
                                                        ))}
                                                    </tr>

                                                    {/* Row 3 of Record */}
                                                    <tr className="hover:bg-slate-50">
                                                        {/* Retro Row 3 */}
                                                        <td className="border border-black p-0.5 text-center font-semibold"><AutoResizeTextarea className="text-center font-semibold bg-transparent" value={formData[`rec_${recIndex}_Retro3_Visual`] !== undefined ? formData[`rec_${recIndex}_Retro3_Visual`] : "Visual"} onChange={(e) => handleInputChange(recIndex, 'Retro3_Visual', e.target.value)} /></td>
                                                        <td className="border border-black p-0.5 text-center text-[16px]">Total Qty</td>
                                                        <td className="border border-black p-0.5 text-center text-blue-600"><AutoResizeTextarea className="text-center bg-transparent w-full text-blue-600" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro3_TQ`] !== undefined ? formData[`rec_${recIndex}_Retro3_TQ`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro3_TQ', e.target.value)} /></td>
                                                        <td className="border border-black p-0.5 text-center text-[16px]">NG Qty</td>
                                                        <td className="border border-black p-0.5 text-center text-blue-600"><AutoResizeTextarea className="text-center bg-transparent w-full text-blue-600" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro3_NG`] !== undefined ? formData[`rec_${recIndex}_Retro3_NG`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro3_NG', e.target.value)} /></td>

                                                        {/* Cont Row 3 */}
                                                        <td colSpan="6" className="border border-black p-0.5">
                                                            <div className="flex flex-row items-center justify-end text-[16px] w-full pr-2 text-right">
                                                                <span className="mr-1 text-gray-700">Detail if NG:</span>
                                                                <input className="bg-transparent outline-none flex-1 text-blue-600 max-w-[50px] text-center mb-0 border-b border-black" value={formData[`rec_${recIndex}_Cont3_NGDetail`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont3_NGDetail', e.target.value)} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer Table: 5M Change Type */}
                            <div className="mt-8 border-2 border-black">
                                <table className="w-full border-collapse text-[12px] sm:text-sm">
                                    {/* ... Footer Table code preserved ... */}
                                    <thead>
                                        <tr>
                                            <th colSpan="18" className="border border-black bg-gray-100 p-1 text-left font-bold text-[12px]">
                                                5M Change type: Man
                                            </th>
                                        </tr>
                                        <tr className="bg-gray-50 text-[11px] font-bold text-center">
                                            <td className="border border-black p-1">Expected Change (Planned)</td>
                                            <td className="border border-black p-1">Change Description</td>
                                            <td className="border border-black p-1">Action plan</td>
                                            <td className="border border-black p-1">OJT</td>
                                            <td className="border border-black p-1">First Part Approval</td>
                                            <td className="border border-black p-1">Containment Action</td>
                                            <td className="border border-black p-1">Un-expected Change (Un-planned)</td>
                                            <td className="border border-black p-1">Change Description</td>
                                            <td className="border border-black p-1">Action plan</td>
                                            <td className="border border-black p-1">OJT</td>
                                            <td className="border border-black p-1">First Part Approval</td>
                                            <td className="border border-black p-1">Containment Action</td>
                                            <td className="border border-black p-1">Abnormal Condition</td>
                                            <td className="border border-black p-1">Change Description</td>
                                            <td className="border border-black p-1">Action plan</td>
                                            <td className="border border-black p-1 text-center">OJT</td>
                                            <td className="border border-black p-1">First Part Approval</td>
                                            <td className="border border-black p-1 text-left">Retro/Containment Parts Description</td>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[16px] leading-normal">
                                        {/* Row 1 */}
                                        <tr>
                                            <td rowSpan="7" className="border border-black p-1.5 text-center font-bold align-middle bg-slate-50">Expected Change (Planned)</td>
                                            <td rowSpan="2" className="border border-black p-1">Associate on planned leave / Absent without information (During start of shift)</td>
                                            <td className="border border-black p-1">Depute operator on station of same skill</td>
                                            <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                            <td rowSpan="7" className="border border-black p-1.5 text-center font-bold align-middle bg-slate-50">Un-expected Change (Un-planned)</td>
                                            <td rowSpan="2" className="border border-black p-1">Support operator / Work load (VD) adjustment</td>
                                            <td className="border border-black p-1">(a) Depute associates from similar skill and process from same or other line/machine</td>
                                            <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                            <td rowSpan="7" className="border border-black p-1.5 text-center font-bold align-middle bg-slate-50">Abnormal Condition</td>
                                            <td rowSpan="4" className="border border-black p-1">Extent working hours from 8 hrs (Over time)</td>
                                            <td className="border border-black p-1">Expert person shall check produced part (line/station/process change during over time)</td>
                                            <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                            <td rowSpan="7" className="border border-black p-1.5 align-top bg-slate-50/50">
                                                <div className="space-y-1.5">
                                                    <div>
                                                        <span className="font-bold underline">* Retro parts:</span>
                                                        <p className="mt-0.5 italic">Retro parts are the parts which are already produced when we come to know of change in process like m/c breakdown, poka yoke failures etc.</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold underline">* Containment parts:</span>
                                                        <p className="mt-0.5 italic">Containment parts are the parts produced after change (ex. Part produced by lower operator, part produced at time of poka yoke bypass)</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Row 2 */}
                                        <tr>
                                            <td className="border border-black p-0.5">In case of less skill- a) less skill associates can produce parts under supervision of expert</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-0.5">In case of less skill- (b) less skill associates under supervision of expert after training of defects</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-0.5"></td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                        </tr>
                                        {/* Row 3 */}
                                        <tr>
                                            <td className="border border-black p-0.5">New associates</td>
                                            <td className="border border-black p-0.5">Depute new associate to work station under supervision of expert</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                            <td rowSpan="2" className="border border-black p-0.5">Gate pass due to emergency (Operator not able to work due to sickness or accident)</td>
                                            <td className="border border-black p-0.5">Operator of same skill deputed</td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                            <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">Retroactive</td>
                                            <td className="border border-black p-0.5"></td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                        </tr>
                                        {/* Row 4 */}
                                        <tr>
                                            <td className="border border-black p-0.5">Job Rotation / Multi-skill</td>
                                            <td className="border border-black p-0.5">Part/Product training before placing on the station</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-0.5">Operator unskilled deputed</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-0.5"></td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                            <td className="border border-black p-0.5 text-center"></td>
                                        </tr>
                                        {/* Row 5 */}
                                        <tr>
                                            <td className="border border-black p-1">Associate work after Long vacation (1 month)</td>
                                            <td className="border border-black p-1">Depute associate under supervision of expert</td>
                                            <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                            <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                        </tr>
                                        {/* Row 6 */}
                                        <tr>
                                            <td rowSpan="2" className="border border-black p-1">Planned Gate pass</td>
                                            <td className="border border-black p-1">Depute operator on station of same skill</td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center font-semibold">Setup Approval</td>
                                            <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                        </tr>
                                        {/* Row 7 */}
                                        <tr>
                                            <td className="border border-black p-1">In case of less skill- a) less skill associates can produce parts under supervision of expert</td>
                                            <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                            <td className="border border-black p-1 text-center font-semibold">Setup Approval</td>
                                            <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                            <td className="border border-black p-1 text-center"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Revision Info Footer */}
                            <div className="mt-6 flex justify-between items-center px-1 pt-1 border-t border-black font-bold text-[16px] italic">
                                <span>FRM-WH-QA-241</span>
                                <span>Rev. No:02</span>
                                <span>Rev Date:27.01.2023</span>
                            </div>
                            <div className="h-[3px] bg-blue-700 w-full mt-0.5" />

                            {/* Add Row Button - Hidden in Print */}
                            <div className="mt-4 flex justify-center print:hidden">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-2 border-dashed border-2 hover:border-solid"
                                    onClick={() => setRowCount(prev => prev + 1)}
                                >
                                    <IconPlus className="w-4 h-4" />
                                    Add New Row
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default Daily5MRecording;
