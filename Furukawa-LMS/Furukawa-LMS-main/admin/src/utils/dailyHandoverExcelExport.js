// Excel export of the Daily HR Meeting — Daily Handover Report tab, laid out like the HR workbook:
//   Daily Handover Report | Handover Plan (vertical) | one column per date (YYYY-MM-DD)
//   ... section rows, group Total rows, Grand Total
//   (blank row)
//   Hiring Actual | one column per date: A/B/C/G-Shift rows, Grand Total
// Total and Grand Total cells are live SUM formulas with their computed result cached.

const COLORS = {
    header: "FFFFFFFF",
    plan: "FFF2F2F2",
    total: "FFD9D9D9",
    grandTotal: "FFF8CBAD",
    hiringLabel: "FFD9D9D9",
};

async function getExcelJS() {
    const mod = await import("exceljs");
    return mod.Workbook ? mod : (mod.default || mod);
}

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin", color: { argb: "FF000000" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

/**
 * @param {object} report        GET /api/v1/daily-manpower-report/handover payload
 * @param {Array}  visibleDates  the date columns to export (report.dates or a slice of it)
 */
export async function exportDailyHandoverReport(report, visibleDates = report.dates) {
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Furukawa LMS";
    workbook.created = new Date();

    const { year, monthNumber } = report;
    const mm = String(monthNumber).padStart(2, "0");
    const sheet = workbook.addWorksheet(`Handover ${mm}-${year}`, {
        views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    const dates = visibleDates.map((d) => d.date);
    const firstDateCol = 3;
    const letter = (col) => sheet.getColumn(col).letter;

    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 5;
    dates.forEach((_, i) => { sheet.getColumn(firstDateCol + i).width = 12; });

    const styleCell = (cell, { argb, bold = false, align = "center" } = {}) => {
        cell.border = border;
        cell.alignment = { horizontal: align, vertical: "middle", wrapText: true };
        if (argb) cell.fill = fill(argb);
        if (bold) cell.font = { bold: true };
    };

    const writeDateHeader = (row, title, { underline = false } = {}) => {
        sheet.mergeCells(row, 1, row, 2);
        const titleCell = sheet.getCell(row, 1);
        titleCell.value = title;
        styleCell(titleCell, { argb: COLORS.header, bold: true });
        titleCell.font = { bold: true, underline };
        dates.forEach((d, i) => {
            const cell = sheet.getCell(row, firstDateCol + i);
            cell.value = d;
            styleCell(cell, { argb: COLORS.header, bold: true });
        });
    };

    const sumFormula = (col, rows, result) => {
        const L = letter(col);
        const contiguous = rows.every((n, idx) => idx === 0 || n === rows[idx - 1] + 1);
        const formula = !rows.length ? "0" : contiguous
            ? `SUM(${L}${rows[0]}:${L}${rows[rows.length - 1]})`
            : `SUM(${rows.map((n) => `${L}${n}`).join(",")})`;
        return { formula, result };
    };

    // Writes one body row. sourceRows given -> SUM formulas over them, else plain values.
    // labelArgb/labelBold style only the label cell (defaults: same as the values).
    const writeRow = (rowNumber, row, { labelCols, argb, bold, labelArgb = argb, labelBold = bold, sourceRows = null }) => {
        if (labelCols === 2) sheet.mergeCells(rowNumber, 1, rowNumber, 2);
        const labelCell = sheet.getCell(rowNumber, 1);
        labelCell.value = row.label;
        styleCell(labelCell, { argb: labelArgb, bold: labelBold, align: labelCols === 2 ? "center" : "left" });
        dates.forEach((d, i) => {
            const col = firstDateCol + i;
            const value = row.values[d] || 0;
            const cell = sheet.getCell(rowNumber, col);
            cell.value = sourceRows ? sumFormula(col, sourceRows, value) : value;
            styleCell(cell, { argb, bold });
        });
    };

    // --- Table 1: Handover Actual -------------------------------------------------------------
    writeDateHeader(1, "Daily Handover Report", { underline: true });
    let r = 2;
    const firstBodyRow = r;
    const groupTotalRows = [];
    for (const group of report.handover.groups) {
        const rows = group.rows.map((row) => {
            writeRow(r, row, { labelCols: 1 });
            return r++;
        });
        writeRow(r, group.total, { labelCols: 1, argb: COLORS.total, bold: true, sourceRows: rows });
        groupTotalRows.push(r++);
    }
    writeRow(r, report.handover.grandTotal, { labelCols: 1, argb: COLORS.grandTotal, bold: true, sourceRows: groupTotalRows });
    const lastBodyRow = r++;

    sheet.mergeCells(firstBodyRow, 2, lastBodyRow, 2);
    const plan = sheet.getCell(firstBodyRow, 2);
    plan.value = "Handover Plan";
    plan.fill = fill(COLORS.plan);
    plan.border = border;
    plan.font = { bold: true, size: 9 };
    plan.alignment = { horizontal: "center", vertical: "middle", textRotation: "vertical" };

    // --- Table 2: Hiring Actual ---------------------------------------------------------------
    r += 1; // blank spacer row
    writeDateHeader(r++, "Hiring Actual");
    const shiftRows = report.hiring.rows.map((row) => {
        writeRow(r, row, { labelCols: 2, labelArgb: COLORS.hiringLabel, labelBold: true });
        return r++;
    });
    writeRow(r, report.hiring.grandTotal, { labelCols: 2, argb: COLORS.grandTotal, bold: true, sourceRows: shiftRows });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const firstMonth = dates.length ? dates[0].slice(0, 7) : `${year}-${mm}`;
    const lastMonth = `${year}-${mm}`;
    link.download = firstMonth === lastMonth
        ? `Daily_Handover_Report_${lastMonth}.xlsx`
        : `Daily_Handover_Report_${firstMonth}_to_${lastMonth}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
