import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import {
  BarChart3,
  Calendar,
  Filter,
  RotateCcw,
  Target,
  Sparkles,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Building2,
  MapPin
} from 'lucide-react';
import SuggestionTargetModal, {
  TARGET_DEPARTMENTS,
  MONTHS,
  YEARS_LIST,
  getStoredDepartmentTargets,
  getStoredDepartmentTargetsV2,
  getTargetForDeptAndMonth
} from './SuggestionTargetModal';

// Helper to normalize date to YYYY-MM-DD
export function normalizeDateToYMD(rawDate) {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str;
}

// Format date for clean chart X-Axis display (e.g. "05 Nov" or "05/11")
function formatDisplayDate(ymd) {
  if (!ymd) return '-';
  try {
    const parts = ymd.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const mName = monthNames[monthIdx] || parts[1];
      return `${day} ${mName}`;
    }
  } catch {}
  return ymd;
}

// Custom number renderer displayed on top of bar candles (only renders when value > 0)
const renderCustomBarLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value || Number(value) <= 0) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 5}
      fill="#0F172A"
      textAnchor="middle"
      fontSize={12}
      fontWeight={800}
    >
      {value}
    </text>
  );
};

export default function SuggestionChecksheetGraph({
  records = [],
  selectedUnit = 'Bawal',
  onSelectUnit,
  departmentList = TARGET_DEPARTMENTS
}) {
  const currentYear = new Date().getFullYear() || 2026;
  const currentMonthNum = (new Date().getMonth() + 1) || 11;

  // Graph Filters state:
  // Modes: 'ALL' | 'BEST' | 'OVERALL' | 'DEPARTMENT'
  const [graphTab, setGraphTab] = useState('ALL');
  const [suggestionScope, setSuggestionScope] = useState('ALL'); // 'ALL' | 'BEST'
  const [graphView, setGraphView] = useState('TIMELINE'); // 'TIMELINE' | 'OVERALL' | 'DEPARTMENT'
  const [graphDept, setGraphDept] = useState('All');
  const [graphFromDate, setGraphFromDate] = useState('');
  const [graphToDate, setGraphToDate] = useState('');
  const [cumulativeYear, setCumulativeYear] = useState(currentYear);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [targets, setTargets] = useState(() => getStoredDepartmentTargets());

  // Filter records according to graph filter controls
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      // 1. Suggestion Scope filter (All vs Best)
      const isBestItem = Boolean(
        item.isBest ||
        Number(item.defectPreventionRank) === 5 ||
        Number(item.defectPreventionRank) === 4
      );
      if (suggestionScope === 'BEST') {
        if (!isBestItem) return false;
      }

      // 2. Unit match
      if (selectedUnit && selectedUnit !== 'All Units' && item.unit && item.unit !== selectedUnit) {
        return false;
      }

      // 3. Department match (applies when not in Department Overview)
      if (graphTab !== 'DEPARTMENT' && graphDept !== 'All') {
        const itemDept = String(item.department || '').trim().toLowerCase();
        const targetDept = String(graphDept).trim().toLowerCase();
        if (itemDept !== targetDept) return false;
      }

      // 4. From - To Calendar range
      const itemYmd = normalizeDateToYMD(item.date);
      if (graphFromDate && itemYmd && itemYmd < graphFromDate) {
        return false;
      }
      if (graphToDate && itemYmd && itemYmd > graphToDate) {
        return false;
      }

      return true;
    });
  }, [records, suggestionScope, selectedUnit, graphDept, graphFromDate, graphToDate, graphTab]);

  // Aggregate data for the Bar Chart:
  // - 'ALL' / 'BEST': Date-wise 4 bars
  // - 'OVERALL': Cumulative totals over date
  // - 'DEPARTMENT': Grouped by all 13 departments!
  const chartData = useMemo(() => {
    if (graphTab === 'DEPARTMENT') {
      const v2Store = getStoredDepartmentTargetsV2();
      let targetMonth = currentMonthNum;
      let targetYear = cumulativeYear;
      if (graphFromDate) {
        const parts = graphFromDate.split('-');
        if (parts.length === 3) {
          targetYear = parseInt(parts[0], 10) || targetYear;
          targetMonth = parseInt(parts[1], 10) || targetMonth;
        }
      }

      // Group by Department across all 13 departments
      return TARGET_DEPARTMENTS.map((dept) => {
        let totalCreated = 0;
        let accepted = 0;
        let notFeasible = 0;
        let implementedCount = 0;

        filteredRecords.forEach((item) => {
          const itemDept = String(item.department || '').trim().toLowerCase();
          if (itemDept === dept.toLowerCase()) {
            totalCreated += 1;
            const statusStr = String(item.status || '').trim().toLowerCase();
            const decisionStr = String(item.rejectedAccepted || '').trim().toLowerCase();
            if (statusStr === 'approved' || statusStr === 'accepted' || decisionStr === 'accepted' || statusStr === 'implemented') {
              accepted += 1;
            }
            if (statusStr === 'not feasible' || statusStr === 'rejected' || decisionStr === 'not feasible' || decisionStr === 'rejected') {
              notFeasible += 1;
            }
            if (statusStr === 'implemented' || (item.dateOfImplementation && String(item.dateOfImplementation).trim() !== '')) {
              implementedCount += 1;
            }
          }
        });

        const deptTarget = getTargetForDeptAndMonth(dept, targetYear, targetMonth, v2Store, targets);

        return {
          displayLabel: dept,
          department: dept,
          totalCreated,
          accepted,
          notFeasible,
          implementedCount,
          target: deptTarget
        };
      });
    }

    if (graphTab === 'OVERALL') {
      // Group by date, but compute cumulative running totals
      const dateMap = new Map();
      filteredRecords.forEach((item) => {
        const ymd = normalizeDateToYMD(item.date) || 'Undated';
        if (!dateMap.has(ymd)) {
          dateMap.set(ymd, {
            dateKey: ymd,
            displayDate: ymd === 'Undated' ? 'Undated' : formatDisplayDate(ymd),
            totalCreated: 0,
            accepted: 0,
            notFeasible: 0,
            implementedCount: 0
          });
        }
        const entry = dateMap.get(ymd);
        entry.totalCreated += 1;
        const statusStr = String(item.status || '').trim().toLowerCase();
        const decisionStr = String(item.rejectedAccepted || '').trim().toLowerCase();
        if (statusStr === 'approved' || statusStr === 'accepted' || decisionStr === 'accepted' || statusStr === 'implemented') {
          entry.accepted += 1;
        }
        if (statusStr === 'not feasible' || statusStr === 'rejected' || decisionStr === 'not feasible' || decisionStr === 'rejected') {
          entry.notFeasible += 1;
        }
        if (statusStr === 'implemented' || (item.dateOfImplementation && String(item.dateOfImplementation).trim() !== '')) {
          entry.implementedCount += 1;
        }
      });

      const sorted = Array.from(dateMap.values()).sort((a, b) => {
        if (a.dateKey === 'Undated') return 1;
        if (b.dateKey === 'Undated') return -1;
        return a.dateKey.localeCompare(b.dateKey);
      });

      let cumTotal = 0;
      let cumAccepted = 0;
      let cumNotFeasible = 0;
      let cumImplemented = 0;

      return sorted.map((d) => {
        cumTotal += d.totalCreated;
        cumAccepted += d.accepted;
        cumNotFeasible += d.notFeasible;
        cumImplemented += d.implementedCount;
        return {
          ...d,
          displayLabel: d.displayDate,
          totalCreated: cumTotal,
          accepted: cumAccepted,
          notFeasible: cumNotFeasible,
          implementedCount: cumImplemented
        };
      });
    }

    // Timeline mode: 'ALL' or 'BEST' -> Cumulative past/current month buckets followed by daily entries
    const now = new Date();
    const curYear = now.getFullYear() || 2026;
    const curMonth = (now.getMonth() + 1) || 11;
    const pastMonth = curMonth === 1 ? 12 : curMonth - 1;
    const pastYr = curMonth === 1 ? curYear - 1 : curYear;

    const pastMonthObj = MONTHS.find((m) => m.num === pastMonth);
    const curMonthObj = MONTHS.find((m) => m.num === curMonth);
    const pastShort = pastMonthObj ? pastMonthObj.short : 'Past';
    const curShort = curMonthObj ? curMonthObj.short : 'Current';

    const v2Store = getStoredDepartmentTargetsV2();

    const computeMonthStats = (yr, mo) => {
      let totalCreated = 0;
      let accepted = 0;
      let notFeasible = 0;
      let implementedCount = 0;

      records.forEach((item) => {
        if (selectedUnit && selectedUnit !== 'All Units' && item.unit && item.unit !== selectedUnit) {
          return;
        }
        if (graphDept !== 'All') {
          const itemDept = String(item.department || '').trim().toLowerCase();
          if (itemDept !== String(graphDept).trim().toLowerCase()) return;
        }
        if (graphTab === 'BEST') {
          const isBestItem = Boolean(
            item.isBest ||
            Number(item.defectPreventionRank) === 5 ||
            Number(item.defectPreventionRank) === 4
          );
          if (!isBestItem) return;
        }
        const ymd = normalizeDateToYMD(item.date);
        if (!ymd) return;
        const parts = ymd.split('-');
        if (parts.length === 3 && parseInt(parts[0], 10) === yr && parseInt(parts[1], 10) === mo) {
          totalCreated += 1;
          const statusStr = String(item.status || '').trim().toLowerCase();
          const decisionStr = String(item.rejectedAccepted || '').trim().toLowerCase();
          if (statusStr === 'approved' || statusStr === 'accepted' || decisionStr === 'accepted' || statusStr === 'implemented') {
            accepted += 1;
          }
          if (statusStr === 'not feasible' || statusStr === 'rejected' || decisionStr === 'not feasible' || decisionStr === 'rejected') {
            notFeasible += 1;
          }
          if (statusStr === 'implemented' || (item.dateOfImplementation && String(item.dateOfImplementation).trim() !== '')) {
            implementedCount += 1;
          }
        }
      });

      let targetVal = 0;
      if (graphDept !== 'All') {
        targetVal = getTargetForDeptAndMonth(graphDept, yr, mo, v2Store, targets);
      } else {
        targetVal = TARGET_DEPARTMENTS.reduce(
          (sum, d) => sum + getTargetForDeptAndMonth(d, yr, mo, v2Store, targets),
          0
        );
      }

      return { totalCreated, accepted, notFeasible, implementedCount, target: targetVal };
    };

    const pastStats = computeMonthStats(pastYr, pastMonth);
    const curStats = computeMonthStats(curYear, curMonth);

    // Only include cumulative buckets for months that have data (hide blank month)
    const cumulativeBuckets = [];
    if (pastStats.totalCreated > 0) {
      cumulativeBuckets.push({
        displayLabel: `${pastShort} Cumul`,
        dateKey: '0000-00-01',
        isCumulativeBucket: true,
        totalCreated: pastStats.totalCreated,
        accepted: pastStats.accepted,
        notFeasible: pastStats.notFeasible,
        implementedCount: pastStats.implementedCount,
        target: pastStats.target
      });
    }
    if (curStats.totalCreated > 0) {
      cumulativeBuckets.push({
        displayLabel: `${curShort} Live`,
        dateKey: '0000-00-02',
        isCumulativeBucket: true,
        totalCreated: curStats.totalCreated,
        accepted: curStats.accepted,
        notFeasible: curStats.notFeasible,
        implementedCount: curStats.implementedCount,
        target: curStats.target
      });
    }

    const dateMap = new Map();
    filteredRecords.forEach((item) => {
      const ymd = normalizeDateToYMD(item.date) || 'Undated';
      if (!dateMap.has(ymd)) {
        dateMap.set(ymd, {
          dateKey: ymd,
          displayLabel: ymd === 'Undated' ? 'Undated' : formatDisplayDate(ymd),
          displayDate: ymd === 'Undated' ? 'Undated' : formatDisplayDate(ymd),
          totalCreated: 0,
          accepted: 0,
          notFeasible: 0,
          implementedCount: 0,
          target: 0
        });
      }
      const entry = dateMap.get(ymd);
      entry.totalCreated += 1;
      const statusStr = String(item.status || '').trim().toLowerCase();
      const decisionStr = String(item.rejectedAccepted || '').trim().toLowerCase();
      if (statusStr === 'approved' || statusStr === 'accepted' || decisionStr === 'accepted' || statusStr === 'implemented') {
        entry.accepted += 1;
      }
      if (statusStr === 'not feasible' || statusStr === 'rejected' || decisionStr === 'not feasible' || decisionStr === 'rejected') {
        entry.notFeasible += 1;
      }
      if (statusStr === 'implemented' || (item.dateOfImplementation && String(item.dateOfImplementation).trim() !== '')) {
        entry.implementedCount += 1;
      }
    });

    const dailySorted = Array.from(dateMap.values()).sort((a, b) => {
      if (a.dateKey === 'Undated') return 1;
      if (b.dateKey === 'Undated') return -1;
      return a.dateKey.localeCompare(b.dateKey);
    });

    return [...cumulativeBuckets, ...dailySorted];
  }, [filteredRecords, graphTab, targets, cumulativeYear, graphFromDate, currentMonthNum]);

  // Overall totals for quick summary badges
  const summaryTotals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, item) => {
        acc.totalCreated += 1;
        const statusStr = String(item.status || '').trim().toLowerCase();
        const decisionStr = String(item.rejectedAccepted || '').trim().toLowerCase();
        if (statusStr === 'approved' || statusStr === 'accepted' || decisionStr === 'accepted' || statusStr === 'implemented') {
          acc.accepted += 1;
        }
        if (statusStr === 'not feasible' || statusStr === 'rejected' || decisionStr === 'not feasible' || decisionStr === 'rejected') {
          acc.notFeasible += 1;
        }
        if (statusStr === 'implemented' || (item.dateOfImplementation && String(item.dateOfImplementation).trim() !== '')) {
          acc.implementedCount += 1;
        }
        return acc;
      },
      { totalCreated: 0, accepted: 0, notFeasible: 0, implementedCount: 0 }
    );
  }, [filteredRecords]);

  // Active target line calculation
  const targetLineValue = useMemo(() => {
    if (graphDept !== 'All') {
      return Number(targets[graphDept]) || 0;
    }
    const deptKeys = Object.keys(targets);
    if (deptKeys.length === 0) return 0;
    const sum = deptKeys.reduce((acc, k) => acc + (Number(targets[k]) || 0), 0);
    return Math.round(sum / deptKeys.length) || 10;
  }, [graphDept, targets]);

  // Cumulative monthly data calculation (Target vs Current by Month)
  const cumulativeMonthData = useMemo(() => {
    const v2Store = getStoredDepartmentTargetsV2();
    return MONTHS.map((m) => {
      // Count records created in this month of cumulativeYear
      const monthRecords = records.filter((item) => {
        if (selectedUnit && selectedUnit !== 'All Units' && item.unit && item.unit !== selectedUnit) {
          return false;
        }
        if (graphDept !== 'All') {
          const itemDept = String(item.department || '').trim().toLowerCase();
          const targetDept = String(graphDept).trim().toLowerCase();
          if (itemDept !== targetDept) return false;
        }
        const ymd = normalizeDateToYMD(item.date);
        if (!ymd || !ymd.startsWith(`${cumulativeYear}-`)) return false;
        const mNum = parseInt(ymd.split('-')[1], 10);
        return mNum === m.num;
      });

      const currentCount = monthRecords.length;

      // Target for this month
      let targetCount = 0;
      if (graphDept !== 'All') {
        targetCount = getTargetForDeptAndMonth(graphDept, cumulativeYear, m.num, v2Store, targets);
      } else {
        targetCount = TARGET_DEPARTMENTS.reduce((sum, d) => {
          return sum + getTargetForDeptAndMonth(d, cumulativeYear, m.num, v2Store, targets);
        }, 0);
      }

      const isCurrentMonth =
        new Date().getFullYear() === cumulativeYear &&
        currentMonthNum === m.num;

      return {
        monthNum: m.num,
        monthShort: m.short,
        monthName: m.name,
        target: targetCount,
        current: currentCount,
        isCurrentMonth
      };
    });
  }, [records, selectedUnit, graphDept, cumulativeYear, targets, currentMonthNum]);

  const cumulativeTotals = useMemo(() => {
    return cumulativeMonthData.reduce(
      (acc, m) => {
        acc.target += m.target;
        acc.current += m.current;
        return acc;
      },
      { target: 0, current: 0 }
    );
  }, [cumulativeMonthData]);

  const handleToggleOverall = () => {
    const next = graphView === 'OVERALL' ? 'TIMELINE' : 'OVERALL';
    setGraphView(next);
    if (next === 'OVERALL') {
      setGraphTab('OVERALL');
    } else {
      setGraphTab(suggestionScope);
    }
  };

  const handleToggleDepartment = () => {
    const next = graphView === 'DEPARTMENT' ? 'TIMELINE' : 'DEPARTMENT';
    setGraphView(next);
    if (next === 'DEPARTMENT') {
      setGraphTab('DEPARTMENT');
    } else {
      setGraphTab(suggestionScope);
    }
  };

  const handleResetFilters = () => {
    setGraphTab('ALL');
    setSuggestionScope('ALL');
    setGraphView('TIMELINE');
    setGraphDept('All');
    setGraphFromDate('');
    setGraphToDate('');
    if (onSelectUnit) onSelectUnit('Bawal');
  };

  // Custom Tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const isCumul = payload[0]?.payload?.isCumulativeBucket;
    const titlePrefix = isCumul
      ? 'Cumulative'
      : (graphTab === 'DEPARTMENT'
        ? 'Department'
        : (graphTab === 'OVERALL' ? 'Cumulative Date' : 'Date'));
    return (
      <div className="bg-white/95 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 shadow-xl text-xs space-y-2 min-w-[210px]">
        <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex items-center justify-between">
          <span>{titlePrefix}: {label}</span>
          <span className="text-[10px] text-slate-400 font-semibold">
            {graphTab === 'DEPARTMENT' ? 'Overview' : (graphDept === 'All' ? 'All Depts' : graphDept)}
          </span>
        </div>
        <div className="space-y-1.5 pt-0.5">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 font-medium text-slate-600">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color || entry.fill }}
                />
                <span>{entry.name}:</span>
              </div>
              <span className="font-bold text-slate-900">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const combinedDepartmentOptions = useMemo(() => {
    const set = new Set([...TARGET_DEPARTMENTS, ...(departmentList || [])]);
    return Array.from(set).sort();
  }, [departmentList]);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight flex items-center gap-2">
              <span>Suggestion Analytics Overview</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                Unit: {selectedUnit}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Monthly Cumulative tracking + 4-bar series & target lines
            </p>
          </div>
        </div>
      </div>

      {/* 2. Graph Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Group 1: Suggestion Scope (All Suggestion / Best Suggestion) */}
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs flex-wrap gap-0.5">
            <button
              type="button"
              onClick={() => {
                setSuggestionScope('ALL');
                if (graphView === 'TIMELINE') setGraphTab('ALL');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                suggestionScope === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All Suggestion
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestionScope('BEST');
                if (graphView === 'TIMELINE') setGraphTab('BEST');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                suggestionScope === 'BEST'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Best Suggestion</span>
            </button>
          </div>

          {/* Group 2: Department Overview - Separated from All/Best */}
          <div className="flex bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
            <button
              type="button"
              onClick={handleToggleDepartment}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                graphView === 'DEPARTMENT'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              title="Toggle Department Overview Breakdown"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Department Overview</span>
            </button>
          </div>

          {/* Unit Filter (placed in filters toolbar) */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-500">Unit:</span>
            <select
              value={selectedUnit || 'Bawal'}
              onChange={(e) => onSelectUnit && onSelectUnit(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
            >
              <option value="Bawal">Bawal</option>
              <option value="Gujrat">Gujrat</option>
              <option value="All Units">All Units</option>
            </select>
          </div>

          {/* Department Filter (Visible when not in Department Overview) */}
          {graphView !== 'DEPARTMENT' && (
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-500">Dept:</span>
              <select
                value={graphDept}
                onChange={(e) => setGraphDept(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                <option value="All">All Departments</option>
                {combinedDepartmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* From - To Calendar Filter */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={graphFromDate}
              onChange={(e) => setGraphFromDate(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            />
            <span className="font-semibold text-slate-400 px-0.5">To:</span>
            <input
              type="date"
              value={graphToDate}
              onChange={(e) => setGraphToDate(e.target.value)}
              className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            />
          </div>

          {/* Reset Filters Button */}
          {(suggestionScope !== 'ALL' || graphView !== 'TIMELINE' || graphDept !== 'All' || graphFromDate || graphToDate || (selectedUnit && selectedUnit !== 'Bawal')) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
              title="Reset Graph Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Target Line Popup Trigger Button */}
        <button
          type="button"
          onClick={() => setIsTargetModalOpen(true)}
          className="px-3.5 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-orange-500/20 transition-all cursor-pointer"
          title="Open Target Line Selection Popup (Year & Months)"
        >
          <Target className="w-4 h-4 shrink-0" />
          <span>Target Line</span>
          {targetLineValue > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/25 text-[10px] font-extrabold">
              {targetLineValue}
            </span>
          )}
        </button>
      </div>

      {/* 3. Main Content: Bar Chart (Full Width, Centered Fixed KPI Badges, 5 Bar Candles) */}
      <div className="w-full bg-white rounded-2xl border border-slate-200 p-3.5 pt-2.5 flex flex-col justify-between shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1 pb-1 text-slate-500 font-medium">
          <span>
            {graphTab === 'DEPARTMENT'
              ? 'Department Overview (Total, Accepted, Not-Feasible, Implemented, Target per Dept)'
              : (graphTab === 'OVERALL' ? 'Overall Cumulative Progression' : 'Timeline with Past/Live Cumulative (5 Bar Series)')}
          </span>
          <span className="text-[11px] font-bold text-slate-400">
            {filteredRecords.length} records
          </span>
        </div>

        {/* Centered Fixed KPI Badges (4 Metrics: Total, Accept, Not-Feasible, Implemented) */}
        <div className="w-full flex items-center justify-center py-2 px-2 border-b border-slate-100 mb-2 shrink-0">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-blue-50/90 border border-blue-200/90 text-blue-800 flex items-center gap-1.5 text-xs font-semibold shadow-2xs">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Total: <strong>{summaryTotals.totalCreated}</strong></span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-emerald-800 flex items-center gap-1.5 text-xs font-semibold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Accept: <strong>{summaryTotals.accepted}</strong></span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-rose-50/90 border border-rose-200/90 text-rose-800 flex items-center gap-1.5 text-xs font-semibold shadow-2xs">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Not-Feasible: <strong>{summaryTotals.notFeasible}</strong></span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-purple-50/90 border border-purple-200/90 text-purple-800 flex items-center gap-1.5 text-xs font-semibold shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Implemented: <strong>{summaryTotals.implementedCount}</strong></span>
            </div>
          </div>
        </div>

        <div className="w-full h-[390px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                barGap={0}
                barCategoryGap={graphTab === 'DEPARTMENT' ? '8%' : '14%'}
                margin={{ top: 22, right: 25, left: -10, bottom: graphTab === 'DEPARTMENT' ? 16 : 14 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="displayLabel"
                  tick={{ fill: '#0F172A', fontSize: graphTab === 'DEPARTMENT' ? 11 : 13, fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  interval={0}
                  angle={0}
                  textAnchor="middle"
                  height={graphTab === 'DEPARTMENT' ? 32 : 28}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* 1. Target Bar Candle */}
                <Bar
                  dataKey="target"
                  name="Target"
                  fill="#F97316"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={graphTab === 'DEPARTMENT' ? 44 : 32}
                >
                  <LabelList content={renderCustomBarLabel} />
                </Bar>
                {/* 2. Total Bar */}
                <Bar
                  dataKey="totalCreated"
                  name="Total"
                  fill="#3B82F6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={graphTab === 'DEPARTMENT' ? 44 : 32}
                >
                  <LabelList content={renderCustomBarLabel} />
                </Bar>
                {/* 3. Accept Bar */}
                <Bar
                  dataKey="accepted"
                  name="Accept"
                  fill="#10B981"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={graphTab === 'DEPARTMENT' ? 44 : 32}
                >
                  <LabelList content={renderCustomBarLabel} />
                </Bar>
                {/* 4. Not- Feasible Bar */}
                <Bar
                  dataKey="notFeasible"
                  name="Not- Feasible"
                  fill="#EF4444"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={graphTab === 'DEPARTMENT' ? 44 : 32}
                >
                  <LabelList content={renderCustomBarLabel} />
                </Bar>
                {/* 5. Implemented Bar */}
                <Bar
                  dataKey="implementedCount"
                  name="Implemented"
                  fill="#8B5CF6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={graphTab === 'DEPARTMENT' ? 44 : 32}
                >
                  <LabelList content={renderCustomBarLabel} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400 gap-2">
              <TrendingUp className="w-8 h-8 opacity-40 text-slate-400" />
              <p className="text-xs font-semibold text-slate-500">
                No suggestion checksheet records found for the selected filters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Target Selection Popup Modal (Year & Multiple Months Checkboxes) */}
      <SuggestionTargetModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        targets={targets}
        onSaveTargets={(newTargets) => setTargets(newTargets)}
      />
    </div>
  );
}
