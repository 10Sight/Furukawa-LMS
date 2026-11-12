import {
  filterPDCARecords,
  matchesPlant,
  PDCA_PLANTS,
  getStoredUnit,
  resolveCurrentUserId,
  isRecordCreator,
  isUserInSameDepartmentAsRecord,
  getPDCAVisibleSheets,
  classifyPDCASheetStatus,
  filterPDCARecordsBySection,
  getPDCASectionCounts,
  getUserPrimaryDepartment
} from '../data/recordFilters';
import { createDefaultRows } from '../data/pdcaStore';
import { readSaved } from '@components/shared/formPersistence';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import FilterToolbar, { TableActionBar } from '@components/pdca/FilterToolbar';
import TabNavigation from '@components/pdca/TabNavigation';
import PDCATable from '@components/pdca/PDCATable';
import CFTCardGrid from '@components/pdca/CFTCardGrid';
import Pagination from '@components/pdca/Pagination';
import AddPDCAModal from '@components/pdca/AddPDCAModal';
import AddCFTModal from '@components/pdca/AddCFTModal';
import AddMemberModal from '@components/pdca/AddMemberModal';
import FormDeletionDialog from '@components/shared/FormDeletionDialog';
import SendMailModal from '@components/common/SendMailModal';
import { Mail, Clock, CheckCircle2 } from 'lucide-react';
import { usePDCA } from '@hooks/pdca/usePDCA.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const outletContext = useOutletContext();
  const onExportAll = outletContext?.onExportAll;
  const {
    userContext,
    data,
    handleAddPDCA,
    handleUpdatePDCA,
    handleDeletePDCA,
    handleSaveMembers,
    showToast,
    selectedPlant: contextSelectedPlant,
    setSelectedPlant: contextSetSelectedPlant
  } = usePDCA();

  const lpaSource = userContext.lpaSource;
  const [activeTab, setActiveTab] = useState(() => readSaved('pdca_list_filters', {}).scope || 'Company');
  const [localSelectedPlant, setLocalSelectedPlant] = useState(() => {
    const userId = resolveCurrentUserId(userContext?.user);
    return getStoredUnit(userId);
  });
  const selectedPlant = contextSelectedPlant ?? localSelectedPlant;
  const setSelectedPlant = contextSetSelectedPlant ?? setLocalSelectedPlant;
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    const saved = readSaved('pdca_list_filters', {});
    return saved.scope === 'Department' ? (saved.department || '') : '';
  });
  const [selectedDate, setSelectedDate] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Section & Sub-Section Navigation: Ongoing (Not-Started, In-Progress, Delay) and Done (Done)
  const [activeSection, setActiveSection] = useState('Ongoing'); // 'Ongoing' | 'Done'
  const [activeSubSection, setActiveSubSection] = useState('All'); // 'All' | 'Not-Started' | 'In-Progress' | 'Delay' | 'Done'

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'add' or editData object
  const [isCFTModalOpen, setIsCFTModalOpen] = useState(false);
  const [targetItemForMemberModal, setTargetItemForMemberModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [isSendMailOpen, setIsSendMailOpen] = useState(false);

  const itemsPerPage = 8;

  /* ── Filter Logic ───────────────────────────────────────── */
  useEffect(() => {
    try {
      localStorage.setItem('pdca_list_filters', JSON.stringify({
        plant: selectedPlant,
        scope: activeTab,
        department: activeTab === 'Department' ? selectedDepartment : ''
      }));
    } catch { /* Saving a form reports storage errors separately. */ }
  }, [selectedPlant, activeTab, selectedDepartment]);
  useEffect(() => {
    if (lpaSource?.unit) setSelectedPlant(lpaSource.unit);
  }, [lpaSource?.unit]);

  const isUserAdmin = Boolean(userContext?.user?.role === 'admin' || userContext?.user?.isAdmin || String(userContext?.user?.role || '').toUpperCase() === 'ADMIN' || String(userContext?.user?.role || '').toUpperCase() === 'SUPERADMIN');

  const sourceData = useMemo(() => {
    // When accessed from LPA context (lpaSource set), only show records linked to that LPA source.
    // When on the standalone PDCA page (no lpaSource), exclude records that were created by the
    // LPA PDCA Page — their IDs always start with 'PDCA-LPA-'. Those sheets belong exclusively
    // to the LPA PDCA Page and must NOT appear in the regular PDCA list.
    return data.filter(item => {
      if (!lpaSource) {
        const id = String(item.id || item.recordId || '');
        if (id.startsWith('PDCA-LPA-')) return false;
      } else {
        const matchesLpa = (
          (!lpaSource.category || item.lpaSource?.category === lpaSource.category) &&
          (!lpaSource.workbookId || item.lpaSource?.workbookId === lpaSource.workbookId) &&
          (!lpaSource.worksheet || item.lpaSource?.worksheet === lpaSource.worksheet) &&
          (!lpaSource.unit || item.lpaSource?.unit === lpaSource.unit) &&
          (!lpaSource.level || item.lpaSource?.level === lpaSource.level) &&
          (!lpaSource.date || item.lpaSource?.date === lpaSource.date)
        );
        if (!matchesLpa) return false;
      }



      return true;
    });
  }, [data, lpaSource, isUserAdmin, userContext?.user]);
  const openLpaPdca = () => {
    const linked = sourceData[0];
    if (linked) {
      navigate(`/sheet/${encodeURIComponent(linked.id)}`, { state: { returnTo: lpaSource.returnTo || '/' } });
      return;
    }
    setSelectedPlant(lpaSource.unit || 'Bawal');
    setActiveTab('Company');
    setSearchQuery('');
    setCurrentPage(1);
    saveNewPDCA({
      id: `PDCA-LPA-${Date.now()}`,
      topic: `${lpaSource.category === 'assembly' ? 'Assembly' : 'C&C'} LPA · ${lpaSource.date || ''}`.trim(),
      description: (lpaSource.observations || []).join('\n'),
      plant: lpaSource.unit || 'Bawal',
      scope: 'Company',
      department: '',
      section: userContext.section?.name || '',
      sectionId: userContext.section?.id || '',
      date: lpaSource.date ? new Date(`${lpaSource.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      createdBy: userContext.user,
      lpaSource,
      sheet: {
        headerInfo: {
          topicName: `${lpaSource.category === 'assembly' ? 'Assembly' : 'C&C'} LPA · ${lpaSource.date || ''}`.trim(),
          preparedBy: userContext.user?.name || '',
          auditNo: '',
          attendees: ''
        },
        rows: createDefaultRows(10)
      }
    });
  };
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (lpaSource?.autoOpen && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      openLpaPdca();
    }
  }, [lpaSource]);
  const deptFilterToApply = activeTab === 'Department' ? selectedDepartment : '';

  // 1. Get visible sheets for current scope, adhering to visibility rules:
  // - Plant: complete plant sheets
  // - Department: department sheets + plant-created sheets containing points for this department (deduplicated)
  // - Self PDCA: only sheets relevant to the logged-in employee (assigned points or self-created)
  const visibleSheets = useMemo(() => {
    return getPDCAVisibleSheets(sourceData, selectedPlant, activeTab, {
      department: deptFilterToApply,
      currentUser: userContext?.user,
      search: searchQuery,
      dateFilter: selectedDate,
      fromDate,
      toDate
    });
  }, [sourceData, selectedPlant, activeTab, deptFilterToApply, userContext?.user, searchQuery, selectedDate, fromDate, toDate]);

  // 2. Calculate dynamic counts for Ongoing (Not-Started, In-Progress, Delay) and Done (Done)
  const sectionCounts = useMemo(() => {
    return getPDCASectionCounts(visibleSheets, activeTab, {
      targetDept: deptFilterToApply,
      currentUser: userContext?.user
    });
  }, [visibleSheets, activeTab, deptFilterToApply, userContext?.user]);

  // 3. Filter sheets by active section and sub-section (calculated independently per scope)
  const filteredData = useMemo(() => {
    if (activeTab === 'CFT') return visibleSheets;
    return filterPDCARecordsBySection(visibleSheets, activeTab, activeSection, activeSubSection, {
      targetDept: deptFilterToApply,
      currentUser: userContext?.user
    });
  }, [visibleSheets, activeTab, activeSection, activeSubSection, deptFilterToApply, userContext?.user]);

  const revealSavedForm = item => {
    if (PDCA_PLANTS.includes(item.plant)) setSelectedPlant(item.plant);
    setActiveTab(item.scope);
    if (item.scope === 'Department') {
      setSelectedDepartment(item.department || '');
    } else {
      setSelectedDepartment('');
    }
    setSearchQuery('');
    setCurrentPage(1);
  };
  const saveNewPDCA = item => {
    handleAddPDCA(lpaSource ? { ...item, lpaSource } : item);
    revealSavedForm(item);
    if (lpaSource) navigate(`/sheet/${encodeURIComponent(item.id)}`, { state: { returnTo: lpaSource.returnTo || '/' } });
  };
  const handleEditPDCA = (item) => {
    if (!item) return;
    if (!isUserAdmin && !isRecordCreator(item, userContext?.user) && !isUserInSameDepartmentAsRecord(item, userContext?.user)) {
      showToast('Forbidden: Only members of the same department and section or the creator can edit this record.');
      return;
    }
    setModalMode(item);
  };
  const updatePDCA = item => {
    handleUpdatePDCA(item);
    revealSavedForm(item);
  };
  const requestDeletePDCA = id => {
    const item = data.find(record => String(record.id) === String(id));
    if (!item) return;
    if (!isUserAdmin) {
      showToast('Only administrators have access to delete PDCA records.');
      return;
    }
    setDeleteError('');
    setDeleteTarget(item);
  };
  const confirmDeletePDCA = () => {
    if (!deleteTarget) return;
    if (!isUserAdmin) {
      setDeleteError('Only administrators have access to delete PDCA records.');
      return;
    }
    try {
      handleDeletePDCA(deleteTarget.id);
      setCurrentPage(page => Math.min(page, Math.max(1, Math.ceil((filteredData.length - 1) / itemsPerPage))));
      setDeleteTarget(null);
      setDeleteError('');
    } catch (error) {
      setDeleteError(error?.message || 'PDCA form could not be deleted. Please try again.');
    }
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const selfCount = useMemo(() => {
    if (selectedPlant === 'Unit') {
      return 0;
    }
    return getPDCAVisibleSheets(sourceData, selectedPlant, 'Self PDCA', {
      currentUser: userContext?.user
    }).length;
  }, [sourceData, selectedPlant, userContext?.user]);

  const pageStartIndex = (currentPage - 1) * itemsPerPage;

  /* ── Copy Link ──────────────────────────────────────────── */
  const handleCopy = (row) => {
    try {
      const linkToCopy = `${row.id}: ${row.topic}`;

      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(linkToCopy).then(() => {
          showToast(`✓ PDCA reference copied for ${row.topic}`);
        }).catch(() => {
          promptCopy(linkToCopy, row.topic);
        });
      } else {
        promptCopy(linkToCopy, row.topic);
      }
    } catch {
      showToast(`✓ PDCA reference copied for ${row.topic}`);
    }
  };

  const promptCopy = (text, topic) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(`✓ PDCA reference copied for ${topic}`);
    } catch {
      showToast(`Failed to copy link`);
    }
    document.body.removeChild(textArea);
  };

  /* ── Export Complete Excel Workbook with dropdowns and formatting ── */
  const handleExportExcel = async () => {
    try {
      showToast('Generating Excel export...');
      const { exportPDCARecordsListToExcel } = await import('../data/pdcaExcelExport');
      await exportPDCARecordsListToExcel({
        records: filteredData,
        activeTab,
        selectedPlant,
        selectedDate
      });
      showToast('✓ Exported complete PDCA dataset to Excel');
    } catch (err) {
      console.error('Failed to export PDCA Excel workbook:', err);
      showToast('Export failed. Please try again.');
    }
  };

  /* ── Download PDCA Sheet (.xlsx with embedded images) ──────────────── */
  const handleDownloadPDCASheet = async (row) => {
    try {
      showToast(`Preparing Excel workbook with images for ${row.id}...`);
      const { exportPDCASheetToExcel } = await import('../data/pdcaExcelExport');
      await exportPDCASheetToExcel({
        topic: row,
        sheet: row.sheet
      });
      showToast(`✓ Downloaded PDCA Sheet for ${row.id}`);
    } catch (err) {
      console.error('Failed to download PDCA sheet:', err);
      showToast('Could not download PDCA sheet. Please try again.');
    }
  };

  return (
    <div className="space-y-3.5 w-full min-w-0">
      {lpaSource && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">LPA · {lpaSource.category === 'assembly' ? 'Assembly' : 'C&C'}{lpaSource.workbookName ? ` · ${lpaSource.workbookName}` : ''}{lpaSource.worksheet ? ` · ${lpaSource.worksheet}` : ''}<p className="mt-1 text-xs">Showing PDCA records linked to this LPA source. New records will be linked automatically.</p><button type="button" onClick={openLpaPdca} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">{sourceData.length ? 'Open original PDCA form' : 'Create original PDCA record'}</button></div>}
      {/* Export Action */}
      <FilterToolbar onExportAll={onExportAll || handleExportExcel} />
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">From Date<input type="date" value={fromDate} max={toDate || undefined} onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" /></label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">To Date<input type="date" value={toDate} min={fromDate || undefined} onChange={e => { setToDate(e.target.value); setCurrentPage(1); }} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" /></label>
        {(fromDate || toDate) && <button type="button" onClick={() => { setFromDate(''); setToDate(''); setCurrentPage(1); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear dates</button>}
        {fromDate && toDate && fromDate > toDate && <span role="alert" className="text-xs text-red-600">From Date must not be later than To Date.</span>}
      </div>

      {/* 2. Tabs: Plant (with Dropdown), Department, Self PDCA, CFT */}
      <TabNavigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'Department') {
            setSelectedDepartment('');
          }
          setActiveSection('Ongoing');
          setActiveSubSection('All');
          setCurrentPage(1);
        }}
        selectedPlant={selectedPlant}
        setSelectedPlant={(p) => {
          setSelectedPlant(p);
          setCurrentPage(1);
        }}
        counts={{ selfCount }}
      />

      {/* Section Navigation (Plant, Department, Self PDCA) */}
      {activeTab !== 'CFT' && (
        <div className="bg-white rounded-2xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] flex items-center justify-between flex-wrap gap-2">
          {/* Main Sections: Ongoing & Done */}
          <div className="flex items-center gap-2">
            {/* Ongoing Button */}
            <button
              type="button"
              onClick={() => {
                setActiveSection('Ongoing');
                setActiveSubSection('All');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeSection === 'Ongoing'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Ongoing</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  activeSection === 'Ongoing'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {sectionCounts.Ongoing}
              </span>
            </button>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => {
                setActiveSection('Done');
                setActiveSubSection('Done');
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeSection === 'Done'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Done</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  activeSection === 'Done'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {sectionCounts.Done}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong>{filteredData.length}</strong> {activeSection.toLowerCase()} {filteredData.length === 1 ? 'sheet' : 'sheets'}
          </div>
        </div>
      )}

      {/* 3. Search Bar + Action Buttons */}
      <div className="flex items-center justify-end">
        <button type="button" onClick={() => setIsSendMailOpen(true)} className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Mail size={15} />Send Mail</button>
      </div>
      <TableActionBar
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        activeTab={activeTab}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={(d) => {
          setSelectedDepartment(d);
          setCurrentPage(1);
        }}
        onExport={handleExportExcel}
        onOpenAddModal={() => {
          if (!PDCA_PLANTS.includes(selectedPlant) && selectedPlant !== 'All Unit') {
            showToast('Please select Bawal or Gujrat before creating a form.');
            document.getElementById('plant-filter-select')?.focus();
            return;
          }
          if (activeTab === 'CFT') {
            setIsCFTModalOpen(true);
          } else {
            setModalMode('add');
          }
        }}
      />

      {/* 4. Table or CFT Card Boxes */}
      {activeTab === 'CFT' ? (
        <CFTCardGrid
          items={paginatedData}
          currentUser={userContext?.user}
          pageStartIndex={pageStartIndex}
          totalItems={filteredData.length}
          selectedPlant={selectedPlant}
          onDownload={handleDownloadPDCASheet}
          onCopy={handleCopy}
          onDelete={requestDeletePDCA}
          onTopicClick={(topicRow) => navigate(`/sheet/${encodeURIComponent(topicRow.id)}`, { state: { fromScope: activeTab, returnTo: '/' } })}
          onOpenAddMember={(item) => setTargetItemForMemberModal(item)}
          onEdit={handleEditPDCA}
        />
      ) : (
        <PDCATable
          items={paginatedData}
          currentUser={userContext?.user}
          activeTab={activeTab}
          selectedDepartment={deptFilterToApply}
          pageStartIndex={pageStartIndex}
          selectedPlant={selectedPlant}
          selectedDate={selectedDate}
          onClearDate={() => setSelectedDate('')}
          onDownload={handleDownloadPDCASheet}
          onCopy={handleCopy}
          onDelete={requestDeletePDCA}
          onTopicClick={(topicRow) => navigate(`/sheet/${encodeURIComponent(topicRow.id)}`, { state: { fromScope: activeTab, returnTo: '/' } })}
          onOpenAddMember={(item) => setTargetItemForMemberModal(item)}
          onEdit={handleEditPDCA}
        />
      )}

      {/* 5. Pagination */}
      <Pagination
        totalItems={filteredData.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit PDCA Modal */}
      <AddPDCAModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        defaultPlant={selectedPlant === 'All Unit' ? 'Bawal' : selectedPlant}
        defaultScope={activeTab}
        onAdd={saveNewPDCA}
        editData={modalMode !== 'add' ? modalMode : null}
        onUpdate={updatePDCA}
      />

      {/* Add CFT Modal */}
      <AddCFTModal
        isOpen={isCFTModalOpen}
        onClose={() => setIsCFTModalOpen(false)}
        defaultPlant={selectedPlant === 'All Unit' ? 'Bawal' : selectedPlant}
        onAdd={(newCFTItem) => {
          saveNewPDCA(newCFTItem);
        }}
      />

      {/* Add / Assign Members Modal */}
      <AddMemberModal
        isOpen={targetItemForMemberModal !== null}
        targetItem={targetItemForMemberModal}
        onClose={() => setTargetItemForMemberModal(null)}
        onSaveMembers={handleSaveMembers}
      />
      <FormDeletionDialog
        formName={deleteTarget?.topic || deleteTarget?.title || (deleteTarget ? `PDCA form ${deleteTarget.id}` : '')}
        error={deleteError}
        onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        onDelete={confirmDeletePDCA}
      />
      <SendMailModal
        isOpen={isSendMailOpen}
        onClose={() => setIsSendMailOpen(false)}
        formType="pdca"
        pdcaOnly
        pdcaSheets={filteredData}
        pdcaLabel="PDCA Sheet"
        title="PDCA Report"
        metadata={{ auditDate: selectedDate, unit: selectedPlant }}
      />
    </div>
  );
}
