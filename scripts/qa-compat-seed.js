#!/usr/bin/env node
/**
 * QA compatibility + community feed seed: 16 deterministic users, charts, vectors, relationships.
 * Requires: npm run vnext:build, POSTGRES_URL|DATABASE_URL, and a reachable /api/chart-snapshot (API_BASE_URL or localhost).
 *
 * Usage:
 *   API_BASE_URL=http://localhost:4000 POSTGRES_URL=... node scripts/qa-compat-seed.js
 * Optional: QA_SEED_RESET=0 to skip hard delete (idempotent re-vector + relationships only if implemented — default is full reset)
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const REPO_ROOT = path.join(__dirname, '..');
const natalPath = path.join(REPO_ROOT, 'dist', 'vnext', 'vnext', 'compat', 'natal-identity-birth-compare.js');
const vectorCachePath = path.join(REPO_ROOT, 'dist', 'vnext', 'vnext', 'compat', 'vector-cache.js');
const storagePath = path.join(REPO_ROOT, 'dist', 'vnext', 'vnext', 'compat', 'storage.js');

const RELATIONSHIP_LABEL = 'QA Connection';

const DATASET = [
  { user: 'qa_compat_user_01', chart: 'qa_compat_chart_01', date: '1984-05-20', time: '18:15', lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  { user: 'qa_compat_user_02', chart: 'qa_compat_chart_02', date: '1991-11-03', time: '08:20', lat: 34.0522, lon: -118.2437, timezone: 'America/Los_Angeles' },
  { user: 'qa_compat_user_03', chart: 'qa_compat_chart_03', date: '1988-02-14', time: '21:30', lat: 41.8781, lon: -87.6298, timezone: 'America/Chicago' },
  { user: 'qa_compat_user_04', chart: 'qa_compat_chart_04', date: '1995-07-09', time: '06:45', lat: 47.6062, lon: -122.3321, timezone: 'America/Los_Angeles' },
  { user: 'qa_compat_user_05', chart: 'qa_compat_chart_05', date: '1980-12-25', time: '12:00', lat: 19.4326, lon: -99.1332, timezone: 'America/Mexico_City' },
  { user: 'qa_compat_user_06', chart: 'qa_compat_chart_06', date: '1993-04-18', time: '16:00', lat: 25.7617, lon: -80.1918, timezone: 'America/New_York' },
  { user: 'qa_compat_user_07', chart: 'qa_compat_chart_07', date: '1986-08-30', time: '10:10', lat: 45.5017, lon: -73.5673, timezone: 'America/Toronto' },
  { user: 'qa_compat_user_08', chart: 'qa_compat_chart_08', date: '1999-01-11', time: '15:00', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { user: 'qa_compat_user_09', chart: 'qa_compat_chart_09', date: '1982-10-22', time: '20:00', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  { user: 'qa_compat_user_10', chart: 'qa_compat_chart_10', date: '1990-06-06', time: '07:30', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  { user: 'qa_compat_user_11', chart: 'qa_compat_chart_11', date: '1987-01-19', time: '12:20', lat: 55.7558, lon: 37.6173, timezone: 'Europe/Moscow' },
  { user: 'qa_compat_user_12', chart: 'qa_compat_chart_12', date: '1994-09-28', time: '19:00', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney' },
  { user: 'qa_compat_user_13', chart: 'qa_compat_chart_13', date: '1996-04-12', time: '11:00', lat: 1.3521, lon: 103.8198, timezone: 'Asia/Singapore' },
  { user: 'qa_compat_user_14', chart: 'qa_compat_chart_14', date: '1983-03-03', time: '09:45', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata' },
  { user: 'qa_compat_user_15', chart: 'qa_compat_chart_15', date: '1992-12-12', time: '14:00', lat: -23.5505, lon: -46.6333, timezone: 'America/Sao_Paulo' },
  { user: 'qa_compat_user_16', chart: 'qa_compat_chart_16', date: '1981-10-10', time: '18:00', lat: 30.0444, lon: 31.2357, timezone: 'Africa/Cairo' },
];

/** chart_id string pairs: undirected edges; implementation creates two createRelationship per pair */
const CHART_ID_EDGES = [
  ['qa_compat_chart_01', 'qa_compat_chart_02'],
  ['qa_compat_chart_02', 'qa_compat_chart_03'],
  ['qa_compat_chart_03', 'qa_compat_chart_04'],
  ['qa_compat_chart_04', 'qa_compat_chart_05'],
  ['qa_compat_chart_05', 'qa_compat_chart_06'],
  ['qa_compat_chart_06', 'qa_compat_chart_07'],
  ['qa_compat_chart_07', 'qa_compat_chart_08'],
  ['qa_compat_chart_08', 'qa_compat_chart_09'],
  ['qa_compat_chart_09', 'qa_compat_chart_10'],
  ['qa_compat_chart_10', 'qa_compat_chart_11'],
  ['qa_compat_chart_03', 'qa_compat_chart_09'],
  ['qa_compat_chart_11', 'qa_compat_chart_12'],
  ['qa_compat_chart_12', 'qa_compat_chart_13'],
  ['qa_compat_chart_11', 'qa_compat_chart_14'],
  ['qa_compat_chart_14', 'qa_compat_chart_15'],
  ['qa_compat_chart_15', 'qa_compat_chart_16'],
];

