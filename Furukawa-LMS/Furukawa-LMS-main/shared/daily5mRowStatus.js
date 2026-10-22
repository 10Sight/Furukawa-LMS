// Single source of truth for Daily 5M row-status rules, shared by the admin UI and the server.

export const DAILY_5M_MAX_ROWS = 20;
export const ROW_STATUS = Object.freeze({ APPROVED: 'APPROVED', REJECTED: 'REJECTED', DECLINED: 'DECLINED' });
export const REJECT_REASON_MIN = 5;
export const REJECT_REASON_MAX = 300;

export const rowKey = (rowIndex, field) => `rec_${rowIndex}_${field}`;
export const isRejectedStatus = (status) => status === ROW_STATUS.REJECTED || status === ROW_STATUS.DECLINED;
export const normalizeRejectReason = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

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
