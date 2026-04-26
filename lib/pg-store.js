/**
 * Durable storage for Astradio: compat (users, charts, comparisons) + community + exports.
 * Same service method names as in-memory layer; all async.
 * Requires POSTGRES_URL and lib/database (pool).
 */

const crypto = require('crypto');
const path = require('path');
const { resolveChartTimezoneForChartInsert } = require('./chart-timezone-resolve');
const natalPath = path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'compat', 'natal-identity-birth-compare.js');
if (!require('fs').existsSync(natalPath)) {
  throw new Error(
    '[pg-store] Missing compiled natal-identity-birth-compare. Run `npm run vnext:build` first. Expected: ' + natalPath
  );
}
const { natalBirthKeyChanged } = require(natalPath);

const nanoid = () => crypto.randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

let _pool;
function pool() {
  if (!_pool) {
    try {
      const db = require('./database');
      _pool = db.pool;
    } catch (e) {
      throw new Error('Database not configured (require lib/database with POSTGRES_URL)');
    }
  }
  return _pool;
}

async function query(text, params) {
  const res = await pool().query(text, params);
  return res;
}

async function withTransaction(work) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback failures
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getRow(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

async function clientQueryRow(client, text, params) {
  const res = await client.query(text, params);
  return res.rows[0] || null;
}

/** Stable advisory lock keys for an unordered user pair (community connection intents). */
function userPairAdvisoryLockKeys(userIdA, userIdB) {
  const sa = String(userIdA || '');
  const sb = String(userIdB || '');
  const sorted = sa.localeCompare(sb, 'en') <= 0 ? [sa, sb] : [sb, sa];
  const h = crypto.createHash('sha256').update(sorted[0]).update('\0').update(sorted[1]).digest();
  return [h.readInt32BE(0), h.readInt32BE(4)];
}

async function getRows(text, params) {
  const res = await query(text, params);
  return res.rows;
}

/** Phase 8G: PostgreSQL returns e.g. column "discoverable" of relation "astradio_users" does not exist. Match that format. */
function isMissingVisibilityColumnError(e) {
  const msg = String(e?.message || '');
  return /column\s+"(?:discoverable|show_in_feed)".*does not exist/i.test(msg);
}

function normalizeLoginEmail(email) {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function isUniqueViolationError(e) {
  return e && e.code === '23505';
}

// ---- Users ----
/** Register path: creates astradio_users row with email_normalized + password_hash (requires migration 017). */
async function createRegisteredUser(input) {
  const id = input.id || `usr_${nanoid()}`;
  const handle = input.handle != null ? input.handle : id;
  const discoverable = input.discoverable !== false;
  const showInFeed = input.show_in_feed !== false;
  const t = now();
  const emailNormalized = normalizeLoginEmail(input.emailNormalized);
  if (!emailNormalized) throw new Error('email_normalized_required');
  const passwordHash = input.passwordHash;
  if (!passwordHash || typeof passwordHash !== 'string') throw new Error('password_hash_required');
  const displayEmail =
    input.email && String(input.email).trim() ? String(input.email).trim() : emailNormalized;
  try {
    await query(
      `INSERT INTO astradio_users (id, handle, display_name, email, email_normalized, password_hash, discoverable, show_in_feed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
      [id, handle, input.displayName || 'User', displayEmail, emailNormalized, passwordHash, discoverable, showInFeed, t]
    );
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) {
      await query(
        `INSERT INTO astradio_users (id, handle, display_name, email, email_normalized, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [id, handle, input.displayName || 'User', displayEmail, emailNormalized, passwordHash, t]
      );
    } else {
      throw e;
    }
  }
  return {
    id,
    handle,
    displayName: input.displayName || 'User',
    email: displayEmail,
    emailNormalized,
    discoverable,
    show_in_feed: showInFeed,
    createdAt: t,
    updatedAt: t,
  };
}

async function getUserAuthForLogin(emailNormalized) {
  const norm = normalizeLoginEmail(emailNormalized);
  if (!norm) return null;
  const row = await getRow(
    'SELECT id, display_name, handle, password_hash FROM astradio_users WHERE email_normalized = $1',
    [norm]
  );
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    handle: row.handle,
    passwordHash: row.password_hash,
  };
}

async function createUser(input) {
  const id = input.id || `usr_${nanoid()}`;
  const handle = input.handle != null ? input.handle : id;
  const discoverable = input.discoverable !== false;
  const showInFeed = input.show_in_feed !== false;
  const t = now();
  try {
    await query(
      `INSERT INTO astradio_users (id, handle, display_name, email, discoverable, show_in_feed, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [id, handle, input.displayName || 'User', input.email || null, discoverable, showInFeed, t]
    );
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) {
      await query(
        `INSERT INTO astradio_users (id, handle, display_name, email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [id, handle, input.displayName || 'User', input.email || null, t]
      );
    } else {
      throw e;
    }
  }
  return { id, handle, displayName: input.displayName || 'User', email: input.email, discoverable, show_in_feed: showInFeed, createdAt: t, updatedAt: t };
}

async function getUser(id) {
  try {
    const row = await getRow('SELECT id, handle, display_name, email, discoverable, show_in_feed, created_at, updated_at FROM astradio_users WHERE id = $1', [id]);
    if (!row) return undefined;
    return rowToUser(row);
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) {
      const row = await getRow('SELECT id, handle, display_name, email, created_at, updated_at FROM astradio_users WHERE id = $1', [id]);
      if (!row) return undefined;
      return rowToUser(row);
    }
    throw e;
  }
}

async function getUserByHandle(handle) {
  try {
    const row = await getRow('SELECT id, handle, display_name, email, discoverable, show_in_feed, created_at, updated_at FROM astradio_users WHERE handle = $1', [handle]);
    if (!row) return undefined;
    return rowToUser(row);
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) {
      const row = await getRow('SELECT id, handle, display_name, email, created_at, updated_at FROM astradio_users WHERE handle = $1', [handle]);
      if (!row) return undefined;
      return rowToUser(row);
    }
    throw e;
  }
}

async function listUsers() {
  try {
    const rows = await getRows('SELECT id, handle, display_name, email, discoverable, show_in_feed, created_at, updated_at FROM astradio_users ORDER BY created_at');
    return rows.map(rowToUser);
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) {
      const rows = await getRows('SELECT id, handle, display_name, email, created_at, updated_at FROM astradio_users ORDER BY created_at');
      return rows.map(rowToUser);
    }
    throw e;
  }
}

function rowToUser(row) {
  const out = {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.discoverable !== undefined) out.discoverable = row.discoverable;
  if (row.show_in_feed !== undefined) out.show_in_feed = row.show_in_feed;
  return out;
}

// ---- Primary chart ----
async function setUserPrimaryChart(userId, chartId) {
  await query(
    `INSERT INTO astradio_user_primary_chart (user_id, chart_id, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET chart_id = $2`,
    [userId, chartId, now()]
  );
}

async function getUserPrimaryChart(userId) {
  const row = await getRow('SELECT chart_id FROM astradio_user_primary_chart WHERE user_id = $1', [userId]);
  return row ? row.chart_id : undefined;
}

// ---- Charts ----
async function createChart(input) {
  const resolvedTimezone = resolveChartTimezoneForChartInsert({
    timezone: input.timezone,
    tz: input.tz,
    lat: input.lat,
    lon: input.lon,
  });
  const id = input.id || `chart_${nanoid()}`;
  await query(
    `INSERT INTO astradio_charts (id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      input.ownerId || null,
      input.label,
      input.date,
      input.time,
      input.lat,
      input.lon,
      resolvedTimezone,
      input.snapshotHash || null,
      now(),
    ]
  );
  return rowToChart({
    id,
    owner_id: input.ownerId,
    label: input.label,
    date: input.date,
    time: input.time,
    lat: input.lat,
    lon: input.lon,
    timezone: resolvedTimezone,
    snapshot_hash: input.snapshotHash,
    created_at: now(),
    updated_at: now(),
  });
}

/** Phase 5 — Create non-platform chart (family/friends not on platform). is_non_platform=true. */
async function createNonPlatformChart(input) {
  const resolvedTimezone = resolveChartTimezoneForChartInsert({
    timezone: input.timezone,
    tz: input.tz,
    lat: input.lat,
    lon: input.lon,
  });
  const id = input.id || `chart_${nanoid()}`;
  await query(
    `INSERT INTO astradio_charts (id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, is_non_platform, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)`,
    [
      id,
      input.ownerId,
      input.label,
      input.date,
      input.time,
      input.lat,
      input.lon,
      resolvedTimezone,
      input.snapshotHash || null,
      now(),
    ]
  );
  const row = {
    id,
    owner_id: input.ownerId,
    label: input.label,
    date: input.date,
    time: input.time,
    lat: input.lat,
    lon: input.lon,
    timezone: resolvedTimezone,
    snapshot_hash: input.snapshotHash,
    is_non_platform: true,
    created_at: now(),
    updated_at: now(),
  };
  return { ...rowToChart(row), isNonPlatform: true };
}

/** Phase 5 — Delete chart (for rollback on vectorization failure). */
async function deleteChart(chartId) {
  const res = await query('DELETE FROM astradio_charts WHERE id = $1', [chartId]);
  return (res.rowCount || 0) > 0;
}

async function getChart(id) {
  const row = await getRow(
    'SELECT id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, identity_export_id, created_at, updated_at FROM astradio_charts WHERE id = $1',
    [id]
  );
  if (!row) return undefined;
  return rowToChart(row);
}

async function listChartsByOwner(ownerId) {
  const rows = await getRows(
    'SELECT id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, identity_export_id, created_at, updated_at FROM astradio_charts WHERE owner_id = $1 ORDER BY created_at',
    [ownerId]
  );
  return rows.map(rowToChart);
}

/**
 * Update birth fields on an existing chart (same resolver as INSERT). Owner-scoped.
 */
async function updateChartBirthFields(chartId, ownerId, input) {
  const row = await getRow(
    'SELECT id, owner_id, date, time, lat, lon, timezone FROM astradio_charts WHERE id = $1',
    [chartId]
  );
  if (!row || row.owner_id !== ownerId) {
    const err = new Error('Chart not found or not owned by user');
    err.code = 'CHART_UPDATE_FORBIDDEN';
    throw err;
  }
  const resolvedTimezone = resolveChartTimezoneForChartInsert({
    timezone: input.timezone,
    tz: input.tz,
    lat: input.lat,
    lon: input.lon,
  });
  const before = { date: row.date, time: row.time, lat: row.lat, lon: row.lon, timezone: row.timezone };
  const clearIdentityExport = natalBirthKeyChanged(before, input, resolvedTimezone);
  const t = now();
  const baseParams = [
    input.label,
    input.date,
    input.time,
    input.lat,
    input.lon,
    resolvedTimezone,
    t,
    chartId,
    ownerId,
  ];
  if (clearIdentityExport) {
    await query(
      `UPDATE astradio_charts SET label = $1, date = $2, time = $3, lat = $4, lon = $5, timezone = $6, snapshot_hash = NULL, identity_export_id = NULL, updated_at = $7 WHERE id = $8 AND owner_id = $9`,
      baseParams
    );
  } else {
    await query(
      `UPDATE astradio_charts SET label = $1, date = $2, time = $3, lat = $4, lon = $5, timezone = $6, snapshot_hash = NULL, updated_at = $7 WHERE id = $8 AND owner_id = $9`,
      baseParams
    );
  }
  return getChart(chartId);
}

/**
 * Persist Profile identity audio export id (natal surface). Nullable clears the column.
 */
async function setChartIdentityExportId(chartId, exportId) {
  const t = now();
  await query(`UPDATE astradio_charts SET identity_export_id = $1, updated_at = $2 WHERE id = $3`, [
    exportId,
    t,
    chartId,
  ]);
}

function rowToChart(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    label: row.label,
    date: row.date,
    time: row.time,
    lat: row.lat,
    lon: row.lon,
    timezone: row.timezone,
    snapshotHash: row.snapshot_hash,
    identityExportId: row.identity_export_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Comparisons ----
async function createComparison(input) {
  const id = `cmp_${nanoid()}`;
  const fusionParams = {
    ...(input.fusionParams || {}),
    compatibilityFieldHash: input.compatibilityFieldHash || null,
    compatibilityRecord: input.compatibilityRecord || null,
    scoring: input.scoring || null,
    classification: input.classification || null,
  };
  const compatibilityText = {
    ...(typeof input.compatibilityText === 'object' && input.compatibilityText ? input.compatibilityText : { value: input.compatibilityText || '' }),
    compatibilityField: input.compatibilityField || null,
  };
  await query(
    `INSERT INTO astradio_comparisons (id, chart_a_id, chart_b_id, relationship_mode, fusion_method, fusion_params, merged_feature_vector64, merged_feature_hash, compatibility_text, plan_hash, composition_id, export_job_id, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      input.chartAId,
      input.chartBId,
      input.relationshipMode,
      input.fusionMethod,
      JSON.stringify(fusionParams),
      JSON.stringify(input.mergedFeatureVector64 || []),
      input.mergedFeatureHash || null,
      JSON.stringify(compatibilityText),
      input.planHash,
      input.compositionId,
      input.exportJobId || null,
      now(),
      input.createdBy || null,
    ]
  );
  const row = await getRow('SELECT * FROM astradio_comparisons WHERE id = $1', [id]);
  return rowToComparison(row);
}

