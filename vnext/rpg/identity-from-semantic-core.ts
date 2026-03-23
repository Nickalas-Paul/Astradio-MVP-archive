/**
 * Deterministic RPG-facing identity slice from SemanticCore only (no parallel astrology).
 */
import type { SemanticCore } from '../semantic/semantic-core';
import type { ClaimId } from '../semantic/ontology-codes';
import { extractNarrativeScalarsFromSemanticCore } from '../projection/audio-projection';
import type { CampaignIdentityTone } from './semantic-adapter';

function has(core: SemanticCore, id: ClaimId): boolean {
  return core.claims.some((c) => c.claim_id === id);
}

function motionLabelFromCore(core: SemanticCore): string {
  if (has(core, 'MOTION_LABEL_SURGING')) return 'surging';
  if (has(core, 'MOTION_LABEL_RESTLESS')) return 'restless';
  if (has(core, 'MOTION_LABEL_QUIET_FLOW')) return 'quiet_flow';
  if (has(core, 'MOTION_LABEL_INWARD')) return 'inward_consolidation';
  return 'steady';
}

function gravityLabelFromCore(core: SemanticCore): string {
  if (has(core, 'GRAVITY_LABEL_ANCHORED')) return 'anchored';
  if (has(core, 'GRAVITY_LABEL_WEIGHTED_SPARK')) return 'weighted_with_spark';
  if (has(core, 'GRAVITY_LABEL_FLOATING')) return 'floating';
  if (has(core, 'GRAVITY_LABEL_LIGHT')) return 'light';
  return 'balanced';
}

export function deriveCampaignIdentityToneFromSemanticCore(core: SemanticCore): CampaignIdentityTone {
  const nar = extractNarrativeScalarsFromSemanticCore(core);
  const motionProfile = motionLabelFromCore(core);
  const { primaryElement, tonalPolarity, tensionIndex } = {
    primaryElement: nar.primaryElement,
    tonalPolarity: nar.tonalPolarity,
    tensionIndex: nar.tensionIndex,
  };

  let temperamentFlavor: CampaignIdentityTone['temperamentFlavor'] = 'steady';
  if (primaryElement === 'fire') temperamentFlavor = 'driven';
  else if (primaryElement === 'water') temperamentFlavor = 'sensitive';
  else if (primaryElement === 'air') temperamentFlavor = 'adaptive';
  else if (primaryElement === 'earth') temperamentFlavor = 'steady';

  if (tensionIndex >= 0.75 && motionProfile === 'surging') {
    temperamentFlavor = 'volatile';
  }

  const narrativeMood: CampaignIdentityTone['narrativeMood'] =
    tonalPolarity === 'dark' ? 'somber' : tonalPolarity === 'bright' ? 'bright' : 'balanced';

  let settingEmphasis: CampaignIdentityTone['settingEmphasis'] = 'inner_world';
  if (has(core, 'STRUCT_ANGULAR_SEVENTH')) settingEmphasis = 'relationships';
  else if (has(core, 'STRUCT_ANGULAR_TENTH')) settingEmphasis = 'work_public';
  else if (has(core, 'STRUCT_ANGULAR_FOURTH')) settingEmphasis = 'home_foundations';

  let actionBias: CampaignIdentityTone['actionBias'] = 'mixed';
  if (motionProfile === 'inward_consolidation' || motionProfile === 'quiet_flow') {
    actionBias = 'reflective';
  } else if (motionProfile === 'surging' || motionProfile === 'restless') {
    actionBias = 'decisive';
  }

  return {
    temperamentFlavor,
    narrativeMood,
    settingEmphasis,
    actionBias,
  };
}

export function chartIdentityFieldsFromSemanticCore(
  core: SemanticCore,
  dominantPlanetNames: readonly string[]
): {
  primaryElement: 'fire' | 'earth' | 'air' | 'water';
  tonalPolarity: 'bright' | 'balanced' | 'dark';
  motionProfile: string;
  gravityProfile: string;
  luminaryWeight: 'sun' | 'moon' | 'balanced';
  dominantPlanets: string[];
  angularEmphasis: {
    first: boolean;
    fourth: boolean;
    seventh: boolean;
    tenth: boolean;
  };
  tensionIndex: number;
  resolutionIndex: number;
  aspectSignature: { trineHeavy: boolean; squareHeavy: boolean; oppositionHeavy: boolean };
} {
  const nar = extractNarrativeScalarsFromSemanticCore(core);
  return {
    primaryElement: nar.primaryElement,
    tonalPolarity: nar.tonalPolarity,
    motionProfile: motionLabelFromCore(core),
    gravityProfile: gravityLabelFromCore(core),
    luminaryWeight:
      has(core, 'STRUCT_LUMINARY_SUN') ? 'sun' : has(core, 'STRUCT_LUMINARY_MOON') ? 'moon' : 'balanced',
    dominantPlanets: [...dominantPlanetNames],
    angularEmphasis: {
      first: has(core, 'STRUCT_ANGULAR_FIRST'),
      fourth: has(core, 'STRUCT_ANGULAR_FOURTH'),
      seventh: has(core, 'STRUCT_ANGULAR_SEVENTH'),
      tenth: has(core, 'STRUCT_ANGULAR_TENTH'),
    },
    tensionIndex: nar.tensionIndex,
    resolutionIndex: nar.resolutionIndex,
    aspectSignature: {
      trineHeavy: has(core, 'STRUCT_ASPECT_TRINE_HEAVY'),
      squareHeavy: has(core, 'STRUCT_ASPECT_SQUARE_HEAVY'),
      oppositionHeavy: has(core, 'STRUCT_ASPECT_OPPOSITION_HEAVY'),
    },
  };
}
