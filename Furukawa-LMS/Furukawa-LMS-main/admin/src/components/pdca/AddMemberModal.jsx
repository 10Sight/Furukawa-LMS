import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Check, Trash2, Building2 } from 'lucide-react';
import SearchableEmployeeSelect from './SearchableEmployeeSelect.jsx';
import { VERIFIED_EMPLOYEE_MASTER } from '../../pages/pdca/data/pdcaEmployees.js';
import pdcaApi from '@/services/api/pdcaApi.js';

export default function AddMemberModal({ isOpen, onClose, targetItem, onSaveMembers }) {
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [employeesList, setEmployeesList] = useState(VERIFIED_EMPLOYEE_MASTER || []);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeFetchError, setEmployeeFetchError] = useState(null);

  // Fetch verified employees from database metadata
  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    setEmployeeFetchError(null);
    try {
      const meta = await pdcaApi.getMetadata();
      if (meta?.employees && Array.isArray(meta.employees) && meta.employees.length > 0) {
        const formatted = meta.employees.map((emp) => ({
          id: emp.id,
          name: emp.name,
          code: emp.code || '',
          email: emp.email || '',
          department: emp.department || '',
          initials: (emp.name || '')
            .split(' ')
            .map((n) => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
        }));
        setEmployeesList(formatted);
      }
    } catch (err) {
      console.warn('Could not load employees in AddMemberModal:', err);
      setEmployeeFetchError(err?.message || 'Failed to fetch employee list');
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      if (targetItem?.assignedMembers && Array.isArray(targetItem.assignedMembers)) {
        setAssignedEmployees(targetItem.assignedMembers);
      } else {
        setAssignedEmployees([]);
      }
    }
  }, [targetItem, isOpen, fetchEmployees]);

  if (!isOpen || !targetItem) return null;

  const handleAddEmployee = (emp) => {
    if (!emp) return;
    const empCode = emp.code || emp.id || emp.name;
    const exists = assignedEmployees.some((item) => (item.code || item.id || item.name) === empCode);
    if (!exists) {
      setAssignedEmployees((prev) => [
        ...prev,
        {
          id: emp.id || empCode,
          name: emp.name,
          code: emp.code || '',
          department: emp.department || 'Department not assigned',
          email: emp.email || ''
        }
      ]);
    }
  };

  const handleRemoveEmployee = (index) => {
    setAssignedEmployees((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validMembers = assignedEmployees
      .map((m) => ({
        id: m.id,
        name: (m.name || '').trim(),
        code: (m.code || '').trim(),
        department: (m.department || '').trim()
      }))
      .filter((m) => m.name && m.code);

    onSaveMembers(targetItem.id, validMembers);
    onClose();
  };

  const excludeCodes = [
    targetItem?.createdBy?.code,
    ...assignedEmployees.map((e) => e.code || e.id)
  ].filter(Boolean);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Assign Team Members</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[320px]">
                {targetItem.topic} ({targetItem.id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Target CFT Topic Information */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">CFT Topic:</span>
              <span className="font-bold text-slate-900">{targetItem.topic}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">CFT Lead Member:</span>
              <span className="font-medium text-emerald-800">
                {targetItem.createdBy?.name || 'N/A'}{' '}
                {targetItem.createdBy?.code ? `(${targetItem.createdBy.code})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">CFT Department:</span>
              <span className="font-semibold text-emerald-700">
                {targetItem.department || 'Department not assigned'}
              </span>
            </div>
          </div>

          {/* Searchable Dropdown for Employee Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Select Employee to Assign</span>
              <span className="text-[11px] text-slate-400">Database Search</span>
            </label>
            <SearchableEmployeeSelect
              employees={employeesList}
              value={null}
              onChange={handleAddEmployee}
              placeholder="Search employee by Name, ID, or Department..."
              clearOnSelect={true}
              excludeCodes={excludeCodes}
              isLoading={loadingEmployees}
              error={employeeFetchError}
              onRetry={fetchEmployees}
            />
          </div>

          {/* Assigned Employees List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Assigned Team Members ({assignedEmployees.length})
              </span>
            </div>

            <div className="space-y-2">
              {assignedEmployees.length === 0 ? (
                <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs italic">
                  No employees assigned yet. Use the search dropdown above to select members.
                </div>
              ) : (
                assignedEmployees.map((emp, idx) => (
                  <div
                    key={emp.code || emp.id || idx}
                    className="p-3 rounded-xl border border-slate-200 bg-[#F9FAFC] flex items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-150"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 truncate">{emp.name}</span>
                        {emp.code && (
                          <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                            {emp.code}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 mt-0.5">
                        Department: <span className="font-medium text-slate-700">{emp.department || 'Department not assigned'}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveEmployee(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      title="Remove employee"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer font-medium"
            >
              <Check className="w-4 h-4" />
              <span>Save Team Members</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
