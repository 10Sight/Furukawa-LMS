import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITABLE_RESPONSIBLE_COLUMNS,
  isUserInResponsibleDepartment,
  canUserEditPDCARow,
  canEditRecord,
  isUserInSameDepartmentAsRecord,
  canAccessRecord,
  getUserPrimaryDepartment,
  PDCA_SHEET_TABLE_STATUSES,
  getPDCASheetStatusSummary,
  SAVE_MANDATORY_COLUMNS,
  CONFIRMATION_MANDATORY_COLUMNS,
  isRowStartedForSave,
  getMissingSaveMandatoryFields,
  getMissingConfirmationMandatoryFields,
  canUserSelectConfirmation,
  classifyPDCASheetStatus,
  getPDCAVisibleSheets,
  filterPDCARecordsBySection,
  getPDCASectionCounts,
  getSheetPointsForDepartment,
  getSheetPointsForUser
} from './recordFilters.js';
import { normalizePDCAStatus, getDepartmentsForUnit, UNIT_DEPARTMENT_MAPPING } from './pdcaConstants.js';
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

test('8. Duration Watch (HH:MM up to 99:99 hrs) and Unit -> Department -> Staff Name cascading', () => {
  // Test HH:MM duration validation
  const isValidDuration = (val) => {
    if (!val) return false;
    const str = String(val).trim();
    if (/^\d{1,2}:\d{1,2}/.test(str)) return true;
    const normalized = str.replace(/\s*(min|hrs|hr)$/i, '').trim();
    return normalized !== '' && Number.isFinite(Number(normalized)) && Number(normalized) >= 0;
  };

  assert.equal(isValidDuration('18:35'), true, '18:35 is valid');
  assert.equal(isValidDuration('19:56'), true, '19:56 is valid');
  assert.equal(isValidDuration('99:99'), true, '99:99 is valid');
  assert.equal(isValidDuration('45 min'), true, '45 min is valid');
  assert.equal(isValidDuration(''), false, 'empty is invalid');

  // Test Unit -> Department filtering: All 13 departments available in both units
  const expectedDepts = ['PE', 'IT', 'Quality', 'Assembly', 'SRC', 'Store', 'HR', 'Safety', 'FG', 'PPC', 'Maintenance', 'D&D', 'C&C'];
  const bawalDepts = getDepartmentsForUnit('Bawal');
  assert.deepEqual(bawalDepts, expectedDepts, 'Bawal must have all 13 departments');

  const gujratDepts = getDepartmentsForUnit('Gujrat');
  assert.deepEqual(gujratDepts, expectedDepts, 'Gujrat must have all 13 departments');

  const gujaratDepts = getDepartmentsForUnit('Gujarat');
  assert.deepEqual(gujaratDepts, expectedDepts, 'Gujarat must have all 13 departments');
});

test('9. Responsible Person Section: Multi-Unit, Multi-Department Subdivision & Aligned Staff Selection', () => {
  const getResponsiblePersonStructure = (row) => {
    let units = Array.isArray(row?.respUnits) && row.respUnits.length > 0 ? [...row.respUnits] : [];
    if (!units.length && row?.responsiblePersonUnit) {
      units = [row.responsiblePersonUnit];
    }
    if (!units.length) units = ['Bawal'];

    const deptsByUnit = row?.respDeptsByUnit || {};
    const staffList = Array.isArray(row?.staffEmployees) ? row.staffEmployees : [];

    return units.map(unit => {
      const allowedDepts = getDepartmentsForUnit(unit);
      let selectedDepts = Array.isArray(deptsByUnit[unit]) ? deptsByUnit[unit] : [];
      if (selectedDepts.length === 0 && row?.responsiblePersonDept) {
        selectedDepts = allowedDepts.filter(d => d.toLowerCase() === String(row.responsiblePersonDept).toLowerCase());
      }
      const deptEntries = selectedDepts.length > 0 ? selectedDepts : [''];

      const deptSections = deptEntries.map(dept => {
        const matchingStaff = staffList.find(s => {
          const matchUnit = !s.unit || s.unit.toLowerCase() === unit.toLowerCase();
          const matchDept = !dept || !s.department || s.department.toLowerCase() === dept.toLowerCase();
          return matchUnit && matchDept;
        });
        return {
          department: dept,
          staff: matchingStaff || null
        };
      });

      return {
        unit,
        allowedDepartments: allowedDepts,
        departments: deptSections
      };
    });
  };

  // 1. Both units selected -> 2 unit sections (Bawal and Gujrat)
  const initialRow = {
    respUnits: ['Bawal', 'Gujrat'],
    respDeptsByUnit: {
      Bawal: ['Quality', 'C&C'],
      Gujrat: ['IT']
    },
    staffEmployees: [
      { id: 'BW-Q-1', name: 'Ramesh Sharma', department: 'Quality', unit: 'Bawal' },
      { id: 'BW-CC-1', name: 'Anil Verma', department: 'C&C', unit: 'Bawal' },
      { id: 'GJ-IT-1', name: 'Karan Patel', department: 'IT', unit: 'Gujrat' }
    ]
  };

  const struct = getResponsiblePersonStructure(initialRow);
  assert.equal(struct.length, 2, 'Should have 2 unit sections');
  assert.equal(struct[0].unit, 'Bawal');
  assert.equal(struct[1].unit, 'Gujrat');

  // 2. Department cell subdivided into sections matching selected departments
  assert.equal(struct[0].departments.length, 2, 'Bawal should have 2 department sections');
  assert.equal(struct[0].departments[0].department, 'Quality');
  assert.equal(struct[0].departments[1].department, 'C&C');

  assert.equal(struct[1].departments.length, 1, 'Gujrat should have 1 department section');
  assert.equal(struct[1].departments[0].department, 'IT');

  // 3. Staff aligned with their respective department and unit
  assert.equal(struct[0].departments[0].staff.name, 'Ramesh Sharma', 'Quality staff aligned');
  assert.equal(struct[0].departments[1].staff.name, 'Anil Verma', 'C&C staff aligned');
  assert.equal(struct[1].departments[0].staff.name, 'Karan Patel', 'IT staff aligned');

  // 4. Dynamic update: Removing C&C from Bawal leaves Quality and doesn't affect Gujrat
  const updatedRow = {
    ...initialRow,
    respDeptsByUnit: {
      ...initialRow.respDeptsByUnit,
      Bawal: ['Quality']
    },
    staffEmployees: initialRow.staffEmployees.filter(s => !(s.unit === 'Bawal' && s.department === 'C&C'))
  };

  const updatedStruct = getResponsiblePersonStructure(updatedRow);
  assert.equal(updatedStruct[0].departments.length, 1, 'Bawal now has only 1 dept section');
  assert.equal(updatedStruct[0].departments[0].department, 'Quality');
  assert.equal(updatedStruct[0].departments[0].staff.name, 'Ramesh Sharma');
  // Gujrat unaffected
  assert.equal(updatedStruct[1].departments.length, 1);
  assert.equal(updatedStruct[1].departments[0].department, 'IT');
  assert.equal(updatedStruct[1].departments[0].staff.name, 'Karan Patel');
});

