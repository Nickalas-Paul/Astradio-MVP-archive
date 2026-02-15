/**
 * Browser Performance Engine (House default).
 * Sample-first instrumentation with improved voicing. Consumes Plan + payload.hash + payload.genre,
 * plays via Tone.js with genre pack (samples + synths). Deterministic event scheduling and param
 * choice from seed; audio output may vary slightly across devices. Export remains server-authoritative.
 */

import type { Plan, EventToken } from '../plan-to-tone-events';
import { getGenrePack } from '../genre';

const PITCH_KICK = 36;
const PITCH_CLAP = 38;
const PITCH_HAT = 42;

/** Base notes for single-sample pitch-shifting when using Sampler. */
const BASS_BASE = 'C2';
const HARMONY_BASE = 'C4';
const MELODY_BASE = 'C4';

export interface BrowserEngineOptions {
  plan: Plan;
  seed: string;
  genre?: string;
  debug?: boolean;
}

export interface BrowserEngineHandle {
  start: () => Promise<void>;
  stop: () => void;
  /** Stats for debug panel. Populated after engine setup. */
  getStats?: () => EngineStats;
}

export interface EngineStats {
  samplesLoaded: { drums: boolean; bass: boolean; harmony: boolean; melody: boolean };
  synthFallbacks: { bass: boolean; harmony: boolean; melody: boolean };
  voiceMode: { bass: 'sample' | 'soundfont' | 'synth'; harmony: 'sample' | 'soundfont' | 'synth'; melody: 'sample' | 'soundfont' | 'synth' };
  soundfontLoaded?: { bass: boolean; harmony: boolean; melody: boolean };
  stemGains: { kick: number; bass: number; harmony: number; melody: number; hat: number; clap: number };
  reverbSends: { harmony: number; melody: number; clap: number; bass: number };
}

function midiToNote(pitch: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  const noteIndex = Math.round(pitch) % 12;
  return `${notes[noteIndex]}${octave}`;
}

function buildSamplerUrls(
  singleUrl: string | undefined,
  multiNotes: Record<string, string> | undefined
): Record<string, string> | null {
  if (multiNotes && Object.keys(multiNotes).length > 0) return multiNotes;
  if (singleUrl) return { [BASS_BASE]: singleUrl };
  return null;
}

function buildHarmonyUrls(
  singleUrl: string | undefined,
  multiNotes: Record<string, string> | undefined
): Record<string, string> | null {
  if (multiNotes && Object.keys(multiNotes).length > 0) return multiNotes;
  if (singleUrl) return { [HARMONY_BASE]: singleUrl };
  return null;
}

