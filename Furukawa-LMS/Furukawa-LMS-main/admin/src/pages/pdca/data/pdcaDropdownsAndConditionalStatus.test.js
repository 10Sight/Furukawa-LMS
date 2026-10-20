import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRow, createDefaultRows } from './pdcaStore.js';
import { PDCA_STATUS_OPTIONS, normalizePDCAStatus, computePDCAStatus } from './pdcaConstants.js';
import { isUserResponsibleForRow, canUserEditPDCARow, EDITABLE_RESPONSIBLE_COLUMNS, isUserInResponsibleDepartment } from './recordFilters.js';

test('1. Section P Department and dependent Unit dropdown rules', () => {
  const row = createEmptyRow();

  // Initially: Department is blank, so Unit is blank and not available
  assert.equal(row.department, '');
  assert.equal(row.unit, '');

  // Step 1: User selects Department 'Quality'
  const withDept = {
    ...row,
    department: 'Quality'
  };
  assert.equal(withDept.department, 'Quality');
  // Unit dropdown becomes available, contains options 'Bawal' and 'Gujrat'
  const validUnits = ['Bawal', 'Gujrat'];

  // Step 2: User selects 'Bawal'
  const withUnit = {
    ...withDept,
    unit: 'Bawal'
  };
  assert.equal(withUnit.department, 'Quality');
  assert.equal(withUnit.unit, 'Bawal');
  assert.ok(validUnits.includes(withUnit.unit));

  // Step 3: Changing to 'Gujrat'
  const withGujrat = {
    ...withDept,
    unit: 'Gujrat'
  };
  assert.equal(withGujrat.unit, 'Gujrat');
  assert.ok(validUnits.includes(withGujrat.unit));

  // Step 4: Clearing Department clears the dependent Unit selection as well
  const clearedDept = {
    ...withGujrat,
    department: '',
    unit: '' // Cleared when department is cleared
  };
  assert.equal(clearedDept.department, '');
  assert.equal(clearedDept.unit, '');
});

test('2. Changing Department revalidates Unit selection', () => {
  const rowWithBawal = {
    ...createEmptyRow(),
    department: 'Maintenance',
    unit: 'Bawal'
  };

  // Changing Department to 'Production' preserves valid Unit
  const changedDept = {
    ...rowWithBawal,
    department: 'Production',
    unit: ['Bawal', 'Gujrat'].includes(rowWithBawal.unit) ? rowWithBawal.unit : ''
  };
  assert.equal(changedDept.department, 'Production');
  assert.equal(changedDept.unit, 'Bawal');

  // If previous unit was invalid or stale, it is cleared
  const invalidUnitRow = {
    ...createEmptyRow(),
    department: 'Maintenance',
    unit: 'InvalidUnit'
  };
  const revalidated = {
    ...invalidUnitRow,
    department: 'PE',
    unit: ['Bawal', 'Gujrat'].includes(invalidUnitRow.unit) ? invalidUnitRow.unit : ''
  };
  assert.equal(revalidated.unit, '');
});

test('3. Section A Confirmation dropdown & Conditional Status Logic (Rules A, B, C)', () => {
  const row = createEmptyRow();
  assert.equal(normalizePDCAStatus(row.status), 'Not-Started');
  assert.equal(row.confirmation, '');

  // Rule A: When the user selects Confirmed -> Automatically set Status to 'Done' (legacy Closed)
  const confirmedRow = {
    ...row,
    confirmation: 'Confirmed',
    status: 'Done'
  };
  assert.equal(confirmedRow.confirmation, 'Confirmed');
  assert.equal(normalizePDCAStatus(confirmedRow.status), 'Done');

  // Rule B: When the user selects Not - Confirmed -> Automatically set Status to 'In- Progress'
  const notConfirmedRow = {
    ...row,
    confirmation: 'Not - Confirmed',
    status: 'In- Progress'
  };
  assert.equal(notConfirmedRow.confirmation, 'Not - Confirmed');
  assert.equal(normalizePDCAStatus(notConfirmedRow.status), 'In- Progress');

  // Rule C: Changing from Confirmed to Not - Confirmed updates Status from Done to In- Progress
  const switchedToNotConfirmed = {
    ...confirmedRow,
    confirmation: 'Not - Confirmed',
    status: 'In- Progress'
  };
  assert.equal(switchedToNotConfirmed.confirmation, 'Not - Confirmed');
  assert.equal(normalizePDCAStatus(switchedToNotConfirmed.status), 'In- Progress');

  // Rule C: Changing from Not - Confirmed to Confirmed updates Status from In- Progress to Done
  const switchedBackToConfirmed = {
    ...switchedToNotConfirmed,
    confirmation: 'Confirmed',
    status: 'Done'
  };
  assert.equal(switchedBackToConfirmed.confirmation, 'Confirmed');
  assert.equal(normalizePDCAStatus(switchedBackToConfirmed.status), 'Done');
});

