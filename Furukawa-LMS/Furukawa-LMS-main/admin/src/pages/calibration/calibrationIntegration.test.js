import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adminRoot = path.resolve(__dirname, '../../..');

test('1. Calibration is registered in PAGE_REGISTRY under layout cms', () => {
  const pageRegistryPath = path.join(adminRoot, 'src/constants/navigation/pageRegistry.js');
  const code = fs.readFileSync(pageRegistryPath, 'utf8');

  assert.ok(
    code.includes('key: "cms-calibration"') &&
    code.includes('layout: "cms"') &&
    code.includes('link: "/cms/calibration"'),
    'PAGE_REGISTRY must contain cms-calibration with layout cms and link /cms/calibration'
  );

  assert.ok(
    code.includes('{ layout: "cms", prefix: "/cms/calibration", key: "cms-calibration" }'),
    'PAGE_REGISTRY must contain prefix route alias for /cms/calibration'
  );
});

test('2. IconGauge is registered in IconRegistry.js', () => {
  const iconRegistryPath = path.join(adminRoot, 'src/constants/navigation/IconRegistry.js');
  const code = fs.readFileSync(iconRegistryPath, 'utf8');

  assert.ok(code.includes('IconGauge'), 'IconRegistry.js must import and export IconGauge');
});

test('3. CalibrationPage is imported and routed in AppRoutes.jsx', () => {
  const routesPath = path.join(adminRoot, 'src/routes/AppRoutes.jsx');
  const code = fs.readFileSync(routesPath, 'utf8');

  assert.ok(
    code.includes('CalibrationPage = lazy'),
    'AppRoutes.jsx must lazy-load CalibrationPage'
  );

  assert.ok(
    code.includes('<Route path="calibration" element={<CalibrationPage />} />') &&
    code.includes('<Route path="calibration/:tab" element={<CalibrationPage />} />'),
    'AppRoutes.jsx must register /cms/calibration routes'
  );
});

test('4. CalibrationTabBar defines all 9 required sub-tabs with short labels and no Send Mail button', async () => {
  const tabBarPath = path.join(adminRoot, 'src/components/calibration/CalibrationTabBar.jsx');
  const code = fs.readFileSync(tabBarPath, 'utf8');

  const expectedTabs = [
    { id: 'procedure', shortLabel: 'Procedure' },
    { id: 'addition-deletion', shortLabel: 'Add / Delete Request' },
    { id: 'half-yearly-plan', shortLabel: 'Half-Yearly Plan' },
    { id: 'monthly-plan', shortLabel: 'Monthly Plan' },
    { id: 'report-format', shortLabel: 'Report Format' },
    { id: 'history-card', shortLabel: 'History Card' },
    { id: 'decommissioning', shortLabel: 'Decommissioning' },
    { id: 'scrap-note', shortLabel: 'Instrument Scrap' },
    { id: 'usability-declaration', shortLabel: 'Usability Declaration' }
  ];

  for (const tab of expectedTabs) {
    assert.ok(code.includes(`id: '${tab.id}'`), `TabBar must contain tab id: ${tab.id}`);
    assert.ok(code.includes(`shortLabel: '${tab.shortLabel}'`), `TabBar must contain tab shortLabel: ${tab.shortLabel}`);
  }

  assert.ok(!code.includes('Send Mail') && !code.includes('SendMail'), 'TabBar must NOT contain Send Mail button');
});

test('5. CalibrationDocumentsTable has the 6 specified table headers', () => {
  const tablePath = path.join(adminRoot, 'src/components/calibration/CalibrationDocumentsTable.jsx');
  assert.ok(fs.existsSync(tablePath), 'CalibrationDocumentsTable.jsx must exist');
  const content = fs.readFileSync(tablePath, 'utf8');

  assert.ok(content.includes('S.No.'), 'Table must have S.No. header');
  assert.ok(content.includes('Documents Name'), 'Table must have Documents Name header');
  assert.ok(content.includes('Unit'), 'Table must have Unit header');
  assert.ok(content.includes('Department'), 'Table must have Department header');
  assert.ok(content.includes('Section'), 'Table must have Section header');
  assert.ok(content.includes('Actions'), 'Table must have Actions header');
});

