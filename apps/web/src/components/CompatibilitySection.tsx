'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../core/api-base';
import { useCompat } from '../core/social/hooks';
import { isFeatureEnabled } from '../core/config/flags';
import { trackFeatureUse } from '../core/telemetry';

type CompatMode = 'friend' | 'lover' | 'rival';

interface CompatibilitySectionProps {
  /** When false, show create-profile CTA first. When true, chartId may still be null (profile exists but no real chart). */
  hasProfile: boolean;
  chartId: string | null;
  limit?: number;
  className?: string;
  onSwitchToProfile?: () => void;
  /** Optional controlled mode (e.g. from Connections intent selector). */
  mode?: CompatMode;
  onModeChange?: (mode: CompatMode) => void;
  /** Phase 8 — session user id for connection requests (not persisted until peer accepts). */
  currentUserId?: string | null;
  /** Called after a connection request is sent successfully. */
  onConnectionRequested?: () => void;
}

const MODES: { value: CompatMode; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'lover', label: 'Lover' },
  { value: 'rival', label: 'Rival' },
];

export function CompatibilitySection({
  hasProfile,
  chartId,
  limit = 10,
  className = '',
  onSwitchToProfile,
  mode: controlledMode,
  onModeChange,
  currentUserId,
  onConnectionRequested,
}: CompatibilitySectionProps) {
  const [internalMode, setInternalMode] = useState<CompatMode>('friend');
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const mode = controlledMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const { matches, isLoading: loading, error, refresh } = useCompat({
    chartId,
    mode,
    limit,
  });

  const modeLabel = MODES.find((m) => m.value === mode)?.label ?? mode;

  // 1) No user profile → profile creation CTA
  if (!hasProfile) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">Compatibility</h3>
        <p className="text-subtext text-sm">
          Create a profile with your natal chart first. Astradio profiles are chart-based — add your birth date, time, and birth place in the Profile tab. Then return here to find compatible connections.
        </p>
        {controlledMode != null && (
          <p className="text-xs text-subtext mt-2">Looking for: {modeLabel}</p>
        )}
        {onSwitchToProfile && (
          <button
            type="button"
            onClick={onSwitchToProfile}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium hover:opacity-90"
          >
            Go to Profile to create one
          </button>
        )}
      </div>
    );
  }

  // 2) Profile exists but no real chart → add natal chart
  if (!chartId) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">Compatibility</h3>
        <p className="text-subtext text-sm">
          Add your natal chart to your profile to see compatibility-driven matches. Go to the Profile tab and add your birth date, time, and birth place.
        </p>
        {controlledMode != null && (
          <p className="text-xs text-subtext mt-2">Looking for: {modeLabel}</p>
        )}
        {onSwitchToProfile && (
          <button
            type="button"
            onClick={onSwitchToProfile}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium hover:opacity-90"
          >
            Add your natal chart
          </button>
        )}
      </div>
    );
  }

  // 3) Chart exists but compatibility disabled → truthful message
  if (!isFeatureEnabled('ENABLE_COMPAT')) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">Compatibility</h3>
        <p className="text-subtext text-sm">
          You’re set up with a natal chart. Compatibility matching will be enabled in a future update.
        </p>
        {controlledMode != null && (
          <p className="text-xs text-subtext mt-2">Looking for: {modeLabel}</p>
        )}
      </div>
    );
  }

  const handlePlayCompatibility = async (_targetChartId: string, _score: number) => {
    trackFeatureUse('compatibility', 'play_mix_attempt_blocked_stage2');
    console.warn('[CompatibilitySection] Play Mix is disabled in Stage 2; use /api/comparisons-only flow for compatibility.');
  };

  const handleViewRationale = (targetChartId: string) => {
    trackFeatureUse('compatibility', 'view_rationale');
    // TODO: Open rationale modal or navigate to detail page
    console.log('Viewing rationale for chart:', targetChartId);
  };

  const handleRequestConnection = async (match: { userId: string; chartId: string }) => {
    if (!chartId || !currentUserId) {
      setRequestMsg('Sign in and ensure your chart is set to request a connection.');
      return;
    }
    setRequestBusy(match.chartId);
    setRequestMsg(null);
    try {
      trackFeatureUse('compatibility', 'connection_request');
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/connect-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          toUserId: match.userId,
          fromChartId: chartId,
          toChartId: match.chartId,
          label: 'Connection',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRequestMsg(typeof j.error === 'string' ? j.error : `Request failed (${r.status})`);
        return;
      }
      setRequestMsg('Request sent. They must accept before it appears in Saved connections.');
      onConnectionRequested?.();
    } catch (e) {
      setRequestMsg(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRequestBusy(null);
    }
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
          <p className="text-subtext text-sm">No eligible matches for your chart.</p>
          <p className="text-xs text-subtext mt-1">
            Make sure you’ve added your birth chart in Profile. Matches are compatibility-driven — no results means no candidates meet the current criteria, or the directory has no eligible charts yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      {header}
      {requestMsg && (
        <p className="text-sm text-subtext mb-3 rounded-lg border border-border bg-bgElev px-3 py-2">{requestMsg}</p>
      )}
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRequestConnection({ userId: match.userId, chartId: match.chartId })}
                disabled={!currentUserId || requestBusy === match.chartId}
                className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-emerald/20 text-emerald border border-emerald/40 text-sm font-medium hover:bg-emerald/30 disabled:opacity-50"
              >
                {requestBusy === match.chartId ? 'Sending…' : 'Request connection'}
              </button>
              <button
                type="button"
                onClick={() => handlePlayCompatibility(match.chartId, match.score)}
                className="flex-1 min-w-[120px] btn-primary text-sm py-2"
              >
                Play Mix
              </button>
              <button
                type="button"
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
