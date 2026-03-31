// vnext/rpg/challenge-generator.ts
// Pass 3 — Deterministic challenge generation. No randomness; all ordering explicit.
// Same (state, transit, character, pressures) → same ChallengeScene every time.
//
// Versioning: Determinism is bound to the checked-in generator implementation and the
// campaign versioned state path (rpg_map_version, rpg_algo_version). There is no
// separately passed generator version parameter; behavior is fixed by code path.
//
// Phase C containment: astrological wording for theme comes only from TextProjection(SemanticCore).
// Pressure/type strings are game-layer mechanics, not a second interpreter.

import type { EphemerisSnapshot } from '../contracts';
import type { SemanticCore } from '../semantic/semantic-core';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { hashSnapshot } from './hash/snapshot-hash';
import type { CampaignIdentityTone } from './semantic-adapter';
import { deriveCampaignIdentityToneFromSemanticCore } from './identity-from-semantic-core';
import type {
  CampaignState,
  CharacterProfile,
  ChoiceOption,
  ChallengeScene,
  TransitPressure,
} from './types';

/** Deterministic: sort by intensity DESC, then type ASC, then domain ASC. Tie-breaks ensure stable primary. */
function pickPrimaryPressure(pressures: TransitPressure[]): TransitPressure | null {
  if (!pressures.length) return null;
  const sorted = [...pressures].sort((a, b) => {
    if (b.intensity !== a.intensity) return b.intensity - a.intensity;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.domain.localeCompare(b.domain);
  });
  return sorted[0];
}

/** Deterministic: exclude primary, sort by intensity DESC, take first 3. */
function supportPressures(pressures: TransitPressure[], primary: TransitPressure): TransitPressure[] {
  return pressures
    .filter((p) => p.id !== primary.id)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 3);
}

/** Primary reading line from canonical semantic pipeline only (Phase D campaign surface). */
function semanticReadingLine(core: SemanticCore, seed: string): string {
  const sections = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'campaign',
    tier: 'baseline',
    narrativePlan: null,
    aspectTension: null,
  });
  const sig = sections.find((s) => s.id === 'signatures' || s.id === 'sky_summary');
  return (sig?.text ?? sections[0]?.text ?? '').trim();
}

function challengeThemeFromSemantic(
  core: SemanticCore,
  natalSnapshot: EphemerisSnapshot,
  pressure: TransitPressure,
  challengeContext?: BuildChallengeParams['challengeContext']
): string {
  const line = semanticReadingLine(core, hashSnapshot(natalSnapshot));
  const context = `${pressure.transitBody} contacting ${pressure.natalBody} in house ${pressure.natalHouse} concentrates ${pressure.pressureFamily} around ${pressure.domain}`;
  const intensity = challengeContext?.intensityBand ? ` at ${challengeContext.intensityBand} intensity` : '';
  return line.length > 0
    ? `${line} Today, ${context}${intensity}.`
    : `focus:${pressure.domain}:${pressure.transitBody}:${pressure.natalBody}:${pressure.type}`;
}

function sceneSettingFromTone(
  tone: CampaignIdentityTone,
  pressure: TransitPressure
): string {
  const byDomain: Record<string, string> = {
    self: 'a moment where your sense of self, pacing, or direction becomes hard to ignore',
    assets: 'a practical setting where value, resources, or steadiness are in view',
    communication: 'a conversational setting where wording, timing, or signal matters',
    home: 'a private setting that holds your foundations, home life, or roots',
    creativity: 'a space of expression, desire, play, or vulnerable creation',
    work: 'a work setting where labor, responsibility, or systems are visible',
    partnership: 'a relational setting where expectations and reciprocity are exposed',
    transformation: 'a threshold setting where trust, exchange, or deeper stakes are active',
    belief: 'a horizon-facing setting where meaning, direction, or worldview is being tested',
    career: 'a public setting where role, reputation, or visible responsibility is on display',
    community: 'a group setting where belonging, contribution, or social position is in motion',
    subconscious: 'an inner setting where hidden feelings, fatigue, or intuition surface first',
  };
  const base =
    byDomain[pressure.domain] ??
    (tone.settingEmphasis === 'relationships'
      ? 'a conversation space where dynamics are visible'
      : tone.settingEmphasis === 'work_public'
        ? 'a work or visibility setting where your role is on display'
        : tone.settingEmphasis === 'home_foundations'
          ? 'a private setting that holds your foundations and routines'
          : 'an inner landscape where feelings and intuitions surface first');

  if (tone.narrativeMood === 'somber') {
    return `${base}, with a heavier, more serious tone today`;
  }
  if (tone.narrativeMood === 'bright') {
    return `${base}, with light available even as tension shows up`;
  }
  return base;
}

