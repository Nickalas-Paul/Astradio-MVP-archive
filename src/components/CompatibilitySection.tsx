'use client';

import { motion } from 'framer-motion';
import { useCompat } from '../core/social/hooks';
import { isFeatureEnabled } from '../../core/config/flags';
import { trackFeatureUse } from '../../core/telemetry';

interface CompatibilitySectionProps {
  chartId: string;
  limit?: number;
  className?: string;
}

export function CompatibilitySection({ chartId, limit = 3, className = '' }: CompatibilitySectionProps) {
  const { matches, loading, error } = useCompat(chartId, limit);

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_COMPAT')) {
    return null;
  }

  const handlePlayCompatibility = async (targetChartId: string, score: number) => {
    trackFeatureUse('compatibility', 'play_mix');
    
    try {
      // Generate two-chart composition for compatibility match
      const response = await fetch('/api/compose', {
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

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          Compatibility Matches
        </h3>
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
        <h3 className="text-lg font-semibold text-text mb-4">
          Compatibility Matches
        </h3>
        <div className="text-center py-8">
          <p className="text-subtext text-sm">Unable to load compatibility matches</p>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          Compatibility Matches
        </h3>
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
      <h3 className="text-lg font-semibold text-text mb-4">
        Compatibility Matches
      </h3>
      
      <div className="space-y-4">
        {matches.map((match, index) => (
          <motion.div
            key={`${match.targetUserId}-${match.targetChartId}`}
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
                    {match.targetUserId.slice(-2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-text">
                    User {match.targetUserId.slice(-4)}
                  </h4>
                  <p className="text-xs text-subtext">
                    Chart {match.targetChartId.slice(-4)}
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
                  {Math.round(match.compatibility.elemental * 100)}%
                </span>
              </div>
              <div className="text-xs">
                <span className="text-subtext">Modal:</span>
                <span className="text-violet ml-1">
                  {Math.round(match.compatibility.modal * 100)}%
                </span>
              </div>
              <div className="text-xs">
                <span className="text-subtext">Aspect:</span>
                <span className="text-warning ml-1">
                  {Math.round(match.compatibility.aspect * 100)}%
                </span>
              </div>
              <div className="text-xs">
                <span className="text-subtext">Preference:</span>
                <span className="text-success ml-1">
                  {Math.round(match.compatibility.preference * 100)}%
                </span>
              </div>
            </div>

            {/* Rationale */}
            <div className="mb-3">
              <p className="text-xs text-subtext mb-1">Why this works:</p>
              <div className="flex flex-wrap gap-1">
                {match.rationale.slice(0, 2).map((reason, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-emerald/10 text-emerald rounded-full"
                  >
                    {reason}
                  </span>
                ))}
                {match.rationale.length > 2 && (
                  <button
                    onClick={() => handleViewRationale(match.targetChartId)}
                    className="text-xs px-2 py-1 bg-bgElev text-subtext rounded-full hover:bg-border transition-colors"
                  >
                    +{match.rationale.length - 2} more
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handlePlayCompatibility(match.targetChartId, match.score)}
                className="flex-1 btn-primary text-sm py-2"
              >
                Play Mix
              </button>
              <button
                onClick={() => handleViewRationale(match.targetChartId)}
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
