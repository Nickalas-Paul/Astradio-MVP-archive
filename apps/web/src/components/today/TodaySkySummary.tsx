'use client';

import { useEffect, useState } from 'react';
import ExplanationPanel from '@/components/ExplanationPanel';
import { WheelDisplay } from '@/components/wheel/WheelDisplay';
import { getApiBaseUrl } from '@/core/api-base';
import { normalizeChartForWheel } from '@/core/chart-adapter';
import type { ProfilePrimaryChart } from '@/core/social/hooks';
import type { CanonicalLocation } from '@/types/location';

type ExplanationSection = {
  sectionId?: string;
  title: string;
  text?: string;
  bullets?: string[];
};

function defaultSkyLocation(): CanonicalLocation {
  const resolvedAt = new Date().toISOString();
  return {
    source: 'geofinder',
    label: 'Texas, United States',
    lat: 29.42,
    lon: -98.49,
    timezone: 'America/Chicago',
    resolvedAt,
  };
}

function chartFallbackLocation(chart: ProfilePrimaryChart): CanonicalLocation {
  return {
    source: 'geofinder',
    label: chart.label?.trim() || 'Birth location',
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone?.trim() || 'UTC',
    resolvedAt: new Date().toISOString(),
  };
}

function mapSections(payload: Record<string, unknown>): ExplanationSection[] | null {
  const exp = payload.explanation as { sections?: Array<Record<string, unknown>> } | undefined;
  if (!exp?.sections?.length) return null;
  return exp.sections.map((s) => ({
    sectionId: String(s.sectionId ?? s.id ?? ''),
    title: String(s.title ?? ''),
    text: typeof s.text === 'string' ? s.text : undefined,
    bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : undefined,
  }));
}

function resolveNowDateTime(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { dateStr, timeStr: `${hh}:${mm}` };
}

export interface TodaySkySummaryProps {
  primaryChart: ProfilePrimaryChart | null;
}

export function TodaySkySummary({ primaryChart }: TodaySkySummaryProps) {
  const [chartData, setChartData] = useState<unknown>(null);
  const [composeHash, setComposeHash] = useState('');
  const [analysisText, setAnalysisText] = useState('');
  const [explanationSections, setExplanationSections] = useState<ExplanationSection[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolveLocation = (): Promise<CanonicalLocation> =>
      new Promise((resolve) => {
        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const resolvedAt = new Date().toISOString();
              const browserTz =
                typeof Intl !== 'undefined' &&
                typeof Intl.DateTimeFormat === 'function' &&
                Intl.DateTimeFormat().resolvedOptions().timeZone
                  ? Intl.DateTimeFormat().resolvedOptions().timeZone
                  : 'UTC';
              resolve({
                source: 'browser_geo',
                label: 'Current location',
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                timezone: browserTz,
                resolvedAt,
              });
            },
            () => {
              if (
                primaryChart &&
                typeof primaryChart.lat === 'number' &&
                typeof primaryChart.lon === 'number'
              ) {
                resolve(chartFallbackLocation(primaryChart));
              } else {
                resolve(defaultSkyLocation());
              }
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        } else if (
          primaryChart &&
          typeof primaryChart.lat === 'number' &&
          typeof primaryChart.lon === 'number'
        ) {
          resolve(chartFallbackLocation(primaryChart));
        } else {
          resolve(defaultSkyLocation());
        }
      });

    async function load() {
      setIsLoading(true);
      setFailed(false);
      try {
        const loc = await resolveLocation();
        if (cancelled) return;

        const { dateStr, timeStr } = resolveNowDateTime();
        const base = getApiBaseUrl();
        const tzParam =
          loc.timezone && String(loc.timezone).trim()
            ? `&timezone=${encodeURIComponent(loc.timezone.trim())}`
            : '';

        const snapRes = await fetch(
          `/api/chart-snapshot?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}&lat=${loc.lat}&lon=${loc.lon}${tzParam}`
        );
        const snapshot = snapRes.ok ? await snapRes.json().catch(() => null) : null;
        let wheelSource: unknown = snapshot ? normalizeChartForWheel(snapshot) : null;

        const composeRes = await fetch(`${base || ''}/api/compose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: dateStr,
            time: timeStr,
            location: loc,
            generateAudio: false,
          }),
        });
        const payload = (await composeRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (cancelled) return;

        if (!composeRes.ok) {
          setFailed(true);
          return;
        }

        const sections = mapSections(payload);
        const hash =
          (payload.controls as { hash?: string } | undefined)?.hash ??
          (payload.hash as string) ??
          '';
        let analysis = '';
        if (payload.explanation && typeof (payload.explanation as { text?: string }).text === 'string') {
          analysis = (payload.explanation as { text: string }).text;
        }

        if (!wheelSource) {
          wheelSource = payload.controlSurface ?? payload.controls ?? null;
          if (wheelSource) wheelSource = normalizeChartForWheel(wheelSource);
        }

        setComposeHash(hash);
        setExplanationSections(sections);
        setAnalysisText(sections ? '' : analysis);
        setChartData(wheelSource);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [primaryChart?.lat, primaryChart?.lon, primaryChart?.timezone, primaryChart?.label]);

  if (failed && !isLoading && !explanationSections && !analysisText && !chartData) {
    return null;
  }

  return (
    <section aria-label="Right now in the sky">
      <div className="space-y-1 mb-6">
        <h2 className="text-h2 font-serif font-semibold text-text-primary">Right Now in the Sky</h2>
        <p className="text-body-sm text-text-secondary">What the planets are doing today, for everyone.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 md:gap-8 items-start">
        <ExplanationPanel
          embedded
          composeHash={composeHash}
          text={analysisText}
          sections={explanationSections ?? undefined}
          isLoading={isLoading}
        />
        <div className="min-w-0">
          <WheelDisplay chartData={chartData} isLoading={isLoading} className="w-full" maxSize={480} />
        </div>
      </div>
    </section>
  );
}
