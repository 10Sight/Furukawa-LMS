import React, { useEffect, useState } from 'react';
import { loadWorkbook, SECTIONS, storageKey } from './lpaStore.js';
import LpaTable from '../../components/lpa/LpaTable.jsx';
import './lpa.css';

// This is a live reference, never a duplicated PDCA data store.
export default function LpaSource({ source }) {
  const [state, setState] = useState({ workbook: null, error: '' });
  useEffect(() => {
    const load = () => {
      try { setState({ workbook: loadWorkbook(source.section), error: '' }); }
      catch (e) { setState({ workbook: null, error: e.message }); }
    };
    load();
    const sync = e => { if (e.key === storageKey(source.section)) load(); };
    window.addEventListener('storage', sync); window.addEventListener('focus', load);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', load); };
  }, [source.section]);
  const sheet = state.workbook?.sheets.find(item => item.name === source.sheetName);
  return <details className="lpa-source" open>
    <summary>LPA source: {SECTIONS[source.section]} · {source.sheetName}</summary>
    {state.error ? <p role="alert" className="lpa-alert">{state.error}</p> : sheet ? <><p className="lpa-muted mt-2">{state.workbook.fileName} · Latest saved LPA data. Use these observations in the existing PDCA form below.</p><div className="lpa-preview"><LpaTable sheet={sheet} /></div></> : <p role="alert">The linked worksheet is unavailable. Re-upload it in LPA; your PDCA form is retained.</p>}
  </details>;
}
