#!/usr/bin/env node
/**
 * Phase 7 Slice 3 — RPG store integration tests.
 *
 * Verifies:
 * - Idempotent getOrCreateRpgProfileForChart for same (user, chart, snapshot).
 * - New bundle/profile when Sun sign changes (different snapshot hash).
 * - Bundle deduplication: multiple profiles can point to the same bundle row.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { EphemerisSnapshot } from '../contracts';
import { getOrCreateRpgProfileForChart } from '../rpg/store/rpg-store';

const POSTGRES_URL = process.env.POSTGRES_URL;

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

async function main(): Promise<void> {
  if (!POSTGRES_URL) {
    log('SKIP: POSTGRES_URL not set');
    return;
  }

  const pool = new Pool({ connectionString: POSTGRES_URL });

  // Ensure Phase 7 RPG migration is applied (idempotent).
  const migrationPath = path.join(process.cwd(), 'migrations', '007_phase7_rpg_bundles_profiles.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await pool.query(sql);

  const userId = `usr_rpg_test_${crypto.randomBytes(4).toString('hex')}`;
  const chartId = `chart_rpg_test_${crypto.randomBytes(4).toString('hex')}`;

  // Minimal seed rows for user/chart id references (no FKs on chart_id, but keep realistic ids).
  await pool.query(
    `INSERT INTO astradio_users (id, handle, display_name, email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [userId, userId, 'RPG Test User', null]
  );

  await pool.query(
    `INSERT INTO astradio_charts (id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [chartId, userId, 'RPG Test Chart', '1990-01-01', '12:00', 40.7128, -74.006, 'UTC']
  );

  const baseSnapshot: EphemerisSnapshot = {
    ts: '2026-03-03T00:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };

  // Idempotency: same snapshot twice -> same profile row (by unique key), same bundle_hash.
  const profile1 = await getOrCreateRpgProfileForChart({ userId, chartId, snapshot: baseSnapshot });
  const profile2 = await getOrCreateRpgProfileForChart({ userId, chartId, snapshot: baseSnapshot });

  if (profile1.bundle_hash !== profile2.bundle_hash) {
    // eslint-disable-next-line no-console
    console.error('FAIL: bundle_hash differs for identical snapshot inputs');
    process.exitCode = 1;
  } else {
    log('✓ Idempotent profile creation returns same bundle_hash');
  }

  const profileCountRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM rpg_profiles WHERE user_id = $1 AND chart_id = $2',
    [userId, chartId]
  );
  const profileCount = profileCountRes.rows[0]?.count ?? 0;
  if (profileCount !== 1) {
    // eslint-disable-next-line no-console
    console.error(`FAIL: expected 1 profile row, found ${profileCount}`);
    process.exitCode = 1;
  } else {
    log('✓ Exactly one profile row for identical inputs (idempotency)');
  }

  // Change sensitivity: change Sun sign -> new bundle_hash and new profile row (different snapshot hash).
  const modifiedSnapshot: EphemerisSnapshot = {
    ...baseSnapshot,
    planets: baseSnapshot.planets.map((p) =>
      p.name === 'Sun' ? { ...p, lon: 45 } : p
    ),
  };

  const profile3 = await getOrCreateRpgProfileForChart({ userId, chartId, snapshot: modifiedSnapshot });

  if (profile3.bundle_hash === profile1.bundle_hash) {
    // eslint-disable-next-line no-console
    console.error('FAIL: bundle_hash did not change when Sun sign changed');
    process.exitCode = 1;
  } else {
    log('✓ bundle_hash changes when Sun sign (class) changes');
  }

  const distinctProfilesRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM rpg_profiles WHERE user_id = $1 AND chart_id = $2',
    [userId, chartId]
  );
  const distinctProfiles = distinctProfilesRes.rows[0]?.count ?? 0;
  if (distinctProfiles !== 2) {
    // eslint-disable-next-line no-console
    console.error(`FAIL: expected 2 profile rows after Sun sign change, found ${distinctProfiles}`);
    process.exitCode = 1;
  } else {
    log('✓ Second profile row created for modified snapshot (different snapshot hash)');
  }

  // Bundle dedupe: ensure only one row per bundle_hash even if multiple profiles reference it.
  const bundleHash = profile1.bundle_hash;

  // Create another profile pointing to the same snapshot/bundle (different user/chart ids).
  const otherUserId = `usr_rpg_test_${crypto.randomBytes(4).toString('hex')}`;
  const otherChartId = `chart_rpg_test_${crypto.randomBytes(4).toString('hex')}`;

  await pool.query(
    `INSERT INTO astradio_users (id, handle, display_name, email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [otherUserId, otherUserId, 'RPG Test User 2', null]
  );

  await pool.query(
    `INSERT INTO astradio_charts (id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [otherChartId, otherUserId, 'RPG Test Chart 2', '1990-01-01', '12:00', 40.7128, -74.006, 'UTC']
  );

  const otherProfile = await getOrCreateRpgProfileForChart({
    userId: otherUserId,
    chartId: otherChartId,
    snapshot: baseSnapshot,
  });

  if (otherProfile.bundle_hash !== bundleHash) {
    // eslint-disable-next-line no-console
    console.error('FAIL: expected other profile to reuse existing bundle_hash for identical snapshot');
    process.exitCode = 1;
  } else {
    log('✓ Multiple profiles can share same bundle_hash for identical snapshot');
  }

  const bundlesRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM rpg_effects_bundles WHERE bundle_hash = $1',
    [bundleHash]
  );
  const bundleCount = bundlesRes.rows[0]?.count ?? 0;
  if (bundleCount !== 1) {
    // eslint-disable-next-line no-console
    console.error(`FAIL: expected 1 bundle row for bundle_hash, found ${bundleCount}`);
    process.exitCode = 1;
  } else {
    log('✓ Single bundle row persisted for shared bundle_hash');
  }

  await pool.end();

  if (process.exitCode && process.exitCode !== 0) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Phase 7 RPG store tests failed');
    process.exit(process.exitCode);
  } else {
    log('\n✅ Phase 7 RPG store tests passed');
  }
}

main().catch((e) => {
  const refused =
    (e as any).code === 'ECONNREFUSED' ||
    ((e as any).errors && (e as any).errors[0]?.code === 'ECONNREFUSED') ||
    (e as any).message?.includes('ECONNREFUSED');
  if (refused) {
    // eslint-disable-next-line no-console
    console.log('SKIP: database not available (connection refused)');
    process.exit(0);
  }
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

