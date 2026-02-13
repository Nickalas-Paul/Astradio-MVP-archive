/**
 * Browser Performance Engine (House default).
 * Sample-first instrumentation with improved voicing. Consumes Plan + payload.hash + payload.genre,
 * plays via Tone.js with genre pack (samples + synths). Deterministic event scheduling and param
 * choice from seed; audio output may vary slightly across devices. Export remains server-authoritative.
 */

import type { Plan, EventToken } from '../plan-to-tone-events';
import type { Player, MonoSynth, PolySynth, Filter, WaveShaper } from 'tone';
import { getGenrePack } from '../genre';

const PITCH_KICK = 36;
const PITCH_CLAP = 38;
const PITCH_HAT = 42;

export interface BrowserEngineOptions {
  plan: Plan;
  seed: string;
  genre?: string;
  debug?: boolean; // Enable verification logging
}

export interface BrowserEngineHandle {
  start: () => Promise<void>;
  stop: () => void;
}

export interface EngineStats {
  samplesLoaded: { drums: boolean; bass: boolean; harmony: boolean; melody: boolean };
  synthFallbacks: { bass: boolean; harmony: boolean; melody: boolean };
}

/** MIDI pitch to note name (C4, D#5, etc.) */
function midiToNote(pitch: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = Math.round(pitch) % 12;
  return `${notes[noteIndex]}${octave}`;
}

/**
 * Create and run the browser performance engine. Uses Tone.js; call start() after user gesture.
 * Returns handle with start/stop. Stop disposes nodes to avoid leaks.
 */
