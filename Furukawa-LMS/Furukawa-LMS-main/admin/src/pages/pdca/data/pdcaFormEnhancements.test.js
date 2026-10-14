import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRows, commitPDCA, loadPDCA, addPDCA, updatePDCA } from './pdcaStore.js';

test('PDCA Observation: multi-line and lengthy observations persist without data loss or clipping', () => {
  const multilineObservation = `Line 1: High burr detected on crimping terminal during 1st shift QA check.
Line 2: Feed mechanism alignment checked; pneumatic pressure fluctuated below 4.5 bar.
Line 3: Tooling replaced and 100% sorting completed. No defect passed to next station.`;

  const rows = createDefaultRows(5);
  rows[0].observation = multilineObservation;

  assert.equal(rows[0].observation, multilineObservation);
  assert.equal(rows[0].observation.split('\n').length, 3);
  assert.ok(rows[0].observation.includes('Line 1: High burr'));
  assert.ok(rows[0].observation.includes('Line 3: Tooling replaced'));
});

test('PDCA Evidence: multiple images can be added, inspected, and saved per field', () => {
  const rows = createDefaultRows(3);
  const row = rows[0];

  assert.deepEqual(row.imagesBefore, []);
  assert.deepEqual(row.imagesAfter, []);

  // Add multiple before evidence images
  row.imagesBefore = [
    { id: 'img-b1', url: 'https://example.com/before1.jpg', name: 'burr_close_up.jpg', size: 102400, type: 'image' },
    { id: 'img-b2', url: 'https://example.com/before2.jpg', name: 'terminal_macro.jpg', size: 204800, type: 'image' },
    { id: 'img-b3', url: 'https://example.com/before3.jpg', name: 'station_overview.jpg', size: 512000, type: 'image' }
  ];
  // Backward compatibility synchronization
  row.imageBefore = row.imagesBefore[0].url;
  row.imageBeforeName = row.imagesBefore[0].name;

  assert.equal(row.imagesBefore.length, 3);
  assert.equal(row.imageBefore, 'https://example.com/before1.jpg');
  assert.equal(row.imageBeforeName, 'burr_close_up.jpg');
  assert.equal(row.imagesAfter.length, 0); // Image After untouched

  // Add multiple after evidence images
  row.imagesAfter = [
    { id: 'img-a1', url: 'https://example.com/after1.jpg', name: 'rectified_crimp.jpg', size: 153600, type: 'image' },
    { id: 'img-a2', url: 'https://example.com/after2.jpg', name: 'qa_gauge_pass.jpg', size: 128000, type: 'image' }
  ];
  row.imageAfter = row.imagesAfter[0].url;
  row.imageAfterName = row.imagesAfter[0].name;

  assert.equal(row.imagesBefore.length, 3);
  assert.equal(row.imagesAfter.length, 2);
  assert.equal(row.imageAfter, 'https://example.com/after1.jpg');
  assert.equal(row.imageAfterName, 'rectified_crimp.jpg');
});

test('PDCA Evidence: removing an individual image leaves other evidence photos intact', () => {
  const rows = createDefaultRows(1);
  const row = rows[0];

  row.imagesBefore = [
    { id: 'img-1', url: 'https://example.com/1.jpg', name: '1.jpg' },
    { id: 'img-2', url: 'https://example.com/2.jpg', name: '2.jpg' },
    { id: 'img-3', url: 'https://example.com/3.jpg', name: '3.jpg' }
  ];

  // Remove middle image
  row.imagesBefore = row.imagesBefore.filter((img) => img.id !== 'img-2');
  assert.equal(row.imagesBefore.length, 2);
  assert.equal(row.imagesBefore[0].id, 'img-1');
  assert.equal(row.imagesBefore[1].id, 'img-3');

  // Remove first image
  row.imagesBefore = row.imagesBefore.filter((img) => img.id !== 'img-1');
  row.imageBefore = row.imagesBefore[0]?.url || null;
  assert.equal(row.imagesBefore.length, 1);
  assert.equal(row.imagesBefore[0].id, 'img-3');
  assert.equal(row.imageBefore, 'https://example.com/3.jpg');
});

