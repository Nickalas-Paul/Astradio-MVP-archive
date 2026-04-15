/**
 * Step 5 — claim synthesis (deterministic integration; no new claims).
 * ClaimExpressionBundle rendering; no generic claim fallback.
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import type {
  CampaignExpressionDigest,
  DensityClass,
  ExpansionTier,
  ProjectionOptions,
  ProjectionSurface,
} from '../projection-types';
import { campaignContinuityFromDigest } from '../campaign-lens-contract';
import { campaignExpressionDigestFromOptions } from '../campaign-expression-digest-guard';
import { minClaimBodiesForDensity } from '../density-validate';
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

function selectPhraseFromRoleVariants(input: {
  variants: readonly string[];
  claimId: string;
  role: ClaimOptionalRole | 'core';
  slotKind: string;
  seed: string;
  claim: SemanticClaim;
  paragraphNormDeque: string[];
}): string {
  const { variants, claimId, role, slotKind, seed, claim, paragraphNormDeque } = input;
  const interp = (raw: string) => applyStrengthInterpolation(raw.trim(), claim);
  const N = variants.length;
  if (N === 0) throw new InvalidClaimExpressionBundleError(`${claimId}: empty variant list for ${role}`);
  const start = hash32(`${seed}|${claimId}|${role}|${slotKind}`) % N;
  for (let k = 0; k < N; k++) {
    const raw = variants[(start + k) % N]!;
    const sent = interp(raw);
    if (!paragraphNormDeque.includes(projectionNormSentence(sent))) return sent;
  }
  return interp(variants[0]!);
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
  register?: ArcRegister;
}): { text: string; claim_id: string } {
  const { claim, index: i, n, sectionRoleDeque, paragraphNormDeque, seed } = input;
  const register = input.register ?? 'mechanism';
  const id = claim.claim_id as ClaimId;
  const bundle = getClaimExpressionBundle(id);
  const interp = (raw: string) => applyStrengthInterpolation(raw.trim(), claim);

  const pushDequeForSentence = (sentence: string, role: ClaimOptionalRole | null): void => {
    pushParagraphNormDeque(paragraphNormDeque, projectionNormSentence(sentence));
    if (role !== null) pushSectionRoleDeque(sectionRoleDeque, role);
  };

  const coreVariants = listenVariantsForArcRole(id, bundle, 'core', register);
  const sentences: string[] = [];

  if (n === 1) {
    const coreSent = interp(coreVariants[0]!);
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
      });
      sentences.push(implSent);
      pushDequeForSentence(implSent, 'implication');
    }
  } else if (i === 0) {
    const coreSent = interp(coreVariants[0]!);
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
      });
      sentences.push(elaboration);
      pushDequeForSentence(elaboration, 'experience');
    }
  } else if (i === n - 1) {
    const mod = modulationMaterial(bundle, claim, id, seed, paragraphNormDeque, register);
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
      });
      sentences.push(implSent);
      pushDequeForSentence(implSent, 'implication');
    }
  } else {
    const mod = modulationMaterial(bundle, claim, id, seed, paragraphNormDeque, register);
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
  register: ArcRegister
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
}): { role: ClaimOptionalRole; sentence: string } {
  const { bundle: b, id, seed, claim, sectionRoleDeque, paragraphNormDeque } = args;
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
}): { text: string; secondaryRole: ClaimOptionalRole; claim_id: string } {
  const { claim, localIndex, seed, surface, tier, sectionRoleDeque, paragraphNormDeque } = input;
  const id = claim.claim_id as ClaimId;
  const bundle = getClaimExpressionBundle(id);
  const coreSentence = applyStrengthInterpolation(bundle.core[0]!.trim(), claim);
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

/**
 * Synthesis claim bodies: tier ladder on the mechanism slice only; no drift `claim_body`.
 */
