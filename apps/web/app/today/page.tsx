'use client';

import { Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { RelationalCommunityFeed } from '@/components/community/RelationalCommunityFeed';
import { ActiveTransitPanel } from '@/components/profile/ActiveTransitPanel';
import { TodaySkySummary } from '@/components/today/TodaySkySummary';
import { useProfile } from '@/core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '@/core/social/constants';
import { useHydrateCompositionUrls } from '@/hooks/useHydrateCompositionUrls';
import { PlacementHighlightProvider } from '@/core/PlacementHighlightContext';
import { Card } from '@/components/shared/Card';

function TodayContent() {
  const { user, primaryChart, loading: profileLoading } = useProfile();
  const [librarySaveError, setLibrarySaveError] = useState<string | null>(null);
  const libraryRef = useRef<{ refresh: () => void } | null>(null);

  useHydrateCompositionUrls();

  if (profileLoading) {
    return (
      <p className="text-sm text-text-secondary text-center">Loading Today…</p>
    );
  }

  if (user === null) {
    return (
      <Card elevation="resting" padding="p-6" className="max-w-4xl mx-auto text-center space-y-3">
        <p className="text-body-sm text-text-secondary">
          Sign in to see your personal and relational astrological weather.
        </p>
        <p className="text-sm text-text-secondary">
          <Link href="/profile" className="text-accent-light hover:underline">
            Sign in on My Sky
          </Link>
        </p>
      </Card>
    );
  }

  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;

  return (
    <PlacementHighlightProvider>
      <div className="max-w-6xl mx-auto">
        <TodaySkySummary primaryChart={primaryChart} />

        <div className="border-t border-border/30 py-8" />

        <section aria-label="Your personal transit">
          <div className="space-y-1 mb-6">
            <h2 className="text-h2 font-serif font-semibold text-text-primary">Your Transit</h2>
            <p className="text-body-sm text-text-secondary">
              How today&apos;s sky is activating your natal chart.
            </p>
          </div>
          {noRealChart ? (
            <Card elevation="resting" padding="p-5" className="text-body-sm text-text-secondary space-y-2">
              <p>Link your birth chart in My Sky to see your personal transit.</p>
              <p>
                <Link href="/profile" className="text-accent-light hover:underline">
                  Go to My Sky
                </Link>
              </p>
            </Card>
          ) : (
            <ActiveTransitPanel
              chartId={chartId}
              noRealChart={noRealChart}
              librarySaveError={librarySaveError}
              onSaved={() => void libraryRef.current?.refresh()}
              onSaveError={(msg) => setLibrarySaveError(msg)}
              onClearSaveError={() => setLibrarySaveError(null)}
            />
          )}
        </section>

        <div className="border-t border-border/30 py-8" />

        <section aria-label="Astrological weather forecast">
          <RelationalCommunityFeed
            userId={user.id}
            primaryChart={primaryChart}
            primaryHeading="Astrological Weather Forecast"
          />
        </section>
      </div>
    </PlacementHighlightProvider>
  );
}

export default function TodayPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-h1 font-serif font-bold text-text-primary">Today</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Your personal and relational astrological weather.
          </p>
          <p className="text-sm text-text-secondary">
            Profile and saved tracks live under{' '}
            <Link href="/profile" className="text-accent-light hover:underline">
              My Sky
            </Link>
            .
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Suspense fallback={<p className="text-sm text-text-secondary text-center">Loading transits…</p>}>
            <TodayContent />
          </Suspense>
        </motion.div>
      </div>
    </AppShell>
  );
}
