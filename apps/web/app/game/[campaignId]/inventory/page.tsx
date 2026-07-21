'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Deep-link: open campaign dashboard with inventory intent via query. */
export default function InventoryRoute({
  params,
}: {
  params: { campaignId: string };
}) {
  const { campaignId } = params;
  const router = useRouter();
  useEffect(() => {
    router.replace(`/game/${encodeURIComponent(campaignId)}?panel=inventory`);
  }, [campaignId, router]);
  return null;
}