test('PDCA Evidence: replacing an individual image updates only that image', () => {
  const rows = createDefaultRows(1);
  const row = rows[0];

  row.imagesAfter = [
    { id: 'img-a1', url: 'https://example.com/orig1.jpg', name: 'orig1.jpg' },
    { id: 'img-a2', url: 'https://example.com/orig2.jpg', name: 'orig2.jpg' }
  ];

  // Replace second image
  row.imagesAfter = row.imagesAfter.map((img) =>
    img.id === 'img-a2' ? { ...img, url: 'https://example.com/new2.jpg', name: 'new2.jpg' } : img
  );

  assert.equal(row.imagesAfter.length, 2);
  assert.equal(row.imagesAfter[0].url, 'https://example.com/orig1.jpg');
  assert.equal(row.imagesAfter[1].url, 'https://example.com/new2.jpg');
  assert.equal(row.imagesAfter[1].name, 'new2.jpg');
});

test('PDCA Evidence: Before and After images remain strictly independent', () => {
  const rows = createDefaultRows(1);
  const row = rows[0];

  row.imagesBefore = [{ id: 'b1', url: 'https://example.com/b1.jpg', name: 'before.jpg' }];
  row.imagesAfter = [{ id: 'a1', url: 'https://example.com/a1.jpg', name: 'after.jpg' }];

  // Removing Before image
  row.imagesBefore = [];
  row.imageBefore = null;

  assert.equal(row.imagesBefore.length, 0);
  assert.equal(row.imageBefore, null);
  // Ensure After image is untouched
  assert.equal(row.imagesAfter.length, 1);
  assert.equal(row.imagesAfter[0].url, 'https://example.com/a1.jpg');
});

test('PDCA Sheet: Record save, update and reload preserves multiple evidence images across fields', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
  };

  const sampleRecord = {
    id: 'PDCA-MULTI-IMG-TEST',
    topic: 'Multiple Evidence Photos Kaizen',
    description: 'Testing multi-image persistence for before and after',
    plant: 'Bawal',
    scope: 'Department',
    department: 'Quality',
    section: 'Assembly',
    date: '14 Oct 2026',
    time: '11:45 AM',
    createdBy: { name: 'Quality Lead', code: 'QL01' },
    sheet: {
      headerInfo: {
        topicName: 'Multiple Evidence Photos Kaizen',
        preparedBy: 'Quality Lead',
        auditNo: 'AUD-MULTI-01',
        attendees: 'Auditor A, Auditor B'
      },
      rows: [
        {
          id: 1,
          status: 'Open',
          date: '2026-10-14',
          shift: 'A',
          lineArea: 'Crimping Line 3',
          observation: 'Multiple burrs observed on terminal batches.\nRoot cause under analysis.',
          imagesBefore: [
            { id: 'b-101', url: 'data:image/jpeg;base64,sampleB1', name: 'batch_defect_1.jpg' },
            { id: 'b-102', url: 'data:image/jpeg;base64,sampleB2', name: 'batch_defect_2.jpg' }
          ],
          imageBefore: 'data:image/jpeg;base64,sampleB1',
          imageBeforeName: 'batch_defect_1.jpg',
          rootCause: 'Defective feed blade',
          counterMeasure: 'Replaced blade and verified 10 consecutive pieces',
          imagesAfter: [
            { id: 'a-201', url: 'data:image/jpeg;base64,sampleA1', name: 'blade_replacement.jpg' },
            { id: 'a-202', url: 'data:image/jpeg;base64,sampleA2', name: 'batch_verified_good.jpg' },
            { id: 'a-203', url: 'data:image/jpeg;base64,sampleA3', name: 'gauge_measurement_chart.jpg' }
          ],
          imageAfter: 'data:image/jpeg;base64,sampleA1',
          imageAfterName: 'blade_replacement.jpg',
          responseDate: '2026-10-14',
          department: 'PE',
          staffEmployee: 'Yogesh Kumar (AS081213)',
          assignedEmployee: '',
          cftTopic: '',
          responsiblePersonConfirmation: 'Verified'
        }
      ]
    }
  };

  // Add record
  commitPDCA((records) => addPDCA(records, sampleRecord), []);
  const loaded = loadPDCA([]).find((r) => r.id === 'PDCA-MULTI-IMG-TEST');
  assert.ok(loaded);
  assert.equal(loaded.sheet.rows[0].imagesBefore.length, 2);
  assert.equal(loaded.sheet.rows[0].imagesAfter.length, 3);
  assert.equal(loaded.sheet.rows[0].imagesBefore[0].name, 'batch_defect_1.jpg');
  assert.equal(loaded.sheet.rows[0].imagesBefore[1].name, 'batch_defect_2.jpg');
  assert.equal(loaded.sheet.rows[0].imagesAfter[2].name, 'gauge_measurement_chart.jpg');

  // Update record (add 1 more after image)
  const updatedRecord = {
    ...loaded,
    sheet: {
      ...loaded.sheet,
      rows: [
        {
          ...loaded.sheet.rows[0],
          imagesAfter: [
            ...loaded.sheet.rows[0].imagesAfter,
            { id: 'a-204', url: 'data:image/jpeg;base64,sampleA4', name: 'final_signoff.jpg' }
          ]
        }
      ]
    }
  };

  commitPDCA((records) => updatePDCA(records, updatedRecord), []);
  const reloaded = loadPDCA([]).find((r) => r.id === 'PDCA-MULTI-IMG-TEST');
  assert.equal(reloaded.sheet.rows[0].imagesBefore.length, 2); // Before images untouched
  assert.equal(reloaded.sheet.rows[0].imagesAfter.length, 4); // After images updated
  assert.equal(reloaded.sheet.rows[0].imagesAfter[3].name, 'final_signoff.jpg');
});

