/**
 * Verified Master Employee Database and Matching Utilities
 * Used to link Department and Staff Name in the Responsible Person Confirmation section
 * of the PDCA form.
 */

export const VERIFIED_EMPLOYEE_MASTER = [
  { id: 'emp-as081213', name: 'Yogesh Kumar', code: 'AS081213', department: 'PE', email: 'aso81213@fme-minda.co.in' },
  { id: 'emp-gj034112', name: 'Vikram Singh', code: 'GJ034112', department: 'PE', email: 'v.singh@fme-minda.co.in' },
  { id: 'emp-gj045819', name: 'Deepak Mehta', code: 'GJ045819', department: 'Quality', email: 'd.mehta@fme-minda.co.in' },
  { id: 'emp-bw041920', name: 'Rahul Sharma', code: 'BW041920', department: 'Assembly', email: 'r.sharma@fme-minda.co.in' },
  { id: 'emp-bw081290', name: 'Rajesh Kumar', code: 'BW081290', department: 'Maintenance', email: 'r.kumar@fme-minda.co.in' },
  { id: 'emp-bw039182', name: 'Pooja Nair', code: 'BW039182', department: 'Maintenance', email: 'p.nair@fme-minda.co.in' },
  { id: 'emp-gj092311', name: 'Amit Patel', code: 'GJ092311', department: 'Safety', email: 'amit.patel@fme-minda.co.in' },
  { id: 'emp-gj018442', name: 'Priya Nair', code: 'GJ018442', department: 'HR', email: 'priya.nair@fme-minda.co.in' },
  { id: 'emp-bw092301', name: 'Manish Joshi', code: 'BW092301', department: 'Maintenance', email: 'm.joshi@fme-minda.co.in' },
  { id: 'emp-st080014', name: 'Joy Dastidar', code: 'ST080014', department: 'D&D', email: 'st080014@furukawaminda.com' },
  { id: 'emp-bw019283', name: 'Sanjeev Verma', code: 'BW019283', department: 'Store', email: 's.verma@fme-minda.co.in' },
  { id: 'emp-gj058291', name: 'Anita Deshmukh', code: 'GJ058291', department: 'IT', email: 'a.deshmukh@fme-minda.co.in' }
];

/**
 * Parses employee input (e.g. "Deepak Mehta (GJ045819)") into separate name and code.
 * Safely handles whitespace and formatting differences.
 */
export const parseStaffEmployee = (input) => {
  if (!input) return { name: '', code: '' };
  if (typeof input === 'object') {
    return {
      name: (input.name || input.fullName || '').trim(),
      code: (input.code || input.empId || input.userName || '').trim()
    };
  }
  const trimmed = String(input).trim();
  const match = trimmed.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    return {
      name: match[1].trim(),
      code: match[2].trim()
    };
  }
  return {
    name: trimmed,
    code: ''
  };
};

/**
 * Finds the verified department for a given staff employee by matching Staff ID and Staff Name
 * against the provided employee database records.
 *
 * Matching Priority:
 * 1. Primary: Exact match on Staff ID / Code, verified against Staff Name.
 * 2. Secondary: If Staff ID is omitted, exact match on unique Staff Name.
 * 3. Ambiguous / Missing: Returns null (never guesses or assigns an arbitrary department).
 */
export const findEmployeeDepartment = (staffInput, employeeDatabase = []) => {
  if (!staffInput) return null;
  const { name, code } = parseStaffEmployee(staffInput);
  const cleanCode = code ? code.trim().toUpperCase() : '';
  const cleanName = name ? name.trim().toLowerCase() : '';

  if (!cleanCode && !cleanName) return null;

  const db = Array.isArray(employeeDatabase) && employeeDatabase.length > 0
    ? employeeDatabase
    : VERIFIED_EMPLOYEE_MASTER;

  // 1. Primary match using Staff ID / Code
  if (cleanCode) {
    const codeMatches = db.filter((emp) => {
      const empCode = (emp.code || emp.empId || emp.userName || emp.id || '').toString().trim().toUpperCase();
      return empCode === cleanCode;
    });

    if (codeMatches.length === 1) {
      return codeMatches[0].department || null;
    }

    if (codeMatches.length > 1) {
      // Multiple records with same code: disambiguate using name
      if (cleanName) {
        const exactMatch = codeMatches.find((emp) => {
          const empName = (emp.name || emp.fullName || '').toString().trim().toLowerCase();
          return empName === cleanName;
        });
        if (exactMatch) return exactMatch.department || null;
      }
      // Conflicting/ambiguous records: do not guess
      return null;
    }
  }

  // 2. Secondary match using unique Staff Name (only when unique)
  if (cleanName) {
    const nameMatches = db.filter((emp) => {
      const empName = (emp.name || emp.fullName || '').toString().trim().toLowerCase();
      return empName === cleanName;
    });

    if (nameMatches.length === 1) {
      return nameMatches[0].department || null;
    }
    // Ambiguous (multiple matches) or missing: do not guess
    return null;
  }

  return null;
};
