import { loadPDCA, commitPDCA, addPDCA, updatePDCA, PDCA_STORAGE_KEY } from '../data/pdcaStore';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { initialPDCAData } from '../data/mockData';
import pdcaApi from '@/services/api/pdcaApi.js';

export const PDCAContext = createContext(null);

function getInitialUserContext() {
  try {
    const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
                (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (u.fullName || u.name || u.userName)) {
        const departments = (Array.isArray(u.departments) ? u.departments : []).filter(item => item && typeof item === 'object');
        const sections = Array.isArray(u.sections) ? u.sections : [];
        const sectionId = u.sectionId?.id || u.sectionId?._id || u.sectionId || u.sections?.[0]?.id || u.sections?.[0]?._id || u.sections?.[0];
        const section = (Array.isArray(sections) ? sections : []).find(item => String(item.id || item._id) === String(sectionId));
        return {
          loading: false,
          user: {
            name: u.fullName || u.name || u.userName || '',
            code: u.employeeId || u.empId || u.empCode || u.userName || '',
            email: u.email || ''
          },
          section: {
            id: section?.id || section?._id || sectionId || '',
            name: section?.name || u.section?.name || u.sectionName || u.sectionId?.name || u.sections?.[0]?.name || ''
          },
          departments: departments.map(item => ({ id: item.id || item._id, name: item.name })),
          error: false
        };
      }
    }
  } catch (e) {
    console.error('Failed reading user from storage', e);
  }
  return { loading: true, departments: [], user: {}, section: {} };
}

export function PDCAProvider({ children }) {
  const [userContext, setUserContext] = useState(getInitialUserContext);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const receive = event => {
      if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'fme-cms-user-context') {
        setUserContext(prev => ({
          ...prev,
          ...event.data,
          loading: false
        }));
      }
    };
    window.addEventListener('message', receive);
    try {
      window.parent.postMessage({ type: 'fme-cms-user-context-request', page: 'pdca' }, window.location.origin);
    } catch {}
    return () => window.removeEventListener('message', receive);
  }, []);

  const [data, publishData] = useState(() => {
    try { return loadPDCA(initialPDCAData); } catch { return initialPDCAData; }
  });

  const setData = useCallback(update => {
    const saved = commitPDCA(update, initialPDCAData);
    publishData(saved);
    return saved;
  }, []);

  // Fetch real data from backend API
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await pdcaApi.getRecords();
      const records = res?.records || (Array.isArray(res) ? res : null);
      if (Array.isArray(records) && records.length > 0) {
        publishData(records);
        try { commitPDCA(records, initialPDCAData); } catch {}
      }
    } catch (err) {
      console.warn('Could not fetch records from backend, using cached records:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    const sync = event => {
      if (event.key !== PDCA_STORAGE_KEY) return;
      try { publishData(loadPDCA(initialPDCAData)); }
      catch { showToast('Saved PDCA records could not be loaded. Please keep your form open.'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddPDCA = async (newItem) => {
    try {
      const created = await pdcaApi.createRecord(newItem);
      const savedRecord = created || newItem;
      setData(records => addPDCA(records, savedRecord));
      showToast(`✓ Created: ${savedRecord.id}`);
      return savedRecord;
    } catch (err) {
      setData(records => addPDCA(records, newItem));
      showToast(`✓ Created: ${newItem.id}`);
      return newItem;
    }
  };

  const handleUpdatePDCA = async (updated) => {
    try {
      await pdcaApi.updateRecord(updated.id, updated);
    } catch (err) {
      console.warn('Backend update error, saving locally:', err);
    }
    setData(records => updatePDCA(records, updated));
    showToast(`✓ Updated: ${updated.id}`);
  };

  const handleDeletePDCA = async (id) => {
    try {
      await pdcaApi.deleteRecord(id);
    } catch (err) {
      console.warn('Backend delete error:', err);
    }
    const nextData = setData(prev => {
      const targetIndex = prev.findIndex(record => String(record.id) === String(id));
      if (targetIndex < 0) return prev;
      return prev.filter((_, index) => index !== targetIndex);
    });
    showToast(`Deleted ${id}`);
    return nextData;
  };

  const handleSaveMembers = async (itemId, members) => {
    try {
      await pdcaApi.updateCftMembers(itemId, members);
    } catch (err) {
      console.warn('Backend member update error:', err);
    }
    setData((prev) =>
      prev.map((d) => (d.id === itemId ? { ...d, assignedMembers: members } : d))
    );
    showToast(`✓ Updated team members for ${itemId}`);
  };

  const value = {
    userContext,
    loading,
    data,
    setData,
    refreshData,
    toastMessage,
    showToast,
    handleAddPDCA,
    handleUpdatePDCA,
    handleDeletePDCA,
    handleSaveMembers
  };
  return <PDCAContext.Provider value={value}>{children}</PDCAContext.Provider>;
}

export function usePDCA() {
  const context = useContext(PDCAContext);
  if (!context) {
    throw new Error('usePDCA must be used within a PDCAProvider');
  }
  return context;
}