function buildMelodyUrls(
  singleUrl: string | undefined,
  multiNotes: Record<string, string> | undefined
): Record<string, string> | null {
  if (multiNotes && Object.keys(multiNotes).length > 0) return multiNotes;
  if (singleUrl) return { [MELODY_BASE]: singleUrl };
  return null;
}

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
    voiceMode: { bass: 'synth', harmony: 'synth', melody: 'synth' },
    soundfontLoaded: { bass: false, harmony: false, melody: false },
    stemGains: {
      kick: pack.mixProfile.kickGain,
      bass: pack.mixProfile.bassGain,
      harmony: pack.mixProfile.harmonyGain,
      melody: pack.mixProfile.melodyGain,
      hat: (pack.mixProfile as { hatGain?: number }).hatGain ?? 0.5,
      clap: (pack.mixProfile as { clapGain?: number }).clapGain ?? 0.55,
    },
    reverbSends: {
      harmony: pack.fxProfile.plateWet,
      melody: pack.fxProfile.plateWet,
      clap: pack.fxProfile.clapRoomWet,
      bass: 0,
    },
  };

  const instrumentSamples = pack.instrumentSamples ?? {};
  const bassUrls = buildSamplerUrls(instrumentSamples.bass, instrumentSamples.bassNotes);
  const harmonyUrls = buildHarmonyUrls(instrumentSamples.harmony, instrumentSamples.harmonyNotes);
  const melodyUrls = buildMelodyUrls(instrumentSamples.melody, instrumentSamples.melodyNotes);

  // --- Master bus + limiter ---
  const masterBus = new Tone.Gain(1);
  const limiter = new Tone.Limiter(-1);
  masterBus.connect(limiter);
  limiter.connect(Tone.getDestination());

  // --- Drum samples ---
  const drumUrls: Record<string, string> = {
    kick: pack.drumKit.kick,
    clap: pack.drumKit.clap,
    closedHat: pack.drumKit.closedHat,
    openHat: pack.drumKit.openHat,
  };

  const drumPlayers: Record<string, InstanceType<typeof Tone.Player>> = {};
  let drumsOk = false;
  const kickGain = new Tone.Gain(pack.mixProfile.kickGain);
  const clapGain = new Tone.Gain((pack.mixProfile as { clapGain?: number }).clapGain ?? 0.55);
  const hatGain = new Tone.Gain((pack.mixProfile as { hatGain?: number }).hatGain ?? 0.5);
  const hatHpf = new Tone.Filter({ type: 'highpass', frequency: 400, Q: 0.7 });

  try {
    for (const [key, url] of Object.entries(drumUrls)) {
      if (!url) continue;
      const fadeOut = key === 'closedHat' ? 0.05 : key === 'openHat' ? 0.2 : 0.02;
      const p = new Tone.Player({ url, fadeOut });
      await new Promise<void>((resolve, reject) => {
        p.load(url).then(() => resolve()).catch(reject);
      });
      drumPlayers[key] = p;
    }
    drumsOk = Object.keys(drumPlayers).length > 0;
    stats.samplesLoaded.drums = drumsOk;

    if (drumPlayers.kick) drumPlayers.kick.connect(kickGain);
    if (drumPlayers.clap) drumPlayers.clap.connect(clapGain);
    if (drumPlayers.closedHat) drumPlayers.closedHat.connect(hatHpf);
    if (drumPlayers.openHat) drumPlayers.openHat.connect(hatHpf);
    hatHpf.connect(hatGain);
    kickGain.connect(masterBus);
    clapGain.connect(masterBus);
    hatGain.connect(masterBus);
  } catch (e) {
    if (debug) console.warn('[BrowserEngine] Drum samples failed to load:', e);
    Object.values(drumPlayers).forEach((p) => p.dispose());
  }

  // --- Tonal: Sampler (sample-first) or Synth fallback ---
  let bassSampler: InstanceType<typeof Tone.Sampler> | null = null;
  let harmonySampler: InstanceType<typeof Tone.Sampler> | null = null;
  let melodySampler: InstanceType<typeof Tone.Sampler> | null = null;

  let bassSampleOk = false;
  let harmonySampleOk = false;
  let melodySampleOk = false;

  if (bassUrls) {
    try {
      bassSampler = await new Promise<InstanceType<typeof Tone.Sampler>>((resolve, reject) => {
        const s = new Tone.Sampler({
          urls: bassUrls!,
          release: 0.3,
          onload: () => resolve(s as any),
          onerror: (e: Error) => reject(e),
        });
      });
      bassSampleOk = true;
      stats.samplesLoaded.bass = true;
      stats.synthFallbacks.bass = false;
      stats.voiceMode.bass = 'sample';
    } catch (e) {
      if (debug) console.warn('[BrowserEngine] Bass sample failed:', e);
      bassSampler = null;
    }
  }

  if (harmonyUrls) {
    try {
      harmonySampler = await new Promise<InstanceType<typeof Tone.Sampler>>((resolve, reject) => {
        const s = new Tone.Sampler({
          urls: harmonyUrls!,
          release: 0.25, // shorter than melody for stab character
          onload: () => resolve(s as any),
          onerror: (e: Error) => reject(e),
        });
      });
      harmonySampleOk = true;
      stats.samplesLoaded.harmony = true;
      stats.synthFallbacks.harmony = false;
      stats.voiceMode.harmony = 'sample';
    } catch (e) {
      if (debug) console.warn('[BrowserEngine] Harmony sample failed:', e);
      harmonySampler = null;
    }
  }

  if (melodyUrls) {
    try {
      melodySampler = await new Promise<InstanceType<typeof Tone.Sampler>>((resolve, reject) => {
        const s = new Tone.Sampler({
          urls: melodyUrls!,
          release: 0.3,
          onload: () => resolve(s as any),
          onerror: (e: Error) => reject(e),
        });
      });
      melodySampleOk = true;
      stats.samplesLoaded.melody = true;
      stats.synthFallbacks.melody = false;
      stats.voiceMode.melody = 'sample';
    } catch (e) {
      if (debug) console.warn('[BrowserEngine] Melody sample failed:', e);
      melodySampler = null;
    }
  }

  // --- Gain stages ---
  const bassGain = new Tone.Gain(pack.mixProfile.bassGain);
  const harmonyGain = new Tone.Gain(pack.mixProfile.harmonyGain);
  const melodyGain = new Tone.Gain(pack.mixProfile.melodyGain);

  // --- Bass chain: mono, dry, HPF+LPF, saturation, NO reverb ---
  const bassHpf = new Tone.Filter({
    type: 'highpass',
    frequency: pack.synthPatches.bass.highpassHz ?? 40,
    Q: 0.7,
  });
  const bassLpf = new Tone.Filter({
    type: 'lowpass',
    frequency: pack.synthPatches.bass.filterCutoffHz[1],
    Q: 0.7,
  });
  const satAmount = pack.synthPatches.bass.saturation ?? 0.03;
  const bassSat = new Tone.WaveShaper((x: number) => {
    const t = x * (1 + satAmount);
    return Math.tanh(t);
  }, 4096);

  let bassSynth: InstanceType<typeof Tone.MonoSynth> | null = null;

  if (bassSampleOk && bassSampler) {
    bassSampler.disconnect();
    bassSampler.connect(bassHpf);
  } else {
    const [bassDecayLo, bassDecayHi] = pack.synthPatches.bass.decaySec;
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
  }
  bassHpf.connect(bassLpf);
  bassLpf.connect(bassSat);
  bassSat.connect(bassGain);
  bassGain.connect(masterBus);

  // --- Harmony chain: HPF (keep mud out), LPF, saturation, optional subtle chorus, reverb ---
  const harmHpf = new Tone.Filter({
    type: 'highpass',
    frequency: 120,
    Q: 0.7,
  });
  const harmLpf = new Tone.Filter({
    type: 'lowpass',
    frequency: pack.synthPatches.harmony.filterCutoffHz[1],
    Q: 0.7,
  });
  const harmSatAmount = (pack.fxProfile as { saturationAmount?: number }).saturationAmount ?? 0.05;
  const harmSat = new Tone.WaveShaper((x: number) => {
    const t = x * (1 + harmSatAmount);
    return Math.tanh(t);
  }, 4096);
  const harmChorusWet = (pack.fxProfile as { chorusWidth?: number }).chorusWidth ?? 0.03;
  const harmChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.4, wet: harmChorusWet });

  let harmonySynth: InstanceType<typeof Tone.PolySynth> | null = null;

  if (harmonySampleOk && harmonySampler) {
    harmonySampler.disconnect();
    harmonySampler.connect(harmHpf);
  } else {
    const [harmDecayLo, harmDecayHi] = pack.synthPatches.harmony.decaySec;
    harmonySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.02,
        decay: (harmDecayLo + harmDecayHi) / 2,
        sustain: 0.8,
        release: 0.25,
      },
    });
    harmonySynth.connect(harmHpf);
  }
  harmHpf.connect(harmLpf);
  harmLpf.connect(harmSat);
  harmSat.connect(harmChorus);
  harmChorus.connect(harmonyGain);
  harmonyGain.connect(masterBus);

  // --- Melody chain: HPF+LPF, saturation, reverb ---
  const melHpf = new Tone.Filter({
    type: 'highpass',
    frequency: pack.synthPatches.melody.highpassHz ?? 200,
    Q: 0.7,
  });
  const melLpf = new Tone.Filter({
    type: 'lowpass',
    frequency: pack.synthPatches.melody.filterCutoffHz[1],
    Q: 0.7,
  });
  const melSatAmount = (pack.fxProfile as { saturationAmount?: number }).saturationAmount ?? 0.05;
  const melSat = new Tone.WaveShaper((x: number) => {
    const t = x * (1 + melSatAmount);
    return Math.tanh(t);
  }, 4096);

  let melodySynth: InstanceType<typeof Tone.PolySynth> | null = null;

  if (melodySampleOk && melodySampler) {
    melodySampler.disconnect();
    melodySampler.connect(melHpf);
  } else {
    const [melPluckLo, melPluckHi] = pack.synthPatches.melody.pluckDecayMs;
    melodySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.005,
        decay: (melPluckLo + melPluckHi) / 2000,
        sustain: 0.6,
        release: 0.15,
      },
    });
    melodySynth.connect(melHpf);
  }
  melHpf.connect(melLpf);
  melLpf.connect(melSat);
  melSat.connect(melodyGain);
  melodyGain.connect(masterBus);

  // --- FX: plate (harmony/melody only), room (clap only), delay ---
  const plateReverb = new Tone.Reverb({ decay: 1.2, wet: pack.fxProfile.plateWet });
  const clapRoom = new Tone.Reverb({ decay: 0.4, wet: pack.fxProfile.clapRoomWet });
  const delay = new Tone.FeedbackDelay({
    delayTime: pack.fxProfile.delayTimeMs / 1000,
    feedback: 0.25,
    wet: pack.fxProfile.delayWet,
  });

  plateReverb.connect(masterBus);
  delay.connect(masterBus);
  clapRoom.connect(masterBus);

  const reverbHpf = new Tone.Filter({ type: 'highpass', frequency: 200, Q: 0.5 });
  reverbHpf.connect(plateReverb);
  harmonyGain.connect(reverbHpf);
  melodyGain.connect(reverbHpf);
  harmonyGain.connect(delay);
  melodyGain.connect(delay);
  clapGain.connect(clapRoom);

  // --- Sidechain: bass and harmony duck from kick, shorter recovery for musical pump ---
  const duckAttack = 0.003;
  const duckHold = 0.015;
  const duckRelease = 0.025;
  for (const t of kickOnsets) {
    Tone.getTransport().schedule((time) => {
      const duckB = pack.mixProfile.sidechainDuckBass;
      const duckH = pack.mixProfile.sidechainDuckHarmony;
      bassGain.gain.linearRampToValueAtTime(1 - duckB, time + duckAttack);
      bassGain.gain.linearRampToValueAtTime(1 - duckB, time + duckAttack + duckHold);
      bassGain.gain.linearRampToValueAtTime(1, time + duckAttack + duckHold + duckRelease);
      harmonyGain.gain.linearRampToValueAtTime(1 - duckH, time + duckAttack);
      harmonyGain.gain.linearRampToValueAtTime(1 - duckH, time + duckAttack + duckHold);
      harmonyGain.gain.linearRampToValueAtTime(1, time + duckAttack + duckHold + duckRelease);
    }, t);
  }

  // --- Debug logging ---
  if (debug) {
    console.log('[BrowserEngine] Stats:', {
      samplesLoaded: stats.samplesLoaded,
      voiceMode: stats.voiceMode,
      stemGains: stats.stemGains,
      reverbSends: stats.reverbSends,
      sidechainKicks: kickOnsets.length,
    });
  }

  // --- Schedule events ---
  const scheduleEvent = (ev: EventToken) => {
    const t0 = ev.t0;
    const t1 = ev.t1;
    const dur = Math.max(0.05, t1 - t0);
    const vel = Math.max(0, Math.min(1, ev.velocity ?? 0.8));
    const ch = ev.channel;
    const pitch = ev.pitch ?? 69;
    const note = midiToNote(pitch);

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
        const drumSynth = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: pitch === PITCH_KICK ? 4 : 2,
        }).toDestination();
        const freq = Tone.Frequency(note).toFrequency();
        drumSynth.triggerAttackRelease(freq, Math.min(dur, 0.3), t0, vel);
        Tone.getTransport().schedule(() => drumSynth.dispose(), t0 + dur + 0.5);
      }
      return;
    }

    if (ch === 'bass') {
      if (bassSampleOk && bassSampler) {
        bassSampler.triggerAttackRelease(note, dur, t0, vel);
      } else if (bassSynth) {
        const freq = Tone.Frequency(note).toFrequency();
        bassSynth.triggerAttackRelease(freq, dur, t0, vel);
      }
    } else if (ch === 'harmony') {
      if (harmonySampleOk && harmonySampler) {
        harmonySampler.triggerAttackRelease(note, dur, t0, vel);
      } else if (harmonySynth) {
        harmonySynth.triggerAttackRelease(note, dur, t0, vel);
      }
    } else if (ch === 'melody') {
      if (melodySampleOk && melodySampler) {
        melodySampler.triggerAttackRelease(note, dur, t0, vel);
      } else if (melodySynth) {
        melodySynth.triggerAttackRelease(note, dur, t0, vel);
      }
    }
  };

  for (const ev of events) scheduleEvent(ev);

  Tone.getTransport().scheduleOnce(() => {
    Tone.getTransport().stop();
  }, durationSec);

  return {
    getStats: () => stats,
    async start() {
      if (typeof Tone.start === 'function') await Tone.start();
      if (typeof harmChorus.start === 'function') harmChorus.start();
      Tone.getTransport().start();
      if (debug) console.log('[BrowserEngine] Started playback');
    },
    stop() {
      Tone.getTransport().stop();
      Tone.getTransport().cancel(0);
      if (typeof harmChorus.stop === 'function') harmChorus.stop();
      bassSynth?.dispose();
      harmonySynth?.dispose();
      melodySynth?.dispose();
      bassSampler?.dispose();
      harmonySampler?.dispose();
      melodySampler?.dispose();
      bassHpf.dispose();
      bassLpf.dispose();
      bassSat.dispose();
      harmHpf.dispose();
      harmLpf.dispose();
      harmSat.dispose();
      harmChorus.dispose();
      melHpf.dispose();
      melLpf.dispose();
      melSat.dispose();
      bassGain.dispose();
      harmonyGain.dispose();
      melodyGain.dispose();
      kickGain.dispose();
      clapGain.dispose();
      hatGain.dispose();
      hatHpf.dispose();
      plateReverb.dispose();
      clapRoom.dispose();
      delay.dispose();
      reverbHpf.dispose();
      masterBus.dispose();
      limiter.dispose();
      Object.values(drumPlayers).forEach((p) => p.dispose());
      if (debug) console.log('[BrowserEngine] Stopped and disposed');
    },
  };
}
