import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('1. Suggestion Checksheet registered in PAGE_REGISTRY under CMS layout', () => {
  const pageRegistryCode = fs.readFileSync(new URL('../../constants/navigation/pageRegistry.js', import.meta.url), 'utf8');
  assert.ok(
    pageRegistryCode.includes('{ key: "cms-suggestion-checksheet", label: "Suggestion Checksheet", labelKey: "nav.suggestionChecksheet", layout: "cms", link: "/cms/suggestion-checksheet"'),
    'PAGE_REGISTRY must contain cms-suggestion-checksheet under layout cms'
  );
});

test('2. Suggestion Checksheet registered in AppRoutes.jsx', () => {
  const appRoutesCode = fs.readFileSync(new URL('../../routes/AppRoutes.jsx', import.meta.url), 'utf8');
  assert.ok(
    appRoutesCode.includes('import("../pages/suggestion-checksheet/SuggestionChecksheetPage.jsx")'),
    'AppRoutes must lazily import SuggestionChecksheetPage'
  );
  assert.ok(
    appRoutesCode.includes('<Route path="suggestion-checksheet" element={<SuggestionChecksheetPage />} />'),
    'AppRoutes must define Route path="suggestion-checksheet"'
  );
});

test('3. Suggestion Checksheet Icon registered in IconRegistry.js', () => {
  const iconRegistryCode = fs.readFileSync(new URL('../../constants/navigation/IconRegistry.js', import.meta.url), 'utf8');
  assert.ok(
    iconRegistryCode.includes('IconClipboardCheck'),
    'IconRegistry must register IconClipboardCheck'
  );
});

test('4. Suggestion Checksheet modular components and data are present', () => {
  const mockDataFile = new URL('../../components/suggestion-checksheet/suggestionChecksheetMockData.js', import.meta.url);
  const listFile = new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url);
  const detailFile = new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url);
  const addModalFile = new URL('../../components/suggestion-checksheet/SuggestionChecksheetAddModal.jsx', import.meta.url);
  const viewModalFile = new URL('../../components/suggestion-checksheet/SuggestionChecksheetViewModal.jsx', import.meta.url);
  const cssFile = new URL('../../components/suggestion-checksheet/SuggestionChecksheet.css', import.meta.url);

  assert.ok(fs.existsSync(mockDataFile), 'suggestionChecksheetMockData.js must exist');
  assert.ok(fs.existsSync(listFile), 'SuggestionChecksheetList.jsx must exist');
  assert.ok(fs.existsSync(detailFile), 'SuggestionChecksheetDetail.jsx must exist');
  assert.ok(fs.existsSync(addModalFile), 'SuggestionChecksheetAddModal.jsx must exist');
  assert.ok(fs.existsSync(viewModalFile), 'SuggestionChecksheetViewModal.jsx must exist');
  assert.ok(fs.existsSync(cssFile), 'SuggestionChecksheet.css must exist');
});

test('5. Detail sheet layout has Date & Employee Name/ID in same row, and Dept, Sec, Line/Area in same row', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(
    detailFile.includes('DATE:- and Employee Name / ID : in same row'),
    'Detail format must pair DATE and Employee Name/ID in the same row'
  );
  assert.ok(
    detailFile.includes('DEPARTMENT:-, SECTION:-, and Line / Area : in same row'),
    'Detail format must pair DEPARTMENT, SECTION, and Line / Area in the same row'
  );
  assert.ok(
    detailFile.includes("maxWidth: '100%'"),
    'Detail format must fit full width screen with maxWidth 100%'
  );
});

test('6. Page wrapper enables vertical scrolling when viewing detail format', () => {
  const pageFile = fs.readFileSync(new URL('./SuggestionChecksheetPage.jsx', import.meta.url), 'utf8');
  assert.ok(
    pageFile.includes("currentPage === 'detail' ? 'h-full min-h-0 flex-1 overflow-y-auto"),
    'Page wrapper must provide overflow-y-auto in detail view for complete scrolling'
  );
});

test('7. Unit dropdown in SuggestionChecksheetList has robust outside-click handler', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  assert.ok(
    listFile.includes('unitDropdownRef'),
    'Unit dropdown must use ref for outside-click detection'
  );
  assert.ok(
    listFile.includes("handleSelectUnit('Bawal')") && listFile.includes("handleSelectUnit('Gujrat')"),
    'Unit dropdown must support Bawal and Gujrat unit selection'
  );
});

test('8. Newly created sheets are initialized blank without hardcoded dummy texts', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(
    !detailFile.includes("Current manual torque tightening"),
    'Detail format must not hardcode dummy problem torque text'
  );
  assert.ok(
    !detailFile.includes("R. K. Verma"),
    'Detail format must not hardcode dummy line leader sign'
  );
  assert.ok(
    detailFile.includes("problemText: item?.problemText !== undefined ? item.problemText : (item?.description || '')"),
    'Detail format must use clean blank/item fallback for problemText'
  );
  assert.ok(
    detailFile.includes("suggestionText: item?.suggestionText || ''"),
    'Detail format must use clean blank/item fallback for suggestionText'
  );

  const addModalFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetAddModal.jsx', import.meta.url), 'utf8');
  assert.ok(
    addModalFile.includes('isBlank: true'),
    'Add modal must mark new record as blank'
  );
});

