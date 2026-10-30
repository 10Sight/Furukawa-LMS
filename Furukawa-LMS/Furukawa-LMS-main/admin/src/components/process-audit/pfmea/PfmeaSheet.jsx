import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import './PfmeaSheet.css';
import {
  INITIAL_PFMEA_METADATA,
  INITIAL_PFMEA_ROWS,
  INITIAL_REVISION_HISTORY,
  INITIAL_SIGN_OFF,
} from './pfmeaInitialData';

/**
 * Auto-resizing cell textarea component
 */
function CellTextarea({ value, onChange, onBlur, className = '', placeholder = '', style = {} }) {
  const textareaRef = useRef(null);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value ?? ''}
      onChange={(e) => {
        onChange?.(e.target.value);
        autoResize();
      }}
      onBlur={onBlur}
      rows={1}
      placeholder={placeholder}
      className={`pfmea-cell-textarea ${className}`}
      style={style}
    />
  );
}

export default function PfmeaSheet({ doc, onBack, showToast }) {
  const sheetId = doc?.id || 'pfmea_default';

  // Load initial state from doc or localStorage
  const loadSavedState = () => {
    try {
      const raw = localStorage.getItem(`pfmea_sheet_${sheetId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          metadata: {
            ...INITIAL_PFMEA_METADATA,
            ...(doc?.metadata || {}),
            ...(parsed.metadata || {}),
          },
          rows: Array.isArray(parsed.rows) && parsed.rows.length > 0 ? parsed.rows : (doc?.rows || INITIAL_PFMEA_ROWS),
          revisionHistory: parsed.revisionHistory || doc?.revisionHistory || INITIAL_REVISION_HISTORY,
          signOff: parsed.signOff || doc?.signOff || INITIAL_SIGN_OFF,
        };
      }
    } catch (e) {
      console.error('Error loading PFMEA sheet state', e);
    }
    return {
      metadata: {
        ...INITIAL_PFMEA_METADATA,
        ...(doc?.metadata || {}),
      },
      rows: doc?.rows || INITIAL_PFMEA_ROWS,
      revisionHistory: doc?.revisionHistory || INITIAL_REVISION_HISTORY,
      signOff: doc?.signOff || INITIAL_SIGN_OFF,
    };
  };

  const initialState = loadSavedState();
  const [metadata, setMetadata] = useState(initialState.metadata);
  const [rows, setRows] = useState(initialState.rows);
  const [revisionHistory, setRevisionHistory] = useState(initialState.revisionHistory);
  const [signOff, setSignOff] = useState(initialState.signOff);

  // Undo / Redo history stacks (tracking rows)
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Snapshot recording helper
  const pushSnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-30), // keep up to 30 steps
      {
        rows: JSON.parse(JSON.stringify(rows)),
        metadata: { ...metadata },
        revisionHistory: JSON.parse(JSON.stringify(revisionHistory)),
        signOff: JSON.parse(JSON.stringify(signOff)),
      },
    ]);
    setRedoStack([]); // clear redo on new change
  }, [rows, metadata, revisionHistory, signOff]);

  // Handle cell edit in table rows
  const handleCellChange = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  };

  // Push snapshot on blur (to keep undo clean and not per-character)
  const handleCellBlur = () => {
    pushSnapshot();
  };

  // Undo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [
      ...prev,
      {
        rows: JSON.parse(JSON.stringify(rows)),
        metadata: { ...metadata },
        revisionHistory: JSON.parse(JSON.stringify(revisionHistory)),
        signOff: JSON.parse(JSON.stringify(signOff)),
      },
    ]);
    setRows(previous.rows);
    setMetadata(previous.metadata);
    setRevisionHistory(previous.revisionHistory);
    setSignOff(previous.signOff);
  };

  // Redo
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [
      ...prev,
      {
        rows: JSON.parse(JSON.stringify(rows)),
        metadata: { ...metadata },
        revisionHistory: JSON.parse(JSON.stringify(revisionHistory)),
        signOff: JSON.parse(JSON.stringify(signOff)),
      },
    ]);
    setRows(next.rows);
    setMetadata(next.metadata);
    setRevisionHistory(next.revisionHistory);
    setSignOff(next.signOff);
  };

  // + Add Row (Requirement: adds new editable row with the same columns)
  const handleAddRow = () => {
    pushSnapshot();
    const newRow = {
      id: `row_${Date.now()}`,
      processGroup: `new-${Date.now()}`,
      issueNo: '',
      historyChange: '',
      processItem: '',
      processStep: '',
      workElement5M: 'Man (Operator)',
      functionProcessItem: '',
      functionProcessStep: '',
      functionWorkElement: '',
      failureEffects: '',
      severityFE: '',
      failureMode: '',
      failureCause: '',
      preventionControls: '',
      occurrenceFC: '',
      detectionControls: '',
      detectionFC: '',
      ap: '',
      specialFeature: '',
      pokaYokePre: '',
      preventionAction: '',
      detectionAction: '',
      responsiblePerson: '',
      targetCompletionDate: '',
      status: '',
      actionTakenEvidence: '',
      completionDate: '',
      severityOpt: '',
      occurrenceOpt: '',
      detectionOpt: '',
      specialCharOpt: '',
      pokaYokeOpt: '',
      apOpt: '',
      remarks: '',
    };
    setRows((prev) => [...prev, newRow]);
  };

  // Delete Row
  const handleDeleteRow = (rowId) => {
    pushSnapshot();
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Save changes to frontend state
  const handleSave = () => {
    const payload = {
      metadata,
      rows,
      revisionHistory,
      signOff,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`pfmea_sheet_${sheetId}`, JSON.stringify(payload));

      // Also update the document index if present
      const savedDocsRaw = localStorage.getItem('pfmea_custom_sheets');
      let customSheets = savedDocsRaw ? JSON.parse(savedDocsRaw) : [];
      const existingIdx = customSheets.findIndex((d) => d.id === sheetId);
      if (existingIdx >= 0) {
        customSheets[existingIdx] = {
          ...customSheets[existingIdx],
          metadata,
          rows,
          revisionHistory,
          signOff,
          revDate: metadata.pfmeaRevisionDate || customSheets[existingIdx].revDate,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('pfmea_custom_sheets', JSON.stringify(customSheets));
      }
    } catch (e) {
      console.error('Failed to save PFMEA sheet to localStorage', e);
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLastSavedTime(timeStr);
    setSaveSuccessMsg('PFMEA Sheet saved successfully!');
    showToast?.('✓ PFMEA Sheet saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Revision History Edit
  const handleRevisionChange = (index, field, value) => {
    setRevisionHistory((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleAddRevisionRow = () => {
    pushSnapshot();
    const nextRevNum = String(revisionHistory.length).padStart(2, '0');
    setRevisionHistory((prev) => [
      ...prev,
      {
        revNo: nextRevNum,
        revDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
        changeContents: '',
        remarks: '',
      },
    ]);
  };

  return (
    <main className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100 pfmea-sheet-container">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR (EXACT ORDER AS REQUESTED:
             Back, Save, Undo (icon only), Redo (icon only), + Add row)
      ────────────────────────────────────────────────────────────── */}
      <header className="pfmea-top-bar">
        <div className="pfmea-actions-group">
          {/* 1. Back */}
          <button
            type="button"
            onClick={onBack}
            className="pfmea-btn-back"
            title="Return to the PFMEA main page"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          {/* 2. Save */}
          <button
            type="button"
            onClick={handleSave}
            className="pfmea-btn-save"
            title="Save changes in frontend state"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>

          {/* 3. Undo (icon only, no text) */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="pfmea-btn-icon-only"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          {/* 4. Redo (icon only, no text) */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="pfmea-btn-icon-only"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          {/* 5. + Add row */}
          <button
            type="button"
            onClick={handleAddRow}
            className="pfmea-btn-add-row"
            title="Add a new row to the table"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>+ Add row</span>
          </button>
        </div>

        {/* Right Info & Status */}
        <div className="flex items-center gap-3">
          {saveSuccessMsg && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-300 animate-fade-in">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </span>
          )}

          {lastSavedTime && !saveSuccessMsg && (
            <span className="text-[11px] text-slate-500 font-medium">
              Saved at {lastSavedTime}
            </span>
          )}

          <div className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
            {doc?.title || 'PFMEA Sheet'}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-md bg-white p-0.5">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.7, +(z - 0.1).toFixed(1)))}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[11px] font-semibold text-slate-700 px-1 select-none">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))}
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            {zoomScale !== 1 && (
              <button
                type="button"
                onClick={() => setZoomScale(1)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500"
                title="Reset zoom"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. SCROLLABLE SPREADSHEET AREA (32 COLUMNS)
      ────────────────────────────────────────────────────────────── */}
      <div className="pfmea-scroll-area">
        <div
          className="pfmea-table-wrapper"
          style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top left' }}
        >
          {/* Top Metadata Card */}
          <div className="pfmea-meta-card">
            <div className="pfmea-meta-top-strip">
              <div className="pfmea-meta-top-spacer"></div>
              <div className="pfmea-meta-title">PFMEA</div>
              <div className="pfmea-meta-top-company">{metadata.companyName || 'Furukawa Minda Electric Pvt. Ltd.'}</div>
            </div>
            <div className="pfmea-meta-grid">
              {/* Left Column */}
              <div className="pfmea-meta-col pfmea-meta-col-left">
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">Company Name</span>
                  <input
                    type="text"
                    value={metadata.companyName}
                    onChange={(e) => setMetadata({ ...metadata, companyName: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input font-bold"
                  />
                </div>
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">Engineering Location</span>
                  <input
                    type="text"
                    value={metadata.engineeringLocation}
                    onChange={(e) => setMetadata({ ...metadata, engineeringLocation: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input"
                  />
                </div>
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">Customer Name</span>
                  <input
                    type="text"
                    value={metadata.customerName}
                    onChange={(e) => setMetadata({ ...metadata, customerName: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input font-bold"
                  />
                </div>
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">Model of Year / Platform</span>
                  <input
                    type="text"
                    value={metadata.modelYearPlatform}
                    onChange={(e) => setMetadata({ ...metadata, modelYearPlatform: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input font-semibold"
                  />
                </div>
              </div>

              {/* Middle Column */}
              <div className="pfmea-meta-col pfmea-meta-col-mid">
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">Subject</span>
                  <input
                    type="text"
                    value={metadata.subject}
                    onChange={(e) => setMetadata({ ...metadata, subject: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input font-bold"
                  />
                </div>
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">PFMEA Start Date</span>
                  <input
                    type="text"
                    value={metadata.pfmeaStartDate}
                    onChange={(e) => setMetadata({ ...metadata, pfmeaStartDate: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input"
                  />
                </div>
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">PFMEA Revision Date</span>
                  <input
                    type="text"
                    value={metadata.pfmeaRevisionDate}
                    onChange={(e) => setMetadata({ ...metadata, pfmeaRevisionDate: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input font-semibold"
                  />
                </div>
                <div className="pfmea-meta-row">
                  <span className="pfmea-meta-label">Cross-Functional Team</span>
                  <input
                    type="text"
                    value={metadata.crossFunctionalTeam}
                    onChange={(e) => setMetadata({ ...metadata, crossFunctionalTeam: e.target.value })}
                    onBlur={handleCellBlur}
                    className="pfmea-meta-input"
                  />
                </div>
              </div>

              {/* Right Column (User Marked in Red) */}
              <div className="pfmea-meta-col pfmea-meta-col-right">
                <div className="pfmea-meta-right-fields">
                  <div className="pfmea-meta-row">
                    <span className="pfmea-meta-label">PFMEA ID Number</span>
                    <input
                      type="text"
                      value={metadata.pfmeaIdNumber ?? 'PFMEA-WH-PE-MSIL-YHB_RC25 -002'}
                      onChange={(e) => setMetadata({ ...metadata, pfmeaIdNumber: e.target.value })}
                      onBlur={handleCellBlur}
                      className="pfmea-meta-input font-bold text-slate-900"
                    />
                  </div>
                  <div className="pfmea-meta-row">
                    <span className="pfmea-meta-label">Process Responsibility</span>
                    <input
                      type="text"
                      value={metadata.processResponsibility ?? 'Anuj Yadav'}
                      onChange={(e) => setMetadata({ ...metadata, processResponsibility: e.target.value })}
                      onBlur={handleCellBlur}
                      className="pfmea-meta-input font-semibold"
                    />
                  </div>
                  <div className="pfmea-meta-row">
                    <span className="pfmea-meta-label">Confidential Level</span>
                    <input
                      type="text"
                      value={metadata.confidentialLevel ?? 'Confidential'}
                      onChange={(e) => setMetadata({ ...metadata, confidentialLevel: e.target.value })}
                      onBlur={handleCellBlur}
                      className="pfmea-meta-input"
                    />
                  </div>
                  <div className="pfmea-meta-row" style={{ minHeight: '24px' }}>
                    <span className="pfmea-meta-label"></span>
                    <span className="pfmea-meta-input"></span>
                  </div>
                </div>

                {/* Legend Box */}
                <div className="pfmea-meta-legend-container">
                  <div className="pfmea-legend-box">
                    <div className="pfmea-legend-header">Legend</div>
                    <table className="pfmea-legend-table">
                      <tbody>
                        <tr>
                          <td className="pfmea-legend-code">OP</td>
                          <td className="pfmea-legend-desc">Our Plant</td>
                        </tr>
                        <tr>
                          <td className="pfmea-legend-code">CP</td>
                          <td className="pfmea-legend-desc">Customer Plant</td>
                        </tr>
                        <tr>
                          <td className="pfmea-legend-code">EU</td>
                          <td className="pfmea-legend-desc">End Plant</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              MAIN 32-COLUMN EXCEL TABLE
          ────────────────────────────────────────────────────────── */}
          <table className="pfmea-excel-table">
            <thead>
              {/* Category Group Header Row (Row 1) */}
              <tr className="group-header-row">
                <th style={{ width: '150px' }}>CONTINUOUS IMPROVEMENT</th>
                <th colSpan={3} style={{ width: '440px' }}>STRUCTURE ANALYSIS</th>
                <th colSpan={3} style={{ width: '520px' }}>FUNCTION ANALYSIS</th>
                <th colSpan={4} style={{ width: '625px' }}>FAILURE ANALYSIS</th>
                <th colSpan={6} style={{ width: '565px' }}>RISK ANALYSIS</th>
                <th style={{ width: '50px' }}></th>
                <th colSpan={13} style={{ width: '1055px' }}>OPTIMIZATION</th>
                <th style={{ width: '90px' }}></th>
              </tr>

              {/* Column Definitions (Row 2) */}
              <tr className="column-header-row">
                {/* 1. Issue # & History Change */}
                <th className="bg-pfmea-yellow" style={{ width: '150px' }}>
                  <div className="flex h-full items-stretch">
                    <div className="bg-pfmea-light-blue px-1 py-2 flex items-center justify-center border-r border-black" style={{ width: '28px' }}>
                      <span className="pfmea-vertical-text">ISSUE #</span>
                    </div>
                    <div className="flex-1 p-2 flex items-center justify-center text-center font-bold">
                      History/ Change Authorization (As Applicable) (optional)
                    </div>
                  </div>
                </th>

                {/* 2. Process Item (Structure Analysis) */}
                <th className="bg-pfmea-yellow" style={{ width: '160px' }}>
                  <span>1. </span>
                  <span className="text-red-600 font-bold">Process</span>
                  <span> Item, System, Subsystem, Part Element or Name of the Process</span>
                </th>

                {/* 3. Process Step */}
                <th className="bg-pfmea-blue" style={{ width: '160px' }}>
                  <span>2. Process </span>
                  <span className="text-red-600 font-bold">Step,</span>
                  <span> Station No. and Name of the Focus Element</span>
                </th>

                {/* 4. Process Work Element - 5M */}
                <th className="bg-pfmea-pink" style={{ width: '120px' }}>
                  <span>3. Process Work </span>
                  <span className="text-red-600 font-bold">Element - 5M</span>
                  <span> Type</span>
                </th>

                {/* 5. Function of Process Item */}
                <th className="bg-pfmea-yellow" style={{ width: '180px' }}>
                  1. Function of Process Item, System, Subsystem, Part Element or Name of the Process
                </th>

                {/* 6. Function of Process Step */}
                <th className="bg-pfmea-blue" style={{ width: '160px' }}>
                  2. Function of the Process Step and Product Characteristics (Quantity value is optional)
                </th>

                {/* 7. Function of Process Work Element */}
                <th className="bg-pfmea-pink" style={{ width: '180px' }}>
                  3. Function of the Process Work Element and Process Characteristics
                </th>

                {/* 8. Failure Effects */}
                <th className="bg-pfmea-yellow" style={{ width: '180px' }}>
                  1. Failure Effects (FE) to the Next Higher Level Element and/or End user
                </th>

                {/* 9. Severity (S) */}
                <th style={{ width: '45px', verticalAlign: 'middle' }}>
                  <span className="pfmea-vertical-text">Severity (S) of FE</span>
                </th>

                {/* 10. Failure Mode */}
                <th className="bg-pfmea-blue" style={{ width: '180px' }}>
                  2. Failure Mode (FM) of the Focus Element
                </th>

                {/* 11. Failure Cause */}
                <th className="bg-pfmea-pink" style={{ width: '220px' }}>
                  3. Failure Cause (FC) of the Next Lower Element or Characteristics
                </th>

                {/* 12. Prevention Controls */}
                <th className="bg-pfmea-gold" style={{ width: '190px' }}>
                  Current Prevention Controls of FC
                </th>

                {/* 13. Occurrence (O) */}
                <th className="bg-pfmea-gold" style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">Occurrence (O) of FC</span>
                </th>

                {/* 14. Detection Controls */}
                <th className="bg-pfmea-gold" style={{ width: '190px' }}>
                  Current Detection Controls of FC or FM
                </th>

                {/* 15. Detection (D) */}
                <th className="bg-pfmea-gold" style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">Detection (D) of FC/FM</span>
                </th>

                {/* 16. AP */}
                <th className="bg-pfmea-gold" style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">AP</span>
                </th>

                {/* 17. special feature */}
                <th className="bg-pfmea-cyan" style={{ width: '50px' }}>
                  <span className="pfmea-vertical-text text-white">special feature</span>
                </th>

                {/* 18. Poka Yoke */}
                <th style={{ width: '50px' }}>
                  <span className="pfmea-vertical-text">Poka Yoke</span>
                </th>

                {/* 19. Prevention Action */}
                <th style={{ width: '90px' }}>
                  <span className="pfmea-vertical-text">Prevention Action</span>
                </th>

                {/* 20. Detection Action */}
                <th style={{ width: '90px' }}>
                  <span className="pfmea-vertical-text">Detection Action</span>
                </th>

                {/* 21. Responsible Person */}
                <th style={{ width: '90px' }}>
                  <span className="pfmea-vertical-text">Responsible Person</span>
                </th>

                {/* 22. Target Completion date */}
                <th style={{ width: '90px' }}>
                  <span className="pfmea-vertical-text">Target Completion date</span>
                </th>

                {/* 23. Status */}
                <th style={{ width: '90px' }}>
                  <span className="pfmea-vertical-text-wrap">
                    Status - (Untouched, under consideration, in progress, completed, discarded)
                  </span>
                </th>

                {/* 24. Action Taken with Pointer to Evidence */}
                <th style={{ width: '100px' }}>
                  <span className="pfmea-vertical-text-wrap">
                    Action Taken with Pointer to Evidence
                  </span>
                </th>

                {/* 25. Completion Date */}
                <th style={{ width: '80px' }}>
                  <span className="pfmea-vertical-text">Completion Date</span>
                </th>

                {/* 26. Severity (S) */}
                <th style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">Severity (S)</span>
                </th>

                {/* 27. Occurrence (O) */}
                <th style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">Occurrence (O)</span>
                </th>

                {/* 28. Detection (D) */}
                <th style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">Detection (D)</span>
                </th>

                {/* 29. Special Char. */}
                <th style={{ width: '50px' }}>
                  <span className="pfmea-vertical-text">Special Char.</span>
                </th>

                {/* 30. Poka Yoke */}
                <th style={{ width: '50px' }}>
                  <span className="pfmea-vertical-text">Poka Yoke</span>
                </th>

                {/* 31. AP */}
                <th style={{ width: '45px' }}>
                  <span className="pfmea-vertical-text">AP</span>
                </th>

                {/* 32. Remarks */}
                <th style={{ width: '90px' }}>
                  <span className="pfmea-vertical-text">Remarks</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {rows.map((row, idx) => {
                const nextRow = rows[idx + 1];
                const isEndOfGroup = !nextRow || (nextRow.processItem && nextRow.processItem !== row.processItem);
                const borderBottomClass = isEndOfGroup ? 'border-solid-b' : 'border-dashed-b';

                return (
                  <tr key={row.id} className="group hover:bg-amber-50/20 transition-colors">
                    {/* 1. History/Change */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '150px' }}>
                      <CellTextarea
                        value={row.historyChange}
                        onChange={(v) => handleCellChange(row.id, 'historyChange', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 2. Process Item */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '160px' }}>
                      <CellTextarea
                        value={row.processItem}
                        onChange={(v) => handleCellChange(row.id, 'processItem', v)}
                        onBlur={handleCellBlur}
                        className="font-semibold"
                      />
                    </td>

                    {/* 3. Process Step */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '160px' }}>
                      <CellTextarea
                        value={row.processStep}
                        onChange={(v) => handleCellChange(row.id, 'processStep', v)}
                        onBlur={handleCellBlur}
                        className="font-semibold"
                      />
                    </td>

                    {/* 4. Process Work Element 5M */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '120px' }}>
                      <CellTextarea
                        value={row.workElement5M}
                        onChange={(v) => handleCellChange(row.id, 'workElement5M', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 5. Function of Process Item */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '180px' }}>
                      <CellTextarea
                        value={row.functionProcessItem}
                        onChange={(v) => handleCellChange(row.id, 'functionProcessItem', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 6. Function of Process Step */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '160px' }}>
                      <CellTextarea
                        value={row.functionProcessStep}
                        onChange={(v) => handleCellChange(row.id, 'functionProcessStep', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 7. Function of Process Work Element */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '180px' }}>
                      <CellTextarea
                        value={row.functionWorkElement}
                        onChange={(v) => handleCellChange(row.id, 'functionWorkElement', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 8. Failure Effects (FE) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '180px' }}>
                      <CellTextarea
                        value={row.failureEffects}
                        onChange={(v) => handleCellChange(row.id, 'failureEffects', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 9. Severity (S) */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.severityFE}
                        onChange={(v) => handleCellChange(row.id, 'severityFE', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 10. Failure Mode (FM) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '180px' }}>
                      <CellTextarea
                        value={row.failureMode}
                        onChange={(v) => handleCellChange(row.id, 'failureMode', v)}
                        onBlur={handleCellBlur}
                        className="font-medium"
                      />
                    </td>

                    {/* 11. Failure Cause (FC) */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '220px' }}>
                      <CellTextarea
                        value={row.failureCause}
                        onChange={(v) => handleCellChange(row.id, 'failureCause', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 12. Current Prevention Controls */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '190px' }}>
                      <CellTextarea
                        value={row.preventionControls}
                        onChange={(v) => handleCellChange(row.id, 'preventionControls', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 13. Occurrence (O) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.occurrenceFC}
                        onChange={(v) => handleCellChange(row.id, 'occurrenceFC', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 14. Current Detection Controls */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '190px' }}>
                      <CellTextarea
                        value={row.detectionControls}
                        onChange={(v) => handleCellChange(row.id, 'detectionControls', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 15. Detection (D) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.detectionFC}
                        onChange={(v) => handleCellChange(row.id, 'detectionFC', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 16. AP */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.ap}
                        onChange={(v) => handleCellChange(row.id, 'ap', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 17. special feature */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '50px' }}>
                      <CellTextarea
                        value={row.specialFeature}
                        onChange={(v) => handleCellChange(row.id, 'specialFeature', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 18. Poka Yoke (Pre) */}
                    <td className={`border-solid-r ${borderBottomClass}`} style={{ width: '50px' }}>
                      <CellTextarea
                        value={row.pokaYokePre}
                        onChange={(v) => handleCellChange(row.id, 'pokaYokePre', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 19. Prevention Action */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '90px' }}>
                      <CellTextarea
                        value={row.preventionAction}
                        onChange={(v) => handleCellChange(row.id, 'preventionAction', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 20. Detection Action */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '90px' }}>
                      <CellTextarea
                        value={row.detectionAction}
                        onChange={(v) => handleCellChange(row.id, 'detectionAction', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 21. Responsible Person */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '90px' }}>
                      <CellTextarea
                        value={row.responsiblePerson}
                        onChange={(v) => handleCellChange(row.id, 'responsiblePerson', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 22. Target Completion date */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '90px' }}>
                      <CellTextarea
                        value={row.targetCompletionDate}
                        onChange={(e) => handleCellChange(row.id, 'targetCompletionDate', e)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 23. Status */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '90px' }}>
                      <CellTextarea
                        value={row.status}
                        onChange={(v) => handleCellChange(row.id, 'status', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 24. Action Taken with Pointer to Evidence */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '100px' }}>
                      <CellTextarea
                        value={row.actionTakenEvidence}
                        onChange={(v) => handleCellChange(row.id, 'actionTakenEvidence', v)}
                        onBlur={handleCellBlur}
                      />
                    </td>

                    {/* 25. Completion Date */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '80px' }}>
                      <CellTextarea
                        value={row.completionDate}
                        onChange={(v) => handleCellChange(row.id, 'completionDate', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 26. Severity (S) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.severityOpt}
                        onChange={(v) => handleCellChange(row.id, 'severityOpt', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 27. Occurrence (O) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.occurrenceOpt}
                        onChange={(v) => handleCellChange(row.id, 'occurrenceOpt', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 28. Detection (D) */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.detectionOpt}
                        onChange={(v) => handleCellChange(row.id, 'detectionOpt', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 29. Special Char. */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '50px' }}>
                      <CellTextarea
                        value={row.specialCharOpt}
                        onChange={(v) => handleCellChange(row.id, 'specialCharOpt', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 30. Poka Yoke */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '50px' }}>
                      <CellTextarea
                        value={row.pokaYokeOpt}
                        onChange={(v) => handleCellChange(row.id, 'pokaYokeOpt', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center"
                      />
                    </td>

                    {/* 31. AP */}
                    <td className={`border-dashed-r ${borderBottomClass}`} style={{ width: '45px' }}>
                      <CellTextarea
                        value={row.apOpt}
                        onChange={(v) => handleCellChange(row.id, 'apOpt', v)}
                        onBlur={handleCellBlur}
                        className="pfmea-cell-center font-bold"
                      />
                    </td>

                    {/* 32. Remarks & Row Delete button */}
                    <td className={`border-solid-r ${borderBottomClass} relative`} style={{ width: '90px' }}>
                      <CellTextarea
                        value={row.remarks}
                        onChange={(v) => handleCellChange(row.id, 'remarks', v)}
                        onBlur={handleCellBlur}
                      />
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="absolute right-1 top-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          title="Delete this row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ─────────────────────────────────────────────────────────
              3. BOTTOM SECTION: LEGEND, REVISION HISTORY & SIGN-OFF
          ────────────────────────────────────────────────────────── */}
          <div className="pfmea-bottom-container">
            {/* Characteristics Legend */}
            <div className="pfmea-legend-bar">
              <div className="pfmea-legend-item">
                <svg width="18" height="18" viewBox="0 0 24 24" className="inline-block">
                  <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="#000" strokeWidth="1.8" />
                  <text x="12" y="16" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#000">C</text>
                </svg>
                <span>For Internal characteristics</span>
              </div>

              <div className="pfmea-legend-item">
                <svg width="18" height="18" viewBox="0 0 24 24" className="inline-block">
                  <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="#000" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="5" fill="none" stroke="#000" strokeWidth="1.5" />
                </svg>
                <span>For external characteristics</span>
              </div>

              <div className="pfmea-legend-item">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-red-500 text-red-600 font-bold text-[10px]">
                  P
                </span>
                <span className="font-semibold text-slate-800">For Poka-Yoke</span>
              </div>

              <div className="pfmea-legend-item">
                <span className="inline-flex items-center justify-center w-5 h-4 rounded-full border border-red-500 text-red-600 font-bold text-[9px]">
                  AR
                </span>
                <span>for compliance to law & regulation requirement</span>
              </div>
            </div>

            {/* Revision History Table */}
            <div className="border border-black">
              <div className="flex items-center justify-between bg-slate-50 px-3 py-1 border-b border-black">
                <span className="font-bold text-xs uppercase tracking-wide">Revision History:</span>
                <button
                  type="button"
                  onClick={handleAddRevisionRow}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Revision
                </button>
              </div>
              <table className="pfmea-revision-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Rev No.</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Rev Date</th>
                    <th>Change Contents</th>
                    <th style={{ width: '150px' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionHistory.map((rev, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="text"
                          value={rev.revNo}
                          onChange={(e) => handleRevisionChange(rIdx, 'revNo', e.target.value)}
                          onBlur={handleCellBlur}
                          className="w-full text-center bg-transparent border-0 outline-none font-bold"
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="text"
                          value={rev.revDate}
                          onChange={(e) => handleRevisionChange(rIdx, 'revDate', e.target.value)}
                          onBlur={handleCellBlur}
                          className="w-full text-center bg-transparent border-0 outline-none"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={rev.changeContents}
                          onChange={(e) => handleRevisionChange(rIdx, 'changeContents', e.target.value)}
                          onBlur={handleCellBlur}
                          className="w-full bg-transparent border-0 outline-none px-1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={rev.remarks}
                          onChange={(e) => handleRevisionChange(rIdx, 'remarks', e.target.value)}
                          onBlur={handleCellBlur}
                          className="w-full bg-transparent border-0 outline-none px-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Supplier Sign-off (Manager Level) Table */}
            <table className="pfmea-signoff-table">
              <thead>
                <tr>
                  <th style={{ width: '160px', textAlign: 'left', paddingLeft: '8px' }}>
                    Supplier Sign-off (Manager Level)
                  </th>
                  <th>Project Leader</th>
                  <th>Process Engineering</th>
                  <th>QA/QC</th>
                  <th>Production</th>
                  <th>Maintenance</th>
                  <th>Logistic</th>
                  <th>Purchase</th>
                </tr>
              </thead>
              <tbody>
                {/* Names Row */}
                <tr>
                  <td style={{ fontWeight: 700, textAlign: 'left', paddingLeft: '8px' }}>Name</td>
                  <td>
                    <input
                      type="text"
                      value={signOff.projectLeader?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, projectLeader: { ...signOff.projectLeader, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.processEngineering?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, processEngineering: { ...signOff.processEngineering, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.qaqc?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, qaqc: { ...signOff.qaqc, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.production?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, production: { ...signOff.production, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.maintenance?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, maintenance: { ...signOff.maintenance, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.logistic?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, logistic: { ...signOff.logistic, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.purchase?.name || ''}
                      onChange={(e) => setSignOff({ ...signOff, purchase: { ...signOff.purchase, name: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-semibold"
                    />
                  </td>
                </tr>

                {/* Signature Plant level */}
                <tr style={{ height: '32px' }}>
                  <td style={{ fontWeight: 700, textAlign: 'left', paddingLeft: '8px' }}>
                    Signature Plant level
                  </td>
                  <td colSpan={7} className="text-slate-400 text-xs italic text-left pl-3">
                    Verified and approved at plant level
                  </td>
                </tr>

                {/* Centerlize Role Titles */}
                <tr className="bg-slate-50 font-bold">
                  <td style={{ textAlign: 'left', paddingLeft: '8px' }}></td>
                  <td></td>
                  <td>Process Engineering Centerlize</td>
                  <td>Quality Centerlize</td>
                  <td colSpan={4}></td>
                </tr>

                {/* Centerlize Signatures */}
                <tr>
                  <td style={{ fontWeight: 700, textAlign: 'left', paddingLeft: '8px' }}>
                    Signature Centerlize
                  </td>
                  <td></td>
                  <td>
                    <input
                      type="text"
                      value={signOff.processEngineering?.centerlizeName || ''}
                      onChange={(e) => setSignOff({ ...signOff, processEngineering: { ...signOff.processEngineering, centerlizeName: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-bold"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={signOff.qaqc?.centerlizeName || ''}
                      onChange={(e) => setSignOff({ ...signOff, qaqc: { ...signOff.qaqc, centerlizeName: e.target.value } })}
                      onBlur={handleCellBlur}
                      className="w-full text-center bg-transparent border-0 outline-none font-bold"
                    />
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

