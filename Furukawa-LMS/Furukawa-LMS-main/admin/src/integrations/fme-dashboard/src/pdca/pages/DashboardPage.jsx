import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterToolbar, { TableActionBar } from '../components/FilterToolbar';
import TabNavigation from '../components/TabNavigation';
import PDCATable from '../components/PDCATable';
import CFTCardGrid from '../components/CFTCardGrid';
import Pagination from '../components/Pagination';
import AddPDCAModal from '../components/AddPDCAModal';
import AddCFTModal from '../components/AddCFTModal';
import AddMemberModal from '../components/AddMemberModal';
import { usePDCA } from '../context/PDCAContext';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data, handleAddPDCA, handleUpdatePDCA, handleDeletePDCA, handleSaveMembers, showToast } = usePDCA();

  const [activeTab, setActiveTab] = useState('Company');
  const [selectedPlant, setSelectedPlant] = useState('Unit');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'add' or editData object
  const [isCFTModalOpen, setIsCFTModalOpen] = useState(false);
  const [targetItemForMemberModal, setTargetItemForMemberModal] = useState(null);

  const itemsPerPage = 8;

  /* ── Filter Logic ───────────────────────────────────────── */
  const filteredData = useMemo(() => {
    if (selectedPlant === 'Unit' || selectedPlant === 'All Plants') {
      return [];
    }

    return data.filter((item) => {
      // Unit filter
      if (item.plant.toLowerCase() !== selectedPlant.toLowerCase()) {
        return false;
      }

      // Tab scope
      if (activeTab === 'CFT') {
        if (item.scope !== 'CFT') return false;
      } else if (activeTab === 'Self PDCA') {
        if (!item.isSelf && item.scope !== 'Self PDCA') return false;
      } else if (activeTab === 'Department') {
        if (item.scope !== 'Department') return false;
      } else {
        if (item.scope !== 'Company') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.topic?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.createdBy?.name?.toLowerCase().includes(q) ||
          item.createdBy?.code?.toLowerCase().includes(q) ||
          item.id?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [data, activeTab, selectedPlant, searchQuery]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const selfCount = useMemo(() => {
    if (selectedPlant === 'Unit' || selectedPlant === 'All Plants') {
      return 0;
    }
    return data.filter(
      (i) =>
        i.plant.toLowerCase() === selectedPlant.toLowerCase() &&
        (i.isSelf || i.scope === 'Self PDCA')
    ).length;
  }, [data, selectedPlant]);

  const pageStartIndex = (currentPage - 1) * itemsPerPage;

  /* ── Copy Link ──────────────────────────────────────────── */
  const handleCopy = (row) => {
    try {
      const url = new URL(window.location.origin + `/cms/pdca?sheet=${encodeURIComponent(row.id)}`);
      const linkToCopy = url.toString();

      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(linkToCopy).then(() => {
          showToast(`✓ Link copied for ${row.topic}`);
        }).catch(() => {
          promptCopy(linkToCopy, row.topic);
        });
      } else {
        promptCopy(linkToCopy, row.topic);
      }
    } catch {
      showToast(`✓ Link copied for ${row.topic}`);
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
      showToast(`✓ Link copied for ${topic}`);
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
        onAdd={handleAddPDCA}
        editData={modalMode !== 'add' ? modalMode : null}
        onUpdate={handleUpdatePDCA}
      />

      {/* Add CFT Modal */}
      <AddCFTModal
        isOpen={isCFTModalOpen}
        onClose={() => setIsCFTModalOpen(false)}
        defaultPlant={selectedPlant}
        onAdd={(newCFTItem) => {
          handleAddPDCA(newCFTItem);
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
