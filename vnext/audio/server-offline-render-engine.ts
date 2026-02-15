/**
 * ServerOfflineRenderEngine (scaffolding).
 * Renders MIDI → WAV using FluidSynth (SF2) or curated sample packs.
 * Reuses same Genre Pack definitions so export matches browser playback character.
 *
 * Enable via env: VNEXT_OFFLINE_SF2=1 (when implemented).
 *
 * Design:
 * 1. Export MIDI from Plan (vnext/midi/plan-to-midi.ts)
 * 2. Load Genre Pack: getGenrePack(genre, seed) from apps/web/src/core/genre
 * 3. Map instruments via mapGenrePackToFluidSynthPrograms(pack)
 * 4. Render MIDI through FluidSynth with SF2 file
 * 5. Apply FX/mix from pack; output WAV buffer + sha256
 *
 * SF2 supply:
 * - Local dev: path in env e.g. SOUNDFONT_PATH=./assets/FluidR3_GM.sf2
 * - Production: deploy SF2 to asset store or CDN; do not commit large binaries
 * - Licensing: FluidR3_GM is free; verify attribution and license for any other SF2
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
  const useSf2 = process.env.VNEXT_OFFLINE_SF2 === '1';
  if (!useSf2) {
    throw new Error('ServerOfflineRenderEngine not enabled. Set VNEXT_OFFLINE_SF2=1 and implement FluidSynth path.');
  }
  // 1. planToMidiBase64(options.plan)
  // 2. options.genrePack already provided
  // 3. mapGenrePackToFluidSynthPrograms(options.genrePack)
  // 4. FluidSynth render (Node binding or child_process) with SF2 from SOUNDFONT_PATH
  // 5. Return { buffer, durationSec, sampleRate, bitDepth, format: 'wav', sha256 }
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
    bass: programs?.bass ?? 34,   // GM: Fretless Bass
    harmony: programs?.harmony ?? 89, // GM: Pad (warm)
    melody: programs?.melody ?? 81,   // GM: Lead Synth
  };
}
