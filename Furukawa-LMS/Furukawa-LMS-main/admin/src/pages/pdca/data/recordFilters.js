import { PDCA_DEPARTMENTS } from './pdcaConstants.js';
export { PDCA_DEPARTMENTS };
export const PDCA_PLANTS = ['Bawal', 'Gujrat'];
export const ALL_UNITS_OPTION = 'All Unit';

export function matchesPlant(item, plant) {
  if (!plant) return false;
  const normalizedPlant = String(plant).trim().toLowerCase();
  if (
    normalizedPlant === 'all unit' ||
    normalizedPlant === 'all units' ||
    normalizedPlant === 'all plants'
  ) {
    return true;
  }
  if (!PDCA_PLANTS.some(p => p.toLowerCase() === normalizedPlant)) return false;
  const savedPlant = (item.plant || '').toLowerCase();
  // Previously created forms used All Plants; retain access without moving them.
  return savedPlant === normalizedPlant || savedPlant === 'all plants';
}

export function matchesDate(item, dateFilter) {
  if (!dateFilter || !String(dateFilter).trim()) return true;
  const target = String(dateFilter).trim(); // Expected format: YYYY-MM-DD
  const parts = target.split('-').map(Number);
  if (parts.length < 3) return true;
  const [ty, tm, td] = parts;

  // 1. Check item.date (e.g. '16 Oct 2026', '2026-10-16', '16/10/2026')
  if (item.date) {
    const raw = String(item.date).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      if (raw === target) return true;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === ty && (d.getMonth() + 1) === tm && d.getDate() === td) {
        return true;
      }
    }
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthName = months[tm - 1];
    const dayStr = String(td).padStart(2, '0');
    const daySimple = String(td);
    const low = raw.toLowerCase();
    if (low.includes(String(ty)) && low.includes(monthName) && (low.includes(dayStr) || low.includes(daySimple))) {
      return true;
    }
  }

  // 2. Check item.createdAt / item.sheet?.rows dates
  if (item.createdAt) {
    const d = new Date(item.createdAt);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() === ty && (d.getMonth() + 1) === tm && d.getDate() === td) {
        return true;
      }
    }
  }

  return false;
}

