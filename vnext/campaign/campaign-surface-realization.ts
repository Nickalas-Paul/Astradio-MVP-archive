/**
 * Final Campaign surface copy: deterministic narrative realization over resolved truth.
 * Downstream-only: does not alter pressures, postures, outcome directions, or choice ids.
 */
import type { CampaignExpressionDigest } from '../projection/projection-types';
import type { ArchetypeId, ChallengeScene, ChoiceOption, ResponsePosture, TransitPressure } from '../rpg/types';
import { stableVariant } from '../rpg/projection-language';

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
  const idHint = identityExecutionHint(digest, `${seed}|idh`);
  const variants: Record<ResponsePosture, string[]> = {
    observe: [
      `Hold still and let the situation show its real shape before you answer. ${idHint}`,
      `Read the room before you commit; what this is really about has not fully surfaced. ${idHint}`,
    ],
    assert: [
      `Speak one clean line so nothing stays implied. ${idHint}`,
      `Name what is actually true before it names you. ${idHint}`,
    ],
    engage: [
      `Take one bounded advance you can finish today; the heat has not cooled and you move anyway. ${idHint}`,
      `Meet the pressure with a deliberate, concrete step sized for the moment. ${idHint}`,
    ],
    withdraw: [
      `Ease off the hottest edge on purpose until timing returns. ${idHint}`,
      `Step back and let things settle; you are choosing distance, not vanishing. ${idHint}`,
    ],
    support: [
      `Bring someone you trust into it so the swing is not solo. ${idHint}`,
      `Let a second mind see the same facts; witness softens the weight. ${idHint}`,
    ],
    offer: [
      `Answer with something tangible, not a speech; the moment needs weight, not theater. ${idHint}`,
      `Put a real gesture on the table, small and concrete over grand and empty. ${idHint}`,
    ],
    reframe: [
      `Step back and reframe the situation before the tension escalates; a new story opens options the first read kept hidden. ${idHint}`,
      `Shift the frame first; interpretation moves before the outward step does. ${idHint}`,
    ],
    contain: [
      `Tighten what you will carry so the strain stays inside a survivable edge. ${idHint}`,
      `Draw a clear limit; smaller perimeters are easier to defend. ${idHint}`,
    ],
  };
  const sub = risingSlug.replace(/^rising_/, '').slice(0, 12);
  const pool = variants[posture] ?? variants.observe;
  return stableVariant(`${seed}|gst|${posture}|${classSlug}|${sub}`, pool);
}

/** One-word display risk. Mechanical risk derivation lives elsewhere; this is presentation only. */
function realizedRisk(
  posture: ResponsePosture,
  domain: string,
  seed: string,
  digest: CampaignExpressionDigest,
): string {
  const inten = coerceIntensityBand(digest.pressure.primary_intensity_band);
  const hot = inten === 'high' || inten === 'critical';
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
    default:
      return 'Moderate';
  }
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
