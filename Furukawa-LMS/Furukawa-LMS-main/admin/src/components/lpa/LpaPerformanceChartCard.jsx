import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { BarChart3, ChevronDown, FileSpreadsheet, Layers, RotateCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/ui/card.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { Input } from '@/components/forms/primitives/input.jsx';
import { Label } from '@/components/forms/primitives/label.jsx';

import { COLORS, SHEET_META, SHIFT_KEYS, shiftLevelKey } from '../../pages/lpa/lpaGraphUtils.js';

// Period = bar grouping. Default window: Daily -> current month, Monthly -> current
// year, Yearly -> all years. Custom From / To replaces the default window.
const PERIOD_OPTIONS = [
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' }
];

const PERIOD_DESCRIPTIONS = {
  daily: 'Daily scores',
  monthly: 'Monthly scores',
  yearly: 'Yearly scores'
};

// Card title per sheet view
const CHART_TITLES = {
  both: 'LPA Analytics & Performance Graph',
  assembly: 'Assembly LPA Trend',
  cc: 'C&C LPA Trend'
};

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
const TARGET_LABEL_MARGIN = 115; // px right of the plot area, fits "Assembly 100%"
const VIEWPORT_WIDTH = 800;
const BAR_SLOT_WIDTH = 58; // room for one bar plus its "100%" label

const escapeHtml = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');



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
  totalSheets,
  activeTab,
  onTabChange,
  unitLabel,
  period = 'daily',
  onPeriodChange,
  customRange = { from: '', to: '' },
  onCustomRangeChange,
  targets = { assembly: 85, cc: 85 },
  onTargetChange,
  isAdmin,
  onReset
}) {
  // Target labels drawn as HTML over the chart's right margin: [{ key, text, top }]
  const [targetLabelTops, setTargetLabelTops] = useState([]);
  const targetFor = (sheet) => targets?.[sheet] ?? 85;
  const activeSheets = activeTab === 'both' ? ['assembly', 'cc'] : [activeTab];
  // One shared line is enough when every visible sheet has the same target
  const sharedTarget = activeSheets.every(s => targetFor(s) === targetFor(activeSheets[0]))
    ? targetFor(activeSheets[0])
    : null;
  const [hiddenLevels, setHiddenLevels] = useState(() => new Set()); // levels toggled off via the badges
  const isBoth = activeTab === 'both';
  const hasData = slots.length > 0;


  // Shift + level pairs with no audit in the current range are dropped so they don't leave gaps
  const seriesDefs = useMemo(
    () => PAIR_DEFS.filter(def => slots.some(s => def.value(s) != null)),
    [slots]
  );

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

    // Full-width dashed target line(s): one when the visible sheets share a target,
    // otherwise one per sheet (Assembly / C&C).
    // Their labels are NOT Highcharts plot-line labels: when the chart scrolls sideways
    // (many dates) Highcharts covers the area outside the plot with a mask that the CSS
    // below paints opaque white, which hid labels drawn in the right margin. Instead the
    // render event reports each line's pixel height and the labels are drawn as HTML on
    // top of the chart, in the reserved right margin (chart.marginRight).
    let targetLabelDefs;
    if (sharedTarget != null) {
      targetLabelDefs = [{ key: 'shared', value: sharedTarget, text: `Target ${sharedTarget}%`, dashStyle: 'Dash', nudge: 0 }];
    } else {
      const [high, low] = [...activeSheets].sort((a, b) => targetFor(b) - targetFor(a));
      // Close targets: push the two labels apart vertically so they don't overlap each other
      const tooClose = targetFor(high) - targetFor(low) < 6;
      targetLabelDefs = [
        { key: high, value: targetFor(high), text: `${SHEET_META[high].label} ${targetFor(high)}%`, dashStyle: 'Dash', nudge: tooClose ? -8 : 0 },
        { key: low, value: targetFor(low), text: `${SHEET_META[low].label} ${targetFor(low)}%`, dashStyle: 'ShortDash', nudge: tooClose ? 8 : 0 }
      ];
    }
    const targetLines = targetLabelDefs.map(({ value, dashStyle }) => ({
      value,
      color: TARGET_LINE_COLOR,
      dashStyle,
      width: 2,
      zIndex: 4
    }));

    return {
      chart: {
        height: 420,
        marginBottom: isBoth ? 105 : 80,
        // Room right of the plot for the target label(s)
        marginRight: TARGET_LABEL_MARGIN,
        style: { fontFamily: 'inherit' },
        animation: { duration: 400 },
        events: {
          // Vertical pixel position of each target line, for the HTML labels
          render() {
            const axis = this.yAxis?.[0];
            if (!axis) return;
            const next = targetLabelDefs.map(d => ({
              key: d.key,
              text: d.text,
              top: Math.round(axis.toPixels(d.value, false)) + d.nudge
            }));
            setTargetLabelTops(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
          }
        },
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
        plotLines: targetLines
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
            // Shift letter ("A", "B", ...) inside the bottom of the bar, horizontal
            {
              enabled: true,
              inside: true,
              verticalAlign: 'bottom',
              align: 'center',
              rotation: 0,
              y: -4,
              crop: false,
              overflow: 'allow',
              formatter() {
                if (this.y == null || this.y < 10) return '';
                return this.series.userOptions.custom?.shift ?? '';
              },
              style: { color: '#ffffff', fontSize: '16px', fontWeight: '800', textOutline: '1px rgba(15,23,42,0.35)' }
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
        }))
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
              {CHART_TITLES[activeTab] || CHART_TITLES.both}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {totalSheets} Sheets
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                {unitLabel}
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              {PERIOD_DESCRIPTIONS[period] || PERIOD_DESCRIPTIONS.daily} per shift (letter in each bar), coloured by level, with target benchmark.{' '}
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
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end justify-between gap-4">
          {/* Left: filters */}
          <div className="flex flex-wrap items-end gap-4">
            <FilterSelect label="Period" value={period} onChange={onPeriodChange} options={PERIOD_OPTIONS} />

            {/* Optional custom window; when set it replaces the Period's default window */}
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
            {LEVEL_DEFS.map(def => {
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
            <div className="relative">
              <HighchartsReact
                key={`${activeTab}-${slots.length}`}
                highcharts={Highcharts}
                options={chartOptions}
                updateArgs={[true, true, true]}
              />
              {/* Target labels, level with their lines, in the chart's right margin (above the scroll mask) */}
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-10"
                style={{ width: TARGET_LABEL_MARGIN }}
              >
                {targetLabelTops.map(({ key, text, top }) => (
                  <span
                    key={key}
                    className="absolute left-2 -translate-y-1/2 whitespace-nowrap text-[13px] font-bold leading-none"
                    style={{ top, color: TARGET_LINE_COLOR }}
                  >
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