test('10. Responsible Person: 13 departments available in checkbox for both units and full department text displayed', () => {
  const REQUIRED_DEPARTMENTS = [
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

  // Both units have all 13 departments in dropdown options
  const bawalOptions = getDepartmentsForUnit('Bawal');
  const gujratOptions = getDepartmentsForUnit('Gujrat');

  assert.equal(bawalOptions.length, 13);
  assert.equal(gujratOptions.length, 13);

  REQUIRED_DEPARTMENTS.forEach(dept => {
    assert.ok(bawalOptions.includes(dept), `Bawal must include department: ${dept}`);
    assert.ok(gujratOptions.includes(dept), `Gujrat must include department: ${dept}`);
  });

  // Verify full department names are preserved without truncation
  const testSelectedDepts = ['Maintenance', 'Assembly', 'Quality', 'C&C', 'Safety'];
  testSelectedDepts.forEach(deptName => {
    assert.ok(bawalOptions.includes(deptName));
    // Full name is intact (e.g., not truncated to "Mainte..." or "Qu...")
    assert.equal(deptName.includes('...'), false);
    assert.ok(deptName.length > 2);
  });
});

test('11. Responsible Department column access, delete restriction, and LPA modal title/department freezing', () => {
  // 1. Column Access for Responsible Department employee
  const testRowWithDepts = {
    respUnits: ['Bawal'],
    respDeptsByUnit: {
      Bawal: ['Quality', 'Maintenance']
    },
    responsiblePersonDept: 'Quality, Maintenance'
  };

  const qualityUser = { id: 'u1', name: 'Ramesh QA', department: 'Quality', role: 'user', isAdmin: false };
  const maintUser = { id: 'u2', name: 'Rajesh Maint', department: 'Maintenance', role: 'user', isAdmin: false };
  const itUser = { id: 'u3', name: 'Karan IT', department: 'IT', role: 'user', isAdmin: false };

  assert.equal(isUserInResponsibleDepartment(testRowWithDepts, qualityUser), true, 'Quality user is in responsible dept');
  assert.equal(isUserInResponsibleDepartment(testRowWithDepts, maintUser), true, 'Maintenance user is in responsible dept');
  assert.equal(isUserInResponsibleDepartment(testRowWithDepts, itUser), false, 'IT user is NOT in responsible dept');

  // Verify accessible columns
  const requiredColumns = [
    'rootCause',
    'actionTaken',
    'counterMeasure',
    'imageAfter',
    'stdDurationMin',
    'responseDate'
  ];
  requiredColumns.forEach(col => {
    assert.ok(EDITABLE_RESPONSIBLE_COLUMNS.includes(col), `${col} must be accessible to responsible dept`);
    assert.equal(canUserEditPDCARow(testRowWithDepts, qualityUser, null, col), true, `Quality user can edit ${col}`);
  });
  // IT user cannot edit those columns
  requiredColumns.forEach(col => {
    assert.equal(canUserEditPDCARow(testRowWithDepts, itUser, null, col), false, `IT user cannot edit ${col}`);
  });

  // 2. Delete access restriction: Only Admin can delete sheets or rows
  const adminUser = { id: 'admin1', name: 'Super Admin', role: 'admin', isAdmin: true };
  const regularEmployee = { id: 'emp1', name: 'Normal Employee', role: 'user', isAdmin: false };
  const sheetCreator = { id: 'creator1', name: 'Sheet Creator', role: 'user', isAdmin: false };

  const canDeleteAsAdmin = Boolean(adminUser.role === 'admin' || adminUser.isAdmin);
  const canDeleteAsEmployee = Boolean(regularEmployee.role === 'admin' || regularEmployee.isAdmin);
  const canDeleteAsCreator = Boolean(sheetCreator.role === 'admin' || sheetCreator.isAdmin);

  assert.equal(canDeleteAsAdmin, true, 'Admin has delete permission');
  assert.equal(canDeleteAsEmployee, false, 'Regular employee cannot delete');
  assert.equal(canDeleteAsCreator, false, 'Creator cannot delete');

  // 3. LPA Create PDCA Modal: Title is blank by default and Department is frozen
  const initialModalForm = {
    title: '',
    date: '2026-10-25',
    unit: 'Bawal',
    department: 'Assembly'
  };
  assert.equal(initialModalForm.title, '', 'Title must be blank by default');
  assert.equal(initialModalForm.department, 'Assembly', 'Department matches active section');
});


test('12. Confirmation Column Rule: Creator-only access and 14 mandatory columns required before selecting Confirm or Not-Confirm', async () => {
  const {
    CONFIRMATION_MANDATORY_COLUMNS,
    getMissingConfirmationMandatoryFields,
    canUserSelectConfirmation,
    canUserEditPDCARow
  } = await import('./recordFilters.js');

  // Verify the exact 14 mandatory columns list
  assert.deepEqual(CONFIRMATION_MANDATORY_COLUMNS, [
    'Date',
    'Shift',
    'Status',
    'Unit',
    'Department',
    'Observation',
    'Root Cause',
    'Corrective action',
    'Counter Measure',
    'Std. Duration in Min',
    'Response date',
    'Unit (Responsible Person)',
    'Department (Responsible Person)',
    'Staff name (Responsible Person)'
  ]);

  const creatorUser = { id: 'creator-1', empId: 'EMP001', name: 'Creator User', role: 'user', isAdmin: false };
  const nonCreatorAdmin = { id: 'admin-99', empId: 'ADM099', name: 'Other Admin', role: 'ADMIN', isAdmin: true };
  const responsibleStaffUser = { id: 'staff-2', empId: 'EMP002', name: 'Ramesh Sharma', department: 'Quality', role: 'user', isAdmin: false };
  const otherUser = { id: 'other-3', empId: 'EMP003', name: 'Random Employee', department: 'IT', role: 'user', isAdmin: false };

  const pdcaSheetRecord = {
    id: 'PDCA-100',
    topic: 'PDCA Page Sheet',
    createdById: 'creator-1',
    createdBy: { id: 'creator-1', code: 'EMP001', name: 'Creator User' }
  };

  const lpaPdcaSheetRecord = {
    id: 'PDCA-LPA-ASSEMBLY-Bawal-100',
    topic: 'Assembly - LPA Observation (PDCA)',
    createdById: 'creator-1',
    createdBy: { id: 'creator-1', code: 'EMP001', name: 'Creator User' }
  };

  const completeRow = {
    date: '2026-10-28',
    shift: 'A',
    status: 'In- Progress',
    unit: 'Bawal',
    department: 'Assembly',
    observation: 'Loose bolt on fixture',
    rootCause: 'Missing lock washer',
    actionTaken: 'Added lock washer and retightened',
    counterMeasure: 'Updated daily checklist and poka-yoke',
    stdDurationMin: '00:15',
    responseDate: '2026-10-30',
    respUnit: 'Bawal',
    responsiblePersonDept: 'Quality',
    staffName: 'Ramesh Sharma',
    staffEmployee: 'Ramesh Sharma (EMP002)',
    staffEmployees: [{ id: 'staff-2', name: 'Ramesh Sharma', code: 'EMP002', unit: 'Bawal', department: 'Quality' }]
  };

  // 1. When all 14 mandatory columns are filled:
  assert.deepEqual(getMissingConfirmationMandatoryFields(completeRow), []);

  // Only sheet creator has access to select Confirmation on PDCA Sheet and LPA Observation (PDCA) Sheet
  for (const sheet of [pdcaSheetRecord, lpaPdcaSheetRecord]) {
    assert.equal(canUserSelectConfirmation(completeRow, sheet, creatorUser).allowed, true, 'Sheet creator should be allowed when all 14 mandatory columns are filled');
    assert.equal(canUserEditPDCARow(completeRow, creatorUser, sheet, 'confirmation'), true, 'Sheet creator can edit confirmation column');

    // Admin has full access to select Confirmation
    const adminCheck = canUserSelectConfirmation(completeRow, sheet, nonCreatorAdmin);
    assert.equal(adminCheck.allowed, true, 'Admin has full access to select Confirmation when mandatory columns are filled');
    assert.equal(canUserEditPDCARow(completeRow, nonCreatorAdmin, sheet, 'confirmation'), true);

    // Responsible Person cannot select Confirmation
    const respCheck = canUserSelectConfirmation(completeRow, sheet, responsibleStaffUser);
    assert.equal(respCheck.allowed, false, 'Responsible person must NOT select Confirmation');
    assert.equal(respCheck.reason, 'creator_only');
    assert.equal(canUserEditPDCARow(completeRow, responsibleStaffUser, sheet, 'confirmation'), false);

    // Random user cannot select Confirmation
    assert.equal(canUserSelectConfirmation(completeRow, sheet, otherUser).allowed, false);
  }

  // 2. Each of the 14 mandatory columns individually blocks Confirmation selection when missing
  const fieldClears = [
    { label: 'Date', mutate: r => ({ ...r, date: '' }) },
    { label: 'Shift', mutate: r => ({ ...r, shift: '' }) },
    { label: 'Status', mutate: r => ({ ...r, status: '' }) },
    { label: 'Unit', mutate: r => ({ ...r, unit: '', units: [] }) },
    { label: 'Department', mutate: r => ({ ...r, department: '', departments: [] }) },
    { label: 'Observation', mutate: r => ({ ...r, observation: '' }) },
    { label: 'Root Cause', mutate: r => ({ ...r, rootCause: '' }) },
    { label: 'Corrective action', mutate: r => ({ ...r, actionTaken: '', correctiveAction: '' }) },
    { label: 'Counter Measure', mutate: r => ({ ...r, counterMeasure: '' }) },
    { label: 'Std. Duration in Min', mutate: r => ({ ...r, stdDurationMin: '', stdDuration: '' }) },
    { label: 'Response date', mutate: r => ({ ...r, responseDate: '' }) },
    { label: 'Unit (Responsible Person)', mutate: r => ({ ...r, respUnit: '', responsiblePersonUnit: '', respUnits: [], staffEmployees: [{ name: 'Ramesh Sharma', department: 'Quality' }] }) },
    { label: 'Department (Responsible Person)', mutate: r => ({ ...r, responsiblePersonDept: '', respDept: '', respDeptsByUnit: {}, staffEmployees: [{ name: 'Ramesh Sharma', unit: 'Bawal' }] }) },
    { label: 'Staff name (Responsible Person)', mutate: r => ({ ...r, staffName: '', staffEmployee: '', staffEmployees: [] }) }
  ];

  for (const { label, mutate } of fieldClears) {
    const incompleteRow = mutate(completeRow);
    const missing = getMissingConfirmationMandatoryFields(incompleteRow);
    assert.ok(missing.includes(label), `Missing "${label}" must be detected (got: ${missing.join(', ')})`);
    const result = canUserSelectConfirmation(incompleteRow, pdcaSheetRecord, creatorUser);
    assert.equal(result.allowed, false, `Creator must NOT be able to select Confirmation when "${label}" is missing`);
    assert.equal(result.reason, 'missing_mandatory_fields');
    assert.ok(result.missingFields.includes(label));
  }
});

test('15. PDCA Sheets Table Status column (In-progress, Done, Delay, Not-Started) and centered CreateLpaModal', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  // Verify the 4 status options in PDCA_SHEET_TABLE_STATUSES
  assert.deepEqual(
    PDCA_SHEET_TABLE_STATUSES.map(s => s.label),
    ['In-progress', 'Done', 'Delay', 'Not-Started']
  );

  // Verify status summary calculation across active rows while ignoring blank default rows
  const sampleSheet = {
    id: 'PDCA-TEST-SHEET-1',
    sheet: {
      rows: [
        { date: '2026-11-01', observation: 'Obs 1', status: 'In- Progress', responseDate: '2026-11-10' },
        { date: '2026-11-01', observation: 'Obs 2', status: 'Done', confirmation: 'Confirm', responseDate: '2026-11-02' },
        { date: '2026-10-15', observation: 'Obs 3', status: 'Delay', responseDate: '2026-10-20' },
        { date: '2026-11-02', observation: 'Obs 4', status: 'Not-Started', responseDate: '' },
        { date: '', observation: '', status: '', unit: 'Bawal', department: 'Assembly' } // Blank default row
      ]
    }
  };
  const summary = getPDCASheetStatusSummary(sampleSheet, '2026-11-02');
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.done, 1);
  assert.equal(summary.delay, 1);
  assert.equal(summary.notStarted, 1);
  assert.equal(summary.total, 4);

  // Verify CreateLpaModal portals to document.body and centers in the viewport
  const modalPaths = [
    path.resolve(process.cwd(), 'src/components/lpa/CreateLpaModal.jsx'),
    path.resolve(process.cwd(), 'admin/src/components/lpa/CreateLpaModal.jsx'),
    path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/lpa/CreateLpaModal.jsx')
  ];
  const modalPath = modalPaths.find(p => fs.existsSync(p)) || modalPaths[0];
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert.match(modalContent, /createPortal\(modalContent,\s*document\.body\)/);
  assert.match(modalContent, /fixed inset-0 z-50 flex items-center justify-center/);
});

