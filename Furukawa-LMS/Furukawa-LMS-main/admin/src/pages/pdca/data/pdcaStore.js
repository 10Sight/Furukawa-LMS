import { commitSaved } from '../../../components/shared/formPersistence.js';
import { PDCA_DEPARTMENTS } from './pdcaConstants.js';
export { PDCA_DEPARTMENTS };
export const PDCA_STORAGE_KEY = 'pdca_dashboard_items';
export const PDCA_SCOPES = ['Company', 'Department', 'Self PDCA', 'CFT'];

export function createEmptyRow(customDefaults = {}) {
  return {
    date: customDefaults.date || '',
    shift: customDefaults.shift || '',
    lineArea: customDefaults.lineArea || '',
    status: customDefaults.status || 'Open',
    observation: customDefaults.observation || '',
    imagesBefore: Array.isArray(customDefaults.imagesBefore)
      ? customDefaults.imagesBefore
      : (customDefaults.imageBefore ? [{ id: 'legacy-before-0', url: customDefaults.imageBefore, name: customDefaults.imageBeforeName || 'Before Image', type: customDefaults.fileTypeBefore || 'image' }] : []),
    imageBefore: customDefaults.imageBefore || null,
    imageBeforeName: customDefaults.imageBeforeName || '',
    fileTypeBefore: customDefaults.fileTypeBefore || 'image',
    rootCause: customDefaults.rootCause || '',
    counterMeasure: customDefaults.counterMeasure || '',
    imagesAfter: Array.isArray(customDefaults.imagesAfter)
      ? customDefaults.imagesAfter
      : (customDefaults.imageAfter ? [{ id: 'legacy-after-0', url: customDefaults.imageAfter, name: customDefaults.imageAfterName || 'After Image', type: customDefaults.fileTypeAfter || 'image' }] : []),
    imageAfter: customDefaults.imageAfter || null,
    imageAfterName: customDefaults.imageAfterName || '',
    fileTypeAfter: customDefaults.fileTypeAfter || 'image',
    responseDate: customDefaults.responseDate || '',
    department: customDefaults.department || '',
    staffEmployee: customDefaults.staffEmployee || '',
    assignedEmployee: customDefaults.assignedEmployee || '',
    cftTopic: customDefaults.cftTopic || '',
    cftTopicId: customDefaults.cftTopicId || '',
    cftSelectedType: customDefaults.cftSelectedType || '',
    cftSelectedName: customDefaults.cftSelectedName || '',
    cftSelectedCode: customDefaults.cftSelectedCode || '',
    responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || ''
  };
}

export function createDefaultRows(count = 10, customDefaults = {}) {
  return Array.from({ length: count }, () => createEmptyRow(customDefaults));
}

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
  if (!Array.isArray(records)) {
    return fallback;
  }
  records = records.filter(record => record && typeof record === 'object' && (record.id || record.recordId));
  // Strip legacy mock records if present in browser storage
  records = records.filter(record => !String(record.id || '').startsWith('PDCA-ASY-BW-'));
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
  const list = Array.isArray(records) ? records : [];
  if (!item.id || list.some(record => (record.id && record.id === item.id) || (record.recordId && record.recordId === item.id))) {
    throw new Error('This PDCA ID already exists. Please try again.');
  }
  return [item, ...list];
}
export function updatePDCA(records, item) {
  if (!item.topic?.trim()) throw new Error('Please enter a topic.');
  if (!PDCA_SCOPES.includes(item.scope)) throw new Error('Please select a valid PDCA category.');
  const list = Array.isArray(records) ? records : [];
  const existingIdx = list.findIndex(record => (record.id && record.id === item.id) || (record.recordId && record.recordId === item.id));
  if (existingIdx < 0) throw new Error('This PDCA no longer exists.');
  const copy = [...list];
  copy[existingIdx] = { ...copy[existingIdx], ...item };
  return copy;
}

