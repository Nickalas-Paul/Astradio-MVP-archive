/**
 * Step 5 — claim synthesis (deterministic integration; no new claims).
 * ClaimExpressionBundle rendering; no generic claim fallback.
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import type {
  CampaignExpressionDigest,
  ExpansionTier,
  ProjectionOptions,
  ProjectionSurface,
} from '../projection-types';
import { campaignContinuityFromDigest } from '../campaign-lens-contract';
import { campaignExpressionDigestFromOptions } from '../campaign-expression-digest-guard';
import { projectionNormSentence } from './repetition-collapse-phase0';
import {
  applyStrengthInterpolation,
  CLAIM_OPTIONAL_ROLE_ORDER,
  type ClaimExpressionBundle,
  type ClaimOptionalRole,
  getClaimExpressionBundle,
  hash32,
  InvalidClaimExpressionBundleError,
  rotateArray,
} from './claim-expression-bundles';
import { listenVariantsForArcRole } from './claim-listen-variants';
import { pickInterClaimGlue } from './claim-inter-claim-glue';
import { claimWindow } from './claim-select';
import { reinforcementTier, sortClaimsDeterministic } from './claim-discipline';

function pickVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[h % variants.length];
}

function pushParagraphNormDeque(dq: string[], norm: string): void {
  dq.push(norm);
  while (dq.length > 6) dq.shift();
}

function pushSectionRoleDeque(dq: ClaimOptionalRole[], role: ClaimOptionalRole): void {
  dq.push(role);
  while (dq.length > 4) dq.shift();
}

function trimVariantArray(arr: readonly string[] | undefined): readonly string[] | null {
  if (!arr || arr.length === 0) return null;
  return arr;
}

/**
 * Deterministic phrase pick with deque collision handling. Never falls through to `variants[0]`:
 * final index is salted by `claimId`, `sectionId`, `slotIndex`, and deque length.
 */
export function selectPhraseFromRoleVariants(input: {
  readonly variants: readonly string[];
  readonly claimId: string;
  readonly role: ClaimOptionalRole | 'core';
  readonly slotKind: string;
  readonly seed: string;
  readonly claim: SemanticClaim;
  readonly paragraphNormDeque: string[];
  readonly sectionId: string;
  readonly slotIndex: number;
}): string {
  const { variants, claimId, role, slotKind, seed, claim, paragraphNormDeque, sectionId, slotIndex } = input;
  const interp = (raw: string) => applyStrengthInterpolation(raw.trim(), claim);
  const N = variants.length;
  if (N === 0) throw new InvalidClaimExpressionBundleError(`${claimId}: empty variant list for ${role}`);
  const start = hash32(`${seed}|${claimId}|${role}|${slotKind}`) % N;
  const salt = hash32(`${claimId}|${sectionId}|${slotIndex}|${role}`) % N;
  for (let attempt = 0; attempt < N; attempt++) {
    for (let k = 0; k < N; k++) {
      const idx = (start + k + attempt * 7 + salt) % N;
      const raw = variants[idx]!;
      const sent = interp(raw);
      if (!paragraphNormDeque.includes(projectionNormSentence(sent))) {
        return sent;
      }
    }
  }
  const dq = paragraphNormDeque.length;
  const finalIdx = (start + salt + dq + hash32(`${seed}|collision|${claimId}|${sectionId}|${slotKind}`)) % N;
  return interp(variants[finalIdx]!);
}

/** Arc register: mechanism-register copy vs listen-register realization (same arc slots). */
export type ArcRegister = 'mechanism' | 'listen';

/**
 * Mechanism-expression (`mep`) only: deterministic arc slots (binding → elaboration → modulation → integration).
 * Intra-block sentences joined with a single space. Inter-claim glue unchanged (`synthesizeClaimSentences`).
 */
/** Exported for tests — first `mep` blocks use arc rendering, not `renderClaimExpressionBlock`. */
export function renderMechanismArcBlock(input: {
  claim: SemanticClaim;
  index: number;
  n: number;
  sectionRoleDeque: ClaimOptionalRole[];
  paragraphNormDeque: string[];
  seed: string;
  sectionId: string;
  register?: ArcRegister;
}): { text: string; claim_id: string } {
  const { claim, index: i, n, sectionRoleDeque, paragraphNormDeque, seed, sectionId } = input;
  const register = input.register ?? 'mechanism';
  const id = claim.claim_id as ClaimId;
  const bundle = getClaimExpressionBundle(id);

  const pushDequeForSentence = (sentence: string, role: ClaimOptionalRole | null): void => {
    pushParagraphNormDeque(paragraphNormDeque, projectionNormSentence(sentence));
    if (role !== null) pushSectionRoleDeque(sectionRoleDeque, role);
  };

  const coreVariants = listenVariantsForArcRole(id, bundle, 'core', register);
  const sentences: string[] = [];

  if (n === 1) {
    const coreSent = selectPhraseFromRoleVariants({
      variants: coreVariants,
      claimId: id,
      role: 'core',
      slotKind: 'mep_core',
      seed,
      claim,
      paragraphNormDeque,
      sectionId,
      slotIndex: i,
    });
    sentences.push(coreSent);
    pushDequeForSentence(coreSent, null);
    const mechArr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'mechanism', register));
    const expArr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'experience', register));
    if (mechArr) {
      const elaboration = selectPhraseFromRoleVariants({
        variants: mechArr,
        claimId: id,
        role: 'mechanism',
        slotKind: 'mep_elaboration_mechanism',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex: i,
      });
      sentences.push(elaboration);
      pushDequeForSentence(elaboration, 'mechanism');
    } else if (expArr) {
      const elaboration = selectPhraseFromRoleVariants({
        variants: expArr,
        claimId: id,
        role: 'experience',
        slotKind: 'mep_elaboration_experience',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex: i,
      });
      sentences.push(elaboration);
      pushDequeForSentence(elaboration, 'experience');
    }
    const implArr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'implication', register));
    if (implArr) {
      const implSent = selectPhraseFromRoleVariants({
        variants: implArr,
        claimId: id,
        role: 'implication',
        slotKind: 'mep_implication',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex: i,
      });
      sentences.push(implSent);
      pushDequeForSentence(implSent, 'implication');
    }
  } else if (i === 0) {
    const coreSent = selectPhraseFromRoleVariants({
      variants: coreVariants,
      claimId: id,
      role: 'core',
      slotKind: 'mep_core',
      seed,
      claim,
      paragraphNormDeque,
      sectionId,
      slotIndex: i,
    });
    sentences.push(coreSent);
    pushDequeForSentence(coreSent, null);
    const mechArr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'mechanism', register));
    const expArr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'experience', register));
    if (mechArr) {
      const elaboration = selectPhraseFromRoleVariants({
        variants: mechArr,
        claimId: id,
        role: 'mechanism',
        slotKind: 'mep_elaboration_mechanism',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex: i,
      });
      sentences.push(elaboration);
      pushDequeForSentence(elaboration, 'mechanism');
    } else if (expArr) {
      const elaboration = selectPhraseFromRoleVariants({
        variants: expArr,
        claimId: id,
        role: 'experience',
        slotKind: 'mep_elaboration_experience',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex: i,
      });
      sentences.push(elaboration);
      pushDequeForSentence(elaboration, 'experience');
    }
  } else if (i === n - 1) {
    const mod = modulationMaterial(bundle, claim, id, seed, paragraphNormDeque, register, sectionId, i);
    sentences.push(mod.sentence);
    pushDequeForSentence(mod.sentence, mod.dequeRole);
    const implArr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'implication', register));
    if (implArr) {
      const implSent = selectPhraseFromRoleVariants({
        variants: implArr,
        claimId: id,
        role: 'implication',
        slotKind: 'mep_implication',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex: i,
      });
      sentences.push(implSent);
      pushDequeForSentence(implSent, 'implication');
    }
  } else {
    const mod = modulationMaterial(bundle, claim, id, seed, paragraphNormDeque, register, sectionId, i);
    sentences.push(mod.sentence);
    pushDequeForSentence(mod.sentence, mod.dequeRole);
  }

  return { text: sentences.join(' '), claim_id: id };
}

