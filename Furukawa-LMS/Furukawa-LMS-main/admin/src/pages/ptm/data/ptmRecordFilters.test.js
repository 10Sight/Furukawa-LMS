import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PTM_VALID_UNITS,
  PTM_STATUS_OPTIONS,
  PTM_PHASE_OPTIONS,
  normalizePtmStatus,
  normalizeDateToYMD,
  getFormattedCurrentDate,
  getRowRevisions,
  evaluatePtmRowStatus,
  doesPtmRowBelongToDepartment,
  doesPtmRowBelongToUser,
  isPtmRowDone,
  isActivePtmRow,
  classifyPTMSheetStatus,
  getPTMVisibleSheets,
  filterPTMRecordsBySection,
  getPTMSectionCounts
} from './ptmRecordFilters.js';

test('1. PTM Plant Dropdown options: Bawal, Gujrat, All, default is Bawal inside Plant tab', () => {
  assert.deepEqual(PTM_VALID_UNITS, ['Bawal', 'Gujrat', 'All']);

  const tabNavPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTabNavigation.jsx');
  const tabNavContent = fs.readFileSync(tabNavPath, 'utf8');

  // Verify dropdown button is embedded in the Plant tab
  assert.match(tabNavContent, /ptm-plant-tab-button/);
  assert.match(tabNavContent, /Plant:/);
  assert.match(tabNavContent, /'Bawal'/);
  assert.match(tabNavContent, /'Gujrat'/);
  assert.match(tabNavContent, /'All'/);

  // Verify standalone top-left dropdown is removed from App.jsx
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.doesNotMatch(appContent, /ptm-plant-dropdown-button/);
});

test('2. PTM Page Structure: Plant, Department, Self PTM only (No CFT)', () => {
  const tabNavPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTabNavigation.jsx');
  const tabNavContent = fs.readFileSync(tabNavPath, 'utf8');

  assert.match(tabNavContent, /label:\s*'Plant'/);
  assert.match(tabNavContent, /label:\s*'Department'/);
  assert.match(tabNavContent, /label:\s*'Self PTM'/);
  // Must NOT contain CFT
  assert.doesNotMatch(tabNavContent, /CFT/);
});

