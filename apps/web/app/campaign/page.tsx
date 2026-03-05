import React from 'react';
import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

const CAMPAIGN_ID = process.env.RPG_BETA_CAMPAIGN_ID;
const USER_ID = process.env.RPG_BETA_USER_ID;

export default function CampaignEntryPage() {
  if (!CAMPAIGN_ID || !USER_ID) {
    return (
      <main className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Campaign not configured</h1>
          <p className="text-sm text-subtext">
            The RPG campaign surface requires `RPG_BETA_CAMPAIGN_ID` and `RPG_BETA_USER_ID` environment variables.
          </p>
        </div>
      </main>
    );
  }

  redirect(`/rpg/campaign/${encodeURIComponent(CAMPAIGN_ID)}?userId=${encodeURIComponent(USER_ID)}`);
}

