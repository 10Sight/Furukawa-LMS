import { format, isValid, parseISO } from "date-fns";

/**
 * Safely formats a date string or object.
 * @param {Date|string|number} dateValue - The date to format
 * @param {string} formatStr - The format pattern (default: "dd/MM/yyyy")
 * @returns {string} - Formatted date or empty string/fallback
 */
export const safeDateFormat = (dateValue, formatStr = "dd/MM/yyyy") => {
  if (!dateValue) return "";
  
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    // Try to parse as ISO first for YYYY-MM-DD
    date = new Date(dateValue);
  }

  return isValid(date) ? format(date, formatStr) : "";
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
