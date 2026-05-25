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
 * NOTE: This file imports from all aspect files (six core planet files plus
 * Mercury and five asteroid files). TypeScript will not compile until all
 * referenced files are present in the same directory. Empty scaffolds for
 * Mercury and the asteroid files are part of Phase 1 so the index compiles
 * even before content authoring lands.
 */

import type {
  AspectInsight,
  StructuralClaimInsight,
  RelationalInsight,
  AudioDescriptorInsight,
  PlanetInsight,
  SignInsight,
  HouseInsight,
  PlanetInSignInsight,
  PlanetInHouseInsight,
} from './insight-library-types';

import { PERSONAL_ASPECT_INSIGHTS }  from './insight-library-aspects-personal';
import { SATURN_ASPECT_INSIGHTS }    from './insight-library-aspects-saturn';
import { JUPITER_ASPECT_INSIGHTS }   from './insight-library-aspects-jupiter';
import { URANUS_ASPECT_INSIGHTS }    from './insight-library-aspects-uranus';
import { NEPTUNE_ASPECT_INSIGHTS }   from './insight-library-aspects-neptune';
import { PLUTO_ASPECT_INSIGHTS }     from './insight-library-aspects-pluto';
import { MERCURY_ASPECT_INSIGHTS }   from './insight-library-aspects-mercury';

import { CHIRON_ASPECT_INSIGHTS }    from './insight-library-aspects-chiron';
import { CERES_ASPECT_INSIGHTS }     from './insight-library-aspects-ceres';
import { PALLAS_ASPECT_INSIGHTS }    from './insight-library-aspects-pallas';
import { JUNO_ASPECT_INSIGHTS }      from './insight-library-aspects-juno';
import { VESTA_ASPECT_INSIGHTS }     from './insight-library-aspects-vesta';

import { STRUCTURAL_INSIGHTS }  from './insight-library-structural';
import { RELATIONAL_INSIGHTS }  from './insight-library-relational';
import { AUDIO_INSIGHTS }       from './insight-library-audio';

import { PLANET_INSIGHTS } from './insight-library-planets';
import { SIGN_INSIGHTS } from './insight-library-signs';
import { HOUSE_INSIGHTS } from './insight-library-houses';
import { PLANET_IN_SIGN_INSIGHTS } from './insight-library-placements-sign';
import { PLANET_IN_HOUSE_INSIGHTS } from './insight-library-placements-house';
import { ASCENDANT_PLACEMENTS } from './insight-library-angles';

// ---------------------------------------------------------------------------
// Phase 5A placement archetypes → AspectInsight-shaped rows for MEP compose + tier1 audit
// ---------------------------------------------------------------------------

const PLACEMENT_INTENSITY = 'natal_placement_foundational';

function planetInsightToAspect(ins: PlanetInsight): AspectInsight {
  return {
    key: ins.key,
    pair: ins.planet,
    aspect: 'placement',
    intensity: PLACEMENT_INTENSITY,
    core: ins.core,
    behavioral: ins.behavioral,
    friendship: ins.friendship,
    romantic: ins.romantic,
    feed: ins.feed,
    sonic: ins.sonic,
  };
}

function signInsightToAspect(ins: SignInsight): AspectInsight {
  return {
    key: ins.key,
    pair: ins.sign,
    aspect: 'placement',
    intensity: PLACEMENT_INTENSITY,
    core: ins.core,
    behavioral: ins.behavioral,
    friendship: ins.friendship,
    romantic: ins.romantic,
    feed: ins.feed,
    sonic: ins.sonic,
  };
}

function houseInsightToAspect(ins: HouseInsight): AspectInsight {
  return {
    key: ins.key,
    pair: `HOUSE_${ins.house}`,
    aspect: 'placement',
    intensity: PLACEMENT_INTENSITY,
    core: ins.core,
    behavioral: ins.behavioral,
    friendship: ins.friendship,
    romantic: ins.romantic,
    feed: ins.feed,
    sonic: ins.sonic,
  };
}

function planetInSignInsightToAspect(ins: PlanetInSignInsight): AspectInsight {
  return {
    key: ins.key,
    pair: `${ins.planet}_${ins.sign}`,
    aspect: 'placement',
    intensity: PLACEMENT_INTENSITY,
    core: ins.core,
    behavioral: ins.behavioral,
    friendship: ins.friendship,
    romantic: ins.romantic,
    feed: ins.feed,
    sonic: ins.sonic,
  };
}

function planetInHouseInsightToAspect(ins: PlanetInHouseInsight): AspectInsight {
  return {
    key: ins.key,
    pair: `${ins.planet}_${ins.house}`,
    aspect: 'placement',
    intensity: PLACEMENT_INTENSITY,
    core: ins.core,
    behavioral: ins.behavioral,
    friendship: ins.friendship,
    romantic: ins.romantic,
    feed: ins.feed,
    sonic: ins.sonic,
  };
}

