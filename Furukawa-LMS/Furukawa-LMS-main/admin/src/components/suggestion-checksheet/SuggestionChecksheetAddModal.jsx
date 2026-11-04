import React, { useState, useMemo, useEffect } from 'react';
import { X, FilePlus } from 'lucide-react';
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
import { useGetLinesBySectionQuery } from "@/services/api/LineApi.js";
import { useGetAllUsersQuery } from "@/services/api/UserApi.js";
import { VERIFIED_EMPLOYEE_MASTER } from "@/pages/pdca/data/pdcaEmployees.js";

const FALLBACK_DEPARTMENTS = [
  'Production',
  'Quality',
  'PE',
  'Maintenance',
  'Warehouse & Logistics',
  'Press & Stamping',
  'HR',
  'IT',
  'Safety',
  'D&D',
  'Store',
  'C&C'
];

export default function SuggestionChecksheetAddModal({ isOpen, onClose, onAdd, defaultUnit = 'Bawal' }) {
  const [formData, setFormData] = useState({
    unit: defaultUnit && defaultUnit !== 'All Units' ? defaultUnit : 'Bawal',
    submittedBy: '',
    department: '',
    departmentId: '',
    section: '',
    sectionId: '',
    lineArea: '',
    lineAreaId: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const [isCustomEmployee, setIsCustomEmployee] = useState(false);
  const [customEmployeeText, setCustomEmployeeText] = useState('');

  // 1. Fetch departments from database
  const { data: deptData } = useGetAllDepartmentsQuery({ limit: 200 }, { skip: !isOpen });
  const departments = useMemo(() => {
    const list = deptData?.data?.departments || deptData?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list.map((d) => ({
        id: d._id || d.id,
        name: d.name || d.departmentName || String(d),
      }));
    }
    return FALLBACK_DEPARTMENTS.map((name, idx) => ({ id: `dept-${idx}`, name }));
  }, [deptData]);

  // 2. Fetch sections by selected department
  const selectedDeptId = useMemo(() => {
    if (formData.departmentId) return formData.departmentId;
    const found = departments.find((d) => d.name === formData.department);
    return found ? found.id : '';
  }, [departments, formData.department, formData.departmentId]);

  const { data: sectionData } = useGetSectionsByDepartmentQuery(selectedDeptId, {
    skip: !isOpen || !selectedDeptId || selectedDeptId.startsWith('dept-'),
  });

  const sections = useMemo(() => {
    const list = sectionData?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list.map((s) => ({
        id: s._id || s.id,
        name: s.name || s.sectionName || String(s),
      }));
    }
    // Fallback common sections if department selected
    if (formData.department) {
      return [
        { id: 'sec-1', name: 'Main Assembly' },
        { id: 'sec-2', name: 'Sub Assembly' },
        { id: 'sec-3', name: 'Inspection' },
        { id: 'sec-4', name: 'Testing Bay' },
      ];
    }
    return [];
  }, [sectionData, formData.department]);

  // 3. Fetch lines by selected section
  const selectedSectionId = useMemo(() => {
    if (formData.sectionId) return formData.sectionId;
    const found = sections.find((s) => s.name === formData.section);
    return found ? found.id : '';
  }, [sections, formData.section, formData.sectionId]);

  const { data: lineData } = useGetLinesBySectionQuery(selectedSectionId, {
    skip: !isOpen || !selectedSectionId || selectedSectionId.startsWith('sec-'),
  });

  const lines = useMemo(() => {
    const list = lineData?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list.map((l) => ({
        id: l._id || l.id,
        name: l.name || l.lineName || String(l),
      }));
    }
    // Fallback lines if section selected
    if (formData.section) {
      return [
        { id: 'line-1', name: 'Assembly Line 1' },
        { id: 'line-2', name: 'Assembly Line 2' },
        { id: 'line-3', name: 'Press Line #4' },
        { id: 'line-4', name: 'Testing Bay #2' },
      ];
    }
    return [];
  }, [lineData, formData.section]);

  // 4. Fetch employees from database (filtered by unit)
  const { data: usersData } = useGetAllUsersQuery(
    { limit: 500, unit: formData.unit !== 'All Units' ? formData.unit : undefined },
    { skip: !isOpen }
  );

  const employeeOptions = useMemo(() => {
    const rawUsers = usersData?.data?.users || usersData?.data || [];
    let list = [];

    if (Array.isArray(rawUsers) && rawUsers.length > 0) {
      list = rawUsers.map((u) => {
        const name = u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Employee';
        const code = u.employeeId || u.staffId || u.userName || u.code || '';
        const dept = u.department?.name || u.department || '';
        return {
          id: u._id || u.id,
          name,
          code,
          unit: u.unit || 'Bawal',
          department: dept,
          displayText: code ? `${name} (${code})` : name,
        };
      });
    } else {
      // Fallback verified employees
      list = VERIFIED_EMPLOYEE_MASTER.map((u) => ({
        id: u.id,
        name: u.name,
        code: u.code,
        unit: u.unit || 'Bawal',
        department: u.department || '',
        displayText: `${u.name} (${u.code})`,
      }));
    }

    // Filter by selected unit if set
    if (formData.unit && formData.unit !== 'All Units') {
      return list.filter((e) => !e.unit || e.unit.toLowerCase() === formData.unit.toLowerCase());
    }
    return list;
  }, [usersData, formData.unit]);

  if (!isOpen) return null;

  // Handle department selection with automatic section and line reset
  const handleDepartmentChange = (e) => {
    const deptName = e.target.value;
    const found = departments.find((d) => d.name === deptName);
    setFormData((prev) => ({
      ...prev,
      department: deptName,
      departmentId: found ? found.id : '',
      section: '',
      sectionId: '',
      lineArea: '',
      lineAreaId: '',
    }));
  };

  // Handle section selection with automatic line reset
  const handleSectionChange = (e) => {
    const secName = e.target.value;
    const found = sections.find((s) => s.name === secName);
    setFormData((prev) => ({
      ...prev,
      section: secName,
      sectionId: found ? found.id : '',
      lineArea: '',
      lineAreaId: '',
    }));
  };

  // Handle line selection
  const handleLineChange = (e) => {
    const lineName = e.target.value;
    const found = lines.find((l) => l.name === lineName);
    setFormData((prev) => ({
      ...prev,
      lineArea: lineName,
      lineAreaId: found ? found.id : '',
    }));
  };

  // Handle employee selection
  const handleEmployeeSelect = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomEmployee(true);
      setFormData((prev) => ({ ...prev, submittedBy: customEmployeeText }));
    } else {
      setIsCustomEmployee(false);
      setFormData((prev) => ({ ...prev, submittedBy: val }));
      // If employee has a known department and current dept is empty, prefill
      const matched = employeeOptions.find((emp) => emp.displayText === val);
      if (matched && matched.department && !formData.department) {
        setFormData((prev) => ({ ...prev, department: matched.department }));
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalSubmittedBy = isCustomEmployee ? customEmployeeText.trim() : formData.submittedBy.trim();
    const generatedId = `SC-${(formData.unit || 'BWL').substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord = {
      id: generatedId,
      date: formData.date || new Date().toISOString().split('T')[0],
      unit: formData.unit || 'Bawal',
      department: formData.department.trim(),
      section: formData.section.trim(),
      lineArea: formData.lineArea.trim(),
      title: finalSubmittedBy
        ? `${finalSubmittedBy} - Suggestion`
        : `Suggestion Sheet (${generatedId})`,
      description: '',
      problemText: '',
      suggestionText: '',
      category: '',
      submittedBy: finalSubmittedBy,
      employeeCode: formData.lineArea.trim(),
      status: 'Pending',
      priority: 'Medium',
      isBlank: true,
      rejectedAccepted: '',
      reasonIfRejected: '',
      targetDate: '',
      dateOfImplementation: '',
      lineLeaderSign1: '',
      lineLeaderSign2: '',
      approvalDate: '',
      costSaving: '',
      benefitDetails: '',
      benefitStatusDetails: '',
    };

    onAdd(newRecord);
    onClose();

    // Reset form to blank
    setFormData({
      unit: defaultUnit && defaultUnit !== 'All Units' ? defaultUnit : 'Bawal',
      submittedBy: '',
      department: '',
      departmentId: '',
      section: '',
      sectionId: '',
      lineArea: '',
      lineAreaId: '',
      date: new Date().toISOString().slice(0, 10),
    });
    setIsCustomEmployee(false);
    setCustomEmployeeText('');
  };

  return (
    <div
      className="fixed inset-0 z-[1060] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 leading-tight">Create Suggestion Checksheet</h3>
              <p className="text-xs text-slate-500">Select employee and cascading department hierarchy</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form - Contains only: Plant Unit, Employee Name/ID, Department, Section, Line/Area, Date */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Plant Unit */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Plant Unit *</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              >
                <option value="Bawal">Bawal</option>
                <option value="Gujrat">Gujrat</option>
              </select>
            </div>

            {/* 2. Employee Name / ID (Fetched from Database) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Employee Name / ID</label>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  onClick={() => setIsCustomEmployee(!isCustomEmployee)}
                >
                  {isCustomEmployee ? 'Select from list' : '+ Enter custom'}
                </button>
              </div>

              {isCustomEmployee ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Enter custom employee name or ID..."
                  value={customEmployeeText}
                  onChange={(e) => {
                    setCustomEmployeeText(e.target.value);
                    setFormData((prev) => ({ ...prev, submittedBy: e.target.value }));
                  }}
                  autoFocus
                />
              ) : (
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  value={formData.submittedBy}
                  onChange={handleEmployeeSelect}
                >
                  <option value="">-- Select Employee from Database --</option>
                  {employeeOptions.map((emp) => (
                    <option key={emp.id} value={emp.displayText}>
                      {emp.displayText} {emp.department ? `[${emp.department}]` : ''}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Employee...</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 3. Department (Fetched from Database) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Department</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                value={formData.department}
                onChange={handleDepartmentChange}
              >
                <option value="">-- Select Department --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Section (Fetched by Department) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Section</label>
              <select
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                  !formData.department ? 'bg-slate-50 cursor-not-allowed opacity-75' : 'bg-white'
                }`}
                value={formData.section}
                onChange={handleSectionChange}
                disabled={!formData.department}
              >
                <option value="">
                  {formData.department ? '-- Select Section --' : 'Select Dept first'}
                </option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.name}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Line / Area (Fetched by Section) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Line / Area</label>
              <select
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                  !formData.section ? 'bg-slate-50 cursor-not-allowed opacity-75' : 'bg-white'
                }`}
                value={formData.lineArea}
                onChange={handleLineChange}
                disabled={!formData.section}
              >
                <option value="">
                  {formData.section ? '-- Select Line / Area --' : 'Select Section first'}
                </option>
                {lines.map((line) => (
                  <option key={line.id} value={line.name}>
                    {line.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Date with Calendar Picker */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Date *</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              Create Checksheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
