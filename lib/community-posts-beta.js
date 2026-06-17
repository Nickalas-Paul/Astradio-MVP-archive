/**
 * Beta rollout gate for community posts MVP.
 * Set COMMUNITY_POSTS_BETA_USER_IDS=comma,separated,userIds to restrict access.
 * When unset, all authenticated users may access community posts (when feature flag is on).
 */
function parseBetaUserIds() {
  const raw = process.env.COMMUNITY_POSTS_BETA_USER_IDS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isCommunityPostsBetaUser(userId) {
  const allowlist = parseBetaUserIds();
  if (allowlist.length === 0) return true;
  return allowlist.includes(String(userId || '').trim());
}

function communityPostsFeatureEnabled() {
  return process.env.ENABLE_COMMUNITY_POSTS === 'true' || process.env.NEXT_PUBLIC_ENABLE_COMMUNITY_POSTS === 'true';
}

module.exports = {
  parseBetaUserIds,
  isCommunityPostsBetaUser,
  communityPostsFeatureEnabled,
};
