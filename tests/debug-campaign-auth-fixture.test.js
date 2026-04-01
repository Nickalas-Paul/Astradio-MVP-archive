const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  DEBUG_AUTH_HEADER,
  hasValidDebugAuth,
  isPhase8DebugEnabled,
  buildAuthorizedCampaignAuthFixture,
} = require('../server/lib/debug-campaign-auth-fixture');

describe('debug campaign auth fixture helper', () => {
  it('is unavailable when debug mode is off', () => {
    assert.strictEqual(isPhase8DebugEnabled({ PHASE8_DEBUG: '0' }), false);
    assert.strictEqual(isPhase8DebugEnabled({}), false);
  });

  it('rejects missing or invalid secret header', () => {
    const env = { PHASE8_DEBUG_AUTH_SECRET: 'secret_123' };
    assert.strictEqual(hasValidDebugAuth({ headers: {} }, env), false);
    assert.strictEqual(hasValidDebugAuth({ headers: { [DEBUG_AUTH_HEADER]: 'wrong' } }, env), false);
    assert.strictEqual(hasValidDebugAuth({ headers: { [DEBUG_AUTH_HEADER]: 'secret_123' } }, env), true);
  });

  it('returns only approved fields', () => {
    const payload = buildAuthorizedCampaignAuthFixture({
      campaignId: 'stage5_known',
      mode: 'group',
      ownerUserId: 'usr_owner',
      participantUserIds: ['usr_member_b', 'usr_member_a'],
      stateJson: { should_not: 'escape' },
      bundleHash: 'ignore_me',
    });

    assert.deepStrictEqual(payload, {
      campaign_id: 'stage5_known',
      mode: 'group',
      authorized_user_ids: ['usr_member_a', 'usr_member_b', 'usr_owner'],
    });
    assert.deepStrictEqual(Object.keys(payload).sort(), ['authorized_user_ids', 'campaign_id', 'mode']);
  });

  it('fails closed for unknown or malformed campaign objects', () => {
    assert.strictEqual(buildAuthorizedCampaignAuthFixture(null), null);
    assert.strictEqual(buildAuthorizedCampaignAuthFixture({ campaignId: 'x' }), null);
  });

  it('returns authorized ids for a known solo campaign', () => {
    const payload = buildAuthorizedCampaignAuthFixture({
      campaignId: 'stage5_solo',
      mode: 'solo',
      ownerUserId: 'usr_solo',
      participantUserIds: ['usr_solo'],
    });

    assert.deepStrictEqual(payload, {
      campaign_id: 'stage5_solo',
      mode: 'solo',
      authorized_user_ids: ['usr_solo'],
    });
  });
});
