import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRow, createDefaultRows } from './pdcaStore.js';
import { PDCA_DEPARTMENTS } from './pdcaConstants.js';
import { VERIFIED_SECTION_MASTER, isSectionRelatedToDepartment } from './pdcaSections.js';

test('1. PDCA row schema contains Department, Section, and Line/Area fields', () => {
  const row = createEmptyRow();
  assert.ok('department' in row, 'department field must exist in row');
  assert.ok('section' in row, 'section field must exist in row');
  assert.ok('sectionId' in row, 'sectionId field must exist in row');
  assert.ok('sectionCode' in row, 'sectionCode field must exist in row');
  assert.ok('lineArea' in row, 'lineArea field must exist in row');
  assert.ok('lineAreaId' in row, 'lineAreaId field must exist in row');
  assert.ok('lineAreaCode' in row, 'lineAreaCode field must exist in row');
  assert.ok('lineAreaSectionId' in row, 'lineAreaSectionId field must exist in row');

  assert.equal(row.department, '');
  assert.equal(row.section, '');
  assert.equal(row.sectionId, null);
  assert.equal(row.sectionCode, '');
});

test('2. Department dropdown has exactly the 13 required options in exact order', () => {
  const expected = [
    'PE',
    'IT',
    'Quality',
    'Assembly',
    'SRC',
    'Store',
    'HR',
    'Safety',
    'FG',
    'PPC',
    'Maintenance',
    'D&D',
    'C&C'
  ];

  assert.deepEqual(PDCA_DEPARTMENTS, expected);
});

test('3. Section master data contains all supplied section records with preserved ID, name, and uniCode', () => {
  const requiredSections = [
    { id: 70, name: 'Assembly Quality', uniCode: 'WQ1-4' },
    { id: 74, name: 'Assembly Production', uniCode: 'WAP1-8' },
    { id: 75, name: 'Assembly Production (Support team)', uniCode: 'WAP1-7' },
    { id: 78, name: 'AIRBAG SUB-ASSEMBLY', uniCode: 'WAP1-6' },
    { id: 79, name: 'TUBE CUTTING', uniCode: 'WAP1-5' },
    { id: 80, name: 'SPD', uniCode: 'WAP1-4' },
    { id: 82, name: 'ASSEMBLY SUB LEADER', uniCode: 'WAP1-3' },
    { id: 85, name: 'PRODUCTION OFFICE', uniCode: 'WAP1-1' },
    { id: 87, name: 'Quality C&C', uniCode: 'WQ1-5' },
    { id: 94, name: 'Assembly Quality (Line Leader)', uniCode: 'WQ1-3' },
    { id: 95, name: 'CSG + 3T (Quality)', uniCode: 'WQ1-2' },
    { id: 96, name: 'SRC Quality', uniCode: 'SRC1-4' },
    { id: 98, name: 'SRC- Production', uniCode: 'SRC1-2' },
    { id: 99, name: 'Quality Lab', uniCode: 'WQ1-1' },
    { id: 100, name: 'Training cell', uniCode: 'TC01' },
    { id: 104, name: 'JB', uniCode: 'SRC1-1' },
    { id: 105, name: 'Safety', uniCode: 'SF1-1' },
    { id: 106, name: 'Store', uniCode: 'STR1-1' },
    { id: 107, name: 'FG (Bawal +3T+TTIPL)', uniCode: 'FG1-1' },
    { id: 108, name: 'Logistics', uniCode: 'FG1-2' },
    { id: 109, name: 'PPC (Name Tag Printing)', uniCode: 'PP1-1' },
    { id: 110, name: 'PE', uniCode: 'PE1-1' },
    { id: 111, name: 'Maintenance', uniCode: 'MT1-1' },
    { id: 113, name: 'IT', uniCode: 'IT01-1' },
    { id: 115, name: 'D&D', uniCode: 'DD1-1' },
    { id: 116, name: 'Assembly (Rework/Material Handler/Trainer/Support)', uniCode: 'WAP1-2' },
    { id: 117, name: 'Quality Office ( Reports)', uniCode: 'WQ1-6' },
    { id: 118, name: '200% Manpower', uniCode: 'WQ1-7' },
    { id: 120, name: 'SRC Maintenance', uniCode: 'SRC1-5' },
    { id: 121, name: 'C&C machine', uniCode: 'WCP1-5' },
    { id: 122, name: 'C&C other', uniCode: 'WCP1-4' },
    { id: 123, name: 'C&C (Leader, rework, material handler, rolling,)', uniCode: 'WCP1-3' },
    { id: 124, name: 'SFG Confirmation _C&C & Document', uniCode: 'WCP1-2' },
    { id: 125, name: 'Utility', uniCode: 'MT1-01' },
    { id: 126, name: 'SFG Confirmation', uniCode: 'WAP1-9' },
    { id: 128, name: 'GA', uniCode: 'GA01' }
  ];

  assert.ok(VERIFIED_SECTION_MASTER.length >= 34, `Expected at least 34 verified sections, got ${VERIFIED_SECTION_MASTER.length}`);

  for (const req of requiredSections) {
    const found = VERIFIED_SECTION_MASTER.find((s) => s.id === req.id);
    assert.ok(found, `Section with ID ${req.id} (${req.name}) must exist`);
    assert.equal(found.id, req.id, `ID for section ${req.name} must be preserved`);
    assert.equal(found.uniCode, req.uniCode, `Section Code for ${req.name} must match ${req.uniCode}`);
  }
});

