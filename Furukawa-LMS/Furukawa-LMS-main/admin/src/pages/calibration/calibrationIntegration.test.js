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

test('8. CalibrationPage has default unit null, date range removed, and single-row filter bar', () => {
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'CalibrationPage.jsx must exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  assert.ok(content.includes('useState(null)'), 'Default unit must be null');
  assert.ok(!content.includes('id="calibration-from-date"') && !content.includes('From Date'), 'Date range must be removed from CalibrationPage');
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
  assert.ok(content.includes('currently no excel export not available'), 'Export button must show alert in toast that currently no excel export not available');

  // Must have zoom / maximise & minimise control pill (- | 100% | +)
  assert.ok(content.includes('calibration-zoom-out-btn') && content.includes('calibration-zoom-in-btn'), 'Checksheet view must have zoom out and zoom in buttons');
  assert.ok(content.includes('{zoom}%'), 'Checksheet view must display zoom percentage');
  assert.ok(content.includes('zoom: `${zoom}%`'), 'Checksheet view must apply zoom style to canvas');

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

  // 9 Table Columns (including S.No.)
  const expectedCols = [
    'S.No.',
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

  // Row count and borders
  assert.ok(content.includes('INITIAL_HISTORY_ROWS = 10'), 'HistoryCardChecksheet must have 10 rows');
  assert.ok(content.includes('border-b border-black'), 'Rows must be separated by border-b border-black');

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

test('23. CalibrationFilterBar has Add Checksheet button and CalibrationPage supports adding checksheets across all 9 tabs', () => {
  const filterBarPath = path.join(adminRoot, 'src/components/calibration/CalibrationFilterBar.jsx');
  assert.ok(fs.existsSync(filterBarPath), 'CalibrationFilterBar.jsx must exist');
  const filterContent = fs.readFileSync(filterBarPath, 'utf8');
  assert.ok(filterContent.includes('calibration-add-checksheet-btn'), 'FilterBar must render Add Checksheet button with id calibration-add-checksheet-btn');
  assert.ok(filterContent.includes('onAddChecksheet'), 'FilterBar must accept onAddChecksheet prop');
  assert.ok(filterContent.includes('Add Checksheet'), 'Button text must be Add Checksheet');

  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes('onAddChecksheet={handleAddChecksheet}'), 'CalibrationPage must pass handleAddChecksheet to CalibrationFilterBar');
  assert.ok(pageContent.includes('handleAddChecksheet'), 'CalibrationPage must define handleAddChecksheet');
  assert.ok(pageContent.includes('handleSaveDocument'), 'CalibrationPage must define handleSaveDocument');
  assert.ok(pageContent.includes('documentsByTab'), 'CalibrationPage must maintain documentsByTab state');
});

test('24. AddChecksheetModal exists with 9 tab fields, Gujrat empty text is configured, and table actions have Eye and Download removed', () => {
  // Modal check
  const modalPath = path.join(adminRoot, 'src/components/calibration/AddChecksheetModal.jsx');
  assert.ok(fs.existsSync(modalPath), 'AddChecksheetModal.jsx must exist');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalContent.includes('TAB_DYNAMIC_FIELDS'), 'AddChecksheetModal must define TAB_DYNAMIC_FIELDS');
  assert.ok(modalContent.includes('department'), 'AddChecksheetModal must accept department');
  assert.ok(modalContent.includes('section'), 'AddChecksheetModal must accept section');
  assert.ok(modalContent.includes('dynamicValue'), 'AddChecksheetModal must handle dynamic field');

  // CalibrationDocumentsTable check
  const tablePath = path.join(adminRoot, 'src/components/calibration/CalibrationDocumentsTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');
  assert.ok(tableContent.includes('No checksheets added yet') || tableContent.includes('not checksheets added yet'), 'Table must display "No checksheets added yet" when Gujrat has no checksheets');
  assert.ok(tableContent.includes('Please select the unit'), 'Table must display "Please select the unit" when no unit is selected');
  assert.ok(!tableContent.includes('title="View Checksheet"'), 'Eye view button must be removed from table actions');
  assert.ok(!tableContent.includes('title="Download Document"'), 'Download button must be removed from table actions');
  assert.ok(tableContent.includes('title="Edit Checksheet"'), 'Edit button must remain in table actions');
  assert.ok(tableContent.includes('title="Delete Document"'), 'Delete button must remain in table actions');

  // CalibrationPage check
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes("unitOptions = ['Bawal', 'Gujrat']"), 'Unit options must contain Bawal and Gujrat');
  assert.ok(pageContent.includes('AddChecksheetModal'), 'CalibrationPage must render AddChecksheetModal');
});

