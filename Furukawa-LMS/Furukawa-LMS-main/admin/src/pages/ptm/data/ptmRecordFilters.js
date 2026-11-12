/**
 * ptmRecordFilters.js
 * Comprehensive filtering, visibility, and status classification for PTM sheets.
 * Follows identical business rules as PDCA:
 * 1. Scope tabs: Plant, Department, Self PTM (no CFT).
 * 2. Independent completion:
 *    - Plant: all sheet points
 *    - Department: points assigned to the department (independent completion)
 *    - Self PTM: points assigned to the employee (independent completion)
 * 3. Status: Ongoing (Not-Started, In-Progress, Delay) and Done (Done).
 */

export const PTM_VALID_UNITS = ['Bawal', 'Gujrat', 'All'];

export const PTM_DEPARTMENTS_LIST = [
  'Quality',
  'PE',
  'Assembly',
  'C&C',
  'PPC',
  'HR',
  'Store',
  'D&D',
  'Marketing',
  'Finance',
  'Safety',
  'Maintenance',
  'SRC'
];

const PTM_DEPT_ALIASES = {
  quality: ['quality', 'qa', 'qc', 'src quality'],
  pe: ['pe', 'process engineering'],
  prod: ['prod', 'production', 'assembly', 'cc', 'c&c', 'die casting', 'wiring harness', 'stamping'],
  production: ['prod', 'production', 'assembly', 'cc', 'c&c', 'die casting', 'wiring harness', 'stamping'],
  assembly: ['assembly', 'prod', 'production'],
  cc: ['cc', 'c&c', 'crimping', 'prod'],
  'c&c': ['cc', 'c&c', 'crimping', 'prod'],
  ppc: ['ppc'],
  hr: ['hr', 'human resources'],
  scm: ['scm', 'store', 'warehouse', 'logistics'],
  store: ['scm', 'store', 'warehouse'],
  dd: ['dd', 'd&d', 'design'],
  'd&d': ['dd', 'd&d', 'design'],
  mkt: ['mkt', 'marketing', 'sales'],
  marketing: ['mkt', 'marketing', 'sales'],
  fa: ['fa', 'f&a', 'finance', 'accounts'],
  'f&a': ['fa', 'f&a', 'finance', 'accounts'],
  finance: ['fa', 'f&a', 'finance', 'accounts'],
  maintenance: ['maintenance', 'plant maintenance', 'pe'],
  safety: ['safety', 'ehs safety', 'ehs', 'hr'],
  src: ['src', 'quality']
};

export function normalizeDeptName(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase();
}

export function doesPtmRowBelongToDepartment(row, targetDept) {
  if (!row || !targetDept) return false;
  const target = normalizeDeptName(targetDept);
  if (!target) return false;

  const validAliases = PTM_DEPT_ALIASES[target] || [target];

  // 1. Direct row.department or row.dept match
  const rowDept = normalizeDeptName(row.department || row.dept);
  if (rowDept && validAliases.some(alias => rowDept.includes(alias) || alias.includes(rowDept))) {
    return true;
  }

  // 2. Check row.departments dictionary
  if (row.departments && typeof row.departments === 'object') {
    for (const [key, val] of Object.entries(row.departments)) {
      if (val && String(val).trim() !== '' && String(val).trim() !== '-') {
        const normKey = normalizeDeptName(key);
        if (validAliases.some(alias => normKey === alias || normKey.includes(alias) || alias.includes(normKey))) {
          return true;
        }
      }
    }
  }

  return false;
}

export function doesPtmRowBelongToUser(row, currentUser) {
  if (!row || !currentUser) return false;
  const userCode = String(currentUser.code || currentUser.empId || currentUser.employeeCode || currentUser.id || '').trim().toLowerCase();
  const userName = String(currentUser.name || currentUser.fullName || currentUser.userName || '').trim().toLowerCase();

  const pic = String(row.pic || row.responsiblePerson || row.staff || row.staffName || row.staffEmployee || '').trim().toLowerCase();
  const picCode = String(row.staffCode || row.empCode || row.picCode || '').trim().toLowerCase();

  if (userCode && (picCode === userCode || pic.includes(userCode))) return true;
  if (userName && userName.length > 2 && pic.includes(userName)) return true;

  return false;
}

