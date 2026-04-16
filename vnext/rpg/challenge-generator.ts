// vnext/rpg/challenge-generator.ts
// Pass 3 — Deterministic challenge generation. No randomness; all ordering explicit.
// Same (state, transit, character, pressures) → same ChallengeScene every time.
//
// Versioning: Determinism is bound to the checked-in generator implementation and the
// campaign versioned state path (rpg_map_version, rpg_algo_version). There is no
// separately passed generator version parameter; behavior is fixed by code path.
//
// Campaign daily theme: when `campaignDailyPressureNarration` is set (Command-Center materialization),
// the theme lead is built from DailyPressureState + PressureEvent rows, not from natal SemanticCore projection text.

import type { EphemerisSnapshot } from '../contracts';
import type { SemanticCore } from '../semantic/semantic-core';
import type { CampaignExpressionDigest } from '../projection/projection-types';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { hashSnapshot } from './hash/snapshot-hash';
import type { CampaignIdentityTone } from './semantic-adapter';
import { deriveCampaignIdentityToneFromSemanticCore } from './identity-from-semantic-core';
import {
  aspectPressure,
  compactText,
  continuityLines,
  domainContext,
  domainLabel,
  dominantToneKey,
  houseLanguage,
  intensityQualifier,
  intensityUrgency,
  modifierLanguage,
  outcomeSentence,
  polarityImplication,
  polarityTone,
  polarityTradeoff,
  stableVariant,
} from './projection-language';
import type { CampaignSlateContinuity } from '../campaign/campaign-slate-continuity';
import type { CampaignDailyPressureNarration } from '../campaign/campaign-daily-theme-lead';
import { buildCampaignDailyThemeLead } from '../campaign/campaign-daily-theme-lead';

export type { CampaignDailyPressureNarration } from '../campaign/campaign-daily-theme-lead';
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

/** Identity slugs for Campaign response slate shaping (natal-derived, deterministic). */
export type CampaignIdentitySlugs = {
  class_slug: string;
  subclass_slug: string;
  rising_modifier_slug: string;
};

type ChallengeContext = {
  archetypeCategory?: string;
  archetypeId?: ArchetypeId;
  interactionType?: string;
  intensityBand?: TransitPressure['intensityBand'];
  pressurePolarity?: 'constructive' | 'frictional' | 'volatile' | 'binding';
  primaryDomain?: string;
  natalBodyModifier?: NatalBodyModifier;
  supportingNatalBodyModifiers?: NatalBodyModifier[];
  mechanicTags?: string[];
};

function supportingBiasPostures(
  pressures: TransitPressure[],
  natalBodyModifiers: NatalBodyModifier[] = [],
): ResponsePosture[] {
  const score = new Map<ResponsePosture, number>();
  const bump = (posture: ResponsePosture, amount: number) => {
    score.set(posture, (score.get(posture) ?? 0) + amount);
  };

  for (let index = 0; index < pressures.length; index++) {
    const pressure = pressures[index]!;
    const weight =
      pressure.intensityBand === 'critical' ? 4 :
      pressure.intensityBand === 'high' ? 3 :
      pressure.intensityBand === 'moderate' ? 2 :
      1;
    const polarity = String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
    const modifier = natalBodyModifiers[index];

    if (polarity === 'constructive') bump('engage', weight);
    if (polarity === 'frictional') bump('contain', weight);
    if (polarity === 'volatile') bump('withdraw', weight);
    if (polarity === 'binding') bump('observe', weight);

    if (pressure.natalHouse === 7 || pressure.natalHouse === 11) bump('support', weight);
    if (pressure.natalHouse === 10 || pressure.natalHouse === 6) bump('contain', weight);
    if (pressure.natalHouse === 4 || pressure.natalHouse === 8 || pressure.natalHouse === 12) bump('observe', weight);

    if (modifier === 'core' || modifier === 'volitional') bump('assert', weight);
    if (modifier === 'felt' || modifier === 'relational') bump('support', weight);
    if (modifier === 'interpretive' || modifier === 'expansive') bump('reframe', weight);
    if (modifier === 'structural' || modifier === 'depth') bump('contain', weight);
    if (modifier === 'disruptive' || modifier === 'diffuse') bump('withdraw', weight);
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || POSTURE_PRIORITY.indexOf(a[0]) - POSTURE_PRIORITY.indexOf(b[0]))
    .map(([posture]) => posture)
    .slice(0, 2);
}

