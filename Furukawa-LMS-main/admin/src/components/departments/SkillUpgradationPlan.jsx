import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetLinesByDepartmentQuery, useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesByLineQuery } from "@/Redux/AllApi/MachineApi";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { IconDeviceFloppy, IconPrinter } from "@tabler/icons-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { IconSettings, IconHistory } from "@tabler/icons-react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

const SkillUpgradationPlan = ({ students = [], departmentId, sectionId }) => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    const { canManage, canEditLayout, canViewHistory } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('skill_upgradation:manage') || isAdmin,
            canEditLayout: permissions.includes('skill_upgradation:edit_layout') || isAdmin,
            canViewHistory: permissions.includes('skill_upgradation:view_history') || isAdmin
        };
    }, [authUser, isAdmin]);

    const employees = students;

    // Dynamic slots — sized to match lines available in the selected section/department.
    const [selectedLines, setSelectedLines] = useState([]);
    // Saved lines from backend before lines data loads, used to restore selections.
    const [savedLines, setSavedLines] = useState(null);

    const { data: deptLines, isLoading: deptLinesLoading } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId || !!sectionId,
    });
    const { data: sectLines, isLoading: sectLinesLoading } = useGetLinesBySectionQuery(sectionId, {
        skip: !sectionId,
    });

    const linesLoading = sectionId ? sectLinesLoading : deptLinesLoading;
    const lines = (sectionId ? sectLines?.data : deptLines?.data) || [];

    // Resize selectedLines whenever available lines change, restoring saved selections.
    useEffect(() => {
        if (linesLoading || lines.length === 0) return;
        setSelectedLines(prev => lines.map((_, i) => {
            const base = savedLines ?? prev;
            return base[i] || "";
        }));
    }, [lines.length, linesLoading, savedLines]);

    // Static hook calls up to a max of 15 slots (React rules of hooks forbid dynamic calls).
    // Each is skipped when its slot index exceeds the actual line count or has no selection.
    const { data: machinesData0  } = useGetMachinesByLineQuery(selectedLines[0],  { skip: !selectedLines[0]  });
    const { data: machinesData1  } = useGetMachinesByLineQuery(selectedLines[1],  { skip: !selectedLines[1]  });
    const { data: machinesData2  } = useGetMachinesByLineQuery(selectedLines[2],  { skip: !selectedLines[2]  });
    const { data: machinesData3  } = useGetMachinesByLineQuery(selectedLines[3],  { skip: !selectedLines[3]  });
    const { data: machinesData4  } = useGetMachinesByLineQuery(selectedLines[4],  { skip: !selectedLines[4]  });
    const { data: machinesData5  } = useGetMachinesByLineQuery(selectedLines[5],  { skip: !selectedLines[5]  });
    const { data: machinesData6  } = useGetMachinesByLineQuery(selectedLines[6],  { skip: !selectedLines[6]  });
    const { data: machinesData7  } = useGetMachinesByLineQuery(selectedLines[7],  { skip: !selectedLines[7]  });
    const { data: machinesData8  } = useGetMachinesByLineQuery(selectedLines[8],  { skip: !selectedLines[8]  });
    const { data: machinesData9  } = useGetMachinesByLineQuery(selectedLines[9],  { skip: !selectedLines[9]  });
    const { data: machinesData10 } = useGetMachinesByLineQuery(selectedLines[10], { skip: !selectedLines[10] });
    const { data: machinesData11 } = useGetMachinesByLineQuery(selectedLines[11], { skip: !selectedLines[11] });
    const { data: machinesData12 } = useGetMachinesByLineQuery(selectedLines[12], { skip: !selectedLines[12] });
    const { data: machinesData13 } = useGetMachinesByLineQuery(selectedLines[13], { skip: !selectedLines[13] });
    const { data: machinesData14 } = useGetMachinesByLineQuery(selectedLines[14], { skip: !selectedLines[14] });

    const machinesBySlot = [
        machinesData0?.data  || [], machinesData1?.data  || [], machinesData2?.data  || [],
        machinesData3?.data  || [], machinesData4?.data  || [], machinesData5?.data  || [],
        machinesData6?.data  || [], machinesData7?.data  || [], machinesData8?.data  || [],
        machinesData9?.data  || [], machinesData10?.data || [], machinesData11?.data || [],
        machinesData12?.data || [], machinesData13?.data || [], machinesData14?.data || [],
    ].slice(0, lines.length);

    const { data: subSectionsData0  } = useGetSubSectionsByLineQuery(selectedLines[0],  { skip: !selectedLines[0]  });
    const { data: subSectionsData1  } = useGetSubSectionsByLineQuery(selectedLines[1],  { skip: !selectedLines[1]  });
    const { data: subSectionsData2  } = useGetSubSectionsByLineQuery(selectedLines[2],  { skip: !selectedLines[2]  });
    const { data: subSectionsData3  } = useGetSubSectionsByLineQuery(selectedLines[3],  { skip: !selectedLines[3]  });
    const { data: subSectionsData4  } = useGetSubSectionsByLineQuery(selectedLines[4],  { skip: !selectedLines[4]  });
    const { data: subSectionsData5  } = useGetSubSectionsByLineQuery(selectedLines[5],  { skip: !selectedLines[5]  });
    const { data: subSectionsData6  } = useGetSubSectionsByLineQuery(selectedLines[6],  { skip: !selectedLines[6]  });
    const { data: subSectionsData7  } = useGetSubSectionsByLineQuery(selectedLines[7],  { skip: !selectedLines[7]  });
    const { data: subSectionsData8  } = useGetSubSectionsByLineQuery(selectedLines[8],  { skip: !selectedLines[8]  });
    const { data: subSectionsData9  } = useGetSubSectionsByLineQuery(selectedLines[9],  { skip: !selectedLines[9]  });
    const { data: subSectionsData10 } = useGetSubSectionsByLineQuery(selectedLines[10], { skip: !selectedLines[10] });
    const { data: subSectionsData11 } = useGetSubSectionsByLineQuery(selectedLines[11], { skip: !selectedLines[11] });
    const { data: subSectionsData12 } = useGetSubSectionsByLineQuery(selectedLines[12], { skip: !selectedLines[12] });
    const { data: subSectionsData13 } = useGetSubSectionsByLineQuery(selectedLines[13], { skip: !selectedLines[13] });
    const { data: subSectionsData14 } = useGetSubSectionsByLineQuery(selectedLines[14], { skip: !selectedLines[14] });

    const subSectionsBySlot = [
        subSectionsData0?.data  || [], subSectionsData1?.data  || [], subSectionsData2?.data  || [],
        subSectionsData3?.data  || [], subSectionsData4?.data  || [], subSectionsData5?.data  || [],
        subSectionsData6?.data  || [], subSectionsData7?.data  || [], subSectionsData8?.data  || [],
        subSectionsData9?.data  || [], subSectionsData10?.data || [], subSectionsData11?.data || [],
        subSectionsData12?.data || [], subSectionsData13?.data || [], subSectionsData14?.data || [],
    ].slice(0, lines.length);

    const lineNameById = useMemo(() => {
        const map = {};
        lines.forEach((line) => {
            map[String(line._id || line.id)] = line.name;
        });
        return map;
    }, [lines]);

    const slotColumns = useMemo(() => {
        return selectedLines.map((lineId, slotIdx) => {
            const lineName = lineNameById[lineId] || `Line ${slotIdx + 1}`;
            const machines = machinesBySlot[slotIdx] || [];
            const subSections = subSectionsBySlot[slotIdx] || [];

            if (!lineId) {
                return [{
                    key: `slot-${slotIdx}-empty`,
                    slotIdx,
                    lineId: "",
                    lineName: "",
                    subSectionId: "",
                    subSectionName: "",
                    machineIds: [],
                }];
            }

            // Group columns by sub-section instead of machines
            if (subSections.length === 0) {
                return [{
                    key: `slot-${slotIdx}-no-sub`,
                    slotIdx,
                    lineId,
                    lineName,
                    subSectionId: "",
                    subSectionName: "-",
                    machineIds: [],
                }];
            }

            return subSections.map(ss => {
                const ssMachines = machines.filter(m => String(m.subSectionId) === String(ss.id || ss._id));
                return {
                    key: `slot-${slotIdx}-sub-${ss.id || ss._id}`,
                    slotIdx,
                    lineId,
                    lineName,
                    subSectionId: String(ss.id || ss._id),
                    subSectionName: ss.name,
                    machineIds: ssMachines.map(m => String(m.id || m._id)),
                };
            });
        });
    }, [selectedLines, lineNameById, machinesBySlot, subSectionsBySlot]);

    const machineColumns = useMemo(() => slotColumns.flat(), [slotColumns]);
    const totalProcessCols = machineColumns.length || 1;

    // Calculate spans for headers
    const headerSpans = useMemo(() => {
        return selectedLines.map((lineId, slotIdx) => {
            const cols = slotColumns[slotIdx] || [];
            return {
                lineId,
                totalCount: cols.length,
                subSections: cols.map(col => ({
                    id: col.subSectionId,
                    name: col.subSectionName,
                    count: 1
                }))
            };
        });
    }, [slotColumns, selectedLines]);

    const machineIdsForLookup = useMemo(
        () => [...new Set(machineColumns.flatMap((col) => col.machineIds || []).filter(Boolean))],
        [machineColumns]
    );

    const machineIdsKey = machineIdsForLookup.join(",");

    // { [userId]: { plan: { [columnKey]: "yyyy-mm-dd" }, actual: { ... } } }
    const [tableData, setTableData] = useState({});
    // { `${userId}_${machineId}`: "yyyy-mm-dd" }
    const [assignmentDateMap, setAssignmentDateMap] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingPlan, setIsLoadingPlan] = useState(false);

    // Layout Config State
    const [tableConfig, setTableConfig] = useState(null);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [configHistory, setConfigHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);

    useEffect(() => {
        if (departmentId) {
            fetchConfig();
        }
    }, [departmentId]);

    const fetchConfig = async () => {
        try {
            setLoadingConfig(true);
            const response = await axiosInstance.get(`/api/skill-upgradation-plan/config/${departmentId}`);
            if (response.data.success && response.data.data.config) {
                setTableConfig(response.data.data.config);
                setJsonConfigStr(JSON.stringify(response.data.data.config, null, 2));
            }
        } catch (error) {
            console.error("Error fetching config:", error);
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

            await axiosInstance.post(`/api/skill-upgradation-plan/config/save`, {
                departmentId,
                config: parsedConfig,
                remark: layoutRemark
            });

            setTableConfig(parsedConfig);
            setIsEditingLayout(false);
            setLayoutRemark("");
            toast.success("Configuration saved successfully");
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Failed to save configuration");
        }
    };

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await axiosInstance.get(`/api/skill-upgradation-plan/history/${departmentId}`);
            if (response.data.success) {
                setConfigHistory(response.data.data);
                setIsHistoryOpen(true);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
            toast.error("Failed to load history");
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        setTableData((prev) => {
            const next = { ...prev };
            employees.forEach((emp) => {
                const id = emp._id || emp.id;
                if (id && !next[id]) {
                    next[id] = { plan: {}, actual: {} };
                }
            });
            return next;
        });
    }, [employees]);

    useEffect(() => {
        if (!departmentId) return;
        let cancelled = false;

        const loadSavedPlan = async () => {
            try {
                setSavedLines(null);
                setIsLoadingPlan(true);
                const response = await axiosInstance.get(`/api/skill-upgradation-plan/department/${departmentId}`, {
                    params: { sectionId }
                });
                const data = response?.data?.data;
                if (!cancelled && data) {
                    if (Array.isArray(data.selectedLines)) {
                        // Store raw saved lines; the lines-length effect will resize and apply them.
                        setSavedLines(data.selectedLines);
                    }
                    if (data.tableData && typeof data.tableData === "object") {
                        setTableData((prev) => ({ ...prev, ...data.tableData }));
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error("Failed to load skill upgradation plan");
                }
            } finally {
                if (!cancelled) setIsLoadingPlan(false);
            }
        };

        loadSavedPlan();
        return () => {
            cancelled = true;
        };
    }, [departmentId]);

    useEffect(() => {
        if (machineIdsForLookup.length === 0) {
            setAssignmentDateMap((prev) => (Object.keys(prev).length ? {} : prev));
            return;
        }

        let cancelled = false;

        const loadAssignmentDates = async () => {
            try {
                const responses = await Promise.all(
                    machineIdsForLookup.map((machineId) => axiosInstance.get(`/api/machines/${machineId}/employees`))
                );

                const nextMap = {};
                responses.forEach((res, idx) => {
                    const machineId = machineIdsForLookup[idx];
                    const assignedEmployees = res?.data?.data || [];
                    assignedEmployees.forEach((employee) => {
                        const userId = String(employee?.id || employee?._id || "");
                        const assignedAt = employee?.assigned_at;
                        if (userId && assignedAt) {
                            const formatted = new Date(assignedAt).toISOString().split("T")[0];
                            nextMap[`${userId}_${machineId}`] = formatted;
                        }
                    });
                });

                if (!cancelled) {
                    setAssignmentDateMap((prev) => {
                        const prevKeys = Object.keys(prev);
                        const nextKeys = Object.keys(nextMap);
                        if (prevKeys.length === nextKeys.length) {
                            let changed = false;
                            for (const key of nextKeys) {
                                if (prev[key] !== nextMap[key]) {
                                    changed = true;
                                    break;
                                }
                            }
                            if (!changed) return prev;
                        }
                        return nextMap;
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setAssignmentDateMap((prev) => (Object.keys(prev).length ? {} : prev));
                }
            }
        };

        loadAssignmentDates();
        return () => {
            cancelled = true;
        };
    }, [machineIdsKey]);

    const handleLineSelectChange = (slotIdx, value) => {
        const next = [...selectedLines];
        next[slotIdx] = value;
        setSelectedLines(next);
    };

    const handleDataChange = (userId, type, columnKey, value) => {
        setTableData((prev) => {
            const userRecord = prev[userId] || { plan: {}, actual: {} };
            return {
                ...prev,
                [userId]: {
                    ...userRecord,
                    [type]: {
                        ...(userRecord[type] || {}),
                        [columnKey]: value,
                    },
                },
            };
        });
    };

    const handleSave = async () => {
        if (!departmentId) return;
        try {
            setIsSaving(true);
            await axiosInstance.post(`/api/skill-upgradation-plan/department/${departmentId}`, {
                sectionId,
                selectedLines,
                tableData,
            });
            toast.success("Skill upgradation plan saved successfully");
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save skill upgradation plan");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Card className="max-w-full overflow-hidden bg-white">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 print:hidden">
                    <div />
                    <h2 className="text-xl font-bold uppercase tracking-wide border-b-2 border-transparent inline-block pb-1">
                        Plan for Skill Upgradation
                    </h2>
                    <div className="flex items-center gap-2">
                        {canViewHistory && (
                            <Button variant="outline" onClick={fetchHistory}>
                                <IconHistory className="h-4 w-4 mr-2" />
                                History
                            </Button>
                        )}
                        {canEditLayout && (
                            <Button variant="outline" onClick={() => setIsEditingLayout(true)}>
                                <IconSettings className="h-4 w-4 mr-2" />
                                Edit Layout
                            </Button>
                        )}
                        <Button variant="outline" onClick={handlePrint}>
                            <IconPrinter className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        {canManage && (
                            <Button onClick={handleSave} disabled={isSaving || isLoadingPlan}>
                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                {/* Sheet Metadata Header Block - Visible in screen & print */}
                <div className="flex justify-between items-center w-full mb-4 pb-2 border-b border-slate-200 print:border-black">
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-wide text-slate-800 print:text-black hidden print:block">
                            Plan for Skill Upgradation
                        </h2>
                        <span className="print:hidden text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Interactive Skill Upgradation Plan
                        </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 border border-slate-950 bg-slate-50 px-3 py-1 rounded shadow-sm print:shadow-none print:bg-white print:rounded-none whitespace-nowrap">
                        Document No: FRM-WH-QA-236
                    </div>
                </div>
                <table className="w-full min-w-[1200px] border-collapse border border-black text-sm">
                    <thead>
                        {/* Line dropdown row */}
                        <tr className="bg-white">
                            <th rowSpan="3" className="border border-black p-2 w-12 align-middle">Sr. No</th>
                            <th rowSpan="3" className="border border-black p-2 w-48 align-middle">Associates Name</th>
                            <th rowSpan="3" className="border border-black p-2 w-32 align-middle">Card No</th>
                            <th rowSpan="3" className="border border-black p-2 w-24 align-middle">Plan/Actual</th>
                            <th colSpan={totalProcessCols} className="border border-black p-1 text-center font-bold bg-slate-100">Process (Line)</th>
                        </tr>
                        <tr>
                            {headerSpans.map((span, slotIdx) => (
                                <th key={`slot-${slotIdx}`} colSpan={span.totalCount} className="border border-black p-0 h-10">
                                    <Select
                                        value={selectedLines[slotIdx]}
                                        onValueChange={(value) => handleLineSelectChange(slotIdx, value)}
                                        disabled={!canManage}
                                    >
                                        <SelectTrigger className="w-full h-full rounded-none border-0 px-2 text-center justify-center font-bold bg-white disabled:opacity-100 disabled:cursor-default">
                                            <SelectValue placeholder={`Select Line ${slotIdx + 1}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {linesLoading ? (
                                                <SelectItem value={`loading-${slotIdx}`} disabled>Loading...</SelectItem>
                                            ) : lines.length === 0 ? (
                                                <SelectItem value={`none-${slotIdx}`} disabled>No lines found</SelectItem>
                                            ) : (
                                                lines.map((line) => (
                                                    <SelectItem key={line._id || line.id} value={String(line._id || line.id)}>
                                                        {line.name}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </th>
                            ))}
                        </tr>

                        {/* Sub-Section Name row */}
                        <tr className="bg-slate-50">
                            {machineColumns.map((col) => (
                                <th
                                    key={col.key}
                                    className="border border-black p-1 text-center text-[10px] font-bold uppercase text-slate-600"
                                >
                                    {col.subSectionName || "-"}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {employees.map((emp, index) => {
                            const data = tableData[emp._id] || { plan: {}, actual: {} };
                            return (
                                <React.Fragment key={emp._id}>
                                    <tr className="hover:bg-gray-50">
                                        <td rowSpan="2" className="border border-black p-2 text-center">{index + 1}</td>
                                        <td rowSpan="2" className="border border-black p-2 font-bold text-blue-700 uppercase">
                                            {emp.fullName}
                                        </td>
                                        <td rowSpan="2" className="border border-black p-2 text-center font-bold text-blue-700">
                                            {emp.username || emp.userName || emp.empId || "-"}
                                        </td>
                                        <td className="border border-black p-1 text-center bg-gray-50 text-[10px] font-bold">Plan</td>
                                        {machineColumns.map((col) => (
                                            <td key={`plan-${emp._id}-${col.key}`} className="border border-black p-0">
                                                <input
                                                    type="date"
                                                    className="w-full h-full text-center outline-none bg-transparent p-1 text-[10px] disabled:opacity-80"
                                                    value={data.plan?.[col.key] || ""}
                                                    onChange={(e) => handleDataChange(emp._id, "plan", col.key, e.target.value)}
                                                    disabled={!canManage}
                                                />
                                            </td>
                                        ))}
                                    </tr>

                                    <tr className="hover:bg-gray-50">
                                        <td className="border border-black p-1 text-center bg-gray-50 text-[10px] font-bold">Actual</td>
                                        {machineColumns.map((col) => {
                                            const studentId = String(emp._id || emp.id || "");
                                            const assignedDates = (col.machineIds || [])
                                                .map(mId => assignmentDateMap[`${studentId}_${mId}`])
                                                .filter(Boolean);
                                            const assignedDate = assignedDates.length > 0 ? assignedDates.sort()[0] : "";
                                            const cellValue = assignedDate || data.actual?.[col.key] || "";

                                            return (
                                                <td key={`actual-${emp._id}-${col.key}`} className="border border-black p-0">
                                                    <input
                                                        type="date"
                                                        className="w-full h-full text-center outline-none bg-transparent p-1 text-[10px] disabled:opacity-80"
                                                        value={cellValue}
                                                        onChange={(e) => handleDataChange(emp._id, "actual", col.key, e.target.value)}
                                                        disabled={!!assignedDate || !canManage}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}

                        {employees.length === 0 && (
                            <tr>
                                <td colSpan={4 + totalProcessCols} className="border border-black p-8 text-center text-muted-foreground">
                                    No employees found in this department.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </CardContent>

            {/* Edit Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Table Configuration (JSON)</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-1 space-y-4">
                        <Textarea
                            className="font-mono text-xs h-[400px]"
                            value={jsonConfigStr}
                            onChange={(e) => setJsonConfigStr(e.target.value)}
                            placeholder='e.g. { "headers": [[{"text": "Sr. No", "rowSpan": 3}]] }'
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
                        <Button variant="ghost" onClick={() => setIsEditingLayout(false)}>Cancel</Button>
                        <Button onClick={handleSaveConfig} disabled={!layoutRemark.trim()}>
                            Save Configuration
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Layout Change History</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {loadingHistory ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8" /></div>
                        ) : configHistory.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No history found.</div>
                        ) : (
                            configHistory.map((entry, idx) => (
                                <div key={idx} className="border p-3 rounded-lg space-y-2 bg-slate-50">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold">{entry.updatedBy}</span>
                                        <span className="text-gray-500">{format(new Date(entry.createdAt), "PP p")}</span>
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
        </Card>
    );
};

export default SkillUpgradationPlan;
