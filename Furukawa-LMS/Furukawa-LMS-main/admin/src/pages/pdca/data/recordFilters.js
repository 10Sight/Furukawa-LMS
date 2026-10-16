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

export function filterPDCARecords(data, plant, scope, search = '', department = '', dateFilter = '') {
  const query = search.toLowerCase().trim();
  const deptFilter = (department || '').toLowerCase().trim();
  return data.filter(item => matchesPlant(item, plant) &&
    (scope === 'Self PDCA' ? item.isSelf || item.scope === scope : item.scope === scope) &&
    (!deptFilter || (item.department || '').toLowerCase() === deptFilter) &&
    matchesDate(item, dateFilter) &&
    (!query || [item.topic, item.description, item.id, item.department, item.createdBy?.name, item.createdBy?.code]
      .some(value => String(value || '').toLowerCase().includes(query))));
}
export const PDCA_SELECTED_UNIT_KEY = 'pdca_selected_unit';

export function isRecordCreator(record, currentUser) {
  if (!record || !currentUser) return false;

  // If backend provided precomputed isCreator flag for the current session, respect it
  if (record.isCreator === true) return true;

  const createdBy = record.createdBy;
  const createdById = record.createdById;

  // Older/legacy records with unknown ownership: protected as read-only for ordinary employees
  if (!createdBy && !createdById) {
    return Boolean(currentUser.isAdmin || currentUser.role === 'ADMIN');
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
