'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CommunitySettings } from '@/components/community/posts/CommunitySettings';

export default function CommunitySettingsPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link href="/community/feed" className="text-sm text-accent hover:underline inline-block">
          ← Back to feed
        </Link>
        <CommunitySettings />
      </div>
    </AppShell>
  );
}