test('3. Ongoing & Done sections in PTM with NO sub-filter bar', () => {
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert.match(appContent, /setActivePtmSection\('Ongoing'\)/);
  assert.match(appContent, /setActivePtmSection\('Done'\)/);
  assert.match(appContent, /ptmSectionCounts\.Ongoing/);
  assert.match(appContent, /ptmSectionCounts\.Done/);

  // Must NOT contain the sub-filter bar (All Ongoing, Not-Started, In-Progress, Delay sub-buttons)
  assert.doesNotMatch(appContent, /Ongoing Status:/);
  assert.doesNotMatch(appContent, /All Ongoing \(/);
});

test('4. PDCA Page: Ongoing Status sub-filter bar is removed from all pages', () => {
  const pdcaPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/pdca/pages/DashboardPage.jsx');
  const pdcaContent = fs.readFileSync(pdcaPath, 'utf8');

  assert.doesNotMatch(pdcaContent, /Ongoing Status:/);
  assert.doesNotMatch(pdcaContent, /All Ongoing \(/);
  assert.match(pdcaContent, /setActiveSection\('Ongoing'\)/);
  assert.match(pdcaContent, /setActiveSection\('Done'\)/);
});

test('5. PDCA Page: Plant tab is a dropdown with options Bawal, Gujrat, All (default Bawal)', () => {
  const tabNavPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/pdca/TabNavigation.jsx');
  const tabNavContent = fs.readFileSync(tabNavPath, 'utf8');

  // Verify dropdown button is embedded in the Plant tab
  assert.match(tabNavContent, /pdca-plant-tab-button/);
  assert.match(tabNavContent, /Plant:/);
  assert.match(tabNavContent, /'Bawal'/);
  assert.match(tabNavContent, /'Gujrat'/);
  assert.match(tabNavContent, /'All'/);

  // Verify standalone top-left dropdown is removed from FilterToolbar.jsx
  const filterToolbarPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/pdca/FilterToolbar.jsx');
  const ftContent = fs.readFileSync(filterToolbarPath, 'utf8');
  assert.doesNotMatch(ftContent, /plant-dropdown-button/);
});

test('6. PTM Department-wise Sheet Visibility & Independent Completion', () => {
  // Plant sheet containing points for Quality (Done), PE (In-Progress), and PPC (Open)
  const multiDeptSheet = {
    id: 'PTM-BW-MULTI-01',
    topic: 'New Line Setup',
    plant: 'Bawal',
    scope: 'Company',
    department: '',
    sheet: {
      rows: [
        {
          activity: 'Quality check for fixture',
          departments: { Quality: 'owner', PE: '', PPC: '' },
          status: 'Done'
        },
        {
          activity: 'Process engineering validation',
          departments: { Quality: '', PE: 'owner', PPC: '' },
          status: 'In-Progress'
        },
        {
          activity: 'Production planning schedule',
          departments: { Quality: '', PE: '', PPC: 'owner' },
          status: 'Open'
        }
      ]
    }
  };

  const qualityUser = { name: 'Ramesh', code: 'EMP-Q1', department: 'Quality' };
  const peUser = { name: 'Vikram', code: 'EMP-PE1', department: 'PE' };

  // 1. Quality user sees this sheet under Department tab because it contains Quality points
  const qualityVisible = getPTMVisibleSheets([multiDeptSheet], 'Bawal', 'Department', { currentUser: qualityUser });
  assert.equal(qualityVisible.length, 1);
  assert.equal(qualityVisible[0].id, 'PTM-BW-MULTI-01');

  // 2. For Quality, all Quality points are Done -> Sheet status is Done
  const qualityStatus = classifyPTMSheetStatus(multiDeptSheet, 'Department', { currentUser: qualityUser });
  assert.equal(qualityStatus.section, 'Done', 'Quality department should see the sheet as Done independently');

  // 3. For PE, PE points are In-Progress -> Sheet status is Ongoing
  const peStatus = classifyPTMSheetStatus(multiDeptSheet, 'Department', { currentUser: peUser });
  assert.equal(peStatus.section, 'Ongoing', 'PE department should see the sheet as Ongoing independently');

  // 4. In Plant scope, sheet has open points -> Sheet is Ongoing
  const plantStatus = classifyPTMSheetStatus(multiDeptSheet, 'Company');
  assert.equal(plantStatus.section, 'Ongoing', 'Plant scope should see the sheet as Ongoing until all points are done');
});

test('7. PTM Self PTM Visibility & Independent Completion', () => {
  const user1 = { name: 'Joy Dastidar', code: 'ST080014' };
  const user2 = { name: 'Deepak Chauhan', code: 'DC002' };

  const sheetWithPoints = {
    id: 'PTM-BW-SELF-01',
    topic: 'ECU Harness Verification',
    plant: 'Bawal',
    scope: 'Company',
    sheet: {
      rows: [
        {
          activity: 'Design verification',
          staff: 'Joy Dastidar (ST080014)',
          staffCode: 'ST080014',
          status: 'Done'
        },
        {
          activity: 'Testing verification',
          staff: 'Deepak Chauhan (DC002)',
          staffCode: 'DC002',
          status: 'In-Progress'
        }
      ]
    }
  };

  // 1. Both users see the sheet in Self PTM because they have assigned points
  const user1Visible = getPTMVisibleSheets([sheetWithPoints], 'Bawal', 'Self PTM', { currentUser: user1 });
  const user2Visible = getPTMVisibleSheets([sheetWithPoints], 'Bawal', 'Self PTM', { currentUser: user2 });
  assert.equal(user1Visible.length, 1);
  assert.equal(user2Visible.length, 1);

  // 2. User 1 completed all their assigned points -> Sheet is Done for User 1
  const user1Status = classifyPTMSheetStatus(sheetWithPoints, 'Self PTM', { currentUser: user1 });
  assert.equal(user1Status.section, 'Done', 'User 1 should see the sheet in Done section independently');

  // 3. User 2 has In-Progress points -> Sheet is Ongoing for User 2
  const user2Status = classifyPTMSheetStatus(sheetWithPoints, 'Self PTM', { currentUser: user2 });
  assert.equal(user2Status.section, 'Ongoing', 'User 2 should see the sheet in Ongoing section independently');
});

test('8. PDCA Page: Calendar filter is positioned in green marked place alongside TabNavigation', () => {
  const pdcaPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/pdca/pages/DashboardPage.jsx');
  const pdcaContent = fs.readFileSync(pdcaPath, 'utf8');

  // Verify pdca-date-filter-bar is present
  assert.match(pdcaContent, /id="pdca-date-filter-bar"/);
  assert.match(pdcaContent, /From Date/);
  assert.match(pdcaContent, /To Date/);
  assert.match(pdcaContent, /Clear dates/);

  // Verify it is positioned alongside TabNavigation in the same flex row
  const tabNavIndex = pdcaContent.indexOf('<TabNavigation');
  const dateFilterIndex = pdcaContent.indexOf('id="pdca-date-filter-bar"');
  assert.ok(tabNavIndex > 0 && dateFilterIndex > 0, 'Both TabNavigation and Date Filter bar must be present');
  assert.ok(dateFilterIndex > tabNavIndex, 'Date Filter bar must be placed after TabNavigation on the tab row');
});

test('9. PTM Page: Calendar filter is added in green marked place alongside PTMTabNavigation with date range filtering', () => {
  const ptmPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const ptmContent = fs.readFileSync(ptmPath, 'utf8');

  // Verify ptm-date-filter-bar is present
  assert.match(ptmContent, /id="ptm-date-filter-bar"/);
  assert.match(ptmContent, /From Date/);
  assert.match(ptmContent, /To Date/);
  assert.match(ptmContent, /Clear dates/);

  // Verify it is placed after PTMTabNavigation in the same flex container
  const tabNavIndex = ptmContent.indexOf('<PTMTabNavigation');
  const dateFilterIndex = ptmContent.indexOf('id="ptm-date-filter-bar"');
  assert.ok(tabNavIndex > 0 && dateFilterIndex > 0, 'Both PTMTabNavigation and Date Filter bar must be present');
  assert.ok(dateFilterIndex > tabNavIndex, 'Date Filter bar must be placed after PTMTabNavigation on the tab row');

  // Verify date range filtering in getPTMVisibleSheets
  const items = [
    { id: '1', date: '10 Sep 2026', topic: 'Early Sept', plant: 'Bawal', scope: 'Company' },
    { id: '2', date: '25 Sep 2026', topic: 'Late Sept', plant: 'Bawal', scope: 'Company' },
    { id: '3', date: '15 Oct 2026', topic: 'Mid Oct', plant: 'Bawal', scope: 'Company' }
  ];

  const septOnly = getPTMVisibleSheets(items, 'Bawal', 'Company', { fromDate: '2026-09-01', toDate: '2026-09-30' });
  assert.equal(septOnly.length, 2);
  assert.equal(septOnly[0].id, '1');
  assert.equal(septOnly[1].id, '2');

  const octOnly = getPTMVisibleSheets(items, 'Bawal', 'Company', { fromDate: '2026-10-01', toDate: '2026-10-31' });
  assert.equal(octOnly.length, 1);
  assert.equal(octOnly[0].id, '3');
});

test('10. PTM Sheet: Responsible Person section added immediately before Status column with Unit, Dept, and Staff Name *', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Verify colgroup was updated to span 36 (including Rank S)
  assert.match(tableContent, /<col span=\{36\} \/>/);

  // Verify header has Responsible Person with colSpan={3}
  assert.match(tableContent, /Responsible Person/);
  assert.match(tableContent, /colSpan=\{3\}[^>]*>[\s\S]*?Responsible Person/);

  // Verify header row 2 contains Unit, Dept, and Staff Name *
  assert.match(tableContent, /<th[^>]*>\s*Unit\s*<\/th>/);
  assert.match(tableContent, /<th[^>]*>\s*Dept\s*<\/th>/);
  assert.match(tableContent, /<span>Staff Name<\/span>\s*<span className="text-red-500 font-bold">\*<\/span>/);

  // Verify placement: Action Taken Against Failure is immediately before Responsible Person, which is immediately before Status
  const actionTakenIdx = tableContent.indexOf('Action Taken Against Failure');
  const respHeaderIdx = tableContent.indexOf('Responsible Person', actionTakenIdx);
  const statusIdx = tableContent.indexOf('Status', respHeaderIdx);
  assert.ok(actionTakenIdx > 0, 'Action Taken Against Failure column must exist');
  assert.ok(respHeaderIdx > actionTakenIdx, 'Responsible Person must be after Action Taken Against Failure');
  assert.ok(statusIdx > respHeaderIdx, 'Status must be after Responsible Person');

  // In tbody, verify Responsible Person is placed between actionTaken and status
  const tbodyActionTakenIdx = tableContent.indexOf('data-col="actionTaken"');
  const tbodyRespIdx = tableContent.indexOf('getResponsiblePersonStructure(row)', tbodyActionTakenIdx);
  const tbodyStatusIdx = tableContent.indexOf('normalizePtmStatus(row.status', tbodyRespIdx);
  assert.ok(tbodyActionTakenIdx > 0, 'tbody actionTaken cell must exist');
  assert.ok(tbodyRespIdx > tbodyActionTakenIdx, 'tbody Responsible Person must be after actionTaken');
  assert.ok(tbodyStatusIdx > tbodyRespIdx, 'tbody Status must be after Responsible Person');
});

test('11. PTM Sheet: Responsible Person 2-part horizontal division when both units (Bawal & Gujrat) selected', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Verify units.length > 1 triggers colSpan={3} with vertical flex column and horizontal divide line
  assert.match(tableContent, /units\.length > 1/);
  assert.match(tableContent, /colSpan=\{3\}/);
  assert.match(tableContent, /divide-y divide-\[#CBD5E1\]/);
  assert.match(tableContent, /divide-x divide-\[#CBD5E1\]/);

  // Verify Bawal and Gujrat options in PDCA_UNITS
  assert.match(tableContent, /PDCA_UNITS/);
  assert.match(tableContent, /getDepartmentsForUnit/);

  // Verify AddStaffEmployeeModal integration
  assert.match(tableContent, /<AddStaffEmployeeModal/);
  assert.match(tableContent, /handleOpenAddStaffModal/);
  assert.match(tableContent, /handleSaveDepartmentStaff/);
  assert.match(tableContent, /handleRemoveDepartmentEmployee/);
  assert.match(tableContent, /openStaffDropdown/);
  assert.match(tableContent, /staff-dropdown-menu/);
});

test('12. PTM CSV Export includes Responsible Unit, Responsible Dept, and Responsible Staff Name immediately before Status', () => {
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  // Verify headers order in handleExportMatrixCSV
  const actionTakenHeaderIdx = appContent.indexOf('\'Action Taken Against Failure\',');
  const respUnitHeaderIdx = appContent.indexOf('\'Responsible Unit\',', actionTakenHeaderIdx);
  const respDeptHeaderIdx = appContent.indexOf('\'Responsible Dept\',', respUnitHeaderIdx);
  const respStaffHeaderIdx = appContent.indexOf('\'Responsible Staff Name\',', respDeptHeaderIdx);
  const statusHeaderIdx = appContent.indexOf('\'Status\',', respStaffHeaderIdx);

  assert.ok(actionTakenHeaderIdx > 0, 'Action Taken header must exist');
  assert.ok(respUnitHeaderIdx > actionTakenHeaderIdx, 'Responsible Unit must be after Action Taken');
  assert.ok(respDeptHeaderIdx > respUnitHeaderIdx, 'Responsible Dept must be after Responsible Unit');
  assert.ok(respStaffHeaderIdx > respDeptHeaderIdx, 'Responsible Staff Name must be after Responsible Dept');
  assert.ok(statusHeaderIdx > respStaffHeaderIdx, 'Status must be after Responsible Staff Name');
});

test('13. PTM Status Options and Color mapping: Not-Started (Blue), In-Progress (Yellow), Done (Green), Delay (Red)', () => {
  const options = PTM_STATUS_OPTIONS;
  assert.equal(options.length, 4);

  const notStarted = options.find((o) => o.value === 'Not-Started');
  assert.ok(notStarted, 'Not-Started option exists');
  assert.match(notStarted.color, /blue/i);

  const inProgress = options.find((o) => o.value === 'In-Progress');
  assert.ok(inProgress, 'In-Progress option exists');
  assert.match(inProgress.color, /yellow/i);

  const done = options.find((o) => o.value === 'Done');
  assert.ok(done, 'Done option exists');
  assert.match(done.color, /emerald|green/i);

  const delay = options.find((o) => o.value === 'Delay');
  assert.ok(delay, 'Delay option exists');
  assert.match(delay.color, /rose|red/i);

  // Normalization of legacy values
  assert.equal(normalizePtmStatus('Open'), 'Not-Started');
  assert.equal(normalizePtmStatus('In Progress'), 'In-Progress');
  assert.equal(normalizePtmStatus('Closed'), 'Done');
  assert.equal(normalizePtmStatus('Delay'), 'Delay');
  assert.equal(normalizePtmStatus('Done'), 'Done');
  assert.equal(normalizePtmStatus('Not-Started'), 'Not-Started');
});

test('14. PTM Status Column is frozen (view-only select, cannot be changed manually)', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Verify select is disabled and pointer-events-none / cursor-default
  assert.match(tableContent, /<select\s+disabled/);
  assert.match(tableContent, /pointer-events-none cursor-default select-none/);
  assert.match(tableContent, /PTM_STATUS_OPTIONS\.map/);
});

test('15. PTM End Date (Plan) is marked Mandatory with asterisk *', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Header must contain End Date (Plan) with red asterisk
  assert.match(tableContent, /End Date \(Plan\)\s*<span className="text-red-500 font-bold">\*<\/span>/);

  // App.jsx save validation verifies mandatory End Date (Plan)
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.match(appContent, /End Date \(Plan\) is mandatory/);
  assert.match(appContent, /Reason of Failure is mandatory when status is Delay \/ MISS/);
});

test('16. Automated Lifecycle Logic: Date evaluation state machine', () => {
  const fixedToday = new Date('2026-11-13T12:00:00Z');

  // Case 1: Start Date (Actual) entered, End Date Plan in future -> Not-Started, HIT/MISS is blank
  const row1 = {
    startDateActual: '10-11-26',
    endDatePlan: '20-11-26',
    endDateActual: '',
    revisedDate: '',
    status: 'Not-Started',
    hitMiss: ''
  };
  const res1 = evaluatePtmRowStatus(row1, fixedToday);
  assert.equal(res1.status, 'Not-Started');
  assert.equal(res1.hitMiss, '');

  // Case 2: End Date (Plan) missed (deadline was 10-11-26, today is 13-11-26) without completion -> Delay, MISS
  const row2 = {
    startDateActual: '01-11-26',
    endDatePlan: '10-11-26',
    endDateActual: '',
    revisedDate: '',
    status: 'Not-Started',
    hitMiss: ''
  };
  const res2 = evaluatePtmRowStatus(row2, fixedToday);
  assert.equal(res2.status, 'Delay');
  assert.equal(res2.hitMiss, 'MISS');

  // Case 3: User fills Revised Date (e.g. 25-11-26) -> In-Progress, HIT/MISS blank
  const row3 = {
    startDateActual: '01-11-26',
    endDatePlan: '10-11-26',
    revisedDate: '25-11-26',
    endDateActual: '',
    status: 'Delay',
    hitMiss: 'MISS'
  };
  const res3 = evaluatePtmRowStatus(row3, fixedToday);
  assert.equal(res3.status, 'In-Progress');
  assert.equal(res3.hitMiss, '');

  // Case 4: User completes work before or on target date (e.g. 24-11-26 <= 25-11-26) -> Done, HIT
  const row4 = {
    startDateActual: '01-11-26',
    endDatePlan: '10-11-26',
    revisedDate: '25-11-26',
    endDateActual: '24-11-26',
    status: 'In-Progress',
    hitMiss: ''
  };
  const res4 = evaluatePtmRowStatus(row4, fixedToday);
  assert.equal(res4.status, 'Done');
  assert.equal(res4.hitMiss, 'HIT');

  // Case 5: User misses the revised date (e.g. endDateActual is 26-11-26 > 25-11-26) -> Delay, MISS
  const row5 = {
    startDateActual: '01-11-26',
    endDatePlan: '10-11-26',
    revisedDate: '25-11-26',
    endDateActual: '26-11-26',
    status: 'In-Progress',
    hitMiss: ''
  };
  const res5 = evaluatePtmRowStatus(row5, fixedToday);
  assert.equal(res5.status, 'Delay');
  assert.equal(res5.hitMiss, 'MISS');
});

test('17. No. of Times Revised format: serial number with date "1) 13-11-26"', () => {
  const currentDateTag = getFormattedCurrentDate(new Date('2026-11-13T12:00:00Z'));
  assert.equal(currentDateTag, '13-11-26');

  // getRowRevisions parses string format and ensures 1) tag prefix
  const rowWithRevs = {
    noOfTimesRevised: '1) 13-11-26\n2) 15-11-26',
    reasonOfFailure: 'Reason 1\nReason 2',
    actionTaken: 'Action 1\nAction 2'
  };
  const parsed = getRowRevisions(rowWithRevs);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].revisionNo, 1);
  assert.equal(parsed[0].tag, '1) 13-11-26');
  assert.equal(parsed[0].reasonOfFailure, 'Reason 1');
  assert.equal(parsed[0].actionTaken, 'Action 1');

  assert.equal(parsed[1].revisionNo, 2);
  assert.equal(parsed[1].tag, '2) 15-11-26');
  assert.equal(parsed[1].reasonOfFailure, 'Reason 2');
  assert.equal(parsed[1].actionTaken, 'Action 2');
});

