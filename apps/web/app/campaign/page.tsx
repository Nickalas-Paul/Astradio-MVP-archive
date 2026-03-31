import React from 'react';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAMPAIGN_ID = process.env.RPG_BETA_CAMPAIGN_ID;
const USER_ID = process.env.RPG_BETA_USER_ID;

export type CampaignNotConfiguredReason =
  | 'no_env_vars';

export default async function CampaignEntryPage() {
  let reason: CampaignNotConfiguredReason = 'no_env_vars';
  if (CAMPAIGN_ID && USER_ID) {
    redirect(`/rpg/campaign/${encodeURIComponent(CAMPAIGN_ID)}?userId=${encodeURIComponent(USER_ID)}`);
  }

  const reasonCopy: Record<CampaignNotConfiguredReason, string> = {
    no_env_vars: 'Set RPG_BETA_CAMPAIGN_ID and RPG_BETA_USER_ID to open a Campaign.',
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

