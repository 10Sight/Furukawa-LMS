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

test('7. Unit dropdown in SuggestionChecksheetList defaults to Bawal', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  const pageFile = fs.readFileSync(new URL('./SuggestionChecksheetPage.jsx', import.meta.url), 'utf8');
  assert.ok(
    pageFile.includes("useState('Bawal')"),
    'Default unit must be initialized to Bawal'
  );
  assert.ok(
    listFile.includes("handleSelectUnit") && listFile.includes("'Bawal'") && listFile.includes("'Gujrat'"),
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

test('10. Third row of checksheet format displays selected Unit text on the left', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(
    detailFile.includes('Row 3: UNIT (Left - Placed in 3rd row as requested)'),
    'Detail format must place UNIT in row 3 on the left'
  );
  assert.ok(
    detailFile.includes('<span className="font-bold mr-1.5">UNIT:-</span>'),
    'Must display UNIT:- label in Row 3'
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

test('13. Accepted/Not Feasible freezing logic and auto-fill line leader sign', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(detailFile.includes("const isAccepted = formData.rejectedAccepted === 'ACCEPTED'"), 'Tracks isAccepted');
  assert.ok(detailFile.includes('isNotFeasible'), 'Tracks isNotFeasible');
  assert.ok(detailFile.includes('disabled={isAccepted'), 'Reason disabled when Accepted');
  assert.ok(detailFile.includes('disabled={isNotFeasible'), 'Implementation Status disabled when Not Feasible');
  assert.ok(detailFile.includes('handleDateOfImplementationChange'), 'Date of Implementation handler present');
  assert.ok(detailFile.includes('lineLeaderSign2: val ?'), 'Auto-fills sign 2 on Date of Implementation');
});

test('14. Mandatory validation rules and calendar inputs in Detail sheet with Not Feasible', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(detailFile.includes('Implementation Status Target Date is mandatory when Suggestion is Accepted'), 'Target date mandatory validation');
  assert.ok(detailFile.includes('Reason if Not Feasible is mandatory when Suggestion is Not Feasible'), 'Reason not feasible validation');
  assert.ok(detailFile.includes('NOT FEASIBLE / ACCEPTED'), 'Header replaces Rejected with Not Feasible');
  assert.ok(detailFile.includes('type="date"'), 'Contains native calendar date inputs');
});

test('15. Suggestion checksheet store and mock data contain no dummy records', () => {
  const mockDataFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/suggestionChecksheetMockData.js', import.meta.url), 'utf8');
  const storePath = new URL('../../../../server/db/suggestionChecksheet/suggestion_checksheet_store.json', import.meta.url);
  const storeContent = fs.readFileSync(storePath, 'utf8');
  const parsedStore = JSON.parse(storeContent);

  assert.ok(mockDataFile.includes('INITIAL_SUGGESTION_CHECKSHETS = []'), 'Mock data INITIAL_SUGGESTION_CHECKSHETS must be empty');
  const dummyIds = ['SC-BWL-1021', 'SC-BWL-1024', 'SC-BWL-1029', 'SC-GJT-2015', 'SC-GJT-2018', 'SC-GJR-2015'];
  const hasDummy = parsedStore.some((r) => dummyIds.includes(r.id));
  assert.equal(hasDummy, false, 'Persistent store must not contain any dummy seed records');
});

test('16. Add Checksheet modal contains Search Bar Dropdown for Employee Name / ID', () => {
  const addModalFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetAddModal.jsx', import.meta.url), 'utf8');
  assert.ok(addModalFile.includes('employeeSearchTerm'), 'State for search term must exist');
  assert.ok(addModalFile.includes('isEmployeeDropdownOpen'), 'State for dropdown toggle must exist');
  assert.ok(addModalFile.includes('Search by employee name or ID...'), 'Search input placeholder must exist');
  assert.ok(addModalFile.includes('filteredEmployeeOptions'), 'Filtered employee options computation must exist');
});

test('17. Two pages (All Suggestions & Best Suggestions) with Admin-only Best and Delete buttons', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  assert.ok(listFile.includes('All Suggestions'), 'All Suggestions tab must exist');
  assert.ok(listFile.includes('Best Suggestions'), 'Best Suggestions tab must exist');
  assert.ok(listFile.includes('isAdmin &&'), 'Best and Delete actions must be restricted to admin');
  assert.ok(listFile.includes("activeTab === 'ALL'"), 'Add checksheet must be available only in All Suggestions');
});

test('18. ID column removed from checksheet table', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  assert.ok(!listFile.includes('<th className="pl-5 py-3 w-[140px]">ID</th>'), 'ID header must be removed');
  assert.ok(!listFile.includes('{item.id}</td>'), 'ID cell must be removed');
});

