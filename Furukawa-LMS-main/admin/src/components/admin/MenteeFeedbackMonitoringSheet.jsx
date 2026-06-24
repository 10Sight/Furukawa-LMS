import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { useSelector } from 'react-redux';
import { Loader2 } from "lucide-react";

const MenteeFeedbackMonitoringSheet = forwardRef(({ studentId, readOnly = false }, ref) => {
    const authUser = useSelector(state => state.auth.user);
    const [loading, setLoading] = useState(false);

    // 16 Days
    const days = useMemo(() => Array.from({ length: 16 }, (_, i) => `Day-${i + 1}`), []);

    const questions = [
        { id: 1, topic: "Have you got On Job training from Mentor?", judgement: '(Yes/No)', judgementNote: 'If "No" please specify below' },
        { id: 2, topic: "Has today training content helped you in your work?", judgement: '(Yes/No)', judgementNote: 'If "No" please specify below' },
        { id: 3, topic: "Have you face any misbehaviour on work station by any person?", judgement: '(Yes/No)', judgementNote: 'If "Yes" please specify below' },
        { id: 4, topic: "Has mentor given solution of your query/problem?", judgement: '(Yes/No)', judgementNote: 'If "No" please specify below' },
        { id: 5, topic: "Are required resources available on work station?", judgement: '(Yes/No)', judgementNote: 'If "Yes" please specify below' },
        { id: 6, topic: "Other Issue/problem :-\nPersonal\nCompany", judgement: '(Yes/No)', judgementNote: 'If "Yes" please specify below' },
        { id: 7, topic: "Suggestion if any", judgement: '(Yes/No)', judgementNote: 'If "Yes" please specify below' },
    ];

    // Top table data: { [questionId]: { [dayIndex]: "Y" | "N" } }
    const [topTableData, setTopTableData] = useState({});
    const [originalTopTableData, setOriginalTopTableData] = useState({});

    // Bottom table data: Array of 16 objects (0-15) for each day
    const [dailyLogs, setDailyLogs] = useState(
        Array(16).fill(null).map(() => ({
            associatesFeedback: '',
            mentorAction: '',
            status1: '',
            areaEngineer: '',
            status2: ''
        }))
    );
    const [originalDailyLogs, setOriginalDailyLogs] = useState(
        Array(16).fill(null).map(() => ({
            associatesFeedback: '',
            mentorAction: '',
            status1: '',
            areaEngineer: '',
            status2: ''
        }))
    );

    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const canEditSubmitted = isAdmin || authUser?.customRole?.permissions?.includes('mentee_feedback:edit_submitted');

    const isTopCellLocked = (qId, dayIndex) => {
        if (readOnly) return true;
        if (canEditSubmitted) return false;
        const val = originalTopTableData[qId]?.[dayIndex];
        return val !== undefined && val !== null && val.toString().trim() !== "";
    };

    const isDailyLogFieldLocked = (dayIndex, field) => {
        if (readOnly) return true;
        if (canEditSubmitted) return false;
        const val = originalDailyLogs[dayIndex]?.[field];
        return val !== undefined && val !== null && val.toString().trim() !== "";
    };

    const didAdminChangeSavedValues = () => {
        for (const qId of Object.keys(originalTopTableData)) {
            const originalDays = originalTopTableData[qId] || {};
            const currentDays = topTableData[qId] || {};
            for (const dayIndex of Object.keys(originalDays)) {
                const originalVal = originalDays[dayIndex];
                if (originalVal !== undefined && originalVal !== null && originalVal.toString().trim() !== "") {
                    const currentVal = currentDays[dayIndex];
                    if (String(originalVal).trim() !== String(currentVal || "").trim()) {
                        return true;
                    }
                }
            }
        }
        for (let dayIndex = 0; dayIndex < originalDailyLogs.length; dayIndex++) {
            const originalLog = originalDailyLogs[dayIndex] || {};
            const currentLog = dailyLogs[dayIndex] || {};
            const fields = ['associatesFeedback', 'mentorAction', 'status1', 'areaEngineer', 'status2'];
            for (const field of fields) {
                const originalVal = originalLog[field];
                if (originalVal !== undefined && originalVal !== null && originalVal.toString().trim() !== "") {
                    const currentVal = currentLog[field];
                    if (String(originalVal).trim() !== String(currentVal || "").trim()) {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!studentId) {
                setTopTableData({});
                setOriginalTopTableData({});
                setDailyLogs(Array(16).fill(null).map(() => ({
                    associatesFeedback: '',
                    mentorAction: '',
                    status1: '',
                    areaEngineer: '',
                    status2: ''
                })));
                setOriginalDailyLogs(Array(16).fill(null).map(() => ({
                    associatesFeedback: '',
                    mentorAction: '',
                    status1: '',
                    areaEngineer: '',
                    status2: ''
                })));
                return;
            }
            setLoading(true);
            try {
                const res = await axiosInstance.get(`/api/mentee-feedback/${studentId}`);
                if (res.data.success && !res.data.data.isNew) {
                    const loadedTop = res.data.data.topTableData || {};
                    const loadedLogs = res.data.data.dailyLogs || Array(16).fill(null).map(() => ({
                        associatesFeedback: '',
                        mentorAction: '',
                        status1: '',
                        areaEngineer: '',
                        status2: ''
                    }));
                    setTopTableData(loadedTop);
                    setOriginalTopTableData(JSON.parse(JSON.stringify(loadedTop)));
                    setDailyLogs(loadedLogs);
                    setOriginalDailyLogs(JSON.parse(JSON.stringify(loadedLogs)));
                } else {
                    setTopTableData({});
                    setOriginalTopTableData({});
                    setDailyLogs(Array(16).fill(null).map(() => ({
                        associatesFeedback: '',
                        mentorAction: '',
                        status1: '',
                        areaEngineer: '',
                        status2: ''
                    })));
                    setOriginalDailyLogs(Array(16).fill(null).map(() => ({
                        associatesFeedback: '',
                        mentorAction: '',
                        status1: '',
                        areaEngineer: '',
                        status2: ''
                    })));
                }
            } catch (err) {
                console.error("Failed to fetch mentee feedback:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [studentId]);

    const handleTopCellChange = (qId, dayIndex, value) => {
        if (readOnly) return;
        setTopTableData(prev => ({
            ...prev,
            [qId]: { ...prev[qId], [dayIndex]: value }
        }));

        // Auto-fill area engineer if empty and a value is selected
        if (value && !dailyLogs[dayIndex].areaEngineer) {
            handleDailyLogChange(dayIndex, 'areaEngineer', authUser?.fullName || authUser?.name || "");
        }
    };

    const handleDailyLogChange = (dayIndex, field, value) => {
        if (readOnly) return;
        setDailyLogs(prev => {
            const newLogs = [...prev];
            const updatedLog = { ...newLogs[dayIndex], [field]: value };
            
            // Auto-fill area engineer name if any other field in the row is being filled and areaEngineer is empty
            if (field !== 'areaEngineer' && value && !updatedLog.areaEngineer) {
                updatedLog.areaEngineer = authUser?.fullName || authUser?.name || "";
            }
            
            newLogs[dayIndex] = updatedLog;
            return newLogs;
        });
    };

    // Exposed to parent via ref — saves feedback data without sending email
    const saveFeedback = async () => {
        if (!studentId) return false;
        try {
            const res = await axiosInstance.post(`/api/mentee-feedback/${studentId}`, {
                topTableData,
                dailyLogs,
                status: "Submitted"
            });
            if (res.data.success) {
                setOriginalTopTableData(JSON.parse(JSON.stringify(topTableData)));
                setOriginalDailyLogs(JSON.parse(JSON.stringify(dailyLogs)));
                return true;
            }
            return false;
        } catch (err) {
            console.error("Failed to save mentee feedback:", err);
            return false;
        }
    };

    useImperativeHandle(ref, () => ({
        saveFeedback,
        didAdminChangeSavedValues
    }));

    const renderDropdownCell = (qId, dayIndex) => {
        const value = topTableData[qId]?.[dayIndex] || "";
        const isLocked = isTopCellLocked(qId, dayIndex);
        return (
            <select
                disabled={readOnly || isLocked}
                value={value}
                onChange={(e) => handleTopCellChange(qId, dayIndex, e.target.value)}
                className={`w-full h-8 text-xs font-bold border-none bg-transparent text-center focus:ring-0 appearance-none ${readOnly || isLocked ? "cursor-default text-gray-500" : "cursor-pointer hover:bg-slate-100 rounded"}`}
            >
                <option value="">-</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
            </select>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <Card className="w-full bg-white shadow-md border-black border-t-4 mt-8">
            <CardContent className="p-0 space-y-8">

                {/* SECTION 1: TOP TABLE */}
                <div className="min-w-max p-4 text-sm text-black">
                    <div className="bg-yellow-300 text-center py-2 border-2 border-black border-b-0">
                        <h1 className="text-xl font-bold uppercase text-black">Mentees Feed Back Monitoring sheet</h1>
                    </div>
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-white text-black">
                                <th className="border border-black p-2 w-96 text-left font-bold">Topic</th>
                                <th className="border border-black p-2 w-48 text-left font-bold">Judgement</th>
                                {days.map((day, index) => (
                                    <th key={index} className="border border-black p-1 text-center w-16 min-w-[60px] whitespace-nowrap font-bold">
                                        {day}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {questions.map((q) => (
                                <tr key={q.id}>
                                    <td className="border border-black p-2 font-medium whitespace-pre-line">
                                        {q.topic}
                                    </td>
                                    <td className="border border-black p-2 text-xs">
                                        <div className="font-bold">{q.judgement}</div>
                                        <div className="text-gray-600 italic">{q.judgementNote}</div>
                                    </td>
                                    {days.map((_, index) => (
                                        <td key={index} className="border border-black p-0 text-center bg-white hover:bg-gray-50">
                                            {renderDropdownCell(q.id, index)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* SECTION 2: BOTTOM TABLE (Detailed Logs) */}
                <div className="min-w-max p-4 text-xs text-black">
                    <table className="w-full border-collapse border border-black text-xs">
                        <thead>
                            <tr className="bg-white text-black h-16 uppercase">
                                {/* Left Side Headers */}
                                <th className="border border-black p-1 w-12 text-center font-bold">Day</th>
                                <th className="border border-black p-1 text-center w-48 font-bold">Associates Feed Back<br /><span className="font-normal normal-case">(In case 'N' in above cat.)</span></th>
                                <th className="border border-black p-1 text-center w-48 font-bold">Mentor Action Plan</th>
                                <th className="border border-black p-1 text-center w-16 font-bold">Status</th>
                                <th className="border border-black p-1 text-center w-32 font-bold">Area Engineer/In-charge Verification</th>
                                <th className="border border-black p-1 text-center w-16 font-bold">Status</th>

                                {/* Gap/Separator Column */}
                                <th className="border text-center bg-gray-100 w-4"></th>

                                {/* Right Side Headers */}
                                <th className="border border-black p-1 w-12 text-center font-bold">Day</th>
                                <th className="border border-black p-1 text-center w-48 font-bold">Associates Feed Back<br /><span className="font-normal normal-case">(In case 'N' in above cat.)</span></th>
                                <th className="border border-black p-1 text-center w-48 font-bold">Mentor Action Plan</th>
                                <th className="border border-black p-1 text-center w-16 font-bold">Status</th>
                                <th className="border border-black p-1 text-center w-32 font-bold">Area Engineer/In-charge Verification</th>
                                <th className="border border-black p-1 text-center w-16 font-bold">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => {
                                const leftIdx = i; // 0 to 7
                                const rightIdx = i + 8; // 8 to 15

                                const renderRowCells = (idx) => (
                                    <>
                                        {/* Day Label */}
                                        <td className="border border-black p-2 text-center font-bold bg-slate-50">
                                            Day-{idx + 1}
                                        </td>

                                        {/* Associates Info */}
                                        <td className="border border-black p-0">
                                            <textarea
                                                readOnly={readOnly || isDailyLogFieldLocked(idx, 'associatesFeedback')}
                                                className="w-full h-16 p-1 resize-none outline-none focus:bg-blue-50 text-center"
                                                value={dailyLogs[idx].associatesFeedback}
                                                onChange={(e) => handleDailyLogChange(idx, 'associatesFeedback', e.target.value)}
                                            />
                                        </td>

                                        {/* Mentor Action */}
                                        <td className="border border-black p-0">
                                            <textarea
                                                readOnly={readOnly || isDailyLogFieldLocked(idx, 'mentorAction')}
                                                className="w-full h-16 p-1 resize-none outline-none focus:bg-blue-50 text-center"
                                                value={dailyLogs[idx].mentorAction}
                                                onChange={(e) => handleDailyLogChange(idx, 'mentorAction', e.target.value)}
                                            />
                                        </td>

                                        {/* Status 1 */}
                                        <td className="border border-black p-0">
                                            <select
                                                disabled={readOnly || isDailyLogFieldLocked(idx, 'status1')}
                                                className="w-full h-16 text-center outline-none bg-transparent cursor-pointer hover:bg-blue-50"
                                                value={dailyLogs[idx].status1 || ""}
                                                onChange={(e) => handleDailyLogChange(idx, 'status1', e.target.value)}
                                            >
                                                <option value="">Select</option>
                                                <option value="Open">Open</option>
                                                <option value="Close">Close</option>
                                                <option value="None">None</option>
                                            </select>
                                        </td>

                                        {/* Area Engineer */}
                                        <td className="border border-black p-0">
                                            <textarea
                                                readOnly={true}
                                                className="w-full h-16 p-1 resize-none outline-none focus:bg-blue-50 text-center bg-gray-50/30 font-bold text-blue-900"
                                                value={dailyLogs[idx].areaEngineer}
                                                placeholder="Auto-filled"
                                            />
                                        </td>

                                        {/* Status 2 */}
                                        <td className="border border-black p-0">
                                            <select
                                                disabled={readOnly || isDailyLogFieldLocked(idx, 'status2')}
                                                className="w-full h-16 text-center outline-none bg-transparent cursor-pointer hover:bg-blue-50"
                                                value={dailyLogs[idx].status2 || ""}
                                                onChange={(e) => handleDailyLogChange(idx, 'status2', e.target.value)}
                                            >
                                                <option value="">Select</option>
                                                <option value="Open">Open</option>
                                                <option value="Close">Close</option>
                                                <option value="None">None</option>
                                            </select>
                                        </td>
                                    </>
                                );

                                return (
                                    <tr key={i} className="hover:bg-gray-50 uppercase font-semibold">
                                        {/* Left Side (Day 1-8) */}
                                        {renderRowCells(leftIdx)}

                                        {/* Gap */}
                                        <td className="bg-gray-200 border-none"></td>

                                        {/* Right Side (Day 9-16) */}
                                        {renderRowCells(rightIdx)}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

            </CardContent>
        </Card>
    );
});

MenteeFeedbackMonitoringSheet.displayName = 'MenteeFeedbackMonitoringSheet';

export default MenteeFeedbackMonitoringSheet;