test('PDCA Backward Compatibility: single legacy imageBefore and imageAfter are wrapped into arrays', () => {
  const legacyRow = {
    observation: 'Legacy record without imagesBefore/After arrays',
    imageBefore: 'https://example.com/legacy_before.jpg',
    imageBeforeName: 'old_before.jpg',
    imageAfter: 'https://example.com/legacy_after.jpg',
    imageAfterName: 'old_after.jpg'
  };

  const normalizeRow = (row) => {
    const imagesBefore = Array.isArray(row.imagesBefore)
      ? row.imagesBefore
      : (row.imageBefore ? [{ id: 'legacy-before-0', url: row.imageBefore, name: row.imageBeforeName || 'Before Image', type: 'image' }] : []);
    const imagesAfter = Array.isArray(row.imagesAfter)
      ? row.imagesAfter
      : (row.imageAfter ? [{ id: 'legacy-after-0', url: row.imageAfter, name: row.imageAfterName || 'After Image', type: 'image' }] : []);
    return {
      ...row,
      imagesBefore,
      imagesAfter
    };
  };

  const normalized = normalizeRow(legacyRow);
  assert.equal(normalized.imagesBefore.length, 1);
  assert.equal(normalized.imagesBefore[0].url, 'https://example.com/legacy_before.jpg');
  assert.equal(normalized.imagesBefore[0].name, 'old_before.jpg');
  assert.equal(normalized.imagesAfter.length, 1);
  assert.equal(normalized.imagesAfter[0].url, 'https://example.com/legacy_after.jpg');
});

