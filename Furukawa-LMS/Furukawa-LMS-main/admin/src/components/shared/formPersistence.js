import { useCallback, useEffect, useRef, useState } from 'react';

export function readSaved(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (!Array.isArray(value) && (!value || typeof value !== 'object')) return fallback;
    return value;
  } catch { return fallback; }
}

// Commit storage before publishing state or reporting success.
export function commitSaved(key, value) {
  const previous = localStorage.getItem(key);
  if (previous !== null) {
    try {
      const parsed = JSON.parse(previous);
      if (!parsed || typeof parsed !== 'object') throw new Error();
    } catch { throw new Error('Saved data could not be read. Please recover it before saving again.'); }
  }
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function useSavedRecords(key, fallback) {
  const [records, publish] = useState(() => readSaved(key, fallback));
  const current = useRef(records);
  const commit = useCallback((update) => {
    const next = typeof update === 'function' ? update(current.current) : update;
    commitSaved(key, next);
    current.current = next;
    publish(next);
    return next;
  }, [key]);
  return [records, commit];
}

// Save edits immediately; a failed write retains the live draft and warns before leaving.
export function useFormAutosave(value, save, enabled, showError) {
  const latestSave = useRef(save);
  latestSave.current = save;
  const latestError = useRef(showError);
  latestError.current = showError;
  const failed = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    try {
      latestSave.current(value);
      failed.current = false;
    } catch {
      if (!failed.current) latestError.current('Could not save changes. Keep this form open and try again.');
      failed.current = true;
    }
  }, [value, enabled]);
  useEffect(() => {
    const unload = (event) => {
      if (failed.current) { event.preventDefault(); event.returnValue = ''; }
    };
    const navigate = (event) => {
      if (failed.current && event.target.closest('a, button') && /back|close|cancel|unit|dashboard/i.test(event.target.closest('a, button').textContent || '') && !window.confirm('Changes could not be saved. Leave and discard them?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, []);
}
