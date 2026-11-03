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

const tokenUserColleague = jwt.sign({
  id: 102,
  empId: 'EMP00102',
  code: 'EMP00102',
  userName: 'employeeB',
  fullName: 'Employee Beta',
  department: 'SRC Quality',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

const tokenUserOther = jwt.sign({
  id: 103,
  empId: 'EMP00103',
  code: 'EMP00103',
  userName: 'employeeC',
  fullName: 'Employee Charlie',
  department: 'HR',
  role: 'EMPLOYEE'
}, JWT_SECRET, { expiresIn: '1h' });

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
  console.log('--- Starting PDCA Visibility & Creator Permission Verification ---');

  // Test 1: Employee A creates a PDCA record
  console.log('\n[Test 1] Employee A creates a PDCA record...');
  const createRes = await fetch(`${BASE_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenUserA}`
    },
    body: JSON.stringify({
      topic: 'Test Visibility & Creator Permissions',
      description: 'Testing that sheets are visible to all users',
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

  // Test 3: Colleague views Employee A's record -> Visible! isCreator should be false
  console.log('\n[Test 3] Colleague views Employee A\'s record...');
  const viewColleagueRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserColleague}` }
  });
  const viewColleagueJson = await viewColleagueRes.json();
  console.log('View Colleague Status:', viewColleagueRes.status, 'isCreator:', viewColleagueJson.data?.isCreator);
  if (viewColleagueRes.status !== 200 || viewColleagueJson.data?.isCreator !== false) {
    throw new Error('Expected 200 OK and isCreator === false for colleague');
  }

  // Test 4: Another user views Employee A's record -> Not hidden! Visible to all user IDs
  console.log('\n[Test 4] Another user views Employee A\'s record (not hidden)...');
  const viewOtherRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenUserOther}` }
  });
  const viewOtherJson = await viewOtherRes.json();
  console.log('View Other Status:', viewOtherRes.status, 'Record returned:', Boolean(viewOtherJson.data?.id));
  if (viewOtherRes.status !== 200 || !viewOtherJson.data?.id) {
    throw new Error('Expected record to be visible to all users (not hidden)');
  }

  // Test 5: All user IDs see sheets in the list
  console.log('\n[Test 5] List records is not hidden from users...');
  const listRes = await fetch(`${BASE_URL}`, {
    headers: { 'Authorization': `Bearer ${tokenUserOther}` }
  });
  const listJson = await listRes.json();
  const found = (listJson.data?.records || []).some(r => r.id === recordId);
  console.log('Record found in list for other user:', found);
  if (!found) {
    throw new Error('Expected record to appear in list for all users');
  }

  // Test 6: Admin views and deletes record
  console.log('\n[Test 6] Admin views and deletes record...');
  const viewAdminRes = await fetch(`${BASE_URL}/${encodeURIComponent(recordId)}`, {
    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
  });
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

  console.log('\n>>> ALL VISIBILITY & PERMISSION TESTS PASSED! <<<');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err.message || err);
  process.exit(1);
});
