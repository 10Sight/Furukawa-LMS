import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, ChevronDown, User, Layers, Building2, UserPlus, Plus } from 'lucide-react';

export const CFT_TOPICS = [
  'Team Composition & Role',
  'Alignment & Goal Setting',
  'Communication Protocols',
  'Conflict Resolution',
  'Decision- Making Models'
];

export const CFT_MEMBERS = [];

export const AVAILABLE_CFT_EMPLOYEES = [];

export default function AddCFTModal({ isOpen, onClose, onAdd, defaultPlant = 'Gujrat' }) {
  const [topic, setTopic] = useState('');
  const [membersList, setMembersList] = useState(CFT_MEMBERS);
  const [selectedMemberCode, setSelectedMemberCode] = useState(CFT_MEMBERS[0]?.code || '');
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [memberNameInput, setMemberNameInput] = useState('');
  const [memberCodeInput, setMemberCodeInput] = useState('');
  const [plant, setPlant] = useState(defaultPlant === 'Unit' ? 'Gujrat' : defaultPlant);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [showAddEmpForm, setShowAddEmpForm] = useState(false);
  const [empNameInput, setEmpNameInput] = useState('');
  const [empCodeInput, setEmpCodeInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTopic('');
      setMembersList(CFT_MEMBERS);
      setSelectedMemberCode(CFT_MEMBERS[0]?.code || '');
      setShowAddMemberForm(false);
      setMemberNameInput('');
      setMemberCodeInput('');
      setPlant(defaultPlant === 'Unit' ? 'Gujrat' : defaultPlant);
      setAssignedEmployees([]);
      setShowAddEmpForm(false);
      setEmpNameInput('');
      setEmpCodeInput('');
    }
  }, [isOpen, defaultPlant]);

  if (!isOpen) return null;

  const handleAddMemberManual = () => {
    const trimmedName = memberNameInput.trim().toUpperCase();
    const trimmedCode = memberCodeInput.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) return;

    const existing = membersList.find((m) => m.code === trimmedCode);
    if (!existing) {
      const initials = trimmedName
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('');
      const newMember = {
        name: trimmedName,
        code: trimmedCode,
        email: `${trimmedCode.toLowerCase()}@fme-minda.co.in`,
        initials: initials || 'MB',
        avatarBg: 'bg-blue-100 text-blue-700'
      };
      setMembersList((prev) => [newMember, ...prev]);
      setSelectedMemberCode(trimmedCode);
    } else {
      setSelectedMemberCode(trimmedCode);
    }

    setMemberNameInput('');
    setMemberCodeInput('');
    setShowAddMemberForm(false);
  };

  const handleAddEmployeeManual = () => {
    const trimmedName = empNameInput.trim().toUpperCase();
    const trimmedCode = empCodeInput.trim().toUpperCase();
    if (!trimmedName || !trimmedCode) return;

    if (!assignedEmployees.some((item) => item.code === trimmedCode)) {
      setAssignedEmployees([...assignedEmployees, { name: trimmedName, code: trimmedCode }]);
    }
    setEmpNameInput('');
    setEmpCodeInput('');
    setShowAddEmpForm(false);
  };

  const handleRemoveEmployee = (index) => {
    setAssignedEmployees(assignedEmployees.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const memberObj = membersList.find((m) => m.code === selectedMemberCode) || membersList[0];
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newCFTItem = {
      id: `CFT-${Math.floor(100 + Math.random() * 900)}`,
      topic,
      description: `CFT guidelines and protocol compliance for: ${topic}`,
      plant: plant === 'Unit' ? 'Gujrat' : plant,
      scope: 'CFT',
      department: 'CFT',
      date: dateStr,
      time: timeStr,
      createdBy: {
        name: memberObj.name,
        code: memberObj.code,
        email: memberObj.email,
        avatarBg: memberObj.avatarBg,
        initials: memberObj.initials,
      },
      assignedMembers: assignedEmployees,
      isSelf: false,
    };

    onAdd(newCFTItem);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Add CFT</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a new CFT protocol and assign responsible team members
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Topic Manual Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Topic *</span>
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter topic name..."
              className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none placeholder-slate-400 shadow-2xs"
              id="cft-topic-input"
            />
          </div>

          {/* Members (Created By) with 'Add Member' button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Members (Created By) *</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                id="cft-add-member-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddMemberForm ? 'Close' : 'Add Member'}</span>
              </button>
            </div>

            {/* Expandable Add Member Form */}
            {showAddMemberForm && (
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                    Enter Member Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddMemberForm(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={memberNameInput}
                    onChange={(e) => setMemberNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMemberManual();
                      }
                    }}
                    placeholder="Member Name (e.g. Ramesh Verma)"
                    className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none placeholder-slate-400 shadow-2xs"
                    id="cft-manual-member-name"
                  />
                  <input
                    type="text"
                    value={memberCodeInput}
                    onChange={(e) => setMemberCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMemberManual();
                      }
                    }}
                    placeholder="Emp ID (e.g. GJ024108)"
                    className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none placeholder-slate-400 shadow-2xs"
                    id="cft-manual-member-code"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddMemberForm(false)}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMemberManual}
                    disabled={!memberNameInput.trim() || !memberCodeInput.trim()}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    Save Member
                  </button>
                </div>
              </div>
            )}

            {/* Select Dropdown of Members */}
            <div className="relative">
              <select
                value={selectedMemberCode}
                onChange={(e) => setSelectedMemberCode(e.target.value)}
                className="w-full appearance-none text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none pr-10 shadow-2xs"
                id="cft-members-select"
                required
              >
                {membersList.map((member) => (
                  <option key={member.code} value={member.code}>
                    {member.name} ({member.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Assigned Employees Section - Kept only '+ Add Employee' button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Assigned Employees</span>
              </label>
              <button
                type="button"
                onClick={() => setShowAddEmpForm(!showAddEmpForm)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer shadow-2xs"
                id="cft-add-employee-btn"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddEmpForm ? 'Close' : 'Add Employee'}</span>
              </button>
            </div>

            {/* Expandable Add Employee Form */}
            {showAddEmpForm && (
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                    Enter Employee Details
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddEmpForm(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={empNameInput}
                    onChange={(e) => setEmpNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEmployeeManual();
                      }
                    }}
                    placeholder="Emp Name (e.g. Ramesh Verma)"
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none shadow-2xs"
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={empCodeInput}
                      onChange={(e) => setEmpCodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmployeeManual();
                        }
                      }}
                      placeholder="Emp ID (e.g. GJ024108)"
                      className="w-full text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddEmployeeManual}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shrink-0 cursor-pointer shadow-2xs transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Display Assigned Employees Chips (Matching table style) */}
            <div className="flex flex-wrap gap-1.5 items-center min-h-[38px] p-2 rounded-xl bg-[#F8FAFC] border border-slate-200">
              {assignedEmployees.length > 0 ? (
                assignedEmployees.map((emp, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 shadow-2xs animate-in fade-in zoom-in-95 duration-150"
                  >
                    <span className="font-semibold text-emerald-800">{emp.name}</span>
                    <span className="font-mono text-[9px] text-emerald-600 bg-white px-1.5 py-0.5 rounded border border-emerald-100">
                      {emp.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmployee(i)}
                      className="text-slate-400 hover:text-rose-600 ml-0.5 p-0.5 rounded transition-colors cursor-pointer"
                      title="Remove employee"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  No employees added yet. Click &quot;Add Employee&quot; above to assign team members.
                </span>
              )}
            </div>
          </div>

          {/* Plant Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unit *</span>
            </label>
            <div className="relative">
              <select
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                className="w-full appearance-none text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none pr-10 shadow-2xs"
              >
                <option value="Gujrat">Gujrat</option>
                <option value="Bawal">Bawal</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