test('18. PTM Sheet: Multiple revisions divided horizontally across columns 27-29', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Verify multiple revisions logic subdivides with colSpan={3}
  assert.match(tableContent, /revisions\.length > 1/);
  assert.match(tableContent, /colSpan=\{3\}/);
  assert.match(tableContent, /divide-y divide-\[#CBD5E1\]/);
  assert.match(tableContent, /divide-x divide-\[#CBD5E1\]/);
  assert.match(tableContent, /handleAddRevision/);
  assert.match(tableContent, /handleRemoveRevision/);
  assert.match(tableContent, /handleRevisionCellChange/);
});

test('19. PTM Sheet: "Phase No." column is completely removed from matrix', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Verify header does not contain standalone Phase No. column
  assert.doesNotMatch(tableContent, /<th[^>]*>\s*Phase No\.\s*<\/th>/);

  // Verify App.jsx CSV headers do not have standalone Phase No. header
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.doesNotMatch(appContent, /'Phase No\.',/);
  assert.match(appContent, /'Phase No\. \/ Name',/);
});

test('20. PTM Sheet: "Phase No. / Name" column has dropdown with 5 APQP phases & "Other" manual input', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Header has "Phase No. / Name"
  assert.match(tableContent, /<span>Phase No\. \/ Name<\/span>/);

  // Dropdown options include 1 to 5 and Other
  assert.ok(PTM_PHASE_OPTIONS.includes('1: Plan & Define'));
  assert.ok(PTM_PHASE_OPTIONS.includes('2: Product & Process Design'));
  assert.ok(PTM_PHASE_OPTIONS.includes('3: Product & Process Development'));
  assert.ok(PTM_PHASE_OPTIONS.includes('4: Product & Process Validation'));
  assert.ok(PTM_PHASE_OPTIONS.includes('5: Feedback & Corrective Action'));
  assert.ok(PTM_PHASE_OPTIONS.includes('Other'));

  // Table has select dropdown for phases and manual input fallback for Other
  assert.match(tableContent, /1: Plan & Define/);
  assert.match(tableContent, /Other \.\.\.\.\. \(Manual input\)/);
  assert.match(tableContent, /Enter custom phase\.\.\./);
});

test('21. PTM Sheet: Deliverable Required defaults to "Yes", manual format input removed, 3-option Upload Modal integrated', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Dropdown default value is Yes
  assert.match(tableContent, /row\.deliverableRequired \|\| 'Yes'/);

  // Manual input placeholder "Format No." removed
  assert.doesNotMatch(tableContent, /placeholder="Format No\."/);

  // Upload button and modal are present
  assert.match(tableContent, /<PTMDeliverableUploadModal/);
  assert.match(tableContent, /setDeliverableModal/);
  assert.match(tableContent, /handleDeliverableUploadSuccess/);

  // Verify modal component has exactly 3 upload options: Image, PDF, Excel (no PPT or Video)
  const modalPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMDeliverableUploadModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert.match(modalContent, /Upload Image/);
  assert.match(modalContent, /Upload PDF/);
  assert.match(modalContent, /Upload Excel/);
  assert.doesNotMatch(modalContent, /Upload PPT/);
  assert.doesNotMatch(modalContent, /Upload Video/);
});

