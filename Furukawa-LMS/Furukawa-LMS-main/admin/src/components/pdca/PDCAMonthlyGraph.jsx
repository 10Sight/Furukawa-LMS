import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
  ChevronUp,
  ChevronDown,
  Calendar,
  Filter,
  Info
} from 'lucide-react';

/**
 * PDCAMonthlyGraph
 * Displays interactive monthly analytics for:
 *  - Total PDCA
 *  - Opened PDCA
 *  - Closed PDCA
 *
 * Supports Grouped Bar, Stacked Bar, and Trend Line views,
 * Scope toggling (This Sheet vs All PDCA Sheets),
 * and Year filtering.
 */
export default function PDCAMonthlyGraph({
  rows = [],
  allPDCARecords = [],
  currentDate = '',
  topic = null,
  isCollapsed = false,
  onToggleCollapse
}) {
  const [chartType, setChartType] = useState('grouped'); // 'grouped' | 'line' | 'stacked'
  const [dataScope, setDataScope] = useState('sheet'); // 'sheet' | 'all'
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState(null);

  // Active series visibility toggles
  const [visibleSeries, setVisibleSeries] = useState({
    total: true,
    opened: true,
    closed: true
  });

  const toggleSeries = (key) => {
    setVisibleSeries(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Prevent unchecking all series
      if (!next.total && !next.opened && !next.closed) return prev;
      return next;
    });
  };

  // Determine baseline year
  const defaultYear = useMemo(() => {
    if (currentDate) {
      const y = parseInt(currentDate.split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    if (topic?.date) {
      const y = new Date(topic.date).getFullYear();
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }, [currentDate, topic?.date]);

  const [selectedYear, setSelectedYear] = useState(defaultYear);

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
        (r.status && r.status !== 'Open' && r.status !== 'Not-Started')
      );
      if (!hasContent && !r.date) return null;

      // Parse date
      let dateStr = r.date || defaultDateStr || currentDate || new Date().toISOString().slice(0, 10);
      let parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        // Fallback try YYYY-MM-DD
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
      const month = !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : 0; // 0-11

      const rawStatus = String(r.status || 'Open').trim().toLowerCase();
      const isClosed = rawStatus === 'closed' || rawStatus === 'done' || rawStatus === 'resolved';
      const isOpened = !isClosed; // Open, In Progress, Delay, etc.

      return {
        year,
        month,
        status: isClosed ? 'Closed' : 'Open',
        rawStatus: r.status || 'Open'
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
      // Aggregate across all PDCA records
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
          // If record has no sub-rows, count record itself
          const item = parseRow({ status: record.status || 'Open', date: record.date }, recDefaultDate);
          if (item) list.push(item);
        }
      });
      return list;
    }
  }, [rows, allPDCARecords, dataScope, currentDate, topic?.date, defaultYear]);

  // Discover all distinct years available in dataset
  const availableYears = useMemo(() => {
    const set = new Set([defaultYear, new Date().getFullYear()]);
    activeItems.forEach(i => set.add(i.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [activeItems, defaultYear]);

  // Build 12-month aggregated dataset for selectedYear
  const monthlyStats = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const data = monthNames.map((name, idx) => ({
      month: name,
      fullName: fullNames[idx],
      monthIndex: idx,
      total: 0,
      opened: 0,
      closed: 0,
      inProgress: 0,
      delay: 0
    }));

    activeItems.forEach(item => {
      if (item.year === selectedYear) {
        if (item.month >= 0 && item.month < 12) {
          data[item.month].total += 1;
          if (item.status === 'Closed') {
            data[item.month].closed += 1;
          } else {
            data[item.month].opened += 1;
          }
        }
      }
    });

    return data;
  }, [activeItems, selectedYear]);

  // Overall KPIs for the selectedYear
  const kpis = useMemo(() => {
    let total = 0;
    let opened = 0;
    let closed = 0;

    monthlyStats.forEach(m => {
      total += m.total;
      opened += m.opened;
      closed += m.closed;
    });

    const closureRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;

    return { total, opened, closed, closureRate, openRate };
  }, [monthlyStats]);

  // Max value for chart Y-axis scaling
  const maxChartValue = useMemo(() => {
    let max = 0;
    monthlyStats.forEach(m => {
      if (chartType === 'stacked') {
        const stackTotal = m.opened + m.closed;
        if (stackTotal > max) max = stackTotal;
      } else {
        if (m.total > max) max = m.total;
        if (m.opened > max) max = m.opened;
        if (m.closed > max) max = m.closed;
      }
    });
    // Ensure at least 4 for pleasant grid spacing
    if (max <= 4) return 5;
    // Round up to nearest multiple of 5 or 10
    return Math.ceil(max / 5) * 5;
  }, [monthlyStats, chartType]);

  // SVG Chart Geometry
  const svgWidth = 920;
  const svgHeight = 250;
  const padding = { top: 25, right: 25, bottom: 40, left: 45 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Y-Scale helper
  const getY = (val) => {
    return padding.top + graphHeight - (val / maxChartValue) * graphHeight;
  };

  // X-Scale helper (12 months)
  const slotWidth = graphWidth / 12;
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
                <span>Monthly PDCA Status Graph</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {selectedYear}
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-500">
              Monthly breakdown of Total, Opened, and Closed PDCA observations
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
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
              title="Show monthly observations for this sheet only"
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
              title="Show monthly observations across all PDCA forms in system"
            >
              All PDCA Sheets
            </button>
          </div>

          {/* Year Select */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-700 cursor-pointer pr-1"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Chart View Mode */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/80">
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
            <button
              type="button"
              onClick={() => setChartType('stacked')}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                chartType === 'stacked' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Stacked bar chart"
            >
              Stacked
            </button>
          </div>

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
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total PDCA Card */}
            <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border border-blue-200/80 rounded-xl p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Total PDCA</span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-900 font-mono">{kpis.total}</span>
                <span className="text-[11px] text-blue-600 font-medium">observations</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Logged in {selectedYear}
              </div>
            </div>

            {/* Opened PDCA Card */}
            <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-200/80 rounded-xl p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Opened PDCA</span>
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-amber-900 font-mono">{kpis.opened}</span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded-md">
                  {kpis.openRate}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Pending resolution
              </div>
            </div>

            {/* Closed PDCA Card */}
            <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-200/80 rounded-xl p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Closed PDCA</span>
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-900 font-mono">{kpis.closed}</span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded-md">
                  {kpis.closureRate}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Successfully completed
              </div>
            </div>

            {/* Closure Rate Card */}
            <div className="bg-gradient-to-br from-purple-50/60 to-slate-50 border border-purple-200/70 rounded-xl p-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Resolution Rate</span>
                <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-purple-900 font-mono">{kpis.closureRate}%</span>
                <span className="text-[11px] text-purple-600 font-medium">closed</span>
              </div>
              {/* Mini progress bar */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, kpis.closureRate)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="bg-slate-50/50 rounded-xl border border-slate-200/80 p-3 relative">
            {/* Chart Series Legend & Filter Toggles */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-slate-200/60 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Metrics:</span>

                {/* Total Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('total')}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.total
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                  <span>Total PDCA</span>
                </button>

                {/* Opened Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('opened')}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.opened
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span>Opened PDCA</span>
                </button>

                {/* Closed Legend Toggle */}
                <button
                  type="button"
                  onClick={() => toggleSeries('closed')}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                    visibleSeries.closed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
                  <span>Closed PDCA</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>Hover over any month to inspect details</span>
              </div>
            </div>

            {/* SVG Graph View */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[680px]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto select-none"
                  style={{ maxHeight: '280px' }}
                >
                  <defs>
                    <linearGradient id="totalBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                    <linearGradient id="openedBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <linearGradient id="closedBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#059669" />
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

                  {/* Month Columns & Bars */}
                  {monthlyStats.map((item, idx) => {
                    const xCenter = getXCenter(idx);
                    const isHovered = hoveredMonthIndex === idx;
                    const colX = padding.left + idx * slotWidth;

                    // Grouped Bar width calculations
                    const barGroupWidth = slotWidth * 0.72;
                    const singleBarWidth = Math.max(6, (barGroupWidth - 8) / 3);
                    const startX = xCenter - barGroupWidth / 2;

                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoveredMonthIndex(idx)}
                        onMouseLeave={() => setHoveredMonthIndex(null)}
                        className="cursor-pointer"
                      >
                        {/* Hover Column Background Highlight */}
                        <rect
                          x={colX + 2}
                          y={padding.top}
                          width={slotWidth - 4}
                          height={graphHeight}
                          fill={isHovered ? 'rgba(59, 130, 246, 0.08)' : 'transparent'}
                          rx="6"
                          className="transition-colors duration-150"
                        />

                        {/* Chart Render: Grouped Bars */}
                        {chartType === 'grouped' && (
                          <g>
                            {/* Total Bar */}
                            {visibleSeries.total && item.total > 0 && (
                              <g>
                                <rect
                                  x={startX}
                                  y={getY(item.total)}
                                  width={singleBarWidth}
                                  height={graphHeight - (getY(item.total) - padding.top)}
                                  fill="url(#totalBarGrad)"
                                  rx="3"
                                  className="transition-all duration-200 hover:brightness-110"
                                />
                                <text
                                  x={startX + singleBarWidth / 2}
                                  y={getY(item.total) - 4}
                                  textAnchor="middle"
                                  className="text-[9.5px] font-bold fill-blue-700 font-mono"
                                >
                                  {item.total}
                                </text>
                              </g>
                            )}

                            {/* Opened Bar */}
                            {visibleSeries.opened && item.opened > 0 && (
                              <g>
                                <rect
                                  x={startX + singleBarWidth + 4}
                                  y={getY(item.opened)}
                                  width={singleBarWidth}
                                  height={graphHeight - (getY(item.opened) - padding.top)}
                                  fill="url(#openedBarGrad)"
                                  rx="3"
                                  className="transition-all duration-200 hover:brightness-110"
                                />
                                <text
                                  x={startX + singleBarWidth + 4 + singleBarWidth / 2}
                                  y={getY(item.opened) - 4}
                                  textAnchor="middle"
                                  className="text-[9.5px] font-bold fill-amber-700 font-mono"
                                >
                                  {item.opened}
                                </text>
                              </g>
                            )}

                            {/* Closed Bar */}
                            {visibleSeries.closed && item.closed > 0 && (
                              <g>
                                <rect
                                  x={startX + (singleBarWidth + 4) * 2}
                                  y={getY(item.closed)}
                                  width={singleBarWidth}
                                  height={graphHeight - (getY(item.closed) - padding.top)}
                                  fill="url(#closedBarGrad)"
                                  rx="3"
                                  className="transition-all duration-200 hover:brightness-110"
                                />
                                <text
                                  x={startX + (singleBarWidth + 4) * 2 + singleBarWidth / 2}
                                  y={getY(item.closed) - 4}
                                  textAnchor="middle"
                                  className="text-[9.5px] font-bold fill-emerald-700 font-mono"
                                >
                                  {item.closed}
                                </text>
                              </g>
                            )}
                          </g>
                        )}

                        {/* Chart Render: Stacked Bars (Opened bottom, Closed top) */}
                        {chartType === 'stacked' && (
                          <g>
                            {(() => {
                              const stackW = Math.min(26, slotWidth * 0.45);
                              const openH = graphHeight - (getY(item.opened) - padding.top);
                              const closeH = graphHeight - (getY(item.closed) - padding.top);
                              const totalH = openH + closeH;
                              const baseY = padding.top + graphHeight;

                              if (item.total === 0) return null;

                              return (
                                <g>
                                  {/* Opened portion */}
                                  {item.opened > 0 && (
                                    <rect
                                      x={xCenter - stackW / 2}
                                      y={baseY - openH}
                                      width={stackW}
                                      height={openH}
                                      fill="url(#openedBarGrad)"
                                      rx={item.closed === 0 ? 3 : 0}
                                    />
                                  )}
                                  {/* Closed portion */}
                                  {item.closed > 0 && (
                                    <rect
                                      x={xCenter - stackW / 2}
                                      y={baseY - totalH}
                                      width={stackW}
                                      height={closeH}
                                      fill="url(#closedBarGrad)"
                                      rx="3"
                                    />
                                  )}
                                  <text
                                    x={xCenter}
                                    y={baseY - totalH - 4}
                                    textAnchor="middle"
                                    className="text-[9.5px] font-bold fill-slate-700 font-mono"
                                  >
                                    {item.total}
                                  </text>
                                </g>
                              );
                            })()}
                          </g>
                        )}

                        {/* X-Axis Month Label */}
                        <text
                          x={xCenter}
                          y={svgHeight - 12}
                          textAnchor="middle"
                          className={`text-[11px] font-semibold transition-all ${
                            isHovered
                              ? 'fill-blue-700 font-bold scale-105'
                              : item.total > 0
                              ? 'fill-slate-800'
                              : 'fill-slate-400'
                          }`}
                        >
                          {item.month}
                        </text>

                        {/* Dot indicator if month has data */}
                        {item.total > 0 && (
                          <circle
                            cx={xCenter}
                            cy={svgHeight - 2}
                            r="2"
                            fill={isHovered ? '#2563EB' : '#94A3B8'}
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Chart Render: Trend Lines */}
                  {chartType === 'line' && (
                    <g>
                      {/* Total Line */}
                      {visibleSeries.total && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={monthlyStats
                              .map((m, i) => `${getXCenter(i)},${getY(m.total)}`)
                              .join(' ')}
                          />
                          {monthlyStats.map((m, i) => (
                            <circle
                              key={i}
                              cx={getXCenter(i)}
                              cy={getY(m.total)}
                              r={hoveredMonthIndex === i ? 5 : 3.5}
                              fill="#FFFFFF"
                              stroke="#2563EB"
                              strokeWidth="2"
                            />
                          ))}
                        </g>
                      )}

                      {/* Opened Line */}
                      {visibleSeries.opened && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#F59E0B"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="4 3"
                            points={monthlyStats
                              .map((m, i) => `${getXCenter(i)},${getY(m.opened)}`)
                              .join(' ')}
                          />
                          {monthlyStats.map((m, i) => (
                            <circle
                              key={i}
                              cx={getXCenter(i)}
                              cy={getY(m.opened)}
                              r={hoveredMonthIndex === i ? 5 : 3}
                              fill="#FFFFFF"
                              stroke="#D97706"
                              strokeWidth="2"
                            />
                          ))}
                        </g>
                      )}

                      {/* Closed Line */}
                      {visibleSeries.closed && (
                        <g>
                          <polyline
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={monthlyStats
                              .map((m, i) => `${getXCenter(i)},${getY(m.closed)}`)
                              .join(' ')}
                          />
                          {monthlyStats.map((m, i) => (
                            <circle
                              key={i}
                              cx={getXCenter(i)}
                              cy={getY(m.closed)}
                              r={hoveredMonthIndex === i ? 5 : 3.5}
                              fill="#FFFFFF"
                              stroke="#059669"
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

            {/* Hover Tooltip Overlay */}
            {hoveredMonthIndex !== null && (
              <div className="mt-2.5 p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">
                    {monthlyStats[hoveredMonthIndex].fullName} {selectedYear}
                  </span>
                  <span className="text-[10px] text-slate-400">Monthly Snapshot</span>
                </div>

                <div className="flex items-center flex-wrap gap-4">
                  {/* Total */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-slate-500 font-medium">Total:</span>
                    <span className="font-bold text-blue-700 font-mono text-sm">
                      {monthlyStats[hoveredMonthIndex].total}
                    </span>
                  </div>

                  {/* Opened */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-500 font-medium">Opened:</span>
                    <span className="font-bold text-amber-700 font-mono text-sm">
                      {monthlyStats[hoveredMonthIndex].opened}
                    </span>
                  </div>

                  {/* Closed */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="text-slate-500 font-medium">Closed:</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">
                      {monthlyStats[hoveredMonthIndex].closed}
                    </span>
                  </div>

                  {/* Resolution Rate */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <span className="text-slate-500 font-medium">Closure Rate:</span>
                    <span className="font-extrabold text-slate-800 font-mono">
                      {monthlyStats[hoveredMonthIndex].total > 0
                        ? `${Math.round((monthlyStats[hoveredMonthIndex].closed / monthlyStats[hoveredMonthIndex].total) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
