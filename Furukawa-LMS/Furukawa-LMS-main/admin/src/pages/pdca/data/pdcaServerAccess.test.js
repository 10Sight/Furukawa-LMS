import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isUserInSameDepartmentAsRecord,
  isUserInSameDepartmentAndSectionAsRecord,
  canUserAccessPDCARecord
} from '../../../../../server/controllers/pdca/pdca.controllers.js';

test('Server PDCA Access Rule: Creator and Admin have full access', () => {
  const creator = {
    id: 101,
    userName: 'alice',
    fullName: 'Alice Creator',
    deptName: 'Quality',
    sectionName: 'Incoming Quality'
  };

  const admin = {
    id: 999,
    userName: 'admin',
    fullName: 'Admin User',
    role: 'ADMIN',
    isAdmin: true
  };

  const record = {
    id: 'PDCA-SERVER-001',
    topic: 'Server Incoming Quality Test',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 101,
      userId: 101,
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: '101'
  };

  assert.equal(canUserAccessPDCARecord(creator, record), true, 'Creator has access');
  assert.equal(canUserAccessPDCARecord(admin, record), true, 'Admin has access');
});

test('Server PDCA Access Rule Matrix: Same Dept + Same Section -> ACCESS ALLOWED', () => {
  const record = {
    id: 'PDCA-SERVER-002',
    topic: 'Incoming Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 101,
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: '101'
  };

  const colleagueSame = {
    id: 102,
    userName: 'bob',
    deptName: 'Quality',
    sectionName: 'Incoming Quality'
  };

  assert.equal(isUserInSameDepartmentAsRecord(colleagueSame, record), true);
  assert.equal(isUserInSameDepartmentAndSectionAsRecord(colleagueSame, record), true);
  assert.equal(canUserAccessPDCARecord(colleagueSame, record), true);
});

test('Server PDCA Access Rule Matrix: Same Dept + Different Section -> ACCESS DENIED', () => {
  const record = {
    id: 'PDCA-SERVER-003',
    topic: 'Incoming Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 101,
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: '101'
  };

  // User example: Department: Quality, Section: Final Inspection
  const colleagueDiffSection = {
    id: 103,
    userName: 'charlie',
    deptName: 'Quality',
    sectionName: 'Final Inspection'
  };

  assert.equal(isUserInSameDepartmentAsRecord(colleagueDiffSection, record), false, 'Different section must be DENIED');
  assert.equal(canUserAccessPDCARecord(colleagueDiffSection, record), false, 'Different section must be DENIED');
});

test('Server PDCA Access Rule Matrix: Different Dept + Same Section -> ACCESS DENIED', () => {
  const record = {
    id: 'PDCA-SERVER-004',
    topic: 'Incoming Sheet',
    department: 'Quality',
    section: 'Incoming Quality',
    createdBy: {
      id: 101,
      name: 'Alice Creator',
      department: 'Quality',
      section: 'Incoming Quality'
    },
    createdById: '101'
  };

  const colleagueDiffDept = {
    id: 104,
    userName: 'dave',
    deptName: 'Production',
    sectionName: 'Incoming Quality'
  };

  assert.equal(isUserInSameDepartmentAsRecord(colleagueDiffDept, record), false, 'Different dept must be DENIED');
  assert.equal(canUserAccessPDCARecord(colleagueDiffDept, record), false, 'Different dept must be DENIED');
});