/** Game-layer obstacle copy only (no chart interpretation beyond SemanticCore-backed theme). */
function sceneObstacleGame(pressure: TransitPressure, character: CharacterProfile): string {
  const leaning =
    character.temperament.shadowCapacity >= 0.7
      ? 'old coping patterns feel strong'
      : 'habits are present but more workable today';
  return `${pressure.transitBody} presses on ${pressure.natalBody} through a ${pressure.aspectType} in house ${pressure.natalHouse}, concentrating ${pressure.pressureFamily} pressure in ${pressure.domain}. ${leaning}.`;
}

function baseChoices(
  patternBias: 'reflective' | 'decisive' | 'mixed',
  pressure: TransitPressure,
  challengeContext?: BuildChallengeParams['challengeContext']
): ChoiceOption[] {
  const common: ChoiceOption[] = [
    {
      id: 'pause_observe',
      label: 'Pause and observe',
      symbolicGesture: 'step back enough to feel and name what is actually happening before acting',
      patternTag: 'pause_observe',
      posture: 'observe',
      modality: 'reflective',
      riskProfile: 'low immediate risk, but may preserve ambiguity longer',
      outcomeDirection: 'observe_hold',
    },
    {
      id: 'name_truth',
      label: 'Name the truth directly',
      symbolicGesture: 'speak one honest sentence about what is real for you',
      patternTag: 'name_truth',
      posture: 'assert',
      modality: 'direct',
      riskProfile: 'raises clarity quickly, with some exposure or friction',
      outcomeDirection: 'assert_define',
    },
    {
      id: 'seek_counsel',
      label: 'Seek counsel',
      symbolicGesture: 'bring the situation to someone you trust for reflection',
      patternTag: 'seek_counsel',
      posture: 'support',
      modality: 'relational',
      riskProfile: 'builds perspective and connection, but slows solitary momentum',
      outcomeDirection: 'support_connect',
    },
    {
      id: 'draw_boundary',
      label: 'Draw a boundary',
      symbolicGesture: 'clarify what you can and cannot carry right now',
      patternTag: 'draw_boundary',
      posture: 'contain',
      modality: 'bounded',
      riskProfile: 'protects capacity, but can harden distance if poorly timed',
      outcomeDirection: 'contain_limit',
    },
    {
      id: 'make_offering',
      label: 'Make an offering',
      symbolicGesture: 'offer time, attention, or a small concrete gesture aligned with your values',
      patternTag: 'make_offering',
      posture: 'offer',
      modality: 'restorative',
      riskProfile: 'supports repair and reciprocity, but can overextend if misread',
      outcomeDirection: 'offer_restore',
    },
  ];

  const forward: ChoiceOption = {
    id: 'push_forward',
    label: 'Push forward with intention',
    symbolicGesture: 'take a deliberate, bounded action even if conditions are imperfect',
    patternTag: 'push_forward',
    posture: 'engage',
    modality: 'decisive',
    riskProfile: 'creates momentum quickly, but can amplify strain if conditions are unstable',
    outcomeDirection: 'engage_advance',
  };

  const delay: ChoiceOption = {
    id: 'delay_action',
    label: 'Delay action on purpose',
    symbolicGesture: 'consciously schedule a later moment to revisit instead of drifting away',
    patternTag: 'delay_action',
    posture: 'withdraw',
    modality: 'protective',
    riskProfile: 'reduces immediate exposure, but can prolong uncertainty if overused',
    outcomeDirection: 'withdraw_protect',
  };

  const reframe: ChoiceOption = {
    id: 'reframe_pattern',
    label: 'Reframe the pattern',
    symbolicGesture: 'name a different interpretation that changes how you meet the moment',
    patternTag: 'reframe_pattern',
    posture: 'reframe',
    modality: 'interpretive',
    riskProfile: 'supports integration and flexibility, but may under-act if used to avoid contact',
    outcomeDirection: 'reframe_integrate',
  };

  if (pressure.domain === 'partnership' || pressure.domain === 'community') {
    return [common[0], common[1], common[2], common[3], common[4]];
  }
  if (pressure.domain === 'career' || pressure.domain === 'work') {
    return [forward, common[1], common[0], reframe, common[3]];
  }
  if (pressure.domain === 'subconscious' || pressure.domain === 'transformation') {
    return [common[0], delay, reframe, common[3], common[2]];
  }
  if (challengeContext?.interactionType === 'cross_pressuring') {
    return [common[0], reframe, common[1], common[3], delay];
  }
  if (patternBias === 'decisive') {
    return [forward, common[1], common[3], common[4], common[0]];
  }
  if (patternBias === 'reflective') {
    return [common[0], delay, common[2], reframe, common[4]];
  }
  return [common[0], common[1], common[2], forward, reframe];
}

