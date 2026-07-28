'use client';

import { Suspense } from 'react';
import { DungeonCodex } from './DungeonCodex';

export default function CodexPage({ params }: { params: { campaignId: string } }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-secondary">Loading codex…</div>}>
      <DungeonCodex campaignId={params.campaignId} />
    </Suspense>
  );
}
