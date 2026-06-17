/**
 * Community content moderation: text profanity + Rekognition image scan.
 * Matches avatar moderation patterns (AWS SDK v2, 75% threshold, fail open on errors).
 */

const Filter = require('bad-words');
const { moderateImageBuffer, MODERATION_CONFIDENCE_THRESHOLD } = require('./avatar-upload');

const profanityFilter = new Filter();

const MODERATION_FAILED_MESSAGE =
  'Your post contains content that violates community guidelines.';

const PROFANITY_FAILED_MESSAGE =
  'Your post contains language that violates community guidelines.';

/**
 * @param {string} text
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function moderateCommunityText(text) {
  const s = String(text || '').trim();
  if (!s) return { ok: true };
  if (profanityFilter.isProfane(s)) {
    return { ok: false, message: PROFANITY_FAILED_MESSAGE };
  }
  return { ok: true };
}

/**
 * @param {string} title
 * @param {string} body
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function moderateCommunityPostText(title, body) {
  const combined = `${String(title || '')} ${String(body || '')}`.trim();
  return moderateCommunityText(combined);
}

/**
 * Fetch image bytes from URL and run Rekognition moderation.
 * @param {string} imageUrl
 * @returns {Promise<{ status: 'passed' | 'failed' | 'skipped' | 'error' }>}
 */
async function moderateCommunityImageUrl(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return { status: 'skipped' };

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('[community-moderation] image fetch failed', { status: resp.status, url: url.slice(0, 120) });
      return { status: 'error' };
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    const result = await moderateImageBuffer(buffer);
    if (!result.ok) {
      console.log('[community-moderation] image rejected', { url: url.slice(0, 120) });
      return { status: 'failed' };
    }
    return { status: 'passed' };
  } catch (e) {
    console.error('[community-moderation] image moderation error:', e?.message || e);
    return { status: 'error' };
  }
}

/**
 * Run text + optional image moderation for a new post.
 * @param {{ title?: string, body?: string, imageUrl?: string }} input
 * @returns {Promise<
 *   | { ok: true, moderationStatus: 'passed' | 'skipped' | 'error' }
 *   | { ok: false, message: string, moderationStatus: 'failed' }
 * >}
 */
async function moderateNewCommunityPost(input) {
  const textResult = moderateCommunityPostText(input.title, input.body);
  if (!textResult.ok) {
    return { ok: false, message: textResult.message, moderationStatus: 'failed' };
  }

  const imageResult = await moderateCommunityImageUrl(input.imageUrl);
  if (imageResult.status === 'failed') {
    return { ok: false, message: MODERATION_FAILED_MESSAGE, moderationStatus: 'failed' };
  }

  const moderationStatus =
    imageResult.status === 'skipped' && !String(input.imageUrl || '').trim()
      ? 'passed'
      : imageResult.status;

  return { ok: true, moderationStatus };
}

module.exports = {
  moderateCommunityText,
  moderateCommunityPostText,
  moderateCommunityImageUrl,
  moderateNewCommunityPost,
  MODERATION_FAILED_MESSAGE,
  PROFANITY_FAILED_MESSAGE,
  MODERATION_CONFIDENCE_THRESHOLD,
};
