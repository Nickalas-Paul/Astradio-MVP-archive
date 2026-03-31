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
  ArchetypeId,
  CampaignState,
  CharacterProfile,
  ChoiceOption,
  ChallengeScene,
  NatalBodyModifier,
  OutcomeDirection,
  ResponseModality,
  ResponsePosture,
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
  const nuance = challengeContext?.natalBodyModifier ? ` through a ${challengeContext.natalBodyModifier} natal emphasis` : '';
  const refinement = challengeContext?.mechanicTags && challengeContext.mechanicTags.length > 0
    ? ` [${challengeContext.mechanicTags.slice(0, 2).join(', ')}]`
    : '';
  const intensity = challengeContext?.intensityBand ? ` at ${challengeContext.intensityBand} intensity` : '';
  return line.length > 0
    ? `${line} Today, ${context}${nuance}${intensity}.${refinement}`
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

const BASE_POSTURE_SLATES: Record<ArchetypeId, ResponsePosture[]> = {
  identity_test: ['observe', 'assert', 'reframe', 'contain'],
  identity_definition: ['assert', 'engage', 'observe', 'reframe'],
  resource_strain: ['observe', 'contain', 'withdraw', 'assert'],
  resource_opportunity: ['engage', 'assert', 'offer', 'observe'],
  signal_friction: ['observe', 'assert', 'reframe', 'withdraw'],
  signal_reframe: ['observe', 'reframe', 'support', 'contain'],
  foundation_pressure: ['contain', 'withdraw', 'observe', 'support'],
  foundation_repair: ['support', 'offer', 'observe', 'reframe'],
  creative_risk: ['engage', 'assert', 'observe', 'reframe'],
  creative_devotion: ['offer', 'engage', 'observe', 'contain'],
  duty_pressure: ['contain', 'assert', 'engage', 'observe'],
  duty_alignment: ['engage', 'reframe', 'assert', 'contain'],
  bond_friction: ['observe', 'assert', 'support', 'contain'],
  bond_repair: ['support', 'offer', 'observe', 'reframe'],
  threshold_reckoning: ['observe', 'withdraw', 'contain', 'reframe'],
  horizon_reorientation: ['reframe', 'observe', 'engage', 'support'],
};

const POSTURE_PRIORITY: ResponsePosture[] = ['observe', 'assert', 'engage', 'withdraw', 'support', 'offer', 'reframe', 'contain'];

function postureOutcomeDirection(posture: ResponsePosture): OutcomeDirection {
  switch (posture) {
    case 'observe':
      return 'observe_hold';
    case 'assert':
      return 'assert_define';
    case 'engage':
      return 'engage_advance';
    case 'withdraw':
      return 'withdraw_protect';
    case 'support':
      return 'support_connect';
    case 'offer':
      return 'offer_restore';
    case 'reframe':
      return 'reframe_integrate';
    case 'contain':
      return 'contain_limit';
  }
}

function posturePatternTag(posture: ResponsePosture): string {
  switch (posture) {
    case 'observe':
      return 'pause_observe';
    case 'assert':
      return 'name_truth';
    case 'engage':
      return 'push_forward';
    case 'withdraw':
      return 'delay_action';
    case 'support':
      return 'seek_counsel';
    case 'offer':
      return 'make_offering';
    case 'reframe':
      return 'reframe_pattern';
    case 'contain':
      return 'draw_boundary';
  }
}

function postureLabel(posture: ResponsePosture): string {
  switch (posture) {
    case 'observe':
      return 'Pause and observe';
    case 'assert':
      return 'Name the truth directly';
    case 'engage':
      return 'Push forward with intention';
    case 'withdraw':
      return 'Delay action on purpose';
    case 'support':
      return 'Seek counsel';
    case 'offer':
      return 'Make an offering';
    case 'reframe':
      return 'Reframe the pattern';
    case 'contain':
      return 'Draw a boundary';
  }
}

function postureGesture(posture: ResponsePosture): string {
  switch (posture) {
    case 'observe':
      return 'step back enough to feel and name what is actually happening before acting';
    case 'assert':
      return 'speak one honest sentence about what is real for you';
    case 'engage':
      return 'take a deliberate, bounded action even if conditions are imperfect';
    case 'withdraw':
      return 'consciously schedule a later moment to revisit instead of drifting away';
    case 'support':
      return 'bring the situation to someone you trust for reflection';
    case 'offer':
      return 'offer time, attention, or a small concrete gesture aligned with your values';
    case 'reframe':
      return 'name a different interpretation that changes how you meet the moment';
    case 'contain':
      return 'clarify what you can and cannot carry right now';
  }
}

function postureModality(posture: ResponsePosture): ResponseModality {
  switch (posture) {
    case 'observe':
      return 'reflective';
    case 'assert':
      return 'direct';
    case 'engage':
      return 'decisive';
    case 'withdraw':
      return 'protective';
    case 'support':
      return 'relational';
    case 'offer':
      return 'restorative';
    case 'reframe':
      return 'interpretive';
    case 'contain':
      return 'bounded';
  }
}

