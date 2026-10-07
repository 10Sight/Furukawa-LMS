import FormZoomControls from '../shared/FormZoomControls';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Plus, Trash2, Upload, X, ZoomIn, ZoomOut, RotateCcw,
  Save, Image as ImageIcon, ChevronDown, Folder, FolderOpen,
  Calendar, BarChart3, FileText, Clock, ChevronRight, ExternalLink, Layers,
} from 'lucide-react';
import { SubNavTabs, getTodayDateStr } from './AuditorPlan';

/* ─────────────────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────────────*/
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const CURRENT_YEAR = new Date().getFullYear();
const FIRST_YEARLY_FOLDER = 2024;

/* ─────────────────────────────────────────────────────────
   DUMMY DATA SEEDER
──────────────────────────────────────────────────────────*/
function makeDummyRowsMay() {
  return [
    {
      id: 801,
      auditDate: '2026-05-14',
      lineAreaName: 'Stores',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Raw Material Storage',
      observations: 'Expired lot of heat shrinkable tubes found stored in active staging rack without quarantine sticker.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: '1. Segregated expired lot to red quarantine cage.\n2. Visual shelf-life tag with expiry color code affixed to all raw material bins.',
      evidence2Value: 'Image Upload',
      evidence2Images: [],
      targetDateCA: '2026-05-20',
      targetDatePA: '2026-05-28',
      resp: 'Stores Lead',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'QA Auditor',
    },
    {
      id: 802,
      auditDate: '2026-05-22',
      lineAreaName: 'Prep',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Wire Stripping',
      observations: 'Nick marks observed on 2 out of 10 wire strands after manual stripper blade adjustment.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Stripper blade replaced with calibrated pre-set V-blade. Operator trained on optical magnifier inspection.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: '2026-05-25',
      targetDatePA: '2026-06-02',
      resp: 'Prep Supervisor',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'QA Head',
    },
  ];
}

function makeDummyRowsJune() {
  return [
    {
      id: 901,
      auditDate: '2026-06-12',
      lineAreaName: 'Cutting',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Automated Cutting',
      observations: 'Cut wire length reading on encoder had drift of +3.5mm against master scale specification.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Encoder belt tension recalibrated and weekly encoder zero verification checkpoint introduced.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: '2026-06-18',
      targetDatePA: '2026-06-25',
      resp: 'Maintenance Lead',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'Verified',
    },
    {
      id: 902,
      auditDate: '2026-06-20',
      lineAreaName: 'Assy',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Sub Assembly',
      observations: 'Work instruction sheet display stand was missing on Station 3.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Stand fabricated and affixed with transparent acrylic cover.',
      evidence2Value: 'Image Upload',
      evidence2Images: [],
      targetDateCA: '2026-06-22',
      targetDatePA: '2026-06-26',
      resp: 'Assy Lead',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'QA Auditor',
    },
  ];
}

function makeDummyRows() {
  return [
    {
      id: 1001,
      auditDate: '2026-07-21',
      lineAreaName: 'Assy',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'FIA',
      observations: 'History card Status was not updated on board (Board no 04 - YHB Floor -03).',
      evidence1Value: 'Not Available',
      evidence1Images: [],
      preventiveActions: 'Responsibility define for check the availability of History card on FIA board during FIA board check sheet filling.',
      evidence2Value: 'Image Upload',
      evidence2Images: [],
      targetDateCA: '2026-07-30',
      targetDatePA: '2026-08-03',
      resp: 'Assy Prod',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'Verified',
    },
    {
      id: 1002,
      auditDate: '2026-07-21',
      lineAreaName: 'Assy',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Material Trolley',
      observations: 'Material identification was not available on bin not making it difficult to identify the material type OK or NG.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: '1. Replace paper identification with laminated material identification to prevent tearing during handling.\n2. An acrylic sheet fix on identification for durability during new line set up.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: '2026-07-30',
      targetDatePA: '2026-08-03',
      resp: 'Assy Prod',
      statusCA: 'Closed',
      statusPA: 'In Progress',
      verification: '',
    },
    {
      id: 1003,
      auditDate: '2026-07-21',
      lineAreaName: 'Assy',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Clamp Cutting Gun',
      observations: 'Gun validation tag was not available.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: '1. Replace paper identification with laminated material identification to prevent tearing during handling.\n2. Gun validation no. mark by tool on new gun.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: '2026-07-30',
      targetDatePA: '2026-08-03',
      resp: 'Assay Prod',
      statusCA: 'Open',
      statusPA: 'Open',
      verification: '',
    },
  ];
}

function makeDummyRowsAug() {
  return [
    {
      id: 2001,
      auditDate: '2026-08-05',
      lineAreaName: 'Weld',
      controlPlan: 'CP-WH-WLD-001',
      pfmea: 'PFMEA-WH-WLD-001',
      processName: 'MIG Welding',
      observations: 'Welding parameter log not maintained for last 3 shifts.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Shift supervisor to maintain daily welding log before shift handover.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: '2026-08-10',
      targetDatePA: '2026-08-20',
      resp: 'Weld Dept',
      statusCA: 'Closed',
      statusPA: 'Open',
      verification: '',
    },
    {
      id: 2002,
      auditDate: '2026-08-05',
      lineAreaName: 'Paint',
      controlPlan: 'CP-WH-PNT-003',
      pfmea: 'PFMEA-WH-PNT-003',
      processName: 'Primer Application',
      observations: 'Film thickness gauge not calibrated (due date expired 15 days ago).',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Gauge sent for calibration. New calibration sticker to be applied.',
      evidence2Value: 'Image Upload',
      evidence2Images: [],
      targetDateCA: '2026-08-12',
      targetDatePA: '2026-08-25',
      resp: 'Paint QA',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'QA Head',
    },
  ];
}