/**
 * Baseline campaign projection appends the digest-driven moment after prior paragraphs on `significance`
 * (`assemble-sections` merges supplemental + `buildCampaignPressureResponseParagraph` there).
 * Use the last non-empty double-newline-separated block so the theme lead reads that moment, not `signatures`.
 */
function campaignSignificanceLeadParagraph(significanceText: string): string {
  const paras = significanceText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 0) return '';
  if (paras.length === 1) return paras[0]!;
  return paras[paras.length - 1]!;
}

/** Same sentence boundary idea as `firstSentence`, but keeps up to `max` sentences for digest geometry that appears after the opening clause. */
function firstSentencesUpTo(text: string, max: number): string {
  const compact = compactText(text);
  if (!compact) return '';
  const chunks = compact.split(/(?<=[.!?])\s+/).map((c) => c.trim()).filter(Boolean);
  return chunks.slice(0, Math.max(1, max)).join(' ').trim();
}

/** Primary reading line from canonical semantic pipeline only (Phase D campaign surface). */
function semanticReadingLine(core: SemanticCore, seed: string, campaignExpressionDigest?: CampaignExpressionDigest): string {
  const sections = projectTextFromSemanticCore(core, seed, {
    phaseD: true,
    surface: 'campaign',
    tier: 'baseline',
    narrativePlan: null,
    aspectTension: null,
    campaignExpressionDigest,
  });
  const significance = sections.find((s) => s.id === 'significance');
  const significanceText = (significance?.text ?? '').trim();
  if (significanceText) {
    return campaignSignificanceLeadParagraph(significanceText);
  }
  const legacy = sections.find((s) => s.id === 'signatures' || s.id === 'sky_summary');
  return (legacy?.text ?? sections[0]?.text ?? '').trim();
}

const ARCHETYPE_FRAMING: Record<ArchetypeId, string> = {
  identity_test: 'a live test of who you are when something pushes back',
  identity_definition: 'a beat where self-definition stops being theoretical',
  resource_strain: 'value, effort, or footing tightening in plain sight',
  resource_opportunity: 'a workable opening around value or tangible support',
  signal_friction: 'a communication knot that needs cleaner phrasing now',
  signal_reframe: 'a chance to reread what is being signaled before you answer',
  foundation_pressure: 'foundations, rest, or private steadiness under strain',
  foundation_repair: 'a repair window for the base layer you stand on',
  creative_risk: 'expression, desire, or visibility with real exposure',
  creative_devotion: 'a steadier invitation into expression or care you can hold',
  duty_pressure: 'duty, role, or responsibility pressing in the open',
  duty_alignment: 'a chance to line effort up with the role you want to carry',
  bond_friction: 'contact strain that needs cleaner exchange today',
  bond_repair: 'an opening for repair, care, or reconnection you can act on',
  threshold_reckoning: 'trust, stakes, or deeper exchange asking for honesty',
  horizon_reorientation: 'meaning, direction, or worldview shifting under you',
};

function challengeFramingLine(
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
  state: CampaignState,
): string {
  const archetypeId = challengeContext?.archetypeId ?? 'identity_test';
  const archetypeFrame = ARCHETYPE_FRAMING[archetypeId] ?? ARCHETYPE_FRAMING.identity_test;
  const domain = challengeContext?.primaryDomain ?? pressure.domain;
  const variants = [
    `What you are in today lands hardest on ${domainLabel(domain)}: ${archetypeFrame}.`,
    `The scene in front of you asks you to meet ${domainLabel(domain)} as ${archetypeFrame}.`,
  ];
  return stableVariant(
    `${pressure.id}:${archetypeId}:${state.chapter}:challenge-frame`,
    variants,
  );
}

