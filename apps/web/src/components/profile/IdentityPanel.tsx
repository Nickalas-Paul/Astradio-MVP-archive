'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useProfileChart, type ProfilePrimaryChart } from '../../core/social/hooks';
import { BirthChartSection } from './BirthChartSection';
import { ExplainerSections } from './shared/ExplainerSections';
import {
  blobUrlFromComposePayload,
  getIdentityAudioChartSync,
  isChartUpdatedSinceLastIdentityAudio,
  isFirstIdentityListen,
  setIdentityAudioChartSync,
} from './shared/profile-audio-utils';
import { filterIdentityDisplaySections, mapExplanationToSections } from './shared/profile-reading-utils';
import { PlacementHighlightProvider } from '../../core/PlacementHighlightContext';
import { snapshotSafeForWheel } from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { Button } from '@/components/shared/Button';
import { FtueTodayBridgeNudge } from '../ftue/FtueTodayBridgeNudge';

const WheelDisplay = dynamic(
  () => import('@/components/wheel/WheelDisplay').then((m) => ({ default: m.WheelDisplay })),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

const COMPOSE_POLL_INTERVAL_MS = 5000;
const COMPOSE_POLL_MAX_ATTEMPTS = 12;

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
  onProfileRefresh: () => Promise<void>;
}

