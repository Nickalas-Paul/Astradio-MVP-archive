'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// use relative imports to avoid alias issues
import { getApiBaseUrl } from '../src/core/api-base';
import HeaderTabs from '../src/components/HeaderTabs';
import WheelCanvas from '../src/components/WheelCanvas';
import ExplanationPanel from '../src/components/ExplanationPanel';
import { DateInput, TimeInput, LocationInput } from '../src/components/Inputs';

type ChartData = any;

type GeoState =
  | { status: 'idle'; lat: null; lon: null }
  | { status: 'ok'; lat: number; lon: number }
  | { status: 'denied' | 'error'; lat: null; lon: null };

export default function HomePage() {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [composeHash, setComposeHash] = useState<string>('');
  const [explanationText, setExplanationText] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [specVersion, setSpecVersion] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [composeLatency, setComposeLatency] = useState<number | null>(null);
  const [audioStartupTime, setAudioStartupTime] = useState<number | null>(null);

  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [locationStr, setLocationStr] = useState<string>('');
  const [geo, setGeo] = useState<GeoState>({ status: 'idle', lat: null, lon: null });
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const audioBlobUrlRef = useRef<string | null>(null);
  const toneSeqRef = useRef<any>(null);
  const toneModuleRef = useRef<typeof import('tone') | null>(null);

  async function getTone(): Promise<typeof import('tone') | null> {
    if (typeof window === 'undefined') return null;
    if (toneModuleRef.current) return toneModuleRef.current;
    try {
      const T = await import('tone');
      toneModuleRef.current = T;
      return T;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    return () => {
      if (audioBlobUrlRef.current) {
        URL.revokeObjectURL(audioBlobUrlRef.current);
        audioBlobUrlRef.current = null;
      }
    };
  }, []);

  // 1) defaults: today / now / geolocation
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
          setGeo({ status: 'ok', lat: latitude, lon: longitude });
          // keep label short for UI; server will get precise coords
          setLocationStr((prev) => prev || 'Current Location');
        },
        () => {
          setGeo({ status: 'denied', lat: null, lon: null });
          setLocationStr((prev) => prev || 'Buenos Aires, Argentina');
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setGeo({ status: 'error', lat: null, lon: null });
      setLocationStr((prev) => prev || 'Buenos Aires, Argentina');
    }
  }, []);

  // 2) compose: send coords when available
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setIsLoading(true);
      try {
        const body: any = { date: dateStr, time: timeStr, location: locationStr };
        if (geo.status === 'ok') body.geo = { lat: geo.lat, lon: geo.lon };

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
          setChartData(surface);
          setComposeHash(payload?.controls?.hash ?? payload?.hash ?? '');
          // If compose response has no positions/cusps, fetch chart from /api/chart for wheel
          const hasChart = surface?.positions && Object.keys(surface.positions).length > 0 && Array.isArray(surface?.cusps) && surface.cusps.length === 12;
          if (!cancelled && !hasChart && dateStr && timeStr) {
            const lat = geo.status === 'ok' ? geo.lat! : -34.6037;
            const lon = geo.status === 'ok' ? geo.lon! : -58.3816;
            try {
              const chartRes = await fetch(`/api/chart?date=${encodeURIComponent(dateStr)}&time=${encodeURIComponent(timeStr)}&lat=${lat}&lon=${lon}`);
              if (chartRes.ok) {
                const chartJson = await chartRes.json();
                if (chartJson?.positions && Array.isArray(chartJson?.cusps)) setChartData(chartJson);
              }
            } catch (_) {}
          }
          if (payload?.explanation?.text) setExplanationText(payload.explanation.text);
          else if (payload?.explanation?.sections?.length) {
            setExplanationText(payload.explanation.sections.map((s: { text?: string }) => s?.text ?? '').filter(Boolean).join('\n\n'));
          }
          // Prefer URL; when backend returns inline WAV (ENABLE_WAV_EXPORT=1), use base64 as blob URL
          if (payload?.audio?.url) {
            if (audioBlobUrlRef.current) {
              URL.revokeObjectURL(audioBlobUrlRef.current);
              audioBlobUrlRef.current = null;
            }
            setAudioUrl(payload.audio.url);
          } else if (payload?.audio?.base64 && typeof payload.audio.base64 === 'string' && payload.audio.base64.length > 0) {
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
          }

          // Update location label if we have coordinates but no human-readable label
          const surface = payload?.controlSurface ?? payload?.controls;
          if (geo.status === 'ok' && locationStr === 'Current Location' && surface?.location) {
            setLocationStr(surface.location);
          }
        }
      } catch (e) {
        console.error('[compose] failed', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    if (dateStr && timeStr && locationStr) bootstrap();
    return () => {
      cancelled = true;
    };
  }, [dateStr, timeStr, locationStr, geo]);

  // 2b) reverse-geocode label when we have coords but only the placeholder label
  useEffect(() => {
    let cancelled = false;
    async function resolveLabel() {
      if (geo.status === 'ok' && locationStr === 'Current Location') {
        try {
          const base = getApiBaseUrl();
          const r = await fetch(`${base || ''}/api/ip-geo`);
          const j = await r.json();
          if (!cancelled && j && j.city) {
            setLocationStr(j.city);
          }
        } catch {}
      }
    }
    resolveLabel();
    return () => { cancelled = true; };
  }, [geo, locationStr]);

  // Audio playback using compose response
  useEffect(() => {
    let audioElement: HTMLAudioElement | null = null;
    
    async function handlePlay() {
      try {
        const audioStartTime = performance.now();
        // Audio Path Priority: URL first (Beta), then plan fallback
        if (audioUrl) {
          // Primary: HTML5 audio for URL-based playback
          audioElement = new Audio(audioUrl);
          audioElement.play().then(() => {
            const startupTime = performance.now() - audioStartTime;
            setAudioStartupTime(startupTime);
            console.log(`[telemetry] audio_startup_ms: ${startupTime.toFixed(2)}`);
          }).catch(e => {
            console.warn('[audio] URL playback failed, falling back to plan:', e);
            startPlanFallback();
          });
        } else {
          // Fallback: Tone.js plan-based synthesis (module import)
          await startPlanFallback();
        }
      } catch (e) {
        console.warn('[audio] play failed', e);
      }
    }

    async function startPlanFallback() {
      try {
        const Tone = await getTone();
        if (!Tone) return;
        if (typeof Tone.start === 'function') await Tone.start();
        const synth = new Tone.MembraneSynth().toDestination();
        let i = 0;
        const seq = new Tone.Loop((time: number) => {
          const n = (i++ % 8);
          const pitch = 48 + (n * 2);
          synth.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toFrequency(), '8n', time, 0.6);
        }, '8n');
        seq.start(0);
        toneSeqRef.current = seq;
        Tone.Transport.start();
      } catch (e) {
        console.warn('[audio] Tone fallback failed', e);
      }
    }

    function handleStop() {
      try {
        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement = null;
        } else {
          if (toneSeqRef.current) {
            toneSeqRef.current.stop();
            toneSeqRef.current.dispose?.();
            toneSeqRef.current = null;
          }
          const Tone = toneModuleRef.current;
          if (Tone?.Transport) Tone.Transport.stop();
        }
      } catch (e) {
        console.warn('[audio] stop failed', e);
      }
    }
    
    window.addEventListener('astradio:play', handlePlay as any);
    window.addEventListener('astradio:stop', handleStop as any);
    return () => {
      window.removeEventListener('astradio:play', handlePlay as any);
      window.removeEventListener('astradio:stop', handleStop as any);
      handleStop();
    };
  }, [audioUrl, composeHash]);

  const disabled = isLoading || !chartData;

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
              <ExplanationPanel composeHash={composeHash} text={explanationText} isLoading={isLoading} />
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
              <LocationInput
                value={locationStr}
                onChange={setLocationStr}
                disabled={isLoading}
              />
            </div>

            {/* Transport with audio gesture gating */}
            <div className="mt-4 flex items-center gap-3">
              {!audioEnabled ? (
                <button
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50"
                  disabled={disabled}
                  onClick={async () => {
                    try {
                      const Tone = await getTone();
                      if (Tone && typeof Tone.start === 'function') {
                        await Tone.start();
                        setAudioEnabled(true);
                      }
                    } catch (e) {
                      console.warn('Audio not supported:', e);
                    }
                  }}
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
                </>
              )}
            </div>

            {/* Engine status and debug info */}
            <div className="mt-2 space-y-1">
              {engineError && (
                <p className="text-xs text-red-400">
                  ⚠️ {engineError}
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
                Geolocation: {geo.status}
                {geo.status === 'ok' ? ` (${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)})` : ''}
              </p>
            </div>
          </section>
        </div>

        <div className="h-16" />
      </main>
    </div>
  );
}