import React from 'react';
import { redirect } from 'next/navigation';
import { getOrCreatePhase8RealUserCampaign } from '../../../../vnext/phase8/resolve-real-user-campaign';

export const runtime = 'nodejs';

const CAMPAIGN_ID = process.env.RPG_BETA_CAMPAIGN_ID;
const USER_ID = process.env.RPG_BETA_USER_ID;

/** Phase 7 fixture pattern — do not use in Phase 8 Preview. */
function isPhase7Fixture(userId: string): boolean {
  return /user_test_ui_phase7/i.test(userId);
}

export type CampaignNotConfiguredReason =
  | 'missing_phase8_debug'
  | 'missing_postgres_url'
  | 'phase8_resolve_failed'
  | 'no_env_vars';

export default async function CampaignEntryPage() {
  // A. Honor env vars when set and not Phase 7 fixture.
  if (CAMPAIGN_ID && USER_ID && !isPhase7Fixture(USER_ID)) {
    redirect(`/rpg/campaign/${encodeURIComponent(CAMPAIGN_ID)}?userId=${encodeURIComponent(USER_ID)}`);
  }

  // B. PHASE8_DEBUG=1 + POSTGRES_URL: resolve phase8_real_user campaign (get-or-create + daily turn).
  // redirect() throws NEXT_REDIRECT — must not be inside try/catch or it will be swallowed.
  let reason: CampaignNotConfiguredReason = 'no_env_vars';
  if (process.env.PHASE8_DEBUG !== '1') {
    reason = 'missing_phase8_debug';
  } else if (!process.env.POSTGRES_URL) {
    reason = 'missing_postgres_url';
  } else {
    let resolved: { userId: string; campaignId: string } | null = null;
    try {
      resolved = await getOrCreatePhase8RealUserCampaign();
    } catch (e) {
      reason = 'phase8_resolve_failed';
      console.error('[campaign] Phase 8 resolve failed:', e);
    }
    if (resolved) {
      redirect(`/rpg/campaign/${encodeURIComponent(resolved.campaignId)}?userId=${encodeURIComponent(resolved.userId)}`);
    }
  }

  // C. Not configured — show classified reason.
  const reasonCopy: Record<CampaignNotConfiguredReason, string> = {
    missing_phase8_debug: 'PHASE8_DEBUG=1 is required for the Phase 8 proof lane.',
    missing_postgres_url: 'POSTGRES_URL is required for the Phase 8 proof lane.',
    phase8_resolve_failed: 'Phase 8 user/campaign resolution failed. Check server logs.',
    no_env_vars: 'Set RPG_BETA_CAMPAIGN_ID and RPG_BETA_USER_ID, or enable PHASE8_DEBUG=1 with POSTGRES_URL.',
  };

  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Campaign not configured</h1>
        <p className="text-sm text-subtext">
          {reasonCopy[reason]}
        </p>
        <p className="text-xs text-subtext/80 mt-2">
          reason: {reason}
        </p>
      </div>
    </main>
  );
}