function modulationMaterial(
  bundle: ClaimExpressionBundle,
  claim: SemanticClaim,
  claimId: string,
  seed: string,
  paragraphNormDeque: string[],
  register: ArcRegister,
  sectionId: string,
  slotIndex: number
): { sentence: string; dequeRole: ClaimOptionalRole | null } {
  const id = claimId as ClaimId;
  const varr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'variation', register));
  if (varr) {
    return {
      sentence: selectPhraseFromRoleVariants({
        variants: varr,
        claimId,
        role: 'variation',
        slotKind: 'mep_modulation_variation',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex,
      }),
      dequeRole: 'variation',
    };
  }
  const earr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'experience', register));
  if (earr) {
    return {
      sentence: selectPhraseFromRoleVariants({
        variants: earr,
        claimId,
        role: 'experience',
        slotKind: 'mep_modulation_experience',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex,
      }),
      dequeRole: 'experience',
    };
  }
  const marr = trimVariantArray(listenVariantsForArcRole(id, bundle, 'mechanism', register));
  if (marr) {
    return {
      sentence: selectPhraseFromRoleVariants({
        variants: marr,
        claimId,
        role: 'mechanism',
        slotKind: 'mep_modulation_mechanism',
        seed,
        claim,
        paragraphNormDeque,
        sectionId,
        slotIndex,
      }),
      dequeRole: 'mechanism',
    };
  }
  const coreListen = listenVariantsForArcRole(id, bundle, 'core', register);
  return {
    sentence: selectPhraseFromRoleVariants({
      variants: coreListen,
      claimId,
      role: 'core',
      slotKind: 'mep_modulation_fallback_core',
      seed,
      claim,
      paragraphNormDeque,
      sectionId,
      slotIndex,
    }),
    dequeRole: null,
  };
}

function pickSecondarySentence(args: {
  bundle: ClaimExpressionBundle;
  id: ClaimId;
  localIndex: number;
  seed: string;
  surface: ProjectionSurface;
  tier: ExpansionTier;
  claim: SemanticClaim;
  sectionRoleDeque: ClaimOptionalRole[];
  paragraphNormDeque: string[];
  sectionId: string;
}): { role: ClaimOptionalRole; sentence: string } {
  const { bundle: b, id, seed, claim, sectionRoleDeque, paragraphNormDeque, sectionId, localIndex } = args;
  const candidates: ClaimOptionalRole[] = [];
  for (const r of CLAIM_OPTIONAL_ROLE_ORDER) {
    const t = b[r];
    if (Array.isArray(t) && t.length > 0) candidates.push(r);
  }
  if (candidates.length === 0) {
    throw new InvalidClaimExpressionBundleError(`${id}: no optional roles`);
  }
  const R = hash32(`${seed}|${id}|secondary_role_ring`);
  const k = R % candidates.length;
  const ordered2 = rotateArray(candidates, k);

  let chosen: ClaimOptionalRole | null = null;
  for (const role of ordered2) {
    if (sectionRoleDeque.includes(role)) continue;
    const sent = selectPhraseFromRoleVariants({
      variants: b[role]!,
      claimId: id,
      role,
      slotKind: 'secondary',
      seed,
      claim,
      paragraphNormDeque,
      sectionId,
      slotIndex: localIndex,
    });
    if (paragraphNormDeque.includes(projectionNormSentence(sent))) continue;
    chosen = role;
    break;
  }
  if (chosen === null) {
    chosen = ordered2[0]!;
  }
  const sentence = selectPhraseFromRoleVariants({
    variants: b[chosen]!,
    claimId: id,
    role: chosen,
    slotKind: 'secondary',
    seed,
    claim,
    paragraphNormDeque,
    sectionId,
    slotIndex: localIndex,
  });
  return { role: chosen, sentence };
}

export function renderClaimExpressionBlock(input: {
  claim: SemanticClaim;
  localIndex: number;
  seed: string;
  surface: ProjectionSurface;
  tier: ExpansionTier;
  sectionRoleDeque: ClaimOptionalRole[];
  paragraphNormDeque: string[];
  sectionId: string;
}): { text: string; secondaryRole: ClaimOptionalRole; claim_id: string } {
  const { claim, localIndex, seed, surface, tier, sectionRoleDeque, paragraphNormDeque, sectionId } = input;
  const id = claim.claim_id as ClaimId;
  const bundle = getClaimExpressionBundle(id);
  const coreSentence = selectPhraseFromRoleVariants({
    variants: bundle.core,
    claimId: id,
    role: 'core',
    slotKind: 'block_core',
    seed,
    claim,
    paragraphNormDeque,
    sectionId,
    slotIndex: localIndex,
  });
  pushParagraphNormDeque(paragraphNormDeque, projectionNormSentence(coreSentence));

  const { role, sentence } = pickSecondarySentence({
    bundle,
    id,
    localIndex,
    seed,
    surface,
    tier,
    claim,
    sectionRoleDeque,
    paragraphNormDeque,
    sectionId,
  });

  pushSectionRoleDeque(sectionRoleDeque, role);
  pushParagraphNormDeque(paragraphNormDeque, projectionNormSentence(sentence));

  const text = `${coreSentence} ${sentence}`;
  return { text, secondaryRole: role, claim_id: id };
}

export function capToMaxSentences(body: string, maxSentences: number): string {
  const t = body.trim();
  if (!t) return t;
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= maxSentences) return t;
  return parts.slice(0, maxSentences).join(' ');
}

export function synthesizeClaimSentences(lines: string[], claimIds: string[], seed: string): string {
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];
  const parts: string[] = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    parts.push(
      pickInterClaimGlue(claimIds[i - 1] ?? '', claimIds[i] ?? '', `${seed}:${i}`, i)
    );
    parts.push(lines[i]);
  }
  return parts.join(' ');
}

export function claimSentencesFromRange(
  core: SemanticCore,
  start: number,
  maxCount: number,
  seed: string,
  surface: ProjectionSurface,
  tier: ExpansionTier,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[],
  sectionId: string,
  excludeClaimIds?: Set<string>
): { text: string; claimIds: string[] } {
  const lines: string[] = [];
  const ids: string[] = [];
  const excl = excludeClaimIds ?? new Set<string>();
  let localIndex = 0;
  for (let i = start; i < core.claims.length && lines.length < maxCount; i++) {
    const c = core.claims[i];
    if (excl.has(c.claim_id)) continue;
    const block = renderClaimExpressionBlock({
      claim: c,
      localIndex,
      seed: `${seed}|${c.claim_id}|slice`,
      surface,
      tier,
      sectionRoleDeque,
      paragraphNormDeque,
      sectionId,
    });
    localIndex++;
    lines.push(block.text);
    ids.push(c.claim_id);
  }
  return { text: synthesizeClaimSentences(lines, ids, `${seed}:synrng`), claimIds: ids };
}

function pickSupportingFromMechanismSlice(
  core: SemanticCore,
  tier: ExpansionTier,
  dominantClaims: readonly SemanticClaim[],
  excludeClaimIds: ReadonlySet<string>,
  maxSupportingTier: 2 | 3 | 4,
  need: number
): SemanticClaim[] {
  const S = core.claims.slice(0, claimWindow(tier));
  const acc: SemanticClaim[] = [];
  for (const c of S) {
    if (excludeClaimIds.has(c.claim_id)) continue;
    const t = reinforcementTier(c, dominantClaims, core);
    if (t === null || t > maxSupportingTier) continue;
    acc.push(c);
  }
  return sortClaimsDeterministic(acc).slice(0, need);
}

