import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/common/ui/card.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Textarea } from "@/components/forms/primitives/textarea.jsx";
import { Loader2, Save, History, ArrowLeft, Minus, Plus } from "lucide-react";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { toast } from "sonner";
import PropagationNotice from "@/pages/reports/components/revision/PropagationNotice.jsx";
import usePropagationPreview, { formatPropagatedToast } from "@/hooks/usePropagationPreview.js";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import {
    useGetAbnormalConditionLayoutQuery,
    useSaveAbnormalConditionLayoutWithRevisionMutation,
} from "@/services/api/AbnormalConditionApi.js";
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
import { LayoutText } from "@/components/common/training/LayoutEditorCells.jsx";
import { AbnormalConditionHeaderRows, AbnormalConditionTitle } from "./components/AbnormalConditionLayoutParts.jsx";
import {
    resolveAbnormalConditionLayout,
    validateAbnormalConditionLayout,
    ABNORMAL_CONDITION_MAX_ROWS,
} from "../../../../../shared/abnormalConditionLayout.js";

const SHEET_KEY = 'abnormal-condition';
const PREVIEW_ROWS = 3;
// Data columns on the sheet (S.No … Approved By); the live sheet's extra Actions column is editor-only.
const SHEET_COLUMNS = 14;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.05;
const clampZoom = (v) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v / ZOOM_STEP) * ZOOM_STEP));
const clone = (value) => JSON.parse(JSON.stringify(value));

