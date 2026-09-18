import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Save, History, ArrowLeft } from "lucide-react";
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from "sonner";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
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
    normalizeConfig,
    buildDefaultConfig,
    computeTotalWeightage,
    ROW_SCORING_TYPES,
} from "@/utils/sixteenDayMonitoringConfig";

const SHEET_KEY = 'sixteen-day-monitoring';
const DAY_NUMBERS = Array.from({ length: 16 }, (_, i) => i + 1);

// Builds one representative sample value per day for a check-item row, purely for the
// live preview — never sent to the server. Day 6 is nudged to look like a minor miss so
// the preview also demonstrates what a below-target day looks like.
const sampleDayValue = (row, dayIdx) => {
    const isNumericWeight = row.weight !== undefined && row.weight !== null && row.weight !== '' && !isNaN(row.weight);
    if (!isNumericWeight) return dayIdx === 6 ? '2' : '3'; // descriptive rows (e.g. defects) show sample counts
    const max = Number(row.weight);
    if (row.type === 'cycle_detailed') return dayIdx === 6 ? `${max - 1}` : `${max}`;
    return dayIdx === 6 ? String(Math.max(0, max - 1)) : String(max);
};

// Dedicated 16-Day Monitoring layout editor: scope picker, direct document-control
// fields, visual Category/Checkpoint/Score-Range/Evaluation-Legend builders, a live
// high-fidelity sheet preview, and a single-remark atomic save (layout + revision
// record together). Reachable from the Revision Table's Edit/Add-Override buttons
// and from a header action on the 16-Day Monitoring sheet itself — see
// RevisionSheetHistory.jsx and SixteenDayMonitoringSheet.jsx respectively.
const SixteenDayMonitoringLayoutEditor = () => {
    const { sheetKey } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canEditConfig = isAdmin || user?.isTrainer
        || user?.customRole?.permissions?.includes('sixteen_day:manage')
        || user?.customRole?.permissions?.includes('sixteen_day:edit_layout')
        || user?.customRole?.permissions?.includes('revision:update');

    const [logAction] = useLogActionMutation();

    const cameFromRevisionTable = location.pathname.includes('/revision-table/');
    const backTarget = cameFromRevisionTable
        ? `/admin/revision-table/${sheetKey || SHEET_KEY}`
        : '/admin/16-day-monitoring';
    const backLabel = cameFromRevisionTable ? 'Back to Revision Table' : 'Back to 16-Day Monitoring';

    // Scope: department + section, or Global — 16-Day Monitoring has no line/sub-section scope.
    const [isGlobal, setIsGlobal] = useState(searchParams.get('global') === '1' || !searchParams.get('departmentId'));
    const [deptId, setDeptId] = useState(searchParams.get('departmentId') || "");
    const [sectionId, setSectionId] = useState(searchParams.get('sectionId') || "");

    const [config, setConfig] = useState(null);
    const [resolvedScope, setResolvedScope] = useState(null);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    // Document Control fields — direct, always-visible inputs, pre-populated from the
    // Revision Table for the active scope.
    const [docNo, setDocNo] = useState("");
    const [revNo, setRevNo] = useState("");
    const [revDate, setRevDate] = useState("");
    const [affectedSrNoPage, setAffectedSrNoPage] = useState("");
    const [loadingRevisionInfo, setLoadingRevisionInfo] = useState(false);

    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [remarkText, setRemarkText] = useState("");
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

    const fetchConfig = async () => {
        if (!isGlobal && !deptId) {
            setConfig(buildDefaultConfig());
            setResolvedScope(null);
            return;
        }
        try {
            setLoadingConfig(true);
            const qs = !isGlobal && sectionId ? `?sectionId=${sectionId}` : "";
            const response = await axiosInstance.get(`/api/sixteen-day-monitoring/config/${deptParam()}${qs}`);
            setConfig(normalizeConfig(response.data?.data?.config));
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

    // ── Category / Row editors ──────────────────────────────────────────────
    const updateCategoryField = (catId, field, value) => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const cat = next.categories.find(c => c.id === catId);
            if (cat) cat[field] = value;
            return next;
        });
    };

    const addCategory = () => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const n = next.categories.length + 1;
            const newId = `cat_${Date.now()}`;
            next.categories.push({
                id: newId,
                category: `New Category ${n}`,
                rows: [{ id: `row_${Date.now()}`, label: 'New check item', weight: 2 }],
                totalMark: 2,
                target: '100%',
            });
            return next;
        });
    };

    const removeCategory = (catId) => {
        setConfig(prev => {
            if (!prev) return prev;
            if (prev.categories.length <= 1) {
                toast.error("At least one category is required");
                return prev;
            }
            const next = JSON.parse(JSON.stringify(prev));
            next.categories = next.categories.filter(c => c.id !== catId);
            // Score ranges that pointed at the removed category fall back to unlinked (Attendance-style).
            next.scoreRanges.forEach(r => { if (r.catId === catId) r.catId = null; });
            return next;
        });
    };

    const updateRowField = (catId, rowId, field, value) => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const cat = next.categories.find(c => c.id === catId);
            const row = cat?.rows.find(r => r.id === rowId);
            if (row) row[field] = value;
            return next;
        });
    };

    const addRow = (catId) => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const cat = next.categories.find(c => c.id === catId);
            if (!cat) return prev;
            cat.rows.push({ id: `row_${Date.now()}`, label: 'New check item', weight: 2 });
            return next;
        });
    };

    const removeRow = (catId, rowId) => {
        setConfig(prev => {
            if (!prev) return prev;
            const cat = prev.categories.find(c => c.id === catId);
            if (!cat || cat.rows.length <= 1) {
                toast.error("Each category needs at least one check item");
                return prev;
            }
            const next = JSON.parse(JSON.stringify(prev));
            const nextCat = next.categories.find(c => c.id === catId);
            nextCat.rows = nextCat.rows.filter(r => r.id !== rowId);
            return next;
        });
    };

    // ── Score range editors ─────────────────────────────────────────────────
    const updateScoreRange = (idx, field, value) => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.scoreRanges[idx][field] = value;
            return next;
        });
    };

    const addScoreRange = () => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.scoreRanges.push({ id: `score_${Date.now()}`, catId: null, label: 'New Parameter', weight: 0.1, poor: '0-70', avg: '71-80', good: '81-90', excel: '91-100' });
            return next;
        });
    };

    const removeScoreRange = (idx) => {
        setConfig(prev => {
            if (!prev) return prev;
            if (prev.scoreRanges.length <= 1) {
                toast.error("At least one score range is required");
                return prev;
            }
            const next = JSON.parse(JSON.stringify(prev));
            next.scoreRanges.splice(idx, 1);
            return next;
        });
    };

    // ── Evaluation legend editors ───────────────────────────────────────────
    const updateLegendItem = (group, idx, field, value) => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.evaluationLegends[group][idx][field] = value;
            return next;
        });
    };

    const addLegendItem = (group) => {
        setConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            next.evaluationLegends[group].push({ score: next.evaluationLegends[group].length, label: 'New criteria' });
            return next;
        });
    };

    const removeLegendItem = (group, idx) => {
        setConfig(prev => {
            if (!prev) return prev;
            if (prev.evaluationLegends[group].length <= 1) {
                toast.error("At least one legend row is required");
                return prev;
            }
            const next = JSON.parse(JSON.stringify(prev));
            next.evaluationLegends[group].splice(idx, 1);
            return next;
        });
    };

    const fetchHistory = async () => {
        if (!isGlobal && !deptId) return;
        try {
            const qs = !isGlobal && sectionId ? `?sectionId=${sectionId}` : "";
            const response = await axiosInstance.get(`/api/sixteen-day-monitoring/history/${deptParam()}${qs}`);
            if (response.data.success) {
                setHistory(response.data.data || []);
                setShowHistory(true);
                logAction({
                    action: 'VIEW_SIXTEEN_DAY_MONITORING_LAYOUT_HISTORY',
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
            await axiosInstance.post(`/api/sixteen-day-monitoring/config/save-with-revision`, {
                departmentId: isGlobal ? null : deptId,
                sectionId: isGlobal ? 0 : (sectionId || 0),
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
            setConfig(newConfig);
            setSaveModalOpen(false);
            setRemarkText("");
            toast.success("Layout and revision updated successfully");

            logAction({
                action: "SAVE_SIXTEEN_DAY_MONITORING_CONFIG_WITH_REVISION",
                details: {
                    departmentId: isGlobal ? null : deptId,
                    sectionId: isGlobal ? null : (sectionId || null),
                    remark: remarkText.trim(),
                    docNo, revNo,
                }
            }).unwrap().catch(() => {});

            if (cameFromRevisionTable) {
                navigate(`/admin/revision-table/${sheetKey || SHEET_KEY}`);
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
                    <div className="text-lg font-semibold text-slate-700">You don&apos;t have access to the 16-Day Monitoring Layout Editor.</div>
                    <Button variant="outline" onClick={() => navigate(backTarget)}>Go Back</Button>
                </CardContent>
            </Card>
        );
    }

    const note = inheritanceNote();
    const deptName = assignableDepartments.find(d => String(d._id || d.id) === deptId)?.name;
    const sectionName = sections.find(s => String(s._id || s.id) === sectionId)?.name;
    const totalWeightage = config ? computeTotalWeightage(config.scoreRanges) : 0;

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">
                <div>
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2 mb-1 text-slate-500" onClick={() => navigate(backTarget)}>
                        <ArrowLeft size={14} /> {backLabel}
                    </Button>
                    <h1 className="text-xl font-bold">16-Day Monitoring Layout Editor</h1>
                    <p className="text-sm text-slate-500">
                        Customize categories, inspection checkpoints, scoring types, weightages, score ranges, and evaluation legends —
                        along with the sheet&apos;s document-control revision fields. Changes apply to whichever scope you select below.
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
                        These feed the Revision Table entry for 16-Day Monitoring at this scope, and appear on the printed sheet&apos;s title bar.
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

                        {/* Categories & Checkpoints */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wide">Categories & Inspection Checkpoints</Label>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addCategory}>
                                    <Plus size={12} /> Add Category
                                </Button>
                            </div>
                            {config.categories.map((cat) => (
                                <div key={cat.id} className="border rounded p-3 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_120px_150px_32px] gap-2 items-start">
                                        <div>
                                            <Label className="text-[10px] mb-1 block">Category Name</Label>
                                            <Textarea className="text-xs h-16" value={cat.category} onChange={(e) => updateCategoryField(cat.id, 'category', e.target.value)} />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] mb-1 block">Total Mark</Label>
                                            <Input className="h-8 text-xs" value={cat.totalMark ?? ''} onChange={(e) => updateCategoryField(cat.id, 'totalMark', e.target.value)} placeholder="e.g. 6" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] mb-1 block">Target %</Label>
                                            <Input className="h-8 text-xs" value={cat.target ?? ''} onChange={(e) => updateCategoryField(cat.id, 'target', e.target.value)} placeholder="e.g. 100%" />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] mb-1 block">Actual Label (optional)</Label>
                                            <Input className="h-8 text-xs" value={cat.actualLabel ?? ''} onChange={(e) => updateCategoryField(cat.id, 'actualLabel', e.target.value)} placeholder="Actual %:" />
                                        </div>
                                        <Button size="icon" variant="outline" className="h-8 w-8 mt-4 text-red-500 hover:bg-red-50" onClick={() => removeCategory(cat.id)}>
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>

                                    <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold uppercase text-slate-500">Check Items</Label>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => addRow(cat.id)}>
                                                <Plus size={10} /> Add Item
                                            </Button>
                                        </div>
                                        {cat.rows.map((row) => (
                                            <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_90px_220px_28px] gap-2 items-start">
                                                <Textarea className="text-xs h-10" value={row.label} onChange={(e) => updateRowField(cat.id, row.id, 'label', e.target.value)} placeholder="Check item description" />
                                                <Input className="h-8 text-xs" value={row.weight ?? ''} onChange={(e) => updateRowField(cat.id, row.id, 'weight', e.target.value)} placeholder="Mark or -" />
                                                <Select value={row.type || ''} onValueChange={(v) => updateRowField(cat.id, row.id, 'type', v)}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Scoring type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ROW_SCORING_TYPES.map(t => (
                                                            <SelectItem key={t.id || 'standard'} value={t.id || 'standard'}>{t.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeRow(cat.id, row.id)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Score Ranges */}
                        <div className="border rounded p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wide">Weightage & Score Ranges</Label>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addScoreRange}>
                                    <Plus size={12} /> Add Row
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="bg-slate-50 text-left">
                                            <th className="p-1 border">Parameter</th>
                                            <th className="p-1 border w-20">Category Link</th>
                                            <th className="p-1 border w-20">Weight</th>
                                            <th className="p-1 border w-24">Poor</th>
                                            <th className="p-1 border w-24">Average</th>
                                            <th className="p-1 border w-24">V. Good</th>
                                            <th className="p-1 border w-24">Excellent</th>
                                            <th className="p-1 border w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config.scoreRanges.map((row, idx) => (
                                            <tr key={row.id}>
                                                <td className="p-1 border"><Input className="h-7 text-xs" value={row.label} onChange={(e) => updateScoreRange(idx, 'label', e.target.value)} /></td>
                                                <td className="p-1 border">
                                                    <Select value={row.catId || 'none'} onValueChange={(v) => updateScoreRange(idx, 'catId', v === 'none' ? null : v)}>
                                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">None (e.g. Attendance)</SelectItem>
                                                            {config.categories.map(c => (
                                                                <SelectItem key={c.id} value={c.id}>{c.category.split('\n')[0].slice(0, 30)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="p-1 border"><Input className="h-7 text-xs" value={row.weight} onChange={(e) => updateScoreRange(idx, 'weight', e.target.value)} /></td>
                                                <td className="p-1 border"><Input className="h-7 text-xs" value={row.poor} onChange={(e) => updateScoreRange(idx, 'poor', e.target.value)} /></td>
                                                <td className="p-1 border"><Input className="h-7 text-xs" value={row.avg} onChange={(e) => updateScoreRange(idx, 'avg', e.target.value)} /></td>
                                                <td className="p-1 border"><Input className="h-7 text-xs" value={row.good} onChange={(e) => updateScoreRange(idx, 'good', e.target.value)} /></td>
                                                <td className="p-1 border"><Input className="h-7 text-xs" value={row.excel} onChange={(e) => updateScoreRange(idx, 'excel', e.target.value)} /></td>
                                                <td className="p-1 border text-center">
                                                    <Button size="icon" variant="outline" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => removeScoreRange(idx)}>
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className={`text-[10px] ${totalWeightage === 1 ? 'text-slate-400' : 'text-amber-600 font-medium'}`}>
                                Total weightage: {totalWeightage} {totalWeightage === 1 ? '' : '(should typically add up to 1.0 / 100%)'}
                            </p>
                        </div>

                        {/* Evaluation Legends */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[{ key: 'cycleTime', title: 'Evaluation Criteria: Cycle Time' }, { key: 'otherCriteria', title: 'Evaluation Criteria: Quality/Discipline/Safety/10-Cycle' }].map(({ key, title }) => (
                                <div key={key} className="border rounded p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-bold uppercase tracking-wide">{title}</Label>
                                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => addLegendItem(key)}>
                                            <Plus size={10} /> Add
                                        </Button>
                                    </div>
                                    {config.evaluationLegends[key].map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-[60px_1fr_28px] gap-2 items-start">
                                            <Input className="h-8 text-xs" value={item.score} onChange={(e) => updateLegendItem(key, idx, 'score', e.target.value)} placeholder="Score" />
                                            <Input className="h-8 text-xs" value={item.label} onChange={(e) => updateLegendItem(key, idx, 'label', e.target.value)} placeholder="Description" />
                                            <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeLegendItem(key, idx)}>
                                                <Trash2 size={12} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* ── Live Sheet Preview ─────────────────────────────────── */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wide">Live Sheet Preview</Label>
                            <div className="border-2 border-black overflow-x-auto bg-white">
                                <div className="min-w-[2200px] p-3 text-black">
                                    <div className="border border-black">
                                        <div className="flex justify-between items-start border-b border-black">
                                            <div className="flex-1 text-center font-bold text-base p-2 uppercase">
                                                Associate Performance Monitoring Check Sheet <br />
                                                <span className="text-xs font-normal">(WORKING IN {deptName || (isGlobal ? "ALL DEPARTMENTS (GLOBAL)" : "DEPARTMENT")}{sectionName ? ` / ${sectionName}` : ''})</span>
                                            </div>
                                            <div className="w-44 border-l border-black text-[8px] font-bold">
                                                <div className="border-b border-black p-1 flex justify-between"><span>Document No.</span><span>{docNo || "-"}</span></div>
                                                <div className="border-b border-black p-1 flex justify-between"><span>Revision No.</span><span>{revNo || "-"}</span></div>
                                                <div className="p-1 flex justify-between"><span>Revision Date:</span><span>{revDate || "-"}</span></div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 text-[10px] border-b border-black">
                                            <div className="border-r border-black p-1"><span className="font-bold">Employee Name:</span> Sample Operator</div>
                                            <div className="border-r border-black p-1"><span className="font-bold">Employee Code:</span> EMP1234</div>
                                            <div className="border-r border-black p-1"><span className="font-bold">Process:</span> Assembly Line</div>
                                            <div className="p-1"><span className="font-bold">Line Leader:</span> Sample Leader</div>
                                        </div>
                                    </div>

                                    <div className="border border-t-0 border-black">
                                        <table className="w-full border-collapse text-[10px]">
                                            <thead>
                                                <tr className="border-b border-black font-bold bg-gray-200">
                                                    <th className="border-r border-black min-w-[40px] bg-gray-50">S.No</th>
                                                    <th className="border-r border-black min-w-[160px] bg-gray-50 text-left px-2">Parameters</th>
                                                    <th className="border-r border-black min-w-[260px] bg-gray-50 text-left px-2">Check Items</th>
                                                    <th className="border-r border-black min-w-[60px] bg-gray-50">Mark (Max)</th>
                                                    {DAY_NUMBERS.map(d => (
                                                        <th key={d} className="border-r border-black min-w-[42px]">Day-{d}</th>
                                                    ))}
                                                    <th className="min-w-[160px] bg-blue-50/50">Evaluation after 16 days</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {config.categories.map((cat, catIdx) => (
                                                    <React.Fragment key={cat.id}>
                                                        {cat.rows.map((row, rowIdx) => (
                                                            <tr key={row.id} className="border-b border-black">
                                                                {rowIdx === 0 && (
                                                                    <>
                                                                        <td rowSpan={cat.rows.length} className="border-r border-black text-center font-bold align-middle bg-gray-50/40">{catIdx + 1}</td>
                                                                        <td rowSpan={cat.rows.length} className="border-r border-black p-1 font-bold align-middle bg-gray-50/40 whitespace-pre-line">{cat.category}</td>
                                                                    </>
                                                                )}
                                                                <td className="border-r border-black p-1 text-left">
                                                                    {row.label}
                                                                    {row.type === 'cycle' && <span className="ml-1 text-[8px] text-indigo-600 font-bold">[10 readings + avg/day]</span>}
                                                                    {row.type === 'cycle_detailed' && <span className="ml-1 text-[8px] text-indigo-600 font-bold">[Target/Actual/Achv/Score per day]</span>}
                                                                </td>
                                                                <td className="border-r border-black text-center font-bold">{row.weight}</td>
                                                                {DAY_NUMBERS.map(d => (
                                                                    <td key={d} className={`border-r border-black text-center ${d === 6 ? 'bg-amber-50 text-amber-700 font-bold' : 'text-blue-700'}`}>
                                                                        {sampleDayValue(row, d)}
                                                                    </td>
                                                                ))}
                                                                {rowIdx === 0 && (
                                                                    <td rowSpan={cat.rows.length} className="bg-blue-50/30 text-center font-bold align-middle">
                                                                        {cat.totalMark ? `${cat.totalMark - 1}/${cat.totalMark} (V.Good)` : '-'}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                        {cat.totalMark ? (
                                                            <tr className="border-b border-black bg-yellow-200 font-bold">
                                                                <td colSpan={3} className="text-right p-1">Total Mark:</td>
                                                                <td className="border-r border-black text-center">{cat.totalMark}</td>
                                                                {DAY_NUMBERS.map(d => <td key={d} className="border-r border-black" />)}
                                                                <td />
                                                            </tr>
                                                        ) : null}
                                                        {cat.target ? (
                                                            <>
                                                                <tr className="border-b border-black bg-yellow-100 font-bold">
                                                                    <td colSpan={3} className="text-right p-1">Target % :</td>
                                                                    <td className="border-r border-black text-center">{cat.target}</td>
                                                                    {DAY_NUMBERS.map(d => <td key={d} className="border-r border-black text-center">100%</td>)}
                                                                    <td />
                                                                </tr>
                                                                <tr className="border-b border-black bg-yellow-50 font-bold">
                                                                    <td colSpan={3} className="text-right p-1">{cat.actualLabel || "Actual %:"}</td>
                                                                    <td className="border-r border-black text-center italic">-</td>
                                                                    {DAY_NUMBERS.map(d => <td key={d} className="border-r border-black" />)}
                                                                    <td />
                                                                </tr>
                                                            </>
                                                        ) : null}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <p className="text-[9px] italic text-gray-500 mt-1">
                                        Preview uses illustrative sample scores (Day-6 shown as a below-target example). Cycle/Cycle-Detailed rows expand into their extra sub-columns only on the actual printed sheet.
                                    </p>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                                        <div className="border border-black overflow-hidden">
                                            <table className="w-full border-collapse text-[10px]">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-black font-bold">
                                                        <th className="border-r border-black p-1 text-left">Parameters</th>
                                                        <th className="border-r border-black p-1">Weight</th>
                                                        <th className="border-r border-black p-1">Poor</th>
                                                        <th className="border-r border-black p-1">Average</th>
                                                        <th className="border-r border-black p-1">V.Good</th>
                                                        <th className="p-1">Excellent</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {config.scoreRanges.map(row => (
                                                        <tr key={row.id} className="border-b border-black">
                                                            <td className="border-r border-black p-1 font-bold">{row.label}</td>
                                                            <td className="border-r border-black text-center font-bold">{row.weight}</td>
                                                            <td className="border-r border-black text-center text-gray-500 italic">{row.poor}</td>
                                                            <td className="border-r border-black text-center text-gray-500 italic">{row.avg}</td>
                                                            <td className="border-r border-black text-center text-gray-500 italic">{row.good}</td>
                                                            <td className="text-center text-gray-500 italic">{row.excel}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="font-bold bg-gray-100">
                                                        <td className="border-r border-black p-1">Total</td>
                                                        <td className="border-r border-black text-center">{totalWeightage}</td>
                                                        <td colSpan={4} />
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[{ key: 'cycleTime', title: 'Cycle Time' }, { key: 'otherCriteria', title: 'Quality/Discipline/Safety' }].map(({ key, title }) => (
                                                <div key={key} className="border border-black overflow-hidden">
                                                    <table className="w-full border-collapse text-[10px]">
                                                        <thead>
                                                            <tr className="bg-gray-50 border-b border-black">
                                                                <th colSpan={2} className="p-1 font-bold uppercase text-left bg-gray-100">{title}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {config.evaluationLegends[key].map((item, idx) => (
                                                                <tr key={idx} className="border-b border-black">
                                                                    <td className="w-8 border-r border-black text-center font-bold bg-gray-50">{item.score}</td>
                                                                    <td className="p-1 italic">{item.label}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border border-black p-2 mt-3 flex justify-between text-[10px] font-bold text-center">
                                        <span>Checked By:- <span className="italic font-normal text-gray-400">(auto-filled on submit)</span></span>
                                        <span>Verified By:- <span className="italic font-normal text-gray-400">(Area Incharge)</span></span>
                                        <span>Approved By:- <span className="italic font-normal text-gray-400">(Dept Head)</span></span>
                                        <span>Verified By:- <span className="italic font-normal text-gray-400">(Education Cell)</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save */}
                        <div className="border rounded p-4 flex justify-between items-center">
                            <Button variant="outline" className="gap-2" onClick={fetchHistory}>
                                <History size={14} /> History
                            </Button>
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
                                This updates the layout and the Revision Table record for 16-Day Monitoring at{" "}
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
                            <DialogTitle>16-Day Monitoring Layout History</DialogTitle>
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

export default SixteenDayMonitoringLayoutEditor;
