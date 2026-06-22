'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { type ProfileChartResponse, type ProfilePrimaryChart } from '../../core/social/hooks';
import { BirthChartSection } from './BirthChartSection';
import { ExplainerSections } from './shared/ExplainerSections';
import {
  isChartUpdatedSinceLastIdentityAudio,
  isFirstIdentityListen,
  setIdentityAudioChartSync,
} from './shared/profile-audio-utils';
import { filterIdentityDisplaySections, mapExplanationToSections } from './shared/profile-reading-utils';
import { PlacementHighlightProvider } from '../../core/PlacementHighlightContext';
import { snapshotSafeForWheel } from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { Button } from '@/components/shared/Button';
import { SaveToLibraryButton } from '@/components/shared/SaveToLibraryButton';
import { useAudioPlayerStore } from '@/store';

const WheelDisplay = dynamic(
  () => import('@/components/wheel/WheelDisplay').then((m) => ({ default: m.WheelDisplay })),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

const COMPOSE_POLL_INTERVAL_MS = 8000;
const COMPOSE_POLL_MAX_ATTEMPTS = 8;
const SIDEBAR_WHEEL_MAX_SIZE = 480;
const EXPANDED_WHEEL_MAX_SIZE = 600;

function ExpandWheelIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-text-primary"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

type IdentityAudioState =
  | 'no_chart'
  | 'loading'
  | 'available'
  | 'missing'
  | 'generating'
  | 'error';

function isValidIdentityExportId(eid: unknown): eid is string {
  return typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid);
}

export interface IdentityPanelProps {
  chartId: string | null;
  noRealChart: boolean;
  primaryChart: ProfilePrimaryChart | null;
  chartData: ProfileChartResponse | null;
  chartLoading: boolean;
  chartError: string | null;
  refreshChart: () => Promise<void>;
  onProfileRefresh: () => Promise<void>;
}