async function getComparison(id) {
  const row = await getRow('SELECT * FROM astradio_comparisons WHERE id = $1', [id]);
  if (!row) return undefined;
  return rowToComparison(row);
}

/**
 * Batch load export_job_id for inventory (no N+1). Returns Map: comparisonId -> string | null
 */
async function getExportJobIdsForComparisonIds(comparisonIds) {
  const m = new Map();
  if (!Array.isArray(comparisonIds) || comparisonIds.length === 0) return m;
  const uniq = [...new Set(comparisonIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniq.length === 0) return m;
  const ph = uniq.map((_, i) => `$${i + 1}`).join(',');
  const rows = await getRows(
    `SELECT id, export_job_id FROM astradio_comparisons WHERE id IN (${ph})`,
    uniq
  );
  for (const row of rows) {
    const e = row.export_job_id != null && String(row.export_job_id).trim() ? String(row.export_job_id) : null;
    m.set(String(row.id), e);
  }
  return m;
}

/**
 * Group composites are stored under the relational **group owner**'s user id (buildGroupComposite).
 * Batch by (owner_user_id, group_id) pairs (single query). Inventory picks reading_snapshot in JS.
 * @param {Array<{ ownerId: string, groupId: string }>} ownerGroupPairs
 */
async function getGroupCompositeRowsForGroupOwnerPairs(ownerGroupPairs) {
  if (!Array.isArray(ownerGroupPairs) || ownerGroupPairs.length === 0) return [];
  const pairs = ownerGroupPairs
    .map((p) => ({
      ownerId: p.ownerId != null ? String(p.ownerId).trim() : '',
      groupId: p.groupId != null ? String(p.groupId).trim() : '',
    }))
    .filter((p) => p.ownerId && p.groupId);
  if (pairs.length === 0) return [];
  const ph = [];
  const params = [];
  let n = 1;
  for (const p of pairs) {
    ph.push(`($${n++}::text, $${n++}::text)`);
    params.push(p.ownerId, p.groupId);
  }
  return getRows(
    `SELECT id, group_id, owner_user_id, reading_snapshot, export_job_id, created_at
     FROM astradio_composite_artifacts
     WHERE kind = 'group' AND (owner_user_id, group_id) IN (${ph.join(',')})`,
    params
  );
}

async function listComparisonsByUser(userId) {
  const rows = await getRows(
    'SELECT * FROM astradio_comparisons WHERE created_by = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(rowToComparison);
}

function rowToComparison(row) {
  const fusionParams = row.fusion_params || {};
  const compatibilityText = row.compatibility_text || {};
  return {
    id: row.id,
    chartAId: row.chart_a_id,
    chartBId: row.chart_b_id,
    relationshipMode: row.relationship_mode,
    fusionMethod: row.fusion_method,
    fusionParams,
    mergedFeatureVector64: row.merged_feature_vector64 || [],
    mergedFeatureHash: row.merged_feature_hash,
    compatibilityText: compatibilityText && compatibilityText.value ? compatibilityText.value : compatibilityText,
    planHash: row.plan_hash,
    compositionId: row.composition_id,
    exportJobId: row.export_job_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    compatibilityFieldHash: fusionParams.compatibilityFieldHash || undefined,
    compatibilityRecord: fusionParams.compatibilityRecord || undefined,
    compatibilityField: compatibilityText.compatibilityField || undefined,
    scoring: fusionParams.scoring || undefined,
    classification: fusionParams.classification || undefined,
  };
}

// ---- Default profile chart & match candidates (compat seed) ----
const DEFAULT_PROFILE_CHART_ID = 'chart_profile_default';
const MATCH_CANDIDATE_SPECS = [
  { id: 'chart_match_1', userId: 'usr_demo_1', displayName: 'Demo User 1', label: 'Natal 1', date: '1985-06-10', time: '14:30', lat: 51.5074, lon: -0.1278 },
  { id: 'chart_match_2', userId: 'usr_demo_2', displayName: 'Demo User 2', label: 'Natal 2', date: '1992-11-22', time: '08:00', lat: 40.7128, lon: -74.006 },
  { id: 'chart_match_3', userId: 'usr_demo_3', displayName: 'Demo User 3', label: 'Natal 3', date: '1988-03-05', time: '18:45', lat: 34.0522, lon: -118.2437 },
  { id: 'chart_match_4', userId: 'usr_demo_4', displayName: 'Demo User 4', label: 'Natal 4', date: '1995-09-14', time: '12:00', lat: 41.8781, lon: -87.6298 },
  { id: 'chart_match_5', userId: 'usr_demo_5', displayName: 'Demo User 5', label: 'Natal 5', date: '1990-01-15', time: '06:00', lat: 37.7749, lon: -122.4194 },
];

async function ensureDefaultProfileChart() {
  let chart = await getChart(DEFAULT_PROFILE_CHART_ID);
  if (chart) return chart;
  chart = await createChart({
    id: DEFAULT_PROFILE_CHART_ID,
    label: 'My Natal',
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7128,
    lon: -74.006,
  });
  return chart;
}

async function ensureMatchCandidateCharts() {
  const out = [];
  for (const spec of MATCH_CANDIDATE_SPECS) {
    let chart = await getChart(spec.id);
    if (!chart) {
      await createUser({ id: spec.userId, displayName: spec.displayName }).catch(() => ({}));
      chart = await createChart({
        id: spec.id,
        ownerId: spec.userId,
        label: spec.label,
        date: spec.date,
        time: spec.time,
        lat: spec.lat,
        lon: spec.lon,
      });
    }
    out.push({ chartId: spec.id, userId: spec.userId, displayName: spec.displayName });
  }
  return out;
}

/** Phase 8G: Users eligible for directory search.
 *  - Primary: real users with primary chart (discoverable=true when column exists).
 *  - When discoverable query returns 0 rows: still return real users with primary chart (no discoverable filter).
 *  - Fallback (pre-migration / tables missing): match candidates only.
 *  Search UI should not show demo placeholders when real users exist.
 */
async function listDirectoryEligibleUsers() {
  const debug = process.env.COMMUNITY_SEARCH_DEBUG === '1';
  const started = Date.now();
  async function buildUserList(rows) {
    const out = [];
    for (const row of rows) {
      try {
        const chart = await getChart(row.chart_id);
        out.push({
          userId: row.id,
          displayName: row.display_name || 'User',
          handle: row.handle || row.id,
          chartId: row.chart_id,
          label: chart?.label,
        });
      } catch (e) {
        // Skip this user so one bad chart does not 500 the whole search
      }
    }
    return out;
  }

  // First, try real users with discoverable = true.
  try {
    const rows = await getRows(
      `SELECT u.id, u.handle, u.display_name, pc.chart_id
       FROM astradio_users u
       INNER JOIN astradio_user_primary_chart pc ON pc.user_id = u.id
       WHERE u.discoverable = true`
    );
    if (debug) {
      console.log('[pg-store][directory][discoverable]', {
        rows: rows.length
      });
    }
    if (rows.length > 0) {
      const users = await buildUserList(rows);
      if (debug) {
        console.log('[pg-store][directory][discoverable][built]', {
          count: users.length,
          sample: users.slice(0, 5)
        });
      }
      return users;
    }
    // Zero discoverable users: still return real users with primary chart so created users are findable.
    const allRows = await getRows(
      `SELECT u.id, u.handle, u.display_name, pc.chart_id
       FROM astradio_users u
       INNER JOIN astradio_user_primary_chart pc ON pc.user_id = u.id`
    );
    if (debug) {
      console.log('[pg-store][directory][all-primary]', {
        rows: allRows.length
      });
    }
    if (allRows.length > 0) {
      const users = await buildUserList(allRows);
      if (debug) {
        console.log('[pg-store][directory][all-primary][built]', {
          count: users.length,
          sample: users.slice(0, 5)
        });
      }
      return users;
    }
    if (debug) {
      console.log('[pg-store][directory][no-real-users]', {
        durationMs: Date.now() - started
      });
    }
    return [];
  } catch (e) {
    if (!isMissingVisibilityColumnError(e) && e.code !== '42703') throw e;
    // Migration 011 not applied: still return real users with primary chart (no discoverable filter).
    try {
      const rows = await getRows(
        `SELECT u.id, u.handle, u.display_name, pc.chart_id
         FROM astradio_users u
         INNER JOIN astradio_user_primary_chart pc ON pc.user_id = u.id`
      );
      if (rows.length > 0) return await buildUserList(rows);
    } catch (e2) {
      // e.g. astradio_user_primary_chart missing: fall through to match candidates
    }
  }

  // Fallback path: match candidates only (no real users or tables missing).
  const candidates = await ensureMatchCandidateCharts();
  const users = [];
  for (const c of candidates) {
    try {
      const u = await getUser(c.userId);
      const chart = await getChart(c.chartId);
      users.push({
        userId: c.userId,
        displayName: c.displayName,
        handle: u?.handle ?? c.userId,
        chartId: c.chartId,
        label: chart?.label,
      });
    } catch (e) {
      // Skip so one bad candidate does not 500
    }
  }
  if (debug) {
    console.log('[pg-store][directory][candidates]', {
      candidates: candidates.length,
      built: users.length,
      sample: users.slice(0, 5),
      durationMs: Date.now() - started
    });
  }
  return users;
}

/** Phase 8G: Recent users with show_in_feed=true for community feed. */
async function listRecentDiscoverableUsers(limit = 20) {
  try {
    const rows = await getRows(
      `SELECT u.id, u.handle, u.display_name, u.created_at
       FROM astradio_users u
       WHERE u.show_in_feed = true
       ORDER BY u.created_at DESC
       LIMIT $1`,
      [Math.min(50, Math.max(1, limit))]
    );
    return rows.map((r) => ({
      userId: r.id,
      handle: r.handle || r.id,
      displayName: r.display_name || 'User',
      createdAt: r.created_at,
    }));
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) return [];
    throw e;
  }
}

/** Phase 8G: Update discoverability and feed visibility. */
async function updateUserDiscoverability(userId, { discoverable, show_in_feed }) {
  const updates = [];
  const params = [userId];
  if (discoverable !== undefined) {
    params.push(!!discoverable);
    updates.push(`discoverable = $${params.length}`);
  }
  if (show_in_feed !== undefined) {
    params.push(!!show_in_feed);
    updates.push(`show_in_feed = $${params.length}`);
  }
  if (updates.length === 0) return;
  params.push(now());
  try {
    await query(
      `UPDATE astradio_users SET ${updates.join(', ')}, updated_at = $${params.length} WHERE id = $1`,
      params
    );
  } catch (e) {
    if (isMissingVisibilityColumnError(e)) return;
    throw e;
  }
}

// ---- Community: groups ----
async function createGroup(input) {
  const id = `grp_${nanoid()}`;
  const slug = input.slug || id;
  await query(
    `INSERT INTO astradio_groups (id, slug, name, description, tags, visibility, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, slug, input.name || 'Unnamed', input.description || '', JSON.stringify(input.tags || []), 'public', now()]
  );
  return { id, slug, name: input.name || 'Unnamed', description: input.description || '', tags: input.tags || [], visibility: 'public', createdAt: now() };
}

async function getGroup(id) {
  const row = await getRow('SELECT id, slug, name, description, tags, visibility, created_at FROM astradio_groups WHERE id = $1', [id]);
  return row ? { id: row.id, slug: row.slug, name: row.name, description: row.description, tags: row.tags || [], visibility: row.visibility, createdAt: row.created_at } : undefined;
}

async function getGroupBySlug(slug) {
  const row = await getRow('SELECT id, slug, name, description, tags, visibility, created_at FROM astradio_groups WHERE slug = $1', [slug]);
  return row ? { id: row.id, slug: row.slug, name: row.name, description: row.description, tags: row.tags || [], visibility: row.visibility, createdAt: row.created_at } : undefined;
}

async function listGroups(opts = {}) {
  let sql = 'SELECT id, slug, name, description, tags, visibility, created_at FROM astradio_groups WHERE 1=1';
  const params = [];
  if (opts.tag) {
    params.push(opts.tag);
    sql += ` AND tags @> $${params.length}::jsonb`;
  }
  if (opts.q && opts.q.trim()) {
    params.push(`%${opts.q.trim().toLowerCase()}%`);
    sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length} OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) t WHERE LOWER(t) LIKE $${params.length}))`;
  }
  sql += ' ORDER BY created_at DESC';
  const rows = await getRows(sql, params);
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, description: r.description, tags: r.tags || [], visibility: r.visibility, createdAt: r.created_at }));
}

// ---- Community: memberships ----
async function createMembership(input) {
  const id = `mem_${nanoid()}`;
  await query(
    `INSERT INTO astradio_memberships (id, group_id, user_id, role, chart_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, chart_id = EXCLUDED.chart_id`,
    [id, input.groupId, input.userId, input.role || 'member', input.chartId || null, now()]
  );
  const row = await getRow('SELECT id, group_id, user_id, role, chart_id, created_at FROM astradio_memberships WHERE group_id = $1 AND user_id = $2', [input.groupId, input.userId]);
  return row ? { id: row.id, groupId: row.group_id, userId: row.user_id, role: row.role, chartId: row.chart_id, createdAt: row.created_at } : { id, groupId: input.groupId, userId: input.userId, role: input.role || 'member', chartId: input.chartId || null, createdAt: now() };
}

