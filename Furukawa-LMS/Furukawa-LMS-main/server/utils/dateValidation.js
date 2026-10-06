import { ApiError } from "./ApiError.js";

// users.joiningDate/leavingDate are NVARCHAR, so values reach the app as "YYYY-MM-DD" strings,
// ISO timestamps, native JS Dates (left_requests.leavingDate is a real DATE column) or, on older
// rows, free-form text like "Sep 19 2026 12:00AM". Normalize to a bare "YYYY-MM-DD" using local
// calendar components (not toISOString(), which can shift the date across a UTC day boundary) so
// two dates can be compared as plain strings. Returns null for empty/unparseable input.
export const toDateOnlyString = (val) => {
    if (val === null || val === undefined || val === "") return null;

    const fromDate = (d) => {
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (val instanceof Date) return fromDate(val);

    const str = String(val).trim();
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    // SQL Server's default style ("Sep 19 2026 12:00AM") has no space before AM/PM, which
    // JS Date can't parse as-is.
    return fromDate(new Date(str.replace(/(\d)\s*(AM|PM)$/i, "$1 $2")));
};

// Returns an error message when leavingDate falls before joiningDate, or null when the pair is
// consistent. Equal dates are allowed, and a missing/unparseable date on either side is not an
// error -- there is nothing to compare against.
export const getJoiningLeavingDateError = (joiningDate, leavingDate) => {
    const joining = toDateOnlyString(joiningDate);
    const leaving = toDateOnlyString(leavingDate);
    if (!joining || !leaving) return null;
    if (leaving < joining) return `Leaving Date (${leaving}) cannot be before Joining Date (${joining}).`;
    return null;
};

// Throwing variant for request handlers.
export const assertJoiningNotAfterLeaving = (joiningDate, leavingDate) => {
    const error = getJoiningLeavingDateError(joiningDate, leavingDate);
    if (error) throw new ApiError(error, 400);
};
