/**
 * AudioProjection: narrative staging from SemanticCore only (no new claims).
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type { ClaimId } from '../semantic/ontology-codes';

type PrimaryElement = 'fire' | 'earth' | 'air' | 'water';
type TonalPolarity = 'bright' | 'balanced' | 'dark';

export interface CrossSurfaceToneHints {
  text: {
    emphasizeTension: 'low' | 'medium' | 'high';
    avoidShadowLanguage: boolean;
    emphasizeRelationalMirroring: boolean;
    emphasizeWaterLanguage: boolean;
  };
  audio: {
    harmonicTension: 'low' | 'medium' | 'high';
    avoidDarkDefaults: boolean;
    preferFluidTextures: boolean;
    preferCallAndResponse: boolean;
  };
}

function claimStrength(core: SemanticCore, id: ClaimId): number {
  const c = core.claims.find((x) => x.claim_id === id);
  return c?.strength ?? 0;
}

function has(core: SemanticCore, id: ClaimId): boolean {
  return core.claims.some((c) => c.claim_id === id);
}

export function extractNarrativeScalarsFromSemanticCore(core: SemanticCore): {
  primaryElement: 'fire' | 'earth' | 'air' | 'water';
  secondaryElement?: 'fire' | 'earth' | 'air' | 'water';
  modalityBalance: { cardinal: number; fixed: number; mutable: number };
  tensionIndex: number;
  resolutionIndex: number;
  tonalPolarity: 'bright' | 'balanced' | 'dark';
} {
  let primaryElement: PrimaryElement = 'fire';
  if (has(core, 'ELEMENT_FIRE_DOM')) primaryElement = 'fire';
  else if (has(core, 'ELEMENT_EARTH_DOM')) primaryElement = 'earth';
  else if (has(core, 'ELEMENT_AIR_DOM')) primaryElement = 'air';
  else if (has(core, 'ELEMENT_WATER_DOM')) primaryElement = 'water';

  let secondaryElement: PrimaryElement | undefined;
  if (has(core, 'ELEMENT_SECONDARY_FIRE')) secondaryElement = 'fire';
  else if (has(core, 'ELEMENT_SECONDARY_EARTH')) secondaryElement = 'earth';
  else if (has(core, 'ELEMENT_SECONDARY_AIR')) secondaryElement = 'air';
  else if (has(core, 'ELEMENT_SECONDARY_WATER')) secondaryElement = 'water';

  const modalityBalance = {
    cardinal: claimStrength(core, 'MODALITY_CARDINAL'),
    fixed: claimStrength(core, 'MODALITY_FIXED'),
    mutable: claimStrength(core, 'MODALITY_MUTABLE'),
  };
  const sum = modalityBalance.cardinal + modalityBalance.fixed + modalityBalance.mutable || 1;
  modalityBalance.cardinal /= sum;
  modalityBalance.fixed /= sum;
  modalityBalance.mutable /= sum;

  let tensionIndex = 0.5;
  if (has(core, 'TENSION_BAND_HIGH')) tensionIndex = claimStrength(core, 'TENSION_BAND_HIGH') || 0.75;
  else if (has(core, 'TENSION_BAND_MED')) tensionIndex = claimStrength(core, 'TENSION_BAND_MED') || 0.5;
  else if (has(core, 'TENSION_BAND_LOW')) tensionIndex = claimStrength(core, 'TENSION_BAND_LOW') || 0.25;

  let resolutionIndex = 0.5;
  if (has(core, 'RESOLUTION_STRONG')) resolutionIndex = claimStrength(core, 'RESOLUTION_STRONG') || 0.7;
  else if (has(core, 'RESOLUTION_MODERATE')) resolutionIndex = claimStrength(core, 'RESOLUTION_MODERATE') || 0.5;
  else if (has(core, 'RESOLUTION_SOFT')) resolutionIndex = claimStrength(core, 'RESOLUTION_SOFT') || 0.35;

  let tonalPolarity: TonalPolarity = 'balanced';
  if (has(core, 'TONAL_BRIGHT')) tonalPolarity = 'bright';
  else if (has(core, 'TONAL_DARK')) tonalPolarity = 'dark';

  return {
    primaryElement,
    secondaryElement,
    modalityBalance,
    tensionIndex,
    resolutionIndex,
    tonalPolarity,
  };
}

export function deriveCrossSurfaceToneHintsFromSemanticCore(core: SemanticCore): CrossSurfaceToneHints {
  const tb = core.audio.tension_bias;
  const tension =
    tb === 'AUDIO_TENSION_HIGH' ? 'high' : tb === 'AUDIO_TENSION_LOW' ? 'low' : 'medium';
  const bright = core.text.forbidden_tone_flags.includes('TONE_AVOID_SHADOW');
  return {
    text: {
      emphasizeTension: tension,
      avoidShadowLanguage: bright,
      emphasizeRelationalMirroring: core.text.forbidden_tone_flags.includes('TONE_EMPHASIZE_MIRROR'),
      emphasizeWaterLanguage: core.text.forbidden_tone_flags.includes('TONE_EMPHASIZE_WATER'),
    },
    audio: {
      harmonicTension: tension,
      avoidDarkDefaults: bright,
      preferFluidTextures: core.audio.relational_texture === 'REL_TEXTURE_FLUID',
      preferCallAndResponse: core.audio.relational_texture === 'REL_TEXTURE_CALL_RESPONSE',
    },
  };
}

/** Narrative staging from SemanticCore claims only (no snapshot / featureVec / guidance side channels). */
export interface StelliumNarrativeSig {
  hasCluster: boolean;
  strength: number;
  element?: PrimaryElement;
}