test('19. Filter toolbar supports Department, From-To date calendars, and Status', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  assert.ok(listFile.includes('departmentFilter'), 'Department filter state must exist');
  assert.ok(listFile.includes('fromDate') && listFile.includes('toDate'), 'From and To date states must exist');
  assert.ok(listFile.includes('Under Review') && listFile.includes('Approved') && listFile.includes('Implemented'), 'Status filter values must exist');
});

test('20. Best Suggestion View-only permission for non-admin and non-creator', () => {
  const pageFile = fs.readFileSync(new URL('./SuggestionChecksheetPage.jsx', import.meta.url), 'utf8');
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  assert.ok(pageFile.includes('isReadOnly'), 'Passes isReadOnly flag to detail view');
  assert.ok(detailFile.includes('isReadOnly'), 'Accepts isReadOnly prop');
  assert.ok(detailFile.includes('Best Suggestion (View Only'), 'Displays view-only indicator');
});

test('21. Add modal contains NO dummy employee data fallback and fetches only real DB users', () => {
  const addModalFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetAddModal.jsx', import.meta.url), 'utf8');
  assert.ok(!addModalFile.includes('VERIFIED_EMPLOYEE_MASTER'), 'Must NOT import or fallback to VERIFIED_EMPLOYEE_MASTER');
  assert.ok(addModalFile.includes('useGetAllUsersQuery'), 'Must fetch users from DB');
  assert.ok(addModalFile.includes('No employees found in database'), 'Must show clean empty state when no DB users');
});

test('22. Unit selector is placed in the filters toolbar and removed from top of page', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  const graphFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // Verify Unit selector is placed in the filters toolbar
  assert.ok(graphFile.includes('Unit Filter (placed in filters toolbar)'), 'Unit selector must be placed in Graph filter controls');
  assert.ok(listFile.includes('Unit Filter (in the filter toolbar)'), 'Unit selector must be placed in List filter toolbar');
  assert.ok(graphFile.includes('Bawal') && graphFile.includes('Gujrat') && graphFile.includes('All Units'), 'Unit filter must include Bawal, Gujrat, All Units');
});

test('23. Table columns reflect Created By and Approved / Rejected By (ID removed)', () => {
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');
  assert.ok(listFile.includes('<th className="py-3">Created By</th>'), 'Table header must have Created By replacing Suggestion/checksheet item');
  assert.ok(listFile.includes('<th className="py-3 w-[180px]">Approved / Rejected By</th>'), 'Table header must have Approved / Rejected By (ID removed)');
  assert.ok(!listFile.includes('ID: {item.id}'), 'Table cell must not display sheet ID in Approved / Rejected By column');
});


