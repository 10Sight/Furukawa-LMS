import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';

export default function FormDeletionDialog({ formName, error, onCancel, onDelete }) {
  useEffect(() => {
    if (!formName) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formName, onCancel]);

  if (!formName || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="form-delete-title"
        aria-describedby="form-delete-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex gap-4 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="form-delete-title" className="text-base font-bold text-slate-900">Delete form?</h2>
            <p id="form-delete-description" className="mt-1.5 text-sm leading-5 text-slate-600">
              Are you sure you want to delete this form? This action cannot be undone.
            </p>
            <p className="mt-2 break-words text-sm font-semibold text-slate-800">{formName}</p>
            {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:px-6">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            Cancel
          </button>
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