function getPostgresUrl() {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
}

function assertBuildArtifacts() {
  if (!fs.existsSync(natalPath)) {
    throw new Error(
      `[qa-compat-seed] Missing vnext build output. Run: npm run vnext:build\n` +
        `Expected: ${natalPath}`
    );
  }
  for (const p of [vectorCachePath, storagePath]) {
    if (!fs.existsSync(p)) {
      throw new Error(`[qa-compat-seed] Missing compiled module. Run: npm run vnext:build\nExpected: ${p}`);
    }
  }
}

async function preflightChartSnapshot() {
  const port = process.env.PORT || '4000';
  const base = (process.env.API_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, '');
  const q = new URLSearchParams({
    date: '1990-01-01',
    time: '12:00',
    lat: '0',
    lon: '0',
  });
  const url = `${base}/api/chart-snapshot?${q}`;
  const headers = {};
  const bypass = (
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    process.env.BYPASS_TOKEN ||
    process.env.VERCEL_BYPASS_TOKEN ||
    ''
  ).trim();
  if (bypass) headers['x-vercel-protection-bypass'] = bypass;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 20000);
  let r;
  try {
    r = await fetch(url, { signal: ac.signal, headers });
  } catch (e) {
    clearTimeout(t);
    throw new Error(
      `[qa-compat-seed] /api/chart-snapshot unreachable at ${base}. Start the engine (e.g. node server/index.js) or set API_BASE_URL. ${e.message}`
    );
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`[qa-compat-seed] chart-snapshot preflight failed: ${r.status} ${text.slice(0, 200)}`);
  }
  console.log('[qa-compat-seed] chart-snapshot OK at', base);
}

async function hardReset(pool) {
  console.log('[qa-compat-seed] Hard reset QA namespace...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM astradio_relationships WHERE owner_user_id LIKE 'qa_compat_user_%'`);
    await client.query(
      `DELETE FROM astradio_connection_intents
       WHERE from_user_id LIKE 'qa_compat_user_%' OR to_user_id LIKE 'qa_compat_user_%'`
    );
    await client.query(`DELETE FROM astradio_user_primary_chart WHERE user_id LIKE 'qa_compat_user_%'`);
    await client.query(`DELETE FROM astradio_charts WHERE id LIKE 'qa_compat_chart_%'`);
    await client.query(`DELETE FROM astradio_users WHERE id LIKE 'qa_compat_user_%'`);
    await client.query('COMMIT');
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      /* */
    }
    throw e;
  } finally {
    client.release();
  }
  console.log('[qa-compat-seed] Hard reset done.');
}

function chartIdToUserId(chartId) {
  const m = chartId.match(/^qa_compat_chart_(\d{1,2})$/);
  if (!m) throw new Error(`[qa-compat-seed] bad chart id: ${chartId}`);
  return `qa_compat_user_${String(m[1]).padStart(2, '0')}`;
}