test('6. All 9 tabs have single dedicated documents in calibrationDocumentsData.js', () => {
  const dataPath = path.join(adminRoot, 'src/components/calibration/calibrationDocumentsData.js');
  assert.ok(fs.existsSync(dataPath), 'calibrationDocumentsData.js must exist');
  const content = fs.readFileSync(dataPath, 'utf8');

  const expectedTabs = [
    'procedure',
    'addition-deletion',
    'half-yearly-plan',
    'monthly-plan',
    'report-format',
    'history-card',
    'decommissioning',
    'scrap-note',
    'usability-declaration'
  ];

  for (const tabKey of expectedTabs) {
    assert.ok(content.includes(tabKey), `calibrationDocumentsData must contain entries for ${tabKey}`);
  }
});

test('7. All 9 sub-tab component files render CalibrationDocumentsTable', () => {
  const tabsDir = path.join(adminRoot, 'src/components/calibration/tabs');
  const expectedFiles = [
    'ProcedureTab.jsx',
    'AdditionDeletionTab.jsx',
    'HalfYearlyPlanTab.jsx',
    'MonthlyPlanTab.jsx',
    'ReportFormatTab.jsx',
    'HistoryCardTab.jsx',
    'DecommissioningTab.jsx',
    'ScrapTab.jsx',
    'UsabilityDeclarationTab.jsx'
  ];

  for (const file of expectedFiles) {
    const fullPath = path.join(tabsDir, file);
    assert.ok(fs.existsSync(fullPath), `Tab component file must exist: ${file}`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.includes('CalibrationDocumentsTable'), `${file} must render CalibrationDocumentsTable`);
  }
});

test('8. CalibrationPage has default unit null, date range, and single-row filter bar', () => {
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'CalibrationPage.jsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  assert.ok(content.includes('useState(null)'), 'Default unit must be null');
  assert.ok(content.includes('From Date') && content.includes('To Date'), 'Date range From and To must exist');
  assert.ok(!content.includes('isSendMailOpen'), 'Send Mail must not be present');
  assert.ok(content.includes('CalibrationTabBar'), 'CalibrationPage must render CalibrationTabBar');
  assert.ok(content.includes('CalibrationFilterBar'), 'CalibrationPage must render CalibrationFilterBar');
  assert.ok(content.includes('tabProps'), 'CalibrationPage must pass tabProps to active tab');
});

test('9. CalibrationChecksheetView has Back, Save, and Export buttons and no Close Checksheet button', () => {
  const sheetViewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  assert.ok(fs.existsSync(sheetViewPath), 'CalibrationChecksheetView.jsx must exist');
  const content = fs.readFileSync(sheetViewPath, 'utf8');

  // Must have Back button calling onBack
  assert.ok(content.includes('ArrowLeft'), 'Checksheet view must have Back icon (ArrowLeft)');
  assert.ok(content.includes('Back'), 'Checksheet view must have Back button text');
  assert.ok(content.includes('onClick={onBack}'), 'Back button must call onBack');

  // Must NOT have old Close Checksheet button
  assert.ok(!content.includes('Close Checksheet'), 'Must not have Close Checksheet button');

  // Must have Save and Export action buttons
  assert.ok(content.includes('Save'), 'Must have Save button in navbar');
  assert.ok(content.includes('Export'), 'Must have Export button in navbar');

  // Must have vertical scrolling container
  assert.ok(content.includes('overflow-y-auto'), 'Must have vertical scrolling container');
  assert.ok(content.includes('AdditionDeletionChecksheet'), 'Checksheet view must integrate AdditionDeletionChecksheet');
});

test('10. CalibrationDocumentsTable triggers onOpenDocument on row click', () => {
  const tablePath = path.join(adminRoot, 'src/components/calibration/CalibrationDocumentsTable.jsx');
  const content = fs.readFileSync(tablePath, 'utf8');

  assert.ok(content.includes('onOpenDocument'), 'Table must accept onOpenDocument prop');
  assert.ok(content.includes('onOpenDocument(doc)'), 'Table must invoke onOpenDocument when row or link clicked');
});