test('25. SignatureApprovalControl exists with Approved/Rejected buttons and hides buttons when approved', () => {
  const ctrlPath = path.join(adminRoot, 'src/components/calibration/checksheets/SignatureApprovalControl.jsx');
  assert.ok(fs.existsSync(ctrlPath), 'SignatureApprovalControl.jsx must exist');
  const ctrlContent = fs.readFileSync(ctrlPath, 'utf8');

  // Must have Approved and Rejected buttons
  assert.ok(ctrlContent.includes('Approved'), 'Must contain Approved button text');
  assert.ok(ctrlContent.includes('Rejected'), 'Must contain Rejected button text');
  assert.ok(ctrlContent.includes("status === 'approved'"), 'Must handle approved state');
  assert.ok(ctrlContent.includes("status === 'rejected'"), 'Must handle rejected state');

  // Checksheets must import and integrate SignatureApprovalControl
  const checksheets = [
    'AdditionDeletionChecksheet.jsx',
    'FormatChecksheet.jsx',
    'ReportFormatChecksheet.jsx',
    'MatingGaugeChecksheet.jsx',
    'MonthlyPlanChecksheet.jsx',
    'HalfYearlyPlanChecksheet.jsx',
    'HistoryCardChecksheet.jsx',
    'DecommissioningReportChecksheet.jsx',
    'InstrumentScrapReportChecksheet.jsx',
    'UsabilityDeclarationChecksheet.jsx'
  ];

  for (const file of checksheets) {
    const csPath = path.join(adminRoot, 'src/components/calibration/checksheets', file);
    assert.ok(fs.existsSync(csPath), `${file} must exist`);
    const csContent = fs.readFileSync(csPath, 'utf8');
    assert.ok(csContent.includes('SignatureApprovalControl'), `${file} must import and use SignatureApprovalControl`);
  }
});

test('26. Procedure tab contains 6 required documents and procedure sheet is empty placeholder', () => {
  const dataPath = path.join(adminRoot, 'src/components/calibration/calibrationDocumentsData.js');
  const dataContent = fs.readFileSync(dataPath, 'utf8');

  // Verify all 6 documents in procedure
  assert.ok(dataContent.includes('Standard Operating Procedure'), 'Must contain Standard Operating Procedure');
  assert.ok(dataContent.includes('Annexure 1'), 'Must contain Annexure 1');
  assert.ok(dataContent.includes('Annexure 2'), 'Must contain Annexure 2');
  assert.ok(dataContent.includes('Annexure 3'), 'Must contain Annexure 3');
  assert.ok(dataContent.includes('Scope for Calibration'), 'Must contain Scope for Calibration');
  assert.ok(dataContent.includes('Scope for Inspection'), 'Must contain Scope for Inspection');

  // Verify CalibrationChecksheetView displays empty placeholder when no checksheet template is configured for procedure
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('no checksheet added yet') || viewContent.includes('No checksheet added yet'), 'Must show empty checksheet message for procedure');
});

test('27. Calibration checksheet routes with unique ID and persists in localStorage with empty state on new', () => {
  // 1. Verify AppRoutes has calibration/:tab/:checksheetId route
  const routesPath = path.join(adminRoot, 'src/routes/AppRoutes.jsx');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert.ok(
    routesContent.includes('calibration/:tab/:checksheetId'),
    'AppRoutes must register calibration/:tab/:checksheetId route'
  );

  // 2. Verify CalibrationPage supports checksheetId and localStorage persistence
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes('checksheetId'), 'CalibrationPage must read checksheetId param');
  assert.ok(pageContent.includes('CALIBRATION_STORAGE_KEY'), 'CalibrationPage must define localStorage key');
  assert.ok(pageContent.includes('localStorage.getItem'), 'CalibrationPage must retrieve checksheets from localStorage');
  assert.ok(pageContent.includes('localStorage.setItem'), 'CalibrationPage must save checksheets to localStorage');
  assert.ok(pageContent.includes('EMPTY_DOCUMENTS_BY_TAB'), 'CalibrationPage must define empty state on new');
  assert.ok(pageContent.includes('activeDocument'), 'CalibrationPage must look up activeDocument by checksheetId');

  // 3. Verify CalibrationDocumentsTable has empty state "No checksheets added yet" when no checksheets are created
  const tablePath = path.join(adminRoot, 'src/components/calibration/CalibrationDocumentsTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');
  assert.ok(tableContent.includes('No checksheets added yet'), 'Table must show "No checksheets added yet" when list is empty');
});

