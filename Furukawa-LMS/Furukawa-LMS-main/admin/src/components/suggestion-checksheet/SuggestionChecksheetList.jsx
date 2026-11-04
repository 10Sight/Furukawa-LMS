import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  FileSpreadsheet,
  Plus,
  MapPin,
  Eye,
  Trash2,
  Inbox,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  User
} from 'lucide-react';
import SuggestionChecksheetAddModal from './SuggestionChecksheetAddModal';
import SuggestionChecksheetViewModal from './SuggestionChecksheetViewModal';

export default function SuggestionChecksheetList({
  records,
  setRecords,
  onOpenChecksheet,
  selectedUnit: controlledUnit,
  setSelectedUnit: setControlledUnit
}) {
  const [internalUnit, setInternalUnit] = useState(null);
  const selectedUnit = controlledUnit !== undefined ? controlledUnit : internalUnit;
  const setSelectedUnit = setControlledUnit || setInternalUnit;

  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      if (selectedUnit && selectedUnit !== 'All Units' && item.unit !== selectedUnit) {
        return false;
      }
      if (statusFilter !== 'All' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (item.title || '').toLowerCase().includes(query);
        const matchesDesc = (item.description || '').toLowerCase().includes(query);
        const matchesSubmitter = (item.submittedBy || '').toLowerCase().includes(query);
        const matchesId = (item.id || '').toLowerCase().includes(query);
        const matchesDept = (item.department || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesSubmitter && !matchesId && !matchesDept) {
          return false;
        }
      }
      return true;
    });
  }, [records, selectedUnit, searchQuery, statusFilter]);

  const handleSelectUnit = (unit) => {
    setSelectedUnit(unit);
    setIsUnitDropdownOpen(false);
  };

  const handleAddChecksheet = (newRecord) => {
    setRecords([newRecord, ...records]);
    if (!selectedUnit) {
      setSelectedUnit(newRecord.unit);
    }
  };

  const handleDeleteRecord = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this checksheet record?')) {
      setRecords((prev) => prev.filter((rec) => rec.id !== id));
    }
  };

  const handleExportExcel = () => {
    const dataToExport = selectedUnit ? filteredRecords : records;
    if (dataToExport.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'Checksheet ID',
      'Date',
      'Plant Unit',
      'Department',
      'Title',
      'Description',
      'Category',
      'Created By',
      'Status',
    ];
    const csvRows = [
      headers.join(','),
      ...dataToExport.map((r) =>
        [
          `"${r.id}"`,
          `"${r.date}"`,
          `"${r.unit}"`,
          `"${r.department}"`,
          `"${(r.title || '').replace(/"/g, '""')}"`,
          `"${(r.description || '').replace(/"/g, '""')}"`,
          `"${r.category}"`,
          `"${r.submittedBy}"`,
          `"${r.status}"`,
        ].join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Suggestion_Checksheets_${selectedUnit || 'All'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="suggestion-checksheet-root flex flex-col gap-3 w-full">
      {/* Top Filter and Actions Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Unit Selector */}
        <div className="relative">
          <button
            type="button"
            className="unit-dropdown-btn"
            onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
            onBlur={() => setTimeout(() => setIsUnitDropdownOpen(false), 200)}
          >
            <span>{selectedUnit ? `Unit: ${selectedUnit}` : 'Unit'}</span>
            {isUnitDropdownOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {isUnitDropdownOpen && (
            <div
              className="absolute left-0 mt-2 bg-white unit-dropdown-menu z-30 shadow-xl"
            >
              <div className="unit-dropdown-header">PLANT UNIT</div>
              <div
                className={`unit-dropdown-item ${selectedUnit === 'Bawal' ? 'active' : ''}`}
                onClick={() => handleSelectUnit('Bawal')}
              >
                Bawal
              </div>
              <div
                className={`unit-dropdown-item ${selectedUnit === 'Gujrat' ? 'active' : ''}`}
                onClick={() => handleSelectUnit('Gujrat')}
              >
                Gujrat
              </div>
              <div
                className={`unit-dropdown-item ${selectedUnit === 'All Units' ? 'active' : ''}`}
                onClick={() => handleSelectUnit('All Units')}
              >
                All Units
              </div>
            </div>
          )}
        </div>

        {/* Search Input Box */}
        <div className="flex-1 relative max-w-2xl min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            className="custom-search-input w-full"
            placeholder="Search description, created by, or Checksheet ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-export-excel"
            onClick={handleExportExcel}
            title="Export Records to CSV/Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            className="btn-add-primary"
            onClick={() => setIsAddModalOpen(true)}
            title="Create New Checksheet"
          >
            <Plus className="w-4 h-4" />
            <span>Add Checksheet</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {!selectedUnit ? (
        /* Empty State Card matching screenshot */
        <div className="main-view-card">
          <div className="empty-state-container">
            <div className="building-illustration-icon">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                <rect
                  x="6"
                  y="12"
                  width="16"
                  height="30"
                  rx="2"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <rect
                  x="26"
                  y="6"
                  width="16"
                  height="36"
                  rx="2"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line x1="11" y1="18" x2="17" y2="18" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="11" y1="24" x2="17" y2="24" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="11" y1="30" x2="17" y2="30" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="31" y1="14" x2="37" y2="14" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="31" y1="20" x2="37" y2="20" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="31" y1="26" x2="37" y2="26" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="31" y1="32" x2="37" y2="32" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            <h2 className="empty-title">Please Select a Unit</h2>
            <p className="empty-subtitle">
              Select Gujrat or Bawal from the Unit dropdown above to display the records for that unit.
            </p>

            <div className="flex items-center gap-2 mt-4 pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold rounded-full transition-colors cursor-pointer"
                onClick={() => handleSelectUnit('Bawal')}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Select Bawal</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-blue-600 text-blue-600 hover:bg-blue-50 text-xs font-semibold rounded-full transition-colors cursor-pointer"
                onClick={() => handleSelectUnit('Gujrat')}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Select Gujrat</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-full transition-colors cursor-pointer"
                onClick={() => handleSelectUnit('All Units')}
              >
                <span>View All Units</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Populated Table Card */
        <div className="main-view-card">
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-2xs">
                  Unit: {selectedUnit}
                </span>
                <span className="text-slate-500 text-xs">
                  Showing {filteredRecords.length} records
                </span>
              </div>

              {/* Status filter pills */}
              <div className="hidden md:flex items-center gap-1 ml-2">
                {['All', 'Under Review', 'Approved', 'Implemented'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                      statusFilter === status
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              onClick={() => setSelectedUnit(null)}
              title="Reset unit selection to view initial empty state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Selection</span>
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100/80 text-slate-600 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="pl-5 py-3 w-[140px]">ID</th>
                  <th className="py-3 w-[110px]">Date</th>
                  <th className="py-3 w-[90px]">Unit</th>
                  <th className="py-3 w-[160px]">Department</th>
                  <th className="py-3">Suggestion / Checksheet Item</th>
                  <th className="py-3 w-[120px]">Category</th>
                  <th className="py-3 w-[150px]">Created By</th>
                  <th className="py-3 w-[120px]">Status</th>
                  <th className="pr-5 py-3 text-right w-[100px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length > 0 ? (
                  filteredRecords.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => onOpenChecksheet && onOpenChecksheet(item)}
                      title="Click to open Suggestion Checksheet format"
                    >
                      <td className="pl-5 py-3 font-mono font-bold text-blue-600">
                        {item.id}
                      </td>
                      <td className="py-3 text-slate-600">{item.date}</td>
                      <td className="py-3">
                        <span className="inline-block px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-semibold text-[11px]">
                          {item.unit}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-slate-800">
                        {item.department}
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-slate-800">{item.title}</div>
                        <div className="text-slate-500 text-[11px] truncate max-w-sm mt-0.5">
                          {item.description}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[130px]">{item.submittedBy}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            item.status === 'Approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.status === 'Under Review'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : item.status === 'Implemented'
                              ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="pr-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Open Suggestion Checksheet"
                            onClick={() => onOpenChecksheet && onOpenChecksheet(item)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record"
                            onClick={(e) => handleDeleteRecord(item.id, e)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No suggestion checksheets found matching your criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center text-slate-500 text-xs bg-slate-50/50 rounded-b-2xl">
            <div>
              Showing {filteredRecords.length} of {records.length} records (click any row to view full checksheet format)
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-md border border-slate-200 bg-white text-slate-400 text-xs" disabled>
                Previous
              </button>
              <button className="px-3 py-1 rounded-md border border-slate-200 bg-white text-slate-400 text-xs" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Checksheet Modal */}
      <SuggestionChecksheetAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddChecksheet}
        defaultUnit={selectedUnit && selectedUnit !== 'All Units' ? selectedUnit : 'Bawal'}
      />

      {/* View Details Modal */}
      {viewRecord && (
        <SuggestionChecksheetViewModal
          record={viewRecord}
          isOpen={Boolean(viewRecord)}
          onClose={() => setViewRecord(null)}
          onOpenDetail={(rec) => {
            setViewRecord(null);
            if (onOpenChecksheet) onOpenChecksheet(rec);
          }}
        />
      )}
    </div>
  );
}
