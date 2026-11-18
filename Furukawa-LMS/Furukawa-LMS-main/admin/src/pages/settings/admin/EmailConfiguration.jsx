import React, { useState, useEffect } from "react";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/common/ui/card.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/forms/primitives/select.jsx";
import { Badge } from "@/components/common/ui/badge.jsx";
import { Switch } from "@/components/forms/primitives/switch.jsx";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/common/ui/alert-dialog.jsx";
import EmailChipInput from "@/components/forms/EmailChipInput.jsx";
import { normalizeEmails, parseEmails } from "@/components/forms/emailList.js";
import { IconMail, IconDeviceFloppy, IconLoader2, IconSettings, IconFilter, IconUserCheck, IconClock, IconTrash } from "@tabler/icons-react";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { toast } from "sonner";

// Forms whose daily scheduled email is sent per saved department/section row
// (the schedulers read rows directly, with no fallback to a parent config).
const SCHEDULED_DIGEST_FORMS = [
    "Handover Sheet",
    "16-Day Monitoring Sheet",
    "Skill Upgradation Sheet",
    "Multi Skill Sheet"
];

const toEditState = (config) => ({
    toEmails: normalizeEmails(config?.toEmails),
    ccEmails: normalizeEmails(config?.ccEmails),
    includeTrainer: config?.includeTrainer || false,
    scheduledTime: config?.scheduledTime || ""
});

const isSameEdit = (a, b) =>
    normalizeEmails(a?.toEmails) === normalizeEmails(b?.toEmails) &&
    normalizeEmails(a?.ccEmails) === normalizeEmails(b?.ccEmails) &&
    !!a?.includeTrainer === !!b?.includeTrainer &&
    (a?.scheduledTime || "") === (b?.scheduledTime || "");

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
    "16 Day for Training Cell",
    "Mentee Feedback Monitoring Sheet",
    "10-Cycle Check Sheet",
    "Skill Matrix Sheet",
    "Daily Production Report Sheet",
    "Daily 5M Recording Sheet",
    "Abnormal Condition Sheet",
    "Dojo Evaluation Sheet",
    "Left Request Email"
];

