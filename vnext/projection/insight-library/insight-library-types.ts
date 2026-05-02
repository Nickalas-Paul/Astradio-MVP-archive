/**
 * Astradio Insight Library — Type Definitions
 *
 * These interfaces define the shape of every object in the insight library.
 * The assembler imports from insight-library-index.ts, not directly from here.
 *
 * Place this file at: vnext/projection/insight-library/insight-library-types.ts
 */

export type InsightSurface =
  | 'profile'
  | 'feed'
  | 'compat_pair'
  | 'group'
  | 'sandbox';

export type InsightContext = 'friendship' | 'romantic' | 'discovery';

/**
 * Insight object for a specific planetary aspect pair.
 *
 * Keyed by canonical derived key, e.g. SATURN_MOON_SQUARE.
 * Covers Batch 1 (personal planet pairs: Sun, Moon, Venus, Mars)
 * and Batch 2 (outer planets: Saturn, Jupiter, Uranus, Neptune, Pluto
 * against Sun, Moon, Venus, Mars).
 *
 * Key construction: buildAspectKey(bodyA, bodyB, type) in insight-library-index.ts.
 */
export interface AspectInsight {
  readonly key: string;       // e.g. 'SATURN_MOON_SQUARE'
  readonly pair: string;      // e.g. 'SATURN_MOON'
  readonly aspect: string;    // e.g. 'square'
  readonly intensity: string; // descriptive intensity label
  readonly core: string;      // archetypal core meaning paragraph
  readonly behavioral: string; // psychological / behavioral expression paragraph
  readonly friendship: string; // relational context: friendship variant
  readonly romantic: string;   // relational context: romantic variant
  readonly feed: string;       // feed card line (transit-activated, 1–3 sentences)
  readonly sonic: string;      // expanded sonic character description
}

/**
 * Insight object for a structural chart claim.
 *
 * Keyed by ClaimId string from vnext/semantic/ontology-codes.ts CLAIM_IDS.
 * Covers Batch 3: motion profiles, gravity profiles, element dominance,
 * tension bands, tonal polarity, luminary weight.
 *
 * Key: exact CLAIM_IDS string, e.g. 'MOTION_LABEL_SURGING'.
 */
export interface StructuralClaimInsight {
  readonly id: string;          // matches ClaimId exactly
  readonly category: 'motion' | 'gravity' | 'element' | 'tension' | 'tonal' | 'luminary';
  readonly title: string;
  readonly core: string;        // whole-chart character description
  readonly behavioral: string;  // psychological / behavioral expression
  readonly feed: string;        // feed card line
  readonly sonic: string;       // sonic character description
}

/**
 * Insight object for compatibility classifications, relational weather themes,
 * activation bands, and interaction categories.
 *
 * Keyed by:
 *   - class_code from classifyCompatibilityScore (scoring.ts): 'cohesive_field', etc.
 *   - theme tag strings from themes-v1.ts: 'friction_over_harmony', etc.
 *   - ClaimId strings for activation bands: 'REL_HARMONY_HIGH', etc.
 *   - interaction category strings: 'reinforcing', 'cross_pressuring', etc.
 *
 * Covers Batch 4.
 */
export interface RelationalInsight {
  readonly id: string;
  readonly category: 'compat' | 'weather' | 'activation' | 'interaction';
  readonly title: string;
  readonly core: string;
  readonly behavioral: string;
  readonly friendship?: string;  // context variant for friendship surface
  readonly romantic?: string;    // context variant for romantic surface
  readonly discovery?: string;   // context variant for discovery surface
  readonly feed: string;
  readonly sonic: string;
}

/**
 * Insight object for an audio envelope descriptor.
 *
 * Keyed by the string codes already present on SemanticCore.audio:
 *   core.audio.tempo_band      → 'TEMPO_LOW' | 'TEMPO_MED' | 'TEMPO_HIGH'
 *   core.audio.density_band    → 'DENSITY_SPARSE' | 'DENSITY_BALANCED' | 'DENSITY_DENSE'
 *   core.audio.arc_bias        → 'ARC_RISE' | 'ARC_FALL' | 'ARC_CYCLIC' | 'ARC_SURGE_RESOLVE'
 *   core.audio.tension_bias    → 'AUDIO_TENSION_LOW' | 'AUDIO_TENSION_MED' | 'AUDIO_TENSION_HIGH'
 *   core.audio.relational_texture → 'REL_TEXTURE_FLUID' | 'REL_TEXTURE_NEUTRAL'
 *                                  | 'REL_TEXTURE_CALL_RESPONSE' | 'REL_TEXTURE_STATIC'
 *
 * Covers Batch 5. Replaces AUDIO_LEXICON_CLAUSE_STRINGS in audio-lexicon.ts.
 */
export interface AudioDescriptorInsight {
  readonly id: string;
  readonly category: 'tempo' | 'density' | 'arc' | 'tension' | 'texture';
  readonly title: string;
  readonly astrological_source: string;    // which signals produce this descriptor
  readonly psychological_meaning: string;  // what it means for the person/connection
  readonly reading_text: string;           // prose to weave into reading (uses "composition" or "soundtrack")
  readonly listen_for: string;             // specific listening instruction
}
