import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { IconArrowLeft, IconCalendarCheck, IconEye, IconPlus, IconRefresh } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/ui/card.jsx";
import { Button } from "@/components/common/ui/button.jsx";
import { Badge } from "@/components/common/ui/badge.jsx";
import { Skeleton } from "@/components/common/ui/skeleton.jsx";
import { Alert, AlertDescription } from "@/components/common/ui/alert.jsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/tables/primitives/table.jsx";
import axiosInstance from "@/services/requests/axiosInstance.js";
import { displayDate } from "@/utils/dateUtils.js";
import { ALL_FORM_TYPES } from "@/constants/monitoring/tenCycleSheetConfig.js";
import SixteenDayMonitoringSheet from "./SixteenDayMonitoringSheet.jsx";
import ThreeDayMonitoringSheet from "./ThreeDayMonitoringSheet.jsx";
import OperatorObservanceSheet from "./OperatorObservanceSheet.jsx";
import SkillMatrixCertificate from "./SkillMatrixCertificate.jsx";

// "No record yet" sentinel for the full-screen view: opens the sheet without a recordId,
// so it loads the operator's latest record or a fresh first attempt.
const NEW_SHEET = "new";

const formatDate = (value) => (value ? displayDate(value) || "—" : "—");

// Lists every attempt from a monitoring sheet's history endpoint.
const fetchHistory = (url) => async () => {
    const res = await axiosInstance.get(url);
    return Array.isArray(res.data?.data) ? res.data.data : [];
};

const submittedStatus = (a) => (
    <Badge variant={a.status === "Submitted" ? "success" : "secondary"}>{a.status || "Draft"}</Badge>
);
const attemptLabel = (a) => `Attempt #${a.attemptNumber || 1}`;

// Per-sheet settings:
//   rowLabel   – [header, render] for the first (bold) column and the full-screen badge; null hides it
//   recordProp – the sheet prop that selects which record to open; null for single-record sheets
//   signOffs   – [field, label] badges, green once signed; empty hides the column
//   renderStatus – Status cell
//   openPath   – (row, pathname) => URL; set for records that open on their own page instead of
//                full screen here (Sheet is then null and there is no "open new" button)
//   description – card subtitle (defaults to "Sheets recorded for this user…")
const FIVE_M_FORM_TYPES = { standard: "Standard", src: "SRC", crimping: "Crimping" };
const FIVE_M_STATUS_VARIANTS = { APPROVED: "success", DECLINED: "destructive" };
const TEN_CYCLE_FORM_TYPES = Object.fromEntries(ALL_FORM_TYPES.map(({ id, label }) => [id, label]));
// Same order of precedence as the sheet list on the 10 Cycle page.
const tenCycleStatus = (s) => {
    if (s.reviewedStatus === "REJECT") return ["Rejected (Reviewer)", "destructive"];
    if (s.verifiedStatus === "REJECT") return ["Rejected (Verifier)", "destructive"];
    if (s.reviewedStatus === "APPROVE") return ["Approved", "success"];
    if (s.verifiedStatus === "APPROVE") return ["Verified", "success"];
    if (s.status === "Submitted") return ["Submitted", "secondary"];
    return ["Draft", "secondary"];
};