test('11. AdditionDeletionChecksheet matches exact form from images without extra rows or columns', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/AdditionDeletionChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'AdditionDeletionChecksheet.jsx must exist');
  const content = fs.readFileSync(sheetPath, 'utf8');

  assert.ok(content.includes('FURUKAWA MINDA ELECTRIC PVT. LTD.'), 'Must contain company header');
  assert.ok(content.includes('New Instrument addition/deletion'), 'Must contain title');
  assert.ok(content.includes('Request Form'), 'Must contain title subtitle');
  assert.ok(content.includes('Addition') && content.includes('Deletion'), 'Must contain Addition and Deletion options');
  assert.ok(content.includes('Instrument Name'), 'Must contain Instrument Name');
  assert.ok(content.includes('Instrument Sr. No'), 'Must contain Instrument Sr. No');
  assert.ok(content.includes('Make'), 'Must contain Make');
  assert.ok(content.includes('Type of Measurement'), 'Must contain Type of Measurement');
  assert.ok(content.includes('Location'), 'Must contain Location');
  assert.ok(content.includes('Least Count'), 'Must contain Least Count');
  assert.ok(content.includes('Range'), 'Must contain Range');
  assert.ok(content.includes('Date Of purchase'), 'Must contain Date Of purchase');
  assert.ok(content.includes('Acceptance criteria'), 'Must contain Acceptance criteria');
  assert.ok(content.includes('Reason') && content.includes('(addition/deletion)'), 'Must contain Reason (addition/deletion)');
  assert.ok(content.includes('if Applicable'), 'Must contain if Applicable section');
  assert.ok(content.includes('Warranty') && content.includes('Warranty (Validity)'), 'Must contain Warranty and Validity');
  assert.ok(content.includes('AMC') && content.includes('AMC (Validity)'), 'Must contain AMC and Validity');
  assert.ok(content.includes('Manual') && content.includes('Manual (Revision)'), 'Must contain Manual and Revision');
  assert.ok(content.includes('Calibration Certificate') && content.includes('Calibration Certificate(Validity)'), 'Must contain Calibration Certificate');
  assert.ok(content.includes('Deptt:') && content.includes('REQUESTED BY:') && content.includes('APPROVED BY:'), 'Must contain Deptt, Requested By, Approved By');
  assert.ok(content.includes('FRM-WH-QA-216') && content.includes('Rev: 00') && content.includes('Issue Date: 18.04.19') && content.includes('Page: 1 of 1'), 'Must contain footer format metadata');
});

test('12. AdditionDeletionChecksheet has all placeholders removed', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/AdditionDeletionChecksheet.jsx');
  const content = fs.readFileSync(sheetPath, 'utf8');

  assert.ok(!content.includes('placeholder='), 'AdditionDeletionChecksheet must not have any placeholder attributes');
});

test('13. HalfYearlyPlanChecksheet matches exact colors, headers, and 13 columns from screenshot', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/HalfYearlyPlanChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'HalfYearlyPlanChecksheet.jsx must exist');
  const content = fs.readFileSync(sheetPath, 'utf8');

  // Exact Yellow Header Title and Metadata Box
  assert.ok(content.includes("Inhouse Calibration Plan Jul'26 To Dec'26"), 'Must contain exact title');
  assert.ok(content.includes('FRM-WH-QA-209'), 'Must contain format number FRM-WH-QA-209');
  assert.ok(content.includes('Rev.No :') || content.includes('Rev.No:'), 'Must contain Rev.No');
  assert.ok(content.includes('Rev.Date :') || content.includes('Rev.Date:'), 'Must contain Rev.Date');
  assert.ok(content.includes('#FFFF00'), 'Must use exact yellow color #FFFF00 for header block');

  // Exact 4 sub-rows in yellow block
  assert.ok(content.includes('Calibration plan Issue Date :'), 'Must contain Calibration plan Issue Date');
  assert.ok(content.includes('Calibration plan Issue No:'), 'Must contain Calibration plan Issue No');
  assert.ok(content.includes('Revision Issue Date:'), 'Must contain Revision Issue Date');
  assert.ok(content.includes('Name of Calibration Source :'), 'Must contain Name of Calibration Source');
  assert.ok(content.includes('FME QA LAB'), 'Must contain FME QA LAB');

  // Exact Light Blue Table Column Headers (RGB 155, 194, 230 / #9BC2E6)
  assert.ok(content.includes('#9BC2E6'), 'Must use exact light blue color #9BC2E6 for column headers');
  const expectedColumns = [
    'S.no',
    'Instrument Name',
    'Identification no',
    'Make',
    'Location',
    'Least Count',
    'Range',
    'Frequency',
    'Due date',
    'Done Date',
    'Next Due Date',
    'Remark',
    'Responsibility'
  ];
  for (const col of expectedColumns) {
    assert.ok(content.includes(col), `HalfYearlyPlanChecksheet must have column header: ${col}`);
  }

  // CalibrationChecksheetView integrates HalfYearlyPlanChecksheet
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('HalfYearlyPlanChecksheet'), 'CalibrationChecksheetView must integrate HalfYearlyPlanChecksheet');
});

