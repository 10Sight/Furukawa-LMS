/**
 * Process Flow Chart Storage Engine
 * Hybrid IndexedDB + LocalStorage for robust, zero-quota frontend persistence
 */

const DB_NAME = 'FME_ProcessFlowChart_DB';
const DB_VERSION = 1;
const STORE_NAME = 'process_flow_chart_sheets';

function openDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (err) => {
        console.warn('IndexedDB open error, falling back:', err);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      resolve(null);
    }
  });
}

export async function saveProcessFlowChartSheet(sheetId, payload) {
  let idbSaved = false;

  // 1. Save to IndexedDB
  try {
    const db = await openDB();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = {
          id: sheetId,
          ...payload,
          savedAt: new Date().toISOString(),
        };
        const req = store.put(record);
        req.onsuccess = () => {
          idbSaved = true;
          resolve();
        };
        req.onerror = () => resolve();
        tx.oncomplete = () => {
          idbSaved = true;
          resolve();
        };
        tx.onerror = () => resolve();
      });
    }
  } catch (err) {
    console.warn('Error saving to IndexedDB:', err);
  }

  // 2. Also try localStorage
  try {
    localStorage.setItem(`pfc_sheet_${sheetId}`, JSON.stringify(payload));
  } catch (quotaErr) {
    console.warn('localStorage quota exceeded. Stored safely in IndexedDB.', quotaErr);
    if (!idbSaved) {
      throw quotaErr;
    }
  }

  return true;
}

export async function loadProcessFlowChartSheet(sheetId) {
  // 1. Try IndexedDB
  try {
    const db = await openDB();
    if (db) {
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(sheetId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (record) return record;
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
  }

  // 2. Try localStorage
  try {
    const raw = localStorage.getItem(`pfc_sheet_${sheetId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn('Error reading from localStorage:', err);
  }

  return null;
}

export function getInitialSyncPfcState(sheetId) {
  try {
    const raw = localStorage.getItem(`pfc_sheet_${sheetId}`);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    // ignore
  }
  return null;
}

