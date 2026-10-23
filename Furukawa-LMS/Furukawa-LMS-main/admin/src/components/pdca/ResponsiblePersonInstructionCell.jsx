import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * ResponsiblePersonInstructionCell
 *
 * Implements the exact layout requested:
 * 1. Upside (above dropdown): User's name printed directly in the cell (e.g. "Joy Dastidar (ST080014)").
 * 2. Middle: Clean dropdown containing strictly "Confirmed" and "Not-Confirmed".
 *    - Blue/slate border for Confirmed / default.
 *    - Light red / rose border for Not-Confirmed.
 * 3. Downside (below dropdown):
 *    - When "Not-Confirmed":
 *      - "* Required" label in red text.
 *      - Textarea with red border and placeholder "Enter reason (required)".
 *      - Full support for spaces, text selection, and multi-line typing without character loss.
 *    - When "Confirmed": nothing shown below.
 * 4. Only Admin and PDCA Sheet Creator can change the value.
 */
export default function ResponsiblePersonInstructionCell({
  row,
  rowIndex,
  reasonRef,
  confirmationRef,
  reasonRequired = false,
  currentUser,
  readOnly = false,
  onConfirmationChange,
  onInstructionChange,
  sNo = 1
}) {
  const currentUserName = currentUser?.fullName || currentUser?.name || 'Administrator';
  const currentConfirmation = (row.confirmation || (row.responsiblePersonConfirmation === 'Confirmed' || row.responsiblePersonConfirmation === 'Not - Confirmed' || row.responsiblePersonConfirmation === 'Not-Confirmed' ? row.responsiblePersonConfirmation : '')).trim();
  const isConfirmed = currentConfirmation === 'Confirmed';
  const isNotConfirmed = currentConfirmation === 'Not - Confirmed' || currentConfirmation === 'Not-Confirmed';

  const confirmedBy = (row.confirmedBy || (currentConfirmation ? currentUserName : '')).trim();
  // DO NOT use .trim() here so spaces are preserved as user types!
  const instruction = row.instruction !== undefined && row.instruction !== null
    ? String(row.instruction)
    : (row.responsiblePersonConfirmation && row.responsiblePersonConfirmation !== 'Confirmed' && row.responsiblePersonConfirmation !== 'Not - Confirmed' && row.responsiblePersonConfirmation !== 'Not-Confirmed'
        ? String(row.responsiblePersonConfirmation)
        : '');

  const handleSelectConfirmation = (e) => {
    const val = e.target.value;
    if (val === 'Confirmed') {
      onConfirmationChange('Confirmed', currentUserName);
    } else if (val === 'Not-Confirmed') {
      onConfirmationChange('Not - Confirmed', currentUserName);
    } else {
      onConfirmationChange('', '');
    }
  };
  return (
    <div className="w-full flex flex-col items-start p-1">
      {/* 1. Upside: User name printed directly in cell */}
      <div className="w-full text-left pl-0.5 pb-1 min-h-[18px]">
        {confirmedBy ? (
          <span className="text-[12.5px] font-semibold text-slate-800 leading-tight block truncate select-text" title={`Confirmed / Reviewed by: ${confirmedBy}`}>
            {confirmedBy}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300 block select-none">-</span>
        )}
      </div>

      {/* 2. Middle: Clean Dropdown with ONLY Confirmed and Not-Confirmed */}
      <div className="relative w-full">
        <select
          ref={confirmationRef}
          disabled={readOnly}
          data-required-action-allowed={reasonRequired && !readOnly ? 'true' : undefined}
          aria-label={`Responsible person confirmation for row ${sNo}`}
          value={isConfirmed ? 'Confirmed' : isNotConfirmed ? 'Not-Confirmed' : ''}
          onChange={handleSelectConfirmation}
          className={`w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium outline-none text-left appearance-none transition-all ${
            readOnly ? 'cursor-default' : 'cursor-pointer focus:ring-2 focus:ring-blue-300'
          } ${
            isNotConfirmed
              ? 'border-red-400 text-slate-800 bg-white hover:border-red-500'
              : isConfirmed
              ? 'border-blue-400 text-slate-800 bg-white hover:border-blue-500'
              : 'border-slate-300 text-slate-600 bg-white hover:border-slate-400'
          }`}
          title={isConfirmed ? `Confirmed by ${confirmedBy || 'User'}` : isNotConfirmed ? `Not-Confirmed by ${confirmedBy || 'User'}` : 'Select Confirmation'}
        >
          <option value="">Select...</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Not-Confirmed">Not-Confirmed</option>
        </select>
        <ChevronDown
          className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            isNotConfirmed ? 'text-red-400' : 'text-slate-400'
          }`}
        />
      </div>

      {/* 3. Downside: Mandatory Input when Not-Confirmed */}
      {isNotConfirmed && (
        <div className="w-full mt-1.5 flex flex-col items-start">
          <span className="text-[11px] font-semibold text-red-500 text-left pl-0.5 mb-1 leading-none select-none">
            * Required
          </span>
          <textarea
            ref={reasonRef}
            rows={2}
            disabled={readOnly}
            required
            aria-required="true"
            data-required-confirmation-reason="true"
            data-required-confirmation-active={reasonRequired ? 'true' : 'false'}
            data-required-action-allowed={reasonRequired && !readOnly ? 'true' : undefined}
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
            onKeyDown={(e) => {
              // Stop event propagation so table hotkeys/listeners don't hijack spaces or keys
              e.stopPropagation();
            }}
            placeholder="Enter reason (required)"
            className={`w-full text-[12.5px] p-2 rounded-lg border outline-none leading-relaxed transition-all resize-y select-text ${
              !instruction.trim()
                ? 'border-red-400 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-red-400'
                : 'border-red-300 bg-white text-slate-800 focus:border-red-400 focus:ring-1 focus:ring-red-400'
            } ${readOnly ? 'cursor-default bg-slate-50' : ''}`}
          />
        </div>
      )}
    </div>
  );
}
