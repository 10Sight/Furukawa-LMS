import React, { createContext, useContext, useState } from 'react';
import { initialPDCAData } from '../data/initialData';

const PDCAContext = createContext(null);

export function PDCAProvider({ children }) {
  const [data, setData] = useState(initialPDCAData);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddPDCA = (newItem) => {
    setData((prev) => [newItem, ...prev]);
    showToast(`✓ Created: ${newItem.id}`);
  };

  const handleUpdatePDCA = (updated) => {
    setData((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    showToast(`✓ Updated: ${updated.id}`);
  };

  const handleDeletePDCA = (id) => {
    setData((prev) => prev.filter((d) => d.id !== id));
    showToast(`Deleted ${id}`);
  };

  const handleSaveMembers = (itemId, members) => {
    setData((prev) =>
      prev.map((d) => (d.id === itemId ? { ...d, assignedMembers: members } : d))
    );
    showToast(`✓ Updated team members for ${itemId}`);
  };

  const value = {
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
