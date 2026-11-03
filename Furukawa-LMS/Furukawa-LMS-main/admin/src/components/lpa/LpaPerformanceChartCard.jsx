import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { BarChart3, ChevronDown, EyeOff, FileSpreadsheet, Layers, RotateCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/ui/card.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { Input } from '@/components/forms/primitives/input.jsx';
import { Label } from '@/components/forms/primitives/label.jsx';

import { COLORS, SHEET_META, SHIFT_KEYS, LEVEL_KEYS, shiftLevelKey } from '../../pages/lpa/lpaGraphUtils.js';

const SHEET_VIEWS = [
  { key: 'both', label: 'Both Sheets' },
  { key: 'assembly', label: 'Assembly Sheet' },
  { key: 'cc', label: 'C&C Sheet' }
];

const BREAKDOWN_VIEWS = [
  { key: 'level', label: 'By Level' },
  { key: 'shift', label: 'By Shift' }
];

// Shift hue, darker for higher levels: [L3, L2, L1]
const SHIFT_LEVEL_SHADES = {
  A: ['#1d4ed8', '#3b82f6', '#93c5fd'],
  B: ['#047857', '#10b981', '#6ee7b7'],
  C: ['#b45309', '#f59e0b', '#fcd34d'],
  G: ['#6d28d9', '#8b5cf6', '#c4b5fd']
};

// Bar order inside each slot; the legend badges follow the same order
const SERIES_DEFS = {
  level: [
    { key: 'level3Score', name: 'Level 3 Score (%)', color: COLORS.level3 },
    { key: 'level2Score', name: 'Level 2 Score (%)', color: COLORS.level2 },
    { key: 'level1Score', name: 'Level 1 Score (%)', color: COLORS.level1 }
  ].map(def => ({ ...def, value: (slot) => slot[def.key] })),
  // One bar per shift + level pair: Shift A · L3, Shift A · L2, ... Shift G · L1
  shift: SHIFT_KEYS.flatMap(shift => LEVEL_KEYS.map((level, i) => {
    const key = shiftLevelKey(shift, level);
    return {
      key,
      name: `Shift ${shift} · ${level} (%)`,
      tag: `${shift}·${level}`,
      color: SHIFT_LEVEL_SHADES[shift][i],
      value: (slot) => slot.shiftLevelScores?.[key] ?? null
    };
  }))
};

const BELOW_TARGET_COLOR = '#dc2626';
const VIEWPORT_WIDTH = 800;
const BAR_SLOT_WIDTH = 58; // room for one bar plus its "100%" label

const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function scoreTone(score, target) {
  if (score >= target) return { text: '#059669', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
  if (score >= 70) return { text: '#d97706', pill: 'bg-amber-50 text-amber-700 border border-amber-200' };
  return { text: '#e11d48', pill: 'bg-rose-50 text-rose-700 border border-rose-200' };
}

const SHEET_PILL = {
  assembly: 'bg-blue-50 text-blue-700 border border-blue-200',
  cc: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
};

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 shadow-xs focus:border-blue-500 focus:outline-none cursor-pointer hover:bg-slate-50"
        >
          {options.map(o => (o.group ? (
            <optgroup key={o.group} label={o.group}>
              {o.options.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </optgroup>
          ) : (
            <option key={o.key} value={o.key}>{o.label}</option>
          )))}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

/**
 * Single SDP-style graph card for LPA Assembly & C&C sheets: in-card sheet view
 * toggles, filter bar, grouped Highcharts chart and collapsible daily table.
 */
export default function LpaPerformanceChartCard({
  slots,
  tableRows,
  totalSheets,
  activeTab,
  onTabChange,
  unitLabel,
  dateRange,
  onDateRangeChange,
  monthOptions = [],
  breakdownMode = 'level',
  onBreakdownModeChange,
  customRange = { from: '', to: '' },
  onCustomRangeChange,
  targetBenchmark,
  onTargetChange,
  isAdmin,
  onReset,
  onHide
}) {
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState(() => new Set()); // series keys toggled off via the badges
  const isBoth = activeTab === 'both';
  const isShiftMode = breakdownMode === 'shift';
  const hasData = slots.length > 0;

  const periodOptions = useMemo(() => [
    { key: '7d', label: 'Last 7 Days' },
    { key: '14d', label: 'Last 14 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { group: 'Month', options: monthOptions },
    { key: 'all', label: 'All Recorded Dates' },
    { key: 'custom', label: 'Custom Date Range…' }
  ], [monthOptions]);

  // Shift + level pairs with no audit in the current range are dropped so they don't leave gaps
  const seriesDefs = useMemo(() => {
    if (!isShiftMode) return SERIES_DEFS.level;
    return SERIES_DEFS.shift.filter(def => slots.some(s => def.value(s) != null));
  }, [isShiftMode, slots]);

  const toggleSeries = (key) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Wide enough that a "100%" label fits above every visible bar in a slot
  const visibleBarCount = Math.max(1, seriesDefs.filter(def => !hiddenSeries.has(def.key)).length);
  const slotWidth = Math.max(isBoth ? 190 : 170, visibleBarCount * BAR_SLOT_WIDTH + 20);
  const needsScroll = slots.length * slotWidth > VIEWPORT_WIDTH;

  const chartOptions = useMemo(() => {
    const categories = slots.map(slot => {
      const dateHtml = `<span style="color:#64748b;font-size:14px;font-weight:800;display:inline-block;margin-top:4px;${slot.isGroupStart ? '' : 'visibility:hidden'}">${escapeHtml(slot.formattedDate)}</span>`;
      const emptyHtml = slot.isEmpty ? '<br/><span style="color:#94a3b8;font-size:12px;font-weight:600">No audit</span>' : '';
      if (!isBoth) return `<span style="color:#64748b;font-size:14px;font-weight:800">${escapeHtml(slot.formattedDate)}</span>${emptyHtml}`;
      const sheetHtml = `<span style="color:${SHEET_META[slot.sheet].color};font-size:14px;font-weight:800">${escapeHtml(slot.sheetLabel)}</span>`;
      return `${sheetHtml}<br/>${dateHtml}${emptyHtml}`;
    });

    // Dashed separators between date groups (Both mode only)
    const groupSeparators = isBoth
      ? slots
        .map((slot, i) => (slot.isGroupStart && i > 0 ? i - 0.5 : null))
        .filter(v => v !== null)
        .map(value => ({ value, width: 1, dashStyle: 'Dash', color: '#cbd5e1', zIndex: 3 }))
      : [];

    // Bars below the target keep their series colour (so shifts/levels stay identifiable)
    // and get a red outline; their data label is red too
    const seriesPoints = (def) => slots.map(s => {
      const y = def.value(s);
      return y != null && y < targetBenchmark
        ? { y, borderColor: BELOW_TARGET_COLOR, borderWidth: 2 }
        : { y };
    });

    return {
      chart: {
        height: 560,
        marginBottom: isBoth ? 105 : 80,
        style: { fontFamily: 'inherit' },
        animation: { duration: 400 },
        ...(needsScroll && {
          scrollablePlotArea: { minWidth: slots.length * slotWidth, scrollPositionX: 1, opacity: 1 }
        })
      },
      title: { text: '' },
      credits: { enabled: false },
      xAxis: {
        categories,
        crosshair: true,
        lineWidth: 1,
        lineColor: '#e9ecef',
        labels: {
          useHTML: true,
          rotation: 0,
          align: 'center',
          style: { textAlign: 'center', lineHeight: '1.4' }
        },
        gridLineWidth: 0,
        plotLines: groupSeparators
      },
      yAxis: {
        min: 0,
        max: 105,
        tickPositions: [0, 20, 40, 60, 80, 100],
        title: { text: 'Score %', style: { color: '#94a3b8', fontSize: '14px', fontWeight: 'bold' } },
        labels: { format: '{value}%', style: { fontSize: '14px', fontWeight: 'bold' } },
        gridLineColor: '#f1f5f9',
        plotLines: [{
          value: targetBenchmark,
          color: COLORS.benchmark,
          dashStyle: 'Dash',
          width: 2,
          zIndex: 4,
          label: {
            text: `Target: ${targetBenchmark}%`,
            align: 'right',
            x: -6,
            style: { color: '#059669', fontSize: '13px', fontWeight: '700' }
          }
        }]
      },
      // Series are labelled by the clickable badges in the filter bar instead
      legend: { enabled: false },
      tooltip: { enabled: false },
      plotOptions: {
        column: {
          borderRadius: 4,
          borderWidth: 0,
          pointPadding: 0.08,
          groupPadding: 0.18,
          maxPointWidth: 42,
          dataLabels: {
            enabled: true,
            inside: false,
            crop: false,
            overflow: 'allow',
            formatter() {
              if (this.y == null) return '';
              const color = this.y < targetBenchmark ? BELOW_TARGET_COLOR : '#334155';
              // In By Shift view each bar also names its shift + level, since there is no tooltip
              const tag = this.series.userOptions.custom?.tag;
              const tagHtml = tag ? `<br/><span style="color:#64748b;font-size:10px;font-weight:700">${tag}</span>` : '';
              return `<span style="color:${color}">${this.y}%</span>${tagHtml}`;
            },
            style: { fontSize: '13px', fontWeight: '800', textOutline: '2px white' }
          }
        }
      },
      responsive: {
        rules: [{
          condition: { maxWidth: 767 },
          chartOptions: {
            chart: { height: 520 }
          }
        }]
      },
      series: seriesDefs.map(def => ({
        type: 'column',
        id: def.key,
        name: def.name,
        color: def.color,
        visible: !hiddenSeries.has(def.key),
        custom: { tag: def.tag },
        data: seriesPoints(def)
      }))
    };
  }, [slots, isBoth, needsScroll, slotWidth, targetBenchmark, seriesDefs, hiddenSeries]);

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-slate-800">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              LPA Analytics & Performance Graph
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {totalSheets} Sheets
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                {unitLabel}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {isShiftMode
                ? 'Daily scores for each shift and level (e.g. A·L3 = Shift A, Level 3) with target benchmark.'
                : 'Daily scores by hierarchy levels (Level 3, Level 2, Level 1) with target benchmark.'}{' '}
              <span className="font-semibold text-red-600">Bars outlined in red are below target.</span>
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-1">
            {SHEET_VIEWS.map(({ key, label }) => (
              <Button
                key={key}
                variant={activeTab === key ? 'default' : 'outline'}
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => onTabChange(key)}
              >
                {key === 'assembly' && <FileSpreadsheet className="h-3.5 w-3.5" />}
                {key === 'cc' && <Layers className="h-3.5 w-3.5" />}
                {label}
              </Button>
            ))}
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

        {/* Filter bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end justify-between gap-4">
          {/* Left: breakdown toggle + filters */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Breakdown</Label>
              <div className="flex gap-1">
                {BREAKDOWN_VIEWS.map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={breakdownMode === key ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => onBreakdownModeChange?.(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <FilterSelect label="Period" value={dateRange} onChange={onDateRangeChange} options={periodOptions} />

            {dateRange === 'custom' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">From</Label>
                  <Input
                    type="date"
                    value={customRange.from}
                    max={customRange.to || undefined}
                    onChange={(e) => onCustomRangeChange?.({ ...customRange, from: e.target.value })}
                    className="h-8 w-36 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">To</Label>
                  <Input
                    type="date"
                    value={customRange.to}
                    min={customRange.from || undefined}
                    onChange={(e) => onCustomRangeChange?.({ ...customRange, to: e.target.value })}
                    className="h-8 w-36 text-xs"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Target %</Label>
              {isAdmin ? (
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={targetBenchmark}
                  onChange={(e) => onTargetChange(e.target.value)}
                  className="h-8 w-20 text-xs font-bold text-emerald-800"
                  title="Admin: Change Target Line %"
                />
              ) : (
                <span className="h-8 inline-flex items-center text-xs font-bold text-emerald-700">{targetBenchmark}%</span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs text-slate-500 hover:text-slate-800 self-end"
              onClick={onReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>

          {/* Right: series badges (click to show/hide a series) + target */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-1">
            {seriesDefs.map(def => {
              const hidden = hiddenSeries.has(def.key);
              return (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => toggleSeries(def.key)}
                  aria-pressed={!hidden}
                  title={hidden ? `Show ${def.name}` : `Hide ${def.name}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-opacity cursor-pointer hover:bg-slate-50 ${hidden ? 'opacity-40 line-through text-slate-400' : 'text-slate-700'}`}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: def.color }} />
                  {def.name}
                </button>
              );
            })}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 pl-3 border-l border-slate-200">
              <span className="w-4 border-t-2 border-dashed border-emerald-500" />
              Target {targetBenchmark}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
            <FileSpreadsheet size={36} className="text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No Sheet Records for this Filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              There are no saved LPA records matching the selected sheet, timeframe or unit.
            </p>
            <Button variant="outline" size="sm" className="mt-3 h-8 px-3 text-xs" onClick={onReset}>
              Reset Filters
            </Button>
          </div>
        ) : (
          <>
            <style>{`
              .highcharts-scrollable-mask {
                fill: #ffffff !important;
                fill-opacity: 1 !important;
                opacity: 1 !important;
              }
            `}</style>
            <HighchartsReact
              key={`${activeTab}-${breakdownMode}-${slots.length}`}
              highcharts={Highcharts}
              options={chartOptions}
              updateArgs={[true, true, true]}
            />
          </>
        )}

        {/* Collapsible Daily Data Table */}
        {tableRows.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-slate-400" />
                Daily Activity Breakdown ({tableRows.length} row{tableRows.length === 1 ? '' : 's'})
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
                      {isBoth && <th className="px-3 py-2.5">Sheet</th>}
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
                    {tableRows.map((row) => (
                      <tr key={`${row.date}-${row.sheet}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.date}</td>
                        {isBoth && (
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${SHEET_PILL[row.sheet]}`}>
                              {row.sheetLabel}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{row.totalSheets}</td>
                        <td className="px-3 py-2.5 text-center text-blue-600 font-semibold">{row.shiftA || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-600 font-semibold">{row.shiftB || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-purple-600 font-semibold">{(row.shiftC + row.shiftG) || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-cyan-600 font-medium">{row.level3 || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-purple-600 font-medium">{row.level2 || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-pink-600 font-medium">{row.level1 || '-'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${scoreTone(row.avgScore, targetBenchmark).pill}`}>
                            {row.avgScore}%
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
      </CardContent>
    </Card>
  );
}
