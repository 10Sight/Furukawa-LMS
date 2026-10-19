import brandLogoUrl from "@/assets/logos/fme-transparent.png";
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { IconClock } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate.js";
import EfficiencyChart from "@/components/common/charts/EfficiencyChart.jsx";
import { useLogActionMutation } from "@/services/api/AuditApi.js";

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

const ManpowerEfficiency = () => {
  const { t } = useTranslate();
  const [logAction] = useLogActionMutation();

  useEffect(() => {
    logAction({ action: "VIEW_MANPOWER_EFFICIENCY", details: { page: "Manpower Efficiency" } })
      .unwrap()
      .catch((err) => console.error("Failed to log page view:", err));
  }, [logAction]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={brandLogoUrl} alt="FME" className="h-10 w-10 object-contain shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{t('nav.manpowerEfficiency')}</h1>
            <p className="text-xs text-gray-500">{t('charts.manpowerEfficiencySubtitle')}</p>
          </div>
        </div>
        <DashboardClock />
      </div>

      <EfficiencyChart />
    </div>
  );
};

export default ManpowerEfficiency;
