import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/common/ui/button.jsx';
import { Card } from '@/components/common/ui/card.jsx';
import { Badge } from '@/components/common/ui/badge.jsx';
import CalibrationTabBar, { CALIBRATION_TABS } from '@/components/calibration/CalibrationTabBar.jsx';
import CalibrationFilterBar from '@/components/calibration/CalibrationFilterBar.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '@/components/calibration/calibrationDocumentsData.js';
import ProcedureTab from '@/components/calibration/tabs/ProcedureTab.jsx';

export const CALIBRATION_STORAGE_KEY = 'furukawa_calibration_documents';
export const CALIBRATION_UNIT_STORAGE_KEY = 'furukawa_calibration_selected_unit';

export const FIXED_PROCEDURE_DOCUMENTS = [
  {
    id: 'DOC-CAL-01-SOP',
    sNo: 1,
    documentName: 'Standard Operating Procedure (PRC-WH-QA-007)',
    code: 'PRC-WH-QA-007',
    department: 'Quality',
    section: 'Quality Lab',
    date: '05 Aug 2024',
    status: 'Active',
    tab: 'procedure'
  },
  {
    id: 'DOC-CAL-01-ANNEX-1',
    sNo: 2,
    documentName: 'Annexure 1',
    code: 'ANNEXURE-01',
    department: 'Quality',
    section: 'Quality Lab',
    date: '18 Nov 2026',
    status: 'Active',
    tab: 'procedure'
  },
  {
    id: 'DOC-CAL-01-ANNEX-2',
    sNo: 3,
    documentName: 'Annexure 2',
    code: 'ANNEXURE-02',
    department: 'Quality',
    section: 'Quality Lab',
    date: '18 Nov 2026',
    status: 'Active',
    tab: 'procedure'
  },
  {
    id: 'DOC-CAL-01-ANNEX-3',
    sNo: 4,
    documentName: 'Annexure 3',
    code: 'ANNEXURE-03',
    department: 'Quality',
    section: 'Quality Lab',
    date: '18 Nov 2026',
    status: 'Active',
    tab: 'procedure'
  },
  {
    id: 'DOC-CAL-01-SCOPE-CAL',
    sNo: 5,
    documentName: 'Scope for Calibration',
    code: 'SCOPE-CAL-01',
    department: 'Quality',
    section: 'Quality Lab',
    date: '18 Nov 2026',
    status: 'Active',
    tab: 'procedure'
  },
  {
    id: 'DOC-CAL-01-SCOPE-INSP',
    sNo: 6,
    documentName: 'Scope for Inspection',
    code: 'SCOPE-INSP-01',
    department: 'Quality',
    section: 'Quality Lab',
    date: '18 Nov 2026',
    status: 'Active',
    tab: 'procedure'
  }
];

export const EMPTY_DOCUMENTS_BY_TAB = {
  procedure: FIXED_PROCEDURE_DOCUMENTS,
  'addition-deletion': [],
  'half-yearly-plan': [],
  'monthly-plan': [],
  'report-format': [],
  'history-card': [],
  decommissioning: [],
  'scrap-note': [],
  'usability-declaration': []
};