export function buildDisciplinedSynthesisClaimBodies(
  core: SemanticCore,
  dominantClaims: readonly SemanticClaim[],
  maxCount: number,
  seed: string,
  surface: ProjectionSurface,
  tier: ExpansionTier,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[],
  excludeClaimIds: ReadonlySet<string>
): { text: string; claimIds: string[] } {
  const excl = excludeClaimIds;
  let chosen: SemanticClaim[] = [];
  for (const maxT of [2, 3, 4] as const) {
    const batch = pickSupportingFromMechanismSlice(core, tier, dominantClaims, excl, maxT, maxCount);
    if (batch.length >= maxCount) {
      chosen = batch;
      break;
    }
    if (batch.length > chosen.length) chosen = batch;
  }
  const lines: string[] = [];
  const ids: string[] = [];
  let localIndex = 0;
  for (const c of chosen) {
    const block = renderClaimExpressionBlock({
      claim: c,
      localIndex,
      seed: `${seed}|${c.claim_id}|syn`,
      surface,
      tier,
      sectionRoleDeque,
      paragraphNormDeque,
    });
    localIndex++;
    lines.push(block.text);
    ids.push(c.claim_id);
  }
  return { text: synthesizeClaimSentences(lines, ids, `${seed}:synrng`), claimIds: ids };
}

export function buildClaimMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier,
  surface: ProjectionSurface,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[]
): { text: string; claimIds: string[]; orderedClaims: readonly SemanticClaim[] } {
  const window = claimWindow(tier);
  const slice = core.claims.slice(0, window);
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
 * `localIndex` for rendering always equals the claim's index within `core.claims.slice(0, claimWindow(tier))`.
 */
export function buildControlledMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier,
  surface: ProjectionSurface,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[],
  dominantClaimIds: readonly string[]
): { text: string; claimIds: string[]; orderedClaims: readonly SemanticClaim[] } {
  if (dominantClaimIds.length === 0) {
    return buildClaimMechanismExpressionParagraph(core, seed, tier, surface, sectionRoleDeque, paragraphNormDeque);
  }
  const window = claimWindow(tier);
  const slice = core.claims.slice(0, window);
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

export function buildSupplementalPanel(
  core: SemanticCore,
  seed: string,
  panelIndex: number,
  tier: ExpansionTier,
  surface: ProjectionSurface,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[],
  excludeClaimIds: ReadonlySet<string>,
  sectionDensity: DensityClass,
  dominantClaims: readonly SemanticClaim[]
): { title: string; text: string; claimIds: string[] } {
  const minOrig = minClaimBodiesForDensity(sectionDensity);
  const minShort = minClaimBodiesForDensity('short');

  let chosen: SemanticClaim[] | null = null;
  for (const maxT of [2, 3, 4] as const) {
    const batch = pickSupportingFromMechanismSlice(core, tier, dominantClaims, excludeClaimIds, maxT, minOrig);
    if (batch.length >= minOrig) {
      chosen = batch;
      break;
    }
  }
  if (!chosen) {
    for (const maxT of [2, 3, 4] as const) {
      const batch = pickSupportingFromMechanismSlice(core, tier, dominantClaims, excludeClaimIds, maxT, minShort);
      if (batch.length >= minShort) {
        chosen = batch;
        break;
      }
    }
  }
  if (!chosen) {
    chosen = pickSupportingFromMechanismSlice(core, tier, dominantClaims, excludeClaimIds, 4, minShort);
  }

  const lines: string[] = [];
  const ids: string[] = [];
  let localIndex = 0;
  for (const c of chosen) {
    const block = renderClaimExpressionBlock({
      claim: c,
      localIndex,
      seed: `${seed}|${c.claim_id}|panel:${panelIndex}|${localIndex}`,
      surface,
      tier,
      sectionRoleDeque,
      paragraphNormDeque,
    });
    localIndex++;
    lines.push(block.text);
    ids.push(c.claim_id);
  }

  if (lines.length > 0) {
    const raw =
      synthesizeClaimSentences(lines, ids, `${seed}:pan:${panelIndex}`) ||
      pickVariant(seed, [
        'This picture includes additional emphasis that may show up subtly in how the pattern lands rather than as a single headline.',
      ]);
    const text = capToMaxSentences(raw, 2);
    return {
      title: `Pattern note ${panelIndex + 1}`,
      text,
      claimIds: ids,
    };
  }

  const text = pickVariant(`${seed}:pan:pad:${panelIndex}`, [
    'This picture includes additional emphasis that may show up subtly in how the pattern lands rather than as a single headline.',
  ]);
  return {
    title: `Pattern note ${panelIndex + 1}`,
    text: capToMaxSentences(text, 2),
    claimIds: [],
  };
}

/** Campaign moment copy: digest-driven field (A), vector (B), tension (T); identity modulates stance + verbs only. */
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
] as const;