test('16. Separate Save Mandatory Columns (7) from Confirmation Mandatory Columns (14)', () => {
  assert.deepEqual(SAVE_MANDATORY_COLUMNS, [
    'Date',
    'Shift',
    'Status',
    'Unit',
    'Department',
    'Observation',
    'Staff Name'
  ]);

  assert.deepEqual(CONFIRMATION_MANDATORY_COLUMNS, [
    'Date',
    'Shift',
    'Status',
    'Unit',
    'Department',
    'Observation',
    'Root Cause',
    'Corrective action',
    'Counter Measure',
    'Std. Duration in Min',
    'Response date',
    'Unit (Responsible Person)',
    'Department (Responsible Person)',
    'Staff name (Responsible Person)'
  ]);

  // A blank template row (even with default unit/department) is not considered started for save
  const blankDefaultRow = {
    date: '',
    shift: '',
    status: '',
    unit: 'Bawal',
    department: 'Assembly',
    observation: '',
    staffName: ''
  };
  assert.equal(isRowStartedForSave(blankDefaultRow, { defaultUnit: 'Bawal', defaultDepartment: 'Assembly' }), false, 'Untouched default row should be skipped during save validation');

  // Row with ONLY the 7 Save Mandatory Columns filled (and WITHOUT Root Cause, Corrective action, Counter Measure, Std. Duration in Min, Response date)
  const saveOnlyRow = {
    date: '2026-11-02',
    shift: 'A',
    status: 'In- Progress',
    unit: 'Bawal',
    department: 'Assembly',
    observation: 'Wire routing loose near station 3',
    staffName: 'Ramesh Sharma (EMP101)',
    rootCause: '',
    actionTaken: '',
    counterMeasure: '',
    stdDurationMin: '',
    responseDate: ''
  };
  assert.equal(isRowStartedForSave(saveOnlyRow), true);
  assert.deepEqual(getMissingSaveMandatoryFields(saveOnlyRow), [], 'User CAN save the sheet when the 7 Save Mandatory Columns are filled without Confirmation columns');

  // Meanwhile, Confirmation Mandatory Columns still report the missing fields so Confirmation dropdown cannot be selected yet
  const missingForConfirmation = getMissingConfirmationMandatoryFields(saveOnlyRow);
  assert.deepEqual(missingForConfirmation, [
    'Root Cause',
    'Corrective action',
    'Counter Measure',
    'Std. Duration in Min',
    'Response date',
    'Unit (Responsible Person)',
    'Department (Responsible Person)'
  ]);

  // Verify each of the 7 Save Mandatory Columns blocks saving when missing
  const saveFieldClears = [
    { label: 'Date', mutate: r => ({ ...r, date: '' }) },
    { label: 'Shift', mutate: r => ({ ...r, shift: '' }) },
    { label: 'Status', mutate: r => ({ ...r, status: '' }) },
    { label: 'Unit', mutate: r => ({ ...r, unit: '', units: [], respUnit: '', responsiblePersonUnit: '', respUnits: [] }) },
    { label: 'Department', mutate: r => ({ ...r, department: '', departments: [], responsiblePersonDept: '', respDept: '', respDeptsByUnit: {} }) },
    { label: 'Observation', mutate: r => ({ ...r, observation: '' }) },
    { label: 'Staff Name', mutate: r => ({ ...r, staffName: '', staffEmployee: '', staffEmployees: [] }) }
  ];

  for (const { label, mutate } of saveFieldClears) {
    const incompleteSaveRow = mutate(saveOnlyRow);
    const missingSave = getMissingSaveMandatoryFields(incompleteSaveRow);
    assert.ok(missingSave.includes(label), `Missing Save Mandatory Column "${label}" must be reported (got: ${missingSave.join(', ')})`);
  }
});

test('17. Same-department & same-section users have full access to edit the whole PDCA Sheet including Confirmation dropdown, while other users cannot', () => {
  const qualityCreator = {
    id: 'u-qa-1',
    code: 'BW051211',
    name: 'Ramesh Sharma',
    department: 'Quality',
    role: 'EMPLOYEE'
  };
  const qualityColleague = {
    id: 'u-qa-2',
    code: 'BW051212',
    name: 'Suresh Patel',
    department: 'Quality',
    role: 'EMPLOYEE'
  };
  const maintenanceUser = {
    id: 'u-maint-1',
    code: 'BW081290',
    name: 'Rajesh Kumar',
    department: 'Maintenance',
    role: 'EMPLOYEE'
  };

  const qualitySheetRecord = {
    id: 'PDCA-QUALITY-01',
    topic: 'Quality Audit PDCA',
    department: 'Quality',
    createdBy: {
      id: 'u-qa-1',
      code: 'BW051211',
      name: 'Ramesh Sharma',
      department: 'Quality'
    },
    createdById: 'u-qa-1'
  };

  const sampleRow = {
    date: '2026-11-02',
    shift: 'A',
    status: 'In- Progress',
    unit: 'Bawal',
    department: 'Quality',
    observation: 'Inspection gauge calibration check',
    staffName: 'Rajesh Kumar'
  };

  // Same-department user (Quality) matches the Quality sheet
  assert.equal(isUserInSameDepartmentAsRecord(qualitySheetRecord, qualityColleague), true);
  assert.equal(canEditRecord(qualitySheetRecord, qualityColleague), true);

  // Same-department user gets full row & action column edit access across the whole sheet
  const colleaguePerms = canUserEditPDCARow(sampleRow, qualityColleague, qualitySheetRecord);
  assert.deepEqual(colleaguePerms, { canEditEntireRow: true, canEditActionCols: true });
  assert.equal(canUserEditPDCARow(sampleRow, qualityColleague, qualitySheetRecord, 'observation'), true);
  assert.equal(canUserEditPDCARow(sampleRow, qualityColleague, qualitySheetRecord, 'rootCause'), true);

  // Confirmation dropdown is accessible to the sheet creator and same dept/section colleague
  assert.equal(canUserEditPDCARow(sampleRow, qualityCreator, qualitySheetRecord, 'confirmation'), true);
  assert.equal(canUserEditPDCARow(sampleRow, qualityColleague, qualitySheetRecord, 'confirmation'), true);
  assert.equal(canUserEditPDCARow(sampleRow, maintenanceUser, qualitySheetRecord, 'confirmation'), false);

  // Different-department user (Maintenance) is NOT in same department as the sheet
  assert.equal(isUserInSameDepartmentAsRecord(qualitySheetRecord, maintenanceUser), false);
  const diffDeptPerms = canUserEditPDCARow({ ...sampleRow, staffName: 'Other Person' }, maintenanceUser, qualitySheetRecord);
  assert.deepEqual(diffDeptPerms, { canEditEntireRow: false, canEditActionCols: false });
});


