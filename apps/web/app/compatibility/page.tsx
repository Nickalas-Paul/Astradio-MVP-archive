'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

export default function CompatibilityPage() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-text">Compatibility</h1>
        <p className="text-subtext">
          Explore compatibility as curated clusters, not a scoreboard. No swiping, no percent grids.
        </p>
        <Link
          href="/compatibility/intent"
          className="inline-block px-6 py-3 rounded-lg bg-emerald text-bg font-medium hover:opacity-90"
        >
          Start intent-based search
        </Link>
      </div>
    </AppShell>
  );
}