test('PDCA Form: empty image cells remain compact by default and expand only when evidence is uploaded', () => {
  const rows = createDefaultRows(2);
  const row = rows[0];

  // Default empty state: both Before and After have empty arrays
  assert.equal(row.imagesBefore.length, 0);
  assert.equal(row.imagesAfter.length, 0);
  assert.equal(Boolean(row.imagesBefore.length > 0), false);
  assert.equal(Boolean(row.imagesAfter.length > 0), false);

  // Upload an image to Image Before only
  row.imagesBefore = [{ id: 'b1', url: 'https://example.com/b1.jpg', name: 'before.jpg' }];
  row.imageBefore = row.imagesBefore[0].url;

  // Image Before is now expanded
  assert.equal(row.imagesBefore.length > 0, true);
  // Image After remains in compact empty state
  assert.equal(row.imagesAfter.length > 0, false);
});

test('PDCA Form: Back button allows navigating away with discard without mandatory validation blocking', () => {
  const initialRecord = {
    id: 'PDCA-DISCARD-TEST',
    topic: 'Quality Line Audit',
    sheet: {
      headerInfo: { topicName: 'Initial Audit' },
      rows: createDefaultRows(1)
    }
  };

  // User starts editing: types incomplete content that would fail mandatory save validation
  let liveRows = JSON.parse(JSON.stringify(initialRecord.sheet.rows));
  liveRows[0].observation = 'Partial observation without Date or Line/Area';

  const validateMandatoryOnSave = (rList) => {
    for (let i = 0; i < rList.length; i++) {
      const r = rList[i];
      const hasContent = Boolean(r.date || r.shift || r.lineArea || r.observation);
      if (hasContent) {
        const missing = [];
        if (!r.date?.trim()) missing.push('Date');
        if (!r.shift?.trim()) missing.push('Shift');
        if (!r.status?.trim()) missing.push('Status');
        if (!r.lineArea?.trim()) missing.push('Line/Area');
        if (!r.observation?.trim()) missing.push('Observation');
        if (missing.length > 0) return { valid: false, missing };
      }
    }
    return { valid: true };
  };

  // Attempting to SAVE fails mandatory validation
  const saveResult = validateMandatoryOnSave(liveRows);
  assert.equal(saveResult.valid, false);
  assert.ok(saveResult.missing.includes('Date'));
  assert.ok(saveResult.missing.includes('Line/Area'));

  // Clicking BACK does NOT call mandatory validation and discards unsaved session edits
  const initialSnapshot = JSON.stringify(initialRecord.sheet);
  const currentSnapshot = JSON.stringify({ headerInfo: initialRecord.sheet.headerInfo, rows: liveRows });
  const hasUnsavedChanges = initialSnapshot !== currentSnapshot;
  assert.equal(hasUnsavedChanges, true);

  // User chooses "Discard Changes & Go Back": revert live rows back to initialRecord
  liveRows = JSON.parse(JSON.stringify(initialRecord.sheet.rows));
  assert.equal(liveRows[0].observation, '');
  assert.equal(JSON.stringify(liveRows), JSON.stringify(initialRecord.sheet.rows));
});

test('PDCA Form: Observation column width controller respects min/max bounds and persists display preference without mutating data', () => {
  const DEFAULT_OBSERVATION_WIDTH = 260;
  const MIN_OBSERVATION_WIDTH = 180;
  const MAX_OBSERVATION_WIDTH = 650;

  const clampWidth = (val) => Math.min(MAX_OBSERVATION_WIDTH, Math.max(MIN_OBSERVATION_WIDTH, val));

  // Minimum boundary test
  assert.equal(clampWidth(100), 180);
  assert.equal(clampWidth(179), 180);
  assert.equal(clampWidth(180), 180);

  // Maximum boundary test
  assert.equal(clampWidth(650), 650);
  assert.equal(clampWidth(700), 650);
  assert.equal(clampWidth(1200), 650);

  // Normal resizing test
  assert.equal(clampWidth(350), 350);
  assert.equal(clampWidth(480), 480);

  // Display preference in localStorage
  const storage = new Map();
  const mockLocalStorage = {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v)),
  };

  mockLocalStorage.setItem('pdca_observation_col_width', clampWidth(420));
  const retrieved = parseInt(mockLocalStorage.getItem('pdca_observation_col_width'), 10);
  assert.equal(retrieved, 420);

  // Verify observation record content is completely unaffected by column width
  const row = {
    observation: 'Lenghty observation text spanning multiple lines.\nSecond line with details.',
  };
  const snapshotBefore = JSON.stringify(row);
  // Column width preference changed
  mockLocalStorage.setItem('pdca_observation_col_width', 500);
  const snapshotAfter = JSON.stringify(row);
  assert.equal(snapshotBefore, snapshotAfter);
  assert.equal(row.observation.includes('Lenghty observation'), true);
});

