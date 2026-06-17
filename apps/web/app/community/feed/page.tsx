'use client';

import { AppShell } from '@/components/AppShell';
import { CommunityFeed } from '@/components/community/posts/CommunityFeed';
import { CommunityNotificationsPanel } from '@/components/community/posts/CommunityNotificationsPanel';
import Link from 'next/link';
import { isFeatureEnabled } from '@/core/config/flags';

export default function CommunityFeedPage() {
  const enabled = isFeatureEnabled('ENABLE_COMMUNITY_POSTS');

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-2">
          <h1 className="text-h1 font-serif text-text-primary">Community Feed</h1>
          <p className="text-sm text-text-secondary">
            Share readings, transits, and thoughts with the Astradio community.
          </p>
          {enabled ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href="/community/settings" className="text-accent hover:underline">
                Community settings
              </Link>
              <Link href="/community" className="text-accent hover:underline">
                Connections
              </Link>
            </div>
          ) : null}
        </header>
        <CommunityNotificationsPanel />
        <CommunityFeed />
      </div>
    </AppShell>
  );
}
