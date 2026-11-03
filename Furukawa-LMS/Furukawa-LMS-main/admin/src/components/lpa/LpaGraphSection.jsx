import React, { useMemo, useState } from 'react';

import {
  aggregateSectionData,
  buildCombinedChartSlots
} from '../../pages/lpa/lpaGraphUtils.js';
import LpaPerformanceChartCard from './LpaPerformanceChartCard.jsx';

const DEFAULT_TARGET = 85;
const DEFAULT_PERIOD = 'daily';
const DEFAULT_TAB = 'assembly';

// Period -> default date window and bar grouping.
// Daily: each day of the current month. Monthly: each month of the current year.
// Yearly: each year on record. A Custom From / To range replaces the default window.
const PERIODS = {
  daily: { range: 'month', groupBy: 'day' },
  monthly: { range: 'year', groupBy: 'month' },
  yearly: { range: 'all', groupBy: 'year' }
};
const EMPTY_RANGE = { from: '', to: '' };
const TARGET_STORAGE_KEYS = {
  assembly: 'lpa_target_benchmark_assembly',
  cc: 'lpa_target_benchmark_cc'
};

/**
 * LPA Analytics & Performance Graph shown inline on the LPA page.
 * Uses the page's already-loaded workbooks and its Unit dropdown; always visible.
 */
export default function LpaGraphSection({ records = [], loading = false, selectedUnit, isAdmin = false }) {
  const [period, setPeriod] = useState(DEFAULT_PERIOD); // 'daily' | 'monthly' | 'yearly'
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB); // 'both' | 'assembly' | 'cc'
  const [customRange, setCustomRange] = useState(EMPTY_RANGE); // optional From / To window

  const { range: periodRange, groupBy } = PERIODS[period] || PERIODS[DEFAULT_PERIOD];
  const hasCustomRange = Boolean(customRange.from || customRange.to);
  const dateRange = hasCustomRange ? 'custom' : periodRange;

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
    () => aggregateSectionData(records, 'assembly', unitFilter, dateRange, customRange, new Date(), groupBy),
    [records, unitFilter, dateRange, customRange, groupBy]
  );

  const ccData = useMemo(
    () => aggregateSectionData(records, 'cc', unitFilter, dateRange, customRange, new Date(), groupBy),
    [records, unitFilter, dateRange, customRange, groupBy]
  );

  const slots = useMemo(
    () => buildCombinedChartSlots(assemblyData.dailyData, ccData.dailyData, activeTab),
    [assemblyData, ccData, activeTab]
  );

  const totalSheets =
    (activeTab !== 'cc' ? assemblyData.summary.totalSheets : 0) +
    (activeTab !== 'assembly' ? ccData.summary.totalSheets : 0);

  const handleResetFilters = () => {
    setPeriod(DEFAULT_PERIOD);
    setActiveTab(DEFAULT_TAB);
    setCustomRange(EMPTY_RANGE);
  };

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
      period={period}
      onPeriodChange={setPeriod}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
      targets={targets}
      onTargetChange={handleTargetChange}
      isAdmin={isAdmin}
      onReset={handleResetFilters}
    />
  );
}
