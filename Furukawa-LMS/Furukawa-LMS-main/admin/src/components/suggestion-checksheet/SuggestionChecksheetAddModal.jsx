import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FilePlus, Search, ChevronDown, Check } from 'lucide-react';
import { useGetAllDepartmentsQuery } from "@/services/api/DepartmentApi.js";
import { useGetSectionsByDepartmentQuery } from "@/services/api/SectionApi.js";
import { useGetLinesBySectionQuery } from "@/services/api/LineApi.js";
import { useGetAllUsersQuery } from "@/services/api/UserApi.js";

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
  // Lock body scroll while modal is open to prevent page behind modal from scrolling
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

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

  // Search bar dropdown states for Employee Name / ID
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const employeeDropdownRef = useRef(null);

  // Close employee dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setIsEmployeeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 1. Fetch departments from database
  const { data: deptData } = useGetAllDepartmentsQuery({ limit: 200 }, { skip: !isOpen });
  const departments = useMemo(() => {
    const list = deptData?.data?.departments || deptData?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((d) => ({
          id: String(d._id || d.id || ''),
          name: String(d.name || d.departmentName || d.deptName || (typeof d === 'string' ? d : '')),
        }))
        .filter((d) => Boolean(d.name));
    }
    return FALLBACK_DEPARTMENTS.map((name, idx) => ({ id: `dept-${idx}`, name: String(name) }));
  }, [deptData]);

  // 2. Fetch sections by selected department
  const selectedDeptId = useMemo(() => {
    if (formData.departmentId) return String(formData.departmentId);
    const found = departments.find((d) => d.name === formData.department);
    return found ? String(found.id) : '';
  }, [departments, formData.department, formData.departmentId]);

  const { data: sectionData } = useGetSectionsByDepartmentQuery(selectedDeptId, {
    skip: !isOpen || !selectedDeptId || selectedDeptId.startsWith('dept-'),
  });

  const sections = useMemo(() => {
    const list = sectionData?.data?.sections || sectionData?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((s) => ({
          id: String(s._id || s.id || ''),
          name: String(s.name || s.sectionName || (typeof s === 'string' ? s : '')),
        }))
        .filter((s) => Boolean(s.name));
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
    if (formData.sectionId) return String(formData.sectionId);
    const found = sections.find((s) => s.name === formData.section);
    return found ? String(found.id) : '';
  }, [sections, formData.section, formData.sectionId]);

  const { data: lineData } = useGetLinesBySectionQuery(selectedSectionId, {
    skip: !isOpen || !selectedSectionId || selectedSectionId.startsWith('sec-'),
  });

  const lines = useMemo(() => {
    const list = lineData?.data?.lines || lineData?.data || [];
    if (Array.isArray(list) && list.length > 0) {
      return list
        .map((l) => ({
          id: String(l._id || l.id || ''),
          name: String(l.name || l.lineName || (typeof l === 'string' ? l : '')),
        }))
        .filter((l) => Boolean(l.name));
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

  // 4. Fetch real employees exclusively from database
  const { data: usersData, isLoading: isLoadingUsers } = useGetAllUsersQuery(
    { limit: 10000, ignoreShutter: "true", includeTemporary: "true", includeLeft: "true", includeDeleted: "false" },
    { skip: !isOpen }
  );

  const employeeOptions = useMemo(() => {
    const rawUsers = usersData?.data?.users || usersData?.data || [];
    if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
      return [];
    }

    const list = rawUsers.map((u) => {
      const name = u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Employee';
      const code = u.empId || u.employeeId || u.staffId || u.userName || u.code || '';

      // Resolve department strictly as a clean string!
      let resolvedDept = '';
      if (typeof u.deptName === 'string') {
        resolvedDept = u.deptName;
      } else if (typeof u.departmentName === 'string') {
        resolvedDept = u.departmentName;
      } else if (typeof u.department === 'string') {
        resolvedDept = u.department;
      } else if (u.department && typeof u.department === 'object') {
        resolvedDept = u.department.name || u.department.deptName || u.department.title || '';
      }

      const deptId = u.actualDeptId || (typeof u.department === 'number' ? u.department : u.departmentId || '');

      return {
        id: String(u._id || u.id || `emp-${code || Math.random()}`),
        name: String(name),
        code: String(code),
        unit: String(u.unit || ''),
        department: String(resolvedDept || ''),
        deptId: deptId ? String(deptId) : '',
        displayText: code ? `${name} (${code})` : String(name),
      };
    });

    // Return all employees from database so every employee is visible and searchable
    return list;
  }, [usersData]);

  // Filter employee options by search term
  const filteredEmployeeOptions = useMemo(() => {
    if (!employeeSearchTerm.trim()) return employeeOptions;
    const q = employeeSearchTerm.toLowerCase().trim();
    return employeeOptions.filter((emp) => {
      const matchName = String(emp.name || '').toLowerCase().includes(q);
      const matchCode = String(emp.code || '').toLowerCase().includes(q);
      const matchDept = String(emp.department || '').toLowerCase().includes(q);
      const matchDisplay = String(emp.displayText || '').toLowerCase().includes(q);
      return matchName || matchCode || matchDept || matchDisplay;
    });
  }, [employeeOptions, employeeSearchTerm]);

  if (!isOpen) return null;

  // Handle department selection with automatic section and line reset
  const handleDepartmentChange = (e) => {
    const deptName = String(e.target.value || '');
    const found = departments.find((d) => d.name === deptName);
    setFormData((prev) => ({
      ...prev,
      department: deptName,
      departmentId: found ? String(found.id) : '',
      section: '',
      sectionId: '',
      lineArea: '',
      lineAreaId: '',
    }));
  };

  // Handle section selection with automatic line reset
  const handleSectionChange = (e) => {
    const secName = String(e.target.value || '');
    const found = sections.find((s) => s.name === secName);
    setFormData((prev) => ({
      ...prev,
      section: secName,
      sectionId: found ? String(found.id) : '',
      lineArea: '',
      lineAreaId: '',
    }));
  };

  // Handle line selection
  const handleLineChange = (e) => {
    const lineName = String(e.target.value || '');
    const found = lines.find((l) => l.name === lineName);
    setFormData((prev) => ({
      ...prev,
      lineArea: lineName,
      lineAreaId: found ? String(found.id) : '',
    }));
  };

  // Handle employee selection from search dropdown safely
  const handleSelectEmployee = (emp) => {
    try {
      setIsCustomEmployee(false);
      const submittedByText = String(emp?.displayText || emp?.name || '').trim();

      let matchedDeptName = '';
      let matchedDeptId = '';

      if (emp) {
        const empDeptStr = String(emp.department || '').trim();
        const empDeptIdStr = String(emp.deptId || '').trim();

        // If department is not yet selected in the form, try to find matching department from DB list
        if (!formData.department) {
          const found = departments.find((d) => {
            const dName = String(d?.name || '').trim().toLowerCase();
            const dId = String(d?.id || '').trim();
            if (empDeptStr && dName && dName === empDeptStr.toLowerCase()) return true;
            if (empDeptIdStr && dId && dId === empDeptIdStr) return true;
            return false;
          });

          if (found) {
            matchedDeptName = String(found.name);
            matchedDeptId = String(found.id);
          } else if (empDeptStr && isNaN(Number(empDeptStr))) {
            matchedDeptName = empDeptStr;
          }
        }
      }

      setFormData((prev) => ({
        ...prev,
        submittedBy: submittedByText,
        ...(matchedDeptName ? { department: matchedDeptName, departmentId: matchedDeptId } : {}),
      }));
    } catch (err) {
      console.error('Error selecting employee:', err);
      setFormData((prev) => ({
        ...prev,
        submittedBy: String(emp?.displayText || emp?.name || ''),
      }));
    } finally {
      setIsEmployeeDropdownOpen(false);
      setEmployeeSearchTerm('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalSubmittedBy = String(
      isCustomEmployee ? customEmployeeText : formData.submittedBy
    ).trim();

    const unitStr = String(formData.unit || 'Bawal').trim();
    const generatedId = `SC-${unitStr.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord = {
      id: generatedId,
      date: formData.date || new Date().toISOString().split('T')[0],
      unit: unitStr,
      department: String(formData.department || '').trim(),
      section: String(formData.section || '').trim(),
      lineArea: String(formData.lineArea || '').trim(),
      title: finalSubmittedBy
        ? `${finalSubmittedBy} - Suggestion`
        : `Suggestion Sheet (${generatedId})`,
      description: '',
      problemText: '',
      suggestionText: '',
      category: '',
      submittedBy: finalSubmittedBy,
      employeeCode: String(formData.lineArea || '').trim(),
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
    setIsEmployeeDropdownOpen(false);
    setEmployeeSearchTerm('');
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full my-auto max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95"
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

            {/* 2. Employee Name / ID (Search Bar Dropdown) */}
            <div ref={employeeDropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">Employee Name / ID</label>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                  onClick={() => {
                    setIsCustomEmployee(!isCustomEmployee);
                    setIsEmployeeDropdownOpen(false);
                  }}
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
                    const val = e.target.value;
                    setCustomEmployeeText(val);
                    setFormData((prev) => ({ ...prev, submittedBy: val }));
                  }}
                  autoFocus
                />
              ) : (
                <div className="relative">
                  {/* Dropdown Trigger Box */}
                  <button
                    type="button"
                    onClick={() => setIsEmployeeDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-left transition-colors cursor-pointer"
                  >
                    <span className={`truncate text-xs ${formData.submittedBy ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                      {formData.submittedBy || '-- Select Employee from Database --'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {formData.submittedBy && (
                        <span
                          role="button"
                          tabIndex={0}
                          className="p-0.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData((prev) => ({ ...prev, submittedBy: '' }));
                          }}
                          title="Clear selection"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                          isEmployeeDropdownOpen ? 'rotate-180 text-blue-600' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Menu with Search Bar */}
                  {isEmployeeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      {/* Search Bar Input */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                        <div className="relative flex items-center">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                          <input
                            type="text"
                            autoFocus
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="Search by employee name or ID..."
                            value={employeeSearchTerm}
                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {employeeSearchTerm && (
                            <button
                              type="button"
                              className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEmployeeSearchTerm('');
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Employee List */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                        {isLoadingUsers ? (
                          <div className="px-4 py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            <span>Loading employees from database...</span>
                          </div>
                        ) : filteredEmployeeOptions.length > 0 ? (
                          filteredEmployeeOptions.map((emp) => {
                            const isSelected = formData.submittedBy === emp.displayText;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => handleSelectEmployee(emp)}
                                className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-blue-50 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-blue-50/80 font-semibold text-blue-700' : 'text-slate-700'
                                }`}
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span className="truncate">{emp.displayText}</span>
                                  {emp.department ? (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      Dept: {String(emp.department)}
                                    </span>
                                  ) : null}
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-6 text-center text-xs text-slate-400">
                            {employeeSearchTerm
                              ? `No employees found matching "${employeeSearchTerm}"`
                              : 'No employees found in database'}
                          </div>
                        )}

                        {/* Custom Option at Bottom */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomEmployee(true);
                            setIsEmployeeDropdownOpen(false);
                            setCustomEmployeeText(employeeSearchTerm);
                            setFormData((prev) => ({ ...prev, submittedBy: employeeSearchTerm }));
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 font-medium border-t border-slate-100 flex items-center gap-1.5 cursor-pointer bg-slate-50/50"
                        >
                          <span>+ Enter custom employee</span>
                          {employeeSearchTerm ? ` "${employeeSearchTerm}"` : '...'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
