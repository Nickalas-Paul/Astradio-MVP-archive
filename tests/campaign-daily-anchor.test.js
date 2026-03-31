/**
 * @import { test } from 'node:test';
 * @import assert from 'node:assert';
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { anchorFallbackOrder, canonicalSortUserIds } = require('../server/lib/campaign-daily-anchor');
const { CAMPAIGN_DAILY_ENGINE_VERSION } = require('../server/lib/campaign-runtime');

describe('campaign-daily-anchor', () => {
  it('canonicalSortUserIds sorts lexically', () => {
    assert.deepStrictEqual(canonicalSortUserIds(['b', 'a', '']), ['a', 'b']);
  });

  it('primary index is deterministic from hash', () => {
    const order1 = anchorFallbackOrder('camp1', '2025-06-01', CAMPAIGN_DAILY_ENGINE_VERSION, ['u1', 'u2', 'u3']);
    const order2 = anchorFallbackOrder('camp1', '2025-06-01', CAMPAIGN_DAILY_ENGINE_VERSION, ['u1', 'u2', 'u3']);
    assert.deepStrictEqual(order1, order2);
    assert.strictEqual(new Set(order1).size, 3);
  });

  it('different campaign_id changes rotation (same date)', () => {
    const roster = ['a', 'b', 'c'];
    const a = anchorFallbackOrder('camp_a', '2025-06-01', 'v1', roster);
    const b = anchorFallbackOrder('camp_b', '2025-06-01', 'v1', roster);
    assert.notDeepStrictEqual(a, b);
  });

  it('owner id is not treated specially', () => {
    const order = anchorFallbackOrder('x', '2025-01-01', 'v1', ['owner_z', 'member_a', 'member_b']);
    assert.ok(order.includes('owner_z'));
    assert.strictEqual(order.length, 3);
  });
});
