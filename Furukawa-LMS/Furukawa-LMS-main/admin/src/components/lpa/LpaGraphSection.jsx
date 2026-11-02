import React, { useMemo, useState } from 'react';
import { BarChart3, Eye } from 'lucide-react';

import {
  aggregateSectionData,
  buildCombinedChartSlots,
  buildCombinedTableRows
} from '../../pages/lpa/lpaGraphUtils.js';
import LpaPerformanceChartCard from './LpaPerformanceChartCard.jsx';

const DEFAULT_TARGET = 85;
const DEFAULT_DATE_RANGE = '30d';
const DEFAULT_TAB = 'assembly';

/**
 * LPA Analytics & Performance Graph shown inline on the LPA page.
 * Uses the page's already-loaded workbooks and its Unit dropdown; visible by default
 * with a Hide / Show toggle.
 */
export default function LpaGraphSection({ records = [], loading = false, selectedUnit, isAdmin = false }) {
  const [isVisible, setIsVisible] = useState(true);
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE); // '7d' | '14d' | '30d' | 'month' | 'all'
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB); // 'both' | 'assembly' | 'cc'

  // Target Benchmark line settable by Admin
  const [targetBenchmark, setTargetBenchmark] = useState(() => {
    try {
      const saved = localStorage.getItem('lpa_target_benchmark');
      return saved ? Number(saved) : DEFAULT_TARGET;
    } catch {
      return DEFAULT_TARGET;
    }
  });

  const handleTargetBenchmarkChange = (val) => {
    const num = Math.max(1, Math.min(100, Number(val) || DEFAULT_TARGET));
    setTargetBenchmark(num);
    try {
      localStorage.setItem('lpa_target_benchmark', String(num));
    } catch (err) {
      console.error(err);
    }
  };

  // No unit selected on the page -> show all units
  const unitFilter = selectedUnit || 'all';
  const unitLabel = selectedUnit || 'All Units';

  const assemblyData = useMemo(
    () => aggregateSectionData(records, 'assembly', unitFilter, dateRange),
    [records, unitFilter, dateRange]
  );

  const ccData = useMemo(
    () => aggregateSectionData(records, 'cc', unitFilter, dateRange),
    [records, unitFilter, dateRange]
  );

  const slots = useMemo(
    () => buildCombinedChartSlots(assemblyData.dailyData, ccData.dailyData, activeTab),
    [assemblyData, ccData, activeTab]
  );

  const tableRows = useMemo(
    () => buildCombinedTableRows(assemblyData.dailyData, ccData.dailyData, activeTab),
    [assemblyData, ccData, activeTab]
  );

  const totalSheets =
    (activeTab !== 'cc' ? assemblyData.summary.totalSheets : 0) +
    (activeTab !== 'assembly' ? ccData.summary.totalSheets : 0);

  const handleResetFilters = () => {
    setDateRange(DEFAULT_DATE_RANGE);
    setActiveTab(DEFAULT_TAB);
  };

  if (!isVisible) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BarChart3 size={16} className="text-blue-600" />
          LPA Analytics & Performance Graph
          <span className="text-xs font-normal text-slate-400">(hidden)</span>
        </span>
        <button
          type="button"
          onClick={() => setIsVisible(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          title="Show graph"
        >
          <Eye size={14} />
          Show Graph
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-sm font-medium text-slate-500 shadow-xs">
        Compiling LPA graph…
      </div>
    );
  }

  return (
    <LpaPerformanceChartCard
      slots={slots}
      tableRows={tableRows}
      totalSheets={totalSheets}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      unitLabel={unitLabel}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      targetBenchmark={targetBenchmark}
      onTargetChange={handleTargetBenchmarkChange}
      isAdmin={isAdmin}
      onReset={handleResetFilters}
      onHide={() => setIsVisible(false)}
    />
  );
}
