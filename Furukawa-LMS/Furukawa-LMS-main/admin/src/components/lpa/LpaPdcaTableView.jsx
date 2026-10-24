import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Calendar, 
  Download, 
  Copy, 
  Trash2, 
  Edit3, 
  ChevronDown, 
  Building2, 
  Filter,
  Layers,
  ArrowUpDown,
  RefreshCw
} from 'lucide-react';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import { matchesPlant } from '../../pages/pdca/data/recordFilters';
import { isAssemblyRecord, isCcRecord } from '../../pages/lpa/lpaPdcaUtils.js';
export { isAssemblyRecord, isCcRecord };

export default function LpaPdcaTableView({
  section = 'assembly', // 'assembly' or 'cc'
  sectionLabel = 'Assembly',
  selectedUnit = 'Bawal',
  mode = 'observations', // 'observations' (date-filtered or current) or 'all' (all historical months)
  pdcaDate = new Date().toISOString().slice(0, 10),
  onOpenRecord,
  onEditRecord,
  onCreateNew
}) {
  const { data: allRecords, loading, refreshData, handleDeletePDCA, showToast } = usePDCA();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [dateFilter, setDateFilter] = useState(mode === 'observations' ? pdcaDate : '');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (mode === 'observations') {
      setDateFilter(pdcaDate);
    }
  }, [pdcaDate, mode]);


  // Filter records by unit and section.
  // Only include records whose ID starts with 'PDCA-LPA-' — those are the sheets created
  // from the LPA PDCA Page. Regular PDCA records (created from the PDCA Dashboard) must
  // never appear here, even if their section/department/topic happens to contain 'assembly'
  // or 'c&c'.
  const sectionScopedRecords = useMemo(() => {
    if (!Array.isArray(allRecords)) return [];
    return allRecords.filter((item) => {
      if (item.isDeleted) return false;
      // Strict: only LPA-originated records belong in this view
      const id = String(item.id || item.recordId || '');
      if (!id.startsWith('PDCA-LPA-')) return false;
      if (!matchesPlant(item, selectedUnit)) return false;
      return section === 'assembly' ? isAssemblyRecord(item) : isCcRecord(item);
    });
  }, [allRecords, selectedUnit, section]);

  // Extract available distinct months for the month filter dropdown
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    sectionScopedRecords.forEach((r) => {
      if (r.date) {
        const d = new Date(r.date);
        if (!isNaN(d.getTime())) {
          monthSet.add(d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }));
        } else {
          const parts = r.date.trim().split(/[\s-]+/);
          if (parts.length >= 3) {
            if (parts[0].length === 4) {
              monthSet.add(`${parts[0]}-${parts[1]}`);
            } else {
              monthSet.add(`${parts[1]} ${parts[2]}`);
            }
          }
        }
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [sectionScopedRecords]);

  // Filter by search, date or month
  const filteredRecords = useMemo(() => {
    return sectionScopedRecords.filter((item) => {
      // Month filter (used primarily in All PDCA mode)
      if (selectedMonth && selectedMonth !== 'all' && item.date) {
        const itemMonth = new Date(item.date);
        const formattedMonth = !isNaN(itemMonth.getTime())
          ? itemMonth.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          : '';
        if (!item.date.toLowerCase().includes(selectedMonth.toLowerCase()) && formattedMonth !== selectedMonth) {
          return false;
        }
      }

      // Date filter (used in Observations mode)
      if (mode === 'observations' && dateFilter) {
        const itemDateStr = (item.date || '').toLowerCase();
        const filterStr = dateFilter.toLowerCase();
        // Allow flexible matching: "2026-10-13" vs "13 Oct 2026"
        let isMatch = itemDateStr.includes(filterStr);
        if (!isMatch && item.date) {
          const parsed = new Date(item.date);
          if (!isNaN(parsed.getTime())) {
            const localIso = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
            isMatch = localIso === filterStr || parsed.toISOString().slice(0, 10) === filterStr;
          }
        }
        if (!isMatch && item.date) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery = [
          item.topic,
          item.description,
          item.id,
          item.department,
          item.section,
          item.lineArea,
          item.status,
          item.createdBy?.name,
          item.createdBy?.code
        ].some((val) => String(val || '').toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [sectionScopedRecords, selectedMonth, dateFilter, mode, searchQuery]);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;

  // Actions
  const handleCopy = (row) => {
    const text = `${row.id}: ${row.topic}`;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      }
    } catch {}
    showToast?.(`✓ Copied reference for ${row.id}`);
  };

  const handleDownload = (row) => {
    const rows = [
      'S.No,ID,Topic,Description,Date,Time,Created By,Emp Code,Plant,Department',
      `1,"${row.id}","${row.topic}","${row.description || ''}","${row.date || ''}","${row.time || ''}","${row.createdBy?.name || ''}","${row.createdBy?.code || ''}","${row.plant || selectedUnit}","${row.department || ''}"`
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${row.id}_PDCA.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast?.(`✓ Downloaded sheet for ${row.id}`);
  };

  const handleDelete = async (row) => {
    if (window.confirm(`Are you sure you want to delete PDCA record "${row.topic}" (${row.id})?`)) {
      await handleDeletePDCA?.(row.id);
      showToast?.(`Deleted record ${row.id}`);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* ── Control Bar: Header info, Search, Date/Month filter, + Add PDCA ── */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#ECEFF3] shadow-[0_2px_6px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={`Search ${sectionLabel} PDCA by topic, description, ID...`}
            className="w-full bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl pl-10 pr-9 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-0.5"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode-specific filter */}
          {mode === 'all' ? (
            /* Month Filter for All PDCA */
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none bg-white border border-[#D1D5DB] text-slate-700 text-xs font-semibold rounded-xl pl-3.5 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs hover:border-slate-400 transition-colors"
                title="Filter records by month"
              >
                <option value="all">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            /* Date filter for LPA Observation (PDCA) */
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-semibold text-slate-600">Audit Date:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent border-0 outline-none text-xs font-semibold text-slate-800 cursor-pointer p-0"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  title="Show all dates"
                  className="text-slate-400 hover:text-slate-600 text-[10px] ml-1 bg-slate-200 px-1 py-0.2 rounded cursor-pointer"
                >
                  Show All
                </button>
              )}
            </div>
          )}

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => refreshData?.()}
            disabled={loading}
            title="Refresh records from backend"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-600 cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* + Add PDCA button */}
          <button
            type="button"
            onClick={onCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add PDCA</span>
          </button>
        </div>
      </div>

      {/* ── Table of Records ── */}
      <div className="w-full min-w-0 bg-white rounded-2xl border border-[#ECEFF3] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
        {loading && sectionScopedRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <p className="text-xs font-medium">Loading {sectionLabel} PDCA records…</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
            <h4 className="text-sm font-bold text-slate-700">No {sectionLabel} PDCA Records Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {mode === 'observations' && dateFilter
                ? `No records match ${selectedUnit} on ${dateFilter}. Click "Show All" or create a new PDCA observation record.`
                : `No saved PDCA records match the current filter in ${selectedUnit}.`}
            </p>
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New {sectionLabel} PDCA</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-[#F1F3F5] bg-[#FAFAFC]">
                  <th className="py-3 px-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-14">S.No</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">Topic</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">Description</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Line/Area</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Created By</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6] text-xs">
                {paginatedRecords.map((row, idx) => {
                  const sNo = (currentPage - 1) * itemsPerPage + idx + 1;
                  const statusVal = row.status || row.sheet?.rows?.find(r => r?.status)?.status || 'Open';
                  const isClosed = ['closed', 'completed'].includes(statusVal.toLowerCase());
                  const isProgress = ['in progress', 'ongoing', 'working'].includes(statusVal.toLowerCase());
                  const lineAreaVal = row.lineArea || row.section || row.sheet?.rows?.find(r => r?.lineArea)?.lineArea || '—';

                  return (
                    <tr key={row.id || idx} className="hover:bg-[#F9FAFD] transition-colors group">
                      {/* S.No */}
                      <td className="py-3.5 pl-6 pr-4 whitespace-nowrap">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold flex items-center justify-center">
                          {sNo}
                        </span>
                      </td>

                      {/* Topic (Clickable Blue Text to open PDCA form) */}
                      <td className="py-3.5 px-4 min-w-[200px] max-w-[260px]">
                        <div className="flex flex-col items-start gap-0.5">
                          <button
                            type="button"
                            onClick={() => onOpenRecord?.(row)}
                            className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline text-xs leading-snug cursor-pointer transition-colors"
                            title="Click to open PDCA form"
                          >
                            {row.topic}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400">{row.id}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 min-w-[200px] max-w-[280px]">
                        <p className="text-slate-600 line-clamp-2 leading-relaxed">
                          {row.description || '—'}
                        </p>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {row.department || sectionLabel}
                        </span>
                      </td>

                      {/* Line/Area */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-medium text-slate-700 text-xs">
                          {lineAreaVal}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col text-[11px]">
                          <span className="font-semibold text-slate-700">{row.date || '—'}</span>
                          {row.time && <span className="text-[10px] font-mono text-slate-400">{row.time}</span>}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${
                          isClosed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isProgress
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {statusVal}
                        </span>
                      </td>

                      {/* Created By */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                              row.createdBy?.avatarBg || 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {row.createdBy?.initials || 'US'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-800 truncate max-w-[120px]">
                              {row.createdBy?.name || 'User'}
                            </span>
                            {row.createdBy?.code && (
                              <span className="text-[9.5px] font-mono text-blue-600 bg-blue-50 px-1 rounded border border-blue-100 self-start">
                                {row.createdBy.code}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions: Edit, Download, Copy, Delete */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => onEditRecord?.(row)}
                            title="Edit PDCA form"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Download */}
                          <button
                            type="button"
                            onClick={() => handleDownload(row)}
                            title="Download CSV"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Copy Link */}
                          <button
                            type="button"
                            onClick={() => handleCopy(row)}
                            title="Copy reference"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            title="Delete record"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {filteredRecords.length > itemsPerPage && (
          <div className="p-3 border-t border-[#F1F3F5] flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
