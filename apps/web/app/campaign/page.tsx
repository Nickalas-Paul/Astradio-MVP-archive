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

export default async function CampaignEntryPage() {
  // A. Honor env vars when set and not Phase 7 fixture.
  if (CAMPAIGN_ID && USER_ID && !isPhase7Fixture(USER_ID)) {
    redirect(`/rpg/campaign/${encodeURIComponent(CAMPAIGN_ID)}?userId=${encodeURIComponent(USER_ID)}`);
  }

  // B. PHASE8_DEBUG=1: resolve phase8_real_user campaign (get-or-create + daily turn).
  if (process.env.PHASE8_DEBUG === '1' && process.env.POSTGRES_URL) {
    try {
      const { userId, campaignId } = await getOrCreatePhase8RealUserCampaign();
      redirect(`/rpg/campaign/${encodeURIComponent(campaignId)}?userId=${encodeURIComponent(userId)}`);
    } catch (e) {
      console.error('[campaign] Phase 8 resolve failed:', e);
    }
  }

  // C. Not configured.
  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold">Campaign not configured</h1>
        <p className="text-sm text-subtext">
          Set <code>RPG_BETA_CAMPAIGN_ID</code> and <code>RPG_BETA_USER_ID</code>, or enable <code>PHASE8_DEBUG=1</code> with <code>POSTGRES_URL</code> for the Phase 8 proof lane.
        </p>
      </div>
    </main>
  );
}

