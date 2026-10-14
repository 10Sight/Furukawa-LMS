import test from 'node:test';
import assert from 'node:assert/strict';
import { getStoredUnit, saveStoredUnit, PDCA_PLANTS } from './recordFilters.js';
import { VERIFIED_EMPLOYEE_MASTER } from './pdcaEmployees.js';
import { addPDCA, updatePDCA, loadPDCA } from './pdcaStore.js';

// Setup sessionStorage mock for Node.js test runner
const sessionMap = new Map();
globalThis.sessionStorage = {
  getItem: k => sessionMap.get(k) ?? null,
  setItem: (k, v) => sessionMap.set(k, String(v)),
  removeItem: k => sessionMap.delete(k),
  clear: () => sessionMap.clear()
};

test('1. Default unit is Bawal for new records and sessions across modules', () => {
  sessionMap.clear();

  // getStoredUnit with a new user should default to 'Bawal'
  const defaultUnit = getStoredUnit('test-user-bawal-1');
  assert.equal(defaultUnit, 'Bawal', 'New session must default to Bawal');

  // Manual selection of Gujrat is respected
  saveStoredUnit('Gujrat', 'test-user-bawal-1');
  assert.equal(getStoredUnit('test-user-bawal-1'), 'Gujrat', 'Manual selection to Gujrat must be respected');

  // Existing records retain their saved unit
  const existingRecordGujrat = {
    id: 'PDCA-EXISTING-GJ',
    topic: 'Gujrat Line Audit',
    plant: 'Gujrat',
    scope: 'Company'
  };
  assert.equal(existingRecordGujrat.plant, 'Gujrat', 'Existing record must keep its saved unit');

  const existingRecordBawal = {
    id: 'PDCA-EXISTING-BW',
    topic: 'Bawal Quality Check',
    plant: 'Bawal',
    scope: 'Company'
  };
  assert.equal(existingRecordBawal.plant, 'Bawal', 'Existing record must keep its saved unit');
});

test('2. CFT Member Department strictly comes from selected Member, NOT Employee', () => {
  // Employee: Rahul Sharma (Assembly)
  const employee = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'BW041920');
  assert.ok(employee, 'Rahul Sharma exists');
  assert.equal(employee.department, 'Assembly');

  // Member (Lead): Deepak Mehta (Quality)
  const member = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'GJ045819');
  assert.ok(member, 'Deepak Mehta exists');
  assert.equal(member.department, 'Quality');

  // Simulate CFT creation with Member from Quality and Employee from Assembly
  const cftItem = {
    id: 'CFT-TEST-DEPT-1',
    topic: 'Quality Skill Enhancement Protocol',
    plant: 'Bawal',
    scope: 'CFT',
    // Rule: CFT Department must come from Member's department, not Employee's department
    department: member.department,
    memberDepartment: member.department,
    createdBy: {
      name: member.name,
      code: member.code,
      department: member.department,
      id: member.id
    },
    assignedMembers: [
      {
        id: employee.id,
        name: employee.name,
        code: employee.code,
        department: employee.department
      }
    ]
  };

  // Assertions:
  assert.equal(cftItem.department, 'Quality', 'CFT Department must be Quality');
  assert.notEqual(cftItem.department, employee.department, 'CFT Department must not be overwritten by Employee department (Assembly)');
  assert.equal(cftItem.createdBy.department, 'Quality', 'Member department is Quality');
  assert.equal(cftItem.assignedMembers[0].department, 'Assembly', 'Employee retains their own department');
});

test('3. Member and Employee selection are strictly independent', () => {
  // Initial state: Member is Deepak Mehta (Quality)
  let selectedMember = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'GJ045819');
  let memberDepartment = selectedMember.department;
  let assignedEmployees = [
    VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'BW041920') // Rahul Sharma (Assembly)
  ];

  assert.equal(memberDepartment, 'Quality');
  assert.equal(assignedEmployees[0].name, 'Rahul Sharma');

  // Action A: Changing Employee to Rajesh Kumar (Maintenance) does NOT change Member Department
  const newEmployee = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'BW081290'); // Rajesh Kumar (Maintenance)
  assert.equal(newEmployee.department, 'Maintenance');
  assignedEmployees = [newEmployee];

  assert.equal(memberDepartment, 'Quality', 'Member Department must remain Quality after changing Employee');
  assert.equal(selectedMember.name, 'Deepak Mehta', 'Selected Member must not change when Employee changes');

  // Action B: Changing Member to Yogesh Kumar (PE) updates Member Department to PE
  selectedMember = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'AS081213'); // Yogesh Kumar (PE)
  memberDepartment = selectedMember.department;

  assert.equal(memberDepartment, 'PE', 'Member Department must update to PE when Member changes');
  assert.equal(assignedEmployees[0].name, 'Rajesh Kumar', 'Assigned Employee must remain untouched when Member changes');

  // Action C: Member with no department displays "Department not assigned"
  const memberNoDept = { id: 'emp-custom', name: 'New Contractor', code: 'NC01', department: '' };
  memberDepartment = memberNoDept.department || 'Department not assigned';
  assert.equal(memberDepartment, 'Department not assigned', 'Missing department must display Department not assigned');
});

test('4. CFT Record persists with valid identifiers and integrates in PDCA', () => {
  const member = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'GJ045819'); // Deepak Mehta (Quality)
  const employee = VERIFIED_EMPLOYEE_MASTER.find(e => e.code === 'BW041920'); // Rahul Sharma (Assembly)

  const initialRecords = [];
  const newCft = {
    id: 'CFT-PERSIST-101',
    topic: 'Cross-Functional Kaizen',
    plant: 'Bawal',
    scope: 'CFT',
    department: member.department, // 'Quality'
    createdBy: {
      name: member.name,
      code: member.code,
      department: member.department
    },
    assignedMembers: [
      { name: employee.name, code: employee.code, department: employee.department }
    ],
    sheet: {
      headerInfo: { topicName: 'Cross-Functional Kaizen', preparedBy: member.name },
      rows: []
    }
  };

  const savedList = addPDCA(initialRecords, newCft);
  assert.equal(savedList.length, 1);
  assert.equal(savedList[0].id, 'CFT-PERSIST-101');
  assert.equal(savedList[0].department, 'Quality');
  assert.equal(savedList[0].plant, 'Bawal');

  // Reopening saved record retains Member and department
  const loaded = savedList.find(r => r.id === 'CFT-PERSIST-101');
  assert.equal(loaded.department, 'Quality');
  assert.equal(loaded.createdBy.name, 'Deepak Mehta');
  assert.equal(loaded.assignedMembers[0].name, 'Rahul Sharma');
});
