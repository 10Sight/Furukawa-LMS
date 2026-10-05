import React, { useState } from 'react';
import { Download, Copy, Trash2, Building2, UserPlus, Users } from 'lucide-react';

export default function PDCATable({
  items,
  onDownload,
  onCopy,
  onDelete,
  onTopicClick,
  onOpenAddMember,
  activeTab = 'Company',
  pageStartIndex = 0,
  selectedPlant = 'Unit',
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteClick = (id) => {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      // Auto-cancel confirm after 3s
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  if (items.length === 0) {
    const isUnitDefault = selectedPlant === 'Unit' || selectedPlant === 'All Plants';
    return (
      <div className="bg-white rounded-2xl border border-[#ECEFF3] p-6 sm:p-14 text-center shadow-sm">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">
          {isUnitDefault ? 'Please Select a Unit' : 'No Records Found'}
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {isUnitDefault
            ? 'Select Gujrat or Bawal from the Unit dropdown above to display the records for that unit.'
            : 'No records match the selected unit or search query. Try selecting a different unit or clearing your search.'}
        </p>
      </div>
    );
  }

  // Base columns matching all tabs; for CFT, include Employees right after Created By
  const isCFTTab = activeTab === 'CFT';

  const tableHeaders = isCFTTab
    ? ['S.No', 'Topic', 'Description', 'Date', 'Time', 'Created By', 'Assigned Employees', 'Actions']
    : ['S.No', 'Topic', 'Description', 'Date', 'Time', 'Created By', 'Actions'];

  return (
    <div className="w-full min-w-0 bg-white rounded-2xl border border-[#ECEFF3] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">

          {/* Table Header */}
          <thead>
            <tr className="border-b border-[#F1F3F5] bg-[#FAFAFC]">
              {tableHeaders.map((heading) => (
                <th
                  key={heading}
                  className={`py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                    heading === 'S.No' ? 'pl-6 w-16' : ''
                  } ${heading === 'Actions' ? 'text-center' : ''}`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#F3F4F6] text-sm">
            {items.map((row, idx) => (
              <tr
                key={row.id}
                className="hover:bg-[#F9FAFD] transition-colors group"
              >
                {/* S.No */}
                <td className="py-4 pl-6 pr-4 whitespace-nowrap">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                    {pageStartIndex + idx + 1}
                  </span>
                </td>

                {/* Topic - Clicking opens PDCA Sheet */}
                <td className="py-4 px-4 min-w-[220px] max-w-[260px]">
                  <div className="flex flex-col gap-0.5 items-start">
                    <button
                      type="button"
                      onClick={() => onTopicClick?.(row)}
                      className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline text-[13px] leading-snug line-clamp-2 cursor-pointer transition-colors"
                      title="Open Detail View"
                    >
                      {row.topic}
                    </button>
                    <span className="text-[10px] font-mono text-slate-400">{row.id}</span>
                  </div>
                </td>

                {/* Description */}
                <td className="py-4 px-4 min-w-[260px] max-w-[340px]">
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {row.description}
                  </p>
                </td>

                {/* Date */}
                <td className="py-4 px-4 whitespace-nowrap">
                  <span className="text-xs font-semibold text-slate-700">
                    {row.date}
                  </span>
                </td>

                {/* Time */}
                <td className="py-4 px-4 whitespace-nowrap">
                  <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                    {row.time}
                  </span>
                </td>

                {/* Created By */}
                <td className="py-4 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${row.createdBy?.avatarBg || 'bg-blue-100 text-blue-700'}`}
                    >
                      {row.createdBy?.initials || 'NA'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                        {row.createdBy?.name || 'N/A'}
                      </span>
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-px rounded border border-blue-100 mt-0.5 self-start">
                        {row.createdBy?.code || 'EMP'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Assigned Employees - displayed after Created By for CFT */}
                {isCFTTab && (
                  <td className="py-4 px-4 min-w-[180px]">
                    {row.assignedMembers && row.assignedMembers.length > 0 ? (
                      <div 
                        onClick={() => onOpenAddMember?.(row)}
                        title="Click to edit or add employees"
                        className="flex flex-wrap gap-1.5 items-center cursor-pointer group/emp hover:opacity-90"
                      >
                        {row.assignedMembers.map((emp, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-900 shadow-2xs group-hover/emp:border-emerald-400 transition-colors"
                          >
                            <span className="font-semibold text-emerald-800">{emp.name}</span>
                            <span className="font-mono text-[9px] text-emerald-600 bg-white px-1 py-0.5 rounded border border-emerald-100">
                              {emp.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => onOpenAddMember?.(row)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-dashed border-emerald-300 transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>+ Assign Employees</span>
                      </button>
                    )}
                  </td>
                )}

                {/* Actions: Download, Copy, Delete */}
                <td className="py-4 px-4 whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    {/* Download PDCA Sheet */}
                    <button
                      onClick={() => onDownload?.(row)}
                      title="Download Sheet"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Copy Link */}
                    <button
                      onClick={() => onCopy(row)}
                      title="Copy link"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Delete - with confirm on first click */}
                    <button
                      onClick={() => handleDeleteClick(row.id)}
                      title={confirmDeleteId === row.id ? 'Click again to confirm delete' : 'Delete'}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        confirmDeleteId === row.id
                          ? 'bg-rose-600 text-white scale-105 shadow-sm'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
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
