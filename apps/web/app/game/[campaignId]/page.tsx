'use client';

import { Suspense } from 'react';
import { GameDashboard } from './GameDashboard';

export default function GameCampaignPage({
  params,
}: {
  params: { campaignId: string };
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-secondary">Loading game…</div>}>
      <GameDashboard campaignId={params.campaignId} />
    </Suspense>
  );
}
