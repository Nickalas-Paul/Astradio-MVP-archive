/**
 * Sandbox determinism: full-precision override hashing (no rounding).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const { hashOverrides, hashBirth } = require('../dist/vnext/vnext/api/sandbox-snapshot');

describe('hashOverrides full precision', () => {
  it('identical inputs produce identical hashes', () => {
    const o = { planets: { moon: { lonDeg: 123.4567890123 } }, angles: undefined };
    const a = hashOverrides(o);
    const b = hashOverrides(o);
    assert.strictEqual(a, b);
  });

  it('different lonDeg produces different hash (sub-0.1 delta)', () => {
    const o1 = { planets: { moon: { lonDeg: 1.000000001 } } };
    const o2 = { planets: { moon: { lonDeg: 1.000000002 } } };
    assert.notStrictEqual(hashOverrides(o1), hashOverrides(o2));
  });

  it('does not use toFixed rounding (1.05 vs 1.04 differ)', () => {
    const o1 = { planets: { sun: { lonDeg: 1.04 } } };
    const o2 = { planets: { sun: { lonDeg: 1.05 } } };
    assert.notStrictEqual(hashOverrides(o1), hashOverrides(o2));
  });
});

describe('hashBirth full precision', () => {
  it('stable for same birth', () => {
    const b = {
      date: '1990-01-15',
      time: '12:00',
      lat: 40.712812345,
      lon: -74.0060111,
      tz: 'UTC',
      houseSystem: 'placidus',
    };
    assert.strictEqual(hashBirth(b), hashBirth(b));
  });

  it('lat lon precision changes hash', () => {
    const b1 = { date: '1990-01-15', time: '12:00', lat: 40.71, lon: -74.0 };
    const b2 = { date: '1990-01-15', time: '12:00', lat: 40.7100000001, lon: -74.0 };
    assert.notStrictEqual(hashBirth(b1), hashBirth(b2));
  });
});