export async function createBrowserPerformanceEngine(
  options: BrowserEngineOptions
): Promise<BrowserEngineHandle> {
  const { plan, seed, genre = 'house', debug = false } = options;
  const Tone = await import('tone');
  const pack = getGenrePack(genre, seed);
  const gainToDb = (Tone as any).gainToDb ?? ((g: number) => (g <= 0 ? -100 : Math.max(-60, 20 * Math.log10(g))));

  const durationSec = plan.durationSec ?? 60;
  const events = plan.events ?? [];
  const kickOnsets: number[] = [];
  for (const ev of events) {
    if (ev.channel === 'rhythm' && ev.pitch === PITCH_KICK) kickOnsets.push(ev.t0);
  }

  const stats: EngineStats = {
    samplesLoaded: { drums: false, bass: false, harmony: false, melody: false },
    synthFallbacks: { bass: true, harmony: true, melody: true },
  };

  // --- Drum samples (always try to load) ---
  const drumUrls: Record<string, string> = {
    kick: pack.drumKit.kick,
    clap: pack.drumKit.clap,
    closedHat: pack.drumKit.closedHat,
    openHat: pack.drumKit.openHat,
  };

  const drumPlayers: Record<string, Player> = {};
  let drumsOk = false;
  try {
    for (const [key, url] of Object.entries(drumUrls)) {
      if (!url) continue;
      const p = new Tone.Player({ url, fadeOut: 0.02 });
      await new Promise<void>((resolve, reject) => {
        p.load(url).then(() => resolve()).catch(reject);
      });
      drumPlayers[key] = p;
    }
    drumsOk = Object.keys(drumPlayers).length > 0;
    stats.samplesLoaded.drums = drumsOk;
  } catch (e) {
    if (debug) console.warn('[BrowserEngine] Drum samples failed to load:', e);
    Object.values(drumPlayers).forEach((p) => p.dispose());
  }

  // --- Instrument samples (bass/harmony/melody) - sample-first ---
  const instrumentSamples = pack.instrumentSamples ?? {};
  let bassPlayer: Player | null = null;
  let harmonyPlayer: Player | null = null;
  let melodyPlayer: Player | null = null;

  let bassSampleOk = false;
  let harmonySampleOk = false;
  let melodySampleOk = false;

  if (instrumentSamples.bass) {
    try {
      const p = new Tone.Player({ url: instrumentSamples.bass, fadeOut: 0.01 });
      await p.load(instrumentSamples.bass);
      bassPlayer = p;
      bassSampleOk = true;
      stats.samplesLoaded.bass = true;
      stats.synthFallbacks.bass = false;
    } catch (e) {
      if (debug) console.warn('[BrowserEngine] Bass sample failed:', e);
    }
  }

  if (instrumentSamples.harmony) {
    try {
      const p = new Tone.Player({ url: instrumentSamples.harmony, fadeOut: 0.01 });
      await p.load(instrumentSamples.harmony);
      harmonyPlayer = p;
      harmonySampleOk = true;
      stats.samplesLoaded.harmony = true;
      stats.synthFallbacks.harmony = false;
    } catch (e) {
      if (debug) console.warn('[BrowserEngine] Harmony sample failed:', e);
    }
  }

  if (instrumentSamples.melody) {
    try {
      const p = new Tone.Player({ url: instrumentSamples.melody, fadeOut: 0.01 });
      await p.load(instrumentSamples.melody);
      melodyPlayer = p;
      melodySampleOk = true;
      stats.samplesLoaded.melody = true;
      stats.synthFallbacks.melody = false;
    } catch (e) {
      if (debug) console.warn('[BrowserEngine] Melody sample failed:', e);
    }
  }

  // --- Gain stages ---
  const bassGain = new Tone.Gain(pack.mixProfile.bassGain);
  const harmonyGain = new Tone.Gain(pack.mixProfile.harmonyGain);
  const melodyGain = new Tone.Gain(pack.mixProfile.melodyGain);

  // --- Bass: improved voicing (darker, mono, no reverb, saturation) ---
  let bassSynth: MonoSynth | null = null;
  let bassHpf: Filter | null = null;
  let bassLpf: Filter | null = null;
  let bassSat: WaveShaper | null = null;

  if (bassSampleOk && bassPlayer) {
    bassHpf = new Tone.Filter({ type: 'highpass', frequency: pack.synthPatches.bass.highpassHz ?? 40, Q: 0.7 });
    bassLpf = new Tone.Filter({ type: 'lowpass', frequency: pack.synthPatches.bass.filterCutoffHz[1], Q: 0.7 });
    bassPlayer.connect(bassHpf);
    bassHpf.connect(bassLpf);
    bassLpf.connect(bassGain);
  } else {
    const [bassLpfLo, bassLpfHi] = pack.synthPatches.bass.filterCutoffHz;
    const [bassDecayLo, bassDecayHi] = pack.synthPatches.bass.decaySec;
    bassHpf = new Tone.Filter({ type: 'highpass', frequency: pack.synthPatches.bass.highpassHz ?? 40, Q: 0.7 });
    bassLpf = new Tone.Filter({ type: 'lowpass', frequency: bassLpfHi, Q: 0.7 });
    bassSat = new Tone.WaveShaper((x: number) => {
      const t = x * (1 + (pack.synthPatches.bass.saturation ?? 0.03));
      return Math.tanh(t);
    }, 4096);
    bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: {
        attack: 0.01,
        decay: (bassDecayLo + bassDecayHi) / 2,
        sustain: 0.7,
        release: 0.2,
      },
    });
    bassSynth.connect(bassHpf);
    bassHpf.connect(bassLpf);
    bassLpf.connect(bassSat);
    bassSat.connect(bassGain);
  }
  // Bass is mono (no stereo processing) and goes direct to destination (no reverb)
  bassGain.connect(Tone.getDestination());

  // --- Harmony: improved voicing (warmer stab, plate reverb) ---
  let harmonySynth: PolySynth | null = null;
  let harmonyFilter: Filter | null = null;

  if (harmonySampleOk && harmonyPlayer) {
    const [harmLpfLo, harmLpfHi] = pack.synthPatches.harmony.filterCutoffHz;
    harmonyFilter = new Tone.Filter({ type: 'lowpass', frequency: harmLpfHi, Q: 0.7 });
    harmonyPlayer.connect(harmonyFilter);
    harmonyFilter.connect(harmonyGain);
  } else {
    const [harmLpfLo, harmLpfHi] = pack.synthPatches.harmony.filterCutoffHz;
    harmonyFilter = new Tone.Filter({ type: 'lowpass', frequency: harmLpfHi, Q: 0.7 });
    harmonySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: (pack.synthPatches.harmony.decaySec[0] + pack.synthPatches.harmony.decaySec[1]) / 2, sustain: 0.8, release: 0.25 },
    });
    harmonySynth.connect(harmonyFilter);
    harmonyFilter.connect(harmonyGain);
  }

  // --- Melody: improved voicing (clearer pluck, HPF to remove fizz, plate reverb) ---
  let melodySynth: PolySynth | null = null;
  let melodyHpf: Filter | null = null;
  let melodyFilter: Filter | null = null;

  if (melodySampleOk && melodyPlayer) {
    const [melLpfLo, melLpfHi] = pack.synthPatches.melody.filterCutoffHz;
    melodyHpf = new Tone.Filter({ type: 'highpass', frequency: pack.synthPatches.melody.highpassHz ?? 200, Q: 0.7 });
    melodyFilter = new Tone.Filter({ type: 'lowpass', frequency: melLpfHi, Q: 0.7 });
    melodyPlayer.connect(melodyHpf);
    melodyHpf.connect(melodyFilter);
    melodyFilter.connect(melodyGain);
  } else {
    const [melLpfLo, melLpfHi] = pack.synthPatches.melody.filterCutoffHz;
    const [melPluckLo, melPluckHi] = pack.synthPatches.melody.pluckDecayMs;
    melodyHpf = new Tone.Filter({ type: 'highpass', frequency: pack.synthPatches.melody.highpassHz ?? 200, Q: 0.7 });
    melodyFilter = new Tone.Filter({ type: 'lowpass', frequency: melLpfHi, Q: 0.7 });
    melodySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: (melPluckLo + melPluckHi) / 2000, sustain: 0.6, release: 0.15 },
    });
    melodySynth.connect(melodyHpf);
    melodyHpf.connect(melodyFilter);
    melodyFilter.connect(melodyGain);
  }

  // --- Sidechain: duck bass and harmony on kick ---
  const duckAttack = 0.003;
  const duckHold = 0.02;
  const duckRelease = 0.04;
  for (const t of kickOnsets) {
    Tone.getTransport().schedule((time) => {
      bassGain.gain.linearRampToValueAtTime(1 - pack.mixProfile.sidechainDuckBass, time + duckAttack);
      bassGain.gain.linearRampToValueAtTime(1 - pack.mixProfile.sidechainDuckBass, time + duckAttack + duckHold);
      bassGain.gain.linearRampToValueAtTime(1, time + duckAttack + duckHold + duckRelease);
      harmonyGain.gain.linearRampToValueAtTime(1 - pack.mixProfile.sidechainDuckHarmony, time + duckAttack);
      harmonyGain.gain.linearRampToValueAtTime(1 - pack.mixProfile.sidechainDuckHarmony, time + duckAttack + duckHold);
      harmonyGain.gain.linearRampToValueAtTime(1, time + duckAttack + duckHold + duckRelease);
    }, t);
  }

  // --- FX: plate reverb + delay (NO reverb on bass) ---
  const reverb = new Tone.Reverb({ decay: 1.5, wet: pack.fxProfile.plateWet }); // Shorter decay for clarity
  const delay = new Tone.FeedbackDelay({
    delayTime: pack.fxProfile.delayTimeMs / 1000,
    feedback: 0.3, // Reduced feedback
    wet: pack.fxProfile.delayWet,
  });
  reverb.connect(Tone.getDestination());
  delay.connect(Tone.getDestination());
  // Only harmony and melody get reverb/delay; bass is dry
  harmonyGain.connect(reverb);
  harmonyGain.connect(delay);
  melodyGain.connect(reverb);
  melodyGain.connect(delay);

  // Harmony and melody also go direct (dry + wet)
  harmonyGain.connect(Tone.getDestination());
  melodyGain.connect(Tone.getDestination());

  // --- Verification logging (if debug enabled) ---
  if (debug) {
    console.log('[BrowserEngine] Stats:', {
      samplesLoaded: stats.samplesLoaded,
      synthFallbacks: stats.synthFallbacks,
      reverbWet: pack.fxProfile.plateWet,
      delayWet: pack.fxProfile.delayWet,
      sidechainKicks: kickOnsets.length,
    });
  }

  // --- Schedule events from plan ---
  const scheduleEvent = (ev: EventToken) => {
    const t0 = ev.t0;
    const t1 = ev.t1;
    const dur = Math.max(0.05, t1 - t0);
    const vel = Math.max(0, Math.min(1, ev.velocity ?? 0.8));
    const ch = ev.channel;
    const pitch = ev.pitch ?? 69;

    if (ch === 'rhythm') {
      if (drumsOk && drumPlayers.kick && drumPlayers.clap && drumPlayers.closedHat) {
        Tone.getTransport().schedule((time) => {
          const db = gainToDb(vel);
          if (pitch === PITCH_KICK) {
            drumPlayers.kick.volume.value = db;
            drumPlayers.kick.start(time);
          } else if (pitch === PITCH_CLAP) {
            drumPlayers.clap.volume.value = db;
            drumPlayers.clap.start(time);
          } else if (pitch === PITCH_HAT) {
            drumPlayers.closedHat.volume.value = db;
            drumPlayers.closedHat.start(time);
          }
        }, t0);
      } else {
        // Fallback: synth drums
        const drumSynth = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: pitch === PITCH_KICK ? 4 : 2,
        }).toDestination();
        const freq = Tone.Frequency(midiToNote(pitch)).toFrequency();
        drumSynth.triggerAttackRelease(freq, Math.min(dur, 0.3), t0, vel);
        Tone.getTransport().schedule(() => drumSynth.dispose(), t0 + dur + 0.5);
      }
      return;
    }

    const note = midiToNote(pitch);
    const freq = Tone.Frequency(note).toFrequency();

    if (ch === 'bass') {
      if (bassSampleOk && bassPlayer) {
        Tone.getTransport().schedule((time) => {
          bassPlayer!.volume.value = gainToDb(vel);
          bassPlayer!.start(time);
        }, t0);
      } else if (bassSynth) {
        bassSynth.triggerAttackRelease(freq, dur, t0, vel);
      }
    } else if (ch === 'harmony') {
      if (harmonySampleOk && harmonyPlayer) {
        Tone.getTransport().schedule((time) => {
          harmonyPlayer!.volume.value = gainToDb(vel);
          harmonyPlayer!.start(time);
        }, t0);
      } else if (harmonySynth) {
        harmonySynth.triggerAttackRelease(freq, dur, t0, vel);
      }
    } else if (ch === 'melody') {
      if (melodySampleOk && melodyPlayer) {
        Tone.getTransport().schedule((time) => {
          melodyPlayer!.volume.value = gainToDb(vel);
          melodyPlayer!.start(time);
        }, t0);
      } else if (melodySynth) {
        melodySynth.triggerAttackRelease(freq, dur, t0, vel);
      }
    }
  };

  for (const ev of events) scheduleEvent(ev);

  // --- Stop at end ---
  Tone.getTransport().scheduleOnce(() => {
    Tone.getTransport().stop();
  }, durationSec);

  return {
    async start() {
      if (typeof Tone.start === 'function') await Tone.start();
      Tone.getTransport().start();
      if (debug) console.log('[BrowserEngine] Started playback');
    },
    stop() {
      Tone.getTransport().stop();
      Tone.getTransport().cancel(0);
      if (bassSynth) bassSynth.dispose();
      if (harmonySynth) harmonySynth.dispose();
      if (melodySynth) melodySynth.dispose();
      if (bassPlayer) bassPlayer.dispose();
      if (harmonyPlayer) harmonyPlayer.dispose();
      if (melodyPlayer) melodyPlayer.dispose();
      if (bassHpf) bassHpf.dispose();
      if (bassLpf) bassLpf.dispose();
      if (bassSat) bassSat.dispose();
      if (harmonyFilter) harmonyFilter.dispose();
      if (melodyHpf) melodyHpf.dispose();
      if (melodyFilter) melodyFilter.dispose();
      bassGain.dispose();
      harmonyGain.dispose();
      melodyGain.dispose();
      reverb.dispose();
      delay.dispose();
      Object.values(drumPlayers).forEach((p) => p.dispose());
      if (debug) console.log('[BrowserEngine] Stopped and disposed');
    },
  };
}
