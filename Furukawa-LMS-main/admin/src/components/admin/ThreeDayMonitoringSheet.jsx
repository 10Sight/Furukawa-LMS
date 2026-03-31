import React, { useEffect, useState } from 'react';
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportHelper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, History, Loader2, Save, Download } from "lucide-react";

const DEFAULT_MONITORING_CONFIG = [
    {
        id: "cat1",
        category: "10 Cycle Check :\n1st time - 4 Part\n2nd time- 3 Part\n3rd time- 3 Part",
        rows: [
            { id: "row1_1", label: "Follow the work sequence as per WI & Check the all check point as per WI", weight: 2, type: "cycle_detailed" },
            { id: "row1_2", label: "Operator should complete the Job in given cycle time", weight: 2, type: "cycle_detailed", hasCT: true, ctLabel: "C/T" },
            { id: "row1_3", label: "Adherence of 4'S (Sort. arrangement. clean. adherence)", weight: 2, type: "cycle_detailed" }
        ],
        totalMark: 6,
        target: "100%"
    },
    {
        id: "cat2",
        category: "Quality / System",
        rows: [
            { id: "row2_1", label: "Operator should know about purpose of work & impact at customer end", weight: 2 },
            { id: "row2_2", label: "Check an awareness of operator about defect in product & past defect in product", weight: 2 },
            { id: "row2_3", label: "Operator should know about OK & NG part judgment", weight: 2 },
            { id: "row2_4", label: "Operator should about NC part handling & follow during process", weight: 2 }
        ],
        totalMark: 8,
        target: "100%"
    },
    {
        id: "cat3",
        category: "Non defective products Produced",
        rows: [
            { id: "prodPlan", label: "Total Prod. plan", weight: "-" },
            { id: "defectFree", label: "Defect free product", weight: "-" }
        ],
        target: "100%",
        hasTargetInGrid: true,
        actualLabel: "Actual %"
    },
    {
        id: "cat4",
        category: "Discipline",
        rows: [
            { id: "row4_1", label: "Attends the daily meeting with good level of listening and understanding", weight: 2 },
            { id: "row4_2", label: "Operator should aware about daily machine check point and clean machine on daily basis before production start", weight: 2 },
            { id: "row4_3", label: "Whenever if any defect or work related problem is there , he immediately contacts with line leader or his senior person with doing any delay or sitting idle.", weight: 2 },
            { id: "row4_4", label: "During any break operator clear the WIP / Insp. Part from his / her station and move to next process, leave work station after completing the job.", weight: 2 }
        ],
        totalMark: 8,
        target: "(EXCELLENT - 100 %)"
    },
    {
        id: "cat5",
        category: "Safety",
        rows: [
            { id: "row5_1", label: "Operator should aware about Safety principles", weight: 2 },
            { id: "row5_2", label: "Operator should wear PPE as per PPE matrix", weight: 2 }
        ],
        totalMark: 4,
        target: "100%",
        actualLabel: "% age followed"
    }
];


