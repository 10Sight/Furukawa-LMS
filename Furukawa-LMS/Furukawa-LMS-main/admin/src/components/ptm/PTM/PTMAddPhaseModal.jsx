import React, { useEffect, useState } from 'react';
import {
  X,
  Layers,
  FileText,
  Paperclip,
  Eye,
  FolderOpen,
  ArrowLeft,
  Calendar,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import { ptmTemplateApi } from '../../../pages/ptm/services/api';
import { PTM_TEMPLATE_PHASES } from '../../../pages/ptm/data/ptmTemplates';
import PTMTemplateSheetTable from './PTMTemplateSheetTable';

export default function PTMAddPhaseModal({
  isOpen,
  onClose,
  onAddBlankPhase,
  onAddTemplatePhase,
}) {
  const [phases, setPhases] = useState(PTM_TEMPLATE_PHASES);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const [mode, setMode] = useState('choose'); // 'choose' | 'templates'
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedPhase(null);
    setMode('choose');
    setTemplates([]);
    setPreviewTemplate(null);

    let cancelled = false;
    ptmTemplateApi
      .getPhases()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.data) && res.data.length > 0) {
          setPhases(res.data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleOpenTemplateList = () => {
    if (!selectedPhase) return;
    setMode('templates');
    setPreviewTemplate(null);
    setLoadingTemplates(true);
    ptmTemplateApi
      .getAll(selectedPhase.key || selectedPhase.label)
      .then((res) => {
        setTemplates(res?.success && Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        setTemplates([]);
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Add Phase to Sheet</h3>
              <p className="text-xs text-slate-500 font-medium">
                Select a phase first, then choose Blank or Add Template
              </p>
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
        <div className="p-5 flex-1 min-h-0 overflow-y-auto space-y-5">
          {mode === 'choose' ? (
            <>
              {/* Step 1: Select Phase */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Step 1: Select Phase <span className="text-red-500">*</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {phases.map((phase) => {
                    const isSelected = selectedPhase?.key === phase.key;
                    return (
                      <button
                        key={phase.key}
                        type="button"
                        onClick={() => setSelectedPhase(phase)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate font-semibold">{phase.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Blank / Add Template (only enabled once Phase is selected) */}
              <div className="border-t border-slate-200 pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Step 2: Choose Sheet Data Option
                </div>
                {!selectedPhase ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-4 text-center text-xs sm:text-sm font-medium text-slate-500">
                    Please select a Phase above to enable <strong>Blank</strong> or{' '}
                    <strong>Add Template</strong>.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onAddBlankPhase?.(selectedPhase.label)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-2xs transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Blank</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenTemplateList}
                      className="flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span>Add Template</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : previewTemplate ? (
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
                  onClick={() => onAddTemplatePhase?.(selectedPhase.label, previewTemplate)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Add to PTM Sheet</span>
                </button>
              </div>

              <PTMTemplateSheetTable
                rows={Array.isArray(previewTemplate.rows) ? previewTemplate.rows : []}
                readOnly={true}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Phase Selection</span>
                </button>
                <span className="text-xs font-bold text-slate-600">
                  Phase: {selectedPhase?.label}
                </span>
              </div>

              {loadingTemplates ? (
                <div className="py-12 text-center text-sm font-medium text-slate-500">
                  Loading templates for {selectedPhase?.label}...
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center text-sm font-medium text-slate-500">
                  No templates found for <strong>{selectedPhase?.label}</strong>.
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
                          onClick={() => onAddTemplatePhase?.(selectedPhase.label, tpl)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
