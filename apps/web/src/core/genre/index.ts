/**
 * Genre Pack — REMOVED for web playback. Lyria-only.
 * Type exports kept for compatibility; getGenrePack throws.
 */

import type { GenreId, GenrePack } from './types';

export type { GenreId, GenrePack, DrumKit, InstrumentSamples, SynthPatchSpec, SynthPatches, FxProfile, MixProfile } from './types';
export { rand01, randSigned, hashU32, lerpFromSeed } from './seed';

/** Legacy genre pack removed. Do not use for playback. Lyria-only. */
export function getGenrePack(_genre: GenreId | string, _seed: string): GenrePack {
  throw new Error('[Astradio] Legacy genre pack is removed. Lyria-only.');
}
