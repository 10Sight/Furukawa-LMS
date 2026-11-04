import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
    IconAlertTriangle, IconCalculator, IconDownload, IconLoader2, IconRefresh, IconSettings, IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";
import { cn } from "@/utils/classNames.js";
import useTranslate from "@/hooks/useTranslate.js";
import {
    useGetDailyManpowerReportQuery,
    useGetDailyHandoverReportQuery,
    useRecalculateDailyManpowerMonthMutation,
} from "@/services/api/DailyHrMeetingApi.js";
import { exportDailyManpowerReport } from "@/utils/dailyManpowerExcelExport.js";
import { exportDailyHandoverReport } from "@/utils/dailyHandoverExcelExport.js";
import DailyManpowerReportSheet from "@/pages/meetings/components/hr-meeting/DailyManpowerReportSheet.jsx";
import DailyHandoverReportSheet from "@/pages/meetings/components/hr-meeting/DailyHandoverReportSheet.jsx";
import DepartmentConfigModal from "@/pages/meetings/components/hr-meeting/DepartmentConfigModal.jsx";
import ManualTrainingEditModal from "@/pages/meetings/components/hr-meeting/ManualTrainingEditModal.jsx";

// Daily HR Meeting workspace (MIS Portal).
// - Daily Manpower Report: figures stored server-side when attendance is uploaded (and nightly /
//   on Recalculate); this page only reads them.
// - Daily Handover Report: Handover Actual by section + Hiring Actual by shift, read live.
// Both tabs share the month, the days-shown switch and the section configuration.

// Mirrors the admin check in MisPortalHub.jsx; the server re-checks every request.
const isAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);
const hasPermission = (user, permission) => isAdmin(user) || !!user?.customRole?.permissions?.includes(permission);

const currentMonthIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

// Days-shown options per tab. The Handover tab loads the selected month and the month before it
// (HANDOVER_MONTHS) and shows both by default.
const HANDOVER_MONTHS = 2;
const RANGES = {
    manpower: [
        { key: "7", label: "Last 7 days" },
        { key: "15", label: "Last 15 days" },
        { key: "all", label: "Full month" },
    ],
    handover: [
        { key: "7", label: "Last 7 days" },
        { key: "15", label: "Last 15 days" },
        { key: "month", label: "Selected month" },
        { key: "all", label: "2 months" },
    ],
};
const DEFAULT_RANGE = { manpower: "7", handover: "all" };

const TABS = [
    { key: "manpower", label: "Daily Manpower Report" },
    { key: "handover", label: "Daily Handover Report" },
];

