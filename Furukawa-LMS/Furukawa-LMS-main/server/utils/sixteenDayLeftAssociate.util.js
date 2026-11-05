// Rules for saving a 16-Day Monitoring sheet whose associate has status LEFT.
//
// The performance grid (Days 1-16, marks, attendance) is frozen: only the comment
// may change. The signature workflow stays open (validateSignatureProgression in the
// controller still enforces its order). Header details may be corrected, but only by
// users allowed to edit LEFT associates' headers, and changing a value that was
// already saved needs an audit remark. Employee Code and Start Date never change.
//
// Keep LEFT_EDITABLE_HEADER_FIELDS and canEditLeftAssociateHeader in sync with
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

const norm = (v) => (v === undefined || v === null ? "" : String(v).trim());

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

    if (changedSavedValue && !norm(body.adminRemark)) {
        throw new ApiError("An audit remark is required when changing saved header details of an associate who has left.", 400);
    }

    const signatures = {};
    for (const field of SIGNATURE_FIELDS) {
        signatures[field] = body[field] !== undefined ? body[field] : sheet[field];
    }

    const incomingComment = (body.gridData && body.gridData.comment) || "";
    const gridData = { ...(sheet.gridData || {}), comment: incomingComment };

    return { header, signatures, gridData };
}