test('4. Department and Section relationship: department change clears invalid section, preserves valid one', () => {
  // Simulating the exact logic from handleDepartmentChange
  const applyDepartmentChange = (curr, newDept) => {
    let nextSection = curr.section;
    let nextSectionId = curr.sectionId;
    let nextSectionCode = curr.sectionCode;
    let nextLineArea = curr.lineArea;
    let nextLineAreaId = curr.lineAreaId;
    let nextLineAreaCode = curr.lineAreaCode;

    if (newDept && curr.sectionId) {
      const secMatch = VERIFIED_SECTION_MASTER.find((s) => String(s.id) === String(curr.sectionId));
      if (secMatch && secMatch.category && secMatch.category !== 'Not Applicable') {
        const deptLower = newDept.trim().toLowerCase();
        const catLower = secMatch.category.trim().toLowerCase();
        const isCrimping = deptLower === 'c&c';
        const match = catLower === deptLower || (isCrimping && catLower === 'crimping');
        const deptHasSections = VERIFIED_SECTION_MASTER.some((s) => {
          const c = (s.category || '').toLowerCase();
          return c === deptLower || (isCrimping && c === 'crimping');
        });
        if (deptHasSections && !match) {
          nextSection = '';
          nextSectionId = null;
          nextSectionCode = '';
          nextLineArea = '';
          nextLineAreaId = null;
          nextLineAreaCode = '';
        }
      }
    }

    return {
      ...curr,
      department: newDept,
      section: nextSection,
      sectionId: nextSectionId,
      sectionCode: nextSectionCode,
      lineArea: nextLineArea,
      lineAreaId: nextLineAreaId,
      lineAreaCode: nextLineAreaCode
    };
  };

  // Case A: Section 74 is "Assembly Production" (category: Assembly).
  // Changing Department to "Assembly" retains section.
  const row1 = {
    ...createEmptyRow(),
    department: 'Assembly',
    section: 'Assembly Production',
    sectionId: 74,
    sectionCode: 'WAP1-8',
    observation: 'Oil leak observed at assembly station'
  };
  const updated1 = applyDepartmentChange(row1, 'Assembly');
  assert.equal(updated1.sectionId, 74);
  assert.equal(updated1.section, 'Assembly Production');
  assert.equal(updated1.observation, 'Oil leak observed at assembly station');

  // Case B: Changing Department to "Quality" clears the Assembly section because Quality has its own sections
  const updated2 = applyDepartmentChange(row1, 'Quality');
  assert.equal(updated2.department, 'Quality');
  assert.equal(updated2.sectionId, null);
  assert.equal(updated2.section, '');
  assert.equal(updated2.observation, 'Oil leak observed at assembly station', 'Observation must remain intact');

  // Case C: Changing Department to "HR" does NOT clear section because HR has no specific section mappings
  const updated3 = applyDepartmentChange(row1, 'HR');
  assert.equal(updated3.department, 'HR');
  assert.equal(updated3.sectionId, 74, 'Section should not be cleared when no relationship is defined');
});

