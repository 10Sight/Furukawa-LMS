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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad2 = (n) => String(n).padStart(2, '0');

/** Local-time 'YYYY-MM-DD' (toISOString() is UTC and shifts the day in IST). */
export function toLocalDateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local-time 'YYYY-MM'. */
export function toLocalYearMonth(date = new Date()) {
  return toLocalDateStr(date).slice(0, 7);
}

/** True when a date-range filter value is a specific month key like '2026-10'. */
export function isMonthKey(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''));
}

/** 'YYYY-MM' -> 'October 2026' */
export function formatYearMonth(yearMonth) {
  if (!isMonthKey(yearMonth)) return String(yearMonth || '');
  const [y, m] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1] || ''} ${y}`;
}

function getRecordDate(rec) {
  return rec.auditDate || rec.date || (rec.createdAt ? String(rec.createdAt).slice(0, 10) : '');
}

function averageOrNull(values) {
  if (!values || values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Distinct months present in the records plus the current month, newest first,
 * as [{ key: 'YYYY-MM', label: 'October 2026' }].
 */
export function extractAvailableMonths(records = [], now = new Date()) {
  const months = new Set([toLocalYearMonth(now)]);
  (records || []).forEach(rec => {
    const ym = getRecordDate(rec).slice(0, 7);
    if (isMonthKey(ym)) months.add(ym);
  });
  return [...months].sort().reverse().map(key => ({ key, label: formatYearMonth(key) }));
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
export function aggregateSectionData(records, sectionKey, unitFilter, dateRangeFilter, customRange = {}, now = new Date()) {
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
  if (dateRangeFilter === '7d' || dateRangeFilter === '14d' || dateRangeFilter === '30d') {
    const days = dateRangeFilter === '7d' ? 7 : dateRangeFilter === '14d' ? 14 : 30;
    const cutoffStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
    filtered = filtered.filter(rec => getRecordDate(rec) >= cutoffStr);
  } else if (dateRangeFilter === 'month' || isMonthKey(dateRangeFilter)) {
    // 'month' = current month; 'YYYY-MM' = that specific month
    const yearMonth = dateRangeFilter === 'month' ? toLocalYearMonth(now) : dateRangeFilter;
    filtered = filtered.filter(rec => getRecordDate(rec).startsWith(yearMonth));
  } else if (dateRangeFilter === 'custom') {
    // Inclusive 'YYYY-MM-DD' bounds; either side may be left open
    const { from, to } = customRange || {};
    filtered = filtered.filter(rec => {
      const d = getRecordDate(rec);
      return (!from || d >= from) && (!to || d <= to);
    });
  }

  // 4. Group by date
  const dateMap = new Map();

  filtered.forEach(record => {
    const rawDate = getRecordDate(record) || toLocalDateStr(now);

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
        shiftAScores: [],
        shiftBScores: [],
        shiftCScores: [],
        shiftGScores: [],
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
      if (shift === 'A') {
        dayEntry.shiftA += 1;
        dayEntry.shiftAScores.push(scorePct);
      } else if (shift === 'B') {
        dayEntry.shiftB += 1;
        dayEntry.shiftBScores.push(scorePct);
      } else if (shift === 'C') {
        dayEntry.shiftC += 1;
        dayEntry.shiftCScores.push(scorePct);
      } else if (shift === 'G') {
        dayEntry.shiftG += 1;
        dayEntry.shiftGScores.push(scorePct);
      } else {
        dayEntry.otherShift += 1;
      }

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

  // Calculate averages and sort chronological
  const dailyData = Array.from(dateMap.values())
    .map(day => {
      return {
        ...day,
        avgScore: averageOrNull(day.scores) ?? 0,
        level3Score: averageOrNull(day.level3Scores),
        level2Score: averageOrNull(day.level2Scores),
        level1Score: averageOrNull(day.level1Scores),
        shiftAScore: averageOrNull(day.shiftAScores),
        shiftBScore: averageOrNull(day.shiftBScores),
        shiftCScore: averageOrNull(day.shiftCScores),
        shiftGScore: averageOrNull(day.shiftGScores)
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

// Display metadata for the two LPA sheets
export const SHEET_META = {
  assembly: { key: 'assembly', label: 'Assembly', fullLabel: 'Assembly Sheet', color: '#2563eb' },
  cc: { key: 'cc', label: 'C&C', fullLabel: 'C&C Sheet', color: '#059669' }
};

function getActiveSheetKeys(activeTab) {
  return activeTab === 'assembly' || activeTab === 'cc' ? [activeTab] : ['assembly', 'cc'];
}

/**
 * Builds one chart slot per (date, sheet) from aggregateSectionData() dailyData.
 * In 'both' mode every date gets an Assembly slot followed by a C&C slot, so pairs
 * stay aligned even when one sheet has no audit that day. Per-sheet trend values
 * (assemblyAvg / ccAvg) are null on the other sheet's slots so each line only
 * connects its own sheet's points.
 */
export function buildCombinedChartSlots(assemblyDaily = [], ccDaily = [], activeTab = 'both') {
  const sheetKeys = getActiveSheetKeys(activeTab);
  const byDate = {
    assembly: new Map((assemblyDaily || []).map(d => [d.date, d])),
    cc: new Map((ccDaily || []).map(d => [d.date, d]))
  };
  const dates = [...new Set(sheetKeys.flatMap(k => [...byDate[k].keys()]))].sort();

  const slots = [];
  dates.forEach(date => {
    sheetKeys.forEach((sheet, idx) => {
      const day = byDate[sheet].get(date);
      slots.push({
        date,
        formattedDate: formatShortDate(date),
        sheet,
        sheetLabel: SHEET_META[sheet].label,
        isGroupStart: idx === 0,
        isEmpty: !day,
        totalSheets: day ? day.totalSheets : 0,
        level3Score: day?.level3Score ?? null,
        level2Score: day?.level2Score ?? null,
        level1Score: day?.level1Score ?? null,
        shiftAScore: day?.shiftAScore ?? null,
        shiftBScore: day?.shiftBScore ?? null,
        shiftCScore: day?.shiftCScore ?? null,
        shiftGScore: day?.shiftGScore ?? null,
        avgScore: day ? day.avgScore : null,
        assemblyAvg: sheet === 'assembly' && day ? day.avgScore : null,
        ccAvg: sheet === 'cc' && day ? day.avgScore : null
      });
    });
  });
  return slots;
}

/**
 * Builds rows for the Daily Activity table: newest date first, Assembly before C&C.
 * Dates without an audit for a sheet are omitted.
 */
export function buildCombinedTableRows(assemblyDaily = [], ccDaily = [], activeTab = 'both') {
  const sheetKeys = getActiveSheetKeys(activeTab);
  const source = { assembly: assemblyDaily || [], cc: ccDaily || [] };
  const order = { assembly: 0, cc: 1 };

  return sheetKeys
    .flatMap(sheet => source[sheet].map(day => ({ ...day, sheet, sheetLabel: SHEET_META[sheet].label })))
    .sort((a, b) => b.date.localeCompare(a.date) || order[a.sheet] - order[b.sheet]);
}
