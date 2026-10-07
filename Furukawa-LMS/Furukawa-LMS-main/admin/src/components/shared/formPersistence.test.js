import test from 'node:test';
import assert from 'node:assert/strict';
import { readSaved, commitSaved } from './formPersistence.js';

for (const kind of ['ptm', 'pdca']) {
  test(`${kind}: create, reopen, update, isolate records and retain data on failed save`, () => {
    const store = new Map();
    let fail = false;
    globalThis.localStorage = {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => { if (fail) throw new Error('Quota exceeded'); store.set(key, value); },
    };
    const key = `${kind}_dashboard_items`;
    const original = [{ id: 'first', topic: 'First', sheet: { rows: [{ remarks: 'before', image: 'data:image/png;base64,AA==' }], headerInfo: { preparedBy: 'Person' } } }];
    commitSaved(key, original);
    const reopened = readSaved(key, []);
    assert.deepEqual(reopened, original);
    const updated = [{ ...reopened[0], topic: 'Updated', sheet: { ...reopened[0].sheet, rows: [{ remarks: 'after' }] } }, { id: 'second', topic: 'Second' }];
    commitSaved(key, updated);
    assert.deepEqual(readSaved(key, []), updated);
    fail = true;
    assert.throws(() => commitSaved(key, []), /Quota/);
    assert.deepEqual(readSaved(key, []), updated);
    fail = false;
    store.set(key, '{broken');
    assert.deepEqual(readSaved(key, original), original);
    assert.throws(() => commitSaved(key, []), /recover/);
    assert.equal(store.get(key), '{broken');
  });
}