export default function DailyHrMeeting() {
    const { user } = useSelector((state) => state.auth);
    const { darkMode } = useSelector((state) => state.theme);
    const { t } = useTranslate();

    const canRead = hasPermission(user, "hr_meeting:read");
    const canEdit = hasPermission(user, "hr_meeting:update");

    // The open tab lives in the URL (?tab=manpower | ?tab=handover) so a refresh or a shared link
    // keeps it; anything else falls back to the first tab.
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const activeTab = TABS.some((tab) => tab.key === tabParam) ? tabParam : TABS[0].key;
    const setActiveTab = (key) => setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);
        return next;
    }, { replace: true });
    const [monthValue, setMonthValue] = useState(currentMonthIST);
    const [rangeByTab, setRangeByTab] = useState(DEFAULT_RANGE);
    const [configOpen, setConfigOpen] = useState(false);
    const [configTab, setConfigTab] = useState("sections");
    const [trainingOpen, setTrainingOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [year, month] = monthValue.split("-").map(Number);
    const isManpower = activeTab === "manpower";
    const range = rangeByTab[activeTab];
    const setRange = (key) => setRangeByTab((prev) => ({ ...prev, [activeTab]: key }));
    const manpowerQuery = useGetDailyManpowerReportQuery(
        { year, month },
        { skip: !canRead || !year || !month || !isManpower }
    );
    const handoverQuery = useGetDailyHandoverReportQuery(
        { year, month, months: HANDOVER_MONTHS },
        { skip: !canRead || !year || !month || isManpower }
    );
    const { isFetching, isError, error, refetch } = isManpower ? manpowerQuery : handoverQuery;
    const [recalculate, { isLoading: recalculating }] = useRecalculateDailyManpowerMonthMutation();

    const report = isManpower ? manpowerQuery.data?.data : undefined;
    const handoverReport = isManpower ? undefined : handoverQuery.data?.data;
    const activeReport = isManpower ? report : handoverReport;
    const visibleDates = useMemo(() => {
        const dates = activeReport?.dates || [];
        if (range === "all") return dates;
        if (range === "month") return dates.filter((d) => d.date.startsWith(monthValue));
        return dates.slice(-Number(range));
    }, [activeReport, range, monthValue]);
    const handoverDiagnostics = handoverReport?.diagnostics;
    const handoverNotShown = (handoverDiagnostics?.hiddenDepartmentHandovers || 0) + (handoverDiagnostics?.unassignedHandovers || 0);

    const diagnostics = report?.diagnostics;
    const hasUnmappedDepartments = (diagnostics?.unmappedAttendanceDepartments?.length || 0) > 0;
    const notComputed = diagnostics?.notComputedDates?.length || 0;

    const handleRecalculate = async () => {
        if (!window.confirm(`Recalculate every day of ${monthValue} from attendance and current requirements? Stored figures for this month will be replaced.`)) return;
        try {
            const res = await recalculate({ year, month }).unwrap();
            const skipped = res?.data?.daysWithoutAttendance || 0;
            toast.success(`Recalculated ${res?.data?.recomputedDates || 0} day(s)${skipped ? ` — ${skipped} day(s) have no attendance uploaded` : ""}`);
        } catch (err) {
            toast.error(err?.message || "Recalculation failed");
        }
    };

    const handleExport = async () => {
        if (!activeReport) return;
        setExporting(true);
        try {
            if (isManpower) await exportDailyManpowerReport(report);
            else await exportDailyHandoverReport(handoverReport);
        } catch (err) {
            console.error(err);
            toast.error("Excel export failed");
        } finally {
            setExporting(false);
        }
    };

    const openConfig = (tab) => { setConfigTab(tab); setConfigOpen(true); };

    const card = darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
    const muted = darkMode ? "text-slate-400" : "text-slate-500";

    if (!canRead) {
        return (
            <div className={cn("max-w-xl mx-auto mt-16 text-center rounded-2xl border-2 border-dashed p-10", darkMode ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500")}>
                You do not have access to the Daily HR Meeting. Ask an administrator for the "View Daily HR Meeting" permission.
            </div>
        );
    }

    return (
        <div className="px-3 sm:px-5 py-5 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className={cn("flex items-center gap-2 text-xl font-extrabold tracking-tight", darkMode ? "text-slate-100" : "text-slate-900")}>
                        <IconUsers size={22} /> {t("misPortal.dailyHrMeetingTitle")}
                    </h1>
                    <p className={cn("text-xs mt-0.5", muted)}>
                        {!isManpower
                            ? "Approved handovers and Dojo recruits, up to date."
                            : report?.lastComputedAt
                                ? `Last calculated ${new Date(report.lastComputedAt).toLocaleString()}`
                                : "Figures are calculated when attendance is uploaded."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="month"
                        value={monthValue}
                        max={currentMonthIST()}
                        aria-label="Month"
                        onChange={(e) => e.target.value && setMonthValue(e.target.value)}
                        className={cn("h-9 rounded-md border px-2 text-sm", darkMode ? "bg-slate-900 border-slate-700 text-slate-100 [color-scheme:dark]" : "bg-white border-slate-300")}
                    />
                    <div className={cn("inline-flex rounded-md border p-0.5", darkMode ? "border-slate-700" : "border-slate-300")} role="group" aria-label="Days shown">
                        {RANGES[activeTab].map((r) => (
                            <button
                                key={r.key}
                                type="button"
                                onClick={() => setRange(r.key)}
                                className={cn(
                                    "px-2.5 h-8 text-xs rounded",
                                    range === r.key
                                        ? (darkMode ? "bg-slate-700 text-white" : "bg-slate-900 text-white")
                                        : (darkMode ? "text-slate-300" : "text-slate-600"),
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    {canEdit && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => openConfig("sections")}><IconSettings /> Configure sections</Button>
                            {isManpower && (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setTrainingOpen(true)}><IconUsers /> Training inputs</Button>
                                    <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                                        {recalculating ? <IconLoader2 className="animate-spin" /> : <IconCalculator />} Recalculate month
                                    </Button>
                                </>
                            )}
                        </>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={!activeReport?.dates?.length || exporting}>
                        {exporting ? <IconLoader2 className="animate-spin" /> : <IconDownload />} Export Excel
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                        <IconRefresh className={cn(isFetching && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className={cn("flex gap-1 border-b", darkMode ? "border-slate-800" : "border-slate-200")} role="tablist">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            "px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
                            activeTab === tab.key
                                ? (darkMode ? "border-green-400 text-slate-100" : "border-green-600 text-slate-900")
                                : (darkMode ? "border-transparent text-slate-400 hover:text-slate-200" : "border-transparent text-slate-500 hover:text-slate-700"),
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {handoverReport && (handoverNotShown > 0 || handoverDiagnostics?.unassignedShiftTotal > 0) && (
                <div className={cn("rounded-lg border px-3 py-2 text-xs space-y-1", darkMode ? "border-amber-900 bg-amber-950/40 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-900")}>
                    <div className="flex items-center gap-1.5 font-semibold"><IconAlertTriangle size={14} /> Check before the meeting</div>
                    {handoverNotShown > 0 && (
                        <div>
                            {handoverNotShown} handover(s) in these {HANDOVER_MONTHS} months are not in any row
                            {handoverDiagnostics.hiddenDepartmentHandovers > 0 ? ` (${handoverDiagnostics.hiddenDepartmentHandovers} to hidden sections)` : ""}
                            {handoverDiagnostics.unassignedHandovers > 0 ? ` (${handoverDiagnostics.unassignedHandovers} with no or a deleted department)` : ""}.
                            {canEdit && handoverDiagnostics.hiddenDepartmentHandovers > 0 && (
                                <button type="button" className="ml-2 font-semibold underline" onClick={() => openConfig("sections")}>Configure sections</button>
                            )}
                        </div>
                    )}
                    {handoverDiagnostics?.unassignedShiftTotal > 0 && (
                        <div>{handoverDiagnostics.unassignedShiftTotal} Dojo recruit(s) in these {HANDOVER_MONTHS} months have no A/B/C/G shift and are shown under “No shift”.</div>
                    )}
                </div>
            )}

            {report && (hasUnmappedDepartments || diagnostics?.unmappedPresentTotal > 0 || diagnostics?.noDepartmentPresentTotal > 0 || notComputed > 0) && (
                <div className={cn("rounded-lg border px-3 py-2 text-xs space-y-1", darkMode ? "border-amber-900 bg-amber-950/40 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-900")}>
                    <div className="flex items-center gap-1.5 font-semibold"><IconAlertTriangle size={14} /> Check before the meeting</div>
                    {notComputed > 0 && (
                        <div>{notComputed} day(s) have no figures (shown as “–”): no attendance uploaded for them, or not calculated yet.{canEdit ? " Upload attendance or use Recalculate month." : ""}</div>
                    )}
                    {hasUnmappedDepartments && (
                        <div>
                            Attendance department names not mapped to a department (counted under each person's current department):{" "}
                            {diagnostics.unmappedAttendanceDepartments.slice(0, 5).map((u) => `${u.name} (${u.count})`).join(", ")}
                            {diagnostics.unmappedAttendanceDepartments.length > 5 ? "…" : ""}
                            {canEdit && (
                                <button type="button" className="ml-2 font-semibold underline" onClick={() => openConfig("mapping")}>Map them</button>
                            )}
                        </div>
                    )}
                    {diagnostics?.unmappedPresentTotal > 0 && (
                        <div>{diagnostics.unmappedPresentTotal} present punch(es) this month have no matching employee and are not in any row.</div>
                    )}
                    {diagnostics?.noDepartmentPresentTotal > 0 && (
                        <div>{diagnostics.noDepartmentPresentTotal} present punch(es) could not be placed in an active department.</div>
                    )}
                </div>
            )}

            <div className={cn("rounded-xl border p-2", card)}>
                {isError ? (
                    <div className={cn("py-16 text-center text-sm", muted)}>{error?.message || "Could not load the report."}</div>
                ) : !activeReport ? (
                    <div className="flex justify-center py-16"><IconLoader2 className="animate-spin" /></div>
                ) : !activeReport.dates.length ? (
                    <div className={cn("py-16 text-center text-sm", muted)}>This month has not started yet.</div>
                ) : !isManpower ? (
                    <DailyHandoverReportSheet report={handoverReport} visibleDates={visibleDates} darkMode={darkMode} />
                ) : (
                    <DailyManpowerReportSheet
                        report={report}
                        visibleDates={visibleDates}
                        darkMode={darkMode}
                        canEdit={canEdit}
                        onEditTraining={() => setTrainingOpen(true)}
                    />
                )}
            </div>

            {canEdit && (
                <>
                    <DepartmentConfigModal open={configOpen} onOpenChange={setConfigOpen} year={year} month={month} darkMode={darkMode} initialTab={configTab} />
                    <ManualTrainingEditModal open={trainingOpen} onOpenChange={setTrainingOpen} year={year} month={month} darkMode={darkMode} />
                </>
            )}
        </div>
    );
}
