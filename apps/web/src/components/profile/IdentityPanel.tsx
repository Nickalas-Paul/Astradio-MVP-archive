'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useProfileChart, type ProfilePrimaryChart } from '../../core/social/hooks';
import { BirthChartSection } from './BirthChartSection';
import { ExplainerSections } from './shared/ExplainerSections';
import { blobUrlFromComposePayload } from './shared/profile-audio-utils';
import { filterIdentityDisplaySections } from './shared/profile-reading-utils';
import { snapshotSafeForWheel } from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';
import { Button } from '@/components/shared/Button';

const WheelDisplay = dynamic(
  () => import('@/components/wheel/WheelDisplay').then((m) => ({ default: m.WheelDisplay })),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

type IdentityAudioState =
  | 'no_chart'
  | 'loading'
  | 'available'
  | 'missing'
  | 'generating'
  | 'error';

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
  const [hadExportId, setHadExportId] = useState(false);

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
    const validEid = typeof eid === 'string' && /^[a-f0-9]{64}$/.test(eid);

    setIdentityAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!validEid) {
      setAudioState('missing');
      return undefined;
    }

    setHadExportId(true);
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
      setHadExportId(true);
      setAudioState('available');
    } catch {
      setAudioState('error');
    } finally {
      setAudioGenerating(false);
    }
  }, [refreshChart]);

  const loading = chartLoading;
  const error = chartError;
  const hasExplainer = chartData?.explainer?.sections?.length;

  const missingMessage =
    audioState === 'error'
      ? 'Something went wrong. Try again.'
      : hadExportId
        ? 'Your chart was updated. Ready to hear the new you?'
        : 'Generate a soundtrack from your natal chart.';

  return (
    <div className="grid gap-8 md:grid-cols-[3fr_2fr]">
      <div className="space-y-4 min-w-0 w-full">
        {noRealChart ? (
          <BirthChartSection
            variant="profile_onboarding"
            refresh={onProfileRefresh}
            refreshChart={refreshChart}
            primaryChart={primaryChart}
          />
        ) : loading ? (
          <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border animate-pulse" />
        ) : chartData?.snapshot && snapshotSafeForWheel(chartData.snapshot) ? (
          <WheelDisplay
            chartData={chartData.snapshot as any}
            isLoading={false}
            showAspectLines
            maxSize={720}
            className="w-full"
          />
        ) : chartData?.snapshot ? (
          <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
            Chart data received; add planets and houses for wheel view.
          </div>
        ) : (
          <div className="aspect-square max-w-full bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
            {error || 'No chart data'}
          </div>
        )}

        {!noRealChart && (
          <>
            {audioState === 'loading' && (
              <p className="text-sm text-subtext">Loading your soundtrack…</p>
            )}

            {audioState === 'available' && identityAudioUrl && (
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">Listen to this reading</p>
                <audio controls src={identityAudioUrl} className="w-full" preload="metadata" />
              </div>
            )}

            {(audioState === 'missing' || audioState === 'error') && (
              <div className="space-y-3">
                <p className="text-sm text-subtext">{missingMessage}</p>
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
                <p className="text-sm text-subtext">Building your soundtrack…</p>
                <Button type="button" variant="audio" size="sm" disabled loading>
                  Generating…
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="min-w-0">
        {noRealChart && (
          <p className="text-subtext text-sm">Link a chart to see your astrology breakdown and use Matches.</p>
        )}
        {loading && !chartData && !noRealChart && (
          <div className="space-y-4">
            <div className="h-20 bg-bgElev rounded animate-pulse" />
            <div className="h-20 bg-bgElev rounded animate-pulse" />
          </div>
        )}
        {error && !chartData && !noRealChart && (
          <p className="text-subtext text-sm">{error}</p>
        )}
        {hasExplainer && (
          <ExplainerSections
            sections={filterIdentityDisplaySections(chartData!.explainer.sections)}
          />
        )}
      </div>
    </div>
  );
}
