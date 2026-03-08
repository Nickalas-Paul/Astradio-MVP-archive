'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { TrendingSection } from '../../src/components/TrendingSection';
import { SocialFeed } from '../../src/components/SocialFeed';
import { CompatibilitySection } from '../../src/components/CompatibilitySection';
import { CompareChartsPanel } from '../../src/components/community/CompareChartsPanel';
import { ProfilePanel } from '../../src/components/community/ProfilePanel';
import { UserSearchPanel } from '../../src/components/community/UserSearchPanel';
import LibraryPanel from '../../src/components/library/LibraryPanel';
import { useProfile } from '../../src/core/social/hooks';
import { hasRealChart } from '../../src/core/social/constants';
import AtlasSearch from '../../src/components/atlas/AtlasSearch';
import { useChartsStore, useCompositionStore } from '../../src/store';
import { isFeatureEnabled } from '../../src/core/config/flags';

const CirclesPanel = dynamic(
  () => import('../../src/components/social/CirclesPanel').then((m) => m.default),
  { ssr: false, loading: () => <div className="text-subtext text-sm p-4">Loading…</div> }
);
const SessionsPanel = dynamic(
  () => import('../../src/components/social/SessionsPanel').then((m) => m.default),
  { ssr: false, loading: () => <div className="text-subtext text-sm p-4">Loading…</div> }
);