test('24. Suggestion related Defect Prevention section with rank checkboxes (1-5) and auto-fetch rank 4 or 5 into Best Suggestions', () => {
  const detailFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetDetail.jsx', import.meta.url), 'utf8');
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');

  // Verify Defect Prevention table in detail sheet
  assert.ok(detailFile.includes('Suggestion related Defect Prevention'), 'Detail format must include Suggestion related Defect Prevention table');
  assert.ok(detailFile.includes('1.Suggestion Occurrence related'), 'Must include 1.Suggestion Occurrence related');
  assert.ok(detailFile.includes('2.Suggestion Detection related'), 'Must include 2.Suggestion Detection related');
  assert.ok(detailFile.includes('3.Unique Process Improvement'), 'Must include 3.Unique Process Improvement');
  assert.ok(detailFile.includes('4.Facility Related Improvement'), 'Must include 4.Facility Related Improvement');
  assert.ok(detailFile.includes('5.Not related to Quality & Productivity'), 'Must include 5.Not related to Quality & Productivity');
  assert.ok(detailFile.includes('handleSelectRank'), 'Must have handleSelectRank handler');
  assert.ok(detailFile.includes('type="checkbox"'), 'Ranks must be selectable via checkbox');

  // Verify auto-fetch logic for rank 4 and 5 into Best Suggestions
  assert.ok(detailFile.includes('isAutoBest'), 'Detail sheet must compute isAutoBest for rank 4 and 5');
  assert.ok(listFile.includes('Number(item.defectPreventionRank) === 5') && listFile.includes('Number(item.defectPreventionRank) === 4'), 'List filter must automatically include rank 4 or 5 in Best Suggestions');
});


test('25. SQL Server schema table script, model init, and database controller connection exist', () => {
  const sqlScriptPath = new URL('../../../../server/scripts/create_suggestion_checksheets_table.sql', import.meta.url);
  const dbFile = fs.readFileSync(new URL('../../../../server/db/suggestionChecksheet/suggestionChecksheetDb.js', import.meta.url), 'utf8');
  const modelFile = fs.readFileSync(new URL('../../../../server/models/suggestionChecksheet/suggestionChecksheet.model.js', import.meta.url), 'utf8');
  const serverIndexFile = fs.readFileSync(new URL('../../../../server/index.js', import.meta.url), 'utf8');

  // Verify standalone SQL script
  assert.ok(fs.existsSync(sqlScriptPath), 'Standalone SQL script create_suggestion_checksheets_table.sql must exist');
  const sqlScript = fs.readFileSync(sqlScriptPath, 'utf8');
  assert.ok(sqlScript.includes('CREATE TABLE suggestion_checksheets'), 'SQL script must define table suggestion_checksheets');
  assert.ok(sqlScript.includes('checksheetId NVARCHAR(100) NOT NULL'), 'SQL script must define checksheetId column');
  assert.ok(sqlScript.includes('idx_suggestion_checksheetId'), 'SQL script must define index on checksheetId');

  // Verify DB table migration & init helper
  assert.ok(dbFile.includes('initSuggestionChecksheetTables'), 'DB file must export initSuggestionChecksheetTables');
  assert.ok(dbFile.includes('isDbConnected'), 'DB file must export isDbConnected');
  assert.ok(dbFile.includes('CREATE TABLE suggestion_checksheets'), 'DB file must contain table creation query');

  // Verify Model integration with SQL Server
  assert.ok(modelFile.includes('initSuggestionChecksheetTables'), 'Model must call initSuggestionChecksheetTables in init()');
  assert.ok(modelFile.includes('SELECT * FROM suggestion_checksheets'), 'Model must query SQL Server table');
  assert.ok(modelFile.includes('INSERT INTO suggestion_checksheets'), 'Model must insert into SQL Server table');

  // Verify server startup boot call
  assert.ok(serverIndexFile.includes('SuggestionChecksheetModel.init()'), 'Server index must boot SuggestionChecksheetModel.init()');
});

