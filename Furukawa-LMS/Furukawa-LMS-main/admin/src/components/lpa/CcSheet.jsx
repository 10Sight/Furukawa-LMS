import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { columnName } from '@pages/lpa/lpaWorkbook';
import { OBSERVATION_OPTIONS, normalizeObservationSymbol, getScoreForObservation } from '@pages/lpa/lpaPdcaUtils';
import './ccSheet.css';

// Calibrated column widths matching the reference Excel check sheet:
// Col 0: S.No (32px)
// Col 1: Focus (44px)
// Col 2: CHECKS POINTS col 2 (210px)
// Col 3: CHECKS POINTS col 3 (160px)
// Col 4: CHECKS POINTS col 4 (90px)  --> Total CHECKS POINTS = 460px
// Col 5: Section (48px)
// Col 6: Marks (48px)
// Col 7: Observation (62px)
// Col 8: Score (56px)
const DEFAULT_COLUMN_WIDTHS = [32, 44, 210, 160, 90, 48, 48, 62, 56];

export default function CcSheet({ sheet, disabled, onChange }) {
  const tableRef = useRef(null);
  const rowCount = sheet.rows.length;

  const baseRowHeights = useMemo(() => Array.from({ length: rowCount }, (_, rowIndex) => {
    if (rowIndex === 0) return 28; // Title
    if (rowIndex === 1) return 20; // Date
    if (rowIndex === 2 || rowIndex === 3) return 22; // Column headers
    if (rowIndex >= 4 && rowIndex <= 34) return Math.max(22, (sheet.rowSizes?.[rowIndex]?.hpt || 28) * 0.45); // Data rows
    if (rowIndex === 35 || rowIndex === 36) return 22; // Totals & %
    if (rowIndex === 37) return 22; // Legend Header
    if (rowIndex >= 39 && rowIndex <= 43) return 20; // Legend rows
    if (rowIndex === 44) return 18; // Footer
    return Math.max(16, (sheet.rowSizes?.[rowIndex]?.hpt || 24) * 0.4);
  }), [rowCount, sheet.rowSizes]);

  const [rowHeights, setRowHeights] = useState(baseRowHeights);

  const widths = useMemo(() => {
    if (sheet.columnCount === 9) {
      return DEFAULT_COLUMN_WIDTHS;
    }
    return Array.from({ length: sheet.columnCount }, (_, column) => {
      const source = sheet.columns?.[column];
      return Math.round((source?.wpx || (source?.wch || 10) * 7) * 0.45);
    });
  }, [sheet.columnCount, sheet.columns]);

  const tableWidth = widths.reduce((sum, width) => sum + width, 0);

  const observationColumn = useMemo(() => {
    for (const row of sheet.rows.slice(0, 8)) {
      const index = row.findIndex(cell => /^observation$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
      if (index >= 0) return index;
    }
    return 7;
  }, [sheet.rows]);

  const scoreColumn = useMemo(() => {
    for (const row of sheet.rows.slice(0, 8)) {
      const index = row.findIndex(cell => /^score$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
      if (index >= 0) return index;
    }
    return 8;
  }, [sheet.rows]);

  // Scoring summary calculation from current rows
  const scoringSummary = useMemo(() => {
    let totalScore = 0;
    let totalMarks = 0;
    let hasAnyObs = false;

    for (let r = 4; r <= 34; r++) {
      const row = sheet.rows[r];
      if (!row) continue;
      const obs = normalizeObservationSymbol(row[observationColumn]?.formatted ?? String(row[observationColumn]?.value ?? ''));
      const marksVal = Number(row[6]?.formatted ?? row[6]?.value ?? 0) || 0;

      if (obs) hasAnyObs = true;
      if (obs === 'NA') continue;

      totalMarks += marksVal;
      if (obs === 'O' || obs === '△') {
        totalScore += 3;
      } else if (obs === '×') {
        totalScore += 0;
      } else {
        const curScore = row[scoreColumn]?.value ?? row[scoreColumn]?.formatted;
        if (typeof curScore === 'number') totalScore += curScore;
        else if (Number(curScore) > 0) totalScore += Number(curScore);
      }
    }

    const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;
    return { totalScore, totalMarks, percentage, hasAnyObs };
  }, [sheet.rows, observationColumn, scoreColumn]);

  const handleObservationChange = (r, c, newVal) => {
    const norm = normalizeObservationSymbol(newVal);
    const scoreVal = getScoreForObservation(norm);

    // Calculate updated summary across all rows 4 to 34
    let totalScore = 0;
    let totalMarks = 0;

    for (let rowIndex = 4; rowIndex <= 34; rowIndex++) {
      const row = sheet.rows[rowIndex];
      if (!row) continue;
      const currentObs = rowIndex === r ? norm : normalizeObservationSymbol(row[observationColumn]?.formatted ?? String(row[observationColumn]?.value ?? ''));
      const marksVal = Number(row[6]?.formatted ?? row[6]?.value ?? 0) || 0;

      if (currentObs === 'NA') {
        // Excluded from denominator and does not add score
        continue;
      }

      totalMarks += marksVal;

      if (currentObs === 'O' || currentObs === '△') {
        totalScore += 3;
      } else if (currentObs === '×') {
        totalScore += 0;
      } else if (rowIndex !== r) {
        // Fallback for untouched rows with existing score
        const cur = row[scoreColumn]?.value ?? row[scoreColumn]?.formatted;
        if (typeof cur === 'number') totalScore += cur;
        else if (Number(cur) > 0) totalScore += Number(cur);
      }
    }

    const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;

    const extraUpdates = [
      { rowIndex: r, columnIndex: scoreColumn, value: scoreVal },
      { rowIndex: 35, columnIndex: 6, value: totalMarks },
      { rowIndex: 35, columnIndex: scoreColumn, value: totalScore },
      { rowIndex: 36, columnIndex: 6, value: percentage }
    ];

    onChange(r, c, norm, extraUpdates);
  };

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
                let value = row[columnIndex]?.formatted ?? String(row[columnIndex]?.value ?? '');
                const style = row[columnIndex]?.style;

                // Observation & Score detection
                const isObservation = columnIndex === observationColumn && rowIndex >= 4 && rowIndex <= 34;
                const isScore = columnIndex === scoreColumn && rowIndex >= 4 && rowIndex <= 34;
                const isMark = columnIndex === 6 && rowIndex >= 4 && rowIndex <= 34;
                const isNumber = columnIndex === 0 && rowIndex >= 4 && rowIndex <= 34;
                const isQuestion = columnIndex === 2 && rowIndex >= 4 && rowIndex <= 34;
                const isTotalMarks = rowIndex === 35 && columnIndex === 6;
                const isTotalScore = rowIndex === 35 && columnIndex === scoreColumn;
                const isPercentage = rowIndex === 36 && columnIndex === 6;

                // Sync live summary values for display
                if (scoringSummary.hasAnyObs) {
                  if (isTotalMarks) value = String(scoringSummary.totalMarks);
                  if (isTotalScore) value = String(scoringSummary.totalScore);
                  if (isPercentage) value = String(scoringSummary.percentage);
                }

                const fill = style?.fgColor?.rgb;
                const backgroundColor = isPercentage ? '#FFFF00' : (fill && /^[0-9A-F]{6,8}$/i.test(fill) ? `#${fill.slice(-6)}` : undefined);

                const classes = [
                  rowIndex === 0 ? 'cc-title' : '',
                  rowIndex === 1 ? 'cc-date' : '',
                  (rowIndex === 2 || rowIndex === 3) ? 'cc-column-heading' : '',
                  rowIndex === 35 ? 'cc-total' : '',
                  rowIndex === 36 ? 'cc-percentage-row' : '',
                  isPercentage ? 'cc-percentage-cell' : '',
                  rowIndex === 37 ? 'cc-legend-heading' : '',
                  rowIndex >= 39 && rowIndex <= 43 ? 'cc-legend-row' : '',
                  rowIndex === 44 ? 'cc-footer' : '',
                  rowIndex === 44 && columnIndex === 6 ? 'cc-footer-date' : '',
                  (columnIndex === 1 || columnIndex === 5) && merge?.e.r > rowIndex ? 'cc-vertical' : '',
                  isNumber ? 'cc-number' : '',
                  isMark ? 'cc-mark' : '',
                  isScore ? 'cc-score-cell' : '',
                  isObservation ? 'cc-obs-cell' : '',
                  isQuestion ? 'cc-question' : '',
                ].filter(Boolean).join(' ');

                const isVertical = classes.split(' ').includes('cc-vertical');

                return (
                  <td
                    key={columnIndex}
                    rowSpan={merge ? merge.e.r - rowIndex + 1 : 1}
                    colSpan={merge ? merge.e.c - columnIndex + 1 : 1}
                    className={classes}
                    style={{ backgroundColor }}
                  >
                    {isVertical && (
                      <div className="cc-vertical-text">
                        <span>{value}</span>
                      </div>
                    )}

                    {!isVertical && isObservation && (
                      <div className="cc-observation-container">
                        <select
                          aria-label={`${sheet.name} Observation row ${rowIndex + 1}`}
                          disabled={disabled}
                          value={normalizeObservationSymbol(value)}
                          onChange={event => handleObservationChange(rowIndex, columnIndex, event.target.value)}
                          className="cc-observation-select"
                        >
                          <option value=""></option>
                          {OBSERVATION_OPTIONS.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {!isVertical && isScore && (
                      <div className="cc-score-display" aria-label={`Score row ${rowIndex + 1}`}>
                        {value}
                      </div>
                    )}

                    {!isVertical && isMark && (
                      <div className="cc-mark-display">
                        {value}
                      </div>
                    )}

                    {!isVertical && isNumber && (
                      <div className="cc-number-display">
                        {value}
                      </div>
                    )}

                    {!isVertical && isPercentage && (
                      <div className="cc-percentage-display">
                        {value}
                      </div>
                    )}

                    {!isVertical && !isObservation && !isScore && !isMark && !isNumber && !isPercentage && (
                      <textarea
                        aria-label={`${sheet.name} ${columnName(columnIndex)}${rowIndex + 1}`}
                        disabled={disabled || isTotalMarks || isTotalScore}
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
                      />
                    )}
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
