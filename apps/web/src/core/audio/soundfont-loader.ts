/**
 * SoundFont loader scaffolding for browser playback.
 * Lightweight wrapper for future SoundFont player integration.
 * Falls back to synth if SoundFont unavailable.
 */

import type { SoundFontPrograms } from '../genre/types';

export interface SoundFontPlayer {
  playNote: (pitch: number, velocity: number, startTime: number, duration: number) => void;
  dispose: () => void;
}

/**
 * Create SoundFont player (scaffolding - not fully implemented yet).
 * Returns null if SoundFont unavailable, triggering synth fallback.
 * 
 * Future implementation:
 * - Use lightweight browser SoundFont player (e.g., soundfont-player or similar)
 * - Load SF2 file from pack.soundfontPrograms.soundfontUrl or default
 * - Map program numbers to instruments
 * - Route MIDI notes from plan.events
 */
export async function createSoundFontPlayer(
  programs: SoundFontPrograms | undefined,
  channel: 'bass' | 'harmony' | 'melody'
): Promise<SoundFontPlayer | null> {
  if (!programs) return null;
  
  const programNumber = 
    channel === 'bass' ? programs.bass :
    channel === 'harmony' ? programs.harmony :
    channel === 'melody' ? programs.melody :
    undefined;
  
  if (programNumber === undefined) return null;
  
  // TODO: Implement SoundFont loading
  // For now, return null to trigger synth fallback
  // Future: Load SF2, create player, return interface
  
  return null;
}

/**
 * MIDI program number to instrument name mapping (for reference)
 */
export const MIDI_PROGRAM_NAMES: Record<number, string> = {
  1: 'Acoustic Piano',
  33: 'Electric Bass',
  49: 'Strings',
  81: 'Lead Synth',
  88: 'Pad',
};