export function buildClaimMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier,
  surface: ProjectionSurface,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[],
  sectionId: string,
  mechanismSliceOverride?: readonly SemanticClaim[]
): { text: string; claimIds: string[]; orderedClaims: readonly SemanticClaim[] } {
  const slice = mechanismSliceOverride ?? core.claims.slice(0, claimWindow(tier));
  const lines: string[] = [];
  const ids: string[] = [];
  const maxLines = tier === 'baseline' ? 3 : tier === 'expanded' ? 5 : 8;
  const ordered: SemanticClaim[] = [];
  for (let i = 0; i < slice.length && ordered.length < maxLines; i++) {
    ordered.push(slice[i]!);
  }
  const blockCount = ordered.length;
  for (let i = 0; i < ordered.length; i++) {
    const block = renderMechanismArcBlock({
      claim: ordered[i]!,
      index: i,
      n: blockCount,
      sectionRoleDeque,
      paragraphNormDeque,
      seed: `${seed}|${ordered[i]!.claim_id}|mep`,
      sectionId,
    });
    lines.push(block.text);
    ids.push(block.claim_id);
  }
  return {
    text: synthesizeClaimSentences(lines, ids, `${seed}:mep`),
    claimIds: ids,
    orderedClaims: ordered,
  };
}

function mechanismSliceIndexOfClaimId(slice: readonly SemanticClaim[], claimId: string): number {
  return slice.findIndex((c) => c.claim_id === claimId);
}

/**
 * Controlled mechanism-expression paragraph: dominant prefix, then Tier 1–2 supporting tail only.
 * `localIndex` for rendering always equals the claim's index within the mechanism slice
 * (`mechanismSliceOverride` or `core.claims.slice(0, claimWindow(tier))`).
 */
export function buildControlledMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier,
  surface: ProjectionSurface,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[],
  dominantClaimIds: readonly string[],
  sectionId: string,
  mechanismSliceOverride?: readonly SemanticClaim[]
): { text: string; claimIds: string[]; orderedClaims: readonly SemanticClaim[] } {
  if (dominantClaimIds.length === 0) {
    return buildClaimMechanismExpressionParagraph(
      core,
      seed,
      tier,
      surface,
      sectionRoleDeque,
      paragraphNormDeque,
      sectionId,
      mechanismSliceOverride
    );
  }
  const slice = mechanismSliceOverride ?? core.claims.slice(0, claimWindow(tier));
  const maxLines = tier === 'baseline' ? 3 : tier === 'expanded' ? 5 : 8;

  const dominantOrdered: SemanticClaim[] = [];
  const seenDomId = new Set<string>();
  for (const id of dominantClaimIds) {
    if (seenDomId.has(id)) continue;
    const ix = mechanismSliceIndexOfClaimId(slice, id);
    if (ix < 0) continue;
    seenDomId.add(id);
    dominantOrdered.push(slice[ix]!);
  }

  const dominantClaimsUnique: SemanticClaim[] = [];
  const seenRel = new Set<string>();
  for (const id of dominantClaimIds) {
    const ix = mechanismSliceIndexOfClaimId(slice, id);
    if (ix < 0 || seenRel.has(id)) continue;
    seenRel.add(id);
    dominantClaimsUnique.push(slice[ix]!);
  }

  const R_prefix = Math.min(dominantOrdered.length, maxLines);
  const used = new Set<string>();
  const ordered: SemanticClaim[] = [];

  for (let p = 0; p < R_prefix; p++) {
    const c = dominantOrdered[p]!;
    used.add(c.claim_id);
    ordered.push(c);
  }

  const tailPool: SemanticClaim[] = [];
  for (const c of slice) {
    if (used.has(c.claim_id)) continue;
    const t = reinforcementTier(c, dominantClaimsUnique, core);
    if (t === null || t > 2) continue;
    tailPool.push(c);
  }
  const tailSorted = sortClaimsDeterministic(tailPool);
  for (const c of tailSorted) {
    if (ordered.length >= maxLines) break;
    used.add(c.claim_id);
    ordered.push(c);
  }

  const blockCount = ordered.length;
  const lines: string[] = [];
  const ids: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i]!;
    const block = renderMechanismArcBlock({
      claim: c,
      index: i,
      n: blockCount,
      sectionRoleDeque,
      paragraphNormDeque,
      seed: `${seed}|${c.claim_id}|mep`,
      sectionId,
    });
    lines.push(block.text);
    ids.push(block.claim_id);
  }

  return {
    text: synthesizeClaimSentences(lines, ids, `${seed}:mep`),
    claimIds: ids,
    orderedClaims: ordered,
  };
}

export function buildTensionIntegrationParagraph(
  core: SemanticCore,
  seed: string
): { text: string; claimIds: string[] } | null {
  const challenging = core.claims.filter((c) => c.polarity === 'challenging').slice(0, 4);
  const constructive = core.claims.filter((c) => c.polarity === 'constructive').slice(0, 4);
  if (challenging.length === 0 || constructive.length === 0) return null;
  const cIds = [...constructive.map((c) => c.claim_id), ...challenging.map((c) => c.claim_id)];
  const text = pickVariant(seed + ':ti', [
    `Taken together, supportive and challenging signals both appear in this picture; this configuration tends to benefit from naming friction without treating it as the whole story, while still honoring care where it shows up.`,
    `This picture mixes supportive and challenging emphases; many people with this mix find that integration works best when neither side is forced to "win." Keep pacing cues tied to the main listen read below. That shapes how repair and forward motion take turns as the contrast lands.`,
  ]);
  return { text, claimIds: cIds };
}

/** Campaign moment: Entry (situational) → Contact (geometry + shape/visibility + optional group) → Pressure Lock (constraint + optional continuity). */
const CAMPAIGN_MOMENT_FORBIDDEN = [
  'Scenario pressure',
  'Response shape',
  'your chart',
  'natal promise',
  'self-care',
  'remember to',
  'journey',
  'TENSION_BAND_',
  'MOTION_LABEL_',
  'identity field',
  'relational space',
  'dynamic of responsibility',
  'consider ',
  'it helps to',
  'try to ',
  'you might want',
] as const;

const STANCE_KEYS = ['ground', 'probe', 'edge', 'hold', 'weave', 'strike', 'shelter', 'scan'] as const;

/** Lowercase + slug normalization; used before every digest-driven table lookup. */
function normalizeSlugKey(raw: string): string {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_').replace(/_+/g, '_');
  return t.replace(/^_+|_+$/g, '') || 'neutral';
}

const PRESSURE_DOMAIN_KEYS = new Set([
  'self',
  'assets',
  'communication',
  'home',
  'creativity',
  'work',
  'partnership',
  'transformation',
  'belief',
  'career',
  'community',
  'subconscious',
  'neutral',
]);

function normalizePressureDomainId(raw: string): string {
  const k = normalizeSlugKey(raw);
  return PRESSURE_DOMAIN_KEYS.has(k) ? k : 'neutral';
}

const INTENSITY_KEYS = new Set(['low', 'moderate', 'high', 'critical', 'neutral']);

function normalizeIntensityBand(raw: string): string {
  const k = normalizeSlugKey(raw);
  return INTENSITY_KEYS.has(k) ? k : 'neutral';
}

const INTERACTION_KEYS = new Set([
  'none',
  'reinforcing',
  'cross_pressuring',
  'escalating',
  'dissolving',
  'transforming',
  'neutral',
]);

function normalizeInteractionType(raw: string): string {
  const k = normalizeSlugKey(raw);
  return INTERACTION_KEYS.has(k) ? k : 'neutral';
}

const MOTION_KEYS = new Set([
  'neutral',
  'steady',
  'surging',
  'restless',
  'quiet_flow',
  'inward_consolidation',
  'balanced',
]);

