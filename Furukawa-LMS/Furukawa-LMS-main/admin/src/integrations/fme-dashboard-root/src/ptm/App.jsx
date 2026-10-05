import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import Sidebar from './components/PTM/Sidebar';
import TopHeader from './components/PTM/TopHeader';
import PTMDashboardTable from './components/PTM/PTMDashboardTable';
import FilterToolbar from './components/PTM/FilterToolbar';
import Pagination from './components/PTM/Pagination';
import AddPTMModal from './components/PTM/AddPTMModal';
import PTMTable from './components/PTM/PTMTable';
import PTMHeader from './components/PTM/PTMHeader';
import { initialPTMData } from './data/initialData';
import { initialHeaderInfo, initialPTMRows } from './data/ptmData';
import { ChevronDown, Check, Plus, Download, RotateCcw, ArrowLeft, Undo2, Redo2, Save } from 'lucide-react';

const VALID_UNITS = ['Bawal', 'Gujrat'];
const ProcessAudit = lazy(() => import('../process-audit/ProcessAudit'));

function getStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadUnitRows(unit) {
  const scopedRows = getStoredJson(`ptm_rows_data_${unit}`, null);
  if (Array.isArray(scopedRows)) return scopedRows;

  let legacyOwner;
  try {
    legacyOwner = localStorage.getItem('ptm_legacy_data_owner');
    if (!legacyOwner) {
      legacyOwner = unit;
      localStorage.setItem('ptm_legacy_data_owner', unit);
    }
  } catch {
    legacyOwner = unit;
  }

  const sourceRows = legacyOwner === unit
    ? getStoredJson('ptm_rows_data', initialPTMRows)
    : initialPTMRows;

  return sourceRows
    .filter((row) => !row.unit || row.unit === 'Both' || row.unit === unit)
    .map((row) => ({ ...row, unit: row.unit || unit }));
}

function loadUnitHeaderInfo(unit) {
  const scopedInfo = getStoredJson(`ptm_header_info_${unit}`, null);
  if (scopedInfo) return scopedInfo;

  let legacyOwner;
  try {
    legacyOwner = localStorage.getItem('ptm_legacy_data_owner');
    if (!legacyOwner) {
      legacyOwner = unit;
      localStorage.setItem('ptm_legacy_data_owner', unit);
    }
  } catch {
    legacyOwner = unit;
  }

  return legacyOwner === unit
    ? getStoredJson('ptm_header_info', initialHeaderInfo)
    : initialHeaderInfo;
}

