import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { columnName } from '@pages/lpa/lpaWorkbook';
import './assemblySheet.css';

// Column proportions and merged ranges follow the supplied Assembly form.
const WIDTHS = [19, 30, 321, 40, 59, 53, 38, 47, 45, 47, 46, 73, 329, 89];
export default function AssemblySheet({ sheet, disabled, onChange }) {
  const sheetRef = useRef(null);
  const rowCount = sheet.rows.length;
  const baseRowHeights = useMemo(() => Array.from({ length: rowCount }, (_, rowIndex) =>
    Math.max(12, (sheet.rowSizes?.[rowIndex]?.hpt || 54) * 0.39)), [rowCount, sheet.rowSizes]);
  const [rowHeights, setRowHeights] = useState(baseRowHeights);
  const merges = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    for (const merge of sheet.merges || []) {
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r !== merge.s.r || c !== merge.s.c) hidden.add(`${r}:${c}`);
      }
    }
    return { anchors, hidden };
  }, [sheet.merges]);
  const measureRow = useCallback(rowIndex => {
    const row = sheetRef.current?.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (!row) return;
    let height = baseRowHeights[rowIndex];
    for (const textarea of row.querySelectorAll('textarea')) {
      const cell = textarea.closest('td');
      if (cell?.classList.contains('assembly-vertical')) continue;
      const previousHeight = textarea.style.height;
      textarea.style.height = 'auto';
      const span = cell?.rowSpan || 1;
      const baseSpanHeight = baseRowHeights.slice(rowIndex, rowIndex + span).reduce((sum, value) => sum + value, 0);
      height = Math.max(height, baseRowHeights[rowIndex] + Math.max(0, textarea.scrollHeight - baseSpanHeight));
      textarea.style.height = previousHeight;
    }
    height = Math.ceil(height);
    setRowHeights(previous => previous[rowIndex] === height
      ? previous
      : previous.map((current, index) => index === rowIndex ? height : current));
  }, [baseRowHeights]);

  useEffect(() => {
    setRowHeights(baseRowHeights);
    const frame = requestAnimationFrame(() => baseRowHeights.forEach((_, rowIndex) => measureRow(rowIndex)));
    return () => cancelAnimationFrame(frame);
  }, [baseRowHeights, measureRow, sheet.name]);
  // Layout comes from merged ranges, so editing titles cannot change the form view.
  const pdcaStart = sheet.merges?.find(merge => merge.s.c === 0 && merge.e.c === 13 && merge.s.r === merge.e.r && merge.s.r > 40)?.s.r ?? -1;
  const legendStart = sheet.merges?.find(merge => merge.s.c === 0 && merge.e.c === 2 && merge.s.r > 30 && merge.e.r === merge.s.r + 1)?.s.r ?? -1;
  const renderRows = (start, end) => sheet.rows.slice(start, end).map((row, offset) => {
    const r = start + offset;
    // Omit the completion legend beneath the PDCA footer; preserve stored cells and added rows.
    if (pdcaStart >= 0 && r >= pdcaStart + 24 && r <= pdcaStart + 35) return null;
    const height = rowHeights[r] ?? baseRowHeights[r];
    const gap = r === legendStart - 1 || (pdcaStart >= 0 && r === pdcaStart - 1) || (pdcaStart >= 0 && r === pdcaStart - 2);
    return <tr key={r} data-row-index={r} style={{ height }} className={gap ? 'assembly-gap' : pdcaStart >= 0 && r >= pdcaStart + 31 && r <= pdcaStart + 35 ? 'assembly-tail-blank' : undefined}>
      {Array.from({ length: sheet.columnCount }, (_, c) => {
        const key = `${r}:${c}`;
        if (merges.hidden.has(key)) return null;
        const merge = merges.anchors.get(key);
        const cell = row[c];
        const value = cell?.formatted ?? String(cell?.value ?? '');
        const vertical = r >= 3 && r < legendStart && (c === 1 || c === 6) && merge?.e.r > r;
        const heading = r === 0 || r === 1 || r === pdcaStart || r === pdcaStart + 1 || r === legendStart;
        const notes = r === 3 && c === 11;
        const footer = r === legendStart + 7 || (pdcaStart >= 0 && r === pdcaStart + 23);
        const richCheck = c === 2 && r >= 3 && r <= 7;
        const lines = value.split('\n');
        const titleLine = lines.findIndex(line => line.trim());
        const classes = [heading ? 'assembly-heading' : '', vertical ? 'assembly-vertical' : '', notes ? 'assembly-notes' : '', footer ? 'assembly-footer' : '', r === 37 && c === 3 ? 'assembly-total' : '', r >= 3 && r < legendStart && c === 2 ? 'assembly-check' : '', r >= 3 && r < legendStart && [0, 3, 5].includes(c) && /^\d+$/.test(value.trim()) ? 'assembly-number' : '', r >= legendStart && r <= legendStart + 6 && c >= 9 ? 'assembly-outside-legend' : '', pdcaStart >= 0 && r > pdcaStart + 23 && (c < 5 || c > 7) ? 'assembly-outside-symbols' : '', pdcaStart >= 0 && r > pdcaStart + 23 && c >= 8 ? 'assembly-hide-overflow' : '', r === 1 && c >= 7 && c <= 10 ? 'assembly-requirement' : '', richCheck ? 'assembly-rich-check' : '', pdcaStart >= 0 && r > pdcaStart + 23 && c === 5 ? 'assembly-completion' : '', c === 0 && r >= legendStart + 2 && r <= legendStart + 6 ? 'assembly-legend-label' : '', c === 0 && r === legendStart + 6 ? 'assembly-horizontal' : ''].filter(Boolean).join(' ');
        return <td key={c} rowSpan={merge ? merge.e.r - r + 1 : 1} colSpan={merge ? merge.e.c - c + 1 : 1} className={classes}>
          <textarea aria-label={`${sheet.name} ${columnName(c)}${r + 1}`} disabled={disabled} value={value}
            onKeyDown={event => {
              if ((event.key === 'Enter' && event.shiftKey) || event.key === 'Backspace') {
                const textarea = event.currentTarget;
                requestAnimationFrame(() => { if (textarea.isConnected) measureRow(r); });
              }
            }}
            onChange={event => {
              onChange(r, c, event.target.value);
              requestAnimationFrame(() => measureRow(r));
            }}
            spellCheck={false} rows={1} />
          {richCheck && <div aria-hidden="true" className="assembly-check-preview">{lines.slice(0, titleLine).map((line, index) => <React.Fragment key={index}>{line}{'\n'}</React.Fragment>)}<strong><u>{lines[titleLine]}</u></strong>{'\n'}{lines.slice(titleLine + 1).join('\n')}</div>}
        </td>;
      })}
    </tr>;
  });
  const table = (start, end, className) => <table className={`assembly-form-table ${className}`} aria-label={`${sheet.name} ${className === 'assembly-pdca-table' ? 'LPA PDCA' : 'audit check sheet'}`}>
    <colgroup>{WIDTHS.map((width, c) => <col key={c} style={{ width: `${width / 1236 * 100}%` }} />)}</colgroup>
    <tbody>{renderRows(start, end)}</tbody>
  </table>;
  return <div className="assembly-sheet" ref={sheetRef}>
    <div className="assembly-audit-paper">
      {table(0, pdcaStart < 0 ? sheet.rows.length : pdcaStart, 'assembly-audit-table')}
    </div>
    {pdcaStart >= 0 && table(pdcaStart, sheet.rows.length, 'assembly-pdca-table')}
  </div>;
}