function supportingPressureLine(
  supporting: TransitPressure[],
  challengeContext?: ChallengeContext
): string {
  const firstSupport = supporting[0];
  if (!firstSupport) return '';
  const supportPolarity = String(firstSupport.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const supportDomain = domainLabel(firstSupport.domain);
  const supportAspect = aspectPressure(firstSupport.aspectType);
  const supportTone = polarityImplication(supportPolarity);
  const interaction = challengeContext?.interactionType;
  const variants = [
    `A second pressure in ${supportDomain} ${supportAspect}, coloring the room as ${supportTone}.`,
    `Alongside that, ${supportDomain} ${supportAspect}, so the situation also carries ${supportTone}.`,
  ];
  if (interaction && interaction !== 'none') {
    return `${stableVariant(`${firstSupport.id}:${interaction}:support`, variants)} Those threads stay ${interaction.replace(/_/g, ' ')}, not a single isolated spike.`;
  }
  return stableVariant(`${firstSupport.id}:support`, variants);
}

function challengeThemeFromSemantic(
  core: SemanticCore,
  natalSnapshot: EphemerisSnapshot,
  pressure: TransitPressure,
  supporting: TransitPressure[],
  state: CampaignState,
  challengeContext: ChallengeContext | undefined,
  campaignExpressionDigest: CampaignExpressionDigest | undefined,
  campaignDailyPressureNarration?: CampaignDailyPressureNarration,
  themeIdentitySlugs?: Pick<CampaignIdentitySlugs, 'class_slug' | 'rising_modifier_slug'>,
): string {
  const frame = challengeFramingLine(pressure, challengeContext, state);
  const line = campaignDailyPressureNarration
    ? buildCampaignDailyThemeLead({
        narration: campaignDailyPressureNarration,
        seed: `${campaignDailyPressureNarration.dailyState.daily_pressure_state_id}|${campaignDailyPressureNarration.dailyState.date}|ch${state.chapter ?? 1}`,
        themeIdentity: themeIdentitySlugs,
      })
    : firstSentencesUpTo(semanticReadingLine(core, hashSnapshot(natalSnapshot), campaignExpressionDigest), 4);
  const support = campaignDailyPressureNarration ? '' : supportingPressureLine(supporting, challengeContext);
  const continuityRaw = continuityLines(state, challengeContext?.primaryDomain ?? pressure.domain);
  const continuity = continuityRaw.slice(0, 1);
  const raw = [frame, line, support, ...continuity]
    .map(compactText)
    .filter(Boolean)
    .join(' ');
  return raw;
}

function pressureInterpretationLine(
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
  state: CampaignState,
): string {
  const polarity = challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const modifier = modifierLanguage(challengeContext?.natalBodyModifier);
  const aspect = aspectPressure(pressure.aspectType);
  const domain = domainContext(challengeContext?.primaryDomain ?? pressure.domain);
  const house = houseLanguage(pressure.natalHouse);
  const toneKey = dominantToneKey(state);
  const variants = [
    `What is live in the room is ${intensityUrgency(intensityBand)} and ${polarityTone(polarity)}: it ${aspect} around ${domain}, with extra weight through ${house} and ${modifier}.`,
    `You are standing in ${intensityUrgency(intensityBand)} pressure that ${aspect} around ${domain}, with a ${modifier} emphasis showing through ${house}.`,
  ];
  const base = stableVariant(`${pressure.id}:${polarity}:${intensityBand}:${toneKey}:pressure`, variants);
  return `${base} What earns traction here is ${polarityImplication(polarity)}, while ${polarityTradeoff(polarity)} still sets the guardrails.`;
}

function sceneSettingFromTone(
  tone: CampaignIdentityTone,
  pressure: TransitPressure,
  state: CampaignState,
  challengeContext?: ChallengeContext,
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

  const polarity = challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const toneKey = dominantToneKey(state);
  if (tone.narrativeMood === 'somber' || toneKey === 'strain') {
    return `${base}, with a steadier and more serious tone while the moment stays ${intensityUrgency(intensityBand)}`;
  }
  if (tone.narrativeMood === 'bright' && polarity === 'constructive') {
    return `${base}, with some light available because the situation stays ${polarityTone(polarity)}`;
  }
  if (toneKey === 'clarity' || toneKey === 'stability') {
    return `${base}, with cleaner edges and a more deliberate pace`;
  }
  return `${base}, with a reflective pace that keeps the situation easy to read`;
}

/** Game-layer obstacle copy only (no chart interpretation beyond SemanticCore-backed theme). */
function sceneObstacleGame(
  pressure: TransitPressure,
  character: CharacterProfile,
  challengeContext: ChallengeContext | undefined,
  state: CampaignState,
): string {
  const leaning =
    character.temperament.shadowCapacity >= 0.7
      ? 'older coping patterns may feel closer to the surface'
      : 'habits are present, but still workable if you keep the move small';
  return `${pressureInterpretationLine(pressure, challengeContext, state)} ${leaning}.`;
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
const REGULATING_POSTURES = new Set<ResponsePosture>(['observe', 'withdraw', 'contain']);
const DIRECTIONAL_POSTURES = new Set<ResponsePosture>(['assert', 'engage', 'offer']);

function requiredDomainAnchor(domain: string): ResponsePosture {
  switch (domain) {
    case 'partnership':
    case 'community':
      return 'support';
    case 'career':
    case 'work':
      return 'contain';
    case 'subconscious':
    case 'transformation':
    case 'home':
      return 'observe';
    case 'communication':
      return 'reframe';
    case 'creativity':
      return 'engage';
    case 'assets':
      return 'contain';
    default:
      return 'assert';
  }
}

function hasRegulatingPosture(slate: ResponsePosture[]): boolean {
  return slate.some((posture) => REGULATING_POSTURES.has(posture));
}

function hasDirectionalPosture(slate: ResponsePosture[]): boolean {
  return slate.some((posture) => DIRECTIONAL_POSTURES.has(posture));
}

function supportReplacementLimit(supporting: TransitPressure[]): number {
  if (supporting.length < 2) return supporting.length > 0 ? 1 : 0;
  const [first, second] = supporting;
  if (!first || !second) return 1;
  const samePolarity = first.likelyShadowPattern === second.likelyShadowPattern;
  const sameDomain = first.domain === second.domain;
  const bothHighImpact =
    (first.intensityBand === 'high' || first.intensityBand === 'critical') &&
    (second.intensityBand === 'high' || second.intensityBand === 'critical');
  return samePolarity && (sameDomain || bothHighImpact) ? 2 : 1;
}

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

function postureGesture(
  posture: ResponsePosture,
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
  state: CampaignState,
): string {
  const domKey = challengeContext?.primaryDomain ?? pressure.domain;
  const lab = domainLabel(domKey);
  const ctx = domainContext(domKey);
  const contact = `${pressure.transitBody} to ${pressure.natalBody} (${pressure.aspectType})`;
  const polarity = challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const toneKey = dominantToneKey(state);
  switch (posture) {
    case 'observe':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          `With ${contact} pressing ${lab}, slow down long enough to see what ${ctx} is actually doing before you answer, while the moment stays ${intensityUrgency(intensityBand)}.`,
          `${contact} in ${lab} is loud; let ${ctx} declare itself before you lock a move, especially with ${intensityUrgency(intensityBand)} heat still running.`,
        ],
      );
    case 'assert':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          `Under ${contact} in ${lab}, say one clean sentence about ${ctx} so the situation cannot stay implied.`,
          `Name what is true where ${contact} meets ${lab}, so ${ctx} is spoken plainly under ${polarityTone(polarity)} light.`,
        ],
      );
    case 'engage':
      return stableVariant(
        `${pressure.id}:${posture}:${intensityBand}`,
        [
          `Take one bounded step that answers ${contact} in ${lab} without pretending ${ctx} has cooled past ${intensityUrgency(intensityBand)}.`,
          `Move ${ctx} forward against ${contact} in ${lab} with a deliberate action you can finish today.`,
        ],
      );
    case 'withdraw':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          `Ease exposure where ${contact} hits ${lab} so ${ctx} can cool, then return on purpose rather than drifting.`,
          `Step off the hottest part of ${contact} in ${lab} until timing returns; ${ctx} can wait without you vanishing.`,
        ],
      );
    case 'support':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          `Bring ${contact} in ${lab} to someone you trust so ${ctx} is not carried alone.`,
          `Ask for witness on ${ctx} while ${contact} works ${lab}; a second mind steadies the swing.`,
        ],
      );
    case 'offer':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          `Answer ${contact} in ${lab} with a tangible gesture toward ${ctx}, not a speech.`,
          `Put something real on the table for ${ctx} where ${contact} crosses ${lab}.`,
        ],
      );
    case 'reframe':
      return stableVariant(
        `${pressure.id}:${posture}:${intensityBand}`,
        [
          `Shift the story you tell about ${ctx} under ${contact} in ${lab} so your next move is not locked to the loudest first read.`,
          `Rename what ${contact} means for ${lab} so ${ctx} can move without the old verdict steering everything.`,
        ],
      );
    case 'contain':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          `Cap what you will carry for ${ctx} while ${contact} runs ${lab}; keep the perimeter survivable.`,
          `Draw a smaller circle around ${ctx} where ${contact} meets ${lab} so the strain cannot flood every room.`,
        ],
      );
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