const ThreeDayMonitoringSheet = ({ studentId, departmentId, readOnly = false }) => {
    const [headerInfo, setHeaderInfo] = useState({
        employeeName: "",
        employeeCode: "",
        processName: "",
        dept: "",
        handoverDate: "",
        trgResult: "",
        workingWith: "",
        lineLeaderName: ""
    });

    const [gridData, setGridData] = useState({});
    const [footerData, setFooterData] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(DEFAULT_MONITORING_CONFIG);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [configJson, setConfigJson] = useState('');
    const [configRemark, setConfigRemark] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [lines, setLines] = useState([]);
    const [stations, setStations] = useState([]);

    useEffect(() => {
        fetchData();
        fetchConfig();
    }, [studentId, departmentId]);

    const fetchLines = async (deptId) => {
        if (!deptId) return;
        try {
            const response = await axiosInstance.get(`/api/lines?departmentId=${deptId}`);
            if (response.data.success) {
                setLines(response.data.data);
                return response.data.data;
            }
        } catch (error) {
            console.error("Error fetching lines:", error);
        }
        return [];
    };

    const fetchStations = async (lineId) => {
        if (!lineId) return;
        try {
            const response = await axiosInstance.get(`/api/machines/line/${lineId}`);
            if (response.data.success) {
                console.log(`[DEBUG] Stations fetched for line ${lineId}:`, response.data.data);
                setStations(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching stations:", error);
        }
    };

    const fetchData = async () => {
        if (!studentId) return;
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/api/progress/three-day-monitoring/${studentId}`);
            if (response.data.success) {
                const data = response.data.data;
                
                // Always set employee info and process info from backend if available
                setHeaderInfo(prev => ({
                    ...prev,
                    employeeName: data.employeeName || prev.employeeName,
                    employeeCode: data.employeeCode || prev.employeeCode,
                    processName: data.processName || prev.processName,
                    lineName: data.lineName || prev.lineName,
                }));

                // Fetch lines if departmentId is available
                if (data.departmentId || departmentId) {
                    const fetchedLines = await fetchLines(data.departmentId || departmentId);
                    
                    // If lineName exists, fetch its stations
                    const currentLineName = data.lineName || headerInfo.lineName;
                    if (currentLineName && fetchedLines.length > 0) {
                        const line = fetchedLines.find(l => l.name === currentLineName);
                        if (line) {
                            fetchStations(line.id);
                        }
                    }
                }

                if (!data.isNew) {
                    setGridData(data.gridData || data.entries || {});
                    setFooterData(data.evaluation || data.footerData || {});
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        if (!departmentId || departmentId === 'undefined') return;
        try {
            const response = await axiosInstance.get(`/api/progress/three-day-monitoring/config/${departmentId}`);
            if (response.data.success && response.data.data.config) {
                setConfig(response.data.data.config);
            }
        } catch (error) {
            console.error("Error fetching config:", error);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const newConfig = JSON.parse(configJson);
            await axiosInstance.post(`/api/progress/three-day-monitoring/config/save`, {
                departmentId,
                config: newConfig,
                remark: configRemark
            });
            setConfig(newConfig);
            setIsEditingLayout(false);
            toast.success("Configuration saved successfully");
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Invalid JSON or server error");
        } finally {
            setSaving(false);
        }
    };

    const fetchHistory = async () => {
        if (!departmentId || departmentId === 'undefined') return;
        try {
            const response = await axiosInstance.get(`/api/progress/three-day-monitoring/history/${departmentId}`);
            if (response.data.success) {
                setHistory(response.data.data);
                setShowHistory(true);
            }
        } catch (error) {
            toast.error("Failed to fetch history");
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                studentId,
                departmentId,
                headerInfo,
                gridData,
                footerData
            };
            await axiosInstance.post(`/api/progress/three-day-monitoring/${studentId}`, payload);
            toast.success("Saved Successfully");
        } catch (error) {
            console.error("Error saving data:", error);
            toast.error("Failed to save data");
        } finally {
            setSaving(false);
        }
    };

    const handleGridChange = (rowId, colId, value) => {
        if (readOnly) return;
        setGridData(prev => ({
            ...prev,
            [`${rowId}_${colId}`]: value
        }));
    };

    const handleHeaderChange = (field, value) => {
        if (readOnly) return;
        setHeaderInfo(prev => {
            const newHeader = { ...prev, [field]: value };
            
            // If lineName changed, clear processName and fetch its stations
            if (field === "lineName") {
                console.log(`[DEBUG] Line Name changed to: ${value}`);
                newHeader.processName = "";
                setStations([]);
                const line = lines.find(l => l.name === value);
                console.log(`[DEBUG] Found line object:`, line);
                if (line) {
                    fetchStations(line.id);
                }
            }
            
            return newHeader;
        });
    };

    const handleFooterChange = (field, value) => {
        if (readOnly) return;
        setFooterData(prev => ({ ...prev, [field]: value }));
    };

    // Automatic Calculations
    useEffect(() => {
        if (readOnly) return;

        const newGridData = { ...gridData };
        let hasChanges = false;

        const days = ['day1', 'day2', 'day3'];

        const updateKey = (key, val) => {
            const valStr = (val !== null && val !== undefined) ? val.toString() : "";
            if (newGridData[key] !== valStr) {
                newGridData[key] = valStr;
                hasChanges = true;
            }
        };

        config.forEach((cat, catIdx) => {
            const catId = cat.id || `cat${catIdx + 1}`;
            const catTotalMark = typeof cat.totalMark === 'number' ? cat.totalMark : parseFloat(cat.totalMark) || 0;
            
            days.forEach(d => {
                let catDaySum = 0;

                cat.rows.forEach(row => {
                    if (row.type === 'cycle_detailed') {
                        let targetAvgTotal = 0;
                        let actualAvgTotal = 0;
                        let achievementSum = 0;
                        let scoreSum = 0;
                        let scoreCount = 0;
                        let ctSum = 0;
                        let ctCount = 0;

                        for (let i = 0; i < 10; i++) {
                            // Target vs Actual C/T (if row has CT)
                            if (row.hasCT) {
                                const targetVal = parseFloat(gridData[`${row.id}_${d}_target`]) || parseFloat(gridData[`${row.id}_${d}_target_${i}`]) || 0;
                                const actualVal = parseFloat(gridData[`${row.id}_${d}_ct_${i}`]) || 0;
                                
                                if (actualVal > 0) {
                                    ctSum += actualVal;
                                    ctCount++;
                                    
                                    if (targetVal > 0) {
                                        const ach = Math.round((targetVal / actualVal) * 100);
                                        updateKey(`${row.id}_${d}_achievement_${i}`, `${ach}%`);
                                        achievementSum += ach;
                                    }
                                }
                            }

                            // Score calculation
                            const scoreVal = parseFloat(gridData[`${row.id}_${d}_score_${i}`]) || 0;
                            if (scoreVal > 0 || gridData[`${row.id}_${d}_score_${i}`] === "0") {
                                scoreSum += scoreVal;
                                scoreCount++;
                            }
                        }

                        // Update Score Average
                        const scoreAvg = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
                        updateKey(`${row.id}_${d}_score_avg`, scoreCount > 0 ? scoreAvg : "");
                        catDaySum += scoreAvg;

                        // Update C/T Average (if row has CT)
                        if (row.hasCT) {
                            const ctAvg = ctCount > 0 ? Math.round(ctSum / ctCount) : 0;
                            updateKey(`${row.id}_${d}_ct_avg`, ctCount > 0 ? ctAvg : "");
                        }
                    } else if (row.id === 'prodPlan' || catId === 'cat3') {
                        // Category 3: Special logic for production plan
                        const plan = parseFloat(gridData[`prodPlan_${d}`]) || 0;
                        const free = parseFloat(gridData[`defectFree_${d}`]) || 0;
                        if (plan > 0) {
                            const pct = Math.round((free / plan) * 100);
                            updateKey(`cat3_${d}_actual`, `${pct}%`);
                        }
                    } else if (row.id === 'attendPresent' || catId === 'cat6') {
                        // Attendance logic handled separately below
                    } else {
                        const val = parseFloat(gridData[`${row.id}_${d}`]) || 0;
                        catDaySum += val;
                    }
                });

                // Category Summary for Day d
                if (catTotalMark > 0) {
                    updateKey(`${catId}_${d}_total`, catDaySum > 0 ? catDaySum : "");
                    const actualPerc = catDaySum > 0 ? Math.round((catDaySum / catTotalMark) * 100) : 0;
                    updateKey(`${catId}_${d}_actual`, actualPerc > 0 ? `${actualPerc}%` : "");
                }
            });
        });

        // Attendance (Category 6) Calculations
        let attSum = 0;
        let attCount = 0;
        days.forEach(d => {
            const val = parseFloat(gridData[`attendPresent_${d}`]) || 0;
            if (val > 0) {
                attSum += val;
                attCount++;
            }
        });
        const attendanceAvgPerc = attCount > 0 ? Math.round((attSum / 3) * 100) : 0;
        updateKey('attendance_total_score', attendanceAvgPerc > 0 ? `${attendanceAvgPerc}%` : "");

        // Individual Evaluation (Col 17) Column Calculations
        config.forEach((cat, catIdx) => {
            const catId = cat.id || `cat${catIdx + 1}`;
            const catTotalMark = typeof cat.totalMark === 'number' ? cat.totalMark : parseFloat(cat.totalMark) || 0;
            let catEvalSum = 0;

            cat.rows.forEach(row => {
                let sum = 0;
                let count = 0;
                days.forEach(d => {
                    const key = row.type === 'cycle_detailed' ? `${row.id}_${d}_score_avg` : `${row.id}_${d}`;
                    const val = parseFloat(newGridData[key] || gridData[key]) || 0;
                    if (val > 0) {
                        sum += val;
                        count++;
                    }
                });
                const evalAvg = count > 0 ? Math.round(sum / count) : 0;
                updateKey(`${row.id}_eval`, evalAvg > 0 ? evalAvg : "");
                catEvalSum += evalAvg;
            });

            if (catId === 'cat3') {
                let pctSum = 0;
                let pctCount = 0;
                days.forEach(d => {
                    const pctStr = newGridData[`cat3_${d}_actual`] || gridData[`cat3_${d}_actual`];
                    if (pctStr) {
                        pctSum += parseInt(pctStr) || 0;
                        pctCount++;
                    }
                });
                const evalActualPerc = pctCount > 0 ? Math.round(pctSum / pctCount) : 0;
                updateKey(`${catId}_eval_actual`, evalActualPerc > 0 ? `${evalActualPerc}%` : "");
            } else if (catTotalMark > 0) {
                updateKey(`${catId}_eval_total`, catEvalSum > 0 ? catEvalSum : "");
                const evalActualPerc = Math.round((catEvalSum / catTotalMark) * 100);
                updateKey(`${catId}_eval_actual`, evalActualPerc > 0 ? `${evalActualPerc}%` : "");
            }
        });

        // Summary Table Automation
        const summaryRows = [
            { id: 'score1', catId: 'cat1', weight: 0.4 },
            { id: 'score2', catId: 'cat2', weight: 0.2 },
            { id: 'score3', catId: 'cat3', weight: 0.1 },
            { id: 'score4', catId: 'cat4', weight: 0.1 },
            { id: 'score5', catId: 'cat5', weight: 0.1 },
            { id: 'score6', catId: null, weight: 0.1, customVal: attendanceAvgPerc }
        ];

        let grandTotalScore = 0;
        summaryRows.forEach(row => {
            const avgPercStr = row.catId ? (newGridData[`${row.catId}_eval_actual`] || "0%") : `${row.customVal}%`;
            const avgPercVal = parseInt(avgPercStr) || 0;
            updateKey(`summary_avg_${row.id}`, avgPercStr !== "0%" ? avgPercStr : "");
            const weightedScore = (avgPercVal / 100) * row.weight;
            updateKey(`summary_weight_${row.id}`, weightedScore > 0 ? weightedScore.toFixed(2) : "");
            grandTotalScore += weightedScore;
        });
        updateKey('summary_total_score', grandTotalScore > 0 ? grandTotalScore.toFixed(2) : "");

        if (hasChanges) {
            setGridData(newGridData);
        }
    }, [gridData, config, readOnly]);

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const days = ['day1', 'day2', 'day3'];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                                        <div className="text-center w-full">
                        <CardTitle className="text-xl font-bold uppercase tracking-wider">ASSOCIATE EFFECTIVENESS CHECK SHEET</CardTitle>
                        <p className="text-[10px] font-bold mt-1">(WORKING IN QUALITY CONTROL SECTION)</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchHistory}
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
                        <Button
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                            onClick={() => exportToExcel("3-Day Monitoring Sheet", { studentId })}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border-black border mb-6 text-[11px]">
                        {[
                            { label: "Employee Name", field: "employeeName" },
                            { label: "Employee Code", field: "employeeCode" },
                            { label: "Process Name", field: "processName" },
                            { label: "Line Name", field: "lineName" }
                        ].map((row, idx) => (
                            <div key={idx} className="flex border-b border-black last:border-0 h-7 items-center">
                                <div className="w-[150px] px-2 font-medium border-r border-black flex items-center h-full">{row.label}</div>
                                <div className="flex-1 px-2 flex items-center h-full">
                                    <span className="mr-1">:</span>
                                    {row.field === "lineName" && lines.length > 0 ? (
                                        <select
                                            className="w-full h-full border-none outline-none bg-transparent font-bold text-blue-900 cursor-pointer"
                                            value={headerInfo.lineName}
                                            onChange={(e) => handleHeaderChange("lineName", e.target.value)}
                                            disabled={readOnly}
                                        >
                                            <option value="">Select Line</option>
                                            {lines.map(line => (
                                                <option key={line.id} value={line.name}>
                                                    {line.name} {line.sectionName ? `(${line.sectionName})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : row.field === "processName" ? (
                                        <select
                                            className="w-full h-full border-none outline-none bg-transparent font-bold text-blue-900 cursor-pointer"
                                            value={headerInfo.processName}
                                            onChange={(e) => handleHeaderChange("processName", e.target.value)}
                                            disabled={readOnly || !headerInfo.lineName}
                                        >
                                            {!headerInfo.lineName ? (
                                                <option value="">Select Line first</option>
                                            ) : stations.length === 0 ? (
                                                <option value="">No Process found for this line</option>
                                            ) : (
                                                <>
                                                    <option value="">Select Process (Station)</option>
                                                    {stations.map(station => (
                                                        <option key={station.id} value={station.name}>
                                                            {station.name} {station.subSectionName ? `(${station.subSectionName})` : ''}
                                                        </option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                    ) : (
                                        <input
                                            className="w-full h-full border-none outline-none bg-transparent uppercase font-bold text-blue-900"
                                            value={headerInfo[row.field]}
                                            onChange={(e) => handleHeaderChange(row.field, e.target.value)}
                                            disabled={readOnly}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Monitoring Table */}
                    <div className="overflow-x-auto border-l border-t border-black">
                        <table className="w-full border-collapse text-[9px]">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border-r border-b border-black p-1 w-6" rowSpan={3}>S.No</th>
                                    <th className="border-r border-b border-black p-1 w-24" rowSpan={3}>Parameters</th>
                                    <th className="border-r border-b border-black p-1 w-48" rowSpan={3}>Check Items</th>
                                    <th className="border-r border-b border-black p-1 w-10" rowSpan={3}>Mark (Max.)</th>
                                    <th className="border-r border-b border-black p-1" colSpan={33}>DAY WISE PERFORMANCE MONITORING</th>
                                    <th className="border-r border-b border-black p-1 w-24" rowSpan={3}>Evaluation after monitoring of 3 days</th>
                                </tr>
                                <tr className="bg-gray-100">
                                    {['Day-1', 'Day-2', 'Day-3'].map((day) => (
                                        <th key={day} className="border-r border-b border-black p-0.5" colSpan={11}>{day}</th>
                                    ))}
                                </tr>
                                <tr className="bg-gray-50">
                                    {[1, 2, 3].map(d => (
                                        <React.Fragment key={d}>
                                            {[...Array(10)].map((_, i) => (
                                                <th key={i} className="border-r border-b border-black p-0 w-5 h-5">{i + 1}</th>
                                            ))}
                                            <th className="border-r border-b border-black p-0 w-8 h-5">Total</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {config.map((cat, catIdx) => {
                                    const catId = cat.id || `cat${catIdx + 1}`;
                                    const catRowsCount = cat.rows.length;
                                    const totalRowsInCat = cat.rows.reduce((acc, r) => acc + (r.id === 'prodPlan' ? 4 : (r.hasCT ? 2 : 1)), 0) + (cat.rows.some(r => r.id === 'prodPlan') ? 0 : 3);

                                    return cat.rows.map((row, rowIdx) => {
                                        const isFirstRow = rowIdx === 0;
                                        const isLastRow = rowIdx === cat.rows.length - 1;

                                        if (row.id === 'prodPlan') {
                                            // Handle special Production Plan category
                                            return (
                                                <React.Fragment key={row.id}>
                                                    {/* Plan Row */}
                                                    <tr>
                                                        <td className="border-r border-b border-black p-1 text-center font-bold" rowSpan={4}>{catIdx + 1}</td>
                                                        <td className="border-r border-b border-black p-1 font-bold" rowSpan={4}>{cat.category}</td>
                                                        <td className="border-r border-b border-black p-1">{row.label}</td>
                                                        <td className="border-r border-b border-black p-1 text-center font-bold" rowSpan={4}>{cat.totalMark || "-"}</td>
                                                        {[1, 2, 3].map(d => (
                                                            <td key={d} className="border-r border-b border-black p-0 h-6" colSpan={11}>
                                                                <input
                                                                    className="w-full h-full text-center border-none outline-none bg-blue-50/30 font-bold"
                                                                    value={gridData[`${row.id}_day${d}`] || ""}
                                                                    onChange={(e) => handleGridChange(row.id, `day${d}`, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="border-r border-b border-black p-0" rowSpan={4}>
                                                            <div className="flex flex-col h-full text-[8px]">
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Total Marks</div>
                                                                    <div className="w-1/2 p-1 text-center">{gridData[`${catId}_eval_total`] || ""}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Actual Marks</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold text-blue-900">{gridData[`${catId}_eval_total`] || ""}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Target %</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold">{cat.target || "100%"}</div>
                                                                </div>
                                                                <div className="flex border-b border-black bg-yellow-400/80">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Actual %</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold text-black">{gridData[`${catId}_eval_actual`] || ""}</div>
                                                                </div>
                                                                {catId === 'cat3' && (
                                                                    <div className="flex bg-yellow-400/80 mt-auto border-t border-black">
                                                                        <div className="w-1/2 border-r border-black p-1 font-bold">Achievement %</div>
                                                                        <div className="w-1/2 p-1 text-center font-bold text-black">{gridData[`cat3_eval_actual`] || ""}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {/* Actual Row */}
                                                    <tr>
                                                        <td className="border-r border-b border-black p-1">Defect free product</td>
                                                        {[1, 2, 3].map(d => (
                                                            <td key={d} className="border-r border-b border-black p-0 h-6" colSpan={11}>
                                                                <input
                                                                    className="w-full h-full text-center border-none outline-none bg-white font-bold"
                                                                    value={gridData[`defectFree_day${d}`] || ""}
                                                                    onChange={(e) => handleGridChange('defectFree', `day${d}`, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    {/* Target Row */}
                                                    <tr>
                                                        <td className="border-r border-b border-black p-1">Target %</td>
                                                        {[1, 2, 3].map(d => (
                                                            <td key={d} className="border-r border-b border-black p-1 text-center font-bold bg-gray-50/50" colSpan={11}>100%</td>
                                                        ))}
                                                    </tr>
                                                    {/* Actual % Row */}
                                                    <tr className="bg-yellow-400/80">
                                                        <td className="border-r border-b border-black p-1 font-bold underline">Actual %</td>
                                                        {[1, 2, 3].map(d => (
                                                            <td key={d} className="border-r border-b border-black p-1 text-center font-bold text-black" colSpan={11}>
                                                                {gridData[`cat3_day${d}_actual`] || ""}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        }

                                        if (row.id === 'defectFree') return null;

                                        return (
                                            <React.Fragment key={row.id}>
                                                <tr>
                                                    {isFirstRow && <td className="border-r border-b border-black p-1 text-center font-bold" rowSpan={totalRowsInCat}>{catIdx + 1}</td>}
                                                    {isFirstRow && <td className="border-r border-b border-black p-1 font-bold whitespace-pre-line" rowSpan={totalRowsInCat}>{cat.category}</td>}
                                                    <td className="border-r border-b border-black p-1 whitespace-pre-line" rowSpan={row.hasCT ? 2 : 1}>
                                                        {row.label}
                                                    </td>
                                                    <td className="border-r border-b border-black p-1 text-center font-bold">{row.hasCT ? "C/T" : (row.weight || "-")}</td>
                                                    {[1, 2, 3].map(d => {
                                                        const day = `day${d}`;
                                                        if (row.type === 'cycle_detailed') {
                                                            return (
                                                                <React.Fragment key={d}>
                                                                    {[...Array(10)].map((_, i) => (
                                                                        <td key={i} className={`border-r border-b border-black p-0 h-6 w-5 ${row.hasCT ? 'bg-gray-50/30' : ''}`}>
                                                                            <input
                                                                                className="w-full h-full text-center border-none outline-none focus:bg-blue-100/50"
                                                                                value={gridData[`${row.id}_${day}_${row.hasCT ? 'ct' : 'score'}_${i}`] || ""}
                                                                                onChange={(e) => handleGridChange(row.id, `${day}_${row.hasCT ? 'ct' : 'score'}_${i}`, e.target.value)}
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    <td className="border-r border-b border-black p-0 text-center font-bold bg-yellow-400/80 text-black w-8">
                                                                        {gridData[`${row.id}_${day}_${row.hasCT ? 'ct_avg' : 'score_avg'}`] || ""}
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        }
                                                        return (
                                                            <td key={d} className="border-r border-b border-black p-0 h-8 text-center" colSpan={11}>
                                                                <input
                                                                    className="w-full h-full text-center border-none outline-none focus:bg-blue-100/50"
                                                                    value={gridData[`${row.id}_${day}`] || ""}
                                                                    onChange={(e) => handleGridChange(row.id, day, e.target.value)}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                    {isFirstRow && (
                                                        <td className="border-r border-b border-black p-0 align-top" rowSpan={totalRowsInCat}>
                                                            <div className="flex flex-col h-full text-[8px]">
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Total Marks</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold">{cat.totalMark}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Actual Marks</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold text-blue-900">{gridData[`${catId}_eval_total`] || ""}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Target %</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold">{cat.target || "100%"}</div>
                                                                </div>
                                                                <div className="flex border-b border-black bg-yellow-400/80">
                                                                    <div className="w-1/2 border-r border-black p-1 font-bold">Actual %</div>
                                                                    <div className="w-1/2 p-1 text-center font-bold text-black">{gridData[`${catId}_eval_actual`] || ""}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>

                                                {row.hasCT && (
                                                    <tr className="bg-yellow-100/20">
                                                        <td className="border-r border-b border-black p-1 text-center font-bold">{row.weight || "2"}</td>
                                                        {[1, 2, 3].map(d => {
                                                            const day = `day${d}`;
                                                            return (
                                                                <React.Fragment key={d}>
                                                                    {[...Array(10)].map((_, i) => (
                                                                        <td key={i} className="border-r border-b border-black p-0 h-6 w-5">
                                                                            <input
                                                                                className="w-full h-full text-center border-none outline-none font-bold focus:bg-blue-100/50"
                                                                                value={gridData[`${row.id}_${day}_score_${i}`] || ""}
                                                                                onChange={(e) => handleGridChange(row.id, `${day}_score_${i}`, e.target.value)}
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                    <td className="border-r border-b border-black p-0 text-center font-bold bg-yellow-400/80 text-black w-8">
                                                                        {gridData[`${row.id}_${day}_score_avg`] || ""}
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tr>
                                                )}

                                                {/* Summary rows for each category */}
                                                {isLastRow && !cat.rows.some(r => r.id === 'prodPlan') && (
                                                    <React.Fragment>
                                                        <tr className="bg-gray-50/50">
                                                            <td className="border-r border-b border-black p-1 font-bold italic" colSpan={1}>Total Mark</td>
                                                            <td className="border-r border-b border-black p-1 text-center font-bold">-</td>
                                                            {[1, 2, 3].map(d => (
                                                                <td key={d} className="border-r border-b border-black p-1 text-center font-bold bg-yellow-400/80 text-black" colSpan={11}>
                                                                    {gridData[`${catId}_day${d}_total`] || ""}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                        <tr className="bg-gray-50/20">
                                                            <td className="border-r border-b border-black p-1 font-bold italic" colSpan={1}>Target %</td>
                                                            <td className="border-r border-b border-black p-1 text-center font-bold">-</td>
                                                            {[1, 2, 3].map(d => (
                                                                <td key={d} className="border-r border-b border-black p-1 text-center font-bold" colSpan={11}>{cat.target || "100%"}</td>
                                                            ))}
                                                        </tr>
                                                        <tr className="bg-yellow-400/80">
                                                            <td className="border-r border-b border-black p-1 font-bold italic underline" colSpan={1}>Actual %</td>
                                                            <td className="border-r border-b border-black p-1 text-center font-bold">-</td>
                                                            {[1, 2, 3].map(d => (
                                                                <td key={d} className="border-r border-b border-black p-1 text-center font-bold text-black" colSpan={11}>
                                                                    {gridData[`${catId}_day${d}_actual`] || ""}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    </React.Fragment>
                                                )}
                                            </React.Fragment>
                                        );
                                    });
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Attendance Summary */}
                    <div className="mt-6 border-l border-t border-black flex text-[9px]">
                        <div className="w-1/3 border-r border-b border-black">
                            <table className="w-full border-collapse">
                                <tbody>
                                    <tr>
                                        <td className="border-b border-r border-black p-1 font-bold bg-gray-50">Total no. of Monitoring day's :</td>
                                        <td className="border-b border-black p-1 text-center font-bold bg-white">3</td>
                                    </tr>
                                    <tr>
                                        <td className="border-b border-r border-black p-1 font-bold bg-gray-50">Operator Present day's</td>
                                        <td className="border-b border-black p-0 h-6">
                                            <input
                                                className="w-full h-full text-center border-none outline-none font-bold"
                                                value={gridData[`attendPresent_day1`] || ""}
                                                onChange={(e) => handleGridChange('attendPresent', 'day1', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-b border-r border-black p-1 font-bold bg-gray-50">Target %</td>
                                        <td className="border-b border-black p-1 text-center font-bold bg-gray-50/50">100%</td>
                                    </tr>
                                    <tr>
                                        <td className="border-b border-r border-black p-1 font-bold bg-gray-50">Actual %</td>
                                        <td className="border-b border-black p-1 text-center font-bold text-black bg-yellow-400/80">
                                            {gridData['attendance_total_score'] || "100%"}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-r border-black p-1 font-bold bg-gray-50">GAP OBSERVED</td>
                                        <td className="p-0 h-6">
                                            <input
                                                className="w-full h-full text-center border-none outline-none font-bold bg-white"
                                                value={gridData[`attendGap`] || "0"}
                                                onChange={(e) => handleGridChange('attendGap', '', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Evaluation Criteria Legends */}
                        <div className="w-2/3 flex bg-white">
                            <div className="border-r border-b border-black w-[45%]">
                                <p className="text-center font-bold border-b border-black bg-gray-100 p-0.5 uppercase">Evaluation Criteria: Cycle time</p>
                                <table className="w-full text-center border-collapse text-[10px]">
                                    <tbody>
                                        <tr><td className="border-b border-r border-black font-bold w-12 bg-gray-50">0</td><td className="border-b border-black p-1 italic">1% -30% of standard time</td></tr>
                                        <tr><td className="border-b border-r border-black font-bold bg-gray-50">1</td><td className="border-b border-black p-1 italic">31%-50% of standard time</td></tr>
                                        <tr><td className="border-r border-black font-bold bg-gray-50 uppercase">2</td><td className="p-1 italic">51%-100% of standard time</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="border-r border-b border-black w-[55%]">
                                <p className="text-center font-bold border-b border-black bg-gray-100 p-0.5 uppercase">Evaluation Criteria: Quality / System, Discipline ,5S & Safety</p>
                                <table className="w-full text-left border-collapse text-[10px]">
                                    <tbody>
                                        <tr><td className="border-b border-r border-black font-bold w-12 text-center bg-gray-50">0</td><td className="border-b border-black px-2 p-1 italic">Not known/ Not adhere the rule</td></tr>
                                        <tr><td className="border-b border-r border-black font-bold text-center bg-gray-50">1</td><td className="border-b border-black px-2 p-1 italic underline">Partially known / Partially adhere the rule</td></tr>
                                        <tr><td className="border-r border-black font-bold text-center bg-gray-50">2</td><td className="px-2 p-1 italic">Known / Adhere the rule</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Overall Score Assessment Table */}
                    <div className="mt-6 border-l border-t border-black text-[9px]">
                        <table className="w-full border-collapse text-center">
                            <thead>
                                <tr className="bg-gray-100 uppercase">
                                    <th className="border-r border-b border-black p-1 text-left w-32">Parameters</th>
                                    <th className="border-r border-b border-black p-1 w-20">Total Weightage</th>
                                    <th className="border-r border-b border-black p-1">Poor** (70-80)</th>
                                    <th className="border-r border-b border-black p-1">Average (81-90)</th>
                                    <th className="border-r border-b border-black p-1">V Good (91-95)</th>
                                    <th className="border-r border-b border-black p-1">Excellent (96-100)</th>
                                    <th className="border-r border-b border-black p-1 w-24">Avg. Score (individual) in %</th>
                                    <th className="border-r border-b border-black p-1 w-24">Score Achieved w.r.t weightage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: "10 Cycle Check", weight: 0.4, id: "score1" },
                                    { label: "Quality / System", weight: 0.2, id: "score2" },
                                    { label: "Non defective products Produced", weight: 0.1, id: "score3" },
                                    { label: "Discipline", weight: 0.1, id: "score4" },
                                    { label: "Safety", weight: 0.1, id: "score5" },
                                    { label: "Attendance", weight: 0.1, id: "score6" },
                                ].map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="border-r border-b border-black p-1 text-left font-bold bg-gray-50">{row.label}</td>
                                        <td className="border-r border-b border-black p-1 font-bold">{row.weight}</td>
                                        <td className="border-r border-b border-black p-1 bg-gray-50/20"></td>
                                        <td className="border-r border-b border-black p-1 bg-gray-50/20"></td>
                                        <td className="border-r border-b border-black p-1 bg-gray-50/20"></td>
                                        <td className="border-r border-b border-black p-1 bg-gray-50/20"></td>
                                        <td className="border-r border-b border-black p-0 h-6">
                                            <input
                                                disabled={true}
                                                className="w-full h-full text-center border-none outline-none font-bold text-black bg-yellow-400/80"
                                                value={gridData[`summary_avg_${row.id}`] || ""}
                                            />
                                        </td>
                                        <td className="border-r border-b border-black p-0 h-6">
                                            <input
                                                disabled={true}
                                                className="w-full h-full text-center border-none outline-none font-bold text-black bg-yellow-400/80"
                                                value={gridData[`summary_weight_${row.id}`] || ""}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td className="border-r border-b border-black p-1 font-bold text-left bg-gray-100" colSpan={1}>Total</td>
                                    <td className="border-r border-b border-black p-1 font-bold uppercase bg-gray-100">1</td>
                                    <td className="border-r border-b border-black p-1 text-left italic text-[8px] bg-gray-50" colSpan={4}>** Poor criteria is minimum passing marks for associates.</td>
                                    <td className="border-r border-b border-black p-1 font-bold bg-gray-100 uppercase">100%</td>
                                    <td className="border-r border-b border-black p-0 h-6">
                                        <input
                                            disabled={true}
                                            className="w-full h-full text-center border-none outline-none font-bold bg-yellow-400/80 text-black"
                                            value={gridData[`summary_total_score`] || ""}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-2 text-[8px] italic">* Procedure refer to product quality: if the defect capturing is less than 100% by employee, need to re-monitor for next 3 days</div>

                    {/* Signatures and Remarks Section */}
                    <div className="mt-6 border-l border-t border-black flex text-[9px] uppercase font-bold">
                        <div className="w-1/3 border-r border-b border-black p-4 text-center">
                            <input
                                className="w-full border-b border-black text-center mb-1 outline-none uppercase"
                                value={footerData.checkedByName || ""}
                                onChange={(e) => handleFooterChange('checkedByName', e.target.value)}
                            />
                            <div>Checked By:-</div>
                            <div className="text-[7px] font-normal">(Process In charge)</div>
                        </div>
                        <div className="w-1/4 border-r border-b border-black p-4 flex flex-col justify-center text-center">
                           <div className="mb-2 uppercase">Approved By:</div>
                           <input
                                className="w-full border-b border-black text-center outline-none uppercase"
                                value={footerData.approvedByName || ""}
                                onChange={(e) => handleFooterChange('approvedByName', e.target.value)}
                            />
                            <div className="text-[7px] font-normal uppercase mt-1">(Dept. Head)</div>
                        </div>
                        <div className="w-2/5 border-r border-b border-black p-4 text-center">
                           <input
                                className="w-full border-b border-black text-center mb-1 outline-none uppercase"
                                value={footerData.verifiedByName || ""}
                                onChange={(e) => handleFooterChange('verifiedByName', e.target.value)}
                            />
                            <div>Verified By:-</div>
                            <div className="text-[7px] font-normal uppercase">(Area In charge)</div>
                        </div>
                    </div>

                    {/* Meta Info Footer */}
                    <div className="mt-8 flex justify-between text-[10px] font-bold border-t border-black pt-1">
                        <div className="w-1/4">FRM: WH QA 240</div>
                        <div className="w-1/4 text-center">Rev No 00</div>
                        <div className="w-1/4 text-center">Issue Date: 16.10.20</div>
                        <div className="w-1/4 text-right">PG: 1 OF 1</div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit 3-Day Monitoring Setup</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-4 p-4">
                        <div className="space-y-2">
                            <Label>Layout Configuration (JSON)</Label>
                            <Textarea
                                value={configJson}
                                onChange={(e) => setConfigJson(e.target.value)}
                                className="font-mono h-[400px] text-xs"
                                placeholder="Enter configuration JSON"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Change Remark</Label>
                            <Input
                                value={configRemark}
                                onChange={(e) => setConfigRemark(e.target.value)}
                                placeholder="e.g., Added new quality parameter"
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-4 border-t">
                        <Button variant="outline" onClick={() => setIsEditingLayout(false)}>Cancel</Button>
                        <Button onClick={handleSaveConfig} disabled={saving}>
                            {saving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Layout Change History</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        <div className="space-y-4 p-1">
                            {history.length > 0 ? history.map((h, i) => (
                                <div key={i} className="p-4 border rounded-md space-y-2 hover:bg-gray-50">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-bold text-blue-600">{h.updatedBy || 'System'}</span>
                                        <span className="text-gray-500">{new Date(h.updatedAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm font-medium">Remark: {h.remark || 'No remark'}</p>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0"
                                        onClick={() => {
                                            setConfig(h.config);
                                            setShowHistory(false);
                                            toast.info("Restored configuration from history (unsaved)");
                                        }}
                                    >
                                        Apply this version
                                    </Button>
                                </div>
                            )) : <div className="text-center py-8 text-gray-400">No history found</div>}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
};

export default ThreeDayMonitoringSheet;
