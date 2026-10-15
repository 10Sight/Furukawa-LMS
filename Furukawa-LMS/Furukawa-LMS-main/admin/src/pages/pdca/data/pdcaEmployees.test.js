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

test('Automatic Employee ID retrieval matches employee record accurately', () => {
  const emp = TEST_EMPLOYEES.find(e => e.name.toLowerCase() === 'deepak mehta');
  assert.ok(emp);
  assert.equal(emp.code, 'GJ045819');
  assert.equal(emp.department, 'Quality');

  // Verify format matches expected name + code
  const formatted = `${emp.name} (${emp.code})`;
  const parsed = parseStaffEmployee(formatted);
  assert.equal(parsed.name, 'Deepak Mehta');
  assert.equal(parsed.code, 'GJ045819');
});

test('Search filtering by employee name and employee ID finds exact records', () => {
  const queryName = 'deepak';
  const matchByName = TEST_EMPLOYEES.filter(e =>
    e.name.toLowerCase().includes(queryName) || e.code.toLowerCase().includes(queryName)
  );
  assert.equal(matchByName.length, 1);
  assert.equal(matchByName[0].code, 'GJ045819');

  const queryCode = 'gj045819';
  const matchByCode = TEST_EMPLOYEES.filter(e =>
    e.name.toLowerCase().includes(queryCode) || e.code.toLowerCase().includes(queryCode)
  );
  assert.equal(matchByCode.length, 1);
  assert.equal(matchByCode[0].name, 'Deepak Mehta');
});

test('Multi-employee string parsing and department resolution for Staff Employees modal', () => {
  const multiEmployeeString = 'VIKRAM SINGH (GJ034112), RAJESH KUMAR (BW081290)';
  
  // 1. Parsing extracts the primary employee cleanly without regex greediness
  const parsed = parseStaffEmployee(multiEmployeeString);
  assert.equal(parsed.name, 'VIKRAM SINGH');
  assert.equal(parsed.code, 'GJ034112');

  // 2. Department resolves for multi-employee string
  const dept = findEmployeeDepartment(multiEmployeeString, TEST_EMPLOYEES);
  assert.equal(dept, 'PE');

  // 3. Round-trip serialization matches modal behavior
  const employeesList = [
    { name: 'VIKRAM SINGH', code: 'GJ034112' },
    { name: 'RAJESH KUMAR', code: 'BW081290' }
  ];
  const formatted = employeesList
    .map(emp => emp.code ? `${emp.name} (${emp.code})` : emp.name)
    .join(', ');
  assert.equal(formatted, multiEmployeeString);
});

test('Multiple employees in a single cell retain their individual departments', () => {
  const EMPLOYEES_DB = [
    { id: '1', name: 'VIKRAM SINGH', code: 'GJ034112', department: 'PE' },
    { id: '2', name: 'RAHUL SHARMA', code: 'GJ034125', department: 'Quality' },
    { id: '3', name: 'AMIT KUMAR', code: 'GJ034138', department: 'Maintenance' }
  ];

  // Simulating input of multiple employees assigned to a single CFT topic (e.g. "Alignment Issue")
  const assignedList = [
    { name: 'VIKRAM SINGH', code: 'GJ034112' },
    { name: 'RAHUL SHARMA', code: 'GJ034125' },
    { name: 'AMIT KUMAR', code: 'GJ034138' }
  ];

  // Each employee resolves their own verified department independently
  const enriched = assignedList.map((emp) => ({
    ...emp,
    department: emp.department || findEmployeeDepartment(`${emp.name} (${emp.code})`, EMPLOYEES_DB) || ''
  }));

  assert.equal(enriched.length, 3);
  assert.equal(enriched[0].name, 'VIKRAM SINGH');
  assert.equal(enriched[0].department, 'PE');

  assert.equal(enriched[1].name, 'RAHUL SHARMA');
  assert.equal(enriched[1].department, 'Quality');

  assert.equal(enriched[2].name, 'AMIT KUMAR');
  assert.equal(enriched[2].department, 'Maintenance');

  // Formatted string representation for single cell display
  const singleCellString = enriched
    .map(e => `${e.name} (${e.code})`)
    .join(', ');
  assert.equal(singleCellString, 'VIKRAM SINGH (GJ034112), RAHUL SHARMA (GJ034125), AMIT KUMAR (GJ034138)');

  // Removing one employee (e.g. index 1: Rahul Sharma) leaves the other two intact
  const updatedGroup = enriched.filter((_, idx) => idx !== 1);
  assert.equal(updatedGroup.length, 2);
  assert.equal(updatedGroup[0].name, 'VIKRAM SINGH');
  assert.equal(updatedGroup[0].department, 'PE');
  assert.equal(updatedGroup[1].name, 'AMIT KUMAR');
  assert.equal(updatedGroup[1].department, 'Maintenance');

  const afterRemovalString = updatedGroup
    .map(e => `${e.name} (${e.code})`)
    .join(', ');
  assert.equal(afterRemovalString, 'VIKRAM SINGH (GJ034112), AMIT KUMAR (GJ034138)');
});


