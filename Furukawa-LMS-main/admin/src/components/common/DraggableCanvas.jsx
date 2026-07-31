import React from "react";
import clsx from "clsx";
import { Trash2, Lock } from "lucide-react";
import { getMediaUrl } from "@/utils/mediaUtils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

// Element shape:
// { id, type: 'text'|'rect'|'image'|'video', xPct, yPct, wPct, hPct, rotation?, zIndex?, groupId?, locked?, text?, fill?, stroke?, url?, aspectRatio? }

const SNAP_PX = 6; // snap threshold in pixels

function useResizeObserver(ref, onSize) {
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      onSize({ width: r.width, height: r.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, onSize]);
}

const Handle = ({ pos, onPointerDown }) => (
  <div
    onPointerDown={onPointerDown}
    data-pos={pos}
    className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border bg-blue-500 border-blue-600"
    style={{
      left: pos.includes("r") ? "100%" : pos.includes("l") ? 0 : "50%",
      top: pos.includes("b") ? "100%" : pos.includes("t") ? 0 : "50%",
      cursor:
        pos === "tl" || pos === "br" ? "nwse-resize" : pos === "tr" || pos === "bl" ? "nesw-resize" : pos.includes("t") || pos.includes("b") ? "ns-resize" : "ew-resize",
    }}
  />
);

