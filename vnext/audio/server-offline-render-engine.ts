/**
 * ServerOfflineRenderEngine interface (scaffolding).
 * Future: Renders MIDI → WAV using FluidSynth (SF2) or curated sample packs.
 * Reuses same Genre Pack definitions so export matches browser playback character.
 * 
 * This is a design document and interface definition only.
 * Full implementation will:
 * 1. Export MIDI from Plan (vnext/midi/plan-to-midi.ts already exists)
 * 2. Load Genre Pack (same contract as browser)
 * 3. Render MIDI through SoundFont or sample packs
 * 4. Output high-quality WAV for export/sharing
 */

import type { Plan } from '../contracts';
import type { GenrePack } from '../../apps/web/src/core/genre/types';

export interface ServerOfflineRenderOptions {
  plan: Plan;
  genrePack: GenrePack;
  seed: string;
  outputFormat?: 'wav' | 'mp3';
  sampleRate?: number; // Default: 44100
  bitDepth?: number; // Default: 16
}

export interface ServerOfflineRenderResult {
  buffer: Buffer; // Audio data
  durationSec: number;
  sampleRate: number;
  bitDepth: number;
  format: 'wav' | 'mp3';
  sha256: string; // Hash for verification
}

/**
 * ServerOfflineRenderEngine interface (not implemented yet).
 * 
 * Design:
 * 1. Convert Plan to MIDI using planToMidiBase64 (vnext/midi/plan-to-midi.ts)
 * 2. Load Genre Pack (same as browser: getGenrePack(genre, seed))
 * 3. Map instruments:
 *    - Drums: Use drumKit samples from pack
 *    - Bass/Harmony/Melody: Use soundfontPrograms or instrumentSamples
 *    - Fallback: Use synth patches (same as browser fallback)
 * 4. Render MIDI through FluidSynth (SF2) or sample-based renderer
 * 5. Apply FX (reverb, delay) from pack.fxProfile
 * 6. Mix according to pack.mixProfile
 * 7. Output WAV/MP3
 * 
 * Why server-authoritative:
 * - Consistent output across devices
 * - High-quality rendering (no real-time constraints)
 * - Bit-identical for same inputs (deterministic)
 * - Suitable for export/sharing
 */
export async function renderPlanOffline(
  options: ServerOfflineRenderOptions
): Promise<ServerOfflineRenderResult> {
  // TODO: Implement offline rendering
  // 1. Export MIDI from plan
  // 2. Load Genre Pack
  // 3. Render through FluidSynth or sample renderer
  // 4. Apply FX and mix
  // 5. Return WAV/MP3 buffer
  
  throw new Error('ServerOfflineRenderEngine not yet implemented. Use existing WAV renderer as fallback.');
}

/**
 * Future: Map Genre Pack to FluidSynth program numbers
 */
export function mapGenrePackToFluidSynthPrograms(pack: GenrePack): {
  bass: number;
  harmony: number;
  melody: number;
} {
  const programs = pack.soundfontPrograms;
  return {
    bass: programs?.bass ?? 33, // Default: Electric Bass
    harmony: programs?.harmony ?? 49, // Default: Strings
    melody: programs?.melody ?? 81, // Default: Lead Synth
  };
}