test('22. PTM Sheet: "Revised Date (If MISS)" column is completely removed', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Header does not have Revised Date (If MISS)
  assert.doesNotMatch(tableContent, /Revised Date \(If MISS\)/);

  // Body cell does not have revisedDate CalendarDateInput
  assert.doesNotMatch(tableContent, /data-col="revisedDate"/);

  // CSV export does not have Revised Date
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.doesNotMatch(appContent, /'Revised Date',/);
});

test('23. PTM Header: Rank dropdown includes option "S"', () => {
  const headerPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMHeader.jsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  assert.match(headerContent, /<option value="A">A<\/option>/);
  assert.match(headerContent, /<option value="B">B<\/option>/);
  assert.match(headerContent, /<option value="C1">C1<\/option>/);
  assert.match(headerContent, /<option value="C2">C2<\/option>/);
  assert.match(headerContent, /<option value="S">S<\/option>/);
});

test('24. PTM Sheet: "Rank S" column added between "Rank C1 & C2" and "Critical Activity" and works like other Rank columns', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Verify header placement: Rank C1 & C2 -> Rank S -> Critical Activity
  const rankCIdx = tableContent.indexOf('Rank C1 & C2');
  const rankSIdx = tableContent.indexOf('Rank S', rankCIdx);
  const criticalIdx = tableContent.indexOf('Critical Activity', rankSIdx);

  assert.ok(rankCIdx > 0, 'Rank C1 & C2 header must exist');
  assert.ok(rankSIdx > rankCIdx, 'Rank S header must be placed after Rank C1 & C2');
  assert.ok(criticalIdx > rankSIdx, 'Critical Activity header must be placed after Rank S');

  // Verify body cell uses cycleRank(originalIndex, 'rankS') and row.rankS
  assert.match(tableContent, /cycleRank\(originalIndex, 'rankS'\)/);
  assert.match(tableContent, /row\.rankS === 'applicable'/);
  assert.match(tableContent, /row\.rankS === 'if_required'/);
  assert.match(tableContent, /!row\.rankS/);

  // Verify App.jsx CSV export includes Rank S after Rank C1 & C2
  const appPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/ptm/App.jsx');
  const appContent = fs.readFileSync(appPath, 'utf8');
  assert.match(appContent, /'Rank C1 & C2',\s*'Rank S',\s*'Critical Activity'/);
  assert.match(appContent, /`"\$\{r\.rankS \|\| ''\}"`/);
});

