import { saveAs } from 'file-saver';

// Shared between the on-screen Skill Matrix table and the Excel export so the
// downloaded file always matches what the user sees.

export const getLevelWeight = (levelStr) => {
    if (!levelStr) return 0;
    const match = levelStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
};

// A sub-section column shows the operator's highest station level within it,
// or '-' when they are neither assigned to it nor skilled on any of its stations.
export const getSubSectionDisplayLevel = (entry, group) => {
    const subSectionStations = group.indices.map(idx => entry.stations?.[idx]).filter(Boolean);

    let maxStation = null;
    let maxWeight = -1;
    subSectionStations.forEach(s => {
        const w = getLevelWeight(s.curr);
        if (w > maxWeight) {
            maxWeight = w;
            maxStation = s;
        }
    });

    const isAssigned = (entry.assignments || []).some(ua =>
        String(ua.subSectionId) === String(group.id) ||
        subSectionStations.some(s => String(s._id) === String(ua.machineId))
    );
    const hasSkill = subSectionStations.some(s => s.curr && s.curr !== '-');

    return (isAssigned || hasSkill) ? (maxStation?.curr || 'L-0') : '-';
};

export const getMinSkillLabel = (group, index, config) => {
    const rawVal = group.minimumRequiredLevel || config.minSkills?.[index] || "L2";
    // Clean value: remove leading/trailing dots or commas
    return String(rawVal).replace(/^[.,\s]+|[.,\s]+$/g, '');
};

export const sumField = (entries, field) =>
    entries.reduce((acc, curr) => acc + (parseFloat(curr[field]) || 0), 0);

export const percentOf = (actual, plan) => (plan > 0 ? Math.round((actual / plan) * 100) : 0);

// Row % divides by the plan, treating an empty/zero plan as 1 (matches the original UI),
// and an empty actual as 0 so the cell never shows NaN%.
export const getRowPercent = (entry) =>
    Math.round(((parseFloat(entry.actual) || 0) / (parseFloat(entry.plan) || 1)) * 100);

export const SCHEDULE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The selected month's % is computed live from the rows; other months use the
// plan/actual typed into the schedule.
export const getMonthlySchedulePercents = (config, selectedMonth, entries) => {
    const currentMonthIdx = selectedMonth ? parseInt(selectedMonth.split('-')[1]) - 1 : -1;
    return SCHEDULE_MONTHS.map((_, i) => {
        if (i === currentMonthIdx) {
            return percentOf(sumField(entries, 'actual'), sumField(entries, 'plan'));
        }
        const planVal = parseFloat(config.footerRows?.planMonths?.[i]) || 0;
        const actualVal = parseFloat(config.footerRows?.actualMonths?.[i]) || 0;
        return percentOf(actualVal, planVal);
    });
};

// Mirrors SkillIcon's parsing: -1 = blank ('-'), 0 = under training, n = filled slices.
const levelToFilledSlices = (levelStr, levels) => {
    const value = levelStr || '-';
    if (value === '-' || value === 'None') return -1;
    if (value === 'L-0') return 0;
    if (value.startsWith('L-')) return parseInt(value.split('-')[1]) || 0;
    const found = levels.find(l => l.name === value);
    return found ? found.order + 1 : 0;
};

const SYMBOL_PX = 20; // displayed size in the sheet
const SYMBOL_SCALE = 3; // drawn larger so it stays crisp when zoomed