function postureRiskProfile(
  posture: ResponsePosture,
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
): string {
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const intensityWord = intensityQualifier(intensityBand);
  const lab = domainLabel(challengeContext?.primaryDomain ?? pressure.domain);
  const contact = `${pressure.transitBody} to ${pressure.natalBody} (${pressure.aspectType})`;
  switch (posture) {
    case 'observe':
      return `This stance buys read-time before you lock a move; with ${contact} in ${lab} still ${intensityUrgency(intensityBand)}, the pause can read as a longer open window ${intensityWord} from the outside.`;
    case 'assert':
      return `This stance puts a hard line in the room; with ${contact} in ${lab} already ${intensityUrgency(intensityBand)}, definition lands hot and contact can spike before the temperature drops.`;
    case 'engage':
      return `This stance converts heat into motion; with ${contact} in ${lab} still ${intensityUrgency(intensityBand)}, a wide step can carry more strain than the window was built for.`;
    case 'withdraw':
      return `This stance pulls contact back on purpose; with ${contact} in ${lab} at ${intensityUrgency(intensityBand)}, distance can read as a slower clock for anyone waiting on a visible answer.`;
    case 'support':
      return `This stance pulls counsel and witness into the move; while ${contact} keeps ${lab} at ${intensityUrgency(intensityBand)}, coordinating with others can slow solo tempo until alignment catches up.`;
    case 'offer':
      return `This stance answers the moment with a concrete gesture; even a small move carries real cost if the room cannot echo it back with care.`;
    case 'reframe':
      return `This stance works the meaning layer first; with ${contact} in ${lab} still ${intensityUrgency(intensityBand)}, interpretation can postpone the outward move others are already clocking.`;
    case 'contain':
      return `This stance draws a smaller perimeter around what you will carry; with ${contact} in ${lab} at ${intensityUrgency(intensityBand)}, a tight edge can read as cool distance if it lands sharp.`;
  }
}

