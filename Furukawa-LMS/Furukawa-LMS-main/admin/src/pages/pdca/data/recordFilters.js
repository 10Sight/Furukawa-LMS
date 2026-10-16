import { PDCA_DEPARTMENTS } from './pdcaConstants.js';
export { PDCA_DEPARTMENTS };
export const PDCA_PLANTS = ['Bawal', 'Gujrat'];
export function matchesPlant(item, plant) {
  if (!PDCA_PLANTS.includes(plant)) return false;
  const savedPlant = (item.plant || '').toLowerCase();
  // Previously created forms used All Plants; retain access without moving them.
  return savedPlant === plant.toLowerCase() || savedPlant === 'all plants';
}
export function filterPDCARecords(data, plant, scope, search = '', department = '') {
  const query = search.toLowerCase().trim();
  const deptFilter = (department || '').toLowerCase().trim();
  return data.filter(item => matchesPlant(item, plant) &&
    (scope === 'Self PDCA' ? item.isSelf || item.scope === scope : item.scope === scope) &&
    (!deptFilter || (item.department || '').toLowerCase() === deptFilter) &&
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

    if (PDCA_PLANTS.includes(unit)) {
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
    if (PDCA_PLANTS.includes(unit)) {
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
