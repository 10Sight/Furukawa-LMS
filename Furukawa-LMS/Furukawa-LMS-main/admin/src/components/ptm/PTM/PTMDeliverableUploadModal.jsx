import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  UploadCloud
} from 'lucide-react';

export default function PTMDeliverableUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,
  rowIndex = null
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);

  useEffect(() => {
    return () => imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [imagePreviews]);

  const processFile = useCallback((file, type) => {
    if (!file) return;
    const MAX_SIZE = 25 * 1024 * 1024; // 25 MB limit
    if (file.size > MAX_SIZE) {
      window.alert(`File "${file.name}" exceeds the maximum allowed limit of 25 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      onUploadSuccess?.({
        name: file.name,
        type,
        size: file.size,
        url: evt.target.result,
        lastModified: file.lastModified
      });
      onClose();
    };
    reader.onerror = () => {
      onUploadSuccess?.({
        name: file.name,
        type,
        size: file.size,
        url: URL.createObjectURL(file),
        lastModified: file.lastModified
      });
      onClose();
    };
    reader.readAsDataURL(file);
  }, [onUploadSuccess, onClose]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const file = files[0];
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|svg)$/i.test(file.name)) {
      processFile(file, 'image');
    } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      processFile(file, 'pdf');
    } else if (/\.(xlsx?|csv)$/i.test(file.name) || file.type.includes('excel') || file.type.includes('spreadsheet') || file.type.includes('csv')) {
      processFile(file, 'excel');
    } else {
      window.alert(`Unsupported file format: "${file.name}". Please upload an Image, PDF, or Excel file.`);
    }
  }, [processFile]);

  if (!isOpen) return null;

  const uploadOptions = [
    {
      id: 'image',
      title: 'Upload Image',
      subtitle: 'JPG, PNG, WEBP, SVG',
      desc: 'Upload photo with built-in preview',
      icon: ImageIcon,
      accept: 'image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg',
      bgColor: 'bg-blue-50/70 hover:bg-blue-100/80',
      borderColor: 'border-blue-200 hover:border-blue-400',
      iconColor: 'text-blue-600',
      badge: 'Image'
    },
    {
      id: 'pdf',
      title: 'Upload PDF',
      subtitle: 'PDF Documents',
      desc: 'Upload deliverable or report PDF document',
      icon: FileText,
      accept: '.pdf,application/pdf',
      bgColor: 'bg-rose-50/70 hover:bg-rose-100/80',
      borderColor: 'border-rose-200 hover:border-rose-400',
      iconColor: 'text-rose-600',
      badge: 'PDF Document'
    },
    {
      id: 'excel',
      title: 'Upload Excel',
      subtitle: 'Spreadsheets (.xlsx, .xls, .csv)',
      desc: 'Upload tracking spreadsheet or CSV file',
      icon: FileSpreadsheet,
      accept: '.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
      bgColor: 'bg-emerald-50/70 hover:bg-emerald-100/80',
      borderColor: 'border-emerald-200 hover:border-emerald-400',
      iconColor: 'text-emerald-600',
      badge: 'Spreadsheet'
    }
  ];

  const handleFileChange = (opt, e) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const file = rawFiles[0];

    if (opt.id === 'image') {
      const isValid = file.type.startsWith('image/') || /\.(jpe?g|png|webp|svg)$/i.test(file.name);
      if (!isValid) {
        window.alert(`Invalid file type: "${file.name}". Please select image files only (JPG, JPEG, PNG, WEBP, SVG).`);
        e.target.value = '';
        return;
      }
      processFile(file, 'image');
    } else if (opt.id === 'pdf') {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        window.alert(`Invalid file type: "${file.name}". Please select a valid PDF document (.pdf).`);
        e.target.value = '';
        return;
      }
      processFile(file, 'pdf');
    } else if (opt.id === 'excel') {
      const isExcel =
        /\.(xlsx?|csv)$/i.test(file.name) ||
        file.type.includes('excel') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('csv');
      if (!isExcel) {
        window.alert(`Invalid file type: "${file.name}". Please select a valid spreadsheet file (.xlsx, .xls, .csv).`);
        e.target.value = '';
        return;
      }
      processFile(file, 'excel');
    }
    e.target.value = '';
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                Choose Upload Type
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  Deliverable Attachment
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Select an attachment type for this deliverable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5">
          {/* Drag & Drop Zone */}
          <div
            className={`mb-4 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
            }}
            onDrop={handleDrop}
          >
            <UploadCloud className="mx-auto mb-2 h-6 w-6 text-blue-600" />
            <p className="text-sm font-semibold text-slate-700">Drag and drop file here</p>
            <p className="mt-1 text-xs text-slate-500">
              Drop file here, or choose an upload card below. Supports Image, PDF, Excel (up to 25 MB).
            </p>
          </div>

          {/* 3 Upload Cards: Image, PDF, Excel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {uploadOptions.map((opt) => {
              const IconComp = opt.icon;
              return (
                <label
                  key={opt.id}
                  className={`group relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${opt.bgColor} ${opt.borderColor} hover:shadow-md hover:-translate-y-0.5 justify-between min-h-[145px]`}
                >
                  <input
                    type="file"
                    accept={opt.accept}
                    className="hidden"
                    onChange={(e) => handleFileChange(opt, e)}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-9 h-9 rounded-lg bg-white shadow-2xs border border-white/60 flex items-center justify-center ${opt.iconColor} group-hover:scale-105 transition-transform`}
                      >
                        <IconComp className="w-4 h-4 stroke-[2.2]" />
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/90 text-slate-600 shadow-2xs border border-slate-200/60 flex items-center gap-1">
                        <span className="text-amber-500 font-extrabold">#</span>
                        <span>{opt.badge}</span>
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-tight">
                      {opt.title}
                    </h4>
                    <span className="text-[10px] font-mono font-medium text-slate-500 mt-0.5 block truncate">
                      {opt.subtitle}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-snug">
                      {opt.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                    <span>Upload</span>
                    <span className="text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Supported: Images (JPG, PNG, WEBP, SVG), PDF (.pdf), Excel (.xlsx, .xls, .csv)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

