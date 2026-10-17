import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRow as createClientEmptyRow } from './pdcaStore.js';
import { createEmptyRow as createServerEmptyRow } from '../../../../../server/models/pdca/pdca.model.js';
import { PDCA_UNITS, PDCA_DEPARTMENTS } from './pdcaConstants.js';

test('1. PDCA Form - Four New Columns Schema & Default Values', () => {
  const clientRow = createClientEmptyRow();
  const serverRow = createServerEmptyRow();

  // 1. Section P Unit
  assert.equal(clientRow.unit, '', 'Client row default unit should be empty string');
  assert.equal(serverRow.unit, '', 'Server row default unit should be empty string');
  assert.ok(PDCA_UNITS.includes('Bawal'), 'PDCA_UNITS contains Bawal');
  assert.ok(PDCA_UNITS.includes('Gujrat'), 'PDCA_UNITS contains Gujrat');

  // Existing Department remains intact
  assert.equal(clientRow.department, '', 'Client department should remain intact');
  assert.equal(serverRow.department, '', 'Server department should remain intact');
  assert.equal(PDCA_DEPARTMENTS.length, 13, 'PDCA_DEPARTMENTS should still contain all 13 departments');

  // 2. Std. Duration in min
  assert.equal(clientRow.stdDurationMin, '', 'Client row default stdDurationMin should be empty string');
  assert.equal(serverRow.stdDurationMin, '', 'Server row default stdDurationMin should be empty string');

  // 3. No. of time Revised
  assert.equal(clientRow.noOfTimeRevised, 0, 'Client row default noOfTimeRevised should be 0');
  assert.equal(serverRow.noOfTimeRevised, 0, 'Server row default noOfTimeRevised should be 0');

  // 4. Section C Unit (Responsible Person Confirmation Unit)
  assert.equal(clientRow.respUnit, '', 'Client row default respUnit should be empty string');
  assert.equal(clientRow.responsiblePersonUnit, '', 'Client row default responsiblePersonUnit should be empty string');
  assert.equal(serverRow.respUnit, '', 'Server row default respUnit should be empty string');
  assert.equal(serverRow.responsiblePersonUnit, '', 'Server row default responsiblePersonUnit should be empty string');

  // Both department columns intact
  assert.ok('department' in clientRow, 'Section P Department exists');
  assert.ok('responsiblePersonDept' in clientRow, 'Section C Department exists');
});

test('2. PDCA Form - Column Ordering and Relative Placement Matrix', () => {
  // Define expected sequential column order as specified in user requirements
  const expectedColumnSequence = [
    'date',
    'shift',
    'sno',
    'status',
    'unit',                // 1. Unit -> immediately before Department
    'department',          // Existing Department column
    'section',
    'lineArea',
    'observation',
    'imageBefore',
    'rootCause',
    'counterMeasure',
    'imageAfter',
    'stdDurationMin',      // 2. Std. Duration in min -> immediately after Image After
    'responseDate',        // Existing Response date column
    'noOfTimeRevised',     // 3. No. of time Revised -> immediately after Response date
    'respUnit',            // 4. Unit -> immediately before Section C Dept
    'responsiblePersonDept', // Existing Section C Dept column
    'staffEmployee',
    'cftTopic',
    'remarks'
  ];

  // Verify Unit is immediately before Department in Section P
  const unitIdx = expectedColumnSequence.indexOf('unit');
  const deptIdx = expectedColumnSequence.indexOf('department');
  assert.equal(unitIdx + 1, deptIdx, 'Unit must be immediately before Department in Section P');

  // Verify Std. Duration in min is immediately after Image After
  const imgAfterIdx = expectedColumnSequence.indexOf('imageAfter');
  const stdDurIdx = expectedColumnSequence.indexOf('stdDurationMin');
  assert.equal(imgAfterIdx + 1, stdDurIdx, 'Std. Duration in min must be immediately after Image After');

  // Verify No. of time Revised is immediately after Response date
  const respDateIdx = expectedColumnSequence.indexOf('responseDate');
  const revisedIdx = expectedColumnSequence.indexOf('noOfTimeRevised');
  assert.equal(respDateIdx + 1, revisedIdx, 'No. of time Revised must be immediately after Response date');

  // Verify Unit is immediately before Dept in Section C (Responsible Person Confirmation)
  const respUnitIdx = expectedColumnSequence.indexOf('respUnit');
  const respDeptIdx = expectedColumnSequence.indexOf('responsiblePersonDept');
  assert.equal(respUnitIdx + 1, respDeptIdx, 'Unit must be immediately before Dept in Section C');
});

