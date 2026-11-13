import { PDCA_DEPARTMENTS, PDCA_SHEET_TABLE_STATUSES, isActivePDCARow, getEffectivePDCARowStatus, resolvePDCASheetRows, getPDCASheetStatusSummary, normalizePDCAStatus } from './pdcaConstants.js';
import { findEmployeeDepartment, VERIFIED_EMPLOYEE_MASTER } from './pdcaEmployees.js';
import { VERIFIED_SECTION_MASTER } from './pdcaSections.js';
export { PDCA_DEPARTMENTS, PDCA_SHEET_TABLE_STATUSES, isActivePDCARow, getEffectivePDCARowStatus, resolvePDCASheetRows, getPDCASheetStatusSummary, normalizePDCAStatus };
export const PDCA_PLANTS = ['Bawal', 'Gujrat'];
export const ALL_UNITS_OPTION = 'All Unit';

export function matchesPlant(item, plant) {
  if (!plant) return false;
  const normalizedPlant = String(plant).trim().toLowerCase();
  if (
    normalizedPlant === 'all' ||
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

  const createdBy = record.createdBy || record.sheet?.createdBy;
  const createdById = record.createdById || record.ownerId || record.userId || record.sheet?.createdById;

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

  const userNames = [
    currentUser.name,
    currentUser.fullName
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

    if (rIds.length === 0 && rCodes.length === 0) {
      const rNames = [createdBy.name, createdBy.fullName]
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
        .map(s => String(s).trim().toUpperCase());
      for (const rname of rNames) {
        if (userNames.includes(rname)) return true;
      }
    }
  } else if (typeof createdBy === 'string' && createdBy.trim()) {
    const cStr = createdBy.trim();
    if (userIds.includes(cStr)) return true;
    if (userCodes.includes(cStr.toUpperCase())) return true;
    if (!createdById && userNames.includes(cStr.toUpperCase())) return true;
  }

  return false;
}

function normalizeDepartmentName(dept) {
  if (!dept) return '';
  if (typeof dept === 'object') {
    return normalizeDepartmentName(dept.name || dept.department || dept.deptName || '');
  }
  const trimmed = String(dept).trim().toLowerCase();
  if (!trimmed || trimmed === 'cft') return '';
  if (trimmed.includes('quality') || trimmed.includes('qa') || trimmed.includes('qc')) return 'quality';
  if (trimmed === 'c&c' || trimmed === 'cc' || trimmed.includes('c&c') || trimmed.includes('cutting')) return 'c&c';
  if (trimmed.includes('assembly')) return 'assembly';
  if (trimmed.includes('maintenance')) return 'maintenance';
  if (trimmed.includes('production') || trimmed.includes('prod')) return 'production';
  if (trimmed === 'it' || trimmed.includes('it & edp') || trimmed.includes('information tech')) return 'it';
  if (trimmed === 'hr' || trimmed.includes('human resource')) return 'hr';
  if (trimmed === 'pe' || trimmed.includes('process eng')) return 'pe';
  if (trimmed.includes('safety') || trimmed.includes('ehs')) return 'safety';
  if (trimmed.includes('store') || trimmed.includes('warehouse')) return 'store';
  if (trimmed.includes('d&d') || trimmed.includes('design')) return 'd&d';
  return trimmed;
}

export function getUserDepartments(user, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!user || typeof user !== 'object') return [];
  const depts = new Set();
  const addDept = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(addDept);
      return;
    }
    if (typeof val === 'object') {
      addDept(val.name || val.department || val.deptName || val.departmentName || val.label || '');
      return;
    }
    String(val).split(/[,;]/).forEach(part => {
      const norm = normalizeDepartmentName(part);
      if (norm) depts.add(norm);
    });
  };

  addDept(user.deptName);
  addDept(user.department);
  addDept(user.departmentName);
  addDept(user.departments);
  addDept(user.actualDeptName);

  const userName = user.name || user.fullName || '';
  const userCode = user.code || user.empId || user.employeeId || user.empCode || user.userName || '';
  const userId = user.id || user._id || user.userId || '';
  if (userName || userCode || userId) {
    const dbDept = findEmployeeDepartment({ name: userName, code: userCode || String(userId) }, employeeDatabase) ||
      findEmployeeDepartment({ name: userName, code: userCode || String(userId) }, VERIFIED_EMPLOYEE_MASTER) ||
      (userCode ? findEmployeeDepartment(userCode, employeeDatabase) : null) ||
      (userCode ? findEmployeeDepartment(userCode, VERIFIED_EMPLOYEE_MASTER) : null);
    addDept(dbDept);
  }

  // Fallback: check section only if no explicit department was attached
  if (depts.size === 0) {
    addDept(user.section);
    addDept(user.sectionName);
    if (Array.isArray(user.sections)) {
      user.sections.forEach(s => addDept(s?.name || s?.deptName || s?.department || s));
    }
  }

  // Fallback: check stored user in session or local storage if department was not attached
  if (depts.size === 0) {
    try {
      const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
                  (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored) {
          addDept(stored.deptName);
          addDept(stored.department);
          addDept(stored.departmentName);
          addDept(stored.departments);
          addDept(stored.section);
          addDept(stored.sectionName);
          if (Array.isArray(stored.sections)) {
            stored.sections.forEach(s => addDept(s?.name || s?.deptName || s?.department || s));
          }
        }
      }
    } catch {}
  }

  return Array.from(depts);
}

