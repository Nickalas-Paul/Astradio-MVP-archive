/**
 * Step 5 — claim synthesis (deterministic integration; no new claims).
 * Phase 1 — ClaimExpressionBundle rendering; no generic claim fallback.
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import type { ExpansionTier, ProjectionSurface } from '../projection-types';
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
  surfaceOffset,
  tierOffset,
} from './claim-expression-bundles';
import { mapTempo, mapTempoLeadClauseForEmbed, withTerminalPeriod } from './audio-lexicon';
import { claimWindow } from './claim-select';

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

function pickGlue(prevId: string, nextId: string, seed: string): string {
  const key = `${prevId}>${nextId}`;
  return pickVariant(`${seed}:glue:${key}`, [
    'In the same picture,',
    'Alongside that signal,',
    'Taken together with the prior emphasis,',
  ]);
}

function pushParagraphNormDeque(dq: string[], norm: string): void {
  dq.push(norm);
  while (dq.length > 6) dq.shift();
}

function pushSectionRoleDeque(dq: ClaimOptionalRole[], role: ClaimOptionalRole): void {
  dq.push(role);
  while (dq.length > 4) dq.shift();
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
  const { bundle: b, id, localIndex, seed, surface, tier, claim, sectionRoleDeque, paragraphNormDeque } = args;
  const candidates: ClaimOptionalRole[] = [];
  for (const r of CLAIM_OPTIONAL_ROLE_ORDER) {
    const t = b[r];
    if (typeof t === 'string' && t.trim().length > 0) candidates.push(r);
  }
  if (candidates.length === 0) {
    throw new InvalidClaimExpressionBundleError(`${id}: no optional roles`);
  }
  const R = hash32(`${seed}|${id}|${localIndex}|${surface}|${tier}`);
  const k = R % candidates.length;
  const rotated = rotateArray(candidates, k);
  const start = (k + surfaceOffset(surface)) % candidates.length;
  const ordered = rotateArray(rotated, start);
  const start2 = (start + tierOffset(tier)) % candidates.length;
  const ordered2 = rotateArray(ordered, start2);

  const sentFor = (role: ClaimOptionalRole) => applyStrengthInterpolation(b[role]!.trim(), claim);

  let chosen: ClaimOptionalRole | null = null;
  for (const role of ordered2) {
    const sent = sentFor(role);
    if (sectionRoleDeque.includes(role)) continue;
    if (paragraphNormDeque.includes(projectionNormSentence(sent))) continue;
    chosen = role;
    break;
  }
  if (chosen === null) {
    chosen = ordered2[0]!;
  }
  return { role: chosen, sentence: sentFor(chosen) };
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
  const coreSentence = applyStrengthInterpolation(bundle.core, claim);
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

export function synthesizeClaimSentences(lines: string[], claimIds: string[], seed: string): string {
  if (lines.length === 0) return '';
  if (lines.length === 1) return lines[0];
  const parts: string[] = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    parts.push(pickGlue(claimIds[i - 1] ?? '', claimIds[i] ?? '', `${seed}:${i}`));
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

export function buildClaimMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier,
  surface: ProjectionSurface,
  sectionRoleDeque: ClaimOptionalRole[],
  paragraphNormDeque: string[]
): { text: string; claimIds: string[] } {
  const n = claimWindow(tier);
  const slice = core.claims.slice(0, n);
  const lines: string[] = [];
  const ids: string[] = [];
  const maxLines = tier === 'baseline' ? 3 : tier === 'expanded' ? 5 : 8;
  for (let i = 0; i < slice.length && lines.length < maxLines; i++) {
    const c = slice[i];
    const block = renderClaimExpressionBlock({
      claim: c,
      localIndex: i,
      seed: `${seed}|${c.claim_id}|mep`,
      surface,
      tier,
      sectionRoleDeque,
      paragraphNormDeque,
    });
    lines.push(block.text);
    ids.push(c.claim_id);
  }
  return { text: synthesizeClaimSentences(lines, ids, `${seed}:mep`), claimIds: ids };
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
    `This picture mixes supportive and challenging emphases; many people with this mix find that integration works best when neither side is forced to "win." ${withTerminalPeriod(mapTempo(core.audio.tempo_band))} That shapes how repair and forward motion take turns as the contrast lands.`,
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
  paragraphNormDeque: string[]
): { title: string; text: string; claimIds: string[] } {
  const start = 2 + panelIndex * 3;
  const slice = core.claims.slice(start, start + 3 + (tier === 'extended' ? 2 : 0));
  const lines: string[] = [];
  const ids: string[] = [];
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    const block = renderClaimExpressionBlock({
      claim: c,
      localIndex: i,
      seed: `${seed}|${c.claim_id}|panel:${panelIndex}`,
      surface,
      tier,
      sectionRoleDeque,
      paragraphNormDeque,
    });
    lines.push(block.text);
    ids.push(c.claim_id);
  }
  const text =
    synthesizeClaimSentences(lines, ids, `${seed}:pan:${panelIndex}`) ||
    pickVariant(seed, [
      'This picture includes additional emphasis that may show up subtly in how the pattern lands rather than as a single headline.',
    ]);
  return {
    title: `Pattern note ${panelIndex + 1}`,
    text,
    claimIds: ids,
  };
}

export function buildCampaignPressureResponseParagraph(core: SemanticCore, seed: string): { text: string; claimIds: string[] } {
  const tension = core.claims.find((c) => c.claim_id.startsWith('TENSION_BAND'));
  const motion = core.claims.find((c) => c.claim_id.startsWith('MOTION_LABEL'));
  const ids: string[] = [];
  if (tension) ids.push(tension.claim_id);
  if (motion) ids.push(motion.claim_id);
  const tLabel = tension ? campaignLabelForClaimId(tension.claim_id) : null;
  const mLabel = motion ? campaignLabelForClaimId(motion.claim_id) : null;
  const tc = mapTempoLeadClauseForEmbed(core.audio.tempo_band);
  const tempoCue = tc.charAt(0).toLowerCase() + tc.slice(1);
  const tNote = tLabel
    ? `Scenario pressure: ${tLabel}; treat activation as something that returns quickly, and keep steps small enough to steer when it spikes.`
    : `Scenario pressure: structural cues read diffuse here; still use short loops and named checkpoints when intensity climbs so the day does not blur.`;
  const mNote = mLabel
    ? `Response shape: ${mLabel} asks you to match action to the impulse curve (${tempoCue}) instead of fighting the body of the motion.`
    : `Response shape: without a dominant motion label, alternate consolidation and push rather than locking one speed; let ${tempoCue} set the pacing dial.`;
  const text = pickVariant(seed + ':camp', [tNote + ' ' + mNote]);
  return { text, claimIds: ids };
}
