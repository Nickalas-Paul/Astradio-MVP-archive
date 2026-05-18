'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '../core/api-base';
import { useCompat, useCommunityInventory, type CommunityInventoryV1 } from '../core/social/hooks';
import type { CompatibilityExplanationProfile, SynastryBulletLine } from '../core/compat/types';
import { isFeatureEnabled } from '../core/config/flags';
import { trackFeatureUse } from '../core/telemetry';
import { RELATIONAL_INTENT_OPTIONS as MODES, type RelationalIntent } from '../lib/relational-intent';

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

function discoveryBulletFromEp(
  ep: CompatibilityExplanationProfile,
  which: 'forYou' | 'forThem' | 'together'
): SynastryBulletLine {
  const structured = ep.synastryBullets?.[which];
  if (structured?.text) return structured;
  const fallback =
    which === 'forYou'
      ? ep.primarySupports[0]
      : which === 'forThem'
        ? ep.secondarySupports[0]
        : ep.tensionsOrLimits[0];
  return { anchor: '', text: fallback || 'Compatibility insight unavailable' };
}

function SynastryBulletBlock({ line }: { line: SynastryBulletLine }) {
  if (line.anchor) {
    return (
      <div className="min-w-0">
        <div className="text-xs font-semibold text-subtext mb-1">{line.anchor}</div>
        <div className="text-sm text-text">{line.text}</div>
      </div>
    );
  }
  return <div className="text-sm text-text min-w-0">{line.text}</div>;
}

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
  const router = useRouter();
  const [internalMode, setInternalMode] = useState<RelationalIntent>('friend');
  const [userTriggered, setUserTriggered] = useState(false);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [expandedChartId] = useState<string | null>(null);
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
          const connLabel = pending
            ? 'Awaiting response'
            : requestBusy === match.chartId
              ? 'Sending…'
              : 'Request connection';

          const ep = match.explanationProfile;
          const forThemLine = discoveryBulletFromEp(ep, 'forThem');
          const forYouLine = discoveryBulletFromEp(ep, 'forYou');
          const togetherLine = discoveryBulletFromEp(ep, 'together');

          const initial =
            (match.displayName || match.userId || '?').trim().charAt(0).toUpperCase() || '?';

          return (
            <motion.div
              key={match.chartId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 bg-bgElev rounded-lg border border-border hover:border-emerald/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="font-semibold text-text">{match.displayName}</h4>
                    <span className="text-xs text-subtext">Chart {match.chartId.slice(-4)}</span>
                  </div>

                  {match.bio ? (
                    <p className="text-sm text-subtext mb-3 line-clamp-2">{match.bio}</p>
                  ) : null}

                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald text-xs mt-0.5 shrink-0" aria-hidden>
                        ●
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text mb-1">
                          <span className="font-medium">Why you&apos;re good for them:</span>
                        </p>
                        <SynastryBulletBlock line={forThemLine} />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald text-xs mt-0.5 shrink-0" aria-hidden>
                        ●
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text mb-1">
                          <span className="font-medium">Why they&apos;re good for you:</span>
                        </p>
                        <SynastryBulletBlock line={forYouLine} />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald text-xs mt-0.5 shrink-0" aria-hidden>
                        ●
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text mb-1">
                          <span className="font-medium">Why you&apos;re good together:</span>
                        </p>
                        <SynastryBulletBlock line={togetherLine} />
                      </div>
                    </div>
                  </div>

                  {match.lookingFor ? (
                    <div className="text-xs text-subtext italic border-l-2 border-emerald/30 pl-2 mb-3">
                      &ldquo;{match.lookingFor}&rdquo;
                    </div>
                  ) : null}

                  {expandedChartId === match.chartId ? (
                    <div className="mb-3 rounded-lg border border-border bg-bg p-3 text-sm text-subtext space-y-3">
                      <div>
                        <p className="font-medium text-text mb-1">Why you&apos;re good for them</p>
                        <SynastryBulletBlock line={forThemLine} />
                      </div>
                      <div>
                        <p className="font-medium text-text mb-1">Why they&apos;re good for you</p>
                        <SynastryBulletBlock line={forYouLine} />
                      </div>
                      <div>
                        <p className="font-medium text-text mb-1">Why you&apos;re good together</p>
                        <SynastryBulletBlock line={togetherLine} />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRequestConnection({ userId: match.userId, chartId: match.chartId })}
                      disabled={connDisabled}
                      className="px-4 py-2 bg-emerald text-bg rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-opacity"
                    >
                      {connLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleViewRationale(match.chartId);
                        const bullets = ep.synastryBullets;
                        if (bullets && typeof window !== 'undefined') {
                          try {
                            sessionStorage.setItem(
                              `discovery-bullets:${match.userId}`,
                              JSON.stringify(bullets)
                            );
                          } catch {
                            /* ignore quota */
                          }
                        }
                        const intentQs = rankMode === 'lover' ? 'partner' : 'friend';
                        router.push(
                          `/profile/${encodeURIComponent(match.userId)}?from=discovery&intent=${intentQs}&chartId=${encodeURIComponent(match.chartId)}`
                        );
                      }}
                      className="px-4 py-2 border border-border rounded-lg hover:border-emerald/50 text-sm font-medium transition-colors text-subtext hover:text-text"
                    >
                      View profile
                    </button>
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="w-16 h-16 rounded-full bg-bgElev border border-border flex items-center justify-center text-xs overflow-hidden">
                    {match.avatarUrl ? (
                      <img
                        src={match.avatarUrl}
                        alt={match.displayName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-text font-medium">{initial}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