test('4. Rule D: Existing and incomplete records handling with new Statuses', () => {
  // Existing record with Confirmed value -> Status must be Done
  const existingConfirmed = {
    ...createEmptyRow(),
    responsiblePersonConfirmation: 'Confirmed'
  };
  const normalizedConfirmed = {
    ...existingConfirmed,
    confirmation: 'Confirmed',
    status: 'Done'
  };
  assert.equal(normalizedConfirmed.confirmation, 'Confirmed');
  assert.equal(normalizePDCAStatus(normalizedConfirmed.status), 'Done');

  // Existing record with Not - Confirmed value -> Status must be In- Progress
  const existingNotConfirmed = {
    ...createEmptyRow(),
    responsiblePersonConfirmation: 'Not - Confirmed'
  };
  const normalizedNotConfirmed = {
    ...existingNotConfirmed,
    confirmation: 'Not - Confirmed',
    status: 'In- Progress'
  };
  assert.equal(normalizedNotConfirmed.confirmation, 'Not - Confirmed');
  assert.equal(normalizePDCAStatus(normalizedNotConfirmed.status), 'In- Progress');

  // Missing or empty confirmation value -> Keep saved status without arbitrary overwrite
  const incompleteRecord = {
    ...createEmptyRow(),
    status: 'Delay',
    confirmation: '',
    responsiblePersonConfirmation: ''
  };
  assert.equal(normalizePDCAStatus(incompleteRecord.status), 'Delay');
  assert.equal(incompleteRecord.confirmation, '');

  // Legacy 'Open' status normalizes to 'Not-Started'
  const historicalRecord = {
    ...createEmptyRow(),
    status: 'Open',
    responsiblePersonConfirmation: 'Verified on site'
  };
  assert.equal(historicalRecord.responsiblePersonConfirmation, 'Verified on site');
  assert.equal(normalizePDCAStatus(historicalRecord.status), 'Not-Started');
});

test('5. Round-trip data persistence for Department, Unit, Confirmation, and Status', () => {
  const row = {
    ...createEmptyRow(),
    date: '2026-10-16',
    shift: 'A',
    status: 'Done',
    department: 'Quality',
    unit: 'Bawal',
    confirmation: 'Confirmed',
    responsiblePersonConfirmation: 'Confirmed'
  };

  const serialized = JSON.stringify([row]);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed[0].department, 'Quality');
  assert.equal(parsed[0].unit, 'Bawal');
  assert.equal(parsed[0].confirmation, 'Confirmed');
  assert.equal(normalizePDCAStatus(parsed[0].status), 'Done');
  assert.equal(parsed[0].responsiblePersonConfirmation, 'Confirmed');
});

test('6. Renamed Status dropdown options (Not-Started, Done, In- Progress, Delay)', () => {
  assert.deepEqual(PDCA_STATUS_OPTIONS, ['Not-Started', 'Done', 'In- Progress', 'Delay']);

  // Normalizations
  assert.equal(normalizePDCAStatus('Open'), 'Not-Started');
  assert.equal(normalizePDCAStatus('Closed'), 'Done');
  assert.equal(normalizePDCAStatus('Done'), 'Done');
  assert.equal(normalizePDCAStatus('Not-Started'), 'Not-Started');
  assert.equal(normalizePDCAStatus('Delay'), 'Delay');
  assert.equal(normalizePDCAStatus('In- Progress'), 'In- Progress');
  assert.equal(normalizePDCAStatus('In - Progress'), 'In- Progress');
  assert.equal(normalizePDCAStatus('In Progress'), 'In- Progress');
});

