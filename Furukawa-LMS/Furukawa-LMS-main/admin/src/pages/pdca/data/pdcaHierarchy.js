import { VERIFIED_SECTION_MASTER } from './pdcaSections.js';
import VERIFIED_SECTIONS_WITH_LINES from './pdcaSectionsWithLines.json' with { type: 'json' };

export { VERIFIED_SECTIONS_WITH_LINES };

/**
 * Standard Department to Database Department ID mapping (Furukawa LMS)
 */
export const DEPARTMENT_ID_MAPPING = {
  'PE': 49,
  'IT': 51,
  'Quality': 61,
  'Assembly': 62,
  'SRC': 63,
  'Store': 64,
  'HR': 66,
  'Safety': 67,
  'FG': 68,
  'PPC': 69,
  'Maintenance': 70,
  'D&D': 71,
  'C&C': 72
};

/**
 * Checks whether a Section belongs to a Department based on:
 * 1. Database departmentId
 * 2. Explicit departmentName / department property
 * 3. Section category / name semantic mapping
 */
export function doesSectionBelongToDept(sec, deptName) {
  if (!deptName || !sec) return false;
  const d = String(deptName).trim().toLowerCase();
  
  // 1. Direct ID match
  const targetId = DEPARTMENT_ID_MAPPING[deptName] ||
    Object.entries(DEPARTMENT_ID_MAPPING).find(([k]) => k.toLowerCase() === d)?.[1];
  const secDeptId = Number(sec.departmentId ?? sec.department);
  if (targetId && secDeptId === targetId) return true;

  // 2. Direct department name match
  const sDept = String(sec.departmentName || sec.department || '').trim().toLowerCase();
  if (sDept && (sDept === d || sDept.includes(d) || d.includes(sDept))) return true;

  // 3. Category & name matching for verified fallback
  const cat = String(sec.category || '').trim().toLowerCase();
  const name = String(sec.name || '').trim().toLowerCase();

  switch (d) {
    case 'assembly':
      if (cat === 'quality' || name.includes('quality')) return false;
      return secDeptId === 62 || cat === 'assembly' || name.includes('assembly') || name === 'spd' || name === 'tube cutting' || name === 'airbag sub-assembly';

    case 'quality':
      return secDeptId === 61 || cat === 'quality' || name.includes('quality') || name.includes('200%') || name.includes('csg');

    case 'c&c':
    case 'crimping':
    case 'cutting & crimping':
    case 'cutting and crimping':
      if (cat === 'quality' || name.includes('quality')) return false;
      return secDeptId === 72 || cat === 'crimping' || cat === 'c&c' || name.includes('c&c') || name.includes('crimping');

    case 'maintenance':
      return secDeptId === 70 || cat === 'maintenance' || cat === 'utility' || name.includes('maintenance') || name.includes('utility');

    case 'src':
      return secDeptId === 63 || cat === 'src' || name.startsWith('src') || name === 'jb';

    case 'fg':
    case 'logistics':
      return secDeptId === 68 || cat === 'fg' || cat === 'logistics' || name.startsWith('fg') || name.includes('logistics');

    case 'store':
    case 'stores':
      return secDeptId === 64 || cat === 'store' || cat === 'stores' || name.includes('store');

    case 'safety':
      return secDeptId === 67 || cat === 'safety' || name.includes('safety');

    case 'pe':
      return secDeptId === 49 || cat === 'pe' || name === 'pe';

    case 'it':
      return secDeptId === 51 || cat === 'it' || name === 'it';

    case 'ppc':
      return secDeptId === 69 || cat === 'ppc' || name.includes('ppc');

    case 'd&d':
    case 'dd':
      return secDeptId === 71 || cat === 'd&d' || cat === 'dd' || name.includes('d&d');

    case 'hr':
    case 'training':
    case 'ga':
      return secDeptId === 66 || cat === 'training' || cat === 'ga' || cat === 'hr' || name.includes('training') || name === 'ga';

    default:
      return cat === d || name.includes(d);
  }
}

/**
 * Returns the list of Sections belonging exclusively to the specified Department.
 * If no Department is specified, returns an empty array.
 */
export function getSectionsForDepartment(deptName, sectionsList) {
  if (!deptName) return [];
  const list = Array.isArray(sectionsList) && sectionsList.length > 0
    ? sectionsList
    : (getCachedDbSections() || VERIFIED_SECTIONS_WITH_LINES || VERIFIED_SECTION_MASTER);

  const depts = Array.isArray(deptName) ? deptName.filter(Boolean) : [deptName];
  if (depts.length === 0) return [];

  return list.filter(sec => depts.some(d => doesSectionBelongToDept(sec, d)));
}

/**
 * Returns the list of Line/Areas belonging exclusively to the specified Section.
 * If no Section is specified, returns an empty array.
 */
export function getLineAreasForSection(sectionIdentifier, sectionsList) {
  if (!sectionIdentifier) return [];
  const list = Array.isArray(sectionsList) && sectionsList.length > 0
    ? sectionsList
    : (getCachedDbSections() || VERIFIED_SECTIONS_WITH_LINES);

  const sec = list.find(s =>
    String(s.id) === String(sectionIdentifier) ||
    String(s.name || '').trim().toLowerCase() === String(sectionIdentifier).trim().toLowerCase()
  );

  if (!sec || !Array.isArray(sec.lines)) return [];
  return sec.lines;
}

/**
 * Verifies if a given Line/Area belongs to a specified Section.
 */
export function isLineBelongingToSection(lineIdentifier, sectionIdentifier, sectionsList) {
  if (!lineIdentifier || !sectionIdentifier) return false;
  const lines = getLineAreasForSection(sectionIdentifier, sectionsList);
  return lines.some(l =>
    String(l.id) === String(lineIdentifier) ||
    String(l.name || '').trim().toLowerCase() === String(lineIdentifier).trim().toLowerCase()
  );
}
