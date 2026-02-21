'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ClusterCards } from '@/components/compatibility/ClusterCards';
import type { Cluster } from '@/components/compatibility/ClusterCards';
import { useProfile } from '@/core/social/hooks';

function ResultsContent() {
  const searchParams = useSearchParams();
  const { primaryChart } = useProfile();
  const [data, setData] = useState<{ intent: string; clusters: Cluster[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intent = searchParams?.get('intent') ?? 'friendship';
  const keyword = searchParams?.get('keyword') ?? '';

  useEffect(() => {
    const stored = typeof window !== 'undefined' && typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('compat_intent_results') : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } catch {
        setError('Invalid results data');
      }
    } else {
      setError('No results. Start from the intent page.');
    }
  }, []);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Link href="/compatibility/intent" className="text-subtext hover:text-text text-sm">← New search</Link>
        <h1 className="text-2xl font-bold text-text">Clusters</h1>
        <p className="text-subtext text-sm">
          Intent: {intent}. No global ranked list — these are curated clusters by domain.
        </p>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {data && (
          <ClusterCards
            clusters={data.clusters}
            seekerChartId={primaryChart?.id ?? 'chart_profile_default'}
            keywordFilter={keyword || undefined}
          />
        )}
      </div>
    </AppShell>
  );
}

export default function CompatibilityResultsPage() {
  return (
    <Suspense fallback={<AppShell><div className="max-w-4xl mx-auto p-6 text-subtext">Loading…</div></AppShell>}>
      <ResultsContent />
    </Suspense>
  );
}
