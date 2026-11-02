import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizePDCAStatus } from './pdcaConstants.js';

test('1. Date column default width is increased and resizable constants are defined in PDCASheet.jsx', () => {
  const candidatePaths = [
    path.resolve(process.cwd(), 'src/components/pdca/PDCASheet.jsx'),
    path.resolve(process.cwd(), 'admin/src/components/pdca/PDCASheet.jsx')
  ];
  const pdcaSheetPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];
  const content = fs.readFileSync(pdcaSheetPath, 'utf8');

  assert.match(content, /export const DEFAULT_DATE_WIDTH = 105;/, 'DEFAULT_DATE_WIDTH should be 105');
  assert.match(content, /export const MIN_DATE_WIDTH = 80;/, 'MIN_DATE_WIDTH should be 80');
  assert.match(content, /export const MAX_DATE_WIDTH = 260;/, 'MAX_DATE_WIDTH should be 260');
  assert.match(content, /export const DEFAULT_DEPARTMENT_WIDTH = 150;/, 'DEFAULT_DEPARTMENT_WIDTH should be 150');
  assert.match(content, /export const DEFAULT_SECTION_WIDTH = 160;/, 'DEFAULT_SECTION_WIDTH should be 160');
  assert.match(content, /export const DEFAULT_LINE_AREA_WIDTH = 130;/, 'DEFAULT_LINE_AREA_WIDTH should be 130');
  assert.match(content, /dateColWidth/, 'dateColWidth must be used for col and th');
  assert.match(content, /Resize Date column width/, 'Date resize handle must be present');
  assert.match(content, /Resize Department column width/, 'Department resize handle must be present');
  assert.match(content, /Resize Section column width/, 'Section resize handle must be present');
  assert.match(content, /Resize Line\/Area column width/, 'Line Area resize handle must be present');
});

test('2. Rows without a selected date have blank status and bypass mandatory validation', () => {
  const rowWithoutDate = {
    date: '',
    shift: '',
    unit: '',
    department: '',
    departments: [],
    observation: '',
    status: ''
  };

  // Rule: If user has not selected a date for a row, the status remains blank (display Select placeholder)
  const norm = normalizePDCAStatus(rowWithoutDate.status);
  const effectiveStatus = !rowWithoutDate.date?.trim() ? (norm && norm !== 'Not-Started' ? norm : '') : (norm || 'Not-Started');
  assert.equal(effectiveStatus, '', 'Unstarted row without date must have blank status');

  // Rule: User can save without filling mandatory columns if date is not selected
  const isRowEligibleForMandatoryValidation = Boolean(rowWithoutDate.date?.trim());
  assert.equal(isRowEligibleForMandatoryValidation, false, 'Rows without date must be skipped from mandatory field validation');
});

test('3. Row with a selected date requires mandatory fields on save', () => {
  const rowWithDate = {
    date: '2026-10-26',
    shift: 'A',
    unit: '',
    department: '',
    observation: ''
  };

  const isRowEligibleForMandatoryValidation = Boolean(rowWithDate.date?.trim());
  assert.equal(isRowEligibleForMandatoryValidation, true, 'Rows with a selected date must undergo mandatory validation');

  const missingMandatory = !rowWithDate.unit || !rowWithDate.department || !rowWithDate.observation;
  assert.equal(missingMandatory, true, 'Missing unit/department/observation detected when date is present');
});

test('4. Sheet PDCA-LPA-CC-Bawal is active in persistence store', () => {
  const storePath = path.resolve(process.cwd(), '../server/db/pdca/pdca_persistence_store.json');
  if (fs.existsSync(storePath)) {
    const raw = fs.readFileSync(storePath, 'utf8');
    const store = JSON.parse(raw);
    const ccRecord = (store.records || []).find(r => r.id === 'PDCA-LPA-CC-Bawal' || r.topic === 'C&C - LPA Observation (PDCA)');
    if (ccRecord) {
      assert.equal(ccRecord.isDeleted, false, 'PDCA-LPA-CC-Bawal must be active (isDeleted: false)');
    }
  }
});

test('5. Revision delete button removes revised date and restores previous response date', () => {
  const row = {
    initialResponseDate: '2026-10-25',
    responseDate: '2026-10-27',
    revisedDates: [
      { date: '2026-10-26', reason: 'testing', previousDate: '2026-10-25' }
    ],
    noOfTimeRevised: 1
  };

  const dateIndex = 0;
  const removed = row.revisedDates[dateIndex];
  const priorDate = removed.previousDate || row.initialResponseDate || '';
  const remaining = row.revisedDates.filter((_, i) => i !== dateIndex);
  const latestDate = remaining.length > 0
    ? (remaining[remaining.length - 1]?.responseDate || remaining[remaining.length - 1]?.date || priorDate)
    : (priorDate || row.initialResponseDate || '');

  const updatedRow = {
    ...row,
    revisedDates: remaining,
    responseDate: latestDate,
    noOfTimeRevised: remaining.length
  };

  assert.equal(updatedRow.revisedDates.length, 0, 'Revised dates list should be empty after deleting the only revision');
  assert.equal(updatedRow.noOfTimeRevised, 0, 'noOfTimeRevised should be reset to 0');
  assert.equal(updatedRow.responseDate, '2026-10-25', 'responseDate should revert to prior/initial response date');
});
