/**
 * Phase 3A — community persistence.
 * When POSTGRES_URL is set, delegates to lib/pg-store (durable). Otherwise in-memory (lost on restart).
 * All exported functions are async for a consistent API.
 */

const crypto = require('crypto');
const path = require('path');

const nanoid = () => crypto.randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

let pgStore = null;
try {
  if (process.env.POSTGRES_URL) {
    pgStore = require('./pg-store');
  }
} catch (e) {
  // pg-store not available or DB not configured
}

// ---- In-memory fallback ----
const users = new Map();
const charts = new Map();
const groups = new Map();
const memberships = new Map();
const posts = new Map();
const comments = new Map();
const reports = new Map();
const likes = new Map(); // key: `${userId}:${itemType}:${itemId}`

function createUserMem({ handle, displayName }) {
  const id = `usr_${nanoid()}`;
  const user = { id, handle: handle || id, displayName: displayName || 'User', createdAt: now() };
  users.set(id, user);
  return user;
}
function getUserMem(id) { return users.get(id); }
function getUserByHandleMem(handle) { return [...users.values()].find(u => u.handle === handle); }
function listUsersMem() { return [...users.values()]; }

const { resolveChartTimezoneForChartInsert } = require('./chart-timezone-resolve');

function createChartMem(input) {
  const { ownerId, label, date, time, lat, lon, tz, timezone, snapshotHash } = input;
  const resolved = resolveChartTimezoneForChartInsert({ timezone, tz, lat, lon });
  const id = `chart_${nanoid()}`;
  const chart = {
    id,
    ownerId,
    label,
    date,
    time,
    lat,
    lon,
    timezone: resolved,
    tz: resolved,
    snapshotHash,
    createdAt: now(),
  };
  charts.set(id, chart);
  return chart;
}
function getChartMem(id) { return charts.get(id); }
function listChartsByOwnerMem(ownerId) { return [...charts.values()].filter(c => c.ownerId === ownerId); }