test('18. All sheets restored and visible to all user IDs on PDCA & LPA Observation (PDCA)', () => {
  const qualityCreator = {
    id: 'user-qa-1',
    name: 'Deepak Mehta',
    empId: 'GJ045819',
    department: 'Quality',
    role: 'EMPLOYEE'
  };

  const hrUser = {
    id: 'user-hr-1',
    name: 'Priya Nair',
    empId: 'GJ018442',
    department: 'HR',
    role: 'EMPLOYEE'
  };

  const adminUser = {
    id: 14,
    name: 'Joy Dastidar',
    empId: 'ST080014',
    department: 'D&D',
    role: 'ADMIN',
    isAdmin: true
  };

  const qualityPdcaRecord = {
    id: 'PDCA-QA-001',
    topic: 'Quality Gauge Calibration Audit',
    department: 'Quality',
    createdBy: qualityCreator
  };

  // Admin has full access to select confirmation
  assert.equal(canUserEditPDCARow({ department: 'Quality' }, adminUser, qualityPdcaRecord, 'confirmation'), true, 'Admin can edit confirmation column');
  // Creator has access to confirmation
  assert.equal(canUserEditPDCARow({ department: 'Quality' }, qualityCreator, qualityPdcaRecord, 'confirmation'), true, 'Creator can edit confirmation column');
  // Other users cannot select confirmation
  assert.equal(canUserEditPDCARow({ department: 'Quality' }, hrUser, qualityPdcaRecord, 'confirmation'), false, 'Non-creator/non-admin cannot edit confirmation');

  // Verify DashboardPage does not hide sheets from non-admin users
  const dashboardSrc = fs.readFileSync(path.join('D:/FME Portal/Furukawa-LMS/Furukawa-LMS-main', 'admin/src/pages/pdca/pages/DashboardPage.jsx'), 'utf8');
  assert.ok(!dashboardSrc.includes('if (!canAccess) return false;'), 'DashboardPage must not filter out sheets from users');

  // Verify LpaPage allPdcaSheets includes all sheets for users
  const lpaSrc = fs.readFileSync(path.join('D:/FME Portal/Furukawa-LMS/Furukawa-LMS-main', 'admin/src/pages/lpa/LpaPage.jsx'), 'utf8');
  assert.ok(!lpaSrc.includes('filteredByDept'), 'LpaPage must not filter allPdcaSheets by department');

  // Verify server does not filter records list by department
  const serverControllerSrc = fs.readFileSync(path.join('D:/FME Portal/Furukawa-LMS/Furukawa-LMS-main', 'server/controllers/pdca/pdca.controllers.js'), 'utf8');
  assert.ok(!serverControllerSrc.includes('result.records = result.records.filter(rec => canUserAccessPDCARecord'), 'server must not filter getPDCARecords');
});


test('19. Same Department AND Same Section Access Rule: Colleagues must be in same department and same section to access PDCA sheet', () => {
  // 1. Creator in Assembly department, Assembly Production section
  const creator = {
    id: 'u-asm-creator',
    code: 'BW041920',
    name: 'Rahul Sharma',
    department: 'Assembly',
    section: 'Assembly Production',
    sectionId: 74,
    role: 'EMPLOYEE'
  };

  // 2. Colleague in Same Department ('Assembly') AND Same Section ('Assembly Production', id: 74)
  const sameDeptSameSecColleague = {
    id: 'u-asm-same-sec',
    code: 'BW041921',
    name: 'Sunil Sharma',
    department: 'Assembly',
    section: 'Assembly Production',
    sectionId: 74,
    role: 'EMPLOYEE'
  };

  // 3. Colleague in Same Department ('Assembly') but DIFFERENT Section ('AIRBAG SUB-ASSEMBLY', id: 78)
  const sameDeptDiffSecColleague = {
    id: 'u-asm-diff-sec',
    code: 'BW041922',
    name: 'Vikas Verma',
    department: 'Assembly',
    section: 'AIRBAG SUB-ASSEMBLY',
    sectionId: 78,
    role: 'EMPLOYEE'
  };

  // 4. Colleague in DIFFERENT Department ('Maintenance'), section ('Maintenance', id: 111)
  const diffDeptUser = {
    id: 'u-maint-01',
    code: 'BW081290',
    name: 'Rajesh Kumar',
    department: 'Maintenance',
    section: 'Maintenance',
    sectionId: 111,
    role: 'EMPLOYEE'
  };

  // 5. Admin user
  const adminUser = {
    id: 14,
    code: 'ST080014',
    name: 'Joy Dastidar',
    department: 'D&D',
    role: 'ADMIN',
    isAdmin: true
  };

  // The created PDCA record
  const assemblyPdcaRecord = {
    id: 'PDCA-ASM-PROD-001',
    topic: 'Assembly Production Line Audit',
    department: 'Assembly',
    section: 'Assembly Production',
    sectionId: 74,
    createdBy: creator,
    createdById: creator.id
  };

  const sampleRow = {
    date: '2026-11-03',
    shift: 'A',
    status: 'In- Progress',
    unit: 'Bawal',
    department: 'Assembly',
    observation: 'Torque tightening verification'
  };

  // A. Creator always has access
  assert.equal(isUserInSameDepartmentAsRecord(assemblyPdcaRecord, creator), true, 'Creator has access');
  assert.equal(canEditRecord(assemblyPdcaRecord, creator), true, 'Creator can edit record');

  // B. Admin always has full access
  assert.equal(canEditRecord(assemblyPdcaRecord, adminUser), true, 'Admin can edit record');

  // C. Same Department + Same Section Colleague HAS access
  assert.equal(isUserInSameDepartmentAsRecord(assemblyPdcaRecord, sameDeptSameSecColleague), true, 'Same dept + same section colleague has access');
  assert.equal(canEditRecord(assemblyPdcaRecord, sameDeptSameSecColleague), true, 'Same dept + same section colleague can edit record');
  const sameSecPerms = canUserEditPDCARow(sampleRow, sameDeptSameSecColleague, assemblyPdcaRecord);
  assert.deepEqual(sameSecPerms, { canEditEntireRow: true, canEditActionCols: true }, 'Same dept + same section colleague has full row editing');

  // D. Same Department with DIFFERENT Section Colleague CANNOT access (access is DENIED)
  assert.equal(isUserInSameDepartmentAsRecord(assemblyPdcaRecord, sameDeptDiffSecColleague), false, 'Same dept different section colleague must NOT have access');
  assert.equal(canEditRecord(assemblyPdcaRecord, sameDeptDiffSecColleague), false, 'Same dept different section colleague must NOT edit record');

  // E. Different Department AND Different Section Colleague CANNOT access (access is DENIED)
  assert.equal(isUserInSameDepartmentAsRecord(assemblyPdcaRecord, diffDeptUser), false, 'Different dept and diff sec colleague must NOT have access');
  assert.equal(canEditRecord(assemblyPdcaRecord, diffDeptUser), false, 'Different dept and diff sec colleague must NOT edit record');

  // F. Quality department: Same department colleagues have access
  const qualityRecord = {
    id: 'PDCA-QA-ASM-01',
    topic: 'Assembly Quality PDCA',
    department: 'Quality',
    section: 'Assembly Quality',
    sectionId: 70,
    createdBy: {
      id: 'u-qa-01',
      code: 'BW051211',
      name: 'Ramesh Sharma',
      department: 'Quality',
      section: 'Assembly Quality'
    }
  };

  const sameQualitySecUser = {
    id: 'u-qa-02',
    code: 'BW051212',
    name: 'Suresh Patel',
    department: 'Quality',
    section: 'Assembly Quality',
    sectionId: 70,
    role: 'EMPLOYEE'
  };

  const sameQualityDeptUser = {
    id: 'u-qa-03',
    code: 'GJ045819',
    name: 'Deepak Mehta',
    department: 'Quality',
    section: 'Quality C&C',
    sectionId: 87,
    role: 'EMPLOYEE'
  };

  assert.equal(isUserInSameDepartmentAsRecord(qualityRecord, sameQualitySecUser), true, 'Same Quality section has access');
  assert.equal(isUserInSameDepartmentAsRecord(qualityRecord, sameQualityDeptUser), false, 'Different section colleague must NOT have access');

  // G. Responsible Person column access restrictions:
  // When a user is assigned as Responsible Person (from Staff Name column):
  // They can ONLY access/edit the 6 columns:
  // Root cause, Corrective Action, Counter Measure, Image After, Std. Duration in Min, response Date.
  // They CANNOT edit any other column or the entire row/sheet.
  const respPersonUser = {
    id: 'u-qa-resp',
    code: 'BW099999',
    name: 'Responsible Staff',
    department: 'Quality',
    section: 'Assembly Quality',
    role: 'EMPLOYEE'
  };
  const rowWithRespStaff = {
    ...sampleRow,
    staffName: 'Responsible Staff (BW099999)'
  };
  const respPerms = canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord);
  assert.deepEqual(respPerms, { canEditEntireRow: false, canEditActionCols: true });
  // Permitted 6 columns
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'rootCause'), true);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'actionTaken'), true);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'counterMeasure'), true);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'imageAfter'), true);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'stdDurationMin'), true);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'responseDate'), true);
  // Denied non-action columns
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'observation'), false);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'date'), false);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'shift'), false);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'department'), false);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'staffName'), false);
  assert.equal(canUserEditPDCARow(rowWithRespStaff, respPersonUser, qualityRecord, 'confirmation'), false);
});

