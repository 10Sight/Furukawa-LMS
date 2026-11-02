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
import './ProcessFlowChartSheet.css';
import {
  PFC_PART_NUMBERS,
  INITIAL_PFC_METADATA,
  INITIAL_PFC_ROWS,
  INITIAL_PFC_REVISION_HISTORY,
  INITIAL_PFC_SIGN_OFF,
} from './processFlowChartInitialData';
import {
  saveProcessFlowChartSheet,
  loadProcessFlowChartSheet,
  getInitialSyncPfcState,
} from './processFlowChartStorage';
import FlowchartDiagramCell from './FlowchartDiagramCell';
import {
  OperationSymbol,
  InspectionSymbol,
  OpInspSymbol,
  TempStorageSymbol,
  StorageSymbol,
  TransportSymbol,
  ReworkSymbol,
  InternalCharSymbol,
  ExternalCharSymbol,
} from './FlowchartSymbols';

/**
 * Cell textarea component
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
    el.style.height = `${Math.max(el.scrollHeight, 20)}px`;
    onChange?.(el.value);
  };

  const handleFocus = (e) => {
    const el = e.target;
    if (el.scrollHeight > el.clientHeight + 4) {
      el.style.height = `${Math.max(el.scrollHeight, 20)}px`;
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
      className={`pfc-cell-textarea ${className}`}
      style={style}
    />
  );
});

/**
 * Memoized row component
 */
const ProcessFlowChartRow = memo(function ProcessFlowChartRow({
  row,
  idx,
  partNumbers,
  onCellChange,
  onToggleSymbol,
  onToggleSpInternal,
  onToggleSpCustomer,
  onTogglePart,
  onDeleteRow,
}) {
  return (
    <tr>
      {/* Action / Row Index */}
      <td className="pfc-cell-center text-slate-400 font-mono text-[10px]">
        <div className="relative group flex items-center justify-center">
          <span className="group-hover:hidden">{idx + 1}</span>
          <button
            type="button"
            onClick={() => onDeleteRow(row.id)}
            className="hidden group-hover:inline-flex pfc-btn-del-row"
            title="Delete row"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>

      {/* Col 1: No */}
      <td className="pfc-cell-center font-bold">
        <CellTextarea
          value={row.opNo}
          onChange={(v) => onCellChange(row.id, 'opNo', v)}
          className="text-center font-bold"
        />
      </td>

      {/* Col 2: Process */}
      <td className="font-semibold">
        <CellTextarea
          value={row.procName}
          onChange={(v) => onCellChange(row.id, 'procName', v)}
        />
      </td>

      {/* Col 3: Incoming Source of variation */}
      <td>
        <CellTextarea
          value={row.incoming}
          onChange={(v) => onCellChange(row.id, 'incoming', v)}
        />
      </td>

      {/* Col 4: Process flow chart (Continuous flowchart lines + symbols) */}
      <td className="p-0 overflow-hidden pfc-cell-flowchart">
        <FlowchartDiagramCell
          row={row}
          onToggleSymbol={onToggleSymbol}
        />
      </td>

      {/* Col 5: Characteristics - Product */}
      <td>
        <CellTextarea
          value={row.charProduct}
          onChange={(v) => onCellChange(row.id, 'charProduct', v)}
        />
      </td>

      {/* Col 6: Characteristics - Process */}
      <td>
        <CellTextarea
          value={row.charProcess}
          onChange={(v) => onCellChange(row.id, 'charProcess', v)}
        />
      </td>

      {/* Col 7: Special characteristic - Customer (<e>) */}
      <td className="pfc-cell-center">
        <button
          type="button"
          onClick={() => onToggleSpCustomer(row.id)}
          className="pfc-symbol-btn"
          title="Click to toggle Customer Special Characteristic (<e>)"
        >
          {row.spCustomer ? (
            <ExternalCharSymbol />
          ) : (
            <span className="text-slate-300 font-light">-</span>
          )}
        </button>
      </td>

      {/* Col 8: Special characteristic - Internal (<C>) */}
      <td className="pfc-cell-center">
        <button
          type="button"
          onClick={() => onToggleSpInternal(row.id)}
          className="pfc-symbol-btn"
          title="Click to toggle Internal Special Characteristic (<C>)"
        >
          {row.spInternal ? (
            <InternalCharSymbol />
          ) : (
            <span className="text-slate-300 font-light">-</span>
          )}
        </button>
      </td>

      {/* Col 9: Inspection */}
      <td className="pfc-cell-center font-bold">
        <CellTextarea
          value={row.inspection}
          onChange={(v) => onCellChange(row.id, 'inspection', v)}
          className="text-center"
        />
      </td>

      {/* Col 10: Tools to be Use */}
      <td>
        <CellTextarea
          value={row.tools}
          onChange={(v) => onCellChange(row.id, 'tools', v)}
        />
      </td>

      {/* Col 11: Remarks */}
      <td>
        <CellTextarea
          value={row.remarks}
          onChange={(v) => onCellChange(row.id, 'remarks', v)}
        />
      </td>

      {/* Part Number Columns (22 Part columns) */}
      {partNumbers.map((part) => {
        const val = row.partApplicability?.[part] ?? '√';
        const isOk = val === '√' || val === '✓' || val === 'OK';
        const isCross = val === 'X' || val === 'x';
        return (
          <td key={part} className="pfc-cell-center p-0">
            <button
              type="button"
              onClick={() => onTogglePart(row.id, part)}
              className={`pfc-tick-btn ${isOk ? 'pfc-tick-ok' : isCross ? 'pfc-tick-no' : 'text-slate-400'}`}
              title={`${part}: ${val} (Click to toggle)`}
            >
              {val}
            </button>
          </td>
        );
      })}
    </tr>
  );
});

