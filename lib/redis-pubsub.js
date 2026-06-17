/**
 * Redis pub/sub helpers for community realtime events.
 * Uses Redis only when REDIS_URL is set; otherwise in-process events only.
 */

const CHANNELS = {
  POSTS: 'community:posts',
  COMMENTS: 'community:comments',
  LIKES: 'community:likes',
  NOTIFICATIONS: 'community:notifications',
};

let subscriber = null;
const handlers = new Map();
let bootLogged = false;

function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL && String(process.env.REDIS_URL).trim());
}

function logBootMode() {
  if (bootLogged) return;
  bootLogged = true;
  if (isRedisConfigured()) {
    console.log('[COMMUNITY-PUBSUB] Redis configured for community events');
  } else {
    console.log('[COMMUNITY-PUBSUB] Redis not configured, using in-process events');
  }
}

function getRedisModule() {
  if (!isRedisConfigured()) return null;
  try {
    return require('./redis');
  } catch (_) {
    return null;
  }
}

async function getSubscriber() {
  logBootMode();
  const redis = getRedisModule();
  if (!redis) return null;
  if (subscriber) return subscriber;
  const client = await redis.getClient();
  subscriber = client.duplicate();
  subscriber.on('error', (err) => {
    console.warn('[COMMUNITY-PUBSUB] subscriber error:', err?.message || err);
  });
  await subscriber.connect();
  return subscriber;
}

async function publish(channel, payload) {
  logBootMode();
  if (!isRedisConfigured()) return false;
  const redis = getRedisModule();
  if (!redis) return false;
  try {
    const client = await redis.getClient();
    const message = JSON.stringify(payload);
    await client.publish(channel, message);
    return true;
  } catch (e) {
    console.warn('[COMMUNITY-PUBSUB] publish failed:', e?.message || e);
    return false;
  }
}

async function subscribe(channel, handler) {
  logBootMode();
  if (!isRedisConfigured()) {
    return subscribeLocal(channel, handler);
  }
  const sub = await getSubscriber();
  if (!sub) return subscribeLocal(channel, handler);
  if (!handlers.has(channel)) {
    handlers.set(channel, new Set());
    await sub.subscribe(channel, (message) => {
      let payload;
      try {
        payload = JSON.parse(message);
      } catch (_) {
        payload = { raw: message };
      }
      const set = handlers.get(channel);
      if (set) {
        for (const fn of set) {
          try {
            fn(payload);
          } catch (e) {
            console.error('[COMMUNITY-PUBSUB] handler error:', e);
          }
        }
      }
    });
  }
  handlers.get(channel).add(handler);
  return () => {
    const set = handlers.get(channel);
    if (set) set.delete(handler);
  };
}

/** In-process fan-out when Redis is unavailable. */
const localListeners = new Map();

function publishLocal(channel, payload) {
  const set = localListeners.get(channel);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch (e) {
      console.error('[COMMUNITY-PUBSUB] local handler error:', e);
    }
  }
}

function subscribeLocal(channel, handler) {
  if (!localListeners.has(channel)) localListeners.set(channel, new Set());
  localListeners.get(channel).add(handler);
  return () => localListeners.get(channel)?.delete(handler);
}

async function publishEvent(channel, payload) {
  if (isRedisConfigured()) {
    await publish(channel, payload);
  }
  publishLocal(channel, payload);
}

module.exports = {
  CHANNELS,
  isRedisConfigured,
  publish,
  subscribe,
  publishEvent,
  subscribeLocal,
};
