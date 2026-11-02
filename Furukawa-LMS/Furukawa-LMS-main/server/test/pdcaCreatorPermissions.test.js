import jwt from 'jsonwebtoken';

const JWT_SECRET = 'supersecretjwtkeyforfurukawaminda2026!';
const BASE_URL = 'http://127.0.0.1:3000/api/v1/pdca';

const tokenUserA = jwt.sign({
  id: 101,
  empId: 'EMP00101',
  code: 'EMP00101',
  userName: 'employeeA',
  fullName: 'Employee Alpha',
  department: 'SRC Quality',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

// Colleague in the SAME department (SRC Quality)
const tokenUserSameDept = jwt.sign({
  id: 102,
  empId: 'EMP00102',
  code: 'EMP00102',
  userName: 'employeeB',
  fullName: 'Employee Beta (Quality)',
  department: 'SRC Quality',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

// User in a DIFFERENT department (HR)
const tokenUserOtherDept = jwt.sign({
  id: 103,
  empId: 'EMP00103',
  code: 'EMP00103',
  userName: 'employeeC',
  fullName: 'Employee Charlie (HR)',
  department: 'HR',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

// Admin user with full access
const tokenAdmin = jwt.sign({
  id: 14,
  empId: 'ST080014',
  code: 'ST080014',
  userName: 'st080014',
  fullName: 'Joy Dastidar (ST080014)',
  department: 'D&D',
  role: 'ADMIN',
  isAdmin: true
}, JWT_SECRET, { expiresIn: '1h' });

async function runTests() {
  console.log('--- Starting PDCA Creator & Department-Based Access Control Verification ---');

  // Test 1: Employee A creates a PDCA record in SRC Quality department
  console.log('\n[Test 1] Employee A creates a PDCA record...');
  const createRes = await fetch(`${BASE_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserA}`
    },
    body: JSON.stringify({
      topic: 'Test Creator & Department Permission Verification',
      description: 'Testing department-based access control',
      plant: 'Bawal',
      department: 'SRC Quality',
      scope: 'Company'
    })
  });

  const createJson = await createRes.json();
  console.log('Create Response Status:', createRes.status, 'Record ID:', createJson.data?.id);
  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(`Failed to create record: ${JSON.stringify(createJson)}`);
  }
  const recordId = createJson.data.id;
  console.log('Created Record creator ID:', createJson.data.createdById || createJson.data.createdBy?.empId);

  // Test 2: Employee A views their own record -> isCreator should be true
  console.log('\n[Test 2] Employee A views their own record...');
  const viewARes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserA}` }
  });
  const viewAJson = await viewARes.json();
  console.log('View A isCreator:', viewAJson.data?.isCreator);
  if (viewAJson.data?.isCreator !== true) {
    throw new Error('Expected isCreator === true for Employee A');
  }

  // Test 3: Same-Department Colleague views Employee A's record -> Allowed, isCreator should be false
  console.log('\n[Test 3] Same-department colleague views Employee A\'s record...');
  const viewSameDeptRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserSameDept}` }
  });
  const viewSameDeptJson = await viewSameDeptRes.json();
  console.log('View Same-Dept Status:', viewSameDeptRes.status, 'isCreator:', viewSameDeptJson.data?.isCreator);
  if (viewSameDeptRes.status !== 200 || viewSameDeptJson.data?.isCreator !== false) {
    throw new Error('Expected 200 OK and isCreator === false for same-department colleague');
  }

  // Test 4: Same-Department Colleague updates Employee A's record -> Allowed (full department access)
  console.log('\n[Test 4] Same-department colleague updates Employee A\'s record...');
  const updateSameDeptRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserSameDept}`
    },
    body: JSON.stringify({
      topic: 'Legitimate update by same-department colleague'
    })
  });
  const updateSameDeptJson = await updateSameDeptRes.json();
  console.log('Update Same-Dept Status:', updateSameDeptRes.status, 'Topic:', updateSameDeptJson.data?.topic);
  if (updateSameDeptRes.status !== 200) {
    throw new Error(`Expected 200 OK for same-department colleague update, got ${updateSameDeptRes.status}`);
  }

  // Test 5: Same-Department Colleague saves sheet on Employee A's record -> Allowed
  console.log('\n[Test 5] Same-department colleague saves sheet...');
  const sheetSameDeptRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}/sheet`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserSameDept}`
    },
    body: JSON.stringify({
      rows: [],
      headerInfo: { topicName: 'Sheet updated by same-department colleague' }
    })
  });
  console.log('Save Sheet Same-Dept Status:', sheetSameDeptRes.status);
  if (sheetSameDeptRes.status !== 200) {
    throw new Error(`Expected 200 OK for same-department colleague sheet save, got ${sheetSameDeptRes.status}`);
  }

  // Test 6: Different-Department user attempts to VIEW Employee A's record -> Expect 403 Forbidden
  console.log('\n[Test 6] Different-department user attempts to view Employee A\'s record...');
  const viewOtherRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserOtherDept}` }
  });
  console.log('View Other-Dept Status:', viewOtherRes.status);
  if (viewOtherRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for different-department user view, got ${viewOtherRes.status}`);
  }

  // Test 7: Different-Department user attempts to GET SHEET -> Expect 403 Forbidden
  console.log('\n[Test 7] Different-department user attempts to get sheet...');
  const getSheetOtherRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}/sheet`, {
    headers: { 'Authorization': `Bearer ${tokenUserOtherDept}` }
  });
  console.log('Get Sheet Other-Dept Status:', getSheetOtherRes.status);
  if (getSheetOtherRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for different-department user get sheet, got ${getSheetOtherRes.status}`);
  }

  // Test 8: Different-Department user attempts to UPDATE record -> Expect 403 Forbidden
  console.log('\n[Test 8] Different-department user attempts to update record...');
  const updateOtherRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserOtherDept}`
    },
    body: JSON.stringify({
      topic: 'Hacked by Different Dept User'
    })
  });
  console.log('Update Other-Dept Status:', updateOtherRes.status);
  if (updateOtherRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for different-department user update, got ${updateOtherRes.status}`);
  }

  // Test 9: Different-Department user attempts to SAVE SHEET -> Expect 403 Forbidden
  console.log('\n[Test 9] Different-department user attempts to save sheet...');
  const sheetOtherRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}/sheet`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserOtherDept}`
    },
    body: JSON.stringify({
      rows: [],
      headerInfo: { topicName: 'Tampered by Other Dept' }
    })
  });
  console.log('Save Sheet Other-Dept Status:', sheetOtherRes.status);
  if (sheetOtherRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for different-department user sheet save, got ${sheetOtherRes.status}`);
  }

  // Test 10: Admin has complete unrestricted access across all departments
  console.log('\n[Test 10] Admin views and deletes record across departments...');
  const viewAdminRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
  console.log('Admin View Status:', viewAdminRes.status);
  if (viewAdminRes.status !== 200) {
    throw new Error(`Expected 200 OK for Admin view, got ${viewAdminRes.status}`);
  }

  const deleteAdminRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
  console.log('Admin Delete Status:', deleteAdminRes.status);
  if (deleteAdminRes.status !== 200) {
    throw new Error(`Expected 200 OK for Admin delete, got ${deleteAdminRes.status}`);
  }

  console.log('\n>>> ALL 10 DEPARTMENT & CREATOR ACCESS TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err.message || err);
  process.exit(1);
});
