import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Image as ImageIcon,
  Images,
  Plus,
  Upload,
  Trash2,
  Eye,
  Download,
  Edit3,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { getMediaUrl } from '@/utils/mediaUtils.js';

export default function EvidenceViewerModal({
  isOpen,
  onClose,
  title = "Evidence Images",
  field = "imageBefore",
  rowIndex = 0,
  images = [],
  readOnly = false,
  canDelete = false,
  onAddImages,
  onRemoveImage,
  onReplaceImage,
  onOpenEditor,
  onViewEnlarged
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [replacingImageId, setReplacingImageId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileInputRef = useRef(null);
  const replaceInputRef = useRef(null);

  if (!isOpen) return null;

  const isBefore = field === 'imageBefore';
  const columnLabel = isBefore ? 'Image Before' : 'Image After';

  // File selection for adding new images
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await handleAddFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddFiles = async (files) => {
    if (!files.length || isUploading) return;

    // Filter valid image types
    const validImages = files.filter((f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name));
    if (validImages.length === 0) {
      setErrorMessage('Please select valid image files (JPG, PNG, WEBP).');
      return;
    }
    const oversized = validImages.find((file) => file.size > 15 * 1024 * 1024);
    if (oversized) {
      setErrorMessage(`"${oversized.name}" exceeds the 15 MB per-image limit.`);
      return;
    }

    setErrorMessage('');
    setIsUploading(true);
    try {
      if (onAddImages) {
        await onAddImages(validImages);
      }
    } catch (err) {
      console.error('Failed adding images:', err);
      setErrorMessage('Failed to upload one or more images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageDrop = async (event) => {
    event.preventDefault();
    setIsDragOver(false);
    if (readOnly || isUploading) return;
    await handleAddFiles(Array.from(event.dataTransfer?.files || []));
  };

  // Trigger file replacement
  const handleTriggerReplace = (imageId) => {
    setReplacingImageId(imageId);
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleReplaceSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !replacingImageId) return;

    if (!file.type.startsWith('image/') && !/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name)) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    setErrorMessage('');
    setIsUploading(true);
    try {
      if (onReplaceImage) {
        await onReplaceImage(replacingImageId, file);
      }
    } catch (err) {
      console.error('Failed replacing image:', err);
      setErrorMessage('Failed to replace image. Please try again.');
    } finally {
      setIsUploading(false);
      setReplacingImageId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // Download individual image
  const handleDownload = (img) => {
    const resolvedUrl = getMediaUrl(img.url);
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = img.name || `evidence_${field}_row${rowIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden inputs for file upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleReplaceSelect}
          disabled={isUploading}
        />

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs border ${
              isBefore
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}>
              <Images className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  {columnLabel} Evidence
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isBefore
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Row #{rowIndex + 1}
                </span>
                {readOnly && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                    View-Only
                  </span>
                )}
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {images.length} {images.length === 1 ? 'image' : 'images'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {readOnly ? 'View and download photographic evidence records for this observation.' : 'Upload and inspect multiple photographic evidence records for this observation.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Primary Add Image Button (Only if not read-only) */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Select one or more image files to upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add Image</span>
                  </>
                )}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer"
              title="Close evidence viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Error Alert (if any) */}
        {errorMessage && (
          <div className="mx-5 mt-3 px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage('')}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Modal Body / Evidence Gallery */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[280px]">
          {images.length === 0 ? (
            /* Empty State: Large centered image placeholder with Add Image button */
            <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-4 shadow-2xs">
                <ImageIcon className="w-10 h-10" />
              </div>
              <h4 className="text-base font-bold text-slate-800 mb-1">
                No Evidence Images Added Yet
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                {readOnly
                  ? `No photographic evidence has been uploaded for ${columnLabel} on Row #${rowIndex + 1}.`
                  : `Add photographic evidence for ${columnLabel} on Row #${rowIndex + 1}. You can upload multiple JPG, PNG, or WEBP photos.`}
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Image</span>
                </button>
              )}
            </div>
          ) : (
            /* Multi-Image Evidence Grid */
            <div className="space-y-4">
              {/* Optional top quick-add dropzone strip (Only if not readOnly) */}
              {!readOnly && (
                <div
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onDragOver={(event) => { event.preventDefault(); if (!readOnly && !isUploading) setIsDragOver(true); }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragOver(false); }}
                  onDrop={handleImageDrop}
                  className={`border-2 border-dashed rounded-xl p-3 flex items-center justify-center gap-2 transition-colors ${isDragOver ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-blue-400 hover:bg-blue-50/30 hover:text-blue-600'} ${isUploading ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Upload className="w-4 h-4 text-blue-500" />}
                  <span className="text-xs font-semibold">{isUploading ? 'Uploading images...' : 'Drag and drop images here, or click to add more'}</span>
                  <span className="text-[10px] text-slate-400">(JPG, PNG, WEBP, up to 15 MB each)</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((img, idx) => {
                  const mediaUrl = getMediaUrl(img.url);
                  const isConfirmingDelete = confirmDeleteId === img.id;

                  return (
                    <div
                      key={img.id || idx}
                      className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden group/card"
                    >
                      {/* Image Preview Container (Large, Aspect Ratio Maintained) */}
                      <div className="relative h-44 bg-slate-900/5 flex items-center justify-center p-2 overflow-hidden border-b border-slate-100">
                        <img
                          src={mediaUrl}
                          alt={img.name || `Evidence ${idx + 1}`}
                          className="max-h-full max-w-full object-contain rounded transition-transform duration-200 group-hover/card:scale-105 cursor-zoom-in"
                          onClick={() => onViewEnlarged?.(mediaUrl)}
                        />

                        {/* Hover Overlay with View Action */}
                        <div
                          className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/card:opacity-100 flex items-center justify-center transition-opacity cursor-zoom-in"
                          onClick={() => onViewEnlarged?.(mediaUrl)}
                        >
                          <span className="flex items-center gap-1.5 bg-black/70 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Click to Enlarge</span>
                          </span>
                        </div>

                        {/* Image Index Tag */}
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                          #{idx + 1}
                        </div>
                      </div>

                      {/* Card Details & Action Toolbar */}
                      <div className="p-3 bg-white flex flex-col justify-between flex-1 gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs font-semibold text-slate-800 truncate"
                            title={img.name || `Image ${idx + 1}`}
                          >
                            {img.name || `Image ${idx + 1}`}
                          </span>
                          {img.size && (
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              {(img.size / 1024).toFixed(0)} KB
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        {isConfirmingDelete ? (
                          <div className="flex items-center justify-between gap-1 bg-rose-50 border border-rose-200 rounded-lg p-1.5 animate-in fade-in">
                            <span className="text-[11px] font-semibold text-rose-700">Remove?</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveImage?.(img.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div className="flex items-center gap-1">
                              {/* Edit Image (Pen, Crop, Text) - Only if not read-only */}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => onOpenEditor?.(img)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit photo (Pen, Crop, Text)"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Replace Image - Only if not read-only */}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleTriggerReplace(img.id)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Replace with a different image"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Download Image - Allowed for all users */}
                              <button
                                type="button"
                                onClick={() => handleDownload(img)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Download image"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Delete Button - Only if not read-only and user has delete permission (admin only) */}
                            {!readOnly && canDelete && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(img.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove this evidence photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {images.length > 0 && (
              <span>
                Total: <strong className="text-slate-700">{images.length}</strong> evidence photo{images.length > 1 ? 's' : ''} attached to Row #{rowIndex + 1}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
