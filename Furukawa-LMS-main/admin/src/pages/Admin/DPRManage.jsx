import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetLinesBySectionQuery } from '@/Redux/AllApi/LineApi';
import { useGetSubSectionsByLineQuery } from '@/Redux/AllApi/SubSectionApi';
import { useGetMachinesBySubSectionQuery } from '@/Redux/AllApi/MachineApi';
import { 
    useGetDPRConfigQuery, 
    useSaveDPRConfigMutation 
} from '@/Redux/AllApi/DailyProductionReportApi';
import { Loader2, Plus, Layers, Settings2, X, CheckCircle2, ChevronRight, LayoutGrid } from "lucide-react";
import { toast } from 'sonner';

const DPRManage = () => {
    const navigate = useNavigate();
    const authUser = useSelector(state => state.auth.user);
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';

    // Target Line Selection
    const [targetDept, setTargetDept] = useState("");
    const [targetSection, setTargetSection] = useState("");
    const [targetLine, setTargetLine] = useState("");

    // Selections
    const [setupDept, setSetupDept] = useState("");
    const [setupSection, setSetupSection] = useState("");
    const [setupLine, setSetupLine] = useState("");
    const [setupSubSection, setSetupSubSection] = useState("");
    const [setupMachine, setSetupMachine] = useState("");
    const [basket, setBasket] = useState([]); // Moral Processes
    const [basketAttendance, setBasketAttendance] = useState([]); // Attendance Stations
    const [activeTab, setActiveTab] = useState("moral"); // "moral" or "attendance"
    const [remark, setRemark] = useState("Updated manpower template");

    // API Data
    const { data: departmentsData } = useGetAllDepartmentsQuery();
    const { data: setupSectionsData } = useGetSectionsByDepartmentQuery(setupDept, { skip: !setupDept });
    const { data: setupLinesData } = useGetLinesBySectionQuery(setupSection, { skip: !setupSection });
    const { data: setupSubSectionsData } = useGetSubSectionsByLineQuery(setupLine, { skip: !setupLine });
    const { data: setupMachinesData } = useGetMachinesBySubSectionQuery(setupSubSection, { skip: !setupSubSection });
    
    // API Queries for Target Line
    const { data: targetSectionsData } = useGetSectionsByDepartmentQuery(targetDept, { skip: !targetDept });
    const { data: targetLinesData } = useGetLinesBySectionQuery(targetSection, { skip: !targetSection });

    // Config queries (GLOBAL as fallback base template)
    const { data: globalConfigResp } = useGetDPRConfigQuery("GLOBAL");
    const configKey = targetLine === "GLOBAL" ? "GLOBAL" : (targetLine ? `LINE_${targetLine}` : "GLOBAL");
    const { data: currentConfigResp } = useGetDPRConfigQuery(configKey);
    const [saveConfig, { isLoading: isSavingConfig }] = useSaveDPRConfigMutation();

    const departments = departmentsData?.data?.departments || [];
    const setupSections = setupSectionsData?.data || [];
    const setupLines = setupLinesData?.data || [];
    const setupSubSections = setupSubSectionsData?.data || [];
    const setupMachines = setupMachinesData?.data || [];

    const targetSections = targetSectionsData?.data || [];
    const targetLines = targetLinesData?.data || [];

    // Filter departments based on user assignment for sub-section selection
    const assignableDepartments = React.useMemo(() => {
        const allDepts = departments || [];
        const rawAssigned = Array.isArray(authUser?.departments) ? [...authUser.departments] : [];
        if (authUser?.departmentId) rawAssigned.push(authUser.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);

        if (!authUser || (isAdmin && assignedIds.length === 0)) return allDepts;

        return allDepts.filter(dept =>
            assignedIds.includes(String(dept.id || dept._id))
        );
    }, [departments, authUser, isAdmin]);

    useEffect(() => {
        if (assignableDepartments.length === 1 && !setupDept) {
            setSetupDept(assignableDepartments[0].id || assignableDepartments[0]._id);
        }
    }, [assignableDepartments, setupDept]);

    // Sync target selection to setup selection for convenience, but keep it editable
    useEffect(() => {
        if (targetDept) {
            setSetupDept(targetDept);
            setSetupSection("");
            setSetupLine("");
            setSetupSubSection("");
            setSetupMachine("");
        }
    }, [targetDept]);

    useEffect(() => {
        if (targetSection) {
            setSetupSection(targetSection);
            setSetupLine("");
            setSetupSubSection("");
            setSetupMachine("");
        }
    }, [targetSection]);

    useEffect(() => {
        if (targetLine) {
            setSetupLine(targetLine);
            setSetupSubSection("");
            setSetupMachine("");
        }
    }, [targetLine]);

    useEffect(() => {
        if (currentConfigResp?.data?.config) {
            let config = currentConfigResp.data.config;

            // If we are configuring a line, and that line's config is default,
            // fall back to loading the GLOBAL config's custom template as a starting point.
            if (targetLine && currentConfigResp.data.isDefault && globalConfigResp?.data?.config && !globalConfigResp.data.isDefault) {
                config = globalConfigResp.data.config;
            }
            
            // Moral Basket
            if (config.moral?.rows) {
                setBasket(config.moral.rows.map((r, idx) => ({ 
                    id: r.subSectionId || `existing-moral-${idx}`, 
                    name: r.process,
                    subSectionId: r.subSectionId
                })));
            } else {
                setBasket([]);
            }

            // Attendance Basket
            if (config.attendance?.rows) {
                setBasketAttendance(config.attendance.rows.map((r, idx) => ({
                    id: r.stationId || `existing-attendance-${idx}`,
                    name: r.process,
                    stNo: r.stNo,
                    stationId: r.stationId
                })));
            } else {
                setBasketAttendance([]);
            }
        }
    }, [currentConfigResp, globalConfigResp, targetLine]);

    const addToBasket = () => {
        if (!setupSubSection) {
            toast.error("Please select a sub-section first");
            return;
        }

        const sub = setupSubSections.find(s => String(s.id) === setupSubSection);
        if (!sub) return;

        // 1. Add to Moral Basket (if not already there)
        const displayName = sub.sectionName ? `${sub.name} (${sub.sectionName})` : sub.name;
        const existsInMoral = basket.some(item => String(item.id) === String(sub.id));
        
        let newMoralBasket = [...basket];
        if (!existsInMoral) {
            newMoralBasket.push({ 
                id: sub.id, 
                name: displayName, 
                subSectionId: sub.id 
            });
        }

        // 2. Add to Attendance Basket (always try to add all stations of this sub-section)
        // Get all machines for this sub-section that aren't already in the basket
        const machinesToAdd = setupMachines.filter(m => 
            !basketAttendance.some(item => String(item.id) === String(m.id) || String(item.stationId) === String(m.id))
        );

        let newAttendanceBasket = [...basketAttendance];
        if (machinesToAdd.length > 0) {
            const newRows = machinesToAdd.map(m => ({
                id: m.id,
                name: sub.name, // Sub-Section name (Process Name column)
                stNo: m.name,  // Station name (St. No. column)
                stationId: m.id
            }));
            newAttendanceBasket = [...basketAttendance, ...newRows];
        }

        // Update state based on active tab and needs
        if (activeTab === 'moral') {
            setBasket(newMoralBasket);
            // If the user is on Moral tab, we ALSO update Attendance basket in the background
            // to fulfill the request "i only choose sub-section and all stations fetch"
            setBasketAttendance(newAttendanceBasket);
            if (!existsInMoral || machinesToAdd.length > 0) {
                toast.success(`Added ${sub.name} and ${machinesToAdd.length} stations`);
            } else {
                toast.info("Sub-section and its stations are already in the template");
            }
        } else {
            // If on Attendance tab, we just update Attendance basket
            if (machinesToAdd.length > 0) {
                setBasketAttendance(newAttendanceBasket);
                toast.success(`Added ${machinesToAdd.length} stations from ${sub.name}`);
            } else {
                toast.error("All stations from this sub-section are already added");
            }
        }
    };

    const removeFromBasket = (id) => {
        if (activeTab === 'moral') {
            setBasket(basket.filter(b => b.id !== id));
        } else {
            setBasketAttendance(basketAttendance.filter(b => b.id !== id));
        }
    };

    const handleSaveSetup = async (saveAsGlobal = false) => {
        if (basket.length === 0 && basketAttendance.length === 0) {
            toast.error("Please add at least one item to either template.");
            return;
        }

        try {
            const saveKey = saveAsGlobal ? "GLOBAL" : configKey;
            
            let baseConfig = {};
            if (saveKey === "GLOBAL") {
                baseConfig = globalConfigResp?.data?.config || {};
            } else {
                baseConfig = currentConfigResp?.data?.config || {};
                if (targetLine && currentConfigResp?.data?.isDefault && globalConfigResp?.data?.config) {
                    baseConfig = globalConfigResp.data.config;
                }
            }

            // Construct new moral rows
            const newMoralRows = basket.map(b => ({ 
                process: b.name,
                subSectionId: b.subSectionId || b.id
            }));

            // Construct new attendance rows
            const newAttendanceRows = basketAttendance.map((b, idx) => ({
                process: b.name,
                stationId: b.stationId || b.id,
                stNo: b.stNo,
                srNo: idx + 1
            }));

            const updatedConfig = {
                ...baseConfig,
                moral: {
                    ...(baseConfig.moral || {}),
                    rows: newMoralRows
                },
                attendance: {
                    ...(baseConfig.attendance || {}),
                    rows: newAttendanceRows
                }
            };

            await saveConfig({
                departmentId: saveKey,
                config: updatedConfig,
                remark: remark
            }).unwrap();

            toast.success(saveKey === "GLOBAL" ? "Global DPR Manpower template saved!" : "Line DPR Manpower template saved!");
        } catch (error) {
            toast.error(error?.data?.message || "Failed to save configuration");
        }
    };

    return (
        <div className="space-y-6 w-full max-w-6xl mx-auto pb-20 p-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                        <Settings2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">DPR Manpower Setup</h1>
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Configure processes and stations for the Daily Production Report</p>
                    </div>
                </div>
                <Button onClick={() => navigate("/admin/daily-production-report")} className="bg-slate-900 hover:bg-slate-800 shadow-sm px-6">
                    <Plus className="w-4 h-4 mr-2" />
                    Go to DPR Form
                </Button>
            </div>

            {/* Target Line Selector */}
            <Card className="border-slate-200 shadow-md">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                        <CardTitle className="text-md font-bold text-slate-800">
                            Configure Target Line Template
                        </CardTitle>
                    </div>
                    <CardDescription>
                        Select the Department, Section, and Line to load and save its specific manpower and attendance configuration layout.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">
                                {targetLine === "GLOBAL" ? "Editing Mode: GLOBAL TEMPLATE" : "Editing Mode: Specific Line Template"}
                            </span>
                            {targetLine === "GLOBAL" && (
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">Active</span>
                            )}
                        </div>
                        {targetLine !== "GLOBAL" ? (
                            <Button 
                                type="button"
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                    setTargetDept("");
                                    setTargetSection("");
                                    setTargetLine("GLOBAL");
                                }}
                                className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs h-8"
                            >
                                Edit Global Template
                            </Button>
                        ) : (
                            <Button 
                                type="button"
                                variant="outline" 
                                size="sm" 
                                onClick={() => {
                                    setTargetLine("");
                                }}
                                className="text-xs h-8"
                            >
                                Switch to Line Selection
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Department</Label>
                            <Select value={targetDept} onValueChange={(val) => { setTargetDept(val); setTargetSection(""); setTargetLine(""); }}>
                                <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500">
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((dept) => (
                                        <SelectItem key={dept.id || dept._id} value={String(dept.id || dept._id)}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Section</Label>
                            <Select value={targetSection} onValueChange={(val) => { setTargetSection(val); setTargetLine(""); }} disabled={!targetDept}>
                                <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500">
                                    <SelectValue placeholder="Select Section" />
                                </SelectTrigger>
                                <SelectContent>
                                    {targetSections.map((sec) => (
                                        <SelectItem key={sec.id} value={String(sec.id)}>{sec.name} ({sec.category})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Line</Label>
                            <Select value={targetLine === "GLOBAL" ? "" : targetLine} onValueChange={(val) => setTargetLine(val)} disabled={!targetSection}>
                                <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500">
                                    <SelectValue placeholder="Select Line" />
                                </SelectTrigger>
                                <SelectContent>
                                    {targetLines.map((line) => (
                                        <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!targetLine ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-16 bg-slate-50/50 text-center space-y-4">
                    <div className="p-4 bg-blue-100/50 rounded-full text-blue-600">
                        <Settings2 className="w-8 h-8 animate-pulse" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                        <h3 className="text-lg font-bold text-slate-800">Select a Line to Load Template</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Please select a Target Department, Section, and Line above. The system will load its template so you can manage its processes and stations.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Tab Switcher */}
                    <div className="flex p-1 bg-slate-100 rounded-xl w-fit border border-slate-200 shadow-inner">
                        <button 
                            onClick={() => setActiveTab('moral')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'moral' ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Moral (Manpower Summary)
                        </button>
                        <button 
                            onClick={() => setActiveTab('attendance')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'attendance' ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Attendance Summary
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Selection Section */}
                        <Card className="lg:col-span-2 border-slate-200 shadow-md h-fit">
                            <CardHeader className="border-b bg-slate-50/50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <LayoutGrid className="w-5 h-5 text-blue-600" />
                                    1. Select {activeTab === 'moral' ? 'Production Processes' : 'Work Stations'}
                                </CardTitle>
                                <CardDescription>
                                    {activeTab === 'moral' 
                                        ? "Choose sub-sections to include in the Manpower Summary table" 
                                        : "Choose specific stations/machines for the Attendance Summary table"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Department</Label>
                                        <Select value={setupDept} onValueChange={(val) => { setSetupDept(val); setSetupSection(""); setSetupLine(""); setSetupSubSection(""); setSetupMachine(""); }}>
                                            <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                            <SelectContent>
                                                {assignableDepartments.map((dept) => (
                                                    <SelectItem key={dept.id || dept._id} value={String(dept.id || dept._id)}>{dept.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Section</Label>
                                        <Select value={setupSection} onValueChange={(val) => { setSetupSection(val); setSetupLine(""); setSetupSubSection(""); setSetupMachine(""); }} disabled={!setupDept}>
                                            <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500"><SelectValue placeholder="Select Section" /></SelectTrigger>
                                            <SelectContent>
                                                {setupSections.map((sec) => (
                                                    <SelectItem key={sec.id} value={String(sec.id)}>{sec.name} ({sec.category})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Line</Label>
                                        <Select value={setupLine} onValueChange={(val) => { setSetupLine(val); setSetupSubSection(""); setSetupMachine(""); }} disabled={!setupSection}>
                                            <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500"><SelectValue placeholder="Select Line" /></SelectTrigger>
                                            <SelectContent>
                                                {setupLines.map((line) => (
                                                    <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sub-Section (Process)</Label>
                                        <Select value={setupSubSection} onValueChange={(val) => { setSetupSubSection(val); setSetupMachine(""); }} disabled={!setupLine}>
                                            <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500"><SelectValue placeholder="Select Sub-section" /></SelectTrigger>
                                            <SelectContent>
                                                {setupSubSections.map((sub) => (
                                                    <SelectItem key={sub.id} value={String(sub.id)}>
                                                        {sub.name} {sub.sectionName ? `(${sub.sectionName})` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {activeTab === 'moral' ? (
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs font-bold text-blue-600 uppercase tracking-widest">Confirm Selection</Label>
                                            <Button onClick={addToBasket} disabled={!setupSubSection} className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-md">
                                                <Plus className="w-5 h-5 mr-2" />
                                                Add Process to Moral Table
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="text-xs font-bold text-blue-600 uppercase tracking-widest">Confirm Selection</Label>
                                            <Button onClick={addToBasket} disabled={!setupSubSection} className="w-full h-11 bg-blue-600 hover:bg-blue-700 shadow-md">
                                                <Plus className="w-5 h-5 mr-2" />
                                                Add Sub-Section with all Stations
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saving Remark</Label>
                                    <Input 
                                        placeholder="e.g. Updated manpower template..." 
                                        value={remark} 
                                        onChange={(e) => setRemark(e.target.value)}
                                        className="h-11 bg-slate-50 mt-1.5 focus:bg-white border-slate-200"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Basket Section */}
                        <Card className="border-slate-200 shadow-lg flex flex-col">
                            <CardHeader className="border-b bg-blue-50/30">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-blue-600" />
                                        2. Selected Template
                                    </CardTitle>
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                                        {activeTab === 'moral' ? basket.length : basketAttendance.length} Items
                                    </span>
                                </div>
                                <CardDescription>
                                    {activeTab === 'moral' ? "Rows for Manpower Summary" : "Rows for Attendance Summary"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                                <div className="flex-1 overflow-y-auto min-h-[400px] p-4 bg-slate-50/50">
                                    {(activeTab === 'moral' ? basket : basketAttendance).length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                            <Layers className="w-12 h-12 mb-3" />
                                            <p className="text-sm font-medium">No items selected</p>
                                            <p className="text-[11px] text-center px-4">Use the selection panel to build your template</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(activeTab === 'moral' ? basket : basketAttendance).map((item, idx) => (
                                                <div key={item.id} className="flex items-center justify-between group bg-white border border-slate-200 p-3 rounded-lg shadow-sm hover:border-blue-300 transition-all animate-in slide-in-from-right-2 duration-200">
                                                    <div className="flex flex-col gap-0.5 max-w-[80%]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold shrink-0">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-[13px] font-bold text-slate-800 truncate">{item.name}</span>
                                                        </div>
                                                        {item.stNo && (
                                                            <div className="text-[10px] text-blue-600 font-bold ml-7">
                                                                Station: {item.stNo}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => removeFromBasket(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2">
                                    <Button 
                                        onClick={() => handleSaveSetup(false)} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-md group"
                                        disabled={isSavingConfig}
                                    >
                                        {isSavingConfig ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : (
                                            <CheckCircle2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                                        )}
                                        {configKey === "GLOBAL" ? "Save Global Template" : "Save for Selected Line"}
                                    </Button>
                                    
                                    {configKey !== "GLOBAL" && (
                                        <Button 
                                            variant="outline"
                                            onClick={() => handleSaveSetup(true)} 
                                            className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 font-bold h-11 shadow-sm"
                                            disabled={isSavingConfig}
                                        >
                                            Save as Global Template
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default DPRManage;
