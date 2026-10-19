import { validateWorkbook } from './lpaValidation.js';
import lpaApi from '@/services/api/lpaApi.js';
import * as XLSX from 'xlsx';

export const SECTIONS = { assembly: 'Assembly', cc: 'C&C' };
export const storageKey = (section) => `fme_lpa_${section}`;

let database;

function createRecordId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('Browser storage is unavailable. Please enable site storage to save LPA workbooks.'));
  }
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('fme-cms-lpa', 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('workbooks')) {
          const store = db.createObjectStore('workbooks', { keyPath: 'id' });
          store.createIndex('ownerId', 'ownerId');
          store.createIndex('section', 'section');
          store.createIndex('unit', 'unit');
        }
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Browser storage is blocked by another tab. Close that tab and retry.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          database = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      database = null;
      throw error;
    });
  }
  return database;
}

async function transaction(mode, run) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('workbooks', mode);
      let result;
      let failure;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('LPA could not be saved to browser storage.'));
      tx.onerror = () => {
        failure ||= tx.error;
      };
      const fail = (error) => {
        failure = error;
        tx.abort();
      };
      try {
        run(
          tx.objectStore('workbooks'),
          (value) => {
            result = value;
          },
          fail
        );
      } catch (error) {
        fail(error);
      }
    });
  } catch (err) {
    console.warn('IndexedDB transaction failed:', err);
    return null;
  }
}

/**
 * Sync server records to local IndexedDB cache
 */
async function syncToIndexedDB(records) {
  if (!Array.isArray(records)) return;
  try {
    await transaction('readwrite', (store, done) => {
      for (const rec of records) {
        if (rec && rec.id) {
          store.put(rec);
        }
      }
      done(true);
    });
  } catch (err) {
    console.warn('Could not sync to local IndexedDB cache:', err);
  }
}

/**
 * List all LPA workbooks from the backend database (with offline cache fallback)
 */
export async function listLPAWorkbooks(ownerId, filters = {}) {
  const queryParams = typeof ownerId === 'object' && ownerId !== null ? ownerId : { ...filters };
  if (typeof ownerId === 'string' && ownerId && ownerId !== 'current') {
    queryParams.ownerId = ownerId;
  }

  try {
    // Attempt backend API fetch
    const response = await lpaApi.getRecords(queryParams);
    const records = Array.isArray(response) ? response : response?.records || [];

    // Background cache update
    syncToIndexedDB(records);

    return records.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch (apiError) {
    console.warn('LPA backend unavailable, falling back to local storage cache:', apiError?.message || apiError);

    // Fallback to local IndexedDB cache
    const local = await transaction('readonly', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        done(all.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
      };
    });

    if (local && local.length > 0) {
      return local;
    }

    // Fallback to localStorage if IndexedDB is also empty
    try {
      const localStr = localStorage.getItem('fme_lpa_records_cache');
      if (localStr) {
        return JSON.parse(localStr);
      }
    } catch { }

    throw apiError;
  }
}

/**
 * Create a new LPA workbook record permanently in the backend database
 */
export async function createLPAWorkbook(ownerIdOrWorkbook, maybeWorkbook) {
  const workbook = maybeWorkbook !== undefined ? maybeWorkbook : ownerIdOrWorkbook;
  const ownerId = maybeWorkbook !== undefined ? ownerIdOrWorkbook : (workbook?.ownerId || 'current');

  const validated = validateWorkbook(workbook);
  const payload = {
    ...validated,
    ownerId: String(ownerId)
  };

  try {
    const created = await lpaApi.createRecord(payload);
    const record = created?.id ? created : { ...payload, id: created?._id || createRecordId() };

    // Update local cache
    await transaction('readwrite', (store, done) => {
      store.put(record);
      done(record);
    });

    return record;
  } catch (apiError) {
    console.warn('Failed saving LPA record to backend API, saving locally:', apiError?.message || apiError);

    // Offline recovery save
    const timestamp = new Date().toISOString();
    const offlineRecord = {
      ...payload,
      id: payload.id || createRecordId(),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      _isOfflineDraft: true
    };

    await transaction('readwrite', (store, done) => {
      store.put(offlineRecord);
      done(offlineRecord);
    });

    return offlineRecord;
  }
}

export function nextLPARevision(ownerId, saved, workbook) {
  const body = validateWorkbook(workbook);
  if (!saved || saved.ownerId !== String(ownerId) || saved.section !== body.section || saved.version !== workbook.version) {
    throw new Error('This workbook changed in another tab or is unavailable. Your edits are retained. Reopen the latest saved workbook before applying them.');
  }
  return { ...saved, ...structuredClone(body), version: saved.version + 1, updatedAt: new Date().toISOString() };
}