export function isPtmRowDone(row) {
  if (!row) return false;
  const st = String(row.status || '').trim().toLowerCase();
  return st === 'done' || st === 'closed' || st === 'complete' || st === 'completed';
}

export function isActivePtmRow(row) {
  if (!row) return false;
  return Boolean(
    (row.activity && String(row.activity).trim() !== '') ||
    (row.deliverable && String(row.deliverable).trim() !== '') ||
    (row.reqName && String(row.reqName).trim() !== '') ||
    (row.phaseName && String(row.phaseName).trim() !== '') ||
    (row.status && String(row.status).trim() !== '')
  );
}

export function getPtmSheetRows(item) {
  if (!item) return [];
  if (Array.isArray(item.sheet?.rows) && item.sheet.rows.length > 0) {
    return item.sheet.rows;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(`ptm_rows_item_${item.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return [];
}

/**
 * Classifies a PTM sheet into 'Ongoing' or 'Done' based on scope:
 * - Plant: all active rows
 * - Department: points assigned to target department (independent completion)
 * - Self PTM: points assigned to employee (independent completion)
 */
export function classifyPTMSheetStatus(sheet, scope = 'Company', options = {}) {
  const { targetDept, currentUser } = options;
  const rows = getPtmSheetRows(sheet);
  const activeRows = rows.filter(isActivePtmRow);

  let relevantRows = [];
  if (scope === 'Self PTM') {
    relevantRows = activeRows.filter(r => doesPtmRowBelongToUser(r, currentUser));
    // If no individual row has the user's name but the user created the sheet
    if (relevantRows.length === 0 && currentUser && isPtmRecordCreator(sheet, currentUser)) {
      relevantRows = activeRows;
    }
  } else if (scope === 'Department') {
    const deptToUse = targetDept || getUserDepartment(currentUser) || sheet.department;
    relevantRows = activeRows.filter(r => doesPtmRowBelongToDepartment(r, deptToUse));
    // If no row has explicit department ticks, but sheet belongs to this department
    if (relevantRows.length === 0 && deptToUse && normalizeDeptName(sheet.department) === normalizeDeptName(deptToUse)) {
      relevantRows = activeRows;
    }
  } else {
    // Plant / Company scope
    relevantRows = activeRows;
  }

  const sheetStatus = String(sheet.status || '').trim().toLowerCase();
  const isSheetExplicitlyDone = sheetStatus === 'done' || sheetStatus === 'closed' || sheetStatus === 'completed';

  let doneCount = 0;
  let ongoingCount = 0;

  if (relevantRows.length === 0) {
    if (isSheetExplicitlyDone) {
      doneCount = 1;
    } else {
      ongoingCount = 1;
    }
  } else {
    relevantRows.forEach(r => {
      if (isPtmRowDone(r)) {
        doneCount++;
      } else {
        ongoingCount++;
      }
    });
  }

  const total = relevantRows.length || 1;
  const isDone = (doneCount === total && total > 0) || (relevantRows.length === 0 && isSheetExplicitlyDone);

  return {
    section: isDone ? 'Done' : 'Ongoing',
    statusSummary: {
      done: doneCount,
      ongoing: ongoingCount,
      total
    },
    relevantPointsCount: relevantRows.length
  };
}

export function isPtmRecordCreator(item, user) {
  if (!item || !user) return false;
  const creatorCode = String(item.createdBy?.code || item.createdBy?.empId || item.createdById || '').trim().toLowerCase();
  const userCode = String(user.code || user.empId || user.employeeCode || user.id || '').trim().toLowerCase();
  if (creatorCode && userCode && creatorCode === userCode) return true;

  const creatorName = String(item.createdBy?.name || item.createdBy?.fullName || '').trim().toLowerCase();
  const userName = String(user.name || user.fullName || user.userName || '').trim().toLowerCase();
  if (creatorName && userName && creatorName === userName) return true;

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

export function getUserDepartment(user) {
  if (!user) return '';
  return user.department || user.deptName || user.primaryDept || (typeof user.dept === 'string' ? user.dept : '') || '';
}

/**
 * Returns the list of PTM sheets visible in a given scope (Plant, Department, Self PTM):
 * - Plant: all sheets matching selected plant
 * - Department: sheets created in Department scope + Plant sheets containing points for the department
 * - Self PTM: sheets created by employee + sheets containing points assigned to employee
 */
export function getPTMVisibleSheets(items, plant, scope, options = {}) {
  const {
    department = '',
    currentUser = null,
    search = '',
    fromDate = '',
    toDate = ''
  } = options;

  if (!Array.isArray(items)) return [];

  const query = (search || '').toLowerCase().trim();
  const targetDept = normalizeDeptName(department || getUserDepartment(currentUser));

  // 1. Plant filter: 'All' / 'All Units' / 'All Plants' matches all plants
  const plantMatches = items.filter(item => {
    if (plant && plant !== 'All' && plant !== 'All Units' && plant !== 'All Plants') {
      if (String(item.plant || '').trim().toLowerCase() !== String(plant).trim().toLowerCase()) {
        return false;
      }
    }
    if (query) {
      const matchQuery = [item.topic, item.description, item.id, item.department, item.createdBy?.name, item.createdBy?.code]
        .some(val => String(val || '').toLowerCase().includes(query));
      if (!matchQuery) return false;
    }
    if (!matchesDateRange(item, fromDate, toDate)) {
      return false;
    }
    return true;
  });

  // 2. Scope filter with visibility rules
  const results = [];
  const seenIds = new Set();

  if (scope === 'Company' || scope === 'Plant') {
    plantMatches.forEach(item => {
      if (item.scope === 'Company' || item.scope === 'Plant' || (!item.scope && !item.isSelf)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else if (scope === 'Department') {
    plantMatches.forEach(item => {
      const itemDept = normalizeDeptName(item.department);
      const isDeptSheet = item.scope === 'Department' && (!targetDept || itemDept === targetDept);

      let hasPointsForDept = false;
      if (targetDept) {
        const rows = getPtmSheetRows(item);
        hasPointsForDept = rows.some(r => isActivePtmRow(r) && doesPtmRowBelongToDepartment(r, targetDept));
      }

      if (isDeptSheet || hasPointsForDept) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else if (scope === 'Self PTM' || scope === 'Self PDCA') {
    plantMatches.forEach(item => {
      const isCreator = currentUser && isPtmRecordCreator(item, currentUser);
      const isSelfFlag = item.isSelf === true || item.scope === 'Self PTM' || item.scope === 'Self PDCA';

      let hasAssignedPoints = false;
      if (currentUser) {
        const rows = getPtmSheetRows(item);
        hasAssignedPoints = rows.some(r => isActivePtmRow(r) && doesPtmRowBelongToUser(r, currentUser));
      }

      if ((isSelfFlag && isCreator) || hasAssignedPoints || isCreator) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else {
    plantMatches.forEach(item => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        results.push(item);
      }
    });
  }

  return results;
}

/**
 * Filters visible PTM sheets by active section ('Ongoing' | 'Done').
 */
export function filterPTMRecordsBySection(sheets, scope, activeSection, options = {}) {
  if (!Array.isArray(sheets)) return [];

  return sheets.filter(sheet => {
    const { section } = classifyPTMSheetStatus(sheet, scope, options);
    if (activeSection && section !== activeSection) {
      return false;
    }
    return true;
  });
}

/**
 * Calculates counts of PTM sheets in Ongoing and Done.
 */
export function getPTMSectionCounts(sheets, scope, options = {}) {
  const counts = {
    Ongoing: 0,
    Done: 0
  };

  if (!Array.isArray(sheets)) return counts;

  sheets.forEach(sheet => {
    const { section } = classifyPTMSheetStatus(sheet, scope, options);
    if (section === 'Done') counts.Done++;
    else counts.Ongoing++;
  });

  return counts;
}

