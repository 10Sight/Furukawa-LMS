import brandLogoUrl from "@/assets/logos/fme-transparent.png";
import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { IconClock, IconRefresh, IconCalendar, IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import { dashboardApi, useGetAssemblyDashboardStatsQuery } from "@/services/api/DashboardApi.js";
import { useLogActionMutation } from "@/services/api/AuditApi.js";
import AssemblyDepartmentChart from "@/components/dashboard/assembly/AssemblyDepartmentChart.jsx";
import AssemblySectionLineChart from "@/components/dashboard/assembly/AssemblySectionLineChart.jsx";
import { WIDE_SECTION_LINE_COUNT } from "@/components/dashboard/assembly/assemblyChartUtils.jsx";

const SHIFT_OPTIONS = ["ALL", "A", "B", "C", "G"];

// Dashboard days follow India time, same as the server.
const getIstDateString = (offsetDays = 0) => {
  const todayIst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [y, m, d] = todayIst.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return date.toISOString().slice(0, 10);
};

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

// FME logo, pulsing, centred while Assembly data loads
const LogoLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite" aria-label="Loading">
    <img src={brandLogoUrl} alt="" className="h-20 w-20 object-contain animate-pulse" />
  </div>
);

const Notice = ({ tone = "info", children }) => {
  const styles = tone === "warning"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-sky-200 bg-sky-50 text-sky-800";
  const Icon = tone === "info" ? IconInfoCircle : IconAlertTriangle;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
};

const QuickDateButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${active
      ? "bg-slate-900 text-white"
      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
  >
    {children}
  </button>
);

const AssemblyDashboard = () => {
  const { t } = useTranslate();
  const [logAction] = useLogActionMutation();

  const todayStr = getIstDateString(0);
  const yesterdayStr = getIstDateString(-1);
  const [date, setDate] = useState(yesterdayStr);
  const [shift, setShift] = useState("ALL");

  const { data, error, isFetching, refetch } = useGetAssemblyDashboardStatsQuery({ date, shift });
  const stats = data?.data;

  // Once a date has loaded, fetch its other shifts in the background so the
  // shift switch answers from cache instead of waiting on the server.
  const prefetchStats = dashboardApi.usePrefetch("getAssemblyDashboardStats");
  const loadedDate = stats?.date;
  useEffect(() => {
    if (!loadedDate) return;
    SHIFT_OPTIONS
      .filter(option => option !== shift)
      .forEach(option => prefetchStats({ date: loadedDate, shift: option }));
  }, [loadedDate, shift, prefetchStats]);

  useEffect(() => {
    logAction({ action: "VIEW_ASSEMBLY_DASHBOARD", details: { page: "Assembly Dashboard" } })
      .unwrap()
      .catch((err) => console.error("Failed to log page view:", err));
  }, [logAction]);

  const sections = useMemo(() => stats?.sections || [], [stats]);
  // Full-width cards first so the half-width ones pair up without gaps; Unassigned stays last.
  const isWide = (section) => section.lines.length > WIDE_SECTION_LINE_COUNT;
  const orderedSections = useMemo(() => [...sections].sort((a, b) =>
    Number(a.isUnassigned) - Number(b.isUnassigned) || Number(isWide(b)) - Number(isWide(a))
  ), [sections]);
  const showNoAttendance = stats && !stats.holiday && stats.attendanceRecords === 0;

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
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <IconCalendar className="h-4 w-4 text-slate-400" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">{t('assembly.date')}</span>
          <input
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-32 cursor-pointer bg-transparent text-[13px] text-slate-700 outline-none"
          />
        </label>
        <QuickDateButton active={date === yesterdayStr} onClick={() => setDate(yesterdayStr)}>{t('assembly.yesterday')}</QuickDateButton>
        <QuickDateButton active={date === todayStr} onClick={() => setDate(todayStr)}>{t('assembly.today')}</QuickDateButton>

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
          onClick={refetch}
          disabled={isFetching}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <IconRefresh className="h-4 w-4" />
          {t('assembly.refresh')}
        </button>
      </div>

      {error && <Notice tone="error">{error?.data?.message || t('assembly.loadError')}</Notice>}
      {!isFetching && stats?.holiday && <Notice tone="warning">{stats.date} ({stats.holiday.name}) {t('assembly.holidayNotice')}</Notice>}
      {!isFetching && showNoAttendance && <Notice tone="warning">{t('assembly.noAttendance')}</Notice>}
      {!isFetching && stats && shift !== "ALL" && <Notice>{t('assembly.shiftNote')}</Notice>}

      {isFetching ? (
        <LogoLoader />
      ) : stats && (
        <div className="space-y-6">
          <AssemblyDepartmentChart department={stats.department} sections={sections} />

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{t('assembly.sectionBreakdown')}</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {orderedSections.map(section => (
                <div
                  key={section.sectionId ?? "unassigned"}
                  className={isWide(section) ? "lg:col-span-2" : ""}
                >
                  <AssemblySectionLineChart section={section} />
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
