import React, { useEffect, useRef, useState } from 'react';
import PTMTable from './PTMTable';

export default function PTMTemplateSheetTable({
  rows = [],
  onChangeRows = () => {},
  readOnly = false,
  onAddRow,
  isAdmin = false,
  currentUser = null,
  dbEmployees = [],
  showToast = () => {},
}) {
  const sheetScrollRef = useRef(null);
  const stickyScrollbarRef = useRef(null);
  const zoomSurfaceRef = useRef(null);
  const isSyncingSheetScrollRef = useRef(false);
  const [sheetScrollWidth, setSheetScrollWidth] = useState(1450);
  const [hasSheetHorizontalOverflow, setHasSheetHorizontalOverflow] = useState(false);

  useEffect(() => {
    const sheetEl = sheetScrollRef.current;
    const stickyEl = stickyScrollbarRef.current;
    const zoomEl = zoomSurfaceRef.current;
    if (!sheetEl || !stickyEl) return undefined;

    const updateMetrics = () => {
      const nextWidth = Math.max(sheetEl.scrollWidth || 0, zoomEl?.scrollWidth || 0);
      setSheetScrollWidth(nextWidth);
      setHasSheetHorizontalOverflow(sheetEl.scrollWidth > sheetEl.clientWidth + 1);
      if (Math.abs(stickyEl.scrollLeft - sheetEl.scrollLeft) > 1) {
        stickyEl.scrollLeft = sheetEl.scrollLeft;
      }
    };

    const syncFromSheet = () => {
      if (isSyncingSheetScrollRef.current) return;
      isSyncingSheetScrollRef.current = true;
      stickyEl.scrollLeft = sheetEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingSheetScrollRef.current = false;
      });
    };

    const syncFromSticky = () => {
      if (isSyncingSheetScrollRef.current) return;
      isSyncingSheetScrollRef.current = true;
      sheetEl.scrollLeft = stickyEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingSheetScrollRef.current = false;
      });
    };

    updateMetrics();
    sheetEl.addEventListener('scroll', syncFromSheet, { passive: true });
    stickyEl.addEventListener('scroll', syncFromSticky, { passive: true });

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateMetrics())
      : null;
    if (resizeObserver) {
      resizeObserver.observe(sheetEl);
      if (zoomEl) resizeObserver.observe(zoomEl);
    }
    window.addEventListener('resize', updateMetrics);

    return () => {
      sheetEl.removeEventListener('scroll', syncFromSheet);
      stickyEl.removeEventListener('scroll', syncFromSticky);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [rows.length]);

  return (
    <div className="ptm-page-root relative z-0 w-full min-w-0 flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
      <div
        ref={sheetScrollRef}
        className="ptm-sheet-scroll-container min-w-0 flex-1 overflow-auto"
      >
        <div ref={zoomSurfaceRef} className="min-w-max w-full ptm-zoom-surface">
          <PTMTable
            rows={rows}
            setRows={onChangeRows}
            searchQuery=""
            phaseFilter="all"
            showToast={showToast}
            onAddNewRow={onAddRow}
            selectedUnit="Both"
            isMerged={true}
            isAdmin={readOnly ? false : isAdmin}
            dbEmployees={dbEmployees}
            currentUser={readOnly ? null : currentUser}
            hasFullSheetAccess={!readOnly}
            isHeaderComplete={true}
            selectedHeaderRank=""
            templateMode={true}
          />
        </div>
      </div>
      <div
        ref={stickyScrollbarRef}
        className={`ptm-sticky-h-scrollbar shrink-0 w-full overflow-x-auto overflow-y-hidden bg-slate-100/95 border-t border-slate-300 rounded-b-xl ${hasSheetHorizontalOverflow ? '' : 'hidden'}`}
        aria-label="Template sheet horizontal scrollbar"
      >
        <div style={{ width: `${sheetScrollWidth}px`, height: '1px' }} />
      </div>
    </div>
  );
}
