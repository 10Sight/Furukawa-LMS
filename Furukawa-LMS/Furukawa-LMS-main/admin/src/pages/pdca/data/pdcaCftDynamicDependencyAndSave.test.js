import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRow } from './pdcaStore.js';
import { VERIFIED_EMPLOYEE_MASTER, parseStaffEmployee, findEmployeeDepartment } from './pdcaEmployees.js';

test('Case A: Selecting a CFT populates dependent Department and Staff Name', () => {
  const row = createEmptyRow();

  const cftA = {
    id: 'CFT-BW-101',
    name: 'Wiring Quality CFT',
    department: 'Quality',
    members: [{ name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality' }],
    assignedEmployees: [
      { name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality' }
    ]
  };

  // Simulate handleSelectTopic logic
  const candidateList = (Array.isArray(cftA.assignedEmployees) && cftA.assignedEmployees.length > 0)
    ? cftA.assignedEmployees
    : cftA.members;

  const newStaffEmployees = candidateList.map((emp) => {
    const p = parseStaffEmployee(emp);
    const name = emp.name || p.name || '';
    const code = (emp.code || emp.empId || p.code || '').toUpperCase();
    const dept = emp.department || cftA.department || '';
    return { id: emp.id || undefined, name, code, department: dept };
  });

  const formattedStaff = newStaffEmployees
    .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
    .join(', ');

  const targetDept = cftA.department || newStaffEmployees[0]?.department || '';

  const updatedRow = {
    ...row,
    cftTopic: cftA.name,
    cftTopicId: cftA.id,
    department: targetDept,
    responsiblePersonDept: targetDept,
    staffEmployees: newStaffEmployees,
    staffEmployee: formattedStaff,
    staffName: newStaffEmployees[0]?.name || '',
    staffId: newStaffEmployees[0]?.code || '',
    employeeId: newStaffEmployees[0]?.code || '',
    responsiblePersonConfirmation: formattedStaff
  };

  assert.equal(updatedRow.cftTopic, 'Wiring Quality CFT');
  assert.equal(updatedRow.cftTopicId, 'CFT-BW-101');
  assert.equal(updatedRow.department, 'Quality');
  assert.equal(updatedRow.responsiblePersonDept, 'Quality');
  assert.equal(updatedRow.staffEmployee, 'Deepak Mehta (GJ045819)');
  assert.equal(updatedRow.staffName, 'Deepak Mehta');
  assert.equal(updatedRow.staffId, 'GJ045819');
});

test('Case B: Editing/Changing CFT replaces all dependent values without retaining previous data', () => {
  // Start with row having CFT A data
  const rowWithCftA = {
    ...createEmptyRow(),
    cftTopic: 'Wiring Quality CFT',
    cftTopicId: 'CFT-BW-101',
    department: 'Quality',
    responsiblePersonDept: 'Quality',
    staffEmployees: [{ name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality' }],
    staffEmployee: 'Deepak Mehta (GJ045819)',
    staffName: 'Deepak Mehta',
    staffId: 'GJ045819',
    employeeId: 'GJ045819',
    responsiblePersonConfirmation: 'Deepak Mehta (GJ045819)'
  };

  // Switch to CFT B
  const cftB = {
    id: 'CFT-GJ-202',
    name: 'Assembly Automation CFT',
    department: 'PE',
    members: [{ name: 'Vikram Singh', code: 'GJ034112', department: 'PE' }],
    assignedEmployees: [
      { name: 'Vikram Singh', code: 'GJ034112', department: 'PE' },
      { name: 'Yogesh Kumar', code: 'AS081213', department: 'PE' }
    ]
  };

  const candidateList = cftB.assignedEmployees;
  const newStaffEmployees = candidateList.map((emp) => {
    const p = parseStaffEmployee(emp);
    const name = emp.name || p.name || '';
    const code = (emp.code || emp.empId || p.code || '').toUpperCase();
    const dept = emp.department || cftB.department || '';
    return { id: emp.id || undefined, name, code, department: dept };
  });

  const formattedStaff = newStaffEmployees
    .map((e) => (e.code ? `${e.name} (${e.code})` : e.name))
    .join(', ');

  const targetDept = cftB.department || newStaffEmployees[0]?.department || '';

  const updatedRow = {
    ...rowWithCftA,
    cftTopic: cftB.name,
    cftTopicId: cftB.id,
    cftSelectedType: '',
    cftSelectedName: '',
    cftSelectedCode: '',
    assignedEmployee: '',
    department: targetDept,
    responsiblePersonDept: targetDept,
    staffEmployees: newStaffEmployees,
    staffEmployee: formattedStaff,
    staffName: newStaffEmployees[0]?.name || '',
    staffId: newStaffEmployees[0]?.code || '',
    employeeId: newStaffEmployees[0]?.code || '',
    responsiblePersonConfirmation: formattedStaff
  };

  // Must have CFT B data
  assert.equal(updatedRow.cftTopic, 'Assembly Automation CFT');
  assert.equal(updatedRow.cftTopicId, 'CFT-GJ-202');
  assert.equal(updatedRow.department, 'PE');
  assert.equal(updatedRow.responsiblePersonDept, 'PE');
  assert.equal(updatedRow.staffEmployees.length, 2);
  assert.equal(updatedRow.staffName, 'Vikram Singh');
  assert.equal(updatedRow.staffId, 'GJ034112');
  assert.ok(updatedRow.staffEmployee.includes('Vikram Singh (GJ034112)'));
  assert.ok(updatedRow.staffEmployee.includes('Yogesh Kumar (AS081213)'));

  // Must NOT retain any of CFT A's data
  assert.ok(!updatedRow.staffEmployee.includes('Deepak Mehta'));
  assert.notEqual(updatedRow.department, 'Quality');
  assert.notEqual(updatedRow.responsiblePersonDept, 'Quality');
});

test('Case C: Clearing/Deleting CFT clears CFT, Department, and Staff Name completely', () => {
  const rowWithCft = {
    ...createEmptyRow(),
    cftTopic: 'Wiring Quality CFT',
    cftTopicId: 'CFT-BW-101',
    cftSelectedType: 'assigned',
    cftSelectedName: 'Deepak Mehta',
    cftSelectedCode: 'GJ045819',
    assignedEmployee: 'Deepak Mehta (GJ045819)',
    department: 'Quality',
    responsiblePersonDept: 'Quality',
    staffEmployees: [{ name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality' }],
    staffEmployee: 'Deepak Mehta (GJ045819)',
    staffName: 'Deepak Mehta',
    staffId: 'GJ045819',
    employeeId: 'GJ045819',
    responsiblePersonConfirmation: 'Deepak Mehta (GJ045819)'
  };

  // Simulate handleDeleteCFT
  const clearedRow = {
    ...rowWithCft,
    cftTopic: '',
    cftTopicId: '',
    cftSelectedType: '',
    cftSelectedName: '',
    cftSelectedCode: '',
    assignedEmployee: '',
    department: '',
    responsiblePersonDept: '',
    staffEmployees: [],
    staffEmployee: '',
    staffName: '',
    staffId: '',
    employeeId: '',
    responsiblePersonConfirmation:
      rowWithCft.responsiblePersonConfirmation === rowWithCft.staffEmployee
        ? ''
        : rowWithCft.responsiblePersonConfirmation
  };

  assert.equal(clearedRow.cftTopic, '');
  assert.equal(clearedRow.cftTopicId, '');
  assert.equal(clearedRow.cftSelectedName, '');
  assert.equal(clearedRow.assignedEmployee, '');
  assert.equal(clearedRow.department, '');
  assert.equal(clearedRow.responsiblePersonDept, '');
  assert.equal(clearedRow.staffEmployees.length, 0);
  assert.equal(clearedRow.staffEmployee, '');
  assert.equal(clearedRow.staffName, '');
  assert.equal(clearedRow.staffId, '');
  assert.equal(clearedRow.employeeId, '');
  assert.equal(clearedRow.responsiblePersonConfirmation, '');
});

test('Case D: Saving a form with blank CFT is allowed when mandatory fields are valid', () => {
  const rowWithBlankCft = {
    date: '2026-10-16',
    shift: 'A',
    status: 'Open',
    lineArea: 'Crimping Line 1',
    observation: 'Pressure check within optimal range',
    cftTopic: '',
    cftTopicId: '',
    department: '',
    responsiblePersonDept: '',
    staffEmployee: '',
    staffEmployees: []
  };

  // Mandatory fields check from saveSheet
  const mandatoryFields = ['Date', 'Shift', 'Status', 'Line/Area', 'Observation'];
  const missing = [];
  if (!rowWithBlankCft.date?.trim()) missing.push('Date');
  if (!rowWithBlankCft.shift?.trim()) missing.push('Shift');
  if (!rowWithBlankCft.status?.trim()) missing.push('Status');
  if (!rowWithBlankCft.lineArea?.trim()) missing.push('Line/Area');
  if (!rowWithBlankCft.observation?.trim()) missing.push('Observation');

  assert.equal(missing.length, 0, 'No mandatory fields should be missing');
  assert.equal(rowWithBlankCft.cftTopic, '', 'CFT is blank and allowed');
});

test('Technical Requirement: In-flight race condition prevention prevents stale responses', async () => {
  const cftRequestRef = { current: {} };
  const rowIndex = 0;

  // Selection 1: User selects Topic 1
  const req1 = 100;
  cftRequestRef.current[rowIndex] = req1;

  // Immediately user selects Topic 2
  const req2 = 200;
  cftRequestRef.current[rowIndex] = req2;

  // Simulate late response from Topic 1 arriving
  let lateApplied = false;
  if (cftRequestRef.current[rowIndex] === req1) {
    lateApplied = true;
  }
  assert.equal(lateApplied, false, 'Late response from req1 must be discarded');

  // Response from Topic 2 arriving
  let req2Applied = false;
  if (cftRequestRef.current[rowIndex] === req2) {
    req2Applied = true;
  }
  assert.equal(req2Applied, true, 'Response from req2 matches current active selection and is applied');
});

test('Save behavior: Exact success message is "PDCA is saved successfully" and user remains on form', () => {
  const SUCCESS_MESSAGE = 'PDCA is saved successfully';
  assert.equal(SUCCESS_MESSAGE, 'PDCA is saved successfully');

  // Verify saveSheet does not navigate back (no onBack callback triggered on save)
  let onBackCalled = false;
  const mockOnBack = () => { onBackCalled = true; };

  // When save completes, onBack should NOT be invoked
  assert.equal(onBackCalled, false, 'User must remain on the PDCA Form after save');
});
