'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// use relative imports to avoid alias issues
import { getApiBaseUrl } from '../src/core/api-base';
import { useProfile } from '../src/core/social/hooks';
import { playLyriaAudio, stopLyriaPlayback } from '../src/core/audio/lyria-playback';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { WheelDisplay } from '@/components/wheel/WheelDisplay';
import ExplanationPanel from '../src/components/ExplanationPanel';
import { PlacementHighlightProvider } from '@/core/PlacementHighlightContext';
import { SKY_SECTION_PLANETS } from '@/core/planet-identity';
import { normalizeChartForWheel } from '../src/core/chart-adapter';
import {
  getHomeCache,
  HOME_DAILY_COMPOSE_TIME,
  setHomeCache,
  updateHomeCacheAudio,
  type HomeComposeCacheEntry,
  type HomeExplanationSection,
} from '../src/core/home-compose-cache';
import type { CanonicalLocation, GeoPermissionStatus } from '../src/types/location';

/** Fallback when browser geolocation is denied or unavailable. */
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

type ChartData = any;

export default function HomePage() {
  const router = useRouter();
  const { user, loading: profileLoading } = useProfile();
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [composeHash, setComposeHash] = useState<string>('');
  const [exportId, setExportId] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [explanationSections, setExplanationSections] = useState<
    Array<{ sectionId?: string; title: string; text?: string; bullets?: string[]; planets?: string[] }> | null
  >(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [composePlan, setComposePlan] = useState<any>(null);
  const [composeGenre, setComposeGenre] = useState<string>('house');
  const [specVersion, setSpecVersion] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [composeLatency, setComposeLatency] = useState<number | null>(null);
  const [audioStartupTime, setAudioStartupTime] = useState<number | null>(null);

  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [location, setLocation] = useState<CanonicalLocation | null>(null);
  const [geoPermission, setGeoPermission] = useState<GeoPermissionStatus>('unknown');
  const signedInUserPresent = user !== null;
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  /** Lyria-only: explicit message when artifact missing or playback fails. */
  const [audioUnavailableReason, setAudioUnavailableReason] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const audioBlobUrlRef = useRef<string | null>(null);
  const composeRequestKeyRef = useRef<string | null>(null);
  const composeInFlightRef = useRef(false);
  const audioInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
        audioBlobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const dev = process.env.NODE_ENV === 'development';
    const fromUrl =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';
    setShowDebugPanel(dev || fromUrl);
  }, []);

  useEffect(() => {
    if (!profileLoading && user) {
      router.replace('/today');
    }
  }, [profileLoading, user, router]);

  // 1) defaults: today / now / browser geolocation (single source of truth for home)
  useEffect(() => {
    const now = new Date();
    setDateStr((prev) => prev || now.toISOString().slice(0, 10));
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimeStr((prev) => prev || `${hh}:${mm}`);

    const applyFallbackLocation = () => {
      setGeoPermission('denied');
      setLocation((prev) => prev ?? defaultSkyLocation());
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setGeoPermission('granted');
          const resolvedAt = new Date().toISOString();
          const browserTz =
            typeof Intl !== 'undefined' &&
            typeof Intl.DateTimeFormat === 'function' &&
            Intl.DateTimeFormat().resolvedOptions().timeZone
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : 'UTC';
          const baseLocation: CanonicalLocation = {
            source: 'browser_geo',
            label: 'Current location',
            lat: latitude,
            lon: longitude,
            timezone: browserTz,
            resolvedAt,
          };
          setLocation(baseLocation);
        },
        () => {
          applyFallbackLocation();
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    } else {
      setGeoPermission('unavailable');
      setLocation((prev) => prev ?? defaultSkyLocation());
    }
  }, []);

  const enrichSkySections = useCallback(
    (sections: HomeExplanationSection[] | null): HomeExplanationSection[] | null => {
      if (!sections) return null;
      return sections.map((sec) => {
        const sectionId = sec.sectionId ?? '';
        if (!sec.planets?.length && sectionId && SKY_SECTION_PLANETS[sectionId]) {
          return { ...sec, planets: SKY_SECTION_PLANETS[sectionId] };
        }
        return sec;
      });
    },
    []
  );

  const mapSections = useCallback((payload: Record<string, unknown>): HomeExplanationSection[] | null => {
    const exp = payload.explanation as { sections?: Array<Record<string, unknown>> } | undefined;
    if (!exp?.sections?.length) return null;
    const sections = exp.sections.map((s) => ({
      sectionId: String(s.sectionId ?? s.id ?? ''),
      title: String(s.title ?? ''),
      text: typeof s.text === 'string' ? s.text : undefined,
      bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : undefined,
    }));
    return enrichSkySections(sections);
  }, [enrichSkySections]);

  const loadWheelChart = useCallback(
    async (composeTime: string, loc: CanonicalLocation, surfaceFallback: unknown) => {
      let wheelSource: unknown = null;
      try {
        const tzParam =
          loc.timezone && String(loc.timezone).trim()
            ? `&timezone=${encodeURIComponent(loc.timezone.trim())}`
            : '';
        const snapRes = await fetch(
          `/api/chart-snapshot?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(
            composeTime
          )}&lat=${loc.lat}&lon=${loc.lon}${tzParam}`
        );
        if (snapRes.ok) {
          const snapshot = await snapRes.json().catch(() => null);
          wheelSource = snapshot ? normalizeChartForWheel(snapshot) : null;
        }
      } catch {
        /* ignore */
      }
      if (!wheelSource) wheelSource = surfaceFallback;
      return wheelSource;
    },
    [dateStr]
  );

  const applyCacheEntry = useCallback((entry: HomeComposeCacheEntry) => {
    setComposeHash(entry.composeHash);
    setSpecVersion(entry.specVersion);
    setAnalysisText(entry.analysisText);
    setExplanationSections(enrichSkySections(entry.sections));
    setExportId(entry.exportId);
    setChartData(entry.chartData);
    setEngineError(null);
    setAudioUnavailableReason(
      entry.audioFailed
        ? 'Audio is temporarily unavailable. Try again tomorrow.'
        : null
    );
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current);
      audioBlobUrlRef.current = null;
    }
    setAudioUrl(null);
    setIsPlaying(false);
  }, [enrichSkySections]);

  const applyComposePayload = useCallback(
    async (
      payload: Record<string, unknown>,
      loc: CanonicalLocation,
      composeTime: string,
      cacheDate: string,
      options: { withAudio: boolean }
    ): Promise<HomeComposeCacheEntry> => {
      const responseSpec = (payload.explanation as { spec?: string } | undefined)?.spec;
      if (responseSpec && responseSpec !== 'UnifiedSpecV1.1') {
        throw new Error(`Unsupported spec version: ${responseSpec}`);
      }
      if (payload.engine_fallback) {
        setEngineError('Engine unavailable - using fallback mode');
      } else {
        setEngineError(null);
      }

      const surface = payload.controlSurface ?? payload.controls ?? null;
      const hash = (payload.controls as { hash?: string } | undefined)?.hash ?? (payload.hash as string) ?? '';
      const sections = mapSections(payload);
      let analysis = '';
      if (payload.explanation && typeof (payload.explanation as { text?: string }).text === 'string') {
        analysis = (payload.explanation as { text: string }).text;
      }

      if (payload.plan && typeof payload.plan === 'object') {
        setComposePlan(payload.plan);
      } else {
        setComposePlan(null);
      }
      setComposeGenre((payload.controls as { genre?: string } | undefined)?.genre ?? 'house');

      const wheelSource = await loadWheelChart(composeTime, loc, surface);
      const exportIdFromPayload =
        typeof payload.export_id === 'string' && payload.export_id.length > 0
          ? payload.export_id
          : null;

      setComposeHash(hash);
      setSpecVersion(responseSpec || null);
      setAnalysisText(sections ? '' : analysis);
      setExplanationSections(sections);
      setChartData(wheelSource);
      setExportId(exportIdFromPayload);

      if (options.withAudio) {
        setAudioUnavailableReason(null);
        const audioMeta = payload.audio as Record<string, unknown> | undefined;
        const isLyriaSuccess =
          audioMeta?.provider_used === 'lyria' &&
          (audioMeta?.export_error == null || audioMeta?.export_error === '');
        let nextUrl: string | null = null;
        if (typeof audioMeta?.url === 'string' && isLyriaSuccess) {
          nextUrl = audioMeta.url as string;
        } else if (
          isLyriaSuccess &&
          typeof audioMeta?.base64 === 'string' &&
          (audioMeta.base64 as string).length > 0
        ) {
          try {
            const bin = atob(audioMeta.base64 as string);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'audio/wav' });
            nextUrl = URL.createObjectURL(blob);
            audioBlobUrlRef.current = nextUrl;
          } catch {
            nextUrl = null;
          }
        } else if (exportIdFromPayload) {
          try {
            const base = getApiBaseUrl();
            const exportRes = await fetch(`${base || ''}/api/exports/${exportIdFromPayload}`);
            if (exportRes.ok) {
              const ab = await exportRes.arrayBuffer();
              if (ab.byteLength > 0) {
                const blob = new Blob([ab], { type: exportRes.headers.get('content-type') || 'audio/wav' });
                nextUrl = URL.createObjectURL(blob);
                audioBlobUrlRef.current = nextUrl;
              }
            }
          } catch {
            nextUrl = null;
          }
        }
        if (!nextUrl && audioMeta?.export_error && audioMeta?.export_attempted) {
          setAudioUnavailableReason(
            `Audio unavailable (Lyria-only). Export failed: ${String(audioMeta.export_error)}.`
          );
        }
        setAudioUrl(nextUrl);
      } else {
        if (audioBlobUrlRef.current) {
          URL.revokeObjectURL(audioBlobUrlRef.current);
          audioBlobUrlRef.current = null;
        }
        setAudioUrl(null);
        setAudioUnavailableReason(null);
      }

      return {
        sections,
        analysisText: sections ? '' : analysis,
        exportId: exportIdFromPayload,
        chartData: wheelSource,
        composeHash: hash,
        specVersion: responseSpec || null,
        date: cacheDate,
        cachedAt: Date.now(),
      };
    },
    [loadWheelChart, mapSections]
  );

  // Wheel-only refresh when time changes (cheap snapshot GET; does not trigger compose).
  useEffect(() => {
    if (profileLoading || user) return;
    if (!location || location.lat == null || location.lon == null || !dateStr || !timeStr) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const wheel = await loadWheelChart(timeStr, location, chartData);
      if (!cancelled && wheel) setChartData(wheel);
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr, timeStr, location?.lat, location?.lon, loadWheelChart, profileLoading, user]);

  // Text-only compose on load (no Lyria); localStorage daily cache per date + location.
  useEffect(() => {
    if (profileLoading || user) return;
    if (!location || !dateStr || location.lat == null || location.lon == null) {
      return;
    }
    const stableLoc: CanonicalLocation = location;
    const lat = stableLoc.lat;
    const lon = stableLoc.lon;
    const inFlightKey = `${dateStr}_${lat}_${lon}|text`;

    if (composeInFlightRef.current && composeRequestKeyRef.current === inFlightKey) {
      return;
    }

    let cancelled = false;
    composeRequestKeyRef.current = inFlightKey;
    composeInFlightRef.current = true;

    async function bootstrap() {
      const cached = getHomeCache(dateStr, lat, lon);
      if (cached) {
        applyCacheEntry(cached);
        setIsLoading(false);
        composeInFlightRef.current = false;
        return;
      }

      setIsLoading(true);
      try {
        const body = {
          date: dateStr,
          time: HOME_DAILY_COMPOSE_TIME,
          location: stableLoc,
          generateAudio: false,
        };

        const startTime = performance.now();
        const base = getApiBaseUrl();
        const res = await fetch(`${base || ''}/api/compose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        setComposeLatency(performance.now() - startTime);
        if (cancelled) return;

        const entry = await applyComposePayload(
          payload,
          stableLoc,
          HOME_DAILY_COMPOSE_TIME,
          dateStr,
          { withAudio: false }
        );
        setHomeCache(dateStr, lat, lon, {
          ...entry,
          date: dateStr,
          audioFailed: false,
          audioFailedReason: null,
        });
      } catch (e) {
        console.error('[compose] failed', e);
        if (!cancelled) setEngineError('Could not load sky report.');
      } finally {
        if (!cancelled) setIsLoading(false);
        composeInFlightRef.current = false;
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      composeInFlightRef.current = false;
    };
  }, [dateStr, location?.lat, location?.lon, location?.timezone, applyCacheEntry, applyComposePayload, profileLoading, user]);

  // 2a) Persist canonical location for campaign daily / group anchor (signed-in only; skip anonymous 401 noise)
  const lastTransitSyncKey = useRef<string | null>(null);
  useEffect(() => {
    if (!signedInUserPresent || !location) return;
    const key = JSON.stringify({
      source: location.source,
      lat: location.lat,
      lon: location.lon,
      timezone: location.timezone,
      resolvedAt: location.resolvedAt,
      label: location.label,
    });
    if (lastTransitSyncKey.current === key) return;
    lastTransitSyncKey.current = key;
    const base = getApiBaseUrl();
    void fetch(`${base || ''}/api/users/me/transit-context`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    }).catch(() => {
      /* network — ignore */
    });
  }, [location, signedInUserPresent]);

  // 2b) reverse-geocode label when coords available (display only); idempotent: no setLocation if label unchanged
  useEffect(() => {
    if (location?.lat == null || location?.lon == null) return;
    const lat = location.lat;
    const lon = location.lon;

    let cancelled = false;
    async function resolveLabel() {
      try {
        const base = getApiBaseUrl();
        const r = await fetch(`${base || ''}/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        const j = await r.json();
        if (cancelled) return;
        const parts = [j?.city, j?.region, j?.country].filter(Boolean);
        let displayLabel = parts.length > 0 ? parts.join(', ') : '';
        if (!displayLabel && typeof j?.label === 'string' && j.label.trim()) {
          const short = j.label
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');
          displayLabel = short || 'Your area';
        }
        if (!displayLabel) displayLabel = 'Your area';
        setLocation((prev) => {
          if (!prev || prev.label === displayLabel) return prev;
          return { ...prev, label: displayLabel };
        });
      } catch {
        if (!cancelled) {
          setLocation((prev) => {
            if (!prev || prev.label === 'Your area') return prev;
            return { ...prev, label: 'Your area' };
          });
        }
      }
    }
    resolveLabel();
    return () => {
      cancelled = true;
    };
  }, [location?.lat, location?.lon]);

  const resolveExportAudioUrl = useCallback(async (eid: string): Promise<string | null> => {
    const base = getApiBaseUrl();
    try {
      const exportRes = await fetch(`${base || ''}/api/exports/${eid}`);
      if (!exportRes.ok) return null;
      const ab = await exportRes.arrayBuffer();
      if (ab.byteLength === 0) return null;
      const blob = new Blob([ab], { type: exportRes.headers.get('content-type') || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioBlobUrlRef.current = url;
      return url;
    } catch {
      return null;
    }
  }, []);

  const playSoundtrack = useCallback(async () => {
    setAudioUnavailableReason(null);
    if (!audioUrl) {
      setAudioUnavailableReason('Audio unavailable (Lyria-only). No artifact returned from backend.');
      return;
    }
    try {
      const start = performance.now();
      await playLyriaAudio({ url: audioUrl });
      setAudioStartupTime(performance.now() - start);
      setIsPlaying(true);
    } catch (e) {
      setIsPlaying(false);
      const msg = e instanceof Error ? e.message : 'Playback failed';
      setAudioUnavailableReason(`Audio unavailable (Lyria-only). ${msg}`);
    }
  }, [audioUrl]);

  const stopSoundtrack = useCallback(() => {
    stopLyriaPlayback();
    setIsPlaying(false);
  }, []);

  const handleTodaySoundtrack = useCallback(async () => {
    if (isPlaying) {
      stopSoundtrack();
      return;
    }

    if (audioUrl) {
      await playSoundtrack();
      return;
    }

    if (!location || location.lat == null || location.lon == null || !dateStr) {
      return;
    }

    const cached = getHomeCache(dateStr, location.lat, location.lon);

    if (cached?.audioFailed) {
      setAudioUnavailableReason('Audio is temporarily unavailable. Try again tomorrow.');
      return;
    }

    if (cached?.exportId) {
      setAudioLoading(true);
      try {
        const url = await resolveExportAudioUrl(cached.exportId);
        if (url) {
          setExportId(cached.exportId);
          setAudioUrl(url);
          await playLyriaAudio({ url });
          setIsPlaying(true);
          return;
        }
      } finally {
        setAudioLoading(false);
      }
    }

    if (audioInFlightRef.current) return;
    audioInFlightRef.current = true;
    setAudioLoading(true);
    setAudioUnavailableReason(null);

    try {
      const body = {
        date: dateStr,
        time: HOME_DAILY_COMPOSE_TIME,
        location,
        generateAudio: true,
      };
      const base = getApiBaseUrl();
      const res = await fetch(`${base || ''}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      const entry = await applyComposePayload(
        payload,
        location,
        HOME_DAILY_COMPOSE_TIME,
        dateStr,
        { withAudio: true }
      );
      const merged: HomeComposeCacheEntry = {
        ...entry,
        sections: entry.sections ?? cached?.sections ?? null,
        chartData: entry.chartData ?? cached?.chartData ?? null,
        analysisText: entry.analysisText || cached?.analysisText || '',
        composeHash: entry.composeHash || cached?.composeHash || '',
        specVersion: entry.specVersion ?? cached?.specVersion ?? null,
        date: dateStr,
      };
      const exportErr =
        typeof payload?.audio?.export_error === 'string' ? payload.audio.export_error : null;
      const audioFailed = !merged.exportId;
      setHomeCache(dateStr, location.lat, location.lon, {
        ...merged,
        audioFailed,
        audioFailedReason: audioFailed ? exportErr ?? 'render_failed' : null,
      });

      const url =
        audioBlobUrlRef.current ??
        (merged.exportId ? await resolveExportAudioUrl(merged.exportId) : null);
      if (url) {
        setAudioUrl(url);
        await playLyriaAudio({ url });
        setIsPlaying(true);
      } else {
        setAudioUnavailableReason('Audio is temporarily unavailable. Try again tomorrow.');
      }
    } catch (e) {
      updateHomeCacheAudio(dateStr, location.lat, location.lon, null, true, 'request_failed');
      setAudioUnavailableReason('Audio is temporarily unavailable. Try again tomorrow.');
    } finally {
      setAudioLoading(false);
      audioInFlightRef.current = false;
    }
  }, [
    isPlaying,
    audioUrl,
    location,
    dateStr,
    playSoundtrack,
    stopSoundtrack,
    applyComposePayload,
    resolveExportAudioUrl,
  ]);

  useEffect(() => {
    return () => {
      stopLyriaPlayback();
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [audioUrl]);

  if (profileLoading) {
    return (
      <AppShell showPlayer={false} contentClassName="">
        <div className="min-h-[40vh] flex items-center justify-center text-text-secondary text-sm">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (user) {
    return null;
  }

  const disabled = isLoading || !chartData || !location;

  const locationLabel = location
    ? location.label
    : geoPermission === 'denied'
      ? 'Using approximate location'
      : 'Locating…';

  return (
    <AppShell showPlayer={false} contentClassName="">
      {/* Hero + primary CTA */}
      <section className="text-center py-12 md:py-16 space-y-6 max-w-3xl mx-auto px-4">
        <h1 className="text-h1 sm:text-display md:text-display-lg font-serif text-text-primary">
          Astrology you can hear.
        </h1>
        <p className="text-body-sm md:text-body text-text-secondary max-w-xl mx-auto">
          The planets are always in motion. Every alignment carries a sound.
        </p>

        <div className="pt-4 flex flex-col items-center gap-3">
          {isPlaying ? (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => stopSoundtrack()}
              className="text-lg px-10 py-4 w-full md:w-auto"
            >
              Stop
            </Button>
          ) : (
            <Button
              type="button"
              variant="audio"
              disabled={disabled || audioLoading}
              loading={audioLoading}
              onClick={() => void handleTodaySoundtrack()}
              className="text-lg px-10 py-4 w-full md:w-auto"
            >
              Today&apos;s Soundtrack
            </Button>
          )}
        </div>

        {(audioUnavailableReason || engineError) && (
          <div className="space-y-1 max-w-md mx-auto text-left">
            {audioUnavailableReason && (
              <p className="text-xs text-amber-400">⚠️ {audioUnavailableReason}</p>
            )}
            {engineError && <p className="text-xs text-red-400">⚠️ {engineError}</p>}
          </div>
        )}
      </section>

      <div className="max-w-4xl mx-auto border-t border-border/30" />

      {/* Sky report + wheel */}
      <PlacementHighlightProvider>
        <section className="max-w-6xl mx-auto px-4 py-8 md:py-10">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 items-start">
            <Card elevation="resting" padding="p-6">
              <h2 className="reading-section-header mb-4">Right now in the sky</h2>
              <ExplanationPanel
                embedded
                composeHash={composeHash}
                text={analysisText}
                sections={explanationSections?.slice(0, 1) ?? undefined}
                isLoading={isLoading}
              />
              <p className="text-body-sm text-accent mt-4">
                <a href="/today" className="hover:underline">
                  See the full sky report →
                </a>
              </p>
            </Card>

            <div className="min-w-0">
              <WheelDisplay chartData={chartData} isLoading={isLoading} className="w-full" />
            </div>
          </div>
        </section>
      </PlacementHighlightProvider>

      {/* Secondary controls */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-4 justify-center w-full max-w-md mx-auto">
          <div className="space-y-1 w-full sm:w-auto">
            <label htmlFor="home-date" className="text-caption text-text-muted block">
              Date
            </label>
            <input
              id="home-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              disabled={isLoading}
              className="input text-sm py-2 px-3 w-full sm:w-40 min-h-[44px]"
            />
          </div>
          <div className="space-y-1 w-full sm:w-auto">
            <label htmlFor="home-time" className="text-caption text-text-muted block">
              Time
            </label>
            <input
              id="home-time"
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              disabled={isLoading}
              className="input text-sm py-2 px-3 w-full sm:w-32 min-h-[44px]"
            />
          </div>
          <div className="space-y-1 w-full sm:min-w-[10rem]">
            <span className="text-caption text-text-muted block">Location</span>
            <span className="text-sm text-text-secondary block py-2 break-words">{locationLabel}</span>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto border-t border-border/30" />

      {/* Sign-up funnel */}
      <section className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-lg text-text-secondary">Want to hear what your chart sounds like?</p>
        <Button
          type="button"
          variant="primary"
          onClick={() => router.push('/profile')}
          className="text-base px-8 py-3 w-full sm:w-auto min-h-[44px]"
        >
          Create your chart
        </Button>
      </section>

      {showDebugPanel && (
        <div className="max-w-2xl mx-auto px-4 pb-8 text-xs text-text-muted text-center space-y-1 font-mono">
          <p>Audio: Lyria-only (no legacy engine)</p>
          {specVersion && <p>Spec: {specVersion}</p>}
          {composeLatency != null && <p>Compose: {composeLatency.toFixed(0)}ms</p>}
          {audioStartupTime != null && <p>Audio startup: {audioStartupTime.toFixed(0)}ms</p>}
          <p>
            Geolocation: {geoPermission}
            {signedInUserPresent ? ' · transit sync: on' : ' · transit sync: off'}
          </p>
        </div>
      )}
    </AppShell>
  );
}