test('28. Calibration table Edit action button opens modal to edit department, section, and checksheet details', () => {
  const tablePath = path.join(adminRoot, 'src/components/calibration/CalibrationDocumentsTable.jsx');
  const tableContent = fs.readFileSync(tablePath, 'utf8');
  assert.ok(tableContent.includes('onEdit'), 'Table must accept onEdit prop');
  assert.ok(tableContent.includes('onEdit(doc)'), 'Edit action button must invoke onEdit with doc');

  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes('handleOpenEditModal'), 'CalibrationPage must define handleOpenEditModal');
  assert.ok(pageContent.includes('onEdit: handleOpenEditModal'), 'CalibrationPage must pass onEdit to tabProps');
  assert.ok(pageContent.includes('isEditModalOpen'), 'CalibrationPage must manage isEditModalOpen state');
  assert.ok(pageContent.includes('editingDocument'), 'CalibrationPage must manage editingDocument state');

  const modalPath = path.join(adminRoot, 'src/components/calibration/AddChecksheetModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert.ok(modalContent.includes('editingDocument'), 'AddChecksheetModal must accept editingDocument');
  assert.ok(modalContent.includes('isEditMode'), 'AddChecksheetModal must support edit mode');
  assert.ok(modalContent.includes('Edit Checksheet Details'), 'AddChecksheetModal must display "Edit Checksheet Details" title in edit mode');
  assert.ok(modalContent.includes('Save Changes'), 'AddChecksheetModal must have Save Changes button in edit mode');
});

test('29. Selected unit persists across checksheet refresh and back navigation', () => {
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes('CALIBRATION_UNIT_STORAGE_KEY'), 'CalibrationPage must define unit storage key');
  assert.ok(pageContent.includes('handleSelectUnit'), 'CalibrationPage must define handleSelectUnit to persist selected plant');
  assert.ok(pageContent.includes('savedUnit'), 'CalibrationPage must restore savedUnit on load or checksheet refresh');
  assert.ok(pageContent.includes('activeDocument?.unit'), 'CalibrationPage must use activeDocument.unit if available');
});

test('30. Procedure tab has 6 fixed static documents, hides Add Checksheet button, and renders SOP checksheet from screenshots', () => {
  // 1. Verify procedure has 6 fixed documents and hides Add Checksheet button
  const pagePath = path.join(adminRoot, 'src/pages/calibration/CalibrationPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert.ok(pageContent.includes('FIXED_PROCEDURE_DOCUMENTS'), 'CalibrationPage must define FIXED_PROCEDURE_DOCUMENTS');
  assert.ok(pageContent.includes('procedureItems'), 'CalibrationPage must define procedureItems');

  const filterBarPath = path.join(adminRoot, 'src/components/calibration/CalibrationFilterBar.jsx');
  const filterBarContent = fs.readFileSync(filterBarPath, 'utf8');
  assert.ok(filterBarContent.includes("activeTabId !== 'procedure'"), 'FilterBar must hide Add Checksheet button on procedure tab');

  // 2. Verify StandardOperatingProcedureChecksheet exists and has all required sections from screenshots
  const sopPath = path.join(adminRoot, 'src/components/calibration/checksheets/StandardOperatingProcedureChecksheet.jsx');
  assert.ok(fs.existsSync(sopPath), 'StandardOperatingProcedureChecksheet.jsx must exist');
  const sopContent = fs.readFileSync(sopPath, 'utf8');

  assert.ok(sopContent.includes('PRC-WH-QA-007'), 'SOP must contain document code PRC-WH-QA-007');
  assert.ok(sopContent.includes('MEASURING & TEST DEVICE'), 'SOP must contain subtitle MEASURING & TEST DEVICE');
  assert.ok(sopContent.includes('Prepared By:- Khushboo'), 'SOP must contain Prepared By Khushboo');
  assert.ok(sopContent.includes('Checked By: Arvind'), 'SOP must contain Checked By Arvind');
  assert.ok(sopContent.includes('SignatureApprovalControl'), 'SOP must use SignatureApprovalControl for approvals');
  assert.ok(sopContent.includes('TITLE:'), 'SOP must contain Title section');
  assert.ok(sopContent.includes('PURPOSE:'), 'SOP must contain Purpose section');
  assert.ok(sopContent.includes('SCOPE:'), 'SOP must contain Scope section');
  assert.ok(sopContent.includes('Reference Documents / Standards:'), 'SOP must contain Reference Documents section');
  assert.ok(sopContent.includes('5 Activity detail of Process:'), 'SOP must contain Activity detail of Process');
  assert.ok(sopContent.includes('Calibration') && sopContent.includes('Decommissioning Report'), 'SOP must contain Calibration and Decommissioning Report groups');
  assert.ok(sopContent.includes('5.1') && sopContent.includes('5.19'), 'SOP must contain steps from 5.1 to 5.19');

  // 3. Verify CalibrationChecksheetView wires StandardOperatingProcedureChecksheet
  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('StandardOperatingProcedureChecksheet'), 'CalibrationChecksheetView must import StandardOperatingProcedureChecksheet');
  assert.ok(viewContent.includes('isProcedureSOP'), 'CalibrationChecksheetView must identify isProcedureSOP');
});