const STANCE_KEYS = ['ground', 'probe', 'edge', 'hold', 'weave', 'strike', 'shelter', 'scan'] as const;

const STANCE_S1_OPEN: Record<(typeof STANCE_KEYS)[number], readonly string[]> = {
  ground: ['Right now, ', 'In this pass, ', 'On the field today, '],
  probe: ['Right now, ', 'In this pass, ', 'At this beat, '],
  edge: ['Right now, ', 'In this pass, ', 'At this edge, '],
  hold: ['Right now, ', 'In this pass, ', 'In this window, '],
  weave: ['Right now, ', 'In this pass, ', 'Across this weave, '],
  strike: ['Right now, ', 'In this pass, ', 'At this strike, '],
  shelter: ['Right now, ', 'In this pass, ', 'Inside this shelter, '],
  scan: ['Right now, ', 'In this pass, ', 'Across this scan, '],
};

const VERB_CLASSES: readonly (readonly string[])[] = [
  ['name', 'mark', 'signal', 'trace'],
  ['steady', 'hold', 'even', 'brace'],
  ['tighten', 'narrow', 'trim', 'clip'],
  ['widen', 'open', 'stretch', 'ease'],
  ['pace', 'meter', 'clock', 'time'],
] as const;

const DOMAIN_FIELD: Record<string, string> = {
  self: 'identity stance',
  assets: 'resources and footing',
  communication: 'signals and exchanges',
  home: 'roots and private ground',
  creativity: 'expression and risk',
  work: 'duty and daily systems',
  partnership: 'contact and reciprocity',
  transformation: 'stakes and exchange',
  belief: 'horizon and meaning',
  career: 'visibility and role',
  community: 'belonging and contribution',
  subconscious: 'undercurrent and inner weather',
};

const INTENSITY_FIELD: Record<string, string> = {
  low: 'stays low but present',
  moderate: 'shows clear and steady',
  high: 'runs hot and close',
  critical: 'demands attention now',
};

const INTERACTION_FIELD: Record<string, string> = {
  none: 'a single clear vector shapes the room',
  reinforcing: 'vectors reinforce the same pressure line',
  cross_pressuring: 'vectors pull in different directions at once',
  escalating: 'the field stacks and escalates quickly',
  dissolving: 'the field loosens and spreads',
  transforming: 'the field shifts shape mid-pass',
};

const FAMILY_TENSION: Record<string, readonly string[]> = {
  identity: [
    'The identity line asks for a clean read, not a borrowed story.',
    'The identity line wants a straight answer you can stand behind.',
  ],
  emotional: [
    'The emotional line asks you to keep contact honest without flooding the room.',
    'The emotional line wants signal before volume.',
  ],
  cognitive: [
    'The cognitive line asks for a sharper frame before you move.',
    'The cognitive line wants naming before speed.',
  ],
  value: [
    'The value line asks what cost you are willing to show.',
    'The value line wants a visible exchange, not a hidden drain.',
  ],
  conflict: [
    'The conflict line asks you to hold the edge without turning it into a spectacle.',
    'The conflict line wants a bounded move, not an endless contest.',
  ],
  expansion: [
    'The expansion line asks how wide you open before you lose the edge.',
    'The expansion line wants scale you can still steer.',
  ],
  constraint: [
    'The constraint line asks where the limit earns respect.',
    'The constraint line wants a line that holds under load.',
  ],
  disruption: [
    'The disruption line asks what you stabilize first when the pattern breaks.',
    'The disruption line wants a reset you can repeat.',
  ],
  dissolution: [
    'The dissolution line asks what you let go without losing the center.',
    'The dissolution line wants a softer edge with a firm floor.',
  ],
  transformation: [
    'The transformation line asks what you trade only on purpose.',
    'The transformation line wants consent to depth, not drift into it.',
  ],
  wound: [
    'The wound line asks for careful contact around what is tender.',
    'The wound line wants a smaller step with cleaner witness.',
  ],
  directional: [
    'The directional line asks which bearing you commit to for this pass.',
    'The directional line wants a heading you can defend.',
  ],
  recurrence: [
    'The recurrence line asks what returns until it is met differently.',
    'The recurrence line wants a new handle on an old loop.',
  ],
};

