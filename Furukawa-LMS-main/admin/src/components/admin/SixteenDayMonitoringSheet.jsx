import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import useCountdown from '@/hooks/useCountdown';
import useRevisionInfo from '@/hooks/useRevisionInfo';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Printer,
    Edit2,
    History,
    Save,
    Download,
    Loader2,
    Send,
    Mail,
    CheckCircle2,
    CheckCircle2 as CheckIcon,
    XCircle,
    XCircle as RejectIcon,
    ShieldCheck,
    Trash2,
    AlertTriangle,
    Calendar as CalendarIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
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
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";

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
            { id: "row4_1", label: "Attends the daily meeting with good level of listening and understanding .", weight: 2 },
            { id: "row4_2", label: "Inspector should aware about daily machine check point and do 5S on their station on daily basis before production start.", weight: 2 },
            { id: "row4_3", label: "Whenever if any defect or work related problem is their , he immediately contacts with line leader or his senior person with doing any delay or sitting idle.", weight: 2 },
            { id: "row4_4", label: "During any break operator clear the WIP Assy. Part from his / her station and move to next process, leave work station after completing the job.\nIs he/she adhare working hours and break timings?", weight: 2 }
        ],
        totalMark: 8,
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

const DEFAULT_SCORE_RANGES = [
    { id: 'score1', catId: 'cat1', label: '10 Cycle Check', weight: 0.4, poor: '70-80', avg: '81-90', good: '91-95', excel: '96-100' },
    { id: 'score2', catId: 'cat2', label: 'Quality / System', weight: 0.2, poor: '70-80', avg: '81-90', good: '91-95', excel: '96-100' },
    { id: 'score3', catId: 'cat3', label: 'Defect Captured', weight: 0.1, poor: '40-50', avg: '51-65', good: '66-80', excel: '100' },
    { id: 'score4', catId: 'cat4', label: 'Discipline', weight: 0.1, poor: '0-70', avg: '71-80', good: '81-90', excel: '91-100' },
    { id: 'score5', catId: 'cat5', label: 'Safety', weight: 0.1, poor: '30-35', avg: '36-47', good: '48-55', excel: '100' },
    { id: 'score6', catId: null, label: 'Attendance', weight: 0.1, poor: '50-75', avg: '76-85', good: '86-95', excel: '96-100' },
];

const DEFAULT_EVALUATION_LEGENDS = {
    cycleTime: [
        { score: 0, label: 'Is > 20% of standard time' },
        { score: 1, label: '11% - 20% of standard time' },
        { score: 2, label: 'Fit & above of standard time' }
    ],
    otherCriteria: [
        { score: 0, label: 'Not known / Not adhere the rule' },
        { score: 1, label: 'Partially known / Partially adhere the rule' },
        { score: 2, label: 'Known / completely adhere the rule' }
    ]
};

const normalizeConfig = (raw) => {
    if (Array.isArray(raw)) {
        return {
            categories: raw,
            scoreRanges: DEFAULT_SCORE_RANGES,
            evaluationLegends: DEFAULT_EVALUATION_LEGENDS
        };
    }
    if (raw && typeof raw === 'object') {
        return {
            categories: raw.categories || DEFAULT_MONITORING_CONFIG_16,
            scoreRanges: raw.scoreRanges || DEFAULT_SCORE_RANGES,
            evaluationLegends: raw.evaluationLegends || DEFAULT_EVALUATION_LEGENDS
        };
    }
    return {
        categories: DEFAULT_MONITORING_CONFIG_16,
        scoreRanges: DEFAULT_SCORE_RANGES,
        evaluationLegends: DEFAULT_EVALUATION_LEGENDS
    };
};

