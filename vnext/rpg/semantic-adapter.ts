import type { ChartSemanticProfile } from '../interpretation/chart-semantic-profile';

export interface CampaignIdentityTone {
  /** Broad temperament descriptor for copy (“steady”, “volatile”, etc.). */
  temperamentFlavor: 'steady' | 'volatile' | 'sensitive' | 'driven' | 'adaptive';
  /** High-level mood descriptor for scene framing. */
  narrativeMood: 'bright' | 'balanced' | 'somber';
  /** Symbolic setting emphasis for solo challenges. */
  settingEmphasis: 'inner_world' | 'relationships' | 'work_public' | 'home_foundations';
  /** Whether to prefer reflective vs. action-forward framing. */
  actionBias: 'reflective' | 'decisive' | 'mixed';
}

export function deriveCampaignIdentityTone(
  profile: ChartSemanticProfile
): CampaignIdentityTone {
  const { primaryElement, tonalPolarity, motionProfile, angularEmphasis, tensionIndex } =
    profile;

  let temperamentFlavor: CampaignIdentityTone['temperamentFlavor'] = 'steady';
  if (primaryElement === 'fire') temperamentFlavor = 'driven';
  else if (primaryElement === 'water') temperamentFlavor = 'sensitive';
  else if (primaryElement === 'air') temperamentFlavor = 'adaptive';
  else if (primaryElement === 'earth') temperamentFlavor = 'steady';

  if (tensionIndex >= 0.75 && motionProfile === 'surging') {
    temperamentFlavor = 'volatile';
  }

  const narrativeMood: CampaignIdentityTone['narrativeMood'] = tonalPolarity === 'dark'
    ? 'somber'
    : tonalPolarity === 'bright'
      ? 'bright'
      : 'balanced';

  let settingEmphasis: CampaignIdentityTone['settingEmphasis'] = 'inner_world';
  if (angularEmphasis.seventh) settingEmphasis = 'relationships';
  else if (angularEmphasis.tenth) settingEmphasis = 'work_public';
  else if (angularEmphasis.fourth) settingEmphasis = 'home_foundations';

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

