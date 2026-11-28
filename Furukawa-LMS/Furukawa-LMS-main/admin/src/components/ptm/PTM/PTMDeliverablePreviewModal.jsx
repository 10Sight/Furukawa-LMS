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

export default function PTMDeliverablePreviewModal({ isOpen, file, onClose }) {
  const [excelSheets, setExcelSheets] = useState([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
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
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          return { name: sheetName, rows };
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

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfBlobUrl || file.url;
    link.download = file.name || 'deliverable';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentSheet = excelSheets[activeSheetIdx] || { name: '', rows: [] };

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
              {fileType === 'excel' ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              ) : fileType === 'pdf' ? (
                <FileText className="w-4 h-4 text-rose-600" />
              ) : (
                <ImageIcon className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate">{file.name || 'Deliverable Preview'}</h3>
              <p className="text-[11px] text-slate-500 uppercase font-semibold">{fileType} preview</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-[380px] overflow-auto bg-slate-100/70 p-4">
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

          {fileType === 'excel' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col max-h-[72vh]">
              {excelSheets.length > 1 && (
                <div className="flex items-center gap-1 px-3 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto">
                  {excelSheets.map((s, idx) => (
                    <button
                      key={s.name || idx}
                      type="button"
                      onClick={() => setActiveSheetIdx(idx)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        idx === activeSheetIdx
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s.name || `Sheet ${idx + 1}`}
                    </button>
                  ))}
                </div>
              )}

              {excelError ? (
                <div className="p-8 text-center text-sm text-rose-600 font-medium">{excelError}</div>
              ) : currentSheet.rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">This worksheet is empty.</div>
              ) : (
                <div className="overflow-auto flex-1">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {currentSheet.rows.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx === 0 ? 'bg-slate-100 font-bold text-slate-800' : 'hover:bg-slate-50'}>
                          <td className="border border-slate-200 px-2 py-1.5 text-center text-[11px] font-mono text-slate-400 bg-slate-50 w-10">
                            {rIdx + 1}
                          </td>
                          {(Array.isArray(row) ? row : []).map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="border border-slate-200 px-2.5 py-1.5 text-slate-700 whitespace-pre-wrap min-w-[90px]"
                            >
                              {cell !== null && cell !== undefined ? String(cell) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