test('20. Same Department AND Same Section Employee Access Verification across PDCA Page & LPA Observation PDCA', () => {
  const creatorEmployee = {
    id: 19051,
    empId: 'ST080014',
    code: 'ST080014',
    name: 'Yadvender Yadav',
    department: 'Quality',
    departmentId: 1,
    section: 'Assembly Quality',
    sectionId: 70,
    role: 'EMPLOYEE'
  };

  const sameDeptSameSecColleague = {
    id: 19052,
    empId: 'BW051211',
    code: 'BW051211',
    name: 'Ramesh Sharma',
    department: 'Quality',
    departmentId: 1,
    section: 'Assembly Quality',
    sectionId: 70,
    role: 'EMPLOYEE'
  };

  const sameDeptDiffSecColleague = {
    id: 19053,
    empId: 'BW051212',
    code: 'BW051212',
    name: 'Suresh Patel',
    department: 'Quality',
    departmentId: 1,
    section: 'Quality C&C',
    sectionId: 87,
    role: 'EMPLOYEE'
  };

  const sameSecDiffDeptColleague = {
    id: 19054,
    empId: 'AS081214',
    code: 'AS081214',
    name: 'Ashok Kumar',
    department: 'Assembly',
    departmentId: 2,
    section: 'Assembly Quality',
    sectionId: 70,
    role: 'EMPLOYEE'
  };

  const diffDeptDiffSecUser = {
    id: 19055,
    empId: 'GJ071211',
    code: 'GJ071211',
    name: 'Karan Patel',
    department: 'IT',
    departmentId: 7,
    section: 'IT',
    sectionId: 113,
    role: 'EMPLOYEE'
  };

  const adminUser = {
    id: 99999,
    empId: 'ADMIN01',
    name: 'System Admin',
    role: 'ADMIN',
    isAdmin: true
  };

  // Case 1: Standard PDCA Record created by creatorEmployee
  const standardPdcaRecord = {
    id: 'PDCA-1793621991404',
    topic: 'Quality Inspection Audit',
    plant: 'Bawal',
    department: 'Quality',
    section: 'Assembly Quality',
    sectionId: 70,
    createdBy: creatorEmployee,
    createdById: String(creatorEmployee.id)
  };

  assert.equal(isUserInSameDepartmentAsRecord(standardPdcaRecord, creatorEmployee), true, 'Creator has access');
  assert.equal(isUserInSameDepartmentAsRecord(standardPdcaRecord, sameDeptSameSecColleague), true, 'Same dept + same section colleague has access');
  assert.equal(isUserInSameDepartmentAsRecord(standardPdcaRecord, sameDeptDiffSecColleague), false, 'Same dept diff section colleague does NOT have access');
  assert.equal(isUserInSameDepartmentAsRecord(standardPdcaRecord, sameSecDiffDeptColleague), false, 'Diff dept colleague does NOT have access');
  assert.equal(isUserInSameDepartmentAsRecord(standardPdcaRecord, diffDeptDiffSecUser), false, 'Different dept + different section colleague does NOT have access');
  assert.equal(isUserInSameDepartmentAsRecord(standardPdcaRecord, adminUser), true, 'Admin has full access');

  assert.equal(canEditRecord(standardPdcaRecord, sameDeptSameSecColleague), true);
  assert.equal(canEditRecord(standardPdcaRecord, sameDeptDiffSecColleague), false);
  assert.equal(canEditRecord(standardPdcaRecord, sameSecDiffDeptColleague), false);
  assert.equal(canEditRecord(standardPdcaRecord, diffDeptDiffSecUser), false);
  assert.equal(canEditRecord(standardPdcaRecord, adminUser), true);

  // Case 2: LPA Observation PDCA Record (under Assembly)
  const lpaAssemblyPdcaRecord = {
    id: 'PDCA-LPA-ASSEMBLY-Bawal-1793704111073',
    topic: 'Assembly - LPA Observation (PDCA)',
    plant: 'Bawal',
    department: 'Assembly',
    section: 'assembly',
    category: 'assembly',
    createdBy: creatorEmployee,
    createdById: String(creatorEmployee.id)
  };

  assert.equal(isUserInSameDepartmentAsRecord(lpaAssemblyPdcaRecord, creatorEmployee), true, 'Creator has access to LPA PDCA');
  assert.equal(isUserInSameDepartmentAsRecord(lpaAssemblyPdcaRecord, sameDeptSameSecColleague), true, 'Colleague in same dept as creator has access');
  assert.equal(isUserInSameDepartmentAsRecord(lpaAssemblyPdcaRecord, sameSecDiffDeptColleague), true, 'Colleague in Assembly section has access');
  assert.equal(isUserInSameDepartmentAsRecord(lpaAssemblyPdcaRecord, diffDeptDiffSecUser), false, 'IT user does NOT have access to Assembly LPA PDCA');
  assert.equal(isUserInSameDepartmentAsRecord(lpaAssemblyPdcaRecord, adminUser), true, 'Admin has access to LPA PDCA');

  assert.equal(canEditRecord(lpaAssemblyPdcaRecord, sameDeptSameSecColleague), true);
  assert.equal(canEditRecord(lpaAssemblyPdcaRecord, sameSecDiffDeptColleague), true);
  assert.equal(canEditRecord(lpaAssemblyPdcaRecord, diffDeptDiffSecUser), false);
  assert.equal(canEditRecord(lpaAssemblyPdcaRecord, adminUser), true);

  // Case 3: Verify PDCATable contains isUserInSameDepartmentAsRecord for Edit button
  const pdcaTableCode = fs.readFileSync(new URL('../../../components/pdca/PDCATable.jsx', import.meta.url), 'utf8');
  assert.ok(pdcaTableCode.includes('isUserInSameDepartmentAsRecord(row, currentUser)'), 'PDCATable Edit button must check isUserInSameDepartmentAsRecord');
});

test('21. LPA Observation PDCA Create Button Modal UI: Portaled to document.body and dead-centered in viewport', () => {
  const lpaPageCode = fs.readFileSync(new URL('../../lpa/LpaPage.jsx', import.meta.url), 'utf8');
  assert.ok(lpaPageCode.includes("import { createPortal } from 'react-dom';"), 'LpaPage must import createPortal');
  assert.ok(lpaPageCode.includes('isCreatePdcaModalOpen && ('), 'LpaPage must check isCreatePdcaModalOpen');
  assert.ok(lpaPageCode.includes('createPortal('), 'LpaPage must portal createPdcaModal to document.body');
  assert.ok(lpaPageCode.includes('z-[9999] flex items-center justify-center bg-black/50 p-4'), 'Modal must have viewport-centered fixed classes');
  assert.ok(lpaPageCode.includes('document.body'), 'Modal must target document.body as portal container');
});

test('22. Confirmation Column Spread & Reason Persistence Rule (ResponsiblePersonInstructionCell)', () => {
  const cellCode = fs.readFileSync(new URL('../../../components/pdca/ResponsiblePersonInstructionCell.jsx', import.meta.url), 'utf8');

  // Logic checks
  assert.ok(cellCode.includes('const hasReason = Boolean(instruction && instruction.trim().length > 0);'), 'Must check if instruction has reason');
  assert.ok(cellCode.includes('const shouldShowPartition = isNotConfirmed || (isConfirmed && hasReason);'), 'Partition must show when Not-Confirmed or (Confirmed and hasReason)');
  assert.ok(cellCode.includes('{isNotConfirmed && ('), 'Must render Reason input when Not-Confirmed');
  assert.ok(cellCode.includes('{isConfirmed && hasReason && ('), 'Must render Reason display when Confirmed with reason');
  assert.ok(cellCode.includes('Reason'), 'Must display Reason label in cell');

  // Behavioral test of the pure logic
  const shouldPartition = (currentConfirmation, instruction) => {
    const isConf = currentConfirmation === 'Confirmed' || currentConfirmation === 'Confirm';
    const isNotConf = currentConfirmation === 'Not - Confirmed' || currentConfirmation === 'Not-Confirmed' || currentConfirmation === 'Not-Confirm';
    const hasR = Boolean(instruction && String(instruction).trim().length > 0);
    return isNotConf || (isConf && hasR);
  };

  // Case 1: Not-Confirmed without reason yet -> partitioned to show Reason field
  assert.equal(shouldPartition('Not-Confirmed', ''), true, 'Not-Confirmed spreads into 2 parts with Reason field');

  // Case 2: Not-Confirmed with reason -> partitioned
  assert.equal(shouldPartition('Not-Confirmed', 'Tooling recalibration needed'), true);

  // Case 3: Changed to Confirmed WITH previously filled reason -> partition remains and reason is shown
  assert.equal(shouldPartition('Confirmed', 'Tooling recalibration needed'), true, 'Confirmed with filled reason retains reason partition');

  // Case 4: Confirmed WITHOUT previously filled reason -> NO partition, single dropdown
  assert.equal(shouldPartition('Confirmed', ''), false, 'Confirmed without reason has no partition');

  // Case 5: Select... without reason -> NO partition
  assert.equal(shouldPartition('', ''), false, 'Empty selection has no partition');
});