export function getRecordDepartments(record, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!record || typeof record !== 'object') return [];
  const depts = new Set();
  const addDept = (val) => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(addDept);
      return;
    }
    if (typeof val === 'object') {
      addDept(val.name || val.department || val.deptName || val.departmentName || val.label || '');
      return;
    }
    String(val).split(/[,;]/).forEach(part => {
      const norm = normalizeDepartmentName(part);
      if (norm) depts.add(norm);
    });
  };

  addDept(record.department);
  addDept(record.departments);
  addDept(record.sheet?.department);

  const createdBy = record.createdBy || record.sheet?.createdBy;
  if (createdBy && typeof createdBy === 'object') {
    addDept(createdBy.department);
    addDept(createdBy.deptName);
    addDept(createdBy.departmentName);
    addDept(createdBy.departments);
    addDept(createdBy.section);
    addDept(createdBy.sectionName);
    const creatorName = createdBy.name || createdBy.fullName || '';
    const creatorCode = createdBy.code || createdBy.empId || createdBy.employeeId || createdBy.empCode || createdBy.userName || '';
    const creatorId = createdBy.id || createdBy._id || createdBy.userId || '';
    if (creatorName || creatorCode || creatorId) {
      const dbDept = findEmployeeDepartment({ name: creatorName, code: creatorCode || String(creatorId) }, employeeDatabase) ||
        findEmployeeDepartment({ name: creatorName, code: creatorCode || String(creatorId) }, VERIFIED_EMPLOYEE_MASTER) ||
        (creatorCode ? findEmployeeDepartment(creatorCode, employeeDatabase) : null) ||
        (creatorCode ? findEmployeeDepartment(creatorCode, VERIFIED_EMPLOYEE_MASTER) : null);
      addDept(dbDept);
    }
  } else if (typeof createdBy === 'string' && createdBy.trim()) {
    const dbDept = findEmployeeDepartment(createdBy, employeeDatabase) ||
      findEmployeeDepartment(createdBy, VERIFIED_EMPLOYEE_MASTER);
    addDept(dbDept);
  }

  const createdById = record.createdById || record.sheet?.createdById;
  if (createdById) {
    const dbDept = findEmployeeDepartment(createdById, employeeDatabase) ||
      findEmployeeDepartment(createdById, VERIFIED_EMPLOYEE_MASTER);
    addDept(dbDept);
  }

  const preparedBy = record.sheet?.headerInfo?.preparedBy;
  if (preparedBy && typeof preparedBy === 'string' && preparedBy.trim()) {
    const dbDept = findEmployeeDepartment(preparedBy, employeeDatabase) ||
      findEmployeeDepartment(preparedBy, VERIFIED_EMPLOYEE_MASTER);
    addDept(dbDept);
  }

  // NOTE: We do NOT extract departments from record.sheet?.rows because those are
  // responsible departments assigned to individual action rows, NOT the sheet creator's department!

  // Fallback to section or category ONLY if no department found
  if (depts.size === 0) {
    addDept(record.section);
    addDept(record.sectionName);
    addDept(record.category);
    addDept(record.lpaCategory);
    if (createdBy && typeof createdBy === 'object') {
      addDept(createdBy.section);
      addDept(createdBy.sectionName);
    }
  }

  return Array.from(depts);
}

export function cleanSectionString(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeSectionToken(val) {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) {
    const list = [];
    val.forEach(item => {
      normalizeSectionToken(item).forEach(t => list.push(t));
    });
    return Array.from(new Set(list));
  }
  if (typeof val === 'object') {
    const tokens = new Set();
    if (val.id !== undefined && val.id !== null) {
      normalizeSectionToken(val.id).forEach(t => tokens.add(t));
    }
    if (val.sectionId !== undefined && val.sectionId !== null) {
      normalizeSectionToken(val.sectionId).forEach(t => tokens.add(t));
    }
    if (val.name) {
      normalizeSectionToken(val.name).forEach(t => tokens.add(t));
    }
    if (val.sectionName) {
      normalizeSectionToken(val.sectionName).forEach(t => tokens.add(t));
    }
    if (val.uniCode) {
      normalizeSectionToken(val.uniCode).forEach(t => tokens.add(t));
    }
    return Array.from(tokens);
  }

  const rawStr = String(val).trim();
  if (!rawStr) return [];

  const tokens = new Set();

  if (/^\d+$/.test(rawStr)) {
    const idNum = Number(rawStr);
    tokens.add(`id:${idNum}`);
    const master = VERIFIED_SECTION_MASTER.find(s => Number(s.id) === idNum);
    if (master) {
      const cName = cleanSectionString(master.name);
      if (cName) tokens.add(cName);
      const cCode = cleanSectionString(master.uniCode);
      if (cCode) tokens.add(cCode);
    }
    return Array.from(tokens);
  }

  const clean = cleanSectionString(rawStr);
  if (!clean) return [];
  tokens.add(clean);

  const matchedMaster = VERIFIED_SECTION_MASTER.find(s => {
    if (cleanSectionString(s.name) === clean) return true;
    if (s.uniCode && cleanSectionString(s.uniCode) === clean) return true;
    return false;
  });

  if (matchedMaster) {
    tokens.add(`id:${matchedMaster.id}`);
    const cName = cleanSectionString(matchedMaster.name);
    if (cName) tokens.add(cName);
    const cCode = cleanSectionString(matchedMaster.uniCode);
    if (cCode) tokens.add(cCode);
  }

  if (clean === 'assembly') {
    tokens.add('assembly');
  } else if (clean === 'cc' || clean === 'crimping' || clean === 'candc') {
    tokens.add('cc');
  }

  return Array.from(tokens);
}

export function getUserSections(user, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!user || typeof user !== 'object') return [];
  const tokens = new Set();
  const add = (val) => {
    if (!val) return;
    normalizeSectionToken(val).forEach(t => tokens.add(t));
  };

  add(user.section);
  add(user.sectionName);
  add(user.sectionId);
  add(user.targetSectionId);
  if (Array.isArray(user.sections)) {
    user.sections.forEach(s => add(s));
  }
  add(user.subSection);
  add(user.subSectionName);
  add(user.subSectionId);
  if (Array.isArray(user.subSections)) {
    user.subSections.forEach(s => add(s));
  }

  const userCode = user.code || user.empId || user.employeeId || user.empCode || user.userName || '';
  const userName = user.name || user.fullName || '';
  const userId = user.id || user._id || user.userId || '';

  const db = Array.isArray(employeeDatabase) && employeeDatabase.length > 0
    ? employeeDatabase
    : VERIFIED_EMPLOYEE_MASTER;

  if (userCode || userName || userId) {
    const matchedEmp = db.find(e => {
      const eCode = String(e.code || e.empId || e.employeeId || e.userName || e.id || '').trim().toUpperCase();
      const eName = String(e.name || e.fullName || '').trim().toLowerCase();
      if (userCode && eCode && eCode === String(userCode).trim().toUpperCase()) return true;
      if (userId && String(e.id || e._id || '').trim() === String(userId).trim()) return true;
      if (userName && eName && eName === String(userName).trim().toLowerCase()) return true;
      return false;
    });

    if (matchedEmp) {
      add(matchedEmp.section);
      add(matchedEmp.sectionName);
      add(matchedEmp.sectionId);
      if (Array.isArray(matchedEmp.sections)) {
        matchedEmp.sections.forEach(s => add(s));
      }
    }
  }

  if (tokens.size === 0) {
    try {
      const raw = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
                  (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored) {
          add(stored.section);
          add(stored.sectionName);
          add(stored.sectionId);
          add(stored.targetSectionId);
          if (Array.isArray(stored.sections)) {
            stored.sections.forEach(s => add(s));
          }
        }
      }
    } catch {}
  }

  return Array.from(tokens);
}

