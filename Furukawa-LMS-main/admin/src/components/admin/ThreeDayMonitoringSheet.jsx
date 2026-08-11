import React, { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from "@/Helper/axiosInstance";
import useRevisionInfo from "@/hooks/useRevisionInfo";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportHelper";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Edit2,
    History,
    Loader2,
    Save,
    Download,
    Send,
    Mail,
    CheckCircle2,
    CheckCircle2 as CheckIcon,
    ShieldCheck,
    XCircle,
    XCircle as RejectIcon,
    Trash2,
    Printer,
    Lock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";

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
        totalMark: 100,
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
        target: "100 %"
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
    },
];


const ThreeDayMonitoringSheet = ({
    studentId,
    departmentId,
    departmentName = "",
    sectionName = "",
    readOnly = false,
    canEditConfig = false,
    initialForceNewAttempt = false
}) => {
    // No sectionId prop reaches this component today — department-level scoping
    // only; the backend still resolves the student's own section at freeze time.
    const liveRevisionInfo = useRevisionInfo("three-day-monitoring", { docNo: "FRM-WH-QA-240", revNo: "00", revDate: "16.10.20" }, { departmentId });
    const [savedRevisionInfo, setSavedRevisionInfo] = useState(null);
    // A saved attempt keeps whatever docNo/revNo/revDate was frozen into it at
    // creation; only a brand-new (not-yet-created) attempt shows the live value.
    const revisionInfo = savedRevisionInfo?.docNo ? savedRevisionInfo : liveRevisionInfo;
    const [headerInfo, setHeaderInfo] = useState({
        employeeName: "",
        employeeCode: "",
        processName: "",
        dept: sectionName || departmentName || "",
        handoverDate: "",
        trgResult: "",
        workingWith: "",
        lineLeaderName: ""
    });

    const [gridData, setGridData] = useState({});
    const [footerData, setFooterData] = useState({});
    const authUser = useSelector(state => state.auth.user);
    const canVerify = authUser?.isAdmin || authUser?.customRole?.permissions?.includes('three_day:verify');
    const canApprove = authUser?.isAdmin || authUser?.customRole?.permissions?.includes('three_day:approve');
    const canEdit = authUser?.isAdmin || authUser?.isTrainer ||
        authUser?.customRole?.permissions?.includes('three_day:edit') ||
        authUser?.customRole?.permissions?.includes('three_day:manage');
    const canEditSubmitted = authUser?.isAdmin || authUser?.isTrainer ||
        authUser?.customRole?.permissions?.includes('three_day:edit_submitted') ||
        authUser?.customRole?.permissions?.includes('three_day:manage');
    const isOwner = !!studentId && String(authUser?.id || authUser?._id) === String(studentId);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState(DEFAULT_MONITORING_CONFIG);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [configJson, setConfigJson] = useState('');
    const [configRemark, setConfigRemark] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [status, setStatus] = useState("Draft");
    const [lines, setLines] = useState([]);
    const [stations, setStations] = useState([]);
    const isDesignMode = !studentId;

    // Attempt History (Versioning)
    const [historyAttempts, setHistoryAttempts] = useState([]);
    const [selectedAttemptId, setSelectedAttemptId] = useState("");
    const [isForceNewAttempt, setIsForceNewAttempt] = useState(false);
    const isLocked = status === "Submitted"
        ? !canEditSubmitted && !canVerify && !canApprove
        : !isOwner && !canEdit;

    useEffect(() => {
        if (studentId) fetchData();
        if (departmentId && departmentId !== 'undefined') fetchConfig();
    }, [studentId, departmentId, sectionName, departmentName, authUser, initialForceNewAttempt]);

    // Auto-populate checkedByName when authUser is available and it's a new or blank field
    useEffect(() => {
        if (!readOnly && authUser && !footerData.checkedByName) {
            setFooterData(prev => ({
                ...prev,
                checkedByName: authUser.fullName || authUser.name || ""
            }));
        }
    }, [authUser, readOnly, footerData.checkedByName]);

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
            // Reset current data while loading new student
            setGridData({});
            setFooterData({});
            setStatus("Draft");
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
                    dept: sectionName || data.dept || departmentName || "",
                    lineName: data.lineName || prev.lineName,
                }));

                setFooterData(prev => ({
                    ...prev,
                    checkedByName: data.checkedBy || prev.checkedByName || authUser?.fullName || authUser?.name || "",
                    verifiedByName: data.verifiedBy || prev.verifiedByName || "",
                    approvedByName: data.approvedBy || prev.approvedByName || ""
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
                    if (initialForceNewAttempt) {
                        setGridData({});
                        setFooterData({});
                        setStatus("Draft");
                        setSelectedAttemptId("");
                        setIsForceNewAttempt(true);
                        setSavedRevisionInfo(null);
                        setHeaderInfo(prev => ({
                            ...prev,
                            checkedBy: "",
                            verifiedBy: "",
                            approvedBy: "",
                            attemptNumber: (data.attemptNumber || 1) + 1
                        }));
                    } else {
                        setGridData(data.gridData || data.entries || {});
                        setFooterData(data.evaluation || data.footerData || {});
                        setStatus(data.status || "Draft");
                        setSelectedAttemptId(data.id);
                        setIsForceNewAttempt(false);
                        setSavedRevisionInfo({ docNo: data.docNo, revNo: data.revNo, revDate: data.revDate });
                        setHeaderInfo(prev => ({
                            ...prev,
                            attemptNumber: data.attemptNumber || 1
                        }));
                    }
                } else {
                    setGridData({});
                    setFooterData({});
                    setStatus("Draft");
                    setSelectedAttemptId("");
                    setIsForceNewAttempt(false);
                    setSavedRevisionInfo(null);
                    setHeaderInfo(prev => ({
                        ...prev,
                        attemptNumber: 1
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoryAttempts = async () => {
        if (!studentId) return;
        try {
            const res = await axiosInstance.get(`/api/three-day-monitoring/${studentId}/history`);
            if (res.data.success) {
                setHistoryAttempts(res.data.data);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    };

    useEffect(() => {
        if (studentId) {
            fetchHistoryAttempts();
        }
    }, [studentId]);

    useEffect(() => {
        const handleStartNew = (e) => {
            if (String(e.detail.studentId) === String(studentId)) {
                setIsForceNewAttempt(true);
                setGridData({});
                setEvaluationData({});
                setStatus("Draft");
                setHeaderInfo(prev => ({
                    ...prev,
                    attemptNumber: (historyAttempts[0]?.attemptNumber || 0) + 1
                }));
                setFooterData({
                    checkedByName: authUser?.fullName || authUser?.name || "",
                    verifiedByName: "",
                    approvedByName: "",
                    comment: ""
                });
                setSelectedAttemptId("");
                setSavedRevisionInfo(null);
                toast.info(`Starting new attempt (#${(historyAttempts[0]?.attemptNumber || 0) + 1})`);
            }
        };
        window.addEventListener('START_NEW_THREE_DAY_MONITORING', handleStartNew);
        return () => window.removeEventListener('START_NEW_THREE_DAY_MONITORING', handleStartNew);
    }, [studentId, historyAttempts]);

    const handleAttemptChange = async (attemptId) => {
        if (!attemptId) {
            // Load latest/new attempt
            fetchData();
            return;
        }
        setSelectedAttemptId(attemptId);
        setIsForceNewAttempt(false);
        try {
            setLoading(true);
            const res = await axiosInstance.get(`/api/three-day-monitoring/${studentId}?recordId=${attemptId}`);
            if (res.data.success) {
                const data = res.data.data;
                
                // Update Header Info - Ensure we don't lose basic student info
                setHeaderInfo(prev => ({
                    ...prev,
                    employeeName: data.employeeName || prev.employeeName,
                    employeeCode: data.employeeCode || prev.employeeCode,
                    processName: data.processName || prev.processName,
                    dept: data.dept || prev.dept,
                    lineName: data.lineName || prev.lineName,
                    handoverDate: data.handoverDate || "",
                    trgResult: data.trgResult || "",
                    workingWith: data.workingWith || "",
                    lineLeaderName: data.lineLeaderName || "",
                    attemptNumber: data.attemptNumber || 1
                }));

                // Update Grid and Footer
                setGridData(data.entries || data.gridData || {});
                
                const evalData = data.evaluation || data.footerData || {};
                setFooterData({
                    ...evalData,
                    checkedByName: data.checkedBy || evalData.checkedByName || "",
                    verifiedByName: data.verifiedBy || evalData.verifiedByName || "",
                    approvedByName: data.approvedBy || evalData.approvedByName || "",
                    comment: data.comment || evalData.comment || ""
                });
                
                setStatus(data.status || "Draft");
            }
        } catch (err) {
            console.error("Error loading attempt:", err);
            toast.error("Failed to load attempt data");
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

    const handleSave = async (finalStatus = null) => {
        if (!studentId) {
            toast.error("Student ID is missing");
            return;
        }

        const targetStatus = finalStatus || status || "Draft";

        if (targetStatus === 'Submitted') {
            const incompleteDays = [1, 2, 3].filter(d => !isDayColumnComplete(d));
            if (incompleteDays.length > 0) {
                toast.error(`Complete Day ${incompleteDays.join(', ')} (date + every checkpoint) before submitting.`);
                return;
            }
        }

        try {
            setSaving(true);
            const payload = {
                ...headerInfo,
                entries: gridData,
                evaluation: footerData,
                checkedBy: footerData.checkedByName,
                verifiedBy: footerData.verifiedByName,
                approvedBy: footerData.approvedByName,
                status: targetStatus,
                comment: footerData.comment,
                isNewAttempt: isForceNewAttempt,
                recordId: selectedAttemptId
            };

            const response = await axiosInstance.post(`/api/three-day-monitoring/${studentId}`, payload);
            if (response.data.success) {
                setStatus(targetStatus);
                setIsForceNewAttempt(false);
                fetchHistoryAttempts();
                toast.success(`Monitoring ${targetStatus === 'Submitted' ? 'Submitted' : 'Saved'} successfully`);

                if (targetStatus === 'Submitted') {
                    handleEmail(true);
                }
            }
        } catch (error) {
            console.error("Save error:", error);
            toast.error(error.response?.data?.message || "Failed to save monitoring sheet");
        } finally {
            setSaving(false);
        }
    };

    const handleEmail = async (isAuto = false) => {
        try {
            if (!isAuto) setSendingEmail(true);
            const response = await axiosInstance.post(`/api/progress/three-day-monitoring/${studentId}/email`);
            if (response.data.success) {
                toast.success("Monitoring report emailed successfully");
            }
        } catch (error) {
            console.error("Error sending email:", error);
            if (!isAuto) {
                toast.error(error.response?.data?.message || "Failed to send email report");
            }
        } finally {
            if (!isAuto) setSendingEmail(false);
        }
    };

    const handleSignature = (field, type) => {
        const name = authUser?.fullName || authUser?.name;
        const prefix = type === 'approve' ? "Approved By: " : "Rejected By: ";
        handleFooterChange(field, `${prefix}${name}`);
    };

    const handleClearSignature = (field) => {
        handleFooterChange(field, "");
    };

    const handleGridChange = (rowId, colId, value) => {
        if (readOnly || isLocked || isDesignMode) return;
        setGridData(prev => ({
            ...prev,
            [`${rowId}_${colId}`]: value
        }));
    };

    const handleHeaderChange = (field, value) => {
        if (readOnly || isLocked || isDesignMode) return;
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
        if (isDesignMode) return;

        // If it's a signature field, allow even if readOnly/isLocked IF user has permission
        const isSignature = field === 'verifiedByName' || field === 'approvedByName';
        const hasPerm = (field === 'verifiedByName' && canVerify) || (field === 'approvedByName' && canApprove);

        if (!isSignature && (readOnly || isLocked)) return;
        if (isSignature && !hasPerm && (readOnly || isLocked)) return;

        setFooterData(prev => ({
            ...prev,
            [field]: value
        }));
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
                if (catTotalMark > 0 && catId !== 'cat3') {
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
                // Use the raw sum for category evaluation (Total Marks / Total Max over 3 days)
                catEvalSum += sum;
            });

            if (catId === 'cat3') {
                let planSum = 0;
                let freeSum = 0;
                days.forEach(d => {
                    planSum += parseFloat(newGridData[`prodPlan_${d}`] || gridData[`prodPlan_${d}`]) || 0;
                    freeSum += parseFloat(newGridData[`defectFree_${d}`] || gridData[`defectFree_${d}`]) || 0;
                });

                const evalActualPerc = planSum > 0 ? Math.round((freeSum / planSum) * 100) : 0;
                updateKey(`${catId}_total_marks_sum`, planSum);
                updateKey(`${catId}_eval_total`, freeSum);
                updateKey(`${catId}_eval_actual`, evalActualPerc > 0 ? `${evalActualPerc}%` : "0%");
            } else if (catTotalMark > 0) {
                updateKey(`${catId}_eval_total`, catEvalSum > 0 ? catEvalSum : "");
                // Comparison is now against (catTotalMark * 3)
                const evalActualPerc = Math.round((catEvalSum / (catTotalMark * 3)) * 100);
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
    }, [gridData, config, readOnly, isDesignMode]);

    const getDisabledDatesForDay = (dayIdx) => {
        let prevMaxDate = null;
        for (let i = 1; i < dayIdx; i++) {
            const val = gridData[`day_date_${i}`];
            if (val && val.includes('-')) {
                try {
                    const d = parse(val, "dd-MMM-yy", new Date());
                    if (!prevMaxDate || d > prevMaxDate) prevMaxDate = d;
                } catch (e) {}
            }
        }
        let nextMinDate = null;
        for (let i = dayIdx + 1; i <= 3; i++) {
            const val = gridData[`day_date_${i}`];
            if (val && val.includes('-')) {
                try {
                    const d = parse(val, "dd-MMM-yy", new Date());
                    if (!nextMinDate || d < nextMinDate) nextMinDate = d;
                } catch (e) {}
            }
        }
        return (date) => {
            if (prevMaxDate && date <= prevMaxDate) return true;
            if (nextMinDate && date >= nextMinDate) return true;
            return false;
        };
    };

    // Checks whether every checkpoint in a given day's column (dayIdx: 1-3) has a value.
    // Attendance is excluded: the sheet only exposes a single shared attendance input (attendPresent_day1),
    // not one per day, so it can't be used to gate Day 2/3 completeness.
    const isDayColumnComplete = (dayIdx) => {
        const day = `day${dayIdx}`;
        if (!gridData[`day_date_${dayIdx}`]) return false;

        for (const cat of config) {
            for (const row of cat.rows) {
                if (row.id === 'defectFree') continue;

                if (row.id === 'prodPlan') {
                    const plan = gridData[`prodPlan_${day}`];
                    const free = gridData[`defectFree_${day}`];
                    if (plan === undefined || plan === null || plan.toString().trim() === "") return false;
                    if (free === undefined || free === null || free.toString().trim() === "") return false;
                    continue;
                }

                if (row.type === 'cycle_detailed') {
                    for (let i = 0; i < 10; i++) {
                        const scoreVal = gridData[`${row.id}_${day}_score_${i}`];
                        if (scoreVal === undefined || scoreVal === null || scoreVal.toString().trim() === "") return false;
                        if (row.hasCT) {
                            const ctVal = gridData[`${row.id}_${day}_ct_${i}`];
                            if (ctVal === undefined || ctVal === null || ctVal.toString().trim() === "") return false;
                        }
                    }
                    continue;
                }

                const isWeightNumeric = row.weight !== undefined && row.weight !== null && !isNaN(row.weight) && row.weight !== "-";
                if (!isWeightNumeric) continue;
                const val = gridData[`${row.id}_${day}`];
                if (val === undefined || val === null || val.toString().trim() === "") return false;
            }
        }

        if (dayIdx === 1) {
            const attVal = gridData['attendPresent_day1'];
            if (attVal === undefined || attVal === null || attVal.toString().trim() === "") return false;
        }

        return true;
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    const days = ['day1', 'day2', 'day3'];
    const allDaysComplete = [1, 2, 3].every(isDayColumnComplete);

    return (
        <div className="space-y-6">
            <Card className="w-max min-w-full print:shadow-none print:border-none">
                <div className="flex flex-wrap justify-between items-center gap-3 print:hidden mb-4 px-4 pt-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Badge className={cn(
                                "text-white font-bold px-3 py-1",
                                footerData.approvedByName?.includes("Rejected") || footerData.verifiedByName?.includes("Rejected") ? "bg-red-500" :
                                status === 'Submitted' ? "bg-blue-500" :
                                footerData.approvedByName?.includes("Approved") ? "bg-emerald-500" : "bg-slate-500"
                            )}>
                                {footerData.approvedByName?.includes("Rejected") ? "REJECTED BY APPROVER" :
                                 footerData.verifiedByName?.includes("Rejected") ? "REJECTED BY VERIFIER" :
                                 footerData.approvedByName?.includes("Approved") ? "APPROVED" :
                                 status.toUpperCase()}
                            </Badge>
                            {isForceNewAttempt && <Badge className="bg-blue-500 animate-pulse text-white text-[10px]">NEW ATTEMPT MODE</Badge>}
                        </div>

                        {historyAttempts.length > 0 && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Attempt History:</span>
                                <select 
                                    className="text-xs font-bold bg-transparent border-none outline-none text-indigo-600 cursor-pointer"
                                    value={selectedAttemptId}
                                    onChange={(e) => handleAttemptChange(e.target.value)}
                                >
                                    {historyAttempts.map((att) => (
                                        <option key={att.id} value={att.id}>
                                            Attempt #{att.attemptNumber} ({att.status}) - {new Date(att.createdAt).toLocaleDateString()}
                                        </option>
                                    ))}
                                    {isForceNewAttempt && (
                                        <option value="">Attempt #{(historyAttempts[0]?.attemptNumber || 0) + 1} (New)</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 items-center">
                        {isDesignMode && (
                            <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">DESIGN MODE: TEMPLATE SETUP</Badge>
                        )}
                        <div className="flex gap-1.5">
                            {canEditConfig && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchHistory}
                                        className="gap-1.5 h-8 text-[11px]"
                                    >
                                        <History className="h-3.5 w-3.5" />
                                        History
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setConfigJson(JSON.stringify(config, null, 2));
                                            setIsEditingLayout(true);
                                        }}
                                        className="gap-1.5 h-8 text-[11px]"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                        Edit Layout
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-green-600 text-green-600 hover:bg-green-50 h-8 text-[11px]"
                                onClick={() => exportToExcel("3-Day Monitoring Sheet", { studentId })}
                                disabled={isDesignMode}
                            >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Export
                            </Button>

                            <div className="flex gap-1 border-l pl-2 border-gray-200">
                                {status !== 'Submitted' && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleSave("Draft")}
                                        disabled={saving || isDesignMode}
                                        className="h-8 gap-1.5 text-[11px]"
                                    >
                                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                        Save Draft
                                    </Button>
                                )}

                                <Button
                                    variant={status === 'Submitted' ? "outline" : "default"}
                                    size="sm"
                                    onClick={() => handleSave("Submitted")}
                                    disabled={saving || isDesignMode || !allDaysComplete}
                                    title={!allDaysComplete ? "Complete all 3 day columns (dates + every checkpoint) before submitting" : undefined}
                                    className="h-8 gap-1.5 text-[11px]"
                                >
                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                    {status === 'Submitted' ? 'Update & Re-Submit' : 'Submit Monitoring'}
                                </Button>

                                {(status === 'Submitted' || authUser?.isAdmin || authUser?.isTrainer) && !isDesignMode && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-blue-600 text-blue-600 hover:bg-blue-50 h-8 gap-1.5 text-[11px]"
                                        onClick={() => handleEmail()}
                                        disabled={sendingEmail}
                                    >
                                        {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                                        Email
                                    </Button>
                                )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5 text-[11px]">
                                <Printer className="w-3.5 h-3.5" /> Print
                            </Button>
                        </div>
                    </div>
                </div>

                <CardHeader className="border-t">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Badge variant={status === 'Submitted' ? "success" : "secondary"} className="text-[10px] px-2 py-0.5 uppercase tracking-wider font-bold h-fit">
                                {status}
                            </Badge>
                            {isLocked && <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-200 bg-orange-50 h-fit">View Only</Badge>}
                        </div>
                        <div className="text-left">
                            <CardTitle className="text-lg font-bold uppercase tracking-wider">ASSOCIATE EFFECTIVENESS CHECK SHEET</CardTitle>
                            <p className="text-[10px] font-bold mt-0.5">(WORKING IN {headerInfo.dept || "DEPARTMENT / SECTION"})</p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="border-black border mb-6 text-[13px] m-4 min-w-max">
                        {[
                            { label: "Employee Name", field: "employeeName" },
                            { label: "Employee Code", field: "employeeCode" },
                            { label: "Dept. / Section", field: "dept" },
                            { label: "Process Name", field: "processName" },
                            { label: "Line Name", field: "lineName" }
                        ].map((row, idx) => (
                            <div key={idx} className="flex border-b border-black last:border-0 h-10 items-center">
                                <div className="w-[200px] px-2 font-medium border-r border-black flex items-center h-full font-bold">{row.label}</div>
                                <div className="flex-1 px-2 flex items-center h-full">
                                    <span className="mr-1">:</span>
                                    {row.field === "lineName" && lines.length > 0 ? (
                                        <select
                                            className="w-full h-full border-none outline-none bg-transparent font-bold text-blue-900 cursor-pointer disabled:cursor-default"
                                            value={headerInfo.lineName}
                                            onChange={(e) => handleHeaderChange("lineName", e.target.value)}
                                            disabled={readOnly || isLocked}
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
                                            className="w-full h-full border-none outline-none bg-transparent font-bold text-blue-900 cursor-pointer disabled:cursor-default"
                                            value={headerInfo.processName}
                                            onChange={(e) => handleHeaderChange("processName", e.target.value)}
                                            disabled={readOnly || isLocked || !headerInfo.lineName}
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
                                            disabled={readOnly || isLocked}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Monitoring Table */}
                    <div className="border-l border-t border-black min-w-max">
                        <table className="w-full border-collapse text-[12px]">
                            <thead>
                                <tr className="bg-gray-100 uppercase">
                                    <th className="border-r border-b border-black min-w-[50px] p-2 bg-gray-100" rowSpan={3}>S.No</th>
                                    <th className="border-r border-b border-black min-w-[200px] p-2 bg-gray-100" rowSpan={3}>Parameters</th>
                                    <th className="border-r border-b border-black min-w-[400px] p-2 bg-gray-100 uppercase" rowSpan={3}>Check Items</th>
                                    <th className="border-r border-b border-black min-w-[80px] p-2 bg-gray-100" rowSpan={3}>Mark<br />(Max.)</th>
                                    <th className="border-r border-b border-black p-2 py-3 bg-gray-200 text-[14px] font-bold" colSpan={33}>DAY WISE PERFORMANCE MONITORING</th>
                                    <th className="border-r border-b border-black min-w-[250px] p-2 bg-blue-50/50" rowSpan={3}>Evaluation after monitoring of 3 days</th>
                                </tr>
                                <tr className="bg-gray-100">
                                    {[...Array(3)].map((_, i) => {
                                        const dayIdx = i + 1;
                                        const val = gridData[`day_date_${dayIdx}`] || "";
                                        let selectedDate = undefined;
                                        try { if (val && val.includes('-')) selectedDate = parse(val, "dd-MMM-yy", new Date()); } catch (e) { }

                                        const isDayLocked = dayIdx > 1 && !isDayColumnComplete(dayIdx - 1);

                                        return (
                                            <th key={i} colSpan="11" className="border-r border-b border-black text-center h-16 font-bold text-[13px] p-0 bg-gray-50">
                                                {isDayLocked ? (
                                                    <div
                                                        className="flex flex-col items-center justify-center h-full w-full py-1 opacity-50 cursor-not-allowed"
                                                        title={`Complete Day ${dayIdx - 1} to unlock Day ${dayIdx}`}
                                                    >
                                                        <span>Day-{dayIdx}</span>
                                                        <span className="text-[11px] text-gray-400 font-normal italic flex items-center justify-center gap-1">
                                                            <Lock className="h-3 w-3" /> Locked
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 h-full w-full py-1">
                                                                <span>Day-{dayIdx}</span>
                                                                <span className={`text-[12px] ${val ? 'text-blue-700 underline decoration-dotted' : 'text-gray-400 font-normal italic'}`}>
                                                                    ({val || "Click to set date"})
                                                                </span>
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={selectedDate}
                                                                onSelect={(date) => date && handleGridChange('day_date', `${dayIdx}`, format(date, "dd-MMM-yy"))}
                                                                disabled={getDisabledDatesForDay(dayIdx)}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                                <tr className="bg-gray-50/50">
                                    {[1, 2, 3].map(d => (
                                        <React.Fragment key={d}>
                                            {[...Array(10)].map((_, i) => (
                                                <th key={i} className="border-r border-b border-black p-0 min-w-[45px] h-10 text-[11px] bg-white">{i + 1}</th>
                                            ))}
                                            <th className="border-r border-b border-black p-0 min-w-[75px] h-10 text-[12px] font-bold bg-gray-50">Total</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {config.map((cat, catIdx) => {
                                    const catId = cat.id || `cat${catIdx + 1}`;
                                    const catTotalMark = parseFloat(cat.totalMark) || 0;
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
                                                            <td key={d} className="border-r border-b border-black p-0 h-10" colSpan={11}>
                                                                <input
                                                                    className="w-full h-full text-center border-none outline-none bg-blue-50/30 font-bold text-[13px]"
                                                                    value={gridData[`${row.id}_day${d}`] || ""}
                                                                    onChange={(e) => handleGridChange(row.id, `day${d}`, e.target.value)}
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="border-r border-b border-black p-0 bg-blue-50/20" rowSpan={4}>
                                                            <div className="flex flex-col h-full text-[10px]">
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold">Total Marks</div>
                                                                    <div className="w-1/2 p-2 text-center text-[12px]">{catId === 'cat3' ? (gridData['cat3_total_marks_sum'] || 0) : ((parseFloat(cat.totalMark) || 0) * 3)}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold">Actual Marks</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-blue-900 text-[12px]">{gridData[`${catId}_eval_total`] || ""}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold">Target %</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-[12px]">{cat.target || "100%"}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold">Actual %</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-black text-[12px]">{gridData[`${catId}_eval_actual`] || ""}</div>
                                                                </div>
                                                                {catId === 'cat3' && (
                                                                    <div className="flex mt-auto border-t border-black">
                                                                        <div className="w-1/2 border-r border-black p-2 font-bold">Achievement %</div>
                                                                        <div className="w-1/2 p-2 text-center font-bold text-black text-[12px]">{gridData[`cat3_eval_actual`] || ""}</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {/* Actual Row */}
                                                    <tr>
                                                        <td className="border-r border-b border-black p-2 font-semibold">Defect free product</td>
                                                        {[1, 2, 3].map(d => {
                                                            const val = gridData[`defectFree_day${d}`] || "";
                                                            return (
                                                                <td key={d} className="border-r border-b border-black p-0 h-10" colSpan={11}>
                                                                    <div className="relative flex items-center justify-center min-w-[100px] h-full px-2">
                                                                        <span className="invisible whitespace-pre px-4 text-[13px] font-bold">{val || "00"}</span>
                                                                        <input
                                                                            className="absolute inset-0 w-full h-full text-center border-none outline-none bg-white font-bold text-[13px]"
                                                                            value={val}
                                                                            onChange={(e) => handleGridChange('defectFree', `day${d}`, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                    {/* Target Row */}
                                                    <tr>
                                                        <td className="border-r border-b border-black p-1 font-bold">Target %</td>
                                                        {[1, 2, 3].map(d => (
                                                            <td key={d} className="border-r border-b border-black p-1 text-center font-bold bg-gray-50/50" colSpan={11}>100%</td>
                                                        ))}
                                                    </tr>
                                                    {/* Actual % Row */}
                                                    <tr>
                                                        <td className="border-r border-b border-black p-1 font-bold">Actual %</td>
                                                        {[1, 2, 3].map(d => (
                                                            <td key={d} className="border-r border-b border-black p-1 text-center font-bold text-black bg-yellow-300" colSpan={11}>
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
                                                    {isFirstRow && <td className="border-r border-b border-black p-2 text-center font-bold bg-gray-50/20 text-[13px]" rowSpan={totalRowsInCat}>{catIdx + 1}</td>}
                                                    {isFirstRow && <td className="border-r border-b border-black p-2 font-bold whitespace-pre-line text-[12px] align-top bg-gray-50/20" rowSpan={totalRowsInCat}>{cat.category}</td>}
                                                    <td className="border-r border-b border-black p-2 whitespace-pre-line text-[12px] font-medium" rowSpan={row.hasCT ? 2 : 1}>
                                                        {row.label}
                                                    </td>
                                                    <td className="border-r border-b border-black p-2 text-center font-bold text-[13px]">{row.hasCT ? "C/T" : (row.weight || "-")}</td>
                                                    {[1, 2, 3].map(d => {
                                                        const day = `day${d}`;
                                                        if (row.type === 'cycle_detailed') {
                                                            return (
                                                                <React.Fragment key={d}>
                                                                    {[...Array(10)].map((_, i) => {
                                                                        const val = gridData[`${row.id}_${day}_${row.hasCT ? 'ct' : 'score'}_${i}`] || "";
                                                                        return (
                                                                            <td key={i} className={`border-r border-b border-black p-0 h-10 min-w-[45px] ${row.hasCT ? 'bg-gray-50/30' : ''}`}>
                                                                                <div className="relative flex items-center justify-center min-w-[45px] h-full">
                                                                                    <span className="invisible whitespace-pre px-4 text-[12px] font-bold">{val || "00"}</span>
                                                                                    <input
                                                                                        className="absolute inset-0 w-full h-full text-center border-none outline-none focus:bg-blue-100/50 text-[12px] font-bold"
                                                                                        value={val}
                                                                                        onChange={(e) => handleGridChange(row.id, `${day}_${row.hasCT ? 'ct' : 'score'}_${i}`, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="border-r border-b border-black p-0 text-center font-bold bg-yellow-300 text-black min-w-[75px] text-[12px]">
                                                                        <div className="relative flex items-center justify-center min-w-[75px] h-full">
                                                                            <span className="invisible whitespace-pre px-4 text-[12px] font-bold">{gridData[`${row.id}_${day}_${row.hasCT ? 'ct_avg' : 'score_avg'}`] || "00"}</span>
                                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                                {gridData[`${row.id}_${day}_${row.hasCT ? 'ct_avg' : 'score_avg'}`] || ""}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </React.Fragment>
                                                            );
                                                        }
                                                        const val = gridData[`${row.id}_day`] || "";
                                                        return (
                                                            <td key={d} className="border-r border-b border-black p-0 h-10 text-center" colSpan={11}>
                                                                <div className="relative flex items-center justify-center min-w-[100px] h-full">
                                                                    <span className="invisible whitespace-pre px-4 text-[13px] font-bold">{gridData[`${row.id}_${day}`] || "00"}</span>
                                                                    <input
                                                                        className="absolute inset-0 w-full h-full text-center border-none outline-none focus:bg-blue-100/50 text-[13px] font-bold text-blue-800"
                                                                        value={gridData[`${row.id}_${day}`] || ""}
                                                                        onChange={(e) => handleGridChange(row.id, day, e.target.value)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    {isFirstRow && (
                                                        <td className="border-r border-b border-black p-0 align-top" rowSpan={totalRowsInCat}>
                                                            <div className="flex flex-col h-full text-[10px] bg-blue-50/20">
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold bg-white/50">Total Marks</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-[12px]">{cat.totalMark ? (catTotalMark * 3) : 100}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold bg-white/50">Actual Marks</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-blue-900 text-[12px]">{gridData[`${catId}_eval_total`] || ""}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold bg-white/50">{catId === 'cat4' ? 'Target (Excellent -100%)' : 'Target %'}</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-[12px]">{cat.target || "100%"}</div>
                                                                </div>
                                                                <div className="flex border-b border-black">
                                                                    <div className="w-1/2 border-r border-black p-2 font-bold">Actual %</div>
                                                                    <div className="w-1/2 p-2 text-center font-bold text-black text-[12px]">{gridData[`${catId}_eval_actual`] || ""}</div>
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
                                                                    {[...Array(10)].map((_, i) => {
                                                                        const val = gridData[`${row.id}_${day}_score_${i}`] || "";
                                                                        return (
                                                                            <td key={i} className="border-r border-b border-black p-0 h-10 min-w-[45px]">
                                                                                <div className="relative flex items-center justify-center min-w-[45px] h-full">
                                                                                    <span className="invisible whitespace-pre px-4 text-[12px] font-bold">{val || "00"}</span>
                                                                                    <input
                                                                                        className="absolute inset-0 w-full h-full text-center border-none outline-none font-bold focus:bg-blue-100/50 text-[12px]"
                                                                                        value={val}
                                                                                        onChange={(e) => handleGridChange(row.id, `${day}_score_${i}`, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="border-r border-b border-black p-0 text-center font-bold bg-yellow-300 text-black min-w-[75px] text-[12px]">
                                                                        <div className="relative flex items-center justify-center min-w-[75px] h-full">
                                                                            <span className="invisible whitespace-pre px-4 text-[12px] font-bold">{gridData[`${row.id}_${day}_score_avg`] || "00"}</span>
                                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                                {gridData[`${row.id}_${day}_score_avg`] || ""}
                                                                            </div>
                                                                        </div>
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
                                                            <td className="border-r border-b border-black p-1 font-bold" colSpan={1}>Total Mark:</td>
                                                            <td className="border-r border-b border-black p-1 text-center font-bold">{cat.totalMark || "-"}</td>
                                                            {[1, 2, 3].map(d => (
                                                                <td key={d} className="border-r border-b border-black p-1 text-center font-bold bg-yellow-300/80 text-black" colSpan={11}>
                                                                    {gridData[`${catId}_day${d}_total`] || ""}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                        <tr className="bg-gray-50/20">
                                                            <td className="border-r border-b border-black p-1 font-bold" colSpan={1}>{catId === 'cat4' ? 'Target (Excellent -100%)' : 'Target %'}</td>
                                                            <td className="border-r border-b border-black p-1 text-center font-bold">-</td>
                                                            {[1, 2, 3].map(d => (
                                                                <td key={d} className="border-r border-b border-black p-1 text-center font-bold" colSpan={11}>{cat.target || "100%"}</td>
                                                            ))}
                                                        </tr>
                                                        <tr>
                                                            <td className="border-r border-b border-black p-1 font-bold" colSpan={1}>Actual %</td>
                                                            <td className="border-r border-b border-black p-1 text-center font-bold">-</td>
                                                            {[1, 2, 3].map(d => {
                                                                const val = gridData[`${catId}_day${d}_actual`] || "";
                                                                return (
                                                                    <td key={d} className="border-r border-b border-black p-1 text-center font-bold bg-yellow-300 text-black" colSpan={11}>
                                                                        <div className="relative flex items-center justify-center min-w-[100px] h-full">
                                                                            <span className="invisible whitespace-pre px-4 text-[13px] font-bold">{val || "00%"}</span>
                                                                            <div className="absolute inset-0 flex items-center justify-center">{val}</div>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    </React.Fragment>
                                                )}
                                            </React.Fragment>
                                        );
                                    });
                                })}
                                {/* Attendance Row */}
                                <tr>
                                    <td className="border-r border-b border-black p-2 text-center font-bold text-[13px]" rowSpan={5}>6</td>
                                    <td className="border-r border-b border-black p-2 font-bold uppercase whitespace-pre-line text-[12px] align-top" rowSpan={5}>ATTENDANCE</td>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Total no. of Monitoring day's :</td>
                                    <td className="border-r border-b border-black p-2 text-center font-bold">3</td>
                                    <td className="border-b border-black p-4 align-top bg-white" colSpan={34} rowSpan={5}>
                                        <div className="flex justify-evenly items-center h-full w-full">
                                            <div className="border border-black w-[350px]">
                                                <p className="text-center font-bold border-b border-black p-1 text-[11px]">Evaluation Criteria: Cycle time</p>
                                                <table className="w-full text-[11px]">
                                                    <tbody>
                                                        <tr><td className="border-r border-b border-black text-center font-bold w-8">0</td><td className="border-b border-black px-2">1% -30% of standard time</td></tr>
                                                        <tr><td className="border-r border-b border-black text-center font-bold">1</td><td className="border-b border-black px-2">31%-50% of standard time</td></tr>
                                                        <tr><td className="border-r border-black text-center font-bold">2</td><td className="px-2">51%-100% of standard time</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="border border-black w-[450px]">
                                                <p className="text-center font-bold border-b border-black p-1 text-[11px]">Evaluation Criteria: Quality / System, Discipline ,5S & Safety</p>
                                                <table className="w-full text-[11px]">
                                                    <tbody>
                                                        <tr><td className="border-r border-b border-black text-center font-bold w-8">0</td><td className="border-b border-black px-2">Not known/ Not adhere the rule</td></tr>
                                                        <tr><td className="border-r border-b border-black text-center font-bold">1</td><td className="border-b border-black px-2">Partially known / Partially adhere the rule</td></tr>
                                                        <tr><td className="border-r border-black text-center font-bold">2</td><td className="px-2">Known / Adhere the rule</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Operator Present day's</td>
                                    <td className="border-r border-b border-black p-0">
                                        <input
                                            className="w-full h-full text-center border-none outline-none font-bold text-[13px]"
                                            value={gridData[`attendPresent_day1`] || ""}
                                            onChange={(e) => handleGridChange('attendPresent', 'day1', e.target.value)}
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Target %</td>
                                    <td className="border-r border-b border-black p-2 text-center font-bold">100%</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px]">Actual %</td>
                                    <td className="border-r border-b border-black p-2 text-center font-bold text-black bg-yellow-300">
                                        {gridData['attendance_total_score'] || "100%"}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-black p-2 font-bold text-[12px] uppercase">GAP OBSERVED</td>
                                    <td className="border-r border-b border-black p-0">
                                        <input
                                            className="w-full h-full text-center border-none outline-none font-bold text-[13px]"
                                            value={gridData[`attendGap`] || "0"}
                                            onChange={(e) => handleGridChange('attendGap', '', e.target.value)}
                                        />
                                    </td>
                                </tr>
                                {/* Bottom Layout integrated into main table */}
                                <tr>
                                    <td className="border-r border-b border-black p-0 bg-white" colSpan={38}>
                                        <div className="h-6 w-full"></div>
                                        {/* Overall Score Assessment Table */}
                                        <div className="flex justify-between items-start w-full pr-8">
                                            <div className="border-y border-r border-black text-[12px] w-[65%] flex-none">
                                                <table className="w-full border-collapse text-center">
                                                    <thead>
                                                        <tr className="bg-gray-100 uppercase">
                                                            <th className="border-r border-b border-black p-2 text-left min-w-[200px]" rowSpan={2}>Parameters</th>
                                                            <th className="border-r border-b border-black p-2 min-w-[120px]" rowSpan={2}>Total Weightage</th>
                                                            <th className="border-r border-b border-black p-1">Poor**</th>
                                                            <th className="border-r border-b border-black p-1">Average</th>
                                                            <th className="border-r border-b border-black p-1">V Good</th>
                                                            <th className="border-r border-b border-black p-1">Excellent</th>
                                                            <th className="border-r border-b border-black p-2 min-w-[150px]" rowSpan={2}>Avg. Score (individual) in %</th>
                                                            <th className="border-r border-b border-black p-2 min-w-[150px]" rowSpan={2}>Score Achieved w.r.t weightage</th>
                                                        </tr>
                                                        <tr className="bg-gray-100 uppercase">
                                                            <th className="border-r border-b border-black p-1" colSpan={4}>% range</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[
                                                            { label: "10 Cycle Check", weight: 0.4, id: "score1", ranges: ["70-80", "81-90", "91-95", "96-100"] },
                                                            { label: "Quality / System", weight: 0.2, id: "score2", ranges: ["70-80", "81-90", "91-95", "96-100"] },
                                                            { label: "Non defective products Produced", weight: 0.1, id: "score3", ranges: ["80-90", "91-95", "96-99", "100"] },
                                                            { label: "Discipline", weight: 0.1, id: "score4", ranges: ["0-70", "71-80", "81-90", "91-100"] },
                                                            { label: "Safety", weight: 0.1, id: "score5", ranges: ["90-95", "96-97", "98-99", "100"] },
                                                            { label: "Attendance", weight: 0.1, id: "score6", ranges: ["50-75", "76-85", "86-90", "91-100"] },
                                                        ].map((row, idx) => (
                                                            <tr key={idx} className="h-10">
                                                                <td className="border-r border-b border-black p-2 text-left font-bold bg-gray-50 text-[13px]">{row.label}</td>
                                                                <td className="border-r border-b border-black p-2 font-bold text-[13px]">{row.weight}</td>
                                                                {row.ranges.map((r, i) => (
                                                                    <td key={i} className="border-r border-b border-black p-1 bg-gray-50/20">{r}</td>
                                                                ))}
                                                                <td className="border-r border-b border-black p-0">
                                                                    <input
                                                                        disabled={true}
                                                                        className="w-full h-full text-center border-none outline-none font-bold text-black bg-yellow-300 text-[13px]"
                                                                        value={gridData[`summary_avg_${row.id}`] || ""}
                                                                    />
                                                                </td>
                                                                <td className="border-r border-b border-black p-0">
                                                                    <input
                                                                        disabled={true}
                                                                        className="w-full h-full text-center border-none outline-none font-bold text-black bg-yellow-300 text-[13px]"
                                                                        value={gridData[`summary_weight_${row.id}`] || ""}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        <tr className="h-12 text-[12px]">
                                                            <td className="border-r border-b border-black p-2 font-bold text-left bg-gray-100" colSpan={1}>Total</td>
                                                            <td className="border-r border-b border-black p-2 font-bold uppercase bg-gray-100 text-[13px]">1</td>
                                                            <td className="border-r border-b border-black p-2 text-left italic text-[11px] bg-gray-50 leading-tight" colSpan={4}>** Poor criteria is minimum passing marks for associates.</td>
                                                            <td className="border-r border-b border-black p-2 font-bold bg-gray-100 uppercase">100%</td>
                                                            <td className="border-r border-b border-black p-0">
                                                                <input
                                                                    disabled={true}
                                                                    className="w-full h-full text-center border-none outline-none font-bold bg-yellow-300 text-black text-[14px]"
                                                                    value={gridData[`summary_total_score`] || ""}
                                                                />
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Signatures and Remarks Section */}
                                            <div className="w-[32%] border border-black p-4 flex flex-col justify-between text-[11px] uppercase font-bold bg-white mr-4">
                                                <div className="flex justify-between h-[150px]">
                                                    {/* Checked By */}
                                                    <div className="flex flex-col justify-between items-center text-center">
                                                        <span className="font-bold whitespace-nowrap">Checked By:-</span>
                                                        <div className="flex-1 flex flex-col justify-end w-full pb-1">
                                                            <input
                                                                className="w-full border-b border-black text-center outline-none uppercase font-bold text-black bg-transparent py-1 text-[13px]"
                                                                value={footerData.checkedByName || ""}
                                                                onChange={(e) => handleFooterChange('checkedByName', e.target.value)}
                                                                disabled={readOnly || isLocked}
                                                            />
                                                        </div>
                                                        <span className="font-normal text-[10px] text-gray-500">(Process In charge)</span>
                                                    </div>

                                                    {/* Verified By */}
                                                    <div className="flex flex-col justify-between items-center text-center">
                                                        <span className="font-bold whitespace-nowrap">Verified By:-</span>
                                                        <div className="w-full flex flex-col items-center justify-end flex-1 pb-1 gap-2">
                                                            {canVerify && !isLocked ? (
                                                                <div className="flex gap-1 w-full justify-center">
                                                                    {!footerData.verifiedByName ? (
                                                                        <>
                                                                            <Button size="sm" variant="outline" onClick={() => handleSignature('verifiedByName', 'approve')} className="h-7 text-[9px] bg-green-50 text-green-700 px-2">Approve</Button>
                                                                            <Button size="sm" variant="outline" onClick={() => handleSignature('verifiedByName', 'reject')} className="h-7 text-[9px] bg-red-50 text-red-700 px-2">Reject</Button>
                                                                        </>
                                                                    ) : (
                                                                        (authUser?.isAdmin || footerData.verifiedByName?.includes(authUser?.fullName || authUser?.name)) && (
                                                                            <Button size="sm" variant="ghost" onClick={() => handleClearSignature('verifiedByName')} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"><Trash2 size={12} /></Button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            <input
                                                                className={`w-full border-b border-black text-center outline-none uppercase font-bold text-[13px] bg-transparent py-1 pointer-events-none ${footerData.verifiedByName?.includes('Rejected') ? 'text-red-600' : 'text-black'}`}
                                                                value={footerData.verifiedByName || ""}
                                                                readOnly
                                                            />
                                                        </div>
                                                        <span className="font-normal text-[10px] text-gray-500">(Area In charge)</span>
                                                    </div>

                                                    {/* Approved By */}
                                                    <div className="flex flex-col justify-center items-center text-center pt-8">
                                                        <span className="font-bold whitespace-nowrap">Approved By:</span>
                                                        <div className="w-full flex flex-col items-center gap-2 mt-4">
                                                            {canApprove && !isLocked ? (
                                                                <div className="flex gap-1 w-full justify-center">
                                                                    {!footerData.approvedByName ? (
                                                                        <>
                                                                            <Button size="sm" variant="outline" onClick={() => handleSignature('approvedByName', 'approve')} className="h-7 text-[9px] bg-green-50 text-green-700 px-2">Approve</Button>
                                                                            <Button size="sm" variant="outline" onClick={() => handleSignature('approvedByName', 'reject')} className="h-7 text-[9px] bg-red-50 text-red-700 px-2">Reject</Button>
                                                                        </>
                                                                    ) : (
                                                                        (authUser?.isAdmin || footerData.approvedByName?.includes(authUser?.fullName || authUser?.name)) && (
                                                                            <Button size="sm" variant="ghost" onClick={() => handleClearSignature('approvedByName')} className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"><Trash2 size={12} /></Button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                            <input
                                                                className={`w-full border-b border-black text-center outline-none uppercase font-bold text-[13px] bg-transparent py-1 pointer-events-none ${footerData.approvedByName?.includes('Rejected') ? 'text-red-600' : 'text-black'}`}
                                                                value={footerData.approvedByName || ""}
                                                                readOnly
                                                            />
                                                        </div>
                                                        <span className="font-normal text-[10px] text-gray-500 mt-1">(Dept. Head)</span>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 text-[10px] italic px-2 pb-2">* Procedure refer to product quality: if the defect capturing is less than 100% by employee, need to re-monitor for next 3 days</div>

                                        {/* Meta Info Footer */}
                                        <div className="mt-2 flex justify-between text-[12px] font-bold border-t border-black pt-2 pb-2 px-4">
                                            <div className="w-1/4">{revisionInfo.docNo}</div>
                                            <div className="w-1/4 text-center">Rev No {revisionInfo.revNo}</div>
                                            <div className="w-1/4 text-center">Issue Date: {revisionInfo.revDate}</div>
                                            <div className="w-1/4 text-right">PG: 1 OF 1</div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
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
