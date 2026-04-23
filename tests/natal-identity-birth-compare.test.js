const { describe, it } = require('node:test');
const assert = require('node:assert');
const { natalBirthKeyChanged, normTime } = require('../dist/vnext/vnext/compat/natal-identity-birth-compare.js');

describe('natal-identity-birth-compare (unit)', () => {
  it('returns false when all natal key fields match (same resolved tz)', () => {
    const before = {
      date: '1988-05-15',
      time: '12:30',
      lat: 29.4241,
      lon: -98.4936,
      timezone: 'America/Chicago',
    };
    const input = { date: '1988-05-15', time: '12:30', lat: 29.4241, lon: -98.4936, timezone: 'America/Chicago' };
    assert.strictEqual(
      natalBirthKeyChanged(before, input, 'America/Chicago'),
      false
    );
  });

  it('returns true when time changes', () => {
    const before = {
      date: '2001-01-01',
      time: '12:32',
      lat: 40.0,
      lon: -74.0,
      timezone: 'America/New_York',
    };
    const input = { date: '2001-01-01', time: '12:33', lat: 40.0, lon: -74.0, timezone: 'America/New_York' };
    assert.strictEqual(
      natalBirthKeyChanged(before, input, 'America/New_York'),
      true
    );
  });

  it('normTime normalizes to HH:MM', () => {
    assert.strictEqual(normTime('12:30:00'), '12:30');
  });
});