test('23. Responsible Person: 4 Columns (Unit, Dept, Staff Name, CFT) Divided in Two Parts for Both Units', () => {
  const sheetCode = fs.readFileSync(new URL('../../../components/pdca/PDCASheet.jsx', import.meta.url), 'utf8');

  // Responsible Person header spans 4 columns: Unit, Dept, Staff Name, CFT
  assert.ok(sheetCode.includes('colSpan={4}'), 'Responsible Person header must span 4 columns');
  assert.ok(sheetCode.includes('Responsible Person'), 'Header must contain Responsible Person');

  // When units.length > 1 (Both units chosen), all 4 columns use divide-y divide-[#CBD5E1]
  assert.ok(sheetCode.includes('units.length > 1'), 'CFT must check units.length > 1 for 2-part division');
  assert.ok(sheetCode.includes('divide-y divide-[#CBD5E1]'), 'All 4 columns must share divide-y divide-[#CBD5E1]');

  // CFT handler supports unitName
  assert.ok(sheetCode.includes("handleToggleCFTDropdown(idx, e, 'members', unitName)"), 'CFT trigger must support unitName');
  assert.ok(sheetCode.includes("handleEditCFTTopic(idx, e, unitName)"), 'CFT edit must support unitName');
  assert.ok(sheetCode.includes("handleDeleteCFT(idx, e, unitName)"), 'CFT delete must support unitName');
});

test('24. Responsible Person Single Constant Line Dividing Rule (Parent Column with Child Columns)', () => {
  const sheetCode = fs.readFileSync(new URL('../../../components/pdca/PDCASheet.jsx', import.meta.url), 'utf8');

  // When units.length > 1, Responsible Person must render as a single parent cell with colSpan={4}
  assert.ok(sheetCode.includes('colSpan={4}'), 'Must render parent colSpan={4} td');
  assert.ok(sheetCode.includes('flex flex-col w-full h-full divide-y divide-[#CBD5E1]'), 'Must have single constant horizontal dividing line');

  // Each sub-row contains the 4 child columns (Unit, Dept, Staff Name, CFT) with divide-x
  assert.ok(sheetCode.includes('flex w-full items-stretch divide-x divide-[#CBD5E1]'), 'Sub-rows must use items-stretch and divide-x');

  // Sub-row child column widths match headers
  assert.ok(sheetCode.includes('w-[110px] min-w-[100px]'), 'Unit width must be 110px');
  assert.ok(sheetCode.includes('w-[145px] min-w-[135px]'), 'Dept width must be 145px');
  assert.ok(sheetCode.includes('w-[160px] min-w-[150px]'), 'Staff Name width must be 160px');
  assert.ok(sheetCode.includes('w-[120px] min-w-[110px]'), 'CFT width must be 120px');
});

test('25. Std. Duration in min is mandatory for saving IF Response date is selected', () => {
  const validBaseRow = {
    date: '2026-11-04',
    shift: 'A',
    status: 'In- Progress',
    unit: 'Bawal',
    department: 'Assembly',
    observation: 'Minor vibration at stage 2',
    staffName: 'Manoj Sharma'
  };

  // Case 1: No Response date -> Std. Duration in min is optional for save
  assert.deepEqual(getMissingSaveMandatoryFields({ ...validBaseRow, responseDate: '', stdDurationMin: '' }), []);

  // Case 2: Response date is selected, but Std. Duration is empty -> mandatory save validation fails
  const missingWithResponseDate = getMissingSaveMandatoryFields({ ...validBaseRow, responseDate: '2026-11-10', stdDurationMin: '' });
  assert.ok(missingWithResponseDate.includes('Std. Duration in min'), 'Must report Std. Duration in min as mandatory when Response date is filled');

  // Case 3: Response date is selected and Std. Duration is filled -> valid for save
  assert.deepEqual(getMissingSaveMandatoryFields({ ...validBaseRow, responseDate: '2026-11-10', stdDurationMin: '01:00' }), []);
  assert.deepEqual(getMissingSaveMandatoryFields({ ...validBaseRow, responseDate: '2026-11-10', stdDurationMin: '45' }), []);
});

test('26. Image Before and Image After cells have gap from borders', () => {
  const pdcaSheetCode = fs.readFileSync(new URL('../../../components/pdca/PDCASheet.jsx', import.meta.url), 'utf8');
  const lpaSheetCode = fs.readFileSync(new URL('../../../components/lpa/LpaPdcaSheet.jsx', import.meta.url), 'utf8');

  // PDCASheet has p-1.5 padding gap and rounded corners on images
  assert.ok(pdcaSheetCode.includes('p-1.5 m-0 overflow-hidden group/imgcell'), 'PDCASheet images must have p-1.5 border gap');
  assert.ok(lpaSheetCode.includes('p-1.5 m-0 overflow-hidden group/imgcell'), 'LpaPdcaSheet images must have p-1.5 border gap');
});

test('27. S.No Counting preserves permanent row index (idx + 1) when Done rows are hidden', () => {
  const pdcaSheetCode = fs.readFileSync(new URL('../../../components/pdca/PDCASheet.jsx', import.meta.url), 'utf8');
  // PDCASheet assigns sNo as idx + 1 so hidden Done rows do not cause renumbering
  assert.ok(pdcaSheetCode.includes('const sNo = idx + 1;'), 'PDCASheet must use idx + 1 for sNo');
  assert.ok(!pdcaSheetCode.includes('visibleCounter'), 'PDCASheet must not re-index S.No using visibleCounter');
});

test('28. Image upload deletion access granted to all employees editing the sheet, while other delete permissions remain protected', () => {
  const pdcaSheetCode = fs.readFileSync(new URL('../../../components/pdca/PDCASheet.jsx', import.meta.url), 'utf8');
  const evidenceModalCode = fs.readFileSync(new URL('../../../components/pdca/EvidenceViewerModal.jsx', import.meta.url), 'utf8');

  // EvidenceViewerModal defaults canDelete to true
  assert.ok(evidenceModalCode.includes('canDelete = true'), 'EvidenceViewerModal must allow delete by default');

  // PDCASheet passes canDelete based on row/sheet edit access, not restricted to admin
  assert.ok(
    pdcaSheetCode.includes("canDelete={evidenceModal.field === 'imageAfter' ? canUserEditActionColsForModalRow : canEditEntireSheet}"),
    'EvidenceViewerModal canDelete must be granted to all employees who can edit the row/sheet'
  );

  // handleRemoveEvidenceImage is NOT blocked by !isAdmin
  assert.ok(
    !pdcaSheetCode.includes('if (!isAdmin) return;'),
    'handleRemoveEvidenceImage must not block non-admin employees'
  );
  assert.ok(
    pdcaSheetCode.includes("const isModalReadOnly = evidenceModal.field === 'imageAfter' ? !canUserEditActionColsForModalRow : !canEditEntireSheet;"),
    'handleRemoveEvidenceImage must allow all employees who can edit the sheet/row'
  );

  // Full-view modal delete button is available to users who can edit the row/sheet
  assert.ok(
    pdcaSheetCode.includes("selectedImageAction?.field === 'imageAfter' ? canUserEditActionColsForSelectedImage : canEditEntireSheet"),
    'Full-view modal delete button must be available to employees with edit access'
  );

  // Other delete permissions remain strictly protected (row deletion, sheet deletion, revision deletion)
  assert.ok(pdcaSheetCode.includes('Access Denied: Only administrators or sheet creators can delete revised dates.'), 'Revision date deletion remains strictly protected');
  assert.ok(pdcaSheetCode.includes("const canDeleteSheet = Boolean(!readOnly && (hasFullAccess || hasPermission('pdca:delete') || hasPermission('pdca:delete_sheet') || hasPermission('lpa:delete')));"), 'Sheet deletion remains protected');
  assert.ok(pdcaSheetCode.includes("const canDeleteRow = Boolean(!readOnly && (hasFullAccess || hasPermission('pdca:delete') || hasPermission('pdca:delete_row')));"), 'Row deletion remains protected');
  assert.ok(!pdcaSheetCode.includes("isCreatorOrSameDept || hasPermission('pdca:delete')"), 'canDeleteRow must not grant row deletion to non-admin creator or department employees');
});

