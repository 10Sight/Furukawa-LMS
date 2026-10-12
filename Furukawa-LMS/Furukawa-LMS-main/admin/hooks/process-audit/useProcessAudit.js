import { useState, useCallback, useMemo } from 'react';

export function cellPosition(address) {
  const [, letters, rowText] = address.match(/^([A-Z]+)(\d+)$/);
  const column = [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
  return { row: Number(rowText), column };
}

export function mergeRange(range) {
  const [first, last = first] = range.split(':');
  const start = cellPosition(first);
  const end = cellPosition(last);
  return { first, start, rows: end.row - start.row + 1, columns: end.column - start.column + 1 };
}

export function readSavedValues(name) {
  try {
    return JSON.parse(localStorage.getItem(`process_audit_${name}`) || '{}');
  } catch {
    return {};
  }
}

/**
 * Hook to manage Process Audit form states, sub-views, values, and persistence
 */
export function useProcessAudit(initialFormName = 'Procedure') {
  const [activeFormName, setActiveFormName] = useState(initialFormName);
  const [selectedUnit, setSelectedUnit] = useState('Bawal');
  const [zoom, setZoom] = useState(100);
  const [formValues, setFormValues] = useState(() => readSavedValues(initialFormName));

  const changeForm = useCallback((name) => {
    setActiveFormName(name);
    setFormValues(readSavedValues(name));
  }, []);

  const updateCellValue = useCallback((address, value) => {
    setFormValues(prev => {
      const next = { ...prev, [address]: value };
      try {
        localStorage.setItem(`process_audit_${activeFormName}`, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed saving process audit cell:', e);
      }
      return next;
    });
  }, [activeFormName]);

  const saveAllValues = useCallback((values) => {
    setFormValues(values);
    try {
      localStorage.setItem(`process_audit_${activeFormName}`, JSON.stringify(values));
    } catch (e) {
      console.warn('Failed saving process audit form:', e);
    }
  }, [activeFormName]);

  const resetValues = useCallback(() => {
    try {
      localStorage.removeItem(`process_audit_${activeFormName}`);
    } catch {}
    setFormValues({});
  }, [activeFormName]);

  const zoomIn = useCallback(() => setZoom(z => Math.min(150, z + 10)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(50, z - 10)), []);
  const resetZoom = useCallback(() => setZoom(100), []);

  return {
    activeFormName,
    setActiveFormName,
    changeForm,
    selectedUnit,
    setSelectedUnit,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    formValues,
    updateCellValue,
    saveAllValues,
    resetValues
  };
}

export default useProcessAudit;
