'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../core/api-base';
import { useCompat, useCommunityInventory, type CommunityInventoryV1 } from '../core/social/hooks';
import { isFeatureEnabled } from '../core/config/flags';
import { trackFeatureUse } from '../core/telemetry';
import type { RelationalIntent } from '../lib/relational-intent';

interface CompatibilitySectionProps {
  /** When false, show create-profile CTA first. When true, chartId may still be null (profile exists but no real chart). */
  hasProfile: boolean;
  chartId: string | null;
  limit?: number;
  className?: string;
  onSwitchToProfile?: () => void;
  /** Optional controlled mode (e.g. from Connections intent selector). */
  mode?: RelationalIntent;
  onModeChange?: (mode: RelationalIntent) => void;
  /** When true, intent chips are omitted (parent controls intent elsewhere). */
  hideIntentSelector?: boolean;
  /** Phase 8 — session user id for connection requests (not persisted until peer accepts). */
  currentUserId?: string | null;
  /** Called after a connection request is sent successfully. */
  onConnectionRequested?: () => void;
  /** Increment to refetch GET /api/community/inventory (pending state source of truth). */
  inventoryRefreshSignal?: number;
}

const MODES: { value: RelationalIntent; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'lover', label: 'Lover' },
];

function pendingOutgoingForMatch(
  inventory: CommunityInventoryV1 | null,
  peerUserId: string,
  peerChartId: string,
  relationshipKind: RelationalIntent
): boolean {
  const list = inventory?.pendingOutgoingIntents;
  if (!list?.length) return false;
  return list.some((raw) => {
    const i = raw as Record<string, unknown>;
    const toUid = String(i.toUserId ?? i.to_user_id ?? '');
    const toCid = String(i.toChartId ?? i.to_chart_id ?? '');
    const rk = String(i.relationshipKind ?? i.relationship_kind ?? 'friend') as RelationalIntent;
    return toUid === peerUserId && toCid === peerChartId && rk === relationshipKind;
  });
}