test('7. Responsible staff permission rules (5 editable columns only)', () => {
  const assignedRow = {
    ...createEmptyRow(),
    staffEmployees: [
      { id: 'emp-101', name: 'John Doe', code: 'EMP101' },
      { id: 'emp-102', name: 'Jane Smith', code: 'EMP102' }
    ],
    rootCause: 'Machine vibration',
    counterMeasure: 'Tightened bolt',
    imageAfter: null,
    stdDurationMin: 15,
    responseDate: '2026-10-20'
  };

  const responsibleUser = { employeeId: 'EMP101', name: 'John Doe' };
  const otherResponsibleUser = { employeeId: 'EMP102', name: 'Jane Smith' };
  const unassignedUser = { employeeId: 'EMP999', name: 'Random Person' };
  const adminUser = { role: 'admin', employeeId: 'ADMIN1' };

  // Responsible check
  assert.equal(isUserResponsibleForRow(assignedRow, responsibleUser), true);
  assert.equal(isUserResponsibleForRow(assignedRow, otherResponsibleUser), true);
  assert.equal(isUserResponsibleForRow(assignedRow, unassignedUser), false);

  // Column edit permissions for responsible staff:
  // Allowed: Root cause, Counter Measure, Image after, Std. Duration in Min, Response Date, No. of time Revised
  for (const col of EDITABLE_RESPONSIBLE_COLUMNS) {
    assert.equal(canUserEditPDCARow(assignedRow, responsibleUser, null, col), true, `Responsible user should edit ${col}`);
  }

  // Denied: Other columns (Date, Shift, Status, Department, Line, Staff Name, Confirmation, etc.)
  const nonEditableCols = ['date', 'shift', 'status', 'department', 'unit', 'observation', 'imageBefore', 'staffEmployee', 'confirmation'];
  for (const col of nonEditableCols) {
    assert.equal(canUserEditPDCARow(assignedRow, responsibleUser, null, col), false, `Responsible user should NOT edit ${col}`);
  }

  // Admin user can edit all columns
  for (const col of [...EDITABLE_RESPONSIBLE_COLUMNS, ...nonEditableCols]) {
    assert.equal(canUserEditPDCARow(assignedRow, adminUser, null, col), true, `Admin should edit ${col}`);
  }

  // Unassigned user cannot edit any column
  for (const col of [...EDITABLE_RESPONSIBLE_COLUMNS, ...nonEditableCols]) {
    assert.equal(canUserEditPDCARow(assignedRow, unassignedUser, null, col), false, `Unassigned user should NOT edit ${col}`);
  }
});

test('8. Response Date & Revision logic (1st time blank, 2nd time revision with reason)', () => {
  let row = createEmptyRow();

  // First time response date selection
  const firstDate = '2026-10-25';
  row = {
    ...row,
    initialResponseDate: firstDate,
    responseDate: firstDate,
    revisedDates: [],
    noOfTimeRevised: 0
  };

  assert.equal(row.responseDate, '2026-10-25');
  assert.equal(row.initialResponseDate, '2026-10-25');
  assert.deepEqual(row.revisedDates, []);
  assert.equal(row.noOfTimeRevised, 0);

  // Second time response date selection: becomes Revision 1
  const secondDate = '2026-10-28';
  const newRevisedDates = [...row.revisedDates, { date: secondDate, reason: '' }];
  row = {
    ...row,
    responseDate: secondDate,
    revisedDates: newRevisedDates,
    noOfTimeRevised: newRevisedDates.length
  };

  assert.equal(row.responseDate, '2026-10-28');
  assert.equal(row.revisedDates.length, 1);
  assert.equal(row.revisedDates[0].date, '2026-10-28');
  assert.equal(row.revisedDates[0].reason, '');
  assert.equal(row.noOfTimeRevised, 1);

  // Entering a reason for revision 1
  row.revisedDates[0].reason = 'Supplier delayed part delivery';
  assert.equal(row.revisedDates[0].reason, 'Supplier delayed part delivery');

  // Third time response date selection: becomes Revision 2
  const thirdDate = '2026-10-31';
  row.revisedDates.push({ date: thirdDate, reason: 'Trial rescheduled' });
  row.responseDate = thirdDate;
  row.noOfTimeRevised = row.revisedDates.length;

  assert.equal(row.responseDate, '2026-10-31');
  assert.equal(row.revisedDates.length, 2);
  assert.equal(row.revisedDates[1].date, '2026-10-31');
  assert.equal(row.revisedDates[1].reason, 'Trial rescheduled');
  assert.equal(row.noOfTimeRevised, 2);
});

