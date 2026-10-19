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
 * for a worksheet according to section rules and supports multiple audit levels.
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

  let marksCol = isCc ? 5 : 4;
  let defaultObsCol = isCc ? 7 : 5;
  let defaultScoreCol = isCc ? 8 : 6;

  // Dynamically verify header column indices if available
  const headerSearchRows = rows.slice(0, 6);
  for (const r of headerSearchRows) {
    if (!Array.isArray(r)) continue;
    const mIdx = r.findIndex(c => /^marks$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (mIdx >= 0) marksCol = mIdx;
    const oIdx = r.findIndex(c => /^observation$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (oIdx >= 0) defaultObsCol = oIdx;
    const sIdx = r.findIndex(c => /^score$/i.test(String(c?.formatted ?? c?.value ?? '').trim()));
    if (sIdx >= 0) defaultScoreCol = sIdx;
  }

  // Detect column pairs (Observation, Score) for all active levels
  const colPairs = [];
  if (!isCc && sheet.columnCount > 7) {
    const numLevels = Math.floor((sheet.columnCount - 5) / 2);
    for (let i = 0; i < numLevels; i++) {
      colPairs.push({ obsCol: 5 + i * 2, scoreCol: 6 + i * 2 });
    }
  } else {
    colPairs.push({ obsCol: defaultObsCol, scoreCol: defaultScoreCol });
  }

  const startRow = isCc ? 4 : 3;
  const maxEndRow = isCc ? 35 : 37;

  let overallTotalMarks = 0;
  let overallTotalScore = 0;
  let overallApplicableCount = 0;
  let overallNaCount = 0;
  let overallObservationsCount = 0;

  // Track per-pair stats
  const pairStats = colPairs.map(() => ({
    totalMarks: 0,
    totalScore: 0,
    applicableCount: 0,
    naCount: 0,
    observationsCount: 0
  }));

  const updatedRows = rows.map((row, rIdx) => {
    if (!Array.isArray(row) || rIdx < startRow || rIdx >= maxEndRow) return row;

    const nextRow = [...row];
    const marksCell = nextRow[marksCol] || { value: 0, formatted: '0', type: 'n' };
    const marksNum = Number(marksCell.value ?? marksCell.formatted ?? 0);
    const baseMarks = Number.isFinite(marksNum) ? marksNum : 0;

    colPairs.forEach((pair, pairIdx) => {
      const obsCell = nextRow[pair.obsCol] || { value: '', formatted: '', type: 'z' };
      const rawObs = String(obsCell.value ?? obsCell.formatted ?? '').trim();

      if (!rawObs) return;

      const normalizedObs = normalizeObservationSymbol(rawObs);
      const computedScore = calculateObservationScore(normalizedObs, baseMarks);

      nextRow[pair.obsCol] = {
        ...obsCell,
        value: normalizedObs,
        formatted: normalizedObs,
        type: 's'
      };

      nextRow[pair.scoreCol] = {
        value: computedScore,
        formatted: String(computedScore),
        type: computedScore === 'NA' ? 's' : 'n'
      };

      pairStats[pairIdx].observationsCount++;
      if (normalizedObs === 'NA') {
        pairStats[pairIdx].naCount++;
      } else {
        pairStats[pairIdx].applicableCount++;
        pairStats[pairIdx].totalMarks += baseMarks;
        if (typeof computedScore === 'number') {
          pairStats[pairIdx].totalScore += computedScore;
        }
      }
    });

    return nextRow;
  });

  const primaryStats = pairStats[0] || {
    totalMarks: 0,
    totalScore: 0,
    applicableCount: 0,
    naCount: 0,
    observationsCount: 0
  };

  overallTotalMarks = primaryStats.totalMarks;
  overallTotalScore = primaryStats.totalScore;
  overallApplicableCount = primaryStats.applicableCount;
  overallNaCount = primaryStats.naCount;
  overallObservationsCount = primaryStats.observationsCount;

  const percentage = overallTotalMarks > 0
    ? `${((overallTotalScore / overallTotalMarks) * 100).toFixed(2)}%`
    : '0.00%';

  // Update summary rows for Assembly
  if (!isCc && updatedRows[37] && Array.isArray(updatedRows[37])) {
    const row37 = [...updatedRows[37]];
    row37[4] = { value: `${overallTotalMarks}/`, formatted: `${overallTotalMarks}/`, type: 's' };
    colPairs.forEach((pair, pairIdx) => {
      const stats = pairStats[pairIdx];
      row37[pair.scoreCol] = { value: String(stats.totalScore), formatted: String(stats.totalScore), type: 's' };
    });
    updatedRows[37] = row37;
  }

  if (!isCc && updatedRows[38] && Array.isArray(updatedRows[38])) {
    const row38 = [...updatedRows[38]];
    colPairs.forEach((pair, pairIdx) => {
      const stats = pairStats[pairIdx];
      const pct = stats.totalMarks > 0
        ? `${((stats.totalScore / stats.totalMarks) * 100).toFixed(2)}%`
        : '0.00%';
      row38[pair.obsCol] = { value: pct, formatted: pct, type: 's' };
      if (pairIdx === 0 && row38[4]) {
        row38[4] = { value: pct, formatted: pct, type: 's' };
      }
    });
    updatedRows[38] = row38;
  }

  // Update summary rows for C&C
  if (isCc && updatedRows[35] && Array.isArray(updatedRows[35])) {
    const row35 = [...updatedRows[35]];
    row35[8] = { value: overallTotalScore, formatted: String(overallTotalScore), type: 'n' };
    updatedRows[35] = row35;
  }
  if (isCc && updatedRows[36] && Array.isArray(updatedRows[36])) {
    const row36 = [...updatedRows[36]];
    row36[6] = { value: percentage, formatted: percentage, type: 's' };
    updatedRows[36] = row36;
  }

  return {
    totalMarks: overallTotalMarks,
    totalScore: overallTotalScore,
    percentage,
    applicableCount: overallApplicableCount,
    naCount: overallNaCount,
    observationsCount: overallObservationsCount,
    rows: updatedRows
  };
}
