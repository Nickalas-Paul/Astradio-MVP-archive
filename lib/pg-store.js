/**
 * Durable storage for Astradio: compat (users, charts, comparisons) + community + exports.
 * Same service method names as in-memory layer; all async.
 * Requires POSTGRES_URL and lib/database (pool).
 */

const crypto = require('crypto');
const path = require('path');

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

async function getRow(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
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

// ---- Users ----
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
      input.timezone || null,
      input.snapshotHash || null,
      now(),
    ]
  );
  return rowToChart({ id, owner_id: input.ownerId, label: input.label, date: input.date, time: input.time, lat: input.lat, lon: input.lon, timezone: input.timezone, snapshot_hash: input.snapshotHash, created_at: now(), updated_at: now() });
}

/** Phase 5 — Create non-platform chart (family/friends not on platform). is_non_platform=true. */
async function createNonPlatformChart(input) {
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
      input.timezone || null,
      input.snapshotHash || null,
      now(),
    ]
  );
  const row = { id, owner_id: input.ownerId, label: input.label, date: input.date, time: input.time, lat: input.lat, lon: input.lon, timezone: input.timezone, snapshot_hash: input.snapshotHash, is_non_platform: true, created_at: now(), updated_at: now() };
  return { ...rowToChart(row), isNonPlatform: true };
}

/** Phase 5 — Delete chart (for rollback on vectorization failure). */
async function deleteChart(chartId) {
  const res = await query('DELETE FROM astradio_charts WHERE id = $1', [chartId]);
  return (res.rowCount || 0) > 0;
}

async function getChart(id) {
  const row = await getRow(
    'SELECT id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, created_at, updated_at FROM astradio_charts WHERE id = $1',
    [id]
  );
  if (!row) return undefined;
  return rowToChart(row);
}

async function listChartsByOwner(ownerId) {
  const rows = await getRows(
    'SELECT id, owner_id, label, date, time, lat, lon, timezone, snapshot_hash, created_at, updated_at FROM astradio_charts WHERE owner_id = $1 ORDER BY created_at',
    [ownerId]
  );
  return rows.map(rowToChart);
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Comparisons ----
async function createComparison(input) {
  const id = `cmp_${nanoid()}`;
  await query(
    `INSERT INTO astradio_comparisons (id, chart_a_id, chart_b_id, relationship_mode, fusion_method, fusion_params, merged_feature_vector64, merged_feature_hash, compatibility_text, plan_hash, composition_id, export_job_id, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      input.chartAId,
      input.chartBId,
      input.relationshipMode,
      input.fusionMethod,
      JSON.stringify(input.fusionParams || {}),
      JSON.stringify(input.mergedFeatureVector64 || []),
      input.mergedFeatureHash || null,
      JSON.stringify(input.compatibilityText || {}),
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

async function listComparisonsByUser(userId) {
  const rows = await getRows(
    'SELECT * FROM astradio_comparisons WHERE created_by = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(rowToComparison);
}

function rowToComparison(row) {
  return {
    id: row.id,
    chartAId: row.chart_a_id,
    chartBId: row.chart_b_id,
    relationshipMode: row.relationship_mode,
    fusionMethod: row.fusion_method,
    fusionParams: row.fusion_params,
    mergedFeatureVector64: row.merged_feature_vector64 || [],
    mergedFeatureHash: row.merged_feature_hash,
    compatibilityText: row.compatibility_text,
    planHash: row.plan_hash,
    compositionId: row.composition_id,
    exportJobId: row.export_job_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
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
async function createConnectionIntent(input) {
  const id = `int_${nanoid()}`;
  await query(
    `INSERT INTO astradio_connection_intents (id, from_user_id, to_user_id, chart_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.fromUserId, input.toUserId, input.chartId || null, input.status || 'pending', now()]
  );
  return { id, fromUserId: input.fromUserId, toUserId: input.toUserId, chartId: input.chartId || null, status: input.status || 'pending', createdAt: now() };
}

async function getConnectionIntent(id) {
  const row = await getRow('SELECT id, from_user_id, to_user_id, chart_id, status, created_at FROM astradio_connection_intents WHERE id = $1', [id]);
  return row ? { id: row.id, fromUserId: row.from_user_id, toUserId: row.to_user_id, chartId: row.chart_id, status: row.status, createdAt: row.created_at } : undefined;
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

async function createRelationship(input) {
  const id = `rel_${nanoid()}`;
  const [low, high] = canonicalPair(input.chartAId, input.chartBId);
  const t = now();
  const row = await getRow(
    `INSERT INTO astradio_relationships
      (id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     ON CONFLICT (owner_user_id, chart_id_low, chart_id_high, label)
     DO UPDATE SET updated_at = EXCLUDED.updated_at
     RETURNING id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at`,
    [id, input.ownerUserId, low, high, input.label, input.comparisonId || null, t]
  );
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

async function getRelationshipById(id) {
  const row = await getRow(
    `SELECT id, owner_user_id, chart_id_low, chart_id_high, label, comparison_id, created_at, updated_at
     FROM astradio_relationships WHERE id = $1`,
    [id]
  );
  if (!row) return undefined;
  return rowToRelationship(row);
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
  };
}

async function createCompositeArtifact(input) {
  const id = `cpa_${nanoid()}`;
  const row = await getRow(
    `INSERT INTO astradio_composite_artifacts
      (id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13)
     RETURNING id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at`,
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
    ]
  );
  return rowToCompositeArtifact(row);
}

async function getCompositeArtifactByHash(ownerUserId, kind, artifactHash) {
  const row = await getRow(
    `SELECT id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at
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
    `SELECT id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at
     FROM astradio_composite_artifacts WHERE id = $1`,
    [id]
  );
  if (!row) return undefined;
  return rowToCompositeArtifact(row);
}

async function listCompositeArtifactsByBinding(input) {
  const rows = await getRows(
    `SELECT id, owner_user_id, kind, relationship_id, group_id, chart_ids, vector_hashes, seed, algorithm_version, plan_hash, composition_id, artifact_hash, created_at
     FROM astradio_composite_artifacts
     WHERE owner_user_id = $1
       AND kind = $2
       AND (($2 = 'pair' AND relationship_id = $3) OR ($2 = 'group' AND group_id = $4))
     ORDER BY algorithm_version DESC, created_at DESC`,
    [input.ownerUserId, input.kind, input.relationshipId || null, input.groupId || null]
  );
  return rows.map(rowToCompositeArtifact);
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

module.exports = {
  DEFAULT_PROFILE_CHART_ID,
  MATCH_CANDIDATE_SPECS,
  createUser,
  getUser,
  getUserByHandle,
  listUsers,
  listDirectoryEligibleUsers,
  listRecentDiscoverableUsers,
  updateUserDiscoverability,
  setUserPrimaryChart,
  getUserPrimaryChart,
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
  ensureDevUser,
  createExportJob,
  getExportJob,
  upsertChartVector,
  getChartVector,
  getChartVectorsByIds,
  createRelationalGroup,
  listRelationalGroupsByOwner,
  getRelationalGroupById,
  updateRelationalGroup,
  deleteRelationalGroup,
  addRelationalGroupMember,
  removeRelationalGroupMember,
  listRelationalGroupMembers,
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
};
