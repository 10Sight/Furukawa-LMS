import { useState, useCallback, useMemo } from 'react';
import {
  getLpaPdcaTopic,
  saveLpaPdcaSnapshot,
  extractObservationsFromSheet
} from '@/pages/lpa/lpaPdcaUtils.js';

/**
 * Hook to manage LPA-to-PDCA integration, topic extraction, and snapshots
 */
export function useLPAPdca(initialScope = {}) {
  const [scope, setScope] = useState(initialScope);
  const [topic, setTopic] = useState(() => getLpaPdcaTopic(initialScope));

  const updateScope = useCallback((newScope) => {
    setScope(newScope);
    setTopic(getLpaPdcaTopic(newScope));
  }, []);

  const saveSnapshot = useCallback((snapshot) => {
    return saveLpaPdcaSnapshot(topic, snapshot);
  }, [topic]);

  const extractObservations = useCallback((sheet) => {
    return extractObservationsFromSheet(sheet);
  }, []);

  return {
    scope,
    updateScope,
    topic,
    setTopic,
    saveSnapshot,
    extractObservations
  };
}

export default useLPAPdca;