export function CompatibilitySection({
  hasProfile,
  chartId,
  limit = 10,
  className = '',
  onSwitchToProfile,
  mode: controlledMode,
  onModeChange,
  hideIntentSelector = false,
  currentUserId,
  onConnectionRequested,
  inventoryRefreshSignal,
}: CompatibilitySectionProps) {
  const [internalMode, setInternalMode] = useState<RelationalIntent>('friend');
  const [userTriggered, setUserTriggered] = useState(false);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [expandedChartId, setExpandedChartId] = useState<string | null>(null);
  const [expandedAnchorsForChartId, setExpandedAnchorsForChartId] = useState<string | null>(null);
  const mode = controlledMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const { data: inventory, refresh: refreshInventory } = useCommunityInventory();
  const { matches, responseMode, isLoading: loading, error, run } = useCompat({
    chartId,
    mode,
    limit,
  });

  const rankMode: RelationalIntent = MODES.some((m) => m.value === responseMode)
    ? (responseMode as RelationalIntent)
    : mode;
  const rankModeLabel = MODES.find((m) => m.value === rankMode)?.label ?? rankMode;

  useEffect(() => {
    setUserTriggered(false);
    setExpandedChartId(null);
    setExpandedAnchorsForChartId(null);
  }, [chartId]);

  useEffect(() => {
    if (inventoryRefreshSignal != null && inventoryRefreshSignal > 0) {
      void refreshInventory();
    }
  }, [inventoryRefreshSignal, refreshInventory]);

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

  const handleViewRationale = (targetChartId: string) => {
    trackFeatureUse('compatibility', 'view_rationale');
    console.log('Viewing rationale for chart:', targetChartId);
  };

  const handleRequestConnection = async (match: { userId: string; chartId: string }) => {
    if (!chartId || !currentUserId) {
      setRequestMsg('Sign in and ensure your chart is set to request a connection.');
      return;
    }
    if (pendingOutgoingForMatch(inventory, match.userId, match.chartId, rankMode)) {
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
          relationshipKind: rankMode,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRequestMsg(typeof j.error === 'string' ? j.error : `Request failed (${r.status})`);
        return;
      }
      await refreshInventory();
      onConnectionRequested?.();
      setRequestMsg('Request sent');
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

  const facetLabelById: Record<string, string> = {
    cohesion: 'Cohesion',
    tension: 'Tension',
    transformation: 'Transformation',
    stability: 'Stability',
  };

  const groupedAnchorRows = (anchors: string[]): string[] => {
    const groups = new Map<string, number>();
    for (const raw of anchors) {
      const value = String(raw || '').trim();
      if (!value) continue;
      const prefix = value.includes(':') ? value.split(':')[0] : value;
      groups.set(prefix, (groups.get(prefix) ?? 0) + 1);
    }
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, n]) => `${k} (${n})`);
  };

  const intentRow =
    !hideIntentSelector ? (
      <div className="flex rounded-full bg-bgElev border border-border p-0.5 flex-wrap">
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
    ) : null;

  const findMatchesControl = (
    <button
      type="button"
      onClick={() => {
        setUserTriggered(true);
        void run();
      }}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg text-sm bg-emerald text-bg font-medium hover:opacity-90 disabled:opacity-50"
    >
      {loading ? 'Loading…' : 'Find matches'}
    </button>
  );

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <h3 className="text-lg font-semibold text-text">Compatibility matches</h3>
      <div className="flex flex-wrap items-center gap-2">
        {intentRow}
        {findMatchesControl}
      </div>
    </div>
  );

  const apiIntentBanner =
    userTriggered && responseMode ? (
      <p className="text-sm text-text mb-3 rounded-lg border border-border bg-bgElev px-3 py-2">
        <span className="font-medium">Results ranked for:</span>{' '}
        {rankModeLabel}
      </p>
    ) : null;

  // Before explicit Find matches: no skeleton, list, or empty state for matches
  if (!userTriggered) {
    return (
      <div className={`card ${className}`}>
        {header}
        <p className="text-sm text-subtext">
          Ranked matches load when you click Find matches. Change intent and click again to reload with a new mode.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`card ${className}`}>
        {header}
        {apiIntentBanner}
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
        {apiIntentBanner}
        <div className="text-center py-8">
          <p className="text-subtext text-sm">Unable to load compatibility matches</p>
        </div>
      </div>
    );
  }

  if (matches !== null && matches.length === 0) {
    return (
      <div className={`card ${className}`}>
        {header}
        {apiIntentBanner}
        <div className="text-center py-8">
          <p className="text-subtext text-sm">No eligible matches</p>
          <p className="text-xs text-subtext mt-1">
            No candidates met the current criteria, or the directory has no eligible charts yet. Click Find matches again after adjusting intent if needed.
          </p>
        </div>
      </div>
    );
  }

  if (!matches?.length) {
    return (
      <div className={`card ${className}`}>
        {header}
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      {header}
      {apiIntentBanner}
      {requestMsg && (
        <p className="text-sm text-subtext mb-3 rounded-lg border border-border bg-bgElev px-3 py-2">{requestMsg}</p>
      )}
      <div className="space-y-4">
        {matches.map((match, index) => {
          const pending = pendingOutgoingForMatch(inventory, match.userId, match.chartId, rankMode);
          const connDisabled = !currentUserId || requestBusy === match.chartId || pending;
          const connLabel = pending ? 'Awaiting response' : requestBusy === match.chartId ? 'Sending…' : 'Request connection';
          return (
            <motion.div
              key={`${match.userId}-${match.chartId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 bg-bgElev rounded-lg border border-border hover:border-emerald/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet to-emerald rounded-full flex items-center justify-center">
                    <span className="text-bg font-bold text-sm">{match.userId.slice(-2).toUpperCase()}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text">
                      {match.displayName ?? `User ${match.userId.slice(-4)}`}
                    </h4>
                    <p className="text-xs text-subtext">Chart {match.chartId.slice(-4)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-lg font-bold ${getScoreColor(match.score)}`}>{Math.round(match.score * 100)}%</div>
                  <div className="text-xs text-subtext">{getScoreLabel(match.score)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {match.facets.slice(0, 4).map((facet, facetIndex) => (
                  <div key={`${match.chartId}-${facet.id}-${facetIndex}`} className="text-xs">
                    <span className="text-subtext">{facetLabelById[facet.id] ?? facet.name}:</span>
                    <span className="text-emerald ml-1">{Math.round((facet.score ?? match.score) * 100)}%</span>
                  </div>
                ))}
              </div>

              <div className="mb-3">
                <p className="text-xs text-subtext mb-1">{match.explanationProfile?.intentFitSummary ?? match.rationale}</p>
                <div className="text-xs text-subtext space-y-1">
                  <p>
                    <span className="font-medium text-text">Support:</span>{' '}
                    {match.explanationProfile?.primarySupports?.[0] ?? 'Support signal unavailable'}
                  </p>
                  <p>
                    <span className="font-medium text-text">Limit:</span>{' '}
                    {match.explanationProfile?.tensionsOrLimits?.[0] ?? 'Limit signal unavailable'}
                  </p>
                </div>
              </div>

              {expandedChartId === match.chartId && match.explanationProfile && (
                <div className="mb-3 rounded-lg border border-border bg-bg p-3 text-xs text-subtext space-y-2">
                  <p className="font-medium text-text">{match.explanationProfile.intentFitSummary}</p>
                  <div>
                    <p className="font-medium text-text">Primary supports</p>
                    {match.explanationProfile.primarySupports.slice(0, 2).map((line) => (
                      <p key={`${match.chartId}-primary-${line}`}>- {line}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-text">Secondary supports</p>
                    {match.explanationProfile.secondarySupports.slice(0, 2).map((line) => (
                      <p key={`${match.chartId}-secondary-${line}`}>- {line}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-text">Tensions / limits</p>
                    {match.explanationProfile.tensionsOrLimits.slice(0, 2).map((line) => (
                      <p key={`${match.chartId}-limit-${line}`}>- {line}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-text">Intent contrast</p>
                    <p>Friend: {match.explanationProfile.contrastByIntent.friend}</p>
                    <p>Lover: {match.explanationProfile.contrastByIntent.lover}</p>
                  </div>
                  <div>
                    <p className="font-medium text-text">Anchors</p>
                    {(() => {
                      const anchors = Array.isArray(match.explanationProfile.anchors)
                        ? match.explanationProfile.anchors
                        : [];
                      const grouped = groupedAnchorRows(anchors);
                      const expandedAnchors = expandedAnchorsForChartId === match.chartId;
                      const visible = expandedAnchors ? grouped : grouped.slice(0, 4);
                      return (
                        <div className="space-y-1">
                          {visible.length > 0 ? (
                            <p>{visible.join(', ')}</p>
                          ) : (
                            <p>No anchors available</p>
                          )}
                          {grouped.length > 4 && (
                            <button
                              type="button"
                              className="text-emerald hover:underline"
                              onClick={() =>
                                setExpandedAnchorsForChartId((prev) =>
                                  prev === match.chartId ? null : match.chartId
                                )
                              }
                            >
                              {expandedAnchors ? 'Show fewer anchors' : `Show all anchors (${grouped.length})`}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRequestConnection({ userId: match.userId, chartId: match.chartId })}
                  disabled={connDisabled}
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-emerald/20 text-emerald border border-emerald/40 text-sm font-medium hover:bg-emerald/30 disabled:opacity-50"
                >
                  {connLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleViewRationale(match.chartId);
                    setExpandedChartId((prev) => (prev === match.chartId ? null : match.chartId));
                  }}
                  className="px-3 py-2 bg-bgElev text-subtext rounded-lg hover:bg-border transition-colors text-sm"
                >
                  {expandedChartId === match.chartId ? 'Hide details' : 'Details'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