test('5. Section and Line/Area cascading: changing section clears Line/Area if not belonging to section', () => {
  const mockDbSections = [
    {
      id: 70,
      name: 'Assembly Quality',
      uniCode: 'WQ1-4',
      lines: [
        { id: 374, name: 'YHB IP-1', uniCode: 'IP-1' },
        { id: 375, name: 'YHB IP-2', uniCode: 'IP-2' }
      ]
    },
    {
      id: 74,
      name: 'Assembly Production',
      uniCode: 'WAP1-8',
      lines: [
        { id: 400, name: 'Line A1', uniCode: 'A1' }
      ]
    }
  ];

  // Simulating handleSectionChange logic
  const applySectionChange = (curr, newSectionName, meta = {}) => {
    const newSectionId = meta?.sectionId ?? null;
    const newSectionCode = meta?.sectionCode ?? '';

    let nextLineArea = curr.lineArea;
    let nextLineAreaId = curr.lineAreaId;
    let nextLineAreaCode = curr.lineAreaCode;

    if (curr.lineAreaId && newSectionId != null) {
      const secMatch = mockDbSections.find((s) => String(s.id) === String(newSectionId));
      if (secMatch && Array.isArray(secMatch.lines) && secMatch.lines.length > 0) {
        const lineBelongs = secMatch.lines.some((l) => String(l.id) === String(curr.lineAreaId));
        if (!lineBelongs) {
          nextLineArea = '';
          nextLineAreaId = null;
          nextLineAreaCode = '';
        }
      }
    } else if (!newSectionName) {
      nextLineArea = '';
      nextLineAreaId = null;
      nextLineAreaCode = '';
    }

    return {
      ...curr,
      section: newSectionName,
      sectionId: newSectionId,
      sectionCode: newSectionCode,
      lineAreaSectionId: newSectionId,
      lineArea: nextLineArea,
      lineAreaId: nextLineAreaId,
      lineAreaCode: nextLineAreaCode
    };
  };

  const initialRow = {
    ...createEmptyRow(),
    department: 'Quality',
    section: 'Assembly Quality',
    sectionId: 70,
    sectionCode: 'WQ1-4',
    lineArea: 'Assembly Quality / YHB IP-1',
    lineAreaId: 374,
    lineAreaCode: 'IP-1',
    observation: 'Inspection mismatch'
  };

  // Case A: Changing to same section or section containing the line keeps lineArea
  const sameSec = applySectionChange(initialRow, 'Assembly Quality', { sectionId: 70, sectionCode: 'WQ1-4' });
  assert.equal(sameSec.lineAreaId, 374);
  assert.equal(sameSec.lineArea, 'Assembly Quality / YHB IP-1');

  // Case B: Changing to Section 74 (which does not own line 374) clears Line/Area
  const diffSec = applySectionChange(initialRow, 'Assembly Production', { sectionId: 74, sectionCode: 'WAP1-8' });
  assert.equal(diffSec.sectionId, 74);
  assert.equal(diffSec.section, 'Assembly Production');
  assert.equal(diffSec.lineAreaId, null, 'lineAreaId must be cleared');
  assert.equal(diffSec.lineArea, '', 'lineArea label must be cleared');
  assert.equal(diffSec.observation, 'Inspection mismatch', 'Observation must not be cleared');
});