const getInitialDocuments = () => {
  try {
    const saved = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return {
          ...EMPTY_DOCUMENTS_BY_TAB,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.error('Failed to load calibration documents from localStorage:', err);
  }
  return EMPTY_DOCUMENTS_BY_TAB;
};
import AdditionDeletionTab from '@/components/calibration/tabs/AdditionDeletionTab.jsx';
import HalfYearlyPlanTab from '@/components/calibration/tabs/HalfYearlyPlanTab.jsx';
import MonthlyPlanTab from '@/components/calibration/tabs/MonthlyPlanTab.jsx';
import ReportFormatTab from '@/components/calibration/tabs/ReportFormatTab.jsx';
import HistoryCardTab from '@/components/calibration/tabs/HistoryCardTab.jsx';
import DecommissioningTab from '@/components/calibration/tabs/DecommissioningTab.jsx';
import ScrapTab from '@/components/calibration/tabs/ScrapTab.jsx';
import UsabilityDeclarationTab from '@/components/calibration/tabs/UsabilityDeclarationTab.jsx';
import CalibrationChecksheetView from '@/components/calibration/CalibrationChecksheetView.jsx';
import AddChecksheetModal from '@/components/calibration/AddChecksheetModal.jsx';
import { toast } from 'sonner';

class CalibrationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Calibration error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full bg-white rounded-2xl border border-red-200 p-8 sm:p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">
            !
          </div>
          <h3 className="text-base font-bold text-slate-800">Something went wrong while loading this calibration view</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (typeof this.props.onReset === 'function') this.props.onReset();
                else window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              Reload View
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/cms/calibration';
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Back to Calibration List
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CalibrationPage() {
  const { tab, checksheetId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const { isFormView, setIsFormView } = outletCtx;

  // Documents state persisted in localStorage (localhost)
  const [documentsByTab, setDocumentsByTab] = useState(getInitialDocuments);

  const saveDocuments = (newDocs) => {
    setDocumentsByTab(newDocs);
    try {
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(newDocs));
    } catch (err) {
      console.error('Failed to save calibration documents to localStorage:', err);
    }
  };

  // 1. Unit dropdown state (default unit must be null)
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef(null);

  const unitOptions = ['Bawal', 'Gujrat'];
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);

  const handleSelectUnit = (unit) => {
    setSelectedUnit(unit);
    setIsUnitDropdownOpen(false);
    try {
      if (unit) {
        localStorage.setItem(CALIBRATION_UNIT_STORAGE_KEY, unit);
      } else {
        localStorage.removeItem(CALIBRATION_UNIT_STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to save selected unit to localStorage:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target)) {
        setIsUnitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExtraFilter, setSelectedExtraFilter] = useState('');

  // 4. Report Format sub-filter: 'format-checksheet' | 'mating-gauge'
  const [reportFormatSubFilter, setReportFormatSubFilter] = useState('format-checksheet');

  // Determine base path depending on /cms/calibration or /portal/calibration
  const basePath = useMemo(() => {
    if (location.pathname.startsWith('/portal')) {
      return '/portal/calibration';
    }
    if (location.pathname.startsWith('/cms')) {
      return '/cms/calibration';
    }
    return '/calibration';
  }, [location.pathname]);

  // Active tab selection
  const activeTabId = useMemo(() => {
    const valid = CALIBRATION_TABS.some((t) => t.id === tab);
    return valid ? tab : 'procedure';
  }, [tab]);

  // Find active checksheet from URL parameter by unique ID
  const activeDocument = useMemo(() => {
    if (!checksheetId) return null;
    const inFixedProcedure = FIXED_PROCEDURE_DOCUMENTS.find(
      (d) => String(d.id) === String(checksheetId) || String(d.code) === String(checksheetId)
    );
    if (inFixedProcedure) {
      return { ...inFixedProcedure, unit: selectedUnit || 'Bawal' };
    }

    const currentTabDocs = documentsByTab[activeTabId] || [];
    const foundInTab = currentTabDocs.find((d) => String(d.id) === String(checksheetId));
    if (foundInTab) return foundInTab;

    // Check across all tabs
    for (const key of Object.keys(documentsByTab)) {
      const found = (documentsByTab[key] || []).find((d) => String(d.id) === String(checksheetId));
      if (found) return found;
    }
    return null;
  }, [checksheetId, activeTabId, documentsByTab, selectedUnit]);

  // Restore selected unit from localStorage or currently viewed checksheet
  useEffect(() => {
    try {
      const savedUnit = localStorage.getItem(CALIBRATION_UNIT_STORAGE_KEY);
      if (savedUnit) {
        setSelectedUnit(savedUnit);
      } else if (activeDocument?.unit) {
        setSelectedUnit(activeDocument.unit);
        localStorage.setItem(CALIBRATION_UNIT_STORAGE_KEY, activeDocument.unit);
      }
    } catch (err) {
      console.error('Failed to load selected unit from localStorage:', err);
    }
  }, [activeDocument]);

  // Sync isFormView with checksheet view state in parent layout
  useEffect(() => {
    if (checksheetId) {
      if (typeof setIsFormView === 'function') {
        setIsFormView(true);
      }
    } else {
      if (typeof setIsFormView === 'function') {
        setIsFormView(false);
      }
    }
  }, [checksheetId, setIsFormView]);

  useEffect(() => {
    return () => {
      if (typeof setIsFormView === 'function') {
        setIsFormView(false);
      }
    };
  }, [setIsFormView]);

  const handleSelectTab = (tabId) => {
    navigate(`${basePath}/${tabId}`);
  };

  const handleOpenChecksheet = (doc) => {
    if (typeof setIsFormView === 'function') {
      setIsFormView(true);
    }
    if (doc.unit) {
      handleSelectUnit(doc.unit);
    }
    const targetTab = doc.tab || activeTabId;
    navigate(`${basePath}/${targetTab}/${doc.id}`);
  };

  const handleBackToList = () => {
    if (typeof setIsFormView === 'function') {
      setIsFormView(false);
    }
    navigate(`${basePath}/${activeTabId}`);
  };

  const handleSaveDocument = (savedDoc) => {
    if (!savedDoc) return;
    const targetTab = savedDoc.tab || activeTabId;
    const currentList = documentsByTab[targetTab] || [];
    const existsIndex = currentList.findIndex((d) => d.id === savedDoc.id);
    let updatedList;
    if (existsIndex >= 0) {
      updatedList = [...currentList];
      updatedList[existsIndex] = { ...savedDoc, isNew: false };
    } else {
      updatedList = [
        ...currentList,
        { ...savedDoc, isNew: false, sNo: currentList.length + 1 }
      ];
    }
    const updated = {
      ...documentsByTab,
      [targetTab]: updatedList
    };
    saveDocuments(updated);
  };

  const handleAddModalSubmit = (newDoc) => {
    const currentList = documentsByTab[activeTabId] || [];
    const docWithMeta = {
      ...newDoc,
      tab: activeTabId,
      sNo: currentList.length + 1
    };
    const updated = {
      ...documentsByTab,
      [activeTabId]: [...currentList, docWithMeta]
    };
    saveDocuments(updated);
    toast.success('Checksheet added successfully!');
    setIsAddModalOpen(false);

    // Immediately navigate to the created checksheet by its unique ID
    if (typeof setIsFormView === 'function') {
      setIsFormView(true);
    }
    navigate(`${basePath}/${activeTabId}/${docWithMeta.id}`);
  };

  const handleDeleteDocument = (docToDelete) => {
    const targetTab = docToDelete.tab || activeTabId;
    const currentList = documentsByTab[targetTab] || [];
    const updatedList = currentList.filter((d) => d.id !== docToDelete.id);
    const updated = {
      ...documentsByTab,
      [targetTab]: updatedList
    };
    saveDocuments(updated);
    toast.success('Checksheet deleted successfully');
  };

  const handleAddChecksheet = () => {
    if (!selectedUnit) {
      toast.warning('Please select the unit');
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (doc) => {
    setEditingDocument(doc);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedDocument = (updatedDoc) => {
    handleSaveDocument(updatedDoc);
    setIsEditModalOpen(false);
    setEditingDocument(null);
    toast.success('Checksheet details updated successfully!');
  };

  // Procedure tab documents are fixed/static and do not use localStorage
  const procedureItems = useMemo(() => {
    return FIXED_PROCEDURE_DOCUMENTS.map((doc) => ({
      ...doc,
      unit: selectedUnit || 'Bawal'
    }));
  }, [selectedUnit]);

  const activeTabItems = activeTabId === 'procedure'
    ? procedureItems
    : (documentsByTab[activeTabId] || []);

  // Render sub-tab content
  const tabProps = {
    searchQuery,
    selectedUnit,
    selectedDepartment,
    selectedSection,
    subFilter: reportFormatSubFilter,
    items: activeTabItems,
    onOpenDocument: handleOpenChecksheet,
    onEdit: handleOpenEditModal,
    onDelete: handleDeleteDocument,
    onDownload: () => toast.warning('currently no excel export not available')
  };

  const renderTabContent = () => {
    switch (activeTabId) {
      case 'procedure':
        return <ProcedureTab {...tabProps} />;
      case 'addition-deletion':
        return <AdditionDeletionTab {...tabProps} />;
      case 'half-yearly-plan':
        return <HalfYearlyPlanTab {...tabProps} />;
      case 'monthly-plan':
        return <MonthlyPlanTab {...tabProps} />;
      case 'report-format':
        return <ReportFormatTab {...tabProps} />;
      case 'history-card':
        return <HistoryCardTab {...tabProps} />;
      case 'decommissioning':
        return <DecommissioningTab {...tabProps} />;
      case 'scrap-note':
        return <ScrapTab {...tabProps} />;
      case 'usability-declaration':
        return <UsabilityDeclarationTab {...tabProps} />;
      default:
        return <ProcedureTab {...tabProps} />;
    }
  };

  if (checksheetId) {
    if (activeDocument) {
      return (
        <CalibrationErrorBoundary onReset={handleBackToList}>
          <CalibrationChecksheetView
            document={activeDocument}
            onBack={handleBackToList}
            onSave={handleSaveDocument}
          />
        </CalibrationErrorBoundary>
      );
    }

    // Checksheet ID in URL was not found in saved checksheets
    return (
      <CalibrationErrorBoundary onReset={handleBackToList}>
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-border p-8 text-center shadow-xs">
            <h3 className="text-base font-bold text-foreground">Checksheet Not Found</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-5">
              The checksheet with ID <span className="font-mono font-semibold text-foreground">{checksheetId}</span> could not be found in your saved checksheets.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackToList}
              className="text-xs font-semibold cursor-pointer"
            >
              Back to Calibration List
            </Button>
          </div>
        </div>
      </CalibrationErrorBoundary>
    );
  }

  return (
    <CalibrationErrorBoundary onReset={() => window.location.reload()}>
      <div className="space-y-3.5 w-full min-w-0 pb-10">
        {/* ── ROW 1: Unit Dropdown & Date Range Card ──────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Unit Dropdown (Default null) */}
          <div
            ref={unitDropdownRef}
            className="relative inline-block"
          >
            <Button
              type="button"
              id="calibration-unit-select-btn"
              variant={selectedUnit ? "default" : "outline"}
              size="sm"
              onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
              className={`flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${selectedUnit
                ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs'
                : 'bg-background hover:bg-muted text-foreground border border-input shadow-xs'
                }`}
              title="Select Unit"
            >
              <span>{selectedUnit ? `Plant: ${selectedUnit}` : 'Select Unit'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${isUnitDropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </Button>

            {isUnitDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl py-1.5 z-50 text-xs font-semibold shadow-xl animate-in fade-in zoom-in-95">
                <div className="px-3.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold border-b border-border mb-1">
                  Select Unit
                </div>
                {unitOptions.map((unit) => {
                  const isSelected = selectedUnit === unit;
                  return (
                    <button
                      key={unit}
                      type="button"
                      id={`calibration-unit-option-${unit.toLowerCase()}`}
                      onClick={() => handleSelectUnit(unit)}
                      className={`w-full text-left px-3.5 py-2 hover:bg-muted/70 hover:text-foreground flex items-center justify-between transition-colors cursor-pointer ${isSelected ? 'font-bold text-blue-600 bg-blue-50/70' : 'text-foreground'
                        }`}
                    >
                      <span>{unit}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />}
                    </button>
                  );
                })}
                {selectedUnit && (
                  <button
                    type="button"
                    onClick={() => handleSelectUnit(null)}
                    className="w-full text-left px-3.5 py-1.5 mt-1 border-t border-border text-muted-foreground hover:text-destructive text-[11px] cursor-pointer"
                  >
                    Clear Selection (All Units)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 2: 9 Calibration Tabs (Pill Buttons) ──────────── */}
        <CalibrationTabBar
          activeTab={activeTabId}
          onSelectTab={handleSelectTab}
          basePath={basePath}
        />

        {/* ── ROW 2.5: Report Format Sub-Filter Tabs (Above Search Bar) ── */}
        {activeTabId === 'report-format' && (
          <div className="flex items-center gap-2 pt-0.5">
            <Button
              type="button"
              id="report-subfilter-format-btn"
              variant={reportFormatSubFilter === 'format-checksheet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportFormatSubFilter('format-checksheet')}
              className={`h-9 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${reportFormatSubFilter === 'format-checksheet'
                ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs'
                : 'bg-background hover:bg-muted text-foreground border border-input shadow-xs'
                }`}
            >
              Format checksheet
            </Button>
            <Button
              type="button"
              id="report-subfilter-mating-btn"
              variant={reportFormatSubFilter === 'mating-gauge' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReportFormatSubFilter('mating-gauge')}
              className={`h-9 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer ${reportFormatSubFilter === 'mating-gauge'
                ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs'
                : 'bg-background hover:bg-muted text-foreground border border-input shadow-xs'
                }`}
            >
              mating gauge
            </Button>
          </div>
        )}

        {/* ── ROW 3: Single-Row Search Bar & 3 Filters ─────────────── */}
        <CalibrationFilterBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          selectedExtraFilter={selectedExtraFilter}
          setSelectedExtraFilter={setSelectedExtraFilter}
          activeTabId={activeTabId}
          onAddChecksheet={handleAddChecksheet}
        />

        {/* ── ROW 4: Active Tab Content Area ───────────────────────── */}
        <div className="w-full transition-all duration-200">
          {renderTabContent()}
        </div>

        {/* Add Checksheet Modal */}
        <AddChecksheetModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          activeTabId={activeTabId}
          selectedUnit={selectedUnit}
          subFilter={reportFormatSubFilter}
          onAdd={handleAddModalSubmit}
        />

        {/* Edit Checksheet Details Modal */}
        <AddChecksheetModal
          open={isEditModalOpen}
          onOpenChange={(open) => {
            setIsEditModalOpen(open);
            if (!open) setEditingDocument(null);
          }}
          activeTabId={editingDocument?.tab || activeTabId}
          selectedUnit={editingDocument?.unit || selectedUnit}
          subFilter={editingDocument?.subType || reportFormatSubFilter}
          editingDocument={editingDocument}
          onSave={handleSaveEditedDocument}
        />
      </div>
    </CalibrationErrorBoundary>
  );
}
