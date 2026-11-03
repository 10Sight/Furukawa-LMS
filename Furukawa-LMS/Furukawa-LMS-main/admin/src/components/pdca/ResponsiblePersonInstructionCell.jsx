import React from 'react';
import { ChevronDown } from 'lucide-react';
import { stripEmployeeId } from '../../pages/pdca/data/pdcaEmployees.js';

/**
 * ResponsiblePersonInstructionCell
 *
 * Implements the exact layout requested:
 * 1. Upside (above dropdown): User's name printed directly in the cell (e.g. "Joy Dastidar (ST080014)").
 * 2. Middle: Clean dropdown containing strictly "Confirmed" and "Not-Confirmed".
 *    - Blue/slate border for Confirmed / default.
 *    - Light red / rose border for Not-Confirmed.
 * 3. Downside (partition below dropdown with dividing line):
 *    - When "Not-Confirmed":
 *      - Cell spreads into 2 parts separated by a horizontal divider line:
 *        Dropdown (Not-Confirmed) on top, Divider line, Reason (* Required) on bottom.
 *      - Full support for spaces, text selection, and multi-line typing without character loss.
 *    - When user filled a Reason and switches to "Confirmed":
 *      - The reason filled by user cannot be removed and must remain shown in the cell below the divider line.
 *    - When "Confirmed" or "Select..." without a filled reason:
 *      - No partition in the cell; single dropdown is shown.
 * 4. Only the PDCA Sheet Creator or Admin has access to select the Confirmation dropdown,
 *    and all mandatory columns must be filled before selecting Confirm or Not-Confirm.
 */
