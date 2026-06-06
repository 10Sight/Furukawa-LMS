import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetLinesByDepartmentQuery, useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesByLineQuery } from "@/Redux/AllApi/MachineApi";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { IconDeviceFloppy, IconPrinter, IconTrash } from "@tabler/icons-react";
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
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN' || authUser?.role === 'INSTRUCTOR' || authUser?.isTrainer;

    const { canManage, canEditLayout, canViewHistory } = useMemo(() => {
        const permissions = authUser?.customRole?.permissions || [];
        return {
            canManage: permissions.includes('multi_skilling:manage') || isAdmin,
            canEditLayout: permissions.includes('multi_skilling:edit_layout') || isAdmin,
            canViewHistory: permissions.includes('multi_skilling:view_history') || isAdmin
        };
    }, [authUser, isAdmin]);

    const [searchText, setSearchText] = useState("");
    const [activeEmployees, setActiveEmployees] = useState([]);
    const [hasInitializedActiveEmployees, setHasInitializedActiveEmployees] = useState(false);
    const [associateSearch, setAssociateSearch] = useState("");
    const [showAssociateSuggestions, setShowAssociateSuggestions] = useState(false);

    // Reset initialization state when department/section changes
    useEffect(() => {
        setHasInitializedActiveEmployees(false);
        setActiveEmployees([]);
    }, [departmentId, sectionId]);

    const filteredEmployees = useMemo(() => {
        if (!searchText.trim()) return activeEmployees;
        const lower = searchText.toLowerCase();
        return activeEmployees.filter(emp =>
            (emp.fullName || "").toLowerCase().includes(lower) ||
            (emp.cardNo || "").toLowerCase().includes(lower)
        );
    }, [activeEmployees, searchText]);

    const filteredSearchStudents = useMemo(() => {
        if (!associateSearch.trim()) return [];
        const lower = associateSearch.toLowerCase();
        return students.filter(s => {
            const isAlreadyAdded = activeEmployees.some(ae => String(ae._id || ae.id) === String(s._id || s.id));
            if (isAlreadyAdded) return false;
            return (
                (s.fullName || "").toLowerCase().includes(lower) ||
                (s.cardNo || "").toLowerCase().includes(lower)
            );
        }).slice(0, 10);
    }, [students, activeEmployees, associateSearch]);

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

    // Initialize active employees when both students and plan details are ready
    useEffect(() => {
        if (!hasInitializedActiveEmployees && students.length > 0 && !isLoadingPlan) {
            const savedUserIds = Object.keys(tableData || {});
            const savedStudents = students.filter(s => savedUserIds.includes(String(s._id || s.id)));
            const missingIds = savedUserIds.filter(id => !students.some(s => String(s._id || s.id) === String(id)));
            
            if (missingIds.length > 0) {
                const fetchMissing = async () => {
                    const fetchedUsers = [];
                    for (const id of missingIds) {
                        try {
                            const res = await axiosInstance.get(`/api/users/${id}`);
                            if (res.data.success && res.data.data) {
                                fetchedUsers.push(res.data.data);
                            } else {
                                fetchedUsers.push({ _id: id, fullName: `Unknown User (${id.substring(0, 6)})`, cardNo: "-" });
                            }
                        } catch (err) {
                            fetchedUsers.push({ _id: id, fullName: `Unknown User (${id.substring(0, 6)})`, cardNo: "-" });
                        }
                    }
                    setActiveEmployees([...savedStudents, ...fetchedUsers]);
                    setHasInitializedActiveEmployees(true);
                };
                fetchMissing();
            } else {
                setActiveEmployees(savedStudents);
                setHasInitializedActiveEmployees(true);
            }
        }
    }, [students, tableData, isLoadingPlan, hasInitializedActiveEmployees]);

    useEffect(() => {
        if (!departmentId) return;
        let cancelled = false;

        const loadSavedPlan = async () => {
            try {
                setSavedLines(null);
                setIsLoadingPlan(true);
                setTableData({});
                const response = await axiosInstance.get(`/api/multi-skilling-plan/department/${departmentId}`, {
                    params: { sectionId }
                });
                const data = response?.data?.data;
                if (!cancelled && data) {
                    if (Array.isArray(data.selectedLines)) {
                        // Store raw saved lines; the lines-length effect will resize and apply them.
                        setSavedLines(data.selectedLines);
                    }
                    if (data.tableData && typeof data.tableData === "object") {
                        setTableData(data.tableData);
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
    }, [departmentId, sectionId]);

    const handleAddEmployee = (emp) => {
        setActiveEmployees(prev => [...prev, emp]);
        setTableData(prev => {
            const id = emp._id || emp.id;
            if (id && !prev[id]) {
                return {
                    ...prev,
                    [id]: { plan: {}, actual: {} }
                };
            }
            return prev;
        });
        setAssociateSearch("");
        setShowAssociateSuggestions(false);
        toast.success(`${emp.fullName || emp.name} added to training plan`);
    };

    const handleRemoveEmployee = (userId) => {
        setActiveEmployees(prev => prev.filter(emp => String(emp._id || emp.id) !== String(userId)));
        setTableData(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
        toast.success("Associate removed from sheet");
    };

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
                {/* Sheet Metadata Header Block - Visible in screen & print */}
                <div className="flex justify-between items-center w-full mb-4 pb-2 border-b border-slate-200 print:border-black">
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-wide text-slate-800 print:text-black hidden print:block">
                            Training Plan for Multi Skilling
                        </h2>
                        <span className="print:hidden text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Interactive Multi-Skilling Sheet
                        </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 border border-slate-950 bg-slate-50 px-3 py-1 rounded shadow-sm print:shadow-none print:bg-white print:rounded-none whitespace-nowrap">
                        Document No: FRM-WH-QA-236
                    </div>
                </div>
                <div className="no-print flex flex-col sm:flex-row items-end gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {canManage && (
                        <div className="w-full sm:w-72 relative">
                            <Label className="text-xs font-bold text-slate-700 mb-1 block">Add Associate to Sheet</Label>
                            <Input
                                placeholder="Type name or card no to add..."
                                value={associateSearch}
                                onChange={(e) => {
                                    setAssociateSearch(e.target.value);
                                    setShowAssociateSuggestions(true);
                                }}
                                onFocus={() => setShowAssociateSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowAssociateSuggestions(false), 200)}
                                className="h-9 bg-white text-sm focus-visible:ring-amber-500"
                            />
                            {showAssociateSuggestions && filteredSearchStudents.length > 0 && (
                                <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50 py-1">
                                    {filteredSearchStudents.map((s) => (
                                        <li
                                            key={s._id || s.id}
                                            onMouseDown={() => handleAddEmployee(s)}
                                            className="px-3 py-2 hover:bg-amber-50 hover:text-amber-900 cursor-pointer text-sm transition-colors flex flex-col"
                                        >
                                            <span className="font-semibold text-slate-800">{s.fullName || s.name}</span>
                                            <span className="text-xs text-slate-500 font-mono">Card: {s.cardNo || "—"}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {showAssociateSuggestions && associateSearch.trim() && filteredSearchStudents.length === 0 && (
                                <ul className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 text-center text-xs text-slate-500">
                                    No matching associates found.
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="w-full sm:w-72">
                        <Label className="text-xs font-bold text-slate-700 mb-1 block">Filter Table Rows</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Filter active associates..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                className="h-9 bg-white text-sm"
                            />
                            {searchText && (
                                <Button variant="ghost" size="sm" onClick={() => setSearchText("")} className="h-9 px-2 text-xs">
                                    Clear
                                </Button>
                            )}
                        </div>
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
                        {filteredEmployees.map((emp, index) => {
                            const empId = String(emp._id || emp.id || "");
                            const data = tableData[empId] || { plan: {}, actual: {} };
                            return (
                                <React.Fragment key={empId}>
                                    <tr className="hover:bg-gray-50">
                                        <td rowSpan="2" className="border border-black p-2 text-center">{index + 1}</td>
                                        <td rowSpan="2" className="border border-black p-2 font-bold text-blue-700 uppercase">
                                            <div className="flex items-center justify-between gap-2">
                                                <span>{emp.fullName || emp.name}</span>
                                                {canManage && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleRemoveEmployee(empId)}
                                                        className="text-red-500 hover:text-red-700 p-1 h-auto no-print"
                                                        title="Remove from sheet"
                                                    >
                                                        <IconTrash className="w-4 h-4 text-red-500 hover:text-red-700" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                        <td rowSpan="2" className="border border-black p-2 text-center font-bold text-blue-700">
                                            {emp.cardNo || emp.username || emp.empId || "-"}
                                        </td>
                                        <td className="border border-black p-1 text-center bg-gray-50 text-[10px] font-bold">Plan</td>
                                        {machineColumns.map((col) => (
                                            <td key={`plan-${empId}-${col.key}`} className="border border-black p-0">
                                                <input
                                                    type="date"
                                                    className="w-full h-full text-center outline-none bg-transparent p-1 text-[10px] disabled:opacity-80"
                                                    value={data.plan?.[col.key] || ""}
                                                    onChange={(e) => handleDataChange(empId, "plan", col.key, e.target.value)}
                                                    disabled={!canManage}
                                                />
                                            </td>
                                        ))}
                                    </tr>

                                    <tr className="hover:bg-gray-50">
                                        <td className="border border-black p-1 text-center bg-gray-50 text-[10px] font-bold">Actual</td>
                                        {machineColumns.map((col) => {
                                            const studentId = empId;
                                            const assignedDates = (col.machineIds || [])
                                                .map(mId => assignmentDateMap[`${studentId}_${mId}`])
                                                .filter(Boolean);
                                            const assignedDate = assignedDates.length > 0 ? assignedDates.sort()[0] : "";
                                            const cellValue = assignedDate || data.actual?.[col.key] || "";

                                            return (
                                                <td key={`actual-${empId}-${col.key}`} className="border border-black p-0">
                                                    <input
                                                        type="date"
                                                        className="w-full h-full text-center outline-none bg-transparent p-1 text-[10px] disabled:opacity-80"
                                                        value={cellValue}
                                                        onChange={(e) => handleDataChange(empId, "actual", col.key, e.target.value)}
                                                        disabled={!!assignedDate || !canManage}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}

                        {filteredEmployees.length === 0 && (
                            <tr>
                                <td colSpan={4 + totalProcessCols} className="border border-black p-8 text-center text-muted-foreground">
                                    {activeEmployees.length === 0
                                        ? "No associates added to this plan calendar sheet yet. Please use the search bar above to search and add associates."
                                        : "No associates match the search filter."}
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
