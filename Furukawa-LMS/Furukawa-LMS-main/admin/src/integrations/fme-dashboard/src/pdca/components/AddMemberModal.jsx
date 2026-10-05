import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Check, Trash2, User, IdCard } from 'lucide-react';

export default function AddMemberModal({ isOpen, onClose, targetItem, onSaveMembers }) {
  const [members, setMembers] = useState(() => {
    return targetItem?.assignedMembers && targetItem.assignedMembers.length > 0
      ? targetItem.assignedMembers
      : [{ name: '', code: '' }];
  });

  React.useEffect(() => {
    if (targetItem) {
      if (targetItem.assignedMembers && targetItem.assignedMembers.length > 0) {
        setMembers(targetItem.assignedMembers);
      } else {
        setMembers([{ name: '', code: '' }]);
      }
    }
  }, [targetItem, isOpen]);

  if (!isOpen || !targetItem) return null;

  const handleMemberChange = (index, field, value) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    setMembers(updated);
  };

  const handleAddMemberRow = () => {
    if (members.length < 5) {
      setMembers([...members, { name: '', code: '' }]);
    }
  };

  const handleRemoveMemberRow = (index) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    } else {
      setMembers([{ name: '', code: '' }]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validMembers = members
      .map((m) => ({
        name: m.name.trim().toUpperCase(),
        code: m.code.trim().toUpperCase()
      }))
      .filter((m) => m.name && m.code);
    onSaveMembers(targetItem.id, validMembers);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
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
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Employee Details (2-3 Members)
            </span>
            {members.length < 5 && (
              <button
                type="button"
                onClick={handleAddMemberRow}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            )}
          </div>


          <div className="space-y-3">
            {members.map((member, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-slate-200 bg-[#F9FAFC] relative space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">
                    Employee #{idx + 1}
                  </span>
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMemberRow(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                      title="Remove employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-emerald-600" />
                      <span>Emp Name *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={member.name}
                      onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                      placeholder="e.g. Ramesh Verma"
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none placeholder-slate-400 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <IdCard className="w-3 h-3 text-emerald-600" />
                      <span>Emp ID *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={member.code}
                      onChange={(e) => handleMemberChange(idx, 'code', e.target.value)}
                      placeholder="e.g. GJ024108"
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none placeholder-slate-400 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            ))}
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
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Employees</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
