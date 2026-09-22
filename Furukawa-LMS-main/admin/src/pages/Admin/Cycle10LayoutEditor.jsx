import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Save, History, ArrowLeft } from "lucide-react";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from "sonner";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ALL_FORM_TYPES,
    buildDefaultFormConfig,
    normalizeConfig,
    getLayoutGroupArray,
} from "@/utils/tenCycleSheetConfig";
import { EditableCell } from "@/components/admin/LayoutEditorCells";

const SHEET_KEY = 'ten-cycle-sheet';

// Builds two illustrative sample rows (one all-pass, one with a fail) purely for the
// live preview below — never sent to the server, and never confused with real sheet data.
const buildSampleRows = (draft, formType) => {
    if (!draft) return [];
    const rows = [
        {
            srNo: 1, date: new Date().toISOString().split('T')[0],
            lineMachine: 'Line-1 (M/C-04)', modelName: 'ABC-123', partName: 'Connector Housing',
            operationName: 'Crimping', sopNo: 'SOP-045', inspectorName: 'Rahul Verma', empCode: 'EMP1023',
            skillLevel: 'L3', obsSecA: 'All checks OK', obsSecB: 'Within spec', obsSecC: 'OK',
            passScore: '100%', overallResult: '✓', inspectorSign: 'Rahul Verma', tlSign: 'Suresh Patil', remark: '-',
        },
        {
            srNo: 2, date: new Date().toISOString().split('T')[0],
            lineMachine: 'Line-2 (M/C-07)', modelName: 'XYZ-987', partName: 'Wire Terminal',
            operationName: 'Assembly', sopNo: 'SOP-089', inspectorName: 'Anita Sharma', empCode: 'EMP2041',
            skillLevel: 'L2', obsSecA: 'SOP not followed', obsSecB: 'Within spec', obsSecC: 'Minor deviation',
            passScore: '0%', overallResult: 'X', inspectorSign: 'Anita Sharma', tlSign: 'Suresh Patil', remark: 'Re-checked, corrected',
        },
    ];
    rows.forEach((row, idx) => {
        draft.secA.questions.forEach((q, qi) => { row[`secA_${q.id}`] = idx === 0 ? '✓' : (qi === 0 ? 'X' : '✓'); });
        draft.secA.generalPoints.forEach((g) => { row[`secA_${g.id}`] = '✓'; });
        draft.secB.instruments.forEach((ins) => { row[`secB_${ins.id}`] = '✓'; });
        draft.secC.columns.forEach((c, ci) => { row[`secC_${c.id}`] = idx === 1 && ci === draft.secC.columns.length - 1 ? 'X' : '✓'; });
        if (formType === 'form3') {
            const base = idx === 0 ? 4.2 : 4.5;
            for (let n = 1; n <= 10; n++) row[`secB_v${n}`] = (base + (n % 3) * 0.1).toFixed(1);
            const vals = Array.from({ length: 10 }, (_, n) => parseFloat(row[`secB_v${n + 1}`]));
            row.secB_spec = '4.0 - 5.0';
            row.secB_min = Math.min(...vals).toFixed(1);
            row.secB_max = Math.max(...vals).toFixed(1);
        }
    });
    return rows;
};

