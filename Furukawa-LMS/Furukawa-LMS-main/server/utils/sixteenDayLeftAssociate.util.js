// Rules for saving a 16-Day Monitoring sheet whose associate has status LEFT.
//
// The performance grid (Days 1-16, marks, attendance) is frozen: only the comment
// may change, plus the Day-1..Day-16 column dates (attendance_date_N) for users
// allowed to edit LEFT associates' dates. The signature workflow stays open
// (validateSignatureProgression in the controller still enforces its order). Header
// details may be corrected, but only by users allowed to edit LEFT associates'
// headers. Changing a header value or day date that was already saved needs an audit
// remark. Employee Code and Start Date never change (Start Date is not re-derived
// from an edited Day-1 date).
//
// Keep LEFT_EDITABLE_HEADER_FIELDS, canEditLeftAssociateHeader and
// canEditLeftAssociateDates in sync with
// admin/src/components/common/training/SixteenDayMonitoringSheet.jsx.

import { ApiError } from "./ApiError.js";

export const LEFT_EDITABLE_HEADER_FIELDS = [
    "employeeName", "dept", "processName", "handoverDate",
    "trgResult", "workingWith", "lineLeaderName",
];

const SIGNATURE_FIELDS = ["checkedBy", "verifiedBy", "approvedBy", "verifiedByEduCell"];

export function canEditLeftAssociateHeader(user) {
    if (!user) return false;
    if (user.isAdmin || user.role === "ADMIN" || user.role === "SUPERADMIN") return true;
    const perms = Array.isArray(user.customRole?.permissions) ? user.customRole.permissions : [];
    return perms.includes("sixteen_day:edit_submitted") || perms.includes("sixteen_day:manage");
}

export const SIXTEEN_DAY_EDIT_LEFT_DATES = "sixteen_day:edit_left_dates";

export function canEditLeftAssociateDates(user) {
    if (!user) return false;
    if (user.isAdmin || user.role === "ADMIN" || user.role === "SUPERADMIN") return true;
    const perms = Array.isArray(user.customRole?.permissions) ? user.customRole.permissions : [];
    return perms.includes(SIXTEEN_DAY_EDIT_LEFT_DATES);
}

const norm = (v) => (v === undefined || v === null ? "" : String(v).trim());

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Day dates are stored as "dd-MMM-yy" (e.g. "05-Oct-26"), as the sheet's date picker writes them.
// Returns a sortable UTC timestamp, or null when the value isn't a valid date in that format.
function parseDayDate(value) {
    const m = /^(\d{2})-([A-Z][a-z]{2})-(\d{2})$/.exec(norm(value));
    if (!m) return null;
    const month = MONTHS.indexOf(m[2]);
    if (month < 0) return null;
    const day = Number(m[1]);
    const year = 2000 + Number(m[3]);
    const ts = Date.UTC(year, month, day);
    return new Date(ts).getUTCDate() === day ? ts : null;
}

/**
 * Applies the Day-1..Day-16 date edits in `incomingGrid` onto `grid` (mutated).
 * Returns true when a previously saved date was changed or cleared.
 */
function applyLeftDayDates(grid, savedGrid, incomingGrid) {
    let changedSaved = false;
    let anyChanged = false;
    for (let d = 1; d <= 16; d++) {
        const key = `attendance_date_${d}`;
        if (!Object.prototype.hasOwnProperty.call(incomingGrid, key)) continue;
        const incoming = incomingGrid[key];
        if (incoming !== null && incoming !== undefined && typeof incoming !== "string") {
            throw new ApiError(`Invalid date for Day-${d}.`, 400);
        }
        const next = norm(incoming);
        const saved = norm(savedGrid[key]);
        if (next === saved) continue;
        if (next !== "" && parseDayDate(next) === null) {
            throw new ApiError(`Invalid date for Day-${d}. Expected a date like 05-Oct-26.`, 400);
        }
        grid[key] = next;
        anyChanged = true;
        if (saved !== "") changedSaved = true;
    }

    // Dates must run strictly forward across the days that have one (as the date picker
    // enforces). Only checked when something changed, so legacy records keep saving.
    if (anyChanged) {
        let prev = null;
        for (let d = 1; d <= 16; d++) {
            const ts = parseDayDate(grid[`attendance_date_${d}`]);
            if (ts === null) continue;
            if (prev !== null && ts <= prev.ts) {
                throw new ApiError(`Day-${d} date must be after the Day-${prev.day} date.`, 400);
            }
            prev = { day: d, ts };
        }
    }
    return changedSaved;
}

/**
 * Returns the values to persist for a LEFT associate's sheet.
 * `sheet` is the existing record; `body` is the request payload.
 * Throws ApiError when no record exists, a new attempt is requested, or a saved
 * header value is changed without an audit remark.
 */
export function resolveLeftAssociateSave({ sheet, body = {}, user }) {
    if (!sheet || body.isNewAttempt) {
        throw new ApiError("This associate has left. A new monitoring attempt cannot be created.", 400);
    }

    const canEditHeader = canEditLeftAssociateHeader(user);
    const header = {
        employeeCode: sheet.employeeCode,
        startDate: sheet.startDate,
    };
    let changedSavedValue = false;

    for (const field of LEFT_EDITABLE_HEADER_FIELDS) {
        const incoming = body[field];
        // Unauthorized callers are pinned to the saved value silently: the client
        // fills empty fields with fallbacks (e.g. the user's department), so a
        // difference isn't necessarily tampering.
        if (!canEditHeader || (incoming !== null && incoming !== undefined && typeof incoming !== "string")) {
            header[field] = sheet[field];
            continue;
        }
        if (incoming === undefined) {
            header[field] = sheet[field];
            continue;
        }
        header[field] = incoming;
        if (norm(sheet[field]) !== "" && norm(sheet[field]) !== norm(incoming)) {
            changedSavedValue = true;
        }
    }

    const savedGrid = sheet.gridData || {};
    const incomingGrid = body.gridData && typeof body.gridData === "object" ? body.gridData : {};
    const incomingComment = incomingGrid.comment || "";
    const gridData = { ...savedGrid, comment: incomingComment };

    // Unauthorized callers' date changes are ignored, like their header changes.
    if (canEditLeftAssociateDates(user) && applyLeftDayDates(gridData, savedGrid, incomingGrid)) {
        changedSavedValue = true;
    }

    if (changedSavedValue && !norm(body.adminRemark)) {
        throw new ApiError("An audit remark is required when changing saved details of an associate who has left.", 400);
    }

    const signatures = {};
    for (const field of SIGNATURE_FIELDS) {
        signatures[field] = body[field] !== undefined ? body[field] : sheet[field];
    }

    return { header, signatures, gridData };
}
