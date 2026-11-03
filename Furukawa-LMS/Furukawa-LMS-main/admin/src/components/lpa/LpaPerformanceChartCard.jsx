import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { BarChart3, ChevronDown, EyeOff, FileSpreadsheet, Layers, RotateCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/ui/card.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { Input } from '@/components/forms/primitives/input.jsx';
import { Label } from '@/components/forms/primitives/label.jsx';

import { COLORS, SHEET_META, SHIFT_KEYS, shiftLevelKey } from '../../pages/lpa/lpaGraphUtils.js';

const SHEET_VIEWS = [
  { key: 'both', label: 'Both Sheets' },
  { key: 'assembly', label: 'Assembly Sheet' },
  { key: 'cc', label: 'C&C Sheet' }
];

// Bar colour = level; the shift is written inside each bar. Badge order = bar order.
const LEVEL_DEFS = [
  { level: 'L3', name: 'Level 3 Score (%)', color: COLORS.level3 },
  { level: 'L2', name: 'Level 2 Score (%)', color: COLORS.level2 },
  { level: 'L1', name: 'Level 1 Score (%)', color: COLORS.level1 }
];

// One bar per shift + level pair, grouped by shift: A·L3, A·L2, A·L1, B·L3, ...
const PAIR_DEFS = SHIFT_KEYS.flatMap(shift => LEVEL_DEFS.map(({ level, color }) => {
  const key = shiftLevelKey(shift, level);
  return {
    key,
    shift,
    level,
    name: `Shift ${shift} · Level ${level.slice(1)}`,
    color,
    value: (slot) => slot.shiftLevelScores?.[key] ?? null
  };
}));

const BELOW_TARGET_COLOR = '#dc2626';
const TARGET_LINE_COLOR = '#374151'; // dark grey
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
  customRange = { from: '', to: '' },
  onCustomRangeChange,
  targets = { assembly: 85, cc: 85 },
  onTargetChange,
  isAdmin,
  onReset,
  onHide
}) {
  const targetFor = (sheet) => targets?.[sheet] ?? 85;
  const activeSheets = activeTab === 'both' ? ['assembly', 'cc'] : [activeTab];
  // One shared line is enough when every visible sheet has the same target
  const sharedTarget = activeSheets.every(s => targetFor(s) === targetFor(activeSheets[0]))
    ? targetFor(activeSheets[0])
    : null;
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [hiddenLevels, setHiddenLevels] = useState(() => new Set()); // levels toggled off via the badges
  const isBoth = activeTab === 'both';
  const hasData = slots.length > 0;

  const periodOptions = useMemo(() => [
    { key: '7d', label: 'Last 7 Days' },
    { key: '14d', label: 'Last 14 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { group: 'Month', options: monthOptions },
    { key: 'all', label: 'All Recorded Dates' },
    { key: 'custom', label: 'Custom Date Range' }
  ], [monthOptions]);

  // Shift + level pairs with no audit in the current range are dropped so they don't leave gaps
  const seriesDefs = useMemo(
    () => PAIR_DEFS.filter(def => slots.some(s => def.value(s) != null)),
    [slots]
  );
  // Level badges: only levels that have at least one bar
  const levelBadges = LEVEL_DEFS.filter(l => seriesDefs.some(def => def.level === l.level));

  const toggleLevel = (level) => {
    setHiddenLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  // Wide enough that a "100%" label fits above every visible bar in a slot
  const visibleBarCount = Math.max(1, seriesDefs.filter(def => !hiddenLevels.has(def.level)).length);
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
      return y != null && y < targetFor(s.sheet)
        ? { y, borderColor: BELOW_TARGET_COLOR, borderWidth: 2 }
        : { y };
    });

    // Different Assembly / C&C targets: draw a short dashed target segment over each slot
    // at that slot's sheet target instead of one full-width line
    const targetSegments = sharedTarget == null
      ? [{
        type: 'line',
        id: 'target-segments',
        name: 'Target',
        color: TARGET_LINE_COLOR,
        dashStyle: 'Dash',
        lineWidth: 2,
        zIndex: 4,
        marker: { enabled: false },
        enableMouseTracking: false,
        states: { hover: { enabled: false }, inactive: { enabled: false } },
        dataLabels: { enabled: false },
        connectNulls: false,
        data: slots.flatMap((s, i) => {
          const t = targetFor(s.sheet);
          return [{ x: i - 0.45, y: t }, { x: i + 0.45, y: t }, { x: i + 0.45, y: null }];
        })
      }]
      : [];

    return {
      chart: {
        height: 420,
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
        plotLines: sharedTarget == null ? [] : [{
          value: sharedTarget,
          color: TARGET_LINE_COLOR,
          dashStyle: 'Dash',
          width: 2,
          zIndex: 4,
          label: {
            text: `Target: ${sharedTarget}%`,
            align: 'right',
            x: -6,
            style: { color: TARGET_LINE_COLOR, fontSize: '13px', fontWeight: '700' }
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
          // Centre the bars that have data in their date slot (skips null levels/shifts)
          centerInCategory: true,
          dataLabels: [
            // Score above the bar (red when below that sheet's target)
            {
              enabled: true,
              inside: false,
              crop: false,
              overflow: 'allow',
              formatter() {
                if (this.y == null) return '';
                const slotTarget = targetFor(slots[this.point.index]?.sheet);
                const color = this.y < slotTarget ? BELOW_TARGET_COLOR : '#334155';
                return `<span style="color:${color}">${this.y}%</span>`;
              },
              style: { fontSize: '13px', fontWeight: '800', textOutline: '2px white' }
            },
            // Shift name written vertically inside the bar (skipped when the bar is too short)
            {
              enabled: true,
              inside: true,
              verticalAlign: 'bottom',
              rotation: -90,
              y: -6,
              crop: false,
              overflow: 'allow',
              formatter() {
                if (this.y == null || this.y < 20) return '';
                return `Shift ${this.series.userOptions.custom?.shift ?? ''}`;
              },
              style: { color: '#ffffff', fontSize: '11px', fontWeight: '700', textOutline: '1px rgba(15,23,42,0.35)' }
            }
          ]
        }
      },
      responsive: {
        rules: [{
          condition: { maxWidth: 767 },
          chartOptions: {
            chart: { height: 400 }
          }
        }]
      },
      series: [
        ...seriesDefs.map(def => ({
          type: 'column',
          id: def.key,
          name: def.name,
          color: def.color,
          visible: !hiddenLevels.has(def.level),
          custom: { shift: def.shift },
          data: seriesPoints(def)
        })),
        ...targetSegments
      ]
    };
    // targetFor only reads `targets`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, isBoth, needsScroll, slotWidth, targets, sharedTarget, seriesDefs, hiddenLevels]);

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
              Daily scores per shift (written in each bar), coloured by level, with target benchmark.{' '}
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
          {/* Left: filters */}
          <div className="flex flex-wrap items-end gap-4">
            <FilterSelect label="Period" value={dateRange} onChange={onDateRangeChange} options={periodOptions} />

            {/* Custom range is always visible; picking a date switches Period to Custom */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Custom From</Label>
              <Input
                type="date"
                value={customRange.from}
                max={customRange.to || undefined}
                onChange={(e) => onCustomRangeChange?.({ ...customRange, from: e.target.value })}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Custom To</Label>
              <Input
                type="date"
                value={customRange.to}
                min={customRange.from || undefined}
                onChange={(e) => onCustomRangeChange?.({ ...customRange, to: e.target.value })}
                className="h-8 w-36 text-xs"
              />
            </div>

            {activeSheets.map(sheet => (
              <div key={sheet} className="flex flex-col gap-1.5">
                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  {SHEET_META[sheet].label} Target %
                </Label>
                {isAdmin ? (
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={targetFor(sheet)}
                    onChange={(e) => onTargetChange(sheet, e.target.value)}
                    className="h-8 w-20 text-xs font-bold text-gray-800"
                    title={`Admin: Change ${SHEET_META[sheet].fullLabel} target %`}
                  />
                ) : (
                  <span className="h-8 inline-flex items-center text-xs font-bold text-gray-700">{targetFor(sheet)}%</span>
                )}
              </div>
            ))}

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

          {/* Right: level colour badges (click to show/hide that level) + target */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pb-1">
            {levelBadges.map(def => {
              const hidden = hiddenLevels.has(def.level);
              return (
                <button
                  key={def.level}
                  type="button"
                  onClick={() => toggleLevel(def.level)}
                  aria-pressed={!hidden}
                  title={hidden ? `Show ${def.name}` : `Hide ${def.name}`}
                  className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-opacity cursor-pointer hover:bg-slate-50 ${hidden ? 'opacity-40 line-through text-slate-400' : 'text-slate-700'}`}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: def.color }} />
                  {def.name}
                </button>
              );
            })}
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 pl-3 border-l border-slate-200">
              <span className="w-4 border-t-2 border-dashed border-gray-700" />
              {sharedTarget != null
                ? `Target ${sharedTarget}%`
                : activeSheets.map(s => `${SHEET_META[s].label} ${targetFor(s)}%`).join(' · ')}
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
              key={`${activeTab}-${slots.length}`}
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${scoreTone(row.avgScore, targetFor(row.sheet)).pill}`}>
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
