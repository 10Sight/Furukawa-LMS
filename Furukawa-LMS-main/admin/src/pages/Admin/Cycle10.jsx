import React, { useState, useEffect, useMemo } from 'react';
import useRevisionInfo from '@/hooks/useRevisionInfo';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Save, Download, CheckCircle, XCircle, Pencil, PenLine, Edit2, History, ArrowLeft } from "lucide-react";
import axiosInstance from '@/Helper/axiosInstance';
import { exportToExcel } from "@/utils/exportHelper";
import { toast } from "sonner";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesByLineQuery } from "@/Redux/AllApi/MachineApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import UserAutocomplete from '@/components/common/UserAutocomplete';
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ALL_FORM_TYPES = [
    { id: 'form1', label: 'Form 1 (Standard)' },
    { id: 'form2', label: 'Form 2 (Complete)' },
    { id: 'form3', label: 'Form 3 (10 Cycle Numerical)' }
];

const TEN_CYCLE_KEY_FIELDS = ['lineMachine', 'modelName', 'partName', 'operationName', 'sopNo', 'inspectorName'];
const isRowComplete = (row) => TEN_CYCLE_KEY_FIELDS.every(field => String(row?.[field] || "").trim());

// Layout configuration: labels/descriptions for Section A questions & general
// points, Section B measuring instruments, and Section C inspection columns.
// Field keys on each row (secA_q1, secB_linearScale, etc.) stay derived from
// each item's `id`, so relabeling never breaks previously saved sheet data.
//
// Each form type (form1/form2/form3) keeps its own independent set of
// questions/instruments/columns — a sheet is permanently one form type, so
// editing Form 1's layout must never change what Form 2 or Form 3 show.
// buildDefaultFormConfig() is called fresh every time so the three forms
// (and any fallback/default reads) never share the same array/object
// references — editing one can never leak into another via object mutation.
const buildDefaultFormConfig = () => ({
    secA: {
        questions: [
            { id: 'q1', label: 'Q1', desc: 'Is Operator aware of SOP Availability?' },
            { id: 'q2', label: 'Q2', desc: 'Does Operator understand SOP?' },
            { id: 'q3', label: 'Q3', desc: 'Is Operator adhering SOP?' },
            { id: 'q4', label: 'Q4', desc: 'Does Operator know operation cycle time?' },
        ],
        generalPoints: [
            { id: 'gp1', label: 'Q1', desc: "Is process started after 5'S?" },
            { id: 'gp2', label: 'Q2', desc: 'Is station check sheet filled?' },
            { id: 'gp3', label: 'Q3', desc: 'Is defective part identified?' },
            { id: 'gp4', label: 'Q4', desc: 'Is NC part handling system followed?' },
            { id: 'gp5', label: 'Q5', desc: 'Is Operator aware about 5 safety principle?' },
            { id: 'gp6', label: 'Q6', desc: 'Is operator aware about abnormal condition?' },
        ],
    },
    secB: {
        instruments: [
            { id: 'linearScale', label: 'Linear Scale' },
            { id: 'micrometer', label: 'Point Micrometer' },
            { id: 'bladeMicrometer', label: 'Blade Micrometer' },
            { id: 'strippingGauge', label: 'Stripping Gauge' },
            { id: 'others', label: 'Others' },
        ],
    },
    secC: {
        columns: [
            { id: '1', label: '1' },
            { id: '2', label: '2' },
            { id: '3', label: '3' },
            { id: '4', label: '4' },
            { id: '5', label: '5' },
        ],
    },
});

// Normalizes ONE form's {secA,secB,secC} shape. Always returns fresh
// objects/arrays (never a shared reference to a fallback or default),
// so callers can safely hand the result to state without risking one
// scope's edits mutating another scope's in-memory config.
const normalizeFormConfig = (raw) => {
    const fallback = buildDefaultFormConfig();
    if (!raw || typeof raw !== 'object') return fallback;
    const pick = (arr, fb) => (Array.isArray(arr) && arr.length > 0 ? arr.map(x => ({ ...x })) : fb);
    return {
        secA: {
            questions: pick(raw.secA?.questions, fallback.secA.questions),
            generalPoints: pick(raw.secA?.generalPoints, fallback.secA.generalPoints),
        },
        secB: {
            instruments: pick(raw.secB?.instruments, fallback.secB.instruments),
        },
        secC: {
            columns: pick(raw.secC?.columns, fallback.secC.columns),
        },
    };
};

const DEFAULT_10CYCLE_CONFIG = {
    form1: buildDefaultFormConfig(),
    form2: buildDefaultFormConfig(),
    form3: buildDefaultFormConfig(),
};

// Normalizes the full { form1, form2, form3 } config blob for a scope.
// Also upgrades older saved rows (from before per-form configs existed)
// that stored a single flat {secA,secB,secC} shape shared by all forms.
const normalizeConfig = (raw) => {
    if (raw && typeof raw === 'object' && (raw.secA || raw.secB || raw.secC) && !raw.form1 && !raw.form2 && !raw.form3) {
        return {
            form1: normalizeFormConfig(raw),
            form2: normalizeFormConfig(raw),
            form3: normalizeFormConfig(raw),
        };
    }
    return {
        form1: normalizeFormConfig(raw?.form1),
        form2: normalizeFormConfig(raw?.form2),
        form3: normalizeFormConfig(raw?.form3),
    };
};

