import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  ArrowLeft,
  X,
  Mail,
  CheckCircle2,
  Save,
  HelpCircle
} from 'lucide-react';

/**
 * Premium Modern Alert & Confirmation Modal for PDCA Sheet
 * Replaces ugly native browser alert() and confirm() dialogs with a state-of-the-art UI.
 */
export default function PDCAAlertModal({
  isOpen,
  onClose,
  type = 'mandatory', // 'mandatory' | 'unsaved-changes' | 'send-mail-warning' | 'warning' | 'error'
  title,
  message,
  rowNumber = null,
  missingFields = [],
  confirmText,
  cancelText,
  onConfirm,
  onSaveAndExit = null
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Visual theming based on modal type
  const isMandatory = type === 'mandatory';
  const isUnsavedChanges = type === 'unsaved-changes';
  const isSendMailWarning = type === 'send-mail-warning';
  const isError = type === 'error';

  const defaultTitle = isMandatory
    ? 'Mandatory Columns Required'
    : isUnsavedChanges
    ? 'Unsaved Changes'
    : isSendMailWarning
    ? 'Cannot Send Email'
    : isError
    ? 'Action Failed'
    : 'Attention Required';

  const modalTitle = title || defaultTitle;

  const renderIcon = () => {
    if (isMandatory) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-amber-100/90 text-amber-600 flex items-center justify-center ring-8 ring-amber-50 shadow-inner">
          <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
        </div>
      );
    }
    if (isUnsavedChanges) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-amber-100/90 text-amber-600 flex items-center justify-center ring-8 ring-amber-50 shadow-inner">
          <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
        </div>
      );
    }
    if (isSendMailWarning) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-blue-100/90 text-blue-600 flex items-center justify-center ring-8 ring-blue-50 shadow-inner">
          <Mail className="w-6 h-6 stroke-[2.2]" />
        </div>
      );
    }
    if (isError) {
      return (
        <div className="w-12 h-12 rounded-2xl bg-rose-100/90 text-rose-600 flex items-center justify-center ring-8 ring-rose-50 shadow-inner">
          <AlertCircle className="w-6 h-6 stroke-[2.2]" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center ring-8 ring-slate-50 shadow-inner">
        <AlertCircle className="w-6 h-6 stroke-[2.2]" />
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUnsavedChanges) {
          onClose?.();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
        {/* Accent top gradient bar */}
        <div
          className={`h-1.5 w-full ${
            isMandatory
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
              : isUnsavedChanges
              ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600'
              : isSendMailWarning
              ? 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'
              : 'bg-gradient-to-r from-slate-400 to-slate-600'
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* Header with Icon and Title */}
          <div className="flex items-start gap-4 mb-4">
            {renderIcon()}
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {modalTitle}
              </h3>
              {rowNumber && (
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Row {rowNumber}
                </div>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="space-y-3.5">
            {message && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {message}
              </p>
            )}

            {/* Missing Mandatory Fields Badges Container */}
            {missingFields && missingFields.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                  <span>Required columns missing:</span>
                  <span className="text-[11px] font-medium text-amber-700">
                    {missingFields.length} {missingFields.length === 1 ? 'column' : 'columns'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {missingFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-amber-300 text-amber-900 shadow-2xs"
                    >
                      <span className="text-rose-500 font-bold">*</span>
                      {field}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-amber-800/90 pt-1 font-medium">
                  {isSendMailWarning
                    ? 'Please fill all mandatory columns and save the sheet before sending email.'
                    : 'The sheet cannot be saved until all mandatory columns are filled.'}
                </p>
              </div>
            )}

            {/* Unsaved Changes Extra Helper Box */}
            {isUnsavedChanges && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unsaved changes will be discarded</span>
                </div>
                <p className="text-slate-500 leading-normal">
                  If you leave now, any changes made since your last save will not be recorded.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-2.5">
            {isUnsavedChanges ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {cancelText || 'Stay & Keep Editing'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onConfirm?.();
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{confirmText || 'Discard & Go Back'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{confirmText || 'Understood, Got It'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