function makeDummyRowsSept() {
  return [
    {
      id: 2501,
      auditDate: '2026-09-08',
      lineAreaName: 'Quality Lab',
      controlPlan: 'CP-WH-QA-001',
      pfmea: 'PFMEA-WH-QA-001',
      processName: 'Torque Audit',
      observations: 'Digital torque wrench calibration sticker was partially torn off and due date was illegible.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Laminated transparent protective cover applied over all calibration stickers in shop floor.',
      evidence2Value: 'Image Upload',
      evidence2Images: [],
      targetDateCA: '2026-09-12',
      targetDatePA: '2026-09-18',
      resp: 'Quality Dept',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'QA Head',
    },
    {
      id: 2502,
      auditDate: '2026-09-17',
      lineAreaName: 'Assy',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Circuit Testing',
      observations: 'Ground clip grounding resistance measured 1.2 Ohm against standard limit of <= 0.5 Ohm.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Grounding test pin replaced and grounding busbar connection cleaned of oxide.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: '2026-09-22',
      targetDatePA: '2026-09-30',
      resp: 'Testing QA',
      statusCA: 'In Progress',
      statusPA: 'Open',
      verification: '',
    },
  ];
}

function makeDummyRowsOct() {
  const today = getTodayDateStr();
  return [
    {
      id: 9001,
      auditDate: today,
      lineAreaName: 'Assy',
      controlPlan: 'CP-WH-PE-MSIL-YHB-002',
      pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
      processName: 'Final Inspection & Testing',
      observations: 'Continuity tester probe calibration seal was broken on Station 2.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Probe recalibrated and new tamper-evident calibration seal affixed.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: today,
      targetDatePA: '2026-10-10',
      resp: 'Quality Dept',
      statusCA: 'In Progress',
      statusPA: 'Open',
      verification: '',
    },
    {
      id: 9002,
      auditDate: today,
      lineAreaName: 'Weld',
      controlPlan: 'CP-WH-WLD-001',
      pfmea: 'PFMEA-WH-WLD-001',
      processName: 'Laser Marking & Crimping',
      observations: 'Crimping height gauge zero-offset was found drifted by +0.03mm.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Daily dial gauge zeroing checkpoint added to operator start-up sheet.',
      evidence2Value: 'Image Upload',
      evidence2Images: [],
      targetDateCA: today,
      targetDatePA: '2026-10-08',
      resp: 'Prod Line Leader',
      statusCA: 'Closed',
      statusPA: 'Closed',
      verification: 'QA Head',
    },
    {
      id: 9003,
      auditDate: today,
      lineAreaName: 'Paint',
      controlPlan: 'CP-WH-PNT-003',
      pfmea: 'PFMEA-WH-PNT-003',
      processName: 'Primer Application',
      observations: 'Wet film comb gauge tooth worn down beyond permissible calibration limits.',
      evidence1Value: 'Image Upload',
      evidence1Images: [],
      preventiveActions: 'Defective comb gauge scrapped. New calibrated ISO-certified gauge issued.',
      evidence2Value: 'Not Available',
      evidence2Images: [],
      targetDateCA: today,
      targetDatePA: '2026-10-12',
      resp: 'Paint QA',
      statusCA: 'Open',
      statusPA: 'Open',
      verification: '',
    },
  ];
}

/* ─────────────────────────────────────────────────────────
   STORAGE HELPERS
──────────────────────────────────────────────────────────*/
function storageKeyMonthly(unit, year, monthIdx) {
  return `nc_list_monthly_${unit || 'All'}_${year}_${monthIdx}`;
}

function storageKeyIndex(unit) {
  return `nc_list_index_${unit || 'All'}`;
}

function loadIndex(unit) {
  try {
    const raw = localStorage.getItem(storageKeyIndex(unit));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4) return parsed;
    }
    return null;
  } catch { return null; }
}

function saveIndex(unit, idx) {
  try { localStorage.setItem(storageKeyIndex(unit), JSON.stringify(idx)); } catch {}
}

