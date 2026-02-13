/**
 * Shared Genre Pack contract for browser playback and future server offline export.
 * Matches existing payload.genre and UI enums (house, ambient, classical, jazz, lofi, electronic).
 * No API/contract changes; additive only.
 */

/** Genre ids aligned with payload.genre and GenerateCard/composer UI. */
export type GenreId = 'house' | 'ambient' | 'classical' | 'jazz' | 'lofi' | 'electronic';

/** Drum kit: sample URLs or keys for kick, clap, closed hat, open hat. */
export interface DrumKit {
  kick: string;
  clap: string;
  closedHat: string;
  openHat: string;
}

/** Optional instrument samples (bass, harmony stab, melody pluck). Empty string = use synth fallback. */
export interface InstrumentSamples {
  bass?: string; // Bass one-shot or short loop sample URL
  harmony?: string; // Chord stab sample URL
  melody?: string; // Pluck/lead sample URL
}

/** Synth patch params for Tone.js (seeded variations applied by getGenrePack). Used as fallback when samples unavailable. */
export interface SynthPatches {
  bass: {
    filterCutoffHz: [number, number]; // LPF range [lo, hi]
    highpassHz?: number; // HPF to remove sub-bass rumble
    decaySec: [number, number];
    gain: number;
    saturation?: number; // Subtle saturation (0-1)
  };
  harmony: {
    filterCutoffHz: [number, number]; // LPF range [lo, hi]
    decaySec: [number, number];
    stereoWiden: number;
  };
  melody: {
    filterCutoffHz: [number, number]; // LPF range [lo, hi]
    highpassHz?: number; // HPF to remove low-end fizz
    pluckDecayMs: [number, number];
    vibratoDepth: number;
  };
}

/** FX profile: reverb/delay amounts (0–1). No reverb on bass. */
export interface FxProfile {
  plateWet: number;
  delayWet: number;
  delayTimeMs: number;
  /** Clap can have room; harmony/melody get plate + delay. */
  clapRoomWet: number;
}

/** Mix profile: levels and sidechain depth. */
export interface MixProfile {
  kickGain: number;
  bassGain: number;
  harmonyGain: number;
  melodyGain: number;
  sidechainDuckBass: number;
  sidechainDuckHarmony: number;
}

export interface GenrePack {
  id: GenreId;
  displayName: string;
  drumKit: DrumKit;
  instrumentSamples?: InstrumentSamples; // Optional: sample-first for bass/harmony/melody
  synthPatches: SynthPatches; // Fallback when samples unavailable
  fxProfile: FxProfile;
  mixProfile: MixProfile;
}
