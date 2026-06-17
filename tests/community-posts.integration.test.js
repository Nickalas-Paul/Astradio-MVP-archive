/** @jest-environment node */
const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const express = require('express');
const http = require('http');
const { createCommunityPostsRouter, validateLength, TITLE_MAX } = require('../server/routes/community-posts');

describe('community-posts validation', () => {
  test('validateLength rejects over-max strings', () => {
    const err = validateLength('x'.repeat(TITLE_MAX + 1), TITLE_MAX, 'title');
    expect(err).toEqual({ error: 'title_too_long', max: TITLE_MAX });
  });

  test('validateLength accepts within max', () => {
    expect(validateLength('hello', TITLE_MAX, 'title')).toBeNull();
  });
});

const hasPostgres = !!process.env.POSTGRES_URL;

(hasPostgres ? describe : describe.skip)('community-posts API integration', () => {
  let server;
  let baseUrl;
  let pgStore;
  let testUserId;
  let createdPostId;
  let createdLikeId;

  beforeAll(async () => {
    pgStore = require('../lib/pg-store');
    const devUser = await pgStore.ensureDevUser();
    testUserId = devUser.id;

    const app = express();
    app.use(express.json());
    app.use('/api', createCommunityPostsRouter());
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  afterAll(async () => {
    if (createdPostId) {
      try {
        await pgStore.deleteCommunityPost(createdPostId, testUserId);
      } catch (_) {
        // ignore cleanup failures
      }
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${path}${sep}userId=${encodeURIComponent(testUserId)}`;
    if (body) opts.body = JSON.stringify({ ...body, userId: testUserId });
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  test('POST /community/posts creates a post', async () => {
    const { status, data } = await api('POST', '/community/posts', {
      title: 'Integration test post',
      body: 'Hello community',
    });
    expect(status).toBe(201);
    expect(data.id).toMatch(/^cpost_/);
    expect(data.title).toBe('Integration test post');
    createdPostId = data.id;
  });

  test('GET /community/posts/:id returns post with comments array', async () => {
    const { status, data } = await api('GET', `/community/posts/${createdPostId}`);
    expect(status).toBe(200);
    expect(data.id).toBe(createdPostId);
    expect(Array.isArray(data.comments)).toBe(true);
    expect(typeof data.likeCount).toBe('number');
  });

  test('GET /community/feed includes created post', async () => {
    const { status, data } = await api('GET', '/community/feed?limit=50');
    expect(status).toBe(200);
    expect(Array.isArray(data.posts)).toBe(true);
    expect(data.posts.some((p) => p.id === createdPostId)).toBe(true);
  });

  test('POST /community/comments adds comment', async () => {
    const { status, data } = await api('POST', '/community/comments', {
      postId: createdPostId,
      body: 'Nice post',
    });
    expect(status).toBe(201);
    expect(data.postId).toBe(createdPostId);
  });

  test('POST /community/likes likes post', async () => {
    const { status, data } = await api('POST', '/community/likes', { postId: createdPostId });
    expect(status).toBe(201);
    expect(data.postId).toBe(createdPostId);
    createdLikeId = data.id;
  });

  test('GET /community/settings returns visibility for authenticated user', async () => {
    const { status, data } = await api('GET', '/community/settings');
    expect(status).toBe(200);
    expect(data.userId).toBe(testUserId);
    expect(typeof data.publicVisibility).toBe('boolean');
  });

  test('PUT /community/settings updates public visibility', async () => {
    const { status, data } = await api('PUT', '/community/settings', {
      publicVisibility: true,
    });
    expect(status).toBe(200);
    expect(data.publicVisibility).toBe(true);
  });

  test('GET /community/profile/:userId returns bio from user profile', async () => {
    await pgStore.updateUserProfile(testUserId, { bio: 'Integration profile bio' });
    const { status, data } = await api('GET', `/community/profile/${testUserId}`);
    expect(status).toBe(200);
    expect(data.userId).toBe(testUserId);
    expect(data.bio).toBe('Integration profile bio');
    expect(data.keywords).toBeUndefined();
  });

  test('public visibility off hides posts from feed for other viewers', async () => {
    const { status: createStatus, data: post } = await api('POST', '/community/posts', {
      title: 'Visibility test post',
      body: 'Should hide when visibility off',
    });
    expect(createStatus).toBe(201);
    const hiddenPostId = post.id;

    await api('PUT', '/community/settings', { publicVisibility: false });

    const otherViewerId = `${testUserId}_other`;
    const feedRes = await fetch(
      `${baseUrl}/community/feed?limit=50&userId=${encodeURIComponent(otherViewerId)}`
    );
    const feedData = await feedRes.json();
    expect(feedData.posts.some((p) => p.id === hiddenPostId)).toBe(false);

    const ownerPostRes = await api('GET', `/community/posts/${hiddenPostId}`);
    expect(ownerPostRes.status).toBe(200);

    await api('PUT', '/community/settings', { publicVisibility: true });
    await pgStore.deleteCommunityPost(hiddenPostId, testUserId);
  });

  test('DELETE /community/likes/:id removes like', async () => {
    const { status } = await api('DELETE', `/community/likes/${createdLikeId}`);
    expect(status).toBe(200);
  });

  test('DELETE /community/posts/:id removes post', async () => {
    const { status } = await api('DELETE', `/community/posts/${createdPostId}`);
    expect(status).toBe(200);
    createdPostId = null;
  });
});
