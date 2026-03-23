const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  validateCanonicalLocation,
  transitContextFingerprint,
} = require('../server/lib/canonical-location');

describe('canonical-location', () => {
  const valid = {
    source: 'browser_geo',
    label: 'Test',
    lat: 40.7,
    lon: -74,
    timezone: 'America/New_York',
    resolvedAt: new Date().toISOString(),
  };

  it('accepts valid location', () => {
    const r = validateCanonicalLocation(valid);
    assert.strictEqual(r.ok, true);
  });

  it('rejects bad source', () => {
    const r = validateCanonicalLocation({ ...valid, source: 'nope' });
    assert.strictEqual(r.ok, false);
  });

  it('fingerprint changes with coords', () => {
    const a = transitContextFingerprint(valid, '2025-01-01', '12:00');
    const b = transitContextFingerprint({ ...valid, lat: 41 }, '2025-01-01', '12:00');
    assert.notStrictEqual(a, b);
  });

  it('fingerprint changes with date', () => {
    const a = transitContextFingerprint(valid, '2025-01-01', '12:00');
    const b = transitContextFingerprint(valid, '2025-01-02', '12:00');
    assert.notStrictEqual(a, b);
  });
});
