import { commitSaved } from '../../../components/shared/formPersistence.js';
import { PDCA_DEPARTMENTS } from './pdcaConstants.js';
export { PDCA_DEPARTMENTS };
export const PDCA_STORAGE_KEY = 'pdca_dashboard_items';
export const PDCA_SCOPES = ['Company', 'Department', 'Self PDCA', 'CFT'];
export function loadPDCA(fallback) {
  const raw = localStorage.getItem(PDCA_STORAGE_KEY);
  if (raw === null) {
    if (Array.isArray(fallback) && fallback.length > 0) {
      try { commitSaved(PDCA_STORAGE_KEY, fallback); } catch {}
    }
    return fallback;
  }
  let records;
  try {
    records = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!Array.isArray(records) || records.some(record => !record || typeof record !== 'object' || ['id', 'topic', 'plant', 'scope', 'description', 'date', 'time'].some(field => record[field] != null && typeof record[field] !== 'string') || (record.createdBy && ['name', 'code', 'initials'].some(field => record.createdBy[field] != null && typeof record.createdBy[field] !== 'string')))) {
    return fallback;
  }
  // Ensure newly seeded records from fallback are merged into existing local storage
  if (Array.isArray(fallback) && fallback.length > 0) {
    const existingIds = new Set(records.map(r => r.id || r.recordId));
    const missing = fallback.filter(f => !existingIds.has(f.id && f.recordId ? f.id : (f.id || f.recordId)));
    if (missing.length > 0) {
      records = [...missing, ...records];
      try { commitSaved(PDCA_STORAGE_KEY, records); } catch {}
    }
  }
  return records;
}
export function commitPDCA(update, fallback) {
  // Read the latest saved collection, including records created in another page/tab.
  const previous = loadPDCA(fallback);
  const next = typeof update === 'function' ? update(previous) : update;
  commitSaved(PDCA_STORAGE_KEY, next);
  return next;
}
export function addPDCA(records, item) {
  if (!item.topic?.trim()) throw new Error('Please enter a topic.');
  if (!PDCA_SCOPES.includes(item.scope)) throw new Error('Please select a valid PDCA category.');
  if (!['Bawal', 'Gujrat'].includes(item.plant)) throw new Error('Please select Bawal or Gujrat.');
  if (!item.id || records.some(record => record.id === item.id)) throw new Error('This PDCA ID already exists. Please try again.');
  return [item, ...records];
}
export function updatePDCA(records, item) {
  if (!item.topic?.trim()) throw new Error('Please enter a topic.');
  if (!PDCA_SCOPES.includes(item.scope)) throw new Error('Please select a valid PDCA category.');
  if (!records.some(record => record.id === item.id)) throw new Error('This PDCA no longer exists.');
  return records.map(record => record.id === item.id ? { ...record, ...item } : record);
}

