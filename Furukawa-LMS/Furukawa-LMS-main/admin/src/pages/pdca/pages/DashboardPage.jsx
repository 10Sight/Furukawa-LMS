import { filterPDCARecords, matchesPlant, PDCA_PLANTS } from '../data/recordFilters';
import { readSaved } from '@components/shared/formPersistence';
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterToolbar, { TableActionBar } from '@components/pdca/FilterToolbar';
import TabNavigation from '@components/pdca/TabNavigation';
import PDCATable from '@components/pdca/PDCATable';
import CFTCardGrid from '@components/pdca/CFTCardGrid';
import Pagination from '@components/pdca/Pagination';
import AddPDCAModal from '@components/pdca/AddPDCAModal';
import AddCFTModal from '@components/pdca/AddCFTModal';
import AddMemberModal from '@components/pdca/AddMemberModal';
import { usePDCA } from '../context/PDCAContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { userContext, data, handleAddPDCA, handleUpdatePDCA, handleDeletePDCA, handleSaveMembers, showToast } = usePDCA();

  const lpaSource = userContext.lpaSource;
  const [activeTab, setActiveTab] = useState(() => readSaved('pdca_list_filters', {}).scope || 'Company');
  const [selectedPlant, setSelectedPlant] = useState(() => readSaved('pdca_list_filters', {}).plant || 'Unit');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'add' or editData object
  const [isCFTModalOpen, setIsCFTModalOpen] = useState(false);
  const [targetItemForMemberModal, setTargetItemForMemberModal] = useState(null);

  const itemsPerPage = 8;

  /* ── Filter Logic ───────────────────────────────────────── */
  useEffect(() => {
    try { localStorage.setItem('pdca_list_filters', JSON.stringify({ plant: selectedPlant, scope: activeTab })); }
    catch { /* Saving a form reports storage errors separately. */ }
  }, [selectedPlant, activeTab]);

  const sourceData = useMemo(() => data.filter(item => !lpaSource || (item.lpaSource?.category === lpaSource.category && (!lpaSource.workbookId || item.lpaSource?.workbookId === lpaSource.workbookId) && (!lpaSource.worksheet || item.lpaSource?.worksheet === lpaSource.worksheet))), [data, lpaSource]);
  const filteredData = useMemo(() => filterPDCARecords(sourceData, selectedPlant, activeTab, searchQuery),
    [sourceData, activeTab, selectedPlant, searchQuery]);

  const revealSavedForm = item => {
    if (PDCA_PLANTS.includes(item.plant)) setSelectedPlant(item.plant);
    setActiveTab(item.scope);
    setSearchQuery('');
    setCurrentPage(1);
  };
  const saveNewPDCA = item => {
    handleAddPDCA(lpaSource ? { ...item, lpaSource } : item);
    revealSavedForm(item);
  };
  const updatePDCA = item => {
    handleUpdatePDCA(item);
    revealSavedForm(item);
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const selfCount = useMemo(() => {
    if (selectedPlant === 'Unit' || selectedPlant === 'All Plants') {
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

  /* ── Export CSV ─────────────────────────────────────────── */
  const handleExportExcel = () => {
    const rows = ['S.No,ID,Topic,Description,Date,Time,Created By,Emp Code,Plant,Department']
      .concat(
        filteredData.map((r, i) =>
          `${i + 1},"${r.id}","${r.topic}","${r.description}","${r.date}","${r.time}","${r.createdBy?.name || ''}","${r.createdBy?.code || ''}","${r.plant}","${r.department || ''}"`
        )
      )
      .join('\n');

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(rows);
    link.download = `PDCA_${activeTab}_${selectedPlant}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Exported to CSV');
  };

  /* ── Download PDCA Sheet ────────────────────────────────── */
  const handleDownloadPDCASheet = (row) => {
    const today = new Date().toISOString().split('T')[0];
    const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

    const sheetHeaders = [
      escapeCsv('PDCA - M Tanaka San Audit Sheet'),
      escapeCsv(`Topic: ${row.topic}`),
      escapeCsv(`PDCA ID: ${row.id}`),
      escapeCsv(`Unit / Plant: ${row.plant}`),
      escapeCsv(`Created By: ${row.createdBy?.name || ''} (${row.createdBy?.code || ''})`),
      escapeCsv(`Generated Date: ${today}`),
      '',
      [
        'S.No',
        'Date',
        'Shift',
        'Line / Area',
        'Observation',
        'Image (Before)',
        'Root Cause',
        'Counter Measure',
        'Image After',
        'Response Date',
        'Department',
        'Staff Employee Name',
        'Assigned Employees',
        '(Responsible person instructions, etc.)'
      ].map(escapeCsv).join(',')
    ];

    const auditRows = Array.from({ length: 10 }, (_, idx) => {
      const sNo = idx + 1;
      const date = idx === 0 ? (row.date || today) : '';
      const shift = idx === 0 ? 'A' : '';
      const lineArea = '';
      const observation = idx === 0 ? (row.description || row.topic) : '';
      const imageBefore = idx === 0 ? 'No Image' : '';
      const rootCause = '';
      const counterMeasure = '';
      const imageAfter = idx === 0 ? 'No Image' : '';
      const responseDate = '';
      const department = idx === 0 ? (row.department || 'SRC Quality') : '';
      const staffEmployee = idx === 0 ? (row.createdBy?.name ? `${row.createdBy.name} (${row.createdBy.code || 'EMP'})` : '') : '';
      const assignedEmpStr = idx === 0 && row.assignedMembers?.length 
        ? row.assignedMembers.map(e => `${e.name} (${e.code})`).join('; ') 
        : '';
      const remarks = '';

      return [
        sNo,
        escapeCsv(date),
        escapeCsv(shift),
        escapeCsv(lineArea),
        escapeCsv(observation),
        escapeCsv(imageBefore),
        escapeCsv(rootCause),
        escapeCsv(counterMeasure),
        escapeCsv(imageAfter),
        escapeCsv(responseDate),
        escapeCsv(department),
        escapeCsv(staffEmployee),
        escapeCsv(assignedEmpStr),
        escapeCsv(remarks)
      ].join(',');
    });

    const csvContent = [...sheetHeaders, ...auditRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedTopic = (row.topic || 'PDCA_Sheet').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `PDCA_Audit_Sheet_${row.id}_${sanitizedTopic}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`✓ Downloaded PDCA Sheet for ${row.id}`);
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {lpaSource && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">LPA · {lpaSource.category === 'assembly' ? 'Assembly' : 'C&C'}{lpaSource.workbookName ? ` · ${lpaSource.workbookName}` : ''}{lpaSource.worksheet ? ` · ${lpaSource.worksheet}` : ''}<p className="mt-1 text-xs">Showing PDCA records linked to this LPA source. New records will be linked automatically.</p></div>}
      {/* 1. Unit Filter on Top */}
      <FilterToolbar
        selectedPlant={selectedPlant}
        setSelectedPlant={(p) => {
          setSelectedPlant(p);
          setCurrentPage(1);
        }}
      />

      {/* 2. Tabs below Unit Filter */}
      <TabNavigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setCurrentPage(1);
        }}
        counts={{ selfCount }}
      />

      {/* 3. Search Bar + Action Buttons */}
      <TableActionBar
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        activeTab={activeTab}
        onExport={handleExportExcel}
        onOpenAddModal={() => {
          if (!PDCA_PLANTS.includes(selectedPlant)) {
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
          pageStartIndex={pageStartIndex}
          totalItems={filteredData.length}
          selectedPlant={selectedPlant}
          onDownload={handleDownloadPDCASheet}
          onCopy={handleCopy}
          onDelete={handleDeletePDCA}
          onTopicClick={(topicRow) => navigate(`/sheet/${topicRow.id}`)}
          onOpenAddMember={(item) => setTargetItemForMemberModal(item)}
          onEdit={(item) => setModalMode(item)}
        />
      ) : (
        <PDCATable
          items={paginatedData}
          activeTab={activeTab}
          pageStartIndex={pageStartIndex}
          selectedPlant={selectedPlant}
          onDownload={handleDownloadPDCASheet}
          onCopy={handleCopy}
          onDelete={handleDeletePDCA}
          onTopicClick={(topicRow) => navigate(`/sheet/${topicRow.id}`)}
          onOpenAddMember={(item) => setTargetItemForMemberModal(item)}
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
        defaultPlant={selectedPlant}
        defaultScope={activeTab}
        onAdd={saveNewPDCA}
        editData={modalMode !== 'add' ? modalMode : null}
        onUpdate={updatePDCA}
      />

      {/* Add CFT Modal */}
      <AddCFTModal
        isOpen={isCFTModalOpen}
        onClose={() => setIsCFTModalOpen(false)}
        defaultPlant={selectedPlant}
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
    </div>
  );
}
