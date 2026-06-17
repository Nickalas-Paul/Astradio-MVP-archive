/**
 * Community notification service: monitors pub/sub, mentions, replies, likes, digest queue.
 */
const pubsub = require('./redis-pubsub');

const DIGEST_QUEUE_KEY = 'community:digest:queue';
const NOTIFICATION_TTL_SEC = 60 * 60 * 24 * 7;

/** SSE / in-app subscribers keyed by userId. */
const liveSubscribers = new Map();

/** In-memory inbox when Redis is not configured. */
const memoryInbox = new Map();

/** In-memory digest queue when Redis is not configured. */
const memoryDigestQueue = [];

function getRedisModule() {
  if (!pubsub.isRedisConfigured()) return null;
  try {
    return require('./redis');
  } catch (_) {
    return null;
  }
}

let pgStore = null;
function store() {
  if (!pgStore && process.env.POSTGRES_URL) {
    pgStore = require('./pg-store');
  }
  return pgStore;
}

function mentionPattern() {
  return /@([a-zA-Z0-9_]{2,32})/g;
}

function extractMentionHandles(text) {
  const handles = new Set();
  const re = mentionPattern();
  let m;
  const s = String(text || '');
  while ((m = re.exec(s)) !== null) {
    handles.add(m[1].toLowerCase());
  }
  return [...handles];
}

async function resolveUserIdByHandle(handle) {
  if (!store()) return null;
  const user = await store().getUserByHandle(handle);
  return user?.id || null;
}

