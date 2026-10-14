import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  findEmployeeDepartment,
  VERIFIED_EMPLOYEE_MASTER
} from './pdcaEmployees.js';

const TEST_EMPLOYEE_MASTER = [
  { id: 'emp-as081213', name: 'Yogesh Kumar', code: 'AS081213', department: 'PE' },
  { id: 'emp-st080014', name: 'Joy Dastidar', code: 'ST080014', department: 'IT' },
  { id: 'emp-gj045819', name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality' },
  { id: 'emp-bw041920', name: 'Rahul Sharma', code: 'BW041920', department: 'Assembly' },
  { id: 'emp-bw081290', name: 'Rajesh Kumar', code: 'BW081290', department: 'Maintenance' },
  { id: 'emp-bw039182', name: 'Pooja Nair', code: 'BW039182', department: 'Maintenance' },
  { id: 'emp-bw071562', name: 'Sandeep Verma', code: 'BW071562', department: 'PPC' },
  { id: 'emp-gj092311', name: 'Amit Patel', code: 'GJ092311', department: 'HR' }
];

describe('PDCA Responsible Person Confirmation - Scenarios A to E', () => {
  // Simulate row state transitions identical to PDCASheet handlers
  const createInitialRows = () => [
    { department: '', staffEmployee: '', responsiblePersonConfirmation: '' },
    { department: '', staffEmployee: '', responsiblePersonConfirmation: '' },
    { department: '', staffEmployee: '', responsiblePersonConfirmation: '' }
  ];

  const handleDepartmentChange = (rows, rowIndex, dept) => {
    const updated = [...rows];
    const prevDept = updated[rowIndex]?.department || '';
    const shouldClearStaff = prevDept !== dept;
    updated[rowIndex] = {
      ...updated[rowIndex],
      department: dept,
      staffEmployee: shouldClearStaff ? '' : (updated[rowIndex]?.staffEmployee || '')
    };
    return updated;
  };

  const handleSelectStaffMember = (rows, rowIndex, staffValue, db = TEST_EMPLOYEE_MASTER) => {
    const updated = [...rows];
    if (!staffValue || !staffValue.trim()) {
      updated[rowIndex] = {
        ...updated[rowIndex],
        staffEmployee: ''
      };
      return { rows: updated, matchedDept: null };
    }

    const trimmedStaff = staffValue.trim();
    const matchedDept = findEmployeeDepartment(trimmedStaff, db);
    const currentRow = updated[rowIndex] || {};

    if (matchedDept) {
      updated[rowIndex] = {
        ...currentRow,
        staffEmployee: trimmedStaff,
        department: matchedDept
      };
    } else {
      updated[rowIndex] = {
        ...currentRow,
        staffEmployee: trimmedStaff
      };
    }
    return { rows: updated, matchedDept };
  };

  it('Scenario A: User selects Staff Name first -> automatically populates correct verified department', () => {
    let rows = createInitialRows();

    // User selects Deepak Mehta (GJ045819) on row 0
    const res = handleSelectStaffMember(rows, 0, 'Deepak Mehta (GJ045819)');
    rows = res.rows;

    assert.strictEqual(rows[0].staffEmployee, 'Deepak Mehta (GJ045819)');
    assert.strictEqual(rows[0].department, 'Quality');
    assert.strictEqual(res.matchedDept, 'Quality');
  });

  it('Scenario B: User selects Department first -> keeps Staff Name blank (no auto-selection of first employee)', () => {
    let rows = createInitialRows();

    // User selects Department "Quality" on row 1
    rows = handleDepartmentChange(rows, 1, 'Quality');

    assert.strictEqual(rows[1].department, 'Quality');
    assert.strictEqual(rows[1].staffEmployee, '');
    assert.notStrictEqual(rows[1].staffEmployee, 'Deepak Mehta (GJ045819)');
  });

  it('Scenario C: User changes selected staff member -> updates Department to match newly selected employee', () => {
    let rows = createInitialRows();

    // 1. First selects Deepak Mehta (Quality)
    rows = handleSelectStaffMember(rows, 0, 'Deepak Mehta (GJ045819)').rows;
    assert.strictEqual(rows[0].department, 'Quality');

    // 2. Changes to Rahul Sharma (BW041920) (Assembly)
    rows = handleSelectStaffMember(rows, 0, 'Rahul Sharma (BW041920)').rows;
    assert.strictEqual(rows[0].staffEmployee, 'Rahul Sharma (BW041920)');
    assert.strictEqual(rows[0].department, 'Assembly');

    // 3. Changes to Sandeep Verma (BW071562) (PPC)
    rows = handleSelectStaffMember(rows, 0, 'Sandeep Verma (BW071562)').rows;
    assert.strictEqual(rows[0].staffEmployee, 'Sandeep Verma (BW071562)');
    assert.strictEqual(rows[0].department, 'PPC');
  });

  it('Scenario D: User changes department after selecting a staff member -> clears Staff Name', () => {
    let rows = createInitialRows();

    // 1. User selects Deepak Mehta (Quality)
    rows = handleSelectStaffMember(rows, 0, 'Deepak Mehta (GJ045819)').rows;
    assert.strictEqual(rows[0].staffEmployee, 'Deepak Mehta (GJ045819)');
    assert.strictEqual(rows[0].department, 'Quality');

    // 2. User manually changes department to "Maintenance"
    rows = handleDepartmentChange(rows, 0, 'Maintenance');
    assert.strictEqual(rows[0].department, 'Maintenance');
    assert.strictEqual(rows[0].staffEmployee, '', 'Previous staff employee must be cleared');

    // 3. User can now select a Maintenance staff manually
    rows = handleSelectStaffMember(rows, 0, 'Rajesh Kumar (BW081290)').rows;
    assert.strictEqual(rows[0].staffEmployee, 'Rajesh Kumar (BW081290)');
    assert.strictEqual(rows[0].department, 'Maintenance');
  });

  it('Scenario E: Employee record missing or ambiguous -> does not guess department', () => {
    let rows = createInitialRows();

    // 1. Missing record
    const resMissing = handleSelectStaffMember(rows, 0, 'Unknown Contractor (XX9999)');
    rows = resMissing.rows;
    assert.strictEqual(rows[0].staffEmployee, 'Unknown Contractor (XX9999)');
    assert.strictEqual(rows[0].department, '', 'Department must not be guessed');
    assert.strictEqual(resMissing.matchedDept, null);

    // 2. Conflicting/ambiguous record (same code in different departments)
    const mockConflictingDb = [
      { id: 1, name: 'John Doe', code: 'DUP001', department: 'Quality' },
      { id: 2, name: 'Jane Smith', code: 'DUP001', department: 'Assembly' }
    ];
    const resAmbiguous = handleSelectStaffMember(rows, 1, 'Stranger (DUP001)', mockConflictingDb);
    rows = resAmbiguous.rows;
    assert.strictEqual(rows[1].department, '', 'Conflicting records must not be guessed');
    assert.strictEqual(resAmbiguous.matchedDept, null);
  });

  it('Multiple rows work independently', () => {
    let rows = createInitialRows();

    // Row 0: User selects staff Joy Dastidar (IT)
    rows = handleSelectStaffMember(rows, 0, 'Joy Dastidar (ST080014)').rows;

    // Row 1: User selects department "Store" first
    rows = handleDepartmentChange(rows, 1, 'Store');

    // Row 2: User selects staff Amit Patel (HR)
    rows = handleSelectStaffMember(rows, 2, 'Amit Patel (GJ092311)').rows;

    // Verify row 0
    assert.strictEqual(rows[0].staffEmployee, 'Joy Dastidar (ST080014)');
    assert.strictEqual(rows[0].department, 'IT');

    // Verify row 1
    assert.strictEqual(rows[1].staffEmployee, '');
    assert.strictEqual(rows[1].department, 'Store');

    // Verify row 2
    assert.strictEqual(rows[2].staffEmployee, 'Amit Patel (GJ092311)');
    assert.strictEqual(rows[2].department, 'HR');
  });
});
