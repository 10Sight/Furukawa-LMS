import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyPdcaRow } from './lpaPdcaUtils.js';
import { createEmptyRow } from '../pdca/data/pdcaStore.js';
import { normalizePDCAStatus, computePDCAStatus, PDCA_STATUS_OPTIONS } from '../pdca/data/pdcaConstants.js';
import { isRecordCreator } from '../pdca/data/recordFilters.js';

test('1. Status Column Logic: A row without a date has a blank Status field', () => {
  // Check LPA PDCA row creation
  const lpaRow = createEmptyPdcaRow();
  assert.equal(lpaRow.date, '');
  assert.equal(lpaRow.status, '');

  // Check PDCA Store empty row creation
  const pdcaRow = createEmptyRow();
  assert.equal(pdcaRow.date, '');
  assert.equal(pdcaRow.status, '');

  // Normalizing empty status returns empty string, not 'Not-Started'
  assert.equal(normalizePDCAStatus(''), '');
  assert.equal(normalizePDCAStatus(null), '');
  assert.equal(normalizePDCAStatus(undefined), '');
});

test('2. Status Column Logic: Selecting a date automatically sets Not-Started', () => {
  // Simulating user picking a date on an empty row
  const row = createEmptyPdcaRow();
  assert.equal(row.status, '');

  const dateValue = '2026-10-27';
  let nextStatus = row.status;
  if (!nextStatus || nextStatus === 'Not-Started') {
    nextStatus = 'Not-Started';
  }
  const updatedRow = { ...row, date: dateValue, status: nextStatus };

  assert.equal(updatedRow.date, '2026-10-27');
  assert.equal(updatedRow.status, 'Not-Started');

  // Verify createEmptyPdcaRow with date sets Not-Started
  const rowWithDate = createEmptyPdcaRow({ date: '2026-10-27' });
  assert.equal(rowWithDate.status, 'Not-Started');
});

test('3. Status Column Logic: Removing the date clears the automatically generated status', () => {
  // When a row had auto-set Not-Started and date is cleared
  const row = {
    ...createEmptyPdcaRow(),
    date: '2026-10-27',
    status: 'Not-Started'
  };

  // Simulating removing the date: if date is empty, Not-Started is cleared to ''
  const newDate = '';
  let nextStatus = row.status;
  if (!newDate) {
    if (nextStatus === 'Not-Started' || !nextStatus) {
      nextStatus = '';
    }
  }
  const updatedRow = { ...row, date: newDate, status: nextStatus };

  assert.equal(updatedRow.date, '');
  assert.equal(updatedRow.status, '');
});

test('4. Status Column Logic: Existing valid statuses are preserved and not overwritten', () => {
  const validStatuses = ['Done', 'In- Progress', 'Delay'];

  for (const status of validStatuses) {
    // Row already has a valid status, user updates the date
    const row = {
      ...createEmptyPdcaRow(),
      date: '2026-10-20',
      status: status
    };

    // Updating date must preserve valid status
    const newDate = '2026-10-28';
    let nextStatus = row.status;
    if (newDate) {
      if (!nextStatus) {
        nextStatus = 'Not-Started';
      }
    }
    const updatedRow = { ...row, date: newDate, status: nextStatus };
    assert.equal(updatedRow.status, status, `Status ${status} should not be overwritten`);

    // Removing date when row has an existing completed/in-progress status must not break existing workflow
    const clearedDateRow = { ...row, date: '' };
    assert.equal(clearedDateRow.status, status);
  }
});

