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
  domainLabel,
  dominantToneKey,
  intensityUrgency,
  polarityImplication,
  polarityTone,
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

/** Short, player-readable life areas. Never the full domain lists. */
const SHORT_LIFE_AREA: Record<string, string> = {
  self: 'your sense of direction',
  assets: 'your material footing',
  communication: 'how you communicate',
  home: 'your foundations',
  creativity: 'your creative courage',
  work: 'your daily responsibilities',
  partnership: 'your closest relationships',
  transformation: 'what you trust and share',
  belief: 'your sense of meaning',
  career: 'your public role',
  community: 'how you show up in group settings',
  subconscious: 'your inner weather',
};

const ASPECT_NOUN: Record<string, string> = {
  conjunction: 'close meeting',
  opposition: 'standoff',
  square: 'conflict',
  trine: 'easy current',
  sextile: 'opening',
};

function titleBodyName(body: string): string {
  const b = String(body || '').trim();
  return b ? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase() : 'the sky';
}

/** One clean sentence naming the transit contact and the life area. Nothing else. */
function pressureInterpretationLine(
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
  state: CampaignState,
): string {
  const polarity = challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const toneKey = dominantToneKey(state);
  const transit = titleBodyName(pressure.transitBody);
  const natal = titleBodyName(pressure.natalBody);
  const aspectNoun = ASPECT_NOUN[String(pressure.aspectType || '').toLowerCase()] ?? 'contact';
  const area =
    SHORT_LIFE_AREA[challengeContext?.primaryDomain ?? pressure.domain] ?? 'the day in front of you';
  const variants = [
    `A ${aspectNoun} between ${transit} and your natal ${natal} tests ${area} today.`,
    `Today a ${aspectNoun} between ${transit} and your natal ${natal} puts ${area} on the line.`,
  ];
  return stableVariant(`${pressure.id}:${polarity}:${intensityBand}:${toneKey}:pressure`, variants);
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

/** Game-layer obstacle copy: at most two clean sentences, no interpretation stitch. */
function sceneObstacleGame(
  pressure: TransitPressure,
  character: CharacterProfile,
  challengeContext: ChallengeContext | undefined,
  state: CampaignState,
): string {
  const leaning =
    character.temperament.shadowCapacity >= 0.7
      ? 'Old habits will be close at hand; watch for them.'
      : 'Keep the move small and it stays workable.';
  return `${pressureInterpretationLine(pressure, challengeContext, state)} ${leaning}`;
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
  const polarity = challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const toneKey = dominantToneKey(state);
  switch (posture) {
    case 'observe':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          'Hold still and read the room before you answer. What this moment is really asking has not fully shown itself yet.',
          'Let the situation declare itself before you commit. Watching closely is its own kind of move.',
        ],
      );
    case 'assert':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          'Say the true thing plainly, in one clean sentence. Nothing gets to stay implied after that.',
          'Name what is actually happening before it names you. Clarity lands harder than volume.',
        ],
      );
    case 'engage':
      return stableVariant(
        `${pressure.id}:${posture}:${intensityBand}`,
        [
          'Take one deliberate step forward, sized so you can finish it today. Momentum beats hesitation here.',
          'Meet the pressure head-on with a bounded, concrete move. Do not pretend the heat has cooled.',
        ],
      );
    case 'withdraw':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          'Step back from the hottest edge on purpose. Distance now buys better timing later.',
          'Ease your exposure and let the moment cool. You are choosing distance, not vanishing.',
        ],
      );
    case 'support':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          'Bring a trusted voice into it so you are not carrying this alone. A second mind steadies the swing.',
          'Ask someone you trust to look at the same facts. Witness makes the weight easier to hold.',
        ],
      );
    case 'offer':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          'Answer with something real on the table, not a speech. A tangible gesture carries more weight than any explanation.',
          'Make a concrete offering that costs you something. Small and real beats grand and empty.',
        ],
      );
    case 'reframe':
      return stableVariant(
        `${pressure.id}:${posture}:${intensityBand}`,
        [
          'Step back and reframe the situation before the tension escalates. A different story opens options the first read kept hidden.',
          'Shift the frame and the ground shifts with it. You are not stuck with the loudest interpretation.',
        ],
      );
    case 'contain':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          'Draw a clear line around what you will carry. A smaller perimeter is easier to defend.',
          'Cap the strain before it floods every room. A firm boundary protects both sides.',
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

/**
 * Player-facing risk level. Display text only; mechanical risk still comes
 * from posture, modifiers, and outcome direction.
 */
function postureRiskProfile(
  posture: ResponsePosture,
  pressure: TransitPressure,
  challengeContext: ChallengeContext | undefined,
): string {
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const hot = intensityBand === 'high' || intensityBand === 'critical';
  switch (posture) {
    case 'observe':
    case 'support':
      return 'Low';
    case 'withdraw':
      return hot ? 'Moderate' : 'Low';
    case 'offer':
    case 'reframe':
    case 'contain':
      return 'Moderate';
    case 'assert':
      return hot ? 'High' : 'Moderate';
    case 'engage':
      return 'High';
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
    riskProfile: postureRiskProfile(posture, pressure, challengeContext),
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
  // Retained for non-narrative callers; mechanical encounter overwrites with house-pool obstacle.
  const obstacleProse = sceneObstacleGame(primary, character, challengeContext, state);

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
    obstacle: {
      name: 'Unresolved Pressure',
      type: 'hazard',
      brief: obstacleProse,
    },
    primaryPressure: primary,
    supportingPressures: supporting,
    choices,
  };
}

