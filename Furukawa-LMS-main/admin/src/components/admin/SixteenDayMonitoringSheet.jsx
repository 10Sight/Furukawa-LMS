import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Printer,
    Edit2,
    History,
    Save,
    Download,
    Loader2
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { exportToExcel } from "@/utils/exportHelper";

const DEFAULT_MONITORING_CONFIG_16 = [
    {
        id: "cat1",
        category: "10 Cycle Check :\n1st time - 4 Part\n2nd time- 3 Part\n3rd time- 3 Part",
        rows: [
            { id: "row1_1", label: "Follow the work sequence according to the Work Instructions & Check the all check point as per WI\n(including finish condition confirmation)", weight: 2, type: "cycle" },
            { id: "row1_2", label: "Inspector should complete the Job in given cycle time", weight: 2, type: "cycle_detailed" },
            { id: "row1_3", label: "Adherence of 4'S (Sort, arrangement, clean, adherence)", weight: 2, type: "cycle" }
        ],
        totalMark: 6,
        target: "100%"
    },
    {
        id: "cat2",
        category: "Quality / System",
        rows: [
            { id: "row2_1", label: "Does he/she know the purpose of his/her work & impact at customer end", weight: 2 },
            { id: "row2_2", label: "Check an awareness of Inspector about defect in product & past defect in product", weight: 2 },
            { id: "row2_3", label: "Does he/she know OK & NG part judgment", weight: 2 },
            { id: "row2_4", label: "Does he/she know about NG part handling & adhere the rule STOP > CALL > WAIT", weight: 2 },
            { id: "row2_5", label: "Is there any mistake in using Andon?", weight: 2 }
        ],
        totalMark: 10,
        target: "100%"
    },
    {
        id: "cat3",
        category: "Defects captured (Defect must be captured 100% during the 16 day monitoring performance)",
        rows: [
            { id: "row3_1", label: "Actual defects", weight: "-" },
            { id: "row3_2", label: "Defects captured", weight: "-" }
        ],
        target: "100%",
        hasTargetInGrid: true
    },
    {
        id: "cat4",
        category: "Discipline",
        rows: [
            { id: "row4_1", label: "Attends the daily meeting with good level of listening and understanding", weight: 2 },
            { id: "row4_2", label: "Inspector should aware about daily machine check point and do 5S on their station on daily basis before production start", weight: 2 },
            { id: "row4_3", label: "Whenever if any defect or work related problem is there , he immediately contacts with line leader or his senior person with doing any delay or sitting idle.", weight: 2 },
            { id: "row4_4", label: "During any break operator clear the WIP / Insp. Part from his / her station and move to next process, leave work station after completing the job.", weight: 1 },
            { id: "row4_5", label: "Is he/she adhere working hours and break timings?", weight: 2 }
        ],
        totalMark: 9,
        target: "(EXCELLENT - 100 %)"
    },
    {
        id: "cat5",
        category: "Safety",
        rows: [
            { id: "row5_1", label: "Does he/she adhere rules of 5 Principle of Safety and Gen. Safety", weight: 2 },
            { id: "row5_2", label: "Does he/she wear required PPEs as per PPE matrix", weight: 2 }
        ],
        totalMark: 4,
        target: "100%",
        actualLabel: "Actual % age followed"
    }
];

