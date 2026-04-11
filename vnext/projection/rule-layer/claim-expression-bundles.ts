/**
 * Phase 1 — static ClaimExpressionBundle table (projection-only).
 * Validated at module load; fail-closed lookup.
 */
import { CLAIM_IDS, type ClaimId } from '../../semantic/ontology-codes';

export type ClaimOptionalRole = 'mechanism' | 'experience' | 'variation' | 'implication';

export type ClaimExpressionBundle = {
  readonly core: string;
  readonly mechanism?: string;
  readonly experience?: string;
  readonly variation?: string;
  readonly implication?: string;
};

/** Substrings forbidden in bundle copy (layer separation). Case-insensitive scan. */
export const CLAIM_BUNDLE_FORBIDDEN_SUBSTRINGS: readonly string[] = [
  'motion feels quick and changeable',
  'motion feels slow and sustained',
  'motion feels moderate and steady',
  'the texture feels tight and crowded',
  'the texture feels open with room between moments',
  'the texture balances open and full',
  'energy surges then settles',
  'energy softens and releases over time',
  'energy builds and gathers',
  'energy circles and shifts rather than locking flat',
  'listening pressure feels heavy',
  'listening pressure feels light',
  'listening pressure feels moderate',
  'voices weave together smoothly',
  'one voice answers another in turns',
  'the interplay stays steady and held',
  'the interplay feels even and neutral',
  'cooperation feels strong',
  'cooperation feels moderate',
  'cooperation feels muted',
  'friction feels pronounced',
  'friction feels workable',
  'friction feels light',
  'contact feels intense',
  'contact feels moderate',
  'contact feels gentle',
  'a relational tone is present',
  'in this chart, you,',
  'for this connection, you,',
  'for this group, you,',
  'in this scenario, you,',
] as const;

const BANNED_ANCHOR_PREFIXES = [
  'in this chart, you,',
  'for this connection, you,',
  'for this group, you,',
  'in this scenario, you,',
] as const;

function assertPunctuation(s: string, label: string): void {
  const t = s.trim();
  if (!t) throw new Error(`[claim-expression-bundles] empty string: ${label}`);
  const last = t[t.length - 1];
  if (last !== '.' && last !== '?' && last !== '!') {
    throw new Error(`[claim-expression-bundles] malformed end punctuation in ${label}`);
  }
}

function assertNoForbidden(s: string, label: string): void {
  const lower = s.toLowerCase();
  for (const f of CLAIM_BUNDLE_FORBIDDEN_SUBSTRINGS) {
    if (lower.includes(f.toLowerCase())) {
      throw new Error(`[claim-expression-bundles] forbidden substring in ${label}: ${f}`);
    }
  }
  for (const p of BANNED_ANCHOR_PREFIXES) {
    if (lower.includes(p)) {
      throw new Error(`[claim-expression-bundles] forbidden anchor stem in ${label}: ${p}`);
    }
  }
}

function interpolateStrength(s: string, strong: boolean): string {
  const strength_clause = strong ? 'shows up strongly in this view' : 'shows up moderately in this view';
  const strength = strong ? 'strongly' : 'moderately';
  return s.replace(/\{strength_clause\}/g, strength_clause).replace(/\{strength\}/g, strength);
}

function bundle(
  id: string,
  core: string,
  mechanism: string,
  experience: string,
  variation?: string,
  implication?: string
): ClaimExpressionBundle {
  const optCount = [mechanism, experience, variation, implication].filter((x) => (x?.trim().length ?? 0) > 0).length;
  if (optCount < 1 || optCount > 3) {
    throw new Error(`[claim-expression-bundles] ${id}: optional slot count must be 1–3, got ${optCount}`);
  }
  const b: ClaimExpressionBundle = { core: core.trim(), mechanism: mechanism.trim(), experience: experience.trim() };
  const out = variation?.trim()
    ? ({ ...b, variation: variation.trim() } as ClaimExpressionBundle)
    : ({ ...b } as ClaimExpressionBundle);
  const withImp =
    implication?.trim() != null && implication!.trim().length > 0
      ? ({ ...out, implication: implication!.trim() } as ClaimExpressionBundle)
      : out;
  return withImp;
}

