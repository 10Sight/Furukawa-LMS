import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isRecordCreator,
  isUserInSameDepartmentAsRecord,
  isUserInSameDepartmentAndSectionAsRecord,
  canEditRecord,
  canAccessRecord,
  getUserSections,
  getRecordSections,
  getUserDepartments,
  getRecordDepartments,
  areSectionsMatching
} from './recordFilters.js';

test('PDCA Sheet Access Rule: Creator and Admin have full access', () => {
  const creator = {
    id: 'emp-creator-1',
    code: 'QA001',
    name: 'Alice Creator',
    department: 'Quality',
    section: 'Incoming Quality'
  };

  const admin = {
    id: 'emp-admin-1',
    code: 'ADM001',
    name: 'Super Admin',
    role: 'ADMIN'
  };

  const record = {
    id: 'PDCA-QA-001',
    topic: 'Incoming Material Verification',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 'emp-creator-1',
      code: 'QA001',
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: 'emp-creator-1'
  };

  // Creator access
  assert.equal(isRecordCreator(record, creator), true, 'Creator must be recognized as creator');
  assert.equal(canEditRecord(record, creator), true, 'Creator must have edit access');
  assert.equal(canAccessRecord(record, creator), true, 'Creator must have access');

  // Admin access
  assert.equal(canEditRecord(record, admin), true, 'Admin must have full edit access');
  assert.equal(canAccessRecord(record, admin), true, 'Admin must have full access');
});

test('PDCA Sheet Access Rule Matrix: Same Dept + Same Section -> ACCESS ALLOWED', () => {
  const record = {
    id: 'PDCA-QA-002',
    topic: 'Supplier Inspection Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 'emp-creator-1',
      code: 'QA001',
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: 'emp-creator-1'
  };

  const colleagueSameDeptSameSection = {
    id: 'emp-colleague-1',
    code: 'QA002',
    name: 'Bob Colleague',
    department: 'Quality',
    section: 'Incoming Quality'
  };

  assert.equal(isRecordCreator(record, colleagueSameDeptSameSection), false, 'Colleague is not creator');
  assert.equal(isUserInSameDepartmentAsRecord(record, colleagueSameDeptSameSection), true, 'Same Dept + Same Section must match');
  assert.equal(isUserInSameDepartmentAndSectionAsRecord(record, colleagueSameDeptSameSection), true, 'Alias also matches');
  assert.equal(canEditRecord(record, colleagueSameDeptSameSection), true, 'Same Dept + Same Section must be ALLOWED');
  assert.equal(canAccessRecord(record, colleagueSameDeptSameSection), true, 'Same Dept + Same Section must be ALLOWED');
});

test('PDCA Sheet Access Rule Matrix: Same Dept + Different Section -> ACCESS DENIED', () => {
  const record = {
    id: 'PDCA-QA-003',
    topic: 'Supplier Inspection Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 'emp-creator-1',
      code: 'QA001',
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: 'emp-creator-1'
  };

  // User example: Department = Quality, Section = Final Inspection
  const colleagueSameDeptDiffSection = {
    id: 'emp-colleague-2',
    code: 'QA003',
    name: 'Charlie Quality',
    department: 'Quality',
    section: 'Final Inspection'
  };

  assert.equal(isRecordCreator(record, colleagueSameDeptDiffSection), false);
  assert.equal(isUserInSameDepartmentAsRecord(record, colleagueSameDeptDiffSection), false, 'Same Dept + Different Section must be DENIED');
  assert.equal(canEditRecord(record, colleagueSameDeptDiffSection), false, 'Same Dept + Different Section must be DENIED');
  assert.equal(canAccessRecord(record, colleagueSameDeptDiffSection), false, 'Same Dept + Different Section must be DENIED');
});

