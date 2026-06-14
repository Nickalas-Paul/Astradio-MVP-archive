'use client';

import { FtueBanner } from './FtueBanner';

const FTUE_TODAY_WELCOME_KEY = 'astradio_ftue_today_welcome';

export function FtueTodayWelcomeBanner() {
  return (
    <FtueBanner storageKey={FTUE_TODAY_WELCOME_KEY} maxImpressions={1} className="mb-8">
      <p>
        Today shows you three things: what the sky is doing right now, how it&apos;s activating your chart
        specifically, and how it&apos;s shaping your connections. It refreshes every day.
      </p>
    </FtueBanner>
  );
}
