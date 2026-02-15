'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { TrendingSection } from '../../src/components/TrendingSection';
import { SocialFeed } from '../../src/components/SocialFeed';
import { CompatibilitySection } from '../../src/components/CompatibilitySection';
import { CompareChartsPanel } from '../../src/components/community/CompareChartsPanel';
import { ProfilePanel } from '../../src/components/community/ProfilePanel';
import LibraryPanel from '../../src/components/library/LibraryPanel';
import { useProfile } from '../../src/core/social/hooks';
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

export default function CommunityClient() {
  const [activeTab, setActiveTab] = useState<'profile' | 'feed' | 'compare' | 'matches' | 'connections' | 'saved' | 'search' | 'circles' | 'sessions'>('profile');
  const [filter, setFilter] = useState<'all' | 'charts' | 'compositions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { charts } = useChartsStore();
  const { jobHistory } = useCompositionStore();
  const { primaryChart } = useProfile();

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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'feed', label: 'Feed', icon: '📱' },
    { id: 'compare', label: 'Compare Charts', icon: '⚖️' },
    { id: 'matches', label: 'Matches', icon: '💫' },
    { id: 'connections', label: 'Connections', icon: '👥' },
    { id: 'saved', label: 'Saved Tracks', icon: '💾' },
    { id: 'search', label: 'Search', icon: '🔍' }
  ];

  return (
    <AppShell showContextRail contextRailContent={
      isFeatureEnabled('ENABLE_SOCIAL') && (activeTab === 'circles' || activeTab === 'sessions') ? (
        <div className="space-y-6">
          {activeTab === 'circles' && <CirclesPanel />}
          {activeTab === 'sessions' && <SessionsPanel />}
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
          <ProfilePanel onSwitchToMatches={() => setActiveTab('matches')} />
        )}

        {activeTab === 'feed' && (
          <div className="space-y-6">
            <SocialFeed limit={10} />
            <TrendingSection limit={10} />
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="max-w-4xl mx-auto">
            <CompareChartsPanel />
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="max-w-4xl mx-auto">
            <CompatibilitySection chartId={primaryChart?.id ?? null} limit={10} />
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
            <CirclesPanel />
            <SessionsPanel />
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-4xl mx-auto">
            <LibraryPanel />
          </div>
        )}

        {activeTab === 'search' && (
          <div className="max-w-4xl mx-auto">
            <AtlasSearch />
          </div>
        )}
      </div>
    </AppShell>
  );
}
