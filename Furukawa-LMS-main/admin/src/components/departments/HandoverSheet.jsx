import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconDeviceFloppy, IconPrinter, IconDownload, IconPhoto, IconMail } from "@tabler/icons-react";
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import axiosInstance from "@/Helper/axiosInstance";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportHelper";
import { Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconSettings, IconHistory, IconPlus, IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import UserAutocomplete from '../common/UserAutocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetAllMentorsQuery } from "@/Redux/AllApi/InstructorApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { departmentApi } from "@/Redux/AllApi/DepartmentApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";

const INTERVIEW_OPTIONS = [
    { value: "Pass", label: "Pass" },
    { value: "Fail", label: "Fail" },
    { value: "NA", label: "Not Required" },
];

const AutoResizeInput = ({ value = "", onChange, className = "", minWidth = 40, ...rest }) => {
    const mirrorRef = useRef(null);
    const inputRef = useRef(null);

    useLayoutEffect(() => {
        if (mirrorRef.current && inputRef.current) {
            const w = Math.max(mirrorRef.current.scrollWidth + 8, minWidth);
            inputRef.current.style.width = w + 'px';
        }
    }, [value, minWidth]);

    return (
        <span style={{ position: 'relative', display: 'inline-flex' }}>
            <span
                ref={mirrorRef}
                style={{
                    visibility: 'hidden',
                    position: 'absolute',
                    whiteSpace: 'pre',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    padding: '0 2px',
                    pointerEvents: 'none',
                }}
                aria-hidden
            >{value || ' '}</span>
            <input
                ref={inputRef}
                value={value}
                onChange={onChange}
                className={className}
                style={{ minWidth }}
                {...rest}
            />
        </span>
    );
};

const InterviewSelect = ({ value, onChange }) => (
    <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="h-7 w-full border-none shadow-none focus:ring-1 focus:ring-blue-400 text-xs bg-transparent">
            <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
            {INTERVIEW_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
        </SelectContent>
    </Select>
);

const ProcessSelect = ({ departmentId, sectionId, value, onValueChange, className = "" }) => {
    const { data } = useGetSubSectionsQuery({ departmentId, sectionId }, { skip: !departmentId });
    const subSections = Array.isArray(data?.data) ? data.data : (data?.data?.subSections || []);

    // Find if the current value matches either the name or the displayName (e.g. for backward compatibility)
    const matchedSS = subSections.find(ss => {
        const displayName = ss.lineName ? `${ss.name} (${ss.lineName})` : ss.name || "";
        return displayName === value || ss.name === value;
    });

    // If a match is found, use its displayName as the Select value so it matches one of the rendered SelectItems uniquely
    const selectValue = matchedSS ? (matchedSS.lineName ? `${matchedSS.name} (${matchedSS.lineName})` : matchedSS.name) : value;

    return (
        <Select value={selectValue || ""} onValueChange={onValueChange}>
            <SelectTrigger className={`h-7 w-auto min-w-[100px] border-none shadow-none focus:ring-1 focus:ring-blue-400 text-xs bg-transparent [&>span]:line-clamp-none [&>span]:whitespace-nowrap ${className}`}>
                <SelectValue placeholder="Process" />
            </SelectTrigger>
            <SelectContent>
                {subSections.length > 0 ? (
                    subSections.map((ss, i) => {
                        const displayName = ss.lineName ? `${ss.name} (${ss.lineName})` : ss.name || "";
                        return (
                            <SelectItem key={ss.id || ss._id || i} value={displayName}>
                                {displayName}
                            </SelectItem>
                        );
                    })
                ) : (
                    <SelectItem value="none" disabled>No Processes Found</SelectItem>
                )}
                {/* Fallback option if selectValue is not empty and doesn't match any subSection */}
                {selectValue && !subSections.some(ss => (ss.lineName ? `${ss.name} (${ss.lineName})` : ss.name || "") === selectValue) && (
                    <SelectItem value={selectValue}>{selectValue}</SelectItem>
                )}
            </SelectContent>
        </Select>
    );
};

// Mentors are scoped to the department of the sheet and show their current
// mentee load so reviewers can see (and avoid picking) mentors who are already at capacity.
// The value stored on the entry stays the mentor's fullName (matches how existing entries
// are persisted), so a fallback option is added for saved names that fall outside the
// current department scope or belong to a user no longer flagged as a mentor.
const MentorSelect = ({ departmentId, sectionId, value, onValueChange, className = "" }) => {
    const { data } = useGetAllMentorsQuery({ departmentId, limit: 1000 }, { skip: !departmentId });
    const mentors = data?.data?.users || [];
    const matchedMentor = mentors.find(m => m.fullName === value);

    return (
        <Select value={value || ""} onValueChange={onValueChange}>
            <SelectTrigger className={`h-7 w-full border-none shadow-none focus:ring-1 focus:ring-blue-400 text-xs bg-transparent [&>span]:line-clamp-none [&>span]:whitespace-nowrap ${className}`}>
                <SelectValue placeholder="Search Mentor..." />
            </SelectTrigger>
            <SelectContent>
                {mentors.length > 0 ? (
                    mentors.map(m => {
                        const atLimit = m.mentorLimit > 0 && m.assignedCount >= m.mentorLimit && m.fullName !== value;
                        return (
                            <SelectItem key={m._id} value={m.fullName} disabled={atLimit}>
                                {m.fullName} (Assigned: {m.assignedCount}/{m.mentorLimit || "∞"}{atLimit ? " — Full" : ""})
                            </SelectItem>
                        );
                    })
                ) : (
                    <SelectItem value="none" disabled>No Mentors Found</SelectItem>
                )}
                {value && !matchedMentor && (
                    <SelectItem value={value}>{value}</SelectItem>
                )}
            </SelectContent>
        </Select>
    );
};

const HandoverSheet = ({ departmentId, sectionId = null, setSectionId, sheetId = null, shift: propShift = null, viewOnly = false, students = [], departmentName, sectionName = "", instructorName, departments = [], machines = [], dojoHandoverPassedOnly = false, date: propDate, setDate: propSetDate }) => {
    const authUser = useSelector(state => state.auth.user);
    const dispatch = useDispatch();
    const isAdmin = authUser?.isAdmin || authUser?.role === 'ADMIN' || authUser?.role === 'SUPERADMIN';
    const hasHandoverBypass = authUser?.customRole?.permissions?.includes('dojo:handover_sheet');
    const canAccessAll = isAdmin || hasHandoverBypass;

    const canManage = (isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:manage')) && !viewOnly;
    const canApprove = (isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:approve')) && !viewOnly;
    const canEditLayout = (isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:edit_layout')) && !viewOnly;
    const canEditSaved = isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:edit_saved');
    const canEditSection = (isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:edit_section')) && !viewOnly;
    const canDeleteRow = (isAdmin || authUser?.customRole?.permissions?.includes('handover_sheet:delete_row')) && !viewOnly;

    const [localSectionId, setLocalSectionId] = useState(sectionId);
    useEffect(() => {
        setLocalSectionId(sectionId);
    }, [sectionId]);
    const { data: departmentSectionsData } = useGetSectionsByDepartmentQuery(departmentId, { skip: !departmentId || !canEditSection });
    const departmentSections = departmentSectionsData?.data || [];
    // Radix's SelectValue only resolves a label once its matching SelectItem has mounted (i.e. the
    // dropdown has been opened), so we compute the label ourselves to avoid a blank trigger on first
    // load or after the section-change refetch remounts this Select.
    const selectedSectionLabel = departmentSections.find(s => String(s.id) === String(localSectionId))?.name
        || (String(localSectionId || "") === String(sectionId || "") ? sectionName : "");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [localDate, setLocalDate] = useState(new Date().toISOString().split('T')[0]);
    const date = propDate !== undefined ? propDate : localDate;
    const setDate = propSetDate !== undefined ? propSetDate : setLocalDate;
    const [entries, setEntries] = useState([]); // Array of objects matching table rows
    const [signatures, setSignatures] = useState({
        educationCell: "",
        hod: ""
    });

    const [metadata, setMetadata] = useState({
        docNo: "FRM-HR-003",
        revNo: "05",
        revDate: "30.01.2024",
        issueDate: "01.06.09"
    });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submittedAt, setSubmittedAt] = useState(null);
    const [isNewSheet, setIsNewSheet] = useState(false);
    const [eligibleUsers, setEligibleUsers] = useState([]);

    const [originalEntries, setOriginalEntries] = useState([]);
    const [originalMetadata, setOriginalMetadata] = useState({
        docNo: "FRM-HR-003",
        revNo: "05",
        revDate: "30.01.2024",
        issueDate: "01.06.09"
    });
    const [isRemarkDialogOpen, setIsRemarkDialogOpen] = useState(false);
    const [editRemark, setEditRemark] = useState("");
    const [pendingSubmitValue, setPendingSubmitValue] = useState(false);

    const isEditable = !viewOnly && (isNewSheet || canEditSaved);

    // Layout Config State
    const [tableConfig, setTableConfig] = useState(null);
    const [isEditingLayout, setIsEditingLayout] = useState(false);
    const [jsonConfigStr, setJsonConfigStr] = useState("");
    const [layoutRemark, setLayoutRemark] = useState("");
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [configHistory, setConfigHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);

    // Export State
    const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
    const [emailForPDF, setEmailForPDF] = useState("");
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const tableRef = useRef(null);

    const [logAction] = useLogActionMutation();

    const fetchConfig = async () => {
        if (!departmentId) return;
        try {
            setLoadingConfig(true);
            const response = await axiosInstance.get(`/api/departments/handover-sheet/config/${departmentId}?sectionId=${sectionId || ""}`);
            if (response.data.success && response.data.data.config) {
                setTableConfig(response.data.data.config);
                setJsonConfigStr(JSON.stringify(response.data.data.config, null, 2));
            } else {
                setTableConfig(null);
                setJsonConfigStr("");
            }
        } catch (error) {
            console.error("Error fetching handover sheet config:", error);
        } finally {
            setLoadingConfig(false);
        }
    };

    const handleSaveConfig = async () => {
        if (!layoutRemark.trim()) {
            toast.error("Please enter a remark detailing your layout changes.");
            return;
        }

        try {
            let parsedConfig;
            try {
                parsedConfig = JSON.parse(jsonConfigStr);
            } catch (e) {
                toast.error("Invalid JSON format");
                return;
            }

            await axiosInstance.post(`/api/departments/handover-sheet/config/save`, {
                departmentId,
                sectionId: sectionId || null,
                config: parsedConfig,
                remark: layoutRemark
            });

            setTableConfig(parsedConfig);
            setIsEditingLayout(false);
            setLayoutRemark("");
            toast.success("Configuration saved successfully");
            logAction({ action: "SAVE_HANDOVER_SHEET_CONFIG", details: { departmentId, sectionId, remark: layoutRemark } }).catch(() => { });
        } catch (error) {
            console.error("Error saving handover sheet config:", error);
            toast.error("Failed to save configuration");
        }
    };

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true);
            const response = await axiosInstance.get(`/api/departments/handover-sheet/history/${departmentId}?sectionId=${sectionId || ""}`);
            if (response.data.success) {
                setConfigHistory(response.data.data);
                setIsHistoryOpen(true);
                logAction({ action: "VIEW_HANDOVER_SHEET_LAYOUT_HISTORY", details: { departmentId, sectionId } }).catch(() => { });
            }
        } catch (error) {
            console.error("Error fetching handover sheet history:", error);
            toast.error("Failed to load history");
        } finally {
            setLoadingHistory(false);
        }
    };

    // Fetch handover sheet data whenever department, section, or date changes
    useEffect(() => {
        if (!departmentId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch layout config
                await fetchConfig();

                const sheetIdParam = sheetId ? `&sheetId=${sheetId}` : "";
                const shiftParam = propShift ? `&shift=${encodeURIComponent(propShift)}` : "";
                const response = await axiosInstance.get(`/api/departments/${departmentId}/handover-sheet?sectionId=${sectionId || ""}&date=${date}${sheetIdParam}${shiftParam}`);
                const data = response.data?.data;

                if (data && !data.isNew) {
                    setIsNewSheet(false);
                    setEligibleUsers(data.eligibleUsers || []);
                    const fetchedEntries = data.entries || [];
                    if (fetchedEntries.length === 0) {
                        fetchedEntries.push({
                            sn: 1,
                            studentId: "",
                            employeeName: "",
                            empCode: "",
                            marks: "0%",
                            department: sectionName || departmentName || "",
                            process: "",
                            mentor: "",
                            interview1: "",
                            interview2: "",
                            interviewStatus: "",
                            statusActionBy: ""
                        });
                    }
                    setEntries(fetchedEntries);
                    setOriginalEntries(JSON.parse(JSON.stringify(fetchedEntries)));
                    setSignatures(data.signatures || { educationCell: "", hod: "" });
                    if (data.metadata) {
                        setMetadata(data.metadata);
                        setOriginalMetadata(JSON.parse(JSON.stringify(data.metadata)));
                    }
                    setIsSubmitted(!!data.isSubmitted);
                    setSubmittedAt(data.submittedAt);
                } else {
                    setIsNewSheet(true);
                    setEligibleUsers(data?.eligibleUsers || []);
                    // Reset to a clean slate for the new date
                    setIsSubmitted(false);
                    setSubmittedAt(null);
                    setSignatures({ educationCell: "", hod: "" });

                    // Start with a single empty row; user searches and selects from eligibleUsers
                    setEntries([{
                        sn: 1,
                        studentId: "",
                        employeeName: "",
                        empCode: "",
                        marks: "0%",
                        department: sectionName || departmentName || "",
                        process: "",
                        mentor: "",
                        interview1: "",
                        interview2: "",
                        interviewStatus: "",
                        statusActionBy: ""
                    }]);
                    setOriginalEntries([]);
                    if (data?.metadata) {
                        setMetadata(data.metadata);
                        setOriginalMetadata(JSON.parse(JSON.stringify(data.metadata)));
                    } else {
                        setOriginalMetadata({
                            docNo: "FRM-HR-003",
                            revNo: "05",
                            revDate: "30.01.2024",
                            issueDate: "01.06.09"
                        });
                    }
                }
            } catch (error) {
                console.error("Error fetching handover sheet:", error);
                toast.error("Failed to fetch handover sheet data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        logAction({
            action: "VIEW_HANDOVER_SHEET",
            details: { departmentId, sectionId, date, sheetId, viewOnly },
        }).catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [departmentId, sectionId, date, departmentName, sectionName, sheetId, propShift]);

    const handleEntryChange = (index, field, value) => {
        const newEntries = [...entries];
        const updated = { ...newEntries[index], [field]: value };
        if (field === 'departmentId') updated.process = "";
        newEntries[index] = updated;
        setEntries(newEntries);
    };

    const handleUserSelect = (index, user) => {
        const newEntries = [...entries];
        const userProcessName = user.machineName || user.stationName || "";
        const processWithLine = (userProcessName && user.lineName) ? `${userProcessName} (${user.lineName})` : userProcessName;
        newEntries[index] = {
            ...newEntries[index],
            studentId: user.id || user.studentId,
            employeeName: user.fullName || user.employeeName || "",
            empCode: user.userName || user.empId || user.employeeCode || "",
            marks: user.marks || "0%",
            department: user.deptName || sectionName || departmentName || "",
            departmentId: user.actualDeptId || user.departmentId || user.targetDeptId || null,
            sectionId: user.sectionId || user.targetSectionId || null,
            lineId: user.lineId || user.targetLineId || null,
            subSectionId: user.subSectionId || user.targetSubSectionId || null,
            stationId: user.stationId || user.targetStationId || null,
            process: processWithLine,
            interview1: user.interview1 ?? newEntries[index].interview1 ?? "",
            interview2: user.interview2 ?? newEntries[index].interview2 ?? "",
        };
        setEntries(newEntries);
    };

    const addRow = () => {
        setEntries([...entries, {
            sn: entries.length + 1,
            studentId: "",
            employeeName: "",
            empCode: "",
            marks: "0%",
            department: departmentName || "",
            departmentId: departmentId || null,
            process: "",
            mentor: "",
            interview1: "",
            interview2: "",
            interviewStatus: "",
            statusActionBy: ""
        }]);
    };

    const removeRow = (index) => {
        const entry = entries[index];
        if (entry?.employeeName && !window.confirm(`Are you sure you want to remove ${entry.employeeName} from this sheet?`)) {
            return;
        }
        let newEntries = entries.filter((_, i) => i !== index);
        if (newEntries.length === 0) {
            newEntries = [{
                sn: 1,
                studentId: "",
                employeeName: "",
                empCode: "",
                marks: "0%",
                department: sectionName || departmentName || "",
                process: "",
                mentor: "",
                interview1: "",
                interview2: "",
                interviewStatus: "",
                statusActionBy: ""
            }];
        } else {
            newEntries = newEntries.map((e, i) => ({ ...e, sn: i + 1 }));
        }
        setEntries(newEntries);
    };

    const handleSignatureChange = (field, value) => {
        setSignatures(prev => ({ ...prev, [field]: value }));
    };

    const handleMetadataChange = (field, value) => {
        setMetadata(prev => ({ ...prev, [field]: value }));
    };

    const handleStatusAction = (index, status) => {
        const newEntries = [...entries];
        const userName = authUser?.fullName || authUser?.name || "Unknown User";
        newEntries[index] = {
            ...newEntries[index],
            interviewStatus: status,
            statusActionBy: userName,
            statusActionAt: status ? new Date().toISOString() : null
        };
        setEntries(newEntries);

        // Auto-fill HOD signature when someone approves/rejects a row
        if (status && !signatures.hod) {
            setSignatures(prev => ({ ...prev, hod: userName }));
        }
    };

    const hasContentChanged = (excludeMentor = false) => {
        if (isNewSheet) return false;
        if (entries.length !== originalEntries.length) return true;
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const orig = originalEntries[i];
            if (!orig) return true;
            if (
                entry.studentId !== orig.studentId ||
                entry.employeeName !== orig.employeeName ||
                entry.empCode !== orig.empCode ||
                entry.marks !== orig.marks ||
                entry.department !== orig.department ||
                entry.process !== orig.process ||
                (!excludeMentor && entry.mentor !== orig.mentor) ||
                entry.interview1 !== orig.interview1 ||
                entry.interview2 !== orig.interview2 ||
                entry.departmentId !== orig.departmentId ||
                entry.sectionId !== orig.sectionId ||
                entry.lineId !== orig.lineId ||
                entry.subSectionId !== orig.subSectionId ||
                entry.stationId !== orig.stationId
            ) {
                return true;
            }
        }
        if (
            metadata.docNo !== originalMetadata?.docNo ||
            metadata.revNo !== originalMetadata?.revNo ||
            metadata.revDate !== originalMetadata?.revDate ||
            metadata.issueDate !== originalMetadata?.issueDate
        ) {
            return true;
        }
        return false;
    };

    const handleSaveClick = (isSubmit = false) => {
        if (!isNewSheet && hasContentChanged()) {
            if (!canEditSaved) {
                toast.error("You do not have permission to edit a saved handover sheet.");
                return;
            }
            if (hasContentChanged(true)) {
                setPendingSubmitValue(isSubmit);
                setIsRemarkDialogOpen(true);
            } else {
                executeSave(isSubmit);
            }
        } else {
            executeSave(isSubmit);
        }
    };

    const handleConfirmSaveWithRemark = () => {
        if (!editRemark.trim()) {
            toast.error("Please enter a remark.");
            return;
        }
        setIsRemarkDialogOpen(false);
        executeSave(pendingSubmitValue, editRemark);
        setEditRemark("");
    };

    const executeSave = async (isSubmit = false, remark = "") => {
        setSaving(true);
        const userName = authUser?.fullName || authUser?.name || "System";

        // Auto-fill Education Cell signature if not set
        const updatedSignatures = { ...signatures };
        if (!updatedSignatures.educationCell) {
            updatedSignatures.educationCell = userName;
            setSignatures(updatedSignatures);
        }

        try {
            const response = await axiosInstance.post(`/api/departments/${departmentId}/handover-sheet`, {
                sheetId: sheetId || null,
                departmentId,
                sectionId: localSectionId || null,
                shift: propShift || null,
                date,
                entries,
                signatures: updatedSignatures,
                metadata,
                isSubmitted: isSubmit,
                remark: remark
            });

            if (isSubmit) {
                setIsSubmitted(true);
                setSubmittedAt(new Date().toISOString());
            }

            // The dashboard/monitoring sheet list is cached under the 'Department' tag but this save
            // goes through a raw axios call (not an RTK Query mutation), so invalidate it manually —
            // otherwise the list (and thus the section shown when re-opening this sheet) stays stale.
            dispatch(departmentApi.util.invalidateTags(['Department']));

            if (setSectionId && String(localSectionId || "") !== String(sectionId || "")) {
                setSectionId(localSectionId || null);
            }

            setOriginalEntries(JSON.parse(JSON.stringify(entries)));
            setOriginalMetadata(JSON.parse(JSON.stringify(metadata)));
            setIsNewSheet(false);

            toast.success(isSubmit ? "Handover sheet submitted and emailed successfully" : "Handover sheet progress saved successfully");
        } catch (error) {
            console.error("Error saving handover sheet:", error);
            toast.error(isSubmit ? "Failed to submit handover sheet" : "Failed to save handover sheet");
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        setIsPrintDialogOpen(true);
    };

    const generatePDFBlob = async () => {
        if (!tableRef.current) return null;
        setIsGeneratingPDF(true);
        try {
            const margin = 40;
            const logoHeight = 50;
            const logoWidth = 150;

            // Use the printable area ref
            const printableArea = tableRef.current;
            const tableWidth = printableArea.scrollWidth;
            const tableHeight = printableArea.scrollHeight;

            const logoUrl = '/fme_transparent.png';
            const logoImg = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = logoUrl;
            });

            const tableDataUrl = await toPng(printableArea, {
                width: tableWidth,
                height: tableHeight,
                style: {
                    transform: 'none',
                    margin: '0',
                },
                backgroundColor: '#ffffff',
                pixelRatio: 1.5,
            });

            const pdfWidth = tableWidth + (margin * 2);
            const pdfHeight = tableHeight + (logoImg ? logoHeight + margin : 0) + (margin * 2);

            const pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [pdfWidth, pdfHeight]
            });

            let currentY = margin;
            if (logoImg) {
                pdf.addImage(logoImg, 'PNG', (pdfWidth - logoWidth) / 2, currentY, logoWidth, logoHeight);
                currentY += logoHeight + margin;
            }

            pdf.addImage(tableDataUrl, 'PNG', margin, currentY, tableWidth, tableHeight);

            return pdf;
        } catch (error) {
            console.error("PDF Generation error:", error);
            toast.error("Failed to generate PDF.");
            return null;
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleDownloadPDF = async () => {
        const pdf = await generatePDFBlob();
        if (pdf) {
            pdf.save(`Handover_Sheet_${departmentName.replace(/\s+/g, '_')}_${date}.pdf`);
            setIsPrintDialogOpen(false);
            toast.success("PDF downloaded successfully");
            logAction({ action: "DOWNLOAD_HANDOVER_SHEET_PDF", details: { departmentId, sectionId, date } }).catch(() => { });
        }
    };

    const handleDownloadHighResImage = async () => {
        if (!tableRef.current) return;
        const loadingToast = toast.info("Generating high-resolution image...", { duration: 0 });
        setIsGeneratingPDF(true);

        try {
            const printableArea = tableRef.current;
            const tableWidth = printableArea.scrollWidth;
            const tableHeight = printableArea.scrollHeight;

            const dataUrl = await toPng(printableArea, {
                width: tableWidth,
                height: tableHeight,
                style: {
                    transform: 'none',
                    margin: '0',
                },
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                quality: 1,
            });

            const link = document.createElement('a');
            link.download = `Handover_Sheet_${departmentName.replace(/\s+/g, '_')}_${date}.png`;
            link.href = dataUrl;
            link.click();

            toast.success("High-res image downloaded!");
            setIsPrintDialogOpen(false);
            logAction({ action: "DOWNLOAD_HANDOVER_SHEET_IMAGE", details: { departmentId, sectionId, date } }).catch(() => { });
        } catch (error) {
            console.error("Image export error:", error);
            toast.error("Failed to generate high-res image.");
        } finally {
            toast.dismiss(loadingToast);
            setIsGeneratingPDF(false);
        }
    };

    const handleEmailPDF = async () => {
        if (!emailForPDF || !emailForPDF.includes('@')) {
            toast.error("Please enter a valid email address");
            return;
        }

        const loadingToast = toast.info("Preparing PDF and sending email...", { duration: 0 });
        try {
            const pdf = await generatePDFBlob();
            if (pdf) {
                const pdfBase64 = pdf.output('datauristring');
                setIsGeneratingPDF(true);
                await axiosInstance.post('/api/departments/handover-sheet/pdf/send', {
                    email: emailForPDF,
                    pdfBase64,
                    departmentName: departmentName,
                    date: date
                });
                toast.success("Email sent successfully!");
                toast.dismiss(loadingToast);
                setIsPrintDialogOpen(false);
                logAction({ action: "EMAIL_HANDOVER_SHEET_PDF", details: { departmentId, sectionId, date, email: emailForPDF } }).catch(() => { });
                setEmailForPDF("");
            }
        } catch (error) {
            console.error("Email error:", error);
            toast.error("Failed to send email");
            toast.dismiss(loadingToast);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><IconDeviceFloppy className="h-8 w-8 animate-spin" /></div>;

    return (
        <>
            <Card className="w-full shadow-lg print:shadow-none">
                <div ref={tableRef} className="bg-white">
                    <CardHeader className="border-b bg-gray-50/50">
                        <div className="grid grid-cols-[1fr_2fr_1fr] items-start gap-4 py-4 min-h-[100px]">
                            <div className="flex items-center h-full">
                                {/* Logo or empty space for symmetry */}
                                <img src="/fme_transparent.png" alt="FURUKAWA" className="h-12 w-auto object-contain" />
                            </div>
                            <CardTitle className="text-xl font-bold text-center uppercase self-center">
                                List of Employees Handed Over to Shop Floor After Induction Training
                            </CardTitle>
                            <div className="text-[10px] text-right text-muted-foreground space-y-1 self-start">
                                <div className="flex items-center justify-end gap-1">
                                    <span className="font-semibold whitespace-nowrap">DOCUMENT NO.</span>
                                    <Input
                                        className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                        value={metadata.docNo}
                                        onChange={(e) => handleMetadataChange('docNo', e.target.value)}
                                        disabled={!canManage || !isEditable}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                    <span className="font-semibold whitespace-nowrap">REVISION No.</span>
                                    <Input
                                        className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                        value={metadata.revNo}
                                        onChange={(e) => handleMetadataChange('revNo', e.target.value)}
                                        disabled={!canManage || !isEditable}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                    <span className="font-semibold whitespace-nowrap">REVISION DATE:</span>
                                    <Input
                                        className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                        value={metadata.revDate}
                                        onChange={(e) => handleMetadataChange('revDate', e.target.value)}
                                        disabled={!canManage || !isEditable}
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-1">
                                    <span className="font-semibold whitespace-nowrap">ISSUE DT.</span>
                                    <Input
                                        className="h-5 w-24 text-[10px] px-1 py-0 bg-transparent border-slate-300"
                                        value={metadata.issueDate}
                                        onChange={(e) => handleMetadataChange('issueDate', e.target.value)}
                                        disabled={!canManage || !isEditable}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* Meta Info */}
                        <div className="grid grid-cols-2 gap-8 text-sm font-medium">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span>From:</span>
                                    <span className="text-blue-600">Education Centre</span>
                                </div>
                            </div>
                            <div className="space-y-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <span>To:</span>
                                    {canManage && isEditable && canEditSection ? (
                                        <Select value={localSectionId ? String(localSectionId) : ""} onValueChange={(val) => setLocalSectionId(val)}>
                                            <SelectTrigger className="h-8 w-48 text-blue-600 font-medium">
                                                <SelectValue placeholder="Select Section">
                                                    {selectedSectionLabel || "Select Section"}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departmentSections.map((s) => (
                                                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <span className="text-blue-600">{(sectionName ? `${sectionName}` : departmentName) || "Department"}</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                    <span>Date:</span>
                                    <Input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-40 h-8"
                                        disabled={viewOnly}
                                        min={isNewSheet ? new Date().toISOString().split('T')[0] : undefined}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                    {propShift && (
                                        <Badge variant="outline" className="text-xs font-semibold border-blue-300 text-blue-700 bg-blue-50">
                                            Shift {propShift}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 justify-end no-print">
                                    {isSubmitted && (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold border border-green-200 animate-in fade-in zoom-in duration-300">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            SUBMITTED {submittedAt && `ON ${format(new Date(submittedAt), "PP")}`}
                                        </div>
                                    )}
                                    {canEditLayout && (
                                        <>
                                            <Button variant="outline" onClick={fetchHistory}>
                                                <IconHistory className="h-4 w-4 mr-2" />
                                                History
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => {
                                                    setIsEditingLayout(true);
                                                    logAction({ action: "TOGGLE_HANDOVER_SHEET_LAYOUT_EDIT", details: { departmentId, sectionId } }).catch(() => { });
                                                }}
                                            >
                                                <IconSettings className="h-4 w-4 mr-2" />
                                                Edit Layout
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        variant="outline"
                                        className="border-green-600 text-green-600 hover:bg-green-50"
                                        onClick={() => {
                                            exportToExcel("Handover Sheet", { departmentId, sectionId, date });
                                            logAction({ action: "EXPORT_HANDOVER_SHEET_EXCEL", details: { departmentId, sectionId, date } }).catch(() => { });
                                        }}
                                    >
                                        <IconDownload className="h-4 w-4 mr-2" />
                                        Export
                                    </Button>
                                    <Button variant="outline" onClick={handlePrint}>
                                        <IconPrinter className="h-4 w-4 mr-2" />
                                        Print
                                    </Button>
                                    {canManage && (
                                        <>
                                            <Button
                                                className="bg-green-600 hover:bg-green-700 text-white border-green-700"
                                                onClick={() => handleSaveClick(false)}
                                                disabled={saving}
                                            >
                                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                                {saving ? "Saving..." : "Save Progress"}
                                            </Button>
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                                                onClick={() => handleSaveClick(true)}
                                                disabled={saving}
                                            >
                                                <Save className="h-4 w-4 mr-2" />
                                                {saving ? "Submitting..." : "Submit & Email"}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Main Table */}
                        <div className="border border-gray-300 overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100">
                                        {tableConfig && tableConfig.columns ? (
                                            tableConfig.columns.map((col, idx) => (
                                                <th key={idx} className={`border p-2 ${col.className || ""}`} style={col.style || {}}>
                                                    {col.header}
                                                </th>
                                            ))
                                        ) : (
                                            <>
                                                <th className="border p-2">SN.</th>
                                                <th className="border p-2">Employee Name</th>
                                                <th className="border p-2">Emp. Code</th>
                                                <th className="border p-2">Marks Secured in Induction Training</th>
                                                <th className="border p-2">Department</th>
                                                <th className="border p-2">Process</th>
                                                <th className="border p-2">Mentor</th>
                                                <th className="border p-2">1st Interview Accident</th>
                                                <th className="border p-2">2nd Interview Practical</th>
                                                <th className="border p-2">Approve / Reject</th>
                                            </>
                                        )}
                                        {canManage && isEditable && canDeleteRow && (
                                            <th className="border p-2 no-print">Action</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry, index) => (
                                        <tr key={entry.studentId || index} className="hover:bg-gray-50">
                                            {tableConfig && tableConfig.columns ? (
                                                tableConfig.columns.map((col, colIdx) => (
                                                    <td key={colIdx} className="border p-1">
                                                        {col.field === 'sn' ? (
                                                            <div className="text-center">{index + 1}</div>
                                                        ) : col.field === 'employeeName' && !col.readOnly && canManage && isEditable ? (
                                                            <UserAutocomplete
                                                                mode="all"
                                                                departmentId={departmentId}
                                                                excludeAdmins={true}
                                                                excludeTrainers={true}
                                                                value={entry.employeeName}
                                                                onChange={(user) => handleUserSelect(index, user)}
                                                                onTextChange={(val) => handleEntryChange(index, 'employeeName', val)}
                                                                placeholder="Search..."
                                                                compact={true}
                                                                includeTemporary="only"
                                                                dojoHandoverPassedOnly={dojoHandoverPassedOnly}
                                                                includeHandoverMarks={true}
                                                                includeLeft={true}
                                                                includeDeleted={true}
                                                                options={eligibleUsers.length > 0 ? eligibleUsers : null}
                                                                className="w-full"
                                                                inputClassName="border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 text-blue-600 font-medium"
                                                            />
                                                        ) : col.field === 'mentor' && !col.readOnly && canManage && isEditable ? (
                                                            <MentorSelect
                                                                departmentId={departmentId}
                                                                sectionId={sectionId}
                                                                value={entry.mentor}
                                                                onValueChange={(val) => handleEntryChange(index, 'mentor', val)}
                                                                className="text-center"
                                                            />
                                                        ) : (col.field === 'department' || col.field === 'departmentId') ? (
                                                            <div className="text-center text-xs font-medium text-blue-600 px-1">
                                                                {departmentName}
                                                            </div>
                                                        ) : col.field === 'process' && canManage && isEditable ? (
                                                            <ProcessSelect
                                                                key={`process-select-${index}`}
                                                                departmentId={departmentId}
                                                                sectionId={localSectionId}
                                                                value={entry.process || ""}
                                                                onValueChange={(val) => handleEntryChange(index, 'process', val)}
                                                            />
                                                        ) : (col.field === 'interview1' || col.field === 'interview2') && canManage && isEditable ? (
                                                            <InterviewSelect
                                                                value={entry[col.field] || ""}
                                                                onChange={(val) => handleEntryChange(index, col.field, val)}
                                                            />
                                                        ) : (col.readOnly || !canManage || !isEditable) ? (
                                                            <div className={`p-1 ${col.field === 'employeeName' ? 'font-medium text-blue-600' : 'text-center'}`}>
                                                                {(col.field === 'interview1' || col.field === 'interview2')
                                                                    ? (INTERVIEW_OPTIONS.find(o => o.value === entry[col.field])?.label || entry[col.field])
                                                                    : entry[col.field]}
                                                            </div>
                                                        ) : (
                                                            <AutoResizeInput
                                                                value={(entry[col.field] || "").toString()}
                                                                onChange={(e) => handleEntryChange(index, col.field, e.target.value)}
                                                                className="h-7 text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 bg-transparent text-xs outline-none"
                                                                minWidth={40}
                                                            />
                                                        )}
                                                    </td>
                                                ))
                                            ) : (
                                                <>
                                                    <td className="border p-1 text-center font-medium">
                                                        {index + 1}
                                                    </td>
                                                    <td className="border p-1">
                                                        {canManage && isEditable ? (
                                                            <UserAutocomplete
                                                                mode="all"
                                                                departmentId={departmentId}
                                                                excludeAdmins={true}
                                                                excludeTrainers={true}
                                                                value={entry.employeeName}
                                                                onChange={(user) => handleUserSelect(index, user)}
                                                                onTextChange={(val) => handleEntryChange(index, 'employeeName', val)}
                                                                placeholder="Search Employee..."
                                                                compact={true}
                                                                includeTemporary="only"
                                                                dojoHandoverPassedOnly={dojoHandoverPassedOnly}
                                                                includeHandoverMarks={true}
                                                                includeLeft={true}
                                                                includeDeleted={true}
                                                                options={eligibleUsers.length > 0 ? eligibleUsers : null}
                                                                className="min-w-[150px]"
                                                                inputClassName="border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 text-blue-600 font-medium"
                                                            />
                                                        ) : (
                                                            <div className="p-1 font-medium text-blue-600">
                                                                {entry.employeeName}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1 text-center">
                                                        {canManage && isEditable ? (
                                                            <AutoResizeInput
                                                                value={entry.empCode || ""}
                                                                onChange={(e) => handleEntryChange(index, 'empCode', e.target.value)}
                                                                className="h-7 text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 bg-transparent text-xs outline-none"
                                                                minWidth={60}
                                                            />
                                                        ) : (
                                                            <div className="p-1 text-center">{entry.empCode}</div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1 text-center">
                                                        {canManage && isEditable ? (
                                                            <AutoResizeInput
                                                                value={entry.marks || ""}
                                                                onChange={(e) => handleEntryChange(index, 'marks', e.target.value)}
                                                                className="h-7 text-center border-none shadow-none focus:ring-1 focus:ring-blue-400 bg-transparent text-xs outline-none"
                                                                minWidth={40}
                                                            />
                                                        ) : (
                                                            <div className="p-1 text-center">{entry.marks}</div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1 text-center">
                                                        <div className="text-xs font-medium text-blue-600 px-1">
                                                            {departmentName}
                                                        </div>
                                                    </td>
                                                    <td className="border p-1 text-center">
                                                        {canManage && isEditable ? (
                                                            <ProcessSelect
                                                                key={`process-select-def-${index}`}
                                                                departmentId={departmentId}
                                                                sectionId={localSectionId}
                                                                value={entry.process || ""}
                                                                onValueChange={(val) => handleEntryChange(index, 'process', val)}
                                                            />
                                                        ) : (
                                                            <div className="p-1 text-center">{entry.process}</div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1">
                                                        {canManage && isEditable ? (
                                                            <MentorSelect
                                                                departmentId={departmentId}
                                                                sectionId={sectionId}
                                                                value={entry.mentor}
                                                                onValueChange={(val) => handleEntryChange(index, 'mentor', val)}
                                                                className="min-w-[120px] text-center"
                                                            />
                                                        ) : (
                                                            <div className="p-1 text-center">{entry.mentor}</div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1 text-center">
                                                        {canManage && isEditable ? (
                                                            <InterviewSelect
                                                                value={entry.interview1}
                                                                onChange={(val) => handleEntryChange(index, 'interview1', val)}
                                                            />
                                                        ) : (
                                                            <div className="p-1 text-center">
                                                                {INTERVIEW_OPTIONS.find(o => o.value === entry.interview1)?.label || entry.interview1 || "—"}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1 text-center">
                                                        {canManage && isEditable ? (
                                                            <InterviewSelect
                                                                value={entry.interview2}
                                                                onChange={(val) => handleEntryChange(index, 'interview2', val)}
                                                            />
                                                        ) : (
                                                            <div className="p-1 text-center">
                                                                {INTERVIEW_OPTIONS.find(o => o.value === entry.interview2)?.label || entry.interview2 || "—"}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="border p-1">
                                                        {!entry.interviewStatus ? (
                                                            canApprove ? (
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        className="h-7 px-2 text-[10px] font-bold text-green-600 hover:text-green-700 hover:bg-green-50 border border-green-200"
                                                                        onClick={() => handleStatusAction(index, 'APPROVE')}
                                                                    >
                                                                        APPROVE
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        className="h-7 px-2 text-[10px] font-bold text-red-600 hover:bg-red-50 border border-red-200"
                                                                        onClick={() => handleStatusAction(index, 'REJECT')}
                                                                    >
                                                                        REJECT
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center text-slate-400 italic text-[10px]">
                                                                    Pending Approval
                                                                </div>
                                                            )
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-1">
                                                                <div className={`text-[10px] font-bold uppercase ${entry.interviewStatus === 'APPROVE' ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {entry.interviewStatus === 'APPROVE' ? 'Approved' : 'Rejected'}
                                                                </div>
                                                                <div className="text-[9px] text-gray-500 leading-tight text-center">
                                                                    by: {entry.statusActionBy}
                                                                </div>
                                                                {canApprove && (
                                                                    <button
                                                                        onClick={() => handleStatusAction(index, "")}
                                                                        className="mt-1 text-[8px] text-blue-500 hover:underline no-print"
                                                                    >
                                                                        Reset
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            {canManage && isEditable && canDeleteRow && (
                                                <td className="border p-1 text-center no-print">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => removeRow(index)}
                                                    >
                                                        <IconTrash className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {/* Empty rows to maintain look if needed */}

                                </tbody>
                            </table>
                            {canManage && isEditable && (
                                <div className="mt-2 flex justify-start no-print">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={addRow}
                                        className="flex items-center gap-1 text-xs border-dashed"
                                    >
                                        <IconPlus size={14} /> Add Row
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Footer Notes */}
                        <div className="text-xs font-bold border border-black p-2 mt-4">
                            Note:- Candidate (NEW MANPOWER) handover in W/H Assembly and C&C must be approved by QA Incharge & Prod. Incharge.
                        </div>

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
                            <div className="space-y-2">
                                <div className="border-b border-black min-h-[32px] flex items-end pb-1 px-1">
                                    <span className="text-sm font-bold text-blue-700 italic">
                                        {signatures.educationCell || "____________________"}
                                    </span>
                                </div>
                                <p className="text-sm font-bold">Signature Education Cell</p>
                                <p className="text-[10px] text-gray-500 italic">Form Filled By</p>
                            </div>
                            <div className="space-y-2 text-right">
                                <div className="border-b border-black min-h-[32px] flex items-end justify-end pb-1 px-1">
                                    <span className="text-sm font-bold text-blue-700 italic">
                                        {signatures.hod || "____________________"}
                                    </span>
                                </div>
                                <p className="text-sm font-bold">Signature of HOD/Incharge</p>
                                <p className="text-[10px] text-gray-500 italic">Form Approved By</p>
                            </div>
                        </div>

                        <div className="flex justify-end mt-8 no-print gap-4">
                            <Button
                                variant="outline"
                                onClick={() => exportToExcel("Handover Sheet", { departmentId, sectionId, date })}
                                className="border-green-600 text-green-600 hover:bg-green-50"
                            >
                                Export to Excel
                            </Button>
                            {canManage && (
                                <>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleSaveClick(false)}
                                        disabled={saving}
                                        className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
                                    >
                                        <IconDeviceFloppy className="h-4 w-4" />
                                        Save Progress
                                    </Button>
                                    <Button onClick={() => handleSaveClick(true)} disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        Submit & Email Sheet
                                    </Button>
                                </>
                            )}
                        </div>
                    </CardContent>
                </div>
            </Card>

            {/* Print Options Dialog */}
            <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
                <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconPrinter className="h-5 w-5" />
                            Print & Share Handover Sheet
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 gap-6 py-4">
                        <div className="grid grid-cols-3 gap-3">
                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-blue-50 hover:border-blue-200 transition-all"
                                onClick={handleDownloadPDF}
                                disabled={isGeneratingPDF}
                            >
                                {isGeneratingPDF ? <Loader2 className="h-6 w-6 animate-spin text-blue-500" /> : <IconDownload className="h-6 w-6 text-blue-500" />}
                                <span className="text-xs">Save as PDF</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-purple-50 hover:border-purple-200 transition-all"
                                onClick={handleDownloadHighResImage}
                                disabled={isGeneratingPDF}
                            >
                                {isGeneratingPDF ? <Loader2 className="h-6 w-6 animate-spin text-purple-500" /> : <IconPhoto className="h-6 w-6 text-purple-500" />}
                                <span className="text-xs">Save Image</span>
                            </Button>

                            <Button
                                variant="outline"
                                className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-green-50 hover:border-green-200 transition-all"
                                onClick={() => {
                                    setIsPrintDialogOpen(false);
                                    // Small delay to allow dialog to close before printing
                                    setTimeout(() => {
                                        window.print();
                                    }, 150);
                                }}
                            >
                                <IconPrinter className="h-6 w-6 text-green-500" />
                                <span className="text-xs">Browser Print</span>
                            </Button>
                        </div>

                        <div className="space-y-3 pt-4 border-t">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <IconMail className="h-4 w-4 text-blue-600" />
                                Email PDF to Department
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter recipient email address..."
                                    value={emailForPDF}
                                    onChange={(e) => setEmailForPDF(e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={handleEmailPDF}
                                    disabled={isGeneratingPDF || !emailForPDF}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconMail className="h-4 w-4 mr-2" />}
                                    Send Email
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                This will generate a PDF of the current sheet and send it as an attachment.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Layout Dialog */}
            <Dialog open={isEditingLayout} onOpenChange={setIsEditingLayout}>
                <DialogContent className="max-w-[800px] max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Handover Sheet Configuration (JSON)</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-1 space-y-4">
                        <Textarea
                            className="font-mono text-xs h-[400px]"
                            value={jsonConfigStr}
                            onChange={(e) => setJsonConfigStr(e.target.value)}
                            placeholder='e.g. { "columns": [{"header": "SN.", "field": "sn"}] }'
                        />
                        <div className="space-y-2">
                            <Label htmlFor="hs-remark">Remark (Required)</Label>
                            <Input
                                id="hs-remark"
                                placeholder="Briefly describe the changes made to the layout..."
                                value={layoutRemark}
                                onChange={(e) => setLayoutRemark(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-between p-4 border-t">
                        <Button variant="ghost" onClick={() => setIsEditingLayout(false)}>Cancel</Button>
                        <Button onClick={handleSaveConfig} disabled={!layoutRemark.trim()}>
                            Save Configuration
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Layout Change History</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                        {loadingHistory ? (
                            <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>
                        ) : configHistory.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">No history found.</div>
                        ) : (
                            configHistory.map((entry, idx) => (
                                <div key={idx} className="border p-3 rounded-lg space-y-2 bg-slate-50">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold">{entry.updatedBy}</span>
                                        <span className="text-muted-foreground text-xs">{format(new Date(entry.createdAt), "PP p")}</span>
                                    </div>
                                    <div className="text-sm border-l-2 border-blue-400 pl-2">
                                        {entry.remark}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            {/* Edit Remark Dialog */}
            <Dialog open={isRemarkDialogOpen} onOpenChange={setIsRemarkDialogOpen}>
                <DialogContent className="max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Reason for editing saved handover sheet</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-remark">Remark (Required)</Label>
                            <Input
                                id="edit-remark"
                                placeholder="Enter a brief reason/remark for the edits made..."
                                value={editRemark}
                                onChange={(e) => setEditRemark(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-4">
                        <Button variant="ghost" onClick={() => { setIsRemarkDialogOpen(false); setEditRemark(""); }}>Cancel</Button>
                        <Button onClick={handleConfirmSaveWithRemark} disabled={!editRemark.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Confirm Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default HandoverSheet;