test('9. Create modal contains only Plant Unit, Employee Name/ID, Dept, Section, Line/Area, Date', () => {
  const addModalFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetAddModal.jsx', import.meta.url), 'utf8');
  assert.ok(addModalFile.includes('Plant Unit *'), 'Must contain Plant Unit');
  assert.ok(addModalFile.includes('Employee Name / ID'), 'Must contain Employee Name / ID');
  assert.ok(addModalFile.includes('Department'), 'Must contain Department');
  assert.ok(addModalFile.includes('Section'), 'Must contain Section');
  assert.ok(addModalFile.includes('Line / Area'), 'Must contain Line / Area');
  assert.ok(addModalFile.includes('type="date"'), 'Must contain Date with calendar input');

  // Verify removed fields
  assert.ok(!addModalFile.includes('label className="block text-slate-700 font-semibold mb-1">Category'), 'Category label must be removed');
  assert.ok(!addModalFile.includes('label className="block text-slate-700 font-semibold mb-1">Priority'), 'Priority label must be removed');
  assert.ok(!addModalFile.includes('Suggestion Title'), 'Suggestion Title must be removed');
  assert.ok(!addModalFile.includes('Problem Description / Details'), 'Problem Description must be removed');
});

test('10. Second row of checksheet format displays selected Unit', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(
    detailFile.includes('Row 2: SUGGESTION FORMAT & UNIT'),
    'Detail format must have Row 2 with SUGGESTION FORMAT & UNIT'
  );
  assert.ok(
    detailFile.includes('<span className="font-bold mr-1.5">UNIT:-</span>'),
    'Must display UNIT:- label in Row 2'
  );
});

test('11. Add modal connects to DB with cascading Department -> Section -> Line and Employee dropdown', () => {
  const addModalFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetAddModal.jsx', import.meta.url), 'utf8');
  assert.ok(addModalFile.includes('useGetAllDepartmentsQuery'), 'Must use Department API from DB');
  assert.ok(addModalFile.includes('useGetSectionsByDepartmentQuery'), 'Must cascade Sections by Department');
  assert.ok(addModalFile.includes('useGetLinesBySectionQuery'), 'Must cascade Lines by Section');
  assert.ok(addModalFile.includes('useGetAllUsersQuery'), 'Must fetch users/employees from DB');
  assert.ok(addModalFile.includes('formData.department'), 'State must track selected department');
});

test('12. Backend API routes and persistent storage exist for Suggestion Checksheet', () => {
  const routesPath = new URL('../../../../server/routes/suggestionChecksheet/suggestionChecksheet.routes.js', import.meta.url);
  const controllerPath = new URL('../../../../server/controllers/suggestionChecksheet/suggestionChecksheet.controller.js', import.meta.url);
  const modelPath = new URL('../../../../server/models/suggestionChecksheet/suggestionChecksheet.model.js', import.meta.url);
  const dbPath = new URL('../../../../server/db/suggestionChecksheet/suggestionChecksheetDb.js', import.meta.url);

  assert.ok(fs.existsSync(routesPath), 'Routes file must exist');
  assert.ok(fs.existsSync(controllerPath), 'Controller file must exist');
  assert.ok(fs.existsSync(modelPath), 'Model file must exist');
  assert.ok(fs.existsSync(dbPath), 'DB store file must exist');
});

test('13. Accepted/Rejected freezing logic and auto-fill line leader sign', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(detailFile.includes("const isAccepted = formData.rejectedAccepted === 'ACCEPTED'"), 'Tracks isAccepted');
  assert.ok(detailFile.includes("const isRejected = formData.rejectedAccepted === 'REJECTED'"), 'Tracks isRejected');
  assert.ok(detailFile.includes('disabled={isAccepted}'), 'Reason if Rejected disabled when Accepted');
  assert.ok(detailFile.includes('disabled={isRejected}'), 'Implementation Status disabled when Rejected');
  assert.ok(detailFile.includes('handleDateOfImplementationChange'), 'Date of Implementation handler present');
  assert.ok(detailFile.includes('lineLeaderSign2: val ?'), 'Auto-fills sign 2 on Date of Implementation');
});

test('14. Mandatory validation rules and calendar inputs in Detail sheet', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(detailFile.includes('Implementation Status Target Date is mandatory when Suggestion is Accepted'), 'Target date mandatory validation');
  assert.ok(detailFile.includes('Reason if Rejected is mandatory when Suggestion is Rejected'), 'Reason mandatory validation');
  assert.ok(detailFile.includes('type="date"'), 'Contains native calendar date inputs');
});

test('15. Suggestion checksheet store and mock data contain no dummy records', () => {
  const mockDataFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/suggestionChecksheetMockData.js', import.meta.url), 'utf8');
  const storePath = new URL('../../../../server/db/suggestionChecksheet/suggestion_checksheet_store.json', import.meta.url);
  const storeContent = fs.readFileSync(storePath, 'utf8');
  
  assert.ok(mockDataFile.includes('INITIAL_SUGGESTION_CHECKSHETS = []'), 'Mock data INITIAL_SUGGESTION_CHECKSHETS must be empty');
  assert.equal(JSON.parse(storeContent).length, 0, 'Persistent store must contain 0 dummy records');
});

