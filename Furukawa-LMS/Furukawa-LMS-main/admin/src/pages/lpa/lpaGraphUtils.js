import { getWorksheetScoresList } from './lpaPdcaUtils.js';

// Color Palette for shifts, levels, and scores
export const COLORS = {
  shiftA: '#3b82f6', // Bright Blue
  shiftB: '#10b981', // Emerald
  shiftC: '#f59e0b', // Amber
  shiftG: '#8b5cf6', // Violet
  otherShift: '#94a3b8', // Slate

  level3: '#06b6d4', // Cyan
  level2: '#8b5cf6', // Purple
  level1: '#ec4899', // Pink

  scoreLine: '#0284c7', // Sky Blue
  scoreArea: '#38bdf8', // Light Sky
  benchmark: '#10b981' // Green
};

/**
 * Extracts the primary score percentage from a sheet / record.
 */
export function extractSheetScore(sheet, record) {
  if (!sheet) return 0;
  const scores = getWorksheetScoresList(sheet, record);
  if (!scores || scores.length === 0) return 0;

  const targetLevel = record?.targetLevel || record?.level || sheet.targetLevel || sheet.level;
  if (targetLevel) {
    const matched = scores.find(s => s.level === targetLevel);
    if (matched && Number.isFinite(matched.rawPct)) return matched.rawPct;
  }

  const valid = scores.filter(s => Number.isFinite(s.rawPct));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, s) => acc + s.rawPct, 0);
  return Math.round(sum / valid.length);
}

/**
 * Formats ISO date 'YYYY-MM-DD' into readable label e.g. '20 Oct'
 */