async function verifyVectorGate(pool) {
  const res = await pool.query(
    `SELECT chart_id,
            jsonb_array_length(COALESCE(vector64, '[]'::jsonb)) AS len,
            version,
            encoder_version
     FROM astradio_chart_vectors
     WHERE chart_id LIKE 'qa_compat_chart_%'
     ORDER BY chart_id`
  );
  const rows = res.rows || [];
  if (rows.length !== 16) {
    throw new Error(
      `[qa-compat-seed] Vector gate: expected 16 rows in astradio_chart_vectors, got ${rows.length}`
    );
  }
  for (const r of rows) {
    if (r.len !== 64) {
      throw new Error(`[qa-compat-seed] Vector gate: chart_id=${r.chart_id} len=${r.len} expected 64`);
    }
  }
  console.log('[qa-compat-seed] Vector verification gate: PASS (16 charts, 64-d vectors).');
}

async function main() {
  const pgUrl = getPostgresUrl();
  if (!pgUrl) {
    console.error('[qa-compat-seed] POSTGRES_URL or DATABASE_URL is required.');
    process.exit(1);
  }
  // lib/database.js and pg-store read POSTGRES_URL only; align with migrate.js / Render DATABASE_URL.
  if (!process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = pgUrl;
  }

  assertBuildArtifacts();
  // pg-store loads natal compare — require after assert
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pgStore = require(path.join(__dirname, '..', 'lib', 'pg-store.js'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setStorage } = require(storagePath);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { populateChartVector, CHART_VECTOR_VERSION, CHART_VECTOR_ENCODER_VERSION } = require(vectorCachePath);

  await preflightChartSnapshot();
  setStorage(pgStore);

  const pool = new Pool({ connectionString: pgUrl });
  const doReset = process.env.QA_SEED_RESET !== '0';
  if (doReset) {
    await hardReset(pool);
  }

  for (const row of DATASET) {
    const idx = String(row.user.replace('qa_compat_user_', '')).padStart(2, '0');
    await pgStore.createUser({
      id: row.user,
      displayName: `QA Compat ${idx}`,
      handle: row.user,
      email: null,
      discoverable: false,
      show_in_feed: false,
    });
    await pgStore.createChart({
      id: row.chart,
      ownerId: row.user,
      label: `Natal QA ${idx}`,
      date: row.date,
      time: row.time,
      lat: row.lat,
      lon: row.lon,
      timezone: row.timezone,
      snapshotHash: null,
    });
    await pgStore.setUserPrimaryChart(row.user, row.chart);
    console.log('[qa-compat-seed] User+chart+primary', row.user, row.chart);
  }

  console.log('[qa-compat-seed] Populating chart vectors (canonical engine + chart-snapshot)...');
  for (const row of DATASET) {
    const out = await populateChartVector(row.chart);
    const v = (await pgStore.getChartVector(row.chart)) || {};
    const vlen = Array.isArray(v.vector64) ? v.vector64.length : 0;
    if (vlen !== 64) {
      throw new Error(`[qa-compat-seed] After populateChartVector, expected 64-d vector for ${row.chart}, got len=${vlen}`);
    }
    console.log('[qa-compat-seed] vector', out.chartId, out.version, CHART_VECTOR_VERSION, CHART_VECTOR_ENCODER_VERSION);
  }

  await verifyVectorGate(pool);

  for (const [a, b] of CHART_ID_EDGES) {
    const uA = chartIdToUserId(a);
    const uB = chartIdToUserId(b);
    await pgStore.createRelationship({
      ownerUserId: uA,
      chartAId: a,
      chartBId: b,
      label: RELATIONSHIP_LABEL,
      comparisonId: null,
    });
    await pgStore.createRelationship({
      ownerUserId: uB,
      chartAId: a,
      chartBId: b,
      label: RELATIONSHIP_LABEL,
      comparisonId: null,
    });
  }
  console.log('[qa-compat-seed] Relationships created:', CHART_ID_EDGES.length * 2, 'rows');

  await pool.end();
  console.log('[qa-compat-seed] Complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[qa-compat-seed] Failed:', err);
  process.exit(1);
});