test('14. HalfYearlyPlanChecksheet has all green cell hover/active borders removed', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/HalfYearlyPlanChecksheet.jsx');
  const content = fs.readFileSync(sheetPath, 'utf8');

  assert.ok(!content.includes('ring-2 ring-emerald-600'), 'HalfYearlyPlanChecksheet must not have green ring borders on cells');
});

test('15. MonthlyPlanChecksheet matches exact colors, columns, Sundays, sub-rows and footer metadata', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/MonthlyPlanChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'MonthlyPlanChecksheet.jsx must exist');
  const content = fs.readFileSync(sheetPath, 'utf8');

  // Title and Legends
  assert.ok(content.includes('Aug-2026 _Inhouse Calibration Plan'), 'Must contain exact title');
  assert.ok(content.includes('Legends'), 'Must contain Legends label');
  assert.ok(content.includes('>Plan<') && content.includes('>Actual<'), 'Must contain Plan and Actual in legend and rows');

  // Exact Peach Header Color (#FCE4D6) and Sunday Highlight Color (#FFC000)
  assert.ok(content.includes('#FCE4D6'), 'Must use exact peach color #FCE4D6 for table header');
  assert.ok(content.includes('#FFC000'), 'Must use exact yellow/amber #FFC000 for Sundays');

  // Instrument Columns
  const expectedCols = [
    'S.No',
    'Instrument Name',
    'Instrument No',
    'Make',
    'Location',
    'Least Count',
    'Range',
    'Frequency',
    'due date',
    'Plan'
  ];
  for (const c of expectedCols) {
    assert.ok(content.includes(c), `MonthlyPlanChecksheet must have column: ${c}`);
  }

  // Footer Metadata
  assert.ok(content.includes('Prepared By:') && content.includes('Ujjawal Kumar'), 'Must have Prepared By Ujjawal Kumar');
  assert.ok(content.includes('FRM-WH-QA-210'), 'Must have FRM-WH-QA-210');
  assert.ok(content.includes('Checked By :') && content.includes('Alok Singh'), 'Must have Checked By Alok Singh');
  assert.ok(content.includes('REV :-') && content.includes("revNo: '00'"), 'Must have REV :- 00');
  assert.ok(content.includes('Reviewed By:') && content.includes('Vikas Phogat'), 'Must have Reviewed By Vikas Phogat');
  assert.ok(content.includes('Approved By:') && content.includes('Arvind Chauhan'), 'Must have Approved By Arvind Chauhan');
  assert.ok(content.includes('ISSUE DATE') && content.includes('11.10.2022'), 'Must have ISSUE DATE 11.10.2022');

  // Integrated in CalibrationChecksheetView
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('MonthlyPlanChecksheet'), 'CalibrationChecksheetView must integrate MonthlyPlanChecksheet');
});

