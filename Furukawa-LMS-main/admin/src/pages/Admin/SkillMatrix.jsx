import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IconPrinter, IconLoader, IconDeviceFloppy, IconDownload } from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetSectionsByDepartmentQuery } from '@/Redux/AllApi/SectionApi';
import { useGetLinesBySectionQuery } from '@/Redux/AllApi/LineApi';
import { useGetSubSectionsByLineQuery } from '@/Redux/AllApi/SubSectionApi';
import { useGetMachinesBySubSectionQuery, useGetMachinesByLineQuery, useGetMachinesBySectionQuery, useGetMachinesByDepartmentQuery } from '@/Redux/AllApi/MachineApi';
import { useGetAllUsersQuery } from '@/Redux/AllApi/UserApi';
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
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedLine, setSelectedLine] = useState("");
    const [selectedSubSection, setSelectedSubSection] = useState("");
    const [selectedStation, setSelectedStation] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedLevel, setSelectedLevel] = useState("All");
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    const [createDepartment, setCreateDepartment] = useState("");
    const [createSection, setCreateSection] = useState("");
    const [createLine, setCreateLine] = useState("");
    const [createSubSection, setCreateSubSection] = useState("");
    const [createStation, setCreateStation] = useState("");
    const [createMonth, setCreateMonth] = useState(new Date().toISOString().slice(0, 7));
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 70;

    // --- Saved Data Fetching ---
    const { data: savedMatrixData, refetch: refetchMatrix } = useGetSkillMatrixQuery({
        departmentId: selectedDepartment,
        sectionId: selectedSection,
        lineId: selectedLine,
        subSectionId: selectedSubSection,
        stationId: selectedStation,
        month: selectedMonth,
    }, {
        skip: !selectedDepartment || !selectedLine || !selectedMonth || !isMatrixOpen
    });

    const { data: matrixListData, isLoading: isMatrixListLoading } = useGetSkillMatrixListQuery({
        departmentId: selectedDepartment || undefined,
        sectionId: selectedSection || undefined,
        lineId: selectedLine || undefined,
        subSectionId: selectedSubSection || undefined,
        stationId: selectedStation || undefined,
        month: selectedMonth || undefined,
    });

    const [saveSkillMatrix, { isLoading: isSaving }] = useSaveSkillMatrixMutation();

    // --- Data Fetching ---
    // --- Hierarchy Data Hooks ---
    const { data: departmentsData } = useGetAllDepartmentsQuery();
    
    // Combined Loader State
    const [isLoading, setIsLoading] = useState(false);

    // Main Filter Data
    const { data: sectionsData } = useGetSectionsByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: linesData } = useGetLinesBySectionQuery(selectedSection, { skip: !selectedSection });
    const { data: subSectionsData } = useGetSubSectionsByLineQuery(selectedLine, { skip: !selectedLine });

    // Machine Fetching Options (fallback through hierarchy)
    const { data: machinesByDepartmentData, isLoading: isDeptMachinesLoading } = useGetMachinesByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment || !!selectedSection });
    const { data: machinesBySectionData, isLoading: isSectMachinesLoading } = useGetMachinesBySectionQuery(selectedSection, { skip: !selectedSection || !!selectedLine });
    const { data: machinesByLineData, isLoading: isLineMachinesLoading } = useGetMachinesByLineQuery(selectedLine, { skip: !selectedLine || !!selectedSubSection });
    const { data: machinesBySubSectionData, isLoading: isSubSectionMachinesLoading } = useGetMachinesBySubSectionQuery(selectedSubSection, { skip: !selectedSubSection });
    
    // Create Form Data
    const { data: createSectionsData } = useGetSectionsByDepartmentQuery(createDepartment, { skip: !createDepartment });
    const { data: createLinesData } = useGetLinesBySectionQuery(createSection, { skip: !createSection });
    const { data: createSubSectionsData } = useGetSubSectionsByLineQuery(createLine, { skip: !createLine });
    const { data: createMachinesData, isLoading: isCreateMachinesLoading } = useGetMachinesBySubSectionQuery(createSubSection, { skip: !createSubSection });
    const { data: createMachinesByLineData } = useGetMachinesByLineQuery(createLine, { skip: !createLine || !!createSubSection });
    const { data: createMachinesBySectData } = useGetMachinesBySectionQuery(createSection, { skip: !createSection || !!createLine });
    const { data: createMachinesByDeptData } = useGetMachinesByDepartmentQuery(createDepartment, { skip: !createDepartment || !!createSection });

    const isMachinesLoading = isDeptMachinesLoading || isSectMachinesLoading || isLineMachinesLoading || isSubSectionMachinesLoading;

    // Fetch users for matrix based on hierarchy
    const { data: usersData } = useGetAllUsersQuery({
        departmentId: selectedDepartment,
        sectionId: selectedSection,
        lineId: selectedLine,
        subSectionId: selectedSubSection,
        // stationId removed to prevent UI clearing when filtering by station (users aren't linked to stations)
        role: "Student",
        limit: 1000
    }, { skip: !selectedDepartment || !isMatrixOpen });

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
        return usersData?.data?.users || [];
    }, [usersData]);

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
        // Reset pagination when selection changes
        setCurrentPage(1);

        if (selectedDepartment && !isMachinesLoading) {
            const activeMachines = activeMachinesRef;
            // If we have a department but NO machines at all, we can't show a matrix
            if (activeMachines.length === 0) {
                setMatrixEntries([]);
                return;
            }
            
            const savedEntries = savedMatrixData?.data?.entries || [];

            // 1. Map Users
            const mappedData = departmentUsers.map((user, index) => {
                const savedUserEntry = savedEntries.find(e => String(e.userId) === String(user._id || user.id));
                // Default stations
                const defaultStations = activeMachines.map(machine => ({
                    _id: machine._id || machine.id,
                    name: machine.name,
                    critical: "Non-Critical",
                    min: "L-1",
                    curr: user.level || "L-1", // Use user level default
                }));

                const mergedStations = activeMachines.map(machine => {
                    const savedStation = savedUserEntry?.stations?.find(s => String(s.machineId) === String(machine._id || machine.id));
                    return {
                        _id: machine._id || machine.id,
                        name: machine.name,
                        critical: savedStation?.critical || "Non-Critical",
                        min: savedStation?.min || "L-1",
                        curr: savedStation?.curr || user.level || "L-1",
                    };
                });

                // Calculate Actual
                const actualCount = mergedStations.reduce((acc, s) => {
                    return acc + (s.curr !== 'L-0' && s.curr ? 1 : 0);
                }, 0);

                return {
                    srNo: index + 1,
                    _id: user._id || user.id,
                    name: user.fullName || "Unknown",
                    cardNo: savedUserEntry?.cardNo || user.empId || "", 
                    experience: savedUserEntry?.experience || (() => {
                        if (!user.createdAt) return "";
                        const start = new Date(user.createdAt);
                        const now = new Date();
                        const diffInMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                        const years = Math.floor(diffInMonths / 12);
                        const months = diffInMonths % 12;
                        return `${years}.${months}`;
                    })(),
                    certDate: savedUserEntry?.certDate || "",
                    position: savedUserEntry?.position || "1.1",
                    stations: savedUserEntry ? mergedStations : defaultStations,
                    plan: savedUserEntry?.plan ?? activeMachines.length, 
                    actual: savedUserEntry?.actual ?? actualCount,       
                    status: savedUserEntry?.status || "OK",
                    isManual: false,
                    level: user.level 
                };
            }).filter(Boolean);

            // 2. Manual Rows
            const manualRows = savedEntries.filter(e => e.isManual).map((entry, idx) => {
                const mergedStations = activeMachines.map(machine => {
                    const savedStation = entry.stations?.find(s => String(s.machineId) === String(machine._id || machine.id));
                    return {
                        _id: machine._id || machine.id,
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
                setConfig(prev => ({
                    ...prev,
                    ...savedMatrixData.data.footerInfo.config,
                    footerRows: savedMatrixData.data.footerInfo.config.footerRows || prev.footerRows,
                    minSkills: savedMatrixData.data.footerInfo.config.minSkills || prev.minSkills
                }));
            }
        } else if (!selectedDepartment) {
            setMatrixEntries([]);
        }
    }, [selectedDepartment, selectedSection, selectedLine, selectedSubSection, selectedStation, machinesByLineData, machinesBySubSectionData, machinesBySectionData, machinesByDepartmentData, departmentUsers, savedMatrixData, isMachinesLoading]);

    const handleSave = async () => {
        if (!selectedDepartment || !selectedMonth) {
            toast.error("Please select Department and Month first");
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
                section: selectedSection,
                line: selectedLine,
                subSection: selectedSubSection,
                station: selectedStation,
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

    const activeMachinesRef = React.useMemo(() => {
        let base = [];
        if (selectedSubSection) base = machinesBySubSectionData?.data || [];
        else if (selectedLine) base = machinesByLineData?.data || [];
        else if (selectedSection) base = machinesBySectionData?.data || [];
        else if (selectedDepartment) base = machinesByDepartmentData?.data || [];

        if (selectedStation && selectedStation !== "All") {
            return base.filter(m => String(m._id || m.id) === String(selectedStation));
        }
        return base;
    }, [selectedSubSection, selectedLine, selectedSection, selectedDepartment, selectedStation, machinesBySubSectionData, machinesByLineData, machinesBySectionData, machinesByDepartmentData]);

    const filteredAndSortedEntries = React.useMemo(() => {
        return matrixEntries.filter(entry => {
            if (selectedLevel === "All") return true;
            return normalizeLevel(entry.level) === normalizeLevel(selectedLevel);
        });
    }, [matrixEntries, selectedLevel]);

    const totalPages = Math.ceil(filteredAndSortedEntries.length / itemsPerPage);
    const paginatedEntries = React.useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedEntries.slice(start, start + itemsPerPage);
    }, [filteredAndSortedEntries, currentPage, itemsPerPage]);

    const PaginationControls = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-center gap-4 py-4 no-print bg-white border-t border-b mb-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <div className="text-sm font-medium">
                    Page {currentPage} of {totalPages} ({filteredAndSortedEntries.length} operators)
                </div>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                >
                    Next
                </Button>
            </div>
        );
    };

    const selectedDeptName = departmentsData?.data?.departments?.find(d => String(d.id || d._id) === String(selectedDepartment))?.name || "Select";
    const selectedLineName = linesData?.data?.find(l => String(l.id || l._id) === String(selectedLine))?.name || "Select";

    const handleCreateSkillMatrix = () => {
        if (!createDepartment || !createMonth) {
            toast.error("Please select Department and Month");
            return;
        }
        setSelectedDepartment(createDepartment);
        setSelectedSection(createSection);
        setSelectedLine(createLine);
        setSelectedSubSection(createSubSection);
        setSelectedStation(createStation);
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
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Saved Skill Matrix Sheets</h2>
                        <Button variant="ghost" size="sm" onClick={() => {
                            setSelectedDepartment("");
                            setSelectedSection("");
                            setSelectedLine("");
                            setSelectedSubSection("");
                            setSelectedStation("");
                            setSelectedMonth("");
                        }} className="text-blue-600 hover:text-blue-700 h-auto p-0">Clear Filters</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Department</label>
                            <Select value={selectedDepartment} onValueChange={(val) => { 
                                setSelectedDepartment(val); 
                                setSelectedSection(""); 
                                setSelectedLine(""); 
                                setSelectedSubSection(""); 
                                setSelectedStation(""); 
                            }}>
                                <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Departments" /></SelectTrigger>
                                <SelectContent>
                                    {departmentsData?.data?.departments?.map((d, idx) => (
                                        <SelectItem key={`${d.id || d._id}-${idx}`} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Section</label>
                            <Select value={selectedSection} onValueChange={(val) => { 
                                setSelectedSection(val); 
                                setSelectedLine(""); 
                                setSelectedSubSection(""); 
                                setSelectedStation(""); 
                            }} disabled={!selectedDepartment}>
                                <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Sections" /></SelectTrigger>
                                <SelectContent>
                                    {sectionsData?.data?.map((s, idx) => (
                                        <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Line</label>
                            <Select value={selectedLine} onValueChange={(val) => { 
                                setSelectedLine(val); 
                                setSelectedSubSection(""); 
                                setSelectedStation(""); 
                            }} disabled={!selectedSection}>
                                <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Lines" /></SelectTrigger>
                                <SelectContent>
                                    {linesData?.data?.map((l, idx) => (
                                        <SelectItem key={`${l.id || l._id}-${idx}`} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Sub-Section</label>
                            <Select value={selectedSubSection} onValueChange={(val) => { 
                                setSelectedSubSection(val); 
                                setSelectedStation(""); 
                            }} disabled={!selectedLine}>
                                <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Sub-Sections" /></SelectTrigger>
                                <SelectContent>
                                    {subSectionsData?.data?.map((ss, idx) => (
                                        <SelectItem key={`${ss.id || ss._id}-${idx}`} value={String(ss.id || ss._id)}>{ss.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Station</label>
                            <Select value={selectedStation} onValueChange={setSelectedStation} disabled={!selectedLine}>
                                <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Stations" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Stations</SelectItem>
                                    {(activeMachinesRef || []).map((m, idx) => (
                                        <SelectItem key={`${m.id || m._id}-${idx}`} value={String(m.id || m._id)}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase font-bold text-gray-500 mb-1 block">Month</label>
                            <Input className="h-8 text-xs" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                        </div>
                    </div>

                    <div className="border rounded overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-[11px] uppercase font-bold text-gray-600">
                                <tr>
                                    <th className="p-3 border-b">Type</th>
                                    <th className="p-3 border-b">Department</th>
                                    <th className="p-3 border-b">Section</th>
                                    <th className="p-3 border-b">Line</th>
                                    <th className="p-3 border-b">Sub-Section</th>
                                    <th className="p-3 border-b">Station</th>
                                    <th className="p-3 border-b">User Count</th>
                                    <th className="p-3 border-b">Month</th>
                                    <th className="p-3 border-b">Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isMatrixListLoading ? (
                                    <tr><td className="p-4 text-center text-muted-foreground" colSpan={9}>Loading...</td></tr>
                                ) : matrixList.length === 0 ? (
                                    <tr>
                                        <td className="p-4 text-center text-muted-foreground" colSpan={9}>
                                            No skill matrix forms found for selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    matrixList.map((row, idx) => (
                                        <tr
                                            key={row.id || idx}
                                            className="hover:bg-muted/30 cursor-pointer text-[11px]"
                                            onClick={() => {
                                                setSelectedDepartment(String(row.department || ""));
                                                setSelectedSection(String(row.section || ""));
                                                setSelectedLine(String(row.line || ""));
                                                setSelectedSubSection(String(row.subSection || ""));
                                                setSelectedStation(String(row.station || ""));
                                                setSelectedMonth(String(row.month || ""));
                                                setIsMatrixOpen(true);
                                            }}
                                        >
                                            <td className="p-2 border-b">Skill Matrix</td>
                                            <td className="p-2 border-b">{row.departmentName || "-"}</td>
                                            <td className="p-2 border-b">{row.sectionName || "-"}</td>
                                            <td className="p-2 border-b">{row.lineName || "-"}</td>
                                            <td className="p-2 border-b">{row.subSectionName || "-"}</td>
                                            <td className="p-2 border-b">{row.stationName || "All"}</td>
                                            <td className="p-2 border-b font-bold text-blue-600">{row.userCount || 0}</td>
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
                                <Select value={createDepartment} onValueChange={(val) => { 
                                    setCreateDepartment(val); 
                                    setCreateSection(""); 
                                    setCreateLine(""); 
                                    setCreateSubSection(""); 
                                    setCreateStation(""); 
                                }}>
                                    <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                    <SelectContent>
                                        {departmentsData?.data?.departments?.map((d, idx) => (
                                            <SelectItem key={`${d.id || d._id}-${idx}`} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Section</label>
                                <Select value={createSection} onValueChange={(val) => { 
                                    setCreateSection(val); 
                                    setCreateLine(""); 
                                    setCreateSubSection(""); 
                                    setCreateStation(""); 
                                }} disabled={!createDepartment}>
                                    <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                                    <SelectContent>
                                        {createSectionsData?.data?.map((s, idx) => (
                                            <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Line</label>
                                <Select value={createLine} onValueChange={(val) => { 
                                    setCreateLine(val); 
                                    setCreateSubSection(""); 
                                    setCreateStation(""); 
                                }} disabled={!createSection}>
                                    <SelectTrigger><SelectValue placeholder="Select Line" /></SelectTrigger>
                                    <SelectContent>
                                        {createLinesData?.data?.map((l, idx) => (
                                            <SelectItem key={`${l.id || l._id}-${idx}`} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Sub-Section</label>
                                <Select value={createSubSection} onValueChange={(val) => { 
                                    setCreateSubSection(val); 
                                    setCreateStation(""); 
                                }} disabled={!createLine}>
                                    <SelectTrigger><SelectValue placeholder="Select Sub-Section" /></SelectTrigger>
                                    <SelectContent>
                                        {createSubSectionsData?.data?.map((ss, idx) => (
                                            <SelectItem key={`${ss.id || ss._id}-${idx}`} value={String(ss.id || ss._id)}>{ss.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Station</label>
                                <Select value={createStation} onValueChange={setCreateStation} disabled={!createLine}>
                                    <SelectTrigger><SelectValue placeholder="All Stations" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Stations</SelectItem>
                                        {((createSubSection ? createMachinesData?.data : createMachinesByLineData?.data) || []).map((m, idx) => (
                                            <SelectItem key={`${m.id || m._id}-${idx}`} value={String(m.id || m._id)}>{m.name}</SelectItem>
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
            <div className="no-print p-3 bg-white border rounded shadow flex flex-wrap gap-4 items-end">
                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Dept</label>
                    <span className="text-sm font-bold bg-gray-50 px-2 py-1 rounded border">{selectedDeptName}</span>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Section</label>
                    <Select value={selectedSection || "all-sections"} onValueChange={(val) => { 
                        setSelectedSection(val === "all-sections" ? "" : val); 
                        setSelectedLine(""); 
                        setSelectedSubSection(""); 
                        setSelectedStation(""); 
                    }}>
                        <SelectTrigger className="h-8 text-xs min-w-[120px] font-semibold"><SelectValue placeholder="All Sections" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all-sections">All Sections</SelectItem>
                            {sectionsData?.data?.map((s, idx) => (
                                <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Line</label>
                    <Select value={selectedLine || "all-lines"} onValueChange={(val) => { 
                        setSelectedLine(val === "all-lines" ? "" : val); 
                        setSelectedSubSection(""); 
                        setSelectedStation(""); 
                    }} disabled={!selectedSection}>
                        <SelectTrigger className="h-8 text-xs min-w-[120px] font-semibold"><SelectValue placeholder="All Lines" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all-lines">All Lines</SelectItem>
                            {linesData?.data?.map((l, idx) => (
                                <SelectItem key={`${l.id || l._id}-${idx}`} value={String(l.id || l._id)}>{l.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Sub-Section</label>
                    <Select value={selectedSubSection || "all-subsections"} onValueChange={(val) => { 
                        setSelectedSubSection(val === "all-subsections" ? "" : val); 
                        setSelectedStation(""); 
                    }} disabled={!selectedLine}>
                        <SelectTrigger className="h-8 text-xs min-w-[120px] font-semibold"><SelectValue placeholder="All Sub-Sections" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all-subsections">All Sub-Sections</SelectItem>
                            {subSectionsData?.data?.map((ss, idx) => (
                                <SelectItem key={`${ss.id || ss._id}-${idx}`} value={String(ss.id || ss._id)}>{ss.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Station</label>
                    <Select value={selectedStation} onValueChange={setSelectedStation} disabled={!selectedLine}>
                        <SelectTrigger className="h-8 text-xs min-w-[120px] font-semibold"><SelectValue placeholder="All Stations" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Stations</SelectItem>
                            {(activeMachinesRef || []).map((m, idx) => (
                                <SelectItem key={`${m.id || m._id}-${idx}`} value={String(m.id || m._id)}>{m.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Filter Level</label>
                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                        <SelectTrigger className="h-8 text-xs w-32 font-semibold"><SelectValue placeholder="All Levels" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Levels</SelectItem>
                            {activeConfig?.levels?.map((l, idx) => (
                                <SelectItem key={`${l.name} -${idx} `} value={l.name}>{l.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Month</label>
                    <Input className="h-8 text-xs font-bold w-32" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                </div>
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
                            sectionId: selectedSection,
                            lineId: selectedLine,
                            subSectionId: selectedSubSection,
                            stationId: selectedStation,
                            month: selectedMonth
                        })}
                    >
                        <IconDownload className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Main Table Container */}
            {!selectedDepartment || !selectedMonth ? (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                    <p>Please select a Department and Month to generate the Skill Matrix.</p>
                </div>
            ) : isMachinesLoading ? (
                <div className="flex justify-center py-10">
                    <IconLoader className="animate-spin h-8 w-8" />
                </div>
            ) : !activeMachinesRef || activeMachinesRef.length === 0 ? (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-red-50">
                    <p>No machines/stations found for this selection.</p>
                </div>
            ) : (
                <div id="printable-matrix" className="bg-white p-2 min-w-[1200px] overflow-x-auto">
                    <PaginationControls />
                    <div className="border border-black text-center mb-1">
                        <h1 className="text-xl font-bold uppercase p-1">Skill Matrix</h1>
                    </div>

                    {/* Header Row 1 */}
                    <div className="flex border border-black mb-1 text-[10px]">
                        <div className="flex-1 flex border-r border-black">
                            <div className="w-20 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Dept</div>
                            <div className="flex-1 p-1 font-bold flex items-center justify-center">{selectedDeptName}</div>
                        </div>
                        <div className="flex-1 flex border-r border-black">
                            <div className="w-20 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Section</div>
                            <div className="flex-1 p-1 font-bold flex items-center justify-center">
                                {sectionsData?.data?.find(s => String(s.id || s._id) === String(selectedSection))?.name || "All"}
                            </div>
                        </div>
                        <div className="flex-1 flex border-r border-black">
                            <div className="w-20 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Line</div>
                            <div className="flex-1 p-1 font-bold flex items-center justify-center">{selectedLineName || "All"}</div>
                        </div>
                        <div className="flex-1 flex border-r border-black">
                            <div className="w-24 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Sub-Sect</div>
                            <div className="flex-1 p-1 font-bold flex items-center justify-center">
                                {subSectionsData?.data?.find(ss => String(ss.id || ss._id) === String(selectedSubSection))?.name || "All"}
                            </div>
                        </div>
                        <div className="w-24 flex border-r border-black">
                            <div className="w-10 font-bold p-1 bg-gray-50 flex items-center justify-center border-r border-black">Shift</div>
                            <div className="flex-1 flex items-center justify-center">
                                <Input className="text-center font-bold text-xs h-6 border-none" value={config.shift || ""} onChange={e => handleConfigChange('shift', e.target.value)} />
                            </div>
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
                                    const machineName = activeMachinesRef?.[i]?.name || "";
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
                            {paginatedEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={25} className="p-10 text-center text-gray-500 italic border border-black bg-gray-50">
                                        {isMachinesLoading || !usersData ? "Establishing connection and fetching operators hierarchy..." : "No operators found for the selected hierarchy filters."}
                                    </td>
                                </tr>
                            ) : (
                                paginatedEntries.map((entry, rowIndex) => {
                                    const originalIndex = matrixEntries.indexOf(entry);
                                    return (
                                        <tr key={originalIndex} className="h-10 text-center border border-black hover:bg-gray-50">
                                            <td className="border border-black font-bold">{entry.srNo}</td>
                                            <td className="border border-black font-bold text-left px-1">{entry.name}</td>
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
                                            <td className="border border-black font-bold bg-gray-50">{entry.actual}</td>
                                            <td className="border border-black">
                                                <Input className="h-full w-full p-0 text-center border-none bg-transparent font-bold" value={entry.status} onChange={e => handleEntryChange(originalIndex, 'status', e.target.value)} />
                                            </td>
                                            <td className="border border-black font-bold text-blue-600">
                                                {((entry.actual / (entry.plan || 1)) * 100).toFixed(0)}%
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
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

                    <div className="no-print mt-6">
                        <PaginationControls />
                    </div>

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
