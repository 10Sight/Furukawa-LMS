import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Upload, X, ZoomIn, ZoomOut, RotateCcw, Save, Image as ImageIcon, ChevronDown } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   IMAGE POPUP EDITOR
───────────────────────────────────────────────────────────────*/
function ImagePopup({ images, onClose, onSave }) {
  const [localImages, setLocalImages] = useState(images || []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef(null);

  const handleAddImages = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLocalImages((prev) => [...prev, { src: ev.target.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDelete = (idx) => {
    setLocalImages((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((prev) => Math.max(0, prev - 1));
  };

  const handleSave = () => {
    onSave(localImages);
    onClose();
  };

  const active = localImages[activeIdx];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex flex-col w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Evidence Images</span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              {localImages.length} {localImages.length === 1 ? 'image' : 'images'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar - thumbnails */}
          <div className="flex flex-col w-28 shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto gap-2 p-2">
            {localImages.map((img, idx) => (
              <div
                key={idx}
                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition ${
                  activeIdx === idx ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-slate-300'
                }`}
                onClick={() => setActiveIdx(idx)}
              >
                <img
                  src={img.src}
                  alt={img.name || `Evidence ${idx + 1}`}
                  className="w-full h-20 object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(idx); }}
                  className="absolute top-1 right-1 rounded-full bg-red-500 text-white p-0.5 hover:bg-red-600 transition"
                  title="Remove image"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}

            {/* Add more */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 text-slate-400 hover:text-blue-500 transition text-[10px] font-bold"
            >
              <Plus className="h-5 w-5" />
              <span>Add</span>
            </button>
          </div>

          {/* Main preview */}
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            {active ? (
              <>
                {/* Zoom toolbar */}
                <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-white">
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition">
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-600 w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition">
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setZoom(1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition" title="Reset zoom">
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <span className="ml-2 text-[11px] text-slate-400 truncate max-w-[200px]">{active.name}</span>
                </div>
                {/* Image */}
                <div className="flex flex-1 min-h-0 overflow-auto items-center justify-center bg-slate-100 p-4">
                  <img
                    src={active.src}
                    alt={active.name}
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.15s' }}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
                <ImageIcon className="h-12 w-12 opacity-30" />
                <p className="text-sm font-semibold">No images yet</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Image
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
          >
            <Upload className="h-3.5 w-3.5 text-blue-600" />
            Add More Images
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95"
            >
              <Save className="h-3.5 w-3.5" />
              Save Images
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleAddImages}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   EVIDENCE CELL — dropdown + image popup
───────────────────────────────────────────────────────────────*/
function EvidenceCell({ value, images, onValueChange, onImagesChange }) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const fileRef = useRef(null);

  const handleSelect = (opt) => {
    onValueChange(opt);
    setDropOpen(false);
    if (opt === 'Image Upload') {
      fileRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve({ src: ev.target.result, name: file.name });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((newImgs) => {
      onImagesChange([...(images || []), ...newImgs]);
      setPopupOpen(true);
    });
    e.target.value = '';
  };

  const imageCount = images?.length || 0;
  const label = value === 'Image Upload' ? `Image Upload${imageCount > 0 ? ` (${imageCount})` : ''}` : value || 'Select...';
  const isImage = value === 'Image Upload';
  const isNA = value === 'Not Available';

  return (
    <div className="relative flex flex-col items-center gap-1 min-w-[110px]">
      {/* Dropdown trigger */}
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setDropOpen((o) => !o)}
          className={`flex w-full items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition cursor-pointer ${
            isImage
              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
              : isNA
              ? 'border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>

        {dropOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSelect('Image Upload')}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition"
            >
              <Upload className="h-3.5 w-3.5 text-blue-600" />
              Image Upload
            </button>
            <button
              type="button"
              onClick={() => handleSelect('Not Available')}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-100 text-slate-500 transition"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
              Not Available
            </button>
          </div>
        )}
      </div>

      {/* Image thumbnail strip */}
      {isImage && imageCount > 0 && (
        <button
          type="button"
          onClick={() => setPopupOpen(true)}
          className="flex w-full items-center justify-center overflow-hidden rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
          title="Edit / view images"
        >
          <img
            src={images[0].src}
            alt="evidence"
            className="h-16 w-full object-cover"
          />
          {imageCount > 1 && (
            <span className="absolute bottom-1 right-1 rounded-full bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5">
              +{imageCount - 1}
            </span>
          )}
        </button>
      )}

      {isImage && imageCount === 0 && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold py-2 transition"
        >
          <Upload className="h-3 w-3" />
          Upload
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Image popup */}
      {popupOpen && (
        <ImagePopup
          images={images || []}
          onClose={() => setPopupOpen(false)}
          onSave={(imgs) => { onImagesChange(imgs); setPopupOpen(false); }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   EDITABLE TEXT CELL
───────────────────────────────────────────────────────────────*/
function TextCell({ value, onChange, placeholder = '', className = '' }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className={`w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-1 text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 transition placeholder-slate-300 ${className}`}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
   DEFAULT EMPTY ROW FACTORY
───────────────────────────────────────────────────────────────*/
function emptyRow(id) {
  return {
    id,
    auditDate: '',
    lineAreaName: '',
    controlPlan: '',
    pfmea: '',
    processName: '',
    observations: '',
    evidence1Value: '',
    evidence1Images: [],
    preventiveActions: '',
    evidence2Value: '',
    evidence2Images: [],
    targetDateCA: '',
    targetDatePA: '',
    resp: '',
    statusCA: '',
    statusPA: '',
    verification: '',
  };
}

/* ─────────────────────────────────────────────────────────────
   MC LIST FORM — main export
───────────────────────────────────────────────────────────────*/
export default function MCList({ onBack, unit }) {
  const storageKey = `mc_list_rows_${unit || 'all'}`;

  const [rows, setRows] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [emptyRow(Date.now())];
    } catch {
      return [emptyRow(Date.now())];
    }
  });

  const persist = useCallback((next) => {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }, [storageKey]);

  const updateRow = (id, field, value) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      persist(next);
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => {
      const next = [...prev, emptyRow(Date.now())];
      persist(next);
      return next;
    });
  };

  const deleteRow = (id) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      persist(next);
      return next;
    });
  };

  const headerCell = 'border border-slate-700 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide px-1.5 py-2 text-center align-middle';
  const subHeaderCell = 'border border-slate-600 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-1.5 text-center align-middle';
  const dataCell = 'border border-slate-200 px-1.5 py-1 align-top text-center';

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-slate-100">
      {/* ── TOP ACTION BAR ── */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 md:px-5 shadow-xs z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Folders
          </button>
          </div>


        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
            <span>✓ Auto-saved</span>
          </div>
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>
      </header>

      {/* ── FORM SHEET ── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-2 md:p-3">
        <div className="h-full overflow-auto rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="min-w-[1500px]">


            {/* ── TABLE ── */}
            <table className="w-full border-collapse table-fixed text-[11px]">
              <colgroup>
                <col style={{ width: '40px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '90px' }} />
              </colgroup>

              <thead>
                {/* Row 1 — main column headers */}
                <tr>
                  <th className={headerCell} rowSpan={2}>S No.</th>
                  <th className={headerCell} rowSpan={2}>Audit Date</th>
                  <th className={headerCell} rowSpan={2}>Line / Area Name</th>
                  <th className={headerCell} rowSpan={2}>Control Plan</th>
                  <th className={headerCell} rowSpan={2}>PFMEA</th>
                  <th className={headerCell} rowSpan={2}>Process Name</th>
                  <th className={headerCell} rowSpan={2}>Observations</th>
                  <th className={headerCell} rowSpan={2}>Evidence</th>
                  <th className={headerCell} rowSpan={2}>Preventive Actions</th>
                  <th className={headerCell} rowSpan={2}>Evidence</th>
                  <th className={`${headerCell}`} colSpan={2}>Target Date</th>
                  <th className={headerCell} rowSpan={2}>Resp.</th>
                  <th className={`${headerCell}`} colSpan={3}>Status</th>
                </tr>
                {/* Row 2 — sub-headers for Target Date + Status */}
                <tr>
                  <th className={subHeaderCell}>CA</th>
                  <th className={subHeaderCell}>PA</th>
                  <th className={subHeaderCell}>CA</th>
                  <th className={subHeaderCell}>PA</th>
                  <th className={subHeaderCell}>Verification</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 group/row transition">
                    {/* S No. */}
                    <td className={`${dataCell} text-slate-500 font-bold text-center`}>
                      <div className="flex flex-col items-center gap-1">
                        <span>{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>

                    {/* Audit Date */}
                    <td className={dataCell}>
                      <input
                        type="date"
                        value={row.auditDate}
                        onChange={(e) => updateRow(row.id, 'auditDate', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none px-1 py-1 cursor-pointer"
                      />
                    </td>

                    {/* Line / Area Name */}
                    <td className={dataCell}>
                      <TextCell value={row.lineAreaName} onChange={(v) => updateRow(row.id, 'lineAreaName', v)} placeholder="Area..." />
                    </td>

                    {/* Control Plan */}
                    <td className={dataCell}>
                      <TextCell value={row.controlPlan} onChange={(v) => updateRow(row.id, 'controlPlan', v)} placeholder="CP No." />
                    </td>

                    {/* PFMEA */}
                    <td className={dataCell}>
                      <TextCell value={row.pfmea} onChange={(v) => updateRow(row.id, 'pfmea', v)} placeholder="PFMEA No." />
                    </td>

                    {/* Process Name */}
                    <td className={dataCell}>
                      <TextCell value={row.processName} onChange={(v) => updateRow(row.id, 'processName', v)} placeholder="Process..." />
                    </td>

                    {/* Observations */}
                    <td className={dataCell}>
                      <TextCell value={row.observations} onChange={(v) => updateRow(row.id, 'observations', v)} placeholder="Describe observation..." />
                    </td>

                    {/* Evidence 1 */}
                    <td className={dataCell}>
                      <EvidenceCell
                        value={row.evidence1Value}
                        images={row.evidence1Images}
                        onValueChange={(v) => updateRow(row.id, 'evidence1Value', v)}
                        onImagesChange={(imgs) => updateRow(row.id, 'evidence1Images', imgs)}
                      />
                    </td>

                    {/* Preventive Actions */}
                    <td className={dataCell}>
                      <TextCell value={row.preventiveActions} onChange={(v) => updateRow(row.id, 'preventiveActions', v)} placeholder="Actions taken..." />
                    </td>

                    {/* Evidence 2 */}
                    <td className={dataCell}>
                      <EvidenceCell
                        value={row.evidence2Value}
                        images={row.evidence2Images}
                        onValueChange={(v) => updateRow(row.id, 'evidence2Value', v)}
                        onImagesChange={(imgs) => updateRow(row.id, 'evidence2Images', imgs)}
                      />
                    </td>

                    {/* Target Date CA */}
                    <td className={dataCell}>
                      <input
                        type="date"
                        value={row.targetDateCA}
                        onChange={(e) => updateRow(row.id, 'targetDateCA', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none px-1 py-1 cursor-pointer"
                      />
                    </td>

                    {/* Target Date PA */}
                    <td className={dataCell}>
                      <input
                        type="date"
                        value={row.targetDatePA}
                        onChange={(e) => updateRow(row.id, 'targetDatePA', e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent text-[11px] text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none px-1 py-1 cursor-pointer"
                      />
                    </td>

                    {/* Resp. */}
                    <td className={dataCell}>
                      <TextCell value={row.resp} onChange={(v) => updateRow(row.id, 'resp', v)} placeholder="Resp." />
                    </td>

                    {/* Status CA */}
                    <td className={dataCell}>
                      <select
                        value={row.statusCA}
                        onChange={(e) => updateRow(row.id, 'statusCA', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-[11px] text-slate-700 focus:border-blue-400 focus:outline-none cursor-pointer"
                      >
                        <option value="">—</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                        <option value="In Progress">In Progress</option>
                      </select>
                    </td>

                    {/* Status PA */}
                    <td className={dataCell}>
                      <select
                        value={row.statusPA}
                        onChange={(e) => updateRow(row.id, 'statusPA', e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-1 py-1.5 text-[11px] text-slate-700 focus:border-blue-400 focus:outline-none cursor-pointer"
                      >
                        <option value="">—</option>
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                        <option value="In Progress">In Progress</option>
                      </select>
                    </td>

                    {/* Verification */}
                    <td className={dataCell}>
                      <TextCell value={row.verification} onChange={(v) => updateRow(row.id, 'verification', v)} placeholder="Verified by..." />
                    </td>
                  </tr>
                ))}

                {/* Add row footer */}
                <tr>
                  <td colSpan={16} className="border border-slate-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={addRow}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs font-bold text-blue-600 hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Row
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
