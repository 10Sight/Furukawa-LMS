import { useState, useMemo, useEffect, useCallback } from 'react';
import { initialPTMData } from '@/pages/ptm/data/mockData.js';

function getStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Hook to manage PTM Dashboard items, unit filter, scopes, and pagination
 */
export function usePTM(initialData = initialPTMData) {
  const [listItems, setListItems] = useState(() => {
    return getStoredJson('ptm_dashboard_items', initialData);
  });

  const [selectedUnit, setSelectedUnit] = useState(() => {
    try {
      return sessionStorage.getItem('ptm_selected_unit') || null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    return getStoredJson('ptm_active_scope', 'Company');
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    try {
      localStorage.setItem('ptm_dashboard_items', JSON.stringify(listItems));
    } catch (e) {
      console.warn('Failed saving PTM items:', e);
    }
  }, [listItems]);

  useEffect(() => {
    try {
      localStorage.setItem('ptm_active_scope', JSON.stringify(activeTab));
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      if (selectedUnit) sessionStorage.setItem('ptm_selected_unit', selectedUnit);
      else sessionStorage.removeItem('ptm_selected_unit');
    } catch {}
  }, [selectedUnit]);

  const filteredItems = useMemo(() => {
    let result = listItems;
    if (selectedUnit && selectedUnit !== 'All') {
      result = result.filter(item => item.plant === selectedUnit || item.unit === selectedUnit);
    }
    if (activeTab && activeTab !== 'All') {
      result = result.filter(item => item.scope === activeTab || item.category === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item =>
        (item.topic || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [listItems, selectedUnit, activeTab, searchQuery]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;

  const addItem = useCallback((newItem) => {
    setListItems(prev => [newItem, ...prev]);
  }, []);

  const updateItem = useCallback((updatedItem) => {
    setListItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  }, []);

  const deleteItem = useCallback((id) => {
    setListItems(prev => prev.filter(item => item.id !== id));
  }, []);

  return {
    listItems,
    setListItems,
    selectedUnit,
    setSelectedUnit,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    filteredItems,
    paginatedItems,
    totalPages,
    itemsPerPage,
    addItem,
    updateItem,
    deleteItem
  };
}

export default usePTM;
