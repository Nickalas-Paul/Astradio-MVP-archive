/**
 * Genre Pack — shared contract for browser playback and future server offline export.
 * Reuses payload.genre and UI genre enums; House pack implemented; structure ready for more genres.
 */

import type { GenreId, GenrePack } from './types';
import { getHousePack } from './house';

export type { GenreId, GenrePack, DrumKit, InstrumentSamples, SynthPatches, FxProfile, MixProfile } from './types';
export { rand01, randSigned, hashU32, lerpFromSeed } from './seed';

/** Return genre pack for given genre and seed. Default genre is "house". */
export function getGenrePack(genre: GenreId | string, seed: string): GenrePack {
  const g = (typeof genre === 'string' ? genre : 'house').toLowerCase() as GenreId;
  switch (g) {
    case 'house':
      return getHousePack(seed);
    case 'ambient':
    case 'classical':
    case 'jazz':
    case 'lofi':
    case 'electronic':
    default:
      return getHousePack(seed);
  }
}
