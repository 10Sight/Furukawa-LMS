import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/common/ui/card.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Textarea } from "@/components/forms/primitives/textarea.jsx";
import { Loader2, Save, History, ArrowLeft } from "lucide-react";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { toast } from "sonner";
import PropagationNotice from "@/pages/reports/components/revision/PropagationNotice.jsx";
import usePropagationPreview, { formatPropagatedToast } from "@/hooks/usePropagationPreview.js";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
import { useLogActionMutation } from "@/services/api/AuditApi.js";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/common/ui/dialog.jsx";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/forms/primitives/select.jsx";
import { normalizeConfig, buildDefaultConfig } from "@/constants/monitoring/compatibility/threeDayMonitoringConfig.js";
import ThreeDayMonitoringSheet from "@/components/common/training/ThreeDayMonitoringSheet.jsx";

const SHEET_KEY = 'three-day-monitoring';
const MONITORING_PATH = '/admin/3-day-monitoring';

// Dedicated 3-Day Monitoring layout editor: scope picker, document-control fields,
// and the real ThreeDayMonitoringSheet embedded in Design Mode as the live, in-place
// editor (categories, check items, score ranges, evaluation legends), so the preview
// can never drift from the sheet operators actually fill in. Saving writes the layout
// and the Revision Table record for the same scope in one call. Reachable from the
// Revision Table's Edit/Add-Override buttons (RevisionSheetHistory.jsx) and from the
// "Edit Layout & Revision" buttons on the 3-Day Monitoring page and sheet.
const ThreeDayMonitoringLayoutEditor = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const permissions = user?.customRole?.permissions || [];
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin || user?.isTrainer
        || permissions.includes('three_day:manage')
        || permissions.includes('three_day:edit_layout')
        || permissions.includes('revision:update');

    const [logAction] = useLogActionMutation();

    // Monitoring page/sheet buttons pass where they came from; without it the editor was
    // opened from the Revision Table (or a direct link), so go back there.
    const returnTo = location.state?.from;
    const cameFromRevisionTable = !returnTo && location.pathname.includes('/revision-table/');
    const backTarget = returnTo || (cameFromRevisionTable ? `/admin/revision-table/${SHEET_KEY}` : MONITORING_PATH);
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to 3-Day Monitoring';

    // Scope: department + section, or Global — 3-Day Monitoring has no line/sub-section scope.
    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    const [sectionId, setSectionId] = useState(searchParams.get('sectionId') || "");

    const [config, setConfig] = useState(null);
    // Snapshot of config as last loaded/saved — drives the "unsaved changes" indicator
    // and what "Reset to Saved" reverts to.
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const isDirty = !!config && JSON.stringify(config) !== savedSnapshot;
    const [resolvedScope, setResolvedScope] = useState(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // Document Control fields, pre-populated from the Revision Table for the active scope.
    const [docNo, setDocNo] = useState("");
    const [revNo, setRevNo] = useState("");
    const [issueDate, setIssueDate] = useState("");
    const [revDate, setRevDate] = useState("");
    const [affectedSrNoPage, setAffectedSrNoPage] = useState("");
    const [affectedSrNoPageHi, setAffectedSrNoPageHi] = useState("");
    const [loadingRevisionInfo, setLoadingRevisionInfo] = useState(false);

    const [saveModalOpen, setSaveModalOpen] = useState(false);
    // Saving also rewrites the doc/revision header on every already-saved sheet this
    // scope governs — shown in the confirm modal so the reach is visible before saving.
    const { count: affectedCount, loading: loadingPreview } = usePropagationPreview(
        SHEET_KEY,
        isGlobal ? null : deptId,
        isGlobal ? null : sectionId,
        saveModalOpen && (isGlobal || !!deptId)
    );
    const [remarkText, setRemarkText] = useState("");
    const [remarkTextHi, setRemarkTextHi] = useState("");
    const [saving, setSaving] = useState(false);

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];
    const { data: sectionData } = useGetSectionsByDepartmentQuery(deptId, { skip: !deptId });
    const sections = sectionData?.data || [];

    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const deptParam = () => (isGlobal ? "global" : deptId);
    const sectionQs = () => (!isGlobal && sectionId ? `?sectionId=${sectionId}` : "");

    const fetchConfig = async () => {
        if (!isGlobal && !deptId) {
            setConfig(null);
            setSavedSnapshot(null);
            setResolvedScope(null);
            return;
        }
        try {
            setLoadingConfig(true);
            const response = await axiosInstance.get(`/api/three-day-monitoring/config/${deptParam()}${sectionQs()}`);
            const saved = response.data?.data?.config;
            const loaded = saved ? normalizeConfig(saved) : buildDefaultConfig();
            setConfig(loaded);
            setSavedSnapshot(JSON.stringify(loaded));
            setResolvedScope(response.data?.data?.resolvedScope || null);
        } catch {
            toast.error("Failed to load layout configuration");
        } finally {
            setLoadingConfig(false);
        }
    };

    const clearRevisionInfo = () => {
        setDocNo(""); setRevNo(""); setIssueDate(""); setRevDate("");
        setAffectedSrNoPage(""); setAffectedSrNoPageHi("");
    };

    const fetchRevisionInfo = async () => {
        if (!isGlobal && !deptId) {
            clearRevisionInfo();
            return;
        }
        try {
            setLoadingRevisionInfo(true);
            const params = {};
            if (!isGlobal && deptId) params.departmentId = deptId;
            if (!isGlobal && sectionId) params.sectionId = sectionId;
            const response = await axiosInstance.get(`/api/revision-records/sheet/${SHEET_KEY}`, { params });
            const record = response.data?.data || {};
            setDocNo(record.docNo || "");
            setRevNo(record.revNo || "");
            setIssueDate(record.issueDate || "");
            setRevDate(record.revDate || "");
            setAffectedSrNoPage(record.affectedSrNoPage || "");
            setAffectedSrNoPageHi(record.affectedSrNoPageHi || "");
        } catch {
            clearRevisionInfo();
        } finally {
            setLoadingRevisionInfo(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchRevisionInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobal, deptId, sectionId]);

    const inheritanceNote = () => {
        if (!config) return null;
        if (isGlobal) {
            return resolvedScope
                ? { tone: 'ok', text: "Editing the saved Global template — this applies to every department/section with no override of its own." }
                : { tone: 'warn', text: "No Global template saved yet — showing the built-in defaults. Saving here creates the Global template." };
        }
        if (!resolvedScope) {
            return { tone: 'warn', text: "Nothing saved anywhere in this chain — showing the built-in defaults. Saving here creates a config just for this exact selection." };
        }
        if (!resolvedScope.departmentId) {
            return { tone: 'warn', text: "No override saved for this Department/Section — currently showing the Global template. Saving here creates a new override just for this exact selection; it will NOT change the Global template or any other department." };
        }
        const exactSection = String(resolvedScope.sectionId || 0) === String(sectionId || 0);
        if (exactSection) {
            return { tone: 'ok', text: "Showing a config saved specifically for this exact Department/Section selection." };
        }
        return { tone: 'warn', text: "Showing an inherited config from a broader level (e.g. Department-wide). Saving here creates a new, more specific override just for this exact selection." };
    };

    const fetchHistory = async () => {
        if (!isGlobal && !deptId) return;
        try {
            const response = await axiosInstance.get(`/api/three-day-monitoring/history/${deptParam()}${sectionQs()}`);
            if (response.data.success) {
                setHistory(response.data.data || []);
                setShowHistory(true);
                logAction({
                    action: 'VIEW_THREE_DAY_MONITORING_LAYOUT_HISTORY',
                    details: { departmentId: isGlobal ? null : deptId, sectionId: isGlobal ? null : (sectionId || null) }
                }).unwrap().catch(() => {});
            }
        } catch {
            toast.error("Failed to fetch layout history");
        }
    };

    const handleOpenSaveModal = () => {
        if (!isGlobal && !deptId) {
            toast.error("Select a department, or switch to Global");
            return;
        }
        if (!config) return;
        if (!docNo.trim() || !revNo.trim()) {
            toast.error("Document No. and Revision No. are required before saving");
            return;
        }
        setRemarkText("");
        setRemarkTextHi("");
        setSaveModalOpen(true);
    };

    const handleConfirmSave = async () => {
        if (!remarkText.trim()) {
            toast.error("Please enter a remark describing your changes");
            return;
        }
        if (!config) return;
        try {
            setSaving(true);
            const newConfig = normalizeConfig(config);
            const saveRes = await axiosInstance.post(`/api/three-day-monitoring/config/save-with-revision`, {
                departmentId: isGlobal ? null : deptId,
                sectionId: isGlobal ? 0 : (sectionId || 0),
                config: newConfig,
                remark: remarkText.trim(),
                revision: {
                    docNo: docNo.trim(),
                    revNo: revNo.trim(),
                    issueDate,
                    revDate,
                    affectedSrNoPage,
                    affectedSrNoPageHi,
                    changeDetails: remarkText.trim(),
                    changeDetailsHi: remarkTextHi.trim(),
                },
            });
            setConfig(newConfig);
            setSavedSnapshot(JSON.stringify(newConfig));
            // The scope now has its own saved config, so it's no longer inherited.
            setResolvedScope({ departmentId: isGlobal ? null : deptId, sectionId: isGlobal ? 0 : (sectionId || 0) });
            setSaveModalOpen(false);
            setRemarkText("");
            setRemarkTextHi("");
            toast.success(`Layout and revision updated successfully${formatPropagatedToast(saveRes.data?.data?.revision?.propagatedCount)}`);

            if (cameFromRevisionTable) {
                navigate(`/admin/revision-table/${SHEET_KEY}`);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save layout & revision");
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    if (!canEditConfig) {
        return (
            <Card className="w-full">
                <CardContent className="p-8 text-center space-y-3">
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the 3-Day Monitoring Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const sectionName = sections.find(s => String(s._id || s.id) === sectionId)?.name;

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">3-Day Monitoring Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Click any label, mark, or description directly on the sheet below to edit it in place. Use the + buttons above
                        the sheet to add a category, score range, or legend row, and hover a cell to delete it.
                        Changes apply to whichever scope you select below.
                    </p>
                </div>

                {/* Scope */}
                <div className="border rounded p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wide">Scope</Label>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isGlobal}
                                onChange={(e) => {
                                    setIsGlobal(e.target.checked);
                                    setDeptId(""); setSectionId("");
                                }}
                            />
                            Global (applies to all departments)
                        </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs mb-1 block">Department</Label>
                            <Select value={deptId} onValueChange={(v) => { setDeptId(v); setSectionId(""); }} disabled={isGlobal}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((dept) => (
                                        <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Section (optional)</Label>
                            <Select value={sectionId} onValueChange={setSectionId} disabled={isGlobal || !deptId}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="All sections" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map((sec) => (
                                        <SelectItem key={sec._id || sec.id} value={String(sec._id || sec.id)}>
                                            {sec.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        The most specific saved config wins: Section &gt; Department &gt; Global. Leave Section blank to edit at a broader level.
                    </p>
                </div>

                {/* Document Control */}
                <div className="border rounded p-4 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wide">Document Control (Revision Table)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                            <Label className="text-xs mb-1 block">Doc. No. *</Label>
                            <Input className="h-9 text-sm" value={docNo} onChange={(e) => setDocNo(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Rev. No. *</Label>
                            <Input className="h-9 text-sm" value={revNo} onChange={(e) => setRevNo(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Issue Date</Label>
                            <Input className="h-9 text-sm" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} placeholder="DD.MM.YYYY" disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Rev. Date</Label>
                            <Input className="h-9 text-sm" value={revDate} onChange={(e) => setRevDate(e.target.value)} placeholder="DD.MM.YYYY" disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Affected Sr. No. / Page</Label>
                            <Input className="h-9 text-sm" value={affectedSrNoPage} onChange={(e) => setAffectedSrNoPage(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Affected Sr. No. / Page (Hindi)</Label>
                            <Input className="h-9 text-sm" value={affectedSrNoPageHi} onChange={(e) => setAffectedSrNoPageHi(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        These feed the Revision Table entry for 3-Day Monitoring at this scope, and appear in the printed sheet&apos;s footer.
                    </p>
                </div>

                {loadingConfig ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : !config ? (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                        Select a Department (or switch to Global) to load its layout configuration.
                    </div>
                ) : (
                    <>
                        {note && (
                            <div className={`text-xs rounded p-2 border ${note.tone === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                {note.text}
                            </div>
                        )}

                        {/* ── Live sheet — the real 3-Day sheet in Design Mode, editing this config ── */}
                        <div className="overflow-x-auto">
                            <ThreeDayMonitoringSheet
                                departmentId={isGlobal ? null : deptId}
                                sectionId={isGlobal ? null : (sectionId || null)}
                                departmentName={deptName || (isGlobal ? "ALL DEPARTMENTS (GLOBAL)" : "")}
                                sectionName={sectionName || ""}
                                configValue={config}
                                onConfigChange={setConfig}
                                revisionInfoOverride={{ docNo: docNo || "-", revNo: revNo || "-", issueDate, revDate }}
                            />
                        </div>

                        {/* Save */}
                        <div className="sticky bottom-0 z-40 bg-white border rounded p-4 flex justify-between items-center gap-3 flex-wrap shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="gap-2" onClick={fetchHistory}>
                                    <History size={14} /> History
                                </Button>
                                {isDirty && (
                                    <>
                                        <span className="text-xs text-amber-600 font-medium">You have unsaved changes</span>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={fetchConfig}>
                                            Reset to Saved
                                        </Button>
                                    </>
                                )}
                            </div>
                            <Button onClick={handleOpenSaveModal} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                <Save size={16} /> Save Layout & Update Revision
                            </Button>
                        </div>
                    </>
                )}

                {/* ── Remark Confirmation Modal ────────────────────────────── */}
                <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Layout & Update Revision</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <p className="text-xs text-slate-500">
                                This updates the layout and the Revision Table record for 3-Day Monitoring at{" "}
                                {isGlobal ? "the Global scope" : "this Department/Section scope"} (Doc. No: {docNo}, Rev. No: {revNo}).
                            </p>
                            <Label className="text-xs">Remark / Change Details *</Label>
                            <Textarea
                                className="text-sm"
                                value={remarkText}
                                onChange={(e) => setRemarkText(e.target.value)}
                                placeholder="e.g. Added a new Quality/System checkpoint for this department"
                                autoFocus
                            />
                            <Label className="text-xs">Change Details (Hindi, optional)</Label>
                            <Textarea
                                className="text-sm"
                                value={remarkTextHi}
                                onChange={(e) => setRemarkTextHi(e.target.value)}
                            />
                            <PropagationNotice count={affectedCount} loading={loadingPreview} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleConfirmSave} disabled={saving || loadingPreview || !remarkText.trim()} className="bg-blue-600 hover:bg-blue-700">
                                {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                                Confirm & Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Layout History Dialog ─────────────────────────────────── */}
                <Dialog open={showHistory} onOpenChange={setShowHistory}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>3-Day Monitoring Layout History</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {history.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No layout changes recorded yet for this scope.</div>
                            ) : (
                                history.map((entry) => (
                                    <div key={entry.id} className="border rounded p-2 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="font-semibold">{entry.updatedBy || "Unknown"}</span>
                                            <span className="text-muted-foreground">{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : ""}</span>
                                        </div>
                                        {entry.remark && <div className="italic text-slate-600">&quot;{entry.remark}&quot;</div>}
                                        <div className="flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px]"
                                                onClick={() => {
                                                    setConfig(normalizeConfig(entry.config));
                                                    setShowHistory(false);
                                                    toast.info("Restored from history — not saved yet");
                                                }}
                                            >
                                                Restore this version
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowHistory(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

export default ThreeDayMonitoringLayoutEditor;