const SHEET_TYPES = {
    sixteenDay: {
        title: "16 Day Monitoring",
        rowLabel: ["Attempt", attemptLabel],
        recordProp: "initialRecordId",
        renderStatus: submittedStatus,
        fetchRows: (id) => fetchHistory(`/api/sixteen-day-monitoring/${id}/history`)(),
        Sheet: SixteenDayMonitoringSheet,
        signOffs: [
            ["checkedBy", "Checked"],
            ["verifiedBy", "Verified"],
            ["approvedBy", "Approved"],
            ["verifiedByEduCell", "Edu Cell"],
        ],
        columns: [
            ["Start Date", (a) => formatDate(a.startDate)],
            ["Process", (a) => a.processName || "—"],
            ["Line Leader", (a) => a.lineLeaderName || "—"],
        ],
    },
    threeDay: {
        title: "3 Day Monitoring",
        rowLabel: ["Attempt", attemptLabel],
        recordProp: "initialRecordId",
        renderStatus: submittedStatus,
        fetchRows: (id) => fetchHistory(`/api/three-day-monitoring/${id}/history`)(),
        Sheet: ThreeDayMonitoringSheet,
        signOffs: [
            ["checkedBy", "Checked"],
            ["verifiedBy", "Verified"],
            ["approvedBy", "Approved"],
        ],
        columns: [
            ["Created", (a) => formatDate(a.createdAt)],
            ["Line", (a) => a.lineName || "—"],
            ["Process", (a) => a.processName || "—"],
        ],
    },
    // One record per operator (no attempt history): the table shows that record, if saved.
    observance: {
        title: "Operator Observance",
        rowLabel: null,
        recordProp: null,
        renderStatus: submittedStatus,
        fetchRows: async (id) => {
            const res = await axiosInstance.get(`/api/operator-observance/${id}`);
            const record = res.data?.data;
            return record && !record.isNew ? [record] : [];
        },
        Sheet: OperatorObservanceSheet,
        signOffs: [
            ["preparedBy", "Prepared"],
            ["checkedBy", "Checked"],
            ["verifiedBy", "Verified"],
        ],
        columns: [
            ["Line", (a) => a.lineName || "—"],
            ["Process", (a) => a.processName || "—"],
            ["Level 1 Date", (a) => formatDate(a.level1Date)],
            ["Level 2 Date", (a) => formatDate(a.level2Date)],
        ],
    },
    // Mirrors the evaluation sheets table on the Skill Matrix page. Only the active sheet is
    // editable; earlier ones open read-only inside the certificate itself.
    skillEvaluation: {
        title: "Skill Evaluation",
        rowLabel: ["Sheet", (a) => `Sheet ${a.sheetIndex}`],
        recordProp: "initialSheetId",
        fetchRows: (id) => fetchHistory(`/api/skill-matrix/evaluation/${id}/sheets`)(),
        Sheet: SkillMatrixCertificate,
        signOffs: [],
        columns: [
            ["Period", (a) => a.period || "—"],
            ["Level Earned", (a) => <span className="font-bold text-blue-600">{a.earnedLevel || "L0"}</span>],
            ["Efficiency", (a) => `${a.efficiency || 0}%`],
            ["Created", (a) => formatDate(a.createdAt)],
        ],
        renderStatus: (a) => (
            <Badge variant={a.isActive ? "success" : "secondary"}>{a.isActive ? "Active" : "Previous"}</Badge>
        ),
    },
    // Daily 5M forms (latest save of each) that name this user as operator or deputed person.
    // The form opens read-only on the Daily 5M page, as from the 5M dashboard: that page drives
    // its state through the URL, so it can't be embedded full screen here.
    daily5m: {
        title: "Daily 5M",
        description: "Daily 5M forms this user is added to as operator or deputed person. Click a row to view the form.",
        rowLabel: ["Date", (a) => formatDate(a.date)],
        recordProp: null,
        fetchRows: (id) => fetchHistory(`/api/daily-5m/records/user/${id}`)(),
        Sheet: null,
        openPath: (a, pathname) =>
            `${pathname.startsWith("/portal") ? "/portal" : "/cms"}/daily-5m-recording?recordId=${a.id}&mode=view`,
        signOffs: [],
        columns: [
            ["Form", (a) => FIVE_M_FORM_TYPES[a.formType] || a.formType || "—"],
            ["Department", (a) => [a.departmentName, a.sectionName].filter(Boolean).join(" / ") || "—"],
            ["Line", (a) => a.line || "—"],
            ["Shift", (a) => a.shift || "—"],
            ["Added As", (a) => (a.roles || []).join(", ") || "—"],
            ["Rows", (a) => (a.rowNumbers || []).join(", ") || "—"],
            ["Submitted By", (a) => a.submittedByName || "—"],
        ],
        renderStatus: (a) => (
            <Badge variant={FIVE_M_STATUS_VARIANTS[a.status] || "secondary"}>{a.status || "PENDING"}</Badge>
        ),
    },
    // 10 cycle sheets with a row naming this user (by Emp. Code) as operator. Like Daily 5M, the
    // sheet opens on the 10 Cycle page (?id=), which shows it in its own full-screen view.
    tenCycle: {
        title: "10 Cycle",
        description: "10 Cycle sheets this user is added to as an operator. Click a row to open the sheet.",
        rowLabel: ["Date", (a) => formatDate(a.createdDate || a.createdAt)],
        recordProp: null,
        fetchRows: (id) => fetchHistory(`/api/ten-cycle-sheets/user/${id}`)(),
        Sheet: null,
        openPath: (a, pathname) => `${pathname.startsWith("/portal") ? "/portal" : "/admin"}/10-cycle?id=${a.id}`,
        signOffs: [
            ["verifiedBy", "Verified"],
            ["reviewedBy", "Reviewed"],
        ],
        columns: [
            ["Form", (a) => TEN_CYCLE_FORM_TYPES[a.formType] || a.formType || "—"],
            ["Department", (a) => [a.departmentName, a.sectionName].filter(Boolean).join(" / ") || "—"],
            ["Line", (a) => [a.lineName, a.subSectionName].filter(Boolean).join(" / ") || "—"],
            ["Rows", (a) => (a.rowNumbers || []).join(", ") || "—"],
        ],
        renderStatus: (a) => {
            const [label, variant] = tenCycleStatus(a);
            return <Badge variant={variant}>{label}</Badge>;
        },
    },
};