const Cycle10 = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useSelector(state => state.auth);
    const isAdmin = user?.isAdmin || user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
    const canCreate = isAdmin || user?.customRole?.permissions?.includes('ten_cycle:create') || user?.customRole?.permissions?.includes('ten_cycle:manage');
    const canRead = isAdmin || user?.customRole?.permissions?.includes('ten_cycle:read') || user?.customRole?.permissions?.includes('ten_cycle:manage');
    const canUpdate = isAdmin || user?.customRole?.permissions?.includes('ten_cycle:update') || user?.customRole?.permissions?.includes('ten_cycle:manage');
    const canDelete = isAdmin || user?.customRole?.permissions?.includes('ten_cycle:delete') || user?.customRole?.permissions?.includes('ten_cycle:manage');
    const canEditApproved = isAdmin || user?.customRole?.permissions?.includes('ten_cycle:manage') || user?.customRole?.permissions?.includes('ten_cycle:edit_approved');
    const canEditConfig = isAdmin || user?.isTrainer || user?.customRole?.permissions?.includes('ten_cycle:manage') || user?.customRole?.permissions?.includes('ten_cycle:edit_layout');
    const isSheetLocked = (sheet) => sheet?.verifiedStatus === 'APPROVE' || sheet?.reviewedStatus === 'APPROVE';

    const [logAction] = useLogActionMutation();

    const [activeTab, setActiveTab] = useState("monitoring");
    const [isEditMode, setIsEditMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [loadingSheets, setLoadingSheets] = useState(false);
    const [sheetList, setSheetList] = useState([]);
    const [currentSheet, setCurrentSheet] = useState(null);
    const [selectedSheetId, setSelectedSheetId] = useState("");
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
    const [selectedSectionFilter, setSelectedSectionFilter] = useState("");
    const [selectedLineFilter, setSelectedLineFilter] = useState("");
    const [selectedSubSectionFilter, setSelectedSubSectionFilter] = useState("");

    const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
    const [editRemarkText, setEditRemarkText] = useState("");
    const [pendingIsSubmit, setPendingIsSubmit] = useState(false);

    const [createOpen, setCreateOpen] = useState(false);
    const [createDepartmentId, setCreateDepartmentId] = useState("");
    const [createSectionId, setCreateSectionId] = useState("");
    const [createLineId, setCreateLineId] = useState("");
    const [createSubSectionId, setCreateSubSectionId] = useState("");
    const [createFormType, setCreateFormType] = useState("form1");
    const [createdDate, setCreatedDate] = useState("");
    const [currentDepartmentName, setCurrentDepartmentName] = useState("");

    // Form Type State (moved up: the layout config below is selected per form type)
    const [formType, setFormType] = useState('form1');

    // Layout configuration driving the currently open sheet's dynamic headers/questions/checking
    // items. Holds the full { form1, form2, form3 } blob for the open sheet's scope; `config`
    // below is a derived read of just the branch matching this sheet's own form type.
    const [sheetLayoutConfig, setSheetLayoutConfig] = useState(DEFAULT_10CYCLE_CONFIG);
    const config = sheetLayoutConfig[formType] || sheetLayoutConfig.form1;

    const secAQuestionFields = config.secA.questions.map(q => `secA_${q.id}`);
    const secAGeneralPointFields = config.secA.generalPoints.map(g => `secA_${g.id}`);
    const secBInstrumentFields = config.secB.instruments.map(i => `secB_${i.id}`);
    const secCColumnFields = config.secC.columns.map(c => `secC_${c.id}`);

    // ── "Edit Layout" tab: independent department/section/line/global scope picker
    // for editing the layout config, separate from whichever sheet happens to be open.
    const [layoutIsGlobal, setLayoutIsGlobal] = useState(false);
    const [layoutDeptId, setLayoutDeptId] = useState("");
    const [layoutSectionId, setLayoutSectionId] = useState("");
    const [layoutLineId, setLayoutLineId] = useState("");
    // Which form's branch of the scope's config is currently being edited — each
    // form type owns an independent set of questions/instruments/columns.
    const [layoutFormType, setLayoutFormType] = useState("form1");
    // Full { form1, form2, form3 } blob for the selected scope; layoutDraft below
    // is a derived read of just the layoutFormType branch, so edits only ever
    // touch that one form's data even though the whole blob lives in one DB row.
    const [layoutFullConfig, setLayoutFullConfig] = useState(null);
    const layoutDraft = layoutFullConfig ? layoutFullConfig[layoutFormType] : null;
    // Which scope the loaded config actually came from (hierarchical fallback can resolve
    // broader than what's selected above) — null once a row truly matches nothing at all
    // (i.e. showing the hardcoded default, not even a saved Global template).
    const [layoutResolvedScope, setLayoutResolvedScope] = useState(null);
    const [layoutRemark, setLayoutRemark] = useState("");
    const [loadingLayout, setLoadingLayout] = useState(false);
    const [layoutHistory, setLayoutHistory] = useState([]);
    const [showLayoutHistory, setShowLayoutHistory] = useState(false);

    // Deep-linked from the Revision Table's Edit button (RevisionSheetHistory.jsx)
    // for the ten-cycle-sheet row: ?tab=editLayout&global=1 or &departmentId=&sectionId=
    const cameFromRevisionTable = searchParams.get('tab') === 'editLayout';

    // Revision-details confirmation dialog: every layout save must also record a
    // doc-control revision (docNo/revNo/revDate/changeDetails) via the atomic
    // save-with-revision endpoint, tying structural changes to the Revision Table.
    const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
    const [loadingRevisionInfo, setLoadingRevisionInfo] = useState(false);
    const [savingLayoutRevision, setSavingLayoutRevision] = useState(false);
    const [revisionForm, setRevisionForm] = useState({ docNo: '', revNo: '', revDate: '', affectedSrNoPage: '', changeDetails: '' });

    // Live preview for a not-yet-created sheet reflects whatever department/section
    // is currently selected (the page filter, or the "Add Sheet" dialog's own pick).
    const revisionInfo = useRevisionInfo("ten-cycle-sheet", {}, {
        departmentId: selectedDepartmentFilter || createDepartmentId,
        sectionId: selectedSectionFilter || createSectionId,
    });

    const { data: departmentsData } = useGetAllDepartmentsQuery({ page: 1, limit: 500 });
    const departments = departmentsData?.data?.departments || [];

    const { data: sectionData } = useGetSectionsByDepartmentQuery(selectedDepartmentFilter || createDepartmentId, { skip: !selectedDepartmentFilter && !createDepartmentId });
    const sections = sectionData?.data || [];

    const { data: lineData } = useGetLinesBySectionQuery(selectedSectionFilter || createSectionId, { skip: !selectedSectionFilter && !createSectionId });
    const lines = lineData?.data || [];

    const { data: subSectionData } = useGetSubSectionsByLineQuery(selectedLineFilter || createLineId, { skip: !selectedLineFilter && !createLineId });
    const subSections = subSectionData?.data || [];

    const { data: machineData } = useGetMachinesByLineQuery(selectedLineFilter, { skip: !selectedLineFilter });
    const stations = machineData?.data || [];

    const { data: layoutSectionData } = useGetSectionsByDepartmentQuery(layoutDeptId, { skip: !layoutDeptId });
    const layoutSections = layoutSectionData?.data || [];
    const { data: layoutLineData } = useGetLinesBySectionQuery(layoutSectionId, { skip: !layoutSectionId });
    const layoutLines = layoutLineData?.data || [];

    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const assignableSections = useMemo(() => {
        const rawAssigned = Array.isArray(user?.sections) ? [...user.sections] : [];
        if (user?.sectionId) rawAssigned.push(user.sectionId);
        const assignedIds = rawAssigned.map(id => String(id?.id ?? id?._id ?? id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return sections;
        return sections.filter(s => assignedIds.includes(String(s._id || s.id)));
    }, [sections, user, isAdmin]);

    // Sections that hide the 10-Cycle sheet stay visible in the view/filter dropdown
    // (so existing sheets remain reachable) but are excluded from the "Add Sheet" picker.
    const assignableCreateSections = useMemo(() => {
        return assignableSections.filter(s => !(s.hideTenCycle === true || s.hideTenCycle === 1));
    }, [assignableSections]);

    const isRestricted = !isAdmin && user && (
        (user.departments?.length > 0) || user.departmentId ||
        (user.sections?.length > 0) || user.sectionId
    );

    // Emailed links always point at /admin/10-cycle. A custom-role user without
    // admin access lands there via ProtectedRoute/RequireAccess's permissive
    // layout fallback and would render the page inside the wrong (admin) shell,
    // so bounce them to the equivalent /portal route, and vice versa.
    useEffect(() => {
        if (!user) return;
        const targetBase = isAdmin ? '/admin/10-cycle' : '/portal/10-cycle';
        if (location.pathname !== targetBase && (location.pathname === '/admin/10-cycle' || location.pathname === '/portal/10-cycle')) {
            navigate(`${targetBase}${location.search || ''}`, { replace: true });
        }
    }, [user, isAdmin, location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!isRestricted) return;
        if (assignableDepartments.length === 1 && !selectedDepartmentFilter) {
            const id = String(assignableDepartments[0]._id || assignableDepartments[0].id);
            setSelectedDepartmentFilter(id);
            setCreateDepartmentId(id);
        }
        if (selectedDepartmentFilter && assignableSections.length === 1 && !selectedSectionFilter) {
            const id = String(assignableSections[0]._id || assignableSections[0].id);
            setSelectedSectionFilter(id);
            setCreateSectionId(id);
        }
    }, [isRestricted, assignableDepartments, assignableSections, selectedDepartmentFilter, selectedSectionFilter]);

    // Header Data
    const [headerData, setHeaderData] = useState({
        qualityEngineer: "Ram Singh",
        qualityEngineerSign: "Ram Singh",
        dojoEngineer: "Rohit",
        dojoEngineerSign: "Rohit Kumar"
    });

    // Default Row Structure
    const createNewRow = (id = Date.now(), cfg = config) => {
        const row = {
            id,
            date: new Date().toISOString().split('T')[0],
            lineMachine: '',
            modelName: '',
            partName: '',
            operationName: '',
            sopNo: '',

            // Results
            inspectorName: '',
            empCode: '',
            skillLevel: '',
            obsSecA: '',
            obsSecB: '',
            obsSecC: '',
            passScore: '0%',
            overallResult: 'X',
            inspectorSign: '',
            tlSign: '',
            remark: '',

            // Form 3 specific fields
            secB_v1: '', secB_v2: '', secB_v3: '', secB_v4: '', secB_v5: '',
            secB_v6: '', secB_v7: '', secB_v8: '', secB_v9: '', secB_v10: '',
            secB_spec: '', secB_min: '', secB_max: '',
        };

        // Section A: Ask Four Questions + General Points (Marking: ✓ or X)
        cfg.secA.questions.forEach(q => { row[`secA_${q.id}`] = ''; });
        cfg.secA.generalPoints.forEach(g => { row[`secA_${g.id}`] = ''; });
        // Section B: Measuring Instrument Using Method (Marking: ✓ or X)
        cfg.secB.instruments.forEach(i => { row[`secB_${i.id}`] = ''; });
        // Section C: Cross Inspection Marking (Marking: ✓ or X)
        cfg.secC.columns.forEach(c => { row[`secC_${c.id}`] = ''; });

        return row;
    };

    const [rows, setRows] = useState([]);

    const getAvailableFormTypes = () => {
        let configuredTypes = [];
        if (createLineId) {
            const line = lines.find(l => String(l.id || l._id) === createLineId);
            if (line && line.tenCycleFormType) {
                configuredTypes = line.tenCycleFormType.split(",");
            }
        } else if (createSectionId) {
            const sec = sections.find(s => String(s.id || s._id) === createSectionId);
            if (sec && sec.tenCycleFormType) {
                configuredTypes = sec.tenCycleFormType.split(",");
            }
        }

        if (configuredTypes.length === 0) return ALL_FORM_TYPES;
        return ALL_FORM_TYPES.filter(type => configuredTypes.includes(type.id));
    };

    useEffect(() => {
        const id = searchParams.get('id');
        if (id) {
            fetchSheetById(id, false);
        }
    }, [searchParams]);

    // One-time: land directly on the Edit Layout tab, pre-scoped, when arriving
    // from the Revision Table's Edit / Add Department Override buttons.
    useEffect(() => {
        if (searchParams.get('tab') !== 'editLayout') return;
        setActiveTab('editLayout');
        if (searchParams.get('global') === '1') {
            setLayoutIsGlobal(true);
        } else {
            const dept = searchParams.get('departmentId');
            const sect = searchParams.get('sectionId');
            if (dept) setLayoutDeptId(dept);
            if (sect) setLayoutSectionId(sect);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchSheets();
    }, [selectedDepartmentFilter, selectedSectionFilter, selectedLineFilter, selectedSubSectionFilter]);

    const fetchSheets = async () => {
        try {
            setLoadingSheets(true);
            const params = new URLSearchParams();
            if (selectedDepartmentFilter) params.set("departmentId", selectedDepartmentFilter);
            if (selectedSectionFilter) params.set("sectionId", selectedSectionFilter);
            if (selectedLineFilter) params.set("lineId", selectedLineFilter);
            if (selectedSubSectionFilter) params.set("subSectionId", selectedSubSectionFilter);
            const url = `/api/ten-cycle-sheets${params.toString() ? `?${params.toString()}` : ""}`;

            const response = await axiosInstance.get(url);
            if (response.data.success) {
                setSheetList(response.data.data || []);
                logAction({
                    action: "VIEW_TEN_CYCLE_SHEETS_MONITORING",
                    details: {
                        departmentId: selectedDepartmentFilter || null,
                        sectionId: selectedSectionFilter || null,
                        lineId: selectedLineFilter || null,
                        subSectionId: selectedSubSectionFilter || null,
                    }
                }).catch(() => {});
            }
        } catch (error) {
            toast.error("Failed to load 10 cycle sheets");
        } finally {
            setLoadingSheets(false);
        }
    };

    const fetchConfig = async (deptId, sectId = 0, lnId = 0, subSectId = 0) => {
        if (!deptId) return DEFAULT_10CYCLE_CONFIG;
        try {
            const params = new URLSearchParams();
            if (sectId) params.set("sectionId", sectId);
            if (lnId) params.set("lineId", lnId);
            if (subSectId) params.set("subSectionId", subSectId);
            const qs = params.toString();
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/config/${deptId}${qs ? `?${qs}` : ""}`);
            const normalized = normalizeConfig(response.data?.data?.config);
            setSheetLayoutConfig(normalized);
            return normalized;
        } catch (error) {
            console.error("Error fetching 10-Cycle layout config:", error);
            return DEFAULT_10CYCLE_CONFIG;
        }
    };

    // Explains whether the loaded config is a saved override for exactly this scope, or
    // inherited from somewhere broader (Department-wide / Global) — makes the hierarchical
    // fallback visible instead of silently looking like "the same config everywhere".
    const layoutInheritanceNote = () => {
        if (!layoutFullConfig) return null;
        if (layoutIsGlobal) {
            return layoutResolvedScope
                ? { tone: 'ok', text: "Editing the saved Global template — this applies to every department/section/line with no override of its own." }
                : { tone: 'warn', text: "No Global template saved yet — showing the built-in defaults. Saving here creates the Global template." };
        }
        if (!layoutResolvedScope) {
            return { tone: 'warn', text: "Nothing saved anywhere in this chain — showing the built-in defaults. Saving here creates a config just for this exact selection." };
        }
        if (!layoutResolvedScope.departmentId) {
            return { tone: 'warn', text: "No override saved for this Department/Section/Line — currently showing the Global template. Saving here creates a new override just for this exact selection; it will NOT change the Global template or any other department." };
        }
        const exactSection = String(layoutResolvedScope.sectionId || 0) === String(layoutSectionId || 0);
        const exactLine = String(layoutResolvedScope.lineId || 0) === String(layoutLineId || 0);
        if (exactSection && exactLine) {
            return { tone: 'ok', text: "Showing a config saved specifically for this exact Department/Section/Line selection." };
        }
        return { tone: 'warn', text: "Showing an inherited config from a broader level (e.g. Department-wide). Saving here creates a new, more specific override just for this exact selection." };
    };

    // ── Edit Layout tab: scope is chosen independently (department/section/line/global) ──
    const layoutScopeParams = () => {
        const params = new URLSearchParams();
        if (!layoutIsGlobal) {
            if (layoutSectionId) params.set("sectionId", layoutSectionId);
            if (layoutLineId) params.set("lineId", layoutLineId);
        }
        return params.toString();
    };
    const layoutDeptParam = () => (layoutIsGlobal ? "global" : layoutDeptId);

    const fetchLayoutConfig = async () => {
        if (!layoutIsGlobal && !layoutDeptId) {
            setLayoutFullConfig({ form1: buildDefaultFormConfig(), form2: buildDefaultFormConfig(), form3: buildDefaultFormConfig() });
            setLayoutResolvedScope(null);
            return;
        }
        try {
            setLoadingLayout(true);
            const qs = layoutScopeParams();
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/config/${layoutDeptParam()}${qs ? `?${qs}` : ""}`);
            const normalized = normalizeConfig(response.data?.data?.config);
            setLayoutFullConfig(normalized);
            setLayoutResolvedScope(response.data?.data?.resolvedScope || null);
        } catch (error) {
            console.error("Error fetching 10-Cycle layout config:", error);
            toast.error("Failed to load layout configuration");
        } finally {
            setLoadingLayout(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'editLayout') return;
        fetchLayoutConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, layoutIsGlobal, layoutDeptId, layoutSectionId, layoutLineId]);

    // Maps a group name to where its array lives inside one form's {secA,secB,secC} config
    const LAYOUT_GROUP_PATHS = {
        questions: ['secA', 'questions'],
        generalPoints: ['secA', 'generalPoints'],
        instruments: ['secB', 'instruments'],
        columns: ['secC', 'columns'],
    };
    const getLayoutGroupArray = (formCfg, group) => {
        const [sec, key] = LAYOUT_GROUP_PATHS[group];
        return formCfg[sec][key];
    };

    // All three of these only ever touch the layoutFormType branch of the full
    // blob, so editing Form 1 never mutates Form 2's or Form 3's saved data.
    const updateLayoutItem = (group, idx, field, value) => {
        setLayoutFullConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            getLayoutGroupArray(next[layoutFormType], group)[idx][field] = value;
            return next;
        });
    };

    const addLayoutItem = (group) => {
        setLayoutFullConfig(prev => {
            if (!prev) return prev;
            const next = JSON.parse(JSON.stringify(prev));
            const arr = getLayoutGroupArray(next[layoutFormType], group);
            const newId = `custom_${Date.now()}`;
            const n = arr.length + 1;
            if (group === 'columns') arr.push({ id: newId, label: String(n) });
            else if (group === 'instruments') arr.push({ id: newId, label: `New Instrument ${n}` });
            else arr.push({ id: newId, label: `Q${n}`, desc: '' });
            return next;
        });
    };

    const removeLayoutItem = (group, idx) => {
        setLayoutFullConfig(prev => {
            if (!prev) return prev;
            const arr = getLayoutGroupArray(prev[layoutFormType], group);
            if (arr.length <= 1) {
                toast.error("At least one item is required in this section");
                return prev;
            }
            const next = JSON.parse(JSON.stringify(prev));
            getLayoutGroupArray(next[layoutFormType], group).splice(idx, 1);
            return next;
        });
    };

    // Opens the revision-details confirmation dialog, pre-filled with whatever the
    // Revision Table currently has for this scope (falls back to department/global
    // if this exact scope has no override yet) — changeDetails is always left blank
    // since it should describe THIS revision, not carry over the previous one.
    const openRevisionDialog = async () => {
        if (!layoutIsGlobal && !layoutDeptId) {
            toast.error("Select a department, or switch to Global");
            return;
        }
        if (!layoutRemark.trim()) {
            toast.error("Please enter a remark describing your changes");
            return;
        }
        if (!layoutFullConfig) return;

        setLoadingRevisionInfo(true);
        try {
            const params = {};
            if (!layoutIsGlobal && layoutDeptId) params.departmentId = layoutDeptId;
            if (!layoutIsGlobal && layoutSectionId) params.sectionId = layoutSectionId;
            const response = await axiosInstance.get(`/api/revision-records/sheet/ten-cycle-sheet`, { params });
            const record = response.data?.data || {};
            setRevisionForm({
                docNo: record.docNo || '',
                revNo: record.revNo || '',
                revDate: record.revDate || '',
                affectedSrNoPage: record.affectedSrNoPage || '',
                changeDetails: '',
            });
        } catch {
            setRevisionForm({ docNo: '', revNo: '', revDate: '', affectedSrNoPage: '', changeDetails: '' });
        } finally {
            setLoadingRevisionInfo(false);
            setRevisionDialogOpen(true);
        }
    };

    // Atomically saves the layout config for this scope AND the revision record
    // documenting it, via the combined save-with-revision endpoint.
    const handleConfirmSaveLayoutWithRevision = async () => {
        if (!revisionForm.docNo.trim() || !revisionForm.revNo.trim()) {
            toast.error("Document No. and Revision No. are required");
            return;
        }
        if (!layoutFullConfig) return;
        try {
            setSavingLayoutRevision(true);
            const newConfig = normalizeConfig(layoutFullConfig);
            await axiosInstance.post(`/api/ten-cycle-sheets/config/save-with-revision`, {
                departmentId: layoutIsGlobal ? null : layoutDeptId,
                sectionId: layoutIsGlobal ? 0 : (layoutSectionId || 0),
                lineId: layoutIsGlobal ? 0 : (layoutLineId || 0),
                subSectionId: 0,
                config: newConfig,
                remark: layoutRemark,
                revision: {
                    docNo: revisionForm.docNo.trim(),
                    revNo: revisionForm.revNo.trim(),
                    revDate: revisionForm.revDate,
                    affectedSrNoPage: revisionForm.affectedSrNoPage,
                    changeDetails: revisionForm.changeDetails,
                },
            });
            setLayoutFullConfig(newConfig);
            setLayoutRemark("");
            setRevisionDialogOpen(false);
            toast.success("Layout and revision updated successfully");

            logAction({
                action: "SAVE_TEN_CYCLE_SHEET_LAYOUT_CONFIG",
                details: {
                    departmentId: layoutIsGlobal ? null : layoutDeptId,
                    sectionId: layoutIsGlobal ? null : (layoutSectionId || null),
                    lineId: layoutIsGlobal ? null : (layoutLineId || null),
                    remark: layoutRemark,
                    docNo: revisionForm.docNo,
                    revNo: revisionForm.revNo,
                }
            }).catch(() => {});

            if (cameFromRevisionTable) {
                navigate('/admin/revision-table/ten-cycle-sheet');
            }
        } catch (error) {
            console.error("Error saving 10-Cycle layout & revision:", error);
            toast.error(error?.response?.data?.message || "Failed to save layout & revision");
        } finally {
            setSavingLayoutRevision(false);
        }
    };

    const fetchLayoutHistory = async () => {
        if (!layoutIsGlobal && !layoutDeptId) return;
        try {
            const qs = layoutScopeParams();
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/history/${layoutDeptParam()}${qs ? `?${qs}` : ""}`);
            if (response.data.success) {
                setLayoutHistory(response.data.data || []);
                setShowLayoutHistory(true);
                logAction({
                    action: "VIEW_TEN_CYCLE_SHEET_LAYOUT_HISTORY",
                    details: { departmentId: layoutIsGlobal ? null : layoutDeptId, sectionId: layoutIsGlobal ? null : (layoutSectionId || null), lineId: layoutIsGlobal ? null : (layoutLineId || null) }
                }).catch(() => {});
            }
        } catch (error) {
            toast.error("Failed to fetch layout history");
        }
    };

    const fetchSheetById = async (sheetId, editMode = false) => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/api/ten-cycle-sheets/${sheetId}`);
            if (response.data.success) {
                const data = response.data.data;
                setCurrentSheet(data);
                setSelectedSheetId(String(data.id));

                // Populate filters from sheet data
                if (data.departmentId) setSelectedDepartmentFilter(String(data.departmentId));
                if (data.sectionId) setSelectedSectionFilter(String(data.sectionId));
                if (data.lineId) setSelectedLineFilter(String(data.lineId));
                if (data.subSectionId) setSelectedSubSectionFilter(String(data.subSectionId));

                const fullCfg = await fetchConfig(data.departmentId, data.sectionId, data.lineId, data.subSectionId);
                const sheetFormType = data.formType || "form1";
                const cfg = fullCfg[sheetFormType] || fullCfg.form1;

                setHeaderData({
                    qualityEngineer: data.qualityEngineer || "",
                    qualityEngineerSign: data.qualityEngineerSign || "",
                    dojoEngineer: data.dojoEngineer || "",
                    dojoEngineerSign: data.dojoEngineerSign || ""
                });
                setFormType(sheetFormType);
                setRows(data.entries && data.entries.length > 0 ? data.entries : [createNewRow(Date.now(), cfg)]);
                setCreatedDate(data.createdDate ? String(data.createdDate).split("T")[0] : "");
                setCurrentDepartmentName(data.departmentName || "");
                setIsEditMode(editMode);
                setActiveTab('sheet');

                logAction({
                    action: "VIEW_TEN_CYCLE_SHEET",
                    details: {
                        sheetId: data.id,
                        departmentId: data.departmentId || null,
                        lineId: data.lineId || null,
                        formType: data.formType,
                        status: data.status,
                    }
                }).catch(() => {});
            }
        } catch (error) {
            toast.error("Failed to load selected sheet");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSheet = async () => {
        if (!createDepartmentId) {
            toast.error("Please select department");
            return;
        }
        const chosenSection = sections.find(s => String(s.id || s._id) === String(createSectionId));
        if (chosenSection && (chosenSection.hideTenCycle === true || chosenSection.hideTenCycle === 1)) {
            toast.error("The 10-Cycle sheet is disabled for this section");
            return;
        }
        try {
            const response = await axiosInstance.post(`/api/ten-cycle-sheets`, {
                departmentId: createDepartmentId,
                sectionId: createSectionId,
                lineId: createLineId,
                subSectionId: createSubSectionId,
                formType: createFormType,
            });
            const created = response?.data?.data;
            toast.success("10 cycle sheet created");
            setCreateOpen(false);

            // Set filters to match the created sheet
            setSelectedDepartmentFilter(String(createDepartmentId));
            setSelectedSectionFilter(String(createSectionId));
            setSelectedLineFilter(String(createLineId));
            setSelectedSubSectionFilter(String(createSubSectionId));

            await fetchSheets();
            if (created?.id) await fetchSheetById(String(created.id), true);
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to create sheet");
        }
    };

    const executeSave = async (isSubmit, remark) => {
        if (!selectedSheetId) {
            toast.error("No sheet selected");
            return;
        }
        try {
            if (isSubmit) setSubmitting(true);
            else setSaving(true);

            const payload = {
                ...headerData,
                formType,
                entries: rows,
                isSubmit: !!isSubmit,
                editRemark: remark || "",
            };
            await axiosInstance.put(`/api/ten-cycle-sheets/${selectedSheetId}`, payload);
            toast.success(isSubmit ? "10 Cycle Sheet Submitted & Email Sent" : "10 Cycle Check Saved Successfully");
            if (selectedDepartmentFilter) await fetchSheets(selectedDepartmentFilter);
            await fetchSheetById(selectedSheetId, isEditMode);
        } catch (error) {
            console.error("Error saving data:", error);
            toast.error(error?.response?.data?.message || "Failed to save data");
        } finally {
            setSaving(false);
            setSubmitting(false);
        }
    };

    const handleSave = (isSubmitArg = false) => {
        const isSubmit = isSubmitArg === true;

        if (isSubmit && (rows.length === 0 || !rows.every(isRowComplete))) {
            toast.error("Cannot submit an empty sheet. Please complete all rows before submitting.");
            return;
        }

        const remarkRequired = !!currentSheet?.status && currentSheet.status !== 'Draft';
        if (remarkRequired) {
            setPendingIsSubmit(isSubmit);
            setEditRemarkText("");
            setRemarkDialogOpen(true);
            return;
        }

        executeSave(isSubmit, "");
    };

    const handleConfirmRemark = () => {
        if (!editRemarkText.trim()) {
            toast.error("Please enter a remark describing your changes");
            return;
        }
        setRemarkDialogOpen(false);
        executeSave(pendingIsSubmit, editRemarkText.trim());
    };

    const handleApproval = async (role, action) => {
        if (!selectedSheetId) return;
        try {
            setLoading(true);

            // Persist the TL auto-sign BEFORE the sheet becomes locked by verification,
            // otherwise a non-admin verifier would be blocked from saving their own sign-off.
            // Failure here must not block the actual verify/approve action below.
            if (role === 'VERIFY' && action === 'APPROVE') {
                try {
                    const verifierName = user?.fullName || user?.name || "";
                    const signedRows = rows.map(row => ({
                        ...row,
                        tlSign: row.tlSign || verifierName,
                    }));
                    await axiosInstance.put(`/api/ten-cycle-sheets/${selectedSheetId}`, {
                        ...headerData,
                        formType,
                        entries: signedRows,
                        isSubmit: false,
                        editRemark: `Auto-signed TL signature on verification approval by ${verifierName}`,
                    });
                } catch (signError) {
                    console.error("Failed to auto-persist TL signature:", signError);
                }
            }

            const response = await axiosInstance.patch(`/api/ten-cycle-sheets/${selectedSheetId}/approve`, {
                role, // 'VERIFY' or 'APPROVE'
                action // 'APPROVE' or 'REJECT'
            });
            if (response.data.success) {
                toast.success(`Sheet ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully`);
                await fetchSheetById(selectedSheetId, isEditMode);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to update approval status");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSheet = async (sheetId) => {
        if (!window.confirm("Are you sure you want to permanently delete this sheet? This action cannot be undone.")) return;
        try {
            await axiosInstance.delete(`/api/ten-cycle-sheets/${sheetId}`);
            toast.success("10 cycle sheet deleted");
            if (String(sheetId) === selectedSheetId) {
                setSelectedSheetId("");
                setCurrentSheet(null);
                setIsEditMode(false);
            }
            await fetchSheets();
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to delete sheet");
        }
    };

    const addRow = () => {
        setRows([...rows, createNewRow()]);
    };

    const removeRow = (id) => {
        if (rows.length === 1) return;
        setRows(rows.filter(row => row.id !== id));
    };

    const handleRowChange = (id, field, value) => {
        if (field === 'date' && value) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const enteredDate = new Date(value);
            enteredDate.setHours(0, 0, 0, 0);
            if (enteredDate < today) {
                toast.error("You cannot select a past date");
                return;
            }
            if (enteredDate > today) {
                toast.error("You cannot select a future date");
                return;
            }
        }
        setRows(rows.map(row => {
            if (row.id === id) {
                let updatedRow = { ...row, [field]: value };

                // Keep inspectorSign following inspectorName until the user overrides it manually
                if (field === 'inspectorName' && (!row.inspectorSign || row.inspectorSign === row.inspectorName)) {
                    updatedRow.inspectorSign = value;
                }

                // Fields to check for result (Marking fields)
                const markingFields = [
                    ...secAQuestionFields,
                    ...secAGeneralPointFields,
                    ...(formType !== 'form3' ? secBInstrumentFields : []),
                    ...secCColumnFields
                ];

                if (markingFields.includes(field)) {
                    const anyFail = markingFields.some(f => updatedRow[f] === 'X');
                    const allPass = markingFields.every(f => updatedRow[f] === '✓');

                    if (anyFail) {
                        updatedRow.overallResult = 'X';
                        updatedRow.passScore = '0%';
                    } else if (allPass) {
                        updatedRow.overallResult = '✓';
                        updatedRow.passScore = '100%';
                    } else {
                        updatedRow.overallResult = 'X';
                        updatedRow.passScore = '0%';
                    }
                }

                // Form 3: Auto-calculation for Cycle Time (Sec B)
                if (formType === 'form3') {
                    const cycleFields = ['secB_v1', 'secB_v2', 'secB_v3', 'secB_v4', 'secB_v5', 'secB_v6', 'secB_v7', 'secB_v8', 'secB_v9', 'secB_v10'];
                    if (cycleFields.includes(field)) {
                        const cycleValues = cycleFields
                            .map(f => (f === field ? value : row[f]))
                            .map(v => parseFloat(v))
                            .filter(v => !isNaN(v));

                        if (cycleValues.length > 0) {
                            updatedRow.secB_min = Math.min(...cycleValues).toString();
                            updatedRow.secB_max = Math.max(...cycleValues).toString();
                        } else {
                            updatedRow.secB_min = '';
                            updatedRow.secB_max = '';
                        }
                    }
                }

                return updatedRow;
            }
            return row;
        }));
    };

    const handleOperatorSelect = (id, user) => {
        setRows(rows.map(row => {
            if (row.id !== id) return row;

            const lineName = user.lineName || '';
            const subSectionName = user.subSectionName || '';
            const lineMachine = (lineName && subSectionName)
                ? `${lineName} (${subSectionName})`
                : (lineName || subSectionName || row.lineMachine);

            return {
                ...row,
                inspectorName: user.fullName || '',
                inspectorSign: user.fullName || '',
                empCode: user.empId || '',
                skillLevel: user.currentLevel || '',
                lineMachine,
            };
        }));
    };

    const handleHeaderChange = (field, value) => {
        setHeaderData(prev => ({ ...prev, [field]: value }));
    };

    const handleAutoSignAll = () => {
        const tlName = currentSheet?.verifiedBy || user?.fullName || user?.name || "";
        setRows(rows.map(row => ({
            ...row,
            inspectorSign: row.inspectorSign || row.inspectorName || '',
            tlSign: row.tlSign || tlName,
        })));
        toast.success("Auto-signed all rows");
    };

    const isAutoSign = (value, autoValue) => !!value && !!autoValue && value === autoValue;

    const renderInspectorSignCell = (row) => (
        <td className="border border-black p-0">
            <input
                className={`w-full text-center bg-transparent outline-none p-1 italic disabled:cursor-default ${isAutoSign(row.inspectorSign, row.inspectorName) ? 'text-indigo-600 font-medium' : 'text-blue-600'}`}
                style={isAutoSign(row.inspectorSign, row.inspectorName) ? { fontFamily: "'Segoe Script', 'Brush Script MT', cursive" } : undefined}
                value={row.inspectorSign}
                onChange={(e) => handleRowChange(row.id, 'inspectorSign', e.target.value)}
                disabled={!isEditMode}
            />
        </td>
    );

    const renderTLSignCell = (row) => {
        const fallback = currentSheet?.verifiedBy || (currentSheet?.verifiedStatus === 'APPROVE' ? 'Signed' : '');
        const displayValue = row.tlSign || (!isEditMode ? fallback : '');
        return (
            <td className="border border-black p-0">
                <input
                    className={`w-full text-center bg-transparent outline-none p-1 italic disabled:cursor-default ${isAutoSign(displayValue, currentSheet?.verifiedBy) || displayValue === 'Signed' ? 'text-indigo-600 font-medium' : 'text-blue-600'}`}
                    style={(isAutoSign(displayValue, currentSheet?.verifiedBy) || displayValue === 'Signed') ? { fontFamily: "'Segoe Script', 'Brush Script MT', cursive" } : undefined}
                    value={displayValue}
                    onChange={(e) => handleRowChange(row.id, 'tlSign', e.target.value)}
                    disabled={!isEditMode}
                />
            </td>
        );
    };

    const renderTextInput = (row, field) => (
        <textarea
            className="w-full h-full p-1 text-[10px] resize-none outline-none bg-transparent disabled:cursor-default"
            value={row[field] || ''}
            onChange={(e) => handleRowChange(row.id, field, e.target.value)}
            rows={2}
            disabled={!isEditMode}
        />
    );

    // ─── Shared approval footer (used by all three form types) ────────────────
    const renderApprovalFooter = () => (
      <>
        <div className="mt-4 grid grid-cols-3 text-[10px] font-bold text-center border-t border-black pt-4 gap-4">
            <div className="space-y-2">
                <div className="uppercase">Checked By</div>
                <div className="h-8 flex items-center justify-center border-b border-dashed border-gray-400">
                    {currentSheet?.checkedBy || "-"}
                </div>
                <div className="text-[8px] text-gray-500 font-normal">
                    {currentSheet?.createdAt ? new Date(currentSheet.createdAt).toLocaleString() : ""}
                </div>
            </div>
            <div className="space-y-2">
                <div className="uppercase">Verified By (Co-ordinator)</div>
                <div className="h-8 flex flex-col items-center justify-center border-b border-dashed border-gray-400">
                    {currentSheet?.verifiedBy ? (
                        <>
                            <span className={currentSheet.verifiedStatus === 'REJECT' ? 'text-red-600' : 'text-green-600'}>
                                {currentSheet.verifiedBy} ({currentSheet.verifiedStatus})
                            </span>
                            <span className="text-[8px] text-gray-500 font-normal">
                                {currentSheet.verifiedAt ? new Date(currentSheet.verifiedAt).toLocaleString() : ""}
                            </span>
                        </>
                    ) : (
                        <div className="flex gap-2 print:hidden">
                            {(user?.customRole?.permissions?.includes('ten_cycle:verify') || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') ? (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[8px] gap-1 border-green-600 text-green-600 hover:bg-green-50"
                                        onClick={() => handleApproval('VERIFY', 'APPROVE')}
                                    >
                                        <CheckCircle size={10} /> Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[8px] gap-1 border-red-600 text-red-600 hover:bg-red-50"
                                        onClick={() => handleApproval('VERIFY', 'REJECT')}
                                    >
                                        <XCircle size={10} /> Reject
                                    </Button>
                                </>
                            ) : <span className="text-gray-400 font-normal italic">Pending Verification</span>}
                        </div>
                    )}
                </div>
            </div>
            <div className="space-y-2">
                <div className="uppercase">Reviewed By (HOD)</div>
                <div className="h-8 flex flex-col items-center justify-center border-b border-dashed border-gray-400">
                    {currentSheet?.reviewedBy ? (
                        <>
                            <span className={currentSheet.reviewedStatus === 'REJECT' ? 'text-red-600' : 'text-green-600'}>
                                {currentSheet.reviewedBy} ({currentSheet.reviewedStatus})
                            </span>
                            <span className="text-[8px] text-gray-500 font-normal">
                                {currentSheet.reviewedAt ? new Date(currentSheet.reviewedAt).toLocaleString() : ""}
                            </span>
                        </>
                    ) : (
                        <div className="flex gap-2 print:hidden">
                            {(user?.customRole?.permissions?.includes('ten_cycle:approve') || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') ? (
                                <>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[8px] gap-1 border-green-600 text-green-600 hover:bg-green-50"
                                        onClick={() => handleApproval('APPROVE', 'APPROVE')}
                                    >
                                        <CheckCircle size={10} /> Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[8px] gap-1 border-red-600 text-red-600 hover:bg-red-50"
                                        onClick={() => handleApproval('APPROVE', 'REJECT')}
                                    >
                                        <XCircle size={10} /> Reject
                                    </Button>
                                </>
                            ) : <span className="text-gray-400 font-normal italic">Pending Review</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
        {(() => {
            // A saved sheet keeps whatever docNo/revNo/revDate was frozen into it at
            // creation; only a brand-new (not-yet-created) sheet shows the live value.
            const footerInfo = currentSheet?.docNo ? currentSheet : revisionInfo;
            return footerInfo.docNo ? (
                <div className="mt-2 flex justify-between items-center text-[9px] font-bold text-gray-500 px-1">
                    <span>Doc. No: {footerInfo.docNo}</span>
                    {footerInfo.revNo && <span>Rev. No: {footerInfo.revNo}</span>}
                    {footerInfo.revDate && <span>Rev. Date: {footerInfo.revDate}</span>}
                </div>
            ) : null;
        })()}
      </>
    );

    return (
        <Card className="w-full">
            <CardContent className="p-4 space-y-4">

                {/* ── Tab Bar ─────────────────────────────────────────────── */}
                <div className="flex border-b border-slate-200 gap-0 -mx-4 px-4">
                    <button
                        onClick={() => setActiveTab('monitoring')}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === 'monitoring' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Monitoring
                    </button>
                    <button
                        onClick={() => setActiveTab('sheet')}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${activeTab === 'sheet' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        10-Cycle Sheet
                        {selectedSheetId && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isEditMode ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                                {isEditMode ? 'EDIT' : 'VIEW'}
                            </span>
                        )}
                    </button>
                    {canEditConfig && (
                        <button
                            onClick={() => setActiveTab('editLayout')}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${activeTab === 'editLayout' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            <Edit2 size={14} /> Edit Layout
                        </button>
                    )}
                </div>

                {/* ── MONITORING TAB ───────────────────────────────────────── */}
                {activeTab === 'monitoring' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h1 className="text-xl font-bold">10 Cycle Check Sheets</h1>
                            {canCreate && (
                                <Button onClick={() => setCreateOpen(true)}>Add 10 Cycle Sheet</Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-xs mb-1 block">Department</Label>
                                <Select value={selectedDepartmentFilter} onValueChange={(v) => {
                                    setSelectedDepartmentFilter(v);
                                    setSelectedSectionFilter("");
                                    setSelectedLineFilter("");
                                    setSelectedSubSectionFilter("");
                                }} disabled={isRestricted && assignableDepartments.length <= 1}>
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
                                <Label className="text-xs mb-1 block">Section</Label>
                                <Select value={selectedSectionFilter} onValueChange={(v) => {
                                    setSelectedSectionFilter(v);
                                    setSelectedLineFilter("");
                                    setSelectedSubSectionFilter("");
                                }} disabled={!selectedDepartmentFilter || (isRestricted && assignableSections.length <= 1)}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assignableSections.map((sec) => (
                                            <SelectItem key={sec._id || sec.id} value={String(sec._id || sec.id)}>
                                                {sec.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">Line</Label>
                                <Select value={selectedLineFilter} onValueChange={(v) => {
                                    setSelectedLineFilter(v);
                                    setSelectedSubSectionFilter("");
                                }} disabled={!selectedSectionFilter}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select line" />
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
                            <div>
                                <Label className="text-xs mb-1 block">Sub-Section (Optional)</Label>
                                <Select value={selectedSubSectionFilter} onValueChange={setSelectedSubSectionFilter} disabled={!selectedLineFilter}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select sub-section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subSections.map((ss) => (
                                            <SelectItem key={ss._id || ss.id} value={String(ss._id || ss.id)}>
                                                {ss.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

        <div className="border rounded">
                            {loadingSheets ? (
                                <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading sheets...
                                </div>
                            ) : sheetList.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground">
                                    No sheets found.{canCreate ? " Create a new 10 cycle sheet." : ""}
                                </div>
                            ) : (
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-left text-slate-600 uppercase text-[10px] tracking-wide">
                                            <th className="p-2 border-b">Sr. No.</th>
                                            <th className="p-2 border-b">Department</th>
                                            <th className="p-2 border-b">Section</th>
                                            <th className="p-2 border-b">Line / Sub-Section</th>
                                            <th className="p-2 border-b">Form Type</th>
                                            <th className="p-2 border-b">Created Date / By</th>
                                            <th className="p-2 border-b">Last Updated By / Remark</th>
                                            <th className="p-2 border-b">Action By</th>
                                            <th className="p-2 border-b">Status</th>
                                            <th className="p-2 border-b">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sheetList.map((sheet, index) => {
                                            const getStatusInfo = () => {
                                                if (sheet.reviewedStatus === 'REJECT') return { label: 'Rejected (Reviewer)', color: 'bg-red-100 text-red-700', by: sheet.reviewedBy };
                                                if (sheet.verifiedStatus === 'REJECT') return { label: 'Rejected (Verifier)', color: 'bg-red-100 text-red-700', by: sheet.verifiedBy };
                                                if (sheet.reviewedStatus === 'APPROVE') return { label: 'Approved', color: 'bg-green-100 text-green-700', by: sheet.reviewedBy };
                                                if (sheet.verifiedStatus === 'APPROVE') return { label: 'Verified', color: 'bg-teal-100 text-teal-700', by: sheet.verifiedBy };
                                                if (sheet.status === 'Submitted') return { label: 'Submitted', color: 'bg-blue-100 text-blue-700', by: null };
                                                return { label: 'Draft', color: 'bg-slate-100 text-slate-700', by: null };
                                            };
                                            const status = getStatusInfo();
                                            const locked = isSheetLocked(sheet);
                                            const lineSubSection = [sheet.lineName, sheet.subSectionName].filter(Boolean).join(" / ");

                                            return (
                                                <tr key={sheet.id} className="border-b hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-2 align-top">{index + 1}</td>
                                                    <td className="p-2 align-top">
                                                        <button className="font-bold text-slate-900 hover:underline text-left" onClick={() => fetchSheetById(String(sheet.id), false)}>
                                                            {sheet.departmentName || "-"}
                                                        </button>
                                                    </td>
                                                    <td className="p-2 align-top">{sheet.sectionName || "-"}</td>
                                                    <td className="p-2 align-top">{lineSubSection || "-"}</td>
                                                    <td className="p-2 align-top">{sheet.formType === "form1" ? "Form 1" : sheet.formType === "form2" ? "Form 2" : "Form 3"}</td>
                                                    <td className="p-2 align-top">
                                                        <div>{sheet.createdDate ? String(sheet.createdDate).split("T")[0] : "-"}</div>
                                                        <div className="text-slate-500">{sheet.createdBy || "-"}</div>
                                                    </td>
                                                    <td className="p-2 align-top max-w-[220px]">
                                                        <div className="font-medium text-slate-700">{sheet.updatedBy || "-"}</div>
                                                        {sheet.lastEditRemark && (
                                                            <div className="text-slate-500 italic truncate" title={sheet.lastEditRemark}>
                                                                &quot;{sheet.lastEditRemark}&quot;
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 align-top">{status.by || "-"}</td>
                                                    <td className="p-2 align-top">
                                                        <Badge className={`${status.color} border-none font-bold uppercase text-[9px] tracking-wider px-2 py-0.5`}>
                                                            {status.label}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-2 align-top">
                                                        <div className="flex items-center gap-1.5">
                                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fetchSheetById(String(sheet.id), false)}>
                                                                View
                                                            </Button>
                                                            {canUpdate && (!locked || canEditApproved) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs gap-1"
                                                                    onClick={() => fetchSheetById(String(sheet.id), true)}
                                                                >
                                                                    <Pencil size={12} /> Edit
                                                                </Button>
                                                            )}
                                                            {canDelete && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50"
                                                                    onClick={() => handleDeleteSheet(sheet.id)}
                                                                >
                                                                    <Trash2 size={12} /> Delete
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {/* ── SHEET TAB ────────────────────────────────────────────── */}
                {activeTab === 'sheet' && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : !selectedSheetId ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 space-y-2">
                                <div className="text-lg font-medium">No sheet selected</div>
                                <div className="text-sm">Select a sheet from the Monitoring tab or click &quot;Add 10 Cycle Sheet&quot; to begin.</div>
                                <Button variant="outline" onClick={() => setActiveTab('monitoring')} className="mt-2">
                                    Go to Monitoring
                                </Button>
                            </div>
                        ) : (
                            <>
                                {/* Sheet header */}
                                <div className="flex flex-col space-y-2 mb-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <Button variant="outline" size="sm" onClick={() => setActiveTab('monitoring')}>
                                                Back to Monitoring
                                            </Button>
                                            {currentSheet && (
                                                <div className="flex items-center gap-3">
                                                    {(() => {
                                                        const getStatus = () => {
                                                            if (currentSheet.reviewedStatus === 'REJECT') return { label: 'REJECTED BY REVIEWER', color: 'bg-red-500', icon: <XCircle size={14} />, by: currentSheet.reviewedBy };
                                                            if (currentSheet.verifiedStatus === 'REJECT') return { label: 'REJECTED BY VERIFIER', color: 'bg-red-500', icon: <XCircle size={14} />, by: currentSheet.verifiedBy };
                                                            if (currentSheet.reviewedStatus === 'APPROVE') return { label: 'APPROVED', color: 'bg-green-600', icon: <CheckCircle size={14} />, by: currentSheet.reviewedBy };
                                                            if (currentSheet.status === 'Submitted') return { label: 'SUBMITTED (PENDING)', color: 'bg-blue-600', icon: <Loader2 size={14} className="animate-spin" />, by: null };
                                                            return { label: 'DRAFT', color: 'bg-slate-500', icon: null, by: null };
                                                        };
                                                        const status = getStatus();
                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                <Badge className={`${status.color} text-white border-none px-3 py-1 flex items-center gap-1.5 font-bold`}>
                                                                    {status.icon}
                                                                    {status.label}
                                                                </Badge>
                                                                {status.by && (
                                                                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                                                                        Action By: {status.by}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isEditMode && canUpdate && (
                                                isSheetLocked(currentSheet) && !canEditApproved ? (
                                                    <span
                                                        className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200"
                                                        title="Only Admin or authorized personnel can edit a verified or approved sheet"
                                                    >
                                                        Locked (Verified/Approved)
                                                    </span>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsEditMode(true)}>
                                                        <Pencil size={14} /> Edit Sheet
                                                    </Button>
                                                )
                                            )}
                                            {isEditMode && (
                                                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">EDIT MODE</span>
                                            )}
                                            <div className="text-sm font-semibold text-slate-500 uppercase tracking-tight">
                                                {formType === "form3" ? "Form 3 (10 Cycle Numerical)" : formType === "form2" ? "Form 2 (Text Observations)" : "Form 1 (Standard Checkbox)"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center border-b-2 border-black pb-1 relative">
                                        <h1 className="text-xl font-bold uppercase w-full text-center">
                                            10 CYCLE CHECK MONITORING SHEET ( Existing Operators )
                                        </h1>
                                        <span className="font-bold text-[10px] absolute right-0 -top-6">FURUKAWA MINDA ELECTRIC PVT.LTD.</span>
                                        <div className="text-[10px] absolute right-0 bottom-0 text-blue-600 font-bold flex flex-col items-end leading-tight">
                                            <span>Dept.:-{currentDepartmentName || "-"} | Created:-{createdDate || "-"}</span>
                                            <div className="flex gap-2">
                                                {selectedSectionFilter && <span>Sec: {sections.find(s => String(s._id || s.id) === selectedSectionFilter)?.name}</span>}
                                                {selectedLineFilter && <span>Line: {lines.find(l => String(l._id || l.id) === selectedLineFilter)?.name}</span>}
                                                {selectedSubSectionFilter && <span>Sub-Sec: {subSections.find(ss => String(ss._id || ss.id) === selectedSubSectionFilter)?.name}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border border-black grid grid-cols-2">
                                        {/* Quality Engineer Side */}
                                        <div className="border-r border-black">
                                            <div className="flex border-b border-black">
                                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Quality Engineer/Supervisor Name:-</div>
                                                <div className="w-1/2 p-1">
                                                    <Input
                                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                                        value={headerData.qualityEngineer}
                                                        onChange={e => handleHeaderChange('qualityEngineer', e.target.value)}
                                                        disabled={!isEditMode}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex">
                                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Quality Engineer/Supervisor Signature:-</div>
                                                <div className="w-1/2 p-1">
                                                    <Input
                                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                                        value={headerData.qualityEngineerSign}
                                                        onChange={e => handleHeaderChange('qualityEngineerSign', e.target.value)}
                                                        disabled={!isEditMode}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {/* Dojo Engineer Side */}
                                        <div>
                                            <div className="flex border-b border-black">
                                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Dojo Engineer Name:-</div>
                                                <div className="w-1/2 p-1">
                                                    <Input
                                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                                        value={headerData.dojoEngineer}
                                                        onChange={e => handleHeaderChange('dojoEngineer', e.target.value)}
                                                        disabled={!isEditMode}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex">
                                                <div className="w-1/2 p-1 font-bold text-xs bg-gray-50">Dojo Engineer Signature:-</div>
                                                <div className="w-1/2 p-1">
                                                    <Input
                                                        className="h-6 text-xs p-1 border-none focus-visible:ring-0 text-blue-600 font-bold"
                                                        value={headerData.dojoEngineerSign}
                                                        onChange={e => handleHeaderChange('dojoEngineerSign', e.target.value)}
                                                        disabled={!isEditMode}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-2 border-black">
                                    {formType === 'form1' ? (
                                        /* FORM 1: Checkbox Style with Dropdowns */
                                        <div className="min-w-[3200px]">
                                            <table className="w-full text-[10px] border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100 text-center font-bold">
                                                        <th rowSpan="3" className="border border-black p-1 w-[40px]">Sr. No.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[90px]">Date</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Line/ Machine No.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Model Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[150px]">Part Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[150px]">Operation Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">SOP No.</th>
                                                        <th colSpan={config.secA.questions.length + config.secA.generalPoints.length} className="border border-black p-1 bg-white">Section - A</th>
                                                        <th colSpan={config.secB.instruments.length} className="border border-black p-1 bg-white">Section - B</th>
                                                        <th colSpan={config.secC.columns.length} className="border border-black p-1 bg-white">Section-C</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Operator Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[80px]">Emp. Code</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[60px]">Skill Level</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[180px]">Observation in Section - A</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[180px]">Observation in Section - B</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[180px]">Observation in Section - C</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[70px] bg-yellow-100">Pass Score %</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[80px]">Overall Result</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">Operator Sign.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">TL Sign.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[200px]">Remark if any</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        <th colSpan={config.secA.questions.length} className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                        <th colSpan={config.secA.generalPoints.length} className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Measuring Instrument Using Method</th>
                                                        <th colSpan={config.secC.columns.length} className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        {config.secA.questions.map(q => (
                                                            <th key={`f1qh_${q.id}`} className="border border-black w-[40px] bg-white">{q.label}</th>
                                                        ))}
                                                        {config.secA.generalPoints.map(g => (
                                                            <th key={`f1gph_${g.id}`} className="border border-black w-[40px] bg-white">{g.label}</th>
                                                        ))}
                                                        {config.secB.instruments.map(i => (
                                                            <th key={`f1ih_${i.id}`} className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full whitespace-nowrap px-1">{i.label}</div></th>
                                                        ))}
                                                        {config.secC.columns.map(c => (
                                                            <th key={`f1ch_${c.id}`} className="border border-black w-[40px] bg-white">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, index) => (
                                                        <tr key={row.id} className="text-center group hover:bg-gray-50 h-8">
                                                            <td className="border border-black relative">
                                                                {index + 1}
                                                                {isEditMode && <button onClick={() => removeRow(row.id)} className="absolute left-0 top-0 text-red-500 opacity-0 group-hover:opacity-100 p-0.5 print:hidden"><Trash2 size={10} /></button>}
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <input type="date" className="w-full text-center bg-transparent outline-none p-1 text-[9px] disabled:cursor-default" value={row.date} onChange={(e) => handleRowChange(row.id, 'date', e.target.value)} disabled={!isEditMode} min={new Date().toLocaleDateString('en-CA')} max={new Date().toLocaleDateString('en-CA')} />
                                                            </td>
                                                            <td className="border border-black p-0 h-8 bg-yellow-50">
                                                                <input
                                                                    list={`stations-f1-${row.id}`}
                                                                    className="w-full h-full text-center bg-transparent outline-none text-[10px] py-1 text-blue-600 font-bold disabled:cursor-default"
                                                                    placeholder="Search Station..."
                                                                    value={row.lineMachine || ''}
                                                                    onChange={(e) => handleRowChange(row.id, 'lineMachine', e.target.value)}
                                                                    disabled={!isEditMode}
                                                                />
                                                                <datalist id={`stations-f1-${row.id}`}>
                                                                    {stations.map(st => (
                                                                        <option key={st.id} value={st.name}>
                                                                            {st.name} ({st.subSectionName || '-'})
                                                                        </option>
                                                                    ))}
                                                                </datalist>
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-50">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.modelName} onChange={(e) => handleRowChange(row.id, 'modelName', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-50">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.partName} onChange={(e) => handleRowChange(row.id, 'partName', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-50">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.operationName} onChange={(e) => handleRowChange(row.id, 'operationName', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-50">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.sopNo} onChange={(e) => handleRowChange(row.id, 'sopNo', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            {[...secAQuestionFields, ...secAGeneralPointFields].map(field => (
                                                                <td key={field} className="border border-black p-0 align-middle">
                                                                    <select
                                                                        className="w-full h-full bg-transparent outline-none text-center appearance-none cursor-pointer font-bold text-blue-600 text-[12px] disabled:cursor-default"
                                                                        value={row[field] || ''}
                                                                        onChange={(e) => handleRowChange(row.id, field, e.target.value)}
                                                                        disabled={!isEditMode}
                                                                    >
                                                                        <option value=""></option>
                                                                        <option value="✓">✓</option>
                                                                        <option value="X">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {secBInstrumentFields.map(field => (
                                                                <td key={field} className="border border-black p-0 align-middle">
                                                                    <select
                                                                        className="w-full h-full bg-transparent outline-none text-center appearance-none cursor-pointer font-bold text-blue-600 text-[12px] disabled:cursor-default"
                                                                        value={row[field] || ''}
                                                                        onChange={(e) => handleRowChange(row.id, field, e.target.value)}
                                                                        disabled={!isEditMode}
                                                                    >
                                                                        <option value=""></option>
                                                                        <option value="✓">✓</option>
                                                                        <option value="X">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {secCColumnFields.map(field => (
                                                                <td key={field} className="border border-black p-0 align-middle">
                                                                    <select
                                                                        className="w-full h-full bg-transparent outline-none text-center appearance-none cursor-pointer font-bold text-blue-600 text-[12px] disabled:cursor-default"
                                                                        value={row[field] || ''}
                                                                        onChange={(e) => handleRowChange(row.id, field, e.target.value)}
                                                                        disabled={!isEditMode}
                                                                    >
                                                                        <option value=""></option>
                                                                        <option value="✓">✓</option>
                                                                        <option value="X">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            <td className="border border-black p-0 bg-yellow-50">
                                                                <UserAutocomplete
                                                                    compact
                                                                    departmentId={selectedDepartmentFilter}
                                                                    sectionId={selectedSectionFilter}
                                                                    passedDate={row.date}
                                                                    passedTestPaperOnly="any"
                                                                    value={row.inspectorName}
                                                                    onChange={(user) => handleOperatorSelect(row.id, user)}
                                                                    onTextChange={(val) => handleRowChange(row.id, 'inspectorName', val)}
                                                                    placeholder="Search Operator..."
                                                                    inputClassName="text-blue-600 font-bold"
                                                                    disabled={!isEditMode}
                                                                />
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-50">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.empCode} onChange={(e) => handleRowChange(row.id, 'empCode', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.skillLevel} onChange={(e) => handleRowChange(row.id, 'skillLevel', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.obsSecA} onChange={(e) => handleRowChange(row.id, 'obsSecA', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.obsSecB} onChange={(e) => handleRowChange(row.id, 'obsSecB', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.obsSecC} onChange={(e) => handleRowChange(row.id, 'obsSecC', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-100 font-bold text-green-600">
                                                                {row.passScore}
                                                            </td>
                                                            <td className="border border-black p-0 font-bold text-blue-600">
                                                                {row.overallResult === '✓' ? 'Pass' : row.overallResult === 'X' ? 'Fail' : '-'}
                                                            </td>
                                                            {renderInspectorSignCell(row)}
                                                            {renderTLSignCell(row)}
                                                            <td className="border border-black p-0">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.remark} onChange={(e) => handleRowChange(row.id, 'remark', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <div className="mt-4 p-2 border-t-2 border-black grid grid-cols-1 md:grid-cols-4 gap-4 text-[9px]">
                                                <div className="border border-gray-300 p-2 rounded">
                                                    <h3 className="font-bold border-b border-black mb-1">Note :-</h3>
                                                    <p>If any abnormality found which is related to Man, Machine, SOP & other then write it in remark section.</p>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded">
                                                    <h3 className="font-bold border-b border-black mb-1">Legend:-</h3>
                                                    <div className="grid grid-cols-2 gap-x-2">
                                                        <span>A,B,C Marking</span><span>Pass = ✓, Fail = X</span>
                                                        <span>Overall Result</span><span>If all Pass(A+B+C) = ✓</span>
                                                        <span>Question Marking</span><span>Yes = ✓, No = X</span>
                                                        <span>Cycle Time</span><span>Minute = m, Second = s</span>
                                                        <span>Pass Score %</span><span>If all Pass(A+B+C) = 100%</span>
                                                    </div>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A Four Question Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        {config.secA.questions.map(q => (
                                                            <li key={q.id}>{q.label} :- {q.desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        {config.secA.generalPoints.map(g => (
                                                            <li key={g.id}>{g.label} :- {g.desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {renderApprovalFooter()}
                                        </div>
                                    ) : formType === 'form2' ? (
                                        /* FORM 2: Complete Monitoring Sheet (Markings + Observations) */
                                        <div className="min-w-[3800px]">
                                            <div className="flex justify-between items-center border-b-2 border-black pb-1 relative mb-2">
                                                <h1 className="text-xl font-bold uppercase w-full text-center">
                                                    10 CYCLE CHECK MONITORING SHEET ( Complete )
                                                </h1>
                                                <span className="font-bold text-[10px] absolute right-0 -top-6">FURUKAWA MINDA ELECTRIC PVT.LTD.</span>
                                                <div className="text-[10px] absolute right-0 bottom-0 text-blue-600 font-bold flex flex-col items-end leading-tight">
                                                    <span>Dept.:-{currentDepartmentName || "-"} | Created:-{createdDate || "-"}</span>
                                                    <div className="flex gap-2">
                                                        {selectedSectionFilter && <span>Sec: {sections.find(s => String(s._id || s.id) === selectedSectionFilter)?.name}</span>}
                                                        {selectedLineFilter && <span>Line: {lines.find(l => String(l._id || l.id) === selectedLineFilter)?.name}</span>}
                                                        {selectedSubSectionFilter && <span>Sub-Sec: {subSections.find(ss => String(ss._id || ss.id) === selectedSubSectionFilter)?.name}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <table className="w-full text-[10px] border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100 text-center font-bold">
                                                        <th rowSpan="3" className="border border-black p-1 w-[40px]">Sr. No.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[90px]">Date</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Line/ Machine No.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Model Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[150px]">Part Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[150px]">Operation Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">SOP No.</th>
                                                        <th colSpan={config.secA.questions.length + config.secA.generalPoints.length} className="border border-black p-1 bg-white">Section - A</th>
                                                        <th colSpan={config.secB.instruments.length} className="border border-black p-1 bg-white">Section - B</th>
                                                        <th colSpan={config.secC.columns.length} className="border border-black p-1 bg-white">Section-C</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Inspector Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[80px]">Emp. Code</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[60px]">Skill Level</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[350px]">Observation in Section - A</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[350px]">Observation in Section - B</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[350px]">Observation in Section - C</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[70px] bg-yellow-100">Pass Score %</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[80px]">Overall Result</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">Inspector Sign.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">TL Sign.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[200px]">Remark if any</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        <th colSpan={config.secA.questions.length} className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                        <th colSpan={config.secA.generalPoints.length} className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Measuring Instrument Using Method</th>
                                                        <th colSpan={config.secC.columns.length} className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        {config.secA.questions.map(q => (
                                                            <th key={`f2qh_${q.id}`} className="border border-black w-[40px] bg-white">{q.label}</th>
                                                        ))}
                                                        {config.secA.generalPoints.map(g => (
                                                            <th key={`f2gph_${g.id}`} className="border border-black w-[40px] bg-white">{g.label}</th>
                                                        ))}
                                                        {config.secB.instruments.map(i => (
                                                            <th key={`f2ih_${i.id}`} className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full [writing-mode:vertical-rl] rotate-180 whitespace-nowrap px-1">{i.label}</div></th>
                                                        ))}
                                                        {config.secC.columns.map(c => (
                                                            <th key={`f2ch_${c.id}`} className="border border-black w-[40px] bg-white">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, index) => (
                                                        <tr key={row.id} className="text-center group hover:bg-gray-50">
                                                            <td className="border border-black relative">
                                                                {index + 1}
                                                                {isEditMode && <button onClick={() => removeRow(row.id)} className="absolute left-0 top-0 text-red-500 opacity-0 group-hover:opacity-100 p-0.5"><Trash2 size={10} /></button>}
                                                            </td>
                                                            <td className="border border-black p-0"><input type="date" className="w-full text-center bg-transparent outline-none p-1 disabled:cursor-default" value={row.date} onChange={(e) => handleRowChange(row.id, 'date', e.target.value)} disabled={!isEditMode} min={new Date().toLocaleDateString('en-CA')} max={new Date().toLocaleDateString('en-CA')} /></td>
                                                            <td className="border border-black p-0 h-8">
                                                                <input
                                                                    list={`stations-f2-${row.id}`}
                                                                    className="w-full h-full text-center bg-transparent outline-none text-[10px] py-1 text-blue-600 disabled:cursor-default"
                                                                    placeholder="Search Station..."
                                                                    value={row.lineMachine || ''}
                                                                    onChange={(e) => handleRowChange(row.id, 'lineMachine', e.target.value)}
                                                                    disabled={!isEditMode}
                                                                />
                                                                <datalist id={`stations-f2-${row.id}`}>
                                                                    {stations.map(st => (
                                                                        <option key={st.id} value={st.name}>
                                                                            {st.name} ({st.subSectionName || '-'})
                                                                        </option>
                                                                    ))}
                                                                </datalist>
                                                            </td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.modelName} onChange={(e) => handleRowChange(row.id, 'modelName', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.partName} onChange={(e) => handleRowChange(row.id, 'partName', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.operationName} onChange={(e) => handleRowChange(row.id, 'operationName', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.sopNo} onChange={(e) => handleRowChange(row.id, 'sopNo', e.target.value)} disabled={!isEditMode} /></td>
                                                            {[...secAQuestionFields, ...secAGeneralPointFields].map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {secBInstrumentFields.map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {secCColumnFields.map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            <td className="border border-black p-0">
                                                                <UserAutocomplete
                                                                    compact
                                                                    departmentId={selectedDepartmentFilter}
                                                                    sectionId={selectedSectionFilter}
                                                                    passedDate={row.date}
                                                                    passedTestPaperOnly="any"
                                                                    value={row.inspectorName}
                                                                    onChange={(user) => handleOperatorSelect(row.id, user)}
                                                                    onTextChange={(val) => handleRowChange(row.id, 'inspectorName', val)}
                                                                    placeholder="Search Operator..."
                                                                    inputClassName="text-blue-600"
                                                                    disabled={!isEditMode}
                                                                />
                                                            </td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.empCode} onChange={(e) => handleRowChange(row.id, 'empCode', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.skillLevel} onChange={(e) => handleRowChange(row.id, 'skillLevel', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><textarea className="w-full h-12 p-1 bg-transparent outline-none resize-none text-[9px] text-blue-600 disabled:cursor-default" value={row.obsSecA} onChange={(e) => handleRowChange(row.id, 'obsSecA', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><textarea className="w-full h-12 p-1 bg-transparent outline-none resize-none text-[9px] text-blue-600 disabled:cursor-default" value={row.obsSecB} onChange={(e) => handleRowChange(row.id, 'obsSecB', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><textarea className="w-full h-12 p-1 bg-transparent outline-none resize-none text-[9px] text-blue-600 disabled:cursor-default" value={row.obsSecC} onChange={(e) => handleRowChange(row.id, 'obsSecC', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0 bg-yellow-100 font-bold text-green-600">{row.passScore}</td>
                                                            <td className="border border-black p-0 font-bold text-blue-600">{row.overallResult === '✓' ? 'Pass' : row.overallResult === 'X' ? 'Fail' : '-'}</td>
                                                            {renderInspectorSignCell(row)}
                                                            {renderTLSignCell(row)}
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.remark} onChange={(e) => handleRowChange(row.id, 'remark', e.target.value)} disabled={!isEditMode} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <div className="mt-4 p-2 border-t-2 border-black grid grid-cols-1 md:grid-cols-4 gap-4 text-[9px]">
                                                <div className="border border-gray-300 p-2 rounded">
                                                    <h3 className="font-bold border-b border-black mb-1">Note :-</h3>
                                                    <p>If any abnormality found which is related to Man, Machine, SOP & other then write it in remark section.</p>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded">
                                                    <h3 className="font-bold border-b border-black mb-1">Legend:-</h3>
                                                    <div className="grid grid-cols-2 gap-x-2">
                                                        <span>A,B,C Marking</span><span>Pass = ✓, Fail = X</span>
                                                        <span>Overall Result</span><span>If all Pass(A+B+C) = ✓</span>
                                                        <span>Question Marking</span><span>Yes = ✓, No = X</span>
                                                        <span>Cycle Time</span><span>Minute = m, Second = s</span>
                                                        <span>Pass Score %</span><span>If all Pass(A+B+C) = 100%</span>
                                                    </div>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A Four Question Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        {config.secA.questions.map(q => (
                                                            <li key={q.id}>{q.label} :- {q.desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        {config.secA.generalPoints.map(g => (
                                                            <li key={g.id}>{g.label} :- {g.desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {renderApprovalFooter()}
                                        </div>
                                    ) : (
                                        /* FORM 3: Numerical 10 Cycle Sheet */
                                        <div className="min-w-[4200px]">
                                            <div className="flex justify-between items-center border-b-2 border-black pb-1 relative mb-2">
                                                <h1 className="text-xl font-bold uppercase w-full text-center">
                                                    10 CYCLE CHECK MONITORING SHEET ( Numerical )
                                                </h1>
                                                <span className="font-bold text-[10px] absolute right-0 -top-6">FURUKAWA MINDA ELECTRIC PVT.LTD.</span>
                                                <div className="text-[10px] absolute right-0 bottom-0 text-blue-600 font-bold flex flex-col items-end leading-tight">
                                                    <span>Dept.:-{currentDepartmentName || "-"} | Created:-{createdDate || "-"}</span>
                                                    <div className="flex gap-2">
                                                        {selectedSectionFilter && <span>Sec: {sections.find(s => String(s._id || s.id) === selectedSectionFilter)?.name}</span>}
                                                        {selectedLineFilter && <span>Line: {lines.find(l => String(l._id || l.id) === selectedLineFilter)?.name}</span>}
                                                        {selectedSubSectionFilter && <span>Sub-Sec: {subSections.find(ss => String(ss._id || ss.id) === selectedSubSectionFilter)?.name}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <table className="w-full text-[10px] border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100 text-center font-bold">
                                                        <th rowSpan="3" className="border border-black p-1 w-[40px]">Sr. No.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[90px]">Date</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Line/ Machine No.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Model Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[150px]">Part Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[150px]">Operation Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">SOP No.</th>
                                                        <th colSpan={config.secA.questions.length + config.secA.generalPoints.length} className="border border-black p-1 bg-white">Section - A</th>
                                                        <th colSpan="13" className="border border-black p-1 bg-white">Section - B</th>
                                                        <th colSpan={config.secC.columns.length} className="border border-black p-1 bg-white">Section-C</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[120px]">Inspector Name</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[80px]">Emp. Code</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[60px]">Skill Level</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[350px]">Observation in Section - A</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[350px]">Observation in Section - B</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[350px]">Observation in Section - C</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[70px] bg-yellow-100">Pass Score %</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[80px]">Overall Result</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">Inspector Sign.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[100px]">TL Sign.</th>
                                                        <th rowSpan="3" className="border border-black p-1 w-[200px]">Remark if any</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        <th colSpan={config.secA.questions.length} className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                        <th colSpan={config.secA.generalPoints.length} className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                        <th colSpan="10" className="border border-black p-1 bg-white text-red-600">10 Cycle Check</th>
                                                        <th rowSpan="2" className="border border-black p-1 bg-white">Cycle Time Spec.</th>
                                                        <th colSpan="2" className="border border-black p-1 bg-yellow-50 text-blue-600">Cycle Time Obs.</th>
                                                        <th colSpan={config.secC.columns.length} className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        {config.secA.questions.map(q => (
                                                            <th key={`f3qh_${q.id}`} className="border border-black w-[35px] bg-white">{q.label}</th>
                                                        ))}
                                                        {config.secA.generalPoints.map(g => (
                                                            <th key={`f3gph_${g.id}`} className="border border-black w-[35px] bg-white">{g.label}</th>
                                                        ))}
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                            <th key={n} className="border border-black w-[40px] bg-white">{n}</th>
                                                        ))}
                                                        <th className="border border-black w-[45px] bg-yellow-50 text-blue-600">Min.</th>
                                                        <th className="border border-black w-[45px] bg-yellow-50 text-blue-600">Max.</th>
                                                        {config.secC.columns.map(c => (
                                                            <th key={`f3ch_${c.id}`} className="border border-black w-[35px] bg-white">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row, index) => (
                                                        <tr key={row.id} className="text-center group hover:bg-gray-50">
                                                            <td className="border border-black relative">
                                                                {index + 1}
                                                                {isEditMode && <button onClick={() => removeRow(row.id)} className="absolute left-0 top-0 text-red-500 opacity-0 group-hover:opacity-100 p-0.5"><Trash2 size={10} /></button>}
                                                            </td>
                                                            <td className="border border-black p-0"><input type="date" className="w-full text-center bg-transparent outline-none p-1 disabled:cursor-default" value={row.date} onChange={(e) => handleRowChange(row.id, 'date', e.target.value)} disabled={!isEditMode} min={new Date().toLocaleDateString('en-CA')} max={new Date().toLocaleDateString('en-CA')} /></td>
                                                            <td className="border border-black p-0 h-8">
                                                                <input
                                                                    list={`stations-f3-${row.id}`}
                                                                    className="w-full h-full text-center bg-transparent outline-none text-[10px] py-1 text-blue-600 disabled:cursor-default"
                                                                    placeholder="Search Station..."
                                                                    value={row.lineMachine || ''}
                                                                    onChange={(e) => handleRowChange(row.id, 'lineMachine', e.target.value)}
                                                                    disabled={!isEditMode}
                                                                />
                                                                <datalist id={`stations-f3-${row.id}`}>
                                                                    {stations.map(st => (
                                                                        <option key={st.id} value={st.name}>
                                                                            {st.name} ({st.subSectionName || '-'})
                                                                        </option>
                                                                    ))}
                                                                </datalist>
                                                            </td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.modelName} onChange={(e) => handleRowChange(row.id, 'modelName', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.partName} onChange={(e) => handleRowChange(row.id, 'partName', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.operationName} onChange={(e) => handleRowChange(row.id, 'operationName', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.sopNo} onChange={(e) => handleRowChange(row.id, 'sopNo', e.target.value)} disabled={!isEditMode} /></td>
                                                            {[...secAQuestionFields, ...secAGeneralPointFields].map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                <td key={n} className="border border-black p-0">
                                                                    <input className="w-full text-center bg-transparent outline-none p-1 text-red-600 font-bold disabled:cursor-default" value={row[`secB_v${n}`]} onChange={(e) => handleRowChange(row.id, `secB_v${n}`, e.target.value)} disabled={!isEditMode} />
                                                                </td>
                                                            ))}
                                                            <td className="border border-black p-0">
                                                                <input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.secB_spec} onChange={(e) => handleRowChange(row.id, 'secB_spec', e.target.value)} disabled={!isEditMode} />
                                                            </td>
                                                            <td className="border border-black p-0 bg-yellow-50 font-bold text-blue-600">{row.secB_min}</td>
                                                            <td className="border border-black p-0 bg-yellow-50 font-bold text-blue-600">{row.secB_max}</td>
                                                            {secCColumnFields.map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            <td className="border border-black p-0">
                                                                <UserAutocomplete
                                                                    compact
                                                                    departmentId={selectedDepartmentFilter}
                                                                    sectionId={selectedSectionFilter}
                                                                    passedDate={row.date}
                                                                    passedTestPaperOnly="any"
                                                                    value={row.inspectorName}
                                                                    onChange={(user) => handleOperatorSelect(row.id, user)}
                                                                    onTextChange={(val) => handleRowChange(row.id, 'inspectorName', val)}
                                                                    placeholder="Search Operator..."
                                                                    inputClassName="text-blue-600"
                                                                    disabled={!isEditMode}
                                                                />
                                                            </td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 font-bold disabled:cursor-default" value={row.empCode} onChange={(e) => handleRowChange(row.id, 'empCode', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.skillLevel} onChange={(e) => handleRowChange(row.id, 'skillLevel', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><textarea className="w-full h-12 p-1 bg-transparent outline-none resize-none text-[9px] text-blue-600 disabled:cursor-default" value={row.obsSecA} onChange={(e) => handleRowChange(row.id, 'obsSecA', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><textarea className="w-full h-12 p-1 bg-transparent outline-none resize-none text-[9px] text-blue-600 disabled:cursor-default" value={row.obsSecB} onChange={(e) => handleRowChange(row.id, 'obsSecB', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0"><textarea className="w-full h-12 p-1 bg-transparent outline-none resize-none text-[9px] text-blue-600 disabled:cursor-default" value={row.obsSecC} onChange={(e) => handleRowChange(row.id, 'obsSecC', e.target.value)} disabled={!isEditMode} /></td>
                                                            <td className="border border-black p-0 bg-yellow-100 font-bold text-green-600">{row.passScore}</td>
                                                            <td className="border border-black p-0 font-bold text-blue-600">{row.overallResult === '✓' ? 'Pass' : row.overallResult === 'X' ? 'Fail' : '-'}</td>
                                                            {renderInspectorSignCell(row)}
                                                            {renderTLSignCell(row)}
                                                            <td className="border border-black p-0"><input className="w-full text-center bg-transparent outline-none p-1 text-blue-600 disabled:cursor-default" value={row.remark} onChange={(e) => handleRowChange(row.id, 'remark', e.target.value)} disabled={!isEditMode} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <div className="mt-4 p-2 border-t-2 border-black grid grid-cols-1 md:grid-cols-4 gap-4 text-[9px]">
                                                <div className="border border-gray-300 p-2 rounded">
                                                    <h3 className="font-bold border-b border-black mb-1">Note :-</h3>
                                                    <p>If any abnormality found which is related to Man, Machine, SOP & other then write it in remark section.</p>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded">
                                                    <h3 className="font-bold border-b border-black mb-1">Legend:-</h3>
                                                    <div className="grid grid-cols-2 gap-x-2">
                                                        <span>A,B,C Marking</span><span>Pass = ✓, Fail = X</span>
                                                        <span>Overall Result</span><span>If all Pass(A+B+C) = ✓</span>
                                                        <span>Question Marking</span><span>Yes = ✓, No = X</span>
                                                        <span>Cycle Time</span><span>Minute = m, Second = s</span>
                                                        <span>Pass Score %</span><span>If all Pass(A+B+C) = 100%</span>
                                                        <span>10 Cycle check</span><span>10 part cycle time checked by auditor</span>
                                                        <span>Cross Inspection</span><span>5 part cross inspection produced by operator</span>
                                                    </div>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A Four Question Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        {config.secA.questions.map(q => (
                                                            <li key={q.id}>{q.label} :- {q.desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        {config.secA.generalPoints.map(g => (
                                                            <li key={g.id}>{g.label} :- {g.desc}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>

                                            {renderApprovalFooter()}
                                        </div>
                                    )}
                                </div>

                                {/* Footer Actions */}
                                <div className="flex justify-between mt-4 print:hidden gap-2">
                                    <div className="flex gap-2">
                                        {isEditMode && (
                                            <>
                                                <Button onClick={addRow} className="gap-2" variant="outline">
                                                    <Plus size={16} /> Add 10 Cycle Row
                                                </Button>
                                                <Button
                                                    onClick={handleAutoSignAll}
                                                    className="gap-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                                                    variant="outline"
                                                >
                                                    <PenLine size={16} /> Auto Sign All Rows
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            variant="outline"
                                            className="border-green-600 text-green-600 hover:bg-green-50"
                                            onClick={() => {
                                                logAction({
                                                    action: "EXPORT_TEN_CYCLE_SHEET_EXCEL",
                                                    details: { sheetId: selectedSheetId, formType }
                                                }).catch(() => {});
                                                exportToExcel("10-Cycle Check Sheet", { id: selectedSheetId });
                                            }}
                                        >
                                            <Download className="mr-2 h-4 w-4" />
                                            Export
                                        </Button>
                                    </div>
                                    {isEditMode && (
                                        <div className="flex gap-2">
                                            <Button onClick={handleSave} disabled={saving || submitting} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />} Save Sheet
                                            </Button>
                                            <Button
                                                onClick={() => handleSave(true)}
                                                disabled={saving || submitting}
                                                className="gap-2 bg-green-600 hover:bg-green-700"
                                            >
                                                {submitting ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />} Submit & Send Email
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── EDIT LAYOUT TAB ──────────────────────────────────────── */}
                {activeTab === 'editLayout' && canEditConfig && (
                    <div className="space-y-4">
                        <div>
                            {cameFromRevisionTable && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 -ml-2 mb-1 text-slate-500"
                                    onClick={() => navigate('/admin/revision-table/ten-cycle-sheet')}
                                >
                                    <ArrowLeft size={14} /> Back to Revision Table
                                </Button>
                            )}
                            <h1 className="text-xl font-bold">10-Cycle Sheet Layout Editor</h1>
                            <p className="text-sm text-slate-500">
                                Customize Section A questions &amp; general points, Section B measuring instruments, and Section C inspection columns. Changes apply to whichever scope you select below.
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
                                            checked={layoutIsGlobal}
                                            onChange={(e) => {
                                                setLayoutIsGlobal(e.target.checked);
                                                setLayoutDeptId("");
                                                setLayoutSectionId("");
                                                setLayoutLineId("");
                                            }}
                                        />
                                        Global (applies to all departments)
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <Label className="text-xs mb-1 block">Department</Label>
                                        <Select
                                            value={layoutDeptId}
                                            onValueChange={(v) => { setLayoutDeptId(v); setLayoutSectionId(""); setLayoutLineId(""); }}
                                            disabled={layoutIsGlobal}
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
                                            value={layoutSectionId}
                                            onValueChange={(v) => { setLayoutSectionId(v); setLayoutLineId(""); }}
                                            disabled={layoutIsGlobal || !layoutDeptId}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="All sections" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {layoutSections.map((sec) => (
                                                    <SelectItem key={sec._id || sec.id} value={String(sec._id || sec.id)}>
                                                        {sec.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-xs mb-1 block">Line (optional)</Label>
                                        <Select
                                            value={layoutLineId}
                                            onValueChange={setLayoutLineId}
                                            disabled={layoutIsGlobal || !layoutSectionId}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="All lines" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {layoutLines.map((line) => (
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
                                            variant={layoutFormType === t.id ? "default" : "outline"}
                                            onClick={() => setLayoutFormType(t.id)}
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

                        {loadingLayout ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : !layoutDraft ? (
                            <div className="text-center py-12 text-slate-500 border-2 border-dashed rounded-lg">
                                Select a Department (or switch to Global) to load its layout configuration.
                            </div>
                        ) : (
                            <>
                                {(() => {
                                    const note = layoutInheritanceNote();
                                    if (!note) return null;
                                    return (
                                        <div className={`text-xs rounded p-2 border ${note.tone === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                            {note.text}
                                        </div>
                                    );
                                })()}

                                {/* Live preview */}
                                <div className="border rounded overflow-x-auto">
                                    <table className="text-[10px] border-collapse w-full">
                                        <thead>
                                            <tr className="bg-gray-100 text-center font-bold">
                                                <th colSpan={layoutDraft.secA.questions.length + layoutDraft.secA.generalPoints.length} className="border border-black p-1">Section - A</th>
                                                {layoutFormType !== 'form3' && (
                                                    <th colSpan={layoutDraft.secB.instruments.length} className="border border-black p-1">Section - B</th>
                                                )}
                                                <th colSpan={layoutDraft.secC.columns.length} className="border border-black p-1">Section-C</th>
                                            </tr>
                                            <tr className="bg-gray-50 text-center">
                                                {layoutDraft.secA.questions.map(q => (
                                                    <th key={`pq_${q.id}`} className="border border-black w-12 p-1">{q.label || '(empty)'}</th>
                                                ))}
                                                {layoutDraft.secA.generalPoints.map(g => (
                                                    <th key={`pg_${g.id}`} className="border border-black w-12 p-1">{g.label || '(empty)'}</th>
                                                ))}
                                                {layoutFormType !== 'form3' && layoutDraft.secB.instruments.map(i => (
                                                    <th key={`pi_${i.id}`} className="border border-black w-16 p-1">{i.label || '(empty)'}</th>
                                                ))}
                                                {layoutDraft.secC.columns.map(c => (
                                                    <th key={`pc_${c.id}`} className="border border-black w-10 p-1">{c.label || '(empty)'}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                    </table>
                                </div>

                                {/* Editors */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm">Section A — Ask Four Questions</h3>
                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addLayoutItem('questions')}>
                                                <Plus size={12} /> Add
                                            </Button>
                                        </div>
                                        {layoutDraft.secA.questions.map((q, idx) => (
                                            <div key={q.id} className="grid grid-cols-[70px_1fr_28px] gap-2 items-start">
                                                <Input className="h-8 text-xs" value={q.label} onChange={(e) => updateLayoutItem('questions', idx, 'label', e.target.value)} placeholder="Label" />
                                                <Input className="h-8 text-xs" value={q.desc} onChange={(e) => updateLayoutItem('questions', idx, 'desc', e.target.value)} placeholder="Description" />
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeLayoutItem('questions', idx)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm">Section A — General Points</h3>
                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addLayoutItem('generalPoints')}>
                                                <Plus size={12} /> Add
                                            </Button>
                                        </div>
                                        {layoutDraft.secA.generalPoints.map((g, idx) => (
                                            <div key={g.id} className="grid grid-cols-[70px_1fr_28px] gap-2 items-start">
                                                <Input className="h-8 text-xs" value={g.label} onChange={(e) => updateLayoutItem('generalPoints', idx, 'label', e.target.value)} placeholder="Label" />
                                                <Input className="h-8 text-xs" value={g.desc} onChange={(e) => updateLayoutItem('generalPoints', idx, 'desc', e.target.value)} placeholder="Description" />
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeLayoutItem('generalPoints', idx)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm">
                                                Section B — Measuring Instruments
                                                {layoutFormType === 'form3' && <span className="text-[10px] text-slate-400 font-normal ml-2">(not shown on Form 3)</span>}
                                            </h3>
                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addLayoutItem('instruments')}>
                                                <Plus size={12} /> Add
                                            </Button>
                                        </div>
                                        {layoutDraft.secB.instruments.map((i, idx) => (
                                            <div key={i.id} className="grid grid-cols-[1fr_28px] gap-2 items-start">
                                                <Input className="h-8 text-xs" value={i.label} onChange={(e) => updateLayoutItem('instruments', idx, 'label', e.target.value)} placeholder="Label" />
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeLayoutItem('instruments', idx)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm">Section C — Cross Inspection Columns</h3>
                                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addLayoutItem('columns')}>
                                                <Plus size={12} /> Add
                                            </Button>
                                        </div>
                                        {layoutDraft.secC.columns.map((c, idx) => (
                                            <div key={c.id} className="grid grid-cols-[1fr_28px] gap-2 items-start">
                                                <Input className="h-8 text-xs" value={c.label} onChange={(e) => updateLayoutItem('columns', idx, 'label', e.target.value)} placeholder="Label" />
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeLayoutItem('columns', idx)}>
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Remark + Save + History */}
                                <div className="border rounded p-4 space-y-3">
                                    <Label className="text-xs mb-1 block">Remark (required to save)</Label>
                                    <Textarea
                                        className="text-sm"
                                        value={layoutRemark}
                                        onChange={(e) => setLayoutRemark(e.target.value)}
                                        placeholder="e.g. Renamed 'Linear Scale' to 'Caliper' for this line"
                                    />
                                    <div className="flex justify-between items-center">
                                        <Button variant="outline" className="gap-2" onClick={fetchLayoutHistory}>
                                            <History size={14} /> History
                                        </Button>
                                        <Button
                                            onClick={openRevisionDialog}
                                            disabled={loadingRevisionInfo || !layoutRemark.trim()}
                                            className="gap-2 bg-blue-600 hover:bg-blue-700"
                                        >
                                            {loadingRevisionInfo ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />} Save Layout & Update Revision
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── Mandatory Edit Remark Dialog ─────────────────────────── */}
                <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{pendingIsSubmit ? "Submit Sheet" : "Save Changes"} — Remark Required</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label className="text-xs">
                                Please describe what you changed on this already-submitted sheet:
                            </Label>
                            <textarea
                                className="w-full h-24 p-2 text-sm border rounded outline-none resize-none focus:ring-1 focus:ring-blue-500"
                                value={editRemarkText}
                                onChange={(e) => setEditRemarkText(e.target.value)}
                                placeholder="e.g. Corrected cycle time for row 3 as per operator feedback"
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRemarkDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleConfirmRemark} disabled={!editRemarkText.trim() || saving || submitting} className="bg-blue-600 hover:bg-blue-700">
                                {(saving || submitting) ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                                Confirm & {pendingIsSubmit ? "Submit" : "Save"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Layout History Dialog ────────────────────────────────── */}
                <Dialog open={showLayoutHistory} onOpenChange={setShowLayoutHistory}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>10-Cycle Sheet Layout History</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto space-y-3">
                            {layoutHistory.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No layout changes recorded yet for this scope.</div>
                            ) : (
                                layoutHistory.map((entry) => (
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
                                                    setLayoutFullConfig(normalizeConfig(entry.config));
                                                    setLayoutRemark('');
                                                    setShowLayoutHistory(false);
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
                            <Button variant="outline" onClick={() => setShowLayoutHistory(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Save Layout & Update Revision Dialog ─────────────────── */}
                <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save Layout & Update Revision</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <p className="text-xs text-slate-500">
                                This layout change will update the Revision Table record for the 10 Cycle Sheet at{" "}
                                {layoutIsGlobal ? "the Global scope" : "this Department/Section scope"}.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs mb-1 block">Doc. No. *</Label>
                                    <Input
                                        className="h-9 text-sm"
                                        value={revisionForm.docNo}
                                        onChange={(e) => setRevisionForm((f) => ({ ...f, docNo: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Rev. No. *</Label>
                                    <Input
                                        className="h-9 text-sm"
                                        value={revisionForm.revNo}
                                        onChange={(e) => setRevisionForm((f) => ({ ...f, revNo: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Rev. Date</Label>
                                    <Input
                                        className="h-9 text-sm"
                                        value={revisionForm.revDate}
                                        onChange={(e) => setRevisionForm((f) => ({ ...f, revDate: e.target.value }))}
                                        placeholder="DD.MM.YYYY"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs mb-1 block">Affected Sr. No. / Page</Label>
                                    <Input
                                        className="h-9 text-sm"
                                        value={revisionForm.affectedSrNoPage}
                                        onChange={(e) => setRevisionForm((f) => ({ ...f, affectedSrNoPage: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">Change Details</Label>
                                <Textarea
                                    className="text-sm"
                                    value={revisionForm.changeDetails}
                                    onChange={(e) => setRevisionForm((f) => ({ ...f, changeDetails: e.target.value }))}
                                    placeholder="Describe what changed in this revision"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRevisionDialogOpen(false)}>Cancel</Button>
                            <Button
                                onClick={handleConfirmSaveLayoutWithRevision}
                                disabled={savingLayoutRevision || !revisionForm.docNo.trim() || !revisionForm.revNo.trim()}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {savingLayoutRevision ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                                Confirm & Save
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Create Sheet Dialog ──────────────────────────────────── */}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create 10 Cycle Sheet</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <div>
                                <Label className="text-xs mb-1 block">Department</Label>
                                <Select value={createDepartmentId} onValueChange={(v) => {
                                    setCreateDepartmentId(v);
                                    setCreateSectionId("");
                                    setCreateLineId("");
                                    setCreateSubSectionId("");
                                }} disabled={isRestricted && assignableDepartments.length <= 1}>
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
                                <Label className="text-xs mb-1 block">Section</Label>
                                <Select value={createSectionId} onValueChange={(v) => {
                                    setCreateSectionId(v);
                                    setCreateLineId("");
                                    setCreateSubSectionId("");
                                    const selectedSec = assignableCreateSections.find(s => String(s.id || s._id) === v);
                                    if (selectedSec && selectedSec.tenCycleFormType) {
                                        const available = selectedSec.tenCycleFormType.split(",");
                                        if (available.length > 0) setCreateFormType(available[0]);
                                    }
                                }} disabled={!createDepartmentId || (isRestricted && assignableCreateSections.length <= 1)}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {assignableCreateSections.map((sec) => (
                                            <SelectItem key={sec._id || sec.id} value={String(sec._id || sec.id)}>
                                                {sec.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">Line</Label>
                                <Select value={createLineId} onValueChange={(v) => {
                                    setCreateLineId(v);
                                    setCreateSubSectionId("");
                                    const selectedLine = lines.find(l => String(l.id || l._id) === v);
                                    if (selectedLine && selectedLine.tenCycleFormType) {
                                        const available = selectedLine.tenCycleFormType.split(",");
                                        if (available.length > 0) {
                                            setCreateFormType(available[0]);
                                        }
                                    }
                                }} disabled={!createSectionId}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select line" />
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
                            <div>
                                <Label className="text-xs mb-1 block">Sub-Section (Optional)</Label>
                                <Select value={createSubSectionId} onValueChange={setCreateSubSectionId} disabled={!createLineId}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select sub-section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subSections.map((ss) => (
                                            <SelectItem key={ss._id || ss.id} value={String(ss._id || ss.id)}>
                                                {ss.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs mb-1 block">Form Type</Label>
                                <Select value={createFormType} onValueChange={setCreateFormType}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Select form type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getAvailableFormTypes().map(type => (
                                            <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Date of Creation</label>
                                <Input value={new Date().toISOString().split("T")[0]} disabled />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateSheet}>Create</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </CardContent>
        </Card>
    );
};

export default Cycle10;
