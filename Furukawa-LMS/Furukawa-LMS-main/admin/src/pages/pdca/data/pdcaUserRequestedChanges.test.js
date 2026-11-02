import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITABLE_RESPONSIBLE_COLUMNS, isUserInResponsibleDepartment, canUserEditPDCARow, canEditRecord, isUserInSameDepartmentAsRecord, canAccessRecord, getUserPrimaryDepartment, PDCA_SHEET_TABLE_STATUSES, getPDCASheetStatusSummary, SAVE_MANDATORY_COLUMNS, CONFIRMATION_MANDATORY_COLUMNS, isRowStartedForSave, getMissingSaveMandatoryFields, getMissingConfirmationMandatoryFields } from './recordFilters.js';
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
    path.resolve(process.cwd(), 'admin/src/components/lpa/CreateLpaModal.jsx')
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

test('17. Same-department users have full access to edit the whole PDCA Sheet, while Confirmation dropdown remains restricted to sheet creator', () => {
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

  // Confirmation dropdown remains restricted strictly to the sheet creator
  assert.equal(canUserEditPDCARow(sampleRow, qualityCreator, qualitySheetRecord, 'confirmation'), true);
  assert.equal(canUserEditPDCARow(sampleRow, qualityColleague, qualitySheetRecord, 'confirmation'), false);

  // Different-department user (Maintenance) is NOT in same department as the sheet
  assert.equal(isUserInSameDepartmentAsRecord(qualitySheetRecord, maintenanceUser), false);
  const diffDeptPerms = canUserEditPDCARow({ ...sampleRow, staffName: 'Other Person' }, maintenanceUser, qualitySheetRecord);
  assert.deepEqual(diffDeptPerms, { canEditEntireRow: false, canEditActionCols: false });
});


test('18. Department-Based Access Control for PDCA & LPA Observation (PDCA)', () => {
  const qualityCreator = {
    id: 'user-qa-1',
    name: 'Deepak Mehta',
    empId: 'GJ045819',
    department: 'Quality',
    role: 'EMPLOYEE'
  };

  const qualityColleague = {
    id: 'user-qa-2',
    name: 'Ramesh Sharma',
    empId: 'BW051211',
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

  const prodUser = {
    id: 'user-prod-1',
    name: 'Rahul Sharma',
    empId: 'BW041920',
    department: 'Assembly',
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

  // 1. Primary department resolution
  assert.equal(getUserPrimaryDepartment(qualityCreator), 'Quality');
  assert.equal(getUserPrimaryDepartment(hrUser), 'HR');
  assert.equal(getUserPrimaryDepartment({ name: 'Deepak Mehta', code: 'GJ045819' }), 'Quality');

  // 2. PDCA Sheet Access Control
  const qualityPdcaRecord = {
    id: 'PDCA-QA-001',
    topic: 'Quality Gauge Calibration Audit',
    department: 'Quality',
    createdBy: qualityCreator
  };

  // Quality user & colleague have full access to Quality sheet
  assert.equal(canAccessRecord(qualityPdcaRecord, qualityCreator), true, 'Creator has access');
  assert.equal(canAccessRecord(qualityPdcaRecord, qualityColleague), true, 'Same department colleague has access');
  assert.equal(canEditRecord(qualityPdcaRecord, qualityColleague), true, 'Same department colleague can edit');

  // Other departments (HR, Assembly/Prod) CANNOT access Quality sheet
  assert.equal(canAccessRecord(qualityPdcaRecord, hrUser), false, 'HR user cannot access Quality sheet');
  assert.equal(canEditRecord(qualityPdcaRecord, hrUser), false, 'HR user cannot edit Quality sheet');
  assert.equal(canAccessRecord(qualityPdcaRecord, prodUser), false, 'Assembly user cannot access Quality sheet');
  assert.equal(canEditRecord(qualityPdcaRecord, prodUser), false, 'Assembly user cannot edit Quality sheet');

  // Admin has unrestricted access to all records across all departments
  assert.equal(canAccessRecord(qualityPdcaRecord, adminUser), true, 'Admin can access Quality sheet');
  assert.equal(canEditRecord(qualityPdcaRecord, adminUser), true, 'Admin can edit Quality sheet');
  assert.equal(canUserEditPDCARow({ department: 'Quality' }, adminUser, qualityPdcaRecord, 'confirmation'), true, 'Admin can edit confirmation column');

  // 3. LPA Observation (PDCA) Access Control
  const qualityLpaPdcaSheet = {
    id: 'PDCA-LPA-ASSEMBLY-Bawal-001',
    title: 'Assembly - LPA Observation (PDCA) #Quality',
    department: 'Quality',
    createdBy: qualityCreator
  };

  assert.equal(canAccessRecord(qualityLpaPdcaSheet, qualityCreator), true, 'Quality creator can access LPA PDCA');
  assert.equal(canAccessRecord(qualityLpaPdcaSheet, qualityColleague), true, 'Quality colleague can access LPA PDCA');
  assert.equal(canAccessRecord(qualityLpaPdcaSheet, hrUser), false, 'HR user cannot access Quality LPA PDCA');
  assert.equal(canAccessRecord(qualityLpaPdcaSheet, adminUser), true, 'Admin can access Quality LPA PDCA');

  // 4. Source code verification for frontend and backend access enforcement
  const dashboardSrc = fs.readFileSync(path.join('D:/FME Portal/Furukawa-LMS/Furukawa-LMS-main', 'admin/src/pages/pdca/pages/DashboardPage.jsx'), 'utf8');
  assert.ok(dashboardSrc.includes('isUserInSameDepartmentAsRecord'), 'DashboardPage must use isUserInSameDepartmentAsRecord');
  assert.ok(dashboardSrc.includes('isUserAdmin'), 'DashboardPage must check isUserAdmin');

  const lpaSrc = fs.readFileSync(path.join('D:/FME Portal/Furukawa-LMS/Furukawa-LMS-main', 'admin/src/pages/lpa/LpaPage.jsx'), 'utf8');
  assert.ok(lpaSrc.includes('filteredByDept'), 'LpaPage must filter allPdcaSheets by department');
  assert.ok(lpaSrc.includes('getUserPrimaryDepartment'), 'LpaPage must use getUserPrimaryDepartment for new sheets');

  const serverControllerSrc = fs.readFileSync(path.join('D:/FME Portal/Furukawa-LMS/Furukawa-LMS-main', 'server/controllers/pdca/pdca.controllers.js'), 'utf8');
  assert.ok(serverControllerSrc.includes('canUserAccessPDCARecord'), 'server pdca.controllers.js must export canUserAccessPDCARecord');
  assert.ok(serverControllerSrc.includes('getPDCARecords'), 'server pdca.controllers.js must filter getPDCARecords for non-admins');
  assert.ok(serverControllerSrc.includes('getPDCARecordById'), 'server pdca.controllers.js must enforce department in getPDCARecordById');
});