test('31. Annexure 1 checksheet renders workflow, Start/END hexagons, decision loop, and revision records', () => {
  const annex1Path = path.join(adminRoot, 'src/components/calibration/checksheets/Annexure1Checksheet.jsx');
  assert.ok(fs.existsSync(annex1Path), 'Annexure1Checksheet.jsx must exist');
  const content = fs.readFileSync(annex1Path, 'utf8');

  assert.ok(content.includes('ANNEXURE - 1'), 'Annexure 1 must have title ANNEXURE - 1');
  assert.ok(content.includes('Rule for esclaration for withdrawn the instruments'), 'Must contain exact subtitle');
  assert.ok(content.includes('PRC-WH-QA-007'), 'Must reference PRC-WH-QA-007');
  assert.ok(content.includes('Start') && content.includes('END'), 'Must contain Start and END shapes');
  assert.ok(content.includes('Monthly Plan of Calibration'), 'Must contain Step 1');
  assert.ok(content.includes('Check Monthly Plan of Calibration'), 'Must contain Step 2');
  assert.ok(content.includes('Is inst. under') && content.includes('due date?'), 'Must contain Step 3 Diamond');
  assert.ok(content.includes('Inform to concern person'), 'Must contain Step 4');
  assert.ok(content.includes('Collect the inst. for calibration'), 'Must contain Step 5');
  assert.ok(content.includes('Exchange the inst. with calibrated inst.(if applicable)'), 'Must contain Step 6');
  assert.ok(content.includes('Follow the inst. calibration procedure.'), 'Must contain Step 7');
  assert.ok(content.includes('Details of Change'), 'Must contain Revision Table header');
  assert.ok(content.includes('Original issue'), 'Must contain Rev 00 Original issue');
  assert.ok(content.includes('15.03.19'), 'Must contain Rev 01 date 15.03.19');
  assert.ok(content.includes('SignatureApprovalControl'), 'Must wire SignatureApprovalControl');

  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('Annexure1Checksheet'), 'CalibrationChecksheetView must import Annexure1Checksheet');
  assert.ok(viewContent.includes('isAnnexure1'), 'CalibrationChecksheetView must identify isAnnexure1');
});