export function getRecordSections(record, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!record || typeof record !== 'object') return [];
  const tokens = new Set();
  const add = (val) => {
    if (!val) return;
    normalizeSectionToken(val).forEach(t => tokens.add(t));
  };

  add(record.section);
  add(record.sectionName);
  add(record.sectionId);

  if (record.sheet && typeof record.sheet === 'object') {
    add(record.sheet.section);
    add(record.sheet.sectionName);
    add(record.sheet.sectionId);
    if (record.sheet.headerInfo && typeof record.sheet.headerInfo === 'object') {
      add(record.sheet.headerInfo.section);
      add(record.sheet.headerInfo.sectionName);
      add(record.sheet.headerInfo.sectionId);
    }
  }

  const createdBy = record.createdBy || record.sheet?.createdBy;
  if (createdBy && typeof createdBy === 'object') {
    add(createdBy.section);
    add(createdBy.sectionName);
    add(createdBy.sectionId);
    if (Array.isArray(createdBy.sections)) {
      createdBy.sections.forEach(s => add(s));
    }
    const cName = createdBy.name || createdBy.fullName || '';
    const cCode = createdBy.code || createdBy.empId || createdBy.employeeId || createdBy.empCode || createdBy.userName || '';
    const cId = createdBy.id || createdBy._id || createdBy.userId || '';
    const db = Array.isArray(employeeDatabase) && employeeDatabase.length > 0 ? employeeDatabase : VERIFIED_EMPLOYEE_MASTER;
    if (cCode || cName || cId) {
      const matched = db.find(e => {
        const eCode = String(e.code || e.empId || e.employeeId || e.userName || e.id || '').trim().toUpperCase();
        const eName = String(e.name || e.fullName || '').trim().toLowerCase();
        if (cCode && eCode && eCode === String(cCode).trim().toUpperCase()) return true;
        if (cId && String(e.id || e._id || '').trim() === String(cId).trim()) return true;
        if (cName && eName && eName === String(cName).trim().toLowerCase()) return true;
        return false;
      });
      if (matched) {
        add(matched.section);
        add(matched.sectionName);
        add(matched.sectionId);
        if (Array.isArray(matched.sections)) {
          matched.sections.forEach(s => add(s));
        }
      }
    }
  }

  // ONLY fall back to LPA generic category (assembly / cc) if NO explicit section was identified
  if (tokens.size === 0) {
    if (record.category === 'assembly' || record.lpaCategory === 'assembly' || record.lpaSource?.category === 'assembly' || String(record.id || '').toLowerCase().includes('pdca-lpa-assembly')) {
      add('assembly');
    } else if (record.category === 'cc' || record.lpaCategory === 'cc' || record.lpaSource?.category === 'cc' || String(record.id || '').toLowerCase().includes('pdca-lpa-cc')) {
      add('cc');
    }
  }

  return Array.from(tokens);
}

export function areSectionsMatching(userSecs, recordSecs, userDepts = [], recordDepts = []) {
  if (!Array.isArray(userSecs) || !Array.isArray(recordSecs)) return false;
  if (userSecs.length === 0 && recordSecs.length === 0) {
    return true;
  }
  if (userSecs.length === 0 || recordSecs.length === 0) {
    return false;
  }
  // Direct token match (exact clean section name, clean code, or section ID)
  return userSecs.some(us => recordSecs.includes(us));
}

export function isUserInSameDepartmentAsRecord(record, currentUser, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!record || !currentUser) return false;
  if (isRecordCreator(record, currentUser)) return true;

  // Administrators have full unrestricted access across all sheets
  if (
    currentUser.isAdmin === true ||
    currentUser.isAdmin === 1 ||
    String(currentUser.role || '').toUpperCase() === 'ADMIN' ||
    String(currentUser.role || '').toUpperCase() === 'SUPERADMIN'
  ) {
    return true;
  }

  // A record without a known creator or explicit department/section has no creator department
  const hasOwnershipOrDept = Boolean(
    record.createdBy ||
    record.createdById ||
    record.sheet?.createdBy ||
    record.sheet?.createdById ||
    record.sheet?.headerInfo?.preparedBy ||
    record.department ||
    record.sheet?.department
  );
  if (!hasOwnershipOrDept) {
    return false;
  }

  const userDepts = getUserDepartments(currentUser, employeeDatabase);

  // 1. Direct Colleague-to-Creator match: check creator's department
  const creator = record.createdBy || record.sheet?.createdBy;
  if (creator && typeof creator === 'object') {
    const creatorDepts = getUserDepartments(creator, employeeDatabase);
    const isCreatorSameDept = userDepts.length > 0 && creatorDepts.length > 0 && userDepts.some(ud => creatorDepts.includes(ud));
    if (isCreatorSameDept) {
      return true;
    }
  }

  // 2. Department match: User and Record belong to the same department
  const recordDepts = getRecordDepartments(record, employeeDatabase);
  const isSameDept = userDepts.length > 0 && recordDepts.length > 0 && userDepts.some(ud => recordDepts.includes(ud));

  // RULE: Employees with the SAME Department get full access of the sheet (same section is not required)
  if (isSameDept) {
    return true;
  }

  return false;
}

export const isUserInSameDepartmentAndSectionAsRecord = isUserInSameDepartmentAsRecord;

export function canEditRecord(record, currentUser, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!record || !currentUser) return false;
  const isAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.isAdmin === 1 ||
    String(currentUser?.role || '').toUpperCase() === 'ADMIN' ||
    String(currentUser?.role || '').toUpperCase() === 'SUPERADMIN'
  );
  if (isAdmin) return true;
  return isRecordCreator(record, currentUser) || isUserInSameDepartmentAsRecord(record, currentUser, employeeDatabase);
}

export const EDITABLE_RESPONSIBLE_COLUMNS = [
  'rootCause',
  'actionTaken',
  'counterMeasure',
  'imageAfter',
  'imagesAfter',
  'stdDurationMin',
  'responseDate',
  'revisedDates',
  'revisions',
  'noOfTimeRevised'
];

export const SAVE_MANDATORY_COLUMNS = [
  'Date',
  'Shift',
  'Status',
  'Unit',
  'Department',
  'Observation',
  'Staff Name'
];

