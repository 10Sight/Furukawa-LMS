import { useCallback, useRef, useState } from "react";
import { useHistoryState } from "@/hooks/useHistoryState";

export const makeElementId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const makeGroupId = () => `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createBlankSlide = (order = 1) => ({
  id: `${Date.now()}-${order}`,
  order,
  contentHtml: "",
  bgColor: "#ffffff",
  images: [],
});

export const withSlideAdded = (slides) => {
  const nextOrder = slides.length + 1;
  return [...slides, createBlankSlide(nextOrder)];
};

export const withSlideRemoved = (slides, index) => {
  const copy = slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }));
  return copy.length ? copy : [createBlankSlide(1)];
};

export const withSlideMoved = (slides, from, to) => {
  const arr = [...slides];
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  return arr.map((s, i) => ({ ...s, order: i + 1 }));
};

// Legacy elements have no zIndex — derive one from their array position so old
// slides render identically to today until the next save assigns real values.
const withDerivedZIndex = (elements) => {
  if (!Array.isArray(elements) || elements.length === 0) return elements || [];
  if (elements.every((el) => Number.isFinite(el.zIndex))) return elements;
  return elements.map((el, i) => (Number.isFinite(el.zIndex) ? el : { ...el, zIndex: i }));
};

const withDerivedZIndexSlides = (slides) =>
  Array.isArray(slides) ? slides.map((s) => ({ ...s, elements: withDerivedZIndex(s.elements) })) : slides;

const nextZIndex = (elements) => {
  if (!Array.isArray(elements) || elements.length === 0) return 0;
  return Math.max(...elements.map((el) => (Number.isFinite(el.zIndex) ? el.zIndex : 0))) + 1;
};

// Shared local editing state for a lesson's slides: history (undo/redo), the
// active slide/selection, and mutators for elements (add/duplicate/group/
// z-order/etc). Persistence timing (when to call the API) stays with the page.
export function useSlidesEditor(initialSlides) {
  const history = useHistoryState(withDerivedZIndexSlides(initialSlides));
  const slides = history.state;

  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const clipboardRef = useRef(null);
  const contentDebounceRef = useRef(null);

  const activeSlide = slides[activeIndex] || null;

  const setSlides = useCallback((updater, opts) => {
    history.set((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return withDerivedZIndexSlides(next);
    }, opts);
  }, [history]);

  // For hydrating from the server (initial load / refetch) rather than a user
  // edit: replaces state without creating an undoable history entry.
  const resetSlides = useCallback((next) => {
    history.reset(withDerivedZIndexSlides(next));
    setSelectedIds([]);
  }, [history]);

  const patchSlideAt = useCallback((index, patch, opts) => {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)), opts);
  }, [setSlides]);

  const patchActiveSlide = useCallback((patch, opts) => patchSlideAt(activeIndex, patch, opts), [patchSlideAt, activeIndex]);

  // Debounced commit for keystroke-level contentHtml edits, so typing doesn't
  // flood the global history stack (Tiptap keeps its own local undo for that).
  const patchContentHtml = useCallback((html) => {
    patchSlideAt(activeIndex, { contentHtml: html }, { commit: false });
    clearTimeout(contentDebounceRef.current);
    contentDebounceRef.current = setTimeout(() => history.commitPending(), 600);
  }, [patchSlideAt, activeIndex, history]);

  const setActiveSlideElements = useCallback((nextElements, opts) => {
    patchActiveSlide({ elements: nextElements }, opts);
  }, [patchActiveSlide]);

  const addElement = useCallback((el) => {
    const elements = activeSlide?.elements || [];
    patchActiveSlide({ elements: [...elements, { ...el, zIndex: nextZIndex(elements) }] });
  }, [activeSlide, patchActiveSlide]);

  const addTextBox = useCallback(() => addElement({
    id: makeElementId(), type: 'text', xPct: 10, yPct: 10, wPct: 30, hPct: 12, text: 'Text',
  }), [addElement]);

  const addRect = useCallback(() => addElement({
    id: makeElementId(), type: 'rect', xPct: 15, yPct: 15, wPct: 20, hPct: 12, fill: '#e5e7eb', stroke: '#d1d5db',
  }), [addElement]);

  const addImageElement = useCallback((url, name) => addElement({
    id: makeElementId(), type: 'image', url, xPct: 20, yPct: 20, wPct: 30, hPct: 20, alt: name,
  }), [addElement]);

  const addVideoElement = useCallback((url, name) => addElement({
    id: makeElementId(), type: 'video', url, xPct: 20, yPct: 20, wPct: 40, hPct: 30, alt: name,
  }), [addElement]);

  // --- Selection (within the active slide) ---

  const expandGroupSelection = useCallback((ids) => {
    const elements = activeSlide?.elements || [];
    const groupIds = new Set(elements.filter((el) => ids.includes(el.id) && el.groupId).map((el) => el.groupId));
    if (groupIds.size === 0) return ids;
    const expanded = new Set(ids);
    elements.forEach((el) => { if (el.groupId && groupIds.has(el.groupId)) expanded.add(el.id); });
    return Array.from(expanded);
  }, [activeSlide]);

  const selectElement = useCallback((id, { additive = false } = {}) => {
    setSelectedIds((prev) => {
      const expandedTarget = expandGroupSelection([id]);
      if (!additive) return expandedTarget;
      const isSelected = expandedTarget.some((eid) => prev.includes(eid));
      if (isSelected) return prev.filter((eid) => !expandedTarget.includes(eid));
      return Array.from(new Set([...prev, ...expandedTarget]));
    });
  }, [expandGroupSelection]);

  const selectMany = useCallback((ids) => setSelectedIds(expandGroupSelection(ids)), [expandGroupSelection]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  // --- Element mutators driven by the current selection ---

  const updateElements = useCallback((ids, patchOrFn, opts) => {
    if (!ids || ids.length === 0) return;
    patchActiveSlide({
      elements: (activeSlide?.elements || []).map((el) => {
        if (!ids.includes(el.id)) return el;
        const patch = typeof patchOrFn === 'function' ? patchOrFn(el) : patchOrFn;
        return { ...el, ...patch };
      }),
    }, opts);
  }, [activeSlide, patchActiveSlide]);

  const nudgeSelected = useCallback((dxPct, dyPct) => {
    const elements = activeSlide?.elements || [];
    const isLocked = (id) => elements.find((el) => el.id === id)?.locked;
    const ids = selectedIds.filter((id) => !isLocked(id));
    updateElements(ids, (el) => ({
      xPct: Math.max(0, Math.min(100 - (el.wPct || 0), (el.xPct || 0) + dxPct)),
      yPct: Math.max(0, Math.min(100 - (el.hPct || 0), (el.yPct || 0) + dyPct)),
    }));
  }, [activeSlide, selectedIds, updateElements]);

  const deleteSelected = useCallback(() => {
    const elements = activeSlide?.elements || [];
    const removable = new Set(selectedIds.filter((id) => !elements.find((el) => el.id === id)?.locked));
    if (removable.size === 0) return;
    patchActiveSlide({ elements: elements.filter((el) => !removable.has(el.id)) });
    setSelectedIds((prev) => prev.filter((id) => !removable.has(id)));
  }, [activeSlide, selectedIds, patchActiveSlide]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const elements = activeSlide?.elements || [];
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length === 0) return;
    const newGroupId = selected.some((el) => el.groupId) ? makeGroupId() : null;
    let z = nextZIndex(elements);
    const clones = selected.map((el) => ({
      ...el,
      id: makeElementId(),
      xPct: (el.xPct || 0) + 2,
      yPct: (el.yPct || 0) + 2,
      zIndex: z++,
      groupId: el.groupId ? newGroupId : null,
    }));
    patchActiveSlide({ elements: [...elements, ...clones] });
    setSelectedIds(clones.map((c) => c.id));
  }, [selectedIds, activeSlide, patchActiveSlide]);

  const copySelected = useCallback(() => {
    const elements = activeSlide?.elements || [];
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length === 0) return;
    clipboardRef.current = selected.map((el) => ({ ...el }));
  }, [selectedIds, activeSlide]);

  const pasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.length === 0) return;
    const elements = activeSlide?.elements || [];
    const newGroupId = clip.some((el) => el.groupId) ? makeGroupId() : null;
    let z = nextZIndex(elements);
    const clones = clip.map((el) => ({
      ...el,
      id: makeElementId(),
      xPct: (el.xPct || 0) + 2,
      yPct: (el.yPct || 0) + 2,
      zIndex: z++,
      groupId: el.groupId ? newGroupId : null,
    }));
    patchActiveSlide({ elements: [...elements, ...clones] });
    setSelectedIds(clones.map((c) => c.id));
  }, [activeSlide, patchActiveSlide]);

  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    updateElements(selectedIds, { groupId: makeGroupId() });
  }, [selectedIds, updateElements]);

  const ungroupSelected = useCallback(() => {
    updateElements(selectedIds, { groupId: null });
  }, [selectedIds, updateElements]);

  const toggleLockSelected = useCallback(() => {
    const elements = activeSlide?.elements || [];
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length === 0) return;
    const allLocked = selected.every((el) => el.locked);
    updateElements(selectedIds, { locked: !allLocked });
  }, [selectedIds, activeSlide, updateElements]);

  // z-order actions rewrite zIndex directly rather than reordering the elements array
  const reorderZ = useCallback((ids, mode) => {
    const elements = activeSlide?.elements || [];
    if (elements.length === 0 || !ids || ids.length === 0) return;
    const sorted = [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    if (mode === 'front' || mode === 'back') {
      const targets = sorted.filter((el) => ids.includes(el.id));
      const others = sorted.filter((el) => !ids.includes(el.id));
      const ordered = mode === 'front' ? [...others, ...targets] : [...targets, ...others];
      const zMap = new Map(ordered.map((el, i) => [el.id, i]));
      patchActiveSlide({ elements: elements.map((el) => ({ ...el, zIndex: zMap.get(el.id) })) });
      return;
    }

    // forward/backward: swap with the immediate neighbor in z-order, per selected id
    ids.forEach((id) => {
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx === -1) return;
      const swapIdx = mode === 'forward' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const za = a.zIndex;
      const zb = b.zIndex;
      sorted[idx] = { ...a, zIndex: zb };
      sorted[swapIdx] = { ...b, zIndex: za };
    });
    patchActiveSlide({ elements: elements.map((el) => sorted.find((s) => s.id === el.id) || el) });
  }, [activeSlide, patchActiveSlide]);

  const bringToFront = useCallback((ids) => reorderZ(ids || selectedIds, 'front'), [reorderZ, selectedIds]);
  const sendToBack = useCallback((ids) => reorderZ(ids || selectedIds, 'back'), [reorderZ, selectedIds]);
  const bringForward = useCallback((ids) => reorderZ(ids || selectedIds, 'forward'), [reorderZ, selectedIds]);
  const sendBackward = useCallback((ids) => reorderZ(ids || selectedIds, 'backward'), [reorderZ, selectedIds]);

  return {
    slides, setSlides, resetSlides,
    activeIndex, setActiveIndex,
    activeSlide,
    patchSlideAt, patchActiveSlide, patchContentHtml,
    setActiveSlideElements,
    addElement, addTextBox, addRect, addImageElement, addVideoElement,
    selectedIds, setSelectedIds, selectElement, selectMany, clearSelection,
    updateElements, nudgeSelected,
    deleteSelected, duplicateSelected, copySelected, pasteClipboard,
    groupSelected, ungroupSelected, toggleLockSelected,
    bringToFront, sendToBack, bringForward, sendBackward,
    undo: history.undo, redo: history.redo, canUndo: history.canUndo, canRedo: history.canRedo,
  };
}
