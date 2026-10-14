import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStaffEmployee,
  findEmployeeDepartment,
  VERIFIED_EMPLOYEE_MASTER
} from './pdcaEmployees.js';

const TEST_EMPLOYEES = [
  { id: 'emp-as081213', name: 'Yogesh Kumar', code: 'AS081213', department: 'PE' },
  { id: 'emp-gj034112', name: 'Vikram Singh', code: 'GJ034112', department: 'PE' },
  { id: 'emp-gj045819', name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality' },
  { id: 'emp-bw041920', name: 'Rahul Sharma', code: 'BW041920', department: 'Assembly' },
  { id: 'emp-bw081290', name: 'Rajesh Kumar', code: 'BW081290', department: 'Maintenance' },
  { id: 'emp-bw039182', name: 'Pooja Nair', code: 'BW039182', department: 'Maintenance' }
];

test('parseStaffEmployee correctly extracts Name and Staff ID', () => {
  assert.deepEqual(parseStaffEmployee('Deepak Mehta (GJ045819)'), {
    name: 'Deepak Mehta',
    code: 'GJ045819'
  });
  assert.deepEqual(parseStaffEmployee('  Rahul Sharma (BW041920)  '), {
    name: 'Rahul Sharma',
    code: 'BW041920'
  });
  assert.deepEqual(parseStaffEmployee('Yogesh Kumar'), {
    name: 'Yogesh Kumar',
    code: ''
  });
  assert.deepEqual(parseStaffEmployee(''), {
    name: '',
    code: ''
  });
});

test('Scenario A: selecting Staff Name matches Staff ID and Name to find correct Department', () => {
  // Quality employee
  const deptQuality = findEmployeeDepartment('Deepak Mehta (GJ045819)', TEST_EMPLOYEES);
  assert.equal(deptQuality, 'Quality');

  // Assembly employee
  const deptAssembly = findEmployeeDepartment('Rahul Sharma (BW041920)', TEST_EMPLOYEES);
  assert.equal(deptAssembly, 'Assembly');

  // PE employee
  const deptPE = findEmployeeDepartment('Vikram Singh (GJ034112)', TEST_EMPLOYEES);
  assert.equal(deptPE, 'PE');

  // Maintenance employee
  const deptMaint = findEmployeeDepartment('Rajesh Kumar (BW081290)', TEST_EMPLOYEES);
  assert.equal(deptMaint, 'Maintenance');
});

test('Scenario C: changing staff member updates Department to new employee department', () => {
  const initialDept = findEmployeeDepartment('Deepak Mehta (GJ045819)', TEST_EMPLOYEES);
  assert.equal(initialDept, 'Quality');

  const newDept = findEmployeeDepartment('Rahul Sharma (BW041920)', TEST_EMPLOYEES);
  assert.equal(newDept, 'Assembly');

  const thirdDept = findEmployeeDepartment('Pooja Nair (BW039182)', TEST_EMPLOYEES);
  assert.equal(thirdDept, 'Maintenance');
});

test('Scenario E: missing or conflicting employee records return null without guessing', () => {
  // Completely unknown employee ID & Name
  assert.equal(findEmployeeDepartment('Unknown Person (XX999999)', TEST_EMPLOYEES), null);
  assert.equal(findEmployeeDepartment('', TEST_EMPLOYEES), null);
  assert.equal(findEmployeeDepartment(null, TEST_EMPLOYEES), null);

  // Conflicting records with same code and unknown name
  const mockAmbiguousDB = [
    { name: 'John Doe', code: 'DUP001', department: 'PE' },
    { name: 'Jane Smith', code: 'DUP001', department: 'Quality' }
  ];
  assert.equal(findEmployeeDepartment('Other Person (DUP001)', mockAmbiguousDB), null);
});

test('Employee matching works with live API database records', () => {
  const customApiDB = [
    { id: 101, name: 'Siddharth Roy', code: 'EMP887766', department: 'C&C' }
  ];
  assert.equal(findEmployeeDepartment('Siddharth Roy (EMP887766)', customApiDB), 'C&C');
});
