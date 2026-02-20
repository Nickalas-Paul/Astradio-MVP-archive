'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { IntentForm } from '@/components/compatibility/IntentForm';
import { useProfile } from '@/core/social/hooks';

function IntentContent() {
  const searchParams = useSearchParams();
  const { primaryChart } = useProfile();
  const groupId = searchParams?.get('groupId') ?? null;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link href="/compatibility" className="text-subtext hover:text-text text-sm">← Compatibility</Link>
        <h1 className="text-2xl font-bold text-text">Compatibility intent</h1>
        <p className="text-subtext text-sm">
          Set your intent and preferences. No percentages or ranked lists — you&apos;ll get curated clusters with narrative guidance.
        </p>
        <IntentForm
          seekerChartId={primaryChart?.id ?? 'chart_profile_default'}
          groupId={groupId}
          defaultScope={groupId ? 'this_group' : 'my_groups'}
        />
      </div>
    </AppShell>
  );
}

export default function CompatibilityIntentPage() {
  return (
    <Suspense fallback={<AppShell><div className="max-w-3xl mx-auto p-6 text-subtext">Loading…</div></AppShell>}>
      <IntentContent />
    </Suspense>
  );
}
