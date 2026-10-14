/**
 * Verified Master Employee Database and Matching Utilities
 * Used to link Department and Staff Name in the Responsible Person Confirmation section
 * of the PDCA form.
 */

export const VERIFIED_EMPLOYEE_MASTER = [];

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
