'use client';

import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfilePanel } from '@/components/community/ProfilePanel';

export default function ProfilePage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="space-y-2">
          <h1 className="text-h1 font-bold text-text-primary">Profile</h1>
          <p className="text-sm text-text-secondary max-w-2xl">
            Sign in or register so your charts and soundtrack persist across sessions.
          </p>
        </section>

        <Suspense fallback={<p className="text-sm text-text-secondary">Loading profile…</p>}>
          <ProfilePanel />
        </Suspense>
      </div>
    </AppShell>
  );
}
