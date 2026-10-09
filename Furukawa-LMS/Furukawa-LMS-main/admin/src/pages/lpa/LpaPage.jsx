import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Upload, Save, ArrowLeft, ZoomIn, ZoomOut, Trash2, Search, Download, ChevronDown, CalendarDays, ClipboardList } from 'lucide-react';
import { listLPAWorkbooks, createLPAWorkbook, saveLPAWorkbook, deleteLPAWorkbook } from './lpaStore';
import { confirmFormDeletion } from '@components/shared/confirmFormDeletion';
import { columnName, editLPACell, importLPAWorkbook } from './lpaWorkbook';
import AssemblySheet from '../../components/lpa/AssemblySheet';
import { isAssemblyCheckSheet } from '../../components/lpa/assemblySheetUtils';
import CcSheet from '../../components/lpa/CcSheet';
import assemblyTemplate from './assemblyTemplate.json';
import { ccTemplate, isCcCheckSheet, upgradeCcTemplateRecord } from './ccTemplate';
import PDCASheet from '@components/pdca/PDCASheet';
import { PDCAProvider } from '../pdca/context/PDCAContext';
import { getLpaPdcaTopic, saveLpaPdcaSnapshot, extractObservationsFromSheet, createEmptyPdcaRow } from './lpaPdcaUtils';

const SECTIONS = [{ id: 'assembly', label: 'Assembly' }, { id: 'cc', label: 'C&C' }, { id: 'pdca', label: 'All PDCA' }];
const UNITS = ['Bawal', 'Gujrat'];
const LEVELS = ['L1', 'L2', 'L3'];
const SAMPLE_DATES = ['2026-10-06', '2026-10-07', '2026-10-08'];
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = button.replace('border-slate-200', 'border-blue-600').replace('bg-white', 'bg-blue-600').replace('text-slate-700', 'text-white').replace('hover:bg-slate-50', 'hover:bg-blue-700');
const errorText = error => error.message || 'Could not save LPA data. Your edits have been retained.';

