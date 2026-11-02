import React, { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { BarChart3, ChevronDown, EyeOff, FileSpreadsheet, Layers, RotateCcw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/common/ui/card.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { Input } from '@/components/forms/primitives/input.jsx';
import { Label } from '@/components/forms/primitives/label.jsx';

import { COLORS, SHEET_META } from '../../pages/lpa/lpaGraphUtils.js';

const SHEET_VIEWS = [
  { key: 'both', label: 'Both Sheets' },
  { key: 'assembly', label: 'Assembly Sheet' },
  { key: 'cc', label: 'C&C Sheet' }
];

const DATE_RANGES = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '14d', label: 'Last 14 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Recorded Dates' }
];

const VIEWPORT_WIDTH = 800;

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
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
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
  targetBenchmark,
  onTargetChange,
  isAdmin,
  onReset,
  onHide
}) {
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const isBoth = activeTab === 'both';
  const hasData = slots.length > 0;

  // Wide enough that a "100%" label fits above each of the 3 bars
  const slotWidth = isBoth ? 140 : 130;
  const needsScroll = slots.length * slotWidth > VIEWPORT_WIDTH;

  const chartOptions = useMemo(() => {
    const categories = slots.map(slot => {
      const dateHtml = `<span style="color:#64748b;font-size:12px;font-weight:800;display:inline-block;margin-top:4px;${slot.isGroupStart ? '' : 'visibility:hidden'}">${escapeHtml(slot.formattedDate)}</span>`;
      const emptyHtml = slot.isEmpty ? '<br/><span style="color:#94a3b8;font-size:10px;font-weight:600">No audit</span>' : '';
      if (!isBoth) return `<span style="color:#64748b;font-size:12px;font-weight:800">${escapeHtml(slot.formattedDate)}</span>${emptyHtml}`;
      const sheetHtml = `<span style="color:${SHEET_META[slot.sheet].color};font-size:12px;font-weight:800">${escapeHtml(slot.sheetLabel)}</span>`;
      return `${sheetHtml}<br/>${dateHtml}${emptyHtml}`;
    });

    // Dashed separators between date groups (Both mode only)
    const groupSeparators = isBoth
      ? slots
        .map((slot, i) => (slot.isGroupStart && i > 0 ? i - 0.5 : null))
        .filter(v => v !== null)
        .map(value => ({ value, width: 1, dashStyle: 'Dash', color: '#cbd5e1', zIndex: 3 }))
      : [];

    return {
      chart: {
        height: 440,
        marginBottom: isBoth ? 95 : 70,
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
        title: { text: 'Score %', style: { color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' } },
        labels: { format: '{value}%', style: { fontSize: '12px', fontWeight: 'bold' } },
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
            style: { color: '#059669', fontSize: '11px', fontWeight: '700' }
          }
        }]
      },
      legend: {
        enabled: true,
        align: 'right',
        verticalAlign: 'top',
        layout: 'horizontal',
        itemStyle: { fontSize: '12px', fontWeight: 'bold', color: '#475569' }
      },
      tooltip: {
        shared: true,
        useHTML: true,
        outside: true,
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 12,
        style: { fontSize: '12px' },
        formatter() {
          const first = this.points?.[0] ?? this;
          const idx = first.point?.index ?? first.index;
          const slot = slots[idx];
          if (!slot) return false;

          const sheet = SHEET_META[slot.sheet];
          const header =
            `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">` +
            `<span style="background:${sheet.color}1a;color:${sheet.color};border:1px solid ${sheet.color}55;border-radius:999px;padding:1px 8px;font-weight:700;font-size:11px">${escapeHtml(sheet.fullLabel)}</span>` +
            `<b style="color:#1e293b">${escapeHtml(slot.formattedDate)}</b></div>`;

          if (slot.isEmpty) {
            return `${header}<span style="color:#64748b">No audit recorded for ${escapeHtml(sheet.fullLabel)} on this date.</span>`;
          }

          const met = slot.avgScore >= targetBenchmark;
          const tone = scoreTone(slot.avgScore, targetBenchmark);
          const levelRow = (name, color, val) =>
            `<div style="display:flex;justify-content:space-between;gap:16px"><span><span style="color:${color}">■</span> ${name}</span><b style="font-family:monospace">${val != null ? `${val}%` : '—'}</b></div>`;

          return (
            header +
            `<div style="min-width:200px">` +
            `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:2px"><span style="font-weight:600;color:#334155">Overall Score</span><b style="color:${tone.text}">${slot.avgScore}%</b></div>` +
            `<div style="display:flex;justify-content:space-between;gap:16px;font-size:11px;color:#64748b"><span>Target ${targetBenchmark}%</span><b style="color:${met ? '#059669' : '#e11d48'}">${met ? 'Target Met' : 'Below Target'}</b></div>` +
            `<div style="border-top:1px solid #f1f5f9;margin-top:6px;padding-top:6px;font-size:11px;color:#475569">` +
            levelRow('Level 3', COLORS.level3, slot.level3Score) +
            levelRow('Level 2', COLORS.level2, slot.level2Score) +
            levelRow('Level 1', COLORS.level1, slot.level1Score) +
            `</div>` +
            `<div style="margin-top:6px;font-size:11px;color:#64748b">Sheets audited: <b>${slot.totalSheets}</b></div>` +
            `</div>`
          );
        }
      },
      plotOptions: {
        column: {
          borderRadius: 4,
          borderWidth: 0,
          pointPadding: 0.08,
          groupPadding: 0.18,
          maxPointWidth: 28,
          dataLabels: {
            enabled: true,
            inside: false,
            crop: false,
            overflow: 'allow',
            formatter() { return this.y != null ? `${this.y}%` : ''; },
            style: { fontSize: '10px', fontWeight: '800', color: '#334155', textOutline: '2px white' }
          }
        }
      },
      responsive: {
        rules: [{
          condition: { maxWidth: 767 },
          chartOptions: {
            chart: { height: 460 },
            legend: { align: 'center', itemStyle: { fontSize: '11px' } }
          }
        }]
      },
      series: [
        { type: 'column', name: 'Level 3 Score (%)', color: COLORS.level3, data: slots.map(s => s.level3Score) },
        { type: 'column', name: 'Level 2 Score (%)', color: COLORS.level2, data: slots.map(s => s.level2Score) },
        { type: 'column', name: 'Level 1 Score (%)', color: COLORS.level1, data: slots.map(s => s.level1Score) }
      ]
    };
  }, [slots, isBoth, needsScroll, slotWidth, targetBenchmark]);

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
              Daily scores by hierarchy levels (Level 3, Level 2, Level 1) with target benchmark
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
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-4">
          <FilterSelect label="Timeframe" value={dateRange} onChange={onDateRangeChange} options={DATE_RANGES} />

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
