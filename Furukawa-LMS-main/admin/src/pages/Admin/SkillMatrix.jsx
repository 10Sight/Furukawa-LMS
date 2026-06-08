import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { useSelector } from 'react-redux';
import { IconPrinter, IconLoader, IconDeviceFloppy, IconDownload, IconPhoto, IconX, IconMail } from "@tabler/icons-react";
import { toPng } from 'html-to-image';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SkillMatrixCertificate from "@/components/admin/SkillMatrixCertificate";
import Cycle10 from "./Cycle10";
import OperatorObservanceSheet from "@/components/admin/OperatorObservanceSheet";
import TestPaper from "./TestPaper";
import OnJobTraining from "./OnJobTraining";
import HandoverSheetPage from "./HandoverSheetPage";
import SixteenDayMonitoring from "./SixteenDayMonitoring";
import SkillUpgradationWrapper from "../../components/departments/SkillUpgradationWrapper";


// Helper to normalize level string for comparison
const normalizeLevel = (levelStr) => {
    if (!levelStr) return "";
    return levelStr.replace('-', '');
};

const getLevelWeight = (levelStr) => {
    if (!levelStr) return 0;
    const match = levelStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
};

const ConditionalTabs = ({ isEmbedded, activeTab, setActiveTab, children }) => {
    if (isEmbedded) {
        return <div className="w-full">{children}</div>;
    }
    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {children}
        </Tabs>
    );
};

const ConditionalTabsContent = ({ isEmbedded, value, className, children }) => {
    if (isEmbedded) {
        return value === "skillMatrix" ? <div className={className}>{children}</div> : null;
    }
    return (
        <TabsContent value={value} className={className}>
            {children}
        </TabsContent>
    );
};

