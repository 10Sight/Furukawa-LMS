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
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/ui/card.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { normalizePDCAStatus } from '../../pages/pdca/data/pdcaConstants.js';

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

/**
 * Bar series config. Order here is the left-to-right order of bars in each slot.
 * Tailwind class strings are kept as full literals so they survive purging.
 */
const SERIES = [
  {
    key: 'total',
    label: 'Total',
    color: '#7c3e8c',
    grad: 'url(#totalGrad)',
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
    grad: 'url(#inProgressGrad)',
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
    grad: 'url(#doneGrad)',
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
    grad: 'url(#delayGrad)',
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
    grad: 'url(#notStartedGrad)',
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
 * PDCAMonthlyGraph (Daily / Monthly / Yearly PDCA Status Graph)
 *
 * Shows, for the current sheet's observations only:
 *  - Grouped status bars per slot (Total, In-Progress, Done, Delay, Not-Started).
 *    A bar is drawn only when its count is > 0.
 *  - Two leading cumulative slots before the period's own bars (Daily / Monthly):
 *      1. Previous cumulative — previous month (Daily) or previous year (Monthly)
 *      2. Live cumulative — current month (Daily) or current year (Monthly) to date
 *  - Today's column is highlighted and auto-scrolled into view; yesterday's
 *    column gets a subtle amber highlight.
 */
export default function PDCAMonthlyGraph({
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
    if (currentDate) {
      const parsed = new Date(currentDate);
      if (!isNaN(parsed.getTime())) d = parsed;
    } else if (topic?.date) {
      const parsed = new Date(topic.date);
      if (!isNaN(parsed.getTime())) d = parsed;
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

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  // Observations from the current sheet only
  const activeItems = useMemo(() => {
    const defaultDateStr = currentDate || topic?.date;
    const parseRow = (r) => {
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

      const dateStr = r.date || defaultDateStr || new Date().toISOString().slice(0, 10);
      let parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        const parts = String(dateStr).split(/[-/]/);
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            parsedDate = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
          } else {
            // DD/MM/YY(YY) — treat a 2-digit year as 20YY (otherwise '26' becomes 1926)
            const y = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
            parsedDate = new Date(y, parseInt(parts[1], 10) - 1, parts[0]);
          }
        }
      }

      const valid = !isNaN(parsedDate.getTime());
      const year = valid ? parsedDate.getFullYear() : defaultYear;
      const month = valid ? parsedDate.getMonth() : defaultMonth;
      const day = valid ? parsedDate.getDate() : 1;

      const rawStatus = normalizePDCAStatus(r.status);
      let category = 'notStarted';
      if (rawStatus === 'Done') category = 'done';
      else if (rawStatus === 'In- Progress') category = 'inProgress';
      else if (rawStatus === 'Delay') category = 'delay';

      return { year, month, day, fullDateStr: toDateKey(year, month, day), status: rawStatus, category };
    };

    const list = [];
    (rows || []).forEach(r => {
      const item = parseRow(r);
      if (item) list.push(item);
    });
    return list;
  }, [rows, currentDate, topic?.date, defaultYear, defaultMonth]);

  // Distinct years available in dataset (descending)
  const availableYears = useMemo(() => {
    const set = new Set([defaultYear, new Date().getFullYear()]);
    activeItems.forEach(i => set.add(i.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [activeItems, defaultYear]);

  const daysInSelectedMonth = useMemo(
    () => new Date(selectedYear, selectedMonth + 1, 0).getDate(),
    [selectedYear, selectedMonth]
  );

  // When this PDCA started: the earliest month that has an observation on the sheet
  const pdcaStart = useMemo(() => {
    let start = null;
    activeItems.forEach(i => {
      if (!start || i.year < start.year || (i.year === start.year && i.month < start.month)) {
        start = { year: i.year, month: i.month };
      }
    });
    return start;
  }, [activeItems]);

  // One 'prev' cumulative slot per past year (from the PDCA start year up to the year before `uptoYear`)
  const buildPastYearSlots = (uptoYear) => {
    const slots = new Map();
    if (!pdcaStart) return slots;
    for (let y = pdcaStart.year; y < uptoYear; y++) {
      const from = y === pdcaStart.year && pdcaStart.month > 0 ? ` (from ${FULL_MONTH_NAMES[pdcaStart.month]})` : '';
      slots.set(y, makeCumulSlot('prev', `${y} Cumul`, `${y} Cumulative${from}`));
    }
    return slots;
  };

  // Daily statistics for selectedMonth & selectedYear:
  // [Past year cumulatives…, Past month cumulatives of selectedYear…, Live current month, day 1 … day N]
  // Past cumulatives start from when the PDCA started.
  const dailyStats = useMemo(() => {
    const yearSlots = buildPastYearSlots(selectedYear);

    const monthSlots = new Map();
    if (pdcaStart && pdcaStart.year <= selectedYear) {
      const firstMonth = pdcaStart.year === selectedYear ? pdcaStart.month : 0;
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

    return [...yearSlots.values(), ...monthSlots.values(), liveSlot, ...days];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, pdcaStart, selectedYear, selectedMonth, daysInSelectedMonth, targetTodayStr, realTodayStr, yesterdayStr]);

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

  // Monthly view dataset: [Past year cumulatives (from PDCA start)…, Live current year, Jan … Dec]
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
    return [...yearSlots.values(), liveSlot, ...monthlyStats];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, pdcaStart, monthlyStats, selectedYear]);

  // Yearly statistics across all years present in the data
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
    return data;
  }, [activeItems, availableYears]);

  // Live cumulative (sum of all months) for selectedYear — used by the side table
  const allMonthsCumulativeTotal = useMemo(
    () => monthlyStats.reduce((acc, m) => acc + m.total, 0),
    [monthlyStats]
  );

  const hasCumulSlots = viewTimeframe !== 'yearly';

  const currentDataset = useMemo(() => {
    const base =
      viewTimeframe === 'daily' ? dailyStats : viewTimeframe === 'monthly' ? monthlyDataset : yearlyStats;
    return base.filter(d => !d.cumulKind || visibleCumul[d.cumulKind]);
  }, [viewTimeframe, dailyStats, monthlyDataset, yearlyStats, visibleCumul]);

  // Index of the last leading cumulative slot (a separator is drawn after it)
  const lastCumulIndex = currentDataset.reduce((acc, d, i) => (d.cumulKind ? i : acc), -1);

  // Overall KPIs for the current view (cumulative slots excluded)
  const kpis = useMemo(() => {
    const totals = emptyCounts();
    currentDataset.forEach(d => {
      if (d.cumulKind) return;
      SERIES.forEach(s => { totals[s.key] += d[s.key]; });
    });
    return totals;
  }, [currentDataset]);

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
    if (item.cumulKind) return item.fullDateStr;
    if (viewTimeframe === 'daily') return `${FULL_MONTH_NAMES[selectedMonth]} ${item.day}, ${selectedYear}`;
    if (viewTimeframe === 'monthly') return `${item.fullName} ${selectedYear}`;
    return `Year ${item.year}`;
  };

  // Max value for chart Y-axis scaling (includes visible cumulative slots)
  const maxChartValue = useMemo(() => {
    let max = 0;
    currentDataset.forEach(item => {
      SERIES.forEach(s => {
        if (visibleSeries[s.key] && item[s.key] > max) max = item[s.key];
      });
    });
    if (max <= 4) return 5;
    // Headroom for the value label above the tallest bar, rounded to a multiple of 5
    return Math.ceil((max * 1.08) / 5) * 5;
  }, [currentDataset, visibleSeries]);

  // SVG Chart Geometry
  const slotCount = currentDataset.length;
  const minSlotWidth = viewTimeframe === 'daily' ? 118 : viewTimeframe === 'monthly' ? 124 : 180;
  const padding = { top: 34, right: 25, bottom: 70, left: 52 };
  // Yearly usually has only a few slots: size it to its content (drawn at natural size,
  // centered) instead of stretching one or two columns across the whole card.
  const isCompactChart = viewTimeframe === 'yearly';
  const graphWidth = isCompactChart
    ? Math.max(300, slotCount * minSlotWidth)
    : Math.max(880, slotCount * minSlotWidth);
  const svgWidth = graphWidth + padding.left + padding.right;
  const svgHeight = 415;
  const graphHeight = svgHeight - padding.top - padding.bottom;
  const graphBottom = padding.top + graphHeight;

  const getY = (val) => padding.top + graphHeight - (val / maxChartValue) * graphHeight;
  const slotWidth = graphWidth / slotCount;
  const getXCenter = (idx) => padding.left + idx * slotWidth + slotWidth / 2;

  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i <= count; i++) ticks.push(Math.round((maxChartValue / count) * i));
    return ticks;
  }, [maxChartValue]);

  // Auto-scroll today's column into the centre of the horizontal scroller.
  // Keyed on the index (not the dataset) so editing sheet rows doesn't re-scroll.
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
      // The SVG scales to fill its wrapper, so convert viewBox units to pixels
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
                ? 'Daily PDCA Status Graph'
                : viewTimeframe === 'monthly'
                ? 'Monthly PDCA Status Graph'
                : 'Yearly PDCA Status Graph'}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {periodLabel}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                {activeItems.length} Observations
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {viewTimeframe === 'daily'
                ? `Daily breakdown for ${FULL_MONTH_NAMES[selectedMonth]} ${selectedYear}, led by cumulative bars since the PDCA started`
                : viewTimeframe === 'monthly'
                ? `Monthly breakdown for ${selectedYear}, led by yearly cumulative bars since the PDCA started`
                : 'Year-by-year breakdown'}
            </CardDescription>
          </div>

          {/* All filters & actions — top right */}
          <div className="flex flex-wrap items-center justify-end gap-1.5 lg:ml-auto">
            {viewTimeframe === 'daily' && (
              <FilterSelect
                label="Month"
                value={selectedMonth}
                onChange={(v) => setSelectedMonth(parseInt(v, 10))}
                options={FULL_MONTH_NAMES.map((name, idx) => ({ key: idx, label: name }))}
              />
            )}
            {viewTimeframe !== 'yearly' && (
              <FilterSelect
                label="Year"
                value={selectedYear}
                onChange={(v) => setSelectedYear(parseInt(v, 10))}
                options={availableYears.map(y => ({ key: y, label: String(y) }))}
              />
            )}
            <span className="hidden sm:block w-px h-6 mx-1 bg-slate-200" aria-hidden="true" />
            {TIMEFRAMES.map(tf => (
              <Button
                key={tf.key}
                variant={viewTimeframe === tf.key ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
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
                    <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded ${badgeClass}`}>{kpis[s.key]}</span>
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
                      {allMonthsCumulativeTotal}
                    </span>
                  </button>
                ) : (
                  <div className="w-full md:w-52 lg:w-56 shrink-0 bg-white rounded-lg border border-slate-200 shadow-2xs flex flex-col overflow-hidden animate-in fade-in duration-150">
                    <div className="px-2.5 py-1.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Cumulative
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
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
                  </div>
                )
              )}

              {/* SVG Graph View inside horizontal scroll */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div ref={scrollContainerRef} className="w-full overflow-x-auto pb-3.5 pt-1 flex-1 flex flex-col justify-end">
                  <div
                    style={isCompactChart ? { width: `${svgWidth}px` } : { minWidth: `${Math.max(680, svgWidth)}px` }}
                    className={`flex flex-col mb-1.5 ${isCompactChart ? 'mx-auto shrink-0' : 'flex-1'}`}
                  >
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      width={isCompactChart ? svgWidth : undefined}
                      height={isCompactChart ? svgHeight : undefined}
                      className={isCompactChart ? 'select-none' : 'w-full h-auto select-none flex-1'}
                      style={isCompactChart ? undefined : { minHeight: '395px' }}
                    >
                      <defs>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3e8c" />
                          <stop offset="100%" stopColor="#7c3e8c" />
                        </linearGradient>
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
                              x={padding.left - 10}
                              y={y + 5}
                              textAnchor="end"
                              className="text-[13px] fill-slate-500 font-mono font-semibold"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Columns (Days / Months / Years) & Bars */}
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
                        else if (item.isCurrentDate) colFill = 'rgba(59, 130, 246, 0.06)';
                        else if (item.isYesterday) colFill = 'rgba(245, 158, 11, 0.08)';
                        else if (item.cumulKind === 'prev') colFill = 'rgba(148, 163, 184, 0.12)';
                        else if (item.cumulKind === 'live') colFill = 'rgba(99, 102, 241, 0.08)';
                        if (item.isCurrentDate) {
                          colStroke = 'rgba(59, 130, 246, 0.35)';
                          colDash = '3 2';
                        } else if (item.isYesterday) {
                          colStroke = 'rgba(245, 158, 11, 0.35)';
                          colDash = '3 2';
                        } else if (item.cumulKind === 'prev') {
                          colStroke = 'rgba(100, 116, 139, 0.35)';
                          colDash = '3 3';
                        } else if (item.cumulKind === 'live') {
                          colStroke = 'rgba(99, 102, 241, 0.35)';
                        }

                        const labelClass = item.isCurrentDate
                          ? 'fill-blue-700 font-black'
                          : item.cumulKind === 'prev'
                          ? 'fill-slate-600 font-extrabold'
                          : item.cumulKind === 'live'
                          ? 'fill-indigo-700 font-extrabold'
                          : isHovered
                          ? 'fill-blue-600 font-bold'
                          : item.isYesterday
                          ? 'fill-amber-800 font-bold'
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
                                    {b.val}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Current date badge (behind label) */}
                            {item.isCurrentDate && (
                              <rect
                                x={xCenter - 34}
                                y={graphBottom + 8}
                                width="68"
                                height="24"
                                rx="5"
                                fill="#EFF6FF"
                                stroke="#3B82F6"
                                strokeWidth="1.5"
                              />
                            )}

                            {/* X-axis label */}
                            <text
                              x={xCenter}
                              y={graphBottom + 25}
                              textAnchor="middle"
                              className={`text-[14px] tracking-tight transition-colors ${labelClass}`}
                            >
                              {item.label}
                            </text>

                            {/* Yesterday pill */}
                            {item.isYesterday && !item.isCurrentDate && (
                              <g>
                                <rect
                                  x={xCenter - 36}
                                  y={graphBottom + 35}
                                  width="72"
                                  height="19"
                                  rx="9.5"
                                  fill="#FFFBEB"
                                  stroke="#FCD34D"
                                  strokeWidth="1"
                                />
                                <text
                                  x={xCenter}
                                  y={graphBottom + 48.5}
                                  textAnchor="middle"
                                  className="text-[11px] font-bold fill-amber-800"
                                >
                                  Yesterday
                                </text>
                              </g>
                            )}

                            {/* Dot indicator if slot has data */}
                            {item.total > 0 && !item.isYesterday && (
                              <circle
                                cx={xCenter}
                                cy={svgHeight - 10}
                                r="2.5"
                                fill={
                                  item.isCurrentDate || isHovered
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
                        const suffix = item.isCurrentDate ? ' (Today)' : item.isYesterday ? ' (Yesterday)' : '';

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
                              {suffix && (
                                <tspan className={item.isCurrentDate ? 'fill-blue-700' : 'fill-amber-700'}>{suffix}</tspan>
                              )}
                            </text>
                            {lines.map((l, i) => (
                              <g key={l.label}>
                                <circle cx={tipX + 16} cy={tipY + 45 + i * rowH} r="4.5" fill={l.color} />
                                <text x={tipX + 28} y={tipY + 50 + i * rowH} className="text-[14px] font-medium fill-slate-600">
                                  {l.label}
                                </text>
                                <text x={tipX + tipW - 12} y={tipY + 50 + i * rowH} textAnchor="end" className="text-[14px] font-bold font-mono fill-slate-800">
                                  {l.val}
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
