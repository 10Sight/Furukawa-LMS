import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesLpaDateRange } from './lpaDateFilters.js';

test('LPA date range includes both endpoints and accepts one-sided ranges', () => {
  assert.equal(matchesLpaDateRange('23-10-2026', '2026-10-23', '2026-10-23'), true);
  assert.equal(matchesLpaDateRange('2026-10-24', '2026-10-23', '2026-10-24'), true);
  assert.equal(matchesLpaDateRange('22/10/2026', '2026-10-23', ''), false);
  assert.equal(matchesLpaDateRange('23 Oct 2026', '', '2026-10-23'), true);
  assert.equal(matchesLpaDateRange('', '2026-10-23', ''), false);
});
