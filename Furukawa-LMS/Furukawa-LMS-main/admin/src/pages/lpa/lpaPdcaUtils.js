export const OBSERVATION_OPTIONS = ['Ο', 'Δ', 'Χ', 'NA'];

export function normalizeObservationSymbol(val) {
  if (val === null || val === undefined || val === '') return '';
  const trimmed = String(val).trim();
  // Match Greek Ο, Latin O/o, white circle ○, heavy circle ⭕
  if (['Ο', 'O', 'o', '○', '⭕'].includes(trimmed)) return 'Ο';
  // Match Greek Δ, White Triangle △, Black Triangle ▲
  if (['Δ', '△', '▲'].includes(trimmed)) return 'Δ';
  // Match Greek Χ, Multiplication ×, Latin X/x, Cross ❌
  if (['Χ', '×', 'X', 'x', '❌'].includes(trimmed)) return 'Χ';
  if (trimmed.toUpperCase() === 'NA') return 'NA';
  return trimmed;
}

export function calculateAssemblyScore(observation, marks) {
  const normalized = normalizeObservationSymbol(observation);
  if (!normalized) return '';
  if (normalized === 'NA') return 'NA';
  if (normalized === 'Χ') return 0;

  const numMarks = Number(marks);
  const baseMarks = Number.isFinite(numMarks) ? numMarks : 0;

  if (normalized === 'Ο') {
    return Math.max(0, baseMarks);
  }
  if (normalized === 'Δ') {
    return Math.max(0, baseMarks - 1);
  }
  return '';
}

export function getScoreForObservation(val, marks) {
  const normalized = normalizeObservationSymbol(val);
  if (!normalized) return '';
  if (normalized === 'NA') return 'NA';
  if (normalized === 'Χ') return 0;

  const numMarks = Number(marks);
  const baseMarks = Number.isFinite(numMarks) ? numMarks : (marks === undefined || marks === null || marks === '' ? 3 : 0);

  if (normalized === 'Ο') {
    return Math.max(0, baseMarks);
  }
  if (normalized === 'Δ') {
    return Math.max(0, baseMarks - 1);
  }
  return '';
}

