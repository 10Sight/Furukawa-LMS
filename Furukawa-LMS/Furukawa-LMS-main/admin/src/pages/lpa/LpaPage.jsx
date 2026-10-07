import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Upload, Save, ArrowLeft, ZoomIn, ZoomOut, Repeat, Trash2, Search, Download, ChevronDown } from 'lucide-react';
import { listLPAWorkbooks, createLPAWorkbook, saveLPAWorkbook, deleteLPAWorkbook } from './lpaStore';
import { confirmFormDeletion } from '@components/shared/confirmFormDeletion';
import FmeDashboardPage from '@components/shared/FmeDashboardPage';
import { columnName, editLPACell, getLPAPDCASource, importLPAWorkbook } from './lpaWorkbook';
import AssemblySheet from '../../components/lpa/AssemblySheet';
import { isAssemblyCheckSheet } from '../../components/lpa/assemblySheetUtils';
import CcSheet from '../../components/lpa/CcSheet';
import assemblyTemplate from './assemblyTemplate.json';
import { ccTemplate, isCcCheckSheet, upgradeCcTemplateRecord } from './ccTemplate';

const SECTIONS = [{ id: 'assembly', label: 'Assembly' }, { id: 'cc', label: 'C&C' }];
const UNITS = ['Bawal', 'Gujrat'];
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = button.replace('border-slate-200', 'border-blue-600').replace('bg-white', 'bg-blue-600').replace('text-slate-700', 'text-white').replace('hover:bg-slate-50', 'hover:bg-blue-700');
const errorText = error => error.message || 'Could not save LPA data. Your edits have been retained.';

