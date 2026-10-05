import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, Check, ChevronDown, User, IdCard, Building, Building2, AlignLeft } from 'lucide-react';

export default function AddPDCAModal({ isOpen, onClose, onAdd, editData, onUpdate }) {
  const isEditMode = Boolean(editData);

  const defaultForm = {
    topic: '',
    description: '',
    scope: 'Company',
    department: '',
    createdBy: '',
    employeeId: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (editData) {
      setFormData({
        topic: editData.topic || '',
        description: editData.description || '',
        scope: editData.scope || 'Company',
        department: editData.department || '',
        createdBy: editData.createdBy?.name || '',
        employeeId: editData.createdBy?.code || '',
      });
    } else {
      setFormData(defaultForm);
    }
  }, [editData, isOpen]);

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
    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.topic.trim()) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (isEditMode) {
      onUpdate({
        ...editData,
        topic: formData.topic,
        description: formData.description,
        scope: formData.scope,
        department: formData.department,
        createdBy: {
          name: formData.createdBy.toUpperCase(),
          code: formData.employeeId,
          email: editData.createdBy?.email || `${formData.employeeId.toLowerCase()}@fme-minda.co.in`,
          avatarBg: editData.createdBy?.avatarBg || randomAvatarBg,
          initials: getInitials(formData.createdBy || 'NA'),
        },
        isSelf: formData.scope === 'Self PDCA',
      });
    } else {
      onAdd({
        id: `PDCA-${Math.floor(100 + Math.random() * 900)}`,
        topic: formData.topic,
        description: formData.description,
        plant: 'All Plants',
        scope: formData.scope,
        department: formData.department,
        date: dateStr,
        time: timeStr,
        createdBy: {
          name: formData.createdBy.toUpperCase(),
          code: formData.employeeId,
          email: `${formData.employeeId.toLowerCase()}@fme-minda.co.in`,
          avatarBg: randomAvatarBg,
          initials: getInitials(formData.createdBy || 'NA'),
        },
        isSelf: formData.scope === 'Self PDCA',
      });
    }

    onClose();
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

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-blue-600" />
              <span>Description</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the problem, root cause, or corrective action..."
              className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 resize-none shadow-2xs transition-all"
            />
          </div>

          {/* Scope and Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>PDCA Scope *</span>
              </label>
              <div className="relative">
                <select
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  className="w-full appearance-none text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none pr-10 shadow-2xs"
                >
                  {['Company', 'Department', 'Self PDCA'].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>Department</span>
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="e.g. SRC Quality"
                className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Created By & Employee ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Created By *</span>
              </label>
              <input
                type="text"
                required
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                placeholder="Full Name (e.g. Yogesh Kumar)"
                className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 shadow-2xs transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <IdCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Employee ID *</span>
              </label>
              <input
                type="text"
                required
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="e.g. AS081213"
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