test('PDCA Sheet Access Rule Matrix: Different Dept + Same Section -> ACCESS DENIED', () => {
  const record = {
    id: 'PDCA-QA-004',
    topic: 'Inspection Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 'emp-creator-1',
      code: 'QA001',
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: 'emp-creator-1'
  };

  const colleagueDiffDeptSameSection = {
    id: 'emp-colleague-3',
    code: 'PR001',
    name: 'Dave Production',
    department: 'Production',
    section: 'Incoming Quality'
  };

  assert.equal(isRecordCreator(record, colleagueDiffDeptSameSection), false);
  assert.equal(isUserInSameDepartmentAsRecord(record, colleagueDiffDeptSameSection), false, 'Different Dept + Same Section must be DENIED');
  assert.equal(canEditRecord(record, colleagueDiffDeptSameSection), false, 'Different Dept + Same Section must be DENIED');
  assert.equal(canAccessRecord(record, colleagueDiffDeptSameSection), false, 'Different Dept + Same Section must be DENIED');
});

test('PDCA Sheet Access Rule Matrix: Different Dept + Different Section -> ACCESS DENIED', () => {
  const record = {
    id: 'PDCA-QA-005',
    topic: 'Inspection Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 'emp-creator-1',
      code: 'QA001',
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: 'emp-creator-1'
  };

  const colleagueDiffDeptDiffSection = {
    id: 'emp-colleague-4',
    code: 'MT001',
    name: 'Eve Maintenance',
    department: 'Maintenance',
    section: 'Electrical'
  };

  assert.equal(isRecordCreator(record, colleagueDiffDeptDiffSection), false);
  assert.equal(isUserInSameDepartmentAsRecord(record, colleagueDiffDeptDiffSection), false, 'Different Dept + Different Section must be DENIED');
  assert.equal(canEditRecord(record, colleagueDiffDeptDiffSection), false, 'Different Dept + Different Section must be DENIED');
  assert.equal(canAccessRecord(record, colleagueDiffDeptDiffSection), false, 'Different Dept + Different Section must be DENIED');
});

test('LPA Observation PDCA: Created in Assembly tab with creator section preserves section matching', () => {
  const lpaRecord = {
    id: 'PDCA-LPA-ASSEMBLY-Bawal-1730000000',
    topic: 'Assembly - LPA Observation (PDCA)',
    category: 'assembly',
    lpaCategory: 'assembly',
    department: 'Quality',
    section: 'Assembly Quality',
    sectionName: 'Assembly Quality',
    createdBy: {
      id: 'emp-qa-10',
      code: 'QA010',
      name: 'Priya QA',
      department: 'Quality',
      deptName: 'Quality',
      section: 'Assembly Quality',
      sectionName: 'Assembly Quality'
    },
    createdById: 'emp-qa-10'
  };

  const sameDeptSameSecColleague = {
    id: 'emp-qa-11',
    code: 'QA011',
    name: 'Rahul QA',
    department: 'Quality',
    section: 'Assembly Quality'
  };

  const sameDeptDiffSecColleague = {
    id: 'emp-qa-12',
    code: 'QA012',
    name: 'Suresh QA',
    department: 'Quality',
    section: 'Quality Lab' // Different section in Quality
  };

  const diffDeptAssemblyUser = {
    id: 'emp-as-01',
    code: 'AS001',
    name: 'Amit Assembly',
    department: 'Assembly',
    section: 'Assembly Quality' // Different department
  };

  assert.equal(isUserInSameDepartmentAsRecord(lpaRecord, sameDeptSameSecColleague), true, 'Same Dept (Quality) + Same Sec (Assembly Quality) -> ALLOWED');
  assert.equal(canEditRecord(lpaRecord, sameDeptSameSecColleague), true, 'Edit ALLOWED');

  assert.equal(isUserInSameDepartmentAsRecord(lpaRecord, sameDeptDiffSecColleague), false, 'Same Dept (Quality) + Diff Sec (Quality Lab) -> DENIED');
  assert.equal(canEditRecord(lpaRecord, sameDeptDiffSecColleague), false, 'Edit DENIED');

  assert.equal(isUserInSameDepartmentAsRecord(lpaRecord, diffDeptAssemblyUser), false, 'Diff Dept (Assembly) -> DENIED');
  assert.equal(canEditRecord(lpaRecord, diffDeptAssemblyUser), false, 'Edit DENIED');
});

