'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/community/ProfilePanel';
import { ProfileHeaderCard } from '@/components/profile/ProfileHeaderCard';
import { useProfile } from '@/core/social/hooks';

export default function ProfilePage() {
  const { user, primaryChart, refresh } = useProfile();

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="space-y-2">
          <h1 className="text-h1 font-bold text-text">Profile</h1>
          <p className="text-sm text-subtext max-w-2xl">
            Sign in or register so your charts and soundtrack persist across sessions.
          </p>
        </section>

        {user ? (
          <ProfileHeaderCard user={user} primaryChart={primaryChart} onProfileRefresh={refresh} />
        ) : null}

        <Suspense fallback={<p className="text-sm text-subtext">Loading profile…</p>}>
          <ProfilePanel />
        </Suspense>
      </div>
    </AppShell>
  );
}

