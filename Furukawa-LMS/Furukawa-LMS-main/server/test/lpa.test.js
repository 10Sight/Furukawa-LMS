import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { calculateSheetSummary, normalizeObservation } from '../utils/lpa/lpaScoring.js';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'supersecretjwtkeyforfurukawaminda2026!';
const BASE_URL = 'http://127.0.0.1:3000/api/v1/lpa';

const tokenAdmin = jwt.sign({
  id: 14,
  empId: 'ST080014',
  code: 'ST080014',
  userName: 'st080014',
  fullName: 'Joy Dastidar (ST080014)',
  role: 'ADMIN',
  isAdmin: true
}, JWT_SECRET, { expiresIn: '1h' });

const tokenUserA = jwt.sign({
  id: 101,
  empId: 'EMP00101',
  code: 'EMP00101',
  userName: 'employeeA',
  fullName: 'Employee Alpha',
  role: 'EMPLOYEE',
  isAdmin: false
}, JWT_SECRET, { expiresIn: '1h' });

const tokenUserB = jwt.sign({
  id: 102,
  empId: 'EMP00102',
  code: 'EMP00102',
  userName: 'employeeB',
  fullName: 'Employee Beta',
  role: 'EMPLOYEE',
  isAdmin: false
}, JWT_SECRET, { expiresIn: '1h' });

