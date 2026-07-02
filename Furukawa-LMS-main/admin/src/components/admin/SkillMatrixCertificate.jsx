import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Edit2, History, Info, Loader2, Save } from "lucide-react";
import { useGetActiveConfigQuery } from '@/Redux/AllApi/CourseLevelConfigApi';
import { exportToExcel } from "@/utils/exportHelper";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Dynamic Pie Chart Icon
const LevelIcon = ({ level, maxLevels = 4, size = 24 }) => {
    const center = size / 2;
    const radius = size / 2 - 2;

    // Normalize level
    const currentLevel = level;

    // If L-0 (Under Training) or Level 0
    if (currentLevel === 0) {
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={center} cy={center} r={radius} fill="none" stroke="black" strokeWidth="1" strokeDasharray="2,2" />
            </svg>
        );
    }

    const renderSlices = () => {
        if (!maxLevels || maxLevels === 0) return null;
        const slices = [];
        const anglePerSlice = 360 / maxLevels;
        let startAngle = -90;

        for (let i = 0; i < maxLevels; i++) {
            const endAngle = startAngle + anglePerSlice;
            const x1 = center + radius * Math.cos(startAngle * Math.PI / 180);
            const y1 = center + radius * Math.sin(startAngle * Math.PI / 180);
            const x2 = center + radius * Math.cos(endAngle * Math.PI / 180);
            const y2 = center + radius * Math.sin(endAngle * Math.PI / 180);

            const largeArcFlag = anglePerSlice > 180 ? 1 : 0;
            const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

            // Fill based on level (1-based index vs loop 0-based index)
            // Level 1 fills index 0. Level 2 fills 0, 1.
            const isFilled = i < currentLevel;

            slices.push(<path key={i} d={d} fill={isFilled ? "black" : "white"} stroke="black" strokeWidth="0.5" />);
            startAngle = endAngle;
        }
        return slices;
    };

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={center} cy={center} r={radius} fill="none" stroke="black" strokeWidth="1" />
            {renderSlices()}
        </svg>
    );
};

// Static content mapping for fallback
const DEFAULT_SKILL_CONFIG = {
    headerDefaults: {
        processInCharge: '',
        resultPerson: ''
    },
    docDefaults: {
        docNo: 'FRM-HR-007',
        revNo: '02',
        revDate: '06/10/17',
        dateOfIssue: '04-02-2018'
    },
    levels: {
        // Level 1
        0: {
            title: "OK in education training of operation contents but speed is no more than 74%",
            items: [
                {
                    id: 1, text: "Learnt the basic knowledge of process or not",
                    method: "Confirm the education record"
                },
                {
                    id: 2, text: "The understanding test result is satisfying the standard or not",
                    method: "Look in the understandard test result of education record"
                },
                {
                    id: 3, text: "Whether his operation in charge is no more than 74%",
                    method: "Measure the operation time"
                },
                {
                    id: 4, text: "The operation method is correct with the standard or not",
                    method: "Observe his operation by each product (type)"
                },
                {
                    id: 5, text: "Whether the operation is as operation-steps",
                    method: "Observe his operation by each product"
                },
                {
                    id: 6, text: "Whether he knows the inspection method, name of part, equipment, system",
                    method: "Check the method of inspection at begin of operation"
                },
                {
                    id: 7, text: "Whether he knows the evaluation standard in opoeration (OK or NG product)",
                    method: "Make question and hear his answer"
                }
            ]
        },
        // Level 2
        1: {
            title: "OK in education training of operation contents but speed is just 75-99%", items: [
                {
                    id: 1, text: "Whether he confirms the quality correctly?",
                    method: "Observe the operation"
                },
                {
                    id: 2, text: "Whether his operation in charge is at least 75%?",
                    method: "Measure the operation time"
                },
                {
                    id: 3, text: "Whether he can report the abnormality (Andon) correctly?",
                    method: "Judge by operation observance and question"
                },
                {
                    id: 4, text: "Whether he changes the steps of operation or operation method by himself?",
                    method: "Observe the operation"
                }]
        },
        // Level 3
        2: {
            title: "Able to operation by himself (Speed & operation as the standard is OK)", items: [
                {
                    id: 1, text: "Whether he can operate in the standard time?",
                    method: "Measure the operation time"
                },
                {
                    id: 2, text: "Whether he understand the judgement method & the treatment of the abnormality?",
                    method: "Make question and fill the answer"
                },
                {
                    id: 3, text: "Whether he understand the operation standard and obey as it. Can he give the an idea of improvement?",
                    method: "Observe the operation in over 2 cycles and make question to him about the improvement (Standard operation table)"
                },
                {
                    id: 4, text: "Measure the ok% produce during shift production",
                    method: "Check complete shift result and ok % 100"
                }
            ]
        },
        // Level 4
        3: {
            title: "Able to teach other operators",
            items: [
                {
                    id: 1, text: "Whether the result in understanding test was over the standard",
                    method: "Look in the understanding test result of education record"
                },
                {
                    id: 2, text: "Whether he understands the method of teaching",
                    method: "Make questions about the teaching method and confirmation when teaching"
                },
                {
                    id: 3, text: "Whether he is good at confirmation about the understanding after teaching or in teaching",
                    method: "Confirm the teaching method"
                },
                {
                    id: 4, text: "Can he change the teaching method belonging the level of operator (Understanding ability)?",
                    method: "Confirm the teaching method"
                },
                {
                    id: 5, text: "Whether he understand the operation standard and obey as it.",
                    method: "Confirm the teaching method and operation content (basing on the standard-operation-table)"
                },
                {
                    id: 6, text: "Whether he can operate in the standard time?",
                    method: "Measure the operation time"
                }]
        }

    }
};

