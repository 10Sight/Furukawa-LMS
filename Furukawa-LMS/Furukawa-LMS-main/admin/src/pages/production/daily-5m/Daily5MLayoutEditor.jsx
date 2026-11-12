import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/common/ui/card.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Textarea } from "@/components/forms/primitives/textarea.jsx";
import { Loader2, Save, History, ArrowLeft, Minus, Plus } from "lucide-react";
import { IconCpu, IconScissors, IconLayout2 } from "@tabler/icons-react";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { toast } from "sonner";
import { cn } from "@/utils/classNames.js";
import PropagationNotice from "@/pages/reports/components/revision/PropagationNotice.jsx";
import usePropagationPreview, { formatPropagatedToast } from "@/hooks/usePropagationPreview.js";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
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
import { Daily5MHeaderRows, Daily5MChangeTypeTable } from "./components/Daily5MLayoutParts.jsx";
import { DEFAULT_CRIMPING_CONFIG, DEFAULT_CHANGE_TYPE_CONFIG, countSheetColumns } from "./components/daily5mLayoutDefaults.js";

const SHEET_KEY = 'daily-5m';
const FORM_TYPES = ['standard', 'src', 'crimping'];
const FORM_TYPE_TABS = [
    { key: 'standard', label: 'Assembly', description: 'Regular 5M Sheet', icon: IconLayout2 },
    { key: 'src', label: 'SRC', description: 'SRC Machine Fix', icon: IconCpu },
    { key: 'crimping', label: 'Cutting & Crimping', description: 'Crimping Machine Fix', icon: IconScissors },
];
const DEFAULT_BODY_ROWS = 5;
const PREVIEW_SAMPLE_ROWS = 2;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.05;
const clampZoom = (v) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v / ZOOM_STEP) * ZOOM_STEP));

const clone = (value) => JSON.parse(JSON.stringify(value));

// Same rules as the server's resolveConfig: one branch per form type, legacy flat configs
// (saved before the form-type split) become "standard". Also fills in the change-type
// table and default row count so every branch is complete and editable.
const resolveLayout = (stored) => {
    const source = stored || {};
    const isLegacyFlat = !!source.headers && !source.standard && !source.src && !source.crimping;
    const resolved = {};
    FORM_TYPES.forEach((type) => {
        const branch = (type === 'standard' && isLegacyFlat ? source : source[type])
            || (type === 'crimping' ? DEFAULT_CRIMPING_CONFIG : null);
        if (!branch) return;
        const next = clone(branch);
        if (!next.changeTypeTable) next.changeTypeTable = clone(DEFAULT_CHANGE_TYPE_CONFIG);
        if (!Number.isInteger(Number(next.bodyRows)) || Number(next.bodyRows) < 1) next.bodyRows = DEFAULT_BODY_ROWS;
        resolved[type] = next;
    });
    return resolved;
};

