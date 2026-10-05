import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

/**

 * AutoResizeTextarea
 * - Grows automatically whenever content overflows (or Shift+Enter is pressed)
 * - Shrinks only when Backspace is pressed (recalculates from scratch)
 * - All other props are passed directly to <textarea>
 */
function AutoResizeTextarea({ value, onChange, className = '', minRows = 2, ...rest }) {
  const ref = useRef(null);
  const isBackspace = useRef(false);

  // Measure natural scroll-height and apply it
  const resize = useCallback((shrinkAllowed) => {
    const el = ref.current;
    if (!el) return;
    // Temporarily collapse to measure real scrollHeight
    el.style.height = '0px';
    const needed = el.scrollHeight;
    const lineH = parseInt(getComputedStyle(el).lineHeight) || 18;
    const minH = lineH * minRows + 8; // 8px padding
    if (shrinkAllowed) {
      el.style.height = Math.max(minH, needed) + 'px';
    } else {
      // Never shrink – only grow
      const current = parseInt(el.dataset.lastH || '0');
      const next = Math.max(minH, needed, current);
      el.style.height = next + 'px';
      el.dataset.lastH = String(next);
    }
  }, [minRows]);

  // Run resize after every value change
  useEffect(() => {
    resize(isBackspace.current);
    isBackspace.current = false;
  }, [value, resize]);

  // Seed lastH on mount
  useEffect(() => {
    const el = ref.current;
    if (el) { el.dataset.lastH = '0'; resize(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') isBackspace.current = true;
    rest.onKeyDown?.(e);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      rows={minRows}
      className={`resize-none overflow-hidden ${className}`}
      style={{ height: 'auto' }}
      {...rest}
    />
  );
}

export const INITIAL_CHECKPOINTS = [
  {
    id: 1,
    sNo: 1,
    checkPoint: 'Bar code scanning system',
    requirement: 'Scanning of parts barcode at receiving and issue stages.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 2,
    sNo: 2,
    checkPoint: 'Ensure first-in-first-out precisely with the parts tag or lot display etc.',
    requirement: 'FIFO racks & color code tags applied.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 3,
    sNo: 3,
    checkPoint: 'Part identification and traceability tags on all bins and storage racks',
    requirement: 'Each bin must display Part Number, Description, Supplier Code, and Lot Date.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 4,
    sNo: 4,
    checkPoint: 'Segregation and red tag identification for rejected or suspect parts',
    requirement: 'Designated locked quarantine area with red boundary markings and logbook.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 5,
    sNo: 5,
    checkPoint: 'Storage area environmental control (temperature, humidity, dust prevention)',
    requirement: 'Daily temperature and humidity logging for terminal & rubber components.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 6,
    sNo: 6,
    checkPoint: 'Electrostatic discharge (ESD) protection in handling electronic terminals & sensors',
    requirement: 'ESD mat grounding, wrist straps for operators, anti-static bins.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 7,
    sNo: 7,
    checkPoint: 'Calibration and validity of measuring instruments & weighing scales',
    requirement: 'Calibration sticker with due date displayed on all weighing equipment.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 8,
    sNo: 8,
    checkPoint: 'Standard Operating Procedure (SOP) and Work Instructions display at workstations',
    requirement: 'Latest revision SOP displayed at receiving inspection & kitting table.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 9,
    sNo: 9,
    checkPoint: 'Safety PPE compliance by all warehouse and material handling personnel',
    requirement: 'Safety shoes, high-visibility vest, cut-resistant gloves in use.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 10,
    sNo: 10,
    checkPoint: 'Material handling equipment safety check (battery pallet trucks, stackers, trolleys)',
    requirement: 'Pre-operational daily inspection checklist filled before operation.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 11,
    sNo: 11,
    checkPoint: 'Shelf life and expiry tracking for adhesive tapes, sealants & rubber grommets',
    requirement: 'First expiry first out (FEFO) followed with expiry matrix.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 12,
    sNo: 12,
    checkPoint: 'Stacking height limits and pallet arrangement according to packaging guidelines',
    requirement: 'Maximum 4 layers pallet stacking; no box overhanging pallet edge.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 13,
    sNo: 13,
    checkPoint: '5S condition of aisles, gangways, storage bays and trash bins',
    requirement: 'Yellow floor aisle markings clear; zero floor obstruction; clean bins.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 14,
    sNo: 14,
    checkPoint: 'Incoming delivery challan and invoice verification vs purchase order & actual qty',
    requirement: '100% box count & physical sample verification against vendor invoice.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 15,
    sNo: 15,
    checkPoint: 'Non-conforming material disposal and disposition authorization records',
    requirement: 'MRB (Material Review Board) sign-off for RTV (Return to Vendor) scrap.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 16,
    sNo: 16,
    checkPoint: 'Preservation and rust prevention coating on metal terminals, contacts & crimp parts',
    requirement: 'VCI packaging bags sealed; silica gel pouches placed inside bins.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 17,
    sNo: 17,
    checkPoint: 'Packaging integrity, moisture barrier bags & desiccant verification',
    requirement: 'Moisture barrier bags vacuum-sealed with humidity indicator card.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
  {
    id: 18,
    sNo: 18,
    checkPoint: 'Daily , weekly & monthly container schedule',
    requirement: 'Clean container rotation schedule followed.',
    evidence: '',
    observation: '',
    ncrStatus: '',
    remarks: '',
  },
];

export function getDefaultCheckSheetData(doc) {
  return {
    refCode: doc?.code || 'CHK-WH-QA-047',
    revNo: doc?.rev || 'Rev.No 06',
    revDate: doc?.revDate || '12.12.2022',
    department: '',
    date: '',
    processName: '',
    shifts: { A: false, B: false, G: false },
    auditor: '',
    auditees: '',
    partModal: '',
    controlPlan: '',
    latestRevControl: '',
    pfmeaPlan: '',
    latestRevPfmea: '',
    startTimeA: '',
    finishTimeA: '',
    startTimeB: '',
    finishTimeB: '',
    startTimeG: '',
    finishTimeG: '',
    checkPoints: INITIAL_CHECKPOINTS,
    sustenanceCheck: '',
    customerComplainReview: '',
    qualityImprovementSuggestions: '',
    kaizenPokaYokeSuggestions: '',
    auditorSign: '',
    auditeeSign: '',
    qaManager: '',
    footerRefCode: '',
    footerRevNo: '',
    footerRevDate: '',
    footerPage: '',
  };
}

export default function ProcessAuditCheckSheet({
  doc,
  onBack,
  selectedUnit,
  showToast,
}) {
  const storageKey = `process_audit_checksheet_v4_${doc?.id || 'default'}`;

  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.checkPoints)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return getDefaultCheckSheetData(doc);
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  }, [data, storageKey]);

  const updateField = (field, val) => {
    setData((prev) => ({ ...prev, [field]: val }));
  };

  const toggleShift = (shiftKey) => {
    setData((prev) => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [shiftKey]: !prev.shifts[shiftKey],
      },
    }));
  };

  const updateCheckPoint = (id, field, val) => {
    setData((prev) => ({
      ...prev,
      checkPoints: prev.checkPoints.map((cp) =>
        cp.id === id ? { ...cp, [field]: val } : cp
      ),
    }));
  };

  const setNcrStatus = (id, status) => {
    setData((prev) => ({
      ...prev,
      checkPoints: prev.checkPoints.map((cp) =>
        cp.id === id ? { ...cp, ncrStatus: cp.ncrStatus === status ? '' : status } : cp
      ),
    }));
  };

  const handleAddCheckPoint = () => {
    const nextSNo = data.checkPoints.length + 1;
    const newItem = {
      id: Date.now(),
      sNo: nextSNo,
      checkPoint: 'New Process Check Item',
      requirement: 'Requirement details...',
      evidence: '',
      observation: '',
      ncrStatus: '',
      remarks: '',
    };
    setData((prev) => ({
      ...prev,
      checkPoints: [...prev.checkPoints, newItem],
    }));
    showToast?.('Added new check item');
  };

  const handleDeleteCheckPoint = (id) => {
    if (data.checkPoints.length <= 1) {
      showToast?.('At least one checkpoint must remain');
      return;
    }
    setData((prev) => {
      const filtered = prev.checkPoints.filter((cp) => cp.id !== id);
      return {
        ...prev,
        checkPoints: filtered.map((cp, idx) => ({ ...cp, sNo: idx + 1 })),
      };
    });
    showToast?.('Removed check item');
  };

  const handleResetToStandard = () => {
    if (window.confirm('Reset this check sheet to standard template values?')) {
      const reset = getDefaultCheckSheetData(doc);
      setData(reset);
      showToast?.('Reset to standard template');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-200/90">
      {/* Top Controls Bar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-300 bg-white px-3 md:px-5 shadow-xs z-30 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition active:scale-95 cursor-pointer shadow-xs border border-slate-200"
            title="Back to Process Audit List"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-400 hidden md:inline">
              Process Audit / Check Sheet /
            </span>
            <span className="truncate text-xs md:text-sm font-bold text-slate-800">
              {doc?.title || 'PROCESS AUDIT CHECK SHEET'}
            </span>
            {selectedUnit && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200 shrink-0">
                Unit: {selectedUnit}
              </span>
            )}
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 shrink-0">
              {data.refCode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>Auto-saved</span>
          </div>

          <button
            type="button"
            onClick={handleAddCheckPoint}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer"
            title="Add Check Item"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Item</span>
          </button>

          <button
            type="button"
            onClick={handleResetToStandard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Reset to standard defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            title="Print or Save PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </header>

      {/* Main Viewport: Block container that allows natural vertical flow without clipping child height */}
      <div className="w-full flex-1 overflow-x-auto overflow-y-auto p-3 sm:p-6 md:p-8 pb-36">
        {/* Table wrapper centered horizontally */}
        <div className="mx-auto w-fit min-w-[1120px] max-w-[1240px] shadow-2xl bg-white mb-20">
          
          {/* Entire form is ONE single table with borderCollapse and outer border on all 4 sides */}
          <table
            className="w-full border-collapse bg-white text-black text-[11px] leading-tight select-text"
            style={{
              borderCollapse: 'collapse',
              border: '2.5px solid #000000',
              tableLayout: 'fixed',
              width: '100%',
            }}
          >
            <colgroup>
              <col style={{ width: '55px' }} />
              <col style={{ width: '260px' }} />
              <col style={{ width: '380px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '60px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '155px' }} />
            </colgroup>
            <tbody>
              
              {/* 1. TOP DOC CODE ROW */}
              <tr>
                <td colSpan={3} className="border border-black p-2 pl-3 font-bold text-[12px]">
                  <input
                    type="text"
                    value={data.refCode}
                    onChange={(e) => updateField('refCode', e.target.value)}
                    className="font-bold focus:outline-none w-44 uppercase bg-transparent"
                    aria-label="Document Code"
                  />
                </td>
                <td colSpan={3} className="border border-black p-2 text-center font-bold text-[12px]">
                  <span className="font-bold mr-1">Rev.No</span>
                  <input
                    type="text"
                    value={data.revNo}
                    onChange={(e) => updateField('revNo', e.target.value)}
                    className="font-bold focus:outline-none w-24 text-center bg-transparent"
                    aria-label="Revision Number"
                  />
                </td>
                <td colSpan={2} className="border border-black p-2 pr-3 text-right font-bold text-[12px]">
                  <span className="font-bold mr-1">Rev. date:</span>
                  <input
                    type="text"
                    value={data.revDate}
                    onChange={(e) => updateField('revDate', e.target.value)}
                    className="font-bold focus:outline-none w-24 text-right bg-transparent"
                    aria-label="Revision Date"
                  />
                </td>
              </tr>

              {/* 2. MAIN TITLE BANNER */}
              <tr className="bg-slate-50/60">
                <td colSpan={8} className="border-t-2 border-b-2 border-black py-2.5 text-center">
                  <h1 className="text-[18px] sm:text-[20px] font-black tracking-wider text-black uppercase m-0">
                    PROCESS AUDIT CHECK SHEET
                  </h1>
                </td>
              </tr>

              {/* 3. HEADER ROW 1: Department & Date */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50">
                  Department:
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.department}
                    onChange={(e) => updateField('department', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1 uppercase"
                    placeholder="e.g. STORE"
                    aria-label="Department"
                  />
                </td>
                <td colSpan={2} className="border border-black p-2 text-center font-bold bg-slate-50/50">
                  Date:
                </td>
                <td colSpan={3} className="border border-black p-1.5 pr-2">
                  <input
                    type="date"
                    value={data.date}
                    onChange={(e) => updateField('date', e.target.value)}
                    className="font-semibold focus:outline-none bg-transparent px-1 w-full"
                    aria-label="Audit Date"
                  />
                </td>
              </tr>

              {/* 4. HEADER ROW 2: Process Name & Shift Checkboxes */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50">
                  Process Name :
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.processName}
                    onChange={(e) => updateField('processName', e.target.value)}
                    className="w-full font-bold focus:outline-none bg-transparent px-1 uppercase"
                    placeholder="STORE"
                    aria-label="Process Name"
                  />
                </td>
                <td colSpan={2} className="border border-black p-2 text-center font-bold bg-slate-50/50">
                  Shift
                </td>
                <td className="border border-black p-1 text-center font-bold hover:bg-slate-50">
                  <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                    <span>A</span>
                    <input
                      type="checkbox"
                      checked={data.shifts.A}
                      onChange={() => toggleShift('A')}
                      className="h-3.5 w-3.5 border-black rounded-none cursor-pointer"
                      aria-label="Shift A"
                    />
                  </label>
                </td>
                <td className="border border-black p-1 text-center font-bold hover:bg-slate-50">
                  <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                    <span>B</span>
                    <input
                      type="checkbox"
                      checked={data.shifts.B}
                      onChange={() => toggleShift('B')}
                      className="h-3.5 w-3.5 border-black rounded-none cursor-pointer"
                      aria-label="Shift B"
                    />
                  </label>
                </td>
                <td className="border border-black p-1 text-center font-bold hover:bg-slate-50">
                  <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                    <span>G</span>
                    <input
                      type="checkbox"
                      checked={data.shifts.G}
                      onChange={() => toggleShift('G')}
                      className="h-3.5 w-3.5 border-black rounded-none cursor-pointer"
                      aria-label="Shift G"
                    />
                  </label>
                </td>
              </tr>

              {/* 5. HEADER ROW 3: Auditor & Start Times */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50">
                  Auditor:
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.auditor}
                    onChange={(e) => updateField('auditor', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="Auditor Name"
                    aria-label="Auditor Name"
                  />
                </td>
                <td colSpan={2} className="border border-black p-1.5 font-bold text-center bg-slate-50/50 text-[10.5px]">
                  Start Time (A)
                </td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={data.startTimeA}
                    onChange={(e) => updateField('startTimeA', e.target.value)}
                    className="w-full text-center focus:outline-none bg-transparent"
                    aria-label="Start Time A"
                  />
                </td>
                <td className="border border-black p-1.5 font-bold text-center bg-slate-50/50 text-[10.5px]">
                  Start Time (B)
                </td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={data.startTimeB}
                    onChange={(e) => updateField('startTimeB', e.target.value)}
                    className="w-full text-center focus:outline-none bg-transparent"
                    aria-label="Start Time B"
                  />
                </td>
              </tr>

              {/* 6. HEADER ROW 4: Auditees & Finish Times */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50">
                  Auditees:
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.auditees}
                    onChange={(e) => updateField('auditees', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="Auditee names..."
                    aria-label="Auditees"
                  />
                </td>
                <td colSpan={2} className="border border-black p-1.5 font-bold text-center bg-slate-50/50 text-[10.5px]">
                  Finish Time (A)
                </td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={data.finishTimeA}
                    onChange={(e) => updateField('finishTimeA', e.target.value)}
                    className="w-full text-center focus:outline-none bg-transparent"
                    aria-label="Finish Time A"
                  />
                </td>
                <td className="border border-black p-1.5 font-bold text-center bg-slate-50/50 text-[10.5px]">
                  Finish Time (B)
                </td>
                <td className="border border-black p-1">
                  <input
                    type="text"
                    value={data.finishTimeB}
                    onChange={(e) => updateField('finishTimeB', e.target.value)}
                    className="w-full text-center focus:outline-none bg-transparent"
                    aria-label="Finish Time B"
                  />
                </td>
              </tr>

              {/* 7. HEADER ROW 5: Part Modal & PFMEA Plan */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50">
                  Part Modal:
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.partModal}
                    onChange={(e) => updateField('partModal', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="YHB, YED, ISUZU"
                    aria-label="Part Model"
                  />
                </td>
                <td colSpan={2} className="border border-black p-2 text-center font-bold bg-slate-50/50">
                  PFMEA Plan:
                </td>
                <td colSpan={3} className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.pfmeaPlan}
                    onChange={(e) => updateField('pfmeaPlan', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="PFMEA Reference"
                    aria-label="PFMEA Plan"
                  />
                </td>
              </tr>

              {/* 8. HEADER ROW 6: Control Plan & Latest Rev Date */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50">
                  Control Plan:
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.controlPlan}
                    onChange={(e) => updateField('controlPlan', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="CP Reference"
                    aria-label="Control Plan"
                  />
                </td>
                <td colSpan={2} className="border border-black p-2 text-center font-bold bg-slate-50/50 text-[10px]">
                  Latest Rev No/Rev Date:
                </td>
                <td colSpan={3} className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.latestRevControl}
                    onChange={(e) => updateField('latestRevControl', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="Rev: 04 / 15.01.2026"
                    aria-label="Control Plan Revision"
                  />
                </td>
              </tr>

              {/* 9. HEADER ROW 7: PFMEA Latest Rev */}
              <tr>
                <td colSpan={2} className="border border-black p-2 pl-3 font-bold bg-slate-50/50 text-[10px]">
                  Latest Rev No/Rev Date:
                </td>
                <td className="border border-black p-1.5">
                  <input
                    type="text"
                    value={data.latestRevPfmea}
                    onChange={(e) => updateField('latestRevPfmea', e.target.value)}
                    className="w-full font-semibold focus:outline-none bg-transparent px-1"
                    placeholder="Rev: 06 / 12.12.2022"
                    aria-label="PFMEA Revision"
                  />
                </td>
                <td colSpan={5} className="border border-black bg-slate-50/20" />
              </tr>

              {/* 10. CHECKPOINTS TABLE HEADERS */}
              <tr className="bg-slate-100 font-bold text-center">
                <th rowSpan={2} className="border border-black p-2 text-center font-bold">
                  S. No.
                </th>
                <th rowSpan={2} className="border border-black p-2 text-left pl-3 font-bold">
                  Check Points
                </th>
                <th rowSpan={2} className="border border-black p-2 text-left pl-3 font-bold">
                  Actual Status / Observations
                </th>
                <th colSpan={4} className="border border-black p-1 text-center font-bold">
                  NCR Status
                </th>
                <th rowSpan={2} className="border border-black p-2 text-center font-bold">
                  Remarks
                </th>
              </tr>
              <tr className="bg-slate-50 font-bold text-center text-[10px]">
                <th className="border border-black p-1">OK</th>
                <th className="border border-black p-1">Major</th>
                <th className="border border-black p-1">Minor</th>
                <th className="border border-black p-1">Improvement</th>
              </tr>

              {/* 11. CHECKPOINTS ROWS */}
              {data.checkPoints.map((cp) => (
                <tr key={cp.id} className="hover:bg-slate-50/60 group">
                  {/* S.No */}
                  <td className="border border-black p-2 text-center font-bold align-top text-xs text-slate-800">
                    {cp.sNo}
                  </td>

                  {/* Check Point */}
                  <td className="border border-black p-2 align-top text-slate-900 font-semibold leading-relaxed">
                    <AutoResizeTextarea
                      value={cp.checkPoint}
                      onChange={(e) => updateCheckPoint(cp.id, 'checkPoint', e.target.value)}
                      className="w-full font-semibold focus:outline-none bg-transparent leading-relaxed"
                      minRows={3}
                      aria-label={`Check Point ${cp.sNo}`}
                    />
                  </td>

                  {/* Actual Status / Observations */}
                  <td className="border border-black p-2 align-top text-slate-800 space-y-1">
                    <div>
                      <span className="font-bold block text-slate-900">Requirment:-</span>
                      <AutoResizeTextarea
                        value={cp.requirement}
                        onChange={(e) => updateCheckPoint(cp.id, 'requirement', e.target.value)}
                        className="w-full focus:outline-none bg-transparent pl-1 text-[11px]"
                        minRows={2}
                        aria-label={`Requirement ${cp.sNo}`}
                      />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900">Evidance:-</span>
                      <AutoResizeTextarea
                        value={cp.evidence}
                        onChange={(e) => updateCheckPoint(cp.id, 'evidence', e.target.value)}
                        className="w-full focus:outline-none bg-transparent pl-1 text-[11px]"
                        minRows={2}
                        aria-label={`Evidence ${cp.sNo}`}
                      />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900">Observation:-</span>
                      <AutoResizeTextarea
                        value={cp.observation}
                        onChange={(e) => updateCheckPoint(cp.id, 'observation', e.target.value)}
                        className="w-full focus:outline-none bg-transparent pl-1 text-[11px]"
                        minRows={2}
                        aria-label={`Observation ${cp.sNo}`}
                      />
                    </div>
                  </td>

                  {/* NCR Status: OK */}
                  <td
                    className="border border-black p-2 text-center align-middle cursor-pointer hover:bg-emerald-50/50"
                    title="Mark as OK"
                  >
                    <input
                      type="checkbox"
                      checked={cp.ncrStatus === 'OK'}
                      onChange={(e) => { e.stopPropagation(); setNcrStatus(cp.id, 'OK'); }}
                      className="h-4 w-4 border-black rounded-none cursor-pointer"
                      aria-label={`OK for row ${cp.sNo}`}
                    />
                  </td>

                  {/* NCR Status: Major */}
                  <td
                    className="border border-black p-2 text-center align-middle cursor-pointer hover:bg-red-50/50"
                    title="Mark as Major NC"
                  >
                    <input
                      type="checkbox"
                      checked={cp.ncrStatus === 'Major'}
                      onChange={(e) => { e.stopPropagation(); setNcrStatus(cp.id, 'Major'); }}
                      className="h-4 w-4 border-black rounded-none cursor-pointer text-red-600"
                      aria-label={`Major NC for row ${cp.sNo}`}
                    />
                  </td>

                  {/* NCR Status: Minor */}
                  <td
                    className="border border-black p-2 text-center align-middle cursor-pointer hover:bg-amber-50/50"
                    title="Mark as Minor NC"
                  >
                    <input
                      type="checkbox"
                      checked={cp.ncrStatus === 'Minor'}
                      onChange={(e) => { e.stopPropagation(); setNcrStatus(cp.id, 'Minor'); }}
                      className="h-4 w-4 border-black rounded-none cursor-pointer text-amber-600"
                      aria-label={`Minor NC for row ${cp.sNo}`}
                    />
                  </td>

                  {/* NCR Status: Improvement */}
                  <td
                    className="border border-black p-2 text-center align-middle cursor-pointer hover:bg-blue-50/50"
                    title="Mark as Improvement Opportunity"
                  >
                    <input
                      type="checkbox"
                      checked={cp.ncrStatus === 'Improvement'}
                      onChange={(e) => { e.stopPropagation(); setNcrStatus(cp.id, 'Improvement'); }}
                      className="h-4 w-4 border-black rounded-none cursor-pointer text-blue-600"
                      aria-label={`Improvement for row ${cp.sNo}`}
                    />
                  </td>

                  {/* Remarks */}
                  <td className="border border-black p-2 align-top relative">
                    <AutoResizeTextarea
                      value={cp.remarks}
                      onChange={(e) => updateCheckPoint(cp.id, 'remarks', e.target.value)}
                      className="w-full focus:outline-none bg-transparent text-[11px]"
                      minRows={3}
                      placeholder="Remarks..."
                      aria-label={`Remarks for row ${cp.sNo}`}
                    />
                    {data.checkPoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCheckPoint(cp.id)}
                        className="absolute right-1 bottom-1 text-slate-300 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition print:hidden"
                        title="Delete row"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {/* 12. 1. SUSTENANCE CHECK ROW */}
              <tr>
                <td colSpan={8} className="border border-black p-3 bg-white">
                  <span className="font-bold block text-slate-900 mb-1">
                    1.Sustenance Check Of Previous Audit NC / C/measures
                  </span>
                  <AutoResizeTextarea
                    value={data.sustenanceCheck}
                    onChange={(e) => updateField('sustenanceCheck', e.target.value)}
                    minRows={2}
                    className="w-full focus:outline-none bg-transparent pl-1 text-[11px] leading-relaxed"
                    aria-label="Sustenance Check"
                  />
                </td>
              </tr>

              {/* 13. 2. REVIEW OF PREVIOUS CUSTOMER COMPLAINTS */}
              <tr>
                <td colSpan={8} className="border border-black p-3 bg-white">
                  <span className="font-bold block text-slate-900 mb-1">
                    2. Review Of Previous Customer complain C/measures :
                  </span>
                  <AutoResizeTextarea
                    value={data.customerComplainReview}
                    onChange={(e) => updateField('customerComplainReview', e.target.value)}
                    minRows={2}
                    className="w-full focus:outline-none bg-transparent pl-1 text-[11px] leading-relaxed"
                    aria-label="Customer Complain Review"
                  />
                </td>
              </tr>

              {/* 14. 3. SUGGESTIONS FOR QUALITY IMPROVEMENT */}
              <tr>
                <td colSpan={8} className="border border-black p-3 bg-white">
                  <span className="font-bold block text-slate-900 mb-1">
                    3. Suggestion for Quality Improvement Points :
                  </span>
                  <AutoResizeTextarea
                    value={data.qualityImprovementSuggestions}
                    onChange={(e) => updateField('qualityImprovementSuggestions', e.target.value)}
                    minRows={2}
                    className="w-full focus:outline-none bg-transparent pl-1 text-[11px] leading-relaxed"
                    aria-label="Quality Improvement Suggestions"
                  />
                </td>
              </tr>

              {/* 15. 4. SUGGESTIONS FOR KAIZEN / POKA YOKE */}
              <tr>
                <td colSpan={8} className="border border-black p-3 bg-white">
                  <span className="font-bold block text-slate-900 mb-1">
                    4. Suggestion for Kaizen / Poka Yoke (if any) :
                  </span>
                  <AutoResizeTextarea
                    value={data.kaizenPokaYokeSuggestions}
                    onChange={(e) => updateField('kaizenPokaYokeSuggestions', e.target.value)}
                    minRows={2}
                    className="w-full focus:outline-none bg-transparent pl-1 text-[11px] leading-relaxed"
                    aria-label="Kaizen Poka Yoke Suggestions"
                  />
                </td>
              </tr>

              {/* 16. NOTE ROW WITH INLINE ADD CHECK ITEM BUTTON */}
              <tr className="bg-slate-50/50">
                <td colSpan={8} className="border border-black p-2.5 px-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900">
                      Note: Pls add new check items if found applicable to this process
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCheckPoint}
                      className="print:hidden text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded border border-slate-300 shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Check Item</span>
                    </button>
                  </div>
                </td>
              </tr>

              {/* 17. SIGNATURES ROW */}
              <tr>
                <td colSpan={3} className="border border-black p-3 pl-3 align-bottom">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-800 whitespace-nowrap">Auditor Sign:</span>
                    <input
                      type="text"
                      value={data.auditorSign}
                      onChange={(e) => updateField('auditorSign', e.target.value)}
                      className="w-full font-semibold focus:outline-none bg-transparent"
                      aria-label="Auditor Signature"
                    />
                  </div>
                </td>
                <td colSpan={3} className="border border-black p-3 pl-3 align-bottom">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-800 whitespace-nowrap">Auditee Sign:</span>
                    <input
                      type="text"
                      value={data.auditeeSign}
                      onChange={(e) => updateField('auditeeSign', e.target.value)}
                      className="w-full font-semibold focus:outline-none bg-transparent"
                      aria-label="Auditee Signature"
                    />
                  </div>
                </td>
                <td colSpan={2} className="border border-black p-3 pr-3 text-right align-bottom">
                  <input
                    type="text"
                    value={data.qaManager}
                    onChange={(e) => updateField('qaManager', e.target.value)}
                    className="w-full font-black text-[#002060] text-right focus:outline-none bg-transparent"
                    aria-label="QA Manager Approval"
                  />
                </td>
              </tr>

              {/* 18. DOCUMENT FOOTER ROW (Enclosed inside the table border at the very bottom) */}
              <tr className="bg-slate-50/40 text-[10px] text-slate-700 font-semibold">
                <td colSpan={2} className="border border-black p-2 pl-3">
                  {data.footerRefCode}
                </td>
                <td className="border border-black p-2 text-center">
                  {data.footerRevNo}
                </td>
                <td colSpan={3} className="border border-black p-2 text-center">
                  {data.footerRevDate}
                </td>
                <td colSpan={2} className="border border-black p-2 pr-3 text-right">
                  {data.footerPage}
                </td>
              </tr>

            </tbody>
          </table>

        </div>
      </div>
    </main>
  );
}
