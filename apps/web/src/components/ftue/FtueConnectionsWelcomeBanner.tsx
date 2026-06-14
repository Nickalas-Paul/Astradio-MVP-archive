'use client';

import { FtueBanner } from './FtueBanner';

const FTUE_CONNECTIONS_WELCOME_KEY = 'astradio_ftue_connections_welcome';

export function FtueConnectionsWelcomeBanner() {
  return (
    <FtueBanner storageKey={FTUE_CONNECTIONS_WELCOME_KEY} maxImpressions={1} className="max-w-4xl mx-auto">
      <p>
        Discovery finds people whose charts resonate with yours. Connections tracks the relationships
        you&apos;ve built. You already have one — take a look.
      </p>
    </FtueBanner>
  );
}
