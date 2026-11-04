import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import {
    IconAlertTriangle, IconCalculator, IconDownload, IconLoader2, IconRefresh, IconSettings, IconUsers,
} from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";
import { cn } from "@/utils/classNames.js";
import useTranslate from "@/hooks/useTranslate.js";
import {
    useGetDailyManpowerReportQuery,
    useRecalculateDailyManpowerMonthMutation,
} from "@/services/api/DailyHrMeetingApi.js";
import { exportDailyManpowerReport } from "@/utils/dailyManpowerExcelExport.js";
import DailyManpowerReportSheet from "@/pages/meetings/components/hr-meeting/DailyManpowerReportSheet.jsx";
import DepartmentConfigModal from "@/pages/meetings/components/hr-meeting/DepartmentConfigModal.jsx";
import ManualTrainingEditModal from "@/pages/meetings/components/hr-meeting/ManualTrainingEditModal.jsx";

// Daily HR Meeting workspace (MIS Portal). First tab: Daily Manpower Report.
// Figures are stored server-side when attendance is uploaded (and nightly / on Recalculate);
// this page only reads them.

// Mirrors the admin check in MisPortalHub.jsx; the server re-checks every request.
const isAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);
const hasPermission = (user, permission) => isAdmin(user) || !!user?.customRole?.permissions?.includes(permission);

const currentMonthIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

const RANGES = [
    { key: "7", label: "Last 7 days" },
    { key: "15", label: "Last 15 days" },
    { key: "all", label: "Full month" },
];

export default function DailyHrMeeting() {
    const { user } = useSelector((state) => state.auth);
    const { darkMode } = useSelector((state) => state.theme);
    const { t } = useTranslate();

    const canRead = hasPermission(user, "hr_meeting:read");
    const canEdit = hasPermission(user, "hr_meeting:update");

    const [monthValue, setMonthValue] = useState(currentMonthIST);
    const [range, setRange] = useState("7");
    const [configOpen, setConfigOpen] = useState(false);
    const [configTab, setConfigTab] = useState("sections");
    const [trainingOpen, setTrainingOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    const [year, month] = monthValue.split("-").map(Number);
    const { data, isFetching, isError, error, refetch } = useGetDailyManpowerReportQuery(
        { year, month },
        { skip: !canRead || !year || !month }
    );
    const [recalculate, { isLoading: recalculating }] = useRecalculateDailyManpowerMonthMutation();

    const report = data?.data;
    const visibleDates = useMemo(() => {
        const dates = report?.dates || [];
        if (range === "all") return dates;
        return dates.slice(-Number(range));
    }, [report, range]);

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
        if (!report) return;
        setExporting(true);
        try {
            await exportDailyManpowerReport(report);
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
                        {report?.lastComputedAt
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
                        {RANGES.map((r) => (
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
                            <Button variant="outline" size="sm" onClick={() => setTrainingOpen(true)}><IconUsers /> Training inputs</Button>
                            <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculating}>
                                {recalculating ? <IconLoader2 className="animate-spin" /> : <IconCalculator />} Recalculate month
                            </Button>
                        </>
                    )}
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={!report?.dates?.length || exporting}>
                        {exporting ? <IconLoader2 className="animate-spin" /> : <IconDownload />} Export Excel
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
                        <IconRefresh className={cn(isFetching && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className={cn("flex gap-1 border-b", darkMode ? "border-slate-800" : "border-slate-200")} role="tablist">
                <button type="button" role="tab" aria-selected="true" className={cn("px-3 py-2 text-sm font-semibold border-b-2 -mb-px", darkMode ? "border-green-400 text-slate-100" : "border-green-600 text-slate-900")}>
                    Daily Manpower Report
                </button>
            </div>

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
                ) : !report ? (
                    <div className="flex justify-center py-16"><IconLoader2 className="animate-spin" /></div>
                ) : !report.dates.length ? (
                    <div className={cn("py-16 text-center text-sm", muted)}>This month has not started yet.</div>
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
