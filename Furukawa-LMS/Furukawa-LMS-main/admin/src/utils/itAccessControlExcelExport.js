import { buildColumnGroups, cellValue, effectiveLocation } from "./itAccessControlColumns.js";

// Excel export of the IT Access Control Register, laid out like the reference sheet:
// title bar, group header row (merged), column header row, one row per employee.
// Exports the rows passed in (the page passes its filtered rows) with their saved values.
// The file is also the import template: itAccessControlImport.js reads it back.

const COLORS = {
    title: "FF1F3864",
    groupHeader: "FFD9E1F2",
    header: "FFF2F2F2",
    accentRed: "FFFF0000",
    pendingRemoval: "FFFCE4E4",
};

async function getExcelJS() {
    const mod = await import("exceljs");
    return mod.Workbook ? mod : (mod.default || mod);
}

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin", color: { argb: "FF000000" } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

// Date cells are written as UTC midnight so Excel shows the same calendar day.
const toExcelDate = (iso) => {
    const m = typeof iso === "string" && iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};

/**
 * Builds the workbook (no download), so it can be tested and round-tripped through the import.
 * @param {object} ExcelJS  the exceljs module
 * @param {{ fields: object[], groups: object[] }} register  GET /api/v1/it-access-control payload
 * @param {object[]} rows  register rows to export
 */
export function buildItAccessControlWorkbook(ExcelJS, register, rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Furukawa LMS";
    workbook.created = new Date();

    const groups = buildColumnGroups(register.fields, register.groups);
    const columns = groups.flatMap((g) => g.columns);
    const totalColumns = columns.length + 1; // + Sr No

    const sheet = workbook.addWorksheet("Access Control Register", {
        views: [{ state: "frozen", xSplit: 3, ySplit: 3 }],
    });

    // Row 1: title
    sheet.mergeCells(1, 1, 1, totalColumns);
    const title = sheet.getCell(1, 1);
    title.value = "Access Control Register";
    title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    title.fill = fill(COLORS.title);
    title.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 24;

    // Rows 2-3: Sr No (merged down), group headers, column headers
    sheet.mergeCells(2, 1, 3, 1);
    const srNo = sheet.getCell(2, 1);
    srNo.value = "Sr No";

    let col = 2;
    for (const group of groups) {
        const start = col;
        const end = col + group.columns.length - 1;
        if (end > start) sheet.mergeCells(2, start, 2, end);
        sheet.getCell(2, start).value = group.label;
        for (const column of group.columns) {
            const cell = sheet.getCell(3, col);
            cell.value = column.label;
            if (column.accent === "red") cell.font = { bold: true, color: { argb: COLORS.accentRed } };
            col += 1;
        }
    }
    for (let r = 2; r <= 3; r += 1) {
        for (let c = 1; c <= totalColumns; c += 1) {
            const cell = sheet.getCell(r, c);
            cell.fill = fill(r === 2 ? COLORS.groupHeader : COLORS.header);
            cell.font = { bold: true, ...(cell.font || {}) };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            cell.border = border;
        }
    }
    sheet.getRow(3).height = 32;

    rows.forEach((row, index) => {
        const values = [index + 1, ...columns.map((column) => {
            const value = column.key === "location" ? effectiveLocation(row) : cellValue(row, column);
            if (column.type === "date") return toExcelDate(value);
            return value ?? "";
        })];
        const excelRow = sheet.addRow(values);
        excelRow.eachCell({ includeEmpty: true }, (cell, c) => {
            cell.border = border;
            cell.alignment = { vertical: "middle", horizontal: c <= 3 ? "left" : "center" };
            if (row.pendingRemoval) cell.fill = fill(COLORS.pendingRemoval);
            const column = columns[c - 2];
            if (column?.type === "date" && cell.value instanceof Date) cell.numFmt = "dd-mm-yyyy";
        });
    });

    sheet.getColumn(1).width = 7;
    columns.forEach((column, i) => {
        const width = column.key === "fullName" ? 28 : column.key === "department" || column.key === "designation" ? 22 : Math.max(11, Math.min(18, column.label.length + 2));
        sheet.getColumn(i + 2).width = width;
    });

    return workbook;
}

export async function exportItAccessControlRegister(register, rows) {
    const ExcelJS = await getExcelJS();
    const workbook = buildItAccessControlWorkbook(ExcelJS, register, rows);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `IT_Access_Control_Register_${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