function normalizeMotionProfile(raw: string): string {
  const k = normalizeSlugKey(raw);
  return MOTION_KEYS.has(k) ? k : 'neutral';
}

const LUMINARY_KEYS = new Set(['sun', 'moon', 'balanced', 'neutral']);

function normalizeLuminaryWeight(raw: string): string {
  const k = normalizeSlugKey(raw);
  return LUMINARY_KEYS.has(k) ? k : 'neutral';
}

const PRESSURE_FAMILY_KEYS = new Set([
  'identity',
  'emotional',
  'cognitive',
  'value',
  'conflict',
  'expansion',
  'constraint',
  'disruption',
  'dissolution',
  'transformation',
  'wound',
  'directional',
  'recurrence',
  'neutral',
]);

function normalizePressureFamily(raw: string): string {
  const k = normalizeSlugKey(raw);
  return PRESSURE_FAMILY_KEYS.has(k) ? k : 'neutral';
}

const POLARITY_KEYS = new Set(['constructive', 'frictional', 'volatile', 'binding', 'neutral']);

function normalizePressurePolarity(raw: string): string {
  const k = normalizeSlugKey(raw);
  return POLARITY_KEYS.has(k) ? k : 'neutral';
}

const EXPOSURE_BUCKETS = ['seen', 'contained', 'escalating'] as const;

/** Situational containers: activity / condition in progress — not abstract domain labels. */
const SITUATION_FRAME: Record<string, Record<string, readonly string[]>> = {
  neutral: {
    neutral: [
      'A live pass is already running where pressure meets routine, and the room stays active.',
      'Something is already in motion on the floor: load shows up as steady work in progress.',
    ],
    low: [
      'A quiet pass is underway: small tasks repeat until the pattern fills the window.',
      'The beat is already moving at low throttle while the schedule keeps turning.',
    ],
    moderate: [
      'A standard operating pass is open: exchanges and checks are already cycling.',
      'The shift is already live: work is moving through the queue in plain sight.',
    ],
    high: [
      'A hot pass is already open: deadlines and handoffs are stacking in real time.',
      'The window is already active: pressure shows up as visible throughput on the floor.',
    ],
    critical: [
      'A critical pass is already engaged: the line is live and the cap is visible.',
      'The moment is already tight: the edge is in play and the floor is fixed.',
    ],
  },
  self: {
    low: [
      'A private calibration is already underway: you are testing stance while the room stays small.',
      'Self-check is already live: small adjustments repeat until the read stabilizes.',
    ],
    moderate: [
      'A self-definition pass is already running: you are naming limits while the beat stays steady.',
      'Identity work is already in motion: you are holding a line while the window stays open.',
    ],
    high: [
      'A self-test is already hot: you are proving stance under load while the room watches.',
      'Identity pressure is already active: you are tightening the frame while the edge stays sharp.',
    ],
    critical: [
      'A self-boundary pass is already critical: the line is non-negotiable and the cap is now.',
      'Identity load is already at the ceiling: you hold the floor while the window stays fixed.',
    ],
    neutral: [
      'A self pass is already underway while the beat stays readable.',
      'Self work is already moving through the window in plain sight.',
    ],
  },
  partnership: {
    low: [
      'A low-stakes exchange is already open: messages move while the room stays soft.',
      'Partnership pacing is already live: small signals trade until the thread steadies.',
    ],
    moderate: [
      'A live exchange is already running: two tracks share airtime while reciprocity stays on the table.',
      'Partnership work is already in motion: contact is cycling while the floor stays negotiated.',
    ],
    high: [
      'A high-contact pass is already open: signals cross in real time while the exchange floor stays hot.',
      'Partnership load is already active: bids and boundaries trade while the edge stays visible.',
    ],
    critical: [
      'A binding exchange pass is already critical: the line is fixed and the cap on drift is non-negotiable.',
      'Partnership pressure is already at the limit: hold the floor while the window stays tight.',
    ],
    neutral: [
      'Partnership activity is already underway while contact stays legible.',
      'A relational pass is already live on the exchange floor.',
    ],
  },
  work: {
    low: [
      'A light-duty shift is already moving: tasks repeat while the queue stays shallow.',
      'Work pacing is already live: small throughput cycles until the board clears.',
    ],
    moderate: [
      'A duty pass is already running: handoffs and deadlines are cycling while systems stay under load.',
      'Work is already in motion: the queue is live while responsibility stays visible on the floor.',
    ],
    high: [
      'A surge shift is already open: throughput stacks while the schedule tightens under pressure.',
      'Work is already hot: multiple owners touch the same line while the cap on slack is gone.',
    ],
    critical: [
      'A critical duty pass is already engaged: the line holds and the ceiling on delay is fixed.',
      'Work pressure is already at the edge: the floor is non-negotiable while throughput stays bounded.',
    ],
    neutral: [
      'Work activity is already underway while the queue stays readable.',
      'A systems pass is already live on the duty floor.',
    ],
  },
  communication: {
    low: ['A soft signal pass is already open: messages drift while the channel stays quiet.'],
    moderate: [
      'A live signal pass is already running: traffic is moving while the line stays contested.',
      'Communication load is already in motion: exchanges cycle while the floor stays hot.',
    ],
    high: [
      'A high-noise channel is already live: signals stack while the edge on clarity stays sharp.',
    ],
    critical: [
      'A critical comms pass is already engaged: the cap on noise is fixed and the line holds.',
    ],
    neutral: ['A communication pass is already underway while the channel stays active.'],
  },
  assets: {
    low: ['A light resource pass is already moving: balances shift while the ledger stays open.'],
    moderate: [
      'A resource pass is already running: commitments trade while the floor on spend stays visible.',
    ],
    high: ['A tight resource window is already live: outflows and inflows cross while the cap tightens.'],
    critical: ['A critical resource pass is already engaged: the line on outflow is fixed and the floor holds.'],
    neutral: ['Resource activity is already underway while the ledger stays legible.'],
  },
  home: {
    low: ['A quiet home pass is already open: routines repeat while the private floor stays steady.'],
    moderate: ['A home-base pass is already running: shelter and duty trade while the threshold stays active.'],
    high: ['A loaded home window is already live: private demands stack while the edge on rest tightens.'],
    critical: ['A critical home pass is already engaged: the line on shelter is fixed and the floor holds.'],
    neutral: ['Home activity is already underway while the private floor stays active.'],
  },
  creativity: {
    low: ['A light creative pass is already open: drafts move while exposure stays low.'],
    moderate: ['A creative pass is already running: output cycles while risk stays on the table.'],
    high: ['A hot creative window is already live: exposure stacks while the edge on output tightens.'],
    critical: ['A critical creative pass is already engaged: the line on exposure is fixed and the cap holds.'],
    neutral: ['Creative work is already underway while the studio floor stays live.'],
  },
  transformation: {
    low: ['A slow threshold pass is already open: stakes tick while the exchange stays controlled.'],
    moderate: ['A threshold pass is already running: trade and depth cycle while the floor stays negotiated.'],
    high: ['A hot threshold window is already live: stakes stack while the edge on exchange tightens.'],
    critical: ['A critical threshold pass is already engaged: the line on depth is fixed and the bind holds.'],
    neutral: ['Threshold activity is already underway while the exchange floor stays active.'],
  },
  belief: {
    low: ['A quiet horizon pass is already open: frames shift while meaning stays steady.'],
    moderate: ['A horizon pass is already running: meaning cycles while the line stays contested.'],
    high: ['A loaded horizon window is already live: frames stack while the edge on direction tightens.'],
    critical: ['A critical horizon pass is already engaged: the line on meaning is fixed and the floor holds.'],
    neutral: ['Horizon work is already underway while the frame stays live.'],
  },
  career: {
    low: ['A light visibility pass is already open: role signals move while exposure stays low.'],
    moderate: ['A role pass is already running: visibility cycles while the line on reputation stays active.'],
    high: ['A hot role window is already live: visibility stacks while the edge on standing tightens.'],
    critical: ['A critical role pass is already engaged: the line on visibility is fixed and the cap holds.'],
    neutral: ['Role activity is already underway while the public floor stays live.'],
  },
  community: {
    low: ['A light collective pass is already open: threads move while the shared floor stays soft.'],
    moderate: ['A collective pass is already running: group throughput cycles while the line stays contested.'],
    high: ['A hot collective window is already live: shared load stacks while the edge on contribution tightens.'],
    critical: ['A critical collective pass is already engaged: the line on shared load is fixed and the floor holds.'],
    neutral: ['Collective activity is already underway while the shared floor stays active.'],
  },
  subconscious: {
    low: ['A quiet undercurrent pass is already open: signals move below deck while the surface stays steady.'],
    moderate: ['An undercurrent pass is already running: inner signals cycle while the line stays active.'],
    high: ['A loaded undercurrent window is already live: inner pressure stacks while the edge tightens.'],
    critical: ['A critical undercurrent pass is already engaged: the line on inner load is fixed and the floor holds.'],
    neutral: ['Undercurrent activity is already underway while the inner floor stays live.'],
  },
};

