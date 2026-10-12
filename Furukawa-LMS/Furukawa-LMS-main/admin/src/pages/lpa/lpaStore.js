import { validateWorkbook } from './lpaValidation.js';

let database;

function createRecordId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);

  // randomUUID is only available in secure contexts in some browsers. Use
  // getRandomValues where possible, with a fallback for older embedded CMS contexts.
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('Browser storage is unavailable. Please enable site storage to save LPA workbooks.'));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('fme-cms-lpa', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('workbooks', { keyPath: 'id' });
      store.createIndex('ownerId', 'ownerId');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Browser storage is blocked by another tab. Close that tab and retry.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = null; };
      resolve(db);
    };
  }).catch(error => { database = null; throw error; });
  return database;
}

async function transaction(mode, run) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workbooks', mode);
    let result;
    let failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error('LPA could not be saved to browser storage. Your edits are retained.'));
    tx.onerror = () => { failure ||= tx.error; };
    const fail = error => { failure = error; tx.abort(); };
    try { run(tx.objectStore('workbooks'), value => { result = value; }, fail); }
    catch (error) { fail(error); }
  });
}

export function listLPAWorkbooks(ownerId) {
  return transaction('readonly', (store, done) => {
    const request = store.index('ownerId').getAll(String(ownerId));
    request.onsuccess = () => done(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });
}

export function createLPAWorkbook(ownerId, workbook) {
  const body = validateWorkbook(workbook);
  const timestamp = new Date().toISOString();
  const record = { ...structuredClone(body), id: createRecordId(), ownerId: String(ownerId), version: 1, createdAt: timestamp, updatedAt: timestamp };
  return transaction('readwrite', (store, done) => { store.add(record); done(record); });
}

export function nextLPARevision(ownerId, saved, workbook) {
  const body = validateWorkbook(workbook);
  if (!saved || saved.ownerId !== String(ownerId) || saved.section !== body.section || saved.version !== workbook.version) {
    throw new Error('This workbook changed in another tab or is unavailable. Your edits are retained. Reopen the latest saved workbook before applying them.');
  }
  return { ...saved, ...structuredClone(body), version: saved.version + 1, updatedAt: new Date().toISOString() };
}

export function saveLPAWorkbook(ownerId, workbook) {
  return transaction('readwrite', (store, done, fail) => {
    const request = store.get(workbook.id);
    request.onsuccess = () => {
      try {
        const record = nextLPARevision(ownerId, request.result, workbook);
        store.put(record);
        done(record);
      } catch (error) { fail(error); }
    };
  });
}

export function deleteLPAWorkbook(ownerId, workbookId) {
  return transaction('readwrite', (store, done, fail) => {
    const request = store.get(workbookId);
    request.onsuccess = () => {
      const record = request.result;
      if (!record || record.ownerId !== String(ownerId)) {
        fail(new Error('This workbook is unavailable or belongs to another user.'));
        return;
      }
      store.delete(workbookId);
      done(true);
    };
  });
}
