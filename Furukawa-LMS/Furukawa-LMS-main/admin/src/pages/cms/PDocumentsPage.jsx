import React, { useState } from 'react';
import { FileText, GitBranch, ShieldAlert, ClipboardList, FolderOpen } from 'lucide-react';
import ProcessFlowChartSheet from '../../components/process-audit/process-flow-chart/ProcessFlowChartSheet';
import { DEFAULT_PFC_DOCUMENTS } from '../../components/process-audit/process-flow-chart/processFlowChartInitialData';
import PfmeaSheet from '../../components/process-audit/pfmea/PfmeaSheet';
import { DEFAULT_PFMEA_DOCUMENTS } from '../../components/process-audit/pfmea/pfmeaInitialData';
import ControlPlanSheet from '../../components/process-audit/control-plan/ControlPlanSheet';
import { DEFAULT_CONTROL_PLAN_DOCUMENTS } from '../../components/process-audit/control-plan/controlPlanInitialData';

const CHECK_SHEET_ITEMS = [
  {
    id: 'pfc',
    title: 'Process Flow Chart',
    subtitle: 'Process flow diagram & step sequence',
    icon: GitBranch,
    docs: DEFAULT_PFC_DOCUMENTS,
  },
  {
    id: 'pfmea',
    title: 'PFMEA',
    subtitle: 'Process Failure Mode & Effects Analysis',
    icon: ShieldAlert,
    docs: DEFAULT_PFMEA_DOCUMENTS,
  },
  {
    id: 'control-plan',
    title: 'Control Plan YHB Floor',
    subtitle: 'YHB floor control plan check sheet',
    icon: ClipboardList,
    docs: DEFAULT_CONTROL_PLAN_DOCUMENTS,
  },
];

export default function PDocumentsPage() {
  const [selectedSheetId, setSelectedSheetId] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const selectedCategory = CHECK_SHEET_ITEMS.find((item) => item.id === selectedSheetId) || null;

  // Full-screen sheet view when a document is opened
  if (activeDoc && selectedSheetId === 'pfc') {
    return (
      <ProcessFlowChartSheet
        key={activeDoc.id}
        doc={activeDoc}
        onBack={() => setActiveDoc(null)}
        showToast={showToast}
      />
    );
  }
  if (activeDoc && selectedSheetId === 'pfmea') {
    return (
      <PfmeaSheet
        key={activeDoc.id}
        doc={activeDoc}
        onBack={() => setActiveDoc(null)}
        showToast={showToast}
      />
    );
  }
  if (activeDoc && selectedSheetId === 'control-plan') {
    return (
      <ControlPlanSheet
        key={activeDoc.id}
        doc={activeDoc}
        onBack={() => setActiveDoc(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-[calc(100vh-80px)] bg-[#F4F6F9]">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[95] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold">
          {toastMessage}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 leading-tight">P-Documents</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Process Audit check sheets — Process Flow Chart, PFMEA, and Control Plan YHB Floor
          </p>
        </div>
      </div>

      {/* Two-Section Split Layout matching RBAC Role Manager structure */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[calc(100vh-190px)]">
        {/* Small Left Section */}
        <div className="w-full lg:w-72 shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">
              Check Sheets ({CHECK_SHEET_ITEMS.length})
            </span>
          </div>

          <div className="p-2.5 space-y-1.5 flex-1">
            {CHECK_SHEET_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedSheetId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedSheetId(item.id);
                    setActiveDoc(null);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-2xs'
                      : 'bg-white border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{item.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Right Section */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
          {!selectedCategory ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Select a check sheet to view</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm">
                Choose Process Flow Chart, PFMEA, or Control Plan YHB Floor from the left panel.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    {selectedCategory.title}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">{selectedCategory.subtitle}</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedCategory.docs.length}{' '}
                  {selectedCategory.docs.length === 1 ? 'document' : 'documents'}
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedCategory.docs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex items-center justify-between gap-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {doc.title || doc.partName || doc.model || `${selectedCategory.title} #${idx + 1}`}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {doc.partNo || doc.docNo || doc.line || 'Check Sheet'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDoc(doc)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
