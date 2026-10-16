import { usePDCA } from '@hooks/pdca/usePDCA.js';
import { readSaved } from '@components/shared/formPersistence';
import { usePDCAAutosave as useFormAutosave } from '@hooks/pdca/usePDCAAutosave.js';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, Check, ChevronDown, AlignLeft, Calendar } from 'lucide-react';

import { PDCA_DEPARTMENTS } from '../../pages/pdca/data/pdcaConstants.js';
import { createDefaultRows } from '../../pages/pdca/data/pdcaStore.js';
import CascadingLineAreaSelect from './CascadingLineAreaSelect';
import { safeRandomUUID } from '../../utils/uuid.js';

const getTodayInputDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toInputDateValue = (val) => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForPDCA = (val) => {
  if (!val) {
    return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const dateObj = new Date(val);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return val;
};

export default function AddPDCAModal({ isOpen, onClose, onAdd, editData, onUpdate, defaultPlant, defaultScope = 'Company' }) {
  const { userContext } = usePDCA();
  const isEditMode = Boolean(editData);
  const departmentOptions = [
    ...PDCA_DEPARTMENTS,
    ...(editData?.department && !PDCA_DEPARTMENTS.includes(editData.department) ? [editData.department] : [])
  ];
  const draftKey = `pdca_draft_${editData?.id || `${defaultPlant}_${defaultScope}_${userContext.lpaSource?.category || 'general'}_${userContext.lpaSource?.workbookId || 'all'}_${userContext.lpaSource?.worksheet || ''}`}`;

  const defaultDate = toInputDateValue(userContext.lpaSource?.date) || getTodayInputDate();

  const defaultForm = {
    topic: '',
    description: userContext.lpaSource?.observations?.join('\n') || '',
    scope: defaultScope,
    department: '',
    date: defaultDate,
    section: userContext.section?.name || '',
    sectionId: userContext.section?.id || '',
    createdBy: '',
    employeeId: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (!isOpen) return;
    if (editData) {
      setFormData(readSaved(draftKey, {
        topic: editData.topic || '',
        description: editData.description || '',
        scope: editData.scope || 'Company',
        department: editData.department || '',
        date: toInputDateValue(editData.date) || getTodayInputDate(),
        section: editData.section || userContext.section?.name || '',
        sectionId: editData.sectionId || userContext.section?.id || '',
        createdBy: editData.createdBy?.name || '',
        employeeId: editData.createdBy?.code || '',
      }));
    } else {
      setFormData(readSaved(draftKey, {
        ...defaultForm,
        date: toInputDateValue(userContext.lpaSource?.date) || getTodayInputDate(),
        section: userContext.section?.name || '',
        sectionId: userContext.section?.id || '',
      }));
    }
  }, [editData, isOpen, defaultScope, draftKey, userContext.section?.name, userContext.section?.id, userContext.lpaSource?.date]);

  useFormAutosave(formData, value => localStorage.setItem(draftKey, JSON.stringify(value)), isOpen, message => window.alert(message));

  if (!isOpen) return null;

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-purple-100 text-purple-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700',
    'bg-cyan-100 text-cyan-700',
    'bg-teal-100 text-teal-700',
  ];
  const randomAvatarBg = avatarColors[Math.floor(Math.random() * avatarColors.length)];

  const getInitials = (name) => {
    return (name || '')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.topic.trim()) {
      window.alert('Please enter a topic.');
      return;
    }
    if (!formData.section || !formData.section.trim()) {
      window.alert('Please enter a Section. Section is mandatory.');
      return;
    }
    try {
      let activeUser = userContext.user;
      if (!activeUser?.name) {
        try {
          const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
                      (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.fullName || parsed.name || parsed.userName)) {
              activeUser = {
                name: parsed.fullName || parsed.name || parsed.userName,
                code: parsed.employeeId || parsed.empId || parsed.empCode || parsed.userName || '',
                email: parsed.email || ''
              };
            }
          }
        } catch {}
      }

      const creatorName = (isEditMode ? formData.createdBy : activeUser?.name) || 'USER';
      const creatorCode = (isEditMode ? formData.employeeId : activeUser?.code) || '';
      const creatorEmail = activeUser?.email || editData?.createdBy?.email || (creatorCode ? `${creatorCode.toLowerCase()}@fme-minda.co.in` : '');

      if (formData.department && !departmentOptions.includes(formData.department)) {
        throw new Error('Please select a Department from the available options.');
      }
      const scope = editData?.scope || defaultScope;
      const targetPlant = (!isEditMode && !['Bawal', 'Gujrat'].includes(defaultPlant)) ? 'Bawal' : defaultPlant;

      const now = new Date();
      const dateStr = formData.date ? formatDateForPDCA(formData.date) : (userContext.lpaSource?.date
        ? new Date(`${userContext.lpaSource.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
      const timeStr = editData?.time || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const sectionVal = formData.section.trim();

      if (isEditMode) {
        onUpdate({
          ...editData,
          topic: formData.topic.trim(),
          description: formData.description,
          scope,
          department: formData.department,
          date: dateStr,
          section: sectionVal,
          sectionId: formData.sectionId || editData?.sectionId || userContext.section?.id || '',
          createdBy: {
            name: creatorName.toUpperCase(),
            code: creatorCode,
            email: creatorEmail,
            avatarBg: editData.createdBy?.avatarBg || randomAvatarBg,
            initials: getInitials(creatorName || 'NA'),
          },
          isSelf: scope === 'Self PDCA',
        });
      } else {
        onAdd({
          id: `PDCA-${safeRandomUUID()}`,
          topic: formData.topic.trim(),
          description: formData.description,
          plant: targetPlant,
          scope,
          department: formData.department,
          section: sectionVal,
          sectionId: formData.sectionId || userContext.section?.id || '',
          lpaSource: userContext.lpaSource ? { ...userContext.lpaSource } : undefined,
          date: dateStr,
          time: timeStr,
          createdBy: {
            name: creatorName.toUpperCase(),
            code: creatorCode,
            email: creatorEmail,
            avatarBg: randomAvatarBg,
            initials: getInitials(creatorName || 'NA'),
          },
          isSelf: scope === 'Self PDCA',
          sheet: {
            headerInfo: {
              topicName: formData.topic.trim(),
              preparedBy: creatorName.toUpperCase(),
              auditNo: '',
              attendees: ''
            },
            rows: createDefaultRows(10)
          }
        });
      }

      try { localStorage.removeItem(draftKey); } catch {}
      onClose();
    } catch (error) {
      window.alert(error.message || 'Could not save the form. Please try again.');
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isEditMode ? 'Edit PDCA' : 'Add New PDCA'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditMode ? `Editing: ${editData.id}` : 'Create a new Plan-Do-Check-Act improvement item'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pb-24 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Topic */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Topic *</span>
            </label>
            <input
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g. Reduction of Surface Scratch Defect"
              className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 shadow-2xs transition-all"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>Description</span>
              <span className="text-[11px] font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the problem, root cause, or corrective action..."
              className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 resize-none shadow-2xs transition-all"
            />
          </div>

          {/* Department & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pdca-department" className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
              <div className="relative">
                <select id="pdca-department" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full appearance-none text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none pr-10 shadow-2xs">
                  <option value="">{userContext.loading ? 'Select Department' : 'Select Department'}</option>
                  {departmentOptions.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="pdca-date" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Date *</span>
                </span>
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Required</span>
              </label>
              <input
                type="date"
                id="pdca-date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none shadow-2xs transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Line / Area / Section */}
          <div>
            <label htmlFor="pdca-section" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Line / Area / Section *</span>
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Required</span>
            </label>
            <CascadingLineAreaSelect
              id="pdca-section"
              value={formData.section}
              onChange={(val, meta) => {
                setFormData((prev) => ({
                  ...prev,
                  section: val,
                  sectionId: meta?.sectionId ? String(meta.sectionId) : prev.sectionId
                }));
              }}
              placeholder="Search or select Line / Area / Section..."
              compact={false}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditMode ? 'Save Changes' : 'Create PDCA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
