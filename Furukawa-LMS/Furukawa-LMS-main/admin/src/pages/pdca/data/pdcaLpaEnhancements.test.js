import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LINE_AREAS } from './pdcaConstants.js';
import { isAssemblyRecord, isCcRecord } from '../../lpa/lpaPdcaUtils.js';
import { addPDCA, updatePDCA } from './pdcaStore.js';

test('DEFAULT_LINE_AREAS contains essential line and area selections', () => {
  assert.ok(DEFAULT_LINE_AREAS.length >= 10);
  assert.ok(DEFAULT_LINE_AREAS.includes('Assembly Area'));
  assert.ok(DEFAULT_LINE_AREAS.includes('Assembly Line 1'));
  assert.ok(DEFAULT_LINE_AREAS.includes('C&C Area'));
  assert.ok(DEFAULT_LINE_AREAS.includes('Die Casting Area'));
  assert.ok(DEFAULT_LINE_AREAS.includes('Press Shop'));
});

test('Assembly and C&C records are accurately classified and separated', () => {
  const assemblyRecord1 = {
    id: 'PDCA-1',
    topic: 'Wiring harness clip fitment',
    category: 'assembly',
    department: 'Assembly',
    plant: 'Bawal'
  };

  const assemblyRecord2 = {
    id: 'PDCA-2',
    topic: 'Line 1 Solder defect',
    department: 'Quality',
    section: 'Assembly Line 1',
    plant: 'Gujrat'
  };

  const ccRecord1 = {
    id: 'PDCA-3',
    topic: 'Die-Casting Cycle Time Optimization on Cell #4',
    department: 'Die Casting',
    plant: 'Bawal'
  };

  const ccRecord2 = {
    id: 'PDCA-4',
    topic: 'C&C CNC milling spindle vibration',
    category: 'cc',
    department: 'C&C',
    plant: 'Gujrat'
  };

  assert.equal(isAssemblyRecord(assemblyRecord1), true);
  assert.equal(isCcRecord(assemblyRecord1), false);

  assert.equal(isAssemblyRecord(assemblyRecord2), true);
  assert.equal(isCcRecord(assemblyRecord2), false);

  assert.equal(isCcRecord(ccRecord1), true);
  assert.equal(isAssemblyRecord(ccRecord1), false);

  assert.equal(isCcRecord(ccRecord2), true);
  assert.equal(isAssemblyRecord(ccRecord2), false);
});

test('15 MB Excel file size validation boundary check', () => {
  const MAX_ALLOWED_BYTES = 15 * 1024 * 1024; // 15,728,640 bytes

  const validSmallFile = { size: 2 * 1024 * 1024, name: 'report.xlsx' };
  const validExactLimitFile = { size: 15 * 1024 * 1024, name: 'big_audit.xlsx' };
  const oversizedFile = { size: 15 * 1024 * 1024 + 1, name: 'oversized.xlsx' };
  const hugeFile = { size: 25 * 1024 * 1024, name: 'huge_backup.xlsx' };

  const validateExcelSize = (file) => {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error('The Excel file must be smaller than 15 MB.');
    }
    return true;
  };

  assert.equal(validateExcelSize(validSmallFile), true);
  assert.equal(validateExcelSize(validExactLimitFile), true);
  assert.throws(() => validateExcelSize(oversizedFile), /The Excel file must be smaller than 15 MB/);
  assert.throws(() => validateExcelSize(hugeFile), /The Excel file must be smaller than 15 MB/);
});

test('updatePDCA updates existing record without creating duplicates', () => {
  const initialRecords = [
    { id: 'REC-101', topic: 'Initial Topic', description: 'Initial Desc', lineArea: 'Line 1', department: 'Assembly', plant: 'Bawal', scope: 'Company' },
    { id: 'REC-102', topic: 'Second Topic', description: 'Second Desc', lineArea: 'Line 2', department: 'C&C', plant: 'Gujrat', scope: 'Company' }
  ];

  const updated = updatePDCA(initialRecords, {
    id: 'REC-101',
    topic: 'Updated Topic',
    description: 'Updated Desc',
    lineArea: 'Assembly Area',
    department: 'Assembly',
    scope: 'Company'
  });

  assert.equal(updated.length, 2, 'Total record count must remain 2 (no duplicate)');
  const item = updated.find(r => r.id === 'REC-101');
  assert.equal(item.topic, 'Updated Topic');
  assert.equal(item.description, 'Updated Desc');
  assert.equal(item.lineArea, 'Assembly Area');
});