test('3. PDCA Form - Input Validation for Non-Negative Values', () => {
  // Simulation of input validation logic used in PDCASheet.jsx
  const validateStdDuration = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    const num = parseFloat(raw);
    if (isNaN(num) || num < 0) return null; // Invalid
    return raw;
  };

  const validateNoOfTimeRevised = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return '';
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 0) return null; // Invalid
    return num;
  };

  // Valid stdDurationMin
  assert.equal(validateStdDuration('30'), '30');
  assert.equal(validateStdDuration('45.5'), '45.5');
  assert.equal(validateStdDuration('0'), '0');
  assert.equal(validateStdDuration(''), '');

  // Invalid stdDurationMin (negative numbers & non-numbers)
  assert.equal(validateStdDuration('-10'), null);
  assert.equal(validateStdDuration('-0.5'), null);
  assert.equal(validateStdDuration('abc'), null);

  // Valid noOfTimeRevised
  assert.equal(validateNoOfTimeRevised('0'), 0);
  assert.equal(validateNoOfTimeRevised('1'), 1);
  assert.equal(validateNoOfTimeRevised('5'), 5);
  assert.equal(validateNoOfTimeRevised(''), '');

  // Invalid noOfTimeRevised (negative numbers)
  assert.equal(validateNoOfTimeRevised('-1'), null);
  assert.equal(validateNoOfTimeRevised('-5'), null);
  assert.equal(validateNoOfTimeRevised('xyz'), null);
});

test('4. PDCA Form - Round-trip Data Serialization & Backward Compatibility', () => {
  // Historical record without the 4 new columns
  const legacyRecord = {
    date: '2026-10-15',
    shift: 'A',
    status: 'Open',
    department: 'Assembly',
    lineArea: 'Line 1',
    observation: 'Oil leak observed near motor',
    imageBefore: 'https://example.com/before.jpg',
    rootCause: 'Worn gasket',
    counterMeasure: 'Replaced gasket',
    imageAfter: 'https://example.com/after.jpg',
    responseDate: '2026-10-16',
    responsiblePersonDept: 'Assembly',
    staffEmployee: 'John Doe (E101)',
    remarks: 'Monitoring daily'
  };

  // Upgraded record via createClientEmptyRow with customDefaults
  const hydratedRecord = createClientEmptyRow(legacyRecord);

  // Assert legacy fields intact
  assert.equal(hydratedRecord.department, 'Assembly');
  assert.equal(hydratedRecord.imageAfter, 'https://example.com/after.jpg');
  assert.equal(hydratedRecord.responseDate, '2026-10-16');
  assert.equal(hydratedRecord.responsiblePersonDept, 'Assembly');

  // Assert safe defaults for new columns
  assert.equal(hydratedRecord.unit, '');
  assert.equal(hydratedRecord.stdDurationMin, '');
  assert.equal(hydratedRecord.noOfTimeRevised, 0);
  assert.equal(hydratedRecord.respUnit, '');

  // Simulate updating the new columns
  hydratedRecord.unit = 'Bawal';
  hydratedRecord.stdDurationMin = 45;
  hydratedRecord.noOfTimeRevised = 2;
  hydratedRecord.respUnit = 'Bawal';

  // Serialize to JSON and parse back
  const serialized = JSON.stringify(hydratedRecord);
  const reloaded = JSON.parse(serialized);

  // Assert all new columns persist perfectly
  assert.equal(reloaded.unit, 'Bawal');
  assert.equal(reloaded.stdDurationMin, 45);
  assert.equal(reloaded.noOfTimeRevised, 2);
  assert.equal(reloaded.respUnit, 'Bawal');

  // Assert existing columns unchanged
  assert.equal(reloaded.department, 'Assembly');
  assert.equal(reloaded.imageAfter, 'https://example.com/after.jpg');
  assert.equal(reloaded.responseDate, '2026-10-16');
  assert.equal(reloaded.responsiblePersonDept, 'Assembly');
});
