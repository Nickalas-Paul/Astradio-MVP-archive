/**
 * Final Campaign surface copy: deterministic narrative realization over resolved truth.
 * Downstream-only: does not alter pressures, postures, outcome directions, or choice ids.
 */
import type { CampaignExpressionDigest } from '../projection/projection-types';
import type { ArchetypeId, ChallengeScene, ChoiceOption, ResponsePosture, TransitPressure } from '../rpg/types';
import {
  domainLabel,
  intensityUrgency,
  polarityImplication,
  polarityTone,
  polarityTradeoff,
  stableVariant,
} from '../rpg/projection-language';

export type CampaignSurfaceSlugs = {
  readonly class_slug: string;
  readonly subclass_slug: string;
  readonly rising_modifier_slug: string;
};

function coerceIntensityBand(raw: string): TransitPressure['intensityBand'] {
  const k = raw.toLowerCase();
  if (k === 'low' || k === 'moderate' || k === 'high' || k === 'critical') return k;
  return 'moderate';
}

function hash32(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Minimal cleanup only: strip internal tags, normalize whitespace. No planet/aspect metaphor substitution. */
function scrubAstroMechanics(text: string, _seed: string, _digest: CampaignExpressionDigest): string {
  return text.replace(/\bphase1_shadow:/gi, '').replace(/\s+/g, ' ').trim();
}

function classBucket(classSlug: string): number {
  return hash32(classSlug) % 3;
}

const LABEL_BY_POSTURE: Record<
  ResponsePosture,
  readonly [readonly string[], readonly string[], readonly string[]]
> = {
  observe: [
    ['Hold the line of sight', 'Mark the moment calmly', 'Read the room before steel enters'],
    ['Stand watch without flinch', 'Let the scene declare itself', 'Keep the aperture open'],
    ['Survey before you swear', 'Name nothing yet; see all', 'Let silence do reconnaissance'],
  ],
  assert: [
    ['Name the hard truth', 'Speak the edge plain', 'Call the thing what it is'],
    ['Drive a clean stake', 'Plant the sentence that holds', 'Say the line that cannot bend'],
    ['Cut through fog with one vow', 'Declare the boundary aloud', 'Let truth land square'],
  ],
  engage: [
    ['Step into the fray', 'Close distance with intent', 'Advance the living move'],
    ['Press the advantage with care', 'Carry heat forward', 'Move while the window holds'],
    ['Commit motion to the breach', 'Lean in; earn the inch', 'Take ground without spectacle'],
  ],
  withdraw: [
    ['Pull back to breathe', 'Choose distance as strategy', 'Guard the gate you keep'],
    ['Retreat to regroup', 'Step off the burning floor', 'Save capacity first'],
    ['Seal the perimeter inward', 'Buy quiet before return', 'Lower exposure on purpose'],
  ],
  support: [
    ['Bring allies into frame', 'Let counsel steady the hand', 'Share weight with trust'],
    ['Seek the second voice', 'Borrow steadier eyes', 'Weave counsel into the move'],
    ['Call the circle close', 'Let witness temper heat', 'Trade solitude for grounded echo'],
  ],
  offer: [
    ['Lay a concrete gift', 'Offer what can be held', 'Put something real on the table'],
    ['Make repair tangible', 'Trade gesture for steadiness', 'Feed the bond with deed'],
    ['Give the small costly thing', 'Answer the moment with offering', 'Let care take material form'],
  ],
  reframe: [
    ['Rename the pattern', 'Turn the story’s hinge', 'Shift the frame without flight'],
    ['Rewrite the meaning-skin', 'Find the gentler true', 'Bend interpretation, not fact'],
    ['Open a second reading', 'Loosen the old verdict', 'Let a new angle breathe'],
  ],
  contain: [
    ['Draw the smaller circle', 'Cap what you will carry', 'Fence what you accept'],
    ['Bound the spill', 'Tighten scope to survive', 'Keep the fire in the hearth'],
    ['Limit the bleed', 'Choose the edge you defend', 'Shrink the battlefield'],
  ],
};

function realizedLabel(posture: ResponsePosture, classSlug: string, seed: string): string {
  const bucket = classBucket(classSlug);
  const variants = LABEL_BY_POSTURE[posture][bucket] ?? LABEL_BY_POSTURE[posture][0]!;
  return stableVariant(`${seed}|lbl|${posture}|${classSlug}`, [...variants]);
}

function primaryContactPhrase(digest: CampaignExpressionDigest): string {
  const p = digest.pressure;
  return `${p.primary_transit_body} to ${p.primary_natal_body} (${p.primary_aspect_type})`;
}

/** Short execution bias from identity mirrors — no sign names, no cadence footer. */
function identityExecutionHint(digest: CampaignExpressionDigest, seed: string): string {
  const key = `${seed}|id_hint|${digest.identity.class_slug}|${digest.identity.rising_modifier_slug}`;
  const hints = [
    'You answer cleaner when the move stays small and repeatable.',
    'You steady once the truth is spoken, not while it stays implied.',
    'You buy room by pacing the answer instead of rushing the performance.',
    'You trust the day more when someone else can see the same facts you see.',
    'You tighten scope before you tighten tone.',
    'You recover faster when the gesture is concrete, not symbolic.',
  ];
  return stableVariant(key, [...hints]).trim();
}

function realizedGesture(
  posture: ResponsePosture,
  domain: string,
  classSlug: string,
  risingSlug: string,
  seed: string,
  digest: CampaignExpressionDigest,
): string {
  const p = digest.pressure;
  const lab = domainLabel(domain);
  const contact = primaryContactPhrase(digest);
  const pol = p.primary_pressure_polarity;
  const inten = coerceIntensityBand(p.primary_intensity_band);
  const polT = polarityTone(pol);
  const urg = intensityUrgency(inten);
  const idHint = identityExecutionHint(digest, `${seed}|idh`);
  const variants: Record<ResponsePosture, string[]> = {
    observe: [
      `With ${contact} pressing ${lab}, wait until the real tradeoff shows under ${polT} light while the moment stays ${urg}. ${idHint}`,
      `${contact} in ${lab} is still ${urg}; let ${polT} show its shape before you answer. ${idHint}`,
    ],
    assert: [
      `Under ${contact} in ${lab}, speak one clean line so nothing stays implied while the situation reads ${urg}. ${idHint}`,
      `Name what is true where ${contact} crosses ${lab}; ${polT} light still sets the tempo at ${urg}. ${idHint}`,
    ],
    engage: [
      `Take one bounded advance that answers ${contact} in ${lab} without pretending ${polT} heat has cooled from ${urg}. ${idHint}`,
      `Move on ${contact} in ${lab} with a deliberate step sized for ${polT} conditions still running ${urg}. ${idHint}`,
    ],
    withdraw: [
      `Ease off the hottest edge of ${contact} in ${lab} on purpose until timing returns; ${polT} does not vanish, you choose distance at ${urg}. ${idHint}`,
      `Step back from ${contact} in ${lab} so ${polT} can settle without you vanishing; the moment stays ${urg}. ${idHint}`,
    ],
    support: [
      `Bring ${contact} in ${lab} to someone you trust so the swing is not solo under ${urg}. ${idHint}`,
      `Let a second mind see ${contact} in ${lab}; ${polT} reads softer when witness joins at ${urg}. ${idHint}`,
    ],
    offer: [
      `Answer ${contact} in ${lab} with something tangible that matches ${polT} heat without empty theater at ${urg}. ${idHint}`,
      `Put a real gesture on the table for ${lab} where ${contact} is live; ${polT} needs weight, not abstraction. ${idHint}`,
    ],
    reframe: [
      `Shift the story you tell about ${contact} in ${lab} so ${polT} can meet ${urg} with more room to breathe. ${idHint}`,
      `Rename the frame around ${contact} in ${lab}; interpretation moves first while intensity stays ${urg}. ${idHint}`,
    ],
    contain: [
      `Tighten what you will carry where ${contact} hits ${lab} so ${polT} stays inside a survivable edge at ${urg}. ${idHint}`,
      `Bound ${contact} in ${lab} with a clear limit; ${polT} respects smaller perimeters at ${urg}. ${idHint}`,
    ],
  };
  const sub = risingSlug.replace(/^rising_/, '').slice(0, 12);
  const pool = variants[posture] ?? variants.observe;
  return stableVariant(`${seed}|gst|${posture}|${classSlug}|${sub}`, pool);
}

function realizedRisk(
  posture: ResponsePosture,
  domain: string,
  seed: string,
  digest: CampaignExpressionDigest,
): string {
  const pol = digest.pressure.primary_pressure_polarity;
  const inten = coerceIntensityBand(digest.pressure.primary_intensity_band);
  const impl = polarityImplication(pol);
  const trade = polarityTradeoff(pol);
  const urg = intensityUrgency(inten);
  const lab = domainLabel(domain);
  const contact = primaryContactPhrase(digest);
  return stableVariant(`${seed}|risk|${posture}`, [
    `This stance favors ${impl} under ${contact} in ${lab} while the moment stays ${urg}; ${trade} still sets the guardrail.`,
    `You buy ${impl} here with ${contact} in ${lab} at ${urg}; the cost is that ${trade} remains in play.`,
  ]);
}

function realizeThemeLead(
  theme: string,
  digest: CampaignExpressionDigest,
  _archetypeId: ArchetypeId,
  seed: string,
  _slugs: CampaignSurfaceSlugs,
): string {
  return scrubAstroMechanics(theme, `${seed}|theme`, digest);
}

function realizeObstacle(obstacle: string, digest: CampaignExpressionDigest, seed: string, slugs: CampaignSurfaceSlugs): string {
  const base = scrubAstroMechanics(obstacle, `${seed}|obs`, digest);
  const sub = slugs.subclass_slug.replace(/^subclass_/, '').slice(0, 12);
  const tail = stableVariant(`${seed}|obsTail`, [
    `The inner cadence (${sub}) keeps your private tradeoff thread visible under the same strain.`,
    `Let the ${sub} undertone stay honest while you answer what this situation keeps asking.`,
  ]);
  return `${base} ${tail}`.replace(/\s+/g, ' ').trim();
}

function realizeSetting(setting: string, digest: CampaignExpressionDigest, seed: string): string {
  return scrubAstroMechanics(setting, `${seed}|set`, digest);
}

export function realizeCampaignSurfaceCopy(params: {
  scene: ChallengeScene;
  digest: CampaignExpressionDigest;
  archetypeId: ArchetypeId;
  slugs: CampaignSurfaceSlugs;
  sessionKey: string;
}): ChallengeScene {
  const { scene, digest, archetypeId, slugs, sessionKey } = params;
  const seed = `${sessionKey}|${scene.id}`;
  const domain = digest.pressure.primary_domain_id;

  const choices: ChoiceOption[] = scene.choices.map((c, i) => {
    const frag = `${seed}|c${i}`;
    return {
      ...c,
      label: realizedLabel(c.posture, slugs.class_slug, `${frag}|l`),
      symbolicGesture: realizedGesture(c.posture, domain, slugs.class_slug, slugs.rising_modifier_slug, `${frag}|g`, digest),
      riskProfile: realizedRisk(c.posture, domain, `${frag}|r`, digest),
    };
  });

  return {
    ...scene,
    theme: realizeThemeLead(scene.theme, digest, archetypeId, `${seed}|th`, slugs),
    obstacle: realizeObstacle(scene.obstacle, digest, `${seed}|ob`, slugs),
    setting: realizeSetting(scene.setting, digest, `${seed}|st`),
    choices,
  };
}
