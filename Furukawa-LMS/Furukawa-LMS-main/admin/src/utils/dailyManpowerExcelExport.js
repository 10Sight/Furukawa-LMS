// Excel export of the Daily HR Meeting — Daily Manpower Report, laid out like the HR workbook:
// Section | Required (Indent 01) | Required (Indent 16) | per date: Present, OT hours, OT Mandays, Gap.
//
// Formulas are live Excel formulas (each with its computed result cached, so the file shows values
// even before Excel recalculates):
// - department / Other / Training rows: Mandays = ROUND(OT hours / 8, 0); Gap = Present - Required
//   (Indent 01 column for days 1-15, Indent 16 column from day 16);
// - group Total rows: SUM of the rows above, for every column;
// - Grand Total: SUM of every group Total + Training, for every column.

const COLORS = {
    section: "FFA9D08E",
    required: "FFFFFF00",
    dateHeader: "FFFFFFFF",
    latestDateHeader: "FFE2EFDA",
    subHeader: "FFD9D9D9",
    total: "FFD9D9D9",
    grandTotal: "FFF8CBAD",
    holiday: "FFF2F2F2",
};

const SUB_HEADERS = ["Total Present Headcount", "Over Time hours", "Over Time Mandays", "Gap"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function getExcelJS() {
    const mod = await import("exceljs");
    return mod.Workbook ? mod : (mod.default || mod);
}

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin", color: { argb: "FF000000" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

export const formatReportDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export const requiredHeader = (indentDay, monthNumber, year) =>
    `Required headcount as per Indent ${indentDay} ${MONTHS[monthNumber - 1]}.${year}`;

/**
 * @param {object} report   GET /api/v1/daily-manpower-report/data payload
 */
export async function exportDailyManpowerReport(report) {
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Furukawa LMS";
    workbook.created = new Date();

    const { year, monthNumber } = report;
    const sheet = workbook.addWorksheet(`Manpower ${String(monthNumber).padStart(2, "0")}-${year}`, {
        views: [{ state: "frozen", xSplit: 3, ySplit: 2 }],
    });

    const dates = report.dates;
    const latestComputed = [...dates].reverse().find((d) => d.computed)?.date || null;
    const firstDateCol = 4;
    const colOf = (dateIndex, sub) => firstDateCol + dateIndex * 4 + sub; // sub: 0 present, 1 ot, 2 md, 3 gap
    const letter = (col) => sheet.getColumn(col).letter;

    // Column widths
    sheet.getColumn(1).width = 22;
    sheet.getColumn(2).width = 16;
    sheet.getColumn(3).width = 16;
    dates.forEach((_, i) => {
        sheet.getColumn(colOf(i, 0)).width = 11;
        sheet.getColumn(colOf(i, 1)).width = 9;
        sheet.getColumn(colOf(i, 2)).width = 10;
        sheet.getColumn(colOf(i, 3)).width = 8;
    });

    // Header rows
    const headerCell = (row, col, value, argb, extra = {}) => {
        const cell = sheet.getCell(row, col);
        cell.value = value;
        cell.fill = fill(argb);
        cell.border = border;
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.font = { bold: true, ...(extra.font || {}) };
        return cell;
    };

    sheet.mergeCells(1, 1, 2, 1);
    headerCell(1, 1, "Section", COLORS.section);
    sheet.mergeCells(1, 2, 2, 2);
    headerCell(1, 2, requiredHeader("01", monthNumber, year), COLORS.required);
    sheet.mergeCells(1, 3, 2, 3);
    headerCell(1, 3, requiredHeader("16", monthNumber, year), COLORS.required);

    dates.forEach((d, i) => {
        const start = colOf(i, 0);
        sheet.mergeCells(1, start, 1, start + 3);
        headerCell(1, start, `Daily Manpower Report ${formatReportDate(d.date)}`,
            d.date === latestComputed ? COLORS.latestDateHeader : COLORS.dateHeader,
            { font: { underline: true } });
        SUB_HEADERS.forEach((label, sub) => headerCell(2, start + sub, label, COLORS.subHeader));
    });
    sheet.getRow(1).height = 32;
    sheet.getRow(2).height = 58;

    // Body
    let rowNumber = 3;
    const groupTotalRows = [];

    const styleRow = (row, kind) => {
        const lastCol = colOf(dates.length - 1, 3);
        for (let c = 1; c <= Math.max(lastCol, 3); c++) {
            const cell = sheet.getCell(row, c);
            cell.border = border;
            cell.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
            if (kind === "groupTotal") { cell.fill = fill(COLORS.total); cell.font = { bold: true }; }
            if (kind === "grandTotal") { cell.fill = fill(COLORS.grandTotal); cell.font = { bold: true }; }
        }
        dates.forEach((d, i) => {
            if (!d.isHoliday || kind === "groupTotal" || kind === "grandTotal") return;
            for (let sub = 0; sub < 4; sub++) sheet.getCell(row, colOf(i, sub)).fill = fill(COLORS.holiday);
        });
    };

    // A row with its own figures (department, Other, Training): values + ROUND / Gap formulas.
    const writeValueRow = (r) => {
        const row = rowNumber++;
        sheet.getCell(row, 1).value = r.label;
        sheet.getCell(row, 2).value = r.requiredFN01;
        sheet.getCell(row, 3).value = r.requiredFN02;
        dates.forEach((d, i) => {
            const c = r.cells[d.date];
            if (!c) return; // not computed: leave blank
            const presentRef = `${letter(colOf(i, 0))}${row}`;
            const otRef = `${letter(colOf(i, 1))}${row}`;
            const reqRef = d.day <= 15 ? `$B${row}` : `$C${row}`;
            sheet.getCell(row, colOf(i, 0)).value = c.present;
            sheet.getCell(row, colOf(i, 1)).value = c.otHrs;
            sheet.getCell(row, colOf(i, 2)).value = { formula: `ROUND(${otRef}/8,0)`, result: c.otMandays };
            // Required for the day is taken from the row's Indent columns; a department whose
            // stored requirement for this day differs (requirement changed mid-month and the
            // day was not recalculated) keeps its stored value instead of a formula.
            const rowRequired = d.day <= 15 ? r.requiredFN01 : r.requiredFN02;
            sheet.getCell(row, colOf(i, 3)).value = rowRequired === c.required
                ? { formula: `${presentRef}-${reqRef}`, result: c.gap }
                : c.gap;
        });
        styleRow(row, r.kind);
        return row;
    };

    // A SUM row over the given worksheet rows, for every numeric column.
    const writeSumRow = (r, sourceRows, kind) => {
        const row = rowNumber++;
        sheet.getCell(row, 1).value = r.label;
        const sumOf = (col, result) => {
            if (!sourceRows.length) return 0;
            const L = letter(col);
            const contiguous = sourceRows.every((n, idx) => idx === 0 || n === sourceRows[idx - 1] + 1);
            const formula = contiguous
                ? `SUM(${L}${sourceRows[0]}:${L}${sourceRows[sourceRows.length - 1]})`
                : `SUM(${sourceRows.map((n) => `${L}${n}`).join(",")})`;
            return { formula, result };
        };
        sheet.getCell(row, 2).value = sumOf(2, r.requiredFN01);
        sheet.getCell(row, 3).value = sumOf(3, r.requiredFN02);
        dates.forEach((d, i) => {
            const c = r.cells[d.date];
            if (!c) return;
            sheet.getCell(row, colOf(i, 0)).value = sumOf(colOf(i, 0), c.present);
            sheet.getCell(row, colOf(i, 1)).value = sumOf(colOf(i, 1), c.otHrs);
            sheet.getCell(row, colOf(i, 2)).value = sumOf(colOf(i, 2), c.otMandays);
            sheet.getCell(row, colOf(i, 3)).value = sumOf(colOf(i, 3), c.gap);
        });
        styleRow(row, kind);
        return row;
    };

    for (const group of report.groups) {
        const rows = group.rows.map(writeValueRow);
        groupTotalRows.push(writeSumRow(group.total, rows, "groupTotal"));
    }
    const trainingRow = report.training ? writeValueRow(report.training) : null;
    if (report.grandTotal) {
        writeSumRow(report.grandTotal, [...groupTotalRows, ...(trainingRow ? [trainingRow] : [])], "grandTotal");
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Daily_Manpower_Report_${year}-${String(monthNumber).padStart(2, "0")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