export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      return `${day} ${months[monthIdx] || ''}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Aggregates LPA records by date and section for charts and analytics.
 */
export function aggregateSectionData(records, sectionKey, unitFilter, dateRangeFilter) {
  const isSectionMatch = (rec) => {
    const sec = String(rec.section || rec.sheets?.[0]?.section || 'assembly').toLowerCase();
    return sec === sectionKey;
  };

  // 1. Filter by section
  let filtered = (records || []).filter(isSectionMatch);

  // 2. Filter by unit
  if (unitFilter && unitFilter !== 'all') {
    filtered = filtered.filter(rec => String(rec.unit || '').toLowerCase() === unitFilter.toLowerCase());
  }

  // 3. Filter by date range
  const now = new Date();
  if (dateRangeFilter === '7d' || dateRangeFilter === '14d' || dateRangeFilter === '30d') {
    const days = dateRangeFilter === '7d' ? 7 : dateRangeFilter === '14d' ? 14 : 30;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    filtered = filtered.filter(rec => {
      const d = rec.auditDate || rec.date || (rec.createdAt ? rec.createdAt.slice(0, 10) : '');
      return d >= cutoffStr;
    });
  } else if (dateRangeFilter === 'month') {
    const currentYearMonth = now.toISOString().slice(0, 7); // 'YYYY-MM'
    filtered = filtered.filter(rec => {
      const d = rec.auditDate || rec.date || (rec.createdAt ? rec.createdAt.slice(0, 10) : '');
      return d.startsWith(currentYearMonth);
    });
  }

  // 4. Group by date
  const dateMap = new Map();

  filtered.forEach(record => {
    const rawDate = record.auditDate || record.date || (recCreatedAt(record)) || new Date().toISOString().slice(0, 10);

    if (!dateMap.has(rawDate)) {
      dateMap.set(rawDate, {
        date: rawDate,
        formattedDate: formatShortDate(rawDate),
        totalSheets: 0,
        // Shift counts
        shiftA: 0,
        shiftB: 0,
        shiftC: 0,
        shiftG: 0,
        otherShift: 0,
        // Level counts
        level3: 0,
        level2: 0,
        level1: 0,
        // Shifts by Levels matrix
        L3_A: 0,
        L3_B: 0,
        L3_C: 0,
        L2_G: 0,
        L2_A: 0,
        L2_B: 0,
        L1_G: 0,
        L1_A: 0,
        // Score values for average calculation
        scores: [],
        level3Scores: [],
        level2Scores: [],
        level1Scores: [],
        sheetsList: []
      });
    }

    const dayEntry = dateMap.get(rawDate);
    const sheets = Array.isArray(record.sheets) && record.sheets.length > 0 ? record.sheets : [record];

    sheets.forEach((sheet) => {
      dayEntry.totalSheets += 1;

      // Extract score
      const scorePct = extractSheetScore(sheet, record);
      dayEntry.scores.push(scorePct);

      // Extract shift
      const shift = String(sheet.shift || record.shift || (record.shifts && record.shifts[0]) || 'A').toUpperCase();
      if (shift === 'A') dayEntry.shiftA += 1;
      else if (shift === 'B') dayEntry.shiftB += 1;
      else if (shift === 'C') dayEntry.shiftC += 1;
      else if (shift === 'G') dayEntry.shiftG += 1;
      else dayEntry.otherShift += 1;

      // Extract level
      const level = String(sheet.targetLevel || sheet.level || record.targetLevel || record.level || (record.levels && record.levels[0]) || 'L3').toUpperCase();
      if (level === 'L3') {
        dayEntry.level3 += 1;
        dayEntry.level3Scores.push(scorePct);
      } else if (level === 'L2') {
        dayEntry.level2 += 1;
        dayEntry.level2Scores.push(scorePct);
      } else if (level === 'L1') {
        dayEntry.level1 += 1;
        dayEntry.level1Scores.push(scorePct);
      }

      // Shift x Level matrix
      const key = `${level}_${shift}`;
      if (dayEntry[key] !== undefined) {
        dayEntry[key] += 1;
      }

      dayEntry.sheetsList.push({
        id: record.id,
        name: sheet.name || record.name || 'Check Sheet',
        unit: record.unit || 'Bawal',
        shift,
        level,
        scorePct,
        auditor: sheet.auditor || record.auditor || record.createdBy || '-',
        department: sheet.department || record.department || '-',
        line: sheet.line || record.line || '-'
      });
    });
  });

  function recCreatedAt(r) {
    return r.createdAt ? String(r.createdAt).slice(0, 10) : '';
  }

  // Calculate averages and sort chronological
  const dailyData = Array.from(dateMap.values())
    .map(day => {
      const avg = day.scores.length > 0
        ? Math.round(day.scores.reduce((a, b) => a + b, 0) / day.scores.length)
        : 0;
      const l3Avg = day.level3Scores.length > 0
        ? Math.round(day.level3Scores.reduce((a, b) => a + b, 0) / day.level3Scores.length)
        : null;
      const l2Avg = day.level2Scores.length > 0
        ? Math.round(day.level2Scores.reduce((a, b) => a + b, 0) / day.level2Scores.length)
        : null;
      const l1Avg = day.level1Scores.length > 0
        ? Math.round(day.level1Scores.reduce((a, b) => a + b, 0) / day.level1Scores.length)
        : null;

      return {
        ...day,
        avgScore: avg,
        level3Score: l3Avg,
        level2Score: l2Avg,
        level1Score: l1Avg
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Overall Section Totals
  const totalSheets = dailyData.reduce((acc, d) => acc + d.totalSheets, 0);
  const allScores = dailyData.flatMap(d => d.scores);
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  const totalShiftA = dailyData.reduce((acc, d) => acc + d.shiftA, 0);
  const totalShiftB = dailyData.reduce((acc, d) => acc + d.shiftB, 0);
  const totalShiftC = dailyData.reduce((acc, d) => acc + d.shiftC, 0);
  const totalShiftG = dailyData.reduce((acc, d) => acc + d.shiftG, 0);

  const totalLevel3 = dailyData.reduce((acc, d) => acc + d.level3, 0);
  const totalLevel2 = dailyData.reduce((acc, d) => acc + d.level2, 0);
  const totalLevel1 = dailyData.reduce((acc, d) => acc + d.level1, 0);

  return {
    dailyData,
    summary: {
      totalSheets,
      avgScore,
      totalShiftA,
      totalShiftB,
      totalShiftC,
      totalShiftG,
      totalLevel3,
      totalLevel2,
      totalLevel1,
      activeDays: dailyData.length
    }
  };
}
