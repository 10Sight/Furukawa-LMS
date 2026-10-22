// Single source of truth for Daily 5M row-status rules, shared by the admin UI and the server.

export const DAILY_5M_MAX_ROWS = 20;
export const ROW_STATUS = Object.freeze({ APPROVED: 'APPROVED', REJECTED: 'REJECTED', DECLINED: 'DECLINED' });
export const REJECT_REASON_MIN = 5;
export const REJECT_REASON_MAX = 300;

export const rowKey = (rowIndex, field) => `rec_${rowIndex}_${field}`;
export const isRejectedStatus = (status) => status === ROW_STATUS.REJECTED || status === ROW_STATUS.DECLINED;
export const normalizeRejectReason = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// Row-level status shown on the dashboard and used by its status filter.
export const ROW_STATE = Object.freeze({ APPROVED: 'APPROVED', REJECTED: 'REJECTED', PENDING: 'PENDING' });
// Values accepted by the records list `rowStatus` filter: sheets having at least one row in that state.
export const ROW_STATUS_FILTERS = Object.freeze(['approved', 'rejected', 'pending']);

// A row counts once it has any of its identifying fields filled.
export const isRowActive = (recordData, rowIndex) => !!(
    recordData?.[rowKey(rowIndex, 'Date')] ||
    recordData?.[rowKey(rowIndex, 'Line')] ||
    recordData?.[rowKey(rowIndex, 'StationMC')] ||
    recordData?.[rowKey(rowIndex, 'OpName')] ||
    recordData?.[rowKey(rowIndex, 'OperatorName')]
);

export const rowStateOf = (status) =>
    status === ROW_STATUS.APPROVED ? ROW_STATE.APPROVED
        : isRejectedStatus(status) ? ROW_STATE.REJECTED
            : ROW_STATE.PENDING;

// Per-row states of a sheet's active rows plus their counts.
export function summarizeRowStatuses(recordData) {
    const summary = { approved: 0, rejected: 0, pending: 0, total: 0, rows: [] };
    if (!recordData || typeof recordData !== 'object') return summary;
    for (let i = 0; i < DAILY_5M_MAX_ROWS; i++) {
        if (!isRowActive(recordData, i)) continue;
        const state = rowStateOf(recordData[rowKey(i, 'RowStatus')]);
        summary.rows.push({ rowNo: i + 1, state });
        summary.total++;
        if (state === ROW_STATE.APPROVED) summary.approved++;
        else if (state === ROW_STATE.REJECTED) summary.rejected++;
        else summary.pending++;
    }
    return summary;
}

// Returns an error message, or null when the reason is acceptable.
export function validateRejectReason(value) {
    const reason = normalizeRejectReason(value);
    if (reason.length < REJECT_REASON_MIN) return `Rejection reason must be at least ${REJECT_REASON_MIN} characters.`;
    if (reason.length > REJECT_REASON_MAX) return `Rejection reason must be at most ${REJECT_REASON_MAX} characters.`;
    return null;
}

// Rejected rows of a sheet, in row order. `reason` is null for rows rejected before reasons were required.
export function getRejectedRows(recordData) {
    if (!recordData || typeof recordData !== 'object') return [];
    const rows = [];
    for (let i = 0; i < DAILY_5M_MAX_ROWS; i++) {
        if (!isRejectedStatus(recordData[rowKey(i, 'RowStatus')])) continue;
        rows.push({
            rowIndex: i,
            rowNo: i + 1,
            reason: normalizeRejectReason(recordData[rowKey(i, 'RejectReason')]) || null,
            actionBy: recordData[rowKey(i, 'ActionBy')] || null,
            actionAt: recordData[rowKey(i, 'ActionAt')] || null,
        });
    }
    return rows;
}

// Server-side enforcement, run on every save. Mutates `recordData` in place:
//  - a row newly moved to REJECTED must carry a valid reason (stored normalized);
//  - a row that was already REJECTED keeps its saved reason (it cannot be rewritten later);
//  - a row that is not rejected never carries a reason.
// Returns { error: { rowNo, message } } on the first invalid row, and the list of reasons a
// client tried to rewrite (for logging) in `tampered`.
export function enforceRejectReasons(recordData, previousRecordData) {
    const tampered = [];
    if (!recordData || typeof recordData !== 'object') return { tampered };
    for (let i = 0; i < DAILY_5M_MAX_ROWS; i++) {
        const key = rowKey(i, 'RejectReason');
        const newStatus = recordData[rowKey(i, 'RowStatus')];
        const prevStatus = previousRecordData?.[rowKey(i, 'RowStatus')];

        if (!isRejectedStatus(newStatus)) {
            delete recordData[key];
            continue;
        }

        if (isRejectedStatus(prevStatus)) {
            const saved = previousRecordData?.[key];
            if (saved !== undefined && normalizeRejectReason(recordData[key]) !== normalizeRejectReason(saved)) {
                tampered.push({ rowNo: i + 1 });
            }
            if (saved === undefined) delete recordData[key];
            else recordData[key] = saved;
            continue;
        }

        const message = validateRejectReason(recordData[key]);
        if (message) return { error: { rowNo: i + 1, message }, tampered };
        recordData[key] = normalizeRejectReason(recordData[key]);
    }
    return { tampered };
}
