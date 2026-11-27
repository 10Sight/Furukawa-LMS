import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Eye,
  Edit3,
  Trash2,
  ArrowLeft,
  Save,
  X,
  FileSpreadsheet,
  Calendar,
  Lock,
  Upload,
  Download,
  History,
  RefreshCw,
} from 'lucide-react';
import { ptmTemplateApi } from '../../../pages/ptm/services/api';
import {
  PTM_TEMPLATE_PHASES,
  createTemplateBlankRow,
  createDefaultTemplateRows,
} from '../../../pages/ptm/data/ptmTemplates';
import {
  exportTemplateToExcel,
  parseTemplateExcelFile,
} from '../../../pages/ptm/data/ptmTemplateExcel';
import PTMTemplateSheetTable from './PTMTemplateSheetTable';

const getTodayISO = () => new Date().toISOString().slice(0, 10);

export default function PTMTemplateManager({
  isAdmin = false,
  currentUser = null,
  dbEmployees = [],
  showToast = () => { },
  onTemplateOpenChange,
}) {
  const [phases, setPhases] = useState(PTM_TEMPLATE_PHASES);
  const [selectedPhaseKey, setSelectedPhaseKey] = useState(PTM_TEMPLATE_PHASES[0].key);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add Phase Modal state
  const [isAddPhaseModalOpen, setIsAddPhaseModalOpen] = useState(false);
  const [newPhaseLabel, setNewPhaseLabel] = useState('');
  const [newPhaseCreatedDate, setNewPhaseCreatedDate] = useState(getTodayISO());
  const [phaseSaving, setPhaseSaving] = useState(false);

  // Edit Phase Popup state (right-click on phase button)
  const [editingPhase, setEditingPhase] = useState(null);
  const [editPhaseLabel, setEditPhaseLabel] = useState('');
  const [editPhaseCreatedDate, setEditPhaseCreatedDate] = useState(getTodayISO());
  const [confirmDeletePhase, setConfirmDeletePhase] = useState(null);

  // Edit Template Meta Popup state (right-click on template row)
  const [editingTemplateMeta, setEditingTemplateMeta] = useState(null);
  const [editTemplateMetaName, setEditTemplateMetaName] = useState('');
  const [editTemplateMetaPhaseKey, setEditTemplateMetaPhaseKey] = useState('');

  // Add Template Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDate, setNewTemplateDate] = useState(getTodayISO());
  const [importedRows, setImportedRows] = useState([]);
  const [importedFileName, setImportedFileName] = useState('');
  const excelInputRef = useRef(null);
  const sheetExcelInputRef = useRef(null);

  // History Page state
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'phase' | 'template' | 'sheet'

  const loggedInCreatorName = currentUser?.name || currentUser?.userName || 'Admin';

  // Active template editor / viewer state
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [editorMode, setEditorMode] = useState(null); // 'edit' | 'view' | null
  const [draftName, setDraftName] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [draftRows, setDraftRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const selectedPhaseMeta =
    phases.find((p) => p.key === selectedPhaseKey) || phases[0] || PTM_TEMPLATE_PHASES[0];

  const loadPhases = async () => {
    try {
      const res = await ptmTemplateApi.getPhases();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setPhases(res.data);
      }
    } catch (err) {
      console.warn('Failed to load phases:', err);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await ptmTemplateApi.getHistory();
      if (res?.success && Array.isArray(res.data)) {
        setHistoryItems(res.data);
      } else {
        setHistoryItems([]);
      }
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadPhases();
  }, []);

  const loadTemplates = async (phaseKey = selectedPhaseKey) => {
    setLoading(true);
    try {
      const res = await ptmTemplateApi.getAll(phaseKey);
      if (res?.success && Array.isArray(res.data)) {
        setTemplates(res.data);
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.warn('Failed to load templates:', err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates(selectedPhaseKey);
  }, [selectedPhaseKey]);

  useEffect(() => {
    onTemplateOpenChange?.(Boolean(activeTemplate && editorMode));
    return () => onTemplateOpenChange?.(false);
  }, [activeTemplate, editorMode, onTemplateOpenChange]);

  const handleOpenAddPhaseModal = () => {
    if (!isAdmin) {
      showToast('❌ Only Admin can add phases');
      return;
    }
    setNewPhaseLabel('');
    setNewPhaseCreatedDate(getTodayISO());
    setIsAddPhaseModalOpen(true);
  };

  const handleCreatePhase = async (e) => {
    e.preventDefault();
    const trimmedLabel = newPhaseLabel.trim();
    if (!trimmedLabel) {
      showToast('⚠️ Please enter Phase Title / Label');
      return;
    }
    try {
      setPhaseSaving(true);
      const res = await ptmTemplateApi.createPhase({
        pageName: trimmedLabel,
        label: trimmedLabel,
        createdBy: loggedInCreatorName,
        createdDate: newPhaseCreatedDate || getTodayISO(),
      });
      if (!res?.success || !res?.data) {
        showToast(res?.message || '❌ Failed to create phase');
        return;
      }
      setIsAddPhaseModalOpen(false);
      await loadPhases();
      setSelectedPhaseKey(res.data.key);
      showToast(`✓ Phase "${res.data.label}" created`);
    } catch {
      showToast('❌ Could not create phase');
    } finally {
      setPhaseSaving(false);
    }
  };

  const handlePhaseContextMenu = (e, phase) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('❌ Only Admin can edit phases');
      return;
    }
    setEditingPhase(phase);
    setEditPhaseLabel(phase.label || '');
    setEditPhaseCreatedDate(phase.createdDate || getTodayISO());
  };

  const handleUpdatePhase = async (e) => {
    e.preventDefault();
    if (!editingPhase || !isAdmin) return;
    const trimmedLabel = editPhaseLabel.trim();
    if (!trimmedLabel) {
      showToast('⚠️ Phase Title / Label cannot be empty');
      return;
    }
    try {
      setPhaseSaving(true);
      const res = await ptmTemplateApi.updatePhase(editingPhase.key, {
        pageName: trimmedLabel,
        label: trimmedLabel,
        createdDate: editPhaseCreatedDate || getTodayISO(),
        performedBy: loggedInCreatorName,
      });
      if (!res?.success || !res?.data) {
        showToast(res?.message || '❌ Failed to update phase');
        return;
      }
      const updatedKey = editingPhase.key;
      setEditingPhase(null);
      await loadPhases();
      if (selectedPhaseKey === updatedKey) {
        await loadTemplates(updatedKey);
      }
      showToast(`✓ Phase "${res.data.label}" updated`);
    } catch {
      showToast('❌ Could not update phase');
    } finally {
      setPhaseSaving(false);
    }
  };

  const handleTemplateContextMenu = (e, tpl) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('❌ Only Admin can edit templates');
      return;
    }
    setEditingTemplateMeta(tpl);
    setEditTemplateMetaName(tpl.templateName || '');
    setEditTemplateMetaPhaseKey(tpl.phaseKey || selectedPhaseMeta.key);
  };

  const handleUpdateTemplateMeta = async (e) => {
    e.preventDefault();
    if (!editingTemplateMeta || !isAdmin) return;
    const trimmedName = editTemplateMetaName.trim();
    if (!trimmedName) {
      showToast('⚠️ Template Name cannot be empty');
      return;
    }
    const targetPhase = phases.find((p) => p.key === editTemplateMetaPhaseKey) || selectedPhaseMeta;
    try {
      setSaving(true);
      const res = await ptmTemplateApi.update(editingTemplateMeta.id, {
        templateName: trimmedName,
        phaseKey: targetPhase.key,
        phaseLabel: targetPhase.label,
        performedBy: loggedInCreatorName,
      });
      if (!res?.success) {
        showToast(res?.message || '❌ Failed to update template');
        return;
      }
      setEditingTemplateMeta(null);
      await loadTemplates(selectedPhaseKey);
      showToast('✓ Template updated');
    } catch {
      showToast('❌ Could not update template');
    } finally {
      setSaving(false);
    }
  };

  const handleSheetExcelImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseTemplateExcelFile(file, selectedPhaseMeta);
      setDraftRows(parsed);
      showToast(`✓ Imported ${parsed.length} rows from ${file.name} (click Save Template to save)`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Failed to import Excel file'}`);
    }
  };

  const handleConfirmDeletePhase = async () => {
    if (!confirmDeletePhase || !isAdmin) return;
    const deletedKey = confirmDeletePhase.key;
    const deletedName = confirmDeletePhase.pageName || confirmDeletePhase.label;
    try {
      setPhaseSaving(true);
      const res = await ptmTemplateApi.deletePhase(deletedKey, loggedInCreatorName);
      if (!res?.success) {
        showToast(res?.message || '❌ Failed to remove phase');
        return;
      }

      const remaining = phases.filter((p) => p.key !== deletedKey);
      setPhases(remaining);
      if (selectedPhaseKey === deletedKey) {
        setSelectedPhaseKey(remaining[0]?.key || '');
        if (!remaining[0]?.key) {
          setTemplates([]);
        }
      }
      setConfirmDeletePhase(null);
      setEditingPhase(null);
      await loadPhases();
      showToast(`✓ Phase "${deletedName}" removed`);
    } catch {
      showToast('❌ Could not remove phase');
    } finally {
      setPhaseSaving(false);
    }
  };

  const handleOpenAddModal = () => {
    if (!isAdmin) {
      showToast('❌ Only Admin can add templates');
      return;
    }
    setNewTemplateName('');
    setNewTemplateDate(getTodayISO());
    setImportedRows([]);
    setImportedFileName('');
    setIsAddModalOpen(true);
  };

  const handleExcelFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseTemplateExcelFile(file, selectedPhaseMeta);
      setImportedRows(parsed);
      setImportedFileName(file.name);
      if (!newTemplateName.trim()) {
        setNewTemplateName(file.name.replace(/\.[^/.]+$/, ''));
      }
      showToast(`✓ Imported ${parsed.length} rows from ${file.name}`);
    } catch (err) {
      showToast(`❌ ${err?.message || 'Failed to import Excel file'}`);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    const trimmedName = newTemplateName.trim();
    if (!trimmedName) {
      showToast('⚠️ Please enter a Template Name');
      return;
    }

    const initialRows =
      importedRows.length > 0
        ? importedRows
        : createDefaultTemplateRows(10, selectedPhaseMeta);
    try {
      setSaving(true);
      const res = await ptmTemplateApi.create({
        phaseKey: selectedPhaseMeta.key,
        phaseLabel: selectedPhaseMeta.label,
        templateName: trimmedName,
        templateDate: newTemplateDate || getTodayISO(),
        rows: initialRows,
        createdBy: currentUser?.name || currentUser?.userName || 'Admin',
      });

      if (!res?.success || !res?.data) {
        showToast(res?.message || '❌ Failed to create template');
        return;
      }

      setIsAddModalOpen(false);
      await loadTemplates(selectedPhaseKey);

      // Open immediately in editor so admin can fill & save rows
      setActiveTemplate(res.data);
      setDraftName(res.data.templateName);
      setDraftDate(res.data.templateDate);
      setDraftRows(Array.isArray(res.data.rows) ? res.data.rows : initialRows);
      setEditorMode('edit');
      showToast('✓ Template created — fill rows and click Save');
    } catch (err) {
      showToast('❌ Could not create template');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTemplate = (tpl, mode) => {
    setActiveTemplate(tpl);
    setDraftName(tpl.templateName || '');
    setDraftDate(tpl.templateDate || getTodayISO());
    setDraftRows(Array.isArray(tpl.rows) ? tpl.rows : []);
    setEditorMode(mode);
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate || !isAdmin) return;
    if (!draftName.trim()) {
      showToast('⚠️ Template Name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      const res = await ptmTemplateApi.update(activeTemplate.id, {
        templateName: draftName.trim(),
        templateDate: draftDate || getTodayISO(),
        rows: draftRows,
        performedBy: loggedInCreatorName,
      });
      if (!res?.success) {
        showToast(res?.message || '❌ Failed to save template');
        return;
      }
      setActiveTemplate(res.data);
      await loadTemplates(selectedPhaseKey);
      showToast('✓ Template saved successfully');
    } catch (err) {
      showToast('❌ Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (tpl) => {
    if (!isAdmin) {
      showToast('❌ Only Admin can delete templates');
      return;
    }
    if (!window.confirm(`Delete template "${tpl.templateName}"?`)) return;
    try {
      const res = await ptmTemplateApi.delete(tpl.id, loggedInCreatorName);
      if (res?.success) {
        showToast('✓ Template deleted');
        await loadTemplates(selectedPhaseKey);
      } else {
        showToast(res?.message || '❌ Failed to delete template');
      }
    } catch {
      showToast('❌ Could not delete template');
    }
  };

  const handleAddEditorRow = () => {
    setDraftRows((prev) => [...prev, createTemplateBlankRow(prev.length, selectedPhaseMeta)]);
  };

  const handleDeleteEditorRow = (index) => {
    setDraftRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ── Editor / Viewer Sub-View ──
  if (activeTemplate && editorMode) {
    const isReadOnly = editorMode === 'view' || !isAdmin;
    return (
      <div className="flex flex-col flex-1 min-h-0 h-full gap-3">
        <div className="bg-white rounded-2xl border border-[#ECEFF3] shadow-sm p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveTemplate(null);
                setEditorMode(null);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {selectedPhaseMeta.label}</span>
            </button>

            <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>{activeTemplate.phaseLabel || selectedPhaseMeta.label}</span>
            </div>

            {isReadOnly ? (
              <div className="flex items-center gap-3 text-sm font-bold text-slate-800">
                <span>{draftName}</span>
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {draftDate}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Template Name"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                exportTemplateToExcel({
                  templateName: draftName || activeTemplate.templateName,
                  phaseLabel: activeTemplate.phaseLabel || selectedPhaseMeta.label,
                  rows: draftRows,
                })
              }
              className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              title="Export template sheet to Excel"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            {!isReadOnly && (
              <>
                <input
                  ref={sheetExcelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleSheetExcelImport}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => sheetExcelInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                  title="Import Excel (.xlsx, .xls, .csv) directly into this template sheet"
                >
                  <Upload className="w-4 h-4" />
                  <span>Import Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddEditorRow}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Row</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Template'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        <PTMTemplateSheetTable
          rows={draftRows}
          onChangeRows={setDraftRows}
          readOnly={isReadOnly}
          onAddRow={handleAddEditorRow}
          isAdmin={isAdmin}
          currentUser={currentUser}
          dbEmployees={dbEmployees}
          showToast={showToast}
        />
      </div>
    );
  }

  // ── History Page View ──
  if (showHistoryView) {
    const filteredHistory = historyItems.filter((item) => {
      if (historyFilter === 'all') return true;
      return item.entityType === historyFilter;
    });

    const formatHistoryDateTime = (raw) => {
      if (!raw) return '—';
      const iso = String(raw).includes('T') ? raw : `${String(raw).replace(' ', 'T')}Z`;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(raw);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const getActionBadge = (actionType) => {
      if (actionType?.includes('CREATED')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (actionType?.includes('UPDATED')) return 'bg-blue-50 text-blue-700 border-blue-200';
      if (actionType?.includes('DELETED')) return 'bg-rose-50 text-rose-700 border-rose-200';
      if (actionType === 'TEMPLATE_APPLIED') return 'bg-purple-50 text-purple-700 border-purple-200';
      return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getActionLabel = (actionType) => {
      switch (actionType) {
        case 'PHASE_CREATED': return 'Phase Created';
        case 'PHASE_UPDATED': return 'Phase Edited';
        case 'PHASE_DELETED': return 'Phase Deleted';
        case 'TEMPLATE_CREATED': return 'Template Created';
        case 'TEMPLATE_UPDATED': return 'Template Edited';
        case 'TEMPLATE_DELETED': return 'Template Deleted';
        case 'TEMPLATE_APPLIED': return 'Added to Sheet';
        default: return actionType || 'Activity';
      }
    };

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistoryView(false)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Templates</span>
            </button>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-extrabold text-slate-900">Template &amp; Phase History</h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'phase', label: 'Phases' },
              { id: 'template', label: 'Templates' },
              { id: 'sheet', label: 'Added to Sheet' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setHistoryFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  historyFilter === f.id
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#ECEFF3] shadow-sm overflow-hidden">
          {historyLoading ? (
            <div className="p-10 text-center text-sm font-medium text-slate-500">
              Loading history...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-10 text-center text-sm font-medium text-slate-500">
              No history records found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 w-14">S.No</th>
                    <th className="py-3 px-4 whitespace-nowrap">Date &amp; Time</th>
                    <th className="py-3 px-4">User Name</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-600">{idx + 1}</td>
                      <td className="py-3 px-4 text-xs font-mono font-semibold text-slate-600 whitespace-nowrap">
                        {formatHistoryDateTime(item.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        {item.performedBy || 'Admin'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getActionBadge(item.actionType)}`}>
                          {getActionLabel(item.actionType)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {item.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase Selector + Template List View ──
  return (
    <div className="space-y-4">
      {/* Phase Pages Navigation */}
      <div className="bg-white rounded-2xl p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {phases.map((phase) => {
            const isActive = selectedPhaseKey === phase.key;
            return (
              <button
                key={phase.key}
                type="button"
                title={isAdmin ? `${phase.label} (Right-click to edit)` : phase.label}
                onClick={() => setSelectedPhaseKey(phase.key)}
                onContextMenu={(e) => handlePhaseContextMenu(e, phase)}
                className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${isActive
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {phase.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowHistoryView(true);
              loadHistory();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer shrink-0"
          >
            <History className="w-4 h-4 text-blue-600" />
            <span>History</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAddPhaseModal}
              className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Phase</span>
            </button>
          )}
        </div>
      </div>

      {/* Templates Table for Selected Phase */}
      <div className="bg-white rounded-2xl border border-[#ECEFF3] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              {selectedPhaseMeta.label}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-slate-500">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'}
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white hover:bg-blue-700 shadow-sm cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Template</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm font-medium text-slate-500">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="p-10 text-center text-sm font-medium text-slate-500">
            No templates found for <strong>{selectedPhaseMeta.label}</strong>.
            {isAdmin && ' Click "Add Template" to create one.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-14">S.No</th>
                  <th className="py-3 px-4">Template Name</th>
                  <th className="py-3 px-4">Phase</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Rows</th>
                  <th className="py-3 px-4">Creator</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((tpl, index) => (
                  <tr
                    key={tpl.id}
                    onContextMenu={(e) => handleTemplateContextMenu(e, tpl)}
                    title={isAdmin ? 'Right-click to edit Template Name or Phase' : ''}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-600">{index + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{tpl.templateName}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{tpl.phaseLabel}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium">{tpl.templateDate}</td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">
                      {Array.isArray(tpl.rows) ? tpl.rows.length : 0}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {tpl.createdBy || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenTemplate(tpl, 'view')}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>View</span>
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenTemplate(tpl, 'edit')}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Template Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Frozen Phase Name Header */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Phase (Frozen / Read-Only)
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedPhaseMeta.label}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={newTemplateDate}
                  onChange={(e) => setNewTemplateDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {importedRows.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  <span className="truncate">
                    ✓ {importedRows.length} rows ready from <strong>{importedFileName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImportedRows([]);
                      setImportedFileName('');
                    }}
                    className="ml-2 text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <div>
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => excelInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                    title="Import template rows from Excel (.xlsx, .xls, .csv)"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Import Excel</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                  >
                    {saving ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Phase Modal */}
      {isAddPhaseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">Add New Phase</h3>
              <button
                type="button"
                onClick={() => setIsAddPhaseModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePhase} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Phase Title / Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newPhaseLabel}
                  onChange={(e) => setNewPhaseLabel(e.target.value)}
                  placeholder="e.g. 6: Custom Phase"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Creator
                </label>
                <input
                  type="text"
                  readOnly
                  value={loggedInCreatorName}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Created When
                </label>
                <input
                  type="date"
                  value={newPhaseCreatedDate}
                  onChange={(e) => setNewPhaseCreatedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPhaseModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={phaseSaving}
                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {phaseSaving ? 'Creating...' : 'Create Phase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Phase Popup (Right-Click) */}
      {editingPhase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">Edit Phase</h3>
              <button
                type="button"
                onClick={() => setEditingPhase(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePhase} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Phase Title / Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editPhaseLabel}
                  onChange={(e) => setEditPhaseLabel(e.target.value)}
                  placeholder="e.g. 1: Plan & Define"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Creator
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingPhase.createdBy || '—'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Created When
                </label>
                <input
                  type="date"
                  value={editPhaseCreatedDate}
                  onChange={(e) => setEditPhaseCreatedDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeletePhase(editingPhase)}
                  disabled={phaseSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove Phase</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPhase(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={phaseSaving}
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                  >
                    {phaseSaving ? 'Saving...' : 'Save Phase'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Centered Confirm Delete Phase Alert */}
      {confirmDeletePhase && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label="Confirm phase deletion"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-5 text-center space-y-4">
            <div className="mx-auto w-11 h-11 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">
                Delete Phase
              </h3>
              <p className="text-sm text-slate-600">
                Sure want to delete the Phase{' '}
                <strong className="text-slate-900">
                  {confirmDeletePhase.pageName} ({confirmDeletePhase.label})
                </strong>
                ? Please confirm.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeletePhase(null)}
                disabled={phaseSaving}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePhase}
                disabled={phaseSaving}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
              >
                {phaseSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Name / Phase Popup (Right-Click on Template Row) */}
      {editingTemplateMeta && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">Edit Template Details</h3>
              <button
                type="button"
                onClick={() => setEditingTemplateMeta(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateTemplateMeta} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTemplateMetaName}
                  onChange={(e) => setEditTemplateMetaName(e.target.value)}
                  placeholder="Enter template name..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Phase <span className="text-red-500">*</span>
                </label>
                <select
                  value={editTemplateMetaPhaseKey}
                  onChange={(e) => setEditTemplateMetaPhaseKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  {phases.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTemplateMeta(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
