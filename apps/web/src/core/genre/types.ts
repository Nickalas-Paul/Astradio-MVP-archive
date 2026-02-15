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

/**
 * Optional instrument samples (bass, harmony stab, melody pluck).
 * Single URL = pitch-shifted from base note. Multi-note map = better quality across range.
 * Empty string or missing = use synth fallback.
 */
export interface InstrumentSamples {
  /** Single bass one-shot URL (pitch-shifted from C2) or empty = synth */
  bass?: string;
  /** Multiple bass notes: note name -> URL (e.g. {C1: '...', F1: '...', C2: '...'}) */
  bassNotes?: Record<string, string>;
  /** Single chord stab URL (pitch-shifted from C4) or empty = synth */
  harmony?: string;
  /** Multiple stab notes for harmony */
  harmonyNotes?: Record<string, string>;
  /** Single pluck URL (pitch-shifted from C4) or empty = synth */
  melody?: string;
  /** Multiple pluck notes for melody */
  melodyNotes?: Record<string, string>;
}

/** Optional SoundFont program numbers (MIDI program change). Used for browser SoundFont player or server FluidSynth. */
export interface SoundFontPrograms {
  bass?: number; // MIDI program number for bass (e.g., 33 = electric bass)
  harmony?: number; // MIDI program number for harmony (e.g., 1 = acoustic piano, 49 = strings)
  melody?: number; // MIDI program number for melody (e.g., 81 = lead synth)
  soundfontUrl?: string; // URL to SF2 file (optional, can use default)
}

/** Optional per-stem synth spec (kind, osc, envelope, filter). Used by engine when building synth fallback from pack. */
export interface SynthPatchSpec {
  kind?: 'mono' | 'poly' | 'simple';
  osc?: 'sine' | 'triangle' | 'square' | 'sawtooth';
  envelope?: { attack: number; decay: number; sustain: number; release: number };
  filter?: { hpfHz?: number; lpfHz?: number; q?: number };
  sat?: { drive?: number };
  chorus?: { wet?: number; depth?: number; rate?: number };
  gainDb?: number;
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
  /** Saturation amount for harmony/melody (0–1). Seeded. */
  saturationAmount?: number;
  /** Chorus width for harmony/melody (0–1). Seeded. Optional. */
  chorusWidth?: number;
}

/** Mix profile: levels and sidechain depth. */
export interface MixProfile {
  kickGain: number;
  bassGain: number;
  harmonyGain: number;
  melodyGain: number;
  /** Clap/hi-hat gain (controlled top end). Default 0.5 if omitted. */
  hatGain?: number;
  clapGain?: number;
  sidechainDuckBass: number;
  sidechainDuckHarmony: number;
}

export interface GenrePack {
  id: GenreId;
  displayName: string;
  drumKit: DrumKit;
  instrumentSamples?: InstrumentSamples; // Optional: sample-first for bass/harmony/melody
  soundfontPrograms?: SoundFontPrograms; // Optional: SoundFont program numbers (browser/server)
  synthPatches: SynthPatches; // Fallback when samples/SoundFont unavailable
  fxProfile: FxProfile;
  mixProfile: MixProfile;
}
