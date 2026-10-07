import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Check, User, IdCard, Trash2, Plus } from 'lucide-react';

export default function AddStaffEmployeeModal({ isOpen, onClose, rowIndex, initialValue = '', onSave }) {
  const [employees, setEmployees] = useState([{ name: '', code: '' }]);

  // Parse existing employee string like "Rahul Sharma (BW041920), Dinesh Rao (BW028371)"
  const parseEmployees = (str) => {
    if (!str || !str.trim()) return [{ name: '', code: '' }];
    const parts = str.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return [{ name: '', code: '' }];

    return parts.map((part) => {
      const match = part.match(/^(.*?)\s*\((.*?)\)$/);
      if (match) {
        return { name: match[1].trim(), code: match[2].trim() };
      }
      return { name: part.trim(), code: '' };
    });
  };

  useEffect(() => {
    if (isOpen) {
      setEmployees(parseEmployees(initialValue));
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleAddEmployeeRow = () => {
    setEmployees((prev) => [...prev, { name: '', code: '' }]);
  };

  const handleRemoveEmployeeRow = (index) => {
    if (employees.length <= 1) {
      setEmployees([{ name: '', code: '' }]);
      return;
    }
    setEmployees((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleEmployeeChange = (index, field, value) => {
    setEmployees((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validEmployees = employees
      .map((emp) => ({
        name: emp.name.trim(),
        code: emp.code.trim().toUpperCase()
      }))
      .filter((emp) => emp.name);

    const formattedValue = validEmployees
      .map((emp) => (emp.code ? `${emp.name} (${emp.code})` : emp.name))
      .join(', ');

    onSave(rowIndex, formattedValue);
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Staff Employees
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Row {typeof rowIndex === 'number' ? rowIndex + 1 : ''} • Responsible Person Confirmation
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
          {/* Header Action: Add Employee Row (+) button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Employee Details ({employees.length})
            </span>
            <button
              type="button"
              onClick={handleAddEmployeeRow}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              id="add-staff-employee-btn"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Employee</span>
            </button>
          </div>

          {/* List of Employee Inputs */}
          <div className="space-y-3">
            {employees.map((emp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-[#F9FAFC] relative space-y-2.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">
                    Employee #{idx + 1}
                  </span>
                  {employees.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmployeeRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove this employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-blue-600" />
                      <span>Emp Name *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={emp.name}
                      onChange={(e) => handleEmployeeChange(idx, 'name', e.target.value)}
                      placeholder="e.g. Ramesh Verma"
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <IdCard className="w-3 h-3 text-blue-600" />
                      <span>Emp ID (Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={emp.code}
                      onChange={(e) => handleEmployeeChange(idx, 'code', e.target.value)}
                      placeholder="e.g. GJ024108"
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none placeholder-slate-400 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Employees</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