function SavedCompositionsBlock() {
  const { jobHistory } = useCompositionStore();
  const ready = jobHistory.filter((j) => j.status.stage === 'ready');
  if (ready.length === 0) return null;
  return (
    <section className="card space-y-3">
      <h3 className="text-lg font-semibold text-text">Saved Tracks</h3>
      <p className="text-sm text-subtext">Compositions generated from your profile or charts, including your natal baseline.</p>
      <ul className="space-y-2">
        {ready.map((job) => {
          const url = job.status.stage === 'ready' ? job.status.url : '';
          const label = job.request.chartB ? 'Comparison' : (job.id.startsWith('natal_') ? 'Natal baseline' : job.request.genre);
          return (
            <li
              key={job.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-bgElev"
            >
              <span className="font-medium text-text truncate">{label}</span>
              {url ? (
                <audio controls src={url} className="h-8 max-w-[200px] flex-shrink-0" preload="metadata" />
              ) : (
                <span className="text-xs text-subtext">No audio</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const GUIDANCE_BANNER = 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.';

function GroupsList() {
  const [groups, setGroups] = useState<Array<{ id: string; slug: string; name: string; description: string; tags: string[]; memberCount?: number }>>([]);
  const [tagFilter, setTagFilter] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createTags, setCreateTags] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tagFilter) params.set('tag', tagFilter);
    if (query.trim()) params.set('q', query.trim());
    fetch(`/api/community/groups?${params}`)
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(d => { setGroups(d.groups || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tagFilter, query]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch('/api/community/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim(),
          slug: createSlug.trim() || undefined,
          tags: createTags.split(',').map(s => s.trim()).filter(Boolean)
        })
      });
      if (r.ok) {
        const g = await r.json();
        setCreateOpen(false);
        setCreateName('');
        setCreateDesc('');
        setCreateSlug('');
        setCreateTags('');
        setGroups(prev => [g, ...prev]);
      }
    } finally {
      setCreating(false);
    }
  };

  const allTags = Array.from(new Set(groups.flatMap(g => g.tags || [])));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-lg border border-amber-200/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
        {GUIDANCE_BANNER}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search groups…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="input flex-1 min-w-[200px]"
        />
        <select
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
        >
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
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
            onChange={e => setCreateName(e.target.value)}
            className="input w-full"
            required
          />
          <input
            placeholder="Slug (optional)"
            value={createSlug}
            onChange={e => setCreateSlug(e.target.value)}
            className="input w-full"
          />
          <textarea
            placeholder="Description"
            value={createDesc}
            onChange={e => setCreateDesc(e.target.value)}
            className="input w-full"
            rows={2}
          />
          <input
            placeholder="Tags (comma-separated)"
            value={createTags}
            onChange={e => setCreateTags(e.target.value)}
            className="input w-full"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium disabled:opacity-50">Create</button>
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-subtext text-sm">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-bgElev p-6 text-center">
          <p className="text-subtext text-sm">No groups yet.</p>
          <p className="text-xs text-subtext mt-1">Create a group above, or search by tag. Groups are shared spaces for discussion and compatibility by context.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map(g => (
            <li key={g.id}>
              <Link
                href={`/community/group/${g.slug || g.id}`}
                className="block rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2"
              >
                <h3 className="font-medium text-text">{g.name}</h3>
                <p className="text-sm text-subtext mt-1 line-clamp-2">{g.description}</p>
                {g.tags && g.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {g.tags.map(t => <span key={t} className="px-2 py-0.5 rounded bg-surface-2 text-xs text-subtext">{t}</span>)}
                  </div>
                )}
                {(g as { memberCount?: number }).memberCount != null && (
                  <p className="text-xs text-subtext mt-2">{(g as { memberCount?: number }).memberCount} members</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type CommunityTabId = 'profile' | 'feed' | 'groups' | 'connections' | 'compare' | 'saved' | 'search';

const CONNECTIONS_INTENTS: { id: string; mode: 'friend' | 'lover' | 'rival'; label: string }[] = [
  { id: 'friendship', mode: 'friend', label: 'Friendship' },
  { id: 'dating', mode: 'lover', label: 'Dating' },
  { id: 'creative', mode: 'friend', label: 'Creative collaboration' },
  { id: 'study', mode: 'friend', label: 'Study partners' },
  { id: 'shadow', mode: 'rival', label: 'Shadow work partners' },
  { id: 'campaign', mode: 'friend', label: 'Campaign party' },
];

export default function CommunityClient() {
  const [activeTab, setActiveTab] = useState<CommunityTabId>('profile');
  const [filter, setFilter] = useState<'all' | 'charts' | 'compositions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionsIntentId, setConnectionsIntentId] = useState<string>('friendship');
  const connectionsMode = CONNECTIONS_INTENTS.find((i) => i.id === connectionsIntentId)?.mode ?? 'friend';
  const { charts } = useChartsStore();
  const { jobHistory } = useCompositionStore();
  const { user, primaryChart } = useProfile();

  const filteredCharts = charts.filter(chart =>
    chart.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredCompositions = jobHistory.filter(job =>
    job.request.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilteredItems = () => {
    switch (filter) {
      case 'charts':
        return filteredCharts;
      case 'compositions':
        return filteredCompositions;
      default:
        return [...filteredCharts, ...filteredCompositions];
    }
  };

  const items = getFilteredItems();

  const tabs: { id: CommunityTabId; label: string; icon: string }[] = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'feed', label: 'Feed', icon: '📱' },
    { id: 'groups', label: 'Groups', icon: '👥' },
    { id: 'connections', label: 'Connections', icon: '🔗' },
    { id: 'compare', label: 'Compare', icon: '⚖️' },
    { id: 'saved', label: 'Saved Tracks', icon: '💾' },
    { id: 'search', label: 'Search', icon: '🔍' },
  ];

  return (
    <AppShell showContextRail contextRailContent={
      isFeatureEnabled('ENABLE_SOCIAL') && activeTab === 'connections' ? (
        <div className="space-y-6">
          <CirclesPanel />
          <SessionsPanel />
        </div>
      ) : null
    }>
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-text">Community</h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Connect with fellow astrologers, discover compatible matches,
            and share your cosmic musical journey.
          </p>
          <Link href="/compatibility" className="text-emerald-500 hover:underline text-sm">
            Compatibility (intent-based clusters)
          </Link>
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
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
          {activeTab === 'saved' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search charts and compositions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'all' ? 'bg-emerald text-bg' : 'bg-bgElev text-subtext hover:text-text'
                    }`}
                  >
                    All ({items.length})
                  </button>
                  <button
                    onClick={() => setFilter('charts')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'charts' ? 'bg-emerald text-bg' : 'bg-bgElev text-subtext hover:text-text'
                    }`}
                  >
                    Charts ({filteredCharts.length})
                  </button>
                  <button
                    onClick={() => setFilter('compositions')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === 'compositions' ? 'bg-emerald text-bg' : 'bg-bgElev text-subtext hover:text-text'
                    }`}
                  >
                    Compositions ({filteredCompositions.length})
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {activeTab === 'profile' && (
          <ProfilePanel onSwitchToConnections={() => setActiveTab('connections')} />
        )}

        {activeTab === 'feed' && (
          <div className="space-y-6">
            <SocialFeed limit={10} />
            <TrendingSection limit={10} />
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <p className="text-sm text-subtext max-w-xl">
              Compare two charts by birth data. Use location search and date/time for each chart; coordinates are set from your place selection. Relationship mode shapes the compatibility reading.
            </p>
            <CompareChartsPanel onSwitchToGroups={() => setActiveTab('groups')} />
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <section className="card space-y-3">
              <h3 className="text-lg font-semibold text-text">What are you looking for?</h3>
              <div className="flex flex-wrap gap-2">
                {CONNECTIONS_INTENTS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setConnectionsIntentId(opt.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      connectionsIntentId === opt.id
                        ? 'bg-emerald-500 text-white ring-2 ring-emerald-500/50'
                        : 'bg-bgElev text-subtext hover:text-text border border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-subtext">
                Selected: <span className="font-medium text-text">{CONNECTIONS_INTENTS.find((i) => i.id === connectionsIntentId)?.label ?? 'Friendship'}</span>
              </p>
            </section>
            <CompatibilitySection
              hasProfile={user !== null}
              chartId={hasRealChart(primaryChart) ? primaryChart!.id : null}
              limit={10}
              mode={connectionsMode}
              onModeChange={(m) => {
                const next = CONNECTIONS_INTENTS.find((i) => i.mode === m);
                if (next) setConnectionsIntentId(next.id);
              }}
              onSwitchToProfile={() => setActiveTab('profile')}
            />
            <section className="card space-y-3">
              <h3 className="text-lg font-semibold text-text">Your connections</h3>
              <p className="text-sm text-subtext">People you’ve connected with appear in the panel to the right. Use the compatibility finder above to discover new connections, then add them here.</p>
            </section>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <SavedCompositionsBlock />
            <LibraryPanel />
          </div>
        )}

        {activeTab === 'search' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <p className="text-sm text-subtext max-w-xl">
              Search by name or handle. Compare uses your stored chart only. Results are compatibility- and visibility-aware — not an open directory.
            </p>
            <UserSearchPanel />
            <AtlasSearch />
          </div>
        )}

        {activeTab === 'groups' && (
          <GroupsList />
        )}
      </div>
    </AppShell>
  );
}
