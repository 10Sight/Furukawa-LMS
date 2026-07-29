const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

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