test('LPA Scoring Engine - Authoritative Rules and Formula', () => {
  // Test normalization
  assert.equal(normalizeObservation('O'), 'Ο');
  assert.equal(normalizeObservation('Ο'), 'Ο');
  assert.equal(normalizeObservation('△'), 'Δ');
  assert.equal(normalizeObservation('Δ'), 'Δ');
  assert.equal(normalizeObservation('×'), 'Χ');
  assert.equal(normalizeObservation('Χ'), 'Χ');
  assert.equal(normalizeObservation('X'), 'Χ');
  assert.equal(normalizeObservation('NA'), 'NA');

  // Test sheet calculation
  const mockSheet = {
    name: 'Assembly_L1',
    columnCount: 7,
    rows: [
      [{ value: 'Date: 2026-10-18 | Shift: A' }],
      [{ value: 'FRM-WH-QA-246 Rev 06' }],
      [{ value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' }, { value: 'Area' }, { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }],
      // Item 1: Marks 3, Obs O -> Score 3
      [{ value: 1 }, { value: 'Focus' }, { value: 'Check 1' }, { value: 'Area A' }, { value: 3 }, { value: 'O' }, { value: '' }],
      // Item 2: Marks 3, Obs △ -> Score 2
      [{ value: 2 }, { value: 'Focus' }, { value: 'Check 2' }, { value: 'Area B' }, { value: 3 }, { value: '△' }, { value: '' }],
      // Item 3: Marks 3, Obs × -> Score 0
      [{ value: 3 }, { value: 'Focus' }, { value: 'Check 3' }, { value: 'Area C' }, { value: 3 }, { value: '×' }, { value: '' }],
      // Item 4: Marks 3, Obs NA -> Score NA (excluded from applicable marks)
      [{ value: 4 }, { value: 'Focus' }, { value: 'Check 4' }, { value: 'Area D' }, { value: 3 }, { value: 'NA' }, { value: '' }],
      // Total row
      [{ value: 'Total' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }, { value: '' }]
    ]
  };

  const summary = calculateSheetSummary(mockSheet, 'assembly');
  // Applicable marks should be 3 items * 3 marks = 9 (NA item excluded)
  assert.equal(summary.totalMarks, 9);
  // Total score = 3 + 2 + 0 = 5
  assert.equal(summary.totalScore, 5);
  // Percentage = (5 / 9) * 100 = 55.56%
  assert.equal(summary.percentage, '55.56%');
});

test('LPA REST APIs - Full Integration Flow', async () => {
  // 1. Fetch Form Templates
  const tplRes = await fetch(`${BASE_URL}/templates`);
  assert.equal(tplRes.status, 200);
  const tplData = await tplRes.json();
  assert.ok(Array.isArray(tplData.data));
  const hasAssembly = tplData.data.some(t => t.section === 'assembly');
  const hasCc = tplData.data.some(t => t.section === 'cc');
  assert.ok(hasAssembly, 'Assembly template should be available');
  assert.ok(hasCc, 'C&C template should be available');

  // 2. Fetch Master Dropdowns
  const dropRes = await fetch(`${BASE_URL}/dropdowns`);
  assert.equal(dropRes.status, 200);
  const dropData = await dropRes.json();
  assert.ok(Array.isArray(dropData.data?.departments));
  assert.ok(Array.isArray(dropData.data?.shifts));
  assert.ok(dropData.data.shifts.includes('A'));
  assert.ok(dropData.data.shifts.includes('G'));

  // 3. Mandatory Field Validations
  const invalidPayload = {
    section: 'assembly',
    // Missing date, shift, department
    sheets: []
  };
  const valRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUserA}` },
    body: JSON.stringify(invalidPayload)
  });
  assert.equal(valRes.status, 400);

  // 4. Create LPA Record with Authoritative Score Calculation
  const validPayload = {
    section: 'assembly',
    name: 'Assembly LPA Checklist · Auto Test',
    unit: 'Bawal',
    level: 'L1',
    auditDate: '2026-10-18',
    shift: 'A',
    department: 'Assembly',
    sectionName: 'Main Line',
    line: 'Line-01',
    auditors: ['Joy Dastidar (ST080014)', 'Employee Alpha (EMP00101)'],
    sheets: [
      {
        name: 'Assembly_L1',
        columnCount: 7,
        rows: [
          [{ value: 'Date: 2026-10-18 | Shift: A' }],
          [{ value: 'FRM-WH-QA-246 Rev 06' }],
          [{ value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' }, { value: 'Area' }, { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }],
          [{ value: 1 }, { value: 'Focus' }, { value: 'Check 1' }, { value: 'Area A' }, { value: 3 }, { value: 'O' }, { value: 3 }],
          [{ value: 2 }, { value: 'Focus' }, { value: 'Check 2' }, { value: 'Area B' }, { value: 3 }, { value: '△' }, { value: 2 }],
          [{ value: 3 }, { value: 'Focus' }, { value: 'Check 3' }, { value: 'Area C' }, { value: 3 }, { value: 'NA' }, { value: 'NA' }]
        ]
      }
    ]
  };

  const createRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUserA}` },
    body: JSON.stringify(validPayload)
  });
  assert.equal(createRes.status, 201);
  const createdJson = await createRes.json();
  const recordId = createdJson.data?.id;
  assert.ok(recordId, 'Record ID must be returned');
  assert.equal(createdJson.data.totalMarks, 6); // 2 active items * 3 = 6
  assert.equal(createdJson.data.totalScore, 5); // 3 + 2 = 5
  assert.equal(createdJson.data.scorePercentage, '83.33%');
  assert.equal(createdJson.data.auditors.length, 2);

  // 5. Get Record by ID
  const getRes = await fetch(`${BASE_URL}/records/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserA}` }
  });
  assert.equal(getRes.status, 200);
  const getJson = await getRes.json();
  assert.equal(getJson.data?.id, recordId);
  assert.equal(getJson.data?.shift, 'A');
  assert.equal(getJson.data?.department, 'Assembly');

  // 6. Update Record (Change observation)
  const updatedPayload = {
    ...getJson.data,
    shift: 'B',
    sheets: [
      {
        name: 'Assembly_L1',
        columnCount: 7,
        rows: [
          [{ value: 'Date: 2026-10-18 | Shift: B' }],
          [{ value: 'FRM-WH-QA-246 Rev 06' }],
          [{ value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' }, { value: 'Area' }, { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }],
          // Item 1 changed to '×' (score 0)
          [{ value: 1 }, { value: 'Focus' }, { value: 'Check 1' }, { value: 'Area A' }, { value: 3 }, { value: '×' }, { value: 0 }],
          [{ value: 2 }, { value: 'Focus' }, { value: 'Check 2' }, { value: 'Area B' }, { value: 3 }, { value: '△' }, { value: 2 }],
          [{ value: 3 }, { value: 'Focus' }, { value: 'Check 3' }, { value: 'Area C' }, { value: 3 }, { value: 'NA' }, { value: 'NA' }]
        ]
      }
    ]
  };

  const updateRes = await fetch(`${BASE_URL}/records/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUserA}` },
    body: JSON.stringify(updatedPayload)
  });
  assert.equal(updateRes.status, 200);
  const updateJson = await updateRes.json();
  // Score should now be 0 + 2 = 2 / 6 = 33.33%
  assert.equal(updateJson.data.totalScore, 2);
  assert.equal(updateJson.data.scorePercentage, '33.33%');
  assert.equal(updateJson.data.shift, 'B');

  // 7. Filtering & Listing
  const listRes = await fetch(`${BASE_URL}/records?section=assembly&unit=Bawal`);
  assert.equal(listRes.status, 200);
  const listJson = await listRes.json();
  const records = Array.isArray(listJson.data) ? listJson.data : listJson.data?.records;
  assert.ok(Array.isArray(records));
  const found = records.some(r => r.id === recordId);
  assert.ok(found, 'Created record should appear in filtered list');

  // 8. Delete Permission: Non-owner cannot delete
  const delForbidden = await fetch(`${BASE_URL}/records/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenUserB}` }
  });
  assert.equal(delForbidden.status, 403);

  // 9. Admin can delete
  const delSuccess = await fetch(`${BASE_URL}/records/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
  assert.equal(delSuccess.status, 200);

  // Verify record no longer exists
  const verifyRes = await fetch(`${BASE_URL}/records/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
  assert.equal(verifyRes.status, 404);
});

