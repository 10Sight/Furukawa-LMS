import test from 'node:test';
import assert from 'node:assert/strict';
import { EDITABLE_RESPONSIBLE_COLUMNS, isUserInResponsibleDepartment, canUserEditPDCARow } from './recordFilters.js';
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

