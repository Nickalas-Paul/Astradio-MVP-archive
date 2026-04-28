'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

/** Legacy social posts were removed; Community is discovery + relational feed only. */
export default function CommunityPostRetiredPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <p className="text-text">Community posts are no longer available.</p>
        <p className="text-sm text-subtext">
          Use the Community <strong className="text-text">Feed</strong> tab for established connections, or{' '}
          <strong className="text-text">Discovery</strong> for compatibility search.
        </p>
        <Link href="/community" className="text-emerald-500 hover:underline text-sm inline-block">
          ← Back to Community
        </Link>
      </div>
    </AppShell>
  );
}
