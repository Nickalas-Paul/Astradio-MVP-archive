'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../core/api-base';
import { useCompat } from '../core/social/hooks';
import { isFeatureEnabled } from '../core/config/flags';
import { trackFeatureUse } from '../core/telemetry';

type CompatMode = 'friend' | 'lover' | 'rival';

interface CompatibilitySectionProps {
  chartId: string | null;
  limit?: number;
  className?: string;
}

const MODES: { value: CompatMode; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'lover', label: 'Lover' },
  { value: 'rival', label: 'Rival' },
];

export function CompatibilitySection({ chartId, limit = 10, className = '' }: CompatibilitySectionProps) {
  const [mode, setMode] = useState<CompatMode>('friend');
  const { matches, isLoading: loading, error, refresh } = useCompat({
    chartId,
    mode,
    limit,
  });

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_COMPAT')) {
    return null;
  }

  if (!chartId) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">Compatibility Matches</h3>
        <p className="text-subtext text-sm">
          Add your birth chart in Profile first. Matches use your stored natal chart only — no default or placeholder chart.
        </p>
        <p className="text-xs text-subtext mt-2">
          Create a profile with birth data, or build a chart in Sandbox. Then return here to see compatibility-driven results.
        </p>
      </div>
    );
  }

  const handlePlayCompatibility = async (targetChartId: string, score: number) => {
    trackFeatureUse('compatibility', 'play_mix');
    
    try {
      // Generate two-chart composition for compatibility match
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'compatibility',
          chartId1: chartId,
          chartId2: targetChartId,
          compatibilityScore: score,
          seed: Date.now() // Use timestamp for unique composition
        })
      });
      
      const composition = await response.json();
      
      // Open two-chart composition with explainer and viz
      console.log('Two-chart composition generated:', composition);
      // TODO: Navigate to composition player or open modal
      
    } catch (error) {
      console.error('Failed to generate compatibility composition:', error);
    }
  };

  const handleViewRationale = (targetChartId: string) => {
    trackFeatureUse('compatibility', 'view_rationale');
    // TODO: Open rationale modal or navigate to detail page
    console.log('Viewing rationale for chart:', targetChartId);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald';
    if (score >= 0.6) return 'text-warning';
    return 'text-danger';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    return 'Fair';
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <h3 className="text-lg font-semibold text-text">Compatibility Matches</h3>
      <div className="flex items-center gap-2">
        <div className="flex rounded-full bg-bgElev border border-border p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                mode === m.value ? 'bg-emerald text-bg' : 'text-subtext hover:text-text'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-sm bg-bgElev text-subtext hover:text-text border border-border disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`card ${className}`}>
        {header}
        <div className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${className}`}>
        {header}
        <div className="text-center py-8">
          <p className="text-subtext text-sm">Unable to load compatibility matches</p>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={`card ${className}`}>
        {header}
        <div className="text-center py-8">
          <p className="text-subtext text-sm">No compatibility matches found</p>
          <p className="text-xs text-subtext mt-1">
            Create a compatibility profile to find matches
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      {header}
      
      <div className="space-y-4">
        {matches.map((match, index) => (
          <motion.div
            key={`${match.userId}-${match.chartId}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 bg-bgElev rounded-lg border border-border hover:border-emerald/50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet to-emerald rounded-full flex items-center justify-center">
                  <span className="text-bg font-bold text-sm">
                    {match.userId.slice(-2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text">
                    {match.displayName ?? `User ${match.userId.slice(-4)}`}
                  </h4>
                  <p className="text-xs text-subtext">
                    Chart {match.chartId.slice(-4)}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-lg font-bold ${getScoreColor(match.score)}`}>
                  {Math.round(match.score * 100)}%
                </div>
                <div className="text-xs text-subtext">
                  {getScoreLabel(match.score)}
                </div>
              </div>
            </div>

            {/* Compatibility Breakdown */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="text-xs">
                <span className="text-subtext">Elemental:</span>
                <span className="text-emerald ml-1">
                  {Math.round((match.facets[0]?.score ?? match.score) * 100)}%
                </span>
              </div>
              <div className="text-xs">
                <span className="text-subtext">Modal:</span>
                <span className="text-violet ml-1">
                  {Math.round((match.facets[1]?.score ?? match.score) * 100)}%
                </span>
              </div>
              <div className="text-xs">
                <span className="text-subtext">Aspect:</span>
                <span className="text-warning ml-1">
                  {Math.round((match.facets[2]?.score ?? match.score) * 100)}%
                </span>
              </div>
              <div className="text-xs">
                <span className="text-subtext">Preference:</span>
                <span className="text-success ml-1">
                  {Math.round((match.facets[3]?.score ?? match.score) * 100)}%
                </span>
              </div>
            </div>

            {/* Rationale */}
            <div className="mb-3">
              <p className="text-xs text-subtext mb-1">Why this works:</p>
              <div className="flex flex-wrap gap-1">
                <span className="text-xs px-2 py-1 bg-emerald/10 text-emerald rounded-full">
                  {match.rationale}
                </span>
                <button
                  onClick={() => handleViewRationale(match.chartId)}
                  className="text-xs px-2 py-1 bg-bgElev text-subtext rounded-full hover:bg-border transition-colors"
                >
                  Details
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handlePlayCompatibility(match.chartId, match.score)}
                className="flex-1 btn-primary text-sm py-2"
              >
                Play Mix
              </button>
              <button
                onClick={() => handleViewRationale(match.chartId)}
                className="px-3 py-2 bg-bgElev text-subtext rounded-lg hover:bg-border transition-colors text-sm"
              >
                Details
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