async function getMembership(id) {
  const row = await getRow('SELECT id, group_id, user_id, role, chart_id, created_at FROM astradio_memberships WHERE id = $1', [id]);
  return row ? { id: row.id, groupId: row.group_id, userId: row.user_id, role: row.role, chartId: row.chart_id, createdAt: row.created_at } : undefined;
}

async function getMembershipsByGroup(groupId) {
  const rows = await getRows('SELECT id, group_id, user_id, role, chart_id, created_at FROM astradio_memberships WHERE group_id = $1 ORDER BY id', [groupId]);
  return rows.map((r) => ({ id: r.id, groupId: r.group_id, userId: r.user_id, role: r.role, chartId: r.chart_id, createdAt: r.created_at }));
}

async function getMembershipsByUser(userId) {
  const rows = await getRows('SELECT id, group_id, user_id, role, chart_id, created_at FROM astradio_memberships WHERE user_id = $1 ORDER BY id', [userId]);
  return rows.map((r) => ({ id: r.id, groupId: r.group_id, userId: r.user_id, role: r.role, chartId: r.chart_id, createdAt: r.created_at }));
}

async function isMember(groupId, userId) {
  const row = await getRow('SELECT 1 FROM astradio_memberships WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  return !!row;
}

// ---- Community: posts ----
async function createPost(input) {
  const id = `post_${nanoid()}`;
  await query(
    `INSERT INTO astradio_posts (id, group_id, user_id, title, body, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.groupId, input.userId, input.title || '', input.body || '', now()]
  );
  return { id, groupId: input.groupId, userId: input.userId, title: input.title || '', body: input.body || '', createdAt: now() };
}

async function getPost(id) {
  const row = await getRow('SELECT id, group_id, user_id, title, body, created_at FROM astradio_posts WHERE id = $1', [id]);
  return row ? { id: row.id, groupId: row.group_id, userId: row.user_id, title: row.title, body: row.body, createdAt: row.created_at } : undefined;
}

async function listPostsByGroup(groupId, opts = {}) {
  const limit = Math.min(50, Math.max(1, opts.limit || 50));
  const rows = await getRows(
    'SELECT id, group_id, user_id, title, body, created_at FROM astradio_posts WHERE group_id = $1 ORDER BY created_at DESC LIMIT $2',
    [groupId, limit]
  );
  return rows.map((r) => ({ id: r.id, groupId: r.group_id, userId: r.user_id, title: r.title, body: r.body, createdAt: r.created_at }));
}

// ---- Community: comments ----
async function createComment(input) {
  const id = `com_${nanoid()}`;
  await query(
    `INSERT INTO astradio_comments (id, post_id, user_id, body, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, input.postId, input.userId, input.body || '', now()]
  );
  return { id, postId: input.postId, userId: input.userId, body: input.body || '', createdAt: now() };
}

async function getComment(id) {
  const row = await getRow('SELECT id, post_id, user_id, body, created_at FROM astradio_comments WHERE id = $1', [id]);
  return row ? { id: row.id, postId: row.post_id, userId: row.user_id, body: row.body, createdAt: row.created_at } : undefined;
}

async function listCommentsByPost(postId) {
  const rows = await getRows('SELECT id, post_id, user_id, body, created_at FROM astradio_comments WHERE post_id = $1 ORDER BY created_at', [postId]);
  return rows.map((r) => ({ id: r.id, postId: r.post_id, userId: r.user_id, body: r.body, createdAt: r.created_at }));
}

// ---- Community: reports ----
async function createReport(input) {
  const id = `rpt_${nanoid()}`;
  await query(
    `INSERT INTO astradio_reports (id, target_type, target_id, reason, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.targetType, input.targetId, input.reason, input.note || null, now()]
  );
  return { id, targetType: input.targetType, targetId: input.targetId, reason: input.reason, note: input.note, createdAt: now() };
}

async function listReports() {
  const rows = await getRows('SELECT id, target_type, target_id, reason, note, created_at FROM astradio_reports ORDER BY created_at');
  return rows.map((r) => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, note: r.note, createdAt: r.created_at }));
}

// ---- Community: likes (Phase 4) ----
const LIKE_ITEM_TYPES = ['post', 'comment', 'chart'];

async function createLike(input) {
  const id = `like_${nanoid()}`;
  const itemType = input.itemType && LIKE_ITEM_TYPES.includes(input.itemType) ? input.itemType : 'post';
  await query(
    `INSERT INTO astradio_likes (id, user_id, item_type, item_id, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, item_type, item_id) DO NOTHING`,
    [id, input.userId, itemType, input.itemId, now()]
  );
  const row = await getRow('SELECT id, user_id, item_type, item_id, created_at FROM astradio_likes WHERE user_id = $1 AND item_type = $2 AND item_id = $3', [input.userId, itemType, input.itemId]);
  return row ? { id: row.id, userId: row.user_id, itemType: row.item_type, itemId: row.item_id, createdAt: row.created_at } : null;
}

async function getLike(userId, itemType, itemId) {
  const row = await getRow('SELECT id, user_id, item_type, item_id, created_at FROM astradio_likes WHERE user_id = $1 AND item_type = $2 AND item_id = $3', [userId, itemType, itemId]);
  return row ? { id: row.id, userId: row.user_id, itemType: row.item_type, itemId: row.item_id, createdAt: row.created_at } : undefined;
}

async function listLikesForItem(itemType, itemId) {
  const rows = await getRows('SELECT id, user_id, item_type, item_id, created_at FROM astradio_likes WHERE item_type = $1 AND item_id = $2 ORDER BY created_at', [itemType, itemId]);
  return rows.map((r) => ({ id: r.id, userId: r.user_id, itemType: r.item_type, itemId: r.item_id, createdAt: r.created_at }));
}

// ---- Community: connection intents (Phase 4 stub) ----
function rowToConnectionIntent(row) {
  if (!row) return undefined;
  const relationshipKind = row.relationship_kind || 'friend';
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    chartId: row.chart_id,
    fromChartId: row.from_chart_id,
    toChartId: row.to_chart_id,
    label: row.label || 'Connection',
    relationshipKind,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at || null,
  };
}

const REL_KIND_LABEL = {
  friend: 'Friend',
  lover: 'Lover',
  rival: 'Rival',
  collaborator: 'Collaborator',
};

function displayLabelForRelationshipKind(kind) {
  const k = kind && String(kind).trim().toLowerCase();
  return REL_KIND_LABEL[k] || 'Connection';
}

async function createConnectionIntent(input) {
  const fromChartId = input.fromChartId || input.chartId || null;
  const toChartId = input.toChartId || null;
  const relationshipKind = (input.relationshipKind && String(input.relationshipKind).trim().toLowerCase()) || 'friend';
  const allowed = ['friend', 'lover', 'rival', 'collaborator'];
  const rk = allowed.includes(relationshipKind) ? relationshipKind : 'friend';
  const label = (input.label && String(input.label).trim()) || displayLabelForRelationshipKind(rk);

  return withTransaction(async (client) => {
    const [k1, k2] = userPairAdvisoryLockKeys(input.fromUserId, input.toUserId);
    await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', [k1, k2]);

    const pendingRes = await client.query(
      `SELECT id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at, accepted_at
       FROM astradio_connection_intents
       WHERE status = 'pending'
         AND ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1))
       FOR UPDATE`,
      [input.fromUserId, input.toUserId]
    );
    const pending = pendingRes.rows || [];

    const sameDir = pending.find(
      (r) => r.from_user_id === input.fromUserId && r.to_user_id === input.toUserId
    );
    const revDir = pending.find(
      (r) => r.from_user_id === input.toUserId && r.to_user_id === input.fromUserId
    );

    if (sameDir) {
      const t = now();
      await client.query(
        `UPDATE astradio_connection_intents
         SET from_chart_id = $2, to_chart_id = $3, chart_id = $2, label = $4, relationship_kind = $5, created_at = $6
         WHERE id = $1 AND status = 'pending'`,
        [sameDir.id, fromChartId, toChartId, label, rk, t]
      );
      const row = await clientQueryRow(
        client,
        `SELECT id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at, accepted_at
         FROM astradio_connection_intents WHERE id = $1`,
        [sameDir.id]
      );
      return rowToConnectionIntent(row);
    }

    if (revDir) {
      const err = new Error('mirror_pending');
      err.code = 'mirror_pending';
      throw err;
    }

    const id = `int_${nanoid()}`;
    const t = now();
    await client.query(
      `INSERT INTO astradio_connection_intents
        (id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, input.fromUserId, input.toUserId, fromChartId, fromChartId, toChartId, label, rk, input.status || 'pending', t]
    );
    const row = await clientQueryRow(
      client,
      `SELECT id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at, accepted_at
       FROM astradio_connection_intents WHERE id = $1`,
      [id]
    );
    return rowToConnectionIntent(row);
  });
}

async function getConnectionIntent(id) {
  const row = await getRow(
    `SELECT id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at, accepted_at
     FROM astradio_connection_intents WHERE id = $1`,
    [id]
  );
  return rowToConnectionIntent(row);
}

async function listPendingIncomingConnectionIntents(toUserId) {
  const rows = await getRows(
    `SELECT id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at, accepted_at
     FROM astradio_connection_intents
     WHERE to_user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [toUserId]
  );
  return rows.map(rowToConnectionIntent);
}

async function listPendingOutgoingConnectionIntents(fromUserId) {
  const rows = await getRows(
    `SELECT id, from_user_id, to_user_id, chart_id, from_chart_id, to_chart_id, label, relationship_kind, status, created_at, accepted_at
     FROM astradio_connection_intents
     WHERE from_user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [fromUserId]
  );
  return rows.map(rowToConnectionIntent);
}

/**
 * Option B: accept intent → two astradio_relationships rows (one per participant).
 * Validates chart ownership; fail-closed. Single pending row via conditional UPDATE.
 */
async function declineConnectionIntent(intentId, decliningUserId) {
  const row = await getRow(
    `SELECT id, from_user_id, to_user_id, status FROM astradio_connection_intents WHERE id = $1`,
    [intentId]
  );
  if (!row || row.status !== 'pending') return { ok: false, error: 'not_found_or_not_pending' };
  if (row.to_user_id !== decliningUserId) return { ok: false, error: 'forbidden' };
  const upd = await query(
    `UPDATE astradio_connection_intents SET status = 'declined' WHERE id = $1 AND status = 'pending'`,
    [intentId]
  );
  if ((upd.rowCount || 0) < 1) return { ok: false, error: 'not_found_or_not_pending' };
  return { ok: true, intentId };
}

async function cancelConnectionIntent(intentId, senderUserId) {
  const row = await getRow(
    `SELECT id, from_user_id, status FROM astradio_connection_intents WHERE id = $1`,
    [intentId]
  );
  if (!row || row.status !== 'pending') return { ok: false, error: 'not_found_or_not_pending' };
  if (row.from_user_id !== senderUserId) return { ok: false, error: 'forbidden' };
  const upd = await query(
    `UPDATE astradio_connection_intents SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
    [intentId]
  );
  if ((upd.rowCount || 0) < 1) return { ok: false, error: 'not_found_or_not_pending' };
  return { ok: true, intentId };
}

async function acceptConnectionIntent(intentId, acceptingUserId) {
  const row = await getRow(
    `SELECT id, from_user_id, to_user_id, from_chart_id, to_chart_id, label, relationship_kind, status
     FROM astradio_connection_intents WHERE id = $1`,
    [intentId]
  );
  if (!row || row.status !== 'pending') return { ok: false, error: 'not_found_or_not_pending' };
  if (row.to_user_id !== acceptingUserId) return { ok: false, error: 'forbidden' };
  const fromChartId = row.from_chart_id;
  const toChartId = row.to_chart_id;
  if (!fromChartId || !toChartId) return { ok: false, error: 'missing_charts' };
  const cFrom = await getChart(fromChartId);
  const cTo = await getChart(toChartId);
  if (!cFrom || !cTo) return { ok: false, error: 'chart_not_found' };
  if (cFrom.ownerId !== row.from_user_id) return { ok: false, error: 'from_chart_owner_mismatch' };
  if (cTo.ownerId !== row.to_user_id) return { ok: false, error: 'to_chart_owner_mismatch' };

  const rk = row.relationship_kind && String(row.relationship_kind).trim().toLowerCase();
  const label =
    (row.label && String(row.label).trim()) ||
    displayLabelForRelationshipKind(rk || 'friend');

  return withTransaction(async (client) => {
    const locked = await clientQueryRow(
      client,
      `SELECT id, from_user_id, to_user_id, status
       FROM astradio_connection_intents WHERE id = $1 FOR UPDATE`,
      [intentId]
    );
    if (!locked || locked.status !== 'pending') {
      return { ok: false, error: 'not_found_or_not_pending' };
    }
    if (locked.to_user_id !== acceptingUserId) {
      return { ok: false, error: 'forbidden' };
    }

    const t = now();
    const upd = await client.query(
      `UPDATE astradio_connection_intents SET status = 'accepted', accepted_at = $2
       WHERE id = $1 AND status = 'pending'`,
      [intentId, t]
    );
    if ((upd.rowCount || 0) < 1) {
      return { ok: false, error: 'not_found_or_not_pending' };
    }

    if (process.env.PG_STORE_TEST_THROW_AFTER_ACCEPT_INTENT_UPDATE === '1') {
      throw new Error('pg_store_test_injected_failure');
    }

    const relA = await createRelationship(
      {
        ownerUserId: row.from_user_id,
        chartAId: fromChartId,
        chartBId: toChartId,
        label,
        comparisonId: null,
      },
      client
    );
    const relB = await createRelationship(
      {
        ownerUserId: row.to_user_id,
        chartAId: fromChartId,
        chartBId: toChartId,
        label,
        comparisonId: null,
      },
      client
    );

    return { ok: true, intentId, relationships: [relA, relB] };
  });
}

async function listSignalsForRecipient(userId) {
  try {
    const rows = await getRows(
      `SELECT id, recipient_user_id, anchor_type, anchor_id, template_id, body_json, status, reply_count, max_replies, expires_at, created_at
       FROM astradio_signals
       WHERE recipient_user_id = $1 AND status = 'open' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      anchorType: r.anchor_type,
      anchorId: r.anchor_id,
      templateId: r.template_id,
      body: r.body_json,
      status: r.status,
      replyCount: r.reply_count,
      maxReplies: r.max_replies,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  } catch (e) {
    if (e.code === '42P01') return [];
    throw e;
  }
}

