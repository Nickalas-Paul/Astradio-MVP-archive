'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { RelationalCommunityFeed } from '../../src/components/community/RelationalCommunityFeed';
import { CompatibilitySection } from '../../src/components/CompatibilitySection';
import { CompareChartsPanel } from '../../src/components/community/CompareChartsPanel';
import { UserSearchPanel } from '../../src/components/community/UserSearchPanel';
import { ConnectionInventoryPanel } from '../../src/components/community/ConnectionInventoryPanel';
import { SignalsPanel } from '../../src/components/community/SignalsPanel';
import { IntentForm } from '../../src/components/compatibility/IntentForm';
import { DiscoveryClustersBanner } from './DiscoveryClustersBanner';
import { useProfile } from '../../src/core/social/hooks';
import { hasRealChart } from '../../src/core/social/constants';
import { useHydrateCompositionUrls } from '../../src/hooks/useHydrateCompositionUrls';
import { RELATIONAL_INTENT_OPTIONS, type RelationalIntent } from '../../src/lib/relational-intent';

const GUIDANCE_BANNER = 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.';

type CommunityTabId = 'feed' | 'discovery' | 'connections';

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
        <div className="rounded-lg border border-amber-200/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          {GUIDANCE_BANNER}
        </div>
        <p className="text-sm text-subtext">Sign in to list and create relational chart groups.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-200/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
        {GUIDANCE_BANNER}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Filter by name or slug…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium"
        >
          Create group
        </button>
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
              className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium disabled:opacity-50"
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
        <p className="text-subtext text-sm">Loading groups…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-bgElev p-6 text-center">
          <p className="text-subtext text-sm">No groups match.</p>
          <p className="text-xs text-subtext mt-1">Relational groups hold member charts for compatibility and forecasts.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => (
            <li key={g.id}>
              <Link
                href={`/community/group/${encodeURIComponent(g.slug || g.id)}`}
                className="block rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2"
              >
                <h3 className="font-medium text-text">{g.name}</h3>
                <p className="text-sm text-subtext mt-1 line-clamp-2">{g.description}</p>
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
  const [activeTab, setActiveTab] = useState<CommunityTabId>('feed');
  const [discoveryIntent, setDiscoveryIntent] = useState<RelationalIntent>('friend');
  const [inventoryRefreshSignal, setInventoryRefreshSignal] = useState(0);
  const bumpCommunityInventory = () => setInventoryRefreshSignal((n) => n + 1);
  const { user, primaryChart } = useProfile();

  useHydrateCompositionUrls();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'feed' || t === 'discovery' || t === 'connections') {
      setActiveTab(t);
    }
  }, [searchParams]);

  const setTab = (t: CommunityTabId) => {
    setActiveTab(t);
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', t);
    router.replace(`/community?${next.toString()}`, { scroll: false });
  };

  const tabs: { id: CommunityTabId; label: string; icon: string }[] = [
    { id: 'feed', label: 'Feed', icon: '📱' },
    { id: 'discovery', label: 'Discovery', icon: '🔭' },
    { id: 'connections', label: 'Connections', icon: '🔗' },
  ];

  const seekerChartId = hasRealChart(primaryChart) ? primaryChart!.id : null;
  const groupIdFromUrl = searchParams.get('groupId');

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-text">Community</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Relational weather, discovery, and connections — chart-based and deterministic.
          </p>
          <p className="text-sm text-subtext">
            Profile and saved tracks live under{' '}
            <Link href="/profile" className="text-emerald hover:underline">
              Profile
            </Link>
            .
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-2 bg-panel rounded-full p-2 shadow-soft border border-border overflow-x-auto"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`px-4 py-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-emerald text-bg shadow-md'
                  : 'text-subtext hover:text-text hover:bg-bgElev'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
            </button>
          ))}
        </motion.div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {activeTab === 'feed' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <RelationalCommunityFeed userId={user?.id ?? null} primaryChart={primaryChart} />
            </div>
          )}

          {activeTab === 'discovery' && (
            <div className="max-w-4xl mx-auto space-y-10">
              {searchParams.get('view') === 'clusters' && (
                <DiscoveryClustersBanner
                  onDismiss={() => {
                    try {
                      sessionStorage.removeItem('compat_intent_results');
                    } catch {
                      /* ignore */
                    }
                    const next = new URLSearchParams(searchParams.toString());
                    next.delete('view');
                    router.replace(`/community?${next.toString()}`, { scroll: false });
                  }}
                />
              )}
              <section className="card space-y-3">
                <h2 className="text-lg font-semibold text-text">Intent clusters</h2>
                <p className="text-sm text-subtext">
                  Ranked clusters use the same canonical compatibility field; intent only changes projection weights.
                </p>
                <IntentForm
                  defaultIntent="friend"
                  seekerChartId={seekerChartId ?? undefined}
                  groupId={groupIdFromUrl}
                  defaultScope={groupIdFromUrl ? 'this_group' : 'my_groups'}
                />
              </section>

              <section className="card space-y-3">
                <h2 className="text-lg font-semibold text-text">Directory search</h2>
                <p className="text-sm text-subtext">Search by name or handle. Use Evaluate to compare charts before requesting a connection.</p>
                <UserSearchPanel onInventoryRefresh={bumpCommunityInventory} />
              </section>

              <section className="card space-y-3">
                <h2 className="text-lg font-semibold text-text">Evaluate charts</h2>
                <p className="text-sm text-subtext">One-off comparison for a candidate (not a separate product surface).</p>
                <CompareChartsPanel onSwitchToGroups={() => setTab('connections')} />
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-text">Compatibility matches</h2>
                <p className="text-sm text-subtext max-w-2xl">
                  Ranked from the canonical field. Request connection with the selected intent; the other person must accept before the pair appears in
                  Connections and Feed.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {RELATIONAL_INTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDiscoveryIntent(opt.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        discoveryIntent === opt.value
                          ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/50'
                          : 'bg-bgElev text-subtext hover:text-text border border-border'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <CompatibilitySection
                  hasProfile={user !== null}
                  chartId={seekerChartId}
                  limit={10}
                  mode={discoveryIntent}
                  onModeChange={setDiscoveryIntent}
                  onSwitchToProfile={() => router.push('/profile')}
                  currentUserId={user?.id ?? null}
                  onConnectionRequested={bumpCommunityInventory}
                />
              </section>
            </div>
          )}

          {activeTab === 'connections' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <SignalsPanel currentUserId={user?.id ?? null} />
              <ConnectionInventoryPanel currentUserId={user?.id ?? null} refreshSignal={inventoryRefreshSignal} />
              <div>
                <h2 className="text-lg font-semibold text-text mb-2">Relational groups</h2>
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
    <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-subtext">Loading Community…</div>}>
      <CommunityClientInner />
    </Suspense>
  );
}
