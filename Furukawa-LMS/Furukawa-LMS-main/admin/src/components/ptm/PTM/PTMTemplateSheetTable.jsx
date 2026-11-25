import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TEMPLATE_DEPARTMENTS, PTM_TEMPLATE_PHASES } from '../../../pages/ptm/data/ptmTemplates';

const RANK_CYCLE = ['', 'applicable', 'if_required'];
const DEPT_CYCLE = ['', 'owner', 'support'];

export default function PTMTemplateSheetTable({
  rows = [],
  onChangeRows = () => {},
  readOnly = false,
  onAddRow,
  onDeleteRow,
}) {
  const handleCellChange = (index, field, value) => {
    if (readOnly) return;
    onChangeRows(
      rows.map((row, idx) => {
        if (idx !== index) return row;
        const next = { ...row, [field]: value };
        if (field === 'phaseName') {
          const numMatch = String(value || '').trim().match(/^(\d+)\s*:/);
          next.phaseNo = numMatch ? numMatch[1] : '';
        }
        return next;
      })
    );
  };

  const cycleRank = (index, rankKey) => {
    if (readOnly) return;
    const current = rows[index]?.[rankKey] || '';
    const nextVal = RANK_CYCLE[(RANK_CYCLE.indexOf(current) + 1) % RANK_CYCLE.length];
    handleCellChange(index, rankKey, nextVal);
  };

  const cycleDept = (index, deptKey) => {
    if (readOnly) return;
    const currentDepts = rows[index]?.departments || {};
    const current = currentDepts[deptKey] || '';
    const nextVal = DEPT_CYCLE[(DEPT_CYCLE.indexOf(current) + 1) % DEPT_CYCLE.length];
    onChangeRows(
      rows.map((row, idx) =>
        idx === index
          ? {
              ...row,
              departments: {
                ...(row.departments || {}),
                [deptKey]: nextVal,
              },
            }
          : row
      )
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[#64748B] shadow-sm overflow-auto flex-1 min-h-0 select-none">
      <table className="w-full border-collapse text-xs min-w-[1450px]">
        <thead className="sticky top-0 z-10 border-b border-[#64748B]">
          <tr className="divide-x divide-[#64748B] text-xs font-bold text-center">
            <th className="py-2.5 px-1.5 w-11 bg-[#EEF4FA] text-[#2C5282]">S.No</th>
            <th className="py-2.5 px-2 min-w-[180px] bg-[#EEF4FA] text-[#2C5282] text-left">
              Phase No. / Name
            </th>
            <th className="py-2.5 px-2 min-w-[210px] bg-[#EEF4FA] text-[#2C5282] text-left">
              AIAG APQP Requirements
            </th>
            <th className="py-2.5 px-2 min-w-[170px] bg-[#EEF4FA] text-[#2C5282] text-left">
              Custom Event Name
            </th>
            <th className="py-2.5 px-1 w-11 bg-[#FFF9E6] text-[#975A16]">Rank A</th>
            <th className="py-2.5 px-1 w-11 bg-[#FFF9E6] text-[#975A16]">Rank B</th>
            <th className="py-2.5 px-1 w-14 bg-[#FFF9E6] text-[#975A16]">Rank C1 &amp; C2</th>
            <th className="py-2.5 px-1 w-11 bg-[#FFF9E6] text-[#975A16]">Rank S</th>
            <th className="py-2.5 px-1 w-16 bg-[#F8F9FA] text-[#4A5568]">Critical Activity</th>
            <th className="py-2.5 px-2 min-w-[220px] bg-[#F8F9FA] text-[#4A5568] text-left">
              Activity (New)
            </th>
            {TEMPLATE_DEPARTMENTS.map((dept) => (
              <th
                key={dept.key}
                className="py-2.5 px-1.5 min-w-[46px] bg-[#EAF5EC] text-[#276749] text-center whitespace-nowrap"
              >
                {dept.label}
              </th>
            ))}
            <th className="py-2.5 px-2 min-w-[230px] bg-[#F1F5F9] text-[#2D3748] text-left">
              Deliverable Required Yes / No (if yes than put Format no.)
            </th>
            {!readOnly && (
              <th className="py-2.5 px-2 w-16 bg-slate-100 text-slate-700 text-center">Action</th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#CBD5E1]">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={readOnly ? 20 : 21}
                className="py-8 text-center text-slate-500 text-sm font-medium"
              >
                No rows in this template yet.
                {!readOnly && onAddRow && (
                  <button
                    type="button"
                    onClick={onAddRow}
                    className="ml-2 inline-flex items-center gap-1 text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Row
                  </button>
                )}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={row.id || idx} className="divide-x divide-[#CBD5E1] hover:bg-slate-50/70">
                <td className="py-2 px-1 text-center font-semibold text-slate-700 bg-slate-50/40">
                  {idx + 1}
                </td>

                <td className="p-1">
                  {readOnly ? (
                    <div className="px-1.5 py-1 text-slate-800 font-semibold">
                      {row.phaseName || '—'}
                    </div>
                  ) : (
                    <select
                      value={row.phaseName || ''}
                      onChange={(e) => handleCellChange(idx, 'phaseName', e.target.value)}
                      className="w-full bg-transparent text-slate-800 font-semibold text-xs px-1.5 py-1.5 rounded outline-none focus:bg-amber-50 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Select Phase...</option>
                      {PTM_TEMPLATE_PHASES.map((p) => (
                        <option key={p.key} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>

                <td className="p-0">
                  <div className="flex items-stretch divide-x divide-[#CBD5E1]">
                    <input
                      type="text"
                      value={row.reqNo || ''}
                      readOnly={readOnly}
                      onChange={(e) => handleCellChange(idx, 'reqNo', e.target.value)}
                      placeholder="No."
                      className="w-12 shrink-0 text-center py-2 px-1 text-slate-700 font-mono bg-transparent outline-none focus:bg-amber-50 text-xs"
                    />
                    <input
                      type="text"
                      value={row.reqName || ''}
                      readOnly={readOnly}
                      onChange={(e) => handleCellChange(idx, 'reqName', e.target.value)}
                      placeholder="Requirement..."
                      className="min-w-0 flex-1 py-2 px-2 text-slate-800 bg-transparent outline-none focus:bg-amber-50 text-xs"
                    />
                  </div>
                </td>

                <td className="p-0">
                  <input
                    type="text"
                    value={row.customerEvent || ''}
                    readOnly={readOnly}
                    onChange={(e) => handleCellChange(idx, 'customerEvent', e.target.value)}
                    placeholder="Event name..."
                    className="w-full py-2 px-2 text-slate-800 bg-transparent outline-none focus:bg-amber-50 text-xs"
                  />
                </td>

                {['rankA', 'rankB', 'rankC', 'rankS'].map((rk) => (
                  <td
                    key={rk}
                    onClick={() => cycleRank(idx, rk)}
                    className={`py-1.5 px-1 text-center ${
                      readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-amber-50/70'
                    }`}
                    title={readOnly ? '' : 'Click: ■ Applicable / □ If Required / Clear'}
                  >
                    <div className="flex items-center justify-center">
                      {row[rk] === 'applicable' && (
                        <div className="w-4 h-4 bg-black rounded-xs" />
                      )}
                      {row[rk] === 'if_required' && (
                        <div className="w-4 h-4 border-2 border-black bg-white rounded-xs" />
                      )}
                      {!row[rk] && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                ))}

                <td className="p-1 text-center">
                  {readOnly ? (
                    <span className="font-semibold text-slate-700">
                      {row.critical ? 'Yes ◆' : 'No'}
                    </span>
                  ) : (
                    <select
                      value={row.critical ? 'Yes' : 'No'}
                      onChange={(e) => handleCellChange(idx, 'critical', e.target.value === 'Yes')}
                      className="w-full bg-white border border-slate-300 rounded px-1 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes ◆</option>
                    </select>
                  )}
                </td>

                <td className="p-0">
                  <input
                    type="text"
                    value={row.activity || ''}
                    readOnly={readOnly}
                    onChange={(e) => handleCellChange(idx, 'activity', e.target.value)}
                    placeholder="Type activity description..."
                    className="w-full py-2 px-2 text-slate-800 bg-transparent outline-none focus:bg-amber-50 text-xs"
                  />
                </td>

                {TEMPLATE_DEPARTMENTS.map((dept) => {
                  const val = row.departments?.[dept.key] || '';
                  return (
                    <td
                      key={dept.key}
                      onClick={() => cycleDept(idx, dept.key)}
                      className={`py-1.5 px-1 text-center ${
                        readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-emerald-50/60'
                      }`}
                      title={readOnly ? '' : `${dept.label}: Click to toggle ● Owner / ○ Support / Clear`}
                    >
                      <span className="inline-flex items-center justify-center">
                        {val === 'owner' && (
                          <span className="w-3.5 h-3.5 rounded-full bg-slate-950 inline-block" />
                        )}
                        {val === 'support' && (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 bg-transparent inline-block" />
                        )}
                        {!val && <span className="text-slate-300">·</span>}
                      </span>
                    </td>
                  );
                })}

                <td className="p-1">
                  <div className="flex items-center gap-1.5">
                    {readOnly ? (
                      <span className="text-xs font-semibold text-slate-700 px-1">
                        {row.deliverableRequired || 'Yes'}
                        {(row.deliverableRequired || 'Yes') === 'Yes' && row.deliverable
                          ? ` — ${row.deliverable}`
                          : ''}
                      </span>
                    ) : (
                      <>
                        <select
                          value={row.deliverableRequired || 'Yes'}
                          onChange={(e) =>
                            handleCellChange(idx, 'deliverableRequired', e.target.value)
                          }
                          className="w-[54px] shrink-0 rounded border border-[#64748B] bg-white px-1 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                        {(row.deliverableRequired || 'Yes') === 'Yes' ? (
                          <input
                            type="text"
                            value={row.deliverable || ''}
                            onChange={(e) => handleCellChange(idx, 'deliverable', e.target.value)}
                            placeholder="Put Format no."
                            className="min-w-0 flex-1 rounded border border-[#64748B] bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic px-1">Not required</span>
                        )}
                      </>
                    )}
                  </div>
                </td>

                {!readOnly && (
                  <td className="py-1.5 px-1 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteRow?.(idx)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