export function IdentityPanel({
  chartId,
  noRealChart,
  primaryChart,
  chartData,
  chartLoading,
  chartError,
  refreshChart,
  onProfileRefresh,
}: IdentityPanelProps) {
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const [wheelExpanded, setWheelExpanded] = useState(false);
  const [audioState, setAudioState] = useState<IdentityAudioState>(
    noRealChart ? 'no_chart' : 'loading',
  );
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [composePollExhausted, setComposePollExhausted] = useState(false);

  /** Captured once per chart — survives sync-key write during the same session. */
  const sessionFirstListenRef = useRef<boolean | null>(null);

  if (chartId && sessionFirstListenRef.current === null) {
    sessionFirstListenRef.current = isFirstIdentityListen(chartId);
  }
  const isFirstListen = sessionFirstListenRef.current === true;

  useEffect(() => {
    sessionFirstListenRef.current = null;
    setComposePollExhausted(false);
    setWheelExpanded(false);
  }, [chartId]);

  useEffect(() => {
    if (!wheelExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWheelExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [wheelExpanded]);

  const openWheelExpanded = useCallback(() => {
    setWheelExpanded(true);
  }, []);

  useEffect(() => {
    if (noRealChart) {
      setAudioState('no_chart');
      return;
    }
    if (!chartData) return;

    const eid = chartData.identity_export_id;
    const validEid = isValidIdentityExportId(eid);

    if (!validEid) {
      setAudioState('missing');
      return;
    }

    setAudioState('available');
  }, [chartData?.identity_export_id, chartData, noRealChart]);

  // First visit: poll for background registration compose when export id not ready yet.
  useEffect(() => {
    if (!chartId || !isFirstListen || audioState !== 'missing' || composePollExhausted) return;
    if (isValidIdentityExportId(chartData?.identity_export_id)) return;

    let attempts = 0;
    let cancelled = false;
    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      if (isValidIdentityExportId(chartData?.identity_export_id)) {
        window.clearInterval(intervalId);
        return;
      }
      attempts += 1;
      void refreshChart();
      if (attempts >= COMPOSE_POLL_MAX_ATTEMPTS) {
        window.clearInterval(intervalId);
        setComposePollExhausted(true);
      }
    }, COMPOSE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    chartId,
    isFirstListen,
    audioState,
    composePollExhausted,
    chartData?.identity_export_id,
    refreshChart,
  ]);

  const handleGenerateIdentityAudio = useCallback(async () => {
    setAudioGenerating(true);
    setAudioState('generating');
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/profile/identity-audio`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await r.json().catch(() => ({}))) as {
        identity_export_id?: string;
        error?: string;
      };
      if (!r.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Composition failed');
      }
      const eid = data.identity_export_id;
      if (!eid || !/^[a-f0-9]{64}$/.test(eid)) {
        console.warn('Identity compose response missing valid export_id');
        throw new Error('No export ID returned');
      }
      await refreshChart();
      playTrack({ exportId: eid, label: 'Your Identity', source: 'identity' });
      setAudioState('available');
    } catch {
      setAudioState('error');
    } finally {
      setAudioGenerating(false);
    }
  }, [refreshChart, playTrack]);

  useEffect(() => {
    const updatedAt = chartData?.chart?.updatedAt;
    if (audioState === 'available' && chartId && updatedAt) {
      setIdentityAudioChartSync(chartId, updatedAt);
    }
  }, [audioState, chartId, chartData?.chart?.updatedAt]);

  const loading = chartLoading;
  const error = chartError;
  const hasExplainer = chartData?.explainer?.sections?.length;

  const chartUpdatedAt = chartData?.chart?.updatedAt;
  const hasValidExportId = isValidIdentityExportId(chartData?.identity_export_id);
  const showChartUpdatedPrompt =
    !hasValidExportId &&
    !!chartId &&
    isChartUpdatedSinceLastIdentityAudio(chartId, chartUpdatedAt);

  const missingMessage =
    audioState === 'error'
      ? 'Something went wrong. Try again.'
      : showChartUpdatedPrompt
        ? 'Your chart was updated. Ready to hear the new you?'
        : 'Hear what your chart sounds like.';

  const showFirstListenComposing =
    isFirstListen &&
    audioState === 'missing' &&
    !composePollExhausted &&
    !showChartUpdatedPrompt;

  const showFirstListenComposeDelayed =
    isFirstListen && audioState === 'missing' && composePollExhausted && !showChartUpdatedPrompt;

  const showGenerateButton =
    (audioState === 'missing' || audioState === 'error') &&
    !showFirstListenComposing &&
    (!showFirstListenComposeDelayed || showChartUpdatedPrompt);

  const renderWheel = (maxSize: number) => {
    if (loading) {
      return (
        <div
          className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse mx-auto"
          style={{ maxWidth: maxSize }}
        />
      );
    }
    if (chartData?.snapshot && snapshotSafeForWheel(chartData.snapshot)) {
      return (
        <WheelDisplay
          chartData={chartData.snapshot as any}
          isLoading={false}
          showAspectLines
          maxSize={maxSize}
          className="w-full mx-auto"
        />
      );
    }
    if (chartData?.snapshot) {
      return (
        <div
          className="aspect-square bg-bgElev rounded-2xl border border-border flex items-center justify-center text-text-secondary text-sm p-4 mx-auto"
          style={{ maxWidth: maxSize }}
        />
      );
    }
    return (
      <div
        className="aspect-square bg-bgElev rounded-2xl border border-border flex items-center justify-center text-text-secondary text-sm p-4 mx-auto"
        style={{ maxWidth: maxSize }}
      >
        {error || 'No chart data'}
      </div>
    );
  };

  const renderExpandableWheel = (maxSize: number) => (
    <div
      className="relative group md:cursor-pointer"
      onClick={() => {
        if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
          openWheelExpanded();
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
          e.preventDefault();
          openWheelExpanded();
        }
      }}
      role="presentation"
    >
      {renderWheel(maxSize)}
      <button
        type="button"
        className="hidden md:flex absolute bottom-3 right-3 z-10 h-6 w-6 items-center justify-center rounded-md bg-bg/80 border border-border/80 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bgElev pointer-events-auto"
        aria-label="Expand wheel"
        onClick={(e) => {
          e.stopPropagation();
          openWheelExpanded();
        }}
      >
        <ExpandWheelIcon />
      </button>
    </div>
  );

  const renderAudio = () => (
    <>
      {audioState === 'loading' && (
        <p className="text-sm text-text-secondary">Loading your soundtrack…</p>
      )}
      {audioState === 'available' && hasValidExportId && chartId && chartData?.identity_export_id ? (
        <SaveToLibraryButton
          exportId={String(chartData.identity_export_id)}
          source="profile_identity"
          compositionType="A"
          sandboxState={{ kind: 'profile_identity', chartId }}
          label="Your natal soundtrack"
        />
      ) : null}
      {showFirstListenComposing && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-text-secondary animate-pulse">Composing your soundtrack…</p>
          <div className="flex items-end gap-0.5 h-4" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-accent/40 animate-pulse"
                style={{
                  height: `${8 + (i % 3) * 4}px`,
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}
      {showFirstListenComposeDelayed && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            Your soundtrack is taking a little longer than usual. You can compose it now.
          </p>
        </div>
      )}
      {showGenerateButton && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">{missingMessage}</p>
          <Button
            type="button"
            variant="audio"
            size="sm"
            disabled={audioGenerating}
            loading={audioGenerating}
            onClick={() => void handleGenerateIdentityAudio()}
          >
            Hear your chart
          </Button>
        </div>
      )}
      {audioState === 'generating' && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">Building your soundtrack…</p>
          <Button type="button" variant="audio" size="sm" disabled loading>
            Composing…
          </Button>
        </div>
      )}
    </>
  );

  return (
    <PlacementHighlightProvider>
      <div className="space-y-8">
        {noRealChart ? (
          <BirthChartSection
            variant="profile_onboarding"
            refresh={onProfileRefresh}
            refreshChart={refreshChart}
            primaryChart={primaryChart}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6 md:gap-8 items-start">
            <div className="min-w-0 w-full order-2 md:order-1">
              {loading && !chartData && (
                <div className="space-y-4">
                  <div className="h-20 bg-bgElev rounded animate-pulse" />
                  <div className="h-20 bg-bgElev rounded animate-pulse" />
                </div>
              )}
              {error && !chartData && (
                <p className="text-text-secondary text-sm">{error}</p>
              )}
              {hasExplainer && (
                <ExplainerSections
                  sections={filterIdentityDisplaySections(
                    mapExplanationToSections(chartData!.explainer)
                  )}
                />
              )}
            </div>

            <div className="min-w-0 order-1 md:order-2 md:sticky md:top-20 space-y-4">
              {renderExpandableWheel(SIDEBAR_WHEEL_MAX_SIZE)}
              {renderAudio()}
            </div>
          </div>
        )}

        {noRealChart && (
          <p className="text-text-secondary text-sm">
            Link a chart to see your astrology breakdown and use Matches.
          </p>
        )}
      </div>

      {wheelExpanded ? (
        <div
          className="fixed inset-0 z-50 hidden md:flex items-center justify-center p-4 bg-black/60"
          role="presentation"
          onClick={() => setWheelExpanded(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-bg/90 border border-border text-text-secondary hover:text-text-primary"
            aria-label="Close expanded wheel"
            onClick={() => setWheelExpanded(false)}
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
          <div
            className="w-[min(600px,90vw,80vh)]"
            role="dialog"
            aria-modal="true"
            aria-label="Expanded chart wheel"
            onClick={(e) => e.stopPropagation()}
          >
            {renderWheel(EXPANDED_WHEEL_MAX_SIZE)}
          </div>
        </div>
      ) : null}
    </PlacementHighlightProvider>
  );
};