function addFifthPosture(
  slate: ResponsePosture[],
  polarity?: ChallengeContext['pressurePolarity'],
  intensityBand?: ChallengeContext['intensityBand'],
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
  locked: Set<ResponsePosture> = new Set(),
): ResponsePosture[] {
  if (slate.includes(required)) return slate;
  const replacementIndex = [...slate]
    .map((posture, index) => ({ posture, index }))
    .filter((entry) => !locked.has(entry.posture))
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
  const anchor = requiredDomainAnchor(domain);
  next = replaceLowestPriority(next, priorityOrder, anchor);
  if (!hasRegulatingPosture(next)) next = replaceLowestPriority(next, priorityOrder, 'observe', new Set([anchor]));
  if (!hasDirectionalPosture(next)) next = replaceLowestPriority(next, priorityOrder, 'assert', new Set([anchor]));
  return next;
}

function postureFromSupport(
  pressure: TransitPressure,
  natalBodyModifier?: NatalBodyModifier,
): ResponsePosture {
  const polarity = String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  if (pressure.domain === 'partnership' || pressure.domain === 'community') {
    if (polarity === 'constructive') return 'support';
    if (polarity === 'frictional') return 'contain';
  }
  if (pressure.domain === 'career' || pressure.domain === 'work' || pressure.domain === 'assets') {
    if (polarity === 'constructive') return 'engage';
    return 'contain';
  }
  if (pressure.domain === 'home' || pressure.domain === 'subconscious' || pressure.domain === 'transformation') {
    if (polarity === 'volatile') return 'withdraw';
    return 'observe';
  }
  if (pressure.domain === 'communication' || pressure.domain === 'belief') {
    if (polarity === 'constructive') return 'reframe';
    return 'observe';
  }
  if (natalBodyModifier === 'relational' || natalBodyModifier === 'felt') return 'support';
  if (natalBodyModifier === 'volitional' || natalBodyModifier === 'core') return 'assert';
  if (natalBodyModifier === 'interpretive' || natalBodyModifier === 'expansive') return 'reframe';
  if (natalBodyModifier === 'structural' || natalBodyModifier === 'depth') return 'contain';
  if (natalBodyModifier === 'disruptive' || natalBodyModifier === 'diffuse') return 'withdraw';
  return polarity === 'constructive' ? 'engage' : 'observe';
}

