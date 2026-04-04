const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  resolveChartTimezoneForChartInsert,
  isValidIanaTimezone,
} = require('../lib/chart-timezone-resolve');

describe('chart-timezone-resolve', () => {
  it('accepts valid client IANA (branch 1)', () => {
    const z = resolveChartTimezoneForChartInsert({
      timezone: ' America/New_York ',
      lat: 0,
      lon: 0,
    });
    assert.strictEqual(z, 'America/New_York');
  });

  it('accepts tz alias over lat/lon (branch 1)', () => {
    const z = resolveChartTimezoneForChartInsert({
      tz: 'Europe/London',
      lat: 40,
      lon: -74,
    });
    assert.strictEqual(z, 'Europe/London');
  });

  it('timezone wins over tz when both set (branch 1)', () => {
    const z = resolveChartTimezoneForChartInsert({
      timezone: 'America/Los_Angeles',
      tz: 'Europe/London',
      lat: 51.5,
      lon: -0.12,
    });
    assert.strictEqual(z, 'America/Los_Angeles');
  });

  it('derives from lat/lon when no client tz (branch 2)', () => {
    const z = resolveChartTimezoneForChartInsert({
      lat: 40.7128,
      lon: -74.006,
    });
    assert.strictEqual(z, 'America/New_York');
  });

  it('rejects invalid client IANA (fail closed)', () => {
    assert.throws(
      () =>
        resolveChartTimezoneForChartInsert({
          timezone: 'Not/A_Real_Zone',
          lat: 40,
          lon: -74,
        }),
      (e) => e.code === 'INVALID_CHART_TIMEZONE'
    );
  });

  it('rejects missing coords and client tz (branch 3)', () => {
    assert.throws(
      () =>
        resolveChartTimezoneForChartInsert({
          lat: NaN,
          lon: -74,
        }),
      (e) => e.code === 'CHART_TIMEZONE_UNRESOLVABLE'
    );
  });

  it('replaces UTC placeholder with geographic zone when lat/lon are finite', () => {
    const z = resolveChartTimezoneForChartInsert({
      timezone: 'UTC',
      lat: 29.4241,
      lon: -98.4936,
    });
    assert.strictEqual(z, 'America/Chicago');
  });

  it('rejects UTC placeholder when coordinates are not resolvable', () => {
    assert.throws(
      () =>
        resolveChartTimezoneForChartInsert({
          timezone: 'UTC',
          lat: NaN,
          lon: NaN,
        }),
      (e) => e.code === 'CHART_TIMEZONE_UNRESOLVABLE'
    );
  });

  it('isValidIanaTimezone', () => {
    assert.strictEqual(isValidIanaTimezone('UTC'), true);
    assert.strictEqual(isValidIanaTimezone(''), false);
  });
});