// Dedicated Abnormal Condition layout editor. Edits TEXT only — the sheet title, every
// column header (including the two group headers), the Remarks footer — and how many empty
// rows a new month's sheet starts with. Columns are fixed fields, so they can't be added or
// removed (shared/abnormalConditionLayout.js; the server enforces it too). Scope is Global or
// one Department; the sheet has no section level. Saving writes the layout and the Revision
// Table record together.
const AbnormalConditionLayoutEditor = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const permissions = user?.customRole?.permissions || [];
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin || permissions.includes('abnormal_condition:edit_layout') || permissions.includes('revision:update');

    const returnTo = location.state?.from;
    const cameFromRevisionTable = !returnTo && location.pathname.includes('/revision-table/');
    const sheetPath = location.pathname.startsWith('/portal') ? '/portal/abnormal-condition' : '/cms/abnormal-condition';
    const backTarget = returnTo || (cameFromRevisionTable ? `/admin/revision-table/${SHEET_KEY}` : sheetPath);
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to Abnormal Condition';

    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    const hasScope = isGlobal || !!deptId;
    const scopeParam = isGlobal ? 'global' : deptId;
    const [zoom, setZoom] = useState(0.9);

    const { data: layoutResp, isFetching: loadingLayout, refetch } = useGetAbnormalConditionLayoutQuery(scopeParam, { skip: !hasScope });
    const [saveLayout, { isLoading: saving }] = useSaveAbnormalConditionLayoutWithRevisionMutation();
    const scope = layoutResp?.data?.scope;

    const [layout, setLayout] = useState(null);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const isDirty = !!layout && JSON.stringify(layout) !== savedSnapshot;

    useEffect(() => {
        if (!hasScope) { setLayout(null); setSavedSnapshot(null); return; }
        const loaded = layoutResp?.data?.layout;
        if (loaded) {
            setLayout(clone(loaded));
            setSavedSnapshot(JSON.stringify(loaded));
        }
    }, [layoutResp, hasScope]);

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
        saveModalOpen && hasScope
    );
    const [remarkText, setRemarkText] = useState("");
    const [remarkTextHi, setRemarkTextHi] = useState("");

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];
    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const clearRevisionInfo = () => {
        setDocNo(""); setRevNo(""); setIssueDate(""); setRevDate("");
        setAffectedSrNoPage(""); setAffectedSrNoPageHi("");
    };

    useEffect(() => {
        if (!hasScope) { clearRevisionInfo(); return; }
        let active = true;
        setLoadingRevisionInfo(true);
        axiosInstance.get(`/api/revision-records/sheet/${SHEET_KEY}`, { params: isGlobal ? {} : { departmentId: deptId } })
            .then((response) => {
                if (!active) return;
                const record = response.data?.data || {};
                setDocNo(record.docNo || "");
                setRevNo(record.revNo || "");
                setIssueDate(record.issueDate || "");
                setRevDate(record.revDate || "");
                setAffectedSrNoPage(record.affectedSrNoPage || "");
                setAffectedSrNoPageHi(record.affectedSrNoPageHi || "");
            })
            .catch(() => { if (active) clearRevisionInfo(); })
            .finally(() => { if (active) setLoadingRevisionInfo(false); });
        return () => { active = false; };
    }, [isGlobal, deptId, hasScope]);

    const inheritanceNote = () => {
        if (!layout) return null;
        if (scope === 'default') {
            return isGlobal
                ? { tone: 'warn', text: "No Global template saved yet — showing the built-in layout. Saving here creates the Global template." }
                : { tone: 'warn', text: "Nothing saved for this department or globally — showing the built-in layout. Saving here creates this department's own layout." };
        }
        if (isGlobal) return { tone: 'ok', text: "Editing the saved Global template — it applies to every department without a layout of its own." };
        if (scope === 'global') {
            return { tone: 'warn', text: "This department has no layout of its own — showing the Global template. Saving here creates a layout just for this department; it will NOT change the Global template." };
        }
        return { tone: 'ok', text: "Showing the layout saved specifically for this department." };
    };

    const edit = (mutate) => setLayout(prev => {
        if (!prev) return prev;
        const next = clone(prev);
        mutate(next);
        return next;
    });

    const fetchHistory = async () => {
        if (!hasScope) return;
        try {
            const response = await axiosInstance.get(`/api/abnormal-conditions/layout/history/${scopeParam}`);
            if (response.data.success) {
                setHistory(response.data.data || []);
                setShowHistory(true);
            }
        } catch {
            toast.error("Failed to fetch layout history");
        }
    };

    const handleOpenSaveModal = () => {
        if (!hasScope) { toast.error("Select a department, or switch to Global"); return; }
        if (!layout) return;
        if (!docNo.trim() || !revNo.trim()) { toast.error("Document No. and Revision No. are required before saving"); return; }
        const errors = validateAbnormalConditionLayout(layout);
        if (errors.length) { toast.error(errors[0]); return; }
        setRemarkText("");
        setRemarkTextHi("");
        setSaveModalOpen(true);
    };

    const handleConfirmSave = async () => {
        if (!remarkText.trim()) { toast.error("Please enter a remark describing your changes"); return; }
        try {
            const result = await saveLayout({
                departmentId: scopeParam,
                layout,
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
            }).unwrap();
            setSavedSnapshot(JSON.stringify(layout));
            setSaveModalOpen(false);
            toast.success(`Layout and revision updated successfully${formatPropagatedToast(result?.data?.revision?.propagatedCount)}`);
            if (cameFromRevisionTable) navigate(`/admin/revision-table/${SHEET_KEY}`);
        } catch (error) {
            toast.error(error?.data?.message || error?.message || "Failed to save layout & revision");
        }
    };

    if (!user) return null;

    if (!canEditConfig) {
        return (
            <Card className="w-full">
                <CardContent className="p-8 text-center space-y-3">
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the Abnormal Condition Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">Abnormal Condition Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Click the title, any column header, or the Remarks text on the sheet below to edit it. Columns are fixed —
                        they line up with the sheet&apos;s data fields — so they can be renamed but not added or removed.
                        Title and Remarks changes apply to every month&apos;s sheet, including past months.
                    </p>
                </div>

                {/* Scope */}
                <div className="border rounded p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wide">Scope</Label>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input type="checkbox" checked={isGlobal} onChange={(e) => { setIsGlobal(e.target.checked); setDeptId(""); }} />
                            Global (applies to all departments)
                        </label>
                    </div>
                    <div className="max-w-sm">
                        <Label className="text-xs mb-1 block">Department</Label>
                        <Select value={deptId} onValueChange={setDeptId} disabled={isGlobal}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select department" /></SelectTrigger>
                            <SelectContent>
                                {assignableDepartments.map((dept) => (
                                    <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-[10px] text-slate-400">A department&apos;s own layout wins over the Global template. The sheet has no section level.</p>
                </div>

                {/* Document Control */}
                <div className="border rounded p-4 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wide">Document Control (Revision Table)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {[
                            ["Form No. *", docNo, setDocNo, ""],
                            ["Rev. No. *", revNo, setRevNo, ""],
                            ["Issue Date", issueDate, setIssueDate, "DD.MM.YYYY"],
                            ["Rev. Date", revDate, setRevDate, "DD.MM.YYYY"],
                            ["Affected Sr. No. / Page", affectedSrNoPage, setAffectedSrNoPage, ""],
                            ["Affected Sr. No. / Page (Hindi)", affectedSrNoPageHi, setAffectedSrNoPageHi, ""],
                        ].map(([label, value, setter, placeholder]) => (
                            <div key={label}>
                                <Label className="text-xs mb-1 block">{label}</Label>
                                <Input className="h-9 text-sm" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} disabled={loadingRevisionInfo} />
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400">These feed the Revision Table entry for Abnormal Condition at this scope and appear in the sheet footer.</p>
                </div>

                {loadingLayout && !layout ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : !layout ? (
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

                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-4 flex-wrap">
                                <Label className="text-xs font-bold uppercase tracking-wide">Live Sheet Preview</Label>
                                <label className="flex items-center gap-2 text-xs">
                                    Rows on a new month&apos;s sheet
                                    <Input
                                        type="number"
                                        min={1}
                                        max={ABNORMAL_CONDITION_MAX_ROWS}
                                        className="h-7 w-20 text-xs"
                                        value={layout.defaultRows ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? '' : Number(e.target.value);
                                            edit(next => { next.defaultRows = value; });
                                        }}
                                    />
                                </label>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 h-8">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => clampZoom(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></Button>
                                <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} value={zoom} onChange={(e) => setZoom(clampZoom(parseFloat(e.target.value)))} className="w-24 cursor-pointer" aria-label="Preview zoom" />
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(z => clampZoom(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></Button>
                                <span className="text-xs font-bold tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
                            </div>
                        </div>

                        {/* ── Live preview built from the same components as the real sheet ── */}
                        <div className="border rounded overflow-auto bg-white max-h-[75vh]">
                            <div style={{ zoom }} className="p-3">
                                <div className="border border-slate-200 rounded-xl min-w-[1200px] w-max bg-white">
                                    <div className="bg-slate-50 border-b p-4 text-lg font-bold text-slate-800">
                                        <AbnormalConditionTitle
                                            title={layout.title}
                                            suffix={`${isGlobal ? 'Department' : (deptName || 'Department')} - ${monthLabel}`}
                                            onEdit={(v) => edit(next => { next.title = v; })}
                                        />
                                    </div>
                                    <table className="w-full border-collapse border border-slate-300 text-slate-800 min-w-[1200px] table-auto">
                                        <thead>
                                            <AbnormalConditionHeaderRows
                                                headers={layout.headers}
                                                onEditText={(key, v) => edit(next => { next.headers[key] = v; })}
                                            />
                                        </thead>
                                        <tbody>
                                            {[...Array(PREVIEW_ROWS)].map((_, i) => (
                                                <tr key={i}>
                                                    <td className="p-2 border border-slate-300 text-center text-xs">{i + 1}</td>
                                                    {[...Array(SHEET_COLUMNS - 1)].map((__, c) => <td key={c} className="p-2 border border-slate-300 h-9" />)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="p-4 border-t bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-semibold text-slate-500">
                                        <div>
                                            Remarks: <span className="text-slate-700 font-bold">
                                                <LayoutText value={layout.remarks} onEdit={(v) => edit(next => { next.remarks = v; })} />
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-6">
                                            <span>FORM NO: <span className="text-slate-700 font-bold">{docNo || '—'}</span></span>
                                            <span>REV NO: <span className="text-slate-700 font-bold">{revNo || '—'}</span></span>
                                            <span>Rev. Date: <span className="text-slate-700 font-bold">{revDate || '—'}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save */}
                        <div className="sticky bottom-0 z-40 bg-white border rounded p-4 flex justify-between items-center gap-3 flex-wrap shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="gap-2" onClick={fetchHistory}><History size={14} /> History</Button>
                                {isDirty && (
                                    <>
                                        <span className="text-xs text-amber-600 font-medium">You have unsaved changes</span>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={() => { setLayout(JSON.parse(savedSnapshot)); refetch(); }}>
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

                <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Save Layout & Update Revision</DialogTitle></DialogHeader>
                        <div className="space-y-2">
                            <p className="text-xs text-slate-500">
                                This updates the layout and the Revision Table record for Abnormal Condition at{" "}
                                {isGlobal ? "the Global scope" : `the ${deptName || "selected"} department`} (Form No: {docNo}, Rev. No: {revNo}).
                            </p>
                            <Label className="text-xs">Remark / Change Details *</Label>
                            <Textarea className="text-sm" value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="e.g. Renamed the 'Resp' column to 'Responsibility'" autoFocus />
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

                <Dialog open={showHistory} onOpenChange={setShowHistory}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Abnormal Condition Layout History</DialogTitle></DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {history.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No layout changes recorded yet for this scope.</div>
                            ) : history.map((entry) => (
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
                                                setLayout(resolveAbnormalConditionLayout(entry.config));
                                                setShowHistory(false);
                                                toast.info("Restored from history — not saved yet");
                                            }}
                                        >
                                            Restore this version
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <DialogFooter><Button variant="outline" onClick={() => setShowHistory(false)}>Close</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

export default AbnormalConditionLayoutEditor;