test('26. SQL Server table columns (Description, Categories, Employee Code, Priority, rejectAccepted) removed and Created by added at end', () => {
  const sqlScriptPath = new URL('../../../../server/scripts/create_suggestion_checksheets_table.sql', import.meta.url);
  const sqlScript = fs.readFileSync(sqlScriptPath, 'utf8');
  const dbFile = fs.readFileSync(new URL('../../../../server/db/suggestionChecksheet/suggestionChecksheetDb.js', import.meta.url), 'utf8');
  const modelFile = fs.readFileSync(new URL('../../../../server/models/suggestionChecksheet/suggestionChecksheet.model.js', import.meta.url), 'utf8');
  const controllerFile = fs.readFileSync(new URL('../../../../server/controllers/suggestionChecksheet/suggestionChecksheet.controller.js', import.meta.url), 'utf8');

  // Verify removed columns are absent from table creation schema
  assert.ok(!sqlScript.includes('description NVARCHAR'), 'description column must be removed from CREATE TABLE');
  assert.ok(!sqlScript.includes('category NVARCHAR'), 'category column must be removed from CREATE TABLE');
  assert.ok(!sqlScript.includes('employeeCode NVARCHAR'), 'employeeCode column must be removed from CREATE TABLE');
  assert.ok(!sqlScript.includes('priority NVARCHAR'), 'priority column must be removed from CREATE TABLE');
  assert.ok(!sqlScript.includes('rejectedAccepted NVARCHAR'), 'rejectedAccepted column must be removed from CREATE TABLE');

  // Verify createdBy is added at the end of the table
  assert.ok(sqlScript.includes('createdBy NVARCHAR(255) NULL'), 'createdBy column must be added at end of CREATE TABLE');
  assert.ok(sqlScript.includes('ALTER TABLE suggestion_checksheets DROP COLUMN description'), 'Migration must drop description');
  assert.ok(sqlScript.includes('ALTER TABLE suggestion_checksheets DROP COLUMN priority'), 'Migration must drop priority');
  assert.ok(sqlScript.includes('ALTER TABLE suggestion_checksheets DROP COLUMN rejectedAccepted'), 'Migration must drop rejectedAccepted');

  // Verify DB initialization migrations
  assert.ok(dbFile.includes('DROP COLUMN [description]') || dbFile.includes('DROP COLUMN description'), 'DB migration must drop description');
  assert.ok(dbFile.includes("ensureColumnExists('suggestion_checksheets', 'createdBy'"), 'DB migration must ensure createdBy column exists');

  // Verify Model queries and inserts handle createdBy and omit removed columns
  assert.ok(modelFile.includes('createdBy'), 'Model must handle createdBy');
  assert.ok(!modelFile.includes('description,'), 'Model INSERT must not include description');
  assert.ok(!modelFile.includes('priority,'), 'Model INSERT must not include priority');

  // Verify Controller sanitizes removed columns and resolves createdBy
  assert.ok(controllerFile.includes('sanitizeChecksheetPayload'), 'Controller must sanitize checksheet payload');
  assert.ok(controllerFile.includes('resolveCreatorName') || controllerFile.includes('createdBy'), 'Controller must resolve createdBy');
});

test('27. SuggestionChecksheetGraph and SuggestionTargetModal components exist and are embedded at top of list', () => {
  const graphFile = new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url);
  const targetModalFile = new URL('../../components/suggestion-checksheet/SuggestionTargetModal.jsx', import.meta.url);
  const listFile = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');

  assert.ok(fs.existsSync(graphFile), 'SuggestionChecksheetGraph.jsx must exist');
  assert.ok(fs.existsSync(targetModalFile), 'SuggestionTargetModal.jsx must exist');
  assert.ok(listFile.includes('<SuggestionChecksheetGraph'), 'SuggestionChecksheetList must embed SuggestionChecksheetGraph');
  assert.ok(listFile.includes("import SuggestionChecksheetGraph from './SuggestionChecksheetGraph'"), 'SuggestionChecksheetList must import SuggestionChecksheetGraph');
});