export function getWorksheetScore(sheet) {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0) return '-';
  if (sheet.scorePercentage) return sheet.scorePercentage;

  // 1. Check if any row has explicit percentage cell e.g. "Percentage (%):"
  for (let r = 0; r < Math.min(sheet.rows.length, 50); r++) {
    const row = sheet.rows[r];
    if (!Array.isArray(row)) continue;
    const isPctLabel = row.some(c => /percentage\s*\(/i.test(String(c?.value ?? c?.formatted ?? '')));
    if (isPctLabel) {
      for (const cell of row) {
        const text = String(cell?.value ?? cell?.formatted ?? '').trim();
        if (/^\d+(\.\d+)?%$/.test(text)) {
          return text;
        }
      }
    }
  }

  // 2. Dynamically locate marks, observation, and score columns
  let marksCol = -1;
  let obsCol = -1;
  let scoreCol = -1;
  for (const row of sheet.rows.slice(0, 8)) {
    if (!Array.isArray(row)) continue;
    const mIdx = row.findIndex(c => /^marks$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (mIdx >= 0 && marksCol < 0) marksCol = mIdx;
    const oIdx = row.findIndex(c => /^observation$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (oIdx >= 0 && obsCol < 0) obsCol = oIdx;
    const sIdx = row.findIndex(c => /^score$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (sIdx >= 0 && scoreCol < 0) scoreCol = sIdx;
  }

  if (marksCol < 0) marksCol = 4;
  if (obsCol < 0) obsCol = 5;
  if (scoreCol < 0) scoreCol = 6;

  // Find legendStart
  const legendStart = sheet.merges?.find(merge => merge.s.c === 0 && merge.e.c <= 2 && merge.s.r > 25)?.s.r ?? -1;
  const endRow = legendStart > 0 ? Math.min(legendStart, 37) : Math.min(sheet.rows.length, 37);

  let applicableMarksSum = 0;
  let scoreSum = 0;

  for (let r = 2; r < endRow; r++) {
    const row = sheet.rows[r];
    if (!row) continue;
    const isTotal = row.some(c => /total/i.test(String(c?.value ?? c?.formatted ?? '')));
    if (isTotal) break;
    const marksNum = Number(row[marksCol]?.value ?? row[marksCol]?.formatted);
    if (Number.isFinite(marksNum) && marksNum > 20) break; // Reached summary total row

    const obs = normalizeObservationSymbol(row[obsCol]?.value ?? row[obsCol]?.formatted);
    const scoreVal = row[scoreCol]?.value ?? row[scoreCol]?.formatted;

    if (obs === 'NA') continue;

    if (Number.isFinite(marksNum) && marksNum > 0) {
      applicableMarksSum += marksNum;
    }
    if (scoreVal !== '' && scoreVal !== 'NA' && scoreVal != null) {
      const numScore = Number(scoreVal);
      if (Number.isFinite(numScore)) {
        scoreSum += numScore;
      }
    }
  }

  if (applicableMarksSum > 0) {
    return `${((scoreSum / applicableMarksSum) * 100).toFixed(2)}%`;
  }
  return '0.00%';
}


export function createEmptyPdcaRow(customDefaults = {}) {
  return {
    date: customDefaults.date || '',
    shift: customDefaults.shift || '',
    lineArea: customDefaults.lineArea || '',
    status: customDefaults.status || 'Open',
    observation: customDefaults.observation || '',
    imageBefore: customDefaults.imageBefore || null,
    imageBeforeName: customDefaults.imageBeforeName || '',
    fileTypeBefore: customDefaults.fileTypeBefore || 'image',
    rootCause: customDefaults.rootCause || '',
    counterMeasure: customDefaults.counterMeasure || '',
    imageAfter: customDefaults.imageAfter || null,
    imageAfterName: customDefaults.imageAfterName || '',
    fileTypeAfter: customDefaults.fileTypeAfter || 'image',
    responseDate: customDefaults.responseDate || '',
    department: customDefaults.department || '',
    staffEmployee: customDefaults.staffEmployee || '',
    staffEmployees: Array.isArray(customDefaults.staffEmployees) ? customDefaults.staffEmployees : [],
    staffName: customDefaults.staffName || '',
    staffId: customDefaults.staffId || '',
    employeeId: customDefaults.employeeId || customDefaults.staffId || '',
    assignedEmployee: customDefaults.assignedEmployee || '',
    cftTopic: customDefaults.cftTopic || '',
    cftTopicId: customDefaults.cftTopicId || '',
    cftSelectedType: customDefaults.cftSelectedType || '',
    cftSelectedName: customDefaults.cftSelectedName || '',
    cftSelectedCode: customDefaults.cftSelectedCode || '',
    responsiblePersonConfirmation: customDefaults.responsiblePersonConfirmation || ''
  };
}

/**
 * Extracts observation rows from a workbook sheet (Assembly or C&C)
 */
export function extractObservationsFromSheet(sheet, record, date) {
  if (!sheet || !Array.isArray(sheet.rows)) return [];
  const rows = sheet.rows;
  const headerIndex = rows.slice(0, 8).findIndex(row =>
    row.some(cell => /^observation$/i.test(cell?.formatted ?? String(cell?.value ?? '')))
  );
  if (headerIndex < 0) return [];
  const headerRow = rows[headerIndex];
  const obsCol = headerRow.findIndex(cell => /^observation$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
  const checkCol = headerRow.findIndex(cell => /checks?\s*points?/i.test(cell?.formatted ?? String(cell?.value ?? '')));
  const areaCol = headerRow.findIndex(cell => /^area$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
  const focusCol = headerRow.findIndex(cell => /^focus$/i.test(cell?.formatted ?? String(cell?.value ?? '')));
  const sectionCol = headerRow.findIndex(cell => /^section$/i.test(cell?.formatted ?? String(cell?.value ?? '')));

  const section = record?.section || 'assembly';
  const defaultDept = section === 'assembly' ? 'Wiring Harness' : 'Die Casting';
  const extracted = [];
  let currentArea = '';

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const firstCell = String(row[0]?.formatted ?? row[0]?.value ?? '').trim();
    if (/^(legends?|total|auditor)/i.test(firstCell)) break;

    const checkText = String(row[checkCol >= 0 ? checkCol : 2]?.formatted ?? row[checkCol >= 0 ? checkCol : 2]?.value ?? '').trim();
    const obsVal = String(row[obsCol]?.formatted ?? row[obsCol]?.value ?? '').trim();
    const areaVal = String(row[areaCol >= 0 ? areaCol : -1]?.formatted ?? row[areaCol >= 0 ? areaCol : -1]?.value ?? '').trim();
    const focusVal = String(row[focusCol >= 0 ? focusCol : -1]?.formatted ?? row[focusCol >= 0 ? focusCol : -1]?.value ?? '').trim();
    const sectionVal = String(row[sectionCol >= 0 ? sectionCol : -1]?.formatted ?? row[sectionCol >= 0 ? sectionCol : -1]?.value ?? '').trim();
    if (areaVal) currentArea = areaVal;

    if (!checkText) continue;

    const normObs = normalizeObservationSymbol(obsVal);
    // Findings (non-conformance or items marked with symbols)
    const hasSymbol = Boolean(normObs);
    const isIssue = ['Χ', 'Δ'].includes(normObs);

    if (hasSymbol) {
      const lineArea = currentArea || focusVal || sectionVal || (section === 'assembly' ? 'Assembly Area' : 'C&C Area');
      extracted.push({
        date: record?.auditDate || date || new Date().toISOString().slice(0, 10),
        shift: '',
        status: isIssue ? 'Open' : 'Closed',
        lineArea,
        observation: checkText,
        department: defaultDept,
        isIssue
      });
    }
  }

  return extracted;
}

/**
 * Builds or loads PDCA Topic and rows from Assembly and/or C&C records.
 */
export function getLpaPdcaTopic({ section = 'assembly', unit = 'Bawal', level = 'L1', date, records = [], templates = {} }) {
  const sec = (section || 'assembly').toLowerCase();
  const secUpper = sec.toUpperCase();
  const plant = unit || 'Bawal';
  // Single permanent PDCA sheet per section (Assembly and C&C)
  const storageId = `PDCA-LPA-${secUpper}-${plant}`;
  const localCacheKey = `lpa_pdca_saved_${storageId}`;
  const targetTopicName = sec === 'cc' ? 'C&C - LPA Observation (PDCA)' : 'Assembly - LPA Observation (PDCA)';

  // Check saved copy in localStorage first
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(localCacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.rows)) {
          if (!parsed.headerInfo) parsed.headerInfo = {};
          if (!parsed.headerInfo.topicName || parsed.headerInfo.topicName === 'PDCA - M Tanaka San Audit') {
            parsed.headerInfo.topicName = targetTopicName;
          }
          return {
            id: storageId,
            topic: targetTopicName,
            section: sec,
            scope: 'Company',
            plant,
            sheet: parsed
          };
        }
      }

      // Check legacy caches if single cache not yet created
      const legacyKeys = [
        `lpa_pdca_saved_PDCA-LPA-${secUpper}-${plant}-${level || 'L1'}-${date || 'latest'}`,
        `lpa_pdca_saved_PDCA-LPA-${secUpper}-${plant}-${level || 'L1'}-latest`,
        `lpa_pdca_saved_PDCA-LPA-${secUpper}-${plant}-L1-${date || 'latest'}`
      ];
      for (const lk of legacyKeys) {
        const legSaved = localStorage.getItem(lk);
        if (legSaved) {
          const parsed = JSON.parse(legSaved);
          if (parsed && Array.isArray(parsed.rows)) {
            if (!parsed.headerInfo) parsed.headerInfo = {};
            if (!parsed.headerInfo.topicName || parsed.headerInfo.topicName === 'PDCA - M Tanaka San Audit') {
              parsed.headerInfo.topicName = targetTopicName;
            }
            localStorage.setItem(localCacheKey, JSON.stringify(parsed));
            return {
              id: storageId,
              topic: targetTopicName,
              section: sec,
              scope: 'Company',
              plant,
              sheet: parsed
            };
          }
        }
      }
    } catch (err) {
      console.error('Error loading saved LPA PDCA sheet', err);
    }
  }

  // Otherwise, extract from records
  const targetSections = section === 'all' ? ['assembly', 'cc'] : [section];
  let extractedRows = [];

  for (const sec of targetSections) {
    // Find matching records for this section, unit, level, and date
    let matching = records.filter(r =>
      r.section === sec &&
      (!r.unit || r.unit === unit) &&
      (!r.level || r.level === level) &&
      (!r.auditDate || r.auditDate === date)
    );

    // If none found for this date, try any matching record or the default template
    if (!matching.length) {
      matching = records.filter(r =>
        r.section === sec &&
        (!r.unit || r.unit === unit) &&
        (!r.level || r.level === level)
      );
    }

    if (!matching.length) {
      const tpl = sec === 'assembly' ? templates?.assemblyTemplate : templates?.ccTemplate;
      if (tpl) {
        matching = [{ ...tpl, unit, level, auditDate: date }];
      }
    }

    for (const rec of matching) {
      for (const sheet of rec.sheets || []) {
        const obs = extractObservationsFromSheet(sheet, rec, date);
        extractedRows.push(...obs);
      }
    }
  }

  // Prioritize issues (Χ, Δ) first if any exist
  const issueRows = extractedRows.filter(r => r.isIssue);
  const otherRows = extractedRows.filter(r => !r.isIssue);
  const prioritized = issueRows.length > 0 ? [...issueRows, ...otherRows] : extractedRows;

  const finalRows = prioritized.map((item, idx) => {
    return createEmptyPdcaRow({
      date: item.date || date,
      shift: item.shift || (idx % 2 === 0 ? 'A' : 'B'),
      status: item.status || 'Open',
      lineArea: item.lineArea || '',
      observation: item.observation || '',
      rootCause: item.rootCause || '',
      counterMeasure: item.counterMeasure || '',
      responseDate: item.responseDate || '',
      department: item.department || '',
      staffEmployee: item.staffEmployee || '',
      assignedEmployee: item.assignedEmployee || '',
      responsiblePersonConfirmation: item.responsiblePersonConfirmation || ''
    });
  });

  // Pad up to at least 10 rows with empty form rows
  while (finalRows.length < 10) {
    finalRows.push(createEmptyPdcaRow({
      date,
      shift: finalRows.length % 2 === 0 ? 'A' : 'B',
      status: 'Open',
      lineArea: '',
      observation: '',
      rootCause: '',
      counterMeasure: '',
      responseDate: '',
      department: '',
      staffEmployee: '',
      assignedEmployee: '',
      responsiblePersonConfirmation: ''
    }));
  }
  const defaultTopic = {
    id: storageId,
    topic: targetTopicName,
    section: sec,
    scope: 'Company',
    plant,
    sheet: {
      rows: finalRows,
      headerInfo: {
        topicName: targetTopicName,
        preparedBy: '',
        auditNo: '',
        attendees: ''
      }
    }
  };

  return defaultTopic;
}

