import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Feedback = () => {
    // 16 Days
    const days = Array.from({ length: 16 }, (_, i) => `Day-${i + 1}`);

    const questions = [
        { id: 1, topic: "Have you got On Job training from Mentor?", judgement: '(Y/N)', judgementNote: 'If "N" please specify below' },
        { id: 2, topic: "Has today training content helped you in your work?", judgement: '(Y/N)', judgementNote: 'If "N" please specify below' },
        { id: 3, topic: "Have you face any misbehaviour on work station by any person?", judgement: '(Y/N)', judgementNote: 'If "Y" please specify below' },
        { id: 4, topic: "Has mentor given solution of your query/problem?", judgement: '(Y/N)', judgementNote: 'If "N" please specify below' },
        { id: 5, topic: "Are required resources available on work station?", judgement: '(Y/N)', judgementNote: 'If "Y" please specify below' },
        { id: 6, topic: "Other Issue/problem :-\nPersonal\nCompany", judgement: '(Y/N)', judgementNote: 'If "Y" please specify below' },
        { id: 7, topic: "Suggestion if any", judgement: '(Y/N)', judgementNote: 'If "Y" please specify below' },
    ];

    // Top table data: { [questionId]: { [dayIndex]: "Y" | "N" } }
    const [topTableData, setTopTableData] = useState({});

    // Bottom table data: Array of 16 objects (0-15) for each day
    // Structure: { associatesFeedback: '', mentorAction: '', status1: '', areaEngineer: '', status2: '' }
    const [dailyLogs, setDailyLogs] = useState(
        Array(16).fill(null).map(() => ({
            associatesFeedback: '',
            mentorAction: '',
            status1: '',
            areaEngineer: '',
            status2: ''
        }))
    );

    const handleTopCellChange = (qId, dayIndex, value) => {
        setTopTableData(prev => ({
            ...prev,
            [qId]: { ...prev[qId], [dayIndex]: value }
        }));
    };

    const handleDailyLogChange = (dayIndex, field, value) => {
        setDailyLogs(prev => {
            const newLogs = [...prev];
            newLogs[dayIndex] = { ...newLogs[dayIndex], [field]: value };
            return newLogs;
        });
    };

    const handleSubmit = () => {
        console.log("Submitting:", { topTableData, dailyLogs });
        toast.success("Feedback saved successfully!");
    };

    const renderRadioCell = (qId, dayIndex) => {
        const value = topTableData[qId]?.[dayIndex];
        return (
            <div className="flex flex-col items-center justify-center space-y-1 h-full min-h-[40px]">
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name={`q${qId}-d${dayIndex}`}
                        checked={value === 'Y'}
                        onChange={() => handleTopCellChange(qId, dayIndex, 'Y')}
                        className="w-3 h-3 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold">Y</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name={`q${qId}-d${dayIndex}`}
                        checked={value === 'N'}
                        onChange={() => handleTopCellChange(qId, dayIndex, 'N')}
                        className="w-3 h-3 cursor-pointer"
                    />
                    <span className="text-[10px] font-bold">N</span>
                </label>
            </div>
        );
    };

    return (
        <Card className="max-w-full overflow-hidden bg-white shadow-md">
            <CardContent className="p-4 overflow-x-auto space-y-8">

                {/* SECTION 1: TOP TABLE */}
                <div className="min-w-[1500px]">
                    <div className="bg-yellow-300 text-center py-2 border-2 border-black border-b-0">
                        <h1 className="text-xl font-bold uppercase text-black">Mentees Feed Back Monitoring sheet</h1>
                    </div>
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-white text-black">
                                <th className="border border-black p-2 w-96 text-left">Topic</th>
                                <th className="border border-black p-2 w-48 text-left">Judgement</th>
                                {days.map((day, index) => (
                                    <th key={index} className="border border-black p-1 text-center w-16 min-w-[60px] whitespace-nowrap">
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
                                        <td key={index} className="border border-black p-1 text-center bg-white hover:bg-gray-50">
                                            {renderRadioCell(q.id, index)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* SECTION 2: BOTTOM TABLE (Detailed Logs) */}
                <div className="min-w-[1500px]">
                    <table className="w-full border-collapse border border-black text-xs">
                        <thead>
                            <tr className="bg-white text-black h-16">
                                {/* Left Side Headers */}
                                <th className="border border-black p-1 w-12 text-center">Day</th>
                                <th className="border border-black p-1 text-center w-48">Associates Feed Back<br /><span className="font-normal">(In case 'N' in above cat.)</span></th>
                                <th className="border border-black p-1 text-center w-48">Mentor Action Plan</th>
                                <th className="border border-black p-1 text-center w-16">Status</th>
                                <th className="border border-black p-1 text-center w-32">Area Engineer/In-charge Verification</th>
                                <th className="border border-black p-1 text-center w-16">Status</th>

                                {/* Gap/Separator Column */}
                                <th className="border text-center bg-gray-100 w-4"></th>

                                {/* Right Side Headers */}
                                <th className="border border-black p-1 w-12 text-center">Day</th>
                                <th className="border border-black p-1 text-center w-48">Associates Feed Back<br /><span className="font-normal">(In case 'N' in above cat.)</span></th>
                                <th className="border border-black p-1 text-center w-48">Mentor Action Plan</th>
                                <th className="border border-black p-1 text-center w-16">Status</th>
                                <th className="border border-black p-1 text-center w-32">Area Engineer/In-charge Verification</th>
                                <th className="border border-black p-1 text-center w-16">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => {
                                const leftIdx = i; // 0 to 7
                                const rightIdx = i + 8; // 8 to 15

                                const renderRowCells = (idx) => (
                                    <>
                                        {/* Day Label */}
                                        <td className="border border-black p-2 text-center font-bold">
                                            Day-{idx + 1}
                                        </td>

                                        {/* Associates Info */}
                                        <td className="border border-black p-0">
                                            <textarea
                                                className="w-full h-16 p-1 resize-none outline-none focus:bg-blue-50 text-center"
                                                placeholder={idx === 0 ? "No Feedback" : ""}
                                                value={dailyLogs[idx].associatesFeedback}
                                                onChange={(e) => handleDailyLogChange(idx, 'associatesFeedback', e.target.value)}
                                            />
                                        </td>

                                        {/* Mentor Action */}
                                        <td className="border border-black p-0">
                                            <textarea
                                                className="w-full h-16 p-1 resize-none outline-none focus:bg-blue-50 text-center"
                                                placeholder={idx === 0 ? "No Need" : ""}
                                                value={dailyLogs[idx].mentorAction}
                                                onChange={(e) => handleDailyLogChange(idx, 'mentorAction', e.target.value)}
                                            />
                                        </td>

                                        {/* Status 1 */}
                                        <td className="border border-black p-0">
                                            <input
                                                type="text"
                                                className="w-full h-full text-center outline-none focus:bg-blue-50"
                                                placeholder={idx === 0 ? "OK" : ""}
                                                value={dailyLogs[idx].status1}
                                                onChange={(e) => handleDailyLogChange(idx, 'status1', e.target.value)}
                                            />
                                        </td>

                                        {/* Area Engineer */}
                                        <td className="border border-black p-0">
                                            <textarea
                                                className="w-full h-16 p-1 resize-none outline-none focus:bg-blue-50 text-center pt-5"
                                                placeholder={idx === 0 ? "Pravin" : ""}
                                                value={dailyLogs[idx].areaEngineer}
                                                onChange={(e) => handleDailyLogChange(idx, 'areaEngineer', e.target.value)}
                                            />
                                        </td>

                                        {/* Status 2 */}
                                        <td className="border border-black p-0">
                                            <input
                                                type="text"
                                                className="w-full h-full text-center outline-none focus:bg-blue-50"
                                                placeholder={idx === 0 ? "OK" : ""}
                                                value={dailyLogs[idx].status2}
                                                onChange={(e) => handleDailyLogChange(idx, 'status2', e.target.value)}
                                            />
                                        </td>
                                    </>
                                );

                                return (
                                    <tr key={i} className="hover:bg-gray-50">
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
            <div className="p-4 flex justify-end">
                <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Save Feedback
                </Button>
            </div>
        </Card>
    );
};

export default Feedback;
