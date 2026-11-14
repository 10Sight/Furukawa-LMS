import React, { useState } from 'react';
import { Download, Copy, Trash2, Building2, AlertTriangle } from 'lucide-react';

export default function PTMDashboardTable({
  items,
  onOpenForm,
  onCopy,
  onDelete,
  onExportRow,
  pageStartIndex = 0,
  unitSelected = true,
  canDelete = false,
}) {
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const handleDeleteClick = (row) => {
    setDeleteConfirmItem(row);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmItem && onDelete) {
      onDelete(deleteConfirmItem.id);
    }
    setDeleteConfirmItem(null);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECEFF3] p-12 text-center shadow-sm">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-800">
          {unitSelected ? 'No PTM Records Found' : 'Please Select a Unit'}
        </h3>
        <p className="text-base text-slate-500 mt-1.5 max-w-sm mx-auto">
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
              <th className="py-4 px-6 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider w-16 text-center">
                S.NO
              </th>
              <th className="py-4 px-4 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider min-w-[220px]">
                TOPIC
              </th>
              <th className="py-4 px-4 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider min-w-[320px]">
                DESCRIPTION
              </th>
              <th className="py-4 px-4 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                DATE
              </th>
              <th className="py-4 px-4 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                TIME
              </th>
              <th className="py-4 px-4 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider min-w-[180px]">
                CREATED BY
              </th>
              <th className="py-4 px-6 text-xs sm:text-[13px] font-bold text-slate-700 uppercase tracking-wider text-center w-28">
                ACTIONS
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#F3F4F6] text-base bg-white">
            {items.map((row, idx) => (
              <tr
                key={row.id}
                className="hover:bg-[#FBFBFE] transition-colors group"
              >
                {/* S.No */}
                <td className="py-5 px-6 whitespace-nowrap text-center">
                  <span className="w-8 h-8 rounded-full bg-[#F3F6FA] text-slate-700 text-sm font-semibold inline-flex items-center justify-center">
                    {pageStartIndex + idx + 1}
                  </span>
                </td>

                {/* Topic - Clickable BLUE Link that opens the PTM form */}
                <td className="py-5 px-4 min-w-[220px] max-w-[280px]">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => onOpenForm && onOpenForm(row)}
                      className="text-left font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline transition-colors text-[15px] sm:text-base leading-snug cursor-pointer"
                      title="Click to open PTM Form"
                    >
                      {row.topic}
                    </button>
                    <span className="text-xs font-mono text-slate-400">
                      {row.id}
                    </span>
                  </div>
                </td>

                {/* Description */}
                <td className="py-5 px-4 min-w-[320px] max-w-[420px]">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {row.description}
                  </p>
                </td>

                {/* Date */}
                <td className="py-5 px-4 whitespace-nowrap">
                  <span className="text-sm font-semibold text-slate-800">
                    {row.date}
                  </span>
                </td>

                {/* Time */}
                <td className="py-5 px-4 whitespace-nowrap">
                  <span className="text-sm text-slate-600 font-medium">
                    {row.time}
                  </span>
                </td>

                {/* Created By */}
                <td className="py-5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${row.createdBy?.avatarBg || 'bg-blue-100 text-blue-700'}`}
                    >
                      {row.createdBy?.initials || 'NA'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {row.createdBy?.name || 'USER'}
                      </span>
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-0.5 self-start font-medium">
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

                    {/* Delete (Admin only) */}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(row)}
                        title="Delete PTM Sheet"
                        className="p-1 rounded transition-colors text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Centered Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ptm-delete-modal-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="ptm-delete-modal-title" className="text-lg font-bold text-slate-900">
                  Delete PTM Sheet
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Are you sure you want to delete the PTM Sheet{' '}
                  <span className="font-semibold text-slate-900">"{deleteConfirmItem.topic}"</span>?
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 shadow-md shadow-rose-500/20 transition-colors cursor-pointer"
              >
                Delete Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
