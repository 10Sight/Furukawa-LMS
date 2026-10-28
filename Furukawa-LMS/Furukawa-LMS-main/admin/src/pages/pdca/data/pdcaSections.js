/**
 * Verified Section Master Data
 * 36 Section records mapped to database IDs, Section Names, Section Codes (uniCode), and Categories.
 */
export const VERIFIED_SECTION_MASTER = [
  { id: 70, name: 'Assembly Quality', uniCode: 'WQ1-4', category: 'Quality' },
  { id: 74, name: 'Assembly Production', uniCode: 'WAP1-8', category: 'Assembly' },
  { id: 75, name: 'Assembly Production (Support team)', uniCode: 'WAP1-7', category: 'Assembly' },
  { id: 78, name: 'AIRBAG SUB-ASSEMBLY', uniCode: 'WAP1-6', category: 'Assembly' },
  { id: 79, name: 'TUBE CUTTING', uniCode: 'WAP1-5', category: 'Assembly' },
  { id: 80, name: 'SPD', uniCode: 'WAP1-4', category: 'Assembly' },
  { id: 82, name: 'ASSEMBLY SUB LEADER', uniCode: 'WAP1-3', category: 'Assembly' },
  { id: 85, name: 'PRODUCTION OFFICE', uniCode: 'WAP1-1', category: 'Assembly' },
  { id: 87, name: 'Quality C&C', uniCode: 'WQ1-5', category: 'Quality' },
  { id: 94, name: 'Assembly Quality (Line Leader)', uniCode: 'WQ1-3', category: 'Quality' },
  { id: 95, name: 'CSG + 3T (Quality)', uniCode: 'WQ1-2', category: 'Quality' },
  { id: 96, name: 'SRC Quality', uniCode: 'SRC1-4', category: 'SRC' },
  { id: 98, name: 'SRC- Production', uniCode: 'SRC1-2', category: 'SRC' },
  { id: 99, name: 'Quality Lab', uniCode: 'WQ1-1', category: 'Quality' },
  { id: 100, name: 'Training cell', uniCode: 'TC01', category: 'Training' },
  { id: 104, name: 'JB', uniCode: 'SRC1-1', category: 'SRC' },
  { id: 105, name: 'Safety', uniCode: 'SF1-1', category: 'Safety' },
  { id: 106, name: 'Store', uniCode: 'STR1-1', category: 'Store' },
  { id: 107, name: 'FG (Bawal +3T+TTIPL)', uniCode: 'FG1-1', category: 'FG' },
  { id: 108, name: 'Logistics', uniCode: 'FG1-2', category: 'Logistics' },
  { id: 109, name: 'PPC (Name Tag Printing)', uniCode: 'PP1-1', category: 'PPC' },
  { id: 110, name: 'PE', uniCode: 'PE1-1', category: 'PE' },
  { id: 111, name: 'Maintenance', uniCode: 'MT1-1', category: 'Maintenance' },
  { id: 113, name: 'IT', uniCode: 'IT01-1', category: 'IT' },
  { id: 115, name: 'D&D', uniCode: 'DD1-1', category: 'D&D' },
  { id: 116, name: 'Assembly (Rework/Material Handler/Trainer/Support)', uniCode: 'WAP1-2', category: 'Assembly' },
  { id: 117, name: 'Quality Office ( Reports)', uniCode: 'WQ1-6', category: 'Quality' },
  { id: 118, name: '200% Manpower', uniCode: 'WQ1-7', category: 'Quality' },
  { id: 120, name: 'SRC Maintenance', uniCode: 'SRC1-5', category: 'SRC' },
  { id: 121, name: 'C&C machine', uniCode: 'WCP1-5', category: 'CRIMPING' },
  { id: 122, name: 'C&C other', uniCode: 'WCP1-4', category: 'CRIMPING' },
  { id: 123, name: 'C&C (Leader, rework, material handler, rolling,)', uniCode: 'WCP1-3', category: 'CRIMPING' },
  { id: 124, name: 'SFG Confirmation _C&C & Document', uniCode: 'WCP1-2', category: 'CRIMPING' },
  { id: 125, name: 'Utility', uniCode: 'MT1-01', category: 'Maintenance' },
  { id: 126, name: 'SFG Confirmation', uniCode: 'WAP1-9', category: 'Assembly' },
  { id: 128, name: 'GA', uniCode: 'GA01', category: 'GA' }
];

export function findSectionById(id) {
  if (id == null) return null;
  return VERIFIED_SECTION_MASTER.find((s) => String(s.id) === String(id)) || null;
}

export function findSectionByName(name) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.trim().toLowerCase();
  return VERIFIED_SECTION_MASTER.find((s) => s.name?.trim().toLowerCase() === lower) || null;
}

/**
 * Validates whether a given section belongs to or is related to a specified department.
 * Supports section objects, IDs, or string names.
 * When no department is specified, returns true to keep all sections available.
 */
export function isSectionRelatedToDepartment(sec, department) {
  if (!department || typeof department !== 'string' || !department.trim()) {
    return true;
  }
  if (!sec) return false;

  const secObj =
    typeof sec === 'string'
      ? findSectionByName(sec) || { name: sec }
      : typeof sec === 'number'
      ? findSectionById(sec) || { id: sec }
      : sec;

  const dept = department.trim().toLowerCase();
  const category = (secObj.category || '').trim().toLowerCase();
  const secDept = (secObj.department || '').trim().toLowerCase();
  const name = (secObj.name || '').trim().toLowerCase();

  // Explicit department property match
  if (secDept && secDept === dept) {
    return true;
  }

  switch (dept) {
    case 'c&c':
    case 'crimping':
    case 'cutting & crimping':
    case 'cutting and crimping':
    case 'cutting & crimping (c&c)':
    case 'cutting':
      if (category === 'quality') return false;
      return (
        category === 'crimping' ||
        category === 'c&c' ||
        category === 'cutting & crimping' ||
        name.startsWith('c&c') ||
        name.includes('c&c') ||
        name.includes('crimping') ||
        name.includes('cutting')
      );

    case 'assembly':
      // Assembly Quality belongs to Quality
      if (category === 'quality') return false;
      return category === 'assembly';

    case 'quality':
      return category === 'quality';

    case 'src':
      return category === 'src';

    case 'maintenance':
      return category === 'maintenance' || category === 'utility' || name === 'utility';

    case 'store':
    case 'stores':
      return category === 'store' || category === 'stores';

    case 'fg':
    case 'logistics':
      return category === 'fg' || category === 'logistics';

    case 'safety':
      return category === 'safety';

    case 'pe':
      return category === 'pe';

    case 'it':
      return category === 'it';

    case 'ppc':
      return category === 'ppc';

    case 'd&d':
    case 'dd':
      return category === 'd&d' || category === 'dd';

    case 'hr':
    case 'training':
    case 'ga':
      return (
        category === 'hr' ||
        category === 'training' ||
        category === 'ga' ||
        name.includes('training') ||
        name === 'ga'
      );

    default:
      return category === dept || secDept === dept || name.includes(dept);
  }
}