async function reactToSignal(signalId, recipientUserId) {
  try {
    const row = await getRow(
      `SELECT id, recipient_user_id, reply_count, max_replies, status FROM astradio_signals WHERE id = $1`,
      [signalId]
    );
    if (!row) return { ok: false, error: 'not_found' };
    if (row.recipient_user_id !== recipientUserId) return { ok: false, error: 'forbidden' };
    if (row.status !== 'open') return { ok: false, error: 'closed' };
    if (row.reply_count >= row.max_replies) return { ok: false, error: 'max_replies' };
    const upd = await query(
      `UPDATE astradio_signals
       SET reply_count = reply_count + 1,
           status = CASE WHEN reply_count + 1 >= max_replies THEN 'closed' ELSE 'open' END
       WHERE id = $1 AND recipient_user_id = $2 AND status = 'open'`,
      [signalId, recipientUserId]
    );
    if ((upd.rowCount || 0) < 1) return { ok: false, error: 'update_failed' };
    return { ok: true };
  } catch (e) {
    if (e.code === '42P01') return { ok: false, error: 'signals_table_missing' };
    throw e;
  }
}

async function findRelationshipByOwnerAndCharts(ownerUserId, chartIdLow, chartIdHigh) {
  const [low, high] =
    String(chartIdLow).localeCompare(String(chartIdHigh), 'en') <= 0
      ? [chartIdLow, chartIdHigh]
      : [chartIdHigh, chartIdLow];
  const row = await getRow(
    `SELECT id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at
     FROM astradio_relationships
     WHERE owner_user_id = $1 AND chart_id_low = $2 AND chart_id_high = $3`,
    [ownerUserId, low, high]
  );
  return row ? rowToRelationship(row) : undefined;
}

/** Latest accepted intent kind for a chart pair + label (canonical chart order). */
async function findAcceptedIntentRelationshipKind(chartIdLow, chartIdHigh, label) {
  const low = String(chartIdLow || '').trim();
  const high = String(chartIdHigh || '').trim();
  if (!low || !high) return null;
  const [a, b] = low.localeCompare(high, 'en') <= 0 ? [low, high] : [high, low];
  const lab = String(label || '').trim();
  if (!lab) return null;
  try {
    const row = await getRow(
      `SELECT relationship_kind
       FROM astradio_connection_intents
       WHERE status = 'accepted'
         AND label = $3
         AND (
           (from_chart_id = $1 AND to_chart_id = $2)
           OR (from_chart_id = $2 AND to_chart_id = $1)
         )
       ORDER BY COALESCE(accepted_at, created_at) DESC
       LIMIT 1`,
      [a, b, lab]
    );
    return row && row.relationship_kind ? String(row.relationship_kind).trim().toLowerCase() : null;
  } catch (e) {
    if (e && e.code === '42P01') return null;
    throw e;
  }
}

async function updateRelationshipsComparisonIdForPair({ chartIdLow, chartIdHigh, label, comparisonId }) {
  const low = String(chartIdLow || '').trim();
  const high = String(chartIdHigh || '').trim();
  const lab = String(label || '').trim();
  const cmp = String(comparisonId || '').trim();
  if (!low || !high || !lab || !cmp) return { updated: 0 };
  const t = now();
  const res = await query(
    `UPDATE astradio_relationships
     SET comparison_id = $4, updated_at = $5
     WHERE chart_id_low = $1 AND chart_id_high = $2 AND label = $3`,
    [low, high, lab, cmp, t]
  );
  return { updated: res.rowCount || 0 };
}

/** Sets export_job_id only when currently unset (no overwrite of existing audio link). */
async function updateComparisonExportJobIfEmpty(comparisonId, exportJobId) {
  const id = String(comparisonId || '').trim();
  const eid = String(exportJobId || '').trim();
  if (!id || !eid) return { updated: false };
  const res = await query(
    `UPDATE astradio_comparisons
     SET export_job_id = $2
     WHERE id = $1 AND (export_job_id IS NULL OR export_job_id = '')`,
    [id, eid]
  );
  return { updated: (res.rowCount || 0) > 0 };
}

// ---- Relational group invites (peer charts; invitee accepts) ----

