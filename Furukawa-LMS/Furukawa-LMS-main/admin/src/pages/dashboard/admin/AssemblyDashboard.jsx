import brandLogoUrl from "@/assets/logos/fme-transparent.png";
import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch } from "react-redux";
import { format } from 'date-fns';
import { IconClock, IconRefresh, IconInfoCircle } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { dashboardApi, useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import { useLogActionMutation } from "@/services/api/AuditApi.js";
import AssemblyDepartmentChart from "@/components/dashboard/assembly/AssemblyDepartmentChart.jsx";
import AssemblySectionLineChart from "@/components/dashboard/assembly/AssemblySectionLineChart.jsx";
import { ChartLoader } from "@/components/dashboard/assembly/assemblyChartShared.jsx";
import {
  SHIFT_OPTIONS, WIDE_SECTION_LINE_COUNT, getIstDateString,
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

  // Every chart owns its date and starts on yesterday; the shift applies to all of them.
  const [defaultDate] = useState(() => getIstDateString(-1));
  const [shift, setShift] = useState("ALL");

  // The default-date result decides which section cards exist and how wide they are.
  // `data` keeps the previous result while a new shift loads, so cards don't vanish.
  const { data, error, isLoading } = useGetAssemblyDashboardStatsQuery({ date: defaultDate, shift });
  const layoutSections = useMemo(() => data?.data?.sections || [], [data]);

  // Fetch the default date's other shifts in the background so the shift switch
  // answers from cache instead of waiting on the server.
  const prefetchStats = dashboardApi.usePrefetch("getAssemblyDashboardStats");
  const layoutLoaded = Boolean(data);
  useEffect(() => {
    if (!layoutLoaded) return;
    SHIFT_OPTIONS
      .filter(option => option !== shift)
      .forEach(option => prefetchStats({ date: defaultDate, shift: option }));
  }, [layoutLoaded, defaultDate, shift, prefetchStats]);

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
        <DashboardClock />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label={t('assembly.shift')}>
          <span className="px-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">{t('assembly.shift')}</span>
          {SHIFT_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setShift(option)}
              aria-pressed={shift === option}
              title={option === "ALL" ? t('assembly.allShifts') : `${t('assembly.shift')} ${option}`}
              className={`min-w-[36px] rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${shift === option
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"}`}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={refreshAll}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <IconRefresh className="h-4 w-4" />
          {t('assembly.refresh')}
        </button>
      </div>

      {shift !== "ALL" && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-800">
          <IconInfoCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('assembly.shiftNote')}</span>
        </div>
      )}

      {isLoading ? (
        <ChartLoader minHeight="60vh" />
      ) : error && !data ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error?.data?.message || t('assembly.loadError')}
        </div>
      ) : (
        <div className="space-y-6">
          <AssemblyDepartmentChart shift={shift} defaultDate={defaultDate} />

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
                    shift={shift}
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