// Dedicated Daily 5M layout editor. Edits, per form type (Assembly / SRC / Cutting &
// Crimping), the header TEXT, the "5M Change Type" table and notes, and the default row
// count — never the header's shape, because the sheet's body cells are fixed fields (the
// server enforces this too). Scope is Global or one Department: Daily 5M layouts have no
// section level. Saving writes the layout and the Revision Table record together.
const Daily5MLayoutEditor = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const permissions = user?.customRole?.permissions || [];
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin
        || permissions.includes('daily5m:edit_layout')
        || permissions.includes('revision:update');

    // The recording page passes where it came from; otherwise we were opened from the
    // Revision Table (or a direct link), so go back there.
    const returnTo = location.state?.from;
    const cameFromRevisionTable = !returnTo && location.pathname.includes('/revision-table/');
    // The recording page lives under /cms and /portal (not /admin).
    const recordingPath = location.pathname.startsWith('/portal') ? '/portal/daily-5m-recording' : '/cms/daily-5m-recording';
    const backTarget = returnTo || (cameFromRevisionTable ? `/admin/revision-table/${SHEET_KEY}` : recordingPath);
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to Daily 5M Recording';

    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    // Section-level revision overrides can still exist in the Revision Table; the layout
    // itself is department-wide, so a sectionId in the link is only used for a notice.
    const linkedSectionId = searchParams.get('sectionId');
    const [activeType, setActiveType] = useState('standard');
    const [zoom, setZoom] = useState(0.8);

    const [config, setConfig] = useState(null);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const isDirty = !!config && JSON.stringify(config) !== savedSnapshot;
    const [resolvedScope, setResolvedScope] = useState(undefined); // undefined = built-in defaults
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    const [docNo, setDocNo] = useState("");
    const [revNo, setRevNo] = useState("");
    const [issueDate, setIssueDate] = useState("");
    const [revDate, setRevDate] = useState("");
    const [affectedSrNoPage, setAffectedSrNoPage] = useState("");
    const [affectedSrNoPageHi, setAffectedSrNoPageHi] = useState("");
    const [loadingRevisionInfo, setLoadingRevisionInfo] = useState(false);

    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const { count: affectedCount, loading: loadingPreview } = usePropagationPreview(
        SHEET_KEY,
        isGlobal ? null : deptId,
        null,
        saveModalOpen && (isGlobal || !!deptId)
    );
    const [remarkText, setRemarkText] = useState("");
    const [remarkTextHi, setRemarkTextHi] = useState("");
    const [saving, setSaving] = useState(false);

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];
    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const deptParam = () => (isGlobal ? "global" : deptId);
    const hasScope = isGlobal || !!deptId;

    const fetchConfig = async () => {
        if (!hasScope) {
            setConfig(null);
            setSavedSnapshot(null);
            return;
        }
        try {
            setLoadingConfig(true);
            const response = await axiosInstance.get(`/api/daily-5m/config/${deptParam()}`);
            const data = response.data?.data || {};
            const loaded = resolveLayout(data.config);
            setConfig(loaded);
            setSavedSnapshot(JSON.stringify(loaded));
            setResolvedScope(data.isDefault ? undefined : (data.resolvedScope || null));
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
        if (!hasScope) {
            clearRevisionInfo();
            return;
        }
        try {
            setLoadingRevisionInfo(true);
            const params = isGlobal ? {} : { departmentId: deptId };
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
    }, [isGlobal, deptId]);

    const inheritanceNote = () => {
        if (!config) return null;
        if (resolvedScope === undefined) {
            return isGlobal
                ? { tone: 'warn', text: "No Global template saved yet — showing the built-in defaults. Saving here creates the Global template." }
                : { tone: 'warn', text: "Nothing saved for this department or globally — showing the built-in defaults. Saving here creates this department's own layout." };
        }
        if (isGlobal) {
            return { tone: 'ok', text: "Editing the saved Global template — it applies to every department without a layout of its own." };
        }
        if (!resolvedScope?.departmentId) {
            return { tone: 'warn', text: "This department has no layout of its own — showing the Global template. Saving here creates a layout just for this department; it will NOT change the Global template." };
        }
        return { tone: 'ok', text: "Showing the layout saved specifically for this department." };
    };

    // ── In-place text edits on the active form type ─────────────────────────
    const handleEditText = (path, value) => {
        setConfig(prev => {
            if (!prev?.[activeType]) return prev;
            const next = clone(prev);
            const branch = next[activeType];
            if (path.kind === 'header') {
                const cell = branch.headers?.[path.row]?.[path.col];
                if (!cell) return prev;
                if (path.split !== undefined) cell.splitLabels[path.split] = value;
                else cell.text = value;
            } else {
                const table = branch.changeTypeTable;
                if (path.kind === 'ctTitle') table.title = value;
                else if (path.kind === 'ctCell') table.rows[path.row][path.col].text = value;
                else if (path.kind === 'noteTerm') table.notes[path.idx].term = value;
                else if (path.kind === 'noteDef') table.notes[path.idx].definition = value;
            }
            return next;
        });
    };

    const updateNotes = (mutate) => {
        setConfig(prev => {
            if (!prev?.[activeType]) return prev;
            const next = clone(prev);
            const table = next[activeType].changeTypeTable;
            table.notes = table.notes || [];
            mutate(table.notes);
            return next;
        });
    };

    const setBodyRows = (value) => {
        setConfig(prev => {
            if (!prev?.[activeType]) return prev;
            const next = clone(prev);
            next[activeType].bodyRows = value;
            return next;
        });
    };

    const fetchHistory = async () => {
        if (!hasScope) return;
        try {
            const response = await axiosInstance.get(`/api/daily-5m/history/${deptParam()}`);
            if (response.data.success) {
                setHistory(response.data.data || []);
                setShowHistory(true);
            }
        } catch {
            toast.error("Failed to fetch layout history");
        }
    };

    const handleOpenSaveModal = () => {
        if (!hasScope) {
            toast.error("Select a department, or switch to Global");
            return;
        }
        if (!config) return;
        if (!docNo.trim() || !revNo.trim()) {
            toast.error("Document No. and Revision No. are required before saving");
            return;
        }
        const badRows = FORM_TYPES.find(t => config[t] && !(Number.isInteger(Number(config[t].bodyRows)) && Number(config[t].bodyRows) >= 1 && Number(config[t].bodyRows) <= 100));
        if (badRows) {
            toast.error(`Default rows for ${FORM_TYPE_TABS.find(t => t.key === badRows)?.label} must be between 1 and 100`);
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
            const payloadConfig = clone(config);
            FORM_TYPES.forEach(t => { if (payloadConfig[t]) payloadConfig[t].bodyRows = Number(payloadConfig[t].bodyRows); });
            const saveRes = await axiosInstance.post(`/api/daily-5m/config/save-with-revision`, {
                departmentId: isGlobal ? 'global' : deptId,
                config: payloadConfig,
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
            setConfig(payloadConfig);
            setSavedSnapshot(JSON.stringify(payloadConfig));
            setResolvedScope({ departmentId: isGlobal ? null : deptId });
            setSaveModalOpen(false);
            toast.success(`Layout and revision updated successfully${formatPropagatedToast(saveRes.data?.data?.revision?.propagatedCount)}`);

            if (cameFromRevisionTable) navigate(`/admin/revision-table/${SHEET_KEY}`);
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
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the Daily 5M Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const processText = (text) => (text ? text.replace("{DeptName}", deptName || "{DeptName}") : "");
    const activeConfig = config?.[activeType];
    const sheetColumns = activeConfig ? countSheetColumns(activeConfig.headers || [], activeType) : 0;
    const notes = activeConfig?.changeTypeTable?.notes || [];

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">Daily 5M Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Click any header, change-type cell, or note on the sheet below to edit its text. The header&apos;s columns
                        are fixed — they line up with the sheet&apos;s data fields — so cells can be renamed but not added, removed, or resized.
                        Use <code>{'{DeptName}'}</code> in a title to show the department name.
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
                                onChange={(e) => { setIsGlobal(e.target.checked); setDeptId(""); }}
                            />
                            Global (applies to all departments)
                        </label>
                    </div>
                    <div className="max-w-sm">
                        <Label className="text-xs mb-1 block">Department</Label>
                        <Select value={deptId} onValueChange={setDeptId} disabled={isGlobal}>
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
                    <p className="text-[10px] text-slate-400">
                        A department&apos;s own layout wins over the Global template. Daily 5M layouts apply to the whole department — there is no section level.
                    </p>
                    {linkedSectionId && !isGlobal && (
                        <div className="text-xs rounded p-2 border bg-amber-50 border-amber-200 text-amber-700">
                            You opened this from a section-level revision record. The layout and revision saved here apply to the whole
                            department; a section-level revision override (edit it in the Revision Table) still takes precedence for that section&apos;s header.
                        </div>
                    )}
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
                        These feed the Revision Table entry for Daily 5M at this scope. One revision covers all three form types.
                    </p>
                </div>

                {loadingConfig ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : !config ? (
                    <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                        Select a Department (or switch to Global) to load its layout.
                    </div>
                ) : (
                    <>
                        {note && (
                            <div className={`text-xs rounded p-2 border ${note.tone === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                {note.text}
                            </div>
                        )}

                        {/* Form type */}
                        <div className="flex flex-wrap gap-2">
                            {FORM_TYPE_TABS.filter(t => config[t.key]).map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveType(tab.key)}
                                        className={cn(
                                            "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors",
                                            activeType === tab.key ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                                        )}
                                    >
                                        <Icon size={18} className={activeType === tab.key ? "text-blue-600" : "text-slate-400"} />
                                        <span>
                                            <span className="block text-sm font-bold text-slate-800">{tab.label}</span>
                                            <span className="block text-[10px] text-slate-500">{tab.description}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {activeConfig && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <Label className="text-xs font-bold uppercase tracking-wide">Live Sheet Preview</Label>
                                        <label className="flex items-center gap-2 text-xs">
                                            Default rows per new sheet
                                            <Input
                                                type="number"
                                                min={1}
                                                max={100}
                                                className="h-7 w-20 text-xs"
                                                value={activeConfig.bodyRows ?? ''}
                                                onChange={(e) => setBodyRows(e.target.value === '' ? '' : Number(e.target.value))}
                                            />
                                        </label>
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateNotes(n => n.push({ term: "* New term:", definition: "Definition" }))}>
                                            <Plus size={12} /> Note
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 h-8">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => clampZoom(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
                                            <Minus className="h-3.5 w-3.5" />
                                        </Button>
                                        <input
                                            type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoom}
                                            onChange={(e) => setZoom(clampZoom(parseFloat(e.target.value)))}
                                            className="w-24 cursor-pointer" aria-label="Preview zoom"
                                        />
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => clampZoom(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                        <span className="text-xs font-bold tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
                                    </div>
                                </div>

                                <div className="border rounded overflow-auto bg-white max-h-[70vh]">
                                    <div style={{ zoom }} className="p-4 text-black">
                                        <div className="border-2 border-black block min-w-full">
                                            <table className="w-max min-w-full border-collapse text-xs">
                                                <thead>
                                                    <Daily5MHeaderRows
                                                        headers={activeConfig.headers || []}
                                                        formType={activeType}
                                                        processText={processText}
                                                        onEditText={handleEditText}
                                                    />
                                                </thead>
                                                <tbody>
                                                    {[...Array(PREVIEW_SAMPLE_ROWS)].map((_, i) => (
                                                        <tr key={i}>
                                                            <td colSpan={sheetColumns} className="border border-black h-10 text-center text-[11px] italic text-slate-400 bg-slate-50/60">
                                                                {i === 0
                                                                    ? `Data entry row (fixed fields) — new sheets start with ${activeConfig.bodyRows || '?'} rows`
                                                                    : '…'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <Daily5MChangeTypeTable
                                            config={activeConfig.changeTypeTable}
                                            processText={processText}
                                            onEditText={handleEditText}
                                        />
                                    </div>
                                </div>

                                {notes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 text-[11px]">
                                        <span className="text-slate-500">Remove note:</span>
                                        {notes.map((n, idx) => (
                                            <Button
                                                key={idx}
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] text-red-600"
                                                onClick={() => updateNotes(list => list.splice(idx, 1))}
                                            >
                                                ✕ {n.term || `Note ${idx + 1}`}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

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
                                This saves all three form types&apos; layouts and the Revision Table record for Daily 5M at{" "}
                                {isGlobal ? "the Global scope" : `the ${deptName || "selected"} department`} (Doc. No: {docNo}, Rev. No: {revNo}).
                            </p>
                            <Label className="text-xs">Remark / Change Details *</Label>
                            <Textarea
                                className="text-sm"
                                value={remarkText}
                                onChange={(e) => setRemarkText(e.target.value)}
                                placeholder="e.g. Renamed the Containment Action header and added a note"
                                autoFocus
                            />
                            <Label className="text-xs">Change Details (Hindi, optional)</Label>
                            <Textarea className="text-sm" value={remarkTextHi} onChange={(e) => setRemarkTextHi(e.target.value)} />
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
                            <DialogTitle>Daily 5M Layout History</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {history.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No layout changes recorded yet for this scope.</div>
                            ) : (
                                history.map((entry) => (
                                    <div key={entry.id} className="border rounded p-2 text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span className="font-semibold">{entry.updatedBy || "Unknown"}</span>
                                            <span className="text-muted-foreground">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}</span>
                                        </div>
                                        {entry.remark && <div className="italic text-slate-600">&quot;{entry.remark}&quot;</div>}
                                        <div className="flex justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px]"
                                                onClick={() => {
                                                    // Older entries may predate a form type (e.g. legacy flat
                                                    // layouts) — keep the current branch for any type they lack.
                                                    setConfig(prev => ({ ...prev, ...resolveLayout(entry.config) }));
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

export default Daily5MLayoutEditor;
