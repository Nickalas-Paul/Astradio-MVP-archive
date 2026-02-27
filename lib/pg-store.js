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

// ---- Users ----
async function createUser(input) {
  const id = input.id || `usr_${nanoid()}`;
  const handle = input.handle != null ? input.handle : id;
  await query(
    `INSERT INTO astradio_users (id, handle, display_name, email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [id, handle, input.displayName || 'User', input.email || null, now()]
  );
  return { id, handle, displayName: input.displayName || 'User', email: input.email, createdAt: now(), updatedAt: now() };
}

async function getUser(id) {
  const row = await getRow('SELECT id, handle, display_name, email, created_at, updated_at FROM astradio_users WHERE id = $1', [id]);
  if (!row) return undefined;
  return rowToUser(row);
}

async function getUserByHandle(handle) {
  const row = await getRow('SELECT id, handle, display_name, email, created_at, updated_at FROM astradio_users WHERE handle = $1', [handle]);
  if (!row) return undefined;
  return rowToUser(row);
}

async function listUsers() {
  const rows = await getRows('SELECT id, handle, display_name, email, created_at, updated_at FROM astradio_users ORDER BY created_at');
  return rows.map(rowToUser);
}

function rowToUser(row) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

// ---- Dev user (community) ----
async function ensureDevUser() {
  let u = await getUserByHandle('@dev');
  if (!u) {
    u = await createUser({ handle: '@dev', displayName: 'Dev User' });
  }
  return u;
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
  setUserPrimaryChart,
  getUserPrimaryChart,
  createChart,
  getChart,
  listChartsByOwner,
  createComparison,
  getComparison,
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
  ensureDevUser,
  createExportJob,
  getExportJob,
  upsertChartVector,
  getChartVector,
  getChartVectorsByIds,
};
