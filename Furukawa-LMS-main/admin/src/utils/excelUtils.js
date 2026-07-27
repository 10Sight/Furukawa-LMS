import * as XLSX from "xlsx";

/**
 * Parses a worksheet the same way sheet_to_json(raw: false) does (preserves leading
 * zeros / formatted text for codes and phone numbers), except Date cells are kept as
 * unambiguous YYYY-MM-DD strings instead of being reformatted into the workbook's
 * locale date format (e.g. MM/DD/YYYY), which is what previously caused DD-MM-YYYY
 * dates to get flipped on import.
 */
export const getExcelRows = (worksheet, options = {}) => {
  const formattedRows = XLSX.utils.sheet_to_json(worksheet, { ...options, raw: false });
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { ...options, raw: true });

  const toDateStr = (val) => {
    if (!(val instanceof Date) || isNaN(val.getTime())) return null;
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const day = String(val.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return formattedRows.map((row, rIdx) => {
    const rawRow = rawRows[rIdx];
    if (!rawRow) return row;

    if (Array.isArray(row)) {
      return row.map((cell, cIdx) => toDateStr(rawRow[cIdx]) ?? cell);
    }

    const merged = { ...row };
    for (const key of Object.keys(rawRow)) {
      const dateStr = toDateStr(rawRow[key]);
      if (dateStr) merged[key] = dateStr;
    }
    return merged;
  });
};