const formatTodayDate = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd} - ${mm} - ${yyyy}`;
};

const getPeriodFromDate = (date = new Date()) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
};

const SkillMatrixCertificate = ({
    studentId,
    studentName,
    employeeCode,
    departmentId = 'GLOBAL',
    subSectionId,
    initialSheetId,
    onBackToList,
    readOnly = false
}) => {
    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [evalData, setEvalData] = useState({});
    const [headerData, setHeaderData] = useState({
        dateOfEvaluation: formatTodayDate(),
        trainee: studentName || '',
        employeeNo: employeeCode || '',
        processInCharge: '',
        resultPerson: ''
    });
    const [docData, setDocData] = useState({
        docNo: 'FRM-HR-007',
        revNo: '02',
        revDate: '06/10/17',
        dateOfIssue: '04-02-2018',
        approved: '',
        confirmed: '',
        planned: ''
    });
    const [opinion, setOpinion] = useState('');
    const [skillConfig, setSkillConfig] = useState(DEFAULT_SKILL_CONFIG);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [configJson, setConfigJson] = useState('');
    const [configRemark, setConfigRemark] = useState('');
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [traineeSuggestions, setTraineeSuggestions] = useState([]);
    const [showTraineeSuggestions, setShowTraineeSuggestions] = useState(false);
    const [isSearchingTrainee, setIsSearchingTrainee] = useState(false);

    // Multi-sheet State
    const [sheets, setSheets] = useState([]);
    const [selectedSheetId, setSelectedSheetId] = useState(initialSheetId || null);
    const [isActiveSheet, setIsActiveSheet] = useState(true);
    const isEditable = isActiveSheet && !readOnly;
    const [currentPeriod, setCurrentPeriod] = useState("");
    const [currentSheetIndex, setCurrentSheetIndex] = useState(1);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [activeStandardTooltip, setActiveStandardTooltip] = useState(null);

    useEffect(() => {
        if (activeStandardTooltip === null) return;
        const close = () => setActiveStandardTooltip(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [activeStandardTooltip]);

    const getStandardComment = (sIdx) => {
        const comments = [
            "Hearing the answers of operator by using standard operation documents, production operation standard, Measure the standard time and judge the result.",
            "Hearing the answers of operator by using standard operation documents, production operation standard. Measure the standard time, operation content and judge the result.",
            "Hearing the answers of operator by using standard operation documents, production operation standard. Meassure the standard time, operation content and judge the result.",
            "Trained in Education for expert of wire harness production process and able to give operator a training"
        ];
        return comments[sIdx] ?? '';
    };

    const authUser = useSelector(state => state.auth.user);

    const { data: activeConfigData } = useGetActiveConfigQuery();
    const activeConfig = activeConfigData?.data;
    const displayLevels = activeConfig?.levels || [];
    const maxLevels = displayLevels.length;

    // Load configs
    useEffect(() => {
        fetchConfig();
    }, [departmentId]);

    // Load sheets list
    useEffect(() => {
        fetchSheets();
    }, [studentId]);

    // Load specific sheet content when active sheet selection changes
    useEffect(() => {
        fetchSheetData();
    }, [selectedSheetId, studentId]);

    // Listen for initialSheetId prop changes
    useEffect(() => {
        if (initialSheetId) {
            setSelectedSheetId(initialSheetId);
        }
    }, [initialSheetId]);

    // Set employeeNo / name Suggestions
    useEffect(() => {
        const fetchStudentEmpId = async () => {
            if (!studentId) return;
            try {
                const userResponse = await axiosInstance.get(`/api/users/${studentId}`);
                if (userResponse.data.success && userResponse.data.data) {
                    const user = userResponse.data.data;
                    setHeaderData(prev => ({
                        ...prev,
                        trainee: studentName || prev.trainee,
                        employeeNo: user.empId || employeeCode || prev.employeeNo
                    }));
                } else {
                    setHeaderData(prev => ({
                        ...prev,
                        trainee: studentName || prev.trainee,
                        employeeNo: employeeCode || prev.employeeNo
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch student details:", err);
                setHeaderData(prev => ({
                    ...prev,
                    trainee: studentName || prev.trainee,
                    employeeNo: employeeCode || prev.employeeNo
                }));
            }
        };
        fetchStudentEmpId();
    }, [studentId, studentName, employeeCode]);

    useEffect(() => {
        if (authUser && !headerData.resultPerson) {
            setHeaderData(prev => ({
                ...prev,
                resultPerson: authUser.fullName || authUser.name || ''
            }));
        }
    }, [authUser, headerData.resultPerson]);

    useEffect(() => {
        if (authUser && !docData.planned) {
            setDocData(prev => ({
                ...prev,
                planned: authUser.fullName || authUser.name || ''
            }));
        }
    }, [authUser, docData.planned]);

    // Fetch Sheets List for operator
    const fetchSheets = async () => {
        if (!studentId) return;
        try {
            const response = await axiosInstance.get(`/api/skill-matrix/evaluation/${studentId}/sheets`);
            if (response.data.success) {
                const fetchedSheets = response.data.data || [];
                if (fetchedSheets.length === 0) {
                    // Auto create sheet index 1 if none exist
                    await handleCreateSheet(true);
                } else {
                    setSheets(fetchedSheets);
                    const active = fetchedSheets.find(s => s.isActive);
                    if (!selectedSheetId) {
                        if (active) {
                            setSelectedSheetId(active.id);
                        } else if (fetchedSheets.length > 0) {
                            setSelectedSheetId(fetchedSheets[0].id);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching evaluation sheets list:", error);
        }
    };

    // Fetch Sheet details
    const fetchSheetData = async () => {
        if (!studentId || !selectedSheetId) return;
        try {
            setLoading(true);

            // Default reset states
            const defaultHeader = {
                dateOfEvaluation: formatTodayDate(),
                trainee: studentName || '',
                employeeNo: employeeCode || '',
                processInCharge: '',
                resultPerson: authUser?.fullName || authUser?.name || ''
            };
            const defaultDoc = {
                docNo: 'FRM-HR-007',
                revNo: '02',
                revDate: '06/10/17',
                dateOfIssue: '04-02-2018',
                approved: '',
                confirmed: '',
                planned: authUser?.fullName || authUser?.name || ''
            };
            setHeaderData(defaultHeader);
            setDocData(defaultDoc);
            setEvalData({});
            setOpinion('');

            const response = await axiosInstance.get(`/api/skill-matrix/evaluation/sheet/${selectedSheetId}`);
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                setIsActiveSheet(data.isActive === true || data.isActive === 1 || data.isActive === '1');
                setCurrentPeriod(data.period);
                setCurrentSheetIndex(data.sheetIndex || 1);
                const fetchedHeader = data.headerData || {};
                const mergedHeader = { ...defaultHeader, ...fetchedHeader };
                setHeaderData(prev => ({
                    ...prev,
                    ...mergedHeader,
                    employeeNo: fetchedHeader.employeeNo || prev.employeeNo || employeeCode || '',
                    trainee: fetchedHeader.trainee || prev.trainee || studentName || ''
                }));

                let fetchedDocData = data.docData || defaultDoc;
                if (fetchedDocData.revNo && typeof fetchedDocData.revNo === 'string' && fetchedDocData.revNo.includes('.....')) {
                    const parts = fetchedDocData.revNo.split('.....');
                    fetchedDocData = {
                        ...fetchedDocData,
                        revNo: parts[0] || '02',
                        revDate: parts[1] || '06/10/17'
                    };
                } else if (!fetchedDocData.revDate) {
                    fetchedDocData = {
                        ...fetchedDocData,
                        revDate: '06/10/17'
                    };
                }
                setDocData(fetchedDocData);
                setEvalData(data.evalData || {});
                setOpinion(data.opinion || '');
            }
        } catch (error) {
            console.error("Error fetching sheet data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const response = await axiosInstance.get(`/api/skill-matrix/config/${departmentId}`);
            if (response.data.success && response.data.data.config) {
                const config = response.data.data.config;
                if (config.levels) {
                    setSkillConfig(config);
                    if (!headerData.processInCharge && config.headerDefaults) {
                        setHeaderData(prev => ({ ...prev, ...config.headerDefaults }));
                    }
                    if (!docData.approved && config.docDefaults) {
                        let configDocDefaults = { ...config.docDefaults };
                        if (configDocDefaults.revNo && typeof configDocDefaults.revNo === 'string' && configDocDefaults.revNo.includes('.....')) {
                            const parts = configDocDefaults.revNo.split('.....');
                            configDocDefaults.revNo = parts[0] || '02';
                            configDocDefaults.revDate = parts[1] || '06/10/17';
                        } else if (!configDocDefaults.revDate) {
                            configDocDefaults.revDate = '06/10/17';
                        }
                        setDocData(prev => ({ ...prev, ...configDocDefaults }));
                    }
                } else {
                    setSkillConfig({ ...DEFAULT_SKILL_CONFIG, levels: config });
                }
            }
        } catch (error) {
            console.error("Error fetching config:", error);
        }
    };

    const handleCreateSheet = async (autoCreate = false) => {
        try {
            setSaving(true);
            const response = await axiosInstance.post(`/api/skill-matrix/evaluation/${studentId}/sheet/create`, {
                departmentId
            });
            if (response.data.success && response.data.data) {
                const newSheet = response.data.data;
                if (!autoCreate) {
                    toast.success(`Sheet ${newSheet.sheetIndex} (${newSheet.period}) created successfully!`);
                }
                setSelectedSheetId(newSheet.id);
                // Reload list
                const listResp = await axiosInstance.get(`/api/skill-matrix/evaluation/${studentId}/sheets`);
                if (listResp.data.success) {
                    setSheets(listResp.data.data || []);
                }
            }
        } catch (error) {
            console.error("Error creating new sheet:", error);
            toast.error("Failed to create new evaluation sheet");
        } finally {
            setSaving(false);
            setCreateDialogOpen(false);
        }
    };

    const isEvaluationEmpty = () => {
        const levelKeys = [0, 1, 2, 3];
        for (const sIdx of levelKeys) {
            const levelContent = skillConfig.levels?.[sIdx];
            if (!levelContent || !levelContent.items) continue;

            for (let iIdx = 0; iIdx < levelContent.items.length; iIdx++) {
                const itemKey = `${sIdx}-${iIdx}`;
                const data = evalData[itemKey];
                if (data) {
                    const item = levelContent.items[iIdx];
                    const isSpeedCell = (
                        (sIdx === 0 && item.id === 3) ||
                        (sIdx === 1 && item.id === 2) ||
                        (sIdx === 2 && item.id === 1) ||
                        (sIdx === 3 && item.id === 6)
                    );

                    if (isSpeedCell) {
                        if (
                            (data.actualSec && String(data.actualSec).trim() !== '') ||
                            (data.targetSec && String(data.targetSec).trim() !== '') ||
                            (data.standard && data.standard.trim() !== '')
                        ) {
                            return false;
                        }
                    } else {
                        if (
                            (data.standardText && data.standardText.trim() !== '') ||
                            (data.standard && data.standard.trim() !== '')
                        ) {
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    };

    const handleSave = async (triggerEmail = false) => {
        if (!studentId || !selectedSheetId) return;

        if (isEvaluationEmpty()) {
            toast.error("Cannot save an empty sheet. Please fill at least one evaluation item.");
            return;
        }

        try {
            setSaving(true);
            const payload = {
                departmentId,
                subSectionId,
                headerData,
                docData,
                evalData,
                opinion,
                sendEmail: triggerEmail,
                period: currentPeriod
            };
            const response = await axiosInstance.put(`/api/skill-matrix/evaluation/sheet/${selectedSheetId}/save`, payload);
            toast.success(triggerEmail ? "Evaluation saved and email sent successfully" : "Evaluation saved successfully");
            if (response.data?.data?.levelUpgraded) {
                toast.success(`Level upgraded to ${response.data.data.newLevel}!`);
            }
            // Refresh sheets metadata
            const listResp = await axiosInstance.get(`/api/skill-matrix/evaluation/${studentId}/sheets`);
            if (listResp.data.success) {
                setSheets(listResp.data.data || []);
            }
        } catch (error) {
            console.error("Error saving evaluation:", error);
            toast.error("Failed to save evaluation");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const config = JSON.parse(configJson);
            await axiosInstance.post(`/api/skill-matrix/config/save`, {
                departmentId,
                config,
                remark: configRemark
            });
            setSkillConfig(config);
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
        try {
            const response = await axiosInstance.get(`/api/skill-matrix/config/history/${departmentId}`);
            if (response.data.success) {
                setHistory(response.data.data);
                setShowHistory(true);
            }
        } catch (error) {
            console.error("History fetch error:", error);
            toast.error("Failed to fetch history");
        }
    };

    const handleTraineeChange = async (value) => {
        setHeaderData(prev => ({ ...prev, trainee: value }));

        if (!value.trim() || value.length < 2) {
            setTraineeSuggestions([]);
            setShowTraineeSuggestions(false);
            return;
        }

        try {
            setIsSearchingTrainee(true);
            const response = await axiosInstance.get('/api/users/students', {
                params: {
                    search: value,
                    page: 1,
                    limit: 10,
                    includeTemporary: "true",
                    ojtApprovedToday: "true"
                }
            });
            const list = response.data?.data?.users || [];
            setTraineeSuggestions(list);
            setShowTraineeSuggestions(list.length > 0);
        } catch (err) {
            console.error("Failed to search trainees:", err);
        } finally {
            setIsSearchingTrainee(false);
        }
    };

    const handleSelectTrainee = (student) => {
        setHeaderData(prev => ({
            ...prev,
            trainee: student.fullName,
            employeeNo: student.empId || ''
        }));
        setTraineeSuggestions([]);
        setShowTraineeSuggestions(false);
    };

    const handleEvalChange = (levelIdx, itemIdx, field, value) => {
        setEvalData(prev => {
            const itemKey = `${levelIdx}-${itemIdx}`;
            const existing = prev[itemKey] || {};
            const updated = { ...existing, [field]: value };

            const isSpeedCell = (
                (levelIdx === 0 && itemIdx === 2) ||
                (levelIdx === 1 && itemIdx === 1) ||
                (levelIdx === 2 && itemIdx === 0) ||
                (levelIdx === 3 && itemIdx === 5)
            );

            if (isSpeedCell) {
                const act = parseFloat(field === 'actualSec' ? value : updated.actualSec);
                const tgt = parseFloat(field === 'targetSec' ? value : updated.targetSec);
                if (!isNaN(act) && !isNaN(tgt) && act > 0) {
                    const calculatedEff = Math.round((tgt / act) * 100);
                    updated.okVal = String(calculatedEff);
                    updated.ngVal = String(calculatedEff);

                    const minEff = displayLevels[levelIdx]?.minEfficiency;
                    if (minEff !== undefined && minEff !== null && minEff !== '') {
                        updated.standard = calculatedEff >= Number(minEff) ? 'OK' : 'NG';
                    }
                } else {
                    updated.okVal = '';
                    updated.ngVal = '';
                    updated.standard = '';
                }
            }

            return { ...prev, [itemKey]: updated };
        });
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

    return (
        <Card className="w-full max-w-4xl mx-auto bg-white shadow-none border-none text-black font-sans">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4 border-b-2 border-black mb-4">
                <div className="flex flex-col">
                    <CardTitle className="text-2xl font-bold uppercase">Skill Matrix Certificate</CardTitle>
                    <CardDescription className="text-black font-semibold">FURUKAWA MINDA ELECTRIC PVT. LTD. (Skill Check Sheet)</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
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
                            setConfigJson(JSON.stringify(skillConfig, null, 2));
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
                        onClick={() => exportToExcel("Skill Matrix Certificate Sheet", {
                            studentName,
                            employeeCode
                        })}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                    <Button
                        onClick={() => handleSave(false)}
                        disabled={saving || !isEditable}
                        className="bg-slate-700 hover:bg-slate-800 text-white gap-2 transition-all duration-200"
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Certificate
                    </Button>
                    <Button
                        onClick={() => handleSave(true)}
                        disabled={saving || !isEditable}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2 transition-all duration-200"
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Submit & Send Email
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Sheets History Pills Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4 text-xs no-print">
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                        <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">Pills:</span>
                        {sheets.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedSheetId(s.id)}
                                className={`px-3 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 ${String(selectedSheetId) === String(s.id)
                                    ? "bg-slate-800 text-white shadow-sm"
                                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                    }`}
                            >
                                <span>Sheet {s.sheetIndex} ({s.period})</span>
                                {s.isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {onBackToList && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-semibold px-3"
                                onClick={onBackToList}
                            >
                                Back to Sheets Table
                            </Button>
                        )}
                        <Button
                            onClick={() => setCreateDialogOpen(true)}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs px-3 gap-1 rounded"
                        >
                            + Create New Sheet
                        </Button>
                    </div>
                </div>

                {/* Banner if viewing read-only or inactive sheet */}
                {!isEditable && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg font-bold text-xs mb-4 text-center no-print">
                        {!isActiveSheet
                            ? `Viewing previous sheet — Sheet ${currentSheetIndex} (${currentPeriod}). This sheet is read-only.`
                            : "View only — editing is disabled for this sheet."}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Header Info Sections */}
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        {/* Left Info Table */}
                        <div className="w-full md:w-[35%] border-2 border-black">
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-2 font-bold bg-white text-center border-r border-black flex items-center justify-center text-xs">Date of evaluation</div>
                                <div className="w-[60%] p-2 text-center text-blue-600 font-bold bg-white">
                                    <input
                                        type="text"
                                        className="w-full text-center outline-none bg-transparent"
                                        value={headerData.dateOfEvaluation}
                                        onChange={e => setHeaderData({ ...headerData, dateOfEvaluation: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div >
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-2 font-bold bg-white text-center border-r border-black flex items-center justify-center text-xs">Trainee</div>
                                <div className="w-[60%] p-2 text-center text-blue-600 font-bold bg-white relative">
                                    <input
                                        type="text"
                                        className="w-full text-center outline-none bg-transparent"
                                        value={headerData.trainee}
                                        onChange={e => handleTraineeChange(e.target.value)}
                                        onBlur={() => setTimeout(() => setShowTraineeSuggestions(false), 200)}
                                        onFocus={() => { if (traineeSuggestions.length > 0) setShowTraineeSuggestions(true); }}
                                        placeholder="Type to search..."
                                        disabled={!isEditable}
                                    />
                                    {isSearchingTrainee && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                                            Searching...
                                        </div>
                                    )}
                                    {showTraineeSuggestions && traineeSuggestions.length > 0 && (
                                        <ul className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto z-50 text-left font-normal normal-case">
                                            {traineeSuggestions.map(student => (
                                                <li
                                                    key={student.id || student._id}
                                                    onMouseDown={() => handleSelectTrainee(student)}
                                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm flex flex-col"
                                                >
                                                    <span className="font-bold text-gray-800">{student.fullName}</span>
                                                    <span className="text-xs text-gray-500 font-mono">E.Code: {student.empId || '—'}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-2 font-bold bg-white text-center border-r border-black flex items-center justify-center text-xs">Employee No.</div>
                                <div className="w-[60%] p-2 text-center text-blue-600 font-bold bg-white">
                                    <input
                                        type="text"
                                        className="w-full text-center outline-none bg-transparent"
                                        value={headerData.employeeNo}
                                        onChange={e => setHeaderData({ ...headerData, employeeNo: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-2 font-bold bg-white text-center border-r border-black flex items-center justify-center text-xs">Process in charge</div>
                                <div className="w-[60%] p-2 text-center text-blue-600 font-bold bg-white">
                                    <input
                                        type="text"
                                        className="w-full text-center outline-none bg-transparent"
                                        value={headerData.processInCharge}
                                        onChange={e => setHeaderData({ ...headerData, processInCharge: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                            <div className="flex">
                                <div className="w-[40%] p-2 font-bold bg-white text-center border-r border-black flex items-center justify-center text-[10px]">Skill check Responsible person :</div>
                                <div className="w-[60%] p-2 text-center text-blue-600 font-bold bg-white flex items-center justify-center">
                                    <input
                                        type="text"
                                        className="w-full text-center outline-none text-xs bg-transparent"
                                        value={headerData.resultPerson}
                                        onChange={e => setHeaderData({ ...headerData, resultPerson: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                        </div >

                        {/* Middle Legend */}
                        <div className="w-full md:w-[40%] flex flex-col justify-center space-y-2 text-xs" >
                            <div className="font-bold mb-1">Skill level</div>
                            {
                                displayLevels.map((lvl, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <LevelIcon level={idx + 1} maxLevels={maxLevels} size={20} />
                                        <span>{idx + 1} : {lvl.description || lvl.name}</span>
                                    </div>
                                ))
                            }
                        </div >

                        {/* Right Doc Info */}
                        <div className="w-full md:w-[25%] border-2 border-black" >
                            <div className="flex border-b border-black" >
                                <div className="w-[40%] p-1 text-xs border-r border-black">Doc.No.</div>
                                <div className="w-[60%] p-1 text-xs">
                                    <input
                                        className="w-full outline-none bg-transparent"
                                        value={docData.docNo}
                                        onChange={e => setDocData({ ...docData, docNo: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div >
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-1 text-xs border-r border-black">Rev.No</div>
                                <div className="w-[60%] p-1 text-xs">
                                    <input
                                        className="w-full outline-none text-xs bg-transparent"
                                        value={docData.revNo || ''}
                                        onChange={e => setDocData({ ...docData, revNo: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-1 text-xs border-r border-black">Rev Date</div>
                                <div className="w-[60%] p-1 text-xs">
                                    <input
                                        className="w-full outline-none text-xs bg-transparent"
                                        value={docData.revDate || ''}
                                        onChange={e => setDocData({ ...docData, revDate: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                            <div className="flex border-b border-black">
                                <div className="w-[40%] p-1 text-xs border-r border-black">Date of issue</div>
                                <div className="w-[60%] p-1 text-xs">
                                    <input
                                        className="w-full outline-none bg-transparent"
                                        value={docData.dateOfIssue}
                                        onChange={e => setDocData({ ...docData, dateOfIssue: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                            <div className="flex border-b border-black text-center text-xs">
                                <div className="w-1/3 p-1 border-r border-black">Approved</div>
                                <div className="w-1/3 p-1 border-r border-black">Confirmed</div>
                                <div className="w-1/3 p-1">Planned</div>
                            </div>
                            <div className="flex h-12 text-center text-xs text-blue-600 font-bold">
                                <div className="w-1/3 p-1 border-r border-black flex items-center justify-center">
                                    {!isEditable ? (
                                        <span className="text-[10px] text-gray-500 font-semibold break-all leading-tight">
                                            {docData.approved || "—"}
                                        </span>
                                    ) : !docData.approved ? (
                                        <div className="flex flex-col gap-1 w-full justify-center px-1">
                                            <button
                                                onClick={() => {
                                                    const name = authUser?.fullName || authUser?.name || 'Admin';
                                                    setDocData(prev => ({ ...prev, approved: `Approved: ${name}` }));
                                                }}
                                                className="bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold py-0.5 px-1 rounded shadow-sm transition-colors duration-150"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const name = authUser?.fullName || authUser?.name || 'Admin';
                                                    setDocData(prev => ({ ...prev, approved: `Rejected: ${name}` }));
                                                }}
                                                className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold py-0.5 px-1 rounded shadow-sm transition-colors duration-150"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full text-center relative px-1">
                                            <span className={`text-[9px] font-extrabold leading-tight break-all ${docData.approved.startsWith('Approved') ? 'text-green-700' : 'text-red-700'}`}>
                                                {docData.approved}
                                            </span>
                                            <button
                                                onClick={() => setDocData(prev => ({ ...prev, approved: '' }))}
                                                className="text-[9px] text-gray-500 hover:text-gray-800 underline mt-0.5"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="w-1/3 p-1 border-r border-black flex items-center justify-center">
                                    {!isEditable ? (
                                        <span className="text-[10px] text-gray-500 font-semibold break-all leading-tight">
                                            {docData.confirmed || "—"}
                                        </span>
                                    ) : !docData.confirmed ? (
                                        <div className="flex flex-col gap-1 w-full justify-center px-1">
                                            <button
                                                onClick={() => {
                                                    const name = authUser?.fullName || authUser?.name || 'Admin';
                                                    setDocData(prev => ({ ...prev, confirmed: `Approved: ${name}` }));
                                                }}
                                                className="bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold py-0.5 px-1 rounded shadow-sm transition-colors duration-150"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const name = authUser?.fullName || authUser?.name || 'Admin';
                                                    setDocData(prev => ({ ...prev, confirmed: `Rejected: ${name}` }));
                                                }}
                                                className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold py-0.5 px-1 rounded shadow-sm transition-colors duration-150"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full text-center relative px-1">
                                            <span className={`text-[9px] font-extrabold leading-tight break-all ${docData.confirmed.startsWith('Approved') ? 'text-green-700' : 'text-red-700'}`}>
                                                {docData.confirmed}
                                            </span>
                                            <button
                                                onClick={() => setDocData(prev => ({ ...prev, confirmed: '' }))}
                                                className="text-[9px] text-gray-500 hover:text-gray-800 underline mt-0.5"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="w-1/3 p-1 flex items-center justify-center">
                                    <textarea
                                        className="w-full text-center outline-none text-xs resize-none bg-transparent leading-tight"
                                        rows={2}
                                        value={docData.planned || ''}
                                        onChange={e => setDocData({ ...docData, planned: e.target.value })}
                                        disabled={!isEditable}
                                    />
                                </div>
                            </div>
                        </div >
                    </div >

                    <div className="font-bold text-center mb-2">Checking items</div>
                    <div className="mb-2 text-right text-xs italic">
                        Hearing the answers of operator by using standard operation documents, production operation standard. Measure the standard time and judge the result.
                    </div>

                    {/* Main Table Sections */}
                    <div className="border-2 border-black text-xs overflow-x-auto">
                        <div className="min-w-[800px]">
                            {displayLevels.map((section, sIdx) => {
                                const levelContent = skillConfig.levels?.[sIdx] || { title: section.description || section.name, items: [] };
                                const items = levelContent.items || [];

                                return (
                                    <div key={sIdx} className="border-b last:border-b-0 border-black">
                                        {/* Section Title */}
                                        <div className="flex border-b border-black bg-gray-50/50 p-2 items-center gap-2">
                                            <LevelIcon level={sIdx + 1} maxLevels={maxLevels} size={24} />
                                            <span className="font-bold text-sm">{sIdx + 1} : {levelContent.title}</span>
                                        </div>

                                        {/* Table Header for this level */}
                                        <div className="flex font-bold text-center border-b border-black bg-gray-50">
                                            <div className="w-[50px] p-2 border-r border-black flex items-center justify-center">No</div>
                                            <div className="flex-1 p-2 border-r border-black flex items-center justify-center">Evaluation items</div>
                                            <div className="w-[250px] p-2 border-r border-black flex items-center justify-center">Confirmation method<br />(Evaluation method)</div>
                                            <div
                                                className="w-[110px] p-2 border-r border-black flex items-center justify-center gap-1 relative cursor-pointer select-none hover:bg-gray-100"
                                                onClick={e => { e.stopPropagation(); setActiveStandardTooltip(prev => prev === sIdx ? null : sIdx); }}
                                                onMouseEnter={() => setActiveStandardTooltip(sIdx)}
                                                onMouseLeave={() => setActiveStandardTooltip(prev => prev === sIdx ? null : prev)}
                                            >
                                                Standard
                                                <Info size={12} className="text-gray-500 flex-shrink-0" />
                                                {activeStandardTooltip === sIdx && (
                                                    <div
                                                        className="absolute top-full left-0 z-50 mt-1 w-64 rounded-md bg-slate-800 text-white text-[11px] leading-snug p-2.5 shadow-lg"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {getStandardComment(sIdx)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-[120px] p-2 border-r border-black flex items-center justify-center">Evaluation</div>
                                            <div className="w-[150px] p-2 flex items-center justify-center text-center">Content that must be re-educated</div>
                                        </div>

                                        {/* Items */}
                                        {items.length > 0 ? items.map((item, iIdx) => {
                                            const itemKey = `${sIdx}-${iIdx}`;
                                            const currentData = evalData[itemKey] || {};
                                            const isSpeedCell = (
                                                (sIdx === 0 && item.id === 3) ||
                                                (sIdx === 1 && item.id === 2) ||
                                                (sIdx === 2 && item.id === 1) ||
                                                (sIdx === 3 && item.id === 6)
                                            );
                                            return (
                                                <div key={iIdx} className="flex border-b border-black last:border-b-0">
                                                    <div className="w-[50px] p-2 border-r border-black text-center flex items-center justify-center">{item.id || iIdx + 1}</div>
                                                    <div className="flex-1 p-2 border-r border-black whitespace-pre-wrap">{item.text}</div>
                                                    <div className="w-[250px] p-2 border-r border-black whitespace-pre-wrap">
                                                        {item.method}
                                                        {isSpeedCell &&
                                                          displayLevels[sIdx]?.minEfficiency !== undefined &&
                                                          displayLevels[sIdx]?.minEfficiency !== null &&
                                                          displayLevels[sIdx]?.minEfficiency !== '' && (
                                                            <div className="mt-1">
                                                                <Badge variant="info" className="whitespace-nowrap">
                                                                    Target Eff: {displayLevels[sIdx].minEfficiency}% - {displayLevels[sIdx].maxEfficiency}%
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-[110px] p-2 border-r border-black flex items-center justify-center bg-white">
                                                        {isSpeedCell ? (
                                                            <div className="flex flex-col gap-1 w-full text-xs">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-600 text-[10px]">Actual (Sec):</span>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full border border-gray-300 rounded px-1 py-0.5 outline-none bg-transparent text-center hover:border-gray-400 focus:border-gray-500 transition-all duration-150"
                                                                        placeholder="..."
                                                                        value={currentData.actualSec || ''}
                                                                        onChange={e => handleEvalChange(sIdx, iIdx, 'actualSec', e.target.value)}
                                                                        disabled={!isEditable}
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-600 text-[10px]">Target (Sec):</span>
                                                                    <input
                                                                        type="text"
                                                                        className="w-full border border-gray-300 rounded px-1 py-0.5 outline-none bg-transparent text-center hover:border-gray-400 focus:border-gray-500 transition-all duration-150"
                                                                        placeholder="..."
                                                                        value={currentData.targetSec || ''}
                                                                        onChange={e => handleEvalChange(sIdx, iIdx, 'targetSec', e.target.value)}
                                                                        disabled={!isEditable}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <textarea
                                                                className="w-full h-full min-h-[60px] resize-none outline-none bg-transparent text-xs p-1 text-center border border-transparent hover:border-gray-200 focus:border-gray-300 rounded transition-all duration-150"
                                                                rows={3}
                                                                placeholder="..."
                                                                value={currentData.standardText || ''}
                                                                onChange={e => handleEvalChange(sIdx, iIdx, 'standardText', e.target.value)}
                                                                disabled={!isEditable}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="w-[120px] p-2 border-r border-black flex flex-col items-center justify-center gap-2 bg-white">
                                                        <select
                                                            className={`w-full border border-gray-300 rounded p-1 outline-none text-xs bg-white text-black text-center font-semibold focus:border-gray-400 ${isSpeedCell ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
                                                            value={currentData.standard || ''}
                                                            onChange={e => handleEvalChange(sIdx, iIdx, 'standard', e.target.value)}
                                                            disabled={!isEditable || isSpeedCell}
                                                            title={isSpeedCell ? 'Auto-calculated from efficiency, cannot be changed manually' : undefined}
                                                        >
                                                            <option value="">Select</option>
                                                            <option value="OK">OK</option>
                                                            <option value="NG">NG</option>
                                                        </select>
                                                        {(() => {
                                                            if (!isSpeedCell || !currentData.standard) return null;
                                                            const act = parseFloat(currentData.actualSec);
                                                            const tgt = parseFloat(currentData.targetSec);
                                                            if (isNaN(act) || isNaN(tgt) || act <= 0) return null;
                                                            const eff = Math.round((tgt / act) * 100);
                                                            return (
                                                                <div className="text-[11px] font-bold text-blue-600 mt-1">
                                                                    Eff: {eff}%
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="w-[150px] p-2 bg-white">
                                                        <textarea
                                                            className="w-full h-full resize-none outline-none bg-transparent"
                                                            rows={3}
                                                            value={currentData.reEducation || ''}
                                                            onChange={e => handleEvalChange(sIdx, iIdx, 'reEducation', e.target.value)}
                                                            disabled={!isEditable}
                                                        ></textarea>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="p-4 text-center text-gray-400 italic">No evaluation items defined for this level</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer Opinion */}
                    <div className="mt-4 border-2 border-black rounded-lg p-2 h-32 relative bg-gray-50/30">
                        <div className="absolute top-2 left-2 font-bold text-sm">Opinion of the checking responsible person:</div>
                        <textarea
                            className="w-full h-full pt-8 p-2 outline-none resize-none bg-transparent"
                            value={opinion}
                            onChange={e => setOpinion(e.target.value)}
                            placeholder="Enter final opinion and comments..."
                            disabled={!isEditable}
                        ></textarea>
                    </div>
                </div >
            </CardContent >

            {/* Confirmation Dialog for Creating New Sheet */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Create New Sheet</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-sm text-gray-700">
                        Create a new certificate evaluation sheet for <strong>{getPeriodFromDate()}</strong>?
                        The current sheet will become inactive and read-only.
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold" size="sm" onClick={() => handleCreateSheet(false)} disabled={saving}>
                            {saving ? "Creating..." : "Confirm & Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Skill Matrix Layout Configuration</DialogTitle>
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
                            <input
                                type="text"
                                className="w-full p-2 border rounded-md text-sm outline-none"
                                placeholder="Reason for change..."
                                value={configRemark}
                                onChange={(e) => setConfigRemark(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingLayout(false)}>Cancel</Button>
                        <Button onClick={handleSaveConfig} disabled={saving || !configRemark.trim()} className="bg-blue-600 hover:bg-blue-700">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
                <DialogContent className="max-w-[800px] max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Layout Change History</DialogTitle>
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
                                            setConfigJson(h.config);
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
        </Card >
    );
};

export default SkillMatrixCertificate;
