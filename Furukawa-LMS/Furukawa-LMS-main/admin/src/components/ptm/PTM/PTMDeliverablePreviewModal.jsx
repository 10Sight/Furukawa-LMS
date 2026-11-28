import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  X,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';

function dataUrlToUint8Array(dataUrl) {
  const str = String(dataUrl || '');
  const commaIdx = str.indexOf(',');
  const base64 = commaIdx >= 0 ? str.slice(commaIdx + 1) : str;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getColLetter(index) {
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

export default function PTMDeliverablePreviewModal({
  isOpen,
  file,
  onClose,
  onSaveFile,
  readOnly = false,
}) {
  const [excelSheets, setExcelSheets] = useState([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [activeCell, setActiveCell] = useState(null); // { r, c }
  const [excelError, setExcelError] = useState('');
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');
  const [zoom, setZoom] = useState(1);

  const fileType = useMemo(() => {
    if (!file) return '';
    if (file.type) return file.type;
    const name = String(file.name || '').toLowerCase();
    if (/\.pdf$/i.test(name)) return 'pdf';
    if (/\.(xlsx?|csv)$/i.test(name)) return 'excel';
    return 'image';
  }, [file]);

  useEffect(() => {
    setZoom(1);
    setExcelSheets([]);
    setActiveSheetIdx(0);
    setActiveCell(null);
    setExcelError('');
    setPdfBlobUrl('');

    if (!isOpen || !file?.url) return undefined;

    if (fileType === 'excel') {
      try {
        let workbook;
        if (String(file.url).startsWith('data:')) {
          const bytes = dataUrlToUint8Array(file.url);
          workbook = XLSX.read(bytes, { type: 'array' });
        } else {
          workbook = XLSX.read(file.url, { type: 'string' });
        }
        const parsed = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          const maxCols = Math.max(8, ...rawRows.map((r) => (Array.isArray(r) ? r.length : 0)));
          const normalizedRows = rawRows.length > 0
            ? rawRows.map((r) => {
                const arr = Array.isArray(r) ? r.map((v) => (v === null || v === undefined ? '' : String(v))) : [];
                while (arr.length < maxCols) arr.push('');
                return arr;
              })
            : Array.from({ length: 10 }, () => Array(maxCols).fill(''));
          return { name: sheetName, rows: normalizedRows };
        });
        setExcelSheets(parsed);
      } catch (err) {
        console.warn('Could not parse Excel preview:', err);
        setExcelError('Unable to parse this spreadsheet for preview. You can still download it.');
      }
      return undefined;
    }

    if (fileType === 'pdf' && String(file.url).startsWith('data:')) {
      try {
        const bytes = dataUrlToUint8Array(file.url);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.warn('Could not create PDF blob URL:', err);
      }
    }

    return undefined;
  }, [isOpen, file, fileType]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const currentSheet = excelSheets[activeSheetIdx] || { name: 'Sheet1', rows: [] };
  const colCount = Math.max(1, ...(currentSheet.rows || []).map((r) => r.length));

  const updateCurrentSheetRows = (updater) => {
    setExcelSheets((prev) =>
      prev.map((sheet, idx) =>
        idx === activeSheetIdx ? { ...sheet, rows: updater(sheet.rows) } : sheet
      )
    );
  };

  const handleCellChange = (rIdx, cIdx, val) => {
    if (readOnly) return;
    updateCurrentSheetRows((rows) => {
      const next = rows.map((r) => [...r]);
      next[rIdx][cIdx] = val;
      return next;
    });
  };

  const handleAddRow = () => {
    if (readOnly) return;
    updateCurrentSheetRows((rows) => [...rows, Array(colCount).fill('')]);
  };

  const handleAddCol = () => {
    if (readOnly) return;
    updateCurrentSheetRows((rows) => rows.map((r) => [...r, '']));
  };

  const handleDeleteRow = () => {
    if (readOnly || !activeCell) return;
    updateCurrentSheetRows((rows) => {
      if (rows.length <= 1) return rows;
      return rows.filter((_, idx) => idx !== activeCell.r);
    });
    setActiveCell(null);
  };

  const buildWorkbookDataUrl = () => {
    const wb = XLSX.utils.book_new();
    excelSheets.forEach((s, idx) => {
      const ws = XLSX.utils.aoa_to_sheet(s.rows || []);
      XLSX.utils.book_append_sheet(wb, ws, s.name || `Sheet${idx + 1}`);
    });
    const isCsv = /\.csv$/i.test(file.name || '');
    if (isCsv) {
      const firstWs = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(firstWs);
      return {
        url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
        name: file.name,
      };
    }
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return {
      url: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
      name: file.name || 'deliverable.xlsx',
    };
  };

  const handleSaveExcel = () => {
    if (readOnly || !onSaveFile) return;
    const { url, name } = buildWorkbookDataUrl();
    onSaveFile({
      ...file,
      name,
      url,
      type: 'excel',
      lastModified: Date.now(),
    });
    onClose?.();
  };

  const handleDownload = () => {
    let href = pdfBlobUrl || file.url;
    let downloadName = file.name || 'deliverable';
    if (fileType === 'excel' && excelSheets.length > 0 && !excelError) {
      const built = buildWorkbookDataUrl();
      href = built.url;
      downloadName = built.name;
    }
    const link = document.createElement('a');
    link.href = href;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isExcel = fileType === 'excel';
  const activeCellRef = activeCell ? `${getColLetter(activeCell.c)}${activeCell.r + 1}` : '—';
  const activeCellValue =
    activeCell && currentSheet.rows?.[activeCell.r]
      ? currentSheet.rows[activeCell.r][activeCell.c] ?? ''
      : '';

  const modalContent = (
    <div
      className={`fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center ${
        isExcel ? 'p-0' : 'p-4'
      } animate-in fade-in duration-150`}
      onClick={onClose}
    >
      <div
        className={`bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 ${
          isExcel ? 'w-screen h-screen rounded-none' : 'rounded-2xl w-full max-w-5xl max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${
            isExcel ? 'bg-[#217346] text-white border-[#1a5c38]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isExcel ? 'bg-white/15 text-white' : 'bg-white border border-slate-200'
              }`}
            >
              {isExcel ? (
                <FileSpreadsheet className="w-4 h-4 text-white" />
              ) : fileType === 'pdf' ? (
                <FileText className="w-4 h-4 text-rose-600" />
              ) : (
                <ImageIcon className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm font-bold truncate ${isExcel ? 'text-white' : 'text-slate-800'}`}>
                {file.name || 'Deliverable Preview'}
              </h3>
              <p className={`text-[11px] uppercase font-semibold ${isExcel ? 'text-emerald-100' : 'text-slate-500'}`}>
                {isExcel ? (readOnly ? 'Excel Viewer' : 'Excel Editor (Full Screen)') : `${fileType} preview`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isExcel && !excelError && !readOnly && (
              <>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCol}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Col</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRow}
                  disabled={!activeCell || currentSheet.rows.length <= 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-rose-600/80 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Row</span>
                </button>
                {onSaveFile && (
                  <button
                    type="button"
                    onClick={handleSaveExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#217346] hover:bg-emerald-50 text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                )}
              </>
            )}
            {fileType === 'image' && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-semibold text-slate-700 px-1 min-w-[44px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs ${
                isExcel ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg cursor-pointer ${
                isExcel ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/70'
              }`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Excel Formula Bar */}
        {isExcel && !excelError && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F3F4F6] border-b border-slate-300 text-xs">
            <div className="w-16 px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 text-center shrink-0">
              {activeCellRef}
            </div>
            <span className="font-serif italic text-slate-500 font-bold select-none px-1">fx</span>
            <input
              type="text"
              readOnly={readOnly || !activeCell}
              value={activeCellValue}
              onChange={(e) => activeCell && handleCellChange(activeCell.r, activeCell.c, e.target.value)}
              placeholder={activeCell ? 'Edit cell value...' : 'Click any cell to view or edit'}
              className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none focus:border-[#217346]"
            />
          </div>
        )}

        {/* Body */}
        <div className={`flex-1 overflow-auto ${isExcel ? 'bg-white p-0 flex flex-col' : 'min-h-[380px] bg-slate-100/70 p-4'}`}>
          {fileType === 'image' && (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={file.url}
                alt={file.name || 'Uploaded deliverable'}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-md bg-white transition-transform duration-150"
              />
            </div>
          )}

          {fileType === 'pdf' && (
            <iframe
              src={pdfBlobUrl || file.url}
              title={file.name || 'PDF Preview'}
              className="w-full h-[72vh] rounded-lg border border-slate-200 bg-white"
            />
          )}

          {isExcel && (
            <>
              {excelError ? (
                <div className="p-8 text-center text-sm text-rose-600 font-medium">{excelError}</div>
              ) : (
                <div className="flex-1 overflow-auto bg-white">
                  <table className="border-collapse text-xs select-none min-w-full">
                    <thead className="sticky top-0 z-10 bg-[#E9ECEF]">
                      <tr>
                        <th className="sticky left-0 z-20 w-10 min-w-[40px] border border-slate-300 bg-[#E9ECEF] py-1 text-center text-[11px] font-bold text-slate-500" />
                        {Array.from({ length: colCount }, (_, cIdx) => (
                          <th
                            key={cIdx}
                            className={`border border-slate-300 px-2 py-1 text-center text-[11px] font-bold min-w-[120px] ${
                              activeCell?.c === cIdx ? 'bg-[#D3E3FD] text-[#1A56DB]' : 'text-slate-600'
                            }`}
                          >
                            {getColLetter(cIdx)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentSheet.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td
                            className={`sticky left-0 z-10 border border-slate-300 px-2 py-1 text-center text-[11px] font-mono font-semibold w-10 ${
                              activeCell?.r === rIdx ? 'bg-[#D3E3FD] text-[#1A56DB]' : 'bg-[#F8F9FA] text-slate-500'
                            }`}
                          >
                            {rIdx + 1}
                          </td>
                          {Array.from({ length: colCount }, (_, cIdx) => {
                            const isSelected = activeCell?.r === rIdx && activeCell?.c === cIdx;
                            return (
                              <td
                                key={cIdx}
                                className={`border border-slate-300 p-0 min-w-[120px] ${
                                  isSelected ? 'ring-2 ring-inset ring-[#217346] bg-emerald-50/20' : 'bg-white'
                                } ${rIdx === 0 ? 'font-bold bg-slate-50/70' : ''}`}
                                onClick={() => setActiveCell({ r: rIdx, c: cIdx })}
                              >
                                <input
                                  type="text"
                                  readOnly={readOnly}
                                  value={row[cIdx] ?? ''}
                                  onFocus={() => setActiveCell({ r: rIdx, c: cIdx })}
                                  onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                  className="w-full h-full px-2 py-1.5 text-xs text-slate-800 bg-transparent outline-none"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Excel Sheet Tabs */}
              {excelSheets.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-[#F3F4F6] border-t border-slate-300 overflow-x-auto shrink-0">
                  {excelSheets.map((s, idx) => (
                    <button
                      key={s.name || idx}
                      type="button"
                      onClick={() => {
                        setActiveSheetIdx(idx);
                        setActiveCell(null);
                      }}
                      className={`px-3 py-1 rounded-t-md text-xs font-semibold cursor-pointer whitespace-nowrap border ${
                        idx === activeSheetIdx
                          ? 'bg-white text-[#217346] border-slate-300 border-b-white font-bold'
                          : 'bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200'
                      }`}
                    >
                      {s.name || `Sheet ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