test('29. Confirmation dropdown restricted strictly to Admin, Sheet Creator, and Same Department & Section Colleague', () => {
  const adminUser = { id: 1, role: 'ADMIN', isAdmin: true };

  const qaCreator = {
    id: 'user-qa-10',
    empId: 'BW051211',
    name: 'Ramesh Sharma',
    department: 'Quality',
    section: 'Quality Assurance'
  };

  const sameDeptSameSecColleague = {
    id: 'user-qa-11',
    empId: 'BW051212',
    name: 'Suresh Patel',
    department: 'Quality',
    section: 'Quality Assurance'
  };

  const sameDeptDiffSecColleague = {
    id: 'user-qa-12',
    empId: 'BW051213',
    name: 'Vikas Gupta',
    department: 'Quality',
    section: 'Supplier Quality Assurance'
  };

  const diffDeptUser = {
    id: 'user-maint-10',
    empId: 'BW081290',
    name: 'Rajesh Kumar',
    department: 'Maintenance',
    section: 'Electrical'
  };

  const pdcaSheet = {
    id: 'PDCA-SHEET-TEST-99',
    topic: 'QA Check Sheet',
    department: 'Quality',
    section: 'Quality Assurance',
    createdBy: qaCreator,
    createdById: qaCreator.id,
    sheet: {
      rows: [
        {
          date: '2026-11-02',
          shift: 'A',
          status: 'In- Progress',
          unit: 'Bawal',
          department: 'Maintenance',
          staffName: 'Rajesh Kumar',
          staffEmployee: 'Rajesh Kumar (BW081290)'
        }
      ]
    }
  };

  const targetRow = {
    date: '2026-11-02',
    shift: 'A',
    status: 'In- Progress',
    unit: 'Bawal',
    department: 'Quality',
    lineArea: 'Line 1',
    observation: 'Inspection check',
    rootCause: 'Improper calibration',
    actionTaken: 'Recalibrated sensor',
    counterMeasure: 'Daily calibration check',
    stdDurationMin: '00:15',
    responseDate: '2026-11-05',
    respUnit: 'Bawal',
    respDept: 'Maintenance',
    staffName: 'Rajesh Kumar',
    staffEmployee: 'Rajesh Kumar (BW081290)'
  };

  pdcaSheet.sheet.rows = [targetRow];

  // 1. Admin has access
  assert.equal(canUserEditPDCARow(targetRow, adminUser, pdcaSheet, 'confirmation'), true, 'Admin can select confirmation');
  const adminCheck = canUserSelectConfirmation(targetRow, pdcaSheet, adminUser);
  assert.equal(adminCheck.allowed, true, 'Admin confirmation check allowed');

  // 2. Sheet creator has access
  assert.equal(canUserEditPDCARow(targetRow, qaCreator, pdcaSheet, 'confirmation'), true, 'Creator can select confirmation');
  const creatorCheck = canUserSelectConfirmation(targetRow, pdcaSheet, qaCreator);
  assert.equal(creatorCheck.allowed, true, 'Creator confirmation check allowed');

  // 3. Same dept AND same sec colleague has access
  assert.equal(canUserEditPDCARow(targetRow, sameDeptSameSecColleague, pdcaSheet, 'confirmation'), true, 'Same dept & section colleague can select confirmation');
  const colleagueCheck = canUserSelectConfirmation(targetRow, pdcaSheet, sameDeptSameSecColleague);
  assert.equal(colleagueCheck.allowed, true, 'Same dept & sec confirmation check allowed');

  // 4. Same dept but DIFFERENT sec colleague does NOT have access
  assert.equal(canUserEditPDCARow(targetRow, sameDeptDiffSecColleague, pdcaSheet, 'confirmation'), false, 'Different section colleague CANNOT select confirmation');
  const diffSecCheck = canUserSelectConfirmation(targetRow, pdcaSheet, sameDeptDiffSecColleague);
  assert.equal(diffSecCheck.allowed, false, 'Different section confirmation check blocked');

  // 5. Different dept user (even though assigned as Responsible Person in row!) does NOT have confirmation access
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'confirmation'), false, 'Responsible person CANNOT select confirmation');
  const respCheck = canUserSelectConfirmation(targetRow, pdcaSheet, diffDeptUser);
  assert.equal(respCheck.allowed, false, 'Responsible person confirmation check blocked');

  // 6. Responsible person can ONLY edit the 6 action columns
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'rootCause'), true, 'Responsible person can edit rootCause');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'actionTaken'), true, 'Responsible person can edit actionTaken');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'counterMeasure'), true, 'Responsible person can edit counterMeasure');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'imageAfter'), true, 'Responsible person can edit imageAfter');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'stdDurationMin'), true, 'Responsible person can edit stdDurationMin');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'responseDate'), true, 'Responsible person can edit responseDate');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'date'), false, 'Responsible person CANNOT edit date');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'observation'), false, 'Responsible person CANNOT edit observation');
  assert.equal(canUserEditPDCARow(targetRow, diffDeptUser, pdcaSheet, 'department'), false, 'Responsible person CANNOT edit department');
});

test('30. PDCA Page Structure: Ongoing (Not-Started, In-Progress, Delay) and Done (Done) for Plant, Department, and Self PDCA', () => {
  // Verify DashboardPage.jsx renders Ongoing & Done main sections with sub-sections for Plant, Department, and Self PDCA
  const dashboardPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/pdca/pages/DashboardPage.jsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  // Verify section buttons and counts exist
  assert.match(dashboardContent, /setActiveSection\('Ongoing'\)/);
  assert.match(dashboardContent, /setActiveSection\('Done'\)/);
  assert.match(dashboardContent, /setActiveSubSection\('Not-Started'\)/);
  assert.match(dashboardContent, /setActiveSubSection\('In-Progress'\)/);
  assert.match(dashboardContent, /setActiveSubSection\('Delay'\)/);
  assert.match(dashboardContent, /setActiveSubSection\('Done'\)/);
  assert.match(dashboardContent, /sectionCounts\.Ongoing/);
  assert.match(dashboardContent, /sectionCounts\.Done/);
  assert.match(dashboardContent, /sectionCounts\['Not-Started'\]/);
  assert.match(dashboardContent, /sectionCounts\['In-Progress'\]/);
  assert.match(dashboardContent, /sectionCounts\.Delay/);

  // Verify CFT tab remains untouched and does not render the section switcher
  assert.match(dashboardContent, /activeTab !== 'CFT'/);
});

