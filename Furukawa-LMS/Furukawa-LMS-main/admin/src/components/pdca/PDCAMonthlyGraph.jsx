import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  ChevronUp,
  ChevronDown,
  Calendar,
  Filter,
  Info,
  Columns,
  X
} from 'lucide-react';
import { normalizePDCAStatus } from '../../pages/pdca/data/pdcaConstants.js';

/**
 * PDCAMonthlyGraph (Daily & Monthly PDCA Status Graph)
 * Displays interactive daily and monthly analytics for:
 *  - In-Progress
 *  - Done
 *  - Delay
 *  - Not-Started
 *
 * Rules:
 *  - If a series has no data (count is 0) on a given day/month, the bar line for that
 *    series will NOT be drawn. Only series with data (> 0) are rendered in the graph.
 *  - Default view is Daily breakdown for the selected month/year.
 *  - Supports Grouped Bars, Stacked Bars, and Trend Lines.
 *  - Scope toggling (This Sheet vs All PDCA Sheets).
 */
export default function PDCAMonthlyGraph({
  rows = [],
  allPDCARecords = [],
  currentDate = '',
  topic = null,
  isCollapsed = false,
  onToggleCollapse
}) {
  const [viewTimeframe, setViewTimeframe] = useState('daily'); // 'daily' | 'monthly'
  const [chartType, setChartType] = useState('stacked'); // default to 'stacked' (single candle per date)
  const [dataScope, setDataScope] = useState('sheet'); // 'sheet' | 'all'
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showCumulativeSection, setShowCumulativeSection] = useState(true);

  // Active series visibility toggles
  const [visibleSeries, setVisibleSeries] = useState({
    inProgress: true,
    done: true,
    delay: true,
    notStarted: true
  });

  const toggleSeries = (key) => {
    setVisibleSeries(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Prevent unchecking all series
      if (!next.inProgress && !next.done && !next.delay && !next.notStarted) return prev;
      return next;
    });
  };

  // Determine baseline year & month, plus current date and real today date strings
  const { defaultYear, defaultMonth, targetTodayStr, realTodayStr } = useMemo(() => {
    let d = new Date();
    if (currentDate) {
      const parsed = new Date(currentDate);
      if (!isNaN(parsed.getTime())) d = parsed;
    } else if (topic?.date) {
      const parsed = new Date(topic.date);
      if (!isNaN(parsed.getTime())) d = parsed;
    }

    const sysD = new Date();
    const pad = (n) => String(n).padStart(2, '0');

    return {
      defaultYear: d.getFullYear(),
      defaultMonth: d.getMonth(), // 0-11
      targetTodayStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      realTodayStr: `${sysD.getFullYear()}-${pad(sysD.getMonth() + 1)}-${pad(sysD.getDate())}`
    };
  }, [currentDate, topic?.date]);

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Extract all valid/active rows based on dataScope
  const activeItems = useMemo(() => {
    const parseRow = (r, defaultDateStr) => {
      // Determine if row is active (has some data filled in)
      const hasContent = Boolean(
        r.observation ||
        r.counterMeasure ||
        r.rootCause ||
        r.lineArea ||
        r.department ||
        r.staffEmployee ||
        r.date ||
        r.responseDate ||
        r.status
      );
      if (!hasContent && !r.date) return null;

      // Parse date
      let dateStr = r.date || defaultDateStr || currentDate || new Date().toISOString().slice(0, 10);
      let parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        const parts = String(dateStr).split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            parsedDate = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
          } else {
            parsedDate = new Date(parts[2], parseInt(parts[1], 10) - 1, parts[0]);
          }
        }
      }

      const year = !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : defaultYear;
      const month = !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : defaultMonth;
      const day = !isNaN(parsedDate.getTime()) ? parsedDate.getDate() : 1;

      // Formatted YYYY-MM-DD
      const yStr = String(year);
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const fullDateStr = `${yStr}-${mStr}-${dStr}`;

      const rawStatus = normalizePDCAStatus(r.status);
      let category = 'notStarted';
      if (rawStatus === 'Done') category = 'done';
      else if (rawStatus === 'In- Progress') category = 'inProgress';
      else if (rawStatus === 'Delay') category = 'delay';
      else category = 'notStarted';

      return {
        year,
        month,
        day,
        fullDateStr,
        status: rawStatus,
        category
      };
    };

    if (dataScope === 'sheet') {
      const list = [];
      (rows || []).forEach(r => {
        const item = parseRow(r, currentDate || topic?.date);
        if (item) list.push(item);
      });
      return list;
    } else {
      const list = [];
      (allPDCARecords || []).forEach(record => {
        const recDefaultDate = record.date || currentDate;
        const sheetRows = record.sheet?.rows || record.rows || [];
        if (sheetRows.length > 0) {
          sheetRows.forEach(r => {
            const item = parseRow(r, recDefaultDate);
            if (item) list.push(item);
          });
        } else if (record.topic || record.date) {
          const item = parseRow({ status: record.status || 'Not-Started', date: record.date }, recDefaultDate);
          if (item) list.push(item);
        }
      });
      return list;
    }
  }, [rows, allPDCARecords, dataScope, currentDate, topic?.date, defaultYear, defaultMonth]);

  // Discover all distinct years available in dataset
  const availableYears = useMemo(() => {
    const set = new Set([defaultYear, new Date().getFullYear()]);
    activeItems.forEach(i => set.add(i.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [activeItems, defaultYear]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Number of days in selected month
  const daysInSelectedMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Daily statistics for selectedMonth & selectedYear
  const dailyStats = useMemo(() => {
    // Cumulative entry for past month
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const prevMonthName = monthNames[prevMonth];

    const pastCumulative = {
      isPastMonthCumulative: true,
      day: 0,
      label: `${prevMonthName} Cumul`,
      fullDateStr: `Past Month (${fullMonthNames[prevMonth]} ${prevYear})`,
      inProgress: 0,
      done: 0,
      delay: 0,
      notStarted: 0,
      total: 0
    };

    activeItems.forEach(item => {
      if (item.year === prevYear && item.month === prevMonth) {
        pastCumulative.total += 1;
        if (item.category === 'inProgress') pastCumulative.inProgress += 1;
        else if (item.category === 'done') pastCumulative.done += 1;
        else if (item.category === 'delay') pastCumulative.delay += 1;
        else pastCumulative.notStarted += 1;
      }
    });

    const data = [pastCumulative];
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dateKey = `${selectedYear}-${mStr}-${dStr}`;
      const isCurrentDate = (dateKey === targetTodayStr || dateKey === realTodayStr);

      data.push({
        isPastMonthCumulative: false,
        isCurrentDate,
        day: d,
        label: `${d} ${monthNames[selectedMonth]}`,
        fullDateStr: dateKey,
        inProgress: 0,
        done: 0,
        delay: 0,
        notStarted: 0,
        total: 0
      });
    }

    activeItems.forEach(item => {
      if (item.year === selectedYear && item.month === selectedMonth) {
        // Since pastCumulative is at index 0, day 1 is at index 1: item.day
        const dayIdx = item.day;
        if (dayIdx >= 1 && dayIdx < data.length) {
          data[dayIdx].total += 1;
          if (item.category === 'inProgress') data[dayIdx].inProgress += 1;
          else if (item.category === 'done') data[dayIdx].done += 1;
          else if (item.category === 'delay') data[dayIdx].delay += 1;
          else data[dayIdx].notStarted += 1;
        }
      }
    });

    return data;
  }, [activeItems, selectedYear, selectedMonth, daysInSelectedMonth, targetTodayStr, realTodayStr]);

  // Monthly statistics for selectedYear
  const monthlyStats = useMemo(() => {
    const data = monthNames.map((name, idx) => ({
      month: name,
      fullName: fullMonthNames[idx],
      label: name,
      monthIndex: idx,
      inProgress: 0,
      done: 0,
      delay: 0,
      notStarted: 0,
      total: 0
    }));

    activeItems.forEach(item => {
      if (item.year === selectedYear) {
        if (item.month >= 0 && item.month < 12) {
          data[item.month].total += 1;
          if (item.category === 'inProgress') data[item.month].inProgress += 1;
          else if (item.category === 'done') data[item.month].done += 1;
          else if (item.category === 'delay') data[item.month].delay += 1;
          else data[item.month].notStarted += 1;
        }
      }
    });

    return data;
  }, [activeItems, selectedYear]);

  // Live Cumulative (Sum of All Months) for selectedYear
  const allMonthsCumulative = useMemo(() => {
    return monthlyStats.reduce(
      (acc, m) => ({
        total: acc.total + m.total,
        inProgress: acc.inProgress + m.inProgress,
        done: acc.done + m.done,
        delay: acc.delay + m.delay,
        notStarted: acc.notStarted + m.notStarted
      }),
      { total: 0, inProgress: 0, done: 0, delay: 0, notStarted: 0 }
    );
  }, [monthlyStats]);


  // Current active dataset depending on timeframe
  const currentDataset = viewTimeframe === 'daily' ? dailyStats : monthlyStats;

  // Overall KPIs for current timeframe view (computed over raw non-duplicated stats)
  const kpis = useMemo(() => {
    const baseData = viewTimeframe === 'daily' ? dailyStats : monthlyStats;
    let total = 0;
    let inProgress = 0;
    let done = 0;
    let delay = 0;
    let notStarted = 0;

    baseData.forEach(d => {
      // Exclude past month cumulative from current month's KPI totals
      if (viewTimeframe === 'daily' && d.isPastMonthCumulative) return;
      total += d.total;
      inProgress += d.inProgress;
      done += d.done;
      delay += d.delay;
      notStarted += d.notStarted;
    });

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const delayRate = total > 0 ? Math.round((delay / total) * 100) : 0;

    return { total, inProgress, done, delay, notStarted, completionRate, delayRate };
  }, [viewTimeframe, dailyStats, monthlyStats]);

  // Max value for chart Y-axis scaling
  const maxChartValue = useMemo(() => {
    let max = 0;
    currentDataset.forEach(item => {
      if (chartType === 'stacked') {
        let stackTotal = 0;
        if (visibleSeries.inProgress) stackTotal += item.inProgress;
        if (visibleSeries.done) stackTotal += item.done;
        if (visibleSeries.delay) stackTotal += item.delay;
        if (visibleSeries.notStarted) stackTotal += item.notStarted;
        if (stackTotal > max) max = stackTotal;
      } else {
        if (visibleSeries.inProgress && item.inProgress > max) max = item.inProgress;
        if (visibleSeries.done && item.done > max) max = item.done;
        if (visibleSeries.delay && item.delay > max) max = item.delay;
        if (visibleSeries.notStarted && item.notStarted > max) max = item.notStarted;
      }
    });
    // Ensure at least 4 for pleasant grid spacing
    if (max <= 4) return 5;
    // Round up to nearest multiple of 5
    return Math.ceil(max / 5) * 5;
  }, [currentDataset, chartType, visibleSeries]);

  // SVG Chart Geometry
  const slotCount = currentDataset.length;
  const minSlotWidth = viewTimeframe === 'daily' ? 52 : 70;
  const padding = { top: 30, right: 25, bottom: 60, left: 45 };
  const graphWidth = Math.max(880, slotCount * minSlotWidth);
  const svgWidth = graphWidth + padding.left + padding.right;
  const svgHeight = 385;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Y-Scale helper
  const getY = (val) => {
    return padding.top + graphHeight - (val / maxChartValue) * graphHeight;
  };

  // X-Scale helper
  const slotWidth = graphWidth / slotCount;
  const getXCenter = (idx) => padding.left + idx * slotWidth + slotWidth / 2;

  // Grid tick levels
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      const val = Math.round((maxChartValue / count) * i);
      ticks.push(val);
    }
    return ticks;
  }, [maxChartValue]);

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all duration-200 mb-3 animate-in fade-in">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>{viewTimeframe === 'daily' ? 'Daily PDCA Status Graph' : 'Monthly PDCA Status Graph'}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {viewTimeframe === 'daily' ? `${fullMonthNames[selectedMonth]} ${selectedYear}` : selectedYear}
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              {viewTimeframe === 'daily'
                ? `Daily breakdown for ${fullMonthNames[selectedMonth]} ${selectedYear} (In-Progress, Done, Delay, Not-Started)`
                : `Monthly breakdown for ${selectedYear} (In-Progress, Done, Delay, Not-Started)`}
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Timeframe Toggle: Daily vs Monthly */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/80">
            <button
              type="button"
              onClick={() => setViewTimeframe('daily')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                viewTimeframe === 'daily'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show daily observations for the selected month"
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setViewTimeframe('monthly')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                viewTimeframe === 'monthly'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show monthly observations for the selected year"
            >
              Monthly
            </button>
          </div>

          {/* Month Select (Only in Daily view) */}
          {viewTimeframe === 'daily' && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-700 cursor-pointer pr-1"
                aria-label="Select month"
              >
                {monthNames.map((m, idx) => (
                  <option key={m} value={idx}>{fullMonthNames[idx]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Year Select */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-700 cursor-pointer pr-1"
              aria-label="Select year"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Data Scope Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/80">
            <button
              type="button"
              onClick={() => setDataScope('sheet')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                dataScope === 'sheet'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show observations for this sheet only"
            >
              This Sheet ({activeItems.length})
            </button>
            <button
              type="button"
              onClick={() => setDataScope('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                dataScope === 'all'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Show observations across all PDCA forms in system"
            >
              All Sheets
            </button>
          </div>

          {/* Chart View Mode */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/80">
            <button
              type="button"
              onClick={() => setChartType('stacked')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                chartType === 'stacked' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Single candle per date showing In-Progress, Done, Delay, Not-Started"
            >
              Single Candle
            </button>
            <button
              type="button"
              onClick={() => setChartType('grouped')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                chartType === 'grouped' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grouped bar chart"
            >
              Bars
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                chartType === 'line' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Line trend chart"
            >
              Lines
            </button>
          </div>

          {/* Toggle Cumulative Section */}
          <button
            type="button"
            onClick={() => setShowCumulativeSection(prev => !prev)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 border ${
              showCumulativeSection
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title={showCumulativeSection ? 'Hide Cumulative section' : 'Show Cumulative section'}
          >
            <Columns className="w-3.5 h-3.5 text-indigo-600" />
            <span>{showCumulativeSection ? 'Hide Cumulative' : 'Show Cumulative'}</span>
          </button>

          {/* Collapse/Expand Toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand graph' : 'Collapse graph'}
            >
              {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Interactive Chart Container */}
          <div className="bg-slate-50/50 rounded-xl border border-slate-200/80 p-3 relative">
            <div className="flex flex-col md:flex-row items-stretch gap-3">
              {/* Cumulative Section (Month and its Cumulative) */}
              {showCumulativeSection && (
                <div className="w-full md:w-36 lg:w-40 shrink-0 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col overflow-hidden animate-in fade-in duration-150">
                  <div className="px-2.5 py-1.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Cumulative
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {selectedYear}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCumulativeSection(false)}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                        title="Hide Cumulative panel"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 px-2.5 py-1 bg-slate-50/80 border-b border-slate-200/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Month</span>
                    <span className="text-right">Cumulative</span>
                  </div>
                  <div className="flex-1 divide-y divide-slate-100 text-xs overflow-y-auto max-h-[260px] md:max-h-none">
                    {monthlyStats.map((m, idx) => {
                      const isSelected = viewTimeframe === 'daily' && selectedMonth === idx;
                      return (
                        <div
                          key={m.month}
                          onClick={() => {
                            if (viewTimeframe === 'daily') setSelectedMonth(idx);
                          }}
                          className={`grid grid-cols-2 px-2.5 py-1 items-center transition-colors ${
                            viewTimeframe === 'daily' ? 'cursor-pointer' : ''
                          } ${
                            isSelected
                              ? 'bg-indigo-50 font-bold text-indigo-900'
                              : m.total > 0
                              ? 'hover:bg-slate-50 text-slate-800'
                              : 'hover:bg-slate-50 text-slate-500'
                          }`}
                          title={viewTimeframe === 'daily' ? `Switch to ${m.fullName}` : `${m.fullName}`}
                        >
                          <span className="text-xs truncate">{m.month}</span>
                          <span className={`text-right font-mono text-xs font-semibold ${
                            m.total > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'
                          }`}>
                            {m.total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 px-2.5 py-1.5 bg-slate-100 border-t border-slate-200 text-xs font-bold text-slate-800">
                    <span>Total</span>
                    <span className="text-right font-mono text-indigo-700">{allMonthsCumulative.total}</span>
                  </div>
                </div>
              )}

              {/* Right Column: Metrics Row & SVG Graph */}
              <div className="flex-1 min-w-0 flex flex-col">
                {/* Chart Series Legend & Filter Toggles */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-200/60 text-xs">
                  <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Metrics:</span>

                {/* In-Progress Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('inProgress')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.inProgress
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                  title="Toggle In-Progress series"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>In-Progress</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-200/60 font-bold">{kpis.inProgress}</span>
                </button>

                {/* Done Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('done')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.done
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                  title="Toggle Done series"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                  <span>Done</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-200/60 font-bold">{kpis.done}</span>
                </button>

                {/* Delay Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('delay')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.delay
                      ? 'bg-rose-100 text-rose-900 border border-rose-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                  title="Toggle Delay series"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
                  <span>Delay</span>
                  <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                    kpis.delay > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-200/60 text-slate-600'
                  }`}>
                    {kpis.delay}
                  </span>
                </button>

                {/* Not-Started Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('notStarted')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.notStarted
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                  title="Toggle Not-Started series"
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                  <span>Not-Started</span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-blue-200/60 font-bold">{kpis.notStarted}</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>
                  {viewTimeframe === 'daily'
                    ? 'Bars only show when data exists (> 0). Hover over any day to inspect details'
                    : 'Hover over any month to inspect details'}
                </span>
              </div>
            </div>

            {/* SVG Graph View inside horizontal scroll */}
            <div className="w-full overflow-x-auto pb-3.5 pt-1 flex-1 flex flex-col justify-end">
              <div style={{ minWidth: `${Math.max(680, svgWidth)}px` }} className="flex-1 flex flex-col mb-1.5">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto select-none flex-1"
                  style={{ minHeight: '365px' }}
                >
                  <defs>
                    <linearGradient id="inProgressGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <linearGradient id="doneGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="delayGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" />
                      <stop offset="100%" stopColor="#DC2626" />
                    </linearGradient>
                    <linearGradient id="notStartedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines & Y-Axis Labels */}
                  {yTicks.map((val, i) => {
                    const y = getY(val);
                    return (
                      <g key={i}>
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgWidth - padding.right}
                          y2={y}
                          stroke="#E2E8F0"
                          strokeDasharray={val === 0 ? 'none' : '3 3'}
                          strokeWidth="1"
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] fill-slate-400 font-mono font-medium"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Columns (Days or Months) & Bars */}
                  {currentDataset.map((item, idx) => {
                    const xCenter = getXCenter(idx);
                    const isHovered = hoveredIndex === idx;
                    const colX = padding.left + idx * slotWidth;

                    // Collect bars that have data (> 0) and are enabled
                    // Rule: If series has no data (count === 0), do NOT show the bar line!
                    const activeBarsForSlot = [];
                    if (visibleSeries.inProgress && item.inProgress > 0) {
                      activeBarsForSlot.push({
                        key: 'inProgress',
                        val: item.inProgress,
                        grad: 'url(#inProgressGrad)',
                        textClass: 'fill-amber-700'
                      });
                    }
                    if (visibleSeries.done && item.done > 0) {
                      activeBarsForSlot.push({
                        key: 'done',
                        val: item.done,
                        grad: 'url(#doneGrad)',
                        textClass: 'fill-emerald-700'
                      });
                    }
                    if (visibleSeries.delay && item.delay > 0) {
                      activeBarsForSlot.push({
                        key: 'delay',
                        val: item.delay,
                        grad: 'url(#delayGrad)',
                        textClass: 'fill-rose-700'
                      });
                    }
                    if (visibleSeries.notStarted && item.notStarted > 0) {
                      activeBarsForSlot.push({
                        key: 'notStarted',
                        val: item.notStarted,
                        grad: 'url(#notStartedGrad)',
                        textClass: 'fill-blue-700'
                      });
                    }

                    // Dynamic bar sizing based on number of active bars
                    const barCount = activeBarsForSlot.length;
                    const maxBarGroupW = slotWidth * 0.82;
                    const barGap = 3;
                    const calculatedBarW = barCount > 0
                      ? Math.min(18, Math.max(5, (maxBarGroupW - (barCount - 1) * barGap) / barCount))
                      : 0;
                    const totalBarsW = barCount > 0 ? barCount * calculatedBarW + (barCount - 1) * barGap : 0;
                    const barStartX = xCenter - totalBarsW / 2;

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="cursor-pointer"
                      >
                        {/* Hover Column Background Highlight (Full height to prevent hover gaps) */}
                        <rect
                          x={colX + 1}
                          y={padding.top}
                          width={slotWidth - 2}
                          height={graphHeight + padding.bottom - 4}
                          fill={
                            isHovered
                              ? 'rgba(59, 130, 246, 0.12)'
                              : item.isCurrentDate
                              ? 'rgba(59, 130, 246, 0.06)'
                              : item.isPastMonthCumulative
                              ? 'rgba(99, 102, 241, 0.06)'
                              : 'transparent'
                          }
                          stroke={
                            item.isCurrentDate
                              ? 'rgba(59, 130, 246, 0.35)'
                              : item.isPastMonthCumulative
                              ? 'rgba(99, 102, 241, 0.25)'
                              : 'none'
                          }
                          strokeDasharray={
                            item.isCurrentDate
                              ? '3 2'
                              : item.isPastMonthCumulative
                              ? '3 3'
                              : 'none'
                          }
                          rx="4"
                          className="transition-colors duration-100"
                        />

                        {/* Chart Render: Grouped Bars */}
                        {chartType === 'grouped' && barCount > 0 && (
                          <g>
                            {activeBarsForSlot.map((b, bIdx) => {
                              const bx = barStartX + bIdx * (calculatedBarW + barGap);
                              const by = getY(b.val);
                              const bh = Math.max(2, graphHeight - (by - padding.top));

                              return (
                                <g key={b.key}>
                                  <rect
                                    x={bx}
                                    y={by}
                                    width={calculatedBarW}
                                    height={bh}
                                    fill={b.grad}
                                    rx="2.5"
                                    className="transition-all duration-200 hover:brightness-110"
                                  />
                                  {/* Value label above bar */}
                                  <text
                                    x={bx + calculatedBarW / 2}
                                    y={by - 3}
                                    textAnchor="middle"
                                    className={`text-[9px] font-bold ${b.textClass} font-mono`}
                                  >
                                    {b.val}
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        )}

                        {/* Chart Render: Stacked Bars (Single Candle) */}
                        {chartType === 'stacked' && barCount > 0 && (
                          <g>
                            {(() => {
                              const stackW = Math.min(26, Math.max(16, slotWidth * 0.6));
                              const baseY = padding.top + graphHeight;
                              let accumulatedH = 0;

                              return (
                                <g>
                                  {activeBarsForSlot.map((b) => {
                                    const segmentH = graphHeight - (getY(b.val) - padding.top);
                                    const sy = baseY - accumulatedH - segmentH;
                                    accumulatedH += segmentH;

                                    return (
                                      <rect
                                        key={b.key}
                                        x={xCenter - stackW / 2}
                                        y={sy}
                                        width={stackW}
                                        height={segmentH}
                                        fill={b.grad}
                                        rx={accumulatedH >= graphHeight - 4 ? 3 : 0}
                                      />
                                    );
                                  })}
                                  {/* Stack Total */}
                                  <text
                                    x={xCenter}
                                    y={baseY - accumulatedH - 4}
                                    textAnchor="middle"
                                    className={`text-[9.5px] font-bold font-mono ${
                                      item.isPastMonthCumulative ? 'fill-indigo-700 font-extrabold' : 'fill-slate-700'
                                    }`}
                                  >
                                    {item.total}
                                  </text>
                                </g>
                              );
                            })()}
                          </g>
                        )}

                        {/* Current Date Badge Indicator (Behind Label) */}
                        {item.isCurrentDate && (
                          <rect
                            x={xCenter - 24}
                            y={svgHeight - 37}
                            width="48"
                            height="20"
                            rx="5"
                            fill="#EFF6FF"
                            stroke="#3B82F6"
                            strokeWidth="1.5"
                          />
                        )}

                        {/* X-Axis Label (e.g. '18 Oct' or 'Sep Cumul' or Month name) */}
                        <text
                          x={xCenter}
                          y={svgHeight - 23}
                          textAnchor="middle"
                          className={`text-[11.5px] tracking-tight transition-colors ${
                            item.isCurrentDate
                              ? 'fill-blue-700 font-black'
                              : item.isPastMonthCumulative
                              ? 'fill-indigo-700 font-extrabold'
                              : isHovered
                              ? 'fill-blue-600 font-bold'
                              : item.total > 0
                              ? 'fill-slate-800 font-bold'
                              : 'fill-slate-400 font-semibold'
                          }`}
                        >
                          {item.label}
                        </text>

                        {/* Dot indicator if day/month has data */}
                        {item.total > 0 && (
                          <circle
                            cx={xCenter}
                            cy={svgHeight - 9}
                            r="2"
                            fill={
                              item.isCurrentDate
                                ? '#2563EB'
                                : item.isPastMonthCumulative
                                ? '#6366F1'
                                : isHovered
                                ? '#2563EB'
                                : item.delay > 0
                                ? '#EF4444'
                                : '#94A3B8'
                            }
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Chart Render: Trend Lines (Only plotted if category has > 0 data) */}
                  {chartType === 'line' && (
                    <g>
                      {/* In-Progress Line */}
                      {visibleSeries.inProgress && kpis.inProgress > 0 && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={currentDataset
                              .map((m, i) => `${getXCenter(i)},${getY(m.inProgress)}`)
                              .join(' ')}
                          />
                          {currentDataset.map((m, i) => m.inProgress > 0 && (
                            <circle
                              key={`ip-${i}`}
                              cx={getXCenter(i)}
                              cy={getY(m.inProgress)}
                              r={hoveredIndex === i ? 4.5 : 3}
                              fill="#FFFFFF"
                              stroke="#D97706"
                              strokeWidth="2"
                            />
                          ))}
                        </g>
                      )}

                      {/* Done Line */}
                      {visibleSeries.done && kpis.done > 0 && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={currentDataset
                              .map((m, i) => `${getXCenter(i)},${getY(m.done)}`)
                              .join(' ')}
                          />
                          {currentDataset.map((m, i) => m.done > 0 && (
                            <circle
                              key={`done-${i}`}
                              cx={getXCenter(i)}
                              cy={getY(m.done)}
                              r={hoveredIndex === i ? 4.5 : 3}
                              fill="#FFFFFF"
                              stroke="#059669"
                              strokeWidth="2"
                            />
                          ))}
                        </g>
                      )}

                      {/* Delay Line (Only drawn if Delay has data!) */}
                      {visibleSeries.delay && kpis.delay > 0 && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#EF4444"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="4 3"
                            points={currentDataset
                              .map((m, i) => `${getXCenter(i)},${getY(m.delay)}`)
                              .join(' ')}
                          />
                          {currentDataset.map((m, i) => m.delay > 0 && (
                            <circle
                              key={`delay-${i}`}
                              cx={getXCenter(i)}
                              cy={getY(m.delay)}
                              r={hoveredIndex === i ? 5 : 3.5}
                              fill="#FFFFFF"
                              stroke="#DC2626"
                              strokeWidth="2"
                            />
                          ))}
                        </g>
                      )}

                      {/* Not-Started Line */}
                      {visibleSeries.notStarted && kpis.notStarted > 0 && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="2 2"
                            points={currentDataset
                              .map((m, i) => `${getXCenter(i)},${getY(m.notStarted)}`)
                              .join(' ')}
                          />
                          {currentDataset.map((m, i) => m.notStarted > 0 && (
                            <circle
                              key={`ns-${i}`}
                              cx={getXCenter(i)}
                              cy={getY(m.notStarted)}
                              r={hoveredIndex === i ? 4.5 : 3}
                              fill="#FFFFFF"
                              stroke="#2563EB"
                              strokeWidth="2"
                            />
                          ))}
                        </g>
                      )}
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>

            {/* Bottom Info / Hover Detail Bar (Fixed height to prevent sheet jumping/blinking) */}
            <div className="mt-2.5 min-h-[46px] p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
              {hoveredIndex !== null && currentDataset[hoveredIndex] ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      {currentDataset[hoveredIndex].isPastMonthCumulative
                        ? currentDataset[hoveredIndex].fullDateStr
                        : viewTimeframe === 'daily'
                        ? `${fullMonthNames[selectedMonth]} ${currentDataset[hoveredIndex].day}, ${selectedYear}`
                        : `${currentDataset[hoveredIndex].fullName} ${selectedYear}`}
                    </span>
                    {currentDataset[hoveredIndex].isPastMonthCumulative && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                        Past Month Cumulative
                      </span>
                    )}
                    {viewTimeframe === 'daily' && currentDataset[hoveredIndex].isCurrentDate && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        Current Date
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">
                      Total: {currentDataset[hoveredIndex].total}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-4">
                    {/* In-Progress */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-slate-500 font-medium">In-Progress:</span>
                      <span className="font-bold text-amber-700 font-mono text-sm">
                        {currentDataset[hoveredIndex].inProgress}
                      </span>
                    </div>

                    {/* Done */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span className="text-slate-500 font-medium">Done:</span>
                      <span className="font-bold text-emerald-700 font-mono text-sm">
                        {currentDataset[hoveredIndex].done}
                      </span>
                    </div>

                    {/* Delay */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                      <span className="text-slate-500 font-medium">Delay:</span>
                      <span className={`font-bold font-mono text-sm ${
                        currentDataset[hoveredIndex].delay > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-500'
                      }`}>
                        {currentDataset[hoveredIndex].delay}
                      </span>
                    </div>

                    {/* Not-Started */}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <span className="text-slate-500 font-medium">Not-Started:</span>
                      <span className="font-bold text-blue-700 font-mono text-sm">
                        {currentDataset[hoveredIndex].notStarted}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full flex items-center justify-between text-slate-400 text-xs">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-slate-500 font-medium">
                      {viewTimeframe === 'daily'
                        ? 'Hover over any date to inspect detailed status breakdown'
                        : 'Hover over any month to inspect detailed status breakdown'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">
                    {viewTimeframe === 'daily' ? `${fullMonthNames[selectedMonth]} ${selectedYear}` : selectedYear}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
