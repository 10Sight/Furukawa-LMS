/**
 * LPA Authoritative Scoring and Calculation Engine
 * 
 * Rules:
 *  - 'O' / 'Ο' -> Score = Marks
 *  - '△' / 'Δ' -> Score = Math.max(0, Marks - 1)
 *  - '×' / 'Χ' / 'X' -> Score = 0
 *  - 'NA' / 'na' -> Score = 'NA', EXCLUDED from applicable maximum marks and score sum.
 */

export const OBSERVATION_OPTIONS = ['Ο', 'Δ', 'Χ', 'NA'];

/**
 * Normalizes user observation input to standard symbols:
 * Ο (Greek capital omicron)
 * Δ (Greek capital delta)
 * Χ (Greek capital chi)
 * NA
 */
export function normalizeObservationSymbol(val) {
  if (val === null || val === undefined || val === '') return '';
  const trimmed = String(val).trim();
  if (['Ο', 'O', 'o', '○', '⭕'].includes(trimmed)) return 'Ο';
  if (['Δ', '△', '▲'].includes(trimmed)) return 'Δ';
  if (['Χ', '×', 'X', 'x', '❌'].includes(trimmed)) return 'Χ';
  if (trimmed.toUpperCase() === 'NA') return 'NA';
  return trimmed;
}

export const normalizeObservation = normalizeObservationSymbol;


/**
 * Calculates the score for an observation given marks.
 */
export function calculateObservationScore(observation, marks) {
  const normalized = normalizeObservationSymbol(observation);
  if (!normalized) return '';
  if (normalized === 'NA') return 'NA';
  if (normalized === 'Χ') return 0;

  const numMarks = Number(marks);
  const baseMarks = Number.isFinite(numMarks) ? numMarks : 3;

  if (normalized === 'Ο') {
    return Math.max(0, baseMarks);
  }
  if (normalized === 'Δ') {
    return Math.max(0, baseMarks - 1);
  }
  return '';
}

/**
 * Authoritatively calculates summary totals (Total Marks, Total Score, Percentage)
 * for a worksheet according to section rules.
 * 
 * NA observations are strictly excluded from applicable marks.
 */
export function calculateSheetSummary(sheet, section = 'assembly') {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0) {
    return {
      totalMarks: 0,
      totalScore: 0,
      percentage: '0.00%',
      applicableCount: 0,
      naCount: 0,
      observationsCount: 0,
      rows: []
    };
  }

  const isCc = String(section).toLowerCase() === 'cc';
  const rows = sheet.rows;

  // Assembly: marksCol=4, obsCol=5, scoreCol=6, checklist rows 3 to 36
  // C&C: marksCol=5, obsCol=7, scoreCol=8, checklist rows 4 to 34
  let marksCol = isCc ? 5 : 4;
  let obsCol = isCc ? 7 : 5;
  let scoreCol = isCc ? 8 : 6;

  // Dynamically verify header column indices if available
  const headerSearchRows = rows.slice(0, 6);
  for (const r of headerSearchRows) {
    if (!Array.isArray(r)) continue;
    const mIdx = r.findIndex(c => /^marks$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (mIdx >= 0) marksCol = mIdx;
    const oIdx = r.findIndex(c => /^observation$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (oIdx >= 0) obsCol = oIdx;
    const sIdx = r.findIndex(c => /^score$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (sIdx >= 0) scoreCol = sIdx;
  }

  const startRow = isCc ? 4 : 3;
  const maxEndRow = isCc ? 35 : 37;

  let totalMarks = 0;
  let totalScore = 0;
  let applicableCount = 0;
  let naCount = 0;
  let observationsCount = 0;

  const updatedRows = rows.map((row, rIdx) => {
    if (!Array.isArray(row) || rIdx < startRow || rIdx >= maxEndRow) return row;

    const nextRow = [...row];
    const marksCell = nextRow[marksCol] || { value: 0, formatted: '0', type: 'n' };
    const obsCell = nextRow[obsCol] || { value: '', formatted: '', type: 'z' };
    const rawObs = String(obsCell.value ?? obsCell.formatted ?? '').trim();

    if (!rawObs) {
      // Empty observation
      return nextRow;
    }

    const normalizedObs = normalizeObservationSymbol(rawObs);
    const marksNum = Number(marksCell.value ?? marksCell.formatted ?? 0);
    const baseMarks = Number.isFinite(marksNum) ? marksNum : 0;
    const computedScore = calculateObservationScore(normalizedObs, baseMarks);

    // Update observation cell to normalized symbol
    nextRow[obsCol] = {
      ...obsCell,
      value: normalizedObs,
      formatted: normalizedObs,
      type: 's'
    };

    // Update score cell
    nextRow[scoreCol] = {
      value: computedScore,
      formatted: String(computedScore),
      type: computedScore === 'NA' ? 's' : 'n'
    };

    observationsCount++;

    if (normalizedObs === 'NA') {
      naCount++;
    } else {
      applicableCount++;
      totalMarks += baseMarks;
      if (typeof computedScore === 'number') {
        totalScore += computedScore;
      }
    }

    return nextRow;
  });

  const percentage = totalMarks > 0
    ? `${((totalScore / totalMarks) * 100).toFixed(2)}%`
    : '0.00%';

  // Update footer summary cells if applicable
  // Assembly: Row 37 col 4 (Total Marks) & col 6 (Total Score), Row 38 col 4 (Percentage)
  // C&C: Row 35 col 8 (Total Score), Row 36 col 6 (Percentage)
  if (!isCc && updatedRows[37] && Array.isArray(updatedRows[37])) {
    const row37 = [...updatedRows[37]];
    row37[4] = { value: `${totalMarks}/`, formatted: `${totalMarks}/`, type: 's' };
    row37[6] = { value: String(totalScore), formatted: String(totalScore), type: 's' };
    updatedRows[37] = row37;
  }
  if (!isCc && updatedRows[38] && Array.isArray(updatedRows[38])) {
    const row38 = [...updatedRows[38]];
    row38[4] = { value: percentage, formatted: percentage, type: 's' };
    updatedRows[38] = row38;
  }

  if (isCc && updatedRows[35] && Array.isArray(updatedRows[35])) {
    const row35 = [...updatedRows[35]];
    row35[8] = { value: totalScore, formatted: String(totalScore), type: 'n' };
    updatedRows[35] = row35;
  }
  if (isCc && updatedRows[36] && Array.isArray(updatedRows[36])) {
    const row36 = [...updatedRows[36]];
    row36[6] = { value: percentage, formatted: percentage, type: 's' };
    updatedRows[36] = row36;
  }

  return {
    totalMarks,
    totalScore,
    percentage,
    applicableCount,
    naCount,
    observationsCount,
    rows: updatedRows
  };
}