/**
 * Monitoring tab for a user's detail page: lists the user's attempts of one monitoring sheet
 * (`type`: "sixteenDay" | "threeDay" | "observance" | "skillEvaluation" | "daily5m" | "tenCycle") and opens the
 * chosen one full screen (or on its own page, see openPath). Extra props (departmentId, readOnly,
 * sectionId, …) are forwarded to the sheet.
 */
const MonitoringSheetTab = ({ type, studentId, studentName = "", employeeCode = "", ...sheetProps }) => {
    const { title, description, rowLabel, recordProp, fetchRows, Sheet, openPath, signOffs, columns, renderStatus } = SHEET_TYPES[type];
    const navigate = useNavigate();
    const location = useLocation();
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [openRecordId, setOpenRecordId] = useState(null); // record id, NEW_SHEET, or null (closed)

    const fetchAttempts = useCallback(async () => {
        if (!studentId) return;
        setLoading(true);
        setError(false);
        try {
            setAttempts(await fetchRows(studentId));
        } catch (err) {
            console.error(`Failed to fetch ${title} history:`, err);
            setError(true);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId, type]);

    useEffect(() => { fetchAttempts(); }, [fetchAttempts]);

    const isOpen = openRecordId !== null && !!Sheet;

    const openRow = (row) => {
        if (openPath) navigate(openPath(row, location.pathname));
        else setOpenRecordId(row.id);
    };

    // Refresh the list on close so saves/submits made in the sheet show up.
    const closeSheet = useCallback(() => {
        setOpenRecordId(null);
        fetchAttempts();
    }, [fetchAttempts]);

    // Escape closes the full-screen sheet — but not while a dialog/popover/dropdown is open
    // (Escape is closing that instead) or while the user is typing in a cell.
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if (e.key !== "Escape" || e.defaultPrevented) return;
            const target = e.target;
            if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
            if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')) return;
            closeSheet();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, closeSheet]);

    // Stop the page underneath from scrolling while the full-screen sheet is open.
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    // Full-screen layout: slot the sheet portals its actions into, visible width of the scroll
    // container (keeps header controls in view on wide sheets), and header height exposed as
    // --sheet-sticky-top so the sheet's table header freezes just beneath it.
    const [headerActionsEl, setHeaderActionsEl] = useState(null);
    const [scrollEl, setScrollEl] = useState(null);
    const [headerEl, setHeaderEl] = useState(null);
    const [viewportWidth, setViewportWidth] = useState(0);
    useEffect(() => {
        if (!scrollEl) return;
        const update = () => setViewportWidth(scrollEl.clientWidth);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(scrollEl);
        return () => observer.disconnect();
    }, [scrollEl]);
    useEffect(() => {
        if (!headerEl || !scrollEl) return;
        const update = () => scrollEl.style.setProperty("--sheet-sticky-top", `${headerEl.offsetHeight}px`);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(headerEl);
        return () => observer.disconnect();
    }, [headerEl, scrollEl]);

    const openAttempt = attempts.find((a) => String(a.id) === String(openRecordId));

    const fullScreen = isOpen && createPortal(
        <div ref={setScrollEl} className="fixed inset-0 z-50 bg-slate-100 overflow-auto w-screen h-screen animate-in fade-in duration-200">
            {/* Grows to the widest sheet so the header bar spans the whole horizontal scroll */}
            <div className="min-w-full w-max min-h-full flex flex-col">
                <div ref={setHeaderEl} className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm print:hidden">
                    <div className="sticky left-0" style={{ width: viewportWidth || "100vw" }}>
                        <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                            <div className="flex items-center gap-4 min-w-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 shrink-0 -ml-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
                                    onClick={closeSheet}
                                >
                                    <IconArrowLeft size={16} />
                                    Back
                                </Button>
                                <div className="h-9 w-px bg-slate-200 shrink-0" />
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span className="text-sm font-bold text-slate-800 leading-none truncate">
                                        {studentName || "Operator"} — {title}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {employeeCode && (
                                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold px-1.5 py-0">
                                                #{employeeCode}
                                            </Badge>
                                        )}
                                        {rowLabel && openAttempt && (
                                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-semibold px-1.5 py-0">
                                                {rowLabel[1](openAttempt)}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-medium whitespace-nowrap">
                                Press <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500">Esc</kbd> to close
                            </div>
                        </div>
                        {/* The sheet portals its attempt history, status, save/submit and print controls here */}
                        <div ref={setHeaderActionsEl} className="border-t border-slate-200/80 bg-slate-50/80 empty:hidden" />
                    </div>
                </div>

                <div className="p-4 sm:p-6 pb-20">
                    <Sheet
                        key={openRecordId}
                        {...sheetProps}
                        studentId={studentId}
                        studentName={studentName}
                        employeeCode={employeeCode}
                        {...(recordProp ? { [recordProp]: openRecordId === NEW_SHEET ? null : openRecordId } : {})}
                        headerActionsContainer={headerActionsEl}
                    />
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2">
                            <IconCalendarCheck className="h-5 w-5 text-indigo-600" />
                            {title}
                        </CardTitle>
                        <CardDescription>{description || `${recordProp ? "Sheets" : "Sheet"} recorded for this user. Click a row to open it.`}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={fetchAttempts} disabled={loading}>
                        <IconRefresh className="h-4 w-4" />
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertDescription>Failed to load {title} records. Please try refreshing.</AlertDescription>
                        </Alert>
                    ) : attempts.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {rowLabel && <TableHead>{rowLabel[0]}</TableHead>}
                                    {columns.map(([label]) => <TableHead key={label}>{label}</TableHead>)}
                                    {signOffs.length > 0 && <TableHead>Sign-offs</TableHead>}
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {attempts.map((attempt) => (
                                    <TableRow
                                        key={attempt.id}
                                        className="cursor-pointer hover:bg-indigo-50/50"
                                        onClick={() => openRow(attempt)}
                                    >
                                        {rowLabel && <TableCell className="font-medium">{rowLabel[1](attempt)}</TableCell>}
                                        {columns.map(([label, render]) => <TableCell key={label}>{render(attempt)}</TableCell>)}
                                        {signOffs.length > 0 && <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {signOffs.map(([field, label]) => (
                                                    <Badge
                                                        key={field}
                                                        variant="outline"
                                                        title={attempt[field] || `Not ${label.toLowerCase()} yet`}
                                                        className={attempt[field]
                                                            ? "border-green-200 bg-green-50 text-green-700 text-[10px]"
                                                            : "border-slate-200 text-slate-400 text-[10px]"}
                                                    >
                                                        {label}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>}
                                        <TableCell>{renderStatus(attempt)}</TableCell>
                                        <TableCell>{formatDate(attempt.updatedAt || attempt.createdAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1"
                                                onClick={(e) => { e.stopPropagation(); openRow(attempt); }}
                                            >
                                                <IconEye className="h-4 w-4" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12">
                            <IconCalendarCheck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">No {title} Yet</h3>
                            <p className="text-muted-foreground mb-4">
                                {Sheet ? `No ${title} sheet has been recorded for this user.` : `This user isn't on any ${title} form yet.`}
                            </p>
                            {Sheet && (
                                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setOpenRecordId(NEW_SHEET)}>
                                    <IconPlus className="h-4 w-4" />
                                    Open {title} Sheet
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
            {fullScreen}
        </>
    );
};

export default MonitoringSheetTab;
