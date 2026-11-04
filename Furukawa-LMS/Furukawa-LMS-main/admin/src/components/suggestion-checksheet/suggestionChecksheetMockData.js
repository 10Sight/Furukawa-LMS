export const DUMMY_RECORD_IDS = new Set([
  'SC-BWL-1021',
  'SC-BWL-1024',
  'SC-BWL-1029',
  'SC-GJT-2015',
  'SC-GJT-2018',
  'SC-GJR-2015',
]);

export const INITIAL_SUGGESTION_CHECKSHETS = [];

const STORAGE_KEY = 'fme_suggestion_checksheets';

export function getStoredSuggestionChecksheets() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((rec) => !DUMMY_RECORD_IDS.has(rec?.id));
        if (clean.length !== parsed.length) {
          saveStoredSuggestionChecksheets(clean);
        }
        return clean;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored suggestion checksheets:', err);
  }
  return [];
}

export function saveStoredSuggestionChecksheets(records) {
  if (typeof window === 'undefined') return;
  try {
    const clean = Array.isArray(records) ? records.filter((rec) => !DUMMY_RECORD_IDS.has(rec?.id)) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (err) {
    console.warn('Failed to save suggestion checksheets to storage:', err);
  }
}
