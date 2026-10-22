import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  LabelList
} from 'recharts';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  ChevronDown,
  Building2,
  Sparkles,
  Filter,
  Eye,
  Award,
  ChevronRight
} from 'lucide-react';

import { listLPAWorkbooks } from './lpaStore.js';
import {
  COLORS,
  extractSheetScore,
  formatShortDate,
  aggregateSectionData
} from './lpaGraphUtils.js';

/**
 * Custom Rich Tooltip for Recharts
 */
function CustomChartTooltip({ active, payload, label, targetBenchmark = 85 }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload || {};

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md text-xs z-50 min-w-[210px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
        <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-600" />
          {data.formattedDate || data.date || label}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-bold text-[11px] border ${
          data.avgScore >= targetBenchmark
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}>
          {data.avgScore >= targetBenchmark ? 'Target Met' : 'Below Target'}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-semibold text-slate-700">
          <span>Overall Score:</span>
          <span className={`font-bold ${data.avgScore >= targetBenchmark ? 'text-emerald-600' : data.avgScore >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
            {data.avgScore}%
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-500 text-[11px]">
          <span>Target Benchmark:</span>
          <span className="font-bold text-emerald-600">{targetBenchmark}%</span>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Score by Levels:</div>
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#06b6d4' }}></span>
                <span className="text-slate-600">Level 3:</span>
              </span>
              <strong className="text-slate-800 font-mono">
                {data.level3Score != null ? `${data.level3Score}%` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#8b5cf6' }}></span>
                <span className="text-slate-600">Level 2:</span>
              </span>
              <strong className="text-slate-800 font-mono">
                {data.level2Score != null ? `${data.level2Score}%` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: '#ec4899' }}></span>
                <span className="text-slate-600">Level 1:</span>
              </span>
              <strong className="text-slate-800 font-mono">
                {data.level1Score != null ? `${data.level1Score}%` : '—'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dedicated Section Card for Assembly Sheet or C&C Sheet
 */
function LpaSectionGraphCard({
  title,
  subtitle,
  icon: Icon,
  badgeColor = 'blue',
  sectionData,
  onResetFilters,
  targetBenchmark = 85
}) {
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  const { dailyData, summary } = sectionData;
  const hasData = dailyData && dailyData.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-start gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-${badgeColor}-50 text-${badgeColor}-600 border border-${badgeColor}-100 shadow-xs`}>
            <Icon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{title}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-${badgeColor}-50 text-${badgeColor}-700 border border-${badgeColor}-200`}>
                {summary.totalSheets} Sheets
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip for this sheet */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4">
        <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Generated</div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">{summary.totalSheets}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across {summary.activeDays} active day{summary.activeDays === 1 ? '' : 's'}</div>
        </div>

        <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Average Score</div>
          <div className={`text-xl font-bold mt-0.5 ${summary.avgScore >= targetBenchmark ? 'text-emerald-600' : summary.avgScore >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
            {summary.avgScore}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Target benchmark: {targetBenchmark}%</div>
        </div>

        <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Shifts Breakdown</div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mt-1">
            <span className="text-blue-600">A: {summary.totalShiftA}</span> ·
            <span className="text-emerald-600">B: {summary.totalShiftB}</span>
            {summary.totalShiftG > 0 && <span className="text-purple-600"> · G: {summary.totalShiftG}</span>}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Shift volume</div>
        </div>

        <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Levels Breakdown</div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mt-1">
            <span className="text-cyan-600">L3: {summary.totalLevel3}</span> ·
            <span className="text-purple-600">L2: {summary.totalLevel2}</span> ·
            <span className="text-pink-600">L1: {summary.totalLevel1}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hierarchy levels</div>
        </div>
      </div>

      {/* Main Chart Area */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <FileSpreadsheet size={36} className="text-slate-300 mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No Sheet Records for this Filter</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            There are no saved {title} records matching the selected date range or unit.
          </p>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="w-full h-[370px] pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData} margin={{ top: 25, right: 25, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                unit="%"
                label={{ value: 'Score %', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: 10, fill: '#64748b' } }}
              />
              <Tooltip content={<CustomChartTooltip targetBenchmark={targetBenchmark} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

              {/* Target Benchmark Line (Settable by Admin) */}
              <ReferenceLine
                y={targetBenchmark}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: `Target: ${targetBenchmark}%`, fill: '#059669', fontSize: 11, fontWeight: 700, position: 'top' }}
              />

              {/* Separate Candles for Score by Levels (Side-by-side, unstacked) */}
              <Bar dataKey="level3Score" name="Level 3 Score (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="level2Score" name="Level 2 Score (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="level1Score" name="Level 1 Score (%)" fill="#ec4899" radius={[4, 4, 0, 0]} maxBarSize={36} />

              {/* Overall Score Trend Line with exact % labeled at each dot */}
              <Line
                type="monotone"
                dataKey="avgScore"
                name="Overall Score (%)"
                stroke="#e11d48"
                strokeWidth={3}
                dot={{ r: 5, fill: '#fff', stroke: '#e11d48', strokeWidth: 2.5 }}
                activeDot={{ r: 7 }}
              >
                <LabelList
                  dataKey="avgScore"
                  position="top"
                  offset={10}
                  style={{ fill: '#e11d48', fontSize: 11, fontWeight: 800 }}
                  formatter={(val) => (val > 0 ? `${val}%` : '')}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Collapsible Daily Data Table */}
      {hasData && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setIsTableExpanded(!isTableExpanded)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Layers size={14} className="text-slate-400" />
              Daily Activity Breakdown ({dailyData.length} recorded day{dailyData.length === 1 ? '' : 's'})
            </span>
            <span className="flex items-center gap-1 text-slate-500 font-normal">
              {isTableExpanded ? 'Hide Details' : 'Show Details'}
              <ChevronDown size={14} className={`transform transition-transform ${isTableExpanded ? 'rotate-180' : ''}`} />
            </span>
          </button>

          {isTableExpanded && (
            <div className="overflow-x-auto mt-2 rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5 text-center">Total Sheets</th>
                    <th className="px-3 py-2.5 text-center">Shift A</th>
                    <th className="px-3 py-2.5 text-center">Shift B</th>
                    <th className="px-3 py-2.5 text-center">Shift C/G</th>
                    <th className="px-3 py-2.5 text-center">Level 3</th>
                    <th className="px-3 py-2.5 text-center">Level 2</th>
                    <th className="px-3 py-2.5 text-center">Level 1</th>
                    <th className="px-3 py-2.5 text-right">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyData.map((day) => (
                    <tr key={day.date} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{day.date}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">{day.totalSheets}</td>
                      <td className="px-3 py-2.5 text-center text-blue-600 font-semibold">{day.shiftA || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-emerald-600 font-semibold">{day.shiftB || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-purple-600 font-semibold">{(day.shiftC + day.shiftG) || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-cyan-600 font-medium">{day.level3 || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-purple-600 font-medium">{day.level2 || '-'}</td>
                      <td className="px-3 py-2.5 text-center text-pink-600 font-medium">{day.level1 || '-'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${day.avgScore >= 85 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : day.avgScore >= 70 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {day.avgScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main LPA Graphs Page
 */
export default function LpaGraphsPage() {
  const navigate = useNavigate();
  const outlet = useOutletContext();
  const { isFormView, setIsFormView } = outlet || {};
  const authUser = useSelector(state => state.auth?.user);
  const userId = authUser?.id || authUser?._id || 'current';
  const isAdmin = Boolean(
    authUser?.isAdmin ||
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'SUPERADMIN' ||
    authUser?.role === 'superadmin' ||
    authUser?.role === 'admin'
  );

  // Target Benchmark line settable by Admin (defaults to 85)
  const [targetBenchmark, setTargetBenchmark] = useState(() => {
    try {
      const saved = localStorage.getItem('lpa_target_benchmark');
      return saved ? Number(saved) : 85;
    } catch {
      return 85;
    }
  });

  const handleTargetBenchmarkChange = (val) => {
    const num = Math.max(1, Math.min(100, Number(val) || 85));
    setTargetBenchmark(num);
    try {
      localStorage.setItem('lpa_target_benchmark', String(num));
    } catch (err) {
      console.error(err);
    }
  };

  // Filter states
  const [selectedUnit, setSelectedUnit] = useState('all'); // 'all' | 'Bawal' | 'Gujrat'
  const [dateRange, setDateRange] = useState('30d'); // '7d' | '14d' | '30d' | 'month' | 'all'
  const [activeTab, setActiveTab] = useState('both'); // 'both' | 'assembly' | 'cc'

  // Data states
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auto-hide CMS Sidebar and Navbar on mount, restore on unmount
  useEffect(() => {
    setIsFormView?.(true);
    return () => setIsFormView?.(false);
  }, [setIsFormView]);

  // Handle ESC key to exit graph page
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        navigate('/cms/lpa');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Load LPA workbooks
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listLPAWorkbooks(userId);
      const real = (all || []).filter(w => !w.sampleData);
      setRecords(real);
    } catch (err) {
      console.error('Failed to load LPA graph data:', err);
      setError(err?.message || 'Could not load LPA workbook records.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate Assembly data
  const assemblyData = useMemo(() => {
    return aggregateSectionData(records, 'assembly', selectedUnit, dateRange);
  }, [records, selectedUnit, dateRange]);

  // Aggregate C&C data
  const ccData = useMemo(() => {
    return aggregateSectionData(records, 'cc', selectedUnit, dateRange);
  }, [records, selectedUnit, dateRange]);

  // Overall Global KPI Summary
  const globalSummary = useMemo(() => {
    const totalSheets = assemblyData.summary.totalSheets + ccData.summary.totalSheets;
    const scores = [
      ...assemblyData.dailyData.flatMap(d => d.scores),
      ...ccData.dailyData.flatMap(d => d.scores)
    ];
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return {
      totalSheets,
      avgScore,
      assemblySheets: assemblyData.summary.totalSheets,
      assemblyAvgScore: assemblyData.summary.avgScore,
      ccSheets: ccData.summary.totalSheets,
      ccAvgScore: ccData.summary.avgScore,
      shiftA: assemblyData.summary.totalShiftA + ccData.summary.totalShiftA,
      shiftB: assemblyData.summary.totalShiftB + ccData.summary.totalShiftB,
      shiftC: assemblyData.summary.totalShiftC + ccData.summary.totalShiftC,
      shiftG: assemblyData.summary.totalShiftG + ccData.summary.totalShiftG,
      level3: assemblyData.summary.totalLevel3 + ccData.summary.totalLevel3,
      level2: assemblyData.summary.totalLevel2 + ccData.summary.totalLevel2,
      level1: assemblyData.summary.totalLevel1 + ccData.summary.totalLevel1
    };
  }, [assemblyData, ccData]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans">
      {/* Sticky Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/cms/lpa')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer group"
              title="Return to LPA Check Sheets (or press Esc)"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5 text-slate-500" />
              <span>Back to LPA Page</span>
            </button>

            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xs">
                <BarChart3 size={18} />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  LPA Analytics & Performance Graphs
                </h1>
                <p className="text-[11px] text-slate-500">
                  Assembly & C&C Sheets · Daily Activity, Shift & Level Breakdown, Score Trends
                </p>
              </div>
            </div>
          </div>

          {/* Right: Controls & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Unit Selector */}
            <div className="relative">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer hover:bg-slate-50"
              >
                <option value="all">All Units</option>
                <option value="Bawal">Bawal</option>
                <option value="Gujrat">Gujrat</option>
              </select>
              <Building2 size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Date Range Selector */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer hover:bg-slate-50"
              >
                <option value="7d">Last 7 Days</option>
                <option value="14d">Last 14 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="month">This Month</option>
                <option value="all">All Recorded Dates</option>
              </select>
              <Calendar size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Target Line Setter (Admin Settable) */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs" title="Target Benchmark Line %">
              <span className="text-slate-500 font-medium text-[11px]">Target:</span>
              {isAdmin ? (
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={targetBenchmark}
                    onChange={(e) => handleTargetBenchmarkChange(e.target.value)}
                    className="w-11 text-center rounded border border-emerald-300 bg-emerald-50/60 py-0.5 px-0.5 text-xs font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    title="Admin: Change Target Line %"
                  />
                  <span className="text-emerald-700 font-bold">%</span>
                </div>
              ) : (
                <span className="font-bold text-emerald-700">{targetBenchmark}%</span>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh Graph Data"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-blue-600' : 'text-slate-500'} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 overflow-y-auto">
        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center p-8 rounded-2xl bg-white border border-slate-100 shadow-xs">
            <RefreshCw size={22} className="animate-spin text-blue-600 mr-2.5" />
            <span className="text-sm font-medium text-slate-600">Calculating sheet metrics and compiling graphs...</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={loadData} className="font-bold underline hover:text-rose-900">Retry</button>
          </div>
        )}

        {/* Global KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Sheets */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sheets Created</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <FileSpreadsheet size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">{globalSummary.totalSheets}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Assembly: {globalSummary.assemblySheets}</span> ·
              <span className="font-semibold text-slate-700">C&C: {globalSummary.ccSheets}</span>
            </div>
          </div>

          {/* Card 2: Overall Score */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average Compliance</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className={`mt-2 text-2xl font-black ${globalSummary.avgScore >= 85 ? 'text-emerald-600' : globalSummary.avgScore >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
              {globalSummary.avgScore}%
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>Assembly: {globalSummary.assemblyAvgScore}%</span> ·
              <span>C&C: {globalSummary.ccAvgScore}%</span>
            </div>
          </div>

          {/* Card 3: Shifts Distribution */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Shift Volume</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {globalSummary.shiftA + globalSummary.shiftB}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-blue-600 font-bold">Shift A: {globalSummary.shiftA}</span> ·
              <span className="text-emerald-600 font-bold">Shift B: {globalSummary.shiftB}</span>
            </div>
          </div>

          {/* Card 4: Levels Distribution */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hierarchy Levels</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Layers size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {globalSummary.level3 + globalSummary.level2 + globalSummary.level1}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-cyan-600 font-bold">L3: {globalSummary.level3}</span> ·
              <span className="text-purple-600 font-bold">L2: {globalSummary.level2}</span> ·
              <span className="text-pink-600 font-bold">L1: {globalSummary.level1}</span>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex rounded-2xl bg-white p-1.5 border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('both')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${activeTab === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Both Sheets (Side-by-Side)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('assembly')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${activeTab === 'assembly' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              1. Assembly Sheet Only
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cc')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${activeTab === 'cc' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              2. C&C Sheet Only
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Unit: <strong className="text-slate-700">{selectedUnit === 'all' ? 'All Units' : selectedUnit}</strong> · Range: <strong className="text-slate-700">{dateRange}</strong>
          </div>
        </div>

        {/* Graph 1: Assembly Sheet */}
        {(activeTab === 'both' || activeTab === 'assembly') && (
          <LpaSectionGraphCard
            title="1. Assembly Sheet Analytics"
            subtitle="Daily scores by hierarchy levels (Level 3, Level 2, Level 1) with target benchmark"
            icon={FileSpreadsheet}
            badgeColor="blue"
            sectionData={assemblyData}
            targetBenchmark={targetBenchmark}
            onResetFilters={() => { setSelectedUnit('all'); setDateRange('all'); }}
          />
        )}

        {/* Graph 2: C&C Sheet */}
        {(activeTab === 'both' || activeTab === 'cc') && (
          <LpaSectionGraphCard
            title="2. C&C (Cutting & Crimping) Sheet Analytics"
            subtitle="Daily scores by hierarchy levels (Level 3, Level 2, Level 1) with target benchmark"
            icon={Layers}
            badgeColor="emerald"
            sectionData={ccData}
            targetBenchmark={targetBenchmark}
            onResetFilters={() => { setSelectedUnit('all'); setDateRange('all'); }}
          />
        )}
      </main>
    </div>
  );
}
