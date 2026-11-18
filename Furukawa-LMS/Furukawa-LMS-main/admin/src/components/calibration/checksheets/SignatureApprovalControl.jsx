import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * SignatureApprovalControl
 * Renders small "Approved" and "Rejected" action buttons to the right of a signature.
 * When status is 'approved', hides all buttons and shows a clean approved badge.
 * When status is 'rejected', shows a rejected badge with an option to change.
 */
export default function SignatureApprovalControl({
  status = 'pending',
  onApprove,
  onReject,
  onReset,
  className = ''
}) {
  if (status === 'approved') {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded shadow-sm select-none ${className}`}>
        <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
        Approved
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded shadow-sm select-none">
          <X className="w-3 h-3 text-rose-600 stroke-[2.5]" />
          Rejected
        </span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-gray-500 hover:text-gray-700 underline cursor-pointer"
            title="Reset decision"
          >
            Change
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onApprove}
        className="px-2 py-0.5 text-[11px] font-semibold border border-green-400 text-green-400 rounded transition shadow-sm whitespace-nowrap cursor-pointer active:scale-95"      >
        Approved
      </button>
      <button
        type="button"
        onClick={onReject}
        className="px-2 py-0.5 text-[11px] font-semibold border border-red-400 text-red-400 rounded transition shadow-sm whitespace-nowrap cursor-pointer active:scale-95"      >
        Rejected
      </button>
    </div>
  );
}