test('16. ReportFormatChecksheet matches exact headers, sections, Deviation and Review column, and footer', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/ReportFormatChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'ReportFormatChecksheet.jsx must exist');
  const content = fs.readFileSync(sheetPath, 'utf8');

  // Company and Title
  assert.ok(content.includes('FURUKAWA MINDA ELECTRIC PVT. LTD.'), 'Must contain company name');
  assert.ok(content.includes('CALIBRATION REPORT'), 'Must contain CALIBRATION REPORT');

  // Instrument Details & Master Used
  assert.ok(content.includes('Item Description :'), 'Must have Item Description');
  assert.ok(content.includes('Calibration Date :'), 'Must have Calibration Date');
  assert.ok(content.includes('Calibration Due Date :'), 'Must have Calibration Due Date');
  assert.ok(content.includes('Calibration Procedure :'), 'Must have Calibration Procedure');
  assert.ok(content.includes('Description of Master Used:'), 'Must have Description of Master Used');
  assert.ok(content.includes('Video Measuring machine'), 'Must have Video Measuring machine default');
  assert.ok(content.includes('Least Count/Grade :'), 'Must have Least Count/Grade');

  // Appearance Section
  assert.ok(content.includes('1. Appearance'), 'Must have 1. Appearance section');
  assert.ok(content.includes('Standard') && content.includes('Observed') && content.includes('Remark'), 'Must have appearance table headers');

  // Readings Table: Standard Reading (mm), Observed Reading (mm), Deviation (mm), and Review
  assert.ok(content.includes('Standard Reading (mm)'), 'Must have Standard Reading (mm)');
  assert.ok(content.includes('Observed Reading (mm)'), 'Must have Observed Reading (mm)');
  assert.ok(content.includes('Deviation (mm)'), 'Must have Deviation (mm)');
  assert.ok(content.includes('Review'), 'Must have Review column to the right of Deviation');
  assert.ok(content.includes("review: 'OK'"), 'Must default Review column values to OK');

  // Status and Footer
  assert.ok(content.includes('Status :'), 'Must have Status section');
  assert.ok(content.includes('Prepared by :'), 'Must have Prepared by');
  assert.ok(content.includes('FRM-WH-QA-082'), 'Must have format code FRM-WH-QA-082');
  assert.ok(content.includes('Checked By :'), 'Must have Checked By');
  assert.ok(content.includes('REV NO.-02'), 'Must have REV NO.-02');
  assert.ok(content.includes('Review By :'), 'Must have Review By');
  assert.ok(content.includes('Rev. Date - 07.03.19'), 'Must have Rev. Date - 07.03.19');
  assert.ok(content.includes('Approved By:'), 'Must have Approved By');
  assert.ok(content.includes('Page 1 of 1'), 'Must have Page 1 of 1');

  // Integrated in CalibrationChecksheetView
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('ReportFormatChecksheet'), 'CalibrationChecksheetView must integrate ReportFormatChecksheet');
});

test('17. HistoryCardChecksheet matches exact specs, table columns, and footer metadata', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/HistoryCardChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'HistoryCardChecksheet.jsx must exist');
  const content = fs.readFileSync(sheetPath, 'utf8');

  // Title
  assert.ok(content.includes('CALIBRATION HISTORY CARD'), 'Must contain CALIBRATION HISTORY CARD');

  // Specs Labels
  assert.ok(content.includes('Manufactrure of Instruments:'), 'Must have Manufactrure of Instruments:');
  assert.ok(content.includes('Year of purchase:'), 'Must have Year of purchase:');
  assert.ok(content.includes('Range of Instrument'), 'Must have Range of Instrument');
  assert.ok(content.includes('Instruments Name:'), 'Must have Instruments Name:');
  assert.ok(content.includes('Instrument No.'), 'Must have Instrument No.');
  assert.ok(content.includes('Usage location'), 'Must have Usage location');
  assert.ok(content.includes('Least count'), 'Must have Least count');
  assert.ok(content.includes('Acceptance criteria'), 'Must have Acceptance criteria');
  assert.ok(content.includes('Special Instruction :'), 'Must have Special Instruction :');

  // 8 Table Columns
  const expectedCols = [
    'Date',
    'Calibration report no.',
    'Calibration Due date',
    'Calibration done by',
    'Result',
    'Instrument condition',
    'Inspected by',
    'Remarks'
  ];
  for (const c of expectedCols) {
    const cleanHeader = c.replace(/ /g, '');
    const fileClean = content.replace(/<br \/>/g, ' ').replace(/\s+/g, ' ');
    assert.ok(fileClean.includes(c), `HistoryCardChecksheet must have column: ${c}`);
  }

  // Footer Metadata
  assert.ok(content.includes('FRM-WH-QA-038'), 'Must have FRM-WH-QA-038');
  assert.ok(content.includes('Rev. No.01'), 'Must have Rev. No.01');
  assert.ok(content.includes('Rev. Date: 07.03.19'), 'Must have Rev. Date: 07.03.19');
  assert.ok(content.includes('Page: 1 of 1'), 'Must have Page: 1 of 1');

  // Verify clean table body without horizontal row dividing lines or internal specs grid
  assert.ok(!content.includes('divide-y divide-black'), 'Specs and table must not have heavy black horizontal dividing lines');
  assert.ok(content.includes('border-none'), 'Row inputs/cells should be borderless like the original Excel card');
  assert.ok(content.includes('<textarea'), 'Must use textarea for long input areas like Special Instruction');

  // Check CalibrationChecksheetView displays HistoryCardChecksheet for history card
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('<HistoryCardChecksheet'), 'CalibrationChecksheetView must integrate HistoryCardChecksheet');
  assert.ok(viewContent.includes('isHistoryCard'), 'CalibrationChecksheetView must define isHistoryCard condition');
});

