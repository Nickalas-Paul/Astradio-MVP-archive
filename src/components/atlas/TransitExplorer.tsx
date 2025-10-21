'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AtlasAPI } from '../../core/atlas/atlas-api';
import { isFeatureEnabled } from '../../core/config/flags';
import { trackFeatureUse } from '../../core/telemetry';
import type { TransitExplainer } from '../../core/social/types';

export default function TransitExplorer() {
  const [selectedTransit, setSelectedTransit] = useState('venus-trine-mars');
  const [transitData, setTransitData] = useState<TransitExplainer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_ATLAS')) {
    return null;
  }

  const availableTransits = [
    { id: 'venus-trine-mars', label: 'Venus Trine Mars', description: 'Harmony between love and action' },
    { id: 'sun-conjunction-moon', label: 'Sun Conjunction Moon', description: 'New beginnings and fresh starts' },
    { id: 'mars-square-saturn', label: 'Mars Square Saturn', description: 'Frustration and obstacles' },
    { id: 'venus-opposition-jupiter', label: 'Venus Opposition Jupiter', description: 'Excess and overindulgence' }
  ];

  useEffect(() => {
    const loadTransit = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await AtlasAPI.transit(selectedTransit);
        setTransitData(data);
        trackFeatureUse('atlas', 'view_transit', { transitId: selectedTransit });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transit');
        setTransitData(null);
      } finally {
        setLoading(false);
      }
    };

    loadTransit();
  }, [selectedTransit]);

  const getTransitIcon = (transitId: string) => {
    if (transitId.includes('venus')) return '🌟';
    if (transitId.includes('mars')) return '🔥';
    if (transitId.includes('sun')) return '☀️';
    if (transitId.includes('moon')) return '🌙';
    if (transitId.includes('jupiter')) return '♃';
    if (transitId.includes('saturn')) return '♄';
    return '⚡';
  };

  const getAspectIcon = (transitId: string) => {
    if (transitId.includes('trine')) return '⚡';
    if (transitId.includes('conjunction')) return '🔗';
    if (transitId.includes('square')) return '⚔️';
    if (transitId.includes('opposition')) return '⚖️';
    return '⚡';
  };

  const getTransitColor = (transitId: string) => {
    if (transitId.includes('trine') || transitId.includes('conjunction')) return 'text-emerald';
    if (transitId.includes('square') || transitId.includes('opposition')) return 'text-warning';
    return 'text-violet';
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-text">Transit Explorer</h3>
        <p className="text-sm text-subtext">
          Explore current and upcoming astrological transits and their meanings
        </p>
      </div>

      {/* Transit Selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text">Select Transit:</label>
        <div className="grid gap-2">
          {availableTransits.map(transit => (
            <button
              key={transit.id}
              onClick={() => setSelectedTransit(transit.id)}
              className={`p-3 rounded-xl border transition-colors text-left ${
                selectedTransit === transit.id
                  ? 'border-emerald bg-emerald/10 text-emerald'
                  : 'border-border bg-bgElev text-text hover:border-emerald/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getTransitIcon(transit.id)}</div>
                <div className="flex-1">
                  <div className="font-medium">{transit.label}</div>
                  <div className="text-sm text-subtext">{transit.description}</div>
                </div>
                <div className="text-xl">{getAspectIcon(transit.id)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Transit Details */}
      {loading ? (
        <div className="p-6 rounded-2xl border border-border bg-bgElev">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-subtext">Loading transit details...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl border border-danger bg-danger/10 text-danger">
          <p className="text-sm">{error}</p>
        </div>
      ) : transitData ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Transit Header */}
          <div className="p-4 rounded-2xl border border-border bg-bgElev">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl">{getTransitIcon(selectedTransit)}</div>
              <div className="flex-1">
                <h4 className="text-xl font-semibold text-text">{transitData.title}</h4>
                <p className="text-sm text-subtext">{transitData.excerpt}</p>
              </div>
              <div className="text-2xl">{getAspectIcon(selectedTransit)}</div>
            </div>
            
            {/* Tags */}
            {transitData.tags && transitData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {transitData.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 rounded-full bg-violet/10 text-violet border border-violet/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Transit Content */}
          {transitData.bodyMD && (
            <div className="p-4 rounded-2xl border border-border bg-bgElev">
              <div className="prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {transitData.bodyMD}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                trackFeatureUse('atlas', 'share_transit', { transitId: selectedTransit });
                // TODO: Implement sharing functionality
                console.log('Share transit:', selectedTransit);
              }}
              className="flex-1 px-4 py-2 rounded-xl bg-bgElev border border-border text-text hover:bg-border transition-colors"
            >
              Share Transit
            </button>
            <button
              onClick={() => {
                trackFeatureUse('atlas', 'save_transit', { transitId: selectedTransit });
                // TODO: Implement save to favorites functionality
                console.log('Save transit:', selectedTransit);
              }}
              className="flex-1 px-4 py-2 rounded-xl bg-emerald text-bg hover:bg-emeraldMuted transition-colors"
            >
              Save to Favorites
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="p-6 rounded-2xl border border-border bg-bgElev text-center">
          <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-subtext text-sm">Select a transit to explore</p>
        </div>
      )}

      {/* Quick Tips */}
      <div className="p-4 rounded-2xl border border-border bg-bgElev">
        <h5 className="text-sm font-medium text-text mb-2">💡 Quick Tips</h5>
        <ul className="text-xs text-subtext space-y-1">
          <li>• Transits affect everyone differently based on your natal chart</li>
          <li>• Pay attention to which houses the transiting planets activate</li>
          <li>• Use transits as opportunities for growth and awareness</li>
          <li>• Keep a transit journal to track patterns over time</li>
        </ul>
      </div>
    </div>
  );
}