test('25. PTM Sheet: Red-marked columns have auto-adjusting widths so dates and text do not clip or overlap', () => {
  const tablePath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');

  // Department columns no longer use restrictive max-w-[34px]
  assert.doesNotMatch(tableContent, /max-w-\[34px\]/);
  assert.match(tableContent, /dept\.key === 'Quality' \? 'min-w-\[54px\]' : 'min-w-\[42px\]'/);

  // Date columns no longer use restrictive max-w-[84px]; use w-auto min-w-[116px]
  assert.doesNotMatch(tableContent, /max-w-\[84px\]/);
  assert.match(tableContent, /w-auto min-w-\[116px\]/);

  // CalendarDateInput has sufficient width and right padding so date digits never overlap calendar icon
  const calPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/CalendarDateInput.jsx');
  const calContent = fs.readFileSync(calPath, 'utf8');
  assert.match(calContent, /min-w-\[112px\] pr-6 whitespace-nowrap/);

  // HIT/MISS, No. of Times Revised, and Reason of Failure use auto-adjusting widths
  assert.doesNotMatch(tableContent, /max-w-\[70px\]/);
  assert.match(tableContent, /w-auto min-w-\[78px\]/);
  assert.match(tableContent, /w-auto min-w-\[148px\]/);
  assert.doesNotMatch(tableContent, /max-w-\[200px\]/);
  assert.match(tableContent, /w-auto min-w-\[180px\]/);
});

