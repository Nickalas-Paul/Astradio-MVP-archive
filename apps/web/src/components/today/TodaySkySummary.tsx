'use client';

import { useCallback, useEffect, useState } from 'react';
import ExplanationPanel from '@/components/ExplanationPanel';
import { WheelDisplay } from '@/components/wheel/WheelDisplay';
import { extractAuraRawSnapshot, type AuraRawSnapshot } from '@/components/wheel/aura-raw-snapshot';
import { Button } from '@/components/shared/Button';
import { SaveToLibraryButton } from '@/components/shared/SaveToLibraryButton';
import { getApiBaseUrl } from '@/core/api-base';
import { normalizeChartForWheel } from '@/core/chart-adapter';
import { getSkyCache, setSkyCache, cleanExpiredSkyCache } from '@/core/sky-compose-cache';
import { extractComposeVisualControls, type ComposeVisualControls } from '@/core/compose-visual-controls';
import { SKY_SECTION_PLANETS } from '@/core/planet-identity';
import type { ProfilePrimaryChart } from '@/core/social/hooks';
import type { CanonicalLocation } from '@/types/location';
import { useAudioPlayerStore } from '@/store';

type ExplanationSection = {
  sectionId?: string;
  title: string;
  text?: string;
  bullets?: string[];
  planets?: string[];
};

type SkyComposeContext = {
  location: CanonicalLocation;
  dateStr: string;
  timeStr: string;
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
  const sections = exp.sections.map((s) => {
    const meta = s.meta as Record<string, unknown> | undefined;
    const transitCuration = meta?.transitCuration as
      | { natalBodies?: string[]; transitBodies?: string[] }
      | undefined;
    const metaPlanets = meta?.planets as string[] | undefined;

    let planets: string[] | undefined;
    if (transitCuration?.natalBodies || transitCuration?.transitBodies) {
      planets = [...(transitCuration.natalBodies || []), ...(transitCuration.transitBodies || [])].map((p) =>
        p.toLowerCase()
      );
    } else if (metaPlanets) {
      planets = metaPlanets.map((p) => p.toLowerCase());
    }

    const sectionId = String(s.sectionId ?? s.id ?? '');
    return {
      sectionId,
      title: String(s.title ?? ''),
      text: typeof s.text === 'string' ? s.text : undefined,
      bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : undefined,
      ...(planets?.length ? { planets } : {}),
    };
  });

  for (const sec of sections) {
    if (!sec.planets?.length && sec.sectionId && SKY_SECTION_PLANETS[sec.sectionId]) {
      sec.planets = SKY_SECTION_PLANETS[sec.sectionId];
    }
  }

  return sections;
}

function resolveNowDateTime(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { dateStr, timeStr: `${hh}:${mm}` };
}

function exportIdFromComposePayload(payload: Record<string, unknown>): string | null {
  const audio = payload?.audio as Record<string, unknown> | undefined;
  const exportId = (payload?.export_id ?? audio?.export_id) as string | undefined;
  if (typeof exportId === 'string' && /^[a-f0-9]{64}$/.test(exportId)) {
    return exportId;
  }
  console.warn('Compose response missing valid export_id');
  return null;
}

