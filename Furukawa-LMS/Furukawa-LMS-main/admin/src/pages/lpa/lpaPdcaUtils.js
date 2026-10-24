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

export function getWorksheetScoresList(sheet, record = null) {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0) {
    return [{ label: 'L3', percentage: '0%', rawPct: 0 }];
  }

  const isCc = String(record?.section || sheet.section || '').toLowerCase() === 'cc';
  const startRow = isCc ? 4 : 3;
  const marksCol = isCc ? 5 : 4;
  const startAuditCol = isCc ? 7 : 5;

  // Find legendStart
  const legendStart = sheet.merges?.find(merge => merge.s.c === 0 && merge.e.c <= 2 && merge.s.r > 25)?.s.r ?? -1;
  const endRow = legendStart > 0 ? Math.min(legendStart, 37) : (isCc ? 35 : 37);

  // Discover all audit column pairs (Observation + Score)
  const colPairs = [];
  const headerRow1 = sheet.rows[isCc ? 2 : 1] || [];
  const colCount = Math.max(sheet.columnCount || 0, headerRow1.length);

  for (let c = startAuditCol; c < colCount; c += 2) {
    const headerText = String(headerRow1[c]?.value ?? headerRow1[c]?.formatted ?? '').trim();
    let level = 'L3';
    let shift = null;

    if (/l1/i.test(headerText) || /monthly/i.test(headerText) || /level\s*1/i.test(headerText)) {
      level = 'L1';
    } else if (/l2/i.test(headerText) || /weekly/i.test(headerText) || /level\s*2/i.test(headerText)) {
      level = 'L2';
    } else if (/l3/i.test(headerText) || /daily/i.test(headerText) || /level\s*3/i.test(headerText)) {
      level = 'L3';
      const m = headerText.match(/shift\s*([ABC])/i);
      if (m) shift = m[1].toUpperCase();
    } else if (c === startAuditCol && record?.level) {
      level = record.level;
    }

    colPairs.push({
      obsCol: c,
      scoreCol: c + 1,
      level,
      shift,
      headerText
    });
  }

  if (colPairs.length === 0) {
    colPairs.push({
      obsCol: startAuditCol,
      scoreCol: startAuditCol + 1,
      level: record?.level || 'L3',
      shift: record?.shift || null,
      headerText: 'Level 3'
    });
  }

  const l3Count = colPairs.filter(p => p.level === 'L3').length;
  const results = [];

  for (const pair of colPairs) {
    let applicableMarksSum = 0;
    let scoreSum = 0;

    for (let r = startRow; r < endRow; r++) {
      const row = sheet.rows[r];
      if (!row || !Array.isArray(row)) continue;
      const isTotal = row.some(cell => /total/i.test(String(cell?.value ?? cell?.formatted ?? '')));
      if (isTotal) break;

      const marksNum = Number(row[marksCol]?.value ?? row[marksCol]?.formatted ?? 1);
      const safeMarks = Number.isFinite(marksNum) && marksNum > 0 ? marksNum : 1;
      const obs = normalizeObservationSymbol(row[pair.obsCol]?.value ?? row[pair.obsCol]?.formatted);
      const scoreVal = row[pair.scoreCol]?.value ?? row[pair.scoreCol]?.formatted;

      if (obs === 'NA') continue;

      applicableMarksSum += safeMarks;

      if (scoreVal !== '' && scoreVal !== 'NA' && scoreVal != null) {
        const numScore = Number(scoreVal);
        if (Number.isFinite(numScore)) {
          scoreSum += numScore;
        }
      }
    }

    // Integer percentage like "68%" without decimal points
    const pctNumber = applicableMarksSum > 0 ? Math.round((scoreSum / applicableMarksSum) * 100) : 0;
    const fullLevelName = pair.level === 'L3' ? 'Level 3' : pair.level === 'L2' ? 'Level 2' : pair.level === 'L1' ? 'Level 1' : pair.level;
    let label = fullLevelName;
    if (pair.level === 'L3' && pair.shift && l3Count > 1) {
      label = `Level 3 (Shift ${pair.shift})`;
    }

    results.push({
      level: pair.level,
      shift: pair.shift,
      label,
      percentage: `${pctNumber}%`,
      rawPct: pctNumber
    });
  }

  return results.length > 0 ? results : [{ label: 'Level 3', percentage: '0%', rawPct: 0 }];
}

export function getWorksheetScore(sheet, record = null) {
  const scores = getWorksheetScoresList(sheet, record);
  if (scores.length === 1) {
    return scores[0].percentage;
  }
  return scores.map(s => `${s.label} - ${s.percentage}`).join(' \n');
}


export function createEmptyPdcaRow(customDefaults = {}) {
  return {
    date: customDefaults.date || '',
    shift: customDefaults.shift || '',
    lineArea: customDefaults.lineArea || '',
    status: customDefaults.status || '',
    observation: customDefaults.observation || '',
    imageBefore: customDefaults.imageBefore || null,
    imageBeforeName: customDefaults.imageBeforeName || '',
    fileTypeBefore: customDefaults.fileTypeBefore || 'image',
    rootCause: customDefaults.rootCause || '',
    actionTaken: customDefaults.actionTaken || '',
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
      date: '',
      shift: item.shift || (idx % 2 === 0 ? 'A' : 'B'),
      status: '',
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
      date: '',
      shift: finalRows.length % 2 === 0 ? 'A' : 'B',
      status: '',
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
