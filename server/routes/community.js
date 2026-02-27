/**
 * Phase 3A — Community API: groups, posts, comments, report, group profile.
 * Light guardrails: length limits, minimal blocklist, rate limit. No compose/music/gates.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../../lib/community-store');
const path = require('path');
const { optionalRequire } = require('../../lib/opt/optional');

const vnextRoot = path.join(__dirname, '..', '..', 'dist', 'vnext', 'vnext');
const communityGroupsMod = optionalRequire(path.join(vnextRoot, 'api', 'community-groups'));

// --- Guardrails ---
const TITLE_MAX = 200;
const BODY_MAX = 5000;
const REPORT_BODY_MAX = 500;
const BLOCKLIST = (process.env.COMMUNITY_BLOCKLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const BLOCKLIST_WORDS = BLOCKLIST.length ? BLOCKLIST : []; // set COMMUNITY_BLOCKLIST env (comma-separated) to block words

function containsBlocked(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return BLOCKLIST_WORDS.some(word => word && lower.includes(word));
}

function validatePostBody(body) {
  const title = (body.title != null ? String(body.title) : '').trim();
  const bodyText = (body.body != null ? String(body.body) : '').trim();
  if (title.length > TITLE_MAX) return { error: `Title max ${TITLE_MAX} characters` };
  if (bodyText.length > BODY_MAX) return { error: `Body max ${BODY_MAX} characters` };
  if (containsBlocked(title) || containsBlocked(bodyText)) return { error: 'Content not allowed' };
  return { title, body: bodyText };
}

function validateCommentBody(body) {
  const bodyText = (body.body != null ? String(body.body) : '').trim();
  if (bodyText.length > BODY_MAX) return { error: `Body max ${BODY_MAX} characters` };
  if (containsBlocked(bodyText)) return { error: 'Content not allowed' };
  return { body: bodyText };
}

// Rate limit for posting/commenting (reuse pattern)
const communityPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many posts or comments; try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

async function resolveGroup(slugOrId) {
  if (slugOrId && slugOrId.startsWith('grp_')) return store.getGroup(slugOrId);
  return store.getGroupBySlug(slugOrId);
}

async function getDevUserId(req) {
  const u = await store.ensureDevUser();
  return u.id;
}

const router = express.Router({ mergeParams: true });

// GET /api/community/feed — posts from groups user has joined. Deterministic: created_at DESC, id ASC tie-break.
router.get('/community/feed', async (req, res) => {
  try {
    const userId = (req.query.userId && String(req.query.userId).trim()) || (await getDevUserId(req));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const userMemberships = await store.getMembershipsByUser(userId);
    const groupIds = userMemberships.map((m) => m.groupId);
    const allPosts = [];
    for (const gid of groupIds) {
      const posts = await store.listPostsByGroup(gid, { limit: 200 });
      allPosts.push(...posts);
    }
    // Deterministic sort: created_at DESC, then id ASC
    allPosts.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (tb !== ta) return tb - ta;
      return (a.id || '').localeCompare(b.id || '');
    });
    const slice = allPosts.slice(0, limit);
    const postsWithMeta = await Promise.all(slice.map(async (p) => {
      const group = await store.getGroup(p.groupId);
      const author = await store.getUser(p.userId);
      const likes = await store.listLikesForItem('post', p.id);
      return {
        ...p,
        group: group ? { id: group.id, slug: group.slug, name: group.name } : null,
        author: author ? { id: author.id, handle: author.handle, displayName: author.displayName } : null,
        likeCount: likes.length,
      };
    }));
    return res.json({ posts: postsWithMeta });
  } catch (e) {
    console.error('[community] GET /community/feed', e);
    return res.status(500).json({ error: e?.message || 'Failed to load feed' });
  }
});

// POST /api/community/post — create post (body: groupId, userId?, title, body)
router.post('/community/post', communityPostLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const { groupId, userId: bodyUserId, title, body: bodyText } = body;
    if (!groupId) return res.status(400).json({ error: 'groupId required' });
    let group = await store.getGroup(groupId);
    if (!group && !groupId.startsWith('grp_')) group = await resolveGroup(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const validated = validatePostBody({ title, body: bodyText });
    if (validated.error) return res.status(400).json({ error: validated.error });
    const userId = (bodyUserId && String(bodyUserId).trim()) || (await getDevUserId(req));
    const post = await store.createPost({
      groupId: group.id,
      userId,
      title: validated.title,
      body: validated.body,
    });
    return res.status(201).json(post);
  } catch (e) {
    console.error('[community] POST /community/post', e);
    return res.status(500).json({ error: e?.message || 'Failed to create post' });
  }
});

// POST /api/community/like/:itemId — add like (body: itemType: post|comment|chart, userId?)
router.post('/community/like/:itemId', communityPostLimiter, async (req, res) => {
  try {
    const itemId = req.params.itemId;
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    const body = req.body || {};
    const itemType = (body.itemType && ['post', 'comment', 'chart'].includes(body.itemType)) ? body.itemType : 'post';
    const userId = (body.userId && String(body.userId).trim()) || (await getDevUserId(req));
    const like = await store.createLike({ userId, itemType, itemId });
    if (!like) return res.status(200).json({ liked: true, already: true });
    return res.status(201).json({ liked: true, like });
  } catch (e) {
    console.error('[community] POST /community/like/:itemId', e);
    return res.status(500).json({ error: e?.message || 'Failed to like' });
  }
});

// --- Content guidance (static banner text; not an endpoint) ---
router.get('/community/guidance', (req, res) => {
  res.json({
    banner: 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.'
  });
});

// GET /api/community/groups
router.get('/community/groups', async (req, res) => {
  try {
    const tag = req.query.tag;
    const q = req.query.q;
    const list = await store.listGroups({ tag, q });
    const groups = await Promise.all(list.map(async (g) => ({
      ...g,
      memberCount: (await store.getMembershipsByGroup(g.id)).length
    })));
    return res.json({ groups });
  } catch (e) {
    console.error('[community] GET /community/groups', e);
    return res.status(500).json({ error: e.message || 'Failed to list groups' });
  }
});

// POST /api/community/groups
router.post('/community/groups', async (req, res) => {
  try {
    const { slug, name, description, tags } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const userId = (await getDevUserId(req));
    const group = await store.createGroup({
      slug: (slug && String(slug).trim()) || null,
      name: String(name).trim(),
      description: (description && String(description).trim()) || '',
      tags: Array.isArray(tags) ? tags : []
    });
    await store.createMembership({ groupId: group.id, userId, role: 'mod' });
    return res.status(201).json(group);
  } catch (e) {
    console.error('[community] POST /community/groups', e);
    return res.status(500).json({ error: e.message || 'Failed to create group' });
  }
});

// GET /api/community/groups/:slugOrId
router.get('/community/groups/:slugOrId', async (req, res) => {
  try {
    const slugOrId = req.params.slugOrId;
    const group = await resolveGroup(slugOrId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const members = await store.getMembershipsByGroup(group.id);
    return res.json({ ...group, memberCount: members.length });
  } catch (e) {
    console.error('[community] GET /community/groups/:slugOrId', e);
    return res.status(500).json({ error: e.message || 'Failed to get group' });
  }
});

// POST /api/community/groups/:groupId/join
router.post('/community/groups/:groupId/join', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    let group = await store.getGroup(groupId);
    if (!group && !groupId.startsWith('grp_')) group = await resolveGroup(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const userId = (req.body && req.body.userId) || (await getDevUserId(req));
    const chartId = req.body && req.body.chartId;
    if (await store.isMember(group.id, userId)) return res.status(200).json({ joined: true, already: true });
    const membership = await store.createMembership({ groupId: group.id, userId, role: 'member', chartId });
    return res.status(201).json({ joined: true, membership });
  } catch (e) {
    console.error('[community] POST /community/groups/:groupId/join', e);
    return res.status(500).json({ error: e.message || 'Failed to join' });
  }
});

// GET /api/community/groups/:groupId/members — paginated, minimal fields, no compat scores
router.get('/community/groups/:groupId/members', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    let group = await store.getGroup(groupId);
    if (!group) group = await resolveGroup(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(rawLimit) ? 25 : Math.min(50, Math.max(1, rawLimit));
    const offset = Math.max(0, parseInt(req.query.cursor, 10) || 0);
    const memberships = await store.getMembershipsByGroup(group.id);
    const slice = memberships.slice(offset, offset + limit);
    const members = await Promise.all(slice.map(async (m) => {
      const u = await store.getUser(m.userId);
      return {
        userId: m.userId,
        handle: u?.handle || m.userId,
        displayName: u?.displayName || u?.handle || m.userId,
        chartId: m.chartId || undefined
      };
    }));
    const nextCursor = offset + slice.length < memberships.length ? String(offset + limit) : undefined;
    return res.json({ members, nextCursor });
  } catch (e) {
    console.error('[community] GET /community/groups/:groupId/members', e);
    return res.status(500).json({ error: e?.message || 'Failed to list members' });
  }
});

// GET /api/community/groups/:groupId/posts
router.get('/community/groups/:groupId/posts', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    let group = await store.getGroup(groupId);
    if (!group) group = await resolveGroup(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const posts = await store.listPostsByGroup(group.id, { limit });
    return res.json({ posts });
  } catch (e) {
    console.error('[community] GET /community/groups/:groupId/posts', e);
    return res.status(500).json({ error: e.message || 'Failed to list posts' });
  }
});

// POST /api/community/groups/:groupId/posts (rate limited)
router.post('/community/groups/:groupId/posts', communityPostLimiter, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    let group = await store.getGroup(groupId);
    if (!group) group = await resolveGroup(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const userId = await getDevUserId(req);
    const validated = validatePostBody(req.body || {});
    if (validated.error) return res.status(400).json({ error: validated.error });
    const post = await store.createPost({
      groupId: group.id,
      userId,
      title: validated.title,
      body: validated.body
    });
    return res.status(201).json(post);
  } catch (e) {
    console.error('[community] POST /community/groups/:groupId/posts', e);
    return res.status(500).json({ error: e.message || 'Failed to create post' });
  }
});

// GET /api/community/posts/:postId
router.get('/community/posts/:postId', async (req, res) => {
  try {
    const post = await store.getPost(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const group = await store.getGroup(post.groupId);
    const author = await store.getUser(post.userId);
    const commentList = await store.listCommentsByPost(post.id);
    return res.json({
      ...post,
      group: group ? { id: group.id, slug: group.slug, name: group.name } : null,
      author: author ? { id: author.id, handle: author.handle, displayName: author.displayName } : null,
      comments: commentList
    });
  } catch (e) {
    console.error('[community] GET /community/posts/:postId', e);
    return res.status(500).json({ error: e.message || 'Failed to get post' });
  }
});

// POST /api/community/posts/:postId/comments (rate limited)
router.post('/community/posts/:postId/comments', communityPostLimiter, async (req, res) => {
  try {
    const post = await store.getPost(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const validated = validateCommentBody(req.body || {});
    if (validated.error) return res.status(400).json({ error: validated.error });
    const userId = await getDevUserId(req);
    const comment = await store.createComment({ postId: post.id, userId, body: validated.body });
    return res.status(201).json(comment);
  } catch (e) {
    console.error('[community] POST /community/posts/:postId/comments', e);
    return res.status(500).json({ error: e.message || 'Failed to create comment' });
  }
});

// POST /api/community/groups/:groupId/profile — reuse GroupProfile (no compose/music/gates)
router.post('/community/groups/:groupId/profile', async (req, res) => {
  try {
    const groupId = req.params.groupId;
    let group = await store.getGroup(groupId);
    if (!group) group = await resolveGroup(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const memberships = await store.getMembershipsByGroup(group.id);
    const chartIds = memberships.map(m => m.chartId).filter(Boolean);
    if (!chartIds.length) {
      return res.status(400).json({ error: 'No member charts; add chartId when joining to compute group profile' });
    }
    if (!communityGroupsMod || !communityGroupsMod.createGroupProfile) {
      return res.status(503).json({ error: 'Group profile service unavailable' });
    }
    const result = await communityGroupsMod.createGroupProfile({
      groupId: group.id,
      chartIds,
      aggregationMode: 'mean_normalized'
    });
    const out = { ...result, featuresAgg: Array.from(result.featuresAgg || []) };
    return res.status(200).json(out);
  } catch (e) {
    console.error('[community] POST /community/groups/:groupId/profile', e);
    return res.status(500).json({ error: e.message || 'Failed to compute group profile' });
  }
});

// POST /api/community/report
router.post('/community/report', async (req, res) => {
  try {
    const body = req.body || {};
    const targetType = body.targetType;
    const targetId = body.targetId;
    const reason = body.reason;
    const note = (body.note != null ? String(body.note) : '').trim();
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'targetType, targetId, and reason required' });
    }
    if (note.length > REPORT_BODY_MAX) return res.status(400).json({ error: `note max ${REPORT_BODY_MAX} characters` });
    const report = await store.createReport({ targetType, targetId, reason, note: note || null });
    return res.status(201).json({ id: report.id, createdAt: report.createdAt });
  } catch (e) {
    console.error('[community] POST /community/report', e);
    return res.status(500).json({ error: e.message || 'Failed to create report' });
  }
});

module.exports = { communityRouter: router, COMMUNITY_GUIDANCE_BANNER: 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.' };
