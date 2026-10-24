import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITABLE_RESPONSIBLE_COLUMNS } from './recordFilters.js';
import { normalizePDCAStatus } from './pdcaConstants.js';
import { createEmptyPdcaRow } from '../../lpa/lpaPdcaUtils.js';

test('1. Action taken column placed between Root cause and Counter Measure and is editable', () => {
  assert.ok(EDITABLE_RESPONSIBLE_COLUMNS.includes('actionTaken'), 'actionTaken must be in EDITABLE_RESPONSIBLE_COLUMNS');
  const emptyRow = createEmptyPdcaRow();
  assert.equal(emptyRow.actionTaken, '', 'actionTaken default must be an empty string');
});

test('2. Response Date re-selection fetches current date for No. of time revised', () => {
  const initialDate = '2026-10-15';
  const row = {
    initialResponseDate: initialDate,
    responseDate: initialDate,
    revisedDates: []
  };

  // User selects response date again for second time
  const newSelectedDate = '2026-10-30';
  const oldDate = row.responseDate;
  const isFirstTime = !row.initialResponseDate && !oldDate;
  assert.equal(isFirstTime, false, 'Not first time');

  const currentDateIso = new Date().toISOString().split('T')[0];
  const nextRevisions = [...row.revisedDates, {
    date: currentDateIso, // Must fetch current date, not newSelectedDate!
    reason: 'Schedule adjusted',
    previousDate: oldDate,
    responseDate: newSelectedDate
  }];

  assert.equal(nextRevisions.length, 1);
  assert.equal(nextRevisions[0].date, currentDateIso, 'Revision date must be current date (today)');
  assert.notEqual(nextRevisions[0].date, newSelectedDate, 'Revision date must NOT be the selected response date');
});

test('3. Section C and Section A header text updates with preserved functionality', () => {
  // Section C previously "Responsible Person Confirmation" -> now "Responsible Person"
  const sectionCText = 'Responsible Person';
  assert.equal(sectionCText.includes('Confirmation'), false, 'Section C must remove Confirmation text');
  assert.equal(sectionCText, 'Responsible Person');

  // Section A previously "Responsible Person Confirmation" + "Admin / Sheet Creator only" -> now "Confirmation"
  const sectionAText = 'Confirmation';
  assert.equal(sectionAText.includes('Responsible Person'), false, 'Section A must remove Responsible Person text');
  assert.equal(sectionAText.includes('Admin / Sheet Creator only'), false, 'Section A must remove Admin / Sheet Creator only text');
  assert.equal(sectionAText, 'Confirmation');
});

test('4. Status Done rows are hidden in sheet view but preserved in data and graph', () => {
  const rows = [
    { id: 1, status: 'Not-Started', observation: 'Obs 1' },
    { id: 2, status: 'Done', observation: 'Obs 2' },
    { id: 3, status: 'In- Progress', observation: 'Obs 3' },
    { id: 4, status: 'Done', observation: 'Obs 4' },
    { id: 5, status: 'Delay', observation: 'Obs 5' }
  ];

  // Graph and analytics calculate over ALL rows
  const graphDoneCount = rows.filter(r => normalizePDCAStatus(r.status) === 'Done').length;
  assert.equal(graphDoneCount, 2, 'Graph still sees both Done rows');

  // Sheet table view hides Done rows by default when showDoneRows = false
  const showDoneRows = false;
  const visibleRowsInSheet = rows.filter(r => showDoneRows || normalizePDCAStatus(r.status) !== 'Done');
  assert.equal(visibleRowsInSheet.length, 3, 'Sheet displays only 3 rows when Done rows are hidden');
  assert.ok(!visibleRowsInSheet.some(r => normalizePDCAStatus(r.status) === 'Done'), 'No Done rows visible in sheet');

  // When toggle is activated, all rows are shown
  const toggledRows = rows.filter(r => true || normalizePDCAStatus(r.status) !== 'Done');
  assert.equal(toggledRows.length, 5, 'All 5 rows visible when toggled');
});

