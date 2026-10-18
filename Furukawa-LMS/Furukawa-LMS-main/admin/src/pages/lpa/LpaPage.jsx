import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Upload, Save, ArrowLeft, ZoomIn, ZoomOut, Trash2, Search, Download, ChevronDown, CalendarDays, ClipboardList, AlertTriangle, Plus, Eye } from 'lucide-react';
import { listLPAWorkbooks, createLPAWorkbook, saveLPAWorkbook, deleteLPAWorkbook } from './lpaStore';
import { confirmFormDeletion } from '@components/shared/confirmFormDeletion';
import { columnName, editLPACell, importLPAWorkbook, extractWorkbookMetadata } from './lpaWorkbook';
import AssemblySheet from '../../components/lpa/AssemblySheet';
import { isAssemblyCheckSheet, upgradeAssemblyRecord, createBlankAssemblySheet } from '../../components/lpa/assemblySheetUtils';
import CcSheet from '../../components/lpa/CcSheet';
import assemblyTemplate from './assemblyTemplate.json';
import { ccTemplate, isCcCheckSheet, upgradeCcTemplateRecord, createBlankCcSheet } from './ccTemplate';
import PDCASheet from '../../components/pdca/PDCASheet';
import AddPDCAModal from '../../components/pdca/AddPDCAModal';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import { PDCAProvider } from '../pdca/context/PDCAContext';
import { getLpaPdcaTopic, saveLpaPdcaSnapshot, extractObservationsFromSheet, createEmptyPdcaRow, getWorksheetScore } from './lpaPdcaUtils';

const SECTIONS = [{ id: 'assembly', label: 'Assembly' }, { id: 'cc', label: 'C&C' }];
const UNITS = ['Bawal', 'Gujrat'];
const LEVELS = ['L1', 'L2', 'L3'];
const todayIso = new Date().toISOString().slice(0, 10);
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = button.replace('border-slate-200', 'border-blue-600').replace('bg-white', 'bg-blue-600').replace('text-slate-700', 'text-white').replace('hover:bg-slate-50', 'hover:bg-blue-700');
const errorText = error => error.message || 'Could not save LPA data. Your edits have been retained.';

