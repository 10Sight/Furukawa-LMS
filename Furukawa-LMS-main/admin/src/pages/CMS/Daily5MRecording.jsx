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
    IconCpu,
    IconFilter,
    IconClipboardCheck,
    IconMail,
    IconPhoto,
    IconDownload
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
    const [selectedRole, setSelectedRole] = useState("QA_SHIFT_INCHARGE");

    const roles = [
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
            trigger({ search: val, limit: 10 });
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
        <Dialog open={open} onOpenChange={onOpenChange} className="max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
            <DialogContent className="flex-1 flex flex-col p-1 space-y-6 overflow-hidden">
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
                                        <div className="flex-1 min-w-0 mr-2">
                                            <div className="font-bold text-sm truncate">{u.fullName}</div>
                                            <div className="text-[11px] text-slate-500 truncate">
                                                ID: {u.empId} {u.deptName ? `| ${u.deptName}` : ''} {u.role && u.role !== 'USER' ? `| ${u.role}` : ''}
                                            </div>
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import UserAutocomplete from '@/components/common/UserAutocomplete';

const todayStr = new Date().toLocaleDateString('en-CA');


const LineSelect = ({ recIndex, departmentId, formData, onInputChange }) => {
    const { data: linesData, isLoading } = useGetLinesByDepartmentQuery(departmentId, { skip: !departmentId });
    const lines = linesData?.data || [];

    const handleChange = (e) => {
        const val = e.target.value;
        onInputChange(recIndex, 'From', val);
    };

    return (
        <select
            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
            value={formData[`rec_${recIndex}_From`] || ""}
            onChange={handleChange}
            disabled={!departmentId}
        >
            <option value="">{isLoading ? "Loading..." : "-"}</option>
            {lines.map((line, idx) => (
                <option key={line.id || line._id || idx} value={line.name}>
                    {line.name} {line.sectionName ? `(${line.sectionName})` : ''}
                </option>
            ))}
        </select>
    );
};

const SubSectionSelect = ({ recIndex, departmentId, sectionId, formData, onInputChange }) => {
    const { data: subSectionsData, isLoading } = useGetSubSectionsQuery({ departmentId, sectionId }, { skip: !departmentId });
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

const StationSelect = ({ recIndex, selectedSubSectionDisplayName, departmentId, sectionId, formData, onInputChange, disabled }) => {
    const { data: subSectionsData } = useGetSubSectionsQuery({ departmentId, sectionId }, { skip: !departmentId });
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

const ProcessSelect = ({ recIndex, selectedLineName, allLines, formData, onInputChange, disabled }) => {
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
            disabled={disabled || !lineId}
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

const ProblemSelect = ({ recIndex, value, onChange, disabled }) => {
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
                disabled={disabled}
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
                    disabled={disabled}
                    onChange={(e) => onChange(recIndex, 'Problem', e.target.value)}
                    className="text-blue-600 font-bold border-t border-dashed border-blue-200 pt-1"
                />
            )}
        </div>
    );
};

const AutoResizeTextarea = ({ value, onChange, placeholder, className, ...props }) => {
    return (
        <div className="grid min-w-[20px] relative w-max max-w-full">
            <div
                className={cn("invisible whitespace-pre-wrap min-h-[1.2rem] px-0 py-0.5 m-0 text-left pointer-events-none text-[16px]", className)}
                style={{ gridArea: '1 / 1 / 2 / 2' }}
            >
                {value || placeholder || ' '}
            </div>
            <textarea
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={cn("bg-transparent resize-none overflow-hidden focus:outline-none w-full h-full px-0 py-0.5 m-0 block text-black z-10 text-[16px]", className)}
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
            min={todayStr}
        />
    );
};

const CRIMPING_CONFIG = {
    headers: [
        // Row 1
        [{ text: "Daily 5M Recording Man -Crimping section", colSpan: 42, className: "bg-blue-50 text-lg font-bold" }],
        // Row 2
        [{ text: "*If any part NG during retroactive and containment inspection then 100% parts to be check since last OK (Set up / In-process)", colSpan: 42, className: "bg-yellow-50 text-red-600 font-semibold text-[16px]" }],
        // Row 3
        [
            { text: "(To be filled by Leader / Supervisor)", colSpan: 7, className: "bg-gray-100" },
            { text: "Auth. Person", colSpan: 3, className: "bg-emerald-50 text-emerald-800 font-bold border-black" },
            { text: "(To be filled by Leader / Supervisor)", colSpan: 7, className: "bg-gray-100" },
            { text: "Retroactive Inspection (To be filled by Leader / Supervisor Before Change)", colSpan: 6, className: "bg-gray-100" },
            { text: "Set up Approval After Change (To be filled by Quality dept., Pick 5 samples for judgement)", colSpan: 9, className: "bg-gray-100" },
            { text: "Containment Action if required", colSpan: 7, className: "bg-gray-100" },
            { text: "Process Owner", rowSpan: 3 },
            { text: "Approved By (QA Incharge)", rowSpan: 3 },
            { text: "Approve or Reject", rowSpan: 3, className: "bg-slate-100 font-bold" }
        ],
        // Row 4
        [
            { text: "Sr. No.", rowSpan: 2 },
            { text: "Date", rowSpan: 2 },
            { text: "Station M/C No", rowSpan: 2 },
            { text: "Shift", rowSpan: 2 },
            { text: "Planned / Un-Planned", rowSpan: 2 },
            { text: "Problem", rowSpan: 2 },
            { text: "Process Name", rowSpan: 2 },
            { text: "Operator / Inspector Name", rowSpan: 2 },
            { text: "Operator / Inspector ID", rowSpan: 2 },
            { text: "Current Skill Level", rowSpan: 2 },
            { text: "Req. Min Skill Level", rowSpan: 2 },
            { text: "Deputy Person Name (If req.)", rowSpan: 2 },
            { text: "Employee Code", rowSpan: 2 },
            { text: "Actual Skill Level", rowSpan: 2 },
            { text: "Deputed From (Line/Process/Station)", rowSpan: 2 },
            { text: "Deputed on Plan", rowSpan: 2 },
            { text: "OJT Status (Attended/Not Attended) [Attached OJT sheet]", rowSpan: 2 },

            { text: "Last Produced Part Status (Parameters)", rowSpan: 2 },
            { text: "Standard", colSpan: 2 },
            { text: "Result", colSpan: 2 },
            { text: "Status", rowSpan: 2, isSplit: true, splitLabels: ["Status", "Prod Supr Sign"] },

            { text: "Inspector Name", rowSpan: 2 },
            { text: "Part No.", rowSpan: 2 },
            { text: "Lot No.", rowSpan: 2 },
            { text: "Circuit No.", rowSpan: 2 },
            { text: "Set up Verification (Parameters)", rowSpan: 2 },
            { text: "Result (After Change)", colSpan: 2 },
            { text: "QA Shift In-charge name", rowSpan: 2 },
            { text: "Status", rowSpan: 2 },

            { text: "Support Person Name", rowSpan: 2 },
            { text: "Visual Check (100%)", colSpan: 2 },
            { text: "Dimension Check (Every 2 hours)", colSpan: 3 },
            { text: "Remarks", rowSpan: 2 }
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

const CrimpingRecord = ({ recIndex, formData, initialFormData, handleInputChange, departmentId, sectionId, canApprove, authUser, isLocked, isSubmitter, handleActionRow, skillLevels, canEditSubmitted5M, hasEditPermission, isReview }) => {
    const params = ['C/H', 'I/H', 'Strength', 'Length', 'Visual'];
    const rowStatus = formData[`rec_${recIndex}_RowStatus`];
    // Helper to determine if a specific containment field is locked
    const isFieldLocked = (field, isCheckField = false) => {
        if (isReview || !hasEditPermission) return true;
        if (rowStatus === 'APPROVED' && !authUser?.isAdmin) return true;
        if (rowStatus && !canEditSubmitted5M) return true;
        if (isCheckField && initialFormData[`rec_${recIndex}_${field}`] && !canEditSubmitted5M) return true;
        return false;
    };
    // Retroactive Inspection fields follow the same editability rules as Containment Action fields
    const isRetroLocked = isFieldLocked();

    return (
        <>
            {/* Row 1: Common fields and first parameter */}
            <tr className="hover:bg-slate-50">
                <td rowSpan="5" className="border border-black py-0.5 px-0 text-center">{recIndex + 1}</td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><input type="date" disabled={isLocked} className="w-full text-center bg-transparent h-7 text-[16px]" placeholder="Date" value={formData[`rec_${recIndex}_Date`] || ""} onChange={(e) => handleInputChange(recIndex, 'Date', e.target.value)} min={todayStr} /></td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <SubSectionSelect
                        recIndex={recIndex}
                        departmentId={departmentId}
                        sectionId={sectionId}
                        formData={formData}
                        onInputChange={handleInputChange}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_Shift`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'Shift', e.target.value)}
                        disabled={isLocked}
                    >
                        <option value="">-</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="G">G</option>
                        <option value="C">C</option>
                    </select>
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_Type`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'Type', e.target.value)}
                        disabled={isLocked}
                    >
                        <option value="">Select Type</option>
                        <option value="Planned">Planned</option>
                        <option value="Un-Planned">Un-Planned</option>
                    </select>
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <ProblemSelect
                        recIndex={recIndex}
                        value={formData[`rec_${recIndex}_Problem`] || ""}
                        onChange={handleInputChange}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <StationSelect
                        recIndex={recIndex}
                        selectedSubSectionDisplayName={formData[`rec_${recIndex}_StationMC`]}
                        departmentId={departmentId}
                        sectionId={sectionId}
                        formData={formData}
                        onInputChange={handleInputChange}
                        disabled={isLocked}
                    />
                </td>

                {/* Auth Person (Operator/Inspector Name, ID, Current Skill Level) */}
                <td rowSpan="5" className="border border-black p-0.5 min-w-[100px]">
                    <UserAutocomplete
                        compact
                        departmentId={departmentId}
                        value={formData[`rec_${recIndex}_OperatorName`] || ""}
                        onChange={(user) => {
                            handleInputChange(recIndex, 'OperatorName', user.fullName);
                            handleInputChange(recIndex, 'CSL', user.currentLevel || "L1");
                            handleInputChange(recIndex, 'OperatorId', user.empId || "");
                        }}
                        placeholder="Operator..."
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black p-0.5 text-center font-mono text-[16px]">
                    {formData[`rec_${recIndex}_OperatorId`] || ""}
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0 text-center">
                    <AutoResizeTextarea
                        className="text-center"
                        placeholder="CSL"
                        value={formData[`rec_${recIndex}_CSL`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'CSL', e.target.value)}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_ReqSkill`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'ReqSkill', e.target.value)}
                        disabled={isLocked}
                    >
                        <option value="">Req Skill</option>
                        {(skillLevels || []).map((level, idx) => (
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
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0 text-center">
                    <AutoResizeTextarea
                        className="text-center"
                        placeholder="Emp Code"
                        value={formData[`rec_${recIndex}_EmpCode`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'EmpCode', e.target.value)}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_ActSkill`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'ActSkill', e.target.value)}
                        disabled={isLocked}
                    >
                        <option value="">Act Skill</option>
                        <option value="Under Monitoring">Under Monitoring</option>
                        {(skillLevels || []).map((level, idx) => (
                            <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                        ))}
                    </select>
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <LineSelect
                        recIndex={recIndex}
                        departmentId={formData[`rec_${recIndex}_DeputedDeptId`]}
                        formData={formData}
                        onInputChange={handleInputChange}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <DaysInput
                        value={formData[`rec_${recIndex}_DeputedOnPlan`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'DeputedOnPlan', e.target.value)}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <select
                        className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                        value={formData[`rec_${recIndex}_OJT`] || ""}
                        onChange={(e) => handleInputChange(recIndex, 'OJT', e.target.value)}
                        disabled={isLocked}
                    >
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </td>

                {/* Retro Parameters (First of 5) */}
                <td className="border border-black p-0.5 text-center font-bold bg-gray-50"><AutoResizeTextarea className="text-center font-bold bg-transparent" value={formData[`rec_${recIndex}_Param_${params[0]}`] !== undefined ? formData[`rec_${recIndex}_Param_${params[0]}`] : params[0]} onChange={(e) => handleInputChange(recIndex, `Param_${params[0]}`, e.target.value)} disabled={isRetroLocked} /></td>
                <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${params[0]}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${params[0]}_F`, e.target.value)} disabled={isRetroLocked} /></td>
                <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${params[0]}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${params[0]}_R`, e.target.value)} disabled={isRetroLocked} /></td>
                <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${params[0]}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${params[0]}_F`, e.target.value)} disabled={isRetroLocked} /></td>
                <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${params[0]}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${params[0]}_R`, e.target.value)} disabled={isRetroLocked} /></td>
                <td rowSpan="2" className="border border-black p-0.5 text-center align-middle">
                    <div className="flex flex-col h-full items-center justify-center gap-1">
                        <select
                            className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                            value={formData[`rec_${recIndex}_Retro_Status_Top`] !== undefined ? formData[`rec_${recIndex}_Retro_Status_Top`] : "OK"}
                            onChange={(e) => handleInputChange(recIndex, 'Retro_Status_Top', e.target.value)}
                            disabled={isRetroLocked}
                        >
                            <option value="OK">OK</option>
                            <option value="Rework">Rework</option>
                            <option value="Scrap">Scrap</option>
                        </select>
                        <div className="w-full h-px bg-black/10" />
                    </div>
                </td>

                {/* Setup Part Info */}
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_InspectorName`] || ""} onChange={(e) => handleInputChange(recIndex, 'InspectorName', e.target.value)} disabled={isLocked} /></td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_PartNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'PartNo', e.target.value)} disabled={isLocked} /></td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_LotNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'LotNo', e.target.value)} disabled={isLocked} /></td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_CircuitNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'CircuitNo', e.target.value)} disabled={isLocked} /></td>

                {/* Setup Verification sub-row */}
                <td className="border border-black p-0.5 text-center font-bold bg-gray-50">
                    <div className="flex flex-col items-center leading-tight">
                        <span>{params[0]}</span>
                        <span className="text-[16px] text-gray-500 font-normal">W/H</span>
                    </div>
                </td>
                <td className="border border-black py-0.5 px-0">
                    <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${params[0]}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${params[0]}_F`, e.target.value)} disabled={isLocked} />
                </td>
                <td className="border border-black py-0.5 px-0">
                    <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${params[0]}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${params[0]}_R`, e.target.value)} disabled={isLocked} />
                </td>

                <td rowSpan="5" className="border border-black p-0.5 text-[16px]">
                    <AssignmentSelect
                        departmentId={departmentId}
                        role="QA_SHIFT_INCHARGE"
                        value={formData[`rec_${recIndex}_QA_Incharge`] || ""}
                        onChange={(val) => handleInputChange(recIndex, 'QA_Incharge', val)}
                        placeholder="QA Shift IC"
                        className='text-[16px]'
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_Status`] || ""} onChange={(e) => handleInputChange(recIndex, 'Result_Status', e.target.value)} disabled={isLocked} /></td>

                {/* Containment */}
                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <UserAutocomplete
                        value={formData[`rec_${recIndex}_Cont_SupportPerson`] || ""}
                        onChange={({ fullName }) => handleInputChange(recIndex, 'Cont_SupportPerson', fullName)}
                        placeholder="Support Person"
                        compact={true}
                        disabled={isLocked}
                    />
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Cont_ProdQty`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_ProdQty', e.target.value)} disabled={isFieldLocked('Cont_ProdQty')} /></td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Cont_NGQty`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_NGQty', e.target.value)} disabled={isFieldLocked('Cont_NGQty')} /></td>

                {/* Dimension Check 1st */}
                <td rowSpan="2" className="border border-black p-0.5 align-top">
                    <div className="flex flex-col text-[16px] p-0.5 h-full">
                        <div className="font-semibold mb-1">C/H:</div>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Std1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Std1', e.target.value)} disabled={isFieldLocked('Cont_CH_Std1', true)} /></label>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Obs1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Obs1', e.target.value)} disabled={isFieldLocked('Cont_CH_Obs1', true)} /></label>
                    </div>
                </td>
                {/* Dimension Check 2nd */}
                <td rowSpan="2" className="border border-black p-0.5 align-top">
                    <div className="flex flex-col text-[16px] p-0.5 h-full">
                        <div className="font-semibold mb-1">C/H:</div>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Std2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Std2', e.target.value)} disabled={isFieldLocked('Cont_CH_Std2', true)} /></label>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Obs2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Obs2', e.target.value)} disabled={isFieldLocked('Cont_CH_Obs2', true)} /></label>
                    </div>
                </td>
                {/* Dimension Check 3rd */}
                <td rowSpan="2" className="border border-black p-0.5 align-top">
                    <div className="flex flex-col text-[16px] p-0.5 h-full">
                        <div className="font-semibold mb-1">C/H:</div>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full mb-0.5"><span className="mr-0.5">Std.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Std3`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Std3', e.target.value)} disabled={isFieldLocked('Cont_CH_Std3', true)} /></label>
                        <label className="flex items-center whitespace-nowrap cursor-text text-blue-600 w-full"><span className="mr-0.5">Obs.-</span><input className="flex-1 bg-transparent outline-none min-w-0" value={formData[`rec_${recIndex}_Cont_CH_Obs3`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont_CH_Obs3', e.target.value)} disabled={isFieldLocked('Cont_CH_Obs3', true)} /></label>
                    </div>
                </td>
                <td rowSpan="5" className="border border-black py-0.5 px-0"><AutoResizeTextarea placeholder="Remarks" value={formData[`rec_${recIndex}_Remarks`] || ""} onChange={(e) => handleInputChange(recIndex, 'Remarks', e.target.value)} disabled={isFieldLocked('Remarks')} /></td>

                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <div className="flex flex-col gap-1">
                        <AutoResizeTextarea
                            className="text-center font-bold text-blue-700"
                            value={formData[`rec_${recIndex}_Process_Owner`] || ""}
                            onChange={(e) => handleInputChange(recIndex, 'Process_Owner', e.target.value)}
                            placeholder="Owner"
                            disabled={isLocked}
                        />
                    </div>
                </td>

                <td rowSpan="5" className="border border-black py-0.5 px-0">
                    <div className="flex flex-col gap-1">
                        <AutoResizeTextarea
                            className="text-center font-bold text-blue-700"
                            value={formData[`rec_${recIndex}_Approved_By`] || ""}
                            onChange={(e) => handleInputChange(recIndex, 'Approved_By', e.target.value)}
                            placeholder="Approver"
                            disabled={isLocked}
                        />
                    </div>
                </td>

                <td rowSpan="5" className="border border-black p-0.5 align-middle text-center bg-slate-50/20 w-28">
                    <div className="flex flex-col items-center justify-center min-h-[100px]">
                        {rowStatus ? (
                            <div className={`p-2 rounded flex flex-col items-center gap-1 border shadow-sm ${rowStatus === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                <div className="flex items-center gap-1 font-black text-[10px] uppercase tracking-wider">
                                    {rowStatus === 'APPROVED' ? <IconCheck size={16} className="stroke-[3]" /> : <IconX size={16} className="stroke-[3]" />}
                                    {rowStatus}
                                </div>
                                <div className="text-[12px] font-bold leading-none">{formData[`rec_${recIndex}_ActionBy`]}</div>
                                <div className="text-[10px] opacity-70 whitespace-nowrap">
                                    {formData[`rec_${recIndex}_ActionAt`] && new Date(formData[`rec_${recIndex}_ActionAt`]).toLocaleDateString()}
                                </div>
                            </div>
                        ) : (
                            (canApprove || authUser?.role === 'ADMIN') && formData[`rec_${recIndex}_Date`] ? (
                                <div className="flex flex-col gap-2 p-1 w-full max-w-[90px]">
                                    <Button
                                        size="sm"
                                        className="h-7 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase shadow-sm"
                                        onClick={() => handleActionRow(recIndex, 'approve')}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 w-full border-red-200 text-red-600 hover:bg-red-50 font-bold text-[10px] uppercase shadow-sm"
                                        onClick={() => handleActionRow(recIndex, 'reject')}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            ) : isSubmitter && canApprove && formData[`rec_${recIndex}_Date`] ? (
                                <div className="text-[10px] text-orange-600 font-bold text-center leading-tight">
                                    Self-Approval <br /> Restricted
                                </div>
                            ) : (
                                <div className="text-[10px] text-slate-400 font-medium italic">
                                    {!formData[`rec_${recIndex}_Date`] ? "Fill Date" : "Verify-Row"}
                                </div>
                            )
                        )}
                    </div>
                </td>
            </tr>

            {/* Remaining sub-rows for parameters */}
            {params.slice(1).map(p => (
                <tr key={p} className="hover:bg-slate-50">
                    <td className="border border-black p-0.5 text-center font-bold bg-gray-50"><AutoResizeTextarea className="text-center font-bold bg-transparent" value={formData[`rec_${recIndex}_Param_${p}`] !== undefined ? formData[`rec_${recIndex}_Param_${p}`] : p} onChange={(e) => handleInputChange(recIndex, `Param_${p}`, e.target.value)} disabled={isRetroLocked} /></td>
                    {p === 'Visual' ? (
                        <>
                            <td className="border border-black p-0.5 text-center text-[16px] bg-gray-50 font-bold">Total Qty</td>
                            <td className="border border-black py-0.5 px-0"><input type="text" className="w-full text-center bg-transparent h-7 text-[16px]" value={formData[`rec_${recIndex}_Retro_${p}_TQ`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_TQ`, e.target.value)} disabled={isRetroLocked} /></td>
                            <td className="border border-black p-0.5 text-center text-[16px] bg-gray-50 font-bold">NG Qty</td>
                            <td className="border border-black py-0.5 px-0"><input type="text" className="w-full text-center bg-transparent h-7 text-[16px]" value={formData[`rec_${recIndex}_Retro_${p}_NG`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_NG`, e.target.value)} disabled={isRetroLocked} /></td>
                        </>
                    ) : p === 'Length' ? (
                        <>
                            <td colSpan="2" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_F`, e.target.value)} disabled={isRetroLocked} /></td>
                            <td colSpan="2" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${p}_F`, e.target.value)} disabled={isRetroLocked} /></td>
                        </>
                    ) : (
                        <>
                            <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_F`, e.target.value)} disabled={isRetroLocked} /></td>
                            <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Retro_${p}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Retro_${p}_R`, e.target.value)} disabled={isRetroLocked} /></td>
                            <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${p}_F`, e.target.value)} disabled={isRetroLocked} /></td>
                            <td className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Result_${p}_R`] || ""} onChange={(e) => handleInputChange(recIndex, `Result_${p}_R`, e.target.value)} disabled={isRetroLocked} /></td>
                        </>
                    )}

                    {p === 'I/H' ? null : (
                        <td className="border border-black p-0.5 text-center align-middle">
                            <select
                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                value={formData[`rec_${recIndex}_Retro_Status_${p}`] || "OK"}
                                onChange={(e) => handleInputChange(recIndex, `Retro_Status_${p}`, e.target.value)}
                                disabled={isRetroLocked}
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
                        <td colSpan="2" className="border border-black py-0.5 px-0">
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
                            <td className="border border-black py-0.5 px-0">
                                <AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_Setup_${p}_F`] || ""} onChange={(e) => handleInputChange(recIndex, `Setup_${p}_F`, e.target.value)} />
                            </td>
                            <td className="border border-black py-0.5 px-0">
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
    const viewMode = searchParams.get('mode') === 'view';
    const { data: departmentsData, isLoading: isLoadingDepts } = useGetAllDepartmentsQuery();
    const { data: sectionsData, isLoading: isLoadingSections } = useGetSectionsByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: linesData, isLoading: isLoadingLines } = useGetLinesBySectionQuery(selectedSection, { skip: !selectedSection });
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
    const [submittedById, setSubmittedById] = useState(null);

    // New workflow state
    const [showFormList, setShowFormList] = useState(true);
    const [todayRecords, setTodayRecords] = useState([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [addDialogType, setAddDialogType] = useState('standard');
    const [addDialogDate, setAddDialogDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [currentRecordId, setCurrentRecordId] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [recordStatus, setRecordStatus] = useState('PENDING');

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Auth state for permissions
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin;
    const hasApprovalPermission = isAdmin || authUser?.customRole?.permissions?.includes('daily5m:approve');
    const canView5M = isAdmin || authUser?.customRole?.permissions?.includes('daily5m:read');
    const canEdit5M = isAdmin || authUser?.customRole?.permissions?.includes('daily5m:update');
    const canEditSubmitted5M = isAdmin || authUser?.customRole?.permissions?.includes('daily5m:edit_submitted');
    const isSessionLocked = recordStatus && String(recordStatus).toUpperCase() !== 'PENDING';
    const hasEditPermission = isAdmin || canEdit5M || canEditSubmitted5M;

    // Segregation of Duties: User who filled/submitted the form CANNOT approve/reject it.
    // Even Admins are restricted from approving their own entries for audit integrity.
    const isSubmitter = authUser && submittedById && String(authUser.id || authUser._id) === String(submittedById);
    const canApprove = hasApprovalPermission && !isSubmitter;

    const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
    const [isManagePeopleOpen, setIsManagePeopleOpen] = useState(false);
    const [isAdminRemarkDialogOpen, setIsAdminRemarkDialogOpen] = useState(false);
    const [adminRemarkText, setAdminRemarkText] = useState('');
    const [pendingSaveParams, setPendingSaveParams] = useState(null);
    const [emailForPDF, setEmailForPDF] = useState("");
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const tableRef = React.useRef(null);

    const assignableDepartments = React.useMemo(() => {
        const allDepts = departmentsData?.data?.departments || [];
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);

        const assignedIds = rawAssigned.map(id => String(id)).filter(id => id && id !== "null" && id !== "undefined");

        if (!authUser || isAdmin || assignedIds.length === 0) return allDepts;

        return allDepts.filter(dept =>
            assignedIds.includes(String(dept.id || dept._id))
        );
    }, [departmentsData, authUser, isAdmin]);

    const assignableSections = React.useMemo(() => {
        const allSections = sections || [];
        const rawAssigned = Array.isArray(authUser?.sections) ? [...authUser.sections] : [];
        if (authUser?.sectionId) rawAssigned.push(authUser.sectionId);

        const assignedIds = rawAssigned.map(id => String(id)).filter(id => id && id !== "null" && id !== "undefined");

        if (!authUser || isAdmin || assignedIds.length === 0) return allSections;

        return allSections.filter(sec =>
            assignedIds.includes(String(sec.id || sec._id))
        );
    }, [sections, authUser, isAdmin]);

    const isRestricted = !isAdmin && authUser && (
        (authUser.departments && authUser.departments.length > 0) ||
        authUser.departmentId ||
        (authUser.sections && authUser.sections.length > 0) ||
        authUser.sectionId
    );

    const selectedDeptName = assignableDepartments.find(d => String(d._id || d.id) === String(selectedDepartment))?.name || (isLoadingDepts ? "Loading..." : "Department");
    const section = sections.find(s => String(s._id || s.id) === String(selectedSection));
    const selectedSectionName = section ? `${section.name}${section.category ? ` (${section.category})` : ''}` : (isLoadingSections ? "Loading..." : "Section");

    // Auto-select department and section if only one is available for restricted users
    useEffect(() => {
        if (isRestricted) {
            if (assignableDepartments.length === 1 && !selectedDepartment) {
                const targetId = String(assignableDepartments[0]._id || assignableDepartments[0].id);
                setSelectedDepartment(targetId);
            }
            if (selectedDepartment && assignableSections.length === 1 && !selectedSection) {
                const targetId = String(assignableSections[0]._id || assignableSections[0].id);
                setSelectedSection(targetId);
            }
        }
    }, [isRestricted, assignableDepartments, assignableSections, selectedDepartment, selectedSection]);

    useEffect(() => {
        if (selectedDepartment) {
            fetchConfig(selectedDepartment);

            // Only reset section if:
            // 1. We're not loading from a URL/deep link
            // 2. AND the user IS NOT restricted to a single section (to avoid fighting the auto-selection)
            const isSectionPreDetermined = isRestricted && assignableSections.length === 1;

            if (!urlRecordId && !location.state?.recordId && !location.state?.playUser && !isSectionPreDetermined) {
                setSelectedSection("");
            }
        } else {
            setTableConfig(null);
            setConfigError(null);
        }
    }, [selectedDepartment, urlRecordId, location.state?.recordId, isRestricted, assignableSections.length]);

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

    const handleDownloadHighResImage = async () => {
        if (!tableRef.current) return;
        const loadingToast = toast.info("Generating high-resolution image for PPT...", { duration: 0 });
        setIsGeneratingPDF(true);

        try {
            // 1. Get actual dimensions
            const tableWidth = tableRef.current.scrollWidth;
            const tableHeight = tableRef.current.scrollHeight;

            // 2. Capture as PNG with high pixelRatio (4x for extreme clarity in PPT)
            const dataUrl = await toPng(tableRef.current, {
                width: tableWidth,
                height: tableHeight,
                style: {
                    transform: 'none',
                    margin: '0',
                },
                backgroundColor: '#ffffff',
                pixelRatio: 4,
                quality: 1,
            });

            // 3. Trigger Download
            const link = document.createElement('a');
            link.download = `Daily_5M_${selectedDeptName.replace(/\s+/g, '_')}_${selectedDate}.png`;
            link.href = dataUrl;
            link.click();

            toast.success("High-res image downloaded! You can now insert this into PPT.");
            setIsPrintDialogOpen(false);
        } catch (error) {
            console.error("Image export error:", error);
            toast.error("Failed to generate high-res image.");
        } finally {
            toast.dismiss(loadingToast);
            setIsGeneratingPDF(false);
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
        let classes = "border border-black py-0.5 px-0 text-center ";
        if (header.className) classes += header.className;
        if (header.width) classes += ` ${header.width}`;
        return classes;
    };

    // Data Entry State
    const [formData, setFormData] = useState({});
    const [initialFormData, setInitialFormData] = useState({}); // Tracking which rows were already filled on load
    const [formType, setFormType] = useState('standard'); // 'standard' or 'crimping'
    const isCrimping = formType === 'crimping'; // Derived variable for convenience

    // Play Mode state for automated workflows
    const [isPlayMode, setIsPlayMode] = useState(false);
    const [playUserData, setPlayUserData] = useState(null);
    const [isAutoCreating, setIsAutoCreating] = useState(false);

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
                setInitialFormData(data.recordData);
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

    const handleAddForm = async (typeOverride = null) => {
        // Guard against React click events being passed as the first argument
        const normalizedType = typeof typeOverride === 'string' ? typeOverride : null;
        const activeType = normalizedType || addDialogType;
        if (!activeType) {
            toast.error("Please select a form type");
            return;
        }

        try {
            // Create an initial stub record in the database so it appears in the list 
            // and has a persistent ID for sessions.
            // Data Pre-filling for Play Mode
            let initialRecordData = {};
            if (isPlayMode && playUserData) {
                const user = playUserData;
                const recIndex = 0;

                // Use passed date if available, otherwise default to today
                const targetDate = user.date || new Date().toLocaleDateString('en-CA');
                initialRecordData[`rec_${recIndex}_Date`] = targetDate;

                if (user.shift || user.logShift) {
                    initialRecordData[`rec_${recIndex}_Shift`] = user.shift || user.logShift;
                }

                // Set Skill Level (Automated Fetch)
                const level = user.currentLevel || "L1";
                if (activeType === 'crimping') {
                    initialRecordData[`rec_${recIndex}_CSL`] = level;
                } else {
                    initialRecordData[`rec_${recIndex}_CurSkill`] = level;
                }

                // Robust line matching (case-insensitive, trimmed) to get metadata like Line Leader
                const userLName = (user.lineName || user.subSectionName || "").trim().toLowerCase();
                const matchedLine = lines.find(l =>
                    (l.name && l.name.trim().toLowerCase() === userLName) ||
                    (l.id === user.lineId) || (l._id === user.lineId)
                );

                if (activeType === 'crimping') {
                    // For Crimping: 
                    // Column 3 (StationMC) expects "SubSectionName (LineName)"
                    const lineDisp = (user.subSectionName && user.lineName)
                        ? `${user.subSectionName} (${user.lineName})`
                        : (user.subSectionName || user.lineName || "");

                    initialRecordData[`rec_${recIndex}_StationMC`] = lineDisp;

                    // Column 7 (Process) expects "MachineName" (which corresponds to stationName in user profile)
                    initialRecordData[`rec_${recIndex}_Process`] = user.stationName || "";
                    initialRecordData[`rec_${recIndex}_OperatorName`] = user.fullName || "";
                    initialRecordData[`rec_${recIndex}_OperatorId`] = user.empId || "";
                } else {
                    // For Standard/SRC:
                    // Set Line Leader (Automated Fetch from Line Name)
                    if (matchedLine) {
                        initialRecordData[`rec_${recIndex}_Line`] = matchedLine.name;
                        const leader = matchedLine.lineLeader || "";
                        initialRecordData[`rec_${recIndex}_FP_Leader`] = leader;
                        initialRecordData[`rec_${recIndex}_FP_1`] = leader;
                    } else {
                        // Fallback to raw names from user profile
                        initialRecordData[`rec_${recIndex}_Line`] = user.lineName || user.subSectionName || "";
                    }

                    initialRecordData[`rec_${recIndex}_Process`] = user.stationName || "";
                    initialRecordData[`rec_${recIndex}_OpName`] = user.fullName || "";
                    initialRecordData[`rec_${recIndex}_OpCode`] = user.empId || "";
                }
            }

            // PRODUCTION-LEVEL AUTOFILL: Set the Process Owner for the first row (index 0) 
            // as soon as the session is created. This ensures the initiator is marked as the owner by default.
            const ownerField = activeType === 'crimping' ? 'Process_Owner' : 'Owner_Sign';
            if (authUser?.fullName) {
                initialRecordData[`rec_0_${ownerField}`] = authUser.fullName;
            }

            const payload = {
                departmentId: selectedDepartment,
                sectionId: selectedSection,
                date: addDialogDate,
                shift: initialRecordData['rec_0_Shift'] || "",
                line: initialRecordData['rec_0_Line'] || initialRecordData['rec_0_StationMC'] || "",
                formType: activeType,
                recordData: initialRecordData
            };

            const response = await axiosInstance.post('/api/daily-5m/record/create', payload);
            if (response.data.success) {
                const newRecord = response.data.data;
                setFormData({});
                setInitialFormData({});
                setFormType(activeType);
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
                toast.success(`${activeType.toUpperCase()} form session created`);

                // Clear Play Mode after successful creation and pre-fill
                setIsPlayMode(false);
                setPlayUserData(null);
                setIsAutoCreating(false);
            }
        } catch (error) {
            console.error("Error creating new form session:", error);
            toast.error("Failed to create recording session");
        }
    };

    // Handle "Play Mode" from All Users page
    useEffect(() => {
        if (location.state?.playUser) {
            const user = location.state.playUser;
            setIsPlayMode(true);
            setPlayUserData(user);

            // Auto-select department and section
            if (user.departmentId) setSelectedDepartment(String(user.departmentId));
            if (user.sectionId) setSelectedSection(String(user.sectionId));

            // Clear state so we don't re-trigger on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Auto-open form if in Play Mode and single form type
    useEffect(() => {
        // Wait for sections to be loaded
        if (selectedSection && sections && sections.length > 0) {
            const section = sections.find(s => String(s._id || s.id) === String(selectedSection));
            if (!section) return;

            if (isPlayMode && showFormList && !isAutoCreating) {
                // In Play Mode, we want to be as automated as possible.
                const daily5mFormType = section?.daily5mFormType || "";
                const allowedTypes = daily5mFormType.split(",").map(t => t.trim()).filter(Boolean);
                const sName = (section?.name || "").toLowerCase();

                // Determine the auto-type based on config or keywords (matching visibility rules)
                let autoType = "";
                if (allowedTypes.length > 0) {
                    autoType = allowedTypes[0];
                } else if (sName.includes("crimping") || sName.includes("cutting")) {
                    autoType = "crimping";
                } else if (sName.includes("src")) {
                    autoType = "src";
                } else {
                    autoType = "standard";
                }

                if (autoType) {
                    setIsAutoCreating(true);
                    setAddDialogType(autoType);
                    // Direct call instead of timeout
                    handleAddForm(autoType);
                }
            } else if (!isPlayMode && showFormList) {
                // Standard non-play mode behavior: auto-select single type IF explicitly configured
                const daily5mFormType = section?.daily5mFormType || "";
                const types = daily5mFormType.split(",").map(t => t.trim()).filter(Boolean);
                if (types.length === 1) {
                    setAddDialogType(types[0]);
                }
            }
        }
    }, [isPlayMode, selectedSection, sections, showFormList, isAutoCreating]);

    // Auto-set the dialog form type when the dialog or section changes
    useEffect(() => {
        if (isAddDialogOpen && selectedSection) {
            const currentSection = sections.find(s => (s._id || s.id) === selectedSection);
            if (currentSection?.daily5mFormType) {
                const types = currentSection.daily5mFormType.split(",");
                if (types.length === 1) {
                    setAddDialogType(types[0]);
                } else {
                    // Reset if multiple options exist, so user must choose
                    setAddDialogType("");
                }
            }
        }
    }, [isAddDialogOpen, selectedSection, sections]);

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
                setSelectedDate(record.date ? new Date(record.date).toISOString().split('T')[0] : new Date().toLocaleDateString('en-CA'));
                setFormData(recordData);
                setInitialFormData(recordData);
                setSubmittedBy(record.submittedByName || "User");
                setSubmittedById(record.submittedBy);
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

    const getOwnerField = (type) => type === 'crimping' ? 'Process_Owner' : 'Owner_Sign';

    const getStandardMandatoryFields = (i) => [
        { key: `rec_${i}_Date`,        label: "Date" },
        { key: `rec_${i}_Line`,        label: "Line" },
        { key: `rec_${i}_Shift`,       label: "Shift" },
        { key: `rec_${i}_Type`,        label: "Planned/Un-Planned" },
        { key: `rec_${i}_Process`,     label: "Process" },
        { key: `rec_${i}_Problem`,     label: "Problem" },
        { key: `rec_${i}_OpName`,      label: "Operator Name" },
        { key: `rec_${i}_CurSkill`,    label: "Current Skill Level" },
        { key: `rec_${i}_ReqSkill`,    label: "Req. Min Skill Level" },
        { key: `rec_${i}_Deputed`,     label: "Deputy Person Name" },
        { key: `rec_${i}_DeputedCode`, label: "Employee Code" },
        { key: `rec_${i}_ActSkill`,    label: "Actual Skill Level" },
        { key: `rec_${i}_From`,        label: "Deputed From" },
        { key: `rec_${i}_Plan`,        label: "Deputed on Plan" },
        { key: `rec_${i}_OJT`,         label: "OJT Status" },
        { key: `rec_${i}_Retro1_NA`,   label: "Visual Retro Result" },
        { key: `rec_${i}_Retro2_NA`,   label: "Dimension Retro Result" },
        { key: `rec_${i}_Retro3_TQ`,   label: "Total Qty (Retro)" },
        { key: `rec_${i}_Retro3_NG`,   label: "NG Qty (Retro)" },
        { key: `rec_${i}_FP_Leader`,   label: "Inspector Name" },
        { key: `rec_${i}_FP_PartNo`,   label: "Part No." },
        { key: `rec_${i}_FP_LotNo`,    label: "Lot No." },
        { key: `rec_${i}_FP_SrNo_1`,   label: "Circuit No. 1" },
        { key: `rec_${i}_FP1_Chk1`,    label: "Visual Check (Circuit 1)" },
        { key: `rec_${i}_FP1_Chk2`,    label: "Visual Check (Circuit 2)" },
        { key: `rec_${i}_FP1_Chk3`,    label: "Visual Check (Circuit 3)" },
        { key: `rec_${i}_FP1_Chk4`,    label: "Visual Check (Circuit 4)" },
        { key: `rec_${i}_FP1_Chk5`,    label: "Visual Check (Circuit 5)" },
        { key: `rec_${i}_FP2_Chk1`,    label: "Dimension Check (Circuit 1)" },
        { key: `rec_${i}_FP2_Chk2`,    label: "Dimension Check (Circuit 2)" },
        { key: `rec_${i}_FP2_Chk3`,    label: "Dimension Check (Circuit 3)" },
        { key: `rec_${i}_FP2_Chk4`,    label: "Dimension Check (Circuit 4)" },
        { key: `rec_${i}_FP2_Chk5`,    label: "Dimension Check (Circuit 5)" },
        { key: `rec_${i}_Result_1`,    label: "QA Shift In-charge" },
        { key: `rec_${i}_Owner_Sign`,  label: "Process Owner" },
    ];

    const getCrimpingMandatoryFields = (i) => {
        const params = ['C/H', 'I/H', 'Strength', 'Length', 'Visual'];
        const retroFields = params.flatMap(p => [
            { key: `rec_${i}_Retro_${p}_F`,  label: `Retro Standard ${p} (F)` },
            { key: `rec_${i}_Retro_${p}_R`,  label: `Retro Standard ${p} (R)` },
            { key: `rec_${i}_Result_${p}_F`, label: `Retro Result ${p} (F)` },
            { key: `rec_${i}_Result_${p}_R`, label: `Retro Result ${p} (R)` },
        ]);
        const setupFields = params.flatMap(p => [
            { key: `rec_${i}_Setup_${p}_F`, label: `Setup Verification ${p} (F)` },
            { key: `rec_${i}_Setup_${p}_R`, label: `Setup Verification ${p} (R)` },
        ]);
        return [
            { key: `rec_${i}_Date`,            label: "Date" },
            { key: `rec_${i}_StationMC`,       label: "Station M/C No" },
            { key: `rec_${i}_Shift`,           label: "Shift" },
            { key: `rec_${i}_Type`,            label: "Planned/Un-Planned" },
            { key: `rec_${i}_Problem`,         label: "Problem" },
            { key: `rec_${i}_Process`,         label: "Process Name" },
            { key: `rec_${i}_OperatorName`,    label: "Operator Name" },
            { key: `rec_${i}_CSL`,             label: "Current Skill Level" },
            { key: `rec_${i}_ReqSkill`,        label: "Req. Min Skill Level" },
            { key: `rec_${i}_DeputedPerson`,   label: "Deputy Person Name" },
            { key: `rec_${i}_EmpCode`,         label: "Employee Code" },
            { key: `rec_${i}_ActSkill`,        label: "Actual Skill Level" },
            { key: `rec_${i}_From`,            label: "Deputed From" },
            { key: `rec_${i}_DeputedOnPlan`,   label: "Deputed on Plan" },
            { key: `rec_${i}_OJT`,             label: "OJT Status" },
            ...retroFields,
            { key: `rec_${i}_InspectorName`,   label: "Inspector Name" },
            { key: `rec_${i}_PartNo`,          label: "Part No." },
            { key: `rec_${i}_LotNo`,           label: "Lot No." },
            { key: `rec_${i}_CircuitNo`,       label: "Circuit No." },
            ...setupFields,
            { key: `rec_${i}_QA_Incharge`,     label: "QA Shift In-charge" },
            { key: `rec_${i}_Process_Owner`,   label: "Process Owner" },
        ];
    };

    const handleInputChange = (recIndex, field, value) => {
        setFormData(prev => {
            const newFormData = {
                ...prev,
                [`rec_${recIndex}_${field}`]: value
            };

            // PRODUCTION-LEVEL AUTOFILL: Automatically fetch and set the logged-in user's name
            // as the Process Owner for the row if it's currently empty.
            // This triggers as soon as the user starts filling ANY field in that row.
            const ownerField = getOwnerField(formType);
            if (!newFormData[`rec_${recIndex}_${ownerField}`] && authUser?.fullName) {
                newFormData[`rec_${recIndex}_${ownerField}`] = authUser.fullName;
            }

            // Auto-populate 'N/A' in Support Person Name if OJT is 'No'
            if (field === 'OJT' && value === 'No') {
                newFormData[`rec_${recIndex}_Cont1_Shift`] = 'N/A';
            }

            return newFormData;
        });
    };

    const handleSaveRecord = async (currentData = null, options = {}) => {
        if (!selectedDepartment) {
            toast.error("Please select a department");
            return;
        }

        // Intercept: admin editing a submitted or approved session must provide a remark
        const isAdminUser = isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
        const lockedStatuses = ['APPROVED', 'SUBMITTED'];
        if (isAdminUser && lockedStatuses.includes(String(recordStatus).toUpperCase()) && !options.adminRemarks) {
            setPendingSaveParams({ currentData, options });
            setAdminRemarkText('');
            setIsAdminRemarkDialogOpen(true);
            return;
        }

        const isEvent = currentData && (currentData.nativeEvent || currentData.target);
        const dataToSave = (currentData && !isEvent) ? currentData : formData;
        const skipNavigate = options?.skipNavigate || false;
        const showPreview = options?.showPreview || false;

        if (showPreview) {
            let hasActiveRows = false;
            const rowErrors = [];
            for (let i = 0; i < rowCount; i++) {
                const isActive = !!(
                    dataToSave[`rec_${i}_Line`] ||
                    dataToSave[`rec_${i}_StationMC`] ||
                    dataToSave[`rec_${i}_OpName`] ||
                    dataToSave[`rec_${i}_OperatorName`]
                );
                if (!isActive) continue;
                hasActiveRows = true;
                const mandatoryFields = isCrimping
                    ? getCrimpingMandatoryFields(i)
                    : getStandardMandatoryFields(i);
                const missingLabels = mandatoryFields
                    .filter(f => !dataToSave[f.key]?.toString().trim())
                    .map(f => f.label);
                if (missingLabels.length > 0) rowErrors.push({ row: i + 1, missing: missingLabels });
            }
            if (!hasActiveRows) {
                toast.error("The form is empty. Please fill at least one row before saving.");
                return;
            }
            if (rowErrors.length > 0) {
                rowErrors.forEach(({ row, missing }) => {
                    toast.error(`Row ${row}: Missing — ${missing.join(', ')}`, { duration: 7000 });
                });
                return;
            }
        }

        try {
            const payload = {
                departmentId: selectedDepartment,
                sectionId: selectedSection,
                date: selectedDate,
                shift: dataToSave['rec_0_Shift'] || "",
                line: dataToSave['rec_0_Line'] || dataToSave['rec_0_StationMC'] || "",
                formType: formType,
                recordData: dataToSave,
                sessionId: sessionId,
                adminRemarks: options.adminRemarks || null
            };

            const response = await axiosInstance.post('/api/daily-5m/record/create', payload);
            if (response.data.success && response.data.data) {
                const newId = response.data.data.id;
                setCurrentRecordId(newId);
                navigate(`${location.pathname}?recordId=${newId}`, { replace: true });
            }

            toast.success("Record saved successfully!");

            if (showPreview) {
                setIsPreviewOpen(true);
            } else if (!skipNavigate) {
                navigate(location.pathname, { replace: true });
                setShowFormList(true);
                fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
            } else {
                fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
            }
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.response?.data?.message || "Failed to save record");
        }
    };

    const handleSubmitSession = async () => {
        if (!currentRecordId) {
            toast.error("No record found to submit. Please save first.");
            return;
        }

        // --- VALIDATION: All active rows must have all mandatory (non-containment) fields filled ---
        let hasActiveRows = false;
        const rowErrors = [];

        for (let i = 0; i < rowCount; i++) {
            const isActive = !!(
                formData[`rec_${i}_Line`] ||
                formData[`rec_${i}_StationMC`] ||
                formData[`rec_${i}_OpName`] ||
                formData[`rec_${i}_OperatorName`]
            );
            if (!isActive) continue;

            hasActiveRows = true;

            const mandatoryFields = isCrimping
                ? getCrimpingMandatoryFields(i)
                : getStandardMandatoryFields(i);

            const missingLabels = mandatoryFields
                .filter(f => !formData[f.key]?.toString().trim())
                .map(f => f.label);

            if (missingLabels.length > 0) {
                rowErrors.push({ row: i + 1, missing: missingLabels });
            }
        }

        if (!hasActiveRows) {
            toast.error("The form is empty. Please fill at least one row before submitting.");
            return;
        }

        if (rowErrors.length > 0) {
            rowErrors.forEach(({ row, missing }) => {
                toast.error(
                    `Row ${row}: Missing — ${missing.join(', ')}`,
                    { duration: 7000 }
                );
            });
            return;
        }
        // ----------------------------------------------------------------------

        setIsSubmitting(true);
        try {
            const response = await axiosInstance.post(`/api/daily-5m/record/${currentRecordId}/submit`);
            if (response.data.success) {
                toast.success("Form submitted successfully!");
                setRecordStatus('SUBMITTED'); // Update local state immediately
                setIsPreviewOpen(false);
                // Redirect back to list after successful submission
                navigate(location.pathname, { replace: true });
                setShowFormList(true);
                fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
            }
        } catch (error) {
            console.error("Submission error:", error);
            toast.error(error.response?.data?.message || "Failed to submit form");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendEmailNotification = async () => {
        if (!currentRecordId) return;
        setIsSendingEmail(true);
        try {
            const response = await axiosInstance.post(`/api/daily-5m/record/${currentRecordId}/send-email`);
            if (response.data.success) {
                toast.success("Email notification sent successfully!");
                setIsPreviewOpen(false);
                // Return to list view
                navigate(location.pathname, { replace: true });
                setShowFormList(true);
                fetchTodayRecords(selectedDepartment, selectedSection, selectedDate);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to send email notification");
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleActionRow = (recIndex, action) => {
        if (!canApprove) {
            toast.error("You do not have permission to perform this action.");
            return;
        }

        const date = formData[`rec_${recIndex}_Date`];
        if (!date) {
            toast.error("Please fill the date for this row before approving/rejecting.");
            return;
        }

        const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
        const actionAt = new Date().toISOString();

        // Prepare updated data object
        const updatedData = {
            ...formData,
            [`rec_${recIndex}_RowStatus`]: status,
            [`rec_${recIndex}_ActionBy`]: authUser.fullName,
            [`rec_${recIndex}_ActionById`]: authUser.empId,
            [`rec_${recIndex}_ActionAt`]: actionAt,
            [`rec_${recIndex}_Approved_By`]: authUser.fullName
        };

        // Update local state
        setFormData(updatedData);

        toast.success(`Row ${recIndex + 1} ${status.toLowerCase()} successfully! Saving...`);

        // Trigger auto-save in background
        handleSaveRecord(updatedData, { skipNavigate: true });
    };

    // Helper to process text (existing)
    const renderRecordingTable = (isReview = false) => {
        const activeConfig = formType === 'crimping' ? CRIMPING_CONFIG : tableConfig;
        if (!activeConfig) return null;

        return (
            <div className="w-full bg-white p-4">
                {/* Main Table Container */}
                <div className="border-2 border-black block min-w-full print:overflow-visible">
                    <table className="w-max print:w-full min-w-full border-collapse text-[16px] sm:text-xs">
                        <thead>
                            {(() => {
                                // 1. Identify where to place the "Approve or Reject" header
                                const totalHeaderRows = activeConfig.headers.length;
                                let targetRowIndex = totalHeaderRows - 1;

                                if (formType !== 'crimping') {
                                    for (let i = 0; i < totalHeaderRows; i++) {
                                        const row = activeConfig.headers[i];
                                        const lastItem = row[row.length - 1];
                                        if (lastItem && (i + (lastItem.rowSpan || 1) === totalHeaderRows)) {
                                            if (row.length > 1) {
                                                targetRowIndex = i;
                                                break;
                                            }
                                        }
                                    }
                                }

                                return activeConfig.headers.map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {row.map((header, colIndex) => {
                                            let headerText = processText(header.text);
                                            if (formType === 'src' && rowIndex === 0 && colIndex === 0) {
                                                headerText = "Daily 5M Recording Man - SRC section";
                                            }

                                            const isLastInRow = colIndex === row.length - 1;
                                            const adjustedColSpan = (formType !== 'crimping' && rowIndex < targetRowIndex && isLastInRow)
                                                ? (header.colSpan || 1) + 1
                                                : header.colSpan;

                                            return (
                                                <th
                                                    key={colIndex}
                                                    colSpan={adjustedColSpan}
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
                                        {formType !== 'crimping' && rowIndex === targetRowIndex && (
                                            <th
                                                rowSpan={activeConfig.headers[targetRowIndex][activeConfig.headers[targetRowIndex].length - 1].rowSpan || 1}
                                                className="border border-black py-0.5 px-0 bg-slate-100 font-bold text-center text-[10px] uppercase align-middle shadow-sm"
                                            >
                                                Approve or Reject
                                            </th>
                                        )}
                                    </tr>
                                ));
                            })()}
                        </thead>
                        <tbody>
                            {[...Array(rowCount)].map((_, recIndex) =>
                                formType === 'crimping' ?
                                    <CrimpingRecord
                                        key={recIndex}
                                        recIndex={recIndex}
                                        formData={formData}
                                        initialFormData={initialFormData}
                                        handleInputChange={handleInputChange}
                                        departmentId={selectedDepartment}
                                        sectionId={selectedSection}
                                        canApprove={canApprove && !isReview}
                                        authUser={authUser}
                                        isLocked={isReview || !hasEditPermission || (formData[`rec_${recIndex}_RowStatus`] === 'APPROVED' && !isAdmin) || ((!!formData[`rec_${recIndex}_RowStatus`] || checkIsRowFilled(initialFormData, recIndex)) && !canEditSubmitted5M)}
                                        isSubmitter={isSubmitter}
                                        handleActionRow={handleActionRow}
                                        skillLevels={skillLevels}
                                        canEditSubmitted5M={canEditSubmitted5M}
                                        hasEditPermission={hasEditPermission}
                                        isReview={isReview}
                                    />
                                    :
                                    <React.Fragment key={recIndex}>
                                        {(() => {
                                            const rowStatus = formData[`rec_${recIndex}_RowStatus`];
                                            const isRowInitiallyFilled = checkIsRowFilled(initialFormData, recIndex);
                                            const isLocked = isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || ((!!rowStatus || isRowInitiallyFilled) && !canEditSubmitted5M);
                                            const isRetroLocked = isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M);
                                            return (
                                                <>
                                                    {/* Row 1 of Record */}
                                                    <tr className="hover:bg-slate-50">
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0 text-center">{recIndex + 1}</td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0"><input type="date" disabled={isLocked} className="w-full text-center bg-transparent h-7 text-[16px]" placeholder="Date" value={formData[`rec_${recIndex}_Date`] || ""} onChange={(e) => handleInputChange(recIndex, 'Date', e.target.value)} min={todayStr} /></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_Line`] || ""}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    handleInputChange(recIndex, 'Line', val);
                                                                    const selectedLine = lines.find(l => l.name === val);
                                                                    const leader = selectedLine?.lineLeader || "";
                                                                    handleInputChange(recIndex, 'FP_Leader', leader);
                                                                    handleInputChange(recIndex, 'FP_1', leader);
                                                                }}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">-</option>
                                                                {lines.map((line, idx) => (
                                                                    <option key={line._id || line.id || idx} value={line.name}>
                                                                        {line.name} {line.sectionName ? `(${line.sectionName})` : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_Shift`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Shift', e.target.value)}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">-</option>
                                                                <option value="A">A</option>
                                                                <option value="B">B</option>
                                                                <option value="G">G</option>
                                                                <option value="C">C</option>
                                                            </select>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_Type`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Type', e.target.value)}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">Select Type</option>
                                                                <option value="Planned">Planned</option>
                                                                <option value="Un-Planned">Un-Planned</option>
                                                            </select>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <ProcessSelect
                                                                recIndex={recIndex}
                                                                selectedLineName={formData[`rec_${recIndex}_Line`]}
                                                                allLines={lines}
                                                                formData={formData}
                                                                onInputChange={handleInputChange}
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <ProblemSelect
                                                                recIndex={recIndex}
                                                                value={formData[`rec_${recIndex}_Problem`] || ""}
                                                                onChange={handleInputChange}
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black p-0.5 text-center font-mono text-[16px]">
                                                            {formData[`rec_${recIndex}_OpCode`] || ""}
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
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
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" placeholder="Cur Skill" value={formData[`rec_${recIndex}_CurSkill`] || ""} onChange={(e) => handleInputChange(recIndex, 'CurSkill', e.target.value)} disabled={isLocked} /></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_ReqSkill`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'ReqSkill', e.target.value)}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">Req Skill</option>
                                                                {skillLevels.map((level, idx) => (
                                                                    <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                                                                ))}
                                                            </select></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" placeholder="Deputed" value={formData[`rec_${recIndex}_Deputed`] || ""} onChange={(e) => handleInputChange(recIndex, 'Deputed', e.target.value)} disabled={isLocked} /></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
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
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_ActSkill`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'ActSkill', e.target.value)}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">Act Skill</option>
                                                                <option value="Under Monitoring">Under Monitoring</option>
                                                                {skillLevels.map((level, idx) => (
                                                                    <option key={level.id || level._id || idx} value={level.name}>{level.name}</option>
                                                                ))}
                                                            </select></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <div className="flex flex-col gap-1 items-center justify-center h-full">
                                                                {formData[`rec_${recIndex}_DeputedDeptName`] && (
                                                                    <span className="text-[16px] text-gray-500 font-bold uppercase">{formData[`rec_${recIndex}_DeputedDeptName`]}</span>
                                                                )}
                                                                <LineSelect
                                                                    recIndex={recIndex}
                                                                    departmentId={formData[`rec_${recIndex}_DeputedDeptId`]}
                                                                    formData={formData}
                                                                    onInputChange={handleInputChange}
                                                                    disabled={isLocked}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <DaysInput
                                                                value={formData[`rec_${recIndex}_Plan`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'Plan', e.target.value)}
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <select
                                                                className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                value={formData[`rec_${recIndex}_OJT`] || ""}
                                                                onChange={(e) => handleInputChange(recIndex, 'OJT', e.target.value)}
                                                                disabled={isLocked}
                                                            >
                                                                <option value="">Select</option>
                                                                <option value="Yes">Yes</option>
                                                                <option value="No">No</option>
                                                            </select>
                                                        </td>

                                                        {/* Retro Row 1 */}
                                                        <td className="border border-black p-0.5 text-center font-semibold"><AutoResizeTextarea className="text-center font-semibold bg-transparent" value={formData[`rec_${recIndex}_Retro1_Visual`] !== undefined ? formData[`rec_${recIndex}_Retro1_Visual`] : "Visual"} onChange={(e) => handleInputChange(recIndex, 'Retro1_Visual', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td colSpan="2" className="border border-black py-0.5 px-0 text-center"><AutoResizeTextarea className="text-center bg-transparent w-full" value={formData[`rec_${recIndex}_Retro1_VisualSOP`] !== undefined ? formData[`rec_${recIndex}_Retro1_VisualSOP`] : "Visual as per SOP"} onChange={(e) => handleInputChange(recIndex, 'Retro1_VisualSOP', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center text-gray-400"><AutoResizeTextarea className="text-center text-gray-400 bg-transparent w-full" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro1_NA`] !== undefined ? formData[`rec_${recIndex}_Retro1_NA`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro1_NA', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5 text-center align-middle">
                                                            <div className="flex flex-col h-full items-center justify-center gap-1">
                                                                <select
                                                                    className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]"
                                                                    value={formData[`rec_${recIndex}_Retro_Status`] !== undefined ? formData[`rec_${recIndex}_Retro_Status`] : "OK"}
                                                                    onChange={(e) => handleInputChange(recIndex, 'Retro_Status', e.target.value)}
                                                                    disabled={isRetroLocked}
                                                                >
                                                                    <option value="OK">OK</option>
                                                                    <option value="Rework">Rework</option>
                                                                    <option value="Scrap">Scrap</option>
                                                                </select>
                                                                <div className="w-full h-px bg-black/10" />
                                                            </div>
                                                        </td>

                                                        {/* FP Row 1 */}
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_FP_Leader`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP_Leader', e.target.value)} disabled={isLocked} /></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_FP_PartNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP_PartNo', e.target.value)} disabled={isLocked} /></td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center" value={formData[`rec_${recIndex}_FP_LotNo`] || ""} onChange={(e) => handleInputChange(recIndex, 'FP_LotNo', e.target.value)} disabled={isLocked} /></td>
                                                        <td rowSpan="3" className="border border-black p-0.5 h-full p-0">
                                                            <div className="flex flex-col h-full text-[8px] min-h-[60px]">
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_1`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_1`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_1', e.target.value)} disabled={isLocked} /></div>
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_2`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_2`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_2', e.target.value)} disabled={isLocked} /></div>
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_3`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_3`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_3', e.target.value)} disabled={isLocked} /></div>
                                                                <div className="flex-1 flex items-center justify-center border-b border-black"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_4`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_4`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_4', e.target.value)} disabled={isLocked} /></div>
                                                                <div className="flex-1 flex items-center justify-center"><AutoResizeTextarea className="text-center min-w-0 bg-transparent text-blue-600" value={formData[`rec_${recIndex}_FP_SrNo_5`] !== undefined ? formData[`rec_${recIndex}_FP_SrNo_5`] : ""} onChange={(e) => handleInputChange(recIndex, 'FP_SrNo_5', e.target.value)} disabled={isLocked} /></div>
                                                            </div>
                                                        </td>
                                                        <td className="border border-black py-0.5 px-0 text-center"><AutoResizeTextarea className="text-center bg-transparent w-full text-[16px]" value={formData[`rec_${recIndex}_FP1_VisualSOP`] !== undefined ? formData[`rec_${recIndex}_FP1_VisualSOP`] : "Visual(As per SOP)"} onChange={(e) => handleInputChange(recIndex, 'FP1_VisualSOP', e.target.value)} disabled={isLocked} /></td>
                                                        {[1, 2, 3, 4, 5].map(num => (
                                                            <td key={`FP1_Chk${num}`} className="border border-black p-0.5 min-w-[60px]">
                                                                <select className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]" value={formData[`rec_${recIndex}_FP1_Chk${num}`] || ""} onChange={(e) => handleInputChange(recIndex, `FP1_Chk${num}`, e.target.value)} disabled={isLocked}>
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
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <div className="flex flex-col text-[16px] items-center justify-center p-1 font-semibold min-h-[40px]">
                                                                NG Detail if<br />any: <input className="w-6 text-center border-none ml-1 bg-transparent" value={formData[`rec_${recIndex}_Result_2`] !== undefined ? formData[`rec_${recIndex}_Result_2`] : "0"} onChange={(e) => handleInputChange(recIndex, 'Result_2', e.target.value)} disabled={isLocked} />
                                                            </div>
                                                        </td>

                                                        {/* Cont Row 1 */}
                                                        <td rowSpan="2" className="border border-black py-0.5 px-0">
                                                            <UserAutocomplete
                                                                value={formData[`rec_${recIndex}_Cont1_Shift`] || ""}
                                                                onChange={({ fullName }) => handleInputChange(recIndex, 'Cont1_Shift', fullName)}
                                                                placeholder="Support Person"
                                                                compact={true}
                                                                disabled={isLocked}
                                                            />
                                                        </td>
                                                        <td rowSpan="2" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center text-blue-600 font-semibold" value={formData[`rec_${recIndex}_Cont1_Day_1`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont1_Day_1', e.target.value)} disabled={isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M)} /></td>
                                                        <td rowSpan="2" className="border border-black py-0.5 px-0"><AutoResizeTextarea className="text-center text-blue-600 font-semibold" value={formData[`rec_${recIndex}_Cont1_Day_2`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont1_Day_2', e.target.value)} disabled={isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M)} /></td>

                                                        <td rowSpan="2" className="border border-black p-0.5 align-top">
                                                            <div className="flex flex-col text-[16px] p-0.5 text-blue-600">
                                                                <div className="font-semibold mb-1 text-center border-b border-gray-300 pb-0.5 border-dashed text-black">Dim.</div>
                                                                <AutoResizeTextarea className="text-center leading-tight whitespace-pre-wrap mt-0.5 bg-transparent" value={formData[`rec_${recIndex}_Cont_Dim_1`] !== undefined ? formData[`rec_${recIndex}_Cont_Dim_1`] : ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Dim_1', e.target.value)} disabled={isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M) || (initialFormData[`rec_${recIndex}_Cont_Dim_1`] && !canEditSubmitted5M)} />
                                                            </div>
                                                        </td>
                                                        <td rowSpan="2" className="border border-black p-0.5 align-top">
                                                            <div className="flex flex-col text-[16px] p-0.5 text-blue-600">
                                                                <div className="font-semibold mb-1 text-center border-b border-gray-300 pb-0.5 border-dashed text-black">Dim.</div>
                                                                <AutoResizeTextarea className="text-center leading-tight whitespace-pre-wrap mt-0.5 bg-transparent" value={formData[`rec_${recIndex}_Cont_Dim_2`] !== undefined ? formData[`rec_${recIndex}_Cont_Dim_2`] : ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Dim_2', e.target.value)} disabled={isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M) || (initialFormData[`rec_${recIndex}_Cont_Dim_2`] && !canEditSubmitted5M)} />
                                                            </div>
                                                        </td>
                                                        <td rowSpan="2" className="border border-black p-0.5 align-top">
                                                            <div className="flex flex-col text-[16px] p-0.5 text-blue-600">
                                                                <div className="font-semibold mb-1 text-center border-b border-gray-300 pb-0.5 border-dashed text-black">Dim.</div>
                                                                <AutoResizeTextarea className="text-center leading-tight whitespace-pre-wrap mt-0.5 bg-transparent" value={formData[`rec_${recIndex}_Cont_Dim_3`] !== undefined ? formData[`rec_${recIndex}_Cont_Dim_3`] : ""} onChange={(e) => handleInputChange(recIndex, 'Cont_Dim_3', e.target.value)} disabled={isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M) || (initialFormData[`rec_${recIndex}_Cont_Dim_3`] && !canEditSubmitted5M)} />
                                                            </div>
                                                        </td>

                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <div className="flex flex-col h-full relative min-h-[40px] items-center justify-end pb-1">
                                                                <AutoResizeTextarea className="text-center text-blue-600 bg-transparent" value={formData[`rec_${recIndex}_Cont1_Remarks`] || "0"} onChange={(e) => handleInputChange(recIndex, 'Cont1_Remarks', e.target.value)} disabled={isReview || !hasEditPermission || (rowStatus === 'APPROVED' && !isAdmin) || (rowStatus && !canEditSubmitted5M)} />
                                                            </div>
                                                        </td>

                                                        {/* Process Owner/Incharge Selection */}
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <div className="flex flex-col gap-1">
                                                                <AutoResizeTextarea
                                                                    className="text-center font-bold text-blue-700"
                                                                    value={formData[`rec_${recIndex}_Owner_Sign`] || ""}
                                                                    onChange={(e) => handleInputChange(recIndex, 'Owner_Sign', e.target.value)}
                                                                    placeholder="Incharge"
                                                                    disabled={isLocked}
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* QA Approver Selection */}
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0">
                                                            <div className="flex flex-col gap-1">
                                                                <AutoResizeTextarea
                                                                    className="text-center font-bold text-blue-700"
                                                                    value={formData[`rec_${recIndex}_Approved_By`] || ""}
                                                                    onChange={(e) => handleInputChange(recIndex, 'Approved_By', e.target.value)}
                                                                    placeholder="Approved By"
                                                                    disabled={isLocked}
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* Approve or Reject Action Column */}
                                                        <td rowSpan="3" className="border border-black py-0.5 px-0 align-middle text-center bg-slate-50/20">
                                                            <div className="flex flex-col items-center justify-center min-h-[100px]">
                                                                {rowStatus ? (
                                                                    <div className={`p-1.5 rounded flex flex-col items-center gap-0.5 border shadow-sm ${rowStatus === 'APPROVED'
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                                        }`}>
                                                                        <div className="flex items-center gap-1 font-black text-[9px] uppercase tracking-wider">
                                                                            {rowStatus === 'APPROVED' ? <IconCheck size={14} className="stroke-[3]" /> : <IconX size={14} className="stroke-[3]" />}
                                                                            {rowStatus}
                                                                        </div>
                                                                        <div className="text-[11px] font-bold leading-none">{formData[`rec_${recIndex}_ActionBy`]}</div>
                                                                        <div className="text-[9px] opacity-70 whitespace-nowrap">
                                                                            {formData[`rec_${recIndex}_ActionAt`] && new Date(formData[`rec_${recIndex}_ActionAt`]).toLocaleDateString()}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    canApprove && !isReview && formData[`rec_${recIndex}_Date`] ? (
                                                                        <div className="flex flex-col gap-1.5 p-1 w-full max-w-[80px]">
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-7 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-tight shadow-sm"
                                                                                onClick={() => handleActionRow(recIndex, 'approve')}
                                                                            >
                                                                                Approve
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-7 w-full text-red-600 border-red-200 hover:bg-red-50 font-bold text-[10px] uppercase tracking-tight shadow-sm bg-white"
                                                                                onClick={() => handleActionRow(recIndex, 'reject')}
                                                                            >
                                                                                Reject
                                                                            </Button>
                                                                        </div>
                                                                    ) : isSubmitter && hasApprovalPermission && formData[`rec_${recIndex}_Date`] ? (
                                                                        <div className="text-[9px] text-orange-600 font-bold text-center leading-tight">
                                                                            Self-Approval <br /> Restricted
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[9px] text-slate-400 font-medium italic">
                                                                            {!formData[`rec_${recIndex}_Date`] ? "Fill Date" : "Verify-Row"}
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Row 2 of Record */}
                                                    <tr className="hover:bg-slate-50">
                                                        {/* Retro Row 2 */}
                                                        <td className="border border-black py-0.5 px-0 text-center font-semibold"><AutoResizeTextarea className="text-center font-semibold bg-transparent" value={formData[`rec_${recIndex}_Retro2_Dim`] !== undefined ? formData[`rec_${recIndex}_Retro2_Dim`] : "Dimension"} onChange={(e) => handleInputChange(recIndex, 'Retro2_Dim', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center text-[16px] leading-tight"><AutoResizeTextarea className="text-center text-[16px] bg-transparent w-full" value={formData[`rec_${recIndex}_Retro2_Desc`] !== undefined ? formData[`rec_${recIndex}_Retro2_Desc`] : "Dim as per Dim board\n(if change at F/A process)"} onChange={(e) => handleInputChange(recIndex, 'Retro2_Desc', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td colSpan="2" className="border border-black p-0.5 text-center text-gray-400"><AutoResizeTextarea className="text-center text-gray-400 bg-transparent w-full text-blue-600" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro2_NA`] !== undefined ? formData[`rec_${recIndex}_Retro2_NA`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro2_NA', e.target.value)} disabled={isRetroLocked} /></td>

                                                        {/* FP Row 2 */}
                                                        <td rowSpan="2" className="border border-black p-0.5 text-center text-[8px] leading-tight"><AutoResizeTextarea className="text-center text-[16px] bg-transparent w-full" value={formData[`rec_${recIndex}_FP2_Desc`] !== undefined ? formData[`rec_${recIndex}_FP2_Desc`] : "Dim as per Dim board(If F/A)"} onChange={(e) => handleInputChange(recIndex, 'FP2_Desc', e.target.value)} disabled={isLocked} /></td>
                                                        {[1, 2, 3, 4, 5].map(num => (
                                                            <td rowSpan="2" key={`FP2_Chk${num}`} className="border border-black p-0.5 min-w-[60px]">
                                                                <select className="w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[16px]" value={formData[`rec_${recIndex}_FP2_Chk${num}`] || ""} onChange={(e) => handleInputChange(recIndex, `FP2_Chk${num}`, e.target.value)} disabled={isLocked}>
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
                                                        <td className="border border-black py-0.5 px-0 text-center font-semibold"><AutoResizeTextarea className="text-center font-semibold bg-transparent" value={formData[`rec_${recIndex}_Retro3_Visual`] !== undefined ? formData[`rec_${recIndex}_Retro3_Visual`] : "Visual"} onChange={(e) => handleInputChange(recIndex, 'Retro3_Visual', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td className="border border-black p-0.5 text-center text-[16px]">Total Qty</td>
                                                        <td className="border border-black p-0.5 text-center text-blue-600"><AutoResizeTextarea className="text-center bg-transparent w-full text-blue-600" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro3_TQ`] !== undefined ? formData[`rec_${recIndex}_Retro3_TQ`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro3_TQ', e.target.value)} disabled={isRetroLocked} /></td>
                                                        <td className="border border-black p-0.5 text-center text-[16px]">NG Qty</td>
                                                        <td className="border border-black p-0.5 text-center text-blue-600"><AutoResizeTextarea className="text-center bg-transparent w-full text-blue-600" placeholder={"NA"} value={formData[`rec_${recIndex}_Retro3_NG`] !== undefined ? formData[`rec_${recIndex}_Retro3_NG`] : ""} onChange={(e) => handleInputChange(recIndex, 'Retro3_NG', e.target.value)} disabled={isRetroLocked} /></td>

                                                        {/* Cont Row 3 */}
                                                        <td colSpan="6" className="border border-black py-0.5 px-0">
                                                            <div className="flex flex-row items-center justify-end text-[16px] w-full pr-2 text-right">
                                                                <span className="mr-1 text-gray-700">Detail if NG:</span>
                                                                <input className="bg-transparent outline-none flex-1 text-blue-600 max-w-[50px] text-center mb-0 border-b border-black" value={formData[`rec_${recIndex}_Cont3_NGDetail`] || ""} onChange={(e) => handleInputChange(recIndex, 'Cont3_NGDetail', e.target.value)} disabled={isLocked} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </React.Fragment>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Table: 5M Change Type */}
                <div className="mt-8 border-2 border-black">
                    <table className="w-full border-collapse text-[12px] sm:text-sm">
                        <thead>
                            <tr>
                                <th colSpan="18" className="border border-black bg-gray-100 p-1 text-left font-bold text-[12px]">
                                    5M Change type: Man
                                </th>
                            </tr>
                            <tr className="bg-gray-50 text-[11px] font-bold text-center">
                                <td className="border border-black py-0.5 px-0">Expected Change (Planned)</td>
                                <td className="border border-black py-0.5 px-0">Change Description</td>
                                <td className="border border-black py-0.5 px-0">Action plan</td>
                                <td className="border border-black py-0.5 px-0">OJT</td>
                                <td className="border border-black py-0.5 px-0">First Part Approval</td>
                                <td className="border border-black py-0.5 px-0">Containment Action</td>
                                <td className="border border-black py-0.5 px-0">Un-expected Change (Un-planned)</td>
                                <td className="border border-black py-0.5 px-0">Change Description</td>
                                <td className="border border-black py-0.5 px-0">Action plan</td>
                                <td className="border border-black py-0.5 px-0">OJT</td>
                                <td className="border border-black py-0.5 px-0">First Part Approval</td>
                                <td className="border border-black py-0.5 px-0">Containment Action</td>
                                <td className="border border-black py-0.5 px-0">Abnormal Condition</td>
                                <td className="border border-black py-0.5 px-0">Change Description</td>
                                <td className="border border-black py-0.5 px-0">Action plan</td>
                                <td className="border border-black p-1 text-center">OJT</td>
                                <td className="border border-black py-0.5 px-0">First Part Approval</td>
                                <td className="border border-black p-1 text-left">Retro/Containment Parts Description</td>
                            </tr>
                        </thead>
                        <tbody className="text-[16px] leading-normal">
                            {/* Row 1 */}
                            <tr>
                                <td rowSpan="7" className="border border-black p-1.5 text-center font-bold align-middle bg-slate-50">Expected Change (Planned)</td>
                                <td rowSpan="2" className="border border-black py-0.5 px-0">Associate on planned leave / Absent without information (During start of shift)</td>
                                <td className="border border-black py-0.5 px-0">Depute operator on station of same skill</td>
                                <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                <td rowSpan="7" className="border border-black p-1.5 text-center font-bold align-middle bg-slate-50">Un-expected Change (Un-planned)</td>
                                <td rowSpan="2" className="border border-black py-0.5 px-0">Support operator / Work load (VD) adjustment</td>
                                <td className="border border-black py-0.5 px-0">(a) Depute associates from similar skill and process from same or other line/machine</td>
                                <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                <td rowSpan="7" className="border border-black p-1.5 text-center font-bold align-middle bg-slate-50">Abnormal Condition</td>
                                <td rowSpan="4" className="border border-black py-0.5 px-0">Extent working hours from 8 hrs (Over time)</td>
                                <td className="border border-black py-0.5 px-0">Expert person shall check produced part (line/station/process change during over time)</td>
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
                                <td className="border border-black py-0.5 px-0">In case of less skill- a) less skill associates can produce parts under supervision of expert</td>
                                <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0">In case of less skill- (b) less skill associates under supervision of expert after training of defects</td>
                                <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                            </tr>
                            {/* Row 3 */}
                            <tr>
                                <td className="border border-black py-0.5 px-0">New associates</td>
                                <td className="border border-black py-0.5 px-0">Depute new associate to work station under supervision of expert</td>
                                <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                <td rowSpan="2" className="border border-black py-0.5 px-0">Gate pass due to emergency (Operator not able to work due to sickness or accident)</td>
                                <td className="border border-black py-0.5 px-0">Operator of same skill deputed</td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                                <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-0.5 text-center font-semibold">Retroactive</td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                            </tr>
                            {/* Row 4 */}
                            <tr>
                                <td className="border border-black py-0.5 px-0">Job Rotation / Multi-skill</td>
                                <td className="border border-black py-0.5 px-0">Part/Product training before placing on the station</td>
                                <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0">Operator unskilled deputed</td>
                                <td className="border border-black p-0.5 text-center font-semibold">OJT</td>
                                <td className="border border-black p-0.5 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-0.5 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                                <td className="border border-black py-0.5 px-0 text-center"></td>
                            </tr>
                            {/* Row 5 */}
                            <tr>
                                <td className="border border-black py-0.5 px-0">Associate work after Long vacation (1 month)</td>
                                <td className="border border-black py-0.5 px-0">Depute associate under supervision of expert</td>
                                <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                <td className="border border-black p-1 text-center font-semibold">First Part Approval</td>
                                <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                            </tr>
                            {/* Row 6 */}
                            <tr>
                                <td rowSpan="2" className="border border-black py-0.5 px-0">Planned Gate pass</td>
                                <td className="border border-black py-0.5 px-0">Depute operator on station of same skill</td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center font-semibold">Setup Approval</td>
                                <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                            </tr>
                            {/* Row 7 */}
                            <tr>
                                <td className="border border-black py-0.5 px-0">In case of less skill- a) less skill associates can produce parts under supervision of expert</td>
                                <td className="border border-black p-1 text-center font-semibold">OJT</td>
                                <td className="border border-black p-1 text-center font-semibold">Setup Approval</td>
                                <td className="border border-black p-1 text-center font-semibold">Containment Action</td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black p-1 text-center"></td>
                                <td className="border border-black py-0.5 px-0"></td>
                                <td className="border border-black py-0.5 px-0"></td>
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

                {/* Add Row Button - Hidden in Print and Review */}
                {!isReview && (
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
                )}
            </div>
        );
    };

    const processText = (text) => {
        if (!text) return "";
        return text.replace("{DeptName}", selectedDeptName);
    };

    // Helper to check if a row in a specific data set has significant data (Line, OpName, or Station)
    const checkIsRowFilled = (data, index) => {
        if (!data) return false;
        // Primary fields that signify a row is "active" or "filled"
        return !!(data[`rec_${index}_Line`] || data[`rec_${index}_OpName`] || data[`rec_${index}_StationMC`] || data[`rec_${index}_OperatorName`]);
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

                    {!viewMode && (
                        <Button onClick={() => handleSaveRecord(null, { showPreview: true })} disabled={!selectedDepartment || loadingConfig || !hasEditPermission}>
                            <IconClipboardList className="w-5 h-5 mr-2" />
                            Save & Preview
                        </Button>
                    )}
                    <Button onClick={() => setIsPrintDialogOpen(true)} variant="outline" disabled={!tableConfig}>
                        <IconPrinter className="w-5 h-5 mr-2" />
                        Print Sheet
                    </Button>

                    <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen} className="sm:max-w-[425px]">
                        <DialogContent className="">
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
                                        onClick={handleDownloadHighResImage}
                                        disabled={isGeneratingPDF}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    >
                                        {isGeneratingPDF ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                                        <IconPhoto className="w-4 h-4 mr-2" />
                                        Save as High-Res Image (for PPT)
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setIsPrintDialogOpen(false);
                                            setTimeout(() => {
                                                window.print();
                                            }, 150);
                                        }}
                                        className="w-full"
                                    >
                                        Standard Browser Print
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Preview & Submit Dialog */}
                    <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen} className="max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden">
                        <DialogContent className="flex-1 flex flex-col p-2 sm:p-4 min-h-0 overflow-hidden">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-bold flex items-center justify-between">
                                    <span>Review Recording & Submit</span>
                                    <Badge variant="outline" className="ml-2 uppercase bg-blue-50 text-blue-700 border-blue-200">
                                        Level: {formType === 'standard' ? 'Assembly' : formType === 'src' ? 'SRC' : 'Crimping'}
                                    </Badge>
                                </DialogTitle>
                            </DialogHeader>

                            <div className="flex-1 overflow-auto py-4 px-2">
                                <div className="space-y-4">
                                    {/* Header Info */}
                                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Department / Section</p>
                                            <p className="font-semibold text-sm">{selectedDeptName} / {selectedSectionName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Recording Date</p>
                                            <p className="font-semibold text-sm">{selectedDate}</p>
                                        </div>
                                    </div>

                                    {/* Real-Form Preview */}
                                    <div className="border rounded-lg overflow-x-auto border-slate-200 bg-white">
                                        {renderRecordingTable(true)}
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3">
                                        <IconClipboardList className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                        <p className="text-[13px] text-amber-800 leading-tight">
                                            <strong>Safety Note:</strong> Submitting this record will send the final report (Excel format) to all configured supervisors and HODs. Please ensure all critical data is verified.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="border-t border-slate-100 pt-4 gap-2 sm:gap-0">
                                <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} disabled={isSubmitting}>
                                    Back to Edit
                                </Button>
                                <Button onClick={handleSubmitSession} disabled={isSubmitting || !hasEditPermission} className="bg-blue-600 hover:bg-blue-700 px-8">
                                    {isSubmitting ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><IconClipboardCheck className="w-5 h-5 mr-2" /> Save</>
                                    )}
                                </Button>
                                <Button onClick={handleSendEmailNotification} disabled={isSendingEmail || !hasEditPermission} className="bg-emerald-600 hover:bg-emerald-700 px-8 text-white">
                                    {isSendingEmail ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                                    ) : (
                                        <><IconMail className="w-5 h-5 mr-2" /> Submit & Send Email Notification</>
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Content Area Switching */}
            <div className="bg-white p-4 rounded-xl border-2 shadow-sm flex flex-wrap items-end gap-6 print:hidden">
                <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label className="text-xs uppercase font-bold text-slate-500 ml-1">1. Department</Label>
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment} disabled={isRestricted && assignableDepartments.length === 1}>
                        <SelectTrigger className={isRestricted && assignableDepartments.length === 1 ? "bg-slate-50 cursor-not-allowed h-11" : "h-11"}>
                            <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                            {assignableDepartments.map((dept) => (
                                <SelectItem key={String(dept._id || dept.id)} value={String(dept._id || dept.id)}>
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className={`space-y-2 flex-1 min-w-[200px] transition-all duration-300 ${!selectedDepartment ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
                    <Label className="text-xs uppercase font-bold text-slate-500 ml-1">2. Section</Label>
                    <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedDepartment || (isRestricted && assignableSections.length === 1)}>
                        <SelectTrigger className={isRestricted && assignableSections.length === 1 ? "bg-slate-50 cursor-not-allowed h-11" : "h-11"}>
                            <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                            {assignableSections.map((sec) => (
                                <SelectItem key={String(sec._id || sec.id)} value={String(sec._id || sec.id)}>
                                    {sec.name} {sec.category ? `(${sec.category})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2 flex-1 min-w-[200px]">
                    <Label className="text-xs uppercase font-bold text-slate-500 ml-1">3. Date</Label>
                    <div className="relative">
                        <Input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="h-11 pl-10"
                        />
                        <IconClipboardList className="absolute left-3 top-3 text-slate-400" size={20} />
                    </div>
                </div>
            </div>

            {!selectedDepartment || !selectedSection ? (
                /* Placeholder Screen */
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <IconFilter className="text-blue-500" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Ready to record?</h3>
                    <p className="text-slate-500 mt-2 text-center max-w-sm">
                        Please select a department and section from the filters above to view and create recording sessions.
                    </p>
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
                        <h2 className="text-lg font-semibold text-slate-700">Records for {selectedDeptName} - {selectedSectionName}</h2>
                        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700" disabled={!hasEditPermission}>
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
                                                <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" size="sm" disabled={!hasEditPermission}>Create First Form</Button>
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
                                                    className={`uppercase text-[16px] px-3 py-1 font-bold ${record.formType === 'crimping' ? 'bg-orange-100 text-orange-700 border-orange-200' :
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

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} className="sm:max-w-[425px]">
                        <DialogContent className="">
                            <DialogHeader>
                                <DialogTitle>Create New Recording Session</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                    <Label>Form Type</Label>
                                    <div className="grid gap-4">
                                        {(() => {
                                            const section = sections?.find(s => String(s._id || s.id) === String(selectedSection));
                                            const daily5mFormType = section?.daily5mFormType || "";
                                            const allowedTypes = daily5mFormType.split(",").map(t => t.trim()).filter(Boolean);
                                            const sName = (section?.name || "").toLowerCase();

                                            // Strict Logic:
                                            // 1. If Admin: Show everything
                                            // 2. If no section selected: Show everything
                                            // 3. If section has explicit daily5mFormType: Use those
                                            // 4. If section has NO daily5mFormType: Fallback to keyword matching in name
                                            const checkStandard = allowedTypes.includes('standard') || (allowedTypes.length === 0 && !sName.includes("crimping") && !sName.includes("cutting") && !sName.includes("src"));
                                            const checkCrimping = allowedTypes.includes('crimping') || (allowedTypes.length === 0 && (sName.includes("crimping") || sName.includes("cutting")));
                                            const checkSRC = allowedTypes.includes('src') || (allowedTypes.length === 0 && sName.includes("src"));

                                            const visibleCount = [checkStandard, checkCrimping, checkSRC].filter(Boolean).length;

                                            return (
                                                <div className={`grid gap-4 ${visibleCount === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                                                    {/* Assembly Card */}
                                                    {checkStandard && (
                                                        <div
                                                            className={`relative group p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${addDialogType === 'standard'
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
                                                    )}

                                                    {/* Crimping Card */}
                                                    {checkCrimping && (
                                                        <div
                                                            className={`relative group p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${addDialogType === 'crimping'
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
                                                    )}

                                                    {/* SRC Card */}
                                                    {checkSRC && (
                                                        <div
                                                            className={`relative group p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${addDialogType === 'src'
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
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="create-date">Session Date</Label>
                                    <Input
                                        id="create-date"
                                        type="date"
                                        value={addDialogDate}
                                        disabled
                                        className="bg-slate-50"
                                        min={todayStr}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleAddForm} disabled={isAutoCreating}>
                                    {isAutoCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconPlus className="mr-2 h-4 w-4" />}
                                    Create Session
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : (
                <Card className="print:shadow-none print:border-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 print:hidden">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Badge variant="outline" className="uppercase bg-blue-50 text-blue-700 border-blue-200">
                                {formType === 'standard' ? 'Assembly' : formType === 'src' ? 'SRC' : 'Cutting & Crimping'}
                            </Badge>
                            <span>Recording for {selectedDate}</span>
                        </CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsPrintDialogOpen(true)}>
                                <IconPrinter className="mr-2" /> Print Sheet
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                                if (location.state?.fromDashboard) {
                                    navigate('/cms/daily-5m-dashboard');
                                } else {
                                    navigate(location.pathname);
                                    setShowFormList(true);
                                }
                            }}>
                                <IconArrowLeft className="mr-2" /> Back to List
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-4 overflow-x-auto print:overflow-visible">
                        {/* Table Container for PDF Capture */}
                        <div ref={tableRef} data-pdf-content="true" className="w-full">
                            {renderRecordingTable(viewMode)}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Admin Remark Dialog — required when editing an approved session */}
            <Dialog open={isAdminRemarkDialogOpen} onOpenChange={(open) => {
                if (!open) { setIsAdminRemarkDialogOpen(false); setPendingSaveParams(null); setAdminRemarkText(''); }
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-600 text-sm font-bold">!</span>
                            Editing Approved Sheet
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-slate-600">
                            This sheet has already been <span className="font-semibold text-green-700">Approved</span>. Please provide a remark explaining what you changed and why. This will be logged for audit purposes.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="admin-remark-input" className="text-sm font-semibold text-slate-700">
                                Remark <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="admin-remark-input"
                                placeholder="e.g. Corrected operator name in row 3 — entry was misspelled during original recording."
                                value={adminRemarkText}
                                onChange={(e) => setAdminRemarkText(e.target.value)}
                                rows={4}
                                maxLength={500}
                                className="resize-none text-sm"
                            />
                            <p className={`text-xs text-right ${adminRemarkText.length > 450 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                                {adminRemarkText.length}/500
                            </p>
                        </div>
                        {adminRemarkText.trim().length > 0 && adminRemarkText.trim().length < 10 && (
                            <p className="text-xs text-red-500">Remark must be at least 10 characters.</p>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => { setIsAdminRemarkDialogOpen(false); setPendingSaveParams(null); setAdminRemarkText(''); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={adminRemarkText.trim().length < 10}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => {
                                if (!pendingSaveParams) return;
                                const { currentData, options } = pendingSaveParams;
                                setIsAdminRemarkDialogOpen(false);
                                setPendingSaveParams(null);
                                handleSaveRecord(currentData, { ...options, adminRemarks: adminRemarkText.trim() });
                                setAdminRemarkText('');
                            }}
                        >
                            Save with Remark
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Daily5MRecording;
