/**
 * House genre pack. Seeded param derivations for deterministic variation.
 * Structure allows adding more genres later without changing the playback engine.
 */

import type { GenrePack, DrumKit, SynthPatches, FxProfile, MixProfile } from './types';
import { lerpFromSeed } from './seed';

/** House drum kit: reuse existing 808 samples under public/audio/samples/drums/808. */
const HOUSE_BASE: Omit<GenrePack, 'synthPatches' | 'fxProfile' | 'mixProfile'> = {
  id: 'house',
  displayName: 'House',
  drumKit: {
    kick: '/audio/samples/drums/808/kick.wav',
    clap: '/audio/samples/drums/808/snare.wav',
    closedHat: '/audio/samples/drums/808/hat.wav',
    openHat: '/audio/samples/drums/808/hat.wav',
  },
};

export function getHousePack(seed: string): GenrePack {
  const f = (key: string, lo: number, hi: number) => lerpFromSeed(seed, `house:${key}`, lo, hi);

  const synthPatches: SynthPatches = {
    bass: {
      filterCutoffHz: [f('bass:lpfLo', 600, 800), f('bass:lpfHi', 1000, 1400)],
      decaySec: [f('bass:decayLo', 0.18, 0.25), f('bass:decayHi', 0.28, 0.38)],
      gain: f('bass:gain', 0.52, 0.68),
    },
    harmony: {
      filterCutoffHz: [f('harm:lpfLo', 400, 600), f('harm:lpfHi', 1000, 1400)],
      decaySec: [f('harm:decayLo', 0.08, 0.12), f('harm:decayHi', 0.14, 0.22)],
      stereoWiden: f('harm:widen', 0.06, 0.14),
    },
    melody: {
      filterCutoffHz: [f('mel:lpfLo', 1200, 1800), f('mel:lpfHi', 2400, 3600)],
      pluckDecayMs: [f('mel:pluckLo', 50, 80), f('mel:pluckHi', 90, 140)],
      vibratoDepth: f('mel:vib', 0.004, 0.012),
    },
  };

  const fxProfile: FxProfile = {
    plateWet: f('fx:plate', 0.08, 0.16),
    delayWet: f('fx:delay', 0.03, 0.08),
    delayTimeMs: 250 + f('fx:delayTime', 0, 80),
    clapRoomWet: f('fx:clapRoom', 0.28, 0.42),
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
