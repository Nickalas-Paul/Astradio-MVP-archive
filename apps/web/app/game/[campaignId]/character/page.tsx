'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Deep-link: open campaign dashboard with character sheet intent via query. */
export default function CharacterRoute({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/game/${encodeURIComponent(campaignId)}?panel=character`);
  }, [campaignId, router]);
  return null;
}
