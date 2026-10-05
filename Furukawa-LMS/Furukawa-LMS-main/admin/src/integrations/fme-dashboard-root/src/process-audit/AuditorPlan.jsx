import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  BarChart3,
  Clock,
  Plus,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock4,
  Folder,
  X,
  Search,
  Check,
  Building2,
  Trash2,
  Edit2,
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();

export function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatHumanDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ─────────────────────────────────────────────────────────────
   DEFAULT DATA GENERATORS
───────────────────────────────────────────────────────────────*/




















/* ─────────────────────────────────────────────────────────────
   STORAGE UTILITIES
───────────────────────────────────────────────────────────────*/
function storageKeyPlanMonthly(unit, year, monthIdx) {
  return `auditor_plan_monthly_${unit || 'All'}_${year}_${monthIdx}`;
}

function storageKeyPlanIndex(unit) {
  return `auditor_plan_index_${unit || 'All'}`;
}

function loadPlanIndex(unit) {
  try {
    const raw = localStorage.getItem(storageKeyPlanIndex(unit));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function savePlanIndex(unit, idx) {
  try {
    localStorage.setItem(storageKeyPlanIndex(unit), JSON.stringify(idx));
  } catch {}
}

function loadPlanMonthRows(unit, year, monthIdx) {
  try {
    const raw = localStorage.getItem(storageKeyPlanMonthly(unit, year, monthIdx));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePlanMonthRows(unit, year, monthIdx, rows) {
  try {
    localStorage.setItem(storageKeyPlanMonthly(unit, year, monthIdx), JSON.stringify(rows));
  } catch {}
}

function buildInitialPlanIndex(unit) { return []; }

/* ─────────────────────────────────────────────────────────────
   LINKED SUB-NAVIGATION TABS (Monthly | Yearly | Today ONLY)
───────────────────────────────────────────────────────────────*/
export function SubNavTabs({ currentView, onViewChange }) {
  const tabs = [
    { id: 'monthly', label: 'Monthly', icon: Calendar },
    { id: 'yearly', label: 'Yearly', icon: BarChart3 },
    { id: 'today', label: 'Today', icon: Clock },
  ];

  return (
    <div className="flex items-center gap-1.5 bg-[#F4F6F9] p-1 rounded-xl w-fit">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onViewChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              isActive
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ADD / EDIT AUDIT MODAL
───────────────────────────────────────────────────────────────*/
function AuditModal({ isOpen, onClose, onSave, initialData = null, defaultDate = '' }) {
  const [formData, setFormData] = useState({
    date: defaultDate || getTodayDateStr(),
    shift: 'Shift A (08:00 - 16:30)',
    area: 'Assy',
    processName: '',
    controlPlan: '',
    pfmea: '',
    auditor: '',
    duration: '1 Person / 1 hr',
    status: 'Scheduled',
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        date: defaultDate || getTodayDateStr(),
        shift: 'Shift A (08:00 - 16:30)',
        area: 'Assy',
        processName: '',
        controlPlan: '',
        pfmea: '',
        auditor: '',
        duration: '1 Person / 1 hr',
        status: 'Scheduled',
        notes: '',
      });
    }
  }, [initialData, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.processName.trim()) return;
    onSave({ ...formData, id: initialData?.id || Date.now() });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {initialData ? 'Edit Audit Schedule' : 'Schedule Process Audit'}
              </h3>
              <p className="text-xs text-slate-500">Configure audit slot in the audit schedule</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Audit Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Shift
              </label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="Shift A (08:00 - 16:30)">Shift A (08:00 - 16:30)</option>
                <option value="Shift B (16:30 - 01:00)">Shift B (16:30 - 01:00)</option>
                <option value="Shift C (01:00 - 08:00)">Shift C (01:00 - 08:00)</option>
                <option value="General Shift">General Shift</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Line / Area
              </label>
              <input
                type="text"
                placeholder="e.g. Assy, Weld, Paint"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Conducted">Conducted (Completed)</option>
                <option value="Delayed">Delayed / Rescheduled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Manufacturing Process Name
            </label>
            <input
              type="text"
              placeholder="e.g. FIA, Crimping, Laser Marking, Primer"
              value={formData.processName}
              onChange={(e) => setFormData({ ...formData, processName: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Control Plan Ref
              </label>
              <input
                type="text"
                value={formData.controlPlan}
                onChange={(e) => setFormData({ ...formData, controlPlan: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                PFMEA Ref
              </label>
              <input
                type="text"
                value={formData.pfmea}
                onChange={(e) => setFormData({ ...formData, pfmea: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Auditor Assigned
              </label>
              <input
                type="text"
                placeholder="Auditor Name"
                value={formData.auditor}
                onChange={(e) => setFormData({ ...formData, auditor: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Required Duration
              </label>
              <input
                type="text"
                placeholder="e.g. 1 Person / 1 hr"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Remarks / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Audit checkpoint observations..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{initialData ? 'Save Changes' : 'Schedule Audit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CREATE MONTH MODAL
───────────────────────────────────────────────────────────────*/
function CreateMonthPlanModal({ isOpen, existingEntries, onClose, onConfirm }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());

  if (!isOpen) return null;
  const alreadyExists = (existingEntries || []).some((e) => e.year === year && e.monthIdx === monthIdx);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Create Monthly Audit Plan</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Select Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-hidden"
            >
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Select Month</label>
            <select
              value={monthIdx}
              onChange={(e) => setMonthIdx(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-hidden"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(year, monthIdx)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{alreadyExists ? 'Open Existing' : 'Create & Open'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────────────────────────*/
function AuditStatusBadge({ status }) {
  if (status === 'Conducted') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        <span>Conducted</span>
      </span>
    );
  }
  if (status === 'In Progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
        <Clock4 className="h-3 w-3 text-violet-600" />
        <span>In Progress</span>
      </span>
    );
  }
  if (status === 'Delayed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="h-3 w-3 text-rose-600" />
        <span>Delayed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
      <Clock className="h-3 w-3 text-blue-600" />
      <span>Scheduled</span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   VIEW 1: MONTH DETAIL VIEW (WHOLE SCREEN FORM - NO KPI CARDS)
───────────────────────────────────────────────────────────────*/
function MonthPlanDetailView({ unit, year, monthIdx, onBack, onOpenMainForm }) {
  const monthLabel = `${MONTHS[monthIdx]} ${year}`;
  const [rows, setRows] = useState(() => {
    return loadPlanMonthRows(unit, year, monthIdx) || [];
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState(null);
  const [search, setSearch] = useState('');

  const saveRows = (newRows) => {
    setRows(newRows);
    savePlanMonthRows(unit, year, monthIdx, newRows);
  };

  const handleSaveAudit = (audit) => {
    if (editingAudit) {
      saveRows(rows.map((r) => (r.id === audit.id ? audit : r)));
    } else {
      saveRows([...rows, audit]);
    }
    setEditingAudit(null);
  };

  const handleDelete = (id) => {
    saveRows(rows.filter((r) => r.id !== id));
  };

  const handleToggleStatus = (id) => {
    saveRows(
      rows.map((r) => {
        if (r.id === id) {
          const nextStatus = r.status === 'Scheduled' ? 'In Progress' : r.status === 'In Progress' ? 'Conducted' : 'Scheduled';
          return { ...r, status: nextStatus };
        }
        return r;
      })
    );
  };

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.processName?.toLowerCase().includes(q) ||
        r.area?.toLowerCase().includes(q) ||
        r.auditor?.toLowerCase().includes(q) ||
        r.controlPlan?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="fixed inset-0 z-[200] flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      {/* WHOLE SCREEN HEADER: ONLY BACK BUTTON & TITLE */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-xs z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition active:scale-95 shadow-xs cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          </div>


        <div className="flex items-center gap-2">
          {onOpenMainForm && (
            <button
              type="button"
              onClick={onOpenMainForm}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              <span className="hidden sm:inline">Open Auditor Plan Matrix</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingAudit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Audit</span>
          </button>
        </div>
      </header>

      {/* Content: Clean Table (NO KPI CARDS) */}
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto p-3 md:p-5 space-y-3">
        {/* Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search planned audits by process, line, auditor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {filteredRows.length} {filteredRows.length === 1 ? 'audit' : 'audits'} scheduled
          </span>
        </div>

        {/* Audits Table */}
        <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="min-w-[900px] w-full border-collapse text-left text-xs">
            <thead className="bg-[#FAFAFC] border-b border-[#F1F3F5] text-[11px] uppercase tracking-wider text-slate-500 font-bold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 text-center w-12">S.No</th>
                <th className="py-3 px-3">Date & Shift</th>
                <th className="py-3 px-3">Line / Area</th>
                <th className="py-3 px-3">Manufacturing Process</th>
                <th className="py-3 px-3">Control Plan / PFMEA</th>
                <th className="py-3 px-3">Auditor</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-blue-50/40 transition group">
                  <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 block">{formatHumanDate(row.date)}</span>
                    <span className="text-[10px] text-slate-500">{row.shift}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                      {row.area}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-blue-700">{row.processName}</span>
                    <span className="text-[10px] text-slate-400 block">{row.duration || '1 hr'}</span>
                  </td>
                  <td className="py-3 px-3 text-[11px] text-slate-600">
                    <div>{row.controlPlan}</div>
                    <div className="text-[10px] text-slate-400">{row.pfmea}</div>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{row.auditor}</td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(row.id)}
                      className="cursor-pointer hover:opacity-80 transition"
                      title="Click to cycle status"
                    >
                      <AuditStatusBadge status={row.status} />
                    </button>
                  </td>
                  <td className="py-3 px-3 text-[11px] text-slate-600 max-w-xs truncate" title={row.notes}>
                    {row.notes || '—'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAudit(row);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                        title="Edit audit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                        title="Delete audit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                    No scheduled audits found. Click "+ Schedule Audit" to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AuditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAudit(null);
        }}
        onSave={handleSaveAudit}
        initialData={editingAudit}
        defaultDate={`${year}-${String(monthIdx + 1).padStart(2, '0')}-01`}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   VIEW 2: MONTHLY FOLDERS VIEW (NO KPI CARDS)
───────────────────────────────────────────────────────────────*/
function MonthlyFoldersView({ unit, index, documents = [], onOpenDoc, onOpenMonth, onCreateMonth }) {
  return (
    <div className="w-full space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <span>Monthly Audit Plans</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a month folder to open the monthly audit plan form
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateMonth}
          className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Create Month Plan</span>
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-[#ECEFF3] bg-white shadow-xs">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-[#FAFAFC] border-b border-[#F1F3F5] text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="py-3.5 px-4 text-left">Month Folder</th>
              <th className="py-3.5 px-4 text-left">Year</th>
              <th className="py-3.5 px-4 text-left">Planned Audits</th>
              <th className="py-3.5 px-4 text-left">Progress</th>
              <th className="py-3.5 px-4 text-left">Created Date</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(index || []).map((entry) => {
              const rows = loadPlanMonthRows(unit, entry.year, entry.monthIdx) || [];
              const conducted = rows.filter((r) => r.status === 'Conducted').length;
              const scheduled = rows.filter((r) => r.status === 'Scheduled').length;
              const pct = rows.length > 0 ? Math.round((conducted / rows.length) * 100) : 0;
              const matchingDoc =
                documents.find((d) => d.formKey === 'Auditer Plan' && (Number(d.year) === entry.year || !d.year)) ||
                documents.find((d) => d.formKey === 'Auditer Plan') || {
                  id: `doc_auditer_plan_${entry.year}`,
                  title: `PROCESS AUDIT PLAN - ${entry.year}`,
                  code: `PLAN-${entry.year}`,
                  year: entry.year,
                  unit: unit || 'All Units',
                  isDefault: true,
                  formKey: 'Auditer Plan',
                  folderId: 'auditer-plan',
                };
              const openFolder = () => onOpenDoc ? onOpenDoc(matchingDoc) : onOpenMonth(entry.year, entry.monthIdx);

              return (
                <tr
                  key={`${entry.year}-${entry.monthIdx}`}
                  onClick={openFolder}
                  className="group cursor-pointer hover:bg-blue-50/50 transition"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Calendar className="h-4.5 w-4.5" />
                      </span>
                      <span className="font-bold text-slate-800 group-hover:text-blue-700 transition">
                        {entry.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-slate-600">{entry.year}</td>
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-700">
                    {rows.length} {rows.length === 1 ? 'audit' : 'audits'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1 w-44">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-emerald-700">{conducted} done</span>
                        <span className="text-slate-400">{scheduled} pending</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={openFolder}
                      className="rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      Open Form
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   VIEW 3: YEARLY AUDIT PLAN FORM VIEW (MAIN AUDITOR PLAN FORM)
───────────────────────────────────────────────────────────────*/
function YearlyPlanView({ unit, documents = [], onOpenDoc, onCreateDoc }) {
  const years = useMemo(() => {
    const list = [2024, 2025, 2026, 2027];
    documents.forEach((d) => {
      if (d.year && !list.includes(Number(d.year))) list.push(Number(d.year));
    });
    return list.sort((a, b) => b - a);
  }, [documents]);

  const planDocs = useMemo(() => {
    return documents.filter((d) => d.formKey === 'Auditer Plan');
  }, [documents]);

  return (
    <div className="w-full space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            <span>Yearly Process Audit Plans</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Annual Process Audit Plan Matrix forms (Jan - Dec) with Plan vs Actual tracking
          </p>
        </div>
        {onCreateDoc && (
          <button
            type="button"
            onClick={onCreateDoc}
            className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Annual Plan</span>
          </button>
        )}
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-[#ECEFF3] bg-white shadow-xs">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead className="bg-[#FAFAFC] border-b border-[#F1F3F5] text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="py-3.5 px-4 text-left">Document / Plan Form</th>
              <th className="py-3.5 px-4 text-left">Reference</th>
              <th className="py-3.5 px-4 text-left">Period</th>
              <th className="py-3.5 px-4 text-left">Plant Unit</th>
              <th className="py-3.5 px-4 text-center">Type</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {years.map((year) => {
              const matchingDoc =
                planDocs.find((d) => Number(d.year) === year && (!unit || d.unit === 'All Units' || d.unit === unit)) ||
                planDocs.find((d) => Number(d.year) === year) || {
                  id: `doc_auditer_plan_${year}`,
                  title: `PROCESS AUDIT PLAN - ${year}`,
                  code: `PLAN-${year}`,
                  year,
                  unit: unit || 'All Units',
                  isDefault: year === 2026,
                  formKey: 'Auditer Plan',
                  folderId: 'auditer-plan',
                };

              return (
                <tr
                  key={year}
                  onClick={() => onOpenDoc(matchingDoc)}
                  className="group cursor-pointer hover:bg-blue-50/50 transition"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <FileSpreadsheet className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <span className="font-bold text-slate-800 group-hover:text-blue-700 transition block">
                          {matchingDoc.title || `PROCESS AUDIT PLAN - ${year}`}
                        </span>
                        <span className="text-[11px] text-slate-400">Annual Process Audit Matrix Form</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-slate-600">
                    {matchingDoc.code || `PLAN-${year}`}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">Jan – Dec ({year})</td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                      {matchingDoc.unit || unit || 'All Units'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        matchingDoc.isDefault
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {matchingDoc.isDefault ? 'Standard' : 'Annual Form'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onOpenDoc(matchingDoc)}
                      className="rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      Open Form
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   VIEW 4: TODAY AUDIT PLAN VIEW (CLEAN - NO BANNERS, NO KPI CARDS)
───────────────────────────────────────────────────────────────*/
function TodayPlanView({ unit, onOpenDoc, documents = [] }) {
  const todayStr = getTodayDateStr();
  const todayHuman = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  const [monthRows, setMonthRows] = useState(() => {
    return loadPlanMonthRows(unit, currentYear, currentMonthIdx) || [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState(null);

  const todayAudits = useMemo(() => {
    return monthRows.filter((r) => r.date === todayStr);
  }, [monthRows, todayStr]);

  const saveMonthData = (newRows) => {
    setMonthRows(newRows);
    savePlanMonthRows(unit, currentYear, currentMonthIdx, newRows);
  };

  const handleSaveAudit = (audit) => {
    let updated;
    if (editingAudit) {
      updated = monthRows.map((r) => (r.id === audit.id ? audit : r));
    } else {
      updated = [...monthRows, { ...audit, date: todayStr }];
    }
    saveMonthData(updated);
    setEditingAudit(null);
  };

  const handleDelete = (id) => {
    saveMonthData(monthRows.filter((r) => r.id !== id));
  };

  const handleToggleStatus = (id) => {
    saveMonthData(
      monthRows.map((r) => {
        if (r.id === id) {
          const next = r.status === 'Scheduled' ? 'In Progress' : r.status === 'In Progress' ? 'Conducted' : 'Scheduled';
          return { ...r, status: next };
        }
        return r;
      })
    );
  };

  const defaultPlanDoc = documents.find((d) => d.formKey === 'Auditer Plan');

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Clean Header Row: NO big banners, NO KPI cards */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>Today's Audit Plan</span>
            <span className="text-xs font-normal text-slate-500">({todayHuman})</span>
          </h2>

        </div>
        <div className="flex items-center gap-2">
          {defaultPlanDoc && onOpenDoc && (
            <button
              type="button"
              onClick={() => onOpenDoc(defaultPlanDoc)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              <span>Open Auditor Plan Matrix</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingAudit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-blue-500/25 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Audit for Today</span>
          </button>
        </div>
      </div>

      {/* Today's Audit Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-[#ECEFF3] bg-white shadow-xs">
        <table className="min-w-[940px] w-full border-collapse text-left text-xs">
          <thead className="bg-[#FAFAFC] border-b border-[#F1F3F5] text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="py-3 px-4 text-center w-12">S.No</th>
              <th className="py-3 px-4">Shift & Time</th>
              <th className="py-3 px-4">Line / Area</th>
              <th className="py-3 px-4">Manufacturing Process</th>
              <th className="py-3 px-4">Control Plan / PFMEA</th>
              <th className="py-3 px-4">Assigned Auditor</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Audit Notes</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {todayAudits.map((row, idx) => (
              <tr key={row.id} className="hover:bg-blue-50/40 transition">
                <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-800 block">{row.shift}</span>
                  <span className="text-[10px] text-slate-400">{row.duration || '1 Person / 1 hr'}</span>
                </td>
                <td className="py-3 px-4 font-semibold text-slate-700">
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                    {row.area}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-bold text-blue-700 text-sm block">{row.processName}</span>
                </td>
                <td className="py-3 px-4 text-[11px] text-slate-600">
                  <div>{row.controlPlan}</div>
                  <div className="text-[10px] text-slate-400">{row.pfmea}</div>
                </td>
                <td className="py-3 px-4 font-semibold text-slate-800">{row.auditor}</td>
                <td className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(row.id)}
                    className="cursor-pointer hover:opacity-80 transition"
                    title="Click to change status"
                  >
                    <AuditStatusBadge status={row.status} />
                  </button>
                </td>
                <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs truncate" title={row.notes}>
                  {row.notes || '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAudit(row);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                      title="Edit audit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                      title="Delete audit"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {todayAudits.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                  No process audits scheduled for today yet. Click "Schedule Audit for Today" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AuditModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAudit(null);
        }}
        onSave={handleSaveAudit}
        initialData={editingAudit}
        defaultDate={todayStr}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN AUDITOR PLAN COMPONENT (3 Linked Pages: Monthly, Yearly, Today)
───────────────────────────────────────────────────────────────*/
export default function AuditorPlan({
  unit,
  documents = [],
  onOpenDoc,
  onCreateDoc,
  initialSubView = 'monthly',
  onSubViewChange,
  onFormOpenChange,
}) {
  const [index, setIndex] = useState(() => {
    const saved = loadPlanIndex(unit);
    if (saved && saved.length > 0) return saved;
    return buildInitialPlanIndex(unit);
  });

  const [subView, setSubView] = useState(initialSubView || 'monthly');
  const [activeMonthEntry, setActiveMonthEntry] = useState(null);
  const [isCreateMonthModalOpen, setIsCreateMonthModalOpen] = useState(false);

  useEffect(() => {
    if (unit) {
      const saved = loadPlanIndex(unit);
      if (saved && saved.length > 0) {
        setIndex(saved);
      } else {
        setIndex(buildInitialPlanIndex(unit));
      }
    }
  }, [unit]);

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  useEffect(() => {
    // Notify parent if month detail view is open
    onFormOpenChange?.(Boolean(activeMonthEntry));
  }, [activeMonthEntry, onFormOpenChange]);

  const handleSubViewSwitch = (newView) => {
    setSubView(newView);
    setActiveMonthEntry(null);
    onSubViewChange?.(newView);
  };

  const handleOpenMonth = (year, monthIdx) => {
    setActiveMonthEntry({ year, monthIdx });
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
      savePlanIndex(unit, newIndex);
      if (!loadPlanMonthRows(unit, year, monthIdx)) {
        savePlanMonthRows(unit, year, monthIdx, []);
      }
    }
    setIsCreateMonthModalOpen(false);
    handleOpenMonth(year, monthIdx);
  };

  const defaultPlanDoc = documents.find((d) => d.formKey === 'Auditer Plan');

  // Month Detail View (whole screen form with only Back button)
  if (subView === 'monthly' && activeMonthEntry) {
    return (
      <MonthPlanDetailView
        unit={unit}
        year={activeMonthEntry.year}
        monthIdx={activeMonthEntry.monthIdx}
        onBack={() => setActiveMonthEntry(null)}
        onOpenMainForm={() => defaultPlanDoc && onOpenDoc(defaultPlanDoc)}
      />
    );
  }

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Linked sub-navigation tabs (Monthly | Yearly | Today ONLY) */}
      <SubNavTabs
        currentView={subView}
        onViewChange={handleSubViewSwitch}
      />

      {/* Sub-page View Rendering */}
      {subView === 'monthly' && (
        <>
          <MonthlyFoldersView
            unit={unit}
            index={index}
            documents={documents}
            onOpenDoc={onOpenDoc}
            onOpenMonth={handleOpenMonth}
            onCreateMonth={() => setIsCreateMonthModalOpen(true)}
          />
          <CreateMonthPlanModal
            isOpen={isCreateMonthModalOpen}
            existingEntries={index}
            onClose={() => setIsCreateMonthModalOpen(false)}
            onConfirm={handleCreateMonth}
          />
        </>
      )}

      {subView === 'yearly' && (
        <YearlyPlanView
          unit={unit}
          documents={documents}
          onOpenDoc={onOpenDoc}
          onCreateDoc={onCreateDoc}
        />
      )}

      {subView === 'today' && (
        <TodayPlanView
          unit={unit}
          onOpenDoc={onOpenDoc}
          documents={documents}
        />
      )}
    </div>
  );
}
