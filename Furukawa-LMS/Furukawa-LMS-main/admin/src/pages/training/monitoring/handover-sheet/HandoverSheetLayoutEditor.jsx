import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/common/ui/card.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Input } from "@/components/forms/primitives/input.jsx";
import { Label } from "@/components/forms/primitives/label.jsx";
import { Textarea } from "@/components/forms/primitives/textarea.jsx";
import { Loader2, Save, History, ArrowLeft, ChevronLeft, ChevronRight, Lock, Unlock, EyeOff, Eye } from "lucide-react";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { toast } from "sonner";
import PropagationNotice from "@/pages/reports/components/revision/PropagationNotice.jsx";
import usePropagationPreview, { formatPropagatedToast } from "@/hooks/usePropagationPreview.js";
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
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
import { HandoverHeaderCells, HandoverTitle, HandoverFromLabel } from "@/components/common/departments/HandoverLayoutParts.jsx";
import {
    resolveHandoverLayout,
    validateHandoverLayout,
    visibleHandoverColumns,
    HANDOVER_REQUIRED_FIELDS,
} from "../../../../../../shared/handoverSheetLayout.js";

const SHEET_KEY = 'handover-sheet';
const PREVIEW_ROWS = 3;
const clone = (value) => JSON.parse(JSON.stringify(value));

