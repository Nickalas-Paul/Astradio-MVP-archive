'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AppShell } from '../../src/components/AppShell';
import { TrendingSection } from '../../src/components/TrendingSection';
import { SocialFeed } from '../../src/components/SocialFeed';
import { CompatibilitySection } from '../../src/components/CompatibilitySection';
import LibraryPanel from '../../src/components/library/LibraryPanel';
import CirclesPanel from '../../src/components/social/CirclesPanel';
import SessionsPanel from '../../src/components/social/SessionsPanel';
import AtlasSearch from '../../src/components/atlas/AtlasSearch';
import { useChartsStore, useCompositionStore } from '../../src/store';
import { isFeatureEnabled } from '../../src/core/config/flags';
import type { ChartSummary } from '../../src/types';

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<'feed' | 'matches' | 'connections' | 'saved' | 'search'>('feed');
  const [filter, setFilter] = useState<'all' | 'charts' | 'compositions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { charts } = useChartsStore();
  const { jobHistory } = useCompositionStore();

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
    { id: 'feed', label: 'Feed', icon: '📱' },
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold text-text">
            Community
          </h1>
          <p className="text-lg text-subtext max-w-2xl mx-auto">
            Connect with fellow astrologers, discover compatible matches, 
            and share your cosmic musical journey.
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-2 bg-panel rounded-full p-2 shadow-soft border border-border overflow-x-auto"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {activeTab === 'saved' && (
            <>
              {/* Filters and Search */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search charts and compositions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input w-full"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setFilter('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filter === 'all'
                          ? 'bg-emerald text-bg'
                          : 'bg-bgElev text-subtext hover:text-text'
                      }`}
                    >
                      All ({items.length})
                    </button>
                    <button
                      onClick={() => setFilter('charts')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filter === 'charts'
                          ? 'bg-emerald text-bg'
                          : 'bg-bgElev text-subtext hover:text-text'
                      }`}
                    >
                      Charts ({filteredCharts.length})
                    </button>
                    <button
                      onClick={() => setFilter('compositions')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        filter === 'compositions'
                          ? 'bg-emerald text-bg'
                          : 'bg-bgElev text-subtext hover:text-text'
                      }`}
                    >
                      Compositions ({filteredCompositions.length})
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Tab Content */}
        {activeTab === 'feed' && (
          <div className="space-y-6">
            <SocialFeed limit={10} />
            <TrendingSection limit={10} />
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="max-w-4xl mx-auto">
            <CompatibilitySection chartId="natal-1" limit={10} />
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