export function isRowStartedForSave(row, options = {}) {
  if (!row || typeof row !== 'object') return false;
  const defaultUnit = String(options.defaultUnit || '').trim().toLowerCase();
  const defaultDept = String(options.defaultDepartment || '').trim().toLowerCase();

  const rowUnits = [
    row.unit,
    ...(Array.isArray(row.units) ? row.units : [])
  ].map(u => String(u || '').trim()).filter(Boolean);
  const hasUserUnit = rowUnits.some(u => u.toLowerCase() !== defaultUnit);

  const rowDepts = [
    row.department,
    ...(Array.isArray(row.departments) ? row.departments : [])
  ].map(d => String(d || '').trim()).filter(Boolean);
  const hasUserDept = rowDepts.some(d => d.toLowerCase() !== defaultDept);

  const respDepts = row.respDeptsByUnit && typeof row.respDeptsByUnit === 'object'
    ? Object.values(row.respDeptsByUnit).flat().map(d => String(d || '').trim()).filter(Boolean)
    : [];

  return Boolean(
    String(row.date || '').trim() ||
    String(row.shift || '').trim() ||
    String(row.status || '').trim() ||
    hasUserUnit ||
    hasUserDept ||
    String(row.section || '').trim() ||
    (Array.isArray(row.sections) && row.sections.some(s => String(s?.section || s || '').trim())) ||
    String(row.lineArea || '').trim() ||
    (Array.isArray(row.lineAreas) && row.lineAreas.some(l => String(l?.lineArea || l || '').trim())) ||
    String(row.observation || '').trim() ||
    String(row.rootCause || '').trim() ||
    String(row.actionTaken ?? row.correctiveAction ?? '').trim() ||
    String(row.counterMeasure || '').trim() ||
    String(row.stdDurationMin ?? row.stdDuration ?? '').trim() ||
    String(row.responseDate || '').trim() ||
    String(row.respUnit || row.responsiblePersonUnit || '').trim() ||
    (Array.isArray(row.respUnits) && row.respUnits.some(u => String(u || '').trim())) ||
    String(row.responsiblePersonDept || row.respDept || '').trim() ||
    respDepts.length > 0 ||
    String(row.staffName || row.staffEmployee || '').trim() ||
    (Array.isArray(row.staffEmployees) && row.staffEmployees.some(e => String(e?.name || e?.fullName || '').trim())) ||
    String(row.cftTopic || '').trim() ||
    String(row.confirmation || '').trim() ||
    String(row.instruction || '').trim() ||
    (Array.isArray(row.imagesBefore) && row.imagesBefore.length > 0) ||
    Boolean(row.imageBefore) ||
    (Array.isArray(row.imagesAfter) && row.imagesAfter.length > 0) ||
    Boolean(row.imageAfter)
  );
}

export function getMissingSaveMandatoryFields(row) {
  if (!row || typeof row !== 'object') {
    return [...SAVE_MANDATORY_COLUMNS];
  }
  const missing = [];

  // 1. Date
  if (!String(row.date || '').trim()) {
    missing.push('Date');
  }

  // 2. Shift
  if (!String(row.shift || '').trim()) {
    missing.push('Shift');
  }

  // 3. Status
  if (!String(row.status || '').trim()) {
    missing.push('Status');
  }

  // 4. Unit (Plan section)
  const unitVal = String(
    row.unit ||
    (Array.isArray(row.units) ? (row.units.find(u => String(u || '').trim()) || '') : '') ||
    ''
  ).trim();
  if (!unitVal) {
    missing.push('Unit');
  }

  // 5. Department (Plan section)
  const deptVal = String(
    row.department ||
    (Array.isArray(row.departments) ? (row.departments.find(d => String(d || '').trim()) || '') : '') ||
    ''
  ).trim();
  if (!deptVal) {
    missing.push('Department');
  }

  // 6. Observation
  if (!String(row.observation || '').trim()) {
    missing.push('Observation');
  }

  // 7. Staff Name
  const staffFromList = Array.isArray(row.staffEmployees)
    ? row.staffEmployees.map(e => String(e?.name || e?.fullName || '').trim()).filter(Boolean)
    : [];
  const staffNameVal = String(row.staffName || row.staffEmployee || staffFromList[0] || '').trim();
  if (!staffNameVal) {
    missing.push('Staff Name');
  }

  // 8. Std. Duration in min (Mandatory if Response Date is selected)
  const hasResponseDate = Boolean(String(row.responseDate || '').trim());
  if (hasResponseDate && !hasValidStdDuration(row.stdDurationMin ?? row.stdDuration)) {
    missing.push('Std. Duration in min');
  }

  return missing;
}

export const CONFIRMATION_MANDATORY_COLUMNS = [
  'Date',
  'Shift',
  'Status',
  'Unit',
  'Department',
  'Observation',
  'Root Cause',
  'Corrective action',
  'Counter Measure',
  'Std. Duration in Min',
  'Response date',
  'Unit (Responsible Person)',
  'Department (Responsible Person)',
  'Staff name (Responsible Person)'
];

export function hasValidStdDuration(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim();
  if (!str) return false;
  if (/^\d{1,2}:\d{1,2}/.test(str)) return true;
  const normalized = str.replace(/\s*(min|hrs|hr)$/i, '').trim();
  return normalized !== '' && Number.isFinite(Number(normalized)) && Number(normalized) >= 0;
}

