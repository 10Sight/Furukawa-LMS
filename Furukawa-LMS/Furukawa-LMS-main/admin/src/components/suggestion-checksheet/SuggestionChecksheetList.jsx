import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  User,
  Star,
  Calendar,
  Filter
} from 'lucide-react';
import SuggestionChecksheetAddModal from './SuggestionChecksheetAddModal';
import SuggestionChecksheetViewModal from './SuggestionChecksheetViewModal';
import { useGetAllDepartmentsQuery } from '@/services/api/DepartmentApi.js';

export default function SuggestionChecksheetList({
  records,
  setRecords,
  onOpenChecksheet,
  selectedUnit: controlledUnit,
  setSelectedUnit: setControlledUnit,
  activeTab: controlledTab,
  setActiveTab: setControlledTab,
  isAdmin = false,
  onToggleBest,
}) {
  const [internalUnit, setInternalUnit] = useState('Bawal');
  const selectedUnit = controlledUnit !== undefined ? controlledUnit : internalUnit;
  const setSelectedUnit = setControlledUnit || setInternalUnit;

  const [internalTab, setInternalTab] = useState('ALL');
  const activeTab = controlledTab !== undefined ? controlledTab : internalTab;
  const setActiveTab = setControlledTab || setInternalTab;

  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  // Fetch departments from DB for department filter
  const { data: deptData } = useGetAllDepartmentsQuery({ limit: 200 });

  const departmentList = useMemo(() => {
    const list = deptData?.data?.departments || deptData?.data || [];
    const dbDepts = Array.isArray(list) ? list.map((d) => d.name || d.deptName || String(d)).filter(Boolean) : [];
    const recordDepts = records.map((r) => r.department).filter(Boolean);
    const combined = Array.from(new Set([...dbDepts, ...recordDepts])).sort();
    return combined;
  }, [deptData, records]);

  // Counts for tabs
  const allSuggestionsCount = useMemo(() => records.filter((r) => !r.isBest).length, [records]);
  const bestSuggestionsCount = useMemo(() => records.filter((r) => Boolean(r.isBest)).length, [records]);

  // Close unit dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target)) {
        setIsUnitDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filtered records based on active tab and all filters
  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      // 1. Tab Partitioning:
      // In "All Suggestions", hide items that have been marked as Best.
      // In "Best Suggestions", show only items marked as Best.
      if (activeTab === 'BEST') {
        if (!item.isBest) return false;
      } else {
        if (item.isBest) return false;
      }

      // 2. Unit Filter
      if (selectedUnit && selectedUnit !== 'All Units' && item.unit !== selectedUnit) {
        return false;
      }

      // 3. Department Filter
      if (departmentFilter !== 'All' && item.department !== departmentFilter) {
        return false;
      }

      // 4. Date Range Filter (From - To)
      if (fromDate && item.date && item.date < fromDate) {
        return false;
      }
      if (toDate && item.date && item.date > toDate) {
        return false;
      }

      // 5. Status Filter
      if (statusFilter !== 'All') {
        const itemStatus = (item.status || '').toLowerCase();
        const filterLower = statusFilter.toLowerCase();
        if (filterLower === 'not feasible') {
          if (itemStatus !== 'not feasible' && itemStatus !== 'rejected') return false;
        } else if (itemStatus !== filterLower) {
          return false;
        }
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = (item.title || '').toLowerCase().includes(query);
        const matchesDesc = (item.description || '').toLowerCase().includes(query);
        const matchesSubmitter = (item.submittedBy || '').toLowerCase().includes(query);
        const matchesDept = (item.department || '').toLowerCase().includes(query);
        const matchesSection = (item.section || '').toLowerCase().includes(query);
        const matchesLine = (item.lineArea || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesSubmitter && !matchesDept && !matchesSection && !matchesLine) {
          return false;
        }
      }

      return true;
    });
  }, [records, activeTab, selectedUnit, departmentFilter, fromDate, toDate, statusFilter, searchQuery]);

  const handleSelectUnit = (unit) => {
    setSelectedUnit(unit);
    setIsUnitDropdownOpen(false);
  };

  const handleResetFilters = () => {
    setSelectedUnit('Bawal');
    setDepartmentFilter('All');
    setFromDate('');
    setToDate('');
    setStatusFilter('All');
    setSearchQuery('');
  };

  const handleAddChecksheet = (newRecord) => {
    setRecords([newRecord, ...records]);
    if (onOpenChecksheet) {
      onOpenChecksheet(newRecord);
    }
  };

  const handleDeleteRecord = (id, e) => {
    e.stopPropagation();
    if (!isAdmin) return;
    if (window.confirm('Are you sure you want to delete this checksheet record?')) {
      setRecords((prev) => prev.filter((rec) => rec.id !== id));
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredRecords;
    if (dataToExport.length === 0) {
      alert('No records available to export.');
      return;
    }

    const headers = [
      'Date',
      'Plant Unit',
      'Department',
      'Section',
      'Line / Area',
      'Suggestion / Title',
      'Description',
      'Category',
      'Created By',
      'Status',
      'Best Suggestion',
    ];
    const csvRows = [
      headers.join(','),
      ...dataToExport.map((r) =>
        [
          `"${r.date || ''}"`,
          `"${r.unit || ''}"`,
          `"${r.department || ''}"`,
          `"${r.section || ''}"`,
          `"${r.lineArea || ''}"`,
          `"${(r.title || '').replace(/"/g, '""')}"`,
          `"${(r.description || '').replace(/"/g, '""')}"`,
          `"${r.category || ''}"`,
          `"${(r.submittedBy || '').replace(/"/g, '""')}"`,
          `"${r.status || ''}"`,
          `"${r.isBest ? 'Yes' : 'No'}"`,
        ].join(',')
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Suggestion_Checksheets_${activeTab === 'BEST' ? 'Best' : 'All'}_${selectedUnit || 'Bawal'}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="suggestion-checksheet-root flex flex-col gap-3 w-full">
      {/* 1. Page Header Tabs: All Suggestions & Best Suggestions */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2 gap-3 bg-white px-4 py-2 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          {/* Tab 1: All Suggestions (Default) */}
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>All Suggestions</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'ALL' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {allSuggestionsCount}
            </span>
          </button>

          {/* Tab 2: Best Suggestions */}
          <button
            type="button"
            onClick={() => setActiveTab('BEST')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'BEST'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Star className={`w-4 h-4 ${activeTab === 'BEST' ? 'fill-white' : 'fill-amber-400 text-amber-500'}`} />
            <span>Best Suggestions</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'BEST' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {bestSuggestionsCount}
            </span>
          </button>
        </div>

        {/* Action Buttons: Add Checksheet only in All Suggestions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-export-excel"
            onClick={handleExportExcel}
            title="Export Records to CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          {activeTab === 'ALL' && (
            <button
              type="button"
              className="btn-add-primary"
              onClick={() => setIsAddModalOpen(true)}
              title="Create New Suggestion Checksheet"
            >
              <Plus className="w-4 h-4" />
              <span>Add Checksheet</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Comprehensive Filter Toolbar (Present in Both Pages) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Unit Dropdown (Default: Bawal) */}
          <div className="relative" ref={unitDropdownRef}>
            <button
              type="button"
              className="unit-dropdown-btn font-semibold text-xs"
              onClick={() => setIsUnitDropdownOpen((prev) => !prev)}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Unit: {selectedUnit || 'Bawal'}</span>
              {isUnitDropdownOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {isUnitDropdownOpen && (
              <div className="unit-dropdown-menu">
                <button
                  type="button"
                  className={`unit-option ${selectedUnit === 'Bawal' ? 'selected' : ''}`}
                  onClick={() => handleSelectUnit('Bawal')}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Bawal</span>
                </button>
                <button
                  type="button"
                  className={`unit-option ${selectedUnit === 'Gujrat' ? 'selected' : ''}`}
                  onClick={() => handleSelectUnit('Gujrat')}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Gujrat</span>
                </button>
                <button
                  type="button"
                  className={`unit-option ${selectedUnit === 'All Units' ? 'selected' : ''}`}
                  onClick={() => handleSelectUnit('All Units')}
                >
                  <span>All Units</span>
                </button>
              </div>
            )}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-semibold">Dept:</span>
            <select
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departmentList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector: From - To with Calendar Pickers */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> From:
            </span>
            <input
              type="date"
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white text-xs cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-slate-500 font-semibold">To:</span>
            <input
              type="date"
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white text-xs cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {/* Search Bar Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="w-full pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Search description, employee, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={handleResetFilters}
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Status Filter Row: All, Under Review, Approved, Implemented, Not Feasible */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-xs text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Status:
          </span>
          {['All', 'Under Review', 'Approved', 'Implemented', 'Not Feasible'].map((st) => (
            <button
              key={st}
              type="button"
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
              }`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Table Card */}
      <div className="main-view-card">
        {/* Table Header Bar */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full text-white shadow-2xs ${
                activeTab === 'BEST' ? 'bg-amber-600' : 'bg-blue-600'
              }`}
            >
              {activeTab === 'BEST' ? '⭐ Best Suggestions' : 'All Suggestions'}
            </span>
            <span className="text-slate-500 text-xs">
              Showing {filteredRecords.length} records (Unit: {selectedUnit || 'Bawal'})
            </span>
          </div>

          <div className="text-xs text-slate-400 italic">
            {activeTab === 'BEST'
              ? 'Only Admin and Sheet Creator can edit best suggestions'
              : 'Admin can click "Best" to promote to Best Suggestions'}
          </div>
        </div>

        {/* Table Container (ID Column Removed as requested!) */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100/80 text-slate-600 uppercase font-bold text-[11px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="pl-5 py-3 w-[110px]">Date</th>
                <th className="py-3 w-[90px]">Unit</th>
                <th className="py-3 w-[150px]">Department</th>
                <th className="py-3">Suggestion / Checksheet Item</th>
                <th className="py-3 w-[120px]">Category</th>
                <th className="py-3 w-[160px]">Created By</th>
                <th className="py-3 w-[130px]">Status</th>
                <th className="pr-5 py-3 text-right w-[140px]">Action</th>
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
                    <td className="pl-5 py-3 text-slate-700 font-medium whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-3">
                      <span className="inline-block px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-semibold text-[11px]">
                        {item.unit}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-800">
                      {item.department || '-'}
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        {item.isBest && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" title="Best Suggestion" />
                        )}
                        <span>{item.title}</span>
                      </div>
                      <div className="text-slate-500 text-[11px] truncate max-w-sm mt-0.5">
                        {item.description}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {item.category || '-'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[140px] font-medium">{item.submittedBy}</span>
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
                            : item.status === 'Not Feasible' || item.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {item.status === 'Rejected' ? 'Not Feasible' : item.status || 'Pending'}
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="pr-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Open Checksheet */}
                        <button
                          type="button"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Open Suggestion Checksheet"
                          onClick={() => onOpenChecksheet && onOpenChecksheet(item)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Best Button: Admin Only! */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleBest) onToggleBest(item);
                            }}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                              item.isBest
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                            }`}
                            title={item.isBest ? 'Remove from Best Suggestions' : 'Promote to Best Suggestions'}
                          >
                            <Star className={`w-3 h-3 ${item.isBest ? 'fill-amber-500 text-amber-600' : 'text-slate-400'}`} />
                            <span>{item.isBest ? 'Remove' : 'Best'}</span>
                          </button>
                        )}

                        {/* Delete Button: Admin Only! */}
                        {isAdmin && (
                          <button
                            type="button"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Record (Admin Only)"
                            onClick={(e) => handleDeleteRecord(item.id, e)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400">
                    <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {activeTab === 'BEST'
                        ? 'No Best Suggestions found matching criteria.'
                        : 'No suggestion checksheets found matching your criteria.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center text-slate-500 text-xs bg-slate-50/50 rounded-b-2xl">
          <div>
            Showing {filteredRecords.length} records in{' '}
            <strong>{activeTab === 'BEST' ? 'Best Suggestions' : 'All Suggestions'}</strong>
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

      {/* Add Checksheet Modal (Only triggered in All Suggestions) */}
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
