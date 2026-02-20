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
  const [exportId, setExportId] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [explanationSections, setExplanationSections] = useState<Array<{ title: string; text?: string; bullets?: string[] }> | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [composePlan, setComposePlan] = useState<any>(null); // Backend plan for browser engine / Tone fallback
  const [composeGenre, setComposeGenre] = useState<string>('house'); // payload.controls.genre, default house
  const [specVersion, setSpecVersion] = useState<string | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [composeLatency, setComposeLatency] = useState<number | null>(null);
  const [audioStartupTime, setAudioStartupTime] = useState<number | null>(null);

  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('');
  const [locationStr, setLocationStr] = useState<string>('');
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [geo, setGeo] = useState<GeoState>({ status: 'idle', lat: null, lon: null });

  function formatCoords(lat: number, lon: number) {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [engineChosen, setEngineChosen] = useState<'browser' | 'server' | 'legacy' | null>(null);
  const [engineStats, setEngineStats] = useState<{
    samplesLoaded: { drums: boolean; bass: boolean; harmony: boolean; melody: boolean };
    voiceMode: { bass: string; harmony: string; melody: string };
    soundfontLoaded?: { bass: boolean; harmony: boolean; melody: boolean };
    reverbSends?: { bass: number; harmony: number; melody: number; clap: number };
    sampleLoadErrors?: string[];
    sampleUrlsLoaded?: string[];
  } | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const audioBlobUrlRef = useRef<string | null>(null);
  const toneSeqRef = useRef<any>(null);
  const toneModuleRef = useRef<typeof import('tone') | null>(null);
  const browserEngineRef = useRef<{ stop: () => void; getStats?: () => unknown } | null>(null);

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

  useEffect(() => {
    const dev = process.env.NODE_ENV === 'development';
    const fromUrl =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('debug') === '1';
    setShowDebugPanel(dev || fromUrl);
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
          setLocationStr((prev) => prev || 'Current Location');
          setLocationLabel((prev) => prev || 'Current Location');
        },
        () => {
          setGeo({ status: 'denied', lat: null, lon: null });
          const fallback = 'Buenos Aires, Argentina';
          setLocationStr((prev) => prev || fallback);
          setLocationLabel((prev) => prev || fallback);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setGeo({ status: 'error', lat: null, lon: null });
      const fallback = 'Buenos Aires, Argentina';
      setLocationStr((prev) => prev || fallback);
      setLocationLabel((prev) => prev || fallback);
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
          setExportId(payload?.export_id ?? null);
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

          // Store backend plan and genre (for browser performance engine / Tone fallback)
          if (payload?.plan && typeof payload.plan === 'object') {
            setComposePlan(payload.plan);
          } else {
            setComposePlan(null);
          }
          setComposeGenre(payload?.controls?.genre ?? 'house');

          // Location display is handled by locationLabel + reverse-geocode effect; compose always uses geo lat/lon
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

  // 2b) reverse-geocode label when geo coords are available (display only; compose uses lat/lon)
  useEffect(() => {
    let cancelled = false;
    async function resolveLabel() {
      if (geo.status !== 'ok' || geo.lat == null || geo.lon == null) return;
      const lat = geo.lat;
      const lon = geo.lon;
      try {
        const base = getApiBaseUrl();
        const r = await fetch(`${base || ''}/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
        const j = await r.json();
        if (cancelled) return;
        const label = j?.label ?? formatCoords(lat, lon);
        const parts = [j?.city, j?.region, j?.country].filter(Boolean);
        const displayLabel = parts.length > 0 ? parts.join(', ') : label;
        setLocationLabel(displayLabel);
        setLocationStr(displayLabel);
      } catch {
        if (!cancelled) {
          const fallback = formatCoords(lat, lon);
          setLocationLabel(fallback);
          setLocationStr(fallback);
        }
      }
    }
    resolveLabel();
    return () => { cancelled = true; };
  }, [geo.status, geo.lat, geo.lon]);

  // Audio playback: ?engine=browser|server|legacy is a preference (default: browser), not a hard lock.
  // Resolution: try requested engine first, then fallback in canonical order browser → server WAV → legacy.
  useEffect(() => {
    let audioElement: HTMLAudioElement | null = null;

    function getEnginePreference(): 'browser' | 'server' | 'legacy' {
      if (typeof window === 'undefined') return 'browser';
      const p = new URLSearchParams(window.location.search).get('engine');
      if (p === 'server' || p === 'legacy') return p;
      return 'browser';
    }

    async function tryBrowser(): Promise<boolean> {
      const hasPlan = composePlan?.events?.length > 0 && composeHash;
      if (!hasPlan) return false;
      const urlDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
      const debug = urlDebug || process.env.NODE_ENV === 'development';
      const { createBrowserPerformanceEngine } = await import('../src/core/audio/browser-performance-engine');
      const handle = await createBrowserPerformanceEngine({
        plan: composePlan,
        seed: composeHash,
        genre: composeGenre ?? 'house',
        debug,
      });
      browserEngineRef.current = handle;
      if (debug && handle.getStats) {
        const s = handle.getStats() as any;
        setEngineStats({
          samplesLoaded: s.samplesLoaded ?? { drums: false, bass: false, harmony: false, melody: false },
          voiceMode: s.voiceMode ?? { bass: 'synth', harmony: 'synth', melody: 'synth' },
          soundfontLoaded: s.soundfontLoaded,
          reverbSends: s.reverbSends,
          ...(s.sampleLoadErrors && { sampleLoadErrors: s.sampleLoadErrors }),
          ...(s.sampleUrlsLoaded && { sampleUrlsLoaded: s.sampleUrlsLoaded }),
        });
      }
      await handle.start();
      return true;
    }

    async function tryServerWav(): Promise<boolean> {
      if (!audioUrl) return false;
      return new Promise((resolve) => {
        audioElement = new Audio(audioUrl);
        audioElement!.play().then(() => resolve(true)).catch(() => resolve(false));
      });
    }

    async function handlePlay() {
      const audioStartTime = performance.now();
      setEngineChosen(null);
      const preference = getEnginePreference();
      try {
        const tryOrder: Array<'browser' | 'server' | 'legacy'> =
          preference === 'server' ? ['server', 'browser', 'legacy'] :
          preference === 'legacy' ? ['legacy', 'browser', 'server'] :
          ['browser', 'server', 'legacy'];

        for (const engine of tryOrder) {
          if (engine === 'browser') {
            try {
              const ok = await tryBrowser();
              if (ok) {
                setEngineChosen('browser');
                setAudioStartupTime(performance.now() - audioStartTime);
                console.log('[audio] Browser Performance Engine started');
                return;
              }
            } catch (e) {
              console.warn('[audio] Browser engine failed:', e);
              browserEngineRef.current = null;
            }
          } else if (engine === 'server') {
            const ok = await tryServerWav();
            if (ok) {
              setEngineChosen('server');
              setAudioStartupTime(performance.now() - audioStartTime);
              console.log('[audio] Server WAV playback');
              return;
            }
            if (audioElement) {
              audioElement.pause();
              audioElement = null;
            }
          } else {
            await startPlanFallback();
            setEngineChosen('legacy');
            setAudioStartupTime(performance.now() - audioStartTime);
            console.log('[audio] Legacy Tone fallback');
            return;
          }
        }
      } catch (e) {
        console.warn('[audio] play failed', e);
      }
    }

    async function startPlanFallback() {
      try {
        const Tone = await getTone();
        if (!Tone) {
          console.warn('[audio] Tone.js unavailable');
          return;
        }
        if (!composePlan?.events?.length) {
          console.warn('[audio] No backend plan available for playback');
          return;
        }
        if (typeof Tone.start === 'function') await Tone.start();
        const { planToToneEvents } = await import('../src/core/plan-to-tone-events');
        const toneEvents = planToToneEvents(composePlan);
        const synths: Record<string, any> = {};
        const channels = new Set(toneEvents.map((e: any) => e.channel));
        for (const ch of channels) {
          synths[ch] = new Tone.MembraneSynth().toDestination();
        }
        for (const ev of toneEvents) {
          const synth = synths[ev.channel] || synths['melody'];
          const freq = Tone.Frequency(ev.note).toFrequency();
          synth.triggerAttackRelease(freq, ev.duration, ev.time, ev.velocity);
        }
        Tone.Transport.start();
        Tone.Transport.scheduleOnce(() => Tone.Transport.stop(), composePlan.durationSec ?? 30);
        console.log('[audio] Legacy Tone fallback scheduled');
      } catch (e) {
        console.warn('[audio] Tone fallback failed', e);
      }
    }

    function handleStop() {
      try {
        if (browserEngineRef.current) {
          browserEngineRef.current.stop();
          browserEngineRef.current = null;
        }
        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement = null;
        }
        if (toneSeqRef.current) {
          toneSeqRef.current.stop();
          toneSeqRef.current.dispose?.();
          toneSeqRef.current = null;
        }
        const Tone = toneModuleRef.current;
        if (Tone?.Transport) Tone.Transport.stop();
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
  }, [audioUrl, composePlan, composeHash, composeGenre]);

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
              <LocationInput
                value={locationLabel || locationStr}
                onChange={(value) => {
                  setLocationStr(value);
                  setLocationLabel(value);
                }}
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
              {engineError && (
                <p className="text-xs text-red-400">
                  ⚠️ {engineError}
                </p>
              )}
              {showDebugPanel && (
                <>
                  {engineChosen && (
                    <p className="text-xs text-amber-400/90 font-mono">
                      Engine: {engineChosen} (preference; fallback: browser → server → legacy)
                    </p>
                  )}
                  {engineStats && (
                    <>
                      <p className="text-xs text-amber-400/90 font-mono">
                        Voices: {engineStats.voiceMode.bass} / {engineStats.voiceMode.harmony} / {engineStats.voiceMode.melody}
                      </p>
                      <p className="text-xs text-amber-400/90 font-mono">
                        Samples: bass {engineStats.samplesLoaded.bass ? 'yes' : 'no'} / harmony {engineStats.samplesLoaded.harmony ? 'yes' : 'no'} / melody {engineStats.samplesLoaded.melody ? 'yes' : 'no'}
                      </p>
                      {engineStats.sampleUrlsLoaded && engineStats.sampleUrlsLoaded.length > 0 && (
                        <p className="text-xs text-amber-400/90 font-mono truncate" title={engineStats.sampleUrlsLoaded.join(', ')}>
                          Loaded: {engineStats.sampleUrlsLoaded.slice(0, 3).join(', ')}{engineStats.sampleUrlsLoaded.length > 3 ? '…' : ''}
                        </p>
                      )}
                      {engineStats.sampleLoadErrors && engineStats.sampleLoadErrors.length > 0 && (
                        <p className="text-xs text-red-400 font-mono" title={engineStats.sampleLoadErrors.join(', ')}>
                          Sample errors: {engineStats.sampleLoadErrors.join('; ')}
                        </p>
                      )}
                      {engineStats.reverbSends && (
                        <p className="text-xs text-amber-400/90 font-mono">
                          Reverb: bass {engineStats.reverbSends.bass} · harm {engineStats.reverbSends.harmony} · mel {engineStats.reverbSends.melody} · clap {engineStats.reverbSends.clap}
                        </p>
                      )}
                    </>
                  )}
                </>
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