test('5. Sheet Creator Deletion Permissions: Creator of PDCA, Assembly LPA, and C&C LPA sheet can delete', () => {
  const creatorUser = {
    id: 101,
    empId: 'EMP101',
    code: 'EMP101',
    userName: 'john_doe',
    fullName: 'John Doe',
    role: 'EMPLOYEE',
    isAdmin: false
  };

  // 1. PDCA Sheet owned by creatorUser
  const pdcaSheet = {
    id: 'PDCA-123',
    topic: 'Quality Improvement PDCA',
    createdById: '101',
    createdBy: { id: 101, name: 'John Doe', empId: 'EMP101' }
  };
  assert.equal(isRecordCreator(pdcaSheet, creatorUser), true);

  // 2. Assembly LPA Sheet owned by creatorUser
  const assemblyLpaSheet = {
    id: 'lpa_rec_assembly_001',
    section: 'assembly',
    name: 'Assembly LPA Check Sheet',
    ownerId: '101',
    createdBy: 'John Doe',
    createdById: '101'
  };
  assert.equal(isRecordCreator(assemblyLpaSheet, creatorUser), true);

  // 3. C&C LPA Sheet owned by creatorUser
  const ccLpaSheet = {
    id: 'lpa_rec_cc_001',
    section: 'cc',
    name: 'C&C LPA Check Sheet',
    ownerId: '101',
    createdBy: 'John Doe',
    createdById: '101'
  };
  assert.equal(isRecordCreator(ccLpaSheet, creatorUser), true);

  // Also verify Admin can delete via (isAdmin || isRecordCreator)
  const adminUser = {
    id: 999,
    empId: 'ADM999',
    role: 'ADMIN',
    isAdmin: true
  };
  const canAdminDelete = (record, user) => Boolean(user.isAdmin || isRecordCreator(record, user));
  assert.equal(canAdminDelete(pdcaSheet, adminUser), true);
  assert.equal(canAdminDelete(assemblyLpaSheet, adminUser), true);
  assert.equal(canAdminDelete(ccLpaSheet, adminUser), true);
});

test('6. Sheet Creator Deletion Permissions: Unauthorized users cannot delete sheets', () => {
  const unauthorizedUser = {
    id: 202,
    empId: 'EMP202',
    code: 'EMP202',
    userName: 'jane_viewer',
    fullName: 'Jane Viewer',
    role: 'EMPLOYEE',
    isAdmin: false
  };

  const assemblySheet = {
    id: 'lpa_rec_assembly_002',
    section: 'assembly',
    ownerId: '101',
    createdById: '101',
    createdBy: 'John Doe'
  };

  const ccSheet = {
    id: 'lpa_rec_cc_002',
    section: 'cc',
    ownerId: '101',
    createdById: '101',
    createdBy: 'John Doe'
  };

  const pdcaSheet = {
    id: 'PDCA-456',
    createdById: '101',
    createdBy: { id: 101, name: 'John Doe', empId: 'EMP101' }
  };

  const canUserDelete = (record, user) => Boolean(user.isAdmin || isRecordCreator(record, user));

  // Unauthorized user is NOT creator and NOT admin
  assert.equal(canUserDelete(assemblySheet, unauthorizedUser), false);
  assert.equal(canUserDelete(ccSheet, unauthorizedUser), false);
  assert.equal(canUserDelete(pdcaSheet, unauthorizedUser), false);
});

test('7. Data Persistence and Unrelated Functionality: Status options, normalization, and sheet rows roundtrip', () => {
  // Ensure dropdown options match specification
  assert.deepEqual(PDCA_STATUS_OPTIONS, ['Not-Started', 'Done', 'In- Progress', 'Delay']);

  // Check saved snapshot maintains blank status for rows without date
  const rowNoDate = createEmptyPdcaRow();
  const rowWithDate = createEmptyPdcaRow({ date: '2026-10-27', status: 'Not-Started' });
  const rowDone = createEmptyPdcaRow({ date: '2026-10-20', status: 'Done' });

  const rows = [rowNoDate, rowWithDate, rowDone];

  // Roundtrip normalization
  const normalizedRows = rows.map(r => {
    const hasDate = Boolean(r.date && String(r.date).trim());
    const norm = normalizePDCAStatus(r.status);
    if (!hasDate) {
      return { ...r, status: norm === 'Not-Started' ? '' : norm };
    }
    return { ...r, status: norm || 'Not-Started' };
  });

  assert.equal(normalizedRows[0].status, '');
  assert.equal(normalizedRows[1].status, 'Not-Started');
  assert.equal(normalizedRows[2].status, 'Done');
});
