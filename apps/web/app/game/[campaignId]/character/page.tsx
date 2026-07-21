'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Deep-link: open campaign dashboard with character sheet intent via query. */
export default function CharacterRoute({
  params,
}: {
  params: { campaignId: string };
}) {
  const { campaignId } = params;
  const router = useRouter();
  useEffect(() => {
    router.replace(`/game/${encodeURIComponent(campaignId)}?panel=character`);
  }, [campaignId, router]);
  return null;
}