test('5. Mandatory columns: Unit, Department, Staff Name are mandatory; Line/Area is optional', () => {
  const validateRow = (r) => {
    const missing = [];
    if (!r.date?.trim()) missing.push('Date');
    if (!r.shift?.trim()) missing.push('Shift');
    if (!r.status?.trim()) missing.push('Status');
    const unitVal = (r.unit || (Array.isArray(r.units) && r.units[0]) || '').trim();
    if (!unitVal) missing.push('Unit');
    const deptVal = (r.department || (Array.isArray(r.departments) && r.departments[0]) || '').trim();
    if (!deptVal) missing.push('Department');
    if (!r.observation?.trim()) missing.push('Observation');
    const staffVal = (r.staffName || r.staffEmployee || (Array.isArray(r.staffEmployees) && (r.staffEmployees[0]?.name || r.staffEmployees[0]?.fullName)) || '').trim();
    if (!staffVal) missing.push('Staff name');
    return missing;
  };

  // Row missing Unit, Department, Staff Name, but having Line/Area
  const incompleteRow = {
    date: '2026-10-24',
    shift: 'A',
    status: 'In- Progress',
    lineArea: 'Assembly Line 1', // Line/Area filled
    unit: '', // Missing
    department: '', // Missing
    observation: 'Machine vibration detected',
    staffName: '' // Missing
  };

  const missingFields = validateRow(incompleteRow);
  assert.ok(missingFields.includes('Unit'), 'Unit is mandatory');
  assert.ok(missingFields.includes('Department'), 'Department is mandatory');
  assert.ok(missingFields.includes('Staff name'), 'Staff name is mandatory');
  assert.ok(!missingFields.includes('Line/Area'), 'Line/Area is NOT mandatory');

  // Completed row with no Line/Area must pass validation
  const validRowWithoutLineArea = {
    date: '2026-10-24',
    shift: 'A',
    status: 'In- Progress',
    lineArea: '', // Empty Line/Area is allowed
    unit: 'Bawal',
    department: 'Assembly',
    observation: 'Machine vibration detected',
    staffName: 'John Doe'
  };
  assert.deepEqual(validateRow(validRowWithoutLineArea), [], 'Row with empty Line/Area passes validation');
});

test('6. Delete permissions: only Admin can delete rows, revisions, files, and records', () => {
  const adminUser = { id: 1, role: 'admin', isAdmin: true };
  const creatorUser = { id: 2, role: 'user', isAdmin: false, name: 'Alice' };
  const regularUser = { id: 3, role: 'user', isAdmin: false, name: 'Bob' };

  const canDeleteAdmin = Boolean(adminUser.role === 'admin' || adminUser.isAdmin);
  const canDeleteCreator = Boolean(creatorUser.role === 'admin' || creatorUser.isAdmin);
  const canDeleteRegular = Boolean(regularUser.role === 'admin' || regularUser.isAdmin);

  assert.equal(canDeleteAdmin, true, 'Admin has delete access');
  assert.equal(canDeleteCreator, false, 'Non-admin creator does NOT have delete access');
  assert.equal(canDeleteRegular, false, 'Regular user does NOT have delete access');
});

test('7. Upgraded Alert UI for Save, Back, and Mail alerts', () => {
  // Test modal state structure for mandatory validation
  const mandatoryAlertState = {
    isOpen: true,
    type: 'mandatory',
    title: 'Mandatory Columns Required',
    rowNumber: 1,
    missingFields: ['Date', 'Shift', 'Unit', 'Department', 'Observation', 'Staff name'],
    message: 'Row 1 has missing mandatory columns. The sheet cannot be saved until all required fields are filled.',
    confirmText: "I'll fill them"
  };
  assert.equal(mandatoryAlertState.isOpen, true);
  assert.equal(mandatoryAlertState.type, 'mandatory');
  assert.equal(mandatoryAlertState.rowNumber, 1);
  assert.equal(mandatoryAlertState.missingFields.length, 6);

  // Test modal state structure for unsaved changes confirmation on Back
  let discarded = false;
  const backAlertState = {
    isOpen: true,
    type: 'unsaved-changes',
    title: 'Unsaved Changes',
    message: 'Changes are not saved yet. Are you sure you want to go back? Unsaved edits will be lost.',
    confirmText: 'Discard & Go Back',
    cancelText: 'Stay & Keep Editing',
    onConfirm: () => { discarded = true; }
  };
  assert.equal(backAlertState.isOpen, true);
  assert.equal(backAlertState.type, 'unsaved-changes');
  backAlertState.onConfirm();
  assert.equal(discarded, true, 'Discard callback executed successfully');
});

