import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { columnName } from '@pages/lpa/lpaWorkbook';
import './ccSheet.css';

const WIDTH_SCALE = 0.447;

export default function CcSheet({ sheet, disabled, onChange }) {
  const tableRef = useRef(null);
  const rowCount = sheet.rows.length;
  const baseRowHeights = useMemo(() => Array.from({ length: rowCount }, (_, rowIndex) =>
    Math.max(12, (sheet.rowSizes?.[rowIndex]?.hpt || 30) * 0.39)), [rowCount, sheet.rowSizes]);
  const [rowHeights, setRowHeights] = useState(baseRowHeights);
  const widths = useMemo(() => Array.from({ length: sheet.columnCount }, (_, column) => {
    const source = sheet.columns?.[column];
    return Math.round((source?.wpx || (source?.wch || 10) * 7) * WIDTH_SCALE);
  }), [sheet.columnCount, sheet.columns]);
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const merges = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    for (const merge of sheet.merges || []) {
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let row = merge.s.r; row <= merge.e.r; row++) {
        for (let column = merge.s.c; column <= merge.e.c; column++) {
          if (row !== merge.s.r || column !== merge.s.c) hidden.add(`${row}:${column}`);
        }
      }
    }
    return { anchors, hidden };
  }, [sheet.merges]);
  const measureRow = useCallback(rowIndex => {
    const row = tableRef.current?.rows[rowIndex];
    if (!row) return;
    let height = baseRowHeights[rowIndex];
    for (const textarea of row.querySelectorAll('textarea')) {
      if (textarea.closest('td')?.classList.contains('cc-vertical')) continue;
      const previousHeight = textarea.style.height;
      textarea.style.height = 'auto';
      height = Math.max(height, textarea.scrollHeight);
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

  return (
    <div className="cc-check-sheet" style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
      <table ref={tableRef} className="cc-check-sheet-table" style={{ width: `${tableWidth}px` }} aria-label={`${sheet.name} editable C&C LPA form`}>
        <colgroup>{widths.map((width, column) => <col key={column} style={{ width: `${width}px` }} />)}</colgroup>
        <tbody>
          {sheet.rows.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ height: `${rowHeights[rowIndex] ?? baseRowHeights[rowIndex]}px` }}>
              {Array.from({ length: sheet.columnCount }, (_, columnIndex) => {
                const key = `${rowIndex}:${columnIndex}`;
                if (merges.hidden.has(key)) return null;
                const merge = merges.anchors.get(key);
                const value = row[columnIndex]?.formatted ?? String(row[columnIndex]?.value ?? '');
                const style = row[columnIndex]?.style;
                const fill = style?.fgColor?.rgb;
                const backgroundColor = fill && /^[0-9A-F]{6,8}$/i.test(fill) ? `#${fill.slice(-6)}` : undefined;
                const classes = [
                  rowIndex === 0 ? 'cc-title' : '',
                  rowIndex === 1 ? 'cc-date' : '',
                  (rowIndex === 2 || rowIndex === 3) ? 'cc-column-heading' : '',
                  rowIndex === 35 || rowIndex === 36 ? 'cc-total' : '',
                  rowIndex === 37 ? 'cc-legend-heading' : '',
                  rowIndex >= 39 && rowIndex <= 43 ? 'cc-legend-row' : '',
                  rowIndex === 44 ? 'cc-footer' : '',
                  rowIndex === 44 && columnIndex === 6 ? 'cc-footer-date' : '',
                  (columnIndex === 1 || columnIndex === 5) && merge?.e.r > rowIndex ? 'cc-vertical' : '',
                  columnIndex === 0 && rowIndex >= 4 && rowIndex <= 34 ? 'cc-number' : '',
                  columnIndex === 6 && rowIndex >= 4 && rowIndex <= 35 ? 'cc-mark' : '',
                  (columnIndex === 7 || columnIndex === 8) && rowIndex >= 4 && rowIndex <= 36 ? 'cc-score-cell' : '',
                  columnIndex === 2 && rowIndex >= 4 && rowIndex <= 34 ? 'cc-question' : '',
                ].filter(Boolean).join(' ');
                const isVertical = classes.split(' ').includes('cc-vertical');
                const mergedHeight = merge
                  ? rowHeights.slice(rowIndex, merge.e.r + 1).reduce((sum, height) => sum + height, 0)
                  : rowHeights[rowIndex];
                const verticalWidth = Math.max(32, Math.ceil(value.length * 5.2));
                const verticalScale = Math.min(1, mergedHeight / verticalWidth);
                return (
                  <td key={columnIndex} rowSpan={merge ? merge.e.r - rowIndex + 1 : 1} colSpan={merge ? merge.e.c - columnIndex + 1 : 1} className={classes} style={{ backgroundColor }}>
                    {isVertical && <div className="cc-vertical-editor">
                      <textarea
                        className="cc-vertical-input"
                        style={{ width: `${verticalWidth}px`, height: '18px', transform: `rotate(-90deg) scale(${verticalScale})` }}
                        aria-label={`${sheet.name} ${columnName(columnIndex)}${rowIndex + 1}`}
                        disabled={disabled}
                        value={value}
                        onChange={event => onChange(rowIndex, columnIndex, event.target.value)}
                        spellCheck={false}
                        rows={1}
                        title={row[columnIndex]?.formula ? `Excel formula: =${row[columnIndex].formula}` : undefined}
                      />
                    </div>}
                    {!isVertical && <textarea
                      aria-label={`${sheet.name} ${columnName(columnIndex)}${rowIndex + 1}`}
                      disabled={disabled}
                      value={value}
                      onKeyDown={event => {
                        if ((event.key === 'Enter' && event.shiftKey) || event.key === 'Backspace') {
                          const textarea = event.currentTarget;
                          requestAnimationFrame(() => {
                            if (textarea.isConnected) measureRow(rowIndex);
                          });
                        }
                      }}
                      onChange={event => {
                        onChange(rowIndex, columnIndex, event.target.value);
                        requestAnimationFrame(() => measureRow(rowIndex));
                      }}
                      spellCheck={false}
                      rows={1}
                      title={row[columnIndex]?.formula ? `Excel formula: =${row[columnIndex].formula}` : undefined}
                    />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
