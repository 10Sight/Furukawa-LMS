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
  const { tab } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const outletCtx = useOutletContext() || {};
  const { isFormView, setIsFormView } = outletCtx;

  // View state: 'list' (documents table) | 'detail' (checksheet view)
  const [currentPage, setCurrentPage] = useState('list');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentsByTab, setDocumentsByTab] = useState(CALIBRATION_DOCUMENTS_BY_TAB);

  const handleOpenChecksheet = (doc) => {
    setSelectedDocument(doc);
    setCurrentPage('detail');
    if (typeof setIsFormView === 'function') {
      setIsFormView(true);
    }
  };

  const handleBackToList = () => {
    setCurrentPage('list');
    setSelectedDocument(null);
    if (typeof setIsFormView === 'function') {
      setIsFormView(false);
    }
  };

  // Ensure isFormView resets if component unmounts or returns to list view
  useEffect(() => {
    if (currentPage === 'list' && typeof setIsFormView === 'function') {
      setIsFormView(false);
    }
  }, [currentPage, setIsFormView]);

  useEffect(() => {
    return () => {
      if (typeof setIsFormView === 'function') {
        setIsFormView(false);
      }
    };
  }, [setIsFormView]);

  // 1. Unit dropdown state (default unit must be null)
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef(null);

  const unitOptions = ['Bawal', 'Gujrat'];
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(e.target)) {
        setIsUnitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Date range state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 3. Search and filter state
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
    return '/cms/calibration';
  }, [location.pathname]);

  // Active tab selection
  const activeTabId = useMemo(() => {
    const valid = CALIBRATION_TABS.some((t) => t.id === tab);
    return valid ? tab : 'procedure';
  }, [tab]);

  const handleSelectTab = (tabId) => {
    navigate(`${basePath}/${tabId}`);
  };

  const handleSaveDocument = (savedDoc) => {
    if (!savedDoc) return;
    setDocumentsByTab((prev) => {
      const currentList = prev[activeTabId] || [];
      const existsIndex = currentList.findIndex((d) => d.id === savedDoc.id);
      if (existsIndex >= 0) {
        const updated = [...currentList];
        updated[existsIndex] = { ...savedDoc, isNew: false };
        return { ...prev, [activeTabId]: updated };
      } else {
        return {
          ...prev,
          [activeTabId]: [
            ...currentList,
            { ...savedDoc, isNew: false, sNo: currentList.length + 1 }
          ]
        };
      }
    });
  };

  const handleAddModalSubmit = (newDoc) => {
    setDocumentsByTab((prev) => {
      const currentList = prev[activeTabId] || [];
      return {
        ...prev,
        [activeTabId]: [
          ...currentList,
          { ...newDoc, sNo: currentList.length + 1 }
        ]
      };
    });
    toast.success('Checksheet added successfully!');
  };

  const handleDeleteDocument = (docToDelete) => {
    setDocumentsByTab((prev) => {
      const currentList = prev[activeTabId] || [];
      const updated = currentList.filter((d) => d.id !== docToDelete.id);
      return { ...prev, [activeTabId]: updated };
    });
    toast.success('Checksheet deleted successfully');
  };

  const handleAddChecksheet = () => {
    if (!selectedUnit) {
      toast.warning('Please select the unit');
      return;
    }
    setIsAddModalOpen(true);
  };

  // Render sub-tab content
  const tabProps = {
    searchQuery,
    selectedUnit,
    selectedDepartment,
    selectedSection,
    subFilter: reportFormatSubFilter,
    items: documentsByTab[activeTabId] || [],
    onOpenDocument: handleOpenChecksheet,
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

  if (currentPage === 'detail' && selectedDocument) {
    return (
      <CalibrationErrorBoundary onReset={handleBackToList}>
        <CalibrationChecksheetView
          document={selectedDocument}
          onBack={handleBackToList}
          onSave={handleSaveDocument}
        />
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
                      onClick={() => {
                        setSelectedUnit(unit);
                        setIsUnitDropdownOpen(false);
                      }}
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
                    onClick={() => {
                      setSelectedUnit(null);
                      setIsUnitDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-1.5 mt-1 border-t border-border text-muted-foreground hover:text-destructive text-[11px] cursor-pointer"
                  >
                    Clear Selection (All Units)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Date Range Card */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-xs text-xs">
            <span className="text-muted-foreground font-semibold">From Date</span>
            <input
              type="date"
              id="calibration-from-date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-foreground text-xs font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-muted-foreground font-semibold ml-1">To Date</span>
            <input
              type="date"
              id="calibration-to-date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 bg-transparent text-foreground text-xs font-medium border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer"
              >
                Clear
              </button>
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
      </div>
    </CalibrationErrorBoundary>
  );
}
