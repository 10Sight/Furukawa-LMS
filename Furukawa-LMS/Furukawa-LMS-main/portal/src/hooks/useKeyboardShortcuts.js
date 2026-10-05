import { useEffect } from "react";

const isEditableTarget = (target) => (
  !!target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute?.('role') === 'textbox')
);

/**
 * Global slide-editor keyboard shortcuts: delete, arrow-key nudge, copy/paste/
 * duplicate, group/ungroup, undo/redo. Ignored while focus is inside any
 * editable field (the RTE, slide title, etc) so it never fights native text editing.
 */
export function useKeyboardShortcuts(editor) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isEditableTarget(document.activeElement)) return;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo(); else editor.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        editor.redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.selectedIds.length > 0) {
          e.preventDefault();
          editor.deleteSelected();
        }
        return;
      }

      if (mod && e.key.toLowerCase() === 'c') {
        if (editor.selectedIds.length > 0) { e.preventDefault(); editor.copySelected(); }
        return;
      }
      if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        editor.pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (editor.selectedIds.length > 0) { e.preventDefault(); editor.duplicateSelected(); }
        return;
      }
      if (mod && e.key.toLowerCase() === 'g') {
        if (editor.selectedIds.length > 0) {
          e.preventDefault();
          if (e.shiftKey) editor.ungroupSelected(); else editor.groupSelected();
        }
        return;
      }

      if (editor.selectedIds.length > 0 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        editor.nudgeSelected(dx, dy);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor]);
}
