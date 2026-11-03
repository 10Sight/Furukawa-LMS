import React, { useMemo, useState } from 'react';
import { BarChart3, Eye } from 'lucide-react';

import {
  aggregateSectionData,
  buildCombinedChartSlots,
  extractAvailableMonths
} from '../../pages/lpa/lpaGraphUtils.js';
import LpaPerformanceChartCard from './LpaPerformanceChartCard.jsx';

const DEFAULT_TARGET = 85;
const DEFAULT_DATE_RANGE = '30d';
const DEFAULT_TAB = 'assembly';
const EMPTY_RANGE = { from: '', to: '' };
const TARGET_STORAGE_KEYS = {
  assembly: 'lpa_target_benchmark_assembly',
  cc: 'lpa_target_benchmark_cc'
};

/**
 * LPA Analytics & Performance Graph shown inline on the LPA page.
 * Uses the page's already-loaded workbooks and its Unit dropdown; visible by default
 * with a Hide / Show toggle.
 */
export default function LpaGraphSection({ records = [], loading = false, selectedUnit, isAdmin = false }) {
  const [isVisible, setIsVisible] = useState(true);
  // '7d' | '14d' | '30d' | 'YYYY-MM' (specific month) | 'all' | 'custom'
  const [dateRange, setDateRange] = useState(DEFAULT_DATE_RANGE);
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB); // 'both' | 'assembly' | 'cc'
  const [customRange, setCustomRange] = useState(EMPTY_RANGE); // used when dateRange === 'custom'

  const monthOptions = useMemo(() => extractAvailableMonths(records), [records]);

  // Picking a preset or month clears the always-visible From / To inputs
  const handleDateRangeChange = (value) => {
    setDateRange(value);
    if (value !== 'custom') setCustomRange(EMPTY_RANGE);
  };

  // Typing a From / To date switches the Period to Custom straight away
  const handleCustomRangeChange = (range) => {
    setCustomRange(range);
    setDateRange(range.from || range.to ? 'custom' : DEFAULT_DATE_RANGE);
  };

  // Separate target benchmark per sheet ({ assembly, cc }), settable by Admin.
  // Falls back to the old shared 'lpa_target_benchmark' value saved before the split.
  const [targets, setTargets] = useState(() => {
    const read = (key) => {
      try {
        const saved = Number(localStorage.getItem(key));
        return saved >= 1 && saved <= 100 ? saved : null;
      } catch {
        return null;
      }
    };
    const legacy = read('lpa_target_benchmark') ?? DEFAULT_TARGET;
    return {
      assembly: read(TARGET_STORAGE_KEYS.assembly) ?? legacy,
      cc: read(TARGET_STORAGE_KEYS.cc) ?? legacy
    };
  });

  const handleTargetChange = (sheet, val) => {
    const num = Math.max(1, Math.min(100, Number(val) || DEFAULT_TARGET));
    setTargets(prev => ({ ...prev, [sheet]: num }));
    try {
      localStorage.setItem(TARGET_STORAGE_KEYS[sheet], String(num));
    } catch (err) {
      console.error(err);
    }
  };

  // No unit selected on the page -> show all units
  const unitFilter = selectedUnit || 'all';
  const unitLabel = selectedUnit || 'All Units';

  const assemblyData = useMemo(
    () => aggregateSectionData(records, 'assembly', unitFilter, dateRange, customRange),
    [records, unitFilter, dateRange, customRange]
  );

  const ccData = useMemo(
    () => aggregateSectionData(records, 'cc', unitFilter, dateRange, customRange),
    [records, unitFilter, dateRange, customRange]
  );

  const slots = useMemo(
    () => buildCombinedChartSlots(assemblyData.dailyData, ccData.dailyData, activeTab),
    [assemblyData, ccData, activeTab]
  );


  const totalSheets =
    (activeTab !== 'cc' ? assemblyData.summary.totalSheets : 0) +
    (activeTab !== 'assembly' ? ccData.summary.totalSheets : 0);

  const handleResetFilters = () => {
    setDateRange(DEFAULT_DATE_RANGE);
    setActiveTab(DEFAULT_TAB);
    setCustomRange(EMPTY_RANGE);
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
      totalSheets={totalSheets}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      unitLabel={unitLabel}
      dateRange={dateRange}
      onDateRangeChange={handleDateRangeChange}
      monthOptions={monthOptions}
      customRange={customRange}
      onCustomRangeChange={handleCustomRangeChange}
      targets={targets}
      onTargetChange={handleTargetChange}
      isAdmin={isAdmin}
      onReset={handleResetFilters}
      onHide={() => setIsVisible(false)}
    />
  );
}
