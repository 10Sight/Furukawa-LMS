import React, { useEffect, useRef, useState } from 'react';
import './formZoom.css';

// Scale only the form surface. CSS zoom participates in layout and scroll bounds.
export default function FormZoomControls({ selector = 'table', rootSelector, propertyOnly = false }) {
  const [level, setLevel] = useState(100);
  const ref = useRef(null);
  useEffect(() => {
    const host = rootSelector ? ref.current.closest(rootSelector) : ref.current.closest('header')?.parentElement;
    if (!host) return;
    host.style.setProperty('--form-zoom', level / 100);
    const surfaces = propertyOnly ? [] : host.querySelectorAll(selector);
    surfaces.forEach(surface => { surface.style.zoom = level / 100; });
    return () => {
      host.style.removeProperty('--form-zoom');
      surfaces.forEach(surface => { surface.style.zoom = ''; });
    };
  });
  return <div ref={ref} className="form-zoom-controls" role="group" aria-label="Form zoom">
    <button type="button" aria-label="Zoom out" title="Zoom out" disabled={level <= 50} onClick={() => setLevel(v => Math.max(50, v - 10))}>−</button>
    <button type="button" className="form-zoom-reset" aria-label="Reset form zoom to 100%" title="Reset zoom" onClick={() => setLevel(100)}>{level}%</button>
    <button type="button" aria-label="Zoom in" title="Zoom in" disabled={level >= 150} onClick={() => setLevel(v => Math.min(150, v + 10))}>+</button>
  </div>;
}