function loadMonthRows(unit, year, monthIdx) {
  try {
    const raw = localStorage.getItem(storageKeyMonthly(unit, year, monthIdx));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveMonthRows(unit, year, monthIdx, rows) {
  try { localStorage.setItem(storageKeyMonthly(unit, year, monthIdx), JSON.stringify(rows)); } catch {}
}

function buildInitialIndex(unit) {
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Seed monthly NC records from May through October
  saveMonthRows(unit, 2026, 4, makeDummyRowsMay());
  saveMonthRows(unit, 2026, 5, makeDummyRowsJune());
  saveMonthRows(unit, 2026, 6, makeDummyRows());
  saveMonthRows(unit, 2026, 7, makeDummyRowsAug());
  saveMonthRows(unit, 2026, 8, makeDummyRowsSept());
  saveMonthRows(unit, currentYear, currentMonthIdx, makeDummyRowsOct());

  const index = [
    { year: 2026, monthIdx: 4, label: 'May 2026', createdAt: '2026-05-01T00:00:00.000Z' },
    { year: 2026, monthIdx: 5, label: 'June 2026', createdAt: '2026-06-01T00:00:00.000Z' },
    { year: 2026, monthIdx: 6, label: 'July 2026', createdAt: '2026-07-01T00:00:00.000Z' },
    { year: 2026, monthIdx: 7, label: 'August 2026', createdAt: '2026-08-01T00:00:00.000Z' },
    { year: 2026, monthIdx: 8, label: 'September 2026', createdAt: '2026-09-01T00:00:00.000Z' },
  ];

  if (!index.some((e) => e.year === currentYear && e.monthIdx === currentMonthIdx)) {
    index.push({
      year: currentYear,
      monthIdx: currentMonthIdx,
      label: `${MONTHS[currentMonthIdx]} ${currentYear}`,
      createdAt: new Date().toISOString(),
    });
  }

  saveIndex(unit, index);
  return index;
}

/* ─────────────────────────────────────────────────────────
   IMAGE POPUP EDITOR
──────────────────────────────────────────────────────────*/
function ImagePopup({ images, onClose, onSave }) {
  const [localImages, setLocalImages] = useState(images || []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef(null);

  const handleAddImages = (e) => {
    Array.from(e.target.files || []).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setLocalImages((p) => [...p, { src: ev.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDelete = (idx) => {
    setLocalImages((p) => p.filter((_, i) => i !== idx));
    setActiveIdx((p) => Math.max(0, p - 1));
  };

  const active = localImages[activeIdx];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Evidence Images</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              {localImages.length} {localImages.length === 1 ? 'image' : 'images'}
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col w-28 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto gap-2 p-2">
            {localImages.map((img, idx) => (
              <div key={idx}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition ${activeIdx === idx ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-slate-300'}`}
                onClick={() => setActiveIdx(idx)}>
                <img src={img.src} alt={img.name || `Img ${idx + 1}`} className="w-full h-20 object-cover" />
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(idx); }}
                  className="absolute top-1 right-1 rounded-full bg-red-500 text-white p-0.5 hover:bg-red-600">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-400 hover:text-blue-500 transition text-[10px] font-bold">
              <Plus className="h-5 w-5" /><span>Add</span>
            </button>
          </div>

          <div className="flex flex-1 flex-col min-h-0">
            {active ? (
              <>
                <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-white">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><ZoomOut className="h-4 w-4" /></button>
                  <span className="text-xs font-bold text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><ZoomIn className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setZoom(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"><RotateCcw className="h-4 w-4" /></button>
                  <span className="ml-2 text-[11px] text-slate-400 truncate max-w-[180px]">{active.name}</span>
                </div>
                <div className="flex flex-1 min-h-0 overflow-auto items-center justify-center bg-slate-100 p-4">
                  <img src={active.src} alt={active.name}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.15s' }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
                <ImageIcon className="h-12 w-12 opacity-30" />
                <p className="text-sm font-semibold">No images yet</p>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition">
                  <Upload className="h-3.5 w-3.5" />Upload Image
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs">
            <Upload className="h-3.5 w-3.5 text-blue-600" />Add More Images
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition">Cancel</button>
            <button type="button" onClick={() => { onSave(localImages); onClose(); }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95">
              <Save className="h-3.5 w-3.5" />Save Images
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   EVIDENCE CELL
──────────────────────────────────────────────────────────*/
function EvidenceCell({ value, images, onValueChange, onImagesChange, compact = false }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const fileRef = useRef(null);

  const handleSelect = (opt) => {
    onValueChange(opt);
    setDropOpen(false);
    if (opt === 'Image Upload') fileRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    Promise.all(files.map((file) => new Promise((res) => {
      const reader = new FileReader();
      reader.onload = (ev) => res({ src: ev.target.result, name: file.name });
      reader.readAsDataURL(file);
    }))).then((newImgs) => { onImagesChange([...(images || []), ...newImgs]); setPopupOpen(true); });
    e.target.value = '';
  };

  const imageCount = images?.length || 0;
  const isImage = value === 'Image Upload';
  const isNA = value === 'Not Available';
  const label = isImage ? `Image Upload${imageCount > 0 ? ` (${imageCount})` : ''}` : value || 'Select...';

  return (
    <div className={`relative flex flex-col items-center gap-1 ${compact ? 'min-w-0' : 'min-w-[110px]'}`}>
      <div className="relative w-full">
        <button type="button" onClick={() => setDropOpen((o) => !o)}
          className={`flex w-full items-center justify-between gap-1 rounded-lg border ${compact ? 'px-1 py-1 text-[9px]' : 'px-2 py-1.5 text-[11px]'} font-bold transition cursor-pointer ${
            isImage ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
            : isNA ? 'border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
        {dropOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs font-semibold">
            <button type="button" onClick={() => handleSelect('Image Upload')}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition">
              <Upload className="h-3.5 w-3.5 text-blue-600" />Image Upload
            </button>
            <button type="button" onClick={() => handleSelect('Not Available')}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-100 text-slate-500 transition">
              <X className="h-3.5 w-3.5 text-slate-400" />Not Available
            </button>
          </div>
        )}
      </div>

      {isImage && imageCount > 0 && (
        <button type="button" onClick={() => setPopupOpen(true)}
          className="relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition" title="Edit / view images">
          <img src={images[0].src} alt="evidence" className="h-16 w-full object-cover" />
          {imageCount > 1 && (
            <span className="absolute bottom-1 right-1 rounded-full bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5">+{imageCount - 1}</span>
          )}
        </button>
      )}

      {isImage && imageCount === 0 && (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold py-2 transition">
          <Upload className="h-3 w-3" />Upload
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      {popupOpen && (
        <ImagePopup images={images || []} onClose={() => setPopupOpen(false)}
          onSave={(imgs) => { onImagesChange(imgs); setPopupOpen(false); }} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   TEXT CELL
──────────────────────────────────────────────────────────*/
function TextCell({ value, onChange, placeholder = '', centered = false }) {
  return (
    <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={centered ? 1 : 3} style={centered ? {textAlign:'center'} : undefined}
      className="w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 transition placeholder-slate-300" />
  );
}

function emptyRow(id) {
  return { id, auditDate: '', lineAreaName: '', controlPlan: '', pfmea: '', processName: '', observations: '', evidence1Value: '', evidence1Images: [], preventiveActions: '', evidence2Value: '', evidence2Images: [], targetDateCA: '', targetDatePA: '', resp: '', statusCA: '', statusPA: '', verification: '' };
}

/* ─────────────────────────────────────────────────────────
   MONTH DATA ENTRY FORM
──────────────────────────────────────────────────────────*/
function MonthForm({ unit, year, monthIdx, onBack, onViewChange }) {
  const monthLabel = `${MONTHS[monthIdx]} ${year}`;
  const [rows, setRows] = useState(() => {
    const saved = loadMonthRows(unit, year, monthIdx);
    return saved || [emptyRow(Date.now())];
  });

  const updateRow = (id, field, value) => {
    setRows((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, [field]: value } : r);
      saveMonthRows(unit, year, monthIdx, next);
      return next;
    });
  };

  const addRow = () => setRows((prev) => {
    const next = [...prev, emptyRow(Date.now())];
    saveMonthRows(unit, year, monthIdx, next);
    return next;
  });

  const deleteRow = (id) => setRows((prev) => {
    const next = prev.filter((r) => r.id !== id);
    saveMonthRows(unit, year, monthIdx, next);
    return next;
  });

  const hdr = 'border border-slate-700 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-2 text-center align-middle';
  const sub = 'border border-slate-600 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-1.5 text-center align-middle';
  const dc = 'border border-slate-200 px-1.5 py-1 align-top text-center';

  return (
    <main className="nc-form fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      <header className="flex min-h-13 flex-wrap gap-2 py-2 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 md:px-5 shadow-xs z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95 shadow-xs cursor-pointer">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-400 hidden md:inline">Process Audit / NC - List / Monthly /</span>
            <span className="truncate text-xs md:text-sm font-bold text-slate-800">{monthLabel}</span>
            {unit && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200 shrink-0">Unit: {unit}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
            <span>✓ Auto-saved</span>
          </div>
          <button type="button" onClick={addRow}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95">
            <Plus className="h-3.5 w-3.5" />Add Row
          </button>
        </div>
      <SubNavTabs currentView="monthly" onViewChange={onViewChange} />
      <FormZoomControls /></header>

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-2 md:p-3">
        <div className="h-full overflow-auto rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="min-w-[1500px]">
            <table className="w-full border-collapse table-fixed text-[11px]">
              <colgroup>
                <col style={{ width: '40px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} />
                <col style={{ width: '110px' }} /><col style={{ width: '110px' }} /><col style={{ width: '100px' }} />
                <col style={{ width: '160px' }} /><col style={{ width: '130px' }} /><col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={hdr} rowSpan={2}>S No.</th>
                  <th className={hdr} rowSpan={2}>Audit Date</th>
                  <th className={hdr} rowSpan={2}>Line / Area Name</th>
                  <th className={hdr} rowSpan={2}>Control Plan</th>
                  <th className={hdr} rowSpan={2}>PFMEA</th>
                  <th className={hdr} rowSpan={2}>Process Name</th>
                  <th className={hdr} rowSpan={2}>Observations</th>
                  <th className={hdr} rowSpan={2}>Evidence</th>
                  <th className={hdr} rowSpan={2}>Preventive Actions</th>
                  <th className={hdr} rowSpan={2}>Evidence</th>
                  <th className={hdr} colSpan={2}>Target Date</th>
                  <th className={hdr} rowSpan={2}>Resp.</th>
                  <th className={hdr} colSpan={3}>Status</th>
                </tr>
                <tr>
                  <th className={sub}>CA</th><th className={sub}>PA</th>
                  <th className={sub}>CA</th><th className={sub}>PA</th><th className={sub}>Verification</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 group/row transition">
                    <td className={`${dc} text-slate-500 font-bold`}>
                      <div className="flex flex-col items-center gap-1">
                        <span>{idx + 1}</span>
                        <button type="button" onClick={() => deleteRow(row.id)}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </td>
                    <td className={dc}>
                      <input type="date" value={row.auditDate} onChange={(e) => updateRow(row.id, 'auditDate', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none px-1 py-1 cursor-pointer" />
                    </td>
                    <td className={dc}><TextCell value={row.lineAreaName} onChange={(v) => updateRow(row.id, 'lineAreaName', v)} placeholder="Area..." /></td>
                    <td className={dc}><TextCell value={row.controlPlan} onChange={(v) => updateRow(row.id, 'controlPlan', v)} placeholder="CP No." /></td>
                    <td className={dc}><TextCell value={row.pfmea} onChange={(v) => updateRow(row.id, 'pfmea', v)} placeholder="PFMEA No." /></td>
                    <td className={dc}><TextCell value={row.processName} onChange={(v) => updateRow(row.id, 'processName', v)} placeholder="Process..." /></td>
                    <td className={dc}><TextCell value={row.observations} onChange={(v) => updateRow(row.id, 'observations', v)} placeholder="Describe observation..." /></td>
                    <td className={dc}>
                      <EvidenceCell value={row.evidence1Value} images={row.evidence1Images}
                        onValueChange={(v) => updateRow(row.id, 'evidence1Value', v)}
                        onImagesChange={(imgs) => updateRow(row.id, 'evidence1Images', imgs)} />
                    </td>
                    <td className={dc}><TextCell value={row.preventiveActions} onChange={(v) => updateRow(row.id, 'preventiveActions', v)} placeholder="Actions taken..." /></td>
                    <td className={dc}>
                      <EvidenceCell value={row.evidence2Value} images={row.evidence2Images}
                        onValueChange={(v) => updateRow(row.id, 'evidence2Value', v)}
                        onImagesChange={(imgs) => updateRow(row.id, 'evidence2Images', imgs)} />
                    </td>
                    <td className={dc}>
                      <input type="date" value={row.targetDateCA} onChange={(e) => updateRow(row.id, 'targetDateCA', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none px-1 py-1 cursor-pointer" />
                    </td>
                    <td className={dc}>
                      <input type="date" value={row.targetDatePA} onChange={(e) => updateRow(row.id, 'targetDatePA', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none px-1 py-1 cursor-pointer" />
                    </td>
                    <td className={dc}><TextCell value={row.resp} onChange={(v) => updateRow(row.id, 'resp', v)} placeholder="Resp." /></td>
                    {['statusCA', 'statusPA'].map((field) => (
                      <td key={field} className={`${dc} !align-middle !text-center`}>
                        <select value={row[field]} onChange={(e) => updateRow(row.id, field, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-center text-[11px] text-slate-700 focus:border-blue-400 focus:outline-none cursor-pointer">
                          <option value="">—</option>
                          <option value="Open">Open</option>
                          <option value="Closed">Closed</option>
                          <option value="In Progress">In Progress</option>
                        </select>
                      </td>
                    ))}
                    <td className={`${dc} !align-middle !text-center`}><TextCell centered value={row.verification} onChange={(v) => updateRow(row.id, 'verification', v)} placeholder="Verified by..." /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={16} className="border border-slate-200 px-3 py-2">
                    <button type="button" onClick={addRow}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition">
                      <Plus className="h-3.5 w-3.5" />Add Row
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────
   YEARLY VIEW  (reads all months and shows aggregated table)
──────────────────────────────────────────────────────────*/
function YearlyView({ unit, index, year, onBack, onViewChange }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const allRows = useMemo(() => {
    const monthEntries = (index || []).filter((e) => e.year === year);
    return monthEntries.flatMap((entry) => {
      const rows = loadMonthRows(unit, entry.year, entry.monthIdx) || [];
      return rows.map((r) => ({ ...r, _monthLabel: entry.label, _monthIdx: entry.monthIdx }));
    });
  }, [index, unit, year, refreshKey]);

  const updateYearlyEvidence = (row, field, value) => {
    const rows = loadMonthRows(unit, year, row._monthIdx) || [];
    saveMonthRows(unit, year, row._monthIdx, rows.map((item) => item.id === row.id ? { ...item, [field]: value } : item));
    setRefreshKey((current) => current + 1);
  };

  const hdr = 'border border-slate-700 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-2 text-center align-middle';
  const sub = 'border border-slate-600 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-1.5 text-center align-middle';
  const dc = 'border border-slate-100 px-1.5 py-2 align-top text-center text-[11px] text-slate-700';
  const closed = allRows.filter((r) => r.statusCA === 'Closed').length;
  const open = allRows.filter((r) => r.statusCA === 'Open').length;

  return (
    <main className="nc-form fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      <header className="flex min-h-13 flex-wrap gap-2 py-2 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 md:px-5 shadow-xs z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95 shadow-xs cursor-pointer">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />
          <span className="text-xs text-slate-400 hidden md:inline">Process Audit / NC - List / Yearly /</span>
          <span className="text-xs md:text-sm font-bold text-slate-800">{year} Audit Records</span>
          {unit && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200 shrink-0">Unit: {unit}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">{year}</span>
        </div>
      <SubNavTabs currentView="yearly" onViewChange={onViewChange} />
      <FormZoomControls /></header>

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-2 md:p-3 gap-3">

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="w-full">
            <table className="w-full border-collapse table-fixed text-[10px]">
              <colgroup>
                <col style={{ width: '3%' }} /><col style={{ width: '5%' }} /><col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} /><col style={{ width: '7%' }} /><col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} /><col style={{ width: '9%' }} /><col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} /><col style={{ width: '7%' }} />
                <col style={{ width: '4%' }} /><col style={{ width: '4%' }} /><col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} /><col style={{ width: '4%' }} /><col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={hdr} rowSpan={2}>S No.</th>
                  <th className={hdr} rowSpan={2}>Month</th>
                  <th className={hdr} rowSpan={2}>Audit Date</th>
                  <th className={hdr} rowSpan={2}>Line / Area</th>
                  <th className={hdr} rowSpan={2}>Control Plan</th>
                  <th className={hdr} rowSpan={2}>PFMEA</th>
                  <th className={hdr} rowSpan={2}>Process Name</th>
                  <th className={hdr} rowSpan={2}>Observations</th>
                  <th className={hdr} rowSpan={2}>Evidence</th>
                  <th className={hdr} rowSpan={2}>Preventive Actions</th>
                  <th className={hdr} rowSpan={2}>Action Evidence</th>
                  <th className={hdr} colSpan={2}>Target Date</th>
                  <th className={hdr} rowSpan={2}>Resp.</th>
                  <th className={hdr} colSpan={2}>Status</th>
                  <th className={hdr} rowSpan={2}>Verification</th>
                </tr>
                <tr>
                  <th className={sub}>CA</th><th className={sub}>PA</th>
                  <th className={sub}>CA</th><th className={sub}>PA</th>
                </tr>
              </thead>
              <tbody>
                {allRows.length === 0 ? (
                  <tr><td colSpan={17} className="py-12 text-center text-slate-400 text-sm font-semibold border border-slate-100">
                    No data found for {year}. Add data via Monthly folder.
                  </td></tr>
                ) : allRows.map((row, idx) => {
                  const caColor = row.statusCA === 'Closed' ? 'text-emerald-600 font-bold' : row.statusCA === 'Open' ? 'text-amber-600 font-bold' : 'text-violet-600 font-bold';
                  return (
                    <tr key={`${row._monthLabel}-${row.id}`} className="hover:bg-blue-50/30 transition">
                      <td className={dc}>{idx + 1}</td>
                      <td className={`${dc} font-bold text-blue-700`}>{row._monthLabel}</td>
                      <td className={dc}>{row.auditDate || '—'}</td>
                      <td className={dc}>{row.lineAreaName || '—'}</td>
                      <td className={dc}>{row.controlPlan || '—'}</td>
                      <td className={dc}>{row.pfmea || '—'}</td>
                      <td className={dc}>{row.processName || '—'}</td>
                      <td className={`${dc} text-left`}>{row.observations || '—'}</td>
                      <td className={dc}>
                        <EvidenceCell compact value={row.evidence1Value} images={row.evidence1Images}
                          onValueChange={(value) => updateYearlyEvidence(row, 'evidence1Value', value)}
                          onImagesChange={(images) => updateYearlyEvidence(row, 'evidence1Images', images)} />
                      </td>
                      <td className={`${dc} text-left`}>{row.preventiveActions || '—'}</td>
                      <td className={dc}>
                        <EvidenceCell compact value={row.evidence2Value} images={row.evidence2Images}
                          onValueChange={(value) => updateYearlyEvidence(row, 'evidence2Value', value)}
                          onImagesChange={(images) => updateYearlyEvidence(row, 'evidence2Images', images)} />
                      </td>
                      <td className={dc}>{row.targetDateCA || '—'}</td>
                      <td className={dc}>{row.targetDatePA || '—'}</td>
                      <td className={dc}>{row.resp || '—'}</td>
                      <td className={`${dc} ${caColor} !align-middle !text-center`}>{row.statusCA || '—'}</td>
                      <td className={`${dc} ${row.statusPA === 'Closed' ? 'text-emerald-600 font-bold' : row.statusPA === 'Open' ? 'text-amber-600 font-bold' : ''}`}>{row.statusPA || '—'}</td>
                      <td className={`${dc} !align-middle !text-center`}>{row.verification || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────
   CREATE MONTH MODAL
──────────────────────────────────────────────────────────*/
function YearlyFolderView({ unit, index, onBack, onOpenYear }) {
  const years = useMemo(() => {
    const dataYears = (index || []).map((entry) => Number(entry.year)).filter(Number.isFinite);
    const lastYear = Math.max(CURRENT_YEAR, ...dataYears, FIRST_YEARLY_FOLDER);
    const firstYear = Math.min(FIRST_YEARLY_FOLDER, ...dataYears);
    return Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => lastYear - offset);
  }, [index]);

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-[#F4F6F9] p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><FolderOpen className="h-4 w-4" /></div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Yearly NC Records</h1>
              <p className="text-[11px] text-slate-500">Open a year folder to view its audit records{unit ? ` · ${unit} Unit` : ''}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[620px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
            <th className="px-4 py-3 text-left font-bold">Year Folder</th><th className="px-4 py-3 text-left font-bold">Months</th><th className="px-4 py-3 text-left font-bold">Audit Records</th><th className="px-4 py-3 text-right font-bold">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {years.map((year) => {
              const entries = (index || []).filter((entry) => Number(entry.year) === year);
              const recordCount = entries.reduce((total, entry) => total + (loadMonthRows(unit, year, entry.monthIdx) || []).length, 0);
              return <tr key={year} tabIndex={0} role="button" onClick={() => onOpenYear(year)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenYear(year); } }} className="group cursor-pointer transition hover:bg-blue-50/60 focus:bg-blue-50/60 focus:outline-none">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Folder className="h-4 w-4" /></span><span className="font-semibold text-slate-800 group-hover:text-blue-700">{year}</span></div></td>
                <td className="px-4 py-3 text-sm text-slate-600">{entries.length} {entries.length === 1 ? 'month' : 'months'}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{recordCount} {recordCount === 1 ? 'record' : 'records'}</td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); onOpenYear(year); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700">Open Folder</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function CreateMonthModal({ isOpen, existingEntries, onClose, onConfirm }) {
  const [year, setYear] = useState('');
  const [monthIdx, setMonthIdx] = useState('');

  useEffect(() => { if (isOpen) { setYear(''); setMonthIdx(''); } }, [isOpen]);
  if (!isOpen) return null;
  const alreadyExists = (existingEntries || []).some((e) => e.year === year && e.monthIdx === monthIdx);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Create Monthly NC Record</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Select Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none">
              <option value="" disabled>Select year</option>
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Select Month</label>
            <select value={monthIdx} onChange={(e) => setMonthIdx(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none">
              <option value="" disabled>Select month</option>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          {alreadyExists && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700">
              ⚠ A record for {MONTHS[monthIdx]} {year} already exists. Opening it will show existing data.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition">Cancel</button>
          <button type="button" disabled={year === '' || monthIdx === ''} onClick={() => { if (year !== '' && monthIdx !== '') onConfirm(year, monthIdx); }}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95">
            <Plus className="h-3.5 w-3.5" />
            {alreadyExists ? 'Open Existing' : 'Create & Open'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MONTHLY FOLDER VIEW
──────────────────────────────────────────────────────────*/
function MonthlyFolderView({ unit, index, onBack, onOpenMonth, onCreateMonth }) {
  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-[#F4F6F9] p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">Monthly NC Records</h1>
              <p className="text-[11px] text-slate-500">Select a month to view or create new NC entries</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={onCreateMonth}
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95">
          <Plus className="h-4 w-4" />Create Month
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
            <th className="px-4 py-3 text-left font-bold">Month Folder</th><th className="px-4 py-3 text-left font-bold">Year</th><th className="px-4 py-3 text-left font-bold">NC Records</th><th className="px-4 py-3 text-left font-bold">Open / Closed</th><th className="px-4 py-3 text-left font-bold">Created</th><th className="px-4 py-3 text-right font-bold">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {(index || []).map((entry) => {
              const rows = loadMonthRows(unit, entry.year, entry.monthIdx) || [];
              const closed = rows.filter((row) => row.statusCA === 'Closed').length;
              const open = rows.filter((row) => row.statusCA === 'Open').length;
              const openMonth = () => onOpenMonth(entry.year, entry.monthIdx);
              return <tr key={`${entry.year}-${entry.monthIdx}`} tabIndex={0} role="button" onClick={openMonth} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMonth(); } }} className="group cursor-pointer transition hover:bg-blue-50/60 focus:bg-blue-50/60 focus:outline-none">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Calendar className="h-4 w-4" /></span><span className="font-semibold text-slate-800 group-hover:text-blue-700">{entry.label}</span></div></td>
                <td className="px-4 py-3 text-sm text-slate-600">{entry.year}</td><td className="px-4 py-3 text-sm text-slate-600">{rows.length}</td>
                <td className="px-4 py-3 text-xs"><span className="font-semibold text-emerald-700">{closed} closed</span><span className="mx-2 text-slate-300">·</span><span className="font-semibold text-amber-700">{open} open</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openMonth(); }} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700">Open Folder</button></td>
              </tr>;
            })}
            {(index || []).length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No monthly records yet. Use “Create Month” to add the first folder.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────
   TODAY NC VIEW — View and log NCs for Today's date
──────────────────────────────────────────────────────────*/
function TodayNCView({ unit }) {
  const todayStr = getTodayDateStr();
  const todayHuman = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  const [allMonthRows, setAllMonthRows] = useState(() => {
    const saved = loadMonthRows(unit, currentYear, currentMonthIdx);
    if (saved && saved.length > 0) return saved;
    const seed = [
      {
        id: 9001,
        auditDate: todayStr,
        lineAreaName: 'Assy',
        controlPlan: 'CP-WH-PE-MSIL-YHB-002',
        pfmea: 'PFMEA-WH-PE-MSIL-YHB-002',
        processName: 'Final Inspection & Testing',
        observations: 'Continuity tester probe calibration seal was broken on Station 2.',
        evidence1Value: 'Image Upload',
        evidence1Images: [],
        preventiveActions: 'Probe recalibrated and new tamper-evident calibration seal affixed.',
        evidence2Value: 'Not Available',
        evidence2Images: [],
        targetDateCA: todayStr,
        targetDatePA: '2026-10-10',
        resp: 'Quality Dept',
        statusCA: 'In Progress',
        statusPA: 'Open',
        verification: '',
      },
      {
        id: 9002,
        auditDate: todayStr,
        lineAreaName: 'Weld',
        controlPlan: 'CP-WH-WLD-001',
        pfmea: 'PFMEA-WH-WLD-001',
        processName: 'Laser Marking & Crimping',
        observations: 'Crimping height gauge zero-offset was found drifted by +0.03mm.',
        evidence1Value: 'Image Upload',
        evidence1Images: [],
        preventiveActions: 'Daily dial gauge zeroing checkpoint added to operator start-up sheet.',
        evidence2Value: 'Image Upload',
        evidence2Images: [],
        targetDateCA: todayStr,
        targetDatePA: '2026-10-08',
        resp: 'Prod Line Leader',
        statusCA: 'Closed',
        statusPA: 'Closed',
        verification: 'QA Head',
      },
    ];
    saveMonthRows(unit, currentYear, currentMonthIdx, seed);
    return seed;
  });

  const updateRow = (id, field, value) => {
    setAllMonthRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      saveMonthRows(unit, currentYear, currentMonthIdx, next);
      return next;
    });
  };

  const addRow = () => {
    setAllMonthRows((prev) => {
      const next = [
        {
          ...emptyRow(Date.now()),
          auditDate: todayStr,
          statusCA: 'Open',
          statusPA: 'Open',
          targetDateCA: todayStr,
        },
        ...prev,
      ];
      saveMonthRows(unit, currentYear, currentMonthIdx, next);
      return next;
    });
  };

  const deleteRow = (id) => {
    setAllMonthRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveMonthRows(unit, currentYear, currentMonthIdx, next);
      return next;
    });
  };

  const todayRows = useMemo(() => {
    return allMonthRows.filter((r) => r.auditDate === todayStr);
  }, [allMonthRows, todayStr]);

  const closedCount = todayRows.filter((r) => r.statusCA === 'Closed').length;
  const inProgressCount = todayRows.filter((r) => r.statusCA === 'In Progress').length;
  const openCount = todayRows.filter((r) => r.statusCA === 'Open' || !r.statusCA).length;

  const hdr = 'border border-slate-700 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-2 text-center align-middle';
  const sub = 'border border-slate-600 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-1.5 text-center align-middle';
  const dc = 'border border-slate-200 px-1.5 py-1 align-top text-center';

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Clean Today NC Header (no banners, no KPI cards, no cross-links) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <span>Today's Non-Conformances (NC - List)</span>
            <span className="text-xs font-normal text-slate-500">({todayHuman})</span>
          </h2>
          {unit && <span className="text-[11px] text-slate-400">Unit: {unit}</span>}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-orange-500/25 transition active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Log NC for Today</span>
        </button>
      </div>

      {/* Today's NC Table */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[1500px]">
            <table className="w-full border-collapse table-fixed text-[11px]">
              <colgroup>
                <col style={{ width: '40px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} />
                <col style={{ width: '110px' }} /><col style={{ width: '110px' }} /><col style={{ width: '100px' }} />
                <col style={{ width: '160px' }} /><col style={{ width: '130px' }} /><col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} /><col style={{ width: '80px' }} /><col style={{ width: '80px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={hdr} rowSpan={2}>S No.</th>
                  <th className={hdr} rowSpan={2}>Audit Date</th>
                  <th className={hdr} rowSpan={2}>Line / Area Name</th>
                  <th className={hdr} rowSpan={2}>Control Plan</th>
                  <th className={hdr} rowSpan={2}>PFMEA</th>
                  <th className={hdr} rowSpan={2}>Process Name</th>
                  <th className={hdr} rowSpan={2}>Observations</th>
                  <th className={hdr} rowSpan={2}>Evidence</th>
                  <th className={hdr} rowSpan={2}>Preventive Actions</th>
                  <th className={hdr} rowSpan={2}>Evidence</th>
                  <th className={hdr} colSpan={2}>Target Date</th>
                  <th className={hdr} rowSpan={2}>Resp.</th>
                  <th className={hdr} colSpan={3}>Status</th>
                </tr>
                <tr>
                  <th className={sub}>CA</th><th className={sub}>PA</th>
                  <th className={sub}>CA</th><th className={sub}>PA</th><th className={sub}>Verification</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 group/row transition">
                    <td className={`${dc} text-slate-500 font-bold`}>
                      <div className="flex flex-col items-center gap-1">
                        <span>{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className={dc}>
                      <input
                        type="date"
                        value={row.auditDate}
                        onChange={(e) => updateRow(row.id, 'auditDate', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-hidden px-1 py-1 cursor-pointer"
                      />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.lineAreaName} onChange={(v) => updateRow(row.id, 'lineAreaName', v)} placeholder="Area..." />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.controlPlan} onChange={(v) => updateRow(row.id, 'controlPlan', v)} placeholder="CP No." />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.pfmea} onChange={(v) => updateRow(row.id, 'pfmea', v)} placeholder="PFMEA No." />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.processName} onChange={(v) => updateRow(row.id, 'processName', v)} placeholder="Process..." />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.observations} onChange={(v) => updateRow(row.id, 'observations', v)} placeholder="Describe observation..." />
                    </td>
                    <td className={dc}>
                      <EvidenceCell
                        value={row.evidence1Value}
                        images={row.evidence1Images}
                        onValueChange={(v) => updateRow(row.id, 'evidence1Value', v)}
                        onImagesChange={(imgs) => updateRow(row.id, 'evidence1Images', imgs)}
                      />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.preventiveActions} onChange={(v) => updateRow(row.id, 'preventiveActions', v)} placeholder="Actions taken..." />
                    </td>
                    <td className={dc}>
                      <EvidenceCell
                        value={row.evidence2Value}
                        images={row.evidence2Images}
                        onValueChange={(v) => updateRow(row.id, 'evidence2Value', v)}
                        onImagesChange={(imgs) => updateRow(row.id, 'evidence2Images', imgs)}
                      />
                    </td>
                    <td className={dc}>
                      <input
                        type="date"
                        value={row.targetDateCA}
                        onChange={(e) => updateRow(row.id, 'targetDateCA', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-hidden px-1 py-1 cursor-pointer"
                      />
                    </td>
                    <td className={dc}>
                      <input
                        type="date"
                        value={row.targetDatePA}
                        onChange={(e) => updateRow(row.id, 'targetDatePA', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-hidden px-1 py-1 cursor-pointer"
                      />
                    </td>
                    <td className={dc}>
                      <TextCell value={row.resp} onChange={(v) => updateRow(row.id, 'resp', v)} placeholder="Resp." />
                    </td>
                    {['statusCA', 'statusPA'].map((field) => (
                      <td key={field} className={`${dc} !align-middle !text-center`}>
                        <select
                          value={row[field]}
                          onChange={(e) => updateRow(row.id, field, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-center text-[11px] text-slate-700 focus:border-blue-400 focus:outline-hidden cursor-pointer"
                        >
                          <option value="">—</option>
                          <option value="Open">Open</option>
                          <option value="Closed">Closed</option>
                          <option value="In Progress">In Progress</option>
                        </select>
                      </td>
                    ))}
                    <td className={dc}>
                      <TextCell centered value={row.verification} onChange={(v) => updateRow(row.id, 'verification', v)} placeholder="Verified by..." />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={16} className="border border-slate-200 px-3 py-2 bg-slate-50">
                    <button
                      type="button"
                      onClick={addRow}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Today's NC Row</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   NC-LIST ROOT — 3 Linked Pages (Monthly | Yearly | Today)
──────────────────────────────────────────────────────────*/
export default function NCList({
  onBack,
  unit,
  isEmbedded = false,
  onFormOpenChange,
  onNavigateToPlan,
  initialSubView = 'monthly',
  prefillData = null,
  onClearPrefill = null,
  onSubViewChange,
}) {
  const [index, setIndex] = useState(() => {
    const saved = loadIndex(unit);
    if (saved && saved.length > 0) return saved;
    return buildInitialIndex(unit);
  });

  // view: 'monthly' | 'yearly' | 'yearly-records' | 'today' | 'form'
  const [view, setView] = useState(initialSubView || 'monthly');
  const [activeMonthEntry, setActiveMonthEntry] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (unit) {
      const saved = loadIndex(unit);
      if (saved && saved.length > 0) {
        setIndex(saved);
      } else {
        setIndex(buildInitialIndex(unit));
      }
    }
  }, [unit]);

  useEffect(() => {
    if (initialSubView) {
      setView(initialSubView);
    }
  }, [initialSubView]);

  useEffect(() => {
    onFormOpenChange?.(view === 'form');
  }, [view, onFormOpenChange]);

  const handleSubViewSwitch = (newView) => {
    setView(newView);
    setActiveMonthEntry(null);
    setSelectedYear(null);
    onSubViewChange?.(newView);
  };

  const handleOpenMonth = (year, monthIdx) => {
    setActiveMonthEntry({ year, monthIdx });
    setView('form');
  };

  const handleCreateMonth = (year, monthIdx) => {
    const label = `${MONTHS[monthIdx]} ${year}`;
    const exists = index.some((e) => e.year === year && e.monthIdx === monthIdx);
    if (!exists) {
      const entry = { year, monthIdx, label, createdAt: new Date().toISOString() };
      const newIndex = [...index, entry].sort((a, b) =>
        a.year !== b.year ? b.year - a.year : b.monthIdx - a.monthIdx
      );
      setIndex(newIndex);
      saveIndex(unit, newIndex);
      if (!loadMonthRows(unit, year, monthIdx)) {
        saveMonthRows(unit, year, monthIdx, []);
      }
    }
    setCreateModalOpen(false);
    handleOpenMonth(year, monthIdx);
  };

  // 1. Form view (Full editable sheet for a single month)
  if (view === 'form' && activeMonthEntry) {
    return (
      <MonthForm
        onViewChange={handleSubViewSwitch}
        unit={unit}
        year={activeMonthEntry.year}
        monthIdx={activeMonthEntry.monthIdx}
        onBack={() => {
          setView('monthly');
          setActiveMonthEntry(null);
        }}
      />
    );
  }

  // 2. Records inside one year folder
  if (view === 'yearly-records' && selectedYear) {
    return (
      <YearlyView
        onViewChange={handleSubViewSwitch}
        unit={unit}
        index={index}
        year={selectedYear}
        onBack={() => setView('yearly')}
      />
    );
  }

  const RootContainer = isEmbedded ? 'div' : 'main';
  const containerClass = isEmbedded
    ? 'w-full space-y-4 animate-fade-in'
    : 'flex h-full min-h-0 w-full flex-col overflow-y-auto bg-[#F4F6F9] p-4 md:p-6 space-y-5';

  const currentActiveTab = view === 'today' ? 'today' : view === 'yearly' ? 'yearly' : 'monthly';

  return (
    <RootContainer className={`${containerClass} nc-root`}>
      {/* Top Header if not embedded */}
      {!isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <>
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>All Folders</span>
                </button>
                <div className="h-4 w-px bg-slate-300" />
              </>
            )}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800">
                  NC - List <span className="text-xs font-normal text-slate-500">(Non Conformance List)</span>
                </h1>
                <p className="text-[11px] text-slate-500">
                  {unit && <span className="font-bold text-slate-700">{unit} Unit · </span>}
                  Choose a view — Monthly, Yearly, or Today's NCs
                </p>
              </div>
            </div>
          </div>
          {unit && (
            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200">
              Unit: {unit}
            </span>
          )}
        </div>
      )}

      {/* 1. Linked Top Navigation Bar: [ Monthly | Yearly | Today ] ONLY */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
      <SubNavTabs
        currentView={currentActiveTab}
        onViewChange={handleSubViewSwitch}
      />
      <FormZoomControls rootSelector=".nc-root" />
      </div>

      {/* 2. Sub-page View Rendering */}
      {view === 'monthly' && (
        <>
          <MonthlyFolderView
            unit={unit}
            index={index}
            onBack={() => setView('monthly')}
            onOpenMonth={handleOpenMonth}
            onCreateMonth={() => setCreateModalOpen(true)}
          />
          <CreateMonthModal
            isOpen={createModalOpen}
            existingEntries={index}
            onClose={() => setCreateModalOpen(false)}
            onConfirm={handleCreateMonth}
          />
        </>
      )}

      {view === 'yearly' && (
        <YearlyFolderView
          unit={unit}
          index={index}
          onBack={() => setView('monthly')}
          onOpenYear={(year) => {
            setSelectedYear(year);
            setView('yearly-records');
          }}
        />
      )}

      {view === 'today' && (
        <TodayNCView
          unit={unit}
        />
      )}
    </RootContainer>
  );
}

