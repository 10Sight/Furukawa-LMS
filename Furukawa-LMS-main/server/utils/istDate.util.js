const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Formats a JS Date using its LOCAL calendar fields (not UTC). Tedious
 * (with useUTC:false, see connectDB.js) reconstructs SQL DATE columns as
 * Date objects using local fields; calling toISOString() on them re-encodes
 * via UTC and shifts the calendar day back by the server's UTC offset. Use
 * this instead whenever flattening a DB-sourced DATE column to a string.
 */
export const formatLocalDate = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Midnight (00:00:00) IST of the calendar day AFTER the given instant,
 * returned as a UTC Date. Used to gate features that should unlock on the
 * next calendar day (IST) rather than after a fixed elapsed duration.
 */
export const getNextCalendarDayMidnightIST = (dateInput) => {
    const date = new Date(dateInput);
    const istDate = new Date(date.getTime() + IST_OFFSET_MS);

    const nextIstDate = new Date(istDate);
    nextIstDate.setUTCDate(istDate.getUTCDate() + 1);
    nextIstDate.setUTCHours(0, 0, 0, 0);

    return new Date(nextIstDate.getTime() - IST_OFFSET_MS);
};