export default function ResponsiblePersonInstructionCell({
  row,
  rowIndex,
  reasonRef,
  confirmationRef,
  reasonRequired = false,
  currentUser,
  readOnly = false,
  missingMandatoryFields = [],
  onConfirmationChange,
  onInstructionChange,
  sNo = 1
}) {
  const currentUserName = currentUser?.fullName || currentUser?.name || 'Administrator';
  const currentConfirmation = (row.confirmation || (
    row.responsiblePersonConfirmation === 'Confirmed' ||
    row.responsiblePersonConfirmation === 'Confirm' ||
    row.responsiblePersonConfirmation === 'Not - Confirmed' ||
    row.responsiblePersonConfirmation === 'Not-Confirmed' ||
    row.responsiblePersonConfirmation === 'Not-Confirm'
      ? row.responsiblePersonConfirmation
      : ''
  )).trim();
  const isConfirmed = currentConfirmation === 'Confirmed' || currentConfirmation === 'Confirm';
  const isNotConfirmed = currentConfirmation === 'Not - Confirmed' || currentConfirmation === 'Not-Confirmed' || currentConfirmation === 'Not-Confirm';

  const confirmedBy = (row.confirmedBy || (currentConfirmation ? currentUserName : '')).trim();
  // DO NOT use .trim() here so spaces are preserved as user types!
  const instruction = row.instruction !== undefined && row.instruction !== null
    ? String(row.instruction)
    : (row.responsiblePersonConfirmation && !isConfirmed && !isNotConfirmed
        ? String(row.responsiblePersonConfirmation)
        : '');

  const hasReason = Boolean(instruction && instruction.trim().length > 0);
  const shouldShowPartition = isNotConfirmed || (isConfirmed && hasReason);

  const selectValue = isConfirmed ? 'Confirmed' : isNotConfirmed ? 'Not-Confirmed' : '';

  const handleSelectConfirmation = (e) => {
    const val = e.target.value;
    let allowed = true;
    if (val === 'Confirmed' || val === 'Confirm') {
      allowed = onConfirmationChange('Confirmed', currentUserName);
    } else if (val === 'Not-Confirmed' || val === 'Not-Confirm') {
      allowed = onConfirmationChange('Not - Confirmed', currentUserName);
    } else {
      allowed = onConfirmationChange('', '');
    }
    if (allowed === false && e?.target) {
      e.target.value = selectValue;
    }
  };

  const selectTitle = readOnly
    ? 'Only the sheet creator or Admin has access to select Confirmation'
    : (isConfirmed
        ? `Confirmed by ${confirmedBy || 'User'}`
        : isNotConfirmed
        ? `Not-Confirmed by ${confirmedBy || 'User'}`
        : (Array.isArray(missingMandatoryFields) && missingMandatoryFields.length > 0
            ? `Mandatory columns required to select Confirmation: ${missingMandatoryFields.join(', ')}`
            : 'Select Confirmation'));

  return (
    <div className="w-full flex flex-col items-start p-1">
      {/* 1. Upside: User name printed directly in cell */}
      <div className="w-full text-left pl-0.5 pb-1 min-h-[18px]">
        {confirmedBy ? (
          <span className="text-[14px] font-semibold text-slate-800 leading-tight block truncate select-text" title={`Confirmed / Reviewed by: ${stripEmployeeId(confirmedBy)}`}>
            {stripEmployeeId(confirmedBy)}
          </span>
        ) : (
          <span className="text-[13px] text-slate-300 block select-none">-</span>
        )}
      </div>

      {/* 2. Middle: Clean Dropdown with Confirm and Not-Confirm */}
      <div className="relative w-full">
        <select
          ref={confirmationRef}
          disabled={readOnly}
          data-required-action-allowed={reasonRequired && !readOnly ? 'true' : undefined}
          aria-label={`Responsible person confirmation for row ${sNo}`}
          value={selectValue}
          onChange={handleSelectConfirmation}
          className={`w-full rounded-lg border px-2.5 py-1.5 text-[14px] font-medium outline-none text-left appearance-none transition-all ${
            readOnly ? 'cursor-default' : 'cursor-pointer focus:ring-2 focus:ring-blue-300'
          } ${
            isNotConfirmed
              ? 'border-red-400 text-slate-800 bg-white hover:border-red-500'
              : isConfirmed
              ? 'border-blue-400 text-slate-800 bg-white hover:border-blue-500'
              : 'border-slate-300 text-slate-600 bg-white hover:border-slate-400'
          }`}
          title={selectTitle}
        >
          <option value="">Select...</option>
          <option value="Confirmed">Confirm</option>
          <option value="Not-Confirmed">Not-Confirm</option>
        </select>
        <ChevronDown
          className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            isNotConfirmed ? 'text-red-400' : 'text-slate-400'
          }`}
        />
      </div>

      {/* 3. Downside: Partition with horizontal divider line and Reason */}
      {shouldShowPartition && (
        <div className="w-full mt-2 pt-1 border-t border-slate-300 flex flex-col items-start">
          <div className="w-full flex items-center justify-between pl-0.5 mb-1 leading-none select-none">
            <span className={`text-[12px] font-bold ${isNotConfirmed ? 'text-red-500' : 'text-slate-700'}`}>
              Reason
            </span>
            {isNotConfirmed && (
              <span className="text-[11px] font-semibold text-red-500">* Required</span>
            )}
          </div>
          <textarea
            ref={reasonRef}
            rows={2}
            disabled={readOnly}
            required={isNotConfirmed}
            aria-required={isNotConfirmed ? 'true' : undefined}
            data-required-confirmation-reason={isNotConfirmed ? 'true' : undefined}
            data-required-confirmation-active={reasonRequired ? 'true' : 'false'}
            data-required-action-allowed={reasonRequired && !readOnly ? 'true' : undefined}
            value={instruction}
            onChange={(e) => onInstructionChange(e.target.value)}
            onKeyDown={(e) => {
              // Stop event propagation so table hotkeys/listeners don't hijack spaces or keys
              e.stopPropagation();
            }}
            placeholder={isNotConfirmed ? "Enter reason (required)" : "Reason"}
            className={`w-full text-[14px] p-2 rounded-lg border outline-none leading-relaxed transition-all resize-y select-text ${
              isNotConfirmed
                ? (!instruction.trim()
                    ? 'border-red-400 bg-white text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-red-400'
                    : 'border-red-300 bg-white text-slate-800 focus:border-red-400 focus:ring-1 focus:ring-red-400')
                : 'border-slate-300 bg-slate-50/80 text-slate-800 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400'
            } ${readOnly ? 'cursor-default bg-slate-50' : ''}`}
          />
        </div>
      )}
    </div>
  );
}
