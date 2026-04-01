const DEBUG_AUTH_HEADER = 'x-phase8-debug-auth';
const DEBUG_AUTH_SECRET_ENV = 'PHASE8_DEBUG_AUTH_SECRET';

function isPhase8DebugEnabled(env = process.env) {
  return env && env.PHASE8_DEBUG === '1';
}

function hasValidDebugAuth(req, env = process.env) {
  const expected = env && typeof env[DEBUG_AUTH_SECRET_ENV] === 'string' ? env[DEBUG_AUTH_SECRET_ENV].trim() : '';
  if (!expected) return false;
  const actual = req && req.headers ? String(req.headers[DEBUG_AUTH_HEADER] || '').trim() : '';
  return actual.length > 0 && actual === expected;
}

function buildAuthorizedCampaignAuthFixture(campaign) {
  if (!campaign || typeof campaign !== 'object') return null;
  const campaignId = typeof campaign.campaignId === 'string' ? campaign.campaignId : '';
  const mode = typeof campaign.mode === 'string' ? campaign.mode : '';
  const participantUserIds = Array.isArray(campaign.participantUserIds) ? campaign.participantUserIds : [];
  const ownerUserId = typeof campaign.ownerUserId === 'string' ? campaign.ownerUserId : '';

  if (!campaignId || !mode || !ownerUserId) return null;

  const authorizedUserIds = Array.from(new Set([ownerUserId, ...participantUserIds.filter((id) => typeof id === 'string')])).sort((a, b) =>
    a.localeCompare(b, 'en'),
  );

  return {
    campaign_id: campaignId,
    mode,
    authorized_user_ids: authorizedUserIds,
  };
}

module.exports = {
  DEBUG_AUTH_HEADER,
  DEBUG_AUTH_SECRET_ENV,
  isPhase8DebugEnabled,
  hasValidDebugAuth,
  buildAuthorizedCampaignAuthFixture,
};