test('18. DecommissioningReportChecksheet matches exact specs, tables, process flow, and footer metadata', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/DecommissioningReportChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'DecommissioningReportChecksheet.jsx must exist');
  const rawContent = fs.readFileSync(sheetPath, 'utf8');
  const content = rawContent.replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ');

  // Title & Company
  assert.ok(content.includes('FURUKAWA MINDA ELECTRIC PVT. LTD.'), 'Must contain company banner');
  assert.ok(content.includes('INSTRUMENT / GAUGE DECOMMISSIONING REPORT'), 'Must contain INSTRUMENT / GAUGE DECOMMISSIONING REPORT');

  // Header Info
  assert.ok(content.includes('FROM :'), 'Must have FROM :');
  assert.ok(content.includes('QA LAB'), 'Must have QA LAB');
  assert.ok(content.includes('Location'), 'Must have Location');
  assert.ok(content.includes('DATE :'), 'Must have DATE :');
  assert.ok(content.includes('TO :'), 'Must have TO :');
  assert.ok(content.includes('USER DEPTT HEAD'), 'Must have USER DEPTT HEAD');
  assert.ok(content.includes('Machine No.'), 'Must have Machine No.');

  // Notice 1
  assert.ok(content.includes('Please note that following instruments/Gauges are found out of calibration as laid standards.'), 'Must have notice 1');

  // Table 1 Headers
  assert.ok(content.includes('S.No.'), 'Must have S.No.');
  assert.ok(content.includes('Instrument/gauge'), 'Must have Instrument/gauge');
  assert.ok(content.includes('Description'), 'Must have Description');
  assert.ok(content.includes('Deptt.'), 'Must have Deptt.');
  assert.ok(content.includes('Whether Repairable'), 'Must have Whether Repairable');

  // Notice 2
  assert.ok(content.includes('Please check the validity of inspection done with above instrument/gauge after decommissioning & fill -up the details in the following table & return to calibration deptt. Incase of discrepancies found get more lot checked'), 'Must have notice 2');

  // Middle Signatures
  assert.ok(content.includes('Shift Incharge (PRD)'), 'Must have Shift Incharge (PRD)');
  assert.ok(content.includes('HOD (PRD)'), 'Must have HOD (PRD)');
  assert.ok(content.includes('Shift Incharge (Quality)'), 'Must have Shift Incharge (Quality)');
  assert.ok(content.includes('HOD (Quality)'), 'Must have HOD (Quality)');

  // Table 2 Headers
  assert.ok(content.includes('S.NO'), 'Must have S.NO');
  assert.ok(content.includes('DESCRIPTION OF'), 'Must have DESCRIPTION OF');
  assert.ok(content.includes('PARTS/TOOLS/FIXTURES'), 'Must have PARTS/TOOLS/FIXTURES');
  assert.ok(content.includes('WHETHER'), 'Must have WHETHER');
  assert.ok(content.includes('DISCREPANC'), 'Must have DISCREPANC');
  assert.ok(content.includes('IF YES, ACTION TAKEN'), 'Must have IF YES, ACTION TAKEN');

  // Bottom Signatures
  assert.ok(content.includes('QA Lab Engineer:'), 'Must have QA Lab Engineer:');
  assert.ok(content.includes('QA Lab Incharge:'), 'Must have QA Lab Incharge:');

  // Process Flow
  assert.ok(content.includes('Process Flow:'), 'Must have Process Flow:');
  assert.ok(content.includes('QA LAB Deptt.'), 'Must have QA LAB Deptt.');
  assert.ok(content.includes('User Deptt.'), 'Must have User Deptt.');
  assert.ok(content.includes('Head QA'), 'Must have Head QA');
  assert.ok(content.includes('(for approval)'), 'Must have (for approval)');

  // Footer Metadata
  assert.ok(content.includes('FRM-WH-QA-124'), 'Must have FRM-WH-QA-124');
  assert.ok(content.includes('Rev: 03'), 'Must have Rev: 03');
  assert.ok(content.includes('Rev Date: 12.03.2024'), 'Must have Rev Date: 12.03.2024');
  assert.ok(content.includes('Page: 1 of 1'), 'Must have Page: 1 of 1');

  // Integrated in CalibrationChecksheetView
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('DecommissioningReportChecksheet'), 'CalibrationChecksheetView must integrate DecommissioningReportChecksheet');
});

