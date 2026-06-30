import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { IconMail, IconDeviceFloppy, IconLoader2, IconSettings, IconFilter, IconUserCheck, IconClock } from "@tabler/icons-react";
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";

const AVAILABLE_FORMS = [
    "Multi Skill Sheet",
    "Skill Upgradation Sheet",
    "Handover Sheet",
    "On Job Training Record Sheet",
    "On Job Training Evaluation Sheet",
    "Skill Matrix Certificate Sheet",
    "Operator Observance Check Sheet",
    "3-Day Monitoring Sheet",
    "16-Day Monitoring Sheet",
    "Mentee Feedback Monitoring Sheet",
    "10-Cycle Check Sheet",
    "Skill Matrix Sheet",
    "Daily Production Report Sheet",
    "Daily 5M Recording Sheet",
    "Associates Headcount Report",
    "Abnormal Condition Sheet"
];

export default function EmailConfiguration() {
    const [configs, setConfigs] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDeptId, setSelectedDeptId] = useState("all");
    const [selectedSectionId, setSelectedSectionId] = useState("all");
    const [savingForm, setSavingForm] = useState(null);

    // Local state for edits before saving
    const [editState, setEditState] = useState({});

    const fetchConfigs = async () => {
        try {
            const res = await axiosInstance.get("/api/email-configurations");
            setConfigs(res.data.data);

            // Initialize edit state from fetched configs based on current context
            const initialEdits = {};
            AVAILABLE_FORMS.forEach(form => {
                const config = res.data.data.find(c =>
                    c.formName === form &&
                    (selectedDeptId === "all" ? !c.departmentId : c.departmentId?.toString() === selectedDeptId) &&
                    (selectedSectionId === "all" ? !c.sectionId : c.sectionId?.toString() === selectedSectionId)
                );
                initialEdits[form] = {
                    toEmails: config?.toEmails || "",
                    ccEmails: config?.ccEmails || "",
                    includeTrainer: config?.includeTrainer || false,
                    scheduledTime: config?.scheduledTime || ""
                };
            });
            setEditState(initialEdits);
        } catch (error) {
            toast.error("Failed to fetch email configurations");
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await axiosInstance.get("/api/departments");
            setDepartments(res.data.data.departments || []);
        } catch (error) {
            toast.error("Failed to fetch departments");
        }
    };

    const fetchSections = async (deptId) => {
        if (!deptId || deptId === "all") {
            setSections([]);
            setSelectedSectionId("all");
            return;
        }
        try {
            const res = await axiosInstance.get(`/api/sections/department/${deptId}`);
            setSections(res.data.data || []);
        } catch (error) {
            console.error("Failed to fetch sections:", error);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    useEffect(() => {
        fetchConfigs();
        if (selectedDeptId !== "all") {
            fetchSections(selectedDeptId);
        } else {
            setSections([]);
            setSelectedSectionId("all");
        }
    }, [selectedDeptId, selectedSectionId]);

    const handleInputChange = (formName, field, value) => {
        setEditState(prev => ({
            ...prev,
            [formName]: {
                ...prev[formName],
                [field]: value
            }
        }));
    };

    const handleSave = async (formName) => {
        const data = editState[formName];
        if (!data.toEmails) {
            toast.error("To Emails are required");
            return;
        }

        setSavingForm(formName);
        try {
            const existing = configs.find(c =>
                c.formName === formName &&
                (selectedDeptId === "all" ? !c.departmentId : c.departmentId?.toString() === selectedDeptId) &&
                (selectedSectionId === "all" ? !c.sectionId : c.sectionId?.toString() === selectedSectionId)
            );

            const payload = {
                formName,
                departmentId: selectedDeptId === "all" ? null : parseInt(selectedDeptId),
                sectionId: selectedSectionId === "all" ? null : parseInt(selectedSectionId),
                toEmails: data.toEmails,
                ccEmails: data.ccEmails,
                includeTrainer: data.includeTrainer,
                scheduledTime: data.scheduledTime || null,
                isActive: true
            };

            if (existing) {
                await axiosInstance.put(`/api/email-configurations/${existing.id}`, payload);
            } else {
                await axiosInstance.post("/api/email-configurations", payload);
            }

            toast.success(`${formName} configuration saved`);
            fetchConfigs();
        } catch (error) {
            toast.error("Failed to save configuration");
        } finally {
            setSavingForm(null);
        }
    };

    if (loading && departments.length === 0) {
        return (
            <div className="flex justify-center p-12">
                <IconLoader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-blue-100 bg-blue-50/30">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <IconMail className="w-6 h-6 text-blue-600" />
                                Email Notifications Settings
                            </h2>
                            <p className="text-sm text-gray-500">
                                Manage email recipients for all forms under a specific department or section.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 min-w-[300px]">
                            <div className="bg-white p-2 rounded-full shadow-sm border border-blue-100 hidden md:block">
                                <IconFilter className="w-5 h-5 text-blue-500" />
                            </div>
                            
                            <div className="flex-1 space-y-1 min-w-[200px]">
                                <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">1. Select Department</Label>
                                <Select
                                    value={selectedDeptId}
                                    onValueChange={(val) => {
                                        setSelectedDeptId(val);
                                        setSelectedSectionId("all");
                                    }}
                                >
                                    <SelectTrigger className="bg-white border-blue-200">
                                        <SelectValue placeholder="Global (All Departments)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Global / Default</SelectItem>
                                        {departments.map(dept => (
                                            <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className={`flex-1 space-y-1 min-w-[200px] transition-opacity ${selectedDeptId === "all" ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                <Label className="text-[10px] uppercase font-bold text-gray-400 ml-1">2. Select Section (Optional)</Label>
                                <Select
                                    value={selectedSectionId}
                                    onValueChange={setSelectedSectionId}
                                    disabled={selectedDeptId === "all"}
                                >
                                    <SelectTrigger className="bg-white border-blue-200">
                                        <SelectValue placeholder="All Sections" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Entire Department</SelectItem>
                                        {sections.map(sec => (
                                            <SelectItem key={sec.id} value={sec.id.toString()}>{sec.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                {AVAILABLE_FORMS.map((formName) => {
                    const isSaving = savingForm === formName;
                    const currentEdit = editState[formName] || { toEmails: "", ccEmails: "", includeTrainer: false };
                    const hasConfig = configs.some(c =>
                        c.formName === formName &&
                        (selectedDeptId === "all" ? !c.departmentId : c.departmentId?.toString() === selectedDeptId) &&
                        (selectedSectionId === "all" ? !c.sectionId : c.sectionId?.toString() === selectedSectionId)
                    );

                    return (
                        <Card key={formName} className="hover:shadow-md transition-shadow">
                            <CardHeader className="py-4 bg-gray-50/50 border-b">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-white rounded border text-gray-500">
                                            <IconSettings className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base text-gray-800">{formName}</CardTitle>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant={hasConfig ? "success" : "outline"} className="text-[10px] py-0 h-4">
                                                    {hasConfig ? "Configured" : "Not Set"}
                                                </Badge>
                                                <span className="text-[10px] text-gray-400">
                                                    {selectedDeptId === "all" ? "Global Context" : 
                                                     selectedSectionId === "all" ? `Department: ${departments.find(d => d.id.toString() === selectedDeptId)?.name}` :
                                                     `Section: ${sections.find(s => s.id.toString() === selectedSectionId)?.name}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleSave(formName)}
                                        disabled={isSaving}
                                        className="h-8 gap-2"
                                    >
                                        {isSaving ? <IconLoader2 className="w-3 h-3 animate-spin" /> : <IconDeviceFloppy className="w-3 h-3" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 pb-4">
                                {(formName === "Handover Sheet" || formName === "16-Day Monitoring Sheet") && selectedDeptId === "all" && (
                                    <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                                        <span className="mt-0.5 shrink-0 font-bold">⚠</span>
                                        <span>
                                            Scheduled emails for <strong>{formName}</strong> require a specific department to be selected above.
                                            The scheduler cannot determine which records to check without a department.
                                            Please select a department, fill in the emails & time, then save.
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="space-y-1.5 md:col-span-1">
                                        <Label className="text-xs font-semibold text-gray-600">To: Recipients (comma separated)</Label>
                                        <Input
                                            placeholder="manager@example.com, tech_lead@example.com"
                                            value={currentEdit.toEmails}
                                            onChange={(e) => handleInputChange(formName, "toEmails", e.target.value)}
                                            className="h-9 focus-visible:ring-blue-400"
                                        />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-1">
                                        <Label className="text-xs font-semibold text-gray-600">CC: Recipients (comma separated)</Label>
                                        <Input
                                            placeholder="admin_copy@example.com"
                                            value={currentEdit.ccEmails}
                                            onChange={(e) => handleInputChange(formName, "ccEmails", e.target.value)}
                                            className="h-9 focus-visible:ring-blue-400"
                                        />
                                    </div>

                                    <div className="md:col-span-2 space-y-1.5">
                                        <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                                            <IconClock className="w-3.5 h-3.5 text-blue-500" />
                                            Auto-Send Time (24hr)
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="time"
                                                value={currentEdit.scheduledTime || ""}
                                                onChange={(e) => handleInputChange(formName, "scheduledTime", e.target.value)}
                                                className="h-9 w-36 focus-visible:ring-blue-400"
                                            />
                                            {currentEdit.scheduledTime ? (
                                                <span className="text-xs text-green-600 font-medium">
                                                    Emails will send daily at {currentEdit.scheduledTime}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">
                                                    No schedule set — leave blank to disable
                                                </span>
                                            )}
                                            {currentEdit.scheduledTime && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleInputChange(formName, "scheduledTime", "")}
                                                    className="text-xs text-red-400 hover:text-red-600 underline"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400">
                                            {formName === "Handover Sheet" ? "For Handover Sheet: sends one email per pending (unapproved) entry at this time daily." :
                                             formName === "16-Day Monitoring Sheet" ? "For 16-Day Monitoring Sheet: sends email report for each pending (unapproved/unverified) monitoring sheet at this time daily." :
                                             "No scheduler action defined for this form yet."}
                                        </p>
                                    </div>

                                    <div className="md:col-span-2 flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100 mt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-1.5 rounded-full">
                                                <IconUserCheck className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <Label className="text-sm font-semibold text-gray-800">Notify Department Trainers</Label>
                                                <p className="text-[11px] text-gray-500">Automatically include users marked as trainers for this department.</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={currentEdit.includeTrainer}
                                            onCheckedChange={(checked) => handleInputChange(formName, "includeTrainer", checked)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