export default function EmailConfiguration() {
    const [configs, setConfigs] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDeptId, setSelectedDeptId] = useState("all");
    const [selectedSectionId, setSelectedSectionId] = useState("all");
    const [savingForm, setSavingForm] = useState(null);
    const [deletingForm, setDeletingForm] = useState(null);
    const [pendingDeleteForm, setPendingDeleteForm] = useState(null);

    // Local state for edits before saving
    const [editState, setEditState] = useState({});

    // Config row saved for exactly the selected department/section context
    const findContextConfig = (list, formName) => list.find(c =>
        c.formName === formName &&
        (selectedDeptId === "all" ? !c.departmentId : c.departmentId?.toString() === selectedDeptId) &&
        (selectedSectionId === "all" ? !c.sectionId : c.sectionId?.toString() === selectedSectionId)
    );

    // With `onlyForm`, only that form's edit state is reset from the server, so
    // unsaved edits on the other cards survive a save/remove.
    const fetchConfigs = async ({ onlyForm } = {}) => {
        try {
            const res = await axiosInstance.get("/api/email-configurations");
            const data = res.data.data;
            setConfigs(data);

            if (onlyForm) {
                setEditState(prev => ({ ...prev, [onlyForm]: toEditState(findContextConfig(data, onlyForm)) }));
                return;
            }

            // Initialize edit state from fetched configs based on current context
            const initialEdits = {};
            AVAILABLE_FORMS.forEach(form => {
                initialEdits[form] = toEditState(findContextConfig(data, form));
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
        const existing = findContextConfig(configs, formName);
        if (parseEmails(data?.toEmails).length === 0) {
            toast.error(existing
                ? "At least one To recipient is required. To stop using this configuration, use Remove Config."
                : "To Emails are required");
            return;
        }

        setSavingForm(formName);
        try {
            const payload = {
                formName,
                departmentId: selectedDeptId === "all" ? null : parseInt(selectedDeptId),
                sectionId: selectedSectionId === "all" ? null : parseInt(selectedSectionId),
                toEmails: normalizeEmails(data.toEmails),
                ccEmails: normalizeEmails(data.ccEmails),
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
            await fetchConfigs({ onlyForm: formName });
        } catch (error) {
            toast.error("Failed to save configuration");
        } finally {
            setSavingForm(null);
        }
    };

    const contextLabel = selectedDeptId === "all"
        ? "Global"
        : selectedSectionId === "all"
            ? `department "${departments.find(d => d.id.toString() === selectedDeptId)?.name ?? ""}"`
            : `section "${sections.find(s => s.id.toString() === selectedSectionId)?.name ?? ""}"`;

    // Explains what happens after removing the config, mirroring the server's
    // section -> department -> global lookup (EmailConfiguration.findByFormDeptAndSection).
    const describeRemoval = (formName) => {
        const existing = findContextConfig(configs, formName);
        const lines = [];

        if (SCHEDULED_DIGEST_FORMS.includes(formName) && existing?.scheduledTime && selectedDeptId !== "all") {
            lines.push(`The daily ${existing.scheduledTime} scheduled email set here will stop.`);
        }

        if (selectedDeptId === "all") {
            lines.push("Departments and sections that do not have their own configuration will stop receiving emails for this form.");
            return lines;
        }

        const deptConfig = selectedSectionId !== "all"
            ? configs.find(c => c.formName === formName && c.departmentId?.toString() === selectedDeptId && !c.sectionId && c.isActive)
            : null;
        const globalConfig = configs.find(c => c.formName === formName && !c.departmentId && !c.sectionId && c.isActive);
        const fallback = deptConfig
            ? { name: "Department", config: deptConfig }
            : globalConfig
                ? { name: "Global", config: globalConfig }
                : null;

        lines.push(fallback
            ? `Other emails for this form from this ${selectedSectionId === "all" ? "department" : "section"} will go to the ${fallback.name} recipients instead (${normalizeEmails(fallback.config.toEmails)}).`
            : `No ${selectedSectionId === "all" ? "" : "Department or "}Global configuration exists for this form, so no emails will be sent for this ${selectedSectionId === "all" ? "department" : "section"}.`);
        return lines;
    };

    const handleDeleteConfig = async (formName) => {
        const existing = findContextConfig(configs, formName);
        if (!existing) return;

        setDeletingForm(formName);
        try {
            await axiosInstance.delete(`/api/email-configurations/${existing.id}`);
            toast.success(`Removed configuration for ${formName}`);
            await fetchConfigs({ onlyForm: formName });
        } catch {
            toast.error("Failed to remove email configuration");
        } finally {
            setDeletingForm(null);
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
                    const isDeleting = deletingForm === formName;
                    const isBusy = isSaving || isDeleting;
                    const currentEdit = editState[formName] || { toEmails: "", ccEmails: "", includeTrainer: false };
                    const contextConfig = findContextConfig(configs, formName);
                    const hasConfig = !!contextConfig;
                    const isDirty = !isSameEdit(currentEdit, toEditState(contextConfig));
                    // Remount chip inputs on context switch so half-typed text doesn't carry over
                    const chipKey = `${formName}|${selectedDeptId}|${selectedSectionId}`;

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
                                                {isDirty && (
                                                    <Badge variant="outline" className="text-[10px] py-0 h-4 border-amber-300 bg-amber-50 text-amber-700">
                                                        Unsaved changes
                                                    </Badge>
                                                )}
                                                <span className="text-[10px] text-gray-400">
                                                    {selectedDeptId === "all" ? "Global Context" : 
                                                     selectedSectionId === "all" ? `Department: ${departments.find(d => d.id.toString() === selectedDeptId)?.name}` :
                                                     `Section: ${sections.find(s => s.id.toString() === selectedSectionId)?.name}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasConfig && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setPendingDeleteForm(formName)}
                                                disabled={isBusy}
                                                className="h-8 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                            >
                                                {isDeleting ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconTrash className="w-3.5 h-3.5" />}
                                                Remove Config
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => handleSave(formName)}
                                            disabled={isBusy}
                                            className="h-8 gap-2"
                                        >
                                            {isSaving ? <IconLoader2 className="w-3 h-3 animate-spin" /> : <IconDeviceFloppy className="w-3 h-3" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 pb-4">
                                {(formName === "Handover Sheet" || formName === "16-Day Monitoring Sheet" || formName === "Skill Upgradation Sheet" || formName === "Multi Skill Sheet") && selectedDeptId === "all" && (
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
                                    <div className="md:col-span-1">
                                        <EmailChipInput
                                            key={`to|${chipKey}`}
                                            label="To: Recipients"
                                            required
                                            placeholder="Type or paste emails, press Enter..."
                                            value={currentEdit.toEmails}
                                            onChange={(val) => handleInputChange(formName, "toEmails", val)}
                                            disabled={isBusy}
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <EmailChipInput
                                            key={`cc|${chipKey}`}
                                            label="CC: Recipients"
                                            placeholder="Type or paste emails, press Enter..."
                                            value={currentEdit.ccEmails}
                                            onChange={(val) => handleInputChange(formName, "ccEmails", val)}
                                            disabled={isBusy}
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
                                             (formName === "Skill Upgradation Sheet" || formName === "Multi Skill Sheet") ? `For ${formName}: sends an email warning for associates whose Plan Date is due today at this time daily.` :
                                             formName === "16 Day for Training Cell" ? "Not auto-scheduled — these recipients receive an automated report when a 16-Day Monitoring Sheet is Approved or Rejected in the 'Approved By' column. Leave the time blank." :
                                             formName === "Left Request Email" ? "For Left Request Email: At the selected time daily, a single consolidated email with a table of all pending left requests is sent to recipients instead of sending separate emails per request. Leave blank to send one email immediately per request." :
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

            <AlertDialog
                open={!!pendingDeleteForm}
                onOpenChange={(open) => { if (!open) setPendingDeleteForm(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove email configuration?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    This deletes the <strong>{pendingDeleteForm}</strong> recipients saved for the {contextLabel} level.
                                </p>
                                {pendingDeleteForm && (
                                    <ul className="list-disc pl-5 space-y-1">
                                        {describeRemoval(pendingDeleteForm).map((line) => <li key={line}>{line}</li>)}
                                    </ul>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => {
                                const formName = pendingDeleteForm;
                                setPendingDeleteForm(null);
                                handleDeleteConfig(formName);
                            }}
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
