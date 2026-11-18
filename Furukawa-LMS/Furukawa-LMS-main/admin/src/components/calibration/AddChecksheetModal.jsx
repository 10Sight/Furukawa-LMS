import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/common/ui/dialog.jsx';
import { Button } from '@/components/common/ui/button.jsx';
import { PDCA_DEPARTMENTS, DEFAULT_LINE_AREAS } from '../../pages/pdca/data/pdcaConstants.js';
import { CALIBRATION_TABS } from './CalibrationTabBar.jsx';
import { X, Plus, FileText } from 'lucide-react';

export const TAB_DYNAMIC_FIELDS = {
  procedure: {
    label: 'SOP / Procedure Number',
    placeholder: 'e.g. SOP-QA-CAL-002',
    defaultValue: 'SOP-QA-CAL-002',
  },
  'addition-deletion': {
    label: 'Instrument / Gauge Name',
    placeholder: 'e.g. Digital Vernier Caliper (0-150mm)',
    defaultValue: 'Digital Vernier Caliper (0-150mm)',
  },
  'half-yearly-plan': {
    label: 'Plan Schedule Cycle / Period',
    placeholder: 'e.g. Jul 2026 - Dec 2026',
    defaultValue: 'Jul 2026 - Dec 2026',
  },
  'monthly-plan': {
    label: 'Target Execution Month',
    placeholder: 'e.g. November 2026',
    defaultValue: 'November 2026',
  },
  'report-format': {
    label: 'Certificate / Report Serial No.',
    placeholder: 'e.g. CAL-REP-2026-002',
    defaultValue: 'CAL-REP-2026-002',
  },
  'history-card': {
    label: 'Equipment Tag / Serial No.',
    placeholder: 'e.g. EQ-CAL-042',
    defaultValue: 'EQ-CAL-042',
  },
  decommissioning: {
    label: 'Reason for Decommissioning',
    placeholder: 'e.g. Beyond acceptable accuracy tolerance',
    defaultValue: 'Sensor drift beyond allowable tolerance',
  },
  'scrap-note': {
    label: 'Asset Scrap Reference No.',
    placeholder: 'e.g. SCRAP-REC-2026-08',
    defaultValue: 'SCRAP-REC-2026-08',
  },
  'usability-declaration': {
    label: 'Usability Condition / Declaration Note',
    placeholder: 'e.g. Acceptable for Production Use',
    defaultValue: 'Acceptable for Production Use',
  },
};

export default function AddChecksheetModal({
  open = false,
  onOpenChange = () => { },
  activeTabId = 'procedure',
  selectedUnit = null,
  subFilter = 'format-checksheet',
  onAdd = () => { }
}) {
  const tabMeta = CALIBRATION_TABS.find((t) => t.id === activeTabId) || CALIBRATION_TABS[0];
  const dynamicFieldMeta = TAB_DYNAMIC_FIELDS[activeTabId] || {
    label: 'Checksheet Reference / Note',
    placeholder: 'Enter reference details...',
    defaultValue: ''
  };

  const [department, setDepartment] = useState('Quality');
  const [section, setSection] = useState('Quality Lab');
  const [dynamicValue, setDynamicValue] = useState(dynamicFieldMeta.defaultValue);
  const [documentName, setDocumentName] = useState('');

  // Synchronize defaults whenever the modal opens or active tab changes
  useEffect(() => {
    if (open) {
      setDepartment('Quality');
      setSection('Quality Lab');
      setDynamicValue(dynamicFieldMeta.defaultValue);
      setDocumentName(tabMeta.fullTitle || tabMeta.shortLabel);
    }
  }, [open, activeTabId]);

  const handleSubmit = (e) => {
    e.preventDefault();

    let code = 'F-CAL-01';
    let docTitle = documentName.trim() || tabMeta.fullTitle || tabMeta.shortLabel;

    switch (activeTabId) {
      case 'procedure':
        code = 'SOP-QA-CAL-001';
        break;
      case 'addition-deletion':
        code = 'F-CAL-02';
        break;
      case 'half-yearly-plan':
        code = 'F-CAL-03';
        break;
      case 'monthly-plan':
        code = 'F-CAL-04';
        break;
      case 'report-format':
        code = subFilter === 'mating-gauge' ? 'F-CAL-05-MG' : 'F-CAL-05';
        break;
      case 'history-card':
        code = 'F-CAL-06';
        break;
      case 'decommissioning':
        code = 'F-CAL-07';
        break;
      case 'scrap-note':
        code = 'F-CAL-08';
        break;
      case 'usability-declaration':
        code = 'F-CAL-09';
        break;
      default:
        code = 'F-CAL-01';
    }

    const newDoc = {
      id: `DOC-CAL-${activeTabId.toUpperCase()}-${Date.now()}`,
      documentName: docTitle,
      code,
      subType: activeTabId === 'report-format' ? subFilter : undefined,
      unit: selectedUnit || 'Bawal',
      department: department || 'Quality',
      section: section || 'Quality Lab',
      extraField: dynamicValue,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Active'
    };

    onAdd(newDoc);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card text-card-foreground">
        {/* Header */}
        <div className="bg-muted/40 border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Add New Checksheet
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span>Add a new checksheet entry for <span className="font-semibold text-foreground">{tabMeta.shortLabel}</span></span>
                {selectedUnit && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Plant: {selectedUnit}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Department <span className="text-destructive">*</span>
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full h-9 bg-background border border-input text-foreground text-xs font-semibold rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-ring shadow-xs cursor-pointer"
            >
              {PDCA_DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Section <span className="text-destructive">*</span>
            </label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              required
              className="w-full h-9 bg-background border border-input text-foreground text-xs font-semibold rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-ring shadow-xs cursor-pointer"
            >
              {DEFAULT_LINE_AREAS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Field per Tab */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              {dynamicFieldMeta.label} <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={dynamicValue}
              onChange={(e) => setDynamicValue(e.target.value)}
              placeholder={dynamicFieldMeta.placeholder}
              required
              className="w-full h-9 bg-background border border-input rounded-lg px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-xs"
            />
          </div>

          {/* Document / Checksheet Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Document Title
            </label>
            <input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g. Standard Calibration Checksheet"
              className="w-full h-9 bg-background border border-input rounded-lg px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Checksheet</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
