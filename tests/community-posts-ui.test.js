/** @jest-environment node */
const { describe, expect, test } = require('@jest/globals');
const { extractMentionHandles } = require('../lib/community-notification-service');

describe('community notification mentions', () => {
  test('extractMentionHandles finds @handles in text', () => {
    expect(extractMentionHandles('Hey @nicka and @astro_fan')).toEqual(['nicka', 'astro_fan']);
  });

  test('extractMentionHandles returns empty for plain text', () => {
    expect(extractMentionHandles('no mentions here')).toEqual([]);
  });
});

describe('community content moderation', () => {
  test('moderateCommunityText rejects profanity', () => {
    const mod = require('../lib/community-content-moderation');
    expect(mod.moderateCommunityText('hello world').ok).toBe(true);
    expect(mod.moderateCommunityText('shit happens').ok).toBe(false);
  });
});

describe('community posts beta gate', () => {
  test('isCommunityPostsBetaUser allows all when allowlist empty', () => {
    const prev = process.env.COMMUNITY_POSTS_BETA_USER_IDS;
    delete process.env.COMMUNITY_POSTS_BETA_USER_IDS;
    jest.resetModules();
    const beta = require('../lib/community-posts-beta');
    expect(beta.isCommunityPostsBetaUser('usr_any')).toBe(true);
    process.env.COMMUNITY_POSTS_BETA_USER_IDS = prev;
  });
});