function createGroupMem({ slug, name, description, tags }) {
  const id = `grp_${nanoid()}`;
  const group = { id, slug: slug || id, name: name || 'Unnamed', description: description || '', tags: Array.isArray(tags) ? tags : [], visibility: 'public', createdAt: now() };
  groups.set(id, group);
  return group;
}
function getGroupMem(id) { return groups.get(id); }
function getGroupBySlugMem(slug) { return [...groups.values()].find(g => g.slug === slug); }
function listGroupsMem(opts = {}) {
  let list = [...groups.values()];
  if (opts.tag) list = list.filter(g => g.tags && g.tags.includes(opts.tag));
  if (opts.q && opts.q.trim()) {
    const lower = opts.q.trim().toLowerCase();
    list = list.filter(g => (g.name && g.name.toLowerCase().includes(lower)) || (g.description && g.description.toLowerCase().includes(lower)) || (g.tags && g.tags.some(t => t.toLowerCase().includes(lower))));
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createMembershipMem({ groupId, userId, role, chartId }) {
  const id = `mem_${nanoid()}`;
  const m = { id, groupId, userId, role: role || 'member', chartId: chartId || null, createdAt: now() };
  memberships.set(id, m);
  return m;
}
function getMembershipMem(id) { return memberships.get(id); }
function getMembershipsByGroupMem(groupId) { return [...memberships.values()].filter(m => m.groupId === groupId).sort((a, b) => a.id.localeCompare(b.id)); }
function getMembershipsByUserMem(userId) { return [...memberships.values()].filter(m => m.userId === userId); }
function isMemberMem(groupId, userId) { return [...memberships.values()].some(m => m.groupId === groupId && m.userId === userId); }

function createPostMem({ groupId, userId, title, body }) {
  const id = `post_${nanoid()}`;
  const post = { id, groupId, userId, title: title || '', body: body || '', createdAt: now() };
  posts.set(id, post);
  return post;
}
function getPostMem(id) { return posts.get(id); }
function listPostsByGroupMem(groupId, opts = {}) {
  return [...posts.values()].filter(p => p.groupId === groupId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, opts.limit || 50);
}

function createCommentMem({ postId, userId, body }) {
  const id = `com_${nanoid()}`;
  const c = { id, postId, userId, body: body || '', createdAt: now() };
  comments.set(id, c);
  return c;
}
function getCommentMem(id) { return comments.get(id); }
function listCommentsByPostMem(postId) {
  return [...comments.values()].filter(c => c.postId === postId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function createReportMem({ targetType, targetId, reason, note }) {
  const id = `rpt_${nanoid()}`;
  const r = { id, targetType, targetId, reason, note: note || null, createdAt: now() };
  reports.set(id, r);
  return r;
}
function listReportsMem() { return [...reports.values()]; }

function createLikeMem({ userId, itemType, itemId }) {
  const key = `${userId}:${itemType}:${itemId}`;
  if (likes.has(key)) return null;
  const id = `like_${nanoid()}`;
  const like = { id, userId, itemType, itemId, createdAt: now() };
  likes.set(key, like);
  return like;
}
function getLikeMem(userId, itemType, itemId) {
  return likes.get(`${userId}:${itemType}:${itemId}`);
}
function listLikesForItemMem(itemType, itemId) {
  return [...likes.values()].filter(l => l.itemType === itemType && l.itemId === itemId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function ensureDevUserMem() {
  let u = getUserByHandleMem('@dev');
  if (!u) u = createUserMem({ handle: '@dev', displayName: 'Dev User' });
  return u;
}

// ---- Public API: async, delegate to pg-store or in-memory ----
async function createUser(input) {
  if (pgStore) return pgStore.createUser({ ...input, displayName: input.displayName || 'User' });
  return Promise.resolve(createUserMem(input));
}
async function getUser(id) {
  if (pgStore) return pgStore.getUser(id);
  return Promise.resolve(getUserMem(id));
}
async function getUserByHandle(handle) {
  if (pgStore) return pgStore.getUserByHandle(handle);
  return Promise.resolve(getUserByHandleMem(handle));
}
async function listUsers() {
  if (pgStore) return pgStore.listUsers();
  return Promise.resolve(listUsersMem());
}
async function createChart(input) {
  const merged = { ...input, timezone: input.timezone ?? input.tz };
  if (pgStore) return pgStore.createChart(merged);
  return Promise.resolve(createChartMem(merged));
}
async function getChart(id) {
  if (pgStore) { const c = await pgStore.getChart(id); return c ? { ...c, tz: c.timezone } : undefined; }
  return Promise.resolve(getChartMem(id));
}
async function listChartsByOwner(ownerId) {
  if (pgStore) { const rows = await pgStore.listChartsByOwner(ownerId); return rows.map(c => ({ ...c, tz: c.timezone })); }
  return Promise.resolve(listChartsByOwnerMem(ownerId));
}
async function createGroup(input) {
  if (pgStore) return pgStore.createGroup(input);
  return Promise.resolve(createGroupMem(input));
}
async function getGroup(id) {
  if (pgStore) return pgStore.getGroup(id);
  return Promise.resolve(getGroupMem(id));
}
async function getGroupBySlug(slug) {
  if (pgStore) return pgStore.getGroupBySlug(slug);
  return Promise.resolve(getGroupBySlugMem(slug));
}
async function listGroups(opts = {}) {
  if (pgStore) return pgStore.listGroups(opts);
  return Promise.resolve(listGroupsMem(opts));
}
async function createMembership(input) {
  if (pgStore) return pgStore.createMembership(input);
  return Promise.resolve(createMembershipMem(input));
}
async function getMembership(id) {
  if (pgStore) return pgStore.getMembership(id);
  return Promise.resolve(getMembershipMem(id));
}
async function getMembershipsByGroup(groupId) {
  if (pgStore) return pgStore.getMembershipsByGroup(groupId);
  return Promise.resolve(getMembershipsByGroupMem(groupId));
}
async function getMembershipsByUser(userId) {
  if (pgStore) return pgStore.getMembershipsByUser(userId);
  return Promise.resolve(getMembershipsByUserMem(userId));
}
async function isMember(groupId, userId) {
  if (pgStore) return pgStore.isMember(groupId, userId);
  return Promise.resolve(isMemberMem(groupId, userId));
}
async function createPost(input) {
  if (pgStore) return pgStore.createPost(input);
  return Promise.resolve(createPostMem(input));
}
async function getPost(id) {
  if (pgStore) return pgStore.getPost(id);
  return Promise.resolve(getPostMem(id));
}
async function listPostsByGroup(groupId, opts = {}) {
  if (pgStore) return pgStore.listPostsByGroup(groupId, opts);
  return Promise.resolve(listPostsByGroupMem(groupId, opts));
}
async function createComment(input) {
  if (pgStore) return pgStore.createComment(input);
  return Promise.resolve(createCommentMem(input));
}
async function getComment(id) {
  if (pgStore) return pgStore.getComment(id);
  return Promise.resolve(getCommentMem(id));
}
async function listCommentsByPost(postId) {
  if (pgStore) return pgStore.listCommentsByPost(postId);
  return Promise.resolve(listCommentsByPostMem(postId));
}
async function createReport(input) {
  if (pgStore) return pgStore.createReport(input);
  return Promise.resolve(createReportMem(input));
}
async function listReports() {
  if (pgStore) return pgStore.listReports();
  return Promise.resolve(listReportsMem());
}
async function createLike(input) {
  if (pgStore) return pgStore.createLike(input);
  return Promise.resolve(createLikeMem(input));
}
async function getLike(userId, itemType, itemId) {
  if (pgStore) return pgStore.getLike(userId, itemType, itemId);
  return Promise.resolve(getLikeMem(userId, itemType, itemId));
}
async function listLikesForItem(itemType, itemId) {
  if (pgStore) return pgStore.listLikesForItem(itemType, itemId);
  return Promise.resolve(listLikesForItemMem(itemType, itemId));
}
async function createConnectionIntent(input) {
  if (pgStore) return pgStore.createConnectionIntent(input);
  return Promise.resolve(null);
}
async function getConnectionIntent(id) {
  if (pgStore) return pgStore.getConnectionIntent(id);
  return Promise.resolve(undefined);
}
async function ensureDevUser() {
  if (pgStore) return pgStore.ensureDevUser();
  return Promise.resolve(ensureDevUserMem());
}

async function listRecentDiscoverableUsers(limit) {
  if (pgStore && typeof pgStore.listRecentDiscoverableUsers === 'function') {
    return pgStore.listRecentDiscoverableUsers(limit);
  }
  return [];
}

module.exports = {
  createUser,
  getUser,
  getUserByHandle,
  listUsers,
  createChart,
  getChart,
  listChartsByOwner,
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
  listRecentDiscoverableUsers
};
