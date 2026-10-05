// Shared logic for tracking status/joiningDate/leavingDate changes on the users table.

// joiningDate/leavingDate reach these functions in two different shapes: a plain
// "YYYY-MM-DD" string from request bodies, or a native JS Date from a DB SELECT (the mssql
// driver returns DATE columns as Date objects). Embedding a Date directly into an object that
// later goes through JSON.stringify silently calls .toISOString(), which stamps on a UTC
// time-of-day and can shift the calendar date by a day depending on how that Date was
// constructed. Normalizing to a bare date string here keeps statusHistory entries exact
// regardless of which shape the caller had on hand.
const formatDateStr = (val) => {
    if (!val) return null;
    if (val instanceof Date) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    if (typeof val === 'string') {
        return val.split('T')[0];
    }
    return val;
};

// Builds the JSON string for a single, brand-new history entry. Used only when a user is
// first created (auth.model.js, user.controller.js createUser) to seed the genesis entry.
// Updates to an *existing* user's history go through getUpdatedStatusHistory below.
export const buildStatusHistoryEntry = ({ status, joiningDate, leavingDate, changedBy, changedByName }) => {
    return JSON.stringify({
        status: status ?? null,
        joiningDate: formatDateStr(joiningDate),
        leavingDate: formatDateStr(leavingDate),
        changedBy: changedBy ?? null,
        changedByName: changedByName ?? null,
        changedAt: new Date().toISOString(),
    });
};

const parseHistory = (existingHistory) => {
    if (Array.isArray(existingHistory)) return [...existingHistory];
    if (typeof existingHistory === "string") {
        try {
            const parsed = JSON.parse(existingHistory || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
};

// Computes the new statusHistory array for a user moving from `current` (status/joiningDate/
// leavingDate before the update) to `next` (the incoming partial payload — only fields
// actually present are treated as touched). Returns null if none of the tracked fields
// changed, so callers can skip the write entirely.
//
// LEFT is treated as a terminal marker on the *current* stint rather than a stint of its
// own:
//   - Transitioning into LEFT updates the last entry in place (adds leavingDate/status).
//   - Transitioning out of LEFT (rejoining) appends a fresh entry for the new stint.
//   - Everything else that touches these fields (active-to-active status changes, or
//     corrections to dates with no status change) updates the last entry in place.
export const getUpdatedStatusHistory = (existingHistory, current, next, changedByInfo) => {
    const statusChanged = next.status !== undefined && (next.status || null) !== (current.status || null);
    const joiningDateChanged = next.joiningDate !== undefined && formatDateStr(next.joiningDate) !== formatDateStr(current.joiningDate);
    const leavingDateChanged = next.leavingDate !== undefined && formatDateStr(next.leavingDate) !== formatDateStr(current.leavingDate);
    if (!statusChanged && !joiningDateChanged && !leavingDateChanged) return null;

    let nextStatus = next.status !== undefined ? next.status : current.status;
    const nextJoiningDate = formatDateStr(next.joiningDate !== undefined ? next.joiningDate : current.joiningDate);
    const nextLeavingDate = formatDateStr(next.leavingDate !== undefined ? next.leavingDate : current.leavingDate);

    // If a leaving date is present on this stint, the status for that stint must be "LEFT"
    if (nextLeavingDate && nextStatus !== "LEFT") {
        nextStatus = "LEFT";
    }

    const history = parseHistory(existingHistory);
    const changedAt = new Date().toISOString();
    const changedBy = changedByInfo.changedBy ?? null;
    const changedByName = changedByInfo.changedByName ?? null;

    const transitionOutOfLeft = nextStatus !== "LEFT" && current.status === "LEFT";

    if (history.length > 0 && !transitionOutOfLeft) {
        const lastIdx = history.length - 1;
        history[lastIdx] = {
            ...history[lastIdx],
            status: nextStatus ?? null,
            joiningDate: nextJoiningDate ?? null,
            leavingDate: nextLeavingDate ?? null,
            changedBy,
            changedByName,
            changedAt,
        };
    } else {
        history.push({
            status: nextStatus ?? null,
            joiningDate: nextJoiningDate ?? null,
            leavingDate: transitionOutOfLeft ? null : (nextLeavingDate ?? null),
            changedBy,
            changedByName,
            changedAt,
        });
    }

    return history;
};
