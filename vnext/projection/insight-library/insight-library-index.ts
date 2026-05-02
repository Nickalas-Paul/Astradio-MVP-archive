/**
 * Astradio Insight Library — Lookup Index
 *
 * Exports four lookup functions and the buildAspectKey helper.
 * This is the only file the assembler imports from.
 *
 * Place this file at: vnext/projection/insight-library/insight-library-index.ts
 *
 * Import in assemble-sections.ts:
 *   import { buildAspectKey, getAspectInsight, getStructuralInsight, getRelationalInsight }
 *     from '../insight-library/insight-library-index';
 *
 * Import in audio-lexicon.ts:
 *   import { getAudioInsight } from '../insight-library/insight-library-index';
 *
 * NOTE: This file imports from all six split aspect files. TypeScript will not
 * compile until all six are present in the same directory. Copy all aspect
 * files before running tsc --noEmit.
 */

import type {
  AspectInsight,
  StructuralClaimInsight,
  RelationalInsight,
  AudioDescriptorInsight,
} from './insight-library-types';

import { PERSONAL_ASPECT_INSIGHTS }  from './insight-library-aspects-personal';
import { SATURN_ASPECT_INSIGHTS }    from './insight-library-aspects-saturn';
import { JUPITER_ASPECT_INSIGHTS }   from './insight-library-aspects-jupiter';
import { URANUS_ASPECT_INSIGHTS }    from './insight-library-aspects-uranus';
import { NEPTUNE_ASPECT_INSIGHTS }   from './insight-library-aspects-neptune';
import { PLUTO_ASPECT_INSIGHTS }     from './insight-library-aspects-pluto';

import { STRUCTURAL_INSIGHTS }  from './insight-library-structural';
import { RELATIONAL_INSIGHTS }  from './insight-library-relational';
import { AUDIO_INSIGHTS }       from './insight-library-audio';

// ---------------------------------------------------------------------------
// Merged aspect lookup table
// ---------------------------------------------------------------------------

const ASPECT_INSIGHTS: Readonly<Record<string, AspectInsight>> = {
  ...PERSONAL_ASPECT_INSIGHTS,
  ...SATURN_ASPECT_INSIGHTS,
  ...JUPITER_ASPECT_INSIGHTS,
  ...URANUS_ASPECT_INSIGHTS,
  ...NEPTUNE_ASPECT_INSIGHTS,
  ...PLUTO_ASPECT_INSIGHTS,
} as const;

// ---------------------------------------------------------------------------
// Planet ordering for canonical aspect key construction
// ---------------------------------------------------------------------------

/**
 * Canonical planet order for aspect key construction.
 * Lower number = appears first in the derived key.
 * Outer/transpersonal planets before personal planets.
 * Among personal planets, luminaries (Sun, Moon) before Venus and Mars.
 */
const PLANET_ORDER: Readonly<Record<string, number>> = {
  PLUTO:   0,
  NEPTUNE: 1,
  URANUS:  2,
  SATURN:  3,
  JUPITER: 4,
  SUN:     5,
  MOON:    6,
  MERCURY: 7,
  VENUS:   8,
  MARS:    9,
} as const;

// ---------------------------------------------------------------------------
// Key construction
// ---------------------------------------------------------------------------

/**
 * Build a canonical aspect key from a SnapshotAspect's bodyA, bodyB, and type.
 *
 * Normalizes planet order so the same pair always produces the same key
 * regardless of which body is A or B in the snapshot.
 *
 * @example
 *   buildAspectKey('moon', 'saturn', 'square')   => 'SATURN_MOON_SQUARE'
 *   buildAspectKey('saturn', 'moon', 'square')   => 'SATURN_MOON_SQUARE'
 *   buildAspectKey('sun', 'moon', 'conjunction') => 'SUN_MOON_CONJUNCTION'
 *   buildAspectKey('venus', 'neptune', 'trine')  => 'NEPTUNE_VENUS_TRINE'
 */
export function buildAspectKey(
  bodyA: string,
  bodyB: string,
  type: string,
): string {
  const a = bodyA.toUpperCase();
  const b = bodyB.toUpperCase();
  const orderA = PLANET_ORDER[a] ?? 99;
  const orderB = PLANET_ORDER[b] ?? 99;
  const [first, second] = orderA <= orderB ? [a, b] : [b, a];
  return `${first}_${second}_${type.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------

/**
 * Look up an aspect insight by derived canonical key.
 * Construct key with: buildAspectKey(aspect.bodyA, aspect.bodyB, aspect.type)
 * Returns undefined if the pair/type is not covered.
 */
export function getAspectInsight(key: string): AspectInsight | undefined {
  return ASPECT_INSIGHTS[key];
}

/**
 * Look up a structural claim insight by ClaimId string.
 * Key = exact CLAIM_IDS string from vnext/semantic/ontology-codes.ts
 * Returns undefined if the claim is not covered.
 */
export function getStructuralInsight(claimId: string): StructuralClaimInsight | undefined {
  return STRUCTURAL_INSIGHTS[claimId];
}

/**
 * Look up a relational insight by class_code, theme tag, ClaimId, or
 * interaction category string.
 * Returns undefined if the key is not covered.
 */
export function getRelationalInsight(id: string): RelationalInsight | undefined {
  return RELATIONAL_INSIGHTS[id];
}

/**
 * Look up an audio descriptor by AudioProjectionEnvelope field value.
 * Pass core.audio.tempo_band, .density_band, .arc_bias,
 * .tension_bias, or .relational_texture directly. No transformation needed.
 * Returns undefined if the code is not covered.
 */
export function getAudioInsight(code: string): AudioDescriptorInsight | undefined {
  return AUDIO_INSIGHTS[code];
}

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type {
  AspectInsight,
  StructuralClaimInsight,
  RelationalInsight,
  AudioDescriptorInsight,
};
