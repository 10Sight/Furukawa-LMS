import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateRejectReason, normalizeRejectReason, getRejectedRows, enforceRejectReasons,
    REJECT_REASON_MAX,
} from './daily5mRowStatus.js';

test('reject reason is normalized and length-checked', () => {
    assert.equal(normalizeRejectReason('  wrong \n  operator  '), 'wrong operator');
    assert.equal(normalizeRejectReason(null), '');
    assert.match(validateRejectReason('   abc  '), /at least/);
    assert.match(validateRejectReason('x'.repeat(REJECT_REASON_MAX + 1)), /at most/);
    assert.equal(validateRejectReason('Lot number missing'), null);
});

test('getRejectedRows lists REJECTED and DECLINED rows, with null for legacy reasons', () => {
    const rows = getRejectedRows({
        rec_0_RowStatus: 'APPROVED',
        rec_1_RowStatus: 'REJECTED', rec_1_RejectReason: ' Bad dim ', rec_1_ActionBy: 'QA', rec_1_ActionAt: '2026-10-01T00:00:00Z',
        rec_4_RowStatus: 'DECLINED',
    });
    assert.deepEqual(rows.map(r => [r.rowNo, r.reason, r.actionBy]), [[2, 'Bad dim', 'QA'], [5, null, null]]);
    assert.deepEqual(getRejectedRows(null), []);
});

test('a new rejection without a valid reason is refused', () => {
    const data = { rec_2_RowStatus: 'REJECTED', rec_2_RejectReason: 'no' };
    const { error } = enforceRejectReasons(data, {});
    assert.equal(error.rowNo, 3);
    assert.equal(enforceRejectReasons({ rec_0_RowStatus: 'REJECTED' }, null).error.rowNo, 1);
});

test('a new rejection stores the normalized reason', () => {
    const data = { rec_0_RowStatus: 'REJECTED', rec_0_RejectReason: '  Wrong   lot  ' };
    assert.equal(enforceRejectReasons(data, {}).error, undefined);
    assert.equal(data.rec_0_RejectReason, 'Wrong lot');
});

test('a saved reason cannot be rewritten by a later save', () => {
    const prev = { rec_0_RowStatus: 'REJECTED', rec_0_RejectReason: 'Original reason' };
    const data = { rec_0_RowStatus: 'REJECTED', rec_0_RejectReason: 'Edited reason' };
    const { error, tampered } = enforceRejectReasons(data, prev);
    assert.equal(error, undefined);
    assert.equal(data.rec_0_RejectReason, 'Original reason');
    assert.deepEqual(tampered, [{ rowNo: 1 }]);
});

test('legacy rejected rows without a reason keep saving', () => {
    const data = { rec_0_RowStatus: 'REJECTED' };
    assert.equal(enforceRejectReasons(data, { rec_0_RowStatus: 'REJECTED' }).error, undefined);
    assert.equal('rec_0_RejectReason' in data, false);
});

test('rows that are not rejected never carry a reason', () => {
    const data = { rec_0_RowStatus: 'APPROVED', rec_0_RejectReason: 'stale', rec_1_RejectReason: 'stray' };
    enforceRejectReasons(data, {});
    assert.equal('rec_0_RejectReason' in data, false);
    assert.equal('rec_1_RejectReason' in data, false);
});