// Draws the same pie symbol as SkillIcon onto a canvas and returns base64 PNG data,
// or null when there is nothing to draw (blank level / no canvas available).
const drawSkillSymbol = (filled, maxLevels) => {
    if (filled < 0 || typeof document === 'undefined') return null;
    const size = SYMBOL_PX * SYMBOL_SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const center = size / 2;
    const radius = size / 2 - 2 * SYMBOL_SCALE;
    ctx.strokeStyle = 'black';

    if (filled === 0) {
        // Under training: dashed circle with a dashed cross
        ctx.setLineDash([2 * SYMBOL_SCALE, 2 * SYMBOL_SCALE]);
        ctx.lineWidth = SYMBOL_SCALE;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 0.5 * SYMBOL_SCALE;
        ctx.beginPath();
        ctx.moveTo(center, center - radius);
        ctx.lineTo(center, center + radius);
        ctx.moveTo(center - radius, center);
        ctx.lineTo(center + radius, center);
        ctx.stroke();
    } else {
        const anglePerSlice = (Math.PI * 2) / maxLevels;
        let start = -Math.PI / 2; // 12 o'clock, clockwise like the UI
        ctx.lineWidth = 0.5 * SYMBOL_SCALE;
        for (let i = 0; i < maxLevels; i++) {
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, start, start + anglePerSlice);
            ctx.closePath();
            ctx.fillStyle = i < filled ? 'black' : 'white';
            ctx.fill();
            ctx.stroke();
            start += anglePerSlice;
        }
        ctx.lineWidth = SYMBOL_SCALE;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    return canvas.toDataURL('image/png').split(',')[1];
};

const THIN_BORDER = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
};
const FILL = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const GREY = 'FFF3F4F6';
const YELLOW_LIGHT = 'FFFEF9C3';
const YELLOW = 'FFFDE047';

const LEADING_COLS = 6; // Number, Operator name, Card No., Experience, Cert. date, Position
const TRAILING_COLS = 4; // Plan, Actual, Status, %

/**
 * Builds the Skill Matrix workbook from the page's live state (including unsaved
 * edits) and downloads it.
 */
