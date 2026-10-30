import React, { useState } from 'react';
import { X, Plus, FileSpreadsheet } from 'lucide-react';
import {
  INITIAL_PFMEA_METADATA,
  INITIAL_PFMEA_ROWS,
  INITIAL_REVISION_HISTORY,
  INITIAL_SIGN_OFF,
} from './pfmeaInitialData';

export default function CreatePfmeaModal({ isOpen, onClose, onCreate, currentUnit }) {
  const [formData, setFormData] = useState({
    title: 'PFMEA - Wiring Harness',
    unit: currentUnit || 'Bawal',
    code: `PFMEA-WH-${Date.now().toString().slice(-4)}`,
    companyName: 'Furukawa Minda Electric Pvt. Ltd.',
    engineeringLocation: currentUnit === 'Gujrat' ? 'Mandal, Gujrat' : 'Bawal, Haryana',
    customerName: 'Maruti Suzuki India Limited',
    modelYearPlatform: 'YH8/YHC - Floor RC25',
    subject: 'Wiring Harness',
    pfmeaStartDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
    pfmeaRevisionDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
    crossFunctionalTeam: 'Yadvender Yadav, Arvind, Sunil Kumar, Marut, Jitender, Anuj Yadav, Manoj Kumar',
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const newDocId = `pfmea_${Date.now()}`;
    const newDoc = {
      id: newDocId,
      title: formData.title,
      description: `Process Failure Mode and Effects Analysis for ${formData.subject} (${formData.modelYearPlatform})`,
      code: formData.code,
      revDate: formData.pfmeaRevisionDate,
      year: new Date().getFullYear().toString(),
      unit: formData.unit,
      isDefault: false,
      folderId: 'pfmea',
      formKey: 'PFMEA Sheet',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        companyName: formData.companyName,
        engineeringLocation: formData.engineeringLocation,
        customerName: formData.customerName,
        modelYearPlatform: formData.modelYearPlatform,
        subject: formData.subject,
        pfmeaStartDate: formData.pfmeaStartDate,
        pfmeaRevisionDate: formData.pfmeaRevisionDate,
        crossFunctionalTeam: formData.crossFunctionalTeam,
        pfmeaIdNumber: `PFMEA-WH-PE-MSIL-${formData.modelYearPlatform.split(' ')[0] || 'YHB'}_RC25 -002`,
        processResponsibility: 'Anuj Yadav',
        confidentialLevel: 'Confidential',
      },
      rows: JSON.parse(JSON.stringify(INITIAL_PFMEA_ROWS)),
      revisionHistory: JSON.parse(JSON.stringify(INITIAL_REVISION_HISTORY)),
      signOff: JSON.parse(JSON.stringify(INITIAL_SIGN_OFF)),
    };

    onCreate(newDoc);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-800">Create New PFMEA Sheet</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sheet Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g. PFMEA - Wiring Harness"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit / Plant</label>
              <select
                value={formData.unit}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    unit: e.target.value,
                    engineeringLocation: e.target.value === 'Gujrat' ? 'Mandal, Gujrat' : 'Bawal, Haryana',
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Bawal">Bawal</option>
                <option value="Gujrat">Gujrat</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reference Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Model / Platform</label>
              <input
                type="text"
                value={formData.modelYearPlatform}
                onChange={(e) => setFormData({ ...formData, modelYearPlatform: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Sheet</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

