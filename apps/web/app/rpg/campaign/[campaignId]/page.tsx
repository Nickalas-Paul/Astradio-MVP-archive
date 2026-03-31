import React from 'react';
import { CampaignDailyClient } from './CampaignDailyClient';

export const runtime = 'nodejs';

type PageProps = {
  params: { campaignId: string };
};

export default async function CampaignPage({ params }: PageProps) {
  const hasPostgres = Boolean(process.env.POSTGRES_URL);
  if (!hasPostgres) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Campaign backend not configured</h1>
          <p style={{ fontSize: '14px', color: '#aaa' }}>
            The Campaign view requires the POSTGRES_URL environment variable to be set for this deployment.
          </p>
        </div>
      </main>
    );
  }
  return <CampaignDailyClient campaignId={params.campaignId} />;
}

