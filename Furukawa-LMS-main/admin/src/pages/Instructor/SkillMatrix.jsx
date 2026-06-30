import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IconPrinter, IconLoader, IconDeviceFloppy, IconDownload } from "@tabler/icons-react";
import { useGetMyDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';
import { useGetMachinesByLineQuery } from '@/Redux/AllApi/MachineApi';
import { useGetActiveConfigQuery } from '@/Redux/AllApi/CourseLevelConfigApi';
import { useGetSkillMatrixQuery, useSaveSkillMatrixMutation } from '@/Redux/AllApi/SkillMatrixApi';
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SkillMatrixCertificate from "@/components/admin/SkillMatrixCertificate";

const InstructorSkillMatrix = () => {
    const componentRef = useRef();
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedLine, setSelectedLine] = useState("");
    const [activeTab, setActiveTab] = useState("skillMatrix");
    const [selectedOperatorForEval, setSelectedOperatorForEval] = useState(null);
    const [evalDepartment, setEvalDepartment] = useState("");
    const [evalLine, setEvalLine] = useState("");
    const [evalSearchText, setEvalSearchText] = useState("");

    // --- Saved Data Fetching ---
    const { data: savedMatrixData, refetch: refetchMatrix } = useGetSkillMatrixQuery({
        departmentId: selectedDepartment,
        lineId: selectedLine
    }, {
        skip: !selectedDepartment || !selectedLine
    });

    const [saveSkillMatrix, { isLoading: isSaving }] = useSaveSkillMatrixMutation();

    // --- Data Fetching ---

    // 1. Departments for Dropdown
    const { data: departmentsData, isLoading: isDeptLoading } = useGetMyDepartmentsQuery();

    // 2. Lines for Dropdown (Dependent on Department)
    const { data: linesData, isLoading: isLinesLoading } = useGetLinesByDepartmentQuery(selectedDepartment, {
        skip: !selectedDepartment
    });

    // 3. Machines for Table Columns (Dependent on Line)
    const { data: machinesData, isLoading: isMachinesLoading } = useGetMachinesByLineQuery(selectedLine, {
        skip: !selectedLine
    });

    // 4. Users (Instructors & Students) - Filtered by Department client-side or assume API supports it
    // Note: The existing APIs fetch all used here, we filter client-side.
    // 4. Users (Instructors & Students) - Derived directly from Department Data
    // We no longer fetch all users globally to avoid performance issues and stale data filtering.

    // 5. Config
    const { data: levelConfigData } = useGetActiveConfigQuery();
    const levelConfig = levelConfigData?.data;
    const availableLevels = levelConfig?.levels || [
        { name: "L1", color: "#3B82F6" },
        { name: "L2", color: "#F97316" },
        { name: "L3", color: "#10B981" },
        { name: "L4", color: "#8B5CF6" },
        { name: "L5", color: "#EC4899" },
    ];

    const [matrixEntries, setMatrixEntries] = useState([]);

    // Memoize Department Users for Dropdown and Initial Population
    const departmentUsers = React.useMemo(() => {
        if (!selectedDepartment || !departmentsData?.data?.departments) return [];

        const selectedDept = departmentsData.data.departments.find(d => String(d._id) === String(selectedDepartment));
        if (!selectedDept) return [];

        const users = [];

        // Add Instructor (TNR)
        // Access nested properties if needed, usually passed as object
        if (selectedDept.instructor) {
            users.push({
                ...selectedDept.instructor,
                type: 'TNR',
                level: 'L-5'
            });
        }

        // Add Students (EMP)
        if (selectedDept.students && Array.isArray(selectedDept.students)) {
            selectedDept.students.forEach(student => {
                // Ensure we handle partial objects properly if needed
                users.push({
                    ...student,
                    type: 'EMP',
                    level: 'L-1'
                });
            });
        }

        return users;
    }, [selectedDepartment, departmentsData]);

    // Fetch Lines for Evaluation Dropdown based on Eval Department
    const { data: evalLinesData } = useGetLinesByDepartmentQuery(evalDepartment, {
        skip: !evalDepartment
    });

    // Memoize Department Users for Evaluation Tab
    const evalDepartmentUsers = React.useMemo(() => {
        if (!evalDepartment || !departmentsData?.data?.departments) return [];

        const selectedDept = departmentsData.data.departments.find(d => String(d._id) === String(evalDepartment));
        if (!selectedDept) return [];

        const users = [];

        // Add Instructor (TNR)
        if (selectedDept.instructor) {
            users.push({
                ...selectedDept.instructor,
                type: 'TNR'
            });
        }

        // Add Students (EMP)
        if (selectedDept.students && Array.isArray(selectedDept.students)) {
            selectedDept.students.forEach(student => {
                users.push({
                    ...student,
                    type: 'EMP'
                });
            });
        }

        return users;
    }, [evalDepartment, departmentsData]);

    const filteredEvalUsers = React.useMemo(() => {
        if (!evalDepartmentUsers) return [];
        
        // Filter by evalLine if selected
        let users = evalDepartmentUsers;
        if (evalLine) {
            // Filter users who belong to the selected line if applicable, or list all
            // To be safe, we list department users and search them
        }

        if (!evalSearchText.trim()) return users;
        const searchLower = evalSearchText.toLowerCase();
        return users.filter(u => 
            (u.fullName || u.name || "").toLowerCase().includes(searchLower) ||
            (u.cardNo || "").toLowerCase().includes(searchLower)
        );
    }, [evalDepartmentUsers, evalLine, evalSearchText]);

    // Initialize Matrix on Line Selection (Merge Logic)
    useEffect(() => {
        if (selectedLine && machinesData?.data) {
            const activeMachines = machinesData.data;
            const savedEntries = savedMatrixData?.data?.entries || [];

            // 1. Map Current Department Users (The Source of Truth for *Who* is here)
            const mappedData = departmentUsers.map((user, index) => {
                // Check if we have saved data for this user
                const savedUserEntry = savedEntries.find(e => e.userId === user._id);

                // Default stations (New User)
                const defaultStations = activeMachines.map(machine => ({
                    _id: machine._id,
                    name: machine.name,
                    critical: "Non-Critical",
                    min: "L-1",
                    curr: user.level,
                }));

                // Merged Stations (Existing User)
                // We map over ACTIVE machines to ensure if a machine was removed, it's gone, 
                // and if added, it appears (with default)
                const mergedStations = activeMachines.map(machine => {
                    const savedStation = savedUserEntry?.stations?.find(s => s.machineId === machine._id);
                    return {
                        _id: machine._id,
                        name: machine.name,
                        critical: savedStation?.critical || "Non-Critical",
                        min: savedStation?.min || "L-1",
                        curr: savedStation?.curr || user.level, // Prefer saved level, fallback to user default
                    };
                });

                let displayDepartment = "-";
                if (user.departments && user.departments.length > 0) {
                    displayDepartment = user.departments.map(d => d.name).join(" + ");
                } else if (user.department?.name) {
                    displayDepartment = user.department.name;
                }

                // Assigned Station
                const firstMachineId = activeMachines.length > 0 ? activeMachines[0]._id : "";
                const assignedStationId = savedUserEntry?.assignedStationId || firstMachineId;

                return {
                    srNo: index + 1,
                    _id: user._id,
                    name: user.fullName || "Unknown",
                    department: displayDepartment,
                    type: user.type,
                    detCas: savedUserEntry?.detCas || "",
                    doj: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : "-",
                    assignedStationId: assignedStationId,
                    stations: savedUserEntry ? mergedStations : defaultStations,
                    isManual: false
                };
            }).filter(Boolean);

            // 2. Add Manual Rows (Data that exists in Saved but not in Current Users, marked isManual)
            const manualRows = savedEntries.filter(e => e.isManual).map((entry, idx) => {
                // Re-map stations to current active machines
                const mergedStations = activeMachines.map(machine => {
                    const savedStation = entry.stations?.find(s => s.machineId === machine._id);
                    return {
                        _id: machine._id,
                        name: machine.name,
                        critical: savedStation?.critical || "Non-Critical",
                        min: savedStation?.min || "L-1",
                        curr: savedStation?.curr || "L-0",
                    };
                });

                return {
                    ...entry,
                    srNo: mappedData.length + idx + 1,
                    stations: mergedStations
                };
            });

            setMatrixEntries([...mappedData, ...manualRows]);

            // Update Header/Footer from Saved Data if available
            if (savedMatrixData?.data?.headerInfo) {
                setHeaderInfo(savedMatrixData.data.headerInfo);
            }
            if (savedMatrixData?.data?.footerInfo) {
                if (savedMatrixData.data.footerInfo.guidelines) setGuidelines(savedMatrixData.data.footerInfo.guidelines);
                if (savedMatrixData.data.footerInfo.legendNote) setLegendNote(savedMatrixData.data.footerInfo.legendNote);
                if (savedMatrixData.data.footerInfo.revisions) setRevisions(savedMatrixData.data.footerInfo.revisions);
            }

        } else if (!selectedLine) {
            setMatrixEntries([]);
        }
    }, [selectedLine, machinesData, departmentUsers, savedMatrixData]);

    useEffect(() => {
        setSelectedOperatorForEval(null);
    }, [selectedDepartment, selectedLine]);

    useEffect(() => {
        const actualOps = matrixEntries.filter(e => !e.isManual);
        if (actualOps.length > 0 && !selectedOperatorForEval) {
            setSelectedOperatorForEval(actualOps[0]._id);
        }
    }, [matrixEntries, selectedOperatorForEval]);

    const handleSave = async () => {
        if (!selectedDepartment || !selectedLine) {
            toast.error("Please select Department and Line first");
            return;
        }

        try {
            // Transform matrixEntries to match Scheme
            const entriesToSave = matrixEntries.map(entry => ({
                userId: entry.isManual ? null : entry._id,
                manualName: entry.isManual ? entry.name : "",
                isManual: entry.isManual,
                doj: entry.doj,
                assignedStationId: entry.assignedStationId,
                detCas: entry.detCas,
                stations: entry.stations.map(s => ({
                    machineId: s._id,
                    name: s.name,
                    level: 0, // Not used strictly, relying on curr
                    critical: s.critical,
                    min: s.min,
                    curr: s.curr
                }))
            }));

            const payload = {
                department: selectedDepartment,
                line: selectedLine,
                entries: entriesToSave,
                headerInfo: headerInfo,
                footerInfo: {
                    guidelines,
                    legendNote,
                    revisions
                }
            };

            await saveSkillMatrix(payload).unwrap();
            toast.success("Skill Matrix saved successfully!");
            refetchMatrix();
        } catch (error) {
            console.error("Failed to save matrix:", error);
            toast.error(error?.data?.message || "Failed to save Skill Matrix");
        }
    };


    // --- Handlers ---

    const handleAddRow = () => {
        if (!machinesData?.data) return;
        const activeMachines = machinesData.data;

        const stations = activeMachines.map(machine => ({
            _id: machine._id,
            name: machine.name,
            critical: "Non-Critical",
            min: "L-1",
            curr: "L-1",
        }));

        const firstMachineId = activeMachines.length > 0 ? activeMachines[0]._id : "";

        setMatrixEntries(prev => [
            ...prev,
            {
                srNo: prev.length + 1,
                _id: `manual-${Date.now()}`,
                name: "",
                department: "-",
                type: "",
                detCas: "",
                doj: "-",
                assignedStationId: firstMachineId,
                stations: stations,
                isManual: true // FLAGGED AS MANUAL / EDITABLE
            }
        ]);
    };

    const handleUserSelect = (rowIdx, userId) => {
        const user = departmentUsers.find(u => u._id === userId);
        if (!user) return;

        const updatedEntries = [...matrixEntries];
        const row = updatedEntries[rowIdx];

        let displayDepartment = "-";
        if (user.departments && user.departments.length > 0) {
            displayDepartment = user.departments.map(d => d.name).join(" + ");
        } else if (user.department?.name) {
            displayDepartment = user.department.name;
        }

        updatedEntries[rowIdx] = {
            ...row,
            _id: user._id, // Update to real ID
            name: user.fullName,
            department: displayDepartment,
            type: user.type,
            doj: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : "-",
            stations: row.stations.map(s => ({ ...s, curr: user.level || 'L-1' })), // Reset stations to user level
            isManual: false // Lock it after selection? Or keep true to allow changing? 
            // "operator name have to drop down" implies it might stay a dropdown. 
            // Let's keep isManual true if we want it to remain editable, 
            // OR better: Add a field `isSelector: true`. 
            // Let's set `isManual` to false to "commit" it, but maybe allow re-editing? 
            // For now, commit it so it looks like other rows.
        };
        setMatrixEntries(updatedEntries);
    };

    const handleLevelChange = (rowIdx, stationIdx, newLevel) => {
        const updatedEntries = [...matrixEntries];
        updatedEntries[rowIdx].stations[stationIdx].curr = newLevel;
        setMatrixEntries(updatedEntries);
    };

    const handleCriticalityChange = (rowIdx, stationIdx, value) => {
        const updatedEntries = [...matrixEntries];
        updatedEntries[rowIdx].stations[stationIdx].critical = value;
        setMatrixEntries(updatedEntries);
    };

    const handleDetCasChange = (index, value) => {
        const updatedEntries = [...matrixEntries];
        updatedEntries[index].detCas = value;
        setMatrixEntries(updatedEntries);
    };

    const handleAssignedStationChange = (index, value) => {
        const updatedEntries = [...matrixEntries];
        updatedEntries[index].assignedStationId = value;
        setMatrixEntries(updatedEntries);
    };

    // Header Info State
    const [headerInfo, setHeaderInfo] = useState({
        formatNo: "F-HRM-03-001",
        revNo: "8",
        revDate: "03-06-2025",
        pageNo: "1"
    });

    const handleHeaderInfoChange = (field, value) => {
        setHeaderInfo(prev => ({ ...prev, [field]: value }));
    };

    // Legend Note State
    const [legendNote, setLegendNote] = useState(
        "This is a dynamically generated matrix based on current machine and user assignments."
    );

    // Footer Data State
    const [guidelines, setGuidelines] = useState(
        "1) This Skill Matrix Format aplicable for All department.\n" +
        "2) Minimum Skill Level Required for Working on Line/ Machine as per Guideline of Critical & Non critical operation .(GL/MF01/Training/03)\n" +
        "3) Critical & Non Critical Define as per Guideline of Critical & Non Critical operation.(GL/MF01/Training/03)\n" +
        "4) Level-4 is Minimum skill required for Team leader .\n" +
        "5) Level-1 is Minimum Skill requirement for Machine / Non Critical Station operator.\n" +
        "6) Level-2 is minimum Skill requirement for Inspector , Final Inspector & Rework Station Operator.\n" +
        "7) Level -3 is minimum skill requirement for CTQ station operator & mold changer operator.\n" +
        "8) Skill Matrix updated frequency after 3 month.\n" +
        "9) Skill matrix Checked by Line Supervisor or Shift Incharge.\n" +
        "10) After certify a new commerce operator , the skill matrix has to be updated within the 7 Days.\n" +
        "11)EOSH AND EnMS MINIMUM SKILL REQUIRED IS- L1"
    );

    const [revisions, setRevisions] = useState([
        { date: "05-03-2021", revNo: "4", change: "New comers Skill matrix frequency Added", reason: "customer requirement" },
        { date: "28-07-2022", revNo: "5", change: "Skill Matrix review By Supervisor", reason: "customer requirement" },
        { date: "02-09-2024", revNo: "6", change: "Minimum Skill Level define", reason: "VSA Audit NC" },
        { date: "24-05-2025", revNo: "7", change: "Qualification define", reason: "TRL audit point" },
        { date: "03-06-2025", revNo: "8", change: "EnMS ,EOHS content added", reason: "EnMS & EOHS audit required and skill level symbols change" }
    ]);

    const handleRevisionChange = (index, field, value) => {
        const updatedRevisions = [...revisions];
        updatedRevisions[index][field] = value;
        setRevisions(updatedRevisions);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = async () => {
        if (!selectedLine || matrixEntries.length === 0) {
            toast.error("No data to export");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Skill Matrix');

        // --- Styles ---
        const borderStyle = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        const centerStyle = { vertical: 'middle', horizontal: 'center', wrapText: true };
        const headerFont = { bold: true };

        // --- Header Section ---
        // Validate headerInfo and set defaults if missing
        const hInfo = headerInfo || {};
        const getVal = (val, defaultVal = "-") => val || defaultVal;

        // Custom Header Layout (Approximating the UI)
        worksheet.mergeCells('A1:C4'); // Logo Area
        const logoCell = worksheet.getCell('A1');
        logoCell.value = "Furukawa Minda"; // Placeholder for Logo
        logoCell.alignment = centerStyle;
        logoCell.font = { size: 16, bold: true };
        logoCell.border = borderStyle;

        worksheet.mergeCells('D1:O4'); // Title Area
        const titleCell = worksheet.getCell('D1');
        titleCell.value = `SKILL MATRIX\nLine: ${lineName}\nDepartment: ${selectedDeptName}`;
        titleCell.alignment = centerStyle;
        titleCell.font = { size: 14, bold: true };
        titleCell.border = borderStyle;

        // Header Info (Right Side)
        const addHeaderInfoRow = (row, label, value) => {
            worksheet.mergeCells(`P${row}:Q${row}`);
            worksheet.getCell(`P${row}`).value = label;
            worksheet.getCell(`P${row}`).border = borderStyle;
            worksheet.getCell(`P${row}`).font = { bold: true };

            worksheet.mergeCells(`R${row}:S${row}`);
            worksheet.getCell(`R${row}`).value = value;
            worksheet.getCell(`R${row}`).border = borderStyle;
            worksheet.getCell(`R${row}`).alignment = { horizontal: 'center' };
        };

        addHeaderInfoRow(1, "Format No:", getVal(hInfo.formatNo));
        addHeaderInfoRow(2, "Rev. No:", getVal(hInfo.revNo));
        addHeaderInfoRow(3, "Rev. Date:", getVal(hInfo.revDate));
        addHeaderInfoRow(4, "Page No:", getVal(hInfo.pageNo));

        worksheet.addRow([]); // Spacer

        // --- Table Headers ---
        // Row 6: Main Headers
        const headerRowIndex = 6;
        const headers = ["Sr No", "ID", "Name", "Department", "Type", "DOJ", "Assigned Station"];

        // Machine Columns
        const machines = machinesData?.data || [];
        machines.forEach(m => headers.push(m.name));

        // Legend Columns
        headers.push("Machine Name", "Criticality", "Min Skill", "Current Skill");

        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.values = headers;

        headerRow.eachCell((cell) => {
            cell.font = headerFont;
            cell.alignment = centerStyle;
            cell.border = borderStyle;
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        });

        // --- Data Rows ---
        matrixEntries.forEach((entry, index) => {
            const rowData = [
                entry.srNo,
                entry.isManual ? "-" : entry._id, // Hide ID for manual rows if needed, or show manual ID
                entry.name,
                entry.department,
                entry.type,
                entry.doj,
                entry.assignedStationId ? machines.find(m => m._id === entry.assignedStationId)?.name || "-" : "-"
            ];

            // Machine Skills (Icons in UI -> Text in Excel)
            machines.forEach((machine) => {
                const station = entry.stations.find(s => s._id === machine._id);
                // In UI it shows icon. In Excel we can show Level No (e.g. 4)
                if (station) {
                    const levelNum = station.curr ? parseInt(station.curr.replace('L-', '')) || 0 : 0;
                    rowData.push(levelNum > 0 ? `L-${levelNum}` : "");
                } else {
                    rowData.push("-");
                }
            });

            // Assigned Station Details (Legend Columns)
            // In the UI these are inputs/selects.
            const assignedStation = entry.stations.find(s => s._id === entry.assignedStationId);
            rowData.push(
                assignedStation?.name || "-",
                assignedStation?.critical || "-",
                assignedStation?.min || "-",
                assignedStation?.curr || "-"
            );

            const currentRow = worksheet.addRow(rowData);
            currentRow.eachCell((cell) => {
                cell.border = borderStyle;
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            });
        });

        worksheet.addRow([]); // Spacer

        // --- Footer Sections ---
        const footerStartRow = worksheet.rowCount + 2;

        // Guidelines
        worksheet.mergeCells(`A${footerStartRow}:H${footerStartRow + 6}`);
        const guidelineCell = worksheet.getCell(`A${footerStartRow}`);
        guidelineCell.value = "NOTES / GUIDELINE:\n" + (guidelines || "");
        guidelineCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        guidelineCell.border = borderStyle;

        // Legend Note
        worksheet.mergeCells(`I${footerStartRow}:K${footerStartRow + 6}`);
        const legendCell = worksheet.getCell(`I${footerStartRow}`);
        legendCell.value = "LEVEL LEGEND:\n" +
            "L-0: No Skill\nL-1: Learner\nL-2: Executor\nL-3: Trainer\nL-4: Expert\n\nNote: " + (legendNote || "-");
        legendCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        legendCell.border = borderStyle;

        // Revision History
        // Simple table for revision history
        worksheet.mergeCells(`L${footerStartRow}:S${footerStartRow}`);
        const revTitle = worksheet.getCell(`L${footerStartRow}`);
        revTitle.value = "REVISION HISTORY";
        revTitle.font = { bold: true };
        revTitle.alignment = centerStyle;
        revTitle.border = borderStyle;

        const revHeaders = ["Rev Date", "Rev No", "What Change", "Why Change"];
        // We'll put headers in next row, but merged cells make it tricky. 
        // Let's simplified: List revisions below title
        let revRowIdx = footerStartRow + 1;

        // Headers
        worksheet.getCell(`L${revRowIdx}`).value = "Date";
        worksheet.getCell(`M${revRowIdx}`).value = "No";
        worksheet.mergeCells(`N${revRowIdx}:P${revRowIdx}`); worksheet.getCell(`N${revRowIdx}`).value = "Change";
        worksheet.mergeCells(`Q${revRowIdx}:S${revRowIdx}`); worksheet.getCell(`Q${revRowIdx}`).value = "Reason";

        // Style Headers
        [`L${revRowIdx}`, `M${revRowIdx}`, `N${revRowIdx}`, `Q${revRowIdx}`].forEach(ref => {
            const c = worksheet.getCell(ref);
            c.font = { bold: true };
            c.border = borderStyle;
            c.alignment = centerStyle;
        });

        revRowIdx++;

        (revisions || []).forEach(rev => {
            if (revRowIdx > footerStartRow + 6) return; // Limit rows
            worksheet.getCell(`L${revRowIdx}`).value = rev.date;
            worksheet.getCell(`M${revRowIdx}`).value = rev.revNo;

            worksheet.mergeCells(`N${revRowIdx}:P${revRowIdx}`);
            worksheet.getCell(`N${revRowIdx}`).value = rev.change;

            worksheet.mergeCells(`Q${revRowIdx}:S${revRowIdx}`);
            worksheet.getCell(`Q${revRowIdx}`).value = rev.reason;

            [`L${revRowIdx}`, `M${revRowIdx}`, `N${revRowIdx}`, `Q${revRowIdx}`].forEach(ref => {
                const c = worksheet.getCell(ref);
                c.border = borderStyle;
                c.alignment = centerStyle;
            });
            revRowIdx++;
        });


        // --- Signatures ---
        const sigRow = worksheet.rowCount + 2;
        worksheet.mergeCells(`A${sigRow}:F${sigRow}`);
        worksheet.getCell(`A${sigRow}`).value = "Prepared By";
        worksheet.getCell(`A${sigRow}`).border = borderStyle;

        worksheet.mergeCells(`G${sigRow}:L${sigRow}`);
        worksheet.getCell(`G${sigRow}`).value = "Checked By";
        worksheet.getCell(`G${sigRow}`).border = borderStyle;

        worksheet.mergeCells(`M${sigRow}:S${sigRow}`);
        worksheet.getCell(`M${sigRow}`).value = "Approved By";
        worksheet.getCell(`M${sigRow}`).border = borderStyle;

        const sigValRow = sigRow + 1;
        worksheet.mergeCells(`A${sigValRow}:F${sigValRow + 2}`);
        worksheet.getCell(`A${sigValRow}`).border = borderStyle;

        worksheet.mergeCells(`G${sigValRow}:L${sigValRow + 2}`);
        worksheet.getCell(`G${sigValRow}`).border = borderStyle;

        worksheet.mergeCells(`M${sigValRow}:S${sigValRow + 2}`);
        worksheet.getCell(`M${sigValRow}`).border = borderStyle;


        // Set column widths
        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `SkillMatrix_${selectedDeptName}_${lineName}.xlsx`);
    };

    const parseLevel = (levelStr) => {
        if (!levelStr) return 0;
        const num = parseInt(levelStr.replace(/\D/g, ''));
        return isNaN(num) ? 0 : num;
    };

    // SVG Icon Component
    const SkillIcon = ({ level, size = 24 }) => {
        const center = size / 2;
        const radius = size / 2.2;
        const createSlicePath = (startAngle, endAngle) => {
            const startRad = (startAngle - 90) * Math.PI / 180;
            const endRad = (endAngle - 90) * Math.PI / 180;
            const x1 = center + radius * Math.cos(startRad);
            const y1 = center + radius * Math.sin(startRad);
            const x2 = center + radius * Math.cos(endRad);
            const y2 = center + radius * Math.sin(endRad);
            return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
        };
        const slices = [
            createSlicePath(0, 72),
            createSlicePath(72, 144),
            createSlicePath(144, 216),
            createSlicePath(216, 288),
            createSlicePath(288, 360)
        ];
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {slices.map((d, i) => (
                    <path key={`bg-${i}`} d={d} fill="none" stroke="black" strokeWidth="0.5" />
                ))}
                {slices.map((d, i) => {
                    if (i < level) {
                        return <path key={`fill-${i}`} d={d} fill="black" stroke="black" strokeWidth="0.5" />;
                    }
                    return null;
                })}
                <circle cx={center} cy={center} r={radius} fill="none" stroke="black" strokeWidth="1" />
            </svg>
        );
    };

    const selectedDeptName = departmentsData?.data?.departments?.find(d => String(d._id) === String(selectedDepartment))?.name || "Select Department";
    const selectedLineDetail = linesData?.data?.find(l => String(l._id) === String(selectedLine));
    const lineName = selectedLineDetail?.name || "Select Line";

    return (
        <div className="space-y-6">
            <style>
                {`
          @media print {
            @page { size: landscape; margin: 10mm; }
            body * { visibility: hidden; }
            #printable-matrix, #printable-matrix * { visibility: visible; }
            #printable-matrix { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            /* Hide select carets/borders in print */
            .select-trigger { border: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; }
            textarea { border: none !important; resize: none !important; }
            input { border: none !important; background: transparent !important; }
          }
            .select-trigger { border: none !important; padding: 0 !important; height: auto !important; }
          }
        `}
            </style>

            {/* Selection Header (No Print) */}
            <div className="no-print bg-white p-4 rounded-lg shadow-sm border space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Skill Matrix Generator</h1>
                        <p className="text-sm text-gray-500">Select Department and Line to generate matrix</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div className="w-[250px]">
                        <Select value={selectedDepartment} onValueChange={(val) => { setSelectedDepartment(val); setSelectedLine(""); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departmentsData?.data?.departments?.map(dept => (
                                    <SelectItem key={String(dept._id)} value={String(dept._id)}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-[250px]">
                        <Select value={selectedLine} onValueChange={setSelectedLine} disabled={!selectedDepartment}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Line" />
                            </SelectTrigger>
                            <SelectContent>
                                {linesData?.data?.map(line => (
                                    <SelectItem key={String(line._id)} value={String(line._id)}>{line.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="ml-auto flex gap-2">
                        <Button onClick={handleAddRow} disabled={!selectedLine} variant="outline" className="gap-2">
                            Add Operator
                        </Button>
                        <Button onClick={handlePrint} disabled={!selectedLine || matrixEntries.length === 0} className="gap-2">
                            <IconPrinter className="h-4 w-4" />
                            Print
                        </Button>
                        <Button onClick={handleExport} disabled={!selectedLine || matrixEntries.length === 0} variant="outline" className="gap-2 border-green-600 text-green-600 hover:bg-green-50">
                            <IconDownload className="h-4 w-4" />
                            Export Excel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || !selectedLine} className="gap-2 bg-green-600 hover:bg-green-700">
                            {isSaving ? <IconLoader className="animate-spin h-4 w-4" /> : <IconDeviceFloppy className="h-4 w-4" />}
                            Save Data
                        </Button>
                    </div>
                </div>
            </div>

            {/* Matrix Display */}
            {!selectedLine ? (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
                    Please select a Department and Line to view the Skill Matrix.
                </div>
            ) : isMachinesLoading || isLinesLoading ? (
                <div className="flex justify-center py-10"><IconLoader className="animate-spin" /></div>
            ) : matrixEntries.length === 0 ? (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
                    No users or machines found for this selection.
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="no-print mb-4 flex gap-2 w-fit bg-gray-100 p-1 rounded-md">
                        <TabsTrigger value="skillMatrix" className="text-xs font-bold px-4 py-2">Skill Matrix</TabsTrigger>
                        <TabsTrigger value="evaluation" className="text-xs font-bold px-4 py-2">Skill Matrix Evaluation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="skillMatrix" className="space-y-4">
                        <div id="printable-matrix" className="bg-white text-xs text-black border-2 border-black">
                    {/* Header Section */}
                    <div className="flex border-b border-black">
                        <div className="w-[150px] border-r border-black p-2 flex items-center justify-center">
                            <img src="/fme_transparent.png" alt="Logo" className="h-10" />
                            <div className="flex flex-col ml-2">
                                <span className="font-bold text-xs text-red-600">motherson</span>
                                <span className="font-bold text-xs text-blue-600">MARELLI</span>
                            </div>
                        </div>
                        <div className="flex-1 border-r border-black flex items-center justify-center">
                            <h1 className="text-2xl font-bold">Skill Matrix - {lineName}</h1>
                        </div>
                        <div className="w-[200px] text-[10px]">
                            {['Format no.', 'Rev.No.', 'Rev. Date', 'Page No.'].map((label, idx) => (
                                <div key={label} className="flex border-b border-black last:border-b-0">
                                    <div className="w-20 border-r border-black p-1 font-semibold">{label}</div>
                                    <div className="flex-1 p-0 text-center">
                                        <input
                                            type="text"
                                            className="w-full h-full text-center bg-transparent border-none focus:ring-0 p-1 font-medium"
                                            value={headerInfo[Object.keys(headerInfo)[idx]] || ""}
                                            onChange={(e) => handleHeaderInfoChange(Object.keys(headerInfo)[idx], e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex border-b border-black text-xs font-semibold bg-gray-50">
                        <div className="w-[30%] border-r border-black p-1">Plant : MMLI,Pune</div>
                        <div className="flex-1 p-1 text-right pr-10">Department : <span className="ml-4">{selectedDeptName}</span></div>
                    </div>

                    {/* Table Header */}
                    <div className="flex border-b border-black text-[10px] font-bold bg-gray-200 text-center">
                        <div className="w-8 border-r border-black p-2 flex items-center justify-center">Sr.No.</div>
                        <div className="w-32 border-r border-black p-2 flex items-center justify-center">OPERATOR NAME</div>
                        <div className="w-12 border-r border-black p-2 flex items-center justify-center">TNR/EMP</div>
                        <div className="w-16 border-r border-black p-2 flex items-center justify-center">DET/CAS</div>
                        <div className="w-20 border-r border-black p-2 flex items-center justify-center">DOJ</div>
                        <div className="w-32 border-r border-black p-2 flex items-center justify-center bg-gray-100">Station / Machine Name</div>
                        <div className="w-24 border-r border-black p-2 flex items-center justify-center bg-gray-100 text-[9px] leading-tight">Critical & Non Critical</div>
                        <div className="w-16 border-r border-black p-2 flex items-center justify-center bg-gray-100 text-[9px] leading-tight">Minimum Skill Level Required</div>
                        <div className="w-16 border-r border-black p-2 flex items-center justify-center bg-gray-100 text-[9px] leading-tight">Current Skill Level</div>

                        <div className="flex-1 flex overflow-x-auto">
                            {matrixEntries[0]?.stations?.map((station) => (
                                <div key={String(station._id)} className="w-20 border-r border-black p-1 flex items-center justify-center text-[9px] font-bold break-words text-center min-w-[60px]">
                                    {station.name}
                                </div>
                            ))}
                            <div className="w-16 p-1 flex items-center justify-center text-[9px] font-bold">EOSH & EnMS</div>
                        </div>
                    </div>

                    {/* Data Rows */}
                    {matrixEntries.map((row, idx) => (
                        <div key={row._id} className="flex border-b border-black text-[10px] text-center min-h-[50px]">
                            <div className="w-8 border-r border-black p-2 flex items-center justify-center font-bold">{row.srNo}</div>
                            <div className="w-32 border-r border-black p-2 flex items-center justify-start font-bold text-left min-w-[128px]">
                                {row.isManual ? (
                                    <Select onValueChange={(val) => handleUserSelect(idx, val)}>
                                        <SelectTrigger className="w-full h-8 text-[10px]">
                                            <SelectValue placeholder="Select Operator" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departmentUsers.map(u => (
                                                <SelectItem key={String(u._id)} value={String(u._id)}>{u.fullName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setEvalDepartment(selectedDepartment);
                                            setEvalLine(selectedLine);
                                            setSelectedOperatorForEval(row._id);
                                            setActiveTab("evaluation");
                                        }}
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-left w-full"
                                        title="Click to view/edit Skill Matrix Evaluation Certificate"
                                    >
                                        {row.name}
                                    </button>
                                )}
                            </div>
                            <div className="w-12 border-r border-black p-2 flex items-center justify-center font-bold">{row.type}</div>
                            <div className="w-16 border-r border-black p-2 flex items-center justify-center font-bold">
                                <input
                                    type="text"
                                    className="w-full h-full text-center bg-transparent border-none focus:ring-0 p-0 text-[10px] font-bold"
                                    value={row.detCas}
                                    onChange={(e) => handleDetCasChange(idx, e.target.value)}
                                />
                            </div>
                            <div className="w-20 border-r border-black p-2 flex items-center justify-center font-bold">{row.doj}</div>

                            {/* Assigned Station Details */}
                            {(() => {
                                const assignedStation = row.stations.find(s => s._id === row.assignedStationId) || row.stations[0];
                                return (
                                    <>
                                        <div className="w-32 border-r border-black p-1 flex items-center justify-center">
                                            {row.type === 'TNR' ? (
                                                <span className="text-[9px] font-bold">Team Leader</span>
                                            ) : (
                                                <Select value={String(row.assignedStationId || "")} onValueChange={(val) => handleAssignedStationChange(idx, val)}>
                                                    <SelectTrigger className="w-full h-full border-none p-1 text-[9px] font-bold bg-transparent">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {row.stations.map(s => (
                                                            <SelectItem key={String(s._id)} value={String(s._id)} className="text-xs">{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <div className="w-24 border-r border-black p-2 flex items-center justify-center font-bold text-[9px]">
                                            {row.type === 'TNR' ? (
                                                <span className="text-[9px] font-bold">Not Applicable</span>
                                            ) : (
                                                <Select value={assignedStation?.critical || ""} onValueChange={(val) => {
                                                    // Find the index of the assigned station in the stations array
                                                    const sIdx = row.stations.findIndex(s => String(s._id) === String(row.assignedStationId));
                                                    if (sIdx !== -1) handleCriticalityChange(idx, sIdx, val);
                                                }}>
                                                    <SelectTrigger className="w-full h-full border-none p-0 text-[9px] font-bold bg-transparent">
                                                        <div className="truncate">{assignedStation?.critical || "-"}</div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Critical">Critical</SelectItem>
                                                        <SelectItem value="Non-Critical">Non-Critical</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                        <div className="w-16 border-r border-black p-2 flex items-center justify-center font-bold">{assignedStation?.min || "-"}</div>
                                        <div className="w-16 border-r border-black p-2 flex items-center justify-center font-bold">{assignedStation?.curr || "-"}</div>
                                    </>
                                );
                            })()}

                            <div className="flex-1 flex overflow-x-auto">
                                {row.stations.map((station, sIdx) => {
                                    const currentLevelStr = station.curr || "L-0";
                                    const level = parseLevel(currentLevelStr);

                                    return (
                                        <div key={String(station._id)} className="w-20 border-r border-black flex items-center justify-center min-w-[60px] p-1">
                                            <Select
                                                value={currentLevelStr}
                                                onValueChange={(val) => handleLevelChange(idx, sIdx, val)}
                                            >
                                                <SelectTrigger className="w-full h-full border-none p-0 flex justify-center bg-transparent focus:ring-0 select-trigger">
                                                    <div>
                                                        {level > 0 ? <SkillIcon level={level} size={20} /> : <div className="h-5 w-5 rounded-full border border-gray-300"></div>}
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableLevels.map((lvl) => (
                                                        <SelectItem key={String(lvl.name)} value={String(lvl.name)}>
                                                            <div className="flex items-center gap-2">
                                                                <SkillIcon level={parseLevel(lvl.name)} size={16} />
                                                                <span>{lvl.name}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                                <div className="w-16 p-2 flex items-center justify-center">
                                    <SkillIcon level={1} />
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Footer Legend */}
                    <div className="flex border-t border-black min-h-[100px]">
                        <div className="w-[350px] border-r border-black p-2 text-[10px]">
                            <div className="font-bold mb-1">Level Legend:</div>
                            {availableLevels.map((lvl) => (
                                <div key={lvl.name} className="flex items-center gap-2 mb-2">
                                    <SkillIcon level={parseLevel(lvl.name)} size={20} />
                                    <div className="flex flex-col">
                                        <span className="font-bold">{lvl.name}</span>
                                        <span className="text-[9px] text-gray-600 leading-tight">{lvl.description || ""}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 p-2 text-[10px] flex flex-col">
                            <div className="font-bold underline mb-1">Note:</div>
                            <textarea
                                className="w-full h-full text-[10px] resize-none border-none outline-none bg-transparent whitespace-pre-wrap"
                                value={legendNote}
                                onChange={(e) => setLegendNote(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Notes & GuideLine + Revision History Section */}
                    <div className="flex border-t border-black min-h-[150px]">
                        {/* Notes / Guidelines (Editable) */}
                        <div className="w-[60%] border-r border-black p-2 flex flex-col">
                            <div className="font-bold text-[10px] mb-1">Note/ Guideline :-</div>
                            <textarea
                                className="w-full h-full text-[9px] leading-tight resize-none border-none outline-none bg-transparent whitespace-pre-wrap"
                                value={guidelines}
                                onChange={(e) => setGuidelines(e.target.value)}
                            />
                        </div>

                        {/* Revision History (Editable) */}
                        <div className="w-[40%] text-[9px]">
                            {/* Header */}
                            <div className="flex bg-yellow-300 font-bold border-b border-black text-center">
                                <div className="w-16 border-r border-black p-1">Rev Date</div>
                                <div className="w-10 border-r border-black p-1">Rev no</div>
                                <div className="flex-1 border-r border-black p-1">What Change</div>
                                <div className="w-20 p-1">Why Change</div>
                            </div>
                            {/* Rows */}
                            {revisions.map((rev, idx) => (
                                <div key={`${rev.revNo}-${idx}`} className="flex border-b border-black text-center h-[30px]">
                                    <div className="w-16 border-r border-black p-0 h-full">
                                        <input
                                            value={rev.date}
                                            onChange={(e) => handleRevisionChange(idx, 'date', e.target.value)}
                                            className="w-full h-full text-center bg-transparent border-none outline-none p-1"
                                        />
                                    </div>
                                    <div className="w-10 border-r border-black p-0 h-full">
                                        <input
                                            value={rev.revNo}
                                            onChange={(e) => handleRevisionChange(idx, 'revNo', e.target.value)}
                                            className="w-full h-full text-center bg-transparent border-none outline-none p-1"
                                        />
                                    </div>
                                    <div className="flex-1 border-r border-black p-0 h-full">
                                        <input
                                            value={rev.change}
                                            onChange={(e) => handleRevisionChange(idx, 'change', e.target.value)}
                                            className="w-full h-full text-center bg-transparent border-none outline-none p-1"
                                        />
                                    </div>
                                    <div className="w-20 p-0 h-full">
                                        <input
                                            value={rev.reason}
                                            onChange={(e) => handleRevisionChange(idx, 'reason', e.target.value)}
                                            className="w-full h-full text-center bg-transparent border-none outline-none p-1"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer Info / Signatures */}
                    <div className="border-t border-black">
                        <div className="p-1 text-[10px] font-bold border-b border-black pl-2">
                            Rev. History - Rev-06- Operation wise Minimum Skill define
                        </div>
                        <div className="flex justify-between text-[8px] p-2 pt-8 pb-2">
                            <div>Prepared by ( DOSJO ) :-</div>
                            <div>Checked by ( Supervisor ) :-</div>
                            <div>Approved Vy ( HOD ) :-</div>
                        </div>
                    </div>
                </div>
                    </TabsContent>

                    <TabsContent value="evaluation" className="space-y-6">
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
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Department</label>
                                    <Select value={evalDepartment} onValueChange={(val) => {
                                        setEvalDepartment(val);
                                        setEvalLine("");
                                        setSelectedOperatorForEval(null);
                                    }}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Select Department" /></SelectTrigger>
                                        <SelectContent>
                                            {departmentsData?.data?.departments?.map(dept => (
                                                <SelectItem key={String(dept._id)} value={String(dept._id)}>{dept.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Line</label>
                                    <Select value={evalLine} onValueChange={(val) => {
                                        setEvalLine(val);
                                        setSelectedOperatorForEval(null);
                                    }} disabled={!evalDepartment}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="All Lines" /></SelectTrigger>
                                        <SelectContent>
                                            {evalLinesData?.data?.map(line => (
                                                <SelectItem key={String(line._id)} value={String(line._id)}>{line.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="flex flex-col gap-1 sm:col-span-2">
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
                                                {u.fullName || u.name} {u.cardNo ? `(${u.cardNo})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {selectedOperatorForEval ? (
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
                                        filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.cardNo ||
                                        filteredEvalUsers.find(e => e._id === selectedOperatorForEval)?.empId || ""
                                    }
                                    departmentId={evalDepartment || selectedDepartment}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                                No operator selected. Please select a Department and filter/search for an operator from the criteria above.
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
};

export default InstructorSkillMatrix;