/**
 * Save / Update an existing LPA workbook in the backend database
 */
export async function saveLPAWorkbook(ownerIdOrWorkbook, maybeWorkbook) {
  const workbook = maybeWorkbook !== undefined ? maybeWorkbook : ownerIdOrWorkbook;
  const ownerId = maybeWorkbook !== undefined ? ownerIdOrWorkbook : (workbook?.ownerId || 'current');

  const validated = validateWorkbook(workbook);
  const targetId = workbook.id || validated.id;

  if (!targetId) {
    return createLPAWorkbook(ownerId, validated);
  }

  const payload = {
    ...validated,
    id: targetId,
    ownerId: String(ownerId)
  };

  try {
    const updated = await lpaApi.updateRecord(targetId, payload);
    const record = updated?.id ? updated : { ...payload, id: targetId, updatedAt: new Date().toISOString() };

    // Cache locally
    await transaction('readwrite', (store, done) => {
      store.put(record);
      done(record);
    });

    return record;
  } catch (apiError) {
    console.warn('Backend update failed, persisting locally to avoid losing data:', apiError?.message || apiError);

    // Fallback to local save
    return transaction('readwrite', (store, done, fail) => {
      const request = store.get(targetId);
      request.onsuccess = () => {
        try {
          const current = request.result || validated;
          const nextRecord = {
            ...current,
            ...validated,
            updatedAt: new Date().toISOString(),
            _isOfflineDraft: true
          };
          store.put(nextRecord);
          done(nextRecord);
        } catch (err) {
          fail(err);
        }
      };
      request.onerror = () => fail(request.error);
    });
  }
}

/**
 * Delete an LPA record from the database
 */
export async function deleteLPAWorkbook(ownerIdOrWorkbookId, maybeWorkbookId) {
  const workbookId = maybeWorkbookId !== undefined ? maybeWorkbookId : ownerIdOrWorkbookId;
  const ownerId = maybeWorkbookId !== undefined ? ownerIdOrWorkbookId : 'current';

  try {
    await lpaApi.deleteRecord(workbookId);
  } catch (apiError) {
    console.warn('Backend delete request failed:', apiError?.message || apiError);
  }

  // Remove from local IndexedDB cache
  await transaction('readwrite', (store, done, fail) => {
    const request = store.delete(workbookId);
    request.onsuccess = () => done(true);
    request.onerror = () => done(true);
  });

  return true;
}

/**
 * Retrieve a single LPA record by ID
 */
export async function getLPAWorkbookById(id) {
  try {
    return await lpaApi.getRecord(id);
  } catch {
    return transaction('readonly', (store, done) => {
      const request = store.get(id);
      request.onsuccess = () => done(request.result || null);
    });
  }
}

// -------------------------------------------------------------
// Legacy & Compatibility Helpers for LpaApp / LpaSource / Tests
// -------------------------------------------------------------

export function parseWorkbook(fileData, fileName) {
  if (!fileData || (fileData.byteLength !== undefined && fileData.byteLength === 0)) {
    throw new Error('Workbook file is empty.');
  }
  const workbook = XLSX.read(fileData, { type: typeof fileData === 'string' ? 'binary' : 'array', cellNF: true, cellStyles: true });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G48');
    const rows = [];
    const columns = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      columns.push({ name: XLSX.utils.encode_col(c), index: c });
    }
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        row.push({
          text: cell?.w ?? String(cell?.v ?? ''),
          value: cell?.v ?? '',
          type: cell?.t ?? 's'
        });
      }
      rows.push(row);
    }
    return {
      name: sheetName,
      startRow: range.s.r,
      startCol: range.s.c,
      rows,
      columns,
      merges: (ws['!merges'] || []).map((m) => ({ ...m }))
    };
  });

  return {
    fileName: fileName || 'Imported.xlsx',
    sheets
  };
}

export function saveWorkbook(section, workbook) {
  const key = storageKey(section);
  localStorage.setItem(key, JSON.stringify(workbook));
}

export function loadWorkbook(section) {
  const key = storageKey(section);
  const data = localStorage.getItem(key);
  if (!data) return null;
  return JSON.parse(data);
}

export function editCell(cell, value) {
  return {
    ...cell,
    text: String(value ?? ''),
    value: value ?? ''
  };
}

export function sourceObservations(sheet, section) {
  return [];
}

export function ensureLinkedPDCA(section, sheetName) {
  return `lpa-pdca-${section}-${sheetName}`;
}