/** Kinetic only: movement, pacing, pressure mechanics — no tone or evaluation. */
const KINETIC_CARRIER: Record<string, readonly string[]> = {
  'neutral|neutral|none': [
    'Pacing stays metered while a single vector carries the load.',
    'Throughput moves on one rail while the tempo stays even.',
  ],
  'neutral|moderate|none': [
    'Cadence holds steady while one lane carries the bulk of the pressure.',
    'The tempo stays clocked while a single vector pulls the weight.',
  ],
  'neutral|high|none': [
    'Cadence compresses while one lane spikes and the load stacks fast.',
    'The tempo tightens while a single vector surges through the window.',
  ],
  'neutral|critical|none': [
    'The tempo locks while one vector hits the ceiling and the rail stops widening.',
    'Pacing clamps while a single lane maxes and the stack stops spreading.',
  ],
  'surging|high|reinforcing': [
    'Momentum stacks on parallel rails while reinforcement doubles the push rate.',
    'Surge pacing feeds the same vector twice while throughput spikes in lockstep.',
  ],
  'surging|high|cross_pressuring': [
    'Surge pacing pulls two rails apart while cross-pressure jerks the tempo.',
    'Fast throughput splits across divergent vectors while pacing fights itself.',
  ],
  'restless|high|escalating': [
    'Restless pacing accelerates while stacks compound and the window shortens.',
    'The tempo ratchets upward while escalation feeds stack height in tight loops.',
  ],
  'quiet_flow|low|none': [
    'Flow pacing widens gaps while the vector spreads without stacking.',
    'Quiet throughput stretches the beat while load stays diffuse.',
  ],
  'inward_consolidation|moderate|none': [
    'Consolidation pacing pulls load inward while the outer rail thins.',
    'Inward tempo gathers slack while a single vector absorbs the drift.',
  ],
  'neutral|moderate|reinforcing': [
    'Reinforcement stacks pacing on the same rail while duplicate pushes add weight.',
    'Twin pulses hit one lane while cadence thickens on the same vector.',
  ],
  'neutral|moderate|cross_pressuring': [
    'Split pacing runs two rails while vectors pull tempo in opposite directions.',
    'Cross-vectors shear cadence while throughput fights across lanes.',
  ],
  'neutral|high|escalating': [
    'Escalation pacing tightens loops while stack height climbs each cycle.',
    'The tempo feeds back on itself while load compounds in short intervals.',
  ],
  'neutral|moderate|dissolving': [
    'Dissolving pacing widens spacing while vectors bleed speed into the floor.',
    'Load spreads as cadence loosens and the push thins across the window.',
  ],
  'neutral|moderate|transforming': [
    'Transform pacing shifts rails mid-window while vectors remap without stopping.',
    'Throughput reroutes while tempo holds and the load changes shape on the fly.',
  ],
};

function resolveKineticCarrierLines(motion: string, intensity: string, interaction: string): readonly string[] {
  const m = normalizeMotionProfile(motion);
  const i = normalizeIntensityBand(intensity);
  const it = normalizeInteractionType(interaction);
  const full = `${m}|${i}|${it}`;
  const hit = KINETIC_CARRIER[full];
  if (hit) return hit;
  const mid = `neutral|${i}|${it}`;
  const hit2 = KINETIC_CARRIER[mid];
  if (hit2) return hit2;
  return KINETIC_CARRIER['neutral|neutral|none']!;
}

function resolveSituationFrameLines(domainRaw: string, intensityRaw: string): readonly string[] {
  const d = normalizePressureDomainId(domainRaw);
  const i = normalizeIntensityBand(intensityRaw);
  const dom = SITUATION_FRAME[d] ?? SITUATION_FRAME.neutral;
  const byI = dom[i] ?? dom.neutral ?? dom.moderate;
  return byI ?? SITUATION_FRAME.neutral.neutral;
}

const PRESENCE_ENTRY: Record<'solo' | 'pair' | 'triad' | 'many', readonly string[]> = {
  solo: ['Cardinality reads solo: one chart carries the pass end to end.'],
  pair: ['Cardinality reads pair: two charts share the pass without splitting the spine.'],
  triad: ['Cardinality reads triad: three charts thread the same window in parallel.'],
  many: ['Cardinality reads many: several charts load the same window at once.'],
};

function presenceCardinalityBucket(digest: CampaignExpressionDigest): 'solo' | 'pair' | 'triad' | 'many' {
  if (digest.campaign_mode === 'solo' || digest.group_member_count <= 0) return 'solo';
  const n = digest.group_member_count;
  if (n === 1) return 'pair';
  if (n === 2) return 'triad';
  return 'many';
}

