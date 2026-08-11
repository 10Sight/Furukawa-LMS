import React, { useState, useEffect, useMemo } from 'react';
import useRevisionInfo from '@/hooks/useRevisionInfo';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, Save, Download, CheckCircle, XCircle, Pencil, PenLine } from "lucide-react";
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

const ALL_FORM_TYPES = [
    { id: 'form1', label: 'Form 1 (Standard)' },
    { id: 'form2', label: 'Form 2 (Complete)' },
    { id: 'form3', label: 'Form 3 (10 Cycle Numerical)' }
];

const TEN_CYCLE_KEY_FIELDS = ['lineMachine', 'modelName', 'partName', 'operationName', 'sopNo', 'inspectorName'];
const isRowComplete = (row) => TEN_CYCLE_KEY_FIELDS.every(field => String(row?.[field] || "").trim());

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

    const assignableDepartments = useMemo(() => {
        const rawAssigned = Array.isArray(user?.departments) ? [...user.departments] : [];
        if (user?.departmentId) rawAssigned.push(user.departmentId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
        if (!user || isAdmin || assignedIds.length === 0) return departments;
        return departments.filter(d => assignedIds.includes(String(d._id || d.id)));
    }, [departments, user, isAdmin]);

    const assignableSections = useMemo(() => {
        const rawAssigned = Array.isArray(user?.sections) ? [...user.sections] : [];
        if (user?.sectionId) rawAssigned.push(user.sectionId);
        const assignedIds = rawAssigned.map(id => String(id)).filter(Boolean);
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
    const createNewRow = (id = Date.now()) => ({
        id,
        date: new Date().toISOString().split('T')[0],
        lineMachine: '',
        modelName: '',
        partName: '',
        operationName: '',
        sopNo: '',

        // Section A: Ask Four Questions (Marking: ✓ or X)
        secA_q1: '', secA_q2: '', secA_q3: '', secA_q4: '',
        // Section A: General Points Check Marking (Marking: ✓ or X)
        secA_gp1: '', secA_gp2: '', secA_gp3: '', secA_gp4: '', secA_gp5: '', secA_gp6: '',

        // Section B: Measuring Instrument Using Method (Marking: ✓ or X)
        secB_linearScale: '', secB_micrometer: '', secB_bladeMicrometer: '',
        secB_strippingGauge: '', secB_others: '',

        // Section C: Cross Inspection Marking (Marking: ✓ or X)
        secC_1: '', secC_2: '', secC_3: '', secC_4: '', secC_5: '',

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
    });

    const [rows, setRows] = useState([]);

    // Form Type State
    const [formType, setFormType] = useState('form1');

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

                setHeaderData({
                    qualityEngineer: data.qualityEngineer || "",
                    qualityEngineerSign: data.qualityEngineerSign || "",
                    dojoEngineer: data.dojoEngineer || "",
                    dojoEngineerSign: data.dojoEngineerSign || ""
                });
                setFormType(data.formType || "form1");
                setRows(data.entries && data.entries.length > 0 ? data.entries : [createNewRow()]);
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
                    'secA_q1', 'secA_q2', 'secA_q3', 'secA_q4',
                    'secA_gp1', 'secA_gp2', 'secA_gp3', 'secA_gp4', 'secA_gp5', 'secA_gp6',
                    ...(formType !== 'form3' ? [
                        'secB_linearScale', 'secB_micrometer', 'secB_bladeMicrometer', 'secB_strippingGauge', 'secB_others'
                    ] : []),
                    'secC_1', 'secC_2', 'secC_3', 'secC_4', 'secC_5'
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
                                                        <th colSpan="10" className="border border-black p-1 bg-white">Section - A</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Section - B</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Section-C</th>
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
                                                        <th colSpan="4" className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                        <th colSpan="6" className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Measuring Instrument Using Method</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        <th className="border border-black w-[40px] bg-white">Q1</th>
                                                        <th className="border border-black w-[40px] bg-white">Q2</th>
                                                        <th className="border border-black w-[40px] bg-white">Q3</th>
                                                        <th className="border border-black w-[40px] bg-white">Q4</th>
                                                        <th className="border border-black w-[40px] bg-white">Q1</th>
                                                        <th className="border border-black w-[40px] bg-white">Q2</th>
                                                        <th className="border border-black w-[40px] bg-white">Q3</th>
                                                        <th className="border border-black w-[40px] bg-white">Q4</th>
                                                        <th className="border border-black w-[40px] bg-white">Q5</th>
                                                        <th className="border border-black w-[40px] bg-white">Q6</th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full whitespace-nowrap px-1">Linear Scale</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full whitespace-nowrap px-1">Point Micrometer</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full whitespace-nowrap px-1">Blade Micrometer</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full whitespace-nowrap px-1">Stripping Gauge</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full whitespace-nowrap px-1">Others</div></th>
                                                        <th className="border border-black w-[40px] bg-white">1</th>
                                                        <th className="border border-black w-[40px] bg-white">2</th>
                                                        <th className="border border-black w-[40px] bg-white">3</th>
                                                        <th className="border border-black w-[40px] bg-white">4</th>
                                                        <th className="border border-black w-[40px] bg-white">5</th>
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
                                                            {['secA_q1', 'secA_q2', 'secA_q3', 'secA_q4', 'secA_gp1', 'secA_gp2', 'secA_gp3', 'secA_gp4', 'secA_gp5', 'secA_gp6'].map(field => (
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
                                                            {['secB_linearScale', 'secB_micrometer', 'secB_bladeMicrometer', 'secB_strippingGauge', 'secB_others'].map(field => (
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
                                                            {['secC_1', 'secC_2', 'secC_3', 'secC_4', 'secC_5'].map(field => (
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
                                                        <li>Q1 :- Is Operator aware of SOP Availability?</li>
                                                        <li>Q2 :- Does Operator understand SOP?</li>
                                                        <li>Q3 :- Is Operator adhering SOP?</li>
                                                        <li>Q4 :- Does Operator know operation cycle time?</li>
                                                    </ul>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        <li>Q1 :- Is process started after 5&apos;S?</li>
                                                        <li>Q2 :- Is station check sheet filled?</li>
                                                        <li>Q3 :- Is defective part identified?</li>
                                                        <li>Q4 :- Is NC part handling system followed?</li>
                                                        <li>Q5 :- Is Operator aware about 5 safety principle?</li>
                                                        <li>Q6 :- Is operator aware about abnormal condition?</li>
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
                                                        <th colSpan="10" className="border border-black p-1 bg-white">Section - A</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Section - B</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Section-C</th>
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
                                                        <th colSpan="4" className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                        <th colSpan="6" className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Measuring Instrument Using Method</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        <th className="border border-black w-[40px] bg-white">Q1</th>
                                                        <th className="border border-black w-[40px] bg-white">Q2</th>
                                                        <th className="border border-black w-[40px] bg-white">Q3</th>
                                                        <th className="border border-black w-[40px] bg-white">Q4</th>
                                                        <th className="border border-black w-[40px] bg-white">Q1</th>
                                                        <th className="border border-black w-[40px] bg-white">Q2</th>
                                                        <th className="border border-black w-[40px] bg-white">Q3</th>
                                                        <th className="border border-black w-[40px] bg-white">Q4</th>
                                                        <th className="border border-black w-[40px] bg-white">Q5</th>
                                                        <th className="border border-black w-[40px] bg-white">Q6</th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full [writing-mode:vertical-rl] rotate-180 whitespace-nowrap px-1">Linear Scale</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full [writing-mode:vertical-rl] rotate-180 whitespace-nowrap px-1">Point Micrometer</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full [writing-mode:vertical-rl] rotate-180 whitespace-nowrap px-1">Blade Micrometer</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full [writing-mode:vertical-rl] rotate-180 whitespace-nowrap px-1">Stripping Gauge</div></th>
                                                        <th className="border border-black w-[45px] bg-white"><div className="flex items-center justify-center h-32 w-full [writing-mode:vertical-rl] rotate-180 whitespace-nowrap px-1">Others</div></th>
                                                        <th className="border border-black w-[40px] bg-white">1</th>
                                                        <th className="border border-black w-[40px] bg-white">2</th>
                                                        <th className="border border-black w-[40px] bg-white">3</th>
                                                        <th className="border border-black w-[40px] bg-white">4</th>
                                                        <th className="border border-black w-[40px] bg-white">5</th>
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
                                                            {['secA_q1', 'secA_q2', 'secA_q3', 'secA_q4', 'secA_gp1', 'secA_gp2', 'secA_gp3', 'secA_gp4', 'secA_gp5', 'secA_gp6'].map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {['secB_linearScale', 'secB_micrometer', 'secB_bladeMicrometer', 'secB_strippingGauge', 'secB_others'].map(f => (
                                                                <td key={f} className="border border-black p-0 h-full">
                                                                    <select className="w-full h-full text-center bg-transparent outline-none cursor-pointer appearance-none text-[10px] py-1 disabled:cursor-default" value={row[f] || ''} onChange={(e) => handleRowChange(row.id, f, e.target.value)} disabled={!isEditMode}>
                                                                        <option value="">-</option>
                                                                        <option value="✓" className="text-green-600 font-bold">✓</option>
                                                                        <option value="X" className="text-red-600 font-bold">X</option>
                                                                    </select>
                                                                </td>
                                                            ))}
                                                            {['secC_1', 'secC_2', 'secC_3', 'secC_4', 'secC_5'].map(f => (
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
                                                        <li>Q1 :- Is Operator aware of SOP Availability?</li>
                                                        <li>Q2 :- Does Operator understand SOP?</li>
                                                        <li>Q3 :- Is Operator adhering SOP?</li>
                                                        <li>Q4 :- Does Operator know operation cycle time?</li>
                                                    </ul>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        <li>Q1 :- Is process started after 5&apos;S?</li>
                                                        <li>Q2 :- Is station check sheet filled?</li>
                                                        <li>Q3 :- Is defective part identified?</li>
                                                        <li>Q4 :- Is NC part handling system followed?</li>
                                                        <li>Q5 :- Is Operator aware about 5 safety principle?</li>
                                                        <li>Q6 :- Is operator aware about abnormal condition?</li>
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
                                                        <th colSpan="10" className="border border-black p-1 bg-white">Section - A</th>
                                                        <th colSpan="13" className="border border-black p-1 bg-white">Section - B</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Section-C</th>
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
                                                        <th colSpan="4" className="border border-black p-1 bg-white">Ask Four Quest. Marking</th>
                                                        <th colSpan="6" className="border border-black p-1 bg-white">General Points Check Marking</th>
                                                        <th colSpan="10" className="border border-black p-1 bg-white text-red-600">10 Cycle Check</th>
                                                        <th rowSpan="2" className="border border-black p-1 bg-white">Cycle Time Spec.</th>
                                                        <th colSpan="2" className="border border-black p-1 bg-yellow-50 text-blue-600">Cycle Time Obs.</th>
                                                        <th colSpan="5" className="border border-black p-1 bg-white">Cross Inspection Marking</th>
                                                    </tr>
                                                    <tr className="bg-gray-100 text-center font-bold text-[9px]">
                                                        <th className="border border-black w-[35px] bg-white">Q1</th>
                                                        <th className="border border-black w-[35px] bg-white">Q2</th>
                                                        <th className="border border-black w-[35px] bg-white">Q3</th>
                                                        <th className="border border-black w-[35px] bg-white">Q4</th>
                                                        <th className="border border-black w-[35px] bg-white">Q1</th>
                                                        <th className="border border-black w-[35px] bg-white">Q2</th>
                                                        <th className="border border-black w-[35px] bg-white">Q3</th>
                                                        <th className="border border-black w-[35px] bg-white">Q4</th>
                                                        <th className="border border-black w-[35px] bg-white">Q5</th>
                                                        <th className="border border-black w-[35px] bg-white">Q6</th>
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                            <th key={n} className="border border-black w-[40px] bg-white">{n}</th>
                                                        ))}
                                                        <th className="border border-black w-[45px] bg-yellow-50 text-blue-600">Min.</th>
                                                        <th className="border border-black w-[45px] bg-yellow-50 text-blue-600">Max.</th>
                                                        <th className="border border-black w-[35px] bg-white">1</th>
                                                        <th className="border border-black w-[35px] bg-white">2</th>
                                                        <th className="border border-black w-[35px] bg-white">3</th>
                                                        <th className="border border-black w-[40px] bg-white">4</th>
                                                        <th className="border border-black w-[40px] bg-white">5</th>
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
                                                            {['secA_q1', 'secA_q2', 'secA_q3', 'secA_q4', 'secA_gp1', 'secA_gp2', 'secA_gp3', 'secA_gp4', 'secA_gp5', 'secA_gp6'].map(f => (
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
                                                            {['secC_1', 'secC_2', 'secC_3', 'secC_4', 'secC_5'].map(f => (
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
                                                        <li>Q1 :- Is Operator aware of SOP Availability?</li>
                                                        <li>Q2 :- Does Operator understand SOP?</li>
                                                        <li>Q3 :- Is Operator adhering SOP?</li>
                                                        <li>Q4 :- Does Operator know operation cycle time?</li>
                                                    </ul>
                                                </div>
                                                <div className="border border-gray-300 p-2 rounded col-span-1">
                                                    <h3 className="font-bold border-b border-black mb-1">Section - A General Point Details:-</h3>
                                                    <ul className="list-none space-y-0.5">
                                                        <li>Q1 :- Is process started after 5&apos;S?</li>
                                                        <li>Q2 :- Is station check sheet filled?</li>
                                                        <li>Q3 :- Is defective part identified?</li>
                                                        <li>Q4 :- Is NC part handling system followed?</li>
                                                        <li>Q5 :- Is Operator aware about 5 safety principle?</li>
                                                        <li>Q6 :- Is operator aware about abnormal condition?</li>
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
