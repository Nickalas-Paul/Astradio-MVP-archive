/**
 * Step 5 — claim synthesis (deterministic integration; no new claims).
 * Audio-overlap dimensions are not expressed here — use audio-lexicon at template layer.
 */
import type { SemanticCore, SemanticClaim } from '../../semantic/semantic-core';
import type { ClaimId } from '../../semantic/ontology-codes';
import type { ExpansionTier } from '../projection-types';
import { pacingPhraseFromCore, rhythmGroovePhraseFromCore } from './audio-lexicon';
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
    TENSION_BAND_HIGH: 'a high structural tension band',
    TENSION_BAND_MED: 'a moderate structural tension band',
    TENSION_BAND_LOW: 'a low structural tension band',
    MOTION_LABEL_SURGING: 'a surging motion profile',
    MOTION_LABEL_RESTLESS: 'a restless motion profile',
    MOTION_LABEL_QUIET_FLOW: 'a quiet-flow motion profile',
    MOTION_LABEL_INWARD: 'an inward consolidation motion profile',
    MOTION_LABEL_STEADY: 'a steady motion profile',
  };
  return table[id] ?? 'an encoded motion pattern';
}

function pickGlue(prevId: string, nextId: string, seed: string): string {
  const key = `${prevId}>${nextId}`;
  return pickVariant(`${seed}:glue:${key}`, [
    'In the same readout,',
    'Alongside that signal,',
    'Taken together with the prior emphasis,',
  ]);
}

export function sentenceForClaim(c: SemanticClaim, seed: string): string {
  const id = c.claim_id as ClaimId;
  const s = `${seed}:${id}`;
  const strengthNote =
    c.strength >= 0.66 ? 'with relatively strong encoding in the feature field' : 'with moderate encoding in the feature field';

  const byId: Partial<Record<ClaimId, string[]>> = {
    ELEMENT_FIRE_DOM: [
      `A fire-weighted emphasis ${strengthNote} often correlates with quicker initiation and visible expressive heat in how the pattern lands.`,
    ],
    ELEMENT_EARTH_DOM: [
      `An earth-weighted emphasis ${strengthNote} often correlates with stepwise stabilization and a preference for tangible, incremental adjustment.`,
    ],
    ELEMENT_AIR_DOM: [
      `An air-weighted emphasis ${strengthNote} often correlates with conceptual mobility and a tendency to narrate or reframe experience quickly.`,
    ],
    ELEMENT_WATER_DOM: [
      `A water-weighted emphasis ${strengthNote} often correlates with emotional permeability and layered processing before outward commitment.`,
    ],
    TENSION_BAND_HIGH: [
      `Higher structural tension in the encoded field often shows up as sharper contrasts moment to moment without implying a single crisis label.`,
    ],
    TENSION_BAND_MED: [
      `Moderate tension in the encoded field often shows up as workable friction: enough edge to move things, without constant crisis signaling.`,
    ],
    TENSION_BAND_LOW: [
      `Lower structural tension in the encoded field often shows up as smoother continuity and fewer abrupt breaks between emphasis beats.`,
    ],
    TONAL_BRIGHT: [
      `A brighter tonal register in the encoded field often correlates with outward lift and a tendency to emphasize possibility over heaviness.`,
    ],
    TONAL_DARK: [
      `A darker tonal register in the encoded field often correlates with depth-first processing and a tendency to take tension seriously rather than glossing it.`,
    ],
    TONAL_BALANCED: [
      `A balanced tonal register in the encoded field often correlates with mixed brightness cues that can flex with context rather than locking one mood.`,
    ],
    REL_HARMONY_HIGH: [
      `High harmony-band signaling in the relational field often correlates with cooperative resonance and easier mutual coordination when activation rises.`,
    ],
    REL_FRICTION_HIGH: [
      `High friction-band signaling in the relational field often correlates with edge-rich contact where misunderstandings can spike if timing is ignored.`,
    ],
    REL_INTENSITY_HIGH: [
      `High intensity-band signaling in the relational field often correlates with amplified activation: more signal per interaction, for better or sharper.`,
    ],
    CROSS_ELEMENT_DRIFT_HIGH: [
      `Strong cross-chart elemental drift often correlates with divergent baseline styles; blending language too quickly may flatten real differences.`,
    ],
    CROSS_TENSION_DELTA_HIGH: [
      `A large tension delta between charts often correlates with alternating stress profiles; a single unified arc may not fit both baselines.`,
    ],
    STRUCT_STELLIUM: [
      `A clustered structural signature often correlates with concentrated emphasis: many threads pulling through the same thematic doorway.`,
    ],
    MOTION_LABEL_SURGING: [
      `Surging motion labeling often correlates with forward impulse and rapid ramps in how energy is spent.`,
    ],
    MOTION_LABEL_INWARD: [
      `Inward motion labeling often correlates with consolidation phases where outward visibility lags behind internal processing.`,
    ],
    GRAVITY_LABEL_ANCHORED: [
      `Anchored gravity labeling often correlates with weighty emphasis and slower release in how resolution arrives.`,
    ],
  };

  const variants = byId[id];
  if (variants?.length) {
    return pickVariant(s, variants);
  }
  return `This readout carries an additional encoded emphasis ${strengthNote}; it may show up as subtle shifts rather than a single fixed behavioral label.`;
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
  excludeClaimIds?: Set<string>
): { text: string; claimIds: string[] } {
  const lines: string[] = [];
  const ids: string[] = [];
  const excl = excludeClaimIds ?? new Set<string>();
  for (let i = start; i < core.claims.length && lines.length < maxCount; i++) {
    const c = core.claims[i];
    if (excl.has(c.claim_id)) continue;
    lines.push(sentenceForClaim(c, `${seed}:rng:${i}`));
    ids.push(c.claim_id);
  }
  return { text: synthesizeClaimSentences(lines, ids, `${seed}:synrng`), claimIds: ids };
}