test('19. InstrumentScrapReportChecksheet matches exact specs, textarea, and footer metadata', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/InstrumentScrapReportChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'InstrumentScrapReportChecksheet.jsx must exist');
  const rawContent = fs.readFileSync(sheetPath, 'utf8');
  const content = rawContent.replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ');

  // Company Banner & Title
  assert.ok(content.includes('FURUKAWA MINDA ELECTRIC PVT. LTD.'), 'Must contain company banner');
  assert.ok(content.includes('INSTRUMENT SCRAP REPORT'), 'Must contain INSTRUMENT SCRAP REPORT');

  // Header Info
  assert.ok(content.includes('REPORT NO. :'), 'Must have REPORT NO. :');
  assert.ok(content.includes('DATE :'), 'Must have DATE :');
  assert.ok(content.includes('1. SECTION / DEPARTMENT :-'), 'Must have 1. SECTION / DEPARTMENT :-');
  assert.ok(content.includes('2. INSTRUMENT NAME :-'), 'Must have 2. INSTRUMENT NAME :-');
  assert.ok(content.includes('3. CONTROL NUMBER :-'), 'Must have 3. CONTROL NUMBER :-');

  // Middle Section (Reason for Scraping with textarea)
  assert.ok(content.includes('REASON FOR SCRAPING :-'), 'Must have REASON FOR SCRAPING :-');
  assert.ok(rawContent.includes('<textarea'), 'Must use textarea for reason for scraping');
  assert.ok(content.includes('Calibration & dimension report attaced or not:'), 'Must have Calibration & dimension report attaced or not:');

  // Signatures
  assert.ok(content.includes('Prepared by'), 'Must have Prepared by');
  assert.ok(content.includes('Reviewed By'), 'Must have Reviewed By');
  assert.ok(content.includes('Lab Incharge:'), 'Must have Lab Incharge:');
  assert.ok(content.includes('Approved By'), 'Must have Approved By');
  assert.ok(content.includes('QA Head:'), 'Must have QA Head:');
  assert.ok(content.includes('Sign :-'), 'Must have Sign :-');
  assert.ok(content.includes('Date :-'), 'Must have Date :-');

  // Footer Metadata
  assert.ok(content.includes('FRM-WH-QA-098'), 'Must have FRM-WH-QA-098');
  assert.ok(content.includes('Rev. No.02'), 'Must have Rev. No.02');
  assert.ok(content.includes('Rev. Date: 08.03.19'), 'Must have Rev. Date: 08.03.19');
  assert.ok(content.includes('Page: 1 of 1'), 'Must have Page: 1 of 1');

  // Integrated in CalibrationChecksheetView
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('InstrumentScrapReportChecksheet'), 'CalibrationChecksheetView must integrate InstrumentScrapReportChecksheet');
});

