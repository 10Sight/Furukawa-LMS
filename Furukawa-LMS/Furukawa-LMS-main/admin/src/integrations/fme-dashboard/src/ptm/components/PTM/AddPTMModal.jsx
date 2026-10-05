import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

export default function AddPTMModal({ isOpen, onClose, onAdd, editData, onUpdate }) {
  const isEditMode = Boolean(editData);

  const defaultForm = {
    topic: '',
    description: '',
    plant: 'Bawal',
    scope: 'Company',
    department: '',
    time: '09:00 AM',
    ownerName: '',
    ownerCode: '',
    ownerEmail: '',
  };

  const [formData, setFormData] = useState(
    editData
      ? {
          topic: editData.topic || '',
          description: editData.description || '',
          plant: editData.plant || 'Bawal',
          scope: editData.scope || 'Company',
          department: editData.department || '',
          time: editData.time || '09:00 AM',
          ownerName: editData.createdBy?.name || '',
          ownerCode: editData.createdBy?.code || '',
          ownerEmail: editData.createdBy?.email || '',
        }
      : defaultForm
  );

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

    if (isEditMode) {
      onUpdate({
        ...editData,
        topic: formData.topic,
        description: formData.description,
        plant: formData.plant,
        scope: formData.scope,
        department: formData.department,
        time: formData.time,
        createdBy: {
          name: formData.ownerName.toUpperCase(),
          code: formData.ownerCode,
          email: formData.ownerEmail,
          avatarBg: editData.createdBy?.avatarBg || randomAvatarBg,
          initials: getInitials(formData.ownerName),
        },
        isSelf: formData.scope === 'Self PTM',
      });
    } else {
      onAdd({
        id: `PTM-${formData.plant === 'Gujrat' ? 'GJ' : 'BW'}-${Math.floor(100 + Math.random() * 900)}`,
        topic: formData.topic,
        description: formData.description,
        plant: formData.plant,
        scope: formData.scope,
        department: formData.department,
        date: dateStr,
        time: formData.time,
        createdBy: {
          name: formData.ownerName.toUpperCase(),
          code: formData.ownerCode,
          email: formData.ownerEmail,
          avatarBg: randomAvatarBg,
          initials: getInitials(formData.ownerName || 'NA'),
        },
        isSelf: formData.scope === 'Self PTM',
      });
    }

    onClose();
  };

  const field = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={formData[key]}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400"
      />
    </div>
  );

  const selectField = (label, key, options) => (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <select
        value={formData[key]}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFC]">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {isEditMode ? 'Edit PTM' : 'Add New PTM'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditMode ? `Editing: ${editData.id}` : 'Create a new Project Tracking Matrix item'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Topic */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Topic *</label>
            <input
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g. Reduction of Solder Bridge Defects in ECU Assembly"
              className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the activity, issue, or scope..."
              className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {selectField('Plant *', 'plant', ['Gujrat', 'Bawal'])}
            {selectField('PTM Scope', 'scope', ['Company', 'Department', 'Self PTM'])}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Department', 'department', 'text', 'e.g. SRC Quality')}
            {field('Time', 'time', 'text', 'e.g. 09:45 AM')}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {field('Owner Name *', 'ownerName', 'text', 'Full Name')}
            {field('Employee Code', 'ownerCode', 'text', 'e.g. AS081215')}
          </div>

          {field('Owner Email', 'ownerEmail', 'email', 'name@fme-minda.co.in')}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isEditMode ? 'Save Changes' : 'Create PTM'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
