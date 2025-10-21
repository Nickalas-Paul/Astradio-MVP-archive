'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

// use relative imports to avoid alias issues
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
        const res = await fetch('/api/compose', {
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
          setChartData(payload?.controlSurface ?? null);
          setComposeHash(payload?.hash ?? '');
          if (payload?.explanation?.text) setExplanationText(payload.explanation.text);
          if (payload?.audio?.url) setAudioUrl(payload.audio.url);
          
          // Update location label if we have coordinates but no human-readable label
          if (geo.status === 'ok' && locationStr === 'Current Location' && payload?.controlSurface?.location) {
            setLocationStr(payload.controlSurface.location);
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
          const r = await fetch(`/api/ip-geo`);
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
    
    function handlePlay() {
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
            // Fallback to plan if URL fails
            startPlanFallback();
          });
        } else {
          // Fallback: Tone.js plan-based synthesis
          startPlanFallback();
        }
      } catch (e) {
        console.warn('[audio] play failed', e);
      }
    }
    
    function startPlanFallback() {
      const g: any = typeof window !== 'undefined' ? (window as any) : {};
      if (!g.Tone) return;
      const Tone = g.Tone;
      if (typeof Tone.start === 'function') Tone.start();
      const seed = composeHash || 'seed';
      const synth = new Tone.MembraneSynth().toDestination();
      let i = 0;
      const seq = new Tone.Loop((time: any) => {
        const n = (i++ % 8);
        const pitch = 48 + (n * 2);
        synth.triggerAttackRelease(Tone.Frequency(pitch, 'midi'), '8n', time, 0.6);
      }, '8n');
      seq.start(0);
      g.__astradio_seq = seq;
      Tone.Transport.start();
    }
    
    function handleStop() {
      try {
        if (audioElement) {
          audioElement.pause();
          audioElement.currentTime = 0;
          audioElement = null;
        } else {
          // Stop Tone.js fallback
          const g: any = typeof window !== 'undefined' ? (window as any) : {};
          const Tone = g.Tone;
          if (g.__astradio_seq) { 
            g.__astradio_seq.stop(); 
            g.__astradio_seq.dispose?.(); 
            g.__astradio_seq = null; 
          }
          Tone?.Transport?.stop();
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
                  onClick={() => {
                    // Enable audio context on first user gesture
                    try {
                      if (typeof window !== 'undefined' && 'AudioContext' in window) {
                        // Use Tone.js if available to satisfy autoplay policy
                        const g: any = window as any;
                        if (g.Tone && typeof g.Tone.start === 'function') {
                          g.Tone.start();
                        } else {
                          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                          audioContext.resume();
                        }
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