test('20. UsabilityDeclarationChecksheet matches exact specs, 10 columns, and footer metadata', () => {
  const sheetPath = path.join(adminRoot, 'src/components/calibration/checksheets/UsabilityDeclarationChecksheet.jsx');
  assert.ok(fs.existsSync(sheetPath), 'UsabilityDeclarationChecksheet.jsx must exist');
  const rawContent = fs.readFileSync(sheetPath, 'utf8');
  const content = rawContent.replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ');

  // Title & Month
  assert.ok(content.includes('Declaration for instrument usable condition(STORE)'), 'Must contain Declaration for instrument usable condition(STORE)');
  assert.ok(content.includes('Month'), 'Must have Month block');

  // 10 Column Headers
  const expectedCols = [
    'S.N.',
    'Instrument Name',
    'Instrument ID number',
    'Instrument Location',
    'Instrument under usable condition (Y/N)',
    'Availibities of Calibration sticker on instruments (Y/N)',
    'due date of calibration',
    'If inst. not usable condition/ Calibration sticker not available (write the reason)',
    'Is Information given to lab? (Y/N)',
    'Information to lab given date'
  ];
  for (const c of expectedCols) {
    const cleanCol = c.replace(/\s+/g, ' ');
    assert.ok(content.includes(cleanCol), `UsabilityDeclarationChecksheet must have column: ${cleanCol}`);
  }

  // Signatures
  assert.ok(content.includes('Sign of area in-charge'), 'Must have Sign of area in-charge');
  assert.ok(content.includes('Sign of Dept. Head.'), 'Must have Sign of Dept. Head.');

  // Footer Metadata
  assert.ok(content.includes('FRM-WH-QA-208'), 'Must have FRM-WH-QA-208');
  assert.ok(content.includes('Rev: 01'), 'Must have Rev: 01');
  assert.ok(content.includes('Issue Date: 01.08.23'), 'Must have Issue Date: 01.08.23');
  assert.ok(content.includes('Page: 1 of 1'), 'Must have Page: 1 of 1');

  // Integrated in CalibrationChecksheetView
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('UsabilityDeclarationChecksheet'), 'CalibrationChecksheetView must integrate UsabilityDeclarationChecksheet');
});

test('21. Report Format sub-filter tabs exist above search bar and filter table data', () => {
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const content = fs.readFileSync(pagePath, 'utf8');
  assert.ok(content.includes('Format checksheet'), 'CalibrationPage must have "Format checksheet" button above search bar');
  assert.ok(content.includes('mating gauge'), 'CalibrationPage must have "mating gauge" button above search bar');
  assert.ok(content.includes('reportFormatSubFilter'), 'CalibrationPage must track reportFormatSubFilter');

  const tabPath = path.join(adminRoot, 'src/components/calibration/tabs/ReportFormatTab.jsx');
  const tabContent = fs.readFileSync(tabPath, 'utf8');
  assert.ok(tabContent.includes('subFilter'), 'ReportFormatTab must filter by subFilter');
});

test('22. FormatChecksheet matches second screenshot and MatingGaugeChecksheet contains shifted format', () => {
  // FormatChecksheet (from second screenshot)
  const formatPath = path.join(adminRoot, 'src/components/calibration/checksheets/FormatChecksheet.jsx');
  assert.ok(fs.existsSync(formatPath), 'FormatChecksheet.jsx must exist');
  const formatContent = fs.readFileSync(formatPath, 'utf8');
  assert.ok(formatContent.includes('CALIBRATION REPORT'), 'Must contain CALIBRATION REPORT');
  assert.ok(formatContent.includes('1. Appreance'), 'Must contain 1. Appreance');
  assert.ok(formatContent.includes('Results :'), 'Must contain Results :');
  assert.ok(formatContent.includes('Standard Reading (mm)'), 'Must have Standard Reading (mm)');
  assert.ok(formatContent.includes('Observed Reading (mm)'), 'Must have Observed Reading (mm)');
  assert.ok(formatContent.includes('Deviation (mm)'), 'Must have Deviation (mm)');
  assert.ok(!formatContent.includes('<th>Review</th>') && !formatContent.includes('review:'), 'FormatChecksheet must NOT have Review column');
  assert.ok(formatContent.includes('Acceptance Criteria :'), 'Must have Acceptance Criteria :');
  assert.ok(formatContent.includes('Status :'), 'Must have Status :');

  // MatingGaugeChecksheet (shifted from previous checksheet)
  const matingPath = path.join(adminRoot, 'src/components/calibration/checksheets/MatingGaugeChecksheet.jsx');
  assert.ok(fs.existsSync(matingPath), 'MatingGaugeChecksheet.jsx must exist');
  const matingContent = fs.readFileSync(matingPath, 'utf8');
  assert.ok(matingContent.includes('Review'), 'MatingGaugeChecksheet must have shifted Review column');

  // Both integrated in CalibrationChecksheetView
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('FormatChecksheet'), 'CalibrationChecksheetView must integrate FormatChecksheet');
  assert.ok(viewContent.includes('MatingGaugeChecksheet'), 'CalibrationChecksheetView must integrate MatingGaugeChecksheet');
});
