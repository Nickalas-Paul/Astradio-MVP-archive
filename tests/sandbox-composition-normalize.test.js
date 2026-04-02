/**
 * Sandbox composition normalization (pure, no I/O).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  normalizeCompositionInput,
  SANDBOX_COMPOSITION_ERROR_CODES,
} = require('../dist/vnext/vnext/api/sandbox-composition-normalize');

describe('normalizeCompositionInput', () => {
  it('rejects mixed aggregate (birth + multi slot)', () => {
    const r = normalizeCompositionInput({
      slots: [
        { chart_id: 'a' },
        { ephemeris_birth: { date: '1990-01-01', time: '12:00', lat: 0, lon: 0 } },
      ],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, SANDBOX_COMPOSITION_ERROR_CODES.MIXED_AGGREGATE_INPUT);
  });

  it('pair aggregate lexical order', () => {
    const r = normalizeCompositionInput({
      slots: [{ chart_id: 'z' }, { chart_id: 'a' }],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'pair_aggregate');
    assert.deepStrictEqual(r.canonical_slot_order, ['a', 'z']);
  });

  it('single birth slot', () => {
    const r = normalizeCompositionInput({
      slots: [{ ephemeris_birth: { date: '1990-01-01', time: '12:00', lat: 1, lon: 2 }, overrides: { planets: {} } }],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'single');
    assert.strictEqual(r.canonical_slot_order.length, 2);
    assert.ok(r.canonical_slot_order[0].startsWith('birth:'));
  });

  it('overlay when same chart twice + transit', () => {
    const r = normalizeCompositionInput({
      slots: [{ chart_id: 'c1' }, { chart_id: 'c1' }],
      active_slot_index: 0,
      transit_context: {
        natal_chart_id: 'c1',
        current_datetime: '2020-01-01T12:00:00Z',
        current_latitude: 40,
        current_longitude: -74,
      },
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'overlay');
  });

  it('pair when two distinct charts even if transit present', () => {
    const r = normalizeCompositionInput({
      slots: [{ chart_id: 'a' }, { chart_id: 'b' }],
      active_slot_index: 0,
      transit_context: {
        natal_chart_id: 'a',
        current_datetime: '2020-01-01T12:00:00Z',
        current_latitude: 40,
        current_longitude: -74,
      },
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'pair_aggregate');
  });
});
