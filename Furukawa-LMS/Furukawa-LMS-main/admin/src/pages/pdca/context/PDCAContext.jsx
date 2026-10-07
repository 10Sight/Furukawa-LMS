import { loadPDCA, commitPDCA, addPDCA, updatePDCA, PDCA_STORAGE_KEY } from '../data/pdcaStore';
import { confirmFormDeletion } from '@components/shared/confirmFormDeletion';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { initialPDCAData } from '../data/mockData';

const PDCAContext = createContext(null);

export function PDCAProvider({ children }) {
  const [userContext, setUserContext] = useState({ loading: true, departments: [], user: {}, section: {} });
  useEffect(() => {
    const receive = event => {
      if (event.origin === window.location.origin && event.source === window.parent && event.data?.type === 'fme-cms-user-context') setUserContext(event.data);
    };
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'fme-cms-user-context-request', page: 'pdca' }, window.location.origin);
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
  useEffect(() => {
    const sync = event => {
      if (event.key !== PDCA_STORAGE_KEY) return;
      try { publishData(loadPDCA(initialPDCAData)); }
      catch { showToast('Saved PDCA records could not be loaded. Please keep your form open.'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const [toastMessage, setToastMessage] = useState(() => {
    try { loadPDCA(initialPDCAData); return null; }
    catch { return 'Saved PDCA data could not be loaded. It has been preserved; please recover it before saving.'; }
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddPDCA = (newItem) => {
    setData(records => addPDCA(records, newItem));
    showToast(`✓ Created: ${newItem.id}`);
  };

  const handleUpdatePDCA = (updated) => {
    setData(records => updatePDCA(records, updated));
    showToast(`✓ Updated: ${updated.id}`);
  };

  const handleDeletePDCA = (id) => {
    const item = data.find(record => String(record.id) === String(id));
    if (!item || !confirmFormDeletion(item.topic || item.title || `PDCA form ${id}`)) return;
    try {
      setData(prev => prev.filter(record => String(record.id) !== String(id)));
      showToast(`Deleted ${id}`);
    } catch (error) {
      showToast(error?.message || 'PDCA item could not be deleted.');
    }
  };

  const handleSaveMembers = (itemId, members) => {
    setData((prev) =>
      prev.map((d) => (d.id === itemId ? { ...d, assignedMembers: members } : d))
    );
    showToast(`✓ Updated team members for ${itemId}`);
  };

  const value = {
    userContext,
    data,
    setData,
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