function hash32seed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function risingExecutionSign(slug: string): string {
  const m = /^rising_([a-z]+)$/.exec(slug.toLowerCase());
  return m?.[1] ?? 'unknown';
}

function executionElement(sign: string): 'fire' | 'water' | 'air' | 'earth' | 'unknown' {
  const s = sign.toLowerCase();
  if (['aries', 'leo', 'sagittarius'].includes(s)) return 'fire';
  if (['cancer', 'scorpio', 'pisces'].includes(s)) return 'water';
  if (['gemini', 'libra', 'aquarius'].includes(s)) return 'air';
  if (['taurus', 'virgo', 'capricorn'].includes(s)) return 'earth';
  return 'unknown';
}

function refillPostureSlate(slate: ResponsePosture[], archetypeId: ArchetypeId, domain: string): ResponsePosture[] {
  let u = [...new Set(slate)];
  const base = BASE_POSTURE_SLATES[archetypeId] ?? BASE_POSTURE_SLATES.identity_test;
  const pool = [...base, ...POSTURE_PRIORITY];
  for (const p of pool) {
    if (u.length >= 5) break;
    if (!u.includes(p)) u.push(p);
  }
  const anchor = requiredDomainAnchor(domain);
  u = enforceDomainConstraints(u, u, domain);
  if (!hasRegulatingPosture(u)) u = replaceLowestPriority(u, u, 'observe', new Set([anchor]));
  if (!hasDirectionalPosture(u)) u = replaceLowestPriority(u, u, 'assert', new Set([anchor]));
  return u.slice(0, 5);
}