test('26. PTM Header: Deliverable & Duration / Schedule Timing section replaced with Excel Milestones section (DPT, PPT, MPT, PILOT, SOP) supporting calendar, manual text, and date + text', () => {
  const headerPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMHeader.jsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  // Verify old red-marked section is removed
  assert.doesNotMatch(headerContent, /DELIVERABLE &amp; DURATION/);
  assert.doesNotMatch(headerContent, /SCHEDULE TIMING/);
  assert.doesNotMatch(headerContent, /Deliverable Required Nos\./);
  assert.doesNotMatch(headerContent, /No\. of Iterations in Plan/);

  // Verify new Excel Milestones section labels & 5 columns
  assert.match(headerContent, /Customer Milestones/);
  assert.match(headerContent, /\(MRD Date\)/);
  assert.match(headerContent, /Internal Milestones/);
  assert.match(headerContent, /\(QA Inspection\)/);
  assert.match(headerContent, /\{ key: 'DPT', label: 'DPT' \}/);
  assert.match(headerContent, /\{ key: 'PPT', label: 'PPT' \}/);
  assert.match(headerContent, /\{ key: 'MPT', label: 'MPT' \}/);
  assert.match(headerContent, /\{ key: 'PILOT', label: 'PILOT' \}/);
  assert.match(headerContent, /\{ key: 'SOP', label: 'SOP' \}/);

  // Verify MilestoneDateTextCell supports calendar picker, manual text, and date + text
  assert.match(headerContent, /function MilestoneDateTextCell/);
  assert.match(headerContent, /mergePickerDateWithText/);
  assert.match(headerContent, /type="date"/);
  assert.match(headerContent, /<textarea/);
});