export default function App({ embedded = false, cmsIntegration = false, activeSection = 'ptm', onFormViewChange }) {
  /* ── 1. Unit Selection State ── */
  const [selectedUnit, setSelectedUnit] = useState(() => {
    try {
      // sessionStorage persists within the tab session (survives navigation)
      // but clears on a real browser reload – exactly the desired behavior.
      return sessionStorage.getItem('ptm_selected_unit') || null;
    } catch {
      return null;
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Views: 'list' (the PTM Dashboard page from the screenshot) or 'form' (the PTM Matrix form)
  const [currentView, setCurrentView] = useState(activeSection === 'process-audit' ? 'process-audit' : 'list');
  const [isProcessAuditFormOpen, setIsProcessAuditFormOpen] = useState(false);
  const isFormFullScreen = currentView === 'form' || (currentView === 'process-audit' && isProcessAuditFormOpen);

  useEffect(() => {
    if (activeSection === 'process-audit') setCurrentView('process-audit');
    else if (activeSection === 'ptm' && currentView === 'process-audit') setCurrentView('list');
  }, [activeSection]);
  useEffect(() => {
    onFormViewChange?.(
      (activeSection === 'ptm' && currentView === 'form') ||
      (activeSection === 'process-audit' && isProcessAuditFormOpen)
    );
  }, [activeSection, currentView, isProcessAuditFormOpen, onFormViewChange]);
  const [selectedTopicItem, setSelectedTopicItem] = useState(null);

  /* ── 2. PTM Dashboard List State ── */
  const [listItems, setListItems] = useState(() => {
    try {
      const saved = localStorage.getItem('ptm_dashboard_items');
      return saved ? JSON.parse(saved) : initialPTMData;
    } catch {
      return initialPTMData;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ptm_dashboard_items', JSON.stringify(listItems));
    } catch (e) {
      console.warn('Could not save list items to localStorage', e);
    }
  }, [listItems]);

  const activeTab = 'Company';
  const [listSearch, setListSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  /* ── 3. PTM Matrix Form Data State ── */
  const [headerInfo, setHeaderInfo] = useState(() => {
    return initialHeaderInfo;
  });

  const projectLeaderOptions = useMemo(
    () => [...new Set([
      headerInfo.projectLeader?.trim(),
      headerInfo.apqpLeader?.trim(),
      ...listItems
        .filter((item) => item.plant === selectedUnit)
        .map((item) => item.createdBy?.name?.trim()),
    ].filter(Boolean))],
    [headerInfo.projectLeader, headerInfo.apqpLeader, listItems, selectedUnit]
  );

  const [ptmRows, setPtmRows] = useState(() => {
    return initialPTMRows;
  });

  const formStateRef = useRef({ headerInfo, ptmRows });
  const historyRef = useRef({ undo: [], redo: [] });
  const [, refreshHistory] = useState(0);
  const updateFormState = (key, setter, update) => {
    const current = formStateRef.current;
    const resolved = typeof update === 'function' ? update(current[key]) : update;
    if (Object.is(resolved, current[key])) return;
    historyRef.current.undo.push(structuredClone(current));
    historyRef.current.redo = [];
    const next = { ...current, [key]: resolved };
    formStateRef.current = next;
    setter(resolved);
    refreshHistory((version) => version + 1);
  };
  const updateHeaderInfo = (update) => updateFormState('headerInfo', setHeaderInfo, update);
  const updatePtmRows = (update) => updateFormState('ptmRows', setPtmRows, update);
  const undoFormChange = () => {
    const previous = historyRef.current.undo.pop();
    if (!previous) return;
    historyRef.current.redo.push(structuredClone(formStateRef.current));
    formStateRef.current = previous;
    setHeaderInfo(previous.headerInfo);
    setPtmRows(previous.ptmRows);
    refreshHistory((version) => version + 1);
  };
  const redoFormChange = () => {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    historyRef.current.undo.push(structuredClone(formStateRef.current));
    formStateRef.current = next;
    setHeaderInfo(next.headerInfo);
    setPtmRows(next.ptmRows);
    refreshHistory((version) => version + 1);
  };
  const saveFormChanges = () => {
    if (!selectedUnit) return;
    try {
      localStorage.setItem(`ptm_header_info_${selectedUnit}`, JSON.stringify(formStateRef.current.headerInfo));
      localStorage.setItem(`ptm_rows_data_${selectedUnit}`, JSON.stringify(formStateRef.current.ptmRows));
      showToast('Changes saved successfully.');
    } catch (error) {
      console.warn('Could not save PTM form changes', error);
      showToast('Could not save changes. Please try again.');
    }
  };

  const handleSelectUnit = (unit) => {
    const nextUnit = VALID_UNITS.includes(unit) ? unit : null;
    if (nextUnit) {
      const nextRows = loadUnitRows(nextUnit);
      const nextHeaderInfo = loadUnitHeaderInfo(nextUnit);
      setPtmRows(nextRows);
      setHeaderInfo(nextHeaderInfo);
      formStateRef.current = { ptmRows: nextRows, headerInfo: nextHeaderInfo };
      historyRef.current = { undo: [], redo: [] };
      try { sessionStorage.setItem('ptm_selected_unit', nextUnit); } catch { /* ignore */ }
    } else {
      try { sessionStorage.removeItem('ptm_selected_unit'); } catch { /* ignore */ }
    }
    if (!nextUnit) setIsAddModalOpen(false);
    setSelectedUnit(nextUnit);
    setCurrentView('list');
    setSelectedTopicItem(null);
    setCurrentPage(1);
  };

  const [ptmSearch, setPtmSearch] = useState('');
  const [ptmPhaseFilter, setPtmPhaseFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState(null);
  const [showLegendBox, setShowLegendBox] = useState(false);

  useEffect(() => {
    if (!selectedUnit) return;
    try {
      localStorage.setItem(`ptm_header_info_${selectedUnit}`, JSON.stringify(headerInfo));
    } catch (e) {
      console.warn('Could not save headerInfo to localStorage', e);
    }
  }, [headerInfo, selectedUnit]);

  useEffect(() => {
    if (!selectedUnit) return;
    try {
      localStorage.setItem(`ptm_rows_data_${selectedUnit}`, JSON.stringify(ptmRows));
    } catch (e) {
      console.warn('Could not save ptmRows to localStorage', e);
    }
  }, [ptmRows, selectedUnit]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ── Handlers for PTM Dashboard List ── */
  const filteredListItems = useMemo(() => {
    if (!selectedUnit) return [];
    return listItems.filter((item) => {
      // Plant match
      const plantMatch = selectedUnit ? item.plant === selectedUnit : true;
      // Scope/Tab match
      const scopeMatch = activeTab === 'Self PDCA'
        ? item.scope === 'Self PDCA' || item.scope === 'Self PTM'
        : item.scope === activeTab;
      // Search match
      const q = listSearch.toLowerCase().trim();
      const searchMatch =
        !q ||
        item.topic?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.id?.toLowerCase().includes(q) ||
        item.createdBy?.name?.toLowerCase().includes(q);

      return plantMatch && scopeMatch && searchMatch;
    });
  }, [listItems, selectedUnit, activeTab, listSearch]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredListItems.slice(start, start + itemsPerPage);
  }, [filteredListItems, currentPage, itemsPerPage]);

  const handleOpenForm = (item) => {
    if (!selectedUnit) return;
    setSelectedTopicItem(item);
    setCurrentView('form');
    showToast(`Opening PTM Form for: ${item.topic}`);
  };

  const handleAddListItem = (newItem) => {
    setListItems([newItem, ...listItems]);
    showToast('✓ New PTM item created');
  };

  const handleCopyListItem = (item) => {
    const copied = {
      ...item,
      id: `PTM-${selectedUnit === 'Gujrat' ? 'GJ' : 'BW'}-${Math.floor(100 + Math.random() * 900)}`,
      topic: `${item.topic} (Copy)`,
    };
    setListItems([copied, ...listItems]);
    showToast('✓ PTM item duplicated');
  };

  const handleDeleteListItem = (id) => {
    setListItems(listItems.filter((it) => it.id !== id));
    showToast('✓ PTM item deleted');
  };
  
  const handleExportList = () => {
    if (!selectedUnit) {
      setUnitDropdownOpen(true);
      return;
    }
    // Generate simple CSV export
    const headers = ['S.No', 'ID', 'Topic', 'Description', 'Plant', 'Scope', 'Date', 'Time', 'Created By'];
    const rows = filteredListItems.map((it, idx) => [
      idx + 1,
      it.id,
      `"${it.topic.replace(/"/g, '""')}"`,
      `"${it.description.replace(/"/g, '""')}"`,
      it.plant, 
      it.scope,
      it.date,
      it.time,
      `"${it.createdBy?.name || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PTM_${selectedUnit || 'All'}_${activeTab}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Excel/CSV report exported');
  };

  /* ── Form Reset ── */
  const handleResetPTM = () => {
    if (window.confirm('Reset all PTM rows and headers to the default template?')) {
      setHeaderInfo(initialHeaderInfo);
      setPtmRows(initialPTMRows);
      formStateRef.current = { headerInfo: initialHeaderInfo, ptmRows: initialPTMRows };
      historyRef.current = { undo: [], redo: [] };
      showToast('✓ Reset to default template');
    }
  };

  const handleAddRowFromTop = () => {
    const newRow = {
      id: 'row-' + Date.now(),
      addedFrom: 'filters',
      rowType: 'parent',
      childrenHidden: false,
      phaseNo: '',
      phaseName: '',
      reqNo: '',
      reqName: '',
      customerEvent: '',
      rankA: '',
      rankB: '',
      rankC: '',
      critical: null,
      activity: '',
      departments: {
        FA: '',
        HR: '',
        MKT: '',
        DD: '',
        PE: '',
        PPC: '',
        PROD: '',
        SCM: '',
        Quality: '',
      },
      deliverable: '',
      duration: '',
      startDatePlan: '',
      startDateActual: '',
      endDatePlan: '',
      endDateActual: '',
      hitMiss: '',
      revisedDate: '',
      noOfTimesRevised: '',
      reasonOfFailure: '',
      actionTaken: '',
      status: '',
      remarks: '',
      unit: selectedUnit || 'Both',
    };
    updatePtmRows((currentRows) => {
      const parentRows = currentRows.filter((row) => !(
        row.rowType === 'child' || (row.addedFrom === 'form' && row.formGroupRole === 'child')
      ));
      const highestParentSerial = parentRows.reduce((highest, row, index) => {
        const serial = Number(row.parentSerialNo) || index + 1;
        return Math.max(highest, serial);
      }, 0);
      return [...currentRows, { ...newRow, parentSerialNo: highestParentSerial + 1 }];
    });
    showToast('✓ New parent row added at bottom');
  };

  const handleExportMatrixCSV = () => {
    const headers = [
      'Phase No.',
      'Phase Name',
      'AIAG Req No.',
      'AIAG Requirements',
      'Customer Event Name',
      'Rank A',
      'Rank B',
      'Rank C1 & C2',
      'Critical Activity',
      'Activity (New)',
      'F&A',
      'HR',
      'MKT',
      'D&D',
      'PE',
      'PPC',
      'PROD',
      'SCM',
      'Quality',
      'Deliverable Required Yes/No',
      'Std. Duration (days)',
      'Start Date (Plan)',
      'Start Date (Actual)',
      'End Date (Plan)',
      'End Date (Actual)',
      'HIT/MISS',
      'Revised Date',
      'No. of Times Revised',
      'Reason of Failure',
      'Action Taken Against Failure',
      'Status',
      'Remarks',
    ];

    const dataRows = ptmRows.map((r) => {
      const depts = r.departments || {};
      return [
        `"${r.phaseNo || ''}"`,
        `"${(r.phaseName || '').replace(/"/g, '""')}"`,
        `"${r.reqNo || ''}"`,
        `"${(r.reqName || '').replace(/"/g, '""')}"`,
        `"${(r.customerEvent || '').replace(/"/g, '""')}"`,
        `"${r.rankA === 'applicable' ? '■' : r.rankA === 'if_required' ? '□' : ''}"`,
        `"${r.rankB === 'applicable' ? '■' : r.rankB === 'if_required' ? '□' : ''}"`,
        `"${r.rankC === 'applicable' ? '■' : r.rankC === 'if_required' ? '□' : ''}"`,
        `"${r.critical ? '◆' : ''}"`,
        `"${(r.activity || '').replace(/"/g, '""')}"`,
        `"${depts.FA === 'owner' ? '●' : depts.FA === 'support' ? '○' : ''}"`,
        `"${depts.HR === 'owner' ? '●' : depts.HR === 'support' ? '○' : ''}"`,
        `"${depts.MKT === 'owner' ? '●' : depts.MKT === 'support' ? '○' : ''}"`,
        `"${depts.DD === 'owner' ? '●' : depts.DD === 'support' ? '○' : ''}"`,
        `"${depts.PE === 'owner' ? '●' : depts.PE === 'support' ? '○' : ''}"`,
        `"${depts.PPC === 'owner' ? '●' : depts.PPC === 'support' ? '○' : ''}"`,
        `"${depts.PROD === 'owner' ? '●' : depts.PROD === 'support' ? '○' : ''}"`,
        `"${depts.SCM === 'owner' ? '●' : depts.SCM === 'support' ? '○' : ''}"`,
        `"${depts.Quality === 'owner' ? '●' : depts.Quality === 'support' ? '○' : ''}"`,
        `"${(r.deliverable || '').replace(/"/g, '""')}"`,
        `"${r.duration || ''}"`,
        `"${r.startDatePlan || ''}"`,
        `"${r.startDateActual || ''}"`,
        `"${r.endDatePlan || ''}"`,
        `"${r.endDateActual || ''}"`,
        `"${r.hitMiss || ''}"`,
        `"${r.revisedDate || ''}"`,
        `"${r.noOfTimesRevised || ''}"`,
        `"${(r.reasonOfFailure || '').replace(/"/g, '""')}"`,
        `"${(r.actionTaken || '').replace(/"/g, '""')}"`,
        `"${r.status || ''}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...dataRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PTM_Matrix_${selectedUnit || 'All'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Complete PTM CSV exported');
  };

  return (
    <div className={`${currentView === 'form' || currentView === 'process-audit' ? 'h-screen min-h-0 overflow-hidden' : 'min-h-screen'} bg-[#F4F6F9] text-slate-800 flex`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
          {toastMessage}
        </div>
      )}

      {/* Add PTM Modal */}
      <AddPTMModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddListItem}
      />

      {/* Left Sidebar */}
      {!embedded && <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        hidden={isFormFullScreen}
        currentView={currentView}
        setCurrentView={(view) => setCurrentView(view)}
        onLogout={() => {
          handleSelectUnit(null);
          showToast('Logged out');
        }}
      />}

      {/* Main Layout */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${currentView === 'form' || currentView === 'process-audit' ? 'h-screen min-h-0 overflow-hidden' : 'min-h-screen'} transition-all duration-300 ${
          embedded || isFormFullScreen ? 'ml-0' : sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {/* Top Header matching screenshot */}
        {!cmsIntegration && !isFormFullScreen && (
          <TopHeader
            currentView={currentView}
            onExport={handleExportList}
            onBackToList={() => setCurrentView('list')}
          />
        )}

        {/* ── VIEW 1: PTM DASHBOARD LIST VIEW (EXACTLY MATCHING THE USER SCREENSHOT) ── */}
        {currentView === 'list' && (
          <main className="w-full max-w-[1280px] mx-auto p-3 sm:p-4 md:p-6 space-y-5 flex-1 min-w-0">
            {/* 1. Unit Selector Pill Dropdown */}
            <div className="flex items-center justify-between">
              <div className="relative inline-block">
                <button
                  onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                  className="flex items-center gap-2.5 bg-white px-4 py-2 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_4px_rgba(0,0,0,0.03)] text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Switch Plant Unit"
                >
                  <span>{selectedUnit || 'Unit'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {unitDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-40 text-xs font-semibold animate-fade-in">
                    <div className="px-3.5 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                      Plant Unit
                    </div>
                    {['Bawal', 'Gujrat'].map((u) => (
                      <button
                        key={u}
                        onClick={() => {
                          handleSelectUnit(u);
                          setUnitDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-between transition-colors ${
                          selectedUnit === u ? 'font-bold text-blue-600 bg-blue-50/60' : 'text-slate-700'
                        }`}
                      >
                        <span>{u}</span>
                        {selectedUnit === u && <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />}
                      </button>
                    ))}
                    <div className="border-t border-slate-100 my-1.5" />
                    {selectedUnit && (
                      <>
                        <button
                          onClick={() => {
                            handleSelectUnit(null);
                            setUnitDropdownOpen(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-[11px] font-medium"
                        >
                          ⇄ All Units Selection
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Search and Action Row: Search input + Export Excel + Add PTM */}
            <div className="sticky top-16 z-20 rounded-xl bg-[#F4F6F9] py-1">
              <FilterToolbar
                searchQuery={listSearch}
                setSearchQuery={(q) => {
                  setListSearch(q);
                  setCurrentPage(1);
                }}
                onExport={handleExportList}
                onOpenAddModal={() => {
                  if (selectedUnit) setIsAddModalOpen(true);
                  else setUnitDropdownOpen(true);
                }}
              />
            </div>

            {/* 4. Table matching user screenshot with BLUE clickable topic links */}
            <div>
              <PTMDashboardTable
                items={paginatedItems}
                unitSelected={Boolean(selectedUnit)}
                onOpenForm={handleOpenForm}
                onCopy={handleCopyListItem}
                onDelete={handleDeleteListItem}
                onExportRow={handleExportList}
                pageStartIndex={(currentPage - 1) * itemsPerPage}
              />
            </div>

            {/* 5. Pagination */}
            {selectedUnit && <div>
              <Pagination
                totalItems={filteredListItems.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>}
          </main>
        )}

        {currentView === 'process-audit' && (
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading Process Audit…</div>}>
            <ProcessAudit
              showToast={showToast}
              onFormOpenChange={setIsProcessAuditFormOpen}
            />
          </Suspense>
        )}

        {/* ── VIEW 2: PTM FORM MATRIX VIEW ── */}
        {currentView === 'form' && (
          <main className="px-2 pb-2 pt-14 sm:px-3 sm:pb-3 md:px-4 md:pb-4 md:pt-14 space-y-3.5 flex-1 min-h-0 min-w-0 w-full mx-auto max-w-full flex flex-col overflow-hidden">

            {/* 2 & 3. MERGED PTM FORM + MATRIX TABLE AS A SINGLE UNIFIED DOCUMENT */}
            <div className="relative z-0 flex-1 min-h-0 min-w-0 bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
              <div className="h-full min-h-0 min-w-0 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
                <div className="min-w-[3200px] w-full">
                  <PTMHeader
                    headerInfo={headerInfo}
                    setHeaderInfo={updateHeaderInfo}
                    projectLeaderOptions={projectLeaderOptions}
                    isMerged={true}
                    formActions={(
                      <div className="fixed inset-x-0 top-0 z-[60] flex min-h-12 w-full flex-wrap items-center gap-1.5 border-b border-slate-300 bg-white px-4 py-2 shadow-sm">
                        <button type="button" onClick={() => setCurrentView('list')} className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"><ArrowLeft className="h-3.5 w-3.5"/><span>Back</span></button>
                        <button type="button" onClick={undoFormChange} disabled={historyRef.current.undo.length === 0} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" title="Go to the previous form state"><Undo2 className="h-4 w-4"/></button>
                        <button type="button" onClick={redoFormChange} disabled={historyRef.current.redo.length === 0} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50" title="Go to the next form state"><Redo2 className="h-4 w-4"/></button>
                        <button type="button" onClick={saveFormChanges} className="flex items-center gap-1 rounded-lg bg-[#2563EB] px-2 py-1.5 text-xs font-bold text-white hover:bg-blue-700" title="Save all current form changes"><Save className="h-4 w-4"/><span>Save</span></button>
                        <button type="button" onClick={handleAddRowFromTop} className="flex items-center gap-1 rounded-lg bg-[#2563EB] px-2 py-1.5 text-xs font-bold text-white hover:bg-blue-700" title="Add a new parent row at the bottom"><Plus className="h-4 w-4"/><span>Add Row</span></button>
                        <button type="button" onClick={handleExportMatrixCSV} className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" title="Export complete matrix to CSV"><Download className="h-3.5 w-3.5 text-slate-500"/><span>Export CSV</span></button>
                      </div>
                    )}
                  />
                  <PTMTable
                    rows={ptmRows}
                    setRows={updatePtmRows}
                    onResetDefault={handleResetPTM}
                    searchQuery={ptmSearch}
                    setSearchQuery={setPtmSearch}
                    phaseFilter={ptmPhaseFilter}
                    setPhaseFilter={setPtmPhaseFilter}
                    deptFilter={deptFilter}
                    setDeptFilter={setDeptFilter}
                    showToast={showToast}
                    selectedUnit={selectedUnit}
                    onAddNewRow={handleAddRowFromTop}
                    isMerged={true}
                  />
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
