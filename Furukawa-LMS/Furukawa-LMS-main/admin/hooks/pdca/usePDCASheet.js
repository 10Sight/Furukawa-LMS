import { useState, useEffect, useCallback, useMemo } from 'react';
import pdcaApi from '@/services/api/pdcaApi.js';
import { usePDCAAutosave } from './usePDCAAutosave.js';

export function createEmptyRow() {
  return {
    sNo: null,
    date: '',
    shift: '',
    status: 'Open',
    lineArea: '',
    observation: '',
    imageBefore: null,
    imageBeforeName: '',
    fileTypeBefore: 'image',
    rootCause: '',
    counterMeasure: '',
    imageAfter: null,
    imageAfterName: '',
    fileTypeAfter: 'image',
    responseDate: '',
    department: '',
    staffEmployee: '',
    staffEmployees: [],
    staffName: '',
    staffId: '',
    employeeId: '',
    cftTopic: '',
    responsiblePersonConfirmation: ''
  };
}

/**
 * Hook to manage PDCA Sheet rows, header info, validation, and backend persistence
 */
export function usePDCASheet(topic, onSave, showToast) {
  const [rows, setRows] = useState(() => {
    if (Array.isArray(topic?.sheet?.rows) && topic.sheet.rows.length > 0) {
      return topic.sheet.rows;
    }
    return Array.from({ length: 10 }, () => createEmptyRow());
  });

  const [headerInfo, setHeaderInfo] = useState(() => {
    return topic?.sheet?.headerInfo || {
      topicName: '',
      preparedBy: '',
      auditNo: '',
      attendees: ''
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load saved sheet from backend on mount or topic change
  useEffect(() => {
    if (!topic?.id) return;
    let active = true;
    setIsLoading(true);
    pdcaApi.getSheet(topic.id).then(savedSheet => {
      if (!active || !savedSheet) return;
      if (savedSheet.headerInfo && Object.keys(savedSheet.headerInfo).length > 0) {
        setHeaderInfo(prev => ({ ...prev, ...savedSheet.headerInfo }));
      }
      if (Array.isArray(savedSheet.rows) && savedSheet.rows.length > 0) {
        setRows(savedSheet.rows);
      } else {
        setRows(prev => (Array.isArray(prev) && prev.length > 0) ? prev : Array.from({ length: 10 }, () => createEmptyRow()));
      }
    }).catch(err => {
      console.warn('Could not load sheet from backend:', err);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [topic?.id]);

  const sheetSnapshot = useMemo(() => ({ rows, headerInfo }), [rows, headerInfo]);

  const persistSheet = useCallback((sheet) => {
    if (onSave) {
      try { onSave(sheet); } catch (e) { console.error(e); }
    }
  }, [onSave]);

  usePDCAAutosave(sheetSnapshot, persistSheet, Boolean(topic?.id), showToast);

  const validateRows = useCallback(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const hasContent = Boolean(
        r.date?.trim() ||
        r.shift?.trim() ||
        r.lineArea?.trim() ||
        r.observation?.trim() ||
        r.imageBefore ||
        r.rootCause?.trim() ||
        r.counterMeasure?.trim() ||
        r.imageAfter ||
        r.responseDate?.trim() ||
        r.department?.trim() ||
        r.staffEmployee?.trim() ||
        r.cftTopic?.trim() ||
        r.responsiblePersonConfirmation?.trim()
      );
      if (hasContent) {
        const missing = [];
        if (!r.date?.trim()) missing.push('Date');
        if (!r.shift?.trim()) missing.push('Shift');
        if (!r.status?.trim()) missing.push('Status');
        if (!r.lineArea?.trim()) missing.push('Line/Area');
        if (!r.observation?.trim()) missing.push('Observation');

        if (missing.length > 0) {
          showToast?.(`Row ${i + 1}: Mandatory field${missing.length > 1 ? 's' : ''} (${missing.join(', ')}) required.`);
          return false;
        }
      }
    }
    return true;
  }, [rows, showToast]);

  const saveSheet = useCallback(async () => {
    if (isSaving) return false;
    if (!validateRows()) return false;

    try {
      setIsSaving(true);
      if (topic?.id) {
        await pdcaApi.saveSheet(topic.id, sheetSnapshot);
      }
      persistSheet(sheetSnapshot);
      showToast?.('PDCA saved successfully.');
      return true;
    } catch (error) {
      showToast?.(error.message || 'Could not save PDCA. Keep the form open and try again.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, validateRows, topic?.id, sheetSnapshot, persistSheet, showToast]);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow()]);
  }, []);

  const insertRowAbove = useCallback((rowIndex) => {
    setRows(prev => {
      const next = [...prev];
      next.splice(rowIndex, 0, createEmptyRow());
      return next;
    });
  }, []);

  const deleteRow = useCallback((rowIndex) => {
    setRows(prev => {
      if (prev.length <= 1) return [createEmptyRow()];
      return prev.filter((_, idx) => idx !== rowIndex);
    });
  }, []);

  const updateCell = useCallback((rowIndex, field, value) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, []);

  return {
    rows,
    setRows,
    headerInfo,
    setHeaderInfo,
    isSaving,
    isLoading,
    sheetSnapshot,
    saveSheet,
    addRow,
    insertRowAbove,
    deleteRow,
    updateCell,
    validateRows
  };
}

export default usePDCASheet;
