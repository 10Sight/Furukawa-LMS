import React, { useState } from 'react';
import { X, Plus, FileSpreadsheet } from 'lucide-react';
import {
  INITIAL_CONTROL_PLAN_METADATA,
  INITIAL_CONTROL_PLAN_ROWS,
  INITIAL_CP_REVISION_HISTORY,
  INITIAL_CP_SIGN_OFF,
} from './controlPlanInitialData';
import { saveControlPlanSheet } from './controlPlanStorage';

export default function CreateControlPlanModal({ isOpen, onClose, onCreate, currentUnit }) {
  const [formData, setFormData] = useState({
    title: 'Control Plan YHB Floor - HARNESS ASSY FLOOR',
    unit: currentUnit || 'Bawal',
    controlPlanNo: `CP-WH-PE-MSIL-YHB_${Date.now().toString().slice(-3)}`,
    companyName: 'FURUKAWA MINDA ELECTRIC PVT.LTD.',
    docType: 'Production', // Prototype | Prelaunch | Production
    customerName: 'Maruti Suzuki India Limited',
    partNumber: '36603-75U**/36630-75U**',
    partName: 'HARNESS ASSY FLOOR',
    project: 'YHB/YHC_RC25',
    issueLevel: '05',
    supplierPlant: 'Plot 325, 326, Sector 3, GC Bawal, Ph.-2, Dist: Rewari, Haryana',
    supplierCode: 'F241',
    cpDateOriginal: '02.07.2024',
    revDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.'),
    cpKeyDate: '15-09-2026',
    reasonForReissue: 'New creation / revision for production',
    designNoteNo: 'As per Design Change Table',
    drawingLevel: 'As per Design Change Table',
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const newDocId = `cp_sheet_${Date.now()}`;
    const newDoc = {
      id: newDocId,
      title: formData.title,
      description: `Control Plan Floor for ${formData.partName} (${formData.partNumber})`,
      code: formData.controlPlanNo,
      controlPlanNo: formData.controlPlanNo,
      customer: formData.customerName,
      partNumber: formData.partNumber,
      partName: formData.partName,
      project: formData.project,
      unit: formData.unit,
      isDefault: false,
      folderId: 'control-plan',
      formKey: 'Control Plan YHB Floor',
      status: 'In Progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        companyName: formData.companyName,
        docType: formData.docType,
        customerName: formData.customerName,
        partNumber: formData.partNumber,
        issueLevel: formData.issueLevel,
        designNoteNo: formData.designNoteNo,
        supplierPlant: formData.supplierPlant,
        partName: formData.partName,
        cpDateOriginal: formData.cpDateOriginal,
        revDate: formData.revDate,
        drawingLevel: formData.drawingLevel,
        supplierCode: formData.supplierCode,
        project: formData.project,
        cpKeyDate: formData.cpKeyDate,
        reasonForReissue: formData.reasonForReissue,
        controlPlanNo: formData.controlPlanNo,
      },
      revisionHistory: JSON.parse(JSON.stringify(INITIAL_CP_REVISION_HISTORY)),
      signOff: JSON.parse(JSON.stringify(INITIAL_CP_SIGN_OFF)),
    };

    // Save initial rows in IndexedDB for this sheet id
    saveControlPlanSheet(newDocId, {
      metadata: newDoc.metadata,
      rows: INITIAL_CONTROL_PLAN_ROWS,
      revisionHistory: newDoc.revisionHistory,
      signOff: newDoc.signOff,
    }).catch(console.warn);

    onCreate(newDoc);
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h3 className="text-base font-bold text-slate-800">Create Control Plan YHB Floor Sheet</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sheet Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g. Control Plan YHB Floor - HARNESS ASSY FLOOR"
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
                    supplierPlant:
                      e.target.value === 'Gujrat'
                        ? 'Mandal, Dist: Ahmedabad, Gujrat'
                        : 'Plot 325, 326, Sector 3, GC Bawal, Ph.-2, Dist: Rewari, Haryana',
                  })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Bawal">Bawal</option>
                <option value="Gujrat">Gujrat</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Control Plan No.</label>
              <input
                type="text"
                value={formData.controlPlanNo}
                onChange={(e) => setFormData({ ...formData, controlPlanNo: e.target.value })}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Project</label>
              <input
                type="text"
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Part Number</label>
              <input
                type="text"
                value={formData.partNumber}
                onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Part Name</label>
              <input
                type="text"
                value={formData.partName}
                onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phase Type</label>
              <select
                value={formData.docType}
                onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Production">Production</option>
                <option value="Prelaunch">Prelaunch</option>
                <option value="Prototype">Prototype</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Issue Level</label>
              <input
                type="text"
                value={formData.issueLevel}
                onChange={(e) => setFormData({ ...formData, issueLevel: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Code</label>
              <input
                type="text"
                value={formData.supplierCode}
                onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Re-issue</label>
            <input
              type="text"
              value={formData.reasonForReissue}
              onChange={(e) => setFormData({ ...formData, reasonForReissue: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create Sheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

