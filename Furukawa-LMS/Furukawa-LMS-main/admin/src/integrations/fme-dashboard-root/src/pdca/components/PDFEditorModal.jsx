import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Check, 
  FileText, 
  PenLine, 
  Plus, 
  Trash2, 
  Download,
  AlertCircle
} from 'lucide-react';

export default function PDFEditorModal({
  isOpen,
  fileName,
  fileData,
  onSave,
  onClose,
  title = "Edit PDF Document"
}) {
  if (!isOpen) return null;

  const [documentTitle, setDocumentTitle] = useState(fileName || 'PDCA_Audit_Finding.pdf');
  const [remarks, setRemarks] = useState(
    'Audit inspection noted non-conformance on Line 4. Critical parameters verified against standard operating procedures. Corrective action plan initiated immediately.'
  );
  const [annotations, setAnnotations] = useState([
    { id: 1, page: 1, type: 'Observation', note: 'Non-conformance identified at inspection station' },
    { id: 2, page: 1, type: 'Corrective Action', note: 'Replaced defective sensor and recalibrated torque gauge' }
  ]);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [newType, setNewType] = useState('Observation');

  const handleAddAnnotation = () => {
    if (!newAnnotation.trim()) return;
    setAnnotations([
      ...annotations,
      {
        id: Date.now(),
        page: 1,
        type: newType,
        note: newAnnotation.trim()
      }
    ]);
    setNewAnnotation('');
  };

  const handleDeleteAnnotation = (id) => {
    setAnnotations(annotations.filter((a) => a.id !== id));
  };

  const handleSave = () => {
    onSave({
      fileName: documentTitle,
      remarks,
      annotations
    });
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {title}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
                  PDF Annotator & Notes
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                {fileName || 'Document.pdf'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 flex-1 overflow-auto">
          {/* Document Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Document Display Name
            </label>
            <input
              type="text"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none"
            />
          </div>

          {/* Audit Notes / Summary */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Findings & Summary Remarks
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks and findings for this PDF..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-rose-500 focus:border-rose-500 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* PDF Key Findings Annotations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">
                Key Points / Section Annotations
              </label>
              <span className="text-[11px] text-slate-400">
                {annotations.length} items logged
              </span>
            </div>

            {/* List */}
            <div className="space-y-2 mb-3 max-h-44 overflow-y-auto pr-1">
              {annotations.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-start justify-between gap-3 p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl"
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.type === 'Observation' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.type}
                    </span>
                    <p className="text-xs text-slate-700 leading-snug">{item.note}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteAnnotation(item.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new annotation */}
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="Observation">Observation</option>
                <option value="Corrective Action">Corrective Action</option>
                <option value="Clause Reference">Clause Reference</option>
              </select>
              <input
                type="text"
                value={newAnnotation}
                onChange={(e) => setNewAnnotation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAnnotation();
                  }
                }}
                placeholder="Add annotation note (Press Enter)..."
                className="flex-1 text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={handleAddAnnotation}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Edits and notes are saved directly with this PDCA audit entry.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Document</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
