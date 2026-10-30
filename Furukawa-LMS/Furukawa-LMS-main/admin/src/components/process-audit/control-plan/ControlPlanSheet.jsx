import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
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
import './ControlPlanSheet.css';
import {
  INITIAL_CONTROL_PLAN_METADATA,
  INITIAL_CONTROL_PLAN_ROWS,
  INITIAL_CP_REVISION_HISTORY,
  INITIAL_CP_SIGN_OFF,
} from './controlPlanInitialData';
import {
  saveControlPlanSheet,
  loadControlPlanSheet,
  getInitialSyncState,
} from './controlPlanStorage';

/**
 * Ultra-fast cell textarea without forced reflows on mount
 */
const CellTextarea = memo(function CellTextarea({
  value,
  onChange,
  onBlur,
  onFocus,
  className = '',
  placeholder = '',
  style = {},
}) {
  const handleInput = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 22)}px`;
    onChange?.(el.value);
  };

  const handleFocus = (e) => {
    const el = e.target;
    if (el.scrollHeight > el.clientHeight + 4) {
      el.style.height = `${Math.max(el.scrollHeight, 22)}px`;
    }
    onFocus?.(e);
  };

  return (
    <textarea
      value={value ?? ''}
      onChange={handleInput}
      onFocus={handleFocus}
      onBlur={onBlur}
      rows={1}
      placeholder={placeholder}
      className={`cp-cell-textarea ${className}`}
      style={style}
    />
  );
});

/**
 * Memoized single row component to prevent re-rendering all rows on cell change
 */
const ControlPlanRow = memo(function ControlPlanRow({
  row,
  idx,
  onCellChange,
  onDeleteRow,
}) {
  const isPokaYokeP =
    row.pokaYoke &&
    (row.pokaYoke.includes('(P)') ||
      row.pokaYoke === 'P' ||
      row.pokaYoke.toLowerCase().includes('poka'));

  return (
    <tr>
      {/* Action / Row Index */}
      <td className="cp-cell-center text-slate-400 font-mono text-[10px]">
        <div className="relative group flex items-center justify-center">
          <span className="group-hover:hidden">{idx + 1}</span>
          <button
            type="button"
            onClick={() => onDeleteRow(row.id)}
            className="hidden group-hover:inline-flex cp-btn-del-row"
            title="Delete row"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>

      {/* Col 1: Part/ Process Number */}
      <td className="cp-cell-center font-bold">
        <CellTextarea
          value={row.partProcessNumber}
          onChange={(v) => onCellChange(row.id, 'partProcessNumber', v)}
        />
      </td>

      {/* Col 2: Process Name/ Operation Description */}
      <td>
        <CellTextarea
          value={row.processName}
          onChange={(v) => onCellChange(row.id, 'processName', v)}
        />
      </td>

      {/* Col 3: Machine Device, Jig, Tools for mfg. */}
      <td>
        <CellTextarea
          value={row.machineDeviceJig}
          onChange={(v) => onCellChange(row.id, 'machineDeviceJig', v)}
        />
      </td>

      {/* Col 4: NO (Characteristics) */}
      <td className="cp-cell-center font-semibold">
        <CellTextarea
          value={row.charNo}
          onChange={(v) => onCellChange(row.id, 'charNo', v)}
        />
      </td>

      {/* Col 5: Product (Characteristics) */}
      <td>
        <CellTextarea
          value={row.charProduct}
          onChange={(v) => onCellChange(row.id, 'charProduct', v)}
        />
      </td>

      {/* Col 6: Process (Characteristics) */}
      <td>
        <CellTextarea
          value={row.charProcess}
          onChange={(v) => onCellChange(row.id, 'charProcess', v)}
        />
      </td>

      {/* Col 7: special char. class */}
      <td className="cp-cell-center">
        <div className="flex items-center justify-center gap-1">
          {row.specialCharClass === '<C>' && (
            <span className="cp-char-badge-c" title="Internal Special Characteristic">
              <span>C</span>
            </span>
          )}
          {row.specialCharClass === 'AR' && (
            <span className="cp-char-badge-ar" title="Law & Regulation Requirement">
              AR
            </span>
          )}
          <CellTextarea
            value={row.specialCharClass}
            onChange={(v) => onCellChange(row.id, 'specialCharClass', v)}
            className="text-center"
          />
        </div>
      </td>

      {/* Col 8: Product/Process specification/tolerance */}
      <td>
        <CellTextarea
          value={row.methodSpec}
          onChange={(v) => onCellChange(row.id, 'methodSpec', v)}
        />
      </td>

      {/* Col 9: Evalution /Measurement Technique */}
      <td>
        <CellTextarea
          value={row.methodEval}
          onChange={(v) => onCellChange(row.id, 'methodEval', v)}
        />
      </td>

      {/* Col 10: size */}
      <td className="cp-cell-center">
        <CellTextarea
          value={row.sampleSize}
          onChange={(v) => onCellChange(row.id, 'sampleSize', v)}
          className="text-center"
        />
      </td>

      {/* Col 11: Freq. */}
      <td>
        <CellTextarea
          value={row.sampleFreq}
          onChange={(v) => onCellChange(row.id, 'sampleFreq', v)}
        />
      </td>

      {/* Col 12: Control method - Prevention */}
      <td>
        <CellTextarea
          value={row.controlPrevention}
          onChange={(v) => onCellChange(row.id, 'controlPrevention', v)}
        />
      </td>

      {/* Col 13: Control method - Detection */}
      <td>
        <CellTextarea
          value={row.controlDetection}
          onChange={(v) => onCellChange(row.id, 'controlDetection', v)}
        />
      </td>

      {/* Col 14: Control method - Recording */}
      <td>
        <CellTextarea
          value={row.controlRecording}
          onChange={(v) => onCellChange(row.id, 'controlRecording', v)}
        />
      </td>

      {/* Col 15: Control method - Resp. */}
      <td className="cp-cell-center font-bold">
        <CellTextarea
          value={row.controlResp}
          onChange={(v) => onCellChange(row.id, 'controlResp', v)}
          className="text-center"
        />
      </td>

      {/* Col 16: Transportation Method */}
      <td>
        <CellTextarea
          value={row.transportationMethod}
          onChange={(v) => onCellChange(row.id, 'transportationMethod', v)}
        />
      </td>

      {/* Col 17: Poka Yoke */}
      <td className="cp-cell-center">
        <div className="flex items-center justify-center gap-1">
          {isPokaYokeP && (
            <span className="cp-poka-badge" title="Poka-Yoke">
              P
            </span>
          )}
          <CellTextarea
            value={row.pokaYoke}
            onChange={(v) => onCellChange(row.id, 'pokaYoke', v)}
          />
        </div>
      </td>

      {/* Col 18: Reaction Plan */}
      <td>
        <CellTextarea
          value={row.reactionPlan}
          onChange={(v) => onCellChange(row.id, 'reactionPlan', v)}
        />
      </td>

      {/* Col 19: Disposable Plan */}
      <td>
        <CellTextarea
          value={row.disposablePlan}
          onChange={(v) => onCellChange(row.id, 'disposablePlan', v)}
        />
      </td>
    </tr>
  );
});

export default function ControlPlanSheet({ doc, onBack, showToast }) {
  const sheetId = doc?.id || 'cp_default';

  // Instant initial load: try synchronous localStorage first, fallback to initial templates
  const getInitialState = () => {
    const syncSaved = getInitialSyncState(sheetId);
    if (syncSaved) {
      return {
        metadata: {
          ...INITIAL_CONTROL_PLAN_METADATA,
          ...(doc?.metadata || {}),
          ...(syncSaved.metadata || {}),
        },
        rows:
          Array.isArray(syncSaved.rows) && syncSaved.rows.length > 0
            ? syncSaved.rows
            : doc?.rows || INITIAL_CONTROL_PLAN_ROWS,
        revisionHistory:
          syncSaved.revisionHistory || doc?.revisionHistory || INITIAL_CP_REVISION_HISTORY,
        signOff: syncSaved.signOff || doc?.signOff || INITIAL_CP_SIGN_OFF,
      };
    }
    return {
      metadata: {
        ...INITIAL_CONTROL_PLAN_METADATA,
        ...(doc?.metadata || {}),
      },
      rows: doc?.rows || INITIAL_CONTROL_PLAN_ROWS,
      revisionHistory: doc?.revisionHistory || INITIAL_CP_REVISION_HISTORY,
      signOff: doc?.signOff || INITIAL_CP_SIGN_OFF,
    };
  };

  const [initialData] = useState(getInitialState);
  const [metadata, setMetadata] = useState(initialData.metadata);
  const [rows, setRows] = useState(initialData.rows);
  const [revisionHistory, setRevisionHistory] = useState(initialData.revisionHistory);
  const [signOff, setSignOff] = useState(initialData.signOff);

  // Progressive rendering: initial 50 rows load in < 15ms, then smoothly load remaining
  const [renderedCount, setRenderedCount] = useState(50);

  useEffect(() => {
    if (renderedCount < rows.length) {
      const animId = requestAnimationFrame(() => {
        setRenderedCount((prev) => Math.min(prev + 75, rows.length));
      });
      return () => cancelAnimationFrame(animId);
    }
  }, [renderedCount, rows.length]);

  // Load from IndexedDB asynchronously if not present in localStorage
  useEffect(() => {
    let isMounted = true;
    loadControlPlanSheet(sheetId).then((idbRecord) => {
      if (!isMounted || !idbRecord) return;
      if (idbRecord.metadata) {
        setMetadata((prev) => ({ ...prev, ...idbRecord.metadata }));
      }
      if (Array.isArray(idbRecord.rows) && idbRecord.rows.length > 0) {
        setRows(idbRecord.rows);
      }
      if (idbRecord.revisionHistory) {
        setRevisionHistory(idbRecord.revisionHistory);
      }
      if (idbRecord.signOff) {
        setSignOff(idbRecord.signOff);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [sheetId]);

  // Undo & Redo History Stacks
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef(null);

  // Zoom scale
  const [zoomScale, setZoomScale] = useState(1);

  const displayToast = useCallback(
    (msg, type = 'success') => {
      if (showToast) {
        showToast(msg, type);
      }
      setToastMessage(msg);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setToastMessage('');
      }, 3200);
    },
    [showToast]
  );

  // Push snapshot to undo stack before mutations
  const pushSnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-25),
      {
        rows,
        metadata: { ...metadata },
        revisionHistory,
        signOff,
      },
    ]);
    setRedoStack([]);
  }, [rows, metadata, revisionHistory, signOff]);

  // Handle cell edit
  const handleCellChange = useCallback((rowId, field, val) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return { ...r, [field]: val };
        }
        return r;
      })
    );
  }, []);

  // Handle metadata edit
  const handleMetadataChange = useCallback(
    (field, val) => {
      pushSnapshot();
      setMetadata((prev) => ({ ...prev, [field]: val }));
    },
    [pushSnapshot]
  );

  // Handle Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, stack.length - 1));
    setRedoStack((stack) => [
      ...stack,
      {
        rows,
        metadata: { ...metadata },
        revisionHistory,
        signOff,
      },
    ]);
    setRows(prev.rows);
    setMetadata(prev.metadata);
    setRevisionHistory(prev.revisionHistory);
    setSignOff(prev.signOff);
  }, [undoStack, rows, metadata, revisionHistory, signOff]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, stack.length - 1));
    setUndoStack((stack) => [
      ...stack,
      {
        rows,
        metadata: { ...metadata },
        revisionHistory,
        signOff,
      },
    ]);
    setRows(next.rows);
    setMetadata(next.metadata);
    setRevisionHistory(next.revisionHistory);
    setSignOff(next.signOff);
  }, [redoStack, rows, metadata, revisionHistory, signOff]);

  // + Add Row
  const handleAddRow = useCallback(() => {
    pushSnapshot();
    const newRow = {
      id: `cp_row_${Date.now()}`,
      partProcessNumber: '',
      processName: '',
      machineDeviceJig: '',
      charNo: '',
      charProduct: '',
      charProcess: '',
      specialCharClass: '',
      methodSpec: '',
      methodEval: '',
      sampleSize: '',
      sampleFreq: '',
      controlPrevention: '',
      controlDetection: '',
      controlRecording: '',
      controlResp: '',
      transportationMethod: '',
      pokaYoke: '',
      reactionPlan: '',
      disposablePlan: '',
    };
    setRows((prev) => [...prev, newRow]);
    setRenderedCount((prev) => Math.max(prev, rows.length + 1));
  }, [pushSnapshot, rows.length]);

  // Delete Row
  const handleDeleteRow = useCallback(
    (rowId) => {
      pushSnapshot();
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    },
    [pushSnapshot]
  );

  // Save changes to frontend state using IndexedDB + clean LocalStorage metadata
  const handleSave = async () => {
    const payload = {
      metadata,
      rows,
      revisionHistory,
      signOff,
    };
    try {
      // 1. Save full data to IndexedDB + localStorage hybrid
      await saveControlPlanSheet(sheetId, payload);

      // 2. Save document metadata in custom sheets list without duplicating 250KB rows
      const savedDocsRaw = localStorage.getItem('control_plan_custom_sheets');
      let customSheets = savedDocsRaw ? JSON.parse(savedDocsRaw) : [];
      const cleanDocMeta = {
        id: sheetId,
        title: doc?.title || metadata.partName || 'Control Plan YHB Floor',
        code: metadata.controlPlanNo,
        controlPlanNo: metadata.controlPlanNo,
        customer: metadata.customerName,
        partNumber: metadata.partNumber,
        partName: metadata.partName,
        project: metadata.project,
        unit: doc?.unit || 'Bawal',
        status: doc?.status || 'Approved',
        updatedAt: new Date().toISOString().split('T')[0],
      };

      const existingIdx = customSheets.findIndex((d) => d.id === sheetId);
      if (existingIdx >= 0) {
        customSheets[existingIdx] = {
          ...customSheets[existingIdx],
          ...cleanDocMeta,
        };
      } else if (doc && !doc.isDefault) {
        customSheets.unshift(cleanDocMeta);
      }

      try {
        localStorage.setItem('control_plan_custom_sheets', JSON.stringify(customSheets));
      } catch (quotaErr) {
        console.warn('Could not update custom sheets list in localStorage:', quotaErr);
      }

      displayToast('Control Plan YHB Floor saved successfully!', 'success');
    } catch (e) {
      console.error('Failed to save Control Plan sheet:', e);
      displayToast('Error saving Control Plan sheet', 'error');
    }
  };

  // Revision history helpers
  const handleRevChange = (idx, field, val) => {
    pushSnapshot();
    setRevisionHistory((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleAddRevRow = () => {
    pushSnapshot();
    const nextRevNum = String(revisionHistory.length).padStart(2, '0');
    setRevisionHistory((prev) => [
      ...prev,
      {
        revNo: nextRevNum,
        revDate: new Date()
          .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
          .replace(/\//g, '.'),
        revisionDetail: '',
        remarks: 'Production',
      },
    ]);
  };

  // Sign-off change helpers
  const handleSignOffPlantChange = (field, val) => {
    pushSnapshot();
    setSignOff((prev) => ({
      ...prev,
      plantLevel: {
        ...prev.plantLevel,
        [field]: val,
      },
    }));
  };

  const handleSignOffCenterChange = (field, val) => {
    pushSnapshot();
    setSignOff((prev) => ({
      ...prev,
      centerlizeLevel: {
        ...prev.centerlizeLevel,
        [field]: val,
      },
    }));
  };

  // On scroll, ensure all rows are available
  const handleScroll = () => {
    if (renderedCount < rows.length) {
      setRenderedCount(rows.length);
    }
  };

  const visibleRows = rows.slice(0, renderedCount);

  return (
    <main className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100 cp-sheet-container">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR (EXACT ORDER AS REQUESTED:
             Back, Save, Undo (icon only), Redo (icon only), + Add row)
      ────────────────────────────────────────────────────────────── */}
      <header className="cp-top-bar">
        <div className="cp-actions-group">
          {/* 1. Back */}
          <button
            type="button"
            onClick={onBack}
            className="cp-btn-back"
            title="Return to the Control Plan YHB Floor main page"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          {/* 2. Save */}
          <button
            type="button"
            onClick={handleSave}
            className="cp-btn-save"
            title="Save changes in frontend state"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save</span>
          </button>

          {/* 3. Undo (icon only, without text) */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="cp-btn-icon-only"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          {/* 4. Redo (icon only, without text) */}
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="cp-btn-icon-only"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          {/* 5. + Add row */}
          <button
            type="button"
            onClick={handleAddRow}
            className="cp-btn-add-row"
            title="Add a new row to the table"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add row</span>
          </button>
        </div>

        {/* Right side metadata info & zoom */}
        <div className="cp-top-meta">
          <span className="cp-doc-badge">
            {metadata.controlPlanNo || 'CP-WH-PE-MSIL-YHB_002'} | {rows.length} Rows
          </span>

          <div className="cp-zoom-controls">
            <button
              type="button"
              className="cp-zoom-btn"
              onClick={() => setZoomScale((s) => Math.max(0.7, Number((s - 0.1).toFixed(1))))}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="cp-zoom-text">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              className="cp-zoom-btn"
              onClick={() => setZoomScale((s) => Math.min(1.4, Number((s + 0.1).toFixed(1))))}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="cp-zoom-btn"
              onClick={() => setZoomScale(1)}
              title="Reset zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. EXCEL SHEET VIEWPORT
      ────────────────────────────────────────────────────────────── */}
      <div className="cp-sheet-viewport" onScroll={handleScroll}>
        <div
          className="cp-paper"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
          }}
        >
          {/* ── TOP METADATA BLOCK (Rows 1-13) ── */}
          <div className="cp-header-block">
            {/* Row 1: Company Logo & Name */}
            <div className="cp-top-company-row">
              <div className="cp-logo-text-group">
                <span className="cp-logo-badge">Fme</span>
                <span className="cp-company-sub">
                  Furukawa Minda
                  <br />
                  Electric Pvt. Ltd.
                </span>
              </div>
              <span className="cp-company-right">{metadata.companyName}</span>
            </div>

            {/* Row 2: Control Plan Title */}
            <div className="cp-title-row">Control Plan</div>

            {/* Row 3: Phase Checkboxes (Prototype, Prelaunch, Production) */}
            <div className="cp-phases-row">
              <label className="cp-phase-item">
                <input
                  type="radio"
                  name="docType"
                  value="Prototype"
                  checked={metadata.docType === 'Prototype'}
                  onChange={(e) => handleMetadataChange('docType', e.target.value)}
                />
                <span>Prototype</span>
              </label>

              <label className="cp-phase-item">
                <input
                  type="radio"
                  name="docType"
                  value="Prelaunch"
                  checked={metadata.docType === 'Prelaunch'}
                  onChange={(e) => handleMetadataChange('docType', e.target.value)}
                />
                <span>Prelaunch</span>
              </label>

              <label className="cp-phase-item">
                <input
                  type="radio"
                  name="docType"
                  value="Production"
                  checked={metadata.docType === 'Production'}
                  onChange={(e) => handleMetadataChange('docType', e.target.value)}
                />
                <span>Production</span>
              </label>
            </div>

            {/* Rows 5 to 11: 3-Column Metadata Grid */}
            <div className="cp-meta-grid">
              {/* Column 1 */}
              <div className="cp-meta-col">
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Customer Name:</span>
                  <input
                    type="text"
                    value={metadata.customerName}
                    onChange={(e) => handleMetadataChange('customerName', e.target.value)}
                    className="cp-meta-input font-bold"
                  />
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Part Number:</span>
                  <input
                    type="text"
                    value={metadata.partNumber}
                    onChange={(e) => handleMetadataChange('partNumber', e.target.value)}
                    className="cp-meta-input font-bold"
                  />
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Issue Level:</span>
                  <input
                    type="text"
                    value={metadata.issueLevel}
                    onChange={(e) => handleMetadataChange('issueLevel', e.target.value)}
                    className="cp-meta-input"
                  />
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Design Note No.:</span>
                  <input
                    type="text"
                    value={metadata.designNoteNo}
                    onChange={(e) => handleMetadataChange('designNoteNo', e.target.value)}
                    className="cp-meta-input"
                  />
                </div>
              </div>

              {/* Column 2 */}
              <div className="cp-meta-col">
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Supplier Plant:</span>
                  <input
                    type="text"
                    value={metadata.supplierPlant}
                    onChange={(e) => handleMetadataChange('supplierPlant', e.target.value)}
                    className="cp-meta-input"
                  />
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Part Name:</span>
                  <input
                    type="text"
                    value={metadata.partName}
                    onChange={(e) => handleMetadataChange('partName', e.target.value)}
                    className="cp-meta-input font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="cp-meta-field">
                    <span className="cp-meta-label">CP Date (Original):</span>
                    <input
                      type="text"
                      value={metadata.cpDateOriginal}
                      onChange={(e) => handleMetadataChange('cpDateOriginal', e.target.value)}
                      className="cp-meta-input"
                    />
                  </div>
                  <div className="cp-meta-field">
                    <span className="cp-meta-label">Rev. Date:</span>
                    <input
                      type="text"
                      value={metadata.revDate}
                      onChange={(e) => handleMetadataChange('revDate', e.target.value)}
                      className="cp-meta-input"
                    />
                  </div>
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Drawing Level:</span>
                  <input
                    type="text"
                    value={metadata.drawingLevel}
                    onChange={(e) => handleMetadataChange('drawingLevel', e.target.value)}
                    className="cp-meta-input"
                  />
                </div>
              </div>

              {/* Column 3 */}
              <div className="cp-meta-col">
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Supplier Code:</span>
                  <input
                    type="text"
                    value={metadata.supplierCode}
                    onChange={(e) => handleMetadataChange('supplierCode', e.target.value)}
                    className="cp-meta-input font-bold"
                  />
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Project:</span>
                  <input
                    type="text"
                    value={metadata.project}
                    onChange={(e) => handleMetadataChange('project', e.target.value)}
                    className="cp-meta-input font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="cp-meta-field">
                    <span className="cp-meta-label">CP Key Date:</span>
                    <input
                      type="text"
                      value={metadata.cpKeyDate}
                      onChange={(e) => handleMetadataChange('cpKeyDate', e.target.value)}
                      className="cp-meta-input"
                    />
                  </div>
                  <div className="cp-meta-field">
                    <span className="cp-meta-label">Reason:</span>
                    <input
                      type="text"
                      value={metadata.reasonForReissue}
                      onChange={(e) => handleMetadataChange('reasonForReissue', e.target.value)}
                      className="cp-meta-input font-bold"
                    />
                  </div>
                </div>
                <div className="cp-meta-field">
                  <span className="cp-meta-label">Control plan No.:</span>
                  <input
                    type="text"
                    value={metadata.controlPlanNo}
                    onChange={(e) => handleMetadataChange('controlPlanNo', e.target.value)}
                    className="cp-meta-input font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. MAIN EXCEL-LIKE 19-COLUMN TABLE ── */}
          <div className="cp-table-wrapper">
            <table className="cp-table">
              <colgroup>
                {/* 19 columns with widths matching Excel */}
                <col style={{ width: '42px' }} /> {/* Action/Index */}
                <col style={{ width: '90px' }} /> {/* 1. Part/Process Number */}
                <col style={{ width: '170px' }} /> {/* 2. Process Name/Operation */}
                <col style={{ width: '150px' }} /> {/* 3. Machine Device, Jig, Tools */}
                <col style={{ width: '46px' }} /> {/* 4. NO */}
                <col style={{ width: '140px' }} /> {/* 5. Product */}
                <col style={{ width: '130px' }} /> {/* 6. Process */}
                <col style={{ width: '70px' }} /> {/* 7. special char. class */}
                <col style={{ width: '220px' }} /> {/* 8. Product/Process spec/tolerance */}
                <col style={{ width: '140px' }} /> {/* 9. Evaluation/Measurement Technique */}
                <col style={{ width: '60px' }} /> {/* 10. size */}
                <col style={{ width: '110px' }} /> {/* 11. Freq. */}
                <col style={{ width: '170px' }} /> {/* 12. Prevention */}
                <col style={{ width: '170px' }} /> {/* 13. Detection */}
                <col style={{ width: '150px' }} /> {/* 14. Recording */}
                <col style={{ width: '56px' }} /> {/* 15. Resp. */}
                <col style={{ width: '110px' }} /> {/* 16. Transportation Method */}
                <col style={{ width: '110px' }} /> {/* 17. Poka Yoke */}
                <col style={{ width: '150px' }} /> {/* 18. Reaction Plan */}
                <col style={{ width: '150px' }} /> {/* 19. Disposable Plan */}
              </colgroup>

              <thead>
                {/* ── Row 1 of Table Header (Rows 14-16 merged) ── */}
                <tr>
                  <th rowSpan={3} style={{ width: '42px' }}>
                    #
                  </th>
                  <th rowSpan={3}>
                    Part/ Process Number
                    <span className="cp-th-sub">(Ramp up activity process identification)</span>
                  </th>
                  <th rowSpan={3}>Process Name/ Operation Description</th>
                  <th rowSpan={3}>Machine Device, Jig, Tools for mfg.</th>
                  <th colSpan={3}>characteristics</th>
                  <th rowSpan={3}>special char. class</th>
                  <th colSpan={2}>Methods</th>
                  <th colSpan={6}>Sample</th>
                  <th rowSpan={3}>Transportation Method</th>
                  <th rowSpan={3}>Poka Yoke</th>
                  <th rowSpan={3}>Reaction Plan</th>
                  <th rowSpan={3}>Disposable Plan</th>
                </tr>

                {/* ── Row 2 of Table Header ── */}
                <tr>
                  <th rowSpan={2}>NO</th>
                  <th rowSpan={2}>Product</th>
                  <th rowSpan={2}>Process</th>
                  <th rowSpan={2}>Product/Process specification/tolerance</th>
                  <th rowSpan={2}>Evalution /Measurement Technique</th>
                  <th rowSpan={2}>size</th>
                  <th rowSpan={2}>Freq.</th>
                  <th colSpan={4}>Control method</th>
                </tr>

                {/* ── Row 3 of Table Header ── */}
                <tr>
                  <th>Prevention</th>
                  <th>Detection</th>
                  <th>Recording</th>
                  <th>Resp.</th>
                </tr>
              </thead>

              <tbody>
                {visibleRows.map((row, idx) => (
                  <ControlPlanRow
                    key={row.id || `row_${idx}`}
                    row={row}
                    idx={idx}
                    onCellChange={handleCellChange}
                    onDeleteRow={handleDeleteRow}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── 4. BOTTOM SECTIONS ── */}
          <div className="cp-bottom-container">
            {/* Ramp up line */}
            <div className="cp-rampup-line">
              <span>&#169;- Additional control require during Ramp up</span>
            </div>

            {/* Legends Box */}
            <div className="cp-legend-wrapper">
              {/* Characteristics Legends */}
              <div className="cp-char-legends">
                <div className="cp-legend-item">
                  <span className="cp-char-badge-c">
                    <span>C</span>
                  </span>
                  <span>for internal Special Characteristics</span>
                </div>
                <div className="cp-legend-item">
                  <span
                    className="inline-flex items-center justify-center w-4 h-4 border border-black rotate-45"
                    style={{ margin: '2px' }}
                  >
                    <span className="w-2 h-2 rounded-full border border-black" />
                  </span>
                  <span>for Customer Special Characteristics</span>
                </div>
                <div className="cp-legend-item">
                  <span className="cp-char-badge-ar">AR</span>
                  <span>for compliance to law & regulation requirement</span>
                </div>
                <div className="cp-legend-item">
                  <span className="cp-poka-badge">P</span>
                  <span>for Poka-Yoke</span>
                </div>
              </div>

              {/* Legends for Responsibility */}
              <div className="cp-resp-legends-box">
                <div className="cp-resp-title-cell">
                  Legends for
                  <br />
                  Responsibility
                </div>
                <table className="cp-resp-table">
                  <tbody>
                    <tr>
                      <td>Operator</td>
                      <td>O</td>
                    </tr>
                    <tr>
                      <td>Inspector</td>
                      <td>I</td>
                    </tr>
                    <tr>
                      <td>Rework Operator</td>
                      <td>R</td>
                    </tr>
                    <tr>
                      <td>Technician</td>
                      <td>T</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Revision History Table */}
            <div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-800">Revision History:</span>
                <button
                  type="button"
                  onClick={handleAddRevRow}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Revision
                </button>
              </div>
              <table className="cp-rev-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Rev No.</th>
                    <th style={{ width: '130px' }}>Rev Date</th>
                    <th>Revision Detail</th>
                    <th style={{ width: '180px' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionHistory.map((rev, idx) => (
                    <tr key={idx}>
                      <td className="text-center font-bold">
                        <CellTextarea
                          value={rev.revNo}
                          onChange={(v) => handleRevChange(idx, 'revNo', v)}
                          className="text-center"
                        />
                      </td>
                      <td className="text-center">
                        <CellTextarea
                          value={rev.revDate}
                          onChange={(v) => handleRevChange(idx, 'revDate', v)}
                          className="text-center"
                        />
                      </td>
                      <td>
                        <CellTextarea
                          value={rev.revisionDetail}
                          onChange={(v) => handleRevChange(idx, 'revisionDetail', v)}
                        />
                      </td>
                      <td className="text-center">
                        <CellTextarea
                          value={rev.remarks}
                          onChange={(v) => handleRevChange(idx, 'remarks', v)}
                          className="text-center font-medium"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Supplier Sign-off (Manager Level) */}
            <div>
              <div className="pb-1">
                <span className="text-xs font-bold text-slate-800">
                  Supplier Sign-off (Manager Level)
                </span>
              </div>
              <table className="cp-signoff-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}></th>
                    <th className="cp-signoff-header-cell">
                      Project Leader
                      <br />
                      Name & Contact No.
                    </th>
                    <th className="cp-signoff-header-cell">Process Engineering</th>
                    <th className="cp-signoff-header-cell">QA</th>
                    <th className="cp-signoff-header-cell">Production</th>
                    <th className="cp-signoff-header-cell">Maintenance</th>
                    <th className="cp-signoff-header-cell">Logistic</th>
                    <th className="cp-signoff-header-cell">Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Name */}
                  <tr>
                    <td className="cp-signoff-label-cell">Name</td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.projectLeader}
                        onChange={(v) => handleSignOffPlantChange('projectLeader', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.processEngineering}
                        onChange={(v) => handleSignOffPlantChange('processEngineering', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.qa}
                        onChange={(v) => handleSignOffPlantChange('qa', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.production}
                        onChange={(v) => handleSignOffPlantChange('production', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.maintenance}
                        onChange={(v) => handleSignOffPlantChange('maintenance', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.logistic}
                        onChange={(v) => handleSignOffPlantChange('logistic', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <CellTextarea
                        value={signOff?.plantLevel?.purchase}
                        onChange={(v) => handleSignOffPlantChange('purchase', v)}
                        className="text-center font-bold"
                      />
                    </td>
                  </tr>

                  {/* Row 2: Signature Plant level */}
                  <tr style={{ height: '36px' }}>
                    <td className="cp-signoff-label-cell">Signature Plant level</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                  </tr>

                  {/* Row 3: Centerlize Names */}
                  <tr>
                    <td className="cp-signoff-label-cell"></td>
                    <td></td>
                    <td className="text-center">
                      <div className="text-[10px] text-slate-500 font-semibold">
                        Process Engineering Centerlize
                      </div>
                      <CellTextarea
                        value={signOff?.centerlizeLevel?.processEngineeringCenterlize}
                        onChange={(v) =>
                          handleSignOffCenterChange('processEngineeringCenterlize', v)
                        }
                        className="text-center font-bold"
                      />
                    </td>
                    <td className="text-center">
                      <div className="text-[10px] text-slate-500 font-semibold">
                        Quality Centerlize
                      </div>
                      <CellTextarea
                        value={signOff?.centerlizeLevel?.qualityCenterlize}
                        onChange={(v) => handleSignOffCenterChange('qualityCenterlize', v)}
                        className="text-center font-bold"
                      />
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>

                  {/* Row 4: Signature Centerlize level */}
                  <tr style={{ height: '36px' }}>
                    <td className="cp-signoff-label-cell">Signature Centerlize level</td>
                    <td></td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td className="text-center text-slate-400 italic text-[10px]">Signed</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast message ── */}
      {toastMessage && (
        <div className="cp-toast">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </main>
  );
}
