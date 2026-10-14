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
