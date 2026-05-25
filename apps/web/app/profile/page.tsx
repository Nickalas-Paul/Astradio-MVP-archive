'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/community/ProfilePanel';
import { ProfileHeader } from '@/components/ProfileHeader';
import { useProfile } from '@/core/social/hooks';

function formatBirthData(chart: { date?: string; time?: string } | null): string | undefined {
  if (!chart?.date) return undefined;
  const time = chart.time?.slice(0, 5) || chart.time;
  return time ? `${chart.date} · ${time}` : chart.date;
}

export default function ProfilePage() {
  const { user, primaryChart } = useProfile();

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="space-y-2">
          <h1 className="text-3xl font-bold text-text">Profile</h1>
          <p className="text-sm text-subtext max-w-2xl">
            Sign in or register so your charts and soundtrack persist across sessions.
          </p>
        </section>

        {user ? (
          <ProfileHeader
            user={{
              displayName: user.displayName || user.id || 'You',
              birthData: formatBirthData(primaryChart),
              bio: user.bio,
              photoUrl: user.avatarUrl,
            }}
            isOwnProfile
          />
        ) : null}

        <Suspense fallback={<p className="text-sm text-subtext">Loading profile…</p>}>
          <ProfilePanel />
        </Suspense>
      </div>
    </AppShell>
  );
}

