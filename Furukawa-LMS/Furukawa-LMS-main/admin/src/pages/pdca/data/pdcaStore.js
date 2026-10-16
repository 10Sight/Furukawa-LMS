import { commitSaved } from '../../../components/shared/formPersistence.js';
import { PDCA_DEPARTMENTS } from './pdcaConstants.js';
export { PDCA_DEPARTMENTS };
export const PDCA_STORAGE_KEY = 'pdca_dashboard_items';
export const PDCA_SCOPES = ['Company', 'Department', 'Self PDCA', 'CFT'];

export function createEmptyRow(customDefaults = {}) {
  return {
    date: customDefaults.date || '',
    shift: customDefaults.shift || '',
    status: customDefaults.status || 'Open',
    department: customDefaults.department || '',
    unit: customDefaults.unit || '',
    section: customDefaults.section || '',
    sectionId: customDefaults.sectionId ?? customDefaults.lineAreaSectionId ?? null,
    sectionCode: customDefaults.sectionCode || '',
    lineArea: customDefaults.lineArea || '',
    lineAreaSectionId: customDefaults.lineAreaSectionId ?? customDefaults.sectionId ?? null,
    lineAreaId: customDefaults.lineAreaId ?? null,
    lineAreaCode: customDefaults.lineAreaCode || '',
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
    responsiblePersonDept: customDefaults.responsiblePersonDept || customDefaults.department || '',
    staffEmployee: customDefaults.staffEmployee || '',
    staffEmployees: Array.isArray(customDefaults.staffEmployees) ? customDefaults.staffEmployees : [],
    staffName: customDefaults.staffName || '',
    staffId: customDefaults.staffId || '',
    employeeId: customDefaults.employeeId || customDefaults.staffId || '',
    assignedEmployee: customDefaults.assignedEmployee || '',
    cftTopic: customDefaults.cftTopic || '',
    cftTopicId: customDefaults.cftTopicId || '',
    cftSelectedType: customDefaults.cftSelectedType || '',
    cftSelectedName: customDefaults.cftSelectedName || '',
    cftSelectedCode: customDefaults.cftSelectedCode || '',
    confirmation: customDefaults.confirmation || '',
    responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || customDefaults.staffEmployee || ''
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
  const DUMMY_IDS = new Set(['PDCA-GJ-101', 'PDCA-BW-102', 'PDCA-GJ-103', 'PDCA-BW-104', 'CFT-GJ-201', 'CFT-BW-202']);
  const DUMMY_TOPICS = new Set([
    'Reduction of Solder Bridge Defects in ECU Assembly',
    'Die-Casting Cycle Time Optimization on Cell #4',
    'Forklift Traffic Collision Prevention IoT Radar',
    'Air Compressor Energy Leakage Elimination',
    'Team Composition & Role',
    'Alignment & Goal Setting',
    'Assembly Line 3 - Pneumatic Crimper Pressure Drop Detection Alarm',
    'Assembly Line 2 - Conveyor Belt Speed Synchronization with Pick-and-Place',
    'C&C Area - CNC Milling Center #3 Spindle Runout Laser Alignment Audit',
    'Press Shop - Progressive Stamping Die Strip Mis-feed Optical Sensor Calibration',
    'Die Casting Area - Mold Water Cooling Channel Descaling & Flow Rate Verification',
    'Zero Defect Assembly CFT',
    'Automated Line Solder Inspection Updated'
  ]);
  // Strip dummy records if present in browser storage
  records = records.filter(record => {
    const id = String(record.id || record.recordId || '');
    if (DUMMY_IDS.has(id) || id.startsWith('PDCA-ASY-BW-') || id.startsWith('PDCA-CC-BW-')) return false;
    if (record.topic && DUMMY_TOPICS.has(record.topic.trim())) return false;
    return true;
  });
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

