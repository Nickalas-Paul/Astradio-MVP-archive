'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { CompatibilitySection } from '../../src/components/CompatibilitySection';
import { ConnectionInventoryPanel } from '../../src/components/community/ConnectionInventoryPanel';
import { DiscoveryUserSearch } from '../../src/components/community/DiscoveryUserSearch';
import { SignalsPanel } from '../../src/components/community/SignalsPanel';
import { useProfile } from '../../src/core/social/hooks';
import { hasRealChart } from '../../src/core/social/constants';
import { useHydrateCompositionUrls } from '../../src/hooks/useHydrateCompositionUrls';
import type { RelationalIntent } from '../../src/lib/relational-intent';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { Tabs } from '@/components/shared/Tabs';

const GROUPS_INTRO = 'Private groups of your connections used to view relational activation.';

type CommunityTabId = 'discovery' | 'connections';

function GroupsList({ userId }: { userId: string | null }) {
  const [groups, setGroups] = useState<Array<{ id: string; slug: string; name: string; description: string }>>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!userId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/groups', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setGroups(d.groups || []);
        setLoading(false);
      })
      .catch(() => {
        setGroups([]);
        setLoading(false);
      });
  }, [userId]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !userId) return;
    setCreating(true);
    try {
      const r = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim(),
          slug: createSlug.trim() || undefined,
        }),
      });
      if (r.ok) {
        const g = await r.json();
        setCreateOpen(false);
        setCreateName('');
        setCreateDesc('');
        setCreateSlug('');
        setGroups((prev) => [g, ...prev]);
      }
    } finally {
      setCreating(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.slug || '').toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q)
      )
    : groups;

  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card elevation="raised" padding="px-4 py-3" className="text-sm text-text-secondary">
          {GROUPS_INTRO}
        </Card>
        <p className="text-sm text-text-secondary">Sign in to list and create relational chart groups.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card elevation="raised" padding="px-4 py-3" className="text-sm text-text-secondary">
        {GROUPS_INTRO}
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Filter by name or slug…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          Create group
        </Button>
      </div>
      {createOpen && (
        <form onSubmit={onCreate} className="rounded-lg border border-border bg-surface-1 p-4 space-y-3">
          <input
            placeholder="Group name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="input w-full"
            required
          />
          <input
            placeholder="Slug (optional)"
            value={createSlug}
            onChange={(e) => setCreateSlug(e.target.value)}
            className="input w-full"
          />
          <textarea
            placeholder="Description"
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            className="input w-full"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-text-secondary text-sm">Loading groups…</p>
      ) : filtered.length === 0 ? (
        <Card elevation="raised" size="lg" className="text-center">
          <p className="text-text-secondary text-sm">No groups match.</p>
          <p className="text-xs text-text-secondary mt-1">{GROUPS_INTRO}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => (
            <li key={g.id}>
              <Link
                href={`/community/group/${encodeURIComponent(g.slug || g.id)}`}
                className="block rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2"
              >
                <h3 className="font-medium text-text-primary">{g.name}</h3>
                <p className="text-sm text-text-secondary mt-1 line-clamp-2">{g.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommunityClientInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CommunityTabId>('discovery');
  const [discoveryIntent, setDiscoveryIntent] = useState<RelationalIntent>('friend');
  const [inventoryRefreshSignal, setInventoryRefreshSignal] = useState(0);
  const bumpCommunityInventory = () => setInventoryRefreshSignal((n) => n + 1);
  const { user, primaryChart } = useProfile();

  useHydrateCompositionUrls();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'feed') {
      router.replace('/today');
      return;
    }
    if (t === 'discovery' || t === 'connections') {
      setActiveTab(t);
    }
  }, [searchParams, router]);

  const setTab = (t: CommunityTabId) => {
    setActiveTab(t);
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', t);
    router.replace(`/community?${next.toString()}`, { scroll: false });
  };

  const tabs: { id: CommunityTabId; label: string; icon: string }[] = [
    { id: 'discovery', label: 'Discovery', icon: '🔭' },
    { id: 'connections', label: 'Connections', icon: '🔗' },
  ];

  const seekerChartId = hasRealChart(primaryChart) ? primaryChart!.id : null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-h1 font-bold text-text-primary">Connections</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Discovery and connections — chart-based and deterministic.
          </p>
          <p className="text-sm text-text-secondary">
            Profile and saved tracks live under{' '}
            <Link href="/profile" className="text-accent-light hover:underline">
              My Sky
            </Link>
            .
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card size="lg" className="max-w-2xl mx-auto border-accent/40 space-y-4 text-center">
            <h2 className="font-serif text-h3 font-semibold text-text-primary">
              Hear what a relationship sounds like
            </h2>
            <p className="text-body-sm text-text-secondary">
              Combine two charts and hear the sonic signature of a connection.
            </p>
            <Link href="/listen">
              <Button type="button" variant="audio" size="md" className="min-h-[44px]">
                Choose two charts
              </Button>
            </Link>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="-mx-2 px-2 overflow-x-auto scrollbar-hide md:mx-0 md:px-0">
            <Tabs
              variant="pill"
              ariaLabel="Connections sections"
              className="min-w-max md:min-w-0"
              tabs={tabs.map((tab) => ({
                id: tab.id,
                label: tab.label,
                icon: tab.icon,
              }))}
              activeTab={activeTab}
              onTabChange={(id) => setTab(id as CommunityTabId)}
            />
          </div>
        </motion.div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {activeTab === 'discovery' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">Discovery</h2>
                <p className="text-text-secondary text-sm mb-6">
                  Find meaningful connections based on astrological compatibility. Choose your intent and
                  we&apos;ll show you the best matches.
                </p>
              </div>

              <DiscoveryUserSearch
                currentUserId={user?.id ?? null}
                seekerChartId={seekerChartId}
                intent={discoveryIntent}
                onConnectionRequested={bumpCommunityInventory}
                inventoryRefreshSignal={inventoryRefreshSignal}
              />

              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-text-primary mb-1">Intentional matching</h2>
                <p className="text-sm text-text-secondary max-w-2xl mb-2">
                  Choose an intent, then find matches. Results load only after you click Find matches and appear
                  directly below.
                </p>
                <CompatibilitySection
                  hasProfile={user !== null}
                  chartId={seekerChartId}
                  limit={10}
                  mode={discoveryIntent}
                  onModeChange={setDiscoveryIntent}
                  onSwitchToProfile={() => router.push('/profile')}
                  currentUserId={user?.id ?? null}
                  onConnectionRequested={bumpCommunityInventory}
                  inventoryRefreshSignal={inventoryRefreshSignal}
                />
              </section>
            </div>
          )}

          {activeTab === 'connections' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <SignalsPanel currentUserId={user?.id ?? null} />
              <ConnectionInventoryPanel
                currentUserId={user?.id ?? null}
                viewerChartId={seekerChartId}
                refreshSignal={inventoryRefreshSignal}
              />
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">Relational groups</h2>
                <GroupsList userId={user?.id ?? null} />
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}

export default function CommunityClient() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-text-secondary">Loading Connections…</div>}>
      <CommunityClientInner />
    </Suspense>
  );
}