async function createRelationalGroupInvite(input) {
  const id = `rgin_${nanoid()}`;
  await query(
    `INSERT INTO astradio_relational_group_invites
      (id, group_id, inviter_user_id, invitee_user_id, invitee_chart_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
    [id, input.groupId, input.inviterUserId, input.inviteeUserId, input.inviteeChartId, now()]
  );
  const row = await getRow(
    `SELECT id, group_id, inviter_user_id, invitee_user_id, invitee_chart_id, status, created_at, responded_at
     FROM astradio_relational_group_invites WHERE id = $1`,
    [id]
  );
  return row
    ? {
        id: row.id,
        groupId: row.group_id,
        inviterUserId: row.inviter_user_id,
        inviteeUserId: row.invitee_user_id,
        inviteeChartId: row.invitee_chart_id,
        status: row.status,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
      }
    : { id, groupId: input.groupId, inviterUserId: input.inviterUserId, inviteeUserId: input.inviteeUserId, inviteeChartId: input.inviteeChartId, status: 'pending', createdAt: now(), respondedAt: null };
}

async function listPendingRelationalGroupInvitesForInvitee(inviteeUserId) {
  const rows = await getRows(
    `SELECT id, group_id, inviter_user_id, invitee_user_id, invitee_chart_id, status, created_at, responded_at
     FROM astradio_relational_group_invites
     WHERE invitee_user_id = $1 AND status = 'pending'
     ORDER BY created_at DESC`,
    [inviteeUserId]
  );
  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    inviterUserId: row.inviter_user_id,
    inviteeUserId: row.invitee_user_id,
    inviteeChartId: row.invitee_chart_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }));
}

async function acceptRelationalGroupInvite(inviteId, inviteeUserId, expectedGroupId) {
  const row = await getRow(
    `SELECT id, group_id, inviter_user_id, invitee_user_id, invitee_chart_id, status
     FROM astradio_relational_group_invites WHERE id = $1`,
    [inviteId]
  );
  if (!row || row.status !== 'pending') return { ok: false, error: 'not_found_or_not_pending' };
  if (expectedGroupId && row.group_id !== expectedGroupId) return { ok: false, error: 'group_mismatch' };
  if (row.invitee_user_id !== inviteeUserId) return { ok: false, error: 'forbidden' };
  const chart = await getChart(row.invitee_chart_id);
  if (!chart || chart.ownerId !== inviteeUserId) return { ok: false, error: 'chart_owner_mismatch' };
  const group = await getRelationalGroupById(row.group_id);
  if (!group || group.ownerId !== row.inviter_user_id) return { ok: false, error: 'group_not_found' };

  const t = now();
  await query(
    `UPDATE astradio_relational_group_invites SET status = 'accepted', responded_at = $2 WHERE id = $1`,
    [inviteId, t]
  );

  const member = await addRelationalGroupMember({
    groupId: row.group_id,
    memberType: 'platform',
    userId: inviteeUserId,
    chartId: row.invitee_chart_id,
    role: 'member',
    label: null,
  });
  return { ok: true, member };
}

/**
 * For group composite/forecast: group owner may aggregate member charts when each member row's userId owns that chart.
 */
async function assertRelationalGroupMemberOwnershipConsistency(groupId, ownerUserId) {
  const group = await getRelationalGroupById(groupId);
  if (!group || group.ownerId !== ownerUserId) return false;
  const members = await listRelationalGroupMembers(groupId, ownerUserId);
  if (!members || members.length === 0) return false;
  for (const m of members) {
    // eslint-disable-next-line no-await-in-loop
    const ch = await getChart(m.chartId);
    if (!ch || ch.ownerId !== m.userId) return false;
  }
  return true;
}

// ---- Chart vectors (Phase 4) ----
async function upsertChartVector(input) {
  const chartId = input.chartId;
  const vector64 = Array.isArray(input.vector64) ? input.vector64 : [];
  const version = input.version || 'v1';
  const encoderVersion = input.encoderVersion || 'v1';
  const snapshotHash = input.snapshotHash || null;
  await query(
    `INSERT INTO astradio_chart_vectors (chart_id, vector64, version, encoder_version, snapshot_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (chart_id) DO UPDATE SET
       vector64 = EXCLUDED.vector64,
       version = EXCLUDED.version,
       encoder_version = EXCLUDED.encoder_version,
       snapshot_hash = EXCLUDED.snapshot_hash`,
    [chartId, JSON.stringify(vector64), version, encoderVersion, snapshotHash, now()]
  );
  return { chartId, version };
}

async function getChartVector(chartId) {
  const row = await getRow(
    'SELECT chart_id, vector64, version, encoder_version, snapshot_hash FROM astradio_chart_vectors WHERE chart_id = $1',
    [chartId]
  );
  if (!row) return undefined;
  return {
    chartId: row.chart_id,
    vector64: Array.isArray(row.vector64) ? row.vector64 : (row.vector64 && typeof row.vector64 === 'object' ? Object.values(row.vector64) : []),
    version: row.version,
    encoderVersion: row.encoder_version,
    snapshotHash: row.snapshot_hash || undefined,
  };
}

async function getChartVectorsByIds(chartIds) {
  if (!chartIds || chartIds.length === 0) return new Map();
  const placeholders = chartIds.map((_, i) => `$${i + 1}`).join(',');
  const rows = await getRows(
    `SELECT chart_id, vector64, version, encoder_version FROM astradio_chart_vectors WHERE chart_id IN (${placeholders})`,
    chartIds
  );
  const map = new Map();
  for (const row of rows) {
    const vec = Array.isArray(row.vector64) ? row.vector64 : (row.vector64 && typeof row.vector64 === 'object' ? Object.values(row.vector64) : []);
    map.set(row.chart_id, { chartId: row.chart_id, vector64: vec, version: row.version, encoderVersion: row.encoder_version });
  }
  return map;
}

// ---- Stage 4: relationships (unordered, canonical pair) ----
function canonicalPair(chartAId, chartBId) {
  const a = String(chartAId || '').trim();
  const b = String(chartBId || '').trim();
  if (!a || !b) throw new Error('chartAId and chartBId required');
  if (a === b) throw new Error('chartAId and chartBId must be different');
  return a.localeCompare(b, 'en') <= 0 ? [a, b] : [b, a];
}

function normalizeChartIdsOrdered(chartIds) {
  return Array.from(
    new Set(
      (Array.isArray(chartIds) ? chartIds : [])
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'en'));
}

function hashChartIdsOrdered(chartIdsOrdered) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizeChartIdsOrdered(chartIdsOrdered)), 'utf8')
    .digest('hex');
}

function canonicalDayBucketFromTransitTs(transitTs) {
  const ts = String(transitTs || '').trim();
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function rowToRelationship(row) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    chartIdLow: row.chart_id_low,
    chartIdHigh: row.chart_id_high,
    label: row.label,
    comparisonId: row.comparison_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createRelationship(input, client = null) {
  const id = `rel_${nanoid()}`;
  const [low, high] = canonicalPair(input.chartAId, input.chartBId);
  const t = now();
  const sql = `INSERT INTO astradio_relationships
      (id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (owner_user_id, chart_id_low, chart_id_high, label)
     DO UPDATE SET updated_at = EXCLUDED.updated_at
     RETURNING id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at`;
  const params = [id, input.ownerUserId, low, high, input.label, input.comparisonId || null, t];
  const res = client ? await client.query(sql, params) : await query(sql, params);
  const row = res.rows[0];
  if (!row) throw new Error('createRelationship: insert returned no row');
  return rowToRelationship(row);
}

async function listRelationshipsByOwner(ownerUserId) {
  const rows = await getRows(
    `SELECT id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at
     FROM astradio_relationships
     WHERE owner_user_id = $1
     ORDER BY created_at DESC`,
    [ownerUserId]
  );
  return rows.map(rowToRelationship);
}

async function listRelationshipsByParticipant(userId) {
  if (!userId) return [];
  const rows = await getRows(
    `SELECT DISTINCT r.id, r.owner_user_id, r.chart_id_low, r.chart_id_high, r.label, r.comparison_id, r.created_at, r.updated_at
     FROM astradio_relationships r
     INNER JOIN astradio_charts c1 ON c1.id = r.chart_id_low
     INNER JOIN astradio_charts c2 ON c2.id = r.chart_id_high
     WHERE c1.owner_id = $1 OR c2.owner_id = $1
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows.map(rowToRelationship);
}

async function getRelationshipById(id) {
  const row = await getRow(
    `SELECT id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at
     FROM astradio_relationships WHERE id = $1`,
    [id]
  );
  if (!row) return undefined;
  return rowToRelationship(row);
}

async function userParticipatesInRelationship(relationshipId, userId) {
  const rel = await getRelationshipById(relationshipId);
  if (!rel || !userId) return false;
  const lowChart = await getChart(rel.chartIdLow);
  const highChart = await getChart(rel.chartIdHigh);
  return [lowChart?.ownerId, highChart?.ownerId].includes(userId);
}

async function deleteRelationshipById(id, ownerUserId) {
  const res = await query(
    'DELETE FROM astradio_relationships WHERE id = $1 AND owner_user_id = $2',
    [id, ownerUserId]
  );
  return (res.rowCount || 0) > 0;
}

// ---- Stage 4: immutable composite artifacts ----
function rowToCompositeArtifact(row) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    kind: row.kind,
    relationshipId: row.relationship_id,
    groupId: row.group_id,
    chartIds: Array.isArray(row.chart_ids) ? row.chart_ids : [],
    vectorHashes: row.vector_hashes || {},
    seed: row.seed,
    algorithmVersion: row.algorithm_version,
    planHash: row.plan_hash,
    compositionId: row.composition_id,
    artifactHash: row.artifact_hash,
    createdAt: row.created_at,
    readingSnapshot: row.reading_snapshot != null ? row.reading_snapshot : undefined,
    exportJobId: row.export_job_id != null ? row.export_job_id : undefined,
  };
}

function normalizeLibrarySource(value) {
  const src = String(value || '').trim();
  if (!src) throw new Error('community_library_source_required');
  return src;
}

function normalizeObjectIdentityHash(value) {
  const hash = String(value || '').trim();
  if (!hash) throw new Error('community_library_object_identity_hash_required');
  return hash;
}

async function findCommunityLibraryEntryByOwnerAndIdentity(ownerUserId, source, objectIdentityHash) {
  const row = await getRow(
    `SELECT id
     FROM astradio_sandbox_compositions
     WHERE owner_user_id = $1 AND source = $2 AND object_identity_hash = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [ownerUserId, source, objectIdentityHash]
  );
  return row ? String(row.id) : null;
}

async function ensureParticipantOwnedArtifactPointer(input) {
  const ownerUserId = String(input.ownerUserId || '').trim();
  if (!ownerUserId) throw new Error('community_library_owner_required');
  const source = normalizeLibrarySource(input.source);
  const objectIdentityHash = normalizeObjectIdentityHash(input.objectIdentityHash);
  const existingId = await findCommunityLibraryEntryByOwnerAndIdentity(ownerUserId, source, objectIdentityHash);
  if (existingId) return { id: existingId, inserted: false };

  const id = `clib_${nanoid()}`;
  const t = now();
  const planHashRaw = String(input.planHash || '').trim();
  const vectorHashRaw = String(input.vectorHash || '').trim();
  const fallbackHash = objectIdentityHash;
  const planHash = planHashRaw || fallbackHash;
  const vectorHash = vectorHashRaw || planHash || fallbackHash;
  const seed = String(input.seed || 'community_artifact_pointer_v1').trim() || 'community_artifact_pointer_v1';
  const compositionType = String(input.compositionType || '').trim() || null;
  const exportId = String(input.exportId || '').trim() || null;
  const report = input.report != null ? input.report : {};
  const sandboxState = input.sandboxState != null ? input.sandboxState : {};

  await query(
    `INSERT INTO astradio_sandbox_compositions
      (id, owner_user_id, sandbox_state, vector_hash, seed, plan_hash, report, provider, provider_version, export_id, source, composition_type, object_identity_hash, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $14)`,
    [
      id,
      ownerUserId,
      JSON.stringify(sandboxState),
      vectorHash,
      seed,
      planHash,
      JSON.stringify(report),
      null,
      null,
      exportId,
      source,
      compositionType,
      objectIdentityHash,
      t,
    ]
  );
  return { id, inserted: true };
}

async function findRelationshipByOwnerChartsAndLabel(ownerUserId, chartIdLow, chartIdHigh, label) {
  const [low, high] =
    String(chartIdLow).localeCompare(String(chartIdHigh), 'en') <= 0
      ? [chartIdLow, chartIdHigh]
      : [chartIdHigh, chartIdLow];
  const lab = String(label || '').trim();
  if (!lab) return undefined;
  const row = await getRow(
    `SELECT id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at
     FROM astradio_relationships
     WHERE owner_user_id = $1 AND chart_id_low = $2 AND chart_id_high = $3 AND label = $4
     ORDER BY created_at DESC
     LIMIT 1`,
    [ownerUserId, low, high, lab]
  );
  return row ? rowToRelationship(row) : undefined;
}

async function ensureCommunityRelationshipLibraryEntriesForParticipants(input) {
  const uniqueOwners = Array.from(new Set((input.participantUserIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const out = [];
  for (const ownerUserId of uniqueOwners) {
    // eslint-disable-next-line no-await-in-loop
    const ownerRel =
      // prefer exact label match when provided; fall back to pair match if exact row unavailable
      (input.label
        ? await findRelationshipByOwnerChartsAndLabel(ownerUserId, input.chartIdLow, input.chartIdHigh, input.label)
        : undefined) ||
      // eslint-disable-next-line no-await-in-loop
      (await findRelationshipByOwnerAndCharts(ownerUserId, input.chartIdLow, input.chartIdHigh));
    const sandboxState = {
      kind: 'community_relationship',
      relationshipId: ownerRel ? ownerRel.id : null,
      comparisonId: input.comparisonId,
      chartIdLow: input.chartIdLow,
      chartIdHigh: input.chartIdHigh,
    };
    const report = {
      artifactType: 'community_relationship',
      comparisonId: input.comparisonId,
      relationshipId: ownerRel ? ownerRel.id : null,
      compositionId: input.compositionId || null,
      planHash: input.planHash || null,
      exportJobId: input.exportJobId || null,
    };
    // eslint-disable-next-line no-await-in-loop
    const saved = await ensureParticipantOwnedArtifactPointer({
      ownerUserId,
      source: 'community_relationship',
      compositionType: 'A+B',
      objectIdentityHash: input.comparisonId,
      exportId: input.exportJobId || null,
      planHash: input.planHash || input.compositionId || input.comparisonId,
      vectorHash: input.planHash || input.compositionId || input.comparisonId,
      seed: `community_relationship_${input.chartIdLow}_${input.chartIdHigh}`,
      sandboxState,
      report,
    });
    out.push({ ownerUserId, id: saved.id, inserted: saved.inserted });
  }
  return out;
}

async function ensureCommunityGroupLibraryEntriesForMembers(input) {
  const uniqueOwners = Array.from(new Set((input.memberUserIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const out = [];
  for (const ownerUserId of uniqueOwners) {
    const sandboxState = {
      kind: 'community_group',
      groupId: input.groupId,
      compositeArtifactId: input.compositeArtifactId,
      chartIds: Array.isArray(input.chartIds) ? input.chartIds : [],
    };
    const report = {
      artifactType: 'community_group',
      groupId: input.groupId,
      groupSlug: input.groupSlug || null,
      groupName: input.groupName || null,
      compositeArtifactId: input.compositeArtifactId,
      exportJobId: input.exportJobId || null,
      compositionId: input.compositionId || null,
      planHash: input.planHash || null,
      readingSnapshot: input.readingSnapshot || null,
    };
    // eslint-disable-next-line no-await-in-loop
    const saved = await ensureParticipantOwnedArtifactPointer({
      ownerUserId,
      source: 'community_group',
      compositionType: 'A+B+N',
      objectIdentityHash: input.compositeArtifactId,
      exportId: input.exportJobId || null,
      planHash: input.planHash || input.compositionId || input.compositeArtifactId,
      vectorHash: input.planHash || input.compositionId || input.compositeArtifactId,
      seed: `community_group_${input.groupId}`,
      sandboxState,
      report,
    });
    out.push({ ownerUserId, id: saved.id, inserted: saved.inserted });
  }
  return out;
}

async function ensureCommunityRelationalWeatherLibraryEntriesForParticipants(input) {
  const uniqueOwners = Array.from(new Set((input.participantUserIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const out = [];
  for (const ownerUserId of uniqueOwners) {
    const sandboxState = {
      kind: 'community_relational_weather',
      scopeKind: input.scopeKind,
      bindingId: input.bindingId,
      relationshipId: input.relationshipId || null,
      groupId: input.groupId || null,
      chartIdsOrdered: Array.isArray(input.chartIdsOrdered) ? input.chartIdsOrdered : [],
      transit_snapshot_hash: input.transitSnapshotHash,
      relational_weather_state_hash: input.relationalWeatherStateHash,
      planHash: input.planHash || null,
      compositionId: input.compositionId || null,
      exportJobId: input.exportJobId || null,
    };
    const report = {
      artifactType: 'community_relational_weather',
      text: input.text != null ? input.text : null,
      weather: input.weather || null,
    };
    // eslint-disable-next-line no-await-in-loop
    const saved = await ensureParticipantOwnedArtifactPointer({
      ownerUserId,
      source: 'community_relational_weather',
      compositionType: input.scopeKind === 'group' ? 'A+B+N+C(t)' : 'A+B+C(t)',
      objectIdentityHash: input.objectIdentityHash,
      exportId: input.exportJobId || null,
      planHash: input.planHash || input.compositionId || input.objectIdentityHash,
      vectorHash: input.planHash || input.compositionId || input.objectIdentityHash,
      seed: `community_relational_weather_${input.scopeKind}_${input.bindingId}`,
      sandboxState,
      report,
    });
    out.push({ ownerUserId, id: saved.id, inserted: saved.inserted });
  }
  return out;
}

async function ensureCommunityRelationalWeatherLibraryEntryForUser(input) {
  const ownerUserId = String(input.ownerUserId || '').trim();
  if (!ownerUserId) throw new Error('community_library_owner_required');
  const sandboxState = {
    kind: 'community_relational_weather',
    scopeKind: input.scopeKind,
    bindingId: input.bindingId,
    relationshipId: input.relationshipId || null,
    groupId: input.groupId || null,
    chartIdsOrdered: normalizeChartIdsOrdered(input.chartIdsOrdered),
    chart_ids_ordered_hash: input.chartIdsOrderedHash || hashChartIdsOrdered(input.chartIdsOrdered),
    canonical_day_bucket: input.canonicalDayBucket,
    transit_snapshot_hash: input.transitSnapshotHash,
    relational_weather_state_hash: input.relationalWeatherStateHash,
    daily_artifact_id: input.dailyArtifactId || null,
    planHash: input.planHash || null,
    compositionId: input.compositionId || null,
    exportJobId: input.exportJobId || null,
  };
  const report = {
    artifactType: 'community_relational_weather',
    text: input.text != null ? input.text : null,
    weather: input.weather || null,
  };
  return ensureParticipantOwnedArtifactPointer({
    ownerUserId,
    source: 'community_relational_weather',
    compositionType: input.scopeKind === 'group' ? 'A+B+N+C(t)' : 'A+B+C(t)',
    objectIdentityHash: input.objectIdentityHash,
    exportId: input.exportJobId || null,
    planHash: input.planHash || input.compositionId || input.objectIdentityHash,
    vectorHash: input.planHash || input.compositionId || input.objectIdentityHash,
    seed: `community_relational_weather_${input.scopeKind}_${input.bindingId}_${input.canonicalDayBucket}`,
    sandboxState,
    report,
  });
}

/**
 * Repair-only UPDATE for library rows created by relational-weather save.
 * ONLY source = community_relational_weather. Updates report JSON only — never export_id.
 */
async function repairCommunityRelationalWeatherLibraryComposition(input) {
  const ownerUserId = String(input.ownerUserId || '').trim();
  const objectIdentityHash = String(input.objectIdentityHash || '').trim();
  if (!ownerUserId || !objectIdentityHash) return { updated: false, reportTextUpdated: false };

  const row = await getRow(
    `SELECT id, report, export_id FROM astradio_sandbox_compositions
     WHERE owner_user_id = $1 AND source = $2 AND object_identity_hash = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [ownerUserId, 'community_relational_weather', objectIdentityHash]
  );
  if (!row) return { updated: false, reportTextUpdated: false };

  const text = input.text;
  const weather = input.weather;

  const hasText = text != null;
  const hasWeather = weather != null && typeof weather === 'object';
  if (!hasText && !hasWeather) return { updated: false, reportTextUpdated: false };

  let reportObj = {};
  if (row.report && typeof row.report === 'object' && !Array.isArray(row.report)) {
    reportObj = { ...row.report };
  } else if (typeof row.report === 'string') {
    try {
      const p = JSON.parse(row.report);
      if (p && typeof p === 'object' && !Array.isArray(p)) reportObj = p;
    } catch (_) {
      reportObj = {};
    }
  }

  const prevTextSnapshot = JSON.stringify(reportObj.text ?? null);
  if (hasText) {
    reportObj.artifactType = 'community_relational_weather';
    reportObj.text = text;
  }
  if (hasWeather) {
    reportObj.weather = weather;
  }
  const newTextSnapshot = JSON.stringify(reportObj.text ?? null);
  const reportTextUpdated = hasText && prevTextSnapshot !== newTextSnapshot;

  const res = await query(
    `UPDATE astradio_sandbox_compositions
     SET report = $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND owner_user_id = $3 AND source = $4`,
    [JSON.stringify(reportObj), row.id, ownerUserId, 'community_relational_weather']
  );
  const updated = (res.rowCount || 0) > 0;
  return { updated, reportTextUpdated: updated && reportTextUpdated };
}

async function createCompositeArtifact(input) {
  const id = `cpa_${nanoid()}`;
  const readingSnap =
    input.readingSnapshot != null ? JSON.stringify(input.readingSnapshot) : null;
  const exportJob = input.exportJobId != null && String(input.exportJobId).trim() ? String(input.exportJobId).trim() : null;
  const row = await getRow(
    `INSERT INTO astradio_composite_artifacts
      (id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at, reading_snapshot, export_job_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
     RETURNING id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at, reading_snapshot, export_job_id`,
    [
      id,
      input.ownerUserId,
      input.kind,
      input.relationshipId || null,
      input.groupId || null,
      JSON.stringify(input.chartIds || []),
      JSON.stringify(input.vectorHashes || {}),
      input.seed,
      input.algorithmVersion,
      input.planHash,
      input.compositionId,
      input.artifactHash,
      now(),
      readingSnap,
      exportJob,
    ]
  );
  return rowToCompositeArtifact(row);
}

/** Backfill reading/export on an existing composite row (first writer wins per column). */
async function updateCompositeArtifactReadingSnapshot(input) {
  const id = String(input.artifactId || '').trim();
  const ownerUserId = String(input.ownerUserId || '').trim();
  if (!id || !ownerUserId) return { updated: false };
  const snap =
    input.readingSnapshot != null ? JSON.stringify(input.readingSnapshot) : null;
  const exportJob = input.exportJobId != null && String(input.exportJobId).trim() ? String(input.exportJobId).trim() : null;
  if (snap == null && exportJob == null) return { updated: false };
  const res = await query(
    `UPDATE astradio_composite_artifacts
     SET reading_snapshot = COALESCE(reading_snapshot, $3::jsonb),
         export_job_id = COALESCE(NULLIF(export_job_id, ''), $4)
     WHERE id = $1 AND owner_user_id = $2`,
    [id, ownerUserId, snap, exportJob]
  );
  return { updated: (res.rowCount || 0) > 0 };
}

async function getCompositeArtifactByHash(ownerUserId, kind, artifactHash) {
  const row = await getRow(
    `SELECT id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at, reading_snapshot, export_job_id
     FROM astradio_composite_artifacts
     WHERE owner_user_id = $1 AND kind = $2 AND artifact_hash = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [ownerUserId, kind, artifactHash]
  );
  if (!row) return undefined;
  return rowToCompositeArtifact(row);
}

async function getCompositeArtifactById(id) {
  const row = await getRow(
    `SELECT id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at, reading_snapshot, export_job_id
     FROM astradio_composite_artifacts WHERE id = $1`,
    [id]
  );
  if (!row) return undefined;
  return rowToCompositeArtifact(row);
}

async function listCompositeArtifactsByBinding(input) {
  const rows = await getRows(
    `SELECT id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at, reading_snapshot, export_job_id
     FROM astradio_composite_artifacts
     WHERE owner_user_id = $1
       AND kind = $2
       AND (($2 = 'pair' AND relationship_id = $3) OR ($2 = 'group' AND group_id = $4))
     ORDER BY algorithm_version DESC, created_at DESC`,
    [input.ownerUserId, input.kind, input.relationshipId || null, input.groupId || null]
  );
  return rows.map(rowToCompositeArtifact);
}

function rowToCommunityRelationalWeatherDailyArtifact(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    bindingId: row.binding_id,
    chartIdsOrdered: Array.isArray(row.chart_ids_ordered) ? row.chart_ids_ordered : [],
    chartIdsOrderedHash: row.chart_ids_ordered_hash,
    canonicalDayBucket: row.canonical_day_bucket,
    transitSnapshotHash: row.transit_snapshot_hash,
    relationalWeatherStateHash: row.relational_weather_state_hash,
    planHash: row.plan_hash,
    compositionId: row.composition_id,
    exportJobId: row.export_job_id,
    artifactStatus: row.artifact_status,
    textPayload: row.text_payload,
    weatherPayload: row.weather_payload,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function lockCommunityRelationalWeatherIdentity(client, input) {
  const preimage = [
    String(input.scopeKind || '').trim(),
    String(input.bindingId || '').trim(),
    String(input.chartIdsOrderedHash || '').trim(),
    String(input.canonicalDayBucket || '').trim(),
  ].join('\n');
  const h = crypto.createHash('sha256').update(preimage, 'utf8').digest();
  await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', [h.readInt32BE(0), h.readInt32BE(4)]);
}

async function getCommunityRelationalWeatherDailyArtifactById(id) {
  const rid = String(id || '').trim();
  if (!rid) return undefined;
  const row = await getRow(
    `SELECT id, scope_kind, binding_id, chart_ids_ordered, chart_ids_ordered_hash, canonical_day_bucket,
            transit_snapshot_hash, relational_weather_state_hash, plan_hash, composition_id, export_job_id,
            artifact_status, text_payload, weather_payload, created_by_user_id, created_at, updated_at
     FROM astradio_community_relational_weather_daily_artifacts
     WHERE id = $1`,
    [rid]
  );
  if (!row) return undefined;
  return rowToCommunityRelationalWeatherDailyArtifact(row);
}

async function getCommunityRelationalWeatherDailyArtifactByIdentity(input, client = null) {
  const chartIdsOrderedHash = String(input.chartIdsOrderedHash || hashChartIdsOrdered(input.chartIdsOrdered)).trim();
  const row = client
    ? await clientQueryRow(
        client,
        `SELECT id, scope_kind, binding_id, chart_ids_ordered, chart_ids_ordered_hash, canonical_day_bucket,
                transit_snapshot_hash, relational_weather_state_hash, plan_hash, composition_id, export_job_id,
                artifact_status, text_payload, weather_payload, created_by_user_id, created_at, updated_at
         FROM astradio_community_relational_weather_daily_artifacts
         WHERE scope_kind = $1 AND binding_id = $2 AND chart_ids_ordered_hash = $3 AND canonical_day_bucket = $4
         LIMIT 1`,
        [input.scopeKind, input.bindingId, chartIdsOrderedHash, input.canonicalDayBucket]
      )
    : await getRow(
        `SELECT id, scope_kind, binding_id, chart_ids_ordered, chart_ids_ordered_hash, canonical_day_bucket,
                transit_snapshot_hash, relational_weather_state_hash, plan_hash, composition_id, export_job_id,
                artifact_status, text_payload, weather_payload, created_by_user_id, created_at, updated_at
         FROM astradio_community_relational_weather_daily_artifacts
         WHERE scope_kind = $1 AND binding_id = $2 AND chart_ids_ordered_hash = $3 AND canonical_day_bucket = $4
         LIMIT 1`,
        [input.scopeKind, input.bindingId, chartIdsOrderedHash, input.canonicalDayBucket]
      );
  return rowToCommunityRelationalWeatherDailyArtifact(row);
}

function parseSandboxStateColumn(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? p : null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Resolve daily artifact for library repair. STRICT:
 * - If sandbox_state.daily_artifact_id is set → load ONLY by id (no identity fallback).
 * - Else → identity query; if >1 row, return ambiguous (no repair).
 */
async function resolveDailyArtifactForLibraryRepair(libraryRow) {
  const sandbox = parseSandboxStateColumn(libraryRow.sandbox_state);
  const dailyId =
    sandbox && typeof sandbox.daily_artifact_id === 'string' && sandbox.daily_artifact_id.trim()
      ? sandbox.daily_artifact_id.trim()
      : null;
  if (dailyId) {
    const daily = await getCommunityRelationalWeatherDailyArtifactById(dailyId);
    return {
      daily: daily || null,
      resolutionPath: 'daily_artifact_id',
      reason: daily ? 'ok' : 'daily_row_not_found_by_id',
    };
  }
  const scopeKind = sandbox && typeof sandbox.scopeKind === 'string' ? sandbox.scopeKind.trim() : '';
  const bindingId = sandbox && typeof sandbox.bindingId === 'string' ? sandbox.bindingId.trim() : '';
  const chartIdsOrderedHash =
    sandbox && typeof sandbox.chart_ids_ordered_hash === 'string' ? sandbox.chart_ids_ordered_hash.trim() : '';
  const canonicalDayBucket =
    sandbox && typeof sandbox.canonical_day_bucket === 'string' ? sandbox.canonical_day_bucket.trim() : '';
  const chartIdsOrdered =
    sandbox && Array.isArray(sandbox.chartIdsOrdered)
      ? sandbox.chartIdsOrdered
      : sandbox && Array.isArray(sandbox.chart_ids_ordered)
        ? sandbox.chart_ids_ordered
        : [];
  if (!scopeKind || !bindingId || !chartIdsOrderedHash || !canonicalDayBucket || chartIdsOrdered.length < 2) {
    return { daily: null, resolutionPath: 'identity', reason: 'sandbox_state_incomplete' };
  }
  const idRows = await getRows(
    `SELECT id FROM astradio_community_relational_weather_daily_artifacts
     WHERE scope_kind = $1 AND binding_id = $2 AND chart_ids_ordered_hash = $3 AND canonical_day_bucket = $4`,
    [scopeKind, bindingId, chartIdsOrderedHash, canonicalDayBucket]
  );
  if (idRows.length > 1) {
    console.warn(
      '[community-repair] ambiguous_daily_matches',
      JSON.stringify({ count: idRows.length, scopeKind, bindingId, chartIdsOrderedHash, canonicalDayBucket })
    );
    return { daily: null, resolutionPath: 'identity', reason: 'ambiguous_daily_matches', ambiguousCount: idRows.length };
  }
  if (idRows.length === 0) {
    return { daily: null, resolutionPath: 'identity', reason: 'daily_not_found_by_identity' };
  }
  const daily = await getCommunityRelationalWeatherDailyArtifactById(idRows[0].id);
  return { daily: daily || null, resolutionPath: 'identity', reason: daily ? 'ok' : 'daily_row_missing' };
}

async function getSandboxCompositionByIdForOwner(libraryId, ownerUserId) {
  const lid = String(libraryId || '').trim();
  const oid = String(ownerUserId || '').trim();
  if (!lid || !oid) return undefined;
  const row = await getRow(
    `SELECT * FROM astradio_sandbox_compositions WHERE id = $1 AND owner_user_id = $2`,
    [lid, oid]
  );
  return row || undefined;
}

async function insertCommunityRelationalWeatherDailyArtifact(input, client = null) {
  const id = input.id || `crwd_${nanoid()}`;
  const chartIdsOrdered = normalizeChartIdsOrdered(input.chartIdsOrdered);
  const chartIdsOrderedHash = hashChartIdsOrdered(chartIdsOrdered);
  const textPayload = input.textPayload != null ? JSON.stringify(input.textPayload) : null;
  const weatherPayload = input.weatherPayload != null ? JSON.stringify(input.weatherPayload) : null;
  const sql = `INSERT INTO astradio_community_relational_weather_daily_artifacts
      (id, scope_kind, binding_id, chart_ids_ordered, chart_ids_ordered_hash, canonical_day_bucket,
       transit_snapshot_hash, relational_weather_state_hash, plan_hash, composition_id, export_job_id,
       artifact_status, text_payload, weather_payload, created_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16, $16)
     ON CONFLICT (scope_kind, binding_id, chart_ids_ordered_hash, canonical_day_bucket) DO NOTHING
     RETURNING id, scope_kind, binding_id, chart_ids_ordered, chart_ids_ordered_hash, canonical_day_bucket,
               transit_snapshot_hash, relational_weather_state_hash, plan_hash, composition_id, export_job_id,
               artifact_status, text_payload, weather_payload, created_by_user_id, created_at, updated_at`;
  const params = [
    id,
    input.scopeKind,
    input.bindingId,
    JSON.stringify(chartIdsOrdered),
    chartIdsOrderedHash,
    input.canonicalDayBucket,
    input.transitSnapshotHash,
    input.relationalWeatherStateHash || null,
    input.planHash || null,
    input.compositionId || null,
    input.exportJobId || null,
    input.artifactStatus,
    textPayload,
    weatherPayload,
    input.createdByUserId || null,
    now(),
  ];
  const row = client ? await clientQueryRow(client, sql, params) : await getRow(sql, params);
  return rowToCommunityRelationalWeatherDailyArtifact(row);
}

async function updateCommunityRelationalWeatherDailyArtifact(input, client = null) {
  const textPayload = input.textPayload != null ? JSON.stringify(input.textPayload) : null;
  const weatherPayload = input.weatherPayload != null ? JSON.stringify(input.weatherPayload) : null;
  const sql = `UPDATE astradio_community_relational_weather_daily_artifacts
      SET plan_hash = $2,
          composition_id = $3,
          export_job_id = $4,
          artifact_status = $5,
          text_payload = $6::jsonb,
          weather_payload = $7::jsonb,
          updated_at = $8
      WHERE id = $1
      RETURNING id, scope_kind, binding_id, chart_ids_ordered, chart_ids_ordered_hash, canonical_day_bucket,
                transit_snapshot_hash, relational_weather_state_hash, plan_hash, composition_id, export_job_id,
                artifact_status, text_payload, weather_payload, created_by_user_id, created_at, updated_at`;
  const row = client
    ? await clientQueryRow(client, sql, [
        input.id,
        input.planHash || null,
        input.compositionId || null,
        input.exportJobId || null,
        input.artifactStatus,
        textPayload,
        weatherPayload,
        now(),
      ])
    : await getRow(sql, [
        input.id,
        input.planHash || null,
        input.compositionId || null,
        input.exportJobId || null,
        input.artifactStatus,
        textPayload,
        weatherPayload,
        now(),
      ]);
  return rowToCommunityRelationalWeatherDailyArtifact(row);
}

async function getCommunityRelationalWeatherStatusesForFeed(input) {
  const canonicalDayBucket = String(input.canonicalDayBucket || '').trim();
  const identities = Array.isArray(input.identities) ? input.identities : [];
  if (!canonicalDayBucket || identities.length === 0) return new Map();
  const map = new Map();
  for (const ident of identities) {
    const scopeKind = String(ident.scopeKind || '').trim();
    const bindingId = String(ident.bindingId || '').trim();
    const chartIdsOrderedHash = hashChartIdsOrdered(ident.chartIdsOrdered || []);
    // eslint-disable-next-line no-await-in-loop
    const row = await getCommunityRelationalWeatherDailyArtifactByIdentity({
      scopeKind,
      bindingId,
      chartIdsOrderedHash,
      canonicalDayBucket,
    });
    map.set(`${scopeKind}:${bindingId}`, row ? row.artifactStatus : 'not_generated');
  }
  return map;
}

// ---- Dev user (community) ----
async function ensureDevUser() {
  let u = await getUserByHandle('@dev');
  if (!u) {
    u = await createUser({ handle: '@dev', displayName: 'Dev User' });
  }
  return u;
}

// ---- Relational groups (Phase 5, private) ----
async function createRelationalGroup(input) {
  const id = `rgrp_${nanoid()}`;
  const slug = input.slug || id;
  const name = input.name || 'Unnamed';
  const description = (input.description != null ? String(input.description) : '') || '';
  const visibility = 'private';
  await query(
    `INSERT INTO astradio_relational_groups (id, owner_id, slug, name, description, visibility, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [id, input.ownerId, slug, name, description, visibility, now()]
  );
  return { id, ownerId: input.ownerId, slug, name, description, visibility, createdAt: now(), updatedAt: now() };
}

async function listRelationalGroupsByOwner(ownerId) {
  const rows = await getRows(
    'SELECT id, owner_id, slug, name, description, visibility, created_at, updated_at FROM astradio_relational_groups WHERE owner_id = $1 ORDER BY created_at DESC',
    [ownerId]
  );
  return rows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function getRelationalGroupById(groupId) {
  const row = await getRow(
    'SELECT id, owner_id, slug, name, description, visibility, created_at, updated_at FROM astradio_relational_groups WHERE id = $1',
    [groupId]
  );
  if (!row) return undefined;
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function updateRelationalGroup(groupId, ownerId, patch) {
  const group = await getRelationalGroupById(groupId);
  if (!group || group.ownerId !== ownerId) return undefined;
  const updates = [];
  const params = [];
  let idx = 1;
  if (patch.name != null) {
    updates.push(`name = $${idx++}`);
    params.push(String(patch.name));
  }
  if (patch.description != null) {
    updates.push(`description = $${idx++}`);
    params.push(String(patch.description));
  }
  if (patch.slug != null) {
    updates.push(`slug = $${idx++}`);
    params.push(String(patch.slug));
  }
  if (updates.length === 0) return group;
  updates.push(`updated_at = $${idx}`);
  params.push(now());
  params.push(groupId, ownerId);
  await query(
    `UPDATE astradio_relational_groups SET ${updates.join(', ')} WHERE id = $${idx + 1} AND owner_id = $${idx + 2}`,
    params
  );
  return getRelationalGroupById(groupId);
}

async function deleteRelationalGroup(groupId, ownerId) {
  const group = await getRelationalGroupById(groupId);
  if (!group || group.ownerId !== ownerId) return false;
  await query('DELETE FROM astradio_relational_groups WHERE id = $1 AND owner_id = $2', [groupId, ownerId]);
  return true;
}

async function addRelationalGroupMember(input) {
  const id = `rmem_${nanoid()}`;
  const memberType = input.memberType === 'non_platform' ? 'non_platform' : 'platform';
  const userId = memberType === 'platform' ? input.userId : null;
  if (memberType === 'platform' && !userId) {
    throw new Error('platform member requires userId');
  }
  if (memberType === 'non_platform' && userId != null) {
    throw new Error('non_platform member must have userId null');
  }
  await query(
    `INSERT INTO astradio_relational_group_members (id, group_id, user_id, chart_id, member_type, role, label, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, input.groupId, userId, input.chartId, memberType, input.role || 'member', input.label || null, now()]
  );
  const row = await getRow('SELECT id, group_id, user_id, chart_id, member_type, role, label, created_at FROM astradio_relational_group_members WHERE id = $1', [id]);
  return row
    ? {
        id: row.id,
        groupId: row.group_id,
        userId: row.user_id,
        chartId: row.chart_id,
        memberType: row.member_type,
        role: row.role,
        label: row.label,
        createdAt: row.created_at,
      }
    : {
        id,
        groupId: input.groupId,
        userId,
        chartId: input.chartId,
        memberType,
        role: input.role || 'member',
        label: input.label || null,
        createdAt: now(),
      };
}

async function removeRelationalGroupMember(groupId, memberId, ownerId) {
  const group = await getRelationalGroupById(groupId);
  if (!group || group.ownerId !== ownerId) return false;
  const res = await query('DELETE FROM astradio_relational_group_members WHERE id = $1 AND group_id = $2', [memberId, groupId]);
  return (res.rowCount || 0) > 0;
}

async function listRelationalGroupMembers(groupId, ownerId) {
  const group = await getRelationalGroupById(groupId);
  if (!group || group.ownerId !== ownerId) return undefined;
  const rows = await getRows(
    'SELECT id, group_id, user_id, chart_id, member_type, role, label, created_at FROM astradio_relational_group_members WHERE group_id = $1 ORDER BY chart_id ASC, id ASC',
    [groupId]
  );
  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    chartId: r.chart_id,
    memberType: r.member_type,
    role: r.role,
    label: r.label,
    createdAt: r.created_at,
  }));
}

/** Owner or platform member may list roster for compatibility-intent scope + relational feed. */
async function userHasRelationalGroupScopeAccess(groupId, viewerUserId) {
  if (!groupId || !viewerUserId) return false;
  const group = await getRelationalGroupById(groupId);
  if (!group) return false;
  if (group.ownerId === viewerUserId) return true;
  const row = await getRow(
    'SELECT 1 AS ok FROM astradio_relational_group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1',
    [groupId, viewerUserId]
  );
  return !!row;
}

/**
 * Member-scoped roster (not owner-only). Returns undefined if viewer has no access.
 */
async function listRelationalGroupMembersForScope(groupId, viewerUserId) {
  const ok = await userHasRelationalGroupScopeAccess(groupId, viewerUserId);
  if (!ok) return undefined;
  const rows = await getRows(
    'SELECT id, group_id, user_id, chart_id, member_type, role, label, created_at FROM astradio_relational_group_members WHERE group_id = $1 ORDER BY chart_id ASC, id ASC',
    [groupId]
  );
  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    userId: r.user_id,
    chartId: r.chart_id,
    memberType: r.member_type,
    role: r.role,
    label: r.label,
    createdAt: r.created_at,
  }));
}

/**
 * Relational groups where user is owner OR platform member (for intent my_groups + inventory).
 */
async function listRelationalGroupsAccessibleToUser(userId) {
  if (!userId) return [];
  const rows = await getRows(
    `SELECT id, owner_id, slug, name, description, visibility, created_at, updated_at FROM (
       SELECT g.id, g.owner_id, g.slug, g.name, g.description, g.visibility, g.created_at, g.updated_at
       FROM astradio_relational_groups g WHERE g.owner_id = $1
       UNION
       SELECT g.id, g.owner_id, g.slug, g.name, g.description, g.visibility, g.created_at, g.updated_at
       FROM astradio_relational_groups g
       INNER JOIN astradio_relational_group_members m ON m.group_id = g.id AND m.user_id = $1
     ) x ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Resolve group by id or slug; viewer must have scope access. Slug may match multiple owners — first accessible wins (deterministic ORDER BY id).
 */
async function resolveRelationalGroupForScope(slugOrId, viewerUserId) {
  if (!slugOrId || !viewerUserId) return undefined;
  const id = String(slugOrId).trim();
  const byId = await getRelationalGroupById(id);
  if (byId && (await userHasRelationalGroupScopeAccess(byId.id, viewerUserId))) return byId;
  const rows = await getRows(
    'SELECT id, owner_id, slug, name, description, visibility, created_at, updated_at FROM astradio_relational_groups WHERE slug = $1 ORDER BY id ASC',
    [id]
  );
  for (const r of rows) {
    const g = {
      id: r.id,
      ownerId: r.owner_id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      visibility: r.visibility,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    if (await userHasRelationalGroupScopeAccess(g.id, viewerUserId)) return g;
  }
  return undefined;
}

// ---- Stage 5 campaigns (tri-mode, context_key unique) ----
const STAGE5_CAMPAIGN_ID_PREFIX = 'stage5_';

function canonicalSortIds(arr) {
  return Array.isArray(arr) ? [...arr].filter((x) => typeof x === 'string').sort((a, b) => a.localeCompare(b, 'en')) : [];
}

async function createStage5Campaign(input) {
  const campaignId = input.campaignId || `${STAGE5_CAMPAIGN_ID_PREFIX}${nanoid()}`;
  const participantUserIds = canonicalSortIds(input.participantUserIds);
  const participantChartIds = canonicalSortIds(input.participantChartIds);
  const versionSetJson = typeof input.versionSetJson === 'object' ? JSON.stringify(input.versionSetJson) : (input.versionSetJson || '{}');
  const stateJson = typeof input.stateJson === 'object' ? JSON.stringify(input.stateJson) : (input.stateJson != null ? String(input.stateJson) : '{}');
  const t = now();
  await query(
    `INSERT INTO stage5_campaigns (
       campaign_id, context_key, mode, owner_user_id, participant_user_ids, participant_chart_ids,
       group_id, composite_artifact_id, bundle_hash, state_json, state_hash, state_version,
       version_set_json, auto_resolution_signature, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14, $15, $15)
     ON CONFLICT (context_key) DO NOTHING`,
    [
      campaignId,
      input.contextKey,
      input.mode,
      input.ownerUserId,
      participantUserIds,
      participantChartIds,
      input.groupId || null,
      input.compositeArtifactId || null,
      input.bundleHash || null,
      stateJson,
      input.stateHash || '',
      input.stateVersion != null ? input.stateVersion : 1,
      versionSetJson,
      input.autoResolutionSignature || null,
      t,
    ]
  );
  const row = await getRow(
    `SELECT campaign_id, context_key, mode, owner_user_id, participant_user_ids, participant_chart_ids,
            group_id, composite_artifact_id, bundle_hash, state_json, state_hash, state_version,
            version_set_json, auto_resolution_signature, created_at, updated_at
     FROM stage5_campaigns WHERE context_key = $1`,
    [input.contextKey]
  );
  if (!row) throw new Error('Failed to insert or load Stage 5 campaign row');
  return rowToStage5Campaign(row);
}

function rowToStage5Campaign(row) {
  return {
    campaignId: row.campaign_id,
    contextKey: row.context_key,
    mode: row.mode,
    ownerUserId: row.owner_user_id,
    participantUserIds: Array.isArray(row.participant_user_ids) ? row.participant_user_ids : [],
    participantChartIds: Array.isArray(row.participant_chart_ids) ? row.participant_chart_ids : [],
    groupId: row.group_id,
    compositeArtifactId: row.composite_artifact_id,
    bundleHash: row.bundle_hash,
    stateJson: row.state_json,
    stateHash: row.state_hash,
    stateVersion: row.state_version,
    versionSetJson: row.version_set_json,
    autoResolutionSignature: row.auto_resolution_signature,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getStage5CampaignById(campaignId) {
  const row = await getRow(
    `SELECT campaign_id, context_key, mode, owner_user_id, participant_user_ids, participant_chart_ids,
            group_id, composite_artifact_id, bundle_hash, state_json, state_hash, state_version,
            version_set_json, auto_resolution_signature, created_at, updated_at
     FROM stage5_campaigns WHERE campaign_id = $1`,
    [campaignId]
  );
  if (!row) return undefined;
  return rowToStage5Campaign(row);
}

async function getStage5CampaignByContextKey(contextKey) {
  const row = await getRow(
    `SELECT campaign_id, context_key, mode, owner_user_id, participant_user_ids, participant_chart_ids,
            group_id, composite_artifact_id, bundle_hash, state_json, state_hash, state_version,
            version_set_json, auto_resolution_signature, created_at, updated_at
     FROM stage5_campaigns WHERE context_key = $1`,
    [contextKey]
  );
  if (!row) return undefined;
  return rowToStage5Campaign(row);
}

async function listStage5CampaignsByOwnerOrParticipant(callerUserId) {
  const rows = await getRows(
    `SELECT campaign_id, context_key, mode, owner_user_id, participant_user_ids, participant_chart_ids,
            group_id, composite_artifact_id, bundle_hash, state_json, state_hash, state_version,
            version_set_json, auto_resolution_signature, created_at, updated_at
     FROM stage5_campaigns
     WHERE owner_user_id = $1 OR $1 = ANY(participant_user_ids)
     ORDER BY updated_at DESC`,
    [callerUserId]
  );
  return rows.map(rowToStage5Campaign);
}

async function updateStage5CampaignState(campaignId, newStateJson, newStateHash) {
  const stateJson = typeof newStateJson === 'object' ? JSON.stringify(newStateJson) : String(newStateJson);
  const res = await query(
    `UPDATE stage5_campaigns
     SET state_json = $1::jsonb, state_hash = $2, state_version = state_version + 1, updated_at = NOW()
     WHERE campaign_id = $3`,
    [stateJson, newStateHash || '', campaignId]
  );
  return (res.rowCount || 0) > 0;
}

// ---- Campaign daily transit + user transit context (Phase 8) ----

function rowToUserTransitContext(row) {
  if (!row) return undefined;
  return {
    userId: row.user_id,
    contextJson: row.context_json,
    fingerprint: row.fingerprint,
    updatedAt: row.updated_at,
  };
}

async function getUserTransitContext(userId) {
  const row = await getRow(
    `SELECT user_id, context_json, fingerprint, updated_at
     FROM astradio_user_transit_context WHERE user_id = $1`,
    [userId]
  );
  return rowToUserTransitContext(row);
}

async function upsertUserTransitContext(userId, contextJson, fingerprint) {
  const ctx =
    typeof contextJson === 'object' && contextJson !== null
      ? JSON.stringify(contextJson)
      : String(contextJson);
  const t = now();
  await query(
    `INSERT INTO astradio_user_transit_context (user_id, context_json, fingerprint, updated_at)
     VALUES ($1, $2::jsonb, $3, $4::timestamptz)
     ON CONFLICT (user_id) DO UPDATE SET
       context_json = EXCLUDED.context_json,
       fingerprint = EXCLUDED.fingerprint,
       updated_at = EXCLUDED.updated_at`,
    [userId, ctx, fingerprint, t]
  );
  return getUserTransitContext(userId);
}

function rowToCampaignDailyState(row) {
  if (!row) return undefined;
  return {
    campaignId: row.campaign_id,
    calendarDate: row.calendar_date,
    engineVersion: row.engine_version,
    mode: row.mode,
    anchorUserId: row.anchor_user_id,
    transitContextJson: row.transit_context_json,
    transitContextFingerprint: row.transit_context_fingerprint,
    dailyStateJson: row.daily_state_json,
    dailyStateHash: row.daily_state_hash,
    derivationInputsFingerprint: row.derivation_inputs_fingerprint,
    createdAt: row.created_at,
  };
}

async function getCampaignDailyState(campaignId, calendarDate, engineVersion) {
  const row = await getRow(
    `SELECT campaign_id, calendar_date, engine_version, mode, anchor_user_id,
            transit_context_json, transit_context_fingerprint, daily_state_json,
            daily_state_hash, derivation_inputs_fingerprint, created_at
     FROM campaign_daily_state
     WHERE campaign_id = $1 AND calendar_date = $2::date AND engine_version = $3`,
    [campaignId, calendarDate, engineVersion]
  );
  return rowToCampaignDailyState(row);
}

async function insertCampaignDailyStateIfMissing(input) {
  const {
    campaignId,
    calendarDate,
    engineVersion,
    mode,
    anchorUserId,
    transitContextJson,
    transitContextFingerprint,
    dailyStateJson,
    dailyStateHash,
    derivationInputsFingerprint,
  } = input;
  const tc =
    typeof transitContextJson === 'object' && transitContextJson !== null
      ? JSON.stringify(transitContextJson)
      : String(transitContextJson);
  const dj =
    typeof dailyStateJson === 'object' && dailyStateJson !== null
      ? JSON.stringify(dailyStateJson)
      : String(dailyStateJson);
  const t = now();
  const ins = await query(
    `INSERT INTO campaign_daily_state (
       campaign_id, calendar_date, engine_version, mode, anchor_user_id,
       transit_context_json, transit_context_fingerprint, daily_state_json,
       daily_state_hash, derivation_inputs_fingerprint, created_at
     )
     VALUES ($1, $2::date, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9, $10, $11::timestamptz)
     ON CONFLICT (campaign_id, calendar_date, engine_version) DO NOTHING
     RETURNING campaign_id`,
    [
      campaignId,
      calendarDate,
      engineVersion,
      mode,
      anchorUserId || null,
      tc,
      transitContextFingerprint,
      dj,
      dailyStateHash,
      derivationInputsFingerprint,
      t,
    ]
  );
  const inserted = (ins.rowCount || 0) > 0;
  const row = await getCampaignDailyState(campaignId, calendarDate, engineVersion);
  return { inserted, row };
}

// ---- Exports ----
async function createExportJob(input) {
  const id = input.id || nanoid();
  const filePath = input.storageKey != null ? input.storageKey : input.filePath;
  const storageKey = input.storageKey || null;
  const exportMetaJson = input.exportMeta ? JSON.stringify(input.exportMeta) : null;
  try {
    await query(
      `INSERT INTO astradio_export_jobs (id, request_id, user_id, plan_hash, chart_hash, file_path, content_type, size_bytes, storage_key, export_meta, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.requestId,
        input.userId || null,
        input.planHash || null,
        input.chartHash || null,
        filePath || '',
        input.contentType || 'audio/wav',
        input.sizeBytes || null,
        storageKey,
        exportMetaJson,
        now(),
      ]
    );
  } catch (e) {
    if (e.code === '42703' || (e.message && e.message.includes('storage_key'))) {
      await query(
        `INSERT INTO astradio_export_jobs (id, request_id, user_id, plan_hash, chart_hash, file_path, content_type, size_bytes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id,
          input.requestId,
          input.userId || null,
          input.planHash || null,
          input.chartHash || null,
          filePath || '',
          input.contentType || 'audio/wav',
          input.sizeBytes || null,
          now(),
        ]
      );
    } else {
      throw e;
    }
  }
  return getExportJob(id);
}

async function getExportJob(id) {
  let row;
  try {
    row = await getRow(
      'SELECT id, request_id, user_id, plan_hash, chart_hash, file_path, content_type, size_bytes, storage_key, export_meta, created_at FROM astradio_export_jobs WHERE id = $1',
      [id]
    );
  } catch (e) {
    if (e.code === '42703') {
      row = await getRow(
        'SELECT id, request_id, user_id, plan_hash, chart_hash, file_path, content_type, size_bytes, created_at FROM astradio_export_jobs WHERE id = $1',
        [id]
      );
    } else throw e;
  }
  if (!row) return undefined;
  return {
    id: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    planHash: row.plan_hash,
    chartHash: row.chart_hash,
    filePath: row.file_path,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    storageKey: row.storage_key,
    exportMeta: row.export_meta,
    createdAt: row.created_at,
  };
}

/** Profile active-state cache (overlay projection JSON + canonical hash). Table may be absent before migration 007. */
async function getProfileProjectionCache(cacheKeyHash) {
  try {
    const row = await getRow(
      `SELECT response_json, object_identity_hash FROM astradio_profile_projection_cache WHERE cache_key_hash = $1`,
      [cacheKeyHash]
    );
    if (!row) return null;
    return { response_json: row.response_json, object_identity_hash: row.object_identity_hash };
  } catch (e) {
    if (e.code === '42P01') return null;
    throw e;
  }
}

async function upsertProfileProjectionCache(row) {
  const t = now();
  try {
    await query(
      `INSERT INTO astradio_profile_projection_cache
        (cache_key_hash, user_id, chart_id, projection_kind, object_identity_hash, response_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
       ON CONFLICT (cache_key_hash) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         object_identity_hash = EXCLUDED.object_identity_hash,
         response_json = EXCLUDED.response_json,
         updated_at = EXCLUDED.updated_at`,
      [
        row.cache_key_hash,
        row.user_id,
        row.chart_id,
        row.projection_kind,
        row.object_identity_hash,
        JSON.stringify(row.response_json),
        t,
      ]
    );
  } catch (e) {
    if (e.code === '42P01') return;
    throw e;
  }
}

module.exports = {
  DEFAULT_PROFILE_CHART_ID,
  MATCH_CANDIDATE_SPECS,
  normalizeLoginEmail,
  createRegisteredUser,
  getUserAuthForLogin,
  createUser,
  getUser,
  getUserByHandle,
  listUsers,
  listDirectoryEligibleUsers,
  listRecentDiscoverableUsers,
  updateUserDiscoverability,
  setUserPrimaryChart,
  getUserPrimaryChart,
  updateChartBirthFields,
  setChartIdentityExportId,
  createChart,
  createNonPlatformChart,
  deleteChart,
  getChart,
  listChartsByOwner,
  createComparison,
  getComparison,
  listComparisonsByUser,
  ensureDefaultProfileChart,
  ensureMatchCandidateCharts,
  createGroup,
  getGroup,
  getGroupBySlug,
  listGroups,
  createMembership,
  getMembership,
  getMembershipsByGroup,
  getMembershipsByUser,
  isMember,
  createPost,
  getPost,
  listPostsByGroup,
  createComment,
  getComment,
  listCommentsByPost,
  createReport,
  listReports,
  createLike,
  getLike,
  listLikesForItem,
  createConnectionIntent,
  getConnectionIntent,
  listPendingIncomingConnectionIntents,
  listPendingOutgoingConnectionIntents,
  declineConnectionIntent,
  cancelConnectionIntent,
  acceptConnectionIntent,
  listSignalsForRecipient,
  reactToSignal,
  findRelationshipByOwnerAndCharts,
  listRelationshipsByParticipant,
  userParticipatesInRelationship,
  findRelationshipByOwnerChartsAndLabel,
  findAcceptedIntentRelationshipKind,
  updateRelationshipsComparisonIdForPair,
  updateComparisonExportJobIfEmpty,
  updateCompositeArtifactReadingSnapshot,
  ensureCommunityRelationshipLibraryEntriesForParticipants,
  ensureCommunityGroupLibraryEntriesForMembers,
  ensureCommunityRelationalWeatherLibraryEntriesForParticipants,
  ensureCommunityRelationalWeatherLibraryEntryForUser,
  repairCommunityRelationalWeatherLibraryComposition,
  getCommunityRelationalWeatherDailyArtifactById,
  resolveDailyArtifactForLibraryRepair,
  getSandboxCompositionByIdForOwner,
  normalizeChartIdsOrdered,
  hashChartIdsOrdered,
  canonicalDayBucketFromTransitTs,
  lockCommunityRelationalWeatherIdentity,
  getCommunityRelationalWeatherDailyArtifactByIdentity,
  insertCommunityRelationalWeatherDailyArtifact,
  updateCommunityRelationalWeatherDailyArtifact,
  getCommunityRelationalWeatherStatusesForFeed,
  createRelationalGroupInvite,
  listPendingRelationalGroupInvitesForInvitee,
  acceptRelationalGroupInvite,
  assertRelationalGroupMemberOwnershipConsistency,
  ensureDevUser,
  createExportJob,
  getExportJob,
  upsertChartVector,
  getChartVector,
  getChartVectorsByIds,
  getExportJobIdsForComparisonIds,
  getGroupCompositeRowsForGroupOwnerPairs,
  createRelationalGroup,
  listRelationalGroupsByOwner,
  getRelationalGroupById,
  updateRelationalGroup,
  deleteRelationalGroup,
  addRelationalGroupMember,
  removeRelationalGroupMember,
  listRelationalGroupMembers,
  userHasRelationalGroupScopeAccess,
  listRelationalGroupMembersForScope,
  listRelationalGroupsAccessibleToUser,
  resolveRelationalGroupForScope,
  createRelationship,
  listRelationshipsByOwner,
  getRelationshipById,
  deleteRelationshipById,
  createCompositeArtifact,
  getCompositeArtifactByHash,
  getCompositeArtifactById,
  listCompositeArtifactsByBinding,
  createStage5Campaign,
  getStage5CampaignById,
  getStage5CampaignByContextKey,
  listStage5CampaignsByOwnerOrParticipant,
  updateStage5CampaignState,
  canonicalSortIds,
  getUserTransitContext,
  upsertUserTransitContext,
  getCampaignDailyState,
  insertCampaignDailyStateIfMissing,
  getProfileProjectionCache,
  upsertProfileProjectionCache,
  withTransaction,
};
