import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetLinesByDepartmentQuery } from "@/Redux/AllApi/LineApi";
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

const MultiSkillingPlan = ({ students = [], departmentId }) => {
    const employees = students;

    // 5 process slots -> select 5 lines.
    const [selectedLines, setSelectedLines] = useState(["", "", "", "", ""]);

    const { data: lineData, isLoading: linesLoading } = useGetLinesByDepartmentQuery(departmentId, {
        skip: !departmentId,
    });
    const lines = lineData?.data || [];

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

            if (!lineId) {
                return [{
                    key: `slot-${slotIdx}-empty`,
                    slotIdx,
                    lineId: "",
                    lineName: "",
                    machineId: "",
                    machineName: "",
                }];
            }

            if (machines.length === 0) {
                return [{
                    key: `slot-${slotIdx}-no-machine`,
                    slotIdx,
                    lineId,
                    lineName,
                    machineId: "",
                    machineName: "-",
                }];
            }

            return machines.map((machine) => ({
                key: `slot-${slotIdx}-machine-${String(machine._id || machine.id)}`,
                slotIdx,
                lineId,
                lineName,
                machineId: String(machine._id || machine.id),
                machineName: machine.name || "-",
            }));
        });
    }, [selectedLines, lineNameById, machinesBySlot]);

    const machineColumns = useMemo(() => slotColumns.flat(), [slotColumns]);
    const totalProcessCols = machineColumns.length || 1;
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
                if (!next[emp._id]) {
                    next[emp._id] = { plan: {}, actual: {} };
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
                const response = await axiosInstance.get(`/api/multi-skilling-plan/department/${departmentId}`);
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
                        <Button variant="outline" onClick={fetchHistory}>
                            <IconHistory className="h-4 w-4 mr-2" />
                            History
                        </Button>
                        <Button variant="outline" onClick={() => setIsEditingLayout(true)}>
                            <IconSettings className="h-4 w-4 mr-2" />
                            Edit Layout
                        </Button>
                        <Button variant="outline" onClick={handlePrint}>
                            <IconPrinter className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || isLoadingPlan}>
                            <IconDeviceFloppy className="h-4 w-4 mr-2" />
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse border border-black text-sm">
                    <thead>
                        {tableConfig && tableConfig.headers ? (
                            tableConfig.headers.map((row, rowIndex) => (
                                <tr key={`header-row-${rowIndex}`} className="bg-white">
                                    {row.map((header, colIndex) => {
                                        // Special case for Process colSpan if not defined
                                        const colSpan = header.text === "Process" ? totalProcessCols : (header.colSpan || 1);
                                        return (
                                            <th
                                                key={`header-${rowIndex}-${colIndex}`}
                                                rowSpan={header.rowSpan || 1}
                                                colSpan={colSpan}
                                                className={`border border-black p-2 align-middle text-center ${header.className || ""}`}
                                            >
                                                {header.text}
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : (
                            <>
                                <tr className="bg-white">
                                    <th rowSpan="3" className="border border-black p-2 w-12 align-middle">Sr. No</th>
                                    <th rowSpan="3" className="border border-black p-2 w-48 align-middle">Associates Name</th>
                                    <th rowSpan="3" className="border border-black p-2 w-32 align-middle">Card No</th>
                                    <th rowSpan="3" className="border border-black p-2 w-24 align-middle">Plan/Actual</th>
                                    <th colSpan={totalProcessCols} className="border border-black p-2 text-center font-bold text-lg">Process</th>
                                </tr>
                            </>
                        )}

                        {/* Line dropdown row (5 slots, each can span based on machine count in that slot). */}
                        <tr>
                            {slotColumns.map((cols, slotIdx) => (
                                <th key={`slot-${slotIdx}`} colSpan={cols.length} className="border border-black p-0 h-8">
                                    <Select
                                        value={selectedLines[slotIdx]}
                                        onValueChange={(value) => handleLineSelectChange(slotIdx, value)}
                                    >
                                        <SelectTrigger className="w-full h-full rounded-none border-0 px-2 text-center justify-center">
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

                        {/* Machine name row: each machine has its own single column. */}
                        <tr>
                            {machineColumns.map((col) => (
                                <th key={col.key} className="border border-black p-1 text-center text-xs font-normal">
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
                                            {emp.username || emp.userName || "-"}
                                        </td>
                                        <td className="border border-black p-1 text-center bg-gray-50 text-xs font-semibold">Plan</td>
                                        {machineColumns.map((col) => (
                                            <td key={`plan-${emp._id}-${col.key}`} className="border border-black p-0">
                                                <input
                                                    type="date"
                                                    className="w-full h-full text-center outline-none bg-transparent p-1 text-xs"
                                                    value={data.plan?.[col.key] || ""}
                                                    onChange={(e) => handleDataChange(emp._id, "plan", col.key, e.target.value)}
                                                />
                                            </td>
                                        ))}
                                    </tr>

                                    <tr className="hover:bg-gray-50">
                                        <td className="border border-black p-1 text-center bg-gray-50 text-xs font-semibold">Actual</td>
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
                                                        className="w-full h-full text-center outline-none bg-transparent p-1 text-xs"
                                                        value={cellValue}
                                                        onChange={(e) => handleDataChange(emp._id, "actual", col.key, e.target.value)}
                                                        disabled={!!assignedDate}
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