function postureRiskProfile(posture: ResponsePosture): string {
  switch (posture) {
    case 'observe':
      return 'low immediate risk, but may preserve ambiguity longer';
    case 'assert':
      return 'raises clarity quickly, with some exposure or friction';
    case 'engage':
      return 'creates momentum quickly, but can amplify strain if conditions are unstable';
    case 'withdraw':
      return 'reduces immediate exposure, but can prolong uncertainty if overused';
    case 'support':
      return 'builds perspective and connection, but slows solitary momentum';
    case 'offer':
      return 'supports repair and reciprocity, but can overextend if misread';
    case 'reframe':
      return 'supports integration and flexibility, but may under-act if used to avoid contact';
    case 'contain':
      return 'protects capacity, but can harden distance if poorly timed';
  }
}

function addFifthPosture(
  slate: ResponsePosture[],
  polarity: BuildChallengeParams['challengeContext']['pressurePolarity'],
  intensityBand: BuildChallengeParams['challengeContext']['intensityBand'],
): ResponsePosture[] {
  const out = [...slate];
  const tryAdd = (posture: ResponsePosture) => {
    if (!out.includes(posture)) out.push(posture);
  };

  if (polarity === 'constructive') {
    tryAdd('engage');
    if (out.length === slate.length) tryAdd('offer');
  } else if (polarity === 'frictional') {
    tryAdd('contain');
    if (out.length === slate.length) tryAdd('assert');
  } else if (polarity === 'volatile') {
    tryAdd('withdraw');
    if (out.length === slate.length) tryAdd('contain');
  } else if (polarity === 'binding') {
    tryAdd('observe');
    if (out.length === slate.length) tryAdd('support');
  }

  if (intensityBand === 'critical' && out.length > slate.length && out[out.length - 1] === 'engage' && !slate.includes('engage')) {
    out.pop();
    if (!out.includes('contain')) out.push('contain');
    else if (!out.includes('observe')) out.push('observe');
  }

  return out;
}

function replaceLowestPriority(
  slate: ResponsePosture[],
  priorityOrder: ResponsePosture[],
  required: ResponsePosture,
): ResponsePosture[] {
  if (slate.includes(required)) return slate;
  const replacementIndex = [...slate]
    .map((posture, index) => ({ posture, index }))
    .sort(
      (a, b) =>
        priorityOrder.indexOf(b.posture) - priorityOrder.indexOf(a.posture) ||
        POSTURE_PRIORITY.indexOf(b.posture) - POSTURE_PRIORITY.indexOf(a.posture) ||
        b.index - a.index,
    )[0]?.index;
  if (typeof replacementIndex !== 'number') return slate;
  const next = [...slate];
  next[replacementIndex] = required;
  return Array.from(new Set(next));
}

function enforceDomainConstraints(
  slate: ResponsePosture[],
  priorityOrder: ResponsePosture[],
  domain: string,
): ResponsePosture[] {
  let next = [...slate];
  if (domain === 'partnership' || domain === 'community') {
    if (!next.includes('support') && !next.includes('offer')) {
      next = replaceLowestPriority(next, priorityOrder, 'support');
    }
  } else if (domain === 'career' || domain === 'work') {
    if (!next.includes('assert') && !next.includes('engage') && !next.includes('contain')) {
      next = replaceLowestPriority(next, priorityOrder, 'contain');
    }
  } else if (domain === 'subconscious' || domain === 'transformation' || domain === 'home') {
    if (!next.includes('observe') && !next.includes('withdraw') && !next.includes('contain') && !next.includes('reframe')) {
      next = replaceLowestPriority(next, priorityOrder, 'observe');
    }
  }
  return next;
}

function buildChoice(posture: ResponsePosture): ChoiceOption {
  return {
    id: posturePatternTag(posture),
    label: postureLabel(posture),
    symbolicGesture: postureGesture(posture),
    patternTag: posturePatternTag(posture),
    posture,
    modality: postureModality(posture),
    riskProfile: postureRiskProfile(posture),
    outcomeDirection: postureOutcomeDirection(posture),
  };
}

function baseChoices(
  pressure: TransitPressure,
  challengeContext?: BuildChallengeParams['challengeContext']
): ChoiceOption[] {
  const archetypeId = challengeContext?.archetypeId ?? 'identity_test';
  const baseSlate = [...(BASE_POSTURE_SLATES[archetypeId] ?? BASE_POSTURE_SLATES.identity_test)];
  let slate = addFifthPosture(baseSlate, challengeContext?.pressurePolarity, challengeContext?.intensityBand);
  slate = enforceDomainConstraints(slate, slate, pressure.domain);
  slate = Array.from(new Set(slate));
  return slate.slice(0, 5).map(buildChoice);
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
    archetypeId?: ArchetypeId;
    interactionType?: string;
    intensityBand?: TransitPressure['intensityBand'];
    pressurePolarity?: 'constructive' | 'frictional' | 'volatile' | 'binding';
    primaryDomain?: string;
    natalBodyModifier?: NatalBodyModifier;
    mechanicTags?: string[];
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

  const choices = baseChoices(primary, challengeContext);

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
    archetypeId: challengeContext?.archetypeId,
    theme,
    setting,
    obstacle,
    primaryPressure: primary,
    supportingPressures: supporting,
    choices,
  };
}

