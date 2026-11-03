import React from 'react';
import { Download, Copy, Trash2, Building2, UserPlus, Users, Edit3 } from 'lucide-react';
import { isRecordCreator, getPDCASheetStatusSummary } from '../../pages/pdca/data/recordFilters.js';

export default function PDCATable({
  items,
  currentUser,
  onDownload,
  onCopy,
  onDelete,
  onTopicClick,
  onOpenAddMember,
  onEdit,
  activeTab = 'Company',
  pageStartIndex = 0,
  selectedPlant = 'Unit',
  selectedDate = '',
  onClearDate = null
}) {
  const handleDeleteClick = (id) => onDelete?.(id);

  if (items.length === 0) {
    const isUnitDefault = selectedPlant === 'Unit';
    return (
      <div className="bg-white rounded-2xl border border-[#ECEFF3] p-6 sm:p-14 text-center shadow-sm">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-800">
          {isUnitDefault
            ? 'Please Select a Unit'
            : selectedDate
              ? `No Records Found for Date: ${selectedDate}`
              : 'No Records Found'}
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {isUnitDefault
            ? 'Select Gujrat or Bawal from the Unit dropdown above to display the records for that unit.'
            : selectedDate
              ? 'No PDCA records match the selected date. Try selecting a different date or clear the date filter.'
              : 'No records match the selected unit or search query. Try selecting a different unit or clearing your search.'}
        </p>
        {selectedDate && onClearDate && (
          <button
            type="button"
            onClick={onClearDate}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Clear Date Filter
          </button>
        )}
      </div>
    );
  }

  // Base columns matching all tabs; for CFT, include Employees right after Created By
  const isCFTTab = activeTab === 'CFT';

  const tableHeaders = isCFTTab
    ? ['S.No', 'Topic', 'Description', 'Date', 'Time', 'Created By', 'Assigned Employees', 'Status', 'Actions']
    : ['S.No', 'Topic', 'Description', 'Date', 'Time', 'Created By', 'Status', 'Actions'];

  return (
    <div className="w-full min-w-0 bg-white rounded-2xl border border-[#ECEFF3] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed">

          {/* Table Header */}
          <thead>
            <tr className="border-b border-[#F1F3F5] bg-[#FAFAFC]">
              {tableHeaders.map((heading) => (
                <th
                  key={heading}
                  className={`py-3 px-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                    heading === 'S.No' ? 'pl-3 pr-2 w-10 text-center' : ''
                  } ${heading === 'Actions' ? 'text-center w-12' : ''} ${
                    heading === 'Description' ? 'max-w-[130px] xl:max-w-[160px]' : ''
                  } ${heading === 'Topic' ? 'min-w-[140px] max-w-[200px]' : ''}`}
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
                <td className="py-3 pl-3 pr-2 whitespace-nowrap text-center">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center mx-auto">
                    {pageStartIndex + idx + 1}
                  </span>
                </td>

                {/* Topic - Clicking opens PDCA Sheet */}
                <td className="py-3 px-2 min-w-0">
                  <div className="flex flex-col gap-0.5 items-start min-w-0">
                    <button
                      type="button"
                      onClick={() => onTopicClick?.(row)}
                      className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline text-xs leading-snug line-clamp-2 cursor-pointer transition-colors"
                      title="Open Detail View"
                    >
                      {row.topic}
                    </button>
                  </div>
                </td>

                {/* Description */}
                <td className="py-3 px-2 min-w-0">
                  <p className="text-xs text-slate-600 leading-snug line-clamp-2 break-words" title={row.description}>
                    {row.description}
                  </p>
                </td>

                {/* Date */}
                <td className="py-3 px-2 whitespace-nowrap">
                  <span className="text-xs font-semibold text-slate-700">
                    {row.date}
                  </span>
                </td>

                {/* Time */}
                <td className="py-3 px-2 whitespace-nowrap">
                  <span className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                    {row.time}
                  </span>
                </td>

                {/* Created By */}
                <td className="py-3 px-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${row.createdBy?.avatarBg || 'bg-blue-100 text-blue-700'}`}
                    >
                      {row.createdBy?.initials || 'NA'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate max-w-[85px] xl:max-w-[105px]" title={row.createdBy?.name || 'N/A'}>
                        {row.createdBy?.name || 'N/A'}
                      </span>
                      <span className="text-[9.5px] font-mono text-blue-600 bg-blue-50 px-1 py-px rounded border border-blue-100 mt-0.5 self-start">
                        {row.createdBy?.code || 'EMP'}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Assigned Employees - displayed after Created By for CFT */}
                {isCFTTab && (
                  <td className="py-3 px-2 min-w-0">
                    {row.assignedMembers && row.assignedMembers.length > 0 ? (
                      <div 
                        onClick={() => { if (isRecordCreator(row, currentUser)) onOpenAddMember?.(row); }}
                        title={isRecordCreator(row, currentUser) ? "Click to edit or add employees" : "Assigned employees"}
                        className={`flex flex-wrap gap-1.5 items-center ${isRecordCreator(row, currentUser) ? 'cursor-pointer group/emp hover:opacity-90' : 'cursor-default'}`}
                      >
                        {row.assignedMembers.map((emp, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-900 shadow-2xs transition-colors"
                          >
                            <span className="font-semibold text-emerald-800">{emp.name}</span>
                            <span className="font-mono text-[9px] text-emerald-600 bg-white px-1 py-0.5 rounded border border-emerald-100">
                              {emp.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      isRecordCreator(row, currentUser) ? (
                        <button
                          onClick={() => onOpenAddMember?.(row)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-dashed border-emerald-300 transition-colors cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>+ Assign Employees</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None assigned</span>
                      )
                    )}
                  </td>
                )}

                {/* Status: In-progress, Done, Delay, Not-Started */}
                <td className="py-3 px-2 min-w-0">
                  {(() => {
                    const statusSummary = getPDCASheetStatusSummary(row);
                    return (
                      <div className="grid grid-cols-2 gap-1 w-full">
                        <span className="inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                          <span>In-progress</span>
                          <span className="px-1 py-0.2 rounded bg-amber-100/80 text-amber-900 font-bold text-[9px] leading-none">{statusSummary.inProgress}</span>
                        </span>
                        <span className="inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                          <span>Done</span>
                          <span className="px-1 py-0.2 rounded bg-emerald-100/80 text-emerald-900 font-bold text-[9px] leading-none">{statusSummary.done}</span>
                        </span>
                        <span className="inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                          <span>Delay</span>
                          <span className="px-1 py-0.2 rounded bg-rose-100/80 text-rose-900 font-bold text-[9px] leading-none">{statusSummary.delay}</span>
                        </span>
                        <span className="inline-flex items-center justify-between gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                          <span>Not-Started</span>
                          <span className="px-1 py-0.2 rounded bg-blue-100/80 text-blue-900 font-bold text-[9px] leading-none">{statusSummary.notStarted}</span>
                        </span>
                      </div>
                    );
                  })()}
                </td>

                {/* Actions: Download, Copy, Delete */}
                <td className="py-3 px-2 whitespace-nowrap text-center">
                  <div className="flex flex-col items-center justify-center gap-1 w-fit mx-auto">
                    {/* Edit PDCA Record - Only visible to record creator */}
                    {isRecordCreator(row, currentUser) && (
                      <button
                        onClick={() => onEdit?.(row)}
                        title="Edit PDCA record"
                        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Download PDCA Sheet */}
                    <button
                      onClick={() => onDownload?.(row)}
                      title="Download Sheet"
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Copy Link */}
                    <button
                      onClick={() => onCopy(row)}
                      title="Copy PDCA reference"
                      className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete - Only visible to administrators */}
                    {Boolean(currentUser?.role === 'admin' || currentUser?.isAdmin) && (
                      <button
                        onClick={() => handleDeleteClick(row.id)}
                        title="Delete"
                        className="p-1 rounded transition-colors cursor-pointer text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