const SixteenDayMonitoringSheet = ({
    studentId,
    studentName = "",
    employeeCode = "",
    departmentName = "",
    readOnly = false,
    departmentId,
    sectionId = 0,
    sectionName = "",
    canEditConfig = false,
    initialForceNewAttempt = false,
    onAfterSave = null,
    feedbackRef = null,
    studentStatus = "PRESENT",
}) => {
    const liveRevisionInfo = useRevisionInfo("sixteen-day-monitoring", { docNo: "FRM-HR-004", revNo: "07", revDate: "11.12.21" }, { departmentId, sectionId: sectionId || null });
    const [savedRevisionInfo, setSavedRevisionInfo] = useState(null);
    // A saved attempt keeps whatever docNo/revNo/revDate was frozen into it at
    // creation; only a brand-new (not-yet-created) attempt shows the live value.
    const revisionInfo = savedRevisionInfo?.docNo ? savedRevisionInfo : liveRevisionInfo;
    const combinedDept = (name, section) => [name, section].filter(Boolean).join(" / ");

    const [headerInfo, setHeaderInfo] = useState({
        employeeName: studentName || "",
        employeeCode: employeeCode || "",
        processName: "",
        dept: combinedDept(departmentName, sectionName),
        handoverDate: "",
        trgResult: "",
        workingWith: "",
        lineLeaderName: "",
        checkedBy: "",
        verifiedBy: "",
        approvedBy: "",
        verifiedByEduCell: "",
        status: "Draft",
        startDate: "",
        handoverApprovedAt: null,
        eligibleAt: null,
        isEligible: true,
    });

    const authUser = useSelector(state => state.auth.user);
    const loggedInName = authUser?.fullName || authUser?.name || authUser?.userName || "";
    const canVerify = authUser?.isAdmin || authUser?.customRole?.permissions?.includes('sixteen_day:verify');
    const canApprove = authUser?.isAdmin || authUser?.customRole?.permissions?.includes('sixteen_day:approve');
    const canVerifyEduCell = authUser?.isAdmin || authUser?.customRole?.permissions?.includes('sixteen_day:verify_education');
    const canEditSubmitted = authUser?.isAdmin || authUser?.customRole?.permissions?.includes('sixteen_day:edit_submitted');

    const [gridData, setGridData] = useState({});
    const [originalGridData, setOriginalGridData] = useState({});
    const [originalHeaderInfo, setOriginalHeaderInfo] = useState({});
    const [footerData, setFooterData] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState({
        categories: DEFAULT_MONITORING_CONFIG_16,
        scoreRanges: DEFAULT_SCORE_RANGES,
        evaluationLegends: DEFAULT_EVALUATION_LEGENDS
    });
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [configJson, setConfigJson] = useState('');
    const [lineLeaderOptions, setLineLeaderOptions] = useState([]);
    const [lineNamePart, setLineNamePart] = useState("");
    const [configRemark, setConfigRemark] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);

    // Admin Remark Dialog States
    const [isAdminRemarkDialogOpen, setIsAdminRemarkDialogOpen] = useState(false);
    const [adminRemarkText, setAdminRemarkText] = useState('');
    const [pendingSaveParams, setPendingSaveParams] = useState(null);

    // Attempt History (Versioning)
    const [historyAttempts, setHistoryAttempts] = useState([]);
    const [selectedAttemptId, setSelectedAttemptId] = useState("");
    const [isForceNewAttempt, setIsForceNewAttempt] = useState(false);
    const [userStatus, setUserStatus] = useState(studentStatus || "PRESENT");

    useEffect(() => {
        setUserStatus(studentStatus || "PRESENT");
    }, [studentStatus]);

    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const isSheetSaved = !!selectedAttemptId && !isForceNewAttempt;
    const isLeftUser = userStatus === 'LEFT';

    const isLocked = (headerInfo.status === 'Submitted' &&
        !authUser?.isAdmin &&
        !authUser?.isTrainer &&
        !canVerify &&
        !canApprove &&
        !canVerifyEduCell &&
        !canEditSubmitted &&
        !authUser?.customRole?.permissions?.includes('sixteen_day:manage'));

    // Not yet past midnight (IST) of the day after Handover approval, for the very first attempt.
    // The countdown itself is shown to everyone; only the edit/save lock is Admin/Trainer-overridable.
    const notYetEligible = !isSheetSaved &&
        !isForceNewAttempt &&
        headerInfo.isEligible === false;
    const canOverrideEligibility = isAdmin || !!authUser?.isTrainer;
    const { isExpired: eligibilityExpired, formatted: eligibilityCountdown } = useCountdown(
        notYetEligible ? headerInfo.eligibleAt : null
    );
    const eligibilityStillWaiting = notYetEligible && !eligibilityExpired;
    const eligibilityStillLocked = eligibilityStillWaiting && !canOverrideEligibility;

    const isCellLocked = (key, type = 'grid') => {
        if (isLeftUser) return key !== 'comment';
        if (readOnly) return true;
        if (isLocked) return true;
        if (eligibilityStillLocked) return true;
        if (isAdmin || canEditSubmitted) return false;
        if (!isSheetSaved) return false;

        if (type === 'grid') {
            const val = originalGridData[key];
            return val !== undefined && val !== null && val.toString().trim() !== "";
        } else if (type === 'header') {
            const val = originalHeaderInfo[key];
            return val !== undefined && val !== null && val.toString().trim() !== "";
        }
        return false;
    };

    const isDayBlurred = (dayNum) => {
        if (!isLeftUser) return false;
        const val = gridData[`attendance_date_${dayNum}`];
        return !val || !val.toString().trim();
    };
    const dayBlurClass = (dayNum) => isDayBlurred(dayNum) ? "filter blur-[3px] opacity-40 pointer-events-none select-none" : "";
    const dayPrefixBlurClass = (dayPrefix) => dayBlurClass(parseInt(dayPrefix.replace('d', ''), 10));
    const dayKeyBlurClass = (dayKey) => dayBlurClass(parseInt(dayKey.replace('day_', ''), 10));

    const didAdminChangeSavedValues = () => {
        // Helper: returns true if a gridData key is auto-computed by the useEffect
        // and should NOT trigger the admin edit verification prompt.
        const isComputedGridKey = (key) => {
            // Category-level totals and actual percentages (e.g., cat1_d1_total, cat1_eval_actual)
            if (key.startsWith('cat')) return true;
            // Summary table scores (e.g., summary_avg_score1, summary_weight_score1, summary_total_score)
            if (key.startsWith('summary_')) return true;
            // Row/cycle averages (e.g., row1_1_d1_avg, row1_2_d1_score_avg)
            if (key.endsWith('_avg')) return true;
            // Achievement percentages (e.g., row1_2_d1_achievement_0, row1_2_day_4_achievement)
            if (key.includes('_achievement')) return true;
            // Evaluation column values (e.g., row1_1_eval, row1_2_eval_target)
            if (key.includes('_eval')) return true;
            // Computed attendance average
            if (key === 'attendance_total_score') return true;
            return false;
        };

        for (const key of Object.keys(originalGridData)) {
            // Skip computed/derived cells — their values change automatically
            // when new day data is added, which is not an "admin edit"
            if (isComputedGridKey(key)) continue;

            const originalVal = originalGridData[key];
            if (originalVal !== undefined && originalVal !== null && originalVal.toString().trim() !== "") {
                const currentVal = gridData[key];
                if (String(originalVal).trim() !== String(currentVal || "").trim()) {
                    return true;
                }
            }
        }

        // Only check user-editable header fields.
        // Excludes: status, checkedBy, verifiedBy, approvedBy, verifiedByEduCell,
        // startDate, attemptNumber, employeeName, employeeCode, dept — these are
        // system-managed or set by workflow buttons, not direct text edits.
        const EDITABLE_HEADER_FIELDS = ['processName', 'handoverDate', 'trgResult', 'workingWith', 'lineLeaderName'];
        for (const key of EDITABLE_HEADER_FIELDS) {
            const originalVal = originalHeaderInfo[key];
            if (originalVal !== undefined && originalVal !== null && originalVal.toString().trim() !== "") {
                const currentVal = headerInfo[key];
                if (String(originalVal).trim() !== String(currentVal || "").trim()) {
                    return true;
                }
            }
        }

        if (feedbackRef?.current?.didAdminChangeSavedValues) {
            if (feedbackRef.current.didAdminChangeSavedValues()) {
                return true;
            }
        }
        return false;
    };

    const [logAction] = useLogActionMutation();

    useEffect(() => {
        const loadInitialData = async () => {
            if (!studentId) {
                setHeaderInfo({
                    employeeName: "",
                    employeeCode: "",
                    processName: "",
                    dept: combinedDept(departmentName, sectionName),
                    handoverDate: "",
                    trgResult: "",
                    workingWith: "",
                    lineLeaderName: "",
                    checkedBy: "",
                    verifiedBy: "",
                    approvedBy: "",
                    verifiedByEduCell: "",
                    status: "Draft",
                    attemptNumber: 1
                });
                setGridData({});
                setOriginalGridData({});
                setOriginalHeaderInfo({});
                setFooterData({});
                setConfig({
                    categories: DEFAULT_MONITORING_CONFIG_16,
                    scoreRanges: DEFAULT_SCORE_RANGES,
                    evaluationLegends: DEFAULT_EVALUATION_LEGENDS
                });
                return;
            }

            setGridData({});
            setOriginalGridData({});
            setOriginalHeaderInfo({});
            setFooterData({});
            setLoading(true);
            try {
                let progressData = {};
                try {
                    const progressRes = await axiosInstance.get(`/api/progress/three-day-monitoring/${studentId}`);
                    progressData = progressRes?.data?.data || {};
                    setLineLeaderOptions(progressData.lineLeaderOptions || []);
                    setLineNamePart(progressData.lineName || "");
                } catch (err) { console.error(err); }
                const response = await axiosInstance.get(`/api/sixteen-day-monitoring/${studentId}`);
                if (response.data.success && response.data.data?.userStatus) {
                    setUserStatus(response.data.data.userStatus);
                }
                if (response.data.success && response.data.data && !response.data.data.isNew) {
                    const record = response.data.data;
                    const loadedHeader = {
                        employeeName: record.employeeName || studentName || "",
                        employeeCode: record.employeeCode || employeeCode || "",
                        processName: record.processName || progressData.processName || "",
                        dept: record.dept || combinedDept(departmentName, sectionName),
                        handoverDate: record.handoverDate || "",
                        trgResult: record.trgResult || "",
                        workingWith: record.workingWith || "",
                        lineLeaderName: record.lineLeaderName || "",
                        checkedBy: record.checkedBy || "",
                        verifiedBy: record.verifiedBy || "",
                        approvedBy: record.approvedBy || "",
                        verifiedByEduCell: record.verifiedByEduCell || "",
                        status: record.status || "Draft",
                        attemptNumber: record.attemptNumber || 1,
                        startDate: record.startDate || "",
                        handoverApprovedAt: record.handoverApprovedAt || null,
                        eligibleAt: record.eligibleAt || null,
                        isEligible: record.isEligible !== false,
                    };
                    if (initialForceNewAttempt) {
                        setHeaderInfo({
                            ...loadedHeader,
                            checkedBy: "",
                            verifiedBy: "",
                            approvedBy: "",
                            verifiedByEduCell: "",
                            status: "Draft",
                            attemptNumber: (record.attemptNumber || 1) + 1,
                            startDate: "",
                        });
                        setGridData({});
                        setOriginalGridData({});
                        setOriginalHeaderInfo({});
                        setSelectedAttemptId("");
                        setIsForceNewAttempt(true);
                        setSavedRevisionInfo(null);
                    } else {
                        setHeaderInfo(loadedHeader);
                        setGridData(record.gridData || {});
                        setOriginalGridData(record.gridData || {});
                        setOriginalHeaderInfo(loadedHeader);
                        setSelectedAttemptId(record.id);
                        setIsForceNewAttempt(false);
                        setSavedRevisionInfo({ docNo: record.docNo, revNo: record.revNo, revDate: record.revDate });
                    }
                } else {
                    const header = response.data.data?.headerInfo || {};
                    const newHeader = {
                        employeeName: header.employeeName || studentName || "",
                        employeeCode: header.employeeCode || employeeCode || "",
                        processName: progressData.processName || "",
                        dept: header.dept || combinedDept(departmentName, sectionName),
                        handoverDate: header.handoverDate || "",
                        trgResult: header.trgResult || "",
                        workingWith: "",
                        lineLeaderName: "",
                        checkedBy: "",
                        verifiedBy: "",
                        approvedBy: "",
                        verifiedByEduCell: "",
                        status: "Draft",
                        attemptNumber: 1,
                        startDate: "",
                        handoverApprovedAt: response.data.data?.handoverApprovedAt || null,
                        eligibleAt: response.data.data?.eligibleAt || null,
                        isEligible: response.data.data?.isEligible !== false,
                    };
                    setHeaderInfo(newHeader);
                    setGridData({});
                    setOriginalGridData({});
                    setOriginalHeaderInfo(newHeader);
                    setSelectedAttemptId("");
                    setIsForceNewAttempt(false);
                    setSavedRevisionInfo(null);
                }

                logAction({
                    action: 'VIEW_SIXTEEN_DAY_MONITORING_SHEET',
                    details: { studentId, employeeName: studentName || employeeCode }
                }).unwrap().catch((err) => console.error("Failed to log sheet view:", err));
            } catch (error) {
                console.error("Error fetching monitoring data:", error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId, studentName, employeeCode, departmentName, sectionName, initialForceNewAttempt]);

    const fetchHistoryAttempts = async () => {
        if (!studentId) return;
        try {
            const res = await axiosInstance.get(`/api/sixteen-day-monitoring/${studentId}/history`);
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
                setOriginalGridData({});
                setOriginalHeaderInfo({});
                setHeaderInfo(prev => ({
                    ...prev,
                    status: "Draft",
                    checkedBy: "",
                    verifiedBy: "",
                    approvedBy: "",
                    verifiedByEduCell: "",
                    attemptNumber: (historyAttempts[0]?.attemptNumber || 0) + 1
                }));
                setSelectedAttemptId("");
                setSavedRevisionInfo(null);
                toast.info(`Starting new attempt (#${(historyAttempts[0]?.attemptNumber || 0) + 1})`);
            }
        };
        window.addEventListener('START_NEW_MONITORING_ATTEMPT', handleStartNew);
        return () => window.removeEventListener('START_NEW_MONITORING_ATTEMPT', handleStartNew);
    }, [studentId, historyAttempts]);

    const handleAttemptChange = async (attemptId) => {
        if (!attemptId) return;
        setSelectedAttemptId(attemptId);
        setIsForceNewAttempt(false);
        try {
            setLoading(true);
            const res = await axiosInstance.get(`/api/sixteen-day-monitoring/${studentId}?recordId=${attemptId}`);
            if (res.data.success) {
                const record = res.data.data;
                if (record.userStatus) {
                    setUserStatus(record.userStatus);
                }
                const loadedHeader = {
                    employeeName: record.employeeName || "",
                    employeeCode: record.employeeCode || "",
                    processName: record.processName || "",
                    dept: record.dept || "",
                    handoverDate: record.handoverDate || "",
                    trgResult: record.trgResult || "",
                    workingWith: record.workingWith || "",
                    lineLeaderName: record.lineLeaderName || "",
                    checkedBy: record.checkedBy || "",
                    verifiedBy: record.verifiedBy || "",
                    approvedBy: record.approvedBy || "",
                    verifiedByEduCell: record.verifiedByEduCell || "",
                    status: record.status || "Draft",
                    attemptNumber: record.attemptNumber || 1,
                    startDate: record.startDate || "",
                };
                setHeaderInfo(loadedHeader);
                setGridData(record.gridData || {});
                setOriginalGridData(record.gridData || {});
                setOriginalHeaderInfo(loadedHeader);
            }
        } catch (err) {
            toast.error("Failed to load attempt data");
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        if (!departmentId || departmentId === 'undefined') return;
        try {
            const response = await axiosInstance.get(`/api/sixteen-day-monitoring/config/${departmentId}?sectionId=${sectionId || 0}`);
            if (response.data.success && response.data.data.config) {
                setConfig(normalizeConfig(response.data.data.config));
            }
        } catch (error) {
            console.error("Error fetching config:", error);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const newConfig = normalizeConfig(JSON.parse(configJson));
            await axiosInstance.post(`/api/sixteen-day-monitoring/config/save`, {
                departmentId,
                sectionId: sectionId || 0,
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
            const response = await axiosInstance.get(`/api/sixteen-day-monitoring/history/${departmentId}?sectionId=${sectionId || 0}`);
            if (response.data.success) {
                setHistory(response.data.data);
                setShowHistory(true);
                logAction({
                    action: 'VIEW_SIXTEEN_DAY_MONITORING_LAYOUT_HISTORY',
                    details: { departmentId, sectionId: sectionId || 0 }
                }).unwrap().catch((err) => console.error("Failed to log layout history view:", err));
            }
        } catch (error) {
            toast.error("Failed to fetch history");
        }
    };

    const categories = config?.categories || DEFAULT_MONITORING_CONFIG_16;
    const scoreRanges = config?.scoreRanges || DEFAULT_SCORE_RANGES;
    const evaluationLegends = config?.evaluationLegends || DEFAULT_EVALUATION_LEGENDS;

    const isDay1Filled = () => {
        const attDateVal = gridData['attendance_date_1'];
        if (attDateVal && attDateVal.toString().trim()) return true;
        for (const cat of categories) {
            for (const row of cat.rows) {
                if (gridData[`${row.id}_day_1`]?.toString().trim()) return true;
            }
        }
        return false;
    };

    const isDay16Filled = () => {
        if (!studentId) return false;

        // Scan all categories and check if Day-16 inputs are filled
        for (const cat of categories) {
            for (const row of cat.rows) {
                if (row.type === 'cycle_detailed') {
                    const targetKey = `${row.id}_day_16_target`;
                    const actualKey = `${row.id}_day_16_actual`;
                    const scoreKey = `${row.id}_day_16_score`;

                    const targetVal = gridData[targetKey];
                    const actualVal = gridData[actualKey];
                    const scoreVal = gridData[scoreKey];

                    if (targetVal === undefined || targetVal === null || targetVal.toString().trim() === "") return false;
                    if (actualVal === undefined || actualVal === null || actualVal.toString().trim() === "") return false;
                    if (scoreVal === undefined || scoreVal === null || scoreVal.toString().trim() === "") return false;
                } else {
                    const isWeightNumeric = row.weight !== undefined && row.weight !== null && !isNaN(row.weight) && row.weight !== "-";
                    if (!isWeightNumeric) {
                        continue; // Skip optional/descriptive rows (like defects captured)
                    }
                    const key = `${row.id}_day_16`;
                    const val = gridData[key];
                    if (val === undefined || val === null || val.toString().trim() === "") return false;
                }
            }
        }

        // Scan Attendance for Day 16
        const attDateVal = gridData['attendance_date_16'];
        const attActualVal = gridData['attendance_actual_16'];
        if (attDateVal === undefined || attDateVal === null || attDateVal.toString().trim() === "") return false;
        if (attActualVal === undefined || attActualVal === null || attActualVal.toString().trim() === "") return false;

        return true;
    };

    const handleSave = async (finalStatus = null, isSubmit = false, adminRemark = null) => {
        if (!studentId) {
            toast.error("Student selection is required to save data");
            return;
        }

        const targetStatus = finalStatus || headerInfo.status || "Draft";

        // Intercept: admin or canEditSubmitted user editing a saved sheet must provide a remark if they modified already saved values
        if ((isAdmin || canEditSubmitted) && isSheetSaved && didAdminChangeSavedValues() && !adminRemark) {
            setPendingSaveParams({ finalStatus, isSubmit });
            setAdminRemarkText('');
            setIsAdminRemarkDialogOpen(true);
            return;
        }

        if (isSubmit && !isDay16Filled()) {
            toast.error("Day-16 performance column must be completely filled before submitting.");
            return;
        }

        try {
            setSaving(true);

            // Auto-capture startDate the first time Day-1 is filled
            const computedStartDate =
                !headerInfo.startDate && isDay1Filled()
                    ? (gridData['attendance_date_1'] || new Date().toISOString().split('T')[0])
                    : headerInfo.startDate;

            const computedCheckedBy = headerInfo.checkedBy || (isSubmit ? loggedInName : "");

            const payload = {
                ...headerInfo,
                checkedBy: computedCheckedBy,
                startDate: computedStartDate,
                gridData,
                status: targetStatus,
                isNewAttempt: isForceNewAttempt,
                recordId: selectedAttemptId,
                triggerEmail: isSubmit,
                adminRemark: adminRemark || undefined
            };

            const response = await axiosInstance.post(`/api/sixteen-day-monitoring/${studentId || 0}`, payload);
            if (response.data.success) {
                const finalHeader = {
                    ...headerInfo,
                    checkedBy: computedCheckedBy,
                    status: targetStatus,
                    startDate: computedStartDate
                };
                setHeaderInfo(finalHeader);
                setOriginalGridData(gridData);
                setOriginalHeaderInfo(finalHeader);
                setIsForceNewAttempt(false);
                fetchHistoryAttempts();
                toast.success(`Monitoring ${targetStatus === 'Submitted' ? 'Submitted' : 'Saved'} successfully`);

                if (onAfterSave) {
                    await onAfterSave(targetStatus);
                }
            }
        } catch (error) {
            console.error("Error saving data:", error);
            toast.error(error.response?.data?.message || "Failed to save data");
        } finally {
            setSaving(false);
            setPendingSaveParams(null);
            setAdminRemarkText('');
        }
    };

    const handleEmail = async () => {
        if (!isDay16Filled()) {
            toast.error("Day-16 performance column must be completely filled before sending the email report.");
            return;
        }

        try {
            setSendingEmail(true);
            const response = await axiosInstance.post(`/api/sixteen-day-monitoring/${studentId}/combined-email`);
            if (response.data.success) {
                toast.success("Combined monitoring report emailed successfully");
            }
        } catch (error) {
            console.error("Error sending email:", error);
            toast.error(error.response?.data?.message || "Failed to send email report");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleHeaderChange = (field, value) => {
        if (readOnly || isLocked || isCellLocked(field, 'header') || !studentId) return;
        setHeaderInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleGridChange = (rowId, colId, value) => {
        const cellKey = `${rowId}_${colId}`;
        if (readOnly || isLocked || isCellLocked(cellKey, 'grid') || !studentId) return;
        setGridData(prev => ({
            ...prev,
            [cellKey]: value
        }));
    };

    useEffect(() => {
        if (readOnly || isLeftUser || !studentId) return;

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

        categories.forEach(cat => {
            const catTotalMark = typeof cat.totalMark === 'number' ? cat.totalMark : parseFloat(cat.totalMark) || 0;

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
                                const ach = Number(((targetVal / actualVal) * 100).toFixed(2));
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

                        const targetAvg = Number((targetAvgTotal / 10).toFixed(2)) || "";
                        const actualAvg = Number((actualAvgTotal / 10).toFixed(2)) || "";
                        const achAvg = achCount > 0 ? Number((achievementSum / achCount).toFixed(2)) : 0;
                        const scoreAvg = Number((scoreSum / 10).toFixed(2)) || 0;


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
                        const rowAvg = Number((rowSum / 10).toFixed(2)) || 0;
                        updateKey(`${row.id}_${d}_avg`, rowAvg || "");
                        catDaySumAvg += rowAvg;
                    } else {
                        const rowVal = parseFloat(gridData[`${row.id}_${d}`]) || 0;
                        catDaySumAvg += rowVal;
                    }
                });

                if (cat.totalMark) {
                    const totalKey = `${cat.id}_${d}_total`;
                    const totalVal = catDaySumAvg > 0 ? catDaySumAvg.toString() : "";
                    if (newGridData[totalKey] !== totalVal) {
                        newGridData[totalKey] = totalVal;
                        hasChanges = true;
                    }

                    const actualKey = `${cat.id}_${d}_actual`;
                    if (catTotalMark > 0) {
                        const actualPerc = catDaySumAvg > 0 ? Number(((catDaySumAvg / catTotalMark) * 100).toFixed(2)) : 0;
                        const actualStr = actualPerc > 0 ? `${actualPerc}%` : "";
                        if (newGridData[actualKey] !== actualStr) {
                            newGridData[actualKey] = actualStr;
                            hasChanges = true;
                        }
                    }
                }
            });

            daysSummary.forEach(d => {
                let catDaySum = 0;
                cat.rows.forEach(row => {
                    if (row.type === 'cycle_detailed') {
                        const target = parseFloat(gridData[`${row.id}_${d}_target`]) || 0;
                        const actual = parseFloat(gridData[`${row.id}_${d}_actual`]) || 0;
                        const score = parseFloat(gridData[`${row.id}_${d}_score`]) || 0;

                        if (target > 0 && actual > 0) {
                            const ach = Number(((target / actual) * 100).toFixed(2));
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
                        const actualPerc = catDaySum > 0 ? Number(((catDaySum / catTotalMark) * 100).toFixed(2)) : 0;
                        const actualStr = actualPerc > 0 ? `${actualPerc}%` : "";
                        if (newGridData[actualKey] !== actualStr) {
                            newGridData[actualKey] = actualStr;
                            hasChanges = true;
                        }
                    }
                }
            });

            if (cat.id === 'cat3') {
                [...daysDetailed, ...daysSummary].forEach(d => {
                    const actualDefects = parseFloat(gridData[`row3_1_${d}`]) || 0;
                    const capturedDefects = parseFloat(gridData[`row3_2_${d}`]) || 0;
                    const actualKey = `${cat.id}_${d}_actual`;
                    if (actualDefects > 0) {
                        const perc = Number(((capturedDefects / actualDefects) * 100).toFixed(2));
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

        categories.forEach(cat => {
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
                        const evalAvg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
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
                    const evalAvg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
                    const evalKey = `${row.id}_eval`;
                    const valStr = evalAvg > 0 ? evalAvg.toString() : "";
                    if (newGridData[evalKey] !== valStr) {
                        newGridData[evalKey] = valStr;
                        hasChanges = true;
                    }
                    if (row.weight && typeof row.weight === 'number') catEvalSum += evalAvg;
                }
            });

            const evalActualKey = `${cat.id}_eval_actual`;
            let dailyActualSum = 0;
            [...daysDetailed, ...daysSummary].forEach(d => {
                const dayActualStr = newGridData[`${cat.id}_${d}_actual`] || "0%";
                const dayActualVal = parseInt(dayActualStr) || 0;
                dailyActualSum += dayActualVal;
            });
            const evalActualPerc = Number((dailyActualSum / 16).toFixed(2));
            const evalActualStr = evalActualPerc > 0 ? `${evalActualPerc}%` : "";
            updateKey(evalActualKey, evalActualStr);

            if (cat.totalMark) {
                const evalTotalKey = `${cat.id}_eval_total`;
                const evalTotalVal = catEvalSum > 0 ? catEvalSum.toString() : "";
                if (newGridData[evalTotalKey] !== evalTotalVal) {
                    newGridData[evalTotalKey] = evalTotalVal;
                    hasChanges = true;
                }
            }
        });

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
        attendanceAvgPerc = attCount > 0 ? Number((attSum / attCount).toFixed(2)) : 0;
        updateKey('attendance_total_score', attendanceAvgPerc > 0 ? `${attendanceAvgPerc}%` : "");

        const summaryRows = scoreRanges.map(row => ({
            id: row.id,
            catId: row.catId || null,
            weight: typeof row.weight === 'number' ? row.weight : parseFloat(row.weight) || 0,
            customVal: row.catId ? undefined : attendanceAvgPerc
        }));

        let grandTotalScore = 0;
        summaryRows.forEach(row => {
            const avgPercStr = row.catId ? (newGridData[`${row.catId}_eval_actual`] || "0%") : `${row.customVal}%`;
            const avgPercVal = parseFloat(avgPercStr) || 0;

            updateKey(`summary_avg_${row.id}`, avgPercStr !== "0%" ? avgPercStr : "");

            const weightedScore = avgPercVal * row.weight;
            updateKey(`summary_weight_${row.id}`, weightedScore > 0 ? weightedScore.toFixed(2) : "");
            grandTotalScore += weightedScore;
        });

        updateKey('summary_total_score', grandTotalScore > 0 ? grandTotalScore.toFixed(2) : "");

        if (hasChanges) {
            setGridData(newGridData);
        }
    }, [gridData, config, categories, scoreRanges, readOnly]);

    const handleSignature = (field, type) => {
        const prefix = type === 'approve' ? "Approved By: " : "Rejected By: ";
        setHeaderInfo(prev => ({ ...prev, [field]: `${prefix}${loggedInName}` }));
    };

    const handleClearSignature = (field) => {
        setHeaderInfo(prev => ({ ...prev, [field]: "" }));
    };

    const daysDetailed = ['d1', 'd2', 'd3'];
    const daysSummary = Array.from({ length: 13 }, (_, i) => `day_${i + 4}`);

    const getDisabledDatesForDay = (dayIdx) => {
        let prevMaxDate = null;
        for (let i = 1; i < dayIdx; i++) {
            const val = gridData[`attendance_date_${i}`];
            if (val && val.includes('-')) {
                try {
                    const d = parse(val, "dd-MMM-yy", new Date());
                    if (!prevMaxDate || d > prevMaxDate) prevMaxDate = d;
                } catch (e) { }
            }
        }
        let nextMinDate = null;
        for (let i = dayIdx + 1; i <= 16; i++) {
            const val = gridData[`attendance_date_${i}`];
            if (val && val.includes('-')) {
                try {
                    const d = parse(val, "dd-MMM-yy", new Date());
                    if (!nextMinDate || d < nextMinDate) nextMinDate = d;
                } catch (e) { }
            }
        }
        return (date) => {
            if (prevMaxDate && date <= prevMaxDate) return true;
            if (nextMinDate && date >= nextMinDate) return true;

            // Restrict future dates (after today)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date > today) return true;

            return false;
        };
    };

    const isDay16ColFilled = isDay16Filled();

    return (
        <div className="space-y-4">
            {isLeftUser && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 print:hidden">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Associate has LEFT: This sheet is locked. Only the Comment field can be edited and saved.
                </div>
            )}
            {eligibilityStillWaiting && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 print:hidden">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    16-Day Monitoring unlocks in {eligibilityCountdown} (Approved in Handover on{" "}
                    {headerInfo.handoverApprovedAt ? new Date(headerInfo.handoverApprovedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-"}
                    ). {canOverrideEligibility ? "As an Admin/Trainer you can still start it early." : "This sheet is locked until then."}
                </div>
            )}
            <div className="flex justify-between items-center print:hidden">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Badge variant={headerInfo.status === 'Submitted' ? "success" : "secondary"} className="text-xs px-3 py-1 uppercase tracking-wider font-bold">
                            {headerInfo.status || 'Draft'}
                        </Badge>
                        {isLocked && <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200 bg-orange-50">View Only</Badge>}
                        {isLeftUser && <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">Associate Left — Comment Only</Badge>}
                        {eligibilityStillWaiting && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                                ⏳ Eligible in {eligibilityCountdown}
                            </Badge>
                        )}
                        {isForceNewAttempt && <Badge className="bg-blue-500 animate-pulse text-white text-[10px]">NEW ATTEMPT MODE</Badge>}
                        {!studentId && (
                            <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">DESIGN MODE: TEMPLATE SETUP</Badge>
                        )}
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

                <div className="flex gap-2">
                    <div className="flex gap-2">
                        {canEditConfig && (
                            <>
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
                            </>
                        )}
                        <Button
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50 h-9"
                            onClick={() => {
                                logAction({
                                    action: 'EXPORT_SIXTEEN_DAY_MONITORING_SHEET',
                                    details: { studentId, employeeName: headerInfo.employeeName }
                                }).unwrap().catch((err) => console.error("Failed to log export:", err));
                                exportToExcel("16-Day Monitoring Sheet", { studentId });
                            }}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>

                        {studentId && (
                            <div className="flex items-center mr-2">
                                {isDay16ColFilled ? (
                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 flex items-center py-1.5 px-3">
                                        <CheckCircle2 className="h-3 w-3" /> Day 16 Complete
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1 flex items-center py-1.5 px-3">
                                        <XCircle className="h-3 w-3 text-amber-500" /> Day 16 Incomplete
                                    </Badge>
                                )}
                            </div>
                        )}

                        <div className="flex gap-1 border-l pl-2 border-gray-200">
                            {headerInfo.status !== 'Submitted' && (
                                <Button
                                    variant="secondary"
                                    onClick={() => handleSave("Draft", false)}
                                    disabled={saving || !studentId || eligibilityStillLocked}
                                    className="h-9 gap-2"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Draft
                                </Button>
                            )}

                            {headerInfo.status === 'Submitted' && (
                                <Button
                                    variant="secondary"
                                    onClick={() => handleSave("Submitted", false)}
                                    disabled={saving || !studentId || isLocked || readOnly}
                                    className="h-9 gap-2"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save Updates
                                </Button>
                            )}

                            <Button
                                variant={headerInfo.status === 'Submitted' ? "outline" : "default"}
                                onClick={() => handleSave("Submitted", true)}
                                disabled={saving || !studentId || !isDay16ColFilled || isLocked || readOnly || isLeftUser || eligibilityStillLocked}
                                className="h-9 gap-2"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                {headerInfo.status === 'Submitted' ? 'Update & Re-Submit' : 'Submit Monitoring'}
                            </Button>

                            {(headerInfo.status === 'Submitted' || authUser?.isAdmin || authUser?.isTrainer) && studentId && (
                                <Button
                                    variant="outline"
                                    className="border-blue-600 text-blue-600 hover:bg-blue-50 h-9 gap-2"
                                    onClick={() => handleEmail()}
                                    disabled={sendingEmail || !isDay16ColFilled}
                                >
                                    {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                    Email Report
                                </Button>
                            )}
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => window.print()} className="h-9 gap-2">
                        <Printer className="w-4 h-4" /> Print
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0">
                    <div className="min-w-max p-4 text-sm text-black bg-white shadow-sm border border-black/10 rounded-lg">

                        <div className="border-t border-x border-black">
                            <div className="flex justify-between items-start border-b border-black">
                                <div className="flex-1 text-center font-bold text-lg p-2 uppercase">
                                    Associate Performance Monitoring Check Sheet <br />
                                    <span className="text-sm font-normal">(WORKING IN {typeof headerInfo.dept === 'string' ? headerInfo.dept : (headerInfo.dept?.name || headerInfo.dept?._id || "DEPARTMENT")})</span>
                                </div>
                                <div className="w-48 border-l border-black text-[8px] font-bold">
                                    <div className="border-b border-black p-1 flex justify-between">
                                        <span>Document No.</span>
                                        <span>{revisionInfo.docNo}</span>
                                    </div>
                                    <div className="border-b border-black p-1 flex justify-between">
                                        <span>Revision No.</span>
                                        <span>{revisionInfo.revNo}</span>
                                    </div>
                                    <div className="p-1 flex justify-between">
                                        <span>Revision Date:</span>
                                        <span>{revisionInfo.revDate}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 text-[12px] bg-white">
                                <div className="border-r border-black">
                                    <div className="flex border-b border-black h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Employee Name</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {headerInfo.employeeName}</div>
                                    </div>
                                    <div className="flex border-b border-black h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Employee Code</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {headerInfo.employeeCode}</div>
                                    </div>
                                    <div className="flex border-b border-black h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Station Name</div>
                                        <div className="flex-1 p-1 border-l border-black h-full">
                                            <input
                                                disabled={readOnly || isLocked || isCellLocked('processName', 'header')}
                                                className="w-full h-full bg-transparent border-none outline-none px-1 font-semibold text-blue-700"
                                                value={headerInfo.processName}
                                                onChange={e => handleHeaderChange('processName', e.target.value)}
                                                placeholder=": Enter Process"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Dept. / Section</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">: {typeof headerInfo.dept === 'string' ? headerInfo.dept : (headerInfo.dept?.name || headerInfo.dept?._id || "")}</div>
                                    </div>
                                </div>
                                <div className="border-l border-black">
                                    <div className="flex border-b border-black h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Handover Date</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">:
                                            {readOnly || isLocked || isCellLocked('handoverDate', 'header') ? (
                                                <span className="px-1 font-semibold text-blue-700">
                                                    {headerInfo.handoverDate || "-"}
                                                </span>
                                            ) : (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <div className="px-1 cursor-pointer hover:bg-blue-50/50 underline decoration-dotted decoration-blue-300">
                                                            {headerInfo.handoverDate || "Select Date"}
                                                        </div>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            selected={headerInfo.handoverDate ? new Date(headerInfo.handoverDate) : undefined}
                                                            onSelect={(date) => {
                                                                if (date) {
                                                                    handleHeaderChange('handoverDate', format(date, "yyyy-MM-dd"));
                                                                }
                                                            }}
                                                            initialFocus
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex border-b border-black h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Trg. Result</div>
                                        <div className="flex-1 p-1 border-l border-black h-full">
                                            <input
                                                disabled={readOnly || isLocked || isCellLocked('trgResult', 'header')}
                                                className="w-full h-full bg-transparent border-none outline-none px-1 font-semibold text-blue-700"
                                                value={headerInfo.trgResult}
                                                onChange={e => handleHeaderChange('trgResult', e.target.value)}
                                                placeholder=": OK/NG"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex border-b border-black h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Working With</div>
                                        <div className="flex-1 p-1 border-l border-black h-full">
                                            <input
                                                disabled={readOnly || isLocked || isCellLocked('workingWith', 'header')}
                                                className="w-full h-full bg-transparent border-none outline-none px-1 font-semibold text-blue-700"
                                                value={headerInfo.workingWith}
                                                onChange={e => handleHeaderChange('workingWith', e.target.value)}
                                                placeholder=": Enter Name"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex h-10 items-center">
                                        <div className="w-40 p-1 font-bold">Line & Leader Name</div>
                                        <div className="flex-1 p-1 border-l border-black h-full flex items-center font-semibold text-blue-700">
                                            : {lineNamePart || (headerInfo.lineLeaderName?.includes(' / ') ? headerInfo.lineLeaderName.split(' / ')[0] : "")}
                                            {lineLeaderOptions.length > 0 ? (
                                                <select
                                                    disabled={readOnly || isLocked || isCellLocked('lineLeaderName', 'header')}
                                                    className="ml-1 bg-transparent border-none outline-none text-blue-700 font-semibold cursor-pointer"
                                                    value={headerInfo.lineLeaderName?.includes(' / ') ? headerInfo.lineLeaderName.split(' / ')[1] : (lineNamePart ? "" : headerInfo.lineLeaderName)}
                                                    onChange={(e) => {
                                                        const line = lineNamePart || (headerInfo.lineLeaderName?.includes(' / ') ? headerInfo.lineLeaderName.split(' / ')[0] : "");
                                                        const leader = e.target.value;
                                                        handleHeaderChange('lineLeaderName', leader ? (line ? `${line} / ${leader}` : leader) : line);
                                                    }}
                                                >
                                                    <option value="">-- Select Leader --</option>
                                                    {lineLeaderOptions.map((opt, i) => (
                                                        <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    disabled={readOnly || isLocked || isCellLocked('lineLeaderName', 'header')}
                                                    className="ml-1 flex-1 bg-transparent border-none outline-none text-blue-700 font-semibold"
                                                    value={headerInfo.lineLeaderName?.includes(' / ') ? headerInfo.lineLeaderName.split(' / ')[1] : (lineNamePart ? "" : headerInfo.lineLeaderName)}
                                                    onChange={(e) => {
                                                        const line = lineNamePart || (headerInfo.lineLeaderName?.includes(' / ') ? headerInfo.lineLeaderName.split(' / ')[0] : "");
                                                        const leader = e.target.value;
                                                        handleHeaderChange('lineLeaderName', leader ? (line ? `${line} / ${leader}` : leader) : line);
                                                    }}
                                                    placeholder="Enter Leader Name"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border border-black mt-0">
                            <table className="w-full border-collapse text-[14px]">
                                <thead>
                                    <tr className="border-b border-black font-bold">
                                        <th rowSpan="3" className="border-r border-black min-w-[60px] bg-gray-50 text-[14px]">S.No</th>
                                        <th rowSpan="3" className="border-r border-black min-w-[200px] bg-gray-50 text-left px-3 text-[14px]">Parameters</th>
                                        <th rowSpan="3" className="border-r border-black min-w-[400px] bg-gray-50 text-left px-3 text-[14px]">Check Items</th>
                                        <th rowSpan="3" className="border-r border-black min-w-[150px] bg-gray-50 p-2 leading-tight text-[14px]">Mark<br />(Max.)</th>
                                        <th colSpan="46" className="border-r border-black text-center bg-gray-200 uppercase tracking-widest py-3 border-b border-black text-[15px] font-extrabold">DAY WISE PERFORMANCE MONITORING</th>
                                        <th rowSpan="3" className="min-w-[250px] bg-blue-50/50 leading-tight border-l border-black text-[14px] font-bold">Evaluation after monitoring of 16 days</th>
                                    </tr>
                                    <tr className="border-b border-black bg-gray-50/30">
                                        {[...Array(3)].map((_, i) => {
                                            const dayIdx = i + 1;
                                            const val = gridData[`attendance_date_${dayIdx}`] || "";
                                            let selectedDate = undefined;
                                            try { if (val && val.includes('-')) selectedDate = parse(val, "dd-MMM-yy", new Date()); } catch (e) { }

                                            if (readOnly || isLocked || isCellLocked(`attendance_date_${dayIdx}`, 'grid')) {
                                                return (
                                                    <th key={i} colSpan="11" className={`border-r border-black text-center h-16 font-bold text-[14px] p-0 bg-slate-50/50 ${dayBlurClass(dayIdx)}`}>
                                                        <div className="flex flex-col items-center justify-center h-full w-full py-1">
                                                            <span>Day-{dayIdx}</span>
                                                            <span className="text-[16px] text-blue-900 font-semibold">
                                                                ({val || "-"})
                                                            </span>
                                                        </div>
                                                    </th>
                                                );
                                            }

                                            return (
                                                <th key={i} colSpan="11" className="border-r border-black text-center h-16 font-bold text-[14px] p-0">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 h-full w-full py-1">
                                                                <span>Day-{dayIdx}</span>
                                                                <span className={`text-[16px] ${val ? 'text-blue-700 underline decoration-dotted' : 'text-gray-400 font-normal italic'}`}>
                                                                    ({val || "Click to set date"})
                                                                </span>
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={selectedDate}
                                                                onSelect={(date) => date && handleGridChange('attendance', `date_${dayIdx}`, format(date, "dd-MMM-yy"))}
                                                                disabled={getDisabledDatesForDay(dayIdx)}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </th>
                                            );
                                        })}
                                        {Array.from({ length: 13 }, (_, i) => {
                                            const dayIdx = i + 4;
                                            const val = gridData[`attendance_date_${dayIdx}`] || "";
                                            let selectedDate = undefined;
                                            try { if (val && val.includes('-')) selectedDate = parse(val, "dd-MMM-yy", new Date()); } catch (e) { }

                                            if (readOnly || isLocked || isCellLocked(`attendance_date_${dayIdx}`, 'grid')) {
                                                return (
                                                    <th key={i} rowSpan="2" className={`border-r border-black min-w-[85px] text-[14px] font-bold p-0 bg-slate-50/50 ${dayBlurClass(dayIdx)}`}>
                                                        <div className="flex flex-col items-center justify-center h-full w-full py-1">
                                                            <span>Day-{dayIdx}</span>
                                                            <span className="text-[10px] text-blue-900 font-semibold">
                                                                ({val || "-"})
                                                            </span>
                                                        </div>
                                                    </th>
                                                );
                                            }

                                            return (
                                                <th key={i} rowSpan="2" className="border-r border-black min-w-[85px] text-[14px] font-bold p-0">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 h-full w-full py-1">
                                                                <span>Day-{dayIdx}</span>
                                                                <span className={`text-[10px] ${val ? 'text-blue-700 underline decoration-dotted' : 'text-gray-400 font-normal italic'}`}>
                                                                    ({val || "Set Date"})
                                                                </span>
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={selectedDate}
                                                                onSelect={(date) => date && handleGridChange('attendance', `date_${dayIdx}`, format(date, "dd-MMM-yy"))}
                                                                disabled={getDisabledDatesForDay(dayIdx)}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                    <tr className="border-b border-black bg-gray-50/30">
                                        {[...Array(3)].map((_, dIdx) => (
                                            <React.Fragment key={dIdx}>
                                                {[...Array(10)].map((_, i) => <th key={i} className={`border-r border-black min-w-[50px] text-[13px] h-10 ${dayBlurClass(dIdx + 1)}`}>{i + 1}</th>)}
                                                <th className={`border-r border-black min-w-[85px] text-[13px] font-bold italic leading-tight ${dayBlurClass(dIdx + 1)}`}>Avg<br />Total</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {categories.map((cat, catIdx) => {
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
                                                            <tr key={`${row.id}_${sub.id}`} className={`border-b border-black group hover:bg-blue-50/10 text-[14px] ${sub.rowClass || ''}`}>
                                                                {rowIdx === 0 && sIdx === 0 && (
                                                                    <>
                                                                        <td rowSpan={totalRowsInCat} className="border-r border-black text-center font-bold align-middle bg-gray-50/20">{catIdx + 1}</td>
                                                                        <td rowSpan={totalRowsInCat} className="border-r border-black p-1 font-bold align-middle bg-gray-50/20 whitespace-pre-line leading-tight">{cat.category}</td>
                                                                    </>
                                                                )}
                                                                {sIdx === 0 ? (
                                                                    <td rowSpan={4} className="border-r border-black p-2 align-middle font-semibold min-w-[200px] text-left pr-2 text-[14px]">
                                                                        {row.label}
                                                                    </td>
                                                                ) : null}
                                                                <td className="border-r border-black text-center align-middle font-bold min-w-[150px] text-[14px] bg-gray-50/30 leading-tight px-1">
                                                                    {sub.hasMark ? row.weight : sub.label}
                                                                </td>
                                                                {daysDetailed.map(dayPrefix => (
                                                                    <React.Fragment key={dayPrefix}>
                                                                        {[...Array(10)].map((_, i) => {
                                                                            const val = gridData[`${row.id}_${dayPrefix}_${sub.id}_${i}`] || "";
                                                                            return (
                                                                                <td key={i} className={`p-0 border-r border-black align-middle h-full ${dayPrefixBlurClass(dayPrefix)}`}>
                                                                                    <div className="relative flex items-center justify-center min-w-[50px] h-full">
                                                                                        <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{val || "00"}</span>
                                                                                        <input
                                                                                            disabled={readOnly || isLocked || isCellLocked(`${row.id}_${dayPrefix}_${sub.id}_${i}`, 'grid')}
                                                                                            className={`absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold p-1 focus:bg-blue-50 outline-none ${sub.colorClass || 'text-black'}`}
                                                                                            value={val}
                                                                                            onChange={(e) => handleGridChange(row.id, `${dayPrefix}_${sub.id}_${i}`, e.target.value)}
                                                                                        />
                                                                                    </div>
                                                                                </td>
                                                                            );
                                                                        })}
                                                                        <td className={`p-0 border-r border-black align-middle h-full font-bold bg-yellow-400 ${dayPrefixBlurClass(dayPrefix)}`}>
                                                                            <div className="relative flex items-center justify-center min-w-[80px] h-full">
                                                                                <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${row.id}_${dayPrefix}_${sub.id}_avg`] || "00"}</span>
                                                                                <input
                                                                                    disabled={readOnly || isLocked || isCellLocked(`${row.id}_${dayPrefix}_${sub.id}_avg`, 'grid')}
                                                                                    className={`absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] p-1 font-bold outline-none ${sub.colorClass || 'text-black'}`}
                                                                                    value={gridData[`${row.id}_${dayPrefix}_${sub.id}_avg`] || ""}
                                                                                    onChange={(e) => handleGridChange(row.id, `${dayPrefix}_${sub.id}_avg`, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                    </React.Fragment>
                                                                ))}
                                                                {daysSummary.map(dayKey => {
                                                                    const val = gridData[`${row.id}_${dayKey}_${sub.id}`] || "";
                                                                    return (
                                                                        <td key={dayKey} className={`p-0 border-r border-black ${dayKeyBlurClass(dayKey)}`}>
                                                                            <div className="relative flex items-center justify-center min-w-[70px] h-full">
                                                                                <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{val || "00"}</span>
                                                                                <input
                                                                                    disabled={readOnly || sub.id === 'achievement' || isLocked || isCellLocked(`${row.id}_${dayKey}_${sub.id}`, 'grid')}
                                                                                    className={`absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold py-1 focus:bg-blue-50 outline-none ${sub.colorClass || 'text-blue-700'}`}
                                                                                    value={val}
                                                                                    onChange={(e) => handleGridChange(row.id, `${dayKey}_${sub.id}`, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}
                                                                {rowIdx === 0 && sIdx === 0 && (
                                                                    <td rowSpan={totalRowsInCat} className="border-l border-black bg-white min-w-[250px]" />
                                                                )}
                                                            </tr>
                                                        ))
                                                    }
                                                    return (
                                                        <tr key={row.id} className="border-b border-black group hover:bg-blue-50/10 min-h-[1.5rem] text-[14px]">
                                                            {rowIdx === 0 && (
                                                                <>
                                                                    <td rowSpan={totalRowsInCat} className="border-r border-black text-center font-bold align-middle bg-gray-50/20">{catIdx + 1}</td>
                                                                    <td rowSpan={totalRowsInCat} className="border-r border-black p-1 font-bold align-middle bg-gray-50/20 whitespace-pre-line leading-tight">{cat.category}</td>
                                                                </>
                                                            )}
                                                            <td className={`border-r border-black p-3 align-middle text-left text-[14px] min-w-[400px] ${row.type === 'cycle' ? 'font-bold' : 'font-semibold'}`}>
                                                                {row.label}
                                                            </td>
                                                            <td className="border-r border-black text-center align-middle font-bold text-[14px] min-w-[150px] bg-gray-50/10">{row.weight}</td>
                                                            {daysDetailed.map(dayPrefix => (
                                                                <React.Fragment key={dayPrefix}>
                                                                    {row.type === 'cycle' ? (
                                                                        <>
                                                                            {[...Array(10)].map((_, i) => {
                                                                                const val = gridData[`${row.id}_${dayPrefix}_${i}`] || "";
                                                                                return (
                                                                                    <td key={i} className={`p-0 border-r border-black align-middle h-full ${dayPrefixBlurClass(dayPrefix)}`}>
                                                                                        <div className="relative flex items-center justify-center min-w-[50px] h-full">
                                                                                            <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{val || "00"}</span>
                                                                                            <input
                                                                                                disabled={readOnly || isLocked || isCellLocked(`${row.id}_${dayPrefix}_${i}`, 'grid')}
                                                                                                className="absolute inset-0 w-full h-full text-center bg-transparent border-none font-bold text-blue-700 text-[14px] p-1 focus:bg-blue-50 outline-none"
                                                                                                value={val}
                                                                                                onChange={(e) => handleGridChange(row.id, `${dayPrefix}_${i}`, e.target.value)}
                                                                                            />
                                                                                        </div>
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                            <td className={`p-0 border-r border-black align-middle h-full font-bold bg-yellow-400 ${dayPrefixBlurClass(dayPrefix)}`}>
                                                                                <div className="relative flex items-center justify-center min-w-[80px] h-full text-blue-700">
                                                                                    <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${row.id}_${dayPrefix}_avg`] || "00"}</span>
                                                                                    <input
                                                                                        disabled={readOnly || isLocked || isCellLocked(`${row.id}_${dayPrefix}_avg`, 'grid')}
                                                                                        className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-blue-700 font-bold text-[14px] p-1 outline-none"
                                                                                        value={gridData[`${row.id}_${dayPrefix}_avg`] || ""}
                                                                                        onChange={(e) => handleGridChange(row.id, `${dayPrefix}_avg`, e.target.value)}
                                                                                    />
                                                                                </div>
                                                                            </td>
                                                                        </>
                                                                    ) : (
                                                                        <td colSpan="11" className={`p-0 border-r border-black align-middle h-full ${dayPrefixBlurClass(dayPrefix)}`}>
                                                                            <div className="relative flex items-center justify-center min-w-[100px] h-full">
                                                                                <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${row.id}_${dayPrefix}`] || "00"}</span>
                                                                                <input
                                                                                    disabled={readOnly || isLocked || isCellLocked(`${row.id}_${dayPrefix}`, 'grid')}
                                                                                    className="absolute inset-0 w-full h-full text-center bg-transparent font-bold border-none text-[14px] text-blue-700 focus:bg-blue-50 outline-none"
                                                                                    value={gridData[`${row.id}_${dayPrefix}`] || ""}
                                                                                    onChange={(e) => handleGridChange(row.id, dayPrefix, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                </React.Fragment>
                                                            ))}
                                                            {daysSummary.map(dayKey => {
                                                                const val = gridData[`${row.id}_${dayKey}`] || "";
                                                                return (
                                                                    <td key={dayKey} className={`border-r border-black p-0 h-full ${dayKeyBlurClass(dayKey)}`}>
                                                                        <div className="relative flex items-center justify-center min-w-[70px] h-full">
                                                                            <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{val || "00"}</span>
                                                                            <input
                                                                                disabled={readOnly || isLocked || isCellLocked(`${row.id}_${dayKey}`, 'grid')}
                                                                                className="absolute inset-0 w-full h-full text-center bg-transparent font-bold border-none text-blue-700 text-[14px] outline-none"
                                                                                value={val}
                                                                                onChange={e => handleGridChange(row.id, dayKey, e.target.value)}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                            {rowIdx === 0 && (
                                                                <td rowSpan={totalRowsInCat} className="border-l border-black bg-white w-40" />
                                                            )}
                                                        </tr>
                                                    )
                                                })}
                                                {cat.totalMark && (
                                                    <tr className="border-b border-black bg-yellow-200">
                                                        <td colSpan="3" className="text-right p-2 font-bold text-[14px]">Total Mark:</td>
                                                        <td className="border-r border-black text-center font-bold text-blue-600 text-[14px]">{cat.totalMark}</td>
                                                        {daysDetailed.map(d => (
                                                            <td key={d} colSpan="11" className={`border-r border-black p-0 ${dayPrefixBlurClass(d)}`}>
                                                                <div className="relative flex items-center justify-center min-w-[100px] h-10">
                                                                    <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${cat.id}_${d}_total`] || "00"}</span>
                                                                    <input
                                                                        disabled={true}
                                                                        className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold text-black outline-none"
                                                                        value={gridData[`${cat.id}_${d}_total`] || ""}
                                                                        onChange={e => handleGridChange(cat.id, `${d}_total`, e.target.value)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        ))}
                                                        {daysSummary.map(d => (
                                                            <td key={d} className={`border-r border-black p-0 h-full ${dayKeyBlurClass(d)}`}>
                                                                <div className="relative flex items-center justify-center min-w-[70px] h-10">
                                                                    <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${cat.id}_${d}_total`] || "00"}</span>
                                                                    <input
                                                                        disabled={true}
                                                                        className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold text-black outline-none"
                                                                        value={gridData[`${cat.id}_${d}_total`] || ""}
                                                                        onChange={e => handleGridChange(cat.id, `${d}_total`, e.target.value)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        ))}
                                                        <td className="bg-blue-100/50 p-0 h-full border-l border-black">
                                                            <div className="relative flex items-center justify-center min-w-[250px] h-10">
                                                                <span className="invisible whitespace-pre px-4 text-[15px] font-bold">{gridData[`${cat.id}_eval_total`] || "00"}</span>
                                                                <input
                                                                    disabled={true}
                                                                    className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[15px] font-bold outline-none text-blue-900"
                                                                    value={gridData[`${cat.id}_eval_total`] || ""}
                                                                    onChange={e => handleGridChange(cat.id, 'eval_total', e.target.value)}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {cat.target && (
                                                    <React.Fragment>
                                                        <tr className="border-b border-black bg-yellow-100 min-h-[3rem]">
                                                            <td colSpan="3" className="text-right p-2 font-bold text-[14px]">Target % :</td>
                                                            <td className="border-r border-black text-center font-bold text-[14px]">{cat.target}</td>
                                                            {daysDetailed.map(d => (
                                                                <td key={d} colSpan="11" className={`border-r border-black text-center font-bold text-[14px] h-12 ${dayPrefixBlurClass(d)}`}>100%</td>
                                                            ))}
                                                            {daysSummary.map(d => (
                                                                <td key={d} className={`border-r border-black text-center font-bold text-[14px] h-12 ${dayKeyBlurClass(d)}`}>100%</td>
                                                            ))}
                                                            <td className="bg-white p-0 border-l border-black">
                                                                <div className="flex w-full h-full divide-x divide-black min-h-[3rem]">
                                                                    <div className="flex-1 px-3 flex items-center font-extrabold bg-white text-[14px]">Target % :</div>
                                                                    <div className="min-w-[100px] px-3 flex items-center justify-end font-extrabold bg-white text-[15px]">{cat.target || '100%'}</div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        <tr className="border-b border-black bg-yellow-200 min-h-[3rem]">
                                                            <td colSpan="3" className="text-right p-2 font-bold text-[14px]">{cat.actualLabel || "Actual %:"}</td>
                                                            <td className="border-r border-black text-center font-bold italic text-[14px]">-</td>
                                                            {daysDetailed.map(d => (
                                                                <td key={d} colSpan="11" className={`border-r border-black p-0 h-full ${dayPrefixBlurClass(d)}`}>
                                                                    <div className="relative flex items-center justify-center min-w-[100px] h-12">
                                                                        <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${cat.id}_${d}_actual`] || "00"}</span>
                                                                        <input
                                                                            disabled={true}
                                                                            className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold h-full outline-none text-black"
                                                                            value={gridData[`${cat.id}_${d}_actual`] || ""}
                                                                            onChange={e => handleGridChange(cat.id, `${d}_actual`, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            {daysSummary.map(d => (
                                                                <td key={d} className={`border-r border-black p-0 h-full ${dayKeyBlurClass(d)}`}>
                                                                    <div className="relative flex items-center justify-center min-w-[70px] h-12">
                                                                        <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`${cat.id}_${d}_actual`] || "00"}</span>
                                                                        <input
                                                                            disabled={true}
                                                                            className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold h-full outline-none text-black"
                                                                            value={gridData[`${cat.id}_${d}_actual`] || ""}
                                                                            onChange={e => handleGridChange(cat.id, `${d}_actual`, e.target.value)}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            ))}
                                                            <td className="bg-yellow-400 p-0 border-l border-black">
                                                                <div className="flex w-full h-full divide-x divide-black min-h-[3rem]">
                                                                    <div className="flex-1 px-3 flex items-center font-extrabold text-[14px]">Actual (Avg %)</div>
                                                                    <div className="min-w-[100px] px-3 flex items-center justify-end font-extrabold text-[15px]">
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

                        <div className="mt-6 font-bold text-[14px] text-black uppercase tracking-tight">
                            Fulfill above 1~5 parameters based on working days if person absent then fill next date into column days
                        </div>

                        <div className="mt-4 space-y-6">
                            <div className="border border-black">
                                <table className="w-full border-collapse text-[14px]">
                                    <tbody>
                                        <tr className="border-b border-black h-12">
                                            <td rowSpan="5" className="border-r border-black font-bold text-center bg-blue-50/20 text-[14px]">6</td>
                                            <td rowSpan="5" className="border-r border-black font-bold p-2 bg-blue-50/20 text-center align-middle text-[14px]">Attendance</td>
                                            <td className="border-r border-black font-bold p-2 text-[14px]">Total no. of Monitoring day's :</td>
                                            <td className="min-w-[100px] border-r border-black font-bold text-center bg-gray-50 text-[14px]">Date</td>
                                            {Array.from({ length: 16 }, (_, i) => {
                                                const val = gridData[`attendance_date_${i + 1}`] || "";
                                                let selectedDate = undefined;
                                                try {
                                                    if (val && val.includes('-')) {
                                                        selectedDate = parse(val, "dd-MMM-yy", new Date());
                                                    }
                                                } catch (e) {
                                                    console.error("Date parse error", e);
                                                }

                                                if (readOnly || isLocked || isCellLocked(`attendance_date_${i + 1}`, 'grid')) {
                                                    return (
                                                        <td key={i} className={`border-r border-black min-w-[50px] p-0 h-full text-center font-bold text-[13px] text-blue-900 bg-slate-50/50 ${dayBlurClass(i + 1)}`}>
                                                            {val || "-"}
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={i} className="border-r border-black min-w-[50px] p-0 h-full">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <div className="relative flex items-center justify-center min-w-[50px] h-12 cursor-pointer hover:bg-slate-50 transition-colors">
                                                                    <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{val || "00-MMM-00"}</span>
                                                                    <div className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold ${!val ? 'text-slate-300 italic font-medium' : 'text-blue-900 underline decoration-dotted'}`}>
                                                                        {val || "DD-MMM-YY"}
                                                                    </div>
                                                                </div>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={selectedDate}
                                                                    onSelect={(date) => {
                                                                        if (date) {
                                                                            handleGridChange('attendance', `date_${i + 1}`, format(date, "dd-MMM-yy"));
                                                                        }
                                                                    }}
                                                                    disabled={getDisabledDatesForDay(i + 1)}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </td>
                                                );
                                            })}
                                            <td className="min-w-[120px] bg-blue-100/50 text-center font-bold text-[14px] border-l border-black italic">Avg. Score</td>
                                        </tr>
                                        <tr className="border-b border-black h-12">
                                            <td className="border-r border-black font-bold p-2 text-[14px]">Target %</td>
                                            <td className="min-w-[100px] border-r border-black text-center font-bold text-[14px]">100%</td>
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <td key={i} className={`border-r border-black text-center text-[14px] font-bold ${dayBlurClass(i + 1)}`}>100%</td>
                                            ))}
                                            <td className="bg-blue-100/50 text-center font-bold text-[14px] border-l border-black">100%</td>
                                        </tr>
                                        <tr className="border-black h-12">
                                            <td className="border-r border-black font-bold p-2 text-[14px]">Actual % age followed</td>
                                            <td className="min-w-[100px] border-r border-black font-bold text-center text-[14px]">-</td>
                                            {Array.from({ length: 16 }, (_, i) => {
                                                const val = gridData[`attendance_actual_${i + 1}`] || "";
                                                return (
                                                    <td key={i} className={`border-r border-black p-0 h-full ${dayBlurClass(i + 1)}`}>
                                                        <div className="relative flex items-center justify-center min-w-[50px] h-12">
                                                            <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{val || "00"}</span>
                                                            <input
                                                                disabled={readOnly || isLocked || isCellLocked(`attendance_actual_${i + 1}`, 'grid')}
                                                                className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] h-full outline-none font-bold text-blue-900"
                                                                value={val}
                                                                onChange={e => handleGridChange('attendance', `actual_${i + 1}`, e.target.value)}
                                                                placeholder="100%"
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="bg-blue-100/50 p-0 h-full border-l border-black">
                                                <div className="relative flex items-center justify-center min-w-[250px] h-12">
                                                    <span className="invisible whitespace-pre px-4 text-[15px] font-bold">{gridData[`attendance_total_score`] || "00%"}</span>
                                                    <input
                                                        disabled={true}
                                                        className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[15px] h-full outline-none font-bold text-blue-900"
                                                        value={gridData[`attendance_total_score`] || ""}
                                                        onChange={e => handleGridChange('attendance', 'total_score', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                        <tr className="border-t border-black h-12">
                                            <td className="border-r border-black font-bold p-2 text-[14px] uppercase">Checked By: Sign</td>
                                            <td className="min-w-[100px] border-r border-black font-bold text-center text-[14px]">-</td>
                                            {Array.from({ length: 16 }, (_, i) => {
                                                const val = gridData[`attendance_checked_${i + 1}`] || "";
                                                return (
                                                    <td key={i} className={`border-r border-black p-0 h-full ${dayBlurClass(i + 1)}`}>
                                                        <div className="relative flex items-center justify-center min-w-[50px] h-12">
                                                            <input
                                                                disabled={readOnly || isLocked || isCellLocked(`attendance_checked_${i + 1}`, 'grid')}
                                                                className="w-full h-full text-center bg-transparent border-none text-[11px] font-bold outline-none text-blue-900 placeholder:text-gray-300 px-1"
                                                                placeholder="SIGN"
                                                                value={val}
                                                                onChange={e => handleGridChange('attendance', `checked_${i + 1}`, e.target.value)}
                                                                onFocus={(e) => {
                                                                    if (!val && !readOnly && !isLocked && !isCellLocked(`attendance_checked_${i + 1}`, 'grid')) {
                                                                        handleGridChange('attendance', `checked_${i + 1}`, loggedInName);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="bg-blue-100/50 p-0 h-full border-l border-black"></td>
                                        </tr>
                                        <tr className="border-black h-12">
                                            <td className="border-r border-black font-bold p-2 text-[14px] uppercase">GAP OBSERVED</td>
                                            <td className="min-w-[100px] border-r border-black p-0 h-full">
                                                <input
                                                    disabled={readOnly || isLocked || isCellLocked('attendGap', 'grid')}
                                                    className="w-full h-full text-center border-none outline-none font-bold text-[14px] text-blue-900"
                                                    value={gridData[`attendGap`] || "0"}
                                                    onChange={(e) => handleGridChange('attendGap', '', e.target.value)}
                                                />
                                            </td>
                                            <td colSpan="17" className="border-r border-black bg-gray-50/10"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="italic text-[11px] mt-2 mb-2 font-medium text-gray-600">
                                * Count all days of person include absenteeism during 16days of monitoring in attendance parameter 6
                            </div>

                            {/* Summary and Legends Grid */}
                            <div className="grid grid-cols-12 gap-2 mt-4">
                                {/* Score Ranges Table */}
                                <div className="col-span-12 lg:col-span-6 border border-black overflow-hidden">
                                    <table className="w-full border-collapse text-[12px]">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-black font-bold">
                                                <th className="border-r border-black p-2 text-left">Parameters</th>
                                                <th className="border-r border-black p-2">Total Weightage</th>
                                                <th className="border-r border-black p-2">Poor</th>
                                                <th className="border-r border-black p-2">Average**</th>
                                                <th className="border-r border-black p-2">V. Good</th>
                                                <th className="border-r border-black p-2">Excellent</th>
                                                <th className="border-r border-black p-2 min-w-[150px]">Avg. Score (Individual) in %</th>
                                                <th className="p-2 min-w-[150px]">Score Achieved w.r.t weightage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scoreRanges.map((row, idx) => (
                                                <tr key={idx} className="border-b border-black h-10">
                                                    <td className="border-r border-black p-2 font-bold bg-gray-50/30 text-[14px]">{row.label}</td>
                                                    <td className="border-r border-black text-center font-bold text-[14px]">{row.weight}</td>
                                                    <td className="border-r border-black text-center text-gray-500 italic bg-gray-50/10 text-[14px]">{row.poor}</td>
                                                    <td className="border-r border-black text-center text-gray-500 italic bg-gray-50/10 text-[14px]">{row.avg}</td>
                                                    <td className="border-r border-black text-center text-gray-500 italic bg-gray-50/10 text-[14px]">{row.good}</td>
                                                    <td className="border-r border-black text-center text-gray-500 italic bg-gray-50/10 text-[14px]">{row.excel}</td>
                                                    <td className="border-r border-black p-0 h-full">
                                                        <div className="relative flex items-center justify-center h-full min-h-[2.5rem]">
                                                            <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`summary_avg_${row.id}`] || "00"}</span>
                                                            <input
                                                                disabled={true}
                                                                className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold outline-none text-blue-800"
                                                                value={gridData[`summary_avg_${row.id}`] || ""}
                                                                onChange={e => handleGridChange('summary', `avg_${row.id}`, e.target.value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-0 h-full">
                                                        <div className="relative flex items-center justify-center h-full min-h-[2.5rem]">
                                                            <span className="invisible whitespace-pre px-4 text-[14px] font-bold">{gridData[`summary_weight_${row.id}`] || "00"}</span>
                                                            <input
                                                                disabled={true}
                                                                className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[14px] font-bold outline-none text-blue-800"
                                                                value={gridData[`summary_weight_${row.id}`] || ""}
                                                                onChange={e => handleGridChange('summary', `weight_${row.id}`, e.target.value)}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="font-bold bg-gray-100 h-12">
                                                <td className="border-r border-black p-2 text-[14px]">Total</td>
                                                <td className="border-r border-black text-center text-[15px]">
                                                    {scoreRanges.reduce((sum, row) => sum + (parseFloat(row.weight) || 0), 0)}
                                                </td>
                                                <td colSpan="4" className="border-r border-black"></td>
                                                <td className="border-r border-black p-0 italic text-center text-[14px] bg-white">
                                                    {(scoreRanges.reduce((sum, row) => sum + (parseFloat(row.weight) || 0), 0) * 100).toFixed(0)}%
                                                </td>
                                                <td className="p-0 h-full">
                                                    <div className="relative flex items-center justify-center h-full bg-yellow-400 min-h-[2.5rem]">
                                                        <span className="invisible whitespace-pre px-4 text-[16px] font-bold">{gridData[`summary_total_score`] || "00"}</span>
                                                        <input
                                                            disabled={true}
                                                            className="absolute inset-0 w-full h-full text-center bg-transparent border-none text-[16px] font-bold outline-none"
                                                            value={gridData[`summary_total_score`] || ""}
                                                            onChange={e => handleGridChange('summary', 'total_score', e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Evaluation Legend Tables */}
                                <div className="col-span-12 lg:col-span-3 space-y-4">
                                    <div className="border border-black overflow-hidden">
                                        <table className="w-full border-collapse text-[14px]">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-black">
                                                    <th colSpan="2" className="p-2 font-bold uppercase text-left bg-gray-100">Evaluation Criteria: Cycle time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(evaluationLegends.cycleTime || []).map((item, idx, arr) => (
                                                    <tr key={idx} className={idx < arr.length - 1 ? "border-b border-black h-10" : "h-10"}>
                                                        <td className="w-12 border-r border-black text-center font-bold text-[14px] bg-gray-50">{item.score}</td>
                                                        <td className="p-2 italic">{item.label}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="border border-black overflow-hidden">
                                        <table className="w-full border-collapse text-[14px]">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-black">
                                                    <th colSpan="2" className="p-2 font-bold uppercase text-left bg-gray-100">Evaluation Criteria: Quality / System, Discipline, 5S & Safety, 10 Cycle check</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(evaluationLegends.otherCriteria || []).map((item, idx, arr) => (
                                                    <tr key={idx} className={idx < arr.length - 1 ? "border-b border-black h-10" : "h-10"}>
                                                        <td className="w-12 border-r border-black text-center font-bold text-[14px] bg-gray-50">{item.score}</td>
                                                        <td className="p-2 italic">{item.label}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Signature and Comments blocks */}
                                <div className="col-span-12 lg:col-span-3 space-y-2">
                                    <div className="border border-black p-3 h-max bg-white">
                                        <div className="flex justify-between font-extrabold text-[12px] h-full items-end gap-4 px-3 pb-2">
                                            <div className="text-center w-1/3 flex flex-col justify-between py-2 gap-2">
                                                <span className="mb-auto text-[13px]">Checked By:-</span>
                                                <div className="relative">
                                                    <input
                                                        className="w-full text-center border-b border-black outline-none bg-transparent font-bold text-blue-900 placeholder:text-gray-300 h-8 text-[14px]"
                                                        placeholder="Auto-filled on Submit"
                                                        value={headerInfo.checkedBy || ""}
                                                        readOnly
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-center w-1/3 flex flex-col justify-between py-2 gap-2">
                                                <div className="flex items-center justify-between mb-auto h-8 px-2">
                                                    <span className="text-[13px]">Verified By:-</span>
                                                    {canVerify && !isLocked && !isCellLocked('verifiedBy', 'header') && (
                                                        <div className="flex gap-2 items-center">
                                                            {!headerInfo.verifiedBy ? (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleSignature('verifiedBy', 'approve')}
                                                                        className="h-7 px-2 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 border border-green-200 uppercase font-bold"
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleSignature('verifiedBy', 'reject')}
                                                                        className="h-7 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 uppercase font-bold"
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                (authUser?.isAdmin || headerInfo.verifiedBy.includes(loggedInName)) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleClearSignature('verifiedBy')}
                                                                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                                                        title="Clear Signature"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </Button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    className={`w-full text-center border-b border-black outline-none bg-transparent font-bold text-[14px] h-8 uppercase ${headerInfo.verifiedBy?.includes('Rejected') ? 'text-red-600' : 'text-blue-900'}`}
                                                    placeholder="NAME"
                                                    value={headerInfo.verifiedBy || ""}
                                                    readOnly
                                                />
                                                <span className="text-[11px] font-semibold italic text-gray-500">(Area Incharge)</span>
                                            </div>
                                            <div className="text-center w-1/3 flex flex-col justify-between py-2 gap-2">
                                                <div className="flex items-center justify-between mb-auto h-8 px-2">
                                                    <span className="text-[13px]">Approved By:-</span>
                                                    {canApprove && !isLocked && !isCellLocked('approvedBy', 'header') && (
                                                        <div className="flex gap-2 items-center">
                                                            {!headerInfo.approvedBy ? (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleSignature('approvedBy', 'approve')}
                                                                        className="h-7 px-2 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 border border-green-200 uppercase font-bold"
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleSignature('approvedBy', 'reject')}
                                                                        className="h-7 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 uppercase font-bold"
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                (authUser?.isAdmin || headerInfo.approvedBy.includes(loggedInName)) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleClearSignature('approvedBy')}
                                                                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                                                                        title="Clear Signature"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </Button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    className={`w-full text-center border-b border-black outline-none bg-transparent font-bold text-[14px] h-8 uppercase ${headerInfo.approvedBy?.includes('Rejected') ? 'text-red-600' : 'text-blue-900'}`}
                                                    placeholder="NAME"
                                                    value={headerInfo.approvedBy || ""}
                                                    readOnly
                                                />
                                                <span className="text-[11px] font-semibold italic text-gray-500">(Dept. Head)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border border-black min-h-[8rem] flex flex-col bg-white overflow-hidden">
                                        <div className="bg-gray-100 p-2 font-bold text-[13px] border-b border-black text-center uppercase tracking-wider">Comment (If Any) ***</div>
                                        <div className="flex-1 p-0 flex">
                                            <textarea
                                                disabled={readOnly || isLocked || isCellLocked('comment', 'grid')}
                                                className="flex-1 h-full border-none bg-transparent p-3 text-[14px] outline-none resize-none font-medium leading-relaxed"
                                                value={gridData.comment || ""}
                                                onChange={e => {
                                                    if (readOnly || isLocked || isCellLocked('comment', 'grid') || !studentId) return;
                                                    setGridData(prev => ({ ...prev, comment: e.target.value }));
                                                }}
                                                placeholder="Write any observation or comments here..."
                                            />
                                            <div className="w-1/4 h-full flex flex-col items-center justify-between text-center border-l border-black bg-gray-50/30 p-2 gap-1">
                                                <div className="flex items-center justify-between w-full px-2">
                                                    <span className="font-extrabold text-[12px] uppercase">Verified By:</span>
                                                    {canVerifyEduCell && !isLocked && !isCellLocked('verifiedByEduCell', 'header') && (
                                                        <div className="flex gap-1 items-center">
                                                            {!headerInfo.verifiedByEduCell ? (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleSignature('verifiedByEduCell', 'approve')}
                                                                        className="h-6 px-1.5 text-[9px] text-green-600 hover:text-green-700 hover:bg-green-50 border border-green-200 uppercase font-bold"
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleSignature('verifiedByEduCell', 'reject')}
                                                                        className="h-6 px-1.5 text-[9px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 uppercase font-bold"
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                (authUser?.isAdmin || headerInfo.verifiedByEduCell.includes(loggedInName)) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleClearSignature('verifiedByEduCell')}
                                                                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                                                        title="Clear Signature"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </Button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <input
                                                    className={`w-full text-center border-b border-black outline-none bg-transparent font-bold text-[12px] h-7 uppercase ${headerInfo.verifiedByEduCell?.includes('Rejected') ? 'text-red-600' : 'text-blue-900'}`}
                                                    placeholder="NAME"
                                                    value={headerInfo.verifiedByEduCell || ""}
                                                    readOnly
                                                />
                                                <span className="font-bold text-[12px] italic text-blue-900">(Education Cell)</span>
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
                                            setConfig(normalizeConfig(h.config));
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

            {/* Admin Remark Dialog — required when editing a saved session */}
            <Dialog open={isAdminRemarkDialogOpen} onOpenChange={(open) => {
                if (!open) { setIsAdminRemarkDialogOpen(false); setPendingSaveParams(null); setAdminRemarkText(''); }
            }}>
                <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <ShieldCheck className="w-5 h-5" />
                            Admin Edit Verification
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            This sheet has already been saved. Please provide a remark explaining what you changed and why. This will be logged for audit purposes.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="admin-remark-input" className="text-sm font-semibold text-slate-700">
                                Remark <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="admin-remark-input"
                                placeholder="Detail the modifications (e.g. corrected Day 4 cycle time actual score)..."
                                value={adminRemarkText}
                                onChange={(e) => setAdminRemarkText(e.target.value)}
                                className="min-h-[100px] text-xs resize-none"
                                maxLength={500}
                            />
                            <p className={`text-xs text-right ${adminRemarkText.length > 450 ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                                {adminRemarkText.length}/500
                            </p>
                        </div>
                        {adminRemarkText.trim().length > 0 && adminRemarkText.trim().length < 10 && (
                            <p className="text-xs text-red-500">Remark must be at least 10 characters.</p>
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => { setIsAdminRemarkDialogOpen(false); setPendingSaveParams(null); setAdminRemarkText(''); }}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={adminRemarkText.trim().length < 10}
                            onClick={() => {
                                handleSave(pendingSaveParams.finalStatus, pendingSaveParams.isSubmit, adminRemarkText.trim());
                            }}
                            className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            Save with Remark
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SixteenDayMonitoringSheet;

