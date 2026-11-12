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
    useGetDPRPresentationQuery,
    useSaveDPRPresentationWithRevisionMutation,
} from "@/services/api/DailyProductionReportApi.js";
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
import {
    DPRSectionTitle,
    DPRHeaderCells,
    DPRQualityRows,
    DPRDownTimeRows,
    DPRLayoutText,
} from "./components/DPRLayoutParts.jsx";
import { resolveDprPresentation, validateDprPresentation, DPR_MAX_ROW_COUNT } from "../../../../shared/dprLayout.js";

const SHEET_KEY = 'daily-production-report';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.05;
const clampZoom = (v) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v / ZOOM_STEP) * ZOOM_STEP));
const clone = (value) => JSON.parse(JSON.stringify(value));

const EmptyCells = ({ count }) => [...Array(count)].map((_, i) => <td key={i} className="border border-black h-5" />);

// Dedicated Daily Production Report layout editor. Edits the sheet's PRESENTATION only —
// section titles, header text, Quality / Down Time row labels, footer labels and row counts —
// at Global or Department scope. Header columns and row keys are fixed because the sheet's
// data cells are fixed fields (shared/dprLayout.js; the server enforces it too). Manpower
// rows (Moral / Attendance) are per-line and stay in the DPR Setup tab.
const DPRLayoutEditor = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const permissions = user?.customRole?.permissions || [];
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin || permissions.includes('dpr:edit_layout') || permissions.includes('revision:update');

    const returnTo = location.state?.from;
    const cameFromRevisionTable = !returnTo && location.pathname.includes('/revision-table/');
    const reportPath = location.pathname.startsWith('/portal') ? '/portal/daily-production-report' : '/admin/daily-production-report';
    const backTarget = returnTo || (cameFromRevisionTable ? `/admin/revision-table/${SHEET_KEY}` : reportPath);
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to Daily Production Report';

    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    const linkedSectionId = searchParams.get('sectionId');
    const hasScope = isGlobal || !!deptId;
    const scopeParam = isGlobal ? 'global' : deptId;
    const [zoom, setZoom] = useState(0.9);

    const { data: presentationResp, isFetching: loadingConfig, refetch } = useGetDPRPresentationQuery(scopeParam, { skip: !hasScope });
    const [savePresentation, { isLoading: saving }] = useSaveDPRPresentationWithRevisionMutation();

    const [layout, setLayout] = useState(null);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    const isDirty = !!layout && JSON.stringify(layout) !== savedSnapshot;
    const scope = presentationResp?.data?.scope;

    // (Re)load the editable copy whenever the scope's saved layout arrives.
    useEffect(() => {
        if (!hasScope) { setLayout(null); setSavedSnapshot(null); return; }
        const loaded = presentationResp?.data?.presentation;
        if (loaded) {
            setLayout(clone(loaded));
            setSavedSnapshot(JSON.stringify(loaded));
        }
    }, [presentationResp, hasScope]);

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

    // ── Edits (all text / counts; structure is fixed) ───────────────────────
    const edit = (mutate) => setLayout(prev => {
        if (!prev) return prev;
        const next = clone(prev);
        mutate(next);
        return next;
    });
    const editTitle = (section, field = 'title') => (value) => edit(next => { next[section][field] = value; });
    const editHeader = (section) => (index, value) => edit(next => { next[section].headers[index].text = value; });
    const editQualityLabel = (path, value) => edit(next => {
        const section = next.quality.sections.find(s => s.name === path.section);
        if (!section) return;
        if (path.field === undefined) section.label = value;
        else section.fields[path.field] = value;
    });
    const editDownTimeLabel = (path, value) => edit(next => {
        if (path.group !== undefined) { next.downTime.rows[path.group].label = value; return; }
        next.downTime.rows.forEach(row => {
            if (row.key === path.key) row.label = value;
            (row.children || []).forEach(child => { if (child.key === path.key) child.label = value; });
        });
    });
    const setCount = (section) => (e) => {
        const value = e.target.value === '' ? '' : Number(e.target.value);
        edit(next => { next[section].rows = value; });
    };

    const fetchHistory = async () => {
        if (!hasScope) return;
        try {
            const response = await axiosInstance.get(`/api/daily-production-report/history/${scopeParam}`);
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
        const errors = validateDprPresentation(layout, resolveDprPresentation(JSON.parse(savedSnapshot || 'null')));
        if (errors.length) { toast.error(errors[0]); return; }
        setRemarkText("");
        setRemarkTextHi("");
        setSaveModalOpen(true);
    };

    const handleConfirmSave = async () => {
        if (!remarkText.trim()) { toast.error("Please enter a remark describing your changes"); return; }
        try {
            const result = await savePresentation({
                departmentId: scopeParam,
                presentation: layout,
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
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the DPR Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const countInput = (section, label) => (
        <label className="flex items-center gap-2 text-xs">
            {label}
            <Input
                type="number"
                min={1}
                max={DPR_MAX_ROW_COUNT}
                className="h-7 w-20 text-xs"
                value={layout?.[section]?.rows ?? ''}
                onChange={setCount(section)}
            />
        </label>
    );

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">Daily Production Report Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Click any title, header, or row label on the sheet below to edit its text. Columns and rows are fixed —
                        they line up with the report&apos;s data fields — so they can be renamed but not added, removed, or reordered.
                        Moral and Manpower Attendance rows are set per line in the DPR Setup tab.
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
                    <p className="text-[10px] text-slate-400">
                        A department&apos;s own layout wins over the Global template. DPR layouts apply to the whole department — there is no section level.
                    </p>
                    {linkedSectionId && !isGlobal && (
                        <div className="text-xs rounded p-2 border bg-amber-50 border-amber-200 text-amber-700">
                            You opened this from a section-level revision record. The layout and revision saved here apply to the whole
                            department; a section-level revision override (edit it in the Revision Table) still takes precedence for that section&apos;s footer.
                        </div>
                    )}
                </div>

                {/* Document Control */}
                <div className="border rounded p-4 space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wide">Document Control (Revision Table)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        {[
                            ["Doc. No. *", docNo, setDocNo, ""],
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
                    <p className="text-[10px] text-slate-400">These feed the Revision Table entry for the Daily Production Report at this scope.</p>
                </div>

                {loadingConfig && !layout ? (
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
                                {countInput('delivery', 'Delivery rows')}
                                {countInput('shiftComm', 'Shift communication rows')}
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
                                <div className="min-w-[1000px] border-[2px] border-black bg-white text-black p-1 text-[11px] leading-tight font-sans">
                                    <div className="font-bold text-xl ml-4 mb-1">Daily Production Report ({isGlobal ? 'All departments' : (deptName || 'Department')})</div>

                                    <div className="flex w-full mb-1">
                                        <div className="w-[70%] border-r-[2px] border-black pr-1">
                                            <DPRSectionTitle title={layout.delivery.title} onEdit={editTitle('delivery')} />
                                            <table className="w-full border-collapse border border-black text-center mt-1">
                                                <thead><tr className="bg-gray-100"><DPRHeaderCells headers={layout.delivery.headers} thClassName="p-1" onEditText={editHeader('delivery')} /></tr></thead>
                                                <tbody>
                                                    {[...Array(Number(layout.delivery.rows) || 0)].map((_, i) => (
                                                        <tr key={i} className="h-5"><td className="border border-black">{i + 1}</td><EmptyCells count={9} /></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="w-[30%] pl-1">
                                            <DPRSectionTitle title={layout.quality.title} onEdit={editTitle('quality')} />
                                            <table className="w-full border-collapse border border-black mt-1 text-left">
                                                <DPRQualityRows
                                                    sections={layout.quality.sections}
                                                    renderValue={() => <td className="border border-black w-20" />}
                                                    onEditLabel={editQualityLabel}
                                                />
                                            </table>
                                        </div>
                                    </div>

                                    <div className="flex w-full">
                                        <div className="w-[55%] border-r-[2px] border-black pr-1">
                                            <DPRSectionTitle title={layout.downTime.title} onEdit={editTitle('downTime')} />
                                            <table className="w-full border-collapse border border-black mt-1 text-[10px]">
                                                <thead><tr className="bg-gray-100 text-center text-[9px]"><DPRHeaderCells headers={layout.downTime.headers} thClassName="p-0.5" onEditText={editHeader('downTime')} /></tr></thead>
                                                <tbody>
                                                    <DPRDownTimeRows rows={layout.downTime.rows} renderValues={() => <EmptyCells count={5} />} onEditLabel={editDownTimeLabel} />
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="w-[45%] pl-1 flex flex-col pt-1">
                                            <DPRSectionTitle title={layout.shiftComm.title} onEdit={editTitle('shiftComm')} />
                                            <table className="w-full border-collapse border border-black text-center mb-1 text-[10px]">
                                                <thead>
                                                    <tr className="bg-gray-100"><th className="border border-black" colSpan={2}><DPRLayoutText value={layout.shiftComm.headerText} onEdit={editTitle('shiftComm', 'headerText')} /></th></tr>
                                                    <tr className="bg-gray-100 h-5"><th className="border border-black w-10">Sr. No.</th><th className="border border-black">Issues and Information</th></tr>
                                                </thead>
                                                <tbody>
                                                    {[...Array(Number(layout.shiftComm.rows) || 0)].map((_, i) => (
                                                        <tr key={i} className="h-5"><td className="border border-black">{i + 1}</td><td className="border border-black" /></tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <DPRSectionTitle title={layout.moral.title} onEdit={editTitle('moral')} className="mt-1" />
                                            <table className="w-full border-collapse border border-black text-[10px] mt-1 text-center">
                                                <thead><tr className="bg-gray-100 h-5"><DPRHeaderCells headers={layout.moral.headers} onEditText={editHeader('moral')} /></tr></thead>
                                                <tbody>
                                                    <tr><td colSpan={layout.moral.headers.length} className="border border-black py-2 italic text-slate-400">Process rows come from each line&apos;s DPR Setup</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <DPRSectionTitle title={layout.footer.efficiencyTitle} onEdit={editTitle('footer', 'efficiencyTitle')} className="mt-1" />
                                    <div className="text-center italic text-slate-400 py-2 border border-black border-t-0">Direct efficiency, defect details, manpower attendance and Kaizen sections (fixed)</div>

                                    <DPRSectionTitle title={layout.footer.signatureTitle} onEdit={editTitle('footer', 'signatureTitle')} className="mt-2" />
                                    <table className="w-full border-collapse border border-black font-bold mt-1 text-[11px]">
                                        <tbody>
                                            <tr>
                                                <td className="border border-black p-1 text-right pr-4 bg-gray-100 w-[40%]"><DPRLayoutText value={layout.footer.madeByLabel} onEdit={editTitle('footer', 'madeByLabel')} /></td>
                                                <td className="border border-black w-[60%]" />
                                            </tr>
                                            <tr>
                                                <td className="border border-black p-1 text-right pr-4 bg-gray-100"><DPRLayoutText value={layout.footer.checkedByLabel} onEdit={editTitle('footer', 'checkedByLabel')} /></td>
                                                <td className="border border-black" />
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div className="mt-2 flex justify-between text-[11px] font-bold border-t border-black pt-1 px-2">
                                        <span>{docNo || '—'}</span><span>Rev No {revNo || '—'}</span><span>Rev Date: {revDate || issueDate || '—'}</span>
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
                                This updates the layout and the Revision Table record for the Daily Production Report at{" "}
                                {isGlobal ? "the Global scope" : `the ${deptName || "selected"} department`} (Doc. No: {docNo}, Rev. No: {revNo}).
                                Manpower rows are not changed.
                            </p>
                            <Label className="text-xs">Remark / Change Details *</Label>
                            <Textarea className="text-sm" value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="e.g. Renamed the Down Time 'Tube shortage' row" autoFocus />
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
                        <DialogHeader><DialogTitle>DPR Layout History</DialogTitle></DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {history.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No changes recorded yet for this scope.</div>
                            ) : history.map((entry) => (
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
                                                // History rows also include DPR Setup (manpower) saves; only
                                                // their presentation part is restored here.
                                                setLayout(resolveDprPresentation(entry.config));
                                                setShowHistory(false);
                                                toast.info("Restored from history — not saved yet");
                                            }}
                                        >
                                            Restore this layout
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

export default DPRLayoutEditor;