export function IdentityPanel({
  chartId,
  noRealChart,
  primaryChart,
  onProfileRefresh,
}: IdentityPanelProps) {
  const { data: chartData, loading: chartLoading, error: chartError, refresh: refreshChart } =
    useProfileChart(chartId);
  const [identityAudioUrl, setIdentityAudioUrl] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<IdentityAudioState>(
    noRealChart ? 'no_chart' : 'loading',
  );
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [composePollExhausted, setComposePollExhausted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Captured once per chart — survives sync-key write during the same session. */
  const sessionFirstListenRef = useRef<boolean | null>(null);
  const autoplayAttemptedRef = useRef(false);

  if (chartId && sessionFirstListenRef.current === null) {
    sessionFirstListenRef.current = isFirstIdentityListen(chartId);
  }
  const isFirstListen = sessionFirstListenRef.current === true;

  useEffect(() => {
    sessionFirstListenRef.current = null;
    autoplayAttemptedRef.current = false;
    setAutoplayBlocked(false);
    setComposePollExhausted(false);
  }, [chartId]);

  useEffect(() => {
    if (!chartId) return;
    void refreshChart();
  }, [chartId, refreshChart]);

  useEffect(() => {
    if (noRealChart) {
      setAudioState('no_chart');
      return;
    }
    if (!chartData) return;

    const eid = chartData.identity_export_id;
    const validEid = isValidIdentityExportId(eid);

    setIdentityAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!validEid) {
      setAudioState('missing');
      return undefined;
    }

    setAudioState('loading');

    let cancelled = false;
    const base = getApiBaseUrl();

    void (async () => {
      try {
        const url = await blobUrlFromComposePayload(base, { export_id: eid });
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (url) {
          setIdentityAudioUrl(url);
          setAudioState('available');
        } else {
          setAudioState('missing');
        }
      } catch {
        if (!cancelled) {
          setAudioState('missing');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chartData?.identity_export_id, chartData, noRealChart]);

  // First visit: poll for background registration compose when export id not ready yet.
  useEffect(() => {
    if (!chartId || !isFirstListen || audioState !== 'missing' || composePollExhausted) return;
    if (isValidIdentityExportId(chartData?.identity_export_id)) return;

    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      void refreshChart();
      if (attempts >= COMPOSE_POLL_MAX_ATTEMPTS) {
        window.clearInterval(intervalId);
        setComposePollExhausted(true);
      }
    }, COMPOSE_POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [
    chartId,
    isFirstListen,
    audioState,
    composePollExhausted,
    chartData?.identity_export_id,
    refreshChart,
  ]);

  // First listen: auto-play when audio becomes available.
  useEffect(() => {
    if (audioState !== 'available' || !identityAudioUrl || !isFirstListen) return;
    if (autoplayAttemptedRef.current) return;

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      void (async () => {
        const audio = audioRef.current;
        if (!audio || cancelled) return;
        autoplayAttemptedRef.current = true;
        try {
          await audio.play();
          if (!cancelled) setAutoplayBlocked(false);
        } catch {
          if (!cancelled) setAutoplayBlocked(true);
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [audioState, identityAudioUrl, isFirstListen]);

  const handleProminentPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setAutoplayBlocked(false);
    } catch {
      // Browser still blocking — keep prominent CTA visible.
    }
  }, []);

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
        throw new Error(typeof data.error === 'string' ? data.error : 'Generation failed');
      }
      const eid = data.identity_export_id;
      if (!eid || !/^[a-f0-9]{64}$/.test(eid)) {
        throw new Error('No export ID returned');
      }
      await refreshChart();
      const url = await blobUrlFromComposePayload(getApiBaseUrl(), { export_id: eid });
      if (!url) {
        throw new Error('Could not load generated audio');
      }
      setIdentityAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setAudioState('available');
    } catch {
      setAudioState('error');
    } finally {
      setAudioGenerating(false);
    }
  }, [refreshChart]);

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
      : hasValidExportId && audioState === 'missing'
        ? "Couldn't load your soundtrack. Try again."
        : showChartUpdatedPrompt
          ? 'Your chart was updated. Ready to hear the new you?'
          : 'Generate a soundtrack from your natal chart.';

  const showFirstListenComposing =
    isFirstListen &&
    audioState === 'missing' &&
    !composePollExhausted &&
    !showChartUpdatedPrompt;

  const showFirstListenComposeDelayed =
    isFirstListen && audioState === 'missing' && composePollExhausted && !showChartUpdatedPrompt;

  const showGenerateButton =
    (audioState === 'missing' || audioState === 'error') &&
    !showFirstListenComposing;

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

  const renderHiddenAudio = () =>
    identityAudioUrl ? (
      <audio
        ref={audioRef}
        src={identityAudioUrl}
        className={autoplayBlocked ? 'sr-only' : 'w-full'}
        controls={!autoplayBlocked && audioState === 'available'}
        preload="metadata"
      />
    ) : null;

  const renderAudio = () => (
    <>
      {audioState === 'loading' && (
        <p className="text-sm text-text-secondary">Loading your soundtrack…</p>
      )}
      {audioState === 'available' && identityAudioUrl && !autoplayBlocked && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">Listen to this reading</p>
          {renderHiddenAudio()}
        </div>
      )}
      {audioState === 'available' && identityAudioUrl && autoplayBlocked && renderHiddenAudio()}
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
            Your soundtrack is taking a little longer than usual. You can generate it now.
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
            Generating…
          </Button>
        </div>
      )}
    </>
  );

  const renderProminentPlayCta = () =>
    autoplayBlocked && identityAudioUrl ? (
      <div className="rounded-2xl border border-border bg-bgElev/80 p-4 sm:p-5 space-y-3">
        <p className="text-body font-medium text-text-primary">Your soundtrack is ready</p>
        <Button
          type="button"
          variant="audio"
          size="sm"
          className="w-full min-h-[48px]"
          onClick={() => void handleProminentPlay()}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <span aria-hidden className="text-base leading-none">
              ▶
            </span>
            Play soundtrack
          </span>
        </Button>
      </div>
    ) : null;

  const wheelAndAudio = (maxSize: number) => (
    <div className="space-y-4">
      {renderWheel(maxSize)}
      {renderAudio()}
    </div>
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
          <>
            {renderProminentPlayCta()}

            <div className="md:hidden max-w-[280px] mx-auto w-full">{wheelAndAudio(280)}</div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] md:gap-8 items-start">
              <div className="min-w-0 w-full">
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

              <div
                className="hidden md:block md:sticky md:top-20 shrink-0"
                style={{ maxWidth: '360px' }}
              >
                {wheelAndAudio(340)}
              </div>
            </div>

            <FtueTodayBridgeNudge />
          </>
        )}

        {noRealChart && (
          <p className="text-text-secondary text-sm">
            Link a chart to see your astrology breakdown and use Matches.
          </p>
        )}
      </div>
    </PlacementHighlightProvider>
  );
};
