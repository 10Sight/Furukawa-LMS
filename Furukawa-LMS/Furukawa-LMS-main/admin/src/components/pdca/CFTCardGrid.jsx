import React from 'react';
import { 
  Building2, 
  Users, 
  UserPlus, 
  Trash2, 
  Download, 
  Copy, 
  Inbox,
  ChevronRight
} from 'lucide-react';

export default function CFTCardGrid({
  items = [],
  pageStartIndex = 0,
  totalItems = 0,
  selectedPlant = 'Unit',
  onTopicClick,
  onOpenAddMember,
  onDelete,
  onCopy,
  onDownload
}) {
  const handleDeleteClick = (id) => onDelete?.(id);

  if (selectedPlant === 'Unit' || selectedPlant === 'All Plants') {
    return (
      <div className="bg-white rounded-2xl border border-[#ECEFF3] p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">Select a Plant to View Records</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Please choose either <strong>Gujrat</strong> or <strong>Bawal</strong> from the Plant / Unit selector above to display the CFT items.
        </p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECEFF3] p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="w-16 h-16 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <Inbox className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">No Records Found</h3>
        <p className="text-xs text-slate-500">
          No records match the current filter or search criteria for this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {/* Responsive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map((row, idx) => {
          const sNo = pageStartIndex + idx + 1;

          return (
            <div
              key={row.id}
              className="bg-white rounded-2xl border border-[#ECEFF3] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
            >
              {/* Top Section */}
              <div className="space-y-3.5">
                {/* 1. Header Badges: S.No, ID, Unit, Department */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200">
                      {sNo}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
                      {row.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                      {row.plant}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {row.department || 'CFT'}
                    </span>
                  </div>
                </div>

                {/* 2. Topic (Clickable to open Sheet, matching PDCATable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => onTopicClick?.(row)}
                    className="text-left font-bold text-slate-800 hover:text-blue-600 hover:underline text-[15px] leading-snug cursor-pointer transition-colors line-clamp-2"
                    title="Open Detail View"
                  >
                    {row.topic}
                  </button>
                </div>

                {/* 4. Created By (Exact match to PDCATable Created By column) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        row.createdBy?.avatarBg || 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {row.createdBy?.initials || 'NA'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate" title={row.createdBy?.name || 'N/A'}>
                        {row.createdBy?.name || 'N/A'}
                      </span>
                      <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-px rounded border border-blue-100 mt-0.5 self-start">
                        {row.createdBy?.code || 'EMP'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Created By
                  </span>
                </div>

                {/* 5. Assigned Employees (Exact match to PDCATable Assigned Column) */}
                <div className="pt-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Assigned Employees ({row.assignedMembers?.length || 0})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAddMember?.(row)}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      {row.assignedMembers?.length ? 'Edit' : '+ Assign'}
                    </button>
                  </div>

                  {row.assignedMembers && row.assignedMembers.length > 0 ? (
                    <div 
                      onClick={() => onOpenAddMember?.(row)}
                      title="Click to edit or add employees"
                      className="flex flex-wrap gap-1.5 items-center cursor-pointer group/emp hover:opacity-90 min-h-[28px]"
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
                      type="button"
                      onClick={() => onOpenAddMember?.(row)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-dashed border-emerald-300 transition-colors cursor-pointer w-full justify-center"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>+ Assign Employees</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card Footer Actions (Exact match to PDCATable actions: View Sheet, Download, Copy, Delete) */}
              <div className="pt-3.5 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {/* View Sheet Button */}
                <button
                  type="button"
                  onClick={() => onTopicClick?.(row)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                  title="Open PDCA Sheet"
                >
                  <span>View Sheet</span>
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Download PDCA Sheet */}
                  <button
                    type="button"
                    onClick={() => onDownload?.(row)}
                    title="Download Sheet"
                    className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={() => onCopy?.(row)}
                    title="Copy Link"
                    className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete with confirm */}
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(row.id)}
                    title="Delete"
                    className={`p-2 rounded-xl border transition-colors cursor-pointer shadow-2xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
