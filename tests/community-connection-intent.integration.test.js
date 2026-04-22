const { describe, it, before } = require('node:test');
const assert = require('node:assert');

const skip = !process.env.POSTGRES_URL;

describe(
  'community connection intents (integration)',
  { skip },
  () => {
    let pgStore;
    let pool;

    before(() => {
      // eslint-disable-next-line global-require
      pgStore = require('../lib/pg-store');
      // eslint-disable-next-line global-require
      pool = require('../lib/database').pool;
    });

    async function cleanupUsersPair(u1, u2, chart1, chart2) {
      await pool.query(
        `DELETE FROM astradio_connection_intents
         WHERE from_user_id = ANY($1::text[]) OR to_user_id = ANY($1::text[])`,
        [[u1, u2]]
      );
      const ids = [chart1, chart2].filter(Boolean).sort((a, b) => a.localeCompare(b, 'en'));
      const low = ids[0];
      const high = ids[1];
      if (low && high) {
        await pool.query(
          `DELETE FROM astradio_relationships
           WHERE owner_user_id = ANY($1::text[])
             AND chart_id_low = $2 AND chart_id_high = $3`,
          [[u1, u2], low, high]
        );
      }
      await pool.query(`DELETE FROM astradio_user_primary_chart WHERE user_id = ANY($1::text[])`, [[u1, u2]]);
      if (chart1) await pgStore.deleteChart(chart1).catch(() => {});
      if (chart2) await pgStore.deleteChart(chart2).catch(() => {});
      await pool.query(`DELETE FROM astradio_users WHERE id = ANY($1::text[])`, [[u1, u2]]);
    }

    it('mirrored pending: B→A blocked when A→B pending', async () => {
      const t = Date.now();
      const u1 = `usr_cc_m1_${t}`;
      const u2 = `usr_cc_m2_${t}`;
      await pgStore.createUser({ id: u1, handle: u1, email: `${u1}@t.invalid` });
      await pgStore.createUser({ id: u2, handle: u2, email: `${u2}@t.invalid` });
      const c1 = await pgStore.createChart({
        ownerId: u1,
        label: 'cc1',
        date: '1990-01-01',
        time: '12:00',
        lat: 40.7128,
        lon: -74.006,
      });
      const c2 = await pgStore.createChart({
        ownerId: u2,
        label: 'cc2',
        date: '1991-02-02',
        time: '13:00',
        lat: 34.05,
        lon: -118.25,
      });
      try {
        await pgStore.createConnectionIntent({
          fromUserId: u1,
          toUserId: u2,
          fromChartId: c1.id,
          toChartId: c2.id,
          relationshipKind: 'friend',
        });
        await assert.rejects(
          () =>
            pgStore.createConnectionIntent({
              fromUserId: u2,
              toUserId: u1,
              fromChartId: c2.id,
              toChartId: c1.id,
              relationshipKind: 'friend',
            }),
          (e) => e && e.code === 'mirror_pending'
        );
      } finally {
        await cleanupUsersPair(u1, u2, c1.id, c2.id);
      }
    });

    it('concurrent mirrored creates: exactly one succeeds', async () => {
      const t = Date.now();
      const u1 = `usr_cc_cm1_${t}`;
      const u2 = `usr_cc_cm2_${t}`;
      await pgStore.createUser({ id: u1, handle: u1, email: `${u1}@t.invalid` });
      await pgStore.createUser({ id: u2, handle: u2, email: `${u2}@t.invalid` });
      const c1 = await pgStore.createChart({
        ownerId: u1,
        label: 'ccm1',
        date: '1990-01-01',
        time: '12:00',
        lat: 40.7128,
        lon: -74.006,
      });
      const c2 = await pgStore.createChart({
        ownerId: u2,
        label: 'ccm2',
        date: '1991-02-02',
        time: '13:00',
        lat: 34.05,
        lon: -118.25,
      });
      try {
        const results = await Promise.allSettled([
          pgStore.createConnectionIntent({
            fromUserId: u1,
            toUserId: u2,
            fromChartId: c1.id,
            toChartId: c2.id,
            relationshipKind: 'friend',
          }),
          pgStore.createConnectionIntent({
            fromUserId: u2,
            toUserId: u1,
            fromChartId: c2.id,
            toChartId: c1.id,
            relationshipKind: 'friend',
          }),
        ]);
        const ok = results.filter((r) => r.status === 'fulfilled');
        const mirror = results.filter(
          (r) => r.status === 'rejected' && r.reason && r.reason.code === 'mirror_pending'
        );
        assert.strictEqual(ok.length, 1, 'exactly one fulfilled');
        assert.strictEqual(mirror.length, 1, 'exactly one mirror_pending rejection');
      } finally {
        await cleanupUsersPair(u1, u2, c1.id, c2.id);
      }
    });

    it('accept: injected failure after intent update rolls back to pending', async () => {
      const t = Date.now();
      const u1 = `usr_cc_a1_${t}`;
      const u2 = `usr_cc_a2_${t}`;
      await pgStore.createUser({ id: u1, handle: u1, email: `${u1}@t.invalid` });
      await pgStore.createUser({ id: u2, handle: u2, email: `${u2}@t.invalid` });
      const c1 = await pgStore.createChart({
        ownerId: u1,
        label: 'ca1',
        date: '1990-01-01',
        time: '12:00',
        lat: 40.7128,
        lon: -74.006,
      });
      const c2 = await pgStore.createChart({
        ownerId: u2,
        label: 'ca2',
        date: '1991-02-02',
        time: '13:00',
        lat: 34.05,
        lon: -118.25,
      });
      let intentId;
      try {
        const intent = await pgStore.createConnectionIntent({
          fromUserId: u1,
          toUserId: u2,
          fromChartId: c1.id,
          toChartId: c2.id,
          relationshipKind: 'friend',
        });
        intentId = intent.id;
        process.env.PG_STORE_TEST_THROW_AFTER_ACCEPT_INTENT_UPDATE = '1';
        await assert.rejects(() => pgStore.acceptConnectionIntent(intentId, u2));
        delete process.env.PG_STORE_TEST_THROW_AFTER_ACCEPT_INTENT_UPDATE;

        const st = await pool.query(`SELECT status FROM astradio_connection_intents WHERE id = $1`, [intentId]);
        assert.strictEqual(st.rows[0].status, 'pending');

        const sortedCharts = [c1.id, c2.id].sort((a, b) => a.localeCompare(b, 'en'));
        const relCount = await pool.query(
          `SELECT COUNT(*)::int AS n FROM astradio_relationships
           WHERE owner_user_id = ANY($1::text[]) AND chart_id_low = $2 AND chart_id_high = $3`,
          [[u1, u2], sortedCharts[0], sortedCharts[1]]
        );
        assert.strictEqual(relCount.rows[0].n, 0);

        const ok = await pgStore.acceptConnectionIntent(intentId, u2);
        assert.strictEqual(ok.ok, true);
        const st2 = await pool.query(`SELECT status FROM astradio_connection_intents WHERE id = $1`, [intentId]);
        assert.strictEqual(st2.rows[0].status, 'accepted');
      } finally {
        delete process.env.PG_STORE_TEST_THROW_AFTER_ACCEPT_INTENT_UPDATE;
        await cleanupUsersPair(u1, u2, c1.id, c2.id);
      }
    });

    it('concurrent accept same intent: single success', async () => {
      const t = Date.now();
      const u1 = `usr_cc_ac1_${t}`;
      const u2 = `usr_cc_ac2_${t}`;
      await pgStore.createUser({ id: u1, handle: u1, email: `${u1}@t.invalid` });
      await pgStore.createUser({ id: u2, handle: u2, email: `${u2}@t.invalid` });
      const c1 = await pgStore.createChart({
        ownerId: u1,
        label: 'cac1',
        date: '1990-01-01',
        time: '12:00',
        lat: 40.7128,
        lon: -74.006,
      });
      const c2 = await pgStore.createChart({
        ownerId: u2,
        label: 'cac2',
        date: '1991-02-02',
        time: '13:00',
        lat: 34.05,
        lon: -118.25,
      });
      let intentId;
      try {
        const intent = await pgStore.createConnectionIntent({
          fromUserId: u1,
          toUserId: u2,
          fromChartId: c1.id,
          toChartId: c2.id,
          relationshipKind: 'friend',
        });
        intentId = intent.id;
        const [r1, r2] = await Promise.all([
          pgStore.acceptConnectionIntent(intentId, u2),
          pgStore.acceptConnectionIntent(intentId, u2),
        ]);
        const wins = [r1, r2].filter((r) => r.ok);
        const losses = [r1, r2].filter((r) => !r.ok);
        assert.strictEqual(wins.length, 1);
        assert.strictEqual(losses.length, 1);
        assert.strictEqual(losses[0].error, 'not_found_or_not_pending');
      } finally {
        await cleanupUsersPair(u1, u2, c1.id, c2.id);
      }
    });
  }
);
