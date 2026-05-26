'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useProfileChart, type ProfilePrimaryChart } from '../../core/social/hooks';
import { BirthChartSection } from './BirthChartSection';
import { ExplainerSections } from './shared/ExplainerSections';
import { blobUrlFromComposePayload } from './shared/profile-audio-utils';
import { filterIdentityDisplaySections } from './shared/profile-reading-utils';
import { snapshotSafeForWheel } from './shared/profile-transit-utils';
import { getApiBaseUrl } from '../../core/api-base';

const WheelCanvas = dynamic(
  () => import('../WheelCanvas').then((m) => m.default),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

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

  useEffect(() => {
    if (!chartId) return;
    void refreshChart();
  }, [chartId, refreshChart]);

  useEffect(() => {
    let cancelled = false;
    const base = getApiBaseUrl();
    const eid = chartData?.identity_export_id;

    setIdentityAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!eid || typeof eid !== 'string' || !/^[a-f0-9]{64}$/.test(eid)) {
      return undefined;
    }

    void (async () => {
      try {
        const url = await blobUrlFromComposePayload(base, { export_id: eid });
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        setIdentityAudioUrl(url);
      } catch {
        /* Playback unavailable — Identity text still shown */
      }
    })();

    return () => {
      cancelled = true;
      setIdentityAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [chartData?.identity_export_id]);

  const loading = chartLoading;
  const error = chartError;
  const hasExplainer = chartData?.explainer?.sections?.length;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,400px)_1fr]">
      <div>
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
          <WheelCanvas
            chartData={chartData.snapshot as any}
            isLoading={false}
            className="max-w-full"
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
          <p className="mt-4 text-xs text-subtext">
            Birth chart data can be updated in{' '}
            <Link href="/settings#birth-chart" className="text-emerald hover:underline">
              Settings
            </Link>
            .
          </p>
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
        {identityAudioUrl && (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-text-secondary">Listen to this reading</p>
            <audio controls src={identityAudioUrl} className="w-full max-w-md" preload="metadata" />
          </div>
        )}
      </div>
    </div>
  );
}
