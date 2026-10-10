import { loadPDCA, commitPDCA, addPDCA, updatePDCA, PDCA_STORAGE_KEY } from '../data/pdcaStore';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { initialPDCAData } from '../data/mockData';

const PDCAContext = createContext(null);

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
    const nextData = setData(prev => {
      const targetIndex = prev.findIndex(record => String(record.id) === String(id));
      if (targetIndex < 0) throw new Error('This PDCA form no longer exists. Refresh the list and try again.');
      return prev.filter((_, index) => index !== targetIndex);
    });
    showToast(`Deleted ${id}`);
    return nextData;
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