/** Interaction shape + exposure (visibility); single-sentence pool. No cardinality words. */
const INTERACTION_SHAPE_EXPOSURE: Record<string, readonly string[]> = {
  'none|aligned|seen': [
    'Interaction reads clean while exposure sits tight: the contact stays visible without widening the frame.',
  ],
  'none|aligned|contained': [
    'Interaction reads clean while exposure stays contained: the contact holds inside a narrow band.',
  ],
  'none|aligned|escalating': [
    'Interaction reads clean while exposure escalates: the contact widens until the edge needs a cap.',
  ],
  'none|split|seen': [
    'Vectors disagree while exposure sits tight: the contact shows even when the headline domain splits.',
  ],
  'none|split|contained': [
    'Vectors disagree while exposure stays contained: the contact stays bounded inside the mismatch.',
  ],
  'none|split|escalating': [
    'Vectors disagree while exposure escalates: the contact widens until the mismatch needs a hard line.',
  ],
  'reinforcing|aligned|seen': [
    'Reinforcement stacks while exposure sits tight: the same pressure line doubles without hiding the contact.',
  ],
  'reinforcing|aligned|contained': [
    'Reinforcement stacks while exposure stays contained: duplicate push stays inside a fixed band.',
  ],
  'reinforcing|aligned|escalating': [
    'Reinforcement stacks while exposure escalates: duplicate push widens until the window needs a ceiling.',
  ],
  'reinforcing|split|seen': [
    'Reinforcement runs while domains split: exposure stays tight as twin vectors argue across lanes.',
  ],
  'reinforcing|split|contained': [
    'Reinforcement runs across split domains while exposure stays contained inside the contested band.',
  ],
  'reinforcing|split|escalating': [
    'Reinforcement runs across split domains while exposure escalates until the contested line needs a cap.',
  ],
  'cross_pressuring|aligned|seen': [
    'Cross-pressure pulls two ways while exposure sits tight: both vectors stay visible on the same floor.',
  ],
  'cross_pressuring|aligned|contained': [
    'Cross-pressure pulls two ways while exposure stays contained: the shear stays inside a narrow window.',
  ],
  'cross_pressuring|aligned|escalating': [
    'Cross-pressure pulls two ways while exposure escalates: shear widens until the bind needs a fixed edge.',
  ],
  'cross_pressuring|split|seen': [
    'Cross-pressure widens while domains split: exposure stays tight as the mismatch shows in parallel lanes.',
  ],
  'cross_pressuring|split|contained': [
    'Cross-pressure widens across split domains while exposure stays contained inside the shear band.',
  ],
  'cross_pressuring|split|escalating': [
    'Cross-pressure widens across split domains while exposure escalates until the shear hits a hard ceiling.',
  ],
  'escalating|aligned|seen': [
    'Escalation feeds back while exposure sits tight: the stack shows clearly while tempo climbs.',
  ],
  'escalating|aligned|contained': [
    'Escalation feeds back while exposure stays contained: the stack thickens inside a fixed rail.',
  ],
  'escalating|aligned|escalating': [
    'Escalation feeds back while exposure escalates: the stack climbs until the window demands a hard cap.',
  ],
  'escalating|split|seen': [
    'Escalation runs while domains split: exposure stays tight as stacked vectors surface in parallel.',
  ],
  'escalating|split|contained': [
    'Escalation runs across split domains while exposure stays contained inside the stacked band.',
  ],
  'escalating|split|escalating': [
    'Escalation runs across split domains while exposure escalates until the stack breaches the soft ceiling.',
  ],
  'dissolving|aligned|seen': [
    'Dissolving vectors spread load while exposure sits tight: slack shows even as push thins.',
  ],
  'dissolving|aligned|contained': [
    'Dissolving vectors spread load while exposure stays contained: slack stays inside a bounded drain.',
  ],
  'dissolving|aligned|escalating': [
    'Dissolving vectors spread load while exposure escalates: slack widens until the drain needs a fixed line.',
  ],
  'dissolving|split|seen': [
    'Dissolving vectors meet split domains while exposure sits tight: thinning push still reads on both lanes.',
  ],
  'dissolving|split|contained': [
    'Dissolving vectors meet split domains while exposure stays contained inside the thinning band.',
  ],
  'dissolving|split|escalating': [
    'Dissolving vectors meet split domains while exposure escalates until the widening slack needs a cap.',
  ],
  'transforming|aligned|seen': [
    'Transforming vectors remap mid-pass while exposure sits tight: the contact stays visible through the shift.',
  ],
  'transforming|aligned|contained': [
    'Transforming vectors remap mid-pass while exposure stays contained inside the remap window.',
  ],
  'transforming|aligned|escalating': [
    'Transforming vectors remap mid-pass while exposure escalates until the remap needs a hard boundary.',
  ],
  'transforming|split|seen': [
    'Transforming vectors cross split domains while exposure sits tight: the remap shows on both rails.',
  ],
  'transforming|split|contained': [
    'Transforming vectors cross split domains while exposure stays contained inside the remap band.',
  ],
  'transforming|split|escalating': [
    'Transforming vectors cross split domains while exposure escalates until the remap hits a fixed ceiling.',
  ],
  'neutral|neutral|neutral': [
    'Interaction stays mechanical while exposure holds steady: the contact reads without widening the frame.',
  ],
};

function interactionShapeExposureKey(
  seed: string,
  interaction: string,
  topDomain: string,
  pressureDomain: string,
  luminaryWeight: string,
  dominantFirst: string | undefined
): string {
  const it = normalizeInteractionType(interaction);
  const aligned = normalizePressureDomainId(topDomain) === normalizePressureDomainId(pressureDomain) ? 'aligned' : 'split';
  const lum = normalizeLuminaryWeight(luminaryWeight);
  const d0 = dominantFirst ? normalizeSlugKey(dominantFirst) : 'none';
  const exp = EXPOSURE_BUCKETS[hash32(`${seed}|exp|${lum}|${d0}|${it}|${aligned}`) % EXPOSURE_BUCKETS.length]!;
  const k = `${it}|${aligned}|${exp}`;
  return INTERACTION_SHAPE_EXPOSURE[k] ? k : 'neutral|neutral|neutral';
}

const GROUP_MECHANICAL_LEXICAL: Record<string, readonly string[]> = {
  none: [
    'Concurrent mechanical load splits attention across rails without merging vectors.',
    'Parallel tracks stay independent while the field carries split throughput.',
  ],
  reinforcing: [
    'Twin rails feed the same vector while mechanical load doubles on the shared line.',
    'Duplicate push stacks on one mechanical path while throughput stays coupled.',
  ],
  cross_pressuring: [
    'Shear mechanics pull throughput in opposing directions while the field holds two live rails.',
    'Cross-track load runs divergent vectors while mechanical stress stays visible on both lines.',
  ],
  escalating: [
    'Feedback mechanics tighten the loop while stack height climbs each pass.',
    'Escalation mechanics compound load while the window shortens on each cycle.',
  ],
  dissolving: [
    'Bleed mechanics widen spacing while load thins across the floor without vanishing.',
    'Dissolve mechanics spread slack while vectors lose peak without dropping contact.',
  ],
  transforming: [
    'Remap mechanics shift rails mid-window while throughput reroutes without a full stop.',
    'Transform mechanics rewire the path while cadence holds through the change.',
  ],
  neutral: [
    'Mechanical load stays explicit while vectors stay countable on the floor.',
    'Throughput stays legible while the field keeps rails visible without inventing roles.',
  ],
};

const CONTINUITY_APPENDIX: Record<string, readonly string[]> = {
  none: [''],
  assert_define: [
    'Chapter cadence locks the edge: define the line before the next beat widens past the cap.',
    'Hold the boundary through this chapter beat: the floor stays fixed while you set the limit.',
  ],
  engage_advance: [
    'Chapter cadence caps drift: advance only after the line you commit to is named.',
    'Lock pacing through this chapter beat: the ceiling on push stays fixed until you seal the move.',
  ],
  observe_hold: [
    'Chapter cadence sets a hard hold: observe inside the band while the edge stays fixed.',
    'Keep the window bounded this chapter beat: the line holds while watch stays inside the cap.',
  ],
  withdraw_protect: [
    'Chapter cadence enforces retreat inside the line: pull back while the floor stays non-negotiable.',
    'Protect the band this chapter beat: the cap on exposure stays fixed while you clip the edge.',
  ],
  support_connect: [
    'Chapter cadence binds support to a line: connect inside the cap while the floor stays firm.',
    'Support lands only inside this chapter window: the edge on overload is fixed and non-negotiable.',
  ],
  offer_restore: [
    'Chapter cadence caps repair width: restore only inside the line while the ceiling holds.',
    'Offer rest inside a fixed band this chapter beat: the limit on spend stays locked.',
  ],
  reframe_integrate: [
    'Chapter cadence locks reframes to a band: integrate without breaching the hard edge.',
    'Reframe inside this chapter cap: the line stays fixed while meaning shifts under the ceiling.',
  ],
  contain_limit: [
    'Chapter cadence demands containment: hold the limit while the bind stays non-negotiable.',
    'Contain inside this chapter line: the cap is fixed and the floor will not widen.',
  ],
};

/** Commitment / boundary verbs only (Pressure Lock). */
const VERB_CLASSES: readonly (readonly string[])[] = [
  ['commit', 'seal', 'bind', 'lock'],
  ['hold', 'cap', 'clip', 'brace'],
  ['name', 'mark', 'set', 'fix'],
  ['tighten', 'narrow', 'trim', 'bound'],
] as const;