test('27. PTM Header: Milestone columns (DPT, PPT, MPT, PILOT, SOP) support Shift + Enter multiline navigation and auto-expanding height', () => {
  const headerPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMHeader.jsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  // Verify MilestoneDateTextCell uses an auto-expanding textarea with Shift + Enter handling
  assert.match(headerContent, /<textarea/);
  assert.match(headerContent, /e\.key === 'Enter' && e\.shiftKey/);
  assert.match(headerContent, /e\.key === 'Enter' && !e\.shiftKey/);
  assert.match(headerContent, /whitespace-pre-wrap break-words/);
});

test('28. PTM Header: Milestone cells (DPT, PPT, MPT, PILOT, SOP) auto-adjust width up to three words and navigate to next line after three words', () => {
  const headerPath = path.resolve(process.cwd(), 'Furukawa-LMS/Furukawa-LMS-main/admin/src/components/ptm/PTM/PTMHeader.jsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  // Verify 3-word line wrapping and auto width adjustment helpers exist and are wired in MilestoneDateTextCell
  assert.match(headerContent, /formatThreeWordsPerLine/);
  assert.match(headerContent, /getMilestoneCellAutoWidthPx/);
  assert.match(headerContent, /wordsOnCurrentLine\.length >= 3/);
  assert.match(headerContent, /style=\{\{ width: `\$\{autoWidthPx\}px`, minWidth: `\$\{autoWidthPx\}px` \}\}/);
  assert.match(headerContent, /tableLayout:\s*'auto'/);
});







