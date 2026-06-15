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
import { FtueTodayWelcomeBanner } from '@/components/ftue/FtueTodayWelcomeBanner';

function TodayContent() {
  const { user, primaryChart, loading: profileLoading } = useProfile();
  const [librarySaveError, setLibrarySaveError] = useState<string | null>(null);
  const libraryRef = useRef<{ refresh: () => void } | null>(null);

  useHydrateCompositionUrls();

  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;
  const isSignedIn = !profileLoading && user !== null;

  return (
    <PlacementHighlightProvider>
      <div className="max-w-6xl mx-auto">
        {isSignedIn ? <FtueTodayWelcomeBanner key="ftue-today-welcome" /> : null}

        {profileLoading ? (
          <p className="text-sm text-text-secondary text-center">Loading Today…</p>
        ) : user === null ? (
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
        ) : (
          <>
            <TodaySkySummary primaryChart={primaryChart} />

            <div className="py-10 text-center">
              <div className="w-16 h-px bg-accent/30 mx-auto mb-5" />
              <p className="text-body text-text-secondary font-serif italic max-w-md mx-auto">
                That&apos;s the weather for everyone. Here&apos;s how it&apos;s landing on your chart.
              </p>
            </div>

            <section aria-label="Your personal transit">
              <h2 className="text-h2 font-serif font-semibold text-text-primary mb-6">Your Transit</h2>
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

            <div className="py-10 text-center">
              <div className="w-16 h-px bg-accent/30 mx-auto mb-5" />
              <p className="text-body text-text-secondary font-serif italic max-w-md mx-auto">
                Now zoom out. Here&apos;s how today&apos;s sky is activating your connections.
              </p>
            </div>

            <section aria-label="Astrological weather forecast">
              <RelationalCommunityFeed
                userId={user.id}
                primaryChart={primaryChart}
                primaryHeading="Astrological Weather Forecast"
                primaryDescription="Ranked by today's activation strength."
              />
            </section>
          </>
        )}
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
          <p className="text-body-sm text-text-muted">
            Saved tracks and your full identity live under{' '}
            <Link href="/profile" className="text-accent hover:underline">
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