function applyCampaignSlateShaping(
  slate: ResponsePosture[],
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
  archetypeId: ArchetypeId,
  shaping: { identity: CampaignIdentitySlugs; continuity: CampaignSlateContinuity },
): ResponsePosture[] {
  let next = [...slate];
  const pol =
    challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const band = challengeContext?.intensityBand ?? pressure.intensityBand;
  const domain = pressure.domain;
  const elem = executionElement(risingExecutionSign(shaping.identity.rising_modifier_slug));
  const classSalt = shaping.identity.class_slug;

  if (elem === 'fire' && band !== 'critical' && pol !== 'volatile') {
    const wi = next.indexOf('withdraw');
    if (wi >= 0) {
      const injectOrder: ResponsePosture[] = ['engage', 'offer', 'reframe', 'support'];
      const pick = injectOrder.find((p) => !next.includes(p));
      if (pick) next[wi] = pick;
    }
  }
  if (elem === 'water' && (domain === 'partnership' || domain === 'home')) {
    const ai = next.indexOf('assert');
    if (ai >= 0 && !next.includes('support')) next[ai] = 'support';
  }
  if (elem === 'air' && (band === 'low' || band === 'moderate')) {
    const ci = next.indexOf('contain');
    if (ci >= 0 && !next.includes('reframe')) next[ci] = 'reframe';
  }
  if (elem === 'earth' && (band === 'high' || band === 'critical')) {
    const ei = next.indexOf('engage');
    if (ei >= 0 && !next.includes('contain')) next[ei] = 'contain';
  }

  const lastDir = shaping.continuity.recentOutcomeDirections[0];
  if (lastDir === 'withdraw_protect') {
    const oi = next.indexOf('observe');
    if (oi >= 0 && !next.includes('engage') && hash32seed(shaping.continuity.sessionKey) % 2 === 0) {
      next[oi] = 'engage';
    }
  } else if (lastDir === 'engage_advance') {
    const oi = next.indexOf('assert');
    if (oi >= 0 && !next.includes('observe')) next[oi] = 'observe';
  }

  if (hash32seed(`${shaping.continuity.sessionKey}|${classSalt}|cls`) % 3 !== 0 && next.length >= 2) {
    const i =
      hash32seed(`${shaping.continuity.sessionKey}|${shaping.identity.rising_modifier_slug}|sw`) %
      Math.max(1, next.length - 1);
    const a = next[i]!;
    const b = next[i + 1]!;
    next[i] = b;
    next[i + 1] = a;
  }

  const bias = shaping.continuity.domainPressureBias;
  if (bias > 2) {
    const anchor = requiredDomainAnchor(domain);
    const rep = replaceLowestPriority(next, next, anchor, new Set());
    if (rep.join('|') !== next.join('|')) next = rep;
  }

  next = Array.from(new Set(next));
  /** Rising + session keyed rotation so execution style always differentiates menus when multiset is unchanged. */
  if (next.length >= 2) {
    const rot =
      hash32seed(`${shaping.identity.rising_modifier_slug}|${shaping.continuity.sessionKey}|rot`) % next.length;
    if (rot > 0) {
      next = [...next.slice(rot), ...next.slice(0, rot)];
    }
  }
  if (next.length < 5) {
    next = refillPostureSlate(next, archetypeId, domain);
  }
  next = enforceDomainConstraints(next, next, domain);
  const anch = requiredDomainAnchor(domain);
  if (!hasRegulatingPosture(next)) next = replaceLowestPriority(next, next, 'observe', new Set([anch]));
  if (!hasDirectionalPosture(next)) next = replaceLowestPriority(next, next, 'assert', new Set([anch]));
  return next.slice(0, 5);
}

function buildChoice(
  posture: ResponsePosture,
  pressure: TransitPressure,
  state: CampaignState,
  challengeContext?: ChallengeContext,
): ChoiceOption {
  const outcomeDirection = postureOutcomeDirection(posture);
  return {
    id: posturePatternTag(posture),
    label: postureLabel(posture),
    symbolicGesture: postureGesture(posture, pressure, challengeContext, state),
    patternTag: posturePatternTag(posture),
    posture,
    modality: postureModality(posture),
    riskProfile: `${postureRiskProfile(posture, pressure, challengeContext)} ${outcomeSentence(outcomeDirection, challengeContext?.primaryDomain ?? pressure.domain)}`,
    outcomeDirection,
  };
}

