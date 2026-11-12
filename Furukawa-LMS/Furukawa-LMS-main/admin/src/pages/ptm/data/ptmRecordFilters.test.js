import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PTM_VALID_UNITS,
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

  // Verify colgroup was updated to span 35
  assert.match(tableContent, /<col span=\{35\} \/>/);

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
  const tbodyStatusIdx = tableContent.indexOf('row.status || \'Open\'', tbodyRespIdx);
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



