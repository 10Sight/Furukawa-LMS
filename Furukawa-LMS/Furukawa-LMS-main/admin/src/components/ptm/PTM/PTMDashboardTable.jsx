import React from 'react';
import { Download, Copy, Trash2, Building2 } from 'lucide-react';

export default function PTMDashboardTable({
  items,
  onOpenForm,
  onCopy,
  onDelete,
  onExportRow,
  pageStartIndex = 0,
  unitSelected = true,
}) {
  const handleDeleteClick = (id) => onDelete?.(id);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECEFF3] p-12 text-center shadow-sm">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">
          {unitSelected ? 'No PTM Records Found' : 'Please Select a Unit'}
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {unitSelected
            ? 'No records match the selected Unit filter or search query.'
            : 'Select Gujrat or Bawal from the Unit dropdown above to display the records for that unit.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECEFF3] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[980px]">
          {/* Table Header matching screenshot */}
          <thead>
            <tr className="border-b border-[#F1F3F5] bg-white">
              <th className="py-4 px-6 text-[11px] font-bold text-slate-600 uppercase tracking-wider w-16 text-center">
                S.NO
              </th>
              <th className="py-4 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider min-w-[220px]">
                TOPIC
              </th>
              <th className="py-4 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider min-w-[320px]">
                DESCRIPTION
              </th>
              <th className="py-4 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                DATE
              </th>
              <th className="py-4 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                TIME
              </th>
              <th className="py-4 px-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider min-w-[180px]">
                CREATED BY
              </th>
              <th className="py-4 px-6 text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center w-28">
                ACTIONS
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#F3F4F6] text-sm bg-white">
            {items.map((row, idx) => (
              <tr
                key={row.id}
                className="hover:bg-[#FBFBFE] transition-colors group"
              >
                {/* S.No */}
                <td className="py-5 px-6 whitespace-nowrap text-center">
                  <span className="w-7 h-7 rounded-full bg-[#F3F6FA] text-slate-600 text-xs font-semibold inline-flex items-center justify-center">
                    {pageStartIndex + idx + 1}
                  </span>
                </td>

                {/* Topic - Clickable BLUE Link that opens the PTM form */}
                <td className="py-5 px-4 min-w-[220px] max-w-[280px]">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onOpenForm && onOpenForm(row)}
                      className="text-left font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline transition-colors text-[13px] leading-snug cursor-pointer"
                      title="Click to open PTM Form"
                    >
                      {row.topic}
                    </button>
                    <span className="text-[10px] font-mono text-slate-400">
                      {row.id}
                    </span>
                  </div>
                </td>

                {/* Description */}
                <td className="py-5 px-4 min-w-[320px] max-w-[420px]">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {row.description}
                  </p>
                </td>

                {/* Date */}
                <td className="py-5 px-4 whitespace-nowrap">
                  <span className="text-xs font-semibold text-slate-800">
                    {row.date}
                  </span>
                </td>

                {/* Time */}
                <td className="py-5 px-4 whitespace-nowrap">
                  <span className="text-xs text-slate-600 font-medium">
                    {row.time}
                  </span>
                </td>

                {/* Created By */}
                <td className="py-5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${row.createdBy?.avatarBg || 'bg-blue-100 text-blue-700'}`}
                    >
                      {row.createdBy?.initials || 'NA'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {row.createdBy?.name || 'USER'}
                      </span>
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-0.5 self-start font-medium">
                        {row.createdBy?.code || 'AS081215'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Actions: Download, Copy, Delete */}
                <td className="py-5 px-6 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    {/* Download */}
                    <button
                      onClick={() => onExportRow && onExportRow(row)}
                      title="Download PTM Item"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Copy */}
                    <button
                      onClick={() => onCopy && onCopy(row)}
                      title="Duplicate PTM Item"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteClick(row.id)}
                      title="Delete PTM Item"
                      className={`p-1 rounded transition-colors text-slate-400 hover:text-rose-600`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