export function buildClaimMechanismExpressionParagraph(
  core: SemanticCore,
  seed: string,
  tier: ExpansionTier
): { text: string; claimIds: string[] } {
  const n = claimWindow(tier);
  const slice = core.claims.slice(0, n);
  const lines: string[] = [];
  const ids: string[] = [];
  const maxLines = tier === 'baseline' ? 3 : tier === 'expanded' ? 5 : 8;
  for (let i = 0; i < slice.length && lines.length < maxLines; i++) {
    const c = slice[i];
    lines.push(sentenceForClaim(c, `${seed}:me:${i}`));
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
  const pace = pacingPhraseFromCore(core);
  const text = pickVariant(seed + ':ti', [
    `Taken together, constructive and challenging signals both appear in this readout; this configuration tends to benefit from naming friction without treating it as the whole story, while still honoring supportive threads where they show up.`,
    `This readout mixes supportive and challenging emphases; many people with this mix find that integration works best when neither side is forced to “win,” and ${pace} alternates between repair and forward motion in how the field reads.`,
  ]);
  return { text, claimIds: cIds };
}

export function buildSupplementalPanel(
  core: SemanticCore,
  seed: string,
  panelIndex: number,
  tier: ExpansionTier
): { title: string; text: string; claimIds: string[] } {
  const start = 2 + panelIndex * 3;
  const slice = core.claims.slice(start, start + 3 + (tier === 'extended' ? 2 : 0));
  const lines: string[] = [];
  const ids: string[] = [];
  for (let i = 0; i < slice.length; i++) {
    lines.push(sentenceForClaim(slice[i], `${seed}:panel:${panelIndex}:${i}`));
    ids.push(slice[i].claim_id);
  }
  const text =
    synthesizeClaimSentences(lines, ids, `${seed}:pan:${panelIndex}`) ||
    pickVariant(seed, [
      'This readout includes additional encoded emphasis that may show up subtly in how the pattern lands rather than as a single headline.',
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
  const groove = rhythmGroovePhraseFromCore(core);
  const tNote = tLabel
    ? `Scenario pressure: ${tLabel} in this readout often maps to a shorter feedback loop; the state may ask for steadier breath and smaller steps when activation spikes.`
    : `Scenario pressure: cues in this readout are distributed; the state may still benefit from shorter loops and explicit checkpoints when intensity rises.`;
  const mNote = mLabel
    ? `Response shape: ${mLabel} suggests matching action to the encoded impulse curve (${groove}) rather than forcing the opposite speed.`
    : `Response shape: without a dominant motion label, alternating consolidation and push tends to be safer than a single fixed speed; use ${groove} as the staging read.`;
  const text = pickVariant(seed + ':camp', [tNote + ' ' + mNote]);
  return { text, claimIds: ids };
}
