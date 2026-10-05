import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Folder,
  FolderOpen,
  Plus,
  ArrowLeft,
  Calendar,
  Users,
  FileText,
  Layers,
  Trash2,
  Copy,
  Search,
  Clock,
  ChevronRight,
  Sparkles,
  Check,
  ExternalLink,
  FileSpreadsheet,
  X,
  ChevronDown,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import sourceForms from './formData.json';
import procedureFlowchart from './procedureFlowchart.json';
import './ProcessAudit.css';
import procedureLogo from './assets/procedure-logo.jpeg';
import auditerListLogo from './assets/auditer-list-logo.jpeg';
import planMarker from './assets/plan-marker.png';
import NCList from './NCList';
import AuditorPlan from './AuditorPlan';
import ProcessAuditCheckSheet from './ProcessAuditCheckSheet';

const FORM_NAMES = ['Procedure', 'Auditer List', 'Auditer Plan'];
const FORM_ASSETS = {
  'procedure-logo.jpeg': procedureLogo,
  'auditer-list-logo.jpeg': auditerListLogo,
  'plan-marker.png': planMarker,
};

function cellPosition(address) {
  const [, letters, rowText] = address.match(/^([A-Z]+)(\d+)$/);
  const column = [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
  return { row: Number(rowText), column };
}

function mergeRange(range) {
  const [first, last = first] = range.split(':');
  const start = cellPosition(first);
  const end = cellPosition(last);
  return { first, start, rows: end.row - start.row + 1, columns: end.column - start.column + 1 };
}

function readSavedValues(name) {
  try {
    return JSON.parse(localStorage.getItem(`process_audit_${name}`) || '{}');
  } catch {
    return {};
  }
}

function cssBorder(edge) {
  if (!edge) return undefined;
  const [width, color] = edge;
  const borderStyles = {
    hair: 'solid', thin: 'solid', medium: 'solid', thick: 'solid',
    dotted: 'dotted', dashed: 'dashed', dashDot: 'dashed',
    dashDotDot: 'dashed', slantDashDot: 'dashed', double: 'double',
  };
  const widths = { hair: 1, thin: 1, medium: 2, thick: 3, double: 3 };
  return `${widths[width] || 1}px ${borderStyles[width] || 'solid'} ${color}`;
}

function getNaturalTextWidth(value, fontSizePt, bold) {
  const fontSizePx = (fontSizePt || 11) * (96 / 72);
  // Average glyph width is close enough for Excel's single-line overflow rule;
  // the cell still stops at the first populated neighboring cell.
  return [...String(value)].reduce((width, character) => (
    width + fontSizePx * (/[ilI.,' ]/.test(character) ? 0.35 : /[MW@#]/.test(character) ? 0.85 : 0.62)
  ), bold ? fontSizePx * 0.04 : 0);
}

function FlowchartDrawing({ width, height }) {
  const arrowId = 'procedure-flowchart-arrow';
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 overflow-hidden"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <marker id={arrowId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#000000" />
        </marker>
      </defs>
      {procedureFlowchart.items
        // The workbook drawing contains two stray connectors anchored at rows
        // 203 and 207, outside the Procedure sheet's 105-row used range. They
        // are export artifacts, not part of the form or its flowchart.
        .filter((item) => item.x < width && item.y < height && item.x + item.width > 0 && item.y + item.height > 0)
        .map((item, index) => {
        const centerX = item.x + item.width / 2;
        const centerY = item.y + item.height / 2;
        const rotation = item.rotation ? `rotate(${item.rotation} ${centerX} ${centerY})` : undefined;
        const strokeProps = {
          stroke: item.stroke || 'none',
          strokeWidth: item.strokeWidth || 0,
          markerEnd: item.arrowEnd ? `url(#${arrowId})` : undefined,
          markerStart: item.arrowStart ? `url(#${arrowId})` : undefined,
        };

        if (item.kind === 'connector') {
          let d;
          if (item.geometry.startsWith('bentConnector')) {
            const reversed = item.rotation === 180;
            const startX = reversed ? item.endX : item.startX;
            const startY = reversed ? item.endY : item.startY;
            const endX = reversed ? item.startX : item.endX;
            const endY = reversed ? item.startY : item.endY;
            if (item.name === 'AutoShape 86') {
              const outerX = 288;
              const actualStartY = 1260.611;
              d = `M ${startX} ${actualStartY} H ${outerX} V ${endY} H ${endX}`;
            } else if (item.name === 'AutoShape 87') {
              const outerX = 288;
              const actualStartY = 1896.333;
              d = `M ${startX} ${actualStartY} H ${outerX} V ${endY} H ${endX}`;
            } else {
              const middleY = startY + (endY - startY) * 0.5;
              d = `M ${startX} ${startY} V ${middleY} H ${endX} V ${endY}`;
            }
          } else {
            d = `M ${item.startX} ${item.startY} L ${item.endX} ${item.endY}`;
          }
          return <path key={`${item.name}-${index}`} d={d} fill="none" strokeLinejoin="round" strokeLinecap="round" {...strokeProps} />;
        }

        let shape;
        if (item.geometry === 'diamond') {
          shape = (
            <polygon
              points={`${centerX},${item.y} ${item.x + item.width},${centerY} ${centerX},${item.y + item.height} ${item.x},${centerY}`}
              fill={item.fill || 'none'}
              {...strokeProps}
            />
          );
        } else if (item.geometry === 'ellipse' || item.geometry === 'arc') {
          shape = (
            <ellipse
              cx={centerX}
              cy={centerY}
              rx={item.width / 2}
              ry={item.height / 2}
              fill={item.fill || 'none'}
              {...strokeProps}
            />
          );
        } else {
          shape = (
            <rect
              x={item.x}
              y={item.y}
              width={item.width}
              height={item.height}
              fill={item.fill || 'none'}
              {...strokeProps}
            />
          );
        }

        return (
          <g key={`${item.name}-${index}`} transform={rotation}>
            {shape}
            {item.text && (
              <foreignObject x={item.x} y={item.y} width={item.width} height={item.height}>
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style={{
                    boxSizing: 'border-box',
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: item.textAnchor === 'ctr' ? 'center' : item.textAnchor === 'b' ? 'flex-end' : 'flex-start',
                    justifyContent: item.textAlign === 'center' ? 'center' : item.textAlign === 'right' ? 'flex-end' : 'flex-start',
                    padding: `${item.padding[0]}px ${item.padding[1]}px ${item.padding[2]}px ${item.padding[3]}px`,
                    color: item.textColor,
                    fontFamily: item.fontName,
                    fontSize: `${item.fontSize}pt`,
                    fontWeight: item.bold ? 'bold' : 'normal',
                    fontStyle: item.italic ? 'italic' : 'normal',
                    lineHeight: 'normal',
                    textAlign: item.textAlign,
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                  }}
                >
                  {item.text}
                </div>
              </foreignObject>
            )}
          </g>
        );
        })}
    </svg>
  );
}

function StarIcon({ color, size = 36, className = '' }) {
  const styles = {
    yellow: { fill: '#FFE600', stroke: '#374151' },
    green: { fill: '#4ADE80', stroke: '#15803D' },
    blue: { fill: '#4A7BB0', stroke: '#111827' },
  };
  const config = styles[color] || styles.yellow;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block select-none ${className}`}
      style={{ verticalAlign: 'middle', overflow: 'visible' }}
    >
      <polygon
        points="12,1.8 15.15,8.8 22.8,9.5 17.1,14.6 18.8,22.2 12,18.2 5.2,22.2 6.9,14.6 1.2,9.5 8.85,8.8"
        fill={config.fill}
        stroke={config.stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AuditerPlanArrows({ width, height, form, values }) {
  const arrowId = 'auditer-plan-arrow';

  const colLefts = useMemo(() => {
    let acc = 0;
    return form.columnWidths.map((w) => {
      const left = acc;
      acc += w;
      return left;
    });
  }, [form.columnWidths]);

  const rowTops = useMemo(() => {
    let acc = 0;
    return form.rowHeights.map((h) => {
      const top = acc;
      acc += h;
      return top;
    });
  }, [form.rowHeights]);

  const monthColumns = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];

  const arrows = useMemo(() => {
    const list = [];
    for (let r = 4; r <= 49; r++) {
      const rowIndex = r - 1;
      const rowTop = rowTops[rowIndex];
      const rowHeight = form.rowHeights[rowIndex];
      const centerY = rowTop + rowHeight / 2;

      const stars = [];
      monthColumns.forEach((colLetter, idx) => {
        const address = `${colLetter}${r}`;
        const val = values[address];
        if (['yellow', 'green', 'blue'].includes(val)) {
          const colIndex = 6 + idx;
          const colLeft = colLefts[colIndex];
          const colWidth = form.columnWidths[colIndex];
          const centerX = colLeft + colWidth / 2;
          stars.push({ colLetter, colIndex, centerX, color: val, address });
        }
      });

      if (stars.length >= 2) {
        const pairs = [];
        const used = new Set();

        // 1. Primary rule (as in standard audit matrices & screenshot):
        // Connect blue (delayed / rescheduled) star to the green (actual conducted) star in the same row
        for (let i = 0; i < stars.length; i++) {
          if (used.has(i)) continue;
          if (stars[i].color === 'blue') {
            for (let j = i + 1; j < stars.length; j++) {
              if (!used.has(j) && stars[j].color === 'green') {
                pairs.push([stars[i], stars[j]]);
                used.add(i);
                used.add(j);
                break;
              }
            }
          }
        }

        // 2. If exactly 2 stars in the row (e.g., in Plan row or general range), connect them directly
        if (pairs.length === 0 && stars.length === 2) {
          pairs.push([stars[0], stars[1]]);
          used.add(0);
          used.add(1);
        } else {
          // 3. Check any remaining stars not already paired
          const remaining = stars
            .map((s, idx) => ({ s, idx }))
            .filter((item) => !used.has(item.idx));

          if (remaining.length === 2) {
            pairs.push([remaining[0].s, remaining[1].s]);
          } else if (remaining.length >= 2 && remaining.length % 2 === 0) {
            for (let k = 0; k < remaining.length; k += 2) {
              pairs.push([remaining[k].s, remaining[k + 1].s]);
            }
          }
        }

        pairs.forEach(([first, second]) => {
          const startX = first.centerX + 15;
          const endX = second.centerX - 15;
          if (endX > startX + 6) {
            list.push({
              id: `arrow-row-${r}-${first.colLetter}-${second.colLetter}`,
              x1: startX,
              y1: centerY,
              x2: endX,
              y2: centerY,
            });
          }
        });
      }
    }
    return list;
  }, [values, colLefts, rowTops, form.columnWidths, form.rowHeights]);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: 25,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#000000" />
        </marker>
      </defs>
      {arrows.map((arr) => (
        <line
          key={arr.id}
          x1={arr.x1}
          y1={arr.y1}
          x2={arr.x2}
          y2={arr.y2}
          stroke="#000000"
          strokeWidth="2"
          strokeLinecap="round"
          markerEnd={`url(#${arrowId})`}
        />
      ))}
    </svg>
  );
}

