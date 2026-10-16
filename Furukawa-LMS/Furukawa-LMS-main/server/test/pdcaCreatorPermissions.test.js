import jwt from 'jsonwebtoken';

const JWT_SECRET = 'supersecretjwtkeyforfurukawaminda2026!';
const BASE_URL = 'http://127.0.0.1:3000/api/v1/pdca';

const tokenUserA = jwt.sign({
  id: 101,
  empId: 'EMP00101',
  code: 'EMP00101',
  userName: 'employeeA',
  fullName: 'Employee Alpha',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

const tokenUserB = jwt.sign({
  id: 102,
  empId: 'EMP00102',
  code: 'EMP00102',
  userName: 'employeeB',
  fullName: 'Employee Beta',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

async function runTests() {
  console.log('--- Starting PDCA Creator Permission Verification ---');

  // Test 1: Employee A creates a PDCA record
  console.log('\n[Test 1] Employee A creates a PDCA record...');
  const createRes = await fetch(`${BASE_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserA}`
    },
    body: JSON.stringify({
      topic: 'Test Creator Permission Verification',
      description: 'Testing role-based employee creator permissions',
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

  // Test 3: Employee B views Employee A's record -> isCreator should be false
  console.log('\n[Test 3] Employee B views Employee A\'s record...');
  const viewBRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserB}` }
  });
  const viewBJson = await viewBRes.json();
  console.log('View B isCreator:', viewBJson.data?.isCreator);
  if (viewBJson.data?.isCreator !== false) {
    throw new Error('Expected isCreator === false for Employee B');
  }

  // Test 4: Employee B attempts to UPDATE Employee A's record -> Expect 403 Forbidden
  console.log('\n[Test 4] Employee B attempts to update Employee A\'s record...');
  const updateBRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserB}`
    },
    body: JSON.stringify({
      topic: 'Hacked by Employee B'
    })
  });
  const updateBJson = await updateBRes.json();
  console.log('Update B Status:', updateBRes.status, 'Message:', updateBJson.message);
  if (updateBRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for Employee B update, got ${updateBRes.status}`);
  }

  // Test 5: Employee B attempts to DELETE Employee A's record -> Expect 403 Forbidden
  console.log('\n[Test 5] Employee B attempts to delete Employee A\'s record...');
  const deleteBRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenUserB}` }
  });
  const deleteBJson = await deleteBRes.json();
  console.log('Delete B Status:', deleteBRes.status, 'Message:', deleteBJson.message);
  if (deleteBRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for Employee B delete, got ${deleteBRes.status}`);
  }

  // Test 6: Employee B attempts to SAVE SHEET on Employee A's record -> Expect 403 Forbidden
  console.log('\n[Test 6] Employee B attempts to save sheet on Employee A\'s record...');
  const sheetBRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}/sheet`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserB}`
    },
    body: JSON.stringify({
      rows: [],
      headerInfo: { topicName: 'Tampered' }
    })
  });
  const sheetBJson = await sheetBRes.json();
  console.log('Save Sheet B Status:', sheetBRes.status, 'Message:', sheetBJson.message);
  if (sheetBRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for Employee B sheet save, got ${sheetBRes.status}`);
  }

  // Test 7: Employee A updates their own record -> Expect 200 OK
  console.log('\n[Test 7] Employee A updates their own record...');
  const updateARes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserA}`
    },
    body: JSON.stringify({
      topic: 'Legitimate update by Employee A'
    })
  });
  const updateAJson = await updateARes.json();
  console.log('Update A Status:', updateARes.status, 'Updated Topic:', updateAJson.data?.topic);
  if (updateARes.status !== 200) {
    throw new Error(`Expected 200 OK for Employee A update, got ${updateARes.status}`);
  }

  // Test 8: Employee A deletes their own record -> Expect 200 OK
  console.log('\n[Test 8] Employee A deletes their own record...');
  const deleteARes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenUserA}` }
  });
  const deleteAJson = await deleteARes.json();
  console.log('Delete A Status:', deleteARes.status, 'Message:', deleteAJson.message);
  if (deleteARes.status !== 200) {
    throw new Error(`Expected 200 OK for Employee A delete, got ${deleteARes.status}`);
  }

  console.log('\n>>> ALL 8 ACCEPTANCE TESTS PASSED SUCCESSFULLY! <<<');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err.message);
  process.exit(1);
});