/**
 * Inputs for deterministic challenge generation. No randomness is used.
 * All arrays (pressures, state.flags) are assumed to be in deterministic order
 * (pressures from Phase 1 resolver / legacy bridge or legacy map in tests only; state from campaign state machine).
 */
export interface BuildChallengeParams {
  character: CharacterProfile;
  pressures: TransitPressure[];
  state: CampaignState;
  semanticCore: SemanticCore;
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
  challengeContext?: {
    archetypeCategory?: string;
    interactionType?: string;
    intensityBand?: string;
  };
}

/**
 * Builds a single ChallengeScene from deterministic inputs.
 * Idempotent: same params → same scene (id, theme, setting, obstacle, choices).
 * Scene id includes transit ts + chapter + primary pressure signature for uniqueness.
 *
 * Zero-pressure rule: Returns null when there are no campaign-relevant pressures;
 * no fallback scene is synthesized. Callers must handle null (e.g. skip or retry with different transit).
 *
 * transitSnapshot.ts: Used as-provided in the scene id. Stability is the caller's responsibility:
 * same (state, transit snapshot, character) must be passed for idempotent scene identity.
 */
export function buildChallengeScene(params: BuildChallengeParams): ChallengeScene | null {
  const { character, pressures, state, semanticCore, transitSnapshot, natalSnapshot, challengeContext } = params;
  if (!pressures.length) return null;

  const tone = deriveCampaignIdentityToneFromSemanticCore(semanticCore);
  const primary = pickPrimaryPressure(pressures);
  if (!primary) return null;

  const supporting = supportPressures(pressures, primary);
  const theme = challengeThemeFromSemantic(semanticCore, natalSnapshot, primary, challengeContext);
  const setting = sceneSettingFromTone(tone, primary);
  const obstacle = sceneObstacleGame(primary, character);

  const choices = baseChoices(tone.actionBias, primary, challengeContext);

  const transitKey = transitSnapshot?.ts ?? '';
  const id = [
    'scene',
    transitKey,
    String(state.chapter ?? 1),
    primary.type,
    primary.lifeArea,
    character.primaryElement,
  ].join(':');

  return {
    id,
    archetypeCategory: challengeContext?.archetypeCategory,
    theme,
    setting,
    obstacle,
    primaryPressure: primary,
    supportingPressures: supporting,
    choices,
  };
}

