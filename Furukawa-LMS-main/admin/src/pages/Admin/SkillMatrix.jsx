import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IconPrinter, IconLoader, IconDeviceFloppy, IconDownload } from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';
import { useGetMachinesByLineQuery } from '@/Redux/AllApi/MachineApi';
import { useGetActiveConfigQuery } from '@/Redux/AllApi/CourseLevelConfigApi';
import { useGetSkillMatrixListQuery, useGetSkillMatrixQuery, useSaveSkillMatrixMutation } from '@/Redux/AllApi/SkillMatrixApi';
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Input } from "@/components/ui/input";
import { exportToExcel } from "@/utils/exportHelper";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { History, Edit2, Save, Loader2 } from "lucide-react";
import axiosInstance from "@/Helper/axiosInstance";

// Helper to normalize level string for comparison
const normalizeLevel = (levelStr) => {
    if (!levelStr) return "";
    // If format is L-1, L-2, etc. remove hyphen to match config names like L1, L2 if needed
    // But config might have L1, L2 and user might have L-1, L-2. 
    // Let's standardise to "L" + number
    return levelStr.replace('-', '');
};

const SkillMatrix = () => {
    const componentRef = useRef();
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedLine, setSelectedLine] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedLevel, setSelectedLevel] = useState("All");
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [createDepartment, setCreateDepartment] = useState("");
    const [createLine, setCreateLine] = useState("");
    const [createMonth, setCreateMonth] = useState(new Date().toISOString().slice(0, 7));

    // --- Saved Data Fetching ---
    const { data: savedMatrixData, refetch: refetchMatrix } = useGetSkillMatrixQuery({
        departmentId: selectedDepartment,
        lineId: selectedLine,
        month: selectedMonth,
    }, {
        skip: !selectedDepartment || !selectedLine || !selectedMonth || !isMatrixOpen
    });

    const { data: matrixListData, isLoading: isMatrixListLoading } = useGetSkillMatrixListQuery({
        departmentId: selectedDepartment || undefined,
        lineId: selectedLine || undefined,
        month: selectedMonth || undefined,
    });

    const [saveSkillMatrix, { isLoading: isSaving }] = useSaveSkillMatrixMutation();

    // --- Data Fetching ---
    const { data: departmentsData } = useGetAllDepartmentsQuery();
    const { data: linesData } = useGetLinesByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: createLinesData } = useGetLinesByDepartmentQuery(createDepartment, { skip: !createDepartment });
    const { data: machinesData, isLoading: isMachinesLoading } = useGetMachinesByLineQuery(selectedLine, { skip: !selectedLine });

    const [matrixEntries, setMatrixEntries] = useState([]);

    // Config State for New Fields
    const [config, setConfig] = useState({
        shift: "A",
        products: ["Product A", "Product B", "Product C"],
        revisions: Array(4).fill({ product: "", revision: "", date: "" }),
        signatures: { approved: "", confirmed: "", qa: "", safety: "", process: "" },
        processPersons: { responsible: "", vice: "", expert: "" },
        documentInfo: { docNo: "FRM-WH-PR-009", revNo: "02", revDate: "02.05.2022", page: "1 of 1" },
        // Footer Rows Data (Arrays for 16 columns)
        footerRows: {
            plan: Array(16).fill(""),
            actual: Array(16).fill(""),
            percent: Array(16).fill("")
        },
        minSkills: Array(16).fill("L2")
    });

    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [configJson, setConfigJson] = useState('');
    const [configRemark, setConfigRemark] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isDashboardSaving, setIsDashboardSaving] = useState(false);

    const departmentUsers = React.useMemo(() => {
        if (!selectedDepartment || !departmentsData?.data?.departments) return [];
        const selectedDept = departmentsData.data.departments.find(d => String(d.id || d._id) === String(selectedDepartment));
        if (!selectedDept) return [];
        const users = [];
        // if (selectedDept.instructor) users.push({ ...selectedDept.instructor, type: 'TNR', level: 'L-5' });
        if (selectedDept.students) selectedDept.students.forEach(student => users.push({ ...student, type: 'EMP', level: student.currentLevel || 'L-1' }));
        return users;
    }, [selectedDepartment, departmentsData]);

    useEffect(() => {
        if (selectedDepartment) {
            fetchDashboardConfig();
        }
    }, [selectedDepartment]);

    const fetchDashboardConfig = async () => {
        try {
            const response = await axiosInstance.get(`/api/skill-matrix/dashboard/config/${selectedDepartment}`);
            if (response.data.success && response.data.data.config) {
                setConfig(prev => ({ ...prev, ...response.data.data.config }));
            }
        } catch (error) {
            console.error("Error fetching dashboard config:", error);
        }
    };

    const handleSaveDashboardConfig = async () => {
        try {
            setIsDashboardSaving(true);
            const parsedConfig = JSON.parse(configJson);
            await axiosInstance.post(`/api/skill-matrix/dashboard/config/save`, {
                departmentId: selectedDepartment,
                config: parsedConfig,
                remark: configRemark
            });
            setConfig(prev => ({ ...prev, ...parsedConfig }));
            setIsEditingLayout(false);
            toast.success("Dashboard layout saved successfully");
        } catch (error) {
            console.error("Error saving dashboard config:", error);
            toast.error("Invalid JSON or server error");
        } finally {
            setIsDashboardSaving(false);
        }
    };

    const fetchDashboardHistory = async () => {
        try {
            const response = await axiosInstance.get(`/api/skill-matrix/dashboard/config/history/${selectedDepartment}`);
            if (response.data.success) {
                setHistory(response.data.data);
                setShowHistory(true);
            }
        } catch (error) {
            toast.error("Failed to fetch dashboard history");
        }
    };

    useEffect(() => {
        if (selectedLine && machinesData?.data) {
            const activeMachines = machinesData.data;
            const savedEntries = savedMatrixData?.data?.entries || [];

            // 1. Map Users
            const mappedData = departmentUsers.map((user, index) => {
                const savedUserEntry = savedEntries.find(e => e.userId === user._id);
                // Default stations
                const defaultStations = activeMachines.map(machine => ({
                    _id: machine._id,
                    name: machine.name,
                    critical: "Non-Critical",
                    min: "L-1",
                    curr: user.level || "L-1", // Use user level default
                }));

                const mergedStations = activeMachines.map(machine => {
                    const savedStation = savedUserEntry?.stations?.find(s => s.machineId === machine._id);
                    return {
                        _id: machine._id,
                        name: machine.name,
                        critical: savedStation?.critical || "Non-Critical",
                        min: savedStation?.min || "L-1",
                        curr: savedStation?.curr || user.level || "L-1",
                    };
                });

                // Calculate Plan/Actual
                const actualCount = mergedStations.reduce((acc, s) => {
                    // Check if level meets min? Or just count qualified?
                    // Logic: If curr >= min, it's 1? 
                    // For now simple: if curr != L-0 
                    return acc + (s.curr !== 'L-0' ? 1 : 0);
                }, 0);

                return {
                    srNo: index + 1,
                    _id: user._id,
                    name: user.fullName || "Unknown",
                    cardNo: savedUserEntry?.cardNo || user.empId || "", // Allow override
                    experience: savedUserEntry?.experience || (() => {
                        if (!user.createdAt) return "";
                        const start = new Date(user.createdAt);
                        const now = new Date();
                        const diffInMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                        const years = Math.floor(diffInMonths / 12);
                        const months = diffInMonths % 12;
                        return `${years}.${months} `;
                    })(),
                    certDate: savedUserEntry?.certDate || "24-Jan-26",
                    position: savedUserEntry?.position || "1.1",
                    stations: savedUserEntry ? mergedStations : defaultStations,
                    plan: savedUserEntry?.plan ?? activeMachines.length, // Saved or calculated
                    actual: savedUserEntry?.actual ?? actualCount,       // Saved or calculated
                    status: savedUserEntry?.status || "OK",
                    isManual: false,
                    level: user.level // Store level for filtering
                };
            }).filter(Boolean);

            // 2. Manual Rows
            const manualRows = savedEntries.filter(e => e.isManual).map((entry, idx) => {
                const mergedStations = activeMachines.map(machine => {
                    const savedStation = entry.stations?.find(s => s.machineId === machine._id);
                    return {
                        _id: machine._id,
                        name: machine.name,
                        curr: savedStation?.curr || "L-0",
                    };
                });
                return {
                    ...entry,
                    srNo: mappedData.length + idx + 1,
                    cardNo: entry.cardNo || "-",
                    experience: entry.experience || "",
                    certDate: entry.certDate || "",
                    position: entry.position || "",
                    stations: mergedStations,
                    plan: entry.plan ?? activeMachines.length,
                    actual: entry.actual ?? 0,
                    status: entry.status || "OK"
                };
            });

            setMatrixEntries([...mappedData, ...manualRows]);

            // Load Config
            if (savedMatrixData?.data?.footerInfo?.config) {
                // Ensure footerRows and minSkills exist if loading old data
                setConfig(prev => ({
                    ...prev,
                    ...savedMatrixData.data.footerInfo.config,
                    footerRows: savedMatrixData.data.footerInfo.config.footerRows || prev.footerRows,
                    minSkills: savedMatrixData.data.footerInfo.config.minSkills || prev.minSkills
                }));
            }
        } else if (!selectedLine) {
            setMatrixEntries([]);
        }
    }, [selectedLine, machinesData, departmentUsers, savedMatrixData]);

    const handleSave = async () => {
        if (!selectedDepartment || !selectedLine) {
            toast.error("Please select Department and Line first");
            return;
        }
        try {
            const entriesToSave = matrixEntries.map(entry => ({
                userId: entry.isManual ? null : entry._id,
                manualName: entry.isManual ? entry.name : "",
                isManual: entry.isManual,
                cardNo: entry.cardNo,
                experience: entry.experience,
                certDate: entry.certDate,
                position: entry.position,
                status: entry.status,
                plan: entry.plan,
                actual: entry.actual,
                // Save custom fields if backend allows extra props in entries, else might be lost or need 'detCas' field abuse
                stations: entry.stations.map(s => ({
                    machineId: s._id,
                    name: s.name,
                    curr: s.curr,
                    min: s.min,
                    // If min is editable per station, save it too
                    minSkill: s.minSkill
                }))
            }));

            const payload = {
                department: selectedDepartment,
                line: selectedLine,
                month: selectedMonth,
                entries: entriesToSave,
                footerInfo: {
                    config: config // Save our big config object here
                }
            };

            await saveSkillMatrix(payload).unwrap();
            toast.success("Skill Matrix saved successfully!");
            refetchMatrix();
        } catch (error) {
            console.error(error);
            toast.error("Failed to save Skill Matrix");
        }
    };

    const handleConfigChange = (path, value) => {
        setConfig(prev => {
            const newConfig = { ...prev };
            // Simple path handling
            if (path.includes('.')) {
                const [p1, p2] = path.split('.');
                newConfig[p1] = { ...newConfig[p1], [p2]: value };
            } else if (Array.isArray(newConfig[path])) {
                // specific index handling needed for arrays
                return prev;
            } else {
                newConfig[path] = value;
            }
            return newConfig;
        });
    };

    const handleArrayConfigChange = (arrayName, index, field, value) => {
        setConfig(prev => {
            const list = [...prev[arrayName]];
            if (typeof list[index] === 'object') {
                list[index] = { ...list[index], [field]: value };
            } else {
                list[index] = value;
            }
            return { ...prev, [arrayName]: list };
        });
    };

    const handleFooterRowChange = (type, index, value) => {
        setConfig(prev => ({
            ...prev,
            footerRows: {
                ...prev.footerRows,
                [type]: prev.footerRows[type].map((val, i) => i === index ? value : val)
            }
        }));
    };

    const handleEntryChange = (rowIdx, field, value) => {
        const updated = [...matrixEntries];
        updated[rowIdx] = { ...updated[rowIdx], [field]: value };
        setMatrixEntries(updated);
    }

    // Global min skill change or per station? Table shows per column
    // For now we can store it in config if it's per column, NOT per user
    const handleMinSkillChange = (colIdx, value) => {
        setConfig(prev => {
            const updatedMinSkills = [...(prev.minSkills || Array(16).fill("L2"))];
            updatedMinSkills[colIdx] = value;
            return { ...prev, minSkills: updatedMinSkills };
        });
    }

    const handleStationChange = (rowIdx, stationIdx, level) => {
        const updated = [...matrixEntries];
        updated[rowIdx].stations[stationIdx].curr = level;
        // Recalc Actual - Update actual field
        const s = updated[rowIdx].stations;
        updated[rowIdx].actual = s.filter(x => x.curr !== 'L-0' && x.curr).length;
        setMatrixEntries(updated);
    };

    const handlePrint = () => window.print();

    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeConfig = activeConfigData?.data;

    const SkillIcon = ({ levelStr, onClick, size = 20, editable = false }) => {
        // Dynamic Levels based on Active Config
        const levels = activeConfig?.levels || [];
        const maxLevels = levels.length > 0 ? levels.length : 4; // Default to 4 if no config

        // Normalize level string to number (L-1 -> 1, L-2 -> 2)
        // If levelStr is not in L-X format, try to match by name
        let currentLevel = 0;
        if (levelStr === 'L-0') {
            currentLevel = 0;
        } else if (levelStr && levelStr.startsWith('L-')) {
            currentLevel = parseInt(levelStr.split('-')[1]) || 0;
        } else {
            // Try matching by name in config
            const foundLevel = levels.find(l => l.name === levelStr);
            if (foundLevel) {
                currentLevel = foundLevel.order + 1; // 0-indexed order to 1-based count
            }
        }

        const center = size / 2;
        const radius = size / 2 - 2;

        const handleClick = () => {
            if (!editable || !onClick) return;
            // Cycle logic: L-0 -> L-1 -> ... -> L-Max -> L-0
            let nextLevelStr = 'L-0';
            if (maxLevels > 0) {
                if (currentLevel < maxLevels) {
                    // Next level
                    const nextLevelIndex = currentLevel; // 0-based index for next level
                    const nextLevelObj = levels.find(l => l.order === nextLevelIndex);
                    // If config exists, use its name? Or stick to L-X format?
                    // System seems to use L-X internally mostly. Let's try to stick to config names if possible, but fallback to L-X
                    nextLevelStr = nextLevelObj ? nextLevelObj.name : `L - ${currentLevel + 1} `;
                } else {
                    nextLevelStr = 'L-0';
                }
            } else {
                // Fallback hardcoded cycle
                const hardcoded = ['L-0', 'L-1', 'L-2', 'L-3', 'L-4', 'L-5'];
                const idx = hardcoded.indexOf(levelStr);
                nextLevelStr = hardcoded[(idx + 1) % hardcoded.length];
            }
            onClick(nextLevelStr);
        };

        // Pie Chart Generation
        const renderSlices = () => {
            if (maxLevels === 0) return null;

            // If L-0, Dashed Circle (Under Training)
            if (currentLevel === 0) {
                return (
                    <>
                        <circle cx={center} cy={center} r={radius} fill="none" stroke="black" strokeWidth="1" strokeDasharray="2,2" />
                        {/* Optional cross lines for L-0 style */}
                        <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="black" strokeWidth="0.5" strokeDasharray="2,2" />
                        <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="black" strokeWidth="0.5" strokeDasharray="2,2" />
                    </>
                );
            }

            const slices = [];
            const anglePerSlice = 360 / maxLevels;

            // Starting from -90 degrees (12 o'clock)
            let startAngle = -90;

            for (let i = 0; i < maxLevels; i++) {
                const endAngle = startAngle + anglePerSlice;

                // Calculate Coordinates
                const x1 = center + radius * Math.cos(startAngle * Math.PI / 180);
                const y1 = center + radius * Math.sin(startAngle * Math.PI / 180);
                const x2 = center + radius * Math.cos(endAngle * Math.PI / 180);
                const y2 = center + radius * Math.sin(endAngle * Math.PI / 180);

                // SVG Path command
                // M center L x1 y1 A radius radius 0 0 1 x2 y2 Z
                const largeArcFlag = anglePerSlice > 180 ? 1 : 0;
                const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

                // Fill Logic: i < currentLevel -> Fill Black
                const isFilled = i < currentLevel;
                const fill = isFilled ? "black" : "white"; // "white" for empty to overwrite background lines if any? Or "none"? User said "empty".

                slices.push(
                    <path key={i} d={d} fill={fill} stroke="black" strokeWidth="0.5" />
                );

                startAngle = endAngle;
            }

            return (
                <>
                    {/* Outer circle stroke to ensure clean edges */}
                    <circle cx={center} cy={center} r={radius} fill="none" stroke="black" strokeWidth="1" />
                    {slices}
                </>
            );
        };

        return (
            <div onClick={handleClick} className={`cursor - ${editable ? 'pointer' : 'default'} inline - block`}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size} `}>
                    {renderSlices()}
                </svg>
            </div>
        );
    };

    const selectedDeptName = departmentsData?.data?.departments?.find(d => String(d.id || d._id) === String(selectedDepartment))?.name || "Select";
    const selectedLineName = linesData?.data?.find(l => String(l.id || l._id) === String(selectedLine))?.name || "Select";

    const handleCreateSkillMatrix = () => {
        if (!createDepartment || !createLine || !createMonth) {
            toast.error("Please select Department, Line and Month");
            return;
        }
        setSelectedDepartment(createDepartment);
        setSelectedLine(createLine);
        setSelectedMonth(createMonth);
        setIsMatrixOpen(true);
        setCreateOpen(false);
    };

    if (!isMatrixOpen) {
        const matrixList = matrixListData?.data || [];
        return (
            <div className="space-y-4">
                <div className="p-6 border rounded bg-white flex items-center justify-between">
                    <h1 className="text-xl font-bold">Skill Matrix Forms</h1>
                    <Button onClick={() => setCreateOpen(true)}>Create Skill Matrix Form</Button>
                </div>

                <div className="p-6 border rounded bg-white space-y-4">
                    <h2 className="text-lg font-semibold">Open Existing Skill Matrix Form</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Department</label>
                            <Select value={selectedDepartment} onValueChange={(val) => { setSelectedDepartment(val); setSelectedLine(""); }}>
                                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                <SelectContent>
                                    {departmentsData?.data?.departments?.map((d, idx) => (
                                        <SelectItem key={`${d.id || d._id} -${idx} `} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Line</label>
                            <Select value={selectedLine} onValueChange={setSelectedLine} disabled={!selectedDepartment}>
                                <SelectTrigger><SelectValue placeholder="Select Line" /></SelectTrigger>
                                <SelectContent>
                                    {linesData?.data?.map((l, idx) => (
                                        <SelectItem key={`${l.id || l._id} -${idx} `} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Month</label>
                            <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                        </div>
                    </div>

                    <div className="border rounded overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40">
                                <tr>
                                    <th className="text-left p-2 border-b">Form</th>
                                    <th className="text-left p-2 border-b">Department</th>
                                    <th className="text-left p-2 border-b">Line</th>
                                    <th className="text-left p-2 border-b">Line Leader</th>
                                    <th className="text-left p-2 border-b">Month</th>
                                    <th className="text-left p-2 border-b">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isMatrixListLoading ? (
                                    <tr><td className="p-3 text-muted-foreground" colSpan={6}>Loading...</td></tr>
                                ) : matrixList.length === 0 ? (
                                    <tr>
                                        <td className="p-3 text-muted-foreground" colSpan={6}>
                                            No skill matrix form found for selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    matrixList.map((row, idx) => (
                                        <tr
                                            key={row.id || idx}
                                            className="hover:bg-muted/30 cursor-pointer"
                                            onClick={() => {
                                                setSelectedDepartment(String(row.department || ""));
                                                setSelectedLine(String(row.line || ""));
                                                setSelectedMonth(String(row.month || ""));
                                                setIsMatrixOpen(true);
                                            }}
                                        >
                                            <td className="p-2 border-b">Skill Matrix</td>
                                            <td className="p-2 border-b">{row.departmentName || row.department || "-"}</td>
                                            <td className="p-2 border-b">{row.lineName || row.line || "-"}</td>
                                            <td className="p-2 border-b">{row.lineLeaderName || "-"}</td>
                                            <td className="p-2 border-b">{row.month || "-"}</td>
                                            <td className="p-2 border-b">
                                                {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "-"}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Skill Matrix Form</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Department</label>
                                <Select value={createDepartment} onValueChange={(val) => { setCreateDepartment(val); setCreateLine(""); }}>
                                    <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                    <SelectContent>
                                        {departmentsData?.data?.departments?.map((d, idx) => (
                                            <SelectItem key={`${d.id || d._id} -${idx} `} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Line</label>
                                <Select value={createLine} onValueChange={setCreateLine} disabled={!createDepartment}>
                                    <SelectTrigger><SelectValue placeholder="Select Line" /></SelectTrigger>
                                    <SelectContent>
                                        {createLinesData?.data?.map((l, idx) => (
                                            <SelectItem key={`${l.id || l._id} -${idx} `} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Month</label>
                                <Input type="month" value={createMonth} onChange={(e) => setCreateMonth(e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateSkillMatrix}>Create</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-black">
            {/* DEBUG INFO - REMOVE AFTER FIXING */}
            {/* DEBUG INFO - REMOVE AFTER FIXING */}
            {/* <div className="bg-red-100 p-2 text-xs border border-red-500 text-red-700 overflow-auto max-h-40">
                <pre>
                    Dept ID: {selectedDepartment}
                    Selected Dept Found: {departmentsData?.data?.departments?.find(d => String(d.id || d._id) === String(selectedDepartment)) ? "Yes" : "No"}
                    Students Count: {departmentsData?.data?.departments?.find(d => String(d.id || d._id) === String(selectedDepartment))?.students?.length || 0}
                    Dept Users Count: {departmentUsers.length}
                    First User: {JSON.stringify(departmentUsers[0])}
                </pre>
            </div> */}
            <style>
                {`
@media print {
    @page { size: landscape; margin: 5mm; }
    body * { visibility: hidden; }
    #printable - matrix, #printable - matrix * { visibility: visible; }
    #printable - matrix { position: absolute; left: 0; top: 0; width: 100 %; }
                        input { border: none!important; background: transparent!important; }
                        .no - print { display: none!important; }
}
`}
            </style>

            {/* Controls */}
            <div className="no-print p-4 bg-white border rounded shadow flex gap-4 items-center">
                <div className="text-sm font-semibold">Department: {selectedDeptName}</div>
                <div className="text-sm font-semibold">Line: {selectedLineName}</div>
                <div className="text-sm font-semibold">Month: {selectedMonth || "-"}</div>
                <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Level" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Levels</SelectItem>
                        {activeConfig?.levels?.map((l, idx) => (
                            <SelectItem key={`${l.name} -${idx} `} value={l.name}>{l.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="ml-auto flex gap-2">
                    <Button variant="outline" onClick={() => setIsMatrixOpen(false)}>Back</Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDashboardHistory}
                        className="gap-2"
                    >
                        <History className="h-4 w-4" />
                        History
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setConfigJson(JSON.stringify(config, null, 2));
                            setIsEditingLayout(true);
                        }}
                        className="gap-2"
                    >
                        <Edit2 className="h-4 w-4" />
                        Edit Layout
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600"><IconDeviceFloppy className="w-4 h-4 mr-2" /> Save Data</Button>
                    <Button onClick={handlePrint} variant="outline"><IconPrinter className="w-4 h-4 mr-2" /> Print</Button>
                    <Button
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => exportToExcel("Skill Matrix Sheet", {
                            departmentId: selectedDepartment,
                            lineId: selectedLine,
                            month: selectedMonth
                        })}
                    >
                        <IconDownload className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Main Table Container */}
            {!selectedLine ? (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                    <p>Please select a Section and Line to generate the Skill Matrix.</p>
                </div>
            ) : isMachinesLoading ? (
                <div className="flex justify-center py-10">
                    <IconLoader className="animate-spin h-8 w-8" />
                </div>
            ) : !machinesData?.data || machinesData.data.length === 0 ? (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-red-50">
                    <p>No machines/stations found for this Line.</p>
                </div>
            ) : (
                <div id="printable-matrix" className="bg-white p-2 min-w-[1200px] overflow-x-auto">
                    <div className="border border-black text-center mb-1">
                        <h1 className="text-xl font-bold uppercase p-1">Skill Matrix</h1>
                    </div>

                    {/* Header Row 1 */}
                    <div className="flex border border-black mb-1">
                        <div className="w-32 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Department</div>
                        <div className="w-48 p-1 font-bold border-r border-black flex items-center justify-center text-lg">{selectedDeptName}</div>
                        <div className="w-24 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Line:</div>
                        <div className="w-48 p-1 font-bold border-r border-black flex items-center justify-center text-lg">{selectedLineName}</div>
                        <div className="w-24 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Shift</div>
                        <div className="w-24 p-1 border-r border-black flex items-center justify-center">
                            <Input className="text-center font-bold text-lg h-8 border-none" value={config.shift || ""} onChange={e => handleConfigChange('shift', e.target.value)} />
                        </div>
                        {/* Signatures */}
                        <div className="flex-1 grid grid-cols-3">
                            <div className="border-r border-black">
                                <div className="text-[9px] border-b border-black text-center">QA In-charge Sign.</div>
                                <div className="text-[10px] p-1 h-8 flex items-center justify-center">Approved</div>
                            </div>
                            <div className="border-r border-black">
                                <div className="text-[9px] border-b border-black text-center">Safety In-charge Sign.</div>
                                <div className="text-[10px] p-1 h-8"></div>
                            </div>
                            <div>
                                <div className="text-[9px] border-b border-black text-center">Process In-charge Sign.</div>
                                <div className="text-[10px] p-1 h-8 flex items-center justify-center">Confirmed</div>
                            </div>
                        </div>
                    </div>

                    {/* Product & Revisions Header */}
                    <div className="flex border border-black mb-1 text-[10px]">
                        {/* Products */}
                        {config.products.map((p, i) => (
                            <div key={`prod - ${i} `} className="flex-1 border-r border-black p-1">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold">Product</span>
                                    <Input className="h-5 p-0 text-[10px] border-b flex-1" value={p || ""} onChange={e => handleArrayConfigChange('products', i, null, e.target.value)} />
                                </div>
                            </div>
                        ))}

                        {/* Revisions Block */}
                        {config.revisions.map((rev, i) => (
                            <div key={`rev - ${i} `} className="flex-[1.5] border-r border-black flex">
                                <div className="flex-1 border-r border-black p-1">
                                    <div className="text-[8px] text-gray-500">Product</div>
                                    <Input className="h-4 p-0 text-[10px]" value={rev.product || ""} onChange={e => handleArrayConfigChange('revisions', i, 'product', e.target.value)} />
                                </div>
                                <div className="flex-1 border-r border-black p-1">
                                    <div className="text-[8px] text-gray-500">Revision</div>
                                    <Input className="h-4 p-0 text-[10px]" value={rev.revision || ""} onChange={e => handleArrayConfigChange('revisions', i, 'revision', e.target.value)} />
                                </div>
                                <div className="flex-1 p-1">
                                    <div className="text-[8px] text-gray-500">Op. date</div>
                                    <Input className="h-4 p-0 text-[10px]" value={rev.date || ""} onChange={e => handleArrayConfigChange('revisions', i, 'date', e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Legend Row */}
                    <div className="border border-black mb-1 p-1 flex flex-wrap items-center gap-4 text-[10px]">
                        <div className="font-bold w-32 min-w-[128px] text-right">Skill Symbol</div>
                        {/* Always show L-0/Under Training */}
                        <div className="flex items-center gap-2">
                            <SkillIcon levelStr="L-0" size={16} /> <span>Under training</span>
                        </div>
                        {/* Dynamic Levels */}
                        {activeConfig?.levels?.map((level, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <SkillIcon levelStr={level.name} size={16} /> <span>{level.description || level.name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Main Table */}
                    <table className="w-full border-collapse border border-black text-[10px]">
                        <thead>
                            {/* Process Responsible Person Row */}
                            <tr>
                                <th colSpan={5} className="border border-black p-1 text-right">Process responsible person</th>
                                <th colSpan={10} className="border border-black p-1 text-left">
                                    <Input className="inline w-32 h-4 p-0 border-b border-dotted" value={config.processPersons?.responsible || ""} onChange={e => handleConfigChange('processPersons.responsible', e.target.value)} />
                                </th>
                                <th colSpan={5} className="border border-black"></th>
                            </tr>
                            {/* Vice Process Row */}
                            <tr>
                                <th colSpan={5} className="border border-black p-1 text-right">Vice process responsible person</th>
                                <th colSpan={15} className="border border-black p-1 text-center flex justify-center gap-10">
                                    <span><Input className="inline w-32 h-4 p-0 border-b border-dotted" value={config.processPersons?.vice || ""} onChange={e => handleConfigChange('processPersons.vice', e.target.value)} /></span>
                                </th>
                                <th colSpan={5} className="border border-black">
                                    <span><Input className="inline w-32 h-4 p-0 border-b border-dotted" value={config.processPersons?.vice2 || ""} onChange={e => handleConfigChange('processPersons.vice2', e.target.value)} /></span>
                                </th>
                            </tr>

                            {/* Main Headers for Stations */}
                            <tr>
                                <th colSpan={5} className="border border-black p-1 text-right">Responsible expert</th>
                                {/* Generated Stations Header (Operators) */}
                                {Array(16).fill(0).map((_, i) => (
                                    <th key={i} className="border border-black w-8 bg-yellow-100 text-[8px] font-normal leading-tight p-0.5">
                                        {i < 16 && "Operator Inspector"}
                                    </th>
                                ))}
                                <th rowSpan={4} className="border border-black bg-yellow-300 w-16">Number of process of per person</th>
                                <th rowSpan={4} className="border border-black bg-yellow-300 w-8">Status</th>
                                <th rowSpan={4} className="border border-black bg-yellow-300 w-8">%</th>
                            </tr>

                            {/* Process Name Row */}
                            <tr>
                                <th colSpan={5} className="border border-black p-1 text-right">Process name</th>
                                {Array(16).fill(0).map((_, i) => {
                                    const machineName = machinesData?.data?.[i]?.name || "";
                                    return (
                                        <th key={i} className="border border-black w-8 h-32 align-bottom p-1">
                                            <div className="flex items-center justify-center [writing-mode:vertical-rl] rotate-270 w-full h-full text-[10px] leading-tight break-words">{machineName}</div>
                                        </th>
                                    )
                                })}
                            </tr>

                            {/* Min Skill Row */}
                            <tr>
                                <th colSpan={5} className="border border-black p-1 text-right">Min.Skill Required</th>
                                {Array(16).fill(0).map((_, i) => {
                                    // Use config minSkills or default to L2
                                    const val = config.minSkills?.[i] || "L2";
                                    return (
                                        <th key={i} className="border border-black w-8">
                                            <Input className="h-4 p-0 text-center text-[10px] bg-transparent border-none" value={val} onChange={e => handleMinSkillChange(i, e.target.value)} />
                                        </th>
                                    )
                                })}
                            </tr>

                            {/* Operation Sharing Row */}
                            <tr>
                                <th colSpan={5} className="border border-black p-1 text-right">Operation sharing ( Station No & equipment name)</th>
                                {Array(16).fill(0).map((_, i) => (
                                    <th key={i} className="border border-black w-8">{i + 1}</th>
                                ))}
                            </tr>

                            {/* Actual User Columns Header */}
                            <tr>
                                <th className="border border-black w-8">Number</th>
                                <th className="border border-black w-32">Operator name</th>
                                <th className="border border-black w-16">Card No.</th>
                                <th className="border border-black w-16 text-[8px]">Year number of experience\nDate of Certificate update</th>
                                <th className="border border-black w-16 text-[8px]">Equipment arrangement number\nPosition number</th>

                                {Array(16).fill(0).map((_, i) => (
                                    <th key={i} className="border border-black w-8">{i + 1}</th>
                                ))}
                                <th className="border border-black w-8">Plan</th>
                                <th className="border border-black w-8">Actual</th>
                                <th className="border border-black" colSpan={2}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {matrixEntries.filter(entry => {
                                if (selectedLevel === "All") return true;
                                return normalizeLevel(entry.level) === normalizeLevel(selectedLevel);
                            }).map((entry, rowIndex) => {
                                // We need to map rowIndex back to original index if we are editing?
                                // handleEntryChange takes rowIdx. If we pass the index from filter map, it will be wrong?
                                // YES. handleEntryChange updates matrixEntries[rowIdx].
                                // The index passed to map here is the index in the FILTERED array.
                                // We need the index in the ORIGINAL matrixEntries array.
                                // Let's find the real index.
                                const originalIndex = matrixEntries.indexOf(entry);
                                return (
                                    <tr key={originalIndex} className="h-10 text-center">
                                        <td className="border border-black font-bold">{entry.srNo}</td>
                                        <td className="border border-black font-bold">{entry.name}</td>
                                        <td className="border border-black">
                                            <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.cardNo} onChange={e => handleEntryChange(originalIndex, 'cardNo', e.target.value)} />
                                        </td>
                                        <td className="border border-black p-0">
                                            <div className="border-b border-black h-5 flex items-center justify-center">
                                                <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.experience} onChange={e => handleEntryChange(originalIndex, 'experience', e.target.value)} />
                                            </div>
                                            <div className="h-5 flex items-center justify-center">
                                                <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.certDate} onChange={e => handleEntryChange(originalIndex, 'certDate', e.target.value)} />
                                            </div>
                                        </td>
                                        <td className="border border-black p-0 bg-yellow-100">
                                            <div className="border-b border-black h-5 bg-white"></div>
                                            <div className="h-5 flex items-center justify-center text-[9px]">
                                                <Input className="h-full w-full p-0 text-center border-none bg-transparent font-bold" value={entry.position} onChange={e => handleEntryChange(originalIndex, 'position', e.target.value)} />
                                            </div>
                                        </td>

                                        {/* Stations */}
                                        {Array(16).fill(0).map((_, i) => {
                                            // Match station by index or ID?
                                            // Let's assume columns 1-16 map to matrixEntries stations
                                            const station = entry.stations[i];
                                            return (
                                                <td key={i} className="border border-black p-0 align-middle">
                                                    {station ? (
                                                        <div className="flex justify-center items-center h-full">
                                                            <SkillIcon levelStr={station.curr} size={24} editable={true} onClick={(l) => handleStationChange(originalIndex, i, l)} />
                                                        </div>
                                                    ) : <div className="bg-gray-100 h-full w-full"></div>}
                                                </td>
                                            )
                                        })}

                                        <td className="border border-black">
                                            <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.plan} onChange={e => handleEntryChange(originalIndex, 'plan', e.target.value)} />
                                        </td>
                                        <td className="border border-black">
                                            <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.actual} onChange={e => handleEntryChange(originalIndex, 'actual', e.target.value)} />
                                        </td>
                                        <td className="border border-black">
                                            <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.status} onChange={e => handleEntryChange(originalIndex, 'status', e.target.value)} />
                                        </td>
                                        <td className="border border-black"></td>
                                    </tr>
                                )
                            })}
                            {/* Fill empty rows to make it look full? Optional */}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colSpan={5} className="border border-black text-right p-1">Plan (No. of skilled manpower)</th>
                                {Array(16).fill(0).map((_, i) => (
                                    <td key={i} className="border border-black font-bold p-0">
                                        <Input className="h-full w-full p-0 text-center text-[10px] bg-transparent border-none font-bold" value={config.footerRows?.plan[i] || ""} onChange={e => handleFooterRowChange("plan", i, e.target.value)} />
                                    </td>
                                ))}
                                <td colSpan={4} className="border border-black"></td>
                            </tr>
                            <tr>
                                <th colSpan={5} className="border border-black text-right p-1">Actual</th>
                                {Array(16).fill(0).map((_, i) => (
                                    <td key={i} className="border border-black font-bold p-0">
                                        <Input className="h-full w-full p-0 text-center text-[10px] bg-transparent border-none font-bold" value={config.footerRows?.actual[i] || ""} onChange={e => handleFooterRowChange("actual", i, e.target.value)} />
                                    </td>
                                ))}
                                <td colSpan={4} className="border border-black"></td>
                            </tr>
                            <tr>
                                <th colSpan={5} className="border border-black text-right p-1">% (Skilled manpower)</th>
                                {Array(16).fill(0).map((_, i) => (
                                    <td key={i} className="border border-black font-bold p-0">
                                        <Input className="h-full w-full p-0 text-center text-[10px] bg-transparent border-none font-bold" value={config.footerRows?.percent[i] || ""} onChange={e => handleFooterRowChange("percent", i, e.target.value)} />
                                    </td>
                                ))}
                                <td colSpan={4} className="border border-black"></td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Footer Info */}
                    <div className="flex justify-between text-[10px] mt-2 border-t border-black pt-1">
                        <div>Date of Certificate/update : {config.documentInfo.revDate}</div>
                        <div>Doc No. {config.documentInfo.docNo}</div>
                        <div>Rev.{config.documentInfo.revNo}</div>
                        <div>Rev Date: {config.documentInfo.revDate}</div>
                        <div>Page: {config.documentInfo.page}</div>
                    </div>
                </div>
            )}

            {/* Edit Dashboard Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Skill Matrix Dashboard Layout</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-hidden border rounded-md">
                            <Textarea
                                className="h-full font-mono text-xs p-4 resize-none focus-visible:ring-0 border-none"
                                value={configJson}
                                onChange={(e) => setConfigJson(e.target.value)}
                                placeholder="Paste JSON configuration here..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Change Remark (mandatory)</Label>
                            <Input
                                placeholder="Reason for change..."
                                value={configRemark}
                                onChange={(e) => setConfigRemark(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingLayout(false)}>Cancel</Button>
                        <Button onClick={handleSaveDashboardConfig} disabled={isDashboardSaving || !configRemark.trim()} className="bg-blue-600 hover:bg-blue-700">
                            {isDashboardSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-[800px] max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Dashboard Layout Change History</DialogTitle>
                    </DialogHeader>
                    <div className="h-[500px] pr-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        <div className="space-y-4">
                            {history.length > 0 ? history.map((h, i) => (
                                <div key={i} className="p-4 border rounded-md space-y-2 hover:bg-gray-50">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-blue-600">{h.updatedBy}</span>
                                        <span className="text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="text-sm font-medium">Remark: {h.remark || 'N/A'}</div>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 h-auto text-xs"
                                        onClick={() => {
                                            setConfigJson(JSON.stringify(h.config, null, 2));
                                            setIsEditingLayout(true);
                                            setShowHistory(false);
                                        }}
                                    >
                                        Use this version
                                    </Button>
                                </div>
                            )) : <div className="text-center py-8 text-gray-400">No history found</div>}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SkillMatrix;