const FAMILY_TENSION: Record<string, readonly string[]> = {
  identity: [
    'The identity line sets a hard edge: borrowed framing breaches the limit and is not allowed.',
    'Identity load carries a non-negotiable cap: stand behind one clean line or hold the bind.',
  ],
  emotional: [
    'The emotional line fixes a ceiling on volume: signal stays inside the band or you clip the edge.',
    'Emotional throughput hits a hard line: flood past the cap breaches the floor you set.',
  ],
  cognitive: [
    'The cognitive line locks framing before motion: speed without a named line breaches the limit.',
    'Cognitive load demands a fixed edge: sharpen the frame now or hold inside the cap.',
  ],
  value: [
    'The value line sets a visible cap on cost: hidden drain breaches the limit and is not allowed.',
    'Value exchange carries a non-negotiable floor: show the line or seal the bind.',
  ],
  conflict: [
    'The conflict line caps spectacle: bounded moves stay inside the edge or you lock the line.',
    'Conflict throughput demands a hard ceiling: endless contest breaches the limit you set.',
  ],
  expansion: [
    'The expansion line caps width: steer inside the edge or the bind tightens on the next beat.',
    'Scale carries a non-negotiable ceiling: widen past the cap and you breach the floor.',
  ],
  constraint: [
    'The constraint line is non-negotiable: respect the limit now or the bind hardens on the next pass.',
    'Constraint load fixes the floor: the cap holds under pressure and will not lift without a line change.',
  ],
  disruption: [
    'The disruption line locks stabilization first: scatter past the edge breaches the cap you set.',
    'Pattern break carries a hard line: reset inside the band or seal the bind before you move.',
  ],
  dissolution: [
    'The dissolution line caps drift: release stays inside the floor while the edge stays fixed.',
    'Let-go carries a non-negotiable center: widen past the line and you breach the bind.',
  ],
  transformation: [
    'The transformation line caps depth drift: trade only on purpose or the limit locks.',
    'Depth exchange demands consent inside a fixed band: breach the line and the bind holds.',
  ],
  wound: [
    'The wound line sets a tight band on contact: tender load stays inside the edge you cap.',
    'Careful contact carries a non-negotiable floor: step past the line and you lock the bind.',
  ],
  directional: [
    'The directional line fixes bearing for this pass: heading without a defendable edge breaches the cap.',
    'Commitment to direction is non-negotiable: pick the line you will hold under load.',
  ],
  recurrence: [
    'The recurrence line caps loop width: return until met differently or the edge seals.',
    'Old loops hit a hard ceiling: new handle must fit inside the line or the bind tightens.',
  ],
  neutral: [
    'Pressure family lands on a fixed line: hold the cap while the edge stays non-negotiable.',
    'The bind carries a visible floor: drift past the limit breaches the boundary you set.',
  ],
};

const POLARITY_EDGE: Record<string, readonly string[]> = {
  constructive: [
    'Constructive polarity still caps drift: finish inside the line while the edge stays fixed.',
    'Follow-through is non-negotiable: scatter past the cap breaches the limit you set.',
  ],
  frictional: [
    'Frictional polarity locks adjustment before force: name friction at the line or the bind tightens.',
    'The edge is hard: push without adjustment breaches the cap on load.',
  ],
  volatile: [
    'Volatile polarity caps amplification: short loops stay inside the band or you seal the line.',
    'Pacing carries a non-negotiable ceiling: wide swing breaches the edge you set.',
  ],
  binding: [
    'Binding polarity fixes patience inside the hold: narrow moves stay inside the line or the bind holds.',
    'The hold is non-negotiable: bypass attempts breach the cap on the next beat.',
  ],
  neutral: [
    'Polarity lands on a fixed edge: hold the line while the cap stays non-negotiable.',
    'The boundary is sealed: drift past the limit breaches the floor you set.',
  ],
};

const ASPECT_PHRASE: Record<string, string> = {
  conjunction: 'conjunction',
  opposition: 'opposition',
  square: 'square',
  trine: 'trine',
  sextile: 'sextile',
};

const BODY_LABEL: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

function defaultCampaignExpressionDigest(): CampaignExpressionDigest {
  const neutralTemperament = {
    will: 0,
    insight: 0,
    attunement: 0,
    courage: 0,
    discipline: 0,
    adaptability: 0,
    bond: 0,
    shadowCapacity: 0,
    radiance: 0,
  } as const;
  return {
    identity: {
      profile_id: 'neutral_profile',
      class_slug: 'neutral',
      subclass_slug: 'neutral',
      rising_modifier_slug: 'neutral',
      top_domain_slug: 'self',
      primary_element: 'earth',
      tonal_polarity: 'balanced',
      luminary_weight: 'balanced',
      motion_profile: 'neutral',
      gravity_profile: 'neutral',
      dominant_planets: [],
      angular_emphasis: { first: false, fourth: false, seventh: false, tenth: false },
      temperament: neutralTemperament,
      top_domains_ranked: [{ domain: 'self', score: 0 }],
      signature_domains_ranked: [{ domain: 'self', weight: 0 }],
      pressure_contact_modifier_ids: [],
    },
    pressure: {
      primary_domain_id: 'self',
      primary_intensity_band: 'moderate',
      primary_pressure_family: 'constraint',
      primary_pressure_polarity: 'frictional',
      interaction_type: 'none',
      primary_transit_body: 'saturn',
      primary_natal_body: 'sun',
      primary_natal_house: 1,
      primary_aspect_type: 'square',
      supporting_count: 0,
    },
    continuity: { chapter: 1, dominant_tone_key: 'neutral', top_domain_key: null },
    campaign_mode: 'solo',
    group_member_count: 0,
    group_contributing_member_chart_ids: [],
    group_primary_member_chart_ids: [],
  };
}

function resolveCampaignDigest(options?: ProjectionOptions): CampaignExpressionDigest {
  const d = campaignExpressionDigestFromOptions(options);
  return d ?? defaultCampaignExpressionDigest();
}

function supportBinLabel(count: number): 'zero' | 'one' | 'many' {
  if (count <= 0) return 'zero';
  if (count === 1) return 'one';
  return 'many';
}

function stanceKey(seed: string, digest: CampaignExpressionDigest): (typeof STANCE_KEYS)[number] {
  let h =
    hash32(`${seed}|stance|${digest.identity.class_slug}|${digest.identity.rising_modifier_slug}|${digest.identity.subclass_slug}`) %
    STANCE_KEYS.length;
  if (digest.identity.top_domain_slug === digest.pressure.primary_domain_id) {
    h = (h + 1) % STANCE_KEYS.length;
  }
  if (digest.identity.pressure_contact_modifier_ids.length > 0) {
    const joined = [...digest.identity.pressure_contact_modifier_ids].sort().join('|');
    h = (h + (hash32(`${seed}|im|${joined}`) % 3)) % STANCE_KEYS.length;
  }
  const ae = digest.identity.angular_emphasis;
  const angCount = Number(ae.first) + Number(ae.fourth) + Number(ae.seventh) + Number(ae.tenth);
  h = (h + (angCount % 3)) % STANCE_KEYS.length;
  return STANCE_KEYS[h]!;
}

function verbFromClass(seed: string, stance: (typeof STANCE_KEYS)[number], polarity: string, verbClassIndex: number): string {
  const classes = VERB_CLASSES[verbClassIndex % VERB_CLASSES.length]!;
  const idx = hash32(`${seed}|verb|${stance}|${polarity}|${verbClassIndex}`) % classes.length;
  return classes[idx]!;
}

