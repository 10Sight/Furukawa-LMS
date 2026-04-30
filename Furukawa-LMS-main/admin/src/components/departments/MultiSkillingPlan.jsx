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

const MultiSkillingPlan = ({ students = [], departmentId, sectionId }) => {
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    const { canManage, canEditLayout, canViewHistory } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('multi_skilling:manage') || isAdmin,
            canEditLayout: permissions.includes('multi_skilling:edit_layout') || isAdmin,
            canViewHistory: permissions.includes('multi_skilling:view_history') || isAdmin
        };
    }, [authUser, isAdmin]);

    const employees = students;

    // 5 process slots -> select 5 lines.
    const [selectedLines, setSelectedLines] = useState(["", "", "", "", ""]);

    const { data: deptLines, isLoading: deptLinesLoading } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId || !!sectionId,
    });
    const { data: sectLines, isLoading: sectLinesLoading } = useGetLinesBySectionQuery(sectionId, {
        skip: !sectionId,
    });
    
    const linesLoading = sectionId ? sectLinesLoading : deptLinesLoading;
    const lines = (sectionId ? sectLines?.data : deptLines?.data) || [];

    const { data: machinesData0 } = useGetMachinesByLineQuery(selectedLines[0], { skip: !selectedLines[0] });
    const { data: machinesData1 } = useGetMachinesByLineQuery(selectedLines[1], { skip: !selectedLines[1] });
    const { data: machinesData2 } = useGetMachinesByLineQuery(selectedLines[2], { skip: !selectedLines[2] });
    const { data: machinesData3 } = useGetMachinesByLineQuery(selectedLines[3], { skip: !selectedLines[3] });
    const { data: machinesData4 } = useGetMachinesByLineQuery(selectedLines[4], { skip: !selectedLines[4] });

    const machinesBySlot = [
        machinesData0?.data || [],
        machinesData1?.data || [],
        machinesData2?.data || [],
        machinesData3?.data || [],
        machinesData4?.data || [],
    ];

    const { data: subSectionsData0 } = useGetSubSectionsByLineQuery(selectedLines[0], { skip: !selectedLines[0] });
    const { data: subSectionsData1 } = useGetSubSectionsByLineQuery(selectedLines[1], { skip: !selectedLines[1] });
    const { data: subSectionsData2 } = useGetSubSectionsByLineQuery(selectedLines[2], { skip: !selectedLines[2] });
    const { data: subSectionsData3 } = useGetSubSectionsByLineQuery(selectedLines[3], { skip: !selectedLines[3] });
    const { data: subSectionsData4 } = useGetSubSectionsByLineQuery(selectedLines[4], { skip: !selectedLines[4] });

    const subSectionsBySlot = [
        subSectionsData0?.data || [],
        subSectionsData1?.data || [],
        subSectionsData2?.data || [],
        subSectionsData3?.data || [],
        subSectionsData4?.data || [],
    ];

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
                    machineId: "",
                    machineName: "",
                }];
            }

            // Group machines by sub-section
            const columns = [];
            
            // If no sub-sections found but there are machines, show machines directly
            if (subSections.length === 0) {
                if (machines.length === 0) {
                    columns.push({
                        key: `slot-${slotIdx}-no-sub-no-machine`,
                        slotIdx,
                        lineId,
                        lineName,
                        subSectionId: "",
                        subSectionName: "-",
                        machineId: "",
                        machineName: "-",
                    });
                } else {
                    machines.forEach(m => {
                        columns.push({
                            key: `slot-${slotIdx}-no-sub-machine-${m.id}`,
                            slotIdx,
                            lineId,
                            lineName,
                            subSectionId: "",
                            subSectionName: "-",
                            machineId: String(m.id || m._id),
                            machineName: m.name,
                        });
                    });
                }
                return columns;
            }

            subSections.forEach(ss => {
                const ssMachines = machines.filter(m => String(m.subSectionId) === String(ss.id || ss._id));
                if (ssMachines.length === 0) {
                    columns.push({
                        key: `slot-${slotIdx}-sub-${ss.id}-no-machine`,
                        slotIdx,
                        lineId,
                        lineName,
                        subSectionId: String(ss.id || ss._id),
                        subSectionName: ss.name,
                        machineId: "",
                        machineName: "-",
                    });
                } else {
                    ssMachines.forEach(m => {
                        columns.push({
                            key: `slot-${slotIdx}-sub-${ss.id}-machine-${m.id}`,
                            slotIdx,
                            lineId,
                            lineName,
                            subSectionId: String(ss.id || ss._id),
                            subSectionName: ss.name,
                            machineId: String(m.id || m._id),
                            machineName: m.name,
                        });
                    });
                }
            });

            return columns;
        });
    }, [selectedLines, lineNameById, machinesBySlot, subSectionsBySlot]);

    const machineColumns = useMemo(() => slotColumns.flat(), [slotColumns]);
    const totalProcessCols = machineColumns.length || 1;

    // Calculate spans for headers
    const headerSpans = useMemo(() => {
        return selectedLines.map((lineId, slotIdx) => {
            const cols = slotColumns[slotIdx] || [];
            const subSectionGroups = [];
            
            let currentSS = null;
            let currentCount = 0;
            
            cols.forEach((col, idx) => {
                if (col.subSectionId !== currentSS || idx === 0) {
                    if (currentSS !== null || idx === 0) {
                        if (idx > 0) subSectionGroups.push({ id: currentSS, name: cols[idx-1].subSectionName, count: currentCount });
                    }
                    currentSS = col.subSectionId;
                    currentCount = 1;
                } else {
                    currentCount++;
                }
                if (idx === cols.length - 1) {
                    subSectionGroups.push({ id: currentSS, name: col.subSectionName, count: currentCount });
                }
            });

            return {
                lineId,
                totalCount: cols.length,
                subSections: subSectionGroups
            };
        });
    }, [slotColumns, selectedLines]);
    const machineIdsForLookup = useMemo(
        () => [...new Set(machineColumns.map((col) => col.machineId).filter(Boolean))],
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
            const response = await axiosInstance.get(`/api/multi-skilling-plan/config/${departmentId}`);
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

            await axiosInstance.post(`/api/multi-skilling-plan/config/save`, {
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
            const response = await axiosInstance.get(`/api/multi-skilling-plan/history/${departmentId}`);
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
                setIsLoadingPlan(true);
                const response = await axiosInstance.get(`/api/multi-skilling-plan/department/${departmentId}`, {
                    params: { sectionId }
                });
                const data = response?.data?.data;
                if (!cancelled && data) {
                    if (Array.isArray(data.selectedLines)) {
                        const normalized = [...data.selectedLines];
                        while (normalized.length < 5) normalized.push("");
                        setSelectedLines(normalized.slice(0, 5));
                    }
                    if (data.tableData && typeof data.tableData === "object") {
                        setTableData((prev) => ({ ...prev, ...data.tableData }));
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    toast.error("Failed to load multi skilling plan");
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
            await axiosInstance.post(`/api/multi-skilling-plan/department/${departmentId}`, {
                sectionId,
                selectedLines,
                tableData,
            });
            toast.success("Multi skilling plan saved successfully");
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save multi skilling plan");
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
                        Training plan for multi skilling
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
                <table className="w-full min-w-[1200px] border-collapse border border-black text-sm">
                    <thead>
                        {/* Line dropdown row */}
                        <tr className="bg-white">
                            <th rowSpan="4" className="border border-black p-2 w-12 align-middle">Sr. No</th>
                            <th rowSpan="4" className="border border-black p-2 w-48 align-middle">Associates Name</th>
                            <th rowSpan="4" className="border border-black p-2 w-32 align-middle">Card No</th>
                            <th rowSpan="4" className="border border-black p-2 w-24 align-middle">Plan/Actual</th>
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
                            {headerSpans.map((span, slotIdx) => (
                                <React.Fragment key={`ss-slot-${slotIdx}`}>
                                    {span.subSections.map((ss, ssIdx) => (
                                        <th 
                                            key={`ss-${slotIdx}-${ssIdx}`} 
                                            colSpan={ss.count} 
                                            className="border border-black p-1 text-center text-[10px] font-bold uppercase text-slate-600"
                                        >
                                            {ss.name || "-"}
                                        </th>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tr>

                        {/* Station/Machine name row */}
                        <tr className="bg-white">
                            {machineColumns.map((col) => (
                                <th key={col.key} className="border border-black p-1 text-center text-[9px] font-medium text-slate-500">
                                    {col.machineName}
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
                                            const assignedDate = col.machineId
                                                ? assignmentDateMap[`${studentId}_${col.machineId}`]
                                                : "";
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

export default MultiSkillingPlan;
