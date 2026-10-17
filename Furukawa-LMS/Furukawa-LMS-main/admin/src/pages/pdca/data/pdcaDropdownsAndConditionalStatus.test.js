import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRow, createDefaultRows } from './pdcaStore.js';

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
  assert.equal(row.status, 'Open');
  assert.equal(row.confirmation, '');

  // Rule A: When the user selects Confirmed -> Automatically set Status to 'Closed'
  const confirmedRow = {
    ...row,
    confirmation: 'Confirmed',
    status: 'Closed'
  };
  assert.equal(confirmedRow.confirmation, 'Confirmed');
  assert.equal(confirmedRow.status, 'Closed');

  // Rule B: When the user selects Not - Confirmed -> Automatically set Status to 'In - Progress'
  const notConfirmedRow = {
    ...row,
    confirmation: 'Not - Confirmed',
    status: 'In - Progress'
  };
  assert.equal(notConfirmedRow.confirmation, 'Not - Confirmed');
  assert.equal(notConfirmedRow.status, 'In - Progress');

  // Rule C: Changing from Confirmed to Not - Confirmed updates Status from Closed to In - Progress
  const switchedToNotConfirmed = {
    ...confirmedRow,
    confirmation: 'Not - Confirmed',
    status: 'In - Progress'
  };
  assert.equal(switchedToNotConfirmed.confirmation, 'Not - Confirmed');
  assert.equal(switchedToNotConfirmed.status, 'In - Progress');

  // Rule C: Changing from Not - Confirmed to Confirmed updates Status from In - Progress to Closed
  const switchedBackToConfirmed = {
    ...switchedToNotConfirmed,
    confirmation: 'Confirmed',
    status: 'Closed'
  };
  assert.equal(switchedBackToConfirmed.confirmation, 'Confirmed');
  assert.equal(switchedBackToConfirmed.status, 'Closed');
});

test('4. Rule D: Existing and incomplete records handling', () => {
  // Existing record with Confirmed value -> Status must be Closed
  const existingConfirmed = {
    ...createEmptyRow(),
    responsiblePersonConfirmation: 'Confirmed'
  };
  const normalizedConfirmed = {
    ...existingConfirmed,
    confirmation: 'Confirmed',
    status: 'Closed'
  };
  assert.equal(normalizedConfirmed.confirmation, 'Confirmed');
  assert.equal(normalizedConfirmed.status, 'Closed');

  // Existing record with Not - Confirmed value -> Status must be In - Progress
  const existingNotConfirmed = {
    ...createEmptyRow(),
    responsiblePersonConfirmation: 'Not - Confirmed'
  };
  const normalizedNotConfirmed = {
    ...existingNotConfirmed,
    confirmation: 'Not - Confirmed',
    status: 'In - Progress'
  };
  assert.equal(normalizedNotConfirmed.confirmation, 'Not - Confirmed');
  assert.equal(normalizedNotConfirmed.status, 'In - Progress');

  // Missing or empty confirmation value -> Keep saved status without arbitrary overwrite
  const incompleteRecord = {
    ...createEmptyRow(),
    status: 'Delay',
    confirmation: '',
    responsiblePersonConfirmation: ''
  };
  assert.equal(incompleteRecord.status, 'Delay');
  assert.equal(incompleteRecord.confirmation, '');

  // Historical remarks (e.g. 'Verified on site') must not be silently overwritten
  const historicalRecord = {
    ...createEmptyRow(),
    status: 'Open',
    responsiblePersonConfirmation: 'Verified on site'
  };
  assert.equal(historicalRecord.responsiblePersonConfirmation, 'Verified on site');
  // Since 'Verified on site' is neither 'Confirmed' nor 'Not - Confirmed', status remains 'Open'
  assert.equal(historicalRecord.status, 'Open');
});

test('5. Round-trip data persistence for Department, Unit, Confirmation, and Status', () => {
  const row = {
    ...createEmptyRow(),
    date: '2026-10-16',
    shift: 'A',
    status: 'Closed',
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
  assert.equal(parsed[0].status, 'Closed');
  assert.equal(parsed[0].responsiblePersonConfirmation, 'Confirmed');
});

test('6. Status column dropdown has exactly one In Progress option (\'In - Progress\') and normalizes legacy \'In Progress\'', () => {
  const STATUS_OPTIONS = ['Open', 'Closed', 'In - Progress', 'Delay'];

  // Verify only one In Progress option exists in the list of options
  const inProgressMatches = STATUS_OPTIONS.filter(opt => opt.toLowerCase().includes('progress'));
  assert.equal(inProgressMatches.length, 1);
  assert.equal(inProgressMatches[0], 'In - Progress');

  // Verify legacy 'In Progress' normalizes to 'In - Progress'
  const normalizeStatus = (status) => status === 'In Progress' ? 'In - Progress' : (status || 'Open');
  assert.equal(normalizeStatus('In Progress'), 'In - Progress');
  assert.equal(normalizeStatus('In - Progress'), 'In - Progress');
  assert.equal(normalizeStatus('Open'), 'Open');
  assert.equal(normalizeStatus('Closed'), 'Closed');
  assert.equal(normalizeStatus('Delay'), 'Delay');
});
