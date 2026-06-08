'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { RelationalCommunityFeed } from '@/components/community/RelationalCommunityFeed';
import { useProfile } from '@/core/social/hooks';
import { useHydrateCompositionUrls } from '@/hooks/useHydrateCompositionUrls';
import { Card } from '@/components/shared/Card';

function TodayContent() {
  const { user, primaryChart, loading: profileLoading } = useProfile();

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

  return (
    <section className="max-w-4xl mx-auto" aria-label="Astrological weather forecast">
      <RelationalCommunityFeed
        userId={user.id}
        primaryChart={primaryChart}
        primaryHeading="Astrological Weather Forecast"
      />
    </section>
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
