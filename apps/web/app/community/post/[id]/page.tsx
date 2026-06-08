'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

/** Legacy social posts were removed; Connections is discovery + inventory only. */
export default function CommunityPostRetiredPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <p className="text-text-primary">Legacy social posts are no longer available.</p>
        <p className="text-sm text-text-secondary">
          Use <Link href="/today" className="text-accent-light hover:underline">Today</Link> for relational
          transits, or{' '}
          <Link href="/community?tab=discovery" className="text-accent-light hover:underline">
            Connections → Discovery
          </Link>{' '}
          for compatibility search.
        </p>
        <Link href="/community" className="text-accent hover:underline text-sm inline-block">
          ← Back to Connections
        </Link>
      </div>
    </AppShell>
  );
}
