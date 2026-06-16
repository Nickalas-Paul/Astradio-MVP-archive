/**
 * Redis pub/sub helpers for community realtime events.
 */
const redis = require('./redis');

const CHANNELS = {
  POSTS: 'community:posts',
  COMMENTS: 'community:comments',
  LIKES: 'community:likes',
  NOTIFICATIONS: 'community:notifications',
};

let subscriber = null;
const handlers = new Map();

async function getSubscriber() {
  if (subscriber) return subscriber;
  const client = await redis.getClient();
  subscriber = client.duplicate();
  subscriber.on('error', (err) => console.error('[redis-pubsub] subscriber error:', err));
  await subscriber.connect();
  return subscriber;
}

async function publish(channel, payload) {
  try {
    const client = await redis.getClient();
    const message = JSON.stringify(payload);
    await client.publish(channel, message);
    return true;
  } catch (e) {
    console.warn('[redis-pubsub] publish failed:', e?.message || e);
    return false;
  }
}

async function subscribe(channel, handler) {
  const sub = await getSubscriber();
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
            console.error('[redis-pubsub] handler error:', e);
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

/** In-process fan-out when Redis is unavailable (dev fallback). */
const localListeners = new Map();

function publishLocal(channel, payload) {
  const set = localListeners.get(channel);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(payload);
    } catch (e) {
      console.error('[redis-pubsub] local handler error:', e);
    }
  }
}

function subscribeLocal(channel, handler) {
  if (!localListeners.has(channel)) localListeners.set(channel, new Set());
  localListeners.get(channel).add(handler);
  return () => localListeners.get(channel)?.delete(handler);
}

async function publishEvent(channel, payload) {
  const ok = await publish(channel, payload);
  if (!ok) publishLocal(channel, payload);
  else publishLocal(channel, payload);
}

module.exports = {
  CHANNELS,
  publish,
  subscribe,
  publishEvent,
  subscribeLocal,
};
