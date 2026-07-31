import { useCallback, useRef, useState } from "react";

const HISTORY_LIMIT = 50;

/**
 * Generic undo/redo reducer. Continuous interactions (drag/resize/slider) call
 * set(next, {commit:false}) on every intermediate frame and set(next, {commit:true})
 * once on release, so one gesture = one history entry instead of one per frame.
 */
export function useHistoryState(initialPresent) {
  const [state, setState] = useState({ past: [], present: initialPresent, future: [] });
  const pendingRef = useRef(false); // true while an uncommitted (transient) sequence is in progress

  const set = useCallback((updater, { commit = true } = {}) => {
    setState((curr) => {
      const nextPresent = typeof updater === 'function' ? updater(curr.present) : updater;
      if (nextPresent === curr.present) return curr;

      if (!commit) {
        // Transient frame: snapshot the pre-sequence state once, keep updating `present` in place.
        if (pendingRef.current) {
          return { past: curr.past, present: nextPresent, future: [] };
        }
        pendingRef.current = true;
        const past = [...curr.past, curr.present].slice(-HISTORY_LIMIT);
        return { past, present: nextPresent, future: [] };
      }

      if (pendingRef.current) {
        // Commit of a transient sequence already snapshotted at its start.
        pendingRef.current = false;
        return { past: curr.past, present: nextPresent, future: [] };
      }

      const past = [...curr.past, curr.present].slice(-HISTORY_LIMIT);
      return { past, present: nextPresent, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    pendingRef.current = false;
    setState((curr) => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const past = curr.past.slice(0, -1);
      return { past, present: previous, future: [curr.present, ...curr.future].slice(0, HISTORY_LIMIT) };
    });
  }, []);

  const redo = useCallback(() => {
    pendingRef.current = false;
    setState((curr) => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const future = curr.future.slice(1);
      return { past: [...curr.past, curr.present].slice(-HISTORY_LIMIT), present: next, future };
    });
  }, []);

  const reset = useCallback((newPresent) => {
    pendingRef.current = false;
    setState({ past: [], present: newPresent, future: [] });
  }, []);

  // Seals the current transient (commit:false) sequence without changing `present`,
  // so the next transient call starts a fresh history entry instead of amending this one.
  const commitPending = useCallback(() => {
    pendingRef.current = false;
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    reset,
    commitPending,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