function bodyLabel(slug: string): string {
  const k = slug.toLowerCase();
  return BODY_LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

function campaignMomentForbiddenHit(text: string): boolean {
  const lower = text.toLowerCase();
  for (const f of CAMPAIGN_MOMENT_FORBIDDEN) {
    if (lower.includes(f.toLowerCase())) return true;
  }
  if (/\b(?:may|might|could)\b/i.test(text)) return true;
  if (/\bcan\b/i.test(lower)) return true;
  return false;
}

function buildContinuityAppendix(seed: string, digest: CampaignExpressionDigest, tier: ExpansionTier): string {
  const c = campaignContinuityFromDigest(digest);
  const dirKey = c.last_outcome_direction ? normalizeSlugKey(c.last_outcome_direction) : 'none';
  const rows = CONTINUITY_APPENDIX[dirKey] ?? CONTINUITY_APPENDIX.none;
  if (rows.length === 0 || (rows.length === 1 && rows[0] === '')) return '';
  if (tier === 'baseline' && dirKey === 'none') return '';
  return pickVariant(`${seed}|cont|${dirKey}|${c.chapter}|${c.dominant_tone_key}|${c.top_domain_key ?? ''}`, [...rows]).trim();
}

function buildCampaignMomentThreeSentences(
  seed: string,
  digest: CampaignExpressionDigest,
  tier: ExpansionTier
): string {
  const p = digest.pressure;
  const id = digest.identity;
  const bin = supportBinLabel(p.supporting_count);
  const stance = stanceKey(seed, digest);

  const domN = normalizePressureDomainId(p.primary_domain_id);
  const intN = normalizeIntensityBand(p.primary_intensity_band);
  const sfLines = resolveSituationFrameLines(p.primary_domain_id, p.primary_intensity_band);
  const frameRaw = pickVariant(`${seed}|sf|${domN}|${intN}|${bin}`, [...sfLines]).trim();
  const frame = frameRaw.endsWith('.') ? frameRaw.slice(0, -1).trim() : frameRaw;

  const carrierLines = resolveKineticCarrierLines(id.motion_profile, p.primary_intensity_band, p.interaction_type);
  const carrierRaw = pickVariant(
    `${seed}|kc|${normalizeMotionProfile(id.motion_profile)}|${intN}|${normalizeInteractionType(p.interaction_type)}`,
    [...carrierLines]
  ).trim();
  const carrier = carrierRaw.endsWith('.') ? carrierRaw.slice(0, -1).trim() : carrierRaw;

  const presB = presenceCardinalityBucket(digest);
  const presenceRaw = pickVariant(`${seed}|pr|${presB}`, [...PRESENCE_ENTRY[presB]]).trim();
  const presence = presenceRaw.endsWith('.') ? presenceRaw.slice(0, -1).trim() : presenceRaw;

  const entryText = [frame, carrier, presence].map((s) => (s.endsWith('.') ? s : `${s}.`)).join(' ').replace(/\s+/g, ' ').trim();

  const transit = bodyLabel(p.primary_transit_body);
  const natal = bodyLabel(p.primary_natal_body);
  const asp = ASPECT_PHRASE[p.primary_aspect_type] ?? p.primary_aspect_type;
  const house = String(p.primary_natal_house);
  const s2Variants = [
    `${transit} meets ${natal} through a ${asp}, with house ${house} carrying the contact.`,
    `${transit} presses ${natal} along a ${asp}, and house ${house} holds the contact.`,
    `${transit} crosses ${natal} on a ${asp}, focused through house ${house}.`,
    `${transit} works ${natal} in a ${asp}, with house ${house} showing the contact.`,
  ];
  const geometry = pickVariant(`${seed}|S2|${transit}|${natal}|${asp}|${house}`, [...s2Variants]).trim();

  const dom0 = id.dominant_planets[0];
  const shapeKey = interactionShapeExposureKey(
    seed,
    p.interaction_type,
    id.top_domain_slug,
    p.primary_domain_id,
    id.luminary_weight,
    dom0
  );
  const shapeLines = INTERACTION_SHAPE_EXPOSURE[shapeKey] ?? INTERACTION_SHAPE_EXPOSURE['neutral|neutral|neutral']!;
  const shapeVis = pickVariant(`${seed}|isvx|${shapeKey}`, [...shapeLines]).trim();

  let groupSeg = '';
  if (digest.campaign_mode === 'group' && digest.group_member_count > 0) {
    const gk = normalizeInteractionType(p.interaction_type);
    const gLines = GROUP_MECHANICAL_LEXICAL[gk] ?? GROUP_MECHANICAL_LEXICAL.neutral;
    const gPick = pickVariant(`${seed}|grp|${gk}`, [...gLines]).trim();
    groupSeg = gPick.endsWith('.') ? ` ${gPick}` : ` ${gPick}.`;
  }

  const geometryC = geometry.endsWith('.') ? geometry : `${geometry}.`;
  const shapeC = shapeVis.endsWith('.') ? shapeVis : `${shapeVis}.`;
  const contactText = `${geometryC} ${shapeC}${groupSeg}`.replace(/\s+/g, ' ').trim();

  const familyKey = normalizePressureFamily(p.primary_pressure_family);
  const sigDomain = normalizePressureDomainId(id.signature_domains_ranked[0]?.domain ?? 'self');
  const famLines = FAMILY_TENSION[familyKey] ?? FAMILY_TENSION.constraint;
  const famPick = pickVariant(`${seed}|S3fam|${familyKey}|${stance}|${sigDomain}`, [...famLines]).trim();

  const polKey = normalizePressurePolarity(p.primary_pressure_polarity);
  const polLines = POLARITY_EDGE[polKey] ?? POLARITY_EDGE.neutral;
  const polPick = pickVariant(`${seed}|S3pol|${polKey}|${stance}|${sigDomain}`, [...polLines]).trim();

  const verbClass =
    hash32(`${seed}|vc|${stance}|${polKey}|${normalizeIntensityBand(p.primary_intensity_band)}`) % VERB_CLASSES.length;
  const verb = verbFromClass(seed, stance, polKey, verbClass);
  const famC = famPick.endsWith('.') ? famPick : `${famPick}.`;
  const polC = polPick.endsWith('.') ? polPick : `${polPick}.`;
  const lockCore = `${famC} ${polC} You ${verb} the line for this pass.`.replace(/\s+/g, ' ').trim();
  const lockCoreC = lockCore.endsWith('.') ? lockCore : `${lockCore}.`;

  const appendix = buildContinuityAppendix(seed, digest, tier);
  const appendixPart =
    appendix.length > 0 ? (appendix.endsWith('.') ? ` ${appendix}` : ` ${appendix}.`) : '';
  const lockText = `${lockCoreC}${appendixPart}`.replace(/\s+/g, ' ').trim();

  let out = `${entryText} ${contactText} ${lockText}`.replace(/\s+/g, ' ').trim();
  if (campaignMomentForbiddenHit(out)) {
    out =
      'A standard operating pass is already open: exchanges and checks are already cycling. Cadence stays metered while a single vector carries the load. Cardinality reads solo: one chart carries the pass end to end. Saturn meets Sun through a square, with house 1 carrying the contact. Interaction stays mechanical while exposure holds steady: the contact reads without widening the frame. The constraint line is non-negotiable: respect the limit now or the bind hardens on the next pass. Frictional polarity locks adjustment before force: name friction at the line or the bind tightens. You hold the line for this pass.';
  }
  return out;
}

export function buildCampaignPressureResponseParagraph(
  core: SemanticCore,
  seed: string,
  options?: ProjectionOptions
): { text: string; claimIds: string[] } {
  const digest = resolveCampaignDigest(options);
  const tier = options?.tier ?? 'baseline';
  const tension = core.claims.find((c) => c.claim_id.startsWith('TENSION_BAND'));
  const motion = core.claims.find((c) => c.claim_id.startsWith('MOTION_LABEL'));
  const ids: string[] = [];
  if (tension) ids.push(tension.claim_id);
  if (motion) ids.push(motion.claim_id);
  const text = buildCampaignMomentThreeSentences(seed, digest, tier);
  return { text, claimIds: ids };
}