export default function ProcessFlowChartSheet({ doc, onBack, showToast }) {
  const sheetId = doc?.id || 'pfc_default';

  // Instant initial load: try synchronous state first, fallback to initial data
  const getInitialState = () => {
    const syncSaved = getInitialSyncPfcState(sheetId);
    if (syncSaved) {
      return {
        metadata: {
          ...INITIAL_PFC_METADATA,
          ...(doc?.metadata || {}),
          ...(syncSaved.metadata || {}),
        },
        rows:
          Array.isArray(syncSaved.rows) && syncSaved.rows.length > 0
            ? syncSaved.rows
            : doc?.rows || INITIAL_PFC_ROWS,
        revisionHistory:
          syncSaved.revisionHistory || doc?.revisionHistory || INITIAL_PFC_REVISION_HISTORY,
        signOff: syncSaved.signOff || doc?.signOff || INITIAL_PFC_SIGN_OFF,
      };
    }
    return {
      metadata: {
        ...INITIAL_PFC_METADATA,
        ...(doc?.metadata || {}),
      },
      rows: doc?.rows || INITIAL_PFC_ROWS,
      revisionHistory: doc?.revisionHistory || INITIAL_PFC_REVISION_HISTORY,
      signOff: doc?.signOff || INITIAL_PFC_SIGN_OFF,
    };
  };

  const [initialData] = useState(getInitialState);
  const [metadata, setMetadata] = useState(initialData.metadata);
  const [rows, setRows] = useState(initialData.rows);
  const [revisionHistory, setRevisionHistory] = useState(initialData.revisionHistory);
  const [signOff, setSignOff] = useState(initialData.signOff);

  // Load from IndexedDB asynchronously if updated
  useEffect(() => {
    let isMounted = true;
    loadProcessFlowChartSheet(sheetId).then((idbRecord) => {
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
        revisionHistory: [...revisionHistory],
        signOff: JSON.parse(JSON.stringify(signOff)),
      },
    ]);
    setRedoStack([]);
  }, [rows, metadata, revisionHistory, signOff]);

  // Generic metadata change
  const handleMetadataChange = (field, value) => {
    pushSnapshot();
    setMetadata((prev) => ({ ...prev, [field]: value }));
  };

  // Cell change handler
  const handleCellChange = useCallback(
    (rowId, field, value) => {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  // Toggle flowchart symbol
  const handleToggleSymbol = useCallback(
    (rowId) => {
      pushSnapshot();
      const cycle = [
        { type: 'operation', symbol: 'O' },
        { type: 'inspection', symbol: '◇' },
        { type: 'op-insp', symbol: 'op-insp' },
        { type: 'storage', symbol: 'D' },
        { type: 'storage', symbol: '▽' },
        { type: 'rework', symbol: '◎' },
      ];
      setRows((prev) =>
        prev.map((r) => {
          if (r.id === rowId) {
            const currentIdx = cycle.findIndex(
              (c) => c.type === r.flowchartType && (c.symbol === r.flowchartSymbol || !r.flowchartSymbol)
            );
            const next = cycle[(currentIdx + 1) % cycle.length];
            return {
              ...r,
              flowchartType: next.type,
              flowchartSymbol: next.symbol,
            };
          }
          return r;
        })
      );
    },
    [pushSnapshot]
  );

  // Toggle Internal Special Characteristic <C>
  const handleToggleSpInternal = useCallback(
    (rowId) => {
      pushSnapshot();
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, spInternal: r.spInternal ? '' : '⟨C⟩' } : r
        )
      );
    },
    [pushSnapshot]
  );

  // Toggle Customer Special Characteristic <e>
  const handleToggleSpCustomer = useCallback(
    (rowId) => {
      pushSnapshot();
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, spCustomer: r.spCustomer ? '' : '⟨e⟩' } : r
        )
      );
    },
    [pushSnapshot]
  );

  // Toggle part applicability: '√' -> 'X' -> '-' -> '√'
  const handleTogglePart = useCallback(
    (rowId, partNumber) => {
      pushSnapshot();
      const cycle = ['√', 'X', '-'];
      setRows((prev) =>
        prev.map((r) => {
          if (r.id === rowId) {
            const currentVal = r.partApplicability?.[partNumber] ?? '√';
            const currIdx = cycle.indexOf(currentVal);
            const nextVal = cycle[(currIdx + 1) % cycle.length];
            return {
              ...r,
              partApplicability: {
                ...(r.partApplicability || {}),
                [partNumber]: nextVal,
              },
            };
          }
          return r;
        })
      );
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
    const defaultParts = {};
    PFC_PART_NUMBERS.forEach((p) => {
      defaultParts[p] = '√';
    });
    const newRow = {
      id: `pfc_row_${Date.now()}`,
      opNo: '',
      procName: '',
      incoming: '',
      flowchartSymbol: 'O',
      flowchartType: 'operation',
      flowchartTrack: 10,
      vLines: [{ track: 10, from: 'top', to: 'bottom' }],
      hLines: [],
      arrows: [],
      charProduct: '',
      charProcess: '',
      spCustomer: '',
      spInternal: '',
      inspection: '',
      tools: '',
      remarks: '',
      partApplicability: defaultParts,
    };
    setRows((prev) => [...prev, newRow]);
  }, [pushSnapshot]);

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
      await saveProcessFlowChartSheet(sheetId, payload);

      const savedDocsRaw = localStorage.getItem('process_flow_chart_custom_sheets');
      let customSheets = savedDocsRaw ? JSON.parse(savedDocsRaw) : [];
      const cleanDocMeta = {
        id: sheetId,
        title: doc?.title || metadata.title || 'Process Flow Chart',
        code: metadata.pfcNo,
        pfcNo: metadata.pfcNo,
        customer: metadata.customerName,
        partNumber: metadata.partNumber,
        partName: metadata.partName,
        project: metadata.project,
        unit: doc?.unit || 'Bawal',
        status: doc?.status || 'Approved',
        revDate: metadata.revDate,
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
        localStorage.setItem('process_flow_chart_custom_sheets', JSON.stringify(customSheets));
      } catch (e) {
        console.warn('LocalStorage metadata sync warning:', e);
      }

      displayToast('Process Flow Chart sheet saved successfully');
    } catch (err) {
      console.error('Error saving Process Flow Chart sheet:', err);
      displayToast('Error saving Process Flow Chart sheet', 'error');
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
          .replace(/\//g, '-'),
        changeContent: '',
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
      centralizeLevel: {
        ...prev.centralizeLevel,
        [field]: val,
      },
    }));
  };

  return (
    <main className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100 pfc-sheet-container">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR (EXACT ORDER AS REQUESTED:
             Back, Save, Undo (icon only), Redo (icon only), + Add row)
      ────────────────────────────────────────────────────────────── */}
      <header className="pfc-top-bar">
        <div className="pfc-actions-group">
          {/* 1. Back */}
          <button
            type="button"
            onClick={onBack}
            className="pfc-btn-back"
            title="Return to the Process Flow Chart main page"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>

          {/* 2. Save */}
          <button
            type="button"
            onClick={handleSave}
            className="pfc-btn-save"
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
            className="pfc-btn-icon-only"
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
            className="pfc-btn-icon-only"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          {/* 5. + Add row */}
          <button
            type="button"
            onClick={handleAddRow}
            className="pfc-btn-add-row"
            title="Add a new row to the table"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add row</span>
          </button>
        </div>

        {/* Right side metadata info & zoom */}
        <div className="pfc-top-meta">
          <span className="pfc-doc-badge">
            {metadata.pfcNo || 'PFC-WH-PE-MSIL-YHB -002'} | {rows.length} Operations
          </span>

          <div className="pfc-zoom-controls">
            <button
              type="button"
              className="pfc-zoom-btn"
              onClick={() => setZoomScale((s) => Math.max(0.7, Number((s - 0.1).toFixed(1))))}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="pfc-zoom-text">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              className="pfc-zoom-btn"
              onClick={() => setZoomScale((s) => Math.min(1.4, Number((s + 0.1).toFixed(1))))}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="pfc-zoom-btn"
              onClick={() => setZoomScale(1)}
              title="Reset Zoom"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="pfc-toast-pill">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. SCROLLABLE WORKBOOK CONTENT
      ────────────────────────────────────────────────────────────── */}
      <div className="pfc-content-scroll flex-1 overflow-auto p-4 md:p-6">
        <div
          className="pfc-sheet-canvas shadow-xl border border-slate-300 rounded-sm bg-white"
          style={{
            zoom: zoomScale,
            minWidth: '2200px',
          }}
        >
          {/* ── 1. HEADER TITLE BAR (Company Logo & Title) ── */}
          <div className="pfc-doc-header">
            <div className="flex items-center gap-3">
              <span className="pfc-logo-text">Fme</span>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-tight">
                Furukawa Minda
                <br />
                Electric Pvt. Ltd.
              </div>
            </div>
            <div className="text-center font-bold text-xs uppercase tracking-wider text-slate-800">
              FURUKAWA MINDA ELECTRIC PVT. LTD.
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              Rev. Level: {metadata.issueLevel || '05'}
            </div>
          </div>

          <div className="text-center font-bold text-sm tracking-wide py-1 border-b border-slate-400 bg-slate-50/50">
            Process Flow Chart
          </div>

          {/* ── 2. METADATA INFORMATION BLOCK ── */}
          <div className="pfc-metadata-grid">
            {/* Top row: Checkboxes for doc type */}
            <div className="pfc-meta-row border-b border-slate-300 bg-slate-50/30">
              <div className="flex items-center gap-6 text-xs font-semibold px-2 py-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="docType"
                    checked={metadata.docType === 'Prototype'}
                    onChange={() => handleMetadataChange('docType', 'Prototype')}
                    className="accent-blue-600"
                  />
                  <span>Prototype</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="docType"
                    checked={metadata.docType === 'Prelaunch'}
                    onChange={() => handleMetadataChange('docType', 'Prelaunch')}
                    className="accent-blue-600"
                  />
                  <span>Prelaunch</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="docType"
                    checked={metadata.docType === 'Production'}
                    onChange={() => handleMetadataChange('docType', 'Production')}
                    className="accent-blue-600"
                  />
                  <span>Production</span>
                </label>
              </div>
            </div>

            {/* 3 Columns metadata block */}
            <div className="grid grid-cols-12 divide-x divide-slate-300 text-xs">
              {/* Col Left (Cols 1-4) */}
              <div className="col-span-4 p-2 space-y-1.5">
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Customer Name:</span>
                  <input
                    type="text"
                    value={metadata.customerName}
                    onChange={(e) => handleMetadataChange('customerName', e.target.value)}
                    className="pfc-meta-input font-bold"
                  />
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Part Number:</span>
                  <input
                    type="text"
                    value={metadata.partNumber}
                    onChange={(e) => handleMetadataChange('partNumber', e.target.value)}
                    className="pfc-meta-input font-bold text-blue-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="pfc-meta-field">
                    <span className="pfc-meta-label">Issue Level:</span>
                    <input
                      type="text"
                      value={metadata.issueLevel}
                      onChange={(e) => handleMetadataChange('issueLevel', e.target.value)}
                      className="pfc-meta-input font-bold"
                    />
                  </div>
                  <div className="pfc-meta-field">
                    <span className="pfc-meta-label">Drawing Level:</span>
                    <input
                      type="text"
                      value={metadata.drawingLevel}
                      onChange={(e) => handleMetadataChange('drawingLevel', e.target.value)}
                      className="pfc-meta-input"
                    />
                  </div>
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Design Note No.:</span>
                  <input
                    type="text"
                    value={metadata.designNoteNo}
                    onChange={(e) => handleMetadataChange('designNoteNo', e.target.value)}
                    className="pfc-meta-input"
                  />
                </div>
              </div>

              {/* Col Mid (Cols 5-8) */}
              <div className="col-span-5 p-2 space-y-1.5">
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Supplier Plant:</span>
                  <input
                    type="text"
                    value={metadata.supplierPlant}
                    onChange={(e) => handleMetadataChange('supplierPlant', e.target.value)}
                    className="pfc-meta-input"
                  />
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Part Name:</span>
                  <input
                    type="text"
                    value={metadata.partName}
                    onChange={(e) => handleMetadataChange('partName', e.target.value)}
                    className="pfc-meta-input font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="pfc-meta-field">
                    <span className="pfc-meta-label">PFC Date (Original):</span>
                    <input
                      type="text"
                      value={metadata.pfcDateOriginal}
                      onChange={(e) => handleMetadataChange('pfcDateOriginal', e.target.value)}
                      className="pfc-meta-input"
                    />
                  </div>
                  <div className="pfc-meta-field">
                    <span className="pfc-meta-label">Rev. Date:</span>
                    <input
                      type="text"
                      value={metadata.revDate}
                      onChange={(e) => handleMetadataChange('revDate', e.target.value)}
                      className="pfc-meta-input"
                    />
                  </div>
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Reason:</span>
                  <input
                    type="text"
                    value={metadata.reasonForReissue}
                    onChange={(e) => handleMetadataChange('reasonForReissue', e.target.value)}
                    className="pfc-meta-input font-bold"
                  />
                </div>
              </div>

              {/* Col Right (Cols 9-12) */}
              <div className="col-span-3 p-2 space-y-1.5">
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Supplier Code:</span>
                  <input
                    type="text"
                    value={metadata.supplierCode}
                    onChange={(e) => handleMetadataChange('supplierCode', e.target.value)}
                    className="pfc-meta-input font-mono font-bold"
                  />
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">Project:</span>
                  <input
                    type="text"
                    value={metadata.project}
                    onChange={(e) => handleMetadataChange('project', e.target.value)}
                    className="pfc-meta-input font-bold"
                  />
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">PFC Key Date:</span>
                  <input
                    type="text"
                    value={metadata.pfcKeyDate}
                    onChange={(e) => handleMetadataChange('pfcKeyDate', e.target.value)}
                    className="pfc-meta-input"
                  />
                </div>
                <div className="pfc-meta-field">
                  <span className="pfc-meta-label">PFC No.</span>
                  <input
                    type="text"
                    value={metadata.pfcNo}
                    onChange={(e) => handleMetadataChange('pfcNo', e.target.value)}
                    className="pfc-meta-input font-bold"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. MAIN TABLE ── */}
          <div className="pfc-table-wrapper">
            <table className="pfc-table">
              <colgroup>
                <col style={{ width: '38px' }} /> {/* # Index */}
                <col style={{ width: '45px' }} /> {/* No */}
                <col style={{ width: '150px' }} /> {/* Process */}
                <col style={{ width: '160px' }} /> {/* Incoming Source */}
                <col style={{ width: '250px' }} /> {/* Process flow chart (with lines) */}
                <col style={{ width: '180px' }} /> {/* Characteristics - Product */}
                <col style={{ width: '160px' }} /> {/* Characteristics - Process */}
                <col style={{ width: '42px' }} /> {/* Sp Customer */}
                <col style={{ width: '42px' }} /> {/* Sp Internal */}
                <col style={{ width: '45px' }} /> {/* Inspection */}
                <col style={{ width: '130px' }} /> {/* Tools */}
                <col style={{ width: '130px' }} /> {/* Remarks */}
                {/* 22 Part Columns */}
                {PFC_PART_NUMBERS.map((p) => (
                  <col key={p} style={{ width: '32px' }} />
                ))}
              </colgroup>

              <thead>
                {/* Header Row 1 */}
                <tr>
                  <th rowSpan={2} style={{ width: '38px' }}>#</th>
                  <th rowSpan={2}>No</th>
                  <th rowSpan={2}>Process</th>
                  <th rowSpan={2}>Incoming Source of variation</th>
                  <th rowSpan={2}>Process flow chart</th>
                  <th colSpan={2}>Characteristics</th>
                  <th colSpan={2}>Special characteristic</th>
                  <th rowSpan={2}>Inspection</th>
                  <th rowSpan={2}>Tools to be Use</th>
                  <th rowSpan={2}>Remarks</th>
                  <th colSpan={PFC_PART_NUMBERS.length}>YHB_RC25</th>
                </tr>

                {/* Header Row 2 */}
                <tr>
                  <th>Product</th>
                  <th>Process</th>
                  <th title="Customer Special Characteristic (<e>)">
                    <ExternalCharSymbol width={13} height={20} />
                  </th>
                  <th title="Internal Special Characteristic (<C>)">
                    <InternalCharSymbol width={13} height={20} />
                  </th>
                  {PFC_PART_NUMBERS.map((part) => (
                    <th key={part} className="p-0">
                      <div className="pfc-th-vertical" title={part}>
                        {part}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => (
                  <ProcessFlowChartRow
                    key={row.id || `row_${idx}`}
                    row={row}
                    idx={idx}
                    partNumbers={PFC_PART_NUMBERS}
                    onCellChange={handleCellChange}
                    onToggleSymbol={handleToggleSymbol}
                    onToggleSpInternal={handleToggleSpInternal}
                    onToggleSpCustomer={handleToggleSpCustomer}
                    onTogglePart={handleTogglePart}
                    onDeleteRow={handleDeleteRow}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── 4. BOTTOM SECTIONS ── */}
          <div className="pfc-bottom-container">
            {/* JIS Line */}
            <div className="pfc-jis-line font-bold text-slate-800">
              * Process flow symbol shall be followed JIS Z8206.
            </div>

            {/* Symbol Legends Banner (JIS Z8206) matching user uploaded reference */}
            <div className="pfc-symbol-legend-banner">
              <div className="pfc-legend-item">
                <OperationSymbol size={16} />
                <span>"O : Operation"</span>
              </div>
              <div className="pfc-legend-item">
                <InspectionSymbol size={16} />
                <span>"◇: Quality inspection"</span>
              </div>
              <div className="pfc-legend-item">
                <TempStorageSymbol size={16} />
                <span>"D : Temporary Storage"</span>
              </div>
              <div className="pfc-legend-item">
                <OpInspSymbol size={18} />
                <span>Operation & inspection</span>
              </div>
              <div className="pfc-legend-item">
                <TransportSymbol size={18} />
                <span>Transportation</span>
              </div>
              <div className="pfc-legend-item">
                <StorageSymbol size={16} />
                <span>Storage</span>
              </div>
              <div className="pfc-legend-item">
                <InternalCharSymbol width={13} height={20} />
                <span>For Internal special characteristics</span>
              </div>
              <div className="pfc-legend-item">
                <ExternalCharSymbol width={13} height={20} />
                <span>For external special characteristics</span>
              </div>
            </div>

            {/* Revision History Table */}
            <div>
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-800">Revision history:</span>
                <button
                  type="button"
                  onClick={handleAddRevRow}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Revision</span>
                </button>
              </div>

              <table className="pfc-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Rev No.</th>
                    <th style={{ width: '130px' }}>Rev Date</th>
                    <th>Change Contents</th>
                    <th style={{ width: '160px' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionHistory.map((rev, idx) => (
                    <tr key={idx}>
                      <td className="pfc-cell-center font-bold">
                        <CellTextarea
                          value={rev.revNo}
                          onChange={(v) => handleRevChange(idx, 'revNo', v)}
                          className="text-center font-bold"
                        />
                      </td>
                      <td className="pfc-cell-center">
                        <CellTextarea
                          value={rev.revDate}
                          onChange={(v) => handleRevChange(idx, 'revDate', v)}
                          className="text-center font-mono text-xs"
                        />
                      </td>
                      <td>
                        <CellTextarea
                          value={rev.changeContent}
                          onChange={(v) => handleRevChange(idx, 'changeContent', v)}
                        />
                      </td>
                      <td className="pfc-cell-center text-xs">
                        <CellTextarea
                          value={rev.remarks}
                          onChange={(v) => handleRevChange(idx, 'remarks', v)}
                          className="text-center"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Plant Level Sign-off Table */}
            <div>
              <div className="text-xs font-bold text-slate-800 pb-1">
                Supplier Sign-off (Plant Level)
              </div>
              <table className="pfc-table text-xs">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Role</th>
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
                  <tr>
                    <td className="font-bold bg-slate-50 text-slate-700">Name</td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.projectLeader}
                        onChange={(v) => handleSignOffPlantChange('projectLeader', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.processEng}
                        onChange={(v) => handleSignOffPlantChange('processEng', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.qaqc}
                        onChange={(v) => handleSignOffPlantChange('qaqc', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.production}
                        onChange={(v) => handleSignOffPlantChange('production', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.maintenance}
                        onChange={(v) => handleSignOffPlantChange('maintenance', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.logistic}
                        onChange={(v) => handleSignOffPlantChange('logistic', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.plantLevel.purchase}
                        onChange={(v) => handleSignOffPlantChange('purchase', v)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold bg-slate-50 text-slate-700">Signature</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Centralize Level Sign-off Table */}
            <div>
              <div className="text-xs font-bold text-slate-800 pb-1">
                Supplier Sign-off (Centralize Level)
              </div>
              <table className="pfc-table text-xs">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Role</th>
                    <th>Process Engineering Centerlize</th>
                    <th>Quality Centerlize</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold bg-slate-50 text-slate-700">Name</td>
                    <td>
                      <CellTextarea
                        value={signOff.centralizeLevel.processEngCenterlize}
                        onChange={(v) => handleSignOffCenterChange('processEngCenterlize', v)}
                      />
                    </td>
                    <td>
                      <CellTextarea
                        value={signOff.centralizeLevel.qualityCenterlize}
                        onChange={(v) => handleSignOffCenterChange('qualityCenterlize', v)}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold bg-slate-50 text-slate-700">Signature</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                    <td className="text-center text-slate-400 italic font-mono text-[11px]">Approved</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