export function getMissingConfirmationMandatoryFields(row) {
  if (!row || typeof row !== 'object') {
    return [...CONFIRMATION_MANDATORY_COLUMNS];
  }
  const missing = [];

  // 1. Date
  if (!String(row.date || '').trim()) {
    missing.push('Date');
  }

  // 2. Shift
  if (!String(row.shift || '').trim()) {
    missing.push('Shift');
  }

  // 3. Status
  if (!String(row.status || '').trim()) {
    missing.push('Status');
  }

  // 4. Unit (Plan section)
  const unitVal = String(
    row.unit ||
    (Array.isArray(row.units) ? (row.units.find(u => String(u || '').trim()) || '') : '') ||
    ''
  ).trim();
  if (!unitVal) {
    missing.push('Unit');
  }

  // 5. Department (Plan section)
  const deptVal = String(
    row.department ||
    (Array.isArray(row.departments) ? (row.departments.find(d => String(d || '').trim()) || '') : '') ||
    ''
  ).trim();
  if (!deptVal) {
    missing.push('Department');
  }

  // 6. Observation
  if (!String(row.observation || '').trim()) {
    missing.push('Observation');
  }

  // 7. Root Cause
  if (!String(row.rootCause || '').trim()) {
    missing.push('Root Cause');
  }

  // 8. Corrective action
  if (!String(row.actionTaken ?? row.correctiveAction ?? '').trim()) {
    missing.push('Corrective action');
  }

  // 9. Counter Measure
  if (!String(row.counterMeasure || '').trim()) {
    missing.push('Counter Measure');
  }

  // 10. Std. Duration in Min
  if (!hasValidStdDuration(row.stdDurationMin ?? row.stdDuration)) {
    missing.push('Std. Duration in Min');
  }

  // 11. Response date
  if (!String(row.responseDate || '').trim()) {
    missing.push('Response date');
  }

  // 12. Unit (Responsible Person)
  const respUnitVal = String(
    row.respUnit ||
    row.responsiblePersonUnit ||
    (Array.isArray(row.respUnits) ? (row.respUnits.find(u => String(u || '').trim()) || '') : '') ||
    (Array.isArray(row.staffEmployees) ? (row.staffEmployees.find(e => e && String(e.unit || '').trim())?.unit || '') : '') ||
    ''
  ).trim();
  if (!respUnitVal) {
    missing.push('Unit (Responsible Person)');
  }

  // 13. Department (Responsible Person)
  const deptsFromMap = row.respDeptsByUnit && typeof row.respDeptsByUnit === 'object'
    ? Object.values(row.respDeptsByUnit).flat().map(d => String(d || '').trim()).filter(Boolean)
    : [];
  const deptsFromStaff = Array.isArray(row.staffEmployees)
    ? row.staffEmployees.map(e => String(e?.department || '').trim()).filter(d => d && d !== 'CFT')
    : [];
  const directRespDept = String(row.responsiblePersonDept || row.respDept || '').trim();
  const respDeptVal = (directRespDept && directRespDept !== 'CFT' ? directRespDept : '') || deptsFromMap[0] || deptsFromStaff[0] || '';
  if (!respDeptVal) {
    missing.push('Department (Responsible Person)');
  }

  // 14. Staff name (Responsible Person)
  const staffFromList = Array.isArray(row.staffEmployees)
    ? row.staffEmployees.map(e => String(e?.name || e?.fullName || '').trim()).filter(Boolean)
    : [];
  const staffNameVal = String(row.staffName || row.staffEmployee || staffFromList[0] || '').trim();
  if (!staffNameVal) {
    missing.push('Staff name (Responsible Person)');
  }

  return missing;
}

export function canUserSelectConfirmation(row, recordOrIsCreator, currentUser = null, readOnly = false, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  const isAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.isAdmin === 1 ||
    String(currentUser?.role || '').toUpperCase() === 'ADMIN' ||
    String(currentUser?.role || '').toUpperCase() === 'SUPERADMIN'
  );
  const isCreator = typeof recordOrIsCreator === 'boolean'
    ? recordOrIsCreator
    : isRecordCreator(recordOrIsCreator, currentUser);

  // Responsible person cannot select Confirmation on their row or other rows
  const sheetRows = typeof recordOrIsCreator === 'object' && Array.isArray(recordOrIsCreator?.sheet?.rows)
    ? recordOrIsCreator.sheet.rows
    : (Array.isArray(recordOrIsCreator?.rows) ? recordOrIsCreator.rows : []);
  const isResponsible = Boolean(
    !isAdmin && !isCreator && (
      (row && isUserResponsibleForRow(row, currentUser)) ||
      (sheetRows.length > 0 && sheetRows.some(r => isUserResponsibleForRow(r, currentUser)))
    )
  );
  if (isResponsible) {
    return {
      allowed: false,
      isCreator: false,
      isAdmin,
      reason: 'creator_only',
      missingFields: getMissingConfirmationMandatoryFields(row)
    };
  }

  const isSameDeptSec = typeof recordOrIsCreator === 'object' && recordOrIsCreator
    ? isUserInSameDepartmentAsRecord(recordOrIsCreator, currentUser, employeeDatabase)
    : false;
  const hasAccess = Boolean(isAdmin || isCreator || isSameDeptSec);
  const missingFields = getMissingConfirmationMandatoryFields(row);
  if (readOnly || !hasAccess) {
    return {
      allowed: false,
      isCreator: Boolean(!readOnly && (isCreator || isSameDeptSec)),
      isAdmin,
      reason: 'creator_only',
      missingFields
    };
  }
  if (missingFields.length > 0) {
    return {
      allowed: false,
      isCreator: Boolean(isCreator || isSameDeptSec),
      isAdmin,
      reason: 'missing_mandatory_fields',
      missingFields
    };
  }
  return {
    allowed: true,
    isCreator: Boolean(isCreator || isSameDeptSec),
    isAdmin,
    reason: null,
    missingFields: []
  };
}

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

  const staffName = String(row.staffName || '').trim();
  if (staffName) {
    const sLower = staffName.toLowerCase();
    const sUpper = staffName.toUpperCase();
    if (userNames.some(n => sLower === n || sLower.includes(n))) return true;
    if (userCodes.some(c => sUpper.includes(c))) return true;
  }

  return false;
}

export function isUserInResponsibleDepartment(row, user) {
  if (!user || !row) return false;

  // 1. Direct assignment as responsible staff
  if (isUserResponsibleForRow(row, user)) return true;

  // If a specific staff member is assigned to this row, ONLY that assigned employee has responsible access to this row!
  const hasExplicitStaffAssignment = Boolean(
    (row.staffName && String(row.staffName).trim()) ||
    (row.staffEmployee && String(row.staffEmployee).trim()) ||
    (row.staffId && String(row.staffId).trim()) ||
    (Array.isArray(row.staffEmployees) && row.staffEmployees.some(e => e?.name || e?.code || e?.id))
  );
  if (hasExplicitStaffAssignment) {
    return false;
  }

  // 2. Department matching: check selected Responsible Person Confirmation department(s) when no specific employee is assigned yet
  // When admin/creator selects a department, employees in that department get edit access to action columns
  const candidateDepts = new Set();

  // Check respDeptsByUnit object (e.g. { Bawal: ['Quality', 'Maintenance'], Gujrat: ['IT'] })
  if (row.respDeptsByUnit && typeof row.respDeptsByUnit === 'object') {
    Object.values(row.respDeptsByUnit).forEach(depts => {
      if (Array.isArray(depts)) {
        depts.forEach(d => {
          if (d && typeof d === 'string') candidateDepts.add(d.trim().toLowerCase());
        });
      }
    });
  }

  // Check responsiblePersonDept / respDept (can be comma-separated or single string)
  const respDept = row.responsiblePersonDept || row.respDept;
  if (respDept && typeof respDept === 'string' && respDept !== 'CFT') {
    respDept.split(/[,;]/).forEach(d => {
      const trimmed = d.trim().toLowerCase();
      if (trimmed) candidateDepts.add(trimmed);
    });
  }

  // Check staffEmployees
  if (Array.isArray(row.staffEmployees)) {
    row.staffEmployees.forEach(emp => {
      if (emp?.department) {
        candidateDepts.add(String(emp.department).trim().toLowerCase());
      }
    });
  }

  if (candidateDepts.size === 0) return false;

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

  const normalizedUserDepts = userDepts.map(d => String(d).trim().toLowerCase()).filter(Boolean);
  if (normalizedUserDepts.length === 0) return false;

  for (const ud of normalizedUserDepts) {
    for (const cd of candidateDepts) {
      if (ud === cd) return true;
    }
  }

  return false;
}