function LpaPageContent({ viewContext }) {
  const outlet = useOutletContext();
  const layout = viewContext || outlet || {};
  const { setIsFormView = () => {} } = layout;
  const userId = useSelector(state => state.auth.user?.id || state.auth.user?._id || 'current');
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
  const [searchQuery, setSearchQuery] = useState('');
  const uploadSection = useRef('assembly');
  const fileInput = useRef(null);
  const requestInFlight = useRef(false);
  const seededSampleScopes = useRef(new Set());
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty || Boolean(pendingUpload) || busy;
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
      setRecords(await listLPAWorkbooks(userId));
      setMessage(null);
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
    finally { setLoading(false); }
  }, [userId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (loading || !selectedUnit || !selectedLevel || !['assembly', 'cc'].includes(activeSection)) return;
    const scopeKey = `${userId}:${selectedUnit}:${selectedLevel}:${activeSection}`;
    if (seededSampleScopes.current.has(scopeKey)) return;
    seededSampleScopes.current.add(scopeKey);
    const sampleTemplate = activeSection === 'assembly' ? assemblyTemplate : ccTemplate;
    const missingDates = SAMPLE_DATES.filter(date => !records.some(record => record.sampleData && record.section === activeSection && record.unit === selectedUnit && (record.level || 'L1') === selectedLevel && record.auditDate === date));
    if (!missingDates.length) return;
    (async () => {
      const created = [];
      for (const date of missingDates) {
        const sample = structuredClone(sampleTemplate);
        sample.unit = selectedUnit;
        sample.level = selectedLevel;
        sample.auditDate = date;
        sample.sampleData = true;
        sample.name = `Sample ${sample.name} · ${date}`;
        const sheet = sample.sheets[0];
        const headerRow = sheet.rows.findIndex(row => row.some(cell => /^observation$/i.test(cell?.formatted ?? String(cell?.value ?? ''))));
        const observationColumn = headerRow >= 0 ? sheet.rows[headerRow].findIndex(cell => /^observation$/i.test(cell?.formatted ?? String(cell?.value ?? ''))) : -1;
        if (activeSection === 'assembly') sheet.rows[0][0] = { value: `Date/Shift- ${date}`, formatted: `Date/Shift- ${date}`, type: 's' };
        else sheet.rows[1][0] = { value: `Date :-${date}`, formatted: `Date :-${date}`, type: 's' };
        for (let rowIndex = activeSection === 'assembly' ? 3 : 4; rowIndex < Math.min(sheet.rows.length, 12); rowIndex++) {
          if (observationColumn < 0 || !sheet.rows[rowIndex]) continue;
          const value = ['O', '△', '×'][(rowIndex - (activeSection === 'assembly' ? 3 : 4)) % 3];
          sheet.rows[rowIndex][observationColumn] = { value, formatted: value, type: 's' };
        }
        try {
          const saved = await createLPAWorkbook(userId, sample);
          created.push(saved);
        } catch (error) {
          setMessage({ error: true, text: `Sample ${activeSection === 'assembly' ? 'Assembly' : 'C&C'} data could not be added: ${errorText(error)}` });
          break;
        }
      }
      if (created.length) setRecords(previous => [...created.filter(saved => !previous.some(record => record.id === saved.id)), ...previous]);
    })();
  }, [loading, selectedUnit, selectedLevel, activeSection, userId, records]);
  const isEditorOpen = Boolean(editor);
  const isPdcaFormOpen = Boolean(customPdcaTopic) || activeSection === 'pdca' || (['assembly', 'cc'].includes(activeSection) && activeSubTab === 'pdca');
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

  const openSheet = async (record, index) => {
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
  };
  const saveEditor = async () => {
    if (!editor || requestInFlight.current) return false;
    requestInFlight.current = true;
    setBusy(true);
    try {
      const saved = await saveLPAWorkbook(userId, editor);
      setRecords(previous => previous.map(record => record.id === saved.id ? saved : record));
      setEditor(saved);
      setDirty(false);
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
  const back = async () => {
    if (busy) return;
    if (dirty && !await saveEditor()) return;
    setEditor(null);
    setDirty(false);
  };
  const upload = async workbook => {
    if (!selectedUnit || !selectedLevel) { setMessage({ error: true, text: 'Please select Unit and Level before uploading a workbook.' }); return; }
    if (workbook.unit && workbook.unit !== selectedUnit) { setMessage({ error: true, text: `Select ${workbook.unit} to retry this workbook upload.` }); return; }
    if (workbook.level && workbook.level !== selectedLevel) { setMessage({ error: true, text: `Select ${workbook.level} to retry this workbook upload.` }); return; }
    workbook = { ...workbook, unit: workbook.unit || selectedUnit, level: workbook.level || selectedLevel };
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
      if (!selectedUnit || !selectedLevel) throw new Error('Please select Unit and Level before uploading a workbook.');
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Please upload an .xlsx or .xls Excel file.');
      if (file.size > 20 * 1024 * 1024) throw new Error('The Excel file must be smaller than 20 MB.');
    const imported = { ...importLPAWorkbook(await file.arrayBuffer(), file.name, uploadSection.current), unit: selectedUnit, level: selectedLevel, auditDate: pdcaDate };
      await upload(imported);
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
  };
  const sheet = editor?.sheets?.[sheetIndex];
  const scopedRecords = records.filter(record => record.unit === selectedUnit && (record.level || 'L1') === selectedLevel);
  const matchingCcTemplate = scopedRecords.find(record => record.section === 'cc' && record.name === ccTemplate.name);
  const sectionRecords = scopedRecords.filter(record => record.section === activeSection);
  const displayRecords = !selectedUnit || !selectedLevel || activeSection === 'pdca' ? [] : activeSection === 'assembly'
    ? (sectionRecords.length ? sectionRecords : [...sectionRecords, { ...assemblyTemplate, unit: selectedUnit, level: selectedLevel }])
    : matchingCcTemplate
      ? sectionRecords.map(record => record === matchingCcTemplate ? upgradeCcTemplateRecord(record) : record)
      : [...sectionRecords, { ...ccTemplate, unit: selectedUnit, level: selectedLevel }];
  const visibleRecords = displayRecords.filter(record => record.unit === selectedUnit && (record.level || 'L1') === selectedLevel && record.section === activeSection && (!record.auditDate || record.auditDate === pdcaDate) && `${record.name} ${record.sheets.map(item => item.name).join(' ')}`.toLowerCase().includes(searchQuery.toLowerCase()));
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
    if (!selectedUnit || !selectedLevel) return null;
    const targetSection = activeSection === 'pdca' ? 'all' : activeSection;
    return getLpaPdcaTopic({
      section: targetSection,
      unit: selectedUnit,
      level: selectedLevel,
      date: pdcaDate,
      records,
      templates: { assemblyTemplate, ccTemplate }
    });
  }, [customPdcaTopic, activeSection, selectedUnit, selectedLevel, pdcaDate, records]);

  const handleBackFromPDCA = () => {
    setCustomPdcaTopic(null);
    setActiveSubTab('lpa');
    if (activeSection === 'pdca') {
      setActiveSection('assembly');
    }
    setIsFormView(false);
  };

  const handleSavePDCA = (sheetSnapshot) => {
    if (!pdcaTopic?.id) return;
    saveLpaPdcaSnapshot(pdcaTopic.id, sheetSnapshot);
    setMessage({ text: 'PDCA form saved successfully.' });
  };

  const openRecordPDCA = (record, worksheetIndex) => {
    const sheet = record.sheets?.[worksheetIndex];
    const obs = extractObservationsFromSheet(sheet, record, record.auditDate || pdcaDate);
    const rows = obs.map(item => createEmptyPdcaRow({
      date: item.date || record.auditDate || pdcaDate,
      shift: item.shift || 'G',
      status: item.status || 'Open',
      lineArea: item.lineArea || '',
      observation: item.observation || '',
      department: item.department || (record.section === 'cc' ? 'Die Casting' : 'Wiring Harness')
    }));
    while (rows.length < 10) {
      rows.push(createEmptyPdcaRow({ date: record.auditDate || pdcaDate, shift: 'G', status: 'Open' }));
    }
    const recordTopicId = `PDCA-LPA-REC-${record.id || 'tpl'}-${worksheetIndex}-${record.auditDate || pdcaDate}`;
    let loadedSheet = { rows, headerInfo: { topicName: '', preparedBy: '', auditNo: '', attendees: '' } };
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
    />
  </div>;

  if (editor && sheet) return <div className="fixed inset-0 z-40 h-dvh w-full bg-white text-slate-800 flex flex-col overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 bg-white shrink-0">
      <button type="button" disabled={busy} onClick={saveEditor} className={primary}><Save size={16} />{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={busy} onClick={back} className={button}><ArrowLeft size={16} />Back</button>
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
        <AssemblySheet sheet={sheet} disabled={busy} onChange={changeCell} />
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

        {/* Levels Option - down side of unit option */}
        <div className="pt-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Levels</label>
          <div className="relative inline-flex items-center">
            <select
              value={selectedLevel}
              onChange={event => setSelectedLevel(event.target.value)}
              className={`${button} min-w-[200px] appearance-none pr-9 text-left font-medium`}
              aria-label="Select level"
            >
              <option value="">Select Level</option>
              {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
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
      {pendingUpload && selectedUnit && selectedLevel && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span>{pendingUpload.name} has not been saved.</span><button type="button" disabled={busy || (pendingUpload.unit && pendingUpload.unit !== selectedUnit) || (pendingUpload.level && pendingUpload.level !== selectedLevel)} onClick={() => upload(pendingUpload)} className={button}>Retry Upload</button></div>}
      {(!selectedUnit || !selectedLevel) ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 p-8 text-center text-sm font-medium text-blue-800">
          {!selectedUnit ? 'Please select Unit to view data.' : 'Please select Level to view data.'}
        </p>
      ) : <>
      <div className="flex flex-wrap gap-1 rounded-2xl bg-slate-50 p-2 shadow-sm" role="tablist" aria-label="LPA pages">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={activeSection === section.id}
            onClick={() => {
              setActiveSection(section.id);
              setActiveSubTab('lpa');
              setCustomPdcaTopic(null);
            }}
            className={`rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${activeSection === section.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70'}`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {['assembly', 'cc'].includes(activeSection) && (
          <div className="flex gap-1 border-b border-slate-200" role="tablist" aria-label={`${activeSection === 'assembly' ? 'Assembly' : 'C&C'} form views`}>
            {[{ id: 'lpa', label: 'LPA' }, { id: 'pdca', label: 'LPA Observation (PDCA)' }].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeSubTab === tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id);
                  setCustomPdcaTopic(null);
                }}
                className={`border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${activeSubTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

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
            <button type="button" onClick={exportAllRecords} className={button}>
              <Download size={16} />Export Excel
            </button>
            <button
              type="button"
              disabled={busy || !selectedUnit || !selectedLevel}
              onClick={() => { uploadSection.current = activeSection; fileInput.current?.click(); }}
              className={primary}
            >
              <Upload size={16} />Upload Excel
            </button>
            <button
              type="button"
              disabled={busy || !selectedUnit || !selectedLevel}
              onClick={() => {
                setActiveSubTab('pdca');
                setCustomPdcaTopic(null);
              }}
              className={button}
            >
              LPA Observation (PDCA)
            </button>
          </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">S.No</th>
                      <th className="px-4 py-3 text-left">Form</th>
                      <th className="px-4 py-3 text-left">Worksheet</th>
                      <th className="px-4 py-3 text-left">Audit date</th>
                      <th className="px-4 py-3 text-left">Unit</th>
                      <th className="px-4 py-3 text-left">Level</th>
                      <th className="px-4 py-3 text-left">Rows</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRecords.flatMap((record, recordIndex) => record.sheets.map((current, index) => (
                      <tr key={`${record.id || 'template'}-${index}`} className="hover:bg-slate-50">
                        <td className="px-4 py-4 text-slate-500">{recordIndex + 1}</td>
                        <td className="px-4 py-4 font-semibold text-blue-700">{record.name}</td>
                        <td className="px-4 py-4">{current.name}</td>
                        <td className="px-4 py-4">{record.auditDate || 'Legacy workbook'}</td>
                        <td className="px-4 py-4">{record.unit || 'Bawal'}</td>
                        <td className="px-4 py-4">{record.level || 'L1'}</td>
                        <td className="px-4 py-4">{current.rows.length}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => openSheet(record, index)} className={button}>Open</button>
                            <button type="button" onClick={() => openRecordPDCA(record, index)} className={button}>PDCA</button>
                            {record.id && (
                              <button type="button" disabled={busy} onClick={() => deleteWorkbook(record)} className={`${button} border-red-200 text-red-700 hover:bg-red-50`} title="Delete form">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
                {visibleRecords.length === 0 && (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No {activeSection === 'assembly' ? 'Assembly' : 'C&C'} forms for {selectedUnit} · {selectedLevel} on {pdcaDate}. Upload an Excel workbook to get started.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>}
        <p className="text-xs text-slate-500">Supports .xlsx and .xls. Uploaded forms are saved separately.</p>
      </section>}
      {!loading && message?.error && <button type="button" onClick={load} className={button}>Reload Saved Workbooks</button>}
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
