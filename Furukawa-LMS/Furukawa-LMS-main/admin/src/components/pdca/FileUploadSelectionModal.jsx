import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  FileText,
  Presentation,
  FileSpreadsheet,
  UploadCloud
} from 'lucide-react';

export default function FileUploadSelectionModal({
  isOpen,
  onClose,
  onSelectType,
  onUploadSuccess,
  columnTitle = "Image (Before)"
}) {
  if (!isOpen) return null;

  const uploadOptions = [
    {
      id: 'image',
      title: 'Upload Image',
      subtitle: 'JPG, PNG, WEBP, SVG',
      desc: 'Upload photo with built-in Pen, Crop & Text editor',
      icon: ImageIcon,
      accept: 'image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg',
      multiple: true,
      bgColor: 'bg-blue-50/70 hover:bg-blue-100/80',
      borderColor: 'border-blue-200 hover:border-blue-400',
      iconColor: 'text-blue-600',
      badge: 'Interactive Editor'
    },
    {
      id: 'pdf',
      title: 'Upload PDF',
      subtitle: 'PDF Documents',
      desc: 'Upload audit report or observation PDF document',
      icon: FileText,
      accept: '.pdf,application/pdf',
      multiple: false,
      bgColor: 'bg-rose-50/70 hover:bg-rose-100/80',
      borderColor: 'border-rose-200 hover:border-rose-400',
      iconColor: 'text-rose-600',
      badge: 'PDF Document'
    },
    {
      id: 'ppt',
      title: 'Upload PPT',
      subtitle: 'PowerPoint (.ppt, .pptx)',
      desc: 'Upload presentation slide deck (.ppt / .pptx)',
      icon: Presentation,
      accept: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
      multiple: false,
      bgColor: 'bg-amber-50/70 hover:bg-amber-100/80',
      borderColor: 'border-amber-200 hover:border-amber-400',
      iconColor: 'text-amber-600',
      badge: 'Slide Deck'
    },
    {
      id: 'excel',
      title: 'Upload Excel',
      subtitle: 'Spreadsheets (.xlsx, .xls, .csv)',
      desc: 'Upload inspection spreadsheet or CSV file',
      icon: FileSpreadsheet,
      accept: '.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
      multiple: false,
      bgColor: 'bg-emerald-50/70 hover:bg-emerald-100/80',
      borderColor: 'border-emerald-200 hover:border-emerald-400',
      iconColor: 'text-emerald-600',
      badge: 'Spreadsheet'
    }
  ];

  const handleFileChange = (opt, e) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;
    const files = Array.from(rawFiles);
    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB limit

    if (opt.id === 'image') {
      // Validate that all selected files are valid images
      const invalidFiles = files.filter(
        (f) => !f.type.startsWith('image/') && !/\.(jpe?g|png|webp|svg)$/i.test(f.name)
      );
      if (invalidFiles.length > 0) {
        window.alert(
          `Invalid file type: "${invalidFiles[0].name}". Please select image files only (JPG, JPEG, PNG, WEBP, SVG).`
        );
        e.target.value = '';
        return;
      }

      // Validate size for each file
      const oversized = files.filter((f) => f.size > MAX_SIZE);
      if (oversized.length > 0) {
        const sizeMB = (oversized[0].size / (1024 * 1024)).toFixed(1);
        window.alert(
          `File "${oversized[0].name}" is ${sizeMB} MB, which exceeds the maximum allowed limit of 15 MB. Please select smaller files.`
        );
        e.target.value = '';
        return;
      }

      if (onSelectType) {
        onSelectType('image', files);
      } else if (onUploadSuccess && files[0]) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          onUploadSuccess({
            url: evt.target.result,
            name: files[0].name,
            type: 'image'
          });
        };
        reader.readAsDataURL(files[0]);
      }
      e.target.value = '';
    } else {
      // PDF, PPT, Excel - Single file only
      const file = files[0];

      if (file.size > MAX_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        window.alert(
          `The selected file "${file.name}" is ${sizeMB} MB, which exceeds the maximum allowed limit of 15 MB. Please select a smaller file.`
        );
        e.target.value = '';
        return;
      }

      if (opt.id === 'pdf') {
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        if (!isPdf) {
          window.alert(`Invalid file type: "${file.name}". Please select a valid PDF document (.pdf).`);
          e.target.value = '';
          return;
        }
      } else if (opt.id === 'ppt') {
        const isPpt =
          /\.(pptx?)$/i.test(file.name) ||
          file.type.includes('presentation') ||
          file.type.includes('powerpoint');
        if (!isPpt) {
          window.alert(
            `Invalid file type: "${file.name}". Please select a valid PowerPoint presentation (.ppt, .pptx).`
          );
          e.target.value = '';
          return;
        }
      } else if (opt.id === 'excel') {
        const isExcel =
          /\.(xlsx?|csv)$/i.test(file.name) ||
          file.type.includes('excel') ||
          file.type.includes('spreadsheet') ||
          file.type.includes('csv');
        if (!isExcel) {
          window.alert(
            `Invalid file type: "${file.name}". Please select a valid spreadsheet file (.xlsx, .xls, .csv).`
          );
          e.target.value = '';
          return;
        }
      }

      if (onSelectType) {
        onSelectType(opt.id, file);
      } else if (onUploadSuccess) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          onUploadSuccess({
            url: evt.target.result,
            name: file.name,
            type: opt.id
          });
        };
        reader.readAsDataURL(file);
      }
      e.target.value = '';
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl lg:max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
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
                  {columnTitle}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Select an attachment type for this audit observation
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

        {/* 4 Interactive Cards */}
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {uploadOptions.map((opt) => {
              const IconComp = opt.icon;
              return (
                <label
                  key={opt.id}
                  className={`group relative flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${opt.bgColor} ${opt.borderColor} hover:shadow-md hover:-translate-y-0.5 justify-between min-h-[145px]`}
                >
                  <input
                    type="file"
                    accept={opt.accept}
                    multiple={opt.multiple}
                    className="hidden"
                    onChange={(e) => handleFileChange(opt, e)}
                  />

                  {/* Top: Icon + Badge Tag */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg bg-white shadow-2xs border border-white/60 flex items-center justify-center ${opt.iconColor} group-hover:scale-105 transition-transform`}
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

                  {/* Bottom Action Hint */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
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
          <span>Supported: Images, PDF, PowerPoint (.ppt, .pptx), Excel (.xlsx, .csv)</span>
          <button
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
