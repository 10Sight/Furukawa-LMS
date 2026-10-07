import { commitSaved } from '../../../components/shared/formPersistence.js';
export const PDCA_STORAGE_KEY = 'pdca_dashboard_items';
export const PDCA_SCOPES = ['Company', 'Department', 'Self PDCA', 'CFT'];
export function loadPDCA(fallback) {
  const raw = localStorage.getItem(PDCA_STORAGE_KEY);
  if (raw === null) return fallback;
  const records = JSON.parse(raw);
  if (!Array.isArray(records) || records.some(record => !record || typeof record !== 'object' || ['id', 'topic', 'plant', 'scope', 'description', 'date', 'time'].some(field => record[field] != null && typeof record[field] !== 'string') || (record.createdBy && ['name', 'code', 'initials'].some(field => record.createdBy[field] != null && typeof record.createdBy[field] !== 'string')))) throw new Error('Saved PDCA records could not be read.');
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

