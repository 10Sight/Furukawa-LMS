import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Check, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Download, 
  RotateCcw,
  Sparkles
} from 'lucide-react';

export default function ExcelEditorModal({
  isOpen,
  fileName,
  fileData,
  onSave,
  onClose,
  title = "Edit Excel Sheet"
}) {
  if (!isOpen) return null;

  // Initial table data (parse from CSV if text or use sensible tabular defaults)
  const [gridData, setGridData] = useState(() => {
    // If it's a CSV or text dataUrl, try parsing
    if (fileData && typeof fileData === 'string' && fileData.startsWith('data:text/')) {
      try {
        const decoded = decodeURIComponent(escape(atob(fileData.split(',')[1])));
        const lines = decoded.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length > 0) {
          return lines.map((line) => line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()));
        }
      } catch {
        // fallback
      }
    }

    // Default template spreadsheet structure
    return [
      ['Item No', 'Parameter / Checkpoint', 'Standard / Specification', 'Actual Finding', 'Status', 'Remarks'],
      ['1', 'Dimension Check A', '15.00 ± 0.05 mm', '15.02 mm', 'OK', 'Within tolerance'],
      ['2', 'Visual Surface Inspection', 'No scratches / dents', 'Minor streak observed', 'Action Needed', 'Polishing required'],
      ['3', 'Torque Test B', '25.0 Nm min', '27.4 Nm', 'OK', 'Passed batch test'],
      ['4', 'Leakage Detection', '0.00 bar drop in 30s', '0.00 bar drop', 'OK', 'Hermetic seal validated'],
      ['5', 'Coating Thickness', '80 - 100 µm', '88 µm', 'OK', 'Uniform finish']
    ];
  });

  const [activeCell, setActiveCell] = useState(null);

  const handleCellChange = (rIdx, cIdx, val) => {
    setGridData((prev) => {
      const next = prev.map((row) => [...row]);
      next[rIdx][cIdx] = val;
      return next;
    });
  };

  const handleAddRow = () => {
    const colCount = gridData[0]?.length || 4;
    const newRow = Array.from({ length: colCount }, (_, i) => (i === 0 ? `${gridData.length}` : ''));
    setGridData([...gridData, newRow]);
  };

  const handleDeleteRow = (rIdx) => {
    if (gridData.length <= 2) return; // Keep at least header + 1 row
    setGridData(gridData.filter((_, idx) => idx !== rIdx));
  };

  const handleAddCol = () => {
    setGridData(gridData.map((row, idx) => [...row, idx === 0 ? `Col ${row.length + 1}` : '']));
  };

  // Generate downloadable/saveable CSV dataUrl
  const handleSaveSheet = () => {
    const csvContent = gridData
      .map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    onSave(dataUrl, fileName.replace(/\.[^/.]+$/, "") + '.csv');
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {title}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                  Excel / CSV Grid Editor
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                {fileName || 'Spreadsheet.xlsx'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add Row</span>
            </button>
            <button
              onClick={handleAddCol}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add Column</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Excel Spreadsheet Grid Table */}
        <div className="p-4 flex-1 overflow-auto bg-slate-100/60 max-h-[60vh]">
          <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E2E8F0] text-slate-800 font-bold border-b border-slate-300">
                  <th className="w-10 py-2 text-center border-r border-slate-300 bg-slate-300/60 text-slate-600 text-[10px]">#</th>
                  {gridData[0]?.map((headerCell, cIdx) => (
                    <th key={cIdx} className="p-0 border-r border-slate-300 min-w-[130px]">
                      <input
                        type="text"
                        value={headerCell}
                        onChange={(e) => handleCellChange(0, cIdx, e.target.value)}
                        className="w-full bg-transparent font-bold text-slate-800 px-2.5 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500"
                      />
                    </th>
                  ))}
                  <th className="w-10 py-2 text-center text-slate-500 text-[10px]">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {gridData.slice(1).map((row, rowIdx) => {
                  const actualRowIndex = rowIdx + 1;
                  return (
                    <tr key={actualRowIndex} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="py-2 text-center border-r border-slate-300 bg-slate-100 font-mono text-[10px] text-slate-500 select-none">
                        {actualRowIndex}
                      </td>
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="p-0 border-r border-slate-300">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => handleCellChange(actualRowIndex, colIdx, e.target.value)}
                            onFocus={() => setActiveCell({ r: actualRowIndex, c: colIdx })}
                            className="w-full bg-transparent px-2.5 py-2 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-colors"
                          />
                        </td>
                      ))}
                      <td className="text-center py-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(actualRowIndex)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Click any cell to edit content directly. Changes will update your PDCA sheet.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSheet}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
