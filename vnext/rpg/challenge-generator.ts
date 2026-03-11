import type { EphemerisSnapshot } from '../contracts';
import type { ChartSemanticProfile } from '../interpretation/chart-semantic-profile';
import type { CampaignIdentityTone } from './semantic-adapter';
import { deriveCampaignIdentityTone } from './semantic-adapter';
import type {
  CampaignState,
  CharacterProfile,
  ChoiceOption,
  ChallengeScene,
  TransitPressure,
} from './types';

function pickPrimaryPressure(pressures: TransitPressure[]): TransitPressure | null {
  if (!pressures.length) return null;
  const sorted = [...pressures].sort((a, b) => {
    if (b.intensity !== a.intensity) return b.intensity - a.intensity;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.domain.localeCompare(b.domain);
  });
  return sorted[0];
}

function supportPressures(pressures: TransitPressure[], primary: TransitPressure): TransitPressure[] {
  return pressures
    .filter((p) => p.id !== primary.id)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 3);
}

function sceneThemeFromPressure(
  pressure: TransitPressure,
  character: CharacterProfile
): string {
  const base = pressure.lifeArea === 'relationships'
    ? 'Relational tension'
    : pressure.lifeArea === 'work_public'
      ? 'Public pressure'
      : pressure.lifeArea === 'home_foundations'
        ? 'Foundations in flux'
        : pressure.lifeArea === 'health_body'
          ? 'Energy and body signals'
          : 'Inner weather turning';

  if (pressure.type === 'revelation') {
    return `${base}: something important comes into focus`;
  }
  if (pressure.type === 'constraint') {
    return `${base}: running into a real limit`;
  }
  if (pressure.type === 'conflict') {
    return `${base}: friction that asks for honesty`;
  }
  if (pressure.type === 'release') {
    return `${base}: time to lay something down`;
  }
  if (pressure.type === 'restructuring') {
    return `${base}: structures are ready to be redesigned`;
  }
  if (pressure.type === 'endurance') {
    return `${base}: staying with a long process`;
  }
  if (pressure.type === 'confusion') {
    return `${base}: unclear signals and mixed feelings`;
  }

  const tone = character.temperament.courage >= 0.7 ? 'taking a courageous next step' : 'finding a sustainable next step';
  return `${base}: ${tone}`;
}

function sceneSettingFromTone(
  tone: CampaignIdentityTone,
  pressure: TransitPressure
): string {
  const base =
    tone.settingEmphasis === 'relationships'
      ? 'a conversation space where dynamics are visible'
      : tone.settingEmphasis === 'work_public'
        ? 'a work or visibility setting where your role is on display'
        : tone.settingEmphasis === 'home_foundations'
          ? 'a private setting that holds your foundations and routines'
          : 'an inner landscape where feelings and intuitions surface first';

  if (pressure.lifeArea === 'health_body') {
    return 'a moment where your body and energy levels are clearly giving feedback';
  }

  if (tone.narrativeMood === 'somber') {
    return `${base}, with a heavier, more serious tone today`;
  }
  if (tone.narrativeMood === 'bright') {
    return `${base}, with light available even as tension shows up`;
  }
  return base;
}

function sceneObstacle(
  pressure: TransitPressure,
  character: CharacterProfile
): string {
  const leaning =
    character.temperament.shadowCapacity >= 0.7
      ? 'old coping patterns feel strong'
      : 'habits are present but more workable today';

  return `A live situation in the ${pressure.lifeArea} area carries ${pressure.type} pressure. ${leaning}, and your chart emphasizes ${pressure.domain} as a repeating learning field.`;
}

function baseChoices(patternBias: 'reflective' | 'decisive' | 'mixed'): ChoiceOption[] {
  const common: ChoiceOption[] = [
    {
      id: 'pause_observe',
      label: 'Pause and observe',
      symbolicGesture: 'step back enough to feel and name what is actually happening before acting',
      patternTag: 'pause_observe',
    },
    {
      id: 'name_truth',
      label: 'Name the truth directly',
      symbolicGesture: 'speak one honest sentence about what is real for you',
      patternTag: 'name_truth',
    },
    {
      id: 'seek_counsel',
      label: 'Seek counsel',
      symbolicGesture: 'bring the situation to someone you trust for reflection',
      patternTag: 'seek_counsel',
    },
    {
      id: 'draw_boundary',
      label: 'Draw a boundary',
      symbolicGesture: 'clarify what you can and cannot carry right now',
      patternTag: 'draw_boundary',
    },
    {
      id: 'make_offering',
      label: 'Make an offering',
      symbolicGesture: 'offer time, attention, or a small concrete gesture aligned with your values',
      patternTag: 'make_offering',
    },
  ];

  const forward: ChoiceOption = {
    id: 'push_forward',
    label: 'Push forward with intention',
    symbolicGesture: 'take a deliberate, bounded action even if conditions are imperfect',
    patternTag: 'push_forward',
  };

  const delay: ChoiceOption = {
    id: 'delay_action',
    label: 'Delay action on purpose',
    symbolicGesture: 'consciously schedule a later moment to revisit instead of drifting away',
    patternTag: 'delay_action',
  };

  if (patternBias === 'decisive') {
    return [forward, common[1], common[3], common[4], common[0]];
  }
  if (patternBias === 'reflective') {
    return [common[0], delay, common[2], common[1], common[4]];
  }
  return [common[0], common[1], common[2], forward, delay];
}

export interface BuildChallengeParams {
  character: CharacterProfile;
  pressures: TransitPressure[];
  state: CampaignState;
  semanticProfile: ChartSemanticProfile;
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
}

export function buildChallengeScene(params: BuildChallengeParams): ChallengeScene | null {
  const { character, pressures, state, semanticProfile } = params;
  if (!pressures.length) return null;

  const tone = deriveCampaignIdentityTone(semanticProfile);
  const primary = pickPrimaryPressure(pressures);
  if (!primary) return null;

  const supporting = supportPressures(pressures, primary);
  const theme = sceneThemeFromPressure(primary, character);
  const setting = sceneSettingFromTone(tone, primary);
  const obstacle = sceneObstacle(primary, character);

  const choices = baseChoices(tone.actionBias);

  const id = [
    'scene',
    primary.type,
    primary.lifeArea,
    character.primaryElement,
    String(state.chapter ?? 1),
  ].join(':');

  return {
    id,
    theme,
    setting,
    obstacle,
    primaryPressure: primary,
    supportingPressures: supporting,
    choices,
  };
}

