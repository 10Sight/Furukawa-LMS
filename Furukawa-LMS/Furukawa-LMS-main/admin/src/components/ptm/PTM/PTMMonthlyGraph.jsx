import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  Columns,
  EyeOff,
  Users,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/ui/card.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { normalizePtmStatus, evaluatePtmRowStatus } from '../../../pages/ptm/data/ptmRecordFilters.js';

const TIMEFRAMES = [
  { key: 'daily', label: 'Daily', Icon: CalendarDays },
  { key: 'monthly', label: 'Monthly', Icon: Calendar },
  { key: 'yearly', label: 'Yearly', Icon: CalendarRange }
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_LOOKUP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

/**
 * Parses a PTM date value (supports YYYY-MM-DD, DD-MM-YY(YY), DD-MMM-YY(YY), and multi-line histories).
 * Returns { year, month (0-11), day } or null if empty / 'N/A'.
 */
export function parsePtmDate(rawVal) {
  if (!rawVal) return null;
  const lines = (Array.isArray(rawVal) ? rawVal : String(rawVal).split(/\r?\n/))
    .map((l) => String(l || '').trim())
    .filter((l) => l && l.toUpperCase() !== 'N/A' && l !== '—' && l !== '-');
  if (lines.length === 0) return null;
  const text = lines[lines.length - 1];

  // 1. YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  // 2. DD-MM-YY or DD-MM-YYYY (numeric)
  const dmyNumMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (dmyNumMatch) {
    const day = parseInt(dmyNumMatch[1], 10);
    const month = parseInt(dmyNumMatch[2], 10) - 1;
    const rawY = dmyNumMatch[3];
    const year = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  // 3. DD-MMM-YY or DD-MMM-YYYY or DD MMM YYYY (e.g. '05-Jan-24', '23 Sep 2026')
  const dmyTextMatch = text.match(/^(\d{1,2})[-/.\s]+([A-Za-z]+)[-/.\s]+(\d{2}|\d{4})$/);
  if (dmyTextMatch) {
    const day = parseInt(dmyTextMatch[1], 10);
    const month = MONTH_LOOKUP[dmyTextMatch[2].toLowerCase()];
    const rawY = dmyTextMatch[3];
    const year = rawY.length === 2 ? 2000 + parseInt(rawY, 10) : parseInt(rawY, 10);
    if (month !== undefined && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  return null;
}

/**
 * Extracts the active parsed Start Date (Plan) from a PTM row.
 * Returns { year, month, day } or null if Start Date (Plan) is not selected.
 */
export function extractPtmRowDate(row) {
  if (!row) return null;
  return parsePtmDate(row.startDatePlan);
}

/**
 * Bar series config. Order here is the left-to-right order of bars in each slot.
 * Tailwind class strings are kept as full literals so they survive purging.
 */
const SERIES = [
  {
    key: 'total',
    label: 'Total',
    color: '#7c3e8c',
    grad: 'url(#ptmTotalGrad)',
    textClass: 'fill-[#7c3e8c]',
    swatch: 'bg-[#7c3e8c]',
    activeClass: 'bg-[#7c3e8c]/10 text-[#5e2d6b] border border-[#7c3e8c]/40',
    badgeClass: 'bg-[#7c3e8c]/20 text-[#5e2d6b]',
    valueClass: 'text-[#7c3e8c]'
  },
  {
    key: 'inProgress',
    label: 'In-Progress',
    color: '#F59E0B',
    grad: 'url(#ptmInProgressGrad)',
    textClass: 'fill-amber-700',
    swatch: 'bg-amber-500',
    activeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
    badgeClass: 'bg-amber-200/60 text-amber-900',
    valueClass: 'text-amber-700'
  },
  {
    key: 'done',
    label: 'Done',
    color: '#10B981',
    grad: 'url(#ptmDoneGrad)',
    textClass: 'fill-emerald-700',
    swatch: 'bg-emerald-600',
    activeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    badgeClass: 'bg-emerald-200/60 text-emerald-900',
    valueClass: 'text-emerald-700'
  },
  {
    key: 'delay',
    label: 'Delay',
    color: '#EF4444',
    grad: 'url(#ptmDelayGrad)',
    textClass: 'fill-rose-700',
    swatch: 'bg-rose-600',
    activeClass: 'bg-rose-100 text-rose-900 border border-rose-300',
    badgeClass: 'bg-rose-200 text-rose-800',
    valueClass: 'text-rose-700'
  },
  {
    key: 'notStarted',
    label: 'Not-Started',
    color: '#3B82F6',
    grad: 'url(#ptmNotStartedGrad)',
    textClass: 'fill-blue-700',
    swatch: 'bg-blue-600',
    activeClass: 'bg-blue-100 text-blue-900 border border-blue-300',
    badgeClass: 'bg-blue-200/60 text-blue-900',
    valueClass: 'text-blue-700'
  }
];

const pad2 = (n) => String(n).padStart(2, '0');
const toDateKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const emptyCounts = () => ({ inProgress: 0, done: 0, delay: 0, notStarted: 0, total: 0 });
const addToBucket = (bucket, category) => {
  bucket.total += 1;
  bucket[category] += 1;
};
// A leading cumulative slot ('prev' or 'live') shown before the period's own bars
const makeCumulSlot = (cumulKind, label, fullDateStr) => ({ cumulKind, label, fullDateStr, ...emptyCounts() });

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        title={label}
        className="h-8 appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer hover:bg-slate-50"
      >
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

/**
 * PTMMonthlyGraph (Daily / Monthly / Yearly PTM Status Graph)
 *
 * Matches the PDCA Sheet graph in design, metrics, and cumulative breakdown,
 * with data-wise plotting: only dates that actually contain data (total > 0)
 * are added to the graph; dates without data are excluded.
 */
export default function PTMMonthlyGraph({
  rows = [],
  currentDate = '',
  topic = null,
  onHide
}) {
  const [viewTimeframe, setViewTimeframe] = useState('daily'); // 'daily' | 'monthly' | 'yearly'
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [showCumulativeSection, setShowCumulativeSection] = useState(false);
  const [isCumulativeCollapsed, setIsCumulativeCollapsed] = useState(false);
  const scrollContainerRef = useRef(null);

  // Bar series visibility toggles
  const [visibleSeries, setVisibleSeries] = useState({
    total: true,
    inProgress: true,
    done: true,
    delay: true,
    notStarted: true
  });

  // Leading cumulative slot visibility toggles
  const [visibleCumul, setVisibleCumul] = useState({ live: true, prev: true });

  const toggleSeries = (key) => {
    setVisibleSeries(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Prevent unchecking all bar series
      if (!SERIES.some(s => next[s.key])) return prev;
      return next;
    });
  };

  const toggleCumul = (key) => setVisibleCumul(prev => ({ ...prev, [key]: !prev[key] }));

  // Baseline year & month, sheet date, real today, yesterday (relative to the sheet date)
  const { defaultYear, defaultMonth, targetTodayStr, realTodayStr, yesterdayStr } = useMemo(() => {
    let d = new Date();
    const parsedCurrent = parsePtmDate(currentDate) || parsePtmDate(topic?.date);
    if (parsedCurrent) {
      d = new Date(parsedCurrent.year, parsedCurrent.month, parsedCurrent.day);
    }

    const sysD = new Date();
    const target = toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const real = toDateKey(sysD.getFullYear(), sysD.getMonth(), sysD.getDate());
    const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

    return {
      defaultYear: d.getFullYear(),
      defaultMonth: d.getMonth(), // 0-11
      targetTodayStr: target,
      realTodayStr: real,
      yesterdayStr: toDateKey(y.getFullYear(), y.getMonth(), y.getDate())
    };
  }, [currentDate, topic?.date]);

  // Frozen graph snapshots once a row has End Date (Actual) set
  const frozenRowsRef = useRef(new Map());

  // Dated records from the current PTM sheet only (requires Start Date (Plan); freezes when End Date (Actual) is set)
  const activeItems = useMemo(() => {
    const parseRow = (r, idx) => {
      const parsedDate = extractPtmRowDate(r);
      if (!parsedDate) return null;

      const rowKey = r.id || `row-${idx}`;
      const parsedEndActual = parsePtmDate(r.endDateActual);

      if (parsedEndActual && frozenRowsRef.current.has(rowKey)) {
        return frozenRowsRef.current.get(rowKey);
      }

      const { year, month, day } = parsedDate;
      const explicitStatus = String(r.status || '').trim();
      const rawStatus = explicitStatus
        ? normalizePtmStatus(explicitStatus)
        : normalizePtmStatus(evaluatePtmRowStatus(r).status || 'Not-Started');

      let category = 'notStarted';
      if (rawStatus === 'Done') category = 'done';
      else if (rawStatus === 'In-Progress' || rawStatus === 'In- Progress') category = 'inProgress';
      else if (rawStatus === 'Delay') category = 'delay';

      const entry = { year, month, day, fullDateStr: toDateKey(year, month, day), status: rawStatus, category };

      if (parsedEndActual) {
        frozenRowsRef.current.set(rowKey, entry);
      } else {
        frozenRowsRef.current.delete(rowKey);
      }

      return entry;
    };

    const list = [];
    (rows || []).forEach((r, idx) => {
      const item = parseRow(r, idx);
      if (item) list.push(item);
    });
    return list;
  }, [rows]);

  // Determine best initial year/month from actual data so the user immediately sees populated dates
  const preferredYearMonth = useMemo(() => {
    if (activeItems.length === 0) {
      return { year: defaultYear, month: defaultMonth };
    }
    const hasDefaultMonthData = activeItems.some(
      (i) => i.year === defaultYear && i.month === defaultMonth
    );
    if (hasDefaultMonthData) {
      return { year: defaultYear, month: defaultMonth };
    }
    // Sort chronologically and pick the earliest month with data in the sheet
    const sorted = [...activeItems].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day
    );
    return { year: sorted[0].year, month: sorted[0].month };
  }, [activeItems, defaultYear, defaultMonth]);

  const [selectedYear, setSelectedYear] = useState(preferredYearMonth.year);
  const [selectedMonth, setSelectedMonth] = useState(preferredYearMonth.month);
  const [staffMode, setStaffMode] = useState(false);
  const [staffPercentageMode, setStaffPercentageMode] = useState(false);
  const userChangedPeriodRef = useRef(false);

  // Reset manual flag when switching sheets
  useEffect(() => {
    userChangedPeriodRef.current = false;
  }, [topic?.id]);

  // Sync selectedYear & selectedMonth to a populated period if current selection has no data and user hasn't manually changed period
  useEffect(() => {
    if (userChangedPeriodRef.current) return;
    const currentHasData = activeItems.some(
      (i) => i.year === selectedYear && i.month === selectedMonth
    );
    if (!currentHasData && activeItems.length > 0) {
      setSelectedYear(preferredYearMonth.year);
      setSelectedMonth(preferredYearMonth.month);
    }
  }, [activeItems, preferredYearMonth, selectedYear, selectedMonth]);

  // Distinct years available in dataset (descending)
  const availableYears = useMemo(() => {
    const set = new Set();
    activeItems.forEach(i => set.add(i.year));
    if (set.size === 0) {
      set.add(defaultYear);
      set.add(new Date().getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [activeItems, defaultYear]);

  const daysInSelectedMonth = useMemo(
    () => new Date(selectedYear, selectedMonth + 1, 0).getDate(),
    [selectedYear, selectedMonth]
  );

  // When this PTM started: the earliest month that has a dated activity on the sheet
  const ptmStart = useMemo(() => {
    let start = null;
    activeItems.forEach(i => {
      if (!start || i.year < start.year || (i.year === start.year && i.month < start.month)) {
        start = { year: i.year, month: i.month };
      }
    });
    return start;
  }, [activeItems]);

  // One 'prev' cumulative slot per past year (from the PTM start year up to the year before `uptoYear`)
  const buildPastYearSlots = (uptoYear) => {
    const slots = new Map();
    if (!ptmStart) return slots;
    for (let y = ptmStart.year; y < uptoYear; y++) {
      const from = y === ptmStart.year && ptmStart.month > 0 ? ` (from ${FULL_MONTH_NAMES[ptmStart.month]})` : '';
      slots.set(y, makeCumulSlot('prev', `${y} Cumul`, `${y} Cumulative${from}`));
    }
    return slots;
  };

  // Daily statistics for selectedMonth & selectedYear (DATA-WISE):
  // Only dates that actually contain data (total > 0) are added to the graph.
  const dailyStats = useMemo(() => {
    const yearSlots = buildPastYearSlots(selectedYear);

    const monthSlots = new Map();
    if (ptmStart && ptmStart.year <= selectedYear) {
      const firstMonth = ptmStart.year === selectedYear ? ptmStart.month : 0;
      for (let m = firstMonth; m < selectedMonth; m++) {
        monthSlots.set(m, makeCumulSlot(
          'prev',
          `${MONTH_NAMES[m]} Cumul`,
          `${FULL_MONTH_NAMES[m]} ${selectedYear} Cumulative`
        ));
      }
    }

    const liveSlot = makeCumulSlot(
      'live',
      `${MONTH_NAMES[selectedMonth]} Live`,
      `Live Cumulative (${FULL_MONTH_NAMES[selectedMonth]} ${selectedYear})`
    );

    const days = [];
    for (let d = 1; d <= daysInSelectedMonth; d++) {
      const dateKey = toDateKey(selectedYear, selectedMonth, d);
      days.push({
        isCurrentDate: dateKey === targetTodayStr || dateKey === realTodayStr,
        isYesterday: dateKey === yesterdayStr,
        day: d,
        label: `${d} ${MONTH_NAMES[selectedMonth]}`,
        fullDateStr: dateKey,
        ...emptyCounts()
      });
    }

    activeItems.forEach(item => {
      if (item.year < selectedYear) {
        const slot = yearSlots.get(item.year);
        if (slot) addToBucket(slot, item.category);
      } else if (item.year === selectedYear && item.month < selectedMonth) {
        const slot = monthSlots.get(item.month);
        if (slot) addToBucket(slot, item.category);
      } else if (item.year === selectedYear && item.month === selectedMonth) {
        addToBucket(liveSlot, item.category);
        if (item.day >= 1 && item.day <= days.length) addToBucket(days[item.day - 1], item.category);
      }
    });

    // Single requested change: Only include dates/slots that actually contain data (total > 0)
    const populatedYearSlots = [...yearSlots.values()].filter(s => s.total > 0);
    const populatedMonthSlots = [...monthSlots.values()].filter(s => s.total > 0);
    const populatedLiveSlots = liveSlot.total > 0 ? [liveSlot] : [];
    const populatedDays = days.filter(d => d.total > 0);

    return [...populatedYearSlots, ...populatedMonthSlots, ...populatedLiveSlots, ...populatedDays];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, ptmStart, selectedYear, selectedMonth, daysInSelectedMonth, targetTodayStr, realTodayStr, yesterdayStr]);

  // Monthly statistics (Jan … Dec) for selectedYear — also used by the side table
  const monthlyStats = useMemo(() => {
    const data = MONTH_NAMES.map((name, idx) => ({
      month: name,
      fullName: FULL_MONTH_NAMES[idx],
      label: name,
      monthIndex: idx,
      ...emptyCounts()
    }));
    activeItems.forEach(item => {
      if (item.year === selectedYear && item.month >= 0 && item.month < 12) {
        addToBucket(data[item.month], item.category);
      }
    });
    return data;
  }, [activeItems, selectedYear]);

  // Monthly view dataset: only include cumulative slots and months that contain data (total > 0)
  const monthlyDataset = useMemo(() => {
    const yearSlots = buildPastYearSlots(selectedYear);
    const liveSlot = makeCumulSlot('live', `${selectedYear} Live`, `Live Cumulative (${selectedYear})`);
    activeItems.forEach(item => {
      const slot = yearSlots.get(item.year);
      if (slot) addToBucket(slot, item.category);
    });
    monthlyStats.forEach(m => {
      SERIES.forEach(s => { liveSlot[s.key] += m[s.key]; });
    });
    const populatedYearSlots = [...yearSlots.values()].filter(s => s.total > 0);
    const populatedLiveSlots = liveSlot.total > 0 ? [liveSlot] : [];
    const populatedMonths = monthlyStats.filter(m => m.total > 0);
    return [...populatedYearSlots, ...populatedLiveSlots, ...populatedMonths];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, ptmStart, monthlyStats, selectedYear]);

  // Yearly statistics across all years present in the data (only years with total > 0)
  const yearlyStats = useMemo(() => {
    const years = [...availableYears].sort((a, b) => a - b);
    const byYear = new Map();
    const data = years.map(y => {
      const entry = { year: y, label: String(y), ...emptyCounts() };
      byYear.set(y, entry);
      return entry;
    });
    activeItems.forEach(item => {
      const entry = byYear.get(item.year);
      if (entry) addToBucket(entry, item.category);
    });
    return data.filter(entry => entry.total > 0);
  }, [activeItems, availableYears]);

  // Staff-wise statistics from Responsible Person -> Staff Name across all rows in the sheet
  const staffStats = useMemo(() => {
    const cleanStaffName = (raw) =>
      String(raw || '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();

    const byStaff = new Map();
    (rows || []).forEach((r) => {
      if (!r) return;
      const names = [];
      if (Array.isArray(r.staffEmployees) && r.staffEmployees.length > 0) {
        r.staffEmployees.forEach((emp) => {
          const n = cleanStaffName(emp?.name || emp?.label || '');
          if (n) names.push(n);
        });
      }
      if (names.length === 0) {
        const fallbackName = cleanStaffName(r.staffName || r.staffEmployee || '');
        if (fallbackName) names.push(fallbackName);
      }
      if (names.length === 0) return;

      const explicitStatus = String(r.status || '').trim();
      const rawStatus = explicitStatus
        ? normalizePtmStatus(explicitStatus)
        : normalizePtmStatus(evaluatePtmRowStatus(r).status || 'Not-Started');

      let category = 'notStarted';
      if (rawStatus === 'Done') category = 'done';
      else if (rawStatus === 'In-Progress' || rawStatus === 'In- Progress') category = 'inProgress';
      else if (rawStatus === 'Delay') category = 'delay';

      const uniqueNames = [...new Set(names)];
      uniqueNames.forEach((staffName) => {
        if (!byStaff.has(staffName)) {
          byStaff.set(staffName, {
            label: staffName,
            fullDateStr: staffName,
            ...emptyCounts(),
          });
        }
        addToBucket(byStaff.get(staffName), category);
      });
    });

    return [...byStaff.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // Sheet-level Cumulative across all rows in the current sheet (used in Staff Graph)
  const sheetCumulativeStats = useMemo(() => {
    const counts = emptyCounts();
    (rows || []).forEach((r) => {
      if (!r) return;
      const explicitStatus = String(r.status || '').trim();
      const rawStatus = explicitStatus
        ? normalizePtmStatus(explicitStatus)
        : normalizePtmStatus(evaluatePtmRowStatus(r).status || 'Not-Started');

      let category = 'notStarted';
      if (rawStatus === 'Done') category = 'done';
      else if (rawStatus === 'In-Progress' || rawStatus === 'In- Progress') category = 'inProgress';
      else if (rawStatus === 'Delay') category = 'delay';

      addToBucket(counts, category);
    });
    return counts;
  }, [rows]);

  const isStaffPct = staffMode && staffPercentageMode;
  const toSheetPct = (count) => {
    const total = sheetCumulativeStats.total;
    if (!total) return 0;
    return Math.round((count / total) * 1000) / 10;
  };
  const formatMetricVal = (val) => (isStaffPct ? `${val}%` : val);

  const staffDataset = useMemo(() => {
    const mapBucket = (bucket) => {
      if (!staffPercentageMode) return bucket;
      return {
        ...bucket,
        total: toSheetPct(bucket.total),
        inProgress: toSheetPct(bucket.inProgress),
        done: toSheetPct(bucket.done),
        delay: toSheetPct(bucket.delay),
        notStarted: toSheetPct(bucket.notStarted),
      };
    };

    const sheetCumulSlot = {
      label: 'Cumulative',
      fullDateStr: 'Sheet Cumulative',
      cumulKind: 'live',
      ...mapBucket(sheetCumulativeStats),
    };

    return [sheetCumulSlot, ...staffStats.map(mapBucket)];
  }, [staffStats, sheetCumulativeStats, staffPercentageMode]);

  // Live cumulative (sum of all months) for selectedYear — used by the side table
  const allMonthsCumulativeTotal = useMemo(
    () => monthlyStats.reduce((acc, m) => acc + m.total, 0),
    [monthlyStats]
  );

  const hasCumulSlots = !staffMode && viewTimeframe !== 'yearly';

  const currentDataset = useMemo(() => {
    if (staffMode) return staffDataset;
    const base =
      viewTimeframe === 'daily' ? dailyStats : viewTimeframe === 'monthly' ? monthlyDataset : yearlyStats;
    return base.filter(d => !d.cumulKind || visibleCumul[d.cumulKind]);
  }, [staffMode, staffDataset, viewTimeframe, dailyStats, monthlyDataset, yearlyStats, visibleCumul]);

  // Index of the last leading cumulative slot (a separator is drawn after it)
  const lastCumulIndex = currentDataset.reduce((acc, d, i) => (d.cumulKind ? i : acc), -1);

  // Overall KPIs for the current view (cumulative slots excluded)
  const kpis = useMemo(() => {
    if (isStaffPct) {
      return {
        total: toSheetPct(sheetCumulativeStats.total),
        inProgress: toSheetPct(sheetCumulativeStats.inProgress),
        done: toSheetPct(sheetCumulativeStats.done),
        delay: toSheetPct(sheetCumulativeStats.delay),
        notStarted: toSheetPct(sheetCumulativeStats.notStarted),
      };
    }
    const totals = emptyCounts();
    currentDataset.forEach(d => {
      if (d.cumulKind) return;
      SERIES.forEach(s => { totals[s.key] += d[s.key]; });
    });
    return totals;
  }, [currentDataset, isStaffPct, sheetCumulativeStats]);

  // Period labels
  const periodLabel =
    viewTimeframe === 'daily'
      ? `${FULL_MONTH_NAMES[selectedMonth]} ${selectedYear}`
      : viewTimeframe === 'monthly'
      ? String(selectedYear)
      : yearlyStats.length > 1
      ? `${yearlyStats[0].year} – ${yearlyStats[yearlyStats.length - 1].year}`
      : String(yearlyStats[0]?.year ?? selectedYear);

  const cumulLabels = {
    live: viewTimeframe === 'daily' ? `Live Cumul (${MONTH_NAMES[selectedMonth]})` : `Live Cumul (${selectedYear})`,
    prev: 'Past Cumul'
  };

  const getItemTitle = (item) => {
    if (staffMode) return item.label;
    if (item.cumulKind) return item.fullDateStr;
    if (viewTimeframe === 'daily') return `${FULL_MONTH_NAMES[selectedMonth]} ${item.day}, ${selectedYear}`;
    if (viewTimeframe === 'monthly') return `${item.fullName} ${selectedYear}`;
    return `Year ${item.year}`;
  };

  // Max value for chart Y-axis scaling (includes visible cumulative slots)
  const maxChartValue = useMemo(() => {
    if (isStaffPct) return 100;
    let max = 0;
    currentDataset.forEach(item => {
      SERIES.forEach(s => {
        if (visibleSeries[s.key] && item[s.key] > max) max = item[s.key];
      });
    });
    if (max <= 4) return 5;
    // Headroom for the value label above the tallest bar, rounded to a multiple of 5
    return Math.ceil((max * 1.08) / 5) * 5;
  }, [currentDataset, visibleSeries, isStaffPct]);

  // SVG Chart Geometry
  const slotCount = currentDataset.length;
  const safeSlotCount = Math.max(1, slotCount);
  const minSlotWidth = staffMode ? 145 : viewTimeframe === 'daily' ? 118 : viewTimeframe === 'monthly' ? 124 : 180;
  const padding = { top: 34, right: 25, bottom: 70, left: 52 };
  // Size chart to natural content width when there are only a few data-wise slots
  const isCompactChart = (!staffMode && viewTimeframe === 'yearly') || safeSlotCount * minSlotWidth < 880;
  const graphWidth = isCompactChart
    ? Math.max(300, safeSlotCount * minSlotWidth)
    : Math.max(880, safeSlotCount * minSlotWidth);
  const svgWidth = graphWidth + padding.left + padding.right;
  const svgHeight = 415;
  const graphHeight = svgHeight - padding.top - padding.bottom;
  const graphBottom = padding.top + graphHeight;

  const getY = (val) => padding.top + graphHeight - (val / maxChartValue) * graphHeight;
  const slotWidth = graphWidth / safeSlotCount;
  const getXCenter = (idx) => padding.left + idx * slotWidth + slotWidth / 2;

  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i <= count; i++) ticks.push(Math.round((maxChartValue / count) * i));
    return ticks;
  }, [maxChartValue]);

  // Auto-scroll today's column into the centre of the horizontal scroller if present.
  const currentDateIndex = useMemo(
    () => (viewTimeframe === 'daily' ? currentDataset.findIndex(d => d.isCurrentDate) : -1),
    [viewTimeframe, currentDataset]
  );

  useEffect(() => {
    if (currentDateIndex === -1) return undefined;
    const frame = requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      const inner = el?.firstElementChild;
      if (!el || !inner) return;
      const scale = inner.offsetWidth / svgWidth;
      const slotX = (padding.left + currentDateIndex * slotWidth + slotWidth / 2) * scale;
      el.scrollTo({ left: Math.max(0, slotX - el.clientWidth / 2), behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDateIndex, selectedMonth, selectedYear, svgWidth]);

  const hoveredItem = hoveredIndex !== null ? currentDataset[hoveredIndex] : null;

  return (
    <Card className="w-full shrink-0 rounded-2xl border-slate-200/80 bg-white animate-in fade-in">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-800">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              {viewTimeframe === 'daily'
                ? 'Daily PTM Status Graph'
                : viewTimeframe === 'monthly'
                ? 'Monthly PTM Status Graph'
                : 'Yearly PTM Status Graph'}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {periodLabel}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                {activeItems.length} Observations
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {viewTimeframe === 'daily'
                ? `Data-wise breakdown for ${FULL_MONTH_NAMES[selectedMonth]} ${selectedYear} (showing only dates with data), led by cumulative bars since the PTM started`
                : viewTimeframe === 'monthly'
                ? `Monthly breakdown for ${selectedYear}, led by yearly cumulative bars since the PTM started`
                : 'Year-by-year breakdown'}
            </CardDescription>
          </div>

          {/* All filters & actions — top right */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 lg:ml-auto">
            {viewTimeframe === 'daily' && (
              <FilterSelect
                label="Month"
                value={selectedMonth}
                onChange={(v) => {
                  userChangedPeriodRef.current = true;
                  setSelectedMonth(parseInt(v, 10));
                  setHoveredIndex(null);
                }}
                options={FULL_MONTH_NAMES.map((name, idx) => ({ key: idx, label: name }))}
              />
            )}
            {viewTimeframe !== 'yearly' && (
              <FilterSelect
                label="Year"
                value={selectedYear}
                onChange={(v) => {
                  userChangedPeriodRef.current = true;
                  const nextYear = parseInt(v, 10);
                  setSelectedYear(nextYear);
                  // If the currently selected month has no data in the newly chosen year, jump to the first month with data in that year
                  const hasMonthInYear = activeItems.some(i => i.year === nextYear && i.month === selectedMonth);
                  if (!hasMonthInYear) {
                    const firstInYear = activeItems
                      .filter(i => i.year === nextYear)
                      .sort((a, b) => a.month - b.month)[0];
                    if (firstInYear) setSelectedMonth(firstInYear.month);
                  }
                  setHoveredIndex(null);
                }}
                options={availableYears.map(y => ({ key: y, label: String(y) }))}
              />
            )}
            <span className="hidden sm:block w-px h-6 mx-1 bg-slate-200" aria-hidden="true" />
            {TIMEFRAMES.map(tf => (
              <Button
                key={tf.key}
                variant={!staffMode && viewTimeframe === tf.key ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  setStaffMode(false);
                  setViewTimeframe(tf.key);
                  setHoveredIndex(null);
                }}
              >
                <tf.Icon className="h-3.5 w-3.5" />
                {tf.label}
              </Button>
            ))}
            <span className="hidden sm:block w-px h-6 mx-1 bg-slate-200" aria-hidden="true" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800"
              onClick={() => setShowCumulativeSection(prev => !prev)}
              title={showCumulativeSection ? 'Hide Cumulative section' : 'Show Cumulative section'}
            >
              <Columns className="h-3.5 w-3.5" />
              {showCumulativeSection ? 'Hide Cumulative' : 'Show Cumulative'}
            </Button>
            {onHide && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800"
                onClick={onHide}
                title="Hide graph"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hide Graph
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="bg-slate-50/50 rounded-xl border border-slate-200/80 p-3 relative">
            {/* Metrics & trend line toggles (centered) */}
            <div className="w-full flex items-center justify-center flex-wrap gap-2.5 sm:gap-4 mb-3 pb-3 border-b border-slate-200/70">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metrics:</span>
              {SERIES.map(s => {
                const isOn = visibleSeries[s.key];
                const badgeClass = s.key === 'delay' && kpis.delay === 0 ? 'bg-slate-200/60 text-slate-600' : s.badgeClass;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => toggleSeries(s.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold transition-all cursor-pointer ${
                      isOn ? s.activeClass : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                    }`}
                    title={`Toggle ${s.label} series`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-xs ${s.swatch}`} />
                    <span>{s.label}</span>
                    <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded ${badgeClass}`}>{formatMetricVal(kpis[s.key])}</span>
                  </button>
                );
              })}

              {hasCumulSlots && (
                <>
                  <span className="hidden sm:block w-px h-6 bg-slate-200" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => toggleCumul('prev')}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all cursor-pointer ${
                      visibleCumul.prev
                        ? 'bg-slate-100 text-slate-700 border border-dashed border-slate-400'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                    }`}
                    title="Show / hide the previous-period cumulative bars"
                  >
                    <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-500 bg-slate-200" />
                    <span>{cumulLabels.prev}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCumul('live')}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all cursor-pointer ${
                      visibleCumul.live
                        ? 'bg-indigo-50 text-indigo-800 border border-indigo-300'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 line-through opacity-60'
                    }`}
                    title="Show / hide the live cumulative bars"
                  >
                    <span className="w-2.5 h-2.5 rounded-xs border border-indigo-500 bg-indigo-200" />
                    <span>{cumulLabels.live}</span>
                  </button>
                </>
              )}

              <span className="hidden sm:block w-px h-6 bg-slate-200" aria-hidden="true" />
              <button
                type="button"
                onClick={() => {
                  setStaffMode((prev) => !prev);
                  setHoveredIndex(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold transition-all cursor-pointer ${
                  staffMode
                    ? 'bg-blue-600 text-white border border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                }`}
                title="View status breakdown by Staff Name"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff</span>
              </button>
              {staffMode && (
                <button
                  type="button"
                  onClick={() => {
                    setStaffPercentageMode((prev) => !prev);
                    setHoveredIndex(null);
                  }}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-bold transition-all cursor-pointer ${
                    staffPercentageMode
                      ? 'bg-emerald-600 text-white border border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Show Sheet Cumulative & Staff breakdown in Percentage (%)"
                >
                  <span>%</span>
                  <span>Percentage</span>
                </button>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-stretch gap-3">
              {/* Cumulative Section (Month and its Cumulative) */}
              {showCumulativeSection && (
                isCumulativeCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsCumulativeCollapsed(false)}
                    className="w-8 shrink-0 bg-white hover:bg-indigo-50/70 rounded-lg border border-slate-200 shadow-2xs flex flex-col items-center py-2.5 gap-2 text-slate-500 hover:text-indigo-600 transition-all cursor-pointer group select-none"
                    title="Expand Cumulative table"
                    aria-label="Expand Cumulative table"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-bold tracking-widest uppercase text-slate-500 group-hover:text-indigo-700">
                      Cumulative
                    </span>
                    <span className="mt-auto text-[11px] font-mono font-bold px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {staffMode ? formatMetricVal(isStaffPct ? toSheetPct(sheetCumulativeStats.total) : sheetCumulativeStats.total) : allMonthsCumulativeTotal}
                    </span>
                  </button>
                ) : (
                  <div className="w-full md:w-52 lg:w-56 shrink-0 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col overflow-hidden animate-in fade-in duration-150">
                    <div className="px-2.5 py-1.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-bold text-slate-700 uppercase tracking-wide">
                        {staffMode ? 'Sheet Cumulative' : 'Cumulative'}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {staffMode ? (staffPercentageMode ? '%' : 'Sheet') : selectedYear}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCumulativeSection(false)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                          title="Hide Cumulative panel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCumulativeCollapsed(true)}
                          className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                          title="Collapse Cumulative section"
                          aria-label="Collapse Cumulative section"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {staffMode ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 px-2.5 py-1 bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                          <span>Status / Staff</span>
                          <span className="text-right">{staffPercentageMode ? '%' : 'Count'}</span>
                        </div>
                        <div className="flex-1 divide-y divide-slate-100 text-sm overflow-y-auto max-h-[260px] md:max-h-none">
                          {SERIES.filter((s) => s.key !== 'total').map((s) => {
                            const val = isStaffPct ? toSheetPct(sheetCumulativeStats[s.key]) : sheetCumulativeStats[s.key];
                            return (
                              <div key={s.key} className="grid grid-cols-2 px-2.5 py-1 items-center text-slate-700">
                                <span className="text-xs font-semibold flex items-center gap-1.5 truncate">
                                  <span className={`w-2 h-2 rounded-xs shrink-0 ${s.swatch}`} />
                                  {s.label}
                                </span>
                                <span className={`text-right font-mono text-xs font-bold ${s.valueClass}`}>
                                  {formatMetricVal(val)}
                                </span>
                              </div>
                            );
                          })}
                          {staffDataset.filter((d) => !d.cumulKind).length > 0 && (
                            <div className="px-2.5 py-1 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              By Staff
                            </div>
                          )}
                          {staffDataset.filter((d) => !d.cumulKind).map((st) => (
                            <div
                              key={st.label}
                              className="px-2.5 py-1.5 hover:bg-slate-50"
                              title={`${st.label}: Total ${formatMetricVal(st.total)}, Done ${formatMetricVal(st.done)}, In-Progress ${formatMetricVal(st.inProgress)}, Delay ${formatMetricVal(st.delay)}, Not-Started ${formatMetricVal(st.notStarted)}`}
                            >
                              <div className="grid grid-cols-2 items-center">
                                <span className="text-xs font-semibold text-slate-800 truncate">{st.label}</span>
                                <span className="text-right font-mono text-xs font-bold text-indigo-700">
                                  {formatMetricVal(st.total)}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-slate-500 font-mono">
                                {st.done > 0 && <span className="text-emerald-700">D:{formatMetricVal(st.done)}</span>}
                                {st.inProgress > 0 && <span className="text-amber-700">IP:{formatMetricVal(st.inProgress)}</span>}
                                {st.delay > 0 && <span className="text-rose-700">DL:{formatMetricVal(st.delay)}</span>}
                                {st.notStarted > 0 && <span className="text-blue-700">NS:{formatMetricVal(st.notStarted)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 px-2.5 py-1.5 bg-slate-100 border-t border-slate-200 text-sm font-bold text-slate-800">
                          <span>Total</span>
                          <span className="text-right font-mono text-indigo-700">
                            {formatMetricVal(isStaffPct ? toSheetPct(sheetCumulativeStats.total) : sheetCumulativeStats.total)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                    <div className="grid grid-cols-2 gap-2 px-2.5 py-1 bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      <span>Month</span>
                      <span className="text-right">Cumulative</span>
                    </div>
                    <div className="flex-1 divide-y divide-slate-100 text-sm overflow-y-auto max-h-[260px] md:max-h-none">
                      {monthlyStats.map((m, idx) => {
                        const isSelected = viewTimeframe === 'daily' && selectedMonth === idx;
                        return (
                          <div
                            key={m.month}
                            onClick={() => {
                              if (viewTimeframe === 'daily') {
                                userChangedPeriodRef.current = true;
                                setSelectedMonth(idx);
                                setHoveredIndex(null);
                              }
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
                            <span className="text-sm truncate">{m.month}</span>
                            <span className={`text-right font-mono text-sm font-semibold ${
                              m.total > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400'
                            }`}>
                              {m.total}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 px-2.5 py-1.5 bg-slate-100 border-t border-slate-200 text-sm font-bold text-slate-800">
                      <span>Total</span>
                      <span className="text-right font-mono text-indigo-700">{allMonthsCumulativeTotal}</span>
                    </div>
                      </>
                    )}
                  </div>
                )
              )}

              {/* SVG Graph View inside horizontal scroll */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div ref={scrollContainerRef} className="w-full overflow-x-auto pb-3.5 pt-1 flex-1 flex flex-col justify-end">
                  <div
                    style={isCompactChart ? { width: `${svgWidth}px` } : { minWidth: `${Math.max(680, svgWidth)}px` }}
                    className={`flex flex-col mb-1.5 ${isCompactChart ? 'shrink-0' : 'flex-1'}`}
                  >
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      width={isCompactChart ? svgWidth : undefined}
                      height={isCompactChart ? svgHeight : undefined}
                      className={isCompactChart ? 'select-none' : 'w-full h-auto select-none flex-1'}
                      style={isCompactChart ? undefined : { minHeight: '395px' }}
                    >
                      <defs>
                        <linearGradient id="ptmTotalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3e8c" />
                          <stop offset="100%" stopColor="#7c3e8c" />
                        </linearGradient>
                        <linearGradient id="ptmInProgressGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" />
                          <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                        <linearGradient id="ptmDoneGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="ptmDelayGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#EF4444" />
                          <stop offset="100%" stopColor="#DC2626" />
                        </linearGradient>
                        <linearGradient id="ptmNotStartedGrad" x1="0" y1="0" x2="0" y2="1">
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
                              x={padding.left - 10}
                              y={y + 5}
                              textAnchor="end"
                              className="text-[13px] fill-slate-500 font-mono font-semibold"
                            >
                              {isStaffPct ? `${val}%` : val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Empty state message when no dates contain data in the selected period */}
                      {currentDataset.length === 0 && (
                        <text
                          x={svgWidth / 2}
                          y={padding.top + graphHeight / 2}
                          textAnchor="middle"
                          className="text-[13px] fill-slate-400 font-semibold"
                        >
                          {staffMode
                            ? 'No staff assigned in Responsible Person column'
                            : `No dated data available for ${periodLabel}`}
                        </text>
                      )}

                      {/* Columns (Dates with data / Months / Years) & Bars */}
                      {currentDataset.map((item, idx) => {
                        const xCenter = getXCenter(idx);
                        const isHovered = hoveredIndex === idx;
                        const colX = padding.left + idx * slotWidth;

                        // Only series with data (> 0) and enabled get a bar
                        const activeBarsForSlot = SERIES
                          .filter(s => visibleSeries[s.key] && item[s.key] > 0)
                          .map(s => ({ key: s.key, val: item[s.key], grad: s.grad, textClass: s.textClass }));

                        const barCount = activeBarsForSlot.length;
                        const maxBarGroupW = slotWidth * 0.86;
                        const barGap = 4;
                        const calculatedBarW = barCount > 0
                          ? Math.min(28, Math.max(10, (maxBarGroupW - (barCount - 1) * barGap) / barCount))
                          : 0;
                        const totalBarsW = barCount > 0 ? barCount * calculatedBarW + (barCount - 1) * barGap : 0;
                        const barStartX = xCenter - totalBarsW / 2;

                        let colFill = 'transparent';
                        let colStroke = 'none';
                        let colDash = 'none';
                        if (isHovered) colFill = 'rgba(59, 130, 246, 0.12)';
                        else if (item.cumulKind === 'prev') colFill = 'rgba(148, 163, 184, 0.12)';
                        else if (item.cumulKind === 'live') colFill = 'rgba(99, 102, 241, 0.08)';
                        if (item.cumulKind === 'prev') {
                          colStroke = 'rgba(100, 116, 139, 0.35)';
                          colDash = '3 3';
                        } else if (item.cumulKind === 'live') {
                          colStroke = 'rgba(99, 102, 241, 0.35)';
                        }

                        const labelClass = item.cumulKind === 'prev'
                          ? 'fill-slate-600 font-extrabold'
                          : item.cumulKind === 'live'
                          ? 'fill-indigo-700 font-extrabold'
                          : isHovered
                          ? 'fill-blue-600 font-bold'
                          : item.total > 0
                          ? 'fill-slate-700 font-bold'
                          : 'fill-slate-400 font-semibold';

                        return (
                          <g
                            key={idx}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            className="cursor-pointer"
                          >
                            {/* Column background (full height to prevent hover gaps) */}
                            <rect
                              x={colX + 1}
                              y={padding.top}
                              width={slotWidth - 2}
                              height={graphHeight + padding.bottom - 4}
                              fill={colFill}
                              stroke={colStroke}
                              strokeDasharray={colDash}
                              rx="4"
                              className="transition-colors duration-100"
                            />

                            {/* Divider after each slot — solid & stronger after the cumulative slots */}
                            <line
                              x1={colX + slotWidth}
                              y1={padding.top}
                              x2={colX + slotWidth}
                              y2={graphBottom}
                              stroke={idx === lastCumulIndex ? '#94A3B8' : '#CBD5E1'}
                              strokeWidth={idx === lastCumulIndex ? 2 : 1}
                              strokeDasharray={idx === lastCumulIndex ? 'none' : '4 4'}
                            />

                            {/* Grouped Bars */}
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
                                    rx="3"
                                    className="transition-all duration-200 hover:brightness-110"
                                  />
                                  <text
                                    x={bx + calculatedBarW / 2}
                                    y={by - 6}
                                    textAnchor="middle"
                                    className={`text-[15px] font-black ${b.textClass} font-mono`}
                                  >
                                    {formatMetricVal(b.val)}
                                  </text>
                                </g>
                              );
                            })}

                            {/* X-axis label */}
                            <text
                              x={xCenter}
                              y={graphBottom + 25}
                              textAnchor="middle"
                              className={`text-[14px] tracking-tight transition-colors ${labelClass}`}
                            >
                              {item.label}
                            </text>

                            {/* Dot indicator if slot has data */}
                            {item.total > 0 && (
                              <circle
                                cx={xCenter}
                                cy={svgHeight - 10}
                                r="2.5"
                                fill={
                                  isHovered
                                    ? '#2563EB'
                                    : item.cumulKind === 'live'
                                    ? '#6366F1'
                                    : item.cumulKind === 'prev'
                                    ? '#64748B'
                                    : item.delay > 0
                                    ? '#EF4444'
                                    : '#94A3B8'
                                }
                              />
                            )}
                          </g>
                        );
                      })}

                      {/* Hover Tooltip */}
                      {hoveredItem && (() => {
                        const item = hoveredItem;
                        const lines = SERIES.map(s => ({ label: s.label, val: item[s.key], color: s.color }));

                        const rowH = 21;
                        const tipW = item.cumulKind ? 330 : 230;
                        const tipH = 42 + lines.length * rowH;
                        const colX = padding.left + hoveredIndex * slotWidth;
                        const rightX = colX + slotWidth + 8;
                        const tipX = rightX + tipW > svgWidth - padding.right
                          ? Math.max(padding.left, colX - tipW - 8)
                          : rightX;
                        const tipY = padding.top + 4;

                        return (
                          <g pointerEvents="none">
                            <rect
                              x={tipX}
                              y={tipY}
                              width={tipW}
                              height={tipH}
                              rx="8"
                              fill="#FFFFFF"
                              stroke="#CBD5E1"
                              style={{ filter: 'drop-shadow(0 4px 6px rgba(15, 23, 42, 0.12))' }}
                            />
                            <text x={tipX + 12} y={tipY + 24} className="text-[15px] font-bold fill-slate-800">
                              {getItemTitle(item)}
                            </text>
                            {lines.map((l, i) => (
                              <g key={l.label}>
                                <circle cx={tipX + 16} cy={tipY + 45 + i * rowH} r="4.5" fill={l.color} />
                                <text x={tipX + 28} y={tipY + 50 + i * rowH} className="text-[14px] font-medium fill-slate-600">
                                  {l.label}
                                </text>
                                <text x={tipX + tipW - 12} y={tipY + 50 + i * rowH} textAnchor="end" className="text-[14px] font-bold font-mono fill-slate-800">
                                  {formatMetricVal(l.val)}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
