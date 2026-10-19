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
