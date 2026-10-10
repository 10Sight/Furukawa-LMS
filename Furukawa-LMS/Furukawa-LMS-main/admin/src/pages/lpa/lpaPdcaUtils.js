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

export function getScoreForObservation(val) {
  const normalized = normalizeObservationSymbol(val);
  if (normalized === 'Ο') return 3;
  if (normalized === 'Δ') return 3;
  if (normalized === 'Χ') return 0;
  if (normalized === 'NA') return 'NA';
  return '';
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
export function getLpaPdcaTopic({ section, unit, level, date, records = [], templates = {} }) {
  const storageId = `PDCA-LPA-${(section || 'all').toUpperCase()}-${unit || 'Bawal'}-${level || 'L1'}-${date || 'latest'}`;
  const localCacheKey = `lpa_pdca_saved_${storageId}`;

  // Check saved copy in localStorage first
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(localCacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.rows)) {
          return {
            id: storageId,
            topic: 'PDCA - M Tanaka San Audit',
            scope: 'Company',
            plant: unit || 'Bawal',
            sheet: parsed
          };
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

  // Convert to PDCA rows
  const finalRows = prioritized.map((item, idx) =>
    createEmptyPdcaRow({
      date: item.date || date,
      shift: item.shift || '',
      status: item.status || 'Open',
      lineArea: item.lineArea || '',
      observation: item.observation || '',
      department: item.department || (section === 'cc' ? 'Die Casting' : 'Wiring Harness')
    })
  );

  // Pad up to at least 10 rows (matching Screenshot 1)
  while (finalRows.length < 10) {
    finalRows.push(createEmptyPdcaRow({ date, shift: '', status: 'Open' }));
  }

  const defaultTopic = {
    id: storageId,
    topic: 'PDCA - M Tanaka San Audit',
    scope: 'Company',
    plant: unit || 'Bawal',
    sheet: {
      rows: finalRows,
      headerInfo: {
        topicName: '',
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
