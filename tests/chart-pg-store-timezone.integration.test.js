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

    it('updateChartBirthFields clears identity_export_id when time changes (natal key)', async () => {
      const pgStore = require('../lib/pg-store');
      const { pool } = require('../lib/database');
      const ownerId = `usr_idexp_${Date.now()}`;
      await pgStore.createUser({
        id: ownerId,
        handle: ownerId,
        displayName: 'ID exp',
        email: `${ownerId}@test.invalid`,
      });
      const chart = await pgStore.createChart({
        ownerId,
        label: 'idexp',
        date: '2001-06-15',
        time: '12:32',
        lat: 40.7128,
        lon: -74.006,
        timezone: 'America/New_York',
      });
      const fakeId = 'a'.repeat(64);
      try {
        await pool.query('UPDATE astradio_charts SET identity_export_id = $1 WHERE id = $2', [fakeId, chart.id]);
        const withId = await pgStore.getChart(chart.id);
        assert.strictEqual(withId?.identityExportId, fakeId);

        const updated = await pgStore.updateChartBirthFields(chart.id, ownerId, {
          label: 'idexp',
          date: '2001-06-15',
          time: '12:33',
          lat: 40.7128,
          lon: -74.006,
          timezone: 'America/New_York',
        });
        assert.strictEqual(updated?.identityExportId, null, 'stale export id must clear on natal change');
        const again = await pgStore.getChart(chart.id);
        assert.strictEqual(again?.identityExportId, null);
      } finally {
        await pgStore.deleteChart(chart.id);
        await pool.query('DELETE FROM astradio_users WHERE id = $1', [ownerId]);
      }
    });

    it('updateChartBirthFields preserves identity_export_id on label-only change', async () => {
      const pgStore = require('../lib/pg-store');
      const { pool } = require('../lib/database');
      const ownerId = `usr_idlab_${Date.now()}`;
      await pgStore.createUser({
        id: ownerId,
        handle: ownerId,
        displayName: 'Label only',
        email: `${ownerId}@test.invalid`,
      });
      const chart = await pgStore.createChart({
        ownerId,
        label: 'old',
        date: '2001-06-15',
        time: '12:32',
        lat: 40.7128,
        lon: -74.006,
        timezone: 'America/New_York',
      });
      const fakeId = 'b'.repeat(64);
      try {
        await pool.query('UPDATE astradio_charts SET identity_export_id = $1 WHERE id = $2', [fakeId, chart.id]);
        const updated = await pgStore.updateChartBirthFields(chart.id, ownerId, {
          label: 'renamed only',
          date: '2001-06-15',
          time: '12:32',
          lat: 40.7128,
          lon: -74.006,
          timezone: 'America/New_York',
        });
        assert.strictEqual(updated?.identityExportId, fakeId, 'label-only update must not clear identity export');
      } finally {
        await pgStore.deleteChart(chart.id);
        await pool.query('DELETE FROM astradio_users WHERE id = $1', [ownerId]);
      }
    });

    it('updateChartBirthFields resolves UTC placeholder and clears snapshot_hash', async () => {
      const pgStore = require('../lib/pg-store');
      const { pool } = require('../lib/database');
      const ownerId = `usr_tz_upd_${Date.now()}`;
      await pgStore.createUser({
        id: ownerId,
        handle: ownerId,
        displayName: 'TZ upd',
        email: `${ownerId}@test.invalid`,
      });
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
