const redis = require('redis');
require('dotenv').config();

let client = null;

async function connect() {
  if (client) return client;
  
  client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Connected to Redis');
  });

  await client.connect();
  return client;
}

async function getClient() {
  if (!client) {
    await connect();
  }
  return client;
}

async function set(key, value, ttl = null) {
  const redisClient = await getClient();
  if (ttl) {
    return await redisClient.setEx(key, ttl, JSON.stringify(value));
  }
  return await redisClient.set(key, JSON.stringify(value));
}

async function get(key) {
  const redisClient = await getClient();
  const value = await redisClient.get(key);
  return value ? JSON.parse(value) : null;
}

async function del(key) {
  const redisClient = await getClient();
  return await redisClient.del(key);
}

async function exists(key) {
  const redisClient = await getClient();
  return await redisClient.exists(key);
}

async function expire(key, ttl) {
  const redisClient = await getClient();
  return await redisClient.expire(key, ttl);
}

async function close() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = {
  connect,
  getClient,
  set,
  get,
  del,
  exists,
  expire,
  close
};