test('LPA Score Preview Endpoint (/calculate-scores)', async () => {
  const previewSheet = {
    name: 'Assembly_Preview',
    columnCount: 7,
    rows: [
      [{ value: 'Date: 2026-10-18 | Shift: G' }],
      [{ value: 'FRM-WH-QA-246 Rev 06' }],
      [{ value: 'Sl No' }, { value: 'Focus' }, { value: 'CHECKS POINTS' }, { value: 'Area' }, { value: 'Marks' }, { value: 'Observation' }, { value: 'Score' }],
      // Item 1: Marks 5, Obs O -> Score 5
      [{ value: 1 }, { value: 'Focus' }, { value: 'Point 1' }, { value: 'Area A' }, { value: 5 }, { value: 'O' }, { value: '' }],
      // Item 2: Marks 5, Obs △ -> Score 4
      [{ value: 2 }, { value: 'Focus' }, { value: 'Point 2' }, { value: 'Area B' }, { value: 5 }, { value: '△' }, { value: '' }],
      // Item 3: Marks 5, Obs NA -> NA (excluded)
      [{ value: 3 }, { value: 'Focus' }, { value: 'Point 3' }, { value: 'Area C' }, { value: 5 }, { value: 'NA' }, { value: '' }]
    ]
  };

  const previewRes = await fetch(`${BASE_URL}/calculate-scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUserA}` },
    body: JSON.stringify({ sheet: previewSheet, section: 'assembly' })
  });

  assert.equal(previewRes.status, 200);
  const previewJson = await previewRes.json();
  // 2 applicable items * 5 = 10 total marks
  assert.equal(previewJson.data.totalMarks, 10);
  // score = 5 + 4 = 9
  assert.equal(previewJson.data.totalScore, 9);
  // percentage = 90.00%
  assert.equal(previewJson.data.percentage, '90.00%');
});

test('LPA C&C Check Sheet Calculation and Storage', async () => {
  const ccSheet = {
    name: 'CC_Sheet_1',
    columnCount: 9,
    rows: [
      [{ value: 'Date: 2026-10-18 | Shift: C' }],
      [{ value: 'Subtitle' }],
      [{ value: 'Section header' }],
      [{ value: 'Sl No' }, { value: 'Station' }, { value: 'Inspection Item' }, { value: 'Spec' }, { value: 'Tool' }, { value: 'Marks' }, { value: 'Area' }, { value: 'Observation' }, { value: 'Score' }],
      // Item 1 at row 4: Marks 3, Obs O -> Score 3
      [{ value: 1 }, { value: 'St 1' }, { value: 'Check A' }, { value: 'Spec' }, { value: 'Visual' }, { value: 3 }, { value: 'Crimping' }, { value: 'O' }, { value: '' }],
      // Item 2 at row 5: Marks 3, Obs △ -> Score 2
      [{ value: 2 }, { value: 'St 2' }, { value: 'Check B' }, { value: 'Spec' }, { value: 'Gauge' }, { value: 3 }, { value: 'Crimping' }, { value: '△' }, { value: '' }],
      // Item 3 at row 6: Marks 3, Obs × -> Score 0
      [{ value: 3 }, { value: 'St 3' }, { value: 'Check C' }, { value: 'Spec' }, { value: 'Visual' }, { value: 3 }, { value: 'Cutting' }, { value: '×' }, { value: '' }]
    ]
  };

  const createCcRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUserA}` },
    body: JSON.stringify({
      section: 'cc',
      name: 'C&C LPA Checklist · Test',
      unit: 'Gujrat',
      level: 'L2',
      auditDate: '2026-10-18',
      shift: 'C',
      department: 'C&C',
      sheets: [ccSheet]
    })
  });

  assert.equal(createCcRes.status, 201);
  const ccJson = await createCcRes.json();
  assert.equal(ccJson.data.totalMarks, 9);
  assert.equal(ccJson.data.totalScore, 5); // 3 + 2 + 0 = 5
  assert.equal(ccJson.data.scorePercentage, '55.56%');

  // Clean up
  await fetch(`${BASE_URL}/records/${encodeURIComponent(ccJson.data.id)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
});

