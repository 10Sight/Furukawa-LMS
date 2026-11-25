import React, { useEffect, useState } from 'react';
import { X, Lock, Eye, FolderOpen, ArrowLeft, Calendar, FileSpreadsheet } from 'lucide-react';
import { ptmTemplateApi } from '../../../pages/ptm/services/api';
import { findTemplatePhaseMeta } from '../../../pages/ptm/data/ptmTemplates';
import PTMTemplateSheetTable from './PTMTemplateSheetTable';

export default function PTMTemplatePickerModal({
  isOpen,
  selectedPhase = '',
  onClose,
  onApplyTemplate,
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const phaseMeta = findTemplatePhaseMeta(selectedPhase);
  const displayPhaseLabel = phaseMeta?.label || selectedPhase || 'Selected Phase';
  const queryPhaseKey = phaseMeta?.key || selectedPhase;

  useEffect(() => {
    if (!isOpen || !queryPhaseKey) return;
    setPreviewTemplate(null);
    let cancelled = false;
    setLoading(true);
    ptmTemplateApi
      .getAll(queryPhaseKey)
      .then((res) => {
        if (cancelled) return;
        setTemplates(res?.success && Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, queryPhaseKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4">
      <div className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Frozen Phase Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Selected Phase (Frozen / Read-Only)
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>{displayPhaseLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 min-h-0 overflow-y-auto">
          {previewTemplate ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/60 border border-blue-200 rounded-xl px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewTemplate(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Templates</span>
                  </button>
                  <span className="text-sm font-extrabold text-slate-900">
                    {previewTemplate.templateName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Calendar className="w-3.5 h-3.5" />
                    {previewTemplate.templateDate}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onApplyTemplate?.(previewTemplate)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Open in PTM Sheet</span>
                </button>
              </div>

              <PTMTemplateSheetTable
                rows={Array.isArray(previewTemplate.rows) ? previewTemplate.rows : []}
                readOnly={true}
              />
            </div>
          ) : loading ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">
              Loading templates for {displayPhaseLabel}...
            </div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">
              No templates found for <strong>{displayPhaseLabel}</strong>. Create one in the{' '}
              <strong>Template</strong> tab first.
            </div>
          ) : (
            <div className="space-y-2.5">
              {templates.map((tpl, idx) => (
                <div
                  key={tpl.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {tpl.templateName}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Date: {tpl.templateDate} •{' '}
                        {Array.isArray(tpl.rows) ? tpl.rows.length : 0}{' '}
                        {Array.isArray(tpl.rows) && tpl.rows.length === 1 ? 'row' : 'rows'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(tpl)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onApplyTemplate?.(tpl)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