const Mark = ({ value }) => (
    <span className={value === 'X' ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{value}</span>
);

// Dedicated 10-Cycle Check Sheet layout editor: scope/form-type picker, direct
// document-control fields, Section A/B/C editors, a live high-fidelity sheet
// preview, and a single-remark atomic save (layout + revision record together).
// Reachable from the Revision Table's Edit/Add-Override buttons and from a
// header action on the 10-Cycle Sheet page itself — see RevisionSheetHistory.jsx
// and Cycle10.jsx respectively.
const Cycle10LayoutEditor = () => {
    const { sheetKey } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin || user?.isTrainer
        || user?.customRole?.permissions?.includes('ten_cycle:manage')
        || user?.customRole?.permissions?.includes('ten_cycle:edit_layout')
        || user?.customRole?.permissions?.includes('revision:update');

    const [logAction] = useLogActionMutation();

    const cameFromRevisionTable = location.pathname.includes('/revision-table/');
    const backTarget = cameFromRevisionTable
        ? `/admin/revision-table/${sheetKey || SHEET_KEY}`
        : (isAdmin ? '/admin/10-cycle' : '/portal/10-cycle');
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to 10-Cycle Sheet';

    // Scope: department/section/line, or Global — independent of any single sheet.
    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    const [sectionId, setSectionId] = useState(searchParams.get('sectionId') || "");
    const [lineId, setLineId] = useState(searchParams.get('lineId') || "");
    // Which form's branch of the scope's config is being edited/previewed.
    const [formType, setFormType] = useState('form1');

    // Full { form1, form2, form3 } blob for the selected scope.
    const [fullConfig, setFullConfig] = useState(null);
    const draft = fullConfig ? fullConfig[formType] : null;
    // Snapshot of fullConfig as last loaded/saved from the server — compared
    // against the live fullConfig to show an "unsaved changes" indicator and
    // to know what "Reset to Saved" should revert to.
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const isDirty = !!fullConfig && JSON.stringify(fullConfig) !== savedSnapshot;
    // Which scope the loaded config actually came from (hierarchical fallback can
    // resolve broader than what's selected) — null if nothing saved anywhere at all.
    const [resolvedScope, setResolvedScope] = useState(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // Document Control fields — direct, always-visible inputs (not a separate dialog),
    // pre-populated from the Revision Table for the active scope.
    const [docNo, setDocNo] = useState("");
    const [revNo, setRevNo] = useState("");
    const [revDate, setRevDate] = useState("");
    const [affectedSrNoPage, setAffectedSrNoPage] = useState("");
    const [loadingRevisionInfo, setLoadingRevisionInfo] = useState(false);

    // Single-field remark confirmation modal — the only thing asked at save time.
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [remarkText, setRemarkText] = useState("");
    const [saving, setSaving] = useState(false);

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];
    const { data: sectionData } = useGetSectionsByDepartmentQuery(deptId, { skip: !deptId });
    const sections = sectionData?.data || [];
    const { data: lineData } = useGetLinesBySectionQuery(sectionId, { skip: !sectionId });
    const lines = lineData?.data || [];

    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const scopeQuery = () => {
        const params = new URLSearchParams();
        if (!isGlobal) {
            if (sectionId) params.set("sectionId", sectionId);
            if (lineId) params.set("lineId", lineId);
        }
        return params.toString();
    };
    const deptParam = () => (isGlobal ? "global" : deptId);

    const fetchFullConfig = async () => {
        if (!isGlobal && !deptId) {
            const defaults = { form1: buildDefaultFormConfig(), form2: buildDefaultFormConfig(), form3: buildDefaultFormConfig() };
            setFullConfig(defaults);
            setSavedSnapshot(JSON.stringify(defaults));
            setResolvedScope(null);
            return;
        }
        try {
            setLoadingConfig(true);
            const qs = scopeQuery();
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/config/${deptParam()}${qs ? `?${qs}` : ""}`);
            const loaded = normalizeConfig(response.data?.data?.config);
            setFullConfig(loaded);
            setSavedSnapshot(JSON.stringify(loaded));
            setResolvedScope(response.data?.data?.resolvedScope || null);
        } catch {
            toast.error("Failed to load layout configuration");
        } finally {
            setLoadingConfig(false);
        }
    };

    const fetchRevisionInfo = async () => {
        if (!isGlobal && !deptId) {
            setDocNo(""); setRevNo(""); setRevDate(""); setAffectedSrNoPage("");
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
            setRevDate(record.revDate || "");
            setAffectedSrNoPage(record.affectedSrNoPage || "");
        } catch {
            setDocNo(""); setRevNo(""); setRevDate(""); setAffectedSrNoPage("");
        } finally {
            setLoadingRevisionInfo(false);
        }
    };

    useEffect(() => {
        fetchFullConfig();
        fetchRevisionInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobal, deptId, sectionId, lineId]);

    // Explains whether the loaded config is a saved override for exactly this scope, or
    // inherited from somewhere broader (Department-wide / Global) — makes the hierarchical
    // fallback visible instead of silently looking like "the same config everywhere".
    const inheritanceNote = () => {
        if (!fullConfig) return null;
        if (isGlobal) {
            return resolvedScope
                ? { tone: 'ok', text: "Editing the saved Global template — this applies to every department/section/line with no override of its own." }
                : { tone: 'warn', text: "No Global template saved yet — showing the built-in defaults. Saving here creates the Global template." };
        }
        if (!resolvedScope) {
            return { tone: 'warn', text: "Nothing saved anywhere in this chain — showing the built-in defaults. Saving here creates a config just for this exact selection." };
        }
        if (!resolvedScope.departmentId) {
            return { tone: 'warn', text: "No override saved for this Department/Section/Line — currently showing the Global template. Saving here creates a new override just for this exact selection; it will NOT change the Global template or any other department." };
        }
        const exactSection = String(resolvedScope.sectionId || 0) === String(sectionId || 0);
        const exactLine = String(resolvedScope.lineId || 0) === String(lineId || 0);
        if (exactSection && exactLine) {
            return { tone: 'ok', text: "Showing a config saved specifically for this exact Department/Section/Line selection." };
        }
        return { tone: 'warn', text: "Showing an inherited config from a broader level (e.g. Department-wide). Saving here creates a new, more specific override just for this exact selection." };
    };

    // All three of these only ever touch the `formType` branch of the full blob, so
    // editing Form 1 never mutates Form 2's or Form 3's saved data.
    const updateItem = (group, idx, field, value) => {
        setFullConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            getLayoutGroupArray(next[formType], group)[idx][field] = value;
            return next;
        });
    };

    const addItem = (group) => {
        setFullConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const arr = getLayoutGroupArray(next[formType], group);
            const newId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const n = arr.length + 1;
            if (group === 'columns') arr.push({ id: newId, label: String(n) });
            else if (group === 'instruments') arr.push({ id: newId, label: `New Instrument ${n}` });
            else arr.push({ id: newId, label: `Q${n}`, desc: '' });
            return next;
        });
    };

    const removeItem = (group, idx) => {
        setFullConfig(prev => {
            if (!prev) return prev;
            const arr = getLayoutGroupArray(prev[formType], group);
            if (arr.length <= 1) {
                toast.error("At least one item is required in this section");
                return prev;
            }
            const next = JSON.parse(JSON.stringify(prev));
            getLayoutGroupArray(next[formType], group).splice(idx, 1);
            return next;
        });
    };

    const fetchHistory = async () => {
        if (!isGlobal && !deptId) return;
        try {
            const qs = scopeQuery();
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/history/${deptParam()}${qs ? `?${qs}` : ""}`);
            if (response.data.success) {
                setHistory(response.data.data || []);
                setShowHistory(true);
                logAction({
                    action: "VIEW_TEN_CYCLE_SHEET_LAYOUT_HISTORY",
                    details: { departmentId: isGlobal ? null : deptId, sectionId: isGlobal ? null : (sectionId || null), lineId: isGlobal ? null : (lineId || null) }
                }).catch(() => {});
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
        if (!fullConfig) return;
        if (!docNo.trim() || !revNo.trim()) {
            toast.error("Document No. and Revision No. are required before saving");
            return;
        }
        setRemarkText("");
        setSaveModalOpen(true);
    };

    // Atomically saves the layout config for this scope AND the revision record
    // documenting it, via the combined save-with-revision endpoint — one remark
    // covers both the layout history entry and the revision's change details.
    const handleConfirmSave = async () => {
        if (!remarkText.trim()) {
            toast.error("Please enter a remark describing your changes");
            return;
        }
        if (!fullConfig) return;
        try {
            setSaving(true);
            const newConfig = normalizeConfig(fullConfig);
            await axiosInstance.post(`/api/ten-cycle-sheets/config/save-with-revision`, {
                departmentId: isGlobal ? null : deptId,
                sectionId: isGlobal ? 0 : (sectionId || 0),
                lineId: isGlobal ? 0 : (lineId || 0),
                subSectionId: 0,
                config: newConfig,
                remark: remarkText.trim(),
                revision: {
                    docNo: docNo.trim(),
                    revNo: revNo.trim(),
                    revDate,
                    affectedSrNoPage,
                    changeDetails: remarkText.trim(),
                },
            });
            setFullConfig(newConfig);
            setSavedSnapshot(JSON.stringify(newConfig));
            setSaveModalOpen(false);
            setRemarkText("");
            toast.success("Layout and revision updated successfully");

            logAction({
                action: "SAVE_TEN_CYCLE_SHEET_LAYOUT_CONFIG",
                details: {
                    departmentId: isGlobal ? null : deptId,
                    sectionId: isGlobal ? null : (sectionId || null),
                    lineId: isGlobal ? null : (lineId || null),
                    remark: remarkText.trim(),
                    docNo, revNo,
                }
            }).catch(() => {});

            if (cameFromRevisionTable) {
                navigate(`/admin/revision-table/${sheetKey || SHEET_KEY}`);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save layout & revision");
        } finally {
            setSaving(false);
        }
    };

    const sampleRows = useMemo(() => buildSampleRows(draft, formType), [draft, formType]);

    if (!user) return null;

    if (!canEditConfig) {
        return (
            <Card className="w-full">
                <CardContent className="p-8 text-center space-y-3">
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the 10-Cycle Sheet Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const sectionName = sections.find(s => String(s._id || s.id) === sectionId)?.name;
    const lineName = lines.find(l => String(l._id || l.id) === lineId)?.name;
    const isForm3 = formType === 'form3';
    const isForm1 = formType === 'form1';
    const inspectorLabel = isForm1 ? 'Operator' : 'Inspector';
    const sheetTitleSuffix = isForm1 ? '( Existing Operators )' : isForm3 ? '( Numerical )' : '( Complete )';

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">10-Cycle Sheet Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Click any label or description directly on the sheet below to edit it in place. Use the + buttons above the
                        sheet to add a question, general point, instrument, or column, and hover a header cell to delete it.
                        Changes apply to whichever scope you select below.
                    </p>
                </div>

                {/* Scope + Form selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wide">Scope</Label>
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isGlobal}
                                    onChange={(e) => {
                                        setIsGlobal(e.target.checked);
                                        setDeptId(""); setSectionId(""); setLineId("");
                                    }}
                                />
                                Global (applies to all departments)
                            </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <Label className="text-xs mb-1 block">Department</Label>
                                <Select
                                    value={deptId}
                                    onValueChange={(v) => { setDeptId(v); setSectionId(""); setLineId(""); }}
                                    disabled={isGlobal}
                                >
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
                                <Select
                                    value={sectionId}
                                    onValueChange={(v) => { setSectionId(v); setLineId(""); }}
                                    disabled={isGlobal || !deptId}
                                >
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
                            <div>
                                <Label className="text-xs mb-1 block">Line (optional)</Label>
                                <Select value={lineId} onValueChange={setLineId} disabled={isGlobal || !sectionId}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="All lines" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lines.map((line) => (
                                            <SelectItem key={line._id || line.id} value={String(line._id || line.id)}>
                                                {line.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            The most specific saved config wins: Line &gt; Section &gt; Department &gt; Global. Leave Section/Line blank to edit at a broader level.
                        </p>
                    </div>

                    <div className="border rounded p-4 space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wide">Form Type</Label>
                        <div className="flex gap-2">
                            {ALL_FORM_TYPES.map((t) => (
                                <Button
                                    key={t.id}
                                    size="sm"
                                    variant={formType === t.id ? "default" : "outline"}
                                    onClick={() => setFormType(t.id)}
                                >
                                    {t.label}
                                </Button>
                            ))}
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Each form type has its own independent questions, general points, instruments, and columns — editing Form 1 here never changes Form 2 or Form 3 (Form 3 also doesn&apos;t use Section B instruments at all).
                        </p>
                    </div>
                </div>

                {/* Document Control */}
                <div className="border rounded p-4 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wide">Document Control (Revision Table)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                            <Label className="text-xs mb-1 block">Doc. No. *</Label>
                            <Input className="h-9 text-sm" value={docNo} onChange={(e) => setDocNo(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Rev. No. *</Label>
                            <Input className="h-9 text-sm" value={revNo} onChange={(e) => setRevNo(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Rev. Date</Label>
                            <Input className="h-9 text-sm" value={revDate} onChange={(e) => setRevDate(e.target.value)} placeholder="DD.MM.YYYY" disabled={loadingRevisionInfo} />
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Affected Sr. No. / Page</Label>
                            <Input className="h-9 text-sm" value={affectedSrNoPage} onChange={(e) => setAffectedSrNoPage(e.target.value)} disabled={loadingRevisionInfo} />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                        These feed the Revision Table entry for the 10 Cycle Sheet at this scope, and appear on the printed sheet&apos;s footer.
                    </p>
                </div>

                {loadingConfig ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : !draft ? (
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

                        {/* ── Live Sheet Preview (Excel-like in-place editor) ───────── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <Label className="text-xs font-bold uppercase tracking-wide">Live Sheet Preview — {ALL_FORM_TYPES.find(t => t.id === formType)?.label}</Label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addItem('questions')}>
                                        <Plus size={12} /> Question
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addItem('generalPoints')}>
                                        <Plus size={12} /> General Point
                                    </Button>
                                    {!isForm3 && (
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addItem('instruments')}>
                                            <Plus size={12} /> Instrument
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addItem('columns')}>
                                        <Plus size={12} /> Column
                                    </Button>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Click a label or description on the sheet to edit it. Hover a header cell to reveal a delete button.
                            </p>
                            <div className="border-2 border-black overflow-x-auto bg-white">
                                <div className="min-w-[1700px] p-2">
                                    <div className="flex justify-between items-center border-b-2 border-black pb-1 relative mb-2">
                                        <h1 className="text-lg font-bold uppercase w-full text-center">
                                            10 CYCLE CHECK MONITORING SHEET {sheetTitleSuffix}
                                        </h1>
                                        <span className="font-bold text-[9px] absolute right-0 -top-5">FURUKAWA MINDA ELECTRIC PVT.LTD.</span>
                                        <div className="text-[9px] absolute right-0 bottom-0 text-blue-600 font-bold flex flex-col items-end leading-tight">
                                            <span>Dept.: {deptName || (isGlobal ? "All (Global)" : "-")}</span>
                                            <div className="flex gap-2">
                                                {sectionName && <span>Sec: {sectionName}</span>}
                                                {lineName && <span>Line: {lineName}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <table className="w-full text-[9px] border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 text-center font-bold">
                                                <th rowSpan="3" className="border border-black p-1 w-[35px]">Sr. No.</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[80px]">Date</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[110px]">Line/ Machine No.</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[100px]">Model Name</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[120px]">Part Name</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[120px]">Operation Name</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[90px]">SOP No.</th>
                                                <th colSpan={draft.secA.questions.length + draft.secA.generalPoints.length} className="border border-black p-1 bg-white">Section - A</th>
                                                {isForm3 ? (
                                                    <th colSpan="13" className="border border-black p-1 bg-white">Section - B</th>
                                                ) : (
                                                    <th colSpan={draft.secB.instruments.length} className="border border-black p-1 bg-white">Section - B</th>
                                                )}
                                                <th colSpan={draft.secC.columns.length} className="border border-black p-1 bg-white">Section-C</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[110px]">{inspectorLabel} Name</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[70px]">Emp. Code</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[55px]">Skill Level</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[140px]">Observation in Section - A</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[140px]">Observation in Section - B</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[140px]">Observation in Section - C</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[60px] bg-yellow-100">Pass Score %</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[70px]">Overall Result</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[90px]">{inspectorLabel} Sign.</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[90px]">TL Sign.</th>
                                                <th rowSpan="3" className="border border-black p-1 w-[160px]">Remark if any</th>
                                            </tr>
                                            <tr className="bg-gray-100 text-center font-bold text-[8px]">
                                                <th colSpan={draft.secA.questions.length} className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                <th colSpan={draft.secA.generalPoints.length} className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                {isForm3 ? (
                                                    <>
                                                        <th colSpan="10" className="border border-black p-1 bg-white text-red-600">10 Cycle Check</th>
                                                        <th rowSpan="2" className="border border-black p-1 bg-white">Cycle Time Spec.</th>
                                                        <th colSpan="2" className="border border-black p-1 bg-yellow-50 text-blue-600">Cycle Time Obs.</th>
                                                    </>
                                                ) : (
                                                    <th colSpan={draft.secB.instruments.length} className="border border-black p-1 bg-white">Measuring Instrument Using Method</th>
                                                )}
                                                <th colSpan={draft.secC.columns.length} className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                            </tr>
                                            <tr className="bg-gray-100 text-center font-bold text-[8px]">
                                                {draft.secA.questions.map((q, idx) => (
                                                    <th key={`pq_${q.id}`} className="relative group border border-black w-[32px] bg-white">
                                                        <EditableCell
                                                            value={q.label}
                                                            placeholder="(empty)"
                                                            onCommit={(v) => updateItem('questions', idx, 'label', v)}
                                                        />
                                                        <button
                                                            type="button"
                                                            title="Delete question"
                                                            onClick={() => removeItem('questions', idx)}
                                                            className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-3.5 h-3.5 leading-none text-[8px] flex items-center justify-center"
                                                        >✕</button>
                                                    </th>
                                                ))}
                                                {draft.secA.generalPoints.map((g, idx) => (
                                                    <th key={`pg_${g.id}`} className="relative group border border-black w-[32px] bg-white">
                                                        <EditableCell
                                                            value={g.label}
                                                            placeholder="(empty)"
                                                            onCommit={(v) => updateItem('generalPoints', idx, 'label', v)}
                                                        />
                                                        <button
                                                            type="button"
                                                            title="Delete general point"
                                                            onClick={() => removeItem('generalPoints', idx)}
                                                            className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-3.5 h-3.5 leading-none text-[8px] flex items-center justify-center"
                                                        >✕</button>
                                                    </th>
                                                ))}
                                                {isForm3 ? (
                                                    <>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                            <th key={n} className="border border-black w-[32px] bg-white">{n}</th>
                                                        ))}
                                                        <th className="border border-black w-[40px] bg-yellow-50 text-blue-600">Min.</th>
                                                        <th className="border border-black w-[40px] bg-yellow-50 text-blue-600">Max.</th>
                                                    </>
                                                ) : (
                                                    draft.secB.instruments.map((i, idx) => (
                                                        <th key={`pi_${i.id}`} className="relative group border border-black w-[45px] bg-white">
                                                            <div className="flex items-center justify-center h-24 w-full whitespace-nowrap px-1">
                                                                <EditableCell
                                                                    value={i.label}
                                                                    placeholder="(empty)"
                                                                    onCommit={(v) => updateItem('instruments', idx, 'label', v)}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                title="Delete instrument"
                                                                onClick={() => removeItem('instruments', idx)}
                                                                className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-3.5 h-3.5 leading-none text-[8px] flex items-center justify-center"
                                                            >✕</button>
                                                        </th>
                                                    ))
                                                )}
                                                {draft.secC.columns.map((c, idx) => (
                                                    <th key={`pc_${c.id}`} className="relative group border border-black w-[32px] bg-white">
                                                        <EditableCell
                                                            value={c.label}
                                                            placeholder="(empty)"
                                                            onCommit={(v) => updateItem('columns', idx, 'label', v)}
                                                        />
                                                        <button
                                                            type="button"
                                                            title="Delete column"
                                                            onClick={() => removeItem('columns', idx)}
                                                            className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-3.5 h-3.5 leading-none text-[8px] flex items-center justify-center"
                                                        >✕</button>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sampleRows.map((row) => (
                                                <tr key={row.srNo} className="text-center h-7">
                                                    <td className="border border-black">{row.srNo}</td>
                                                    <td className="border border-black">{row.date}</td>
                                                    <td className="border border-black text-blue-600 font-bold">{row.lineMachine}</td>
                                                    <td className="border border-black text-blue-600 font-bold">{row.modelName}</td>
                                                    <td className="border border-black text-blue-600 font-bold">{row.partName}</td>
                                                    <td className="border border-black text-blue-600 font-bold">{row.operationName}</td>
                                                    <td className="border border-black text-blue-600 font-bold">{row.sopNo}</td>
                                                    {draft.secA.questions.map(q => (
                                                        <td key={`rq_${row.srNo}_${q.id}`} className="border border-black"><Mark value={row[`secA_${q.id}`]} /></td>
                                                    ))}
                                                    {draft.secA.generalPoints.map(g => (
                                                        <td key={`rg_${row.srNo}_${g.id}`} className="border border-black"><Mark value={row[`secA_${g.id}`]} /></td>
                                                    ))}
                                                    {isForm3 ? (
                                                        <>
                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                <td key={n} className="border border-black text-red-600 font-bold">{row[`secB_v${n}`]}</td>
                                                            ))}
                                                            <td className="border border-black text-blue-600">{row.secB_spec}</td>
                                                            <td className="border border-black bg-yellow-50 font-bold text-blue-600">{row.secB_min}</td>
                                                            <td className="border border-black bg-yellow-50 font-bold text-blue-600">{row.secB_max}</td>
                                                        </>
                                                    ) : (
                                                        draft.secB.instruments.map(i => (
                                                            <td key={`ri_${row.srNo}_${i.id}`} className="border border-black"><Mark value={row[`secB_${i.id}`]} /></td>
                                                        ))
                                                    )}
                                                    {draft.secC.columns.map(c => (
                                                        <td key={`rc_${row.srNo}_${c.id}`} className="border border-black"><Mark value={row[`secC_${c.id}`]} /></td>
                                                    ))}
                                                    <td className="border border-black text-blue-600 font-bold">{row.inspectorName}</td>
                                                    <td className="border border-black text-blue-600 font-bold">{row.empCode}</td>
                                                    <td className="border border-black">{row.skillLevel}</td>
                                                    <td className="border border-black text-blue-600">{row.obsSecA}</td>
                                                    <td className="border border-black text-blue-600">{row.obsSecB}</td>
                                                    <td className="border border-black text-blue-600">{row.obsSecC}</td>
                                                    <td className="border border-black bg-yellow-100 font-bold text-green-600">{row.passScore}</td>
                                                    <td className="border border-black font-bold text-blue-600">{row.overallResult === '✓' ? 'Pass' : 'Fail'}</td>
                                                    <td className="border border-black italic text-blue-600">{row.inspectorSign}</td>
                                                    <td className="border border-black italic text-blue-600">{row.tlSign}</td>
                                                    <td className="border border-black text-blue-600">{row.remark}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="mt-3 p-2 border-t-2 border-black grid grid-cols-1 md:grid-cols-4 gap-4 text-[8px]">
                                        <div className="border border-gray-300 p-2 rounded">
                                            <h3 className="font-bold border-b border-black mb-1">Legend:-</h3>
                                            <div className="grid grid-cols-2 gap-x-2">
                                                <span>A,B,C Marking</span><span>Pass = ✓, Fail = X</span>
                                                <span>Overall Result</span><span>If all Pass(A+B+C) = ✓</span>
                                                <span>Question Marking</span><span>Yes = ✓, No = X</span>
                                                <span>Pass Score %</span><span>If all Pass(A+B+C) = 100%</span>
                                            </div>
                                        </div>
                                        <div className="border border-gray-300 p-2 rounded col-span-1">
                                            <h3 className="font-bold border-b border-black mb-1">Section - A Four Question Details:-</h3>
                                            <ul className="list-none space-y-0.5">
                                                {draft.secA.questions.map((q, idx) => (
                                                    <li key={q.id} className="flex gap-1">
                                                        <EditableCell
                                                            value={q.label}
                                                            placeholder="(label)"
                                                            className="shrink-0"
                                                            onCommit={(v) => updateItem('questions', idx, 'label', v)}
                                                        />
                                                        <span>:-</span>
                                                        <EditableCell
                                                            value={q.desc}
                                                            placeholder="(click to add a description)"
                                                            className="flex-1"
                                                            onCommit={(v) => updateItem('questions', idx, 'desc', v)}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="border border-gray-300 p-2 rounded col-span-1">
                                            <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                            <ul className="list-none space-y-0.5">
                                                {draft.secA.generalPoints.map((g, idx) => (
                                                    <li key={g.id} className="flex gap-1">
                                                        <EditableCell
                                                            value={g.label}
                                                            placeholder="(label)"
                                                            className="shrink-0"
                                                            onCommit={(v) => updateItem('generalPoints', idx, 'label', v)}
                                                        />
                                                        <span>:-</span>
                                                        <EditableCell
                                                            value={g.desc}
                                                            placeholder="(click to add a description)"
                                                            className="flex-1"
                                                            onCommit={(v) => updateItem('generalPoints', idx, 'desc', v)}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="border border-gray-300 p-2 rounded">
                                            <h3 className="font-bold border-b border-black mb-1">Note :-</h3>
                                            <p>If any abnormality found which is related to Man, Machine, SOP &amp; other then write it in remark section.</p>
                                        </div>
                                    </div>

                                    <div className="mt-2 flex justify-between items-center text-[9px] font-bold text-gray-500 px-1 border-t border-black pt-2">
                                        <span>Doc. No: {docNo || "-"}</span>
                                        <span>Rev. No: {revNo || "-"}</span>
                                        <span>Rev. Date: {revDate || "-"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save */}
                        <div className="sticky bottom-0 bg-white border rounded p-4 flex justify-between items-center gap-3 flex-wrap shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="gap-2" onClick={fetchHistory}>
                                    <History size={14} /> History
                                </Button>
                                {isDirty && (
                                    <>
                                        <span className="text-xs text-amber-600 font-medium">You have unsaved changes</span>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={fetchFullConfig}>
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
                                This updates the layout and the Revision Table record for the 10 Cycle Sheet at{" "}
                                {isGlobal ? "the Global scope" : "this Department/Section scope"} (Doc. No: {docNo}, Rev. No: {revNo}).
                            </p>
                            <Label className="text-xs">Remark / Change Details *</Label>
                            <Textarea
                                className="text-sm"
                                value={remarkText}
                                onChange={(e) => setRemarkText(e.target.value)}
                                placeholder="e.g. Renamed 'Linear Scale' to 'Caliper' for this line"
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleConfirmSave} disabled={saving || !remarkText.trim()} className="bg-blue-600 hover:bg-blue-700">
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
                            <DialogTitle>10-Cycle Sheet Layout History</DialogTitle>
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
                                                    setFullConfig(normalizeConfig(entry.config));
                                                    setShowHistory(false);
                                                }}
                                            >
                                                Restore this version (all 3 forms)
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

export default Cycle10LayoutEditor;