export default function LpaPage({ viewContext }) {
  const outlet = useOutletContext();
  const layout = viewContext || outlet;
  const { setIsFormView } = layout;
  const userId = useSelector(state => state.auth.user?.id || state.auth.user?._id || 'current');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [pdcaSource, setPdcaSource] = useState(null);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [activeSection, setActiveSection] = useState('assembly');
  const [searchQuery, setSearchQuery] = useState('');
  const uploadSection = useRef('assembly');
  const fileInput = useRef(null);
  const requestInFlight = useRef(false);
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
    setIsFormView(Boolean(editor));
    return () => setIsFormView(false);
  }, [Boolean(editor), setIsFormView]);
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
    if (!selectedUnit) { setMessage({ error: true, text: 'Please select a unit before uploading a workbook.' }); return; }
    if (workbook.unit && workbook.unit !== selectedUnit) { setMessage({ error: true, text: `Select ${workbook.unit} to retry this workbook upload.` }); return; }
    workbook = { ...workbook, unit: workbook.unit || selectedUnit };
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
      if (!selectedUnit) throw new Error('Please select a unit before uploading a workbook.');
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Please upload an .xlsx or .xls Excel file.');
      if (file.size > 20 * 1024 * 1024) throw new Error('The Excel file must be smaller than 20 MB.');
      const imported = { ...importLPAWorkbook(await file.arrayBuffer(), file.name, uploadSection.current), unit: selectedUnit };
      await upload(imported);
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
  };
  const sheet = editor?.sheets?.[sheetIndex];
  const matchingCcTemplate = records.find(record => record.section === 'cc' && record.unit === selectedUnit && record.name === ccTemplate.name);
  const displayRecords = !selectedUnit ? [] : activeSection === 'assembly'
    ? (records.some(record => record.section === 'assembly') ? records : [...records, { ...assemblyTemplate, unit: 'Bawal' }])
    : matchingCcTemplate
      ? records.map(record => record === matchingCcTemplate ? upgradeCcTemplateRecord(record) : record)
      : [...records, { ...ccTemplate, unit: selectedUnit }];
  const visibleRecords = displayRecords.filter(record => record.unit === selectedUnit && record.section === activeSection && `${record.name} ${record.sheets.map(item => item.name).join(' ')}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const exportAllRecords = () => {
    const rows = records.flatMap(record => record.sheets.map(current => ({
      Unit: record.unit || 'Bawal', Section: record.section === 'assembly' ? 'Assembly' : 'C&C',
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
  const changeCell = (rowIndex, columnIndex, value) => {
    setEditor(previous => ({ ...previous, sheets: previous.sheets.map((current, index) => index !== sheetIndex ? current : {
      ...current, rows: current.rows.map((row, r) => r !== rowIndex ? row : Array.from({ length: current.columnCount }, (_, c) => c === columnIndex ? editLPACell(row[c], value) : row[c] || null)),
    }) }));
    setDirty(true);
  };
  const status = message && <p role={message.error ? 'alert' : 'status'} className={`text-xs ${message.error ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</p>;

  if (pdcaSource) return <div className="space-y-3">
    {!layout.isFormView && <button type="button" onClick={() => { setPdcaSource(null); setIsFormView(false); }} className={button}><ArrowLeft size={16} />Back to LPA</button>}
    <FmeDashboardPage page="pdca" lpaSource={pdcaSource} viewContext={layout} />
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

  return <div className="min-h-[calc(100vh-6rem)] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-slate-800">
    <div className="min-h-[68vh] p-6 space-y-6">
    <div className="flex justify-end"><button type="button" onClick={exportAllRecords} className={button}><Download size={16} />Export All Records</button></div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <label className="relative inline-flex items-center"><select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value)} className={`${button} appearance-none pr-9`} aria-label="Select unit"><option value="">Select unit</option>{UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3" /></label>
    </div>
    <div className="inline-flex flex-wrap gap-1 rounded-2xl bg-white p-2 shadow-sm" role="tablist" aria-label="LPA sections">{SECTIONS.map(section => <button key={section.id} type="button" role="tab" aria-selected={activeSection === section.id} onClick={() => setActiveSection(section.id)} className={`rounded-xl px-6 py-3 text-sm font-semibold ${activeSection === section.id ? 'border border-slate-200 bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{section.label}</button>)}</div>
    {status}
    {pendingUpload && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span>{pendingUpload.name} has not been saved.</span><button type="button" disabled={busy || !selectedUnit || (pendingUpload.unit && pendingUpload.unit !== selectedUnit)} onClick={() => upload(pendingUpload)} className={button}>Retry Upload</button></div>}
    <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={selectFile} className="hidden" aria-label="Upload LPA Excel" />
    {loading ? <p role="status" className="text-sm text-slate-500">Loading saved LPA workbooks…</p> : <section className="rounded-2xl bg-white p-4 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3"><label className="relative min-w-[240px] flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search by form or worksheet name…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400" /></label><button type="button" onClick={exportAllRecords} className={button}><Download size={16} />Export Excel</button><button type="button" disabled={busy || !selectedUnit} onClick={() => { uploadSection.current = activeSection; fileInput.current?.click(); }} className={primary}><Upload size={16} />Upload Excel</button><button type="button" disabled={!selectedUnit} onClick={() => setPdcaSource({ category: activeSection, workbookId: null, worksheet: '' })} className={button}><Repeat size={16} />PDCA</button></div>
      {!selectedUnit && <p className="p-8 text-center text-sm text-slate-500">Select a unit to view its LPA forms.</p>}
      <div className={`overflow-x-auto ${!selectedUnit ? 'hidden' : ''}`}><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">S.No</th><th className="px-4 py-3 text-left">Form</th><th className="px-4 py-3 text-left">Worksheet</th><th className="px-4 py-3 text-left">Unit</th><th className="px-4 py-3 text-left">Rows</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRecords.flatMap((record, recordIndex) => record.sheets.map((current, index) => <tr key={`${record.id || 'template'}-${index}`} className="hover:bg-slate-50"><td className="px-4 py-4 text-slate-500">{recordIndex + 1}</td><td className="px-4 py-4 font-semibold text-blue-700">{record.name}</td><td className="px-4 py-4">{current.name}</td><td className="px-4 py-4">{record.unit || 'Bawal'}</td><td className="px-4 py-4">{current.rows.length}</td><td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openSheet(record, index)} className={button}>Open</button><button type="button" onClick={() => setPdcaSource(getLPAPDCASource(record, index))} className={button}><Repeat size={15} />PDCA</button>{record.id && <button type="button" disabled={busy} onClick={() => deleteWorkbook(record)} className={`${button} border-red-200 text-red-700 hover:bg-red-50`} title="Delete form"><Trash2 size={15} /></button>}</div></td></tr>))}</tbody></table>{selectedUnit && visibleRecords.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No {activeSection === 'assembly' ? 'Assembly' : 'C&C'} forms for {selectedUnit}. Upload an Excel workbook to get started.</p>}</div>
      <p className="text-xs text-slate-500">Supports .xlsx and .xls. Uploaded forms are saved separately.</p>
    </section>}
    {!loading && message?.error && <button type="button" onClick={load} className={button}>Reload Saved Workbooks</button>}
    </div>
  </div>;
}
