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
  if (!s) return '';
  if (s === 'Open' || s === 'Not-Started') return 'Not-Started';
  if (s === 'Closed' || s === 'Done') return 'Done';
  if (s === 'In Progress' || s === 'In - Progress' || s === 'In- Progress') return 'In- Progress';
  if (s === 'Delay' || s === 'Delayed') return 'Delay';
  return s;
};

/**
 * Computes the PDCA Status based on Response Date and completion status:
 * 1. If date is not selected -> Status remains blank
 * 2. If response date is not selected by user -> Not-Started (or existing valid status)
 * 3. If response date is passed and work is not done -> Delay
 * 4. If work is done (Done / Confirmed) -> Done
 * 5. If response date is selected (today or future) and work in progress -> In- Progress
 */
export const computePDCAStatus = (row = {}, currentDateStr = '') => {
  const normStatus = normalizePDCAStatus(row.status);
  const respDate = row.responseDate ? String(row.responseDate).trim() : '';

  // Rule: If response date is not selected by user, status is Not-Started
  if (!respDate) {
    return normStatus || 'Not-Started';
  }

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

export const PDCA_SHEET_TABLE_STATUSES = [
  { key: 'inProgress', label: 'In-progress', status: 'In- Progress' },
  { key: 'done', label: 'Done', status: 'Done' },
  { key: 'delay', label: 'Delay', status: 'Delay' },
  { key: 'notStarted', label: 'Not-Started', status: 'Not-Started' }
];

export const isActivePDCARow = (r) => {
  if (!r || typeof r !== 'object') return false;
  return Boolean(
    String(r.date || '').trim() ||
    String(r.observation || '').trim() ||
    String(r.rootCause || '').trim() ||
    String(r.actionTaken || r.correctiveAction || '').trim() ||
    String(r.counterMeasure || '').trim() ||
    String(r.responseDate || '').trim() ||
    String(r.lineArea || '').trim() ||
    (Array.isArray(r.lineAreas) && r.lineAreas.some(l => String(l?.lineArea || '').trim())) ||
    String(r.staffName || r.staffEmployee || '').trim() ||
    (Array.isArray(r.staffEmployees) && r.staffEmployees.some(e => String(e?.name || e?.fullName || '').trim())) ||
    (String(r.status || '').trim() && normalizePDCAStatus(r.status) !== 'Not-Started') ||
    (Array.isArray(r.imagesBefore) && r.imagesBefore.length > 0) ||
    Boolean(r.imageBefore) ||
    (Array.isArray(r.imagesAfter) && r.imagesAfter.length > 0) ||
    Boolean(r.imageAfter)
  );
};

export const getEffectivePDCARowStatus = (r = {}, currentDateStr = '') => {
  const conf = String(r.confirmation || r.responsiblePersonConfirmation || '').trim();
  const normStatus = normalizePDCAStatus(r.status);

  if (normStatus === 'Done' || conf === 'Confirmed' || conf === 'Confirm') {
    return 'Done';
  }
  if (conf === 'Not-Confirmed' || conf === 'Not - Confirmed' || conf === 'Not-Confirm') {
    return 'In- Progress';
  }
  if (r.responseDate && String(r.responseDate).trim()) {
    return computePDCAStatus(r, currentDateStr);
  }
  if (normStatus === 'In- Progress') return 'In- Progress';
  if (normStatus === 'Delay') return 'Delay';
  return 'Not-Started';
};

export const resolvePDCASheetRows = (recordOrSheet, fallbackRows = []) => {
  if (!recordOrSheet || typeof recordOrSheet !== 'object') {
    return Array.isArray(fallbackRows) ? fallbackRows : [];
  }
  const directRows = Array.isArray(recordOrSheet.rows)
    ? recordOrSheet.rows
    : (Array.isArray(recordOrSheet.sheet?.rows) ? recordOrSheet.sheet.rows : []);

  let savedRows = [];
  const sheetId = recordOrSheet.id || recordOrSheet.recordId || recordOrSheet._id;
  if (sheetId && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(`lpa_pdca_saved_${sheetId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.rows)) {
          savedRows = parsed.rows;
        }
      }
    } catch {}
  }

  const savedActiveCount = savedRows.filter(isActivePDCARow).length;
  const directActiveCount = directRows.filter(isActivePDCARow).length;

  if (savedActiveCount > 0 && savedActiveCount >= directActiveCount) {
    return savedRows;
  }
  if (directRows.length > 0) {
    return directRows;
  }
  if (savedRows.length > 0) {
    return savedRows;
  }
  return Array.isArray(fallbackRows) ? fallbackRows : [];
};

export const getPDCASheetStatusSummary = (rowsOrRecord = [], currentDateStr = '') => {
  const rows = Array.isArray(rowsOrRecord)
    ? rowsOrRecord
    : resolvePDCASheetRows(rowsOrRecord);

  let inProgress = 0;
  let done = 0;
  let delay = 0;
  let notStarted = 0;

  (rows || []).forEach(r => {
    if (!isActivePDCARow(r)) return;
    const status = getEffectivePDCARowStatus(r, currentDateStr);
    if (status === 'Done') done += 1;
    else if (status === 'In- Progress') inProgress += 1;
    else if (status === 'Delay') delay += 1;
    else notStarted += 1;
  });

  const total = inProgress + done + delay + notStarted;

  return {
    inProgress,
    done,
    delay,
    notStarted,
    total,
    items: [
      { key: 'inProgress', label: 'In-progress', count: inProgress },
      { key: 'done', label: 'Done', count: done },
      { key: 'delay', label: 'Delay', count: delay },
      { key: 'notStarted', label: 'Not-Started', count: notStarted }
    ]
  };
};