const SkillMatrix = ({ isEmbedded = false, onOperatorClick }) => {
    const isEmbeddedView = isEmbedded === true || isEmbedded === "true";
    const componentRef = useRef();
    const tableRef = useRef(null);
    const [searchParams] = useSearchParams();
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedLine, setSelectedLine] = useState("");
    const [selectedSubSection, setSelectedSubSection] = useState("");
    const [selectedStation, setSelectedStation] = useState("");
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedLevel, setSelectedLevel] = useState("All");
    const [isMatrixOpen, setIsMatrixOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(isEmbeddedView ? "skillMatrix" : "handoverSheet");
    const [selectedOperatorForEval, setSelectedOperatorForEval] = useState(null);
    const [evaluationSheets, setEvaluationSheets] = useState([]);
    const [selectedSheetId, setSelectedSheetId] = useState(null);
    const [isSheetsLoading, setIsSheetsLoading] = useState(false);

    const fetchEvaluationSheets = async (studentId) => {
        if (!studentId) return;
        try {
            setIsSheetsLoading(true);
            const response = await axiosInstance.get(`/api/skill-matrix/evaluation/${studentId}/sheets`);
            if (response.data.success) {
                setEvaluationSheets(response.data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch evaluation sheets list:", error);
        } finally {
            setIsSheetsLoading(false);
        }
    };

    useEffect(() => {
        if (selectedOperatorForEval) {
            fetchEvaluationSheets(selectedOperatorForEval);
            setSelectedSheetId(null);
        } else {
            setEvaluationSheets([]);
            setSelectedSheetId(null);
        }
    }, [selectedOperatorForEval]);

    const handleCreateNewSheetFromList = async () => {
        if (!selectedOperatorForEval) return;
        try {
            const response = await axiosInstance.post(`/api/skill-matrix/evaluation/${selectedOperatorForEval}/sheet/create`, {
                departmentId: evalDepartment || selectedDepartment
            });
            if (response.data.success && response.data.data) {
                const newSheet = response.data.data;
                toast.success(`Sheet ${newSheet.sheetIndex} (${newSheet.period}) created successfully!`);
                setSelectedSheetId(newSheet.id);
                fetchEvaluationSheets(selectedOperatorForEval);
            }
        } catch (error) {
            console.error("Failed to create new sheet:", error);
            toast.error("Failed to create new evaluation sheet");
        }
    };

    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        if (isEmbeddedView) {
            setActiveTab("skillMatrix");
        }
    }, [isEmbeddedView]);

    const [createDepartment, setCreateDepartment] = useState("");
    const [createSection, setCreateSection] = useState("");
    const [createLine, setCreateLine] = useState("");
    const [createSubSection, setCreateSubSection] = useState("");
    const [createStation, setCreateStation] = useState("");
    const [createMonth, setCreateMonth] = useState(new Date().toISOString().slice(0, 7));

    const [evalDepartment, setEvalDepartment] = useState("");
    const [evalSection, setEvalSection] = useState("");
    const [evalLine, setEvalLine] = useState("");
    const [evalSubSection, setEvalSubSection] = useState("");
    const [evalSearchText, setEvalSearchText] = useState("");

    // Observance Finder State
    const [observanceDepartment, setObservanceDepartment] = useState("");
    const [observanceSection, setObservanceSection] = useState("");
    const [observanceLine, setObservanceLine] = useState("");
    const [observanceSubSection, setObservanceSubSection] = useState("");
    const [observanceStation, setObservanceStation] = useState("");
    const [observanceSearchText, setObservanceSearchText] = useState("");
    const [selectedOperatorForObservance, setSelectedOperatorForObservance] = useState(null);

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
        skip: !selectedDepartment || !selectedMonth || !isMatrixOpen
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

    // Evaluation Form Data
    const { data: evalSectionsData } = useGetSectionsByDepartmentQuery(evalDepartment, { skip: !evalDepartment });
    const { data: evalLinesData } = useGetLinesBySectionQuery(evalSection, { skip: !evalSection });
    const { data: evalSubSectionsData } = useGetSubSectionsByLineQuery(evalLine, { skip: !evalLine });

    // Fetch users for evaluation search based on evaluation hierarchy
    const { data: evalUsersData } = useGetAllUsersQuery({
        departmentId: evalDepartment || undefined,
        sectionId: evalSection || undefined,
        lineId: evalLine || undefined,
        subSectionId: evalSubSection || undefined,
        role: "STUDENT,CUSTOM",
        includeTemporary: "true",
        limit: 1000
    }, { skip: !evalDepartment });

    // Client-side filter for searched users
    const filteredEvalUsers = React.useMemo(() => {
        const users = evalUsersData?.data?.users || [];
        if (!evalSearchText.trim()) return users;
        const searchLower = evalSearchText.toLowerCase();
        return users.filter(u =>
            (u.fullName || u.name || "").toLowerCase().includes(searchLower) ||
            (u.cardNo || u.empId || "").toLowerCase().includes(searchLower)
        );
    }, [evalUsersData, evalSearchText]);

    // Observance Form Data
    const { data: observanceSectionsData } = useGetSectionsByDepartmentQuery(observanceDepartment, { skip: !observanceDepartment });
    const { data: observanceLinesData } = useGetLinesBySectionQuery(observanceSection, { skip: !observanceSection });
    const { data: observanceSubSectionsData } = useGetSubSectionsByLineQuery(observanceLine, { skip: !observanceLine });

    // Independent machine/station queries for Observance finder
    const { data: obsMachinesByDepartmentData } = useGetMachinesByDepartmentQuery(observanceDepartment, { skip: !observanceDepartment || !!observanceSection });
    const { data: obsMachinesBySectionData } = useGetMachinesBySectionQuery(observanceSection, { skip: !observanceSection || !!observanceLine });
    const { data: obsMachinesByLineData } = useGetMachinesByLineQuery(observanceLine, { skip: !observanceLine || !!observanceSubSection });
    const { data: obsMachinesBySubSectionData } = useGetMachinesBySubSectionQuery(observanceSubSection, { skip: !observanceSubSection });

    const activeObservanceMachines = React.useMemo(() => {
        let base = [];
        if (observanceSubSection) base = obsMachinesBySubSectionData?.data || [];
        else if (observanceLine) base = obsMachinesByLineData?.data || [];
        else if (observanceSection) base = obsMachinesBySectionData?.data || [];
        else if (observanceDepartment) base = obsMachinesByDepartmentData?.data || [];
        return base;
    }, [observanceDepartment, observanceSection, observanceLine, observanceSubSection, obsMachinesBySubSectionData, obsMachinesByLineData, obsMachinesBySectionData, obsMachinesByDepartmentData]);

    // Fetch users for observance search based on observance hierarchy
    const { data: observanceUsersData } = useGetAllUsersQuery({
        departmentId: observanceDepartment || undefined,
        sectionId: observanceSection || undefined,
        lineId: observanceLine || undefined,
        subSectionId: observanceSubSection || undefined,
        role: "STUDENT,CUSTOM",
        includeTemporary: "true",
        limit: 1000
    }, { skip: !observanceDepartment });

    // Client-side filter and station filtering for searched observance users
    const filteredObservanceUsers = React.useMemo(() => {
        let users = observanceUsersData?.data?.users || [];

        // Filter by search text
        if (observanceSearchText.trim()) {
            const searchLower = observanceSearchText.toLowerCase();
            users = users.filter(u =>
                (u.fullName || u.name || "").toLowerCase().includes(searchLower) ||
                (u.cardNo || u.empId || "").toLowerCase().includes(searchLower)
            );
        }

        // Filter by selected station if selected
        if (observanceStation && observanceStation !== "All" && observanceStation !== "undefined") {
            const observanceMachine = activeObservanceMachines.find(m => String(m._id || m.id) === String(observanceStation));
            const subSecId = observanceMachine?.subSectionId;
            users = users.filter(u => {
                const hasSkill = u.currentSkill && subSecId && u.currentSkill[String(subSecId)] !== undefined;
                const hasAssignment = u.assignments && u.assignments.some(a => String(a.machineId || a.machine || a) === String(observanceStation));
                return hasSkill || hasAssignment;
            });
        }

        return users;
    }, [observanceUsersData, observanceSearchText, observanceStation]);

    const isMachinesLoading = isDeptMachinesLoading || isSectMachinesLoading || isLineMachinesLoading || isSubSectionMachinesLoading;

    // Fetch users for matrix based on hierarchy
    const { data: usersData } = useGetAllUsersQuery({
        departmentId: selectedDepartment,
        sectionId: selectedSection,
        lineId: selectedLine,
        subSectionId: selectedSubSection,
        // stationId removed to prevent UI clearing when filtering by station (users aren't linked to stations)
        role: "STUDENT,CUSTOM",
        includeTemporary: "true",
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
        plannedHeader: "",
        documentInfo: { docNo: "FRM-WH-PR-009", revNo: "02", revDate: "02.05.2022", page: "1 of 1" },
        // Footer Rows Data (Arrays for 16 columns)
        footerRows: {
            numPersonPlan: Array(16).fill(""),
            numPersonActual: Array(16).fill(""),
            statusRow: Array(16).fill(""),
            planMonths: Array(12).fill(""),
            actualMonths: Array(12).fill(""),
            percentMonths: Array(12).fill(""),
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
        const dept = searchParams.get('dept');
        const sect = searchParams.get('section');
        const line = searchParams.get('line');
        const sub = searchParams.get('subSection');
        const stn = searchParams.get('station');
        const mon = searchParams.get('month');

        if (dept) setSelectedDepartment(dept);
        if (sect) setSelectedSection(sect);
        if (line) setSelectedLine(line);
        if (sub) setSelectedSubSection(sub);
        if (stn) setSelectedStation(stn);
        if (mon) setSelectedMonth(mon);

        // If we have minimum required filters, open the matrix automatically
        if (dept && line && mon) {
            setIsMatrixOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        if (selectedDepartment) {
            fetchDashboardConfig();
        }
    }, [selectedDepartment]);

    useEffect(() => {
        setSelectedOperatorForEval(null);
    }, [selectedDepartment, selectedSection, selectedLine, selectedSubSection]);

    useEffect(() => {
        setSelectedOperatorForObservance(null);
    }, [observanceDepartment, observanceSection, observanceLine, observanceSubSection, observanceStation]);

    useEffect(() => {
        const actualOps = matrixEntries.filter(e => !e.isManual);
        if (actualOps.length > 0 && !selectedOperatorForEval) {
            setSelectedOperatorForEval(actualOps[0]._id);
        }
    }, [matrixEntries, selectedOperatorForEval]);

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
                    curr: user.currentSkill?.[String(machine.subSectionId)] || user.currentLevel || null, // Use user skill if available, else global level
                }));

                const mergedStations = activeMachines.map(machine => {
                    const savedStation = savedUserEntry?.stations?.find(s => String(s.machineId) === String(machine._id || machine.id));
                    return {
                        _id: machine._id || machine.id,
                        name: machine.name,
                        critical: savedStation?.critical || "Non-Critical",
                        min: savedStation?.min || "L-1",
                        curr: (savedStation?.curr && savedStation.curr !== "L-1")
                            ? savedStation.curr
                            : (user.currentSkill?.[String(machine.subSectionId)] || user.currentLevel || null),
                    };
                });

                // Calculate Actual
                const actualCount = mergedStations.reduce((acc, s) => {
                    return acc + (s.curr !== 'L-0' && s.curr !== '-' && s.curr ? 1 : 0);
                }, 0);

                return {
                    srNo: index + 1,
                    _id: user._id || user.id,
                    name: user.fullName || "Unknown",
                    cardNo: savedUserEntry?.cardNo || user.empId || "",
                    experience: savedUserEntry?.experience || (() => {
                        const start = user.joiningDate ? new Date(user.joiningDate) : (user.createdAt ? new Date(user.createdAt) : null);
                        if (!start || isNaN(start.getTime())) return "";
                        const now = new Date();
                        const diffInMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                        if (diffInMonths <= 0) return "0.0";
                        const years = Math.floor(diffInMonths / 12);
                        const months = diffInMonths % 12;
                        return `${years}.${months}`;
                    })(),
                    certDate: savedUserEntry?.certDate || (() => {
                        if (!user.updatedAt) return "";
                        const dateObj = new Date(user.updatedAt);
                        return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
                    })(),
                    position: savedUserEntry?.position || "",
                    stations: savedUserEntry ? mergedStations : defaultStations,
                    plan: savedUserEntry?.plan ?? "",
                    actual: savedUserEntry?.actual ?? "",
                    status: savedUserEntry?.status || "OK",
                    isManual: false,
                    level: user.currentLevel,
                    assignments: user.assignments || []
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
                    plan: entry.plan ?? "",
                    actual: entry.actual ?? "",
                    status: entry.status || "OK"
                };
            });

            setMatrixEntries([...mappedData, ...manualRows]);

            // Load Config
            if (savedMatrixData?.data?.footerInfo?.config) {
                setConfig(prev => ({
                    ...prev,
                    ...savedMatrixData.data.footerInfo.config,
                    footerRows: {
                        ...prev.footerRows,
                        ...(savedMatrixData.data.footerInfo.config.footerRows || {})
                    },
                    minSkills: savedMatrixData.data.footerInfo.config.minSkills || prev.minSkills
                }));
            }
        } else if (!selectedDepartment) {
            setMatrixEntries([]);
        }
    }, [selectedDepartment, selectedSection, selectedLine, selectedSubSection, selectedStation, machinesByLineData, machinesBySubSectionData, machinesBySectionData, machinesByDepartmentData, departmentUsers, savedMatrixData, isMachinesLoading]);

    const handleSave = async (shouldSendEmail = false) => {
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
                sendEmail: shouldSendEmail,
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
                [type]: (prev.footerRows[type] || Array(16).fill("")).map((val, i) => i === index ? value : val)
            }
        }));
    };

    const handleEntryChange = (rowIdx, field, value) => {
        const updated = [...matrixEntries];
        updated[rowIdx] = { ...updated[rowIdx], [field]: value };
        setMatrixEntries(updated);
    }



    const handleStationChange = (rowIdx, stationIdx, level) => {
        const updated = [...matrixEntries];
        updated[rowIdx].stations[stationIdx].curr = level;

        // Update certificate date to today
        const currentDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
        updated[rowIdx].certDate = currentDateStr;

        setMatrixEntries(updated);
    };

    const handleSubSectionSkillChange = (rowIdx, groupIdx, level) => {
        const group = groupedSubSections[groupIdx];
        if (!group) return;

        const updated = [...matrixEntries];
        group.indices.forEach(idx => {
            if (updated[rowIdx].stations[idx]) {
                updated[rowIdx].stations[idx].curr = level;
            }
        });

        // Update certificate date to today
        const currentDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
        updated[rowIdx].certDate = currentDateStr;

        setMatrixEntries(updated);
    };

    const { user } = useSelector(state => state.auth);
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';

    const assignableDepartments = React.useMemo(() => {
        const allDepts = departmentsData?.data?.departments || [];
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return allDepts;
        return allDepts.filter(d => assignedIds.includes(String(d.id || d._id)));
    }, [departmentsData, user, isAdmin]);

    const filterSections = React.useCallback((sections) => {
        const rawAssigned = Array.isArray(user?.sections) ? [...user.sections] : [];
        if (user?.sectionId) rawAssigned.push(user.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return sections || [];
        return (sections || []).filter(s => assignedIds.includes(String(s.id || s._id)));
    }, [user, isAdmin]);

    const isRestricted = !isAdmin && user && (
        (user.departments?.length > 0) || user.departmentId ||
        (user.sections?.length > 0) || user.sectionId
    );

    // Auto-select main filter for restricted users
    React.useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length === 1 && !selectedDepartment)
            setSelectedDepartment(String(assignableDepartments[0].id || assignableDepartments[0]._id));
    }, [isRestricted, assignableDepartments, selectedDepartment]);

    React.useEffect(() => {
        if (!isRestricted || !selectedDepartment) return;
        const secs = filterSections(sectionsData?.data);
        if (secs.length === 1 && !selectedSection)
            setSelectedSection(String(secs[0].id || secs[0]._id));
    }, [isRestricted, selectedDepartment, sectionsData, selectedSection]);

    // Pre-fill create dialog for restricted users when opened
    React.useEffect(() => {
        if (!isRestricted || !createOpen) return;
        if (assignableDepartments.length === 1 && !createDepartment)
            setCreateDepartment(String(assignableDepartments[0].id || assignableDepartments[0]._id));
    }, [isRestricted, createOpen, assignableDepartments, createDepartment]);

    const handleSignature = (role, status) => {
        if (!user) {
            toast.error("Please log in to sign the document");
            return;
        }
        const name = user.fullName || user.userName || "User";
        const signatureValue = `${status}: ${name}`;
        handleConfigChange(`signatures.${role}`, signatureValue);
        toast.success(`${role.toUpperCase()} ${status} by ${name}`);
    };

    const handlePrint = () => window.print();

    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeConfig = activeConfigData?.data;

    const handleLevelChange = async (userId, nextLevel) => {
        try {
            // If the symbol is "-", we save as null in DB
            const dbLevel = (nextLevel === '-' || nextLevel === 'L-0') ? null : nextLevel;
            await axiosInstance.patch(`/api/users/${userId}`, { currentLevel: dbLevel });
            toast.success("User level updated successfully");
            // Update local state to reflect change immediately
            setMatrixEntries(prev => prev.map(entry =>
                String(entry._id) === String(userId) ? { ...entry, level: nextLevel } : entry
            ));
        } catch (error) {
            console.error("Update level error:", error);
            toast.error("Failed to update user level");
        }
    };

    const SkillIcon = ({ levelStr, onClick, size = 20, editable = false }) => {
        // Dynamic Levels based on Active Config
        const levels = activeConfig?.levels || [];
        const maxLevels = levels.length > 0 ? levels.length : 4; // Default to 4 if no config

        // Normalize level string to number (L-1 -> 1, L-2 -> 2)
        // If levelStr is not in L-X format, try to match by name
        let currentLevel = 0;
        const normalizedLevelStr = levelStr || '-';
        if (normalizedLevelStr === '-' || normalizedLevelStr === 'None') {
            currentLevel = -1; // Special case for unassigned
        } else if (normalizedLevelStr === 'L-0') {
            currentLevel = 0;
        } else if (normalizedLevelStr && normalizedLevelStr.startsWith('L-')) {
            currentLevel = parseInt(normalizedLevelStr.split('-')[1]) || 0;
        } else {
            // Try matching by name in config
            const foundLevel = levels.find(l => l.name === normalizedLevelStr);
            if (foundLevel) {
                currentLevel = foundLevel.order + 1; // 0-indexed order to 1-based count
            }
        }

        const center = size / 2;
        const radius = size / 2 - 2;

        const handleClick = () => {
            if (!editable || !onClick) return;
            // Cycle logic: - -> L-0 -> L-1 -> ... -> L-Max -> -
            let nextLevelStr = 'L-0';
            if (maxLevels > 0) {
                if (currentLevel === -1) {
                    nextLevelStr = 'L-0';
                } else if (currentLevel < maxLevels) {
                    // Next level
                    const nextLevelIndex = currentLevel; // 0-based index for next level
                    const nextLevelObj = levels.find(l => l.order === nextLevelIndex);
                    nextLevelStr = nextLevelObj ? nextLevelObj.name : `L-${currentLevel + 1}`;
                } else {
                    // After max levels, cycle back to blank '-'
                    nextLevelStr = '-';
                }
            } else {
                // Fallback hardcoded cycle including '-'
                const hardcoded = ['-', 'L-0', 'L-1', 'L-2', 'L-3', 'L-4', 'L-5'];
                let idx = hardcoded.indexOf(levelStr);
                if (idx === -1) nextLevelStr = 'L-0';
                else nextLevelStr = hardcoded[(idx + 1) % hardcoded.length];
            }
            onClick(nextLevelStr);
        };

        // Pie Chart Generation
        const renderSlices = () => {
            if (maxLevels === 0) return null;

            if (currentLevel === -1) {
                return (
                    <rect
                        width={size}
                        height={size}
                        fill="transparent"
                    />
                );
            }

            // If L-0, Dashed Circle (Under Training)
            if (currentLevel === 0) {
                return (
                    <>
                        <circle cx={center} cy={center} r={radius} fill="none" stroke="black" strokeWidth="1" strokeDasharray="2,2" />
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
            <div onClick={handleClick} className={`cursor-${editable ? 'pointer' : 'default'} inline-block`}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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

    const groupedSubSections = React.useMemo(() => {
        const groups = [];
        activeMachinesRef.forEach((m, index) => {
            const lastGroup = groups[groups.length - 1];
            const subId = m.subSectionId || 'default';
            const subName = m.subSectionName || m.name || 'N/A';

            if (lastGroup && lastGroup.id === subId) {
                lastGroup.count++;
                lastGroup.indices.push(index);
            } else {
                groups.push({
                    id: subId,
                    name: subName,
                    count: 1,
                    indices: [index],
                    minimumRequiredLevel: m.minimumRequiredLevel || null
                });
            }
        });
        return groups;
    }, [activeMachinesRef]);

    const filteredAndSortedEntries = React.useMemo(() => {
        return matrixEntries.filter(entry => {
            if (selectedLevel === "All") return true;
            return normalizeLevel(entry.level) === normalizeLevel(selectedLevel);
        }).sort((a, b) => {
            const expA = parseFloat(a.experience) || 0;
            const expB = parseFloat(b.experience) || 0;
            return expB - expA;
        });
    }, [matrixEntries, selectedLevel]);

    const columnStats = React.useMemo(() => {
        return groupedSubSections.map(group => {
            const actual = filteredAndSortedEntries.filter(entry => {
                const subSectionStations = group.indices.map(idx => entry.stations[idx]).filter(Boolean);
                const maxWeight = subSectionStations.reduce((max, s) => {
                    const w = getLevelWeight(s.curr);
                    return w > max ? w : max;
                }, -1);

                const userAssignments = entry.assignments || [];
                const isAssigned = userAssignments?.some(ua =>
                    String(ua.subSectionId) === String(group.id) ||
                    subSectionStations.some(s => String(s._id) === String(ua.machineId))
                );

                const hasSkill = subSectionStations.some(s => s.curr && s.curr !== '-');
                const displayLevel = (isAssigned || hasSkill) ? (subSectionStations.find(s => getLevelWeight(s.curr) === maxWeight)?.curr || 'L-0') : '-';
                return displayLevel !== '-';
            }).length;
            return { actual };
        });
    }, [filteredAndSortedEntries, groupedSubSections]);

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

    const matrixList = matrixListData?.data || [];

    const handleDownloadHighResImage = async () => {
        if (!tableRef.current) return;
        const loadingToast = toast.info("Generating high-resolution image...", { duration: 0 });
        setIsGeneratingImage(true);

        try {
            const tableWidth = tableRef.current.scrollWidth;
            const tableHeight = tableRef.current.scrollHeight;

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

            const link = document.createElement('a');
            const dept = selectedDeptName || 'Department';
            const dateStr = selectedMonth || 'Date';
            link.download = `SkillMatrix_${dept.replace(/\\s+/g, '_')}_${dateStr}.png`;
            link.href = dataUrl;
            link.click();

            toast.success("High-res image downloaded!");
        } catch (error) {
            console.error("Image export error:", error);
            toast.error("Failed to generate high-res image.");
        } finally {
            toast.dismiss(loadingToast);
            setIsGeneratingImage(false);
        }
    };

    return (
        <div className="space-y-6 text-black">
            <style>
                {`
@media print {
    @page { size: landscape; margin: 5mm; }
    body * { visibility: hidden; }
    #printable-matrix, #printable-matrix * { visibility: visible; }
    #printable-matrix { 
        position: absolute; 
        left: 0; 
        top: 0; 
        width: 100%; 
        max-width: 1000px; 
    }
    input { border: none !important; background: transparent !important; }
    .no-print { display: none !important; }
    table { table-layout: fixed; width: 100%; border-collapse: collapse; }
    th, td { word-wrap: break-word; overflow-wrap: break-word; word-break: break-all; }
}
`}
            </style>

            <ConditionalTabs isEmbedded={isEmbeddedView} activeTab={activeTab} setActiveTab={setActiveTab}>
                {!isEmbeddedView && (
                    <TabsList className="no-print mb-6 flex gap-2 w-fit bg-gray-100 p-1.5 rounded-lg shadow-sm border border-gray-200">
                        <TabsTrigger value="handoverSheet" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">Handover Sheet</TabsTrigger>
                        <TabsTrigger value="sixteenDayMonitoring" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">16 Day Monitoring</TabsTrigger>
                        <TabsTrigger value="skillUpgradation" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">Plan for Skill Upgradation</TabsTrigger>
                        <TabsTrigger value="ojt" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">OJT</TabsTrigger>
                        <TabsTrigger value="testPaper" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">Test Paper</TabsTrigger>
                        <TabsTrigger value="cycle10" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">10 Cycle</TabsTrigger>
                        <TabsTrigger value="evaluation" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">Check Sheet of Skill Evaluation</TabsTrigger>
                        <TabsTrigger value="skillMatrix" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">Skill Matrix</TabsTrigger>
                        <TabsTrigger value="observance" className="text-xs font-bold px-5 py-2.5 rounded-md transition-all">Operator Observance</TabsTrigger>
                    </TabsList>
                )}

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="ojt" className="space-y-6">
                    <OnJobTraining />
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="testPaper" className="space-y-6">
                    <TestPaper skillUpgradation={true} />
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="skillMatrix" className="space-y-6">
                    {!isMatrixOpen ? (
                        <div className="space-y-6">
                            <div className="p-6 border rounded bg-white flex items-center justify-between shadow-sm">
                                <h1 className="text-xl font-bold">Skill Matrix Forms</h1>
                                <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">Create Skill Matrix Form</Button>
                            </div>

                            <div className="p-6 border rounded bg-white space-y-4 shadow-sm">
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
                                        }} disabled={isRestricted && assignableDepartments.length <= 1}>
                                            <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Departments" /></SelectTrigger>
                                            <SelectContent>
                                                {assignableDepartments.map((d, idx) => (
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
                                        }} disabled={!selectedDepartment || (isRestricted && filterSections(sectionsData?.data).length <= 1)}>
                                            <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue placeholder="All Sections" /></SelectTrigger>
                                            <SelectContent>
                                                {filterSections(sectionsData?.data).map((s, idx) => (
                                                    <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name} ({s.category})</SelectItem>
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

                                <div className="border rounded overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-[11px] uppercase font-bold text-gray-600">
                                            <tr>
                                                <th className="p-3 border-b text-left">Type</th>
                                                <th className="p-3 border-b text-left">Department</th>
                                                <th className="p-3 border-b text-left">Section</th>
                                                <th className="p-3 border-b text-left">Line</th>
                                                <th className="p-3 border-b text-left">Sub-Section</th>
                                                <th className="p-3 border-b text-left">Station</th>
                                                <th className="p-3 border-b text-left">Users (last save)</th>
                                                <th className="p-3 border-b text-left">Month</th>
                                                <th className="p-3 border-b text-center">QA</th>
                                                <th className="p-3 border-b text-center">Safety</th>
                                                <th className="p-3 border-b text-center">Process</th>
                                                <th className="p-3 border-b text-left">Last Updated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {isMatrixListLoading ? (
                                                <tr><td className="p-4 text-center text-muted-foreground" colSpan={12}>Loading...</td></tr>
                                            ) : matrixList.length === 0 ? (
                                                <tr>
                                                    <td className="p-4 text-center text-muted-foreground" colSpan={12}>
                                                        No skill matrix forms found for selected filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                matrixList.map((row, idx) => (
                                                    <tr
                                                        key={row.id || idx}
                                                        className="hover:bg-muted/30 cursor-pointer text-[11px] border-b"
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
                                                        <td className="p-2 border-b text-center">
                                                            {row.footerInfo?.config?.signatures?.qa ? (
                                                                <span className={row.footerInfo.config.signatures.qa.includes('Approved') ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                                    {row.footerInfo.config.signatures.qa.split(':')[0]}
                                                                </span>
                                                            ) : "-"}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {row.footerInfo?.config?.signatures?.safety ? (
                                                                <span className={row.footerInfo.config.signatures.safety.includes('Approved') ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                                    {row.footerInfo.config.signatures.safety.split(':')[0]}
                                                                </span>
                                                            ) : "-"}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {row.footerInfo?.config?.signatures?.process ? (
                                                                <span className={row.footerInfo.config.signatures.process.includes('Approved') ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                                    {row.footerInfo.config.signatures.process.split(':')[0]}
                                                                </span>
                                                            ) : "-"}
                                                        </td>
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
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Controls */}
                            <div className="no-print p-3 bg-white border rounded shadow flex flex-wrap gap-4 items-end">
                                <div className="flex flex-col">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Department</label>
                                    <span className="text-sm font-bold bg-gray-50 px-2 py-1 rounded border">{selectedDeptName}</span>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Section</label>
                                    <Select value={selectedSection || "all-sections"} onValueChange={(val) => {
                                        setSelectedSection(val === "all-sections" ? "" : val);
                                        setSelectedLine("");
                                        setSelectedSubSection("");
                                        setSelectedStation("");
                                    }} disabled={isRestricted && filterSections(sectionsData?.data).length <= 1}>
                                        <SelectTrigger className="h-8 text-xs min-w-[120px] font-semibold"><SelectValue placeholder="All Sections" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all-sections">All Sections</SelectItem>
                                            {filterSections(sectionsData?.data).map((s, idx) => (
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
                                <div className="flex flex-col">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 mb-1">Operators</label>
                                    <span className="text-sm font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 h-8 flex items-center">
                                        {matrixEntries.filter(e => !e.isManual).length} live
                                        {matrixEntries.filter(e => e.isManual).length > 0 && ` + ${matrixEntries.filter(e => e.isManual).length} manual`}
                                    </span>
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
                                    <Button onClick={() => handleSave(false)} disabled={isSaving} className="bg-blue-600">
                                        <IconDeviceFloppy className="w-4 h-4 mr-2" />
                                        Save Matrix
                                    </Button>
                                    <Button onClick={() => handleSave(true)} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                                        <IconMail className="w-4 h-4 mr-2" />
                                        Save & Send Email
                                    </Button>
                                    <Button onClick={handleDownloadHighResImage} className="bg-purple-600 hover:bg-purple-700 text-white" disabled={!selectedDepartment || !selectedMonth || isMachinesLoading || isGeneratingImage}>
                                        {isGeneratingImage ? <IconLoader className="w-4 h-4 mr-2 animate-spin" /> : <IconPhoto className="w-4 h-4 mr-2" />}
                                        Download Image
                                    </Button>
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
                                <div className="overflow-x-auto w-full">
                                <div id="printable-matrix" ref={tableRef} className="bg-white p-2 w-fit mx-auto">
                                    <PaginationControls />
                                    <div className="border border-black text-center mb-1">
                                        <h1 className="text-xl font-bold uppercase p-1">Skill Matrix</h1>
                                    </div>

                                    {/* Header Row 1 */}
                                    <div className="flex border border-black mb-1 text-[11px]">
                                        <div className="flex border-r border-black">
                                            <div className="font-bold p-1 px-2 bg-gray-50 flex items-center justify-center border-r border-black">Department</div>
                                            <div className="p-1 font-bold flex items-center justify-center text-center">{selectedDeptName}</div>
                                        </div>
                                        <div className="flex border-r border-black">
                                            <div className="font-bold p-1 px-2 bg-gray-50 flex items-center justify-center border-r border-black">Section</div>
                                            <div className="p-1 font-bold flex items-center justify-center text-center">
                                                {sectionsData?.data?.find(s => String(s.id || s._id) === String(selectedSection))?.name || "All"}
                                            </div>
                                        </div>
                                        <div className="flex border-r border-black">
                                            <div className="font-bold p-1 px-2 bg-gray-50 flex items-center justify-center border-r border-black">Line</div>
                                            <div className="p-1 font-bold flex items-center justify-center text-center">{selectedLineName || "All"}</div>
                                        </div>
                                        <div className="flex border-r border-black">
                                            <div className="font-bold p-1 px-2 bg-gray-50 flex items-center justify-center border-r border-black">Sub-Sect</div>
                                            <div className="p-1 font-bold flex items-center justify-center text-center">
                                                {subSectionsData?.data?.find(ss => String(ss.id || ss._id) === String(selectedSubSection))?.name || "All"}
                                            </div>
                                        </div>
                                        <div className="flex border-r border-black">
                                            <div className="font-bold p-1 px-2 bg-gray-50 flex items-center justify-center border-r border-black">Shift</div>
                                            <div className="flex items-center justify-center">
                                                <Input className="text-center font-bold text-xs h-6 border-none px-2 w-12" value={config.shift || ""} onChange={e => handleConfigChange('shift', e.target.value)} />
                                            </div>
                                        </div>
                                        {/* Signatures */}
                                        <div className="flex">
                                            <div className="border-r border-black flex flex-col">
                                                <div className="text-[10px] border-b border-black text-center px-2">QA In-charge Sign.</div>
                                                <div className="text-[11px] p-1 h-8 flex items-center justify-center min-w-[100px]">
                                                    {config.signatures?.qa ? (
                                                        <div className="flex items-center gap-1 group">
                                                            <span className="font-bold leading-tight break-all">{config.signatures.qa}</span>
                                                            <button onClick={() => handleConfigChange('signatures.qa', '')} className="no-print hidden group-hover:block text-red-500">
                                                                <IconX size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleSignature('qa', 'Approved')} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded-sm text-[9px] font-bold no-print">Approve</button>
                                                            <button onClick={() => handleSignature('qa', 'Rejected')} className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-sm text-[9px] font-bold no-print">Reject</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="border-r border-black flex flex-col">
                                                <div className="text-[10px] border-b border-black text-center px-2">Safety In-charge Sign.</div>
                                                <div className="text-[11px] p-1 h-8 flex items-center justify-center min-w-[100px]">
                                                    {config.signatures?.safety ? (
                                                        <div className="flex items-center gap-1 group">
                                                            <span className="font-bold leading-tight break-all">{config.signatures.safety}</span>
                                                            <button onClick={() => handleConfigChange('signatures.safety', '')} className="no-print hidden group-hover:block text-red-500">
                                                                <IconX size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleSignature('safety', 'Approved')} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded-sm text-[9px] font-bold no-print">Approve</button>
                                                            <button onClick={() => handleSignature('safety', 'Rejected')} className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-sm text-[9px] font-bold no-print">Reject</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="border-r border-black flex flex-col">
                                                <div className="text-[10px] border-b border-black text-center px-2">Process In-charge Sign.</div>
                                                <div className="text-[11px] p-1 h-8 flex items-center justify-center min-w-[100px]">
                                                    {config.signatures?.process ? (
                                                        <div className="flex items-center gap-1 group">
                                                            <span className="font-bold leading-tight break-all">{config.signatures.process}</span>
                                                            <button onClick={() => handleConfigChange('signatures.process', '')} className="no-print hidden group-hover:block text-red-500">
                                                                <IconX size={12} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-1">
                                                            <button onClick={() => handleSignature('process', 'Approved')} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded-sm text-[9px] font-bold no-print">Approve</button>
                                                            <button onClick={() => handleSignature('process', 'Rejected')} className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-sm text-[9px] font-bold no-print">Reject</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="text-[10px] border-b border-black text-center px-2">
                                                    <Input
                                                        className="h-8 w-24 p-0 text-center border-none bg-transparent"
                                                        value={config.plannedHeader || ""}
                                                        onChange={e => handleConfigChange('plannedHeader', e.target.value)}
                                                        placeholder=""
                                                    />
                                                </div>
                                                <div className="text-[11px] p-1 h-4 flex items-center justify-center min-w-[100px] font-bold">
                                                    Planned
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product & Revisions Header */}
                                    <div className="flex border border-black mb-1 text-[11px] w-fit">
                                        {/* Products */}
                                        {config.products.map((p, i) => (
                                            <div key={`prod-${i}`} className="border-r border-black flex flex-col p-0">
                                                <div className="border-b border-black text-center font-bold bg-gray-50 py-1 px-1">Product</div>
                                                <div className="flex-1 flex items-center justify-center p-0">
                                                    <Input
                                                        className="h-full p-0 text-center border-none bg-transparent"
                                                        style={{ width: `${Math.max(48, (p?.length || 0) * 8 + 10)}px` }}
                                                        value={p || ""}
                                                        onChange={e => handleArrayConfigChange('products', i, null, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {/* Revisions Block */}
                                        {config.revisions.map((rev, i) => (
                                            <div key={`rev-${i}`} className="border-r border-black flex">
                                                <div className="border-r border-black flex flex-col p-0">
                                                    <div className="border-b border-black text-[10px] text-center bg-gray-50 py-1 font-semibold px-1">Product</div>
                                                    <div className="flex-1 flex items-center justify-center p-0">
                                                        <Input
                                                            className="h-full p-0 text-center text-[11px] border-none bg-transparent px-1"
                                                            style={{ width: `${Math.max(48, (rev.product?.length || 0) * 7 + 10)}px` }}
                                                            value={rev.product || ""}
                                                            onChange={e => handleArrayConfigChange('revisions', i, 'product', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="border-r border-black flex flex-col p-0">
                                                    <div className="border-b border-black text-[10px] text-center bg-gray-50 py-1 font-semibold px-1">Revision</div>
                                                    <div className="flex-1 flex items-center justify-center p-0">
                                                        <Input
                                                            className="h-full p-0 text-center text-[11px] border-none bg-transparent px-1"
                                                            style={{ width: `${Math.max(48, (rev.revision?.length || 0) * 7 + 10)}px` }}
                                                            value={rev.revision || ""}
                                                            onChange={e => handleArrayConfigChange('revisions', i, 'revision', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col p-0">
                                                    <div className="border-b border-black text-[10px] text-center bg-gray-50 py-1 font-semibold px-1">Operatoion date</div>
                                                    <div className="flex-1 flex items-center justify-center p-0">
                                                        <Input
                                                            className="h-full p-0 text-center text-[11px] border-none bg-transparent px-1"
                                                            style={{ width: `${Math.max(48, (rev.date?.length || 0) * 7 + 10)}px` }}
                                                            value={rev.date || ""}
                                                            onChange={e => handleArrayConfigChange('revisions', i, 'date', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Legend Row */}
                                    <div className="border border-black mb-1 p-1 flex flex-wrap items-center gap-4 text-[11px]">
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
                                    <table className="w-full border-collapse border border-black text-[10px] table-auto">
                                        <colgroup><col style={{ width: '5%' }} /><col /><col /><col style={{ width: '11%' }} /><col style={{ width: '8%' }} />{groupedSubSections.map((_, i) => (<col key={i} style={{ width: `${43 / groupedSubSections.length}%` }} />))}<col style={{ width: '4%' }} /><col style={{ width: '4%' }} /><col style={{ width: '4%' }} /><col style={{ width: '3%' }} /></colgroup>
                                        <thead>
                                            {/* Process Responsible Person Row */}
                                            <tr>
                                                <th colSpan={5} className="border border-black p-1 text-right">Process responsible person</th>
                                                <th colSpan={groupedSubSections.length} className="border border-black p-1 text-left">
                                                    <Input className="inline w-32 h-4 p-0 border-b border-dotted" value={config.processPersons?.responsible || ""} onChange={e => handleConfigChange('processPersons.responsible', e.target.value)} />
                                                </th>
                                                <th colSpan={4} className="border border-black"></th>
                                            </tr>
                                            {/* Vice Process Row */}
                                            <tr>
                                                <th colSpan={5} className="border border-black p-1 text-right">Vice process responsible person</th>
                                                <th colSpan={groupedSubSections.length} className="border border-black p-1 text-center flex justify-center gap-10">
                                                    <span><Input className="inline w-32 h-4 p-0 border-b border-dotted" value={config.processPersons?.vice || ""} onChange={e => handleConfigChange('processPersons.vice', e.target.value)} /></span>
                                                </th>
                                                <th colSpan={4} className="border border-black text-center">
                                                    <span><Input className="inline w-32 h-4 p-0 border-b border-dotted" value={config.processPersons?.vice2 || ""} onChange={e => handleConfigChange('processPersons.vice2', e.target.value)} /></span>
                                                </th>
                                            </tr>

                                            {/* Main Headers for Stations */}
                                            <tr>
                                                <th colSpan={5} className="border border-black p-1 text-right">Responsible expert</th>
                                                {/* Generated Sub-Section Header (Operators) */}
                                                {groupedSubSections.map((_, i) => (
                                                    <th key={i} className="border border-black bg-yellow-100 text-[9px] font-normal leading-tight p-0.5">
                                                        Operator Inspector
                                                    </th>
                                                ))}
                                                <th colSpan={2} rowSpan={4} className="border border-black bg-yellow-300">Number of process of per person</th>
                                                <th rowSpan={5} className="border border-black bg-yellow-300">Status</th>
                                                <th rowSpan={5} className="border border-black bg-yellow-300">%</th>
                                            </tr>

                                            {/* Sub-Section Name Row */}
                                            <tr>
                                                <th colSpan={5} className="border border-black p-1 text-right">Process name</th>

                                                {groupedSubSections.map((group, i) => (
                                                    <th key={i} className="border border-black p-1 bg-gray-50 h-32 text-center font-bold uppercase text-[9px]">
                                                        {group.name}
                                                    </th>
                                                ))}
                                            </tr>

                                            {/* Min Skill Row */}
                                            <tr>
                                                <th colSpan={5} className="border border-black p-1 text-right">Min.Skill Required</th>

                                                {groupedSubSections.map((group, i) => {
                                                    // Directly use the sub-section's required level
                                                    const rawVal = group.minimumRequiredLevel || config.minSkills?.[i] || "L2";
                                                    // Clean value: remove leading/trailing dots or commas
                                                    const cleanedVal = String(rawVal).replace(/^[.,\s]+|[.,\s]+$/g, '');

                                                    return (
                                                        <th key={i} className="border border-black p-0 h-4 bg-gray-50/50">
                                                            <div className="text-center text-[11px] font-bold">
                                                                {cleanedVal}
                                                            </div>
                                                        </th>
                                                    )
                                                })}
                                            </tr>

                                            {/* Operation Sharing Row */}
                                            <tr>
                                                <th colSpan={5} className="border border-black p-1 text-right">Operation sharing ( Station No & equipment name)</th>

                                                {groupedSubSections.map((_, i) => (
                                                    <th key={i} className="border border-black p-0 text-[10px]">{i + 1}</th>
                                                ))}
                                            </tr>

                                            {/* Actual User Columns Header */}
                                            <tr>
                                                <th className="border border-black px-0">Number</th>
                                                <th className="border border-black px-0">Operator name</th>
                                                <th className="border border-black px-0 min-w-[60px]">Card No.</th>
                                                <th className="border border-black text-[9px] p-0">
                                                    <div className="border-b border-black py-0.5 flex items-center justify-center px-0">Year number of experience</div>
                                                    <div className="py-0.5 flex items-center justify-center px-0">Date of Certificate update</div>
                                                </th>
                                                <th className="border border-black text-[9px] p-0">
                                                    <div className="border-b border-black py-0.5 flex items-center justify-center px-0">Equipment arrangement number</div>
                                                    <div className="py-0.5 flex items-center justify-center px-0">Position number</div>
                                                </th>

                                                {groupedSubSections.map((_, i) => (
                                                    <th key={i} className="border border-black p-0">{i + 1}</th>
                                                ))}
                                                <th className="border border-black px-0">Plan</th>
                                                <th className="border border-black px-0">Actual</th>
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
                                                        <tr key={originalIndex} className="h-auto min-h-[32px] text-center border border-black hover:bg-gray-50">
                                                            <td className="border border-black font-bold p-0">{(currentPage - 1) * itemsPerPage + rowIndex + 1}</td>
                                                            <td className="border border-black font-bold text-left px-0.5 whitespace-normal break-words text-xs">
                                                                {entry.isManual ? (
                                                                    entry.name
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (isEmbeddedView && onOperatorClick) {
                                                                                onOperatorClick(
                                                                                    entry._id,
                                                                                    selectedDepartment,
                                                                                    selectedSection,
                                                                                    selectedLine,
                                                                                    selectedSubSection
                                                                                );
                                                                            } else {
                                                                                setEvalDepartment(selectedDepartment);
                                                                                setEvalSection(selectedSection);
                                                                                setEvalLine(selectedLine);
                                                                                setEvalSubSection(selectedSubSection);
                                                                                setSelectedOperatorForEval(entry._id);
                                                                                setActiveTab("evaluation");
                                                                            }
                                                                        }}
                                                                        className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left w-full whitespace-normal break-words"
                                                                        title="Click to view/edit Skill Matrix Evaluation Certificate"
                                                                    >
                                                                        {entry.name}
                                                                    </button>
                                                                )}
                                                            </td>
                                                            <td className="border border-black p-0 whitespace-nowrap">
                                                                <Input
                                                                    className="h-full p-0 text-center border-none bg-transparent px-0"
                                                                    style={{ minWidth: `${Math.max(60, (entry.cardNo?.length || 0) * 7 + 10)}px`, width: '100%' }}
                                                                    value={entry.cardNo}
                                                                    onChange={e => handleEntryChange(originalIndex, 'cardNo', e.target.value)}
                                                                />
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <div className="flex flex-col h-full">
                                                                    <div className="border-b border-black flex-1 flex items-center justify-center min-h-[16px]">
                                                                        <Input className="h-full w-full p-0 text-center border-none bg-transparent text-[10px]" value={entry.experience} onChange={e => handleEntryChange(originalIndex, 'experience', e.target.value)} />
                                                                    </div>
                                                                    <div className="flex-1 flex items-center justify-center min-h-[16px]">
                                                                        <Input className="h-full w-full p-0 text-center border-none bg-transparent text-[10px]" value={entry.certDate} onChange={e => handleEntryChange(originalIndex, 'certDate', e.target.value)} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-100">
                                                                <div className="flex flex-col h-full">
                                                                    <div className="border-b border-black flex-1 bg-white min-h-[16px]"></div>
                                                                    <div className="flex-1 flex items-center justify-center text-[10px] min-h-[16px]">
                                                                        <Input className="h-full w-full p-0 text-center border-none bg-transparent font-bold text-[10px]" value={entry.position} onChange={e => handleEntryChange(originalIndex, 'position', e.target.value)} />
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Sub-Sections Skills (Aggregated) */}

                                                            {groupedSubSections.map((group, i) => {
                                                                const subSectionStations = group.indices.map(idx => entry.stations[idx]).filter(Boolean);

                                                                let maxStation = null;
                                                                let maxWeight = -1;

                                                                subSectionStations.forEach(s => {
                                                                    const w = getLevelWeight(s.curr);
                                                                    if (w > maxWeight) {
                                                                        maxWeight = w;
                                                                        maxStation = s;
                                                                    }
                                                                });

                                                                if (!maxStation && subSectionStations.length > 0) {
                                                                    maxStation = subSectionStations[0];
                                                                }

                                                                const userAssignments = entry.assignments || [];
                                                                const isAssigned = userAssignments?.some(ua =>
                                                                    String(ua.subSectionId) === String(group.id) ||
                                                                    subSectionStations.some(s => String(s._id) === String(ua.machineId))
                                                                );

                                                                const hasSkill = subSectionStations.some(s => s.curr && s.curr !== '-');
                                                                const displayLevel = (isAssigned || hasSkill) ? (maxStation?.curr || 'L-0') : '-';

                                                                return (
                                                                    <td key={i} className="border border-black p-0 align-middle">
                                                                        <div className="flex justify-center items-center h-full">
                                                                            <SkillIcon
                                                                                levelStr={displayLevel}
                                                                                size={24}
                                                                                editable={true}
                                                                                onClick={(level) => handleSubSectionSkillChange(originalIndex, i, level)}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                )
                                                            })}

                                                            <td className="border border-black p-0">
                                                                <Input className="h-full w-full p-0 text-center border-none bg-transparent" value={entry.plan} onChange={e => handleEntryChange(originalIndex, 'plan', e.target.value)} />
                                                            </td>
                                                            <td className="border border-black font-bold bg-gray-50 p-0">
                                                                <Input className="h-full w-full p-0 text-center border-none bg-transparent font-bold" value={entry.actual} onChange={e => handleEntryChange(originalIndex, 'actual', e.target.value)} />
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <select
                                                                    className="h-full w-full p-0 text-center border-none bg-transparent font-bold appearance-none cursor-pointer text-[10px]"
                                                                    value={entry.status || "OK"}
                                                                    onChange={e => handleEntryChange(originalIndex, 'status', e.target.value)}
                                                                >
                                                                    <option value="OK">OK</option>
                                                                    <option value="NG">NG</option>
                                                                </select>
                                                            </td>
                                                            <td className="border border-black font-bold text-blue-600 p-0">
                                                                {((parseFloat(entry.actual) / (parseFloat(entry.plan) || 1)) * 100).toFixed(0)}%
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <th colSpan={4} rowSpan={2} className="border border-black text-right p-1">Number of person for process</th>
                                                <th className="border border-black text-center p-1">Plan</th>
                                                {groupedSubSections.map((_, i) => (
                                                    <td key={i} className="border border-black font-bold p-0">
                                                        <Input className="h-full w-full p-0 text-center text-[11px] bg-transparent border-none font-bold" value={config.footerRows?.numPersonPlan?.[i] || ""} onChange={e => handleFooterRowChange("numPersonPlan", i, e.target.value)} />
                                                    </td>
                                                ))}
                                                <td className="border border-black font-bold text-center bg-gray-100">Total Plan</td>
                                                <td className="border border-black font-bold text-center bg-gray-100">Total Actual</td>
                                                <td className="border border-black bg-gray-100"></td>
                                                <td className="border border-black font-bold text-center bg-gray-100 text-blue-600">Total %</td>
                                            </tr>
                                            <tr>
                                                <th className="border border-black text-center p-1">Actual</th>
                                                {groupedSubSections.map((_, i) => (
                                                    <td key={i} className="border border-black font-bold p-0 text-center text-[11px]">
                                                        {columnStats[i]?.actual || 0}
                                                    </td>
                                                ))}
                                                <td className="border border-black font-bold text-center bg-white">
                                                    {filteredAndSortedEntries.reduce((acc, curr) => acc + (parseFloat(curr.plan) || 0), 0)}
                                                </td>
                                                <td className="border border-black font-bold text-center bg-white">
                                                    {filteredAndSortedEntries.reduce((acc, curr) => acc + (parseFloat(curr.actual) || 0), 0)}
                                                </td>
                                                <td className="border border-black bg-white"></td>
                                                <td className="border border-black font-bold text-blue-600 text-center bg-white">
                                                    {(() => {
                                                        const totalPlan = filteredAndSortedEntries.reduce((acc, curr) => acc + (parseFloat(curr.plan) || 0), 0);
                                                        const totalActual = filteredAndSortedEntries.reduce((acc, curr) => acc + (parseFloat(curr.actual) || 0), 0);
                                                        return totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(0) : 0;
                                                    })()}%
                                                </td>
                                            </tr>
                                            <tr>
                                                <th colSpan={5} className="border border-black text-right p-1">Status</th>
                                                {groupedSubSections.map((_, i) => (
                                                    <td key={i} className="border border-black font-bold p-0">
                                                        <select
                                                            className="h-full w-full p-0 text-center border-none bg-transparent font-bold appearance-none cursor-pointer text-[10px]"
                                                            value={config.footerRows?.statusRow?.[i] || "OK"}
                                                            onChange={e => handleFooterRowChange("statusRow", i, e.target.value)}
                                                        >
                                                            <option value="OK">OK</option>
                                                            <option value="NG">NG</option>
                                                        </select>
                                                    </td>
                                                ))}
                                                <td colSpan={4} className="border border-black bg-gray-50"></td>
                                            </tr>


                                        </tfoot>
                                    </table>

                                    {/* Evaluation Schedule Table */}
                                    <div className="mt-1 border border-black overflow-hidden no-print-break">
                                        <table className="w-full border-collapse border border-black text-[10px] table-fixed">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="border border-black p-1 w-24 text-right">Evaluation</th>
                                                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                                                        <th key={m} className="border border-black p-1">{m}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>

                                                <tr>
                                                    <td className="border border-black p-1 text-right font-bold bg-gray-50 uppercase text-[9px]">Plan (No. of skilled manpower)</td>
                                                    {Array(12).fill(0).map((_, i) => (
                                                        <td key={i} className="border border-black p-0">
                                                            <Input className="h-full w-full p-0 text-center text-[10px] bg-transparent border-none font-bold" value={config.footerRows?.planMonths?.[i] || ""} onChange={e => handleFooterRowChange("planMonths", i, e.target.value)} />
                                                        </td>
                                                    ))}
                                                </tr>
                                                <tr>
                                                    <td className="border border-black p-1 text-right font-bold bg-gray-50 uppercase text-[9px]">Actual</td>
                                                    {Array(12).fill(0).map((_, i) => (
                                                        <td key={i} className="border border-black p-0">
                                                            <Input className="h-full w-full p-0 text-center text-[10px] bg-transparent border-none font-bold" value={config.footerRows?.actualMonths?.[i] || ""} onChange={e => handleFooterRowChange("actualMonths", i, e.target.value)} />
                                                        </td>
                                                    ))}
                                                </tr>
                                                <tr>
                                                    <td className="border border-black p-1 text-right font-bold bg-gray-50 uppercase text-[9px]">% (Skilled manpower)</td>
                                                    {Array(12).fill(0).map((_, i) => {
                                                        // Auto-calculate for current selected month
                                                        const currentMonthIdx = selectedMonth ? parseInt(selectedMonth.split('-')[1]) - 1 : -1;
                                                        let planVal, actualVal;

                                                        if (i === currentMonthIdx) {
                                                            planVal = filteredAndSortedEntries.reduce((acc, curr) => acc + (parseFloat(curr.plan) || 0), 0);
                                                            actualVal = filteredAndSortedEntries.reduce((acc, curr) => acc + (parseFloat(curr.actual) || 0), 0);
                                                        } else {
                                                            planVal = parseFloat(config.footerRows?.planMonths?.[i]) || 0;
                                                            actualVal = parseFloat(config.footerRows?.actualMonths?.[i]) || 0;
                                                        }

                                                        const percentVal = planVal > 0 ? ((actualVal / planVal) * 100).toFixed(0) : 0;
                                                        return (
                                                            <td key={i} className="border border-black p-0 bg-gray-50/30">
                                                                <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-blue-600 min-h-[24px]">
                                                                    {percentVal}%
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="no-print mt-6">
                                        <PaginationControls />
                                    </div>

                                    {/* Footer Info */}
                                    <div className="flex justify-between text-[11px] mt-2 border-t border-black pt-1">
                                        <div>Date of Certificate/update : {config.documentInfo.revDate}</div>
                                        <div>Doc No. {config.documentInfo.docNo}</div>
                                        <div>Rev.{config.documentInfo.revNo}</div>
                                        <div>Rev Date: {config.documentInfo.revDate}</div>
                                        <div>Page: {config.documentInfo.page}</div>
                                    </div>
                                </div>
                                </div>
                            )}
                        </div>
                    )}
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="evaluation" className="space-y-6">
                    {/* Control Bar for selecting operator */}
                    <div className="no-print p-6 bg-white border rounded-lg shadow-sm space-y-4 mb-6 text-black">
                        <div className="flex justify-between items-center border-b pb-2">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Operator Evaluation Finder</h2>
                                <p className="text-xs text-gray-500">Filter and select an operator to view/edit their skill certificate</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setActiveTab("skillMatrix")}>
                                Back to Matrix Grid
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Department</label>
                                <Select value={evalDepartment} onValueChange={(val) => {
                                    setEvalDepartment(val);
                                    setEvalSection("");
                                    setEvalLine("");
                                    setEvalSubSection("");
                                    setSelectedOperatorForEval(null);
                                }} disabled={isRestricted && assignableDepartments.length <= 1}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                    <SelectContent>
                                        {assignableDepartments.map((d, idx) => (
                                            <SelectItem key={`${d.id || d._id}-${idx}`} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Section</label>
                                <Select value={evalSection} onValueChange={(val) => {
                                    setEvalSection(val);
                                    setEvalLine("");
                                    setEvalSubSection("");
                                    setSelectedOperatorForEval(null);
                                }} disabled={!evalDepartment || (isRestricted && filterSections(evalSectionsData?.data).length <= 1)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Sections" /></SelectTrigger>
                                    <SelectContent>
                                        {filterSections(evalSectionsData?.data).map((s, idx) => (
                                            <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Line</label>
                                <Select value={evalLine} onValueChange={(val) => {
                                    setEvalLine(val);
                                    setEvalSubSection("");
                                    setSelectedOperatorForEval(null);
                                }} disabled={!evalSection}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Lines" /></SelectTrigger>
                                    <SelectContent>
                                        {evalLinesData?.data?.map((l, idx) => (
                                            <SelectItem key={`${l.id || l._id}-${idx}`} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Sub-Section</label>
                                <Select value={evalSubSection} onValueChange={(val) => {
                                    setEvalSubSection(val);
                                    setSelectedOperatorForEval(null);
                                }} disabled={!evalLine}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Sub-Sections" /></SelectTrigger>
                                    <SelectContent>
                                        {evalSubSectionsData?.data?.map((ss, idx) => (
                                            <SelectItem key={`${ss.id || ss._id}-${idx}`} value={String(ss.id || ss._id)}>{ss.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500">Search User</label>
                                <Input
                                    placeholder="Type name or card no..."
                                    value={evalSearchText}
                                    onChange={(e) => {
                                        setEvalSearchText(e.target.value);
                                        setSelectedOperatorForEval(null);
                                    }}
                                    className="h-9"
                                    disabled={!evalDepartment}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1 pt-2 border-t">
                            <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold text-blue-600">Select Operator to Evaluate</label>
                            <Select
                                value={selectedOperatorForEval || ""}
                                onValueChange={setSelectedOperatorForEval}
                                disabled={!evalDepartment || filteredEvalUsers.length === 0}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder={
                                        !evalDepartment
                                            ? "Please select a department first"
                                            : filteredEvalUsers.length === 0
                                                ? "No operators found matching the criteria"
                                                : "Select an operator"
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredEvalUsers.map(u => (
                                        <SelectItem key={u._id} value={u._id}>
                                            {u.fullName || u.name} {(u.cardNo || u.empId) ? `(${u.cardNo || u.empId})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {selectedOperatorForEval ? (
                        selectedSheetId ? (
                            <div className="bg-white border rounded p-4 shadow">
                                <SkillMatrixCertificate
                                    studentId={selectedOperatorForEval}
                                    studentName={
                                        matrixEntries.find(e => e._id === selectedOperatorForEval)?.name ||
                                        filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.fullName ||
                                        filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.name
                                    }
                                    employeeCode={
                                        matrixEntries.find(e => e._id === selectedOperatorForEval)?.cardNo ||
                                        filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.cardNo
                                    }
                                    departmentId={evalDepartment || selectedDepartment}
                                    subSectionId={evalSubSection || selectedSubSection}
                                    initialSheetId={selectedSheetId}
                                    onBackToList={() => {
                                        setSelectedSheetId(null);
                                        fetchEvaluationSheets(selectedOperatorForEval);
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="bg-white border rounded p-6 shadow space-y-4">
                                <div className="flex justify-between items-center border-b pb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800">
                                            Evaluation Sheets for {
                                                matrixEntries.find(e => e._id === selectedOperatorForEval)?.name ||
                                                filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.fullName ||
                                                filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.name
                                            }
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            Select a sheet row to view details, or create a new evaluation sheet.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleCreateNewSheetFromList}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                                        >
                                            + Create New Sheet
                                        </Button>
                                    </div>
                                </div>

                                {isSheetsLoading ? (
                                    <div className="flex justify-center py-8">
                                        <IconLoader className="animate-spin h-6 w-6" />
                                    </div>
                                ) : evaluationSheets.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 italic">
                                        No evaluation sheets created yet. Click "+ Create New Sheet" to begin.
                                    </div>
                                ) : (
                                    <div className="border rounded overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-[11px] uppercase font-bold text-gray-600">
                                                <tr>
                                                    <th className="p-3 border-b text-left">Sheet #</th>
                                                    <th className="p-3 border-b text-left">Period</th>
                                                    <th className="p-3 border-b text-left">Level Earned</th>
                                                    <th className="p-3 border-b text-left">Efficiency</th>
                                                    <th className="p-3 border-b text-left">Status</th>
                                                    <th className="p-3 border-b text-left">Created Date</th>
                                                    <th className="p-3 border-b text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {evaluationSheets.map((sheet, idx) => (
                                                    <tr
                                                        key={sheet.id || idx}
                                                        className="hover:bg-muted/30 cursor-pointer border-b text-xs transition-colors duration-150"
                                                        onClick={() => setSelectedSheetId(sheet.id)}
                                                    >
                                                        <td className="p-3 font-bold">Sheet {sheet.sheetIndex}</td>
                                                        <td className="p-3">{sheet.period}</td>
                                                        <td className="p-3 font-bold text-blue-600">{sheet.earnedLevel || 'L0'}</td>
                                                        <td className="p-3 font-semibold">{sheet.efficiency ? `${sheet.efficiency}%` : '0%'}</td>
                                                        <td className="p-3">
                                                            {sheet.isActive ? (
                                                                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                    Active
                                                                </span>
                                                            ) : (
                                                                <span className="bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                                    Previous
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3">
                                                            {new Date(sheet.createdAt).toLocaleDateString('en-GB')}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Button
                                                                size="xs"
                                                                variant="outline"
                                                                className="h-7 text-xs font-semibold px-3"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedSheetId(sheet.id);
                                                                }}
                                                            >
                                                                View
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                            No operator selected. Please select a Department and filter/search for an operator from the criteria above.
                        </div>
                    )}
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="cycle10" className="space-y-6">
                    <Cycle10 />
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="observance" className="space-y-6">
                    {/* Control Bar for selecting operator */}
                    <div className="no-print p-6 bg-white border rounded-lg shadow-sm space-y-4 mb-6 text-black">
                        <div className="flex justify-between items-center border-b pb-2">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Operator Observance Finder</h2>
                                <p className="text-xs text-gray-500">Filter and select an operator to view/edit their observance sheet</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setActiveTab("skillMatrix")}>
                                Back to Matrix Grid
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold">Department</label>
                                <Select value={observanceDepartment} onValueChange={(val) => {
                                    setObservanceDepartment(val);
                                    setObservanceSection("");
                                    setObservanceLine("");
                                    setObservanceSubSection("");
                                    setObservanceStation("");
                                    setSelectedOperatorForObservance(null);
                                }} disabled={isRestricted && assignableDepartments.length <= 1}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                    <SelectContent>
                                        {assignableDepartments.map((d, idx) => (
                                            <SelectItem key={`${d.id || d._id}-${idx}`} value={String(d.id || d._id)}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold">Section</label>
                                <Select value={observanceSection} onValueChange={(val) => {
                                    setObservanceSection(val);
                                    setObservanceLine("");
                                    setObservanceSubSection("");
                                    setObservanceStation("");
                                    setSelectedOperatorForObservance(null);
                                }} disabled={!observanceDepartment || (isRestricted && filterSections(observanceSectionsData?.data).length <= 1)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Sections" /></SelectTrigger>
                                    <SelectContent>
                                        {filterSections(observanceSectionsData?.data).map((s, idx) => (
                                            <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold">Line</label>
                                <Select value={observanceLine} onValueChange={(val) => {
                                    setObservanceLine(val);
                                    setObservanceSubSection("");
                                    setObservanceStation("");
                                    setSelectedOperatorForObservance(null);
                                }} disabled={!observanceSection}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Lines" /></SelectTrigger>
                                    <SelectContent>
                                        {observanceLinesData?.data?.map((l, idx) => (
                                            <SelectItem key={`${l.id || l._id}-${idx}`} value={String(l.id || l._id)}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold">Sub-Section</label>
                                <Select value={observanceSubSection} onValueChange={(val) => {
                                    setObservanceSubSection(val);
                                    setObservanceStation("");
                                    setSelectedOperatorForObservance(null);
                                }} disabled={!observanceLine}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Sub-Sections" /></SelectTrigger>
                                    <SelectContent>
                                        {observanceSubSectionsData?.data?.map((ss, idx) => (
                                            <SelectItem key={`${ss.id || ss._id}-${idx}`} value={String(ss.id || ss._id)}>{ss.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold">Station</label>
                                <Select value={observanceStation} onValueChange={(val) => {
                                    setObservanceStation(val);
                                    setSelectedOperatorForObservance(null);
                                }} disabled={!observanceLine}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="All Stations" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Stations</SelectItem>
                                        {(activeObservanceMachines || []).map((m, idx) => (
                                            <SelectItem key={`${m.id || m._id}-${idx}`} value={String(m.id || m._id)}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold">Search Operator</label>
                                <Input
                                    placeholder="Type name or card no..."
                                    value={observanceSearchText}
                                    onChange={(e) => {
                                        setObservanceSearchText(e.target.value);
                                        setSelectedOperatorForObservance(null);
                                    }}
                                    className="h-9"
                                    disabled={!observanceDepartment}
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] uppercase font-bold text-gray-500 font-semibold text-blue-600">Select Operator to Observe</label>
                                <Select
                                    value={selectedOperatorForObservance || ""}
                                    onValueChange={setSelectedOperatorForObservance}
                                    disabled={!observanceDepartment || filteredObservanceUsers.length === 0}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder={
                                            !observanceDepartment
                                                ? "Please select a department first"
                                                : filteredObservanceUsers.length === 0
                                                    ? "No operators found matching the criteria"
                                                    : "Select an operator"
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredObservanceUsers.map(u => (
                                            <SelectItem key={u._id || u.id} value={u._id || u.id}>
                                                {u.fullName || u.name} {u.cardNo || u.empId ? `(${u.cardNo || u.empId})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {selectedOperatorForObservance ? (
                        <div className="bg-white border rounded p-4 shadow">
                            <OperatorObservanceSheet
                                studentId={selectedOperatorForObservance}
                                studentName={
                                    filteredObservanceUsers.find(e => String(e._id || e.id) === String(selectedOperatorForObservance))?.fullName ||
                                    filteredObservanceUsers.find(e => String(e._id || e.id) === String(selectedOperatorForObservance))?.name || ""
                                }
                                employeeCode={
                                    filteredObservanceUsers.find(e => String(e._id || e.id) === String(selectedOperatorForObservance))?.cardNo ||
                                    filteredObservanceUsers.find(e => String(e._id || e.id) === String(selectedOperatorForObservance))?.empId || ""
                                }
                            />
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                            No operator selected. Please select a Department and filter/search for an operator from the criteria above.
                        </div>
                    )}
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="skillUpgradation" className="space-y-6">
                    <SkillUpgradationWrapper />
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="handoverSheet" className="space-y-6">
                    <HandoverSheetPage />
                </ConditionalTabsContent>

                <ConditionalTabsContent isEmbedded={isEmbeddedView} value="sixteenDayMonitoring" className="space-y-6">
                    <SixteenDayMonitoring />
                </ConditionalTabsContent>
            </ConditionalTabs>

            {/* Create Skill Matrix Form Dialog */}
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
                            }} disabled={isRestricted && assignableDepartments.length <= 1}>
                                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((d, idx) => (
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
                            }} disabled={!createDepartment || (isRestricted && filterSections(createSectionsData?.data).length <= 1)}>
                                <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                                <SelectContent>
                                    {filterSections(createSectionsData?.data).map((s, idx) => (
                                        <SelectItem key={`${s.id || s._id}-${idx}`} value={String(s.id || s._id)}>{s.name} ({s.category})</SelectItem>
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
