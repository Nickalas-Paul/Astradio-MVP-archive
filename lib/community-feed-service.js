/**
 * Community feed service: pagination, caching, and event publishing.
 */
const pubsub = require('./redis-pubsub');

const FEED_CACHE_TTL_SEC = 60;
const FEED_CACHE_PREFIX = 'community:feed:page';

/** In-memory feed cache when Redis is not configured. */
const memoryFeedCache = new Map();

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

function getRedisModule() {
  if (!pubsub.isRedisConfigured()) return null;
  try {
    return require('./redis');
  } catch (_) {
    return null;
  }
}

async function readFeedCache(cacheKey) {
  const redis = getRedisModule();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached && Array.isArray(cached.posts)) return cached;
    } catch (_) {
      // fall through to memory / db
    }
  }
  const mem = memoryFeedCache.get(cacheKey);
  if (mem && mem.expiresAt > Date.now()) return mem.page;
  return null;
}

async function writeFeedCache(cacheKey, page) {
  const redis = getRedisModule();
  if (redis) {
    try {
      await redis.set(cacheKey, page, FEED_CACHE_TTL_SEC);
      return;
    } catch (_) {
      // fall through to memory
    }
  }
  memoryFeedCache.set(cacheKey, {
    page,
    expiresAt: Date.now() + FEED_CACHE_TTL_SEC * 1000,
  });
}

async function getFeedPage({ limit = 20, offset = 0 } = {}) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const safeOffset = Math.max(0, offset);
  const cacheKey = feedCacheKey(safeLimit, safeOffset);
  const cached = await readFeedCache(cacheKey);
  if (cached) return cached;

  const posts = await store().listCommunityPostsFeed({ limit: safeLimit, offset: safeOffset });
  const total = await store().countCommunityPostsFeed();
  const page = { posts, total, limit: safeLimit, offset: safeOffset };
  await writeFeedCache(cacheKey, page);
  return page;
}

async function invalidateFeedCache() {
  memoryFeedCache.clear();
  const redis = getRedisModule();
  if (!redis) return;
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
