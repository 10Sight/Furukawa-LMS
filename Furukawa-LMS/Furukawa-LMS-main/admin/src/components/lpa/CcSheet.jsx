import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { columnName } from '@pages/lpa/lpaWorkbook';
import { OBSERVATION_OPTIONS, normalizeObservationSymbol, getScoreForObservation } from '@pages/lpa/lpaPdcaUtils';
import { getActiveAuditColumns } from './assemblySheetUtils';
import './ccSheet.css';

export default function CcSheet({ sheet, editor, disabled, onChange }) {
  const tableRef = useRef(null);
  const rowCount = sheet.rows.length;

  const marksColumn = useMemo(() => {
    for (const row of sheet.rows.slice(0, 8)) {
      const index = row.findIndex(cell => /^marks$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
      if (index >= 0) return index;
    }
    return 6;
  }, [sheet.rows]);

  const auditColumns = useMemo(() => {
    return getActiveAuditColumns(sheet, null, true);
  }, [sheet]);

  // Dynamic Column Widths for C&C Form matching Assembly Form proportions:
  // Base columns (0-6): Sl No (35px), Focus (50px), Checks Points (220px + 140px + 80px = 440px), Section (40px), Marks (45px)
  // Audit columns (7+): Observation (75px), Score (50px) per column group
  const baseWidths = [35, 50, 220, 140, 80, 40, 45];
  const widths = useMemo(() => {
    const list = [...baseWidths];
    auditColumns.forEach(() => {
      list.push(80, 55); // Observation: 80px, Score: 55px (135px total per audit level group)
    });
    while (list.length < (sheet.columnCount || 0)) {
      list.push(list.length % 2 === 1 ? 80 : 55);
    }
    return list;
  }, [auditColumns, sheet.columnCount]);
  const tableWidth = useMemo(() => widths.reduce((sum, width) => sum + width, 0), [widths]);

  const baseRowHeights = useMemo(() => Array.from({ length: rowCount }, (_, rowIndex) => {
    if (rowIndex === 0) return 30; // Title row
    if (rowIndex === 1) return 24; // Date / Line row
    if (rowIndex === 2) return 48; // Header Row 2 (Level titles + View Only badge)
    if (rowIndex === 3) return 26; // Header Row 3 (Observation & Score titles)
    if (rowIndex >= 4 && rowIndex <= 34) {
      return Math.max(28, (sheet.rowSizes?.[rowIndex]?.hpt || 30) * 0.44);
    }
    if (rowIndex === 35 || rowIndex === 36) return 28; // Total and Percentage rows
    if (rowIndex === 37 || rowIndex === 38) return 22; // Legend header
    if (rowIndex >= 39 && rowIndex <= 43) return 26; // Legend criteria rows
    if (rowIndex === 44) return 30; // Footer row
    return Math.max(14, (sheet.rowSizes?.[rowIndex]?.hpt || 30) * 0.39);
  }), [rowCount, sheet.rowSizes]);
  const [rowHeights, setRowHeights] = useState(baseRowHeights);

  const sheetTargetLevel = sheet?.targetLevel || editor?.targetLevel || editor?.level || (auditColumns.some(c => c.level === 'L1') ? 'L1' : auditColumns.some(c => c.level === 'L2') ? 'L2' : 'L3');

  const sourceShiftStatus = useMemo(() => {
    const raw = sheet?.sourceShiftStatus || editor?.sourceShiftStatus;
    if (raw && (raw.A !== undefined || raw.B !== undefined)) return raw;

    const colA = auditColumns.find(g => g.id === 'L3_A' || (g.level === 'L3' && g.shift === 'A'));
    const colB = auditColumns.find(g => g.id === 'L3_B' || (g.level === 'L3' && g.shift === 'B'));
    const colL2 = auditColumns.find(g => g.id === 'L2' || g.level === 'L2');

    const hasA = colA ? sheet.rows.some((r, idx) => idx >= 4 && idx <= 34 && Boolean(r[colA.obsCol]?.value || r[colA.obsCol]?.formatted)) : false;
    const hasB = colB ? sheet.rows.some((r, idx) => idx >= 4 && idx <= 34 && Boolean(r[colB.obsCol]?.value || r[colB.obsCol]?.formatted)) : false;
    const hasL2 = colL2 ? sheet.rows.some((r, idx) => idx >= 4 && idx <= 34 && Boolean(r[colL2.obsCol]?.value || r[colL2.obsCol]?.formatted)) : false;

    return { A: hasA, B: hasB, L2: hasL2 };
  }, [sheet, editor, auditColumns]);

  const hasColumnData = useCallback((colGroup) => {
    if (!colGroup) return false;
    if (colGroup.shift === 'A') return Boolean(sourceShiftStatus.A);
    if (colGroup.shift === 'B') return Boolean(sourceShiftStatus.B);
    if (colGroup.level === 'L2' && sheetTargetLevel === 'L1') return Boolean(sourceShiftStatus.L2);
    return true;
  }, [sourceShiftStatus, sheetTargetLevel]);

  const isLevelReadOnly = useCallback((colGroup) => {
    if (!colGroup) return false;
    if (colGroup.isFetched) return true;
    if (sheetTargetLevel === 'L1') {
      return colGroup.level === 'L3' || colGroup.level === 'L2';
    }
    if (sheetTargetLevel === 'L2') {
      return colGroup.level === 'L3';
    }
    return false;
  }, [sheetTargetLevel]);

  // Dynamic live summary & percentage for each column group in C&C form
  const columnScores = useMemo(() => {
    const scores = {};
    auditColumns.forEach((colGroup) => {
      let applicableMarks = 0;
      let scoreSum = 0;
      for (let r = 4; r <= 34; r++) {
        const row = sheet.rows[r];
        if (!row) continue;
        const obs = normalizeObservationSymbol(row[colGroup.obsCol]?.value ?? row[colGroup.obsCol]?.formatted);
        if (obs === 'NA') continue;

        const marksNum = Number(row[marksColumn]?.value ?? row[marksColumn]?.formatted ?? 0);
        if (Number.isFinite(marksNum) && marksNum > 0) {
          applicableMarks += marksNum;
        }

        const scoreVal = row[colGroup.scoreCol]?.value ?? row[colGroup.scoreCol]?.formatted;
        if (scoreVal !== '' && scoreVal !== 'NA' && scoreVal != null) {
          const numScore = Number(scoreVal);
          if (Number.isFinite(numScore)) {
            scoreSum += numScore;
          }
        }
      }

      const pctNum = applicableMarks > 0 ? Math.round((scoreSum / applicableMarks) * 100) : 0;
      scores[colGroup.id] = {
        totalMarks: applicableMarks || 62,
        totalScore: scoreSum,
        percentageText: `${pctNum}%`,
        obsCol: colGroup.obsCol,
        scoreCol: colGroup.scoreCol
      };
    });
    return scores;
  }, [sheet.rows, marksColumn, auditColumns]);

  const handleObservationChange = (r, obsCol, scoreCol, newVal) => {
    const colGroup = auditColumns.find(g => g.obsCol === obsCol);
    if (isLevelReadOnly(colGroup)) return;
    const row = sheet.rows[r];
    const marksVal = marksColumn >= 0 ? (row?.[marksColumn]?.value ?? row?.[marksColumn]?.formatted) : 3;
    const scoreVal = getScoreForObservation(newVal, marksVal);
    const extraUpdates = [{ rowIndex: r, columnIndex: scoreCol, value: scoreVal }];
    onChange(r, obsCol, newVal, extraUpdates);
    onChange(r, scoreCol, scoreVal);
  };

  const merges = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    const lastCol = Math.max(6, (sheet.columnCount || 7) - 1);

    // Keep all non-legend merges (rows < 37)
    const effectiveMerges = (sheet.merges || []).filter(m => m.s.r < 37);

    // Canonical full-width legend merges
    effectiveMerges.push(
      { s: { c: 0, r: 37 }, e: { c: 2, r: 38 } },
      { s: { c: 3, r: 37 }, e: { c: 3, r: 38 } },
      { s: { c: 4, r: 37 }, e: { c: lastCol, r: 38 } }
    );
    for (let r = 39; r <= 43; r++) {
      effectiveMerges.push(
        { s: { c: 0, r }, e: { c: 2, r } },
        { s: { c: 5, r }, e: { c: lastCol, r } }
      );
    }
    effectiveMerges.push(
      { s: { c: 0, r: 44 }, e: { c: 5, r: 44 } },
      { s: { c: 6, r: 44 }, e: { c: lastCol, r: 44 } }
    );

    for (const merge of effectiveMerges) {
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let row = merge.s.r; row <= merge.e.r; row++) {
        for (let column = merge.s.c; column <= merge.e.c; column++) {
          if (row !== merge.s.r || column !== merge.s.c) hidden.add(`${row}:${column}`);
        }
      }
    }
    return { anchors, hidden };
  }, [sheet.merges, sheet.columnCount]);

  const measureRow = useCallback(rowIndex => {
    if (rowIndex === 2 || rowIndex === 3) return; // Keep fixed heights for sticky headers
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

  const firstGroupId = auditColumns[0]?.id;
  const firstTotalMarks = columnScores[firstGroupId]?.totalMarks ?? 62;

  return (
    <div className="cc-check-sheet" style={{ width: `${tableWidth}px`, minWidth: `${tableWidth}px` }}>
      <table ref={tableRef} className="cc-check-sheet-table" style={{ width: `${tableWidth}px` }} aria-label={`${sheet.name} editable C&C LPA form`}>
        <colgroup>{widths.map((width, column) => <col key={column} style={{ width: `${width}px` }} />)}</colgroup>
        <tbody>
          {sheet.rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              data-row-index={rowIndex}
              style={{ height: `${rowHeights[rowIndex] ?? baseRowHeights[rowIndex]}px` }}
              className={rowIndex === 2 ? 'cc-header-row-2' : rowIndex === 3 ? 'cc-header-row-3' : undefined}
            >
              {Array.from({ length: sheet.columnCount }, (_, columnIndex) => {
                const key = `${rowIndex}:${columnIndex}`;
                if (merges.hidden.has(key)) return null;
                const merge = merges.anchors.get(key);
                const value = row[columnIndex]?.formatted ?? String(row[columnIndex]?.value ?? '');
                const style = row[columnIndex]?.style;

                // Audit column group matching
                const activeObsGroup = auditColumns.find(g => g.obsCol === columnIndex);
                const activeScoreGroup = auditColumns.find(g => g.scoreCol === columnIndex);

                const isObservation = Boolean(activeObsGroup) && rowIndex >= 4 && rowIndex <= 34;
                const fill = style?.fgColor?.rgb;
                const backgroundColor = fill && /^[0-9A-F]{6,8}$/i.test(fill) ? `#${fill.slice(-6)}` : undefined;
                const isLevelHeader = rowIndex === 2 && Boolean(activeObsGroup);
                const isSubHeader = rowIndex === 3 && (Boolean(activeObsGroup) || Boolean(activeScoreGroup));
                const isBaseHeader = (rowIndex === 2 || rowIndex === 3) && columnIndex < 7;
                const isStickyRow2 = rowIndex === 2;
                const isStickyRow3 = rowIndex === 3;

                const classes = [
                  rowIndex === 0 ? 'cc-title' : '',
                  rowIndex === 1 ? 'cc-date' : '',
                  isStickyRow2 ? 'cc-sticky-row-2' : '',
                  isStickyRow3 ? 'cc-sticky-row-3' : '',
                  isBaseHeader ? 'cc-column-heading' : '',
                  isLevelHeader ? 'cc-level-group-header' : '',
                  isSubHeader ? 'cc-sub-header' : '',
                  rowIndex === 35 || rowIndex === 36 ? 'cc-total' : '',
                  rowIndex === 37 ? 'cc-legend-heading' : '',
                  rowIndex >= 39 && rowIndex <= 43 ? 'cc-legend-row' : '',
                  rowIndex === 44 ? 'cc-footer' : '',
                  rowIndex === 44 && columnIndex === 6 ? 'cc-footer-date' : '',
                  (columnIndex === 1 || columnIndex === 5) && merge?.e.r > rowIndex ? 'cc-vertical' : '',
                  columnIndex === 0 && rowIndex >= 4 && rowIndex <= 34 ? 'cc-number' : '',
                  columnIndex === 6 && rowIndex >= 4 && rowIndex <= 35 ? 'cc-mark' : '',
                  (Boolean(activeObsGroup) || Boolean(activeScoreGroup)) && rowIndex >= 4 && rowIndex <= 36 ? 'cc-score-cell' : '',
                  columnIndex === 2 && rowIndex >= 4 && rowIndex <= 34 ? 'cc-question' : '',
                ].filter(Boolean).join(' ');
                const isVertical = classes.split(' ').includes('cc-vertical');
                let cellDisplay = value;

                // Row 35: Total Marks (col 6) and Total Scores for each group
                if (rowIndex === 35) {
                  if (columnIndex === 6) cellDisplay = String(firstTotalMarks);
                  else if (activeScoreGroup) cellDisplay = hasColumnData(activeScoreGroup) ? String(columnScores[activeScoreGroup.id]?.totalScore ?? 0) : '-';
                } else if (rowIndex === 36) {
                  if (columnIndex === 6) cellDisplay = columnScores[firstGroupId]?.percentageText ?? '0.00%';
                  else if (activeObsGroup) cellDisplay = hasColumnData(activeObsGroup) ? (columnScores[activeObsGroup.id]?.percentageText ?? '0.00%') : 'No data';
                }

                return (
                  <td key={columnIndex} rowSpan={merge ? merge.e.r - rowIndex + 1 : 1} colSpan={merge ? merge.e.c - columnIndex + 1 : 1} className={classes} style={{ backgroundColor }}>
                    {isVertical && (
                      <div className="cc-vertical-cell-wrapper">
                        <span className="cc-vertical-cell-text">
                          {cellDisplay}
                        </span>
                      </div>
                    )}
                    {!isVertical && isLevelHeader && (
                      <div className="flex flex-col items-center justify-center p-1 text-center select-none w-full min-h-[46px] leading-tight">
                        <span className="font-extrabold text-[11px] text-[#1e40af] leading-tight">{activeObsGroup.name}</span>
                        {isLevelReadOnly(activeObsGroup) && (
                          <span className="mt-0.5 text-[8.5px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-bold uppercase tracking-wider shrink-0">
                            View Only
                          </span>
                        )}
                      </div>
                    )}
                    {!isVertical && isSubHeader && (
                      <div className="text-center font-bold text-[10.5px] text-slate-700 py-0.5 select-none">
                        {Boolean(activeObsGroup) ? 'Observation' : 'Score'}
                      </div>
                    )}
                    {!isVertical && isBaseHeader && (
                      <div className="text-center font-extrabold text-[11px] text-slate-900 py-1 select-none">
                        {cellDisplay}
                      </div>
                    )}
                    {!isVertical && isObservation && (
                      isLevelReadOnly(activeObsGroup) ? (
                        <div
                          className="cc-observation-readonly flex items-center justify-center font-bold text-xs text-slate-800 bg-slate-50/70 py-1 select-none w-full h-full"
                          title={`${activeObsGroup.name} Observation (View Only)`}
                        >
                          <span>{value && String(value).trim() ? normalizeObservationSymbol(value) : '-'}</span>
                        </div>
                      ) : (
                        <select
                          aria-label={`${sheet.name} ${activeObsGroup.name} Observation row ${rowIndex + 1}`}
                          disabled={disabled}
                          value={normalizeObservationSymbol(value)}
                          onChange={event => handleObservationChange(rowIndex, activeObsGroup.obsCol, activeObsGroup.scoreCol, event.target.value)}
                          className="cc-observation-select"
                        >
                          <option value=""></option>
                          {OBSERVATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      )
                    )}
                    {!isVertical && !isObservation && !isLevelHeader && !isSubHeader && !isBaseHeader && (
                      (activeScoreGroup && isLevelReadOnly(activeScoreGroup) && rowIndex >= 4 && rowIndex <= 34) ? (
                        <div className="flex items-center justify-center font-bold text-xs text-slate-800 bg-slate-50/70 py-1 select-none w-full h-full">
                          <span>{cellDisplay && String(cellDisplay).trim() && cellDisplay !== '0' ? cellDisplay : (cellDisplay === '0' ? '0' : '-')}</span>
                        </div>
                      ) : (
                        <textarea
                          aria-label={`${sheet.name} ${columnName(columnIndex)}${rowIndex + 1}`}
                          disabled={disabled}
                          value={cellDisplay}
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
                      )
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