function baseChoices(
  pressure: TransitPressure,
  supporting: TransitPressure[],
  state: CampaignState,
  challengeContext: ChallengeContext | undefined,
  shaping: { identity: CampaignIdentitySlugs; continuity: CampaignSlateContinuity } | undefined,
): ChoiceOption[] {
  const archetypeId = challengeContext?.archetypeId ?? 'identity_test';
  const baseSlate = [...(BASE_POSTURE_SLATES[archetypeId] ?? BASE_POSTURE_SLATES.identity_test)];
  let slate = addFifthPosture(baseSlate, challengeContext?.pressurePolarity, challengeContext?.intensityBand);
  slate = enforceDomainConstraints(slate, slate, pressure.domain);
  const anchor = requiredDomainAnchor(pressure.domain);
  const supportBiases = supportingBiasPostures(supporting, challengeContext?.supportingNatalBodyModifiers);
  const supportTargets = supporting
    .map((entry, index) => postureFromSupport(entry, challengeContext?.supportingNatalBodyModifiers?.[index]))
    .filter((posture, index, arr) => arr.indexOf(posture) === index);
  const combinedSupportTargets = [...supportTargets, ...supportBiases].filter(
    (posture, index, arr) => arr.indexOf(posture) === index,
  );
  const replacementLimit = supportReplacementLimit(supporting);
  let replacements = 0;
  for (const posture of combinedSupportTargets) {
    if (replacements >= replacementLimit) break;
    const nextSlate = replaceLowestPriority(slate, slate, posture, new Set([anchor]));
    if (nextSlate.join('|') !== slate.join('|')) {
      slate = nextSlate;
      replacements += 1;
    }
  }
  slate = Array.from(new Set(slate));
  slate = enforceDomainConstraints(slate, slate, pressure.domain);
  if (!hasRegulatingPosture(slate)) slate = replaceLowestPriority(slate, slate, 'observe', new Set([anchor]));
  if (!hasDirectionalPosture(slate)) slate = replaceLowestPriority(slate, slate, 'assert', new Set([anchor]));
  let finalSlate = slate.slice(0, 5);
  if (shaping) {
    finalSlate = applyCampaignSlateShaping(finalSlate, pressure, challengeContext, archetypeId, shaping);
  }
  return finalSlate.map((posture) => buildChoice(posture, pressure, state, challengeContext));
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
  /** Optional read-only digest from Command Center materialization for campaign projection only. */
  campaignExpressionDigest?: CampaignExpressionDigest;
  challengeContext?: ChallengeContext;
  /** When set with `slateContinuity`, response postures are shaped by identity + bounded state traces. */
  campaignIdentitySlugs?: CampaignIdentitySlugs;
  slateContinuity?: CampaignSlateContinuity;
  /** When set, theme lead is built from daily pressure truth (Command-Center daily), not natal projection text. */
  campaignDailyPressureNarration?: CampaignDailyPressureNarration;
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
  const {
    character,
    pressures,
    state,
    semanticCore,
    transitSnapshot,
    natalSnapshot,
    challengeContext,
    campaignExpressionDigest,
    campaignIdentitySlugs,
    slateContinuity,
    campaignDailyPressureNarration,
  } = params;
  if (!pressures.length) return null;

  const tone = deriveCampaignIdentityToneFromSemanticCore(semanticCore);
  const primary = pressures[0] ?? null;
  if (!primary) return null;

  const supporting = pressures.slice(1, 4);
  const theme = challengeThemeFromSemantic(
    semanticCore,
    natalSnapshot,
    primary,
    supporting,
    state,
    challengeContext,
    campaignExpressionDigest,
    campaignDailyPressureNarration,
    campaignIdentitySlugs
      ? {
          class_slug: campaignIdentitySlugs.class_slug,
          rising_modifier_slug: campaignIdentitySlugs.rising_modifier_slug,
        }
      : undefined,
  );
  const setting = sceneSettingFromTone(tone, primary, state, challengeContext);
  const obstacle = sceneObstacleGame(primary, character, challengeContext, state);

  const shaping =
    campaignIdentitySlugs && slateContinuity ? { identity: campaignIdentitySlugs, continuity: slateContinuity } : undefined;
  const choices = baseChoices(primary, supporting, state, challengeContext, shaping);

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