export function matchesDateRange(item, fromDate = '', toDate = '') {
  if (!fromDate && !toDate) return true;
  const raw = String(item?.date || item?.auditDate || item?.createdAt || '').trim();
  if (!raw) return false;
  let date;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (iso) date = `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  else if (dmy) date = `${dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
  else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return false;
    date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
}

export function filterPDCARecords(data, plant, scope, search = '', department = '', dateFilter = '', fromDate = '', toDate = '') {
  const query = search.toLowerCase().trim();
  const deptFilter = (department || '').toLowerCase().trim();
  return data.filter(item => matchesPlant(item, plant) &&
    (scope === 'Self PDCA' ? item.isSelf || item.scope === scope : item.scope === scope) &&
    (!deptFilter || (item.department || '').toLowerCase() === deptFilter) &&
    matchesDate(item, dateFilter) &&
    matchesDateRange(item, fromDate, toDate) &&
    (!query || [item.topic, item.description, item.id, item.department, item.createdBy?.name, item.createdBy?.code]
      .some(value => String(value || '').toLowerCase().includes(query))));
}
export const PDCA_SELECTED_UNIT_KEY = 'pdca_selected_unit';

export function isRecordCreator(record, currentUser) {
  if (!record || !currentUser) return false;

  // If backend provided precomputed isCreator flag for the current session, respect it
  if (record.isCreator === true) return true;

  const createdBy = record.createdBy;
  const createdById = record.createdById || record.ownerId || record.userId;

  // Older/legacy records with unknown ownership: protected as read-only for ordinary employees
  if (!createdBy && !createdById) {
    return Boolean(currentUser.isAdmin || currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN');
  }

  const userIds = [
    currentUser.id,
    currentUser._id,
    currentUser.userId
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(String);

  const userCodes = [
    currentUser.empId,
    currentUser.employeeId,
    currentUser.code,
    currentUser.userName,
    currentUser.empCode
  ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(s => String(s).trim().toUpperCase());

  // Check createdById
  if (createdById) {
    const cid = String(createdById).trim();
    if (userIds.includes(cid)) return true;
    if (userCodes.includes(cid.toUpperCase())) return true;
  }

  // Check createdBy object
  if (typeof createdBy === 'object') {
    const rIds = [createdBy.id, createdBy._id, createdBy.userId]
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
      .map(String);
    for (const rid of rIds) {
      if (userIds.includes(rid)) return true;
      if (userCodes.includes(rid.toUpperCase())) return true;
    }

    const rCodes = [
      createdBy.empId,
      createdBy.code,
      createdBy.employeeId,
      createdBy.userName
    ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(s => String(s).trim().toUpperCase());

    for (const rcode of rCodes) {
      if (userCodes.includes(rcode)) return true;
    }
  } else if (typeof createdBy === 'string' && createdBy.trim()) {
    const cStr = createdBy.trim();
    if (userIds.includes(cStr)) return true;
    if (userCodes.includes(cStr.toUpperCase())) return true;
  }

  return false;
}

export function canEditRecord(record, currentUser) {
  if (!record || !currentUser) return false;
  const isAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.isAdmin === 1 ||
    String(currentUser?.role || '').toUpperCase() === 'ADMIN' ||
    String(currentUser?.role || '').toUpperCase() === 'SUPERADMIN'
  );
  if (isAdmin) return true;
  return isRecordCreator(record, currentUser);
}

export const EDITABLE_RESPONSIBLE_COLUMNS = [
  'rootCause',
  'counterMeasure',
  'imageAfter',
  'imagesAfter',
  'stdDurationMin',
  'responseDate',
  'revisedDates',
  'revisions',
  'noOfTimeRevised'
];

export function isUserResponsibleForRow(row, user) {
  if (!user || !row) return false;

  const userIds = [user.id, user._id, user.userId]
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(String);

  const userCodes = [user.empId, user.employeeId, user.userName, user.code]
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(s => String(s).trim().toUpperCase());

  const userNames = [user.name, user.fullName]
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(s => String(s).trim().toLowerCase());

  // 1. Check row.staffEmployees array (supports multiple staff in single row)
  if (Array.isArray(row.staffEmployees) && row.staffEmployees.length > 0) {
    for (const emp of row.staffEmployees) {
      if (!emp) continue;
      if (emp.id && userIds.includes(String(emp.id))) return true;
      const code = String(emp.code || emp.empId || '').trim().toUpperCase();
      if (code && userCodes.includes(code)) return true;
      const name = String(emp.name || emp.fullName || '').trim().toLowerCase();
      if (name && userNames.includes(name)) return true;
    }
  }

  // 2. Check row.staffEmployee string
  if (row.staffEmployee && typeof row.staffEmployee === 'string') {
    const parts = row.staffEmployee.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const pUpper = part.toUpperCase();
      const pLower = part.toLowerCase();
      if (userCodes.some(c => pUpper.includes(c))) return true;
      if (userNames.some(n => pLower.includes(n))) return true;
    }
  }

  // 3. Check individual staff fields
  const staffId = String(row.staffId || row.employeeId || '').trim().toUpperCase();
  if (staffId && userCodes.includes(staffId)) return true;

  const staffName = String(row.staffName || '').trim().toLowerCase();
  if (staffName && userNames.includes(staffName)) return true;

  return false;
}

export function isUserInResponsibleDepartment(row, user) {
  if (!user || !row) return false;

  // 1. Direct assignment as responsible staff
  if (isUserResponsibleForRow(row, user)) return true;

  // 2. Department matching: check selected Responsible Person Confirmation department
  const targetDepts = [
    row.responsiblePersonDept,
    row.department,
    ...(Array.isArray(row.departments) ? row.departments : [])
  ]
    .filter(Boolean)
    .map(d => String(d).trim().toLowerCase());

  if (targetDepts.length === 0) return false;

  const userDepts = [];
  if (user.deptName) userDepts.push(user.deptName);
  if (typeof user.department === 'string') userDepts.push(user.department);
  if (user.department?.name) userDepts.push(user.department.name);
  if (Array.isArray(user.departments)) {
    user.departments.forEach(d => {
      if (typeof d === 'string') userDepts.push(d);
      else if (d?.name) userDepts.push(d.name);
    });
  }

  const normalizedUserDepts = userDepts.map(d => String(d).trim().toLowerCase());
  return normalizedUserDepts.some(ud => targetDepts.some(td => ud === td || ud.includes(td) || td.includes(ud)));
}

export function isUserResponsibleForAnyRow(rows, user) {
  if (!Array.isArray(rows) || !user) return false;
  return rows.some(r => isUserInResponsibleDepartment(r, user));
}

export function canUserEditPDCARow(row, user, record, targetColumn = null) {
  if (!user) {
    if (targetColumn) return false;
    return { canEditEntireRow: false, canEditActionCols: false };
  }
  const isAdmin = Boolean(
    user?.isAdmin ||
    user?.isAdmin === 1 ||
    String(user?.role || '').toUpperCase() === 'ADMIN' ||
    String(user?.role || '').toUpperCase() === 'SUPERADMIN'
  );
  if (isAdmin) {
    if (targetColumn) return true;
    return { canEditEntireRow: true, canEditActionCols: true };
  }
  if (record && isRecordCreator(record, user)) {
    if (targetColumn) return true;
    return { canEditEntireRow: true, canEditActionCols: true };
  }
  const isDeptMember = isUserInResponsibleDepartment(row, user);
  if (isDeptMember) {
    if (targetColumn) return EDITABLE_RESPONSIBLE_COLUMNS.includes(targetColumn);
    return { canEditEntireRow: false, canEditActionCols: true };
  }
  if (targetColumn) return false;
  return { canEditEntireRow: false, canEditActionCols: false };
}


export function resolveCurrentUserId(user) {
  if (user && (user.id || user._id || user.code || user.employeeId || user.userName || user.name)) {
    return String(user.id || user._id || user.code || user.employeeId || user.userName || user.name);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        return String(parsed?.id || parsed?._id || parsed?.employeeId || parsed?.code || parsed?.userName || parsed?.name || '');
      }
    }
  } catch {}
  return '';
}

export function getStoredUnit(currentUserId, defaultFallback = 'Bawal') {
  try {
    if (typeof sessionStorage === 'undefined') return defaultFallback;
    const raw = sessionStorage.getItem(PDCA_SELECTED_UNIT_KEY);
    if (!raw) return defaultFallback;

    let unit = raw;
    let storedUserId = null;

    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        unit = parsed?.unit;
        storedUserId = parsed?.userId;
      } catch {
        unit = raw;
      }
    }

    // Do not leak one user's selection into another user's session
    const resolvedUserId = currentUserId || resolveCurrentUserId();
    if (resolvedUserId && storedUserId && String(resolvedUserId) !== String(storedUserId)) {
      sessionStorage.removeItem(PDCA_SELECTED_UNIT_KEY);
      return defaultFallback;
    }

    if (PDCA_PLANTS.includes(unit) || unit === 'All Unit') {
      return unit;
    }
    return defaultFallback;
  } catch {
    return defaultFallback;
  }
}

export function saveStoredUnit(unit, currentUserId) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (PDCA_PLANTS.includes(unit) || unit === 'All Unit') {
      const resolvedUserId = currentUserId || resolveCurrentUserId();
      sessionStorage.setItem(PDCA_SELECTED_UNIT_KEY, JSON.stringify({
        unit,
        userId: resolvedUserId || ''
      }));
    } else {
      sessionStorage.removeItem(PDCA_SELECTED_UNIT_KEY);
    }
  } catch {}
}

export function clearStoredUnit() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(PDCA_SELECTED_UNIT_KEY);
    }
  } catch {}
}
