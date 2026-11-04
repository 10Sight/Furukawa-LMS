import React from 'react';
import { X, ExternalLink, Calendar, Building, User, Tag, CheckCircle } from 'lucide-react';

export default function SuggestionChecksheetViewModal({ record, isOpen, onClose, onOpenDetail, onStatusChange }) {
  if (!isOpen || !record) return null;

  return (
    <div
      className="fixed inset-0 z-[1060] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-blue-100 text-blue-700 mb-1">
              {record.id}
            </span>
            <h3 className="text-base font-bold text-slate-800 leading-tight">{record.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-400 font-medium block">Plant Unit</span>
              <span className="font-semibold text-slate-800 text-sm">{record.unit}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Department</span>
              <span className="font-semibold text-slate-800 text-sm">{record.department}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Category</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                {record.category}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block">Status</span>
              <span
                className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  record.status === 'Approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : record.status === 'Under Review'
                    ? 'bg-amber-100 text-amber-800'
                    : record.status === 'Implemented'
                    ? 'bg-cyan-100 text-cyan-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {record.status}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div>
              <span className="text-slate-400 font-medium block">Problem Statement</span>
              <p className="text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 font-serif">
                {record.problemText || record.description || 'No description provided.'}
              </p>
            </div>
            {record.suggestionText && (
              <div>
                <span className="text-slate-400 font-medium block">Proposed Suggestion</span>
                <p className="text-slate-700 mt-1 leading-relaxed bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 font-serif">
                  {record.suggestionText}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-100 text-[11px]">
            <span>Submitted By: <strong className="text-slate-700">{record.submittedBy}</strong></span>
            <span>Date: <strong className="text-slate-700">{record.date}</strong></span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenDetail) onOpenDetail(record);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Suggestion Format Sheet</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
