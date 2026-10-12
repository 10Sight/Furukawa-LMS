import { useState, useRef, useCallback, useEffect } from 'react';
import { initialHeaderInfo, initialPTMRows } from '@/pages/ptm/data/ptmData.js';

function getStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadUnitRows(unit) {
  if (!unit) return initialPTMRows;
  const scopedRows = getStoredJson(`ptm_rows_data_${unit}`, null);
  if (Array.isArray(scopedRows)) return scopedRows;
  return initialPTMRows.map(row => ({ ...row, unit: row.unit || unit }));
}

export function loadUnitHeaderInfo(unit) {
  if (!unit) return initialHeaderInfo;
  const scopedInfo = getStoredJson(`ptm_header_info_${unit}`, null);
  if (scopedInfo) return scopedInfo;
  return initialHeaderInfo;
}

/**
 * Hook to manage PTM Matrix rows, header details, and history (undo/redo)
 */
export function usePTMRows(selectedUnit) {
  const [ptmRows, setPtmRows] = useState(() => loadUnitRows(selectedUnit));
  const [headerInfo, setHeaderInfo] = useState(() => loadUnitHeaderInfo(selectedUnit));

  // Reload when unit changes
  useEffect(() => {
    if (selectedUnit) {
      setPtmRows(loadUnitRows(selectedUnit));
      setHeaderInfo(loadUnitHeaderInfo(selectedUnit));
    }
  }, [selectedUnit]);

  // History stack for undo/redo
  const historyRef = useRef({ undo: [], redo: [] });
  const [, setHistoryCount] = useState(0);

  const pushHistory = useCallback((prevRows, prevHeader) => {
    historyRef.current.undo.push({
      rows: JSON.parse(JSON.stringify(prevRows)),
      headerInfo: JSON.parse(JSON.stringify(prevHeader))
    });
    historyRef.current.redo = [];
    setHistoryCount(c => c + 1);
  }, []);

  const updateCell = useCallback((rowIndex, field, value) => {
    setPtmRows(prev => {
      pushHistory(prev, headerInfo);
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, [headerInfo, pushHistory]);

  const updateHeader = useCallback((field, value) => {
    setHeaderInfo(prev => {
      pushHistory(ptmRows, prev);
      return { ...prev, [field]: value };
    });
  }, [ptmRows, pushHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.undo.length === 0) return;
    const previous = historyRef.current.undo.pop();
    historyRef.current.redo.push({
      rows: JSON.parse(JSON.stringify(ptmRows)),
      headerInfo: JSON.parse(JSON.stringify(headerInfo))
    });
    setPtmRows(previous.rows);
    setHeaderInfo(previous.headerInfo);
    setHistoryCount(c => c + 1);
  }, [ptmRows, headerInfo]);

  const redo = useCallback(() => {
    if (historyRef.current.redo.length === 0) return;
    const next = historyRef.current.redo.pop();
    historyRef.current.undo.push({
      rows: JSON.parse(JSON.stringify(ptmRows)),
      headerInfo: JSON.parse(JSON.stringify(headerInfo))
    });
    setPtmRows(next.rows);
    setHeaderInfo(next.headerInfo);
    setHistoryCount(c => c + 1);
  }, [ptmRows, headerInfo]);

  const saveToStorage = useCallback(() => {
    if (!selectedUnit) return;
    try {
      localStorage.setItem(`ptm_rows_data_${selectedUnit}`, JSON.stringify(ptmRows));
      localStorage.setItem(`ptm_header_info_${selectedUnit}`, JSON.stringify(headerInfo));
    } catch (e) {
      console.warn('Failed saving unit PTM matrix:', e);
    }
  }, [selectedUnit, ptmRows, headerInfo]);

  return {
    ptmRows,
    setPtmRows,
    headerInfo,
    setHeaderInfo,
    updateCell,
    updateHeader,
    undo,
    redo,
    canUndo: historyRef.current.undo.length > 0,
    canRedo: historyRef.current.redo.length > 0,
    saveToStorage
  };
}

export default usePTMRows;