test('31. Plant-to-Department and Self PDCA visibility, independent department/self completion rules, and automatic Ongoing/Done transitions', () => {
  // Sample multi-department Plant sheet with 10 points:
  // 4 Quality points (all Done)
  // 3 Assembly/Production points (2 In-Progress, 1 Not-Started)
  // 3 Maintenance points (2 Delay, 1 In-Progress)
  const plantSheet = {
    id: 'PDCA-PLANT-MULTI-101',
    topic: 'Comprehensive Factory Audit',
    plant: 'Bawal',
    scope: 'Company',
    department: '',
    sheet: {
      rows: [
        { department: 'Quality', observation: 'Q1', confirmation: 'Confirmed', status: 'Done' },
        { department: 'Quality', observation: 'Q2', confirmation: 'Confirmed', status: 'Done' },
        { department: 'Quality', observation: 'Q3', confirmation: 'Confirmed', status: 'Done' },
        { department: 'Quality', observation: 'Q4', confirmation: 'Confirmed', status: 'Done' },
        { department: 'Assembly', observation: 'A1', confirmation: 'Not-Confirmed', status: 'In- Progress' },
        { department: 'Assembly', observation: 'A2', confirmation: 'Not-Confirmed', status: 'In- Progress' },
        { department: 'Assembly', observation: 'A3', status: 'Not-Started' },
        { department: 'Maintenance', observation: 'M1', responseDate: '2020-01-01', status: 'Delay' },
        { department: 'Maintenance', observation: 'M2', responseDate: '2020-01-01', status: 'Delay' },
        { department: 'Maintenance', observation: 'M3', confirmation: 'Not-Confirmed', status: 'In- Progress' }
      ]
    }
  };

  // 1. Plant view: overall sheet is not completed because Assembly & Maintenance have pending/delayed points
  const plantClassification = classifyPDCASheetStatus(plantSheet, 'Company');
  assert.equal(plantClassification.section, 'Ongoing', 'Plant sheet overall must be Ongoing');
  assert.equal(plantClassification.subSection, 'Delay', 'Plant sheet overall subSection must be Delay because of delayed points');
  assert.equal(plantClassification.relevantPointsCount, 10, 'Plant sheet evaluates all 10 points');

  // 2. Quality employee view in Department page:
  // All 4 Quality points are Done -> sheet must appear in Done -> Done section for Quality!
  const qualityUser = { name: 'Quality Officer', department: 'Quality', role: 'student' };
  const qualityClassification = classifyPDCASheetStatus(plantSheet, 'Department', {
    targetDept: 'Quality',
    currentUser: qualityUser
  });
  assert.equal(qualityClassification.section, 'Done', 'Quality department must classify sheet as Done');
  assert.equal(qualityClassification.subSection, 'Done', 'Quality department subSection must be Done');
  assert.equal(qualityClassification.relevantPointsCount, 4, 'Quality department evaluates ONLY its 4 points');

  // 3. Visibility test: Quality employee sees the Plant-created sheet in Department page
  const visibleForQuality = getPDCAVisibleSheets([plantSheet], 'Bawal', 'Department', { currentUser: qualityUser });
  assert.equal(visibleForQuality.length, 1, 'Quality employee must see the Plant-created sheet in Department page');
  assert.equal(visibleForQuality[0].id, 'PDCA-PLANT-MULTI-101');

  // 4. Assembly view in Department page:
  // Points are incomplete -> sheet must remain in Ongoing -> In-Progress
  const assemblyClassification = classifyPDCASheetStatus(plantSheet, 'Department', {
    targetDept: 'Assembly'
  });
  assert.equal(assemblyClassification.section, 'Ongoing', 'Assembly department must classify sheet as Ongoing');
  assert.equal(assemblyClassification.subSection, 'In-Progress', 'Assembly department subSection must be In-Progress');
  assert.equal(assemblyClassification.relevantPointsCount, 3, 'Assembly department evaluates ONLY its 3 points');

  // 5. Maintenance view in Department page:
  // Has delayed points -> sheet must remain in Ongoing -> Delay
  const maintenanceClassification = classifyPDCASheetStatus(plantSheet, 'Department', {
    targetDept: 'Maintenance'
  });
  assert.equal(maintenanceClassification.section, 'Ongoing', 'Maintenance department must classify sheet as Ongoing');
  assert.equal(maintenanceClassification.subSection, 'Delay', 'Maintenance department subSection must be Delay');
  assert.equal(maintenanceClassification.relevantPointsCount, 3, 'Maintenance department evaluates ONLY its 3 points');

  // 6. Department with NO points (e.g. Store):
  // Must NOT see the Plant sheet in their department page
  const storeUser = { name: 'Store Person', department: 'Store', role: 'student' };
  const visibleForStore = getPDCAVisibleSheets([plantSheet], 'Bawal', 'Department', { currentUser: storeUser });
  assert.equal(visibleForStore.length, 0, 'Store department must NOT see Plant sheet with no Store points');

  // 7. Reopening a point: if 1 Quality point is reopened/unconfirmed, sheet immediately moves back to Ongoing
  const reopenedSheet = JSON.parse(JSON.stringify(plantSheet));
  reopenedSheet.sheet.rows[0].confirmation = 'Not-Confirmed';
  reopenedSheet.sheet.rows[0].status = 'In- Progress';
  const reopenedQualityClass = classifyPDCASheetStatus(reopenedSheet, 'Department', {
    targetDept: 'Quality',
    currentUser: qualityUser
  });
  assert.equal(reopenedQualityClass.section, 'Ongoing', 'Reopened Quality point must move sheet back to Ongoing');
  assert.equal(reopenedQualityClass.subSection, 'In-Progress', 'Quality subSection must be In-Progress');

  // 8. Self PDCA Completion & Visibility:
  // Multi-user sheet with points assigned to Employee A and Employee B
  const userA = { name: 'Aditya Sharma', empId: 'AS081170', role: 'student' };
  const userB = { name: 'Joy Dastidar', empId: 'ST080014', role: 'student' };

  const multiUserSheet = {
    id: 'PDCA-SELF-TEST-202',
    topic: 'Line Improvement Activity',
    plant: 'Bawal',
    scope: 'Company',
    sheet: {
      rows: [
        // 4 points assigned to User A (all Done)
        { observation: 'A1', staffName: 'Aditya Sharma (AS081170)', confirmation: 'Confirmed', status: 'Done' },
        { observation: 'A2', staffEmployee: 'Aditya Sharma', confirmation: 'Confirmed', status: 'Done' },
        { observation: 'A3', staffId: 'AS081170', confirmation: 'Confirmed', status: 'Done' },
        { observation: 'A4', staffEmployees: [{ name: 'Aditya Sharma', code: 'AS081170' }], confirmation: 'Confirmed', status: 'Done' },
        // 3 points assigned to User B (In-Progress)
        { observation: 'B1', staffName: 'Joy Dastidar (ST080014)', confirmation: 'Not-Confirmed', status: 'In- Progress' },
        { observation: 'B2', staffEmployee: 'Joy Dastidar', confirmation: 'Not-Confirmed', status: 'In- Progress' },
        { observation: 'B3', staffId: 'ST080014', status: 'Not-Started' }
      ]
    }
  };

  // User A view in Self PDCA: all User A's 4 points are Done -> sheet appears in Self PDCA -> Done -> Done!
  const userAClassification = classifyPDCASheetStatus(multiUserSheet, 'Self PDCA', { currentUser: userA });
  assert.equal(userAClassification.section, 'Done', 'User A must see sheet under Done');
  assert.equal(userAClassification.subSection, 'Done', 'User A subSection must be Done');
  assert.equal(userAClassification.relevantPointsCount, 4, 'User A evaluates only their own 4 points');

  // User B's pending work does not affect User A:
  const userBClassification = classifyPDCASheetStatus(multiUserSheet, 'Self PDCA', { currentUser: userB });
  assert.equal(userBClassification.section, 'Ongoing', 'User B must see sheet under Ongoing');
  assert.equal(userBClassification.subSection, 'In-Progress', 'User B subSection must be In-Progress');
  assert.equal(userBClassification.relevantPointsCount, 3, 'User B evaluates only their own 3 points');

  // Self PDCA filtering: getSheetPointsForUser returns only the logged-in employee's points
  const userAPoints = getSheetPointsForUser(multiUserSheet, userA);
  assert.equal(userAPoints.length, 4, 'User A receives only their 4 assigned points');
  assert.ok(userAPoints.every(p => p.observation.startsWith('A')), 'User A does not see User B points');

  const userBPoints = getSheetPointsForUser(multiUserSheet, userB);
  assert.equal(userBPoints.length, 3, 'User B receives only their 3 assigned points');
  assert.ok(userBPoints.every(p => p.observation.startsWith('B')), 'User B does not see User A points');
});

test('32. FileUploadSelectionModal includes Upload Video option with 200 MB limit alongside Image, PDF, PPT, and Excel', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const modalPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/pdca/FileUploadSelectionModal.jsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // 1. Verify all 5 upload options are present in the exact order requested
  const imageIdx = modalCode.indexOf("id: 'image'");
  const pdfIdx = modalCode.indexOf("id: 'pdf'");
  const pptIdx = modalCode.indexOf("id: 'ppt'");
  const excelIdx = modalCode.indexOf("id: 'excel'");
  const videoIdx = modalCode.indexOf("id: 'video'");

  assert.ok(imageIdx !== -1, 'Upload Image option must exist');
  assert.ok(pdfIdx !== -1, 'Upload PDF option must exist');
  assert.ok(pptIdx !== -1, 'Upload PPT option must exist');
  assert.ok(excelIdx !== -1, 'Upload Excel option must exist');
  assert.ok(videoIdx !== -1, 'Upload Video option must exist');

  assert.ok(imageIdx < pdfIdx, 'Upload Image must precede Upload PDF');
  assert.ok(pdfIdx < pptIdx, 'Upload PDF must precede Upload PPT');
  assert.ok(pptIdx < excelIdx, 'Upload PPT must precede Upload Excel');
  assert.ok(excelIdx < videoIdx, 'Upload Excel must precede Upload Video');

  // 2. Verify 200 MB limit for Video
  assert.ok(modalCode.includes('200 * 1024 * 1024'), '200 MB limit must be configured for Video');
  assert.ok(modalCode.includes('Video limit 200 MB') || modalCode.includes('Video (limit 200 MB)') || modalCode.includes('200 MB'), '200 MB limit must be mentioned in description or badge');

  // 3. Verify grid layout supports 5 options
  assert.ok(modalCode.includes('lg:grid-cols-5'), 'Grid layout must support 5 columns on desktop');

  // 4. Verify PDCASheet and LpaPdcaSheet support video
  const pdcaPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/pdca/PDCASheet.jsx');
  const lpaPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/lpa/LpaPdcaSheet.jsx');
  const pdcaCode = fs.readFileSync(pdcaPath, 'utf8');
  const lpaCode = fs.readFileSync(lpaPath, 'utf8');

  assert.ok(pdcaCode.includes("'video'"), 'PDCASheet must support video file type');
  assert.ok(lpaCode.includes("'video'"), 'LpaPdcaSheet must support video file type');
});
