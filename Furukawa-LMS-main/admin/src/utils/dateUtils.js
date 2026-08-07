import { format, isValid, parseISO } from "date-fns";

/**
 * Safely formats a date string or object.
 * @param {Date|string|number} dateValue - The date to format
 * @param {string} formatStr - The format pattern (default: "dd/MM/yyyy")
 * @returns {string} - Formatted date or empty string/fallback
 */
export const parseCustomDate = (val) => {
  if (!val) return null;
  
  if (val instanceof Date) {
    return isValid(val) ? val : null;
  }

  const str = String(val).trim();
  if (!str || str.toLowerCase() === "null") return null;

  // If the string contains a time component (has a colon ':'), parse it directly
  // to preserve hours, minutes, and seconds.
  if (str.includes(":")) {
    const parsed = new Date(str);
    if (isValid(parsed)) return parsed;
  }

  // 1. Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (e.g. 20/04/1982)
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1]);
    const p2 = parseInt(dmyMatch[2]);
    let year = parseInt(dmyMatch[3]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    // Usually DD/MM/YYYY. If p2 > 12 and p1 <= 12, it is MM/DD/YYYY.
    let day = p1;
    let month = p2;
    if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    }
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (isValid(d)) return d;
    }
  }

  // 2. Try YYYY-MM-DD or YYYY/MM/DD (e.g. 2013-03-01)
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})(?:T|\s|$)/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1]);
    const month = parseInt(ymdMatch[2]);
    const day = parseInt(ymdMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (isValid(d)) return d;
    }
  }

  // 3. DD-MMM-YY or DD-MMM-YYYY (e.g. 01-Jun-26)
  const dmmmyy = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
  if (dmmmyy) {
    const day = parseInt(dmmmyy[1]);
    const monthStr = dmmmyy[2].toLowerCase();
    let year = parseInt(dmmmyy[3]);
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monthStr.substring(0, 3)];
    if (month !== undefined) {
      const d = new Date(year, month, day);
      if (isValid(d)) return d;
    }
  }

  // Fallback to native Date constructor
  const parsed = new Date(str);
  return isValid(parsed) ? parsed : null;
};

export const safeDateFormat = (dateValue, formatStr = "dd/MM/yyyy") => {
  if (!dateValue) return "";
  const date = parseCustomDate(dateValue);
  return date ? format(date, formatStr) : "";
};

/**
 * Formats a date for display in the UI (e.g. "02 Aug 2010")
 */
export const displayDate = (dateValue) => {
  return safeDateFormat(dateValue, "dd MMM yyyy");
};

/**
 * Returns a date string in YYYY-MM-DD format for inputs
 */
export const dateToInputFormat = (dateValue) => {
  return safeDateFormat(dateValue, "yyyy-MM-dd");
};