const POLARITY_EDGE: Record<string, readonly string[]> = {
  constructive: [
    'The edge still asks for a clean finish, not an open-ended drift.',
    'The edge still wants follow-through that does not scatter.',
  ],
  frictional: [
    'The edge asks for adjustment before force.',
    'The edge wants friction named before it hardens.',
  ],
  volatile: [
    'The edge asks for pacing before amplification.',
    'The edge wants a short loop, not a wide swing.',
  ],
  binding: [
    'The edge asks for patience with a tight hold.',
    'The edge wants a narrow move that still respects the bind.',
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

const CLASS_READ: Record<string, string> = {
  neutral: 'neutral cadence',
  scout: 'scout cadence',
  guardian: 'guardian cadence',
  catalyst: 'catalyst cadence',
  weaver: 'weaver cadence',
  anchor: 'anchor cadence',
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
  const digest = d ?? defaultCampaignExpressionDigest();
  void campaignContinuityFromDigest(digest);
  return digest;
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
  return false;
}

function buildCampaignMomentThreeSentences(seed: string, digest: CampaignExpressionDigest): string {
  const p = digest.pressure;
  const id = digest.identity;
  const domain = DOMAIN_FIELD[p.primary_domain_id] ?? 'the active field';
  const intensity = INTENSITY_FIELD[p.primary_intensity_band] ?? 'reads steady';
  const inter = INTERACTION_FIELD[p.interaction_type] ?? INTERACTION_FIELD.none;
  const bin = supportBinLabel(p.supporting_count);
  const stance = stanceKey(seed, digest);

  const s1Open = pickVariant(`${seed}|S1open|${stance}`, [...STANCE_S1_OPEN[stance]]);
  const supportNote =
    bin === 'zero'
      ? 'one vector leads the pass.'
      : bin === 'one'
        ? 'two vectors share the pass.'
        : 'several vectors stack in the same pass.';
  const classSlot =
    CLASS_READ[id.class_slug.toLowerCase()] !== undefined
      ? ` Your stance reads as ${CLASS_READ[id.class_slug.toLowerCase()]!}.`
      : '';
  const s1 = `${s1Open}the ${domain} field ${intensity}, and ${inter}; ${supportNote}${classSlot}`.replace(/\s+/g, ' ').trim();
  const s1c = s1.endsWith('.') ? s1 : `${s1}.`;

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
  const s2 = pickVariant(`${seed}|S2|${transit}|${natal}|${asp}|${house}`, [...s2Variants]);

  const familyKey = p.primary_pressure_family.toLowerCase();
  const famLines = FAMILY_TENSION[familyKey] ?? FAMILY_TENSION.constraint!;
  const famPick = pickVariant(`${seed}|S3fam|${familyKey}|${stance}`, [...famLines]);
  const polLines = POLARITY_EDGE[p.primary_pressure_polarity] ?? POLARITY_EDGE.frictional!;
  const polPick = pickVariant(`${seed}|S3pol|${p.primary_pressure_polarity}|${stance}`, [...polLines]);
  const verbClass =
    hash32(`${seed}|vc|${stance}|${p.primary_pressure_polarity}|${p.primary_intensity_band}`) % VERB_CLASSES.length;
  const verb = verbFromClass(seed, stance, p.primary_pressure_polarity, verbClass);
  const s3 = `${famPick} ${polPick} You ${verb} the tradeoff in this pass.`.replace(/\s+/g, ' ').trim();
  const s3c = s3.endsWith('.') ? s3 : `${s3}.`;

  let out = `${s1c} ${s2} ${s3c}`.replace(/\s+/g, ' ').trim();
  if (campaignMomentForbiddenHit(out)) {
    out =
      'Right now, the field reads steady and present. Saturn meets Sun through a square, with house 1 carrying the contact. The constraint line asks for adjustment before you force the move, and you name the tradeoff in this pass.';
  }
  return out;
}

export function buildCampaignPressureResponseParagraph(
  core: SemanticCore,
  seed: string,
  options?: ProjectionOptions
): { text: string; claimIds: string[] } {
  const digest = resolveCampaignDigest(options);
  const tension = core.claims.find((c) => c.claim_id.startsWith('TENSION_BAND'));
  const motion = core.claims.find((c) => c.claim_id.startsWith('MOTION_LABEL'));
  const ids: string[] = [];
  if (tension) ids.push(tension.claim_id);
  if (motion) ids.push(motion.claim_id);
  const text = buildCampaignMomentThreeSentences(seed, digest);
  return { text, claimIds: ids };
}