function resolveSkyLocation(primaryChart: ProfilePrimaryChart | null): Promise<CanonicalLocation> {
  return new Promise((resolve) => {
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
}

export interface TodaySkySummaryProps {
  primaryChart: ProfilePrimaryChart | null;
}

export function TodaySkySummary({ primaryChart }: TodaySkySummaryProps) {
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const [chartData, setChartData] = useState<unknown>(null);
  const [composeHash, setComposeHash] = useState('');
  const [analysisText, setAnalysisText] = useState('');
  const [explanationSections, setExplanationSections] = useState<ExplanationSection[] | null>(null);
  const [composeContext, setComposeContext] = useState<SkyComposeContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [skyAudioLoading, setSkyAudioLoading] = useState(false);
  const [skyAudioError, setSkyAudioError] = useState<string | null>(null);
  const [skyExportId, setSkyExportId] = useState<string | null>(null);
  const [composeControls, setComposeControls] = useState<ComposeVisualControls | null>(null);
  const [rawSnapshot, setRawSnapshot] = useState<AuraRawSnapshot | null>(null);

  const handleHearTodaysSky = useCallback(async () => {
    if (!composeContext) return;
    if (skyExportId) {
      playTrack({ exportId: skyExportId, label: "Today's Sky", source: 'sky' });
      return;
    }
    setSkyAudioLoading(true);
    setSkyAudioError(null);
    try {
      const base = getApiBaseUrl();
      const composeRes = await fetch(`${base || ''}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: composeContext.dateStr,
          time: composeContext.timeStr,
          location: composeContext.location,
          generateAudio: true,
        }),
      });
      const payload = (await composeRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!composeRes.ok) {
        setSkyAudioError(
          typeof payload.error === 'string' ? payload.error : 'Could not compose sky audio',
        );
        return;
      }
      const exportId = exportIdFromComposePayload(payload);
      if (!exportId) {
        setSkyAudioError('Could not compose sky audio');
        return;
      }
      if (payload.controls != null) {
        setComposeControls(extractComposeVisualControls(payload));
      }
      setSkyExportId(exportId);
      playTrack({ exportId, label: "Today's Sky", source: 'sky' });
    } catch {
      setSkyAudioError('Could not compose sky audio');
    } finally {
      setSkyAudioLoading(false);
    }
  }, [composeContext, playTrack, skyExportId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setFailed(false);
      try {
        const loc = await resolveSkyLocation(primaryChart);
        if (cancelled) return;

        const { dateStr, timeStr } = resolveNowDateTime();
        const context: SkyComposeContext = { location: loc, dateStr, timeStr };

        cleanExpiredSkyCache(dateStr);
        const cached = getSkyCache(dateStr, loc.lat, loc.lon);
        if (cached) {
          setComposeHash(cached.composeHash ?? '');
          setExplanationSections(cached.explanationSections as ExplanationSection[] | null);
          setAnalysisText(cached.analysisText ?? '');
          setChartData(cached.chartData);
          setComposeControls(cached.composeControls ?? null);
          setRawSnapshot(cached.rawSnapshot ?? null);
          setComposeContext(context);
          setIsLoading(false);
          return;
        }

        const base = getApiBaseUrl();
        const tzParam =
          loc.timezone && String(loc.timezone).trim()
            ? `&timezone=${encodeURIComponent(loc.timezone.trim())}`
            : '';

        const snapRes = await fetch(
          `/api/chart-snapshot?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}&lat=${loc.lat}&lon=${loc.lon}${tzParam}`
        );
        const snapshot = snapRes.ok ? await snapRes.json().catch(() => null) : null;
        const snapshotForAura = snapshot ? extractAuraRawSnapshot(snapshot) : null;
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

        const visualControls = extractComposeVisualControls(payload);

        setComposeHash(hash);
        setExplanationSections(sections);
        setAnalysisText(sections ? '' : analysis);
        setChartData(wheelSource);
        setComposeControls(visualControls);
        setRawSnapshot(snapshotForAura);
        setComposeContext(context);

        setSkyCache(dateStr, loc.lat, loc.lon, {
          explanationSections: sections,
          analysisText: sections ? '' : analysis,
          chartData: wheelSource,
          composeHash: hash,
          composeControls: visualControls,
          rawSnapshot: snapshotForAura,
          date: dateStr,
          lat: loc.lat,
          lon: loc.lon,
        });
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

  const hasSkyContent = Boolean(explanationSections?.length || analysisText || chartData);

  return (
    <section aria-label="Right now in the sky">
      <div className="space-y-1 mb-6">
        <h2 className="text-h2 font-serif font-semibold text-text-primary">Right Now in the Sky</h2>
        <p className="text-body-sm text-text-secondary">What the planets are doing today, for everyone.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-6 md:gap-8 items-start">
        <ExplanationPanel
          embedded
          composeHash={composeHash}
          text={analysisText}
          sections={explanationSections ?? undefined}
          isLoading={isLoading}
        />
        <div className="min-w-0 md:sticky md:top-20">
          <WheelDisplay
            chartData={chartData}
            isLoading={isLoading}
            className="w-full"
            maxSize={480}
            composeControls={composeControls}
            rawSnapshot={rawSnapshot ?? undefined}
            linkedExportId={skyExportId}
            showAspectLines
          />
        </div>
      </div>
      {!isLoading && hasSkyContent ? (
        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="audio"
              size="sm"
              disabled={skyAudioLoading || !composeContext}
              loading={skyAudioLoading}
              onClick={() => void handleHearTodaysSky()}
            >
              {skyExportId ? "Replay Today's Sky" : "Hear Today's Sky"}
            </Button>
            {skyExportId && composeContext ? (
              <SaveToLibraryButton
                exportId={skyExportId}
                source="sky"
                compositionType="sky"
                sandboxState={{
                  kind: 'sky_summary',
                  date: composeContext.dateStr,
                  time: composeContext.timeStr,
                  location: composeContext.location,
                }}
                label="Today's Sky"
              />
            ) : null}
          </div>
          {skyAudioError ? (
            <p className="text-sm text-amber-600 dark:text-amber-300" role="alert">
              {skyAudioError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
