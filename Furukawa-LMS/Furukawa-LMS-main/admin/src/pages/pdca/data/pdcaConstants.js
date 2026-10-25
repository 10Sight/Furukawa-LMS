export const PDCA_DEPARTMENTS = [
  'PE',
  'IT',
  'Quality',
  'Assembly',
  'SRC',
  'Store',
  'HR',
  'Safety',
  'FG',
  'PPC',
  'Maintenance',
  'D&D',
  'C&C'
];

export const PDCA_UNITS = [
  'Bawal',
  'Gujrat'
];

export const UNIT_DEPARTMENT_MAPPING = {
  Bawal: [...PDCA_DEPARTMENTS],
  Gujrat: [...PDCA_DEPARTMENTS],
  Gujarat: [...PDCA_DEPARTMENTS]
};

export const getDepartmentsForUnit = (unit) => {
  return [...PDCA_DEPARTMENTS];
};

export const DEFAULT_LINE_AREAS = [
  'Assembly Area',
  'Assembly Line 1',
  'Assembly Line 2',
  'Assembly Line 3',
  'Line 1',
  'Line 2',
  'Line 3',
  'Line 4',
  'Line 5',
  'Line A',
  'Line B',
  'Line C',
  'Line D',
  'C&C Area',
  'Die Casting Area',
  'Press Shop',
  'Wiring Harness Area',
  'Quality Lab',
  'Stores / Warehouse',
  'Pre-Inspection Rework',
  'Final Inspection Area',
  'Packaging Area',
  'Maintenance Area'
];

export const PDCA_STATUS_OPTIONS = [
  'Not-Started',
  'Done',
  'In- Progress',
  'Delay'
];

export const normalizePDCAStatus = (status) => {
  const s = String(status || '').trim();
  if (!s || s === 'Open' || s === 'Not-Started') return 'Not-Started';
  if (s === 'Closed' || s === 'Done') return 'Done';
  if (s === 'In Progress' || s === 'In - Progress' || s === 'In- Progress') return 'In- Progress';
  if (s === 'Delay' || s === 'Delayed') return 'Delay';
  return s;
};

/**
 * Computes the PDCA Status based on Response Date and completion status:
 * 1. If response date is not selected by user -> Not-Started
 * 2. If response date is passed and work is not done -> Delay
 * 3. If work is done (Done / Confirmed) -> Done
 * 4. If response date is selected (today or future) and work in progress -> In- Progress
 */
export const computePDCAStatus = (row = {}, currentDateStr = '') => {
  const respDate = row.responseDate ? String(row.responseDate).trim() : '';

  // Rule 1: If response date is not selected by user, status is Not-Started
  if (!respDate) {
    return 'Not-Started';
  }

  const normStatus = normalizePDCAStatus(row.status);
  const conf = String(row.confirmation || row.responsiblePersonConfirmation || '').trim();

  // If confirmation is Confirm / Confirmed -> Status is Done
  if (normStatus === 'Done' || conf === 'Confirmed' || conf === 'Confirm') {
    return 'Done';
  }

  // If confirmation is Not-Confirm / Not-Confirmed -> Status is In-Progress
  if (conf === 'Not-Confirmed' || conf === 'Not - Confirmed' || conf === 'Not-Confirm') {
    return 'In- Progress';
  }

  // Today's date in YYYY-MM-DD
  let today = '';
  if (currentDateStr && /^\d{4}-\d{2}-\d{2}/.test(currentDateStr)) {
    today = currentDateStr.slice(0, 10);
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    today = `${y}-${m}-${d}`;
  }

  // Normalize respDate to YYYY-MM-DD for accurate string comparison
  let comparableRespDate = respDate;
  if (/^\d{4}-\d{2}-\d{2}/.test(respDate)) {
    comparableRespDate = respDate.slice(0, 10);
  }

  // Rule 2: If response date is passed and work is not done -> Delay
  if (comparableRespDate < today) {
    return 'Delay';
  }

  // Rule 3: Response date is present and not passed (future or today)
  if (normStatus === 'Delay') {
    return 'In- Progress';
  }

  if (normStatus === 'Not-Started') {
    return 'In- Progress';
  }

  return normStatus || 'In- Progress';
};