export function isUserResponsibleForAnyRow(rows, user) {
  if (!Array.isArray(rows) || !user) return false;
  return rows.some(r => isUserInResponsibleDepartment(r, user));
}

export function canUserEditPDCARow(row, user, record, targetColumn = null, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
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
  // 1. Sheet creator has full edit access across the entire row/sheet (including Confirmation)
  const isCreator = record && isRecordCreator(record, user);
  if (isCreator) {
    if (targetColumn) return true;
    return { canEditEntireRow: true, canEditActionCols: true };
  }

  // 2. Responsible person (assigned from Staff Name column) can ONLY edit the 6 action columns of THEIR OWN assigned row:
  // Root cause, Corrective Action, Counter Measure, Image After, Std. Duration in Min, Response Date
  // They CANNOT edit any other column or the entire row/sheet, CANNOT select Confirmation, and CANNOT edit other rows.
  const isResponsible = isUserResponsibleForRow(row, user);
  if (isResponsible) {
    if (targetColumn) return EDITABLE_RESPONSIBLE_COLUMNS.includes(targetColumn);
    return { canEditEntireRow: false, canEditActionCols: true };
  }

  // If user is assigned as a responsible person on another row in this sheet, they must ONLY have access to their own row, NOT other rows!
  const sheetRows = Array.isArray(record?.sheet?.rows) ? record.sheet.rows : (Array.isArray(record?.rows) ? record.rows : []);
  const isAssignedResponsibleInSheet = sheetRows.length > 0 && sheetRows.some(r => isUserResponsibleForRow(r, user));
  if (isAssignedResponsibleInSheet) {
    if (targetColumn) return false;
    return { canEditEntireRow: false, canEditActionCols: false };
  }

  // 3. Colleague in the SAME department AND SAME section has the SAME access as sheet creator (full access of the sheet including Confirmation)
  const isSameDeptSec = record && isUserInSameDepartmentAsRecord(record, user, employeeDatabase);
  if (isSameDeptSec) {
    if (targetColumn) return true;
    return { canEditEntireRow: true, canEditActionCols: true };
  }

  // 3. User in responsible department (if designated) can edit action columns
  const isRespDept = isUserInResponsibleDepartment(row, user);
  if (isRespDept) {
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

export function getUserPrimarySection(user, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!user || typeof user !== 'object') return '';
  const direct = user.sectionName ||
    (typeof user.section === 'string' ? user.section : user.section?.name) ||
    (Array.isArray(user.sections) && user.sections.length > 0 ? (typeof user.sections[0] === 'string' ? user.sections[0] : user.sections[0]?.name) : '') ||
    user.subSectionName ||
    (typeof user.subSection === 'string' ? user.subSection : user.subSection?.name) ||
    '';
  if (direct && typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }
  const userCode = user.code || user.empId || user.employeeId || user.empCode || user.userName || '';
  const userName = user.name || user.fullName || '';
  const userId = user.id || user._id || user.userId || '';
  const db = Array.isArray(employeeDatabase) && employeeDatabase.length > 0 ? employeeDatabase : VERIFIED_EMPLOYEE_MASTER;
  if (userCode || userName || userId) {
    const matched = db.find(e => {
      const eCode = String(e.code || e.empId || e.employeeId || e.userName || e.id || '').trim().toUpperCase();
      const eName = String(e.name || e.fullName || '').trim().toLowerCase();
      if (userCode && eCode && eCode === String(userCode).trim().toUpperCase()) return true;
      if (userId && String(e.id || e._id || '').trim() === String(userId).trim()) return true;
      if (userName && eName && eName === String(userName).trim().toLowerCase()) return true;
      return false;
    });
    if (matched) {
      const sec = matched.sectionName || (typeof matched.section === 'string' ? matched.section : matched.section?.name) ||
        (Array.isArray(matched.sections) && matched.sections[0] ? (typeof matched.sections[0] === 'string' ? matched.sections[0] : matched.sections[0]?.name) : '');
      if (sec && typeof sec === 'string' && sec.trim()) return sec.trim();
    }
  }
  return '';
}

export function getUserPrimaryDepartment(user, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!user || typeof user !== 'object') return '';
  const direct = user.deptName ||
    (typeof user.department === 'string' ? user.department : user.department?.name) ||
    (Array.isArray(user.departments) && user.departments.length > 0 ? (typeof user.departments[0] === 'string' ? user.departments[0] : user.departments[0]?.name) : '');
  if (direct && typeof direct === 'string' && direct.trim() && direct.trim().toLowerCase() !== 'cft') {
    return direct.trim();
  }
  const userCode = user.code || user.empId || user.employeeId || user.empCode || user.userName || '';
  const userName = user.name || user.fullName || '';
  const dbDept = findEmployeeDepartment({ name: userName, code: userCode }, employeeDatabase) ||
    findEmployeeDepartment({ name: userName, code: userCode }, VERIFIED_EMPLOYEE_MASTER);
  if (dbDept) return dbDept;
  const depts = getUserDepartments(user, employeeDatabase);
  if (depts.length > 0) {
    return depts[0].charAt(0).toUpperCase() + depts[0].slice(1);
  }
  return '';
}

export function canAccessRecord(record, currentUser, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!record) return false;
  if (!currentUser) return true;
  const isAdmin = Boolean(
    currentUser?.isAdmin === true ||
    currentUser?.isAdmin === 1 ||
    String(currentUser?.role || '').toUpperCase() === 'ADMIN' ||
    String(currentUser?.role || '').toUpperCase() === 'SUPERADMIN'
  );
  if (isAdmin) return true;
  return isRecordCreator(record, currentUser) || isUserInSameDepartmentAsRecord(record, currentUser, employeeDatabase);
}

/**
 * Checks whether a specific PDCA row belongs to a given department.
 * Checks observation department, responsible person department, unit mappings,
 * and assigned staff employee departments.
 */
