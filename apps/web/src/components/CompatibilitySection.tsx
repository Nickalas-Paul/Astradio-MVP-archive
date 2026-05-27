'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '../core/api-base';
import {
  calculateDiscoveryRequestsRemaining,
  DiscoveryCarousel,
} from './DiscoveryCarousel';
import { useCompat, useCommunityInventory, type CommunityInventoryV1 } from '../core/social/hooks';
import type { CompatMatch } from '../core/compat/types';
import { isFeatureEnabled } from '../core/config/flags';
import { trackFeatureUse } from '../core/telemetry';
import { RELATIONAL_INTENT_OPTIONS as MODES, type RelationalIntent } from '../lib/relational-intent';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { Tabs } from '@/components/shared/Tabs';

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
  const pendingOutgoingCount = inventory?.pendingOutgoingIntents?.length ?? 0;
  const requestsRemaining = calculateDiscoveryRequestsRemaining(pendingOutgoingCount);

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
      <Card elevation="resting" className={className}>
        <h3 className="text-h3 font-semibold text-text-primary mb-4">Compatibility</h3>
        <p className="text-body-sm text-text-secondary">
          Create a profile with your natal chart first. Astradio profiles are chart-based — add your birth date, time, and birth place in the Profile tab. Then return here to find compatible connections.
        </p>
        {controlledMode != null && (
          <p className="text-caption text-text-muted mt-2">Looking for: {modeLabel}</p>
        )}
        {onSwitchToProfile && (
          <Button type="button" variant="primary" size="md" className="mt-4" onClick={onSwitchToProfile}>
            Go to Profile to create one
          </Button>
        )}
      </Card>
    );
  }

  // 2) Profile exists but no real chart → add natal chart
  if (!chartId) {
    return (
      <Card elevation="resting" className={className}>
        <h3 className="text-h3 font-semibold text-text-primary mb-4">Compatibility</h3>
        <p className="text-body-sm text-text-secondary">
          Add your natal chart to your profile to see compatibility-driven matches. Go to the Profile tab and add your birth date, time, and birth place.
        </p>
        {controlledMode != null && (
          <p className="text-caption text-text-muted mt-2">Looking for: {modeLabel}</p>
        )}
        {onSwitchToProfile && (
          <Button type="button" variant="primary" size="md" className="mt-4" onClick={onSwitchToProfile}>
            Add your natal chart
          </Button>
        )}
      </Card>
    );
  }

  // 3) Chart exists but compatibility disabled → truthful message
  if (!isFeatureEnabled('ENABLE_COMPAT')) {
    return (
      <Card elevation="resting" className={className}>
        <h3 className="text-h3 font-semibold text-text-primary mb-4">Compatibility</h3>
        <p className="text-body-sm text-text-secondary">
          You’re set up with a natal chart. Compatibility matching will be enabled in a future update.
        </p>
        {controlledMode != null && (
          <p className="text-caption text-text-muted mt-2">Looking for: {modeLabel}</p>
        )}
      </Card>
    );
  }

  const handleViewProfile = (match: CompatMatch) => {
    trackFeatureUse('compatibility', 'view_rationale');
    const bullets = match.explanationProfile.synastryBullets;
    if (bullets && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(`discovery-bullets:${match.userId}`, JSON.stringify(bullets));
      } catch {
        /* ignore quota */
      }
    }
    const intentQs = rankMode === 'lover' ? 'partner' : 'friend';
    router.push(
      `/profile/${encodeURIComponent(match.userId)}?from=discovery&intent=${intentQs}&chartId=${encodeURIComponent(match.chartId)}`
    );
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

  const intentRow = !hideIntentSelector ? (
    <Tabs
      variant="pill"
      pillTrack="compact"
      ariaLabel="Compatibility intent"
      tabs={MODES.map((m) => ({ id: m.value, label: m.label }))}
      activeTab={mode}
      onTabChange={(id) => setMode(id as RelationalIntent)}
    />
  ) : null;

  const findMatchesControl = (
    <Button
      type="button"
      variant="primary"
      size="md"
      className="w-full sm:w-auto min-h-[44px]"
      onClick={() => {
        setUserTriggered(true);
        void run();
      }}
      disabled={loading}
      loading={loading}
    >
      Find matches
    </Button>
  );

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <h3 className="text-h3 font-semibold text-text-primary shrink-0">Compatibility matches</h3>
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full sm:w-auto min-w-0">
        {intentRow ? <div className="overflow-x-auto scrollbar-hide w-full sm:w-auto">{intentRow}</div> : null}
        <div className="w-full sm:w-auto shrink-0">{findMatchesControl}</div>
      </div>
    </div>
  );

  // Before explicit Find matches: no skeleton, list, or empty state for matches
  if (!userTriggered) {
    return (
      <Card elevation="resting" className={className}>
        {header}
        <p className="text-body-sm text-text-secondary">
          Daily matches load when you click Find matches. Change intent and click again to refresh.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card elevation="resting" className={className}>
        {header}
        <div className="max-w-lg mx-auto skeleton h-96 rounded-lg" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation="resting" className={className}>
        {header}
        <div className="text-center py-8">
          <p className="text-body-sm text-text-secondary">Unable to load compatibility matches</p>
        </div>
      </Card>
    );
  }

  if (matches !== null && matches.length === 0) {
    return (
      <Card elevation="resting" className={className}>
        {header}
        <DiscoveryCarousel
          matches={[]}
          intent={rankMode}
          requestsRemaining={requestsRemaining}
          pendingOutgoingCount={pendingOutgoingCount}
          onViewProfile={handleViewProfile}
          onRequestConnection={(m) => void handleRequestConnection(m)}
          isConnectionPending={(m) => pendingOutgoingForMatch(inventory, m.userId, m.chartId, rankMode)}
          connectionBusyChartId={requestBusy}
          canRequestConnection={Boolean(currentUserId && chartId)}
        />
      </Card>
    );
  }

  if (!matches?.length) {
    return (
      <Card elevation="resting" className={className}>
        {header}
      </Card>
    );
  }

  return (
    <Card elevation="resting" className={className}>
      {header}
      {requestMsg && (
        <p className="text-body-sm text-text-secondary mb-3 rounded-lg border border-border bg-bgElev px-3 py-2">
          {requestMsg}
        </p>
      )}
      <DiscoveryCarousel
        matches={matches}
        intent={rankMode}
        requestsRemaining={requestsRemaining}
        pendingOutgoingCount={pendingOutgoingCount}
        onViewProfile={handleViewProfile}
        onRequestConnection={(m) => void handleRequestConnection(m)}
        isConnectionPending={(m) => pendingOutgoingForMatch(inventory, m.userId, m.chartId, rankMode)}
        connectionBusyChartId={requestBusy}
        canRequestConnection={Boolean(currentUserId && chartId)}
      />
    </Card>
  );
}
