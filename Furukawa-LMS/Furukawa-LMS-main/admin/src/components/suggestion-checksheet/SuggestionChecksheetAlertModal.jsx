import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';

/**
 * Centered Modern Alert Modal for Mandatory Sections in Suggestion Checksheet
 * Replaces ugly browser alerts with a polished, centered dialog portaled to document.body.
 */
export default function SuggestionChecksheetAlertModal({
  isOpen,
  onClose,
  missingSections = []
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with amber/red theme */}
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-red-500 px-6 py-4 flex items-center justify-between text-white shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Mandatory Sections Required
              </h3>
              <p className="text-xs text-white/90 font-medium">
                Cannot save checksheet without completing required fields
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs font-semibold text-slate-600">
            Please fill the following <span className="text-rose-600 font-bold">{missingSections.length} mandatory section{missingSections.length > 1 ? 's' : ''}</span> before saving:
          </p>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {missingSections.map((item, index) => {
              const name = typeof item === 'string' ? item : item.name;
              const desc = typeof item === 'string' ? '' : item.desc;
              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 text-slate-800 shadow-2xs"
                >
                  <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-rose-950">{name}</h4>
                    {desc && <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Understood, Fill Mandatory Sections</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