export function doesRowBelongToDepartment(row, deptName, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!row || !deptName) return false;
  const rawTarget = String(deptName).trim().toLowerCase();
  if (!rawTarget || rawTarget === 'all departments' || rawTarget === 'all department') return true;
  const targetNorm = normalizeDepartmentName(rawTarget) || rawTarget;

  const matchesNormOrDirect = (candidate) => {
    if (!candidate) return false;
    const cLow = String(candidate).trim().toLowerCase();
    if (cLow === rawTarget) return true;
    const cNorm = normalizeDepartmentName(cLow);
    return Boolean(cNorm && cNorm === targetNorm);
  };

  // 1. Observation department
  if (row.department && matchesNormOrDirect(row.department)) {
    return true;
  }
  if (Array.isArray(row.departments)) {
    if (row.departments.some(d => matchesNormOrDirect(d))) return true;
  }

  // 2. Responsible Person Dept (single string or comma/semicolon separated)
  const respDept = row.responsiblePersonDept || row.respDept;
  if (respDept && typeof respDept === 'string') {
    const parts = respDept.split(/[,;]/).map(d => d.trim());
    if (parts.some(p => matchesNormOrDirect(p))) return true;
  }

  // 3. respDeptsByUnit object
  if (row.respDeptsByUnit && typeof row.respDeptsByUnit === 'object') {
    for (const depts of Object.values(row.respDeptsByUnit)) {
      if (Array.isArray(depts) && depts.some(d => matchesNormOrDirect(d))) {
        return true;
      }
    }
  }

  // 4. staffEmployees list
  if (Array.isArray(row.staffEmployees)) {
    for (const emp of row.staffEmployees) {
      if (emp?.department && matchesNormOrDirect(emp.department)) {
        return true;
      }
    }
  }

  // 5. Check staffName / staffEmployee in employeeDatabase
  const staffStr = String(row.staffName || row.staffEmployee || '').trim();
  if (staffStr) {
    const sLower = staffStr.toLowerCase();
    const listToSearch = Array.isArray(employeeDatabase) && employeeDatabase.length > 0
      ? employeeDatabase
      : VERIFIED_EMPLOYEE_MASTER;
    const matched = listToSearch.find(e => {
      const eName = String(e?.name || '').trim().toLowerCase();
      const eCode = String(e?.code || e?.empId || '').trim().toLowerCase();
      return (eName && (sLower === eName || sLower.includes(eName))) ||
             (eCode && (sLower === eCode || sLower.includes(eCode)));
    });
    if (matched?.department && matchesNormOrDirect(matched.department)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns all active rows in a PDCA sheet that belong to a specific department.
 */
export function getSheetPointsForDepartment(sheet, deptName, employeeDatabase = VERIFIED_EMPLOYEE_MASTER) {
  if (!sheet) return [];
  const rows = resolvePDCASheetRows(sheet);
  const activeRows = rows.filter(isActivePDCARow);
  if (!deptName || String(deptName).trim().toLowerCase() === 'all departments') {
    return activeRows;
  }

  const rawTarget = String(deptName).trim().toLowerCase();
  const targetNorm = normalizeDepartmentName(rawTarget) || rawTarget;

  const matchingRows = activeRows.filter(r => doesRowBelongToDepartment(r, deptName, employeeDatabase));

  // If sheet was created in Department page with sheet.department === target,
  // and some active rows have no explicit department, they also belong to this department
  const sheetDeptNorm = normalizeDepartmentName(sheet.department || '') || String(sheet.department || '').trim().toLowerCase();
  if (matchingRows.length === 0 && (sheetDeptNorm === targetNorm || String(sheet.department || '').trim().toLowerCase() === rawTarget)) {
    return activeRows;
  }

  return matchingRows;
}

/**
 * Returns all active rows in a PDCA sheet that are assigned to a specific user.
 */
export function getSheetPointsForUser(sheet, user) {
  if (!sheet || !user) return [];
  const rows = resolvePDCASheetRows(sheet);
  const activeRows = rows.filter(isActivePDCARow);

  // Return points where user is responsible
  const userRows = activeRows.filter(r => isUserResponsibleForRow(r, user));

  // If the sheet itself was created by user as Self PDCA and has active rows without other staff
  if (userRows.length === 0 && (sheet.isSelf || sheet.scope === 'Self PDCA') && isRecordCreator(sheet, user)) {
    return activeRows;
  }

  return userRows;
}

/**
 * Classifies a PDCA sheet into Section ('Ongoing' | 'Done') and Sub-Section
 * ('Not-Started' | 'In-Progress' | 'Delay' | 'Done') based on scope and visibility rules.
 *
 * Rules:
 * - Plant: based on ALL points of the sheet.
 * - Department: based ONLY on points assigned to the target department.
 * - Self PDCA: based ONLY on points assigned to the logged-in employee.
 * - If all relevant points are Done -> Section is 'Done' (SubSection: 'Done').
 * - If not all relevant points are Done -> Section is 'Ongoing':
 *   - Any point is Delay -> 'Delay'
 *   - Any point is In-Progress (or Done with pending) -> 'In-Progress'
 *   - All points are Not-Started -> 'Not-Started'
 */
export function classifyPDCASheetStatus(sheet, scope = 'Company', options = {}) {
  const { targetDept, currentUser, currentDateStr, employeeDatabase = VERIFIED_EMPLOYEE_MASTER } = options;

  let relevantRows = [];
  if (scope === 'Self PDCA') {
    relevantRows = getSheetPointsForUser(sheet, currentUser);
  } else if (scope === 'Department') {
    const deptToUse = targetDept || getUserPrimaryDepartment(currentUser, employeeDatabase) || sheet.department;
    relevantRows = getSheetPointsForDepartment(sheet, deptToUse, employeeDatabase);
  } else {
    // Plant / Company scope: evaluate all active rows
    const allRows = resolvePDCASheetRows(sheet);
    relevantRows = allRows.filter(isActivePDCARow);
  }

  let done = 0;
  let delay = 0;
  let inProgress = 0;
  let notStarted = 0;

  if (relevantRows.length === 0) {
    const sheetStatus = normalizePDCAStatus(sheet.status);
    if (sheetStatus === 'Done') done = 1;
    else if (sheetStatus === 'Delay') delay = 1;
    else if (sheetStatus === 'In- Progress') inProgress = 1;
    else notStarted = 1;
  } else {
    relevantRows.forEach(r => {
      const st = getEffectivePDCARowStatus(r, currentDateStr);
      if (st === 'Done') done++;
      else if (st === 'Delay') delay++;
      else if (st === 'In- Progress') inProgress++;
      else notStarted++;
    });
  }

  const total = relevantRows.length || 1;

  let section = 'Ongoing';
  let subSection = 'Not-Started';

  // Rule: If all points are Done -> Done section
  if (done === total && total > 0) {
    section = 'Done';
    subSection = 'Done';
  } else {
    section = 'Ongoing';
    if (delay > 0) {
      subSection = 'Delay';
    } else if (inProgress > 0 || done > 0) {
      subSection = 'In-Progress';
    } else {
      subSection = 'Not-Started';
    }
  }

  return {
    section,
    subSection,
    statusSummary: {
      inProgress,
      done,
      delay,
      notStarted,
      total: done + delay + inProgress + notStarted
    },
    relevantPointsCount: relevantRows.length
  };
}

/**
 * Returns the list of sheets visible in a given scope (Plant, Department, Self PDCA, CFT),
 * adhering to visibility rules and preventing duplicates.
 */
export function getPDCAVisibleSheets(data, plant, scope, options = {}) {
  const {
    department = '',
    currentUser = null,
    search = '',
    dateFilter = '',
    fromDate = '',
    toDate = '',
    employeeDatabase = VERIFIED_EMPLOYEE_MASTER
  } = options;

  if (!Array.isArray(data)) return [];

  const query = (search || '').toLowerCase().trim();
  const deptFilter = (department || '').toLowerCase().trim();

  // 1. Filter by plant, dates, search query
  const plantMatches = data.filter(item => {
    if (!matchesPlant(item, plant)) return false;
    if (!matchesDate(item, dateFilter)) return false;
    if (!matchesDateRange(item, fromDate, toDate)) return false;
    if (query) {
      const matchQuery = [item.topic, item.description, item.id, item.department, item.createdBy?.name, item.createdBy?.code]
        .some(val => String(val || '').toLowerCase().includes(query));
      if (!matchQuery) return false;
    }
    return true;
  });

  // 2. Filter by scope with visibility & plant-to-dept rules
  const results = [];
  const seenIds = new Set();

  if (scope === 'Company') {
    // Plant page: show sheets created under Plant (Company) scope
    plantMatches.forEach(item => {
      if (item.scope === 'Company' || (!item.scope && !item.isSelf)) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else if (scope === 'Department') {
    // Department page:
    // User sees Department sheets AND Plant sheets containing points for the department
    const userPrimaryDept = getUserPrimaryDepartment(currentUser, employeeDatabase);
    const targetDept = deptFilter || (userPrimaryDept ? userPrimaryDept.toLowerCase() : '');
    const targetDeptNorm = targetDept ? (normalizeDepartmentName(targetDept) || targetDept) : '';

    plantMatches.forEach(item => {
      const itemDept = String(item.department || '').trim().toLowerCase();
      const itemDeptNorm = normalizeDepartmentName(itemDept) || itemDept;

      // Case A: Sheet was created in Department page
      const isDeptSheet = item.scope === 'Department';
      const matchesDeptDirectly = isDeptSheet && (!targetDept || itemDeptNorm === targetDeptNorm || itemDept === targetDept);

      // Case B: Sheet was created in Plant page (Company/Plant or legacy) and contains points for target department
      const isPlantSheet = item.scope === 'Company' || item.scope === 'Plant' || (!item.scope && !item.isSelf);
      let hasPointsForDept = false;
      if (isPlantSheet) {
        if (targetDept) {
          const deptPoints = getSheetPointsForDepartment(item, targetDept, employeeDatabase);
          hasPointsForDept = deptPoints.length > 0;
        } else {
          // If no specific targetDept is specified, show any plant sheet that has assigned department points
          const allPoints = resolvePDCASheetRows(item).filter(isActivePDCARow);
          hasPointsForDept = allPoints.some(r => r.department || r.responsiblePersonDept || r.respDept || (Array.isArray(r.departments) && r.departments.length > 0) || r.staffName || r.staffEmployee);
        }
      }

      if (matchesDeptDirectly || hasPointsForDept) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else if (scope === 'Self PDCA') {
    // Self PDCA page:
    // Display only sheets relevant to the logged-in employee:
    // Case A: Sheet created under Self PDCA scope by currentUser
    // Case B: Any sheet containing points assigned to currentUser
    plantMatches.forEach(item => {
      const isSelfSheet = (item.scope === 'Self PDCA' || item.isSelf) && currentUser && isRecordCreator(item, currentUser);
      const userPoints = currentUser ? getSheetPointsForUser(item, currentUser) : [];
      const hasAssignedPoints = userPoints.length > 0;

      if (isSelfSheet || hasAssignedPoints) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else if (scope === 'CFT') {
    plantMatches.forEach(item => {
      if (item.scope === 'CFT') {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  } else {
    plantMatches.forEach(item => {
      if (item.scope === scope) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          results.push(item);
        }
      }
    });
  }

  return results;
}

/**
 * Filters visible sheets by active section ('Ongoing' | 'Done') and sub-section
 * ('Not-Started' | 'In-Progress' | 'Delay' | 'Done' | 'All').
 */
export function filterPDCARecordsBySection(sheets, scope, activeSection, activeSubSection, options = {}) {
  if (!Array.isArray(sheets)) return [];
  if (scope === 'CFT') return sheets;

  return sheets.filter(sheet => {
    const classification = classifyPDCASheetStatus(sheet, scope, options);

    // Section matching: 'Ongoing' or 'Done'
    if (activeSection && classification.section !== activeSection) {
      return false;
    }

    // SubSection matching: 'Not-Started' | 'In-Progress' | 'Delay' | 'Done' | 'All'
    if (activeSubSection && activeSubSection !== 'All') {
      if (classification.subSection !== activeSubSection) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculates counts of sheets in Ongoing, Done, Not-Started, In-Progress, Delay.
 */
export function getPDCASectionCounts(sheets, scope, options = {}) {
  const counts = {
    Ongoing: 0,
    Done: 0,
    'Not-Started': 0,
    'In-Progress': 0,
    Delay: 0
  };

  if (!Array.isArray(sheets) || scope === 'CFT') return counts;

  sheets.forEach(sheet => {
    const { section, subSection } = classifyPDCASheetStatus(sheet, scope, options);
    if (section === 'Ongoing') {
      counts.Ongoing++;
      if (subSection === 'Not-Started') counts['Not-Started']++;
      else if (subSection === 'In-Progress') counts['In-Progress']++;
      else if (subSection === 'Delay') counts.Delay++;
    } else if (section === 'Done') {
      counts.Done++;
    }
  });

  return counts;
}
