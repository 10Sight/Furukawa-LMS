import { usePDCA } from '@pages/pdca/context/PDCAContext';
import { readSaved, useFormAutosave } from '@components/shared/formPersistence';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, Check, ChevronDown, AlignLeft } from 'lucide-react';

const DEFAULT_DEPARTMENTS = [
  'Production', 'SRC Quality', 'IQC Quality', 'Die Casting',
  'Wiring Harness', 'Press & Stamping', 'Robotics', 'Tool Room',
  'Plant Maintenance', 'EHS Safety', 'Logistics',
  'Engineering', 'Human Resources', 'Finance & Accounts', 'Purchase', 'IT',
];

export default function AddPDCAModal({ isOpen, onClose, onAdd, editData, onUpdate, defaultPlant, defaultScope = 'Company' }) {
  const { userContext } = usePDCA();
  const isEditMode = Boolean(editData);
  const departmentOptions = [...new Set([...DEFAULT_DEPARTMENTS, ...(userContext.departments || []).map(item => item.name), editData?.department].filter(Boolean))];
  const draftKey = `pdca_draft_${editData?.id || `${defaultPlant}_${defaultScope}_${userContext.lpaSource?.category || 'general'}_${userContext.lpaSource?.workbookId || 'all'}_${userContext.lpaSource?.worksheet || ''}`}`;

  const defaultForm = {
    topic: '',
    description: userContext.lpaSource?.observations?.join('\n') || '',
    scope: defaultScope,
    department: '',
    section: userContext.section?.name || '',
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
        section: editData.section || userContext.section?.name || '',
        createdBy: editData.createdBy?.name || '',
        employeeId: editData.createdBy?.code || '',
      }));
    } else {
      setFormData(readSaved(draftKey, {
        ...defaultForm,
        section: userContext.section?.name || '',
      }));
    }
  }, [editData, isOpen, defaultScope, draftKey, userContext.section?.name]);

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
      const targetPlant = (!isEditMode && !['Bawal', 'Gujrat'].includes(defaultPlant)) ? 'Gujrat' : defaultPlant;

      const now = new Date();
      const dateStr = userContext.lpaSource?.date
        ? new Date(`${userContext.lpaSource.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      const sectionVal = formData.section.trim();

      if (isEditMode) {
        onUpdate({
          ...editData,
          topic: formData.topic.trim(),
          description: formData.description,
          scope,
          department: formData.department,
          section: sectionVal,
          sectionId: editData?.sectionId || userContext.section?.id || '',
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
          id: `PDCA-${crypto.randomUUID()}`,
          topic: formData.topic.trim(),
          description: formData.description,
          plant: targetPlant,
          scope,
          department: formData.department,
          section: sectionVal,
          sectionId: userContext.section?.id || '',
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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

          <div className="grid grid-cols-1 gap-4">
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
              <label htmlFor="pdca-section" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Section *</span>
                <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Required</span>
              </label>
              <input
                id="pdca-section"
                type="text"
                required
                value={formData.section}
                onChange={e => setFormData({ ...formData, section: e.target.value })}
                placeholder="Enter section name (e.g. Line 1, Press Shop)..."
                className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 shadow-2xs transition-all"
              />
            </div>
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