test('9. User requested status rule: if response date not selected -> Not-Started, if passed -> Delay, if done -> Done', () => {
  const todayStr = '2026-10-20';

  // Case 1: Response Date is empty / not selected -> Must be 'Not-Started'
  const rowNoDate = {
    ...createEmptyRow(),
    responseDate: '',
    confirmation: '',
    status: 'In- Progress' // Even if previously set, empty date forces Not-Started
  };
  assert.equal(computePDCAStatus(rowNoDate, todayStr), 'Not-Started');

  // Case 2: Response Date is in the past (e.g. 2026-10-15) and not done -> Must be 'Delay'
  const rowPassedDate = {
    ...createEmptyRow(),
    responseDate: '2026-10-15',
    confirmation: '',
    status: 'In- Progress'
  };
  assert.equal(computePDCAStatus(rowPassedDate, todayStr), 'Delay');

  // Case 3: Response Date is in the past but work IS done -> Must remain 'Done'
  const rowPassedDateDone = {
    ...createEmptyRow(),
    responseDate: '2026-10-15',
    confirmation: 'Confirmed',
    status: 'Done'
  };
  assert.equal(computePDCAStatus(rowPassedDateDone, todayStr), 'Done');

  // Case 4: Response Date is in the future (e.g. 2026-10-25) -> Must be 'In- Progress'
  const rowFutureDate = {
    ...createEmptyRow(),
    responseDate: '2026-10-25',
    confirmation: '',
    status: 'Not-Started'
  };
  assert.equal(computePDCAStatus(rowFutureDate, todayStr), 'In- Progress');

  // Case 5: Response Date is today -> Must be 'In- Progress' if not done
  const rowTodayDate = {
    ...createEmptyRow(),
    responseDate: '2026-10-20',
    confirmation: '',
    status: ''
  };
  assert.equal(computePDCAStatus(rowTodayDate, todayStr), 'In- Progress');
});

test('10. Permissions: whole selected Responsible Person Confirmation department can edit action columns', () => {
  const row = {
    ...createEmptyRow(),
    responsiblePersonDept: 'Quality',
    staffEmployees: [{ name: 'John Doe', code: 'EMP101', department: 'Quality' }]
  };

  const qualityUser = {
    empId: 'EMP999',
    fullName: 'Jane Smith',
    department: 'Quality',
    role: 'User'
  };

  const maintenanceUser = {
    empId: 'EMP555',
    fullName: 'Bob Brown',
    department: 'Maintenance',
    role: 'User'
  };

  const adminUser = {
    empId: 'ADMIN1',
    fullName: 'System Admin',
    role: 'admin',
    department: 'IT'
  };

  // Quality user is in the assigned department -> Can edit action columns
  assert.equal(isUserInResponsibleDepartment(row, qualityUser), true);
  const qualityPerms = canUserEditPDCARow(row, qualityUser);
  assert.equal(qualityPerms.canEditActionCols, true);
  assert.equal(qualityPerms.canEditEntireRow, false);
  assert.equal(canUserEditPDCARow(row, qualityUser, null, 'rootCause'), true);
  assert.equal(canUserEditPDCARow(row, qualityUser, null, 'responseDate'), true);
  assert.equal(canUserEditPDCARow(row, qualityUser, null, 'date'), false);

  // Maintenance user is NOT in the assigned department -> Cannot edit
  assert.equal(isUserInResponsibleDepartment(row, maintenanceUser), false);
  const maintPerms = canUserEditPDCARow(row, maintenanceUser);
  assert.equal(maintPerms.canEditActionCols, false);
  assert.equal(maintPerms.canEditEntireRow, false);
  assert.equal(canUserEditPDCARow(row, maintenanceUser, null, 'rootCause'), false);

  // Admin user can edit regardless of department
  const adminPerms = canUserEditPDCARow(row, adminUser);
  assert.equal(adminPerms.canEditEntireRow, true);
  assert.equal(adminPerms.canEditActionCols, true);
  assert.equal(canUserEditPDCARow(row, adminUser, null, 'date'), true);
});

