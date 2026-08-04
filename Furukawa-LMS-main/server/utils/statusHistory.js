// Shared logic for tracking status/joiningDate/leavingDate changes on the users table.

// Builds the JSON string for a single, brand-new history entry. Used only when a user is
// first created (auth.model.js, user.controller.js createUser) to seed the genesis entry.
// Updates to an *existing* user's history go through getUpdatedStatusHistory below.
export const buildStatusHistoryEntry = ({ status, joiningDate, leavingDate, changedBy, changedByName }) => {
    return JSON.stringify({
        status: status ?? null,
        joiningDate: joiningDate ?? null,
        leavingDate: leavingDate ?? null,
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
    const joiningDateChanged = next.joiningDate !== undefined && (next.joiningDate || null) !== (current.joiningDate || null);
    const leavingDateChanged = next.leavingDate !== undefined && (next.leavingDate || null) !== (current.leavingDate || null);
    if (!statusChanged && !joiningDateChanged && !leavingDateChanged) return null;

    const nextStatus = next.status !== undefined ? next.status : current.status;
    const nextJoiningDate = next.joiningDate !== undefined ? next.joiningDate : current.joiningDate;
    const nextLeavingDate = next.leavingDate !== undefined ? next.leavingDate : current.leavingDate;

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
