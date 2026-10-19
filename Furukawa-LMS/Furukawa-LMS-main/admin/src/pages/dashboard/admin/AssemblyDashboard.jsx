import brandLogoUrl from "@/assets/logos/fme-transparent.png";
import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch } from "react-redux";
import { format } from 'date-fns';
import { IconClock, IconRefresh } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { dashboardApi, useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import { useLogActionMutation } from "@/services/api/AuditApi.js";
import AssemblyDepartmentChart from "@/components/dashboard/assembly/AssemblyDepartmentChart.jsx";
import AssemblySectionLineChart from "@/components/dashboard/assembly/AssemblySectionLineChart.jsx";
import { ChartLoader } from "@/components/dashboard/assembly/assemblyChartShared.jsx";
import {
  WIDE_SECTION_LINE_COUNT, getIstDateString,
} from "@/components/dashboard/assembly/assemblyChartUtils.jsx";

const DashboardClock = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-right">
      <IconClock className="h-4 w-4 text-gray-400 shrink-0" />
      <div>
        <div className="text-sm font-bold text-gray-800 tabular-nums">{format(now, 'hh:mm:ss a')}</div>
        <div className="text-xs text-gray-500">{format(now, 'EEEE, dd MMM yyyy')}</div>
      </div>
    </div>
  );
};

const AssemblyDashboard = () => {
  const { t } = useTranslate();
  const dispatch = useDispatch();
  const [logAction] = useLogActionMutation();

  // Every chart owns its date and shift and starts on yesterday / ALL.
  const [defaultDate] = useState(() => getIstDateString(-1));

  // The default-date result decides which section cards exist and how wide they are.
  // It is the same request the charts make for that date, so it is fetched only once.
  const { data, error, isLoading } = useGetAssemblyDashboardStatsQuery({ date: defaultDate });
  const layoutSections = useMemo(() => data?.data?.sections || [], [data]);

  useEffect(() => {
    logAction({ action: "VIEW_ASSEMBLY_DASHBOARD", details: { page: "Assembly Dashboard" } })
      .unwrap()
      .catch((err) => console.error("Failed to log page view:", err));
  }, [logAction]);

  // Full-width cards first so the half-width ones pair up without gaps; Unassigned stays last.
  const isWide = (section) => section.lines.length > WIDE_SECTION_LINE_COUNT;
  const orderedSections = useMemo(() => [...layoutSections].sort((a, b) =>
    Number(a.isUnassigned) - Number(b.isUnassigned) || Number(isWide(b)) - Number(isWide(a))
  ), [layoutSections]);

  const refreshAll = () => dispatch(dashboardApi.util.invalidateTags(["AssemblyStats"]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={brandLogoUrl} alt="FME" className="h-10 w-10 object-contain shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{t('assembly.title')}</h1>
            <p className="text-xs text-gray-500">{t('assembly.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={refreshAll}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <IconRefresh className="h-4 w-4" />
            {t('assembly.refresh')}
          </button>
          <DashboardClock />
        </div>
      </div>

      {isLoading ? (
        <ChartLoader minHeight="60vh" />
      ) : error && !data ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error?.data?.message || t('assembly.loadError')}
        </div>
      ) : (
        <div className="space-y-6">
          <AssemblyDepartmentChart defaultDate={defaultDate} />

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{t('assembly.sectionBreakdown')}</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {orderedSections.map(section => (
                <div
                  key={section.sectionId ?? "unassigned"}
                  className={isWide(section) ? "lg:col-span-2" : ""}
                >
                  <AssemblySectionLineChart
                    sectionId={section.sectionId}
                    sectionName={section.sectionName}
                    defaultDate={defaultDate}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssemblyDashboard;