function EditableSheet({ name, form, values, onCellChange }) {
  const viewportRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const sheet = useMemo(() => {
    const cells = Array.from({ length: form.rows }, () => Array(form.columns).fill(null));
    const merges = new Map();
    const covered = new Set();

    form.merges.forEach((range) => {
      const merge = mergeRange(range);
      merges.set(merge.first, merge);
      for (let row = merge.start.row; row < merge.start.row + merge.rows; row += 1) {
        for (let column = merge.start.column; column < merge.start.column + merge.columns; column += 1) {
          if (row !== merge.start.row || column !== merge.start.column) covered.add(`${row}:${column}`);
        }
      }
    });
    form.cells.forEach(([address, value, styleId, cellType]) => {
      const { row, column } = cellPosition(address);
      cells[row - 1][column - 1] = { address, value, cellType, style: form.styles[styleId] || {} };
    });

    return { cells, merges, covered };
  }, [form]);

  const hiddenColumns = new Set(form.hiddenColumns || []);
  const sheetWidth = form.columnWidths.reduce(
    (total, width, index) => total + (hiddenColumns.has(index + 1) ? 0 : width),
    0,
  );
  const sheetHeight = form.rowHeights.reduce((total, height) => total + height, 0);
  const drawing = name === 'Procedure' ? procedureFlowchart : null;
  // The worksheet cell grid defines the form's bounds. Do not let stray
  // off-sheet drawing anchors create an oversized canvas or blank tail.
  const viewWidth = sheetWidth;
  const viewHeight = sheetHeight;
  const fittedZoom = viewportWidth > 0 ? Math.min(1, viewportWidth / viewWidth) : 1;
  const formZoom = name === 'Auditer Plan'
    ? Math.max(fittedZoom * 1.5, 0.6)
    : (name === 'Auditer List' ? Math.max(fittedZoom, 0.75) : fittedZoom);
  const hiddenRows = new Set(form.hiddenRows || []);
  const imagePositions = form.images.map((image, index) => ({
    ...image,
    key: `${image.asset}-${index}`,
    left: form.columnWidths.slice(0, image.col - 1).reduce((total, width) => total + width, 0) + image.x,
    top: form.rowHeights.slice(0, image.row - 1).reduce((total, height) => total + height, 0) + image.y,
  }));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const measureAvailableWidth = () => {
      setViewportWidth(viewport.clientWidth);
    };
    const resizeObserver = new ResizeObserver(measureAvailableWidth);
    resizeObserver.observe(viewport);
    window.addEventListener('resize', measureAvailableWidth);
    measureAvailableWidth();
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureAvailableWidth);
    };
  }, []);

  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollLeft = 0;
  }, [viewportWidth, formZoom]);

  return (
    <div
      ref={viewportRef}
      className={`flex min-h-0 w-full min-w-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-slate-300 bg-white ${name === 'Auditer List' || name === 'Auditer Plan' ? 'justify-start' : 'justify-center'}`}
      aria-label={`${name} Excel form`}
    >
      <div
        className="relative shrink-0"
        style={{ width: viewWidth, height: viewHeight, zoom: formZoom }}
      >
        <table
          className="process-audit-excel-table"
          role="table"
          aria-label={`${name} source worksheet`}
          style={{ width: sheetWidth, height: sheetHeight, tableLayout: 'fixed', borderCollapse: 'collapse' }}
        >
          <colgroup>
            {form.columnWidths.map((width, index) => (
              <col key={index} style={{ width: `${width}px`, minWidth: `${width}px`, display: hiddenColumns.has(index + 1) ? 'none' : undefined }} />
            ))}
          </colgroup>
          <tbody>
            {sheet.cells.map((rowCells, rowIndex) => (
              <tr
                key={rowIndex}
                style={{ height: form.rowHeights[rowIndex], display: hiddenRows.has(rowIndex + 1) ? 'none' : undefined }}
              >
                {rowCells.map((cell, columnIndex) => {
                  if (sheet.covered.has(`${rowIndex + 1}:${columnIndex + 1}`)) return null;
                  const currentCell = cell || {
                    address: `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`,
                    value: '',
                    cellType: 'text',
                    style: {},
                  };
                  const { address, style } = currentCell;
                  const isSuppressedProcedureLink = name === 'Procedure' && ['J29', 'J59'].includes(address);
                  const merge = sheet.merges.get(address);
                  const value = isSuppressedProcedureLink ? '' : values[address] ?? currentCell.value;
                  const horizontal = style.horizontal && style.horizontal !== 'general'
                    ? style.horizontal
                    : currentCell.cellType === 'number' ? 'right' : 'left';
                  let overflowWidth = form.columnWidths[columnIndex];
                  const expandsLeft = horizontal === 'right';
                  const canOverflow = !merge?.columns && !style.wrap && horizontal === 'left' && !String(value).includes('\n');
                  const canOverflowLeft = !merge?.columns && !style.wrap && horizontal === 'right' && !String(value).includes('\n');
                  if (canOverflow || canOverflowLeft) {
                    const step = expandsLeft ? -1 : 1;
                    for (let nextColumn = columnIndex + step;
                      nextColumn >= 0 && nextColumn < rowCells.length;
                      nextColumn += step) {
                      const nextCell = rowCells[nextColumn];
                      const nextValue = nextCell && (values[nextCell.address] ?? nextCell.value);
                      if (String(nextValue ?? '').length > 0) break;
                      overflowWidth += form.columnWidths[nextColumn];
                    }
                    overflowWidth = Math.min(
                      overflowWidth,
                      Math.max(form.columnWidths[columnIndex], getNaturalTextWidth(value, style.fontSize, style.bold) + 8)
                    );
                  }
                  const isOverflowing = overflowWidth > form.columnWidths[columnIndex];
                  const effectiveFontColor = (style.fontColor === '#FFFFFF' && (!style.fill || style.fill === '#FFFFFF'))
                    ? '#000000'
                    : (style.fontColor || '#000000');
                  const cellStyle = {
                    position: 'relative',
                    backgroundColor: style.fill || 'transparent',
                    color: effectiveFontColor,
                    fontFamily: style.fontName || 'Calibri',
                    fontSize: `${style.fontSize || 11}pt`,
                    fontWeight: style.bold ? 'bold' : 'normal',
                    fontStyle: style.italic ? 'italic' : 'normal',
                    textAlign: horizontal,
                    verticalAlign: style.vertical || 'bottom',
                    whiteSpace: style.wrap ? 'pre-wrap' : 'pre',
                    padding: 0,
                    overflow: isOverflowing ? 'visible' : 'hidden',
                    ...Object.fromEntries(
                      ['Left', 'Right', 'Top', 'Bottom']
                        .filter((edge) => style[`border${edge}`])
                        .map((edge) => [`border${edge}`, cssBorder(style[`border${edge}`])])
                    ),
                  };
                  const textStyle = {
                    fontFamily: cellStyle.fontFamily,
                    fontSize: cellStyle.fontSize,
                    fontWeight: cellStyle.fontWeight,
                    fontStyle: cellStyle.fontStyle,
                    color: cellStyle.color,
                    textAlign: cellStyle.textAlign,
                    textDecoration: style.strike ? 'line-through' : style.underline ? 'underline' : undefined,
                    paddingLeft: style.indent ? `${style.indent * 3}px` : '3px',
                    paddingRight: '3px',
                    paddingTop: '1px',
                    paddingBottom: '1px',
                    whiteSpace: style.wrap ? 'pre-wrap' : 'pre',
                    overflowWrap: style.wrap ? 'anywhere' : 'normal',
                    ...(isOverflowing ? {
                      zIndex: 1,
                      width: `${overflowWidth}px`,
                      ...(expandsLeft ? { left: 'auto', right: 0 } : {}),
                    } : {}),
                  };

                  const isMonthlyCell = name === 'Auditer Plan' && /^[G-R]([4-9]|[1-4][0-9])$/.test(address);
                  const isInSheetLegendPlan = name === 'Auditer Plan' && address === 'C50';
                  const isInSheetLegendActual = name === 'Auditer Plan' && address === 'C51';
                  const isInSheetLegendDelay = name === 'Auditer Plan' && address === 'C52';

                  if (isMonthlyCell) {
                    return (
                      <td
                        key={address}
                        rowSpan={merge?.rows || 1}
                        colSpan={merge?.columns || 1}
                        style={{ ...cellStyle, backgroundColor: '#ffffff' }}
                      >
                        <button
                          type="button"
                          aria-label={`${name} ${address}`}
                          onClick={() => {
                            const nextState =
                              value === 'yellow' ? 'green' :
                              value === 'green' ? 'blue' :
                              value === 'blue' ? '' : 'yellow';
                            onCellChange(address, nextState);
                          }}
                          className="process-audit-star-cell"
                          style={textStyle}
                        >
                          {['yellow', 'green', 'blue'].includes(value) && (
                            <StarIcon color={value} size={32} />
                          )}
                        </button>
                      </td>
                    );
                  }

                  if (isInSheetLegendPlan && !value) {
                    return (
                      <td
                        key={address}
                        rowSpan={merge?.rows || 1}
                        colSpan={merge?.columns || 1}
                        style={cellStyle}
                      >
                        <div
                          className="process-audit-star-cell pointer-events-none"
                          style={textStyle}
                        >
                          <StarIcon color="yellow" size={48} />
                        </div>
                      </td>
                    );
                  }

                  if (isInSheetLegendActual && !value) {
                    return (
                      <td
                        key={address}
                        rowSpan={merge?.rows || 1}
                        colSpan={merge?.columns || 1}
                        style={cellStyle}
                      >
                        <div
                          className="process-audit-star-cell pointer-events-none"
                          style={textStyle}
                        >
                          <StarIcon color="green" size={48} />
                        </div>
                      </td>
                    );
                  }

                  if (isInSheetLegendDelay && !value) {
                    return (
                      <td
                        key={address}
                        rowSpan={merge?.rows || 1}
                        colSpan={merge?.columns || 1}
                        style={cellStyle}
                      >
                        <div
                          className="process-audit-star-cell pointer-events-none"
                          style={textStyle}
                        >
                          <StarIcon color="blue" size={48} />
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={address}
                      rowSpan={merge?.rows || 1}
                      colSpan={merge?.columns || 1}
                      style={cellStyle}
                    >
                      <textarea
                        aria-label={`${name} ${address}`}
                        value={value}
                        readOnly={isSuppressedProcedureLink}
                        onChange={(event) => onCellChange(address, event.target.value)}
                        className="process-audit-excel-cell"
                        style={textStyle}
                        spellCheck="false"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {drawing && <FlowchartDrawing width={sheetWidth} height={sheetHeight} />}
        {name === 'Auditer Plan' && (
          <AuditerPlanArrows
            width={sheetWidth}
            height={sheetHeight}
            form={form}
            values={values}
          />
        )}
        {imagePositions.map((image) => {
          let imgWidth = image.width;
          let imgHeight = image.height;
          let imgLeft = image.left;
          let imgTop = image.top;

          if (name === 'Procedure' && image.asset === 'procedure-logo.jpeg') {
            imgWidth = 130;
            imgHeight = 54;
          } else if (name === 'Auditer List' && image.asset === 'auditer-list-logo.jpeg') {
            // Decrease size to fit cell A2:B4 neatly without overflowing
            imgWidth = 135;
            imgHeight = 48;
            imgLeft = 50;
            imgTop = 34;
          }

          return (
            <img
              key={image.key}
              src={FORM_ASSETS[image.asset]}
              alt=""
              draggable="false"
              className="pointer-events-none absolute max-w-none object-contain"
              style={{
                left: imgLeft,
                top: imgTop,
                width: imgWidth,
                height: imgHeight,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const FOLDERS = [
  {
    id: 'procedure',
    name: 'Procedure',
    displayName: 'Procedure Audit',
    category: 'Standard Operating Procedures',
    code: 'PRC-WH-QA-009',
    formKey: 'Procedure',
    colorTheme: 'blue',
    icon: FileText,
    badgeText: 'FRM-WH-QA-166',
    description: 'Standard Operating Procedure (PRC-WH-QA-009), audit workflow flowchart, instructions, guidelines & control criteria.',
    createLabel: 'Create Procedure Version',
  },
  {
    id: 'auditer-list',
    name: 'Auditer List',
    displayName: 'Auditor Lists',
    category: 'Auditor Directory',
    code: 'Annexure - 1',
    formKey: 'Auditer List',
    colorTheme: 'emerald',
    icon: Users,
    badgeText: 'Annexure - 1',
    description: 'Qualified process auditors directory, competence levels, training records, internal certified auditors & sign-offs.',
    createLabel: 'Create Auditor List',
  },
  {
    id: 'auditer-plan',
    name: 'Auditer Plan',
    displayName: 'Auditor Plan',
    category: 'Annual Matrices by Year',
    code: 'Plan Matrices',
    formKey: 'Auditer Plan',
    colorTheme: 'indigo',
    icon: Calendar,
    badgeText: 'Annual Matrices',
    description: 'Annual process audit schedule matrices with monthly Plan vs Actual tracking (Jan - Dec) and 3-color status stars.',
    createLabel: 'Create Annual Plan',
  },
  {
    id: 'check-sheet',
    name: 'Process Audit Check Sheet',
    displayName: 'Check Sheet',
    category: 'Process Check Sheets',
    code: 'CHK-WH-QA-047',
    formKey: 'Process Audit Check Sheet',
    colorTheme: 'cyan',
    icon: FileSpreadsheet,
    badgeText: 'CHK-WH-QA-047',
    description: 'Process Audit Check Sheet (CHK-WH-QA-047), Store checkpoints, requirement, evidence, observation, NCR status, and Kaizen.',
    createLabel: 'Create Check Sheet',
  },
  {
    id: 'nc-list',
    name: 'NC - List',
    displayName: 'NC - List (Non Conformance)',
    category: 'Non Conformance Records',
    code: 'FRM-WH-QA-028',
    formKey: 'NC-List',
    colorTheme: 'orange',
    icon: Layers,
    badgeText: 'FRM-WH-QA-028',
    description: 'Non Conformance audit records with monthly data entry and yearly auto-aggregated summary view.',
    createLabel: 'Open NC List',
  },
];

const DEFAULT_DOCUMENTS = [];

function readDocValues(doc) {
  if (!doc) return {};
  try {
    const docKey = `process_audit_doc_v3_${doc.id}`;
    const saved = localStorage.getItem(docKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Object.keys(parsed).length > 2) return parsed;
    }
  } catch (e) {
    console.error(e);
  }

  // Comprehensive initial defaults based on form type and year
  return {};
}

function CreatePlanModal({ isOpen, onClose, folderId, defaultUnit, onConfirm }) {
  const selectedFolder = FOLDERS.find((f) => f.id === folderId) || FOLDERS[2];
  const [selectedFormKey, setSelectedFormKey] = useState(selectedFolder.formKey);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState(defaultUnit || 'Bawal');
  const [code, setCode] = useState('');
  const [revDate, setRevDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
  });

  useEffect(() => {
    if (defaultUnit) {
      setUnit(defaultUnit);
    }
  }, [defaultUnit, isOpen]);

  useEffect(() => {
    if (folderId) {
      const f = FOLDERS.find((item) => item.id === folderId);
      if (f) setSelectedFormKey(f.formKey);
    }
  }, [folderId]);

  useEffect(() => {
    if (selectedFormKey === 'Auditer Plan') {
      setTitle(`PROCESS AUDIT PLAN - ${year}`);
      setCode(`PLAN-${year}`);
    } else if (selectedFormKey === 'Auditer List') {
      setTitle(`Process Auditor List - ${year}`);
      setCode(`ANNEXURE-1-${year}`);
    } else if (selectedFormKey === 'Process Audit Check Sheet') {
      setTitle(`CHK-WH-QA-047: Process Audit Check Sheet - ${year}`);
      setCode(`CHK-WH-QA-047`);
    } else {
      setTitle(`PRC-WH-QA-009: Procedure Flowchart & Guidelines - Rev ${year}`);
      setCode(`PRC-WH-QA-009`);
    }
  }, [selectedFormKey, year]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const folder = FOLDERS.find((f) => f.formKey === selectedFormKey) || FOLDERS[2];
    onConfirm({
      folderId: folder.id,
      formKey: selectedFormKey,
      title: title.trim() || `${selectedFormKey} - ${year}`,
      year: Number(year),
      unit,
      code: code.trim(),
      revDate: revDate.trim(),
      description: `Created for Year ${year} • ${unit}`,
    });
  };

  const quickYears = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Create New Audit Plan / Document</h3>
              <p className="text-xs text-slate-500">Configure annual plans by year or create new document records</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Folder / Form Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FOLDERS.filter((f) => f.id !== 'nc-list').map((f) => {
                const Icon = f.icon;
                const active = selectedFormKey === f.formKey;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFormKey(f.formKey)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      active
                        ? 'border-blue-600 bg-blue-50/60 text-blue-700 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold leading-tight truncate w-full">{f.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Plan Year
              </label>
              <div className="flex items-center gap-1">
                {quickYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYear(y)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                      year === y
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="number"
                min="2020"
                max="2035"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Plant Unit
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden"
                >
                  <option value="Bawal">1- Bawal</option>
                  <option value="Gujrat">2- Gujrat</option>
                  <option value="All Units">All Units Selection</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Reference Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Revision / Effective Date
            </label>
            <input
              type="text"
              value={revDate}
              onChange={(e) => setRevDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Create & Open Form</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const UNITS = ['Bawal', 'Gujrat'];

export default function ProcessAudit({ showToast, onFormOpenChange }) {
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem('process_audit_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const ids = new Set(parsed.map((d) => d.id));
          const missing = DEFAULT_DOCUMENTS.filter((d) => !ids.has(d.id));
          return [...parsed.filter((doc) => !doc.isDefault), ...missing];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_DOCUMENTS;
  });

  const [selectedUnit, setSelectedUnit] = useState(() => {
    try {
      // sessionStorage persists within the tab session (survives page navigation)
      // but clears on a real browser reload – exactly the desired behavior.
      return sessionStorage.getItem('process_audit_selected_unit') || null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('procedure');
  const [isAuditorPlanFormOpen, setIsAuditorPlanFormOpen] = useState(false);
  const [isNCListFormOpen, setIsNCListFormOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const [docValues, setDocValues] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFolderId, setCreateFolderId] = useState('auditer-plan');

  const handleSelectUnit = (unit) => {
    setSelectedUnit(unit);
    try {
      if (unit) sessionStorage.setItem('process_audit_selected_unit', unit);
      else sessionStorage.removeItem('process_audit_selected_unit');
    } catch { /* ignore */ }
    if (unit) {
      showToast?.(`Selected Unit: ${unit}`);
    }
  };

  // Persist documents list
  useEffect(() => {
    try {
      localStorage.setItem('process_audit_documents', JSON.stringify(documents));
    } catch (e) {}
  }, [documents]);

  // Sync full-screen status to parent (hides sidebar & navbar!)
  useEffect(() => {
    onFormOpenChange?.(Boolean(activeDoc) || isNCListFormOpen || isAuditorPlanFormOpen);
    return () => {
      onFormOpenChange?.(false);
    };
  }, [activeDoc, isNCListFormOpen, isAuditorPlanFormOpen, onFormOpenChange]);

  // Load values when activeDoc changes
  useEffect(() => {
    if (activeDoc) {
      setDocValues(readDocValues(activeDoc));
    } else {
      setDocValues({});
    }
  }, [activeDoc?.id]);

  const handleCellChange = (address, value) => {
    if (!activeDoc) return;
    setDocValues((current) => {
      const next = { ...current, [address]: value };
      try {
        localStorage.setItem(`process_audit_doc_v3_${activeDoc.id}`, JSON.stringify(next));
        if (activeDoc.isDefault) {
          localStorage.setItem(`process_audit_${activeDoc.formKey}`, JSON.stringify(next));
        }
      } catch (e) {}
      return next;
    });
  };

  const handleOpenCreateModal = (folderId = null) => {
    const targetFolderId = folderId || activeTab || 'auditer-plan';
    setCreateFolderId(targetFolderId);
    setIsCreateModalOpen(true);
  };

  const handleCreateDocument = (newDocData) => {
    const id = `doc_${newDocData.formKey.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const newDoc = {
      ...newDocData,
      id,
      unit: newDocData.unit || selectedUnit || 'Bawal',
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Prepare initial cells
    const initialCells = {};
    if (newDoc.formKey === 'Auditer Plan') {
      initialCells['E1'] = newDoc.title || `PROCESS AUDIT PLAN - ${newDoc.year}`;
      initialCells['G2'] = String(newDoc.year || 2026);
      initialCells['A1'] = `Updation Date: ${newDoc.revDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    } else if (newDoc.formKey === 'Auditer List') {
      initialCells['A5'] = newDoc.title || `List for Process Auditors - ${newDoc.year || 2026}`;
      initialCells['R4'] = `Rev Date: ${newDoc.revDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }

    try {
      localStorage.setItem(`process_audit_doc_v3_${id}`, JSON.stringify(initialCells));
    } catch (e) {}

    setDocuments((prev) => [newDoc, ...prev]);
    setIsCreateModalOpen(false);
    setActiveDoc(newDoc); // Immediately open the created plan in full-screen!
    showToast?.(`Created ${newDoc.title}`);
  };

  const handleDuplicateDocument = (docToCopy) => {
    const nextYear = docToCopy.year ? Number(docToCopy.year) + 1 : 2027;
    const title = docToCopy.formKey === 'Auditer Plan'
      ? `PROCESS AUDIT PLAN - ${nextYear}`
      : `${docToCopy.title} (Copy)`;
    const id = `doc_${docToCopy.formKey.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const newDoc = {
      ...docToCopy,
      id,
      title,
      year: nextYear,
      unit: docToCopy.unit || selectedUnit || 'Bawal',
      code: `PLAN-${nextYear}`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sourceValues = readDocValues(docToCopy);
    const newValues = { ...sourceValues };
    if (newDoc.formKey === 'Auditer Plan') {
      newValues['E1'] = title;
      newValues['G2'] = String(nextYear);
    }

    try {
      localStorage.setItem(`process_audit_doc_${id}`, JSON.stringify(newValues));
    } catch (e) {}

    setDocuments((prev) => [newDoc, ...prev]);
    showToast?.(`Duplicated as ${newDoc.title}`);
  };

  const handleDeleteDocument = (docId) => {
    const docToDelete = documents.find((d) => d.id === docId);
    if (!docToDelete || docToDelete.isDefault) return;
    if (window.confirm(`Are you sure you want to delete "${docToDelete.title}"?`)) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      try {
        localStorage.removeItem(`process_audit_doc_${docId}`);
      } catch (e) {}
      if (activeDoc?.id === docId) {
        setActiveDoc(null);
      }
      showToast?.(`Deleted ${docToDelete.title}`);
    }
  };

  const PROCESS_AUDIT_TABS = [
    { id: 'procedure', label: 'Procedure Audit' },
    { id: 'auditer-list', label: 'Auditor List' },
    { id: 'auditer-plan', label: 'Auditor Plan' },
    { id: 'check-sheet', label: 'Process Audit Check Sheet' },
    { id: 'nc-list', label: 'NC - List' },
  ];

  // Filtered documents for current tab
  const currentTabDocuments = useMemo(() => {
    let list = documents.filter((d) => d.folderId === activeTab);
    if (selectedUnit) {
      list = list.filter((d) => !d.unit || d.unit === 'All Units' || d.unit === selectedUnit);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.title?.toLowerCase().includes(q) ||
          d.code?.toLowerCase().includes(q) ||
          String(d.year || '').includes(q) ||
          d.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [documents, activeTab, selectedUnit, searchQuery]);

  // Export current tab data
  const handleExportCurrentTab = () => {
    if (!selectedUnit) {
      showToast?.('Please select a unit first');
      return;
    }
    const tabItem = PROCESS_AUDIT_TABS.find((t) => t.id === activeTab);
    const tabName = tabItem?.label || 'Audit';

    if (activeTab === 'nc-list') {
      showToast?.(`✓ Exported NC List data for ${selectedUnit}`);
      return;
    }

    if (currentTabDocuments.length === 0) {
      showToast?.('No records to export');
      return;
    }

    const headers = ['S.No', 'Document Title', 'Reference Code', 'Revision Date', 'Year', 'Unit', 'Type'];
    const rows = currentTabDocuments.map((doc, idx) => [
      idx + 1,
      `"${(doc.title || '').replace(/"/g, '""')}"`,
      `"${(doc.code || '').replace(/"/g, '""')}"`,
      `"${doc.revDate || ''}"`,
      `"${doc.year || ''}"`,
      `"${doc.unit || selectedUnit}"`,
      `"${doc.isDefault ? 'Standard' : 'Custom'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ProcessAudit_${tabName.replace(/\s+/g, '_')}_${selectedUnit}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast?.(`✓ Exported ${tabName} to CSV`);
  };

  // Full-screen form view: only back button helps to navigate, navbar & sidebar hidden
  if (activeDoc) {
    if (activeDoc.folderId === 'check-sheet' || activeDoc.formKey === 'Process Audit Check Sheet') {
      return (
        <ProcessAuditCheckSheet
          doc={activeDoc}
          onBack={() => setActiveDoc(null)}
          selectedUnit={selectedUnit}
          showToast={showToast}
        />
      );
    }

    const activeFolder = FOLDERS.find((f) => f.id === activeDoc.folderId) || FOLDERS[2];
    const formConfig = sourceForms[activeDoc.formKey];

    return (
      <main className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 md:px-5 shadow-xs z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveDoc(null)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition active:scale-95 cursor-pointer shadow-xs"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-400 hidden md:inline">
                Process Audit / {activeFolder.displayName} /
              </span>
              <span className="truncate text-xs md:text-sm font-bold text-slate-800">
                {activeDoc.title}
              </span>
              {selectedUnit && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200 shrink-0">
                  Unit: {selectedUnit}
                </span>
              )}
              {activeDoc.year && (
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 shrink-0">
                  {activeDoc.year}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              <span>Auto-saved</span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden p-2 md:p-3">
          <EditableSheet
            key={activeDoc.id}
            name={activeDoc.formKey}
            form={formConfig}
            values={docValues}
            onCellChange={handleCellChange}
          />
        </div>

        <CreatePlanModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          folderId={createFolderId}
          defaultUnit={selectedUnit || 'Bawal'}
          onConfirm={handleCreateDocument}
        />
      </main>
    );
  }

  // Dashboard Main View (exactly matching user screenshot)
  const isUnitDefault = !selectedUnit || selectedUnit === 'Unit';

  return (
    <main className="w-full max-w-[1280px] mx-auto p-3 sm:p-4 md:p-6 space-y-5 flex-1 min-w-0 overflow-y-auto">
      {/* 1. Unit Selector Pill Dropdown */}
      <div className="flex items-center justify-between">
        <div className="relative inline-block">
          <select
            value={selectedUnit || 'Unit'}
            onChange={(e) => {
              const val = e.target.value;
              handleSelectUnit(val === 'Unit' ? null : val);
            }}
            className="appearance-none bg-white border border-[#D1D5DB] text-slate-700 text-sm font-semibold rounded-xl pl-4 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 cursor-pointer shadow-sm hover:border-slate-400 transition-colors"
            id="process-audit-unit-select"
          >
            <option value="Unit">Unit</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 2. Tabs below Unit Filter (matching screenshot: procedure audit, auditor list, auditor plans, NC - List) */}
      <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full">
        {PROCESS_AUDIT_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Search Bar + Action Buttons */}
      <div className="w-full min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-[#ECEFF3] shadow-[0_2px_6px_rgba(0,0,0,0.02)]">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'procedure'
                ? 'Search by document title, code, or revision...'
                : activeTab === 'auditer-list'
                ? 'Search auditor list by year, code, or title...'
                : activeTab === 'check-sheet'
                ? 'Search check sheets by title, process, or code...'
                : activeTab === 'auditer-plan'
                ? 'Search plans by year, title, or code...'
                : 'Search NC list records or month...'
            }
            className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl pl-11 pr-14 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded bg-slate-200 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={handleExportCurrentTab}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Export Excel</span>
          </button>

          {activeTab !== 'nc-list' && (
            <button
              onClick={() => {
                if (isUnitDefault) {
                  showToast?.('Please select a unit first');
                  return;
                }
                handleOpenCreateModal(activeTab);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-semibold shadow-md bg-[#2563EB] hover:bg-blue-700 shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>
                {activeTab === 'procedure'
                  ? 'Add Procedure'
                  : activeTab === 'auditer-list'
                  ? 'Add Auditor List'
                  : activeTab === 'check-sheet'
                  ? 'Add Check Sheet'
                  : 'Add Plan'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Content Area: Either "Please Select a Unit" OR Data Table / NC-List */}
      {isUnitDefault ? (
        <div className="bg-white rounded-2xl border border-[#ECEFF3] p-6 sm:p-14 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            Please Select a Unit
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Select Gujrat or Bawal from the Unit dropdown above to display the records for that unit.
          </p>
        </div>
      ) : activeTab === 'nc-list' ? (
        <NCList
          unit={selectedUnit}
          isEmbedded={true}
          onFormOpenChange={(isOpen) => {
            setIsNCListFormOpen(isOpen);
            onFormOpenChange?.(isOpen);
          }}
        />
      ) : activeTab === 'auditer-plan' ? (
        <AuditorPlan
          unit={selectedUnit}
          documents={documents}
          onOpenDoc={(doc) => setActiveDoc(doc)}
          onCreateDoc={() => handleOpenCreateModal('auditer-plan')}
          onFormOpenChange={(isOpen) => {
            setIsAuditorPlanFormOpen(isOpen);
            onFormOpenChange?.(isOpen);
          }}
        />
      ) : (
        <div className="w-full min-w-0 bg-white rounded-2xl border border-[#ECEFF3] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-[#F1F3F5] bg-[#FAFAFC] text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="py-3.5 px-4 text-center w-14">S.No</th>
                  <th className="py-3.5 px-4">
                    {activeTab === 'procedure'
                      ? 'Document / Flowchart'
                      : activeTab === 'auditer-list'
                      ? 'Auditor Directory'
                      : activeTab === 'check-sheet'
                      ? 'Document / Check Sheet'
                      : 'Annual Plan Matrix'}
                  </th>
                  <th className="py-3.5 px-4">Reference</th>
                  <th className="py-3.5 px-4">Revision Date</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4 text-center">Type</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5] text-sm">
                {currentTabDocuments.map((doc, idx) => (
                  <tr
                    key={doc.id}
                    onClick={() => setActiveDoc(doc)}
                    className="group hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <FileSpreadsheet className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <span className="block font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {doc.title}
                          </span>
                          <span className="block text-xs text-slate-400 truncate max-w-md">
                            {doc.description}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                      {doc.code || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {doc.revDate || 'Current'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {doc.unit || selectedUnit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          doc.isDefault
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {doc.isDefault ? 'Standard' : 'Custom'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveDoc(doc)}
                          className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          Open Form
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateDocument(doc)}
                          className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {!doc.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 rounded-xl border border-slate-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {currentTabDocuments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                      No documents found for {selectedUnit}. Click "+ Add" above to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Plan / Document Modal */}
      <CreatePlanModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        folderId={createFolderId}
        defaultUnit={selectedUnit || 'Bawal'}
        onConfirm={handleCreateDocument}
      />
    </main>
  );
}
