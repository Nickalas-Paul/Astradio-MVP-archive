'use client';

import { useRouter } from 'next/navigation';
import { FtueBanner } from './FtueBanner';

const FTUE_TODAY_NUDGE_KEY = 'astradio_ftue_today_nudge';

export function FtueTodayBridgeNudge() {
  const router = useRouter();

  return (
    <FtueBanner
      storageKey={FTUE_TODAY_NUDGE_KEY}
      maxImpressions={2}
      className="mt-8"
      cta={
        <button
          type="button"
          onClick={() => router.push('/today')}
          className="text-sm text-accent hover:underline whitespace-nowrap"
        >
          Go to Today →
        </button>
      }
    >
      <p>Your chart never changes. But the sky does, every day.</p>
      <p>See how today is activating your chart.</p>
    </FtueBanner>
  );
}