export default function DraggableCanvas({ editor, className }) {
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ width: 1, height: 1 });
  const [dragState, setDragState] = React.useState(null); // { mode: 'move'|'resize'|'marquee', ... }
  const [guide, setGuide] = React.useState(null); // { x?, y? }

  useResizeObserver(containerRef, setSize);

  const elements = editor.activeSlide?.elements || [];
  const selectedIds = editor.selectedIds;
  const sortedElements = React.useMemo(
    () => [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [elements]
  );

  const getPx = React.useCallback((el) => ({
    x: (el.xPct / 100) * size.width,
    y: (el.yPct / 100) * size.height,
    w: (el.wPct / 100) * size.width,
    h: (el.hPct / 100) * size.height,
  }), [size.width, size.height]);

  const toPct = React.useCallback(({ x, y, w, h }) => ({
    xPct: (x / size.width) * 100,
    yPct: (y / size.height) * 100,
    wPct: (w / size.width) * 100,
    hPct: (h / size.height) * 100,
  }), [size.width, size.height]);

  const getBoundingBoxPx = React.useCallback((ids) => {
    const rects = ids.map((id) => elements.find((el) => el.id === id)).filter(Boolean).map(getPx);
    if (rects.length === 0) return null;
    const x1 = Math.min(...rects.map((r) => r.x));
    const y1 = Math.min(...rects.map((r) => r.y));
    const x2 = Math.max(...rects.map((r) => r.x + r.w));
    const y2 = Math.max(...rects.map((r) => r.y + r.h));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }, [elements, getPx]);

  const expandGroup = React.useCallback((ids) => {
    const groupIds = new Set(elements.filter((el) => ids.includes(el.id) && el.groupId).map((el) => el.groupId));
    if (groupIds.size === 0) return ids;
    const set = new Set(ids);
    elements.forEach((el) => { if (el.groupId && groupIds.has(el.groupId)) set.add(el.id); });
    return Array.from(set);
  }, [elements]);

  const guides = React.useMemo(() => {
    const xs = [0, size.width / 2, size.width];
    const ys = [0, size.height / 2, size.height];
    for (const el of elements || []) {
      const r = getPx(el);
      xs.push(r.x, r.x + r.w / 2, r.x + r.w);
      ys.push(r.y, r.y + r.h / 2, r.y + r.h);
    }
    return { xs, ys };
  }, [elements, getPx, size.width, size.height]);

  const clampRect = React.useCallback((rect) => {
    const x = Math.max(0, Math.min(rect.x, size.width - rect.w));
    const y = Math.max(0, Math.min(rect.y, size.height - rect.h));
    const w = Math.max(8, Math.min(rect.w, size.width));
    const h = Math.max(8, Math.min(rect.h, size.height));
    return { x, y, w, h };
  }, [size.width, size.height]);

  const snap = React.useCallback((rect) => {
    const left = rect.x, hCenter = rect.x + rect.w / 2, right = rect.x + rect.w;
    let sx = rect.x, sy = rect.y;
    let showX = null, showY = null;
    for (const gx of guides.xs) {
      if (Math.abs(left - gx) <= SNAP_PX) { sx = gx; showX = gx; break; }
      if (Math.abs(hCenter - gx) <= SNAP_PX) { sx = gx - rect.w / 2; showX = gx; break; }
      if (Math.abs(right - gx) <= SNAP_PX) { sx = gx - rect.w; showX = gx; break; }
    }
    const top = rect.y, vCenter = rect.y + rect.h / 2, bottom = rect.y + rect.h;
    for (const gy of guides.ys) {
      if (Math.abs(top - gy) <= SNAP_PX) { sy = gy; showY = gy; break; }
      if (Math.abs(vCenter - gy) <= SNAP_PX) { sy = gy - rect.h / 2; showY = gy; break; }
      if (Math.abs(bottom - gy) <= SNAP_PX) { sy = gy - rect.h; showY = gy; break; }
    }
    setGuide({ x: showX, y: showY });
    return { ...rect, x: sx, y: sy };
  }, [guides]);

  const onPointerDownItem = (e, el) => {
    e.stopPropagation();
    if (e.button === 2) {
      // Right-click: select (so the context menu targets this element/group) without starting a drag.
      if (!selectedIds.includes(el.id)) editor.selectMany(expandGroup([el.id]));
      return;
    }
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (additive) {
      editor.selectElement(el.id, { additive: true });
      return;
    }
    let ids;
    if (selectedIds.includes(el.id) && selectedIds.length > 1) {
      ids = selectedIds;
    } else {
      ids = expandGroup([el.id]);
      editor.selectMany([el.id]);
    }
    ids = ids.filter((id) => !elements.find((x) => x.id === id)?.locked);
    if (ids.length === 0) return;
    const box = getBoundingBoxPx(ids);
    if (!box) return;
    const baseRects = new Map(ids.map((id) => [id, getPx(elements.find((x) => x.id === id))]));
    setGuide(null);
    setDragState({ mode: 'move', pointerStart: { x: e.clientX, y: e.clientY }, box, baseRects, ids });
  };

  const onPointerDownHandle = (e, pos, ids) => {
    e.stopPropagation();
    if (ids.length === 0) return;
    const box = getBoundingBoxPx(ids);
    if (!box) return;
    const baseRects = new Map(ids.map((id) => [id, getPx(elements.find((x) => x.id === id))]));
    setGuide(null);
    setDragState({ mode: 'resize', pointerStart: { x: e.clientX, y: e.clientY }, box, baseRects, ids, pos });
  };

  const onCanvasPointerDown = (e) => {
    if (e.button === 2) return; // right-click: let the context menu open without starting a marquee
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setDragState({ mode: 'marquee', startX, startY, curX: startX, curY: startY, moved: false });
  };

  const applyMoveOrResize = React.useCallback((e, commit) => {
    setDragState((ds) => {
      if (!ds || (ds.mode !== 'move' && ds.mode !== 'resize')) return ds;
      const dx = e.clientX - ds.pointerStart.x;
      const dy = e.clientY - ds.pointerStart.y;
      let nextBox;
      if (ds.mode === 'move') {
        nextBox = { x: ds.box.x + dx, y: ds.box.y + dy, w: ds.box.w, h: ds.box.h };
      } else {
        let { x, y, w, h } = ds.box;
        if (ds.pos.includes('r')) w = ds.box.w + dx;
        if (ds.pos.includes('l')) { w = ds.box.w - dx; x = ds.box.x + dx; }
        if (ds.pos.includes('b')) h = ds.box.h + dy;
        if (ds.pos.includes('t')) { h = ds.box.h - dy; y = ds.box.y + dy; }
        nextBox = { x, y, w, h };
      }
      nextBox = snap(clampRect(nextBox));

      const scaleX = ds.box.w > 0 ? nextBox.w / ds.box.w : 1;
      const scaleY = ds.box.h > 0 ? nextBox.h / ds.box.h : 1;

      const nextElements = elements.map((el) => {
        const base = ds.baseRects.get(el.id);
        if (!base) return el;
        let rect;
        if (ds.mode === 'move') {
          rect = { x: base.x + (nextBox.x - ds.box.x), y: base.y + (nextBox.y - ds.box.y), w: base.w, h: base.h };
        } else {
          rect = {
            x: nextBox.x + (base.x - ds.box.x) * scaleX,
            y: nextBox.y + (base.y - ds.box.y) * scaleY,
            w: base.w * scaleX,
            h: base.h * scaleY,
          };
        }
        return { ...el, ...toPct(rect) };
      });
      editor.setActiveSlideElements(nextElements, { commit });
      return ds;
    });
  }, [elements, snap, clampRect, toPct, editor]);

  React.useEffect(() => {
    if (!dragState) return;

    const onMove = (e) => {
      if (dragState.mode === 'marquee') {
        const rect = containerRef.current.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        setDragState((s) => (s ? { ...s, curX, curY, moved: s.moved || Math.abs(curX - s.startX) > 3 || Math.abs(curY - s.startY) > 3 } : s));
        return;
      }
      applyMoveOrResize(e, false);
    };

    const onUp = (e) => {
      if (dragState.mode === 'marquee') {
        setDragState((s) => {
          if (s && s.moved) {
            const x1 = Math.min(s.startX, s.curX), y1 = Math.min(s.startY, s.curY);
            const x2 = Math.max(s.startX, s.curX), y2 = Math.max(s.startY, s.curY);
            const hitIds = elements.filter((el) => {
              const r = getPx(el);
              return r.x < x2 && r.x + r.w > x1 && r.y < y2 && r.y + r.h > y1;
            }).map((el) => el.id);
            editor.selectMany(hitIds);
          } else {
            editor.clearSelection();
          }
          return null;
        });
        return;
      }
      applyMoveOrResize(e, true);
      setDragState(null);
      setGuide(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragState, applyMoveOrResize, elements, getPx, editor]);

  // Keyboard shortcuts (delete/nudge/copy/paste/duplicate/group/undo) are handled
  // globally by useKeyboardShortcuts, bound to this same `editor` instance.

  const selectedElements = elements.filter((el) => selectedIds.includes(el.id));
  const interactiveIds = selectedElements.filter((el) => !el.locked).map((el) => el.id);
  const box = dragState && (dragState.mode === 'move' || dragState.mode === 'resize')
    ? getBoundingBoxPx(dragState.ids)
    : (interactiveIds.length > 0 ? getBoundingBoxPx(interactiveIds) : null);

  const marqueeRect = dragState?.mode === 'marquee' ? {
    left: Math.min(dragState.startX, dragState.curX),
    top: Math.min(dragState.startY, dragState.curY),
    width: Math.abs(dragState.curX - dragState.startX),
    height: Math.abs(dragState.curY - dragState.startY),
  } : null;

  const hasSelection = selectedIds.length > 0;
  const hasMultiSelection = selectedIds.length >= 2;
  const hasGrouped = selectedElements.some((el) => el.groupId);
  const hasLocked = selectedElements.some((el) => el.locked);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          className={clsx("absolute inset-0 pointer-events-none", className)}
          onPointerDown={onCanvasPointerDown}
        >
          {/* Alignment guides */}
          {guide?.x != null && (
            <div className="absolute top-0 bottom-0 w-px bg-blue-500/60 pointer-events-none" style={{ left: guide.x }} />
          )}
          {guide?.y != null && (
            <div className="absolute left-0 right-0 h-px bg-blue-500/60 pointer-events-none" style={{ top: guide.y }} />
          )}

          {/* Marquee selection rectangle */}
          {marqueeRect && (
            <div
              className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
              style={marqueeRect}
            />
          )}

          {sortedElements.map((el) => {
            const r = getPx(el);
            const selected = selectedIds.includes(el.id);
            return (
              <div
                key={el.id}
                role="group"
                aria-label={`${el.type} element`}
                className={clsx(
                  "absolute pointer-events-auto",
                  selected && !el.locked && "ring-2 ring-blue-500",
                  selected && el.locked && "ring-2 ring-dashed ring-amber-500",
                  !selected && "ring-1 ring-transparent"
                )}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, cursor: el.locked ? 'not-allowed' : 'move', touchAction: 'none' }}
                onPointerDown={(e) => onPointerDownItem(e, el)}
              >
                {el.locked && selected && (
                  <div className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow">
                    <Lock className="h-3 w-3" />
                  </div>
                )}
                {el.type === 'text' && (
                  <div
                    className="w-full h-full bg-transparent text-[hsl(var(--foreground))] p-2 overflow-hidden"
                    style={{ background: 'transparent' }}
                    contentEditable={!el.locked}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      editor.updateElements([el.id], { text: e.currentTarget.innerText });
                    }}
                  >{el.text || 'Text'}</div>
                )}
                {el.type === 'rect' && (
                  <div className="w-full h-full" style={{ background: el.fill || '#e5e7eb', border: `1px solid ${el.stroke || '#d1d5db'}` }} />
                )}
                {el.type === 'image' && (
                  <img alt={el.alt || ''} src={getMediaUrl(el.url)} className="w-full h-full object-contain select-none pointer-events-none" draggable={false} />
                )}
                {el.type === 'video' && (
                  <div className="relative w-full h-full bg-black/5 rounded overflow-hidden">
                    <video
                      src={getMediaUrl(el.url)}
                      className="w-full h-full object-contain select-none pointer-events-none"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute bottom-1 inset-x-1 flex items-center justify-center pointer-events-none">
                      <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm">
                        Video Element (Drag to move)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Shared bounding-box overlay + handles for the current (unlocked) selection */}
          {box && (
            <div
              className="absolute pointer-events-none ring-2 ring-blue-500"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            >
              <button
                type="button"
                aria-label="Delete selection"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow pointer-events-auto cursor-pointer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(ev) => { ev.stopPropagation(); editor.deleteSelected(); }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Handle pos="tl" onPointerDown={(e) => onPointerDownHandle(e, 'tl', interactiveIds)} />
              <Handle pos="tr" onPointerDown={(e) => onPointerDownHandle(e, 'tr', interactiveIds)} />
              <Handle pos="bl" onPointerDown={(e) => onPointerDownHandle(e, 'bl', interactiveIds)} />
              <Handle pos="br" onPointerDown={(e) => onPointerDownHandle(e, 'br', interactiveIds)} />
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.bringToFront()}>
          Bring to Front
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.bringForward()}>
          Bring Forward
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.sendBackward()}>
          Send Backward
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.sendToBack()}>
          Send to Back
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.duplicateSelected()}>
          Duplicate
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.copySelected()}>
          Copy
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => editor.pasteClipboard()}>
          Paste
          <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!hasMultiSelection} onSelect={() => editor.groupSelected()}>
          Group
          <ContextMenuShortcut>Ctrl+G</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasGrouped} onSelect={() => editor.ungroupSelected()}>
          Ungroup
          <ContextMenuShortcut>Ctrl+Shift+G</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onSelect={() => editor.toggleLockSelected()}>
          {hasLocked ? 'Unlock' : 'Lock'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!hasSelection} variant="destructive" onSelect={() => editor.deleteSelected()}>
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