async function enqueueNotification(notification) {
  const id = `cnotif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { id, ...notification, createdAt: new Date().toISOString() };
  const redis = getRedisModule();
  if (redis) {
    try {
      const client = await redis.getClient();
      const key = `community:notif:${notification.recipientUserId}:${id}`;
      await client.setEx(key, NOTIFICATION_TTL_SEC, JSON.stringify(record));
      await client.lPush(`community:notif:inbox:${notification.recipientUserId}`, id);
      await client.lTrim(`community:notif:inbox:${notification.recipientUserId}`, 0, 99);
    } catch (_) {
      // fall through to memory
    }
  }
  if (!memoryInbox.has(notification.recipientUserId)) {
    memoryInbox.set(notification.recipientUserId, []);
  }
  const inbox = memoryInbox.get(notification.recipientUserId);
  inbox.unshift(record);
  if (inbox.length > 100) inbox.length = 100;
  fanOutToLiveSubscribers(notification.recipientUserId, record);
  await pubsub.publishEvent(pubsub.CHANNELS.NOTIFICATIONS, record);
  return record;
}

function fanOutToLiveSubscribers(userId, record) {
  const set = liveSubscribers.get(userId);
  if (!set) return;
  for (const send of set) {
    try {
      send(record);
    } catch (_) {
      // ignore broken SSE writer
    }
  }
}

function subscribeLiveNotifications(userId, sendFn) {
  if (!liveSubscribers.has(userId)) liveSubscribers.set(userId, new Set());
  liveSubscribers.get(userId).add(sendFn);
  return () => liveSubscribers.get(userId)?.delete(sendFn);
}

async function listNotificationsForUser(userId, limit = 20) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const redis = getRedisModule();
  if (redis) {
    try {
      const client = await redis.getClient();
      const ids = await client.lRange(`community:notif:inbox:${userId}`, 0, safeLimit - 1);
      const out = [];
      for (const id of ids) {
        const raw = await client.get(`community:notif:${userId}:${id}`);
        if (raw) {
          try {
            out.push(JSON.parse(raw));
          } catch (_) {
            // skip corrupt entry
          }
        }
      }
      if (out.length) return out;
    } catch (_) {
      // fall through to memory
    }
  }
  return (memoryInbox.get(userId) || []).slice(0, safeLimit);
}

async function queueDigestEmail(entry) {
  if (!pubsub.isRedisConfigured()) {
    memoryDigestQueue.push({ ...entry, queuedAt: new Date().toISOString() });
    return;
  }
  const redis = getRedisModule();
  if (!redis) return;
  try {
    const client = await redis.getClient();
    await client.lPush(DIGEST_QUEUE_KEY, JSON.stringify({ ...entry, queuedAt: new Date().toISOString() }));
  } catch (e) {
    console.warn('[community-notification] digest queue failed:', e?.message || e);
  }
}

async function processDigestBatch(limit = 50) {
  const batch = [];
  if (!pubsub.isRedisConfigured()) {
    while (batch.length < limit && memoryDigestQueue.length) {
      batch.push(memoryDigestQueue.shift());
    }
    if (batch.length) {
      console.log('[community-notification] digest batch ready:', batch.length, 'entries (in-memory stub)');
    }
    return batch;
  }
  const redis = getRedisModule();
  if (!redis) return batch;
  try {
    const client = await redis.getClient();
    for (let i = 0; i < limit; i++) {
      const raw = await client.rPop(DIGEST_QUEUE_KEY);
      if (!raw) break;
      try {
        batch.push(JSON.parse(raw));
      } catch (_) {
        // skip
      }
    }
  } catch (_) {
    return batch;
  }
  if (batch.length) {
    console.log('[community-notification] digest batch ready:', batch.length, 'entries (email sender stub)');
  }
  return batch;
}

async function handleCommentEvent(event) {
  const { comment, postAuthorId } = event;
  if (!comment) return;
  if (postAuthorId && postAuthorId !== comment.userId) {
    const n = await enqueueNotification({
      recipientUserId: postAuthorId,
      type: 'reply',
      postId: comment.postId,
      commentId: comment.id,
      actorUserId: comment.userId,
      preview: String(comment.body || '').slice(0, 120),
    });
    await queueDigestEmail({ kind: 'reply', notificationId: n.id, recipientUserId: postAuthorId });
  }
  const handles = extractMentionHandles(comment.body);
  for (const handle of handles) {
    const mentionedId = await resolveUserIdByHandle(handle);
    if (mentionedId && mentionedId !== comment.userId) {
      const n = await enqueueNotification({
        recipientUserId: mentionedId,
        type: 'mention',
        postId: comment.postId,
        commentId: comment.id,
        actorUserId: comment.userId,
        preview: String(comment.body || '').slice(0, 120),
      });
      await queueDigestEmail({ kind: 'mention', notificationId: n.id, recipientUserId: mentionedId });
    }
  }
}

async function handleLikeEvent(event) {
  const { like, postAuthorId } = event;
  if (!like || !postAuthorId || postAuthorId === like.userId) return;
  const n = await enqueueNotification({
    recipientUserId: postAuthorId,
    type: 'like',
    postId: like.postId,
    likeId: like.id,
    actorUserId: like.userId,
  });
  await queueDigestEmail({ kind: 'like', notificationId: n.id, recipientUserId: postAuthorId });
}

async function handlePostEvent(event) {
  if (event?.type !== 'post_created') return;
  await queueDigestEmail({ kind: 'post', postId: event.post?.id, authorUserId: event.post?.userId });
}

let started = false;

function startCommunityNotificationService() {
  if (started) return;
  started = true;
  pubsub.subscribeLocal(pubsub.CHANNELS.COMMENTS, (event) => {
    handleCommentEvent(event).catch((e) => console.error('[community-notification] comment handler', e));
  });
  pubsub.subscribeLocal(pubsub.CHANNELS.LIKES, (event) => {
    handleLikeEvent(event).catch((e) => console.error('[community-notification] like handler', e));
  });
  pubsub.subscribeLocal(pubsub.CHANNELS.POSTS, (event) => {
    handlePostEvent(event).catch((e) => console.error('[community-notification] post handler', e));
  });
  if (pubsub.isRedisConfigured()) {
    pubsub.subscribe(pubsub.CHANNELS.COMMENTS, (event) => {
      handleCommentEvent(event).catch((e) => console.error('[community-notification] comment handler', e));
    }).catch(() => {});
    pubsub.subscribe(pubsub.CHANNELS.LIKES, (event) => {
      handleLikeEvent(event).catch((e) => console.error('[community-notification] like handler', e));
    }).catch(() => {});
    pubsub.subscribe(pubsub.CHANNELS.POSTS, (event) => {
      handlePostEvent(event).catch((e) => console.error('[community-notification] post handler', e));
    }).catch(() => {});
  }
  const digestIntervalMs = parseInt(process.env.COMMUNITY_DIGEST_INTERVAL_MS || '86400000', 10);
  setInterval(() => {
    processDigestBatch().catch((e) => console.error('[community-notification] digest', e));
  }, digestIntervalMs);
  console.log(
    `[community-notification] service started (pub/sub: ${pubsub.isRedisConfigured() ? 'redis' : 'in-process'})`
  );
}

module.exports = {
  startCommunityNotificationService,
  enqueueNotification,
  listNotificationsForUser,
  subscribeLiveNotifications,
  extractMentionHandles,
  queueDigestEmail,
  processDigestBatch,
};
