import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, Plus, Repeat, Save, Upload } from 'lucide-react';
import { SECTIONS, editCell, ensureLinkedPDCA, loadWorkbook, parseWorkbook, saveWorkbook, storageKey } from './lpaStore.js';
import LpaTable from '../../components/lpa/LpaTable.jsx';
import './lpa.css';

const routeState = () => {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  return { section: SECTIONS[parts[0]] ? parts[0] : 'assembly', fullScreen: parts[1] === 'sheet', sheetIndex: Math.max(0, Number(parts[2]) || 0) };
};
export default function LpaApp({ onFormViewChange }) {
  const [route, setRoute] = useState(routeState);
  const [workbook, setWorkbook] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(100);
  const uploadRef = useRef(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const sheet = workbook?.sheets[route.sheetIndex] || workbook?.sheets[0];
  const isSheetView = route.fullScreen && Boolean(sheet);
  useEffect(() => {
    const change = () => setRoute(routeState());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    setError(''); setNotice(''); setDirty(false);
    try { setWorkbook(loadWorkbook(route.section)); } catch (e) { setWorkbook(null); setError(e.message); }
  }, [route.section]);
  useEffect(() => {
    onFormViewChange?.(isSheetView);
    return () => onFormViewChange?.(false);
  }, [isSheetView, onFormViewChange]);
  useEffect(() => {
    const unload = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    const sync = e => {
      if (e.key !== storageKey(route.section)) return;
      if (dirtyRef.current) { setError('This workbook changed in another tab. Your unsaved edits are retained. Reload to use the other version.'); return; }
      try { setWorkbook(loadWorkbook(route.section)); } catch (err) { setError(err.message); }
    };
    window.addEventListener('beforeunload', unload); window.addEventListener('storage', sync);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener('storage', sync); };
  }, [route.section]);
  const move = hash => { window.location.hash = hash; };
  const save = () => {
    try {
      const current = loadWorkbook(route.section);
      if (dirty && current?.updatedAt !== workbook.updatedAt) throw new Error('A newer version was saved in another tab. Your edits are retained; reload before replacing it.');
      setWorkbook(saveWorkbook(route.section, workbook)); setDirty(false); setError(''); setNotice('Saved'); return true;
    } catch (e) { setError(e.message || 'Could not save. Keep this sheet open and try again.'); return false; }
  };
  const upload = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Please select an .xls or .xlsx workbook.');
      const next = parseWorkbook(await file.arrayBuffer(), file.name);
      if (workbook && !window.confirm(`Replace the saved ${SECTIONS[route.section]} workbook with ${file.name}? Existing PDCA forms will be kept.`)) return;
      setWorkbook(saveWorkbook(route.section, next)); setDirty(false); move(`/${route.section}`); setNotice(`${file.name} imported and saved (${next.sheets.length} worksheets).`);
    } catch (e) { setError(e.message || 'This Excel file could not be read. Existing data is unchanged.'); }
    finally { setBusy(false); }
  };
  const changeSheet = update => {
    setWorkbook(previous => ({ ...previous, sheets: previous.sheets.map(item => item.name === sheet.name ? update(item) : item) }));
    setDirty(true); setNotice('Unsaved changes');
  };
  const pdca = () => {
    try {
      const id = ensureLinkedPDCA(route.section, sheet.name);
      window.parent.postMessage({ type: 'fme-cms-open-pdca', page: 'lpa', section: route.section, sheet: id }, window.location.origin);
    } catch (e) { setError(e.message); }
  };
  if (route.fullScreen && sheet) return <div className="lpa-sheet">
    <div className="lpa-sheet-toolbar">
      <button className="lpa-button" onClick={() => { if (!dirty || save()) move(`/${route.section}`); }}><ArrowLeft size={15} />Back</button>
      <button className="lpa-button" onClick={() => changeSheet(item => ({ ...item, rows: [...item.rows, item.columns.map(() => ({ value: '', text: '', type: 's' }))] }))}><Plus size={15} />Add Row</button>
      <button className="lpa-button primary" onClick={save}><Save size={15} />Save</button>
      <span className="lpa-sheet-status" role="status">{SECTIONS[route.section]} · {sheet.name} · {notice || 'Saved workbook'}</span>
      <div className="lpa-zoom" role="group" aria-label="Sheet zoom"><button className="lpa-button" aria-label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom(value => value - 10)}>−</button><span>{zoom}%</span><button className="lpa-button" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(value => value + 10)}>+</button></div>
    </div>
    {error && <div className="lpa-alert" role="alert">{error}</div>}
    <div className="lpa-sheet-scroll"><LpaTable sheet={sheet} zoom={zoom} onChange={(r, c, text) => changeSheet(item => ({ ...item, rows: item.rows.map((row, index) => index === r ? row.map((cell, column) => column === c ? editCell(cell, text) : cell) : row) }))} /></div>
  </div>;
  return <div className="lpa-page">
    <h1 className="lpa-heading">LPA</h1><p className="lpa-muted">Layered Process Audit · Assembly and C&C</p>
    <div className="lpa-tabs" role="tablist" aria-label="LPA sections">{Object.entries(SECTIONS).map(([key, label]) => <button role="tab" aria-selected={route.section === key} className={`lpa-button ${route.section === key ? 'selected' : ''}`} key={key} onClick={() => move(`/${key}`)}>{label}</button>)}</div>
    <div className="lpa-card"><h2 className="text-lg font-semibold">{SECTIONS[route.section]}</h2>
      <p className="lpa-muted">{workbook ? `${workbook.fileName} · ${workbook.sheets.length} worksheets · Saved ${new Date(workbook.updatedAt).toLocaleString()}` : 'Upload the Excel workbook to view and edit the audit sheet.'}</p>
      <div className="lpa-actions"><button className="lpa-button primary" disabled={busy || Boolean(error && !workbook)} onClick={() => uploadRef.current.click()}><Upload size={15} />{busy ? 'Importing…' : 'Upload Excel'}</button>
        <input ref={uploadRef} type="file" accept=".xls,.xlsx" aria-label={`Upload ${SECTIONS[route.section]} Excel`} onChange={upload} hidden />
        {workbook && <><select className="lpa-button" aria-label="Worksheet" value={sheet?.name || ''} onChange={e => move(`/${route.section}/overview/${workbook.sheets.findIndex(item => item.name === e.target.value)}`)}>{workbook.sheets.map(item => <option key={item.name}>{item.name}</option>)}</select>
          <button className="lpa-button" disabled={!sheet?.rows.length} onClick={() => { setZoom(100); setNotice(''); move(`/${route.section}/sheet/${route.sheetIndex}`); }}><FileSpreadsheet size={15} />Open Sheet</button>
          <button className="lpa-button" disabled={!sheet?.rows.length} onClick={pdca}><Repeat size={15} />PDCA</button></>}
      </div>
      {error && <div className="lpa-alert" role="alert">{error}</div>}{notice && <p className="lpa-success" role="status">{notice}</p>}
      {sheet && <><p className="lpa-muted mb-3">{sheet.rows.length} rows × {sheet.columns.length} columns · Open Sheet to edit in full screen.</p><div className="lpa-preview"><LpaTable sheet={sheet} /></div></>}
    </div>
    <p className="lpa-muted mt-4">Saved data is stored in this browser on this device, using the same storage as the existing PDCA forms.</p>
  </div>;
}