function buildPlacementAspectInsights(): Record<string, AspectInsight> {
  const out: Record<string, AspectInsight> = {};
  for (const ins of Object.values(PLANET_INSIGHTS) as PlanetInsight[]) {
    out[ins.key] = planetInsightToAspect(ins);
  }
  for (const ins of Object.values(SIGN_INSIGHTS) as SignInsight[]) {
    out[ins.key] = signInsightToAspect(ins);
  }
  for (const ins of Object.values(HOUSE_INSIGHTS) as HouseInsight[]) {
    out[ins.key] = houseInsightToAspect(ins);
  }
  for (const ins of Object.values(PLANET_IN_SIGN_INSIGHTS) as PlanetInSignInsight[]) {
    out[ins.key] = planetInSignInsightToAspect(ins);
  }
  for (const ins of Object.values(PLANET_IN_HOUSE_INSIGHTS) as PlanetInHouseInsight[]) {
    out[ins.key] = planetInHouseInsightToAspect(ins);
  }
  for (const ins of Object.values(ASCENDANT_PLACEMENTS) as PlanetInSignInsight[]) {
    out[ins.key] = planetInSignInsightToAspect(ins);
  }
  return out;
}

const PLACEMENT_ASPECT_INSIGHTS: Readonly<Record<string, AspectInsight>> = buildPlacementAspectInsights();

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
  ...MERCURY_ASPECT_INSIGHTS,
  ...CHIRON_ASPECT_INSIGHTS,
  ...CERES_ASPECT_INSIGHTS,
  ...PALLAS_ASPECT_INSIGHTS,
  ...JUNO_ASPECT_INSIGHTS,
  ...VESTA_ASPECT_INSIGHTS,
  ...PLACEMENT_ASPECT_INSIGHTS,
} as const;

// ---------------------------------------------------------------------------
// Planet ordering for canonical aspect key construction
// ---------------------------------------------------------------------------

/**
 * Canonical body order for aspect key construction.
 * Lower number = appears first in the derived key.
 *
 * Ordering rationale:
 *   - Outer/transpersonal planets first (Pluto → Jupiter), per traditional
 *     synastry convention where outer-on-personal is read with the outer named first.
 *   - Chiron between Saturn/Jupiter and the luminaries — reflects its Saturn-Uranus
 *     orbital territory and its bridge function in chart interpretation.
 *   - Luminaries (Sun, Moon) before personal planets and asteroid-belt cluster.
 *   - Asteroid-belt cluster (Ceres, Pallas, Juno, Vesta) sits with the personal-feminine
 *     archetypes alongside Venus, ordered before Mercury/Venus/Mars.
 *   - Mercury, Venus, Mars at the end as the most personal planets.
 *
 * This ordering is the single source of truth for buildAspectKey. Asteroid library
 * entries are authored against this ordering. Synastry compute's CORE_BODIES filter
 * currently excludes asteroids; expanding that filter is a separate wiring stream.
 * Library content lives ahead of wiring, ready to render when wiring expands.
 */
const PLANET_ORDER: Readonly<Record<string, number>> = {
  PLUTO:   0,
  NEPTUNE: 1,
  URANUS:  2,
  SATURN:  3,
  JUPITER: 4,
  CHIRON:  5,
  SUN:     6,
  MOON:    7,
  CERES:   8,
  PALLAS:  9,
  JUNO:    10,
  VESTA:   11,
  MERCURY: 12,
  VENUS:   13,
  MARS:    14,
} as const;

// ---------------------------------------------------------------------------
// Key construction
// ---------------------------------------------------------------------------

/**
 * Build a canonical aspect key from a SnapshotAspect's bodyA, bodyB, and type.
 *
 * Normalizes body order so the same pair always produces the same key
 * regardless of which body is A or B in the snapshot.
 *
 * @example
 *   buildAspectKey('moon', 'saturn', 'square')   => 'SATURN_MOON_SQUARE'
 *   buildAspectKey('saturn', 'moon', 'square')   => 'SATURN_MOON_SQUARE'
 *   buildAspectKey('sun', 'moon', 'conjunction') => 'SUN_MOON_CONJUNCTION'
 *   buildAspectKey('venus', 'neptune', 'trine')  => 'NEPTUNE_VENUS_TRINE'
 *   buildAspectKey('chiron', 'sun', 'square')    => 'CHIRON_SUN_SQUARE'
 *   buildAspectKey('vesta', 'mars', 'opposition')=> 'VESTA_MARS_OPPOSITION'
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
  PlanetInsight,
  SignInsight,
  HouseInsight,
  PlanetInSignInsight,
  PlanetInHouseInsight,
};
