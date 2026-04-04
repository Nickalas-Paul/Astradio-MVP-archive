const { describe, it } = require('node:test');
const assert = require('node:assert');

describe(
  'pg-store chart timezone (integration)',
  { skip: !process.env.POSTGRES_URL },
  () => {
    it('createChart persists non-null timezone when client omits IANA', async () => {
      const pgStore = require('../lib/pg-store');
      const chart = await pgStore.createChart({
        ownerId: null,
        label: 'tz_integration_test',
        date: '2001-06-15',
        time: '09:30',
        lat: 40.7128,
        lon: -74.006,
      });
      try {
        assert.ok(chart.timezone && typeof chart.timezone === 'string', 'timezone must be set');
        assert.strictEqual(chart.timezone, 'America/New_York');
        const again = await pgStore.getChart(chart.id);
        assert.ok(again && again.timezone, 'read-back must include timezone');
      } finally {
        await pgStore.deleteChart(chart.id);
      }
    });

    it('createChart replaces persisted UTC placeholder with tzlookup when lat/lon are valid', async () => {
      const pgStore = require('../lib/pg-store');
      const chart = await pgStore.createChart({
        ownerId: null,
        label: 'tz_integration_test_utc_override',
        date: '1988-05-15',
        time: '12:30',
        lat: 29.4241,
        lon: -98.4936,
        timezone: 'UTC',
      });
      try {
        assert.strictEqual(chart.timezone, 'America/Chicago');
        const again = await pgStore.getChart(chart.id);
        assert.strictEqual(again?.timezone, 'America/Chicago');
      } finally {
        await pgStore.deleteChart(chart.id);
      }
    });

    it('updateChartBirthFields resolves UTC placeholder and clears snapshot_hash', async () => {
      const pgStore = require('../lib/pg-store');
      const { pool } = require('../lib/database');
      const ownerId = `usr_tz_upd_${Date.now()}`;
      await pgStore.createUser({ id: ownerId, handle: ownerId, email: `${ownerId}@test.invalid` });
      const chart = await pgStore.createChart({
        ownerId,
        label: 'upd_tz',
        date: '1988-05-15',
        time: '12:30',
        lat: 29.4241,
        lon: -98.4936,
        timezone: 'UTC',
      });
      try {
        await pool.query(`UPDATE astradio_charts SET timezone = 'UTC', snapshot_hash = $2 WHERE id = $1`, [
          chart.id,
          'legacy_hash_placeholder',
        ]);

        const stale = await pgStore.getChart(chart.id);
        assert.strictEqual(stale?.timezone, 'UTC');
        assert.strictEqual(stale?.snapshotHash, 'legacy_hash_placeholder');

        const updated = await pgStore.updateChartBirthFields(chart.id, ownerId, {
          label: 'upd_tz',
          date: '1988-05-15',
          time: '12:30',
          lat: 29.4241,
          lon: -98.4936,
          timezone: 'UTC',
        });
        assert.strictEqual(updated?.timezone, 'America/Chicago');
        assert.ok(updated?.snapshotHash == null);

        const again = await pgStore.getChart(chart.id);
        assert.strictEqual(again?.timezone, 'America/Chicago');
        assert.ok(again?.snapshotHash == null);
      } finally {
        await pgStore.deleteChart(chart.id);
      }
    });
  }
);
