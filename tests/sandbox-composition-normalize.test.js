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
  it('allows mixed chart_id + ephemeris_birth for pair (LOCK 8)', () => {
    const r = normalizeCompositionInput({
      slots: [
        { chart_id: 'a' },
        { ephemeris_birth: { date: '1990-01-01', time: '12:00', lat: 0, lon: 0 }, overrides: { planets: {} } },
      ],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'pair_aggregate');
    assert.strictEqual(r.canonical_slot_order.length, 2);
    assert.ok(r.canonical_slot_order[0].startsWith('0:chart:a:'));
    assert.ok(r.canonical_slot_order[1].startsWith('1:birth:'));
  });

  it('pair aggregate uses UI order not sorted chart ids (LOCK 5–6)', () => {
    const r = normalizeCompositionInput({
      slots: [{ chart_id: 'z' }, { chart_id: 'a' }],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'pair_aggregate');
    assert.deepStrictEqual(
      r.canonical_slot_order.map((t) => t.split(':')[2]),
      ['z', 'a'],
      'first token is chart id in slot order',
    );
  });

  it('single birth slot', () => {
    const r = normalizeCompositionInput({
      slots: [{ ephemeris_birth: { date: '1990-01-01', time: '12:00', lat: 1, lon: 2 }, overrides: { planets: {} } }],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.composition_mode, 'single');
    assert.strictEqual(r.canonical_slot_order.length, 1);
    assert.ok(r.canonical_slot_order[0].startsWith('0:birth:'));
  });

  it('override fingerprint changes canonical hash (slot-level)', () => {
    const base = {
      slots: [
        { chart_id: 'x', overrides: { planets: {} } },
        { chart_id: 'y', overrides: { planets: {} } },
      ],
      active_slot_index: 0,
      compose_controls: { arc_shape: 0.5 },
    };
    const withMoon = {
      ...base,
      slots: [
        base.slots[0],
        {
          chart_id: 'y',
          overrides: { planets: { moon: { lonDeg: 90 } } },
        },
      ],
    };
    const r0 = normalizeCompositionInput(base);
    const r1 = normalizeCompositionInput(withMoon);
    assert.strictEqual(r0.ok, true);
    assert.strictEqual(r1.ok, true);
    assert.notStrictEqual(r0.canonical_input_hash, r1.canonical_input_hash);
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
    assert.strictEqual(r.canonical_slot_order.length, 2);
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

  it('rejects invalid mutual exclusive slot', () => {
    const r = normalizeCompositionInput({
      slots: [
        {
          chart_id: 'a',
          ephemeris_birth: { date: '1990-01-01', time: '12:00', lat: 0, lon: 0 },
        },
      ],
      active_slot_index: 0,
    });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.code, SANDBOX_COMPOSITION_ERROR_CODES.INVALID_BODY);
  });
});