function validateInterpolatedBundle(id: ClaimId, b: ClaimExpressionBundle): void {
  for (const strong of [true, false]) {
    const walk = (s: string | undefined, label: string) => {
      if (s === undefined) return;
      const t = interpolateStrength(s, strong);
      assertPunctuation(t, `${id}.${label}`);
      assertNoForbidden(t, `${id}.${label}`);
    };
    walk(b.core, 'core');
    walk(b.mechanism, 'mechanism');
    walk(b.experience, 'experience');
    walk(b.variation, 'variation');
    walk(b.implication, 'implication');
  }
}

export class MissingClaimExpressionBundleError extends Error {
  constructor(id: string) {
    super(`MissingClaimExpressionBundleError: ${id}`);
    this.name = 'MissingClaimExpressionBundleError';
  }
}

export class InvalidClaimExpressionBundleError extends Error {
  constructor(msg: string) {
    super(`InvalidClaimExpressionBundleError: ${msg}`);
    this.name = 'InvalidClaimExpressionBundleError';
  }
}

/** Same polynomial as assemble-sections `hashSeed` / repetition-collapse. */
export function hash32(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

export function rotateArray<T>(arr: readonly T[], start: number): T[] {
  if (arr.length === 0) return [];
  const s = ((start % arr.length) + arr.length) % arr.length;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

const CLAIM_EXPRESSION_BUNDLES_RAW: Readonly<Record<ClaimId, ClaimExpressionBundle>> = {
  ELEMENT_FIRE_DOM: bundle(
    'ELEMENT_FIRE_DOM',
    'A fire-weighted emphasis {strength_clause} marks initiation and expressive heat as the emphasized register in this picture.',
    'Mechanistically, the label treats visible spark and quick starts as structural emphasis, not a verdict about temperament.',
    'Many people notice this thread as forward-leaning phrasing under load, even when the underlying story stays steady.'
  ),
  ELEMENT_EARTH_DOM: bundle(
    'ELEMENT_EARTH_DOM',
    'An earth-weighted emphasis {strength_clause} marks stepwise stabilization and tangible pacing as the emphasized register.',
    'Mechanistically, the label treats incremental adjustment and grounded sequencing as structural emphasis.',
    'Many people notice this thread as slower-to-shift wording that still moves once the steps feel clear.'
  ),
  ELEMENT_AIR_DOM: bundle(
    'ELEMENT_AIR_DOM',
    'An air-weighted emphasis {strength_clause} marks conceptual mobility and reframing as the emphasized register.',
    'Mechanistically, the label treats quick narration and idea-shifting as structural emphasis.',
    'Many people notice this thread as language-first processing before actions fully commit.'
  ),
  ELEMENT_WATER_DOM: bundle(
    'ELEMENT_WATER_DOM',
    'A water-weighted emphasis {strength_clause} marks permeability and layered processing as the emphasized register.',
    'Mechanistically, the label treats emotional bandwidth and depth-before-surface as structural emphasis.',
    'Many people notice this thread as sensitivity to nuance before outward closure.'
  ),
  ELEMENT_SECONDARY_FIRE: bundle(
    'ELEMENT_SECONDARY_FIRE',
    'A secondary fire thread {strength_clause} marks spark as a supporting lane, not the sole headline.',
    'Mechanistically, the label keeps initiation heat available without declaring it dominant.',
    'Many people notice this thread as occasional sharpness layered over a wider baseline mix.'
  ),
  ELEMENT_SECONDARY_EARTH: bundle(
    'ELEMENT_SECONDARY_EARTH',
    'A secondary earth thread {strength_clause} marks grounding as a supporting lane.',
    'Mechanistically, the label keeps incremental steadiness available without declaring it dominant.',
    'Many people notice this thread as practical brakes on drift rather than the whole story.'
  ),
  ELEMENT_SECONDARY_AIR: bundle(
    'ELEMENT_SECONDARY_AIR',
    'A secondary air thread {strength_clause} marks conceptual agility as a supporting lane.',
    'Mechanistically, the label keeps reframing capacity available without declaring it dominant.',
    'Many people notice this thread as extra language flexibility sitting beside a wider baseline mix.'
  ),
  ELEMENT_SECONDARY_WATER: bundle(
    'ELEMENT_SECONDARY_WATER',
    'A secondary water thread {strength_clause} marks permeability as a supporting lane.',
    'Mechanistically, the label keeps depth-first processing available without declaring it dominant.',
    'Many people notice this thread as added nuance sensitivity beside a wider baseline mix.'
  ),
  MODALITY_CARDINAL: bundle(
    'MODALITY_CARDINAL',
    'Cardinal modality emphasis {strength_clause} marks starts, pivots, and visible resets as structurally highlighted.',
    'Mechanistically, the label treats forward edges and initiative windows as the emphasized register.',
    'Many people notice this thread as push toward new chapters once momentum appears.'
  ),
  MODALITY_FIXED: bundle(
    'MODALITY_FIXED',
    'Fixed modality emphasis {strength_clause} marks holding power and sustained posture as structurally highlighted.',
    'Mechanistically, the label treats continuity and resistance to drift as the emphasized register.',
    'Many people notice this thread as steadier commitments once a stance is chosen.'
  ),
  MODALITY_MUTABLE: bundle(
    'MODALITY_MUTABLE',
    'Mutable modality emphasis {strength_clause} marks adaptation and retuning as structurally highlighted.',
    'Mechanistically, the label treats flexible response and iterative adjustment as the emphasized register.',
    'Many people notice this thread as quicker retakes when conditions shift.'
  ),
  TENSION_BAND_HIGH: bundle(
    'TENSION_BAND_HIGH',
    'Higher structural contrast {strength_clause} marks sharper alternation between emphasis beats as the highlighted register.',
    'Mechanistically, the label treats edge-rich alternation as structural emphasis without naming a crisis type.',
    'Many people notice this thread as sharper differences moment to moment, still bounded to the same picture.'
  ),
  TENSION_BAND_MED: bundle(
    'TENSION_BAND_MED',
    'Moderate structural contrast {strength_clause} marks workable friction as the highlighted register.',
    'Mechanistically, the label treats enough edge to move without constant spike signaling.',
    'Many people notice this thread as productive grit rather than smooth flatness.'
  ),
  TENSION_BAND_LOW: bundle(
    'TENSION_BAND_LOW',
    'Lower structural contrast {strength_clause} marks smoother continuity as the highlighted register.',
    'Mechanistically, the label treats fewer abrupt breaks between emphasis beats as structural emphasis.',
    'Many people notice this thread as gentler handoffs between themes.'
  ),
  TONAL_BRIGHT: bundle(
    'TONAL_BRIGHT',
    'A brighter tonal register {strength_clause} marks outward lift and possibility-forward shading as structurally highlighted.',
    'Mechanistically, the label treats highlight-first reading as the emphasized tonal lane.',
    'Many people notice this thread as lighter foregrounding before heavier details arrive.'
  ),
  TONAL_DARK: bundle(
    'TONAL_DARK',
    'A darker tonal register {strength_clause} marks depth-first shading and seriousness toward tension as structurally highlighted.',
    'Mechanistically, the label treats gravity-forward reading as the emphasized tonal lane.',
    'Many people notice this thread as weight honored before quick bright-side pivots.'
  ),
  TONAL_BALANCED: bundle(
    'TONAL_BALANCED',
    'A balanced tonal register {strength_clause} marks mixed brightness cues as structurally highlighted.',
    'Mechanistically, the label treats flexible tonal range rather than a single locked mood.',
    'Many people notice this thread as context-dependent shading without a forced average.'
  ),
  RESOLUTION_STRONG: bundle(
    'RESOLUTION_STRONG',
    'Strong resolution signaling {strength_clause} marks decisive release and closure bias as structurally highlighted.',
    'Mechanistically, the label treats firm finishing tendency as the emphasized register.',
    'Many people notice this thread as clearer endpoints once a pattern completes.'
  ),
  RESOLUTION_MODERATE: bundle(
    'RESOLUTION_MODERATE',
    'Moderate resolution signaling {strength_clause} marks workable closure pacing as structurally highlighted.',
    'Mechanistically, the label treats neither rushed nor stuck endings as the emphasized register.',
    'Many people notice this thread as middling patience with unfinished edges.'
  ),
  RESOLUTION_SOFT: bundle(
    'RESOLUTION_SOFT',
    'Soft resolution signaling {strength_clause} marks gradual release and open endings as structurally highlighted.',
    'Mechanistically, the label treats slower dissolve and softer landing as the emphasized register.',
    'Many people notice this thread as lingering resonance rather than a hard stop.'
  ),
  STRUCT_STELLIUM: bundle(
    'STRUCT_STELLIUM',
    'A clustered structural signature {strength_clause} marks concentrated emphasis through one thematic doorway.',
    'Mechanistically, the label treats many threads pulling through the same doorway as structural emphasis.',
    'Many people notice this thread as a single hotspot carrying multiple story lines.'
  ),
  STRUCT_ANGULAR_FIRST: bundle(
    'STRUCT_ANGULAR_FIRST',
    'Angular emphasis on the first house line {strength_clause} marks self-led framing as structurally highlighted.',
    'Mechanistically, the label treats identity-forward placement as the emphasized structural handle.',
    'Many people notice this thread as “self narrative first” without naming houses in technical jargon here.'
  ),
  STRUCT_ANGULAR_FOURTH: bundle(
    'STRUCT_ANGULAR_FOURTH',
    'Angular emphasis on the fourth-house line {strength_clause} marks roots-and-base framing as structurally highlighted.',
    'Mechanistically, the label treats foundation-forward placement as the emphasized structural handle.',
    'Many people notice this thread as anchor-and-base language rising first.'
  ),
  STRUCT_ANGULAR_SEVENTH: bundle(
    'STRUCT_ANGULAR_SEVENTH',
    'Angular emphasis on the seventh-house line {strength_clause} marks mirror-and-pair framing as structurally highlighted.',
    'Mechanistically, the label treats interface-forward placement as the emphasized structural handle.',
    'Many people notice this thread as relational mirroring language rising first.'
  ),
  STRUCT_ANGULAR_TENTH: bundle(
    'STRUCT_ANGULAR_TENTH',
    'Angular emphasis on the tenth-house line {strength_clause} marks role-and-direction framing as structurally highlighted.',
    'Mechanistically, the label treats public-facing placement as the emphasized structural handle.',
    'Many people notice this thread as stance-and-role language rising first.'
  ),
  STRUCT_LUMINARY_SUN: bundle(
    'STRUCT_LUMINARY_SUN',
    'Luminary weight leaning sun-ward {strength_clause} marks conscious focal emphasis as structurally highlighted.',
    'Mechanistically, the label treats daylight-forward emphasis as the emphasized register.',
    'Many people notice this thread as explicit, visible leadership of the story tone.'
  ),
  STRUCT_LUMINARY_MOON: bundle(
    'STRUCT_LUMINARY_MOON',
    'Luminary weight leaning moon-ward {strength_clause} marks receptive focal emphasis as structurally highlighted.',
    'Mechanistically, the label treats interior-led emphasis as the emphasized register.',
    'Many people notice this thread as needs-and-rhythm language steering first.'
  ),
  STRUCT_LUMINARY_BALANCED: bundle(
    'STRUCT_LUMINARY_BALANCED',
    'Balanced luminary weighting {strength_clause} marks neither pole monopolizing the structural headline.',
    'Mechanistically, the label treats dual focal balance as the emphasized register.',
    'Many people notice this thread as alternating visibility between two focal lanes.'
  ),
  STRUCT_ASPECT_TRINE_HEAVY: bundle(
    'STRUCT_ASPECT_TRINE_HEAVY',
    'Heavy trine-line emphasis {strength_clause} marks ease-forward flow as structurally highlighted.',
    'Mechanistically, the label treats fluent support geometry as the emphasized register.',
    'Many people notice this thread as paths of least resistance showing up often.'
  ),
  STRUCT_ASPECT_SQUARE_HEAVY: bundle(
    'STRUCT_ASPECT_SQUARE_HEAVY',
    'Heavy square-line emphasis {strength_clause} marks edge-forward activation as structurally highlighted.',
    'Mechanistically, the label treats productive friction geometry as the emphasized register.',
    'Many people notice this thread as recurring corners that still move things.'
  ),
  STRUCT_ASPECT_OPPOSITION_HEAVY: bundle(
    'STRUCT_ASPECT_OPPOSITION_HEAVY',
    'Heavy opposition-line emphasis {strength_clause} marks polar dialogue as structurally highlighted.',
    'Mechanistically, the label treats mirrored tension geometry as the emphasized register.',
    'Many people notice this thread as two-sided pulls that refuse a single-sided story.'
  ),
  CROSS_ELEMENT_DRIFT_HIGH: bundle(
    'CROSS_ELEMENT_DRIFT_HIGH',
    'High cross-chart elemental drift {strength_clause} marks divergent baseline styles as structurally highlighted.',
    'Mechanistically, the label treats different elemental baselines as co-present facts, not errors.',
    'Many people notice this thread as honest contrast risk when language blends too fast.'
  ),
  CROSS_TENSION_DELTA_HIGH: bundle(
    'CROSS_TENSION_DELTA_HIGH',
    'A large cross-chart tension delta {strength_clause} marks alternating stress profiles as structurally highlighted.',
    'Mechanistically, the label treats mismatched tension baselines as structural emphasis.',
    'Many people notice this thread as one unified arc fitting poorly if forced.'
  ),
  REL_HARMONY_HIGH: bundle(
    'REL_HARMONY_HIGH',
    'High harmony-band relational labeling {strength_clause} marks cooperative resonance as structurally highlighted between participants.',
    'Mechanistically, the label treats the harmony band as the emphasized relational register, not private motives.',
    'Many people notice this thread as easier mutual coordination when contact rises.'
  ),
  REL_HARMONY_MED: bundle(
    'REL_HARMONY_MED',
    'Mid harmony-band relational labeling {strength_clause} marks moderate cooperative resonance as structurally highlighted.',
    'Mechanistically, the label treats middling harmony-band emphasis as the relational register.',
    'Many people notice this thread as workable coordination without maximal ease.'
  ),
  REL_HARMONY_LOW: bundle(
    'REL_HARMONY_LOW',
    'Low harmony-band relational labeling {strength_clause} marks muted cooperative resonance as structurally highlighted.',
    'Mechanistically, the label treats reduced harmony-band emphasis as the relational register.',
    'Many people notice this thread as coordination asking for more explicit repair language.'
  ),
  REL_FRICTION_HIGH: bundle(
    'REL_FRICTION_HIGH',
    'High friction-band relational labeling {strength_clause} marks pronounced edge in contact as structurally highlighted.',
    'Mechanistically, the label treats the friction band as the emphasized relational register.',
    'Many people notice this thread as sharper misunderstandings when timing is ignored.'
  ),
  REL_FRICTION_MED: bundle(
    'REL_FRICTION_MED',
    'Mid friction-band relational labeling {strength_clause} marks workable edge in contact as structurally highlighted.',
    'Mechanistically, the label treats middling friction-band emphasis as the relational register.',
    'Many people notice this thread as negotiable tension rather than constant spike.'
  ),
  REL_FRICTION_LOW: bundle(
    'REL_FRICTION_LOW',
    'Low friction-band relational labeling {strength_clause} marks light edge in contact as structurally highlighted.',
    'Mechanistically, the label treats low friction-band emphasis as the relational register.',
    'Many people notice this thread as softer disagreement signals between participants.'
  ),
  REL_INTENSITY_HIGH: bundle(
    'REL_INTENSITY_HIGH',
    'High intensity-band relational labeling {strength_clause} marks amplified signal per interaction as structurally highlighted.',
    'Mechanistically, the label treats the intensity band as the emphasized relational register.',
    'Many people notice this thread as more signal per exchange, sharper or richer.'
  ),
  REL_INTENSITY_MED: bundle(
    'REL_INTENSITY_MED',
    'Mid intensity-band relational labeling {strength_clause} marks moderate signal per interaction as structurally highlighted.',
    'Mechanistically, the label treats middling intensity-band emphasis as the relational register.',
    'Many people notice this thread as neither quiet nor maximal amplification.'
  ),
  REL_INTENSITY_LOW: bundle(
    'REL_INTENSITY_LOW',
    'Low intensity-band relational labeling {strength_clause} marks gentle signal per interaction as structurally highlighted.',
    'Mechanistically, the label treats low intensity-band emphasis as the relational register.',
    'Many people notice this thread as softer amplification between participants.'
  ),
  MOTION_LABEL_SURGING: bundle(
    'MOTION_LABEL_SURGING',
    'A surging motion label {strength_clause} marks forward impulse and rapid ramps as structurally highlighted.',
    'Mechanistically, the label treats spend-and-surge cadence as the emphasized motion register.',
    'Many people notice this thread as quick ramps in how effort is applied.'
  ),
  MOTION_LABEL_RESTLESS: bundle(
    'MOTION_LABEL_RESTLESS',
    'A restless motion label {strength_clause} marks uneven pacing and frequent retunes as structurally highlighted.',
    'Mechanistically, the label treats jitter-forward cadence as the emphasized motion register.',
    'Many people notice this thread as many small corrections instead of one long glide.'
  ),
  MOTION_LABEL_QUIET_FLOW: bundle(
    'MOTION_LABEL_QUIET_FLOW',
    'A quiet-flow motion label {strength_clause} marks low-noise continuity as structurally highlighted.',
    'Mechanistically, the label treats smooth micro-movement as the emphasized motion register.',
    'Many people notice this thread as steady drift with few dramatic spikes.'
  ),
  MOTION_LABEL_INWARD: bundle(
    'MOTION_LABEL_INWARD',
    'An inward motion label {strength_clause} marks consolidation before outward visibility as structurally highlighted.',
    'Mechanistically, the label treats internal processing lead as the emphasized motion register.',
    'Many people notice this thread as private work ahead of public display.'
  ),
  MOTION_LABEL_STEADY: bundle(
    'MOTION_LABEL_STEADY',
    'A steady motion label {strength_clause} marks even pacing and predictable cadence as structurally highlighted.',
    'Mechanistically, the label treats stable throughput as the emphasized motion register.',
    'Many people notice this thread as fewer surprises in how effort lands.'
  ),
  GRAVITY_LABEL_ANCHORED: bundle(
    'GRAVITY_LABEL_ANCHORED',
    'Anchored gravity labeling {strength_clause} marks weighty emphasis and slower release as structurally highlighted.',
    'Mechanistically, the label treats heavy landing and delayed resolve as the emphasized gravity register.',
    'Many people notice this thread as conclusions that take their time to arrive.'
  ),
  GRAVITY_LABEL_WEIGHTED_SPARK: bundle(
    'GRAVITY_LABEL_WEIGHTED_SPARK',
    'Weighted-with-spark gravity labeling {strength_clause} marks serious tone with occasional lift as structurally highlighted.',
    'Mechanistically, the label treats mixed weight-and-glint as the emphasized gravity register.',
    'Many people notice this thread as gravity with brief bright accents.'
  ),
  GRAVITY_LABEL_FLOATING: bundle(
    'GRAVITY_LABEL_FLOATING',
    'Floating gravity labeling {strength_clause} marks low-drag emphasis and lighter landing as structurally highlighted.',
    'Mechanistically, the label treats reduced weight as the emphasized gravity register.',
    'Many people notice this thread as easier release once a beat completes.'
  ),
  GRAVITY_LABEL_LIGHT: bundle(
    'GRAVITY_LABEL_LIGHT',
    'Light gravity labeling {strength_clause} marks nimble resolution and quick release as structurally highlighted.',
    'Mechanistically, the label treats fast dissolve as the emphasized gravity register.',
    'Many people notice this thread as brief shadows rather than long shadows.'
  ),
  GRAVITY_LABEL_BALANCED: bundle(
    'GRAVITY_LABEL_BALANCED',
    'Balanced gravity labeling {strength_clause} marks neither extreme heavy nor extreme light as structurally highlighted.',
    'Mechanistically, the label treats middling resolve weight as the emphasized gravity register.',
    'Many people notice this thread as middling hang-time on emphasis.'
  ),
};

function validateAllBundlesAtLoad(): void {
  for (const id of CLAIM_IDS) {
    const b = CLAIM_EXPRESSION_BUNDLES_RAW[id];
    if (!b) throw new MissingClaimExpressionBundleError(id);
    if (!b.core?.trim()) throw new InvalidClaimExpressionBundleError(`${id}: missing core`);
    const optKeys: ClaimOptionalRole[] = ['mechanism', 'experience', 'variation', 'implication'];
    let n = 0;
    for (const k of optKeys) {
      const v = b[k];
      if (typeof v === 'string' && v.trim().length > 0) n++;
    }
    if (n < 1 || n > 3) throw new InvalidClaimExpressionBundleError(`${id}: optional count ${n}`);
    validateInterpolatedBundle(id, b);
  }
}

validateAllBundlesAtLoad();

export const CLAIM_EXPRESSION_BUNDLES: Readonly<Record<ClaimId, ClaimExpressionBundle>> = CLAIM_EXPRESSION_BUNDLES_RAW;

export function getClaimExpressionBundle(id: ClaimId): ClaimExpressionBundle {
  const b = CLAIM_EXPRESSION_BUNDLES[id];
  if (!b) throw new MissingClaimExpressionBundleError(id);
  return b;
}

export function applyStrengthInterpolation(s: string, claim: { strength: number }): string {
  const strong = claim.strength >= 0.66;
  return interpolateStrength(s, strong);
}

/** Exposed for tests — same ordering as selection algorithm step 1. */
export const CLAIM_OPTIONAL_ROLE_ORDER: readonly ClaimOptionalRole[] = [
  'mechanism',
  'experience',
  'variation',
  'implication',
] as const;

export function surfaceOffset(surface: import('../projection-types').ProjectionSurface): number {
  const m: Record<string, number> = {
    feed: 0,
    profile: 1,
    daily: 2,
    sandbox: 3,
    overlay_pair: 4,
    compat_pair: 5,
    group: 6,
    campaign: 7,
  };
  return m[surface] ?? 0;
}

export function tierOffset(tier: import('../projection-types').ExpansionTier): number {
  if (tier === 'baseline') return 0;
  if (tier === 'expanded') return 1;
  return 2;
}