const SixteenDayMonitoringSheet = ({ studentId, studentName = "", employeeCode = "", departmentName = "", readOnly = false, departmentId }) => {
    const [headerInfo, setHeaderInfo] = useState({
        employeeName: studentName || "",
        employeeCode: employeeCode || "",
        processName: "",
        dept: departmentName || "",
        handoverDate: "",
        trgResult: "",
        workingWith: "",
        lineLeaderName: ""
    });

    const [gridData, setGridData] = useState({});
    const [footerData, setFooterData] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(DEFAULT_MONITORING_CONFIG_16);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [configJson, setConfigJson] = useState('');
    const [configRemark, setConfigRemark] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            if (!studentId) return;
            setLoading(true);
            try {
                // Fetch existing 16-day data
                const response = await axiosInstance.get(`/api/sixteen-day-monitoring/${studentId}`);
                if (response.data.success && !response.data.data.isNew) {
                    const data = response.data.data;
                    setHeaderInfo({
                        employeeName: data.employeeName || studentName || "",
                        employeeCode: data.employeeCode || employeeCode || "",
                        processName: data.processName || "",
                        dept: data.dept || departmentName || "",
                        handoverDate: data.handoverDate || "",
                        trgResult: data.trgResult || "",
                        workingWith: data.workingWith || "",
                        lineLeaderName: data.lineLeaderName || ""
                    });
                    setGridData(data.gridData || {});
                    setFooterData(data.footerData || {});
                } else {
                    // Fallback to fetch assignment info from 3-day monitoring if no 16-day record exists
                    try {
                        const progressRes = await axiosInstance.get(`/api/progress/three-day-monitoring/${studentId}`);
                        const progressData = progressRes?.data?.data || {};
                        setHeaderInfo(prev => ({
                            ...prev,
                            processName: progressData.processName || prev.processName,
                            lineLeaderName: progressData.lineName
                                ? `${progressData.lineName}${progressData.lineLeader ? ` / ${progressData.lineLeader}` : ""}`
                                : prev.lineLeaderName,
                        }));
                    } catch (err) {
                        console.error("Failed to load fallback 3-day data", err);
                    }
                }
            } catch (error) {
                console.error("Failed to load 16-day monitoring data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
        fetchConfig();
    }, [studentId, departmentId]);

    const fetchConfig = async () => {
        if (!departmentId || departmentId === 'undefined') return;
        try {
            const response = await axiosInstance.get(`/api/sixteen-day-monitoring/config/${departmentId}`);
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
            await axiosInstance.post(`/api/sixteen-day-monitoring/config/save`, {
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
            const response = await axiosInstance.get(`/api/sixteen-day-monitoring/history/${departmentId}`);
            if (response.data.success) {
                setHistory(response.data.data);
                setShowHistory(true);
            }
        } catch (error) {
            toast.error("Failed to fetch history");
        }
    };

    const handleHeaderChange = (field, value) => {
        if (readOnly) return;
        setHeaderInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleFooterChange = (field, value) => {
        if (readOnly) return;
        setFooterData(prev => ({ ...prev, [field]: value }));
    };

    const handleGridChange = (rowId, colId, value) => {
        if (readOnly) return;
        setGridData(prev => ({
            ...prev,
            [`${rowId}_${colId}`]: value
        }));
    };

    // Automatic Calculations
    useEffect(() => {
        if (readOnly) return;

        const newGridData = { ...gridData };
        let hasChanges = false;

        const daysDetailed = ['d1', 'd2', 'd3'];
        const daysSummary = Array.from({ length: 13 }, (_, i) => `day_${i + 4}`);

        const updateKey = (key, val) => {
            const valStr = (val !== null && val !== undefined) ? val.toString() : "";
            if (newGridData[key] !== valStr) {
                newGridData[key] = valStr;
                hasChanges = true;
            }
        };

        config.forEach(cat => {
            const catTotalMark = typeof cat.totalMark === 'number' ? cat.totalMark : parseFloat(cat.totalMark) || 0;
            
            // For Day 1-3 detailed monitoring
            daysDetailed.forEach(d => {
                let catDaySumAvg = 0;

                cat.rows.forEach(row => {
                    if (row.type === 'cycle_detailed') {
                        let targetAvgTotal = 0;
                        let actualAvgTotal = 0;
                        let achievementSum = 0;
                        let scoreSum = 0;
                        let achCount = 0;

                        for (let i = 0; i < 10; i++) {
                            const targetVal = parseFloat(gridData[`${row.id}_${d}_target_${i}`]) || 0;
                            const actualVal = parseFloat(gridData[`${row.id}_${d}_actual_${i}`]) || 0;
                            
                            targetAvgTotal += targetVal;
                            actualAvgTotal += actualVal;

                            if (targetVal > 0 && actualVal > 0) {
                                const ach = Math.round((targetVal / actualVal) * 100);
                                const achKey = `${row.id}_${d}_achievement_${i}`;
                                const achStr = `${ach}%`;
                                if (newGridData[achKey] !== achStr) {
                                    newGridData[achKey] = achStr;
                                    hasChanges = true;
                                }
                                achievementSum += ach;
                                achCount++;
                            } else {
                                const achKey = `${row.id}_${d}_achievement_${i}`;
                                if (newGridData[achKey] && newGridData[achKey] !== "") {
                                    newGridData[achKey] = "";
                                    hasChanges = true;
                                }
                            }
                            
                            scoreSum += parseFloat(gridData[`${row.id}_${d}_score_${i}`]) || 0;
                        }

                        // Row Averages
                        const targetAvg = Math.round(targetAvgTotal / 10) || "";
                        const actualAvg = Math.round(actualAvgTotal / 10) || "";
                        const achAvg = achCount > 0 ? Math.round(achievementSum / achCount) : 0;
                        const scoreAvg = Math.round(scoreSum / 10) || 0;


                        updateKey(`${row.id}_${d}_target_avg`, targetAvg);
                        updateKey(`${row.id}_${d}_actual_avg`, actualAvg);
                        updateKey(`${row.id}_${d}_achievement_avg`, achAvg > 0 ? `${achAvg}%` : "");
                        updateKey(`${row.id}_${d}_score_avg`, scoreAvg || "");
                        catDaySumAvg += scoreAvg;
                    } else if (row.type === 'cycle') {
                        let rowSum = 0;
                        for (let i = 0; i < 10; i++) {
                            rowSum += parseFloat(gridData[`${row.id}_${d}_${i}`]) || 0;
                        }
                        const rowAvg = Math.round(rowSum / 10) || 0;
                        updateKey(`${row.id}_${d}_avg`, rowAvg || "");
                        catDaySumAvg += rowAvg;
                    } else {
                        // Standard row: add value directly for Day 1-3 summary
                        const rowVal = parseFloat(gridData[`${row.id}_${d}`]) || 0;
                        catDaySumAvg += rowVal;
                    }
                });

                // Category Summary for Day d
                if (cat.totalMark) {
                    const totalKey = `${cat.id}_${d}_total`;
                    const totalVal = catDaySumAvg > 0 ? catDaySumAvg.toString() : "";
                    if (newGridData[totalKey] !== totalVal) {
                        newGridData[totalKey] = totalVal;
                        hasChanges = true;
                    }

                    const actualKey = `${cat.id}_${d}_actual`;
                    if (catTotalMark > 0) {
                        const actualPerc = catDaySumAvg > 0 ? Math.round((catDaySumAvg / catTotalMark) * 100) : 0;
                        const actualStr = actualPerc > 0 ? `${actualPerc}%` : "";
                        if (newGridData[actualKey] !== actualStr) {
                            newGridData[actualKey] = actualStr;
                            hasChanges = true;
                        }
                    }
                }
            });

            // For Day 4-16 (Summary days)
            daysSummary.forEach(d => {
                let catDaySum = 0;
                cat.rows.forEach(row => {
                    if (row.type === 'cycle_detailed') {
                        const target = parseFloat(gridData[`${row.id}_${d}_target`]) || 0;
                        const actual = parseFloat(gridData[`${row.id}_${d}_actual`]) || 0;
                        const score = parseFloat(gridData[`${row.id}_${d}_score`]) || 0;
                        
                        // Calculate achievement for cycle_detailed rows
                        if (target > 0 && actual > 0) {
                            const ach = Math.round((target / actual) * 100);
                            updateKey(`${row.id}_${d}_achievement`, `${ach}%`);
                        } else if (newGridData[`${row.id}_${d}_achievement`]) {
                            updateKey(`${row.id}_${d}_achievement`, "");
                        }
                        
                        catDaySum += score;
                    } else {
                        const val = parseFloat(gridData[`${row.id}_${d}`]) || 0;
                        catDaySum += val;
                    }
                });

                if (cat.totalMark) {
                    const totalKey = `${cat.id}_${d}_total`;
                    const totalVal = catDaySum > 0 ? catDaySum.toString() : "";
                    if (newGridData[totalKey] !== totalVal) {
                        newGridData[totalKey] = totalVal;
                        hasChanges = true;
                    }

                    const actualKey = `${cat.id}_${d}_actual`;
                    if (catTotalMark > 0) {
                        const actualPerc = catDaySum > 0 ? Math.round((catDaySum / catTotalMark) * 100) : 0;
                        const actualStr = actualPerc > 0 ? `${actualPerc}%` : "";
                        if (newGridData[actualKey] !== actualStr) {
                            newGridData[actualKey] = actualStr;
                            hasChanges = true;
                        }
                    }
                }
            });

            // Category 3 (Defects) Special Summary Logic
            if (cat.id === 'cat3') {
                [...daysDetailed, ...daysSummary].forEach(d => {
                    const actualDefects = parseFloat(gridData[`row3_1_${d}`]) || 0;
                    const capturedDefects = parseFloat(gridData[`row3_2_${d}`]) || 0;
                    const actualKey = `${cat.id}_${d}_actual`;
                    if (actualDefects > 0) {
                        const perc = Math.round((capturedDefects / actualDefects) * 100);
                        const percStr = `${perc}%`;
                        if (newGridData[actualKey] !== percStr) {
                            newGridData[actualKey] = percStr;
                            hasChanges = true;
                        }
                    } else {
                        if (newGridData[actualKey] && newGridData[actualKey] !== "") {
                            newGridData[actualKey] = "";
                            hasChanges = true;
                        }
                    }
                });
            }
        });

        // Evaluation (Col 17) Column Calculations
        config.forEach(cat => {
            const catTotalMark = typeof cat.totalMark === 'number' ? cat.totalMark : parseFloat(cat.totalMark) || 0;
            let catEvalSum = 0;

            cat.rows.forEach(row => {
                if (row.type === 'cycle_detailed') {
                    const subIds = ['target', 'actual', 'achievement', 'score'];
                    subIds.forEach(subId => {
                        let sum = 0;
                        let count = 0;
                        [...daysDetailed, ...daysSummary].forEach(d => {
                            const valStr = d.startsWith('d') ? newGridData[`${row.id}_${d}_${subId}_avg`] : newGridData[`${row.id}_${d}_${subId}`];
                            const val = parseFloat(valStr) || 0;
                            if (val > 0) {
                                sum += val;
                                count++;
                            }
                        });
                        const evalAvg = count > 0 ? Math.round(sum / count) : 0;
                        const key = `${row.id}_eval_${subId}`;
                        const valStr = evalAvg > 0 ? (subId === 'achievement' ? `${evalAvg}%` : evalAvg.toString()) : "";
                        if (newGridData[key] !== valStr) {
                            newGridData[key] = valStr;
                            hasChanges = true;
                        }
                        if (subId === 'score') catEvalSum += evalAvg;
                    });
                } else {
                    let sum = 0;
                    let count = 0;
                    [...daysDetailed, ...daysSummary].forEach(d => {
                        const valStr = d.startsWith('d') ? (newGridData[`${row.id}_${d}_avg`] || newGridData[`${row.id}_${d}`]) : newGridData[`${row.id}_${d}`];
                        const val = parseFloat(valStr) || 0;
                        if (val > 0) {
                            sum += val;
                            count++;
                        }
                    });
                    const evalAvg = count > 0 ? Math.round(sum / count) : 0;
                    const evalKey = `${row.id}_eval`;
                    const valStr = evalAvg > 0 ? evalAvg.toString() : "";
                    if (newGridData[evalKey] !== valStr) {
                        newGridData[evalKey] = valStr;
                        hasChanges = true;
                    }
                    if (row.weight && typeof row.weight === 'number') catEvalSum += evalAvg;
                }
            });

            // Category Summary Eval
            if (cat.totalMark) {
                const evalTotalKey = `${cat.id}_eval_total`;
                const evalTotalVal = catEvalSum > 0 ? catEvalSum.toString() : "";
                if (newGridData[evalTotalKey] !== evalTotalVal) {
                    newGridData[evalTotalKey] = evalTotalVal;
                    hasChanges = true;
                }

                const evalActualKey = `${cat.id}_eval_actual`;
                if (catTotalMark > 0) {
                    const evalActualPerc = Math.round((catEvalSum / catTotalMark) * 100);
                    const evalActualStr = evalActualPerc > 0 ? `${evalActualPerc}%` : "";
                    if (newGridData[evalActualKey] !== evalActualStr) {
                        newGridData[evalActualKey] = evalActualStr;
                        hasChanges = true;
                    }
                }
            }
        });

        // Attendance (Category 6) Calculations
        let attendanceAvgPerc = 0;
        let attSum = 0;
        let attCount = 0;
        for (let i = 1; i <= 16; i++) {
            const val = parseFloat(gridData[`attendance_actual_${i}`]) || 0;
            if (val > 0) {
                attSum += val;
                attCount++;
            }
        }
        attendanceAvgPerc = attCount > 0 ? Math.round(attSum / attCount) : 0;
        updateKey('attendance_total_score', attendanceAvgPerc > 0 ? `${attendanceAvgPerc}%` : "");

        // Score Ranges Summary Calculations
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

    const handleSave = async () => {
        if (!studentId) {
            toast.error("Student ID is missing");
            return;
        }
        setSaving(true);
        try {
            await axiosInstance.post(`/api/sixteen-day-monitoring/${studentId}`, {
                ...headerInfo,
                gridData,
                footerData
            });
            toast.success("Monitoring sheet saved successfully");
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error?.response?.data?.message || "Failed to save monitoring sheet");
        } finally {
            setSaving(false);
        }
    };

    const daysDetailed = ['d1', 'd2', 'd3'];
    const daysSummary = Array.from({ length: 13 }, (_, i) => `day_${i + 4}`);

    const renderCycleDetailedRow = (rowId, dayPrefix) => {
        const subRows = [
            { id: 'target', label: 'WI Target (Sec)' },
            { id: 'actual', label: 'WI Actual' },
            { id: 'achievement', label: 'Achievement %' }
        ];

        return (
            <div className="flex flex-col h-full">
                {subRows.map((sub, sIdx) => (
                    <div key={sub.id} className={`flex flex-1 ${sIdx !== subRows.length - 1 ? 'border-b border-black' : ''}`}>
                        <div className="w-20 p-1 border-r border-black font-bold flex items-center bg-gray-50">{sub.label}</div>
                        <div className="flex flex-1">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="flex-1 border-r border-black">
                                    <input
                                        disabled={readOnly}
                                        className="w-full h-full text-center bg-transparent border-none text-[8px] p-0 focus:bg-blue-50"
                                        value={gridData[`${rowId}_${dayPrefix}_${sub.id}_${i}`] || ""}
                                        onChange={(e) => handleGridChange(rowId, `${dayPrefix}_${sub.id}_${i}`, e.target.value)}
                                    />
                                </div>
                            ))}
                            <div className="w-10 bg-gray-100 italic">
                                <input
                                    disabled={readOnly}
                                    className="w-full h-full text-center bg-transparent border-none text-[8px] font-bold p-0"
                                    value={gridData[`${rowId}_${dayPrefix}_${sub.id}_avg`] || ""}
                                    onChange={(e) => handleGridChange(rowId, `${dayPrefix}_${sub.id}_avg`, e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderCycleRow = (rowId, dayPrefix) => (
        <div className="flex w-full h-full">
            {[...Array(10)].map((_, i) => (
                <div key={i} className="flex-1 border-r border-black last:border-r-0">
                    <input
                        disabled={readOnly}
                        className="w-full text-center bg-transparent border-none text-[8px] p-0 focus:bg-blue-50 outline-none"
                        value={gridData[`${rowId}_${dayPrefix}_${i}`] || ""}
                        onChange={(e) => handleGridChange(rowId, `${dayPrefix}_${i}`, e.target.value)}
                    />
                </div>
            ))}
            <div className="w-10 bg-gray-100/50 flex items-center justify-center font-bold">
                <input
                    disabled={readOnly}
                    className="w-full text-center bg-transparent border-none text-[8px] p-0 outline-none"
                    value={gridData[`${rowId}_${dayPrefix}_avg`] || ""}
                    onChange={(e) => handleGridChange(rowId, `${dayPrefix}_avg`, e.target.value)}
                />
            </div>
        </div>
    );

    const renderSummaryDay = (rowId, dayKey) => (
        <td key={dayKey} className="p-0 border-r border-black min-w-[25px]">
            <input
                disabled={readOnly}
                className="w-full h-full text-center bg-transparent border-none text-[10px] p-0 focus:bg-blue-50"
                value={gridData[`${rowId}_${dayKey}`] || ""}
                onChange={(e) => handleGridChange(rowId, dayKey, e.target.value)}
            />
        </td>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-end gap-2 print:hidden">
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
                        onClick={() => exportToExcel("16-Day Monitoring Sheet", { studentId })}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                    </Button>
                </div>
                <Button variant="outline" onClick={() => window.print()} className="gap-2">
                    <Printer className="w-4 h-4" /> Print
                </Button>
            </div>

            <Card className="overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                    <div className="min-w-[1500px] p-4 text-xs text-black bg-white">

                        {/* Header Section */}
                        <div className="border-t border-x border-black">
                            <div className="flex justify-between items-start border-b border-black">
                                <div className="flex-1 text-center font-bold text-lg p-2 uppercase">
                                    Associate Performance Monitoring Check Sheet <br />
                                    <span className="text-sm font-normal">(WORKING IN {typeof headerInfo.dept === 'string' ? headerInfo.dept : (headerInfo.dept?.name || headerInfo.dept?._id || "DEPARTMENT")})</span>
                                </div>
                                <div className="w-48 border-l border-black text-[8px] font-bold">
                                    <div className="border-b border-black p-1 flex justify-between">
                                        <span>Document No.</span>
                                        <span>FRM-HR-004</span>
                                    </div>
                                    <div className="border-b border-black p-1 flex justify-between">
                                        <span>Revision No.</span>
                                        <span>07</span>
                                    </div>
                                    <div className="p-1 flex justify-between">
                                        <span>Revision Date:</span>
                                        <span>11.12.21</span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 text-[10px] bg-white">
                                <div className="border-r border-black">
                                    <div className="flex border-b border-black h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Employee Name</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {headerInfo.employeeName}</div>
                                    </div>
                                    <div className="flex border-b border-black h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Employee Code</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {headerInfo.employeeCode}</div>
                                    </div>
                                    <div className="flex border-b border-black h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Process Name</div>
                                        <div className="flex-1 p-1 border-l border-black h-full">
                                            <input 
                                                disabled={readOnly} 
                                                className="w-full h-full bg-transparent border-none outline-none px-1 font-semibold text-blue-700" 
                                                value={headerInfo.processName} 
                                                onChange={e => handleHeaderChange('processName', e.target.value)} 
                                                placeholder=": Enter Process"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Dept.</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {typeof headerInfo.dept === 'string' ? headerInfo.dept : (headerInfo.dept?.name || headerInfo.dept?._id || "")}</div>
                                    </div>
                                </div>
                                <div className="border-l border-black">
                                    <div className="flex border-b border-black h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Handover Date</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: 
                                            <input 
                                                type="date"
                                                disabled={readOnly} 
                                                className="bg-transparent border-none outline-none px-1 font-semibold text-blue-700" 
                                                value={headerInfo.handoverDate} 
                                                onChange={e => handleHeaderChange('handoverDate', e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                    <div className="flex border-b border-black h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Trg. Result</div>
                                        <div className="flex-1 p-1 border-l border-black h-full">
                                            <input 
                                                disabled={readOnly} 
                                                className="w-full h-full bg-transparent border-none outline-none px-1 font-semibold text-blue-700" 
                                                value={headerInfo.trgResult} 
                                                onChange={e => handleHeaderChange('trgResult', e.target.value)} 
                                                placeholder=": OK/NG"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex border-b border-black h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Working With</div>
                                        <div className="flex-1 p-1 border-l border-black h-full">
                                            <input 
                                                disabled={readOnly} 
                                                className="w-full h-full bg-transparent border-none outline-none px-1 font-semibold text-blue-700" 
                                                value={headerInfo.workingWith} 
                                                onChange={e => handleHeaderChange('workingWith', e.target.value)} 
                                                placeholder=": Enter Name"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex h-7 items-center">
                                        <div className="w-32 p-1 font-bold">Line & Leader Name</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {headerInfo.lineLeaderName}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Table */}
                        <div className="border border-black overflow-hidden mt-0">
                            <table className="w-full border-collapse text-[9px]">
                                <thead>
                                    <tr className="border-b border-black font-bold">
                                        <th rowSpan="3" className="border-r border-black w-8 bg-gray-50">S.No</th>
                                        <th rowSpan="3" className="border-r border-black w-32 bg-gray-50 text-left px-1">Parameters</th>
                                        <th rowSpan="3" colSpan="2" className="border-r border-black w-64 bg-gray-50 text-left px-1">Check Name</th>
                                        <th rowSpan="3" className="border-r border-black w-10 bg-gray-50 p-1 leading-tight">Mark<br/>(Max.)</th>
                                        <th colSpan="46" className="border-r border-black text-center bg-gray-200 uppercase tracking-widest py-1 border-b border-black text-[10px] font-bold">DAY WISE PERFORMANCE MONITORING</th>
                                        <th rowSpan="3" className="w-40 bg-blue-50/50 leading-tight border-l border-black">Evaluation after monitoring of 16 days</th>
                                    </tr>
                                    <tr className="border-b border-black bg-gray-50/30">
                                        <th colSpan="11" className="border-r border-black text-center h-6 font-bold">Day-1</th>
                                        <th colSpan="11" className="border-r border-black text-center font-bold">Day-2</th>
                                        <th colSpan="11" className="border-r border-black text-center font-bold">Day-3</th>
                                        {Array.from({ length: 13 }, (_, i) => (
                                            <th key={i} rowSpan="2" className="border-r border-black w-8 text-[9px] font-bold whitespace-nowrap">Day-{i + 4}</th>
                                        ))}
                                    </tr>
                                    <tr className="border-b border-black bg-gray-50/30">
                                        {[...Array(3)].map((_, dIdx) => (
                                            <React.Fragment key={dIdx}>
                                                {[...Array(10)].map((_, i) => <th key={i} className="border-r border-black w-5 text-[8px]">{i + 1}</th>)}
                                                <th className="border-r border-black w-8 text-[8px] font-bold italic leading-none">Avg<br/>Total</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {config.map((cat, catIdx) => {
                                        const totalRowsInCat = cat.rows.reduce((acc, row) => acc + (row.type === 'cycle_detailed' ? 4 : 1), 0)
                                        return (
                                            <React.Fragment key={cat.id}>
                                                {cat.rows.map((row, rowIdx) => {
                                                    if (row.type === 'cycle_detailed') {
                                                        const subRows = [
                                                            { id: 'target', label: 'C/T Target (Sec.)', hasMark: false },
                                                            { id: 'actual', label: 'C/T Actual', hasMark: false },
                                                            { id: 'achievement', label: 'Achievement %', hasMark: false, colorClass: 'text-black', rowClass: 'bg-yellow-100' },
                                                            { id: 'score', label: '', hasMark: true }
                                                        ]
                                                        return subRows.map((sub, sIdx) => (
                                                            <tr key={`${row.id}_${sub.id}`} className={`border-b border-black group hover:bg-blue-50/10 text-[9px] ${sub.rowClass || ''}`}>
                                                                {rowIdx === 0 && sIdx === 0 && (
                                                                    <>
                                                                        <td rowSpan={totalRowsInCat} className="border-r border-black text-center font-bold align-middle bg-gray-50/20">{catIdx + 1}</td>
                                                                        <td rowSpan={totalRowsInCat} className="border-r border-black p-1 font-bold align-middle bg-gray-50/20 whitespace-pre-line leading-tight">{cat.category}</td>
                                                                    </>
                                                                )}
                                                                {sIdx === 0 ? (
                                                                    <td rowSpan={3} className="border-r border-black p-1 align-middle font-semibold w-40 text-left pr-2">
                                                                        {row.label}
                                                                    </td>
                                                                 ) : sIdx === 3 ? (
                                                                     <td className="border-r border-black" />
                                                                 ) : null}
                                                                <td className="border-r border-black text-center align-middle font-bold bg-gray-50/30 text-[8px] leading-tight px-0.5 w-24">
                                                                    {sub.label}
                                                                </td>
                                                                <td className="border-r border-black text-center align-middle font-bold w-10 text-[10px]">
                                                                    {sub.hasMark ? row.weight : ''}
                                                                </td>
                                                                {daysDetailed.map(dayPrefix => (
                                                                    <td key={dayPrefix} colSpan="11" className="p-0 border-r border-black align-middle h-full">
                                                                        <div className="flex w-full min-h-[1.5rem] h-full">
                                                                            {[...Array(10)].map((_, i) => (
                                                                                <div key={i} className="flex-1 min-w-[20px] border-r border-black last:border-r-0 h-full flex items-center">
                                                                                    <input
                                                                                        disabled={readOnly}
                                                                                        className={`w-full text-center bg-transparent border-none text-[8px] font-bold p-0 focus:bg-blue-50 outline-none ${sub.colorClass || 'text-black'}`}
                                                                                        value={gridData[`${row.id}_${dayPrefix}_${sub.id}_${i}`] || ""}
                                                                                        onChange={(e) => handleGridChange(row.id, `${dayPrefix}_${sub.id}_${i}`, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                            <div className="w-8 flex items-center justify-center font-bold border-l border-black bg-yellow-400 min-h-[1.5rem]">
                                                                                <input
                                                                                    disabled={readOnly}
                                                                                    className={`w-full text-center bg-transparent border-none text-[8px] p-0 font-bold outline-none ${sub.colorClass || 'text-black'}`}
                                                                                    value={gridData[`${row.id}_${dayPrefix}_${sub.id}_avg`] || ""}
                                                                                    onChange={(e) => handleGridChange(row.id, `${dayPrefix}_${sub.id}_avg`, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                ))}
                                                                {daysSummary.map(dayKey => (
                                                                    <td key={dayKey} className="p-0 border-r border-black min-w-[25px]">
                                                                        <input
                                                                            disabled={readOnly || sub.id === 'achievement'}
                                                                            className={`w-full h-full text-center bg-transparent border-none text-[9px] font-bold p-0 min-h-[1.5rem] focus:bg-blue-50 outline-none ${sub.colorClass || 'text-blue-700'}`}
                                                                            value={gridData[`${row.id}_${dayKey}_${sub.id}`] || ""}
                                                                            onChange={(e) => handleGridChange(row.id, `${dayKey}_${sub.id}`, e.target.value)}
                                                                        />
                                                                    </td>
                                                                ))}
                                                                {rowIdx === 0 && sIdx === 0 && (
                                                                    <td rowSpan={totalRowsInCat} className="border-l border-black bg-white w-40" />
                                                                )}
                                                            </tr>
                                                        ))
                                                    }
                                                    return (
                                                        <tr key={row.id} className="border-b border-black group hover:bg-blue-50/10 min-h-[1.5rem] text-[9px]">
                                                            {rowIdx === 0 && (
                                                                <>
                                                                    <td rowSpan={totalRowsInCat} className="border-r border-black text-center font-bold align-middle bg-gray-50/20">{catIdx + 1}</td>
                                                                    <td rowSpan={totalRowsInCat} className="border-r border-black p-1 font-bold align-middle bg-gray-50/20 whitespace-pre-line leading-tight">{cat.category}</td>
                                                                </>
                                                            )}
                                                            <td colSpan="2" className={`border-r border-black p-1 align-middle text-left ${row.type === 'cycle' ? 'font-semibold' : 'font-medium'}`}>
                                                                {row.label}
                                                            </td>
                                                            <td className="border-r border-black text-center align-middle font-bold text-[10px] w-10">{row.weight}</td>
                                                            
                                                            {daysDetailed.map(dayPrefix => (
                                                                <td key={dayPrefix} colSpan="11" className="p-0 border-r border-black align-middle h-full">
                                                                    {row.type === 'cycle' ? (
                                                                        <div className="flex w-full min-h-[1.5rem] h-full">
                                                                            {[...Array(10)].map((_, i) => (
                                                                                <div key={i} className="flex-1 min-w-[20px] border-r border-black last:border-r-0 h-full flex items-center">
                                                                                    <input
                                                                                        disabled={readOnly}
                                                                                        className="w-full text-center bg-transparent border-none font-bold text-blue-700 text-[8px] p-0 focus:bg-blue-50 outline-none"
                                                                                        value={gridData[`${row.id}_${dayPrefix}_${i}`] || ""}
                                                                                        onChange={(e) => handleGridChange(row.id, `${dayPrefix}_${i}`, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                            <div className="w-8 flex items-center justify-center font-bold border-l border-black bg-yellow-400 min-h-[1.5rem]">
                                                                                <input
                                                                                    disabled={readOnly}
                                                                                    className="w-full text-center bg-transparent border-none text-blue-700 font-bold text-[8px] p-0 outline-none"
                                                                                    value={gridData[`${row.id}_${dayPrefix}_avg`] || ""}
                                                                                    onChange={(e) => handleGridChange(row.id, `${dayPrefix}_avg`, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex w-full h-full min-h-[1.5rem]">
                                                                            <input
                                                                                disabled={readOnly}
                                                                                className="w-full h-full text-center bg-transparent font-bold border-none text-[9px] text-blue-700 py-1 px-0 focus:bg-blue-50 outline-none min-h-[1.5rem]"
                                                                                value={gridData[`${row.id}_${dayPrefix}`] || ""}
                                                                                onChange={(e) => handleGridChange(row.id, dayPrefix, e.target.value)}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            ))}
                                                            
                                                            {daysSummary.map(dayKey => (
                                                                <td key={dayKey} className="border-r border-black p-0 h-full">
                                                                    <input 
                                                                        disabled={readOnly}
                                                                        className="w-full text-center bg-transparent font-bold border-none text-blue-700 text-[9px] min-h-[1.5rem] outline-none"
                                                                        value={gridData[`${row.id}_${dayKey}`] || ""}
                                                                        onChange={e => handleGridChange(row.id, dayKey, e.target.value)}
                                                                    />
                                                                </td>
                                                            ))}
                                                            {rowIdx === 0 && (
                                                                <td rowSpan={totalRowsInCat} className="border-l border-black bg-white w-40" />
                                                            )}
                                                        </tr>
                                                    )
                                                })}
                                            {/* Category Summary Row */}
                                            {cat.totalMark && (
                                                <tr className="border-b border-black bg-yellow-200 h-6">
                                                    <td colSpan="4" className="text-right p-1 font-bold">Total Mark:</td>
                                                    <td className="border-r border-black text-center font-bold text-blue-600">{cat.totalMark}</td>
                                                    {/* Day 1-3 */}
                                                    {daysDetailed.map(d => (
                                                        <td key={d} colSpan="11" className="border-r border-black p-0 h-full">
                                                            <input 
                                                                disabled={true}
                                                                className="w-full text-center bg-transparent border-none text-[8px] font-bold text-black h-full outline-none"
                                                                value={gridData[`${cat.id}_${d}_total`] || ""}
                                                                onChange={e => handleGridChange(cat.id, `${d}_total`, e.target.value)}
                                                            />
                                                        </td>
                                                    ))}
                                                    {/* Day 4-16 */}
                                                    {daysSummary.map(d => (
                                                        <td key={d} className="border-r border-black p-0 h-full">
                                                            <input 
                                                                disabled={true}
                                                                className="w-full text-center bg-transparent border-none text-[8px] font-bold text-black h-full outline-none"
                                                                value={gridData[`${cat.id}_${d}_total`] || ""}
                                                                onChange={e => handleGridChange(cat.id, `${d}_total`, e.target.value)}
                                                            />
                                                        </td>
                                                    ))}
                                                    <td className="bg-blue-100/50 p-0 h-full border-l border-black">
                                                        <input 
                                                            disabled={true}
                                                            className="w-full text-center bg-transparent border-none text-[9px] font-bold h-full outline-none text-blue-900"
                                                            value={gridData[`${cat.id}_eval_total`] || ""}
                                                            onChange={e => handleGridChange(cat.id, 'eval_total', e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                            {cat.target && (
                                                <React.Fragment>
                                                    <tr className="border-b border-black bg-yellow-100 h-6">
                                                        <td colSpan="4" className="text-right p-1 font-bold">Plan:</td>
                                                        <td className="border-r border-black text-center font-bold">{cat.target}</td>
                                                        {/* Day 1-3 */}
                                                        {daysDetailed.map(d => (
                                                            <td key={d} colSpan="11" className="border-r border-black text-center font-bold text-[8px]">100%</td>
                                                        ))}
                                                        {/* Day 4-16 */}
                                                        {daysSummary.map(d => (
                                                            <td key={d} className="border-r border-black text-center font-bold text-[8px]">100%</td>
                                                        ))}
                                                        <td className="bg-white p-0 h-full border-l border-black">
                                                            <div className="flex w-full h-full divide-x divide-black">
                                                                <div className="flex-1 px-1 flex items-center font-bold bg-white">Plan:</div>
                                                                <div className="w-20 px-1 flex items-center justify-end font-bold bg-white text-[10px]">{cat.target || '100%'}</div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    <tr className="border-b border-black bg-yellow-200 h-6">
                                                        <td colSpan="4" className="text-right p-1 font-bold">{cat.actualLabel || "Actual %:"}</td>
                                                        <td className="border-r border-black text-center font-bold italic">-</td>
                                                        {daysDetailed.map(d => (
                                                            <td key={d} colSpan="11" className="border-r border-black p-0 h-full">
                                                                <input 
                                                                    disabled={true}
                                                                    className="w-full text-center bg-transparent border-none text-[8px] font-bold h-full outline-none text-black"
                                                                    value={gridData[`${cat.id}_${d}_actual`] || ""}
                                                                    onChange={e => handleGridChange(cat.id, `${d}_actual`, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        {daysSummary.map(d => (
                                                            <td key={d} className="border-r border-black p-0 h-full">
                                                                <input 
                                                                    disabled={true}
                                                                    className="w-full text-center bg-transparent border-none text-[8px] font-bold h-full outline-none text-black"
                                                                    value={gridData[`${cat.id}_${d}_actual`] || ""}
                                                                    onChange={e => handleGridChange(cat.id, `${d}_actual`, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="bg-yellow-400 p-0 h-full border-l border-black">
                                                            <div className="flex w-full h-full divide-x divide-black">
                                                                <div className="flex-1 px-1 flex items-center font-bold">Actual (Avg %)</div>
                                                                <div className="w-20 px-1 flex items-center justify-end font-bold text-[10px]">
                                                                    {gridData[`${cat.id}_eval_actual`] || ""}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom Tables Section */}
                        <div className="mt-4 space-y-6">
                            {/* 6. Attendance Table */}
                            <div className="border border-black">
                                <table className="w-full border-collapse text-[10px]">
                                    <tbody>
                                        <tr className="border-b border-black">
                                            <td rowSpan="3" className="w-8 border-r border-black font-bold text-center">6</td>
                                            <td rowSpan="3" className="w-48 border-r border-black font-bold p-1">Attendance</td>
                                            <td className="w-32 border-r border-black font-bold p-1">Total no. of Monitoring day's :</td>
                                            <td className="w-16 border-r border-black font-bold text-center bg-gray-50 italic">Date</td>
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <td key={i} className="border-r border-black min-w-[30px] p-0">
                                                    <input 
                                                        disabled={readOnly}
                                                        className="w-full text-center bg-transparent border-none text-[8px] outline-none"
                                                        value={gridData[`attendance_date_${i + 1}`] || ""}
                                                        onChange={e => handleGridChange('attendance', `date_${i + 1}`, e.target.value)}
                                                        placeholder="DD/MM"
                                                    />
                                                </td>
                                            ))}
                                            <td className="w-16 bg-blue-50 text-center font-bold">16 Day Score</td>
                                        </tr>
                                        <tr className="border-b border-black h-6">
                                            <td className="border-r border-black font-bold p-1">Target %</td>
                                            <td className="border-r border-black text-center font-bold">100%</td>
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <td key={i} className="border-r border-black text-center text-[8px] font-bold">100%</td>
                                            ))}
                                            <td className="bg-blue-50 text-center font-bold">100%</td>
                                        </tr>
                                        <tr className="h-6">
                                            <td className="border-r border-black font-bold p-1">Actual % age followed</td>
                                            <td className="border-r border-black italic font-bold"></td>
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <td key={i} className="border-r border-black p-0">
                                                    <input 
                                                        disabled={readOnly}
                                                        className="w-full text-center bg-transparent border-none text-[8px] outline-none font-bold"
                                                        value={gridData[`attendance_actual_${i + 1}`] || ""}
                                                        onChange={e => handleGridChange('attendance', `actual_${i + 1}`, e.target.value)}
                                                    />
                                                </td>
                                            ))}
                                            <td className="bg-blue-50 p-0">
                                                <input 
                                                    disabled={true}
                                                    className="w-full text-center bg-transparent border-none text-[10px] outline-none font-bold text-blue-900"
                                                    value={gridData[`attendance_total_score`] || ""}
                                                    onChange={e => handleGridChange('attendance', 'total_score', e.target.value)}
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="italic text-[8px] mt-1 -mb-2">
                                * Count all days of person include absenteeism during 16days of monitoring in attendance parameter 6
                                <br />
                                * Fulfill above 1-5 parameters based on working days of person absent then fill next date into column days
                            </div>

                            {/* Summary and Legends Grid */}
                            <div className="grid grid-cols-12 gap-2 mt-4">
                                {/* Score Ranges Table */}
                                <div className="col-span-5 border border-black overflow-hidden">
                                    <table className="w-full border-collapse text-[8px]">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-black font-bold">
                                                <th className="border-r border-black p-1">Parameters</th>
                                                <th className="border-r border-black p-1">Total Weightage</th>
                                                <th className="border-r border-black p-1">Poor</th>
                                                <th className="border-r border-black p-1">Average**</th>
                                                <th className="border-r border-black p-1">V. Good</th>
                                                <th className="border-r border-black p-1">Excellent</th>
                                                <th className="border-r border-black p-1">Avg. Score (Individual) in %</th>
                                                <th className="p-1">Score Achieved w.r.t weightage</th>
                                            </tr>
                                            <tr className="bg-gray-100/50 border-b border-black italic">
                                                <th colSpan="2"></th>
                                                <th colSpan="4" className="border-x border-black h-4 text-center">% range</th>
                                                <th colSpan="2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { label: '10 Cycle Check', weight: 0.4, poor: '70-80', avg: '81-90', good: '91-95', excel: '96-100', id: 'score1' },
                                                { label: 'Quality / System', weight: 0.2, poor: '70-80', avg: '81-90', good: '91-95', excel: '96-100', id: 'score2' },
                                                { label: 'Defect Captured', weight: 0.1, poor: '40-50', avg: '51-65', good: '66-80', excel: '100', id: 'score3' },
                                                { label: 'Discipline', weight: 0.1, poor: '0-70', avg: '71-80', good: '81-90', excel: '91-100', id: 'score4' },
                                                { label: 'Safety', weight: 0.1, poor: '30-35', avg: '36-47', good: '48-55', excel: '100', id: 'score5' },
                                                { label: 'Attendance', weight: 0.1, poor: '50-75', avg: '76-85', good: '86-95', excel: '96-100', id: 'score6' },
                                            ].map((row, idx) => (
                                                <tr key={idx} className="border-b border-black">
                                                    <td className="border-r border-black p-1 font-bold">{row.label}</td>
                                                    <td className="border-r border-black text-center font-bold h-6">{row.weight}</td>
                                                    <td className="border-r border-black text-center text-gray-400">{row.poor}</td>
                                                    <td className="border-r border-black text-center text-gray-400">{row.avg}</td>
                                                    <td className="border-r border-black text-center text-gray-400">{row.good}</td>
                                                    <td className="border-r border-black text-center text-gray-400">{row.excel}</td>
                                                    <td className="border-r border-black p-0">
                                                        <input 
                                                            disabled={true}
                                                            className="w-full text-center bg-transparent border-none text-[8px] font-bold h-full outline-none text-blue-800"
                                                            value={gridData[`summary_avg_${row.id}`] || ""}
                                                            onChange={e => handleGridChange('summary', `avg_${row.id}`, e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-0">
                                                        <input 
                                                            disabled={true}
                                                            className="w-full text-center bg-transparent border-none text-[8px] font-bold h-full outline-none text-blue-800"
                                                            value={gridData[`summary_weight_${row.id}`] || ""}
                                                            onChange={e => handleGridChange('summary', `weight_${row.id}`, e.target.value)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="font-bold bg-gray-50">
                                                <td className="border-r border-black p-1">Total</td>
                                                <td className="border-r border-black text-center">1</td>
                                                <td colSpan="4" className="border-r border-black"></td>
                                                <td className="border-r border-black p-0 italic text-center">100%</td>
                                                <td className="p-0">
                                                    <input 
                                                        disabled={true}
                                                        className="w-full text-center bg-blue-100 border-none text-[10px] font-bold h-full outline-none"
                                                        value={gridData[`summary_total_score`] || ""}
                                                        onChange={e => handleGridChange('summary', 'total_score', e.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Evaluation Legend Tables */}
                                <div className="col-span-3 space-y-4">
                                    <div className="border border-black overflow-hidden">
                                        <table className="w-full border-collapse text-[8px]">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-black">
                                                    <th colSpan="2" className="p-1 font-bold uppercase">Evaluation Criteria: Cycle time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-black">
                                                    <td className="w-8 border-r border-black text-center font-bold h-5">0</td>
                                                    <td className="p-1">Is {'>'} 20% of standard time</td>
                                                </tr>
                                                <tr className="border-b border-black">
                                                    <td className="w-8 border-r border-black text-center font-bold h-5">1</td>
                                                    <td className="p-1">11% - 20% of standard time</td>
                                                </tr>
                                                <tr>
                                                    <td className="w-8 border-r border-black text-center font-bold h-5">2</td>
                                                    <td className="p-1">Fit & above of standard time</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="border border-black overflow-hidden">
                                        <table className="w-full border-collapse text-[8px]">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-black">
                                                    <th colSpan="2" className="p-1 font-bold uppercase text-left">Evaluation Criteria: Quality / System, Discipline, 5S & Safety, 10 Cycle check</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-black">
                                                    <td className="w-8 border-r border-black text-center font-bold h-5">0</td>
                                                    <td className="p-1">Not known / Not adhere the rule</td>
                                                </tr>
                                                <tr className="border-b border-black">
                                                    <td className="w-8 border-r border-black text-center font-bold h-5">1</td>
                                                    <td className="p-1">Partially known / Partially adhere the rule</td>
                                                </tr>
                                                <tr>
                                                    <td className="w-8 border-r border-black text-center font-bold h-5">2</td>
                                                    <td className="p-1">Known / completely adhere the rule</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Signature and Comments blocks */}
                                <div className="col-span-4 space-y-2">
                                    <div className="border border-black p-2 h-24 bg-white">
                                        <div className="flex justify-between font-bold text-[8px] h-full">
                                            <div className="text-center w-1/3 border-r border-black flex flex-col justify-between py-1">
                                                <span>Checked By:-</span>
                                                <span className="text-[7px] font-normal italic">(Process Incharge)</span>
                                            </div>
                                            <div className="text-center w-1/3 border-r border-black flex flex-col justify-between py-1">
                                                <span>Verified By:-</span>
                                                <span className="text-[7px] font-normal italic">(Area Incharge)</span>
                                            </div>
                                            <div className="text-center w-1/3 flex flex-col justify-between py-1">
                                                <span>Approved By:-</span>
                                                <span className="text-[7px] font-normal italic">(Dept. Head)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border border-black h-24 flex flex-col bg-white overflow-hidden">
                                        <div className="bg-gray-100 p-1 font-bold text-[9px] border-b border-black text-center uppercase">Comment (If Any) ***</div>
                                        <div className="flex-1 p-0 flex">
                                            <textarea 
                                                disabled={readOnly}
                                                className="flex-1 h-full border-none bg-transparent p-1 text-[9px] outline-none resize-none" 
                                                value={footerData.comment || ""}
                                                onChange={e => handleFooterChange('comment', e.target.value)}
                                                placeholder="Write comments here..."
                                            />
                                            <div className="w-1/3 h-full flex flex-col items-center justify-center text-center border-l border-black bg-white">
                                                <span className="font-bold text-[8px]">Verified By:</span>
                                                <span className="font-bold text-[8px]">(Education Cell)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 text-[7px] italic space-y-1">
                                <p>** Average criteria is minimum passing marks for associates.</p>
                                <p>*** In case fail employee sheet verify the data by education cell.</p>
                            </div>
                        </div>

                    </div>
                </CardContent>
            </Card>

            {/* Edit Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit 16-Day Monitoring Setup</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-4 p-4 text-sm">
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
        </div>
    );
};

export default SixteenDayMonitoringSheet;

