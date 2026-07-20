'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuraRawSnapshot } from '@/components/wheel/aura-raw-snapshot';
import { useAudioPlayerStore } from '@/store/audio-player';

const HarmonicLandscape = dynamic(
  () =>
    import('@/components/wheel/HarmonicLandscape').then((m) => ({
      default: m.HarmonicLandscape,
    })),
  { ssr: false, loading: () => null },
);

// Generated locally with the repository's Swiss Ephemeris dependency.
const REAL_REVIEW_SNAPSHOT: AuraRawSnapshot = {
  planets: [
    { name: 'sun', lon: 54.65724758043515, speed: 0.9641222282299476 },
    { name: 'moon', lon: 300.5166093935011, speed: 12.419735411510393 },
    { name: 'mercury', lon: 37.98263645859447, speed: -0.09993458776498282 },
    { name: 'venus', lon: 13.127299853557533, speed: 1.141077109153493 },
    { name: 'mars', lon: 348.5349915779097, speed: 0.7426060024289377 },
    { name: 'jupiter', lon: 99.59297750308315, speed: 0.18952826330771305 },
    { name: 'saturn', lon: 295.24480834327613, speed: -0.01733170909884377 },
    { name: 'uranus', lon: 279.17723181236465, speed: -0.024765033560235374 },
    { name: 'neptune', lon: 284.34890170190573, speed: -0.014847089011398302 },
    { name: 'pluto', lon: 226.15993711021764, speed: -0.02770001379263403 },
  ],
  aspects: [
    { bodies: ['sun', 'moon'], type: 'trine', orb: 5.86, strength: 0.02 },
    { bodies: ['sun', 'saturn'], type: 'trine', orb: 0.59, strength: 0.9 },
    { bodies: ['moon', 'saturn'], type: 'conjunction', orb: 5.27, strength: 0.34 },
    { bodies: ['mercury', 'jupiter'], type: 'sextile', orb: 1.61, strength: 0.6 },
    { bodies: ['mercury', 'uranus'], type: 'trine', orb: 1.19, strength: 0.8 },
    { bodies: ['venus', 'jupiter'], type: 'square', orb: 3.53, strength: 0.41 },
    { bodies: ['venus', 'uranus'], type: 'square', orb: 3.95, strength: 0.34 },
    { bodies: ['venus', 'neptune'], type: 'square', orb: 1.22, strength: 0.8 },
    { bodies: ['mars', 'pluto'], type: 'trine', orb: 2.38, strength: 0.6 },
    { bodies: ['jupiter', 'uranus'], type: 'opposition', orb: 0.42, strength: 0.95 },
    { bodies: ['jupiter', 'neptune'], type: 'opposition', orb: 4.76, strength: 0.41 },
    { bodies: ['uranus', 'neptune'], type: 'conjunction', orb: 5.17, strength: 0.35 },
    { bodies: ['neptune', 'pluto'], type: 'sextile', orb: 1.81, strength: 0.55 },
  ],
  moonPhase: 0.6829,
  dominantElements: { fire: 0.3, earth: 0.2, air: 0.2, water: 0.3 },
};

type DemoHandles = {
  context: AudioContext;
  osc: OscillatorNode;
  lfo: OscillatorNode;
  analyser: AnalyserNode;
};

export default function HarmonicLandscapeDevPage() {
  const [selected, setSelected] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const demoRef = useRef<DemoHandles | null>(null);

  const stopDemo = useCallback(() => {
    const demo = demoRef.current;
    demoRef.current = null;
    if (demo) {
      try {
        demo.osc.stop();
        demo.lfo.stop();
        demo.osc.disconnect();
        demo.lfo.disconnect();
        demo.analyser.disconnect();
        void demo.context.close();
      } catch {
        // ignore
      }
    }
    useAudioPlayerStore.getState()._setAnalyserNode(null);
    useAudioPlayerStore.getState()._setIsPlaying(false);
    setDemoActive(false);
  }, []);

  const startDemo = useCallback(async () => {
    stopDemo();
    try {
      const Ctor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const context = new Ctor();
      await context.resume();

      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const osc = context.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;

      const lfo = context.createOscillator();
      lfo.frequency.value = 1.4;
      const lfoGain = context.createGain();
      lfoGain.gain.value = 0.35;

      const voiceGain = context.createGain();
      voiceGain.gain.value = 0.25;

      lfo.connect(lfoGain);
      lfoGain.connect(voiceGain.gain);
      osc.connect(voiceGain);
      voiceGain.connect(analyser);
      // Keep demo quiet but still feed destination so routing matches production.
      const mute = context.createGain();
      mute.gain.value = 0.05;
      analyser.connect(mute);
      mute.connect(context.destination);

      osc.start();
      lfo.start();

      demoRef.current = { context, osc, lfo, analyser };
      useAudioPlayerStore.getState()._setAudioContext(context);
      useAudioPlayerStore.getState()._setAnalyserNode(analyser);
      useAudioPlayerStore.getState()._setIsPlaying(true);
      setDemoActive(true);
    } catch {
      stopDemo();
    }
  }, [stopDemo]);

  useEffect(() => () => stopDemo(), [stopDemo]);

  return (
    <main className="min-h-screen bg-[#0d0618] p-4 text-text-primary sm:p-8">
      <h1 className="text-2xl font-semibold text-[#e8c56d]">Aura — Harmonic Landscape review</h1>
      <p className="mt-2 text-sm text-white/50">
        Fixed Swiss Ephemeris snapshot: 1990-05-15 14:30, New York.
        {selected ? ' Planet selected.' : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="harmonic-demo-audio"
          onClick={() => {
            void (demoActive ? stopDemo() : startDemo());
          }}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-[#e8c56d] hover:bg-white/10"
        >
          {demoActive ? 'Stop demo audio' : 'Start demo audio'}
        </button>
      </div>
      <div className="relative mt-6 h-[60vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0618] shadow-xl sm:h-[min(80vh,40rem)]">
        <HarmonicLandscape
          snapshot={REAL_REVIEW_SNAPSHOT}
          composeControls={{
            arcShape: 0.5,
            densityLevel: 0.6,
            tempoNorm: 0.5,
            aspectTension: 0.5,
            elementDominance: 'earth',
            modality: 'fixed',
          }}
          active
          onSelectionChange={setSelected}
        />
      </div>
    </main>
  );
}
