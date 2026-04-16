/**
 * Final Campaign surface copy: deterministic narrative realization over resolved truth.
 * Downstream-only: does not alter pressures, postures, outcome directions, or choice ids.
 */
import type { CampaignExpressionDigest } from '../projection/projection-types';
import type { ArchetypeId, ChallengeScene, ChoiceOption, ResponsePosture, TransitPressure } from '../rpg/types';
import {
  aspectPressure,
  domainContext,
  domainLabel,
  houseLanguage,
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

const PLANET_NAMES = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'sun', 'moon'] as const;

const ASPECT_TERMS = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;

const BODY_EPITHET: Record<string, readonly string[]> = {
  mercury: ['a messenger’s angle', 'the quicksilver thread', 'the courier line'],
  venus: ['the bond-thread', 'the reciprocity line', 'the warmth vector'],
  mars: ['the strike vector', 'the push line', 'the heat trace'],
  jupiter: ['the scale swell', 'the widening arc', 'the horizon swell'],
  saturn: ['the gate line', 'the limit rail', 'the binding edge'],
  uranus: ['the sudden hinge', 'the break spark', 'the snap vector'],
  neptune: ['the mist veil', 'the dissolve haze', 'the porous edge'],
  pluto: ['the deep hinge', 'the buried lever', 'the threshold rivet'],
  sun: ['the visible pivot', 'the center lamp', 'the daylight hinge'],
  moon: ['the felt tide', 'the inner tide', 'the mood seam'],
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

function scrubAstroMechanics(text: string, seed: string, digest: CampaignExpressionDigest): string {
  let t = text;
  const p = digest.pressure;
  const arena = houseLanguage(p.primary_natal_house);
  const aspectPhrase = aspectPressure(p.primary_aspect_type);

  for (const name of PLANET_NAMES) {
    const re = new RegExp(`\\b${name}\\b`, 'gi');
    t = t.replace(re, (m) => {
      const key = m.toLowerCase();
      const list = BODY_EPITHET[key] ?? ['a sky vector', 'a pressure line', 'a moving signal'];
      return stableVariant(`${seed}|body|${key}|${m}`, [...list]);
    });
  }

  for (const asp of ASPECT_TERMS) {
    const re = new RegExp(`\\b${asp}\\b`, 'gi');
    t = t.replace(re, () => stableVariant(`${seed}|asp|${asp}`, [aspectPhrase, 'a sharp geometry', 'a crossing load']));
  }

  t = t.replace(/\bhouse\s*(\d{1,2})\b/gi, () => arena);
  t = t.replace(/\bhouse\s+(\d{1,2})\b/gi, () => arena);
  t = t.replace(/\bphase1_shadow:/gi, '');
  t = t.replace(/\bnatal\b/gi, 'inner');
  t = t.replace(/\bchart\b/gi, 'field');

  return t.replace(/\s+/g, ' ').trim();
}

function classBucket(classSlug: string): number {
  return hash32(classSlug) % 3;
}

const LABEL_BY_POSTURE: Record<
  ResponsePosture,
  readonly [readonly string[], readonly string[], readonly string[]]
> = {
  observe: [
    ['Hold the line of sight', 'Mark the field calmly', 'Read the room before steel enters'],
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
    ['Give the small costly thing', 'Answer pressure with offering', 'Let care take material form'],
  ],
  reframe: [
    ['Rename the pattern', 'Turn the story’s hinge', 'Shift the frame without flight'],
    ['Rewrite the meaning-skin', 'Find the gentler true', 'Bend interpretation, not fact'],
    ['Open a second reading', 'Loosen the old verdict', 'Let a new angle breathe'],
  ],
  contain: [
    ['Draw the smaller circle', 'Cap what you will carry', 'Fence the load you accept'],
    ['Bound the spill', 'Tighten scope to survive', 'Keep the fire in the hearth'],
    ['Limit the bleed', 'Choose the edge you defend', 'Shrink the battlefield'],
  ],
};

function realizedLabel(posture: ResponsePosture, classSlug: string, seed: string): string {
  const bucket = classBucket(classSlug);
  const variants = LABEL_BY_POSTURE[posture][bucket] ?? LABEL_BY_POSTURE[posture][0]!;
  return stableVariant(`${seed}|lbl|${posture}|${classSlug}`, [...variants]);
}

function realizedGesture(
  posture: ResponsePosture,
  domain: string,
  classSlug: string,
  risingSlug: string,
  seed: string,
  digest: CampaignExpressionDigest,
): string {
  const ctx = domainContext(domain);
  const lab = domainLabel(domain);
  const pol = digest.pressure.primary_pressure_polarity;
  const inten = coerceIntensityBand(digest.pressure.primary_intensity_band);
  const polT = polarityTone(pol);
  const urg = intensityUrgency(inten);
  const sub = risingSlug.replace(/^rising_/, '').slice(0, 12);
  const variants: Record<ResponsePosture, string[]> = {
    observe: [
      `In ${lab}, you keep ${ctx} readable while the field stays ${urg}: let ${polT} show its shape before you answer.`,
      `Hold ${ctx} in ${lab} open just long enough to see the real tradeoff under ${polT} pressure.`,
    ],
    assert: [
      `In ${lab}, speak one clean line so ${ctx} cannot stay implied while conditions read ${urg}.`,
      `Name what is true in ${lab} with a single decisive sentence; ${polT} light still sets the tempo.`,
    ],
    engage: [
      `Take one bounded advance in ${lab} that honors ${ctx} without pretending the room is cooler than ${urg}.`,
      `Move ${ctx} in ${lab} with a deliberate step sized for ${polT} pressure still running ${urg}.`,
    ],
    withdraw: [
      `Reduce exposure in ${lab} on purpose so ${ctx} can cool while the situation stays ${urg}.`,
      `Step back from the hottest contact in ${lab} until timing returns; ${polT} does not vanish, you choose distance.`,
    ],
    support: [
      `Bring a trusted second mind into ${lab} so ${ctx} is not carried alone while pressure stays ${urg}.`,
      `Let counsel steady ${ctx} in ${lab}; ${polT} reads softer when witness joins the frame.`,
    ],
    offer: [
      `Answer ${ctx} in ${lab} with a tangible gesture that matches ${polT} pressure without empty theater.`,
      `Put something real on the table for ${lab}; ${ctx} needs weight, not another abstraction.`,
    ],
    reframe: [
      `Shift the story you tell about ${lab} so ${ctx} can meet ${polT} pressure with more room to breathe.`,
      `Rename the frame around ${ctx} in ${lab}; interpretation moves first while intensity stays ${urg}.`,
    ],
    contain: [
      `Tighten what you will carry for ${lab} so ${ctx} stays inside a survivable edge while the field reads ${urg}.`,
      `Bound ${ctx} in ${lab} with a clear limit; ${polT} pressure respects smaller perimeters.`,
    ],
  };
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
  return stableVariant(`${seed}|risk|${posture}`, [
    `This stance favors ${impl} in ${lab} while the field stays ${urg}; ${trade} still sets the guardrail.`,
    `You buy ${impl} here under ${urg} pacing in ${lab}; the cost is that ${trade} remains in play.`,
  ]);
}

function realizeThemeLead(
  theme: string,
  digest: CampaignExpressionDigest,
  archetypeId: ArchetypeId,
  seed: string,
  slugs: CampaignSurfaceSlugs,
): string {
  const scrubbed = scrubAstroMechanics(theme, `${seed}|theme`, digest);
  const domain = digest.pressure.primary_domain_id;
  const lab = domainLabel(domain);
  const order = slugs.class_slug.replace(/^class_/, '').slice(0, 10);
  const exec = slugs.rising_modifier_slug.replace(/^rising_/, '').slice(0, 10);
  const frame = stableVariant(`${seed}|frame|${archetypeId}`, [
    `Your path (${order}, ${exec} cadence) meets ${lab} as a living beat, not a lecture.`,
    `The day asks ${lab} through your usual ${exec} stride while ${order} instincts stay in play.`,
  ]);
  return `${scrubbed} ${frame}`.replace(/\s+/g, ' ').trim();
}

function realizeObstacle(obstacle: string, digest: CampaignExpressionDigest, seed: string, slugs: CampaignSurfaceSlugs): string {
  const base = scrubAstroMechanics(obstacle, `${seed}|obs`, digest);
  const sub = slugs.subclass_slug.replace(/^subclass_/, '').slice(0, 12);
  const tail = stableVariant(`${seed}|obsTail`, [
    `The inner cadence (${sub}) keeps your private tradeoff thread visible under the same pressure.`,
    `Let the ${sub} undertone stay honest while you answer what the field is asking.`,
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