export interface AngularNarrativeSig {
  first: boolean;
  fourth: boolean;
  seventh: boolean;
  tenth: boolean;
}

export interface AspectNarrativeSig {
  trineHeavy: boolean;
  squareHeavy: boolean;
  oppositionHeavy: boolean;
}

export type LuminaryNarrativeSig = 'sun' | 'moon' | 'balanced';

export function extractMotionScalarFromSemanticCore(core: SemanticCore): number {
  if (has(core, 'MOTION_LABEL_SURGING')) return 0.88;
  if (has(core, 'MOTION_LABEL_RESTLESS')) return 0.72;
  if (has(core, 'MOTION_LABEL_QUIET_FLOW')) return 0.52;
  if (has(core, 'MOTION_LABEL_INWARD')) return 0.38;
  if (has(core, 'MOTION_LABEL_STEADY')) return 0.5;
  return 0.5;
}

export function extractGravityScalarFromSemanticCore(core: SemanticCore): number {
  if (has(core, 'GRAVITY_LABEL_ANCHORED')) return 0.78;
  if (has(core, 'GRAVITY_LABEL_WEIGHTED_SPARK')) return 0.55;
  if (has(core, 'GRAVITY_LABEL_FLOATING')) return 0.35;
  if (has(core, 'GRAVITY_LABEL_LIGHT')) return 0.25;
  if (has(core, 'GRAVITY_LABEL_BALANCED')) return 0.45;
  return 0.45;
}

export function extractStelliumNarrativeFromSemanticCore(
  core: SemanticCore,
  primaryElement: PrimaryElement
): StelliumNarrativeSig | undefined {
  if (!has(core, 'STRUCT_STELLIUM')) return undefined;
  return {
    hasCluster: true,
    strength: claimStrength(core, 'STRUCT_STELLIUM'),
    element: primaryElement,
  };
}

export function extractAngularNarrativeFromSemanticCore(core: SemanticCore): AngularNarrativeSig | undefined {
  const first = has(core, 'STRUCT_ANGULAR_FIRST');
  const fourth = has(core, 'STRUCT_ANGULAR_FOURTH');
  const seventh = has(core, 'STRUCT_ANGULAR_SEVENTH');
  const tenth = has(core, 'STRUCT_ANGULAR_TENTH');
  if (!first && !fourth && !seventh && !tenth) return undefined;
  return { first, fourth, seventh, tenth };
}

export function extractLuminaryNarrativeFromSemanticCore(core: SemanticCore): LuminaryNarrativeSig {
  if (has(core, 'STRUCT_LUMINARY_SUN')) return 'sun';
  if (has(core, 'STRUCT_LUMINARY_MOON')) return 'moon';
  return 'balanced';
}

export function extractAspectNarrativeFromSemanticCore(core: SemanticCore): AspectNarrativeSig {
  const trineHeavy = has(core, 'STRUCT_ASPECT_TRINE_HEAVY');
  const squareHeavy = has(core, 'STRUCT_ASPECT_SQUARE_HEAVY');
  const oppositionHeavy = has(core, 'STRUCT_ASPECT_OPPOSITION_HEAVY');
  if (!trineHeavy && !squareHeavy && !oppositionHeavy) {
    return { trineHeavy: false, squareHeavy: false, oppositionHeavy: false };
  }
  return { trineHeavy, squareHeavy, oppositionHeavy };
}
