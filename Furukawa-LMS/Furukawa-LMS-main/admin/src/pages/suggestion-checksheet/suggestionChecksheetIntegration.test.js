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
