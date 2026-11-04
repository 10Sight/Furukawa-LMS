import React from 'react';
import { ChevronDown } from 'lucide-react';
import { stripEmployeeId } from '../../pages/pdca/data/pdcaEmployees.js';

/**
 * ResponsiblePersonInstructionCell
 *
 * Implements the exact layout requested and shown in the reference image:
 * 1. Clean Dropdown: "Select...", "Confirmed", "Not - Confirmed".
 * 2. When "Not - Confirmed":
 *    - Cell spreads to show "Reason:" label and a styled input box to enter/edit the reason.
 * 3. When user fills the Reason and later switches to "Confirmed":
 *    - The filled reason cannot be removed and remains shown below the dropdown as:
 *      "Reason: <reason text>"
 * 4. When "Confirmed" or "Select..." without a filled reason:
 *    - No partition in the cell; only the clean dropdown is displayed.
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
    <div className="w-full flex flex-col items-start p-1 justify-center">
      {/* 1. Dropdown: Select..., Confirmed, Not - Confirmed */}
      <div className="relative w-full">
        <select
          ref={confirmationRef}
          disabled={readOnly}
          data-required-action-allowed={reasonRequired && !readOnly ? 'true' : undefined}
          aria-label={`Responsible person confirmation for row ${sNo}`}
          value={selectValue}
          onChange={handleSelectConfirmation}
          className={`w-full rounded-xl border px-2.5 py-1.5 text-[14px] font-medium outline-none text-left appearance-none transition-all ${
            readOnly ? 'cursor-default' : 'cursor-pointer focus:ring-2 focus:ring-blue-300'
          } ${
            isNotConfirmed
              ? 'border-blue-400 text-slate-800 bg-white hover:border-blue-500'
              : isConfirmed
              ? 'border-blue-400 text-slate-800 bg-white hover:border-blue-500'
              : 'border-slate-300 text-slate-600 bg-white hover:border-slate-400'
          }`}
          title={selectTitle}
        >
          <option value="">Select...</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Not-Confirmed">Not - Confirmed</option>
        </select>
        <ChevronDown
          className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
        />
      </div>

      {/* 2. Reason display / input matching reference image */}
      {isNotConfirmed && (
        <div className="w-full mt-2 flex flex-col items-start gap-1">
          <span className="text-[13px] font-bold text-slate-800 select-none">Reason:</span>
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
            placeholder="Enter reason..."
            className={`w-full text-[13px] p-2 rounded-xl border border-blue-200 bg-blue-50/40 text-slate-800 outline-none leading-relaxed transition-all resize-y select-text focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${readOnly ? 'cursor-default bg-slate-50' : ''}`}
          />
        </div>
      )}

      {isConfirmed && hasReason && (
        <div className="w-full mt-1.5 text-left text-[13px] text-slate-800 leading-snug">
          <span className="font-bold text-slate-800">Reason: </span>
          <span className="font-medium text-slate-700 select-text">{instruction}</span>
        </div>
      )}
    </div>
  );
}