test('32. Annexure 2 checksheet renders all 216 acceptance criteria rows, revision table, signatures, and footer', () => {
  const annex2Path = path.join(adminRoot, 'src/components/calibration/checksheets/Annexure2Checksheet.jsx');
  assert.ok(fs.existsSync(annex2Path), 'Annexure2Checksheet.jsx must exist');
  const content = fs.readFileSync(annex2Path, 'utf8');

  assert.ok(content.includes('ANNEXURE - 2'), 'Annexure 2 must have title ANNEXURE - 2');
  assert.ok(content.includes('ACCEPATANCE CRITERIA FOR CALIBRATION'), 'Must contain exact subtitle');
  assert.ok(content.includes('Deep Freezer/Cold Freezer'), 'Must contain item 1');
  assert.ok(content.includes('Durometer ( Shore -A- Hardness Tester)'), 'Must contain item 2');
  assert.ok(content.includes('SSG/TSN8-18M'), 'Must contain item 150');
  assert.ok(content.includes('SSE - SB - 6M'), 'Must contain item 151');
  assert.ok(content.includes('Kalvin Double Bridge'), 'Must contain item 159');
  assert.ok(content.includes('YY8 Protector Torque Jig'), 'Must contain item 213');
  assert.ok(content.includes('Stripping Gauge'), 'Must contain item 216');
  assert.ok(content.includes('sNo: 216'), 'Must contain all 216 rows');
  assert.ok(content.includes('ANNEXURE_2_DATA'), 'Must export ANNEXURE_2_DATA array');
  assert.ok(content.includes('isScaleGroupStart') && content.includes('inScaleGroup'), 'Must handle merged measuring scale criteria');
  assert.ok(content.includes('Details of Change'), 'Must contain Revision Table header');
  assert.ok(content.includes('Original issue'), 'Must contain Rev 0 Original issue');
  assert.ok(content.includes('15.03.19'), 'Must contain Rev 1 date 15.03.19');
  assert.ok(content.includes('FRM-WH-QA-214'), 'Must contain footer code FRM-WH-QA-214');
  assert.ok(content.includes('Issue Date: 25.02.2019'), 'Must contain footer issue date');
  assert.ok(content.includes('SignatureApprovalControl'), 'Must wire SignatureApprovalControl');

  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('Annexure2Checksheet'), 'CalibrationChecksheetView must import Annexure2Checksheet');
  assert.ok(viewContent.includes('isAnnexure2'), 'CalibrationChecksheetView must identify isAnnexure2');
});

test('33. Annexure 3 checksheet renders workflow, dual decision loops, return path to step 2, revision table, and footer', () => {
  const annex3Path = path.join(adminRoot, 'src/components/calibration/checksheets/Annexure3Checksheet.jsx');
  assert.ok(fs.existsSync(annex3Path), 'Annexure3Checksheet.jsx must exist');
  const content = fs.readFileSync(annex3Path, 'utf8');

  assert.ok(content.includes('ANNEXURE - 3'), 'Annexure 3 must have title ANNEXURE - 3');
  assert.ok(content.includes('Rule for declaration of instruments usable condition'), 'Must contain exact subtitle');
  assert.ok(content.includes('PRC-WH-QA-007'), 'Must reference PRC-WH-QA-007');
  assert.ok(content.includes('Area wise inst. calibration list circulate to concern person'), 'Must contain step 1');
  assert.ok(content.includes('Take the confirm on declaration sheet'), 'Must contain step 2');
  assert.ok(content.includes('Is declaration') && content.includes('report received ?'), 'Must contain step 3 diamond');
  assert.ok(content.includes('Match declaration report details from calibration plan'), 'Must contain step 4');
  assert.ok(content.includes('report match') && content.includes('calibration plan?'), 'Must contain step 5 diamond');
  assert.ok(content.includes('Follow the inst. calibration procedure.'), 'Must contain step 7');
  assert.ok(content.includes('Start') && content.includes('END'), 'Must contain Start and END shapes');
  assert.ok(content.includes('FRM-WH-QA-208'), 'Must reference FRM-WH-QA-208');
  assert.ok(content.includes('04.07.19'), 'Must contain Rev 00 date 04.07.19');
  assert.ok(content.includes('Original issue'), 'Must contain Rev 00 Original issue');
  assert.ok(content.includes('FRM-WH-QA-214'), 'Must contain footer code FRM-WH-QA-214');
  assert.ok(content.includes('Issue Date: 25.02.2019'), 'Must contain footer issue date');
  assert.ok(content.includes('SignatureApprovalControl'), 'Must wire SignatureApprovalControl');

  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('Annexure3Checksheet'), 'CalibrationChecksheetView must import Annexure3Checksheet');
  assert.ok(viewContent.includes('isAnnexure3'), 'CalibrationChecksheetView must identify isAnnexure3');
});