// Dedicated Handover Sheet layout editor: the title, the "From:" label and the built-in
// columns — rename, move, make read-only, or hide (S.No and Employee Name always show; the
// Approve / Reject column is always last). Custom columns are not supported
// (shared/handoverSheetLayout.js; the server enforces it too). Scope is Global, a Department,
// or a Section; saving writes the layout and the Revision Table record together.
const HandoverSheetLayoutEditor = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const permissions = user?.customRole?.permissions || [];
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin || permissions.includes('handover_sheet:edit_layout') || permissions.includes('revision:update');

    const returnTo = location.state?.from;
    const cameFromRevisionTable = !returnTo && location.pathname.includes('/revision-table/');
    const sheetPath = location.pathname.startsWith('/portal') ? '/portal/handover-sheet' : '/admin/handover-sheet';
    const backTarget = returnTo || (cameFromRevisionTable ? `/admin/revision-table/${SHEET_KEY}` : sheetPath);
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to Handover Sheet';

    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    const [sectionId, setSectionId] = useState(searchParams.get('sectionId') || "");
    const hasScope = isGlobal || !!deptId;
    const scopeKey = isGlobal ? 'global' : `${deptId}:${sectionId || ''}`;

    const [layout, setLayout] = useState(null);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const [scope, setScope] = useState(null);
    const [loadingLayout, setLoadingLayout] = useState(false);
    const isDirty = !!layout && JSON.stringify(layout) !== savedSnapshot;

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
        isGlobal ? null : (sectionId || null),
        saveModalOpen && hasScope
    );
    const [remarkText, setRemarkText] = useState("");
    const [remarkTextHi, setRemarkTextHi] = useState("");
    const [saving, setSaving] = useState(false);

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];
    const { data: sectionData } = useGetSectionsByDepartmentQuery(deptId, { skip: !deptId || isGlobal });
    const sections = sectionData?.data || [];
    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const layoutUrl = () => (isGlobal
        ? `/api/departments/handover-sheet/layout/global`
        : `/api/departments/handover-sheet/layout/${deptId}?sectionId=${sectionId || ""}`);

    const fetchLayout = async () => {
        if (!hasScope) { setLayout(null); setSavedSnapshot(null); setScope(null); return; }
        try {
            setLoadingLayout(true);
            const response = await axiosInstance.get(layoutUrl());
            const loaded = response.data?.data?.layout || resolveHandoverLayout(null);
            setLayout(clone(loaded));
            setSavedSnapshot(JSON.stringify(loaded));
            setScope(response.data?.data?.scope || 'default');
        } catch {
            toast.error("Failed to load layout");
        } finally {
            setLoadingLayout(false);
        }
    };

    const clearRevisionInfo = () => {
        setDocNo(""); setRevNo(""); setIssueDate(""); setRevDate("");
        setAffectedSrNoPage(""); setAffectedSrNoPageHi("");
    };

    const fetchRevisionInfo = async () => {
        if (!hasScope) { clearRevisionInfo(); return; }
        try {
            setLoadingRevisionInfo(true);
            const params = {};
            if (!isGlobal) params.departmentId = deptId;
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
        fetchLayout();
        fetchRevisionInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeKey]);

    const inheritanceNote = () => {
        if (!layout) return null;
        const here = isGlobal ? 'global' : (sectionId ? 'section' : 'department');
        if (scope === 'default') {
            return { tone: 'warn', text: "Nothing saved anywhere in this chain — showing the built-in layout. Saving here creates a layout just for this exact selection." };
        }
        if (scope === here) return { tone: 'ok', text: "Showing the layout saved specifically for this exact selection." };
        const from = scope === 'global' ? 'the Global template' : 'the department-wide layout';
        return { tone: 'warn', text: `Nothing saved for this exact selection — showing ${from}. Saving here creates a new, more specific layout; it will NOT change ${from}.` };
    };

    // ── Edits ───────────────────────────────────────────────────────────────
    const edit = (mutate) => setLayout(prev => {
        if (!prev) return prev;
        const next = clone(prev);
        mutate(next);
        return next;
    });
    const editHeader = (field, value) => edit(next => {
        if (field === 'status') { next.statusHeader = value; return; }
        const col = next.columns.find(c => c.field === field);
        if (col) col.header = value;
    });
    const toggle = (field, prop) => edit(next => {
        const col = next.columns.find(c => c.field === field);
        if (!col) return;
        if (prop === 'hidden' && HANDOVER_REQUIRED_FIELDS.includes(field)) return;
        col[prop] = !col[prop];
    });
    // Moves a column past its visible neighbour (hidden columns keep their place).
    const move = (field, dir) => edit(next => {
        const cols = next.columns;
        const from = cols.findIndex(c => c.field === field);
        let to = from + dir;
        while (to >= 0 && to < cols.length && cols[to].hidden) to += dir;
        if (from < 0 || to < 0 || to >= cols.length) return;
        const [col] = cols.splice(from, 1);
        cols.splice(to, 0, col);
    });

    const fetchHistory = async () => {
        if (!hasScope) return;
        try {
            const url = isGlobal
                ? `/api/departments/handover-sheet/history/global`
                : `/api/departments/handover-sheet/history/${deptId}?sectionId=${sectionId || ""}`;
            const response = await axiosInstance.get(url);
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
        const errors = validateHandoverLayout(layout);
        if (errors.length) { toast.error(errors[0]); return; }
        setRemarkText("");
        setRemarkTextHi("");
        setSaveModalOpen(true);
    };

    const handleConfirmSave = async () => {
        if (!remarkText.trim()) { toast.error("Please enter a remark describing your changes"); return; }
        try {
            setSaving(true);
            const response = await axiosInstance.post(`/api/departments/handover-sheet/layout/save-with-revision`, {
                departmentId: isGlobal ? 'global' : deptId,
                sectionId: isGlobal ? null : (sectionId || null),
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
            });
            setSavedSnapshot(JSON.stringify(layout));
            setScope(isGlobal ? 'global' : (sectionId ? 'section' : 'department'));
            setSaveModalOpen(false);
            toast.success(`Layout and revision updated successfully${formatPropagatedToast(response.data?.data?.revision?.propagatedCount)}`);
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
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the Handover Sheet Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const sectionName = sections.find(s => String(s._id || s.id) === sectionId)?.name;
    const visibleColumns = layout ? visibleHandoverColumns(layout) : [];
    const hiddenColumns = layout ? layout.columns.filter(c => c.hidden) : [];

    const columnControls = (col) => (
        <div className="flex items-center justify-center gap-0.5 mt-1 no-print">
            <button type="button" title="Move left" className="p-0.5 rounded hover:bg-slate-200" onClick={() => move(col.field, -1)}><ChevronLeft size={12} /></button>
            <button type="button" title={col.readOnly ? "Read-only — click to allow editing" : "Editable — click to make read-only"} className="p-0.5 rounded hover:bg-slate-200" onClick={() => toggle(col.field, 'readOnly')}>
                {col.readOnly ? <Lock size={12} className="text-amber-600" /> : <Unlock size={12} className="text-slate-400" />}
            </button>
            {!HANDOVER_REQUIRED_FIELDS.includes(col.field) && (
                <button type="button" title="Hide column" className="p-0.5 rounded hover:bg-slate-200" onClick={() => toggle(col.field, 'hidden')}><EyeOff size={12} className="text-slate-500" /></button>
            )}
            <button type="button" title="Move right" className="p-0.5 rounded hover:bg-slate-200" onClick={() => move(col.field, 1)}><ChevronRight size={12} /></button>
        </div>
    );

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">Handover Sheet Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Click the title, the &quot;From&quot; label or any column header to rename it. Under each header: move it left/right,
                        lock it as read-only, or hide it. S.No and Employee Name always show, and Approve / Reject is always the last column.
                        New columns can&apos;t be added — the sheet only stores its built-in fields.
                    </p>
                </div>

                {/* Scope */}
                <div className="border rounded p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold uppercase tracking-wide">Scope</Label>
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input type="checkbox" checked={isGlobal} onChange={(e) => { setIsGlobal(e.target.checked); setDeptId(""); setSectionId(""); }} />
                            Global (applies to all departments)
                        </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs mb-1 block">Department</Label>
                            <Select value={deptId} onValueChange={(v) => { setDeptId(v); setSectionId(""); }} disabled={isGlobal}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>
                                    {assignableDepartments.map((dept) => (
                                        <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs mb-1 block">Section (optional)</Label>
                            <Select value={sectionId} onValueChange={setSectionId} disabled={isGlobal || !deptId}>
                                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All sections" /></SelectTrigger>
                                <SelectContent>
                                    {sections.map((sec) => (
                                        <SelectItem key={sec._id || sec.id} value={String(sec._id || sec.id)}>{sec.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400">The most specific saved layout wins: Section &gt; Department &gt; Global. Leave Section blank to edit the department-wide layout.</p>
                </div>

                {/* Document Control */}
                <div className="border rounded p-4 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wide">Document Control (Revision Table)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {[
                            ["Document No. *", docNo, setDocNo, ""],
                            ["Revision No. *", revNo, setRevNo, ""],
                            ["Issue Date", issueDate, setIssueDate, "DD.MM.YY"],
                            ["Revision Date", revDate, setRevDate, "DD.MM.YYYY"],
                            ["Affected Sr. No. / Page", affectedSrNoPage, setAffectedSrNoPage, ""],
                            ["Affected Sr. No. / Page (Hindi)", affectedSrNoPageHi, setAffectedSrNoPageHi, ""],
                        ].map(([label, value, setter, placeholder]) => (
                            <div key={label}>
                                <Label className="text-xs mb-1 block">{label}</Label>
                                <Input className="h-9 text-sm" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} disabled={loadingRevisionInfo} />
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400">
                        These appear in the sheet header. They are no longer typed on each sheet — saving here updates them on every saved sheet in this scope.
                    </p>
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

                        {/* ── Live preview built from the same components as the real sheet ── */}
                        <div className="border rounded overflow-auto bg-white">
                            <div className="p-4 space-y-4 min-w-[900px]">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="text-xl font-bold text-center uppercase flex-1">
                                        <HandoverTitle title={layout.title} onEdit={(v) => edit(next => { next.title = v; })} />
                                    </div>
                                    <div className="text-[10px] text-right text-muted-foreground space-y-0.5">
                                        <div><span className="font-semibold">DOCUMENT NO.</span> {docNo || '—'}</div>
                                        <div><span className="font-semibold">REVISION No.</span> {revNo || '—'}</div>
                                        <div><span className="font-semibold">REVISION DATE:</span> {revDate || '—'}</div>
                                        <div><span className="font-semibold">ISSUE DT.</span> {issueDate || '—'}</div>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm font-medium">
                                    <div>From: <span className="text-blue-600">
                                        <HandoverFromLabel value={layout.fromLabel} onEdit={(v) => edit(next => { next.fromLabel = v; })} />
                                    </span></div>
                                    <div>To: <span className="text-blue-600">{isGlobal ? 'Department / Section' : (sectionName || deptName || 'Department')}</span></div>
                                </div>
                                <div className="border border-gray-300 overflow-x-auto">
                                    <table className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <HandoverHeaderCells
                                                    columns={visibleColumns}
                                                    statusHeader={layout.statusHeader}
                                                    onEditHeader={editHeader}
                                                    renderExtra={columnControls}
                                                />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...Array(PREVIEW_ROWS)].map((_, i) => (
                                                <tr key={i}>
                                                    {visibleColumns.map((col) => (
                                                        <td key={col.field} className={`border p-2 h-9 text-center ${col.readOnly ? 'bg-slate-50 text-slate-400' : ''}`}>
                                                            {col.field === 'sn' ? i + 1 : (col.readOnly ? 'read-only' : '')}
                                                        </td>
                                                    ))}
                                                    <td className="border p-2 text-center text-[10px] text-slate-400 italic">Pending Approval</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {hiddenColumns.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className="text-slate-500">Hidden columns:</span>
                                        {hiddenColumns.map((col) => (
                                            <Button key={col.field} size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => toggle(col.field, 'hidden')}>
                                                <Eye size={11} /> {col.header}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Save */}
                        <div className="sticky bottom-0 z-40 bg-white border rounded p-4 flex justify-between items-center gap-3 flex-wrap shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center gap-3">
                                <Button variant="outline" className="gap-2" onClick={fetchHistory}><History size={14} /> History</Button>
                                {isDirty && (
                                    <>
                                        <span className="text-xs text-amber-600 font-medium">You have unsaved changes</span>
                                        <Button variant="outline" size="sm" className="text-xs" onClick={fetchLayout}>Reset to Saved</Button>
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
                                This updates the layout and the Revision Table record for the Handover Sheet at{" "}
                                {isGlobal ? "the Global scope" : (sectionId ? "this Section" : "this Department")} (Doc. No: {docNo}, Rev. No: {revNo}).
                            </p>
                            <Label className="text-xs">Remark / Change Details *</Label>
                            <Textarea className="text-sm" value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="e.g. Renamed 'Marks Secured' and hid the Mentor column" autoFocus />
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
                        <DialogHeader><DialogTitle>Handover Sheet Layout History</DialogTitle></DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {history.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No layout changes recorded yet for this scope.</div>
                            ) : history.map((entry, idx) => (
                                <div key={entry.id || idx} className="border rounded p-2 text-xs space-y-1">
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
                                                setLayout(resolveHandoverLayout(entry.config));
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

export default HandoverSheetLayoutEditor;
