/**
 * SoundFont loader for browser playback.
 * Optional: enabled via NEXT_PUBLIC_SOUNDFONT=1.
 * Priority: sample first → SoundFont (if enabled) → synth fallback.
 */

import type { SoundFontPrograms } from '../genre/types';

export interface SoundFontVoice {
  triggerNote(note: string, time: number, duration: number, velocity: number): void;
  dispose(): void;
}

export interface SoundFontLoadOptions {
  soundfontUrl?: string;
  /** Base URL for pre-rendered soundfont assets (e.g. MP3). */
  baseUrl?: string;
}

const GM_PROGRAM_TO_NAME: Record<number, string> = {
  1: 'acoustic_grand_piano',
  11: 'music_box',
  12: 'vibraphone',
  34: 'fretless_bass',
  33: 'electric_bass_finger',
  39: 'synth_bass_1',
  49: 'string_ensemble_1',
  80: 'lead_1_square',
  81: 'lead_2_sawtooth',
  88: 'pad_1_new_age',
  89: 'pad_2_warm',
  90: 'pad_3_polysynth',
};

/**
 * Load a playable SoundFont voice for the given program number.
 * Returns null if SoundFont is disabled (NEXT_PUBLIC_SOUNDFONT=1 not set),
 * or when the optional soundfont-player library is not installed.
 *
 * To enable: set NEXT_PUBLIC_SOUNDFONT=1 and add dependency:
 *   pnpm add soundfont-player
 * Then implement loading via Soundfont.instrument(ctx, GM name) and
 * return a voice with triggerNote(note, time, duration, velocity) and dispose().
 */
export async function loadSoundFontVoice(
  _programNumber: number,
  _options: SoundFontLoadOptions = {}
): Promise<SoundFontVoice | null> {
  const enabled =
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SOUNDFONT === '1';
  if (!enabled) return null;
  // Optional: dynamic import('soundfont-player') and map programNumber to GM name
  // via GM_PROGRAM_TO_NAME, then return { triggerNote, dispose }
  return null;
}

/**
 * Create SoundFont players for bass/harmony/melody from pack.
 * Returns null if SoundFont is disabled or pack has no soundfontPrograms.
 */
export async function createSoundFontPlayers(
  programs: SoundFontPrograms | undefined
): Promise<{
  bass: SoundFontVoice | null;
  harmony: SoundFontVoice | null;
  melody: SoundFontVoice | null;
} | null> {
  if (!programs) return null;
  const [bass, harmony, melody] = await Promise.all([
    programs.bass != null ? loadSoundFontVoice(programs.bass) : Promise.resolve(null),
    programs.harmony != null ? loadSoundFontVoice(programs.harmony) : Promise.resolve(null),
    programs.melody != null ? loadSoundFontVoice(programs.melody) : Promise.resolve(null),
  ]);
  if (!bass && !harmony && !melody) return null;
  return { bass, harmony, melody };
}

export { GM_PROGRAM_TO_NAME as MIDI_PROGRAM_NAMES };
