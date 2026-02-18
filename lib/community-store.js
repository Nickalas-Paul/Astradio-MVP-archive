/**
 * Phase 3A — minimal in-memory community persistence.
 * User, Chart (compat-shaped), Group, Membership, Post, Comment, Report.
 * No DMs, no follower graph. Public groups by default.
 * Can be swapped for Postgres later (lib/database.js).
 */

const crypto = require('crypto');
const nanoid = () => crypto.randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

const users = new Map();
const charts = new Map();
const groups = new Map();
const memberships = new Map();
const posts = new Map();
const comments = new Map();
const reports = new Map();

// ---- User ----
function createUser({ handle, displayName }) {
  const id = `usr_${nanoid()}`;
  const user = { id, handle: handle || id, displayName: displayName || 'User', createdAt: now() };
  users.set(id, user);
  return user;
}
function getUser(id) { return users.get(id); }
function getUserByHandle(handle) { return [...users.values()].find(u => u.handle === handle); }
function listUsers() { return [...users.values()]; }

// ---- Chart (compat shape + tz) ----
function createChart({ ownerId, label, date, time, lat, lon, tz }) {
  const id = `chart_${nanoid()}`;
  const chart = { id, ownerId, label, date, time, lat, lon, tz: tz || null, createdAt: now() };
  charts.set(id, chart);
  return chart;
}
function getChart(id) { return charts.get(id); }
function listChartsByOwner(ownerId) { return [...charts.values()].filter(c => c.ownerId === ownerId); }

// ---- Group ----
function createGroup({ slug, name, description, tags }) {
  const id = `grp_${nanoid()}`;
  const group = {
    id,
    slug: slug || id,
    name: name || 'Unnamed',
    description: description || '',
    tags: Array.isArray(tags) ? tags : [],
    visibility: 'public',
    createdAt: now()
  };
  groups.set(id, group);
  return group;
}
function getGroup(id) { return groups.get(id); }
function getGroupBySlug(slug) { return [...groups.values()].find(g => g.slug === slug); }
function listGroups({ tag, q } = {}) {
  let list = [...groups.values()];
  if (tag) list = list.filter(g => g.tags && g.tags.includes(tag));
  if (q && q.trim()) {
    const lower = q.trim().toLowerCase();
    list = list.filter(g =>
      (g.name && g.name.toLowerCase().includes(lower)) ||
      (g.description && g.description.toLowerCase().includes(lower)) ||
      (g.tags && g.tags.some(t => t.toLowerCase().includes(lower)))
    );
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ---- Membership ----
function createMembership({ groupId, userId, role, chartId }) {
  const id = `mem_${nanoid()}`;
  const membership = { id, groupId, userId, role: role || 'member', chartId: chartId || null, createdAt: now() };
  memberships.set(id, membership);
  return membership;
}
function getMembership(id) { return memberships.get(id); }
function getMembershipsByGroup(groupId) {
  return [...memberships.values()].filter(m => m.groupId === groupId).sort((a, b) => a.id.localeCompare(b.id));
}
function getMembershipsByUser(userId) { return [...memberships.values()].filter(m => m.userId === userId); }
function isMember(groupId, userId) { return [...memberships.values()].some(m => m.groupId === groupId && m.userId === userId); }

// ---- Post ----
function createPost({ groupId, userId, title, body }) {
  const id = `post_${nanoid()}`;
  const post = { id, groupId, userId, title: title || '', body: body || '', createdAt: now() };
  posts.set(id, post);
  return post;
}
function getPost(id) { return posts.get(id); }
function listPostsByGroup(groupId, { limit = 50 } = {}) {
  return [...posts.values()]
    .filter(p => p.groupId === groupId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// ---- Comment ----
function createComment({ postId, userId, body }) {
  const id = `com_${nanoid()}`;
  const comment = { id, postId, userId, body: body || '', createdAt: now() };
  comments.set(id, comment);
  return comment;
}
function getComment(id) { return comments.get(id); }
function listCommentsByPost(postId) {
  return [...comments.values()]
    .filter(c => c.postId === postId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// ---- Report ----
function createReport({ targetType, targetId, reason, note }) {
  const id = `rpt_${nanoid()}`;
  const report = { id, targetType, targetId, reason, note: note || null, createdAt: now() };
  reports.set(id, report);
  return report;
}
function listReports() { return [...reports.values()]; }

// ---- Seed one dev user for Phase 3A (stubbed auth) ----
function ensureDevUser() {
  let u = getUserByHandle('@dev');
  if (!u) {
    u = createUser({ handle: '@dev', displayName: 'Dev User' });
  }
  return u;
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
  ensureDevUser
};