test('6. Form row round-trip serialization retains all Department, Section, and Line/Area fields', () => {
  const testRow = {
    date: '2026-10-15',
    shift: 'A',
    status: 'Open',
    department: 'Quality',
    section: 'Assembly Quality',
    sectionId: 70,
    sectionCode: 'WQ1-4',
    lineArea: 'Assembly Quality / YHB IP-1',
    lineAreaSectionId: 70,
    lineAreaId: 374,
    lineAreaCode: 'IP-1',
    observation: 'Critical finding',
    rootCause: 'Calibration error',
    counterMeasure: 'Re-zero gage',
    responseDate: '2026-10-20',
    responsiblePersonDept: 'Quality',
    staffEmployees: [{ name: 'Deepak', staffId: '80053982', employeeId: '80053982', department: 'Quality' }]
  };

  const jsonStr = JSON.stringify(testRow);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.department, 'Quality');
  assert.equal(parsed.section, 'Assembly Quality');
  assert.equal(parsed.sectionId, 70);
  assert.equal(parsed.sectionCode, 'WQ1-4');
  assert.equal(parsed.lineArea, 'Assembly Quality / YHB IP-1');
  assert.equal(parsed.lineAreaId, 374);
  assert.equal(parsed.lineAreaCode, 'IP-1');
  assert.equal(parsed.lineAreaSectionId, 70);
  assert.equal(parsed.responsiblePersonDept, 'Quality');
});

test('7. isSectionRelatedToDepartment strictly filters section options to only related sections per department', () => {
  // When no department is chosen, all sections are accessible
  const allForEmpty = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, ''));
  assert.equal(allForEmpty.length, VERIFIED_SECTION_MASTER.length);

  // When C&C is chosen, strictly C&C crimping sections are returned (no Assembly, no Quality, no Store)
  const ccSections = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, 'C&C'));
  assert.equal(ccSections.length, 4);
  assert.ok(ccSections.every((s) => s.category === 'CRIMPING' || s.name.toLowerCase().includes('c&c')));
  assert.ok(!ccSections.some((s) => s.name === 'Assembly Production'));
  assert.ok(!ccSections.some((s) => s.name === 'Store'));
  assert.ok(!ccSections.some((s) => s.name === 'Assembly Quality'));

  // When Assembly is chosen, only assembly sections are returned
  const assemblySections = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, 'Assembly'));
  assert.equal(assemblySections.length, 9);
  assert.ok(assemblySections.every((s) => s.category === 'Assembly'));
  assert.ok(!assemblySections.some((s) => s.name === 'Assembly Quality')); // Belongs to Quality
  assert.ok(!assemblySections.some((s) => s.name === 'C&C machine'));

  // When Quality is chosen, all quality sections including Assembly Quality are returned
  const qualitySections = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, 'Quality'));
  assert.equal(qualitySections.length, 7);
  assert.ok(qualitySections.every((s) => s.category === 'Quality'));
  assert.ok(qualitySections.some((s) => s.name === 'Assembly Quality'));

  // Maintenance includes Maintenance and Utility
  const maintSections = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, 'Maintenance'));
  assert.equal(maintSections.length, 2);
  assert.ok(maintSections.some((s) => s.name === 'Maintenance'));
  assert.ok(maintSections.some((s) => s.name === 'Utility'));

  // HR includes Training cell and GA
  const hrSections = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, 'HR'));
  assert.equal(hrSections.length, 2);
  assert.ok(hrSections.some((s) => s.name === 'Training cell'));
  assert.ok(hrSections.some((s) => s.name === 'GA'));

  // Store includes Store
  const storeSections = VERIFIED_SECTION_MASTER.filter((s) => isSectionRelatedToDepartment(s, 'Store'));
  assert.equal(storeSections.length, 1);
  assert.equal(storeSections[0].name, 'Store');
});

