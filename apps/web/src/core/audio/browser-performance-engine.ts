/**
 * Browser Performance Engine (House default).
 * Consumes Plan + payload.hash + payload.genre, plays via Tone.js with genre pack
 * (samples + synths). Deterministic event scheduling and param choice from seed;
 * audio output may vary slightly across devices. Export remains server-authoritative.
 */

import type { Plan, EventToken } from '../plan-to-tone-events';
import type { Player } from 'tone';
import { getGenrePack } from '../genre';

const PITCH_KICK = 36;
const PITCH_CLAP = 38;
const PITCH_HAT = 42;

export interface BrowserEngineOptions {
  plan: Plan;
  seed: string;
  genre?: string;
}

export interface BrowserEngineHandle {
  start: () => Promise<void>;
  stop: () => void;
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
  const { plan, seed, genre = 'house' } = options;
  const Tone = await import('tone');
  const pack = getGenrePack(genre, seed);
  const gainToDb = (Tone as any).gainToDb ?? ((g: number) => (g <= 0 ? -100 : Math.max(-60, 20 * Math.log10(g))));

  const durationSec = plan.durationSec ?? 60;
  const events = plan.events ?? [];
  const kickOnsets: number[] = [];
  for (const ev of events) {
    if (ev.channel === 'rhythm' && ev.pitch === PITCH_KICK) kickOnsets.push(ev.t0);
  }

  // --- Sample loaders (fallback to synth if load fails) ---
  const sampleUrls: Record<string, string> = {
    kick: pack.drumKit.kick,
    clap: pack.drumKit.clap,
    closedHat: pack.drumKit.closedHat,
    openHat: pack.drumKit.openHat,
  };

  const players: Record<string, Player> = {};
  let samplesOk = true;
  try {
    for (const [key, url] of Object.entries(sampleUrls)) {
      const p = new Tone.Player({ url, fadeOut: 0.02 }).toDestination();
      await new Promise<void>((resolve, reject) => {
        p.load(url).then(() => resolve()).catch(reject);
      });
      players[key] = p;
    }
  } catch {
    samplesOk = false;
    Object.values(players).forEach((p) => p.dispose());
  }

  // --- Synths (always used for bass/harmony/melody) ---
  const bassGain = new Tone.Gain(pack.mixProfile.bassGain);
  const harmonyGain = new Tone.Gain(pack.mixProfile.harmonyGain);
  const melodyGain = new Tone.Gain(pack.mixProfile.melodyGain);

  const [bassLpfLo, bassLpfHi] = pack.synthPatches.bass.filterCutoffHz;
  const [bassDecayLo, bassDecayHi] = pack.synthPatches.bass.decaySec;
  const bassSynth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', frequency: bassLpfHi },
    envelope: {
      attack: 0.01,
      decay: (bassDecayLo + bassDecayHi) / 2,
      sustain: 0.7,
      release: 0.2,
    },
  }).connect(bassGain);

  const [harmLpfLo, harmLpfHi] = pack.synthPatches.harmony.filterCutoffHz;
  const harmSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    filter: { type: 'lowpass', frequency: harmLpfHi },
    envelope: { attack: 0.02, decay: 0.12, sustain: 0.8, release: 0.25 },
  }).connect(harmonyGain);

  const [melLpfLo, melLpfHi] = pack.synthPatches.melody.filterCutoffHz;
  const melSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    filter: { type: 'lowpass', frequency: melLpfHi },
    envelope: { attack: 0.005, decay: 0.08, sustain: 0.6, release: 0.15 },
  }).connect(melodyGain);

  bassGain.connect(Tone.getDestination());
  harmonyGain.connect(Tone.getDestination());
  melodyGain.connect(Tone.getDestination());

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

  // --- FX: plate reverb + delay (no reverb on bass) ---
  const reverb = new Tone.Reverb({ decay: 1.8, wet: pack.fxProfile.plateWet });
  const delay = new Tone.FeedbackDelay({
    delayTime: pack.fxProfile.delayTimeMs / 1000,
    feedback: 0.35,
    wet: pack.fxProfile.delayWet,
  });
  reverb.connect(Tone.getDestination());
  delay.connect(Tone.getDestination());
  harmonyGain.connect(reverb);
  harmonyGain.connect(delay);
  melodyGain.connect(reverb);
  melodyGain.connect(delay);

  // --- Rhythm: schedule samples or fallback synths (Transport.schedule so start time is correct) ---
  const scheduleEvent = (ev: EventToken) => {
    const t0 = ev.t0;
    const t1 = ev.t1;
    const dur = Math.max(0.05, t1 - t0);
    const vel = Math.max(0, Math.min(1, ev.velocity ?? 0.8));
    const ch = ev.channel;
    const pitch = ev.pitch ?? 69;

    if (ch === 'rhythm') {
      if (samplesOk && players.kick && players.clap && players.closedHat) {
        Tone.getTransport().schedule((time) => {
          const db = gainToDb(vel);
          if (pitch === PITCH_KICK) {
            players.kick.volume.value = db;
            players.kick.start(time);
          } else if (pitch === PITCH_CLAP) {
            players.clap.volume.value = db;
            players.clap.start(time);
          } else if (pitch === PITCH_HAT) {
            players.closedHat.volume.value = db;
            players.closedHat.start(time);
          }
        }, t0);
      } else {
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
      bassSynth.triggerAttackRelease(freq, dur, t0, vel);
    } else if (ch === 'harmony') {
      harmSynth.triggerAttackRelease(freq, dur, t0, vel);
    } else {
      melSynth.triggerAttackRelease(freq, dur, t0, vel);
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
    },
    stop() {
      Tone.getTransport().stop();
      Tone.getTransport().cancel(0);
      bassSynth.dispose();
      harmSynth.dispose();
      melSynth.dispose();
      bassGain.dispose();
      harmonyGain.dispose();
      melodyGain.dispose();
      reverb.dispose();
      delay.dispose();
      Object.values(players).forEach((p) => p.dispose());
    },
  };
}
