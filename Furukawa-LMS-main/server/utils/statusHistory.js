// Shared logic for tracking status/joiningDate/leavingDate changes on the users table.
// Appends are done atomically in SQL via JSON_MODIFY (see callers), not by reading the
// column into JS and writing it back, to avoid lost updates under concurrent writes.

export const STATUS_HISTORY_TRACKED_FIELDS = ["status", "joiningDate", "leavingDate"];

// `current` is the row before the update; `next` is the incoming partial update payload.
// Only fields actually present in `next` are compared, so callers can pass a full
// req.body without accidentally triggering on untouched fields.
export const statusHistoryChanged = (current, next) => {
    return STATUS_HISTORY_TRACKED_FIELDS.some(
        (f) => next[f] !== undefined && (next[f] || null) !== (current[f] || null)
    );
};

// Builds the JSON string for a single history entry, meant to be bound as the
// JSON_QUERY(?) parameter in `JSON_MODIFY(statusHistory, 'append $', JSON_QUERY(?))`.
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
