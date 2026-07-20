'use client';

import { Suspense, use } from 'react';
import { GameDashboard } from './GameDashboard';

function DashboardInner({ campaignId }: { campaignId: string }) {
  return <GameDashboard campaignId={campaignId} />;
}

export default function GameCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-secondary">Loading game…</div>}>
      <DashboardInner campaignId={campaignId} />
    </Suspense>
  );
}
