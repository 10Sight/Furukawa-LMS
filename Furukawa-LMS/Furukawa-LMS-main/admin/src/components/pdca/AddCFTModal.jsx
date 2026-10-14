import { readSaved } from '@components/shared/formPersistence';
import { usePDCAAutosave as useFormAutosave } from '@hooks/pdca/usePDCAAutosave.js';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, ChevronDown, User, Layers, Building2, UserPlus, ShieldCheck, Info } from 'lucide-react';
import { createDefaultRows } from '../../pages/pdca/data/pdcaStore.js';
import { VERIFIED_EMPLOYEE_MASTER } from '../../pages/pdca/data/pdcaEmployees.js';
import SearchableEmployeeSelect from './SearchableEmployeeSelect.jsx';
import { safeRandomUUID } from '../../utils/uuid.js';
import pdcaApi from '@/services/api/pdcaApi.js';

export const CFT_TOPICS = [];
export const CFT_MEMBERS = [];
export const AVAILABLE_CFT_EMPLOYEES = [];

export default function AddCFTModal({ isOpen, onClose, onAdd, defaultPlant = 'Bawal' }) {
  const [topic, setTopic] = useState('');
  const [employeesList, setEmployeesList] = useState(VERIFIED_EMPLOYEE_MASTER || []);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeFetchError, setEmployeeFetchError] = useState(null);

  // Independent Selection States:
  // 1. Selected Member (Lead Member / Mentor)
  const [selectedMember, setSelectedMember] = useState(null);

  // 2. Member Department (Derived strictly from selectedMember's database record, NOT from any employee)
  const [memberDepartment, setMemberDepartment] = useState('');

  // 3. Assigned Employees (Team members being mentored / collaborating)
  const [assignedEmployees, setAssignedEmployees] = useState([]);

  // 4. Unit / Plant (Defaults to Bawal)
  const initialPlant = (!defaultPlant || defaultPlant === 'Unit' || defaultPlant === 'All Plants') ? 'Bawal' : defaultPlant;
  const [plant, setPlant] = useState(initialPlant);

  // Fetch verified employees from live database metadata API
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
            .join(''),
          avatarBg: 'bg-blue-100 text-blue-700'
        }));
        setEmployeesList(formatted);
      } else if (VERIFIED_EMPLOYEE_MASTER && VERIFIED_EMPLOYEE_MASTER.length > 0) {
        setEmployeesList(VERIFIED_EMPLOYEE_MASTER);
      }
    } catch (err) {
      console.warn('Could not load employees from API in AddCFTModal, using verified master:', err);
      if (VERIFIED_EMPLOYEE_MASTER && VERIFIED_EMPLOYEE_MASTER.length > 0) {
        setEmployeesList(VERIFIED_EMPLOYEE_MASTER);
      } else {
        setEmployeeFetchError(err?.message || 'Failed to fetch employee list');
      }
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen, fetchEmployees]);

  // Synchronize draft and defaults on open
  useEffect(() => {
    if (isOpen) {
      const draftKey = `pdca_cft_draft_${defaultPlant || 'Bawal'}`;
      const draft = readSaved(draftKey, {});
      setTopic(draft.topic || '');

      const resolvedPlant = draft.plant || ((!defaultPlant || defaultPlant === 'Unit') ? 'Bawal' : defaultPlant);
      setPlant(resolvedPlant);

      // Restore selected member if in draft
      if (draft.selectedMember && typeof draft.selectedMember === 'object') {
        setSelectedMember(draft.selectedMember);
        setMemberDepartment(draft.selectedMember.department || 'Department not assigned');
      } else if (draft.selectedMemberCode && employeesList.length > 0) {
        const found = employeesList.find((e) => (e.code || e.id) === draft.selectedMemberCode);
        if (found) {
          setSelectedMember(found);
          setMemberDepartment(found.department || 'Department not assigned');
        }
      }

      // Restore assigned employees if in draft
      if (Array.isArray(draft.assignedEmployees)) {
        setAssignedEmployees(draft.assignedEmployees);
      }
    }
  }, [isOpen, defaultPlant, employeesList]);

  // Autosave draft
  const draftState = useMemo(() => ({
    topic,
    selectedMember,
    selectedMemberCode: selectedMember?.code || selectedMember?.id || '',
    plant,
    memberDepartment,
    assignedEmployees
  }), [topic, selectedMember, plant, memberDepartment, assignedEmployees]);

  useFormAutosave(
    draftState,
    (value) => {
      try {
        localStorage.setItem(`pdca_cft_draft_${defaultPlant || 'Bawal'}`, JSON.stringify(value));
      } catch {}
    },
    isOpen,
    (message) => window.alert(message)
  );

  if (!isOpen) return null;

  // ----------------------------------------------------
  // CRITICAL BUSINESS RULE HANDLERS:
  // Member and Employee selection are strictly independent!
  // ----------------------------------------------------

  // 1. Changing Member -> Updates Member Department to Member's database department.
  //    Does NOT touch Assigned Employees.
  const handleMemberChange = (member) => {
    setSelectedMember(member);
    if (member) {
      const dept = (member.department || '').trim();
      setMemberDepartment(dept || 'Department not assigned');
    } else {
      setMemberDepartment('');
    }
  };

  // 2. Selecting an Employee to assign -> Adds to assignedEmployees list.
  //    Does NOT touch Selected Member or Member Department!
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

  // 3. Removing an assigned employee -> Does NOT touch Selected Member or Member Department!
  const handleRemoveEmployee = (indexToRemove) => {
    setAssignedEmployees((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Exclude codes from employee dropdown so we don't pick the same member or already-assigned employees
  const excludeFromEmployees = [
    selectedMember?.code,
    selectedMember?.id,
    ...assignedEmployees.map((e) => e.code || e.id)
  ].filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) {
      window.alert('Please enter a CFT topic name.');
      return;
    }
    if (!selectedMember) {
      window.alert('Please select a Member (CFT Lead / Mentor).');
      return;
    }

    const authoritativeMemberDept = selectedMember.department
      ? selectedMember.department.trim()
      : 'Department not assigned';

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newCFTItem = {
      id: `CFT-${safeRandomUUID()}`,
      topic: topic.trim(),
      description: `CFT guidelines and protocol compliance for: ${topic.trim()}`,
      plant: plant === 'Unit' ? 'Bawal' : (plant || 'Bawal'),
      scope: 'CFT',
      // CRITICAL: CFT Department always comes from the selected Member's database record!
      department: authoritativeMemberDept,
      memberDepartment: authoritativeMemberDept,
      date: dateStr,
      time: timeStr,
      createdBy: {
        id: selectedMember.id,
        name: selectedMember.name,
        code: selectedMember.code,
        department: authoritativeMemberDept,
        email: selectedMember.email || '',
        avatarBg: selectedMember.avatarBg || 'bg-emerald-100 text-emerald-700',
        initials: selectedMember.initials || (selectedMember.name ? selectedMember.name.split(' ').map((n) => n[0]).join('') : 'CL')
      },
      // Preserve each assigned employee's own department independently
      assignedMembers: assignedEmployees.map((emp) => ({
        id: emp.id,
        name: emp.name,
        code: emp.code,
        department: emp.department || 'Department not assigned'
      })),
      isSelf: false,
      sheet: {
        headerInfo: {
          topicName: topic.trim(),
          preparedBy: selectedMember.name,
          auditNo: '',
          attendees: assignedEmployees.map((e) => e.name).join(', ')
        },
        rows: createDefaultRows(10)
      }
    };

    try {
      onAdd(newCFTItem);
      try {
        localStorage.removeItem(`pdca_cft_draft_${defaultPlant || 'Bawal'}`);
      } catch {}
      onClose();
    } catch (error) {
      window.alert(error.message || 'Could not save CFT. Please try again.');
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Add CFT</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a new CFT protocol with database-driven Member and Employee selection
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
          {/* 1. Topic Input */}
          <div>
            <label htmlFor="cft-topic-input" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>CFT Topic *</span>
            </label>
            <input
              id="cft-topic-input"
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter CFT topic name (e.g. Alignment & Goal Setting)..."
              className="w-full text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none placeholder-slate-400 shadow-2xs"
            />
          </div>

          {/* 2. Member Selection (Searchable Database Dropdown) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Member (CFT Lead / Mentor) *</span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">
                Department source of truth
              </span>
            </label>

            <SearchableEmployeeSelect
              id="cft-member-select"
              employees={employeesList}
              value={selectedMember}
              onChange={handleMemberChange}
              placeholder="Search member by Name, Employee ID, or Department..."
              isLoading={loadingEmployees}
              error={employeeFetchError}
              onRetry={fetchEmployees}
              required
            />
          </div>

          {/* 3. CFT Member Department (Derived directly from selected Member) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>CFT Member Department *</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Derived from Member
              </span>
            </label>
            <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-sm shadow-2xs">
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${memberDepartment && memberDepartment !== 'Department not assigned' ? 'text-emerald-800' : 'text-slate-500 italic'}`}>
                  {memberDepartment || 'Select a Member above to populate department'}
                </span>
              </div>
              {selectedMember && (
                <span className="text-[11px] text-slate-400 font-mono">
                  [{selectedMember.code || selectedMember.id}]
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-400 shrink-0" />
              <span>For CFT, guidance department comes exclusively from the selected Member&apos;s record, not from the Employee&apos;s department.</span>
            </p>
          </div>

          {/* 4. Assigned Employees (Searchable Database Dropdown) */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Assigned Employees ({assignedEmployees.length})</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Independent team members
              </span>
            </div>

            {/* Searchable dropdown to search & add employees */}
            <SearchableEmployeeSelect
              id="cft-employee-select"
              employees={employeesList}
              value={null}
              onChange={handleAddEmployee}
              placeholder="Search and add employee to CFT team..."
              clearOnSelect={true}
              excludeCodes={excludeFromEmployees}
              isLoading={loadingEmployees}
              error={employeeFetchError}
              onRetry={fetchEmployees}
            />

            {/* Added Employees Chips List */}
            <div className="flex flex-wrap gap-1.5 items-center min-h-[38px] p-2 rounded-xl bg-[#F8FAFC] border border-slate-200">
              {assignedEmployees.length > 0 ? (
                assignedEmployees.map((emp, i) => (
                  <div
                    key={emp.code || emp.id || i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 shadow-2xs animate-in fade-in zoom-in-95 duration-150"
                  >
                    <span className="font-semibold text-slate-800">{emp.name}</span>
                    {emp.code && (
                      <span className="font-mono text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {emp.code}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {emp.department || 'Department not assigned'}
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
                  No employees assigned yet. Search and select above to add team members.
                </span>
              )}
            </div>
          </div>

          {/* 5. Plant / Unit Selection (Default to Bawal) */}
          <div className="pt-1 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unit * (Default: Bawal)</span>
            </label>
            <div className="relative">
              <select
                value={plant}
                onChange={(e) => setPlant(e.target.value)}
                className="w-full appearance-none text-sm font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none pr-10 shadow-2xs"
                id="cft-unit-select"
              >
                <option value="Bawal">Bawal</option>
                <option value="Gujrat">Gujrat</option>
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
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer font-medium"
              id="cft-save-btn"
            >
              <span>Save CFT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