export function saveLpaPdcaSnapshot(topicId, sheetSnapshot) {
  if (!topicId || !sheetSnapshot) return;
  const localCacheKey = `lpa_pdca_saved_${topicId}`;
  try {
    localStorage.setItem(localCacheKey, JSON.stringify(sheetSnapshot));
  } catch (err) {
    console.error('Failed to save LPA PDCA sheet', err);
  }
}

// Helper to determine if a PDCA record belongs to Assembly
export function isAssemblyRecord(record) {
  if (!record) return false;
  if (record.lpaSource?.category === 'assembly' || record.category === 'assembly' || record.lpaCategory === 'assembly') return true;
  const dept = (record.department || '').toLowerCase();
  const sec = (record.section || '').toLowerCase();
  const top = (record.topic || '').toLowerCase();
  return sec.includes('assembly') || dept.includes('assembly') || top.includes('assembly') || dept.includes('wiring harness');
}

// Helper to determine if a PDCA record belongs to C&C
export function isCcRecord(record) {
  if (!record) return false;
  if (record.lpaSource?.category === 'cc' || record.category === 'cc' || record.lpaCategory === 'cc') return true;
  const dept = (record.department || '').toLowerCase();
  const sec = (record.section || '').toLowerCase();
  const top = (record.topic || '').toLowerCase();
  return sec.includes('c&c') || dept.includes('c&c') || top.includes('c&c') || dept.includes('die casting') || sec.includes('die casting');
}
