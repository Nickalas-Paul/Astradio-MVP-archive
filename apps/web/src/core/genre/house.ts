/**
 * House genre pack. Seeded param derivations for deterministic variation.
 * Structure allows adding more genres later without changing the playback engine.
 */

import type { GenrePack, DrumKit, InstrumentSamples, SynthPatches, FxProfile, MixProfile } from './types';
import { lerpFromSeed } from './seed';

/** House drum kit and tonal samples under public/audio/samples/house/. */
const HOUSE_BASE: Omit<GenrePack, 'synthPatches' | 'fxProfile' | 'mixProfile'> = {
  id: 'house',
  displayName: 'House',
  drumKit: {
    kick: '/audio/samples/house/drums/kick.wav',
    clap: '/audio/samples/house/drums/clap.wav',
    closedHat: '/audio/samples/house/drums/hat_open.wav',
    openHat: '/audio/samples/house/drums/hat_open.wav',
  },
  instrumentSamples: {
    bass: '/audio/samples/house/bass/bass_C2.wav',
    melody: '/audio/samples/house/melody/pluck_C4.wav',
    // harmony omitted – synth fallback
  },
};

export function getHousePack(seed: string): GenrePack {
  const f = (key: string, lo: number, hi: number) => lerpFromSeed(seed, `house:${key}`, lo, hi);

  const synthPatches: SynthPatches = {
    bass: {
      // Darker bass: lower LPF, HPF to remove rumble, subtle saturation
      filterCutoffHz: [f('bass:lpfLo', 400, 550), f('bass:lpfHi', 700, 950)], // Lowered from 600-1400
      highpassHz: f('bass:hpf', 35, 45), // Remove sub-bass rumble
      decaySec: [f('bass:decayLo', 0.20, 0.28), f('bass:decayHi', 0.30, 0.42)],
      gain: f('bass:gain', 0.55, 0.70),
      saturation: f('bass:sat', 0.02, 0.05), // Subtle warmth
    },
    harmony: {
      // Warmer harmony: lower LPF, shorter decay for stab character
      filterCutoffHz: [f('harm:lpfLo', 350, 500), f('harm:lpfHi', 900, 1200)], // Lowered from 400-1400
      decaySec: [f('harm:decayLo', 0.10, 0.15), f('harm:decayHi', 0.18, 0.28)], // Slightly longer for stab
      stereoWiden: f('harm:widen', 0.08, 0.16),
    },
    melody: {
      // Clearer melody: moderate LPF, HPF to remove fizz, controlled pluck
      filterCutoffHz: [f('mel:lpfLo', 1000, 1400), f('mel:lpfHi', 2000, 2800)], // Lowered from 1200-3600
      highpassHz: f('mel:hpf', 200, 300), // Remove low-end fizz
      pluckDecayMs: [f('mel:pluckLo', 60, 90), f('mel:pluckHi', 100, 150)],
      vibratoDepth: f('mel:vib', 0.003, 0.010), // Slightly less vibrato
    },
  };

  const fxProfile: FxProfile = {
    plateWet: f('fx:plate', 0.06, 0.12),
    delayWet: f('fx:delay', 0.02, 0.06),
    delayTimeMs: 240 + f('fx:delayTime', 0, 60),
    clapRoomWet: f('fx:clapRoom', 0.25, 0.38),
  };

  const mixProfile: MixProfile = {
    kickGain: f('mix:kick', 0.85, 1),
    bassGain: f('mix:bass', 0.5, 0.65),
    harmonyGain: f('mix:harmony', 0.35, 0.5),
    melodyGain: f('mix:melody', 0.3, 0.45),
    sidechainDuckBass: f('mix:duckBass', 0.18, 0.26),
    sidechainDuckHarmony: f('mix:duckHarmony', 0.08, 0.14),
  };

  return {
    ...HOUSE_BASE,
    drumKit: { ...HOUSE_BASE.drumKit },
    synthPatches,
    fxProfile,
    mixProfile,
  };
}
