import { filterPDCARecords, matchesPlant, PDCA_PLANTS, getStoredUnit, resolveCurrentUserId, isRecordCreator } from '../data/recordFilters';
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
import { Mail } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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

  const sourceData = useMemo(() => data.filter(item => !lpaSource || (
    (!lpaSource.category || item.lpaSource?.category === lpaSource.category) &&
    (!lpaSource.workbookId || item.lpaSource?.workbookId === lpaSource.workbookId) &&
    (!lpaSource.worksheet || item.lpaSource?.worksheet === lpaSource.worksheet) &&
    (!lpaSource.unit || item.lpaSource?.unit === lpaSource.unit) &&
    (!lpaSource.level || item.lpaSource?.level === lpaSource.level) &&
    (!lpaSource.date || item.lpaSource?.date === lpaSource.date)
  )), [data, lpaSource]);
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
  const filteredData = useMemo(() => filterPDCARecords(sourceData, selectedPlant, activeTab, searchQuery, deptFilterToApply, selectedDate),
    [sourceData, activeTab, selectedPlant, searchQuery, deptFilterToApply, selectedDate]);

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
    if (!isRecordCreator(item, userContext?.user)) {
      showToast('Only the record creator can edit this PDCA record.');
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
    if (!isRecordCreator(item, userContext?.user)) {
      showToast('Only the record creator can delete this PDCA record.');
      return;
    }
    setDeleteError('');
    setDeleteTarget(item);
  };
  const confirmDeletePDCA = () => {
    if (!deleteTarget) return;
    if (!isRecordCreator(deleteTarget, userContext?.user)) {
      setDeleteError('Only the record creator can delete this PDCA record.');
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
    return sourceData.filter(
      (i) =>
        matchesPlant(i, selectedPlant) &&
        (i.isSelf || i.scope === 'Self PDCA')
    ).length;
  }, [sourceData, selectedPlant]);

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
      {/* 1. Unit Filter and Calendar Date Filter on Top */}
      <FilterToolbar
        selectedPlant={selectedPlant}
        setSelectedPlant={(p) => {
          setSelectedPlant(p);
          setCurrentPage(1);
        }}
        selectedDate={selectedDate}
        setSelectedDate={(d) => {
          setSelectedDate(d);
          setCurrentPage(1);
        }}
        onExportAll={onExportAll || handleExportExcel}
      />

      {/* 2. Tabs below Unit Filter */}
      <TabNavigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'Department') {
            setSelectedDepartment('');
          }
          setCurrentPage(1);
        }}
        counts={{ selfCount }}
      />

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
          onTopicClick={(topicRow) => navigate(`/sheet/${topicRow.id}`)}
          onOpenAddMember={(item) => setTargetItemForMemberModal(item)}
          onEdit={handleEditPDCA}
        />
      ) : (
        <PDCATable
          items={paginatedData}
          currentUser={userContext?.user}
          activeTab={activeTab}
          pageStartIndex={pageStartIndex}
          selectedPlant={selectedPlant}
          selectedDate={selectedDate}
          onClearDate={() => setSelectedDate('')}
          onDownload={handleDownloadPDCASheet}
          onCopy={handleCopy}
          onDelete={requestDeletePDCA}
          onTopicClick={(topicRow) => navigate(`/sheet/${topicRow.id}`)}
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
      <SendMailModal isOpen={isSendMailOpen} onClose={() => setIsSendMailOpen(false)} formType="pdca" title="PDCA Report" metadata={{ auditDate: selectedDate, unit: selectedPlant }} />
    </div>
  );
}
