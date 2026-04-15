/**
 * Step 5 — claim synthesis (deterministic integration; no new claims).
 * Phase 1 — ClaimExpressionBundle rendering; no generic claim fallback.
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import type { DensityClass, ExpansionTier, ProjectionOptions, ProjectionSurface } from '../projection-types';
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

/** Human-readable labels for campaign copy (no raw ontology ids in user text). */
function campaignLabelForClaimId(id: string): string {
  const table: Record<string, string> = {
    TENSION_BAND_HIGH: 'a high structural tension band (feedback comes back fast)',
    TENSION_BAND_MED: 'a moderate structural tension band (feedback steadies but does not vanish)',
    TENSION_BAND_LOW: 'a low structural tension band (feedback stretches and softens)',
    MOTION_LABEL_SURGING: 'a surging motion profile (impulse spikes quickly)',
    MOTION_LABEL_RESTLESS: 'a restless motion profile (starts and stops in quick loops)',
    MOTION_LABEL_QUIET_FLOW: 'a quiet-flow motion profile (movement stays low and continuous)',
    MOTION_LABEL_INWARD: 'an inward consolidation motion profile (energy pulls back before it returns)',
    MOTION_LABEL_STEADY: 'a steady motion profile (pace holds even when load rises)',
  };
  return table[id] ?? 'a distinct motion pattern in the field';
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

export function buildCampaignPressureResponseParagraph(
  core: SemanticCore,
  seed: string,
  options?: ProjectionOptions
): { text: string; claimIds: string[] } {
  void campaignExpressionDigestFromOptions(options);
  const tension = core.claims.find((c) => c.claim_id.startsWith('TENSION_BAND'));
  const motion = core.claims.find((c) => c.claim_id.startsWith('MOTION_LABEL'));
  const ids: string[] = [];
  if (tension) ids.push(tension.claim_id);
  if (motion) ids.push(motion.claim_id);
  const tLabel = tension ? campaignLabelForClaimId(tension.claim_id) : null;
  const mLabel = motion ? campaignLabelForClaimId(motion.claim_id) : null;
  const tNote = tLabel
    ? `Scenario pressure: ${tLabel}; treat activation as something that returns quickly, and keep steps small enough to steer when it spikes.`
    : `Scenario pressure: structural cues read diffuse here; still use short loops and named checkpoints when intensity climbs so the day does not blur.`;
  const mNote = mLabel
    ? `Response shape: ${mLabel} asks you to match action to the impulse curve you already mapped instead of forcing a mismatched cadence.`
    : `Response shape: without a dominant motion label, alternate consolidation and push rather than locking one speed; keep cadence checks short and named.`;
  const text = pickVariant(seed + ':camp', [tNote + ' ' + mNote]);
  return { text, claimIds: ids };
}
