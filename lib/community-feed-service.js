/**
 * Community feed service — pagination, caching, and event publishing.
 */
const redis = require('./redis');
const pubsub = require('./redis-pubsub');

const FEED_CACHE_TTL_SEC = 60;
const FEED_CACHE_PREFIX = 'community:feed:page';

let pgStore = null;
function store() {
  if (!pgStore) {
    if (!process.env.POSTGRES_URL) throw new Error('postgres_unavailable');
    pgStore = require('./pg-store');
  }
  return pgStore;
}

function feedCacheKey(limit, offset) {
  return `${FEED_CACHE_PREFIX}:${limit}:${offset}`;
}

async function getFeedPage({ limit = 20, offset = 0 } = {}) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const safeOffset = Math.max(0, offset);
  const cacheKey = feedCacheKey(safeLimit, safeOffset);
  try {
    const cached = await redis.get(cacheKey);
    if (cached && Array.isArray(cached.posts)) {
      return cached;
    }
  } catch (_) {
    // cache miss or redis unavailable
  }
  const posts = await store().listCommunityPostsFeed({ limit: safeLimit, offset: safeOffset });
  const total = await store().countCommunityPostsFeed();
  const page = { posts, total, limit: safeLimit, offset: safeOffset };
  try {
    await redis.set(cacheKey, page, FEED_CACHE_TTL_SEC);
  } catch (_) {
    // ignore cache write failures
  }
  return page;
}

async function invalidateFeedCache() {
  try {
    const client = await redis.getClient();
    const keys = await client.keys(`${FEED_CACHE_PREFIX}:*`);
    if (keys.length) await client.del(keys);
  } catch (_) {
    // ignore
  }
}

async function onPostCreated(post) {
  await invalidateFeedCache();
  await pubsub.publishEvent(pubsub.CHANNELS.POSTS, { type: 'post_created', post });
}

async function onCommentCreated(comment, post) {
  await invalidateFeedCache();
  await pubsub.publishEvent(pubsub.CHANNELS.COMMENTS, {
    type: 'comment_created',
    comment,
    postId: post?.id || comment.postId,
    postAuthorId: post?.userId,
  });
}

async function onLikeCreated(like, post) {
  await pubsub.publishEvent(pubsub.CHANNELS.LIKES, {
    type: 'like_created',
    like,
    postId: post?.id || like.postId,
    postAuthorId: post?.userId,
  });
}

module.exports = {
  getFeedPage,
  invalidateFeedCache,
  onPostCreated,
  onCommentCreated,
  onLikeCreated,
};
