/**
 * Community posts API — UGC feed (posts, comments, likes, threads, settings).
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { proxySecretGate } = require('../../lib/proxy-secret-gate');

let pgStore = null;
try {
  if (process.env.POSTGRES_URL) {
    pgStore = require('../../lib/pg-store');
  }
} catch (_) {
  pgStore = null;
}

const TITLE_MAX = 200;
const BODY_MAX = 5000;
const COMMENT_MAX = 2000;
const BIO_MAX = 500;

const communityPostsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function getDevUserId() {
  if (!pgStore) throw new Error('postgres_unavailable');
  const u = await pgStore.ensureDevUser();
  return u.id;
}

function queryUserId(req) {
  const q = req.query?.userId != null ? String(req.query.userId).trim() : '';
  return q || null;
}

function bodyUserId(body) {
  const b = body?.userId != null ? String(body.userId).trim() : '';
  return b || null;
}

async function resolveUserId(req, body) {
  return queryUserId(req) || bodyUserId(body || {}) || (await getDevUserId());
}

function validateLength(value, max, field) {
  const s = value != null ? String(value) : '';
  if (s.length > max) return { error: `${field}_too_long`, max };
  return null;
}

async function enrichPost(post, viewerUserId) {
  if (!post) return post;
  const [likeCount, comments, viewerLike] = await Promise.all([
    pgStore.countCommunityLikesForPost(post.id),
    pgStore.listCommunityCommentsByPost(post.id),
    viewerUserId ? pgStore.getCommunityPostLikeByUserAndPost(viewerUserId, post.id) : null,
  ]);
  return {
    ...post,
    likeCount,
    commentCount: comments.length,
    likedByViewer: !!viewerLike,
    viewerLikeId: viewerLike?.id || null,
  };
}

function createCommunityPostsRouter() {
  const router = express.Router({ mergeParams: true });
  router.use(proxySecretGate);

  router.post('/community/posts', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const titleErr = validateLength(body.title, TITLE_MAX, 'title');
      if (titleErr) return res.status(400).json(titleErr);
      const bodyErr = validateLength(body.body, BODY_MAX, 'body');
      if (bodyErr) return res.status(400).json(bodyErr);
      if (!String(body.body || '').trim() && !String(body.title || '').trim()) {
        return res.status(400).json({ error: 'title_or_body_required' });
      }
      const post = await pgStore.createCommunityPost({
        userId,
        title: body.title || '',
        body: body.body || '',
      });
      let feedService = null;
      try {
        feedService = require('../../lib/community-feed-service');
      } catch (_) {
        feedService = null;
      }
      if (feedService?.onPostCreated) {
        await feedService.onPostCreated(post);
      }
      return res.status(201).json(await enrichPost(post, userId));
    } catch (e) {
      console.error('[community-posts] POST /community/posts', e);
      return res.status(500).json({ error: e?.message || 'create_post_failed' });
    }
  });

  router.get('/community/posts/:id', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const postId = String(req.params.id || '').trim();
      const post = await pgStore.getCommunityPost(postId);
      if (!post) return res.status(404).json({ error: 'post_not_found' });
      const viewerUserId = queryUserId(req);
      const settings = await pgStore.getCommunityUserSettings(post.userId);
      if (!settings.publicVisibility && post.userId !== viewerUserId) {
        return res.status(404).json({ error: 'post_not_found' });
      }
      const comments = await pgStore.listCommunityCommentsByPost(postId);
      return res.status(200).json({
        ...(await enrichPost(post, viewerUserId)),
        comments,
      });
    } catch (e) {
      console.error('[community-posts] GET /community/posts/:id', e);
      return res.status(500).json({ error: e?.message || 'get_post_failed' });
    }
  });

  router.put('/community/posts/:id', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const postId = String(req.params.id || '').trim();
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const titleErr = validateLength(body.title, TITLE_MAX, 'title');
      if (titleErr) return res.status(400).json(titleErr);
      const bodyErr = validateLength(body.body, BODY_MAX, 'body');
      if (bodyErr) return res.status(400).json(bodyErr);
      const updated = await pgStore.updateCommunityPost(postId, userId, {
        title: body.title,
        body: body.body,
      });
      if (!updated) return res.status(404).json({ error: 'post_not_found' });
      if (updated.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(await enrichPost(updated, userId));
    } catch (e) {
      console.error('[community-posts] PUT /community/posts/:id', e);
      return res.status(500).json({ error: e?.message || 'update_post_failed' });
    }
  });

  router.delete('/community/posts/:id', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const postId = String(req.params.id || '').trim();
      const userId = await resolveUserId(req, req.body || {});
      const result = await pgStore.deleteCommunityPost(postId, userId);
      if (!result) return res.status(404).json({ error: 'post_not_found' });
      if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(result);
    } catch (e) {
      console.error('[community-posts] DELETE /community/posts/:id', e);
      return res.status(500).json({ error: e?.message || 'delete_post_failed' });
    }
  });

  router.get('/community/feed', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const viewerUserId = queryUserId(req);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      let feedService = null;
      try {
        feedService = require('../../lib/community-feed-service');
      } catch (_) {
        feedService = null;
      }
      let posts;
      let total;
      if (feedService?.getFeedPage) {
        const page = await feedService.getFeedPage({ limit, offset });
        posts = page.posts;
        total = page.total;
      } else {
        posts = await pgStore.listCommunityPostsFeed({ limit, offset });
        total = await pgStore.countCommunityPostsFeed();
      }
      const enriched = await Promise.all(posts.map((p) => enrichPost(p, viewerUserId)));
      return res.status(200).json({
        posts: enriched,
        pagination: { limit, offset, total, hasMore: offset + enriched.length < total },
      });
    } catch (e) {
      console.error('[community-posts] GET /community/feed', e);
      return res.status(500).json({ error: e?.message || 'feed_failed' });
    }
  });

  router.post('/community/comments', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const postId = String(body.postId || '').trim();
      if (!postId) return res.status(400).json({ error: 'postId_required' });
      const bodyErr = validateLength(body.body, COMMENT_MAX, 'body');
      if (bodyErr) return res.status(400).json(bodyErr);
      if (!String(body.body || '').trim()) return res.status(400).json({ error: 'body_required' });
      const post = await pgStore.getCommunityPost(postId);
      if (!post) return res.status(404).json({ error: 'post_not_found' });
      const comment = await pgStore.createCommunityComment({
        postId,
        userId,
        body: body.body,
      });
      let feedService = null;
      try {
        feedService = require('../../lib/community-feed-service');
      } catch (_) {
        feedService = null;
      }
      if (feedService?.onCommentCreated) {
        await feedService.onCommentCreated(comment, post);
      }
      return res.status(201).json(comment);
    } catch (e) {
      console.error('[community-posts] POST /community/comments', e);
      return res.status(500).json({ error: e?.message || 'create_comment_failed' });
    }
  });

  router.post('/community/likes', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const postId = String(body.postId || '').trim();
      if (!postId) return res.status(400).json({ error: 'postId_required' });
      const post = await pgStore.getCommunityPost(postId);
      if (!post) return res.status(404).json({ error: 'post_not_found' });
      const like = await pgStore.createCommunityPostLike({ userId, postId });
      let feedService = null;
      try {
        feedService = require('../../lib/community-feed-service');
      } catch (_) {
        feedService = null;
      }
      if (feedService?.onLikeCreated) {
        await feedService.onLikeCreated(like, post);
      }
      return res.status(201).json(like);
    } catch (e) {
      console.error('[community-posts] POST /community/likes', e);
      return res.status(500).json({ error: e?.message || 'like_failed' });
    }
  });

  router.delete('/community/likes/:id', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const likeId = String(req.params.id || '').trim();
      const userId = await resolveUserId(req, req.body || {});
      const result = await pgStore.deleteCommunityPostLike(likeId, userId);
      if (!result) return res.status(404).json({ error: 'like_not_found' });
      if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      return res.status(200).json(result);
    } catch (e) {
      console.error('[community-posts] DELETE /community/likes/:id', e);
      return res.status(500).json({ error: e?.message || 'unlike_failed' });
    }
  });

  router.get('/community/threads', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const keyword = req.query.keyword != null ? String(req.query.keyword).trim() : '';
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const threads = await pgStore.listCommunityThreadsByKeyword(keyword, { limit });
      return res.status(200).json({ keyword, threads });
    } catch (e) {
      console.error('[community-posts] GET /community/threads', e);
      return res.status(500).json({ error: e?.message || 'threads_failed' });
    }
  });

  router.get('/community/profile/:userId', async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const userId = String(req.params.userId || '').trim();
      const profile = await pgStore.getCommunityPublicProfile(userId);
      if (!profile) return res.status(404).json({ error: 'user_not_found' });
      if (profile.publicVisibility === false) {
        return res.status(404).json({ error: 'profile_not_public' });
      }
      return res.status(200).json(profile);
    } catch (e) {
      console.error('[community-posts] GET /community/profile/:userId', e);
      return res.status(500).json({ error: e?.message || 'profile_failed' });
    }
  });

  router.put('/community/settings', communityPostsLimiter, async (req, res) => {
    try {
      if (!pgStore) return res.status(501).json({ error: 'storage_unavailable' });
      const body = req.body || {};
      const userId = await resolveUserId(req, body);
      const bioErr = validateLength(body.bio, BIO_MAX, 'bio');
      if (bioErr) return res.status(400).json(bioErr);
      const keywords = Array.isArray(body.keywords)
        ? body.keywords
        : body.keywords != null
          ? [body.keywords]
          : [];
      const settings = await pgStore.upsertCommunityUserSettings(userId, {
        bio: body.bio,
        publicVisibility: body.publicVisibility,
        keywords,
      });
      return res.status(200).json(settings);
    } catch (e) {
      console.error('[community-posts] PUT /community/settings', e);
      return res.status(500).json({ error: e?.message || 'settings_failed' });
    }
  });

  return router;
}

module.exports = {
  createCommunityPostsRouter,
  validateLength,
  TITLE_MAX,
  BODY_MAX,
};
