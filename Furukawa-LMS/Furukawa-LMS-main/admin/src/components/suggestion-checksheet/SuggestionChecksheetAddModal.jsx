import React, { useState } from 'react';
import { X, FilePlus } from 'lucide-react';

export default function SuggestionChecksheetAddModal({ isOpen, onClose, onAdd, defaultUnit = 'Bawal' }) {
  const [formData, setFormData] = useState({
    unit: defaultUnit || 'Bawal',
    department: 'Production',
    section: 'Main Assembly',
    lineArea: 'Assembly Line 1',
    title: '',
    description: '',
    category: 'Safety',
    submittedBy: '',
    priority: 'Medium',
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Please enter a suggestion title');
      return;
    }
    if (!formData.submittedBy.trim()) {
      alert('Please enter employee name / ID');
      return;
    }
    if (!formData.department.trim()) {
      alert('Please enter or select a department');
      return;
    }
    if (!formData.section.trim()) {
      alert('Please enter a section');
      return;
    }
    if (!formData.lineArea.trim()) {
      alert('Please enter line / area');
      return;
    }

    const newRecord = {
      id: `SC-${formData.unit.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      unit: formData.unit,
      department: formData.department,
      section: formData.section,
      lineArea: formData.lineArea,
      title: formData.title,
      description: formData.description || 'No additional details provided.',
      problemText: formData.description || '',
      suggestionText: '',
      category: formData.category,
      submittedBy: formData.submittedBy,
      employeeCode: formData.lineArea,
      status: 'Under Review',
      priority: formData.priority,
    };

    onAdd(newRecord);
    onClose();
    // Reset form
    setFormData({
      unit: defaultUnit || 'Bawal',
      department: 'Production',
      section: 'Main Assembly',
      lineArea: 'Assembly Line 1',
      title: '',
      description: '',
      category: 'Safety',
      submittedBy: '',
      priority: 'Medium',
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1060] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Add New Suggestion Checksheet</h3>
              <p className="text-xs text-slate-500">Submit an operational improvement, safety, or quality idea</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Plant Unit *</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              >
                <option value="Bawal">Bawal</option>
                <option value="Gujrat">Gujrat</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Category *</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Safety">Safety (S)</option>
                <option value="Quality">Quality (Q)</option>
                <option value="Productivity">Productivity (P)</option>
                <option value="Cost Reduction">Cost Reduction (C)</option>
                <option value="Delivery">Delivery (D)</option>
                <option value="Maintenance">Maintenance / Morale (M)</option>
                <option value="5S">5S</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Department *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Production"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Section *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Main Assembly"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Line / Area *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Assembly Line 1"
                value={formData.lineArea}
                onChange={(e) => setFormData({ ...formData, lineArea: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Employee Name / ID *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Vikas Sharma (BWL-4821)"
                value={formData.submittedBy}
                onChange={(e) => setFormData({ ...formData, submittedBy: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Priority</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Suggestion Title *</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Brief summary of the suggestion"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Problem Description / Details</label>
            <textarea
              rows="3"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Describe the current issue or problem observed in the process"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              Create Checksheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
