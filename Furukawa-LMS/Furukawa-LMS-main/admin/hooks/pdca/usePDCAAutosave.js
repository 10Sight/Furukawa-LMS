import { useEffect, useRef } from 'react';

/**
 * Hook to autosave PDCA drafts and sheet snapshots with error tracking
 * and browser beforeunload protection.
 */
export function usePDCAAutosave(value, save, enabled, showError) {
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
      if (!failed.current) latestError.current?.('Could not save changes. Keep this form open and try again.');
      failed.current = true;
    }
  }, [value, enabled]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (failed.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}

export default usePDCAAutosave;