export const exportSkillMatrixToExcel = async ({
    entries,
    groups,
    columnActuals,
    config,
    levels = [],
    header,
    revisionInfo,
}) => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Skill Matrix', {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    });

    const n = groups.length;
    const totalCols = LEADING_COLS + n + TRAILING_COLS;
    const firstGroupCol = LEADING_COLS + 1;
    const lastGroupCol = LEADING_COLS + n;
    const planCol = lastGroupCol + 1;
    const actualCol = lastGroupCol + 2;
    const statusCol = lastGroupCol + 3;
    const pctCol = lastGroupCol + 4;

    ws.columns = [
        { width: 7 },
        { width: 28 },
        { width: 12 },
        { width: 11 },
        { width: 13 },
        { width: 10 },
        ...groups.map(() => ({ width: 9 })),
        { width: 8 },
        { width: 8 },
        { width: 8 },
        { width: 7 },
    ];

    let r = 0;
    const set = (row, col, value, style = {}) => {
        const cell = ws.getCell(row, col);
        cell.value = value ?? '';
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, ...style.alignment };
        if (style.font) cell.font = style.font;
        if (style.fill) cell.fill = FILL(style.fill);
        if (style.border !== false) cell.border = THIN_BORDER;
        return cell;
    };
    // Writes into the top-left cell of a range and merges it; borders every cell so
    // the merged block is outlined in Excel.
    const block = (r1, c1, r2, c2, value, style = {}) => {
        if (style.border !== false) {
            for (let rr = r1; rr <= r2; rr++) {
                for (let cc = c1; cc <= c2; cc++) ws.getCell(rr, cc).border = THIN_BORDER;
            }
        }
        if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
        return set(r1, c1, value, style);
    };
    const bold = { bold: true };
    const left = { horizontal: 'left' };
    const right = { horizontal: 'right' };

    // One embedded PNG per distinct level, reused for every cell showing it.
    const maxLevels = levels.length || 4;
    const symbolIds = new Map();
    // Floats the level symbol centred over a cell; returns false when nothing was drawn.
    const placeSymbol = (row, col, levelStr) => {
        const filled = levelToFilledSlices(levelStr, levels);
        if (!symbolIds.has(filled)) {
            const base64 = drawSkillSymbol(filled, maxLevels);
            symbolIds.set(filled, base64 ? workbook.addImage({ base64, extension: 'png' }) : null);
        }
        const imageId = symbolIds.get(filled);
        if (imageId == null) return false;

        const colPx = (ws.getColumn(col).width || 9) * 7 + 5;
        const rowPx = ((ws.getRow(row).height || 15) * 4) / 3;
        ws.addImage(imageId, {
            tl: {
                col: col - 1 + Math.max(0, (colPx - SYMBOL_PX) / 2 / colPx),
                row: row - 1 + Math.max(0, (rowPx - SYMBOL_PX) / 2 / rowPx),
            },
            ext: { width: SYMBOL_PX, height: SYMBOL_PX },
            editAs: 'oneCell',
        });
        return true;
    };
    const SYMBOL_ROW_HEIGHT = 21; // points (~28px), fits the 20px symbol

    // --- Title ---
    r++;
    block(r, 1, r, totalCols, 'FURUKAWA MINDA ELECTRIC PVT. LTD.', { font: { bold: true, size: 10 }, alignment: right, border: false });
    r++;
    block(r, 1, r, totalCols, 'SKILL MATRIX', { font: { bold: true, size: 18 } });
    ws.getRow(r).height = 28;

    // --- Hierarchy (left) & signatures (right) ---
    const hierarchy = [
        ['Department', header.department],
        ['Section', header.section],
        ['Line', header.line],
        ['Sub-Section', header.subSection],
        ['Shift', config.shift],
        ['Month', header.month],
    ];
    const signatures = [
        ['QA In-charge Sign.', config.signatures?.qa],
        ['Safety In-charge Sign.', config.signatures?.safety],
        ['Process In-charge Sign.', config.signatures?.process],
        ['Planned', config.plannedHeader],
    ];
    const sigLabelStart = totalCols - 3;
    hierarchy.forEach(([label, value], i) => {
        r++;
        block(r, 1, r, 2, label, { font: bold, fill: GREY, alignment: left });
        block(r, 3, r, 5, value || 'All', { font: bold, alignment: left });
        if (signatures[i]) {
            const [sigLabel, sigValue] = signatures[i];
            block(r, sigLabelStart, r, sigLabelStart + 1, sigLabel, { font: { size: 9 }, fill: GREY });
            block(r, sigLabelStart + 2, r, totalCols, sigValue || '', { font: bold });
        }
    });

    // --- Products & revisions ---
    r += 2;
    block(r, 1, r, 2, 'Product', { font: bold, fill: GREY, alignment: left });
    block(r, 3, r, totalCols, (config.products || []).filter(Boolean).join(', '), { alignment: left });

    const revisions = (config.revisions || []).filter(rev => rev && (rev.product || rev.revision || rev.date));
    if (revisions.length > 0) {
        r++;
        block(r, 1, r, 2, 'Product', { font: bold, fill: GREY });
        block(r, 3, r, 4, 'Revision', { font: bold, fill: GREY });
        block(r, 5, r, 6, 'Operation date', { font: bold, fill: GREY });
        revisions.forEach(rev => {
            r++;
            block(r, 1, r, 2, rev.product);
            block(r, 3, r, 4, rev.revision);
            block(r, 5, r, 6, rev.date);
        });
    }

    // --- Legend ---
    r++;
    const legendItems = [
        ['L-0', 'Under training'],
        ...levels.map(level => [level.name, level.description || level.name]),
    ];
    const legendStart = r + 1;
    legendItems.forEach(([levelStr, label]) => {
        r++;
        ws.getRow(r).height = SYMBOL_ROW_HEIGHT;
        set(r, 3, '');
        if (!placeSymbol(r, 3, levelStr)) ws.getCell(r, 3).value = levelStr;
        block(r, 4, r, 6, label, { alignment: left });
    });
    block(legendStart, 1, r, 2, 'Skill Symbol', { font: bold, fill: GREY, alignment: right });

    // --- Table header ---
    r += 2;
    const h1 = r;
    block(h1, 1, h1, LEADING_COLS, 'Process responsible person', { font: bold, alignment: right });
    block(h1, firstGroupCol, h1, lastGroupCol, config.processPersons?.responsible, { alignment: left });
    block(h1, planCol, h1, pctCol, '');

    const h2 = h1 + 1;
    block(h2, 1, h2, LEADING_COLS, 'Vice process responsible person', { font: bold, alignment: right });
    block(h2, firstGroupCol, h2, lastGroupCol, config.processPersons?.vice);
    block(h2, planCol, h2, pctCol, config.processPersons?.vice2);

    const h3 = h2 + 1; // Responsible expert
    const h4 = h3 + 1; // Process name
    const h5 = h4 + 1; // Min. skill
    const h6 = h5 + 1; // Operation sharing
    const h7 = h6 + 1; // Column titles

    block(h3, 1, h3, LEADING_COLS, 'Responsible expert', { font: bold, alignment: right });
    block(h4, 1, h4, LEADING_COLS, 'Process name', { font: bold, alignment: right });
    block(h5, 1, h5, LEADING_COLS, 'Min.Skill Required', { font: bold, alignment: right });
    block(h6, 1, h6, LEADING_COLS, 'Operation sharing ( Station No & equipment name)', { font: bold, alignment: right });

    groups.forEach((group, i) => {
        const col = firstGroupCol + i;
        set(h3, col, 'Operator Inspector', { font: { size: 8 }, fill: YELLOW_LIGHT });
        set(h4, col, String(group.name || '').toUpperCase(), {
            font: { bold: true, size: 9 },
            fill: GREY,
            alignment: { textRotation: 90 },
        });
        set(h5, col, getMinSkillLabel(group, i, config), { font: bold });
        set(h6, col, i + 1);
        set(h7, col, i + 1, { font: bold });
    });
    ws.getRow(h4).height = 110;

    block(h3, planCol, h6, actualCol, 'Number of process of per person', { font: bold, fill: YELLOW });
    block(h3, statusCol, h7, statusCol, 'Status', { font: bold, fill: YELLOW });
    block(h3, pctCol, h7, pctCol, '%', { font: bold, fill: YELLOW });

    ['Number', 'Operator name', 'Card No.', 'Experience (Yrs)', 'Date of Certificate update', 'Position number']
        .forEach((title, i) => set(h7, i + 1, title, { font: { bold: true, size: 9 } }));
    set(h7, planCol, 'Plan', { font: bold });
    set(h7, actualCol, 'Actual', { font: bold });
    ws.getRow(h7).height = 30;

    // --- Operator rows ---
    r = h7;
    entries.forEach((entry, idx) => {
        r++;
        ws.getRow(r).height = SYMBOL_ROW_HEIGHT;
        set(r, 1, idx + 1, { font: bold });
        set(r, 2, entry.name || entry.manualName || '', { font: bold, alignment: left });
        set(r, 3, entry.cardNo || '');
        set(r, 4, entry.experience ?? '');
        set(r, 5, entry.certDate || '');
        set(r, 6, entry.position || '', { font: bold, fill: YELLOW_LIGHT });
        groups.forEach((group, i) => {
            const col = firstGroupCol + i;
            const level = getSubSectionDisplayLevel(entry, group);
            // Blank like the UI for '-'; otherwise the symbol, falling back to text
            // only if it could not be drawn.
            const drawn = placeSymbol(r, col, level);
            set(r, col, level === '-' || drawn ? '' : level, { font: bold });
        });
        set(r, planCol, entry.plan ?? '');
        set(r, actualCol, entry.actual ?? '', { font: bold, fill: GREY });
        set(r, statusCol, entry.status || 'OK', { font: bold });
        set(r, pctCol, `${getRowPercent(entry)}%`, { font: { bold: true, color: { argb: 'FF2563EB' } } });
    });

    // --- Footer totals ---
    const totalPlan = sumField(entries, 'plan');
    const totalActual = sumField(entries, 'actual');
    const f1 = r + 1;
    const f2 = r + 2;
    const f3 = r + 3;
    block(f1, 1, f2, LEADING_COLS - 1, 'Number of person for process', { font: bold, alignment: right });
    set(f1, LEADING_COLS, 'Plan', { font: bold });
    set(f2, LEADING_COLS, 'Actual', { font: bold });
    groups.forEach((_, i) => {
        set(f1, firstGroupCol + i, config.footerRows?.numPersonPlan?.[i] || '', { font: bold });
        set(f2, firstGroupCol + i, columnActuals[i] || 0, { font: bold });
    });
    set(f1, planCol, 'Total Plan', { font: { bold: true, size: 8 }, fill: GREY });
    set(f1, actualCol, 'Total Actual', { font: { bold: true, size: 8 }, fill: GREY });
    set(f1, statusCol, '', { fill: GREY });
    set(f1, pctCol, 'Total %', { font: { bold: true, size: 8 }, fill: GREY });
    set(f2, planCol, totalPlan, { font: bold });
    set(f2, actualCol, totalActual, { font: bold });
    set(f2, statusCol, '');
    set(f2, pctCol, `${percentOf(totalActual, totalPlan)}%`, { font: { bold: true, color: { argb: 'FF2563EB' } } });

    block(f3, 1, f3, LEADING_COLS, 'Status', { font: bold, alignment: right });
    groups.forEach((_, i) => set(f3, firstGroupCol + i, config.footerRows?.statusRow?.[i] || 'OK', { font: bold }));
    block(f3, planCol, f3, pctCol, '', { fill: GREY });

    // --- Evaluation schedule ---
    r = f3 + 2;
    block(r, 1, r, 2, 'Evaluation', { font: bold, fill: GREY, alignment: right });
    SCHEDULE_MONTHS.forEach((m, i) => set(r, 3 + i, m, { font: bold, fill: GREY }));
    const percents = getMonthlySchedulePercents(config, header.month, entries);
    const scheduleRows = [
        ['PLAN (NO. OF SKILLED MANPOWER)', i => config.footerRows?.planMonths?.[i] || ''],
        ['ACTUAL', i => config.footerRows?.actualMonths?.[i] || ''],
        ['% (SKILLED MANPOWER)', i => `${percents[i]}%`],
    ];
    scheduleRows.forEach(([label, valueAt]) => {
        r++;
        block(r, 1, r, 2, label, { font: { bold: true, size: 8 }, fill: GREY, alignment: right });
        SCHEDULE_MONTHS.forEach((_, i) => set(r, 3 + i, valueAt(i), { font: bold }));
    });

    // --- Document footer ---
    r += 2;
    const docInfo = [
        `Date of Certificate/update : ${revisionInfo?.revDate || ''}`,
        `Doc No. ${revisionInfo?.docNo || ''}`,
        `Rev.${revisionInfo?.revNo || ''}`,
        `Rev Date: ${revisionInfo?.revDate || ''}`,
        `Page: ${config.documentInfo?.page || ''}`,
    ];
    docInfo.forEach((text, i) => {
        const c1 = 1 + i * 2;
        block(r, c1, r, c1 + 1, text, { font: { size: 9 }, alignment: left, border: false });
    });

    // Freeze only the Number / Operator name columns. Freezing the header rows too
    // locks ~20 rows, which fills the window and leaves nothing to scroll vertically.
    ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 0 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const safe = (s) => String(s || '').trim().replace(/[\\/:*?"<>|\s]+/g, '_');
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `SkillMatrix_${safe(header.department) || 'Department'}_${safe(header.month) || 'Month'}.xlsx`
    );
};
