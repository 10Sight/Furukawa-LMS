import React from "react";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { getMediaUrl } from "@/utils/mediaUtils";

// Element shape:
// { id, type: 'text'|'rect'|'image', xPct, yPct, wPct, hPct, rotation?, text?, fill?, stroke?, url?, aspectRatio? }

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

const Handle = ({ pos, onPointerDown, selected }) => (
  <div
    onPointerDown={onPointerDown}
    data-pos={pos}
    className={clsx(
      "absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border",
      selected ? "bg-blue-500 border-blue-600" : "bg-white border-slate-300",
    )}
    style={{
      left: pos.includes("r") ? "100%" : pos.includes("l") ? 0 : "50%",
      top: pos.includes("b") ? "100%" : pos.includes("t") ? 0 : "50%",
      cursor:
        pos === "tl" || pos === "br" ? "nwse-resize" : pos === "tr" || pos === "bl" ? "nesw-resize" : pos.includes("t") || pos.includes("b") ? "ns-resize" : "ew-resize",
    }}
  />
);

export default function DraggableCanvas({ elements, onChange, className }) {
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ width: 1, height: 1 });
  const [selectedId, setSelectedId] = React.useState(null);
  const [dragState, setDragState] = React.useState(null);
  const [guide, setGuide] = React.useState(null); // { x?, y? }

  useResizeObserver(containerRef, setSize);

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

  const commit = React.useCallback((id, rectPx) => {
    const next = (elements || []).map((el) => el.id === id ? { ...el, ...toPct(rectPx) } : el);
    onChange?.(next);
  }, [elements, onChange, toPct]);

  const onPointerDownItem = (e, el) => {
    e.stopPropagation();
    const r = getPx(el);
    const start = { pointerId: e.pointerId, dx: e.clientX - r.x, dy: e.clientY - r.y };
    setSelectedId(el.id);
    setGuide(null);
    setDragState({ mode: 'move', start, base: r, id: el.id });
  };

  const onPointerDownHandle = (e, el, pos) => {
    e.stopPropagation();
    const r = getPx(el);
    const start = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, rect: r, pos };
    setSelectedId(el.id);
    setGuide(null);
    setDragState({ mode: 'resize', start, id: el.id });
  };

  const clampRect = (rect) => {
    const x = Math.max(0, Math.min(rect.x, size.width - rect.w));
    const y = Math.max(0, Math.min(rect.y, size.height - rect.h));
    const w = Math.max(8, Math.min(rect.w, size.width));
    const h = Math.max(8, Math.min(rect.h, size.height));
    return { x, y, w, h };
  };

  const snap = (rect) => {
    // Snap x to guides (left, center, right)
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
  };

  // Global pointer listeners so the canvas root can be pointer-events-none
  React.useEffect(() => {
    if (!dragState) return;
    const onMove = (e) => {
      if (!dragState) return;
      if (dragState.mode === 'move') {
        const { dx, dy } = dragState.start;
        const base = dragState.base;
        if (!base) return;
        let next = { x: e.clientX - dx, y: e.clientY - dy, w: base.w, h: base.h };
        next = clampRect(next);
        next = snap(next);
        commit(dragState.id, next);
      } else if (dragState.mode === 'resize') {
        const { rect, pos, startX, startY } = dragState.start;
        let x = rect.x, y = rect.y, w = rect.w, h = rect.h;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (pos.includes('r')) w = rect.w + dx;
        if (pos.includes('l')) { w = rect.w - dx; x = rect.x + dx; }
        if (pos.includes('b')) h = rect.h + dy;
        if (pos.includes('t')) { h = rect.h - dy; y = rect.y + dy; }
        let next = clampRect({ x, y, w, h });
        next = snap(next);
        commit(dragState.id, next);
      }
    };
    const onUp = () => {
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
  }, [dragState, commit]);

  // Keyboard nudging + delete
  React.useEffect(() => {
    const onKey = (e) => {
      const active = document.activeElement;
      const isEditable = active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('role') === 'textbox');
      // If focus is inside any editable input / RTE, don't hijack keys
      if (isEditable) return;

      // Delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          const next = (elements || []).filter((el) => el.id !== selectedId);
          setSelectedId(null);
          onChange?.(next);
          return;
        }
      }
      if (!selectedId) return;
      const idx = (elements || []).findIndex((el) => el.id === selectedId);
      if (idx === -1) return;
      const current = elements[idx];
      const rect = getPx(current);
      const step = e.shiftKey ? 10 : 1;
      let changed = false;
      if (e.key === 'ArrowLeft') { rect.x -= step; changed = true; }
      if (e.key === 'ArrowRight') { rect.x += step; changed = true; }
      if (e.key === 'ArrowUp') { rect.y -= step; changed = true; }
      if (e.key === 'ArrowDown') { rect.y += step; changed = true; }
      if (changed) {
        e.preventDefault();
        commit(selectedId, clampRect(rect));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, elements, getPx, commit, onChange]);

  return (
    <div
      ref={containerRef}
      className={clsx("absolute inset-0 pointer-events-none", className)}
    >
      {/* Alignment guides */}
      {guide?.x != null && (
        <div className="absolute top-0 bottom-0 w-px bg-blue-500/60 pointer-events-none" style={{ left: guide.x }} />
      )}
      {guide?.y != null && (
        <div className="absolute left-0 right-0 h-px bg-blue-500/60 pointer-events-none" style={{ top: guide.y }} />
      )}

      {(elements || []).map((el) => {
        const r = getPx(el);
        const selected = selectedId === el.id;
        return (
          <div
            key={el.id}
            role="group"
            aria-label={`${el.type} element`}
            className={clsx(
              "absolute pointer-events-auto",
              selected ? "ring-2 ring-blue-500" : "ring-1 ring-transparent"
            )}
            style={{ left: r.x, top: r.y, width: r.w, height: r.h, cursor: 'move', touchAction: 'none' }}
            onPointerDown={(e) => onPointerDownItem(e, el)}
          >
            {/* Render */}
            {el.type === 'text' && (
              <div
                className="w-full h-full bg-transparent text-[hsl(var(--foreground))] p-2 overflow-hidden"
                style={{
                  background: 'transparent',
                }}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const next = (elements || []).map((x) => x.id === el.id ? { ...x, text: e.currentTarget.innerText } : x);
                  onChange?.(next);
                }}
              >{el.text || 'Text'}</div>
            )}
            {el.type === 'rect' && (
              <div className="w-full h-full" style={{ background: el.fill || '#e5e7eb', border: `1px solid ${el.stroke || '#d1d5db'}` }} />
            )}
            {el.type === 'image' && (
              <img alt={el.alt || ''} src={getMediaUrl(el.url)} className="w-full h-full object-contain select-none pointer-events-none" draggable={false} />
            )}

            {/* Handles (show when selected) */}
            {selected && (
              <>
                <button
                  type="button"
                  aria-label="Delete element"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow pointer-events-auto cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const next = (elements || []).filter((x) => x.id !== el.id);
                    setSelectedId(null);
                    onChange?.(next);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Handle pos="tl" onPointerDown={(e) => onPointerDownHandle(e, el, 'tl')} selected={selected} />
                <Handle pos="tr" onPointerDown={(e) => onPointerDownHandle(e, el, 'tr')} selected={selected} />
                <Handle pos="bl" onPointerDown={(e) => onPointerDownHandle(e, el, 'bl')} selected={selected} />
                <Handle pos="br" onPointerDown={(e) => onPointerDownHandle(e, el, 'br')} selected={selected} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}