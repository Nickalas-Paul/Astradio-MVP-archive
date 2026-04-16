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
  firstSentence,
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
  const sig = sections.find((s) => s.id === 'signatures' || s.id === 'sky_summary');
  return (sig?.text ?? sections[0]?.text ?? '').trim();
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
    return `${stableVariant(`${firstSupport.id}:${interaction}:support`, variants)} Together the field reads as ${interaction.replace(/_/g, ' ')}, not a single isolated spike.`;
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
  campaignExpressionDigest: CampaignExpressionDigest | undefined
): string {
  const line = firstSentence(semanticReadingLine(core, hashSnapshot(natalSnapshot), campaignExpressionDigest));
  const frame = challengeFramingLine(pressure, challengeContext, state);
  const support = supportingPressureLine(supporting, challengeContext);
  const continuity = continuityLines(state, challengeContext?.primaryDomain ?? pressure.domain);
  const raw = [line, frame, support, ...continuity]
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
  return `${base} What the field rewards here is ${polarityImplication(polarity)}, while ${polarityTradeoff(polarity)} still sets the guardrails.`;
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
    return `${base}, with a steadier and more serious tone while the pressure stays ${intensityUrgency(intensityBand)}`;
  }
  if (tone.narrativeMood === 'bright' && polarity === 'constructive') {
    return `${base}, with some light available because the pressure remains ${polarityTone(polarity)}`;
  }
  if (toneKey === 'clarity' || toneKey === 'stability') {
    return `${base}, with cleaner edges and a more deliberate pace`;
  }
  return `${base}, with a reflective pace that keeps the pressure readable`;
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
  const domain = domainContext(challengeContext?.primaryDomain ?? pressure.domain);
  const polarity = challengeContext?.pressurePolarity ?? String(pressure.likelyShadowPattern || '').replace('phase1_shadow:', '');
  const intensityBand = challengeContext?.intensityBand ?? pressure.intensityBand;
  const toneKey = dominantToneKey(state);
  switch (posture) {
    case 'observe':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          `Clarify what is actually happening around ${domain} before you commit to a move, especially while the pressure remains ${intensityUrgency(intensityBand)}.`,
          `Slow the first reaction long enough to read what is really happening around ${domain}, rather than answering the first spike of pressure.`,
        ],
      );
    case 'assert':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          `State one clear line about ${domain} so the situation is less implied and more directly named.`,
          `Define what is true for you in ${domain} with one clean sentence rather than letting the tension speak for you.`,
        ],
      );
    case 'engage':
      return stableVariant(
        `${pressure.id}:${posture}:${intensityBand}`,
        [
          `Take one deliberate step in ${domain} that moves the situation without pretending conditions are perfect.`,
          `Use the pressure to create motion in ${domain} through a bounded action that you can actually follow through on today.`,
        ],
      );
    case 'withdraw':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          `Reduce exposure in ${domain} on purpose and choose a later return point, rather than disappearing into drift.`,
          `Step back from direct contact in ${domain} long enough to regain timing control, then revisit it deliberately.`,
        ],
      );
    case 'support':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          `Bring this part of ${domain} to someone trustworthy so perspective becomes part of the response instead of staying solitary.`,
          `Use relationship as a stabilizer for ${domain} by asking for reflection, witness, or grounded feedback.`,
        ],
      );
    case 'offer':
      return stableVariant(
        `${pressure.id}:${posture}:${polarity}`,
        [
          `Contribute one concrete gesture in ${domain} that reflects care, reciprocity, or follow-through.`,
          `Respond through a small real offering in ${domain} so the pressure is met with participation rather than theory alone.`,
        ],
      );
    case 'reframe':
      return stableVariant(
        `${pressure.id}:${posture}:${intensityBand}`,
        [
          `Change the interpretation around ${domain} so your next move comes from a different frame instead of the loudest first story.`,
          `Rename what this moment means in ${domain} so you can meet it with more flexibility and less automatic compression.`,
        ],
      );
    case 'contain':
      return stableVariant(
        `${pressure.id}:${posture}:${toneKey}`,
        [
          `Narrow the scope of ${domain} to what you can actually carry, protect, or decide right now.`,
          `Set a cleaner limit around ${domain} so the pressure has edges instead of spreading into everything else.`,
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
  switch (posture) {
    case 'observe':
      return `This stance buys read-time before you lock a move; with pressure ${intensityUrgency(intensityBand)}, the pause can read as a longer open window ${intensityWord} from the outside.`;
    case 'assert':
      return `This stance puts a hard line in the room; when the field is already ${intensityUrgency(intensityBand)}, definition lands hot and contact can spike before the temperature drops.`;
    case 'engage':
      return `This stance converts pressure into motion; when conditions are still ${intensityUrgency(intensityBand)}, a wide step can carry more strain than the window was built for.`;
    case 'withdraw':
      return `This stance pulls contact back on purpose; with pressure ${intensityUrgency(intensityBand)}, distance can read as a slower clock for anyone waiting on a visible answer.`;
    case 'support':
      return `This stance pulls counsel and witness into the move; while the field stays ${intensityUrgency(intensityBand)}, coordinating with others can slow purely solo tempo until alignment catches up.`;
    case 'offer':
      return `This stance answers pressure with a concrete gesture; even a small move carries real cost if the room cannot echo it back with care.`;
    case 'reframe':
      return `This stance works the meaning layer first; with pressure ${intensityUrgency(intensityBand)}, interpretation can postpone the outward move others are already clocking.`;
    case 'contain':
      return `This stance draws a smaller perimeter around what you will carry; when pressure is ${intensityUrgency(intensityBand)}, a tight edge can read as cool distance if it lands sharp.`;
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
  challengeContext?: ChallengeContext
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
  return slate.slice(0, 5).map((posture) => buildChoice(posture, pressure, state, challengeContext));
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
  const { character, pressures, state, semanticCore, transitSnapshot, natalSnapshot, challengeContext, campaignExpressionDigest } =
    params;
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
    campaignExpressionDigest
  );
  const setting = sceneSettingFromTone(tone, primary, state, challengeContext);
  const obstacle = sceneObstacleGame(primary, character, challengeContext, state);

  const choices = baseChoices(primary, supporting, state, challengeContext);

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

