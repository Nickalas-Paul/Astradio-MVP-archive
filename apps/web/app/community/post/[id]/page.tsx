'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

/** Legacy social posts were removed; Community is discovery + relational feed only. */
export default function CommunityPostRetiredPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <p className="text-text-primary">Community posts are no longer available.</p>
        <p className="text-sm text-text-secondary">
          Use the Community <strong className="text-text-primary">Feed</strong> tab for established connections, or{' '}
          <strong className="text-text-primary">Discovery</strong> for compatibility search.
        </p>
        <Link href="/community" className="text-accent hover:underline text-sm inline-block">
          ← Back to Community
        </Link>
      </div>
    </AppShell>
  );
}