function LpaPageContent({ viewContext }) {
  const outlet = useOutletContext();
  const layout = viewContext || outlet || {};
  const { setIsFormView = () => {} } = layout;
  const userId = useSelector(state => state.auth.user?.id || state.auth.user?._id || 'current');
  const { handleAddPDCA, handleUpdatePDCA, showToast, refreshData } = usePDCA();
  const [pdcaModalMode, setPdcaModalMode] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('Bawal');
  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [pdcaDate, setPdcaDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeSection, setActiveSection] = useState('assembly');
  const [activeSubTab, setActiveSubTab] = useState('lpa');
  const [customPdcaTopic, setCustomPdcaTopic] = useState(null);
  const [isPdcaSheetOpen, setIsPdcaSheetOpen] = useState(false);
  const [pdcaSaveVersion, setPdcaSaveVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const showUnsavedAlertRef = useRef(false);
  showUnsavedAlertRef.current = showUnsavedAlert;
  const initialSnapshotRef = useRef(null);
  const uploadSection = useRef('assembly');
  const fileInput = useRef(null);
  const requestInFlight = useRef(false);
  const seededSampleScopes = useRef(new Set());
  const dirtyRef = useRef(false);

  const hasUnsavedChanges = useCallback(() => {
    if (!dirty || !editor) return false;
    if (!initialSnapshotRef.current) return true;
    try {
      return JSON.stringify(editor) !== initialSnapshotRef.current;
    } catch {
      return true;
    }
  }, [dirty, editor]);

  dirtyRef.current = hasUnsavedChanges() || Boolean(pendingUpload) || busy;
  const draftKey = useCallback(id => `lpa_draft_${userId}_${id}`, [userId]);
  const uploadDraftKey = `lpa_upload_draft_${userId}`;

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(uploadDraftKey) || 'null');
      if (draft && ['assembly', 'cc'].includes(draft.section) && Array.isArray(draft.sheets)) setPendingUpload(draft);
    } catch { /* Invalid recovery caches never replace saved workbooks. */ }
  }, [uploadDraftKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allWorkbooks = await listLPAWorkbooks(userId);
      const realWorkbooks = (allWorkbooks || []).filter(w => !w.sampleData);
      setRecords(realWorkbooks);
      setMessage(null);
    } catch (error) {
      setMessage({ error: true, text: errorText(error) });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const isEditorOpen = Boolean(editor);
  const isPdcaFormOpen = Boolean(customPdcaTopic) || isPdcaSheetOpen;
  const isFormViewActive = isEditorOpen || isPdcaFormOpen;
  useEffect(() => {
    setIsFormView(isFormViewActive);
    return () => setIsFormView(false);
  }, [isFormViewActive, setIsFormView]);
  useEffect(() => {
    const warn = event => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    if (!editor || !dirty) return;
    try { localStorage.setItem(draftKey(editor.id), JSON.stringify(editor)); }
    catch { /* The live editor is retained; Back still requires a successful save. */ }
  }, [editor, dirty, draftKey]);

  const openSheet = async (recordInput, index) => {
    let record = recordInput?.section === 'assembly' ? upgradeAssemblyRecord(recordInput) : recordInput;
    const needsTemplateUpgrade = Boolean(record._needsTemplateUpgrade);
    if (needsTemplateUpgrade) {
      record = { ...record };
      delete record._needsTemplateUpgrade;
    }
    if (!record.id) {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      setBusy(true);
      try {
        const saved = await createLPAWorkbook(userId, record);
        setRecords(previous => [saved, ...previous]);
        record = saved;
      } catch (error) { setMessage({ error: true, text: errorText(error) }); return; }
      finally { requestInFlight.current = false; setBusy(false); }
    }
    setDirty(false);
    let next = structuredClone(record);
    try {
      const raw = localStorage.getItem(draftKey(record.id));
      if (raw && window.confirm('An unsaved draft exists for this workbook. Recover it?')) {
        const draftRecord = upgradeCcTemplateRecord(JSON.parse(raw));
        const draft = { ...draftRecord };
        delete draft._needsTemplateUpgrade;
        if (draft.id === record.id && draft.section === record.section && Array.isArray(draft.sheets)) {
          if (draft.version !== record.version) {
            setMessage({ error: true, text: 'The saved workbook changed after this draft. The draft is retained locally; open the latest saved workbook before applying your edits.' });
            setDirty(false);
          } else { next = draft; setDirty(true); }
        }
      } else setDirty(needsTemplateUpgrade);
    } catch { setDirty(needsTemplateUpgrade); }
    setSheetIndex(index);
    setZoom(150);
    setEditor(next);
    initialSnapshotRef.current = JSON.stringify(next);
  };
  const authUser = useSelector(state => state.auth?.user);
  const isAdmin = Boolean(
    authUser?.isAdmin ||
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'SUPERADMIN' ||
    authUser?.role === 'superadmin' ||
    authUser?.role === 'admin'
  );

  const updateSheetMetadata = useCallback((metadata) => {
    setEditor(previous => {
      if (!previous) return previous;
      const updatedSheets = previous.sheets.map((s, idx) => {
        if (idx !== sheetIndex) return s;
        const nextRows = [...s.rows];
        if (nextRows[0] && Array.isArray(nextRows[0])) {
          const row0 = [...nextRows[0]];
          if (metadata.date || metadata.shift) {
            const d = metadata.date || s.date || previous.auditDate || '';
            const sh = metadata.shift || s.shift || '';
            row0[0] = { ...row0[0], value: `Date: ${d} | Shift: ${sh}`, formatted: `Date: ${d} | Shift: ${sh}`, type: 's' };
          }
          if (metadata.auditors || metadata.department || metadata.sectionName || metadata.line) {
            const aud = (metadata.auditors || s.auditors || []).filter(Boolean).join(', ');
            const dept = metadata.department || s.department || '';
            const sec = metadata.sectionName || s.sectionName || '';
            const ln = metadata.line || s.line || '';
            row0[5] = { ...row0[5], value: `Auditor: ${aud} | Dept: ${dept}${sec ? ' | Sec: ' + sec : ''}${ln ? ' | Line: ' + ln : ''}`, formatted: `Auditor: ${aud} | Dept: ${dept}${sec ? ' | Sec: ' + sec : ''}${ln ? ' | Line: ' + ln : ''}`, type: 's' };
          }
          nextRows[0] = row0;
        }
        return {
          ...s,
          ...metadata,
          rows: nextRows
        };
      });
      return {
        ...previous,
        ...metadata,
        sheets: updatedSheets
      };
    });
    setDirty(true);
  }, [sheetIndex]);

  const saveEditor = async () => {
    if (!editor || requestInFlight.current) return false;

    // Mandatory validation for Assembly check sheet: Date, Shift, Department
    if (editor.section === 'assembly' && isAssemblyCheckSheet(sheet)) {
      const formDate = sheet?.date || editor?.date || editor?.auditDate;
      const formShift = sheet?.shift || editor?.shift;
      const formDept = sheet?.department || editor?.department;

      if (!formDate) {
        setMessage({ error: true, text: 'Date is mandatory. Please select an audit date.' });
        return false;
      }
      if (!formShift) {
        setMessage({ error: true, text: 'Shift is mandatory. Please select a shift (A, B, C, or G).' });
        return false;
      }
      if (!formDept) {
        setMessage({ error: true, text: 'Department is mandatory. Please select a department.' });
        return false;
      }
    }

    requestInFlight.current = true;
    setBusy(true);
    try {
      const saved = await saveLPAWorkbook(userId, editor);
      setRecords(previous => previous.map(record => record.id === saved.id ? saved : record));
      setEditor(saved);
      setDirty(false);
      initialSnapshotRef.current = JSON.stringify(saved);
      try { localStorage.removeItem(draftKey(saved.id)); } catch { /* Browser storage save already succeeded. */ }
      setMessage({ text: 'LPA changes saved successfully.' });
      return true;
    } catch (error) { setMessage({ error: true, text: errorText(error) }); return false; }
    finally { requestInFlight.current = false; setBusy(false); }
  };
  const deleteWorkbook = async record => {
    if (!record.id || requestInFlight.current || !confirmFormDeletion(`${record.name} and all its saved worksheets`)) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      await deleteLPAWorkbook(userId, record.id);
      setRecords(previous => previous.filter(item => item.id !== record.id));
      try { localStorage.removeItem(draftKey(record.id)); } catch { /* The saved workbook has already been removed. */ }
      if (editor?.id === record.id) { setEditor(null); setDirty(false); }
      setMessage({ text: `${record.name} was deleted.` });
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
    finally { requestInFlight.current = false; setBusy(false); }
  };
  const discardAndExit = useCallback(() => {
    setShowUnsavedAlert(false);
    if (editor?.id) {
      try { localStorage.removeItem(draftKey(editor.id)); } catch { /* Cleaned up local draft */ }
    }
    setEditor(null);
    setDirty(false);
    initialSnapshotRef.current = null;
  }, [editor?.id, draftKey]);

  const handleStayOnPage = useCallback(() => {
    setShowUnsavedAlert(false);
  }, []);

  const handleBack = useCallback(() => {
    if (busy) return;
    if (hasUnsavedChanges()) {
      setShowUnsavedAlert(true);
      return;
    }
    discardAndExit();
  }, [busy, hasUnsavedChanges, discardAndExit]);

  // Handle browser Back button popstate
  useEffect(() => {
    if (!editor) return;
    window.history.pushState({ lpaEditor: true }, '');
    const handlePopState = () => {
      if (hasUnsavedChanges()) {
        window.history.pushState({ lpaEditor: true }, '');
        if (!showUnsavedAlertRef.current) {
          setShowUnsavedAlert(true);
        }
      } else {
        discardAndExit();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [Boolean(editor), hasUnsavedChanges, discardAndExit]);
  const upload = async workbook => {
    if (!selectedUnit) { setMessage({ error: true, text: 'Please select Unit before uploading a workbook.' }); return; }
    if (workbook.unit && workbook.unit !== selectedUnit) { setMessage({ error: true, text: `Select ${workbook.unit} to retry this workbook upload.` }); return; }
    workbook = { ...workbook, unit: workbook.unit || selectedUnit, level: workbook.level || 'L1' };
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setPendingUpload(workbook);
    try { localStorage.setItem(uploadDraftKey, JSON.stringify(workbook)); } catch { /* Retain the original file and in-memory retry data. */ }
    try {
      const saved = await createLPAWorkbook(userId, workbook);
      setRecords(previous => [saved, ...previous]);
      setPendingUpload(null);
      try { localStorage.removeItem(uploadDraftKey); } catch { /* Browser storage save already succeeded. */ }
      setDirty(false);
      setEditor(saved);
      setSheetIndex(0);
      setZoom(150);
      setMessage({ text: 'Excel uploaded and saved. Existing workbooks were preserved.' });
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
    finally { requestInFlight.current = false; setBusy(false); }
  };
  const selectFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (!isAdmin) throw new Error('Only administrators are authorized to upload Excel workbooks.');
      if (!selectedUnit) throw new Error('Please select Unit before uploading a workbook.');
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Please upload an .xlsx or .xls Excel file.');
      if (file.size > 15 * 1024 * 1024) throw new Error('The Excel file must be smaller than 15 MB.');
      let imported = { ...importLPAWorkbook(await file.arrayBuffer(), file.name, uploadSection.current), unit: selectedUnit, level: 'L1', auditDate: pdcaDate };
      if (uploadSection.current === 'assembly') {
        imported = upgradeAssemblyRecord(imported);
      }
      imported = extractWorkbookMetadata(imported, pdcaDate);
      await upload(imported);
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
  };

  const handleCreateLPA = async () => {
    if (!selectedUnit) {
      setMessage({ error: true, text: 'Please select Unit before creating an LPA check sheet.' });
      return;
    }

    const isAssembly = activeSection === 'assembly';
    const baseTpl = isAssembly ? assemblyTemplate : ccTemplate;
    const blankSheets = isAssembly
      ? baseTpl.sheets.map(s => createBlankAssemblySheet(s, pdcaDate))
      : baseTpl.sheets.map(s => createBlankCcSheet(s, pdcaDate));

    const newRecord = {
      section: activeSection,
      name: `${isAssembly ? 'Assembly LPA Check Sheet' : 'C&C LPA Check Sheet'} · ${pdcaDate}`,
      unit: selectedUnit,
      level: selectedLevel || 'L1',
      auditDate: pdcaDate,
      date: pdcaDate,
      shift: '',
      department: isAssembly ? '' : 'C&C',
      sectionName: '',
      line: '',
      auditors: [''],
      auditor: '',
      sheets: blankSheets
    };

    await openSheet(newRecord, 0);
  };

  const blankAssemblyTemplate = useMemo(() => ({
    ...assemblyTemplate,
    sheets: assemblyTemplate.sheets.map(s => createBlankAssemblySheet(s, pdcaDate))
  }), [pdcaDate]);

  const blankCcTemplate = useMemo(() => ({
    ...ccTemplate,
    sheets: ccTemplate.sheets.map(s => createBlankCcSheet(s, pdcaDate))
  }), [pdcaDate]);

  const sheet = editor?.sheets?.[sheetIndex];
  const scopedRecords = records.filter(record => record.unit === selectedUnit);
  const matchingCcTemplate = scopedRecords.find(record => record.section === 'cc' && record.name === ccTemplate.name);
  const sectionRecords = scopedRecords.filter(record => record.section === activeSection);
  const displayRecords = !selectedUnit ? [] : activeSection === 'assembly'
    ? (sectionRecords.length ? sectionRecords.map(upgradeAssemblyRecord) : [...sectionRecords, { ...blankAssemblyTemplate, unit: selectedUnit, level: 'L1' }])
    : matchingCcTemplate
      ? sectionRecords.map(record => record === matchingCcTemplate ? upgradeCcTemplateRecord(record) : record)
      : [...sectionRecords, { ...blankCcTemplate, unit: selectedUnit, level: 'L1' }];
  const baseVisibleRecords = displayRecords.filter(record => record.unit === selectedUnit && record.section === activeSection && (!record.auditDate || record.auditDate === pdcaDate) && `${record.name} ${record.sheets.map(item => item.name).join(' ')}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const visibleRecords = baseVisibleRecords.length > 0 ? baseVisibleRecords : (
    !selectedUnit ? [] : [
      activeSection === 'assembly'
        ? { ...blankAssemblyTemplate, unit: selectedUnit, level: 'L1', auditDate: pdcaDate, name: `${assemblyTemplate.name.replace(/\.[^/.]+$/, '')} · ${pdcaDate}` }
        : { ...blankCcTemplate, unit: selectedUnit, level: 'L1', auditDate: pdcaDate, name: `${ccTemplate.name} · ${pdcaDate}` }
    ]
  );
  const exportAllRecords = () => {
    const rows = records.flatMap(record => record.sheets.map(current => ({
      Unit: record.unit || 'Bawal', Level: record.level || 'L1', Section: record.section === 'assembly' ? 'Assembly' : 'C&C',
      Form: record.name, Worksheet: current.name, Rows: current.rows.length,
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'LPA Records');
    XLSX.writeFile(book, 'LPA_All_Records.xlsx');
  };
  const mergeMap = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    for (const merge of sheet?.merges || []) {
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r !== merge.s.r || c !== merge.s.c) hidden.add(`${r}:${c}`);
      }
    }
    return { anchors, hidden };
  }, [sheet?.merges]);
  const changeCell = (rowIndex, columnIndex, value, extraUpdates = []) => {
    setEditor(previous => ({ ...previous, sheets: previous.sheets.map((current, index) => index !== sheetIndex ? current : {
      ...current, rows: (() => {
        let newRows = [...current.rows];
        const allUpdates = [{ rowIndex, columnIndex, value }, ...(extraUpdates || [])];
        for (const upd of allUpdates) {
          const r = upd.rowIndex ?? upd.r;
          const c = upd.columnIndex ?? upd.c;
          const v = upd.value ?? upd.val;
          if (newRows[r]) {
            newRows[r] = Array.from({ length: current.columnCount }, (_, ci) => ci === c ? editLPACell(newRows[r][ci], v) : newRows[r][ci] || null);
          }
        }
        return newRows;
      })()
    }) }));
    setDirty(true);
  };
  const status = message && <p role={message.error ? 'alert' : 'status'} className={`text-xs ${message.error ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</p>;

  const pdcaTopic = useMemo(() => {
    if (customPdcaTopic) return customPdcaTopic;
    if (!selectedUnit) return null;
    return getLpaPdcaTopic({
      section: activeSection,
      unit: selectedUnit,
      level: 'L1',
      date: pdcaDate,
      records,
      templates: { assemblyTemplate, ccTemplate }
    });
  }, [customPdcaTopic, activeSection, selectedUnit, pdcaDate, records, pdcaSaveVersion]);

  const handleBackFromPDCA = () => {
    setCustomPdcaTopic(null);
    setIsPdcaSheetOpen(false);
    setIsFormView(false);
  };

  const handleOpenPdcaRecord = (row) => {
    setCustomPdcaTopic(row);
  };

  const handleEditPdcaRecord = (row) => {
    setPdcaModalMode(row);
  };

  const handleCreateNewPdca = () => {
    setPdcaModalMode('add');
  };

  const handleSaveNewPdca = (newRecord) => {
    const recordToSave = {
      ...newRecord,
      category: activeSection,
      lpaCategory: activeSection,
      department: newRecord.department || (activeSection === 'assembly' ? 'Assembly' : 'C&C'),
      lpaSource: {
        category: activeSection,
        unit: selectedUnit,
        date: pdcaDate
      }
    };
    handleAddPDCA(recordToSave);
    setPdcaModalMode(null);
    showToast?.('✓ PDCA record created successfully');
    refreshData?.();
  };

  const handleUpdatePdca = (updatedRecord) => {
    handleUpdatePDCA(updatedRecord);
    setPdcaModalMode(null);
    showToast?.('✓ PDCA record updated successfully');
    refreshData?.();
  };

  const handleSavePDCA = (sheetSnapshot) => {
    if (!pdcaTopic?.id) return;
    saveLpaPdcaSnapshot(pdcaTopic.id, sheetSnapshot);
    if (customPdcaTopic) {
      setCustomPdcaTopic(prev => prev ? { ...prev, sheet: sheetSnapshot } : null);
    }
    setPdcaSaveVersion(v => v + 1);
    setMessage({ text: 'PDCA form saved successfully.' });
  };

  const openRecordPDCA = (record, worksheetIndex) => {
    const baseTopic = getLpaPdcaTopic({
      section: record.section || activeSection,
      unit: record.unit || selectedUnit,
      level: record.level || selectedLevel,
      date: record.auditDate || pdcaDate,
      records: [record],
      templates: { assemblyTemplate, ccTemplate }
    });
    const recordTopicId = `PDCA-LPA-REC-${record.id || 'tpl'}-${worksheetIndex}-${record.auditDate || pdcaDate}`;
    let loadedSheet = baseTopic.sheet;
    try {
      const saved = localStorage.getItem(`lpa_pdca_saved_${recordTopicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.rows) loadedSheet = parsed;
      }
    } catch {}
    setCustomPdcaTopic({
      id: recordTopicId,
      topic: 'PDCA - M Tanaka San Audit',
      scope: 'Company',
      plant: record.unit || selectedUnit || 'Bawal',
      sheet: loadedSheet
    });
    setActiveSubTab('pdca');
  };

  if (isPdcaFormOpen && pdcaTopic) return <div className="fixed inset-0 z-40 h-dvh w-full bg-white text-slate-800 flex flex-col overflow-auto p-2 sm:p-4">
    <PDCASheet
      key={`${pdcaTopic.id}-${pdcaDate}`}
      topic={pdcaTopic}
      onBack={handleBackFromPDCA}
      onSave={handleSavePDCA}
      currentDate={pdcaDate}
      onDateChange={setPdcaDate}
      currentUser={authUser}
      isCreator={true}
    />
  </div>;

  if (editor && sheet) return <div className="fixed inset-0 z-40 h-dvh w-full bg-white text-slate-800 flex flex-col overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 bg-white shrink-0">
      <button type="button" disabled={busy} onClick={saveEditor} className={primary}><Save size={16} />{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={busy} onClick={handleBack} className={button}><ArrowLeft size={16} />Back</button>
      <span className="text-xs text-slate-500 truncate max-w-xs">{editor.name} · {sheet.name}{dirty ? ' · Unsaved changes' : ''}</span>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => setZoom(value => Math.min(200, value + 10))} disabled={zoom >= 200} className={button} title="Zoom In"><ZoomIn size={16} /><span className="sr-only">Zoom In</span></button>
        <span className="text-xs w-10 text-center">{zoom}%</span>
        <button type="button" onClick={() => setZoom(value => Math.max(50, value - 10))} disabled={zoom <= 50} className={button} title="Zoom Out"><ZoomOut size={16} /><span className="sr-only">Zoom Out</span></button>
      </div>
      {message && <div className="w-full">{status}</div>}
    </div>
    <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
      {editor.section === 'assembly' && isAssemblyCheckSheet(sheet) ? <div style={{ zoom: `${zoom}%` }}>
        <AssemblySheet
          sheet={sheet}
          editor={editor}
          disabled={busy}
          onChange={changeCell}
          onMetadataChange={updateSheetMetadata}
          isAdmin={isAdmin}
        />
      </div> : editor.section === 'cc' && isCcCheckSheet(sheet) ? <div className="cc-form-stage">
        <div style={{ zoom: `${zoom}%` }}>
          <CcSheet sheet={sheet} disabled={busy} onChange={changeCell} />
        </div>
      </div> : <div style={{ zoom: `${zoom}%` }} className="min-w-full w-max">
        <table className="border-collapse text-xs table-fixed bg-white" aria-label={`${sheet.name} editable LPA worksheet`}>
          <colgroup><col style={{ width: 40 }} />{Array.from({ length: sheet.columnCount }, (_, c) => <col key={c} style={{ width: Math.max(100, Math.min(380, (sheet.columns?.[c]?.wch || 20) * 7)) }} />)}</colgroup>
          <thead><tr><th className="border border-slate-300 bg-slate-100" />{Array.from({ length: sheet.columnCount }, (_, c) => <th key={c} className="border border-slate-300 bg-slate-100 p-1 sticky top-0 z-10">{columnName(c)}</th>)}</tr></thead>
          <tbody>{sheet.rows.map((row, r) => <tr key={r} style={{ height: sheet.rowSizes?.[r]?.hpt ? `${sheet.rowSizes[r].hpt}pt` : undefined }}>
            <th className="border border-slate-300 bg-slate-100 p-1 text-slate-500">{r + 1}</th>
            {Array.from({ length: sheet.columnCount }, (_, c) => {
              const key = `${r}:${c}`;
              if (mergeMap.hidden.has(key)) return null;
              const merge = mergeMap.anchors.get(key);
              const cell = row[c];
              const fill = cell?.style?.fgColor?.rgb;
              return <td key={c} rowSpan={merge ? merge.e.r - r + 1 : 1} colSpan={merge ? merge.e.c - c + 1 : 1} className="border border-slate-300 align-top p-0" style={{ backgroundColor: fill && /^[0-9A-F]{6,8}$/i.test(fill) ? `#${fill.slice(-6)}` : undefined }}>
                <textarea disabled={busy} aria-label={`${sheet.name} ${columnName(c)}${r + 1}`} value={cell?.formatted ?? String(cell?.value ?? '')} onChange={event => changeCell(r, c, event.target.value)} rows={Math.max(2, Math.min(8, String(cell?.formatted || '').split('\n').length))} title={cell?.formula ? `Imported formula: =${cell.formula}. Editing replaces this calculated value.` : undefined} className="block w-full min-h-10 h-full resize-y bg-transparent p-2 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 whitespace-pre-wrap" />
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>}
    </div>

    {/* Unsaved Changes Confirmation Modal */}
    {showUnsavedAlert && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-alert-title"
      >
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-amber-100 text-amber-600 shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 id="unsaved-alert-title" className="text-base font-semibold text-slate-900">
                Unsaved Changes
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                You have unsaved changes. Are you sure you want to go back without saving?
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleStayOnPage}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Stay on Page
            </button>
            <button
              type="button"
              onClick={discardAndExit}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-slate-800">
    <div className="p-6 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 pb-2 border-b border-slate-100">
      <div className="flex flex-col gap-3">
        {/* Unit Option */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Unit</label>
          <div className="relative inline-flex items-center">
            <select
              value={selectedUnit}
              onChange={event => setSelectedUnit(event.target.value)}
              className={`${button} min-w-[200px] appearance-none pr-9 text-left font-medium`}
              aria-label="Select unit"
            >
              <option value="">Select Unit</option>
              {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={exportAllRecords} className={button}><Download size={16} />Export All Records</button>
      </div>
    </div>
    <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={selectFile} className="hidden" aria-label="Upload LPA Excel" />
    {loading ? <p role="status" className="text-sm text-slate-500">Loading saved LPA workbooks…</p> : <section className="space-y-5">
      {status}
      {pendingUpload && selectedUnit && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span>{pendingUpload.name} has not been saved.</span><button type="button" disabled={busy || (pendingUpload.unit && pendingUpload.unit !== selectedUnit)} onClick={() => upload(pendingUpload)} className={button}>Retry Upload</button></div>}
      {!selectedUnit ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 p-8 text-center text-sm font-medium text-blue-800">
          Please select Unit to view data.
        </p>
      ) : <>
      <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full" role="tablist" aria-label="LPA pages">
        {SECTIONS.map(section => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveSection(section.id);
                setActiveSubTab('lpa');
                setCustomPdcaTopic(null);
                setIsPdcaSheetOpen(false);
              }}
              className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
              }`}
            >
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        {['assembly', 'cc'].includes(activeSection) && (
          <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full" role="tablist" aria-label={`${activeSection === 'assembly' ? 'Assembly' : 'C&C'} form views`}>
            {[
              { id: 'lpa', label: 'LPA' },
              { id: 'pdca', label: 'LPA Observation (PDCA)' }
            ].map(tab => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveSubTab(tab.id);
                    setCustomPdcaTopic(null);
                    setIsPdcaSheetOpen(false);
                  }}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {['assembly', 'cc'].includes(activeSection) && activeSubTab === 'pdca' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 bg-white">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <CalendarDays size={17} />
                  <span>Audit date</span>
                  <input
                    type="date"
                    value={pdcaDate}
                    onChange={event => setPdcaDate(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="relative min-w-[240px] flex-1 max-w-md">
                  <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search by worksheet or department…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
                  />
                </label>
              </div>
              <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                Single PDCA sheet for {activeSection === 'assembly' ? 'Assembly' : 'C&C'} · Add observations via rows inside the sheet
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#ECEFF3] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">S.NO.</th>
                    <th className="px-4 py-3 text-left">Worksheet</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">department</th>
                    <th className="px-4 py-3 text-left">Observations</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const sheetTitle = `${activeSection === 'assembly' ? 'Assembly' : 'C&C'} - LPA Observation (PDCA)`;
                    const query = searchQuery.trim().toLowerCase();
                    const matchesSearch = !query ||
                      sheetTitle.toLowerCase().includes(query) ||
                      (selectedUnit || '').toLowerCase().includes(query) ||
                      (activeSection === 'assembly' ? 'assembly' : 'c&c').includes(query);

                    if (!matchesSearch) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                            No PDCA sheets matching "{searchQuery}".
                          </td>
                        </tr>
                      );
                    }

                    const rows = pdcaTopic?.sheet?.rows || [];
                    const activeCount = rows.filter(r =>
                      Boolean(
                        r.observation?.trim() ||
                        r.lineArea?.trim() ||
                        (Array.isArray(r.lineAreas) && r.lineAreas.some(l => l?.lineArea?.trim())) ||
                        r.rootCause?.trim() ||
                        r.counterMeasure?.trim()
                      )
                    ).length;

                    return (
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 text-slate-500 font-medium">1</td>
                        <td className="px-4 py-4 font-semibold">
                          <button
                            type="button"
                            onClick={() => setIsPdcaSheetOpen(true)}
                            className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                            title={`Open ${sheetTitle}`}
                          >
                            {sheetTitle}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{selectedUnit || 'Bawal'}</td>
                        <td className="px-4 py-4 text-slate-700">{activeSection === 'assembly' ? 'Assembly' : 'C&C'}</td>
                        <td className="px-4 py-4 text-slate-700">
                          {activeCount > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {activeCount} active observation{activeCount === 1 ? '' : 's'} ({rows.length} total rows)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                              {rows.length} rows (Click to add observations)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setIsPdcaSheetOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                            title="Open PDCA Sheet"
                          >
                            <Eye size={14} /> Open
                          </button>
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <CalendarDays size={17} />
                <span>Audit date</span>
                <input
                  type="date"
                  value={pdcaDate}
                  onChange={event => setPdcaDate(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="relative min-w-[240px] flex-1">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search by form or worksheet name…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
                />
              </label>
              <button
                type="button"
                disabled={busy || !selectedUnit}
                onClick={handleCreateLPA}
                className={primary}
                title="Create a new blank LPA check sheet"
              >
                <Plus size={16} />Create LPA
              </button>
              <button type="button" onClick={exportAllRecords} className={button}>
                <Download size={16} />Export Excel
              </button>
              {isAdmin && (
                <button
                  type="button"
                  disabled={busy || !selectedUnit}
                  onClick={() => { uploadSection.current = activeSection; fileInput.current?.click(); }}
                  className={button}
                  title="Upload Excel workbook (Admin only)"
                >
                  <Upload size={16} />Upload Excel
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">S.NO.</th>
                    <th className="px-4 py-3 text-left">Worksheet</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Score</th>
                    <th className="px-4 py-3 text-left">department</th>
                    <th className="px-4 py-3 text-left">Section</th>
                    <th className="px-4 py-3 text-left">Line</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRecords.flatMap((record) => record.sheets.map((current, index) => ({ record, current, index }))).map(({ record, current, index }, rowIndex) => {
                    const unitVal = record.unit || selectedUnit || 'Bawal';
                    const scoreVal = getWorksheetScore(current);
                    const deptVal = current.department || record.department || '-';
                    const secVal = current.sectionName || current.section || record.sectionName || record.section || '-';
                    const lineVal = current.line || record.line || '-';

                    return (
                      <tr key={`${record.id || 'template'}-${index}`} className="hover:bg-slate-50">
                        <td className="px-4 py-4 text-slate-500 font-medium">{rowIndex + 1}</td>
                        <td className="px-4 py-4 font-semibold">
                          <button
                            type="button"
                            onClick={() => openSheet(record, index)}
                            className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                            title={`Open ${current.name}`}
                          >
                            {current.name}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{unitVal}</td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-800">
                            {scoreVal}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{deptVal}</td>
                        <td className="px-4 py-4 text-slate-700">{secVal}</td>
                        <td className="px-4 py-4 text-slate-700">{lineVal}</td>
                        <td className="px-4 py-4 text-right">
                          {record.id ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => deleteWorkbook(record)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors"
                              title="Delete form"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleRecords.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No {activeSection === 'assembly' ? 'Assembly' : 'C&C'} forms for {selectedUnit} on {pdcaDate}. Upload an Excel workbook to get started.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>}
    <p className="text-xs text-slate-500">Supports .xlsx and .xls. Uploaded forms are saved separately.</p>
  </section>}
  {!loading && message?.error && <button type="button" onClick={load} className={button}>Reload Saved Workbooks</button>}

  {/* Add / Edit PDCA Modal */}
  <AddPDCAModal
    isOpen={pdcaModalMode !== null}
    onClose={() => setPdcaModalMode(null)}
    defaultPlant={selectedUnit}
    defaultScope="Company"
    onAdd={handleSaveNewPdca}
    editData={pdcaModalMode !== 'add' ? pdcaModalMode : null}
    onUpdate={handleUpdatePdca}
  />
</div>
  </div>;
}

export default function LpaPage({ viewContext }) {
  return (
    <PDCAProvider>
      <LpaPageContent viewContext={viewContext} />
    </PDCAProvider>
  );
}
