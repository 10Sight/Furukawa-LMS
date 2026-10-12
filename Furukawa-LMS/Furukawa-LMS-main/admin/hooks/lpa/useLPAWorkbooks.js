import { useState, useEffect, useCallback } from 'react';
import {
  listLPAWorkbooks,
  createLPAWorkbook,
  saveLPAWorkbook,
  deleteLPAWorkbook
} from '@/pages/lpa/lpaStore.js';

/**
 * Hook to manage LPA workbooks (listing, saving, deleting) for an owner
 */
export function useLPAWorkbooks(ownerId = 'current') {
  const [workbooks, setWorkbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshWorkbooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listLPAWorkbooks(ownerId);
      setWorkbooks(list || []);
    } catch (err) {
      console.warn('Failed listing LPA workbooks:', err);
      setError(err.message || 'Could not load LPA workbooks.');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    refreshWorkbooks();
  }, [refreshWorkbooks]);

  const saveWorkbook = useCallback(async (workbook) => {
    try {
      const saved = await saveLPAWorkbook(workbook);
      await refreshWorkbooks();
      return saved;
    } catch (err) {
      setError(err.message || 'Could not save LPA workbook.');
      throw err;
    }
  }, [refreshWorkbooks]);

  const removeWorkbook = useCallback(async (id) => {
    try {
      await deleteLPAWorkbook(id);
      setWorkbooks(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      setError(err.message || 'Could not delete LPA workbook.');
      throw err;
    }
  }, []);

  const createWorkbook = useCallback(async (data) => {
    try {
      const created = await createLPAWorkbook({ ...data, ownerId });
      await refreshWorkbooks();
      return created;
    } catch (err) {
      setError(err.message || 'Could not create LPA workbook.');
      throw err;
    }
  }, [ownerId, refreshWorkbooks]);

  return {
    workbooks,
    loading,
    error,
    refreshWorkbooks,
    saveWorkbook,
    removeWorkbook,
    createWorkbook
  };
}

export default useLPAWorkbooks;