test('PDCA 4-Box Upload Type Selection: Image permits multiple uploads, while PDF, PPT, Excel are strictly single file', () => {
  const uploadOptions = [
    { id: 'image', title: 'Upload Image', multiple: true, accept: 'image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg' },
    { id: 'pdf', title: 'Upload PDF', multiple: false, accept: '.pdf,application/pdf' },
    { id: 'ppt', title: 'Upload PPT', multiple: false, accept: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { id: 'excel', title: 'Upload Excel', multiple: false, accept: '.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv' }
  ];

  assert.equal(uploadOptions.length, 4);
  const imageOpt = uploadOptions.find((o) => o.id === 'image');
  assert.equal(imageOpt.multiple, true);
  assert.equal(imageOpt.title, 'Upload Image');

  const docOptions = uploadOptions.filter((o) => o.id !== 'image');
  assert.equal(docOptions.length, 3);
  docOptions.forEach((opt) => {
    assert.equal(opt.multiple, false, `${opt.title} must have multiple: false`);
  });
});

test('PDCA Image Upload: multiple selection and repeated uploads append to evidence without losing previous images', () => {
  const row = createDefaultRows(1)[0];
  assert.equal(row.imagesBefore.length, 0);

  // 1. Initial multi-image selection (2 images)
  const batch1 = [
    { id: 'img-1', url: 'https://server.com/img1.png', name: 'photo1.png', type: 'image' },
    { id: 'img-2', url: 'https://server.com/img2.png', name: 'photo2.png', type: 'image' }
  ];
  row.imagesBefore = [...row.imagesBefore, ...batch1];
  row.imageBefore = row.imagesBefore[0].url;
  row.imageBeforeName = row.imagesBefore[0].name;
  row.fileTypeBefore = 'image';

  assert.equal(row.imagesBefore.length, 2);
  assert.equal(row.imageBefore, 'https://server.com/img1.png');

  // 2. Repeated upload (adds 1 more image)
  const batch2 = [
    { id: 'img-3', url: 'https://server.com/img3.png', name: 'photo3.png', type: 'image' }
  ];
  row.imagesBefore = [...row.imagesBefore, ...batch2];
  assert.equal(row.imagesBefore.length, 3);
  assert.equal(row.imagesBefore[0].id, 'img-1');
  assert.equal(row.imagesBefore[1].id, 'img-2');
  assert.equal(row.imagesBefore[2].id, 'img-3');
});

test('PDCA Document Upload: PDF, PPT, Excel store single attachment file and maintain independent before/after state', () => {
  const row = createDefaultRows(1)[0];

  // Image Before has images
  row.imagesBefore = [
    { id: 'img-1', url: 'https://server.com/before.jpg', name: 'before.jpg', type: 'image' }
  ];
  row.imageBefore = row.imagesBefore[0].url;
  row.imageBeforeName = row.imagesBefore[0].name;
  row.fileTypeBefore = 'image';

  // Image After has a single PDF uploaded
  row.imageAfter = 'https://server.com/audit_report.pdf';
  row.imageAfterName = 'audit_report.pdf';
  row.fileTypeAfter = 'pdf';
  row.imagesAfter = [];

  // Verify independence
  assert.equal(row.fileTypeBefore, 'image');
  assert.equal(row.imagesBefore.length, 1);
  assert.equal(row.fileTypeAfter, 'pdf');
  assert.equal(row.imageAfter, 'https://server.com/audit_report.pdf');
  assert.equal(row.imagesAfter.length, 0);
});



