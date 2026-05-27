'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// use relative imports to avoid alias issues
import { getApiBaseUrl } from '../src/core/api-base';
import { playLyriaAudio, stopLyriaPlayback } from '../src/core/audio/lyria-playback';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { WheelDisplay } from '@/components/wheel/WheelDisplay';
import ExplanationPanel from '../src/components/ExplanationPanel';
import { normalizeChartForWheel } from '../src/core/chart-adapter';
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
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [composeHash, setComposeHash] = useState<string>('');
  const [exportId, setExportId] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [explanationSections, setExplanationSections] = useState<
    Array<{ sectionId?: string; title: string; text?: string; bullets?: string[] }> | null
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
  /** True when /api/profile returns a user — used to gate signed-in-only persistence. */
  const [signedInUserPresent, setSignedInUserPresent] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState(false);
  /** Lyria-only: explicit message when artifact missing or playback fails. */
  const [audioUnavailableReason, setAudioUnavailableReason] = useState<string | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const audioBlobUrlRef = useRef<string | null>(null);
  const composeRequestKeyRef = useRef<string | null>(null);
  const composeInFlightRef = useRef(false);

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
    const base = getApiBaseUrl();
    void fetch(`${base || ''}/api/profile`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSignedInUserPresent(!!d?.user))
      .catch(() => setSignedInUserPresent(false));
  }, []);

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

  // 2) compose: gated on stable primitives only; single-flight per date/time/coords
  useEffect(() => {
    const lat = location?.lat;
    const lon = location?.lon;
    if (!dateStr || !timeStr || lat == null || lon == null || !location) {
      return;
    }
    const stableKey = `${dateStr}|${timeStr}|${lat}|${lon}|${location?.timezone ?? ''}`;
    if (composeInFlightRef.current && composeRequestKeyRef.current === stableKey) {
      return;
    }

    let cancelled = false;
    composeRequestKeyRef.current = stableKey;
    composeInFlightRef.current = true;

    async function bootstrap() {
      setIsLoading(true);
      try {
        const body: any = {
          date: dateStr,
          time: timeStr,
          location,
          generateAudio: true,
        };

        const startTime = performance.now();
        const base = getApiBaseUrl();
        const res = await fetch(`${base || ''}/api/compose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await res.json();
        const latency = performance.now() - startTime;
        setComposeLatency(latency);
        if (!cancelled) {
          // Fail fast on spec version mismatch
          const responseSpec = payload?.explanation?.spec;
          if (responseSpec && responseSpec !== 'UnifiedSpecV1.1') {
            setEngineError(`Unsupported spec version: ${responseSpec}. Expected UnifiedSpecV1.1`);
            setIsLoading(false);
            return;
          }
          
          // Check for engine fallback (proxy failure)
          if (payload?.engine_fallback) {
            setEngineError('Engine unavailable - using fallback mode');
          } else {
            setEngineError(null);
          }
          
          setSpecVersion(responseSpec || null);
          // Backend returns "controls"; accept both controlSurface (legacy) and controls
          const surface = payload?.controlSurface ?? payload?.controls ?? null;
          setComposeHash(payload?.controls?.hash ?? payload?.hash ?? '');
          setExportId(payload?.export_id ?? null);
          if (payload?.explanation?.text) {
            setAnalysisText(payload.explanation.text);
            setExplanationSections(null);
          } else if (payload?.explanation?.sections?.length) {
            setExplanationSections(
              payload.explanation.sections.map((s: Record<string, unknown>) => ({
                sectionId: String(s.sectionId ?? s.id ?? ''),
                title: String(s.title ?? ''),
                text: typeof s.text === 'string' ? s.text : undefined,
                bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : undefined,
              }))
            );
            setAnalysisText('');
          } else {
            setAnalysisText('');
            setExplanationSections(null);
          }
          // Lyria-only: only treat as playable when provider_used is lyria and no export_error
          setAudioUnavailableReason(null);
          const audioMeta = payload?.audio;
          const isLyriaSuccess =
            audioMeta?.provider_used === 'lyria' &&
            (audioMeta?.export_error == null || audioMeta?.export_error === '');
          if (payload?.audio?.url && isLyriaSuccess) {
            if (audioBlobUrlRef.current) {
              URL.revokeObjectURL(audioBlobUrlRef.current);
              audioBlobUrlRef.current = null;
            }
            setAudioUrl(payload.audio.url);
          } else if (
            isLyriaSuccess &&
            payload?.audio?.base64 &&
            typeof payload.audio.base64 === 'string' &&
            payload.audio.base64.length > 0
          ) {
            try {
              if (audioBlobUrlRef.current) {
                URL.revokeObjectURL(audioBlobUrlRef.current);
                audioBlobUrlRef.current = null;
              }
              const bin = atob(payload.audio.base64);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const blob = new Blob([bytes], { type: 'audio/wav' });
              const blobUrl = URL.createObjectURL(blob);
              audioBlobUrlRef.current = blobUrl;
              setAudioUrl(blobUrl);
            } catch (_) {
              setAudioUrl(null);
            }
          } else {
            if (audioBlobUrlRef.current) {
              URL.revokeObjectURL(audioBlobUrlRef.current);
              audioBlobUrlRef.current = null;
            }
            setAudioUrl(null);
            if (audioMeta?.export_error && audioMeta?.export_attempted) {
              setAudioUnavailableReason(`Audio unavailable (Lyria-only). Export failed: ${audioMeta.export_error}.`);
            }
          }

          // Store backend plan and genre (for browser performance engine / Tone fallback)
          if (payload?.plan && typeof payload.plan === 'object') {
            setComposePlan(payload.plan);
          } else {
            setComposePlan(null);
          }
          setComposeGenre(payload?.controls?.genre ?? 'house');

          // Wheel geometry: prefer canonical EphemerisSnapshot via /api/chart-snapshot.
          // Fallback to control-surface chart data only if snapshot request fails.
          let wheelSource: any = null;
          if (dateStr && timeStr && location) {
            const lat = location.lat;
            const lon = location.lon;
            try {
              const tzParam =
                location.timezone && String(location.timezone).trim()
                  ? `&timezone=${encodeURIComponent(location.timezone.trim())}`
                  : '';
              const snapRes = await fetch(
                `/api/chart-snapshot?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(
                  timeStr
                )}&lat=${lat}&lon=${lon}${tzParam}`
              );
              if (snapRes.ok) {
                const snapshot = await snapRes.json().catch(() => null);
                const normalized = snapshot ? normalizeChartForWheel(snapshot) : null;
                if (normalized) {
                  wheelSource = normalized;
                }
              }
            } catch (_) {
              // ignore, fall back to control-surface chart below
            }
          }

          if (!wheelSource) {
            wheelSource = surface;
          }
          setChartData(wheelSource);

          // Location display is handled by locationLabel + reverse-geocode effect; compose always uses geo lat/lon
        }
      } catch (e) {
        console.error('[compose] failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
        composeInFlightRef.current = false;
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      composeInFlightRef.current = false;
    };
  }, [dateStr, timeStr, location?.lat, location?.lon, location?.timezone]);

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
    setAudioEnabled(true);
    if (isPlaying) {
      stopSoundtrack();
      return;
    }
    await playSoundtrack();
  }, [isPlaying, playSoundtrack, stopSoundtrack]);

  useEffect(() => {
    return () => {
      stopLyriaPlayback();
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
  }, [audioUrl]);

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
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-text-primary leading-tight">
          Astrology you can hear.
        </h1>
        <p className="text-lg md:text-xl text-text-secondary max-w-xl mx-auto leading-relaxed">
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
              disabled={disabled}
              onClick={() => void handleTodaySoundtrack()}
              className="text-lg px-10 py-4 w-full md:w-auto"
            >
              Today&apos;s Soundtrack
            </Button>
          )}
          {exportId && (
            <a
              href={`${getApiBaseUrl() || ''}/api/exports/${exportId}`}
              download={`${exportId}-30s.wav`}
              className="text-sm text-text-muted hover:text-text-secondary underline underline-offset-2"
            >
              Download WAV (30s)
            </a>
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
      <section className="max-w-6xl mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 items-start">
          <Card elevation="resting" className="p-6">
            <h2 className="reading-section-header mb-4">Right now in the sky</h2>
            <ExplanationPanel
              embedded
              composeHash={composeHash}
              text={analysisText}
              sections={explanationSections ?? undefined}
              isLoading={isLoading}
            />
          </Card>

          <div className="min-w-0">
            <WheelDisplay chartData={chartData} isLoading={isLoading} className="w-full" />
          </div>
        </div>
      </section>

      {/* Secondary controls */}
      <section className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-end gap-4 justify-center">
          <div className="space-y-1">
            <label htmlFor="home-date" className="text-xs text-text-muted block">
              Date
            </label>
            <input
              id="home-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              disabled={isLoading}
              className="input text-sm py-1.5 px-2 w-40"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="home-time" className="text-xs text-text-muted block">
              Time
            </label>
            <input
              id="home-time"
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              disabled={isLoading}
              className="input text-sm py-1.5 px-2 w-32"
            />
          </div>
          <div className="space-y-1 min-w-[10rem]">
            <span className="text-xs text-text-muted block">Location</span>
            <span className="text-sm text-text-secondary block py-1.5">{locationLabel}</span>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto border-t border-border/30" />

      {/* Sign-up funnel */}
      <section className="max-w-xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-lg text-text-secondary">Want to hear what your chart sounds like?</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/profile')}
          className="text-base px-8 py-3"
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