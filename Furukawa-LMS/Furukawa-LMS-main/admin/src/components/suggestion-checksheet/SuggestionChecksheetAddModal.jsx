import React, { useState } from 'react';
import { X, FilePlus } from 'lucide-react';

export default function SuggestionChecksheetAddModal({ isOpen, onClose, onAdd, defaultUnit = 'Bawal' }) {
  const [formData, setFormData] = useState({
    unit: defaultUnit && defaultUnit !== 'All Units' ? defaultUnit : 'Bawal',
    submittedBy: '',
    department: '',
    section: '',
    lineArea: '',
    date: new Date().toISOString().slice(0, 10),
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const generatedId = `SC-${(formData.unit || 'BWL').substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRecord = {
      id: generatedId,
      date: formData.date || new Date().toISOString().split('T')[0],
      unit: formData.unit || 'Bawal',
      department: formData.department.trim(),
      section: formData.section.trim(),
      lineArea: formData.lineArea.trim(),
      title: formData.submittedBy.trim()
        ? `${formData.submittedBy.trim()} - Suggestion`
        : `Suggestion Sheet (${generatedId})`,
      description: '',
      problemText: '',
      suggestionText: '',
      category: '',
      submittedBy: formData.submittedBy.trim(),
      employeeCode: formData.lineArea.trim(),
      status: 'Pending',
      priority: 'Medium',
      isBlank: true,
      rejectedAccepted: '',
      reasonIfRejected: '',
      targetDate: '',
      dateOfImplementation: '',
      lineLeaderSign1: '',
      lineLeaderSign2: '',
      approvalDate: '',
      costSaving: '',
      benefitDetails: '',
      benefitStatusDetails: '',
    };

    onAdd(newRecord);
    onClose();
    // Reset form to blank
    setFormData({
      unit: defaultUnit && defaultUnit !== 'All Units' ? defaultUnit : 'Bawal',
      submittedBy: '',
      department: '',
      section: '',
      lineArea: '',
      date: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1060] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Create Suggestion Checksheet</h3>
              <p className="text-xs text-slate-500">Enter checksheet details to initialize a blank format</p>
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

        {/* Modal Body / Form - Contains only: Plant Unit, Employee Name/ID, Department, Section, Line/Area, Date */}
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
              <label className="block text-slate-700 font-semibold mb-1">Employee Name / ID</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Vikas Sharma / EMP001"
                value={formData.submittedBy}
                onChange={(e) => setFormData({ ...formData, submittedBy: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Department</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Production"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Section</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Main Assembly"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Line / Area</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Assembly Line 1"
                value={formData.lineArea}
                onChange={(e) => setFormData({ ...formData, lineArea: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
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

