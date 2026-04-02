'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CompatibilityLensModal } from '@/components/compatibility/CompatibilityLensModal';
import { useProfile } from '@/core/social/hooks';
import { hasRealChart } from '@/core/social/constants';

interface ProfileByHandleUser {
  userId: string;
  displayName: string;
  chartId: string;
  label?: string;
  handle?: string;
}

export default function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const [handle, setHandle] = useState('');
  const [user, setUser] = useState<ProfileByHandleUser | null>(null);
  const [personality, setPersonality] = useState<{ temperament?: { activation?: number; stability?: number }; emphasis?: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lensOpen, setLensOpen] = useState(false);
  const { primaryChart } = useProfile();
  const seekerChartId = hasRealChart(primaryChart) ? primaryChart.id : null;

  useEffect(() => {
    params.then((p) => setHandle(decodeURIComponent(p.handle)));
  }, [params]);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setUser(null);
    setPersonality(null);

    (async () => {
      try {
        const pr = await fetch(`/api/profile/${encodeURIComponent(handle)}`);
        if (!pr.ok) {
          setLoading(false);
          return;
        }
        const data = await pr.json();
        const u = data.user as { id?: string; displayName?: string; handle?: string } | null;
        const pc = data.primaryChart as { id?: string; label?: string } | null;
        if (!u?.id || !pc?.id) {
          setLoading(false);
          return;
        }
        setUser({
          userId: u.id,
          displayName: u.displayName || u.id,
          chartId: pc.id,
          label: pc.label,
          handle: u.handle,
        });

        const chartRes = await fetch(`/api/profile/chart?chartId=${encodeURIComponent(pc.id)}`);
        if (chartRes.ok) {
          const chartData = await chartRes.json();
          const p = chartData.personality as
            | { temperament?: { activation?: number; stability?: number }; emphasis?: Record<string, number> }
            | undefined;
          if (p) setPersonality({ temperament: p.temperament, emphasis: p.emphasis });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [handle]);

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-6 text-subtext">Loading profile…</div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto p-6">
          <p className="text-red-500">User not found</p>
          <Link href="/community" className="text-emerald-500 hover:underline mt-2 inline-block">← Community</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Link href="/community" className="text-subtext hover:text-text text-sm">← Community</Link>

        <header>
          <h1 className="text-2xl font-bold text-text">{user.displayName || user.userId}</h1>
          <p className="text-subtext text-sm">{user.userId}</p>
          {user.label && <p className="text-subtext text-sm">{user.label}</p>}
        </header>

        {personality && (
          <section className="rounded-lg border border-border bg-surface-1 p-4">
            <h2 className="text-lg font-medium text-text mb-2">Personality summary</h2>
            {personality.temperament && (
              <p className="text-sm text-subtext">
                Temperament: activation {((personality.temperament.activation ?? 0.5) * 100).toFixed(0)}%, stability{' '}
                {((personality.temperament.stability ?? 0.5) * 100).toFixed(0)}%
              </p>
            )}
            {personality.emphasis && typeof personality.emphasis === 'object' && (
              <p className="text-sm text-subtext mt-1">
                Emphasis: inner world {(((personality.emphasis as Record<string, number>).innerWorld ?? 0.25) * 100).toFixed(0)}%, relational{' '}
                {(((personality.emphasis as Record<string, number>).relational ?? 0.25) * 100).toFixed(0)}%, public{' '}
                {(((personality.emphasis as Record<string, number>).publicRole ?? 0.25) * 100).toFixed(0)}%
              </p>
            )}
          </section>
        )}

        {seekerChartId ? (
          <>
            <button
              type="button"
              onClick={() => setLensOpen(true)}
              className="px-4 py-2 rounded-lg bg-emerald text-bg font-medium"
            >
              Run compatibility lens
            </button>
            {lensOpen && (
              <CompatibilityLensModal
                seekerChartId={seekerChartId}
                targetChartId={user.chartId}
                targetDisplayName={user.displayName || user.userId}
                onClose={() => setLensOpen(false)}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-subtext">Add your birth chart in Profile to run the compatibility lens.</p>
        )}
      </div>
    </AppShell>
  );
}
