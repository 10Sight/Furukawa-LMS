import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Calendar, FileText } from "lucide-react";
import PortalTile from "@/components/common/PortalTile.jsx";
import useTranslate from "@/hooks/useTranslate.js";
import { canOpenPage, MIS_MORNING_MEETING_KEY, MIS_MONTHLY_REPORT_KEY } from "@/constants/navigation/pageRegistry.js";

// Mirrors the admin check used across the Daily Meeting / Monthly Report
// feature family (see server/utils/dailyMeetingAccess.util.js and
// monthlyReportAccess.util.js) — kept local since it's only needed here to
// decide which of the two tiles to show.
const isMisAdmin = (user) => (
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.isAdmin === 1 || user?.isAdmin === true
);

const hasPermission = (user, permission) => {
    if (isMisAdmin(user)) return true;
    return !!user?.customRole?.permissions?.includes(permission);
};

export default function MisPortalHub() {
    const navigate = useNavigate();
    const { user } = useSelector((state) => state.auth);
    const { darkMode } = useSelector((state) => state.theme);
    const { t } = useTranslate();

    // A workspace needs both: the page assigned to the user's role, and the
    // permission its data is served under.
    const canSeeDailyMeeting = hasPermission(user, "daily_meeting:read") && canOpenPage(MIS_MORNING_MEETING_KEY, user);
    const canSeeMonthlyReport = hasPermission(user, "monthly_report:read") && canOpenPage(MIS_MONTHLY_REPORT_KEY, user);

    return (
        <div className="max-w-3xl mx-auto py-8 px-3 sm:px-4">
            <div className="text-center mb-8">
                <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                    {t("landing.dailyMeetingTitle")}
                </h1>
                <p className={`text-xs sm:text-sm mt-1 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                    Choose a workspace to continue
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-xl mx-auto">
                {canSeeDailyMeeting && (
                    <PortalTile
                        accent="amber"
                        darkMode={darkMode}
                        icon={Calendar}
                        title={t("misPortal.dailyMorningMeetingTitle")}
                        desc={t("misPortal.dailyMorningMeetingDesc")}
                        ctaLabel="Open"
                        onClick={() => navigate("morning-meeting")}
                    />
                )}

                {canSeeMonthlyReport && (
                    <PortalTile
                        accent="purple"
                        darkMode={darkMode}
                        icon={FileText}
                        title={t("misPortal.monthlyMeetingReportTitle")}
                        desc={t("misPortal.monthlyMeetingReportDesc")}
                        ctaLabel="Open"
                        onClick={() => navigate("monthly-report")}
                    />
                )}

                {!canSeeDailyMeeting && !canSeeMonthlyReport && (
                    <div className={`sm:col-span-2 text-center py-12 rounded-2xl border-2 border-dashed ${darkMode ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-500"}`}>
                        You do not have access to any MIS Portal workspace. Contact an administrator if you believe this is a mistake.
                    </div>
                )}
            </div>
        </div>
    );
}
