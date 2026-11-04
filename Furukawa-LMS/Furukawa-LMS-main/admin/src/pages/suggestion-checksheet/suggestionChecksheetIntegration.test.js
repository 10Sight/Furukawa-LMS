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


