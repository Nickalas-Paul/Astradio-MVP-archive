/**
 * One MediaElementSource per HTMLAudioElement (calling createMediaElementSource twice throws).
 * Harmonic Landscape reads FFT in useFrame; store only holds the AnalyserNode ref.
 */

export type MediaElementAnalyserBundle = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
};

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createMediaElementAnalyser(
  audio: HTMLAudioElement,
): MediaElementAnalyserBundle | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;

  try {
    const context = new Ctor();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(context.destination);
    return { context, analyser, source };
  } catch {
    return null;
  }
}

/** Must run inside a user-gesture handler (play tap, Open Aura). */
export async function resumeAudioContext(context: AudioContext | null | undefined): Promise<void> {
  if (!context) return;
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      // Ignore — Harmonic falls back to breathing sine.
    }
  }
}

/** Bass-weighted energy from bins 0–40, normalized 0–1. */
export function readBassWeightedLevel(
  analyser: AnalyserNode,
  dataArray: Uint8Array,
): number {
  analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
  const bins = Math.min(40, dataArray.length);
  if (bins <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < bins; i += 1) {
    sum += dataArray[i] ?? 0;
  }
  return sum / (bins * 255);
}

export function breathingAudioLevel(elapsed: number): number {
  return 0.5 + Math.sin(elapsed * 0.5) * 0.2;
}
