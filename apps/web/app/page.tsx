'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// use relative imports to avoid alias issues
import { getApiBaseUrl } from '../src/core/api-base';
import { playLyriaAudio, stopLyriaPlayback } from '../src/core/audio/lyria-playback';
import HeaderTabs from '../src/components/HeaderTabs';
import WheelCanvas from '../src/components/WheelCanvas';
import ExplanationPanel from '../src/components/ExplanationPanel';
import { DateInput, TimeInput } from '../src/components/Inputs';
import { normalizeChartForWheel } from '../src/core/chart-adapter';
import type { CanonicalLocation, GeoPermissionStatus } from '../src/types/location';

type ChartData = any;

export default function HomePage() {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [composeHash, setComposeHash] = useState<string>('');
  const [exportId, setExportId] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [explanationSections, setExplanationSections] = useState<Array<{ title: string; text?: string; bullets?: string[] }> | null>(null);
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

  function formatCoords(lat: number, lon: number) {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
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

  // 1) defaults: today / now / browser geolocation (single source of truth for home)
  useEffect(() => {
    const now = new Date();
    setDateStr((prev) => prev || now.toISOString().slice(0, 10));
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimeStr((prev) => prev || `${hh}:${mm}`);

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
            label: formatCoords(latitude, longitude),
            lat: latitude,
            lon: longitude,
            timezone: browserTz,
            resolvedAt,
          };
          setLocation(baseLocation);
        },
        () => {
          setGeoPermission('denied');
          setLocation(null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setGeoPermission('unavailable');
      setLocation(null);
    }
  }, []);

  // 2) compose: gated on stable primitives only; single-flight per date/time/coords
  useEffect(() => {
    const lat = location?.lat;
    const lon = location?.lon;
    if (!dateStr || !timeStr || lat == null || lon == null || !location) {
      return;
    }
    const stableKey = `${dateStr}|${timeStr}|${lat}|${lon}`;
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
            setExplanationSections(payload.explanation.sections);
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
              const snapRes = await fetch(
                `/api/chart-snapshot?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(
                  timeStr
                )}&lat=${lat}&lon=${lon}`
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
  }, [dateStr, timeStr, location?.lat, location?.lon]);

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
        const label = j?.label ?? formatCoords(lat, lon);
        const parts = [j?.city, j?.region, j?.country].filter(Boolean);
        const displayLabel = parts.length > 0 ? parts.join(', ') : label;
        setLocation((prev) => {
          if (!prev || prev.label === displayLabel) return prev;
          return { ...prev, label: displayLabel };
        });
      } catch {
        if (!cancelled) {
          const fallback = formatCoords(lat, lon);
          setLocation((prev) => {
            if (!prev || prev.label === fallback) return prev;
            return { ...prev, label: fallback };
          });
        }
      }
    }
    resolveLabel();
    return () => {
      cancelled = true;
    };
  }, [location?.lat, location?.lon]);

  // Lyria-only playback. Single path: playLyriaAudio(payload.audio) or fail-closed message.
  useEffect(() => {
    async function handlePlay() {
      setAudioUnavailableReason(null);
      if (!audioUrl) {
        setAudioUnavailableReason('Audio unavailable (Lyria-only). No artifact returned from backend.');
        return;
      }
      try {
        const start = performance.now();
        await playLyriaAudio({ url: audioUrl });
        setAudioStartupTime(performance.now() - start);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Playback failed';
        setAudioUnavailableReason(`Audio unavailable (Lyria-only). ${msg}`);
      }
    }
    function handleStop() {
      stopLyriaPlayback();
    }
    window.addEventListener('astradio:play', handlePlay as any);
    window.addEventListener('astradio:stop', handleStop as any);
    return () => {
      window.removeEventListener('astradio:play', handlePlay as any);
      window.removeEventListener('astradio:stop', handleStop as any);
      handleStop();
    };
  }, [audioUrl]);

  const disabled = isLoading || !chartData || !location;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Top nav */}
      <header className="w-full border-b border-white/5 sticky top-0 z-40 bg-bg/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-emerald-400 font-semibold tracking-wide">
              Astradio
            </Link>
            <HeaderTabs />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-10 pb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Here's what today sounds like.
        </h1>
      </section>

      {/* Main: explainer (left) | wheel (right) */}
      <main className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Text explainer */}
          <aside className="lg:col-span-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <ExplanationPanel composeHash={composeHash} text={analysisText} sections={explanationSections ?? undefined} isLoading={isLoading} />
            </div>
          </aside>

          {/* Right: Wheel */}
          <section className="lg:col-span-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <WheelCanvas chartData={chartData} isLoading={isLoading} />
              {/* Viz sync indicator */}
              {chartData && !isLoading && (
                <div className="mt-2 text-center">
                  <p className="text-xs text-zinc-400">
                    Visuals synced to this composition — coming soon
                  </p>
                </div>
              )}
            </div>

            {/* Inputs row under wheel */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DateInput value={dateStr} onChange={setDateStr} disabled={isLoading} />
              <TimeInput value={timeStr} onChange={setTimeStr} disabled={isLoading} />
              <div className="flex flex-col text-xs text-subtext">
                <span className="mb-1 font-medium text-text">Location</span>
                <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  {location ? location.label : geoPermission === 'denied' ? 'Geolocation denied' : 'Locating...'}
                </span>
              </div>
            </div>

            {/* Transport with audio gesture gating */}
            <div className="mt-4 flex items-center gap-3">
              {!audioEnabled ? (
                <button
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => setAudioEnabled(true)}
                >
                  Tap to Enable Audio
                </button>
              ) : (
                <>
                  <button
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => window.dispatchEvent(new CustomEvent('astradio:play'))}
                  >
                    Play
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 disabled:opacity-50"
                    disabled={disabled}
                    onClick={() => window.dispatchEvent(new CustomEvent('astradio:stop'))}
                  >
                    Stop
                  </button>
                  {exportId && (
                    <a
                      href={`${getApiBaseUrl() || ''}/api/exports/${exportId}`}
                      download={`${exportId}-30s.wav`}
                      className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 inline-flex items-center justify-center"
                    >
                      Download WAV (30s)
                    </a>
                  )}
                </>
              )}
            </div>

            {/* Engine status and debug info */}
            <div className="mt-2 space-y-1">
              {audioUnavailableReason && (
                <p className="text-xs text-amber-400">
                  ⚠️ {audioUnavailableReason}
                </p>
              )}
              {engineError && (
                <p className="text-xs text-red-400">
                  ⚠️ {engineError}
                </p>
              )}
              {showDebugPanel && (
                <p className="text-xs text-amber-400/90 font-mono">
                  Audio: Lyria-only (no legacy engine)
                </p>
              )}
              {specVersion && (
                <p className="text-xs text-green-400">
                  ✓ Spec: {specVersion}
                </p>
              )}
              {composeLatency && (
                <p className="text-xs text-blue-400">
                  ⏱️ Compose: {composeLatency.toFixed(0)}ms
                </p>
              )}
              {audioStartupTime && (
                <p className="text-xs text-blue-400">
                  🔊 Audio: {audioStartupTime.toFixed(0)}ms
                </p>
              )}
              <p className="text-xs text-zinc-500">
                Geolocation:{' '}
                {geoPermission === 'granted'
                  ? location
                    ? `granted (${location.lat.toFixed(4)}, ${location.lon.toFixed(4)})`
                    : 'granted (no location yet)'
                  : geoPermission}
              </p>
            </div>
          </section>
        </div>

        <div className="h-16" />
      </main>
    </div>
  );
}