import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CheckCircle, Save } from "lucide-react";
import { toast } from "sonner";

// API Hooks
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetLinesByDepartmentQuery } from '@/Redux/AllApi/LineApi';
import { useGetMachinesByLineQuery } from '@/Redux/AllApi/MachineApi';

const AddQuestionPaper = () => {
    // --- State ---
    const [paperName, setPaperName] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState("");
    const [selectedLine, setSelectedLine] = useState("");
    const [selectedMachine, setSelectedMachine] = useState("");

    const [questions, setQuestions] = useState([
        { id: Date.now(), text: "", options: ["", "", "", ""], correctOptionIndex: null }
    ]);

    // --- Data Fetching ---
    const { data: globalDepartments } = useGetAllDepartmentsQuery();
    const { data: linesData } = useGetLinesByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
    const { data: machinesData } = useGetMachinesByLineQuery(selectedLine, { skip: !selectedLine });

    // --- Handlers ---

    // Question Management
    const addQuestion = () => {
        setQuestions([
            ...questions,
            { id: Date.now(), text: "", options: ["", "", "", ""], correctOptionIndex: null }
        ]);
    };

    const removeQuestion = (id) => {
        if (questions.length === 1) {
            toast.error("At least one question is required.");
            return;
        }
        setQuestions(questions.filter(q => q.id !== id));
    };

    const updateQuestionText = (id, text) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));
    };

    // Option Management
    const updateOptionText = (qId, optionIndex, text) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                const newOptions = [...q.options];
                newOptions[optionIndex] = text;
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const setCorrectOption = (qId, optionIndex) => {
        setQuestions(questions.map(q => q.id === qId ? { ...q, correctOptionIndex: optionIndex } : q));
    };

    const addOptionRaw = (qId) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) return { ...q, options: [...q.options, ""] };
            return q;
        }));
    };

    const removeOptionRaw = (qId, optionIndex) => {
        setQuestions(questions.map(q => {
            if (q.id === qId) {
                if (q.options.length <= 2) {
                    toast.error("A question must have at least 2 options.");
                    return q;
                }
                const newOptions = q.options.filter((_, idx) => idx !== optionIndex);
                // Adjust correct option index if needed
                let newCorrectIndex = q.correctOptionIndex;
                if (newCorrectIndex === optionIndex) newCorrectIndex = null;
                else if (newCorrectIndex > optionIndex) newCorrectIndex--;

                return { ...q, options: newOptions, correctOptionIndex: newCorrectIndex };
            }
            return q;
        }));
    };


    // Submission
    const handleSubmit = () => {
        // Validation
        if (!paperName.trim()) { toast.error("Please enter a Question Paper Name."); return; }
        if (!selectedDepartment) { toast.error("Please select a Department."); return; }
        // Line and Machine are optional based on user request ("if admin want line... if machine...")

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) { toast.error(`Question ${i + 1} is empty.`); return; }
            if (q.correctOptionIndex === null) { toast.error(`Select a correct answer for Question ${i + 1}.`); return; }
            for (let j = 0; j < q.options.length; j++) {
                if (!q.options[j].trim()) { toast.error(`Option ${j + 1} in Question ${i + 1} is empty.`); return; }
            }
        }

        const payload = {
            name: paperName,
            departmentId: selectedDepartment,
            lineId: selectedLine || null,
            machineId: selectedMachine || null,
            questions: questions.map(q => ({
                question: q.text,
                options: q.options,
                correctAnswer: q.options[q.correctOptionIndex], // Or index, depending on backend expectation
                correctIndex: q.correctOptionIndex
            }))
        };

        console.log("Creating Question Paper Payload:", payload);
        toast.success("Question Paper Created! (Check Console for Payload)");
        // TODO: Call actual API mutation here
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Create Question Paper</h1>
                <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" />
                    Create Paper
                </Button>
            </div>

            {/* Configuration Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Paper Configuration</CardTitle>
                    <CardDescription>Set the target audience and basic details.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2 col-span-full md:col-span-1">
                        <Label>Question Paper Name</Label>
                        <Input
                            placeholder="e.g. Safety Basics 101"
                            value={paperName}
                            onChange={(e) => setPaperName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={selectedDepartment} onValueChange={(val) => { setSelectedDepartment(val); setSelectedLine(""); setSelectedMachine(""); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Dept" />
                            </SelectTrigger>
                            <SelectContent>
                                {globalDepartments?.data?.departments?.map((dept) => (
                                    <SelectItem key={dept._id || dept.id} value={dept._id || dept.id}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Line (Optional)</Label>
                        <Select value={selectedLine} onValueChange={(val) => { setSelectedLine(val); setSelectedMachine(""); }} disabled={!selectedDepartment}>
                            <SelectTrigger>
                                <SelectValue placeholder={!selectedDepartment ? "Select Dept First" : "Select Line"} />
                            </SelectTrigger>
                            <SelectContent>
                                {linesData?.data?.map((line) => (
                                    <SelectItem key={line._id || line.id} value={line._id || line.id}>
                                        {line.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Machine (Optional)</Label>
                        <Select value={selectedMachine} onValueChange={setSelectedMachine} disabled={!selectedLine}>
                            <SelectTrigger>
                                <SelectValue placeholder={!selectedLine ? "Select Line First" : "Select Machine"} />
                            </SelectTrigger>
                            <SelectContent>
                                {machinesData?.data?.map((machine) => (
                                    <SelectItem key={machine._id || machine.id} value={machine._id || machine.id}>
                                        {machine.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Questions List */}
            <div className="space-y-4">
                {questions.map((q, qIndex) => (
                    <Card key={q.id} className="relative overflow-hidden border-2 focus-within:border-blue-500 transition-colors">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
                        <CardContent className="pt-6 pl-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Q{qIndex + 1}</span>
                                    Question Text
                                </h3>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeQuestion(q.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>

                            <Textarea
                                placeholder="Enter your question here..."
                                className="mb-6 resize-none"
                                value={q.text}
                                onChange={(e) => updateQuestionText(q.id, e.target.value)}
                            />

                            <div className="space-y-3 pl-2">
                                <Label className="text-xs uppercase text-gray-500 font-bold tracking-wider">Answers (Select Correct Option)</Label>
                                {q.options.map((opt, optIndex) => (
                                    <div key={optIndex} className="flex items-center gap-3 group">
                                        <div
                                            className={`cursor-pointer w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${q.correctOptionIndex === optIndex ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-gray-400'}`}
                                            onClick={() => setCorrectOption(q.id, optIndex)}
                                            title="Mark as Correct Answer"
                                        >
                                            {q.correctOptionIndex === optIndex && <CheckCircle className="w-4 h-4" />}
                                        </div>
                                        <Input
                                            value={opt}
                                            onChange={(e) => updateOptionText(q.id, optIndex, e.target.value)}
                                            placeholder={`Option ${optIndex + 1}`}
                                            className={`${q.correctOptionIndex === optIndex ? 'border-green-500 bg-green-50' : ''}`}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                                            onClick={() => removeOptionRaw(q.id, optIndex)}
                                            disabled={q.options.length <= 2}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => addOptionRaw(q.id)} className="mt-2 text-xs">
                                    <Plus className="w-3 h-3 mr-1" /> Add Option
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Button onClick={addQuestion} variant="outline" className="w-full border-dashed border-2 py-8 text-gray-500 hover:text-blue-600 hover:border-blue-600 hover:bg-blue-50">
                <Plus className="w-6 h-6 mr-2" /> Add Another Question
            </Button>
        </div>
    );
};

export default AddQuestionPaper;