test('34. Scope for calibration and Scope for inspection checksheets render exact rows, columns, and headers', () => {
  const scopeCalPath = path.join(adminRoot, 'src/components/calibration/checksheets/ScopeForCalibrationChecksheet.jsx');
  assert.ok(fs.existsSync(scopeCalPath), 'ScopeForCalibrationChecksheet.jsx must exist');
  const calContent = fs.readFileSync(scopeCalPath, 'utf8');

  assert.ok(calContent.includes('Scope for calibration instruments in-house'), 'Must have title Scope for calibration instruments in-house');
  assert.ok(calContent.includes('Sr. No.'), 'Must have Sr. No. column');
  assert.ok(calContent.includes('Instrument Name'), 'Must have Instrument Name column');
  assert.ok(calContent.includes('Calibration Range'), 'Must have Calibration Range column');
  assert.ok(calContent.includes('Source'), 'Must have Source column');
  assert.ok(calContent.includes('Master equipment'), 'Must have Master equipment column');
  assert.ok(calContent.includes('Master equipment No.'), 'Must have Master equipment No. column');
  assert.ok(calContent.includes('Calibration Method'), 'Must have Calibration Method column');
  assert.ok(calContent.includes('Digital Point Micrometer'), 'Must contain item 1');
  assert.ok(calContent.includes('YY8 Protector Torque Jig'), 'Must contain item 8');
  assert.ok(calContent.includes('Nir-007 Pigital Checking Jig S Ab'), 'Must contain item 20');
  assert.ok(calContent.includes('SZR017 [FFC-2] BENDING JIG'), 'Must contain item 25');
  assert.ok(calContent.includes('Mandrel'), 'Must contain item 44');
  assert.ok(calContent.includes('sNo: 45'), 'Must contain all 45 calibration rows');

  const scopeInspPath = path.join(adminRoot, 'src/components/calibration/checksheets/ScopeForInspectionChecksheet.jsx');
  assert.ok(fs.existsSync(scopeInspPath), 'ScopeForInspectionChecksheet.jsx must exist');
  const inspContent = fs.readFileSync(scopeInspPath, 'utf8');

  assert.ok(inspContent.includes('Scope for Inspection &amp; testing') || inspContent.includes('Scope for Inspection & testing'), 'Must have title Scope for Inspection & testing');
  assert.ok(inspContent.includes('Sr. No.'), 'Must have Sr. No. column');
  assert.ok(inspContent.includes('Part Name'), 'Must have Part Name column');
  assert.ok(inspContent.includes('Part type'), 'Must have Part type column');
  assert.ok(inspContent.includes('Source'), 'Must have Source column');
  assert.ok(inspContent.includes('Standard name'), 'Must have Standard name column');
  assert.ok(inspContent.includes('Person Competent'), 'Must have Person Competent column');
  assert.ok(inspContent.includes('Master Instrument/Eqp. Used'), 'Must have Master Instrument/Eqp. Used column');
  assert.ok(inspContent.includes('Wire Stripper Jig'), 'Must contain item 46');
  assert.ok(inspContent.includes('Digital Weihing Blance'), 'Must contain item 49');
  assert.ok(inspContent.includes('Pressure gauge'), 'Must contain pressure gauge items');
  assert.ok(inspContent.includes('Digital micro ohm meter'), 'Must contain item 53');
  assert.ok(inspContent.includes('Busbar Arrangement Jig'), 'Must contain item 71');
  assert.ok(inspContent.includes('TSN-8M'), 'Must contain item 72');
  assert.ok(inspContent.includes('Pigital Measuring Template For Xba/Xbb'), 'Must contain item 78');
  assert.ok(inspContent.includes('YSN-8M'), 'Must contain item 85');
  assert.ok(inspContent.includes('Right Angle'), 'Must contain item 90');
  assert.ok(inspContent.includes('sNo: 90'), 'Must contain all rows up to 90');

  const viewPath = path.join(adminRoot, 'src/components/calibration/CalibrationChecksheetView.jsx');
  const viewContent = fs.readFileSync(viewPath, 'utf8');
  assert.ok(viewContent.includes('ScopeForCalibrationChecksheet'), 'CalibrationChecksheetView must import ScopeForCalibrationChecksheet');
  assert.ok(viewContent.includes('ScopeForInspectionChecksheet'), 'CalibrationChecksheetView must import ScopeForInspectionChecksheet');
  assert.ok(viewContent.includes('isScopeCalibration'), 'CalibrationChecksheetView must identify isScopeCalibration');
  assert.ok(viewContent.includes('isScopeInspection'), 'CalibrationChecksheetView must identify isScopeInspection');
});