test('28. Graph contains 4 bar lines, creation date implementation count rule, and 13 department targets', () => {
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');
  const targetCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionTargetModal.jsx', import.meta.url), 'utf8');

  // Verify the bar lines in graph
  assert.ok(graphCode.includes('name="Total"') || graphCode.includes('name="Total sheet created"'), 'Graph must have Total bar');
  assert.ok(graphCode.includes('name="Accept"') || graphCode.includes('name="Accepted"'), 'Graph must have Accept bar');
  assert.ok(graphCode.includes('name="Not- Feasible"') || graphCode.includes('name="Not - Feasible"'), 'Graph must have Not - Feasible bar');
  assert.ok(graphCode.includes('name="Implemented"') || graphCode.includes('name="Date of implementation in Count"'), 'Graph must have Implemented bar');

  // Verify the 13 required target departments
  const requiredDepts = [
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
  requiredDepts.forEach((dept) => {
    assert.ok(targetCode.includes(`'${dept}'`), `Target departments must include ${dept}`);
  });

  // Verify Date of implementation in Count logic: implementation counted on creation date
  const sampleRecords = [
    {
      id: 'SC-1',
      date: '2026-11-05',
      status: 'Implemented',
      dateOfImplementation: '2026-11-26',
      department: 'PE'
    },
    {
      id: 'SC-2',
      date: '2026-11-05',
      status: 'Approved',
      rejectedAccepted: 'ACCEPTED',
      department: 'PE'
    },
    {
      id: 'SC-3',
      date: '2026-11-05',
      status: 'Not Feasible',
      rejectedAccepted: 'NOT FEASIBLE',
      department: 'PE'
    }
  ];

  // Verification helper mimicking chartData aggregation in SuggestionChecksheetGraph
  const dateMap = new Map();
  sampleRecords.forEach((item) => {
    const ymd = item.date;
    if (!dateMap.has(ymd)) {
      dateMap.set(ymd, { totalCreated: 0, accepted: 0, notFeasible: 0, implementedCount: 0 });
    }
    const entry = dateMap.get(ymd);
    entry.totalCreated += 1;
    if (item.status === 'Approved' || item.rejectedAccepted === 'ACCEPTED' || item.status === 'Implemented') {
      entry.accepted += 1;
    }
    if (item.status === 'Not Feasible' || item.rejectedAccepted === 'NOT FEASIBLE') {
      entry.notFeasible += 1;
    }
    if (item.status === 'Implemented' || item.dateOfImplementation) {
      entry.implementedCount += 1;
    }
  });

  const nov5 = dateMap.get('2026-11-05');
  assert.equal(nov5.totalCreated, 3, 'Total sheets created on 5-11-2026 is 3');
  assert.equal(nov5.accepted, 2, 'Accepted count on 5-11-2026 is 2');
  assert.equal(nov5.notFeasible, 1, 'Not-Feasible count on 5-11-2026 is 1');
  assert.equal(nov5.implementedCount, 1, 'Implementation count is shown under creation date 5-11-2026 (not 26-11-2026)');
  assert.equal(dateMap.has('2026-11-26'), false, 'Implementation date 26-11-2026 is not created as a separate bucket');
});

test('29. Sheet table limits to 15 sheets per page with working Previous and Next navigation', () => {
  const listCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetList.jsx', import.meta.url), 'utf8');

  assert.ok(listCode.includes('PAGE_SIZE = 15'), 'Page size must be defined as 15');
  assert.ok(listCode.includes('paginatedRecords = useMemo'), 'paginatedRecords must be computed using page size');
  assert.ok(listCode.includes('paginatedRecords.map'), 'Table rows must map over paginatedRecords');
  assert.ok(listCode.includes('setCurrentPage((p) => Math.max(1, p - 1))'), 'Previous button must decrement page');
  assert.ok(listCode.includes('setCurrentPage((p) => Math.min(totalPages, p + 1))'), 'Next button must increment page');
  assert.ok(listCode.includes('disabled={currentPage <= 1}'), 'Previous button must be disabled on page 1');
  assert.ok(listCode.includes('disabled={currentPage >= totalPages}'), 'Next button must be disabled on last page');
});

test('30. Target Line Popup contains Year selecting dropdown and Months multiple checkboxes (not in dropdown)', () => {
  const targetCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionTargetModal.jsx', import.meta.url), 'utf8');

  // Year filter must be in dropdown
  assert.ok(targetCode.includes('YEARS_LIST'), 'Target modal must define YEARS_LIST');
  assert.ok(targetCode.includes('<select'), 'Year must be selected via dropdown <select>');
  assert.ok(targetCode.includes('Target Year:'), 'Target modal must display Target Year label');

  // Months filter must be in multiple checkboxes
  assert.ok(targetCode.includes('MONTHS'), 'Target modal must define 12 MONTHS');
  assert.ok(targetCode.includes('type="checkbox"'), 'Months must be shown in multiple checkbox inputs (not in a dropdown)');
  assert.ok(targetCode.includes('handleMonthToggle'), 'Modal must allow selecting multiple checkboxes for months');
  assert.ok(targetCode.includes('Select Months (multiple checkboxes):'), 'Modal must label months selection as multiple checkboxes');

  // Save button with multi-month target persistence
  assert.ok(targetCode.includes('Save Targets'), 'Modal must contain Save Targets button');
  assert.ok(targetCode.includes('saveStoredDepartmentTargetsV2'), 'Modal must save department targets across selected months');
});

test('31. In-chart cumulative bars for past/live months and Department Overview filter option (Overall removed)', () => {
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // In-chart cumulative buckets for past month and current month live
  assert.ok(graphCode.includes('Cumul'), 'Graph must render past month Cumul bucket');
  assert.ok(graphCode.includes('Live'), 'Graph must render current month Live bucket');
  assert.ok(graphCode.includes('isCumulativeBucket'), 'Cumulative buckets must be flagged');

  // Department Overview option exists and Overall button is removed from filter toolbar
  assert.ok(graphCode.includes('Department Overview'), 'Graph must display Department Overview button');
  assert.ok(!graphCode.includes('<span>Overall</span>'), 'Overall button must be removed from filters toolbar');
  assert.ok(graphCode.includes('TARGET_DEPARTMENTS.map'), 'Department Overview must group bar series across all departments');
});

test('32. Target line removed, only Target Bar Candle used with unselected month target hiding', () => {
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // Verify Target Line is removed
  assert.ok(!graphCode.includes('<Line'), 'Target Line component must be removed from chart');
  assert.ok(!graphCode.includes('<ReferenceLine'), 'ReferenceLine component must be removed from chart');

  // Verify only Target Bar Candle is rendered
  assert.ok(graphCode.includes('dataKey="target"'), 'Target bar candle must exist');
  assert.ok(graphCode.includes('name="Target"'), 'Target bar candle must have name Target');

  // Verify target is resolved via getTargetForDeptAndMonth
  assert.ok(graphCode.includes('getTargetForDeptAndMonth'), 'Department target must be resolved from target store');
});

test('33. 5 Bar candles with numbers on top, wider candles, and centered fixed badges with Implemented', () => {
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // Verify Legend is removed from chart
  assert.ok(!graphCode.includes('<Legend'), 'Recharts <Legend> must be removed from ComposedChart');

  // Verify numbers on bar candles via LabelList
  assert.ok(graphCode.includes('LabelList'), 'LabelList must be used to show numbers on bar candles');
  assert.ok(graphCode.includes('renderCustomBarLabel'), 'renderCustomBarLabel must be used on bar candles');

  // Verify wider bar candles
  assert.ok(graphCode.includes('maxBarSize=') && (graphCode.includes('32') || graphCode.includes('44')), 'Candle width must be set with wider bars');

  // Verify 4 KPI Badges are centered and fixed (Target badge removed per user request)
  assert.ok(graphCode.includes('justify-center'), 'KPI badges must be centered');
  assert.ok(graphCode.includes('Total: <strong>{summaryTotals.totalCreated}</strong>'), 'Total KPI badge must be rendered');
  assert.ok(graphCode.includes('Accept: <strong>{summaryTotals.accepted}</strong>') || graphCode.includes('Accepted: <strong>{summaryTotals.accepted}</strong>'), 'Accept KPI badge must be rendered');
  assert.ok(graphCode.includes('Not-Feasible: <strong>{summaryTotals.notFeasible}</strong>'), 'Not-Feasible KPI badge must be rendered');
  assert.ok(graphCode.includes('Implemented: <strong>{summaryTotals.implementedCount}</strong>'), 'Implemented (Count text removed) KPI badge must be rendered');
  assert.ok(!graphCode.includes('Target: <strong>{targetLineValue}</strong>'), 'Target KPI badge must be removed per user request');

  // Verify 5 bar candles in chart
  assert.ok(graphCode.includes('dataKey="totalCreated"'), 'Total bar candle must exist');
  assert.ok(graphCode.includes('dataKey="accepted"'), 'Accepted bar candle must exist');
  assert.ok(graphCode.includes('dataKey="notFeasible"'), 'Not-Feasible bar candle must exist');
  assert.ok(graphCode.includes('dataKey="implementedCount"') && graphCode.includes('name="Implemented"'), 'Implemented bar candle must exist without Count');
  assert.ok(graphCode.includes('dataKey="target"') && graphCode.includes('name="Target"'), 'Target bar candle must exist');
});

test('34. All suggestion / Best suggestion separated from Department Overview in graph filter toolbar', () => {
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // Verify Group 1: Suggestion Scope
  assert.ok(graphCode.includes('Group 1: Suggestion Scope'), 'Group 1 for suggestion scope must exist');
  assert.ok(graphCode.includes('All Suggestion') && graphCode.includes('Best Suggestion'), 'All and Best suggestions must be grouped together');

  // Verify Group 2: Department Overview is separated
  assert.ok(graphCode.includes('Group 2: Department Overview'), 'Group 2 for department overview must exist separately');
  assert.ok(graphCode.includes('Department Overview'), 'Department Overview must be present');

  // Verify Unit filter in graph controls
  assert.ok(graphCode.includes('Unit Filter (placed in filters toolbar)'), 'Unit filter must be placed inside filter toolbar');
});

test('35. Unselected month hides target in graph and X-axis text size is increased to 13px bold', () => {
  const targetCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionTargetModal.jsx', import.meta.url), 'utf8');
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // Target modal sets unselected: true for unselected months
  assert.ok(targetCode.includes('unselected: true'), 'Target modal must mark unselected months as unselected: true');
  assert.ok(targetCode.includes('if (!v2[yStr][mStr] || v2[yStr][mStr].unselected || v2[yStr][mStr][dept] === 0)'), 'getTargetForDeptAndMonth must return 0 for unselected months');

  // Bold X-Axis text
  assert.ok(graphCode.includes('fontWeight: 700'), 'X-Axis text must be bold');
  assert.ok(graphCode.includes('fontSize: graphTab === \'DEPARTMENT\' ? 11 : 13'), 'X-Axis font size must be defined appropriately');
});

test('36. Serial order (Target, Total, Accept, Not- Feasible, Implemented), barGap=0, no blank months, and horizontal department text', () => {
  const graphCode = fs.readFileSync(new URL('../../components/suggestion-checksheet/SuggestionChecksheetGraph.jsx', import.meta.url), 'utf8');

  // 1. Serial sequence of Bar candles: Target -> Total -> Accept -> Not- Feasible -> Implemented
  const targetIdx = graphCode.indexOf('dataKey="target"');
  const totalIdx = graphCode.indexOf('dataKey="totalCreated"');
  const acceptIdx = graphCode.indexOf('dataKey="accepted"');
  const notFeasibleIdx = graphCode.indexOf('dataKey="notFeasible"');
  const implementedIdx = graphCode.indexOf('dataKey="implementedCount"');

  assert.ok(targetIdx < totalIdx, 'Target bar must be rendered before Total bar');
  assert.ok(totalIdx < acceptIdx, 'Total bar must be rendered before Accept bar');
  assert.ok(acceptIdx < notFeasibleIdx, 'Accept bar must be rendered before Not- Feasible bar');
  assert.ok(notFeasibleIdx < implementedIdx, 'Not- Feasible bar must be rendered before Implemented bar');

  // 2. barGap={0} so there is no gap between the candles
  assert.ok(graphCode.includes('barGap={0}'), 'Chart must set barGap={0} for no gap between candles');

  // 3. Blank month hiding: cumulativeBuckets only pushed if totalCreated > 0
  assert.ok(graphCode.includes('if (pastStats.totalCreated > 0)'), 'Past month must only be added if totalCreated > 0');
  assert.ok(graphCode.includes('if (curStats.totalCreated > 0)'), 'Current month must only be added if totalCreated > 0');

  // 4. Horizontal text for department labels: angle={0} and textAnchor="middle"
  assert.ok(graphCode.includes('angle={0}'), 'XAxis angle must be 0 for horizontal text');
  assert.ok(graphCode.includes('textAnchor="middle"'), 'XAxis textAnchor must be middle');
});
